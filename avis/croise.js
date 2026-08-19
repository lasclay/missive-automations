// Croise les fils Missive, le détecteur d'éloges et les 853 avis Judge.me,
// et propose une action par fil. N'écrit RIEN dans Missive : il produit decisions.jsonl.
const fs = require("fs");
const DIR = __dirname;

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ").trim();

// --- Répertoire Judge.me -------------------------------------------------
const avis = JSON.parse(fs.readFileSync(`${DIR}/judgeme_avis.json`, "utf8"));
const parNomComplet = new Map();   // « danielle rondeau » -> [avis]
const parPrenom = new Map();       // « bernard » -> [avis]
for (const a of avis) {
  const n = norm(a.auteur);
  if (!n || n === "anonyme" || n === "anonymous") continue;
  const mots = n.split(" ").filter((m) => m.length > 1);
  if (mots.length >= 2) {
    if (!parNomComplet.has(n)) parNomComplet.set(n, []);
    parNomComplet.get(n).push(a);
  }
  if (mots.length) {
    const p = mots[0];
    if (!parPrenom.has(p)) parPrenom.set(p, []);
    parPrenom.get(p).push(a);
  }
}

// Un retrait d'étiquette doit s'appuyer sur une correspondance solide : nom ET prénom.
// Le prénom seul ne prouve rien, Judge.me en affiche des dizaines d'identiques.
function chercheJudgeme(nom, adresse) {
  const n = norm(nom);
  const mots = n.split(" ").filter((m) => m.length > 1);
  if (mots.length >= 2) {
    const direct = parNomComplet.get(n);
    if (direct) return { force: "forte", avis: direct };
    // « Marie-Claude Tremblay » vs « Marie Claude Tremblay » : on compare les ensembles.
    for (const [cle, lot] of parNomComplet) {
      const c = cle.split(" ").filter((m) => m.length > 1);
      if (c.length === mots.length && c.every((m) => mots.includes(m))) return { force: "forte", avis: lot };
    }
    // Prénom + initiale du nom : « B.R. » côté Judge.me pour « Bernard Rousseau ».
    const ini = `${mots[0]} ${mots[mots.length - 1][0]}`;
    for (const [cle, lot] of parNomComplet) {
      const c = cle.split(" ");
      if (c.length >= 2 && `${c[0]} ${c[c.length - 1][0]}` === ini) return { force: "forte", avis: lot };
    }
  }
  const prenom = mots[0] || norm((adresse || "").split("@")[0]).split(" ")[0];
  if (prenom && parPrenom.has(prenom)) return { force: "faible", avis: parPrenom.get(prenom) };
  return null;
}

// --- Entrées -------------------------------------------------------------
const etiquetes = new Map();
for (const c of JSON.parse(fs.readFileSync(`${DIR}/labelled.json`, "utf8")).conversations || []) etiquetes.set(c.id, c);

const cands = new Map();
for (const l of fs.readFileSync(`${DIR}/candidats.jsonl`, "utf8").split("\n")) {
  if (!l.trim()) continue;
  const d = JSON.parse(l);
  cands.set(d.id, d);
}

// Verdict des agents de rédaction. Il prime sur le lexique : le détecteur sert à
// présélectionner, pas à décider. Un fil qu'aucun agent n'a retenu n'est pas un éloge
// publiable, même s'il a bien noté.
const retenusAgents = new Set();
const relus = new Set();
for (let i = 1; i <= 20; i++) {
  for (const [f, cible] of [[`redige_${i}.jsonl`, retenusAgents], [`redige_${i}_rejets.jsonl`, relus]]) {
    const p = `${DIR}/${f}`;
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, "utf8").split("\n")) {
      if (!l.trim()) continue;
      try { const d = JSON.parse(l); if (d.id) { cible.add(d.id); relus.add(d.id); } } catch {}
    }
  }
}
const verdictDisponible = relus.size > 0;

