#!/usr/bin/env python3
"""Pousse un fichier vers Drive par l'Apps Script du projet.

Les identifiants sont lus depuis l'environnement Render du projet
(LASCLAY_DRIVE_PUSH_URL / LASCLAY_DRIVE_PUSH_TOKEN) et ne transitent jamais par
la ligne de commande.

Le pousseur côté Apps Script tient une liste blanche de cibles. Au 30 juillet
2026 elle ne contient que `controle`, qui pointe sur le chiffrier, et le script
refuse tout ce qui fait moins de 100 Ko ou ne commence pas par « PK ». Déposer le
mémo PDF au même endroit demande donc d'ajouter une cible côté Apps Script ; voir
`DEPOT_DRIVE.md`. Le contrôle de forme est ici adapté au type de fichier pour que
ce client soit prêt le jour où la cible existe.
"""
import base64
import os
import sys
import urllib.parse
import urllib.request

SIGNATURES = {b'PK': 'classeur xlsx', b'%P': 'document PDF'}

path = sys.argv[1]
target = sys.argv[2] if len(sys.argv) > 2 else 'controle'
url = os.environ['LASCLAY_DRIVE_PUSH_URL']
token = os.environ['LASCLAY_DRIVE_PUSH_TOKEN']

blob = open(path, 'rb').read()
tete = blob[:2]
assert tete in SIGNATURES, f'type de fichier inattendu : {tete!r}'
assert len(blob) > 100_000, 'le pousseur refuse ce qui fait moins de 100 Ko'
payload = base64.b64encode(blob)

full = f"{url}?{urllib.parse.urlencode({'file': target, 'token': token})}"
req = urllib.request.Request(full, data=payload,
                             headers={'Content-Type': 'text/plain'}, method='POST')
with urllib.request.urlopen(req, timeout=300) as r:
    reponse = r.read().decode('utf8', 'replace')[:600]
    print(r.status, reponse)
    if 'non autorisé' in reponse:
        print(f"\nLa cible « {target} » n'est pas dans la liste blanche de "
              f"l'Apps Script. Voir DEPOT_DRIVE.md pour l'y ajouter.")
