# -*- coding: utf-8 -*-
import math, html as H
from glyphs import G
from data import PLANS, LOIS
from concepts import C, FAM

BADGE = {"15":('b-green','15 MIN'),"1h":('b-blue','1 H'),"1j":('b-org','1 JOUR'),
         "sais":('b-grey','SAISON'),"risq":('b-red','RISQUE')}

def sym():
    o=['<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>']
    for k,d in G.items():
        o.append(f'<symbol id="g{k.replace("-","")}" viewBox="0 0 60 100">'
                 f'<g fill="none" stroke="currentColor" stroke-width="2" '
                 f'stroke-linecap="round" stroke-linejoin="round">{d}</g></symbol>')
    o.append('</defs></svg>')
    return "".join(o)

def frame(code, tc, w=16):
    gid = "g"+code.replace("-","")
    return (f'<div class="fr" style="width:{w}mm">'
            f'<svg class="fx" viewBox="0 0 60 100"><use href="#{gid}"/></svg>'
            f'<div class="fc"><b>{code}</b><span>{H.escape(tc)}</span></div></div>')

def card(c):
    cid,ti,bd,hook,sb,cta,note = c
    b = "".join(f'<span class="badge {BADGE[x][0]}">{BADGE[x][1]}</span>' for x in bd)
    fr = "".join(frame(p,t) for p,t in sb)
    n = f'<div class="cn"><b>⚠</b> {H.escape(note)}</div>' if note else ''
    return (f'<div class="cd"><div class="ch"><span class="cid">{cid.replace("c","")}</span>'
            f'<span class="ct">{H.escape(ti)}</span>{b}</div>'
            f'<div class="ck">« {H.escape(hook)} »</div>'
            f'<div class="sb">{fr}</div>'
            f'<div class="cf"><div class="cc"><b>▸</b> {H.escape(cta)}</div>{n}</div></div>')

def loi(n,t,v,lab,txt):
    fv=float(v); w = 0 if fv<=0 else max(6, math.log10(fv+1)/math.log10(146)*100)
    big = lab.split()[0]
    cls = ' z' if w == 0 else ''
    return (f'<div class="lo"><div class="ln">{n}</div>'
            f'<div class="lb"><div class="lt">{t}</div>'
            f'<div class="lbar{cls}"><i style="width:{w:.0f}%"></i><em>{H.escape(lab)}</em></div>'
            f'<div class="lx">{txt}</div></div></div>')

out=[]
w=out.append

w('''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Plan de tournage — Lasclay</title><style>
@page{size:letter;margin:14mm 14mm 16mm}@page :first{margin:0}
:root{--ink:#14100c;--ink2:#3f382f;--mut:#6d6459;--line:#ddd5c8;--l2:#efe9dd;
--paper:#fffdf9;--acc:#1f5d3f;--acc2:#b4531f;--acc3:#2b4a7a;--wash:#f6f2e9}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:var(--paper);color:var(--ink);
font-family:"Liberation Sans",Helvetica,Arial,sans-serif;font-size:8.4pt;line-height:1.42}
p{margin:0 0 2mm}ul{margin:0 0 2mm;padding-left:4mm}li{margin-bottom:.8mm}
section{page-break-before:always}section.c{page-break-before:auto}
h2{font-size:17pt;line-height:1.05;margin:0 0 3mm;letter-spacing:-.02em;
padding-bottom:2mm;border-bottom:2.5px solid var(--ink)}
h2 .n{display:block;color:var(--acc);font-size:8.5pt;letter-spacing:.22em;margin-bottom:1.5mm}
h3{font-size:10.5pt;margin:5mm 0 2mm;letter-spacing:-.01em;page-break-after:avoid}
.lede{font-size:9.4pt;color:var(--ink2);margin:0 0 5mm;max-width:160mm}
.badge{display:inline-block;font-size:6pt;font-weight:700;letter-spacing:.08em;
padding:.7mm 1.4mm;border-radius:2px;margin-left:1.2mm;vertical-align:.3mm;white-space:nowrap}
.b-green{background:#dcefe3;color:#1f5d3f}.b-org{background:#fbe6d6;color:#93400f}
.b-blue{background:#dde6f3;color:#22406b}.b-grey{background:#e8e3d9;color:#5b5245}
.b-red{background:#f7dcd8;color:#8f2a1c}

/* couverture */
.cv{height:279mm;padding:24mm 20mm 18mm;background:#14100c;color:#f5f1e8;position:relative;page-break-after:always}
.cv .k{font-size:7.5pt;letter-spacing:.3em;color:#b9ad99}
.cv h1{font-size:42pt;line-height:1.02;margin:12mm 0 0;letter-spacing:-.03em;color:#fffdf9;font-weight:700}
.cv h1 em{font-style:normal;color:#8fd0a8}
.cv .sub{font-size:11pt;margin-top:7mm;max-width:118mm;color:#ddd3c1;line-height:1.45}
.cvg{display:grid;grid-template-columns:repeat(8,1fr);gap:3mm;margin-top:12mm}
.cvg .fr{width:auto}.cvg .fx{border-color:#4a4136;background:#1c1712;color:#8fd0a8}
.cvg .fc{display:none}
.cv .rule{position:absolute;left:20mm;right:20mm;bottom:18mm;border-top:1px solid #3a332a;
padding-top:4mm;display:flex;gap:8mm;font-size:7.5pt;color:#9c917f}
.cv .rule b{display:block;color:#e6dcc9;font-size:8.5pt;margin-bottom:.8mm}

/* storyboard frame */
.fr{display:inline-block;vertical-align:top;margin-right:2mm}
.fx{display:block;width:100%;aspect-ratio:60/100;border:1px solid var(--line);
background:#fff;color:var(--ink);padding:1.6mm;border-radius:1.5px}
.fc{margin-top:.9mm;line-height:1.2}
.fc b{display:block;font-size:6.2pt;color:var(--acc3);letter-spacing:.04em}
.fc span{display:block;font-size:5.8pt;color:var(--mut)}

/* carte concept */
.cd{border:1px solid var(--line);background:#fff;margin-bottom:2.8mm;page-break-inside:avoid}
.ch{background:#14100c;color:#fffdf9;padding:1.4mm 3mm;display:flex;align-items:center;gap:2.5mm}
.cid{font-weight:700;font-size:8.6pt;color:#8fd0a8;letter-spacing:.03em;flex:0 0 12mm}
.ct{font-weight:600;font-size:9.4pt;flex:1;letter-spacing:-.01em}
.ck{padding:1.5mm 3mm 1.2mm;font-size:8.6pt;font-style:italic;color:var(--acc2);
border-bottom:1px solid var(--l2)}
.sb{padding:2mm 3mm 1mm;white-space:nowrap}
.cf{padding:0 3mm 1.8mm;font-size:7.4pt}
.cc{color:var(--acc);font-weight:600}.cc b{color:var(--acc)}
.cn{color:var(--mut);margin-top:.8mm}.cn b{color:var(--acc2)}

/* lois */
.lo{display:flex;gap:3mm;padding:2.6mm 0;border-bottom:1px solid var(--l2);page-break-inside:avoid}
.ln{flex:0 0 8mm;font-size:15pt;font-weight:700;color:var(--l2);line-height:1;padding-top:.5mm}
.lb{flex:1}
.lt{font-weight:700;font-size:9.4pt;line-height:1.2;margin-bottom:1.4mm}
.lbar{position:relative;height:5mm;background:var(--wash);margin-bottom:1.4mm;display:flex;align-items:center}
.lbar i{position:absolute;left:0;top:0;bottom:0;background:var(--acc);display:block}
.lbar em{position:relative;font-style:normal;font-weight:700;font-size:7.4pt;
color:#fff;padding-left:2mm;text-shadow:0 0 2px rgba(0,0,0,.5)}
.lbar.z{background:#f7dcd8}.lbar.z em{color:#8f2a1c;text-shadow:none}
.lx{font-size:7.6pt;color:var(--ink2)}

/* divers */
.box{border:1px solid var(--line);background:#fff;padding:3mm 3.5mm;margin-bottom:3mm;page-break-inside:avoid}
.box.d{background:#14100c;color:#f2ece0;border:none}
.box.w{background:#fdf4ec;border-color:#e8c3a3}
.box.g{background:var(--wash)}
.box h4{margin:0 0 1.5mm;font-size:8.2pt;letter-spacing:.06em;color:var(--acc);text-transform:uppercase}
.box.d h4{color:#8fd0a8}.box.w h4{color:var(--acc2)}
table{width:100%;border-collapse:collapse;font-size:7.6pt;margin-bottom:3mm;page-break-inside:avoid}
th{font-size:6.6pt;text-transform:uppercase;letter-spacing:.08em;text-align:left;
padding:1.4mm 1.8mm;background:#14100c;color:#f2ece0;font-weight:600}
td{padding:1.4mm 1.8mm;border-bottom:1px solid var(--l2);vertical-align:top;line-height:1.35}
tr:nth-child(even) td{background:#faf7f0}
td.n{font-weight:700;color:var(--acc);white-space:nowrap}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 5mm}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 4mm;align-items:start}
.hb{page-break-inside:avoid;margin-bottom:2mm}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
.pl{border:1px solid var(--line);background:#fff;padding:2mm;page-break-inside:avoid;margin-bottom:3mm}
.pl .fx{width:14mm;float:left;margin-right:2.4mm}
.pl b{display:block;font-size:7.4pt;color:var(--acc3)}
.pl strong{display:block;font-size:8.4pt;margin-bottom:.8mm}
.pl span{display:block;font-size:7pt;color:var(--mut);line-height:1.35;overflow:hidden}
.kpi{display:flex;gap:3mm;margin-bottom:4mm}
.kpi div{flex:1;border:1px solid var(--line);background:#fff;padding:2.4mm;text-align:center}
.kpi b{display:block;font-size:16pt;color:var(--acc);line-height:1;margin-bottom:1mm}
.kpi span{font-size:6.4pt;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);line-height:1.25;display:block}
.chk{list-style:none;padding-left:0;margin:0 0 2mm}
.chk li{padding-left:5mm;position:relative;margin-bottom:1.1mm}
.chk li:before{content:"";position:absolute;left:0;top:.7mm;width:2.8mm;height:2.8mm;
border:1.1px solid var(--ink2);border-radius:1px}
.hk{font-size:7.5pt;line-height:1.32;margin:0 0 2.4mm;padding-left:0;list-style:none}
.hk li{padding-left:3mm;position:relative;margin-bottom:.55mm}
.hk li:before{content:"»";position:absolute;left:0;color:var(--acc2);font-weight:700}
h5{font-size:7.4pt;letter-spacing:.08em;text-transform:uppercase;color:var(--acc);margin:3mm 0 1.4mm}
.tl{margin-bottom:3mm}
.tl .r{display:flex;gap:2mm;align-items:center;margin-bottom:1.4mm;page-break-inside:avoid}
.tl .h{flex:0 0 24mm;font-size:7.4pt;font-weight:700}
.tl .b{flex:1;height:6mm;background:var(--wash);position:relative;display:flex}
.tl .b s{display:block;height:100%;text-decoration:none;font-size:6.2pt;color:#fff;
padding:1.2mm 1.4mm 0;white-space:nowrap;overflow:hidden}
.oui{color:var(--acc);font-weight:700}.non{color:var(--acc2);font-weight:700}
</style></head><body>''')

