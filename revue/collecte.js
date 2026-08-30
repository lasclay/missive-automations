#!/usr/bin/env node
/**
 * Lasclay — Collecte des preuves de la journée, pour la revue quotidienne.
 * ------------------------------------------------------------------------
 * Ramasse ce qui est vérifiable depuis le dépôt et depuis les services, sans
 * rien inventer : commits du jour, journaux des routines, santé des proxys,
 * état du registre d'améliorations.
 *
 * Ce que ce script NE fait PAS, et qui appartient à l'agent qui le lance :
 *   - lire les Routines et leur dernier run  (MCP list_triggers)
 *   - lire les sessions Claude de la journée (MCP list_sessions)
 *   - lire les conversations Missive         (node missive_client.js)
 * Ces trois sources ne sont pas joignables depuis un script Node.
 *
 * Usage :
 *   node revue/collecte.js                 # journée locale en cours (America/Toronto)
 *   node revue/collecte.js 2026-08-29      # une journée précise
 *   node revue/collecte.js --sans-reseau   # saute les sondes de santé
 *
 * Écrit revue/jour/AAAA-MM-JJ/collecte.json et résume sur stdout.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FUSEAU = "America/Toronto";
const RACINE = path.resolve(__dirname, "..");
const SEP = "\x1e";
const TIRS = { A: "Lasclay", B: "The Milkweed Company", C: "Milkweed & Monarchs", D: "Asclepiade & papillons monarques" };

// ---------------------------------------------------------------- dates

function jourLocal(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Décalage du fuseau, en minutes, en vigueur à cet instant (gère EDT/EST). */
function decalageMinutes(d) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: FUSEAU, timeZoneName: "longOffset" }).format(d);
  const m = s.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** Bornes UTC [debut, fin) de la journée locale donnée. */
function fenetre(jour) {
  const [a, mo, j] = jour.split("-").map(Number);
  const approx = Date.UTC(a, mo - 1, j, 12, 0, 0);            // midi : jamais ambigu
  const off = decalageMinutes(new Date(approx));
  const debut = new Date(Date.UTC(a, mo - 1, j) - off * 60000);
  const fin = new Date(debut.getTime() + 24 * 3600 * 1000);
  return { debut, fin, decalage: off };
}

// ---------------------------------------------------------------- outils

function git(args) {
  try {
    return execFileSync("git", args, { cwd: RACINE, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
  } catch {
    return "";
  }
}

async function sonde(nom, url, options = {}) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), options.timeout || 45000);
  try {
    const res = await fetch(url, { method: options.method || "GET", headers: options.headers || {}, signal: ctrl.signal });
    const texte = (await res.text()).slice(0, 300);
    return { service: nom, url, statut: res.status, ok: res.ok, ms: Date.now() - t0, extrait: texte };
  } catch (e) {
    return { service: nom, url, statut: null, ok: false, ms: Date.now() - t0, erreur: String(e.message || e) };
  } finally {
    clearTimeout(minuteur);
  }
}

// ---------------------------------------------------------------- git du jour

function commitsDuJour({ debut, fin }) {
  const brut = git([
    "log", "--all", "--no-merges",
    "--since=" + debut.toISOString(), "--until=" + fin.toISOString(),
    "--pretty=format:%x1e%H|%aI|%an|%s", "--numstat",
  ]);
  if (!brut) return [];
  return brut.split(SEP).filter((b) => b.trim()).map((bloc) => {
    const lignes = bloc.trim().split("\n");
    const [sha, date, auteur, ...reste] = lignes[0].split("|");
    const fichiers = [];
    let ajouts = 0, retraits = 0;
    for (const l of lignes.slice(1)) {
      const m = l.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m) continue;
      const a = m[1] === "-" ? 0 : Number(m[1]);
      const r = m[2] === "-" ? 0 : Number(m[2]);
      ajouts += a; retraits += r;
      fichiers.push({ fichier: m[3], ajouts: a, retraits: r });
    }
    return { sha: sha.slice(0, 8), date, auteur, sujet: reste.join("|"), ajouts, retraits, fichiers };
  });
}

