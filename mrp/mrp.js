#!/usr/bin/env node
/**
 * Lasclay — MRP : administration en ligne de commande
 *
 *   node mrp.js utilisateur:creer <courriel> <mot-de-passe> "<nom>" [admin|atelier]
 *   node mrp.js utilisateur:liste
 *   node mrp.js utilisateur:mdp    <courriel> <nouveau-mot-de-passe>
 *   node mrp.js utilisateur:role   <courriel> <admin|atelier>
 *   node mrp.js utilisateur:desactiver <courriel>
 *   node mrp.js demo                 charge un jeu de données d'exemple
 *   node mrp.js etat                 état de la base
 */
'use strict';
const { db, prochainNumero } = require('./db.js');
const auth = require('./auth.js');

const [, , cmd, ...a] = process.argv;
const dire = (...x) => console.log(...x);

switch (cmd) {
  case 'utilisateur:creer': {
    const [courriel, mdp, nom, role = 'atelier'] = a;
    if (!courriel || !mdp || !nom) { dire('Usage : utilisateur:creer <courriel> <mdp> "<nom>" [role]'); process.exit(1); }
    if (!['admin', 'atelier'].includes(role)) { dire('Rôle invalide : admin ou atelier'); process.exit(1); }
    if (mdp.length < 8) { dire('Mot de passe : 8 caractères minimum'); process.exit(1); }
    try {
      auth.creerUtilisateur({ courriel, mdp, nom, role });
      dire(`Créé : ${courriel} (${role})`);
    } catch (e) { dire('Échec :', e.message); process.exit(1); }
    break;
  }
  case 'utilisateur:liste':
    for (const u of db.prepare(`SELECT id, courriel, nom, role, actif, cree_le
                                FROM utilisateurs ORDER BY id`).all())
      dire(`${String(u.id).padStart(3)}  ${u.courriel.padEnd(30)} ${u.role.padEnd(8)} ` +
           `${u.actif ? 'actif  ' : 'inactif'} ${u.nom}`);
    break;
  case 'utilisateur:mdp': {
    const [courriel, mdp] = a;
    if (!courriel || !mdp || mdp.length < 8) { dire('Usage : utilisateur:mdp <courriel> <mdp 8+ car.>'); process.exit(1); }
    const r = db.prepare(`UPDATE utilisateurs SET mdp_hash = ? WHERE courriel = ?`)
                .run(auth.hacher(mdp), courriel.toLowerCase());
    dire(r.changes ? 'Mot de passe modifié.' : 'Utilisateur introuvable.');
    break;
  }
  case 'utilisateur:role': {
    const [courriel, role] = a;
    if (!['admin', 'atelier'].includes(role)) { dire('Rôle : admin ou atelier'); process.exit(1); }
    const r = db.prepare(`UPDATE utilisateurs SET role = ? WHERE courriel = ?`)
                .run(role, courriel.toLowerCase());
    dire(r.changes ? `Rôle changé pour ${role}.` : 'Utilisateur introuvable.');
    break;
  }
  case 'utilisateur:desactiver': {
    const r = db.prepare(`UPDATE utilisateurs SET actif = 0 WHERE courriel = ?`)
                .run(String(a[0] || '').toLowerCase());
    dire(r.changes ? 'Désactivé.' : 'Utilisateur introuvable.');
    break;
  }
  case 'etat': {
    const c = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
    dire(`Base ............ ${require('./db.js').CHEMIN}`);
    dire(`Utilisateurs .... ${c('utilisateurs')}`);
    dire(`Produits ........ ${c('produits')}`);
    dire(`Ordres .......... ${c('ordres')}`);
    dire(`Items ........... ${c('ordre_items')}`);
    dire(`Jalons .......... ${c('ordre_jalons')}`);
    dire(`Commentaires .... ${c('ordre_commentaires')}`);
    break;
  }
  case 'demo': {
    if (db.prepare(`SELECT COUNT(*) n FROM produits`).get().n) {
      dire('La base contient déjà des produits — chargement annulé.'); process.exit(1);
    }
    const P = db.prepare(`INSERT INTO produits (code, nom, description, usage, notes_tech)
                          VALUES (?,?,?,?,?)`);
    const M = db.prepare(`INSERT INTO produit_materiaux (produit_id, nom, detail, rang)
                          VALUES (?,?,?,?)`);
    const T = db.prepare(`INSERT INTO produit_patrons
                          (produit_id, nom, url, format, dimensions, note, rang)
                          VALUES (?,?,?,?,?,?,?)`);

    const cc = P.run('CC-ADULTE', 'Cache-cou adulte M-L',
      "Cache-cou tubulaire en molleton, isolé à la soie d'asclépiade.",
      "Se porte autour du cou, se remonte sur le nez et les oreilles. Lavage à l'eau froide, séchage à plat.",
      'Tissu extensible : la coupe doit suivre le sens de plus grande extensibilité, en largeur.'
    ).lastInsertRowid;
    M.run(cc, 'Molleton 240 g', 'Coloris selon la commande', 1);
    M.run(cc, "Isolant soie d'asclépiade", 'Nappe légère', 2);
    M.run(cc, 'Étiquette tissée Lasclay', 'Cousue au centre arrière', 3);
    T.run(cc, 'Pièce principale', '', 'hpgl', '24,5 x 33,6 cm',
          'Échelle non déclarée dans le fichier — à vérifier avant traçage', 1);

    const cce = P.run('CC-ENFANT', 'Cache-cou enfant 5-14 ans',
      'Version enfant du cache-cou, mêmes matériaux.',
      "Se porte autour du cou. Lavage à l'eau froide.",
      'Même sens de coupe que la version adulte.').lastInsertRowid;
    M.run(cce, 'Molleton 240 g', '', 1);
    T.run(cce, 'Pièce principale', '', 'hpgl', '20,5 x 26,6 cm', '', 1);

    const tq = P.run('TQ-SPORT', 'Tuque sport Vegeto',
      "Tuque ajustée, doublure isolée à la soie d'asclépiade.",
      'Se porte ajustée sur la tête, couvre les oreilles.',
      'Bandeau amovible vendu séparément — voir BAND-AMO.').lastInsertRowid;
    M.run(tq, 'Tricot extensible', '', 1);
    M.run(tq, "Isolant soie d'asclépiade", '', 2);
    T.run(tq, 'Patron complet', '', 'dxf', '', 'Version 2026', 1);

    const ba = P.run('BAND-AMO', 'Bandeau amovible',
      'Bandeau qui se fixe à la tuque sport pour une protection supplémentaire.',
      "S'enfile par-dessus la tête. Le tissu est extensible : il entre facilement.",
      'Deux rectangles. Extensibilité en longueur.').lastInsertRowid;
    M.run(ba, 'Tricot extensible', '', 1);
    T.run(ba, 'Bandeau', '', 'hpgl', '44,5 x 27,5 cm', 'Échelle à confirmer', 1);

    const mi = P.run('MIT-POLAR', 'Mitaines polar',
      "Mitaines en molleton, isolées à la soie d'asclépiade. Cinq tailles.",
      'Portées seules ou en sous-gant.',
      'Cinq patrons distincts, un par taille.').lastInsertRowid;
    M.run(mi, 'Molleton polar', '', 1);
    M.run(mi, "Isolant soie d'asclépiade", '', 2);
    for (const [i, t] of ['XS','S','M','L','XL'].entries())
      T.run(mi, `Taille ${t}`, '', 'hpgl', '', '', i + 1);

    // ordre de production d'exemple
    const oid = db.prepare(`INSERT INTO ordres (numero, titre, statut, note)
      VALUES (?,?,?,?)`).run(prochainNumero(), 'Production automne 2026 — Tunisie',
      'en_cours',
      "Première production de la saison. Les cache-cous sont prioritaires : ils partent en prévente."
      ).lastInsertRowid;

    const I = db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite, avancement, note, rang)
                          VALUES (?,?,?,?,?,?)`);
    I.run(oid, cc,  2000, 40, 'Coloris noir et forêt', 1);
    I.run(oid, cce,  800, 20, '', 2);
    I.run(oid, tq,   500,  0, 'Attente confirmation coloris', 3);
    I.run(oid, mi,   300, 10, 'Réparti sur les cinq tailles', 4);

    const J = db.prepare(`INSERT INTO ordre_jalons (ordre_id, titre, date, type, note)
                          VALUES (?,?,?,?,?)`);
    const an = new Date().getFullYear();
    J.run(oid, 'Fin de coupe — cache-cous',      `${an}-09-15`, 'deadline', '');
    J.run(oid, 'Départ conteneur Tunis',          `${an}-10-02`, 'deadline', '');
    J.run(oid, 'Lancement prévente cache-cous',   `${an}-10-10`, 'prevente', 'Infolettre et site');
    J.run(oid, 'Réception entrepôt Québec',       `${an}-10-28`, 'livraison', '');
    J.run(oid, 'Salon plein air Québec',          `${an}-11-14`, 'evenement', 'Stock requis sur place');

    dire('Jeu de données d\'exemple chargé.');
    dire('  5 produits, 1 ordre de production, 4 items, 5 jalons.');
    break;
  }
  default:
    dire(require('node:fs').readFileSync(__filename, 'utf8')
         .split('\n').slice(2, 14).join('\n').replace(/^ \* ?/gm, ''));
}
