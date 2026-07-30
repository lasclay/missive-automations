#!/usr/bin/env python3
"""Pousse un fichier vers Drive par l'Apps Script du projet.

Les identifiants sont lus depuis l'environnement (LASCLAY_DRIVE_PUSH_URL /
LASCLAY_DRIVE_PUSH_TOKEN) et ne transitent jamais par la ligne de commande.

    push_drive.py <fichier>                       la cible historique, le chiffrier
    push_drive.py <fichier> controle              pareil, nommé
    push_drive.py <fichier> --id <idFichier>      remplace un fichier existant
    push_drive.py <fichier> --folder <idDossier>  dépose dans un dossier
                            [--name <nom>]        (nom du fichier local par défaut)

Remplacer un fichier existant garde son identifiant, donc son lien de partage :
c'est ce qu'on veut quand des bailleurs l'ont déjà.

La version généralisée de l'Apps Script est dans `apps_script/pousseur_drive.gs`.
Tant qu'elle n'est pas déployée, seule la cible `controle` répond ; voir
`DEPOT_DRIVE.md`.
"""
import base64
import os
import sys
import urllib.parse
import urllib.request

SIGNATURES = {b'PK': 'classeur xlsx', b'%P': 'document PDF'}


def arguments(argv):
    chemin, reste = argv[1], argv[2:]
    params = {}
    cible = None
    i = 0
    while i < len(reste):
        a = reste[i]
        if a in ('--id', '--folder', '--name', '--mime', '--min'):
            params[a[2:]] = reste[i + 1]
            i += 2
        elif not a.startswith('-'):
            cible = a
            i += 1
        else:
            raise SystemExit(f'argument inconnu : {a}')
    if 'folder' in params and 'name' not in params:
        params['name'] = os.path.basename(chemin)
    if cible:
        params['cible'] = cible
    return chemin, params


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    chemin, params = arguments(sys.argv)
    url = os.environ['LASCLAY_DRIVE_PUSH_URL']
    params['token'] = os.environ['LASCLAY_DRIVE_PUSH_TOKEN']

    blob = open(chemin, 'rb').read()
    tete = blob[:2]
    if tete not in SIGNATURES:
        print(f'note : signature {tete!r} inhabituelle, envoi quand même')
    payload = base64.b64encode(blob)

    req = urllib.request.Request(f'{url}?{urllib.parse.urlencode(params)}',
                                 data=payload,
                                 headers={'Content-Type': 'text/plain'},
                                 method='POST')
    with urllib.request.urlopen(req, timeout=300) as r:
        reponse = r.read().decode('utf8', 'replace')[:600]
    print(r.status if hasattr(r, 'status') else 200, reponse)
    if 'non autorisé' in reponse or 'jeton' in reponse:
        print("\nL'Apps Script déployé est encore la version à cible unique. "
              'Voir DEPOT_DRIVE.md pour installer apps_script/pousseur_drive.gs.')


if __name__ == '__main__':
    main()
