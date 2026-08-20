# Brief pour Cowork — aller lire les 27 avis sur la fiche Google

Ce brief est fait pour être exécuté par un agent qui a un **navigateur** et la **session Google
de Lasclay**, ce que la session qui a produit ce dossier n'avait pas. Il complète
`croisement.md` et `messages.md` : il ne les remplace pas.

## Pourquoi ce brief existe

La liste des 27 avis a été reconstituée à partir des notifications
`businessprofile-noreply@google.com` reçues dans Gmail, une par avis publié depuis 2021. Google
**tronque le texte de l'avis** dans ces courriels, et la coupure tombe souvent juste avant le mot
qui compte :

> « Les mitaines sont de bonne qualité, mais le service à la clientèle est épouvantable. J'… »
> « J'ai acheté les semelles, elles sont bien chaudes, mais le problème c'est qu'elles ne sont pas… »

Trois choses sont donc inconnues et bloquent l'envoi des brouillons :

1. **Le texte complet** de chaque avis.
2. **Si l'avis existe encore.** Un auteur peut l'avoir supprimé ou modifié depuis ; la
   notification, elle, reste dans Gmail pour toujours.
3. **Si Lasclay a déjà répondu publiquement**, et ce qui a été répondu.

## Périmètre — lecture seule, sans exception

| Autorisé | Interdit |
| --- | --- |
| Ouvrir la fiche et lire les avis | Cliquer « Répondre » ou publier quoi que ce soit |
| Copier le texte intégral d'un avis | Signaler, masquer ou demander la suppression d'un avis |
| Noter les réponses du propriétaire déjà publiées | Écrire à un client, par courriel ou autrement |
| Écrire les résultats dans le dépôt | Modifier `messages.md` ou envoyer un brouillon |

**Aucun avis ne se signale à Google.** Même celui de « patrick lambert », qui est une opinion sur
l'origine des produits et non un litige : c'est un avis légitime. Signaler un avis qui déplaît
est le meilleur moyen de perdre la fiche.

## Où aller

- Console propriétaire : <https://business.google.com/n/715788570095415146/reviews>
- Fiche publique (si la console résiste) :
  `https://www.google.com/maps/place/?q=place_id:ChIJeXcP65DHd6YRhr5TXMN_4-M`
- Repères : `place_id ChIJeXcP65DHd6YRhr5TXMN_4-M` · `ludocid 16421109143367302790` ·
  `feature_id 0xa677c790eb0f7779:0xe3e37fc35c53be86`

Dans la console, trier par **note la plus basse** pour remonter les 1★ puis les 2★ et 3★ d'un
coup. Faire défiler jusqu'à épuisement : la liste charge par paquets.

## Ce qu'il faut rapporter

### 1. Deux chiffres d'ensemble, en tête de rapport

- La **note globale** affichée aujourd'hui (elle était à **4,4 / 5** au moment de l'audit).
- Le **nombre total d'avis** affiché, toutes notes confondues.

Ces deux chiffres servent de contrôle : s'ils ont bougé, la liste ci-dessous a bougé aussi.

### 2. Une ligne par avis de 1 à 3 étoiles

Écrire le résultat dans **`avis-negatifs/avis-complets.jsonl`**, un objet JSON par ligne :

```json
{"nom":"Patrick Lessnick","etoiles":2,"date":"2026-03-03","present":true,
 "texte":"<texte intégral, verbatim, sans reformulation>",
 "reponse_proprietaire":null,
 "note":"<remarque libre, ou vide>"}
```

