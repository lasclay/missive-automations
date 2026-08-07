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
const crypto = require("crypto");

const db = require("../lib/db");
const orders = require("../lib/orders");
const shipments = require("../lib/shipments");
const pickups = require("../lib/pickups");
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
/** En développement local, HSTS ferait basculer `localhost` en HTTPS et rendrait l'outil injoignable. */
const CLONE_DEV = process.env.CLONE_COOKIE_INSECURE === "1";

/**
 * `hid`, `serial` et `usb` restent autorisés à l'origine : ce sont les interfaces de la balance
 * et de la douchette, qui doivent fonctionner **sans agent local** (exigences E1/E2). Tout le
 * reste est fermé.
 */
const PERMISSIONS_POLICY = [
  "accelerometer=()", "ambient-light-sensor=()", "autoplay=()", "battery=()", "camera=()",
  "display-capture=()", "encrypted-media=()", "fullscreen=(self)", "geolocation=()",
  "gyroscope=()", "hid=(self)", "idle-detection=()", "magnetometer=()", "microphone=()",
  "midi=()", "payment=()", "picture-in-picture=()", "publickey-credentials-get=(self)",
  "screen-wake-lock=()", "serial=(self)", "usb=(self)", "xr-spatial-tracking=()",
].join(", ");
/** Derrière le proxy de Render, l'IP réelle est dans X-Forwarded-For. */
const ipDe = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
  || req.socket.remoteAddress || null;

// ---------------------------------------------------------------- utilitaires

const json = (res, code, body) => {
  const b = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(b) });
  res.end(b);
};
/**
 * Réponse mise en cache par empreinte — BUG-134.
 *
 * `/api/refs` et `/api/criteres` sont rechargés à chaque changement d'écran et ne bougent
 * qu'à la configuration : plusieurs dizaines de kilo-octets renvoyés à l'identique, dizaines
 * de fois par session. L'empreinte du corps sert d'`ETag` ; quand elle n'a pas changé, la
 * réponse tient en un 304 sans corps. `no-cache` plutôt qu'un `max-age` : le navigateur
 * revalide toujours, donc une modification de référentiel est visible tout de suite.
 */
/**
 * Le document servi, son empreinte et sa politique de sécurité — calculés une fois.
 *
 * L'ancienne version injectait un **nonce aléatoire par requête** dans le `<script>` et le
 * `<style>`. C'était correct côté sécurité, mais cela rendait le corps différent à chaque
 * appel : aucun `ETag` ne pouvait correspondre, donc aucun 304, donc 85,8 Ko retransférés à
 * chaque F5 sur un poste d'entrepôt qu'on rouvre dix fois par jour.
 *
 * Le CSP par **empreinte** (`'sha256-…'`) offre exactement la même garantie — seuls ces deux
 * blocs précis peuvent s'exécuter, tout le reste est interdit sans `'unsafe-inline'` — et
 * rend le document identique d'une requête à l'autre, donc cachable.
 *
 * L'empreinte est recalculée si le fichier change sur disque (taille + date), pour que le
 * développement ne demande pas de redémarrage.
 */
let _doc = null;
function documentIndex() {
  const chemin = path.join(PUBLIC, "index.html");
  const st = fs.statSync(chemin);
  const cle = `${st.size}:${st.mtimeMs}`;
  if (_doc && _doc.cle === cle) return _doc;

  const html = fs.readFileSync(chemin, "utf8");
  // L'empreinte porte sur le contenu **entre** les balises, exactement comme le calcule le
  // navigateur — les balises elles-mêmes n'en font pas partie.
  const empreintes = (balise) => [...html.matchAll(new RegExp(`<${balise}>([\\s\\S]*?)</${balise}>`, "g"))]
    .map((m) => `'sha256-${crypto.createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
  const scripts = empreintes("script"), styles = empreintes("style");

  // `style-src-attr 'unsafe-inline'` : les attributs `style=` de la mise en page ne sont pas
  // couverts par une empreinte, et un attribut de style ne peut pas exécuter de script.
  // `script-src-attr 'none'` interdit en revanche tout gestionnaire `onclick=` inline —
  // c'est là qu'est le vrai risque, et le code n'en contient plus aucun.
  const csp = `default-src 'none'; script-src ${scripts.join(" ")}; script-src-attr 'none'; ` +
    `style-src ${styles.join(" ")}; style-src-attr 'unsafe-inline'; ` +
    "img-src 'self' data:; connect-src 'self'; font-src 'self'; form-action 'self'; " +
    "frame-ancestors 'none'; base-uri 'none'; object-src 'none'";

  _doc = { cle, html, csp,
    etag: `W/"${crypto.createHash("sha1").update(html).digest("base64url")}"` };
  return _doc;
}

function jsonCache(req, res, body) {
  const b = JSON.stringify(body);
  const etag = `W/"${crypto.createHash("sha1").update(b).digest("base64url")}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, no-cache");
  if (req.headers["if-none-match"] === etag) { res.writeHead(304); res.end(); return null; }
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(b) });
  res.end(b);
  return null;                       // le handler a répondu lui-même
}

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

/**
 * Recherche du poste de scan — BUG-008, BUG-009.
 *
 * Trois règles, apprises de ce que ShipStation refuse et que le clone acceptait :
 *
 *   1. **Correspondance exacte** sur le numéro de commande. Une saisie partielle ouvrait
 *      silencieusement la première trouvée : « L-507 » ramenait 84 résultats et ouvrait
 *      « L-50778 ». On rend la liste, on n'en choisit jamais une à la place de l'opérateur.
 *   2. **Statut expédiable obligatoire.** Une commande déjà expédiée ou annulée est refusée,
 *      avec la date et le suivi — réexpédier un colis déjà parti est une perte sèche.
 *   3. **Aucune ambiguïté silencieuse** : plusieurs correspondances ⇒ on les liste toutes.
 */
const STATUTS_SCANNABLES = new Set(["awaiting_shipment", "on_hold"]);

/**
 * Vérification d'une ligne au poste de scan — BUG-069.
 *
 * L'avancement vivait dans une `Set` en mémoire : recharger la page, ou simplement scanner
 * une autre commande puis revenir, effaçait tout sans un mot. Il est désormais porté par la
 * ligne elle-même, avec qui l'a vérifiée et quand — c'est ce qu'on veut relire le jour où
 * un client dit qu'il manquait un article.
 */
/**
 * Vérification d'articles — à l'unité, pas à la ligne.
 *
 * `qty` fixe le nombre d'unités vérifiées sur chaque ligne désignée ; omis, il vaut la
 * quantité entière (le comportement de « Tout vérifier »). `verifie: false` remet à zéro.
 * `verified_at` ne porte plus que la ligne *entièrement* vérifiée : c'est lui qui décide si
 * la commande peut partir, et une ligne à moitié comptée ne doit pas y suffire.
 */
route("POST /api/scan/verifier", async ({ req, user }) => {
  accounts.exiger(user, "orders_view");
  const b = await corps(req);
  const ids = (b.item_ids || []).map(Number).filter(Boolean);
  if (!ids.length) return { error: "aucune ligne désignée", code: 400 };
  const marque = b.verifie !== false;
  let n = 0;
  const lignes = [];
  db.tx(() => {
    for (const id of ids) {
      const it = db.one("SELECT id, quantity FROM order_items WHERE id = ?", id);
      if (!it) continue;
      const total = it.quantity || 0;
      const vise = !marque ? 0
        : b.qty === undefined ? total
        : Math.max(0, Math.min(total, Number(b.qty)));
      const complet = vise >= total && total > 0;
      db.run(`UPDATE order_items SET verified_qty = ?, verified_at = ?, verified_by = ? WHERE id = ?`,
        vise, complet ? db.maintenant() : null, complet ? user : null, id);
      lignes.push({ id, verified_qty: vise, quantity: total, complet });
      n++;
    }
  });
  return { n, verifie: marque, lignes };
});

/**
 * Vérification par scan d'un code — le geste de ShipStation (« Scan or enter a UPC to
 * continue »), impossible ici tant que le catalogue n'avait ni UPC ni chemin d'import.
 *
 * Le code est cherché sur l'UPC puis sur le SKU, parmi les seules lignes qui restent à
 * vérifier : rescanner un article déjà compté est refusé plutôt que d'incrémenter en
 * silence. Un code qui désigne plusieurs lignes prend la première non soldée — les lignes
 * sont interchangeables pour un même produit.
 */
route("POST /api/scan/article", async ({ req, user }) => {
  accounts.exiger(user, "orders_view");
  const b = await corps(req);
  const code = String(b.code || "").trim();
  if (!code || !b.order_id) return { error: "code et order_id requis", code: 400 };

  const lignes = db.all(
    `SELECT id, sku, name, upc, quantity, COALESCE(verified_qty, 0) verified_qty
       FROM order_items WHERE order_id = ? AND adjustment = 0 ORDER BY id`, Number(b.order_id));
  const eq = (a) => String(a || "").trim().toLowerCase() === code.toLowerCase();
  const candidates = lignes.filter((l) => eq(l.upc) || eq(l.sku));
  if (!candidates.length)
    return { trouve: false, motif: "inconnu",
      message: `« ${code} » ne correspond à aucun article de cette commande.` };

  const cible = candidates.find((l) => l.verified_qty < l.quantity);
  if (!cible) {
    const l = candidates[0];
    return { trouve: false, motif: "deja_complet", item: l,
      message: `${l.name} : les ${l.quantity} unité(s) sont déjà vérifiées.` };
  }
  const vise = cible.verified_qty + 1;
  const complet = vise >= cible.quantity;
  db.run(`UPDATE order_items SET verified_qty = ?, verified_at = ?, verified_by = ? WHERE id = ?`,
    vise, complet ? db.maintenant() : null, complet ? user : null, cible.id);

  const restantes = lignes.reduce((s, l) =>
    s + (l.id === cible.id ? cible.quantity - vise : l.quantity - l.verified_qty), 0);
  return { trouve: true, item: { ...cible, verified_qty: vise, complet }, restantes };
});

route("GET /api/scan/lookup", ({ url, user }) => {
  accounts.exiger(user, "orders_view");
  const code = String(q(url).q || "").trim();
  if (!code) return { error: "code vide", code: 400 };

  // Correspondance exacte d'abord, insensible à la casse et aux espaces du lecteur.
  const exact = db.all(
    "SELECT id FROM orders WHERE upper(trim(order_number)) = upper(?) ORDER BY id DESC", code);
  let candidats = exact;
  if (!candidats.length) {
    // Pas de correspondance exacte : on propose, on n'ouvre pas.
    const proches = db.all(
      `SELECT id, order_number, status FROM orders
       WHERE upper(order_number) LIKE upper(?) ORDER BY order_number LIMIT 25`, `%${code}%`);
    if (!proches.length) return { trouve: false, motif: "aucune", q: code };
    return { trouve: false, motif: "ambigu", q: code, candidats: proches, total: proches.length };
  }
  if (candidats.length > 1)
    return { trouve: false, motif: "ambigu", q: code,
      candidats: candidats.map((c) => orders.parId(c.id)).map((o) =>
        ({ id: o.id, order_number: o.order_number, status: o.status })), total: candidats.length };

  const o = orders.parId(candidats[0].id);
  if (!STATUTS_SCANNABLES.has(o.status)) {
    const exp = db.one(
      `SELECT tracking_number, ship_date FROM shipments
       WHERE order_id = ? AND voided = 0 ORDER BY id DESC LIMIT 1`, o.id);
    return {
      trouve: false, motif: "non_expediable", q: code,
      order_number: o.order_number, statut: o.status,
      expediee_le: exp ? exp.ship_date : null, suivi: exp ? exp.tracking_number : null,
    };
  }
  return { trouve: true, commande: o };
});

