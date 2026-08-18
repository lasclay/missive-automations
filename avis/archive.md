# L'archive du support, et comment on y accède

Le point de bascule de cet audit. Sans elle, il fallait crawler la boîte fil par fil, à dix
fils la minute, pour 3229 fils ouverts et cinq heures de collecte. Avec elle, on lit
**13 520 fils, de décembre 2021 à juin 2026**, en sept téléchargements.

## Où elle est

`analyse.js` dépose périodiquement l'archive complète du service client en pièces jointes
de brouillons successifs, sur la conversation « Archives support »
(`019eb488-6d42-7195-a2ae-11751d0a7a27`). Les fichiers s'appellent
`archive_support_AAAA-MM-JJ-HH-MM_tN.jsonl.gz`, sept tranches, 8,6 Mo au total.

## Pourquoi elle était inatteignable

`getDrafts` dans `missive-proxy/server.js` demandait `?limit=10` et s'arrêtait là. L'API
Missive plafonne les brouillons à dix par page, comme elle le fait pour les messages, et il
faut paginer avec `until`. Sans pagination, seuls les dix derniers brouillons revenaient,
c'est-à-dire les digests du jour. Les tranches d'archive arrivent au-delà du 200e brouillon.

Le plafond venait de la fonction, pas de Missive. Le correctif fait quinze lignes.

## Comment la lire

```bash
node missive_client.js draftsraw 019eb488-6d42-7195-a2ae-11751d0a7a27 500 > drafts.json
```

Puis télécharger les `attachments[].url` dont le `filename` commence par `archive_support_`.
Ces URL sont signées et se récupèrent sans le secret du proxy.

Format d'une ligne, une par fil :

```json
{"id","subject","team","last_activity_at","labels","messages_count",
 "messages":[{"id","date","type","from","direction","body"}],"exemple","comments"}
```

`direction` vaut `client` ou autre chose pour nous. `labels` porte les étiquettes du fil,
ce qui permet de retrouver « review à traiter » sans interroger Missive.

## Ce qu'elle ne couvre pas

L'archive s'arrête à sa date de génération, ici le 11 juin 2026. Ce qui suit se collecte
avec `harvest.js`, qui reste utile pour le rattrapage. Le pipeline lit les deux sources et
garde, pour chaque fil, la version qui porte le plus de messages.
