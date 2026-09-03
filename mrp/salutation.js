/**
 * Lasclay — MRP : la salutation de l'accueil
 * ---------------------------------------------------------------------------
 * « Bon matin Montassar. Des questions ? »
 *
 * DEUX FUSEAUX, PAS UN
 *
 * Souhaiter « bonsoir » à quelqu'un qui déjeune est la façon la plus rapide de
 * faire sentir qu'une app ne sait pas à qui elle parle. Québec et Tunis sont à
 * cinq ou six heures d'écart selon la saison : l'heure du serveur ne dit rien
 * de l'heure de celui qui lit.
 *
 * Le fuseau se déduit du rôle, parce que les rôles de cette app SONT des lieux
 * — « Admin QC » et « Atelier Tunisie ». Ce n'est pas parfait (quelqu'un peut
 * voyager) mais c'est vrai le reste du temps, et ça ne demande aucun réglage.
 *
 * CE QUI SUIT LE BONJOUR
 *
 * « Des questions ? » est une formule creuse quand trois tâches attendent. La
 * deuxième phrase dit donc ce qui attend vraiment, et retombe sur la formule
 * seulement quand il n'y a rien à signaler. Aucun appel au modèle : c'est du
 * texte, calculé en une milliseconde, sur une connexion lente.
 */
'use strict';

const FUSEAU = { admin: 'America/Montreal', atelier: 'Africa/Tunis' };

/**
 * L'heure locale de quelqu'un, 0-23, d'après son rôle.
 *
 * On lit la PARTIE « hour », pas la chaîne formatée : en fr-CA, .format() rend
 * « 06 h », que Number() ne sait pas lire. Le repli silencieux sur l'heure UTC
 * donnait la même heure à Québec et à Tunis — exactement le bogue que ce
 * module existe pour éviter.
 */
function heureLocale(role, maintenant = new Date()) {
  const tz = FUSEAU[role] || FUSEAU.admin;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).formatToParts(maintenant);
  const h = parts.find(p => p.type === 'hour');
  const n = h ? Number(h.value) : NaN;
  return Number.isFinite(n) ? n % 24 : maintenant.getUTCHours();
}

/**
 * Le bonjour lui-même. « Bon matin » est québécois et assumé : c'est comme ça
 * que Gab et Cath se saluent, et Montassar travaille avec eux.
 */
function moment(heure) {
  if (heure >= 5 && heure < 12) return 'Bon matin';
  if (heure >= 12 && heure < 18) return 'Bon après-midi';
  if (heure >= 18 && heure < 23) return 'Bonsoir';
  return 'Bonne nuit';
}

/** Le prénom seul : « Bon matin Montassar B. » sonne comme un formulaire. */
const prenom = (nom) => String(nom || '').trim().split(/\s+/)[0] || '';

/**
 * La salutation complète.
 *
 * `taches` vient de compteTaches() ; `echeance` est la prochaine date clé, ou
 * null. Les deux sont facultatifs — sans eux la formule reste correcte.
 */
function saluer({ user, taches = null, echeance = null, maintenant = new Date() }) {
  const h = heureLocale(user.role, maintenant);
  const bonjour = `${moment(h)} ${prenom(user.nom)}`;

  // Ce qui attend passe avant la politesse. Le retard d'abord : c'est la seule
  // chose qui demande une décision aujourd'hui.
  let suite;
  if (taches && taches.retard > 0) {
    suite = taches.retard === 1
      ? 'Une tâche a dépassé son échéance.'
      : `${taches.retard} tâches ont dépassé leur échéance.`;
  } else if (taches && taches.n > 0) {
    suite = taches.n === 1 ? 'Une tâche t’attend.'
                           : `${taches.n} tâches t’attendent.`;
  } else if (echeance) {
    const jours = Math.round(
      (new Date(echeance + 'T00:00:00Z') - new Date(
        maintenant.toISOString().slice(0, 10) + 'T00:00:00Z')) / 864e5);
    suite = jours < 0 ? 'Une échéance est dépassée.'
          : jours === 0 ? 'Une échéance tombe aujourd’hui.'
          : jours === 1 ? 'Une échéance tombe demain.'
          : jours <= 14 ? `Prochaine échéance dans ${jours} jours.`
          : 'Des questions ?';
  } else {
    suite = 'Des questions ?';
  }

  return { bonjour, suite, heure: h, texte: `${bonjour}. ${suite}` };
}

module.exports = { saluer, heureLocale, moment, prenom, FUSEAU };
