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
const channels = require("../lib/channels");
const criteres = require("../lib/criteres");
const automation = require("../lib/automation");
const hs = require("../lib/hs");
const lasclay = require("../lib/lasclay");
const shopify = require("../lib/shopify_sync");
const presets = require("../lib/presets");
const { adaptateur, SEUIL_DROPOFF_G } = require("../lib/carrier");

const auth = require("../lib/auth");

const PORT = process.env.PORT || 3100;
const HOTE = process.env.HOST || "0.0.0.0";
const ETIQUETTES = process.env.CLONE_ALLOW_LABELS === "1";
const PUBLIC = path.join(__dirname, "public");
/** Derrière le proxy de Render, l'IP réelle est dans X-Forwarded-For. */
const ipDe = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
  || req.socket.remoteAddress || null;

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
const corpsBrut = (req) => new Promise((ok, ko) => {
  let d = ""; req.on("data", (c) => { d += c; if (d.length > 8e6) req.destroy(); });
  req.on("end", () => ok(d));
  req.on("error", ko);
});
const q = (url) => Object.fromEntries(url.searchParams);

/**
 * Utilisateur courant — résolu par le cookie de session, jamais par un en-tête fourni par le
 * client. Un `X-User-Id` se falsifie ; un jeton de session se vérifie en base.
 */
const utilisateurCourant = (req) => auth.session(auth.lireCookie(req));

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
/**
 * Configuration d'expédition appliquée à une sélection — l'équivalent du « Configure Shipment
 * Widget » de ShipStation. Seuls les champs fournis sont écrits ; les autres restent tels quels,
 * pour qu'on puisse corriger un poids sans effacer un service déjà choisi.
 */
route("POST /api/orders/configure", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  const champs = ["carrier_code", "service_id", "package_id", "confirmation", "warehouse_id"];
  const sets = [], vals = [];
  for (const c of champs) if (b[c] !== undefined && b[c] !== "") { sets.push(`${c} = ?`); vals.push(b[c]); }
  if (b.weight_g !== undefined && b.weight_g !== "") { sets.push("weight_g = ?"); vals.push(Number(b.weight_g)); }
  if (b.dimensions) { sets.push("dimensions = ?"); vals.push(db.dump(b.dimensions)); }
  if (!sets.length) return { error: "aucun champ à modifier", code: 400 };
  let n = 0;
  for (const id of (b.ids || []).map(Number)) {
    db.run(`UPDATE orders SET ${sets.join(", ")}, modified_at = ? WHERE id = ?`, ...vals, db.maintenant(), id);
    n++;
  }
  db.journaliser("order.configure", "order", null, { n, champs: sets.length }, user);
  return { ok: true, n };
});

route("POST /api/orders/release-holds", ({ user }) => {
  accounts.exiger(user, "orders_edit");
  return { liberees: orders.libererHolds() };
});

// ================================================================ EXPÉDITIONS

