#!/usr/bin/env python3
"""Pousse le chiffrier vers Drive par l'Apps Script du projet.

Les identifiants sont lus depuis l'environnement Render du projet
(LASCLAY_DRIVE_PUSH_URL / LASCLAY_DRIVE_PUSH_TOKEN) et ne transitent jamais par
la ligne de commande. Le pousseur refuse tout ce qui fait moins de 100 Ko ou ne
commence pas par « PK ».
"""
import base64, os, sys, urllib.parse, urllib.request

path = sys.argv[1]
target = sys.argv[2] if len(sys.argv) > 2 else 'controle'
url = os.environ['LASCLAY_DRIVE_PUSH_URL']
token = os.environ['LASCLAY_DRIVE_PUSH_TOKEN']

blob = open(path, 'rb').read()
assert blob[:2] == b'PK' and len(blob) > 100_000, 'le pousseur refuserait ce fichier'
payload = base64.b64encode(blob)

full = f"{url}?{urllib.parse.urlencode({'file': target, 'token': token})}"
req = urllib.request.Request(full, data=payload,
                             headers={'Content-Type': 'text/plain'}, method='POST')
with urllib.request.urlopen(req, timeout=300) as r:
    print(r.status, r.read().decode('utf8', 'replace')[:600])
