# Gabarits Omnisend en blocs natifs

Un courriel importé en HTML (`post_email_templates_import`) arrive dans Omnisend comme **un
seul bloc de code**. Il s'affiche correctement, mais l'éditeur visuel ne peut pas entrer
dedans : double-cliquer sur un paragraphe n'ouvre rien, le panneau de droite montre
« HTML Code » au lieu des réglages de texte.

Pour que Gabriel puisse modifier le texte à la main, il faut passer par
**`post_email_templates`** (structuré) et non par `post_email_templates_import`. Chaque
paragraphe devient alors un bloc `text` éditable, chaque bouton un bloc `button`.

## Ce que l'API exige, et qui n'est pas dans la doc d'introduction

- `generalSettings` doit contenir les trois `buttonPresets` (`primary_button`,
  `secondary_button`, `tertiary_button`) et les cinq `textPresets` (`heading_large`,
  `heading_medium`, `heading_small`, `paragraph`, `footnote`). Aucun ne peut manquer.
- Chaque preset de bouton exige `fontFamily`. Chaque preset de texte exige `fontFamily`,
  `color` **et** `lineHeight`.
- Chaque bloc exige un `styleProperties` non vide.
- Chaque section, rangée, colonne et bloc exige un `id` de 24 caractères hexadécimaux,
  unique dans le gabarit.
- Jamais de `<h1>`–`<h6>` : un titre est un `<p>` avec `stylePresetID: heading_small`.

## Limite d'envoi du connecteur

Les appels dépassant environ 7,5 ko arrivent tronqués de façon irrégulière et échouent sur
« could not be parsed as JSON ». D'où les styles compacts (`Arial` plutôt que
`Arial, sans-serif`, apostrophes dans le HTML, pas de couleur en ligne sur les liens).
Les scripts de ce dossier génèrent la charge exacte ; il suffit de la recopier dans l'appel.
