#!/usr/bin/env python3
"""Depose les contacts ajoutes le 15 septembre : Radio-Canada, TVA, presse anglaise.

Tous sont des courriels neufs — aucun de ces medias ne nous a jamais ecrit, donc
il n'y a pas de fil ou repondre. Chaque brouillon porte deja sa signature, en
francais ou en anglais selon la feuille : on ne repasse pas par la signature par
defaut de Missive, qui est l'anglaise pour l'alias admin@lasclay.com.

    python3 envoi_nouveaux.py            depose des brouillons, rien ne part
    python3 envoi_nouveaux.py --envoyer  envoie pour de vrai
"""
import base64
import json
import os
import subprocess
import sys

import openpyxl

DE = "media@lasclay.com"
ICI = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.join(os.path.dirname(ICI), "missive_client.js")
PHOTO = os.path.join(ICI, "dragons-plateau.jpg")
FEUILLES = ("Ajouts FR — RC et TVA", "Presse anglophone")


def appel(charge):
    p = subprocess.run(["node", CLIENT, "send"], input=json.dumps(charge),
                       capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        return {"erreur": (p.stderr or p.stdout).strip()[:200]}
    return json.loads(p.stdout)


def main(envoyer):
    wb = openpyxl.load_workbook(os.path.join(ICI, "Lasclay_v2.xlsx"))
    piece = [{"base64_data": base64.b64encode(open(PHOTO, "rb").read()).decode(),
              "filename": "lasclay-dragons-den.jpg"}]
    faits, echecs, fils = 0, [], {}
    for titre in FEUILLES:
        ws = wb[titre]
        h = {c.value: i for i, c in enumerate(ws[1])}
        print(f"\n## {titre}")
        for r in ws.iter_rows(min_row=2, values_only=True):
            adresse, texte = r[h["Courriel"]], r[h["Brouillon"]]
            if not adresse or not texte:
                continue
            charge = {"from": DE, "to": [adresse], "subject": r[h["Objet"]],
                      "body": texte, "attachments": piece}
            if envoyer:
                charge["send"] = True
            res = appel(charge)
            nom = r[h["Média"]] if "Média" in h else adresse
            if res.get("ok"):
                faits += 1
                fils[adresse] = res.get("conversation")
                print(f"  ✓ {adresse:40s} {nom}")
            else:
                echecs.append((adresse, res.get("erreur") or res))
                print(f"  ✗ {adresse:40s} {res.get('erreur') or res}")
    json.dump(fils, open(os.path.join(ICI, "conversations_nouveaux.json"), "w"),
              ensure_ascii=False, indent=1)
    print(f"\n{faits} {'envoyé' if envoyer else 'déposé en brouillon'}, {len(echecs)} en échec")
    for a, e in echecs:
        print(f"  {a} : {e}")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main("--envoyer" in sys.argv))
