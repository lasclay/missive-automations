#!/usr/bin/env node
// Moteur d'envoi de la campagne de prospection des points de vente.
//
//   node retail-expansion/envoyer.js --essai            aperçu, n'envoie rien
//   node retail-expansion/envoyer.js --brouillons N     crée N brouillons dans Missive
//   node retail-expansion/envoyer.js --envoyer N        envoie N courriels
//
// À lancer depuis la racine du dépôt: le client Missive y vit.
//
// Garde-fous, dans cet ordre:
//   1. plafond quotidien, jamais dépassé quoi qu'on lui demande
//   2. un seul commerce par zone en cours de discussion à la fois
//   3. arrêt complet si le taux de rebond dépasse le seuil
//   4. l'état est écrit après CHAQUE envoi, pas à la fin: une interruption
//      ne peut pas provoquer de double envoi

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const FILE = path.join(__dirname, 'file_attente.json');
const JOURNAL = path.join(__dirname, 'journal_envois.json');

const EXPEDITEUR = 'admin@lasclay.com';
const PLAFOND_JOUR = 75;          // consigne de Gabriel: 50 à 75 par jour maximum
// Exception autorisée explicitement pour la première vague, que Gabriel a
// demandé d'envoyer d'un coup: 124 messages, un par zone. Ça reste sous la
// limite Workspace de 2000 par jour. Le drapeau ne sert qu'une fois.
const PLAFOND_VAGUE_INITIALE = 130;
const SEUIL_REBOND = 0.03;        // 3 % sur les 50 derniers envois
const DELAI_MIN = 4000;           // espacement entre deux envois, en ms
const DELAI_MAX = 11000;

const LEGAL_FR = 'Les Produits Lasclay inc., 298 boulevard des Capucins, 2e étage, Québec (Québec) G1J 3R4, 581 982-5857.';
const LEGAL_EN = 'Les Produits Lasclay inc., 298 boulevard des Capucins, 2nd floor, Quebec City, QC G1J 3R4, 581 982-5857.';

// ---------------------------------------------------------------- rédaction
function messageFR(f) {
  // jamais le nom de zone: « Banff et Canmore » dans une phrase anglaise,
  // c'est mon etiquette interne, pas un lieu que le destinataire reconnait
  const ville = f.ville || f.ancre || f.zone.split(' – ')[0];
  return {
    subject: `Une place pour Lasclay chez ${f.nom}?`,
    body: `Bonjour,

Je m'appelle Gabriel Gouveia et je dirige Lasclay, une entreprise de Québec qui transforme la soie d'asclépiade en isolant, pour des produits d'hiver et des produits isothermes.

Je vous écris parce qu'on ouvre un réseau de points de vente et qu'on ne retient qu'une boutique par région. ${ville} fait partie des endroits qu'on veut couvrir, et ${f.nom} ressemble à ce qu'on cherche: un commerce indépendant, où les gens ressortent en sachant d'où vient ce qu'ils ont acheté.

Comment ça marche: les produits sont en consignation. Vous n'avancez rien, on garde la propriété du stock jusqu'à la vente, et ce qui ne part pas nous revient. Ce que vous engagez, c'est de la tablette et l'attention de votre monde. En retour, vous êtes le seul détaillant Lasclay de votre région.

Pour commencer, je propose les produits sans tailles et sans saison: sacs à lunch, glacières souples, manchons isothermes, et les sachets de semences d'asclépiade. Les semences se vendent quelques dollars et ce sont souvent elles qui lancent la conversation en magasin.

Sur la matière, en deux phrases: l'asclépiade est la seule plante où le monarque pond ses oeufs, et sa soie est creuse et hydrophobe, ce qui en fait un bon isolant. On l'achète à des producteurs québécois et on la transforme dans notre atelier de Limoilou. L'assemblage de la plupart des produits finis se fait ailleurs, surtout en Tunisie, et c'est ce qui nous permet de tenir des prix accessibles. Je préfère vous le dire tout de suite: vous aurez la question en magasin, aussi bien l'avoir en main.

Si ça vaut une conversation, proposez-moi un moment qui vous convient d'ici deux semaines et je vous appelle. Je m'adapte, sauf empêchement majeur, en essayant d'éviter le vendredi.

Le catalogue est sur lasclay.com si vous voulez voir à quoi ça ressemble avant.

---
${LEGAL_FR}
Vous recevez ce message parce que ${f.nom} est un commerce de détail dont l'adresse courriel est publiée publiquement. Répondez « retirez-moi » et je ne vous réécris plus.`,
  };
}

