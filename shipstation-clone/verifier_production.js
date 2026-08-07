/**
 * Suis-je en production ?
 *
 *   node shipstation-clone/verifier_production.js
 *
 * Une seule question, posée à chaque fournisseur : l'hôte visé est-il celui du compte réel,
 * et les identifiants en place y répondent-ils ? Rien n'est modifié, rien n'est acheté — que
 * des lectures.
 *
 * La question n'est pas théorique. Une étiquette achetée contre un hôte d'essai n'existe
 * pas : elle rend un identifiant, aucun suivi, aucune facture, et la commande passe à
 * « expédiée » pour un colis qui ne partira jamais. C'est arrivé sur la commande 100762.
 *
 * Le point crucial : la clé de production et la clé d'essai ne sont pas forcément la même.
 * Ce contrôle interroge la PRODUCTION avec les identifiants en place, sans toucher aux
 * réglages. La réponse tranche entre les deux seuls cas possibles :
 *
 *   200  la clé vaut pour la production — il suffit de retirer la variable d'hôte
 *   401  la clé est celle du bac à sable — il faut demander les identifiants de production
 */
const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", A = "\x1b[33m!\x1b[0m";
const G = "\x1b[90m", R = "\x1b[0m", B = "\x1b[1m";

const PRODUCTION = {
  freightcom: "https://external-api.freightcom.com",
  chitchats: "https://chitchats.com",
};

const estEssai = (url) => /ssd-test|sandbox|staging|\btest\./i.test(String(url || ""));

/** Un appel en lecture pure, borné dans le temps. On rend le code, jamais le corps entier. */
async function sonder(url, entetes) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: entetes, signal: AbortSignal.timeout(20000) });
    const txt = await r.text();
    return { statut: r.status, ok: r.ok, ms: Date.now() - t0, extrait: txt.slice(0, 160) };
  } catch (e) {
    return { statut: 0, ok: false, ms: Date.now() - t0, erreur: e.message };
  }
}

/**
 * Le verdict d'un fournisseur. Trois états et pas deux : « déjà en production » n'appelle
 * aucune action, « la clé passe » en appelle une petite, « la clé ne passe pas » en appelle
 * une auprès du fournisseur.
 */
function verdict(nom, { hoteActuel, sonde, variable }) {
  const enEssai = estEssai(hoteActuel);
  console.log(`\n${B}${nom}${R}`);
  console.log(`  hôte visé : ${hoteActuel}${enEssai ? `   ${A} BAC À SABLE` : `   ${V} production`}`);

  if (!enEssai) {
    console.log(`  ${G}Rien à faire : les achats partent déjà sur le compte réel.${R}`);
    return "production";
  }

  console.log(`  test de la clé actuelle contre la production : ${
    sonde.statut ? `HTTP ${sonde.statut}` : `injoignable (${sonde.erreur})`} en ${sonde.ms} ms`);

  if (sonde.ok) {
    console.log(`\n  ${V} ${B}LA MÊME CLÉ FONCTIONNE EN PRODUCTION.${R}`);
    console.log(`  ${G}Retirer ${variable} des réglages Render suffit — c'est tout.`);
    console.log(`  Le défaut du clone EST la production ; la variable ne fait que la court-circuiter.${R}`);
    return "retirer-variable";
  }
  // Un 403 n'est pas toujours un refus d'authentification : un proxy réseau d'entreprise
  // rend le même code quand l'hôte n'est pas dans sa liste. Conclure « clé d'essai » là-dessus
  // enverrait demander des identifiants dont on dispose peut-être déjà.
  const barrageReseau = sonde.statut === 403
    && /allowlist|egress|proxy|blocked|not permitted/i.test(sonde.extrait || "");
  if (barrageReseau) {
    console.log(`\n  ${A} ${B}TEST IMPOSSIBLE DEPUIS CETTE MACHINE.${R}`);
    console.log(`  ${G}Le 403 vient du réseau, pas de Freightcom : l'hôte de production n'est`);
    console.log(`  pas joignable d'ici. Relancer cette commande là où le service tourne.`);
    console.log(`  Réponse : ${(sonde.extrait || "").slice(0, 110)}${R}`);
    return "indetermine";
  }
  if (sonde.statut === 401 || sonde.statut === 403) {
    console.log(`\n  ${X} ${B}LA CLÉ ACTUELLE EST CELLE DU BAC À SABLE.${R}`);
    console.log(`  ${G}Retirer ${variable} ne suffira pas : la production refusera cette clé.`);
    console.log(`  Il faut demander au fournisseur les identifiants de production, puis`);
    console.log(`  remplacer la clé ET retirer la variable d'hôte, dans cet ordre.${R}`);
    return "demander-cle";
  }
  console.log(`\n  ${A} Réponse inattendue — ni acceptation, ni refus d'authentification.`);
  console.log(`  ${G}${(sonde.extrait || sonde.erreur || "").slice(0, 140)}${R}`);
  return "indetermine";
}

