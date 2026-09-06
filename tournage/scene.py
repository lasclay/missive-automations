# -*- coding: utf-8 -*-
"""Primitives de dessin de cases de storyboard. Canevas 300 x 533 (9:16)."""
import math, random
W, Hh = 300, 533
INK="#1a1a1a"; MID="#8d8d8d"; LT="#d8d4cc"

def _s(d, w=2.0, c=INK, f="none", op=1, dash=None):
    da = f' stroke-dasharray="{dash}"' if dash else ''
    return (f'<path d="{d}" fill="{f}" stroke="{c}" stroke-width="{w}" opacity="{op}" '
            f'stroke-linecap="round" stroke-linejoin="round"{da}/>')

def bg(tone="#ffffff"):
    return f'<rect x="0" y="0" width="{W}" height="{Hh}" fill="{tone}"/>'

def band(y0,y1,tone="#efece5",op=1):
    return f'<rect x="0" y="{y0}" width="{W}" height="{y1-y0}" fill="{tone}" opacity="{op}"/>'

def hatch(y0,y1,step=9,ang=-30,c=LT,w=1.1,op=.9):
    o=[]; t=math.tan(math.radians(ang))
    x=-Hh
    while x < W+Hh:
        o.append(_s(f"M{x} {y1}L{x+(y1-y0)*t} {y0}", w, c, op=op)); x+=step
    return f'<g clip-path="url(#cl)">'+"".join(o)+'</g>'

def ground(y, tone="#e8e4db"):
    return f'<rect x="0" y="{y}" width="{W}" height="{Hh-y}" fill="{tone}"/>' + _s(f"M0 {y}H{W}",1.6,MID)

def horizon(y,c=MID,w=1.4):
    return _s(f"M0 {y}H{W}",w,c)

def road(y, vx=150):
    """route en perspective, ligne d'horizon y"""
    o=[band(y,Hh,"#e6e2d9")]
    o.append(_s(f"M{vx-6} {y}L-60 {Hh}",2,MID))
    o.append(_s(f"M{vx+6} {y}L{W+60} {Hh}",2,MID))
    o.append(_s(f"M{vx} {y+40}L{vx-8} {Hh}",2,LT,dash="14 12"))
    return "".join(o)

def field(y0,y1,n=13,seed=3,pods=True,dry=False):
    r=random.Random(seed); o=[]
    for i in range(n):
        x = 8 + i*(W-16)/(n-1) + r.uniform(-7,7)
        h = (y1-y0)*r.uniform(.55,1.0)
        lean = r.uniform(-10,10)
        top = y1-h
        o.append(_s(f"M{x:.0f} {y1:.0f}Q{x+lean/2:.0f} {(y1+top)/2:.0f} {x+lean:.0f} {top:.0f}",
                    1.7 if h>60 else 1.2, INK if h>60 else MID))
        if not dry:
            for k in (0.45,0.7):
                ly=y1-h*k
                o.append(_s(f"M{x+lean*k:.0f} {ly:.0f}q-12 -5 -16 4",1.2,MID))
                o.append(_s(f"M{x+lean*k:.0f} {ly:.0f}q12 -5 16 4",1.2,MID))
        if pods and h>55 and i%2==0:
            o.append(_s(f"M{x+lean:.0f} {top:.0f}c-8 6 -8 18 0 24c8 -6 8 -18 0 -24z",1.5,INK,
                        "#ffffff" if not dry else "none"))
    return "".join(o)

def pod(x,y,s=1.0,open=0.0,silky=True):
    """gousse ; open 0..1"""
    o=[]
    a=18*s; b=42*s
    if open<=0.05:
        o.append(_s(f"M{x} {y-b}c{-a} {b*.5} {-a} {b*1.1} 0 {b*1.6}"
                    f"c{a} {-b*.5} {a} {-b*1.1} 0 {-b*1.6}z",2.1,INK,"#fff"))
        o.append(_s(f"M{x} {y-b}v{b*1.6}",1.2,MID,dash="5 5"))
    else:
        d=open*13*s
        o.append(_s(f"M{x-d} {y-b}c{-a} {b*.5} {-a} {b*1.1} 0 {b*1.6}"
                    f"q{a*.5} {-b*.3} {a*.55} {-b*1.6}z",2.1,INK,"#fff"))
        o.append(_s(f"M{x+d} {y-b}c{a} {b*.5} {a} {b*1.1} 0 {b*1.6}"
                    f"q{-a*.5} {-b*.3} {-a*.55} {-b*1.6}z",2.1,INK,"#fff"))
        if silky: o.append(silk(x,y-b*.5,s*1.25,n=13,spread=open))
    return "".join(o)