w(sym())

# ---------- COUVERTURE ----------
cover_g = ["M-01","T-07","D-02","V-01","A-06","M-09","D-03","M-07",
           "T-02","A-01","M-03","H-04","V-03","D-06","M-12","A-04"]
w('<div class="cv"><div class="k">LASCLAY · VIDÉO COURTE · MODE EXPLORATION</div>'
  '<h1>88 idées.<br>46 plans.<br><em>Une plante<br>qu\'on ne dit<br>jamais.</em></h1>'
  '<div class="sub">Bible de tournage visuelle. 14 lois tirées d\'un corpus de 135 vidéos, '
  '12 familles, 88 storyboards, 6 journées prêtes à tourner.</div>'
  '<div class="cvg">' + "".join(frame(c,"") for c in cover_g) + '</div>'
  '<div class="rule">'
  '<div><b>Règle</b>Le mot ne se dit jamais.<br>Il peut s\'écrire.</div>'
  '<div><b>Référence</b>Corpus @uniqueplastique_<br>135 vidéos · 31 A/B</div>'
  '<div><b>Statut</b>V2 · visuel<br>à confronter au terrain</div>'
  '<div><b>Date</b>Septembre 2026</div></div></div>')

# ---------- 1 · CARTE + RÈGLE ----------
w('<section class="c"><h2><span class="n">01</span>La carte, et la règle</h2>')
w('<div class="g2"><div>')
w('<h3 style="margin-top:0">Où est quoi</h3><table>')
for n,t,d in [("02","Les 14 lois","Chaque loi, sa preuve chiffrée"),
 ("03","La grammaire","Durées, coupes, sous-titres, son"),
 ("04","46 plans nommés","À appeler à voix haute sur le plateau"),
 ("05","88 concepts","Storyboardés, 12 familles"),
 ("06","172 hooks","Classés par mécanique"),
 ("07","Les CTA","Le facteur ×27"),
 ("08","6 journées","Minutées, avec matériel"),
 ("09","Mesure et garde-fous","Comment juger, quoi ne jamais dire"),
 ("10","Fiches","À imprimer et remplir")]:
    w(f'<tr><td class="n">{n}</td><td><b>{t}</b><br><span style="color:var(--mut)">{d}</span></td></tr>')
w('</table></div><div>')
w('<h3 style="margin-top:0">La règle du mot</h3>')
w('''<div class="box d"><h4>Le mot est boring. Donc on ne le dit pas.</h4>
<p style="margin:0">La reconnaissance est déjà dans la mémoire du spectateur : presque tout adulte
au Québec a déjà pété une gousse dans un fossé. Ce qui manque, c'est le nom.
<b>Ce vide est le moteur.</b> Il produit tout seul les trois seuls comportements rentables du fil :
celui qui sait le donne, celui qui ignore demande, celui qui se souvient raconte.</p></div>''')
w('''<table>
<tr><th style="width:30mm">Couche</th><th>Le mot</th></tr>
<tr><td class="n" style="color:#b4531f">Audio<br>voix off, dialogue</td>
<td><b class="non">JAMAIS DIT ✗</b><br>C'est là que vit le mystère. Le mot est boring : le vide est meilleur que lui.</td></tr>
<tr><td class="n" style="color:#b4531f">Sous-titre incrusté</td>
<td><b class="non">JAMAIS ÉCRIT ✗</b><br>Il transcrit l'audio. Si la bouche ne le dit pas, le sous-titre ne le contient pas.</td></tr>
<tr><td class="n" style="color:#1f5d3f">Carton, titre, texte graphique<br>Description · hashtags<br>Nom de produit à l'écran<br>Commentaire épinglé · réponses<br>Bio, site, infolettre</td>
<td><b class="oui">ÉCRIT ✓</b><br>Permis partout. Le lecteur d'un carton ou d'une description a déjà regardé :
le mot devient une récompense, pas un obstacle. Et il porte tout le référencement hors plateforme.</td></tr>
</table>''')
w('''<div class="box g"><h4>Le commentaire épinglé : la deuxième moitié de chaque vidéo</h4>
<p style="margin:0">« Vous êtes déjà 200 à écrire le nom en commentaire. Vous avez raison.
C'est ___. Elle pousse partout au Québec, c'est la seule plante que les chenilles de monarque
peuvent manger, et sa soie isole mieux que le duvet à poids égal. On en fait des manteaux depuis 2020. »
— épinglé, jamais noyé.</p></div>''')
w('</div></div>')

