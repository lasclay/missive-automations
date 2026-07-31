/**
 * meta_commentaires.js — rédaction assistée des réponses aux commentaires
 * Facebook et Instagram, avec ENTRAÎNEMENT EN DRY-RUN par défaut.
 * --------------------------------------------------------------------------
 * Le principe : le script ne publie RIEN tant qu'on ne le lui demande pas
 * explicitement. Par défaut il lit les commentaires récents, rédige une réponse
 * pour chacun, et écrit le tout dans un fichier de révision — en passant les
 * envois au proxy avec « dryRun: true », donc en voyant l'appel Graph exact qui
 * PARTIRAIT. On relit, on corrige le prompt, on recommence. Quand les réponses
 * sont bonnes, on ajoute --envoyer.
 *
 *   node meta_commentaires.js                     # dry-run, Facebook, 5 publications
 *   node meta_commentaires.js --limite 10         # 10 publications
 *   node meta_commentaires.js --post POST_ID      # une publication précise
 *   node meta_commentaires.js --instagram         # commentaires Instagram
 *   node meta_commentaires.js --envoyer           # PUBLIE les réponses (⚠️ public)
 *   node meta_commentaires.js --envoyer --oui     # sans confirmation interactive
 *
 * Env :
 *   META_PROXY_URL, META_PROXY_SECRET   requis (service meta-proxy sur Render)
 *   ANTHROPIC_API_KEY                   requis (rédaction des réponses)
 *   META_MODEL                          défaut claude-opus-5
 *   META_REPONSES_DIR                   défaut ./meta_reponses
 *
 * Ce que le script NE fait pas, volontairement :
 *   - il ne répond jamais deux fois au même commentaire (journal des traités) ;
 *   - il ne répond pas aux commentaires de la Page elle-même ;
 *   - il ne touche pas aux commentaires déjà masqués ;
 *   - il n'invente pas de statut de commande : quand la réponse dépend d'une
 *     donnée qu'il n'a pas, il marque « escalade » et laisse un humain répondre.
 *
 * Node 18+ (fetch natif). Aucune dépendance.
 */

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const PROXY_URL = (process.env.META_PROXY_URL || "").replace(/\/+$/, "");
const PROXY_SECRET = process.env.META_PROXY_SECRET || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.META_MODEL || "claude-opus-5";
const DOSSIER = process.env.META_REPONSES_DIR || path.join(process.cwd(), "meta_reponses");

const args = process.argv.slice(2);
const a = (nom) => args.includes(nom);
const val = (nom, defaut) => { const i = args.indexOf(nom); return i >= 0 && args[i + 1] ? args[i + 1] : defaut; };

const ENVOYER = a("--envoyer");
const SANS_CONFIRMATION = a("--oui");
const INSTAGRAM = a("--instagram");
const LIMITE = Number(val("--limite", 5));
const POST_UNIQUE = val("--post", null);

