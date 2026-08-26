#!/usr/bin/env node
/**
 * Le bouton « Créer + imprimer l'étiquette » suit-il l'écran ?
 *
 * Le défaut qu'on vérifie ici : on choisissait un service et un colis, les deux menus
 * affichaient le bon choix, le serveur les avait enregistrés — et le bouton restait gris
 * sous « Il manque : aucun service choisi ; aucun type de colis choisi ». La décision
 * d'achat relisait la commande telle qu'elle était à l'ouverture de la fiche. Il fallait
 * refermer et rouvrir pour pouvoir acheter.
 *
 * Ce contrôle sort `etatAchat`, `entrepotResolu` et `majAchat` du fichier unique et les
 * joue contre un DOM de papier. Pas de navigateur : ce sont trois fonctions pures d'un
 * côté, quatre champs de l'autre. Le reste de l'interface n'a rien à voir avec la question.
 *
 * Usage : node shipstation-clone/verifier_achat.js
 */
const fs = require("fs");
const path = require("path");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let ok = 0, ko = 0;
const verifier = (nom, cond, detail = "") => {
  console.log(`  ${cond ? V : X} ${nom}${detail ? `  ${G}${detail}${R}` : ""}`);
  cond ? ok++ : ko++;
};

const SRC = fs.readFileSync(path.join(__dirname, "app", "public", "index.html"), "utf8");

/** Le corps d'une déclaration, accolades comptées — pas de regex sur du code imbriqué. */
function extraire(entete) {
  const d = SRC.indexOf(entete);
  if (d < 0) throw new Error(`introuvable dans index.html : ${entete}`);
  let i = SRC.indexOf("{", d), n = 0;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === "{") n++;
    else if (SRC[j] === "}") { n--; if (!n) return SRC.slice(d, j + 1); }
  }
  throw new Error(`accolade non refermée : ${entete}`);
}

// --------------------------------------------------------------------- DOM de papier
/** Un champ : une valeur, et rien d'autre — c'est tout ce que `majAchat` lui demande. */
const ecran = {};
const poser = (id, valeur) => { ecran[id] = { value: valeur }; };
const bouton = { disabled: true, title: "" };
const bandeau = { hidden: false, innerHTML: "" };

const contexte = {
  $: (sel) => (sel === "#cAcheter" ? bouton
    : sel === "#cRaisonM" || sel === "#cRaisonP" ? bandeau
    : ecran[sel] || null),
  esc: (x) => String(x),
  STATUT_FR: { shipped: "Expédiée", cancelled: "Annulée" },
  S: { config: { etiquettes_actives: true }, refs: { warehouses: [{ id: 7, name: "LAS", is_default: 1 }] } },
  // `majAchat` prend la racine du DOM par défaut ; ici, le DOM de papier tient dans `ecran`.
  document: null,
};

const code = [extraire("function etatAchat(o = null) {"),
  extraire("function entrepotResolu(o) {"),
  extraire("const CHAMPS_ACHAT = {"),
  extraire("function majAchat(o, ou, racine = document) {")].join("\n");

const monter = new Function("ctx", `const {$, esc, STATUT_FR, S, document} = ctx;\n${code}\nreturn { etatAchat, majAchat, CHAMPS_ACHAT };`);
const { etatAchat, majAchat, CHAMPS_ACHAT } = monter(contexte);

console.log("\nÉtat du bouton d'achat");
console.log("─".repeat(64));

// --------------------------------------------------------------- la décision elle-même
const base = { status: "awaiting_shipment", weight_g: 300, service_id: null, package_id: null, warehouse_id: 7 };

verifier("commande nue : le refus énumère les deux manques",
  (() => { const e = etatAchat(base);
    return !e.ok && e.manques.includes("aucun service choisi") && e.manques.includes("aucun type de colis choisi"); })());

verifier("commande complète : achat permis",
  etatAchat({ ...base, service_id: "purolator_ground", package_id: "package" }).ok);

verifier("commande déjà expédiée : refusée même complète",
  !etatAchat({ ...base, status: "shipped", service_id: "s", package_id: "p" }).ok);

verifier("sans poids : refusée",
  etatAchat({ ...base, service_id: "s", package_id: "p", weight_g: 0 }).manques.includes("aucun poids saisi"));

verifier("achat désactivé sur le service : refusée quoi qu'on choisisse",
  (() => { contexte.S.config.etiquettes_actives = false;
    const e = etatAchat({ ...base, service_id: "s", package_id: "p" });
    contexte.S.config.etiquettes_actives = true;
    return !e.ok; })());

// ------------------------------------------------ la régression : l'écran contre l'objet
console.log("");
for (const [ou, c] of Object.entries(CHAMPS_ACHAT)) {
  // La commande telle qu'ouverte : rien de choisi. L'écran, lui, porte les choix.
  for (const k of Object.keys(ecran)) delete ecran[k];
  poser(c.svc, "purolator_ground");
  poser(c.pkg, "package");
  poser(c.wh, "7");
  poser(c.pds, "300");
  bouton.disabled = true; bandeau.hidden = false; bandeau.innerHTML = "Il manque : …";

  const e = majAchat(base, ou);
  verifier(`${ou} : les menus remplis suffisent, sans recharger la fiche`, e.ok,
    e.ok ? "" : e.manques.join(" ; "));
  verifier(`${ou} : le bouton se réactive`, bouton.disabled === false);
  verifier(`${ou} : le bandeau « Il manque » disparaît`, bandeau.hidden === true && bandeau.innerHTML === "");

  // Et l'inverse : vider le menu Colis à l'écran doit re-bloquer, même si la commande
  // enregistrée en portait un. Un écran qui ment dans un sens mentirait dans l'autre.
  poser(c.pkg, "");
  const e2 = majAchat({ ...base, service_id: "purolator_ground", package_id: "package" }, ou);
  verifier(`${ou} : vider le menu Colis re-bloque l'achat`,
    !e2.ok && e2.manques.includes("aucun type de colis choisi"));
  verifier(`${ou} : le motif est réécrit à l'écran`, bandeau.hidden === false && /type de colis/.test(bandeau.innerHTML));

  // Un poids effacé à l'écran bloque aussi, sans attendre l'enregistrement.
  poser(c.pkg, "package"); poser(c.pds, "");
  verifier(`${ou} : effacer le poids bloque l'achat`,
    majAchat({ ...base, weight_g: 300 }, ou).manques.includes("aucun poids saisi"));
  poser(c.pds, "300");
}

// -------------------------------------------------- les deux écrans répondent pareil
console.log("");
const commande = { ...base, service_id: "s", package_id: "p" };
const reponses = Object.entries(CHAMPS_ACHAT).map(([ou, c]) => {
  for (const k of Object.keys(ecran)) delete ecran[k];
  poser(c.svc, ""); poser(c.pkg, ""); poser(c.wh, "7"); poser(c.pds, "300");
  return JSON.stringify(majAchat(commande, ou).manques);
});
verifier("fiche et panneau refusent pour les mêmes motifs", reponses[0] === reponses[1],
  reponses[0] === reponses[1] ? "" : reponses.join("  ≠  "));

// Un écran inconnu ne doit pas inventer un accord : on retombe sur la commande.
verifier("écran inconnu : on retombe sur l'état de la commande, sans planter",
  majAchat(commande, "inexistant").ok === etatAchat(commande).ok);

console.log("\n" + "─".repeat(64));
console.log(ko ? `${X} ${ko} contrôle(s) en échec sur ${ok + ko}` : `${V} ${ok}/${ok} contrôles passés`);
process.exit(ko ? 1 : 0);
