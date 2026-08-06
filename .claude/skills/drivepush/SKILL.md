---
name: drivepush
description: Pousseur Google Drive de Lasclay — l'application Apps Script qui dépose ou remplace un fichier binaire dans n'importe quel dossier du Drive, y compris les Drive partagés. C'est le SEUL moyen d'écrire un fichier dans le Drive depuis Claude : le connecteur Google Drive ne peut créer que des dossiers et de petits fichiers texte, parce que tout binaire devrait transiter en base64 dans l'appel d'outil. Couvre le dépôt d'un chiffrier, d'un PDF, d'un lot de pièces justificatives, et le remplacement d'un fichier existant en conservant son lien.
when_to_use: Déclenche dès qu'il faut ÉCRIRE un fichier dans le Google Drive de Lasclay — déposer, téléverser, remplacer, mettre à jour, publier un fichier. Déclenche même sans nommer le pousseur : « mets ça dans le Drive », « dépose les pièces dans le dossier », « remplace le chiffrier de prévisions », « pousse le PDF aux investisseurs », « téléverse le relevé RSDE ». Ne déclenche pas pour LIRE le Drive : le connecteur Google Drive suffit pour chercher, lire et créer des dossiers.
argument-hint: [ce que tu veux déposer et où]
allowed-tools:
  - Bash(curl:*)
  - Bash(base64:*)
  - Bash(python3:*)
  - Read
  - Grep
  - Glob
---

# Pousseur Drive — écriture de fichiers dans le Drive Lasclay

N'explore pas le dépôt pour retrouver comment ça marche : tout est ici. Ne réinvente pas
d'appel à la main, utilise le script ci-dessous.

## Pourquoi il existe

Le connecteur Google Drive ne prend le contenu binaire qu'en base64 passé dans l'appel
d'outil. Il faut donc retranscrire chaque octet : 41 Ko de chiffrier font 53 000 caractères,
et 50 Mo de pièces jointes sont hors de portée de plusieurs ordres de grandeur. Le pousseur
règle ça : le fichier part de la machine par `curl`, sans jamais passer par le contexte.

Répartition des rôles :

| Besoin | Outil |
| --- | --- |
| chercher, lire, lister, créer un **dossier** | connecteur Google Drive (MCP) |
| copier un fichier existant | connecteur Google Drive (`copy_file`) |
| **déposer ou remplacer un fichier** | **ce pousseur** |

## Prérequis

| Variable | Rôle |
| --- | --- |
| `LASCLAY_DRIVE_PUSH_URL` | l'URL `/exec` du déploiement Apps Script |
| `LASCLAY_DRIVE_PUSH_TOKEN` | le jeton, **dans la chaîne de requête**, jamais dans le corps |

Le corps de la requête est **le fichier en base64, rien d'autre**. Le jeton et la destination
vont dans l'URL. Un corps JSON donne `error:corps illisible, base64 attendu`.

## L'appel

Ne l'écris pas à la main. Le script `push_drive.sh` livré à côté de ce fichier gère l'encodage
du nom, la redirection 302 et les reprises :

```bash
.claude/skills/drivepush/push_drive.sh <dossierId> <fichier> [nom]
# → OK <nom>   |   REFUS <nom> -> <réponse>   |   ECHEC <nom>
```

Apps Script répond par un **302** : il faut suivre l'en-tête `Location` à la main. `curl -L`
transforme le POST en GET et retombe sur une page d'erreur Drive qui n'a rien à voir avec le
vrai résultat — c'est le piège classique.

## Les trois destinations

Exactement une des trois, sinon l'appel retombe sur le repli et écrase le chiffrier de contrôle.

| Paramètre | Effet |
| --- | --- |
| `&folder=<idDossier>&name=<nom>` | écrase l'homonyme du dossier, ou **crée** le fichier. C'est le cas normal. |
| `&id=<idFichier>` | remplace un fichier existant, **le lien de partage est conservé**. |
| `&file=<clé>` | une clé de la liste blanche du script. Aujourd'hui : `controle` → `PREVISIONS LASCLAY controle`. |

Facultatif : `&mime=…` (deviné d'après l'extension sinon), `&min=<octets>` pour ajuster le
plancher de taille.

## Les pièges qui ont déjà coûté cher

