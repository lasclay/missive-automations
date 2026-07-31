/**
 * shipstation-clone/app — le serveur.
 *
 * Expose toute la surface fonctionnelle du clone : commandes, expéditions, lots, manifestes,
 * retours, produits, inventaire, clients, automatisation, gabarits, analytique, utilisateurs,
 * webhooks, réglages, migration.
 *
 * Aucune dépendance npm : http natif, SQLite natif, une page unique.
 *
 * Variables :
 *   PORT                  défaut 3100
 *   CLONE_APP_SECRET      mot de passe de l'interface (en-tête X-App-Secret)
 *   CLONE_DB              fichier SQLite
 *   CARRIER_ADAPTER       bouchon (défaut) | clickship
 *   CLONE_ALLOW_LABELS    "1" pour autoriser l'ACHAT d'étiquettes (argent réel)
 *   GENERAL_PROXY_SECRET  requis seulement pour la migration depuis ShipStation
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const db = require("../lib/db");
const orders = require("../lib/orders");
const shipments = require("../lib/shipments");
const catalog = require("../lib/catalog");
const rules = require("../lib/rules");
const templates = require("../lib/templates");
const analytics = require("../lib/analytics");
const accounts = require("../lib/accounts");
const ingest = require("../lib/ingest");
const { adaptateur, SEUIL_DROPOFF_G } = require("../lib/carrier");

const PORT = process.env.PORT || 3100;
const SECRET = process.env.CLONE_APP_SECRET || "";
const ETIQUETTES = process.env.CLONE_ALLOW_LABELS === "1";
const PUBLIC = path.join(__dirname, "public");

// ---------------------------------------------------------------- utilitaires

const json = (res, code, body) => {
  const b = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(b) });
  res.end(b);
};
const texte = (res, code, s, type = "text/plain; charset=utf-8") => {
  res.writeHead(code, { "Content-Type": type });
  res.end(s);
};
const corps = (req) => new Promise((ok, ko) => {
  let d = ""; req.on("data", (c) => { d += c; if (d.length > 8e6) req.destroy(); });
  req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ko(new Error("JSON invalide")); } });
  req.on("error", ko);
});
const q = (url) => Object.fromEntries(url.searchParams);

/** Utilisateur courant — en-tête simple, suffisant pour un outil interne derrière un secret. */
const utilisateurCourant = (req) => req.headers["x-user-id"] || null;

// ------------------------------------------------------------------- routage

/** Table de routage : "MÉTHODE /chemin" → handler(ctx). Les segments :id sont extraits. */
const ROUTES = {};
const route = (spec, fn) => { ROUTES[spec] = fn; };

function trouver(methode, chemin) {
  const direct = ROUTES[`${methode} ${chemin}`];
  if (direct) return { fn: direct, params: {} };
  const segs = chemin.split("/").filter(Boolean);
  for (const [spec, fn] of Object.entries(ROUTES)) {
    const [m, p] = spec.split(" ");
    if (m !== methode) continue;
    const ps = p.split("/").filter(Boolean);
    if (ps.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].startsWith(":")) params[ps[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (ps[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { fn, params };
  }
  return null;
}

// =================================================================== COMMANDES

route("GET /api/orders", ({ url }) => {
  const f = q(url);
  if (f.status && f.status.includes(",")) f.status = f.status.split(",");
  return { ...orders.chercher({ ...f, seuil: SEUIL_DROPOFF_G }), seuil: SEUIL_DROPOFF_G };
});
route("GET /api/orders/counts", () => orders.compteurs());
route("GET /api/orders/alerts", () => orders.alertes());
route("GET /api/orders/:id", ({ params }) => orders.parId(Number(params.id)) || { error: "inconnue" });

route("POST /api/orders", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return { id: orders.upsert(b) };
});
route("POST /api/orders/:id/status", async ({ req, params, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  orders.changerStatut(Number(params.id), b.status, user);
  return { ok: true };
});
route("POST /api/orders/hold", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  for (const id of b.ids || []) orders.hold(Number(id), b.hold_until, user);
  return { ok: true, n: (b.ids || []).length };
});
route("POST /api/orders/restore", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  for (const id of b.ids || []) orders.restaurer(Number(id), user);
  return { ok: true, n: (b.ids || []).length };
});
route("POST /api/orders/cancel", async ({ req, user }) => {
  accounts.exiger(user, "orders_delete");
  const b = await corps(req);
  const erreurs = [];
  for (const id of b.ids || []) { try { orders.supprimer(Number(id), user); } catch (e) { erreurs.push({ id, e: e.message }); } }
  return { ok: true, erreurs };
});
route("POST /api/orders/assign", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  for (const id of b.ids || []) orders.assigner(Number(id), b.user_id || null);
  return { ok: true };
});
route("POST /api/orders/tag", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  for (const id of b.ids || []) b.remove ? orders.retirerTag(Number(id), b.tag_id) : orders.ajouterTag(Number(id), b.tag_id);
  return { ok: true };
});
route("POST /api/orders/:id/split", async ({ req, params, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return { enfant: orders.scinder(Number(params.id), (b.item_ids || []).map(Number), user) };
});
route("POST /api/orders/merge", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return { cible: orders.fusionner(Number(b.target), (b.ids || []).map(Number), user) };
});
route("POST /api/orders/release-holds", ({ user }) => {
  accounts.exiger(user, "orders_edit");
  return { liberees: orders.libererHolds() };
});