function branchesTouchees(commits) {
  const par = {};
  for (const c of commits) {
    const b = git(["branch", "-a", "--contains", c.sha, "--format=%(refname:short)"]).split("\n").filter(Boolean);
    const nom = b.find((x) => !x.startsWith("origin/")) || b[0] || "(inconnue)";
    (par[nom] ||= []).push(c.sha);
  }
  return par;
}

// ---------------------------------------------------------------- backlog Facebook

function backlogFacebook({ debut, fin }, jour) {
  const dossier = path.join(RACINE, "fb-backlog", "etat");
  const out = { presents: fs.existsSync(dossier), tirs: {} };
  if (!out.presents) return out;

  for (const [tir, page] of Object.entries(TIRS)) {
    const fiche = { page, publiees: 0, confirmees: 0, non_confirmees: 0, erreurs: [], ecartes_du_jour: 0, dernier_journal: null };
    const heures = [];

    const journal = path.join(dossier, tir + "-journal.jsonl");
    if (fs.existsSync(journal)) {
      for (const ligne of fs.readFileSync(journal, "utf8").split("\n")) {
        if (!ligne.trim()) continue;
        let e;
        try { e = JSON.parse(ligne); }
        catch { fiche.erreurs.push({ motif: "ligne de journal illisible", extrait: ligne.slice(0, 120) }); continue; }
        const t = new Date(e.t);
        if (Number.isNaN(+t)) continue;
        if (!fiche.dernier_journal || t > new Date(fiche.dernier_journal)) fiche.dernier_journal = e.t;
        if (t < debut || t >= fin) continue;
        fiche.publiees++;
        if (e.confirme === true) fiche.confirmees++; else fiche.non_confirmees++;
        if (e.erreur) fiche.erreurs.push({ id: e.id, erreur: e.erreur });
        heures.push(new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, hour: "2-digit", hour12: false }).format(t));
      }
    }

    const aRevoir = path.join(dossier, tir + "-a-revoir.json");
    if (fs.existsSync(aRevoir)) {
      try {
        const j = JSON.parse(fs.readFileSync(aRevoir, "utf8"));
        const liste = Array.isArray(j.a_revoir) ? j.a_revoir : [];
        fiche.ecartes_total = liste.length;
        const duJour = liste.filter((x) => x.ecarte_le === jour);
        fiche.ecartes_du_jour = duJour.length;
        fiche.motifs_du_jour = duJour.map((x) => x.motif).slice(0, 40);
      } catch (e) {
        fiche.erreurs.push({ motif: "a-revoir.json illisible", erreur: String(e.message || e) });
      }
    }

    // Heures ouvrables attendues (9h-17h Est, sans midi) sans aucune publication.
    const attendues = ["09", "10", "11", "13", "14", "15", "16", "17"];
    const vues = new Set(heures);
    fiche.heures_sans_publication = attendues.filter((h) => !vues.has(h));
    fiche.repartition = attendues.map((h) => ({ heure: h, n: heures.filter((x) => x === h).length }));

    out.tirs[tir] = fiche;
  }
  out.total_publiees = Object.values(out.tirs).reduce((s, f) => s + f.publiees, 0);
  out.total_non_confirmees = Object.values(out.tirs).reduce((s, f) => s + f.non_confirmees, 0);
  return out;
}

// ---------------------------------------------------------------- santé des services

async function santeServices() {
  const cibles = [];
  const m = process.env.MISSIVE_PROXY_URL, g = process.env.GENERAL_PROXY_URL, f = process.env.FINANCE_PROXY_URL;
  if (m) cibles.push(["missive-proxy", m.replace(/\/$/, "") + "/health"]);
  if (g) cibles.push(["general-proxy", g.replace(/\/$/, "") + "/connectors"]);
  if (f) cibles.push(["finance-proxy", f.replace(/\/$/, "") + "/health"]);
  const res = [];
  for (const [nom, url] of cibles) res.push(await sonde(nom, url));   // en série : Render réveille lentement
  return res;
}

// ---------------------------------------------------------------- routines, par leur trace

/**
 * Une routine se juge sur ce qu'elle laisse derrière elle, jamais sur son statut déclaré :
 * une routine qui tire sans rien faire est marquée SUCCEEDED. On mesure donc l'âge de sa
 * dernière trace réelle — dernière ligne de journal, ou dernier commit touchant son chemin.
 */
