#!/usr/bin/env python3
"""Construit la note stratégique PDF à l'intention des bailleurs.

Le HTML est écrit ici plutôt qu'à la main pour que chaque chiffre vienne d'une
seule source : les données relevées dans le classeur audité, le réel Shopify et
le réel QuickBooks. Les graphiques sont du SVG posé à la main, aucune
bibliothèque, donc rien à charger et un rendu identique à l'impression.
"""
import json
import re
import subprocess
from pathlib import Path

D = json.load(open('pdf_data.json', encoding='utf8'))
C, A = D['cons'], D['amb']

# ------------------------------------------------------------------ palette
INK = '#16211d'
VERT = '#2f5d50'
VERT_CLAIR = '#8fb3a8'
VERT_PALE = '#e4ede9'
ORANGE = '#c8571f'          # monarque
ORANGE_PALE = '#f6e3d8'
GRIS = '#6f7a76'
PAPIER = '#fcfbf8'
LIGNE = '#dcd9d0'


def fr(x, dec=0, suffix=' $'):
    s = f'{x:,.{dec}f}'.replace(',', ' ').replace('.', ',')
    return s + suffix


def pct(x, dec=1):
    return f'{x * 100:,.{dec}f}'.replace('.', ',') + ' %'


# ------------------------------------------------------------- graphiques
def bar_chart(series, labels, width=680, height=210, colors=None, fmt=fr,
              pad_left=8, show_values=True, baseline_zero=True):
    """Barres groupées. series = [(nom, [valeurs], couleur)]"""
    n = len(labels)
    gw = (width - pad_left) / n
    allv = [v for _, vals, _ in series for v in vals]
    top = max(allv + [0])
    bot = min(allv + [0]) if baseline_zero else min(allv)
    span = (top - bot) or 1
    y0 = height - 26                      # ligne de base des libellés
    zero = y0 - (0 - bot) / span * (y0 - 26)
    out = [f'<svg viewBox="0 0 {width} {height}" class="chart">']
    out.append(f'<line x1="0" y1="{zero:.1f}" x2="{width}" y2="{zero:.1f}" '
               f'stroke="{LIGNE}" stroke-width="1"/>')
    bw = gw / (len(series) + 0.9)
    for si, (name, vals, col) in enumerate(series):
        for i, v in enumerate(vals):
            x = pad_left + i * gw + si * bw + gw * 0.08
            h = abs(v - 0) / span * (y0 - 26)
            y = zero - h if v >= 0 else zero
            out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw * 0.86:.1f}" '
                       f'height="{max(h, 0.6):.1f}" fill="{col}" rx="1.5"/>')
            if show_values:
                ty = y - 5 if v >= 0 else y + h + 12
                out.append(f'<text x="{x + bw * 0.43:.1f}" y="{ty:.1f}" '
                           f'class="bv" fill="{col if v < 0 else INK}">{fmt(v)}</text>')
    for i, lab in enumerate(labels):
        out.append(f'<text x="{pad_left + i * gw + gw * 0.42:.1f}" y="{height - 8}" '
                   f'class="bl">{lab}</text>')
    out.append('</svg>')
    return ''.join(out)


def legend(items):
    sp = ''.join(f'<span class="lg"><i style="background:{c}"></i>{t}</span>'
                 for t, c in items)
    return f'<div class="legend">{sp}</div>'


def combo_chart(labels, ventes, pub, width=680, height=225):
    """Publicité en barres, ventes nettes en ligne. Deux échelles, une lecture :
    la ligne suit les barres avec trois semaines de retard."""
    mv, mp = max(ventes) or 1, max(pub) or 1
    y0, yt = height - 34, 20
    gw = width / len(labels)
    bw = gw * 0.5
    out = [f'<svg viewBox="0 0 {width} {height}" class="chart">']
    out.append(f'<line x1="0" y1="{y0}" x2="{width}" y2="{y0}" stroke="{LIGNE}"/>')
    for i, v in enumerate(pub):
        h = v / mp * (y0 - yt)
        out.append(f'<rect x="{i * gw + (gw - bw) / 2:.1f}" y="{y0 - h:.1f}" '
                   f'width="{bw:.1f}" height="{max(h, 0.5):.1f}" fill="{ORANGE_PALE}" '
                   f'stroke="{ORANGE}" stroke-width="0.6" rx="1"/>')
    pts = ' '.join(f'{i * gw + gw / 2:.1f},{y0 - v / mv * (y0 - yt):.1f}'
                   for i, v in enumerate(ventes))
    out.append(f'<polyline points="{pts}" fill="none" stroke="{VERT}" stroke-width="2.4"/>')
    for i, v in enumerate(ventes):
        y = y0 - v / mv * (y0 - yt)
        out.append(f'<circle cx="{i * gw + gw / 2:.1f}" cy="{y:.1f}" r="2.8" fill="{VERT}"/>')
    for i, lab in enumerate(labels):
        out.append(f'<text x="{i * gw + gw / 2:.1f}" y="{height - 12}" class="bl">{lab}</text>')
    out.append(f'<text x="{9 * gw + gw / 2:.1f}" y="{height - 2}" class="bl" '
               f'fill="{ORANGE}">\u25b2</text>')
    out.append('</svg>')
    return ''.join(out) + legend([('Ventes nettes mensuelles', VERT),
                                  ('Publicit\u00e9 num\u00e9rique', ORANGE)])


def ramp_chart(labels, cons, amb, width=680, height=190):
    """Points de vente : deux rampes.

    Les points extrêmes sont rentrés de 30 px : centrés sur x=0 et x=width, leur
    libellé et leur valeur sortaient du cadre et se faisaient tronquer."""
    top = max(amb) or 1
    y0, yt = height - 28, 18
    pad = 30
    gw = (width - 2 * pad) / (len(labels) - 1)
    px = lambda i: pad + i * gw
    out = [f'<svg viewBox="0 0 {width} {height}" class="chart">']
    out.append(f'<line x1="0" y1="{y0}" x2="{width}" y2="{y0}" stroke="{LIGNE}"/>')
    for s_, col, dash in ((amb, ORANGE, '4 3'), (cons, VERT, '')):
        p = ' '.join(f'{px(i):.1f},{y0 - v / top * (y0 - yt):.1f}'
                     for i, v in enumerate(s_))
        out.append(f'<polyline points="{p}" fill="none" stroke="{col}" '
                   f'stroke-width="2.4" stroke-dasharray="{dash}"/>')
        for i, v in enumerate(s_):
            y = y0 - v / top * (y0 - yt)
            out.append(f'<circle cx="{px(i):.1f}" cy="{y:.1f}" r="3" fill="{col}"/>')
            if v:
                out.append(f'<text x="{px(i):.1f}" y="{y - 8:.1f}" class="bv" '
                           f'fill="{col}">{v:.0f}</text>')
    for i, lab in enumerate(labels):
        out.append(f'<text x="{px(i):.1f}" y="{height - 9}" class="bl">{lab}</text>')
    out.append('</svg>')
    return ''.join(out) + legend([('Conservateur', VERT), ('Ambitieux', ORANGE)])


def stack_chart(labels, web, detail, width=680, height=195):
    """Ventes nettes empilées : en ligne + détail."""
    tot = [w + d for w, d in zip(web, detail)]
    top = max(tot) or 1
    y0, yt = height - 30, 22
    gw = width / len(labels)
    bw = gw * 0.46
    out = [f'<svg viewBox="0 0 {width} {height}" class="chart">']
    out.append(f'<line x1="0" y1="{y0}" x2="{width}" y2="{y0}" stroke="{LIGNE}"/>')
    for i, (w, d) in enumerate(zip(web, detail)):
        x = i * gw + (gw - bw) / 2
        hw = w / top * (y0 - yt)
        hd = d / top * (y0 - yt)
        out.append(f'<rect x="{x:.1f}" y="{y0 - hw:.1f}" width="{bw:.1f}" '
                   f'height="{hw:.1f}" fill="{VERT}" rx="1.5"/>')
        if d:
            out.append(f'<rect x="{x:.1f}" y="{y0 - hw - hd:.1f}" width="{bw:.1f}" '
                       f'height="{hd:.1f}" fill="{ORANGE}" rx="1.5"/>')
        out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hw - hd - 7:.1f}" '
                   f'class="bv">{(w + d) / 1000:.0f} k$</text>')
    for i, lab in enumerate(labels):
        out.append(f'<text x="{i * gw + gw / 2:.1f}" y="{height - 10}" '
                   f'class="bl">{lab}</text>')
    out.append('</svg>')
    return ''.join(out) + legend([('Commerce en ligne', VERT),
                                  ('Canal détail (consignation)', ORANGE)])



def moteurs_chart(labels, web, detail, width=680, height=200):
    """Les deux moteurs de la croissance, empilés, chacun avec sa progression.

    Le canal détail part de zéro et frappe l'oeil ; sans cette lecture, on croit
    qu'il porte la croissance à lui seul. La progression du commerce en ligne est
    donc écrite dans son propre segment."""
    tot = [w + d for w, d in zip(web, detail)]
    top = max(tot) or 1
    y0, yt = height - 30, 34
    gw = width / len(labels)
    bw = gw * 0.44
    out = [f'<svg viewBox="0 0 {width} {height}" class="chart">']
    out.append(f'<line x1="0" y1="{y0}" x2="{width}" y2="{y0}" stroke="{LIGNE}"/>')
    for i, (w, d) in enumerate(zip(web, detail)):
        x = i * gw + (gw - bw) / 2
        hw = w / top * (y0 - yt)
        hd = d / top * (y0 - yt)
        out.append(f'<rect x="{x:.1f}" y="{y0 - hw:.1f}" width="{bw:.1f}" '
                   f'height="{hw:.1f}" fill="{VERT}" rx="1.5"/>')
        out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hw / 2 + 4:.1f}" class="bv" '
                   f'fill="#ffffff">{w / 1000:.0f} k$</text>')
        if d:
            out.append(f'<rect x="{x:.1f}" y="{y0 - hw - hd:.1f}" width="{bw:.1f}" '
                       f'height="{hd:.1f}" fill="{ORANGE}" rx="1.5"/>')
            out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hw - hd / 2 + 4:.1f}" '
                       f'class="bv" fill="#ffffff">{d / 1000:.0f} k$</text>')
        if i:
            # La virgule décimale ne se pose que sur le libellé : appliquée à la
            # chaîne entière, elle corromprait les coordonnées du SVG.
            g = f'en ligne {(web[i] / web[i - 1] - 1) * 100:+.0f} %'.replace('.', ',')
            out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hw - hd - 20:.1f}" '
                       f'class="bv" fill="{VERT}">{g}</text>')
        if d:
            out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hw - hd - 7:.1f}" '
                       f'class="bv">{(w + d) / 1000:.0f} k$ au total</text>')
    for i, lab in enumerate(labels):
        out.append(f'<text x="{i * gw + gw / 2:.1f}" y="{height - 10}" '
                   f'class="bl">{lab}</text>')
    out.append('</svg>')
    return ''.join(out) + legend([('Commerce en ligne', VERT),
                                  ('Canal détail (consignation)', ORANGE)])


