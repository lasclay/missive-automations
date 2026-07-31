/**
 * shipstation-clone/app — la grille de tri du backlog.
 *
 * C'est la raison d'être du projet : ce que ShipStation fait mieux que tout le reste, c'est
 * trier un arriéré de commandes avec des filtres, des vues sauvegardées et un Hold. Le
 * transport, lui, se sous-traite (voir ../lib/carrier.js).
 *
 * Aujourd'hui l'application LIT les commandes de ShipStation par le General Proxy. Quand
 * l'ingestion Shopify directe sera en place, seule la fonction `chargerCommandes` change.
 *
 * Aucune dépendance npm : http natif + une page unique, même patron qu'a2x-app.
 *
 * Variables :
 *   PORT                     (défaut 3100)
 *   CLONE_APP_SECRET         mot de passe de l'interface (obligatoire hors localhost)
 *   GENERAL_PROXY_URL        défaut https://general-proxy-5muf.onrender.com
 *   GENERAL_PROXY_SECRET     requis — secret d'appel du proxy
 *   CARRIER_ADAPTER          bouchon (défaut) | clickship
 *   CLONE_ALLOW_WRITES       "1" pour autoriser Hold/Restore sur le vrai ShipStation.
 *                            Par défaut DÉSACTIVÉ : l'application est en lecture seule.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { adaptateur, choisirTarif, SEUIL_DROPOFF_G } = require("../lib/carrier");

const PORT = process.env.PORT || 3100;
const SECRET = process.env.CLONE_APP_SECRET || "";
const PROXY = process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com";
const PROXY_SECRET = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET || "";
const ECRITURES = process.env.CLONE_ALLOW_WRITES === "1";
const PUBLIC = path.join(__dirname, "public");
const VUES = path.join(__dirname, "vues.json");

// ---------------------------------------------------------------- utilitaires

const json = (res, code, body) => {
  const b = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(b) });
  res.end(b);
};

const autorise = (req) => !SECRET || (req.headers["x-app-secret"] || "") === SECRET;

async function proxy(action, params) {
  const res = await fetch(`${PROXY}/shipstation/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": PROXY_SECRET },
    body: JSON.stringify(params || {}),
  });
  const txt = await res.text();
  let j; try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  if (!res.ok || j.error) throw new Error(`${action} → ${res.status} ${txt.slice(0, 200)}`);
  return j.data;
}

/** Poids en grammes, quelle que soit l'unité renvoyée. */
function grammes(w) {
  if (!w || !w.value) return 0;
  const u = (w.units || "").toLowerCase();
  if (u.startsWith("ounce")) return w.value * 28.3495;
  if (u.startsWith("pound")) return w.value * 453.592;
  return w.value;
}

// ------------------------------------------------------ cache des commandes
// ShipStation plafonne à 40 requêtes/minute. On garde le backlog en mémoire et on ne
// rafraîchit qu'à la demande ou après expiration — l'arriéré ne bouge pas à la seconde.

const cache = { commandes: [], charge: 0, enCours: null };
const TTL_MS = 5 * 60 * 1000;

async function chargerCommandes(force = false) {
  if (!force && cache.commandes.length && Date.now() - cache.charge < TTL_MS) return cache.commandes;
  if (cache.enCours) return cache.enCours;
  cache.enCours = (async () => {
    const tout = [];
    for (let page = 1; page <= 10; page++) {
      const d = await proxy("orders", { orderStatus: "awaiting_shipment", pageSize: 500, page });
      tout.push(...(d.orders || []));
      if (!d.orders || d.orders.length < 500) break;
    }
    // On ajoute aussi ce qui est en attente : c'est du backlog, pas de l'archive.
    for (const st of ["on_hold", "awaiting_payment"]) {
      const d = await proxy("orders", { orderStatus: st, pageSize: 500 });
      tout.push(...(d.orders || []));
    }
    cache.commandes = tout.map(normaliser);
    cache.charge = Date.now();
    cache.enCours = null;
    return cache.commandes;
  })();
  return cache.enCours;
}

