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
/**
 * Les portées Shopify que l'expédition exige, et ce qu'on peut en dire.
 *
 * L'expédition passe obligatoirement par une « fulfillment order » — Shopify a retiré
 * l'ancien chemin direct. Lire ces objets, puis créer l'exécution, demande des portées
 * qu'une app en lecture seule n'a pas :
 *
 *     read_merchant_managed_fulfillment_orders    lire les commandes à exécuter
 *     write_merchant_managed_fulfillment_orders   créer l'exécution et déposer le suivi
 *
 * « merchant managed » parce que Lasclay expédie de son propre entrepôt. Une boutique qui
 * déléguerait à un préparateur externe aurait besoin de la paire `assigned` ou
 * `third_party` à la place.
 *
 * Sans elles, Shopify répond « Access denied for fulfillmentOrders field » — un message qui
 * ne dit ni laquelle manque, ni où l'ajouter. C'est le seul endroit du clone qui le sache,
 * donc c'est ici qu'on le traduit.
 */
const PORTEES_EXPEDITION = [
  "read_merchant_managed_fulfillment_orders",
  "write_merchant_managed_fulfillment_orders",
];

const MARCHE_A_SUIVRE_PORTEES =
  "Ajouter ces portées à l'app Shopify (Paramètres ▸ Apps ▸ développer une app ▸ Admin API "
  + "access scopes), publier une nouvelle version, puis réinstaller l'app sur la boutique. "
  + "Le jeton se renouvelle seul ensuite.";

/**
 * Un refus d'accès Shopify, traduit en geste.
 *
 * Rendre le message brut de GraphQL laisse chercher : il nomme un champ, pas un droit.
 */
function traduireRefusShopify(message) {
  const m = String(message || "");
  if (!/access denied/i.test(m)) return m;
  const champ = (m.match(/for (\w+) field/i) || [])[1] || null;
  if (champ && /fulfillment/i.test(champ)) {
    return `Shopify refuse l'accès au champ « ${champ} » : il manque les portées `
      + `${PORTEES_EXPEDITION.join(" et ")}. ${MARCHE_A_SUIVRE_PORTEES}`;
  }
  return `${m} — il s'agit d'une portée manquante sur l'app Shopify. ${MARCHE_A_SUIVRE_PORTEES}`;
}

const shopify = {
  nom: "shopify",
  portees: PORTEES_EXPEDITION,

  /**
   * Les portées accordées, confrontées à celles qu'il faut.
   *
   * Se pose AVANT d'expédier, pas après : découvrir qu'un droit manque au moment où
   * l'étiquette est déjà achetée, c'est le découvrir trop tard.
   */
  async verifierPortees() {
    const { tokenScopes } = this.client();
    const t = await tokenScopes();
    // Un jeton fixe n'expose pas ses portées : on ne peut rien affirmer, et le dire vaut
    // mieux que d'annoncer un manque qui n'existe peut-être pas.
    if (!t || !Array.isArray(t.scopes)) {
      return { connues: false, note: (t && t.note) || "les portées de ce jeton ne sont pas lisibles",
        requises: PORTEES_EXPEDITION, manquantes: [] };
    }
    const manquantes = PORTEES_EXPEDITION.filter((p) => !t.scopes.includes(p));
    return { connues: true, accordees: t.scopes, requises: PORTEES_EXPEDITION, manquantes,
      note: manquantes.length ? MARCHE_A_SUIVRE_PORTEES : null };
  },

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

    let d;
    try {
      d = await gql(`
        query($id: ID!) {
          order(id: $id) {
            id
            fulfillmentOrders(first: 20) { edges { node { id status } } }
          }
        }`, { id: `gid://shopify/Order/${idShopify}` });
    } catch (e) { throw new Error(traduireRefusShopify(e.message)); }

    if (!d.order) throw new Error(`commande ${idShopify} introuvable chez Shopify`);
    const ouvertes = (d.order.fulfillmentOrders.edges || [])
      .map((e) => e.node)
      .filter((f) => ["OPEN", "IN_PROGRESS", "SCHEDULED"].includes(f.status));
    if (!ouvertes.length) return { deja: true, message: "aucune fulfillment order ouverte — déjà expédiée côté Shopify" };

    const suivi = expedition.tracking_number || null;
    let r;
    try {
      r = await gql(`
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
    } catch (e) { throw new Error(traduireRefusShopify(e.message)); }

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

  /*
   * La bascule protège l'HISTORIQUE, pas les étiquettes achetées ici.
   *
   * Elle existe pour une seule raison : ne pas réécrire à des clients dont ShipStation a
   * déjà déposé le suivi il y a des mois. Ce risque ne concerne que les expéditions
   * rapatriées par la migration.
   *
   * Une étiquette achetée dans le clone porte le nom de son fournisseur (`provider`) ; les
   * expéditions migrées n'en portent aucun. Et une étiquette achetée ici n'a, par
   * construction, jamais été notifiée par ShipStation — la retenir derrière une date de
   * bascule laisse le client sans suivi sur une commande qu'on vient d'expédier. C'est
   * exactement ce qui est arrivé au premier achat réel : étiquette imprimée, Shopify muet.
   *
   * L'ignorance se note en clair : un renvoi qui n'a pas lieu doit se lire à l'écran, pas se
   * deviner. Sans cela, l'expédition restait dans la file sans une ligne pour dire pourquoi.
   */
  const acheteeIci = !!e.provider;
  // `force` est le bouton « Renvoyer le suivi » : un geste explicite, sur une expédition
  // qu'on regarde. Il passe outre la bascule entière — c'est le seul moyen de rattraper
  // une expédition qu'elle avait laissée derrière.
  if (!acheteeIci && !force) {
    const bascule = dateBascule();
    const passe = (motif) => {
      run("UPDATE shipments SET notify_error = ? WHERE id = ?", motif, shipmentId);
      return { ignore: motif };
    };
    if (!bascule) return passe("date de bascule non posée — Réglages → Prendre le relais des notifications");
    if (e.created_at && e.created_at < bascule)
      return passe("expédition antérieure à la bascule — ShipStation l'a déjà notifiée");
  }

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
     AND (s.provider IS NOT NULL OR s.created_at >= COALESCE(?, '9999'))
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
/** L'historique laissé à ShipStation — les expéditions migrées, jamais celles achetées ici. */
const historiqueIgnore = () => one(
  `SELECT COUNT(*) n FROM shipments
   WHERE marketplace_notified = 0 AND voided = 0 AND is_return = 0 AND order_id IS NOT NULL
     AND provider IS NULL AND created_at < COALESCE(?, '9999')`, dateBascule()).n;

module.exports = { notifier, traiterFile, enAttente, etat, canalDe, CANAUX, nomTransporteur,
  urlSuivi, dateBascule, poserBascule, historiqueIgnore };
