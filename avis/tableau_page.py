import os, sys
S = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
G = os.path.dirname(os.path.abspath(__file__))
h = open(f"{G}/qc_gabarit.html").read()
d = open(f"{S}/table.json").read().replace("</script>", "<\\/script>")
open(f"{S}/qc.html", "w").write(h.replace("__DONNEES__", d))
print("page:", os.path.getsize(f"{S}/qc.html"), "octets")
