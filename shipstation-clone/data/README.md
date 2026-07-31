# Données de référence — audit ShipStation du 31 juillet 2026

Relevés bruts servant de base au clonage (voir `../AUDIT.md`).

| Fichier | Contenu |
|---|---|
| `transporteurs.json` | les 9 comptes transporteur du compte ShipStation, avec type (contrat direct vs One Balance) et solde |
| `tags.json` | les 6 tags de commande et leurs `tagId` |
| `tarifs_reference.json` | devis réels par transporteur et service — Québec (G1J3R4) → Toronto (M5V2T6) et → New York (10001), 500 g, 12×6×6 po. Sert de référence pour valider les tarifs obtenus en direct chez Canada Post |

Régénérable avec `node connectors_client.js shipstation <action>` (voir `CONNECTORS_PROXY.md`).