route("POST /api/orders/release-holds", ({ user }) => {
  accounts.exiger(user, "orders_edit");
  return { liberees: orders.libererHolds() };
});

/**
 * Mise à jour en masse d'un champ (menu « Bulk Update », §2.3). Liste blanche stricte :
 * l'appelant nomme la colonne, donc rien ne doit pouvoir sortir de cet ensemble.
 */
const CHAMPS_MASSE = new Set(["ship_by_date", "deliver_by_date", "hold_until", "internal_notes",
  "customer_notes", "custom_field1", "custom_field2", "custom_field3", "shipping_account",
  "weight_g", "warehouse_id", "confirmation", "service_id", "package_id", "carrier_code",
  "picking_status", "allocation_status", "tote", "assigned_user"]);

route("POST /api/orders/bulk", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  const ids = (b.ids || []).map(Number).filter(Boolean);
  const sets = [], vals = [];
  for (const [c, v] of Object.entries(b.champs || {})) {
    if (!CHAMPS_MASSE.has(c)) continue;
    sets.push(`${c} = ?`);
    // Un champ vidé efface la valeur : c'est le comportement attendu quand on retire une
    // date limite ou un champ personnalisé sur cent commandes d'un coup.
    vals.push(v === "" || v == null ? null : (c === "weight_g" ? Number(v) : v));
  }
  if (!sets.length) return { error: "aucun champ modifiable fourni", code: 400 };
  if (!ids.length) return { error: "aucune commande sélectionnée", code: 400 };
  db.tx(() => {
    for (const id of ids)
      db.run(`UPDATE orders SET ${sets.join(", ")}, modified_at = ? WHERE id = ?`, ...vals, db.maintenant(), id);
  });
  db.journaliser("order.bulk", "order", null, { n: ids.length, champs: Object.keys(b.champs || {}) }, user);
  return { ok: true, n: ids.length };
});

/**
 * « Refresh Selected Orders » : relit la commande chez la boutique d'origine. C'est
 * l'exigence B1 — une commande reste un objet vivant, pas un import figé.
 */
route("POST /api/orders/refresh", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  const ids = (b.ids || []).map(Number).filter(Boolean);
  let rafraichies = 0; const erreurs = [];
  for (const id of ids) {
    const o = orders.parId(id);
    if (!o) continue;
    if (o.source !== "shopify" || !o.order_key) {
      erreurs.push({ id, numero: o.order_number, motif: "pas de source rejouable" });
      continue;
    }
    // `importerUne` refait l'upsert par `order_key` : c'est la même clé d'idempotence que
    // l'import initial, donc pas de doublon possible (exigence B3).
    try { await shopify.importerUne(o.order_key, { appliquerRegles: false }); rafraichies++; }
    catch (e) { erreurs.push({ id, numero: o.order_number, motif: e.message }); }
  }
  return { ok: true, rafraichies, erreurs };
});

/**
 * Validation d'adresse en masse. Le statut est conservé tel quel sur la commande — jamais
 * de correction silencieuse : l'exigence OBS1 est qu'on voie ce qui a changé et pourquoi.
 */
route("POST /api/orders/validate-address", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  const r = { ok: 0, avertissements: 0, erreurs: 0 };
  for (const id of (b.ids || []).map(Number).filter(Boolean)) {
    const o = orders.parId(id);
    if (!o) continue;
    const v = orders.validerAdresse(o);
    r[v.statut === "verified" ? "ok" : v.statut === "warning" ? "avertissements" : "erreurs"]++;
  }
  return r;
});

// ================================================================ EXPÉDITIONS

route("GET /api/shipments", ({ url }) => shipments.chercher(q(url)));

/**
 * Actions en masse sur les expéditions — BUG-050.
 *
 * L'écran Shipped de ShipStation en offre six ; le clone n'avait même pas de cases à cocher.
 * `voidlabel` reste dehors : annuler une étiquette touche l'argent et garde sa route propre,
 * une expédition à la fois.
 */
/**
 * Cueillettes transporteur — BUG-051.
 *
 * `GET /api/pickups` rendait 404. Chez Lasclay, cinq comptes ont un ramassage et c'est un
 * geste quotidien : sa perte à la bascule se paierait tous les matins.
 */
route("GET /api/pickups", ({ url, user }) => {
  accounts.exiger(user, "shipments_view");
  const p = q(url);
  return { comptes: pickups.COMPTES, statuts: pickups.STATUTS,
    pickups: pickups.lister({ depuis: p.depuis || null, jusqua: p.jusqua || null, statut: p.statut || null }) };
});

route("POST /api/pickups", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  return pickups.programmer(await corps(req), user);
});

route("POST /api/pickups/:id", async ({ req, params, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return pickups.majStatut(Number(params.id), b.statut, b, user);
});

route("GET /api/shipments/actions", ({ user }) => {
  accounts.exiger(user, "shipments_view");
  return { actions: Object.entries(shipments.ACTIONS_MASSE)
    .map(([cle, a]) => ({ cle, libelle: a.libelle })) };
});

route("POST /api/shipments/action", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  return shipments.actionMasse(b.action, (b.ids || []).map(Number), b.options || {}, user);
});

/**
 * Calculatrice de tarifs — l'onglet « Rates » de ShipStation. Cote un envoi hypothétique,
 * sans commande : c'est l'outil qu'on ouvre pour répondre à « combien ça coûterait ».
 */
route("POST /api/rates", async ({ req }) => {
  const b = await corps(req);
  const entrepot = b.warehouse_id
    ? db.one("SELECT * FROM warehouses WHERE id = ?", Number(b.warehouse_id))
    : db.one("SELECT * FROM warehouses ORDER BY is_default DESC, id LIMIT 1");
  const envoi = {
    from: entrepot ? db.parse(entrepot.origin_address, {}) : {},
    // `residential` était codé en dur à vrai côté serveur alors que la case n'existait pas
    // à l'écran : le tarif résidentiel s'appliquait à une livraison commerciale sans qu'on
    // puisse le dire. La case existe maintenant, et sa valeur est respectée.
    to: { postalCode: b.postal || "", country: b.country || "CA", state: b.state || null,
          city: b.city || null, residential: b.residential === true },
    parcel: { weightG: Number(b.weight_g) || 0, lengthIn: Number(b.length) || 9,
              widthIn: Number(b.width) || 6, heightIn: Number(b.height) || 1,
              packageId: b.package_id || null },
    confirmation: b.confirmation || null,
    value: Number(b.value) || 0, currency: "CAD",
  };
  // Un poids nul donnait un tarif sans un mot. Une cotation sur rien n'est pas une cotation.
  if (!envoi.parcel.weightG) return { error: "poids requis pour coter un envoi", code: 400 };
  const tarifs = await adaptateur().quote(envoi);
  return { envoi, tarifs, recommande: require("../lib/carrier").choisirTarif(tarifs, envoi) };
});
route("GET /api/batches/:id/orders", ({ params }) => ({
  orders: orders.chercher({ batch_id: Number(params.id), limit: 1000 }).orders,
}));
/**
 * Cotation. Une commande sans poids n'est pas une panne du serveur : c'est une commande
 * incomplète. Elle répond donc 400 avec un message que l'utilisateur peut suivre, jamais
 * une 500 anonyme — c'est précisément le défaut relevé en OBS1.
 */
route("POST /api/shipments/quote", async ({ req }) => {
  const b = await corps(req);
  // `complet` : attendre que TOUS les services aient répondu, au lieu de rendre au bout du
  // délai interactif. C'est le geste « Attendre la réponse complète » de l'écran, réservé au
  // moment où l'on soupçonne qu'un transporteur moins cher manque à l'appel.
  try {
    return await shipments.coter(Number(b.order_id), {
      fournisseur: b.fournisseur || null, complet: !!b.complet,
      // `assurance` : montant demandé explicitement pour CETTE cotation, sans toucher à la
      // commande. C'est le bouton « Assurance » de l'écran d'expédition.
      assurance: b.assurance === undefined || b.assurance === null ? null : Number(b.assurance),
    });
  }
  catch (e) { return { error: e.message, code: 400 }; }
});

route("POST /api/shipments/buy", async ({ req, user }) => {
  accounts.exiger(user, "labels_buy");
  if (!ETIQUETTES) return { error: "achat d'étiquettes désactivé — lancer avec CLONE_ALLOW_LABELS=1", code: 403 };
  const b = await corps(req);
  // Le fournisseur choisi à l'écran voyage avec l'achat : sans lui, un tarif Chit Chats
  // partait acheter chez Freightcom.
  return await shipments.acheterEtiquette(Number(b.order_id),
    { serviceId: b.service_id, fournisseur: b.fournisseur || null, userId: user });
});
route("POST /api/shipments/return", async ({ req, user }) => {
  accounts.exiger(user, "labels_buy");
  if (!ETIQUETTES) return { error: "achat d'étiquettes désactivé — lancer avec CLONE_ALLOW_LABELS=1", code: 403 };
  const b = await corps(req);
  return await shipments.acheterRetour(Number(b.order_id),
    { serviceId: b.service_id, fournisseur: b.fournisseur || null, userId: user });
});
route("POST /api/shipments/void", async ({ req, user }) => {
  accounts.exiger(user, "labels_void");
  const b = await corps(req);
  return await shipments.annuler(Number(b.shipment_id), user);
});
route("POST /api/shipments/mark-shipped", async ({ req, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  // Les deux écrans qui appellent cette route envoient `order_id` (une commande à la fois),
  // pas `ids` : la boucle ne trouvait rien, la route répondait `ok` et rien n'était marqué.
  // On accepte les deux formes, et les deux graphies des champs — la grille poste
  // `carrier_code`/`tracking_number`, l'adaptateur attend `carrier`/`trackingNumber`.
  const cibles = (b.ids && b.ids.length ? b.ids : [b.order_id]).filter((v) => v != null);
  if (!cibles.length) throw new Error("aucune commande à marquer");
  const champs = {
    carrier: b.carrier ?? b.carrier_code ?? null,
    trackingNumber: b.trackingNumber ?? b.tracking_number ?? null,
    shipDate: b.shipDate ?? b.ship_date ?? null,
    notifier: b.notifier !== false,
  };
  const r = cibles.map((id) => shipments.marquerExpedie(Number(id), { ...champs, userId: user }));
  return { ok: true, n: r.length, shipments: r.map((x) => x.shipmentId) };
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
    fournisseur: b.fournisseur || null,
    margeMax: b.marge_max === "" || b.marge_max === undefined || b.marge_max === null ? null : Number(b.marge_max) });
});
route("POST /api/batches/:id/close", ({ params, user }) => {
  accounts.exiger(user, "orders_edit");
  return shipments.fermerLot(Number(params.id), user && user.id);
});
route("GET /api/batches/:id", ({ params }) => shipments.lot(Number(params.id)));