function messageEN(f) {
  // jamais le nom de zone: « Banff et Canmore » dans une phrase anglaise,
  // c'est mon etiquette interne, pas un lieu que le destinataire reconnait
  const ville = f.ville || f.ancre || f.zone.split(' – ')[0];
  return {
    subject: `Room for Lasclay at ${f.nom}?`,
    body: `Hello,

I'm Gabriel Gouveia, and I run Lasclay, a company based in Quebec City that turns milkweed floss into insulation for winter gear and insulated bags.

I'm writing because we're building a retail network and we take on one store per region. ${ville} is on our list, and ${f.nom} looks like what we're after: an independent shop, the kind where people leave knowing where the thing they bought came from.

How it works: the products go on consignment. You pay nothing up front, we keep ownership of the stock until it sells, and whatever doesn't move comes back to us. What you put in is shelf space and your staff's attention. In return, you're the only Lasclay retailer in your region.

To start, I'd suggest the products with no sizing and no season: lunch bags, soft coolers, can sleeves, and packets of milkweed seed. The seed sells for a few dollars, and it's usually what starts the conversation in the store.

On the material, briefly: milkweed is the only plant monarchs lay their eggs on, and its floss is hollow and water repellent, which makes it a good insulator. We buy it from Quebec growers and process it in our Limoilou workshop. Most finished products are assembled elsewhere, mainly in Tunisia, which is how we keep prices reasonable. I'd rather tell you now: you'll get that question at the counter, so you may as well have the answer.

If this is worth a conversation, suggest a time that suits you in the next two weeks and I'll call. I can work around most things, and I try to keep Fridays clear.

The catalogue is at lasclay.com/en if you'd like to see it first.

---
${LEGAL_EN}
You're receiving this because ${f.nom} is a retail business with a publicly listed email address. Reply "remove me" and I won't write again.`,
  };
}

const relanceFR = (f) => ({
  subject: `Re: Une place pour Lasclay chez ${f.nom}?`,
  body: `Bonjour,

Je reviens sur mon message de la semaine dernière.

Le résumé en trois lignes: produits en consignation, donc aucun déboursé de votre part; exclusivité pour ${f.zone}; on commence par les sacs à lunch, les glacières et les semences d'asclépiade.

Si ce n'est pas le bon moment, dites-le moi et je vous laisse tranquille. Si c'est plutôt une question de détail (marges, réassort, retour des invendus), posez-la, j'y réponds directement.

---
${LEGAL_FR}
Répondez « retirez-moi » et je ne vous réécris plus.`,
});

const relanceEN = (f) => ({
  subject: `Re: Room for Lasclay at ${f.nom}?`,
  body: `Hello,

Following up on last week's message.

Three lines: consignment, so nothing out of pocket for you; exclusivity for ${f.zone}; we start with lunch bags, coolers and milkweed seed.

If the timing is wrong, say so and I'll leave it there. If it's a question of detail (margins, restocking, returns on what doesn't sell), ask and I'll answer.

---
${LEGAL_EN}
Reply "remove me" and I won't write again.`,
});

function rediger(f) {
  if (f.etat === 'envoye') return f.langue === 'FR' ? relanceFR(f) : relanceEN(f);
  return f.langue === 'FR' ? messageFR(f) : messageEN(f);
}

// ------------------------------------------------------------------- envoi
function missive(payload) {
  return new Promise((resolve, reject) => {
    const p = execFile('node', ['missive_client.js', 'send'], { cwd: RACINE, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || err.message).slice(0, 400)));
        try { resolve(JSON.parse(stdout)); } catch { resolve({ brut: stdout.slice(0, 300) }); }
      });
    p.stdin.end(JSON.stringify(payload));
  });
}

const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const auHasard = (a, b) => a + Math.floor(Math.random() * (b - a));
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function lireJournal() {
  try { return JSON.parse(fs.readFileSync(JOURNAL, 'utf8')); } catch { return []; }
}

// ------------------------------------------------------------------ selection
// Un commerce par zone a la fois: la regle d'exclusivite perdrait son sens si on
// courtisait le rang 1 et le rang 2 d'une meme region en parallele.
function lot(file, taille) {
  const enCours = new Set(file.filter(f => ['envoye', 'relance', 'repondu'].includes(f.etat)).map(f => f.zone));
  const candidats = file
    .filter(f => f.canal === 'courriel' && f.etat === 'en_attente' && f.courriel)
    .filter(f => !enCours.has(f.zone))
    .sort((a, b) => a.vague - b.vague || a.rang - b.rang);
  return candidats.slice(0, taille);
}

// Les relances partent huit jours apres le premier message, sans reponse recue.
function lotRelances(file, taille) {
  const limite = Date.now() - 8 * 86400000;
  return file
    .filter(f => f.etat === 'envoye' && !f.repondu_le && !f.relance_le)
    .filter(f => f.envoye_le && Date.parse(f.envoye_le) <= limite)
    .slice(0, taille);
}

