# Passage à Dragons' Den — page et slide sur lasclay.com

Diffusion : **jeudi 17 septembre 2026, 20 h** (20 h 30 à Terre-Neuve), CBC et CBC Gem.
Premier épisode de la 21e saison. Réalisé le 14 septembre 2026.

Tout vit dans Shopify (thème, page, fichiers) — rien de ce dépôt n'est déployé pour ça.
Ce document sert d'aide-mémoire et de plan de restauration.

## 1. Thème dupliqué

| | |
| --- | --- |
| Source (live au moment de la copie) | `sep 2026 v2` — `gid://shopify/OnlineStoreTheme/164709138651` |
| Copie de travail | `Dragons Den sept 2026 (copie de sep 2026 v2)` — `gid://shopify/OnlineStoreTheme/165022335195` |
| Statut | **UNPUBLISHED** (brouillon) — rien n'a été publié |
| Aperçu | `https://lasclay.com/?preview_theme_id=165022335195` |

Seul fichier modifié : `templates/index.json`.

## 2. Slide ajoutée au slideshow

Bloc `image_dragonsden`, placé **en première position** du slideshow de l'accueil.

```json
"image_dragonsden": {
  "type": "image",
  "settings": {
    "image": "shopify://shop_images/lasclay-dragons-den-slideshow.jpg",
    "mobile_image": "shopify://shop_images/lasclay-dragons-den-slideshow-mobile.jpg",
    "slide_link": "shopify://pages/dragons-den",
    "overlay_position": "position--left position--bottom",
    "overlay_position_mobile": "position--hcenter-xs position--vcenter-xs",
    "subheading": "Jeudi 17 septembre, 20 h, sur CBC",
    "title": "Lasclay passe à Dragons' Den",
    "title_size": 48,
    "title_width": 14,
    "heading_h1": false,
    "text": "<p>Notre fondateur est allé défendre l'asclépiade devant les dragons, <br/>au premier épisode de la 21e saison.</p>",
    "enlarge_text": true,
    "button_label": "Lire notre histoire"
  }
}
```

### ⚠️ Slide retirée pour faire de la place

Le slideshow du thème **plafonne à 8 blocs**. Pour ajouter celle des dragons, la slide
**« Matériaux d'asclépiade »** (`image_VPW8wc`, collection *Matières*, public DIY — la moins
commerciale et la dernière en ordre) a été retirée. Pour la remettre après la diffusion,
enlever `image_dragonsden` et réinsérer ceci dans `blocks` + en fin de `block_order` :

```json
"image_VPW8wc": {
  "type": "image",
  "settings": {
    "image": "shopify://shop_images/tissu-isolant-matelasse-asclepiade-soie-Lasclay-2048x1024.jpg",
    "mobile_image": "shopify://shop_images/tissu-isolant-matelasse-asclepiade-soie-Lasclay-2048x1024.jpg",
    "slide_link": "shopify://collections/matieres",
    "overlay_position": "position--left position--bottom",
    "overlay_position_mobile": "position--hcenter-xs position--vcenter-xs",
    "subheading": "Pour les créatifs et les curieux",
    "title": "Matériaux d'asclépiade",
    "title_size": 56,
    "title_width": 12,
    "heading_h1": false,
    "text": "<p>Envie de créer vos propres produits à base d'asclépiade ? </p>",
    "enlarge_text": true,
    "button_label": "Explorez la collection Matières"
  }
}
```

(Le thème live `sep 2026 v2` contient toujours cette slide intacte.)

## 3. Page créée

| | |
| --- | --- |
| ID | `gid://shopify/Page/138296918235` |
| Handle | `dragons-den` (identique en FR et en EN) |
| FR | https://lasclay.com/pages/dragons-den |
| EN | https://lasclay.com/en/pages/dragons-den |
| Statut | **publiée** (visible tout de suite, même sans publier le thème) |

