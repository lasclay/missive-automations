# Tir A — 7 réponses rédigées, EN ATTENTE DE PUBLICATION

**Date du tir** : 2026-08-19, 23 h (Est) · intensité 0.25 · `n_vise` 10
**Règle de priorité** : aucun commentaire du jour, lot entier au backlog (124 candidats, 0 du jour).

## Ce qui bloque

`node fb-backlog/traiter.js publier … --tir A` est **refusé par le classificateur de
permissions du mode auto** de la session, deux fois de suite, avant même que le script
s'exécute. Ce n'est ni une erreur Meta, ni une limite de débit, ni un code 368 : rien n'a
atteint Facebook. Le même symptôme était déjà noté à la fin de `diagnostic-A.md`.

Aucun contournement n'a été tenté : publier sur les Pages est une action publique, et forcer
le passage irait contre l'intention du refus.

## Comment débloquer

Une règle de permission Bash autorisant `node fb-backlog/traiter.js publier …` dans les
réglages de la session. Ensuite :

```
node fb-backlog/traiter.js publier fb-backlog/etat/A-en-attente-publication.json --tir A
```

Le fichier est au format attendu par le script et prêt tel quel. `traiter.js` relira
`A-repondus.json` et cadencera lui-même : rien à refaire.

## Les 7 réponses

| # | Page | Commentaire | Thème |
| --- | --- | --- | --- |
| 1 | Asclépiade | « J'aimerais beaucoup, un jour, avoir des habits d'hiver en asclépiade… Pis un jour, une couette de lit? » | 17 — offre courante, aucune date de lancement |
| 2 | Lasclay | « Il me semble en avoir vu dans la région de Sept-Îles ??? » | 16 — zones 3 à 9 ; 4 — les follicules à l'automne |
| 3 | Lasclay | Gants de travail de jardinage résistants aux épines | 17 — gants en développement, aucune date |
| 4 | Asclépiade | « Avez-vous un dépositaire à Bromont ou autour de Bromont ? » | 6 — lasclay.com ; le cas précis se poursuit en privé |
| 5 | Lasclay | Mitaines longues qui embarquent sur la manche, ski alpin | 11 et 17 — renvoi aux fiches produit, aucune mensuration improvisée |
| 6 | Asclépiade | « C'est préférable dans un endroit très ensoleillé où plus à l'ombre? » | 20 — plein soleil, en talle plutôt qu'isolé |
| 7 | Asclépiade | « si les chevreuils mangent ces fleurs ? » | 15 — le latex amer, les chevreuils évitent |

Registre respecté par Page : sobre (0 à 1 emoji) pour Lasclay, chaleureux (1 à 2 emoji) pour
Asclépiade & papillons monarques. Vouvoiement partout. Aucun prix, aucune date de livraison,
aucun « fabriqué au Québec » pour un produit fini.

## Écartés au même tir

Trois, consignés avec leur motif dans `A-a-revoir.json` : une question sur l'épilobe (hors
faits vérifiés), une diatribe de 2020 sur l'exploitation de la nature, et une demande de part
de marché (donnée commerciale non publique).
