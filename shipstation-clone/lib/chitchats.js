/**
 * Chit Chats — troisième fournisseur d'étiquettes.
 *
 * Écrit contre la documentation publique `chitchats.com/docs/api/v1` (spec 1.0).
 *
 *   base    https://chitchats.com/api/v1/clients/{CLIENT_ID}/
 *   essai   https://staging.chitchats.com/api/v1/clients/{CLIENT_ID}/
 *   auth    en-tête `Authorization: <jeton>` — brut, comme Freightcom
 *   débit   2 000 requêtes par 5 minutes, `Retry-After` sur 429
 *
 * LA DIFFÉRENCE QUI COMMANDE TOUT
 * -------------------------------
 * Chit Chats **n'a pas d'endpoint de cotation**. Pour connaître un prix, il faut créer une
 * expédition — `POST /shipments` — et lire le tableau `rates` de la réponse. L'achat vient
 * ensuite, `PATCH /shipments/{id}/buy`, en nommant le `postage_type` retenu.
 *
 * Or le contrat de `lib/carrier.js` dit : « quote(shipment) → Rate[], cotation, aucun effet
 * de bord ». Ici c'est impossible à respecter à la lettre. Le compromis retenu :
 *
 *   - la cotation crée un **brouillon**, qui ne coûte rien tant qu'il n'est pas acheté ;
 *   - son identifiant est mémorisé pour la commande, et **réutilisé** à l'achat plutôt que
 *     d'en créer un second — c'est ce qui empêche les brouillons de s'empiler ;
 *   - `menage()` supprime ceux qui n'ont jamais servi.
 *
 * Ce que Chit Chats sait faire et Freightcom non : `signature_requested`. La confirmation de
 * livraison passe donc par ici, ce qui en fait un vrai choix et pas un doublon.
 *
 * L'achat est ASYNCHRONE : `buy` répond souvent `postage_requested`, et il faut interroger
 * jusqu'à `ready` ou `postage_purchase_failed`. Rendre la main trop tôt donnerait une
 * étiquette sans URL et un suivi vide.
 */
const { all, one, run, dump, parse, maintenant, journaliser } = require("./db");

const CLIENT = () => process.env.CHITCHATS_CLIENT_ID || "";
const JETON = () => process.env.CHITCHATS_TOKEN || "";
const ESSAI = () => process.env.CHITCHATS_ENV !== "prod";

const configure = () => !!(CLIENT() && JETON());

function base() {
  // `CHITCHATS_URL` n'existe que pour les bancs d'essai locaux : elle permet de dérouler le
  // workflow complet — lot, dépôt, étiquette du sac — sans toucher au compte réel.
  const hote = process.env.CHITCHATS_URL
    || (ESSAI() ? "https://staging.chitchats.com" : "https://chitchats.com");
  if (!CLIENT() || !JETON()) {
    throw new Error("CHITCHATS_CLIENT_ID et CHITCHATS_TOKEN requis — dans l'environnement Render, jamais en base");
  }
  return `${hote}/api/v1/clients/${encodeURIComponent(CLIENT())}`;
}

// ------------------------------------------------------------------- transport

/** 2 000 requêtes / 5 min, et un `Retry-After` sur 429 : on l'écoute plutôt que d'insister. */
async function appel(methode, chemin, corps = null, { essais = 3 } = {}) {
  for (let n = 0; ; n++) {
    let r;
    try {
      r = await fetch(`${base()}${chemin}`, {
        method: methode,
        headers: { Authorization: JETON(), ...(corps ? { "Content-Type": "application/json; charset=utf-8" } : {}) },
        body: corps ? JSON.stringify(corps) : undefined,
      });
    } catch (e) { throw new Error(`Chit Chats injoignable : ${e.message}`); }

    if (r.status === 429 && n < essais) {
      const attente = Math.min(30, Number(r.headers.get("Retry-After") || 5)) * 1000;
      await new Promise((ok) => setTimeout(ok, attente));
      continue;
    }
    const texte = await r.text();
    let j = null;
    try { j = texte ? JSON.parse(texte) : null; } catch { /* réponse non JSON */ }
    if (!r.ok) {
      // Chit Chats rend ses erreurs sous trois formes : une chaîne, un tableau, ou un objet
      // `{ champ: [messages] }`. La première version concaténait naïvement et affichait
      // « [object Object] » — un message d'erreur illisible vaut une erreur de plus.
      const aplatir = (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === "string") return v;
        if (Array.isArray(v)) return v.map(aplatir).filter(Boolean).join(" · ");
        if (typeof v === "object") {
          return Object.entries(v).map(([k, x]) => `${k} : ${aplatir(x)}`).filter(Boolean).join(" · ");
        }
        return String(v);
      };
      const m = aplatir(j?.error) || aplatir(j?.message) || aplatir(j?.errors);
      throw new Error(`Chit Chats ${r.status}${m ? ` : ${m}` : texte ? ` : ${texte.slice(0, 200)}` : ""}`);
    }
    return j;
  }
}

