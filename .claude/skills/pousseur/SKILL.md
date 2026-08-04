---
name: pousseur
description: Pousseur Lasclay Google — écrit des fichiers dans le Drive de Lasclay depuis la session, par l'application Apps Script « Pousseur Lasclay Google ». Sert à déposer un chiffrier, un PDF, un document ou une image dans un dossier Drive, ou à remplacer un fichier existant en conservant son lien et ses partages. Couvre aussi les garde-fous du script, le diagnostic des refus et la limite à connaître : il écrit, il ne supprime pas.
when_to_use: Déclenche dès qu'il faut déposer un fichier dans le Drive de Lasclay, mettre à jour un chiffrier partagé sans casser son lien, ou pousser un livrable produit dans la session. Déclenche même sans le mot pousseur — « mets ce xlsx dans le dossier Drive », « remplace le chiffrier de prévisions », « téléverse le rapport », « pousse ça sur mon Drive ». Déclenche aussi quand un appel au pousseur échoue et qu'il faut comprendre pourquoi.
argument-hint: [fichier à pousser et destination]
allowed-tools:
  - Bash(node drive_push.js:*)
  - Read
  - Grep
  - Glob
---

# Pousseur Lasclay Google

N'explore pas pour retrouver comment pousser un fichier : tout est ci-dessous.

## Ce que c'est, et ce que ce n'est pas

Une application **Google Apps Script** déployée en application web, propriété de
`admin@lasclay.com`, qui reçoit un fichier en base64 et l'écrit dans le Drive du compte.

- Projet : **« Pousseur Lasclay Google »**, id `1A8T78KHZPiBOJ8V-3Cc-dfzabUOha8RJ1nm_b-gP0CRJboxgiYqMs32T`
- Déploiement : `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS` — le script agit
  donc avec les droits Drive complets du compte, et l'URL seule suffit à l'appeler.
- Il n'expose que `doPost`. Un GET renvoie « Script function not found: doGet » : c'est normal.

**Il écrit. Il ne supprime pas, ne déplace pas, ne renomme pas, ne liste pas.** Il n'y a
qu'un seul chemin dans le code : écraser un fichier existant, ou en créer un neuf. Pour
supprimer ou déplacer quoi que ce soit, il faut passer par le connecteur Google Drive de
la session — qui, lui, ne sait pas supprimer non plus — ou le faire à la main.

## Prérequis

Le client est `drive_push.js`, à la racine du dépôt **`lasclay/missive-automations`**.
Il lit l'environnement, jamais de secret en dur :

| Variable | Rôle |
| --- | --- |
| `LASCLAY_DRIVE_PUSH_URL` | requis, se termine par `/exec` |
| `LASCLAY_DRIVE_PUSH_TOKEN` | requis |

Commence toujours par la sonde, qui vaut test d'authentification et n'écrit rien :

```bash
node drive_push.js --check
```

Attendu : `AUTH OK — le script répond : error:corps vide — fichier NON modifié`.
Le message d'erreur est le bon signe : le script a validé le jeton avant de refuser
le corps vide.

## Pousser un fichier

```bash
# Remplacer un fichier existant — lien, partages et historique conservés
node drive_push.js rapport.xlsx --id 1nAyDIlxuWfz4V7leViPN8T6Gvr3BBMz0

# Déposer dans un dossier — écrase l'homonyme s'il existe, sinon crée
node drive_push.js rapport.xlsx --folder 1uOzzoD4biYbY8qfWHb2uhs32G9TA3XMB

# Idem avec un nom différent du fichier local
node drive_push.js sortie.xlsx --folder <idDossier> --name "Suivi 2026.xlsx"

# Cible de la liste blanche du script
node drive_push.js previsions.xlsx --cle controle
```

Options : `--mime <type>` force le type MIME, deviné d'après l'extension sinon.
`--min <octets>` ajuste le plancher de taille.

**Préfère `--id` quand le fichier existe déjà.** C'est ce qui préserve le lien : toute
personne à qui le fichier a été partagé continue de voir la version à jour, et les
signets ne cassent pas.

## Les garde-fous du script — à connaître avant de s'étonner d'un refus

