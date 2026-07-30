# Déposer le mémo PDF dans Drive

Le chiffrier se pousse en une commande :

```
python3 push_drive.py "PREVISIONS LASCLAY - version audit 2026-07-30.xlsx" controle
```

Le mémo PDF, lui, n'a pas encore de chemin. Deux obstacles, tous les deux hors du
dépôt :

1. **L'Apps Script tient une liste blanche de cibles.** Seule `controle` y figure,
   et elle pointe sur le chiffrier. Toute autre valeur du paramètre `file` répond
   `error:fichier non autorisé`.
2. **Le connecteur Drive de l'assistant n'accepte que du contenu en ligne.** Un
   PDF de 365 Ko devient 490 Ko en base64, ce qui ne passe pas dans un appel
   d'outil.

## Ce qu'il faut ajouter à l'Apps Script

Le script est déployé hors du dépôt, dans le projet Apps Script de Lasclay. Il
faut y faire trois choses.

**Ajouter la cible.** À côté de l'entrée `controle`, dans la table qui associe un
nom de cible à un identifiant de fichier Drive :

```js
const CIBLES = {
  controle: '1KHvc5QlzyzGtAcGriO7oEg9Il1ySvXqg',
  memo:     'IDENTIFIANT_DU_PDF_DANS_DRIVE',   // à créer une première fois
};
```

Le fichier de destination doit exister avant le premier envoi : déposer le PDF à
la main dans le dossier `1zOTIG_Mk6-L7o34qzp7jr8Qjk959khDY`, celui du chiffrier,
puis copier son identifiant dans la table. Les envois suivants écrasent son
contenu et gardent le même lien, ce qui est le comportement voulu : les bailleurs
qui ont l'URL n'ont pas à en recevoir une nouvelle à chaque révision.

**Assouplir le contrôle de forme.** Le script vérifie que le contenu commence par
`PK`, la signature d'un fichier zip, donc d'un `.xlsx`. Un PDF commence par
`%PDF`. Le contrôle doit dépendre de la cible :

```js
const SIGNATURES = { controle: 'PK', memo: '%PDF' };
if (octets.slice(0, SIGNATURES[cible].length) !== SIGNATURES[cible]) {
  return sortie('error:signature inattendue pour ' + cible);
}
```

**Poser le bon type MIME** à l'écriture, `application/pdf` plutôt que celui du
classeur, sans quoi Drive affichera le fichier comme une pièce jointe opaque.

## Ensuite

```
python3 push_drive.py "Lasclay - Previsions financieres 2026-2029 - memo explicatif.pdf" memo
```

`push_drive.py` reconnaît déjà les deux signatures et signale explicitement quand
une cible manque à la liste blanche.
