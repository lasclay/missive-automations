/**
 * Lasclay — veille/distille.js
 * --------------------------------------------------------------------------
 * LA DISTILLATION : transforme l'ardoise en connaissance lisible.
 *
 * C'est l'étape qui referme la boucle. Sans elle, l'ardoise n'est qu'un tas de
 * verbatim de plus — collecté proprement, et jamais lu. La distillation produit
 * `veille/connaissance/decouvertes.md`, un fichier que les autres skills
 * peuvent charger au même titre que `connaissance_support.md`.
 *
 * DEUX MODES, et c'est délibéré :
 *
 *   • SANS clé d'API — agrégation déterministe : volumes par type, par thème,
 *     par produit, séries dans le temps, et les verbatim les plus représentatifs
 *     de chaque groupe. Gratuit, reproductible, tourne partout. Ça ne conclut
 *     rien, mais ça range tout, et un humain qui lit ça voit déjà ce qui monte.
 *
 *   • AVEC clé d'API — le modèle relit les groupes et écrit la synthèse : ce
 *     qui se répète, ce qui est neuf ce mois-ci, ce qui contredit une décision
 *     passée. Le mode déterministe reste produit dans tous les cas et sert de
 *     pièce justificative — on peut toujours vérifier la synthèse contre les
 *     comptes.
 *
 * La distillation N'ÉCRIT JAMAIS dans les fichiers de connaissance de marque
 * (`connaissance_support.md`, `contexte_lasclay.md`). Elle écrit dans son
 * propre dossier, et un humain décide de ce qui migre. Un système qui se
 * réécrit ses propres règles sans ratification dérive, et personne ne s'en
 * aperçoit avant que ce soit dans une réponse client.
 *
 * Variables d'environnement :
 *   ANTHROPIC_API_KEY   facultative — sans elle, mode déterministe seulement
 *   MODEL               défaut claude-sonnet-4-6
 *   VEILLE_FENETRE      nombre de jours regardés pour « ce qui est récent » (défaut 90)
 *
 * Node 18+. Aucune dépendance.
 */

const fs = require("node:fs");
const path = require("node:path");
const ardoise = require("./ardoise");
const pretri = require("./pretri");

const SORTIE = path.join(__dirname, "connaissance");
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const FENETRE = parseInt(process.env.VEILLE_FENETRE || "90", 10);

const LIBELLES = {
  risque_securite: "Risque de sécurité",
  segment_usage: "Usages et publics non planifiés",
  idee_produit: "Idées de produit",
  offre_partenariat: "Capacités offertes de l'extérieur",
  objection_achat: "Objections d'achat",
  defaut_produit: "Défauts signalés",
  taille_ajustement: "Taille et ajustement",
  friction_operation: "Friction d'opération",
  mesure_ops: "Mesures d'opération",
  eloge: "Appréciation",
  "inclassé": "Non classés",
};

// L'ordre dans lequel un humain doit rencontrer les catégories : ce qui blesse
// d'abord, ce qui ouvre un marché ensuite, la satisfaction en dernier.
const ORDRE = [
  "risque_securite", "segment_usage", "idee_produit", "offre_partenariat",
  "objection_achat", "defaut_produit", "taille_ajustement",
  "friction_operation", "mesure_ops", "inclassé", "eloge",
];

function jours(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr).getTime();
  return Number.isFinite(d) ? (Date.now() - d) / 86400000 : Infinity;
}

/** Verbatim les plus utiles d'un groupe : les plus longs, donc les plus argumentés. */
function representatifs(signaux, n = 6) {
  return [...signaux]
    .sort((a, b) => (b.texte || "").length - (a.texte || "").length)
    .slice(0, n);
}

function serieMensuelle(signaux) {
  const m = new Map();
  for (const s of signaux) {
    if (!s.date) continue;
    const mois = String(s.date).slice(0, 7);
    m.set(mois, (m.get(mois) || 0) + 1);
  }
  return [...m.entries()].sort();
}

// --- Mode déterministe -----------------------------------------------------

function rapportDeterministe(signaux) {
  const agg = pretri.agrege(signaux);
  const recents = signaux.filter((s) => jours(s.date) <= FENETRE);
  const aggRecents = pretri.agrege(recents);
  const L = [];

  L.push("# Découvertes — ce que la boîte nous apprend");
  L.push("");
  L.push("> Produit par `veille/distille.js` à partir de l'ardoise. Ce fichier est une");
  L.push("> LECTURE de signaux clients, pas une décision. Rien n'en sort vers la");
  L.push("> connaissance de marque sans ratification humaine.");
  L.push("");
  L.push(`Ardoise : **${agg.total} signaux**. Fenêtre récente : **${recents.length}** signaux`);
  L.push(`sur les ${FENETRE} derniers jours.`);
  L.push("");

  L.push("## Volumes");
  L.push("");
  L.push("| Type | Total | Dont récents |");
  L.push("| --- | ---: | ---: |");
  const recentsParType = new Map(aggRecents.par_type);
  for (const cle of ORDRE) {
    const total = (agg.par_type.find(([k]) => k === cle) || [null, 0])[1];
    if (!total) continue;
    L.push(`| ${LIBELLES[cle] || cle} | ${total} | ${recentsParType.get(cle) || 0} |`);
  }
  L.push("");

  if (agg.par_produit.length) {
    L.push("## Produits nommés");
    L.push("");
    L.push(agg.par_produit.map(([p, n]) => `${p} (${n})`).join(" · "));
    L.push("");
  }

  if (agg.par_theme.length) {
    L.push("## Thèmes transversaux");
    L.push("");
    L.push(agg.par_theme.map(([t, n]) => `${t} (${n})`).join(" · "));
    L.push("");
  }

  const serie = serieMensuelle(signaux);
  if (serie.length > 1) {
    L.push("## Volume par mois");
    L.push("");
    const max = Math.max(...serie.map(([, n]) => n));
    for (const [mois, n] of serie.slice(-24)) {
      L.push(`\`${mois}\` ${"█".repeat(Math.max(1, Math.round((n / max) * 40)))} ${n}`);
    }
    L.push("");
  }

  L.push("## Signaux par catégorie");
  L.push("");
  for (const cle of ORDRE) {
    const groupe = signaux.filter((s) => s.type === cle);
    if (!groupe.length) continue;
    L.push(`### ${LIBELLES[cle] || cle} — ${groupe.length}`);
    L.push("");
    for (const s of representatifs(groupe)) {
      const extrait = s.texte.replace(/\s+/g, " ").slice(0, 400);
      const marques = [...(s.produits || []), ...(s.themes || [])].join(", ");
      L.push(`- **${s.date || "?"}** · ${s.personne} · _${s.flux || s.source}_${marques ? ` · ${marques}` : ""}`);
      L.push(`  > ${extrait}${s.texte.length > 400 ? "…" : ""}`);
      L.push(`  <sub>\`${s.cle}\`</sub>`);
    }
    L.push("");
  }

  return L.join("\n");
}