def hbar(rows, width=680, rowh=42, fmt=None):
    """Barres horizontales avant/après : la comparaison qui frappe."""
    top = max(v for _, v, _ in rows) or 1
    h = rowh * len(rows) + 8
    out = [f'<svg viewBox="0 0 {width} {h}" class="chart">']
    for i, (lab, v, col) in enumerate(rows):
        y = i * rowh + 4
        bw = max(v / top * (width - 250), 2)
        out.append(f'<text x="0" y="{y + 15}" class="hl">{lab}</text>')
        out.append(f'<rect x="190" y="{y + 4}" width="{bw:.1f}" height="17" '
                   f'fill="{col}" rx="2"/>')
        out.append(f'<text x="{190 + bw + 8:.1f}" y="{y + 17}" class="hv" '
                   f'fill="{col}">{fmt(v) if fmt else fr(v)}</text>')
    out.append('</svg>')
    return ''.join(out)


def fibre_chart(width=680, height=170):
    """Le prix des isolants au kilo, échelle logarithmique."""
    import math
    data = [('Polyester', 0.50, GRIS), ('Laine', 4.0, GRIS),
            ('Asclépiade', 85.0, ORANGE), ('Duvet', 125.0, VERT)]
    y0, yt = height - 30, 20
    gw = width / len(data)
    bw = gw * 0.42
    lo, hi = math.log10(0.4), math.log10(140)
    for i, (lab, v, col) in enumerate(data):
        pass
    out = [f'<svg viewBox="0 0 {width} {height}" class="chart">']
    out.append(f'<line x1="0" y1="{y0}" x2="{width}" y2="{y0}" stroke="{LIGNE}"/>')
    for i, (lab, v, col) in enumerate(data):
        hh = (math.log10(v) - lo) / (hi - lo) * (y0 - yt)
        x = i * gw + (gw - bw) / 2
        out.append(f'<rect x="{x:.1f}" y="{y0 - hh:.1f}" width="{bw:.1f}" '
                   f'height="{hh:.1f}" fill="{col}" rx="1.5"/>')
        out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hh - 6:.1f}" class="bv">'
                   f'{str(v).replace(".", ",")} $</text>')
        out.append(f'<text x="{x + bw / 2:.1f}" y="{height - 10}" class="bl">{lab}</text>')
    out.append('</svg>')
    return ''.join(out)

# ---------------------------------------------------------------- contenu
YR = ['FY2026', 'FY2027', 'FY2028', 'FY2029']
MOIS = ['S', 'O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A']
S = D['sommaire']

CSS = f"""<style>
@page {{ size: Letter; margin: 0; }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'DejaVu Sans','Liberation Sans',sans-serif; font-size: 9.2pt;
  line-height: 1.5; color: {INK}; background: {PAPIER}; margin: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
h1,h2,h3,h4 {{ font-family: 'Bitstream Charter',Georgia,serif; font-weight: 700; }}
.page {{ page-break-after: always; position: relative; width: 215.9mm; height: 279.4mm;
  padding: 15mm 14mm 13mm; overflow: hidden; }}
.page:last-child {{ page-break-after: auto; }}

.cover {{ background: {INK}; color: #fff; padding: 26mm 22mm 22mm; }}
.cover .mark {{ font-family:'Bitstream Charter',Georgia,serif; font-size:23pt;
  letter-spacing:.30em; font-weight:700; }}
.cover .ctype {{ font-size:7.6pt; letter-spacing:.24em; color:{ORANGE}; font-weight:700;
  margin-bottom:14px; }}
.cover .cfig {{ display:flex; gap:0; margin:52px 0 58px; border-top:1px solid #3a4b45;
  border-bottom:1px solid #3a4b45; }}
.cover .cfig > div {{ flex:1; padding:14px 14px 14px 0; }}
.cover .cfig .v {{ display:block; font-family:'Bitstream Charter',Georgia,serif;
  font-size:19pt; color:#fff; line-height:1.05; }}
.cover .cfig .k {{ display:block; font-size:7.3pt; letter-spacing:.09em;
  text-transform:uppercase; color:#8fa39d; margin-top:6px; }}
.cover .cnote {{ margin-top:26px; padding-top:14px; border-top:1px solid #3a4b45;
  font-size:8.6pt; color:#a8b8b3; line-height:1.6; max-width:46em; }}
.cover .ctitle {{ font-size:7.4pt; letter-spacing:.2em; color:#8fa39d; margin-bottom:10px; }}
.cover .toc {{ column-count:2; column-gap:26px; }}
.toci {{ display:flex; align-items:baseline; font-size:8.5pt; color:#d6dedb;
  margin-bottom:6px; break-inside:avoid; }}
.toci .n {{ font-family:'Bitstream Charter',Georgia,serif; color:{ORANGE}; width:20px;
  flex:0 0 20px; }}
.toci .t {{ flex:0 1 auto; }}
.toci .d {{ flex:1 1 auto; border-bottom:1px dotted #4a5a55; margin:0 5px 3px; min-width:8px; }}
.toci .p {{ color:#8fa39d; }}
.cover .rule {{ width:54px; height:3px; background:{ORANGE}; margin:18px 0 26px; }}
.cover h1 {{ font-size:34pt; line-height:1.1; margin:0 0 14px; }}
.cover .sub {{ font-size:11.5pt; color:{VERT_CLAIR}; max-width:30em; line-height:1.5; }}
.cover .meta {{ position:absolute; bottom:20mm; font-size:7.9pt; color:#8d9a95;
  letter-spacing:.05em; line-height:1.7; }}
.cover .tagbox {{ margin-top:34px; border-left:3px solid {ORANGE}; padding:4px 0 4px 16px;
  font-family:'Bitstream Charter',Georgia,serif; font-size:12.5pt; color:#eae7df;
  max-width:27em; line-height:1.45; font-style:italic; }}
.conf {{ display:inline-block; border:1px solid #4a5a55; color:#9fb0aa; padding:3px 10px;
  font-size:7.3pt; letter-spacing:.18em; margin-bottom:28px; }}

.sect {{ display:flex; align-items:baseline; gap:12px; margin:0 0 3px; }}
.sect .num {{ font-family:'Bitstream Charter',Georgia,serif; font-size:24pt;
  color:{VERT_CLAIR}; line-height:1; }}
.kicker {{ font-size:7.4pt; letter-spacing:.16em; text-transform:uppercase;
  color:{ORANGE}; font-weight:700; margin-bottom:3px; }}
h2 {{ font-size:15pt; margin:0; letter-spacing:-.01em; }}
.lede {{ color:{GRIS}; font-size:9.5pt; margin:2px 0 14px; max-width:47em; }}
h3 {{ font-size:10.4pt; margin:15px 0 5px; color:{VERT}; }}
h4 {{ margin:0 0 6px; font-size:9.3pt; }}
p {{ margin:0 0 8px; }}
.hr {{ height:1px; background:{LIGNE}; margin:13px 0; }}

.tiles {{ display:flex; gap:8px; margin:12px 0 14px; }}
.tile {{ flex:1; background:#fff; border:1px solid {LIGNE}; border-top:3px solid {VERT};
  padding:10px 11px 11px; }}
.tile.o {{ border-top-color:{ORANGE}; }}
.tile .v {{ font-family:'Bitstream Charter',Georgia,serif; font-size:17.5pt; line-height:1.05; }}
.tile .k {{ font-size:7.2pt; letter-spacing:.1em; text-transform:uppercase; color:{GRIS};
  margin-top:5px; }}
.tile .n {{ font-size:7.6pt; color:{GRIS}; margin-top:3px; }}

table {{ width:100%; border-collapse:collapse; font-size:8.6pt; margin:8px 0 11px; }}
th {{ text-align:right; font-weight:600; font-size:7.4pt; letter-spacing:.09em;
  text-transform:uppercase; color:{GRIS}; padding:6px 7px; border-bottom:1.5px solid {INK}; }}
th:first-child {{ text-align:left; }}
td {{ text-align:right; padding:5px 7px; border-bottom:1px solid {LIGNE};
  font-variant-numeric:tabular-nums; }}
td:first-child {{ text-align:left; }}
tr.hi td {{ background:{VERT_PALE}; font-weight:700; }}
tr.hio td {{ background:{ORANGE_PALE}; font-weight:700; }}
tr.tot td {{ border-top:1.5px solid {INK}; border-bottom:none; font-weight:700; }}
.neg {{ color:{ORANGE}; }}
caption {{ caption-side:bottom; text-align:left; font-size:7.5pt; color:{GRIS}; padding-top:5px; }}

.two {{ display:flex; gap:14px; }}
.two > div {{ flex:1; }}
.three {{ display:flex; gap:10px; }}
.three > div {{ flex:1; }}
.card {{ background:#fff; border:1px solid {LIGNE}; padding:11px 13px; }}
.card.v {{ border-left:3px solid {VERT}; }}
.card.o {{ border-left:3px solid {ORANGE}; }}
.card.dark {{ background:{INK}; color:#e8ece9; border:none; }}
.card.dark h4 {{ color:#fff; }}
.quote {{ border-left:3px solid {ORANGE}; padding:3px 0 3px 15px; margin:12px 0;
  font-family:'Bitstream Charter',Georgia,serif; font-size:11.2pt; line-height:1.42;
  font-style:italic; }}
.quote cite {{ display:block; font-family:'DejaVu Sans',sans-serif; font-size:7.6pt;
  font-style:normal; color:{GRIS}; margin-top:6px; letter-spacing:.04em; }}
ul {{ margin:5px 0 9px; padding-left:0; list-style:none; }}
li {{ position:relative; padding-left:15px; margin-bottom:4px; }}
li:before {{ content:''; position:absolute; left:0; top:.55em; width:5px; height:5px;
  background:{VERT_CLAIR}; }}
ul.o li:before {{ background:{ORANGE}; }}
.big {{ font-family:'Bitstream Charter',Georgia,serif; font-size:32pt; line-height:1;
  color:{VERT}; }}
.big.o {{ color:{ORANGE}; }}
.verrou {{ display:flex; gap:11px; align-items:flex-start; margin-bottom:9px; }}
.verrou .n {{ font-family:'Bitstream Charter',Georgia,serif; font-size:15pt; color:#fff;
  background:{VERT}; width:26px; height:26px; border-radius:50%; text-align:center;
  line-height:26px; flex:0 0 26px; font-size:11pt; }}
.verrou.o .n {{ background:{ORANGE}; }}
.verrou p {{ margin:0; }}

.chart {{ width:100%; height:auto; display:block; margin:5px 0 2px; }}
.bv {{ font-size:7.3px; text-anchor:middle; font-family:'DejaVu Sans',sans-serif; font-weight:600; }}
.bl {{ font-size:7.5px; text-anchor:middle; fill:{GRIS}; font-family:'DejaVu Sans',sans-serif; }}
.hl {{ font-size:8.4px; fill:{INK}; font-family:'DejaVu Sans',sans-serif; }}
.hv {{ font-size:9.5px; font-weight:700; font-family:'DejaVu Sans',sans-serif; }}
.legend {{ display:flex; gap:16px; font-size:7.6pt; color:{GRIS}; margin-top:2px; }}
.lg i {{ display:inline-block; width:9px; height:9px; margin-right:5px; vertical-align:-1px; }}
.fig {{ font-size:7.5pt; color:{GRIS}; margin-top:4px; }}
.foot {{ position:absolute; bottom:13mm; left:14mm; right:14mm; display:flex;
  justify-content:space-between; font-size:7.1pt; color:#9aa39f;
  border-top:1px solid {LIGNE}; padding-top:5px; letter-spacing:.05em; }}
</style>"""