/**
 * Renommer un lot ou lui poser une note. La note est une consigne d'atelier partagée —
 * ShipStation la met en tête de l'écran du lot, à côté de son nom.
 */
route("POST /api/batches/:id/update", async ({ req, params, user }) => {
  accounts.exiger(user, "orders_edit");
  const b = await corps(req);
  const id = Number(params.id);
  const sets = [], vals = [];
  if (b.name !== undefined) { sets.push("name = ?"); vals.push(String(b.name).trim() || null); }
  if (b.notes !== undefined) { sets.push("notes = ?"); vals.push(String(b.notes).trim() || null); }
  if (b.assigned_to !== undefined) { sets.push("created_by = ?"); vals.push(b.assigned_to || null); }
  if (!sets.length) return { error: "rien à modifier", code: 400 };
  db.run(`UPDATE batches SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  db.journaliser("batch.update", "batch", id, b, user);
  return { ok: true };
});

/**
 * « Cancel Batch » : retire toutes les commandes du lot puis supprime le lot — la
 * définition exacte de ShipStation. Les commandes retournent à leur statut, intactes.
 */
route("POST /api/batches/:id/cancel", ({ params, user }) => {
  accounts.exiger(user, "orders_edit");
  const id = Number(params.id);
  const n = db.one("SELECT COUNT(*) n FROM orders WHERE batch_id = ?", id).n;
  db.tx(() => {
    db.run("UPDATE orders SET batch_id = NULL WHERE batch_id = ?", id);
    db.run("DELETE FROM batches WHERE id = ?", id);
  });
  db.journaliser("batch.cancel", "batch", id, { commandes_liberees: n }, user);
  return { ok: true, liberees: n };
});
route("POST /api/batches", async ({ req, user }) => {
  accounts.exiger(user, "labels_buy");
  if (!ETIQUETTES) return { error: "achat d'étiquettes désactivé — lancer avec CLONE_ALLOW_LABELS=1", code: 403 };
  const b = await corps(req);
  const ids = (b.ids || []).map(Number);
  const { batchId } = shipments.creerLot(ids, { name: b.name, userId: user });
  return await shipments.traiterLot(batchId, ids, { userId: user, serviceId: b.service_id,
    fournisseur: b.fournisseur || null,
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
        service: recommande.service, serviceId: recommande.serviceId,
        serviceName: recommande.serviceName || recommande.service,
        carrier: recommande.carrier || c.carrier_code || null,
        prix: recommande.price, frais: Number(recommande.otherCost || recommande.surcharges || 0),
        dropOff: !!recommande.dropOff });
    } catch (e) {
      lignes.push({ order_id: id, order_number: (orders.parId(id) || {}).order_number, erreur: String(e.message) });
    }
  }
  const ok = lignes.filter((l) => !l.erreur);
  const sou = (n) => Math.round(n * 100) / 100;

  // « Cost Review » de ShipStation : une carte par compte transporteur, le détail par
  // service, et surtout la distinction entre ce que coûte l'affranchissement et ce qui est
  // réellement facturé ici. Lasclay affranchit sur son propre compte Postes Canada : le
  // coût est réel, le montant facturé par l'outil est nul. Confondre les deux, c'est la
  // plainte de facturation n°1 relevée dans l'audit (exigence A3).
  const parTransporteur = {};
  for (const l of ok) {
    const t = l.carrier || "inconnu";
    const g = parTransporteur[t] || (parTransporteur[t] = { carrier: t, services: {}, frais: 0, total: 0 });
    const s = g.services[l.serviceName] || (g.services[l.serviceName] = { nom: l.serviceName, n: 0, montant: 0 });
    s.n++; s.montant = sou(s.montant + l.prix - (l.frais || 0));
    g.frais = sou(g.frais + (l.frais || 0));
    g.total = sou(g.total + l.prix);
  }
  const cartes = Object.values(parTransporteur).map((g) => {
    // L'adaptateur rend tantôt le code (`canada_post`), tantôt le nom affiché
    // (« Canada Post ») : on accepte les deux plutôt que de rater le compte et de
    // facturer un affranchissement que le transporteur facture déjà lui-même.
    const c = db.one(
      "SELECT name, account, requires_funding FROM carriers WHERE code = ? OR name = ? COLLATE NOCASE",
      g.carrier, g.carrier);
    return { ...g, services: Object.values(g.services),
      nom: c ? c.name : g.carrier, compte: c ? c.account : null,
      // Compte propre chez le transporteur : il facture directement, l'outil ne prélève rien.
      facture_ici: c ? !!c.requires_funding : true };
  });

  return { lignes, cartes,
    total: sou(ok.reduce((s, l) => s + l.prix, 0)),
    a_facturer: sou(cartes.filter((c) => c.facture_ici).reduce((s, c) => s + c.total, 0)),
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

route("GET /api/manifests", ({ url }) => {
  const f = q(url);
  return {
    manifests: shipments.manifestes(),
    // Ce qui reste ouvert pour la date demandée : c'est ce décompte qui décide si le bouton
    // « Clôturer » a quoi que ce soit à faire, plutôt que de le laisser actif à vide.
    ouvertes: shipments.aCloturer(f.ship_date || null, f.warehouse_id ? Number(f.warehouse_id) : null),
  };
});
route("POST /api/manifests", async ({ req, user }) => {
  const b = await corps(req);
  try {
    // `carrier_code` vide = toute la journée, tous transporteurs confondus.
    return b.carrier_code
      ? shipments.creerManifeste(b.carrier_code, { shipDate: b.ship_date, warehouseId: b.warehouse_id, userId: user })
      : shipments.cloturerJournee(b.ship_date, { warehouseId: b.warehouse_id, userId: user });
  } catch (e) { return { error: e.message, code: 400 }; }
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

/**
 * État de la réconciliation des montants (BUG-016) — combien de commandes affichent un
 * total qui contredit leurs lignes, et pour quel écart cumulé. Sert à décider s'il faut
 * relancer un rattrapage, et à mesurer ce qu'il a réparé.
 */
route("GET /api/orders/reconciliation", ({ url, user }) => {
  accounts.exiger(user, "orders_view");
  return orders.reconciliation({ limite: Math.min(Number(q(url).limite) || 100, 1000) });
});

/**
 * Réattribution des boutiques d'origine (BUG-013).
 *
 * **À blanc par défaut** : sans `appliquer: true`, la route ne fait que compter et rendre
 * la répartition actuelle. C'est une réécriture de masse sur des commandes réelles ; elle
 * se regarde avant de se lancer, et jamais sans sauvegarde vérifiée.
 */
route("POST /api/shopify/boutiques", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  return shopify.reparerBoutiques({ appliquer: b.appliquer === true });
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
/**
 * Import de produits par CSV — le catalogue se répare enfin depuis l'interface.
 *
 * **À blanc par défaut**, comme la réattribution des boutiques : sans `appliquer: true`,
 * la route compte ce que l'import ferait et n'écrit rien. La stratégie de collision est
 * transmise telle quelle et vaut « maj » par défaut ; « ignorer » préserve les fiches déjà
 * saisies à la main.
 */
route("POST /api/products/import", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  const b = await corps(req);
  if (!b.csv || !String(b.csv).trim()) return { error: "csv requis", code: 400 };
  try {
    return catalog.importerProduits(b.csv, {
      collision: b.collision === "ignorer" ? "ignorer" : "maj",
      appliquer: b.appliquer === true,
      userId: user,
    });
  } catch (e) { return { error: e.message, code: 400 }; }
});

/**
 * Gabarit d'import — chez ShipStation c'est l'export qui sert de gabarit. Ici le gabarit
 * existe même quand le catalogue est vide, parce que c'est précisément dans ce cas qu'on
 * en a besoin : un export de zéro octet n'apprend pas quelles colonnes écrire.
 */
route("GET /api/products/template", ({ res }) => {
  const l = [catalog.COLONNES_IMPORT.join(","),
    "LAS-MIT-001,Mitaines en fibre d'asclépiade,200,49.00,6116.93,CA,A-01,Gants et mitaines en bonneterie,49.00,,7,12,2.25"];
  res.writeHead(200, { "content-type": "text/csv; charset=utf-8",
    "content-disposition": 'attachment; filename="gabarit-produits.csv"' });
  res.end("﻿" + l.join("\n") + "\n");
  return null;
});

route("POST /api/products/bulk", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  const b = await corps(req);
  try { return catalog.masseProduits(b.ids, { ...b, userId: user }); }
  catch (e) { return { error: e.message, code: 400 }; }
});

route("GET /api/preset-groups", () => ({ groups: catalog.groupes() }));
route("POST /api/preset-groups", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  try { return { id: catalog.sauverGroupe(await corps(req)) }; }
  catch (e) { return { error: e.message, collision: e.collision, code: 400 }; }
});
route("GET /api/inventory/low", () => ({ low: catalog.stockBas() }));
route("POST /api/inventory", async ({ req, user }) => {
  accounts.exiger(user, "products_edit");
  const b = await corps(req);
  catalog.poserStock(Number(b.product_id), Number(b.warehouse_id), b);
  return { ok: true };
});

// ==================================================================== CLIENTS

/**
 * Identifiants de tout un filtre — BUG-041.
 *
 * « Sélectionner les 427 commandes du filtre » ne peut pas se contenter de ce que la page a
 * chargé. Seuls les identifiants partent : c'est ce qui permet de couvrir un filtre entier
 * sans rapatrier 39 000 commandes complètes dans le navigateur. Plafonné, et le plafond est
 * annoncé plutôt que silencieux.
 */
const PLAFOND_SELECTION = 5000;
route("GET /api/orders/ids", ({ url, user }) => {
  accounts.exiger(user, "orders_view");
  const base = q(url);
  // `chercher` plafonne à 1 000 lignes par appel — c'est une bonne limite pour une grille.
  // Ici on pagine derrière, jusqu'au plafond de sélection, plutôt que de la relever.
  const ids = [];
  let total = 0;
  for (let offset = 0; offset < PLAFOND_SELECTION; offset += 1000) {
    const r = orders.chercher({ ...base, limit: 1000, offset });
    total = r.total;
    ids.push(...r.orders.map((o) => o.id));
    if (r.orders.length < 1000 || ids.length >= total) break;
  }
  return { total, ids: ids.slice(0, PLAFOND_SELECTION),
    tronque: total > PLAFOND_SELECTION ? PLAFOND_SELECTION : null };
});

route("GET /api/customers", ({ url }) => catalog.chercherClients(q(url)));

/**
 * Fiche client — BUG-065.
 *
 * L'écran Clients listait 37 158 lignes sans qu'aucune soit ouvrable : pas d'adresse, pas de
 * téléphone, pas d'historique. Le rapprochement se fait par le courriel **et** par
 * `customer_id`, parce que l'historique migré n'a pas toujours les deux.
 */
route("GET /api/customers/:id", ({ params, url, user }) => {
  accounts.exiger(user, "orders_view");
  const c = db.one("SELECT * FROM customers WHERE id = ?", Number(params.id));
  if (!c) return { error: "client inconnu", code: 404 };

  const p = q(url);
  const limite = Math.min(Number(p.limit) || 50, 200);
  const offset = Number(p.offset) || 0;
  const cond = "(o.customer_id = ? OR (o.customer_email IS NOT NULL AND lower(o.customer_email) = lower(?)))";
  const args = [c.id, c.email || ""];

  const total = db.one(`SELECT COUNT(*) n FROM orders o WHERE ${cond}`, ...args).n;
  const commandes = db.all(
    `SELECT o.id, o.order_number, o.order_date, o.status, o.order_total, s.name AS boutique,
            (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0) AS lignes
       FROM orders o LEFT JOIN stores s ON s.id = o.store_id
      WHERE ${cond} ORDER BY o.order_date DESC LIMIT ? OFFSET ?`, ...args, limite, offset);

  // Les chiffres cumulés viennent des commandes, pas du champ figé : une fiche importée
  // porte les totaux du jour de l'import, qui vieillissent en silence.
  const cumul = db.one(
    `SELECT COUNT(*) n, COALESCE(SUM(o.order_total),0) total, MIN(o.order_date) premiere,
            MAX(o.order_date) derniere
       FROM orders o WHERE ${cond} AND o.status <> 'cancelled'`, ...args);

  return {
    client: { ...c, address: db.parse(c.address, {}) },
    commandes, total,
    cumul: { commandes: cumul.n, depense: Math.round((cumul.total || 0) * 100) / 100,
      premiere: cumul.premiere, derniere: cumul.derniere },
    adresses: db.all(
      `SELECT DISTINCT json_extract(o.ship_to,'$.street1') rue,
              json_extract(o.ship_to,'$.city') ville, json_extract(o.ship_to,'$.state') province,
              json_extract(o.ship_to,'$.postalCode') cp, json_extract(o.ship_to,'$.country') pays,
              COUNT(*) n
         FROM orders o WHERE ${cond} AND json_extract(o.ship_to,'$.street1') IS NOT NULL
        GROUP BY rue, ville, cp ORDER BY n DESC LIMIT 8`, ...args),
  };
});
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
route("GET /api/criteres", ({ req, res }) => jsonCache(req, res, {
  champs: Object.entries(criteres.CHAMPS).map(([cle, c]) => ({
    cle, article: !!c.article, num: !!c.num, bool: !!c.bool, date: !!c.date, liste: !!c.liste,
    unite: c.unite || null, shipstation: c.ss || null,
  })),
  operateurs: Object.entries(criteres.OPERATEURS).map(([cle, o]) => ({
    cle, libelle: o.libelle, num: !!o.num, bool: !!o.bool, date: !!o.date, shipstation: o.ss || null,
  })),
  portees: criteres.PORTEES,
  actions: Object.keys(rules.ACTIONS),
  // Forme attendue du paramètre de chaque action (BUG-076) : l'éditeur en tire de vraies
  // listes au lieu d'un champ de JSON brut.
  formes: rules.FORME_ACTIONS,
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
  // État de chaque libellé observé : mappé, mappé sans transporteur (ramassage, partenaire),
  // service manquant, ou pas de mapping du tout. La grille et la fiche s'en servent pour
  // dire la vérité plutôt que « mappé / non mappé ».
  resolutions: presets.resolutions(),
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
  const b = await corps(req);
  // BUG-012 — une variable que le moteur ne connaît pas rend une chaîne vide **en silence**.
  // Sur un courriel qui part à un sous-traitant, cela veut dire une commande perdue. On
  // refuse l'enregistrement plutôt que de laisser le gabarit se dégrader sans bruit.
  const inconnues = [
    ...templates.variablesInconnues(b.subject || ""),
    ...templates.variablesInconnues(b.body || ""),
  ];
  if (inconnues.length && !b.forcer) return {
    error: `variable${inconnues.length > 1 ? "s" : ""} inconnue${inconnues.length > 1 ? "s" : ""} : ` +
           `${[...new Set(inconnues)].join(", ")} — elle${inconnues.length > 1 ? "s rendraient" : " rendrait"} du vide à l'envoi`,
    code: 400, variables_inconnues: [...new Set(inconnues)], racines: templates.RACINES,
  };
  return { id: templates.sauver(b) };
});