route("GET /api/shipments", ({ url }) => shipments.chercher(q(url)));
route("GET /api/batches/:id/orders", ({ params }) => ({
  orders: orders.chercher({ batch_id: Number(params.id), limit: 1000 }).orders,
}));
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
/** Lots ouverts — le panneau gauche de l'écran Commandes. */
route("GET /api/batches/open", () => ({ batches: shipments.lotsOuverts() }));
/** Crée un lot vide, prêt à recevoir des commandes. */
route("POST /api/batches/new", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  const r = shipments.creerLotVide({ name: b.name || null, userId: user && user.id });
  if ((b.ids || []).length) shipments.ajouterAuLot(r.batchId, b.ids.map(Number), user && user.id);
  return r;
});
/** Dépose des commandes dans un lot existant. */
route("POST /api/batches/add", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return shipments.ajouterAuLot(Number(b.batch_id), (b.ids || []).map(Number), user && user.id);
});
route("POST /api/batches/remove", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return shipments.retirerDuLot((b.ids || []).map(Number), user && user.id);
});
/** Traite un lot : achète les étiquettes de toutes les commandes qui y attendent. */
route("POST /api/batches/:id/process", async ({ req, params, user }) => {
  accounts.exiger(user, "labels_buy");
  if (!ETIQUETTES) return { error: "achat d'étiquettes désactivé — lancer avec CLONE_ALLOW_LABELS=1", code: 403 };
  const b = await corps(req);
  const ids = shipments.commandesDuLot(Number(params.id));
  if (!ids.length) return { error: "ce lot ne contient aucune commande à expédier", code: 400 };
  return await shipments.traiterLot(Number(params.id), ids, { userId: user,
    margeMax: b.marge_max === "" || b.marge_max === undefined || b.marge_max === null ? null : Number(b.marge_max) });
});
route("POST /api/batches/:id/close", ({ params, user }) => {
  accounts.exiger(user, "orders_edit");
  return shipments.fermerLot(Number(params.id), user && user.id);
});
route("GET /api/batches/:id", ({ params }) => shipments.lot(Number(params.id)));
route("POST /api/batches", async ({ req, user }) => {
  accounts.exiger(user, "labels_buy");
  if (!ETIQUETTES) return { error: "achat d'étiquettes désactivé — lancer avec CLONE_ALLOW_LABELS=1", code: 403 };
  const b = await corps(req);
  const ids = (b.ids || []).map(Number);
  const { batchId } = shipments.creerLot(ids, { name: b.name, userId: user });
  return await shipments.traiterLot(batchId, ids, { userId: user, serviceId: b.service_id,
    margeMax: b.marge_max === null || b.marge_max === undefined || b.marge_max === "" ? null : Number(b.marge_max) });
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

// ---------------------------------------------- renvoi du suivi aux boutiques

route("GET /api/channels", () => ({
  canaux: channels.etat(), en_attente: channels.enAttente(200),
  bascule: channels.dateBascule(), historique_ignore: channels.historiqueIgnore(),
}));

/** Prendre le relais : à partir de maintenant, c'est le clone qui notifie les boutiques. */
route("POST /api/channels/bascule", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  return { bascule: channels.poserBascule(b.date || null) };
});

route("POST /api/channels/notify", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  if (b.shipment_id) return await channels.notifier(Number(b.shipment_id), { force: !!b.force });
  return await channels.traiterFile({ limite: Number(b.limite) || 50 });
});

route("GET /api/manifests", () => ({ manifests: shipments.manifestes() }));
route("POST /api/manifests", async ({ req, user }) => {
  const b = await corps(req);
  return shipments.creerManifeste(b.carrier_code, { shipDate: b.ship_date, warehouseId: b.warehouse_id, userId: user });
});

// ================================================================ SHOPIFY

route("GET /api/shopify", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  const e = shopify.etat();
  if (!e.configure) return e;
  try { e.webhooks = await shopify.webhooksExistants(); }
  catch (err) { e.webhooks_erreur = String(err.message).slice(0, 200); }
  return e;
});

route("POST /api/shopify/rattraper", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  const lignes = [];
  const r = await shopify.rattraper({ depuis: b.depuis || null, max: Number(b.max) || 2000,
    journal: (m) => { lignes.push(m); console.error(m); } });
  return { ...r, journal: lignes };
});

route("POST /api/shopify/order", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  return await shopify.importerUne((await corps(req)).id);
});

route("POST /api/shopify/webhooks", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  if (!b.base_url) return { error: "base_url requis (ex. https://shipstation-clone.onrender.com)", code: 400 };
  return await shopify.abonnerWebhooks(b.base_url);
});

/**
 * Point d'entrée des webhooks Shopify. Public par nécessité — Shopify n'a pas de session —
 * mais protégé par la signature HMAC sur le corps brut. Un corps non signé est rejeté.
 */
route("POST /webhooks/shopify", async ({ req, res }) => {
  const brut = await corpsBrut(req);
  if (!shopify.signatureValide(brut, req.headers["x-shopify-hmac-sha256"])) {
    db.journaliser("shopify.webhook_refuse", "system", null, { ip: ipDe(req) });
    return { error: "signature invalide", code: 401 };
  }
  // On répond tout de suite : Shopify désactive un point de terminaison trop lent.
  json(res, 200, { ok: true });
  const sujet = req.headers["x-shopify-topic"] || "";
  setImmediate(async () => {
    try {
      const r = await shopify.traiterWebhook(sujet, JSON.parse(brut));
      db.journaliser("shopify.webhook", "order", r.id || null, r);
    } catch (e) {
      db.journaliser("shopify.webhook_erreur", "system", null, { sujet, erreur: String(e.message).slice(0, 300) });
    }
  });
  return null;
});

// ================================================= PRÉRÉGLAGES, ALIAS, BUNDLES

