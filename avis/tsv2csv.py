# Le gabarit Judge.me se televerse en CSV : les avis contiennent virgules et guillemets,
# csv.writer les protege, un simple remplacement de tabulations ne le ferait pas.
import csv, sys, os
for src, dest in (("import_judgeme.tsv", "import_judgeme.csv"),
                  ("import_judgeme_boutique.tsv", "import_judgeme_boutique.csv"),
                  ("import_judgeme_a_relire.tsv", "import_judgeme_a_relire.csv")):
    S = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    p = f"{S}/{src}"
    if not os.path.exists(p):
        continue
    lignes = [l.rstrip("\n").split("\t") for l in open(p) if l.strip()]
    with open(f"{S}/{dest}", "w", newline="") as f:
        csv.writer(f).writerows(lignes)
    print(dest, ":", len(lignes) - 1, "avis")
