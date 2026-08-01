# Spécification de référence — d'où vient la configuration du clone

Ce dossier est la **source** de `lib/lasclay.js`. Il est versionné ici parce que sans lui,
personne ne peut vérifier que le clone reproduit bien le compte ShipStation : les règles
d'automatisation, les vues sauvegardées, les préréglages, les gabarits et les paramètres de
marque **n'ont aucun point de terminaison dans l'API publique**. Ils n'ont pu être relevés
qu'en lisant l'API interne du navigateur authentifié, le 31 juillet 2026.

| Fichier | Ce qu'il sert à vérifier |
|---|---|
| `99-config-lasclay-REMPLI.md` | **La charge utile.** §12.4 les 11 règles, §12.5 les 27 vues, §13 les préréglages, colis, étiquettes, emplacements, mappings. C'est ce que `lib/lasclay.js` transcrit. |
| `02-ecran-orders.md` | Le layout de l'écran Commandes, les 51 colonnes, les raccourcis clavier. |
| `03-automatisation.md` | L'ordre des 6 couches, le catalogue des 56 actions, le modèle de filtre. |
| `06-design-system-ui.md` | Densité, couleurs, modales, sélection, persistance des préférences. |
| `16-pieges-et-ecarts.md` | Ce qu'il ne faut **pas** répliquer. |
| `10-api-v1.md`, `11-api-v2.md`, `12-enumerations.md` | Schémas et énumérations, pour la migration. |
| `21-shopify-et-contexte-canadien.md` | Fulfillment orders Shopify et expédition depuis le Canada. |
| `99-config-lasclay-gabarit.md` | Le gabarit vide d'origine, gardé pour mémoire. |

## Ce qui reste à recapturer

Deux vues du §12.5 sont incomplètes dans la spécification, et le clone ne les invente pas :

- **« ROC »** — la spécification annonce 20 termes textiles inclus sans les énumérer ; les 17
  termes documentés ailleurs ont été repris, et la vue porte la mention « à vérifier ».
- **« 3 mars »** — une exclusion de trois produits précis est mentionnée sans que les produits
  soient nommés ; le critère manquant n'a pas été fabriqué.

Deux autres points sont marqués comme déduits, pas documentés :

- Les SKU de graines en `-x5` et `-x10` sont dérivés de ceux en `-x1`.
- Les mappings de service n'ont été capturés que pour LAS Shopify ; LAS Etsy et FAIRE Lasclay
  ont leurs propres tables, non relevées.

Le script de l'**Annexe C** du fichier rempli produit un export JSON complet depuis la console
du navigateur. C'est lui qui permettra de compléter ces quatre points.
