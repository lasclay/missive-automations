import sys, json
sys.path.insert(0,'tools')
from xledit import Editor
import xlcalc
F='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
P='Résultats-Prev 2025-2029'; B='Bilan2026-27-28'; S='Sommaire bailleurs'
TOT=('P','AD','AR','BF'); YE=('O','AC','AQ','BE')
out={}
for scen,name in ((1,'cons'),(2,'amb')):
    e=Editor(F); e.expand_shared(); e.set('Inputs','C70',float(scen)); e.save(f'pdf{scen}.xlsx')
    bk=xlcalc.load(f'pdf{scen}.xlsx')
    g=lambda sh,a: round(bk.get(sh,a),2)
    out[name]={
      'ventes':[g(P,t+'26') for t in TOT],
      'detail':[g(P,t+'12') for t in TOT],
      'pdv':[g(P,t+'13') for t in TOT],
      'cmv':[g(P,t+'33') for t in TOT],
      'contrib':[g(P,t+'32') for t in TOT],
      'ebitda':[g(P,t+'145') for t in TOT],
      'pai':[g(P,t+'137') for t in TOT],
      'hors':[g(P,t+'141') for t in TOT],
      'aides':[g(P,t+'151') for t in TOT],
      'equity':[g(B,c+'70') for c in YE],
      'dette':[g(S,c+'105') for c in 'BCDE'],
      'dscr':[g(S,c+'102') for c in 'BCDE'],
      'consig':[g(B,c+'84') for c in YE],
      'encaisse':[g(P,t+'189') for t in ('O','AC','AQ','BE')],
      'marge_pic':[g(S,c+'28') if False else g(P,t+'191') for t in TOT],
      'pub':[g(P,t+'78') for t in TOT],
      'masse':[g(S,c+'23') for c in 'BCDE'],
    }
bk=xlcalc.load('pdf1.xlsx')
out['fy26_mois']={
 'ventes':[round(bk.get(P,f'{c}26')) for c in 'DEFGHIJKLMNO'],
 'pub':[round(bk.get(P,f'{c}78')) for c in 'DEFGHIJKLMNO'],
}
out['sommaire']={k:round(bk.get(S,a),2) for k,a in
   (('cac25','B83'),('cac26','C83'),('aov25','B84'),('aov26','C84'),
    ('ltv25','B88'),('ltv26','C88'),('clients25','B81'),('clients26','C81'),
    ('marge_demandee','B49'),('pret','B48'),('argent_neuf','B51'),
    ('encaisse_juin','B128'),('edc_juil','B131'),('coussin','B132'))}
json.dump(out,open('pdf_data.json','w'),indent=1,ensure_ascii=False)
print(json.dumps(out,indent=1,ensure_ascii=False)[:2600])