w('<h3>Ce qu\'on dit à la place, à l\'oral</h3><div class="g3">')
cols = [("Le souvenir",["Tu te souviens de ces cocottes-là ?","La plante qu'on faisait péter au chalet",
 "Ce que tout le monde soufflait, petit","La ouate qui sortait des poches","T'en as arraché quand t'étais jeune",
 "Y'avait ça au bout du terrain de ta grand-mère"]),
("La mauvaise herbe",["Une mauvaise herbe","La plante que le monde arrache","Ça pousse tout seul, personne la veut",
 "Une nuisance, officiellement","Du gazon de fossé","Ça pousse dans le trouble"]),
("Le mystère",["Cette plante-là","Ça","La plante dont personne connaît le nom",
 "Tu l'as vue mille fois. Tu sais pas c'est quoi.","9 personnes sur 10 peuvent pas la nommer","Devine."]),
("La matière",["La soie","La fibre du fossé","De la ouate végétale","Ce qui sort de la gousse",
 "Le duvet qui vient pas d'un oiseau"]),
("Le monarque",["La seule plante que les chenilles peuvent manger","La plante des monarques",
 "Sans elle, y'a pas de monarque","La cafétéria des monarques"]),
("Le commercial",["Notre isolant","Ce qu'il y a dans le manteau","Ce qui te tient au chaud",
 "L'affaire qui coûte cher à faire pousser"])]
for t,l in cols:
    w(f'<div><h5 style="margin-top:0">{t}</h5><ul class="hk">' + "".join(f'<li>{H.escape(x)}</li>' for x in l) + '</ul></div>')
w('</div>')
w('</section>')

# ---------- 2 · LOIS ----------
w('<section><h2><span class="n">02</span>Les 14 lois</h2>')
w('<p class="lede">Chacune vient d\'une comparaison réelle où une seule variable changeait. '
  'Échelle logarithmique : les barres se comparent entre elles, pas en valeur absolue.</p>')
for n,t,v,lab,txt in LOIS:
    w(loi(n,t,v,lab,txt))
w('''<div class="box d" style="margin-top:4mm"><h4>L'essai jamais fait, et il est gratuit</h4>
<p style="margin:0">Le corpus isole deux effets qui n'ont jamais été combinés : le cold-open d'archives
(+74 % d'enregistrements, −18 % de portée) et la description-question (+52 % de commentaires,
+51 % de partages, pour deux lignes de légende). <b>On teste la combinaison dès la journée 1.</b></p></div>''')
w('</section>')

# ---------- 3 · GRAMMAIRE ----------
w('<section><h2><span class="n">03</span>La grammaire</h2>')
w('<p class="lede">Ce qui ne se rediscute pas à chaque montage.</p>')
w('<h3 style="margin-top:0">Le montage type, seconde par seconde</h3>')
segs=[("L'objet",8,"#14100c","0–1 s · nommé et montré. Aucune intro, aucun logo."),
("La promesse",14,"#1f5d3f","1–3 s · ce qui va se passer, avec une limite ou une question."),
("Le désamorçage",18,"#2b4a7a","3–8 s · l'origine de la matière. Loi 2."),
("L'action",34,"#b4531f","8–18 s · un plan par seconde. Un gag toutes les 5 s."),
("Le résultat",14,"#6d6459","18–24 s · ce qui cède. Seul arrêt sur image autorisé."),
("Le CTA",9,"#1f5d3f","24–27 s · dans l'image, au « tu », en un mot."),
("Logo",3,"#14100c","0,5 s.")]
w('<div style="display:flex;height:11mm;margin-bottom:2mm">')
for t,pc,col,_ in segs:
    w(f'<div style="width:{pc}%;background:{col};color:#fff;font-size:6.4pt;font-weight:700;'
      f'padding:1.6mm 1.2mm;overflow:hidden;white-space:nowrap">{t}</div>')
w('</div><table>')
for t,_,col,d in segs:
    w(f'<tr><td class="n" style="color:{col}">{t}</td><td>{d}</td></tr>')
w('</table>')
w('<div class="g2"><div>')
w('<h3>Durées</h3><table>')
for a,b,c in [("Démonstration / test","18–30 s","Le cœur du compte"),
("Procédé complet","22–35 s","Une étape = un plan = 1 s"),
("Reconnaissance","12–20 s","Le contenu est un vide"),
("Vivant / macro","25–45 s","Seul cas où la lenteur est permise"),
("Face caméra","50–120 s","Rare. 1 pour 6."),("ASMR","20–28 s","+ carton 2 s obligatoire")]:
    w(f'<tr><td class="n">{a}</td><td><b>{b}</b><br><span style="color:var(--mut)">{c}</span></td></tr>')
w('</table>')
w('<h3>Cadence</h3><ul>'
'<li><b>≈ 1 plan / seconde</b> sur toute la partie action</li>'
'<li><b>3 s max</b> par lieu ou sujet</li>'
'<li><b>0,5 s</b> pour les micro-transitions (un geste précis)</li>'
'<li><b>Aucun plan figé</b> : mouvement dans le cadre, ou de caméra, ou le plan saute</li>'
'<li><b>Exception</b> : arrêt sur image 1–2 s quand quelque chose cède</li></ul>')
w('</div><div>')
w('<h3>Texte à l\'écran</h3><table><tr><th>Toujours</th><th>Jamais</th></tr>'
'<tr><td>Sous-titre incrusté mot à mot, 100 % de la durée</td><td>Le nom de la plante en sous-titre</td></tr>'
'<tr><td>Écrit à la main, jamais un ASR non relu</td><td>Un carton qui remplace une image</td></tr>'
'<tr><td>Chiffres en gros, isolés, tenus 2 s</td><td>Une police décorative</td></tr>'
'<tr><td>Noms propres écrits en clair</td><td>Plus de deux lignes à la fois</td></tr>'
'<tr><td>Carton de question tenu 2 s, plein écran</td><td>Un logo en première seconde</td></tr></table>')
w('<h3>Son</h3><ul>'
'<li>Voix ou son direct <b>dès la première seconde</b>. Pas de montée musicale.</li>'
'<li>Son direct privilégié sur la matière : gousse, froissement, souffle, machine, vent.</li>'
'<li>Musique organique, 100–120 bpm, sous la voix. Jamais un son tendance.</li>'
'<li>SFX discrets sur les gestes marqués. Un seul pic sonore : quand ça cède.</li></ul>')
w('<div class="box w"><h4>Ce qui tue une vidéo Lasclay</h4>'
'<p style="margin:0">Le ton hystérique plaqué · la fausse urgence · le plan d\'ambiance en ouverture · '
'le carton qui remplace une image · le discours écolo avant que la matière ait bougé · '
'une vidéo qui pourrait être signée par n\'importe quelle autre marque écoresponsable.</p></div>')
w('</div></div></section>')

# ---------- 4 · PLANS ----------
w('<section><h2><span class="n">04</span>46 plans nommés</h2>')
w('<p class="lede">Le langage du plateau. « On refait un M-04, plus serré. » '
  'Tout est exécutable au téléphone.</p>')
for fam,titre,items in PLANS:
    w(f'<h3>{fam} · {titre}</h3><div class="g2">')
    for code,nom,ex in items:
        gid="g"+code.replace("-","")
        w(f'<div class="pl"><svg class="fx" viewBox="0 0 60 100"><use href="#{gid}"/></svg>'
          f'<b>{code}</b><strong>{H.escape(nom)}</strong><span>{H.escape(ex)}</span></div>')
    w('</div>')
