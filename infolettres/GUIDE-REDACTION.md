# Guide de rédaction et de design des infolettres Lasclay

> Référence unique pour écrire une infolettre Lasclay. Tout ce qui suit est **mesuré sur
> les 325 infolettres réellement envoyées entre octobre 2020 et juin 2026** (export Klaviyo
> du 2026-07-31), pas inventé. Les chiffres entre parenthèses sont les fréquences observées
> dans le corpus.

---

## 1. Qui parle, à qui, pour quoi

**Lasclay** est une entreprise de Québec qui transforme la **fibre d'asclépiade** (milkweed)
— l'isolant végétal le plus chaud, imperméable et abondant d'Amérique du Nord — en produits
isolés : mitaines, foulards, cache-cous, tuques, bandeaux, manteaux, vestes, glacières,
sacs-lunch, sacs à vin, mitaines de four. Elle vend aussi des semences, des bombes
semencières et un service de plantation.

La mission dépasse le produit : **l'asclépiade est la plante-hôte exclusive du papillon
monarque**, menacé d'extinction. Chaque produit vendu finance la culture d'asclépiade, donc
la survie du monarque. C'est le fil narratif de presque toutes les infolettres.

**La voix est celle de Gabriel**, co-fondateur, qui signe **275 des 325 envois**. Ce n'est
jamais « l'équipe marketing » qui écrit : c'est un entrepreneur qui raconte où en est son
projet. C'est la caractéristique la plus importante du style.

### Les audiences

| Audience | ID Klaviyo | Envois | Note |
|---|---|---|---|
| LAS Customer QC (All time) | `T8qXdj` | 113 | clients Shopify du Québec |
| Newsletter Français | `TGKgFC` | 110 | **c'est « la newsletter FR »** |
| JdC - Acquisition courriels | `VEMFYt` | 105 | **c'est « la liste JdC »** |
| Newsletter English Canada | `QXRzba` | 70 | |
| LAS Customer ROC (All time) | `UXg6uz` | 66 | clients hors Québec |
| Newsletter English USA | `WwacXM` | 47 | |
| Customer USA all time | `Y3Usnk` | 22 | |

Le trio **`TGKgFC` + `T8qXdj` + `VEMFYt`** est la combinaison standard d'un envoi FR de
grande portée. Exclusions habituelles : `UG8xUu` (unsub + inactif), et les segments EN/US
quand on envoie en français.

---

## 2. Le ton — ce qui fait qu'une infolettre « sonne Lasclay »

### 2.1 Les sept règles non négociables

1. **On écrit à la première personne, au singulier ou au « nous » de l'équipe.**
   « Je voulais remercier… », « nous avons travaillé fort », « J'avais tellement peur que
   vous nous laissiez tomber ». Jamais de voix corporative désincarnée.

2. **On dit la vérité, y compris quand elle est mauvaise.** Le corpus contient des envois
   intitulés *« Petit problème de production »*, *« Problème avec les tuques jaunes »*,
   *« Erratum — les codes ne marchaient pas »*, *« Suivi de commande — on travaille fort »*,
   *« Nous avons besoin d'un coup de main 💪 »*. Un retard, un bug de rabais, une erreur de
   couleur : on l'annonce soi-même, on explique pourquoi, on dit ce qu'on fait. **Ne jamais
   enjoliver ni contourner un problème.**

3. **La mission avant le produit.** On explique *pourquoi* l'asclépiade compte (monarque,
   pollinisateurs, séquestration de CO₂, nordicité, savoir local) avant de dire quoi acheter.
   Le lien commercial arrive après avoir donné quelque chose au lecteur.

4. **La gratitude est explicite et répétée.** 185 envois se terminent par
   « Chaleureusement, ». Des dizaines s'ouvrent ou se ferment sur « Merci encore de ton
   soutien », « Merci de faire partie de notre communauté », « MERCI, MERCI MERCI! ».
   Le lecteur est un **allié**, pas une cible.

