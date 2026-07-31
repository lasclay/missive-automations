/**
 * Renvoi du suivi vers les canaux de vente — Shopify, Etsy, Faire.
 *
 * C'est le vrai risque de la migration. Aujourd'hui ShipStation marque les commandes comme
 * expédiées chez le marchand et y dépose le numéro de suivi ; le client le reçoit par le
 * courriel de la boutique et le voit dans son compte. Si le clone n'assume pas ce relais,
 * les clients perdent leur suivi du jour au lendemain — et le support explose.
 *
 * Principe : chaque canal est un adaptateur avec une seule fonction, `pousser(expedition)`.
 * Les échecs ne sont jamais silencieux : ils s'enregistrent sur l'expédition
 * (`notify_error`) et repassent dans une file de reprise.
 *
 * Variables (côté serveur uniquement) :
 *   SHOPIFY_STORE + SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET   app « Render connector »
 *                                                               (SHOPIFY_ADMIN_TOKEN accepté en repli)
 *   ETSY_API_KEY, ETSY_TOKEN, ETSY_SHOP_ID
 *   FAIRE_ACCESS_TOKEN
 */
const { all, one, run, parse, dump, maintenant, journaliser, reglage, poserReglage } = require("./db");

// La version d’API vient du client partagé (a2x/lib/shopify.js) — une seule source.

/** Correspondance des transporteurs vers les noms attendus par Shopify. */
const NOM_TRANSPORTEUR = {
  canada_post: "Canada Post",
  cp_expedited_dropoff: "Canada Post",
  purolator: "Purolator",
  purolator_walleted: "Purolator",
  ups: "UPS", ups_walleted: "UPS",
  fedex: "FedEx", fedex_walleted: "FedEx",
  canpar: "Canpar", canpar_walleted: "Canpar",
  gls: "GLS",
  dhl_express: "DHL Express", dhl_express_walleted: "DHL Express",
};

const nomTransporteur = (code) => NOM_TRANSPORTEUR[code] || code || "Other";

/** URL de suivi publique, quand le transporteur en a une de forme stable. */
function urlSuivi(code, numero) {
  if (!numero) return null;
  const c = String(code || "").toLowerCase();
  if (c.includes("canada_post")) return `https://www.canadapost-postescanada.ca/track-reperage/fr#/resultats?trackingNumber=${numero}`;
  if (c.includes("purolator")) return `https://www.purolator.com/fr/shipping/tracker?pin=${numero}`;
  if (c.includes("ups")) return `https://www.ups.com/track?loc=fr_CA&tracknum=${numero}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${numero}`;
  if (c.includes("canpar")) return `https://www.canpar.com/fr/tracking/track.htm?barcode=${numero}`;
  return null;
}

// ================================================================== Shopify

/**
 * Shopify — réutilise le client du dépôt (`a2x/lib/shopify.js`), donc l'app « Render
 * connector » en *client credentials*.
 *
 * Pourquoi plutôt qu'un jeton `shpat_` propre au clone : le jeton de l'app est court (~24 h)
 * et renouvelé tout seul, il n'y a qu'une app dont gérer les portées, et aucun secret
 * permanent ne dort dans les variables du service. Les identifiants sont déjà en place pour
 * `support.js`, `shopify_check.js` et A2X — c'est le même couple
 * `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET`.
 *
 * ⚠️ Portée à AJOUTER sur l'app, puis re-release et réinstallation :
 *     write_merchant_managed_fulfillment_orders
 * Les portées actuelles sont en lecture seule ; sans celle-ci, la création de fulfillment
 * échoue avec « access denied ». Voir SHOPIFY_SETUP.md.
 *
 * L'expédition passe obligatoirement par une « fulfillment order » : l'ancien chemin direct
 * a été retiré par Shopify.
 */
