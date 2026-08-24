#!/usr/bin/env node
// Construit la file d'attente de prospection a partir de la selection et du
// controle des adresses. Un enregistrement par commerce, avec son etat.
//
// Le fichier produit est versionne dans le depot: la routine tourne dans une
// session neuve chaque matin, donc l'etat doit survivre au recyclage du
// conteneur. C'est la seule memoire de la campagne.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'file_attente.json');

// Zones francophones hors Quebec: on y ecrit en francais.
const ZONES_FR_HORS_QC = new Set([
  'Ottawa', 'Cornwall', 'Kapuskasing et Hearst', 'Grand Sudbury', 'Timmins',
  'Bathurst et Acadie-Bathurst', 'Edmundston et Madawaska',
  'Campbellton et Restigouche', 'Miramichi',
]);

// Gabriel ne veut que des detaillants capables de porter la gamme au complet.
// Un kiosque fermier, une librairie ou une fromagerie peut mettre un sac a lunch
// sur une tablette; aucun ne vendra un manteau avec des tailles. Les contacter,
// c'est fabriquer exactement les points de vente partiels qu'on veut arreter.
const PORTE_LA_GAMME = new Set([
  'Designers canadiens', 'Artisans et designers quebecois', 'Cadeaux / artisans',
  'Artisans quebecois', 'Artisans canadiens', 'Artisans atlantiques',
  'Cadeaux / produits quebecois', 'Plein air', 'Eco / plein air', 'Chasse et peche',
  "Metiers d'art", "Artisans / metiers d'art", 'Artisans', 'Artisans / cadeaux',
  'Coop artisans', 'Cooperative artisans', 'Magasin general ecoresponsable',
  'Magasin general eco', 'Eco / magasin general', 'Eco / artisans',
  'Eco / produits quebecois', 'Terroir / cadeaux quebecois',
  'Terroir / produits regionaux', 'Ornithologie / nature', 'Eco / boutique',
  'Boutique eco', 'Cadeaux / eco', 'Boutique / cadeaux', 'Artisans / galerie',
  'Galerie / artisans', 'Librairie / artisans', 'Deco / maison',
  'Articles de maison', 'Boutique de musee', 'Eco / zero dechet',
  'Eco / grande boutique verte',
]);

// Marqueurs francais dans le nom du commerce. Hors Quebec, la zone ne suffit
// pas: « The Outside Store » a Sudbury et « Snow Goose » a Ottawa sont dans des
// zones bilingues mais s'appellent en anglais. Leur ecrire en francais, c'est
// leur montrer qu'on ne les a pas regardes.
const MARQUEURS_FR = /(^|\s)(la|le|les|du|de|des|au|aux|chez|maison|boutique|atelier|galerie|librairie|marche|marché|epicerie|épicerie|ferme|coop|jardin|artisan|createur|créateur)(\s|$)|[àâäéèêëîïôöùûüç]/i;

function langue(f) {
  if (f.prov === 'QC') return 'FR';
  if (!ZONES_FR_HORS_QC.has(f.zone)) return 'EN';
  return MARQUEURS_FR.test(f.nom) ? 'FR' : 'EN';
}

// vague 1 = rang 1 des zones a ouvrir. Les rangs suivants n'entrent en jeu que
// si le rang 1 de leur zone se termine sans entente: la regle d'exclusivite
// interdit de courtiser trois commerces de la meme region en meme temps.
function vague(f) {
  if (f.priorite.startsWith('A')) return 1;
  if (f.rang === 2) return 2;
  if (f.rang === 3) return 3;
  return 4;
}