5. **On ancre dans le territoire.** Québec, le Grand Nord, la nordicité, l'hiver, les
   tempêtes, « notre belle terre nordique », des toponymes réels (ᑰᔾᔪᐊᖅ / Kuujjuaq,
   Limoilou, 298 boulevard des Capucins). Le concret local remplace l'abstraction marketing.

6. **Une seule idée par infolettre**, développée, avec un appel à l'action unique répété.
   Médiane : **400 mots** (min 99, max 1 645). Les envois les plus longs sont les annonces
   de mission ; les suivis de commande font 100-200 mots.

7. **Pas de superlatif creux.** Les chiffres et les faits font le travail : « notre plus
   grosse prévente depuis 2021 », « des milliers de jardins depuis 2021 », « de 25 à
   1 500 pieds carrés ». Quand on est enthousiaste, on le dit simplement : « énorme succès »,
   « on est très fiers ».

### 2.2 Tutoiement ou vouvoiement — attention, ça a changé

Le corpus montre une **bascule nette** :

| Année | occurrences « tu / ton / ta » | occurrences « vous / votre / vos » |
|---|---|---|
| 2022 | 56 | 23 |
| 2023 | 161 | 84 |
| 2024 | 129 | 103 |
| 2025 | 167 | **291** |
| 2026 | 17 | **107** |

**➜ Pour toute nouvelle infolettre : vouvoyer.** C'est l'usage actuel de la marque depuis
2025. Le tutoiement subsiste seulement dans les courriels transactionnels hérités
(« Suivi de ta précommande ») ; ne pas l'introduire dans un nouveau contenu.

### 2.3 Registre

- Français québécois **soigné mais parlé** : « Bref, nous avons travaillé fort », « Hum, oui
  et non », « c'est par ici 👇 », « On ne croirait pas à ça avec la température des derniers
  jours ».
- Phrases courtes alternant avec des phrases longues et amples quand on raconte.
- Les **questions rhétoriques** ouvrent bien : « Est-ce que Lasclay fait vraiment un Boxing
  Day? », « As-tu reçu ta commande pour Noël? »
- Anglicismes proscrits ; on écrit *infolettre*, *courriel*, *rabais*, *expédition*,
  *précommande*, *prévente*.

---

## 3. Structure canonique d'une infolettre

L'ordre observé dans la quasi-totalité du corpus (298/325 commencent par un bloc **texte**,
jamais par une image) :

```
1. « Bonjour {{ first_name }}, »                    ← bloc texte seul, 186 occurrences
2. Accroche : contexte, saison, nouvelle, aveu      ← 1-3 paragraphes
3. Le fond : mission / explication / annonce        ← paragraphes + gras sur les idées clés
4. IMAGE pleine largeur 600 px                      ← respiration visuelle (médiane : 2 images)
5. Développement : bénéfices, détails, liste 1-2-3
6. Ligne d'appel + « 👇 »                            ← 84 occurrences de 👇
7. BOUTON doré, libellé long et explicite
   (+ éventuel « * Si le bouton ne fonctionne pas, voici le lien: … » en petit gris)
8. « Merci … » puis « Chaleureusement, »            ← 185 occurrences
9. Signature :  **Gabriel**
                Co-fondateur
                Lasclay
10. Pied : « Lasclay, 298 Boulevard des Capucins, Québec, QC, G1J3R4 »
    « Vous ne voulez plus recevoir notre infolettre? » + {% unsubscribe 'Se désabonner' %}
11. Bannière-image de pied (souvent le logo / visuel de marque)
```

Séparateur `solid 1px #CCC` sur 100 % de largeur pour découper les grandes sections.

### Variantes par type d'envoi

| Type | Envois | Particularités |
|---|---|---|
| Prévente / lancement | 96 | Séquence de 3-4 « réchauffements » avant l'ouverture, puis rappel « il reste X heures », puis remerciement-bilan |
| Transactionnel / suivi | 60 | Court, factuel, daté, sans promo ; objet « Suivi de ta précommande » |
| Promotion / vente | 51 | Le rabais est nommé précisément (%, code, durée) ; jamais d'urgence artificielle |
| Infolettre générale | 50 | Saisonnière : « L'automne, la saison de l'asclépiade », « L'été, saison de l'asclépiade » |
| Mission / plantation | 37 | Campagne nationale de mars-avril ; le plus narratif, le plus long |
| Concours | 15 | Prix mémorable (voyage au sanctuaire des monarques au Mexique) |