w('<div class="box g"><h4>Les 8 plans à ramener de chaque sortie, quoi qu\'il arrive</h4>'
  '<div style="white-space:nowrap;margin-top:1mm">'
  + "".join(frame(c,l,16) for c,l in [("M-01","gousse"),("M-03","soie"),("T-01","fossé"),
    ("T-04","marche"),("H-03","mains"),("A-02","chute"),("D-03","contact"),("H-02","regard")])
  + '</div><p style="margin:2mm 0 0">Une banque de 30 versions de chacun vaut plus qu\'un tournage parfait.</p></div>')
w('</section>')

# ---------- 5 · CONCEPTS ----------
w('<section><h2><span class="n">05</span>88 concepts, storyboardés</h2>')
w('<p class="lede">Une carte = une vidéo tournable. Le hook est écrit mot pour mot, '
  'le storyboard donne l\'ordre et le minutage, le CTA est la phrase finale.</p>')
w('<table><tr><th>Fam.</th><th>Titre</th><th>N</th><th>Ce que ça cherche</th><th>On juge sur</th></tr>')
for f,t,intent,mesure in FAM:
    n = sum(1 for c in C if c[0][0]==f)
    w(f'<tr><td class="n">{f}</td><td><b>{t}</b></td><td>{n}</td><td>{intent}</td>'
      f'<td style="color:var(--mut)">{mesure}</td></tr>')
w('</table>')
w('<h3>Comment lire une carte</h3>')
w('<div class="g2"><div>')
w(card(("A-01","Tout le monde a déjà fait ça",["15","sais"],
 "T'as déjà fait ça quand t'étais petit. Tu sais pas c'est quoi.",
 [("M-01","0-2,5 s"),("M-02","2,5-5 s"),("M-03","5-9 s"),("H-03","9-11 s")],
 "Écris son nom en commentaire.","Aucune phrase d'explication au montage.")))
w('</div><div><table>')
for a,b in [("Le code","Sert de langage commun : plateau, journal, nom de fichier de rushes."),
("Les badges","Coût de tournage · fenêtre saisonnière · relire les garde-fous avant publication."),
("Le hook","Les 2 à 5 premières secondes, écrites mot pour mot. Se choisit AVANT le tournage."),
("Le storyboard","Les plans dans l'ordre du montage, avec leur code (section 04) et leur minutage."),
("▸ Le CTA","La phrase finale, prononcée ET incrustée. Au « tu », répondable en un mot."),
("⚠ La note","L'objection prévisible, le garde-fou, ou l'arc à refermer.")]:
    w(f'<tr><td class="n" style="width:24mm">{a}</td><td>{b}</td></tr>')
w('</table>')
w('<div class="box g"><h4>Le mot, rappel</h4><p style="margin:0">Aucun hook de ce dossier '
  'ne prononce le nom de la plante. Il peut apparaître à l\'écrit — carton, description, '
  'hashtag, commentaire épinglé — jamais dans la bouche de quelqu\'un ni dans le sous-titre.</p></div>')
w('</div></div></section>')

for f,t,intent,mesure in FAM:
    w(f'<section><h2><span class="n">FAMILLE {f}</span>{t}</h2>')
    w(f'<p class="lede">{intent} <b style="color:var(--acc)">On juge sur : {mesure.lower()}.</b></p>')
    for c in C:
        if c[0][0]==f: w(card(c))
    w('</section>')

# ---------- 6 · HOOKS ----------
HOOKS=[("La reconnaissance",["T'as déjà fait ça quand t'étais petit.","Tout le monde a déjà pété une de ces affaires-là.",
 "Tu te souviens de ces cocottes-là ?","On soufflait dessus au chalet.","Y'en avait au bout du terrain de ta grand-mère.",
 "Ça pousse à 30 secondes de chez toi.","T'es passé devant à matin sans la voir.","Ta mère t'a déjà dit d'arrêter de jouer avec ça.",
 "Y'en a une dans une craque de trottoir sur ta rue.","Tu l'as vue mille fois. Jamais regardée une seule.",
 "Ton beau-père tond ça chaque été.","C'est le décor de tous les voyages en char de ton enfance.",
 "Y'en a dans tous les villages du Québec.","Attends. Tu sais c'est quoi, hein ? Non ?"]),
("Le vide de nom",["Personne connaît son nom.","J'ai demandé à 20 personnes. Deux ont réussi.",
 "Je vais pas te le dire.","Nomme-la. Je te gage que tu peux pas.","Ça fait six mois que je refuse de le dire.",
 "Vous lui avez donné 30 noms. Un seul est le bon.","Coton sauvage. Ouate de fossé. Vous êtes créatifs.",
 "Si tu sais son nom, écris-le. Prouve-le.","Mon père l'appelait autrement. Ma grand-mère aussi.",
 "Ceux qui savent, dites rien.","Le nom est dans les commentaires. Pas dans ma bouche.","Devine. Trois indices."]),
("Le chiffre",["Plus de 200 graines dans une seule gousse.","10 grammes. C'est tout ce qu'il y a dans une mitaine.",
 "4 000 kilomètres. Il pèse moins qu'un trombone.","Un kilo, ça donne combien de mitaines ?","14 morceaux. Pour une mitaine.",
 "40 mètres de chaleur dans un rouleau.","20 kilos. Devine la grosseur du sac.","Jour 14 de la récolte. On est à ______ kilos.",
 "On a deux semaines par année. Deux.","Sur 200, on en refuse combien ?","164 minutes de travail pour une paire, au début.",
 "On a jeté 200 de ceux-là.","−24. Huit heures sur la glace.","12 minutes debout sans bouger. C'est ça qui gèle les mains.",
 "Trois hivers. Zéro réparation.","Vous avez acheté ça 340 fois cette semaine."]),
("La limite",["Jusqu'à combien de degrés ça tient ? Aucune idée. On essaie.","On va voir combien de temps je tiens.",
 "Je vais briser un morceau à 300 $ pour te montrer.","Ça va lâcher. La question c'est quand.",
 "Trois glaçons. Trois isolants. Lequel fond en premier ?","On écrase ça 1 000 fois. On va voir s'il revient.",
 "Je dors dehors à −22 avec juste ça.","Je pousse ça au fond d'un verre d'eau.",
 "Vous m'avez demandé 47 fois de faire ce test-là.","Ce test-là, je sais pas comment il va finir.",
 "Si ça marche pas, je le montre pareil.","Le vrai test, c'est pas le Everest. C'est l'arrêt d'autobus.",
 "32 degrés dehors. On met un thermomètre dedans.","Une flamme. Deux fibres. Deux comportements."]),
("Le paradoxe",["Ça, ça vaut rien. Ça, ça vaut 300 $. C'est la même affaire.","Une mauvaise herbe qui coûte cher.",
 "Il arrachait ça. Aujourd'hui il en sème.","Le même isolant garde ta bière froide l'été.",
 "C'est toxique. La chenille s'en fout. Et c'est ça qui la sauve.","Elle mange le poison pour devenir immangeable.",
 "Si tu sèmes ça au printemps, y'a rien qui pousse.","C'est pas une fibre. C'est un tuyau.",
 "Le duvet qui vient pas d'un oiseau.","Un agriculteur payait pour s'en débarrasser. Je le paye pour en avoir.",
 "Cette fibre-là déteste l'eau. Physiquement.","Personne l'a plantée. Elle est là pareil.",
 "La matière la plus légère que t'as jamais vue. Et la plus chaude."]),
("L'aveu",["Ça, c'est un prototype qui a jamais marché.","Ma pire idée depuis 2020.","Y'avait huit personnes ici.",
 "J'ai passé trois ans à monter une usine que j'ai démontée.","Trois décisions que je referais pas.",
 "Cette partie-là est faite ici. Cette partie-là, non.","On me le demande chaque semaine. Voici la vraie réponse.",
 "La prévente, c'était une bonne idée. Pendant deux ans.","Cette filière-là s'est plantée une première fois.",
 "Ils me les ont retournés. Regarde l'état.","Je voulais quelqu'un qui allait me dire que c'est de la marde.",
 "Y'a pas de machine pour faire ça. On a dû l'inventer."]),
("L'impératif",["Regarde la bulle.","Regarde la feuille dans 20 secondes.","Compte les espèces.","Va voir sous tes feuilles.",
 "Touche ça. Devine c'est quoi.","Cherche-la. Elle est dans l'image.","Écoute ça.","Attends la fin.","Mets le son.",
 "Regarde ce qu'il y a en dedans.","Suis-moi, je vais te montrer d'où ça vient.","Prends une gousse. Ouvre-la."]),
("Le pari",["Devine le poids.","Devine combien il y en a.","Devine c'est quoi avant la fin.","Devine le gagnant. 1, 2 ou 3.",
 "Ton estimation avant que je montre le chiffre ?","Sec ou mouillé ? Dis-le avant que j'ouvre.","Laquelle est la bonne ?",
 "Une de ces quatre-là est creuse. Laquelle ?","Lequel vient d'un oiseau ?","Tu penses que j'ai tenu jusqu'à quelle heure ?",
 "Y'a une étape qui manque. Laquelle ?","Trois indices. T'as 15 secondes."]),
("L'absurde",["J'ai apporté une chaise de bureau dans un fossé.","Réunion d'équipe. [seul, dans un champ]",
 "Bonjour, service à la clientèle. [en tuque, dans un champ]","J'ai mis 400 $ dans une caméra thermique pour régler un débat.",
 "J'ai envoyé cette matière à cinq personnes sans leur dire c'est quoi.","Personne m'a demandé de faire ça.",
 "La chose la moins utile que j'ai faite cette semaine.","Je me suis arrêté sur le bord de la 20.",
 "Quelqu'un a commandé 40 sachets de graines pour un mariage.","C'est le plan le plus stupide du tournage. On le fait pareil."]),
("Le vivant",["Cette chenille-là mange une seule plante au monde.","Si cette plante disparaît, cette chenille disparaît.",
 "J'ai laissé une caméra pendant huit jours.","Dans 15 secondes, tu vas voir quelque chose que t'as jamais vu en vrai.",
 "Y'a des points dorés dessus. Pour vrai.","Cet insecte-là part de ton jardin et se rend au Mexique.",
 "Un point blanc gros comme une tête d'épingle. C'est un monarque.","J'ai filmé une seule fleur pendant une heure.",
 "Tout le monde parle du monarque. Y'a 30 autres bibittes là-dessus.","En novembre, y'a plus rien. C'est là qu'on récolte.",
 "Les papillons sont partis depuis six semaines."]),
("La réponse au public",["Vous m'avez demandé ça 27 fois.","@______ m'a écrit ça il y a trois semaines. On le fait aujourd'hui.",
 "Vous vous êtes obstinés dans les commentaires. Je vais trancher.","Ce commentaire-là mérite une vidéo au complet.",
 "Oui, ça se lave. Voici exactement comment.","On me le demande depuis deux ans. Je l'ai jamais montré.",
 "Vous avez été 300 à demander cette étape-là.","Vous décidez. Pour vrai. Je le fabrique.",
 "Le commentaire avec le plus de likes SERA la prochaine couleur.","Vous m'avez donné 400 villes. Aujourd'hui : la vôtre.",
 "Quelqu'un m'a dit que c'était impossible. On essaie."]),
("Le commerce",["Meilleur vendeur de la semaine : ______.","Vous avez acheté ça 340 fois. Je comprends pas pourquoi.",
 "Ça coûte ______ $. Voici pourquoi.","Un manteau qui se démonte. Trois saisons, un morceau.",
 "On les vend moins cher. Regarde le défaut.","Cette semaine : ______ contre ______. Même test.",
 "Celle-là s'en va au Nouveau-Mexique.","Quand l'isolant est fini, tu remplaces l'isolant. Pas le manteau.",
 "Y'a un prix en dessous duquel on peut pas descendre. Voici pourquoi.","Ce morceau-là est en rupture. On en refait."])]
