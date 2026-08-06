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
  const hote = ESSAI() ? "https://staging.chitchats.com" : "https://chitchats.com";
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
    province_code: to.state || undefined,
    postal_code: String(to.postalCode || "").toUpperCase().replace(/\s/g, "") || undefined,
    country_code: pays,
    phone: to.phone || undefined,
    email: to.email || undefined,

    return_name: from.company || from.name || undefined,
    return_address_1: from.street1 || undefined,
    return_city: from.city || undefined,
    return_province_code: from.state || undefined,
    return_postal_code: String(from.postalCode || "").toUpperCase().replace(/\s/g, "") || undefined,

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
    order_store: "Lasclay",
    ship_date: "today",
  };
}

/** Un tarif Chit Chats, ramené au contrat commun de `lib/carrier.js`. */
function lireTarif(t) {
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
    String(envoi.to?.postalCode || "").toUpperCase().replace(/\s/g, ""),
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
    return { tarifs: (exp.rates || []).map(lireTarif).sort(cheap), shipmentId: exp.id, reutilise: true };
  }

  // L'envoi a changé (ou il n'y avait rien) : l'ancien brouillon ne vaut plus rien.
  if (memo) { await supprimer(memo.id).catch(() => {}); oublierBrouillon(ordre); }

  const r = await appel("POST", "/shipments", corpsExpedition(envoi, { ordre }));
  const exp = r?.shipment || r;
  const tarifs = (exp.rates || []).map(lireTarif).sort(cheap);

  if (ordre) memoriserBrouillon(ordre, exp.id, empreinte);
  else await supprimer(exp.id).catch(() => {});   // cotation exploratoire : on ne laisse rien

  return { tarifs, shipmentId: ordre ? exp.id : null, reutilise: false };
}

const cheap = (a, b) => (a.prixHT ?? a.price ?? 1e9) - (b.prixHT ?? b.price ?? 1e9);

async function supprimer(id) { return await appel("DELETE", `/shipments/${id}`); }
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
    await appel("PATCH", `/shipments/${shipmentId}/refund`, {});
    journaliser("chitchats.remboursement", "shipment", shipmentId, {}, null);
    return { labelId: shipmentId, refunded: true, mode: "remboursement" };
  } catch (e) {
    await appel("DELETE", `/shipments/${shipmentId}`);
    return { labelId: shipmentId, refunded: true, mode: "brouillon supprimé", note: String(e.message || e) };
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
};