def foot(n, tot=14):
    return (f'<div class="foot"><span>LASCLAY · PRÉVISIONS FINANCIÈRES 2026-2029</span>'
            f'<span>{n} / {tot}</span></div></div>')


HBAR_MOD = hbar([("Production interne, FY2026", 91036, VERT),
                 ("Isolant en rouleau, FY2027", 4800, ORANGE)], rowh=46)
hist_lab = ['FY2022', 'FY2023', 'FY2024', 'FY2025', 'FY2026']
hist_ca = [280000, 403702, 504926, 879125, 1103327]

P = []   # les pages

# ------------------------------------------------------------------ COUVERTURE
SOMMAIRE = [
    ('01', 'L’asclépiade, la filière et ses échecs', 1),
    ('02', 'Ce que disent six ans de ventes', 2),
    ('03', 'La demande, testée trois fois', 3),
    ('04', 'Juin et juillet 2026 : ce que coûte le manque de trésorerie', 4),
    ('05', 'Le coût de la fibre et le maillage industriel', 5),
    ('06', 'De la production artisanale à l’isolant en rouleau', 6),
    ('07', 'Le marketing et le développement des marchés', 7),
    ('08', 'Les coûts fixes et l’infrastructure numérique', 8),
    ('09', 'Deux moteurs, et le plus gros existe déjà', 9),
    ('10', 'Les trois marchés que la restructuration ouvre', 10),
    ('11', 'Les projections : deux scénarios', 11),
    ('12', 'Structure de financement et facteurs de risque', 12),
    ('13', 'La méthode et les sources', 13),
    ('14', 'Synthèse', 14),
]
toc = ''.join(
    f'<div class="toci"><span class="n">{n}</span><span class="t">{t}</span>'
    f'<span class="d"></span><span class="p">{p}</span></div>' for n, t, p in SOMMAIRE)

P.append(f"""<div class="page cover">
  <div class="mark">LASCLAY</div><div class="rule"></div>
  <div class="ctype">MÉMO EXPLICATIF</div>
  <h1>Prévisions financières<br>2026-2029</h1>
  <div class="sub">Ce que le modèle contient, sur quoi il repose, et ce que la
    restructuration de 2026 change à la trajectoire.</div>

  <div class="cfig">
    <div><span class="v">1,10 M$</span><span class="k">Revenu FY2026</span></div>
    <div><span class="v">2,79 M$</span><span class="k">Ventes nettes visées FY2029</span></div>
    <div><span class="v">FY2028</span><span class="k">Rentable hors aides publiques</span></div>
    <div><span class="v">70 000</span><span class="k">Clients depuis 2020</span></div>
  </div>

  <div class="ctitle">CE QUE CONTIENT CE DOCUMENT</div>
  <div class="toc">{toc}</div>

  <div class="cnote">Deux scénarios coexistent dans le même modèle : conservateur
    réaliste, qui porte les ventes nettes à 2,79 M$ en FY2029, et ambitieux, qui les
    porte à 3,41 M$. Une seule cellule bascule de l'un à l'autre. Ni l'un ni l'autre
    n'inclut de subvention non confirmée.</div>

  <div class="meta">LES PRODUITS LASCLAY INC. &nbsp;·&nbsp; QUÉBEC (LIMOILOU)
    &nbsp;·&nbsp; 30 JUILLET 2026<br>Exercices financiers clos le 31 août ·
    Modèle mensuel de 48 mois rapproché de QuickBooks</div>
</div>""")

# ------------------------------------------------------------------ 01 CONTEXTE
P.append(f"""<div class="page">
  <div class="kicker">La matière et la filière</div>
  <div class="sect"><span class="num">01</span><h2>L’asclépiade, la filière et ses échecs</h2></div>
  <div class="lede">Ce qu’est l’asclépiade, pourquoi sa culture est un mécanisme de
    conservation, et pourquoi personne n’a réussi à la commercialiser avant.</div>

  <h3>La plante</h3>
  <p>L’asclépiade commune (<em>Asclepias syriaca</em>) est une vivace indigène
  d’Amérique du Nord, longtemps éliminée comme mauvaise herbe et aujourd’hui cultivée
  commercialement au Québec, à une échelle unique au monde. Ses follicules produisent
  une soie dont la fibre est creuse et <strong>vide à 80 %</strong> : elle emprisonne
  l’air, ce qui la rend isolante, légère, hydrophobe, antibactérienne et imputrescible.
  La Chaire de recherche industrielle sur les matériaux innovants en composites de
  l’Université de Sherbrooke la décrit comme <strong>20 % plus chaude que le duvet
  d’oie</strong> à poids égal.</p>

  <div class="two">
    <div class="card v"><h4>Un mécanisme de conservation mesuré</h4>
      <p style="font-size:8.7pt;margin:0">L’asclépiade est l’unique plante hôte des
      chenilles du monarque, espèce inscrite comme en voie de disparition au Canada.
      Les colonies mexicaines ont frôlé l’extinction en 2014, puis ont atteint
      <strong>leur plus haut niveau en vingt ans</strong> après la plantation de plus de
      1 000 hectares d’asclépiade au Québec, en Ontario et aux États-Unis. Le levier
      n’est pas militant, il est économique : un pilier écosystémique qui ne se restaure
      que si sa culture devient payante.</p></div>
    <div class="card v"><h4>Une ressource comparable à aucune autre</h4>
      <p style="font-size:8.7pt;margin:0">Contrairement aux synthétiques fossiles, elle
      est renouvelable et sa culture stocke du carbone. Contrairement au duvet, à la
      laine et à la fourrure, elle ne dépend d’aucun élevage. Contrairement au kapok,
      elle est locale et pousse densément. Contrairement au PLA, elle occupe des terres
      marginales sans concurrencer l’alimentaire. Contrairement au coton, elle pousse en
      région nordique sans irrigation, sans engrais et sans insecticide.</p></div>
  </div>

  <h3>Dix ans de tentatives, et pourquoi elles ont échoué</h3>
  <table>
    <tr><th>Année</th><th style="text-align:left">Ce qui s’est passé</th></tr>
    <tr><td style="text-align:left">2014</td><td style="text-align:left">La Coopérative
      Monark réunit un premier groupe de cultivateurs, qui consacrent au plus 10 % de
      leur terre à l’asclépiade. Protec-Style démarre une usine de transformation.</td></tr>
    <tr><td style="text-align:left">2011-2017</td><td style="text-align:left">Deux
      tentatives de récolteuse mécanisée échouent. Sans mécanisation, la culture à
      grande échelle n’est pas rentable et des cultivateurs rasent leurs champs.</td></tr>
    <tr><td style="text-align:left">2017</td><td style="text-align:left">Quartz co.
      lance le premier parka isolé à 50 % d’asclépiade. Vif succès, à près de 1 000 $
      l’unité.</td></tr>
    <tr class="hio"><td style="text-align:left">2017</td><td style="text-align:left">
      Protec-Style fait faillite, faute d’approvisionnement. Quartz discontinue son
      parka faute de matière. L’asclépiade reste étiquetée comme un matériau de
      luxe.</td></tr>
    <tr><td style="text-align:left">Depuis</td><td style="text-align:left">L’héritier de
      Protec-Style est Eko-Terre, filiale de Logistik Unicorp. Sa membrane Vegeto
      contient 50 % de PLA, 35 % de kapok et <strong>15 % d’asclépiade</strong> : une
      teneur trop faible pour générer le volume d’achat dont les cultivateurs ont
      besoin.</td></tr>
  </table>

  <p>La fibre explique une partie de ces échecs. Creuse, courte et très lisse, elle se
  casse et ne s’enchevêtre pas, ce qui rend son tissage presque impossible. Elle
  s’organise en non-tissé, mais pas avec des équipements standards : il faut les
  inventer ou les adapter, ce qui décuple les coûts.</p>

  <div class="quote">Le plus grand problème de la filière n’est ni sa jeunesse ni sa
    complexité : c’est son morcellement. Trop d’intermédiaires isolés dans leur champ
    d’expertise, qui collaborent peu ou collaborent mal, et des goulots
    d’étranglement à chaque étape de la chaîne.</div>

  {foot(1)}""")