nh = sum(len(x[1]) for x in HOOKS)
w(f'<section><h2><span class="n">06</span>{nh} hooks</h2>')
w('<p class="lede">On ne réutilise jamais la même mécanique deux vidéos de suite. '
  'Le hook se choisit avant le tournage et se note au journal.</p><div class="g3">')
for t,l in HOOKS:
    w(f'<div class="hb"><h5 style="margin-top:0">{t}</h5><ul class="hk">' + "".join(f'<li>{H.escape(x)}</li>' for x in l) + '</ul></div>')
w('</div>')
w('<div class="box w"><h4>Les hooks à ne jamais utiliser</h4><p style="margin:0">'
  '« Savais-tu que… » (promesse abstraite, mesurée perdante) · « Bonjour tout le monde » · '
  '« Aujourd\'hui je vais vous montrer » · toute phrase qui commence par le nom de la marque · '
  'le conditionnel (« si X nous laissait… ») · un discours écolo avant qu\'une matière ait bougé · '
  '« ce n\'est pas X, c\'est Y » et ses variantes.</p></div></section>')

# ---------- 7 · CTA ----------
w('<section><h2><span class="n">07</span>Les CTA</h2>')
w('<p class="lede">La section la plus rentable du dossier. Deux secondes de montage, '
  'un facteur 27 sur le volume de commentaires à portée égale.</p>')
w('<div class="kpi">')
for b,s in [("5","conditions cumulatives"),("×27","commentaires, à portée égale"),
            ("4","types, 4 usages différents"),("+52 %","juste avec une description-question")]:
    w(f'<div><b>{b}</b><span>{s}</span></div>')
w('</div>')
w('<h3 style="margin-top:0">Les cinq conditions</h3><table>')
for n,c,p in [("1","DANS la vidéo","Prononcée ET écrite. Un CTA en description = une vidéo sans CTA (0,033 % contre 0,031 %)."),
("2","À la toute fin","Sauf le CTA-tag, à la 4e seconde. Gratification après sollicitation = plus aucune raison de commenter."),
("3","Au « tu »","Le « vous » collectif ne s'adresse à personne."),
("4","Répondable en un mot","Une couleur, une ville, un chiffre, un oui, un nom."),
("5","Sans coût social","Répondre ne doit obliger personne à se déjuger.")]:
    w(f'<tr><td class="n">{n}</td><td><b>{c}</b></td><td>{p}</td></tr>')
w('</table>')
w('<h3>Les quatre types</h3><table><tr><th>Type</th><th>Forme</th><th>Ce que ça produit</th></tr>')
for a,b,c in [("Le vote-contrat","« … SERA ______ »","Une décision utilisable. 63 % de propositions, 99 % des j'aime. Mais le moins commenté en volume."),
("Le CTA-tag","« Tague quelqu'un qui ______ » — 4e seconde","Du volume et de la portée. ×21,8. Sature le fil de commentaires à zéro j'aime."),
("La devinette","« Devine ______ » — AVANT la révélation","De la rétention : le spectateur reste pour vérifier sa réponse."),
("La question ouverte","« C'est quoi ton ______ ? »","De la conversation qualitative et des pistes d'affaires.")]:
    w(f'<tr><td class="n">{a}</td><td>{b}</td><td>{c}</td></tr>')
w('</table>')
w('<div class="g2"><div><h5>Récolte de commentaires</h5><ul class="hk">'
  + "".join(f'<li>{H.escape(x)}</li>' for x in ["Écris son nom en commentaire.","C'est quoi ton préféré ?",
   "Devine le poids.","1, 2 ou 3 ?","Oui ou non ?","Ton chiffre.","Écris ta ville.","T'es d'où, toi ?",
   "Ça te rappelle quoi ?","T'en as-tu déjà vu une, en vrai ?","Tu savais ça ?","C'était combien chez toi à matin ?",
   "Depuis combien de temps t'as le tien ?","T'aurais fait quoi à ma place ?"]) + '</ul></div>')
