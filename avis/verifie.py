# Contrôle indépendant: chaque avis rédigé doit s'appuyer sur du texte réellement présent
# dans les messages du client de SON fil. Les agents ont travaillé dans un répertoire
# partagé où des scripts se sont écrasés entre eux; on ne se fie pas à leur parole.
import json, glob, os, re, unicodedata, sys

S = os.path.dirname(os.path.abspath(__file__))

def norm(t):
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", t)

def mots(t, n=4):
    return {w for w in norm(t).split() if len(w) >= n}

total = ok = suspects = horslot = 0
details = []
for f in sorted(glob.glob(f"{S}/redige_*.jsonl")):
    m = re.search(r"redige_(\d+)\.jsonl$", f)
    if not m: continue
    i = m.group(1)
    src = {}
    for l in open(f"{S}/lot_{i}.jsonl"):
        if not l.strip(): continue
        d = json.loads(l)
        src[d["id"]] = " ".join(x.get("txt") or "" for x in d.get("messages") or [])
    for l in open(f):
        if not l.strip(): continue
        a = json.loads(l)
        total += 1
        if a["id"] not in src:
            horslot += 1
            details.append((i, a["id"], "ID ABSENT DU LOT", ""))
            continue
        base = mots(src[a["id"]])
        cible = mots(a.get("corps", ""))
        if not cible:
            continue
        manquants = cible - base
        part = len(manquants) / len(cible)
        # Au-delà d'un mot sur cinq absent de la source, ce n'est plus une coquille corrigée.
        if part > 0.20:
            suspects += 1
            details.append((i, a["id"], f"{part:.0%} de mots absents", " ".join(sorted(manquants))[:120]))
        else:
            ok += 1

print(f"avis vérifiés   : {total}")
print(f"ancrés dans la source : {ok}")
print(f"suspects        : {suspects}")
print(f"ids hors lot    : {horslot}")
for d in details[:15]:
    print(f"  lot {d[0]} {d[1][:8]} {d[2]:24s} {d[3]}")