// ------------------------------------------------------------------- conversions

const nombre = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v) * 100) / 100);
const cm = (po) => Math.max(0.1, Math.round(Number(po || 0) * 2.54 * 10) / 10);

/**
 * Code postal, au format que Chit Chats attend.
 *
 * Je retirais l'espace, comme pour Freightcom et Postes Canada. Chit Chats, lui, l'exige :
 * son exemple de documentation écrit `"postal_code": "V6K 1A1"`, et sans l'espace il répond
 * « return_postal_code field is invalid » — puis, en cascade, déclare la province invalide
 * elle aussi, ce qui envoie chercher le problème au mauvais endroit.
 *
 * La leçon vaut au-delà de ce champ : chaque transporteur a sa façon d'écrire la même donnée,
 * et normaliser « pour faire propre » n'est pas neutre.
 */
function codePostal(v, pays = "CA") {
  const brut = String(v || "").toUpperCase().replace(/\s+/g, "");
  if (!brut) return undefined;
  if (String(pays).toUpperCase() !== "CA") return brut;
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(brut) ? `${brut.slice(0, 3)} ${brut.slice(3)}` : brut;
}

/** Province en deux lettres : « Québec » ou « Quebec » écrits en toutes lettres sont refusés. */
const PROVINCES = {
  quebec: "QC", québec: "QC", ontario: "ON", alberta: "AB", manitoba: "MB",
  saskatchewan: "SK", "nova scotia": "NS", "nouvelle-écosse": "NS",
  "new brunswick": "NB", "nouveau-brunswick": "NB", "british columbia": "BC",
  "colombie-britannique": "BC", "newfoundland and labrador": "NL",
  "terre-neuve-et-labrador": "NL", "prince edward island": "PE",
  "île-du-prince-édouard": "PE", yukon: "YT", nunavut: "NU",
  "northwest territories": "NT", "territoires du nord-ouest": "NT",
};
function province(v) {
  const s = String(v || "").trim();
  if (!s) return undefined;
  if (s.length === 2) return s.toUpperCase();
  return PROVINCES[s.toLowerCase()] || s.toUpperCase().slice(0, 2);
}

/** Les dix seules valeurs que Chit Chats accepte pour la boutique d origine. */
const MAGASINS = new Set(["adobe_commerce", "amazon", "bigcommerce", "ebay", "etsy",
  "shipstation", "shopify", "squarespace", "woocommerce", "other"]);

/**
 * Le colis, tel que Chit Chats le veut.
 *
 * `package_type` a seize valeurs, dont douze propres aux enveloppes à tarif fixe de l'USPS.
 * `parcel` couvre tout ce que Lasclay expédie ; les autres se choisiraient à la main et
 * n'ont pas leur place dans une conversion automatique — deviner un type d'enveloppe
 * américaine à partir de dimensions ferait acheter la mauvaise chose.
 */
