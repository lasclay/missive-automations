import math
# Mitaine FINIE, taille M, cote paume. Unites : mm, puis echelle.
W,H=134,310          # largeur, hauteur hors tout
POI=H-92             # ligne du poignet (manchette de 92 mm)
tip_y=108; crotch_y=tip_y+57; tw=43
S=1.85; OX=140; OY=70
def P(x,y): return (OX+x*S, OY+y*S)
def pt(x,y): a,b=P(x,y); return f'{a:.1f},{b:.1f}'
r=W/2
# corps : dome + cotes legerement rentres au poignet, manchette evasee
corps=(f'M{pt(0,r)} C{pt(0,r*0.35)} {pt(r*0.45,0)} {pt(r,0)} C{pt(W-r*0.45,0)} {pt(W,r*0.35)} {pt(W,r)} '
       f'L{pt(W+1,POI-18)} C{pt(W,POI-6)} {pt(W-6,POI)} {pt(W-7,POI+4)} '
       f'L{pt(W+4,H)} L{pt(-4,H)} L{pt(7,POI+4)} C{pt(6,POI)} {pt(0,POI-6)} {pt(-1,POI-18)} Z')
# empiecement de cuir (paume) : bande du haut de paume jusqu'au poignet, cote droit
cuir=f'M{pt(tw-4,95)} L{pt(W,95)} L{pt(W+1,POI-18)} C{pt(W,POI-8)} {pt(W-6,POI-2)} {pt(W-7,POI+2)} L{pt(tw+2,POI+2)} Z'
# pouce : couche le long du bord gauche, depasse un peu
tx=-9; 
pouce=(f'M{pt(-1,POI-10)} C{pt(-10,POI-60)} {pt(-14,tip_y+40)} {pt(-8,tip_y+14)} '
       f'C{pt(-4,tip_y-4)} {pt(14,tip_y-8)} {pt(24,tip_y+2)} '
       f'C{pt(tw-2,tip_y+18)} {pt(tw+2,crotch_y-20)} {pt(tw-4,crotch_y)} '
       f'C{pt(tw-8,crotch_y+22)} {pt(tw-6,POI-24)} {pt(tw-2,POI-4)} L{pt(-1,POI-10)} Z')
# fronces de l'elastique
fr=''.join(f'<path d="M{pt(x,POI-7)} q{2*S:.1f},{7*S:.1f} 0,{14*S:.1f}" fill="none" stroke="#3a3a3a" stroke-width="1.2"/>' for x in range(4,W-3,6))
bouton=f'<rect x="{P(W*0.5-5,POI-6)[0]:.1f}" y="{P(0,POI-6)[1]:.1f}" width="{10*S:.1f}" height="{12*S:.1f}" rx="{3*S:.1f}" fill="#2b2b2b"/>'
COL={1:'#1f7a3a',2:'#1d4fa3',3:'#c47a00',4:'#0d8a8a',5:'#6a3fb5',6:'#c2185b',7:'#b3261e',8:'#5b3a8e'}
out=[]
def badge(k,x,y): return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="15" fill="white" stroke="{COL[k]}" stroke-width="3"/><text x="{x:.1f}" y="{y+6.5:.1f}" font-size="19" font-weight="700" text-anchor="middle" fill="{COL[k]}" font-family="Helvetica,Arial,sans-serif">{k}</text>'
def fl(k,a,b,off=(0,0)):
    A,B=P(*a),P(*b)
    out.append(f'<line x1="{A[0]:.1f}" y1="{A[1]:.1f}" x2="{B[0]:.1f}" y2="{B[1]:.1f}" stroke="{COL[k]}" stroke-width="3.2" marker-start="url(#h{k})" marker-end="url(#h{k})"/>')
    out.append(badge(k,(A[0]+B[0])/2+off[0],(A[1]+B[1])/2+off[1]))
fl(1,(0,62),(W,62),(0,-2))
fl(2,(W+22,0),(W+22,H),(0,-60))
# 3 : bout du pouce -> bas de la mitaine, le long de la couture cote pouce
fl(3,(-4,H),(-7,tip_y+2),(-26,40))
# 4 : largeur du pouce a la jonction avec la main (niveau de la fourche)
fl(4,(-12,crotch_y-6),(tw-5,crotch_y-6),(0,24))
# 5 : largeur du haut du pouce, a 1 cm sous le bout
fl(5,(-7,tip_y+8),(33,tip_y+8),(0,-24))
fl(6,(4,POI+1),(W-4,POI+1),(46,0))
fl(7,(-4,H-3),(W+4,H-3),(0,-26))
# 8 : l'ouverture arrondie en cercle, et son diametre (2 x cote 7 / pi = 91 mm en M)
D8=2*(W+8)/math.pi; cx,cy=P(W/2,H+14+D8/2); rr=D8/2*S
out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rr:.1f}" fill="none" stroke="{COL[8]}" stroke-width="3.2" stroke-dasharray="7 5"/>')
fl(8,(W/2-D8/2,H+14+D8/2),(W/2+D8/2,H+14+D8/2),(0,-24))
marks=''.join(f'<marker id="h{k}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="{c}"/></marker>' for k,c in COL.items())
Wc,Hc=int(P(W+60,0)[0])+10,int(P(0,H+14+D8+30)[1])+10
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{Wc}" height="{Hc}" viewBox="0 0 {Wc} {Hc}">
<defs>{marks}</defs><rect width="{Wc}" height="{Hc}" fill="#fbfaf6"/>
<path d="{corps}" fill="#4a4a4a" stroke="#1a1a1a" stroke-width="2.5" stroke-linejoin="round"/>
<path d="{cuir}" fill="#2f2f2f" stroke="#1a1a1a" stroke-width="1.5"/>
<path d="M{pt(tw-4,95)} L{pt(W,95)}" stroke="#777" stroke-width="1.2" stroke-dasharray="4 3"/>
{fr}{bouton}
<path d="M{pt(-2,H-6)} L{pt(W+2,H-6)}" stroke="#777" stroke-width="1.2" stroke-dasharray="4 3"/>
<path d="{pouce}" fill="#585858" stroke="#1a1a1a" stroke-width="2.5" stroke-linejoin="round"/>
{''.join(out)}
<text x="{P(W/2,0)[0]:.1f}" y="{P(0,H+14+D8+24)[1]:.1f}" font-size="14" text-anchor="middle" fill="#555" font-family="Helvetica,Arial,sans-serif">Mitaine finie, côté paume, posée à plat — taille M à l’échelle</text>
</svg>'''
open('finie.svg','w').write(svg); print(Wc,Hc)
