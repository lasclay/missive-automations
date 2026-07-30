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

**L'écriture porte sur tout le Drive, par défaut.** C'est ce qui était demandé.
`RACINES_AUTORISEES` est la barrière optionnelle : y mettre un ou plusieurs
identifiants de dossiers limite le pousseur à ces sous-arbres, parents compris.
Vide, elle ne limite rien, et une fuite du jeton donnerait alors accès en
écriture à tout le Drive du compte. Y mettre
`'1zOTIG_Mk6-L7o34qzp7jr8Qjk959khDY'` refermerait sur le dossier des prévisions.

**La signature dépend maintenant du type.** L'ancienne règle exigeait « PK » de
tout envoi, ce qui interdisait le PDF. Chaque type connu a la sienne : `%PDF`
pour un PDF, `PK` pour les formats zippés, et rien n'est exigé d'un type
inconnu. Un envoi tronqué ou une page d'erreur HTML se font toujours refuser
avant d'écraser quoi que ce soit.

## Installer

1. Ouvrir le projet Apps Script du pousseur, remplacer tout le contenu par
   `apps_script/pousseur_drive.gs`.
2. **Le jeton, obligatoirement.** Poser `TOKEN` dans *Paramètres du projet >
   Propriétés du script*. Tant que la valeur vaut `REMPLACER_PAR_LE_JETON`, le
   pousseur refuse toute écriture et le dit. Ce refus n'est pas décoratif : le
   30 juillet 2026, un déploiement où la propriété n'avait pas été posée
   acceptait l'espace réservé comme jeton, une chaîne publiée dans ce dépôt, ce
   qui ouvrait l'écriture sur tout le Drive à qui la lisait. Une propriété de
   script se change sans redéployer, contrairement à une constante.
3. Le service Drive avancé est **déjà activé** dans le projet, la version
   actuelle appelle `Drive.Files.update`. Rien à faire.
4. Déployer une nouvelle version du déploiement web existant, en gardant la même
   URL pour ne pas avoir à changer `LASCLAY_DRIVE_PUSH_URL`. Exécution en tant
   que soi-même, accès « toute personne disposant du lien ».
5. `testAuth()` dans l'éditeur dit si le jeton est posé, vérifie la liste
   blanche et affiche les racines autorisées. À lancer après tout
   redéploiement.

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
