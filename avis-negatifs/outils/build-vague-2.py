# -*- coding: utf-8 -*-
"""Convertit vague-2.md en une page HTML de travail."""
import re, html, json

SRC = 'avis-negatifs/vague-2.md'
OUT = '/home/user/missive-automations/avis-negatifs/vague-2.html'
md = open(SRC, encoding='utf-8').read()

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', t)
    return t

def table(rows):
    head, *body = [r for r in rows if not re.match(r'^\|[\s:\-|]+\|$', r)]
    def cells(r, tag):
        cs = [c.strip() for c in r.strip().strip('|').split('|')]
        return ''.join(f'<{tag}>{inline(c)}</{tag}>' for c in cs)
    h = f'<thead><tr>{cells(head,"th")}</tr></thead>'
    b = ''.join(f'<tr>{cells(r,"td")}</tr>' for r in body)
    return f'<div class="scroll"><table>{h}<tbody>{b}</tbody></table></div>'

def blocks(txt, lettre=False):
    """Rend un bloc de markdown courant (paragraphes, tables, listes, citations)."""
    out, buf, mode = [], [], None
    def flush():
        nonlocal buf, mode
        if not buf: return
        if mode == 'table':
            out.append(table(buf))
        elif mode == 'quote':
            out.append(quote(buf, lettre))
        elif mode == 'list':
            puces = [inline(re.sub(r"^\s*(-|\d+\.)\s*", "", l)) for l in buf]
            items = ''.join('<li>' + x + '</li>' for x in puces)
            out.append(f'<ul>{items}</ul>')
        else:
            p = ' '.join(buf).strip()
            if p:
                entier_italique = p.startswith('*') and p.endswith('*') and not p.startswith('**')
                if entier_italique:
                    noyau = p.strip('*').strip()
                    cls = ' class="note alert"' if noyau.startswith('⚠️') else (' class="note ok"' if noyau.startswith('✅') else ' class="note"')
                elif p.startswith('⚠️'):
                    cls = ' class="alert"'
                elif p.startswith('✅'):
                    cls = ' class="ok"'
                else:
                    cls = ''
                out.append(f'<p{cls}>{inline(p)}</p>')
        buf, mode = [], None
    for line in txt.split('\n'):
        s = line.rstrip()
        if not s.strip():
            flush(); continue
        debut_puce = re.match(r'^\s*(-|\d+\.)\s', s)
        m = ('table' if s.startswith('|') else
             'quote' if s.startswith('>') else
             'list'  if debut_puce else 'p')
        if mode == 'list' and not debut_puce and not s.startswith(('|', '>')):
            buf[-1] += ' ' + s.strip()      # suite d'une puce sur plusieurs lignes
            continue
        if m != mode: flush(); mode = m
        buf.append(s)
    flush()
    return '\n'.join(out)

def quote(lines, lettre=False):
    """Le message au client. Les lignes '> >' sont l'avis cité."""
    body, para, mode = [], [], None
    def flush():
        nonlocal para, mode
        if not para: return
        txt = ' '.join(para).strip()
        if mode == 'avis':
            body.append(f'<blockquote class="avis">{inline(txt)}</blockquote>')
        elif mode == 'objet':
            body.append(f'<p class="objet">{inline(txt)}</p>')
        else:
            body.append(f'<p>{inline(txt)}</p>')
        para, mode = [], None
    for l in lines:
        s = re.sub(r'^>\s?', '', l)
        if not s.strip():
            flush(); continue
        if s.startswith('>'):
            m = 'avis'; s = re.sub(r'^>\s?', '', s)
        elif s.startswith('**Objet') or s.startswith('**Subject'):
            m = 'objet'
        else:
            m = 'p'
        if m != mode: flush(); mode = m
        para.append(s)
    flush()
    inner = '\n'.join(body)
    if lettre:
        return '<div class="lettre">' + inner + '</div>'
    return '<div class="cite">' + inner + '</div>'