---

## 4. Objet et preview text

- **Objet** : médiane **36 caractères** (min 13, max 78). Descriptif, pas racoleur.
  Exemples réels : `Vente de fin de saison 2026`, `Problème avec les tuques jaunes`,
  `L'automne, la saison de l'asclépiade`, `Campagne nationale de plantation d'asclépiade ⚜️🦋`,
  `Est-ce que Lasclay fait vraiment un Boxing Day?`
- **Emoji dans l'objet : 18 % des envois seulement.** Vocabulaire réel : 🦋 (monarque),
  🌱 🌼 (plantation), 🎁 🎄 (Noël), 🍂 (automne), 🚨 👀 (urgence/dévoilement, série 2026),
  ⚜️ (Québec), 💪 😮. **Ne jamais en mettre plus de deux.**
- **Preview text : présent dans 85 % des envois, médiane 34 caractères.** Ce n'est pas un
  résumé : c'est un **complément** qui ajoute une information absente de l'objet.
  Exemples : objet `Vente de fin de saison 2026` → preview `Rabais + expédition gratuite` ;
  objet `Tirage du concours automnal 🚨🦋` → preview `+ autres nouvelles` ;
  objet `🚨 Annonce majeure 👀` → preview `Explication complète en vidéo`.
  Le motif « **+ quelque chose** » est très fréquent.

---

## 5. Identité visuelle — spécifications exactes

### 5.1 Palette

| Rôle | Couleur | Usage mesuré |
|---|---|---|
| **Doré Lasclay** | `#D4AD67` | couleur signature : **tous** les liens, **tous** les fonds de bouton (160/160), les accents. 2 597 occurrences |
| Texte principal | `#222222` | corps de texte (1 505 occurrences) |
| Texte inversé / bouton | `#FFFFFF` (`#FFF`) | libellé de bouton |
| Gris secondaire | `#727272` | pied de page, mentions légales (298 occurrences) |
| Gris de note | `#707070` – `#807F7F` | ligne « si le bouton ne fonctionne pas » |
| Fond de page | `#FFFFFF` | 100 % des envois |
| Surlignage | `#FFDE00` (jaune) | rare (12 occurrences) — réservé aux **codes promo** |
| Filet de séparation | `#CCC` | `solid 1px`, largeur 100 % |

**Aucune ombre portée (`box-shadow`) n'existe dans le corpus** — 0 occurrence sur 325
envois. Le style est plat, propre, sans effet. Ne pas en ajouter.

### 5.2 Typographie

- **Police unique : Arial** (3 359 occurrences ; `Geneva` n'apparaît qu'en repli système).
  Aucune police web personnalisée n'est réellement utilisée dans le rendu.
- **Corps de texte : 14 px**, interligne **1.5**, couleur `#222222`, alignement à gauche.
- Échelle réellement utilisée : **12 px** (pied de page) · **13 px** · **14 px** (base) ·
  **15-16 px** (paragraphes mis en avant) · **18 px** (sous-titres, numéros de liste) ·
  **20 px** (titre de section) · **24 px** · **32 px** · **40 px** (rares titres bannière).
- **Crénage (letter-spacing) : `0px` partout** — 1 995 occurrences, aucune valeur non nulle.
  Ne jamais resserrer ni écarter les lettres.
- **Graisse** : `400` par défaut, `700` pour le gras. Pas de graisse intermédiaire.
- Le **gras porte le sens** : on met en gras la thèse de chaque section, pas des mots isolés.
  C'est le principal outil de hiérarchie du corpus (il y a très peu de vrais titres `<h*>`).
- **Italique** : rare, pour les notes et mentions.
- **Souligné** : réservé aux liens (les liens sont dorés **et** soulignés).

