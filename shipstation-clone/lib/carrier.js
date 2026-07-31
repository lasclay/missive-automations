/**
 * Couche transporteur — le contrat que toute l'application utilise.
 *
 * Une seule règle : le reste du clone ne connaît QUE les fonctions ci-dessous. Il ignore
 * si les étiquettes viennent de ClickShip, de ShipStation ou d'un bouchon de test. C'est ce
 * qui permet de développer la grille de tri pendant que les identifiants ClickShip se font
 * attendre, puis de brancher le vrai transporteur sans toucher à l'interface.
 *
 *   quote(shipment)   → Rate[]     cotation, aucun effet de bord
 *   buy(shipment, serviceId) → Label   ACHÈTE — argent réel
 *   void(labelId)     → {refunded}  annule une étiquette
 *   track(labelId)    → TrackingEvent[]
 *
 * Types (JSDoc plutôt que TypeScript, pour rester sans dépendance comme a2x-app) :
 *
 *   Address   {name, company, street1, street2, city, state, postalCode, country,
 *              phone, residential}
 *   Parcel    {weightG, lengthIn, widthIn, heightIn}
 *   Shipment  {from: Address, to: Address, parcel: Parcel, value, currency,
 *              signature, insurance, customs}
 *   Rate      {carrier, service, serviceId, price, currency, transitDays, dropOff}
 *   Label     {labelId, trackingNumber, carrier, service, price, currency,
 *              labelPdf (base64|url), customsPdf}
 *
 * Le drapeau `dropOff` du Rate est le champ qui porte tout l'intérêt économique du projet :
 * c'est lui qui distingue le tarif à ~6,31 $ du tarif avec ramassage. Voir AUDIT.md §7 bis.
 */

/** Poids limite du programme Canada Post « envoi unique » — la frontière du tarif drop-off. */
const SEUIL_DROPOFF_G = 500;

/**
 * Choisit un tarif dans une liste, selon la politique de Lasclay.
 *
 * Par défaut : le moins cher, en privilégiant le drop-off sous 500 g. C'est la règle qui
 * matérialise l'économie — appliquée ici plutôt que dispersée dans l'interface, pour qu'elle
 * reste testable et modifiable en un seul endroit.
 *
 * @param {Rate[]} rates
 * @param {{parcel: Parcel}} shipment
 * @param {{dropOffAutorise?: boolean, serviceImpose?: string}} politique
 * @returns {Rate|null}
 */
function choisirTarif(rates, shipment, politique = {}) {
  const { dropOffAutorise = true, serviceImpose = null } = politique;
  if (!rates || !rates.length) return null;
  if (serviceImpose) return rates.find((r) => r.serviceId === serviceImpose) || null;

  const admissible = shipment.parcel.weightG < SEUIL_DROPOFF_G;
  const candidats = rates.filter((r) => (r.dropOff ? dropOffAutorise && admissible : true));
  if (!candidats.length) return null;
  return candidats.slice().sort((a, b) => a.price - b.price)[0];
}

/**
 * Bouchon de test — reproduit la forme des réponses attendues, avec les prix réellement
 * observés (devis ClickShip du 22 juillet 2026 et devis ShipStation de l'audit). Sert à
 * développer et à tester l'application sans identifiants et sans dépenser.
 *
 * Ce n'est PAS une simulation de tarification : les prix ne varient pas avec la distance.
 */