route("GET /api/presets", () => ({ presets: presets.presets() }));
route("POST /api/presets", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  return { id: presets.sauverPreset(await corps(req)) };
});
route("DELETE /api/presets/:id", ({ params, user }) => {
  accounts.exiger(user, "settings_edit");
  presets.supprimerPreset(Number(params.id));
  return { ok: true };
});
route("POST /api/presets/apply", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return presets.appliquerPreset(Number(b.preset_id), (b.ids || []).map(Number),
    { userId: user && user.id, garderPoids: b.garder_poids !== false });
});

route("GET /api/aliases", ({ user }) => { accounts.exiger(user, "products_view"); return { aliases: presets.alias() }; });
route("POST /api/aliases", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  const b = await corps(req);
  if (b.supprimer) { presets.retirerAlias(b.alias); return { ok: true }; }
  presets.poserAlias(b.alias, b.sku, b.store_id || null);
  return { ok: true };
});
route("POST /api/bundles", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  const b = await corps(req);
  return { composants: presets.definirBundle(b.sku, b.items || []) };
});

/** Liste de prélèvement — bundles éclatés, agrégée, triée par emplacement. */
route("GET /api/pick-list", ({ url, res }) => {
  const ids = String(q(url).ids || "").split(",").filter(Boolean).map(Number);
  const lignes = presets.listeDePrelevement(ids);
  const marque = db.reglage("marque", accounts.MARQUE_DEFAUT);
  texte(res, 200, `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Liste de prélèvement</title><style>
 body{font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:18mm;color:#111}
 h1{font-size:17px;margin:0 0 2px} .s{color:#666;margin:0 0 14px}
 table{width:100%;border-collapse:collapse} th{text-align:left;border-bottom:2px solid #111;padding:6px 4px;font-size:11px}
 td{padding:7px 4px;border-bottom:1px solid #ddd} .n{text-align:right;font-variant-numeric:tabular-nums}
 .c{width:26px} .q{font-weight:700;font-size:15px}
 @media print{body{padding:10mm}}
</style></head><body>
<h1>Liste de prélèvement — ${db.parse(JSON.stringify(marque.nom))}</h1>
<p class="s">${ids.length} commande(s) · ${lignes.length} article(s) distinct(s) ·
  ${lignes.reduce((s, l) => s + l.quantity, 0)} unité(s) — ${new Date().toISOString().slice(0, 16).replace("T", " ")}</p>
<table><thead><tr><th class="c"></th><th>Emplacement</th><th>SKU</th><th>Article</th><th class="n">Qté</th></tr></thead>
<tbody>${lignes.map((l) => `<tr><td class="c">☐</td><td><b>${l.warehouse_location || "—"}</b></td>
  <td>${l.sku || "—"}</td><td>${String(l.name || "").replace(/[<>&]/g, "")}</td>
  <td class="n q">${l.quantity}</td></tr>`).join("")}</tbody></table>
</body></html>`, "text/html; charset=utf-8");
  return null;
});

// ============================================ COMMANDES MANUELLES ET IMPORT CSV

route("POST /api/orders/manual", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  return ingest.creerCommandeManuelle(await corps(req), { userId: user });
});
route("GET /api/orders/next-number", ({ user }) => {
  accounts.exiger(user, "orders_edit");
  return { order_number: ingest.prochainNumeroManuel() };
});
route("POST /api/import/csv", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  if (!b.csv) return { error: "aucun contenu", code: 400 };
  return ingest.importerCsv(b.csv, { apercu: !!b.apercu, userId: user });
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

/** Vocabulaire du moteur de critères — alimente l'éditeur de règles ET celui de vues. */
route("GET /api/criteres", () => ({
  champs: Object.entries(criteres.CHAMPS).map(([cle, c]) => ({
    cle, article: !!c.article, num: !!c.num, bool: !!c.bool, date: !!c.date, liste: !!c.liste,
    unite: c.unite || null, shipstation: c.ss || null,
  })),
  operateurs: Object.entries(criteres.OPERATEURS).map(([cle, o]) => ({
    cle, libelle: o.libelle, num: !!o.num, bool: !!o.bool, date: !!o.date, shipstation: o.ss || null,
  })),
  portees: criteres.PORTEES,
  actions: Object.keys(rules.ACTIONS),
  confirmations: require("../lib/lasclay").CONFIRMATIONS,
}));

route("POST /api/rules/reorder", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  rules.reordonner((await corps(req)).ids || []);
  return { ok: true };
});