# ------------------------------------------------------------------ 01 THÈSE
P.append(f"""<div class="page">
  <div class="kicker">Contexte</div>
  <div class="sect"><span class="num">02</span><h2>Ce que disent six ans de ventes</h2></div>
  <div class="lede">En 2020, une publication devient virale. 10 000 inscriptions à
    l'infolettre en deux semaines, 1 000 paires de mitaines vendues avant d'avoir une
    usine. Six ans plus tard, 70 000 clients et 3 M$ cumulés. La demande n'a jamais
    manqué. Ce sont quatre contraintes techniques qui ont empêché de la servir.</div>

  <h3>Ce que Lasclay fait différemment</h3>
  <ul>
    <li><strong>Intégration verticale</strong>, qui permet d’agir aux intersections de la
      chaîne plutôt que sur un seul maillon</li>
    <li><strong>Des procédés adaptés à la fibre</strong>, plutôt que la fibre adaptée aux
      procédés existants</li>
    <li><strong>Les mitaines avant les manteaux</strong> : un produit d’entrée abordable,
      moins cher à fabriquer en volume, qui fait découvrir la matière</li>
    <li><strong>Un lien direct avec des cultivateurs indépendants</strong>, payés environ
      cinq fois le prix du marché</li>
    <li><strong>60 à 80 % d’asclépiade</strong> dans les produits : c’est le volume
      d’achat qui fait vivre la filière</li>
  </ul>

  {bar_chart([('Revenu brut', hist_ca, VERT)], hist_lab, height=160,
             fmt=lambda v: f'{v/1000:.0f} k$')}
  <div class="fig">Revenu brut par exercice. FY2022 selon les registres internes ;
    FY2023 à FY2025 selon les états financiers compilés ; FY2026 selon QuickBooks.
    Marge brute : 44,3 % · 65,5 % · 73,0 % en trois exercices.</div>

  <h3>Quatre contraintes ont empêché de servir cette demande</h3>
  <p>Elles sont techniques et documentées. Chacune fait l'objet d'une section de ce
  mémo, avec les chiffres qui la mesurent et ce qui la lève.</p>
  <div class="verrou"><span class="n">1</span><p><strong>La fibre coûte 85 $ le kilo</strong>,
    contre 4 $ pour la laine. Ce prix ne vient pas d'une rareté mais d'une filière trop
    petite pour mécaniser sa récolte. Le partenariat industriel avec Eko-Terre porte la teneur
    en asclépiade de 15 % à 60 %, ce qui multiplie d'autant le volume d'achat de fibre. <em>Section 05.</em></p></div>
  <div class="verrou"><span class="n">2</span><p><strong>L'isolant se fabrique
    artisanalement.</strong> Le procédé, inventé à l'interne, demandait sept à huit
    personnes en haute saison et n'entre dans aucune usine textile du monde. En rouleau,
    couvrir les besoins d'une année a demandé deux employés pendant deux semaines.
    <em>Section 06.</em></p></div>
  <div class="verrou o"><span class="n">3</span><p><strong>Le marketing et le développement
    des marchés sont restés sous-investis.</strong> Le coût d'acquisition d'un client est
    passé de 20,11 $ à 31,88 $ en un an. Sortir du manufacturier libère le temps et la
    marge qui manquaient. <em>Section 07.</em></p></div>
  <div class="verrou o"><span class="n">4</span><p><strong>Les coûts fixes montaient au
    rythme des ventes.</strong> Usine, loyer, main-d'œuvre de production et abonnements
    logiciels. La structure allégée libère environ 155 000 $ par année. <em>Section 08.</em></p></div>

  <div class="tiles">
    <div class="tile"><div class="v">70 000</div><div class="k">Clients</div>
      <div class="n">3 M$ cumulés depuis 2020</div></div>
    <div class="tile"><div class="v">1,10 M$</div><div class="k">Revenu FY2026</div>
      <div class="n">+25,5 % sur FY2025</div></div>
    <div class="tile o"><div class="v">4 800 $</div><div class="k">Isolant, une année</div>
      <div class="n">contre 91 036 $ en FY2026</div></div>
    <div class="tile o"><div class="v">FY2028</div><div class="k">Rentable hors aides</div>
      <div class="n">et couverture au-dessus de 1,25</div></div>
  </div>
  {foot(2)}""")

# ------------------------------------------------------------------ 02 DEMANDE
P.append(f"""<div class="page">
  <div class="kicker">Preuve de marché</div>
  <div class="sect"><span class="num">03</span><h2>La demande, testée trois fois</h2></div>
  <div class="lede">Trois épreuves distinctes, à six ans d'intervalle, ont mesuré
    l'appétit du marché pour l'asclépiade. Les trois ont répondu la même chose.</div>

  <div class="three">
    <div class="card v"><h4>2020, le départ</h4>
      <p style="font-size:8.6pt;margin:0">Une publication devient virale avant qu'un
      produit existe. <strong>10 000 inscriptions</strong> à l'infolettre en deux
      semaines. 1 000 paires de mitaines vendues en prévente. L'entreprise n'avait ni
      usine, ni stock, ni procédé.</p></div>
    <div class="card v"><h4>Nov. et déc. 2025, le sommet</h4>
      <p style="font-size:8.6pt;margin:0"><strong>Plus de 500 000 $ en deux mois</strong>,
      soit l'équivalent d'un exercice complet deux ans plus tôt. +73 % et +135 % sur
      l'année précédente. Le seul mois de décembre a fait 275 271 $.</p></div>
    <div class="card o"><h4>Mai 2026, l'épreuve du feu</h4>
      <p style="font-size:8.6pt;margin:0">Une vidéo de quarante minutes annonce la fin
      du « fabriqué ici ». La prévente suit trois jours plus tard :
      <strong>82 692 $, 508 commandes, 85,2 % de clients existants</strong>.</p></div>
  </div>

  <h3>L'épreuve du feu, en détail</h3>
  <p>Une marque bâtie sur la fabrication locale annonce qu'elle délocalise son
  assemblage. La décision n'a pas été enterrée dans un communiqué : elle a été annoncée
  dans une vidéo de quarante minutes où le fondateur ouvre les livres, expose le
  raisonnement opérationnel et financier, nomme ce que le choix coûte symboliquement, et
  dit aux clients qu'ils sont libres de partir.</p>

  {bar_chart([('Ventes quotidiennes',
               [124, 245, 112, 1351, 363, 348, 250, 885, 985, 73993, 7319, 1380], VERT)],
             ['21 mai', '22', '23', '24', '25', '26', '27', '28', '29', '30 MAI', '31',
              '1 juin'], height=195,
             fmt=lambda v: f'{v/1000:.0f} k$' if v > 2000 else '')}
  <div class="fig">Ventes brutes quotidiennes, Shopify. Le 30 mai est la journée de
    lancement de la prévente, trois jours après la diffusion de la vidéo.</div>

  <div class="tiles">
    <div class="tile o"><div class="v">82 692 $</div><div class="k">30 mai au 1<sup>er</sup> juin</div>
      <div class="n">508 commandes en trois jours</div></div>
    <div class="tile o"><div class="v">85,2 %</div><div class="k">Clients existants</div>
      <div class="n">425 des 499 acheteurs</div></div>
    <div class="tile"><div class="v">126,52 $</div><div class="k">Panier moyen</div>
      <div class="n">contre 79,92 $ en moyenne</div></div>
    <div class="tile"><div class="v">× 75</div><div class="k">Contre la veille</div>
      <div class="n">73 993 $ le 30, 985 $ le 29</div></div>
  </div>

  <p><strong>Le risque de décrochage de la clientèle est écarté par les faits.</strong>
  Ce ne sont pas de nouveaux clients attirés par une promotion : 85,2 % des acheteurs
  étaient déjà clients, et ils ont dépensé 58 % de plus par commande que la moyenne
  annuelle. La transparence a été traitée comme une raison d'acheter, pas comme un motif
  de rupture.</p>
  {foot(3)}""")

# ------------------------------------------------------------------ 03 JUIN
P.append(f"""<div class="page">
  <div class="kicker">Trésorerie</div>
  <div class="sect"><span class="num">04</span><h2>Juin et juillet 2026 : ce que coûte le manque de trésorerie</h2></div>
  <div class="lede">Le budget publicitaire est tombé à zéro en juillet 2026. L'effet sur
    les ventes se mesure au mois près.</div>

  {combo_chart(MOIS, D['fy26_mois']['ventes'], D['fy26_mois']['pub'])}
  <div class="fig">Exercice FY2026, septembre 2025 à août 2026. Barres : publicité
    numérique réelle (QuickBooks). Ligne : ventes nettes mensuelles.</div>

  <table>
    <tr><th></th><th>Mars</th><th>Avril</th><th>Mai</th><th>Juin</th><th>Juillet</th></tr>
    <tr><td>Publicité numérique</td><td>32 756 $</td><td>6 388 $</td><td>7 688 $</td>
      <td>1 484 $</td><td class="neg">0 $</td></tr>
    <tr><td>Commandes Shopify</td><td>1 276</td><td>764</td><td>968</td>
      <td class="neg">71</td><td class="neg">40</td></tr>
    <tr><td>Mêmes mois, FY2025</td><td>1 450</td><td>2 193</td><td>2 314</td>
      <td>1 272</td><td>672</td></tr>
    <tr class="hi"><td>Ventes nettes</td><td>53 210 $</td><td>42 531 $</td><td>82 783 $</td>
      <td>9 054 $</td><td>2 535 $</td></tr>
    <caption>Taux de conversion : 3,58 % en mai, 0,58 % en juin. Sessions : 25 333
      puis 10 392. Sources : QuickBooks et Shopify.</caption>
  </table>

  <p>Les mêmes mois de l'exercice précédent avaient produit 1 272 et 672 commandes. Ce
  n'est donc ni la saison ni la demande. <strong>La publicité s'est arrêtée faute de
  trésorerie, et les ventes se sont arrêtées avec elle</strong>, à trois semaines de
  décalage.</p>

  <h3>Pourquoi la trésorerie a manqué</h3>
  <div class="two">
    <div class="card o"><h4>Le capital marchand</h4>
      <table style="margin:4px 0 0"><tr><td>Shopify Capital</td><td>202 609 $</td></tr>
      <tr><td>Merchant Growth</td><td>164 870 $</td></tr>
      <tr class="tot"><td>Total au 31 août 2026</td><td>367 479 $</td></tr></table>
      <p style="margin-top:7px;font-size:8.5pt;color:{GRIS}">Shopify Capital prélève
      <strong>28,75 % de chaque dollar vendu</strong>, tous les jours. Plus l'entreprise
      vend, moins il lui reste pour acheter le stock suivant. Un mécanisme procyclique,
      qui punit la croissance.</p></div>
    <div class="card o"><h4>Ce qu'il en restait au 30 juin</h4>
      <table style="margin:4px 0 0"><tr><td>Encaisse</td><td>{fr(S['encaisse_juin'])}</td></tr>
      <tr><td>Marge EDC autorisée</td><td>150 000 $</td></tr>
      <tr><td>Tirée au 30 juillet</td><td>{fr(S['edc_juil'])}</td></tr>
      <tr class="tot"><td>Coussin restant</td><td class="neg">{fr(S['coussin'])}</td></tr></table>
      <p style="margin-top:7px;font-size:8.5pt;color:{GRIS}">En un mois, juillet, la
      marge a été tirée de 59 475 $ de plus, dans le mois le plus mort de l'année.</p></div>
  </div>

  <p style="margin-top:6px">Le manque à gagner : <strong>117 037 $</strong> de ventes
  brutes en juin et juillet 2025, contre <strong>15 466 $</strong> aux mêmes mois de
  2026. Plus de 100 000 $ perdus, faute de 40 000 $ de publicité.</p>
  {foot(4)}""")

