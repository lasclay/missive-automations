/**
 * Outil d'administration en ligne de commande — à lancer depuis le shell du service.
 *
 *   node shipstation-clone/admin.js comptes
 *   node shipstation-clone/admin.js motdepasse <courriel> [nouveau]
 *   node shipstation-clone/admin.js creer <courriel> "<nom>" [role]
 *   node shipstation-clone/admin.js 2fa-reset <courriel>
 *   node shipstation-clone/admin.js activer <courriel> | desactiver <courriel>
 *   node shipstation-clone/admin.js sessions <courriel>
 *
 * Sert quand personne ne peut plus entrer par l'interface : mot de passe perdu, second
 * facteur bloqué, compte désactivé par erreur. Il touche directement la base — donc il exige
 * un accès au serveur, ce qui est la bonne barrière.
 */
const db = require("./lib/db");
const auth = require("./lib/auth");
const accounts = require("./lib/accounts");

const [cmd, ...args] = process.argv.slice(2);
const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const vert = (s) => `\x1b[32m${s}\x1b[0m`;

function trouver(courriel) {
  const u = db.one("SELECT * FROM users WHERE lower(email) = lower(?)", String(courriel || "").trim());
  if (!u) {
    console.error(`Aucun compte pour « ${courriel} ».`);
    console.error(gris("  node shipstation-clone/admin.js comptes   pour voir la liste"));
    process.exit(1);
  }
  return u;
}

/** Affiche un secret de façon copiable : seul sur sa ligne, sans remplissage. */
function secret(etiquette, valeur) {
  console.log(`\n  ${etiquette} :`);
  console.log(`\n${valeur}\n`);
  console.log(gris("  (à copier tel quel — attention à ne pas emporter d'espace)"));
}

db.db();

switch (cmd) {
  case "comptes": {
    const rows = db.all(`SELECT name, email, active, totp_enabled, must_change,
        (password_hash IS NOT NULL) AS a_mdp, permissions FROM users ORDER BY name`);
    if (!rows.length) { console.log("Aucun compte."); break; }
    console.log();
    for (const u of rows) {
      const perms = db.parse(u.permissions, {});
      console.log(` ${u.active ? vert("●") : gris("○")} ${u.name}  ${gris(u.email)}`);
      console.log(gris(`     rôle ${perms.role || "?"} · mot de passe ${u.a_mdp ? "oui" : "NON"}` +
        ` · 2FA ${u.totp_enabled ? "actif" : "non"}${u.must_change ? " · provisoire" : ""}`));
    }
    console.log();
    break;
  }

  case "motdepasse": {
    const u = trouver(args[0]);
    const nouveau = args[1] || auth.suggerer();
    const souci = auth.valider(nouveau);
    if (souci) { console.error(`Refusé : ${souci}.`); process.exit(1); }
    auth.changerMotDePasse(u.id, nouveau, { parAdmin: true });
    db.run("DELETE FROM sessions WHERE user_id = ?", u.id);
    console.log(`\nMot de passe remplacé pour ${u.name} <${u.email}>.`);
    console.log(gris("Ses sessions ouvertes ont été fermées. À changer à la prochaine connexion."));
    if (!args[1]) secret("Nouveau mot de passe", nouveau);
    break;
  }

  case "creer": {
    const [courriel, nom, role = "preparateur"] = args;
    if (!courriel || !nom) { console.error('Usage : creer <courriel> "<nom>" [role]'); process.exit(1); }
    if (!accounts.ROLES[role]) {
      console.error(`Rôle inconnu. Disponibles : ${Object.keys(accounts.ROLES).join(", ")}`);
      process.exit(1);
    }
    const r = auth.creerCompte({ name: nom, email: courriel, role });
    console.log(`\nCompte créé : ${nom} <${courriel}> — rôle ${role}.`);
    secret("Mot de passe provisoire", r.motDePasse);
    break;
  }

  case "2fa-reset": {
    const u = trouver(args[0]);
    auth.reinitialiser2facteur(u.id, "cli");
    console.log(`\nSecond facteur retiré pour ${u.name}. Ses sessions sont fermées.`);
    console.log(gris("Il devra le reconfigurer à sa prochaine connexion."));
    break;
  }

  case "activer":
  case "desactiver": {
    const u = trouver(args[0]);
    const actif = cmd === "activer" ? 1 : 0;
    db.run("UPDATE users SET active = ? WHERE id = ?", actif, u.id);
    if (!actif) db.run("DELETE FROM sessions WHERE user_id = ?", u.id);
    db.journaliser(`user.${cmd}`, "user", u.id, null);
    console.log(`${u.name} ${actif ? "réactivé" : "désactivé"}.`);
    break;
  }

  case "sessions": {
    const u = trouver(args[0]);
    const s = auth.sessionsDe(u.id);
    if (!s.length) { console.log("Aucune session ouverte."); break; }
    console.log();
    for (const x of s) {
      console.log(` ${String(x.created_at).slice(0, 19).replace("T", " ")}  ${gris(x.ip || "—")}`);
      console.log(gris(`     expire ${String(x.expires_at).slice(0, 19).replace("T", " ")} · ${String(x.agent || "").slice(0, 60)}`));
    }
    console.log();
    break;
  }

  default:
    console.log(`
Outil d'administration du service.

  comptes                              liste les comptes et leur état
  motdepasse <courriel> [nouveau]      remplace le mot de passe (généré si omis)
  creer <courriel> "<nom>" [role]      crée un compte — rôles : ${Object.keys(accounts.ROLES).join(", ")}
  2fa-reset <courriel>                 retire le second facteur (téléphone perdu)
  activer / desactiver <courriel>      (dés)active un compte
  sessions <courriel>                  sessions ouvertes

Base : ${db.CHEMIN}
`);
    process.exit(cmd ? 1 : 0);
}
