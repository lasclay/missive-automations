/**
 * Export exhaustif Klaviyo → CSV réimportables (sauvegarde / migration).
 * Passe par le General Proxy (connecteur « klaviyo », lecture seule) : la clé
 * API vit côté Render, jamais ici. Prérequis : KLAVIYO_API_KEY définie sur le
 * service Render du general-proxy, branche déployée.
 *
 * Env : GENERAL_PROXY_URL (défaut Render), GENERAL_PROXY_SECRET (requis).
 *
 * Usage :
 *   node klaviyo_export.js profiles <dossier-sortie>            # TOUS les profils + consentements
 *   node klaviyo_export.js predictive <dossier-sortie>          # TOUS les profils + analytique (CLV, commandes, churn)
 *   node klaviyo_export.js list <LIST_ID> <dossier-sortie>      # membres d'une liste
 *   node klaviyo_export.js segment <SEGMENT_ID> <dossier-sortie># membres d'un segment
 *   node klaviyo_export.js suppressed <dossier-sortie>          # profils supprimés (suppression list)
 *   node klaviyo_export.js events <METRIC_ID> <dossier> [depuisISO]  # événements d'une métrique (ex. clics)
 *
 * Sortie : CSV avec email, phone, prénom/nom, langue, pays/région/ville,
 * consentements email + SMS (statut, méthode, horodatage — preuve LCAP),
 * suppressions, created, updated, propriétés custom (JSON). Reprise possible :
 * si le fichier .cursor existe dans le dossier, l'export reprend où il était.
 */

const fs = require("node:fs");
const path = require("node:path");

const URL = process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com";
const SECRET = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET;
if (!SECRET) { console.error("GENERAL_PROXY_SECRET requis."); process.exit(1); }