// ------------------------------------------------- pipeline des 6 couches (§3.1)

route("GET /api/automation", () => ({ couches: automation.COUCHES }));
route("POST /api/automation/run", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return { resultats: automation.traiterLot((b.ids || []).map(Number),
    { dryRun: !!b.dry_run, couches: b.couches || null }) };
});
/** Équivalent du « Reprocess Automation Rules » — couches 4, 5, 6 sur les commandes ouvertes. */
route("POST /api/automation/reprocess", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  return automation.retraiter({ dryRun: !!b.dry_run, limite: Number(b.limite) || 5000 });
});

// ================================================== MAPPINGS DE SERVICE (§13.6)

route("GET /api/service-mappings", ({ url }) => ({
  mappings: presets.mappings(q(url).store_id ? Number(q(url).store_id) : null),
  non_mappes: presets.libellesNonMappes(),
}));
route("POST /api/service-mappings", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  if (b.delete) { presets.supprimerMapping(Number(b.id)); return { ok: true }; }
  return { id: presets.sauverMapping(b) };
});

// ============================================================ DOUANES (codes SH)

route("GET /api/hs", () => ({ alertes: hs.alertes(), familles: hs.FAMILLES.map((f) => ({ code: f.code, libelle: f.libelle, revalider: !!f.revalider })) }));
route("POST /api/hs/simuler", async ({ req }) => hs.simuler({ seulementSansCode: (await corps(req)).tous !== true }));
route("POST /api/hs/appliquer", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  return hs.appliquer({ seulementSansCode: (await corps(req)).tous !== true, userId: user && user.id });
});

// ====================================================== CONFIGURATION LASCLAY

route("GET /api/lasclay", () => lasclay.etat());
route("POST /api/lasclay/charger", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  const lignes = [];
  const bilan = lasclay.charger({ remplacer: !!b.remplacer, journal: (m) => lignes.push(m) });
  return { bilan, journal: lignes };
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
  const format = q(url).format || "full";
  const styleFormat = format === "4x6"
    ? `@page{size:4in 6in;margin:0} .page{padding:6mm;font-size:11px}`
    : format === "2up"
      ? `@page{size:letter;margin:0} .page{padding:8mm;height:5.5in;page-break-after:auto;
         border-bottom:1px dashed #bbb} .page:nth-child(2n){page-break-after:always}`
      : `@page{size:letter;margin:0}`;
  texte(res, 200, `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bordereaux</title><style>
  ${styleFormat}
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
      courriel: c.email, nom: c.name, telephone: c.phone, commandes: c.order_count,
      total: c.total_spent, premiere: c.first_order, derniere: c.last_order })),
    batches: () => shipments.lots().map((b) => ({
      lot: b.id, nom: b.name, cree: b.created_at, etiquettes: b.n, cout: b.cout, statut: b.status })),
    returns: () => catalog.chercherRetours({ limit: 1000 }).returns.map((r) => ({
      rma: r.rma, commande: r.order_number, client: r.customer_name, motif: r.reason,
      resolution: r.resolution, statut: r.status, demande: r.requested_at, clos: r.closed_at })),
    manifests: () => shipments.manifestes().map((m) => ({
      manifeste: m.id, transporteur: m.carrier_code, date: m.ship_date,
      expeditions: m.shipment_count, statut: m.status })),
    /** Le « Shipping Cost Report » de ShipStation : payé contre encaissé, ligne à ligne. */
    "shipping-cost": () => db.all(`
      SELECT o.order_number commande, o.order_date date_commande, s.ship_date date_envoi,
             s.carrier_code transporteur, s.service_id service, s.weight_g poids_g,
             ROUND(s.cost,2) cout_reel, ROUND(o.shipping_paid,2) frais_encaisses,
             ROUND(o.shipping_paid - s.cost, 2) ecart, s.drop_off,
             json_extract(s.ship_to,'$.country') pays
      FROM shipments s JOIN orders o ON o.id = s.order_id
      WHERE s.voided = 0 ORDER BY s.ship_date DESC LIMIT 5000`),
    /** Détail article par article, pour les rapprochements comptables. */
    "order-items": () => db.all(`
      SELECT o.order_number commande, o.order_date date, i.sku, i.name article,
             i.quantity qte, i.unit_price prix, i.weight_g poids_g, o.status statut
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE i.adjustment = 0 ORDER BY o.order_date DESC LIMIT 10000`),
  };
  if (!jeux[params.quoi]) return { error: "export inconnu", code: 404 };
  const csv = analytics.csv(jeux[params.quoi]());
  res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${params.quoi}.csv"` });
  res.end("﻿" + csv);   // BOM : Excel lit correctement les accents
  return null;
});

