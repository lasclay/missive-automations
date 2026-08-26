/**
 * tokens.js — comptabilité des tokens Anthropic et politique de TTL du cache.
 *
 * Deux fonctions, aucune dépendance, aucune exception qui remonte : ce module ne
 * doit JAMAIS faire échouer un run de production. Tout est enveloppé.
 *
 *   noter(script, model, usage)   à appeler après chaque réponse de l'API, avec
 *                                 `data.usage`. Écrit une ligne JSONL et cumule
 *                                 le total du run.
 *   avecTtl(blocs)                applique la politique de TTL aux blocs `system`
 *                                 qui portent déjà un `cache_control`.
 *
 * Un sommaire du run s'imprime tout seul à la sortie du processus (hook `exit`),
 * donc aucun script n'a besoin de l'appeler.
 *
 * Environnement :
 *   CACHE_TTL    "5m" (défaut, comportement actuel) ou "1h".
 *                "1h" fait passer l'écriture du cache de 1,25x à 2x le prix
 *                d'entrée, mais la lecture reste à 0,1x pendant une heure. Gagnant
 *                dès que deux runs se suivent à moins d'une heure ; perdant si les
 *                runs sont espacés de plus d'une heure (on paie 2x une écriture
 *                qui aurait expiré de toute façon). À activer une fois la cadence
 *                réelle des crons connue — voir le sommaire `écritures/lectures`.
 *   TOKENS_LOG   chemin du journal JSONL. Défaut "./logs/tokens.jsonl".
 *                Mettre "off" pour ne rien écrire sur disque (le sommaire reste).
 *
 * Le journal est en JSONL (une ligne = un appel) pour rester ajoutable sans lire
 * le fichier, et analysable avec un simple `jq`. Exemples :
 *   jq -s 'group_by(.script)[] | {script: .[0].script, usd: (map(.usd) | add)}' logs/tokens.jsonl
 *   jq -s 'map(select(.cacheRead == 0)) | length' logs/tokens.jsonl   # appels sans cache
 */

const fs = require("node:fs");
const path = require("node:path");

// Prix par million de tokens (API Anthropic première partie).
// Une entrée manquante ne casse rien : les tokens sont journalisés, le coût reste null.
const PRIX = {
  "claude-opus-5": { in: 5, out: 25 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

// Multiplicateurs de cache, identiques chez tous les modèles.
const MULT_ECRITURE_5M = 1.25;
const MULT_ECRITURE_1H = 2;
const MULT_LECTURE = 0.1;

const TTL = process.env.CACHE_TTL === "1h" ? "1h" : "5m";
const JOURNAL = process.env.TOKENS_LOG || "./logs/tokens.jsonl";

const total = { appels: 0, in: 0, out: 0, cacheRead: 0, cacheCreate: 0, usd: 0, parModele: {} };
let journalHs = false; // une seule plainte si le disque refuse

/**
 * Coût estimé d'un appel, en dollars US. Renvoie null si le modèle est inconnu,
 * pour ne jamais afficher un chiffre inventé.
 */
function cout(model, u) {
  const p = PRIX[model];
  if (!p) return null;
  const multEcriture = TTL === "1h" ? MULT_ECRITURE_1H : MULT_ECRITURE_5M;
  const entree =
    (u.input_tokens || 0) +
    (u.cache_creation_input_tokens || 0) * multEcriture +
    (u.cache_read_input_tokens || 0) * MULT_LECTURE;
  return (entree * p.in + (u.output_tokens || 0) * p.out) / 1e6;
}

/**
 * Enregistre l'usage d'UN appel. `usage` est le champ `usage` de la réponse
 * Anthropic ; les champs absents comptent pour zéro.
 *
 * N'échoue jamais : une erreur de journalisation ne doit pas faire tomber un run.
 */
function noter(script, model, usage) {
  try {
    const u = usage || {};
    const ligne = {
      t: new Date().toISOString(),
      script,
      model,
      in: u.input_tokens || 0,
      out: u.output_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
      cacheCreate: u.cache_creation_input_tokens || 0,
      ttl: TTL,
      usd: cout(model, u),
    };

    total.appels++;
    total.in += ligne.in;
    total.out += ligne.out;
    total.cacheRead += ligne.cacheRead;
    total.cacheCreate += ligne.cacheCreate;
    total.usd += ligne.usd || 0;
    const m = (total.parModele[model] = total.parModele[model] || { appels: 0, usd: 0 });
    m.appels++;
    m.usd += ligne.usd || 0;

    if (JOURNAL === "off" || journalHs) return;
    fs.mkdirSync(path.dirname(JOURNAL), { recursive: true });
    fs.appendFileSync(JOURNAL, JSON.stringify(ligne) + "\n");
  } catch (e) {
    journalHs = true;
    console.warn(`tokens.js: journalisation désactivée (${e.message}).`);
  }
}

/**
 * Applique la politique de TTL aux blocs `system` qui portent DÉJÀ un
 * `cache_control`. N'ajoute jamais de point de cache là où il n'y en avait pas :
 * la politique de mise en cache reste décidée par l'appelant, on ne règle que
 * la durée.
 *
 * En CACHE_TTL=5m (défaut) les blocs ressortent inchangés — donc activer ce
 * module ne change rien tant qu'on n'a pas explicitement demandé le 1h.
 */
function avecTtl(blocs) {
  if (TTL !== "1h" || !Array.isArray(blocs)) return blocs;
  return blocs.map((b) =>
    b && b.cache_control && b.cache_control.type === "ephemeral"
      ? { ...b, cache_control: { ...b.cache_control, ttl: "1h" } }
      : b
  );
}

/**
 * Sommaire du run, imprimé automatiquement à la sortie du processus.
 * Les lectures de cache face aux écritures disent tout de suite si le cache
 * travaille : beaucoup d'écritures et peu de lectures = préfixe instable.
 */
function sommaire() {
  if (!total.appels) return;
  const k = (n) => (n / 1000).toFixed(1) + "k";
  const parModele = Object.entries(total.parModele)
    .map(([m, v]) => `${m} ×${v.appels} (${v.usd.toFixed(2)} $)`)
    .join(", ");
  console.log(
    `\n💠 Tokens du run — ${total.appels} appel(s), ` +
      `entrée ${k(total.in)}, sortie ${k(total.out)}, ` +
      `cache: ${k(total.cacheRead)} lus / ${k(total.cacheCreate)} écrits (TTL ${TTL}) ` +
      `→ ~${total.usd.toFixed(2)} $ US.`
  );
  if (parModele) console.log(`   Par modèle: ${parModele}.`);
  if (total.cacheCreate > total.cacheRead && total.appels > 2) {
    console.log(
      `   ⚠️  Plus de tokens écrits en cache que lus: le préfixe change entre les appels.`
    );
  }
}

process.on("exit", () => {
  try {
    sommaire();
  } catch {
    /* la sortie du processus ne doit rien casser */
  }
});

module.exports = { noter, avecTtl, sommaire, TTL };
