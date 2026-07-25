# Fix : « Boutique » masqué dans le menu mobile (lasclay.com)

**Date du diagnostic :** 2026-07-25
**Thème concerné :** « 10.2 Lasclay spring 2026 » (Showcase 10.2.0, Clean Canvas) — thème publié, GID `gid://shopify/OnlineStoreTheme/162811150555`

## Symptôme

Sur mobile, quand on ouvre le menu burger, le premier élément du menu
(« Boutique », menu `menu-2025`) est caché derrière la barre d'en-tête (logo).
Les items suivants (« En savoir + », « Aide & Guides », « Points de vente »)
sont visibles.

## Cause racine

- Le menu burger est un modal plein écran (`#page-menu.theme-modal`, z-index 20)
  volontairement dessiné **sous** l'en-tête sticky (`.section-header`, z-index 25)
  pour garder le logo et le bouton fermer cliquables.
- À l'ouverture, `theme.addControlPaddingToModal()` (dans `assets/theme.js`)
  pousse le contenu du menu sous l'en-tête avec un `padding-top` calculé comme
  `hauteur(#site-control) + hauteur des sections du header group`.
- Le bandeau noir « PRÉVENTE … » est une **app embed Hextom Free Shipping Bar**
  injectée dans `<body>`, hors de `#site-control` et hors du header group : sa
  hauteur (~3 lignes sur mobile) n'entre dans aucune de ces mesures. L'en-tête
  est décalé vers le bas d'autant, et recouvre exactement le premier item du menu.
- Desktop non affecté visiblement car la bannière y tient sur une ligne et la
  navigation est en liens inline (pas de burger au-dessus de 1100 px).

## Correctif (additif, sans risque)

Insérer dans `layout/theme.liquid`, juste après la balise
`<script src="{{ 'theme.js' | asset_url }}" defer="defer"></script>` et avant
`{% render 'body-end-tag' %}` :

```html
<script>
  // Le calcul du padding du menu burger ne voit que le header du thème :
  // une banniere d'app injectee au-dessus (ex. barre d'annonce) le decale
  // et masque le premier lien du menu. On aligne le padding sur la position
  // reelle du bas du header, sans jamais reduire la valeur calculee par le theme.
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.theme || typeof theme.addControlPaddingToModal !== 'function') return;
    var ccOriginalAddControlPaddingToModal = theme.addControlPaddingToModal;
    theme.addControlPaddingToModal = function () {
      ccOriginalAddControlPaddingToModal();
      var elSiteControl = document.getElementById('site-control');
      var elModalInner = document.querySelector('.theme-modal.reveal > .inner');
      if (!elSiteControl || !elModalInner) return;
      var headerBottom = Math.round(elSiteControl.getBoundingClientRect().bottom);
      var currentPadding = parseFloat(getComputedStyle(elModalInner).paddingTop) || 0;
      if (headerBottom > currentPadding) {
        elModalInner.style.paddingTop = headerBottom + 'px';
      }
    };
  });
</script>
```

Propriétés du correctif :

- Il **surcharge** `theme.addControlPaddingToModal` après le chargement de
  `theme.js` (script `defer` ⇒ exécuté avant `DOMContentLoaded`) sans modifier
  `theme.js` (318 Ko).
- Il ne fait qu'**augmenter** le `padding-top` du modal quand le bas réel de
  l'en-tête (`getBoundingClientRect().bottom`, qui intègre naturellement toute
  bannière d'app, le scroll et les sections au-dessus du header) dépasse la
  valeur calculée par le thème. Jamais de réduction ⇒ aucun changement quand il
  n'y a pas de bannière (desktop et mobile sans bannière : comportement
  strictement identique).
- Garde-fous : no-op si `window.theme`, la fonction d'origine, `#site-control`
  ou le modal sont absents.

## Fichiers dans ce dossier

- `theme.liquid.original-live-2026-07-24` : copie exacte du fichier du thème
  publié (MD5 `10f96db8baaa017bc7a5b31951bd61f8`).
- `theme.liquid.fixed` : même fichier avec le correctif inséré
  (MD5 `81ddc58b9e6997a158133ece18b8d207`). Seule différence : le bloc
  `<script>` ci-dessus (diff purement additif, 22 lignes).

## Pourquoi le correctif n'est pas encore en ligne

L'intégration Shopify utilisée par l'agent bloque toute écriture de fichier sur
le **thème publié** (garde-fou de la plateforme), et la duplication du thème
échoue car la boutique est à la **limite Shopify de 20 thèmes** (la suppression
de thèmes est également bloquée pour l'agent). Déploiement possible :

1. **Via l'agent** : supprimer (ou laisser l'agent dupliquer après avoir
   supprimé) un vieux thème dans l'admin pour libérer une place → l'agent
   duplique le thème publié, applique le correctif sur la copie, fournit le
   lien de prévisualisation → publication en un clic dans l'admin.
2. **Manuellement** : admin Shopify → Boutique en ligne → Thèmes → ⋯ →
   Modifier le code → `layout/theme.liquid` → coller le bloc ci-dessus à
   l'endroit indiqué → Enregistrer. (Modifie le thème en ligne directement ;
   le bloc est additif et sans risque, mais tester le menu mobile juste après.)

## Alternative sans code (optionnelle)

Déplacer le message « PRÉVENTE » dans la barre d'annonce native du thème
(Header → « Show announcement », actuellement désactivée) et désactiver la
barre Hextom : la barre native vit dans `#site-control` et est correctement
prise en compte par tous les calculs du thème. Le correctif JS reste utile en
prévention si une app réinjecte un bandeau à l'avenir.