(async () => {
  console.log("\nEn production, ou dans le bac à sable ?\n" + "─".repeat(64));
  console.log(`${G}Lectures seules. Aucun réglage n'est modifié, aucune étiquette achetée.${R}`);
  const actions = [];

  // ------------------------------------------------------------- Freightcom
  {
    const cle = process.env.FREIGHTCOM_API_KEY || "";
    const hote = process.env.FREIGHTCOM_URL || PRODUCTION.freightcom;
    if (!cle) {
      console.log(`\n${B}Freightcom${R}\n  ${X} FREIGHTCOM_API_KEY absente — rien à tester.`);
    } else {
      // `GET /services` : la lecture la plus anodine du contrat, et celle qui exige une clé
      // valide. Un 401 ici distingue une clé d'essai d'une clé de production.
      const sonde = await sonder(`${PRODUCTION.freightcom}/services`, { Authorization: cle });
      actions.push(["Freightcom", verdict("Freightcom", {
        hoteActuel: hote, sonde, variable: "FREIGHTCOM_URL" })]);
    }
  }

  // ------------------------------------------------------------- Chit Chats
  {
    const jeton = process.env.CHITCHATS_TOKEN || "";
    const client = process.env.CHITCHATS_CLIENT_ID || "";
    // Chit Chats ne bascule pas par une URL mais par CHITCHATS_ENV : tout ce qui n'est pas
    // « prod » vise le bac à sable, et ses comptes sont SÉPARÉS de ceux de production.
    const env = String(process.env.CHITCHATS_ENV || "").toLowerCase();
    const hote = process.env.CHITCHATS_URL
      || (env === "prod" ? PRODUCTION.chitchats : "https://staging.chitchats.com");
    if (!jeton || !client) {
      console.log(`\n${B}Chit Chats${R}\n  ${X} CHITCHATS_TOKEN ou CHITCHATS_CLIENT_ID absent — rien à tester.`);
    } else {
      const sonde = await sonder(
        `${PRODUCTION.chitchats}/api/v1/clients/${encodeURIComponent(client)}/shipments/count`,
        { Authorization: jeton });
      actions.push(["Chit Chats", verdict("Chit Chats", {
        hoteActuel: hote, sonde, variable: "CHITCHATS_ENV (à mettre à « prod »)" })]);
    }
  }

  // ---------------------------------------------------------------- synthèse
  console.log("\n" + "─".repeat(64));
  const aFaire = actions.filter(([, a]) => a !== "production");
  // Aucun fournisseur testé ne veut pas dire « tout va bien » : ça veut dire qu'on n'a rien
  // pu vérifier. Le dire, plutôt que de rassurer sur du vide.
  if (!actions.length) {
    console.log(`${A} Aucun fournisseur n'a d'identifiants en place : rien n'a pu être vérifié.`);
    console.log(`${G}  Cette commande se lance là où les clés vivent — sur Render, pas en local.${R}`);
  } else if (!aFaire.length) {
    console.log(`${V} Les ${actions.length} fournisseur(s) branché(s) visent la production.`);
  } else {
    console.log(`${B}Ce qu'il reste à faire${R}\n`);
    for (const [nom, action] of aFaire) {
      if (action === "retirer-variable") {
        console.log(`  ${nom} : retirer la variable d'hôte des réglages Render. Rien d'autre.`);
      } else if (action === "demander-cle") {
        console.log(`  ${nom} : demander les identifiants de PRODUCTION au fournisseur.`);
        console.log(`  ${G}          Ceux en place ne valent que pour le bac à sable.${R}`);
      } else {
        console.log(`  ${nom} : test non concluant — voir le détail plus haut.`);
      }
    }
  }
  console.log(`\n${G}Après changement, relancer cette commande : elle doit dire « production »`);
  console.log(`partout avant le premier achat réel.${R}\n`);
})().catch((e) => { console.error("\nÉCHEC :", e.message); process.exit(1); });
