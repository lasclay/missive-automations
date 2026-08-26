#!/usr/bin/env node
/**
 * Les écrans de réglages, exercés en vrai — serveur démarré, session ouverte, routes appelées.
 *
 * Pourquoi celui-ci existe : l'écran d'expédition renvoyait vers « Réglages ▸ Types de
 * colis » quand un colis n'avait pas de dimensions. Cet écran n'existait pas, et rien ne
 * l'avait signalé — aucun contrôle ne vérifiait qu'un endroit nommé par l'interface existe.
 * Les emplacements d'expédition avaient le même trou : lisibles, jamais modifiables, alors
 * que le transporteur exige désormais un contact joignable à la réservation.
 *
 * Le contrôle porte donc sur le chemin complet : la route répond, elle écrit, elle relit ce
 * qu'elle a écrit, et elle refuse ce qu'elle doit refuser. Une base jetable, aucun réseau
 * sortant, aucune dépense.
 *
 * Usage : node shipstation-clone/verifier_reglages.js
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let ok = 0, ko = 0;
const verifier = (nom, cond, detail = "") => {
  console.log(`  ${cond ? V : X} ${nom}${detail ? `  ${G}${detail}${R}` : ""}`);
  cond ? ok++ : ko++;
};

const BASE_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "clone-reglages-")), "essai.db");
const PORT = 8600 + (process.pid % 300);
const URL = `http://127.0.0.1:${PORT}`;
let serveur = null;
const arreter = () => { try { serveur && serveur.kill(); } catch { /* déjà mort */ } };
process.on("exit", arreter);

