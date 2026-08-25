#!/usr/bin/env python3
"""Convertit l'export en lot Shopify (JSONL) en CSV prêt pour le Gestionnaire
de publicités Meta. Valeurs brutes : Meta les normalise et les hache dans le
navigateur, ce qui donne un meilleur taux de correspondance qu'un pré-hachage."""
import json, csv, pathlib, sys, collections

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "customers.jsonl")
dst = pathlib.Path("Lasclay - liste clients Shopify (Meta).csv")
CHAMPS = ["email", "fn", "ln", "ct", "st", "country", "zip", "value"]

vus, lignes, consent, sans = set(), [], collections.Counter(), 0
for l in src.open(encoding="utf-8"):
    l = l.strip()
    if not l:
        continue
    o = json.loads(l)
    if not str(o.get("id", "")).startswith("gid://shopify/Customer/"):
        continue                                    # sous-objets imbriqués
    e = (o.get("email") or "").strip().lower()
    if not e or "@" not in e:
        sans += 1
        continue
    if e in vus:
        continue
    vus.add(e)
    consent[((o.get("emailMarketingConsent") or {}).get("marketingState") or "INCONNU")] += 1
    a = o.get("defaultAddress") or {}
    lignes.append({
        "email": e,
        "fn": (o.get("firstName") or "").strip(),
        "ln": (o.get("lastName") or "").strip(),
        "ct": (a.get("city") or "").strip(),
        "st": (a.get("provinceCode") or "").strip(),
        "country": (a.get("countryCodeV2") or "").strip(),
        "zip": (a.get("zip") or "").strip(),
        "value": f'{float((o.get("amountSpent") or {}).get("amount") or 0):.2f}',
    })

with dst.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=CHAMPS)
    w.writeheader()
    w.writerows(lignes)

print(f"{len(lignes):,} lignes → {dst}")
print(f"{sans:,} enregistrements sans courriel exploitable, écartés")
for k, v in consent.most_common():
    print(f"  {k:16} {v:6,} ({v/len(lignes)*100:5.1f} %)")
