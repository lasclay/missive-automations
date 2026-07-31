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

/** Vérifie une permission. Un utilisateur absent ou inactif n'a rien. */
function peut(userId, domaine) {
  if (!userId) return !reglage("exiger_utilisateur", false);   // mono-utilisateur par défaut
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
 * Émet un événement. Comme ShipStation, on n'envoie pas la donnée : on envoie une URL de
 * ressource que l'abonné rappellera. Ça évite de diffuser des données personnelles vers un
 * point de terminaison qui n'est peut-être plus le bon.
 */
async function emettre(event, { resourceUrl, storeId = null } = {}) {
  const cibles = all("SELECT * FROM webhooks WHERE event = ? AND active = 1 AND (store_id IS NULL OR store_id = ?)",
    event, storeId);
  const resultats = [];
  for (const c of cibles) {
    try {
      const res = await fetch(c.target_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_url: resourceUrl, resource_type: event }),
        signal: AbortSignal.timeout(10000),
      });
      resultats.push({ id: c.id, status: res.status });
    } catch (e) {
      resultats.push({ id: c.id, erreur: String(e.message) });
    }
  }
  if (resultats.length) journaliser("webhook.emit", "webhook", null, { event, resultats });
  return resultats;
}

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
  EVENEMENTS, abonner, abonnements, desabonner, emettre,
  filerNotification, notificationsEnAttente, marquerEnvoyee, MARQUE_DEFAUT,
};
