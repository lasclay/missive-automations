#!/usr/bin/env python3
"""Recharge les 250 fiches de Lasclay_v2.xlsx dans le navigateur de brouillons.

La page est un fichier statique : les contacts vivent dans un bloc JSON qu'on
remplace en entier a chaque version, plutot que de la reecrire a la main.
"""
import json
import os
import re
import sys

import openpyxl

VERSION = 12
SOURCE = "Lasclay_v2.xlsx"
PAGE = os.path.join(
    "/tmp/claude-0/-home-user-missive-automations",
    "dcfcba14-3889-5dfd-96e3-63264ff80ae0/scratchpad/brouillons-medias.html")

NOTE = (
    "<div class=\"note\"><b>Version 12.</b> Le lien du média kit est dans les "
    "247 brouillons, juste avant le paragraphe des bénéfices : un journaliste qui "
    "envisage un sujet veut savoir tout de suite s'il aura des images. Le corps suit "
    "le squelette que Gabriel a corrigé lui-même, et Larocque et Pouliot sont repris "
    "mot pour mot.<br><br><b>Rien ne part sans relecture.</b> Le proxy Missive dépose "
    "des brouillons : un appel par journaliste, en <code>to</code> seul, depuis "
    "media@lasclay.com, suivi des ouvertures et des clics désactivé, environ 60 par "
    "jour.</div>")


def index(ws):
    return {c.value: i for i, c in enumerate(ws[1])}


def fiches():
    wb = openpyxl.load_workbook(SOURCE)
    ws = wb["Liste chaude (34)"]
    h = index(ws)
    out = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r[h["Nom"]]:
            continue
        out.append({"l": "chaude", "n": r[h["Nom"]], "m": r[h["Média"]],
                    "e": r[h["Courriel"]] or "", "d": str(r[h["Dernier contact"]] or ""),
                    "s": r[h["Sujet du dernier échange"]] or "", "a": r[h["Angle"]] or "",
                    "o": r[h["Objet suggéré"]] or "", "r": r[h["Registre"]] or "",
                    "p": r[h["Notes"]] or "", "t": r[h["Brouillon"]] or ""})

    ws = wb["Liste froide FPJQ (217)"]
    h = index(ws)
    for r in ws.iter_rows(min_row=2, values_only=True):
        nom = " ".join(x for x in (r[h["Prénom"]], r[h["Nom"]]) if x)
        if not nom:
            continue
        out.append({"l": "froide", "n": nom, "m": r[h["Média"]] or "",
                    "e": r[h["Courriel"]] or "", "d": r[h["Priorité"]] or "",
                    "s": r[h["Secteurs pertinents"]] or "", "a": r[h["Angle"]] or "",
                    "o": r[h["Objet suggéré"]] or "", "r": r[h["Région"]] or "",
                    "p": r[h["Précaution"]] or "", "t": r[h["Brouillon"]] or ""})
    return out


def main():
    contacts = fiches()
    html = open(PAGE, encoding="utf-8").read()
    bloc = json.dumps(contacts, ensure_ascii=False)
    html, n = re.subn(r'(<script id="data" type="application/json">\n).*?(\n</script>)',
                      lambda m: m.group(1) + bloc + m.group(2),
                      html, flags=re.S)
    assert n == 1, "bloc de données introuvable"
    html = re.sub(r"\d+ contacts · v\d+ ·", f"{len(contacts)} contacts · v{VERSION} ·", html)
    html = re.sub(r'<div class="note">.*?</div>', lambda m: NOTE, html, count=1, flags=re.S)
    open(PAGE, "w", encoding="utf-8").write(html)

    kit = sum(1 for c in contacts if "1pyCUbfHYQhpXXl4FoCC2RCFXKRvGS5Zr" in c["t"])
    print(f"{len(contacts)} fiches, {kit} avec le média kit → {PAGE}")


if __name__ == "__main__":
    sys.exit(main())
