/**
 * Pousseur Drive de Lasclay — version généralisée.
 *
 * La version précédente ne connaissait qu'une cible, `controle`, associée en dur
 * au chiffrier de prévisions, et refusait tout contenu ne commençant pas par
 * « PK ». Elle ne pouvait donc déposer ni le mémo PDF, ni quoi que ce soit
 * d'autre.
 *
 * Celle-ci prend n'importe quel fichier et n'importe quelle destination :
 *
 *   POST <url>?token=…&id=<idFichier>
 *       remplace le contenu d'un fichier existant. Le lien de partage ne change
 *       pas, ce qui compte quand des bailleurs l'ont déjà.
 *
 *   POST <url>?token=…&folder=<idDossier>&name=<nom>
 *       écrase le fichier de ce nom dans ce dossier s'il existe, le crée sinon.
 *
 *   POST <url>?token=…&cible=controle
 *       les noms d'autrefois continuent de fonctionner, pour ne rien casser.
 *
 * Le corps de la requête est le fichier encodé en base64, en text/plain.
 * Paramètres facultatifs : `mime` (deviné d'après l'extension sinon) et `min`
 * (taille plancher en octets).
 */

// Les noms hérités de la version précédente, toujours acceptés.
var CIBLES = {
  controle: '1KHvc5QlzyzGtAcGriO7oEg9Il1ySvXqg'   // PREVISIONS LASCLAY version de travail.xlsx
};

/**
 * Dossiers à l'intérieur desquels l'écriture est permise, en remontant l'arbre.
 * Le jeton seul ouvrirait sinon tout le Drive du compte : une fuite de jeton
 * pourrait alors écraser n'importe quoi. Mettre [] retire la barrière.
 */
var RACINES_AUTORISEES = [
  '1zOTIG_Mk6-L7o34qzp7jr8Qjk959khDY'   // dossier des prévisions financières
];

/** Plancher par défaut, en octets, quand on écrase un fichier existant. */
var MIN_ECRASEMENT = 1000;

var TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  json: 'application/json',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  zip: 'application/zip'
};

function sortie(texte) {
  return ContentService.createTextOutput(texte)
      .setMimeType(ContentService.MimeType.TEXT);
}

function typeDepuisNom(nom) {
  var p = String(nom || '').toLowerCase().split('.');
  return (p.length > 1 && TYPES[p[p.length - 1]]) || 'application/octet-stream';
}

/** Le fichier ou le dossier descend-il d'une racine autorisée ? */
function dansUneRacine(dossier) {
  if (!RACINES_AUTORISEES.length) return true;
  var vus = {};
  var pile = [dossier];
  while (pile.length) {
    var d = pile.pop();
    var id = d.getId();
    if (RACINES_AUTORISEES.indexOf(id) !== -1) return true;
    if (vus[id]) continue;
    vus[id] = true;
    var parents = d.getParents();
    while (parents.hasNext()) pile.push(parents.next());
  }
  return false;
}

function dossierAutorise(fichierOuDossier, estDossier) {
  if (!RACINES_AUTORISEES.length) return true;
  if (estDossier) return dansUneRacine(fichierOuDossier);
  var parents = fichierOuDossier.getParents();
  while (parents.hasNext()) {
    if (dansUneRacine(parents.next())) return true;
  }
  return false;
}

function doPost(e) {
  var p = (e && e.parameter) || {};

  var attendu = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!attendu || p.token !== attendu) return sortie('error:jeton invalide');

  // Le corps arrive en base64 ; on le décode avant toute vérification de taille,
  // parce que le plancher porte sur le fichier et non sur son encodage.
  var brut = (e && e.postData && e.postData.contents) || '';
  var octets;
  try {
    octets = Utilities.base64Decode(brut);
  } catch (err) {
    return sortie('error:corps illisible, base64 attendu');
  }
  if (!octets.length) return sortie('error:corps vide');

  // --- où écrire -----------------------------------------------------------
  var cible = p.cible || p.file;
  var id = p.id || (cible ? CIBLES[cible] : null);
  if (cible && !id) return sortie('error:fichier non autorisé: ' + cible);

  var dossierId = p.folder || p.dossier;
  var nom = p.name || p.nom;
  if (!id && !dossierId) {
    // Sans destination explicite, on retombe sur la cible historique plutôt que
    // d'écrire au hasard.
    id = CIBLES.controle;
  }
  if (!id && dossierId && !nom) {
    return sortie('error:un dossier sans nom de fichier ne dit pas où écrire');
  }

  var existant = null, dossier = null;
  try {
    if (id) {
      existant = DriveApp.getFileById(id);
    } else {
      dossier = DriveApp.getFolderById(dossierId);
      var memeNom = dossier.getFilesByName(nom);
      if (memeNom.hasNext()) existant = memeNom.next();
    }
  } catch (err) {
    return sortie('error:destination introuvable: ' + err);
  }

  if (existant ? !dossierAutorise(existant, false)
               : !dossierAutorise(dossier, true)) {
    return sortie('error:destination hors des dossiers autorisés');
  }

  // --- garde-fous ----------------------------------------------------------
  // Un plancher de taille ne s'applique qu'à l'écrasement : un envoi tronqué ne
  // doit pas effacer un fichier qui existe. Un fichier neuf n'a rien à écraser.
  var minimum = p.min ? parseInt(p.min, 10) : (existant ? MIN_ECRASEMENT : 0);
  if (octets.length < minimum) {
    return sortie('status:400:refus:contenu de ' + octets.length +
                  ' octets, minimum ' + minimum + ' — fichier NON modifié');
  }

  var nomFinal = nom || (existant ? existant.getName() : 'sans-nom');
  var mime = p.mime || (nom ? typeDepuisNom(nom)
                            : (existant ? existant.getMimeType()
                                        : 'application/octet-stream'));
  var blob = Utilities.newBlob(octets, mime, nomFinal);

  // --- écrire --------------------------------------------------------------
  try {
    if (existant) {
      // Drive.Files.update remplace le contenu en gardant l'identifiant, donc
      // le lien de partage. Le service Drive avancé doit être activé
      // (Services > Drive API). setContent() de DriveApp ne sait faire que du
      // texte et corromprait un binaire.
      Drive.Files.update({}, existant.getId(), blob);
      return sortie('status:200:ok:' + existant.getName() +
                    ':' + octets.length + ' octets:' + existant.getId());
    }
    var neuf = dossier.createFile(blob);
    return sortie('status:200:cree:' + neuf.getName() +
                  ':' + octets.length + ' octets:' + neuf.getId());
  } catch (err) {
    return sortie('error:écriture refusée: ' + err);
  }
}
