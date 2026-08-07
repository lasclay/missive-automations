/**
 * Freightcom / ClickShip — le courtier qui porte l'économie du projet.
 *
 * Écrit contre la spécification OpenAPI 2.10.0 publiée sur developer.freightcom.com, dont
 * les points structurants sont repris ici pour qu'on n'ait pas à la rouvrir :
 *
 *   base            https://external-api.freightcom.com   (un seul hôte, pas de bac à sable)
 *   authentifiction en-tête `Authorization: <clé>` — PAS `Bearer`, la spec dit apiKey
 *   POST /rate      → 202 + { request_id }        cotation ASYNCHRONE
 *   GET  /rate/{id} → { status:{done,total,complete}, rates:[…] }   résultats PARTIELS
 *   POST /shipment  → réservation, avec `unique_id` : clé d'idempotence NATIVE
 *   DELETE /shipment/{id}, GET /shipment/{id}/tracking-events, GET /services
 *
 * Trois de ces lignes décident de la conception :
 *
 * 1. **La cotation est asynchrone.** On soumet, puis on interroge. Naïvement branché sur un
 *    clic, ça fait attendre le préparateur au moment exact où il ne veut pas attendre.
 * 2. **`services[]` filtre le panel à la demande.** `status.total` est le nombre de services
 *    interrogés : c'est lui qui fait la durée. Demander six services au lieu de quarante est
 *    le levier de rapidité le plus fort, et il ne coûte rien.
 * 3. **`unique_id` est une clé d'idempotence.** Deux réservations avec le même `unique_id`
 *    rendent la même expédition au lieu d'en acheter deux. C'est la propriété qui empêche
 *    un double clic, un délai d'attente réseau ou un redémarrage de payer deux étiquettes.
 *
 * Les montants sont des **chaînes en cents** (« 4250 » = 42,50 $). Convertis à la frontière,
 * jamais promenés en flottant : c'est ainsi qu'on perd des sous.
 *
 * SÉCURITÉ — la clé ne vit que dans l'environnement Render. Contrairement à Postes Canada,
 * aucun repli sur la base : ce courtier engage la dépense de transport entière de Lasclay
 * (~99 000 $/an), et une clé rangée en base est une clé qu'une sauvegarde recopie, qu'un
 * export emporte et qu'un accès à l'écran révèle.
 */
const { all, one, run, dump, parse, maintenant, journaliser } = require("./db");
const crypto = require("node:crypto");

const BASE = process.env.FREIGHTCOM_URL || "https://external-api.freightcom.com";

/** Durée de vie locale d'un tarif, bornée en plus par le `valid_until` du transporteur. */
const TTL_MINUTES = Number(process.env.FREIGHTCOM_TTL_MIN || 90);
/** Ce qu'on accepte d'attendre en interactif avant de rendre ce qu'on a. */
const DELAI_INTERACTIF_MS = Number(process.env.FREIGHTCOM_DELAI_MS || 3500);
/** Appels simultanés au préchauffage. Au-delà, on n'accélère plus, on se fait limiter. */
const PARALLELE = Number(process.env.FREIGHTCOM_PARALLELE || 4);

function cle() {
  const k = process.env.FREIGHTCOM_API_KEY || "";
  if (!k) throw new Error("FREIGHTCOM_API_KEY absente — la clé se définit dans l'environnement Render, jamais en base");
  return k;
}

const configure = () => !!process.env.FREIGHTCOM_API_KEY;

/** L'hôte visé est-il celui du bac à sable ? Relu à chaud : la variable peut changer. */
const essai = () => /ssd-test|sandbox|\btest\./i.test(BASE);

// ------------------------------------------------------------------- transport

async function appel(methode, chemin, corps = null) {
  const r = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: {
      Authorization: cle(),
      ...(corps ? { "Content-Type": "application/json" } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  }).catch((e) => { throw new Error(`Freightcom injoignable : ${e.message}`); });

  const texte = await r.text();
  let j = null;
  try { j = texte ? JSON.parse(texte) : null; } catch { /* réponse non JSON */ }
  if (!r.ok) {
    // Les erreurs de l'API portent un message exploitable ; le code HTTP seul ne se corrige pas.
    const m = j?.message || j?.error || (Array.isArray(j?.errors) ? j.errors.map((e) => e.message || e).join(" · ") : null);
    throw new Error(`Freightcom ${r.status}${m ? ` : ${m}` : texte ? ` : ${texte.slice(0, 200)}` : ""}`);
  }
  return j;
}

// ------------------------------------------------------------------- conversions

