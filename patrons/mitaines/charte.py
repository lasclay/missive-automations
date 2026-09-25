import sys, math, json; sys.path.insert(0,'.')
from dxf import *
R=json.load(open('cotes.json'))
P=pieces('SHELL_LEFT_M.dxf')
p1,p2=P['P3.1']['sew'],P['P3.2']['sew']
x0=min(p[0] for p in p1); x1=max(p[0] for p in p1)
wx=max(n[0] for n in P['P3.1']['notch'])
fx=P['P3.2']['notch'][0][0]+(x1-max(p[0] for p in p2))   # fourche du pouce (cran de P2) dans le repere de P1
S=1.5; OX=300; OY=95
def T(p): return (OX-p[1]*S, OY+(p[0]-x0)*S)
def W(x):
    ys=[];m=len(p1)
    for k in range(m):
        (a1,b1),(a2,b2)=p1[k],p1[(k+1)%m]
        if (a1-x)*(a2-x)<=0 and a1!=a2: ys.append(b1+(b2-b1)*(x-a1)/(a2-a1))
    return min(ys),max(ys)
body='M'+' L'.join(f'{T(p)[0]:.1f},{T(p)[1]:.1f}' for p in p1)+' Z'
# pouce SCHEMATIQUE, cote gauche (y max -> x ecran min), part de la fourche
lo,hi=W(fx); base=T((fx,hi)); b2=T((fx+85,hi))
tip=(base[0]-100,base[1]-48)
thumb=(f'M{base[0]:.1f},{base[1]:.1f} C{base[0]-30:.1f},{base[1]-40:.1f} {tip[0]-5:.1f},{tip[1]-45:.1f} {tip[0]-18:.1f},{tip[1]+2:.1f} '
       f'C{tip[0]-26:.1f},{tip[1]+40:.1f} {b2[0]-60:.1f},{b2[1]-20:.1f} {b2[0]:.1f},{b2[1]:.1f}')
tip=(tip[0]-18,tip[1]+2)
COL={1:'#1f7a3a',2:'#1d4fa3',3:'#c47a00',4:'#0d8a8a',5:'#6a3fb5',6:'#c2185b',7:'#b3261e',8:'#5b3a8e'}
out=[]
def badge(k,x,y): return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="14" fill="white" stroke="{COL[k]}" stroke-width="2.5"/><text x="{x:.1f}" y="{y+6:.1f}" font-size="18" font-weight="700" text-anchor="middle" fill="{COL[k]}">{k}</text>'
def arrS(k,A,B,off=(0,0)):
    out.append(f'<line x1="{A[0]:.1f}" y1="{A[1]:.1f}" x2="{B[0]:.1f}" y2="{B[1]:.1f}" stroke="{COL[k]}" stroke-width="3" marker-start="url(#h{k})" marker-end="url(#h{k})"/>')
    out.append(badge(k,(A[0]+B[0])/2+off[0],(A[1]+B[1])/2+off[1]))
xw=x0+(x1-x0)*0.28; lo,hi=W(xw); arrS(1,T((xw,hi)),T((xw,lo)),(0,-20))
lo,hi=W(x1); arrS(2,(T((x0,lo))[0]+30,T((x0,lo))[1]),(T((x1,lo))[0]+30,T((x1,lo))[1]),(0,0))
arrS(3,(base[0]-4,base[1]+2),(tip[0]+6,tip[1]),(14,-16))
mid=((base[0]+tip[0])/2+8,(base[1]+tip[1])/2+14); arrS(4,(mid[0]-16,mid[1]+30),(mid[0]+14,mid[1]-26),(-30,6))
corner=T((x1,W(x1)[1])); arrS(5,corner,(tip[0]+2,tip[1]+6),(-30,40))
lo,hi=W(wx); arrS(6,T((wx,hi)),T((wx,lo)),(0,-20))
lo,hi=W(x1-3); arrS(7,T((x1-3,hi)),T((x1-3,lo)),(0,-20))
cx=(T((x1,lo))[0]+T((x1,hi))[0])/2; cy=T((x1,lo))[1]+42; rx=abs(T((x1,lo))[0]-T((x1,hi))[0])/2
out.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="15" fill="none" stroke="{COL[8]}" stroke-width="3"/>'+badge(8,cx,cy))
wl=(T((wx,W(wx)[0])),T((wx,W(wx)[1])))
marks=''.join(f'<marker id="h{k}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="{c}"/></marker>' for k,c in COL.items())
NOMS={1:'Largeur hors tout, à la paume',2:'Hauteur hors tout, bout → bas de manchette',3:'Longueur du pouce, fourche → bout',4:'Largeur du pouce, à mi-longueur',
      5:'Coin inférieur → bout du pouce',6:'Largeur au poignet, élastique étiré',7:'Largeur du bas de manchette',8:'Diamètre approx. de la manchette'}
