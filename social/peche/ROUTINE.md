# Canne à pêche — commentaires grassroots (Cowork + Chrome)

Commenter, de façon naturelle et non sollicitante, la photo d'asclépiade ou de monarque d'un
inconnu, depuis un compte Lasclay, pour que la personne découvre Lasclay d'elle-même.

La méthode complète (identités, tri, écriture, plafonds, signaux de blocage, journal) vit dans le
skill **`commentaires-sociaux`**, pour qu'une tâche Cowork la trouve sans le dépôt.

## Pourquoi ce n'est pas une Routine infonuagique

Aucune API ne permet de commenter la publication d'un tiers :

- **Instagram** : l'API Graph ne commente que les médias du compte lui-même, ou ceux où il est
  @mentionné (`POST /{ig-user-id}/mentions`). La recherche par hashtag exige en plus la
  fonctionnalité *Instagram Public Content Access*, soumise à l'examen de Meta.
- **Facebook** : une Page ne commente par l'API que ses propres publications ; les groupes n'ont
  plus d'API depuis 2024.
- **Composio** n'expose rien de plus (outils Instagram vérifiés le 23 sept. 2026 :
  publication, commentaires reçus, messages).

La seule voie est le navigateur, connecté aux comptes : **Cowork sur l'ordinateur de Gabriel,
avec Claude dans Chrome**. Une Routine infonuagique n'a ni ce navigateur ni ces sessions.

## Risque, choisi en connaissance de cause

Les conditions d'Instagram et de Facebook interdisent l'interaction automatisée ; le risque est
un blocage d'action, au pire la suspension d'un compte. Gabriel a choisi ce mode le
23 septembre 2026. Le skill le borne : 3 commentaires par identité et par jour pendant 14 jours,
6 ensuite (8 au grand maximum), 3 à 12 minutes d'écart, tout texte écrit sur mesure, arrêt de
72 h au premier signal de blocage, 14 jours au deuxième.

## Installation (une fois)

1. **Chrome** : ouvrir une session Instagram sur **@lasclay** et y ajouter **@milkweed.company**
   (menu du profil → Ajouter un compte), pour que le changement de compte se fasse en un clic.
   Ouvrir une session Facebook avec le profil qui administre les Pages **Lasclay** et
   **Lasclay: The Milkweed Company**.
2. **Skills** : téléverser `commentaires-sociaux.skill` et `selection-images.skill` dans
   claude.ai → Paramètres → Fonctionnalités → Skills. Ils deviennent visibles dans Cowork. Les
   activer aussi : `copywriting-lasclay` et `lasclay-master`, déjà présents.
3. **Dossier de travail** : créer un dossier, par exemple `Documents/Lasclay/peche`. Le journal
   et l'état y vivront (`peche-journal.jsonl`, `peche-etat.json`).
4. **Cowork → Tâches planifiées** : deux tâches, dans ce dossier, avec Claude dans Chrome activé.

| Tâche | Horaire | Identités |
| --- | --- | --- |
| Pêche FR | tous les jours, 10 h 20 | Instagram @lasclay, Page Lasclay |
| Pêche EN | tous les jours, 15 h 40 | Instagram @milkweed.company, Page Lasclay: The Milkweed Company |

Deux tâches plutôt qu'une : chacune dure environ une heure à rythme humain, et l'anglais tombe
à une heure où le public américain est actif.

### Message de la tâche « Pêche FR »

```
Canne à pêche Lasclay, volet FRANÇAIS. Charge d'abord le skill `commentaires-sociaux` et suis-le
à la lettre ; charge aussi `selection-images` pour juger chaque photo.

Identités de ce tir : Instagram @lasclay, puis la Page Facebook « Lasclay ». Rien d'autre.

1. Lis `peche-etat.json` et `peche-journal.jsonl` dans ce dossier (crée-les s'ils manquent,
   avec premier_jour = aujourd'hui). Une plateforme en pause ne se touche pas.
2. Réponds d'abord, une fois et brièvement, aux gens qui ont répondu à nos commentaires.
3. Puis pêche, identité par identité, dans les plafonds du jour, à rythme humain.
4. Vérifie l'identité affichée avant CHAQUE commentaire. Au moindre signal de blocage, arrête
   la plateforme, écris la pause, et passe au rapport.
5. Rapport court selon la section 10 du skill.
```

### Message de la tâche « Pêche EN »

```
Canne à pêche Lasclay, volet ANGLAIS. Charge d'abord le skill `commentaires-sociaux` et suis-le
à la lettre ; charge aussi `selection-images` pour juger chaque photo.

Identités de ce tir : Instagram @milkweed.company, puis la Page Facebook « Lasclay: The
Milkweed Company ». Rien d'autre. Commentaires en anglais seulement, sur des publications en
anglais.

1. Lis `peche-etat.json` et `peche-journal.jsonl` dans ce dossier (crée-les s'ils manquent,
   avec premier_jour = aujourd'hui). Une plateforme en pause ne se touche pas.
2. Réponds d'abord, une fois et brièvement, aux gens qui ont répondu à nos commentaires.
3. Puis pêche, identité par identité, dans les plafonds du jour, à rythme humain.
4. Vérifie l'identité affichée avant CHAQUE commentaire. Au moindre signal de blocage, arrête
   la plateforme, écris la pause, et passe au rapport.
5. Rapport court selon la section 10 du skill.
```

Les deux tâches partagent le même dossier : le journal commun empêche deux identités Lasclay
de commenter la même personne dans les 30 jours, et une pause Instagram écrite par une tâche
arrête aussi l'autre.

## Mesurer

Au bout de trois semaines : abonnés gagnés sur @lasclay et @milkweed.company (Buffer ou
Instagram), nombre de commentaires au journal, taux de réponse. Si le rodage passe sans
blocage et que les réponses sont bonnes, on peut passer de 6 à 8 par identité. Pas avant.