/** Cents en chaîne → dollars. La conversion se fait ici et nulle part ailleurs. */
const enDollars = (m) => (m && m.value !== undefined ? Math.round(Number(m.value)) / 100 : null);
const enCents = (d) => String(Math.round(Number(d || 0) * 100));
const jour = (d = new Date()) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
const deJour = (o) => (o && o.year ? `${o.year}-${String(o.month).padStart(2, "0")}-${String(o.day).padStart(2, "0")}` : null);
const cm = (po) => Math.max(1, Math.round(Number(po || 0) * 2.54));

/**
 * Palier de poids — 5 g, **arrondi vers le haut**, et c'est le même des deux côtés.
 *
 * Le cache regroupe des envois par empreinte ; si l'empreinte arrondissait le poids mais que
 * la cotation partait avec le poids exact, deux colis voisins se partageraient un prix qui
 * n'est celui que de l'un des deux — celui coté en premier. Sur des paliers de facturation,
 * c'est un prix trop bas qu'on découvre sur la facture.
 *
 * On cote donc le palier, pas le gramme. Vers le haut : mieux vaut coter 485 g et payer 483
 * que l'inverse. Et 5 g plutôt que 10 pour rester loin de la frontière des 500 g, qui décide
 * de l'admissibilité au tarif de dépôt.
 */
const palier = (g) => Math.max(5, Math.ceil(Number(g || 0) / 5) * 5);

/**
 * Le palier en kilogrammes, sans arrondi supplémentaire.
 *
 * La première version faisait `Math.round(palier / 10) / 100`, soit un second arrondi à deux
 * décimales : **495 g partait à 0,50 kg**. Le balayage de poids l'a montré — le tarif de
 * dépôt disparaissait entre 480 et 495 g alors que le programme va jusqu'à 500. Cinq
 * grammes de rembourrage inventés faisaient perdre le seul tarif qui porte l'économie du
 * projet, sur toute la bande 491–500 g.
 *
 * Trois décimales suffisent au gramme près, et l'API type ce champ en nombre : rien
 * n'obligeait à arrondir.
 */
const kg = (g) => Math.max(0.005, Math.round(palier(g)) / 1000);

function adresseFC(a = {}, { residentiel = false } = {}) {
  return {
    name: a.company || a.name || "Lasclay",
    address: {
      address_line_1: a.street1 || "",
      address_line_2: a.street2 || undefined,
      city: a.city || "",
      region: a.state || "",
      country: (a.country || "CA").toUpperCase(),
      postal_code: String(a.postalCode || "").toUpperCase().replace(/\s/g, ""),
    },
    // Résidentiel : la donnée de l'adresse d'abord, le défaut ensuite.
    //
    // La première version forçait `true` sur toute destination. C'était une hypothèse de ma
    // part, pas une contrainte de l'API — et elle coûte : la surtaxe résidentielle de GLS
    // tourne autour d'un dollar, soit une bonne part de l'écart entre le clone et
    // l'interface web de ClickShip.
    //
    // Le défaut reste `true` pour une destination client, parce que c'est la vérité dans la
    // quasi-totalité des envois de Lasclay, et parce que déclarer commercial un domicile fait
    // arriver la surtaxe **sur la facture** plutôt que dans le devis. Un tarif plus bas qui
    // se corrige après coup est pire qu'un tarif juste. Mais l'adresse peut désormais dire
    // le contraire, et `FREIGHTCOM_RESIDENTIEL=0` permet de trancher globalement.
    residential: a.residential !== undefined ? !!a.residential
      : (process.env.FREIGHTCOM_RESIDENTIEL === "0" ? false : residentiel),
    contact_name: a.name || undefined,
    phone_number: a.phone ? { number: String(a.phone).replace(/\D/g, "").slice(0, 15) } : undefined,
    email_addresses: a.email ? [a.email] : undefined,
    // Lasclay n'envoie pas de courriel par le courtier : le suivi part du clone, dans sa
    // voix et sa langue. Laisser le transporteur écrire au client à notre place créerait
    // deux sources de vérité dans la boîte support.
    receives_email_updates: false,
  };
}

