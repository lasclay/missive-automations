# Audit MRPeasy — dossier de référence pour le MRP Lasclay

| Fichier | Nature | Pour qui |
| --- | --- | --- |
| `AUDIT-MRPEASY.md` | Audit fonctionnel exhaustif, 2 500 lignes, structuré pour lecture par un LLM | Conception, développement |
| `GUIDE-CAPTURES-MRPEASY.pdf` | Guide visuel de relevé : 65 captures d'écran spécifiées, 33 pages | Personne ayant accès au compte |
| `guide-captures.html` | Source du PDF (regénérable) | — |

## Ce que contient l'audit

1. Portée et **limite d'accès** (§0)
2. Vue d'ensemble et flux métier (§1)
3. **Modèle de données canonique** — entités, champs, types, relations (§2)
4. Système de drapeaux de fonctionnalités : 16 Pro + 13 Enterprise + 14 paramètres logiciels (§3)
5. **Les moteurs** : réservation, ordonnancement à capacité finie, coût de revient, traçabilité, OEE (§4)
6. Audit module par module : Stock, Production, Atelier, CRM, Achats, Comptabilité, Réglages (§5–§12)
7. Droits, intégrations, API, limites et pièges (§13–§16)
8. **Analyse critique et recommandations pour Lasclay** (§17)
9. Annexes : énumérations, formules, imports CSV, tarification, conventions d'interface

## Limite à connaître

L'audit a été mené **sans accès au compte MRPeasy de Lasclay** : aucune donnée d'identification n'était
disponible et l'application est entièrement derrière authentification. Le périmètre fonctionnel complet a
été reconstitué depuis le manuel officiel (187 pages) et les spécifications OpenAPI v1/v2 — mais pas la
configuration réelle de l'instance ni ses écrans.

Le PDF est le plan de relevé à exécuter pour combler cet écart.

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
