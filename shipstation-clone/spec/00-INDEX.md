# Spec de réplication ShipStation — Lasclay

**Destinataire : une session Claude Code qui bâtit une alternative maison à ShipStation.**
Date de collecte : 31 juillet 2026. Langue : français, avec les libellés d'UI **en anglais** (langue source du produit — les garder tels quels facilite la comparaison écran par écran pendant le build).

Convention : `[à vérifier]` marque une information non confirmée par une source officielle. Ne pas coder de logique métier critique dessus sans validation.

---

## Comment lire ce paquet

| Fichier | Contenu | Quand le charger |
|---|---|---|
| `00-INDEX.md` | Ce fichier — carte, prompt de démarrage, état de couverture | Toujours en premier |
| `01-modele-mental-et-navigation.md` | Flux canonique du produit, vocabulaire officiel, navigation globale, header, sélecteur de store, alertes | Avant tout travail d'UI |
| `02-ecran-orders.md` | L'écran central : statuts, grille, colonnes, filtres, vues sauvegardées, détail de commande, Configure Shipment Widget, rate browser, split/combine, **hotkeys** | Sprint UI principal |
| `03-automatisation.md` | **Ordre d'exécution des 6 couches** (Auto-Routing → Auto-Split → Product Preset Groups → Product Defaults → Service Mapping → Automation Rules), critères et actions exhaustifs des règles, Shipping Presets, Rate Shopper | Sprint moteur d'automatisation |
| `04-settings.md` | Chaque section de Settings : Account, Selling Channels, Shipping, Printing, Warehouse/Inventory, Products, Customs, Notifications, Integrations & API | Sprint configuration |
| `05-autres-ecrans.md` | Shipments, Products, Customers, Insights/Reports, Batches, Scan to Print/Verify, End of Day & manifests, Returns, Fulfillments, Pickup | Sprints secondaires |
| `06-design-system-ui.md` | Layout, densité, couleurs, iconographie, modales, toasts, pagination, sélection, drag & drop, panneaux, états vides, persistance des préférences | Avant d'écrire le premier composant |
| `10-api-v1.md` | API v1 legacy : auth, rate limits, pagination, tous les endpoints, schémas Order/OrderItem/Address/Shipment/Carrier/Customer/Product/Store/User/Warehouse/Tag/Webhook | Sprint backend + migration |
| `11-api-v2.md` | Shipping API v2 : conventions, endpoints, objets Shipment/Label/Rate/Batch/Manifest/Carrier/Warehouse/Tracking/Webhooks | Sprint backend |
| `12-enumerations.md` | Toutes les énumérations (statuts, confirmations, package codes, carrier codes, douane, incoterms, unités, statuts de suivi) | Génération des types |
| `13-machines-a-etats.md` | Cycles de vie : commande, expédition/étiquette, batch, retour | Sprint backend |
| `14-integrations.md` | Polling vs webhook, **spécification complète du Custom Store XML**, mapping de statuts, écriture retour du tracking, boutiques supportées | Sprint intégrations |
| `15-schema-postgres.md` | Schéma relationnel complet proposé : types énumérés, ~40 tables avec clés, index et relations, + décisions de modélisation justifiées | Point de départ du code |
| `16-pieges-et-ecarts.md` | Ce que ShipStation fait mal et qu'il ne faut pas répliquer | À lire avant de coder |
| `20-plan-de-build-et-migration.md` | Architecture proposée, ordre de construction en 8 phases, plan de migration des données, checklist de parité, définition de « seamless » | Planification |
| `21-shopify-et-contexte-canadien.md` | **Intégration Shopify** (GraphQL, FulfillmentOrder, `fulfillmentCreateV2`, scopes, qui envoie l'email) et **expédition depuis le Canada** (Postes Canada/Purolator, douane CA→US, origine tunisienne, ACEUM, Loi 25) | Phases 1 et 6 — le seul canal réel de Lasclay |
| `99-config-lasclay.md` | **La configuration réelle du compte Lasclay** — à remplir (voir ci-dessous) | Sprint configuration |
| `90-sources.md` | Toutes les URLs sources | Vérification |

---

## ⚠️ État de couverture — à lire

Ce paquet couvre **ShipStation en tant que produit** : ses fonctions, ses écrans, son modèle de données, ses règles. Il a été bâti à partir de la documentation officielle publique (help.shipstation.com, docs.shipstation.com, spécifications OpenAPI ShipEngine) et il est exhaustif à ce niveau.

Ce qu'il ne contient **pas encore** : la configuration spécifique du compte Lasclay — les règles d'automatisation réellement en place, les shipping presets, les transporteurs connectés et leurs comptes, les entrepôts, les vues sauvegardées, les templates de packing slip et d'email, le mapping de statuts par boutique, les tags. C'est le fichier `99-config-lasclay.md`, actuellement un gabarit vide.

**Sans ce fichier rempli, la transition ne sera pas seamless** — l'application sera fonctionnellement équivalente mais ne reproduira pas les automatismes du quotidien. Voir la section « Comment remplir 99-config-lasclay.md » dans ce fichier.

---

## Prompt de démarrage suggéré pour la session Claude Code

```
Je bâtis une alternative maison à ShipStation pour Lasclay (marque québécoise,
e-commerce Shopify, expédition Canada + international).

La spec complète est dans ./shipstation-spec/. Commence par lire 00-INDEX.md,
puis 20-plan-de-build-et-migration.md, puis 16-pieges-et-ecarts.md, puis
21-shopify-et-contexte-canadien.md.

Ne lis les autres fichiers qu'au moment où le sprint en cours les concerne —
ils sont volumineux et conçus pour un chargement à la demande.

Contraintes :
- L'objectif est une transition seamless : je dois pouvoir arrêter ShipStation
  un vendredi et opérer sur le nouvel outil le lundi, avec mes automatismes.
- Priorité absolue au flux quotidien : import Shopify → grille Orders →
  achat d'étiquette → impression 4x6 → tracking renvoyé vers Shopify.
- Ne réplique pas les bugs listés dans 16-pieges-et-ecarts.md.

Commence par me proposer l'architecture et le découpage en phases, avant d'écrire
du code.
```

---

## Comment remplir `99-config-lasclay.md`

Trois voies, de la plus complète à la plus rapide :

**A. Extraction par l'API v1** — la plus fiable pour les données structurées.
Générer une paire de clés dans ShipStation (`Settings → Account → API Settings → API Keys`), puis interroger :

```bash
# base64 sans -w0 : portable macOS + Linux
AUTH=$(printf '%s:%s' "$SS_KEY" "$SS_SECRET" | base64 | tr -d '\n')
for r in stores carriers warehouses users customers products accounts/listtags; do
  curl -s -H "Authorization: Basic $AUTH" "https://ssapi.shipstation.com/$r" \
    -o "config-$(echo "$r" | tr '/' '-').json"
  sleep 2   # rate limit v1 : 40 req/min
done
# puis, par transporteur : /carriers/listservices?carrierCode=X et /carriers/listpackages?carrierCode=X
```

Couvre : boutiques et leur mapping de statuts, transporteurs et services disponibles, entrepôts / ship-from locations, utilisateurs, tags, catalogue produits avec leurs défauts d'expédition.
**Ne couvre pas** : automation rules, shipping presets, configuration d'impression, templates d'email et de packing slip, vues sauvegardées, branding. Ces objets n'ont aucun endpoint public.

**B. Captures d'écran** — le seul moyen pour ce que l'API n'expose pas.
Les écrans à capturer, par ordre d'importance :

1. `Settings → Automation → Automation Rules` — chaque règle, ouverte, avec ses critères et ses actions
2. `Settings → Shipping → Shipping Presets` — chaque preset ouvert
3. `Settings → Printing → Document Options` + `Printing Presets` + la liste des imprimantes
4. `Settings → Selling Channels → Store Setup` — pour chaque boutique : import settings, status mapping, notifications
5. `Settings → Shipping → Carriers` — comptes connectés, services activés, service mapping
6. `Settings → Notifications` — templates d'email et branding
7. Écran `Orders` — la grille telle que configurée (colonnes visibles, ordre, tri) et la liste des Custom Views / Saved Filters
8. Un packing slip imprimé (PDF) et une étiquette type

**C. Navigation assistée** — si la passerelle Claude desktop + Claude in Chrome est active dans une session, un agent peut parcourir les écrans et tout transcrire automatiquement. C'était le plan initial ; la passerelle n'était pas disponible lors de cette collecte.
