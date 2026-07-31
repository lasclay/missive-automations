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

### Livrable

**Objet**, **preview text**, puis le corps avec les blocs `[IMAGE]` et `[BOUTON]` explicités
(libellé, URL, couleurs) comme dans les transcriptions de l'archive, pour que le montage dans
Klaviyo soit direct.

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

### Consentement

Les **répondants de formulaire** et contacts d'enquête sont sous **consentement tacite**
(environ 6 mois) : on peut leur écrire **au sujet de leur demande**, mais pas leur envoyer
l'infolettre commerciale générale sans opt-in. Ne pas recycler ces listes pour une promo.
