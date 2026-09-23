---
name: inbox-operations
description: Ménage de la boîte d'équipe Missive OPERATIONS de Lasclay — partenariats, revente, fournisseurs, matière première, institutionnel. Dit comment lire la boîte, comment distinguer le superflu d'un dossier vivant, ce qui se ferme tout seul et ce qui ne se ferme jamais. Couvre l'outil de tri `ops_triage.js`, la liste blanche d'expéditeurs machine, les relais qui transportent la parole d'un client, et les notifications qui cachent une urgence. Pour la boîte Admin, c'est le skill `lasclay-admin` qui fait autorité ; pour le service client, `support`.
when_to_use: Déclenche pour le ménage de la boîte OPERATIONS, et pour sa Routine (lun/mer/ven). Déclenche aussi sans le mot Missive — « nettoie la boîte Operations », « trop de courriels non répondus dans Operations », « qu'est-ce qui traîne côté partenariats », « est-ce que ce fil Operations peut être fermé ». Si la demande porte sur la boîte Admin, charge `lasclay-admin` à la place ; si elle porte sur un client, `support`.
argument-hint: [la boîte à trier, ou le fil dont tu doutes]
allowed-tools:
  - Bash(node ops_triage.js:*)
  - Bash(node missive_client.js:*)
  - Bash(node dossier.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Ménage des boîtes d'équipe — Lasclay

N'explore pas pour retrouver comment lire une boîte : tout est ci-dessous. Pour l'accès au
proxy lui-même, le skill `missive`. Pour répondre à un client, le skill `support`. Celui-ci
ne traite qu'une question : **qu'est-ce qui mérite de rester ouvert.**

## La règle qui prime sur tout

**On ferme sur une liste blanche d'expéditeurs machine, jamais sur une liste noire d'humains.**

Un expéditeur inconnu reste ouvert. Toujours. Le coût d'un fil de trop dans la boîte est
quelques secondes de lecture ; le coût d'un client fermé par erreur est un client perdu qui
ne le dira jamais. Ces deux coûts ne sont pas du même ordre, et le tri doit refléter ça.

## Les trois boîtes

Une « boîte » ici est une **équipe** Missive, pas une étiquette. La distinction compte :
l'étiquette `Opérations` et la boîte `LAS Operations` ne contiennent pas la même chose — la
première a 875 fils sous `Opérations/Facture`, la seconde une soixantaine de fils vivants.

| Boîte | Filtre | Qui en a la charge |
| --- | --- | --- |
| **Operations** | `team_inbox=7c925f0d-3eca-4535-be20-424078619cef` | **ce skill** — partenariats, revente, fournisseurs, matière première, institutionnel |
| Admin | `team_inbox=a6c74be0-2a27-4c79-9294-a74b447e6dc0` | skill **`lasclay-admin`**, avec sa propre Routine à 7 h |
| Support | `team_inbox=e184d153-4472-4edd-9b35-f8867cf437a8` | skill **`support`** — service client, jamais d'auto-fermeture |

**Ne marche pas sur les pieds de `lasclay-admin`.** Les deux skills partagent la même
philosophie (le doute laisse ouvert) mais pas les mêmes règles : la boîte Admin a des
échéances datées — paiements, taxes, CNESST — et son skill porte un plafond de 40 fermetures
par passe et une liste de dossiers chauds à ne jamais toucher. `ops_triage.js` accepte
`--equipe admin` pour un coup d'œil ponctuel, mais **le ménage d'Admin se fait avec
`lasclay-admin`**, pas avec ce script.

Un fil de client égaré dans Operations ne se ferme pas : il se **déplace** vers Support et
reste ouvert.

```bash
node missive_client.js move <convId> e184d153-4472-4edd-9b35-f8867cf437a8
```

Les ids viennent de `node missive_client.js structure`, jamais d'une supposition. Le cache est
dans `missive_structure.json` à la racine.

⚠️ **N'utilise pas `inbox=true`** : 3214 fils, très lent. `all=true` expire carrément. Le filtre
`team_inbox` est celui qui répond à « qu'est-ce qui traîne dans cette boîte ».

## L'outil

```bash
node ops_triage.js                       # rapport, ne touche à rien
node ops_triage.js --close               # ferme TOUT ce qui est classé SUPERFLU
node ops_triage.js --close-ids a,b,c     # ferme EXACTEMENT ces fils, s'ils sont SUPERFLU
node ops_triage.js --equipe admin        # l'autre boîte
node ops_triage.js --limite 20           # plafonne le nombre de fils lus
node ops_triage.js --json                # sortie machine
```

Il liste la boîte, lit chaque fil, et classe en cinq catégories. **Lis le rapport avant de
fermer quoi que ce soit** : la liste blanche est faillible, le rapport est ce qui te permet de
le voir. Un passage complet sur la boîte Operations prend environ **trois minutes**.

**Préfère `--close-ids` à `--close`.** Tu fermes alors exactement ce que tu as lu et approuvé,
au lieu de refaire confiance au classement d'une seconde passe. Un id qui n'est pas classé
`SUPERFLU` est refusé et signalé, jamais fermé en silence.

### Ce que le script garantit

- **Il réveille le proxy avant de travailler.** Render endort le service ; un démarrage à
  froid en pleine lecture ferait passer des fils pour illisibles.
- **Il reprend les erreurs rejouables** (réseau, 429, 5xx) jusqu'à cinq fois, en doublant
  l'attente. Il ne reprend jamais un 401 ni un 404 : ceux-là ne se corrigent pas en
  réessayant, et les rejouer ne fait que retarder le diagnostic.
- **Il compte les fils illisibles et le dit.** Un tri partiel qui se présente comme complet
  est un piège ; ces fils restent classés `HUMAIN`, donc intouchés.
- **Il sort avec le code 2 si une fermeture a échoué.** Un échec silencieux produirait un
  rapport annonçant du ménage jamais fait.

| Catégorie | Ce que c'est | Ce qu'on en fait |
| --- | --- | --- |
| `SUPERFLU` | expéditeur machine reconnu, aucun signal d'action | **ferme**, avec une note qui dit pourquoi |
| `ACTION` | expéditeur machine, mais une urgence dedans | **note + garde ouvert** |
| `HUMAIN` | une personne attend | **ne touche jamais** |
| `NOTRE_TOUR` | le dernier mot est le nôtre | laisse — on attend leur réponse |
| `VIDE` | fil système sans message lisible | laisse (ex. « Résumé inbox Operations ») |

## Comment le tri décide

**Le dernier message décide, pas le premier.** Un fil ouvert par un automate où un humain a
répondu ensuite est un fil humain. C'est le champ `us` de chaque message : `us: false` au
dernier message signifie que la balle est dans notre camp.

Ensuite, trois filtres dans cet ordre :

1. **Est-ce un relais?** Voir plus bas — c'est le piège le plus coûteux.
2. **L'expéditeur est-il sur la liste blanche?** Sinon → `HUMAIN`, point final.
3. **Le texte contient-il un signal d'action?** Si oui → `ACTION`, même si c'est un robot.

## Les trois pièges, chacun payé par une erreur réelle

### 1. Un relais n'est pas une notification

`conversations@mail.etsy.com` et `no-reply@account.etsy.com` ressemblent à des robots et
transportent la parole d'une **vraie cliente**. Le 18 septembre, trois fils Etsy ont failli
être fermés comme du bruit ; l'un était une acheteuse qui demandait si elle devrait payer des
droits de douane, relancée deux fois sans réponse.

Sont des relais : **Etsy, Facebook/Messenger, Instagram, LinkedIn, les formulaires de contact**
(Typeform, Jotform, Tally, formulaire Shopify). Ils sont traités comme des humains, sans
exception.

⚠️ Et sur ces canaux, **`reply` ne fonctionne pas** : Missive ne peut répondre que par courriel.
Une conversation Etsy se répond dans Etsy. Pose une note qui le dit, ne laisse pas croire que
c'est traité.

### 2. Une notification peut cacher une urgence

« Your Microsoft 365 subscription has expired » et « You made a sale — Ship by Sep 19 »
viennent d'automates et ne se ferment surtout pas. D'où les **signaux d'action**, qui font
basculer un fil de `SUPERFLU` vers `ACTION` :

expiration · montant en souffrance · « action required » · date limite d'expédition · paiement
refusé · compte suspendu · alerte de sécurité · code de vérification · dernier avis · échec de
livraison · renouvellement d'abonnement.

Quand un fil tombe dans `ACTION`, **pose une note qui dit précisément quoi faire**, et
laisse-le ouvert. Une notification refermée sans note, c'est l'urgence effacée.

### 3. Ce qui ressemble à du bruit peut être opérationnel

`support@chitchats.com` qui annonce des codes HTS réglementés par le DOT américain a l'air
d'une infolettre de transporteur. C'en est une — et elle change la façon dont on expédie aux
États-Unis. Un transporteur, un fournisseur, une plateforme de paiement qui écrit sur les
**règles** n'est pas du bruit. La liste blanche ne contient que des expéditeurs dont le
courrier est transactionnel, jamais réglementaire.

## Élargir la liste blanche

Quand un fil traîne dans `HUMAIN` alors qu'il est manifestement du bruit, **corrige
`AUTOMATES` dans `ops_triage.js`** plutôt que de le fermer à la main. Une fermeture manuelle
règle un fil ; une entrée dans la liste règle tous les suivants.

Une entrée demande une preuve : un fil réel, refermé sans regret. Et vérifie le **domaine
exact** — 1Password écrit depuis `accounts@1password.ca`, pas `.com`. Une entrée qui ne
correspond à rien ne fait rien, silencieusement.

**Ce qui ne doit jamais entrer dans la liste blanche :** un relais, un transporteur, une
institution financière, un organisme public, et toute plateforme dont un message peut contenir
une commande à expédier.

### Le cas limite : la pièce comptable

Un accusé d'achat fournisseur porte une adresse de robot **et** un montant. Uline expédie ses
confirmations depuis `accounts.receivable@uline.ca` : c'est du transactionnel au sens strict,
mais un accusé de 649 $ avec un numéro de commande est aussi une pièce qui doit se retrouver
en comptabilité. Le premier passage de la Routine a laissé ce fil ouvert alors que le script
le classait `SUPERFLU`, et c'était le bon réflexe.

La règle : **ne ferme une pièce comptable qu'après avoir vérifié qu'elle est classée ailleurs.**
Si elle l'est, la fermeture est propre ; sinon, la boîte est le seul endroit où elle existe.

## Ce qui ne se ferme jamais, même vieux

- **Un fil qui porte un engagement futur** — un envoi à venir, une réponse attendue du client.
- **Un fil où un humain attend**, quel que soit son âge. 634 jours de silence ne rendent pas
  une demande caduque : ça la rend gênante, ce qui n'est pas la même chose.
- **Un avis positif ou un témoignage.** Étiquette `Support/review à traiter`
  (`1681e586-9a75-49a6-bf90-75a2620d20a5`) **avant** de fermer : c'est de la matière à
  témoignage, et fermer sans étiqueter la perd. Sur un fil déjà fermé, `labels` exige
  `keepClosed: true`, sinon l'étiquetage le rouvre.

## Fermer proprement

```bash
node missive_client.js close <convId> "pourquoi, en une phrase utile"
node missive_client.js note  <convId> "ce qu'il reste à faire"
```

**La note de fermeture n'est pas décorative.** Dans six mois, elle est la seule chose qui
distingue « traité » de « abandonné ». Écris ce que tu as vérifié, pas ce que tu as ressenti.

⚠️ **`close` ne retire aucune étiquette.** Un fil traité garde ses étiquettes jusqu'à retrait
explicite via `labels`, et la boîte continue d'annoncer du travail déjà fait.

## Le rythme

Une Routine passe les **lundis, mercredis et vendredis** à 8 h (heure de l'Est) : elle lance
`ops_triage.js`, ferme le `SUPERFLU` et rapporte le reste. Elle ne répond à personne et ne
ferme aucun fil humain — c'est délibéré : le tri est mécanique, la réponse ne l'est pas.

Le rythme de trois fois par semaine plutôt que quotidien vient d'une mesure, pas d'une
intuition : un passage consomme environ 146 000 jetons, soit ~2,20 $. Ce qui coûte n'est pas le
tri — le script est déterministe et gratuit — mais le modèle qui relit la boîte autour. Sur une
boîte où le bruit réel est de deux ou trois fils par semaine, un passage quotidien payait
surtout du vide.

Ce que la Routine ne fait pas et qu'un humain doit faire : **les fils `HUMAIN` qui vieillissent**.
Au 18 septembre, la boîte Operations en portait 54, dont quatorze de plus de six mois. Le tri
automatique empêche la boîte de se remplir de bruit ; il n'empêche pas un dossier de pourrir.

## Deux limites du proxy, vérifiées

- **Une note posée par le proxy ne se relit pas.** `node missive_client.js notes <convId>`
  renvoie vide même après un `ok: true`, parce que Missive ne ressert pas ces commentaires sur
  `GET /conversations/:id/comments`. La note existe bien dans l'interface. Fie-toi au `ok`,
  ne conclus pas à un échec, et ne poste pas la note deux fois.
- **Vérifie toujours l'effet dans la boîte, pas le rapport.** Pour savoir si un ménage a eu
  lieu, relance `ops_triage.js` et compare : c'est la source primaire. Le compte rendu d'une
  session est un témoignage, l'état de la boîte est un fait.

## Contexte

**Les Produits Lasclay Inc**, Québec — produits isolés à la soie d'asclépiade. La boîte
Operations n'est pas du service client : on y trouve des détaillants, des producteurs
d'asclépiade, des institutions, des partenaires R&D et des fournisseurs. Les montants y sont
plus gros et les délais de réponse y comptent autrement — un détaillant qui relance cinq fois
en six semaines avant d'obtenir une liste de prix ne relancera pas une sixième.