function scenario(envoi, { services = null, dateExpedition = null } = {}) {
  const p = envoi.parcel || {};
  const corps = {
    details: {
      origin: adresseFC(envoi.from),
      destination: adresseFC(envoi.to, { residentiel: true }),
      expected_ship_date: dateExpedition || jour(),
      packaging_type: "package",
      // `packaging_properties` est un `oneOf` à quatre variantes ; celle-ci est reconnue par
      // la présence de `packages`. Deux pièges que la première version a payés d'un « 400 bad
      // or missing data » sans détail : les mesures sont des **nombres**, pas des chaînes
      // (contrairement aux montants, qui eux sont des chaînes en cents), et `description` est
      // **obligatoire** sur chaque colis.
      packaging_properties: {
        packages: [{
          description: envoi.description || "Marchandise",
          measurements: {
            weight: { unit: "kg", value: kg(p.weightG) },
            cuboid: { unit: "cm", l: cm(p.lengthIn), w: cm(p.widthIn), h: cm(p.heightIn) },
          },
        }],
      },
      shipment_classification: "B2C",
    },
  };
  // XCover est un service de ShipStation, pas du transporteur : il s'éteint avec
  // l'abonnement. Ce qui le remplace passe par ce champ-ci, et par lui seul.
  //
  // `type` distingue qui porte le risque : « carrier » achète la couverture du transporteur
  // qui livre, « freightcom » celle du courtier. Les deux se facturent en surcharge, donc
  // apparaissent dans `prixHT` — l'assurance n'est pas un supplément invisible au moment de
  // comparer.
  //
  // ON N'ENVOIE RIEN TANT QUE `FREIGHTCOM_ASSURANCE_TYPE` N'EST PAS POSÉE. Mesuré sur le
  // compte réel, à 300 g, panel complet des deux côtés (153/153 services) :
  //
  //     sans assurance      23 tarifs   Canpar, FedEx, GLS, ICS, Purolator, UPS
  //     assuré 100 $         9 tarifs   Canpar, GLS, ICS, Purolator
  //                                     et 0 des 9 ne porte la couverture
  //
  // Demander la couverture coûtait donc **14 tarifs sur 23** — FedEx et UPS disparaissaient
  // entièrement du comparateur — et n'achetait aucune protection. Une opération strictement
  // perdante ne doit pas être le défaut. Freightcom filtre les services qui ne peuvent pas
  // honorer le champ ; avec un `type` que le compte n'accepte pas, il les filtre tous.
  //
  // `verifier_freightcom.js --assurance` cherche le type que le compte accepte ; une fois
  // trouvé, on le pose dans les réglages Render et la couverture repart. D'ici là, mieux vaut
  // un panel entier sans assurance qu'un panel amputé sans assurance non plus.
  //
  // `assuranceForcee` court-circuite tout ça : c'est le bouton « Assurance » de l'écran, où
  // l'opérateur demande explicitement la couverture EN SACHANT qu'il va perdre des tarifs.
  // C'est le modèle de ClickShip — les prix d'abord, « + Additional Insurance » ensuite — et
  // c'est le bon : perdre des tarifs à son insu est un défaut, les perdre volontairement est
  // un arbitrage.
  const montant = Number(envoi.insurance || 0);
  const typeAssurance = process.env.FREIGHTCOM_ASSURANCE_TYPE
    || (envoi.assuranceForcee ? "freightcom" : "");
  if (montant > 0 && typeAssurance) {
    corps.details.insurance = { type: typeAssurance,
      total_cost: { currency: envoi.currency || "CAD", value: enCents(montant) } };
  }
  if (services && services.length) corps.services = services;
  return corps;
}

// ------------------------------------------------------------------- cache

/**
 * L'empreinte porte le **scénario**, pas la commande.
 *
 * Deux colis de 480 g vers le même code postal coûtent le même prix, qu'ils appartiennent à
 * la commande L-50774 ou à la L-50773. C'est ce qui fait que le cache travaille chez
 * Lasclay : mêmes articles, mêmes poids, mêmes destinations, tous les jours.
 */
function empreinte(envoi, services) {
  const p = envoi.parcel || {};
  const norme = {
    // La demande explicite fait partie du scénario : sans elle, une cotation assurée
    // récupérerait le prix nu mis en cache une minute plus tôt.
    f: !!envoi.assuranceForcee,
    o: String(envoi.from?.postalCode || "").toUpperCase().replace(/\s/g, ""),
    d: String(envoi.to?.postalCode || "").toUpperCase().replace(/\s/g, ""),
    pays: (envoi.to?.country || "CA").toUpperCase(),
    res: !!(envoi.to?.residential ?? true),
    // Exactement le palier avec lequel on cote : voir `palier()`. Toute divergence entre
    // les deux ferait partager un prix à des colis qui n'ont pas le même.
    g: palier(p.weightG),
    l: cm(p.lengthIn), w: cm(p.widthIn), h: cm(p.heightIn),
    a: Number(envoi.insurance || 0),
    s: (services || []).slice().sort().join(","),
    j: deJour(jour()),
  };
  return crypto.createHash("sha256").update(JSON.stringify(norme)).digest("hex").slice(0, 32);
}

function lireCache(cle_) {
  const r = one("SELECT * FROM rate_cache WHERE cle = ? AND expire_a > ?", cle_, maintenant());
  return r ? { tarifs: parse(r.tarifs, []), complet: !!r.complet, cree_a: r.cree_a, ms: r.ms } : null;
}

