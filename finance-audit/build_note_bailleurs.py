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
                       f'height="{max(hd, 1.5):.1f}" fill="{ORANGE}" rx="1.5"/>')
            if hd >= 14:
                out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hw - hd / 2 + 4:.1f}" '
                           f'class="bv" fill="#ffffff">{d / 1000:.0f} k$</text>')
        if i:
            # La virgule décimale ne se pose que sur le libellé : appliquée à la
            # chaîne entière, elle corromprait les coordonnées du SVG.
            g = f'en ligne {(web[i] / web[i - 1] - 1) * 100:+.0f} %'.replace('.', ',')
            out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hw - hd - 20:.1f}" '
                       f'class="bv" fill="{VERT}">{g}</text>')
        if hd >= 14:
            out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hw - hd - 7:.1f}" '
                       f'class="bv">{(w + d) / 1000:.0f} k$ au total</text>')
    for i, lab in enumerate(labels):
        out.append(f'<text x="{i * gw + gw / 2:.1f}" y="{height - 10}" '
                   f'class="bl">{lab}</text>')
    out.append('</svg>')
    return ''.join(out) + legend([('Commerce en ligne', VERT),
                                  ('Canal détail (consignation)', ORANGE)])


def mois_chart(labels, valeurs, width=680, height=175):
    """Douze mois de consignation, en barres. La saison se voit d'un coup."""
    top = max(valeurs) or 1
    y0, yt = height - 26, 24
    gw = width / len(valeurs)
    bw = gw * 0.56
    out = [f'<svg viewBox="0 0 {width} {height}" class="chart">']
    out.append(f'<line x1="0" y1="{y0}" x2="{width}" y2="{y0}" stroke="{LIGNE}"/>')
    for i, v in enumerate(valeurs):
        x = i * gw + (gw - bw) / 2
        h = v / top * (y0 - yt)
        out.append(f'<rect x="{x:.1f}" y="{y0 - h:.1f}" width="{bw:.1f}" '
                   f'height="{max(h, 0.6):.1f}" fill="{ORANGE}" rx="1.5"/>')
        if v:
            # le libellé se compose à part : appliqué à la chaîne entière, le
            # remplacement du point décimal corromprait les coordonnées du SVG
            lab = (f'{v / 1000:.1f} k$'.replace('.', ',') if v >= 1000
                   else f'{v:.0f} $')
            out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - h - 6:.1f}" '
                       f'class="bv">{lab}</text>')
    for i, lab in enumerate(labels):
        out.append(f'<text x="{i * gw + gw / 2:.1f}" y="{height - 8}" '
                   f'class="bl">{lab}</text>')
    out.append('</svg>')
    return ''.join(out)


def cercle_chart(width=680, height=214):
    """Le cercle vicieux de la filière, en quatre étapes qui se referment.

    Quatre boîtes en losange plutôt qu'en ligne : la disposition dit d'elle-même
    que la dernière étape ramène à la première, ce qu'une liste ne dit pas. Les
    flèches vont d'un bord à l'autre, dans le sens horaire."""
    etapes = [
        ('Marché trop petit', 'aucun acheteur de volume'),
        ('Pas d’investissement', 'mécaniser ne se rentabilise pas'),
        ('Pas de récolte substantielle', 'cinq hectares au mieux'),
        ('Prix élevé', 'tout amortir sur peu de kilos'),
    ]
    bw, bh = 210, 54
    cx, cy = width / 2, height / 2
    # haut, droite, bas, gauche
    coins = [(cx - bw / 2, 0), (width - bw, cy - bh / 2),
             (cx - bw / 2, height - bh), (0, cy - bh / 2)]
    mil = [(x + bw / 2, y + bh / 2) for x, y in coins]

    def bord(i, dx, dy):
        """Point sur le bord d'une boîte : dx/dy valent -1, 0 ou 1."""
        return (mil[i][0] + dx * bw / 2, mil[i][1] + dy * bh / 2)

    # de la boîte i vers la suivante, en sortant par le bord qui la regarde
    liens = [(bord(0, 1, 0), bord(1, 0, -1)), (bord(1, 0, 1), bord(2, 1, 0)),
             (bord(2, -1, 0), bord(3, 0, 1)), (bord(3, 0, -1), bord(0, -1, 0))]

    out = [f'<svg viewBox="0 0 {width} {height}" class="chart">',
           f'<defs><marker id="fl" markerWidth="8" markerHeight="8" refX="7" refY="4" '
           f'orient="auto"><path d="M0,0.5 L8,4 L0,7.5 z" fill="{ORANGE}"/></marker>'
           f'</defs>']
    for (x1, y1), (x2, y2) in liens:
        # on raccourcit des deux bouts pour ne pas coller aux boîtes
        d = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        ux, uy = (x2 - x1) / d, (y2 - y1) / d
        out.append(f'<line x1="{x1 + ux * 9:.1f}" y1="{y1 + uy * 9:.1f}" '
                   f'x2="{x2 - ux * 11:.1f}" y2="{y2 - uy * 11:.1f}" '
                   f'stroke="{ORANGE}" stroke-width="1.7" marker-end="url(#fl)"/>')
    for (x, y), (titre, sous) in zip(coins, etapes):
        out.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{bw}" height="{bh}" '
                   f'fill="{VERT_PALE}" stroke="{VERT}" stroke-width="1" rx="3"/>')
        out.append(f'<text x="{x + bw / 2:.0f}" y="{y + 25:.0f}" class="bv" '
                   f'fill="{INK}" style="font-size:8.8pt">{titre}</text>')
        out.append(f'<text x="{x + bw / 2:.0f}" y="{y + 42:.0f}" class="bl" '
                   f'fill="{GRIS}">{sous}</text>')
    out.append('</svg>')
    return ''.join(out)


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
        # « 85,0 $ » sur un prix rond se lit mal : la décimale ne sert qu'au 0,50 $.
        # Nom distinct de `lab`, qui porte le nom du matériau dans cette boucle.
        prix = (f'{v:.2f}'.rstrip('0').rstrip('.') or '0').replace('.', ',')
        out.append(f'<text x="{x + bw / 2:.1f}" y="{y0 - hh - 6:.1f}" class="bv">'
                   f'{prix} $</text>')
        out.append(f'<text x="{x + bw / 2:.1f}" y="{height - 10}" class="bl">{lab}</text>')
    out.append('</svg>')
    return ''.join(out)

# ---------------------------------------------------------------- contenu
YR = ['2025-2026', '2026-2027', '2027-2028', '2028-2029']
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

