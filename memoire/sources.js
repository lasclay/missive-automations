/**
 * Lasclay — Adaptateurs de mémoire partagée.
 * -------------------------------------------
 * Les agents de Lasclay laissent déjà des traces : journaux JSONL, fichiers
 * d'état, commits, registre de la revue. Ce module les LIT là où elles sont.
 *
 * Principe : on ne demande à aucune routine de changer sa façon d'écrire.
 * Une mémoire partagée qui exige que neuf agents soient réécrits n'existe
 * jamais. Celle-ci se construit par-dessus ce qui est déjà là.
 *
 * Chaque adaptateur rend des événements de forme identique :
 *   { t, agent, type, resume, preuve }
 * type ∈ publication | travail | decision | blocage | attente | constat
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RACINE = path.resolve(__dirname, "..");
const FUSEAU = "America/Toronto";

function git(args) {
  try { return execFileSync("git", args, { cwd: RACINE, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim(); }
  catch { return ""; }
}

const lireJson = (p, defaut = null) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return defaut; }
};

// ------------------------------------------------------------ backlog Facebook

const PAGES = { A: "Lasclay", B: "The Milkweed Company", C: "Milkweed & Monarchs", D: "Asclépiade & papillons" };

function backlogFacebook(depuis) {
  const evenements = [];
  const dossier = path.join(RACINE, "fb-backlog", "etat");
  if (!fs.existsSync(dossier)) return evenements;

  for (const [tir, page] of Object.entries(PAGES)) {
    const journal = path.join(dossier, tir + "-journal.jsonl");
    if (!fs.existsSync(journal)) continue;
    const lignes = fs.readFileSync(journal, "utf8").split("\n").filter((l) => l.trim());

    // Une ligne = une réponse publiée. On les agrège par heure : neuf cents
    // événements « réponse publiée » ne sont pas une mémoire, c'est du bruit.
    const parHeure = new Map();
    for (const ligne of lignes) {
      let e; try { e = JSON.parse(ligne); } catch { continue; }
      const t = new Date(e.t);
      if (Number.isNaN(+t) || t < depuis) continue;
      const cle = e.t.slice(0, 13);
      const seau = parHeure.get(cle) || { n: 0, confirmees: 0, dernier: e.t };
      seau.n++;
      if (e.confirme === true) seau.confirmees++;
      if (e.t > seau.dernier) seau.dernier = e.t;
      parHeure.set(cle, seau);
    }
    for (const [, s] of parHeure) {
      evenements.push({
        t: s.dernier,
        agent: "fb-tir-" + tir,
        type: "publication",
        resume: s.n + " réponse" + (s.n > 1 ? "s" : "") + " publiée" + (s.n > 1 ? "s" : "") + " sur " + page +
          (s.confirmees < s.n ? " — " + (s.n - s.confirmees) + " NON confirmée(s) chez Meta" : ""),
        preuve: "fb-backlog/etat/" + tir + "-journal.jsonl",
      });
    }
  }
  return evenements;
}

// ------------------------------------------------------------ git

/**
 * À qui attribuer un commit. L'auteur git dit toujours « Claude » : inutile.
 * Ce sont les fichiers touchés qui disent quel agent a travaillé.
 */
function attribuer(fichiers) {
  const f = fichiers.join(" ");
  const tir = f.match(/fb-backlog\/etat\/([A-D])-/);
  if (tir) return "fb-tir-" + tir[1];
  if (/^|\s/.test(f) && f.includes("retail-expansion/")) return "campagne-points-de-vente";
  if (f.includes("revue/")) return "revue-quotidienne";
  if (f.includes("memoire/")) return "memoire";
  if (f.includes(".claude/skills/")) return "sync-skills";
  if (f.includes("a2x/") || f.includes("a2x-app/")) return "a2x";
  if (f.includes("finance-proxy/") || f.includes("qbo")) return "finance";
  if (f.includes("missive-proxy/") || f.includes("support.js") || f.includes("digest.js")) return "boite-support";
  if (f.includes("shipstation-clone/")) return "clone-shipstation";
  if (f.includes("mrp/")) return "mrp";
  return "session Claude";
}

function commits(depuis) {
  const brut = git(["log", "--all", "--no-merges", "--since=" + depuis.toISOString(),
    "--pretty=format:\x1e%aI\x1f%h\x1f%s", "--name-only"]);
  if (!brut) return [];
  return brut.split("\x1e").filter((b) => b.trim()).map((bloc) => {
    const lignes = bloc.trim().split("\n");
    const [t, sha, sujet] = lignes[0].split("\x1f");
    const fichiers = lignes.slice(1).filter(Boolean);
    return { t, agent: attribuer(fichiers), type: "travail", resume: sujet, preuve: sha };
  });
}

