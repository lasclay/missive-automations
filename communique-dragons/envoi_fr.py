#!/usr/bin/env python3
"""Envoie TOUT le francais, un courriel aux 30 secondes, dans l'ordre de valeur.

    liste chaude  -> en reponse dans le fil quand il y en a un, sinon courriel neuf
    ajouts FR     -> Radio-Canada, TVA, Quebecor, courriels neufs avec la presentation
    liste froide  -> les 215 fiches FPJQ, courriels neufs

Le journal `envoi_fr_journal.json` est ecrit apres CHAQUE envoi : relancer le
script reprend ou il s'est arrete et ne renvoie jamais deux fois a la meme
adresse. Rien ne part sans --envoyer.

    python3 envoi_fr.py                 simulation, affiche la file
    python3 envoi_fr.py --envoyer       envoie pour de vrai
    python3 envoi_fr.py --envoyer --pause 30
"""
import base64
import datetime
import json
import os
import subprocess
import sys
import time

import openpyxl

from voix_gabriel import en_html

ICI = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.join(os.path.dirname(ICI), "missive_client.js")
CLASSEUR = os.path.join(ICI, "Lasclay_v2.xlsx")
JOURNAL = os.path.join(ICI, "envoi_fr_journal.json")
PHOTO = os.path.join(ICI, "dragons-plateau.jpg")
PRESENTATION = os.path.join(ICI, "presentation-lasclay.pdf")

DE = "media@lasclay.com"
OBJET_CHAUD = "L'asclépiade à Dragons' Den le 17 septembre"
SIGNATURE = """Chaleureusement,
__
Gabriel Gouveia
Co-fondateur
+1 (581) 982-5857
Lasclay.com"""


