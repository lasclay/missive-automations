#!/usr/bin/env python3
"""Envoie l'excuse de Gabriel aux 23 contacts de la liste chaude servis par erreur.

Le texte est le sien, mot pour mot, repris de son brouillon Missive. Chaque
excuse part EN REPONSE dans le fil ou l'envoi de 10 h est arrive, donc elle se
lit juste en dessous. Le fil vient de fils_chauds.json pour les 19 reponses, et
du journal d'envoi pour les 4 courriels neufs.

Journal `excuses_journal.json` ecrit apres chaque envoi : une relance ne
s'excuse jamais deux fois aupres de la meme personne.

    python3 excuses_chaude.py                simulation
    python3 excuses_chaude.py --envoyer      envoie pour de vrai
"""
import datetime
import json
import os
import subprocess
import sys
import time

from voix_gabriel import en_html

ICI = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.join(os.path.dirname(ICI), "missive_client.js")
JOURNAL = os.path.join(ICI, "excuses_journal.json")
DE = "media@lasclay.com"
OBJET = "Re: L'asclépiade à Dragons' Den le 17 septembre"

TEXTE = """Désolé pour le message,

j'ai envoyé un ancien brouillon par erreur, en voulant le supprimer.

Chaleureusement,
__
Gabriel Gouveia
Co-fondateur
+1 (581) 982-5857
Lasclay.com"""


def appel(charge):
    p = subprocess.run(["node", CLIENT, "reply"], input=json.dumps(charge),
                       capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        return {"erreur": (p.stderr or p.stdout).strip()[:300]}
    try:
        return json.loads(p.stdout)
    except ValueError:
        return {"erreur": p.stdout.strip()[:300]}


def file_attente():
    envois = json.load(open(os.path.join(ICI, "envoi_fr_journal.json"), encoding="utf-8"))
    fils = json.load(open(os.path.join(ICI, "fils_chauds.json"), encoding="utf-8"))
    par_adresse = {k.strip().lower(): v for k, v in fils.items()}
    file, sans_fil = [], []
    for adresse, fiche in envois.items():
        if fiche.get("feuille") != "chaude":
            continue
        fil = par_adresse.get(adresse, {}).get("id") or fiche.get("conversation")
        if not fil:
            sans_fil.append(adresse)
            continue
        file.append({"courriel": adresse, "fil": fil,
                     "quand": fiche["quand"], "mode": fiche["mode"]})
    file.sort(key=lambda t: t["quand"])
    return file, sans_fil


def main(argv):
    envoyer = "--envoyer" in argv
    pause = 10.0
    if "--pause" in argv:
        pause = float(argv[argv.index("--pause") + 1])
    journal = json.load(open(JOURNAL, encoding="utf-8")) if os.path.exists(JOURNAL) else {}

    file, sans_fil = file_attente()
    reste = [t for t in file if t["courriel"] not in journal]
    print(f"{len(file)} excuses à faire, {len(journal)} déjà faites, "
          f"{len(reste)} à envoyer, une aux {pause:.0f} s.", flush=True)
    if sans_fil:
        print(f"  SANS FIL, à faire à la main : {', '.join(sans_fil)}", flush=True)
    if not envoyer:
        print("\n--- le texte ---")
        print(TEXTE)
        print("\n--- les destinataires ---")
        for t in reste:
            print(f"  · {t['courriel']:42s} fil {t['fil'][:8]}  ({t['mode']})")
        print("\nSimulation. Relancer avec --envoyer.")
        return 0

    faits, echecs = 0, []
    for i, t in enumerate(reste, 1):
        res = appel({"id": t["fil"], "from": DE, "to": [t["courriel"]],
                     "subject": OBJET, "body": en_html(TEXTE), "send": True})
        horo = datetime.datetime.now().isoformat(timespec="seconds")
        if res.get("ok"):
            faits += 1
            journal[t["courriel"]] = {"quand": horo, "fil": t["fil"]}
            json.dump(journal, open(JOURNAL, "w"), ensure_ascii=False, indent=1)
            print(f"[{i}/{len(reste)}] {horo[11:]} ✓ {t['courriel']}", flush=True)
        else:
            echecs.append((t["courriel"], res.get("erreur") or res))
            print(f"[{i}/{len(reste)}] {horo[11:]} ✗ {t['courriel']} "
                  f"{res.get('erreur') or res}", flush=True)
        if i < len(reste):
            time.sleep(pause)

    print(f"\n{faits} excuses envoyées, {len(echecs)} en échec.", flush=True)
    for a, e in echecs:
        print(f"  {a} : {e}", flush=True)
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
