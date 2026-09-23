/**
 * tests/unites.js — les mesures impériales, converties à l'affichage.
 *
 * Ce qui est épinglé, et pourquoi :
 *
 *   1. Les facteurs. Une once par verge carrée n'est pas une once : 33,91 g/m²
 *      contre 28,35 g. Se tromper de conversion sur la toile ferait commander
 *      un coton d'un cinquième trop léger.
 *   2. L'ordre des règles. « 300 fils/po² » doit se convertir en fils/cm², pas
 *      en centimètres — donc po² passe AVANT po.
 *   3. Le mode « imperial » ne touche à rien. C'est la source, et la source
 *      doit pouvoir être relue telle qu'elle est écrite.
 *   4. La cote structurée. « 1 » + « po » vivent dans deux colonnes : les
 *      convertir demande de recomposer, et ce qui est déjà métrique ne bouge
 *      pas.
 *   5. Un mode inconnu est refusé. Une préférence qu'on croit posée et qui ne
 *      l'est pas se découvre devant une cote lue dans la mauvaise unité.
 *
 *   node tests/unites.js
 */
'use strict';
process.env.MRP_DB = process.env.MRP_DB
  || require('node:path').join(require('node:os').tmpdir(), `mrp-uni-${process.pid}.db`);

const U = require('../unites.js');
const auth = require('../auth.js');
const { db } = require('../db.js');

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};

console.log('\n  Unités\n');

// 1. Les facteurs
t('12 oz de toile font 407 g/m², pas 340',
  U.convertir('coton 12 oz') === 'coton 407 g/m²', U.convertir('coton 12 oz'));
t('10 oz font 339 g/m²', U.convertir('10 oz') === '339 g/m²', U.convertir('10 oz'));
t('un pouce fait 2,5 cm', U.convertir('1 po') === '2,5 cm', U.convertir('1 po'));
t('« pouces » en toutes lettres aussi',
  U.convertir('50 pouces') === '127 cm', U.convertir('50 pouces'));
t('un pied fait 30 cm', U.convertir('1 pied') === '30 cm', U.convertir('1 pied'));
t('une verge fait 0,91 m', U.convertir('1 verge') === '0,91 m', U.convertir('1 verge'));

// 2. L'ordre des règles
t('« 300 fils/po² » devient une densité, pas une longueur',
  U.convertir('300 fils/po²') === '47 fils/cm²', U.convertir('300 fils/po²'));

// 3. Les modes
t('le mode impérial ne touche à rien',
  U.convertir('coton 12 oz, 1 po', 'imperial') === 'coton 12 oz, 1 po');
t('le mode « les deux » garde la source et ajoute',
  U.convertir('coton 12 oz', 'deux') === 'coton 12 oz (407 g/m²)',
  U.convertir('coton 12 oz', 'deux'));
t('un texte sans impérial ne bouge pas',
  U.convertir('Vegeto 200 g') === 'Vegeto 200 g');
t('le métrique déjà écrit n\'est pas reconverti',
  U.convertir('Velcro 2,5 cm') === 'Velcro 2,5 cm');

// 4. La cote structurée
{
  const m = U.convertirMesure('1', 'po');
  t('une cote « 1 po » devient « 2,5 cm »', m.valeur === '2,5' && m.unite === 'cm',
    JSON.stringify(m));
  const d = U.convertirMesure('66,0 x 50,8', 'cm');
  t('une cote déjà métrique ne bouge pas',
    d.valeur === '66,0 x 50,8' && d.unite === 'cm', JSON.stringify(d));
  const i = U.convertirMesure('1', 'po', 'imperial');
  t('en mode impérial, la cote reste la source', i.valeur === '1' && i.unite === 'po');
}

// 5. Le réglage
{
  auth.creerUtilisateur({ courriel: 'u@test.test', mdp: 'motdepasse1',
                          nom: 'U', role: 'atelier' });
  const id = db.prepare(
    `SELECT id FROM utilisateurs WHERE courriel = ?`).get('u@test.test').id;
  const lu = () => db.prepare(`SELECT unites FROM utilisateurs WHERE id = ?`).get(id).unites;
  t('le défaut est le métrique — l\'atelier est le plus gros lecteur',
    lu() === 'metrique', lu());
  t('un mode valide s\'enregistre',
    !auth.changerUnites(id, 'deux').erreur && lu() === 'deux');
  const r = auth.changerUnites(id, 'lieues');
  t('un mode inconnu est REFUSÉ, pas corrigé en silence',
    Boolean(r.erreur) && lu() === 'deux', JSON.stringify(r));
}

console.log(`\n  ${ok} vérifications, ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
