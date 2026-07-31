---
name: infolettre-lasclay
description: Rédiger une infolettre (newsletter) Lasclay dans le style exact de la marque. Utiliser dès qu'on demande d'écrire, rédiger, réviser ou créer une infolettre, une newsletter, une campagne courriel, un objet de courriel ou un preview text pour Lasclay, en français ou en anglais. Va chercher le guide de style complet, l'audit chiffré et l'archive des 325 infolettres réellement envoyées depuis 2020.
---

# Écrire une infolettre Lasclay

Lasclay a envoyé **325 infolettres entre 2020 et 2026** (221 FR, 104 EN). Elles sont archivées
avec leur mise en page complète, et deux documents les analysent. **Ne jamais écrire
d'infolettre Lasclay de mémoire ou d'intuition : toujours charger le guide d'abord.**

Écrire « à l'intuition » produit systématiquement les mêmes fautes : tirets cadratins, titres
`<h4>`, phrases hachées, ton trop littéraire, aucune exclamation. Le corpus existe justement
pour éviter ça.

## Comment aller chercher les fichiers

Le dépôt `lasclay/missive-automations` est **privé** : `curl` sur `raw.githubusercontent.com`
renvoie 404 sans jeton. Deux chemins fonctionnent :

1. **Si on travaille déjà dans le dépôt `missive-automations`** (le cas courant) : lire les
   fichiers directement sur disque, dans `infolettres/`. Le plus simple et le plus rapide.
2. **Sinon**, utiliser l'outil GitHub MCP : `mcp__github__get_file_contents` avec
   `owner: lasclay`, `repo: missive-automations`, `path: infolettres/GUIDE-REDACTION.md`.
   (Ajouter `ref` seulement si le contenu n'est pas encore fusionné dans la branche par défaut.)

## Étape 1. Charger le guide et l'audit (obligatoire)

| Fichier | Rôle |
|---|---|
| **`infolettres/GUIDE-REDACTION.md`** | Les règles : ton, structure, palette, typographie, formules, liste de contrôle |
| **`infolettres/AUDIT-CORPUS.md`** | Les **mesures brutes** derrière chaque règle : ponctuation, longueurs, lexique, cadence, structure |
| `infolettres/INDEX.md` | Les 325 envois avec date, objet, aperçu, langue, type, audience |
| `infolettres/infolettres-20XX.md` | Transcriptions intégrales par année |
| `infolettres/html/<date>-<slug>.html` | Rendu exact d'un envoi donné |

**Si le guide et l'audit se contredisent, c'est l'audit qui a raison.** Le guide a déjà contenu
trois affirmations fausses (« zéro cadratin », « preview dans 85 % des envois », « jamais
cliquez ici ») que l'audit a corrigées. Avant de modifier une règle, la vérifier dans l'audit.

⚠️ **Limite connue :** 27 envois sur 325 n'ont pas de corps exploitable (gabarit d'origine
introuvable, surtout 2020-2021). Les mesures de contenu portent sur ~298 envois.

## Étape 2. Trouver les précédents pertinents

Repérer dans `INDEX.md` 2 ou 3 envois du **même type** et de la **même saison**, puis lire leur
transcription intégrale. Les huit types, avec leur longueur médiane réelle :

| Type | Envois | Médiane |
|---|---|---|
| Prévente / lancement | 96 | 396 mots |
| Transactionnel / suivi de commande | 60 | 255 mots |
| Promotion / vente | 51 | 382 mots |
| Infolettre générale | 50 | 378 mots |
| Mission / campagne de plantation | 37 | **525 mots** |
| Concours | 15 | 248 mots |
| B2B / partenariats | 9 | 186 mots |
| Éducatif / entretien produit | 7 | 322 mots |

