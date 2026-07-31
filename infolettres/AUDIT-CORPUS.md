# Audit du corpus des infolettres Lasclay

> Mesures brutes sur les **325 infolettres archivées** (octobre 2020 à juin 2026), extraites
> des fichiers `infolettres-20XX.md`. Ce document est la **source de vérité chiffrée** derrière
> `GUIDE-REDACTION.md` : quand le guide énonce une règle, elle doit pouvoir se retrouver ici.
> Toute règle de style qui ne s'appuie pas sur une mesure de ce document est une intuition, pas
> une règle.
>
> Méthode : le corps de texte est extrait des blocs sous `### Contenu`, en excluant les
> annotations de gabarit (`> *(texte ...)*`), les marqueurs `[IMAGE]` / `[BOUTON]` et les
> tableaux. Les mesures « FR » portent sur les 221 envois français.

## 0. Limite connue de l'archive

**27 envois sur 325 n'ont pas de corps exploitable** (moins de 20 mots extraits), presque tous
entre 2020 et 2021 : le gabarit d'origine est introuvable côté Klaviyo et la transcription
n'a pas pu être reconstituée. Les moyennes de contenu portent donc en pratique sur ~298 envois.
Les métadonnées (objet, aperçu, audience, date) sont complètes pour les 325.

## 1. Forme du corpus

| Année | Envois | FR | EN |
|---|---|---|---|
| 2020 | 4 | 4 | 0 |
| 2021 | 22 | 19 | 3 |
| 2022 | 21 | 14 | 7 |
| 2023 | 62 | 37 | 25 |
| 2024 | 69 | 49 | 20 |
| 2025 | **115** | 75 | 40 |
| 2026 (à juin) | 32 | 23 | 9 |
| **Total** | **325** | **221** | **104** |

### Types d'envoi

| Type | Envois | Longueur médiane |
|---|---|---|
| Prévente / lancement | 96 | 396 mots |
| Transactionnel / suivi de commande | 60 | 255 mots |
| Promotion / vente | 51 | 382 mots |
| Infolettre générale | 50 | 378 mots |
| Mission / campagne de plantation | 37 | **525 mots** |
| Concours | 15 | 248 mots |
| B2B / partenariats | 9 | 186 mots |
| Éducatif / entretien produit | 7 | 322 mots |

## 2. Ponctuation : la signature la plus mesurable

Comptages sur les 221 envois FR.

| Signe | Occurrences | Par envoi |
|---|---|---|
| **Deux-points `:`** | 900 | **4,1** |
| **Point d'exclamation `!`** | 730 | **3,3** |
| Parenthèse ouvrante `(` | 498 | 2,3 |
| Point d'interrogation `?` | 272 | 1,2 |
| Guillemets droits `"` | 99 | 0,4 |
| Points de suspension | 91 | 0,4 |
| Tiret cadratin `—` | **18** | 0,08 |
| Guillemets français `«»` | 17 | 0,08 |
| Demi-cadratin `–` | **12** | 0,05 |
| **Point-virgule `;`** | **4** | **0,02** |

**Ce qu'il faut en retenir :**

1. **Le deux-points et le point d'exclamation sont les outils de rythme de la marque.**
   181 envois FR sur 221 contiennent au moins un `!`. Un texte Lasclay sans aucune
   exclamation sonne faux : c'est le cas de seulement 40 envois, presque tous des suivis de
   commande ou du B2B.
2. **Le point-virgule est quasi inexistant : 4 occurrences en 221 envois.** Ne pas en écrire.
   (Note : le guide de rédaction lui-même en abuse dans sa propre prose. Ne pas s'en inspirer.)
3. **Le tiret cadratin est proscrit.** Voir la section 3, qui détaille les 30 occurrences.

## 3. Le tiret cadratin : d'où viennent les 30 occurrences

La règle « jamais de cadratin » est une règle maison réelle, déjà codée dans `digest.js`
(règle absolue dans le prompt **plus** nettoyage programmatique de la sortie) et dans
`support.js` (fonction `noDash()`, appliquée une vingtaine de fois à toutes les sorties IA).

Le corpus n'est cependant **pas** à zéro. Les 30 occurrences (18 cadratins, 12 demi-cadratins)
se répartissent en trois causes, toutes en 2025, et aucune n'est de la prose courante :

**a) Séparateur de prix dans les listes de promotion (12 demi-cadratins, 4 envois).**
`Foulard – 20 % de rabais`, `Sac à vin – 25% de rabais`. Convention de mise en liste des
promos de novembre 2025, pas de la rédaction. Envois du 2025-11-01, 11-05, 11-08, 11-13.

**b) Un bloc de texte produit rédigé par IA, recyclé dans 4 envois (14 cadratins).**
Le passage « Légères mais hautement isolantes, elles rivalisent — voire surpassent — les
matériaux synthétiques » et ses voisins. Dans le HTML rendu, ces phrases portent des attributs
`data-start` / `data-end`, la signature d'un copier-coller depuis une interface de chat IA.
Envois du 2025-11-15, 11-19, 11-29, 12-03.

