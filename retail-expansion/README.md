# Expansion des points de vente Lasclay

Outillage de prospection pancanadienne pour la consignation en boutique.

## Livrable

`points-de-vente-lasclay.xlsx` — 5 feuilles :

| Feuille | Contenu |
| --- | --- |
| Lisez-moi | méthode, règles d'exclusivité et de distance, sources, limites |
| Réseau actuel | les 10 points de vente en place et leur nature |
| Candidats | 1426 candidats triés (426 QC, 1000 hors QC), tous joignables, classés par rang dans leur zone |
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
5. **Montage et tri** (`build_xlsx.py`) : affectation à la zone-ancre la plus proche,
   puis un tri au jugement avant le pointage.

## Le tri

- **Contact obligatoire.** Une fiche sans téléphone, courriel, page sociale ni site web
  vivant est retirée: elle n'est pas exploitable. Les domaines morts sont détectés au
  scraping et ne comptent pas comme moyen de contact.
- **Chaînes.** Une enseigne présente dans quatre zones ou plus est retirée: elle achète
  par centrale et ne fera pas de consignation, quel que soit son nom. Cette règle attrape
  les chaînes régionales qu'aucune liste écrite d'avance ne contient.
- **Archétypes écartés.** Fournitures de bricolage, friperies, maroquineries.
- **Archétypes conditionnels.** Alcool, sport et fleuriste ne passent que si le nom porte
  un signal de spécialité (cave, vignoble, microbrasserie, outfitter, jardin, pépinière).
- **Signaux du nom.** Artisan, local, coop, marché, terroir, ferme, atelier, vrac, éco,
  magasin général, mercantile, créateur et les noms de région donnent un bonus.

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
- Les noms de zone portent des tirets cadratins: toute comparaison doit passer par
  `norm()`, sinon la détection des zones déjà couvertes échoue en silence.
- Le scraper doit tronquer les pages: les regex sur un document de plusieurs mégaoctets
  bloquent le processus pendant des minutes. Il doit aussi abandonner un domaine dès que
  la page d'accueil ne répond pas, plutôt que d'essayer chaque chemin.

## Limites

Les cases vides ne sont pas vérifiées, pas inexistantes. Les étiquettes OpenStreetMap
sont larges : une partie des commerces listés ne conviendra pas. Le tri final reste humain.