w('<div><h5>Récolte de pistes et de décisions</h5><ul class="hk">'
  + "".join(f'<li>{H.escape(x)}</li>' for x in ["Tague quelqu'un qui a ça dans sa cour.",
   "Tague la personne avec qui tu faisais péter ça.","Tague ton beau-père qui tond ça chaque été.",
   "T'en as-tu, toi, dans ton champ ?","Écris ta région.","Tu connais un producteur ? Tague-le.",
   "Celle avec le plus de likes, je la fais.","C'est quoi le prochain test ?",
   "Quelle autre matière je passe au microscope ?","Quel autre morceau je coupe en deux ?",
   "Quelle étape tu veux voir en gros plan ?","Tu réglerais ça comment ?","Envoie-moi une photo du tien.",
   "Pose ta question, je réponds dans le champ."]) + '</ul></div></div>')
w('</section>')

# ---------- 8 · JOURNÉES ----------
JOURS=[
("1","Le champ et le fossé","Sept. à mi-oct. · fenêtre de 2 semaines","URGENT",
 "Champ cultivé · accotement de route · craque de trottoir en ville",
 ["A-01","A-02","A-04","D-01c","D-05c","D-06c","D-07c","F-07","J-07","E-05"],
 [("7 h 30",8,"Repérage et lumière"),("8 h 00",22,"Bloc champ · T-07 T-02 T-03 T-04 T-05"),
  ("10 h 00",18,"Bloc gousse sur pied · M-01 ×15, trois maturités"),
  ("11 h 30",12,"Bloc agriculteur · H-06"),("13 h 30",18,"Bloc fossé · T-01 H-04, 4 endroits"),
  ("15 h 30",10,"Bloc ville · J-07"),("16 h 30",12,"Contre-jour du soir · T-07 M-03")],
 "8 à 12 vidéos + la banque matière : 30 M-01, 20 M-03, 15 T-04",
 ["M-01","T-07","T-02","T-04","T-05","M-03"]),
("2","La table noire","N'importe quand, en intérieur","",
 "Une pièce qu'on peut faire noire. Table, fond noir mat, une source orientable.",
 ["A-08","B-03","B-04","B-05","E-01","E-02","E-03","E-04","E-05"],
 [("Bloc 1",18,"Le noir · M-01 M-02 M-03 en conditions contrôlées"),
  ("Bloc 2",16,"L'eau · M-08 ×10, M-09 ×6"),("Bloc 3",18,"Le microscope · M-07 sur 4 fibres"),
  ("Bloc 4",16,"Les chiffres · M-12 M-06 V-05"),("Bloc 5",16,"Le time-lapse · D-06, 40 min"),
  ("Bloc 6",16,"Le son · M-11 ×8, casque obligatoire")],
 "10 à 14 vidéos. La journée la plus rentable par heure de tournage.",
 ["M-01","M-02","M-09","M-07","M-12","M-11"]),
("3","L'atelier","Une journée de production normale","",
 "Ne pas arrêter la production pour filmer.",
 ["C-01","C-02","C-03","C-04","C-05","C-07","I-01","I-02","K-01","K-02","K-04","K-06"],
 [("Bloc 1",22,"La chaîne · une étape à la fois, dans l'ordre → C-01"),
  ("Bloc 2",20,"Les machines · A-01 ×6, A-02 A-03 A-05"),
  ("Bloc 3",20,"La dissection · I-01 I-02, produits sacrifiés prévus"),
  ("Bloc 4",16,"Les gestes · A-06 ×4 angles, C-07"),("Bloc 5",10,"Time-lapse A-07"),
  ("En continu",12,"A-08 · la panne. Caméra à portée de main.")],
 "La vidéo-pilier C-01 + 8 à 10 vidéos courtes",
 ["A-02","A-01","A-03","A-05","A-06","A-04"]),
("4","Le froid","Janv.-févr., un jour à −20","SAISON",
 "Congélateur coffre (toute l'année) · extérieur · lac gelé",
 ["B-01","B-02","B-07","B-08","H-01c","H-03c","H-07c","G-04"],
 [("Bloc 1",26,"Congélateur · B-01, deux caméras, limite 4 min"),
  ("Bloc 2",24,"Thermique · B-02, distance fixe, 6 objets"),
  ("Bloc 3",22,"Dehors · H-07c H-03c B-07"),("Bloc 4",28,"Terrain · H-01c, vraie journée, vrai pêcheur")],
 "6 à 9 vidéos, dont deux formats de preuve à fort partage",
 ["D-01","D-04","D-02","H-04","D-03","M-11"]),
("5","Le vivant et le jardin","Juil.-août (vivant) · oct.-nov. (semis)","SAISON",
 "Deux demi-journées séparées. Poste de time-lapse installé J−7.",
 ["F-01","F-04","F-05","F-06","E-06","J-01","J-02","J-03","J-04","J-06"],
 [("J−7",10,"Installer le time-lapse F-02 · trépied lesté, alim continue"),
  ("Bloc 1",24,"Macro vivant · V-01 F-05 F-06, lumière douce uniquement"),
  ("Bloc 2",22,"La fleur · V-04 en plan fixe 60 min"),
  ("Bloc 3",22,"Jardin · J-01 J-03 J-06, pots témoins notés au journal"),
  ("Bloc 4",22,"Chez quelqu'un · J-04, autorisation écrite")],
 "7 à 10 vidéos + les plans longs qui tournent en autonomie",
 ["V-01","V-02","V-04","V-05","M-05","T-08"]),
("6","La parole et l'absurde","À faire en dernier","",
 "Quand on connaît déjà les questions du public.",
 ["A-03","C-06","G-05","H-08c","I-03","K-05","L-01","L-03","L-04","L-08"],
 [("Bloc 1",26,"Face caméra · H-01, 4 sujets, démarrage à froid, 1 prise"),
  ("Bloc 2",24,"Les réponses · G-05, 8 commentaires préparés, 3 objections dures"),
  ("Bloc 3",26,"Micro-trottoir · A-03, 14 réactions pour 6 gardées"),
  ("Bloc 4",24,"L'absurde · L-03 L-04, cadrage sérieux, ton sérieux")],
 "6 à 8 vidéos, dont les deux montages A/B de L-05",
 ["H-01","H-05","H-02","T-01","M-06","H-03"]),
]
w('<section><h2><span class="n">08</span>Les 6 journées</h2>')
w('<p class="lede">Ordonnées par urgence saisonnière. Chacune produit 6 à 14 vidéos montables. '
  'L\'objectif n\'est pas une bonne vidéo : c\'est <b>des séries comparables</b>.</p>')
w('<div class="box w"><h4>La journée 1 a une fenêtre de deux semaines</h4>'
  '<p style="margin:0">Gousses mûres, ouverture, soie qui part au vent : septembre–octobre. '
  'Fenêtre passée, la moitié du dossier attend un an. <b>Si on ne tourne qu\'une journée cette année, '
  'c\'est celle-là</b> — et on tourne large, la banque de plans matière sert toute l\'année.</p></div>')
