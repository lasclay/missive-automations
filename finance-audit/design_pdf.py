#!/usr/bin/env python3
"""Le système visuel partagé des documents PDF de Lasclay.

Trois documents en sortent : le mémo des prêteurs, le mémo de Wassim et la
proposition de partenariat. Ils doivent se ressembler — même palette, mêmes
graphiques, même façon d'écrire un nombre — sans que le second et le troisième
aient à recopier le premier. Une palette recopiée diverge à la première
retouche.

Les graphiques sont du SVG posé à la main : rien à charger, et un rendu
identique à l'écran et à l'impression.

`rendre()` assemble les pages, écrit le HTML, le fait imprimer par Chromium et
recompresse le PDF. Chromium réembarque un sous-ensemble de police par page ;
la recompression les déduplique et ramène le fichier à 60 % de sa taille, sans
toucher au rendu.
"""
import re
import subprocess
from pathlib import Path

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

# ------------------------------------------------------------- étiquettes
YR = ['2025-2026', '2026-2027', '2027-2028', '2028-2029']
MOIS = ['S', 'O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A']

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


def foot(n, tot=19):
    return (f'<div class="foot"><span>LASCLAY · PRÉVISIONS FINANCIÈRES 2026-2029</span>'
            f'<span>{n} / {tot}</span></div></div>')




def _nbsp(part):
    part = re.sub(r'(?<=\d) (?=\d{3}(?!\d))', '\u202f', part)
    # Le symbole qui suit un nombre ne doit jamais tomber seul à la ligne
    # suivante : « 298 156 » d'un côté, « $ » de l'autre, dans un tableau de
    # financement, ça se remarque tout de suite.
    return re.sub(r'(?<=\d) (?=[$%])', '\u00a0', part)


CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'


def rendre(pages, titre, pdf, html_path, lang='fr'):
    """Assemble, imprime et recompresse. Rend la taille du PDF en octets."""
    html = CSS + ''.join(pages)
    # Les espaces insécables se posent partout SAUF dans le SVG, où un
    # « \u202f » dans une coordonnée casse le tracé sans rien dire.
    out, last = [], 0
    for m in re.finditer(r'<svg.*?</svg>', html, re.S):
        out.append(_nbsp(html[last:m.start()]))
        out.append(m.group(0))
        last = m.end()
    out.append(_nbsp(html[last:]))
    html = ''.join(out)

    Path(html_path).write_text(
        f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8">'
        f'<title>{titre}</title></head><body>' + html + '</body></html>',
        encoding='utf8')
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox',
                    '--no-pdf-header-footer',
                    '--run-all-compositor-stages-before-draw',
                    '--virtual-time-budget=8000', '--print-to-pdf=' + pdf,
                    'file://' + str(Path(html_path).resolve())],
                   check=True, capture_output=True)
    try:
        import pikepdf
        with pikepdf.open(pdf) as p:
            p.save('_compact.pdf', compress_streams=True,
                   object_stream_mode=pikepdf.ObjectStreamMode.generate,
                   recompress_flate=True, deterministic_id=True)
        import os
        os.replace('_compact.pdf', pdf)
    except ImportError:
        pass
    return Path(pdf).stat().st_size
