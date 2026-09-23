# Routine « Publication Instagram — asclépiade »

Trois publications par semaine qui célèbrent l'asclépiade et la relient à Lasclay sans rien
vendre. Même image sur deux comptes, deux légendes écrites séparément :

| Compte | Langue | Compte Buffer | Canal |
| --- | --- | --- | --- |
| @lasclay | français | `main` (operations@) | `68e6c20cca3a4e6b746c45e7` |
| @milkweed.company | anglais | `3` (media@) | `69a761e23f3b94a12111f98a` |

Les deux canaux publient eux-mêmes (`defaultToReminders: false`, vérifié le 23 sept. 2026).

## Horaire

La Routine tire **la veille au soir** et programme la publication du lendemain matin. Gabriel
reçoit le rapport le soir et peut corriger ou annuler dans Buffer pendant la nuit.

| Tir (heure de l'Est) | Publication @lasclay | Publication @milkweed.company |
| --- | --- | --- |
| lundi 18 h | mardi 8 h | mardi 9 h |
| mercredi 18 h | jeudi 8 h | jeudi 9 h |
| samedi 18 h | dimanche 9 h | dimanche 10 h |

`cron_expression` : `0 22 * * 1,3,6` (UTC). En heure normale (novembre à mars), le tir part à
17 h au lieu de 18 h : aucun décalage de jour, rien à changer. Les créneaux de publication, eux,
sont calculés en heure de Toronto par `publier.js` et suivent les changements d'heure.

### Pourquoi pas midi

Sur les 39 publications Instagram de @lasclay passées par Buffer (relevé du 23 sept. 2026) :

- les **deux records de vues** sont des **dimanches matin** : 4 886 vues à 8 h 30, 4 181 à 9 h 30 ;
- les quatre publications faites **entre midi et 14 h** ont atteint 400 à 570 personnes, et trois
  des quatre sont sous la médiane de leur période (≈ 700 en 2023-2025) ;
- les matins de semaine de septembre 2026 vers 8 h ont atteint jusqu'à 700 personnes.

L'échantillon est mince (six ans, contenus très différents) : c'est un indice, pas une preuve.
La Routine teste donc ces matins et on tranche sur nos propres chiffres après 20 publications :
portée par créneau dans les statistiques Buffer, comparée à `publier.js etat`.

Pour déplacer un créneau : `CRENEAUX` dans `publier.js`, et le `cron_expression` de la Routine
pour qu'elle tire la veille.

## Ce que fait un tir

`PROCEDURE.md` fait autorité. En bref : `preparer` → regarder et annoter 8 candidats → écrire
FR et EN → `apercu` (regarder le rendu exact) → `programmer` → pousser `etat/`.

## Médias

Le Drive partagé par lien, lu sans clé par `social/drive.js` : VOLCANO (priorité) et
« 1.4.3 Photos - Vidéos - Illustration ». Le vivier ne garde que ce qui parle de la plante, de
ses insectes et de ses graines (≈ 440 médias au 23 sept. 2026). Les images sont recadrées en 4:5
par le service d'images de Google, sans hébergement ; Buffer accepte cette URL (vérifié par un
brouillon de test, supprimé ensuite).

## Branche

Le code vit sur `main` une fois fusionné. Tant que ce n'est pas fait, la Routine travaille sur
`claude/wizardly-goodall-knr9hj` et y pousse son état.

## Suspendre

`update_trigger` avec `enabled: false`. Une publication déjà programmée se retire dans Buffer
(Publier → file du canal).