// ============================================== RÉFÉRENTIELS, RÉGLAGES, ADMIN

/**
 * Sauvegarde complète en JSON — tout ce que contient la base, sans les PDF d'étiquettes.
 * Existe pour qu'aucune donnée ne soit jamais captive de cet outil non plus.
 */
route("GET /api/backup", ({ res, user }) => {
  accounts.exiger(user, "settings_edit");
  const tables = db.all(`SELECT name FROM sqlite_master WHERE type='table'
                         AND name NOT LIKE 'sqlite_%' AND name NOT IN ('sessions','login_attempts')`)
    .map((t) => t.name);
  const sortie = { exporte_le: db.maintenant(), tables: {} };
  for (const t of tables) {
    sortie.tables[t] = t === "shipments"
      ? db.all("SELECT * FROM shipments").map(({ label_pdf, customs_pdf, ...r }) => r)
      : t === "users"
        ? db.all("SELECT * FROM users").map(({ password_hash, totp_secret, recovery_codes, ...r }) => r)
        : db.all(`SELECT * FROM ${t}`);
  }
  const b = Buffer.from(JSON.stringify(sortie, null, 1));
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`,
    "Content-Length": b.length });
  res.end(b);
  db.journaliser("backup.export", "system", null, { tables: tables.length }, user);
  return null;
});

route("GET /api/refs", () => ({
  stores: db.all("SELECT * FROM stores ORDER BY name"),
  warehouses: db.all("SELECT * FROM warehouses ORDER BY name").map((w) => ({ ...w, origin_address: db.parse(w.origin_address, {}) })),
  carriers: db.all("SELECT * FROM carriers ORDER BY name"),
  tags: db.all("SELECT * FROM tags ORDER BY name"),
  services: db.all("SELECT * FROM services ORDER BY carrier_code, name"),
  packages: db.all("SELECT * FROM packages ORDER BY carrier_code, name"),
  users: accounts.utilisateurs(),
  statuts: orders.STATUTS,
  services: db.all("SELECT * FROM services WHERE hidden IS NULL OR hidden = 0 ORDER BY carrier_code, CAST(id AS INTEGER), name"),
  packages: db.all("SELECT * FROM packages ORDER BY custom DESC, name").map((p) => ({ ...p, dimensions: db.parse(p.dimensions) })),
  presets: presets.presets(),
  confirmations: lasclay.CONFIRMATIONS,
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

route("GET /api/users", ({ user }) => {
  accounts.exiger(user, "users_manage");
  return {
    users: accounts.utilisateurs().map((u) => ({
      ...u, password_hash: undefined, totp_secret: undefined, recovery_codes: undefined,
      totp_enabled: !!u.totp_enabled,
    })),
    domaines: accounts.DOMAINES, roles: Object.keys(accounts.ROLES),
  };
});
route("POST /api/users", async ({ req, user }) => {
  accounts.exiger(user, "users_manage");
  const b = await corps(req);
  if (b.id) { accounts.majUtilisateur(b.id, b); return { id: b.id }; }
  // Création d'un employé : compte avec mot de passe provisoire à transmettre de vive voix.
  return auth.creerCompte(b);
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

/**
 * Vues sauvegardées. Le compteur est calculé ici : ShipStation l'affiche sur chaque onglet
 * et c'est ce qui rend la barre de vues utilisable pour trier un arriéré d'un coup d'œil.
 */
route("GET /api/views", ({ url }) => {
  const p = q(url);
  const lignes = db.all("SELECT * FROM views WHERE scope = ? ORDER BY position, name", p.scope || "orders");
  return {
    views: lignes.map((v) => {
      const cs = db.parse(v.criteres, []);
      const vue = { ...v, filters: db.parse(v.filters, {}), criteres: cs, columns: db.parse(v.columns, null),
                    match_all: v.match_all !== 0, shared: !!v.shared };
      if (p.counts === "1" && (p.scope || "orders") === "orders") {
        // Le compteur d'une vue se lit **dans le statut courant** : une vue est un second
        // niveau de tri, pas une requête indépendante. Sinon « Graines x1 » annoncerait 38 000
        // commandes dont 37 000 déjà expédiées, et le chiffre ne dirait plus rien de la file.
        const c = criteres.compiler(cs, vue.match_all);
        const w = [], par = [];
        if (c.sql) { w.push(c.sql); par.push(...c.params); }
        if (p.status) { w.push("o.status = ?"); par.push(p.status); }
        vue.n = db.one(`SELECT COUNT(*) n FROM orders o${w.length ? " WHERE " + w.join(" AND ") : ""}`, ...par).n;
      }
      return vue;
    }),
  };
});
route("POST /api/views", async ({ req }) => {
  const b = await corps(req);
  if (b.delete) { db.run("DELETE FROM views WHERE id = ?", Number(b.id)); return { ok: true }; }
  db.run(`INSERT INTO views (name, scope, filters, criteres, match_all, columns, position, notes)
          VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(name, scope) DO UPDATE SET filters = excluded.filters, criteres = excluded.criteres,
            match_all = excluded.match_all, columns = excluded.columns, notes = excluded.notes`,
    b.name, b.scope || "orders", db.dump(b.filters || {}), db.dump(b.criteres || []),
    b.match_all === false ? 0 : 1, db.dump(b.columns || null), b.position || 0, b.notes || null);
  return { id: db.one("SELECT id FROM views WHERE name = ? AND scope = ?", b.name, b.scope || "orders").id };
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
  amorce: !!db.reglage("amorce"),
  config_lasclay: !!db.reglage("config_lasclay"),
  shopify: shopify.etat(),
  unite_poids: db.reglage("unite_poids", "g"),
  unite_dimension: db.reglage("unite_dimension", "in"),
  comptes: db.one("SELECT COUNT(*) n FROM users WHERE password_hash IS NOT NULL").n,
  exiger_2fa: !!db.reglage("exiger_2fa", false),
}));

// ============================================================ AUTHENTIFICATION

route("POST /api/login", async ({ req, res }) => {
  const b = await corps(req);
  const { token, expire, user, besoin2fa } = auth.connecter(b.email, b.password,
    { ip: ipDe(req), agent: req.headers["user-agent"] });
  res.setHeader("Set-Cookie", auth.poserCookie(token, expire));
  // Si le second facteur est actif, le cookie porte une session « en attente » qui n'ouvre
  // rien : seule /api/login/2fa peut la promouvoir.
  return { user, besoin2fa };
});

route("POST /api/login/2fa", async ({ req, res }) => {
  const b = await corps(req);
  const jeton = auth.lireCookie(req);
  const { expire, user, methode } = auth.verifier2facteur(jeton, b.code, { ip: ipDe(req) });
  res.setHeader("Set-Cookie", auth.poserCookie(jeton, expire));
  return { user, methode };
});

// --- gestion de son propre second facteur
route("GET /api/moi/2fa", ({ moi }) => auth.etat2facteur(moi.id));

route("POST /api/moi/2fa/preparer", async ({ req, moi }) =>
  auth.preparer2facteur(moi.id, { regenerer: (await corps(req)).regenerer === true }));

route("POST /api/moi/2fa/activer", async ({ req, moi }) => auth.activer2facteur(moi.id, (await corps(req)).code));

route("POST /api/moi/2fa/desactiver", async ({ req, moi }) => {
  if (db.reglage("exiger_2fa", false)) return { error: "le second facteur est obligatoire sur ce service", code: 403 };
  auth.desactiver2facteur(moi.id, (await corps(req)).password);
  return { ok: true };
});

/** Téléphone perdu sans code de secours : seul un administrateur peut débloquer. */
route("POST /api/users/:id/2fa/reset", ({ params, user }) => {
  accounts.exiger(user, "users_manage");
  auth.reinitialiser2facteur(params.id, user);
  return { ok: true };
});

route("POST /api/logout", async ({ req, res }) => {
  auth.deconnecter(auth.lireCookie(req));
  res.setHeader("Set-Cookie", auth.effacerCookie());
  return { ok: true };
});

/** Qui suis-je — sert à l'interface pour savoir quoi afficher. */
route("GET /api/moi", ({ moi }) => (moi ? { user: moi, pref: preferences(moi.id) } : { user: null }));

/**
 * Préférences d'affichage — portée **utilisateur**, pas compte (§6.12 des notes de
 * réplication : langue, format de date, unités et écran de connexion sont personnels).
 * Conservées en base plutôt que dans le navigateur : un employé qui change de poste garde
 * sa langue, et ce n'est pas ce qui doit se réinitialiser en vidant un cache.
 */
const preferences = (userId) => db.reglage(`pref:${userId}`, { langue: "fr" }) || { langue: "fr" };

route("GET /api/moi/preferences", ({ moi }) => preferences(moi.id));
route("POST /api/moi/preferences", async ({ req, moi }) => {
  const b = await corps(req);
  const p = { ...preferences(moi.id), ...b };
  db.poserReglage(`pref:${moi.id}`, p);
  return p;
});

route("POST /api/moi/password", async ({ req, moi }) => {
  const b = await corps(req);
  if (!auth.verifier(b.ancien, db.one("SELECT password_hash h FROM users WHERE id = ?", moi.id).h))
    return { error: "mot de passe actuel incorrect", code: 403 };
  auth.changerMotDePasse(moi.id, b.nouveau);
  return { ok: true, reconnexion: true };
});

route("GET /api/moi/sessions", ({ moi }) => ({ sessions: auth.sessionsDe(moi.id) }));

/** Réinitialisation par un administrateur : renvoie un mot de passe provisoire. */
route("POST /api/users/:id/password", async ({ req, params, user }) => {
  accounts.exiger(user, "users_manage");
  const b = await corps(req);
  const mdp = b.password || auth.suggerer();
  auth.changerMotDePasse(params.id, mdp, { parAdmin: true });
  db.run("DELETE FROM sessions WHERE user_id = ?", params.id);
  return { motDePasse: mdp };
});

// =================================================================== serveur

/** Routes accessibles sans session. Tout le reste exige d'être connecté. */
const PUBLIQUES = new Set(["GET /", "GET /index.html", "GET /api/config",
  "POST /api/login", "POST /api/login/2fa", "POST /api/logout", "GET /api/moi", "GET /healthz",
  "POST /webhooks/shopify"]);   // authentifié par signature HMAC, pas par session

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chemin = url.pathname.replace(/\/+$/, "") || "/";
  const spec = `${req.method} ${chemin}`;

  try {
    // Sonde de santé — Render l'interroge sans cookie.
    if (chemin === "/healthz") return texte(res, 200, "ok");

    // En-têtes de sécurité, sur toutes les réponses.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");

    if (chemin === "/" || chemin === "/index.html") {
      return texte(res, 200, fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8"), "text/html; charset=utf-8");
    }

    const moi = utilisateurCourant(req);
    if (!PUBLIQUES.has(spec) && !moi) {
      return json(res, 401, { error: "session requise", login: true });
    }

    const trouve = trouver(req.method, chemin);
    if (!trouve) return json(res, 404, { error: `route inconnue : ${spec}` });

    const out = await trouve.fn({ req, res, url, params: trouve.params, user: moi ? moi.id : null, moi });
    if (out === null) return;                       // le handler a déjà répondu
    if (out && out.error && out.code) return json(res, out.code, { error: out.error });
    return json(res, 200, out);
  } catch (e) {
    const code = e.code === 403 ? 403 : e.code === 429 ? 429 : 500;
    return json(res, code, { error: String(e.message || e) });
  }
});

if (require.main === module) {
  // Une base inaccessible est fatale, mais le message doit être lisible : sur Render, une
  // pile EACCES ne dit pas qu'il manque un disque.
  try {
    db.db();
  } catch (e) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }
  ingest.amorcer();

  // Premier démarrage : créer l'administrateur, sans quoi personne ne peut se connecter.
  // Une erreur ici ne doit pas tuer le service : mieux vaut démarrer et le dire, puisque
  // l'outil en ligne de commande permet de rattraper (admin.js motdepasse …).
  let admin = null, soucisAdmin = null, reprise = null;
  try {
    if (process.env.CLONE_ADMIN_RESET === "1") reprise = auth.reprendreAcces();
    else admin = auth.amorcerAdmin();
  } catch (e) { soucisAdmin = String(e.message || e); }
  const liberees = orders.libererHolds();

  // Le bilan d'installation part dans les logs à chaque démarrage : ce sont les mêmes
  // contrôles que `node shipstation-clone/verifier.js`, mais sans avoir à ouvrir un shell.
  const bilan = () => require("../verifier").verifier().catch((e) => console.error(e.message));

  serveur.listen(PORT, HOTE, () => {
    console.log(`shipstation-clone sur ${HOTE}:${PORT}`);
    console.log(`  base         : ${db.CHEMIN}`);
    console.log(`  transporteur : ${adaptateur().nom}`);
    console.log(`  étiquettes   : ${ETIQUETTES ? "ACHAT ACTIF (argent réel)" : "achat désactivé"}`);
    if (liberees) console.log(`  ${liberees} commande(s) sortie(s) d'attente au démarrage`);
    if (soucisAdmin) {
      console.log(`\n  !! Compte administrateur NON créé : ${soucisAdmin}`);
      console.log("     Rattrapage : node shipstation-clone/admin.js creer <courriel> \"<nom>\" admin\n");
    }
    // Quels comptes existent — sans secret. Sans ça, un « mot de passe incorrect » ne dit pas
    // s'il faut s'en prendre au mot de passe ou au courriel.
    const comptes = auth.inventaireComptes();
    if (comptes.length) {
      console.log("\n  Comptes en base :");
      for (const c of comptes) {
        console.log(`    ${c.active ? "●" : "○"} ${c.email}  ${c.name}` +
          `  ${c.a_mdp ? "" : "[SANS MOT DE PASSE] "}${c.totp_enabled ? "[2FA] " : ""}${c.must_change ? "[provisoire]" : ""}`);
      }
      console.log();
    }

    if (reprise) {
      console.log("\n  ── REPRISE D'ACCÈS (CLONE_ADMIN_RESET=1) ──────────────────────");
      console.log("  courriel :");
      console.log(`\n${reprise.email}\n`);
      if (reprise.motDePasse) {
        console.log("  mot de passe (à copier tel quel, sans espace) :");
        console.log(`\n${reprise.motDePasse}\n`);
      } else {
        console.log("  mot de passe : celui de CLONE_ADMIN_PASSWORD\n");
      }
      console.log("  Second facteur retiré, sessions fermées, compte remis administrateur.");
      console.log("  >> RETIRER MAINTENANT la variable CLONE_ADMIN_RESET des réglages du service.");
      console.log("  ───────────────────────────────────────────────────────────────\n");
    }

    setTimeout(bilan, 500);
    if (admin) {
      // Le mot de passe est imprimé SEUL sur sa ligne, sans cadre ni remplissage : dans un
      // encadré, le copier emporte les espaces de remplissage et la connexion échoue ensuite
      // sur un mot de passe « correct » — piège vécu.
      console.log("\n  ── PREMIER DÉMARRAGE — compte administrateur créé ─────────────");
      console.log(`  courriel :`);
      console.log(`\n${admin.email}\n`);
      if (admin.motDePasse) {
        console.log("  mot de passe (à copier tel quel, sans espace) :");
        console.log(`\n${admin.motDePasse}\n`);
        console.log("  À changer à la première connexion. Il n'est stocké que haché :");
        console.log("  ce message ne réapparaîtra pas.");
      } else {
        console.log("  mot de passe : celui de CLONE_ADMIN_PASSWORD");
      }
      console.log("  ───────────────────────────────────────────────────────────────\n");
    }
  });

  // Les holds arrivés à échéance repartent en file, comme la tâche de fond de ShipStation.
  setInterval(() => orders.libererHolds(), 15 * 60 * 1000).unref();
  // Purge des sessions expirées.
  setInterval(() => auth.menage(), 60 * 60 * 1000).unref();
  // Reprise du renvoi de suivi : un canal momentanément indisponible ne doit pas laisser un
  // client sans numéro de suivi.
  setInterval(() => channels.traiterFile({ limite: 50 }).catch(() => {}), 10 * 60 * 1000).unref();
  // Rattrapage Shopify — la synchronisation vivante (exigence B1), et le filet sous les
  // webhooks : un webhook perdu ne doit pas coûter une commande.
  const minutesSync = Number(process.env.CLONE_SHOPIFY_SYNC_MIN ?? 20);
  if (shopify.configure() && minutesSync > 0) {
    setInterval(() => shopify.rattraper({ max: 200 }).catch((e) =>
      console.error("rattrapage Shopify :", e.message)), minutesSync * 60 * 1000).unref();
    console.error(`[shopify] rattrapage toutes les ${minutesSync} min`);
  }
}

module.exports = { serveur, ROUTES, trouver };