function ecrireCache(cle_, tarifs, { complet, ms }) {
  // Le tarif expire au plus tôt entre le TTL local et le `valid_until` annoncé. Acheter sur
  // un devis périmé, c'est découvrir l'écart sur la facture.
  const local = new Date(Date.now() + TTL_MINUTES * 60000);
  const bornes = tarifs.map((t) => t.validJusquau).filter(Boolean)
    .map((d) => new Date(`${d}T23:59:59`)).filter((d) => !isNaN(d));
  const exp = bornes.length ? new Date(Math.min(local, ...bornes)) : local;
  run(`INSERT INTO rate_cache(cle,tarifs,cree_a,expire_a,complet,ms) VALUES(?,?,?,?,?,?)
       ON CONFLICT(cle) DO UPDATE SET tarifs=excluded.tarifs, cree_a=excluded.cree_a,
         expire_a=excluded.expire_a, complet=excluded.complet, ms=excluded.ms`,
    cle_, dump(tarifs), maintenant(), exp.toISOString(), complet ? 1 : 0, ms);
}

/** Entretien : un cache qu'on ne purge jamais finit par peser plus que ce qu'il fait gagner. */
function purgerCache() {
  const n = one("SELECT COUNT(*) n FROM rate_cache WHERE expire_a <= ?", maintenant()).n;
  run("DELETE FROM rate_cache WHERE expire_a <= ?", maintenant());
  return n;
}

// ------------------------------------------------------------------- cotation

function lireTarif(t, demandee = 0, force = false) {
  // Ce que l'API dit de la couverture, pas ce qu'on espérait qu'elle en dise.
  //
  // Freightcom ne renvoie pas de champ « assurance » : la couverture, quand elle est
  // accordée, apparaît comme une **surcharge**. Sa présence est donc la seule preuve que
  // l'appel a été routé et accepté — et son montant, le prix réel de la protection.
  // L'absence de surcharge alors qu'on a demandé une couverture est un signal, pas un
  // silence : elle veut dire que le transporteur ne la vend pas sur ce service.
  const ligne = (t.surcharges || []).find((s) =>
    /insur|assur|coverage|declared/i.test(`${s.type || ""} ${s.name || ""}`));
  const type = process.env.FREIGHTCOM_ASSURANCE_TYPE || (force ? "freightcom" : "");
  const assurance = {
    demandee: Number(demandee) || 0,
    // Trois états, pas deux. « Non transmise » n'est pas « refusée » : la première est une
    // décision de notre côté, la seconde un refus du transporteur. Les confondre faisait
    // clignoter une alarme rouge sur un champ qu'on a choisi de ne pas envoyer — et un écran
    // qui crie tout le temps ne prévient plus de rien.
    transmise: Number(demandee) > 0 && !!type,
    appliquee: !!ligne,
    cout: ligne ? enDollars(ligne.amount || ligne.total) : 0,
    mention: ligne ? (ligne.name || ligne.type) : null,
    type: demandee > 0 ? (type || null) : null,
    note: !demandee ? "aucune couverture demandée"
      : !type ? "non transmise à Freightcom : aucun type d'assurance validé sur ce compte "
        + "(la demander retirait 14 tarifs sur 23 sans rien couvrir) — voir FREIGHTCOM_ASSURANCE_TYPE"
      : ligne ? null : "demandée, absente de la réponse — ce service ne la vend pas",
  };
  return {
    carrier: t.carrier_name || "",
    service: t.service_name || "",
    serviceId: t.service_id || "",
    price: enDollars(t.total),
    /**
     * Le prix hors taxes — base + surcharges.
     *
     * ClickShip affiche ce montant dans sa colonne « Total Price » ; l API, elle, rend un
     * `total` qui inclut les taxes. C est toute la différence relevée : GLS 10,01 $ contre
     * 11,06 $, UPS 13,72 $ contre 15,17 $, soit +10,5 % des deux côtés — et zéro sur le
     * programme Canada Post, qui n en porte pas.
     *
     * C est aussi le montant à employer pour raisonner : Lasclay récupère la TPS et la TVQ en
     * crédits de taxe sur intrants. Comparer des prix taxes comprises fausserait chaque calcul
     * de marge de l application.
     */
    prixHT: Math.round((enDollars(t.base) || 0) * 100
      + (t.surcharges || []).reduce((n, x) => n + Math.round((enDollars(x.amount || x.total) || 0) * 100), 0)) / 100,
    base: enDollars(t.base),
    surcharges: (t.surcharges || []).map((s) => ({ type: s.type, nom: s.name || s.type, montant: enDollars(s.amount || s.total) })),
    taxes: (t.taxes || []).reduce((s, x) => s + (enDollars(x.amount || x.total) || 0), 0) || 0,
    detailTaxes: (t.taxes || []).map((x) => ({ type: x.type, montant: enDollars(x.amount || x.total) })),
    currency: t.total?.currency || "CAD",
    transitDays: t.transit_time_days ?? t.transit_time?.days ?? null,
    validJusquau: deJour(t.valid_until),
    // Le drapeau qui porte l'économie du projet. Freightcom ne le publie pas comme un champ :
    // le service de dépôt se reconnaît à son nom. Tant qu'on n'a pas vu une réponse réelle,
    // on le déduit du libellé — et `FREIGHTCOM_SERVICES_DEPOT` permet de le figer par
    // identifiant dès que la première cotation réelle nous les aura donnés.
    dropOff: estDepot(t),
    assurance,
  };
}