def silk(x,y,s=1.0,n=12,spread=1.0,seed=5):
    r=random.Random(seed); o=[]
    for i in range(n):
        a=math.radians(-90 + (i-(n-1)/2)*(70*spread/max(n-1,1))*2 + r.uniform(-6,6))
        L=(50+r.uniform(-16,22))*s
        x2=x+math.cos(a)*L; y2=y+math.sin(a)*L
        o.append(_s(f"M{x:.0f} {y:.0f}Q{(x+x2)/2+r.uniform(-9,9):.0f} {(y+y2)/2:.0f} {x2:.0f} {y2:.0f}",1.1,MID))
        o.append(f'<circle cx="{x2:.0f}" cy="{y2:.0f}" r="1.5" fill="{MID}"/>')
    return "".join(o)

def tuft(x,y,s=1.0,seed=7):
    return silk(x,y,s,n=9,spread=1.6,seed=seed)

def hand(x,y,s=1.0,rot=0,grip=False):
    """main vue de trois quarts, poignet en bas"""
    k=s
    d=(f"M{x-26*k} {y+58*k}v{-34*k}c0 {-16*k} {6*k} {-24*k} {14*k} {-26*k}"
       f"v{-22*k}c0 {-8*k} {12*k} {-8*k} {12*k} 0v{18*k}"
       f"c0 {-9*k} {12*k} {-9*k} {12*k} 0v{4*k}"
       f"c0 {-8*k} {11*k} {-8*k} {11*k} 0v{6*k}"
       f"c0 {-7*k} {10*k} {-7*k} {10*k} 0v{22*k}"
       f"c0 {18*k} {-12*k} {32*k} {-30*k} {32*k}z")
    g=f'<g transform="rotate({rot} {x} {y})">' + _s(d,2.1,INK,"#fff") + '</g>'
    return g

def person(x, footY, h=180, pose="stand", face=True):
    hd=h*0.14; o=[]
    hy=footY-h+hd
    o.append(f'<circle cx="{x}" cy="{hy:.0f}" r="{hd:.0f}" fill="#fff" stroke="{INK}" stroke-width="2.1"/>')
    ty=hy+hd; hip=footY-h*0.45
    if pose=="crouch":
        hip=footY-h*0.30
        o.append(_s(f"M{x} {ty}V{hip}",2.4))
        o.append(_s(f"M{x} {hip}l{-h*0.16} {h*0.18}l{h*0.05} {h*0.12}",2.2))
        o.append(_s(f"M{x} {hip}l{h*0.14} {h*0.16}l{-h*0.02} {h*0.14}",2.2))
        o.append(_s(f"M{x} {ty+h*0.10}l{-h*0.18} {h*0.16}",2))
        o.append(_s(f"M{x} {ty+h*0.10}l{h*0.10} {h*0.18}",2))
    elif pose=="walk":
        o.append(_s(f"M{x} {ty}V{hip}",2.4))
        o.append(_s(f"M{x} {hip}l{-h*0.13} {h*0.45}",2.2)); o.append(_s(f"M{x} {hip}l{h*0.15} {h*0.45}",2.2))
        o.append(_s(f"M{x} {ty+h*0.09}l{-h*0.16} {h*0.16}",2)); o.append(_s(f"M{x} {ty+h*0.09}l{h*0.14} {h*0.10}",2))
    elif pose=="hold":
        o.append(_s(f"M{x} {ty}V{hip}",2.4))
        o.append(_s(f"M{x} {hip}l{-h*0.08} {h*0.45}",2.2)); o.append(_s(f"M{x} {hip}l{h*0.09} {h*0.45}",2.2))
        o.append(_s(f"M{x} {ty+h*0.08}l{-h*0.17} {h*0.05}l{h*0.03} {h*0.12}",2))
        o.append(_s(f"M{x} {ty+h*0.08}l{h*0.17} {h*0.05}l{-h*0.03} {h*0.12}",2))
    else:
        o.append(_s(f"M{x} {ty}V{hip}",2.4))
        o.append(_s(f"M{x} {hip}l{-h*0.09} {h*0.45}",2.2)); o.append(_s(f"M{x} {hip}l{h*0.09} {h*0.45}",2.2))
        o.append(_s(f"M{x} {ty+h*0.08}l{-h*0.15} {h*0.20}",2)); o.append(_s(f"M{x} {ty+h*0.08}l{h*0.15} {h*0.20}",2))
    if face:
        o.append(f'<circle cx="{x-hd*0.35:.0f}" cy="{hy-hd*0.12:.0f}" r="1.8" fill="{INK}"/>')
        o.append(f'<circle cx="{x+hd*0.35:.0f}" cy="{hy-hd*0.12:.0f}" r="1.8" fill="{INK}"/>')
    return "".join(o)