### 5.3 Liens

```
couleur #D4AD67 · text-decoration: underline · souvent en gras
```
Un lien est presque toujours un **groupe nominal explicite** (« [produits isolés] »,
« [ce court questionnaire] », « [cette vidéo] »), jamais « cliquez ici ».

### 5.4 Boutons

Spécification dominante mesurée :

```
fond            #D4AD67          (160/160 boutons — aucune autre couleur)
texte           #FFFFFF
police          Arial, 700
taille          18 px (47) ou 20 px (45) ou 16 px (32)
rayon           30 px (34) · 40 px (34) · 20 px (28) · 34 px (23)   → toujours très arrondi
padding         25px 25px 25px 25px (71) · 25px 36px (20) · 20px 20px (20) · 20px 40px
alignement      center
crénage         0
text-transform  none  (la MAJUSCULE, quand elle existe, est tapée dans le libellé)
```

**Libellés** : longs, explicites, à la première personne de l'action, souvent avec le mot
« Lasclay » ou « asclépiade ». Exemples réels du corpus :
- « Profiter de la vente de fin de saison Lasclay » (13×)
- « Acheter des semences d'asclépiade »
- « Voir le catalogue complet de produits d'asclépiade »
- « Participer à la campagne et aider les monarques »
- « J'ai un terrain de plus de 1500 pi2, je veux y implanter l'asclépiade et m'inscrire. »
- « PRÉCOMMANDER LES PRODUITS LASCLAY »

Médiane : **0-1 bouton** par envoi, jusqu'à **5** quand il y a plusieurs offres parallèles.
Quand il y a plusieurs boutons, chacun est suivi de sa ligne de repli en petit gris :

