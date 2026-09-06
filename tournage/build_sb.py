# -*- coding: utf-8 -*-
import html as H
from frames import SB
from concepts import C as ALL, FAM
import scene

ORDER = ["A-01","A-02","A-03","A-04","D-01","D-05","F-07","C-01","C-05","K-01",
         "B-01","B-02","B-03","B-04","B-05","E-01","E-05","I-01",
         "F-01","H-01","H-05","G-01","G-02","L-03"]

o=[];w=o.append
w('''<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Storyboard — Lasclay</title><style>
@page{size:letter;margin:12mm 12mm 15mm}@page :first{margin:0}
:root{--ink:#14100c;--ink2:#3f382f;--mut:#6d6459;--line:#ddd5c8;--l2:#efe9dd;
--paper:#fffdf9;--acc:#1f5d3f;--acc2:#b4531f;--wash:#f6f2e9}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:var(--paper);color:var(--ink);
font-family:"Liberation Sans",Helvetica,Arial,sans-serif;font-size:8pt;line-height:1.38}
p{margin:0 0 2mm}section{page-break-before:always}section.c{page-break-before:auto}
h2{font-size:15pt;margin:0 0 1mm;letter-spacing:-.02em}
h3{font-size:10pt;margin:4mm 0 2mm}
.hd{border-bottom:2.5px solid var(--ink);padding-bottom:2mm;margin-bottom:3mm}
.hd .id{display:inline-block;background:#14100c;color:#8fd0a8;font-weight:700;
font-size:10pt;padding:.8mm 2.2mm;border-radius:2px;margin-right:2.5mm;vertical-align:2px}
.hd .me{color:var(--acc);font-weight:700;font-size:8pt;margin-top:1.2mm}
.hd .no{color:var(--ink2);font-size:8pt;margin-top:1.2mm;max-width:170mm}
.hd .no b{color:var(--acc2)}
.gr{display:grid;gap:3.5mm}
.g4{grid-template-columns:repeat(4,1fr)}.g3{grid-template-columns:repeat(3,1fr)}
.g5{grid-template-columns:repeat(5,1fr)}
.pn{page-break-inside:avoid}
.pn svg{width:100%;aspect-ratio:300/533;display:block;border:1.2px solid var(--ink);background:#fff}
.tc{font-weight:700;font-size:7.6pt;margin-top:1.4mm;color:var(--ink)}
.tc s{text-decoration:none;color:var(--acc);font-weight:700}
.nt{font-size:6.6pt;color:var(--ink2);line-height:1.32;margin-top:.8mm}
.pr{font-size:5.9pt;color:var(--mut);line-height:1.3;margin-top:1.2mm;
background:var(--wash);border-left:2px solid var(--line);padding:1.2mm 1.4mm;
font-family:"Liberation Mono",monospace;word-break:break-word}
.pr b{font-family:"Liberation Sans",sans-serif;color:var(--acc2);letter-spacing:.06em;font-size:5.8pt;display:block}
.cv{height:279mm;padding:22mm 18mm 16mm;background:#14100c;color:#f5f1e8;position:relative;page-break-after:always}
.cv .k{font-size:7.5pt;letter-spacing:.3em;color:#b9ad99}
.cv h1{font-size:40pt;line-height:1.02;margin:10mm 0 0;letter-spacing:-.03em;color:#fffdf9;font-weight:700}
.cv h1 em{font-style:normal;color:#8fd0a8}
.cv .sub{font-size:11pt;margin-top:6mm;max-width:120mm;color:#ddd3c1;line-height:1.45}
.cvg{display:grid;grid-template-columns:repeat(6,1fr);gap:3mm;margin-top:9mm}
.cvg svg{width:100%;aspect-ratio:300/533;display:block;border:1px solid #3a332a;background:#fff;opacity:.92}
.cv .ru{position:absolute;left:18mm;right:18mm;bottom:16mm;border-top:1px solid #3a332a;
padding-top:4mm;display:flex;gap:8mm;font-size:7.5pt;color:#9c917f}
.cv .ru b{display:block;color:#e6dcc9;font-size:8.5pt;margin-bottom:.8mm}
table{width:100%;border-collapse:collapse;font-size:7.4pt;margin-bottom:3mm;page-break-inside:avoid}
th{font-size:6.4pt;text-transform:uppercase;letter-spacing:.08em;text-align:left;
padding:1.3mm 1.6mm;background:#14100c;color:#f2ece0;font-weight:600}
td{padding:1.3mm 1.6mm;border-bottom:1px solid var(--l2);vertical-align:top;line-height:1.34}
tr:nth-child(even) td{background:#faf7f0}
td.n{font-weight:700;color:var(--acc);white-space:nowrap}
.box{border:1px solid var(--line);background:#fff;padding:3mm;margin-bottom:3mm;page-break-inside:avoid}
.box.d{background:#14100c;color:#f2ece0;border:none}.box.w{background:#fdf4ec;border-color:#e8c3a3}
.box h4{margin:0 0 1.5mm;font-size:8pt;letter-spacing:.06em;color:var(--acc);text-transform:uppercase}
.box.d h4{color:#8fd0a8}.box.w h4{color:var(--acc2)}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 5mm}
.oui{color:var(--acc);font-weight:700}.non{color:var(--acc2);font-weight:700}
ul{margin:0 0 2mm;padding-left:4mm}li{margin-bottom:.7mm}
</style></head><body>''')

