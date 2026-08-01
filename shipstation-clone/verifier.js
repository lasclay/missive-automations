/**
 * Vérification d'installation — à lancer après le déploiement, avant d'ouvrir aux employés.
 *
 *   node shipstation-clone/verifier.js
 *
 * Contrôle ce qui casse silencieusement : version de Node, disque persistant réellement monté,
 * base accessible en écriture, secrets présents, proxy joignable, comptes et 2FA en place.
 * Sort en code 1 si un point bloquant échoue — utilisable dans un script de démarrage.
 */
const fs = require("fs");
const path = require("path");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", A = "\x1b[33m!\x1b[0m", G = "\x1b[90m";
const R = "\x1b[0m";
let bloquants = 0, avertissements = 0;

const ok = (t, d = "") => console.log(`${V} ${t}${d ? `  ${G}${d}${R}` : ""}`);
const ko = (t, d = "") => { bloquants++; console.log(`${X} ${t}${d ? `  ${G}${d}${R}` : ""}`); };
const av = (t, d = "") => { avertissements++; console.log(`${A} ${t}${d ? `  ${G}${d}${R}` : ""}`); };

/**
 * Lance les contrôles. Appelé en ligne de commande, et aussi au démarrage du serveur pour
 * que le bilan soit dans les logs Render sans avoir à ouvrir un shell.
 */
async function verifier() {
  bloquants = 0; avertissements = 0;
  console.log("\nVérification de l'installation\n" + "─".repeat(60));

  // --- Node
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj > 22 || (maj === 22 && min >= 5)) ok(`Node ${process.versions.node}`, "node:sqlite disponible");
  else ko(`Node ${process.versions.node} trop ancien`, "22.5 minimum — node:sqlite absent avant");

  // --- Base de données et persistance
  let db;
  try {
    db = require("./lib/db");
    db.db();
    const chemin = db.CHEMIN;
    ok("Base ouverte", chemin);

    // Le piège du déploiement : une base hors disque persistant s'efface au redéploiement.
    const surRender = !!process.env.RENDER || !!process.env.RENDER_SERVICE_ID;
    const dansDisque = /^\/var\/data|^\/data/.test(path.resolve(chemin));
    if (surRender && !dansDisque)
      ko("Base HORS disque persistant", `${chemin} sera effacé au prochain redéploiement — pointer CLONE_DB dans le disque monté`);
    else if (surRender) ok("Base sur le disque persistant");

    fs.accessSync(path.dirname(chemin), fs.constants.W_OK);
    ok("Dossier de la base accessible en écriture");

    const taille = fs.existsSync(chemin) ? fs.statSync(chemin).size : 0;
    console.log(`${G}   ${(taille / 1048576).toFixed(1)} Mo${R}`);
  } catch (e) {
    ko("Base inaccessible", e.message);
  }

  if (db) {
    const n = (t) => { try { return db.one(`SELECT COUNT(*) n FROM ${t}`).n; } catch { return -1; } };

    // --- Comptes et sécurité
    const comptes = db.one("SELECT COUNT(*) n FROM users WHERE password_hash IS NOT NULL").n;
    if (comptes) ok(`${comptes} compte(s) avec mot de passe`);
    else av("Aucun compte", "l'administrateur sera créé au premier démarrage, mot de passe dans les logs");

    const avec2fa = db.one("SELECT COUNT(*) n FROM users WHERE totp_enabled = 1").n;
    const exige = db.reglage("exiger_2fa", false);
    if (exige && comptes && avec2fa < comptes)
      av(`2FA obligatoire mais ${comptes - avec2fa} compte(s) sans`, "ils devront le configurer à leur prochaine connexion");
    else if (comptes) ok(`Second facteur actif sur ${avec2fa}/${comptes} compte(s)`,
      exige ? "obligatoire" : "facultatif — Réglages pour l'imposer");

    if (process.env.CLONE_COOKIE_SECURE === "0") {
      const surRender = !!process.env.RENDER;
      (surRender ? ko : av)("Cookies non-Secure", surRender
        ? "à retirer en production HTTPS — les sessions circuleraient en clair"
        : "normal en HTTP local");
    } else ok("Cookies Secure");

    // --- Données
    const commandes = n("orders"), expeditions = n("shipments"), produits = n("products");
    if (commandes > 0) ok(`${commandes.toLocaleString("fr-CA")} commandes`, `${expeditions.toLocaleString("fr-CA")} expéditions`);
    else av("Aucune commande", "lancer la migration : Réglages → Lancer la migration");
    if (produits === 0 && commandes > 0)
      av("Aucun produit", "l'action 'products' du proxy exige que la branche soit fusionnée dans main");

    // --- Règles
    const regles = db.all("SELECT name, enabled FROM rules");
    const actives = regles.filter((r) => r.enabled).length;
    if (!regles.length) av("Aucune règle d'automatisation");
    else if (!actives) av(`${regles.length} règle(s), aucune active`,
      "la configuration Lasclay n'a peut-être pas été chargée — Réglages");
    else ok(`${actives}/${regles.length} règle(s) active(s)`);
  }

  // --- Transporteur
  const adaptateur = process.env.CARRIER_ADAPTER || "bouchon";
  const etiquettes = process.env.CLONE_ALLOW_LABELS === "1";
  if (adaptateur === "bouchon") av("Transporteur : bouchon", "tarifs de démonstration — aucun achat réel possible");
  else ok(`Transporteur : ${adaptateur}`);
  if (etiquettes && adaptateur !== "bouchon") av("ACHAT D'ÉTIQUETTES ACTIF", "les lots débiteront un vrai compte");
  else if (etiquettes) ok("Achat activé", "sans effet : adaptateur bouchon");
  else ok("Achat d'étiquettes désactivé");

  // --- Proxy général (migration)
  const secret = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET;
  if (!secret) av("GENERAL_PROXY_SECRET absent", "la migration depuis ShipStation échouera");
  else {
    const url = process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com";
    try {
      const r = await fetch(`${url}/connectors`, { signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      const actions = j.connectors?.shipstation?.actions || [];
      ok("Proxy général joignable", `${actions.length} actions ShipStation`);
      if (!actions.includes("products"))
        av("Action 'products' absente du proxy", "branche non fusionnée dans main — les produits ne migreront pas");
      else ok("Action 'products' disponible");
    } catch (e) {
      av("Proxy général injoignable", e.message.slice(0, 60) + " (Render s'endort au repos, réessayer)");
    }
  }

  console.log("─".repeat(60));
  if (bloquants) console.log(`\n\x1b[31m${bloquants} point(s) bloquant(s)\x1b[0m, ${avertissements} avertissement(s)\n`);
  else console.log(`\n\x1b[32mAucun point bloquant\x1b[0m, ${avertissements} avertissement(s)\n`);
  return { bloquants, avertissements };
}

module.exports = { verifier };

if (require.main === module) {
  verifier().then(({ bloquants: b }) => process.exit(b ? 1 : 0));
}
