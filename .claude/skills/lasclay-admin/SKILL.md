---
name: lasclay-admin
description: Ménage de la boîte Admin de Lasclay (admin@lasclay.com) — distinguer le bruit automatique qui se ferme sans réponse, des courriels qui engagent de l'argent, une échéance, une vente ou une relation. Couvre aussi les fils clients égarés dans Admin, qui se déplacent vers Support au lieu de se fermer.
when_to_use: Déclenche pour « fais le ménage de la boîte Admin », « ferme le superflu », « qu'est-ce qui traîne dans Admin », « vide l'arriéré administratif », et pour la Routine quotidienne de ménage. Déclenche aussi avant de fermer QUOI QUE CE SOIT dans une boîte qui n'est pas le service client.
allowed-tools:
  - Bash(node missive_client.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Ménage de la boîte Admin — Lasclay

Fermer un fil dans Missive est **réversible** (c'est un archivage, pas une suppression).
Rater une échéance de paiement ou une commande client ne l'est pas. Toute la règle est là :
**en cas de doute, on laisse ouvert.** Un fil de trop dans l'inbox coûte trois secondes de
lecture; un fil fermé à tort coûte une relance de la CNESST.

## Accès — lis ceci avant de chercher

Dans cet environnement il n'y a **que le proxy Missive**. Vérifie plutôt que de supposer :

```bash
node -e "console.log(process.env.MISSIVE_TOKEN?'ok':'ABSENT')"
```

`MISSIVE_TOKEN` et `ANTHROPIC_API_KEY` sont **absents** des sessions infonuagiques. Conséquence
directe, constatée le 2026-09-18 : `admin_ops.js`, `filtrage.js`, `nettoyage.js` et
`repartition_merge.js` **ne peuvent pas tourner ici**. Ils parlent à l'API Missive en direct.
N'essaie pas de les lancer, tu perdras le run sur un `Manque MISSIVE_TOKEN`.

`admin_ops.js` v3.5 reste le moteur de référence quand les jetons existent (il vise déjà
Admin + Operations, trie en close/spam/à voir/keep et poste un digest). Si un jour la boîte
est de nouveau saturée alors qu'un cron est censé tourner, **c'est la première chose à
vérifier** : le moteur est probablement muet faute de jeton, pas trop prudent.

Ici, tout passe par `missive_client.js` (voir le skill `missive` pour le détail).

## Les boîtes

| Boîte | `team_inbox=` |
| --- | --- |
| Lasclay Admin | `a6c74be0-2a27-4c79-9294-a74b447e6dc0` |
| LAS Operations | `7c925f0d-3eca-4535-be20-424078619cef` |
| **LAS Support** (destination des fils clients) | `e184d153-4472-4edd-9b35-f8867cf437a8` |

Admin et Operations **ne sont pas du service client**. C'est ce qui rend le tri possible :
presque tout ce qui y entre est soit une notification machine, soit une affaire qui engage
Lasclay. Peu d'entre-deux.

## Méthode

```bash
# 1. l'inventaire
node missive_client.js list "team_inbox=a6c74be0-2a27-4c79-9294-a74b447e6dc0" > /tmp/admin.json

# 2. la queue de chaque fil — 12 messages suffisent pour trancher
node missive_client.js read <convId> 12
```

Ce qui décide, pour chaque fil :

1. **Qui a parlé en dernier** — le champ `us` du dernier message. `us:false` = ils attendent.
2. **L'expéditeur est-il une machine ou une personne?**
3. **Reste-t-il un geste à poser de notre côté?**

Puis :

```bash
node missive_client.js close <convId>          # bruit réglé
node missive_client.js move <convId> <teamId>  # fil client égaré → LAS Support
```

`move` déplace de boîte d'équipe (`PATCH /conversations/:id` + `force_team`). Il ne change
PAS le compte courriel de réception : un fil arrivé sur `admin@` y reste rattaché, et une
réponse partira de `admin@` sauf si on change l'alias à la rédaction. **Dis-le** quand tu
déplaces des fils clients vers Support.

## ✅ Ce qui se ferme — le bruit

Ferme **sans note** (une note par fermeture bruite la boîte autant que le fil).

| Famille | Exemples réels |
| --- | --- |
| Codes à usage unique | Desjardins, ShipStation, GitHub « verify your device » |
| Alertes de connexion | Google « Security alert », Composio « Unrecognized Device » |
| Reçus et factures déjà transférés | Anthropic, CapCut, TELUS, Villéco, Volcano, Impôts Match |
| Confirmations sans suite | « demande enregistrée », « chargeback response submitted » |
| Avis de service | jours fériés de la paie, mises à jour de conditions déjà acceptées |
| Infolettres et invitations générales | mentors, cocktails, webinaires, formulaires optionnels |
| Démarchage froid | fournisseur jamais sollicité qui envoie son catalogue, « Dear Yan » |
| Rebonds | `mailer-daemon` — **mais lis-le** : il dit qu'un courriel à nous n'est jamais parti |
| Fils bouclés | leur dernier mot est « merci », ou une simple réaction à notre message |
| Rencontres passées | la date est dépassée et rien n'en découle |

Et le cas facile : **`us:true` sur un reçu ou une facture transférée** = classé, ferme.

## ⛔ Ce qui ne se ferme JAMAIS

Ce sont des règles dures, pas des préférences. Aucun raccourci n'y déroge.

- **Un geste à poser avec une date.** Paiement en retard, taxe impayée, document manquant
  pour une réclamation, conditions à accepter avant une échéance, renouvellement d'assurance.
  *Vus en vrai : TELUS en retard, taxe de vente du Manitoba impayée depuis juin, XCover
  relançant 3 fois pour un document, Apple Business avant le 29.*
- **Une personne qui attend une réponse.** Même vieille. Même si elle a l'air de relancer
  dans le vide. Surtout si elle a l'air de relancer dans le vide.
- **De l'argent entrant.** Facture impayée, paiement annoncé mais non reçu, commande en
  suspens.
- **Un client.** Ça ne se ferme pas, ça se **déplace** vers LAS Support (voir plus bas).
- **Trois relances identiques.** Ne ferme pas les doublons « pour faire le ménage » :
  c'est le signal qu'on ignore quelque chose. Garde-les, signale-les.
- **Un fil que tu n'as pas lu.** Le sujet ne suffit pas. Beaucoup de fils Admin ont un sujet
  automatique et un corps qui engage.
- **Une demande inhabituelle touchant l'argent ou une signature.** Ne ferme pas, ne remplis
  pas : signale. *Vu en vrai : un « Power of Attorney A.S.A.P. » CARM expédié d'une adresse
  Gmail.*

## 🔵 Les clients égarés — déplacer, pas fermer

Des courriels clients atterrissent dans Admin (formulaire du site, plainte Shopify, client
qui écrit à l'adresse d'entreprise). Ils sont **prioritaires** et n'ont rien à faire là.

Reconnais-les : un numéro de commande (`L-xxxxx`), un suivi de colis, un rabais, un retour,
un échange, une précommande, ou une notification « customer complaint » de Shopify.

```bash
node missive_client.js move <convId> e184d153-4472-4edd-9b35-f8867cf437a8
```

Laisse-les **ouverts** — ils attendent une vraie réponse. Puis charge le skill `support` :
c'est lui qui donne la méthode de vérification avant de répondre à un client.

## Garde-fous du run

- **Lis avant de fermer.** Toujours. Sans exception.
- **Plafond de 40 fermetures par passe.** Au-delà, arrête et rapporte : un volume pareil
  veut dire que quelque chose a changé dans la boîte, et ça se regarde avant de continuer.
- **Ne touche pas aux fils assignés à quelqu'un** — c'est que la personne s'en occupe.
- **Ne ferme jamais un fil sur lequel tu viens d'écrire.**
- **Aucune réponse sortante pendant un ménage.** Fermer et déplacer, c'est tout. Répondre à
  un fournisseur ou un partenaire est une décision de Gabriel, pas un geste d'entretien.

## Le rapport

Un ménage muet est inutilisable. Termine toujours par :

- le compte avant / après;
- les familles fermées, en une ligne chacune;
- **les échéances repérées et laissées ouvertes**, avec la date — c'est la partie qui a de
  la valeur;
- les fils clients déplacés;
- tout ce qui t'a fait hésiter, avec l'id du fil.

S'il n'y a rien à fermer, dis-le en une ligne et ne fabrique pas de travail.