TOL={1:'± 3',2:'± 5',3:'',4:'',5:'',6:'min.',7:'± 3',8:'≈'}
T5=['XS','S','M','L','XL']
X0=590; cw=[320,60,60,60,60,60,56,58]; cx_=[X0]
for w in cw[:-1]: cx_.append(cx_[-1]+w)
y=112; rows=f'<rect x="{X0-8}" y="{y-30}" width="{sum(cw)+16}" height="40" fill="#222"/>'
for j,h in enumerate(['Cote (mm)']+T5+['Tol.','Incr.']):
    rows+=f'<text x="{cx_[j]+(0 if j==0 else cw[j]/2)}" y="{y-4}" font-size="18" font-weight="700" fill="white" text-anchor="{"start" if j==0 else "middle"}">{h}</text>'
y+=16
for k in range(1,9):
    bg='#f3f0e8' if k%2 else '#ffffff'
    rows+=f'<rect x="{X0-8}" y="{y}" width="{sum(cw)+16}" height="54" fill="{bg}"/>'+badge(k,X0+8,y+27)
    rows+=f'<text x="{X0+30}" y="{y+33}" font-size="16" fill="#222">{NOMS[k]}</text>'
    if k in (3,4,5):
        rows+=f'<text x="{cx_[1]+ (cw[1]*5)/2}" y="{y+33}" font-size="16" font-style="italic" text-anchor="middle" fill="#8a5a00">à relever sur la pièce étalon de chaque taille</text>'
    else:
        vals=[R[t][f'c{k}'] for t in T5]; inc=(vals[-1]-vals[0])/4
        for j,v in enumerate(vals):
            b=' font-weight="700"' if T5[j]=='M' else ''
            rows+=f'<text x="{cx_[j+1]+cw[j+1]/2}" y="{y+34}" font-size="21"{b} text-anchor="middle" fill="#111">{round(v)}</text>'
        rows+=f'<text x="{cx_[6]+cw[6]/2}" y="{y+34}" font-size="16" text-anchor="middle" fill="#444">{TOL[k]}</text>'
        rows+=f'<text x="{cx_[7]+cw[7]/2}" y="{y+34}" font-size="16" text-anchor="middle" fill="#444">+{inc:.0f}</text>'
    y+=54
foot=['Mitaine FINIE, posée à plat, paume vers le haut. Millimètres.',
      '6 : étiré à plat, le poignet doit atteindre la valeur. Au repos, noter la valeur de la pièce étalon.',
      '8 : ≈ 2 × cote 7 ÷ 3,14. Incr. : écart d’une taille à la suivante, tailles côte à côte alignées par le bas.',
      '3, 4, 5 : le pouce prend sa forme au montage de P3 et P4 ; ses cotes se relèvent sur la 1re pièce',
      'validée de chaque taille, puis toute la production se compare à elle.',
      'Source : patrons Lectra « Plein air » (lignes de couture), communs aux mitaines polar, laine et cuir.']
foottxt=''.join(f'<text x="{X0-8}" y="{y+30+i*25}" font-size="15" fill="#333">{t}</text>' for i,t in enumerate(foot))
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
<defs>{marks}</defs><rect width="1400" height="900" fill="#fbfaf6"/>
<text x="40" y="50" font-size="30" font-weight="700" fill="#111">Mitaines adultes — cotes finies par taille</text>
<path d="{thumb}" fill="#e6e1d6" stroke="#222" stroke-width="2.5" stroke-dasharray="8 5"/>
<path d="{body}" fill="#e6e1d6" stroke="#222" stroke-width="2.5"/>
<line x1="{wl[0][0]:.1f}" y1="{wl[0][1]:.1f}" x2="{wl[1][0]:.1f}" y2="{wl[1][1]:.1f}" stroke="#777" stroke-width="1.5" stroke-dasharray="3 4"/>
{''.join(out)}
<text x="{T((x1,0))[0]:.1f}" y="{T((x1,0))[1]+88:.1f}" font-size="14" text-anchor="middle" fill="#555">Corps en taille M à l’échelle ; pouce en pointillé : schéma</text>
{rows}{foottxt}</svg>'''
open('charte.svg','w').write(svg)
