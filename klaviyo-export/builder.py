# -*- coding: utf-8 -*-
# Rebuilds Klaviyo template HTML from the shared skeleton of the base export,
# so only unique content blocks need transcription.
import os

D = os.path.dirname(os.path.abspath(__file__)) + "/campaigns/content/html"
BASE = D + "/01KVE013N0ANFS640GVZSW59XX.html"

base = open(BASE, encoding="utf-8").read()
KC = '<div class="kl-column" style="display:table-cell;vertical-align:top;width:100%;">\n'
parts = base.split(KC)
assert len(parts) == 3, len(parts)
HEAD = parts[0]
ENDCOL = '\n</div>\n<!--[if true]></td><![endif]-->'
main_str, MID = parts[1].split(ENDCOL, 1)
FOOTER, TAIL = parts[2].split(ENDCOL, 1)

SEP = '</div>\n<div class="mj-column-per-100'
raw = main_str.split(SEP)
blocks = []
for i, r in enumerate(raw):
    s = r
    if i > 0:
        s = '<div class="mj-column-per-100' + s
    if i < len(raw) - 1:
        s = s + '</div>'
    blocks.append(s)
assert len(blocks) == 8, len(blocks)
TEXT1, DIVIDER, TEXT2, BUTTON, IMG_PREVENTE, SHADOW, SIGNATURE, IMG_GAB = blocks

CONTENT_OPEN = '<div style="font-family:Arial;font-size:14px;font-style:normal;font-weight:400;letter-spacing:0px;line-height:1.5;text-align:left;color:#222222;">'
CONTENT_CLOSE_MARK = '</div>\n</td>'


def _swap_inner(block, inner):
    start = block.index(CONTENT_OPEN) + len(CONTENT_OPEN)
    end = block.index(CONTENT_CLOSE_MARK, start)
    return block[:start] + inner + block[end:]


def text_v1(inner):
    """Text block with kl-text-table-layout wrapper (outer td padding 0)."""
    return _swap_inner(TEXT1, inner)


def text_v2(inner, pad_top='9px'):
    """Text block with outer td padding (like 'Code rabais')."""
    b = TEXT2
    if pad_top != '9px':
        b = b.replace(
            'padding-top:9px;padding-right:18px;padding-bottom:9px;padding-left:18px;',
            'padding-top:%s;padding-right:18px;padding-bottom:9px;padding-left:18px;' % pad_top, 1)
    return _swap_inner(b, inner)


OLD_A = '<a class="kl-img-link" href="https://lasclay.com/prevente" style="color:#d4ad67; text-decoration:underline; display:block">\n<img src="https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/c20b00b1-55b3-473f-8580-39cc910f70f9.jpeg" style="border:0; height:auto; line-height:100%; max-width:100%; outline:none; text-decoration:none; display:block; font-size:13px; width:100%" width="600"/>\n</a>'


def image_block(href, img_tag):
    """Linked image block; img_tag is the full <img .../> tag."""
    assert OLD_A in IMG_PREVENTE
    new_a = '<a class="kl-img-link" href="%s" style="color:#d4ad67; text-decoration:underline; display:block">\n%s\n</a>' % (href, img_tag)
    return IMG_PREVENTE.replace(OLD_A, new_a)


def image_block_nolink(img_tag):
    """Image block without a link wrapper."""
    assert OLD_A in IMG_PREVENTE
    return IMG_PREVENTE.replace(OLD_A, img_tag)


def button_block(href, label):
    b = BUTTON.replace('https://lasclay.com/prevente', href)
    return b.replace('PRÉCOMMANDER LES PRODUITS LASCLAY', label)


def img_tag(src, alt=None, title=None):
    style = 'border:0; height:auto; line-height:100%; max-width:100%; outline:none; text-decoration:none; display:block; font-size:13px; width:100%'
    p = '<img '
    if alt is not None:
        p += 'alt="%s" ' % alt
    p += 'src="%s" style="%s" ' % (src, style)
    if title is not None:
        p += 'title="%s" ' % title
    p += 'width="600"/>'
    return p


def assemble(block_list, out_name, footer=None):
    body = SEP.join([''] + [b[len('<div class="mj-column-per-100'):] for b in block_list])
    # rebuild join properly: first block has no leading SEP
    body = block_list[0]
    for b in block_list[1:]:
        body += '\n' + b
    html = HEAD + KC + body + ENDCOL + MID + KC + (footer if footer else FOOTER) + ENDCOL + TAIL
    out = D + '/' + out_name
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', out_name, len(html))