const shopify = {
  nom: "shopify",

  client() {
    // Chargé à la demande : le clone doit démarrer même si le module est absent.
    return require(require("path").join(__dirname, "..", "..", "a2x", "lib", "shopify"));
  },

  configure: () => !!(process.env.SHOPIFY_STORE &&
    (process.env.SHOPIFY_ADMIN_TOKEN || (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET))),

  async pousser({ commande, expedition }) {
    const { gql } = this.client();
    // La clé externe porte l'identifiant Shopify — c'est `orderKey` chez ShipStation.
    const idShopify = String(commande.order_key || "").replace(/^ss-/, "");
    if (!/^\d+$/.test(idShopify)) throw new Error(`identifiant Shopify introuvable (order_key=${commande.order_key})`);

    const d = await gql(`
      query($id: ID!) {
        order(id: $id) {
          id
          fulfillmentOrders(first: 20) { edges { node { id status } } }
        }
      }`, { id: `gid://shopify/Order/${idShopify}` });

    if (!d.order) throw new Error(`commande ${idShopify} introuvable chez Shopify`);
    const ouvertes = (d.order.fulfillmentOrders.edges || [])
      .map((e) => e.node)
      .filter((f) => ["OPEN", "IN_PROGRESS", "SCHEDULED"].includes(f.status));
    if (!ouvertes.length) return { deja: true, message: "aucune fulfillment order ouverte — déjà expédiée côté Shopify" };

    const suivi = expedition.tracking_number || null;
    const r = await gql(`
      mutation($f: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $f) {
          fulfillment { id status trackingInfo { number company url } }
          userErrors { field message }
        }
      }`, {
      f: {
        lineItemsByFulfillmentOrder: ouvertes.map((f) => ({ fulfillmentOrderId: f.id })),
        notifyCustomer: true,
        ...(suivi ? {
          trackingInfo: {
            number: suivi,
            company: nomTransporteur(expedition.carrier_code),
            url: urlSuivi(expedition.carrier_code, suivi),
          },
        } : {}),
      },
    });

    const erreurs = r.fulfillmentCreate?.userErrors || [];
    if (erreurs.length) throw new Error(erreurs.map((e) => `${e.field}: ${e.message}`).join(" ; "));
    const f = r.fulfillmentCreate?.fulfillment;
    return { id: f?.id, statut: f?.status, suivi: f?.trackingInfo?.number || null };
  },
};

// ==================================================================== Etsy

