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

function langue(f) {
  if (f.prov === 'QC') return 'FR';
  return ZONES_FR_HORS_QC.has(f.zone) ? 'FR' : 'EN';
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
    const id = `${f.zone}|${f.nom}`.replace(/\s+/g, ' ').slice(0, 120);
    if (vus.has(id)) continue;
    vus.add(id);

    const mail = (f.courriel || '').toLowerCase();
    const v = verdicts[mail];
    const canal = mail ? 'courriel' : (f.tel ? 'telephone' : (f.fb || f.ig ? 'reseau social' : 'aucun'));

    let etat = 'en_attente';
    if (!mail) etat = canal === 'telephone' ? 'a_appeler' : 'a_contacter_autrement';
    else if (v && v.etat !== 'ok') etat = 'adresse_ecartee';

    const precedent = ancien[id];
    file.push({
      id,
      nom: f.nom,
      zone: f.zone,
      prov: f.prov,
      ville: f.ville || '',
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