// ================================================================ EXPÉDITIONS

route("GET /api/shipments", ({ url }) => shipments.chercher(q(url)));
route("POST /api/shipments/quote", async ({ req }) => {
  const b = await corps(req);
  return await shipments.coter(Number(b.order_id));
});

route("POST /api/shipments/buy", async ({ req, user }) => {
  accounts.exiger(user, "labels_buy");
  if (!ETIQUETTES) return { error: "achat d'étiquettes désactivé — lancer avec CLONE_ALLOW_LABELS=1", code: 403 };
  const b = await corps(req);
  return await shipments.acheterEtiquette(Number(b.order_id), { serviceId: b.service_id, userId: user });
});
route("POST /api/shipments/return", async ({ req, user }) => {
  accounts.exiger(user, "labels_buy");
  if (!ETIQUETTES) return { error: "achat d'étiquettes désactivé — lancer avec CLONE_ALLOW_LABELS=1", code: 403 };
  const b = await corps(req);
  return await shipments.acheterRetour(Number(b.order_id), { serviceId: b.service_id, userId: user });
});
route("POST /api/shipments/void", async ({ req, user }) => {
  accounts.exiger(user, "labels_void");
  const b = await corps(req);
  return await shipments.annuler(Number(b.shipment_id), user);
});
route("POST /api/shipments/mark-shipped", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  const r = [];
  for (const id of b.ids || []) r.push(shipments.marquerExpedie(Number(id), { ...b, userId: user }));
  return { ok: true, n: r.length };
});
route("GET /api/shipments/:id/tracking", async ({ params }) => await shipments.rafraichirSuivi(Number(params.id)));

// ------------------------------------------------------------------- lots

route("GET /api/batches", () => ({ batches: shipments.lots() }));
route("GET /api/batches/:id", ({ params }) => shipments.lot(Number(params.id)));
route("POST /api/batches", async ({ req, user }) => {
  accounts.exiger(user, "labels_buy");
  if (!ETIQUETTES) return { error: "achat d'étiquettes désactivé — lancer avec CLONE_ALLOW_LABELS=1", code: 403 };
  const b = await corps(req);
  const ids = (b.ids || []).map(Number);
  const { batchId } = shipments.creerLot(ids, { name: b.name, userId: user });
  return await shipments.traiterLot(batchId, ids, { userId: user, serviceId: b.service_id });
});

/** Simulation de lot : ce que coûterait le lot, sans rien acheter. Toujours disponible. */
route("POST /api/batches/preview", async ({ req }) => {
  const b = await corps(req);
  const lignes = [];
  for (const id of (b.ids || []).map(Number)) {
    try {
      const { recommande } = await shipments.coter(id);
      const c = orders.parId(id);
      lignes.push({ order_id: id, order_number: c.order_number, poids: c.weight_g,
        service: recommande.service, serviceId: recommande.serviceId, prix: recommande.price, dropOff: !!recommande.dropOff });
    } catch (e) {
      lignes.push({ order_id: id, order_number: (orders.parId(id) || {}).order_number, erreur: String(e.message) });
    }
  }
  const ok = lignes.filter((l) => !l.erreur);
  return { lignes, total: Math.round(ok.reduce((s, l) => s + l.prix, 0) * 100) / 100,
    n: ok.length, bloquees: lignes.length - ok.length, drop_off: ok.filter((l) => l.dropOff).length };
});

route("GET /api/manifests", () => ({ manifests: shipments.manifestes() }));
route("POST /api/manifests", async ({ req, user }) => {
  const b = await corps(req);
  return shipments.creerManifeste(b.carrier_code, { shipDate: b.ship_date, warehouseId: b.warehouse_id, userId: user });
});

