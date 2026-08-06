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
 * Grille du bouchon — recalée sur la cotation réelle relevée à l'audit visuel (§3.8).
 *
 * L'ancienne grille cotait **GLS**, que Lasclay n'a pas, et **FedEx**, qui ne renvoie aucun
 * tarif réel chez ShipStation. Elle plaçait Purolator avant-dernier alors qu'il est
 * quatrième et moins cher qu'UPS, et Canpar devant UPS alors qu'il est derrière. Sur quatre
 * transporteurs comparés, trois étaient mal classés : un comparateur qui se trompe d'ordre
 * est pire qu'un comparateur absent, parce qu'on le croit.
 *
 * Les prix ci-dessous sont ceux du Rate Browser de ShipStation pour l'envoi de référence
 * (LAS Capucins → Montréal H2X 1Y4, 500 g, 9 × 6 × 2 po), plus le tarif de dépôt Lasclay
 * que ShipStation ne connaît pas. Ils restent **non contractuels** : le bouchon ne fait pas
 * varier le prix avec la distance, et chaque ligne le dit à l'écran.
 *
 * `compte` porte la notion que ShipStation modélise et que le clone ignorait : Lasclay a
 * deux comptes Canada Post, à 1,08 $ d'écart sur le même service.
 */
const GRILLE_BOUCHON = [
  { carrier: "Canada Post", compte: "LASCLAY", service: "Expedited Parcel (Drop-Off)", serviceId: "cp_expedited_dropoff", price: 6.31, transitDays: 1, dropOff: true },
  { carrier: "Canada Post", compte: "LASCLAY", service: "Expedited Parcel (Carbon Neutral)", serviceId: "cp_expedited", price: 8.38, transitDays: 1, dropOff: false },
  { carrier: "Canada Post", compte: "LASCLAY", service: "Xpresspost", serviceId: "cp_xpresspost", price: 9.01, transitDays: 1, dropOff: false },
  { carrier: "Canada Post", compte: "Rotule", service: "Expedited Parcel (Carbon Neutral)", serviceId: "cp_expedited_rotule", price: 9.46, transitDays: 1, dropOff: false },
  { carrier: "Purolator", compte: "CC Gabriel", service: "Purolator Ground", serviceId: "purolator_ground", price: 10.82, transitDays: 1, dropOff: false },
  { carrier: "UPS", compte: "CC Gabriel", service: "UPS Standard", serviceId: "ups_standard", price: 11.68, transitDays: 1, dropOff: false },
  { carrier: "Canada Post", compte: "LASCLAY", service: "Priority", serviceId: "cp_priority", price: 15.32, transitDays: 1, dropOff: false },
  { carrier: "Canpar", compte: "CC Gabriel", service: "Canpar Ground", serviceId: "canpar_ground", price: 14.04, transitDays: 2, dropOff: false },
];

/**
 * Bouchon de test — reproduit la forme des réponses attendues, avec les prix réellement
 * relevés chez ShipStation. Sert à développer et à tester sans identifiants et sans dépenser.
 *
 * Ce n'est PAS une simulation de tarification : les prix ne varient pas avec la distance.
 * Ils ne cotent en revanche plus que des transporteurs que le compte possède réellement.
 */
/**
 * L'assurance du fournisseur de démonstration. Elle n'assure rien — c'est un exercice — mais
 * elle porte la forme exacte que rendent Freightcom, Chit Chats et Postes Canada, y compris
 * le cas qui compte : couverture demandée, service qui ne la vend pas.
 */
function assuranceBouchon(shipment, tarif) {
  const demandee = Number(shipment.insurance || 0);
  const international = String(shipment.to?.country || "CA").toUpperCase() !== "CA";
  // Un service de dépôt au comptoir ne porte pas de couverture : c'est le cas réel qu'il faut
  // pouvoir voir à l'écran avant d'acheter.
  const vendue = demandee > 0 && !tarif.dropOff;
  return {
    demandee,
    appliquee: vendue,
    cout: vendue ? Math.round(demandee * (international ? 0.015 : 0.011) * 100) / 100 : 0,
    mention: vendue ? "Démonstration — couverture d'exercice" : null,
    type: demandee > 0 ? "demonstration" : null,
    note: !demandee ? "aucune couverture demandée"
      : vendue ? "prix d'exercice : aucune couverture réelle"
      : "demandée, absente de la réponse — ce service ne la vend pas",
  };
}