if (!PROXY_URL) { console.error("Manque META_PROXY_URL."); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("Manque ANTHROPIC_API_KEY."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Proxy Meta ----------------------------------------------------------
// En dry-run on ajoute « dryRun: true » aux ÉCRITURES seulement : les lectures
// doivent vraiment lire, sinon il n'y a rien à répondre. C'est toute la nuance
// du mode entraînement — on lit le vrai monde, on n'écrit pas dedans.
async function meta(action, params = {}, ecriture = false) {
  const corps = ecriture && !ENVOYER ? { ...params, dryRun: true } : params;
  const res = await fetch(`${PROXY_URL}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": PROXY_SECRET },
    body: JSON.stringify(corps),
  });
  const texte = await res.text();
  let json; try { json = JSON.parse(texte); } catch { json = { raw: texte }; }
  if (!res.ok) throw new Error(`${action} → ${res.status} ${(json && json.error) || texte.slice(0, 300)}`);
  return json;
}

// ---- Journal des commentaires déjà traités -------------------------------
// Sans lui, chaque exécution redemanderait une réponse pour les mêmes
// commentaires — et avec --envoyer, on répondrait deux fois. Le journal est la
// seule chose qui rend le script rejouable sans dégât.
const JOURNAL = path.join(DOSSIER, "traites.json");
function chargerJournal() {
  try { return new Set(JSON.parse(fs.readFileSync(JOURNAL, "utf8"))); } catch { return new Set(); }
}
function sauverJournal(set) {
  fs.mkdirSync(DOSSIER, { recursive: true });
  fs.writeFileSync(JOURNAL, JSON.stringify([...set], null, 2));
}

// ---- Contexte de marque (mis en cache côté Anthropic) --------------------
// Les fichiers de connaissance du dépôt servent de bloc système STABLE : il ne
// change pas d'un commentaire à l'autre, donc il est mis en cache et facturé
// ~10 % à partir du deuxième appel. Le cache exige un préfixe d'au moins
// 512 jetons sur claude-opus-5 ; en dessous, il ne se crée simplement pas.
function contexteMarque() {
  const morceaux = [];
  for (const f of ["contexte_lasclay.md", "connaissance_support.md"]) {
    try { morceaux.push(fs.readFileSync(path.join(process.cwd(), f), "utf8")); } catch { /* absent : on continue */ }
  }
  return morceaux.join("\n\n---\n\n");
}

const CONSIGNES = `Tu rédiges les réponses publiques de Lasclay aux commentaires sur ses publications
Facebook et Instagram. Ce que tu écris sera lu par le commentateur ET par tous les autres visiteurs.

Règles de rédaction :
- Réponds dans la langue du commentaire (français ou anglais).
- Court : deux ou trois phrases. Un commentaire n'est pas un courriel de service client.
- Chaleureux et concret, jamais corporatif. Pas d'emoji en rafale ; un seul, parfois, si le ton s'y prête.
- Utilise le prénom de la personne s'il est disponible.
- Ne promets rien que l'entreprise n'a pas décidé : pas de date de réapprovisionnement, pas de
  remboursement, pas de remise, pas de délai de livraison inventés.
- Une question précise sur une commande (« où est mon colis », « je veux échanger ») ne se règle pas
  en public : invite la personne à écrire en message privé, et marque escalade.

Quand marquer escalade = true :
- la réponse dépend d'une donnée que tu n'as pas (statut de commande, stock, politique non écrite) ;
- le commentaire est une plainte sérieuse, une accusation, ou parle d'un problème de sécurité ;
- le commentaire est ambigu au point que deux lectures mènent à deux réponses différentes.
Dans ces cas, rédige quand même une réponse d'accueil courte et sans engagement : un humain décidera.

Quand marquer ignorer = true : pourriel, insulte, ou simple « ❤️ » qui n'appelle pas de réponse.

Le texte de « reponse » est publié TEL QUEL. N'y mets ni guillemets d'encadrement, ni préambule,
ni commentaire sur ton propre travail.`;

const SCHEMA = {
  type: "object",
  properties: {
    reponse: { type: "string", description: "Le texte publié tel quel. Vide si ignorer = true." },
    escalade: { type: "boolean", description: "Un humain doit trancher avant publication." },
    ignorer: { type: "boolean", description: "Aucune réponse nécessaire (pourriel, réaction simple)." },
    motif: { type: "string", description: "Une phrase : pourquoi cette réponse, ou pourquoi escalade/ignorer." },
  },
  required: ["reponse", "escalade", "ignorer", "motif"],
  additionalProperties: false,
};

// ---- Appel Anthropic -----------------------------------------------------
// Sortie structurée : le modèle ne peut pas répondre à côté du schéma, donc pas
// de parsing approximatif. Pensée adaptative à effort « low » — la tâche est
// courte, mais on garde la pensée active (la désactiver sur opus-5 fait parfois
// fuir des balises internes dans le texte visible, qu'on publierait).
async function redigerReponse(commentaire, publication, marque, tries = 0) {
  const system = [
    // Bloc STABLE en premier, avec le point de cache à la fin : tout ce qui
    // précède est réutilisé d'un commentaire à l'autre.
    { type: "text", text: marque || "(aucun contexte de marque chargé)" },
    { type: "text", text: CONSIGNES, cache_control: { type: "ephemeral" } },
  ];
  const user = `Publication de la Page :
${(publication.message || "(sans texte)").slice(0, 1500)}

Commentaire à traiter :
- de : ${commentaire.auteur || "inconnu"}
- écrit le : ${(commentaire.date || "").slice(0, 10)}
- texte : ${commentaire.texte || "(vide)"}
${commentaire.reponses?.length ? `- réponses déjà présentes sous ce commentaire : ${commentaire.reponses.length}` : ""}`;

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000, // réponse courte, mais max_tokens plafonne pensée + texte : on laisse de la marge
        system,
        messages: [{ role: "user", content: user }],
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      }),
    });
  } catch (e) {
    if (tries < 3) { await sleep((tries + 1) * 2000); return redigerReponse(commentaire, publication, marque, tries + 1); }
    throw new Error(`réseau Anthropic : ${e.message}`);
  }
  if ((res.status === 429 || res.status >= 500) && tries < 3) {
    const ra = Number(res.headers.get("retry-after")) || (tries + 1) * 5;
    await sleep(Math.min(ra + 1, 65) * 1000);
    return redigerReponse(commentaire, publication, marque, tries + 1);
  }
  const texte = await res.text();
  if (!res.ok) throw new Error(`Anthropic → ${res.status} ${texte.slice(0, 400)}`);
  const j = JSON.parse(texte);
  // Un refus de sécurité renvoie un 200 avec stop_reason "refusal" et un content
  // vide : lire content[0] sans vérifier planterait sur un commentaire hostile.
  if (j.stop_reason === "refusal") {
    return { reponse: "", escalade: true, ignorer: false, motif: "Le modèle a refusé de rédiger : à traiter à la main." };
  }
  const bloc = (j.content || []).find((b) => b.type === "text");
  if (!bloc) return { reponse: "", escalade: true, ignorer: false, motif: "Réponse vide du modèle." };
  try { return JSON.parse(bloc.text); }
  catch { return { reponse: "", escalade: true, ignorer: false, motif: "Sortie illisible du modèle." }; }
}

// ---- Collecte des commentaires ------------------------------------------
function normaliserFB(c) {
  return {
    id: c.id,
    texte: c.message || "",
    auteur: (c.from && c.from.name) || null,
    auteurId: (c.from && c.from.id) || null,
    date: c.created_time || "",
    masque: !!c.is_hidden,
    reponses: [],
    lien: c.permalink_url || null,
  };
}
function normaliserIG(c) {
  return {
    id: c.id,
    texte: c.text || "",
    auteur: c.username ? `@${c.username}` : null,
    auteurId: null,
    date: c.timestamp || "",
    masque: !!c.hidden,
    reponses: (c.replies && c.replies.data) || [],
    lien: null,
  };
}

async function collecter() {
  const lots = [];
  if (INSTAGRAM) {
    const { data: compte } = await meta("igaccount");
    const medias = POST_UNIQUE
      ? { data: [{ id: POST_UNIQUE, caption: "" }] }
      : (await meta("igmedia", { limit: LIMITE })).data;
    for (const m of (medias.data || [])) {
      const { data } = await meta("igcomments", { mediaId: m.id });
      lots.push({
        publication: { id: m.id, message: m.caption || "", lien: m.permalink || null },
        commentaires: (data.data || []).map(normaliserIG),
      });
    }
    return { lots, nousMemes: new Set([compte.id, compte.username ? `@${compte.username}` : ""]) };
  }
  const publications = POST_UNIQUE
    ? [{ id: POST_UNIQUE, message: "" }]
    : ((await meta("posts", { limit: LIMITE })).data.data || []);
  for (const p of publications) {
    const { data } = await meta("comments", { objectId: p.id });
    lots.push({
      publication: { id: p.id, message: p.message || "", lien: p.permalink_url || null },
      commentaires: (data.data || []).map(normaliserFB),
    });
  }
  // Les commentaires de la Page elle-même (nos propres réponses) ne doivent pas
  // déclencher une réponse à nous-mêmes.
  const { data: pages } = await meta("pages");
  return { lots, nousMemes: new Set((pages.data || []).map((p) => p.id)) };
}

// ---- Rapport de révision -------------------------------------------------
function ecrireRapport(resultats, horodatage) {
  fs.mkdirSync(DOSSIER, { recursive: true });
  const base = path.join(DOSSIER, `${horodatage}-${ENVOYER ? "envoi" : "dry-run"}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(resultats, null, 2));

  const l = [];
  l.push(`# Réponses aux commentaires — ${horodatage}`);
  l.push("");
  l.push(ENVOYER ? "**Mode : ENVOI — ces réponses ont été publiées.**" : "**Mode : dry-run — rien n'a été publié.**");
  l.push("");
  for (const r of resultats) {
    l.push(`## ${r.auteur || "anonyme"} — ${(r.date || "").slice(0, 10)}`);
    l.push(`> ${r.texte.replace(/\n/g, "\n> ")}`);
    l.push("");
    if (r.ignorer) l.push(`*Ignoré : ${r.motif}*`);
    else {
      l.push(`**Réponse proposée :** ${r.reponse}`);
      l.push("");
      l.push(`*${r.escalade ? "⚠️ ESCALADE — " : ""}${r.motif}*`);
      if (r.apercu) l.push(`\n\`\`\`\n${r.apercu.method} ${r.apercu.path}\n${JSON.stringify(r.apercu.body)}\n\`\`\``);
      if (r.publie) l.push(`\n✅ Publié (id ${r.publie}).`);
      if (r.erreur) l.push(`\n❌ Échec : ${r.erreur}`);
    }
    l.push("");
    if (r.lien) l.push(`[Voir le commentaire](${r.lien})`);
    l.push("\n---\n");
  }
  fs.writeFileSync(`${base}.md`, l.join("\n"));
  return base;
}

function confirmer(question) {
  if (SANS_CONFIRMATION) return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(question, (rep) => { rl.close(); r(/^(o|oui|y|yes)$/i.test(rep.trim())); }));
}

// ---- Programme -----------------------------------------------------------
(async () => {
  const horodatage = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "h");
  console.log(ENVOYER
    ? "⚠️  MODE ENVOI : les réponses validées seront PUBLIÉES."
    : "Mode dry-run : lecture réelle, aucune publication. (--envoyer pour publier)");

  const journal = chargerJournal();
  const marque = contexteMarque();
  if (!marque) console.log("(aucun contexte de marque trouvé — les réponses seront génériques)");

  const { lots, nousMemes } = await collecter();
  const total = lots.reduce((n, l) => n + l.commentaires.length, 0);
  console.log(`${lots.length} publication(s), ${total} commentaire(s) au total.`);

  const resultats = [];
  for (const lot of lots) {
    for (const c of lot.commentaires) {
      if (journal.has(c.id)) continue;                       // déjà traité
      if (c.masque) continue;                                 // modéré, on n'y touche pas
      if (c.auteurId && nousMemes.has(c.auteurId)) continue;  // c'est nous
      if (!c.texte.trim()) continue;

      process.stdout.write(`  ${c.auteur || "anonyme"}… `);
      const avis = await redigerReponse(c, lot.publication, marque);
      const r = { ...c, publication: lot.publication.id, ...avis };

      if (avis.ignorer || !avis.reponse.trim()) {
        console.log("ignoré");
      } else {
        const action = INSTAGRAM ? "igreply" : "replycomment";
        try {
          // Escalade : on n'envoie jamais, même avec --envoyer. C'est le seul
          // cas où le script décide seul de ne pas parler au nom de la marque.
          if (avis.escalade && ENVOYER) {
            console.log("ESCALADE — non publié");
          } else {
            const rep = await meta(action, { commentId: c.id, message: avis.reponse }, true);
            if (rep.dryRun) { r.apercu = rep.data.apercu; console.log("préparé"); }
            else { r.publie = rep.data.id || "ok"; journal.add(c.id); console.log("publié"); }
          }
        } catch (e) { r.erreur = e.message; console.log(`échec : ${e.message}`); }
      }
      resultats.push(r);
      // En envoi, un commentaire traité est clos — SAUF une escalade, qui reste
      // ouverte : un humain doit encore la voir, donc elle doit ressortir demain.
      if (ENVOYER && !avis.escalade) journal.add(c.id);
    }
  }

  if (!resultats.length) { console.log("Rien de nouveau à traiter."); return; }

  const base = ecrireRapport(resultats, horodatage);
  const escalades = resultats.filter((r) => r.escalade && !r.ignorer).length;
  console.log(`\n${resultats.length} commentaire(s) traité(s), ${escalades} escalade(s).`);
  console.log(`Révision : ${base}.md`);

  if (ENVOYER) { sauverJournal(journal); return; }

  console.log("\nRelis le fichier. Si les réponses te conviennent :");
  console.log("  node meta_commentaires.js --envoyer");
  const ok = await confirmer("\nPublier ces réponses maintenant ? (o/N) ");
  if (!ok) { console.log("Rien n'a été publié."); return; }

  console.log("\nPublication…");
  for (const r of resultats) {
    if (r.ignorer || r.escalade || !r.reponse.trim() || r.erreur) continue;
    const action = INSTAGRAM ? "igreply" : "replycomment";
    try {
      const rep = await fetch(`${PROXY_URL}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Proxy-Secret": PROXY_SECRET },
        body: JSON.stringify({ commentId: r.id, message: r.reponse }),
      });
      const t = await rep.text();
      if (!rep.ok) throw new Error(t.slice(0, 200));
      r.publie = (JSON.parse(t).data || {}).id || "ok";
      journal.add(r.id);
      console.log(`  ${r.auteur || "anonyme"} : publié`);
    } catch (e) { r.erreur = String(e.message); console.log(`  ${r.auteur || "anonyme"} : échec — ${e.message}`); }
  }
  sauverJournal(journal);
  ecrireRapport(resultats, `${horodatage}-apres-envoi`);
  console.log("Journal mis à jour : ces commentaires ne seront pas retraités.");
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
