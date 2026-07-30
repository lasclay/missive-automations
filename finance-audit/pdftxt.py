# -*- coding: utf-8 -*-
"""Extrait le texte d'un PDF en passant par les tables ToUnicode.

Les flux de ces PDF dessinent le texte en hexadécimal avec des polices
sous-ensemblées : les codes ne sont pas de l'ASCII, il faut la table ToUnicode
de chaque police pour les relire."""
import re
import sys
import pikepdf


def cmap(police):
    """Rend le dictionnaire code -> caractère d'une police."""
    table = {}
    tu = police.get('/ToUnicode')
    if tu is None:
        return table
    txt = tu.read_bytes().decode('latin-1')
    for bloc in re.findall(r'beginbfchar(.*?)endbfchar', txt, re.S):
        for src, dst in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', bloc):
            table[int(src, 16)] = ''.join(
                chr(int(dst[i:i + 4], 16)) for i in range(0, len(dst), 4))
    for bloc in re.findall(r'beginbfrange(.*?)endbfrange', txt, re.S):
        for a, b, d in re.findall(
                r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', bloc):
            a, b, d0 = int(a, 16), int(b, 16), int(d, 16)
            for k in range(a, b + 1):
                table[k] = chr(d0 + k - a)
    return table


def texte(chemin):
    pages = []
    with pikepdf.open(chemin) as pdf:
        for page in pdf.pages:
            polices = {}
            for nom, obj in (page.get('/Resources', {}).get('/Font', {}) or {}).items():
                polices[str(nom)] = cmap(obj)
            try:
                data = page.Contents.read_bytes()
            except Exception:
                data = b''.join(c.read_bytes() for c in page.Contents)
            s = data.decode('latin-1')
            sortie, courante = [], {}
            for m in re.finditer(
                    r'/(\w+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f\s]+)>\s*Tj|\[(.*?)\]\s*TJ'
                    r'|\((?:\\.|[^()\\])*\)\s*Tj|(T\*|Td|TD|ET)', s, re.S):
                if m.group(1):
                    courante = polices.get('/' + m.group(1), {})
                elif m.group(2) is not None:
                    sortie.append(decode(m.group(2), courante))
                elif m.group(3) is not None:
                    for h in re.findall(r'<([0-9A-Fa-f\s]+)>', m.group(3)):
                        sortie.append(decode(h, courante))
                elif m.group(4):
                    sortie.append(' ')
            pages.append(''.join(sortie))
    return pages


def decode(hexa, table):
    h = re.sub(r'\s', '', hexa)
    if len(h) % 4:
        h = h.zfill(len(h) + (4 - len(h) % 4))
    out = []
    for i in range(0, len(h), 4):
        out.append(table.get(int(h[i:i + 4], 16), ''))
    return ''.join(out)


if __name__ == '__main__':
    for i, p in enumerate(texte(sys.argv[1]), 1):
        print(f'\n===== page {i} =====\n{p.strip()}')
