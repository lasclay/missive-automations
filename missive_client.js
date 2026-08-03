/**
 * Client du missive-proxy — utilisé par Claude DANS l'environnement Claude Code
 * (pas déployé). Lit l'URL et le secret depuis l'environnement, jamais en dur :
 *   MISSIVE_PROXY_URL   ex. https://missive-proxy.onrender.com
 *   MISSIVE_PROXY_SECRET  le même secret que le service Proxy Missive (repli PROXY_SECRET)
 *
 * Usage :
 *   node missive_client.js health
 *   node missive_client.js structure   (carte : organisations, équipes, étiquettes, membres)
 *                                      → à mettre en cache : > missive_structure.json
 *   node missive_client.js list "shared_label=ID"
 *   node missive_client.js read <convId>
 *   node missive_client.js drafts <convId>   (brouillons déjà rédigés par le script IA)
 *   node missive_client.js draftsraw <convId> (idem, réponse brute — le corps du brouillon
 *                                              n'est pas renvoyé par la vue résumée)
 *   node missive_client.js notes <convId>    (notes internes / commentaires)
 *   node missive_client.js users                     (membres de l'org: id, nom, courriel)
 *   node missive_client.js task <convId>             (lit un JSON {title,assignees[],label} sur stdin)
 *   node missive_client.js note <convId> "texte markdown"
 *   node missive_client.js close <convId> "note optionnelle"
 *   node missive_client.js reply <convId>   (lit un JSON de brouillon sur stdin)
 */

const URL = process.env.MISSIVE_PROXY_URL || "https://proxy-missive.onrender.com";
const SECRET = process.env.MISSIVE_PROXY_SECRET || process.env.PROXY_SECRET;

async function call(route, body, method = "POST") {
  if (!URL) throw new Error("MISSIVE_PROXY_URL absent de l'environnement.");
  const opts = { method, headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET || "" } };
  if (method === "POST") opts.body = JSON.stringify(body || {});
  const res = await fetch(`${URL}${route}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${route} → ${res.status} ${text.slice(0, 300)}`);
  return json;
}

function readStdin() {
  return new Promise((r) => { let d = ""; process.stdin.on("data", (c) => (d += c)); process.stdin.on("end", () => r(d)); });
}

(async () => {
  const [cmd, a1, a2] = process.argv.slice(2);
  try {
    if (cmd === "health") console.log(JSON.stringify(await call("/health", null, "GET"), null, 2));
    else if (cmd === "structure") console.log(JSON.stringify(await call("/structure", {}), null, 2));
    else if (cmd === "list") console.log(JSON.stringify(await call("/list", { filter: a1 }), null, 2));
    else if (cmd === "read") console.log(JSON.stringify(await call("/conversation", { id: a1 }), null, 2));
    else if (cmd === "drafts") console.log(JSON.stringify(await call("/drafts", { id: a1 }), null, 2));
    else if (cmd === "draftsraw") console.log(JSON.stringify(await call("/drafts", { id: a1, raw: true }), null, 2));
    else if (cmd === "notes") console.log(JSON.stringify(await call("/comments", { id: a1 }), null, 2));
    else if (cmd === "users") console.log(JSON.stringify(await call("/users", {}), null, 2));
    else if (cmd === "task") { const t = JSON.parse(await readStdin()); console.log(JSON.stringify(await call("/task", { id: a1, ...t }), null, 2)); }
    else if (cmd === "note") console.log(JSON.stringify(await call("/note", { id: a1, markdown: a2 }), null, 2));
    else if (cmd === "close") console.log(JSON.stringify(await call("/close", { id: a1, note: a2 }), null, 2));
    else if (cmd === "reply") { const draft = JSON.parse(await readStdin()); console.log(JSON.stringify(await call("/reply", { id: a1, ...draft }), null, 2)); }
    else { console.error("Commande inconnue. Voir l'en-tête du fichier."); process.exit(1); }
  } catch (e) { console.error("Erreur:", e.message); process.exit(1); }
})();