const parIdFil = new Map();
for (const f of ["archive_threads.jsonl", "threads.jsonl"]) {
  const p = `${DIR}/${f}`;
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split("\n")) {
    if (!l.trim()) continue;
    let d; try { d = JSON.parse(l); } catch { continue; }
    const prev = parIdFil.get(d.id);
    if (!prev || (d.msgs || []).length > (prev.msgs || []).length) parIdFil.set(d.id, d);
    // L'archive porte l'étiquette du fil : c'est une source aussi valable que la liste vivante.
    if ((d.labels || []).some((L) => /review (à|a) traiter/i.test(String(L)))) {
      if (!etiquetes.has(d.id)) etiquetes.set(d.id, { id: d.id, subject: d.subject });
    }
  }
}
const fils = [...parIdFil.values()];

// Le client d'un fil : le dernier expéditeur humain qui n'est pas Lasclay.
const NOUS = /lasclay|@lasclay\.com/i;
const AUTO = /(noreply|no-reply|mailer-daemon|shopify|judge\.me|klaviyo|shipstation|postescanada|canadapost)/i;
function client(f) {
  for (let i = (f.msgs || []).length - 1; i >= 0; i--) {
    const m = f.msgs[i];
    if (m.us) continue;
    const id = `${m.adr || ""} ${m.from || ""}`;
    if (NOUS.test(id) || AUTO.test(id)) continue;
    return { nom: m.from || null, adr: m.adr || null, date: m.date || null };
  }
  return null;
}

const sortie = fs.createWriteStream(`${DIR}/decisions.jsonl`);
const cpt = { ajouter: 0, garder: 0, retirer_negatif: 0, retirer_publie: 0, rien: 0, incomplet: 0 };
const vus = new Set();

for (const f of fils) {
  if (vus.has(f.id)) continue;
  vus.add(f.id);
  if (f.echec) { cpt.incomplet++; continue; }
  const dejaEtiquete = etiquetes.has(f.id);
  const cand = cands.get(f.id);
  // Si un agent a relu ce fil, c'est lui qui tranche. Sinon on retombe sur le lexique.
  const positif = verdictDisponible && relus.has(f.id)
    ? retenusAgents.has(f.id)
    : (cand && (cand.niveau === "fort" || cand.niveau === "possible"));
  const cl = client(f) || {};
  const jm = positif || dejaEtiquete ? chercheJudgeme(cl.nom, cl.adr) : null;
  const publie = jm && jm.force === "forte";

  let action = null, motif = null;
  if (dejaEtiquete && cand && cand.niveau === "judgeme_publie") { action = "retirer"; motif = "notification Judge.me : l'avis est déjà publié"; cpt.retirer_publie++; }
  else if (dejaEtiquete && !positif) { action = "retirer"; motif = "aucun éloge dans le fil"; cpt.retirer_negatif++; }
  else if (dejaEtiquete && publie) { action = "retirer"; motif = "auteur déjà publié sur Judge.me"; cpt.retirer_publie++; }
  else if (dejaEtiquete) { action = "garder"; motif = "éloge, absent de Judge.me"; cpt.garder++; }
  else if (positif && !publie) { action = "ajouter"; motif = "éloge, absent de Judge.me"; cpt.ajouter++; }
  else if (positif) { action = "rien"; motif = "éloge, mais déjà publié sur Judge.me"; cpt.rien++; }
  if (!action) continue;

  sortie.write(JSON.stringify({
    id: f.id, action, motif,
    sujet: (f.subject || "").slice(0, 90),
    niveau: cand ? cand.niveau : null,
    score: cand ? cand.score : null,
    extrait: cand ? cand.extrait : null,
    client: cl.nom || null, courriel: cl.adr || null,
    date: (cand && cand.date) || cl.date || null,
    judgeme: jm ? { force: jm.force, nb: jm.avis.length,
                    exemple: jm.avis[0] ? `${jm.avis[0].auteur} ${jm.avis[0].note}★ ${jm.avis[0].date} ${jm.avis[0].produit}` : null } : null,
  }) + "\n");
}
sortie.end();
console.log(`${fils.length} fils, ${etiquetes.size} déjà étiquetés →`, JSON.stringify(cpt));