# ------------------------------------------------------------------ 04 VERROU 1
P.append(f"""<div class="page">
  <div class="kicker">Approvisionnement</div>
  <div class="sect"><span class="num">05</span><h2>Le coût de la fibre et le maillage industriel</h2></div>
  <div class="lede">L'asclépiade se vend 85 $ le kilo. C'est ce prix qui la fait
    percevoir comme un matériau de luxe et qui ferme les marchés de volume. Il n'a rien
    d'inévitable.</div>

  {fibre_chart()}
  <div class="fig">Prix indicatif au kilo des principaux isolants textiles, échelle
    logarithmique. À poids égal, la soie d'asclépiade est décrite comme 20 % plus chaude
    que le duvet d'oie par la Chaire de recherche industrielle sur les matériaux
    innovants en composites de l'Université de Sherbrooke.</div>

  <h3>Le cercle vicieux, expliqué</h3>
  <p>Le prix de l'asclépiade ne reflète pas une rareté ni une limite physique. Il reflète
  une filière qui n'a jamais atteint le volume qui justifierait de mécaniser la récolte.
  Les cultivateurs récoltent avec des moyens partiellement manuels parce que le volume
  d'achat ne paie pas l'équipement ; le volume d'achat reste faible parce que le prix
  ferme les marchés de volume.</p>

  <div class="card dark" style="margin:12px 0">
    <h4>Ce qui casse le cercle</h4>
    <p style="margin:0;font-size:8.8pt">Le seul autre transformateur industriel
    d'asclépiade au Canada, <strong>Eko-Terre</strong> (Cowansville, fondée par Louis
    filiale de Logistik Unicorp et héritière de Protec-Style), fabrique la membrane
    Vegeto, utilisée dans les uniformes de la <strong>Garde côtière canadienne</strong>
    et de <strong>Postes Canada</strong>. Sa composition est de 50 % de PLA, 35 % de
    kapok et <strong>15 % d'asclépiade</strong> : ses marchés institutionnels
    fonctionnent par appel d'offres au plus bas soumissionnaire, ce qui interdit une
    teneur plus élevée. Le projet commun vise <strong>60 % d'asclépiade</strong>. Quadrupler la
    teneur multiplie d'autant le volume d'achat de fibre, précisément le volume qui rend la
    mécanisation rentable et qui fait baisser le coût.</p>
  </div>

  <h3>Ce que Lasclay apporte, et ce que ça donne</h3>
  <div class="two">
    <div>
      <ul>
        <li>Lasclay intègre déjà <strong>60 à 80 % d'asclépiade</strong> dans ses
          produits et paie la fibre <strong>cinq fois plus cher</strong> que quiconque,
          directement aux cultivateurs</li>
        <li>Sa clientèle valorise la performance et l'écoresponsabilité au-delà du prix :
          c'est le marché que le maillage apporte à Eko-Terre</li>
        <li><strong>44 nouveaux agriculteurs</strong> ont manifesté leur intérêt à
          cultiver l'asclépiade dans un sondage récent : l'offre agricole existe, elle
          attend un débouché stable</li>
        <li>La membrane est validée : le Groupe CTT a mesuré qu'elle conserve
          <strong>trois fois plus de chaleur que le polyester</strong> à poids égal</li>
      </ul>
    </div>
    <div class="card v">
      <h4>Le développement du réseau agricole</h4>
      <p style="font-size:8.6pt;margin:0">L'expansion des surfaces cultivées est à la
      fois la condition de la baisse des coûts et le cœur de la mission : l'asclépiade
      est l'unique plante hôte du monarque, espèce inscrite comme en voie de disparition
      au Canada. Chaque hectare de plus est un habitat de reproduction.</p>
      <div class="hr"></div>
      <p style="font-size:8.6pt;margin:0">C'est aussi le travail que le modèle
      manufacturier empêchait de faire, faute de temps et de marge. Le verrou nº 3
      et le verrou nº 1 sont le même problème vu de deux côtés.</p>
    </div>
  </div>

  <p style="margin-top:11px">Le financement de ce développement conjoint fait l'objet
  d'une demande au Fonds Vision Topping et s'inscrit dans un montage plus large.
  <strong>Il n'est pas dans les projections financières de ce document</strong>, qui
  restent volontairement conservatrices.</p>
  {foot(5)}""")

# ------------------------------------------------------------------ 05 VERROU 2
P.append(f"""<div class="page">
  <div class="kicker">Production</div>
  <div class="sect"><span class="num">06</span><h2>De la production artisanale à l’isolant en rouleau</h2></div>
  <div class="lede">C'est le verrou central, et celui dont la levée se mesure le plus
    brutalement.</div>

  <p>Depuis 2021, Lasclay fabrique son isolant avec un procédé inventé de toutes pièces :
  machine de mélange conçue sur mesure parce que la fibre est trop légère pour les
  équipements standards, machine de rembourrage cinq à six fois plus rapide que le
  travail manuel, matelasseuses domestiques modifiées mécaniquement et logiciellement
  pour accepter l'asclépiade. Le matelassage d'une paire est passé de 55 minutes à
  quelques minutes. Plus de quarante produits sont sortis de cette ligne.</p>

  <p>C'était la bonne décision : l'usine de transformation qui existait au Québec avait
  fermé en 2015, laissant les cultivateurs sans débouché, et personne ne savait travailler
  la fibre. Mais le procédé reste artisanal dans son essence. Il demande sept à huit
  personnes en haute saison, il ne se met pas à l'échelle, et surtout <strong>il ne
  s'exporte pas</strong> : aucune usine textile étrangère ne peut l'intégrer.</p>

  <h3>Le calcul qui décide de tout</h3>
  {HBAR_MOD}
  <div class="fig">Gauche : coût réel de la main-d'œuvre de production interne en
    FY2026 (QuickBooks, ligne « MOD-Production »). Droite : deux employés pendant deux
    semaines à 30 $/h, ce qu'a demandé la production de l'isolant couvrant les besoins
    de l'exercice 2026-2027.</div>

  <div class="tiles" style="margin-top:6px">
    <div class="tile"><div class="v">−94,7 %</div><div class="k">Main-d'œuvre de production</div>
      <div class="n">91 036 $ → 4 800 $</div></div>
    <div class="tile"><div class="v">7–8 → 2</div><div class="k">Personnes en production</div>
      <div class="n">six mois → deux semaines</div></div>
    <div class="tile o"><div class="v">13 000 $</div><div class="k">Paye aux deux semaines</div>
      <div class="n">ramenée à 4 000 $</div></div>
    <div class="tile o"><div class="v">4 000 $</div><div class="k">Coût par travailleur étranger</div>
      <div class="n">par année, contre 4 000 $ / 3 ans</div></div>
  </div>

  <h3>Ce que le rouleau débloque, au-delà du coût</h3>
  <ul class="o">
    <li><strong>Le transfert de la finition en Tunisie.</strong> L'isolant en rouleau se
      manipule comme n'importe quel textile : il s'expédie, il se coupe, il s'assemble
      dans un atelier qui n'a jamais vu d'asclépiade. C'est ce qui rend le pivot
      manufacturier possible</li>
    <li><strong>L'accès aux usines du monde entier.</strong> Un format standardisé, du
      même genre que le Thinsulate, entre dans n'importe quelle chaîne textile, donc
      dans des partenariats de fabrication et de distribution hors de portée aujourd'hui</li>
    <li><strong>Les marchés institutionnels et de la Défense.</strong> Les Forces armées
      canadiennes ont testé l'asclépiade avec succès en Arctique. Ces marchés exigent un
      matériau normalisé, pas un procédé maison</li>
    <li><strong>La fin d'une dépendance à une seule personne.</strong> Le procédé
      artisanal repose sur une courbe d'apprentissage longue et sur la présence constante
      du fondateur pour réparer les machines</li>
  </ul>

  <h3>Ce qui reste au Québec, sans exception</h3>
  <p>La culture et la transformation de l'asclépiade, la conception des produits, le
  contrôle qualité, les cosmétiques à base d'huile d'asclépiade et les produits volumineux
  (oreillers, coussins). C'est le cœur stratégique et la source de l'avantage : une fibre
  locale que personne d'autre ne maîtrise à cette échelle. Ce qui part, c'est l'assemblage
  textile, une compétence que le Québec a perdue il y a trente ans.</p>
  {foot(6)}""")

# ------------------------------------------------------------------ 06 VERROU 3
P.append(f"""<div class="page">
  <div class="kicker">Mise en marché</div>
  <div class="sect"><span class="num">07</span><h2>Le marketing et le développement des marchés</h2></div>
  <div class="lede">C'est le verrou le moins visible dans un bilan, et probablement le
    plus coûteux : ce que l'entreprise n'a pas pu faire pendant qu'elle faisait tourner
    une usine.</div>

  <div class="quote">Je parle vingt-cinq fois par jour de l'asclépiade. La plupart de mes
    employés n'en ont jamais vu. C'est ça, le paradoxe.
    <cite>GABRIEL GOUVEIA, FONDATEUR</cite></div>

  <p>Une journée type se passe à changer de contexte : deux heures à réparer une machine,
  une heure sur les finances, une heure à écrire une publicité. Une machine brisée a déjà
  coûté une semaine complète. Cette dispersion n'apparaît nulle part dans les états
  financiers, mais elle explique pourquoi trois chantiers à haut rendement sont restés
  sous-investis.</p>

  <h3>Les trois zones d'excellence à réinvestir</h3>
  <div class="three">
    <div class="card v"><h4>Le marché et les segments</h4>
      <p style="font-size:8.5pt;margin:0">Développement des affaires, canal détail,
      international, institutionnel. Le canal détail au Canada, détaillé plus loin, est
      le premier chantier de cette catégorie et il ne demande aucune capacité
      manufacturière.</p></div>
    <div class="card v"><h4>Les produits</h4>
      <p style="font-size:8.5pt;margin:0">Aucun lancement raté en six ans : l'entreprise
      sait quel produit faire. Ce qui manque, c'est le temps de les rendre plus évolués
      et plus performants. Les cosmétiques à l'huile d'asclépiade et les gants isolés
      sont les deux prochains.</p></div>
    <div class="card v"><h4>La notoriété de la fibre</h4>
      <p style="font-size:8.5pt;margin:0">Lasclay est pratiquement seule à faire connaître
      l'asclépiade. Le contenu se produit encore le soir, par le fondateur. Un vrai budget
      de contenu professionnel est un levier direct sur le coût d'acquisition.</p></div>
  </div>

  <h3>Ce que ça vaut en chiffres</h3>
  <p>Le coût d'acquisition d'un client est passé de 20,11 $ en FY2025 à
  <strong>31,88 $ en FY2026</strong>, une hausse de 59 % en un an, pendant que le panier
  moyen montait de 28 %. La marge de contribution par commande couvre encore le coût
  d'acquisition dès la première commande, mais la tendance est le signal que le marketing
  a manqué d'attention, pas de budget.</p>

  <table>
    <tr><th>Acquisition</th><th>FY2025</th><th>FY2026</th><th>Écart</th></tr>
    <tr><td>Nouveaux clients acquis</td><td>11 509</td><td>8 443</td><td class="neg">−26,6 %</td></tr>
    <tr><td>Publicité numérique</td><td>231 500 $</td><td>269 178 $</td><td>+16,3 %</td></tr>
    <tr class="hio"><td>Coût d'acquisition par client</td><td>20,11 $</td><td>31,88 $</td>
      <td class="neg">+58,5 %</td></tr>
    <tr><td>Panier moyen</td><td>56,47 $</td><td>79,92 $</td><td>+41,5 %</td></tr>
    <tr><td>Valeur à vie estimée</td><td>48,76 $</td><td>64,62 $</td><td>+32,5 %</td></tr>
    <tr><td>Valeur à vie / coût d'acquisition</td><td>2,42</td><td>2,03</td><td class="neg">−16,1 %</td></tr>
    <caption>Calculé sur le réel : clients et commandes de Shopify, publicité de
      QuickBooks. La valeur à vie est estimée par série géométrique sur le taux de
      réachat annuel, faute de deux ans d'historique de cohortes.</caption>
  </table>

  <p>La publicité représente 27 % des ventes nettes en FY2026. Ce n'est pas elle qui
  creuse la perte, puisqu'elle se rembourse dès la première commande, mais son rendement
  se dégrade quand personne n'a le temps de l'optimiser. Le canal détail, qui ne consomme
  aucune publicité, réduit structurellement cette dépendance.</p>
  {foot(7)}""")