# --- couverture : 12 vraies cases
cov=[]
for cid in ["A-01","D-01","B-01","I-01","F-01","E-01","C-01","B-04","H-01","G-02","L-03","B-03"]:
    cov.append(SB[cid][3][0][2])
w('<div class="cv"><div class="k">LASCLAY · STORYBOARD · MODE EXPLORATION</div>'
  '<h1>24 vidéos,<br>case par case.<br><em>Le mot ne se<br>dit jamais.</em></h1>'
  '<div class="sub">97 cases dessinées : cadre, composition, mouvement de caméra, '
  'sous-titre incrusté tel qu\'il apparaîtra à l\'écran — et un prompt d\'image IA par case '
  'pour en tirer une planche photoréaliste.</div>'
  '<div class="cvg">' + "".join(f'<svg viewBox="0 0 300 533">{s}</svg>' for s in cov) + '</div>'
  '<div class="ru"><div><b>Format</b>1 page = 1 vidéo</div>'
  '<div><b>Cases</b>97 · 24 concepts</div>'
  '<div><b>Règle</b>Le mot s\'écrit,<br>il ne se dit pas</div>'
  '<div><b>Date</b>Septembre 2026</div></div></div>')

# --- mode d'emploi
w('<section class="c"><div class="hd"><h2>Comment lire une planche</h2>'
  '<div class="me">Une page = une vidéo. Les cases sont dans l\'ordre du montage.</div></div>')
w('<div class="gr" style="grid-template-columns:38mm 1fr;gap:5mm;align-items:start">')
ex = SB["A-01"][3][0]
w(f'<div class="pn"><svg viewBox="0 0 300 533">{ex[2]}</svg>'
  f'<div class="tc"><s>{ex[0]}</s> · {ex[1]}</div>'
  f'<div class="nt">{H.escape(ex[3])}</div>'
  f'<div class="pr"><b>PROMPT IA</b>{H.escape(ex[4])}</div></div>'
  f'<div><table>'
  '<tr><td class="n">Le dessin</td><td>Composition, échelle de plan, placement du sujet, sens du mouvement. C\'est une intention de cadre, pas une image finale.</td></tr>'
  '<tr><td class="n">La flèche orange</td><td>Mouvement de caméra ou d\'objet dans le plan.</td></tr>'
  '<tr><td class="n">La bande noire</td><td>Le sous-titre incrusté, écrit tel qu\'il apparaîtra à l\'écran.</td></tr>'
  '<tr><td class="n">Le gros texte</td><td>Un carton plein écran. Tenu 2 secondes minimum.</td></tr>'
  '<tr><td class="n">Sous la case</td><td>Le minutage, le code de plan, puis la note technique : réglage, distance, lumière, cadence.</td></tr>'
  '<tr><td class="n">Le bloc gris</td><td>Le prompt à donner à une IA d\'image pour générer une version photoréaliste de la case.</td></tr>'
  '</table></div>')
