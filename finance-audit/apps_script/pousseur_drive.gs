// ============================================================
// Pousseur de versions Lasclay — généralisé
//
// Usage : POST <URL>?token=SECRET&<destination>   body = fichier en base64
//
//   &file=controle              une clé de la liste blanche (comme avant)
//   &id=<idFichier>             remplace un fichier existant, lien conservé
//   &folder=<idDossier>&name=…  écrase l'homonyme du dossier, ou le crée
//
// Facultatif : &mime=… (deviné d'après l'extension sinon), &min=<octets>.
//
// Garde-fous : le plancher de taille ne s'applique qu'à l'écrasement d'un
// fichier existant. Un appel raté ne peut donc pas vider un fichier qui compte
// (incident du 27 juillet), et un fichier neuf n'est plus bloqué par un
// minimum qui n'a rien à protéger. La signature ZIP devient une vérification
// par type plutôt qu'une règle unique : elle interdisait tout ce qui n'est pas
// un .xlsx, à commencer par le mémo PDF.
// ============================================================

const SECRET = 'REMPLACER_PAR_LE_JETON';   // ou, mieux, en propriété de script

const ALLOWED_FILES = {
  'controle': '1KHvc5QlzyzGtAcGriO7oEg9Il1ySvXqg'   // PREVISIONS LASCLAY controle
};

// Dossiers dans lesquels l'écriture est permise, en remontant l'arbre des
// parents. La liste vide ouvre tout le Drive du compte : c'est le réglage
// demandé, et c'est aussi ce qu'une fuite du jeton permettrait d'atteindre.
// Pour refermer, y mettre par exemple '1zOTIG_Mk6-L7o34qzp7jr8Qjk959khDY',
// le dossier des prévisions financières.
const RACINES_AUTORISEES = [];

const TAILLE_MIN_ECRASEMENT = 100000;   // 100 Ko

const TYPES = {
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

// Signature attendue par type, quand il y en a une. Un envoi tronqué ou une
// page d'erreur HTML se reconnaissent ainsi avant d'écraser quoi que ce soit.
const SIGNATURES = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [0x50, 0x4B],
  'application/zip': [0x50, 0x4B],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],   // %PDF
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/jpeg': [0xFF, 0xD8, 0xFF]
};

function texte(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

function jeton() {
  return PropertiesService.getScriptProperties().getProperty('TOKEN') || SECRET;
}

function typeDepuisNom(nom) {
  const p = String(nom || '').toLowerCase().split('.');
  return (p.length > 1 && TYPES[p[p.length - 1]]) || 'application/octet-stream';
}

function signatureOk(octets, mime) {
  const attendue = SIGNATURES[mime];
  if (!attendue) return true;
  if (octets.length < attendue.length) return false;
  for (var i = 0; i < attendue.length; i++) {
    // base64Decode rend des octets signés : 0x89 y vaut -119.
    if (((octets[i] + 256) % 256) !== attendue[i]) return false;
  }
  return true;
}

/** Ce dossier, ou l'un de ses ancêtres, est-il une racine autorisée ? */
function sousUneRacine(dossier) {
  if (!RACINES_AUTORISEES.length) return true;
  const vus = {};
  const pile = [dossier];
  while (pile.length) {
    const d = pile.pop();
    const id = d.getId();
    if (RACINES_AUTORISEES.indexOf(id) !== -1) return true;
    if (vus[id]) continue;
    vus[id] = true;
    const parents = d.getParents();
    while (parents.hasNext()) pile.push(parents.next());
  }
  return false;
}

function destinationAutorisee(fichier, dossier) {
  if (!RACINES_AUTORISEES.length) return true;
  if (dossier) return sousUneRacine(dossier);
  const parents = fichier.getParents();
  while (parents.hasNext()) {
    if (sousUneRacine(parents.next())) return true;
  }
  return false;
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (!p.token || p.token !== jeton()) {
      return texte('unauthorized');
    }

    // --- le contenu ------------------------------------------------------
    var octets;
    try {
      octets = Utilities.base64Decode(e.postData.contents);
    } catch (err) {
      return texte('error:corps illisible, base64 attendu');
    }
    if (!octets.length) return texte('error:corps vide — fichier NON modifié');

    // --- la destination --------------------------------------------------
    const cle = p.file || p.cible;
    var fileId = p.id || null;
    if (!fileId && cle) {
      fileId = ALLOWED_FILES[cle];
      if (!fileId) return texte('error:fichier non autorisé: ' + cle);
    }
    const dossierId = p.folder || p.dossier;
    const nom = p.name || p.nom;

    if (!fileId && !dossierId) fileId = ALLOWED_FILES['controle'];
    if (!fileId && dossierId && !nom) {
      return texte('error:un dossier sans nom de fichier ne dit pas où écrire');
    }

    var existant = null, dossier = null;
    try {
      if (fileId) {
        existant = DriveApp.getFileById(fileId);
      } else {
        dossier = DriveApp.getFolderById(dossierId);
        const homonymes = dossier.getFilesByName(nom);
        if (homonymes.hasNext()) existant = homonymes.next();
      }
    } catch (err) {
      return texte('error:destination introuvable: ' + err);
    }

    if (!destinationAutorisee(existant, dossier)) {
      return texte('error:destination hors des dossiers autorisés');
    }

    // --- garde-fous ------------------------------------------------------
    const nomFinal = nom || (existant ? existant.getName() : 'sans-nom');
    const mime = p.mime
      || (nom ? typeDepuisNom(nom)
              : (existant ? existant.getMimeType() : 'application/octet-stream'));

    // Le plancher protège ce qui existe déjà. Un fichier neuf n'a rien à
    // perdre, alors on ne l'y soumet pas.
    const minimum = p.min ? parseInt(p.min, 10)
                          : (existant ? TAILLE_MIN_ECRASEMENT : 0);
    if (octets.length < minimum) {
      return texte('status:400:refus:contenu de ' + octets.length +
                   ' octets, minimum ' + minimum + ' — fichier NON modifié');
    }
    if (!signatureOk(octets, mime)) {
      return texte('status:400:refus:signature de ' + mime +
                   ' absente — fichier NON modifié');
    }

    // --- écrire ----------------------------------------------------------
    const blob = Utilities.newBlob(octets, mime, nomFinal);

    if (existant) {
      const maj = Drive.Files.update({}, existant.getId(), blob,
                                     { supportsAllDrives: true });
      return texte('status:200:ok:' + maj.name + ':' + octets.length +
                   ' octets:' + existant.getId());
    }
    const neuf = Drive.Files.create(
      { name: nomFinal, parents: [dossierId], mimeType: mime }, blob,
      { supportsAllDrives: true });
    return texte('status:200:cree:' + neuf.name + ':' + octets.length +
                 ' octets:' + neuf.id);

  } catch (err) {
    return texte('error:' + err);
  }
}

function testAuth() {
  Object.keys(ALLOWED_FILES).forEach(function (k) {
    Logger.log(k + ' -> ' + DriveApp.getFileById(ALLOWED_FILES[k]).getName());
  });
  Logger.log('racines autorisées : ' +
             (RACINES_AUTORISEES.length ? RACINES_AUTORISEES.join(', ')
                                        : 'aucune restriction'));
}
