// Retire l'étiquette « review à traiter » de TOUS les fils qui la portent, une fois les avis
// versés dans Judge.me. L'étiquette est une liste de choses à faire : quand c'est fait, elle
// se vide.
//
//   node avis/reset_etiquette.js            # montre ce qui serait fait, n'écrit rien
//   node avis/reset_etiquette.js --appliquer
//
// Reprend où il s'est arrêté : chaque fil traité est écrit dans reset_fait.txt.
const fs = require("fs");
const URL = process.env.MISSIVE_PROXY_URL || "https://proxy-missive.onrender.com";
const SECRET = process.env.MISSIVE_PROXY_SECRET || process.env.PROXY_SECRET;
const ETIQUETTE = "1681e586-9a75-49a6-bf90-75a2620d20a5"; // Support/review à traiter
const JOURNAL = `${__dirname}/reset_fait.txt`;
const APPLIQUER = process.argv.includes("--appliquer");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(route, body) {
  const r = await fetch(`${URL}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET || "" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${route} → ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

(async () => {
  const { conversations = [] } = await call("/list", { filter: `shared_label=${ETIQUETTE}` });
  const fait = fs.existsSync(JOURNAL)
    ? new Set(fs.readFileSync(JOURNAL, "utf8").split("\n").filter(Boolean))
    : new Set();
  const reste = conversations.filter((c) => !fait.has(c.id));
  console.log(`${conversations.length} fils portent l'étiquette, ${fait.size} déjà traités, ${reste.length} à faire.`);
  if (!APPLIQUER) {
    for (const c of reste.slice(0, 10)) console.log(`  ${c.id.slice(0, 8)}  ${(c.subject || "").slice(0, 70)}`);
    if (reste.length > 10) console.log(`  … et ${reste.length - 10} autres`);
    console.log("\nRien n'a été écrit. Relance avec --appliquer pour retirer l'étiquette.");
    return;
  }
  const flux = fs.createWriteStream(JOURNAL, { flags: "a" });
  let n = 0;
  for (const c of reste) {
    try {
      // keepClosed envoie reopen:false : un fil fermé qu'on réétiquette ne doit pas remonter
      // dans la boîte de tout le monde.
      await call("/labels", {
        id: c.id, remove: [ETIQUETTE], keepClosed: true,
        markdown: "_Avis versé dans Judge.me, étiquette retirée._",
      });
      flux.write(c.id + "\n");
      n++;
      if (n % 20 === 0) console.log(`  ${n}/${reste.length}`);
    } catch (e) {
      console.error(`  ÉCHEC ${c.id.slice(0, 8)} : ${e.message}`);
      if (/429|Too many/i.test(e.message)) { console.error("  limite atteinte, pause de 5 minutes"); await sleep(310000); }
    }
    await sleep(3500); // ~17 requêtes/minute, sous la limite Missive
  }
  flux.end();
  console.log(`Terminé : étiquette retirée de ${n} fils.`);
})();
