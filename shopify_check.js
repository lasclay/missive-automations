/**
 * shopify_check.js — vérifie que le jeton Admin Shopify fonctionne (scope read_orders).
 * Ne modifie RIEN (lecture seule). À lancer avant de déployer support.js avec Shopify.
 *
 *   SHOPIFY_STORE=lasclay.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   node shopify_check.js L-50468
 *
 * Sans numéro de commande, liste les 3 dernières commandes.
 * Node 18+ (fetch natif). Aucune dépendance.
 */
const STORE = process.env.SHOPIFY_STORE || "";
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";
const VER = process.env.SHOPIFY_API_VERSION || "2024-10";

if (!STORE || !TOKEN) {
  console.error("Manque SHOPIFY_STORE et/ou SHOPIFY_ADMIN_TOKEN dans l'environnement.");
  process.exit(1);
}

const headers = { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" };
const base = `https://${STORE}/admin/api/${VER}`;

function resume(o) {
  const track = (o.fulfillments || []).flatMap((f) => f.tracking_numbers || []).filter(Boolean);
  const statut = o.fulfillment_status === "fulfilled" ? "EXPÉDIÉE"
    : o.fulfillment_status === "partial" ? "PARTIELLEMENT EXPÉDIÉE"
    : "PAS ENCORE EXPÉDIÉE (en préparation)";
  return {
    commande: o.name,
    date: (o.created_at || "").slice(0, 10),
    paiement: o.financial_status,
    expedition: statut,
    suivi: track.length ? track.join(", ") : "(aucun)",
    articles: (o.line_items || []).map((li) => `${li.quantity}x ${li.title}${li.variant_title ? ` (${li.variant_title})` : ""}`),
  };
}

(async () => {
  const arg = process.argv[2];
  const fields = "name,created_at,financial_status,fulfillment_status,line_items,fulfillments";
  const url = arg
    ? `${base}/orders.json?status=any&name=${encodeURIComponent(arg)}&fields=${fields}`
    : `${base}/orders.json?status=any&limit=3&fields=${fields}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`Échec ${res.status}: ${await res.text()}`);
    if (res.status === 401 || res.status === 403) {
      console.error("→ Jeton invalide ou portée read_orders manquante. Vérifiez l'app custom.");
    }
    process.exit(1);
  }
  const { orders = [] } = await res.json();
  if (orders.length === 0) {
    console.log(arg ? `Aucune commande « ${arg} » trouvée (fenêtre read_orders = 60 jours par défaut).` : "Aucune commande.");
    return;
  }
  console.log(`OK — jeton valide. ${orders.length} commande(s) :`);
  for (const o of orders) console.log(JSON.stringify(resume(o), null, 2));
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