# ------------------------------------------------------------------ 07 VERROU 4
P.append(f"""<div class="page">
  <div class="kicker">Structure de coûts</div>
  <div class="sect"><span class="num">08</span><h2>Les coûts fixes et l’infrastructure numérique</h2></div>
  <div class="lede">Un modèle où les dépenses montent au même rythme que les ventes ne
    devient jamais rentable, quelle que soit la croissance. C'est exactement ce qui s'est
    produit.</div>

  <div class="quote">On est passés de 500 000 $ à 879 000 $ de ventes. Pour 22 000 $ de
    profit de plus.</div>

  <h3>La structure fixe, avant et après</h3>
  <table>
    <tr><th>Poste</th><th>FY2026 réel</th><th>Après le pivot</th><th>Libéré</th></tr>
    <tr><td>Main-d'œuvre de production</td><td>91 036 $</td><td>4 800 $</td><td>86 236 $</td></tr>
    <tr><td>Loyer de l'atelier</td><td>99 067 $</td><td>≈ 30 000 $</td><td>≈ 69 000 $</td></tr>
    <tr><td>Amortissement équipement et améliorations locatives</td><td>22 167 $</td>
      <td>décroissant</td><td>n. d.</td></tr>
    <tr class="hi"><td>Structure fixe libérée, par année</td><td colspan="2"></td>
      <td>≈ 155 000 $</td></tr>
    <caption>Le modèle financier ne prend pas tout le crédit de la baisse de loyer : il
      retient 88 236 $ en FY2027 et 52 404 $ en FY2029, contre un potentiel de 30 000 $
      en sous-louant l'espace excédentaire. La prudence est volontaire.</caption>
  </table>

  <h3>L'infrastructure numérique : le chantier suivant</h3>
  <p>Une partie de la pile logicielle peut être remplacée par des outils internes, et
  l'entreprise a déjà démontré qu'elle savait le faire.</p>

  <table>
    <tr><th>Poste, FY2026 réel</th><th>Montant</th><th style="text-align:left">Statut</th></tr>
    <tr><td>Frais de plateforme Shopify</td><td>30 540 $</td>
      <td style="text-align:left">Structurel</td></tr>
    <tr><td>Licences logicielles marketing (courriel, SMS)</td><td>8 616 $</td>
      <td style="text-align:left">Migration en préparation</td></tr>
    <tr><td>Outils de gestion et RH</td><td>6 035 $</td>
      <td style="text-align:left">Candidat au remplacement</td></tr>
    <tr><td>Outils de vente en ligne</td><td>5 228 $</td>
      <td style="text-align:left">Candidat au remplacement</td></tr>
    <tr><td>Abonnements logiciels d'exploitation et site web</td><td>1 710 $</td>
      <td style="text-align:left">Structurel</td></tr>
    <tr class="tot"><td>Total de la pile numérique</td><td>52 129 $</td>
      <td style="text-align:left"></td></tr>
  </table>

  <h3>Ce qui est déjà bâti</h3>
  <ul class="o">
    <li><strong>Service client automatisé.</strong> Un système de réponse par IA traite
      la boîte partagée trois fois par jour, dans la voix de la marque. Déployé depuis
      2024, il a triplé le rendement du service à la clientèle avec un taux d'exactitude
      supérieur à 90 %. <strong>Aucune ressource de service client n'est prévue au plan
      d'embauche</strong></li>
    <li><strong>Passerelles d'API internes.</strong> Des services maison relaient déjà
      les opérations vers ShipStation, la plateforme courriel et QuickBooks. L'export
      complet des profils courriel est prêt, ce qui rend la migration hors de la
      plateforme actuelle exécutable</li>
    <li><strong>IA de connaissance interne.</strong> Un assistant conversationnel
      intégrant les savoirs et processus de l'entreprise, créé en 2024, assiste les
      employés dans leurs tâches</li>
    <li><strong>Vision machine à venir.</strong> Le prochain déploiement porte sur le
      manufacturier : uniformiser une fibre volatile, pratiquement impossible à la main
      à grande échelle. C'est le cœur technique du
      projet de membrane à 60 %</li>
  </ul>

  <p>Ces économies ne sont <strong>pas</strong> comptabilisées dans les projections.</p>
  {foot(8)}""")

# ------------------------------------------------------------------ 08 MOTEURS
CROI_A = A['dtc'][3] + A['detail'][3] - A['dtc'][0]
CAGR_C = (C['dtc'][3] / C['dtc'][0]) ** (1 / 3) - 1
CAGR_A = (A['dtc'][3] / A['dtc'][0]) ** (1 / 3) - 1
CAGR_HIST = (hist_ca[4] / hist_ca[0]) ** (1 / 4) - 1
P.append(f"""<div class="page">
  <div class="kicker">D'où vient la croissance</div>
  <div class="sect"><span class="num">09</span><h2>Deux moteurs, et le plus gros existe déjà</h2></div>
  <div class="lede">Le canal détail est le nouveau venu, alors il attire l'attention. Il
    n'apporte pourtant qu'un peu moins de la moitié de la croissance. Le reste vient du
    commerce en ligne, qui a porté seul les six premières années et qui continue de
    croître dans les deux scénarios.</div>

  {moteurs_chart(YR, A['dtc'], A['detail'])}
  <div class="fig">Scénario ambitieux, ventes nettes par moteur. Le commerce en ligne
    passe de {fr(A['dtc'][0])} à {fr(A['dtc'][3])}, soit
    {pct(A['dtc'][3] / A['dtc'][0] - 1, 0)} de plus, pendant que le canal détail se
    construit à partir de zéro.</div>

  <table>
    <tr><th>Croissance FY2026 à FY2029</th><th>Conservateur</th><th>Ambitieux</th></tr>
    <tr><td>Apportée par le commerce en ligne</td>
      <td>{fr(C['dtc'][3] - C['dtc'][0])}</td><td>{fr(A['dtc'][3] - A['dtc'][0])}</td></tr>
    <tr><td>Apportée par le canal détail</td>
      <td>{fr(C['detail'][3])}</td><td>{fr(A['detail'][3])}</td></tr>
    <tr class="hi"><td>Part de la croissance venant du commerce en ligne</td>
      <td>{pct((C['dtc'][3] - C['dtc'][0])
               / (C['dtc'][3] + C['detail'][3] - C['dtc'][0]), 0)}</td>
      <td>{pct((A['dtc'][3] - A['dtc'][0]) / CROI_A, 0)}</td></tr>
    <tr><td>Croissance annuelle du commerce en ligne</td>
      <td>{pct(CAGR_C)}</td><td>{pct(CAGR_A)}</td></tr>
    <caption>À titre de comparaison, le chiffre d'affaires a crû de {pct(CAGR_HIST)} par
      an entre FY2022 et FY2026, entièrement en ligne, sans canal détail, sans isolant en
      rouleau et sans structure de coûts assainie. Les deux scénarios projettent donc un
      rythme en ligne nettement inférieur à celui que l'entreprise a déjà tenu.</caption>
  </table>

  <h3>Ce qui fait croître le commerce en ligne</h3>
  <div class="two">
    <div class="card v"><h4>Une base de clients qui rachète</h4>
      <p style="font-size:8.6pt;margin:0">70 000 clients depuis 2020. Sur la prévente de
      juin 2026, 425 des 499 acheteurs identifiés étaient déjà clients, avec un panier de
      126,52 $ contre 79,92 $ en moyenne annuelle. Cette base se vend sans coût
      d'acquisition.</p></div>
    <div class="card v"><h4>Une acquisition qui redevient finançable</h4>
      <p style="font-size:8.6pt;margin:0">La chute de juin et juillet 2026 vient de
      l'arrêt du budget publicitaire, pas d'une baisse de la demande. Le coût par
      acquisition remonte à {fr(S['cac25'], 2)} dans le modèle, contre
      {fr(S['cac26'], 2)} en FY2026, parce que la marge unitaire assainie permet de
      payer l'acquisition sans vider la trésorerie.</p></div>
  </div>
  <div class="two">
    <div class="card v"><h4>Le marché américain, déjà amorcé</h4>
      <p style="font-size:8.6pt;margin:0">Environ 20 % du chiffre d'affaires récent,
      porté par l'horticole : quelque 250 000 $ de semences vendues en 2025, sur les
      10 millions distribuées en Amérique du Nord. Une semence à 8 $ se vend plus
      facilement qu'un produit à 100 $, et une part notable de ces clients migre ensuite
      vers la gamme textile.</p></div>
    <div class="card v"><h4>Des produits que l'atelier ne pouvait pas faire</h4>
      <p style="font-size:8.6pt;margin:0">L'isolant en rouleau et la finition en Tunisie
      ouvrent des gammes que la production artisanale interdisait, aux volumes et aux
      prix du commerce en ligne. Le catalogue cesse d'être borné par la capacité de deux
      personnes en atelier.</p></div>
  </div>
  {foot(9)}""")

