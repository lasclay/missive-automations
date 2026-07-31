/**
 * Gabarits — bordereaux d'emballage, courriels, messages d'étiquette.
 *
 * ShipStation édite ses gabarits en HTML avec une syntaxe à la Liquid. On reproduit le
 * sous-ensemble qui sert réellement, sans dépendance : variables, conditions, boucles,
 * filtres de formatage. Le rendu est échappé par défaut — un nom de client contenant `<`
 * ne doit pas casser un bordereau ni ouvrir une injection.
 *
 *   {{ order.order_number }}          variable
 *   {{ order.order_total | money }}   filtre
 *   {% if order.gift %}…{% endif %}   condition
 *   {% for i in items %}…{% endfor %} boucle
 */
const { all, one, run } = require("./db");

const echapper = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const FILTRES = {
  money: (v) => (Number(v) || 0).toFixed(2) + " $",
  date: (v) => (v ? String(v).slice(0, 10) : ""),
  datetime: (v) => (v ? String(v).slice(0, 16).replace("T", " ") : ""),
  upper: (v) => String(v ?? "").toUpperCase(),
  lower: (v) => String(v ?? "").toLowerCase(),
  weight: (v) => `${Math.round(Number(v) || 0)} g`,
  default: (v, d) => (v === null || v === undefined || v === "" ? d : v),
  raw: (v) => ({ __brut: String(v ?? "") }),   // sortie non échappée, à utiliser sciemment
};

/** Résout `a.b.c` dans le contexte, sans jamais lancer. */
function resoudre(chemin, ctx) {
  return String(chemin).trim().split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), ctx);
}

function evaluerExpression(expr, ctx) {
  const [base, ...filtres] = String(expr).split("|").map((s) => s.trim());
  let v = base.startsWith("'") || base.startsWith('"') ? base.slice(1, -1)
    : /^-?\d+(\.\d+)?$/.test(base) ? Number(base) : resoudre(base, ctx);
  for (const f of filtres) {
    const [nom, ...args] = f.split(":").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
    if (FILTRES[nom]) v = FILTRES[nom](v, ...args);
  }
  return v;
}

/** Vérité à la Liquid : 0 et "" sont faux, un tableau vide aussi. */
function vrai(v) {
  if (Array.isArray(v)) return v.length > 0;
  return !!v && v !== "0";
}

function condition(expr, ctx) {
  const m = String(expr).match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) return vrai(evaluerExpression(expr, ctx));
  const g = evaluerExpression(m[1], ctx), d = evaluerExpression(m[3], ctx);
  switch (m[2]) {
    case "==": return String(g) === String(d);
    case "!=": return String(g) !== String(d);
    case ">": return Number(g) > Number(d);
    case "<": return Number(g) < Number(d);
    case ">=": return Number(g) >= Number(d);
    case "<=": return Number(g) <= Number(d);
  }
  return false;
}

/**
 * Rend un gabarit. Traite d'abord les blocs (for, if), puis les variables — l'ordre compte,
 * une boucle doit pouvoir contenir des variables de son élément courant.
 */