// ==================================================================== RETOURS

route("GET /api/returns", ({ url }) => catalog.chercherRetours(q(url)));
route("POST /api/returns", async ({ req, user }) => {
  accounts.exiger(user, "returns_manage");
  return catalog.creerRetour({ ...(await corps(req)), userId: user });
});
route("POST /api/returns/:id", async ({ req, params, user }) => {
  accounts.exiger(user, "returns_manage");
  catalog.majRetour(Number(params.id), await corps(req), user);
  return { ok: true };
});

// =================================================================== PRODUITS

route("GET /api/products", ({ url }) => catalog.chercherProduits(q(url)));
route("GET /api/products/customs-alerts", () => ({ sans_hs: catalog.alertesDouane() }));
route("GET /api/products/:id", ({ params }) => catalog.produit(Number(params.id)) || { error: "inconnu" });
route("POST /api/products", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  return { id: catalog.sauverProduit(await corps(req)) };
});
route("GET /api/preset-groups", () => ({ groups: catalog.groupes() }));
route("POST /api/preset-groups", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  return { id: catalog.sauverGroupe(await corps(req)) };
});
route("GET /api/inventory/low", () => ({ low: catalog.stockBas() }));
route("POST /api/inventory", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  const b = await corps(req);
  catalog.poserStock(Number(b.product_id), Number(b.warehouse_id), b);
  return { ok: true };
});

// ==================================================================== CLIENTS

route("GET /api/customers", ({ url }) => catalog.chercherClients(q(url)));
route("POST /api/customers/rebuild", ({ user }) => {
  accounts.exiger(user, "orders_edit");
  return { n: catalog.reconstruireClients() };
});

// ============================================================= AUTOMATISATION

route("GET /api/rules", () => ({ rules: rules.lister(), champs: Object.keys(rules.CHAMPS),
  operateurs: Object.keys(rules.OPERATEURS), actions: Object.keys(rules.ACTIONS) }));
route("POST /api/rules", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  return { id: rules.sauver(await corps(req)) };
});
route("DELETE /api/rules/:id", ({ params, user }) => {
  accounts.exiger(user, "settings_edit");
  rules.supprimer(Number(params.id));
  return { ok: true };
});
/** Essai à blanc : quelles règles s'appliqueraient, sans rien modifier. */
route("POST /api/rules/test", async ({ req }) => {
  const b = await corps(req);
  return { declenchees: rules.appliquer(Number(b.order_id), { dryRun: true }) };
});
route("POST /api/rules/apply", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return { resultats: rules.appliquerLot((b.ids || []).map(Number)) };
});

// =================================================================== GABARITS

route("GET /api/templates", ({ url }) => ({ templates: templates.lister(q(url).kind || null) }));
route("POST /api/templates", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  return { id: templates.sauver(await corps(req)) };
});
route("DELETE /api/templates/:id", ({ params, user }) => {
  accounts.exiger(user, "settings_edit");
  templates.supprimer(Number(params.id));
  return { ok: true };
});

/** Rend un bordereau pour une ou plusieurs commandes — la sortie imprimable. */
route("GET /api/packing-slip", ({ url, res }) => {
  const ids = String(q(url).ids || "").split(",").filter(Boolean).map(Number);
  const gabarit = q(url).template_id ? templates.parId(Number(q(url).template_id)) : templates.defaut("packing_slip");
  if (!gabarit) return { error: "aucun gabarit de bordereau" };
  const marque = db.reglage("marque", accounts.MARQUE_DEFAUT);
  const pages = ids.map((id) => {
    const cmd = orders.parId(id);
    if (!cmd) return "";
    return `<article class="page">${templates.rendre(gabarit.body, { order: cmd, items: cmd.items, marque })}</article>`;
  }).join("");
  texte(res, 200, `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bordereaux</title><style>
  body{font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;color:#111}
  .page{padding:18mm;page-break-after:always}
  .logo{max-height:60px} header{display:flex;gap:16px;align-items:center;border-bottom:2px solid #111;padding-bottom:8px}
  h1{font-size:18px;margin:0} .adresses{display:flex;gap:40px;margin:14px 0}
  .adresses h3{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#666;margin:0 0 4px}
  table.articles{width:100%;border-collapse:collapse;margin-top:10px}
  table.articles th{text-align:left;border-bottom:1px solid #111;padding:5px 4px;font-size:11px}
  table.articles td{padding:5px 4px;border-bottom:1px solid #ddd}
  .n{text-align:right} .cadeau{background:#fff6e0;padding:7px;border-radius:4px}
  footer{margin-top:18px;border-top:1px solid #ddd;padding-top:8px;color:#666}
  @media print{.page{padding:10mm}}
</style></head><body>${pages || "<p>Aucune commande.</p>"}</body></html>`, "text/html; charset=utf-8");
  return null;   // réponse déjà écrite
});