- Titre FR « Lasclay à Dragons' Den », EN « Lasclay on Dragons' Den ».
- Traduction anglaise enregistrée via `translationsRegister` (titre, corps, meta title,
  meta description). Les liens internes de la version EN sont préfixés `/en/`.
- Contenu : l'annonce, pourquoi l'asclépiade, l'effondrement de la filière 2018 et le
  redémarrage en 2020, ce qui a été apporté sur le plateau, encadré « Comment nous
  regarder », code **DRAGONS15**, remerciements, contact média.
- **L'issue de la rencontre n'est jamais évoquée** — embargo CBC jusqu'à la diffusion.

## 4. Images téléversées (Shopify > Contenu > Fichiers)

Sources : dossier Drive « Photos » (stills de production) et « Voyage Toronto » (iPhone).
Toutes recadrées/optimisées, texte alternatif en français renseigné.

| Fichier | Usage |
| --- | --- |
| `lasclay-dragons-den-slideshow.jpg` (2048×1024) | slide accueil, desktop |
| `lasclay-dragons-den-slideshow-mobile.jpg` (1080×1440) | slide accueil, mobile |
| `lasclay-dragons-den-plateau.jpg` | page — plateau, monarque, manteau |
| `lasclay-dragons-den-gabriel-plant.jpg` | page — Gabriel et le plant |
| `lasclay-dragons-den-echantillons.jpg` | page — planches d'échantillons des dragons |
| `lasclay-dragons-den-soie-dragon.jpg` | page — un dragon examine la soie |
| `lasclay-dragons-den-sac-isotherme.jpg` | page — sac isotherme sur le plateau |
| `lasclay-dragons-den-manteau-dragons.jpg` | page — manteau et sac entre les mains |
| `lasclay-dragons-den-toronto.jpg` | page — Toronto |
| `lasclay-dragons-den-semis-route.jpg` | page — le plant sur la route |
| `lasclay-dragons-den-gabriel-portrait.jpg` | page — portrait |

## 5. Barre d'annonce (bandeau du haut)

**Ce n'est pas dans le thème** : c'est l'app de barre de livraison gratuite
(`bar_id` 518372), donc le réglage est partagé par tous les thèmes — rien à refaire
dans la copie.

État au 14 septembre 2026 :

- `message_one` **et** `message_three` contiennent le *même* texte Dragons' Den
  (d'où les deux lignes identiques dans l'aperçu mobile). `message_three` est le message
  affiché une fois le seuil de livraison gratuite atteint.
- `bar_link` = `https://lasclay.com/pages/offre-novembre-2025-lasclay` — une page
  **dépubliée** de 2025, qui ne survit que grâce à une redirection d'URL vers
  `/collections/produits-products`.

Recommandation : voir la section « Où pointer le bandeau » ci-dessous.

## 6. À faire avant la diffusion

1. Vérifier l'aperçu du thème, puis **publier** `Dragons Den sept 2026`.
2. Mettre `bar_link` sur `/pages/dragons-den` dans l'app de bandeau (et différencier
   `message_three` du `message_one`).
3. Ajouter la page au menu « En savoir + » si on veut qu'elle vive au-delà du bandeau.
4. Après la diffusion : mettre la page à jour (l'issue n'est plus sous embargo) et
   remettre la slide « Matériaux » si désiré.

## 7. Garde-fous CBC

Le communiqué (`communique-dragons/01-communique-FR.md`) rappelle : pas de logo ni de
marque CBC / Dragons' Den, pas de formule « vu à Dragons' Den », rien sur l'issue.
Annoncer la date de diffusion est explicitement encouragé.

La page et la slide respectent l'embargo sur l'issue et n'utilisent aucun logo. Elles
utilisent en revanche des **photos de production montrant le décor** (et le lettrage doré
du plateau), comme les publications Facebook déjà en ligne. Une des photos
(`lasclay-dragons-den-echantillons.jpg`) laisse voir les **noms des dragons** sur les
planches d'échantillons. À valider avec CBC si un doute subsiste.
