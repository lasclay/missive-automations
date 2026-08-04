#!/usr/bin/env node
// Enrichit candidats.json avec les coordonnees trouvees sur les sites des boutiques.
// Usage: node scrape_contacts.js [concurrence]

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, process.argv[2] || 'candidats.json');
const OUT = path.join(__dirname, process.argv[3] || 'candidats_enrichis.json');
const CONC = parseInt(process.argv[4] || '12', 10);

const PATHS = ['', '/pages/contact', '/contact', '/contact-us', '/nous-joindre'];

const BAD_MAIL = /(sentry|wixpress|example\.|\.png|\.jpg|\.gif|\.svg|godaddy|shopify\.com|squarespace|sentry\.io|domain\.com|yourdomain|email@|name@)/i;
const POSTAL = /\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/;

function fetchUrl(url) {
  return new Promise((resolve) => {
    const { execFile } = require('child_process');
    execFile('curl', ['-sSL', '--max-time', '12', '--connect-timeout', '6', '--compressed',
      '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      url], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      // certaines pages font plusieurs megaoctets: passer les regex dessus
      // bloque le processus pendant des minutes. Les coordonnees sont dans
      // l'entete ou le pied de page, donc les premiers 400 ko suffisent.
      resolve(err ? '' : (stdout || '').slice(0, 400000));
    });
  });
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ');
}

function findEmails(html) {
  const out = new Set();
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let m;
  while ((m = re.exec(html))) {
    const e = m[0].replace(/\.$/, '');
    if (!BAD_MAIL.test(e) && e.length < 60) out.add(e.toLowerCase());
  }
  return [...out];
}

function findPhones(text) {
  const out = new Set();
  const re = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
  let m;
  while ((m = re.exec(text))) {
    const p = `${m[1]}-${m[2]}-${m[3]}`;
    // rejette les faux positifs evidents (dates, prix)
    if (!/^0/.test(m[1])) out.add(p);
  }
  return [...out];
}

function findAddress(text) {
  const idx = text.search(POSTAL);
  if (idx === -1) return { adresse: '', cp: '' };
  const cp = text.match(POSTAL)[0];
  const before = text.slice(Math.max(0, idx - 120), idx).trim();
  // garde la derniere portion qui ressemble a une adresse civique
  const m = before.match(/(\d{1,6}[A-Za-z]?[ ,-][^|;]{4,90})$/);
  return { adresse: (m ? m[1] : before).replace(/\s+/g, ' ').trim(), cp };
}

function jsonLd(html) {
  const res = { tel: '', adresse: '', cp: '', ville: '', courriel: '' };
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const stack = [data];
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== 'object') continue;
      if (Array.isArray(n)) { stack.push(...n); continue; }
      if (n.telephone && !res.tel) res.tel = String(n.telephone);
      if (n.email && !res.courriel) res.courriel = String(n.email).replace(/^mailto:/, '');
      const a = n.address;
      if (a && typeof a === 'object' && !res.adresse) {
        res.adresse = [a.streetAddress].filter(Boolean).join(' ');
        res.ville = a.addressLocality || '';
        res.cp = a.postalCode || '';
      }
      for (const k of Object.keys(n)) if (n[k] && typeof n[k] === 'object') stack.push(n[k]);
    }
  }
  return res;
}

async function enrich(c) {
  if (!c.web || !/^https?:/.test(c.web)) return c;
  if (c.tel && c.courriel && c.adresse) return c;
  const base = c.web.replace(/\/$/, '');
  const found = { emails: [], phones: [], adresse: '', cp: '' };
  for (const p of PATHS) {
    const html = await fetchUrl(base + p);
    // si la page d'accueil ne repond pas, le domaine est mort: inutile d'essayer
    // les autres chemins pendant douze secondes chacun
    if (!html || html.length < 200) {
      if (p === '') return { ...c, _mort: true };
      continue;
    }
    const ld = jsonLd(html);
    if (ld.tel) found.phones.unshift(ld.tel.replace(/[^\d]/g, '').replace(/^1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'));
    if (ld.courriel) found.emails.unshift(ld.courriel);
    if (ld.adresse && !found.adresse) { found.adresse = ld.adresse; found.cp = ld.cp || found.cp; }
    const text = stripTags(html);
    found.emails.push(...findEmails(html));
    found.phones.push(...findPhones(text));
    if (!found.adresse) {
      const a = findAddress(text);
      if (a.adresse) { found.adresse = a.adresse; found.cp = a.cp; }
    }
    if (found.emails.length && found.phones.length && found.adresse) break;
  }
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  const out = { ...c };
  if (!out.courriel && uniq(found.emails).length) out.courriel = uniq(found.emails)[0];
  if (!out.tel && uniq(found.phones).length) out.tel = uniq(found.phones)[0];
  if (!out.adresse && found.adresse) out.adresse = found.adresse;
  if (!out.cp && found.cp) out.cp = found.cp;
  out._scrape = { emails: uniq(found.emails).slice(0, 3), phones: uniq(found.phones).slice(0, 3) };
  return out;
}

(async () => {
  const list = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const results = new Array(list.length);
  let i = 0, done = 0;
  async function worker() {
    while (i < list.length) {
      const k = i++;
      try { results[k] = await enrich(list[k]); }
      catch (e) { results[k] = list[k]; }
      done++;
      if (done % 10 === 0) process.stderr.write(`${done}/${list.length}\n`);
    }
  }
  const sauve = setInterval(() => {
    fs.writeFileSync(OUT, JSON.stringify(results.filter(Boolean), null, 1));
  }, 30000);
  await Promise.all(Array.from({ length: CONC }, worker));
  clearInterval(sauve);
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  const withTel = results.filter(r => r.tel).length;
  const withMail = results.filter(r => r.courriel).length;
  const withAddr = results.filter(r => r.adresse).length;
  console.log(`Total ${results.length} | tel ${withTel} | courriel ${withMail} | adresse ${withAddr}`);
})();
