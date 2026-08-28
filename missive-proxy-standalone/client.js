#!/usr/bin/env node
/**
 * client.js — client en ligne de commande du missive-proxy.
 *
 * S'exécute SUR TA MACHINE (ou dans ta session d'assistant), pas sur le serveur.
 * Il ne connaît pas le jeton Missive : seulement l'URL du proxy et son secret,
 * lus dans l'environnement, jamais en dur.
 *
 *   MISSIVE_PROXY_URL     ex. https://mon-missive-proxy.onrender.com   [requis]
 *   MISSIVE_PROXY_SECRET  le même secret que celui posé sur le serveur [requis]
 *                         (repli accepté : PROXY_SECRET)
 *
 * Usage :
 *   node client.js health
 *   node client.js structure   (carte : organisations, équipes, étiquettes, membres)
 *                              → à mettre en cache : > missive_structure.json
 *   node client.js list "shared_label=ID"
 *   node client.js read <convId> [nbMessages]   (défaut 10, max 200 ; le champ
 *                                       `tronque` signale qu'il reste des messages avant)
 *   node client.js attachment <messageId> [attachmentId|-] [fichierSortie]
 *                              (télécharge UNE pièce jointe et l'ÉCRIT SUR DISQUE ;
 *                               le base64 ne passe jamais par le terminal. Les
 *                               `messageId` et `attachmentId` viennent du champ
 *                               `attachments[]` renvoyé par `read`. Sans attachmentId,
 *                               prend la première. Sans fichier de sortie, garde le
 *                               nom d'origine dans le répertoire courant.)
 *   node client.js messageraw <messageId>   (enveloppe brute d'un message : from_field,
 *                                       to_fields, compte de canal. Pour savoir comment
 *                                       répondre sur un canal non courriel.)
 *   node client.js drafts <convId> [limit]   (brouillons du fil ; limit pagine au-delà
 *                                       des 10 de l'API Missive, max 500)
 *   node client.js draftsraw <convId> [limit] (idem, réponse brute)
 *   node client.js notes <convId>      (notes internes / commentaires)
 *   node client.js users               (membres de l'org : id, nom, courriel)
 *   node client.js task <convId> [--raw]  (lit un JSON {title,assignees[],label} sur stdin)
 *   node client.js postraw <postId>    (post brut ; voir l'avertissement du README)
 *   node client.js taskstate <taskId> <todo|in_progress|closed> [convId]
 *   node client.js note <convId> "texte markdown"
 *   node client.js close <convId> "note optionnelle"
 *   node client.js labels <convId>     (JSON {add:[],remove:[],markdown,keepClosed} sur stdin ;
 *                                       keepClosed:true sur un fil déjà fermé, sinon il rouvre)
 *   node client.js reply <convId>      (lit un JSON de brouillon sur stdin)
 *   node client.js books               (carnets d'adresses : id, nom)
 *   node client.js contacts "terme" [limit]
 *   node client.js send                (courriel NEUF, hors de tout fil existant.
 *                                       Lit sur stdin un JSON
 *                                       {from, to[], cc[], bcc[], subject, body, send}.
 *                                       Sans "send": true, ça crée un BROUILLON dans
 *                                       Missive et un humain appuie sur envoyer.
 *                                       Maximum 5 destinataires.)
 */

const URL = process.env.MISSIVE_PROXY_URL;
const SECRET = process.env.MISSIVE_PROXY_SECRET || process.env.PROXY_SECRET;

async function call(route, body, method = "POST") {
  if (!URL) throw new Error("MISSIVE_PROXY_URL absent de l'environnement.");
  if (!SECRET) throw new Error("MISSIVE_PROXY_SECRET absent de l'environnement.");
  const opts = { method, headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET } };
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
const show = (o) => console.log(JSON.stringify(o, null, 2));

(async () => {
  const [cmd, a1, a2, a3] = process.argv.slice(2);
  try {
    if (cmd === "health") show(await call("/health", null, "GET"));
    else if (cmd === "structure") show(await call("/structure", {}));
    else if (cmd === "list") show(await call("/list", { filter: a1 }));
    else if (cmd === "read") show(await call("/conversation", { id: a1, limit: a2 }));
    else if (cmd === "attachment") {
      // Le base64 d'un chiffrier ou d'un PDF n'a aucune valeur à l'écran : on écrit le fichier
      // et on ne montre que ce qui permet de le retrouver.
      const r = await call("/attachment", { messageId: a1, attachmentId: a2 && a2 !== "-" ? a2 : undefined });
      const dest = a3 || r.filename || `${r.id}.bin`;
      require("node:fs").writeFileSync(dest, Buffer.from(r.base64, "base64"));
      show({ saved: dest, filename: r.filename, media_type: r.media_type, size: r.size });
    }
    else if (cmd === "messageraw") show(await call("/messageraw", { messageId: a1 }));
    else if (cmd === "drafts") show(await call("/drafts", { id: a1, limit: a2 ? Number(a2) : undefined }));
    else if (cmd === "draftsraw") show(await call("/drafts", { id: a1, raw: true, limit: a2 ? Number(a2) : undefined }));
    else if (cmd === "notes") show(await call("/comments", { id: a1 }));
    else if (cmd === "users") show(await call("/users", {}));
    else if (cmd === "task") { const t = JSON.parse(await readStdin()); show(await call("/task", { id: a1, ...t, raw: a2 === "--raw" || undefined })); }
    else if (cmd === "postraw") show(await call("/postraw", { id: a1 }));
    else if (cmd === "taskstate") show(await call("/task-state", { taskId: a1, state: a2, conversation: a3 }));
    else if (cmd === "note") show(await call("/note", { id: a1, markdown: a2 }));
    else if (cmd === "close") show(await call("/close", { id: a1, note: a2 }));
    else if (cmd === "labels") { const l = JSON.parse(await readStdin()); show(await call("/labels", { id: a1, ...l })); }
    else if (cmd === "reply") { const draft = JSON.parse(await readStdin()); show(await call("/reply", { id: a1, ...draft })); }
    else if (cmd === "books") show(await call("/contact-books", {}));
    else if (cmd === "contacts") show(await call("/contacts", { search: a1, limit: a2 }));
    else if (cmd === "send") { const mail = JSON.parse(await readStdin()); show(await call("/send", mail)); }
    else { console.error("Commande inconnue. Voir l'en-tête du fichier ou le README."); process.exit(1); }
  } catch (e) { console.error("Erreur:", e.message); process.exit(1); }
})();
