# Unique Plastique

Deux choses ici : un **dossier de recherche** sur l'entreprise, et un **kit technique**
réutilisable pour brancher leurs outils (Missive, Shopify, ShipStation, QuickBooks).

## Le dossier

| Fichier | Quoi |
| --- | --- |
| [`DOSSIER-UNIQUE-PLASTIQUE.md`](DOSSIER-UNIQUE-PLASTIQUE.md) | Le portrait complet : histoire, produit, modèle d'affaires, chiffres, équipe, marque, médias, lecture stratégique, sources |
| [`dossier-unique-plastique.pdf`](dossier-unique-plastique.pdf) | Le même, mis en page avec les visuels et la palette de marque — 18 pages A4 |
| `dossier.html` | La source du PDF (voir « Régénérer le PDF » plus bas) |
| `visuels/` | Logo, photos produit, carte des points de vente, photo *Dans l'œil du dragon* |

**Unique Plastique S.E.N.C.** — Lévis (Québec), NEQ 3380145428. Pinces à cheveux injectées en
plastique 100 % recyclé, fondée par Alexandre Tanguay à 18 ans. 45 000 à 60 000 unités par mois,
345 points de vente, 4,89 ★ sur 1 236 avis, lauréate nationale OSEntreprendre 2025, et les cinq
dragons réunis en juin 2026 autour d'un prêt de 20 000 $ sans prise de participation.

Recherche menée le 7 août 2026 en sources ouvertes uniquement.

### Régénérer le PDF

```bash
cd unique-plastique
/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
  --disable-gpu --no-sandbox --no-pdf-header-footer --virtual-time-budget=15000 \
  --print-to-pdf="$PWD/dossier-unique-plastique.pdf" \
  "file://$PWD/dossier.html"
```

Les images sont locales (`visuels/`) : aucune dépendance réseau à la génération.

## Le kit technique

[`kit/`](kit/) — une copie dépersonnalisée de l'infrastructure de proxys de Lasclay, prête à
déployer pour Unique Plastique. Trois services Render (Missive, opérations, finances), trois
secrets séparés, aucune clé d'API dans le dépôt ni dans l'environnement de l'agent. Node 18+ pur,
zéro dépendance npm.

Voir [`kit/README.md`](kit/README.md) pour l'installation pas à pas.

```
kit/
├── README.md              guide d'installation complet
├── CLAUDE.md.exemple      la carte d'accès à mettre à la racine de leur dépôt
├── missive-proxy/         boîte support Missive           → service Render 1
├── general-proxy/         ShipStation, Omnisend, Klaviyo  → service Render 2
├── finance-proxy/         QuickBooks Online               → service Render 3
├── clients/               les scripts que Claude appelle  (ne se déploient pas)
└── skills/                missive · ops · qbo             (→ .claude/skills/)
```
