import sys, math, json; sys.path.insert(0,'.')
from dxf import *
def near(poly,p): return min(poly,key=lambda q:(q[0]-p[0])**2+(q[1]-p[1])**2)
def dist(a,b): return math.hypot(a[0]-b[0],a[1]-b[1])
def vext(poly,x):
    ys=[];n=len(poly)
    for i in range(n):
        (x1,y1),(x2,y2)=poly[i],poly[(i+1)%n]
        if (x1-x)*(x2-x)<=0 and x1!=x2: ys.append(y1+(y2-y1)*(x-x1)/(x2-x1))
    return ys
R={}
for s in ['XS','S','M','L','XL']:
    P=pieces(f'SHELL_LEFT_{s}.DXF' if s!='M' else 'SHELL_LEFT_M.dxf')
    p1,p3,p4=P['P3.1']['sew'],P['P3.3']['sew'],P['P3.4']['sew']
    xs=[p[0] for p in p1]; x0,x1=min(xs),max(xs)
    wx=max(n[0] for n in P['P3.1']['notch'])
    fourche=near(p3,P['P3.3']['notch'][4])
    bout=min(p3,key=lambda q:q[0])                 # pointe du pouce : vers le bout des doigts
    Lp=fourche[0]-bout[0]                           # longueur le long de l'axe de la mitaine
    xm=(fourche[0]+bout[0])/2; ys=vext(p3,xm); Wlobe=max(ys)-min(ys)
    best=max(((a,b) for a in p4 for b in p4),key=lambda ab:dist(*ab)); L4=dist(*best)
    ax4=((best[1][0]-best[0][0])/L4,(best[1][1]-best[0][1])/L4); nx=(-ax4[1],ax4[0])
    proj=[(q[0]*nx[0]+q[1]*nx[1]) for q in p4]; W4=max(proj)-min(proj)
    coin=(max(p[0] for p in p3),min(p[1] for p in p3))
    D5=dist(coin,bout)
    Wb=max(width_at(p1,x0+(x1-x0)*i/100) for i in range(5,99))
    R[s]=dict(c1=Wb,c2=x1-x0,c3=Lp,c4=W4,c4lobe=Wlobe,c5=D5,c6=width_at(p1,wx),c7=width_at(p1,x1-2),
              c8=2*width_at(p1,x1-2)/math.pi,manchette=x1-wx,pointe_depuis_bout=None)
    print(s,' '.join(f'{k}={v:.1f}' for k,v in R[s].items() if v is not None), 'bout',tuple(round(v) for v in bout),'fourche',tuple(round(v) for v in fourche))
json.dump(R,open('cotes.json','w'),indent=1)
