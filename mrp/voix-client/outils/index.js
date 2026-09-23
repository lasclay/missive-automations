/**
 * Étape 1 de l'extraction : l'INDEX.
 *
 * On liste les fils de chacune des 109 étiquettes partagées, et on déduplique
 * par identifiant de conversation. Un fil porte souvent plusieurs étiquettes —
 * « RETOURS » et « Produit défectueux » et « Glacière » — et c'est justement
 * cette combinaison qui vaut de l'or pour classer ensuite.
 *
 * Rien n'est lu ici, seulement listé : c'est rapide (≈1 s par étiquette) et ça
 * donne l'ampleur exacte avant d'engager les heures de lecture.
 *
 * Reprenable : relancé, il repart de l'index déjà écrit et ne refait que les
 * étiquettes manquantes.
 */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEPOT = '/home/user/missive-automations';
const SORTIE = path.join(__dirname, 'index.json');

const structure = JSON.parse(
  fs.readFileSync(path.join(DEPOT, 'missive_structure.json'), 'utf8'));
const labels = structure.shared_labels || [];

const etat = fs.existsSync(SORTIE)
  ? JSON.parse(fs.readFileSync(SORTIE, 'utf8'))
  : { fils: {}, etiquettes: {}, fait: [] };

const liste = (filtre) => {
  const out = execFileSync('node', ['missive_client.js', 'list', filtre],
    { cwd: DEPOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const d = JSON.parse(out);
  return d.conversations || (Array.isArray(d) ? d : []);
};

let n = 0;
for (const l of labels) {
  const nom = l.name_with_parent_names || l.name || l.id;
  if (etat.fait.includes(l.id)) { n++; continue; }
  let convs;
  try {
    convs = liste(`shared_label=${l.id}`);
  } catch (e) {
    console.error(`  ✗ ${nom} : ${String(e.message).slice(0, 120)}`);
    continue;
  }
  etat.etiquettes[l.id] = { nom, fils: convs.length };
  for (const c of convs) {
    const f = etat.fils[c.id] || { id: c.id, subject: c.subject || '',
      last_activity_at: c.last_activity_at || null, labels: [] };
    if (!f.labels.includes(nom)) f.labels.push(nom);
    etat.fils[c.id] = f;
  }
  etat.fait.push(l.id);
  n++;
  console.log(`  ${String(n).padStart(3)}/${labels.length}  ${String(convs.length).padStart(5)} fils  ${nom.slice(0, 62)}`);
  fs.writeFileSync(SORTIE, JSON.stringify(etat));
}

const total = Object.keys(etat.fils).length;
console.log(`\n  ${total.toLocaleString('fr-CA')} fils uniques sur ${labels.length} étiquettes.`);
