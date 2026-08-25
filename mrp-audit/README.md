# Audit MRPeasy — dossier de référence pour le MRP Lasclay

| Fichier | Nature | Pour qui |
| --- | --- | --- |
| `AUDIT-MRPEASY.md` | Audit fonctionnel exhaustif, 2 500 lignes, structuré pour lecture par un LLM | Conception, développement |
| `AUDIT-MRPEASY-VISUEL.pdf` | **Le relevé exécuté** : 115 écrans capturés en vrai et légendés, 84 pages | Conception, référence d'interface |
| `GUIDE-CAPTURES-MRPEASY.pdf` | Le plan de relevé qui a servi à le produire : 65 captures spécifiées, 33 pages | Archive |
| `guide-captures.html` | Source du plan (regénérable) | — |

## Ce que contient l'audit

1. Portée et **limite d'accès** (§0)
2. Vue d'ensemble et flux métier (§1)
3. **Modèle de données canonique** — entités, champs, types, relations (§2)
4. Système de drapeaux de fonctionnalités : 15 Pro + 11 Enterprise à l'écran + 14 paramètres logiciels (§3)
5. **Les moteurs** : réservation, ordonnancement à capacité finie, coût de revient, traçabilité, OEE (§4)
6. Audit module par module : Stock, Production, Atelier, CRM, Achats, Comptabilité, Réglages (§5–§12)
7. Droits, intégrations, API, limites et pièges (§13–§16)
8. **Analyse critique et recommandations pour Lasclay** (§17)
9. Annexes : énumérations, formules, imports CSV, tarification, conventions d'interface

## Les deux documents se lisent ensemble

`AUDIT-MRPEASY.md` a été écrit **sans accès au compte** — le périmètre fonctionnel a été reconstitué
depuis le manuel officiel (187 pages) et les spécifications OpenAPI. Il donne le modèle de données, les
moteurs et les règles de calcul.

`AUDIT-MRPEASY-VISUEL.pdf` a été produit **avec accès au compte** (`operations@lasclay.com`, version
V.10.26746, jeu de démonstration officiel, 26 fonctions optionnelles activées). Il donne l'interface :
115 écrans capturés, zone par zone, colonne par colonne.

L'un dit comment ça marche, l'autre montre à quoi ça ressemble. Le second corrige deux comptes du
premier : **15** interrupteurs Professional et **11** Enterprise à l'écran, contre 16 et 13 au manuel —
le manuel liste des capacités, l'écran liste des bascules. Détail en §0.2 de l'audit.

Ce qu'aucun des deux ne couvre : la configuration réelle de l'instance Lasclay. L'audit visuel a été fait
sur le jeu de démonstration. Sans importance pour concevoir un MRP sur mesure ; déterminant s'il fallait
reprendre les données existantes.

## Regénérer le PDF

```
/opt/pw-browsers/chromium-*/chrome-linux/chrome --headless --disable-gpu --no-sandbox \
  --no-pdf-header-footer --print-to-pdf=GUIDE-CAPTURES-MRPEASY.pdf \
  "file://$PWD/guide-captures.html"
```

## Sources

- `www.mrpeasy.com/resources/user-manual/` — 187 pages
- `api.mrpeasy.com/rest/v1/openapi.json` — 49 chemins, 116 schémas
- `api.mrpeasy.com/rest/v2/openapi.json` — 49 chemins, 135 schémas
- `www.mrpeasy.com/pricing/`