w('</div>')
w('<div class="g2">')
w('<div class="box d"><h4>La règle du mot</h4>'
  '<p style="margin:0 0 2mm"><b class="non">Jamais dit</b> — ni en voix off, ni en dialogue, ni en sous-titre incrusté '
  '(le sous-titre transcrit l\'audio). Aucune case de ce document ne le contient.</p>'
  '<p style="margin:0"><b style="color:#8fd0a8">Écrit, permis</b> — carton, description, hashtag, '
  'nom de produit, commentaire épinglé, bio, site. Le lecteur d\'une description a déjà regardé : '
  'le mot devient une récompense, pas un obstacle.</p></div>')
w('</div><div>')
w('<div class="box w"><h4>Ce que le storyboard ne remplace pas</h4>'
  '<p style="margin:0">Le repérage, la lumière et le hasard. Une case est une hypothèse de cadre. '
  'Sur place, si la vraie image est meilleure, c\'est la vraie image qui gagne — et on note '
  'l\'écart au journal pour que la prochaine planche soit plus juste.</p></div>')
w('</div></div>')
w('<h3>Les 24 planches</h3><div class="g2">')
half=(len(ORDER)+1)//2
for chunk in (ORDER[:half], ORDER[half:]):
    w('<div><table><tr><th>Code</th><th>Titre</th><th>Cases</th></tr>')
    for cid in chunk:
        t,meta,note,fr = SB[cid]
        w(f'<tr><td class="n">{cid}</td><td><b>{H.escape(t)}</b><br>'
          f'<span style="color:var(--mut)">{H.escape(meta)}</span></td><td>{len(fr)}</td></tr>')
    w('</table></div>')
w('</div></section>')

# --- planches
for cid in ORDER:
    t,meta,note,fr = SB[cid]
    n=len(fr); cols = "g5" if n>=5 else ("g4" if n==4 else "g3")
    w('<section><div class="hd">'
      f'<h2><span class="id">{cid}</span>{H.escape(t)}</h2>'
      f'<div class="me">{H.escape(meta)} · {n} cases</div>'
      f'<div class="no"><b>⚠</b> {H.escape(note)}</div></div>')
    w(f'<div class="gr {cols}">')
    for tc,pl,svg,nt,pr in fr:
        w(f'<div class="pn"><svg viewBox="0 0 300 533">{svg}</svg>'
          f'<div class="tc"><s>{H.escape(tc)}</s> · {H.escape(pl)}</div>'
          f'<div class="nt">{H.escape(nt)}</div>'
          f'<div class="pr"><b>PROMPT IA</b>{H.escape(pr)}</div></div>')
    w('</div></section>')

# --- annexe : les concepts non storyboardés
done={"A-01","A-02","A-03","A-04","D-01c","D-05c","F-07","C-01","C-05","K-01",
      "B-01","B-02","B-03","B-04","B-05","E-01","E-05","I-01","F-01","H-01c","H-05c","G-01","G-02","L-03"}
rest=[c for c in ALL if c[0] not in done]
w('<section><div class="hd"><h2>Annexe · les 64 autres concepts</h2>'
  f'<div class="me">Non storyboardés. Hook et CTA prêts, à planchifier au besoin.</div></div>')
FT={f:t for f,t,_,_ in FAM}
cur=None
w('<table><tr><th style="width:14mm">Code</th><th style="width:44mm">Titre</th><th>Hook</th><th style="width:44mm">CTA</th></tr>')
for cid,ti,bd,hook,sb,cta,nt in rest:
    f=cid[0]
    if f!=cur:
        cur=f
        w(f'<tr><td colspan="4" style="background:#14100c;color:#8fd0a8;font-weight:700;'
          f'font-size:7.4pt;letter-spacing:.08em">FAMILLE {f} · {FT[f].upper()}</td></tr>')
    w(f'<tr><td class="n">{cid.replace("c","")}</td><td><b>{H.escape(ti)}</b></td>'
      f'<td style="font-style:italic">« {H.escape(hook)} »</td>'
      f'<td style="color:var(--acc)">{H.escape(cta)}</td></tr>')
w('</table></section>')

w('</body></html>')
open("storyboard.html","w",encoding="utf-8").write("\n".join(o))
print("ok", sum(len(x) for x in o), "car ·", len(ORDER), "planches")
