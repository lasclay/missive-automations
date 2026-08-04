/**
 * Utilisateurs, permissions, webhooks et notifications client.
 *
 * ShipStation n'a pas de rôles nommés : chaque utilisateur porte des cases à cocher par
 * domaine. On reprend ce modèle, en ajoutant des rôles pré-remplis parce que cocher
 * quinze cases par employé est une perte de temps.
 */
const crypto = require("crypto");
const { all, one, run, parse, dump, maintenant, journaliser, reglage } = require("./db");
const templates = require("./templates");

// ================================================================ permissions

/** Domaines de permission — miroir de ceux de ShipStation, plus l'achat d'étiquette. */
const DOMAINES = {
  orders_view: "Voir les commandes",
  orders_edit: "Modifier les commandes",
  orders_delete: "Annuler des commandes",
  shipments_view: "Voir les expéditions",
  labels_buy: "Acheter des étiquettes (argent réel)",
  labels_void: "Annuler des étiquettes",
  products_view: "Voir les produits",
  products_edit: "Modifier les produits",
  returns_manage: "Gérer les retours",
  reports_view: "Voir les rapports",
  settings_edit: "Modifier les réglages",
  users_manage: "Gérer les utilisateurs",
};

/** Rôles pré-remplis. `admin` a tout, y compris ce qui sera ajouté plus tard. */
const ROLES = {
  admin: Object.fromEntries(Object.keys(DOMAINES).map((k) => [k, true])),
  expediteur: {
    orders_view: true, orders_edit: true, shipments_view: true,
    labels_buy: true, labels_void: true, products_view: true, returns_manage: true,
  },
  preparateur: { orders_view: true, shipments_view: true, products_view: true },
  comptable: { orders_view: true, shipments_view: true, reports_view: true },
};

function creerUtilisateur({ name, email, role = "preparateur", permissions = null }) {
  const id = crypto.randomUUID();
  const perms = permissions || ROLES[role] || {};
  run("INSERT INTO users (id,name,email,active,permissions,created_at) VALUES (?,?,?,1,?,?)",
    id, name, email || null, dump({ role, ...perms }), maintenant());
  journaliser("user.create", "user", id, { name, role });
  return id;
}

const utilisateurs = () => all("SELECT * FROM users ORDER BY name")
  .map((u) => ({ ...u, active: !!u.active, permissions: parse(u.permissions, {}) }));

const utilisateur = (id) => {
  const u = one("SELECT * FROM users WHERE id = ?", id);
  return u && { ...u, active: !!u.active, permissions: parse(u.permissions, {}) };
};

function majUtilisateur(id, { name, email, active, role, permissions }) {
  const u = utilisateur(id);
  if (!u) throw new Error("utilisateur inconnu");
  const perms = permissions || (role ? { role, ...(ROLES[role] || {}) } : u.permissions);
  run("UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), active=COALESCE(?,active), permissions=? WHERE id=?",
    name ?? null, email ?? null, active === undefined ? null : (active ? 1 : 0), dump(perms), id);
  journaliser("user.update", "user", id, { role });
}

/**
 * Vérifie une permission. **Refus par défaut** : pas de session, pas de droit.
 *
 * C'était l'inverse quand l'outil était local et mono-utilisateur. Sur un service partagé,
 * une valeur par défaut permissive est un trou : une requête sans session prendrait les
 * pleins pouvoirs. L'exception unique est un compte sans aucun utilisateur en base, le
 * temps de l'amorçage du premier administrateur.
 */
function peut(userId, domaine) {
  if (!userId) return !one("SELECT COUNT(*) n FROM users WHERE password_hash IS NOT NULL").n;
  const u = utilisateur(userId);
  if (!u || !u.active) return false;
  return u.permissions[domaine] === true;
}

/** Lance une erreur si la permission manque — à appeler en tête des routes sensibles. */
function exiger(userId, domaine) {
  if (!peut(userId, domaine)) {
    const e = new Error(`permission requise : ${DOMAINES[domaine] || domaine}`);
    e.code = 403;
    throw e;
  }
}

// ================================================================== webhooks

const EVENEMENTS = ["ORDER_NOTIFY", "ITEM_ORDER_NOTIFY", "SHIP_NOTIFY", "ITEM_SHIP_NOTIFY",
  "FULFILLMENT_SHIPPED", "FULFILLMENT_REJECTED", "RETURN_CREATED", "BATCH_DONE"];

