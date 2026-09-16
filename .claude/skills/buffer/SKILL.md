---
name: buffer
description: Buffer chez Lasclay — TROIS comptes Buffer distincts, et un connecteur MCP qui n'en voit qu'un seul. Dit quel compte détient quel canal, pourquoi l'accès aux deux autres passe obligatoirement par le General Proxy, et ce qui est irréversible une fois publié. Couvre la publication vidéo (Reel, TikTok), le piège des canaux en mode rappel et le plafond de trois canaux par compte.
when_to_use: Déclenche dès qu'il est question de Buffer, de publier sur les réseaux sociaux de Lasclay, d'un Reel, d'un TikTok, d'une page Facebook ou d'un compte Instagram de la marque, d'une publication programmée ou d'une file d'attente. Déclenche aussi sans nommer Buffer — « publie ça sur toutes les plateformes », « poste la vidéo sur Instagram », « pourquoi je ne vois pas cette page dans Buffer », « corrige le texte de la publication d'hier », « planifie l'annonce pour demain matin ».
argument-hint: [ce que tu veux publier, et où]
allowed-tools:
  - Bash(node connectors_client.js:*)
  - Read
---

# Buffer chez Lasclay

## La chose à savoir avant tout : il y a trois comptes, pas un

Chaque jeton Buffer — et chaque connexion OAuth — ne voit QUE les canaux de son propre compte.
Le connecteur MCP Buffer d'une session est lié par OAuth à **un seul** compte. Les deux autres
sont invisibles depuis cette session, et aucun message d'erreur ne le dit : `list_channels`
renvoie simplement trois canaux, comme si les autres n'existaient pas. C'est ainsi qu'on conclut
à tort qu'une page « n'est pas branchée à Buffer ».

**L'accès aux autres comptes passe par le General Proxy**, connecteur `buffer` — les trois jetons
vivent côté Render. Charge le skill `proxygen` pour la mécanique complète ; l'essentiel tient ici.

| `compte` | Variable Render | Compte Buffer | Canaux (16 sept. 2026) |
| --- | --- | --- | --- |
| `main` (défaut) | `BUFFER_MAIN_API_KEY` | operations@lasclay.com | Instagram **lasclay**, LinkedIn **Gabriel Gouveia**, Facebook **Lasclay** (page) |
| `2` | `BUFFER_2_API_KEY` | admin@lasclay.com | Facebook **Milkweed & Monarchs**, **Lasclay: The Milkweed Company**, **Asclépiade & papillons monarques** |
| `3` | `BUFFER_3_API_KEY` | media@lasclay.com | Instagram **milkweed.company**, **milkweed.monarchs** (déconnecté), **asclepiadepapillons** |

```bash
node connectors_client.js buffer comptes                                   # quels jetons existent
node connectors_client.js buffer account  '{"compte":"2"}'                 # à qui appartient ce compte + organizationId
node connectors_client.js buffer channels '{"compte":"2","organizationId":"…"}'
node connectors_client.js buffer channel  '{"compte":"2","id":"…"}'        # mode rappel ? horaire ?
```

Le tableau ci-dessus est une photo, pas une source de vérité : **balaie les trois comptes** avant
d'affirmer qu'un canal n'existe nulle part. Le nom des variables ne dit rien du compte qu'elles
désignent — seul `account` le dit.

## Plafond : trois canaux par compte

Les trois comptes sont au forfait gratuit : **3 canaux sur 3**, et 10 publications programmées.
Brancher un canal de plus exige d'en retirer un ou de payer. Un canal **déconnecté** occupe quand
même sa place — `milkweed.monarchs` gaspille ainsi un emplacement du compte `3`.

**Aucun canal TikTok n'est branché sur aucun des trois comptes** (vérifié le 16 septembre 2026).
Publier sur TikTok `lasclayqc` par Buffer suppose donc d'abord de libérer un emplacement et d'y
connecter le canal — sinon, c'est l'app TikTok à la main, ou une connexion TikTok dans Composio
(avec le risque que l'app non auditée force la publication en privé `SELF_ONLY`).

## Publier

```bash
node connectors_client.js buffer createpost '{
  "compte":"main", "channelId":"…", "text":"…",
  "assets":[{"video":{"url":"https://…mp4"}}],
  "metadata":{"instagram":{"type":"reel","shouldShareToFeed":true}},
  "mode":"shareNow", "schedulingType":"automatic"}'
```

- `assets` — l'URL doit être **téléchargeable directement** par Buffer. Un lien de partage Google
  Drive ne l'est pas ; `https://drive.usercontent.google.com/download?id=…&export=download` l'est,
  si le fichier est partagé « toute personne disposant du lien ». Buffer ingère la vidéo lui-même
  et renvoie sa durée : une durée juste prouve qu'il a bien lu le fichier.
- `metadata` — par service : `{"instagram":{"type":"reel","shouldShareToFeed":true}}`,
  `{"facebook":{"type":"reel"}}`, `{"tiktok":{"title":"…"}}`. LinkedIn n'en demande aucune.
- `mode` — `addToQueue` (défaut), `shareNext`, `customScheduled` + `dueAt`, `shareNow`.

## Trois pièges, tous payés une fois

1. **Canal en mode rappel.** Sur TikTok, Instagram et YouTube, Buffer ne publie pas toujours
   lui-même : il notifie un téléphone. Lis `channel` → `metadata.defaultToReminders` AVANT de
   promettre une publication automatique. Sur un tel canal, `schedulingType` doit valoir
   `"notification"`.
2. **HTTP 200 ne veut pas dire succès.** Buffer rend ses erreurs dans un tableau `errors`, ou —
   pour `createpost`/`editpost` — dans un membre d'union d'erreur, avec un code 200. Le connecteur
   du proxy vérifie les deux ; ne remplace jamais ce contrôle par un test du code HTTP.
3. **`shareNow` ne se rattrape pas.** Une publication `sent` n'est plus modifiable par Buffer
   (`allowedActions` ne contient plus `updatePost`), et ensuite :
   - **Facebook** refuse l'édition d'un contenu créé par une autre app —
     `(#200) Viewer does not have permission to edit content`. Le General Proxy se fait répondre
     `(#12) singular statuses API is deprecated`. Aucune des deux voies ne passe.
   - **Instagram** n'expose **aucune** édition de légende, dans aucune API.
   - **LinkedIn** ne se corrige que par suppression + republication : l'URL change et l'engagement
     repart à zéro.

   Donc : **le texte doit être final avant l'appel**. En cas de doute, `"saveToDraft": true` crée
   la publication sans effet public, ou `mode: "customScheduled"` laisse une fenêtre pour
   `editpost`. Constaté le 16 septembre 2026 : trois publications parties avec deux lignes
   d'invitation à retirer, aucune voie API pour les enlever ensuite.

## Ton et rédaction

Le texte se rédige avec le skill `copywriting-lasclay` (voix de marque) ; ce skill-ci ne porte que
la plomberie. Une publication sur le profil LinkedIn de Gabriel se rédige à la **première
personne** — « j'affronterai le feu des Dragons », « mon entreprise Lasclay » — pas dans le « nous »
de la page Facebook de la marque.
