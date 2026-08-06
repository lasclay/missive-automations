#!/usr/bin/env node
// Confirme que chaque adresse est bien celle du commerce, en la recherchant sur
// son propre site. Ce n'est pas une sonde SMTP: ca ne dit pas si la boite existe.
// Ca repond a une autre question, plus utile ici: est-ce que cette adresse
// appartient vraiment a ce commerce, et est-elle toujours publiee?
//
// Trois raisons de faire ce controle plutot qu'un autre:
//  - le scraper a deja ramasse des adresses de developpeurs et d'auteurs de
//    polices. Une adresse absente du site est suspecte par nature.
//  - une entreprise ne laisse pas une adresse morte sur sa page contact. Une
//    adresse encore publiee est presque toujours encore relevee.
//  - la LCAP fonde le consentement tacite sur une adresse « publiee
//    publiquement ». Confirmer la publication, c'est la diligence legale.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONC = 30;
const PAGES = ['', '/contact', '/pages/contact', '/contact-us', '/nous-joindre', '/a-propos', '/about'];

function get(url) {
  return new Promise((resolve) => {
    execFile('curl', ['-sSL', '--max-time', '12', '--connect-timeout', '6', '--compressed',
      '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      url], { maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => resolve(err ? '' : (stdout || '').slice(0, 400000)));
  });
}

const domaineDe = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};

async function confirmer(f) {
  const res = {
    ...f,
    publiee: 'site absent',
    alignement: '',
    autres_adresses: [],
  };
  if (!f.web || !/^https?:/.test(f.web)) return res;

  const dSite = domaineDe(f.web);
  const dMail = f.courriel.split('@')[1];
  res.alignement = !dSite ? '' : (dMail === dSite ? 'meme domaine'
    : (dMail.endsWith('.' + dSite) || dSite.endsWith('.' + dMail)) ? 'sous-domaine'
    : /^(gmail|hotmail|outlook|yahoo|icloud|videotron|sympatico|bell|shaw|telus)\./.test(dMail + '.') ? 'boite grand public'
    : 'domaine different');

  const base = f.web.replace(/\/$/, '');
  const trouvees = new Set();
  let joignable = false;
  for (const p of PAGES) {
    const html = await get(base + p);
    if (!html || html.length < 200) { if (p === '') break; else continue; }
    joignable = true;
    const bas = html.toLowerCase();
    if (bas.includes(f.courriel)) { res.publiee = 'confirmee'; break; }
    for (const m of html.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      const e = m[0].toLowerCase();
      if (!/\.(png|jpe?g|gif|svg|webp|avif|heic|css|js|woff2?)$/.test(e) && e.length < 60) trouvees.add(e);
    }
  }
  if (res.publiee !== 'confirmee') {
    res.publiee = joignable ? 'absente du site' : 'site injoignable';
    res.autres_adresses = [...trouvees].slice(0, 3);
  }
  return res;
}

(async () => {
  const entree = process.argv[2] || 'courriels_valides.json';
  const sortie = process.argv[3] || 'vague1_confirmee.json';
  const tout = JSON.parse(fs.readFileSync(path.join(__dirname, entree), 'utf8'));
  const selection = JSON.parse(fs.readFileSync(path.join(__dirname, 'selection.json'), 'utf8'));
  const web = {};
  for (const s of selection) if (s.courriel) web[s.courriel.toLowerCase()] = s.web || '';

  const cibles = tout
    .filter(x => x.priorite && x.priorite.startsWith('A') && x.etat === 'ok')
    .map(x => ({ ...x, web: web[x.courriel] || '' }));
  console.error(`${cibles.length} adresses a confirmer`);

  const out = [];
  let i = 0, fini = 0;
  async function worker() {
    while (i < cibles.length) {
      const c = cibles[i++];
      out.push(await confirmer(c));
      if (++fini % 20 === 0) console.error(`${fini}/${cibles.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(path.join(__dirname, sortie), JSON.stringify(out, null, 1));

  const n = (p) => out.filter(p).length;
  console.log(`\nPubliee sur le site du commerce : ${n(x => x.publiee === 'confirmee')}`);
  console.log(`Absente du site                : ${n(x => x.publiee === 'absente du site')}`);
  console.log(`Site injoignable ou absent     : ${n(x => x.publiee !== 'confirmee' && x.publiee !== 'absente du site')}`);
  console.log(`\nAlignement du domaine :`);
  for (const a of ['meme domaine', 'sous-domaine', 'boite grand public', 'domaine different', '']) {
    const c = n(x => x.alignement === a);
    if (c) console.log(`  ${a || 'sans site'} : ${c}`);
  }
})();