/** Contrôle d'un gabarit sans l'enregistrer — alimente le signalement en rouge de l'éditeur. */
route("POST /api/templates/verifier", async ({ req }) => {
  const b = await corps(req);
  const inconnues = [...new Set([
    ...templates.variablesInconnues(b.subject || ""),
    ...templates.variablesInconnues(b.body || ""),
  ])];
  return { ok: !inconnues.length, variables_inconnues: inconnues, racines: templates.RACINES };
});
route("DELETE /api/templates/:id", ({ params, user }) => {
  accounts.exiger(user, "settings_edit");
  templates.supprimer(Number(params.id));
  return { ok: true };
});

/** Rend un bordereau pour une ou plusieurs commandes — la sortie imprimable. */
/**
 * Document de fin de journée — le bordereau de dépôt, réimprimable.
 *
 * ShipStation garde ses formulaires sous un onglet « Previously Created End of Day Forms »
 * précisément parce qu'un bordereau s'égare : le comptoir en garde un exemplaire, le nôtre
 * finit sous une pile. Sans réimpression, la seule issue serait de reclôturer — ce qui est
 * impossible, les expéditions étant déjà rattachées au manifeste.
 */
route("GET /api/manifests/:id/document", ({ params, res }) => {
  const m = db.one("SELECT * FROM manifests WHERE id = ?", Number(params.id));
  if (!m) return { error: "manifeste inconnu", code: 404 };
  const doc = db.parse(m.document, {}) || {};
  const suivis = doc.trackingNumbers || [];
  const envois = db.all(`SELECT s.tracking_number, s.service_id, s.cost, s.drop_off, o.order_number, o.customer_name
                         FROM shipments s LEFT JOIN orders o ON o.id = s.order_id
                         WHERE s.manifest_id = ? ORDER BY s.id`, m.id);
  const marque = db.reglage("marque", accounts.MARQUE_DEFAUT);
  const transporteur = (db.one("SELECT name FROM carriers WHERE code = ?", m.carrier_code) || {}).name || m.carrier_code;
  const ech = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  texte(res, 200, `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Fin de journée ${m.id} — ${ech(transporteur)}</title><style>
  @page{size:letter;margin:14mm}
  body{font:12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111}
  h1{font-size:19px;margin:0 0 2px} .sous{color:#555;margin:0 0 14px}
  .kv{display:flex;gap:26px;margin:10px 0 16px;flex-wrap:wrap}
  .kv div{font-size:12px} .kv b{display:block;font-size:16px}
  table{width:100%;border-collapse:collapse} th{text-align:left;border-bottom:2px solid #111;padding:5px 4px;font-size:11px}
  td{padding:5px 4px;border-bottom:1px solid #ddd} .n{text-align:right}
  footer{margin-top:20px;border-top:1px solid #ddd;padding-top:8px;color:#666;font-size:11px}
</style></head><body>
  <h1>Fin de journée — ${ech(transporteur)}</h1>
  <p class="sous">${ech(marque.nom || marque.name || "")} · document n° ${m.id} ·
    expéditions du ${ech(m.ship_date)} · clôturé le ${ech(String(m.created_at || "").slice(0, 16).replace("T", " "))}</p>
  <div class="kv">
    <div>Expéditions<b>${m.shipment_count}</b></div>
    <div>Dont drop-off<b>${envois.filter((e) => e.drop_off).length}</b></div>
    <div>Coût des étiquettes<b>${envois.reduce((s, e) => s + (e.cost || 0), 0).toFixed(2)} $</b></div>
  </div>
  <table><thead><tr><th>N° de suivi</th><th>Commande</th><th>Destinataire</th><th>Service</th><th class="n">Coût</th></tr></thead>
  <tbody>${(envois.length ? envois : suivis.map((t) => ({ tracking_number: t }))).map((e) => `<tr>
    <td>${ech(e.tracking_number)}</td><td>${ech(e.order_number || "")}</td>
    <td>${ech(e.customer_name || "")}</td><td>${ech(e.service_id || "")}</td>
    <td class="n">${e.cost != null ? Number(e.cost).toFixed(2) + " $" : ""}</td></tr>`).join("")}</tbody></table>
  <footer>En drop-off, ce document sert de bordereau de dépôt : le comptoir en garde un
    exemplaire. Il se réimprime autant de fois qu'il le faut.</footer>
</body></html>`, "text/html; charset=utf-8");
  return null;
});

/**
 * Les étiquettes achetées, prêtes à imprimer.
 *
 * Cette route n'existait pas. Cinq endroits de l'interface l'ouvraient — après un achat,
 * depuis le menu d'une commande, depuis un lot — et tous tombaient sur
 * « route inconnue : GET /api/labels ». On payait l'étiquette, la commande passait à
 * « expédiée », et la seule chose qui manquait était l'étiquette elle-même.
 *
 * Deux entrées : `ids` (des commandes) ou `batch_id` (un lot entier). Une expédition annulée
 * n'est jamais rendue : réimprimer une étiquette remboursée, c'est coller au comptoir un
 * code-barres que le transporteur refusera.
 *
 * Le PDF du transporteur est affiché tel quel quand il existe. Quand il n'existe pas — envoi
 * marqué expédié à la main, ou fournisseur qui n'en rend pas — on l'écrit noir sur blanc au
 * lieu d'ouvrir une page vide : c'est la différence entre « rien à imprimer » et « quelque
 * chose s'est mal passé ».
 */
