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

## Les schémas Miro — rapatrier une image du tableau

Les images du tableau vivent derrière l'authentification Miro, et **l'adresse que
l'API rend expire en quelques heures** (`?Expires=…&Signature=…`). Impossible de la
stocker : elle donnerait un cadre vide le lendemain. Il faut donc rapatrier, puis
redéposer sur le Drive — que `urlImage()` sait convertir en `lh3.googleusercontent.com`
et faire redimensionner. **L'app continue de n'héberger aucun fichier.**

La marche à suivre, par image :

1. **Trouver l'item.** Une lecture SVG du tableau donne les `<image id="m…">`.
   Voir le skill `production-lasclay`, `references/charte-miro.md`.
2. **Obtenir l'adresse signée** — `mcp__Miro__image_get_url` avec
   `…/?moveToWidget=<itemId>`.
3. **Rapatrier** — `curl -sS -o <nom>.png "<download_url>"`.
   Chromium, lui, ne franchit pas le proxy TLS ; curl a le certificat.
4. **Déposer sur le Drive** — dossier *MRP — schémas et détails produits*
   (`10ngE6WyqljFHSMjMacWhq2QHjxL6QLFA`), par le skill `drivepush`. La réponse
   rend l'identifiant du fichier.
5. **Inscrire la ligne** dans `donnees/schemas-produits.tsv`, avec l'adresse
   `https://lh3.googleusercontent.com/d/<id>` et la légende — une phrase qui dit
   ce que l'image montre, pas ce qu'elle est.
6. **Importer** — `node mrp/import_schemas.js` en aperçu, puis `--ecrire`.
   Le service le rejoue à chaque démarrage.

**Vérifier avant de conclure** : `curl -o /dev/null -w '%{http_code}'
"https://lh3.googleusercontent.com/d/<id>=w600"`. Un 200 dit que le CDN sert
l'image — et rappelle qu'elle est alors **lisible par quiconque a l'adresse**.
C'est le prix du CDN, le même que pour les photos Shopify ; à garder en tête pour
un dessin qu'on ne voudrait pas voir circuler.

## Ce que les planches ne portent pas

Les **cotes** et les **planches d'étiquettes** : elles vivent dans les images du tableau Miro
(`uXjVHuYrQSA=`), qui exigent l'authentification Miro et dont le texte est dans l'image. C'est le
travail qui reste pour les fiches exhaustives — voir le skill `production-lasclay`,
`references/charte-miro.md`.