const bouchon = {
  nom: "bouchon",
  async quote(shipment) {
    const kg = shipment.parcel.weightG / 1000;
    const majoration = Math.max(0, Math.ceil(kg - 0.5)) * 2.4; // grossier, assumé
    const rates = [
      { carrier: "Canada Post", service: "Expedited Parcel (Drop-Off)", serviceId: "cp_expedited_dropoff", price: 6.31, transitDays: 1, dropOff: true },
      { carrier: "Canada Post", service: "Expedited Parcel", serviceId: "cp_expedited", price: 9.09, transitDays: 1, dropOff: false },
      { carrier: "GLS", service: "GLS Ground", serviceId: "gls_ground", price: 9.12, transitDays: 1, dropOff: false },
      { carrier: "Canpar", service: "Canpar Ground", serviceId: "canpar_ground", price: 11.45, transitDays: 2, dropOff: false },
      { carrier: "UPS", service: "UPS Standard", serviceId: "ups_standard", price: 15.51, transitDays: 1, dropOff: false },
      { carrier: "Purolator", service: "Purolator Ground", serviceId: "purolator_ground", price: 16.01, transitDays: 1, dropOff: false },
      { carrier: "FedEx", service: "FedEx Ground", serviceId: "fedex_ground", price: 18.98, transitDays: 1, dropOff: false },
    ];
    return rates
      .filter((r) => !r.dropOff || shipment.parcel.weightG < SEUIL_DROPOFF_G)
      .map((r) => ({ ...r, price: Math.round((r.price + majoration) * 100) / 100, currency: "CAD" }));
  },
  async buy(shipment, serviceId) {
    const tarif = (await this.quote(shipment)).find((r) => r.serviceId === serviceId);
    if (!tarif) throw new Error(`service inconnu : ${serviceId}`);
    const n = String(Math.abs(hash(JSON.stringify(shipment) + serviceId))).padStart(16, "0").slice(0, 16);
    return {
      labelId: `bouchon-${n.slice(0, 8)}`,
      trackingNumber: n,
      carrier: tarif.carrier,
      service: tarif.service,
      price: tarif.price,
      currency: "CAD",
      labelPdf: null, // le bouchon ne produit pas de PDF
      customsPdf: null,
    };
  },
  async void_(labelId) {
    return { labelId, refunded: true };
  },
  async track(labelId) {
    return [{ date: null, status: "created", description: "Étiquette créée (bouchon)", labelId }];
  },
};

/** Hachage déterministe — un numéro de suivi factice stable pour un même envoi. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Adaptateur ClickShip / Freightcom — SQUELETTE, à compléter à réception des identifiants.
 *
 * Tout ce qui suit est marqué À VÉRIFIER : la documentation (developer.freightcom.com) n'a pas
 * pu être consultée — bloquée par la politique réseau de la session où ce fichier a été écrit.
 * Les points à confirmer auprès des conseillers techniques sont listés dans BRIEF_CLICKSHIP.md ;
 * ne PAS considérer la forme ci-dessous comme acquise.
 *
 * Hypothèses de travail, à confirmer une par une :
 *   - base https://external-api.freightcom.com, clé dans un en-tête d'autorisation ;
 *   - cotation ASYNCHRONE : on soumet une demande, on récupère les tarifs ensuite (question C6) ;
 *   - le service drop-off porte un identifiant propre (question A2) — c'est lui qui pilote
 *     le drapeau `dropOff`, donc l'économie.
 */
function clickship({ apiKey, baseUrl = "https://external-api.freightcom.com", fetchImpl = fetch }) {
  if (!apiKey) throw new Error("clé API ClickShip/Freightcom requise");
  const nonImplemente = (quoi) => {
    throw new Error(
      `clickship.${quoi} : non implémenté — en attente des identifiants et de la validation ` +
        `de la forme de l'API (voir shipstation-clone/BRIEF_CLICKSHIP.md)`
    );
  };
  return {
    nom: "clickship",
    async quote() { return nonImplemente("quote"); },
    async buy() { return nonImplemente("buy"); },
    async void_() { return nonImplemente("void_"); },
    async track() { return nonImplemente("track"); },
    // Conservés pour que le squelette soit complétable sans se répéter.
    _config: { apiKey: "***", baseUrl, fetchImpl },
  };
}

/**
 * Sélection de l'adaptateur. Par défaut le bouchon : tant que ClickShip n'a pas répondu,
 * l'application démarre et la grille de tri est utilisable.
 */
function adaptateur(nom = process.env.CARRIER_ADAPTER || "bouchon") {
  if (nom === "bouchon") return bouchon;
  if (nom === "clickship") return clickship({ apiKey: process.env.CLICKSHIP_API_KEY });
  throw new Error(`adaptateur transporteur inconnu : ${nom}`);
}

module.exports = { adaptateur, bouchon, clickship, choisirTarif, SEUIL_DROPOFF_G };
