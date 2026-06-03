/**
 * Missive — Auto-flag des doublons par expéditeur
 * --------------------------------------------------
 * À chaque courriel entrant, Missive appelle ce serveur (règle Webhook).
 * Le serveur regarde combien de conversations OUVERTES existent pour le
 * même expéditeur. S'il y en a >= 2, il applique le label "À fusionner"
 * sur toutes; sinon il le retire. Tu n'as plus qu'à ouvrir la vue du label
 * et merger une liste courte.
 *
 * Aucune dépendance externe. Node 18+ (fetch global).
 *   node missive-auto-flag.js
 *
 * Variables d'environnement requises :
 *   MISSIVE_TOKEN          ton token API (Preferences > API), commence par missive_pat-
 *   MISSIVE_LABEL_ID       l'ID du label d'ORGANISATION "À fusionner"
 *   MISSIVE_WEBHOOK_SECRET (optionnel) le secret de validation de la règle webhook
 *   PORT                   (optionnel) défaut 3000
 */

const http = require("node:http");
const crypto = require("node:crypto");

const TOKEN  = process.env.MISSIVE_TOKEN;
const LABEL  = process.env.MISSIVE_LABEL_ID;
const SECRET = process.env.MISSIVE_WEBHOOK_SECRET || "";
const PORT   = process.env.PORT || 3000;
const API    = "https://public.missiveapp.com/v1";

if (!TOKEN || !LABEL) {
  console.error("Manque MISSIVE_TOKEN ou MISSIVE_LABEL_ID dans l'environnement.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// --- Vérifie la signature HMAC (si un secret est configuré sur la règle) ---
function signatureOk(rawBody, headerValue) {
  if (!SECRET) return true; // pas de secret => pas de vérification
  if (!headerValue) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Extrait l'adresse de l'expéditeur du payload webhook ---
// NOTE : confirme ce chemin en regardant ton premier vrai payload (voir console.log
// plus bas). Selon le type de règle, l'expéditeur peut se trouver à un endroit
// légèrement différent; on essaie les emplacements les plus probables.
function senderEmail(payload) {
  return (
    payload?.message?.from_field?.address ||
    payload?.conversation?.latest_message?.from_field?.address ||
    payload?.comment?.author?.email ||
    null
  );
}

// --- Une conversation est-elle "ouverte" (à traiter) ? ---
// À ajuster selon ce que retourne réellement l'API pour ton org. On exclut
// d'emblée la corbeille. Beaucoup d'orgs considèrent "ouvert" = pas fermé.
function isOpen(conv) {
  if (conv.trashed_at) return false;
  // Si ton API expose un drapeau de fermeture, décommente et adapte :
  // if (conv.closed) return false;
  return true;
}

// --- Liste les conversations d'un expéditeur (filtre `email`) ---
async function conversationsFromSender(email) {
  const url = `${API}/conversations?email=${encodeURIComponent(email)}&limit=50`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error("List conversations a échoué :", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return (data.conversations || []).filter(isOpen);
}

// --- Applique ou retire le label sur une conversation ---
async function setLabel(conversationId, add, count) {
  const post = {
    conversation: conversationId,
    text: add
      ? `⚠️ Ce contact a ${count} fils ouverts — à fusionner.`
      : `✅ Plus qu'un fil ouvert pour ce contact.`,
    notification: {
      title: "Doublons",
      body: add ? `${count} fils ouverts du même expéditeur` : "Doublons résolus",
    },
  };
  if (add) post.add_shared_labels = [LABEL];
  else post.remove_shared_labels = [LABEL];

  const res = await fetch(`${API}/posts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ posts: post }),
  });
  if (!res.ok) {
    console.error("Post a échoué :", res.status, await res.text());
  }
}

// --- Traitement principal (asynchrone, après avoir répondu 200) ---
async function process(payload) {
  const email = senderEmail(payload);
  if (!email) {
    console.warn("Pas d'expéditeur trouvé. Payload reçu :", JSON.stringify(payload));
    return;
  }

  const open = await conversationsFromSender(email);
  const ids = open.map((c) => c.id);
  const duplicate = ids.length >= 2;

  console.log(`${email} → ${ids.length} fils ouverts ${duplicate ? "(DOUBLON)" : ""}`);

  // On (dé)marque tous les fils ouverts de ce contact, en série pour rester
  // doux avec l'API. Réappliquer un label déjà présent est sans effet.
  for (const id of ids) {
    await setLabel(id, duplicate, ids.length);
  }
}

// --- Serveur HTTP ---
const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end("Method Not Allowed");
  }

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    // 1) Validation de signature
    if (!signatureOk(raw, req.headers["x-hook-signature"])) {
      res.writeHead(401);
      return res.end("Bad signature");
    }

    // 2) Répond TOUT DE SUITE (limite de 15 s côté Missive)
    res.writeHead(200);
    res.end("ok");

    // 3) Traite ensuite, sans bloquer la réponse
    let payload;
    try {
      payload = JSON.parse(raw || "{}");
    } catch (e) {
      return console.error("JSON invalide :", e.message);
    }
    // Astuce 1er lancement : décommente pour voir la vraie structure du payload
    // console.log(JSON.stringify(payload, null, 2));
    process(payload).catch((e) => console.error("Erreur de traitement :", e));
  });
});

server.listen(PORT, () => console.log(`En écoute sur le port ${PORT}`));