const etsy = {
  nom: "etsy",
  configure: () => !!(process.env.ETSY_API_KEY && process.env.ETSY_TOKEN && process.env.ETSY_SHOP_ID),

  async pousser({ commande, expedition }) {
    const receipt = String(commande.order_key || "").replace(/^ss-/, "");
    if (!/^\d+$/.test(receipt)) throw new Error(`identifiant Etsy introuvable (order_key=${commande.order_key})`);
    const url = `https://openapi.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/receipts/${receipt}/tracking`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ETSY_API_KEY,
        Authorization: `Bearer ${process.env.ETSY_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        tracking_code: expedition.tracking_number || "",
        carrier_name: nomTransporteur(expedition.carrier_code),
        send_bcc: "true",
      }),
      signal: AbortSignal.timeout(30000),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`Etsy ${r.status} ${txt.slice(0, 200)}`);
    return { ok: true };
  },
};

// =================================================================== Faire

const faire = {
  nom: "faire",
  configure: () => !!process.env.FAIRE_ACCESS_TOKEN,

  async pousser({ commande, expedition }) {
    const idFaire = String(commande.order_key || "").replace(/^ss-/, "");
    const r = await fetch(`https://www.faire.com/external-api/v2/orders/${idFaire}/shipments`, {
      method: "POST",
      headers: { "X-FAIRE-ACCESS-TOKEN": process.env.FAIRE_ACCESS_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        shipments: [{
          order_id: idFaire,
          carrier: nomTransporteur(expedition.carrier_code),
          tracking_code: expedition.tracking_number || "",
          ...(expedition.ship_date ? { shipping_date: new Date(expedition.ship_date).toISOString() } : {}),
        }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`Faire ${r.status} ${txt.slice(0, 200)}`);
    return { ok: true };
  },
};

const CANAUX = { shopify, etsy, faire };

/** Quel adaptateur pour une commande, d'après la boutique dont elle vient. */
function canalDe(commande) {
  const b = commande.store_id ? one("SELECT marketplace FROM stores WHERE id = ?", commande.store_id) : null;
  const nom = String(b?.marketplace || "").toLowerCase();
  return CANAUX[nom] || null;
}

// ------------------------------------------------------------------ envoi

/**
 * Date de bascule : rien d'antérieur n'est jamais notifié.
 *
 * Garde-fou indispensable. La migration importe des milliers d'expéditions dont le drapeau
 * `marketplace_notified` de ShipStation vaut 0 — certaines livrées depuis des mois. Sans cette
 * barrière, la première passe de la file enverrait des courriels de suivi à des clients dont la
 * commande est arrivée l'an dernier. La migration pose la date ; on ne notifie qu'après.
 */
const dateBascule = () => reglage("bascule_canaux", null);

/** À appeler quand le clone prend le relais. Sans argument : maintenant. */
function poserBascule(date = null) {
  const d = date || maintenant();
  poserReglage("bascule_canaux", d);
  journaliser("channel.bascule", "system", null, { date: d });
  return d;
}

/**
 * Pousse le suivi d'une expédition vers sa boutique d'origine.
 * Idempotent : une expédition déjà notifiée n'est pas renvoyée.
 */
async function notifier(shipmentId, { force = false } = {}) {
  const orders = require("./orders");
  const e = one("SELECT * FROM shipments WHERE id = ?", shipmentId);
  if (!e) throw new Error("expédition inconnue");
  if (e.marketplace_notified && !force) return { deja: true };
  if (e.voided) return { ignore: "étiquette annulée" };
  if (e.is_return) return { ignore: "étiquette de retour" };

  const bascule = dateBascule();
  if (!bascule) return { ignore: "date de bascule non posée — Réglages → Prendre le relais des notifications" };
  if (e.created_at && e.created_at < bascule && !force)
    return { ignore: "expédition antérieure à la bascule — ShipStation l'a déjà notifiée" };

  const commande = orders.parId(e.order_id);
  if (!commande) return { ignore: "commande absente" };

  const canal = canalDe(commande);
  if (!canal) {
    // Commande manuelle ou canal non branché : rien à notifier, on le note et on passe.
    run("UPDATE shipments SET marketplace_notified = 1, notify_error = NULL WHERE id = ?", shipmentId);
    return { ignore: "aucun canal pour cette boutique" };
  }
  if (!canal.configure()) {
    const msg = `canal ${canal.nom} non configuré (variables d'environnement absentes)`;
    run("UPDATE shipments SET notify_error = ? WHERE id = ?", msg, shipmentId);
    return { erreur: msg };
  }

  try {
    const r = await canal.pousser({ commande, expedition: e });
    run("UPDATE shipments SET marketplace_notified = 1, notify_error = NULL WHERE id = ?", shipmentId);
    journaliser("channel.notify", "shipment", shipmentId, { canal: canal.nom, ...r });
    return { canal: canal.nom, ...r };
  } catch (err) {
    const msg = String(err.message || err).slice(0, 400);
    run("UPDATE shipments SET notify_error = ? WHERE id = ?", msg, shipmentId);
    journaliser("channel.notify_error", "shipment", shipmentId, { canal: canal.nom, erreur: msg });
    return { erreur: msg, canal: canal.nom };
  }
}

/**
 * File de reprise : tout ce qui n'est pas encore notifié, dont les échecs précédents.
 * Un renvoi raté ne doit pas rester invisible — c'est un client sans suivi.
 */
const enAttente = (limite = 100) => all(
  `SELECT s.id, s.tracking_number, s.carrier_code, s.notify_error, s.created_at,
          o.order_number, st.marketplace
   FROM shipments s
   LEFT JOIN orders o ON o.id = s.order_id
   LEFT JOIN stores st ON st.id = o.store_id
   WHERE s.marketplace_notified = 0 AND s.voided = 0 AND s.is_return = 0 AND s.order_id IS NOT NULL
     AND s.created_at >= COALESCE(?, '9999')
   ORDER BY s.id DESC LIMIT ?`, dateBascule(), limite);

/** Traite la file. À appeler après un lot, et périodiquement. */
async function traiterFile({ limite = 50 } = {}) {
  const lignes = enAttente(limite);
  const resultats = [];
  for (const l of lignes) resultats.push({ id: l.id, ...(await notifier(l.id)) });
  const erreurs = resultats.filter((r) => r.erreur).length;
  if (resultats.length) journaliser("channel.queue", "shipment", null, { n: resultats.length, erreurs });
  return { traitees: resultats.length, erreurs, resultats };
}

/** État par canal — pour la page Réglages. */
const etat = () => Object.values(CANAUX).map((c) => ({
  nom: c.nom,
  configure: c.configure(),
  en_attente: one(`SELECT COUNT(*) n FROM shipments s
    LEFT JOIN orders o ON o.id = s.order_id LEFT JOIN stores st ON st.id = o.store_id
    WHERE s.marketplace_notified = 0 AND s.voided = 0 AND s.is_return = 0
      AND s.created_at >= COALESCE(?, '9999') AND lower(st.marketplace) = ?`, dateBascule(), c.nom).n,
}));

/** Ce que la bascule met hors de portée — pour l'afficher plutôt que de le taire. */
const historiqueIgnore = () => one(
  `SELECT COUNT(*) n FROM shipments
   WHERE marketplace_notified = 0 AND voided = 0 AND is_return = 0 AND order_id IS NOT NULL
     AND created_at < COALESCE(?, '9999')`, dateBascule()).n;

module.exports = { notifier, traiterFile, enAttente, etat, canalDe, CANAUX, nomTransporteur,
  urlSuivi, dateBascule, poserBascule, historiqueIgnore };
