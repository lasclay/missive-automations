/**
 * Lasclay — dossier.js
 * ---------------------------------------------------------------------------
 * Monte le dossier COMPLET d'un fil support avant d'y répondre. Écrit après un
 * audit où 40 réponses sont parties sans qu'aucune n'ait satisfait les quatre
 * vérifications : trois clients ont reçu de l'information fausse, et une cliente
 * dont le dossier était réglé depuis trois semaines a reçu deux messages à côté.
 *
 * Les quatre sources, dans l'ordre où elles se contredisent le plus souvent :
 *
 *   1. LE FIL AU COMPLET      — pas les 10 derniers messages. `dossier.js` lit
 *                               jusqu'à 200 messages et signale s'il en reste.
 *   2. LES AUTRES FILS        — même client, ailleurs dans la boîte. Détection par
 *                               les 3 empreintes de merge.js : adresse, nom,
 *                               numéro de commande. Un client peut écrire de deux
 *                               adresses ; seul le numéro de commande les relie.
 *   3. SHOPIFY                — la commande : contenu réel, lignes retirées,
 *                               remboursements, adresse de livraison au dossier.
 *   4. SHIPSTATION            — l'expédition : `shipments` ET `fulfillments` (un
 *                               envoi sans étiquette ShipStation n'apparaît que
 *                               dans le second), plus les commandes MANUELLES au
 *                               nom du client (renvoi de garantie, échange).
 *
 * Shopify seul ne dit pas si le colis est parti. ShipStation seul ne dit pas
 * pourquoi une ligne est à quantité 0. Les deux sont requis.
 *
 * Usage :
 *   node dossier.js <convId> [<convId> ...]        dossier lisible
 *   node dossier.js --json <convId>                sortie machine
 *   node dossier.js --index <fichier.json>         (ré)génère l'index des autres fils
 *
 * Env : MISSIVE_PROXY_SECRET, GENERAL_PROXY_SECRET, et l'accès Shopify via le
 * connecteur MCP (ce script n'expose aucune clé).
 *
 * Node 18+. Aucune dépendance.
 */

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = __dirname;
const INDEX = process.env.DOSSIER_INDEX || path.join(REPO, ".dossier_index.json");
const ORDER_RE = /\bL-\d{4,6}\b/gi;
const SELF = ["hey@lasclay.com", "admin@lasclay.com", "operations@lasclay.com", "info@lasclay.com"];
const SYSTEM = /noreply|no-reply|shopify|etsy|dmarc|postmaster|mailer-daemon|amazonses|instagram|judge\.me|bounce|facebookmail/i;
const estClient = (a) => a && !SELF.includes(a.toLowerCase()) && !SYSTEM.test(a);
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: REPO, maxBuffer: 30 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return resolve(null);
      try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
    });
  });
}
const missive = (...a) => run("node", ["missive_client.js", ...a]);
const connect = (conn, action, params) =>
  run("node", ["connectors_client.js", conn, action, JSON.stringify(params || {})]);

// --- 1. Le fil au complet -----------------------------------------------------
async function lireFil(id) {
  const r = await missive("read", id, "200");
  const msgs = (r && r.messages) || [];
  return { messages: msgs, tronque: !!(r && r.tronque) };
}

// --- 2. Les autres fils du même client ---------------------------------------
function empreintes(messages, sujet) {
  const emails = new Set(), noms = new Set();
  for (const m of messages) {
    const a = (m.address || "").toLowerCase();
    if (!estClient(a)) continue;
    emails.add(a);
    if (!m.us && m.from && m.from !== "?") { const n = norm(m.from); if (n.length >= 5) noms.add(n); }
  }
  const blob = (sujet || "") + " " + messages.map((m) => m.text || "").join(" ");
  const commandes = new Set((blob.match(ORDER_RE) || []).map((s) => s.toUpperCase()));
  return { emails, noms, commandes };
}

function chargerIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX, "utf8")); } catch { return null; }
}

function autresFils(id, emp, index) {
  if (!index) return { indisponible: true, fils: [] };
  const inter = (a, b) => { for (const x of a) if (b.includes(x)) return x; return null; };
  const fils = [];
  for (const o of index.fils) {
    if (o.id === id) continue;
    const e = inter(emp.emails, o.emails || []);
    const c = inter(emp.commandes, o.commandes || []);
    const n = inter(emp.noms, o.noms || []);
    if (!e && !c && !n) continue;
    fils.push({ id: o.id, sujet: o.sujet, via: e ? `adresse ${e}` : c ? `commande ${c}` : `nom ${n}`,
      dernier: o.dernier, repondu: o.repondu, nMsg: o.nMsg });
  }
  fils.sort((a, b) => String(b.dernier).localeCompare(String(a.dernier)));
  return { indisponible: false, fils };
}