route("GET /api/labels", ({ url, res }) => {
  const p = q(url);
  const ids = String(p.ids || "").split(",").filter(Boolean).map(Number);
  const lot = p.batch_id ? Number(p.batch_id) : null;
  const envois = lot
    ? db.all(`SELECT s.*, o.order_number FROM shipments s LEFT JOIN orders o ON o.id = s.order_id
              WHERE s.batch_id = ? AND s.voided = 0 ORDER BY s.id`, lot)
    : ids.length
      ? db.all(`SELECT s.*, o.order_number FROM shipments s LEFT JOIN orders o ON o.id = s.order_id
                WHERE s.order_id IN (${ids.map(() => "?").join(",")}) AND s.voided = 0
                ORDER BY s.id`, ...ids)
      : [];

  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const page = (s) => {
    const pdf = s.label_pdf || "";
    // Une base64 est intégrée telle quelle ; une URL est chargée. Les deux formes existent
    // selon le fournisseur, et deviner à la place de l'un ou de l'autre ferait une page vide.
    const src = !pdf ? null
      : /^https?:\/\//i.test(pdf) ? pdf
      : `data:application/pdf;base64,${pdf.replace(/^data:[^,]*,/, "")}`;
    const entete = `<div class="ent"><b>${esc(s.order_number || "—")}</b>
      <span>${esc(s.carrier_code || "")} ${esc(s.service_id || "")}</span>
      <span>${s.tracking_number ? esc(s.tracking_number) : "sans numéro de suivi"}</span>
      <span>${(Number(s.cost) || 0).toFixed(2)} ${esc(s.currency || "CAD")}</span></div>`;
    if (!src) {
      return `<article class="page">${entete}
        <div class="vide"><b>Aucune étiquette à imprimer pour cette expédition.</b>
        <p>Le fournisseur n'a pas rendu de document. C'est le cas d'un envoi marqué expédié
           à la main, et celui d'un achat qui n'a pas abouti côté transporteur — auquel cas
           l'expédition est à annuler plutôt qu'à réimprimer.</p></div></article>`;
    }
    return `<article class="page">${entete}
      <embed src="${esc(src)}" type="application/pdf" class="pdf"></article>`;
  };

  texte(res, 200, `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Étiquettes</title><style>
  @page{size:4in 6in;margin:0}
  body{font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;color:#111}
  .page{page-break-after:always;padding:0}
  .ent{display:flex;gap:10px;flex-wrap:wrap;padding:6px 8px;border-bottom:1px solid #ddd;
       font-size:11px;color:#555}
  .ent b{color:#111}
  .pdf{width:100%;height:calc(100vh - 30px);border:0}
  .vide{padding:20px}
  .vide p{color:#555}
  @media print{.ent{border:0}}
</style></head><body>${envois.map(page).join("")
    || "<p style=\"padding:20px\">Aucune étiquette : ces commandes n'ont pas d'expédition non annulée.</p>"}</body></html>`,
    "text/html; charset=utf-8");
  return null;   // réponse déjà écrite
});

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
/**
 * Colonnes déclarées de chaque export. Elles garantissent un en-tête même sur un jeu vide,
 * et fixent l'ordre — un CSV dont les colonnes changent d'ordre casse tous les tableurs qui
 * s'en nourrissent.
 */
const COLONNES_EXPORT = {
  orders: ["commande", "date", "statut", "client", "courriel", "ville", "province", "pays",
    "poids_g", "total", "service_demande"],
  shipments: ["commande", "suivi", "transporteur", "service", "date", "cout", "drop_off",
    "annulee", "retour"],
  products: ["sku", "nom", "poids_g", "code_sh", "origine", "description_douane", "actif"],
  customers: ["courriel", "nom", "telephone", "commandes", "total", "premiere", "derniere"],
  batches: ["lot", "nom", "cree", "etiquettes", "cout", "statut"],
  returns: ["rma", "commande", "client", "motif", "resolution", "statut", "demande", "clos"],
  manifests: ["manifeste", "transporteur", "date", "expeditions", "statut"],
  "shipping-cost": ["commande", "date_commande", "date_envoi", "transporteur", "service",
    "poids_g", "cout_reel", "frais_encaisses", "ecart", "drop_off", "pays"],
  "order-items": ["commande", "date", "sku", "article", "qte", "prix", "poids_g", "statut"],
  audit: ["quand", "qui", "action", "objet", "reference", "detail"],
};

/**
 * Plafonds d'export — relevés à la volumétrie réelle du compte.
 *
 * L'ancien plafond de 1 000 lignes rendait l'export de commandes inutilisable : 1 000 sur
 * 28 566, soit 3,5 % des données, dans un fichier de taille plausible. Le plafond est
 * maintenant au-dessus de l'historique complet (38 852 commandes, 77 000 lignes d'article,
 * 34 000 expéditions), et il reste annoncé s'il est atteint — un export tronqué qui ne le
 * dit pas est pire qu'un export refusé.
 */
const PLAFOND_EXPORT_DEFAUT = 60000;
const PLAFONDS_EXPORT = { "order-items": 150000, "shipping-cost": 60000, audit: 60000 };

