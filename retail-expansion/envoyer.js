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
  return {
    subject: `Devenir le détaillant Lasclay de votre région`,
    body: `Bonjour,

Je m'appelle Gabriel Gouveia, je dirige Lasclay. On isole des produits d'hiver et des sacs isothermes avec de la soie d'asclépiade, la plante hôte du monarque. On l'achète à des producteurs québécois et on la transforme dans notre atelier de Limoilou.

On cherche un détaillant par région, et j'aimerais savoir si ça vous intéresse.

Ce qu'on demande: porter la gamme au complet. Mitaines, tuques, cache-cou, bandeaux, manteaux et vestes à inserts isolants amovibles, sacs à lunch, glacières souples, manchons isothermes, semences. Plus de soixante produits, l'hiver comme l'été. Les Défricheuses, à Montréal, portent tout. C'est le genre de partenariat qu'on cherche à répéter, pas un produit isolé sur un coin de tablette.

Ce qu'on offre: la consignation et l'exclusivité de votre région. Vous n'avancez rien, on garde la propriété du stock jusqu'à la vente, et les invendus nous reviennent. Ce que vous engagez, c'est de l'espace et l'attention de votre monde.

Une chose que vous aurez à répondre au comptoir, alors autant l'avoir en main: la soie est cultivée et transformée au Québec, mais l'assemblage de la plupart des produits finis se fait en Tunisie. C'est ce qui nous permet de vendre un manteau autour de 300 $ plutôt que le double.

Si ça vaut une conversation, proposez-moi un moment d'ici deux semaines et je vous appelle. J'essaie d'éviter le vendredi.

Le catalogue est sur lasclay.com.

---
${LEGAL_FR}
Vous recevez ce message parce que ${f.nom} est un commerce de détail dont l'adresse courriel est publiée publiquement. Répondez « retirez-moi » et je ne vous réécris plus.`,
  };
}

function messageEN(f) {
  return {
    subject: `Becoming the Lasclay retailer for your region`,
    body: `Hello,

I'm Gabriel Gouveia, I run Lasclay. We insulate winter gear and cooler bags with milkweed floss, the monarch butterfly's host plant. We buy it from Quebec growers and process it in our workshop in Quebec City.

We're looking for one retailer per region, and I'd like to know whether that interests you.

What we ask: carrying the full range. Mittens, toques, neck warmers, headbands, coats and vests with removable insulation, lunch bags, soft coolers, can sleeves, seed packets. Over sixty products, winter and summer. Les Défricheuses, in Montreal, carry all of it. That's the kind of partnership we're trying to repeat, not one product on a corner of a shelf.

What we offer: consignment and exclusivity for your region. You pay nothing up front, we keep ownership of the stock until it sells, and unsold items come back to us. What you commit is space and your staff's attention.

One thing you'll be asked at the counter, so you may as well have the answer: the floss is grown and processed in Quebec, but most finished products are assembled in Tunisia. That's how we sell a coat around $300 instead of double that.

If this is worth a conversation, suggest a time in the next two weeks and I'll call. I try to keep Fridays clear.

The catalogue is at lasclay.com/en.

---
${LEGAL_EN}
You're receiving this because ${f.nom} is a retail business with a publicly listed email address. Reply "remove me" and I won't write again.`,
  };
}

const relanceFR = (f) => ({
  subject: `Re: Devenir le détaillant Lasclay de votre région`,
  body: `Bonjour,

Je reviens sur mon message de l'autre semaine.

Le résumé: la gamme complète en consignation, donc aucun déboursé de votre part, et l'exclusivité de votre région. Plus de soixante produits d'hiver et d'été isolés à la soie d'asclépiade.

Si ce n'est pas le bon moment, dites-le moi et je vous laisse tranquille. Si c'est plutôt une question de détail (marges, réassort, retour des invendus), posez-la, j'y réponds directement.

---
${LEGAL_FR}
Répondez « retirez-moi » et je ne vous réécris plus.`,
});

const relanceEN = (f) => ({
  subject: `Re: Becoming the Lasclay retailer for your region`,
  body: `Hello,

Following up on the message I sent a little while back.

The short version: the full range on consignment, so nothing out of pocket for you, and exclusivity for your region. Over sixty winter and summer products insulated with milkweed floss.

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

  // garde-fou 3: taux de rebond des 50 derniers envois.
  // Le calcul comparait tous les rebonds de la campagne aux 50 derniers envois:
  // avec 1000 envois et 20 rebonds accumules, il rendait 40 % et arretait tout.
  // On ne compte que les rebonds PARMI ces 50 envois.
  const derniers = journal.filter(j => j.action === 'envoye').slice(-50);
  const enRebond = new Set(file.filter(f => f.etat === 'rebond').map(f => f.id));
  const rebonds = derniers.filter(j => enRebond.has(j.id)).length;
  if (derniers.length >= 20) {
    const taux = rebonds / derniers.length;
    if (taux > SEUIL_REBOND) {
      console.log(`ARRET: ${rebonds} rebond(s) sur les ${derniers.length} derniers envois, soit ${(taux * 100).toFixed(1)} %, au-dessus du seuil de ${SEUIL_REBOND * 100} %.`);
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
    // --apercu N: messages complets, en panachant les langues et les types,
    // pour relire ce qui va vraiment partir
    const apercu = args.includes('--apercu');
    if (apercu) {
      const n = parseInt(args[args.indexOf('--apercu') + 1] || '5', 10);
      const fr = cible.filter(f => f.langue === 'FR');
      const en = cible.filter(f => f.langue === 'EN');
      const rel = cible.filter(f => f.etat === 'envoye');
      const neufs = cible.filter(f => f.etat !== 'envoye');
      const choix = [];
      const prendre = (l) => { for (const f of l) if (choix.length < n && !choix.includes(f)) { choix.push(f); break; } };
      prendre(neufs.filter(f => f.langue === 'FR'));
      prendre(neufs.filter(f => f.langue === 'EN'));
      prendre(rel.filter(f => f.langue === 'EN'));
      prendre(neufs.filter(f => f.langue === 'FR' && !choix.includes(f)));
      prendre(neufs.filter(f => f.langue === 'EN' && !choix.includes(f)));
      while (choix.length < n && choix.length < cible.length) prendre(cible);
      for (const f of choix) {
        const m = rediger(f);
        const type = f.etat === 'envoye' ? 'RELANCE' : 'PREMIER CONTACT';
        console.log('='.repeat(76));
        console.log(`${type} [${f.langue}]  ${f.nom} — ${f.zone}`);
        console.log(`A: ${f.courriel}   |   archetype: ${f.archetype}`);
        console.log(`Objet: ${m.subject}`);
        console.log('-'.repeat(76));
        console.log(m.body);
        console.log();
      }
      process.exit(0);
    }
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