(async () => {
  // Le compte de service est créé AVANT le démarrage : le serveur ouvre la base au premier
  // appel, et deux processus qui l'initialisent en même temps se marchent dessus.
  process.env.CLONE_DB = BASE_DB;
  const auth = require("./lib/auth");
  const MDP = "Essai-Reglages-2026!";
  const compte = auth.creerCompte({ name: "Contrôle", email: "controle@essai.test",
    role: "admin", motDePasse: MDP });
  verifier("compte de service créé", !!compte && !!compte.id);

  serveur = spawn(process.execPath, ["app/server.js"], {
    cwd: __dirname,
    env: { ...process.env, CLONE_DB: BASE_DB, PORT: String(PORT), CLONE_ALLOW_LABELS: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const journal = [];
  serveur.stdout.on("data", (d) => journal.push(String(d)));
  serveur.stderr.on("data", (d) => journal.push(String(d)));

  // Attendre que le serveur réponde plutôt que de dormir un temps arbitraire : une pause
  // fixe est trop courte sur une machine chargée et trop longue partout ailleurs.
  let vivant = false;
  for (let n = 0; n < 80 && !vivant; n++) {
    try { await fetch(`${URL}/api/config`); vivant = true; }
    catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  if (!vivant) { console.error("le serveur n'a pas démarré :\n" + journal.join("")); process.exit(1); }
  verifier("le serveur répond", vivant, URL);

  let cookie = "";
  const appel = async (chemin, opts = {}) => {
    const r = await fetch(`${URL}${chemin}`, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const c = r.headers.get("set-cookie");
    if (c) cookie = c.split(";")[0];
    let j = null; try { j = await r.json(); } catch { /* pas de corps JSON */ }
    return { statut: r.status, corps: j || {} };
  };

  console.log("\nAccès\n" + "─".repeat(64));
  const anonyme = await appel("/api/packages");
  verifier("sans session, les réglages sont fermés", anonyme.statut === 401, `HTTP ${anonyme.statut}`);

  const connexion = await appel("/api/login", { method: "POST",
    body: { email: "controle@essai.test", password: MDP } });
  verifier("connexion acceptée", connexion.statut === 200 && !!cookie, connexion.corps.error || "");

  console.log("\nTypes de colis\n" + "─".repeat(64));
  const liste = await appel("/api/packages");
  verifier("la route existe et répond", liste.statut === 200 && Array.isArray(liste.corps.packages),
    `${(liste.corps.packages || []).length} type(s)`);

  const cree = await appel("/api/packages", { method: "POST",
    body: { name: "Pochette d'essai", length: 12, width: 9, height: 0.5 } });
  verifier("un type se crée", cree.statut === 200 && !!cree.corps.id, cree.corps.id || cree.corps.error);

  const apres = (await appel("/api/packages")).corps.packages.find((p) => p.id === cree.corps.id);
  verifier("ses dimensions sont relues telles qu'écrites",
    apres && apres.dimensions.length === 12 && apres.dimensions.width === 9 && apres.dimensions.height === 0.5,
    apres ? JSON.stringify(apres.dimensions) : "introuvable");
  verifier("l'unité est le pouce, comme les champs de l'écran", apres.dimensions.unit === "in");

  const renomme = await appel("/api/packages", { method: "POST",
    body: { id: cree.corps.id, name: "Pochette corrigée", length: 12, width: 9, height: 1 } });
  const relu = (await appel("/api/packages")).corps.packages.find((p) => p.id === cree.corps.id);
  verifier("modifier garde le même identifiant",
    renomme.corps.id === cree.corps.id && relu.name === "Pochette corrigée",
    "les commandes déjà expédiées le portent");

  // Zéro est une mesure : une cotation sur 0 × 0 × 0 rend un prix qui n'a rien à voir.
  const vide = await appel("/api/packages", { method: "POST",
    body: { name: "Sans mesure", length: 0, width: 0, height: 0 } });
  const videRelu = (await appel("/api/packages")).corps.packages.find((p) => p.id === vide.corps.id);
  verifier("un type sans mesure reste sans dimensions, pas à zéro",
    videRelu.dimensions === null, JSON.stringify(videRelu.dimensions));

  const sansNom = await appel("/api/packages", { method: "POST", body: { name: "  " } });
  verifier("un type sans nom est refusé", sansNom.statut === 400, sansNom.corps.error);

  const supprime = await appel(`/api/packages/${cree.corps.id}`, { method: "DELETE" });
  verifier("un type inutilisé se supprime", supprime.statut === 200);
  verifier("et disparaît de la liste",
    !(await appel("/api/packages")).corps.packages.some((p) => p.id === cree.corps.id));

  console.log("\nEmplacements d'expédition\n" + "─".repeat(64));
  const emp = await appel("/api/warehouses");
  verifier("la route existe et répond", emp.statut === 200 && Array.isArray(emp.corps.warehouses),
    `${(emp.corps.warehouses || []).length} emplacement(s)`);

  const cible = (emp.corps.warehouses || [])[0];
  verifier("l'adresse d'origine est rendue lue, pas en JSON brut",
    !!cible && typeof cible.origin_address === "object");

  const maj = await appel(`/api/warehouses/${cible.id}`, { method: "POST",
    body: { name: cible.name, origin_address: { phone: "5819825857", email: "expedition@essai.test" } } });
  verifier("le contact s'enregistre", maj.statut === 200, maj.corps.error || "");

  const empRelu = (await appel("/api/warehouses")).corps.warehouses.find((w) => String(w.id) === String(cible.id));
  verifier("téléphone et courriel sont relus",
    empRelu.origin_address.phone === "5819825857" && empRelu.origin_address.email === "expedition@essai.test");
  // Le formulaire n'envoie que ce qu'il montre : le reste de l'adresse ne doit pas disparaître.
  verifier("les champs non envoyés survivent",
    empRelu.origin_address.street1 === cible.origin_address.street1,
    empRelu.origin_address.street1 || "perdu");

  const inconnu = await appel("/api/warehouses/999999", { method: "POST", body: { name: "X" } });
  verifier("un emplacement inconnu est refusé", inconnu.statut === 404);

  console.log("\nCoordonnées de repli\n" + "─".repeat(64));
  const reg = await appel("/api/settings", { method: "POST",
    body: { expediteur_contact: "Gabriel", expediteur_telephone: "5819825857",
      expediteur_courriel: "repli@essai.test" } });
  verifier("les trois réglages sont acceptés", reg.statut === 200, reg.corps.error || "");
  const relus = (await appel("/api/settings")).corps;
  verifier("et relus par l'écran", relus.expediteur_courriel === "repli@essai.test");

  const interdit = await appel("/api/settings", { method: "POST", body: { chemin_de_la_base: "/etc/passwd" } });
  verifier("un réglage hors liste blanche est refusé", interdit.statut === 400, interdit.corps.error);

  arreter();
})().then(() => {
  console.log("\n" + "─".repeat(64));
  console.log(ko ? `${X} ${ko} contrôle(s) en échec sur ${ok + ko}` : `${V} ${ok}/${ok} contrôles passés`);
  process.exit(ko ? 1 : 0);
}).catch((e) => { arreter(); console.error("\nÉCHEC :", e.message); process.exit(1); });