COL=["#1f5d3f","#2b4a7a","#b4531f","#6d6459","#14100c","#8a6d3b","#4a7c59"]
for n,t,fen,tag,lieu,cons,blocs,livr,gl in JOURS:
    bg = ' <span class="badge b-red">URGENT</span>' if tag=="URGENT" else (
         ' <span class="badge b-grey">SAISON</span>' if tag else '')
    w(f'<h3>Journée {n} · {t}{bg}</h3>')
    w(f'<table style="margin-bottom:2mm"><tr><td class="n" style="width:22mm">Fenêtre</td><td>{fen}</td></tr>'
      f'<tr><td class="n">Lieux</td><td>{lieu}</td></tr>'
      f'<tr><td class="n">Concepts</td><td>{" · ".join(x.replace("c","") for x in cons)}</td></tr>'
      f'<tr><td class="n">Livrables</td><td><b>{livr}</b></td></tr></table>')
    w('<div style="display:flex;height:9mm;margin-bottom:1.5mm">')
    for i,(h,pc,d) in enumerate(blocs):
        w(f'<div style="width:{pc}%;background:{COL[i%len(COL)]};color:#fff;font-size:6pt;'
          f'padding:1.2mm 1mm;overflow:hidden"><b>{h}</b></div>')
    w('</div><table style="margin-bottom:2mm">')
    for i,(h,pc,d) in enumerate(blocs):
        w(f'<tr><td class="n" style="width:20mm;color:{COL[i%len(COL)]}">{h}</td><td>{d}</td></tr>')
    w('</table>')
    w('<div style="white-space:nowrap;margin-bottom:4mm">' + "".join(frame(c,"",15) for c in gl) + '</div>')
w('<div class="box g"><h4>Dérushage, le soir même</h4><p style="margin:0">'
  'Renommer chaque prise : <code>J1_M01_A01_v03.mov</code>. Une banque de plans qui n\'est pas nommée '
  'n\'existe pas. Trois mois plus tard, personne ne retrouve la bonne ouverture de gousse parmi '
  '40 fichiers IMG_8259.</p></div></section>')

# ---------- 9 · MATÉRIEL ----------
w('<section><h2><span class="n">09</span>Matériel</h2>')
w('<p class="lede">Trois achats débloquent treize concepts.</p>')
w('<h3 style="margin-top:0">Les trois achats prioritaires</h3><div class="g3">')
for g_,ti,px,de in [("M-07","Microscope USB","200–1000×, &lt; 60 $","Toute la famille E. 6 concepts."),
 ("D-02","Module thermique","sur téléphone","B-02 et déclinaisons. Le plus spectaculaire par dollar."),
 ("M-12","Balance 0,1 g","de cuisine","M-12, B-05, C-02, D-06. 4 concepts.")]:
    gid="g"+g_.replace("-","")
    w(f'<div class="pl"><svg class="fx" viewBox="0 0 60 100"><use href="#{gid}"/></svg>'
      f'<b>{px}</b><strong>{ti}</strong><span>{de}</span></div>')
w('</div>')
w('<div class="g2"><div><h3>Le kit</h3><table>')
for a,b in [("Téléphone récent ×2","Un plan principal, un pour l'afficheur. Beaucoup de tests exigent deux cadres."),
("Trépied + trépied de table","Tous les time-lapse, comparaisons, macro."),
("Fond noir mat 60 × 80","Toute la famille M. Coût négligeable, effet décisif."),
("Lampe LED orientable","Contre-jour, rasante, tout ralenti intérieur. Une source bien placée > trois mal placées."),
("Micro-cravate ×2 + bonnettes","Toute parole en extérieur."),
("Thermomètres à sonde ×3","Sonde filaire, pas infrarouge : l'infrarouge mesure une surface."),
("Chronomètre physique","Plus crédible à l'écran, et ça évite de truquer sans le vouloir."),
("Pied à coulisse","B-06, mesures d'épaisseur."),
("Perche 4 m","T-03. Fait 80 % du travail d'un drone, sans réglementation."),
("Batteries externes ×3","Le froid vide un téléphone en 20 min. Journée 4 impossible sans."),
("Sacs et étiquettes","Trois maturités datées. Sans ça, D-05 impossible en février.")]:
    w(f'<tr><td class="n" style="width:38mm">{a}</td><td>{b}</td></tr>')
w('</table></div><div>')
w('<h3>Réglages par défaut</h3><table>')
for a,b in [("Tout par défaut","4K, 30 i/s, vertical natif. Jamais recadrer un horizontal."),
("Ralenti","120 fps min, 240 pour impacts et gouttes. Lumière ajoutée obligatoire."),
("Macro","Mise au point verrouillée manuellement. L'autofocus pompe."),
("Contre-jour","Sous-exposer 1 à 1,5 IL, verrouiller avant de lancer."),
("Time-lapse","Exposition verrouillée, lumière constante, aucun contact avec le support."),
("Extérieur venteux","Bonnette. Un plan sans son direct est à moitié perdu.")]:
    w(f'<tr><td class="n" style="width:26mm">{a}</td><td>{b}</td></tr>')
w('</table>')
w('<h3>Ce qu\'on fabrique</h3><ul>'
'<li><b>La boîte à lumière du pauvre.</b> Un carton, une fente de 2 cm, une lampe → M-03.</li>'
'<li><b>Le support de comparaison.</b> Une planche à trois emplacements marqués → M-10 et D-04 rigoureusement identiques d\'une vidéo à l\'autre.</li>'
'<li><b>Le repère de cadrage.</b> Photo de référence + GPS + piquet → T-08 et J-01. Un « même cadrage six mois plus tard » ne se refait pas de mémoire.</li></ul>')
w('</div></div></section>')

# ---------- 10 · MESURE + GARDE-FOUS ----------
w('<section><h2><span class="n">10</span>Mesure et garde-fous</h2>')
w('<p class="lede">En exploration, la vidéo n\'est pas le produit. <b>La décision est le produit.</b></p>')
w('<div class="g2"><div>')
w('<h3 style="margin-top:0">Chaque format, son indicateur</h3><table><tr><th>Fam.</th><th>On juge sur</th><th>Pas sur</th></tr>')
for f,a,b in [("A","Commentaires qui donnent un nom","Les ventes"),("B","Partages et enregistrements","Les commentaires"),
("C","Absence d'objection, taux de j'aime","Le volume de conversation"),("D","Offres de matière qualifiées","La portée"),
("E","Enregistrements","Les vues"),("F","Portée et partages","La conversion"),
("G","Rétention d'une semaine à l'autre","Une publication isolée"),("H","Ventes et questions d'achat","La portée"),
("I","Partages","Les commentaires"),("J","Enregistrements, ventes de semences","Les vues"),
("K","J'aime sur l'audience acquise","La portée"),("L","Qualité des commentaires","La portée : elle plafonne")]:
    w(f'<tr><td class="n">{f}</td><td>{a}</td><td style="color:var(--mut)">{b}</td></tr>')
w('</table>')
w('<div class="box w"><h4>Les deux erreurs de mesure</h4>'
'<p><b>1. Juger une vidéo de recrutement à sa portée.</b> Le classement par conversion est l\'inverse exact '
'du classement par portée : 106 400 vues → 8 % de conversion ; 42 000 vues → 81 %.</p>'
'<p style="margin:0"><b>2. Croire qu\'une vidéo sous la médiane est un échec.</b> La moitié des vidéos '
'y sont par construction. C\'est le rendement ordinaire.</p></div>')
w('<h3>La règle des 48 h</h3><p>Trois catégories reçoivent une réponse, sans exception : '
'<b>une objection</b> (elle se régénère sinon), <b>une offre d\'affaires</b> (premier canal entrant du compte), '
'<b>une question d\'achat</b>. Le reste peut attendre. Référence : 2,1 % de réponses, 92 fils sur 135 sans un mot, '
'délai record de onze mois.</p>')
w('<div class="box d"><h4>Préalable à toute la famille D</h4><p style="margin:0">'
'Un lien de contact en bio. Sans porte de sortie, chaque vidéo de gisement fabrique des pistes qu\'on perd : '
'15 personnes écrivent publiquement qu\'elles n\'arrivent pas à joindre la marque, et c\'est un abonné '
'qui finit par indiquer où écrire.</p></div>')
w('</div><div>')
w('<h3 style="margin-top:0">Les 9 A/B à lancer</h3><table>')
for n,q in [("1","Cold-open + description-question : les deux effets s'additionnent-ils ? <b>Jamais testé, gratuit.</b>"),
("2","Le mot jamais dit produit-il plus de commentaires qu'un montage qui le dit ?"),
("3","Le CTA-tag à la 4e s bat-il la question de fin, chez nous ?"),
("4","Le contre-jour vaut-il le déplacement à l'aube ?"),
("5","La chenille bat-elle la matière en portée froide ?"),
("6","Le prix affiché à l'écran fait-il fuir ?"),
("7","La devinette annoncée à 3 s bat-elle la même posée à la fin ?"),
("8","Le sous-titre à la main bat-il l'automatique ?"),
("9","Le trou volontaire dans un procédé produit-il des commentaires ?")]:
    w(f'<tr><td class="n">{n}</td><td>{q}</td></tr>')
