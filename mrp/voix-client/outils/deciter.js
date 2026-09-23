/**
 * Enlever de la prose d'un client tout ce qui n'est pas de lui.
 *
 * POURQUOI ÇA EXISTE. Un message marqué « pas de nous » (`us: false`) contient
 * presque toujours notre propre courriel cité en dessous. Un comptage naïf
 * trouvait « ça a bloqué chez nos sous-traitants » dans des dizaines de fils :
 * c'est notre infolettre, renvoyée par le client. Classer là-dessus,
 * c'est attribuer nos propres phrases aux clients.
 *
 * La règle : on coupe au PREMIER marqueur de citation, et on jette la suite.
 * Un client qui écrit après la citation (ça arrive) perd sa phrase — c'est le
 * bon compromis : un faux négatif coûte une citation, un faux positif met une
 * phrase de Lasclay dans la bouche d'un client.
 */
'use strict';

// Chaque marqueur est ancré en début de ligne, sauf ceux qui ne le sont jamais.
const COUPURES = [
  /^>+\s?/m,                                        // citation classique
  /^\s*-{2,}\s*(message|forwarded|original)/im,     // ------ Original Message
  /^\s*(from|de)\s*:\s*.{0,80}(lasclay|hey@)/im,    // From: Lasclay
  /^\s*(sent|envoyé|envoye)\s*:\s*\w/im,
  /\b(le|on)\s+\d{1,2}[\s.]+\w+\.?\s+\d{4}[^\n]{0,60}(a écrit|a ecrit|wrote)\s*:/i,
  /\b(on|le)\s+\w+\s+\d{1,2},?\s+\d{4}[^\n]{0,80}(wrote|a écrit|a ecrit)\s*:/i,
  /\b\w+\s+<[^>]+@[^>]+>\s+(a écrit|a ecrit|wrote)\s*:/i,
  /^\s*obtenir outlook/im,
  /^\s*(sent|envoyé) (from|de) my /im,
  /^\s*télécharger outlook/im,
];

/**
 * Phrases qui sont NOUS, même dans un message marqué « pas de nous ».
 *
 * Trois façons dont notre voix se retrouve du côté client : une infolettre
 * transférée, une réponse du support recopiée sans marqueur de citation, et
 * un extrait de fiche produit collé dans la question. Le distillat sortait
 * « nos glacières sont conçues pour… » et « 20 % de rabais sur 1 » comme si
 * des clients l'avaient écrit.
 */
const NOTRE_VOIX = [
  /\bnos (glacieres|produits|mitaines|manteaux|semelles|articles|fibres?)\b/i,
  /\bnotre (equipe|atelier|mission|entreprise|boutique|service)\b/i,
  /\bchez lasclay\b/i,
  /\d+\s?% de rabais/i,
  /\bn'h[ée]sitez pas\b/i,
  /\bservice (a la )?client[eè]le?\b/i,
  /\bnous vous (remercions|invitons|confirmons|reviendrons)\b/i,
  /\bmerci de votre (commande|confiance|patience)\b/i,
];

/** Vrai si la phrase est de Lasclay et non du client. */
function notreVoix(phrase) {
  const p = String(phrase || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return NOTRE_VOIX.some(re => re.test(p));
}

// Blocs de pied de page qui ne disent rien et brouillent les comptages.
const BRUIT = [
  /\bse d[ée]sabonner\b[\s\S]*$/i,
  /\bunsubscribe\b[\s\S]*$/i,
  /\bhey@lasclay\.com\b/gi,
  /https?:\/\/\S+/g,
  /\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g,     // adresses courriel : jamais utiles au distillat
  // Numéros de commande et de suivi. Ils désignent une personne dès qu'on les
  // recolle à Shopify — et un atelier n'a rien à en faire. Remplacés plutôt
  // que coupés : la phrase reste lisible.
  /\bL-\s?\d{4,}\b/gi,
  /\bcommande\s+n[o°]?\s*\d{4,}\b/gi,
  /\b\d{10,}\b/g,
];

/** Ne garde que la prose propre du client. */
function deciter(texte) {
  let t = String(texte || '').replace(/\r/g, '');
  let coupe = t.length;
  for (const re of COUPURES) {
    const m = re.exec(t);
    if (m && m.index < coupe) coupe = m.index;
  }
  t = t.slice(0, coupe);
  for (const re of BRUIT) t = t.replace(re, ' ');
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  // La coupure laisse souvent l'amorce de l'attribution : « Le 3 mars, » juste
  // avant « lasclay <…> a écrit : ». Ce n'est pas une phrase du client, et ça
  // se retrouverait tel quel dans une citation montrée à l'atelier.
  t = t.replace(/\n?\s*(le|on)\b[^.\n]{0,40},\s*$/i, '');
  return t.trim();
}

/** La prose propre de tous les messages du client, dans un fil. */
function proseClient(fil) {
  return (fil.messages || [])
    .filter(m => !m.us)
    .map(m => deciter(m.text))
    .filter(Boolean)
    .join('\n\n');
}

module.exports = { deciter, proseClient, notreVoix, COUPURES, NOTRE_VOIX };
