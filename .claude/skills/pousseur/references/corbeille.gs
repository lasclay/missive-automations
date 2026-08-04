/**
 * Action « corbeille » du Pousseur Lasclay Google — CORRECTIF À APPLIQUER.
 *
 * Le script déployé sait écrire mais pas supprimer. Le client `drive_push.js`
 * appelle déjà `--corbeille <id>[,<id>…]` et sait lire la réponse ci-dessous ;
 * il ne manque que ce bloc côté Apps Script.
 *
 * OÙ LE COLLER : dans `doPost`, juste APRÈS la vérification du jeton et AVANT
 * toute lecture du corps de la requête. L'action ne lit pas le corps : placée
 * trop bas, elle échouerait sur « corps illisible, base64 attendu », qui est
 * exactement le symptôme observé quand elle n'est pas déployée.
 *
 * REDÉPLOIEMENT : Déployer › Gérer les déploiements › crayon du déploiement
 * courant › Version : Nouvelle version. Surtout pas « Nouveau déploiement »,
 * qui ajouterait une URL de plus aux six déjà actives.
 *
 * `setTrashed(true)` met à la corbeille — récupérable trente jours. Rien n'est
 * détruit définitivement.
 */

if (p.action === 'corbeille') {
  var ids = String(p.ids || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length; });

  if (!ids.length) return texte('error:aucun id fourni');

  var ok = [], echecs = [];
  for (var i = 0; i < ids.length; i++) {
    try {
      var f = DriveApp.getFileById(ids[i]);
      var nom = f.getName();
      f.setTrashed(true);
      ok.push(nom);
    } catch (e) {
      echecs.push(ids[i] + ' (' + e.message + ')');
    }
  }

  var detail = ok.join(' | ');
  if (echecs.length) detail += ':echecs:' + echecs.join(' | ');
  return texte('status:200:corbeille:' + ok.length + ':' + detail);
}
