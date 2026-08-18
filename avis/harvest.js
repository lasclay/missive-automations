// Collecte paginée et rythmée des fils Missive, pour l'audit des avis positifs.
// Reprend là où il s'est arrêté : chaque fil traité est écrit en JSONL.
const fs = require("fs");
const URL = process.env.MISSIVE_PROXY_URL, SEC = process.env.MISSIVE_PROXY_SECRET;
const DIR = __dirname;
const OUT = `${DIR}/threads.jsonl`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 300 requêtes / 15 min côté Missive, ~2 appels amont par fil => 10 fils/min au plus.
const PACE_MS = 6200;

function loadDone() {
  const s = new Set();
  if (!fs.existsSync(OUT)) return s;
  for (const l of fs.readFileSync(OUT, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { s.add(JSON.parse(l).id); } catch {}
  }
  return s;
}

(async () => {
  const univers = [];
  for (const f of ["univ_inbox.json", "univ_closed.json"]) {
    const p = `${DIR}/${f}`;
    if (!fs.existsSync(p) || !fs.statSync(p).size) continue;
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      for (const c of j.conversations || []) univers.push(c);
    } catch {}
  }
  const vus = new Set(), liste = [];
  for (const c of univers) if (!vus.has(c.id)) { vus.add(c.id); liste.push(c); }
  liste.sort((a, b) => (b.last_activity_at || 0) - (a.last_activity_at || 0));

  // Les fils deja etiquetes passent devant : c'est sur eux que porte la passe de retrait,
  // et certains sont fermes, donc absents de l'univers de la boite.
  const pEtiq = `${DIR}/labelled.json`;
  if (fs.existsSync(pEtiq)) {
    const prio = JSON.parse(fs.readFileSync(pEtiq, "utf8")).conversations || [];
    const idsPrio = new Set(prio.map((c) => c.id));
    liste.splice(0, liste.length, ...prio, ...liste.filter((c) => !idsPrio.has(c.id)));
    console.log(`${prio.length} fils etiquetes places en tete.`);
  }

  const done = loadDone();
  const reste = liste.filter((c) => !done.has(c.id));
  console.log(`${liste.length} fils au total, ${done.size} déjà collectés, ${reste.length} à faire.`);

  const flux = fs.createWriteStream(OUT, { flags: "a" });
  let n = 0, pause = 0;
  for (const c of reste) {
    let msgs = null;
    for (let essai = 1; essai <= 4 && !msgs; essai++) {
      try {
        const r = await fetch(`${URL}/conversation`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Proxy-Secret": SEC },
          body: JSON.stringify({ id: c.id, limit: 10 }),
        });
        const t = await r.text();
        if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 120)}`);
        msgs = JSON.parse(t).messages || [];
      } catch (e) {
        pause++;
        const attente = /429|Too many/i.test(e.message) ? 310000 : 20000 * essai;
        console.error(`[${c.id.slice(0, 8)}] ${e.message} — pause ${Math.round(attente / 1000)} s`);
        await sleep(attente);
      }
    }
    if (!msgs) { flux.write(JSON.stringify({ id: c.id, subject: c.subject, echec: true }) + "\n"); continue; }
    flux.write(JSON.stringify({
      id: c.id,
      subject: c.subject,
      last: c.last_activity_at,
      msgs: msgs.map((m) => ({
        us: !!m.us, from: m.from, adr: m.address, date: m.date,
        txt: (m.text || "").slice(0, 2000),
      })),
    }) + "\n");
    n++;
    if (n % 50 === 0) console.log(`${n}/${reste.length} — ${new Date().toISOString().slice(11, 19)} (${pause} pauses)`);
    await sleep(PACE_MS);
  }
  flux.end();
  console.log(`Terminé : ${n} fils collectés.`);
})();
