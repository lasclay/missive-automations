/**
 * shipstation_check.js — vérifie l'accès ShipStation en lecture avant de déployer
 * le connectors-proxy. Ne modifie RIEN. API v1 « legacy » (ssapi.shipstation.com),
 * auth Basic clé:secret.
 *
 *   SHIPSTATION_API_KEY=xxx SHIPSTATION_API_SECRET=yyy \
 *   node shipstation_check.js [numeroCommande]
 *
 * Sans argument : liste les transporteurs (test d'auth minimal) + 3 dernières
 * commandes. Avec un numéro de commande : affiche son statut + suivi.
 * Node 18+ (fetch natif). Aucune dépendance.
 */
const KEY = process.env.SHIPSTATION_API_KEY || "";
const SECRET = process.env.SHIPSTATION_API_SECRET || "";
const BASE = process.env.SHIPSTATION_BASE || "https://ssapi.shipstation.com";

if (!KEY || !SECRET) {
  console.error("Manque SHIPSTATION_API_KEY et SHIPSTATION_API_SECRET.");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, tries = 0) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: auth, Accept: "application/json" } });
  if (res.status === 429 && tries < 3) {
    const reset = Number(res.headers.get("x-rate-limit-reset")) || 10;
    console.log(`  (limite de débit, pause ${reset + 1}s...)`);
    await sleep((reset + 1) * 1000);
    return get(path, tries + 1);
  }
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 401) console.error("→ Auth invalide (clé/secret). Vérifie Account → API Settings dans ShipStation.");
    throw new Error(`GET ${path} → ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

function resumeOrder(o) {
  return {
    orderNumber: o.orderNumber,
    orderId: o.orderId,
    orderStatus: o.orderStatus,
    orderDate: (o.orderDate || "").slice(0, 10),
    customer: o.customerUsername || o.customerEmail || (o.shipTo && o.shipTo.name) || null,
    total: o.orderTotal,
    trackingNumbers: undefined, // rempli via /shipments si demandé
    items: (o.items || []).map((i) => `${i.quantity}x ${i.name}`),
  };
}

(async () => {
  const arg = process.argv[2];
  // 1. Test d'auth minimal : /carriers.
  const carriers = await get("/carriers");
  console.log(`OK — auth valide. ${Array.isArray(carriers) ? carriers.length : "?"} transporteur(s) configuré(s) :`,
    (Array.isArray(carriers) ? carriers.map((c) => c.code) : []).join(", ") || "(aucun)");

  if (arg) {
    const { orders = [] } = await get(`/orders?orderNumber=${encodeURIComponent(arg)}`);
    if (!orders.length) { console.log(`Aucune commande « ${arg} ».`); return; }
    for (const o of orders) console.log(JSON.stringify(resumeOrder(o), null, 2));
    const { shipments = [] } = await get(`/shipments?orderNumber=${encodeURIComponent(arg)}`);
    console.log(`Expéditions (${shipments.length}) :`, JSON.stringify(shipments.map((s) => ({
      trackingNumber: s.trackingNumber, carrier: s.carrierCode, shipDate: (s.shipDate || "").slice(0, 10), voided: s.voided,
    })), null, 2));
  } else {
    const { orders = [] } = await get(`/orders?pageSize=3&sortBy=OrderDate&sortDir=DESC`);
    console.log(`${orders.length} dernière(s) commande(s) :`);
    for (const o of orders) console.log(JSON.stringify(resumeOrder(o), null, 2));
  }
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