/** Réduit la commande ShipStation à ce dont la grille a besoin. */
function normaliser(o) {
  const poids = grammes(o.weight) || o.items.reduce((s, i) => s + grammes(i.weight) * (i.quantity || 0), 0);
  const jours = o.orderDate ? Math.floor((Date.now() - new Date(o.orderDate)) / 86400000) : null;
  return {
    orderId: o.orderId,
    orderNumber: o.orderNumber,
    orderDate: o.orderDate,
    age: jours,
    statut: o.orderStatus,
    client: (o.shipTo && o.shipTo.name) || o.customerEmail || "",
    courriel: o.customerEmail,
    ville: (o.shipTo && o.shipTo.city) || "",
    province: (o.shipTo && o.shipTo.state) || "",
    pays: (o.shipTo && o.shipTo.country) || "",
    codePostal: (o.shipTo && o.shipTo.postalCode) || "",
    poidsG: Math.round(poids),
    articles: o.items.filter((i) => !i.adjustment).reduce((s, i) => s + (i.quantity || 0), 0),
    skus: o.items.filter((i) => !i.adjustment).map((i) => i.sku).filter(Boolean),
    total: o.orderTotal,
    serviceDemande: o.requestedShippingService || "",
    boutique: (o.advancedOptions && o.advancedOptions.storeId) || null,
    entrepot: (o.advancedOptions && o.advancedOptions.warehouseId) || null,
    holdJusqua: o.holdUntilDate,
    tags: o.tagIds || [],
    notes: o.customerNotes || "",
    // Le champ qui porte l'économie : sous le seuil, le drop-off est admissible.
    dropOffAdmissible: poids > 0 && poids < SEUIL_DROPOFF_G,
  };
}

// ------------------------------------------------------------------ filtrage

function filtrer(commandes, q) {
  let r = commandes;
  const s = (q.recherche || "").trim().toLowerCase();
  if (s) {
    r = r.filter((c) =>
      [c.orderNumber, c.client, c.courriel, c.ville, c.codePostal, ...c.skus]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    );
  }
  if (q.statut) r = r.filter((c) => c.statut === q.statut);
  if (q.pays) r = r.filter((c) => c.pays === q.pays);
  if (q.province) r = r.filter((c) => c.province === q.province);
  if (q.boutique) r = r.filter((c) => String(c.boutique) === String(q.boutique));
  if (q.dropOff === "oui") r = r.filter((c) => c.dropOffAdmissible);
  if (q.dropOff === "non") r = r.filter((c) => !c.dropOffAdmissible);
  if (q.poidsMin) r = r.filter((c) => c.poidsG >= Number(q.poidsMin));
  if (q.poidsMax) r = r.filter((c) => c.poidsG <= Number(q.poidsMax));
  if (q.ageMin) r = r.filter((c) => c.age !== null && c.age >= Number(q.ageMin));
  if (q.sansPoids === "1") r = r.filter((c) => !c.poidsG);

  const tri = q.tri || "age";
  const sens = q.sens === "asc" ? 1 : -1;
  r = r.slice().sort((a, b) => {
    const x = a[tri], y = b[tri];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (x > y ? 1 : -1) * sens;
  });
  return r;
}

// --------------------------------------------------------- vues sauvegardées

const lireVues = () => { try { return JSON.parse(fs.readFileSync(VUES, "utf8")); } catch { return {}; } };
const ecrireVues = (v) => fs.writeFileSync(VUES, JSON.stringify(v, null, 2));