const IDS_DEPOT = String(process.env.FREIGHTCOM_SERVICES_DEPOT || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Reconnaître le tarif de dépôt.
 *
 * Première cotation réelle, 5 août 2026, envoi de référence de l'audit : 20 tarifs, dont
 * `canadapost-exclusive.expedited-parcel` à **6,61 $** — quand le suivant, GLS Ground, est à
 * 10,41 $. C'est le programme « envoi unique sous 500 g » que l'audit chiffrait à 6,31 $ dans
 * l'interface web, et il ne porte **nulle part** la mention « drop-off » : Freightcom
 * l'appelle *Canada Post Exclusive Program*.
 *
 * Le repérage par libellé seul serait donc passé à côté du seul tarif qui compte. On ajoute
 * le préfixe observé, et `FREIGHTCOM_SERVICES_DEPOT` permet de figer la liste par identifiant
 * dès qu'elle est confirmée — parce qu'une reconnaissance par motif finit toujours par se
 * tromper le jour où le fournisseur renomme.
 */
function estDepot(t) {
  if (IDS_DEPOT.length) return IDS_DEPOT.includes(String(t.service_id));
  const texte = `${t.service_name || ""} ${t.service_id || ""}`;
  return /drop[\s-]?off|depot|dépôt|canadapost-exclusive|canada post exclusive/i.test(texte);
}

/**
 * Cotation complète : soumission puis interrogation, avec sortie anticipée.
 *
 * `deadline` est le cœur du compromis. En interactif on rend ce qu'on a au bout de quelques
 * secondes — un tarif affiché en 2 s vaut mieux que le panel complet en 12 s, surtout quand
 * les six services demandés sont déjà revenus. En préchauffage, on laisse aller jusqu'au
 * bout : personne n'attend.
 */
async function coterDirect(envoi, { services = null, deadlineMs = DELAI_INTERACTIF_MS, signal = null } = {}) {
  const debut = Date.now();
  const soumission = await appel("POST", "/rate", scenario(envoi, { services }));
  const id = soumission?.request_id || soumission?.id || soumission?.rate_id;
  if (!id) throw new Error("Freightcom n'a pas renvoyé d'identifiant de cotation");

  let tarifs = [], statut = { done: false, total: null, complete: 0 };
  // Interrogation à intervalle croissant : serrée au début parce que les premiers tarifs
  // arrivent vite, relâchée ensuite pour ne pas marteler l'API sur les traînards.
  const pauses = [250, 350, 500, 700, 900, 1200, 1500, 2000];
  for (let essai = 0; ; essai++) {
    const r = await appel("GET", `/rate/${encodeURIComponent(id)}`);
    statut = r?.status || statut;
    if (Array.isArray(r?.rates) && r.rates.length)
      tarifs = r.rates.map((t) => lireTarif(t, Number(envoi.insurance || 0), !!envoi.assuranceForcee));
    if (statut.done) break;
    if (signal?.aborted) break;
    if (Date.now() - debut > deadlineMs) break;
    await new Promise((ok) => setTimeout(ok, pauses[Math.min(essai, pauses.length - 1)]));
  }
  tarifs.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  return { tarifs, complet: !!statut.done, statut, ms: Date.now() - debut, rateId: id };
}

/**
 * Cotation vue par le reste de l'application : le cache d'abord, le réseau si besoin.
 *
 * `frais` force le rafraîchissement — utile juste avant un achat, où l'on veut le prix du
 * moment et non celui d'il y a une heure.
 */
async function coter(envoi, { services = null, deadlineMs = DELAI_INTERACTIF_MS, frais = false } = {}) {
  const k = empreinte(envoi, services || servicesRetenus());
  if (!frais) {
    const c = lireCache(k);
    if (c && c.complet) return { ...c, source: "cache" };
    // Un cache partiel sert quand même à afficher tout de suite, mais on relance derrière.
    if (c) return { ...c, source: "cache-partiel" };
  }
  const r = await coterDirect(envoi, { services: services || servicesRetenus(), deadlineMs });
  if (r.tarifs.length) ecrireCache(k, r.tarifs, { complet: r.complet, ms: r.ms });
  return { ...r, source: "reseau" };
}

/**
 * Le panel demandé par défaut.
 *
 * Vide = tous les services, c'est-à-dire l'attente maximale. `FREIGHTCOM_SERVICES` se
 * renseigne dès la première exploration réelle : c'est le réglage qui divise le temps de
 * cotation, et il ne se devine pas — il se relève sur `GET /services`.
 */
function servicesRetenus() {
  return String(process.env.FREIGHTCOM_SERVICES || "").split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Le catalogue du compte. `brut` est rendu à côté de la liste : quand celle-ci est vide, la
 * seule question qui compte est « vide, ou mal lue ? », et seule la réponse crue y répond.
 *
 * La forme n'est pas garantie identique d'un environnement à l'autre — l'hôte d'essai et la
 * production ne rendent pas toujours la même enveloppe. On accepte donc les trois formes
 * plausibles plutôt que de conclure « aucun service » sur une clé mal devinée.
 */
async function services() {
  const r = await appel("GET", "/services");
  const brut = Array.isArray(r) ? r : (r?.services || r?.data || r?.results || []);
  const liste = (Array.isArray(brut) ? brut : []).map((s) => ({
    id: s.id || s.service_id || s.code,
    transporteur: s.carrier_name || s.carrier || s.carrier_id,
    nom: s.service_name || s.name,
  }));
  liste.reponse = r;
  return liste;
}

/**
 * Verse le panel réel dans la table `services`, marqué `source = 'freightcom'`.
 *
 * C'est ce qui rend la liste déroulante d'expédition honnête : jusqu'ici elle n'offrait que
 * les 97 libellés migrés depuis ShipStation, dont aucun n'est achetable ici. Les anciens ne
 * sont pas supprimés — ils servent à relire l'historique — mais ils sont marqués pour ce
 * qu'ils sont, et l'écran les sépare.
 */
/**
 * L'envoi qui sert à découvrir le panel quand `GET /services` ne dit rien.
 *
 * Sur le compte d'essai, cet appel renvoie **zéro service** alors qu'une cotation en ramène
 * vingt sur cent cinquante-trois interrogés. L'endpoint de catalogue n'est donc pas une
 * source fiable, et s'y fier laissait le référentiel vide. Une cotation de référence l'est :
 * elle dit ce que le compte sait vraiment vendre.
 */
const ENVOI_SONDE = {
  from: { name: "Lasclay", company: "Les Produits Lasclay", street1: "1 rue des Capucins",
    city: "Québec", state: "QC", country: "CA", postalCode: "G1J 3R4" },
  to: { name: "Sonde", street1: "1 chemin du Village", city: "Lac-Beauport", state: "QC",
    country: "CA", postalCode: "G3B 0P2", residential: true },
  parcel: { weightG: 45, lengthIn: 9, widthIn: 6, heightIn: 1 },
  value: 40, currency: "CAD",
};

async function panelReel() {
  const liste = await services();
  if (liste.length) return { liste, via: "catalogue" };
  const r = await coterDirect(ENVOI_SONDE, { deadlineMs: 25000 });
  return {
    liste: r.tarifs.map((t) => ({ id: t.serviceId, transporteur: t.carrier, nom: t.service })),
    via: "cotation",
  };
}

function synchroniserServices() {
  return panelReel().then(({ liste, via }) => {
    const codeDe = (t) => String(t || "autre").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    let ajoutes = 0, majs = 0;
    for (const s of liste) {
      const existe = one("SELECT id FROM services WHERE id = ?", String(s.id));
      run(`INSERT INTO services(id,carrier_code,name,domestic,international,drop_off,source)
           VALUES(?,?,?,1,1,?,'freightcom')
           ON CONFLICT(id) DO UPDATE SET carrier_code=excluded.carrier_code, name=excluded.name,
             drop_off=excluded.drop_off, source='freightcom'`,
        String(s.id), codeDe(s.transporteur), s.nom,
        estDepot({ service_name: s.nom, service_id: s.id }) ? 1 : 0);
      existe ? majs++ : ajoutes++;
    }
    // Tout ce qui n'a pas de source est antérieur : c'est de l'héritage ShipStation.
    run("UPDATE services SET source = 'shipstation' WHERE source IS NULL");
    journaliser("freightcom.services", "services", "sync", { ajoutes, majs, total: liste.length, via }, null);
    return { ajoutes, majs, total: liste.length, via,
      depot: liste.filter((s) => estDepot({ service_name: s.nom, service_id: s.id })).length };
  });
}

/**
 * Préchauffage.
 *
 * 96 % des étiquettes de Lasclay sont achetées en lot. Le moment où l'on connaît le besoin
 * — la constitution du lot, l'arrivée d'une commande à expédier — précède de plusieurs
 * minutes celui où le préparateur regarde le prix. Coter dans cet intervalle, c'est
 * supprimer l'attente sans rien accélérer côté Freightcom.
 *
 * Rend un bilan plutôt que de lever : un préchauffage qui échoue ne doit jamais empêcher le
 * chemin normal, il doit seulement ne pas avoir aidé.
 */
async function prechauffer(envois, { concurrence = PARALLELE } = {}) {
  const bilan = { demandes: envois.length, deja: 0, cotes: 0, echecs: 0, ms: 0 };
  const debut = Date.now();
  const file = envois.slice();
  const ouvrier = async () => {
    while (file.length) {
      const e = file.shift();
      const k = empreinte(e, servicesRetenus());
      const c = lireCache(k);
      if (c && c.complet) { bilan.deja++; continue; }
      try {
        // Pas de date limite : personne n'attend, on laisse le panel se compléter.
        const r = await coterDirect(e, { services: servicesRetenus(), deadlineMs: 25000 });
        if (r.tarifs.length) { ecrireCache(k, r.tarifs, { complet: r.complet, ms: r.ms }); bilan.cotes++; }
        else bilan.echecs++;
      } catch { bilan.echecs++; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrence) }, ouvrier));
  bilan.ms = Date.now() - debut;
  return bilan;
}

// ------------------------------------------------------------------- réservation

/**
 * Clé d'idempotence.
 *
 * Déterministe à partir de la commande, donc identique d'un essai à l'autre : c'est ce qui
 * fait que rejouer un achat interrompu ne double pas la dépense. `tentative` n'est incrémenté
 * que délibérément — après une annulation — parce que Freightcom réutilise l'identifiant
 * d'une expédition annulée ou en erreur, et refuse d'en créer deux sur une réussie.
 */
function identifiantUnique(envoi, serviceId, tentative = 0) {
  const base = `LAS-${envoi.orderId || envoi.order_number || "x"}-${serviceId}`;
  return (tentative ? `${base}-${tentative}` : base).slice(0, 128);
}

/**
 * ACHÈTE. Argent réel.
 *
 * Trois protections avant la dépense, et elles sont ici parce que c'est le seul endroit que
 * tous les chemins d'achat traversent :
 *
 *   1. le service acheté doit venir d'un tarif que **le serveur** a coté, jamais d'une valeur
 *      arrivée du navigateur — sinon un appel modifié réserve le service le plus cher ;
 *   2. le devis ne doit pas être périmé — sinon on découvre l'écart sur la facture ;
 *   3. `unique_id` rend l'opération rejouable sans risque.
 */
async function reserver(envoi, serviceId, { tentative = 0, methodePaiement = null, references = [] } = {}) {
  /*
   * On n'achète pas dans le bac à sable.
   *
   * L'hôte d'essai de Freightcom accepte la réservation, rend un identifiant, et ne produit
   * RIEN : aucune étiquette, aucun numéro de suivi, aucune facture chez ClickShip. Le clone
   * a pourtant fait ce qu'il fait après un achat réussi — écrire l'expédition, passer la
   * commande à « expédiée », dire « Étiquette créée — 10,41 CAD ». La commande était donc
   * marquée expédiée sans que rien ne parte, et c'est le pire des deux mondes : le colis
   * n'existe pas et l'écran affirme le contraire.
   *
   * La cotation reste permise sur cet hôte — c'est à ça qu'il sert. L'achat, non.
   */
  if (essai()) {
    throw new Error(`achat refusé : ${BASE} est l'hôte d'ESSAI de Freightcom. `
      + `Il accepte la réservation mais ne produit ni étiquette ni suivi, et rien n'apparaît `
      + `sur la facture ClickShip. Retirer FREIGHTCOM_URL des réglages pour revenir à la `
      + `production, avec la clé de production.`);
  }
  const cotation = await coter(envoi, { frais: true, deadlineMs: 20000 });
  const tarif = cotation.tarifs.find((t) => String(t.serviceId) === String(serviceId));
  if (!tarif) throw new Error(`service ${serviceId} absent de la cotation du moment — recoter avant d'acheter`);
  if (tarif.validJusquau && tarif.validJusquau < deJour(jour()))
    throw new Error(`devis expiré le ${tarif.validJusquau} — recoter avant d'acheter`);

  const corps = {
    unique_id: identifiantUnique(envoi, serviceId, tentative),
    service_id: String(serviceId),
    ...(methodePaiement || process.env.FREIGHTCOM_PAYMENT_METHOD_ID
      ? { payment_method_id: methodePaiement || process.env.FREIGHTCOM_PAYMENT_METHOD_ID } : {}),
    ...scenario(envoi, { services: [String(serviceId)] }),
  };
  if (references.length) corps.details.reference_codes = references.map(String).slice(0, 3);

  const r = await appel("POST", "/shipment", corps);
  const shipmentId = r?.shipment_id || r?.id;
  journaliser("freightcom.reserve", "shipment", shipmentId || "?",
    { unique_id: corps.unique_id, service: serviceId, prix: tarif.price }, null);

  return {
    labelId: shipmentId || null,
    trackingNumber: r?.tracking_number || r?.primary_tracking_number || null,
    carrier: tarif.carrier,
    service: tarif.service,
    serviceId: String(serviceId),
    price: tarif.price,
    currency: tarif.currency || "CAD",
    dropOff: tarif.dropOff,
    labelPdf: null,     // les documents arrivent par /shipment/{id}, une fois la réservation aboutie
    customsPdf: null,
    uniqueId: corps.unique_id,
    brut: r,
  };
}

async function expedition(shipmentId) {
  return await appel("GET", `/shipment/${encodeURIComponent(shipmentId)}`);
}

async function annuler(shipmentId) {
  await appel("DELETE", `/shipment/${encodeURIComponent(shipmentId)}`);
  journaliser("freightcom.annule", "shipment", shipmentId, {}, null);
  return { labelId: shipmentId, refunded: true };
}

async function suivre(shipmentId) {
  const r = await appel("GET", `/shipment/${encodeURIComponent(shipmentId)}/tracking-events`);
  return (r?.events || r?.tracking_events || []).map((e) => ({
    date: e.timestamp || e.date || null,
    status: e.status || e.code || null,
    description: e.message || e.description || "",
    lieu: e.location || null,
  }));
}

// ------------------------------------------------------------------- diagnostic

/**
 * Test de connexion — `GET /services`, en lecture pure, aucune cotation facturable.
 *
 * Rend aussi le panel, parce que c'est exactement ce qu'il faut relever pour renseigner
 * `FREIGHTCOM_SERVICES` et diviser le temps de cotation.
 */
async function tester() {
  const debut = Date.now();
  try {
    const liste = await services();
    const depot = liste.filter((s) => /drop[\s-]?off|depot|dépôt/i.test(`${s.nom} ${s.id}`));
    return {
      ok: true, ms: Date.now() - debut, n: liste.length,
      transporteurs: [...new Set(liste.map((s) => s.transporteur))].sort(),
      depot, services: liste,
      panel: servicesRetenus(),
      avis: servicesRetenus().length ? null
        : "FREIGHTCOM_SERVICES n'est pas renseignée : chaque cotation interroge tout le panel, "
          + "ce qui est le réglage le plus lent. Choisir les services utiles dans la liste ci-dessus.",
    };
  } catch (e) {
    return { ok: false, ms: Date.now() - debut, erreur: String(e.message || e) };
  }
}

function etat() {
  const c = one("SELECT COUNT(*) n FROM rate_cache WHERE expire_a > ?", maintenant()).n;
  return {
    configure: configure(),
    base: BASE,
    panel: servicesRetenus(),
    services_depot: IDS_DEPOT,
    methode_paiement: !!process.env.FREIGHTCOM_PAYMENT_METHOD_ID,
    ttl_minutes: TTL_MINUTES,
    delai_interactif_ms: DELAI_INTERACTIF_MS,
    cache_valide: c,
    // Aucune variable d'environnement n'est jamais renvoyée : seulement leur présence.
  };
}

// ------------------------------------------------------------------- adaptateur

const adaptateurFreightcom = {
  nom: "freightcom",
  /**
   * La cotation est asynchrone et bornée dans le temps : au bout de `deadlineMs` on rend ce
   * qui est arrivé. Un panel de quarante services dont douze ont répondu **ressemble** à un
   * panel complet — même liste déroulante, même « moins cher » en tête — alors qu'il manque
   * peut-être le transporteur le moins cher. On fait donc voyager l'état du panel avec les
   * tarifs, pour que l'écran puisse le dire au lieu de laisser croire.
   */
  async quote(envoi, { complet = false } = {}) {
    // `complet` : on attend que `status.done` soit vrai, quitte à y passer une minute. C'est
    // le seul mode qui garantit que le moins cher affiché EST le moins cher.
    const r = await coter(envoi, complet
      ? { deadlineMs: Number(process.env.FREIGHTCOM_DELAI_COMPLET_MS || 60000), frais: true }
      : {});
    const t = r.tarifs || [];
    t.panel = { complet: !!r.complet, repondu: r.statut?.complete ?? t.length,
      total: r.statut?.total ?? null, source: r.source, ms: r.ms };
    return t;
  },
  async buy(envoi, serviceId) { return await reserver(envoi, serviceId); },
  async void_(labelId) { return await annuler(labelId); },
  async track(labelId) { return await suivre(labelId); },
};

module.exports = {
  adaptateurFreightcom, coter, coterDirect, prechauffer, reserver, annuler, suivre, synchroniserServices,
  expedition, services, tester, etat, purgerCache, empreinte, lireCache, ecrireCache,
  identifiantUnique, scenario, lireTarif, configure, essai, BASE,
};