/** Branches poussées qui ne sont pas dans main : du travail qui n'est pas déployé. */
function branchesEnAttente() {
  const brut = git(["for-each-ref", "--format=%(refname:short)\x1f%(committerdate:iso-strict)\x1f%(subject)", "refs/remotes/origin"]);
  const out = [];
  for (const l of brut.split("\n").filter(Boolean)) {
    const [ref, date, sujet] = l.split("\x1f");
    if (ref === "origin/main" || ref === "origin/HEAD") continue;
    const enRetard = git(["rev-list", "--count", "origin/main.." + ref]);
    if (!enRetard || enRetard === "0") continue;
    out.push({ branche: ref.replace(/^origin\//, ""), commits_hors_main: Number(enRetard), dernier: date, sujet });
  }
  return out.sort((a, b) => (a.dernier < b.dernier ? 1 : -1));
}

// ------------------------------------------------------------ flotte

/** Chaque agent, sa dernière trace réelle, et depuis combien de temps. */
function flotte(maintenant) {
  const inv = lireJson(path.join(RACINE, "revue", "routines.json"), { routines: [] });
  return (inv.routines || []).map((r) => {
    const fiche = { nom: r.nom, horaire: r.horaire || null, trace: r.trace.type, note: r.note || null };
    let derniere = null;

    if (r.trace.type === "jsonl") {
      const p = path.join(RACINE, r.trace.fichier);
      if (fs.existsSync(p)) {
        const lignes = fs.readFileSync(p, "utf8").trim().split("\n").filter(Boolean);
        for (let i = lignes.length - 1; i >= 0 && !derniere; i--) {
          try {
            const t = new Date(JSON.parse(lignes[i])[r.trace.champ_temps || "t"]);
            if (!Number.isNaN(+t)) derniere = t;
          } catch { /* on remonte */ }
        }
      }
    } else if (r.trace.type === "git") {
      const iso = git(["log", "--all", "-1", "--format=%aI", "--", r.trace.chemin]);
      if (iso) derniere = new Date(iso);
    } else {
      fiche.etat = "invérifiable";
      return fiche;
    }

    if (!derniere) { fiche.etat = "aucune trace"; return fiche; }
    fiche.derniere = derniere.toISOString();
    fiche.age_h = Math.round(((maintenant - derniere) / 3600000) * 10) / 10;
    fiche.etat = r.fraicheur_max_h != null && fiche.age_h > r.fraicheur_max_h ? "silencieux" : "actif";
    return fiche;
  });
}

// ------------------------------------------------------------ ce qui attend une décision

function enAttenteDeGabriel() {
  const attentes = [];

  const reg = lireJson(path.join(RACINE, "revue", "registre.json"), { ameliorations: [] });
  for (const a of (reg.ameliorations || []).filter((x) => x.etat === "proposee")) {
    attentes.push({
      quoi: a.titre,
      pourquoi: "amélioration proposée par la revue, en attente d'approbation",
      gravite: a.gravite,
      depuis: a.propose_le,
      comment: "node revue/registre.js approuver " + a.id + "  (ou refuser / reporter)",
    });
  }

  // Événements notés à la main dont le type dit qu'ils attendent quelqu'un.
  for (const e of journalManuel(new Date(0))) {
    if (e.type === "attente" || e.type === "blocage") {
      attentes.push({ quoi: e.resume, pourquoi: e.type === "blocage" ? "bloqué" : "en attente", depuis: e.t.slice(0, 10), comment: e.preuve || null, agent: e.agent });
    }
  }
  return attentes;
}

// ------------------------------------------------------------ journal manuel

/** Ce qu'aucune trace automatique ne porte : décisions, blocages, questions. */
function journalManuel(depuis) {
  const p = path.join(__dirname, "journal.jsonl");
  if (!fs.existsSync(p)) return [];
  const out = [];
  for (const ligne of fs.readFileSync(p, "utf8").split("\n")) {
    if (!ligne.trim()) continue;
    let e; try { e = JSON.parse(ligne); } catch { continue; }
    const t = new Date(e.t);
    if (Number.isNaN(+t) || t < depuis) continue;
    // Un blocage résolu ne pèse plus sur l'état courant.
    if (e.resolu) continue;
    out.push(e);
  }
  return out;
}

const heureLocale = (iso) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

module.exports = { RACINE, FUSEAU, git, lireJson, backlogFacebook, commits, branchesEnAttente, flotte, enAttenteDeGabriel, journalManuel, heureLocale };