function corpsExpedition(envoi, { ordre = null } = {}) {
  const p = envoi.parcel || {};
  const to = envoi.to || {};
  const from = envoi.from || {};
  const pays = String(to.country || "CA").toUpperCase();
  return {
    name: to.name || "Client",
    address_1: to.street1 || "",
    address_2: to.street2 || undefined,
    city: to.city || "",
    province_code: province(to.state),
    postal_code: codePostal(to.postalCode, pays),
    country_code: pays,
    phone: to.phone || undefined,
    email: to.email || undefined,

    /*
     * L'adresse de retour n'est PAS envoyée par défaut.
     *
     * Chit Chats en a déjà une, configurée dans le compte, et c'est elle qui est imprimée sur
     * l'étiquette. En envoyer une autre a valu deux refus successifs — « return_province_code
     * field is invalid and return_postal_code field is invalid » — sur des données pourtant
     * correctes (QC, G1J 3R4), y compris après avoir corrigé le format du code postal.
     *
     * Chercher plus loin serait deviner. Le compte sait déjà d'où part le colis ; lui redire
     * n'apporte rien, et le champ que l'API refuse cesse d'exister. `CHITCHATS_RETOUR=1`
     * remet l'envoi si un jour le besoin se présente — expédier pour un tiers, par exemple.
     */
    ...(process.env.CHITCHATS_RETOUR === "1" ? {
      return_name: from.company || from.name || undefined,
      return_address_1: from.street1 || undefined,
      return_city: from.city || undefined,
      return_province_code: province(from.state),
      return_postal_code: codePostal(from.postalCode, from.country || "CA"),
    } : {}),

    description: (envoi.description || "Marchandise").slice(0, 100),
    value: String(Number(envoi.value || 0).toFixed(2)),
    value_currency: String(envoi.currency || "CAD").toLowerCase() === "usd" ? "usd" : "cad",

    package_type: "parcel",
    size_unit: "cm",
    size_x: cm(p.lengthIn), size_y: cm(p.widthIn), size_z: cm(p.heightIn),
    weight_unit: "g",
    weight: Math.max(1, Math.round(Number(p.weightG || 0))),

    // Ce que Freightcom ne sait pas transmettre. C'est la raison d'être de ce fournisseur
    // pour les envois où la politique de livraison compte.
    signature_requested: !!envoi.signature,
    insurance_requested: !!envoi.insurance,

    // DDP — droits et taxes payés à l expédition.
    //
    // C est la raison pour laquelle Chit Chats est le bon fournisseur vers les États-Unis :
    // le client reçoit son colis sans rien à payer au facteur, ce qui supprime le refus de
    // livraison et le fil de support qui va avec. Par défaut activé hors Canada, parce que
    // c est la politique de Lasclay ; CHITCHATS_DDP=0 la renverse, et une commande peut
    // toujours dire le contraire.
    duties_paid_requested: envoi.ddp !== undefined ? !!envoi.ddp
      : (pays !== "CA" && process.env.CHITCHATS_DDP !== "0"),

    order_id: ordre ? String(ordre) : undefined,
    /*
     * `order_store` est un ensemble FERMÉ de dix valeurs — la boutique d'origine, pas le nom
     * du marchand. J'y avais mis « Lasclay », et Chit Chats a répondu « Unknown order_store ».
     *
     * C'est la boutique qui a pris la commande qui compte : Shopify pour l'essentiel du
     * volume, Etsy pour le reste. `envoi.boutique` porte le marché quand l'appelant le
     * connaît ; « other » couvre le reste sans rien inventer.
     */
    order_store: MAGASINS.has(String(envoi.boutique || "").toLowerCase())
      ? String(envoi.boutique).toLowerCase() : "other",
    ship_date: "today",
  };
}

/** Un tarif Chit Chats, ramené au contrat commun de `lib/carrier.js`. */
function lireTarif(t, exp = null) {
  /**
   * Chez Chit Chats, la preuve n'est pas une surcharge mais un champ nommé.
   *
   * L'expédition renvoyée porte `insurance_requested`, et chaque tarif porte le libellé de la
   * couverture applicable — ce que le consolidateur a réellement accepté, pas ce qu'on a
   * demandé. Le brouillon est créé AVANT d'avoir un prix (Chit Chats n'a pas d'endpoint de
   * cotation) : c'est donc la réponse à la création qui dit si la demande a été retenue.
   *
   * Un colis assuré dont le tarif ne mentionne aucune couverture veut dire que ce mode de
   * port ne la porte pas — la lettre suivie, par exemple. Le dire vaut mieux que laisser
   * croire qu'un colis est protégé.
   */
  const libelle = t.insurance_description || t.insurance_type_description || null;
  const cout = nombre(t.insurance_amount) ?? nombre(t.insurance_cost) ?? 0;
  const demande = exp ? !!exp.insurance_requested : null;
  const assurance = {
    demandee: demande === null ? null : demande,
    // Chit Chats reçoit toujours la demande quand elle existe : `insurance_requested` part
    // avec le brouillon, sans réglage préalable.
    transmise: !!demande,
    appliquee: !!(libelle || cout),
    cout: cout || 0,
    mention: libelle,
    type: demande ? "chitchats" : null,
    note: demande === false ? "aucune couverture demandée"
      : (libelle || cout) ? null
      : "demandée, absente de la réponse — ce mode de port ne la porte pas",
  };
  const taxes = (nombre(t.provincial_tax) || 0) + (nombre(t.federal_tax) || 0);
  const total = nombre(t.payment_amount) ?? nombre(t.purchase_amount);
  return {
    carrier: t.postage_carrier_type || "Chit Chats",
    service: t.postage_description || t.postage_type,
    serviceId: t.postage_type,
    // `purchase_amount` est le montant hors taxes, `payment_amount` le débit réel. On garde
    // les deux : le premier pour raisonner, le second pour rapprocher un relevé.
    prixHT: nombre(t.purchase_amount),
    price: total,
    taxes: Math.round(taxes * 100) / 100,
    currency: "CAD",
    delai: t.delivery_time_description || null,
    transitDays: null,
    suivi: t.tracking_type_description || null,
    signature: t.signature_confirmation_description || null,
    ddp: t.delivery_duties_paid_description || null,
    // Chit Chats est un consolidateur : on dépose chez eux, jamais de ramassage à la porte.
    // Le drapeau dit donc vrai, et le comparateur ne promet pas un service qu'on n'a pas.
    dropOff: true,
    assurance,
  };
}