// -------------------------------------------------------------------- routes

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chemin = url.pathname;

  try {
    // Fichiers statiques
    if (chemin === "/" || chemin === "/index.html") {
      const html = fs.readFileSync(path.join(PUBLIC, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    if (chemin === "/api/config") {
      return json(res, 200, {
        ecrituresActives: ECRITURES,
        adaptateur: adaptateur().nom,
        seuilDropOffG: SEUIL_DROPOFF_G,
        protege: !!SECRET,
      });
    }

    if (!autorise(req)) return json(res, 401, { error: "secret d'application requis" });

    if (chemin === "/api/commandes") {
      const q = Object.fromEntries(url.searchParams);
      const toutes = await chargerCommandes(q.rafraichir === "1");
      const filtrees = filtrer(toutes, q);
      const sousSeuil = filtrees.filter((c) => c.dropOffAdmissible).length;
      return json(res, 200, {
        total: toutes.length,
        filtrees: filtrees.length,
        dropOffAdmissibles: sousSeuil,
        chargeIlYaS: Math.round((Date.now() - cache.charge) / 1000),
        commandes: filtrees.slice(0, Number(q.limite) || 300),
      });
    }

    if (chemin === "/api/vues" && req.method === "GET") return json(res, 200, lireVues());

    if (chemin === "/api/vues" && req.method === "POST") {
      const body = JSON.parse(await lireCorps(req) || "{}");
      if (!body.nom) return json(res, 400, { error: "nom requis" });
      const v = lireVues();
      if (body.supprimer) delete v[body.nom]; else v[body.nom] = body.filtres || {};
      ecrireVues(v);
      return json(res, 200, v);
    }

    // Cotation — passe par l'adaptateur, donc sans frais tant qu'on est sur le bouchon.
    if (chemin === "/api/coter" && req.method === "POST") {
      const body = JSON.parse(await lireCorps(req) || "{}");
      const cmd = (await chargerCommandes()).find((c) => c.orderId === Number(body.orderId));
      if (!cmd) return json(res, 404, { error: "commande inconnue" });
      const envoi = {
        from: { postalCode: "G1J3R4", country: "CA" },
        to: { postalCode: cmd.codePostal, state: cmd.province, city: cmd.ville, country: cmd.pays, residential: true },
        parcel: { weightG: cmd.poidsG || 400, lengthIn: 9, widthIn: 6, heightIn: 1 },
        value: cmd.total,
        currency: "CAD",
      };
      const tarifs = await adaptateur().quote(envoi);
      return json(res, 200, { tarifs, recommande: choisirTarif(tarifs, envoi), envoi });
    }

    // Écritures vers le vrai ShipStation — verrouillées par défaut.
    if (chemin === "/api/hold" || chemin === "/api/restaurer") {
      if (req.method !== "POST") return json(res, 405, { error: "POST attendu" });
      if (!ECRITURES) {
        return json(res, 403, {
          error: "écritures désactivées — lancer avec CLONE_ALLOW_WRITES=1 pour agir sur le vrai ShipStation",
        });
      }
      const body = JSON.parse(await lireCorps(req) || "{}");
      const ids = Array.isArray(body.orderIds) ? body.orderIds : [body.orderId];
      const faits = [];
      for (const orderId of ids.filter(Boolean)) {
        if (chemin === "/api/hold") {
          if (!body.holdUntilDate) return json(res, 400, { error: "holdUntilDate requis (AAAA-MM-JJ)" });
          faits.push(await proxy("holduntil", { orderId, holdUntilDate: body.holdUntilDate }));
        } else {
          faits.push(await proxy("restorefromhold", { orderId }));
        }
      }
      cache.charge = 0; // le backlog a changé
      return json(res, 200, { faits: faits.length });
    }

    return json(res, 404, { error: "route inconnue" });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
});

const lireCorps = (req) =>
  new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d));
    req.on("error", reject);
  });

if (require.main === module) {
  if (!PROXY_SECRET) {
    console.error("GENERAL_PROXY_SECRET manquant — l'application ne peut pas lire les commandes.");
    process.exit(1);
  }
  serveur.listen(PORT, () => {
    console.log(`shipstation-clone/app sur http://localhost:${PORT}`);
    console.log(`  transporteur : ${adaptateur().nom}`);
    console.log(`  écritures    : ${ECRITURES ? "ACTIVES (vrai ShipStation)" : "désactivées (lecture seule)"}`);
  });
}

module.exports = { serveur, filtrer, normaliser, grammes };