> \* Si le bouton ne fonctionne pas, voici le lien: `https://…`  *(italique, ~#707070)*

### 5.5 Images

- **Largeur 600 px, pleine largeur du conteneur, `display:block`, centrées** (1 031 des
  ~1 110 images). Quelques 500 px et 564 px pour des visuels secondaires.
- Hébergement : `https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/…`
  (CDN Klaviyo du compte Lasclay) — formats `.jpeg`, `.png`, `.gif`.
- **Pas de rayon d'arrondi, pas d'ombre, pas de bordure.**
- Médiane **2 images** par infolettre : une photo-produit ou photo-terrain au milieu du
  récit, et une bannière de marque en pied.
- Les images sont souvent **cliquables** (`<a>` autour de l'`<img>`) vers la page produit.
- Bannières de pied récurrentes du corpus :
  - `…/8e1a8a3b-bc9f-4374-bcf2-76d514feb80f.jpeg` (52 envois)
  - `…/855e9941-e594-40a7-b5e4-898bbcfa5ec8.jpeg` (32 envois)
  - `…/a04a41e0-2a1a-4313-8d99-4395690b1b13.jpeg` (15 envois)

### 5.6 Gabarit et espacements

- Conteneur **600 px** de large, centré, fond blanc, sur fond de page blanc.
- Marges internes des blocs texte : **9 px haut/bas, 18 px gauche/droite** (valeur la plus
  fréquente) ; les blocs image sont à **0** de marge (bord à bord dans le conteneur).
- Padding haut de la coquille : 50 px ; bas : 20 px.
- Interligne 1.5 pour le texte, 1.1 pour les gros titres.

---

## 6. Formules réutilisables (extraites telles quelles du corpus)

**Ouverture** — 186 envois commencent exactement par :
```
Bonjour {{ first_name }},
```
(la variable est parfois `{{ person.first_name|default:'' }}` ; garder un repli vide pour ne
jamais afficher « Bonjour , »)

**Transitions**
- « Bref, nous avons travaillé fort, et sommes très fiers de… »
- « Et cette année, nous avons 3 grandes nouveautés: »
- « La nature fait bien les choses… »
- « Pour revoir notre catalogue, c'est par ici 👇 »

**Clôtures**
- « Un grand merci, et bon jardinage! »
- « Merci encore de ton soutien et de ton intérêt »
- « Merci de faire partie de notre communauté »
- « Merci d'être encore là {{ first_name }}. »
- « MERCI, MERCI MERCI! »

**Signature** (invariable) :
```
Chaleureusement,

**Gabriel**
Co-fondateur
Lasclay
```

**Pied de page** (invariable, 12 px, `#727272`, centré) :
```
Lasclay, 298 Boulevard des Capucins, Québec, QC, G1J3R4

Vous ne voulez plus recevoir notre infolettre?
{% unsubscribe 'Se désabonner' %}
```

---

## 7. Calendrier éditorial observé

| Période | Contenu récurrent |
|---|---|
| **Janvier** | Suivi des livraisons post-Noël ; promo « chaleur d'hiver » (cache-cous, foulards) |
| **Janvier-mars** | **Vente de fin de saison** (le rendez-vous commercial le plus régulier, tous les ans depuis 2021) |
| **Mars-avril** | **Campagne nationale de plantation d'asclépiade** — le pilier mission, tous les ans depuis 2021 |
| **Mai-juin** | Lancement des produits d'été (glacières, sacs-lunch, besaces) ; **prévente printanière** |
| **Juillet** | Promos d'été, bombes semencières |
| **Août** | Rentrée (sacs-lunch), annonce des nouveautés d'automne |
| **Fin août-septembre** | **Prévente automnale** : séquence de 3-4 réchauffements + suivis acheteurs/non-acheteurs |
| **Octobre** | « L'automne, la saison de l'asclépiade » (bandeaux, tuques) ; lancement du grand concours |
| **Novembre** | Concours + promos hebdomadaires ; suivis de précommande ; corporatif/Noël |
| **Décembre** | Dates limites de livraison, ramassages, cartes-cadeaux, Boxing Day |

---

## 8. Contraintes légales et techniques

- **LCAP / CASL** : tout envoi commercial doit porter l'adresse postale complète et un lien
  de désabonnement fonctionnel (`{% unsubscribe %}`) — c'est déjà dans le pied standard.
- Les **répondants de formulaire** et les contacts d'enquête sont sous **consentement
  tacite** (≈ 6 mois) : on peut leur écrire *au sujet de leur demande*, pas leur envoyer
  l'infolettre commerciale générale sans opt-in.
- Expéditeur : **`Lasclay <hey@lasclay.com>`** (invariable dans tout le corpus).
- Envoi en **throttled** pour les grosses campagnes (33 %/h observé) afin de ménager la
  réputation d'expédition.
- Smart sending désactivé sur les envois importants pour ne pas exclure les destinataires
  récemment contactés.

---

## 9. Liste de contrôle avant envoi

- [ ] Objet ≤ ~50 caractères, descriptif, ≤ 2 emoji
- [ ] Preview text présent et **complémentaire** à l'objet (pas une redite)
- [ ] Ouverture `Bonjour {{ first_name }},` avec repli vide
- [ ] **Vouvoiement** cohérent d'un bout à l'autre
- [ ] Une seule idée centrale, un seul appel à l'action (répété si besoin)
- [ ] La mission (monarque / asclépiade / territoire) apparaît avant l'offre
- [ ] Gras uniquement sur les idées porteuses
- [ ] Liens `#D4AD67` soulignés, libellés explicites (jamais « cliquez ici »)
- [ ] Bouton `#D4AD67`, texte blanc Arial 700 18-20 px, rayon ≥ 20 px, padding ≥ 20 px
- [ ] Ligne de repli « si le bouton ne fonctionne pas » si le bouton est critique
- [ ] Images en 600 px, sans ombre ni arrondi, avec `alt`
- [ ] Aucune ombre portée, aucun crénage non nul, aucune police autre qu'Arial
- [ ] Clôture « Chaleureusement, » + signature Gabriel / Co-fondateur / Lasclay
- [ ] Pied avec adresse 298 boulevard des Capucins + désabonnement
- [ ] Si un problème est mentionné : il est nommé franchement, expliqué, et une solution est donnée
