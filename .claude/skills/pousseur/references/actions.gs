/**
 * Actions « corbeille » et « deplace » du Pousseur Lasclay Google.
 * CORRECTIF À APPLIQUER — ces deux blocs ne sont pas encore déployés.
 *
 * Le script déployé sait écrire un fichier, et rien d'autre. Il ne supprime pas,
 * ne déplace pas, ne crée pas de dossier. Le client `drive_push.js` sait déjà
 * appeler les deux actions ci-dessous et lire leurs réponses ; il ne manque que
 * ce code côté Apps Script.
 *
 * OÙ LES COLLER : dans `doPost`, juste APRÈS la vérification du jeton et AVANT
 * toute lecture du corps de la requête. Aucune des deux ne lit le corps : placées
 * trop bas, elles échoueraient sur « corps illisible, base64 attendu », qui est
 * exactement le symptôme d'une action non déployée.
 *
 * REDÉPLOIEMENT : Déployer › Gérer les déploiements › crayon du déploiement
 * courant › Version : Nouvelle version. Surtout pas « Nouveau déploiement »,
 * qui ajouterait une URL de plus aux six déjà actives.
 */

// --------------------------------------------------------------- corbeille
// node drive_push.js --corbeille <id>[,<id>…]
// `setTrashed(true)` met à la corbeille : récupérable trente jours, rien n'est
// détruit définitivement.

if (p.action === 'corbeille') {
  var idsC = String(p.ids || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length; });

  if (!idsC.length) return texte('error:aucun id fourni');

  var okC = [], echecsC = [];
  for (var i = 0; i < idsC.length; i++) {
    try {
      var fC = DriveApp.getFileById(idsC[i]);
      var nomC = fC.getName();
      fC.setTrashed(true);
      okC.push(nomC);
    } catch (e) {
      echecsC.push(idsC[i] + ' (' + e.message + ')');
    }
  }

  var detailC = okC.join(' | ');
  if (echecsC.length) detailC += ':echecs:' + echecsC.join(' | ');
  return texte('status:200:corbeille:' + okC.length + ':' + detailC);
}

// ----------------------------------------------------------------- deplace
// node drive_push.js --deplace <id>[,<id>…] --vers <idDossier>
//
// `vers` accepte l'id d'un dossier existant. Si `creer` est fourni à la place,
// le dossier est créé sous `sous` (ou à la racine du Drive) puis sert de cible ;
// son id est retourné en tête de la réponse, ce qui permet d'enchaîner création
// et rangement en un seul appel.

if (p.action === 'deplace') {
  var idsD = String(p.ids || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length; });

  if (!idsD.length) return texte('error:aucun id fourni');

  var cible;
  try {
    if (p.creer) {
      var parent = p.sous ? DriveApp.getFolderById(p.sous) : DriveApp.getRootFolder();
      cible = parent.createFolder(p.creer);
    } else if (p.vers) {
      cible = DriveApp.getFolderById(p.vers);
    } else {
      return texte('error:precise --vers <idDossier> ou --creer <nom>');
    }
  } catch (e) {
    return texte('error:dossier cible introuvable (' + e.message + ')');
  }

  var okD = [], echecsD = [];
  for (var j = 0; j < idsD.length; j++) {
    try {
      var fD = DriveApp.getFileById(idsD[j]);
      var nomD = fD.getName();
      // moveTo() détache de tous les parents. Repli sur l'ancienne API au besoin.
      if (typeof fD.moveTo === 'function') {
        fD.moveTo(cible);
      } else {
        cible.addFile(fD);
        var anciens = fD.getParents();
        while (anciens.hasNext()) {
          var a = anciens.next();
          if (a.getId() !== cible.getId()) a.removeFile(fD);
        }
      }
      okD.push(nomD);
    } catch (e) {
      echecsD.push(idsD[j] + ' (' + e.message + ')');
    }
  }

  var detailD = cible.getId() + ' > ' + okD.join(' | ');
  if (echecsD.length) detailD += ':echecs:' + echecsD.join(' | ');
  return texte('status:200:deplace:' + okD.length + ':' + detailD);
}
