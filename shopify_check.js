/**
 * shopify_check.js — vérifie l'accès Shopify en lecture (commandes) avant de déployer support.js.
 * Ne modifie RIEN. Supporte les deux modes d'auth :
 *   - App « Render connector » (Dev Dashboard) : SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET
 *   - Jeton Admin fixe : SHOPIFY_ADMIN_TOKEN
 *
 *   SHOPIFY_STORE=lasclay.myshopify.com \
 *   SHOPIFY_CLIENT_ID=xxx SHOPIFY_CLIENT_SECRET=yyy \
 *   node shopify_check.js L-50468
 *
 * Sans numéro de commande, liste les 3 dernières commandes.
 * Node 18+ (fetch natif). Aucune dépendance.
 */
const STORE = process.env.SHOPIFY_STORE || "";
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || "";
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || "";
const VER = process.env.SHOPIFY_API_VERSION || "2024-10";

if (!STORE || !(TOKEN || (CLIENT_ID && CLIENT_SECRET))) {
  console.error("Manque SHOPIFY_STORE et (SHOPIFY_ADMIN_TOKEN | SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET).");
  process.exit(1);
}

const SHIP_FR = {
  in_transit: "en transit", out_for_delivery: "en cours de livraison", delivered: "livré",
  attempted_delivery: "tentative de livraison", ready_for_pickup: "prêt à cueillir",
  confirmed: "pris en charge par le transporteur", label_printed: "étiquette créée",
  label_purchased: "étiquette créée", failure: "problème de livraison",
};

async function getToken() {
  if (TOKEN) return TOKEN;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!res.ok) throw new Error(`client_credentials → ${res.status} ${await res.text()}`);
  const j = await res.json();
  console.log(`Jeton obtenu par client credentials (expire dans ${j.expires_in || "?"}s, portées: ${j.scope || "?"}).`);
  return j.access_token;
}

function resume(o) {
  const fuls = o.fulfillments || [];
  const track = fuls.flatMap((f) => f.tracking_numbers || []).filter(Boolean);
  const ship = fuls.map((f) => f.shipment_status).filter(Boolean).pop();
  const statut = o.fulfillment_status === "fulfilled" ? "EXPÉDIÉE"
    : o.fulfillment_status === "partial" ? "PARTIELLEMENT EXPÉDIÉE"
    : "PAS ENCORE EXPÉDIÉE (en préparation)";
  const refunds = o.refunds || [];
  let montant = 0, items = 0;
  for (const r of refunds) {
    for (const t of (r.transactions || [])) if (t.kind === "refund" && (t.status === "success" || !t.status)) montant += parseFloat(t.amount || 0) || 0;
    for (const rli of (r.refund_line_items || [])) items += rli.quantity || 0;
  }
  return {
    commande: o.name,
    date: (o.created_at || "").slice(0, 10),
    paiement: o.financial_status,
    annulee: !!o.cancelled_at,
    expedition: statut,
    etat_colis: ship ? (SHIP_FR[ship] || ship) : "(aucun)",
    remboursement: montant ? `${montant.toFixed(2)} $ (${refunds.length}x, ${items} article(s) retourné(s))` : (refunds.length ? `${refunds.length} refund(s) sans montant` : "(aucun)"),
    suivi: track.length ? track.join(", ") : "(aucun)",
    lien_suivi: fuls.flatMap((f) => f.tracking_urls || []).filter(Boolean).join(" ") || "(aucun)",
    articles: (o.line_items || []).map((li) => `${li.quantity}x ${li.title}${li.variant_title ? ` (${li.variant_title})` : ""}`),
  };
}

(async () => {
  const arg = process.argv[2];
  const token = await getToken();
  const fields = "name,created_at,financial_status,fulfillment_status,line_items,fulfillments";
  const url = arg
    ? `https://${STORE}/admin/api/${VER}/orders.json?status=any&name=${encodeURIComponent(arg)}&fields=${fields}`
    : `https://${STORE}/admin/api/${VER}/orders.json?status=any&limit=3&fields=${fields}`;
  const res = await fetch(url, { headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" } });
  if (!res.ok) {
    console.error(`Échec ${res.status}: ${await res.text()}`);
    if (res.status === 401 || res.status === 403) console.error("→ Auth invalide ou portée read_orders manquante.");
    process.exit(1);
  }
  const { orders = [] } = await res.json();
  if (orders.length === 0) {
    console.log(arg ? `Aucune commande « ${arg} » trouvée (fenêtre read_orders = 60 jours par défaut).` : "Aucune commande.");
    return;
  }
  console.log(`OK — accès valide. ${orders.length} commande(s) :`);
  for (const o of orders) console.log(JSON.stringify(resume(o), null, 2));
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
