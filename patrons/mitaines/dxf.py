import ezdxf, math
def pieces(fn):
    doc=ezdxf.readfile(fn); out={}
    for b in doc.blocks:
        if b.name.startswith('*'): continue
        name=None; sew=cut=None; notch=[]; grain=None
        for e in b:
            t=e.dxftype()
            if t=='TEXT' and e.dxf.text.startswith('Piece Name:'): name=e.dxf.text.split(':')[1].strip()
            if t=='POLYLINE':
                pts=[(v.dxf.location[0],v.dxf.location[1]) for v in e.vertices]
                if e.dxf.layer=='14': sew=pts
                if e.dxf.layer=='1': cut=pts
            if t=='POINT' and e.dxf.layer=='4': notch.append(tuple(e.dxf.location)[:2])
            if t=='LINE' and e.dxf.layer=='7': grain=(tuple(e.dxf.start)[:2],tuple(e.dxf.end)[:2])
        out[name]=dict(sew=sew,cut=cut,notch=notch,grain=grain)
    return out
def width_at(poly,x):
    ys=[]
    n=len(poly)
    for i in range(n):
        (x1,y1),(x2,y2)=poly[i],poly[(i+1)%n]
        if (x1-x)*(x2-x)<=0 and x1!=x2:
            ys.append(y1+(y2-y1)*(x-x1)/(x2-x1))
    return (max(ys)-min(ys)) if len(ys)>=2 else 0