| Champ | Ce qu'il contient |
| --- | --- |
| `nom` | le nom d'auteur **tel qu'affiché sur la fiche** — pas celui de notre liste s'il diffère |
| `etoiles` | 1, 2 ou 3, **relu sur la fiche** |
| `date` | la date réelle si la fiche la donne, sinon la mention relative telle quelle (« il y a 2 mois ») |
| `present` | `true` si l'avis est toujours en ligne, `false` s'il a disparu |
| `texte` | le texte **intégral et verbatim**. Cliquer « Plus » avant de copier. Ne rien corriger, ne rien traduire, ne rien résumer |
| `reponse_proprietaire` | le texte de la réponse de Lasclay si elle existe, sinon `null` |
| `note` | tout écart avec notre liste : note différente, avis modifié, doublon, avis d'un même auteur sur plusieurs produits |

Si Google affiche la traduction anglaise d'un avis écrit en français, **copier l'original**
(bouton « Voir l'original » / « See original »), pas la traduction.

### 3. Les 27 avis à retrouver

La liste de référence est `avis-negatifs/google_avis_negatifs.tsv`. Chaque ligne doit se
retrouver dans le rapport, y compris celles marquées absentes.

**Priorité de lecture**, si le temps manque — ce sont les cinq où le texte tronqué bloque
réellement une décision :

| Ordre | Auteur | Pourquoi celui-là d'abord |
| --- | --- | --- |
| 1 | **David** · 1★ · 23 déc. 2025 | Prénom seul. Dix « David » ont commandé dans la fenêtre. S'il nomme un produit ou une ville, on peut enfin l'identifier |
| 2 | **Emma Nelson** · 1★ · 29 juin 2026 | Aucune cliente de ce nom. À rapprocher d'**Emma Whiten**, commande L-50672 du 8 juin **encore non expédiée**. Le texte complet peut trancher |
| 3 | **Jimmy Allaire** · 3★ · 2 mars 2026 | Le seul 3★, le plus facile à faire remonter. Le texte coupe pile au moment où il nomme le défaut des semelles |
| 4 | **Marijo** · 2★ · 14 janv. 2024 | Prénom seul, aucune correspondance |
| 5 | **Annie Hubert** · 1★ · 8 janv. 2026 | « trop serré et trop… » — la suite dit quoi corriger sur la coupe du cache-cou |

### 4. Les avis qu'on ne connaît pas

Si la fiche montre un avis de 1 à 3 étoiles **absent de `google_avis_negatifs.tsv`**, l'ajouter
au rapport avec `"note":"absent de la liste"`. C'est possible : une notification a pu ne jamais
partir, ou un avis 4-5★ a pu être révisé à la baisse depuis.

## Quand c'est écrit

```
git checkout claude/lasclay-negative-reviews-outreach-g2ddoc
git pull --rebase
# écrire avis-negatifs/avis-complets.jsonl
git add avis-negatifs/avis-complets.jsonl && git commit && git push
```

Puis résumer en clair, sans JSON :

- la note globale et le nombre d'avis aujourd'hui ;
- combien des 27 sont **toujours en ligne**, combien ont disparu ;
- combien ont **déjà une réponse publique** de Lasclay, combien n'en ont aucune ;
- les avis dont le texte complet **change la lecture du dossier** — surtout les cinq prioritaires ;
- les avis inconnus trouvés en chemin.

## Ce que ça débloque ensuite

Une fois `avis-complets.jsonl` en place, deux choses redeviennent possibles et devront être
faites par un humain ou dans une session de suivi :

1. **Corriger les brouillons de `messages.md`** avec ce que les avis disent vraiment. Plusieurs
   messages font une hypothèse sur la fin de la phrase coupée — cette hypothèse doit sauter.
2. **Répondre publiquement aux avis restés sans réponse.** Cette réponse-là n'est pas pour le
   client fâché : elle est pour les gens qui liront la fiche avant d'acheter.

⚠️ **Rappel qui vaut pour toute la suite.** Ne jamais conditionner une carte-cadeau, un
remboursement ou un remplacement au retrait ou à la modification d'un avis. C'est interdit par
les règles Google sur les faux avis et c'est une pratique commerciale trompeuse au sens de la
*Loi sur la protection du consommateur* du Québec.