// ------------------------------------------------------------------- brouillons

/**
 * Le brouillon d'une commande, mémorisé pour être réutilisé.
 *
 * Sans cette mémoire, chaque cotation créerait une expédition de plus chez Chit Chats, et le
 * compte se remplirait de doublons que personne n'a demandés. C'est aussi ce qui fait que
 * l'achat porte sur l'objet déjà coté, et non sur un second créé à la hâte.
 */
function brouillonDe(ordre) {
  const r = one("SELECT value FROM settings WHERE key = ?", `chitchats.draft.${ordre}`);
  return r ? parse(r.value, null) : null;
}
function memoriserBrouillon(ordre, id, empreinte) {
  run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    `chitchats.draft.${ordre}`, dump({ id, empreinte, a: maintenant() }));
}
function oublierBrouillon(ordre) {
  run("DELETE FROM settings WHERE key = ?", `chitchats.draft.${ordre}`);
}

/** Ce qui, s'il change, rend le brouillon caduc : l'envoi lui-même, pas la commande. */
function empreinteEnvoi(envoi) {
  const p = envoi.parcel || {};
  return JSON.stringify([
    codePostal(envoi.to?.postalCode, envoi.to?.country),
    (envoi.to?.country || "CA").toUpperCase(),
    Math.round(Number(p.weightG || 0)), cm(p.lengthIn), cm(p.widthIn), cm(p.heightIn),
    !!envoi.signature, !!envoi.insurance,
  ]);
}

// ------------------------------------------------------------------- cotation

/**
 * Cote un envoi. Crée un brouillon si nécessaire, le rafraîchit sinon.
 *
 * `ordre` est l'identifiant de commande côté clone : c'est lui qui permet de retrouver le
 * brouillon. Sans lui — une cotation exploratoire — le brouillon est créé puis **supprimé**,
 * pour ne rien laisser derrière.
 */
async function coter(envoi, { ordre = null } = {}) {
  const empreinte = empreinteEnvoi(envoi);
  const memo = ordre ? brouillonDe(ordre) : null;

  if (memo && memo.empreinte === empreinte) {
    const r = await appel("PATCH", `/shipments/${memo.id}/refresh`, {});
    const exp = r?.shipment || r;
    return { tarifs: (exp.rates || []).map((t) => lireTarif(t, exp)).sort(cheap), shipmentId: exp.id, reutilise: true };
  }

  // L'envoi a changé (ou il n'y avait rien) : l'ancien brouillon ne vaut plus rien.
  if (memo) { await supprimer(memo.id).catch(() => {}); oublierBrouillon(ordre); }

  const r = await appel("POST", "/shipments", corpsExpedition(envoi, { ordre }));
  const exp = r?.shipment || r;
  const tarifs = (exp.rates || []).map((t) => lireTarif(t, exp)).sort(cheap);

  if (ordre) memoriserBrouillon(ordre, exp.id, empreinte);
  else await supprimer(exp.id).catch(() => {});   // cotation exploratoire : on ne laisse rien

  return { tarifs, shipmentId: ordre ? exp.id : null, reutilise: false };
}

const cheap = (a, b) => (a.prixHT ?? a.price ?? 1e9) - (b.prixHT ?? b.price ?? 1e9);

