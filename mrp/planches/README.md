# Planches produits

`PLANCHES-PRODUITS.pdf` — **35 pages, une par produit de production** : photos, composition selon
la charte, et vérifications avant emballage. Document de référence pour l'atelier, et support de
conception pour le MRP.

Sur le Drive : *Tunisie (Bmb Textile + Grada Mode)* → `PLANCHES-PRODUITS-LASCLAY.pdf`
(`1F1zUS9j-ggkKMzOnygjKkUX3ro1KR7Dk`).

## Régénérer

```sh
node mrp/tools/planches.js > planches.html            # pointe le CDN Shopify
node mrp/tools/planches.js --liste-images > liste.tsv # pour une impression hors ligne
node mrp/tools/planches.js --local ./img > page.html
```

Puis impression par Chromium, `--no-pdf-header-footer`, `--virtual-time-budget=90000`.

**Le mode local n'est pas un luxe** : dans un conteneur infonuagique, Chromium échoue en
`handshake failed` sur le CDN et imprime des cadres vides sans le signaler. `curl` a le
certificat, lui. Le mode local rapatrie d'abord, et **écarte les images manquantes** au lieu de
laisser un cadre cassé.

`images-sources.tsv` garde la correspondance nom local ↔ URL d'origine.

## Ce que les planches ne portent pas

Les **cotes** et les **planches d'étiquettes** : elles vivent dans les images du tableau Miro
(`uXjVHuYrQSA=`), qui exigent l'authentification Miro et dont le texte est dans l'image. C'est le
travail qui reste pour les fiches exhaustives — voir le skill `production-lasclay`,
`references/charte-miro.md`.