# ------------------------------------------------------------------ 09 DÉBLOQUE
P.append(f"""<div class="page">
  <div class="kicker">Marchés</div>
  <div class="sect"><span class="num">10</span><h2>Les trois marchés que la restructuration ouvre</h2></div>
  <div class="lede">Les quatre verrous levés ouvrent des canaux qui ne dépendent ni du
    budget publicitaire ni de la capacité de l'atelier.</div>

  <h3>1. Le détail au Canada, en consignation</h3>
  <p>Un point de vente majeur par ville moyenne à grande, toute la gamme en dépôt, 40 %
  de marge au détaillant. Ce canal vend sans budget publicitaire et sans dépendre du coût
  par clic, la faiblesse exacte que juin 2026 a mise à nu.</p>

  {ramp_chart(['FY2026', 'FY2027', 'FY2028', 'FY2029'], C['pdv'], A['pdv'])}
  <div class="fig">Points de vente ouverts au 31 août de chaque exercice, dans les deux
    scénarios. Déploiement modélisé mois par mois.</div>

  <table>
    <tr><th>Scénario conservateur</th><th>FY2027</th><th>FY2028</th><th>FY2029</th></tr>
    <tr><td>Points de vente au 31 août</td><td>{C['pdv'][1]:.0f}</td>
      <td>{C['pdv'][2]:.0f}</td><td>{C['pdv'][3]:.0f}</td></tr>
    <tr><td>Vente au détail (prix payé par le consommateur)</td>
      <td>{fr(C['detail'][1]/0.6)}</td><td>{fr(C['detail'][2]/0.6)}</td>
      <td>{fr(C['detail'][3]/0.6)}</td></tr>
    <tr class="hio"><td>Revenu encaissé par Lasclay (60 %)</td><td>{fr(C['detail'][1])}</td>
      <td>{fr(C['detail'][2])}</td><td>{fr(C['detail'][3])}</td></tr>
    <tr><td>Part des ventes nettes</td><td>{pct(C['detail'][1]/C['ventes'][1])}</td>
      <td>{pct(C['detail'][2]/C['ventes'][2])}</td><td>{pct(C['detail'][3]/C['ventes'][3])}</td></tr>
    <tr><td>Stock en consignation immobilisé</td><td>{fr(C['consig'][1])}</td>
      <td>{fr(C['consig'][2])}</td><td>{fr(C['consig'][3])}</td></tr>
    <caption>Le coût des marchandises du canal passe de 33 % à 55 % du revenu encaissé,
      parce que le produit coûte le même prix à fabriquer alors que Lasclay n'encaisse que
      60 % du prix. S'ajoutent 6 % de transport et préparation, 7 % de commission de
      représentation, 800 $ de présentoir par point de vente et un chargé de comptes dès
      FY2028. Tout est dans les prévisions.</caption>
  </table>

  <div class="two">
    <div class="card v"><h4>2. L'international par la membrane</h4>
      <p style="font-size:8.6pt;margin:0">Un isolant en rouleau standardisé entre dans
      n'importe quelle usine textile du monde. L'entreprise a eu des pourparlers avec
      des marques internationales majeures qui s'intéressent à l'asclépiade : sans format
      normalisé, ces conversations ne peuvent pas aboutir. L'Europe et l'Asie sont portées
      par une réglementation environnementale de plus en plus restrictive et une demande
      croissante pour les matériaux biosourcés.</p></div>
    <div class="card v"><h4>3. L'institutionnel et la Défense</h4>
      <p style="font-size:8.6pt;margin:0">La membrane d'Eko-Terre est déjà dans les
      uniformes de la Garde côtière canadienne et de Postes Canada. Les Forces armées
      canadiennes ont testé l'asclépiade avec succès en Arctique. Ces marchés sont
      considérables et aujourd'hui inaccessibles à Lasclay seule. Le maillage industriel
      en est la porte d'entrée.</p></div>
  </div>

  <p>Ces trois marchés s'ajoutent au commerce en ligne, ils ne s'y substituent pas. Seul
  le canal détail figure dans les prévisions : l'international et l'institutionnel se
  négocient sur des cycles trop longs pour être budgétés aujourd'hui, et n'apportent donc
  aucun revenu aux tableaux qui suivent.</p>
  {foot(10)}""")

# ------------------------------------------------------------------ 09 CHIFFRES
P.append(f"""<div class="page">
  <div class="kicker">Projections</div>
  <div class="sect"><span class="num">11</span><h2>Les projections : deux scénarios</h2></div>
  <div class="lede">Un chiffrier mensuel de 48 mois rapproché de QuickBooks compte par
    compte, dont dix mois de FY2026 sont du réel. Une seule cellule bascule d'un scénario
    à l'autre.</div>


  <table>
    <tr><th>Conservateur réaliste</th><th>FY2026</th><th>FY2027</th><th>FY2028</th><th>FY2029</th></tr>
    <tr><td>Ventes nettes</td>{''.join(f'<td>{fr(v)}</td>' for v in C['ventes'])}</tr>
    <tr><td>&nbsp;&nbsp;dont commerce en ligne</td>{''.join(f'<td>{fr(v)}</td>' for v in C['dtc'])}</tr>
    <tr><td>&nbsp;&nbsp;dont canal détail</td>{''.join(f'<td>{fr(v)}</td>' for v in C['detail'])}</tr>
    <tr><td>Marge de contribution</td>{''.join(f'<td>{fr(v)}</td>' for v in C['contrib'])}</tr>
    <tr><td>EBITDA</td>{''.join(f'<td>{fr(v)}</td>' for v in C['ebitda'])}</tr>
    <tr class="hi"><td>Résultat avant impôts</td>{''.join(f'<td>{fr(v)}</td>' for v in C['pai'])}</tr>
    <tr><td>Résultat avant impôts, hors aides publiques</td>
      {''.join(f'<td class="{"neg" if v<0 else ""}">{fr(v)}</td>' for v in C['hors'])}</tr>
    <tr><td>Couverture du service de la dette</td>
      {''.join(f'<td>{v:.2f}</td>'.replace('.', ',') for v in C['dscr'])}</tr>
    <tr><td>Capitaux propres au 31 août</td>
      {''.join(f'<td class="{"neg" if v<0 else ""}">{fr(v)}</td>' for v in C['equity'])}</tr>
  </table>

  <table>
    <tr><th>Ambitieux</th><th>FY2026</th><th>FY2027</th><th>FY2028</th><th>FY2029</th></tr>
    <tr><td>Ventes nettes</td>{''.join(f'<td>{fr(v)}</td>' for v in A['ventes'])}</tr>
    <tr><td>&nbsp;&nbsp;dont commerce en ligne</td>{''.join(f'<td>{fr(v)}</td>' for v in A['dtc'])}</tr>
    <tr><td>&nbsp;&nbsp;dont canal détail</td>{''.join(f'<td>{fr(v)}</td>' for v in A['detail'])}</tr>
    <tr><td>Points de vente au 31 août</td>{''.join(f'<td>{v:.0f}</td>' for v in A['pdv'])}</tr>
    <tr class="hio"><td>Résultat avant impôts</td>{''.join(f'<td>{fr(v)}</td>' for v in A['pai'])}</tr>
    <tr><td>Résultat avant impôts, hors aides publiques</td>
      {''.join(f'<td class="{"neg" if v<0 else ""}">{fr(v)}</td>' for v in A['hors'])}</tr>
    <tr><td>Couverture du service de la dette</td>
      {''.join(f'<td>{v:.2f}</td>'.replace('.', ',') for v in A['dscr'])}</tr>
    <caption>Aucun des deux scénarios n'inclut le PARI-CNRC ni la bourse Vision Topping,
      dont l'obtention n'est pas acquise, ni les économies d'infrastructure numérique.</caption>
  </table>

  <h3>Trois constats</h3>
  <ul>
    <li>Le résultat hors aides publiques devient <strong>positif dès FY2028</strong> en
      scénario conservateur, et dès FY2027 en ambitieux</li>
    <li>La couverture du service de la dette franchit le seuil bancaire de 1,25
      <strong>en FY2028</strong>, et les capitaux propres redeviennent positifs le même
      exercice</li>
    <li>FY2027 reste l'exercice tendu, à {fr(C['dscr'][1],2,'')} de couverture et
      {fr(C['hors'][1])} hors aides. <strong>C'est l'exercice qui a besoin du
      financement</strong></li>
  </ul>

  <p>Les deux moteurs progressent dans les deux lectures. Même en scénario conservateur,
  le commerce en ligne apporte {pct((C['dtc'][3] - C['dtc'][0])
  / (C['dtc'][3] + C['detail'][3] - C['dtc'][0]), 0)} de la croissance de la période et
  le canal détail le reste.</p>
  {foot(11)}""")

# ------------------------------------------------------------------ 10 FINANCEMENT
P.append(f"""<div class="page">
  <div class="kicker">Financement</div>
  <div class="sect"><span class="num">12</span><h2>Structure de financement et facteurs de risque</h2></div>
  <div class="lede">L'essentiel de la demande remplace de la dette coûteuse par de la
    dette normale. Ce n'est pas de l'endettement supplémentaire.</div>

  <table>
    <tr><th>Instrument</th><th>Montant</th><th style="text-align:left">Objet</th></tr>
    <tr><td>Prêt à terme (fonds de roulement et refinancement)</td><td>{fr(S['pret'])}</td>
      <td style="text-align:left">Solder Shopify Capital (202 609 $) et Merchant Growth
      (164 870 $), financer le stock</td></tr>
    <tr><td>Marge de crédit d'exploitation saisonnière</td><td>{fr(S['marge_demandee'])}</td>
      <td style="text-align:left">Couvrir le creux d'automne : le stock s'achète avant de
      se vendre</td></tr>
    <tr><td>Avance de l'actionnaire (15 août 2026)</td><td>80 000 $</td>
      <td style="text-align:left">Remboursable sur 12 mois à 8 %, postposition à
      négocier</td></tr>
    <tr class="hi"><td>Argent neuf net, hors refinancement</td><td>{fr(S['argent_neuf'])}</td>
      <td style="text-align:left">Le reste remplace de la dette existante</td></tr>
  </table>

  <p>Shopify Capital ne se rembourse pas par mensualité mais par prélèvement de 28,75 %
  sur chaque vente, au moment même où l'entreprise devrait accumuler la trésorerie de
  l'automne. Remplacer ces 367 479 $ par un prêt à terme amortissable transforme un
  prélèvement procyclique en une mensualité prévisible.</p>

  <h3>Facteurs de risque</h3>
  <div class="two">
    <div class="card o"><h4>Exécution du déploiement détail</h4>
      <p style="font-size:8.5pt;margin:0">{pct(C['detail'][3]/C['ventes'][3], 0)} des
      ventes de FY2029 reposent sur un canal qui compte <strong>zéro point de vente
      aujourd'hui</strong>. C'est le risque principal du plan. Lasclay s'engage à rapporter
      trimestriellement le nombre de lettres d'intention signées et d'ouvertures
      réalisées.</p></div>
    <div class="card o"><h4>Dépendance à l'assemblage externe</h4>
      <p style="font-size:8.5pt;margin:0">Le transfert vers la Tunisie crée une dépendance
      logistique, un risque de change et de délais. L'isolant et le savoir-faire critiques
      restent au Québec, ce qui limite l'exposition.</p></div>
  </div>
  <div class="two" style="margin-top:11px">
    <div class="card o"><h4>FY2027 sous le seuil bancaire</h4>
      <p style="font-size:8.5pt;margin:0">Couverture de {C['dscr'][1]:.2f} et résultat
      négatif hors aides. Un moratoire de capital de 12 mois, pratique courante de la BDC,
      déplacerait la pression d'un exercice.</p></div>
    <div class="card o"><h4>Capitaux propres négatifs au départ</h4>
      <p style="font-size:8.5pt;margin:0">{fr(C['equity'][0])} au 31 août 2026. Le montage
      a besoin d'une part de capital patient (Prêt d'Honneur subordonné, PARI non
      remboursable) et pas seulement de dette amortissable.</p></div>
  </div>

  <h3>Ce que le modèle ne suppose pas</h3>
  <ul>
    <li>Aucune subvention non confirmée : le PARI-CNRC (75 000 $) et la bourse Vision
      Topping sont exclus. Présenter au CNRC des prévisions qui présument son propre
      financement serait circulaire</li>
    <li>Aucune économie d'infrastructure numérique, alors que 52 129 $ sont sur la table</li>
    <li>Aucun dividende pendant le terme des prêts</li>
    <li>Aucune amélioration du rendement publicitaire : la publicité reste à 22 %, 20,5 %
      puis 19,5 % du revenu brut du commerce en ligne</li>
    <li>Aucune reprise de stock sur le canal détail. Cette hypothèse est favorable : une
      reprise de 5 % coûterait environ 12 000 $ en FY2029</li>
  </ul>
  {foot(12)}""")