// --- Mode avec modèle ------------------------------------------------------

async function claude(invite, maxTokens = 4000) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) return null;
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cle,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: invite }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic → ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.content || []).map((b) => b.text || "").join("");
}

function inviteSynthese(signaux) {
  const recents = signaux.filter((s) => jours(s.date) <= FENETRE);
  const matiere = ORDRE.flatMap((cle) => {
    const g = signaux.filter((s) => s.type === cle && cle !== "eloge");
    if (!g.length) return [];
    return [
      `## ${LIBELLES[cle] || cle} (${g.length} signaux)`,
      ...representatifs(g, 14).map((s) => `- [${s.date}] ${s.texte.replace(/\s+/g, " ").slice(0, 500)}`),
    ];
  }).join("\n");

  return [
    "Tu analyses les signaux clients d'une marque québécoise (Lasclay, produits isolés",
    "à la soie d'asclépiade, vente en ligne). Ce corpus vient de la boîte de service",
    "client : ce sont des clients réels qui écrivent d'eux-mêmes.",
    "",
    `Il y a ${signaux.length} signaux au total, dont ${recents.length} sur les ${FENETRE} derniers jours.`,
    "",
    "Écris une synthèse en français, en markdown, avec exactement ces sections :",
    "",
    "1. **Ce que le marché nous apprend et qu'on n'avait pas planifié** — usages,",
    "   publics, occasions d'achat qui ne figurent dans aucune fiche produit. Pour",
    "   chacun : combien de clients distincts l'évoquent, et sur quelle période.",
    "2. **Ce qui bloque un achat** — objections, en ordre de fréquence.",
    "3. **Ce qui revient sur les produits** — regroupe par produit, distingue le",
    "   défaut ponctuel du défaut systémique (plusieurs clients, même symptôme).",
    "4. **Ce qui a changé récemment** — ce qui monte ou disparaît dans la fenêtre",
    "   récente par rapport à avant.",
    "5. **Ce qu'il faudrait vérifier ailleurs** — questions que ce corpus soulève mais",
    "   ne tranche pas, et où aller chercher la réponse (Shopify, ShipStation, avis).",
    "",
    "RÈGLES. N'invente aucun chiffre : compte ce que tu vois, et écris « au moins N »",
    "quand tu n'es pas sûr. Cite le verbatim quand il porte l'argument. Ne recommande",
    "rien — décris. Un signal isolé se dit isolé; ne le gonfle pas en tendance.",
    "",
    "---",
    matiere,
  ].join("\n");
}

// --- Entrée ----------------------------------------------------------------

async function distille({ journal = console.log } = {}) {
  const signaux = ardoise.charger().filter((s) => s.statut !== "rejete");
  if (!signaux.length) {
    journal("Ardoise vide — rien à distiller. Lance d'abord `node veille/veille.js collecte`.");
    return null;
  }

  fs.mkdirSync(SORTIE, { recursive: true });

  const det = rapportDeterministe(signaux);
  const cheminDet = path.join(SORTIE, "decouvertes.md");
  fs.writeFileSync(cheminDet, det);
  journal(`Écrit : ${cheminDet} (${signaux.length} signaux)`);

  if (!process.env.ANTHROPIC_API_KEY) {
    journal("ANTHROPIC_API_KEY absente — synthèse non produite (agrégation seule).");
    return { deterministe: cheminDet, synthese: null };
  }

  journal(`Synthèse par ${MODEL}…`);
  const texte = await claude(inviteSynthese(signaux), 6000);
  const cheminSyn = path.join(SORTIE, "synthese.md");
  fs.writeFileSync(
    cheminSyn,
    `# Synthèse de veille\n\n> Produite par \`veille/distille.js\` (${MODEL}) le ${new Date().toISOString().slice(0, 10)},\n> à partir de ${signaux.length} signaux. Les comptes bruts sont dans \`decouvertes.md\`.\n> À vérifier contre eux avant de décider quoi que ce soit.\n\n${texte}\n`
  );
  journal(`Écrit : ${cheminSyn}`);
  return { deterministe: cheminDet, synthese: cheminSyn };
}

module.exports = { distille, rapportDeterministe, inviteSynthese };