// --- 3. Shopify ---------------------------------------------------------------
// Le connecteur MCP Shopify n'est pas appelable depuis un script : on émet la
// requête à exécuter, pour que rien ne soit affirmé sans elle.
function requeteShopify(commandes, emails) {
  const parts = [...commandes].map((c) => `name:${c}`);
  for (const e of emails) parts.push(`email:${e}`);
  return parts.length ? parts.join(" OR ") : null;
}

// --- 4. ShipStation -----------------------------------------------------------
const SS_FR = { awaiting_shipment: "en attente d'expédition", shipped: "expédiée",
  on_hold: "en attente (hold)", cancelled: "annulée", awaiting_payment: "en attente de paiement" };

async function shipstation(commandes, noms) {
  const out = { commandes: [], manuelles: [], erreur: null };
  for (const num of commandes) {
    const [o, s, f] = await Promise.all([
      connect("shipstation", "orders", { orderNumber: num, pageSize: 50 }),
      connect("shipstation", "shipments", { orderNumber: num, pageSize: 50 }),
      connect("shipstation", "fulfillments", { orderNumber: num, pageSize: 50 }),
    ]);
    const ords = ((o && o.data && o.data.orders) || []).filter(
      (x) => (x.orderNumber || "").toUpperCase() === num.toUpperCase());
    const envois = ((s && s.data && s.data.shipments) || []).filter((x) => !x.voided);
    const horsEtiquette = (f && f.data && f.data.fulfillments) || [];
    out.commandes.push({
      numero: num,
      trouvee: ords.length > 0,
      entrees: ords.length,
      statut: ords.length ? (SS_FR[ords[ords.length - 1].orderStatus] || ords[ords.length - 1].orderStatus) : null,
      articles: ords.length ? (ords[ords.length - 1].items || []).map((i) => `${i.quantity}x ${i.name}`) : [],
      envois: envois.map((e) => ({ date: (e.shipDate || "").slice(0, 10), suivi: e.trackingNumber,
        transporteur: e.carrierCode, retour: !!e.isReturnLabel })),
      horsEtiquette: horsEtiquette.map((e) => ({ date: (e.shipDate || "").slice(0, 10),
        suivi: e.trackingNumber, transporteur: e.carrierCode })),
    });
  }
  // Commandes MANUELLES au nom du client : un renvoi de garantie ou un échange
  // n'a PAS le numéro L- d'origine. Les chercher par numéro seul les rend invisibles.
  for (const nom of noms) {
    const r = await connect("shipstation", "orders", { customerName: nom, pageSize: 50 });
    for (const o of (r && r.data && r.data.orders) || []) {
      if (commandes.has((o.orderNumber || "").toUpperCase())) continue;
      out.manuelles.push({ numero: o.orderNumber, date: (o.orderDate || "").slice(0, 10),
        statut: SS_FR[o.orderStatus] || o.orderStatus,
        articles: (o.items || []).map((i) => `${i.quantity}x ${i.name}`) });
    }
  }
  return out;
}

// --- Assemblage ---------------------------------------------------------------
async function dossier(id) {
  const { messages, tronque } = await lireFil(id);
  const sujet = (messages.find((m) => m.subject) || {}).subject || null;
  const emp = empreintes(messages, sujet);
  const index = chargerIndex();
  const autres = autresFils(id, emp, index);
  const ss = emp.commandes.size || emp.noms.size ? await shipstation(emp.commandes, emp.noms) : null;
  const dernier = messages[messages.length - 1];
  const dernierClient = [...messages].reverse().find((m) => !m.us);
  return {
    id, sujet, nMessages: messages.length, tronque,
    enAttenteDeNous: dernier ? !dernier.us : null,
    dernierClient: dernierClient ? { date: dernierClient.date, de: dernierClient.address } : null,
    empreintes: { adresses: [...emp.emails], noms: [...emp.noms], commandes: [...emp.commandes] },
    autresFils: autres,
    shipstation: ss,
    shopify: { requete: requeteShopify(emp.commandes, emp.emails), aExecuter: true },
    messages,
  };
}

