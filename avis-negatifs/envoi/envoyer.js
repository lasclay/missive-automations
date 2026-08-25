// Envoie la vague de reparation des avis negatifs, un message a la fois.
// Chaque envoi ouvre un fil neuf dans Missive (route /send du proxy).
// Journalise dans envoi/journal.json : rien ne se renvoie deux fois.
const fs = require("fs");
const { execFileSync } = require("child_process");

const DIR = __dirname;
const messages = JSON.parse(fs.readFileSync(`${DIR}/messages.json`, "utf8"));
const JOURNAL = `${DIR}/journal.json`;
const deja = fs.existsSync(JOURNAL) ? JSON.parse(fs.readFileSync(JOURNAL, "utf8")) : {};

const FROM = "admin@lasclay.com";
const ENVOYER = process.argv.includes("--envoyer"); // sans ce drapeau : brouillons

for (const m of messages) {
  if (deja[m.cle]?.ok) { console.log(`= ${m.cle} deja fait`); continue; }
  const payload = JSON.stringify({
    from: FROM, to: [m.to], subject: m.subject, body: m.body, send: ENVOYER,
  });
  try {
    const out = execFileSync("node", ["missive_client.js", "send"], {
      cwd: `${DIR}/../..`, input: payload, encoding: "utf8",
    });
    const r = JSON.parse(out);
    deja[m.cle] = { ok: !!r.ok, envoye: !!r.sent, to: m.to, draft: r.draft, conversation: r.conversation };
    console.log(`${r.ok ? "OK" : "??"} ${m.cle.padEnd(14)} ${m.to.padEnd(34)} conv=${r.conversation}`);
  } catch (e) {
    deja[m.cle] = { ok: false, erreur: String(e.stderr || e.message).slice(0, 300) };
    console.log(`ECHEC ${m.cle} : ${deja[m.cle].erreur}`);
  }
  fs.writeFileSync(JOURNAL, JSON.stringify(deja, null, 2));
}