route("GET /api/export/:quoi", ({ params, url, res, user }) => {
  const f = q(url);
  const plafondDe = (quoi) => PLAFONDS_EXPORT[quoi] || PLAFOND_EXPORT_DEFAUT;

  /**
   * Les recherches plafonnent à 1 000 lignes par appel — c'est la bonne limite pour une
   * grille, pas pour un export. On pagine derrière, jusqu'au plafond d'export, plutôt que
   * de relever la limite de la grille : un export de 28 566 commandes ne doit pas rendre
   * possible une requête d'écran de 28 566 lignes.
   */
  const paginer = (chercher, cle, quoi) => {
    const out = [], plafond = plafondDe(quoi);
    for (let offset = 0; offset < plafond; offset += 1000) {
      const lot = chercher({ ...f, limit: 1000, offset })[cle];
      out.push(...lot);
      if (lot.length < 1000) break;
    }
    return out.slice(0, plafond);
  };

  const jeux = {
    orders: () => paginer(orders.chercher, "orders", "orders").map((o) => ({
      commande: o.order_number, date: o.order_date, statut: o.status, client: o.customer_name,
      courriel: o.customer_email, ville: o.ship_to.city, province: o.ship_to.state, pays: o.ship_to.country,
      poids_g: o.weight_g, total: o.order_total, service_demande: o.requested_service })),
    shipments: () => paginer(shipments.chercher, "shipments", "shipments").map((s) => ({
      commande: s.order_number, suivi: s.tracking_number, transporteur: s.carrier_code,
      service: s.service_id, date: s.ship_date, cout: s.cost, drop_off: s.drop_off ? 1 : 0,
      annulee: s.voided ? 1 : 0, retour: s.is_return ? 1 : 0 })),
    products: () => paginer(catalog.chercherProduits, "products", "products").map((p) => ({
      sku: p.sku, nom: p.name, poids_g: p.weight_g, code_sh: p.hs_code,
      origine: p.country_of_origin, description_douane: p.customs_description, actif: p.active ? 1 : 0 })),
    customers: () => paginer(catalog.chercherClients, "customers", "customers").map((c) => ({
      courriel: c.email, nom: c.name, telephone: c.phone, commandes: c.order_count,
      total: c.total_spent, premiere: c.first_order, derniere: c.last_order })),
    batches: () => shipments.lots().map((b) => ({
      lot: b.id, nom: b.name, cree: b.created_at, etiquettes: b.n, cout: b.cout, statut: b.status })),
    returns: () => paginer(catalog.chercherRetours, "returns", "returns").map((r) => ({
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
      WHERE s.voided = 0 ORDER BY s.ship_date DESC LIMIT 60000`),
    /** Journal d'audit — exportable, comme tout le reste. */
    audit: () => {
      const w = [], v = [];
      if (f.action) { w.push("a.action = ?"); v.push(f.action); }
      if (f.q) {
        const like = `%${String(f.q).toLowerCase()}%`;
        w.push(`(lower(a.entity) LIKE ? OR lower(a.entity_id) LIKE ? OR lower(a.detail) LIKE ?
                 OR lower(COALESCE(u.name,'')) LIKE ? OR lower(a.action) LIKE ?)`);
        v.push(like, like, like, like, like);
      }
      return db.all(`SELECT a.at quand, COALESCE(u.name,'Système') qui, a.action,
                            a.entity objet, a.entity_id reference, a.detail
                     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
                     ${w.length ? "WHERE " + w.join(" AND ") : ""}
                     ORDER BY a.id DESC LIMIT 60000`, ...v);
    },

    /** Détail article par article, pour les rapprochements comptables. */
    "order-items": () => db.all(`
      SELECT o.order_number commande, o.order_date date, i.sku, i.name article,
             i.quantity qte, i.unit_price prix, i.weight_g poids_g, o.status statut
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE i.adjustment = 0 ORDER BY o.order_date DESC LIMIT 150000`),
  };
  if (!jeux[params.quoi]) return { error: "export inconnu", code: 404 };

  const lignes = jeux[params.quoi]();
  // BUG-057 — un jeu vide produisait 3 octets (le seul BOM), sans ligne d'en-tête : on ne
  // distinguait pas « rien à exporter » de « l'export a échoué ». Les colonnes sont donc
  // déclarées, et l'en-tête part même quand il n'y a aucune ligne.
  const colonnes = COLONNES_EXPORT[params.quoi] || (lignes.length ? Object.keys(lignes[0]) : []);
  const csv = analytics.csv(lignes, colonnes);

  // BUG-027 — l'export était plafonné en silence à 1 000 ou 10 000 lignes. Un plafond
  // atteint est désormais annoncé dans l'en-tête HTTP **et** dans une dernière ligne du
  // fichier : un comptable qui rapproche 1 000 lignes sur 28 500 doit le savoir.
  const plafond = PLAFONDS_EXPORT[params.quoi] || PLAFOND_EXPORT_DEFAUT;
  const tronque = lignes.length >= plafond;
  const entetes = { "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${params.quoi}.csv"`,
    "Cache-Control": "no-store" };
  if (tronque) entetes["X-Export-Tronque"] = `oui; plafond=${plafond}`;
  res.writeHead(200, entetes);
  res.end("﻿" + csv +
    (tronque ? `\n# EXPORT TRONQUÉ — ${plafond} lignes maximum. Affinez les filtres pour tout obtenir.` : ""));
  db.journaliser("export.csv", "system", null, { jeu: params.quoi, lignes: lignes.length, tronque }, user);
  return null;
});

// ============================================== RÉFÉRENTIELS, RÉGLAGES, ADMIN

/**
 * Sauvegarde complète en JSON — tout ce que contient la base, sans les PDF d'étiquettes.
 * Existe pour qu'aucune donnée ne soit jamais captive de cet outil non plus.
 */
/**
 * Sauvegarde complète — BUG-011.
 *
 * L'ancienne version sérialisait toute la base dans un seul objet JSON : sur 28 500 commandes
 * et leurs lignes, le worker Render dépassait sa mémoire et se faisait tuer. Résultat mesuré :
 * 502 après 6,7 s, **application entière indisponible ~30 s**, et un `<a download>` qui
 * enregistrait silencieusement 218 Ko de page d'erreur sous le nom d'une sauvegarde.
 *
 * Ici : NDJSON, une ligne par enregistrement, lu par tranches de 1 000 et écrit avec
 * contre-pression — la mémoire reste bornée quelle que soit la taille de la base. Le flux
 * s'ouvre par un manifeste et se ferme par un marqueur `fin` : un fichier tronqué est donc
 * détectable à la relecture, au lieu de passer pour complet.
 */
const TABLES_HORS_SAUVEGARDE = new Set(["sessions", "login_attempts"]);

/** Colonnes retirées de la sauvegarde : secrets, et pièces jointes volumineuses. */
const CHAMPS_EXCLUS = {
  users: ["password_hash", "totp_secret", "recovery_codes"],
  shipments: ["label_pdf", "customs_pdf"],
};

route("GET /api/backup", async ({ res, user }) => {
  accounts.exiger(user, "settings_edit");
  const tables = db.all(`SELECT name FROM sqlite_master WHERE type='table'
                         AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .map((t) => t.name).filter((t) => !TABLES_HORS_SAUVEGARDE.has(t));

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Content-Disposition": `attachment; filename="sauvegarde-${new Date().toISOString().slice(0, 10)}.ndjson"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  const ecrire = (o) => new Promise((resoudre) => {
    // `write` rend false quand le tampon du noyau est plein : on attend le drain plutôt que
    // d'empiler en mémoire. C'est toute la différence entre un flux et une bombe mémoire.
    if (res.write(JSON.stringify(o) + "\n")) return resoudre();
    res.once("drain", resoudre);
  });

  let total = 0;
  try {
    await ecrire({ __meta: "debut", version: 1, genere_le: db.maintenant(), tables });
    for (const table of tables) {
      const exclus = CHAMPS_EXCLUS[table] || [];
      // Pagination par rowid : stable, indexée, et valable même sans colonne `id`.
      let dernier = 0, lot;
      do {
        lot = db.all(`SELECT rowid AS __rowid, * FROM ${table} WHERE rowid > ? ORDER BY rowid LIMIT 1000`, dernier);
        for (const ligne of lot) {
          dernier = ligne.__rowid;
          const propre = { ...ligne };
          delete propre.__rowid;
          for (const c of exclus) delete propre[c];
          await ecrire({ __t: table, ...propre });
          total++;
        }
      } while (lot.length === 1000);
    }
    await ecrire({ __meta: "fin", enregistrements: total });
    db.journaliser("backup.export", "system", null, { tables: tables.length, enregistrements: total }, user);
  } catch (e) {
    // Le fichier est déjà parti en partie : on marque l'échec dans le flux lui-même, pour que
    // la relecture le refuse au lieu de le prendre pour une sauvegarde valide.
    console.error("[backup]", e);
    try { await ecrire({ __meta: "erreur", message: String(e.message || e), enregistrements: total }); } catch {}
  }
  res.end();
  return null;
});

/**
 * Relecture d'une sauvegarde : contrôle d'intégrité sans rien écrire. C'est le pendant
 * indispensable de la route ci-dessus — une sauvegarde qu'on n'a jamais relue n'est pas
 * une sauvegarde.
 */
route("POST /api/backup/verifier", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const brut = await corpsBrut(req);
  const lignes = brut.split("\n").filter((l) => l.trim());
  if (!lignes.length) return { error: "fichier vide", code: 400 };
  let debut = null, fin = null, erreur = null, n = 0;
  const parTable = {};
  for (const [i, l] of lignes.entries()) {
    let o;
    try { o = JSON.parse(l); }
    catch { return { error: `ligne ${i + 1} illisible — fichier corrompu`, code: 400 }; }
    if (o.__meta === "debut") { debut = o; continue; }
    if (o.__meta === "fin") { fin = o; continue; }
    if (o.__meta === "erreur") { erreur = o; continue; }
    parTable[o.__t] = (parTable[o.__t] || 0) + 1;
    n++;
  }
  return {
    valide: !!debut && !!fin && !erreur && fin.enregistrements === n,
    debut, fin, erreur, enregistrements: n, par_table: parTable,
    motif: !debut ? "manifeste d'ouverture absent"
      : erreur ? `la sauvegarde s'est interrompue : ${erreur.message}`
      : !fin ? "marqueur de fin absent — fichier tronqué, ne pas conserver"
      : fin.enregistrements !== n ? `compte incohérent : ${fin.enregistrements} annoncés, ${n} lus`
      : null,
  };
});

route("GET /api/refs", ({ req, res }) => jsonCache(req, res, {
  stores: db.all("SELECT * FROM stores ORDER BY name"),
  warehouses: db.all("SELECT * FROM warehouses ORDER BY name").map((w) => ({ ...w, origin_address: db.parse(w.origin_address, {}) })),
  carriers: db.all("SELECT * FROM carriers ORDER BY name"),
  tags: db.all("SELECT * FROM tags ORDER BY name"),
  users: accounts.utilisateurs(),
  statuts: orders.STATUTS,
  // Deux jeux de `services` et de `packages` coexistaient dans cet objet ; le second
  // écrasait le premier en silence, et deux requêtes SQL tournaient pour rien à chaque
  // chargement d'écran. Ce sont ces deux-là qui étaient effectivement servis.
  services: db.all("SELECT * FROM services WHERE hidden IS NULL OR hidden = 0 ORDER BY CASE WHEN source = 'shipstation' THEN 1 ELSE 0 END, carrier_code, name"),
  packages: db.all("SELECT * FROM packages ORDER BY custom DESC, name").map((p) => ({ ...p, dimensions: db.parse(p.dimensions) })),
  presets: presets.presets(),
  confirmations: lasclay.CONFIRMATIONS,
  // Volumétrie des référentiels : c'est ce qui permet à l'écran de griser une action qui
  // n'aurait rien sur quoi s'appliquer, plutôt que de la proposer et de ne rien faire.
  produits_n: db.one("SELECT COUNT(*) n FROM products").n,
  groupes_n: db.one("SELECT COUNT(*) n FROM preset_groups").n,
}));

route("GET /api/settings", () => ({
  marque: db.reglage("marque", accounts.MARQUE_DEFAUT),
  tarif_dropoff_cible: db.reglage("tarif_dropoff_cible", 6.31),
  derniere_migration: db.reglage("derniere_migration", null),
  assurance_active: String(db.reglage("assurance_active", "0")) !== "0",
  assurance_defaut: Number(db.reglage("assurance_defaut", 100)) || 0,
  assurance_seuil: Number(db.reglage("assurance_seuil", 300)) || 0,
  seuil_dropoff_g: SEUIL_DROPOFF_G,
}));
/**
 * Réglages modifiables depuis l'interface — liste blanche.
 *
 * `settings` sert aussi de mémoire au service : `config_lasclay`,
 * `shopify_dernier_import`, `derniere_migration` y sont écrits par les traitements. Les
 * exposer à un formulaire, c'est offrir de rejouer un import complet en écrasant un
 * curseur. La liste ci-dessous ne contient que ce qui relève d'un choix humain.
 */
/** Une adresse, pas un domaine : `lasclay.myshopify.com` ne reçoit aucun courriel. */
const COURRIEL_VALIDE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

const REGLAGES_MODIFIABLES = new Set([
  "exiger_2fa", "marque", "bascule_canaux", "tarif_dropoff_cible", "seuil_alerte_marge",
  "unite_poids", "unite_dimension", "locale", "format_date", "format_heure", "devise",
  "confirmation_defaut", "service_defaut", "entrepot_defaut",
  "seuil_timbre_g", "seuil_bombes_ca", "seuil_bombes_intl", "exercice_debut",
  // Règle d'assurance par défaut : elle remplace celle que ShipStation appliquait par
  // XCover, et elle engage de l'argent réel à chaque étiquette. Modifiable, donc, sans
  // passer par une variable d'environnement ni un déploiement.
  "assurance_active", "assurance_defaut", "assurance_seuil",
  "colonnes_commandes", "columns",
]);

route("POST /api/settings", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);

  const refuses = Object.keys(b).filter((k) => !REGLAGES_MODIFIABLES.has(k));
  if (refuses.length)
    return { error: `réglage non modifiable depuis l'interface : ${refuses.join(", ")}`, code: 400 };

  // BUG-023, troisième volet. Imposer le second facteur à des comptes qui ne peuvent pas
  // s'enrôler, c'est les mettre dehors : un compte sans adresse valide ne reçoit ni code de
  // secours ni consigne. On refuse d'armer l'exigence tant qu'ils n'ont pas été corrigés.
  if (b.exiger_2fa === true) {
    const invalides = db.all("SELECT id, name, email FROM users WHERE active = 1")
      .filter((u) => !COURRIEL_VALIDE.test(String(u.email || "")));
    if (invalides.length)
      return { code: 422, error: "Corriger d'abord ces comptes : sans courriel valide, ils ne " +
        "pourront pas s'enrôler au second facteur et perdront leur accès.",
        comptes: invalides.map((u) => `${u.name} <${u.email || "sans courriel"}>`) };
  }

  for (const [k, v] of Object.entries(b)) db.poserReglage(k, v);
  db.journaliser("settings.update", "system", null, { cles: Object.keys(b) }, user && user.id);
  return { ok: true };
});

// ------------------------------------------------------------------ logos de boutique

/**
 * Logo d'une boutique.
 *
 * Deux entrées, une seule sortie : que l'image soit déposée depuis l'ordinateur ou pointée
 * par une URL, elle finit rangée en URI de données dans la base. L'URL ne sert qu'ici, une
 * fois — la page, elle, n'appelle jamais l'extérieur.
 */
route("POST /api/images/fetch", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  if (!b.url) return { error: "url requise", code: 400 };
  try { return await require("../lib/images").rapatrier(b.url); }
  catch (e) { return { error: e.message, code: 400 }; }
});

route("POST /api/stores/:id/logo", async ({ req, params, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  const boutique = db.one("SELECT id, name FROM stores WHERE id = ?", params.id);
  if (!boutique) return { error: "boutique inconnue", code: 404 };
  try {
    const v = require("../lib/images").validerDataUri(b.data_uri);
    db.run("UPDATE stores SET logo = ? WHERE id = ?", v.data_uri, params.id);
    db.journaliser("store.logo", "store", params.id,
      { nom: boutique.name, type: v.type, octets: v.octets }, user && user.id);
    return { ok: true, octets: v.octets, type: v.type };
  } catch (e) { return { error: e.message, code: 400 }; }
});

route("DELETE /api/stores/:id/logo", ({ params, user }) => {
  accounts.exiger(user, "settings_edit");
  db.run("UPDATE stores SET logo = NULL WHERE id = ?", params.id);
  db.journaliser("store.logo.remove", "store", params.id, {}, user && user.id);
  return { ok: true };
});

// ------------------------------------------------------------------ transporteur Freightcom

/**
 * Les fournisseurs d'étiquettes joignables — le premier menu de l'écran d'expédition.
 *
 * Aucun fournisseur n'est écrit en dur côté navigateur : ajouter un adaptateur dans
 * `lib/carrier.js` suffit à le faire apparaître. C'est ce qui permettra de brancher les
 * comptes transporteur propres de Lasclay sans retoucher l'interface.
 */
route("GET /api/carriers/adapters", () => ({ fournisseurs: require("../lib/carrier").fournisseurs() }));

route("GET /api/carriers/chitchats", ({ user }) => {
  accounts.exiger(user, "settings_edit");
  return require("../lib/chitchats").etat();
});
route("POST /api/carriers/chitchats/test", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  return await require("../lib/chitchats").tester();
});
/** Supprime les brouillons de cotation jamais achetés — voir lib/chitchats.js. */
route("POST /api/carriers/chitchats/menage", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  try { return await require("../lib/chitchats").menage(); }
  catch (e) { return { error: e.message, code: 400 }; }
});

route("GET /api/carriers/freightcom", ({ user }) => {
  accounts.exiger(user, "settings_edit");
  return require("../lib/freightcom").etat();
});

route("POST /api/carriers/freightcom/test", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  return await require("../lib/freightcom").tester();
});

/**
 * Verse le panel réel de Freightcom dans le référentiel des services.
 *
 * Sans ça, la liste déroulante « Service » d'un envoi n'offre que les 97 libellés migrés
 * depuis ShipStation — dont aucun n'est achetable ici, parce que leurs identifiants n'ont de
 * sens que chez ShipStation. Proposer un choix qui échouera à l'achat est pire que ne rien
 * proposer : l'erreur se découvre au moment de payer.
 */