1. **`folderId` n'existe pas. C'est `folder`.** Le script lit `p.folder || p.dossier`. Un nom
   de paramètre inconnu est ignoré en silence, l'appel tombe dans
   `if (!fileId && !dossierId) fileId = ALLOWED_FILES['controle']`, et **le chiffrier de
   prévisions est écrasé**. C'est arrivé le 6 août 2026, trois fois de suite. Récupération par
   l'historique de versions de Drive.
2. **Ne jamais sonder l'endpoint « pour voir ».** Chaque POST valide écrit quelque part. Pour
   vérifier que le déploiement répond, envoie un corps vide : `error:corps vide` prouve que le
   jeton passe, sans rien toucher.
3. **Le plancher de 100 Ko ne s'applique qu'à l'écrasement.** Un fichier neuf passe à toute
   taille. Donc une reprise après un succès incertain sur un fichier de moins de 100 Ko sera
   refusée : `status:400:refus:contenu de N octets, minimum 100000`. Ça veut presque toujours
   dire que **le premier envoi a réussi**. Vérifie la taille dans Drive avant de conclure à un
   échec.
4. **La signature est vérifiée par type.** Un `.xlsx`, `.docx`, `.pptx` ou `.zip` doit commencer
   par `PK`, un `.pdf` par `%PDF`, un `.png` et un `.jpg` par leur en-tête. Un envoi tronqué ou
   une page HTML d'erreur est refusé avant d'écraser quoi que ce soit.
5. **Confirme avant d'écraser.** `&id=` et `&file=` remplacent le contenu d'un fichier qui
   existe. `&folder=&name=` écrase aussi s'il y a un homonyme. Demande avant, sauf instruction
   explicite dans le tour courant.

## Réponses

| Réponse | Sens |
| --- | --- |
| `status:200:cree:<nom>:<N> octets:<id>` | fichier neuf créé |
| `status:200:ok:<nom>:<N> octets:<id>` | fichier existant remplacé |
| `status:400:refus:…` | garde-fou déclenché, **rien n'a été modifié** |
| `error:destination introuvable: …` | mauvais `id` ou `folder` |
| `error:destination hors des dossiers autorisés` | `RACINES_AUTORISEES` est non vide et exclut la cible |
| `unauthorized` | jeton absent, ou placé dans le corps au lieu de l'URL |

## Dépôt en lot

Une pièce à la fois, en séquence. Compte une à trois secondes par fichier : 136 pièces pour
57 Mo ont pris une douzaine de minutes. Lance en arrière-plan si le lot dépasse la centaine,
et **vérifie à la fin** en comparant les tailles plutôt que les seuls noms :

```bash
for f in ./pieces/*; do ./push_drive.sh "$DOSSIER" "$f" || echo "ECHEC $f"; done
```

Puis liste le dossier avec le connecteur Drive et compare nombre, noms et tailles à la source.
Une liste de plus de cent fichiers dépasse la limite de sortie de l'outil : elle est écrite
dans un fichier, à traiter en `python3` plutôt qu'à lire.

## Le code

Il vit dans le projet Apps Script du compte `admin@lasclay.com`, pas dans ce dépôt. Points de
structure utiles à connaître :

- `RACINES_AUTORISEES = []` — aucune restriction de dossier. Tout le Drive du compte, Drive
  partagés compris (`supportsAllDrives: true` sur les appels `Drive.Files`). Y mettre un ou des
  identifiants de dossier referme le périmètre.
- `ALLOWED_FILES` — la liste blanche des cibles nommées, et la valeur du repli.
- `TAILLE_MIN_ECRASEMENT = 100000` — le plancher, sur les écrasements seulement.

Si le comportement ne correspond pas à ce qui est écrit ici, c'est que le déploiement est en
retard sur le code : un enregistrement dans l'éditeur ne suffit pas, il faut **redéployer**
(Déployer → Gérer les déploiements → modifier la version). Ne conclus pas à une limite du
script avant d'avoir vérifié la version déployée.

## Skills à charger

- **`qbo`** — les pièces justificatives à déposer viennent souvent de QuickBooks, par l'action
  `download` ou par le `TempDownloadUri` d'un `Attachable`.
- **`finances-lasclay`** — pour le chiffrier de prévisions, sa structure et ce que veut dire
  chaque version.
