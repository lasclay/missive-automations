# Étiquettes Dymo — envois en enveloppe

Un envoi en enveloppe accepte au maximum **5 sachets de graines**. Une commande de N sachets
demande donc `ceil(N / 5)` enveloppes — et autant d'étiquettes d'adresse identiques.

Le script lit les packing slips (PDF ShipStation), compte les sachets réels par commande
(en tenant compte des formats « 1 sachet », « Paquet de 5 », « Paquet de 10 » et de la
quantité commandée), puis duplique les lignes du CSV d'adresses en conséquence.

```bash
python3 etiquettes/etiquettes_enveloppes.py Packing_Slips.pdf adresses.csv dossier_sortie
```

Sorties :

- `etiquettes_dymo.csv` — **mêmes colonnes que le CSV d'entrée**, lignes dupliquées : à charger
  tel quel dans Dymo Connect à la place du fichier d'origine.
- `analyse_batch.csv` — contrôle : sachets, enveloppes, détail par variété, articles non-graines.

Dépendance : `pip install pdfplumber`.

Notes de lecture des packing slips :

- Le PDF utilise un tiret insécable (U+00AD) dans les libellés et les numéros de commande.
- Les lignes de rabais (`MONARCH20 ($13.20)`) portent leur montant entre parenthèses et ne sont
  donc jamais confondues avec une ligne d'article.
- Une commande sans sachet de graines (soie en vrac, par exemple) reçoit tout de même 1 étiquette.