# ------------------------------------------------------------------ 11 FIABILITÉ
P.append(f"""<div class="page">
  <div class="kicker">Méthode</div>
  <div class="sect"><span class="num">13</span><h2>La méthode et les sources</h2></div>
  <div class="lede">Une projection ne vaut que par la rigueur de son suivi.</div>

  <h3>Ancrage comptable</h3>
  <p>Le modèle est un chiffrier mensuel de 48 mois, de septembre 2025 à août 2029. Chaque
  compte du grand livre QuickBooks est apparié à une ligne du modèle par son numéro de
  compte. <strong>Dix mois de FY2026 sont du réel</strong>, bilan comme état des
  résultats, collés directement depuis QuickBooks : septembre 2025 à juin 2026. Juillet et
  août restent prévisionnels, parce que la colonne de juillet chez QuickBooks est une photo
  du mois en cours et non un mois fermé.</p>

  <h3>Ce que la révision du 30 juillet 2026 a corrigé</h3>
  <ul>
    <li>Les 76 produits ont été recalés sur les <strong>unités réellement vendues</strong>
      chez Shopify. Le total modélisé de FY2026 reconcilie au revenu QuickBooks à 3 826 $
      près, sur 1,1 M$</li>
    <li>La trajectoire FY2027-FY2029 a été refaite : la version précédente multipliait par
      1,4516 chaque année sans justification par produit ni par canal</li>
    <li>Les coûts variables ont été rebranchés sur le volume, et la structure de coûts
      calibrée sur les trois derniers exercices réalisés plutôt que sur des cibles</li>
    <li>Une seule chaîne de trésorerie sur 48 mois remplace les états parallèles qui
      divergeaient. <strong>La ligne de contrôle du bilan est à zéro sur les 48 mois</strong></li>
    <li>Le mappage des comptes portait cinq défauts qui faisaient disparaître des soldes
      réels, dont 54 266 $ de prêt BDC qui ne tombaient nulle part</li>
    <li>Aucune cellule du classeur n'est en erreur et aucune référence n'est circulaire</li>
  </ul>

  <h3>Éléments en cours de validation</h3>
  <ul class="o">
    <li>Les pertes fiscales reportables (151 649 $) restent un estimé du comptable</li>
    <li>Une vente d'équipement est toujours dans la file « À réviser » de QuickBooks</li>
    <li>Le contrat de l'avance de 80 000 $ du 15 août 2026 reste à signer</li>
    <li>Les soldes réels des prêts Accord D, privés et BDC 11K au 31 août 2026 sont à
      confirmer auprès des prêteurs</li>
  </ul>

  <h3>Sources</h3>
  <p style="font-size:8.5pt;color:{GRIS}">États financiers compilés FY2023 à FY2025
  (mission de compilation, sans audit ni examen) · QuickBooks Online pour le réel FY2026 ·
  Shopify pour les ventes, commandes, clients et sessions · Groupe CTT pour les essais
  d'isolation de la membrane · Chaire de recherche industrielle sur les matériaux innovants en composites de l'Université de Sherbrooke pour la comparaison au duvet · World Wildlife Fund-México pour les colonies de monarques ·
  registre public des espèces en péril du gouvernement du Canada pour le statut du
  monarque.</p>
  {foot(13)}""")

# ------------------------------------------------------------------ 12 CONCLUSION
P.append(f"""<div class="page">
  <div class="sect"><span class="num">14</span><h2>Synthèse</h2></div>

  <p>Lasclay a franchi les étapes les plus difficiles d'une entreprise pionnière :
  apprendre une matière que personne ne maîtrisait, bâtir une demande de 70 000 clients,
  porter la marge brute de 44 % à 73 %, et atteindre la rentabilité en FY2025. Ce qui
  bloque n'est pas le marché.</p>

  <p>Ce sont quatre contraintes techniques, et elles tombent ensemble. Le coût de la fibre
  descend quand le volume d'achat triple. L'isolant devient un produit industriel en
  rouleau : <strong>4 800 $ de main-d'œuvre pour couvrir une année entière, contre
  91 036 $</strong>. L'énergie du fondateur revient au marché, aux produits et à la
  filière agricole. Et la structure fixe libère environ 155 000 $ par année, sans compter
  les 52 129 $ d'infrastructure numérique qui ne sont même pas dans les projections.</p>

  <p>Le risque que ce virage ferait fuir la clientèle a été testé grandeur nature en mai
  2026 : trois jours après une vidéo de transparence de quarante minutes, la prévente a
  fait 82 692 $ avec 85,2 % de clients existants et un panier supérieur de 58 % à la
  moyenne. La communauté a jugé, et elle a acheté.</p>

  <p>La trajectoire ne repose pas sur un pari unique. Le commerce en ligne, qui a porté
  seul les six premières années, apporte {pct((C['dtc'][3] - C['dtc'][0])
  / (C['dtc'][3] + C['detail'][3] - C['dtc'][0]), 0)} de la progression dans la lecture
  prudente, en croissant de {pct(CAGR_C)} par an, soit la moitié du rythme tenu depuis
  FY2022. Le canal détail apporte le reste. Un déploiement en magasin plus lent que prévu
  ralentit la trajectoire sans l'annuler.</p>

  <div class="tiles" style="margin:20px 0">
    <div class="tile"><div class="v">{fr(S['pret'], 0, '')} $</div>
      <div class="k">Prêt à terme demandé</div>
      <div class="n">dont 367 479 $ de refinancement</div></div>
    <div class="tile"><div class="v">{fr(S['marge_demandee'], 0, '')} $</div>
      <div class="k">Marge saisonnière</div><div class="n">creux d'automne</div></div>
    <div class="tile o"><div class="v">{fr(S['argent_neuf'], 0, '')} $</div>
      <div class="k">Argent neuf net</div><div class="n">le reste remplace de la dette</div></div>
    <div class="tile o"><div class="v">FY2028</div><div class="k">Rentable hors aides</div>
      <div class="n">et couverture au-dessus de 1,25</div></div>
  </div>

  <p>Le financement sert à traverser <strong>FY2027</strong>, seul exercice où la
  couverture reste sous le seuil bancaire.
  À partir de FY2028, l'exploitation porte son service de la dette, les capitaux propres
  redeviennent positifs, et l'entreprise cesse de dépendre des aides publiques pour
  afficher un résultat positif.</p>

  <div class="quote" style="margin-top:20px;font-size:12.5pt">Ce qui change, c'est la
    manière de produire. Ce qui ne change pas, c'est pourquoi nous existons : rendre
    l'asclépiade utile et désirable pour que sa culture redevienne viable, et redonner
    ainsi de l'habitat au monarque.</div>

  <div style="margin-top:22px;padding-top:11px;border-top:1px solid {LIGNE};
    font-size:7.7pt;color:{GRIS}">
    Mémo préparé à des fins d'information pour les partenaires financiers de Les
    Produits Lasclay inc. Les données historiques proviennent d'états
    financiers compilés (mission de compilation, sans audit ni examen) et de QuickBooks
    Online. Les données de ventes, de commandes et de clients proviennent de Shopify. Les
    projections 2026 à 2029 sont fondées sur des hypothèses internes documentées dans le
    modèle financier et ne constituent pas une garantie de résultats futurs. Les repères
    de performance de la fibre décrivent la matière en laboratoire et non un produit fini.
  </div>
  {foot(14)}""")

html = CSS + ''.join(P)

# Les espaces de milliers deviennent des espaces insécables : « 1 000 paires » ne
# doit pas se couper en fin de ligne. Les blocs SVG sont laissés intacts, leurs
# attributs contenant des suites de nombres séparés par des espaces.
def _nbsp(part):
    return re.sub(r'(?<=\d) (?=\d{3}(?!\d))', '\u202f', part)


_out, _last = [], 0
for _m in re.finditer(r'<svg.*?</svg>', html, re.S):
    _out.append(_nbsp(html[_last:_m.start()]))
    _out.append(_m.group(0))
    _last = _m.end()
_out.append(_nbsp(html[_last:]))
html = ''.join(_out)

from pathlib import Path
import subprocess
Path('note_bailleurs.html').write_text(
    '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    '<title>Lasclay · Prévisions financières 2026-2029 · mémo explicatif</title></head><body>'
    + html + '</body></html>', encoding='utf8')
CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
subprocess.run([CHROME,'--headless','--disable-gpu','--no-sandbox','--no-pdf-header-footer',
  '--run-all-compositor-stages-before-draw','--virtual-time-budget=8000',
  '--print-to-pdf=Lasclay - Previsions financieres 2026-2029 - memo explicatif.pdf',
  'file://'+str(Path('note_bailleurs.html').resolve())],check=True,capture_output=True)
print('PDF produit')