/** Aperçu d'un gabarit en cours d'édition, sur une commande réelle. */
route("POST /api/templates/preview", async ({ req }) => {
  const b = await corps(req);
  const cmd = b.order_id ? orders.parId(Number(b.order_id))
    : orders.chercher({ limit: 1 }).orders[0];
  if (!cmd) return { error: "aucune commande pour l'aperçu" };
  const ctx = { order: cmd, items: cmd.items, shipment: {}, marque: db.reglage("marque", accounts.MARQUE_DEFAUT) };
  return { html: templates.rendre(b.body || "", ctx), sujet: templates.rendre(b.subject || "", ctx) };
});

// ================================================================= ANALYTIQUE

route("GET /api/analytics", ({ url }) => analytics.tableauDeBord(q(url)));
route("GET /api/analytics/destinations", () => ({ rows: analytics.parDestination() }));
route("GET /api/analytics/products", () => ({ rows: analytics.topProduits(30) }));
route("GET /api/analytics/dropoff", ({ url }) => analytics.economieDropOff({
  tarif: Number(q(url).tarif) || db.reglage("tarif_dropoff_cible", 6.31), ...q(url) }));

/** Export CSV — l'export brut de ShipStation. */
route("GET /api/export/:quoi", ({ params, url, res }) => {
  const f = q(url);
  const jeux = {
    orders: () => orders.chercher({ ...f, limit: 1000 }).orders.map((o) => ({
      commande: o.order_number, date: o.order_date, statut: o.status, client: o.customer_name,
      courriel: o.customer_email, ville: o.ship_to.city, province: o.ship_to.state, pays: o.ship_to.country,
      poids_g: o.weight_g, total: o.order_total, service_demande: o.requested_service })),
    shipments: () => shipments.chercher({ ...f, limit: 1000 }).shipments.map((s) => ({
      commande: s.order_number, suivi: s.tracking_number, transporteur: s.carrier_code,
      service: s.service_id, date: s.ship_date, cout: s.cost, drop_off: s.drop_off ? 1 : 0,
      annulee: s.voided ? 1 : 0, retour: s.is_return ? 1 : 0 })),
    products: () => catalog.chercherProduits({ ...f, limit: 1000 }).products.map((p) => ({
      sku: p.sku, nom: p.name, poids_g: p.weight_g, code_sh: p.hs_code,
      origine: p.country_of_origin, description_douane: p.customs_description, actif: p.active ? 1 : 0 })),
    customers: () => catalog.chercherClients({ ...f, limit: 1000 }).customers.map((c) => ({
      courriel: c.email, nom: c.name, commandes: c.order_count, total: c.total_spent,
      premiere: c.first_order, derniere: c.last_order })),
  };
  if (!jeux[params.quoi]) return { error: "export inconnu", code: 404 };
  const csv = analytics.csv(jeux[params.quoi]());
  res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${params.quoi}.csv"` });
  res.end("﻿" + csv);   // BOM : Excel lit correctement les accents
  return null;
});

// ============================================== RÉFÉRENTIELS, RÉGLAGES, ADMIN

route("GET /api/refs", () => ({
  stores: db.all("SELECT * FROM stores ORDER BY name"),
  warehouses: db.all("SELECT * FROM warehouses ORDER BY name").map((w) => ({ ...w, origin_address: db.parse(w.origin_address, {}) })),
  carriers: db.all("SELECT * FROM carriers ORDER BY name"),
  tags: db.all("SELECT * FROM tags ORDER BY name"),
  users: accounts.utilisateurs(),
  statuts: orders.STATUTS,
}));

route("GET /api/settings", () => ({
  marque: db.reglage("marque", accounts.MARQUE_DEFAUT),
  tarif_dropoff_cible: db.reglage("tarif_dropoff_cible", 6.31),
  derniere_migration: db.reglage("derniere_migration", null),
  seuil_dropoff_g: SEUIL_DROPOFF_G,
}));
route("POST /api/settings", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  for (const [k, v] of Object.entries(b)) db.poserReglage(k, v);
  return { ok: true };
});

