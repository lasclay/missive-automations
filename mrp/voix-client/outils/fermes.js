/**
 * Index des fils FERMÉS sur trois ans.
 *
 * Lister coûte cinquante fils par appel ; lire en coûte un. Sur un historique
 * de l'ordre de quarante mille conversations, la différence décide de ce qui
 * est faisable : on liste tout, on croise avec l'index des étiquettes, et on
 * ne lira ensuite que le petit nombre qui parle vraiment de produit.
 *
 * Reprenable par le curseur : chaque tranche écrit où elle s'est arrêtée. Une
 * limite de débit n'annule rien, elle retarde.
 */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEPOT = '/home/user/missive-automations';
const SORTIE = path.join(__dirname, 'fermes.json');
const TROIS_ANS = Math.floor(Date.now() / 1000) - 3 * 365 * 86400;
const PAGES = 6;                       // 300 fils par appel : assez gros pour avancer,
                                       // assez petit pour ne pas retomber en timeout.

const etat = fs.existsSync(SORTIE)
  ? JSON.parse(fs.readFileSync(SORTIE, 'utf8'))
  : { fils: {}, until: null, fini: false, appels: 0 };

const dors = (s) => execFileSync('sleep', [String(s)]);

while (!etat.fini) {
  const args = ['missive_client.js', 'list', 'closed=true', String(PAGES), String(TROIS_ANS)];
  if (etat.until) args.push(String(etat.until));

  let d = null;
  for (let essai = 0; essai < 5 && !d; essai++) {
    try {
      d = JSON.parse(execFileSync('node', args,
        { cwd: DEPOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 }));
    } catch (e) {
      const attente = [60, 150, 300, 600, 900][essai];
      console.log(`  … limite ou échec, pause ${attente} s (essai ${essai + 1}/5)`);
      if (essai === 4) { console.log('  ✗ abandon de la tranche'); break; }
      dors(attente);
    }
  }
  if (!d) break;

  for (const c of d.conversations || []) {
    if (!etat.fils[c.id]) etat.fils[c.id] = {
      id: c.id, subject: c.subject || '', last_activity_at: c.last_activity_at || null };
  }
  etat.appels++;
  etat.until = d.until || null;
  if (!d.until) etat.fini = true;
  fs.writeFileSync(SORTIE, JSON.stringify(etat));

  const n = Object.keys(etat.fils).length;
  const dates = Object.values(etat.fils).map(f => f.last_activity_at).filter(Boolean);
  const vieux = dates.length ? new Date(Math.min(...dates) * 1000).toISOString().slice(0, 10) : '—';
  console.log(`  ${String(n).padStart(6)} fils fermés · remonté jusqu'au ${vieux} · ${etat.appels} appels`);
}

console.log(`\n  ${Object.keys(etat.fils).length} fils fermés indexés${etat.fini ? ' — complet' : ' — interrompu, relançable'}.`);
