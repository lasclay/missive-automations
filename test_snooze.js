/**
 * test_snooze.js — Vérifie si l'API Missive accepte de snoozer un fil.
 * --------------------------------------------------------------------
 * NON documenté: on teste sur UN fil bidon. En simulation par défaut.
 * Affiche la réponse brute de Missive, puis regarde (best effort) si le fil
 * apparaît dans la boîte « Snoozed ».
 *
 * Variables :
 *   MISSIVE_TOKEN    requis
 *   CONV_ID          requis: l'id d'un fil JETABLE pour le test (pas un vrai client)
 *   FIELD            champ à tester (défaut "snoozed_until"). Variantes à essayer si
 *                    échec: "snooze_until", "snoozed", "snooze".
 *   SNOOZE_MINUTES   réveil dans N minutes (défaut 5, pour vérifier vite)
 *   DRY_RUN          "true" (défaut) = montre le payload sans poster
 *   MISSIVE_ORG      défaut Lasclay
 */

const TOKEN = process.env.MISSIVE_TOKEN;
const CONV_ID = process.env.CONV_ID;
const FIELD = process.env.FIELD || "snoozed_until";
const SNOOZE_MINUTES = parseInt(process.env.SNOOZE_MINUTES || "5", 10);
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }
if (!CONV_ID) { console.error("Manque CONV_ID (l'id d'un fil JETABLE pour le test)."); process.exit(1); }

async function main() {
  const wake = Math.floor(Date.now() / 1000) + SNOOZE_MINUTES * 60; // Unix secondes
  const wakeLisible = new Date(wake * 1000).toLocaleString("fr-CA");

  const post = {
    conversation: CONV_ID,
    organization: ORG,
    [FIELD]: wake, // le champ testé, valeur = timestamp Unix de réveil
    notification: { title: "Test snooze API", body: `Réveil visé: ${wakeLisible}` },
    markdown: `_Test API: tentative de snooze via « ${FIELD} » jusqu'au ${wakeLisible}._`,
  };

  console.log(`=== test_snooze.js ===`);
  console.log(`Fil: ${CONV_ID}`);
  console.log(`Champ testé: ${FIELD} = ${wake} (${wakeLisible}, dans ${SNOOZE_MINUTES} min)`);
  console.log(DRY_RUN ? "MODE SIMULATION (rien posté)\n" : "MODE RÉEL\n");
  console.log("Payload:\n" + JSON.stringify({ posts: post }, null, 2) + "\n");

  if (DRY_RUN) {
    console.log("Simulation: relance avec DRY_RUN=false pour vraiment tester.");
    return;
  }

  await sleep(260);
  const res = await fetch(`${API}/posts`, { method: "POST", headers, body: JSON.stringify({ posts: post }) });
  const texte = await res.text();
  console.log(`Réponse Missive: ${res.status} ${res.statusText}`);
  console.log(texte + "\n");

  if (!res.ok) {
    console.log("→ ÉCHEC. Si l'erreur parle d'un paramètre inconnu, réessaie avec FIELD=snooze_until, puis FIELD=snoozed.");
    return;
  }

  console.log("→ Le POST a été ACCEPTÉ (200). Mais accepté ne veut pas dire pris en compte:");
  console.log("  Missive peut avoir ignoré le champ. Vérifie DEUX choses:");
  console.log(`  1) Dans Missive, le fil ${CONV_ID} est-il maintenant dans la boîte « Snoozed »?`);
  console.log(`  2) Revient-il dans l'inbox vers ${wakeLisible}?`);

  // Vérif automatique best effort: le fil apparaît-il dans la boîte Snoozed?
  try {
    await sleep(1500);
    const r = await fetch(`${API}/conversations?snoozed=true&limit=50`, { headers });
    if (r.ok) {
      const { conversations = [] } = await r.json();
      const trouve = conversations.some((c) => c.id === CONV_ID);
      console.log(`\nVérif auto (boîte Snoozed): fil ${trouve ? "TROUVÉ ✓ le snooze a fonctionné" : "PAS trouvé (snooze par utilisateur, ou champ ignoré, ou filtre non applicable)"}.`);
    } else {
      console.log(`\nVérif auto impossible (GET snoozed → ${r.status}); vérifie à la main dans Missive.`);
    }
  } catch (e) {
    console.log(`\nVérif auto impossible (${e.message}); vérifie à la main dans Missive.`);
  }
}

main().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