route("GET /api/users", () => ({ users: accounts.utilisateurs(), domaines: accounts.DOMAINES, roles: Object.keys(accounts.ROLES) }));
route("POST /api/users", async ({ req, user }) => {
  accounts.exiger(user, "users_manage");
  const b = await corps(req);
  return b.id ? (accounts.majUtilisateur(b.id, b), { id: b.id }) : { id: accounts.creerUtilisateur(b) };
});

route("GET /api/webhooks", () => ({ webhooks: accounts.abonnements(), evenements: accounts.EVENEMENTS }));
route("POST /api/webhooks", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  return { id: accounts.abonner(await corps(req)) };
});
route("DELETE /api/webhooks/:id", ({ params, user }) => {
  accounts.exiger(user, "settings_edit");
  accounts.desabonner(Number(params.id));
  return { ok: true };
});

route("GET /api/notifications", () => ({ queued: accounts.notificationsEnAttente() }));

route("GET /api/views", ({ url }) => ({
  views: db.all("SELECT * FROM views WHERE scope = ? ORDER BY name", q(url).scope || "orders")
    .map((v) => ({ ...v, filters: db.parse(v.filters, {}) })),
}));
route("POST /api/views", async ({ req }) => {
  const b = await corps(req);
  if (b.delete) { db.run("DELETE FROM views WHERE id = ?", Number(b.id)); return { ok: true }; }
  db.run(`INSERT INTO views (name, scope, filters) VALUES (?,?,?)
          ON CONFLICT(name, scope) DO UPDATE SET filters = excluded.filters`,
    b.name, b.scope || "orders", db.dump(b.filters || {}));
  return { ok: true };
});

route("GET /api/audit", ({ url }) => ({
  rows: db.all("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", Math.min(Number(q(url).limit) || 100, 500))
    .map((r) => ({ ...r, detail: db.parse(r.detail) })),
}));

/** Migration depuis ShipStation — longue, à lancer sciemment. */
route("POST /api/migrate", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  const lignes = [];
  const bilan = await ingest.migrerDepuisShipStation({
    journal: (m) => { lignes.push(m); console.error(m); },
    maxPagesCommandes: Number(b.max_pages) || 100,
    depuis: b.depuis || null,
  });
  return { bilan, journal: lignes };
});

route("GET /api/config", () => ({
  adaptateur: adaptateur().nom,
  etiquettes_actives: ETIQUETTES,
  seuil_dropoff_g: SEUIL_DROPOFF_G,
  protege: !!SECRET,
  db: db.CHEMIN,
  amorce: !!db.reglage("amorce"),
}));

// =================================================================== serveur

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chemin = url.pathname.replace(/\/+$/, "") || "/";

  try {
    // Statique
    if (chemin === "/" || chemin === "/index.html") {
      return texte(res, 200, fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8"), "text/html; charset=utf-8");
    }
    if (chemin === "/api/config") return json(res, 200, ROUTES["GET /api/config"]({}));

    // Authentification
    if (SECRET && (req.headers["x-app-secret"] || url.searchParams.get("secret")) !== SECRET) {
      return json(res, 401, { error: "secret d'application requis" });
    }

    const trouve = trouver(req.method, chemin);
    if (!trouve) return json(res, 404, { error: `route inconnue : ${req.method} ${chemin}` });

    const user = utilisateurCourant(req);
    const out = await trouve.fn({ req, res, url, params: trouve.params, user });
    if (out === null) return;                       // le handler a déjà répondu
    if (out && out.error && out.code) return json(res, out.code, { error: out.error });
    return json(res, 200, out);
  } catch (e) {
    const code = e.code === 403 ? 403 : 500;
    return json(res, code, { error: String(e.message || e) });
  }
});

if (require.main === module) {
  db.db();
  ingest.amorcer();
  const liberees = orders.libererHolds();
  serveur.listen(PORT, () => {
    console.log(`shipstation-clone sur http://localhost:${PORT}`);
    console.log(`  base         : ${db.CHEMIN}`);
    console.log(`  transporteur : ${adaptateur().nom}`);
    console.log(`  étiquettes   : ${ETIQUETTES ? "ACHAT ACTIF (argent réel)" : "achat désactivé"}`);
    if (liberees) console.log(`  ${liberees} commande(s) sortie(s) d'attente au démarrage`);
  });
  // Les holds arrivés à échéance repartent en file, comme la tâche de fond de ShipStation.
  setInterval(() => orders.libererHolds(), 15 * 60 * 1000).unref();
}

module.exports = { serveur, ROUTES, trouver };