**c) Une coquille (2 cadratins, 2 envois).** `des milliers de clients— autant au bureau`,
sans espace avant. Envois du 2025-05-03 et 05-10.

**Conclusion : le cadratin n'apparaît jamais dans la prose spontanée de Gabriel.** Les seules
occurrences en prose viennent d'un texte généré par IA. C'est précisément pourquoi la règle
existe : le cadratin est le marqueur typographique le plus reconnaissable d'un texte écrit par
un modèle de langage.

## 4. Objets

- Longueur : **médiane 36 caractères**, moyenne 37,5, min 13, max 78.
  Déciles : 24 · 28 · 32 · 35 · 36 · 38 · 42 · 45 · 55.
- **Emoji dans 57 objets sur 325 (18 %)**, et jamais plus de deux (47 objets en ont un, 10 en
  ont deux). Vocabulaire réel : 🦋×28, 🚨×9, 😮×7, 👀×6, 🎁×5, 🍂×5, 🌼×2, 🌱×1, 💪×1, 🎄×1, ⚜×1.
- 158 objets nomment l'asclépiade (ou *milkweed*), 24 nomment Lasclay.
- 55 contiennent un chiffre, 38 contiennent un deux-points, 33 se terminent par `!`,
  5 sont interrogatifs.
- **Aucun objet n'est en majuscules.**

## 5. Aperçu (preview text)

- **Présent dans 325 envois sur 325 (100 %).** Ce n'est pas optionnel.
- Longueur : **médiane 29 caractères**, min 1, max 158.
- 29 aperçus contiennent un `+`, dont 11 commencent par `+` : c'est le motif « objet principal,
  aperçu qui annonce le second sujet » (`+ autres nouvelles`, `+ nouveaux produits à venir`,
  `+ une petite demande`, `+ une nouvelle personnelle`).
- 24 aperçus contiennent un emoji.

## 6. Longueur et rythme du texte

- Corps : **médiane 379 mots**, moyenne 391, min 2, max 1581.
  Déciles : 118 · 202 · 267 · 335 · 379 · 416 · 477 · 571 · 661.
- **Phrases : médiane 20 mots**, moyenne 23,1 (3 518 phrases mesurées).
  Déciles : 8 · 12 · 15 · 18 · 20 · 24 · 28 · 32 · 40.
  **10 % des phrases font 8 mots ou moins, 26 % font 30 mots ou plus.** Les phrases longues
  sont donc normales et fréquentes : ne pas hacher artificiellement le texte.
- **Blocs de texte : médiane 19 par envoi FR** (moyenne 19,4, max 51). Les paragraphes sont
  courts et nombreux, pas massifs.
- **Passages en gras : médiane 10 par envoi FR** (moyenne 12, max 55). Le gras est le principal
  outil de hiérarchie, il y a très peu de vrais titres `<h*>`.

## 7. Structure visuelle

| | Médiane | Répartition |
|---|---|---|
| Images | 2 | 0 img : 66 · 1 : 68 · 2 : 57 · 3 : 45 · 4 : 26 · 5 : 23 · 6+ : 27 |
| Boutons | **0** | 0 bouton : **205** · 1 : 99 · 2 : 9 · 3 : 7 · 4 : 3 · 5 : 2 |
| Liens | 1 | max 28 |

**63 % des envois n'ont aucun bouton :** l'appel à l'action passe le plus souvent par un lien
texte doré et souligné, pas par un bouton. Le bouton est réservé aux lancements, préventes et
campagnes de plantation.

Libellés de boutons : **médiane 42 caractères**, min 14, max 88. Les plus fréquents :
« Profiter de la vente de fin de saison Lasclay » (13×), « En savoir plus sur le concours » (6×),
« Voir l'offre corporative de Lasclay » (4×), « PRÉCOMMANDER LES PRODUITS LASCLAY » (4×).
La majuscule intégrale existe mais reste minoritaire, et elle est tapée dans le libellé.

## 8. Emoji dans le corps

**110 envois FR sur 221 en contiennent au moins un**, pour 256 occurrences.

👇×74 · 👉×36 · 😉×21 · 👈×16 · 😀×16 · 😅×15 · 🧡×6 · ✔×6 · 🚨×6 · 🙂×5 · 🦋×5 · ♥×4 · 🙏×4 · 😁×4

Le 👇 précède l'appel à l'action. Les mains 👉👈 encadrent une information ou pointent un lien.
Les binettes 😉😀😅 servent à désamorcer, souvent après un aveu ou une blague. Ce trio est une
signature de la voix et il est absent des envois sérieux (suivis de commande, B2B).

## 9. Lexique

Le français est tenu, sans anglicismes, et c'est vérifiable :

| Terme retenu | Occ. | Terme évité | Occ. |
|---|---|---|---|
| infolettre | 218 | newsletter | **0** |
| courriel | 164 | email / e-mail | **1** |
| rabais | 369 | discount | **0** |
| expédition / livraison | 44 / 64 | shipping | **0** |
| prévente / précommande | 150 / 95 | | |