route("POST /api/carriers/freightcom/services", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  try { return await require("../lib/freightcom").synchroniserServices(); }
  catch (e) { return { error: e.message, code: 400 }; }
});

// ------------------------------------------------------- transporteur Postes Canada

/**
 * Branchement du compte Postes Canada.
 *
 * ShipStation fait ça dans une fenêtre contextuelle — le DRC de Postes Canada, réservé aux
 * plateformes multi-marchands enregistrées. Un marchand unique passe par sa propre clé
 * d'API : c'est ce formulaire. Voir POSTESCANADA.md pour l'obtenir.
 *
 * Trois routes, trois niveaux de risque, et c'est délibéré : lire l'état ne coûte rien,
 * enregistrer touche un secret, tester sort sur le réseau mais **en lecture seule** — une
 * cotation, jamais un achat. Aucune de ces routes ne peut créer d'étiquette.
 */
route("GET /api/carriers/postescanada", ({ user }) => {
  accounts.exiger(user, "settings_edit");
  return require("../lib/postescanada").etat();
});

route("POST /api/carriers/postescanada", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  const b = await corps(req);
  // Le milieu de production achète pour de vrai : il ne s'arme pas par inadvertance.
  if (b.env && String(b.env).startsWith("prod") && b.confirme !== true)
    return { error: "passer en production exige une confirmation explicite", code: 400 };
  return require("../lib/postescanada").enregistrer(b, user && user.id);
});

route("POST /api/carriers/postescanada/test", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  return await require("../lib/postescanada").tester();
});

route("POST /api/carriers/postescanada/forget", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  return require("../lib/postescanada").oublier(user && user.id);
});

route("GET /api/users", ({ user }) => {
  accounts.exiger(user, "users_manage");
  return {
    users: accounts.utilisateurs().map((u) => ({
      ...u, password_hash: undefined, totp_secret: undefined, recovery_codes: undefined,
      totp_enabled: !!u.totp_enabled,
    })),
    domaines: accounts.DOMAINES, roles: Object.keys(accounts.ROLES),
    // Les cases que chaque rôle pré-remplit : l'écran doit pouvoir les recocher sans
    // redemander au serveur à chaque changement de rôle dans une liste déroulante.
    modeles: accounts.ROLES,
  };
});
/**
 * Création et modification d'un compte — BUG-039.
 *
 * L'audit a trouvé un compte administrateur dont le courriel était `lasclay.myshopify.com`,
 * c'est-à-dire un domaine de boutique et non une adresse : aucun courriel de réinitialisation
 * ne pourrait lui parvenir. Et deux comptes nommés « Administrateur », ce qui rend tous les
 * menus d'assignation ambigus — on ne sait pas à qui on assigne.
 */
route("POST /api/users", async ({ req, user }) => {
  accounts.exiger(user, "users_manage");
  const b = await corps(req);

  if (b.email !== undefined) {
    const e = String(b.email || "").trim();
    if (!COURRIEL_VALIDE.test(e)) return {
      error: `« ${e} » n'est pas une adresse de courriel — un compte sans adresse joignable ne ` +
             "peut ni recevoir de réinitialisation, ni être identifié dans le journal",
      code: 400 };
    const pris = db.one("SELECT id, name FROM users WHERE lower(email) = lower(?) AND id <> ?", e, b.id || "");
    if (pris) return { error: `cette adresse est déjà celle de « ${pris.name} »`, code: 400 };
  }
  if (b.name !== undefined) {
    const n = String(b.name || "").trim();
    if (n.length < 2) return { error: "le nom doit faire au moins deux caractères", code: 400 };
    const homonyme = db.one("SELECT id, email FROM users WHERE lower(name) = lower(?) AND id <> ?", n, b.id || "");
    if (homonyme) return {
      error: `« ${n} » est déjà le nom de ${homonyme.email} — deux comptes homonymes rendent ` +
             "les menus d'assignation impossibles à lire",
      code: 400 };
  }

  // Un service dont plus personne ne gère les comptes ne se répare que par la ligne de
  // commande. On refuse le dernier retrait de `users_manage` — et on refuse aussi qu'un
  // administrateur se le retire à lui-même, qui est la façon la plus courante d'y arriver.
  if (b.id && b.permissions && b.permissions.users_manage !== true) {
    const restants = db.all("SELECT id, permissions FROM users WHERE active = 1 AND id <> ?", b.id)
      .filter((u) => db.parse(u.permissions, {}).users_manage === true).length;
    if (!restants) return {
      error: "ce compte est le dernier à pouvoir gérer les utilisateurs — lui retirer ce " +
             "droit fermerait l'administration à tout le monde", code: 409 };
    if (b.id === user) return {
      error: "on ne se retire pas soi-même la gestion des comptes : demander à un autre " +
             "administrateur de le faire", code: 409 };
  }

  if (b.id) { accounts.majUtilisateur(b.id, b); return { id: b.id }; }
  // Création d'un employé : compte avec mot de passe provisoire à transmettre de vive voix.
  return auth.creerCompte(b);
});

/**
 * Contrôle d'hygiène des comptes : ce que l'audit a trouvé, exposé en permanence pour que
 * ça ne se reforme pas.
 */
route("GET /api/users/hygiene", ({ user }) => {
  accounts.exiger(user, "users_manage");
  const tous = db.all("SELECT id, name, email, active, totp_enabled FROM users");
  return {
    courriels_invalides: tous.filter((u) => !COURRIEL_VALIDE.test(String(u.email || ""))),
    homonymes: Object.values(tous.reduce((a, u) => {
      const k = String(u.name || "").toLowerCase();
      (a[k] = a[k] || []).push(u); return a;
    }, {})).filter((g) => g.length > 1),
    sans_second_facteur: tous.filter((u) => u.active && !u.totp_enabled),
    exiger_2fa: !!db.reglage("exiger_2fa", false),
  };
});

route("GET /api/webhooks", () => ({ webhooks: accounts.abonnements(), evenements: accounts.EVENEMENTS }));
route("POST /api/webhooks", async ({ req, user }) => {
  accounts.exiger(user, "settings_edit");
  return { id: accounts.abonner(await corps(req)) };
});
/**
 * Journal de livraison et redélivrance — exigences G1 à G3.
 *
 * ShipStation n'offre aucune garantie : « do not assume you will receive every webhook », et
 * rien dans son interface ne dit ce qui est parti ni ce qui a échoué. Ici chaque tentative
 * est visible et rejouable à la main.
 */
route("GET /api/webhooks/livraisons", ({ url, user }) => {
  accounts.exiger(user, "settings_edit");
  const p = q(url);
  return { livraisons: accounts.livraisons({
    webhook_id: p.webhook_id ? Number(p.webhook_id) : null,
    limite: Math.min(Number(p.limite) || 100, 500) }) };
});

route("POST /api/webhooks/redelivrer", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  return { rejouees: await accounts.redelivrer({ limite: 100 }) };
});

/** Le secret d'un abonnement, pour que l'intégrateur puisse vérifier nos signatures. */
route("POST /api/webhooks/:id/secret", ({ params, user }) => {
  accounts.exiger(user, "settings_edit");
  const secret = accounts.secretDe(Number(params.id));
  db.journaliser("webhook.secret_lu", "webhook", Number(params.id), {}, user);
  return { secret, entete: "X-Lasclay-Signature", format: "t=<epoch>,v1=<hmac-sha256 hex de `t.corps`>",
    fenetre_s: 300 };
});