w('</table><p style="color:var(--mut)">Dispositif : deux montages du même tournage, publiés le même jour '
  'à quelques heures d\'écart. Une seule variable change, consignée au journal <b>avant</b> publication.</p>')
w('<h3>Garde-fous</h3><table><tr><th>Sujet</th><th class="non">Jamais</th><th class="oui">Dicible</th></tr>')
for s,no,ok in [("Origine","« fabriqué au Québec », « fait ici », drapeau sur un produit fini",
 "« isolant cultivé, conçu et fabriqué au Québec » · « d'une marque québécoise »"),
("Environnement","« 100 % écologique », « zéro impact », « sauve les monarques », « un achat = un papillon »",
 "fibre végétale légère · structure creuse qui emprisonne l'air · naturellement hydrophobe · plante hôte du monarque"),
("Performance","« imperméable », « plus chaud que le duvet », toute plage de température",
 "expliquer le mécanisme · montrer un test avec son protocole · rapporter un vécu comme un vécu"),
("Fondateur","la maladie, la fatigue, les difficultés comme argument de vente",
 "la vulnérabilité pour clarifier une décision"),
("Le pivot","« rien ne change » · « produire ici était une erreur »",
 "quelle décision, pourquoi c'était dur, pourquoi le modèle n'est plus le bon, ce qui reste")]:
    w(f'<tr><td class="n">{s}</td><td>{no}</td><td>{ok}</td></tr>')
w('</table>')
w('<h3>Sécurité de tournage</h3><ul>'
'<li><b>Froid</b> — 4 min max en congélateur, surveillance, arrêt au premier engourdissement. Jamais d\'enfant.</li>'
'<li><b>Feu</b> — extérieur, surface incombustible, extincteur dans le cadre. Aucune affirmation de résistance au feu.</li>'
'<li><b>Machines</b> — aucun plan qui montre un contournement de sécurité.</li>'
'<li><b>Vivant</b> — aucune manipulation, aucun prélèvement, aucune LED directe. Si le plan exige d\'intervenir, on ne fait pas le plan.</li>'
'<li><b>Personnes</b> — autorisation avant de filmer, montage jamais moqueur.</li></ul>')
w('</div></div>')
w('<div class="box d"><h4>Le test final, avant chaque publication</h4><p style="margin:0">'
  '<b>Est-ce que cette vidéo pourrait être publiée par n\'importe quelle autre marque écoresponsable ?</b> '
  'Si oui, elle n\'est pas prête. Ce qui nous appartient : la matière, la plante, le monarque, l\'atelier, '
  'les compromis assumés, et un mot qu\'on refuse de dire.</p></div>')
w('</section>')

# ---------- 11 · FICHES ----------
w('<section><h2><span class="n">11</span>Fiches à imprimer</h2>')
w('<div class="g2"><div>')
w('<h3 style="margin-top:0">Avant de partir</h3><div class="box"><ul class="chk">')
for x in ["Batteries chargées + 3 batteries externes","Cartes vidées, espace vérifié",
"Fond noir, réflecteur, lampe","Micros + bonnettes + piles","Trépieds (grand + table)",
"Balance, thermomètres, chrono, pied à coulisse","Sacs et étiquettes pour la matière",
"Liste des hooks à tester, imprimée","Produits à sacrifier identifiés","Autorisations si personnes filmées"]:
    w(f'<li>{x}</li>')
w('</ul></div>')
w('<h3>Avant de repartir du lieu</h3><div class="box"><ul class="chk">')
for x in ["Les 8 plans obligatoires sont tournés","Chaque hook dit en 3 formulations",
"Son direct de la matière enregistré au casque","Un plan d'échelle pour chaque macro",
"Le désamorçage de l'objection est tourné (loi 2)","Le CTA tourné, prononcé, en deux formulations",
"Matière ramenée, étiquetée, datée","Repères de cadrage notés pour les retours saisonniers"]:
    w(f'<li>{x}</li>')
w('</ul></div></div><div>')
w('<h3 style="margin-top:0">Feuille de concept</h3><div class="box"><table>')
for lab,h in [("Code concept","5mm"),("Hook retenu","8mm"),("Désamorçage (à quelle seconde)","8mm"),
("Plans, dans l'ordre","16mm"),("CTA prononcé","8mm"),("CTA incrusté","8mm"),
("Description-question","10mm"),("Commentaire épinglé","10mm")]:
    w(f'<tr><td class="n" style="width:30mm">{lab}</td><td style="height:{h}"></td></tr>')
w('<tr><td class="n">Arc ouvert ?</td><td>Oui / Non · fermeture prévue : ____________</td></tr>')
w('<tr><td class="n">Garde-fous</td><td>Origine ☐ Écologie ☐ Performance ☐ Fondateur ☐ '
  'Sécurité ☐ <b>Mot jamais dit ☐</b></td></tr>')
w('</table></div></div></div>')
w('<h3>Journal de publication</h3>')
w('<p style="color:var(--mut)">Le seul document qui transforme un tournage en apprentissage. '
  'Sans lui, on refait les mêmes vidéos en croyant explorer.</p><div class="box"><table>')
w('<tr><th>Date</th><th>Code</th><th>Hook</th><th>CTA</th><th>Variable A/B</th><th>Vues</th>'
  '<th>Comm.</th><th>Part.</th><th>Enreg.</th><th>Ce qu\'on apprend</th><th>Arc ?</th></tr>')
for _ in range(14): w('<tr>'+'<td style="height:6mm"></td>'*11+'</tr>')
w('</table></div>')
w('<h3>Registre des arcs ouverts</h3>')
w('<p style="color:var(--mut)">Ce qui plafonne le compte de référence : 5 arcs ouverts, '
  '330 400 vues de promesses, 0 vidéo de résultat. <b>Un arc sans date de fermeture ne se publie pas.</b></p>')
w('<div class="box"><table><tr><th>Ouvert le</th><th>Promesse faite</th><th>Fermeture prévue</th><th>Fermé ?</th></tr>')
for _ in range(7): w('<tr>'+'<td style="height:7mm"></td>'*4+'</tr>')
w('</table></div>')
w('<div class="box d"><h4>Les cinq choses à faire cette semaine, avant de tourner</h4><ol style="margin:0;padding-left:5mm">'
'<li><b>Mettre un lien de contact en bio.</b> Sinon la famille D fabrique des pistes qu\'on perd.</li>'
'<li><b>Repérer trois lieux</b> pour la journée 1 et vérifier la maturité des gousses.</li>'
'<li><b>Acheter le microscope, le module thermique et la balance.</b> Treize concepts débloqués.</li>'
'<li><b>Ouvrir le dossier de collecte des commentaires</b> pour le final de saison (L-06).</li>'
'<li><b>Fixer la date de la journée 1.</b> Le reste attend ; elle, non.</li></ol></div>')
w('</section>')

w('</body></html>')
open("dossier.html","w",encoding="utf-8").write("\n".join(out))
print("HTML écrit :", sum(len(x) for x in out), "caractères")
