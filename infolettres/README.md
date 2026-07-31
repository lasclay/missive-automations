# Archive des infolettres Lasclay

Export exhaustif des **325 infolettres envoyées** via Klaviyo entre le 2020-10-22 et le
2026-06-20, transcrites en Markdown avec leur mise en page, plus le HTML d'origine.

| Fichier | Contenu |
|---|---|
| [`GUIDE-REDACTION.md`](GUIDE-REDACTION.md) | **Le guide de style complet** : ton, structure, palette, typographie, boutons, images, formules, calendrier éditorial, liste de contrôle. C'est le fichier à lire pour écrire une nouvelle infolettre. |
| [`INDEX.md`](INDEX.md) | Index chronologique des 325 envois : date, objet, preview text, langue, type, audience. |
| `infolettres-<année>.md` | Transcription intégrale des envois de l'année (2020 → 2026). |
| `html/<date>-<nom>.html` | HTML Klaviyo d'origine, fidélité maximale (rendu exact). |

## Comment lire les transcriptions

Le texte est en Markdown normal. Les éléments visuels sont explicités :

- `> *(texte — Arial, 15px (base 14px), interligne 1.5, #222222; marges 9px 18px 9px 18px)*`
  décrit la typographie du bloc qui suit. `base` = taille du bloc, la valeur principale
  étant la taille dominante réellement utilisée dans le bloc.
- `**[IMAGE]** ![alt](url)` suivi de `> *(largeur 600; align. center; lien → …)*`
- `**[BOUTON]** « Libellé » → url` suivi de `> *(fond #D4AD67; texte #FFFFFF; rayon 30px; padding …; 18px graisse 700)*`
- `---` + `> *(séparateur solid 1px #CCC, largeur 100%)*` pour les filets
- `> *(espace vertical 24px)*` pour les espaceurs
- Les écarts de style inline sont annotés entre accolades : `{16px}`, `{couleur #D4AD67}`,
  `{surligné #FFDE00}`, `{police Georgia}`.

Le gras, l'italique, le souligné et les hyperliens sont conservés en Markdown
(`**gras**`, `*italique*`, `<u>souligné</u>`, `[texte](url)`).

## Régénérer l'archive

Les données viennent du proxy général (connecteur Klaviyo en lecture seule) :

```bash
node connectors_client.js klaviyo campaigns '{"filter":"equals(messages.channel,'"'"'email'"'"')","page[size]":100,"include":"campaign-messages","sort":"-created_at"}'
node connectors_client.js klaviyo template '{"id":"<TEMPLATE_ID>"}'
```

Le HTML de chaque gabarit est dans `attributes.html`.