async function supprimer(id) { return await appel("DELETE", `/shipments/${id}`); }

// ------------------------------------------------------------------- lots

/**
 * Les lots Chit Chats — la pièce sans laquelle on ne dépose pas.
 *
 * Chit Chats n'est pas un transporteur mais un point de consolidation : on lui remet un SAC
 * de colis, pas des colis un par un. Ce sac porte une étiquette de lot, et c'est elle que le
 * comptoir scanne. Les étiquettes d'expédition, seules, ne suffisent pas — sans lot, le
 * dépôt est refusé et il faut tout refaire sur place.
 *
 * Le clone gérait ses propres lots, utiles au tri interne, mais qui n'existent pas chez Chit
 * Chats. Ceux-ci sont les leurs, avec leur étiquette imprimable en PDF, PNG ou ZPL.
 *
 *   POST   /batches                       créer
 *   GET    /batches, /batches/{id}        lister, relire (avec les URL d'étiquette)
 *   DELETE /batches/{id}                  supprimer, seulement s'il est vide
 *   PATCH  /shipments/{id}/add_to_batch   y déposer une expédition
 *   PATCH  /shipments/{id}/remove_from_batch
 *
 * Un lot « reçu » (`received`) ne rend plus ses étiquettes : Chit Chats l'a pris en charge,
 * il est clos. C'est le signal que le dépôt a bien eu lieu.
 */
async function creerLot(description) {
  const r = await appel("POST", "/batches", { description: description || null });
  const b = r?.batch || r;
  journaliser("chitchats.lot.create", "batch", b?.id || "?", { description }, null);
  return lireLot(b);
}

/** Forme commune : les trois formats d'étiquette de lot, et l'état. */
function lireLot(b = {}) {
  return {
    id: b.id,
    description: b.description || null,
    statut: b.status || null,
    // `received` = Chit Chats a pris le sac. Les URL disparaissent alors, et c'est normal.
    recu: String(b.status || "").toLowerCase() === "received",
    etiquettePdf: b.label_pdf_url || null,
    etiquettePng: b.label_png_url || null,
    etiquetteZpl: b.label_zpl_url || null,
    creeLe: b.created_at || null,
    brut: b,
  };
}

async function lots({ limite = 100, page = 1 } = {}) {
  const r = await appel("GET", `/batches?limit=${limite}&page=${page}`);
  return (r?.batches || []).map(lireLot);
}

async function lot(id) {
  const r = await appel("GET", `/batches/${id}`);
  return lireLot(r?.batch || r);
}

/** Ne réussit que sur un lot vide — Chit Chats refuse de perdre des colis déjà déposés. */
async function supprimerLot(id) {
  await appel("DELETE", `/batches/${id}`);
  return { id, supprime: true };
}

async function ajouterAuLot(shipmentId, batchId) {
  const r = await appel("PATCH", `/shipments/${shipmentId}/add_to_batch`, { batch_id: batchId });
  journaliser("chitchats.lot.ajout", "shipment", shipmentId, { batchId }, null);
  return r?.shipment || r;
}

async function retirerDuLot(shipmentId) {
  const r = await appel("PATCH", `/shipments/${shipmentId}/remove_from_batch`, {});
  return r?.shipment || r;
}

/**
 * Rafraîchit les tarifs d'un brouillon au lieu de le détruire et de le recréer.
 *
 * C'est ce que faisait le clone : `DELETE` puis `POST`, deux appels et un identifiant perdu à
 * chaque cotation. Chit Chats expose le geste directement.
 */
async function rafraichirTarifs(shipmentId) {
  const r = await appel("PATCH", `/shipments/${shipmentId}/refresh`, {});
  const exp = r?.shipment || r;
  return { shipmentId, tarifs: (exp?.rates || []).map((t) => lireTarif(t, exp)).sort(cheap) };
}

/** Les retours en cours chez Chit Chats — colis refusés, non livrés, réacheminés. */
async function retours({ limite = 100, page = 1 } = {}) {
  const r = await appel("GET", `/returns?limit=${limite}&page=${page}`);
  return (r?.returns || []).map((x) => ({
    id: x.id, expedition: x.shipment_id || null, statut: x.status || null,
    raison: x.reason || x.return_reason || null, date: x.created_at || null, brut: x,
  }));
}
async function expedition(id) { const r = await appel("GET", `/shipments/${id}`); return r?.shipment || r; }