function etatRoutines(maintenant) {
  const f = path.join(__dirname, "routines.json");
  if (!fs.existsSync(f)) return { present: false };
  let inventaire;
  try { inventaire = JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { return { present: true, erreur: String(e.message || e) }; }

  const fiches = (inventaire.routines || []).map((r) => {
    const fiche = { id: r.id, nom: r.nom, cron_utc: r.cron_utc, horaire: r.horaire, note: r.note || null, trace: r.trace.type };
    let derniere = null;

    if (r.trace.type === "jsonl") {
      const chemin = path.join(RACINE, r.trace.fichier);
      if (!fs.existsSync(chemin)) { fiche.verdict = "trace absente"; fiche.detail = r.trace.fichier + " n'existe pas"; return fiche; }
      const lignes = fs.readFileSync(chemin, "utf8").trim().split("\n").filter(Boolean);
      fiche.entrees_total = lignes.length;
      for (let i = lignes.length - 1; i >= 0 && !derniere; i--) {
        try {
          const t = new Date(JSON.parse(lignes[i])[r.trace.champ_temps || "t"]);
          if (!Number.isNaN(+t)) derniere = t;
        } catch { /* ligne illisible : on remonte */ }
      }
    } else if (r.trace.type === "git") {
      const iso = git(["log", "--all", "-1", "--format=%aI", "--", r.trace.chemin]);
      if (iso) derniere = new Date(iso);
      fiche.chemin = r.trace.chemin;
    } else {
      fiche.verdict = "invérifiable";
      fiche.detail = "cette routine ne laisse aucune trace dans le dépôt ; sans outils mcp__* la revue ne peut pas se prononcer";
      return fiche;
    }

    if (!derniere) { fiche.verdict = "trace absente"; return fiche; }
    fiche.derniere_trace = derniere.toISOString();
    fiche.age_h = Math.round(((maintenant - derniere) / 3600000) * 10) / 10;
    const seuil = r.fraicheur_max_h;
    fiche.seuil_h = seuil ?? null;
    fiche.verdict = seuil == null ? "sans seuil" : fiche.age_h > seuil ? "PÉRIMÉE" : "à jour";
    return fiche;
  });

  return {
    present: true,
    total: fiches.length,
    perimees: fiches.filter((x) => x.verdict === "PÉRIMÉE").map((x) => x.nom),
    inverifiables: fiches.filter((x) => x.verdict === "invérifiable").map((x) => x.nom),
    fiches,
  };
}

// ---------------------------------------------------------------- registre

function registre() {
  const f = path.join(__dirname, "registre.json");
  if (!fs.existsSync(f)) return { present: false };
  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    const items = j.ameliorations || [];
    const parEtat = {};
    for (const it of items) parEtat[it.etat] = (parEtat[it.etat] || 0) + 1;
    return {
      present: true,
      total: items.length,
      par_etat: parEtat,
      a_appliquer: items.filter((i) => i.etat === "approuvee").map((i) => ({ id: i.id, titre: i.titre, portee: i.portee })),
      en_attente: items.filter((i) => i.etat === "proposee").map((i) => ({ id: i.id, titre: i.titre, gravite: i.gravite, propose_le: i.propose_le })),
    };
  } catch (e) {
    return { present: true, erreur: String(e.message || e) };
  }
}

/** Revues des jours précédents : sert à repérer ce qui traîne d'un jour à l'autre. */
function revuesPrecedentes(jour, n = 7) {
  const base = path.join(__dirname, "jour");
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < jour)
    .sort().reverse().slice(0, n)
    .map((d) => ({ jour: d, revue: fs.existsSync(path.join(base, d, "revue.md")) ? "revue/jour/" + d + "/revue.md" : null }));
}

// ---------------------------------------------------------------- principal

