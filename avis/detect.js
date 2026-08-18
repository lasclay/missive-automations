// Repère les fils où un client exprime spontanément un éloge publiable.
// Lit threads.jsonl, écrit candidats.jsonl. Aucun appel réseau.
const fs = require("fs");
const DIR = __dirname;

const AUTO = /(noreply|no-reply|donotreply|mailer-daemon|postmaster|shopify|judge\.me|judgeme|klaviyo|shipstation|postescanada|canadapost|chitchats|stripe|paypal|quickbooks|intuit|facturation|billing|notification|calendly|zoom\.us|linkedin|instagram|facebookmail|google\.com|microsoft)/i;

// Éloge net : porte un jugement de valeur.
const FORT_FR = [
  /\bj[e']?\s*(l[ae'’]?\s*)?adore\b/i, /\bon adore\b/i, /\badorable\b/i,
  /\bcoup de c(oe|œ)ur\b/i, /\bmerveilleu(x|se)\b/i, /\bmagnifique\b/i, /\bsuperbe\b/i,
  /\bformidable\b/i, /\bextraordinaire\b/i, /\bexceptionnel(le)?\b/i, /\bimpeccable\b/i,
  /\bexcellent(e|s)?\b/i, /\bg(é|e)nial(e|es|aux)?\b/i, /\bincroyable\b/i,
  /\bje (vous )?recommande\b/i, /\bje le recommande\b/i, /\bje la recommande\b/i,
  /\b(tr(è|e)s )?satisfait(e|s)?\b/i, /\bravi(e|s)?\b/i, /\bencha(n|nt)t(é|e)e?\b/i, /\bcombl(é|e)e?\b/i,
  /\bbravo\b/i, /\bf(é|e)licitations\b/i, /\bchapeau\b/i, /\blongue vie\b/i,
  /\bmeilleur(e|s)?\b/i, /\bfi(è|e)re? d[e']\s*(vous )?encourager\b/i,
  /\baime(nt)? beaucoup\b/i, /\bappr(é|e)cie(nt)? (beaucoup|(é|e)norm(é|e)ment)\b/i,
  /\bbelles? qualit(é|e)s?\b/i, /\bfi(è|e)re? (de vous|d[e']avoir|de porter)\b/i, /\bplaisir de (vous |le |les )?(soutenir|encourager)\b/i,
  /\bchaud au c(oe|œ)ur\b/i, /\bcontent(e|s)? de mon achat\b/i, /\bjamais d(é|e)(ç|c)ue?\b/i,
  /\bquelle belle (d(é|e)couverte|entreprise|surprise)\b/i, /\bbelle d(é|e)couverte\b/i,
];
const FORT_EN = [
  /\bproud (of you|to (tell|share|recommend|wear|own))\b/i, /\bkeep up the (great|good) work\b/i,
  /\bi (absolutely )?love\b/i, /\bwe love\b/i, /\bloved? (it|them|the|my|these|this)\b/i,
  /\bamazing\b/i, /\bawesome\b/i, /\bfantastic\b/i, /\bwonderful\b/i, /\bexcellent\b/i,
  /\boutstanding\b/i, /\bsuperb\b/i, /\bincredible\b/i, /\bimpressed\b/i, /\bdelighted\b/i,
  /\bthrilled\b/i, /\b(highly )?recommend\b/i, /\bbest (purchase|product|company|thing|investment)\b/i,
  /\bfavou?rite\b/i, /\bexceeded (my )?expectations\b/i, /\bworth (every|it)\b/i,
  /\bso (happy|pleased) with\b/i, /\bvery (happy|pleased) with\b/i, /\bkudos\b/i, /\bwell made\b/i,
];
// Éloge plus faible : positif mais moins tranché, ou banal hors contexte produit.
const MOYEN_FR = [
  /\bparfait(e|s)?\b/i, /\bsuper\b/i, /\btr(è|e)s (beau|belle|bon|bonne|chaud|confortable|content)/i,
  /\bbelle qualit(é|e)\b/i, /\bbonne qualit(é|e)\b/i, /\bqualit(é|e) (exceptionnelle|remarquable|au rendez-vous)\b/i,
  /\btr(è|e)s content(e|s)?\b/i, /\bcontent(e|s)? (de|du|d[e'])\b/i, /\bheureu(x|se) (de|du|d[e'])\b/i,
  /\bbeau (produit|travail|projet)\b/i, /\bbon (produit|service|travail)\b/i,
  /\bservice (rapide|efficace|courtois|hors pair|au top)\b/i, /\brapide et efficace\b/i,
  /\bprofessionnalisme\b/i, /\bgentillesse\b/i, /\bcontinuez\b/i, /\bwow\b/i,
  /\bje suis conquis(e)?\b/i, /\bau top\b/i, /\bten(u|ue)s? (au )?chaud\b/i, /\btiennent (bien )?chaud\b/i,
];
const MOYEN_EN = [
  /\bperfect\b/i, /\bgreat (product|service|job|quality|company)\b/i, /\bvery (nice|warm|comfortable|good)\b/i,
  /\bbeautiful\b/i, /\bhigh quality\b/i, /\bgood quality\b/i, /\bcomfortable\b/i,
  /\bkeeps? (me |them |things )?(really )?(warm|cold)\b/i, /\bvery satisfied\b/i, /\bsuper\b/i,
];
// Produits nommés : un éloge qui vise un produit vaut plus qu'un éloge en l'air.
const PRODUIT = /\b(tuque|mitaine|mitaines|cache-cou|cache cou|foulard|bandeau|semelle|semelles|manteau|veste|glaci(è|e)re|sac (à|a) lunch|lunch ?bag|besace|pantoufle|pantoufles|graine|graines|semence|semences|bombe|asclépiade|asclepiade|milkweed|isolant|coussin|manchon|huile|cr(è|e)me|(é|e)tui|couverture|oreiller|toque|beanie|mitts|insoles|scarf|neck ?warmer|cooler|slippers|seeds)\b/i;
// Griefs : s'ils dominent, ce n'est pas un témoignage à publier.
const GRIEF = /\b(d(é|e)(ç|c)u(e|s)?|d(é|e)ception|probl(è|e)me|d(é|e)fectueu|bris(é|e)|ab(î|i)m(é|e)|remboursement|rembourser|retour|(é|e)change|plainte|insatisfait|jamais re(ç|c)u|non re(ç|c)u|manquant|erreur|disappointed|broken|damaged|defect|refund|complaint|never (arrived|received)|missing|wrong (item|size))/i;
// Souhaits de circonstance : « bonne chance », « joyeuses fêtes ». Cordial, mais ce n'est pas
// un jugement sur un produit ou un service. Ne compte que si la phrase parle aussi d'autre chose.
const SOUHAIT = /\b(je vous souhaite|meilleure? des chances|bonne chance|joyeuses f(ê|e)tes|joyeux no(ë|e)l|bon succ(è|e)s|bonne continu\w*|bel (é|e)t(é|e)|belle saison|bonne ann(é|e)e|good luck|best wishes|happy holidays|merry christmas)\b/i;
const NEG = /\b(pas|jamais|aucun|aucune|ne\s|n['’]|malheureusement|dommage|not|isn['’]?t|wasn['’]?t|don['’]?t|didn['’]?t|no longer|unfortunately)\b/i;
// Politesse seule : le vrai bruit. Une phrase qui ne contient QUE ça ne compte pas.
const POLITESSE_SEULE = /^[\s\W]*((un )?(gros |grand |mille |encore )?merci|merci (beaucoup|bien|infiniment|encore|mille fois)?|thank(s| you)( so much| very much| again)?|parfait merci|ok merci|super merci|d['’]accord merci|bonne journ(é|e)e|bonjour|salut|cordialement|au revoir)[\s\W]*$/i;

// Apple Mail et Outlook écrivent « j’adore » avec une apostrophe typographique. Sans cette
// normalisation, /j[e']?adore/ ne voyait rien, et c'est l'éloge le plus courant du corpus.
function droit(t) { return (t || "").replace(/[\u2018\u2019\u201B\u02BC]/g, "'"); }
function phrases(t) {
  return t.replace(/\r/g, "").split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 2);
}
// Les citations du fil précédent commencent par > ou par « Le … a écrit : ».
function sansCitation(t) {
  // Les clients Outlook et Apple recollent le fil précédent sous l'entête « De : / From: ».
  // Sans cette coupe, on note l'infolettre de Lasclay comme si le client l'avait écrite.
  const coupe = t.search(/(\n\s*>|Le .{0,60}(a écrit|wrote)\s*:|On .{0,60}wrote\s*:|-{2,} ?(Message|Original|Forwarded)|\n\s*(De|From|Envoyé|Sent|Exp(é|e)diteur)\s*:|Envoyé de mon|Envoyé depuis mon|Sent from my|Obtenir\s*\n?\s*Outlook|Get Outlook|_{5,})/);
  return coupe > 20 ? t.slice(0, coupe) : (coupe === -1 ? t : "");
}
// Notification d'avis déjà publié : Judge.me écrit dans la boîte à chaque nouvel avis.
const JUDGEME_NOTIF = /a (écrit|mis à jour son|laissé) .{0,20}avis \d ?étoile|wrote a \d.star review|judge\.me/i;
// L'éloge doit porter sur quelque chose : un produit, le service, la marque, l'entreprise.
// « Excellent Gabriel, on se dit lundi » n'est pas un témoignage, c'est de la coordination.
const CONTEXTE = /\b(produit|produits|commande|colis|achat|boutique|entreprise|compagnie|service|livraison|lasclay|item|order|package|purchase|shop|company|delivery|qualit(é|e)|quality|votre travail|ce que vous faites|votre mission|votre d(é|e)marche)\b/i;

function juge(fil) {
  const clients = (fil.msgs || []).filter((m) => !m.us);
  if (!clients.length) return null;
  const suj = fil.subject || "";
  const expediteurs = clients.map((m) => (m.adr || "") + " " + (m.from || "")).join(" ");
  if (JUDGEME_NOTIF.test(suj) || /judge\.me/i.test(expediteurs)) {
    const nom = (suj.match(/^(.+?),\s*a (écrit|mis à jour)/) || [])[1] || null;
    return { id: fil.id, subject: suj, score: 0, niveau: "judgeme_publie",
             extrait: suj.slice(0, 300), adr: null, nom, date: clients[clients.length - 1].date || null };
  }
  let score = 0, meilleur = "", meilleurScore = 0;
  for (const m of clients) {
    const adr = (m.adr || "") + " " + (m.from || "");
    if (AUTO.test(adr)) continue;
    const corps = droit(sansCitation(m.txt || ""));
    for (const p of phrases(corps)) {
      if (POLITESSE_SEULE.test(p)) continue;
      if (p.length > 600) continue;
      let s = 0;
      const neg = NEG.test(p);
      for (const r of [...FORT_FR, ...FORT_EN]) if (r.test(p)) { s += neg ? 1 : 3; break; }
      for (const r of [...MOYEN_FR, ...MOYEN_EN]) if (r.test(p)) { s += neg ? 0 : 2; break; }
      if (s && PRODUIT.test(p)) s += 1;
      // Un éloge sans objet identifiable vaut deux fois moins : on regarde la phrase,
      // puis le message entier, avant de le retenir.
      if (s && !PRODUIT.test(p) && !CONTEXTE.test(p) && !PRODUIT.test(corps) && !CONTEXTE.test(corps)) s = Math.floor(s / 2);
      if (s && SOUHAIT.test(p) && !PRODUIT.test(p) && !CONTEXTE.test(p)) s = 0;
      if (s && GRIEF.test(p)) s -= 2;
      if (s > meilleurScore) { meilleurScore = s; meilleur = p; }
      score += Math.max(0, s);
    }
  }
  if (!score) return null;
  const niveau = score >= 5 ? "fort" : score >= 2 ? "possible" : "non";
  const dernier = clients[clients.length - 1];
  return {
    id: fil.id, subject: fil.subject || "", score, niveau,
    extrait: meilleur.slice(0, 300),
    adr: dernier.adr || null, nom: dernier.from || null, date: dernier.date || null,
  };
}

// Deux sources : l'archive du support (décembre 2021 à juin 2026, déposée en tranches
// gzip sur les brouillons de la conversation d'archives) et la collecte en direct qui
// couvre ce qui a suivi. Le fil le plus riche gagne.
const lignes = [];
for (const f of ["archive_threads.jsonl", "threads.jsonl"]) {
  const p = `${DIR}/${f}`;
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split("\n")) if (l.trim()) lignes.push(l);
}
const out = fs.createWriteStream(`${DIR}/candidats.jsonl`);
const cpt = { fort: 0, possible: 0, non: 0, judgeme_publie: 0, sansSignal: 0 };
const parId = new Map();
for (const l of lignes) {
  let f; try { f = JSON.parse(l); } catch { continue; }
  if (f.echec) continue;
  const p = parId.get(f.id);
  if (!p || (f.msgs || []).length > (p.msgs || []).length) parId.set(f.id, f);
}
for (const f of parId.values()) {
  const r = juge(f);
  if (!r) { cpt.sansSignal++; continue; }
  cpt[r.niveau]++;
  out.write(JSON.stringify(r) + "\n");
}
out.end();
console.log(`${parId.size} fils uniques lus →`, JSON.stringify(cpt));
