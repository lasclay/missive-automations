/**
 * Autocomplétion d'adresse — Google Places, appelée par le serveur, jamais par la page.
 *
 * Pourquoi passer par le serveur
 * ------------------------------
 * Le SDK JavaScript de Google exigerait de publier la clé d'API dans la page et d'ouvrir la
 * CSP à `maps.googleapis.com`. Le clone tient dans un fichier avec une CSP par empreinte,
 * précisément pour qu'aucun script tiers ne s'y glisse ; et une clé publiée est une clé qu'on
 * finit par retrouver facturée par quelqu'un d'autre. On appelle donc l'API REST côté serveur,
 * la clé reste dans l'environnement Render, et la page ne parle qu'à sa propre origine.
 *
 * Deux appels, comme chez Google
 * ------------------------------
 *   1. `suggestions(saisie)` — POST /v1/places:autocomplete, une liste de propositions.
 *   2. `details(placeId)`    — GET  /v1/places/{id}, l'adresse en composants.
 *
 * Google facture la saisie semi-complète à la *session* : toutes les frappes d'une même
 * recherche plus le détail final comptent pour une seule requête facturable, à condition de
 * porter le même `sessionToken`. Sans lui, chaque frappe est facturée séparément — la
 * différence entre quelques cents et quelques dollars par jour de saisie. Le jeton vient de
 * la page, qui en fabrique un neuf à chaque nouvelle adresse.
 *
 * Sans clé, le module se déclare inactif et la saisie reste manuelle. Aucun écran ne casse :
 * l'autocomplétion est un raccourci, pas un passage obligé.
 */
const CLE = () => process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
const BASE = "https://places.googleapis.com/v1";

/** Le raccourci est-il disponible ? La page le demande avant d'écouter les frappes. */
const actif = () => !!CLE();

/**
 * Les types de lieux qui sont des adresses postales.
 *
 * Sans ce filtre, taper « 220 Rail » propose des villes, des commerces et des arrêts d'autobus
 * — aucun n'est livrable, et le premier de la liste est presque toujours faux.
 */
const TYPES = ["street_address", "premise", "subpremise", "route"];

async function appel(chemin, { methode = "GET", corps = null, champs = null } = {}) {
  const cle = CLE();
  if (!cle) throw new Error("GOOGLE_MAPS_API_KEY absente");
  const entetes = { "X-Goog-Api-Key": cle };
  if (champs) entetes["X-Goog-FieldMask"] = champs;
  if (corps) entetes["Content-Type"] = "application/json";
  // Une suggestion qui met plus de six secondes n'aide plus personne : la personne a fini de
  // taper. On abandonne plutôt que de laisser la requête pendre.
  const stop = AbortSignal.timeout(6000);
  const res = await fetch(`${BASE}${chemin}`, {
    method: methode, headers: entetes, signal: stop,
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const txt = await res.text();
  let j; try { j = JSON.parse(txt); } catch { j = null; }
  if (!res.ok) {
    const m = (j && j.error && j.error.message) || txt.slice(0, 200);
    throw new Error(`Google Places ${res.status} : ${m}`);
  }
  return j || {};
}

/**
 * Propositions pour une saisie partielle.
 *
 * `pays` restreint la recherche — deux lettres ISO. Le restreindre au pays déjà choisi dans
 * le formulaire évite qu'une rue de Langdon en Angleterre remonte devant celle de l'Alberta.
 */
async function suggestions(saisie, { pays = null, jeton = null } = {}) {
  const q = String(saisie || "").trim();
  // Sous trois caractères, Google renvoie surtout du bruit et chaque frappe coûte.
  if (q.length < 3) return [];
  const corps = { input: q, includedPrimaryTypes: TYPES, languageCode: "fr" };
  if (pays) corps.includedRegionCodes = [String(pays).toLowerCase()];
  if (jeton) corps.sessionToken = jeton;
  const j = await appel("/places:autocomplete", { methode: "POST", corps });
  return (j.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      id: p.placeId || String(p.place || "").replace(/^places\//, ""),
      texte: (p.text && p.text.text) || "",
      principal: (p.structuredFormat && p.structuredFormat.mainText && p.structuredFormat.mainText.text) || "",
      secondaire: (p.structuredFormat && p.structuredFormat.secondaryText && p.structuredFormat.secondaryText.text) || "",
    }));
}

/** Un composant Google par type, `shortText` ou `longText` selon ce qui sert à l'expédition. */
function composant(liste, type, court = false) {
  const c = (liste || []).find((x) => (x.types || []).includes(type));
  if (!c) return "";
  return (court ? c.shortText : c.longText) || c.longText || c.shortText || "";
}

/**
 * L'adresse choisie, dans la forme qu'attend `ship_to`.
 *
 * La province sort en code court (`AB`, pas `Alberta`) : c'est ce que les transporteurs
 * exigent, et c'est ce que les listes déroulantes du formulaire contiennent. Le pays aussi.
 *
 * `locality` manque sur certaines adresses britanniques et rurales ; `postal_town` puis les
 * sous-localités prennent le relais plutôt que de rendre une ville vide, qui bloquerait la
 * cotation sans dire pourquoi.
 */
async function details(placeId, { jeton = null } = {}) {
  const id = String(placeId || "").replace(/^places\//, "");
  if (!id) throw new Error("identifiant de lieu manquant");
  const chemin = `/places/${encodeURIComponent(id)}${jeton ? `?sessionToken=${encodeURIComponent(jeton)}` : ""}`;
  const j = await appel(chemin, { champs: "addressComponents,formattedAddress" });
  const c = j.addressComponents || [];
  const numero = composant(c, "street_number", true);
  // `shortText` sur la rue, et c'est important : Google rend « Railway Close Southeast » en
  // long et « Railway Close SE » en court. C'est la forme courte qui est postale — celle que
  // portent les étiquettes, celle que ShipStation a enregistrée, celle que les
  // transporteurs valident. La forme longue passe souvent, mais pas toujours, et l'échec
  // arrive à l'achat.
  const rue = composant(c, "route", true);
  return {
    street1: [numero, rue].filter(Boolean).join(" ").trim(),
    street2: composant(c, "subpremise", true),
    city: composant(c, "locality") || composant(c, "postal_town")
      || composant(c, "sublocality_level_1") || composant(c, "administrative_area_level_2"),
    state: composant(c, "administrative_area_level_1", true),
    postalCode: composant(c, "postal_code", true),
    country: composant(c, "country", true),
    formatee: j.formattedAddress || "",
  };
}

module.exports = { actif, suggestions, details, composant };
