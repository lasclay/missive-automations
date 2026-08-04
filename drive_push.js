#!/usr/bin/env node
/**
 * drive_push.js — client du « Pousseur Lasclay Google ».
 *
 * Application Google Apps Script déployée en application web, qui écrit des fichiers
 * dans le Drive de admin@lasclay.com. Ce client n'est pas déployé : il tourne dans la
 * session et lit l'URL et le jeton depuis l'environnement, jamais en dur.
 *
 *   LASCLAY_DRIVE_PUSH_URL     requis, se termine par /exec
 *   LASCLAY_DRIVE_PUSH_TOKEN   requis
 *
 * Le jeton part en paramètre d'URL (`?token=`), le fichier en base64 dans le corps.
 *
 * Usage :
 *   node drive_push.js <fichier> --id <idFichier>              remplace, lien conservé
 *   node drive_push.js <fichier> --folder <idDossier> [--name <nom>]
 *   node drive_push.js <fichier> --cle controle                 liste blanche du script
 *   node drive_push.js --check                                  test d'authentification
 *
 * Options : --mime <type>   force le type (deviné d'après l'extension sinon)
 *           --min <octets>  plancher de taille (défaut 100 000 à l'écrasement, 0 au neuf)
 */

const fs = require("fs");
const path = require("path");

const URL_BASE = process.env.LASCLAY_DRIVE_PUSH_URL;
const TOKEN = process.env.LASCLAY_DRIVE_PUSH_TOKEN;

function meurs(msg) {
  console.error("Erreur: " + msg);
  process.exit(1);
}

/** POST puis suit la redirection 302 en GET, comme l'exige Apps Script. */
async function appelle(params, base64) {
  const qs = new URLSearchParams({ token: TOKEN, ...params }).toString();
  const r1 = await fetch(`${URL_BASE}?${qs}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: base64,
    redirect: "manual",
  });
  const loc = r1.headers.get("location");
  if (!loc) return (await r1.text()).trim();
  const r2 = await fetch(loc);
  return (await r2.text()).trim();
}

/** Traduit la réponse texte du script en objet, et en code de sortie. */
function interprete(rep) {
  if (rep === "unauthorized") {
    return {
      ok: false,
      code: "unauthorized",
      message:
        "Jeton refusé. Vérifie L'URL AVANT le jeton : le projet compte plusieurs\n" +
        "déploiements actifs, chacun avec sa propre URL et sa version figée du code.\n" +
        "Une URL périmée refuse un jeton pourtant valide.\n" +
        "  1. Éditeur › Déployer › Gérer les déploiements. Le déploiement courant est\n" +
        "     en haut de la liste Active. Compare son URL à LASCLAY_DRIVE_PUSH_URL.\n" +
        "  2. Sinon, le déploiement sert une vieille version : crayon › Version :\n" +
        "     Nouvelle version. Jamais « Nouveau déploiement », ça ajoute une URL.\n" +
        "  3. Sinon, une propriété de script TOKEN supplante la constante SECRET\n" +
        "     (jeton() renvoie getProperty('TOKEN') || SECRET).",
    };
  }
  const m = rep.match(/^status:(\d+):(ok|cree|refus):(.*)$/s);
  if (m) {
    const [, http, verbe, reste] = m;
    if (verbe === "refus") {
      return { ok: false, code: "refus", http: +http, message: reste };
    }
    const p = reste.split(":");
    const id = p[p.length - 1];
    const octets = (reste.match(/(\d+) octets/) || [])[1];
    return {
      ok: true,
      code: verbe === "cree" ? "cree" : "remplace",
      http: +http,
      nom: p[0],
      octets: octets ? +octets : null,
      id,
      url: `https://drive.google.com/file/d/${id}/view`,
    };
  }
  if (rep.startsWith("error:")) {
    return { ok: false, code: "error", message: rep.slice(6) };
  }
  return { ok: false, code: "inattendu", message: rep };
}

async function main() {
  if (!URL_BASE) meurs("LASCLAY_DRIVE_PUSH_URL manquante dans l'environnement.");
  if (!TOKEN) meurs("LASCLAY_DRIVE_PUSH_TOKEN manquant dans l'environnement.");

  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    // Corps vide : le script répond avant toute écriture. Aucun risque.
    const rep = await appelle({}, "");
    const r = interprete(rep);
    if (r.code === "unauthorized") {
      console.log("AUTH ÉCHOUÉE\n" + r.message);
      process.exit(1);
    }
    console.log("AUTH OK — le script répond : " + rep);
    return;
  }

  const fichier = args.find((a) => !a.startsWith("--"));
  if (!fichier) meurs("aucun fichier à pousser. Voir l'en-tête du script pour l'usage.");
  if (!fs.existsSync(fichier)) meurs("fichier introuvable : " + fichier);

  const opt = (nom) => {
    const i = args.indexOf("--" + nom);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const params = {};
  const id = opt("id");
  const folder = opt("folder");
  const cle = opt("cle");
  const name = opt("name");
  const mime = opt("mime");
  const min = opt("min");

  if (id) params.id = id;
  else if (folder) {
    params.folder = folder;
    params.name = name || path.basename(fichier);
  } else if (cle) params.file = cle;
  else meurs("précise une destination : --id, --folder ou --cle.");

  if (name && !params.name) params.name = name;
  if (mime) params.mime = mime;
  if (min !== undefined) params.min = min;

  const octets = fs.readFileSync(fichier);
  const rep = await appelle(params, octets.toString("base64"));
  const r = interprete(rep);

  if (!r.ok) {
    console.error("ÉCHEC (" + r.code + ")");
    console.error(r.message);
    process.exit(1);
  }
  console.log(
    (r.code === "cree" ? "Créé" : "Remplacé") +
      ` : ${r.nom} — ${r.octets} octets\n${r.url}`
  );
}

main().catch((e) => meurs(e.message));