// ------------------------------------------------------------------- achat

const TERMINES = new Set(["ready", "postage_purchase_failed", "unpaid", "in_transit", "delivered"]);

/**
 * ACHÈTE. Argent réel hors du bac à sable.
 *
 * L'achat est asynchrone : Chit Chats répond souvent `postage_requested` et il faut
 * interroger jusqu'à `ready` ou `postage_purchase_failed`. Rendre la main avant donnerait une
 * étiquette sans URL et un numéro de suivi vide — le genre de succès apparent qui se
 * découvre à l'impression.
 */
async function acheter(envoi, postageType, { ordre = null, attenteMs = 20000 } = {}) {
  const { tarifs, shipmentId } = await coter(envoi, { ordre });
  if (!shipmentId) throw new Error("achat impossible sans identifiant de commande — le brouillon ne serait pas retrouvé");
  const tarif = tarifs.find((t) => String(t.serviceId) === String(postageType));
  if (!tarif) throw new Error(`service ${postageType} absent de la cotation du moment — recoter avant d'acheter`);

  await appel("PATCH", `/shipments/${shipmentId}/buy`, { postage_type: String(postageType) });

  const debut = Date.now();
  let exp = await expedition(shipmentId);
  while (!TERMINES.has(String(exp.status)) && Date.now() - debut < attenteMs) {
    await new Promise((ok) => setTimeout(ok, 1500));
    exp = await expedition(shipmentId);
  }
  if (String(exp.status) === "postage_purchase_failed") {
    throw new Error("Chit Chats a refusé l'achat (postage_purchase_failed) — vérifier le solde du compte");
  }
  if (!exp.postage_label_pdf_url && !exp.carrier_tracking_code) {
    throw new Error(`achat non abouti après ${Math.round((Date.now() - debut) / 1000)} s (statut « ${exp.status} ») — vérifier chez Chit Chats avant de racheter`);
  }

  // Le brouillon est devenu une expédition payée : il ne doit plus être réutilisé.
  if (ordre) oublierBrouillon(ordre);
  journaliser("chitchats.achat", "shipment", exp.id,
    { ordre, postage_type: postageType, prix: tarif.price }, null);

  return {
    labelId: String(exp.id),
    trackingNumber: exp.carrier_tracking_code || null,
    carrier: exp.carrier || tarif.carrier,
    service: tarif.service,
    serviceId: String(postageType),
    price: nombre(exp.payment_amount) ?? tarif.price,
    prixHT: nombre(exp.purchase_amount) ?? tarif.prixHT,
    currency: "CAD",
    dropOff: true,
    labelPdf: exp.postage_label_pdf_url || null,   // URL, pas base64 : Chit Chats héberge
    labelPng: exp.postage_label_png_url || null,
    labelZpl: exp.postage_label_zpl_url || null,
    trackingUrl: exp.tracking_url || null,
    statut: exp.status,
  };
}

async function annuler(shipmentId) {
  // `refund` sur une étiquette achetée, `DELETE` sur un brouillon : Chit Chats distingue les
  // deux, et appeler l'un pour l'autre échoue. On tente le remboursement, puis la suppression.
  try {
    const r = await appel("PATCH", `/shipments/${shipmentId}/refund`, {});
    journaliser("chitchats.remboursement", "shipment", shipmentId, { reponse: r || null }, null);
    // Une demande acceptée n'est pas un remboursement encaissé : Chit Chats la met en file.
    // Dire « remboursée » avant que ce soit vrai, c'est fausser la marge et le rapprochement.
    const etat = (r?.shipment || r || {}).status || null;
    return { labelId: shipmentId, annule: true, mode: "remboursement",
      refunded: String(etat).toLowerCase() === "refunded",
      remboursement: etat ? `état Chit Chats : ${etat}` : "demandé, pas encore confirmé" };
  } catch (e) {
    await appel("DELETE", `/shipments/${shipmentId}`);
    // Un brouillon n'a jamais été payé : rien à rembourser, et c'est une bonne nouvelle.
    return { labelId: shipmentId, annule: true, refunded: true, mode: "brouillon supprimé",
      remboursement: "aucun achat n'avait eu lieu", note: String(e.message || e) };
  }
}

async function suivre(shipmentId) {
  const exp = await expedition(shipmentId);
  return (exp.tracking_events || []).map((e) => ({
    date: e.time || e.date || null,
    status: e.status || e.code || null,
    description: e.message || e.description || e.details || "",
    lieu: e.location || null,
  }));
}

