# Le pousseur Drive, et comment le généraliser

## Ce qu'il fait aujourd'hui

Une seule destination. L'Apps Script déployé tient une liste blanche qui ne
contient qu'une entrée, `controle`, associée en dur au chiffrier
`1KHvc5QlzyzGtAcGriO7oEg9Il1ySvXqg`. Toute autre valeur du paramètre `file`
répond `error:fichier non autorisé`, et l'absence de paramètre retombe sur cette
même cible. Le script refuse aussi tout contenu de moins de 100 Ko ou ne
commençant pas par « PK », la signature d'un fichier zip, donc d'un `.xlsx`.

Un PDF commence par `%PDF`. Le mémo ne peut donc pas passer, quelle que soit la
destination.

## La version généralisée

`apps_script/pousseur_drive.gs` prend n'importe quel fichier et n'importe quelle
destination :

| Ce qu'on veut | Appel |
| --- | --- |
| Remplacer un fichier existant, en gardant son lien | `?token=…&id=<idFichier>` |
| Déposer dans un dossier, écraser si le nom existe déjà | `?token=…&folder=<idDossier>&name=<nom>` |
| Les anciens appels | `?token=…&file=controle` |

Le type MIME se devine d'après l'extension, ou se force avec `mime`. Le plancher
de taille ne s'applique plus qu'à l'écrasement d'un fichier existant, à 1 000
octets par défaut : un envoi tronqué ne doit pas effacer un fichier qui compte,
mais un fichier neuf n'a rien à protéger.

Deux points de conception valent d'être signalés.

**Le lien de partage ne change pas.** `Drive.Files.update` remplace le contenu
en gardant l'identifiant. Les bailleurs qui ont l'URL du mémo reçoivent la
version à jour sans qu'on ait à leur en envoyer une nouvelle. C'est aussi
pourquoi le script écrase un fichier de même nom dans un dossier plutôt que d'en
créer un deuxième.

**L'écriture reste bornée à un sous-arbre.** `RACINES_AUTORISEES` liste les
dossiers à l'intérieur desquels le pousseur peut écrire, en remontant l'arbre des
parents. Sans cette barrière, le jeton seul ouvrirait tout le Drive du compte, et
une fuite de jeton pourrait écraser n'importe quel fichier. Pour ouvrir
réellement tout le Drive, mettre `RACINES_AUTORISEES = []` ; pour ajouter un
dossier de travail, ajouter son identifiant à la liste.

## Installer

1. Ouvrir le projet Apps Script du pousseur, remplacer le contenu du fichier par
   `apps_script/pousseur_drive.gs`.
2. **Services > ajouter un service > Drive API.** `Drive.Files.update` en dépend.
   `DriveApp.setContent()` ne sait écrire que du texte et corromprait un binaire.
3. **Paramètres du projet > Propriétés du script**, poser `TOKEN` à la valeur
   déjà utilisée par `LASCLAY_DRIVE_PUSH_TOKEN`. Le jeton sort ainsi du code.
4. Déployer une nouvelle version du déploiement web existant, en gardant la même
   URL pour ne pas avoir à changer `LASCLAY_DRIVE_PUSH_URL`. Exécution en tant
   que soi-même, accès « toute personne disposant du lien ».

## Ensuite

```
# le chiffrier, comme avant
python3 push_drive.py "PREVISIONS LASCLAY - version audit 2026-07-30.xlsx"

# le mémo, dans le dossier des prévisions
python3 push_drive.py "Lasclay - Previsions financieres 2026-2029 - memo explicatif.pdf" \
    --folder 1zOTIG_Mk6-L7o34qzp7jr8Qjk959khDY
```

Le premier envoi crée le fichier, les suivants l'écrasent en gardant le lien.
`push_drive.py` accepte déjà cette forme et dit quand l'Apps Script déployé est
encore l'ancienne version.