function abonner({ event, target_url, store_id = null, friendly_name = null }) {
  if (!EVENEMENTS.includes(event)) throw new Error(`événement inconnu : ${event}`);
  if (!/^https:\/\//.test(target_url)) throw new Error("target_url doit être en https");
  run("INSERT INTO webhooks (event,target_url,store_id,friendly_name,active,created_at) VALUES (?,?,?,?,1,?)",
    event, target_url, store_id, friendly_name, maintenant());
  const id = one("SELECT last_insert_rowid() r").r;
  journaliser("webhook.subscribe", "webhook", id, { event, target_url });
  return id;
}

const abonnements = () => all("SELECT * FROM webhooks ORDER BY id").map((w) => ({ ...w, active: !!w.active }));
const desabonner = (id) => run("DELETE FROM webhooks WHERE id = ?", id);

/**
 * Émission d'un événement — exigences G1, G2, G3 de l'audit.
 *
 * Le clone reproduisait le webhook « mince » de ShipStation : une simple `resource_url` que
 * l'abonné devait rappeler. La spécification listait précisément ce comportement comme le
 * **défaut G1 à corriger**, pas comme un modèle — le rappel consomme le quota de l'appelant
 * et double les allers-retours. Trois corrections :
 *
 *   • **charge utile complète**, avec `resource_url` en complément et non à la place ;
 *   • **signature HMAC-SHA256** sur `horodatage.corps`, avec un secret par abonnement, et
 *     un horodatage qui rend le rejeu détectable (G2) ;
 *   • **journal de livraison et redélivrance** avec temporisation croissante (G3).
 */
/** Fenêtre d'acceptation d'un horodatage, côté récepteur. Cinq minutes, comme Stripe. */
const FENETRE_REJEU_S = 300;

/** Temporisation de redélivrance : 1 min, 5, 30, 2 h, 6 h, puis abandon. */
const PALIERS_RETRY_MIN = [1, 5, 30, 120, 360];

function secretDe(webhookId) {
  const w = one("SELECT secret FROM webhooks WHERE id = ?", webhookId);
  if (w && w.secret) return w.secret;
  const s = crypto.randomBytes(32).toString("base64url");
  run("UPDATE webhooks SET secret = ? WHERE id = ?", s, webhookId);
  return s;
}

/** Signature d'une charge utile : `t=<epoch>,v1=<hmac hex>` sur `<epoch>.<corps>`. */
function signer(secret, corps, horodatage = Math.floor(Date.now() / 1000)) {
  const hmac = crypto.createHmac("sha256", secret).update(`${horodatage}.${corps}`).digest("hex");
  return { entete: `t=${horodatage},v1=${hmac}`, horodatage, hmac };
}

/**
 * Vérifie une signature reçue. Comparaison à temps constant — un `===` sur un HMAC laisse
 * fuir sa valeur par le temps de réponse.
 */
function verifierSignature(secret, corps, entete) {
  const m = /t=(\d+),v1=([a-f0-9]+)/.exec(String(entete || ""));
  if (!m) return { ok: false, motif: "en-tête de signature absent ou mal formé" };
  const [, t, recu] = m;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (age > FENETRE_REJEU_S) return { ok: false, motif: `horodatage périmé (${age} s)` };
  const attendu = signer(secret, corps, Number(t)).hmac;
  const a = Buffer.from(attendu, "hex"), b = Buffer.from(recu, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return { ok: false, motif: "signature invalide" };
  return { ok: true };
}

async function livrer(cible, evenement) {
  const corps = JSON.stringify(evenement);
  const secret = secretDe(cible.id);
  const { entete } = signer(secret, corps);
  const t0 = Date.now();
  try {
    const res = await fetch(cible.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lasclay-Signature": entete,
        "X-Lasclay-Event": evenement.event,
        "X-Lasclay-Event-Id": evenement.event_id,
        "X-Lasclay-Delivery-Attempt": String(evenement.__tentative || 1),
      },
      body: corps,
      signal: AbortSignal.timeout(10000),
    });
    const texte = (await res.text().catch(() => "")).slice(0, 500);
    return { statut: res.status, reussi: res.ok, reponse: texte, ms: Date.now() - t0 };
  } catch (e) {
    return { statut: null, reussi: false, erreur: String(e.message), ms: Date.now() - t0 };
  }
}