(async function main() {
  const args = process.argv.slice(2);
  const sansReseau = args.includes("--sans-reseau");
  const jour = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || jourLocal();
  const f = fenetre(jour);

  // Sans fetch, `git log --all` ne voit que les branches déjà présentes dans ce conteneur —
  // une routine qui travaille sur sa propre branche passerait pour muette.
  if (!sansReseau) git(["fetch", "--quiet", "--all", "--prune"]);

  const commits = commitsDuJour(f);
  const collecte = {
    jour,
    fuseau: FUSEAU,
    fenetre_utc: { debut: f.debut.toISOString(), fin: f.fin.toISOString(), decalage_minutes: f.decalage },
    genere_le: new Date().toISOString(),
    branches_connues: git(["branch", "-r", "--format=%(refname:short)"]).split("\n").filter(Boolean),
    git: {
      commits: commits.length,
      lignes_ajoutees: commits.reduce((s, c) => s + c.ajouts, 0),
      lignes_retirees: commits.reduce((s, c) => s + c.retraits, 0),
      par_branche: branchesTouchees(commits),
      liste: commits,
      tete_main: git(["rev-parse", "--short", "origin/main"]) || null,
    },
    facebook: backlogFacebook(f, jour),
    routines: etatRoutines(new Date()),
    sante: sansReseau ? { saute: true } : await santeServices(),
    registre: registre(),
    revues_precedentes: revuesPrecedentes(jour),
    non_collecte: [
      "Statut déclaré des routines (last_run) : MCP list_triggers, indisponible dans une session de Routine — la section routines ci-dessus juge sur la trace, pas sur le statut.",
      "Sessions Claude du jour : MCP list_sessions, indisponible dans une session de Routine — leur trace exploitable est faite de commits, branches et artefacts.",
      "Conversations Missive : node missive_client.js — l'agent le fait.",
      "Journaux Render : aucune RENDER_API_KEY dans l'environnement, seules les sondes HTTP ci-dessus sont possibles.",
    ],
  };

  const dossier = path.join(__dirname, "jour", jour);
  fs.mkdirSync(dossier, { recursive: true });
  const sortie = path.join(dossier, "collecte.json");
  fs.writeFileSync(sortie, JSON.stringify(collecte, null, 1));

  const l = [];
  l.push("Revue " + jour + " (" + FUSEAU + ") — fenêtre " + f.debut.toISOString() + " → " + f.fin.toISOString());
  l.push("Git : " + collecte.git.commits + " commits, +" + collecte.git.lignes_ajoutees + "/-" + collecte.git.lignes_retirees +
    ", branches : " + (Object.keys(collecte.git.par_branche).join(", ") || "aucune"));
  if (collecte.facebook.presents) {
    l.push("Facebook : " + collecte.facebook.total_publiees + " réponses publiées (" + collecte.facebook.total_non_confirmees + " non confirmées chez Meta)");
    for (const [t, ft] of Object.entries(collecte.facebook.tirs)) {
      l.push("  tir " + t + " (" + ft.page + ") : " + ft.publiees + " publiées, " + ft.ecartes_du_jour +
        " écartés, heures creuses : " + (ft.heures_sans_publication.join(",") || "aucune"));
    }
  }
  const rt = collecte.routines;
  if (rt && rt.present && rt.fiches) {
    l.push("Routines : " + rt.total + " suivies — périmées : " + (rt.perimees.join(", ") || "aucune") +
      " ; invérifiables sans mcp__* : " + (rt.inverifiables.join(", ") || "aucune"));
    for (const x of rt.fiches) l.push("  " + (x.verdict === "PÉRIMÉE" ? "!! " : "   ") + x.nom + " : " + x.verdict + (x.age_h != null ? " (" + x.age_h + " h)" : ""));
  }
  if (!sansReseau) for (const s of collecte.sante) l.push("Santé " + s.service + " : " + (s.ok ? "ok" : "ÉCHEC") + " " + (s.statut ?? "") + " " + s.ms + " ms " + (s.erreur || ""));
  const r = collecte.registre;
  if (r.present) l.push("Registre : " + r.total + " items — " + JSON.stringify(r.par_etat) + " ; à appliquer : " + ((r.a_appliquer || []).map((x) => x.id).join(", ") || "aucun"));
  l.push("Écrit : " + path.relative(RACINE, sortie));
  console.log(l.join("\n"));
})().catch((e) => { console.error("collecte.js a échoué :", e); process.exit(1); });
