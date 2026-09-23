# Procédure d'un tir — publication Instagram

Un tir remplit **un** créneau : une publication sur **@lasclay** (français) et la même image sur
**@milkweed.company** (anglais, une heure plus tard). Le script porte la mécanique, tu portes
trois choses qu'un script ne sait pas faire : **regarder**, **choisir**, **écrire**.

Skills à charger avant d'écrire une ligne : `selection-images` (choisir et cadrer),
`copywriting-lasclay` (voix, garde-fous), `lasclay-master` (faits de marque). N'explore pas le
dépôt pour trouver comment joindre Buffer : `publier.js` le fait par le General Proxy.

## 1. Préparer

```
git pull --rebase
node social/publication/publier.js preparer > /tmp/lot.json
```

- `"deja": true` → le créneau est déjà programmé. Dis-le en une ligne et **arrête-toi**.
- Sinon le lot donne : le `creneau` (heure de l'Est), l'`angle` avec ses `faits` et ses
  `pieges`, et 8 `candidats` avec un `apercu` (fichier JPEG local).

L'inventaire du Drive n'est pas versionné : il se refait au premier `preparer` d'un conteneur neuf, puis tous les 7 jours (≈ 2 minutes, c'est normal).

## 2. Regarder chaque candidat

Ouvre **chaque** `apercu` avec `Read`. Un candidat qu'on n'a pas regardé ne se choisit pas.
Applique `selection-images` dans l'ordre : vérité botanique, clarté, qualité, cadrage.

Annote **tous** les candidats regardés, retenus ou non :

```
node social/publication/publier.js noter /tmp/annotations.json
```

Si aucun candidat ne tient : relance `preparer` (le tirage change), ou force un autre angle de
saison avec `--theme <id>`. Deux lots vides d'affilée : arrête-toi et dis-le, le vivier a un
problème.

## 3. Écrire les deux légendes

**L'image commande l'angle, pas l'inverse.** Si la meilleure photo du lot montre une chenille
alors que l'angle tiré parle de graines, prends l'angle `chenille-toxicite` (ses faits sont dans
`themes.json`) et note ce changement dans `theme`.

**Seuls les `faits` de l'angle sont permis**, plus ce que l'image montre. Ce qui n'y est pas ne
s'écrit pas : aucun chiffre de mémoire, aucune durée, aucune statistique.

### Structure — courte, 350 à 700 caractères

1. **Première ligne (≤ 125 caractères, c'est tout ce qu'on voit avant « plus »)** : ce que
   montre l'image, dit de façon concrète et un peu étonnante. Pas « Magnifique asclépiade ! ».
2. **Le mécanisme, en deux à quatre phrases** : pourquoi la plante ou l'insecte est fait ainsi.
   C'est la partie qui glorifie, parce qu'elle fait comprendre.
3. **Le pont vers Lasclay, une ou deux phrases, fluide** : pourquoi ça nous concerne. Jamais une
   vente, jamais un lien, jamais « achetez ». Exemples de ponts justes : la soie qui isole la
   graine est celle qu'on transforme en isolant ; donner une valeur à la plante pour que des
   cultivateurs la gardent dans leurs champs ; les graines qu'on redistribue.
4. **Ligne vide, puis 3 à 5 hashtags**. Le premier commentaire n'est pas disponible (forfait
   Buffer gratuit) : les hashtags restent dans la légende.

### Français (@lasclay)

Français québécois propre, **vouvoiement** si on s'adresse au lecteur, « on » pour l'équipe.
Zéro ou un émoji. Pas de cadratin. Hashtags : `#asclépiade` `#monarque` `#papillonmonarque`
`#plantesindigènes` `#soiedasclépiade` `#Québec`, selon le sujet.

### Anglais (@milkweed.company)

**Écrit pour son public, pas traduit** : lecteurs américains et canadiens anglais qui
connaissent le monarque et la « native plant » mieux que le Québec. Plainspoken, concret, jamais
startup-hype. Nommer le Québec quand il porte le sens (« grown and processed in Québec » pour
l'isolant seulement). Hashtags : `#milkweed` `#monarchbutterfly` `#nativeplants`
`#pollinatorgarden` `#milkweedfloss`.

### Les pièges qui reviennent

- Lasclay **achète** l'asclépiade à des cultivateurs, **elle ne la cultive pas**. Jamais « nos
  champs », « on plante massivement ». Ce qui est vrai : on donne une valeur à la plante pour que
  sa culture tienne, et on redistribue des graines (environ 10 millions en 5 campagnes).
- Jamais « sauver les monarques » : le lien est systémique.
- « Fabriqué au Québec » s'applique à l'**isolant**, jamais à un produit fini.
- « Hydrophobe » ou « résistante à l'eau », jamais « imperméable ».
- Pas d'antithèse automatique (« ce n'est pas X, c'est Y »).
- Test final de `copywriting-lasclay` : une autre marque écoresponsable pourrait-elle signer ce
  texte ? Si oui, il n'est pas prêt.

### Texte alternatif

Une phrase par langue qui décrit l'image pour quelqu'un qui ne la voit pas : sujet, couleur,
lumière. Pas de hashtag, pas de message de marque.

## 4. Vérifier le rendu

`/tmp/publication.json` :

```json
{
  "media_id": "1VvkpvClJI5JDadUHzkZqU7ItSftDgbi1",
  "format": "4:5",
  "theme": "fleur-pollinies",
  "fr": { "legende": "…", "alt": "…" },
  "en": { "legende": "…", "alt": "…" }
}
```

```
node social/publication/publier.js apercu /tmp/publication.json
```

- **Ouvre le `rendu` avec `Read`** : c'est l'image exacte qu'Instagram recevra. Sujet coupé,
  ombelle collée au bord : change de `format` ou d'image, puis recommence l'aperçu.
- `erreurs` bloquent la programmation. Corrige-les.
- `avis` ne bloquent pas, mais chacun se tranche : corrige, ou garde en sachant pourquoi.

## 5. Programmer

```
node social/publication/publier.js programmer /tmp/publication.json
```

Le script revérifie tout, programme FR puis EN dans Buffer (`customScheduled`, publication
automatique au créneau) et journalise. Code de sortie :

- `0` : les deux sont programmées. Rapporte les deux identifiants Buffer.
- `2` : erreurs de contrôle, rien n'est parti. Corrige et relance.
- `3` : échec Buffer. Si le français est passé et l'anglais non (`partiel`), **ne relance pas
  `programmer`** : le créneau est pris et le français partirait en double. Rapporte l'erreur
  exacte, Gabriel complète à la main.

Une publication programmée se corrige ou s'annule dans Buffer **jusqu'à l'heure du créneau**.
Une fois partie, Instagram n'offre aucune correction de légende. D'où l'ordre : tout vérifier
avant `programmer`.

## 6. Pousser l'état

```
git add social/publication/etat/ && git commit -m "Publication Instagram : <libellé du créneau>" && git pull --rebase && git push
```

`journal.jsonl` empêche de republier un média ou de remplir deux fois un créneau ;
`vus.json` est la mémoire de la banque. Les deux doivent survivre au conteneur.

## Rapport

Court : créneau, angle, média (chemin), les deux légendes telles que programmées, les deux
identifiants Buffer, et les avis que tu as choisi de garder. S'il n'y avait rien à faire, une
ligne.