def appel(commande, charge):
    p = subprocess.run(["node", CLIENT, commande], input=json.dumps(charge),
                       capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        return {"erreur": (p.stderr or p.stdout).strip()[:300]}
    try:
        return json.loads(p.stdout)
    except ValueError:
        return {"erreur": p.stdout.strip()[:300]}


def file_attente():
    """Construit la file dans l'ordre d'envoi, sans doublon d'adresse."""
    wb = openpyxl.load_workbook(CLASSEUR)
    fils = json.load(open(os.path.join(ICI, "fils_chauds.json"), encoding="utf-8"))
    file, vues = [], set()

    def ajouter(feuille, courriel, objet, corps, signer, deck, nom):
        cle = courriel.strip().lower()
        if not courriel or not corps or corps.startswith("NE PAS") or cle in vues:
            return
        vues.add(cle)
        file.append({"feuille": feuille, "courriel": courriel, "objet": objet,
                     "corps": corps + ("\n\n" + SIGNATURE if signer else ""),
                     "deck": deck, "nom": nom, "fil": fils.get(courriel)})

    ws = wb["Liste chaude (34)"]
    h = {c.value: i for i, c in enumerate(ws[1])}
    for r in ws.iter_rows(min_row=2, values_only=True):
        ajouter("chaude", r[h["Courriel"]], OBJET_CHAUD, r[h["Brouillon"]],
                True, False, r[h["Nom"]])

    ws = wb["Ajouts FR, RC et TVA"]
    h = {c.value: i for i, c in enumerate(ws[1])}
    for r in ws.iter_rows(min_row=2, values_only=True):
        ajouter("ajouts", r[h["Courriel"]], r[h["Objet"]], r[h["Brouillon"]],
                False, True, r[h["Média"]])

    ws = wb["Liste froide FPJQ (217)"]
    h = {c.value: i for i, c in enumerate(ws[1])}
    for r in ws.iter_rows(min_row=2, values_only=True):
        ajouter("froide", r[h["Courriel"]], r[h["Objet suggéré"]], r[h["Brouillon"]],
                True, False, f"{r[h['Prénom']] or ''} {r[h['Nom']] or ''}".strip()
                or r[h["Média"]])
    return file


def marquer_classeur(journal):
    """Recopie la date d'envoi dans la colonne « Envoyé le » des trois feuilles."""
    wb = openpyxl.load_workbook(CLASSEUR)
    n = 0
    for titre in ("Liste chaude (34)", "Ajouts FR, RC et TVA", "Liste froide FPJQ (217)"):
        ws = wb[titre]
        entetes = [c.value for c in ws[1]]
        if "Envoyé le" not in entetes:
            ws.cell(row=1, column=len(entetes) + 1, value="Envoyé le")
            entetes.append("Envoyé le")
        iC, iE = entetes.index("Courriel") + 1, entetes.index("Envoyé le") + 1
        for row in ws.iter_rows(min_row=2):
            a = row[iC - 1].value
            fiche = journal.get((a or "").strip().lower())
            if fiche and not row[iE - 1].value:
                row[iE - 1].value = fiche["quand"][:16].replace("T", " ")
                n += 1
    wb.save(CLASSEUR)
    return n


def main(argv):
    envoyer = "--envoyer" in argv
    pause = 30.0
    if "--pause" in argv:
        pause = float(argv[argv.index("--pause") + 1])
    journal = json.load(open(JOURNAL, encoding="utf-8")) if os.path.exists(JOURNAL) else {}

    file = file_attente()
    reste = [t for t in file if t["courriel"].strip().lower() not in journal]
    print(f"{len(file)} courriels français, {len(journal)} déjà partis, "
          f"{len(reste)} à envoyer, un aux {pause:.0f} s "
          f"→ environ {len(reste) * pause / 60:.0f} minutes.", flush=True)
    for f in ("chaude", "ajouts", "froide"):
        print(f"  {f} : {sum(1 for t in reste if t['feuille'] == f)}", flush=True)
    if not envoyer:
        for t in reste[:5]:
            print(f"  · {t['courriel']:42s} {t['objet']}")
        print("\nSimulation. Relancer avec --envoyer.")
        return 0

    pieces = [{"base64_data": base64.b64encode(open(PHOTO, "rb").read()).decode(),
               "filename": "lasclay-dragons-den.jpg"}]
    deck = [{"base64_data": base64.b64encode(open(PRESENTATION, "rb").read()).decode(),
             "filename": "Lasclay-presentation.pdf"}]

    faits, echecs = 0, []
    for i, t in enumerate(reste, 1):
        charge = {"from": DE, "to": [t["courriel"]], "subject": t["objet"],
                  "body": en_html(t["corps"]), "send": True,
                  "attachments": pieces + (deck if t["deck"] else [])}
        if t["fil"]:
            charge["id"] = t["fil"]["id"]
            res, mode = appel("reply", charge), "réponse"
        else:
            res, mode = appel("send", charge), "neuf"
        horo = datetime.datetime.now().isoformat(timespec="seconds")
        if res.get("ok"):
            faits += 1
            journal[t["courriel"].strip().lower()] = {
                "quand": horo, "mode": mode, "feuille": t["feuille"],
                "conversation": res.get("conversation")}
            json.dump(journal, open(JOURNAL, "w"), ensure_ascii=False, indent=1)
            print(f"[{i}/{len(reste)}] {horo[11:]} ✓ {t['courriel']:42s} "
                  f"{t['feuille']}/{mode}  {t['nom']}", flush=True)
        else:
            echecs.append((t["courriel"], res.get("erreur") or res))
            print(f"[{i}/{len(reste)}] {horo[11:]} ✗ {t['courriel']:42s} "
                  f"{res.get('erreur') or res}", flush=True)
        if i % 20 == 0:
            marquer_classeur(journal)
        if i < len(reste):
            time.sleep(pause)

    n = marquer_classeur(journal)
    print(f"\n{faits} envoyés, {len(echecs)} en échec, {n} lignes datées au classeur.",
          flush=True)
    for a, e in echecs:
        print(f"  {a} : {e}", flush=True)
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