(async () => {
  const zones = JSON.parse(fs.readFileSync(path.join(__dirname, 'zones.json'), 'utf8'));
  const ancreDe = {};
  for (const z of zones) ancreDe[z.zone] = z.ancre;
  const selection = JSON.parse(fs.readFileSync(path.join(__dirname, 'selection.json'), 'utf8'));
  let verdicts = {};
  try {
    for (const v of JSON.parse(fs.readFileSync(path.join(__dirname, 'courriels_valides.json'), 'utf8'))) {
      verdicts[v.courriel] = v;
    }
  } catch { /* controle pas encore passe */ }

  // on reprend l'etat deja acquis plutot que de l'ecraser
  let ancien = {};
  try {
    for (const e of JSON.parse(fs.readFileSync(FILE, 'utf8'))) ancien[e.id] = e;
  } catch { /* premiere construction */ }

  const file = [];
  const vus = new Set();
  for (const f of selection) {
    // identifiant insensible a la casse et aux accents: « Santé en Vrac » et
    // « Santé en vrac » sont le meme commerce, avec deux fiches OpenStreetMap
    const cle = `${f.zone}|${f.nom}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9|]+/g, '');
    const id = `${f.zone}|${f.nom}`.replace(/\s+/g, ' ').slice(0, 120);
    if (vus.has(cle)) continue;
    vus.add(cle);

    const mail = (f.courriel || '').toLowerCase();
    const v = verdicts[mail];
    const canal = mail ? 'courriel' : (f.tel ? 'telephone' : (f.fb || f.ig ? 'reseau social' : 'aucun'));

    let etat = 'en_attente';
    if (!PORTE_LA_GAMME.has(f.type)) etat = 'partiel';
    else if (!mail) etat = canal === 'telephone' ? 'a_appeler' : 'a_contacter_autrement';
    else if (v && v.etat !== 'ok') etat = 'adresse_ecartee';

    const precedent = ancien[id];
    file.push({
      id,
      nom: f.nom,
      zone: f.zone,
      prov: f.prov,
      ville: f.ville || '',
      ancre: ancreDe[f.zone] || '',
      archetype: f.type,
      rang: f.rang,
      vague: vague(f),
      langue: langue(f),
      canal,
      courriel: mail,
      tel: f.tel || '',
      social: f.fb || f.ig || '',
      web: f.web || '',
      // l'etat deja acquis prime: on ne remet jamais a zero un envoi fait
      etat: precedent && precedent.etat !== 'en_attente' ? precedent.etat : etat,
      motif_ecart: v && v.etat !== 'ok' ? v.motif : (precedent ? precedent.motif_ecart : ''),
      envoye_le: precedent ? precedent.envoye_le || '' : '',
      relance_le: precedent ? precedent.relance_le || '' : '',
      repondu_le: precedent ? precedent.repondu_le || '' : '',
      conversation: precedent ? precedent.conversation || '' : '',
      note: precedent ? precedent.note || '' : '',
    });
  }

  // Un commerce deja contacte ne doit jamais sortir de la file, meme si un
  // resserrement du tri l'a retire de la selection. Sinon on perd la trace d'un
  // envoi reel, et le prochain tri pourrait le recontacter.
  // Le critere de conservation est le journal des envois, pas l'etat: c'est la
  // seule preuve qu'un message est reellement parti. Un etat comme `partiel`
  // peut venir d'un simple resserrement du tri, et conserver ces fiches-la
  // ressuscitait des doublons d'orthographe d'une generation a l'autre.
  let contactes = new Set();
  try {
    for (const j of JSON.parse(fs.readFileSync(path.join(__dirname, 'journal_envois.json'), 'utf8'))) {
      if (j.action === 'envoye' || j.action === 'relance') contactes.add(j.id);
    }
  } catch { /* pas encore de journal */ }
  const presents = new Set(file.map(f => f.id));
  let conserves = 0;
  for (const [id, e] of Object.entries(ancien)) {
    if (presents.has(id)) continue;
    if (!contactes.has(id)) continue;
    e.note = (e.note ? e.note + ' ' : '') + 'retire de la selection par un resserrement du tri, conserve parce que deja contacte';
    file.push(e);
    conserves++;
  }
  if (conserves) console.error(`${conserves} fiche(s) deja contactee(s) conservee(s) hors selection`);

  fs.writeFileSync(FILE, JSON.stringify(file, null, 1));

  const compte = (p) => file.filter(p).length;
  const v1 = file.filter(f => f.vague === 1);
  console.log(`File d'attente : ${file.length} commerces`);
  console.log(`  par courriel      : ${compte(f => f.canal === 'courriel')}`);
  console.log(`  par telephone     : ${compte(f => f.canal === 'telephone')}`);
  console.log(`  par reseau social : ${compte(f => f.canal === 'reseau social')}`);
  console.log(`  adresses ecartees : ${compte(f => f.etat === 'adresse_ecartee')}`);
  console.log(`\nVague 1 : ${v1.length} commerces`);
  console.log(`  courriels prets : ${v1.filter(f => f.canal === 'courriel' && f.etat === 'en_attente').length}`);
  console.log(`  en francais     : ${v1.filter(f => f.langue === 'FR' && f.canal === 'courriel' && f.etat === 'en_attente').length}`);
  console.log(`  en anglais      : ${v1.filter(f => f.langue === 'EN' && f.canal === 'courriel' && f.etat === 'en_attente').length}`);
  console.log(`  a appeler       : ${v1.filter(f => f.canal === 'telephone').length}`);
})();