(async () => {
  const args = process.argv.slice(2);
  const mode = args.includes('--envoyer') ? 'envoyer'
    : args.includes('--brouillons') ? 'brouillons' : 'essai';
  const demande = parseInt(args[args.indexOf(`--${mode}`) + 1] || '0', 10) || PLAFOND_JOUR;

  const file = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const journal = lireJournal();

  // garde-fou 3: on regarde le taux de rebond avant de toucher a quoi que ce soit
  const derniers = journal.filter(j => j.action === 'envoye').slice(-50);
  const rebonds = file.filter(f => f.etat === 'rebond').length;
  if (derniers.length >= 20) {
    const taux = rebonds / derniers.length;
    if (taux > SEUIL_REBOND) {
      console.log(`ARRET: taux de rebond ${(taux * 100).toFixed(1)} %, au-dessus du seuil de ${SEUIL_REBOND * 100} %.`);
      console.log('Rien n\'a ete envoye. Il faut revoir la liste avant de continuer.');
      process.exit(2);
    }
  }

  // garde-fou 1: le plafond quotidien prime sur ce qu'on demande
  const vagueInitiale = args.includes('--vague-initiale');
  const plafond = vagueInitiale ? PLAFOND_VAGUE_INITIALE : PLAFOND_JOUR;
  const dejaAujourdhui = journal.filter(j => j.date === aujourdhui() && j.action !== 'brouillon').length;
  const place = Math.max(0, plafond - dejaAujourdhui);
  const taille = Math.min(demande, place);
  if (taille <= 0) {
    console.log(`Plafond du jour atteint (${dejaAujourdhui}/${plafond}). Rien de plus aujourd'hui.`);
    process.exit(0);
  }

  const relances = lotRelances(file, taille);
  const premiers = lot(file, taille - relances.length);
  const cible = [...relances, ...premiers];

  if (!cible.length) {
    console.log('Rien a envoyer: la file est vide ou tout est en attente de reponse.');
    process.exit(0);
  }

  console.log(`Mode ${mode} | ${cible.length} message(s) | ${relances.length} relance(s), ${premiers.length} premier(s) contact(s)`);
  if (mode === 'essai') {
    for (const f of cible.slice(0, 3)) {
      const m = rediger(f);
      console.log(`\n--- ${f.nom} (${f.zone}) -> ${f.courriel} [${f.langue}]`);
      console.log(`Objet: ${m.subject}`);
      console.log(m.body.split('\n').slice(0, 4).join('\n') + '\n[...]');
    }
    console.log(`\n(${cible.length} au total; --envoyer N pour partir, --brouillons N pour deposer dans Missive)`);
    process.exit(0);
  }

  let faits = 0, echecs = 0;
  for (const f of cible) {
    const m = rediger(f);
    const relance = f.etat === 'envoye';
    try {
      const res = await missive({
        from: EXPEDITEUR,
        to: [f.courriel],
        subject: m.subject,
        body: m.body,
        send: mode === 'envoyer',
      });
      const idConv = (res && (res.drafts?.conversation || res.conversation)) || '';
      if (mode === 'envoyer') {
        if (relance) { f.etat = 'relance'; f.relance_le = new Date().toISOString(); }
        else { f.etat = 'envoye'; f.envoye_le = new Date().toISOString(); }
      } else {
        f.note = (f.note ? f.note + ' ' : '') + 'brouillon depose ' + aujourdhui();
      }
      if (idConv) f.conversation = idConv;
      journal.push({ date: aujourdhui(), horodatage: new Date().toISOString(), id: f.id,
        courriel: f.courriel, action: mode === 'envoyer' ? (relance ? 'relance' : 'envoye') : 'brouillon' });
      faits++;
      console.log(`  ${faits}/${cible.length}  ${f.nom.slice(0, 34).padEnd(36)} ${f.courriel}`);
    } catch (e) {
      echecs++;
      f.note = (f.note ? f.note + ' ' : '') + 'echec envoi: ' + e.message.slice(0, 120);
      journal.push({ date: aujourdhui(), horodatage: new Date().toISOString(), id: f.id,
        courriel: f.courriel, action: 'echec', erreur: e.message.slice(0, 200) });
      console.error(`  ECHEC ${f.nom}: ${e.message.slice(0, 120)}`);
      if (echecs >= 3 && faits === 0) {
        console.error('Trois echecs d\'affilee sans un seul succes: on arrete la.');
        break;
      }
    }
    // garde-fou 4: on ecrit apres chaque message, jamais a la fin
    fs.writeFileSync(FILE, JSON.stringify(file, null, 1));
    fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 1));
    if (faits + echecs < cible.length) await attendre(auHasard(DELAI_MIN, DELAI_MAX));
  }

  const restants = file.filter(f => f.canal === 'courriel' && f.etat === 'en_attente').length;
  console.log(`\nFait: ${faits} | echecs: ${echecs} | restants en file: ${restants}`);
})();