// ------------------------------------------------------------------- entretien

/**
 * Supprime les brouillons jamais achetés.
 *
 * Une cotation qui n'aboutit pas laisse un objet chez Chit Chats. Un par commande, ça se
 * range ; oublié pendant six mois, ça devient un compte illisible. `jours` borne ce qu'on
 * considère abandonné — un brouillon d'hier peut encore servir.
 */
async function menage({ jours = 7 } = {}) {
  const limite = new Date(Date.now() - jours * 86400000).toISOString();
  const restes = all("SELECT key, value FROM settings WHERE key LIKE 'chitchats.draft.%'")
    .map((r) => ({ cle: r.key, ...parse(r.value, {}) }))
    .filter((r) => r.a && r.a < limite);
  let n = 0, echecs = 0;
  for (const r of restes) {
    try { await supprimer(r.id); run("DELETE FROM settings WHERE key = ?", r.cle); n++; }
    catch { echecs++; }
  }
  return { supprimes: n, echecs, examines: restes.length };
}

// ------------------------------------------------------------------- diagnostic

/**
 * Test de connexion — `GET /shipments/count`, en lecture pure. Aucune expédition créée,
 * aucun sou dépensé, et la réponse suffit à prouver que le client et le jeton s'accordent.
 */
async function tester() {
  const debut = Date.now();
  try {
    const r = await appel("GET", "/shipments/count?limit=1");
    return {
      ok: true, ms: Date.now() - debut,
      milieu: ESSAI() ? "essai" : "prod", production: !ESSAI(),
      client: CLIENT(), expeditions: r?.count ?? r?.shipments_count ?? null,
      avis: ESSAI() ? "Bac à sable staging.chitchats.com — aucune étiquette facturée ni livrable." : null,
    };
  } catch (e) {
    const msg = String(e.message || e);
    // Un 404 sur le chemin du client ne veut pas dire « endpoint absent » : il veut dire que
    // Chit Chats ne connaît pas ce client sur CE site. Or `staging.chitchats.com` est un site
    // séparé, avec ses propres comptes et ses propres jetons — un identifiant de production
    // n'y existe pas. C'est l'explication la plus fréquente, et elle mérite d'être dite plutôt
    // que laissée à deviner.
    return {
      ok: false, ms: Date.now() - debut, milieu: ESSAI() ? "essai" : "prod",
      hote: ESSAI() ? "https://staging.chitchats.com" : "https://chitchats.com",
      erreur: msg,
      piste: /404/.test(msg) && ESSAI()
        ? "Le bac à sable est un site distinct : un compte et un jeton créés sur chitchats.com "
          + "n'existent pas sur staging.chitchats.com. Soit créer un compte d'essai là-bas, soit "
          + "poser CHITCHATS_ENV=prod — la lecture du compte ne coûte rien, seul l'achat débite."
        : /404/.test(msg)
          ? "Vérifier CHITCHATS_CLIENT_ID : le 404 porte sur le chemin du client, pas sur l'action."
          : null,
    };
  }
}

function etat() {
  return {
    configure: configure(),
    client: CLIENT() ? `${CLIENT().slice(0, 4)}••••` : "",
    jeton_present: !!JETON(),
    milieu: ESSAI() ? "essai" : "prod",
    production: !ESSAI(),
    hote: ESSAI() ? "https://staging.chitchats.com" : "https://chitchats.com",
    brouillons: one("SELECT COUNT(*) n FROM settings WHERE key LIKE 'chitchats.draft.%'").n,
  };
}

// ------------------------------------------------------------------- adaptateur

const adaptateurChitChats = {
  nom: "chitchats",
  async quote(envoi) { return (await coter(envoi, { ordre: envoi.orderId || null })).tarifs; },
  async buy(envoi, serviceId) { return await acheter(envoi, serviceId, { ordre: envoi.orderId || null }); },
  async void_(labelId) { return await annuler(labelId); },
  async track(labelId) { return await suivre(labelId); },
};

module.exports = {
  adaptateurChitChats, coter, acheter, annuler, suivre, expedition, supprimer,
  menage, tester, etat, configure, corpsExpedition, lireTarif, empreinteEnvoi,
  creerLot, lots, lot, supprimerLot, ajouterAuLot, retirerDuLot, rafraichirTarifs, retours,
};