Ils viennent d'un incident du 27 juillet où un envoi raté avait vidé un fichier qui
comptait. Ils protègent ce qui existe déjà, et laissent passer ce qui est neuf.

| Garde-fou | Comportement |
| --- | --- |
| **Corps vide** | Refusé. Le fichier cible n'est pas touché. |
| **Plancher de taille** | 100 Ko par défaut, **à l'écrasement seulement**. Un fichier neuf n'y est pas soumis. Ajustable avec `--min`. |
| **Signature binaire** | Vérifiée par type quand il y en a une : `PK` pour xlsx, docx, pptx et zip ; `%PDF` pour les PDF ; les octets d'en-tête pour PNG et JPEG. Un envoi tronqué ou une page d'erreur HTML est donc rejeté avant d'écraser quoi que ce soit. Les types sans signature connue passent. |
| **Racines autorisées** | `RACINES_AUTORISEES` est **vide**, ce qui ouvre tout le Drive du compte. C'est le réglage voulu. |

Types reconnus d'après l'extension : xlsx, xls, csv, tsv, pdf, docx, pptx, json, txt, md,
html, png, jpg, jpeg, svg, zip. Le reste part en `application/octet-stream`.

## Quand ça répond `unauthorized`

Le jeton est comparé à `PropertiesService.getScriptProperties().getProperty('TOKEN')`,
avec repli sur la constante `SECRET` du code. Deux causes, dans cet ordre :

1. **Le déploiement sert une ancienne version du script.** C'est le cas le plus fréquent
   après une modification du code : Apps Script continue de servir la version déployée,
   pas la version enregistrée. Correction : dans l'éditeur, *Déployer › Gérer les
   déploiements › crayon › Version : Nouvelle version*.
2. **Une propriété de script `TOKEN` existe et supplante `SECRET`.** Vérifier dans
   *Paramètres du projet › Propriétés du script*, et aligner avec
   `LASCLAY_DRIVE_PUSH_TOKEN`.

Ne pars pas à deviner des noms de champs : le jeton va en **paramètre d'URL**, sous le nom
`token`, et nulle part ailleurs. Le script lit `e.parameter.token`.

## Les autres réponses

| Réponse | Sens |
| --- | --- |
| `status:200:ok:<nom>:<n> octets:<id>` | Fichier existant remplacé |
| `status:200:cree:<nom>:<n> octets:<id>` | Fichier neuf créé |
| `status:400:refus:…` | Garde-fou déclenché — **le fichier cible n'a pas été modifié** |
| `error:corps vide` | Aucune donnée reçue |
| `error:corps illisible, base64 attendu` | Le corps n'était pas du base64 |
| `error:fichier non autorisé: <clé>` | Clé absente de la liste blanche |
| `error:un dossier sans nom de fichier…` | `--folder` sans `--name` ni nom déductible |
| `error:destination introuvable` | Id de fichier ou de dossier invalide |

Le client traduit tout ça en message lisible et sort en code 1 sur échec.

## Note de sécurité

La constante `SECRET` est **écrite en clair dans le code du script**, et le projet est
partageable par lien. Comme `RACINES_AUTORISEES` est vide et que le déploiement est
`ANYONE_ANONYMOUS` en `USER_DEPLOYING`, quiconque obtient l'URL et le jeton peut écrire
n'importe où dans le Drive du compte. Deux mesures simples si tu veux resserrer :
déplacer le jeton dans les propriétés de script et vider la constante, et renseigner
`RACINES_AUTORISEES` avec les seuls dossiers concernés — par exemple
`'1zOTIG_Mk6-L7o34qzp7jr8Qjk959khDY'`, celui des prévisions financières.

## Repères Drive utiles

| Dossier ou fichier | Id |
| --- | --- |
| Dépôt portail ADI — v5 (août 2026) | `1uOzzoD4biYbY8qfWHb2uhs32G9TA3XMB` |
| Prévisions financières | `1zOTIG_Mk6-L7o34qzp7jr8Qjk959khDY` |
| PREVISIONS LASCLAY controle (clé `controle`) | `1KHvc5QlzyzGtAcGriO7oEg9Il1ySvXqg` |