function rendre(gabarit, ctx = {}) {
  let s = String(gabarit ?? "");

  // Boucles — les plus imbriquées d'abord, par passes successives.
  for (let garde = 0; garde < 20; garde++) {
    const avant = s;
    s = s.replace(/\{%\s*for\s+(\w+)\s+in\s+([\w.]+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
      (_, nom, source, corps) => {
        const liste = resoudre(source, ctx);
        if (!Array.isArray(liste)) return "";
        return liste.map((el, i) =>
          rendre(corps, { ...ctx, [nom]: el, forloop: { index: i + 1, index0: i, first: i === 0, last: i === liste.length - 1 } })
        ).join("");
      });
    if (s === avant) break;
  }

  // Conditions avec else.
  for (let garde = 0; garde < 20; garde++) {
    const avant = s;
    s = s.replace(/\{%\s*if\s+([\s\S]+?)\s*%\}([\s\S]*?)(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/g,
      (_, expr, oui, non) => (condition(expr, ctx) ? oui : non || ""));
    if (s === avant) break;
  }

  // Variables.
  s = s.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, (_, expr) => {
    const v = evaluerExpression(expr, ctx);
    if (v && typeof v === "object" && "__brut" in v) return v.__brut;
    return echapper(v);
  });

  return s;
}

// ------------------------------------------------------------------ CRUD

const lister = (kind = null) => kind
  ? all("SELECT * FROM templates WHERE kind = ? ORDER BY is_default DESC, name", kind)
  : all("SELECT * FROM templates ORDER BY kind, is_default DESC, name");

const parId = (id) => one("SELECT * FROM templates WHERE id = ?", id);

const defaut = (kind, storeId = null) =>
  one(`SELECT * FROM templates WHERE kind = ? AND (store_id = ? OR store_id IS NULL)
       ORDER BY (store_id IS NOT NULL) DESC, is_default DESC LIMIT 1`, kind, storeId);

function sauver(t) {
  if (t.is_default) run("UPDATE templates SET is_default = 0 WHERE kind = ? AND COALESCE(store_id,-1) = COALESCE(?,-1)", t.kind, t.store_id ?? null);
  if (t.id) {
    run("UPDATE templates SET name=?, kind=?, body=?, subject=?, is_default=?, store_id=? WHERE id=?",
      t.name, t.kind, t.body, t.subject || null, t.is_default ? 1 : 0, t.store_id ?? null, t.id);
    return t.id;
  }
  run("INSERT INTO templates (name,kind,body,subject,is_default,store_id) VALUES (?,?,?,?,?,?)",
    t.name, t.kind, t.body, t.subject || null, t.is_default ? 1 : 0, t.store_id ?? null);
  return one("SELECT last_insert_rowid() r").r;
}

const supprimer = (id) => run("DELETE FROM templates WHERE id = ?", id);

// ------------------------------------------------------- gabarits de départ

const BORDEREAU = `<div class="bordereau">
  <header>
    {% if marque.logo %}<img src="{{ marque.logo }}" alt="" class="logo">{% endif %}
    <div class="entete">
      <h1>{{ marque.nom | default: 'Bordereau d\\'emballage' }}</h1>
      <p>Commande <b>{{ order.order_number }}</b> — {{ order.order_date | date }}</p>
    </div>
  </header>
  <section class="adresses">
    <div><h3>Expédié à</h3>
      <p>{{ order.ship_to.name }}<br>
      {% if order.ship_to.company %}{{ order.ship_to.company }}<br>{% endif %}
      {{ order.ship_to.street1 }}<br>
      {% if order.ship_to.street2 %}{{ order.ship_to.street2 }}<br>{% endif %}
      {{ order.ship_to.city }}, {{ order.ship_to.state }} {{ order.ship_to.postalCode }}<br>
      {{ order.ship_to.country }}</p></div>
    <div><h3>Expédié par</h3>
      <p>{{ marque.nom }}<br>{{ marque.adresse }}<br>{{ marque.courriel }}</p></div>
  </section>
  <table class="articles">
    <thead><tr><th>Article</th><th>SKU</th><th>Empl.</th><th class="n">Qté</th><th class="n">Prix</th></tr></thead>
    <tbody>
    {% for i in items %}
      <tr><td>{{ i.name }}</td><td>{{ i.sku }}</td><td>{{ i.warehouse_location }}</td>
          <td class="n">{{ i.quantity }}</td><td class="n">{{ i.unit_price | money }}</td></tr>
    {% endfor %}
    </tbody>
  </table>
  {% if order.gift %}<p class="cadeau"><b>Cadeau :</b> {{ order.gift_message }}</p>{% endif %}
  {% if order.customer_notes %}<p class="notes">{{ order.customer_notes }}</p>{% endif %}
  <footer><p>{{ marque.message_bordereau | default: 'Merci de votre confiance.' }}</p></footer>
</div>`;

const COURRIEL_EXPEDITION = `<p>Bonjour {{ order.ship_to.name }},</p>
<p>Votre commande <b>{{ order.order_number }}</b> est en route.</p>
{% if shipment.tracking_number %}
<p>Numéro de suivi : <b>{{ shipment.tracking_number }}</b> ({{ shipment.carrier_code }})</p>
{% else %}
<p>Le numéro de suivi vous sera transmis dès qu'il sera disponible.</p>
{% endif %}
<table>
{% for i in items %}<tr><td>{{ i.quantity }} ×</td><td>{{ i.name }}</td></tr>{% endfor %}
</table>
<p>{{ marque.nom }}</p>`;

const COURRIEL_LIVRAISON = `<p>Bonjour {{ order.ship_to.name }},</p>
<p>Votre commande <b>{{ order.order_number }}</b> a été livrée.</p>
<p>Si quelque chose ne va pas, répondez simplement à ce courriel.</p>
<p>{{ marque.nom }}</p>`;

function gabaritsParDefaut() {
  return [
    { name: "Bordereau standard", kind: "packing_slip", body: BORDEREAU, is_default: 1 },
    { name: "Confirmation d'expédition", kind: "email", subject: "Votre commande {{ order.order_number }} est en route",
      body: COURRIEL_EXPEDITION, is_default: 1 },
    { name: "Confirmation de livraison", kind: "email", subject: "Votre commande {{ order.order_number }} est livrée",
      body: COURRIEL_LIVRAISON, is_default: 0 },
  ];
}

module.exports = { rendre, lister, parId, defaut, sauver, supprimer, gabaritsParDefaut, FILTRES, echapper };
