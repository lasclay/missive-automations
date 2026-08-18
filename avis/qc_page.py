import os
S=os.path.dirname(os.path.abspath(__file__))
h=open(f"{S}/qc_gabarit.html").read()
d=open(f"{S}/qc.json").read().replace("</script>","<\\/script>")
open(f"{S}/qc.html","w").write(h.replace("__DONNEES__",d))
print("page:",os.path.getsize(f"{S}/qc.html"),"octets")
