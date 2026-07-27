# Export exhaustif Klaviyo — Lasclay (compte RhpPJR)

Export réalisé le 2026-07-27 via l'API Klaviyo (MCP), en préparation de la migration
hors de Klaviyo. Objectif : sauvegarde complète et réimportable de tout ce qui est
exportable par API.

## Contenu

| Dossier | Contenu | Format |
|---|---|---|
| `reports/` | Performance des 110 campagnes des 12 derniers mois (destinataires, taux, revenus attribués « Placed Order ») | CSV |
| `campaigns/` | Manifeste des 338 campagnes (100 récentes + 238 anciennes + 6 SMS avec corps du message) | CSV |
| `campaigns/content/` | Métadonnées des 98 campagnes envoyées depuis août 2025 (sujet, préheader, expéditeur, audiences, template) + HTML complet de chacune dans `html/` | CSV + HTML |
| `flows/` | Les 10 flows : définition JSON complète (triggers, delays, branches, filtres) + carte des messages (`flow_templates_map.csv`) + HTML de chaque message dans `templates/` | JSON + CSV + HTML |
| `templates/` | Les 5 templates de la bibliothèque, HTML complet dans `html/` | CSV + HTML |
| `lists/` | Les 15 listes avec taille (profile_count) et type d'opt-in | CSV |
| `segments/` | Les 11 segments : tailles + définitions complètes (condition_groups) dans `definitions/`, avec mapping des metric_id → noms pour recréation ailleurs | CSV + JSON |
| `forms/` | Les 8 formulaires : définition complète de la version live (étapes, blocs, styles, liste cible) | CSV + JSON |
| `misc/` | Métriques (74), tags, manifeste d'images (200 premières, curseur noté), coupons/webhooks/universal content (vides dans le compte) | CSV + JSON |

## Ce qui N'EST PAS ici (et comment l'obtenir)

1. **Les profils (~50-70 k) avec consentements** — trop volumineux pour cet export.
   → Le connecteur `klaviyo` a été ajouté au general-proxy (branche
   `claude/klaviyo-audit-alternatives-awlhbf` du repo missive-automations).
   Une fois `KLAVIYO_API_KEY` (clé privée lecture seule) ajoutée sur Render et la
   branche fusionnée : `node klaviyo_export.js profiles <dossier>` exporte tous les
   profils en CSV avec consentements email/SMS horodatés (preuve LCAP), et
   `node klaviyo_export.js list <ID> <dossier>` les membres d'une liste.
   Alternative sans code : Klaviyo UI → Lists & Segments → Export.
2. **L'historique d'événements brut** (millions de lignes) — non exportable en masse
   par API. Les agrégats de performance (reports/) et les segments d'engagement
   capturent l'essentiel. Au besoin, l'action `events` du connecteur permet un
   échantillonnage filtré.
3. **Les images elles-mêmes** — hébergées par Klaviyo ; `misc/images_manifest.csv`
   contient les URL de téléchargement (restent accessibles tant que le compte existe).

## Notes de fidélité

- Les HTML conservent les balises de personnalisation Klaviyo (Django/Liquid :
  `{{ first_name }}`, `{% unsubscribe %}`, `event.*`) — à adapter à la syntaxe de la
  plateforme cible lors de la réutilisation.
- Quelques templates quasi identiques ont été signalés comme doublons par les agents
  d'export (voir MANIFEST des sous-dossiers). Trois fichiers reconstruits ont été
  refetchés verbatim en fin d'export.
- Segments : `definitions/*.json` contient la définition exacte de l'API + un champ
  `metric_refs` ajouté pour traduire les IDs de métriques.

## Copies de sûreté

- Google Drive : dossier « Klaviyo Export Lasclay 2026-07-27 » (CSV clés + zip complet).
- Repo git privé lasclay/missive-automations, branche
  `claude/klaviyo-audit-alternatives-awlhbf`, dossier `klaviyo-export/`
  (contenu sans données personnelles).