/** Envoi d'un événement de test, pour valider une intégration avant de compter dessus. */
route("POST /api/webhooks/:id/test", async ({ params, user }) => {
  accounts.exiger(user, "settings_edit");
  const w = db.one("SELECT * FROM webhooks WHERE id = ?", Number(params.id));
  if (!w) return { error: "abonnement inconnu", code: 404 };
  const r = await accounts.emettre(w.event, {
    storeId: w.store_id,
    donnees: { test: true, message: "Événement de test émis depuis l'écran Réglages." },
  });
  return { resultats: r };
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

/**
 * « Shipment Activity » (§2.6 ⑥) : le journal horodaté et attribué d'une commande. Il
 * agrège le journal d'audit, les changements d'état, les expéditions et les notifications
 * de boutique — chaque événement porte son auteur (Système, ou l'utilisateur). ShipStation
 * n'expose ce fil nulle part ailleurs que dans la fiche ; c'est pourtant la première chose
 * qu'on lit quand un client demande « où est ma commande ».
 */
route("GET /api/orders/:id/activity", ({ params }) => {
  const id = Number(params.id);
  const o = orders.parId(id);
  if (!o) return { error: "commande inconnue", code: 404 };
  const noms = new Map(db.all("SELECT id, name FROM users").map((u) => [u.id, u.name]));
  const ev = [];
  const pousser = (le, qui, texte) => le && ev.push({ le, qui, texte });

  pousser(o.order_date, "Boutique", `Commande ${o.order_number} importée depuis ${o.source || "la boutique"}`);
  pousser(o.paid_at, "Boutique", "Paiement reçu");
  for (const a of db.all(
    "SELECT * FROM audit_log WHERE entity = 'order' AND entity_id = ? ORDER BY id", String(id))) {
    const d = db.parse(a.detail) || {};
    pousser(a.at, a.user_id ? (noms.get(a.user_id) || a.user_id) : "Système",
      `${a.action}${Object.keys(d).length ? " — " + JSON.stringify(d) : ""}`);
  }
  for (const s of db.all("SELECT * FROM shipments WHERE order_id = ? ORDER BY id", id)) {
    pousser(s.created_at, s.user_id ? (noms.get(s.user_id) || s.user_id) : "Système",
      `${s.is_return ? "Étiquette de retour" : "Étiquette"} ${s.tracking_number || "(sans suivi)"} créée — ${
        (s.cost || 0).toFixed(2)} ${s.currency || "CAD"}`);
    if (s.marketplace_notified) pousser(s.ship_date || s.created_at, "Système", "Boutique notifiée de l'expédition");
    if (s.notify_error) pousser(s.created_at, "Système", `Échec de notification : ${s.notify_error}`);
    if (s.voided) pousser(s.voided_at, "Système", `Étiquette ${s.tracking_number || ""} annulée`);
  }
  const v = (o.ship_to || {}).verification;
  if (v) pousser(v.le, "Système", `Adresse : ${v.statut}${v.motifs?.length ? " — " + v.motifs.join(", ") : ""}`);

  ev.sort((a, b) => String(b.le).localeCompare(String(a.le)));
  return { activite: ev };
});

/**
 * Déclarations de douane (§2.6 ③). Une déclaration par article, avec code SH et pays
 * d'origine. Le code SH est **obligatoire à l'international** (exigence OBS8) : la fiche
 * refuse d'enregistrer une déclaration incomplète plutôt que de laisser partir un colis
 * qui sera bloqué à la frontière.
 */
route("POST /api/orders/:id/customs", async ({ req, params, user }) => {
  accounts.exiger(user, "orders_edit");
  const id = Number(params.id);
  const o = orders.parId(id);
  if (!o) return { error: "commande inconnue", code: 404 };
  const b = await corps(req);
  const international = (o.ship_to || {}).country && o.ship_to.country !== "CA";
  const decl = (b.declarations || []).map((d) => ({
    order_item_id: d.order_item_id ?? null,
    description: String(d.description || "").trim(),
    sku: d.sku || null,
    quantity: Number(d.quantity) || 0,
    value: Number(d.value) || 0,
    hs_code: String(d.hs_code || "").trim() || null,
    country_of_origin: (d.country_of_origin || "CA").toUpperCase(),
  }));
  if (international && !b.forcer) {
    const manquants = decl.filter((d) => !d.hs_code || !d.description || !d.country_of_origin);
    if (manquants.length) return {
      error: `${manquants.length} déclaration(s) sans code SH, description ou pays d'origine — ` +
        "obligatoire pour une expédition internationale",
      code: 400, manquants: manquants.map((d) => d.sku || d.description),
    };
  }
  db.run("UPDATE orders SET customs = ?, modified_at = ? WHERE id = ?",
    db.dump({ contents: b.contents || "merchandise", non_delivery: b.non_delivery || "return_to_sender",
      duties_paid: b.duties_paid || null,
      // Port payé et identifiants d'exportateur : le bloc n'en portait que 5 des 12 champs
      // de ShipStation, et les manquants n'avaient donc aucun endroit où exister.
      postage_paid: b.postage_paid || null,
      mid_code: b.mid_code || null,
      certificate_version_id: b.certificate_version_id || null,
      certifier_id: b.certifier_id || null,
      invoice_number: b.invoice_number || null,
      export_declaration_number: b.export_declaration_number || null, declarations: decl }),
    db.maintenant(), id);
  db.journaliser("order.customs", "order", id, { n: decl.length }, user);
  return { ok: true, n: decl.length };
});

/**
 * Journal d'audit — BUG-079, BUG-080.
 *
 * L'écran promettait « qui a fait quoi » et n'affichait jamais « qui » : le journal ne
 * joignait pas la table des utilisateurs. Il n'avait par ailleurs ni filtre, ni recherche,
 * ni pagination, ni export — sur 57 757 entrées, c'était illisible.
 */
route("GET /api/audit", ({ url, user }) => {
  accounts.exiger(user, "reports_view");
  const p = q(url);
  const limite = Math.min(Number(p.limit) || 100, 500);
  const offset = Math.max(Number(p.offset) || 0, 0);
  const w = [], v = [];
  if (p.action) { w.push("a.action = ?"); v.push(p.action); }
  if (p.entity) { w.push("a.entity = ?"); v.push(p.entity); }
  if (p.q) {
    const like = `%${String(p.q).toLowerCase()}%`;
    w.push(`(lower(a.entity) LIKE ? OR lower(a.entity_id) LIKE ? OR lower(a.detail) LIKE ?
             OR lower(COALESCE(u.name,'')) LIKE ? OR lower(a.action) LIKE ?)`);
    v.push(like, like, like, like, like);
  }
  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  const total = db.one(`SELECT COUNT(*) n FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ${where}`, ...v).n;
  const rows = db.all(
    `SELECT a.*, u.name AS qui FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`, ...v, limite, offset)
    .map((r) => ({ ...r, detail: db.parse(r.detail) }));
  return {
    rows, total,
    // Les actions réellement présentes, avec leur volume : de quoi remplir le filtre sans
    // deviner le vocabulaire.
    actions: db.all("SELECT action, COUNT(*) n FROM audit_log GROUP BY action ORDER BY n DESC"),
  };
});

/**
 * Rapprochement clone ↔ ShipStation — lecture seule, à lancer aussi souvent qu'on veut.
 *
 * C'est le contrôle qui doit passer au vert avant de résilier ShipStation. Sans lui, le clone
 * affiche ses compteurs avec l'aplomb d'un chiffre complet sans qu'aucun écran ne dise s'il
 * l'est.
 */
route("GET /api/migrate/reconciliation", async ({ user }) => {
  accounts.exiger(user, "settings_edit");
  try { return await ingest.reconcilier(); }
  catch (e) { return { error: e.message, code: 400 }; }
});

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

/**
 * Configuration publique — BUG-020.
 *
 * Sans session, la réponse se limite à ce dont la page de connexion a besoin pour s'afficher.
 * L'ancienne version publiait `comptes: 2` et `exiger_2fa: false` : elle disait à un anonyme
 * qu'il n'y a que deux comptes à deviner et qu'aucun second facteur ne les protège. Elle
 * publiait aussi le domaine Shopify, l'identifiant de boutique et le volume de commandes.
 */
route("GET /api/config", ({ moi }) => {
  const publique = {
    adaptateur: adaptateur().nom,
    etiquettes_actives: ETIQUETTES,
    unite_poids: db.reglage("unite_poids", "g"),
    unite_dimension: db.reglage("unite_dimension", "in"),
  };
  if (!moi) return publique;
  return {
    ...publique,
    seuil_dropoff_g: SEUIL_DROPOFF_G,
    amorce: !!db.reglage("amorce"),
    config_lasclay: !!db.reglage("config_lasclay"),
    shopify: shopify.etat(),
    comptes: db.one("SELECT COUNT(*) n FROM users WHERE password_hash IS NOT NULL").n,
    exiger_2fa: !!db.reglage("exiger_2fa", false),
    // La règle d'assurance voyage jusqu'au navigateur : le menu de l'écran d'expédition doit
    // présélectionner ce que le serveur appliquerait, sinon l'opérateur lit « Aucune » sur
    // une commande que le lot assurerait quand même.
    assurance: {
      active: String(db.reglage("assurance_active", "0")) !== "0",
      defaut: Number(db.reglage("assurance_defaut", 100)) || 0,
      seuil: Number(db.reglage("assurance_seuil", 300)) || 0,
    },
  };
});

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

/**
 * Activation du second facteur. Si la session était en attente d'enrôlement (second facteur
 * rendu obligatoire, compte qui n'en avait pas), elle devient pleine ici — sinon l'utilisateur
 * s'enrôlerait sans jamais pouvoir entrer.
 */
route("POST /api/moi/2fa/activer", async ({ req, res, moi }) => {
  const r = auth.activer2facteur(moi.id, (await corps(req)).code);
  const jeton = auth.lireCookie(req);
  const promu = auth.promouvoirSession(jeton);
  if (promu) res.setHeader("Set-Cookie", auth.poserCookie(jeton, promu.expire));
  return { ...r, session_promue: !!promu };
});

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
/**
 * Préférences d'affichage — portée utilisateur (§6.12). Liste blanche : l'objet est
 * relu et fusionné à chaque appel, donc un champ non prévu s'y installerait pour de bon.
 */
const PREFERENCES = {
  langue: (v) => (["fr", "en"].includes(v) ? v : null),
  theme: (v) => (["clair", "sombre", "systeme"].includes(v) ? v : null),
  densite: (v) => (["compacte", "confortable", "spacieuse"].includes(v) ? v : null),
  page_size: (v) => ([100, 250, 500, 1000].includes(Number(v)) ? Number(v) : null),
  // Le mode dense fait passer la grille de 16 à 21 lignes visibles (+31 %) et n'était
  // jamais mémorisé : l'opérateur le réactivait à chaque session. Il vit avec le compte,
  // pas dans le navigateur — un poste d'emballage est partagé.
  dense: (v) => (typeof v === "boolean" ? v : null),
  // Les bandeaux fermés revenaient à chaque rechargement, soit 26 px reperdus par session.
  bandeaux_fermes: (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 20) : null),
};

route("POST /api/moi/preferences", async ({ req, moi }) => {
  const b = await corps(req);
  const p = { ...preferences(moi.id) };
  for (const [cle, valider] of Object.entries(PREFERENCES)) {
    if (!(cle in b)) continue;
    const v = valider(b[cle]);
    if (v === null) return { error: `valeur refusée pour « ${cle} »`, code: 400 };
    p[cle] = v;
  }
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

    // En-têtes de sécurité, sur toutes les réponses (BUG-021).
    // `hid`, `serial` et `usb` restent ouverts à l'origine : ce sont les API qui permettront
    // la balance et la douchette sans agent local (exigences E1/E2). Les fermer maintenant
    // reviendrait à se condamner à installer un agent plus tard.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
    if (req.headers["x-forwarded-proto"] === "https" || !CLONE_DEV)
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

    if (chemin === "/" || chemin === "/index.html") {
      const doc = documentIndex();
      res.setHeader("Content-Security-Policy", doc.csp);
      // §6.3 réserve n° 1 — sans `ETag`, `no-cache` fait retransférer les 85,8 Ko compressés
      // (312 Ko décodés) à chaque visite, **y compris pour un simple F5**. Avec, un
      // rechargement tient en un 304 sans corps.
      res.setHeader("ETag", doc.etag);
      res.setHeader("Cache-Control", "private, no-cache, must-revalidate");
      res.setHeader("Vary", "Accept-Encoding");
      if (req.headers["if-none-match"] === doc.etag) { res.writeHead(304); return res.end(); }
      return texte(res, 200, doc.html, "text/html; charset=utf-8");
    }

    const moi = utilisateurCourant(req);
    if (!PUBLIQUES.has(spec) && !moi) {
      return json(res, 401, { error: "session requise", login: true });
    }

    const trouve = trouver(req.method, chemin);
    if (!trouve) return json(res, 404, { error: `route inconnue : ${spec}` });

    const out = await trouve.fn({ req, res, url, params: trouve.params, user: moi ? moi.id : null, moi });
    if (out === null) return;                       // le handler a déjà répondu
    // Un refus peut porter plus qu'un message : la liste des comptes à corriger, celle des
    // commandes bloquantes. Tout ce que le handler a joint part avec, sinon l'écran doit
    // redemander au serveur ce qu'il vient de lui dire.
    if (out && out.error && out.code) {
      const { code, ...reste } = out;
      return json(res, code, reste);
    }
    return json(res, 200, out);
  } catch (e) {
    // Une règle métier qui refuse n'est pas une panne : « lot inconnu », « poids manquant »,
    // « le lot n'est plus ouvert » sont des 400 avec un message que l'utilisateur peut
    // suivre. Réserver la 500 aux vraies erreurs de programme, dont la trace part au
    // journal — c'est le constat OBS1 : jamais d'erreur brute non actionnable à l'écran.
    const message = String(e.message || e);
    const metier = e.code === 400 || (e instanceof Error && !(e instanceof TypeError)
      && !(e instanceof ReferenceError) && !(e instanceof SyntaxError) && !!e.message);
    const code = e.code === 403 ? 403 : e.code === 429 ? 429 : metier ? 400 : 500;
    if (code === 500) console.error(`[500] ${spec}`, e);
    else console.warn(`[${code}] ${spec} — ${message}`);
    return json(res, code, { error: message });
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
  // Redélivrance des webhooks échoués (exigence G3). Sans elle, un abonné momentanément
  // indisponible perd l'événement sans que personne ne le sache.
  setInterval(() => accounts.redelivrer({ limite: 50 }).catch(() => {}), 5 * 60 * 1000).unref();
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