async function call(action, params) {
  const res = await fetch(`${URL}/klaviyo/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET },
    body: JSON.stringify(params || {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${action} → ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text).data;
}

const csv = (v) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const ENTETE = [
  "id", "email", "phone_number", "first_name", "last_name", "locale",
  "country", "region", "city", "zip",
  "email_consent", "email_consent_method", "email_consent_timestamp", "email_suppressed",
  "sms_consent", "sms_consent_timestamp",
  "created", "updated", "last_event_date", "properties_json",
].join(",");

function ligne(p) {
  const a = p.attributes || {};
  const loc = a.location || {};
  const em = a.subscriptions?.email?.marketing || {};
  const sm = a.subscriptions?.sms?.marketing || {};
  const suppr = (em.suppression || []).map((s) => s.reason).join("|");
  return [
    p.id, a.email, a.phone_number, a.first_name, a.last_name, a.locale,
    loc.country, loc.region, loc.city, loc.zip,
    em.consent, em.method, em.consent_timestamp, suppr,
    sm.consent, sm.consent_timestamp,
    a.created, a.updated, a.last_event_date, a.properties,
  ].map(csv).join(",");
}

// Extrait le curseur de pagination de links.next (page[cursor]=...).
function curseurSuivant(liens) {
  if (!liens || !liens.next) return null;
  const m = /page%5Bcursor%5D=([^&]+)/.exec(liens.next) || /page\[cursor\]=([^&]+)/.exec(liens.next);
  return m ? decodeURIComponent(m[1]) : null;
}

// --- Export analytique prédictive (jointure par id/email avec l'export profils) ---
const ENTETE_PRED = [
  "id", "email", "historic_clv", "predicted_clv", "total_clv",
  "historic_number_of_orders", "predicted_number_of_orders", "average_order_value",
  "average_days_between_orders", "expected_date_of_next_order", "churn_probability",
  "last_event_date",
].join(",");

function lignePred(p) {
  const a = p.attributes || {};
  const pa = a.predictive_analytics || {};
  return [
    p.id, a.email, pa.historic_clv, pa.predicted_clv, pa.total_clv,
    pa.historic_number_of_orders, pa.predicted_number_of_orders, pa.average_order_value,
    pa.average_days_between_orders, pa.expected_date_of_next_order, pa.churn_probability,
    a.last_event_date,
  ].map(csv).join(",");
}

// --- Export d'événements d'une métrique (clics, ouvertures...) ---
const ENTETE_EVT = ["event_id", "datetime", "profile_id", "metric_id", "properties_json"].join(",");
function ligneEvt(e) {
  const a = e.attributes || {};
  return [
    e.id, a.datetime, e.relationships?.profile?.data?.id,
    e.relationships?.metric?.data?.id, a.event_properties,
  ].map(csv).join(",");
}

async function exporter({ action, params, dossier, nomFichier, entete = ENTETE, versLigne = ligne, pageSize = 100, extraQ }) {
  fs.mkdirSync(dossier, { recursive: true });
  const fichier = path.join(dossier, nomFichier);
  const fichierCurseur = fichier + ".cursor";
  let curseur = fs.existsSync(fichierCurseur) ? fs.readFileSync(fichierCurseur, "utf8").trim() : null;
  if (!curseur || !fs.existsSync(fichier)) fs.writeFileSync(fichier, entete + "\n");
  let total = 0, page = 0;
  for (;;) {
    const q = { ...params, "page[size]": pageSize, ...(extraQ || { "additional-fields[profile]": "subscriptions" }) };
    if (curseur) q["page[cursor]"] = curseur;
    // L'enveloppe du proxy renvoie { ok, data: <réponse Klaviyo brute> }.
    const rep = await call(action, q);
    const profils = rep.data || [];
    fs.appendFileSync(fichier, profils.map(versLigne).join("\n") + (profils.length ? "\n" : ""));
    total += profils.length; page += 1;
    curseur = curseurSuivant(rep.links);
    if (curseur) fs.writeFileSync(fichierCurseur, curseur);
    process.stdout.write(`\rpage ${page} — ${total} profils`);
    if (!curseur) break;
  }
  if (fs.existsSync(fichierCurseur)) fs.unlinkSync(fichierCurseur);
  console.log(`\nTerminé : ${total} profils → ${fichier}`);
}

(async () => {
  const [mode, a2, a3] = process.argv.slice(2);
  try {
    if (mode === "profiles") {
      await exporter({ action: "profiles", params: {}, dossier: a2 || ".", nomFichier: "klaviyo_profiles_all.csv" });
    } else if (mode === "predictive") {
      // Analytique prédictive : page[size] limité par Klaviyo quand ce champ est demandé.
      await exporter({
        action: "profiles", params: {}, dossier: a2 || ".", nomFichier: "klaviyo_profiles_predictive.csv",
        entete: ENTETE_PRED, versLigne: lignePred, pageSize: 50,
        extraQ: { "additional-fields[profile]": "predictive_analytics" },
      });
    } else if (mode === "events" && a2) {
      const depuis = process.argv[5] || "2024-07-01T00:00:00Z";
      await exporter({
        action: "events",
        params: { filter: `and(equals(metric_id,"${a2}"),greater-or-equal(datetime,${depuis}))`, sort: "datetime" },
        dossier: a3 || ".", nomFichier: `klaviyo_events_${a2}.csv`,
        entete: ENTETE_EVT, versLigne: ligneEvt, pageSize: 200, extraQ: {},
      });
    } else if (mode === "suppressed") {
      // Profils avec suppression email (unsub globaux, bounces, plaintes) : filtre serveur.
      await exporter({
        action: "profiles",
        params: { filter: 'equals(subscriptions.email.marketing.suppression.reason,"USER_SUPPRESSED")' },
        dossier: a2 || ".", nomFichier: "klaviyo_suppressed_user.csv",
      });
    } else if (mode === "list" && a2) {
      await exporter({ action: "listprofiles", params: { id: a2 }, dossier: a3 || ".", nomFichier: `klaviyo_list_${a2}.csv` });
    } else if (mode === "segment" && a2) {
      await exporter({ action: "segmentprofiles", params: { id: a2 }, dossier: a3 || ".", nomFichier: `klaviyo_segment_${a2}.csv` });
    } else {
      console.error("Usage : node klaviyo_export.js profiles|suppressed <dossier> | list|segment <ID> <dossier>");
      process.exit(1);
    }
  } catch (e) { console.error("\nErreur:", e.message); process.exit(1); }
})();
