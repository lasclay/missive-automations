/**
 * Étape 2 de l'extraction : LIRE chaque fil.
 *
 * Un fichier JSON par conversation dans fils/. Reprenable par construction :
 * ce qui est déjà sur disque n'est pas redemandé. On peut donc l'arrêter,
 * le relancer, le laisser tourner des heures.
 *
 * LA LIMITE DE DÉBIT EST LE VRAI SUJET. Le proxy dort déjà 260 ms entre deux
 * appels Missive et retente trois fois sur un 429 — mais Missive nous a
 * répondu « retry_after: 255 », donc ses trois essais de 30 s ne suffisent
 * pas. Ici on recule vraiment : 60 s, puis 120, puis 300, puis 600. Mieux vaut
 * une extraction lente qui finit qu'une rapide qui se fait couper.
 */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEPOT = '/home/user/missive-automations';
const ICI = __dirname;
const FILS = path.join(ICI, 'fils');
fs.mkdirSync(FILS, { recursive: true });

const index = JSON.parse(fs.readFileSync(path.join(ICI, 'index.json'), 'utf8'));
/*
 * L'ORDRE DE LECTURE EST UNE DÉCISION, PAS UN DÉTAIL.
 *
 * Missive nous limite à quelques fils par minute : 5 109 fils, c'est des
 * heures. Si l'extraction est coupée en chemin — et elle le sera — ce qui
 * compte est CE QU'ON AURA DÉJÀ.
 *
 * On lit donc par utilité pour le contrôle qualité, pas par date. Un fil de
 * retour ou de produit défectueux vaut cent fils de suivi d'expédition, qui
 * n'apprennent rien à un atelier. À rang égal, le plus récent d'abord : ce
 * sont les modèles que la Tunisie fabrique aujourd'hui.
 */
const RANGS = [
  [1, /R&D|RETOURS|défectueux|conception produit|Quantité d'isolant/i],
  [2, /Pantoufles|Cache-cou petit|Tuque jaune|Verif grandeur|germination|quincaillerie/i],
  [3, /Réclamation|Cas à voir|review à traiter|MANTEAU|Usage et entretien|Use and care/i],
  [4, /Ventes - info pré-achat|Problèmes et erreurs|Problems and errors/i],
];
const rang = (f) => {
  for (const [r, re] of RANGS) if ((f.labels || []).some(l => re.test(l))) return r;
  return 9;                                   // expédition, suivi, facturation…
};

/*
 * Le rang 9 est écarté sur décision de Gabriel : suivi d'expédition, retard de
 * Postes Canada, code promo, facturation. 2 827 fils, plus de quatre heures
 * d'extraction, et rien qui apprenne quoi que ce soit à quelqu'un qui coud.
 *
 * Ce n'est pas une perte : l'index les garde tous, et `RANG_MAX` suffit à les
 * reprendre un jour si une question de qualité finit par les concerner.
 */
const RANG_MAX = Number(process.env.RANG_MAX || 4);

const fils = Object.values(index.fils)
  .map(f => ({ ...f, rang: rang(f) }))
  .filter(f => f.rang <= RANG_MAX)
  .sort((a, b) => a.rang - b.rang
                || (b.last_activity_at || 0) - (a.last_activity_at || 0));

{
  const parRang = {};
  for (const f of fils) parRang[f.rang] = (parRang[f.rang] || 0) + 1;
  console.log('  ordre de lecture : '
    + Object.entries(parRang).map(([r, n]) => `rang ${r} → ${n}`).join(' · '));
}

const dors = (s) => execFileSync('sleep', [String(s)]);
const journal = path.join(ICI, 'lire.log');
const dire = (m) => { console.log(m); fs.appendFileSync(journal, m + '\n'); };

let lus = 0, sautes = 0, echecs = 0, pj = 0;
const debut = Date.now();

for (let i = 0; i < fils.length; i++) {
  const f = fils[i];
  const dest = path.join(FILS, f.id + '.json');
  if (fs.existsSync(dest)) { sautes++; continue; }

  let ok = false;
  for (let essai = 0; essai < 5 && !ok; essai++) {
    try {
      const out = execFileSync('node', ['missive_client.js', 'read', f.id],
        { cwd: DEPOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 });
      const d = JSON.parse(out);
      const msgs = d.messages || [];
      const jointes = msgs.flatMap(m => (m.attachments || [])
        .map(a => ({ ...a, message_id: m.id })));
      pj += jointes.length;
      fs.writeFileSync(dest, JSON.stringify({
        id: f.id, subject: f.subject, last_activity_at: f.last_activity_at,
        labels: f.labels, tronque: Boolean(d.tronque),
        messages: msgs, attachments: jointes,
      }));
      lus++; ok = true;
    } catch (e) {
      const msg = String(e.stdout || e.message || '');
      const limite = /429|Too many requests/.test(msg);
      const attente = [60, 120, 300, 600, 900][essai];
      if (essai === 4) { echecs++; dire(`  ✗ ${f.id} — ${msg.slice(0, 110)}`); break; }
      dire(`  … ${limite ? 'limite de débit' : 'échec'}, pause ${attente} s (essai ${essai + 1}/5)`);
      dors(attente);
    }
  }

  if ((lus + sautes) % 100 === 0) {
    const min = Math.round((Date.now() - debut) / 60000);
    const reste = fils.length - lus - sautes - echecs;
    dire(`  ${String(lus + sautes).padStart(5)}/${fils.length}  `
       + `lus ${lus} · déjà là ${sautes} · échecs ${echecs} · ${pj} pièces jointes `
       + `· ${min} min · reste ${reste}`);
  }
}

dire(`\n  TERMINÉ — ${lus} lus, ${sautes} déjà présents, ${echecs} échecs, `
   + `${pj} pièces jointes repérées, ${Math.round((Date.now() - debut) / 60000)} min.`);
