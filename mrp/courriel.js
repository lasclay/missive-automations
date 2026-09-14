/**
 * Lasclay — MRP : le courriel de rappel
 * ---------------------------------------------------------------------------
 * Le rappel hebdomadaire vit dans l'app, parce que c'est là que le geste se
 * fait. Mais un rappel dans une app qu'on n'ouvre pas ne rappelle rien : il
 * faut aussi frapper à la porte. D'où ce fichier.
 *
 * PAR LE PROXY MISSIVE, PAS PAR UNE CLÉ DE PLUS
 *
 * Lasclay a déjà un service qui sait envoyer un courriel depuis
 * admin@lasclay.com — le proxy Missive. Ajouter ici une clé SMTP ou un compte
 * Postmark donnerait un deuxième secret à faire tourner, un deuxième endroit
 * où ça casse, et un expéditeur que personne ne reconnaît. Le MRP appelle donc
 * le proxy, avec le même secret que le reste de la maison.
 *
 * ÉTEINT PAR DÉFAUT, ET PAS SEULEMENT PAR L'ABSENCE DE SECRET
 *
 * Première version de ce fichier : l'envoi était armé dès que
 * `MISSIVE_PROXY_SECRET` existait dans l'environnement. Le premier appel de
 * vérification, avec une adresse bidon, est parti pour de vrai — le secret
 * était là, il traîne dans tout environnement qui parle à Missive.
 *
 * La leçon tient en une phrase : **la présence d'une clé n'est pas un
 * consentement à s'en servir.** Il faut donc DEUX conditions, et la seconde
 * n'existe que pour ça : `MRP_COURRIEL_ARME=1`, posé à la main sur Render, et
 * nulle part ailleurs. Sans elle, `envoyerRappel` compose le message, le
 * journalise, et ne l'envoie pas.
 *
 * Un courriel envoyé ne se rappelle pas, et celui-là part tout seul, chaque
 * semaine, sans personne pour le relire.
 */
'use strict';
const https = require('node:https');
const { URL } = require('node:url');

const PROXY = process.env.MISSIVE_PROXY_URL || 'https://proxy-missive.onrender.com';
const SECRET = process.env.MISSIVE_PROXY_SECRET || process.env.PROXY_SECRET || '';
const EXPEDITEUR = process.env.MRP_COURRIEL_EXPEDITEUR || 'admin@lasclay.com';
const APP = process.env.MRP_URL || 'https://lasclay-mrp.onrender.com';

/** Pourquoi l'envoi est coupé, ou null s'il est armé. */
function coupure() {
  if (process.env.MRP_SANS_COURRIEL === '1') return 'MRP_SANS_COURRIEL=1';
  // L'armement explicite passe en premier : c'est le garde-fou, et il doit
  // manquer bruyamment plutôt que d'être masqué par une autre condition.
  if (process.env.MRP_COURRIEL_ARME !== '1') return 'MRP_COURRIEL_ARME absent';
  if (!SECRET) return 'MISSIVE_PROXY_SECRET absent';
  return null;
}

function poste(chemin, charge) {
  return new Promise((resolve, reject) => {
    const u = new URL(chemin, PROXY);
    const corps = Buffer.from(JSON.stringify(charge));
    const r = https.request(u, { method: 'POST', timeout: 20000, headers: {
      'content-type': 'application/json',
      'content-length': corps.length,
      'x-proxy-secret': SECRET,
    }}, (rep) => {
      let d = '';
      rep.on('data', (c) => { d += c; });
      rep.on('end', () => {
        // Le proxy répond en JSON même sur erreur : on garde son message, qui
        // dit ce qui manque, plutôt qu'un code nu.
        let j = null; try { j = JSON.parse(d); } catch { /* pas du JSON */ }
        if (rep.statusCode >= 200 && rep.statusCode < 300) return resolve(j || {});
        reject(new Error(`${rep.statusCode} ${j?.error || d.slice(0, 200)}`));
      });
    });
    r.on('timeout', () => r.destroy(new Error('délai dépassé')));
    r.on('error', reject);
    r.end(corps);
  });
}

const TEXTE = ({ nom, echeance, restants }) => `Bonjour ${nom},

C'est le rappel de la semaine : il faut déclarer où en est chaque lot de l'ordre de production, d'ici ${echeance}.

${APP}/ordres

Poser le pourcentage de chaque lot, même s'il n'a pas bougé. « Toujours à 60 % » est une information ; le silence, non — vu de Québec, un lot qui ne bouge pas et un lot dont personne ne parle se ressemblent, et on finit par planifier un conteneur sur des chiffres périmés.

${restants ? `Il reste ${restants} lot${restants > 1 ? 's' : ''} à ${'0 %'} dans l'ordre en cours.\n\n` : ''}S'il y a un blocage — une matière qui manque, une machine, un patron pas clair — écris-le en note sur le lot concerné. C'est lu.

Merci,
Lasclay`;

/**
 * Envoie le rappel hebdomadaire à une personne.
 * Renvoie { envoye:true } ou { envoye:false, pourquoi }.
 */
async function envoyerRappel({ courriel, nom, echeance, restants = 0 }) {
  if (!courriel) return { envoye: false, pourquoi: 'aucune adresse au compte' };
  const off = coupure();
  if (off) {
    // Non armé : on montre CE QUI SERAIT PARTI, pour qu'on puisse relire le
    // message sans avoir à l'envoyer pour le lire.
    console.log(`[mrp] courriel non armé (${off}) — rappel non envoyé à ${courriel}`);
    return { envoye: false, pourquoi: off,
             apercu: { a: courriel, objet: `Avancement de la semaine — à déclarer d'ici ${echeance}`,
                       corps: TEXTE({ nom: nom || '', echeance, restants }) } };
  }
  try {
    await poste('/send', {
      from: EXPEDITEUR,
      to: [courriel],
      subject: `Avancement de la semaine — à déclarer d'ici ${echeance}`,
      body: TEXTE({ nom: nom || '', echeance, restants }),
      // `send: true` : un rappel qui attend qu'un humain appuie sur envoyer
      // n'est pas un rappel. C'est la seule route du MRP qui sort vers
      // quelqu'un, et elle n'écrit qu'à des comptes de l'équipe.
      send: true,
    });
    return { envoye: true };
  } catch (e) {
    return { envoye: false, pourquoi: String(e.message || e).slice(0, 200) };
  }
}

module.exports = { envoyerRappel, coupure };