function afficher(d) {
  const L = [];
  L.push("=".repeat(78));
  L.push(`FIL ${d.id}`);
  L.push(`Sujet : ${d.sujet || "(sans objet)"}`);
  L.push(`${d.nMessages} message(s)${d.tronque ? "  ⚠️ TRONQUÉ — il en reste avant" : ""}` +
    `   |   ${d.enAttenteDeNous ? "⏳ le client attend une réponse" : "✅ nous avons le dernier mot"}`);
  if (d.dernierClient) L.push(`Dernier mot du client : ${d.dernierClient.date} <${d.dernierClient.de || "canal non courriel"}>`);
  L.push("");
  L.push(`Empreintes — adresses: ${d.empreintes.adresses.join(", ") || "aucune"}`);
  L.push(`             commandes: ${d.empreintes.commandes.join(", ") || "aucune"}`);
  L.push(`             noms: ${d.empreintes.noms.join(", ") || "aucun"}`);
  L.push("");
  L.push("── AUTRES FILS DU MÊME CLIENT ──");
  if (d.autresFils.indisponible) L.push("  ⚠️ index absent — lancer `node dossier.js --index <liste.json>`");
  else if (!d.autresFils.fils.length) L.push("  aucun");
  else for (const f of d.autresFils.fils)
    L.push(`  ${f.dernier || "?"}  ${f.repondu ? "répondu" : "EN ATTENTE"}  [${f.via}]  ${f.id}  ${(f.sujet || "").slice(0, 40)}`);
  L.push("");
  L.push("── SHIPSTATION ──");
  if (!d.shipstation) L.push("  aucun numéro de commande ni nom exploitable");
  else {
    for (const c of d.shipstation.commandes) {
      if (!c.trouvee) { L.push(`  ${c.numero} : INTROUVABLE dans ShipStation`); continue; }
      L.push(`  ${c.numero} : ${c.statut}${c.entrees > 1 ? `  (${c.entrees} entrées — envoi en plusieurs colis)` : ""}`);
      for (const a of c.articles) L.push(`      · ${a}`);
      if (c.envois.length) for (const e of c.envois)
        L.push(`      ENVOI ${e.date} ${e.transporteur || ""} suivi ${e.suivi || "aucun"}${e.retour ? "  ← ÉTIQUETTE DE RETOUR" : ""}`);
      else L.push("      aucun envoi");
      for (const e of c.horsEtiquette)
        L.push(`      HORS ÉTIQUETTE ${e.date} suivi ${e.suivi || "aucun"}  ← invisible dans shipments`);
    }
    if (d.shipstation.manuelles.length) {
      L.push("  COMMANDES MANUELLES au nom du client (renvoi, échange, garantie) :");
      for (const m of d.shipstation.manuelles)
        L.push(`      ${m.numero}  ${m.date}  ${m.statut}  ${m.articles.join(" | ").slice(0, 70)}`);
    }
  }
  L.push("");
  L.push("── SHOPIFY (à exécuter avant de répondre) ──");
  L.push(d.shopify.requete ? `  orders(query: "${d.shopify.requete}")` : "  aucun identifiant exploitable");
  L.push("");
  return L.join("\n");
}

(async () => {
  const args = process.argv.slice(2);
  if (!args.length) { console.error("Usage: node dossier.js <convId> [...]  |  --json <convId>  |  --index <liste.json>"); process.exit(1); }

  if (args[0] === "--index") {
    const liste = JSON.parse(fs.readFileSync(args[1], "utf8"));
    const ids = (liste.conversations || liste).map((c) => (typeof c === "string" ? c : c.id));
    const fils = [];
    let i = 0;
    await Promise.all(Array.from({ length: 5 }, async () => {
      while (i < ids.length) {
        const id = ids[i++];
        const { messages } = await lireFil(id);
        const sujet = (messages.find((m) => m.subject) || {}).subject || null;
        const e = empreintes(messages, sujet);
        const last = messages[messages.length - 1];
        fils.push({ id, sujet, emails: [...e.emails], noms: [...e.noms], commandes: [...e.commandes],
          dernier: last ? last.date : null, repondu: last ? !!last.us : null, nMsg: messages.length });
        if (fils.length % 25 === 0) process.stderr.write(`${fils.length}/${ids.length}\n`);
      }
    }));
    fs.writeFileSync(INDEX, JSON.stringify({ genere: fils.length, fils }, null, 1));
    console.log(`index écrit : ${fils.length} fils → ${INDEX}`);
    return;
  }

  const json = args[0] === "--json";
  const ids = json ? args.slice(1) : args;
  const out = [];
  for (const id of ids) out.push(await dossier(id));
  console.log(json ? JSON.stringify(out, null, 1) : out.map(afficher).join("\n"));
})();