.cover {{ background: {INK}; color: #fff; padding: 22mm 22mm 22mm; }}
.cover .mark {{ font-family:'Bitstream Charter',Georgia,serif; font-size:23pt;
  letter-spacing:.30em; font-weight:700; }}
.cover .ctype {{ font-size:7.6pt; letter-spacing:.24em; color:{ORANGE}; font-weight:700;
  margin-bottom:14px; }}
.cover .cfig {{ display:flex; gap:0; margin:40px 0 40px; border-top:1px solid #3a4b45;
  border-bottom:1px solid #3a4b45; }}
.cover .cfig > div {{ flex:1; padding:14px 14px 14px 0; }}
.cover .cfig .v {{ display:block; font-family:'Bitstream Charter',Georgia,serif;
  font-size:19pt; color:#fff; line-height:1.05; }}
.cover .cfig .k {{ display:block; font-size:7.3pt; letter-spacing:.09em;
  text-transform:uppercase; color:#8fa39d; margin-top:6px; }}
.cover .cnote {{ margin-top:20px; padding-top:12px; border-top:1px solid #3a4b45;
  font-size:8.6pt; color:#a8b8b3; line-height:1.6; max-width:46em; }}
.cover .ctitle {{ font-size:7.4pt; letter-spacing:.2em; color:#8fa39d; margin-bottom:10px; }}
.cover .toc {{ column-count:2; column-gap:26px; }}
.toci {{ display:flex; align-items:baseline; font-size:8.4pt; color:#d6dedb;
  margin-bottom:5px; break-inside:avoid; }}
.toci .n {{ font-family:'Bitstream Charter',Georgia,serif; color:{ORANGE}; width:20px;
  flex:0 0 20px; }}
.toci .t {{ flex:0 1 auto; }}
.toci .d {{ flex:1 1 auto; border-bottom:1px dotted #4a5a55; margin:0 5px 3px; min-width:8px; }}
.toci .p {{ color:#8fa39d; }}
.cover .rule {{ width:54px; height:3px; background:{ORANGE}; margin:18px 0 26px; }}
.cover h1 {{ font-size:34pt; line-height:1.1; margin:0 0 14px; }}
.cover .sub {{ font-size:11.5pt; color:{VERT_CLAIR}; max-width:30em; line-height:1.5; }}
.cover .meta {{ position:absolute; bottom:14mm; font-size:7.9pt; color:#8d9a95;
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


def foot(n, tot=18):
    return (f'<div class="foot"><span>LASCLAY · PRÉVISIONS FINANCIÈRES 2026-2029</span>'
            f'<span>{n} / {tot}</span></div></div>')


HBAR_MOD = hbar([("Production interne, 2025-2026", 91036, VERT),
                 ("Isolant en rouleau, 2026-2027", 4800, ORANGE)], rowh=46)
hist_lab = ['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026']
# Revenu des états financiers compilés : après escomptes, transport de vente
# compris. Le dernier point vient du modèle, sur cette même base — pas de la
# ligne 3, qui est avant escomptes et qui a perdu le canal détail quand les
# ventes des Défricheuses ont été reclassées.
hist_ca = [280000, 403702, 504926, 879125, D['revenu_total_fy26']]

P = []   # les pages

# ------------------------------------------------------------------ COUVERTURE
SOMMAIRE = [
    ('01', 'L’asclépiade, et ce qu’elle vaut', 1),
    ('02', 'Pourquoi tout le monde a échoué avant', 2),
    ('03', 'Pourquoi nous, et pourquoi ça continue', 3),
    ('04', 'Ce que disent six ans de ventes', 4),
    ('05', 'La demande, testée trois fois', 5),
    ('06', 'Juin et juillet 2026 : le coût du manque de trésorerie', 6),
    ('07', 'Le coût de la fibre, et le réseau qui le fera baisser', 7),
    ('08', 'De la production artisanale à l’isolant en rouleau', 8),
    ('09', 'Le marketing et le développement des marchés', 9),
    ('10', 'Les coûts fixes et l’infrastructure numérique', 10),
    ('11', 'Deux moteurs, et le plus gros existe déjà', 11),
    ('12', 'Le détail au Canada, construit ville par ville', 12),
    ('13', 'Les quarante villes, et le calendrier', 13),
    ('14', 'Trois marchés qui ne sont pas dans les chiffres', 14),
    ('15', 'Les projections : deux scénarios', 15),
    ('16', 'Structure de financement et facteurs de risque', 16),
    ('17', 'La méthode et les sources', 17),
    ('18', 'Synthèse', 18),
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
    <div><span class="v">{fr(hist_ca[4] / 1e6, 2, '')} M$</span><span class="k">Revenu 2025-2026</span></div>
    <div><span class="v">{f"{C['ventes'][3]/1e6:.2f}".replace('.', ',')} M$</span><span class="k">Ventes nettes visées 2028-2029</span></div>
    <div><span class="v">2027-2028</span><span class="k">Rentable hors aides publiques</span></div>
    <div><span class="v">70 000</span><span class="k">Clients depuis 2020</span></div>
  </div>

  <div class="ctitle">CE QUE CONTIENT CE DOCUMENT</div>
  <div class="toc">{toc}</div>

  <div class="cnote">Deux scénarios dans le même modèle, qu'une seule cellule bascule :
    conservateur réaliste à {f"{C['ventes'][3]/1e6:.2f}".replace('.', ',')} M$ de ventes
    nettes en 2028-2029, ambitieux à
    {f"{A['ventes'][3]/1e6:.2f}".replace('.', ',')} M$. Ni l'un ni l'autre n'inclut de
    subvention non confirmée.</div>

  <div class="meta">LES PRODUITS LASCLAY INC. &nbsp;·&nbsp; QUÉBEC (LIMOILOU)
    &nbsp;·&nbsp; 30 JUILLET 2026<br>Exercice financier du 1<sup>er</sup> septembre au
    31 août : « 2025-2026 » couvre septembre 2025 à août 2026 · Modèle mensuel de
    48 mois rapproché de QuickBooks</div>
</div>""")

# ------------------------------------------------------------------ 01 CONTEXTE
P.append(f"""<div class="page">
  <div class="kicker">La matière</div>
  <div class="sect"><span class="num">01</span><h2>L’asclépiade, et ce qu’elle vaut</h2></div>
  <div class="lede">Une fibre que personne n’a réussi à commercialiser, non pas faute
    d’acheteurs, mais faute d’avoir su la récolter.</div>

  <h3>La plante</h3>
  <p>L’asclépiade commune (<em>Asclepias syriaca</em>) est une vivace indigène
  d’Amérique du Nord, longtemps éliminée comme mauvaise herbe et aujourd’hui cultivée
  commercialement au Québec, à une échelle unique au monde. Ses follicules produisent
  une soie dont la fibre est creuse et <strong>vide à 80 %</strong> : elle emprisonne
  l’air, ce qui la rend isolante, légère, hydrophobe, antibactérienne et imputrescible.
  La Chaire de recherche industrielle sur les matériaux innovants en composites de
  l’Université de Sherbrooke la décrit comme <strong>20 % plus chaude que le duvet
  d’oie</strong> à poids égal, et le Groupe CTT a mesuré qu’elle conserve
  <strong>trois fois plus de chaleur que le polyester</strong>.</p>

  {fibre_chart()}
  <div class="fig">Prix indicatif au kilo des principaux isolants textiles, échelle
    logarithmique. L’asclépiade se vend au prix du duvet pour une performance
    supérieure, ce qui la classe parmi les matériaux de luxe et lui ferme les marchés de
    volume.</div>

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

  <div class="quote">La demande a toujours été là. De grands joueurs de partout dans le
    monde se sont intéressés à l’asclépiade. Tous les échecs ont été dus à des déficits
    technologiques au niveau agricole.
    <div style="font-size:8pt;margin-top:7px;font-style:normal">Ghyslain Bouchard,
    directeur général de la division asclépiade d’Eko-Terre, quarante-cinq ans de
    carrière dans le textile, mars 2026</div></div>
  {foot(1)}""")

# ------------------------------------------------------------------ 01b ÉCHECS
P.append(f"""<div class="page">
  <div class="kicker">La filière</div>
  <div class="sect"><span class="num">02</span><h2>Pourquoi tout le monde a échoué avant</h2></div>
  <div class="lede">Dix ans de tentatives, et toujours le même mur. Il n’est ni
    commercial ni technique du côté de l’usine : il est agricole.</div>

  <h3>La demande n’a jamais manqué</h3>
  <p>La Garde côtière canadienne et Postes Canada ont habillé leur personnel de vêtements
  isolés à l’asclépiade. Les Forces armées canadiennes l’ont testée avec succès en
  Arctique. En 2017, Quartz co. a lancé le premier parka isolé à l’asclépiade à près de
  1 000 $ l’unité : vif succès. Chaque fois que la matière est mise en marché, elle
  trouve preneur.</p>

  <h3>Le piège de la fenêtre de récolte</h3>
  <p>L’asclépiade se récolte dans une fenêtre <strong>d’à peine deux semaines</strong>,
  quand les follicules sont mûrs et pas encore ouverts. La filière s’est construite sur
  le modèle que connaissent les agriculteurs québécois : de grandes surfaces, de la
  grosse machinerie. Deux semaines suffisent pourtant à récolter au plus
  <strong>cinq hectares</strong> à la main ou avec de petites machines. Au-delà, il
  faudrait une récolteuse qui n’existe pas : deux tentatives ont échoué entre 2011 et
  2017, et depuis personne ne recommence, faute d’un marché assez grand pour la
  rentabiliser.</p>

  {cercle_chart()}
  <div class="fig" style="margin-bottom:12px">Aucun des acteurs ne peut rompre ce cercle
    depuis sa position : le cultivateur ne crée pas le marché, et l’usine ne cultive
    pas.</div>

  <p>Le reste suit. Les cultivateurs sèment grand, n’arrivent pas à récolter et
  abandonnent un par un. Protec-Style fait faillite en 2017 faute d’approvisionnement,
  Quartz co. discontinue son parka faute de matière. L’asclépiade reste étiquetée comme
  un matériau de luxe, non parce qu’elle est rare, mais parce que son prix doit porter
  l’amortissement de ceux qui n’arrivent pas à en vendre.</p>

  <h3>La moitié industrielle du problème est réglée</h3>
  <p>Eko-Terre, à Cowansville, y a consacré ses efforts depuis 2019. Les techniques
  antérieures brisaient la fibre à l’extraction et la réduisaient en poussière. La clé
  s’est révélée être <strong>le séchage des follicules avant l’extraction</strong> :
  abaisser le taux d’humidité du follicule entier avant de séparer la fibre des graines
  permet de décortiquer sans briser. Ce changement d’ordre a donné la membrane Vegeto,
  un isolant biodégradable sans plastique pétrolier, produit à 200 000 mètres par
  année.</p>

  <div class="quote">J’ai perdu tous mes cultivateurs d’asclépiade. Un nouveau
    cultivateur qui se lance aujourd’hui n’a accès à aucune technologie de récolte, de
    séchage et d’extraction : il doit tout apprendre seul, à ses frais, pendant des
    années.
    <div style="font-size:8pt;margin-top:7px;font-style:normal">Ghyslain Bouchard,
    Eko-Terre, mars 2026</div></div>

  <p style="margin-top:10px">Voilà l’état de la filière : une usine qui sait transformer
  la fibre et manque de matière, des terres disponibles dont les propriétaires ne savent
  pas comment s’y prendre, et personne entre les deux.</p>
  {foot(2)}""")

# ------------------------------------------------------------------ 01c UNICITÉ
P.append(f"""<div class="page">
  <div class="kicker">Ce qui distingue Lasclay</div>
  <div class="sect"><span class="num">03</span><h2>Pourquoi nous, et pourquoi ça continue</h2></div>
  <div class="lede">Tous ceux qui ont échoué étaient excellents dans un maillon. Un
    agronome, une usine, une marque de manteaux. Aucun ne tenait les deux bouts de la
    chaîne en même temps, et c’est entre les maillons que la filière casse.</div>

  <h3>La transdisciplinarité</h3>
  <p>Lasclay va du follicule au colis livré. L’entreprise achète la soie brute à des
  cultivateurs qu’elle connaît par leur prénom, fabrique l’isolant, conçoit les produits,
  gère la marque, vend en ligne et répond au service à la clientèle. Personne d’autre
  dans cette filière ne couvre cette amplitude, et c’est ce qui permet d’agir aux
  intersections plutôt que d’attendre que le maillon voisin se débloque.</p>

  <div class="quote">Gabriel et son équipe ont bâti une entreprise qui maîtrise presque
    toute la chaîne, de la soie d’asclépiade brute jusqu’à la distribution des produits
    finis à des particuliers. Ils comprennent les contraintes de la fibre mieux que
    quiconque. C’est la pièce manquante du puzzle de cette filière.
    <div style="font-size:8pt;margin-top:7px;font-style:normal">Ghyslain Bouchard,
    Eko-Terre, lettre de soutien, mars 2026</div></div>

  <div class="two" style="margin-top:14px">
    <div class="card v"><h4>Une vision moderne du marché</h4>
      <p style="font-size:8.6pt;margin:0">Les projets précédents visaient l’appel
      d’offres institutionnel et le manteau haut de gamme : des marchés qui se gagnent au
      plus bas prix ou se vendent à mille dollars l’unité, et qui laissent la matière
      invisible. Lasclay a fait l’inverse. Une marque grand public, une vente directe,
      une communauté de 70 000 clients, et un produit d’entrée abordable qui fait
      découvrir la fibre avant de vendre le manteau.</p></div>
    <div class="card v"><h4>Des capacités qui manquaient à la filière</h4>
      <p style="font-size:8.6pt;margin:0">Marketing, développement des affaires,
      développement de produit : trois métiers qu’aucun des acteurs précédents n’avait à
      l’interne. Soixante-seize produits au catalogue, une gamme construite du sachet de
      semences à huit dollars jusqu’au manteau, et trois preventes qui ont validé la
      demande avant d’engager la production.</p></div>
  </div>

  <h3>Ce que ça change pour la matière</h3>
  <p>Un transformateur industriel achète la fibre au prix que son client final accepte de
  payer, et ce client est un appel d’offres au plus bas soumissionnaire. Une marque grand
  public achète au prix que sa clientèle accepte de payer, et cette clientèle achète
  justement parce que c’est de l’asclépiade cultivée au Québec. Lasclay peut donc
  soutenir un prix que l’industrie ne peut pas soutenir, et acheter directement aux
  cultivateurs plutôt qu’au bout d’une chaîne d’intermédiaires.</p>

  <p>C’est aussi ce qui rend la suite crédible. Les quatre contraintes techniques
  décrites plus loin se lèvent parce qu’il existe enfin, dans la filière, une entreprise
  qui a à la fois la connaissance de la fibre, le marché qui la paie et les compétences
  commerciales pour le faire croître.</p>
  {foot(3)}""")

# ------------------------------------------------------------------ 01 THÈSE
P.append(f"""<div class="page">
  <div class="kicker">Contexte</div>
  <div class="sect"><span class="num">04</span><h2>Ce que disent six ans de ventes</h2></div>
  <div class="lede">En 2020, une publication devient virale. 10 000 inscriptions à
    l'infolettre en deux semaines, 1 000 paires de mitaines vendues avant d'avoir une
    usine. Six ans plus tard, 70 000 clients et 3 M$ cumulés. Ce sont quatre contraintes
    techniques, et non le marché, qui ont limité la suite.</div>

  <p>Six exercices, une marge brute passée de 44,3 % à 73,0 %, et la rentabilité
  atteinte en 2024-2025. La courbe qui suit est celle d’une entreprise qui a appris à
  fabriquer et à vendre. Ce qu’elle n’a pas encore pu faire, c’est produire à un coût qui
  ouvre les marchés de volume.</p>

  {bar_chart([('Revenu', hist_ca, VERT)], hist_lab, height=160,
             fmt=lambda v: f'{v/1000:.0f} k$')}
  <div class="fig">Revenu par exercice, après escomptes et transport de vente compris —
    la ligne « revenus » d'un état des résultats. 2021-2022 selon les registres internes ;
    2022-2023 à 2024-2025 selon les états financiers compilés ; 2025-2026 selon QuickBooks.
    Marge brute : 44,3 % · 65,5 % · 73,0 % en trois exercices.</div>

  <h3>Quatre contraintes ont empêché de servir cette demande</h3>
  <p>Elles sont techniques et documentées. Chacune fait l'objet d'une section de ce
  mémo, avec les chiffres qui la mesurent et ce qui la lève.</p>
  <div class="verrou"><span class="n">1</span><p><strong>La fibre coûte 85 $ le kilo</strong>,
    contre 4 $ pour la laine. Ce prix ne vient pas d'une rareté mais d'une fenêtre de
    récolte de deux semaines qu'aucune grande exploitation n'arrive à tenir. Un réseau de
    petites parcelles la tient. <strong>Soixante-trois propositions de terrain</strong>
    sont déjà sur la table. <em>Section 07.</em></p></div>
  <div class="verrou"><span class="n">2</span><p><strong>L'isolant se fabrique
    artisanalement.</strong> Le procédé, inventé à l'interne, demandait sept à huit
    personnes en haute saison et n'entre dans aucune usine textile du monde. En rouleau,
    couvrir les besoins d'une année a demandé deux employés pendant deux semaines.
    <em>Section 08.</em></p></div>
  <div class="verrou o"><span class="n">3</span><p><strong>Le marketing et le développement
    des marchés sont restés sous-investis.</strong> Le coût d'acquisition d'un client est
    passé de 20,11 $ à 31,88 $ en un an. Sortir du manufacturier libère le temps et la
    marge qui manquaient. <em>Section 09.</em></p></div>
  <div class="verrou o"><span class="n">4</span><p><strong>Les coûts fixes montaient au
    rythme des ventes.</strong> Usine, loyer, main-d'œuvre de production et abonnements
    logiciels. La structure allégée en libère {fr(D['mod_production']['avant'] - D['mod_production']['apres'] + D['loyer'][0] - D['loyer'][1])} dès 2026-2027. <em>Section 10.</em></p></div>

  <div class="tiles">
    <div class="tile"><div class="v">70 000</div><div class="k">Clients</div>
      <div class="n">3 M$ cumulés depuis 2020</div></div>
    <div class="tile"><div class="v">{fr(hist_ca[4] / 1e6, 2, '')} M$</div>
      <div class="k">Revenu 2025-2026</div>
      <div class="n">+{pct(hist_ca[4] / hist_ca[3] - 1, 1)} sur 2024-2025</div></div>
    <div class="tile o"><div class="v">{fr(D['mod_production']['apres'])}</div><div class="k">Isolant, une année</div>
      <div class="n">contre {fr(D['mod_production']['avant'])} en 2025-2026</div></div>
    <div class="tile o"><div class="v">2027-2028</div><div class="k">Rentable hors aides</div>
      <div class="n">et couverture au-dessus de 1,25</div></div>
  </div>
  {foot(4)}""")

# ------------------------------------------------------------------ 02 DEMANDE
P.append(f"""<div class="page">
  <div class="kicker">Preuve de marché</div>
  <div class="sect"><span class="num">05</span><h2>La demande, testée trois fois</h2></div>
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
  {foot(5)}""")

# ------------------------------------------------------------------ 03 JUIN
P.append(f"""<div class="page">
  <div class="kicker">Trésorerie</div>
  <div class="sect"><span class="num">06</span><h2>Juin et juillet 2026 : ce que coûte le manque de trésorerie</h2></div>
  <div class="lede">Le budget publicitaire est tombé à zéro en juillet 2026. L'effet sur
    les ventes se mesure au mois près.</div>

  {combo_chart(MOIS, D['fy26_mois']['ventes'], D['fy26_mois']['pub'])}
  <div class="fig">Exercice 2025-2026, septembre 2025 à août 2026. Barres : publicité
    numérique réelle (QuickBooks). Ligne : ventes nettes mensuelles.</div>

  <table>
    <tr><th></th><th>Mars</th><th>Avril</th><th>Mai</th><th>Juin</th><th>Juillet</th></tr>
    <tr><td>Publicité numérique</td><td>{fr(D['fy26_mois']['pub'][6])}</td><td>{fr(D['fy26_mois']['pub'][7])}</td><td>{fr(D['fy26_mois']['pub'][8])}</td><td>{fr(D['fy26_mois']['pub'][9])}</td><td class="neg">{fr(D['fy26_mois']['pub'][10])}</td></tr>
    <tr><td>Commandes Shopify</td><td>1 276</td><td>764</td><td>968</td>
      <td class="neg">71</td><td class="neg">40</td></tr>
    <tr><td>Mêmes mois, 2024-2025</td><td>1 450</td><td>2 193</td><td>2 314</td>
      <td>1 272</td><td>672</td></tr>
    <tr class="hi"><td>Ventes nettes</td><td>{fr(D['fy26_mois']['ventes'][6])}</td><td>{fr(D['fy26_mois']['ventes'][7])}</td><td>{fr(D['fy26_mois']['ventes'][8])}</td><td>{fr(D['fy26_mois']['ventes'][9])}</td><td>{fr(D['fy26_mois']['ventes'][10])}</td></tr>
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
  {foot(6)}""")

# ------------------------------------------------------------------ 04 VERROU 1
P.append(f"""<div class="page">
  <div class="kicker">Approvisionnement</div>
  <div class="sect"><span class="num">07</span><h2>Le coût de la fibre, et le réseau qui le fera baisser</h2></div>
  <div class="lede">La fibre coûte 85 $ le kilo parce que quelqu’un doit amortir vingt
    hectares sur un volume que personne n’achète. Lasclay n’a pas besoin de vingt
    hectares, et les terrains qu’on lui prête ne coûtent rien à amortir.</div>

  <h3>Ce que paie vraiment le prix de 85 $</h3>
  <p>Ce prix n’est pas le coût de faire pousser de l’asclépiade. C’est le prix qu’un
  cultivateur de vingt hectares doit demander pour amortir sa terre, sa machinerie et ses
  années d’apprentissage sur un volume que personne n’achète en quantité. Moins il vend,
  plus le kilo doit être cher. C’est un prix d’amortissement, pas un prix de production,
  et il monte à mesure que la filière rétrécit.</p>

  <p><strong>Lasclay n’a pas besoin de vingt hectares.</strong> Elle a besoin de volumes
  modestes, et elle peut les obtenir de terrains qui ne lui coûtent rien.</p>

  <div class="card dark" style="margin:12px 0">
    <p style="margin:0;font-size:8.9pt">Un tiers des répondants offrent leur terrain
    <strong>sans demander à être payés pour la terre elle-même</strong>. Champs en
    friche, bandes riveraines, parcelles trop humides pour le foin, terres à bois : rien
    à amortir, le terrain est déjà là et ne servait à rien. Le coût de la fibre redevient
    ce qu’il devrait être, celui de la planter, de la récolter et de la traiter. Bien
    payer la personne qui récolte et porter l’amortissement de vingt hectares sont deux
    choses différentes : Lasclay peut faire la première parce qu’elle ne porte pas la
    seconde.</p>
  </div>

  <p>La fenêtre de deux semaines cesse du même coup d’être un problème : personne
  n’essaie de récolter vingt hectares. Cinquante propriétaires qui font chacun un demi
  hectare, en parallèle, livrent le même volume sans qu’aucun n’ait besoin d’une
  moissonneuse.</p>

  <p>Ce modèle demande ce qui manquait justement à la filière : du recrutement, de
  l’accompagnement, de l’outillage adapté à petite échelle et un acheteur garanti. Ce
  sont des compétences commerciales et agronomiques, pas industrielles.
  <strong>Eko-Terre s’est engagée à aider Lasclay à adapter ses équipements de séchage et
  d’extraction à cette échelle</strong>, ce qu’elle n’a ni les ressources ni la vocation
  de faire seule.</p>

  <h3>L’offre existe déjà, et elle est documentée</h3>
  <p>Un appel de candidatures lancé au printemps 2026 a recueilli
  <strong>63 propositions de terrain</strong> en quelques semaines, sans budget
  publicitaire, partout au Québec. La moitié des répondants dispose de plus d’un
  hectare.</p>

  <table>
    <tr><th>Ce que les 63 répondants proposent</th><th>Réponses</th><th>Part</th></tr>
    <tr><td>Prêter un terrain et être rémunérés pour les récoltes</td><td>27</td><td>42,9 %</td></tr>
    <tr class="hio"><td>Mettre un terrain à disposition, sans contrepartie pour la terre</td>
      <td>22</td><td>34,9 %</td></tr>
    <tr><td>Planter, opérer et vendre eux-mêmes la récolte</td><td>14</td><td>22,2 %</td></tr>
    <tr><td>S’impliquer dans la R&amp;D et le développement d’équipement</td>
      <td>11</td><td>17,5 %</td></tr>
    <caption>Plusieurs choix possibles par répondant. Les trois quarts (74,6 %) se disent
      prêts à cultiver l’asclépiade commune, l’espèce à plus fort rendement, dont une
      partie avec de l’accompagnement pour gérer sa propagation. Onze personnes offrent
      de participer au développement des équipements : c’est exactement le chantier à
      mener.</caption>
  </table>

  <p>Ces candidatures ne sont pas des intentions vagues : fermettes, terres à bois,
  érablières, cohabitats et particuliers, avec des superficies chiffrées et des questions
  précises sur la charge de travail. L’offre agricole existe, il lui manque un
  encadrement et un débouché stable. Le financement de ce développement fait l’objet
  d’une demande au Fonds Vision Topping et d’un dossier Défi-Québec, et
  <strong>n’est pas dans les projections de ce document</strong>.</p>
  {foot(7)}""")

# ------------------------------------------------------------------ 05 VERROU 2
P.append(f"""<div class="page">
  <div class="kicker">Production</div>
  <div class="sect"><span class="num">08</span><h2>De la production artisanale à l’isolant en rouleau</h2></div>
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
    2025-2026 (QuickBooks, ligne « MOD-Production »). Droite : deux employés pendant deux
    semaines à 30 $/h, ce qu'a demandé la production de l'isolant couvrant les besoins
    de l'exercice 2026-2027.</div>

  <div class="tiles" style="margin-top:6px">
    <div class="tile"><div class="v">−94,7 %</div><div class="k">Main-d'œuvre de production</div>
      <div class="n">{fr(D['mod_production']['avant'])} → {fr(D['mod_production']['apres'])}</div></div>
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
  {foot(8)}""")

# ------------------------------------------------------------------ 06 VERROU 3
P.append(f"""<div class="page">
  <div class="kicker">Mise en marché</div>
  <div class="sect"><span class="num">09</span><h2>Le marketing et le développement des marchés</h2></div>
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
  <p>Le coût d'acquisition d'un client est passé de 20,11 $ en 2024-2025 à
  <strong>31,88 $ en 2025-2026</strong>, une hausse de 59 % en un an, pendant que le panier
  moyen montait de 28 %. La marge de contribution par commande couvre encore le coût
  d'acquisition dès la première commande, mais la tendance est le signal que le marketing
  a manqué d'attention, pas de budget.</p>

  <table>
    <tr><th>Acquisition</th><th>2024-2025</th><th>2025-2026</th><th>Écart</th></tr>
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

  <p>La publicité représente 27 % des ventes nettes en 2025-2026. Ce n'est pas elle qui
  creuse la perte, puisqu'elle se rembourse dès la première commande, mais son rendement
  se dégrade quand personne n'a le temps de l'optimiser. Le canal détail, qui ne consomme
  aucune publicité, réduit structurellement cette dépendance.</p>
  {foot(9)}""")

# ------------------------------------------------------------------ 07 VERROU 4
P.append(f"""<div class="page">
  <div class="kicker">Structure de coûts</div>
  <div class="sect"><span class="num">10</span><h2>Les coûts fixes et l’infrastructure numérique</h2></div>
  <div class="lede">Un modèle où les dépenses montent au même rythme que les ventes ne
    devient jamais rentable, quelle que soit la croissance. C'est exactement ce qui s'est
    produit.</div>

  <div class="quote">On est passés de 500 000 $ à 879 000 $ de ventes. Pour 22 000 $ de
    profit de plus.</div>

  <h3>La structure fixe, avant et après</h3>
  <table>
    <tr><th>Poste</th><th>2025-2026 réel</th><th>Après le pivot</th><th>Libéré</th></tr>
    <tr><td>Main-d'œuvre de production</td><td>{fr(D['mod_production']['avant'])}</td><td>{fr(D['mod_production']['apres'])}</td><td>{fr(D['mod_production']['avant'] - D['mod_production']['apres'])}</td></tr>
    <tr><td>Loyer de l'atelier</td><td>{fr(D['loyer'][0])}</td><td>{fr(D['loyer'][1])}</td>
      <td>{fr(D['loyer'][0] - D['loyer'][1])}</td></tr>
    <tr><td>Amortissement équipement et améliorations locatives</td>
      <td>{fr(D['amort_atelier'])}</td><td>décroissant</td><td>n. d.</td></tr>
    <tr class="hi"><td>Structure fixe libérée dès 2026-2027</td><td colspan="2"></td>
      <td>{fr(D['mod_production']['avant'] - D['mod_production']['apres']
             + D['loyer'][0] - D['loyer'][1])}</td></tr>
    <caption>Ce sont les montants du modèle, pas un potentiel. Le loyer descend encore
      ensuite — {fr(D['loyer'][2])} en 2027-2028, {fr(D['loyer'][3])} en 2028-2029 — sans
      que le modèle aille jusqu'aux 30 000 $ qu'une sous-location de l'espace excédentaire
      rendrait possibles. La prudence est volontaire.</caption>
  </table>

  <h3>L'infrastructure numérique : le chantier suivant</h3>
  <p>Une partie de la pile logicielle peut être remplacée par des outils internes, et
  l'entreprise a déjà démontré qu'elle savait le faire.</p>

  <table>
    <tr><th>Poste, 2025-2026 réel</th><th>Montant</th><th style="text-align:left">Statut</th></tr>
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
  {foot(10)}""")

# ------------------------------------------------------------------ 08 MOTEURS
CROI_A = A['dtc'][3] + A['detail'][3] - A['dtc'][0]
CAGR_C = (C['dtc'][3] / C['dtc'][0]) ** (1 / 3) - 1
CAGR_A = (A['dtc'][3] / A['dtc'][0]) ** (1 / 3) - 1
CAGR_HIST = (hist_ca[4] / hist_ca[0]) ** (1 / 4) - 1
P.append(f"""<div class="page">
  <div class="kicker">D'où vient la croissance</div>
  <div class="sect"><span class="num">11</span><h2>Deux moteurs, et le plus gros existe déjà</h2></div>
  <div class="lede">Le canal détail est le nouveau venu, alors il attire l'attention, et
    il apporte en effet la plus grande part de la croissance. Il reste que le commerce en
    ligne, qui a porté seul les six premières années, en fournit encore
    {pct((C['dtc'][3] - C['dtc'][0]) / (C['dtc'][3] + C['detail'][3] - C['dtc'][0]), 0)}
    et demeure de loin la plus grosse part du chiffre d'affaires en 2028-2029.</div>

  {moteurs_chart(YR, A['dtc'], A['detail'])}
  <div class="fig">Scénario ambitieux, ventes nettes par moteur. Le commerce en ligne
    passe de {fr(A['dtc'][0])} à {fr(A['dtc'][3])}, soit
    {pct(A['dtc'][3] / A['dtc'][0] - 1, 0)} de plus, pendant que le canal détail se
    construit à partir de zéro.</div>

  <table>
    <tr><th>Croissance 2025-2026 à 2028-2029</th><th>Conservateur</th><th>Ambitieux</th></tr>
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
      an entre 2021-2022 et 2025-2026, entièrement en ligne, sans canal détail, sans isolant en
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
      {fr(S['cac26'], 2)} en 2025-2026, parce que la marge unitaire assainie permet de
      payer l'acquisition sans vider la trésorerie.</p></div>
  </div>
  <div class="two">
    <div class="card v"><h4>Le marché américain, déjà amorcé</h4>
      <p style="font-size:8.6pt;margin:0">Environ 20 % du chiffre d'affaires récent,
      porté par l'horticole : quelque 250 000 $ de semences vendues en 2025. Une semence
      à 8 $ se vend plus facilement qu'un produit à 100 $, et une part notable de ces
      clients migre ensuite vers la gamme textile.</p></div>
    <div class="card v"><h4>Des produits que l'atelier ne pouvait pas faire</h4>
      <p style="font-size:8.6pt;margin:0">L'isolant en rouleau et la finition en Tunisie
      ouvrent des gammes que la production artisanale interdisait, aux volumes et aux
      prix du commerce en ligne. Le catalogue cesse d'être borné par la capacité de deux
      personnes en atelier.</p></div>
  </div>
  {foot(11)}""")

# ------------------------------------------------------------------ 09 DÉTAIL
D_ = D['detail']
MOIS12 = ['sept.', 'oct.', 'nov.', 'déc.', 'janv.', 'févr.', 'mars', 'avr.',
          'mai', 'juin', 'juill.', 'août']
TOP = D_['villes'][:9]
RESTE = D_['villes'][9:]
lignes_villes = ''.join(
    f'<tr><td>{v["ville"]}</td><td>{v["pop"]:,}</td>'.replace(',', '\u202f')
    + f'<td>{fr(v["en_ligne"])}</td><td>{v["indice"]:.2f}</td>'.replace('.', ',')
    + f'<td>{v["capacite"]}</td><td>{fr(v["revenu"])}</td>'
    + f'<td>{fr(v["total"])}</td></tr>'
    for v in TOP)

P.append(f"""<div class="page">
  <div class="kicker">Le canal détail</div>
  <div class="sect"><span class="num">12</span><h2>Le détail au Canada, construit ville par ville</h2></div>
  <div class="lede">Ce canal n'est pas une projection à partir de rien. Un détaillant
    vend déjà les produits Lasclay en consignation, à Montréal, depuis septembre 2025,
    et ses rapports mensuels donnent ce qu'un point de vente rapporte réellement.</div>

  <h3>Ce que fait un point de vente, mesuré</h3>
  <p>Les Défricheuses est la détaillante exclusive de Lasclay à Montréal. Dix rapports de
  consignation, de septembre 2025 à juin 2026 : <strong>{fr(D_['defricheuses_an'])}
  encaissés par Lasclay</strong>, soit {fr(D_['defricheuses_detail'])} au prix payé par
  le consommateur. Le partage 60 / 40 du modèle est celui de ce contrat, pas une
  hypothèse.</p>

  {mois_chart(MOIS12, D_['defricheuses'])}
  <div class="fig">Les Défricheuses, Montréal, 2025-2026. Revenu encaissé par Lasclay,
    par mois. La gamme passe de 18 à 40 lignes de septembre à novembre, et la tablette
    n'est plus réapprovisionnée après février : la chute du printemps est une rupture de
    stock, pas une saison morte.</div>

  <h3>Un canal qui ne se gère presque pas</h3>
  <p>La consignation n'a ni bon de commande, ni facture, ni compte client, ni
  recouvrement. Le détaillant vend, Lasclay réapprovisionne. Ce qui reste à faire tient
  en deux gestes : cadencer les réapprovisionnements, et envoyer chaque semaine les
  commandes à ramasser aux points de vente qui servent aussi de points de cueillette.
  Le modèle ne porte donc aucune ressource de coordination en 2026-2027, une demie en
  2027-2028 et une seule en 2028-2029, pour un réseau qui approche la centaine.</p>

  <h3>De un point de vente à cent un</h3>
  <p>L'univers est nommé, pas estimé : les vingt plus grandes villes du Québec et les
  vingt-cinq plus grandes du Canada, soit quarante villes distinctes. Une ville en porte
  plusieurs quand sa population le permet, à raison d'un point de vente par tranche de
  160 000 habitants et d'un maximum de dix. Toronto en porte dix, Montréal dix, Granby
  un : <strong>{D_['nb_points']} points de vente possibles</strong>, chacun rattaché à
  une ville nommée. Le deuxième point de vente d'une ville ne vaut pas le premier, qui a
  pris le meilleur emplacement, alors chaque rang suivant est escompté de 20 %.</p>
  <p>Chaque ville reçoit un <strong>indice d'affinité</strong> tiré des ventes en ligne
  par habitant, rapportées à Montréal. Là où la marque pèse déjà, un point de vente pèse
  davantage. Hors Québec, les ventes en ligne valent {pct(0.083, 0)} du chiffre canadien
  pour {pct(0.77, 0)} de la population : elles y mesurent l'absence de marketing et non
  l'absence de potentiel, alors l'indice s'y prend sur la taille du marché, escompté de
  {pct(D_['facteur_roc'], 0)}.</p>

  <div class="card v"><h4>Un effet que le modèle ne compte pas</h4>
    <p style="font-size:8.6pt;margin:0">Un détaillant qui tient la marchandise peut aussi
    servir de point de cueillette pour les commandes en ligne. L'envoi hebdomadaire
    groupé vers le commerce remplace alors autant de livraisons individuelles à domicile.
    Le transport net a coûté 65 212 $ en 2025-2026, soit 6,6 % des ventes nettes ; aucune
    économie de ce côté n'est inscrite dans les prévisions.</p></div>

  {foot(12)}""")

# ------------------------------------------------------------------ 10 VILLES
P.append(f"""<div class="page">
  <div class="kicker">Le canal détail</div>
  <div class="sect"><span class="num">13</span><h2>Les quarante villes, et le calendrier</h2></div>
  <div class="lede">Reste à décider ce que vaut un point de vente majeur par rapport à la
    boutique montréalaise. Le modèle le pose à {D_['calibre_c']:.0f} fois, dans les deux
    scénarios. C'est le seul jugement du canal, et trois faits des rapports de
    consignation le soutiennent.</div>

  <ul>
    <li>La gamme est passée de <strong>18 à 40 lignes de produits</strong> entre septembre
      et novembre 2025 : les deux premiers mois n'ont vendu que 305 $ à eux deux</li>
    <li>La tablette n'a pas été réapprovisionnée après février : de mars à juin, presque
      toutes les lignes sont à zéro, pour <strong>1 052 $ en quatre mois</strong> contre
      10 979 $ de novembre à janvier</li>
    <li>Ce point de vente n'a ni présentoir, ni coordination, ni poussée saisonnière</li>
  </ul>

  <table>
    <tr><th>Ville</th><th>Population</th><th>Ventes en ligne 2025-2026</th>
      <th>Indice</th><th>Points possibles</th><th>Revenu du 1<sup>er</sup> point</th>
      <th>Potentiel de la ville</th></tr>
    {lignes_villes}
    <tr class="tot"><td>Les {len(RESTE)} villes suivantes</td><td></td><td></td><td></td>
      <td>{sum(v['capacite'] for v in RESTE)}</td>
      <td>{fr(sum(v['revenu'] for v in RESTE))}</td>
      <td>{fr(sum(v['total'] for v in RESTE))}</td></tr>
    <tr class="hio"><td>Plafond du canal</td><td></td><td></td><td></td>
      <td>{D_['nb_points']}</td><td></td><td>{fr(D_['plafond'])}</td></tr>
    <caption>Revenu encaissé par Lasclay, à pleine maturité. La feuille « Détail par
      ville » du chiffrier porte les quarante villes et le registre des
      {D_['nb_points']} points de vente dans leur ordre d'ouverture. Les deux scénarios
      partagent ce registre : ils diffèrent par la vitesse et la profondeur du
      déploiement, pas par la taille supposée des commerces.</caption>
  </table>

  <table>
    <tr><th>Déploiement</th><th>2025-2026</th><th>2026-2027</th><th>2027-2028</th><th>2028-2029</th></tr>
    <tr><td>Points de vente au 31 août — conservateur</td>
      {''.join(f'<td>{v:.0f}</td>' for v in D_['pos_c'])}</tr>
    <tr><td>Revenu encaissé — conservateur</td>
      {''.join(f'<td>{fr(v)}</td>' for v in C['detail'])}</tr>
    <tr><td>Points de vente au 31 août — ambitieux</td>
      {''.join(f'<td>{v:.0f}</td>' for v in D_['pos_a'])}</tr>
    <tr class="hio"><td>Revenu encaissé — ambitieux</td>
      {''.join(f'<td>{fr(v)}</td>' for v in A['detail'])}</tr>
    <tr><td>Stock en consignation immobilisé — conservateur</td>
      {''.join(f'<td>{fr(v)}</td>' for v in C['consig'])}</tr>
    <caption>Un point ouvert en cours d'exercice ne livre que la moitié de son année.
      Le coût des marchandises du canal monte de 33 % à 55 % du revenu encaissé, parce
      que le produit coûte le même prix à fabriquer alors que Lasclay n'encaisse que
      60 % du prix. S'ajoutent 6 % de transport, 7 % de commission de représentation,
      800 $ de présentoir par point de vente et la coordination. Le point de vente le
      plus modeste du réseau ambitieux encaisse {fr(D_['marginal_a'])} par année.</caption>
  </table>
  {foot(13)}""")

# ------------------------------------------------------------------ 11 MARCHÉS
P.append(f"""<div class="page">
  <div class="kicker">Marchés</div>
  <div class="sect"><span class="num">14</span><h2>Trois marchés qui ne sont pas dans les chiffres</h2></div>
  <div class="lede">Le canal détail est le seul nouveau marché budgété. Les trois qui
    suivent se négocient sur des cycles trop longs pour être inscrits dans un plan de
    trois ans, et n'apportent aucun revenu aux tableaux qui suivent.</div>

  <h3>1. Le marché américain, déjà amorcé</h3>
  <p>Les États-Unis représentent environ 20 % du chiffre d'affaires récent, portés par
  l'horticole : quelque 250 000 $ de semences vendues en 2025, sur les 10 millions
  distribuées en Amérique du Nord. Une semence à 8 $ se vend plus facilement qu'un produit
  textile à 100 $, et une part notable de ces clients migre ensuite vers la gamme
  textile. Ce marché est déjà dans les chiffres du commerce en ligne ; ce qui n'y est
  pas, c'est le canal détail américain, qui suit la même logique que le canadien avec
  quarante fois plus de villes.</p>

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

  <h3>Ce que le plafond de quarante villes veut dire</h3>
  <p>Borner l'univers à quarante villes rend le canal vérifiable, et il le rend aussi
  limitant. Le Canada compte une trentaine d'autres municipalités de plus de cent mille
  habitants, absentes du modèle. Les États-Unis n'y sont pas du tout. Le plafond de
  {fr(D_['plafond'])}, soit {D_['nb_points']} points de vente à pleine maturité, est
  celui des quarante villes retenues, pas celui du marché.</p>

  <h3>Si le calibre est faux</h3>
  <p>Tout le reste du canal vient de données observées. Le calibre, lui, est un
  jugement : combien de fois Les Défricheuses vaut un point de vente majeur. Voici ce
  que devient le plan quand on le déplace, à déploiement conservateur inchangé.</p>
  <table>
    <tr><th>Calibre</th><th>Revenu du 1<sup>er</sup> point de vente à Montréal</th>
      <th>Canal détail 2028-2029</th><th>Ventes nettes 2028-2029</th>
      <th>Résultat hors aides 2028-2029</th></tr>
    {''.join(
      f'<tr class="{"hi" if r["calibre"] == D_["calibre_c"] else ""}">'
      f'<td>{r["calibre"]:.0f} x</td><td>{fr(r["par_pdv"])}</td>'
      f'<td>{fr(r["detail"])}</td><td>{fr(r["ventes"])}</td>'
      f'<td>{fr(r["hors"])}</td></tr>' for r in D_['sensibilite'])}
    <caption>Ligne surlignée : la valeur retenue au scénario conservateur. Même à deux
      fois Les Défricheuses, soit {fr(D_['sensibilite'][0]['par_pdv'])} par point de
      vente et par année, le plan reste rentable hors aides publiques en 2028-2029.</caption>
  </table>
  {foot(14)}""")

# ------------------------------------------------------------------ 09 CHIFFRES
P.append(f"""<div class="page">
  <div class="kicker">Projections</div>
  <div class="sect"><span class="num">15</span><h2>Les projections : deux scénarios</h2></div>
  <div class="lede">Un chiffrier mensuel de 48 mois rapproché de QuickBooks compte par
    compte, dont dix mois de 2025-2026 sont du réel. Une seule cellule bascule d'un scénario
    à l'autre.</div>


  <table>
    <tr><th>Conservateur réaliste</th><th>2025-2026</th><th>2026-2027</th><th>2027-2028</th><th>2028-2029</th></tr>
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
    <tr><th>Ambitieux</th><th>2025-2026</th><th>2026-2027</th><th>2027-2028</th><th>2028-2029</th></tr>
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
    <li>Le résultat hors aides publiques devient <strong>positif dès 2027-2028</strong> en
      scénario conservateur, et dès 2026-2027 en ambitieux</li>
    <li>La couverture du service de la dette franchit le seuil bancaire de 1,25
      <strong>en 2027-2028</strong>, et les capitaux propres redeviennent positifs le même
      exercice</li>
    <li>2026-2027 reste l'exercice tendu, à {fr(C['dscr'][1],2,'')} de couverture et
      {fr(C['hors'][1])} hors aides. <strong>C'est l'exercice qui a besoin du
      financement</strong></li>
  </ul>

  <p>Les deux moteurs progressent dans les deux lectures. Même en scénario conservateur,
  le commerce en ligne apporte {pct((C['dtc'][3] - C['dtc'][0])
  / (C['dtc'][3] + C['detail'][3] - C['dtc'][0]), 0)} de la croissance de la période et
  le canal détail le reste.</p>
  {foot(15)}""")

# ------------------------------------------------------------------ 10 FINANCEMENT
P.append(f"""<div class="page">
  <div class="kicker">Financement</div>
  <div class="sect"><span class="num">16</span><h2>Structure de financement et facteurs de risque</h2></div>
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
      ventes de 2028-2029 reposent sur un canal qui compte <strong>un seul point de
      vente aujourd'hui</strong>. C'est le risque principal du plan. Lasclay s'engage à
      rapporter trimestriellement le nombre de lettres d'intention signées et
      d'ouvertures réalisées, ville par ville.</p></div>
    <div class="card o"><h4>Dépendance à l'assemblage externe</h4>
      <p style="font-size:8.5pt;margin:0">Le transfert vers la Tunisie crée une dépendance
      logistique, un risque de change et de délais. L'isolant et le savoir-faire critiques
      restent au Québec, ce qui limite l'exposition.</p></div>
  </div>
  <div class="two" style="margin-top:11px">
    <div class="card o"><h4>2026-2027 sous le seuil bancaire</h4>
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
      reprise de 5 % coûterait environ 12 000 $ en 2028-2029</li>
  </ul>
  {foot(16)}""")

# ------------------------------------------------------------------ 11 FIABILITÉ
P.append(f"""<div class="page">
  <div class="kicker">Méthode</div>
  <div class="sect"><span class="num">17</span><h2>La méthode et les sources</h2></div>
  <div class="lede">Une projection ne vaut que par la rigueur de son suivi.</div>

  <h3>Ancrage comptable</h3>
  <p>Le modèle est un chiffrier mensuel de 48 mois, de septembre 2025 à août 2029. Chaque
  compte du grand livre QuickBooks est apparié à une ligne du modèle par son numéro de
  compte. <strong>Dix mois de 2025-2026 sont du réel</strong>, bilan comme état des
  résultats, collés directement depuis QuickBooks : septembre 2025 à juin 2026. Juillet et
  août restent prévisionnels, parce que la colonne de juillet chez QuickBooks est une photo
  du mois en cours et non un mois fermé.</p>

  <h3>Ce que la révision du 30 juillet 2026 a corrigé</h3>
  <ul>
    <li>Les 76 produits ont été recalés sur les <strong>unités réellement vendues</strong>
      chez Shopify. Le total modélisé de 2025-2026 reconcilie au revenu QuickBooks à 3 826 $
      près, sur 1,1 M$</li>
    <li>La trajectoire de 2026-2027 à 2028-2029 a été refaite : la version précédente
      multipliait par 1,4516 chaque année sans justification par produit ni par canal</li>
    <li>Le canal détail a été reconstruit ville par ville sur les rapports de
      consignation des Défricheuses et les ventes en ligne par ville de facturation. Il
      reposait sur trois nombres posés à la main, et 2025-2026 affichait zéro vente au
      détail alors qu'il y en avait pour <strong>13 801 $</strong></li>
    <li>Les coûts variables ont été rebranchés sur le volume, et la structure de coûts
      calibrée sur les trois derniers exercices réalisés plutôt que sur des cibles</li>
    <li>Une seule chaîne de trésorerie sur 48 mois remplace les états parallèles qui
      divergeaient. <strong>La ligne de contrôle du bilan est à zéro sur les 48 mois</strong></li>
    <li>Le calendrier des taxes a été posé tel qu'il est déclaré : <strong>TVQ au mois,
      TPS à l'année avec un solde dû le 30 novembre</strong>. Les taux viennent des
      montants réels de 2025-2026 — taxes perçues chez Shopify région par région, taxes
      facturées et crédits sur intrants chez QuickBooks — et tiennent compte de la baisse
      des crédits quand la couture quitte le Québec. Le versement du 30 novembre passe de
      <strong>13 910 $ en 2026 à 48 510 $ en 2028</strong></li>
    <li>Le mappage des comptes portait cinq défauts qui faisaient disparaître des soldes
      réels, dont 54 266 $ de prêt BDC qui ne tombaient nulle part</li>
    <li>Aucune cellule des feuilles actives du plan n'est en erreur et aucune référence
      n'est circulaire. Les feuilles d'archive des exercices antérieurs, conservées telles
      quelles, en portent encore</li>
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
  <p style="font-size:8.5pt;color:{GRIS}">États financiers compilés 2022-2023 à 2024-2025
  (mission de compilation, sans audit ni examen) · QuickBooks Online pour le réel 2025-2026 ·
  Shopify pour les ventes, commandes, clients, sessions et ventes par ville de
  facturation · rapports de consignation mensuels de Les Défricheuses, septembre 2025 à
  juin 2026 · Statistique Canada, recensement de 2021, pour les populations
  municipales · Groupe CTT pour les essais
  d'isolation de la membrane · Chaire de recherche industrielle sur les matériaux innovants en composites de l'Université de Sherbrooke pour la comparaison au duvet · World Wildlife Fund-México pour les colonies de monarques ·
  registre public des espèces en péril du gouvernement du Canada pour le statut du
  monarque.</p>
  {foot(17)}""")

# ------------------------------------------------------------------ 12 CONCLUSION
P.append(f"""<div class="page">
  <div class="sect"><span class="num">18</span><h2>Synthèse</h2></div>

  <p>Lasclay a franchi les étapes les plus difficiles d'une entreprise pionnière :
  apprendre une matière que personne ne maîtrisait, bâtir une demande de 70 000 clients,
  porter la marge brute de 44 % à 73 %, et atteindre la rentabilité en 2024-2025. Ce qui
  bloque n'est pas le marché.</p>

  <p>Ce sont quatre contraintes techniques, et elles tombent ensemble. Le coût de la fibre
  descend quand le volume d'achat triple. L'isolant devient un produit industriel en
  rouleau : <strong>{fr(D['mod_production']['apres'])} de main-d'œuvre pour couvrir une année entière,
  contre {fr(D['mod_production']['avant'])}</strong>. L'énergie du fondateur revient au marché, aux produits et à la
  filière agricole. Et la structure fixe libère {fr(D['mod_production']['avant'] - D['mod_production']['apres'] + D['loyer'][0] - D['loyer'][1])} dès 2026-2027, sans compter
  les 52 129 $ d'infrastructure numérique qui ne sont même pas dans les projections.</p>

  <p>Le risque que ce virage ferait fuir la clientèle a été testé grandeur nature en mai
  2026 : trois jours après une vidéo de transparence de quarante minutes, la prévente a
  fait 82 692 $ avec 85,2 % de clients existants et un panier supérieur de 58 % à la
  moyenne. La communauté a jugé, et elle a acheté.</p>

  <p>La trajectoire ne repose pas sur un pari unique. Le commerce en ligne, qui a porté
  seul les six premières années, apporte {pct((C['dtc'][3] - C['dtc'][0])
  / (C['dtc'][3] + C['detail'][3] - C['dtc'][0]), 0)} de la progression dans la lecture
  prudente, en croissant de {pct(CAGR_C)} par an, soit la moitié du rythme tenu depuis
  2021-2022. Le canal détail apporte le reste. Un déploiement en magasin plus lent que prévu
  ralentit la trajectoire sans l'annuler.</p>

  <div class="tiles" style="margin:20px 0">
    <div class="tile"><div class="v">{fr(S['pret'], 0, '')} $</div>
      <div class="k">Prêt à terme demandé</div>
      <div class="n">dont 367 479 $ de refinancement</div></div>
    <div class="tile"><div class="v">{fr(S['marge_demandee'], 0, '')} $</div>
      <div class="k">Marge saisonnière</div><div class="n">creux d'automne</div></div>
    <div class="tile o"><div class="v">{fr(S['argent_neuf'], 0, '')} $</div>
      <div class="k">Argent neuf net</div><div class="n">le reste remplace de la dette</div></div>
    <div class="tile o"><div class="v">2027-2028</div><div class="k">Rentable hors aides</div>
      <div class="n">et couverture au-dessus de 1,25</div></div>
  </div>

  <p>Le financement sert à traverser <strong>2026-2027</strong>, seul exercice où la
  couverture reste sous le seuil bancaire.
  À partir de 2027-2028, l'exploitation porte son service de la dette, les capitaux propres
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
  {foot(18)}""")

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
PDF='Lasclay - Previsions financieres 2026-2029 - memo explicatif.pdf'
subprocess.run([CHROME,'--headless','--disable-gpu','--no-sandbox','--no-pdf-header-footer',
  '--run-all-compositor-stages-before-draw','--virtual-time-budget=8000',
  '--print-to-pdf=' + PDF,
  'file://'+str(Path('note_bailleurs.html').resolve())],check=True,capture_output=True)

# Chromium réembarque un sous-ensemble de police par page : vingt-trois pour
# dix-sept pages, là où cinq suffisent. La recompression les déduplique et
# ramène le fichier à 60 % de sa taille, sans toucher au rendu.
try:
    import pikepdf
    with pikepdf.open(PDF) as _p:
        _p.save('_compact.pdf', compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                recompress_flate=True, deterministic_id=True)
    import os
    os.replace('_compact.pdf', PDF)
except ImportError:
    pass
print('PDF produit', Path(PDF).stat().st_size, 'octets')