function tracer(cible, evenement, r, tentative) {
  const prochaine = r.reussi || tentative > PALIERS_RETRY_MIN.length ? null
    : new Date(Date.now() + PALIERS_RETRY_MIN[tentative - 1] * 60000).toISOString();
  run(`INSERT INTO webhook_livraisons
       (webhook_id,event_id,event,payload,tentative,statut_http,reponse,erreur,reussi,cree_le,prochaine_tentative)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    cible.id, evenement.event_id, evenement.event, JSON.stringify(evenement), tentative,
    r.statut ?? null, r.reponse ?? null, r.erreur ?? null, r.reussi ? 1 : 0,
    maintenant(), prochaine);
  return prochaine;
}

async function emettre(event, { resourceUrl = null, storeId = null, donnees = null } = {}) {
  const cibles = all("SELECT * FROM webhooks WHERE event = ? AND active = 1 AND (store_id IS NULL OR store_id = ?)",
    event, storeId);
  const resultats = [];
  for (const c of cibles) {
    const evenement = {
      event_id: crypto.randomUUID(),
      event,
      cree_le: new Date().toISOString(),
      // La charge utile complète — c'est tout l'objet de la correction G1. `resource_url`
      // reste fourni pour qui préfère relire la source, mais il n'est plus obligatoire.
      donnees: donnees ?? null,
      resource_url: resourceUrl,
    };
    const r = await livrer(c, { ...evenement, __tentative: 1 });
    tracer(c, evenement, r, 1);
    resultats.push({ id: c.id, event_id: evenement.event_id, statut: r.statut, reussi: r.reussi, erreur: r.erreur });
  }
  if (resultats.length) journaliser("webhook.emit", "webhook", null, { event, resultats });
  return resultats;
}

/**
 * Rejoue les livraisons échouées dont l'heure de reprise est passée. Appelé par la boucle
 * périodique du serveur, et disponible à la main depuis l'écran des webhooks.
 */
async function redelivrer({ limite = 50 } = {}) {
  const attente = all(`SELECT l.*, w.target_url, w.active FROM webhook_livraisons l
                       JOIN webhooks w ON w.id = l.webhook_id
                       WHERE l.reussi = 0 AND l.prochaine_tentative IS NOT NULL
                         AND l.prochaine_tentative <= ? AND w.active = 1
                       ORDER BY l.prochaine_tentative LIMIT ?`, maintenant(), limite);
  const faits = [];
  for (const l of attente) {
    // Une tentative plus récente a-t-elle déjà réussi pour cet événement ?
    const dejaOk = one("SELECT 1 x FROM webhook_livraisons WHERE event_id = ? AND reussi = 1", l.event_id);
    if (dejaOk) { run("UPDATE webhook_livraisons SET prochaine_tentative = NULL WHERE id = ?", l.id); continue; }
    const evenement = JSON.parse(l.payload);
    const tentative = l.tentative + 1;
    const r = await livrer({ id: l.webhook_id, target_url: l.target_url }, { ...evenement, __tentative: tentative });
    run("UPDATE webhook_livraisons SET prochaine_tentative = NULL WHERE id = ?", l.id);
    tracer({ id: l.webhook_id }, evenement, r, tentative);
    faits.push({ event_id: l.event_id, tentative, reussi: r.reussi });
  }
  return faits;
}

/** Journal de livraison d'un abonnement — ce que ShipStation n'expose nulle part. */
const livraisons = ({ webhook_id = null, limite = 100 } = {}) => all(
  `SELECT id, webhook_id, event_id, event, tentative, statut_http, erreur, reussi, cree_le, prochaine_tentative
   FROM webhook_livraisons ${webhook_id ? "WHERE webhook_id = ?" : ""}
   ORDER BY id DESC LIMIT ?`, ...(webhook_id ? [webhook_id, limite] : [limite]));

// ============================================================== notifications

/**
 * Met un courriel client en file. L'envoi réel dépend d'un service SMTP non branché : on
 * enregistre systématiquement, et `envoyerEnAttente` fera le reste quand il le sera. Rien
 * ne part sans que ce soit tracé.
 */
function filerNotification({ kind, order, shipment = null, storeId = null }) {
  const gabarit = templates.defaut("email", storeId);
  if (!gabarit) return null;
  const ctx = {
    order, shipment: shipment || {}, items: order.items || [],
    marque: reglage("marque", { nom: "Lasclay", courriel: "info@lasclay.com" }),
  };
  const sujet = templates.rendre(gabarit.subject || "Votre commande {{ order.order_number }}", ctx);
  const corps = templates.rendre(gabarit.body, ctx);
  const destinataire = order.customer_email || (order.ship_to || {}).email;
  if (!destinataire) return null;
  run(`INSERT INTO notifications (kind, order_id, shipment_id, recipient, subject, body, status)
       VALUES (?,?,?,?,?,?,'queued')`,
    kind, order.id, shipment ? shipment.id : null, destinataire, sujet, corps);
  return one("SELECT last_insert_rowid() r").r;
}

const notificationsEnAttente = () => all("SELECT * FROM notifications WHERE status = 'queued' ORDER BY id LIMIT 200");

/**
 * Marque une notification envoyée. L'appelant fournit le transport ; tant qu'il n'y en a
 * pas, la file grossit visiblement plutôt que d'échouer en silence.
 */
function marquerEnvoyee(id, { ok = true, erreur = null } = {}) {
  run("UPDATE notifications SET status = ?, sent_at = ?, error = ? WHERE id = ?",
    ok ? "sent" : "error", maintenant(), erreur, id);
}

// ================================================================== réglages

const MARQUE_DEFAUT = {
  nom: "Lasclay", courriel: "info@lasclay.com",
  adresse: "254 Boulevard des Capucins, Québec, QC G1J 3R4",
  logo: null, couleur: "#0b7a4b",
  message_bordereau: "Merci de soutenir une entreprise québécoise.",
};

module.exports = {
  DOMAINES, ROLES, creerUtilisateur, utilisateurs, utilisateur, majUtilisateur, peut, exiger,
  EVENEMENTS, abonner, abonnements, desabonner, emettre, redelivrer, livraisons,
  signer, verifierSignature, secretDe,
  filerNotification, notificationsEnAttente, marquerEnvoyee, MARQUE_DEFAUT,
};