const bouchon = {
  nom: "bouchon",
  async quote(shipment) {
    const kg = shipment.parcel.weightG / 1000;
    const majoration = Math.max(0, Math.ceil(kg - 0.5)) * 2.4; // grossier, assumé
    // Un transporteur absent du référentiel n'est pas coté : c'est ce qui a fait apparaître
    // GLS et FedEx dans un comparateur alors que Lasclay n'a de compte ni chez l'un ni chez
    // l'autre. Quand le référentiel est vide (base neuve), on cote tout plutôt que rien.
    let connus = null;
    try {
      const { all } = require("./db");
      const noms = all("SELECT name, code FROM carriers WHERE active = 1")
        .flatMap((c) => [c.name, c.code]).filter(Boolean)
        .map((x) => String(x).toLowerCase());
      if (noms.length) connus = noms;
    } catch { /* base indisponible : on ne filtre pas */ }

    const admis = (r) => !connus
      || connus.some((n) => n.includes(r.carrier.toLowerCase().replace(/\s+/g, "_"))
        || r.carrier.toLowerCase().includes(n) || n.includes(r.carrier.toLowerCase()));

    return GRILLE_BOUCHON
      .filter(admis)
      .filter((r) => !r.dropOff || shipment.parcel.weightG < SEUIL_DROPOFF_G)
      .map((r) => ({ ...r, price: Math.round((r.price + majoration) * 100) / 100,
        currency: "CAD", demonstration: true,
        // Le bouchon rend la MÊME forme d'assurance que les vrais adaptateurs, pour que
        // l'écran de preuve s'exerce sans clé, sans réseau et sans dépense. Le taux imite
        // celui de XCover — 1,10 % en domestique, 1,50 % à l'international — de sorte que
        // l'ordre de grandeur affiché ressemble à ce qu'on verra en production.
        assurance: assuranceBouchon(shipment, r) }))
      .sort((a, b) => a.price - b.price);
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
  // Chargé à la demande : `postescanada` lit la base, et `carrier.js` est requis par des
  // scripts qui n'ont pas de base ouverte. Un require en tête les casserait tous.
  if (nom === "postescanada" || nom === "canada_post") return require("./postescanada").adaptateurPostesCanada;
  if (nom === "freightcom") return require("./freightcom").adaptateurFreightcom;
  if (nom === "chitchats") return require("./chitchats").adaptateurChitChats;
  throw new Error(`adaptateur transporteur inconnu : ${nom}`);
}

/**
 * Les fournisseurs d'étiquettes que le clone sait joindre, et leur état.
 *
 * Cette liste existe pour que l'interface n'ait **aucun fournisseur en dur**. Freightcom est
 * celui d'aujourd'hui ; Postes Canada en direct est déjà écrit, et le jour où Lasclay branche
 * ses propres comptes transporteur, il suffira d'ajouter une entrée ici. L'écran affichera le
 * nouveau choix sans qu'on y touche.
 *
 * `configure` dit si les identifiants sont là ; `defaut` marque celui que
 * `CARRIER_ADAPTER` désigne. Un fournisseur non configuré reste visible mais désactivé —
 * c'est ainsi qu'on découvre qu'il existe et qu'il manque une clé, plutôt que par son absence.
 */
function fournisseurs() {
  const defaut = process.env.CARRIER_ADAPTER || "bouchon";
  const teste = (fn) => { try { return !!fn(); } catch { return false; } };
  const liste = [
    { nom: "freightcom", libelle: "Freightcom", detail: "courtier — panel multi-transporteurs",
      configure: teste(() => require("./freightcom").configure()) },
    { nom: "chitchats", libelle: "Chit Chats", detail: "consolidateur — dépôt, DDP vers les États-Unis",
      configure: teste(() => require("./chitchats").configure()) },
    { nom: "postescanada", libelle: "Postes Canada", detail: "compte propre, contrat Niveau 9",
      configure: teste(() => require("./postescanada").etat().configure) },
    { nom: "bouchon", libelle: "Démonstration", detail: "prix d'exercice, aucun achat possible",
      configure: true, demonstration: true },
  ];
  return liste.map((f) => ({ ...f, defaut: f.nom === defaut }));
}

module.exports = { adaptateur, fournisseurs, bouchon, clickship, choisirTarif, SEUIL_DROPOFF_G };