def table(y, tone="#efece5"):
    return f'<rect x="0" y="{y}" width="{W}" height="{Hh-y}" fill="{tone}"/>' + _s(f"M0 {y}H{W}",2,INK)

def glass(x,y,w=70,h=110,water=.75,bubble=None):
    o=[_s(f"M{x-w/2} {y-h}l{w*0.06} {h}h{w*0.88}l{w*0.06} {-h}z",2.1,INK,"#fff")]
    wy=y-h*(1-0)*0+y-h*water
    o.append(_s(f"M{x-w/2+w*0.03} {wy}h{w*0.94}",1.6,MID))
    if bubble:
        bx,by,br=bubble
        o.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="#fff" stroke="{INK}" stroke-width="1.8"/>')
    return "".join(o)

def rect_obj(x,y,w,h,label=None,r=3,fill="#fff"):
    o=[f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{INK}" stroke-width="2.1"/>']
    if label: o.append(txt(x+w/2,y+h/2+5,label,13,anchor="middle"))
    return "".join(o)

def mitt(x,y,s=1.0):
    k=s
    body=_s(f"M{x-30*k} {y}v{-44*k}c0 {-28*k} {60*k} {-28*k} {60*k} 0v{44*k}z",2.1,INK,"#fff")
    thumb=_s(f"M{x+29*k} {y-40*k}c{18*k} {-8*k} {24*k} {12*k} {6*k} {20*k}z",2.0,INK,"#fff")
    cuff=_s(f"M{x-30*k} {y-12*k}h{60*k}",1.6,MID)
    return thumb+body+cuff

def coat(x,y,s=1.0):
    k=s
    body=_s(f"M{x-34*k} {y}l{2*k} {-94*k}l{14*k} {-14*k}q{18*k} {10*k} {36*k} 0l{14*k} {14*k}l{2*k} {94*k}z",2.1,INK,"#fff")
    slL=_s(f"M{x-32*k} {y-106*k}l{-22*k} {14*k}l{-6*k} {70*k}l{20*k} {6*k}l{10*k} {-66*k}z",2.0,INK,"#fff")
    slR=_s(f"M{x+32*k} {y-106*k}l{22*k} {14*k}l{6*k} {70*k}l{-20*k} {6*k}l{-10*k} {-66*k}z",2.0,INK,"#fff")
    col=_s(f"M{x-16*k} {y-108*k}q{16*k} {14*k} {32*k} 0",2.0,INK)
    zip_=_s(f"M{x} {y-98*k}V{y-4*k}",1.4,MID,dash="6 5")
    return slL+slR+body+col+zip_

def thermo(x,y,s=1.0,val=""):
    k=s; o=[_s(f"M{x-7*k} {y-70*k}h{14*k}v{52*k}h{-14*k}z",2,INK,"#fff")]
    o.append(f'<circle cx="{x}" cy="{y-8*k}" r="{11*k}" fill="#fff" stroke="{INK}" stroke-width="2"/>')
    o.append(_s(f"M{x} {y-8*k}v{-46*k}",4,INK))
    if val: o.append(txt(x+18*k,y-46*k,val,15))
    return "".join(o)

def machine(x,y,s=1.0):
    k=s
    o=[rect_obj(x-52*k,y-70*k,104*k,70*k)]
    o.append(f'<circle cx="{x}" cy="{y-36*k}" r="{22*k}" fill="none" stroke="{INK}" stroke-width="2.1"/>')
    o.append(f'<circle cx="{x}" cy="{y-36*k}" r="{7*k}" fill="{INK}"/>')
    for a in range(0,360,45):
        ar=math.radians(a)
        o.append(_s(f"M{x+math.cos(ar)*24*k:.0f} {y-36*k+math.sin(ar)*24*k:.0f}"
                    f"l{math.cos(ar)*9*k:.0f} {math.sin(ar)*9*k:.0f}",1.6,MID))
    return "".join(o)

def roll(x,y,s=1.0):
    k=s
    o=[f'<circle cx="{x}" cy="{y}" r="{40*k}" fill="#fff" stroke="{INK}" stroke-width="2.1"/>',
       f'<circle cx="{x}" cy="{y}" r="{12*k}" fill="none" stroke="{MID}" stroke-width="1.6"/>']
    o.append(_s(f"M{x+40*k} {y-14*k}H{W}M{x+40*k} {y+14*k}H{W}",2,INK))
    return "".join(o)

def microview(x,y,r=78):
    o=[f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" stroke="{INK}" stroke-width="2.4"/>']
    rr=random.Random(11)
    for i in range(5):
        a=rr.uniform(0,math.pi); L=r*1.7
        ox=x+rr.uniform(-r*.5,r*.5); oy=y+rr.uniform(-r*.5,r*.5)
        dx,dy=math.cos(a)*L/2, math.sin(a)*L/2
        for off in (-5,5):
            nx,ny=-math.sin(a)*off, math.cos(a)*off
            o.append(f'<g clip-path="url(#mc{int(x)}_{int(y)})">'
                     + _s(f"M{ox-dx+nx:.0f} {oy-dy+ny:.0f}L{ox+dx+nx:.0f} {oy+dy+ny:.0f}",1.6,INK)+'</g>')
    o.append(f'<defs><clipPath id="mc{int(x)}_{int(y)}"><circle cx="{x}" cy="{y}" r="{r-2}"/></clipPath></defs>')
    return "".join(o)

def arrow(x1,y1,x2,y2,label=None,c="#b4531f"):
    a=math.atan2(y2-y1,x2-x1); L=12
    o=[_s(f"M{x1} {y1}L{x2} {y2}",2.4,c),
       _s(f"M{x2} {y2}l{-L*math.cos(a-.4):.0f} {-L*math.sin(a-.4):.0f}"
          f"M{x2} {y2}l{-L*math.cos(a+.4):.0f} {-L*math.sin(a+.4):.0f}",2.4,c)]
    if label: o.append(txt((x1+x2)/2,(y1+y2)/2-8,label,13,c,"middle"))
    return "".join(o)

def bokeh(n=9,y0=40,y1=300,seed=2):
    r=random.Random(seed)
    return "".join(f'<circle cx="{r.uniform(10,W-10):.0f}" cy="{r.uniform(y0,y1):.0f}" '
                   f'r="{r.uniform(4,13):.0f}" fill="{LT}" opacity=".8"/>' for _ in range(n))

def sun(x,y,r=26):
    o=[f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" stroke="{INK}" stroke-width="2"/>']
    for a in range(0,360,30):
        ar=math.radians(a)
        o.append(_s(f"M{x+math.cos(ar)*(r+7):.0f} {y+math.sin(ar)*(r+7):.0f}"
                    f"l{math.cos(ar)*11:.0f} {math.sin(ar)*11:.0f}",1.6,MID))
    return "".join(o)

def txt(x,y,s,size=14,c=INK,anchor="start",weight="400"):
    import html
    return (f'<text x="{x}" y="{y}" font-family="Liberation Sans,Helvetica,sans-serif" '
            f'font-size="{size}" fill="{c}" text-anchor="{anchor}" font-weight="{weight}">'
            f'{html.escape(s)}</text>')

def carton(lines, y=110, size=30, c=INK):
    """gros texte incrusté à l'écran"""
    o=[]
    for i,l in enumerate(lines):
        o.append(txt(W/2, y+i*(size+6), l, size, c, "middle", "700"))
    return "".join(o)

def sub(text, size=16):
    """barre de sous-titre incrustée, en bas du cadre"""
    if not text: return ""
    import textwrap
    lines = textwrap.wrap(text, 30) or [text]
    lines = lines[:3]
    hgt = 12 + len(lines)*(size+4)
    y0 = Hh - hgt - 16
    o=[f'<rect x="10" y="{y0}" width="{W-20}" height="{hgt}" fill="#111" opacity=".82" rx="3"/>']
    for i,l in enumerate(lines):
        o.append(txt(W/2, y0+18+i*(size+4), l, size, "#fff", "middle", "700"))
    return "".join(o)

def vign():
    return (f'<rect x="0" y="0" width="{W}" height="{Hh}" fill="none" stroke="#000" '
            f'stroke-width="26" opacity=".05"/>')

def clip():
    return f'<defs><clipPath id="cl"><rect x="0" y="0" width="{W}" height="{Hh}"/></clipPath></defs>'

def leaf(x,y,s=1.0,rot=0):
    k=s
    d=(f"M{x} {y}c{-30*k} {-6*k} {-46*k} {-30*k} {-46*k} {-46*k}"
       f"c{18*k} {-4*k} {44*k} {10*k} {46*k} {46*k}"
       f"c{2*k} {-36*k} {28*k} {-50*k} {46*k} {-46*k}"
       f"c0 {16*k} {-16*k} {40*k} {-46*k} {46*k}z")
    return f'<g transform="rotate({rot} {x} {y})">'+_s(d,2.0,INK,"#fff")+_s(f"M{x} {y}v{-46*k}",1.2,MID)+'</g>'

def caterpillar(x,y,s=1.0,n=6):
    k=s; o=[]
    for i in range(n):
        cx=x+i*17*k
        o.append(f'<circle cx="{cx:.0f}" cy="{y-abs(math.sin(i*.9))*4*k:.0f}" r="{10*k:.0f}" '
                 f'fill="#fff" stroke="{INK}" stroke-width="2"/>')
    for i in range(1,n,2):
        cx=x+i*17*k
        o.append(_s(f"M{cx:.0f} {y+9*k:.0f}v{6*k}",1.6,INK))
    o.append(_s(f"M{x-4*k} {y-9*k}v{-13*k}M{x+5*k} {y-9*k}v{-13*k}",1.6,INK))
    return "".join(o)

def cube(x,y,s=1.0,melt=0.0):
    k=s*(1-melt*.55)
    o=[_s(f"M{x-26*k} {y}v{-40*k}h{52*k}v{40*k}z",2.1,INK,"#fff"),
       _s(f"M{x-26*k} {y-40*k}l{10*k} {-10*k}h{52*k}l{-10*k} {10*k}",1.8,INK,"#fff"),
       _s(f"M{x+26*k} {y}l{10*k} {-10*k}v{-40*k}",1.8,INK,"#fff")]
    if melt>.05:
        o.append(_s(f"M{x-40*k} {y}q{40*k} {12*k} {80*k} 0",1.6,MID))
    return "".join(o)

def scalep(x,y,s=1.0,val=""):
    k=s
    o=[rect_obj(x-56*k,y-30*k,112*k,30*k,None,4)]
    o.append(rect_obj(x-40*k,y-64*k,80*k,26*k,val,3,"#f5f3ee"))
    o.append(_s(f"M{x-46*k} {y-30*k}h{92*k}",1.6,MID))
    return "".join(o)

def snow(n=26,seed=4):
    r=random.Random(seed)
    return "".join(f'<circle cx="{r.uniform(4,W-4):.0f}" cy="{r.uniform(4,Hh-90):.0f}" '
                   f'r="{r.uniform(1.4,3.4):.1f}" fill="{MID}" opacity=".8"/>' for _ in range(n))

def thermal(y0=60,y1=420):
    """dégradé schématique de caméra thermique"""
    o=[f'<rect x="20" y="{y0}" width="{W-40}" height="{y1-y0}" fill="#f0eee8" stroke="{INK}" stroke-width="2"/>']
    for i,ry in enumerate(range(y0+14,y1-10,26)):
        o.append(_s(f"M34 {ry}H{W-34}",5,INK if i%3==0 else MID,op=.5 if i%3 else .9,dash="3 9"))
    o.append(_s(f"M{W-52} {y1+18}h32M{W-52} {y1+30}h32",5,INK))
    o.append(txt(24,y1+34,"FROID",11,MID)); o.append(txt(W-96,y1+34,"CHAUD",11,INK))
    return "".join(o)

def phone(x,y,s=1.0,inner=""):
    k=s
    o=[rect_obj(x-52*k,y-92*k,104*k,184*k,None,9,"#fff")]
    o.append(f'<g transform="translate({x-46*k},{y-84*k}) scale({92*k/300:.4f},{168*k/533:.4f})">{inner}</g>')
    return "".join(o)

def presentoir(x,y,s=1.0,n=6):
    k=s
    o=[rect_obj(x-58*k,y-96*k,116*k,96*k,None,3,"#f7f6f2")]
    for r_ in range(3):
        for c_ in range(2):
            o.append(rect_obj(x-44*k+c_*46*k,y-84*k+r_*30*k,34*k,22*k,None,2))
    return "".join(o)
