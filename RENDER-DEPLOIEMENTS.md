# Déploiements Render — pourquoi ils échouaient, et le filtre qui l'empêche

## Le symptôme

```
==> Build canceled: your workspace has run out of build pipeline minutes
    for the current billing period.
```

Ce n'est **pas** une erreur de code. Aucun script n'est en cause : les constructions sont
*annulées* avant de commencer, parce que le quota mensuel de minutes de construction de
l'espace de travail Render est épuisé. Tant qu'il l'est, **plus rien ne se déploie** — ni un
correctif urgent du proxy, ni le MRP, ni le clone d'expéditions.

À ne pas confondre avec la panne précédente, elle bien causée par le dépôt : la borne
`"node": ">=18"` que Render résolvait vers une préversion 26.x, corrigée en `22.x` dans
`package.json` (le commentaire `_engines` en garde la trace).

## La cause

Un seul dépôt, **six services Render qui suivent tous `main`** :

| Service | Code |
| --- | --- |
| `general-proxy-5muf` | `server.js` (racine) |
| Finance Proxy | `finance-proxy/` |
| Missive Proxy | `missive-proxy/` |
| A2X maison | `a2x-app/`, `a2x/` |
| `lasclay-expeditions` | `shipstation-clone/` |
| `lasclay-mrp` | `mrp/` |

Render reconstruit **chaque service à chaque commit sur `main`**, sans regarder ce que le
commit contient. Un commit = six constructions. Et ce dépôt n'est pas qu'un dépôt de code : il
sert d'entrepôt de données versionnées.

Sur le mois d'août : **124 commits sur `main`**, dont **40 ne touchent aucun code de service** —
état du backlog Facebook, exports Klaviyo (186 fichiers), notes SEO, avis, patrons. Les 84
autres ne concernent qu'un service sur six. Autrement dit, la quasi-totalité des ~750
constructions du mois n'avait aucune raison d'exister.

Le plus gros producteur est le backlog Facebook : quatre tirs (A, B, C, D) tournent en Routine,
chacun commit et pousse son fichier d'état sur `main` à chaque passage (`fb-backlog/PROCEDURE.md`
§6). Vingt-neuf commits en août dont le contenu est un JSON de suivi — et 174 constructions
déclenchées par des fichiers qu'aucun service ne lit.

## Le correctif

### 1. Filtre de construction (fait, dans le dépôt)

Les deux services décrits par un blueprint portent maintenant un `buildFilter` :
`shipstation-clone/render.yaml` et `mrp/render.yaml`. `paths` est une **liste blanche** — ce qui
n'y figure pas ne déclenche aucune construction.

```yaml
    buildFilter:
      paths:
        - mrp/**
        - package.json
        - .node-version
```

Attention à la contrepartie : si un service se met un jour à dépendre d'un fichier hors de son
dossier, il faut l'ajouter à sa liste, sinon le déploiement partira sans lui.

Ces deux fichiers ne prennent effet qu'après **synchronisation du blueprint** dans le tableau de
bord Render (Blueprints → le blueprint → *Sync*), une fois la fusion dans `main` faite.

### 2. Chemins ignorés des quatre autres services (à faire dans le tableau de bord)

Les proxys et A2X ont été créés à la main, sans blueprint : leur filtre ne peut pas venir du
dépôt. Pour chacun : **Settings → Build Filters → Included Paths**, puis la liste ci-dessous,
une ligne par entrée.

| Service | Included Paths |
| --- | --- |
| `general-proxy-5muf` | `server.js`, `package.json`, `.node-version` |
| Finance Proxy | `finance-proxy/**`, `package.json`, `.node-version` |
| Missive Proxy | `missive-proxy/**`, `package.json`, `.node-version` |
| A2X maison | `a2x-app/**`, `a2x/**`, `package.json`, `.node-version` |

### 3. `[skip render]` sur tout commit de données

Filet de sécurité, indépendant du filtre et valable pour les six services : Render n'auto-déploie
pas un commit dont le message contient `[skip render]`. Tout commit qui ne touche que des
données — état du backlog, exports, notes, rapports — doit le porter :

```
git commit -m "fb-backlog tir A: 2 réponses publiées [skip render]"
```

### 4. Rétablir les constructions maintenant

Le quota est épuisé pour la période de facturation en cours ; le filtre empêche la prochaine
fois, il ne rend pas les minutes déjà consommées. Pour repartir tout de suite, une des deux :

- relever la limite de dépense de construction, ou changer de forfait :
  https://dashboard.render.com/w/tea-d8g6sc0g4nts73bct7og/settings#build-pipeline
- ou attendre la remise à zéro à la prochaine période de facturation.

Et pour le déploiement urgent qui ne peut pas attendre : **Manual Deploy** dans le tableau de
bord reste possible sur un service donné, sans repasser par la file automatique.

## Ce qui reste sur la table

`klaviyo-export/` (186 fichiers, 4,2 Mo de CSV) et les autres dumps de données vivent dans le
dépôt. Le filtre les rend inoffensifs pour les constructions, mais un dépôt de code n'est pas un
entrepôt : à décider si ces exports migrent vers le Drive.