# --- découpage ---
parts = re.split(r'\n(?=#{1,3} )', md)
sections, cur = [], None
for p in parts:
    head = p.split('\n', 1)[0].strip()
    body = (p.split('\n', 1)[1] if '\n' in p else '').strip()
    lvl = len(head) - len(head.lstrip('#'))
    sections.append((lvl, head.lstrip('# ').strip(), body))

STATUT = {
 'Selena':'ouvert','Danielle':'du','Amandine':'du','Colette':'du','Marie-Annick':'du',
 'David Morin':'du','Jézabelle':'du','Martine':'du','Gilles':'du','Magali':'question',
 'John Belliveau':'bloque','Gabrielle':'merci','Francine':'merci','Estelle':'merci',
 'Mylène':'rien'}
LIB = {'ouvert':'Commande ouverte','du':'Réparation due','question':'Questions',
       'bloque':'Bloqué','merci':'Remerciement','rien':'Ne rien envoyer'}

H, i = [], 0
dossiers_ouverts = False
while i < len(sections):
    lvl, head, body = sections[i]
    if lvl == 1 and head == 'Les quinze dossiers':
        H.append(f'<section class="bande"><h2>{inline(head)}</h2>{blocks(body)}</section>')
        H.append('<div class="dossiers">'); dossiers_ouverts = True
        i += 1; continue
    if lvl == 1 and dossiers_ouverts:
        H.append('</div>'); dossiers_ouverts = False
    if lvl == 2 and dossiers_ouverts:
        num = head.split('.')[0]
        reste = head.split('.', 1)[1].strip()
        bits = [b.strip() for b in reste.split('·')]
        nom = re.sub(r'\*\*|`', '', bits[0]).strip()
        meta = [re.sub(r'\*\*', '', b).strip() for b in bits[1:]]
        st = next((v for k, v in STATUT.items() if k in nom), 'du')
        # sous-sections
        sub, j = [], i + 1
        while j < len(sections) and sections[j][0] == 3:
            sub.append(sections[j]); j += 1
        niveau = ''
        corps = []
        for _, sh, sb in sub:
            if 'systèmes' in sh:
                corps.append(f'<div class="analyse"><h4>Ce que les systèmes établissent</h4>{blocks(sb)}</div>')
            elif sh == 'Le message':
                corps.append(f'<div class="msg"><h4>Le message</h4>{blocks(sb, lettre=True)}</div>')
        m = re.search(r'\*\*Niveau : (.+?)\*\*', body)
        if m: niveau = m.group(1)
        metah = ' '.join(f'<span class="chip">{inline(x)}</span>' for x in meta)
        H.append(f'''<article class="dossier st-{st}" id="d{num}">
<header><div class="num">{num}</div><div><h3>{inline(nom)}</h3><div class="meta">{metah}</div></div>
<div class="pill p-{st}">{LIB[st]}</div></header>
{f'<p class="niveau">{inline(niveau)}</p>' if niveau else ''}
{''.join(corps)}</article>''')
        i = j; continue
    tag = 'h2' if lvl == 1 else 'h3'
    H.append(f'<section class="bande"><{tag}>{inline(head)}</{tag}>{blocks(body)}</section>')
    i += 1
if dossiers_ouverts: H.append('</div>')

corps_html = '\n'.join(H[1:])   # on retire l'intro, reprise dans le hero
intro = blocks(sections[0][2])

CSS = open('/home/user/missive-automations/avis-negatifs/outils/vague-2.css', encoding='utf-8').read()
TPL = open('/home/user/missive-automations/avis-negatifs/outils/vague-2.tpl.html', encoding='utf-8').read()
open(OUT, 'w', encoding='utf-8').write(TPL.replace('/*CSS*/', CSS).replace('<!--INTRO-->', intro).replace('<!--CORPS-->', corps_html))
print('écrit', OUT)