### Vocabulaire de la mission

| Mot | Occurrences | Dans N envois |
|---|---|---|
| Québec | 299 | 182 |
| monarque | 241 | 90 |
| communauté | 88 | 66 |
| mission | 81 | 55 |
| soutien | 44 | 40 |
| pollinisateur | 34 | 26 |
| fier / fière | 28 | 26 |
| nordique / nordicité | 10 | 8 |

### Formules récurrentes

« c'est par ici » (15 envois) · « Bref, » (19 envois) · « faire partie de notre communauté »
(22 envois).

## 10. Correction : « cliquez ici » n'est pas proscrit

Le guide affirmait qu'un lien est « jamais « cliquez ici » ». **C'est faux : la formule apparaît
24 fois**, et les ancres les plus fréquentes du corpus incluent « pour les découvrir, cliquez
ici » (19×), « clique ici pour voir » (10×), « cliquer ici pour voir » (8×).

Les ancres les plus fréquentes sont malgré tout des groupes nominaux explicites : `lasclay.com`
(33×), `foulards` (23×), `cache-cous` (19×), `semelles` (19×), `mitaines` (16×), `tuques` (11×).

**Formulation correcte de la règle :** privilégier le groupe nominal explicite, qui domine ;
« cliquez ici » reste acceptable quand il est précédé du contexte (« pour les découvrir,
cliquez ici ») et n'est jamais l'ancre seule et nue.

## 11. Formatage des nombres

Usage massivement dominant, à respecter :

- **Pourcentage collé : `20%`** (324 occurrences) contre `20 %` avec espace (10).
- **Dollar collé : `99$`** (236 occurrences) contre `99 $` avec espace (**0**).
- **Virgule décimale : `99,99$`** (62 occurrences).
- Milliers généralement collés (`1500 pieds carrés`, 259 occurrences de nombres à quatre
  chiffres) contre 7 avec espace insécable.
- Apostrophe : typographique `’` (2 399) et droite `'` (1 729) coexistent. Aucune des deux
  n'est fautive.

## 12. Ouverture, clôture, signature

- **`Bonjour {{ first_name }},` ouvre 186 envois FR.** C'est l'ouverture par défaut.
  4 envois ouvrent sur `Bonjour,` sans prénom. Les envois B2B aux municipalités utilisent
  `À l'intention de ...`.
- **« Chaleureusement, » ferme 187 envois FR sur 221 (85 %).**
- **« Co-fondateur » : 188 envois. « Gabriel » : 194 envois.** La signature est quasi invariable.
- « Merci » apparaît dans 139 envois FR. Formules réelles : « merci d'être encore là {prénom} »,
  « merci énormément {prénom} de ta confiance et de ta patience », « merci encore de faire
  partie de notre belle communauté », « MERCI, MERCI MERCI! », « merci, et bon jardinage! ».

## 13. Tutoiement contre vouvoiement

| Année | « tu / ton / ta » | « vous / votre / vos » | Usage |
|---|---|---|---|
| 2021 | 8 | 5 | tutoiement |
| 2022 | 56 | 23 | tutoiement |
| 2023 | 161 | 84 | tutoiement |
| 2024 | 129 | 101 | tutoiement (bascule en cours) |
| 2025 | 167 | **290** | **vouvoiement** |
| 2026 | 17 | **107** | **vouvoiement** |

La bascule a lieu en 2025. **Pour tout nouveau contenu : vouvoyer.**

## 14. Cadence d'envoi

**Par jour de semaine :**
samedi **148** · dimanche **71** · jeudi 31 · mercredi 28 · mardi 21 · vendredi 17 · lundi 9.

**67 % des envois partent la fin de semaine**, et près de la moitié le samedi. C'est le créneau
maison. Un envoi en semaine est l'exception, généralement un suivi de commande urgent ou un
erratum.

**Par mois :**
nov 45 · sept 39 · déc 37 · mai 36 · janv 27 · juin 26 · mars 22 · oct 22 · avril 21 · août 19 ·
juil 17 · **févr 14**.

Les pics correspondent au concours et au Vendredi fou (novembre), à la prévente automnale
(septembre), aux Fêtes (décembre) et à la prévente printanière (mai). Février est le creux.

## 15. Audiences

| Audience | ID | Envois |
|---|---|---|
| LAS Customer QC (All time) | `T8qXdj` | 113 |
| Newsletter Français | `TGKgFC` | 110 |
| JdC - Acquisition courriels | `VEMFYt` | 105 |
| Newsletter English Canada | `QXRzba` | 70 |
| LAS Customer ROC (All time) | `UXg6uz` | 66 |
| Newsletter English USA | `WwacXM` | 47 |
| Newsletter Full List | | 29 |
| Customer USA all time | `Y3Usnk` | 22 |
| USA South | | 16 |
| Facebook Lead Gen USA | | 15 |

---

*Généré par script d'analyse sur `infolettres/infolettres-20XX.md`. Pour reproduire ou étendre
l'audit, réextraire le corps avec la méthode décrite en tête de document.*