**Privilégier 2025-2026** : c'est la voix actuelle. Les fichiers d'année sont volumineux
(jusqu'à ~650 Ko), n'extraire que les sections utiles :

```bash
awk '/^## 2026-03-14/,/^## 2026-04/' infolettres/infolettres-2026.md
```

## Étape 3. Rédiger

### Les huit marqueurs d'une infolettre Lasclay

1. **C'est Gabriel, co-fondateur, qui parle.** Première personne, jamais de voix corporative.
   Il signe 275 des 325 envois.
2. **La vérité d'abord**, y compris les retards, bugs et erreurs : on les annonce soi-même.
3. **La mission (monarque, asclépiade, territoire québécois) avant le produit.**
4. **Vouvoyer.** La bascule a eu lieu en 2025 (167 « tu » contre 290 « vous »).
5. Ouvrir sur `Bonjour {{ person.first_name|default:'' }},` (186 envois), fermer sur
   `Chaleureusement,` (187 envois FR sur 221) puis **Gabriel** / Co-fondateur / Lasclay.
6. **Un fil conducteur clair, pas forcément un seul sujet.** Plusieurs nouvelles dans un même
   envoi sont normales (40 aperçus annoncent explicitement un second sujet). Le critère est que
   ce ne soit pas touffu : chaque sujet a sa section, son gras d'introduction et son appel à
   l'action.
7. **La hiérarchie se fait au gras, pas aux titres.** Médiane de 10 passages en gras par envoi,
   et très peu de vrais `<h*>`. Pour un sous-titre, utiliser du gras en 18 px inline.
8. Objet ~36 caractères, preview text **complémentaire** (motif fréquent : « + autre chose »),
   présent dans **100 %** des envois.

### La ponctuation, qui est la signature la plus mesurable

**Interdits :**
- **Tiret cadratin `—` et demi-cadratin `–`.** Règle absolue de la maison, déjà codée dans
  `digest.js` (règle dans le prompt **plus** nettoyage programmatique de la sortie) et dans
  `support.js` (fonction `noDash()`, appliquée une vingtaine de fois). Dans le corpus, les
  seules occurrences en prose viennent d'un bloc de texte généré par IA collé dans Klaviyo.
  C'est le marqueur typographique le plus reconnaissable d'un texte de modèle de langage.
  À la place : virgule, deux-points, parenthèse ou point.
- **Point-virgule.** 4 occurrences en 221 envois FR. Ne pas en écrire.

**Attendus :**
- **Deux-points : 4,1 par envoi.** L'outil principal d'annonce et d'énumération.
- **Point d'exclamation : 3,3 par envoi**, dans 181 envois FR sur 221. **Un texte sans aucun
  « ! » ne sonne pas Lasclay.** Les seules exceptions sont les suivis de commande et le B2B.
- Parenthèses 2,3 par envoi, questions rhétoriques 1,2.

### Le rythme

**Phrases : médiane 20 mots**, et **26 % font 30 mots ou plus**. Les phrases longues et amples
sont normales. **Ne pas hacher le texte en phrases courtes, c'est un tic d'IA.** Blocs de
texte : médiane 19 par envoi, donc des paragraphes courts et nombreux, jamais de pavés.

### Les emoji du corps

110 envois FR sur 221 en contiennent. Vocabulaire réel :
👇×74 · 👉×36 · 😉×21 · 👈×16 · 😀×16 · 😅×15 · 🧡×6 · 🚨×6 · 🦋×5

- **👇** précède l'appel à l'action (« Pour revoir notre catalogue, c'est par ici 👇 »).
- **👉 👈** encadrent une information ou pointent un lien.
- **😉 😀 😅** désamorcent, souvent après un aveu ou une blague.

Ils sont **absents des envois sérieux** (suivis de commande, B2B).

Dans l'objet : **18 % des envois seulement**, jamais plus de deux. Vocabulaire : 🦋×28, 🚨×9,
😮×7, 👀×6, 🎁×5, 🍂×5, ⚜×1.

### Le formatage des nombres

`20%` collé (324 occurrences contre 10 avec espace) · `99,99$` collé (236 contre **0** avec
espace) · `1500 pieds carrés` collé. L'apostrophe droite et l'apostrophe typographique
coexistent, ne pas perdre de temps à uniformiser.

### Les liens et les boutons

**63 % des envois n'ont aucun bouton :** l'appel à l'action passe par un lien texte doré et
souligné. Le bouton est réservé aux lancements, préventes et campagnes de plantation.
Libellés longs et explicites, médiane 42 caractères.

Ancres de liens : privilégier le groupe nominal explicite (`foulards`, `cache-cous`,
`ce court questionnaire`). Contrairement à une ancienne version du guide, **« cliquez ici »
n'est pas proscrit** (24 occurrences), mais toujours précédé de son contexte (« pour les
découvrir, cliquez ici »), jamais seul et nu.

### Le lexique

*infolettre* (218) jamais *newsletter* (0) · *courriel* (164) jamais *email* (1) ·
*rabais* (369) jamais *discount* (0) · *expédition* / *livraison* jamais *shipping* (0).
Vocabulaire de la mission : Québec (299), monarque (241), communauté (88), mission (81),
soutien (44), pollinisateur (34).

### Adapter une source externe (post LinkedIn, note, brouillon de Gabriel)

Gabriel écrit souvent d'abord ailleurs, puis demande d'intégrer le texte. **Ne jamais coller
tel quel :** un post LinkedIn s'adresse à des entrepreneurs, une infolettre à des clients.
Ce qui transfère et ce qui ne transfère pas, vérifié en pratique :

| Transfère très bien | À écarter ou recadrer |
|---|---|
| L'aveu et l'émotion brute (« ça fait un sacré vide ») | Les chiffres de paie, de loyer, de marge |
| La gratitude envers la clientèle, chiffrée | Tout ce qui ressemble à « on a coupé, donc on économise » |
| Le concret sensoriel (l'usine, le conteneur, les machines) | Le vocabulaire de gestion (context switching, scalabilité) |
| Ce que ça change **pour le lecteur** | Ce que ça change pour le fondateur, seul |

Deux réflexes :

1. **Un fait financier se raconte du côté de la communauté, pas du bilan.** « Notre loyer
   passe de 9600 $ à 2500 $ » devient « nous transférons les pieds carrés dont nous n'avons
   plus besoin à d'autres entrepreneurs, alors que les locaux abordables au centre-ville de
   Québec sont à peu près inexistants ».
2. **Attention aux juxtapositions qui créent un sous-entendu.** Parler d'automatisation par
   l'IA juste après avoir annoncé des départs la désigne comme leur cause. Le même fait,
   placé plus loin et encadré comme une pièce du service, devient rassurant.

### Ordonner l'information selon ce que le lecteur attend

**Quelqu'un qui attend une commande a droit à sa réponse avant le récit.** Dans un suivi de
précommande, l'état de la commande vient en premier, l'histoire de l'entreprise ensuite.
L'inverse se lit comme un détournement.

Mais **ne pas ouvrir sur le compteur du retard**. « Vous attendez une commande, et ça fait
deux mois » pointe le problème dès la première ligne. « Un petit coucou pour vous donner des
nouvelles de votre précommande! » fait la même reconnaissance sans appuyer, et laisse
« tout suit son cours » arriver tout de suite après. Le ton d'ouverture reste léger même
quand le contenu est substantiel.

Quand un envoi de suivi reprend la matière d'une infolettre générale, retitrer les sections
du point de vue du destinataire : « Ce que ça change, concrètement » devient « Mais pour
votre commande, ça change les choses dans le bon sens ». Et ajouter l'excuse explicite que
la liste large ne requiert pas : devant quelqu'un qui a peut-être subi un des retards
avoués, l'aveu sans excuse est trop court.

### Livrable : un texte fini, jamais un gabarit à trous

**Ne jamais livrer de section `[[ À COMPLÉTER ]]`, de crochets à remplir ni de champ laissé en
blanc.** Un brouillon troué crée plus de travail qu'il n'en épargne. C'est la même règle que
`support.js` impose déjà aux brouillons du service client (« BROUILLON COMPLET, JAMAIS DE CHAMP
À REMPLIR, règle critique »), et elle vaut pour les infolettres.

S'il manque une donnée, il y a trois issues, jamais un trou :

1. **Aller la chercher.** L'archive, l'INDEX, les envois précédents, le catalogue Shopify et
   les campagnes Klaviyo déjà envoyées contiennent presque toujours la réponse. Une infolettre
   qui vient d'être envoyée sur le même sujet est la meilleure source qui soit.
2. **Reformuler pour ne plus en avoir besoin.** « On vise toujours l'automne 2026 » plutôt
   qu'une date précise non confirmée. « Le numéro sera annoncé dans notre prochaine
   infolettre » plutôt qu'un numéro inventé.
3. **Écrire la version la plus plausible et signaler l'hypothèse à Gabriel dans la
   conversation**, pas dans le courriel.

Ne jamais inventer un chiffre, un prix, un rabais ni une date. Si le rabais exact est inconnu,
présenter le produit et pointer la collection, sans pourcentage.

**Format de livraison :** **objet**, **preview text**, puis le corps avec les blocs `[IMAGE]`
et `[BOUTON]` explicités (libellé, URL, couleurs) comme dans les transcriptions de l'archive.
Quand Gabriel prévoit insérer ses propres images, découper le texte en blocs séparés aux
endroits naturels plutôt que de tout mettre dans un seul bloc.

## Étape 4. Vérifier

Repasser la liste de contrôle de la section 9 du guide. En particulier : aucun cadratin, aucun
point-virgule, au moins un point d'exclamation, pourcentages et dollars collés, aucune ombre
portée, aucun crénage non nul, aucune police autre qu'Arial, boutons `#D4AD67` à texte blanc,
liens dorés soulignés, pied de page avec `298 Boulevard des Capucins, Québec, QC, G1J3R4` et
`{% unsubscribe 'Se désabonner' %}`.

Contrôle rapide du cadratin avant de livrer :

```bash
grep -n '[—–]' <fichier>   # doit ne rien retourner
```

## Monter la campagne dans Klaviyo

Audiences standard d'un envoi FR de grande portée (trio historique) :

| Audience | ID | Envois |
|---|---|---|
| LAS Customer QC (All time) | `T8qXdj` | 113 |
| Newsletter Français | `TGKgFC` | 110 |
| JdC - Acquisition courriels | `VEMFYt` | 105 |

Exclusion habituelle : `UG8xUu` (unsub + inactif). Expéditeur invariable :
`Lasclay <hey@lasclay.com>`. Les outils MCP Klaviyo permettent de créer le brouillon ; le
connecteur `klaviyo` du proxy général est en **lecture seule**.

**Créneau d'envoi :** 67 % des envois partent la fin de semaine, 46 % le samedi. Un envoi en
semaine est l'exception.

### Trois pièges vérifiés en production

1. **Assigner un gabarit le clone.** `assign_template_to_campaign_message` crée une copie
   (`Clone of XXXX`) et l'attache au message. Le clone **n'est pas modifiable** par l'API
   (404 sur `update_dnd_email_template`). Pour corriger un brouillon : modifier le gabarit
   **source**, puis **réassigner**. Modifier la source seule ne change rien à la campagne.
2. **Les segments à fenêtre relative périment.** Un segment bâti sur « dans les N derniers
   jours » est vide quelques semaines plus tard. Pour cibler les acheteurs d'un évènement
   passé, utiliser une **fenêtre de dates fixe** (`between-static`). Toujours vérifier le
   `profile_count` avant d'assigner un segment à une campagne.
3. **« Estimated recipients » est inférieur au nombre de membres.** Klaviyo ne compte que les
   profils qui peuvent recevoir du marketing. L'écart vient des désabonnements et des
   suppressions manuelles, pas d'un problème de liste.

### Montrer un aperçu à Gabriel

Gabriel veut voir le rendu **dans la conversation**, pas télécharger un fichier. Publier un
Artifact qui reproduit le contenu et les styles du gabarit : conteneur 600 px sur fond blanc,
Arial 14 px sur interligne 1,5, texte `#222222`, liens et boutons `#D4AD67`, pied 12 px
`#727272`. Ce qui rend l'aperçu réellement utile :

- Les deux envois **côte à côte** quand il y en a deux, chaque colonne défilant séparément.
- Un **entête d'inbox** par colonne: objet, preview text, audience et volume.
- Une **bascule 600 px / 375 px**, puisque la majorité des lecteurs ouvrent sur téléphone et
  que c'est là que les longs libellés de boutons cassent.
- Les **jointures entre blocs de texte marquées en pointillé**, pour montrer où un bloc image
  peut se glisser. Préciser que ces repères n'existent pas dans le courriel.
- Le prénom substitué par un exemple, pour ne pas afficher la variable brute.

Toujours dire que c'est une reproduction du contenu et des styles, **pas** le HTML tabulaire
que Klaviyo génère: pour Outlook et Gmail, l'aperçu Klaviyo et un envoi test restent le juge
final. À chaque modification demandée, mettre à jour le gabarit Klaviyo **et** republier
l'Artifact au même chemin de fichier, ce qui conserve le lien.

### Reprendre un travail en cours

Si un fichier `infolettres/EN-COURS-<date>.md` existe, **le lire en entier avant tout**: il
contient les IDs de campagne et de gabarit, l'état d'envoi, les décisions en suspens, les
faits de la saison et le lien de l'aperçu. Le supprimer une fois les envois partis.

### Consentement

Les **répondants de formulaire** et contacts d'enquête sont sous **consentement tacite**
(environ 6 mois) : on peut leur écrire **au sujet de leur demande**, mais pas leur envoyer
l'infolettre commerciale générale sans opt-in. Ne pas recycler ces listes pour une promo.
