# Expansion des points de vente Lasclay

Outillage de prospection pancanadienne pour la consignation en boutique.

## Livrable

`points-de-vente-lasclay.xlsx` — 5 feuilles :

| Feuille | Contenu |
| --- | --- |
| Lisez-moi | méthode, règles d'exclusivité et de distance, sources, limites |
| Réseau actuel | les 10 points de vente en place et leur nature |
| Candidats | 1500 candidats (500 QC, 1000 hors QC) avec coordonnées, classés par rang dans leur zone |
| Couverture par zone | les 192 zones, leur statut et le meilleur candidat |
| Grille de qualification | 12 critères pour trancher avant de signer |

## Méthode

1. **Découpage en zones** (`zones.json`) : 192 zones couvrant les régions habitées du
   Canada, dimensionnées pour qu'aucun client n'ait plus d'une heure de route.
   Villes-ancres géocodées par Nominatim (`geocode_zones.js`).
2. **Recherche ciblée** (`candidats.json`) : annuaires écoresponsables, répertoires
   d'artisans, presse régionale. Archétype validé à la lecture.
3. **Moisson OpenStreetMap** (`osm_harvest.js`) : requêtes Overpass dans un rayon de
   30 km autour de chaque ville-ancre, sur 24 étiquettes de commerce correspondant aux
   archétypes retenus. 37 000 commerces bruts.
4. **Coordonnées** (`scrape_contacts.js`) : extraction du téléphone, du courriel et de
   l'adresse depuis les sites des boutiques (JSON-LD puis pied de page).
5. **Montage** (`build_xlsx.py`) : exclusion des chaînes, affectation à la zone-ancre la
   plus proche, pointage, classement par rang, écriture du chiffrier.

## Reproduire

```sh
node geocode_zones.js                                     # coordonnées des zones
gunzip -k osm_brut.json.gz   # ou: node osm_harvest.js pour remoissonner (~1 h)
python3 build_xlsx.py                                     # 1re passe, écrit selection.json
node scrape_contacts.js selection.json selection_enrichie.json 25
python3 build_xlsx.py                                     # 2e passe avec les coordonnées
```

## Pièges rencontrés

- `overpass.osm.ch` ne sert qu'un extrait suisse : il renvoie 0 élément **sans erreur**
  pour le Canada. Miroirs validés sur données canadiennes : `overpass.osm.jp`,
  `overpass.openstreetmap.fr`, `maps.mail.ru`, `overpass-api.de`.
- Overpass renvoie un JSON valide mais vide avec un champ `remark` quand une requête
  déborde. Sans vérification, les grandes villes rendent 0 résultat en silence.
- Les requêtes par boîte englobante provinciale ramassent des commerces américains le
  long de la frontière. Le rayon autour d'une ville canadienne évite le problème.

## Limites

Les cases vides ne sont pas vérifiées, pas inexistantes. Les étiquettes OpenStreetMap
sont larges : une partie des commerces listés ne conviendra pas. Le tri final reste humain.
