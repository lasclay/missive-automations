#!/usr/bin/env node
// Verifie, sans envoyer un seul courriel, ce qui peut l'etre gratuitement:
// syntaxe, doublons, domaines jetables, et surtout l'existence d'un serveur de
// courriel pour le domaine (MX, avec repli sur A comme le prevoit la norme).
//
// Un domaine sans MX ni A ne peut pas recevoir de courriel: le rebond est
// certain. C'est le seul verdict qu'on peut rendre sans parler au serveur.
// L'existence de la boite elle-meme demande une sonde SMTP ou un service tiers.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENTREE = path.join(__dirname, process.argv[2] || 'selection.json');
const SORTIE = path.join(__dirname, process.argv[3] || 'courriels_valides.json');
const CONC = 25;

const SYNTAXE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

// domaines jetables et fourre-tout connus: aucune valeur pour de la prospection
const JETABLES = new Set(['mailinator.com', 'guerrillamail.com', 'yopmail.com',
  '10minutemail.com', 'temp-mail.org', 'trashmail.com', 'sharklasers.com']);

// fournisseurs grand public: valides, mais signalent un commerce sans domaine propre
const GRAND_PUBLIC = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com',
  'yahoo.ca', 'live.ca', 'live.com', 'icloud.com', 'me.com', 'videotron.ca',
  'sympatico.ca', 'bell.net', 'shaw.ca', 'telus.net', 'globetrotter.net', 'aol.com']);

function doh(nom, type) {
  return new Promise((resolve) => {
    execFile('curl', ['-sS', '--max-time', '12',
      `https://dns.google/resolve?name=${encodeURIComponent(nom)}&type=${type}`],
      { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
        if (err) return resolve(null);
        try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
      });
  });
}

async function verifierDomaine(d) {
  const mx = await doh(d, 'MX');
  if (mx && (mx.Answer || []).some(a => a.type === 15)) {
    const hotes = mx.Answer.filter(a => a.type === 15)
      .map(a => a.data.split(' ').pop().replace(/\.$/, '').toLowerCase());
    let hebergeur = 'autre';
    const j = hotes.join(' ');
    if (/google|googlemail/.test(j)) hebergeur = 'Google Workspace';
    else if (/outlook|microsoft|protection\.outlook/.test(j)) hebergeur = 'Microsoft 365';
    else if (/shopify|mailgun|sendgrid/.test(j)) hebergeur = 'infonuagique';
    else if (/secureserver|godaddy/.test(j)) hebergeur = 'GoDaddy';
    else if (/zoho/.test(j)) hebergeur = 'Zoho';
    return { etat: 'ok', motif: 'MX present', hebergeur, mx: hotes.slice(0, 2) };
  }
  // sans MX, la norme autorise le repli sur l'adresse A du domaine
  const a = await doh(d, 'A');
  if (a && (a.Answer || []).some(x => x.type === 1)) {
    return { etat: 'douteux', motif: 'aucun MX, repli sur A', hebergeur: 'inconnu', mx: [] };
  }
  // NXDOMAIN = le domaine n'existe pas du tout
  const nx = a && a.Status === 3;
  return { etat: 'mort', motif: nx ? 'domaine inexistant' : 'aucun MX ni A', hebergeur: '', mx: [] };
}

(async () => {
  const fiches = JSON.parse(fs.readFileSync(ENTREE, 'utf8'))
    .filter(f => f.courriel && SYNTAXE.test(f.courriel.toLowerCase()));
  const rejetees = JSON.parse(fs.readFileSync(ENTREE, 'utf8'))
    .filter(f => f.courriel && !SYNTAXE.test(f.courriel.toLowerCase())).length;
  const domaines = [...new Set(fiches.map(f => f.courriel.split('@')[1].toLowerCase()))];
  console.error(`${fiches.length} adresses valides en syntaxe (${rejetees} rejetees), ${domaines.length} domaines a verifier`);

  const resultats = {};
  let i = 0, fini = 0;
  async function worker() {
    while (i < domaines.length) {
      const d = domaines[i++];
      resultats[d] = JETABLES.has(d)
        ? { etat: 'mort', motif: 'domaine jetable', hebergeur: '', mx: [] }
        : await verifierDomaine(d);
      if (++fini % 50 === 0) console.error(`${fini}/${domaines.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  // une meme adresse peut apparaitre sur plusieurs fiches: on ne l'ecrit qu'une fois
  const vues = new Set();
  const sortie = [];
  for (const f of fiches) {
    const mail = f.courriel.toLowerCase();
    const d = mail.split('@')[1];
    const r = resultats[d];
    const doublon = vues.has(mail);
    vues.add(mail);
    sortie.push({
      nom: f.nom, zone: f.zone, prov: f.prov, priorite: f.priorite, rang: f.rang,
      courriel: mail,
      etat: !SYNTAXE.test(mail) ? 'mort' : doublon ? 'doublon' : r.etat,
      motif: !SYNTAXE.test(mail) ? 'syntaxe invalide' : doublon ? 'adresse deja presente sur une autre fiche' : r.motif,
      hebergeur: r.hebergeur,
      generique: /^(info|contact|hello|hi|sales|admin|bonjour|service|boutique|shop|orders?)@/.test(mail),
      grand_public: GRAND_PUBLIC.has(d),
    });
  }
  fs.writeFileSync(SORTIE, JSON.stringify(sortie, null, 1));

  const par = (k) => sortie.filter(x => x.etat === k).length;
  console.log(`\nAdresses     : ${sortie.length}`);
  console.log(`  utilisables: ${par('ok')}`);
  console.log(`  douteuses  : ${par('douteux')}  (aucun MX, repli sur A)`);
  console.log(`  a retirer  : ${par('mort') + par('doublon')}  (dont ${par('doublon')} doublons)`);
  const heb = {};
  sortie.filter(x => x.etat === 'ok').forEach(x => { heb[x.hebergeur] = (heb[x.hebergeur] || 0) + 1; });
  console.log(`\nHebergeurs  : ${Object.entries(heb).sort((a, b) => b[1] - a[1]).map(e => `${e[0]} ${e[1]}`).join(', ')}`);
  console.log(`Generiques  : ${sortie.filter(x => x.generique && x.etat === 'ok').length}`);
  console.log(`Grand public: ${sortie.filter(x => x.grand_public && x.etat === 'ok').length}`);
})();
