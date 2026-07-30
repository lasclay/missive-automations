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
      'brut':[g(P,t+'18') for t in TOT],
      'detail':[g(P,t+'12') for t in TOT],
      # Commerce en ligne, en ventes NETTES : le total moins ce que le canal détail
      # encaisse. Sur cette base les deux moteurs s'additionnent exactement au total,
      # ce qui n'est pas le cas du revenu brut (transport net et escomptes s'appliquent
      # au commerce en ligne seul). Le transport net est d'ailleurs bien un coût du
      # commerce en ligne : le détail s'expédie en lots.
      'dtc':[round(bk.get(P,t+'26')-bk.get(P,t+'12'),2) for t in TOT],
      'pdv':[g(P,t+'13') for t in TOT],
      'cmv':[g(P,t+'33') for t in TOT],
      'contrib':[g(P,t+'32') for t in TOT],
      'ebitda':[g(P,t+'145') for t in TOT],
      'pai':[g(P,t+'137') for t in TOT],
      'hors':[g(P,t+'141') for t in TOT],
      'aides':[g(P,t+'151') for t in TOT],
      'equity':[g(B,c+'70') for c in YE],
      'dette':[round(bk.get(B,c+'43')+bk.get(B,c+'60'),2) for c in YE],
      'consig':[g(B,c+'84') for c in YE],
      'encaisse':[g(P,t+'189') for t in ('O','AC','AQ','BE')],
      'marge_pic':[g(S,c+'28') if False else g(P,t+'191') for t in TOT],
      'pub':[g(P,t+'78') for t in TOT],
    }
    # Couverture du service de la dette, recalculée depuis le résultat : la feuille
    # qui la portait a été retirée du classeur. Le capital exclut le refinancement
    # (lignes 174 et 178) et compte l'avance de l'actionnaire par son mouvement net.
    MOIS={'P':('D','O'),'AD':('R','AC'),'AR':('AF','AQ'),'BF':('AT','BE')}
    COLS={'P':list('DEFGHIJKLMNO'),
          'AD':['R','S','T','U','V','W','X','Y','Z','AA','AB','AC'],
          'AR':['AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ'],
          'BF':['AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD','BE']}
    dscr=[]
    for t in TOT:
        interets=bk.get(P,t+'149')
        capital=-(bk.get(P,t+'175')+bk.get(P,t+'177')+bk.get(P,t+'179')
                  +sum(min(0.0,bk.get(P,c+'176')) for c in COLS[t])
                  +min(0.0,bk.get(P,t+'180')))
        service=interets+capital
        dscr.append(round(bk.get(P,t+'145')/service,2) if service else 0.0)
    out[name]['dscr']=dscr
    out[name]['service']=[round(bk.get(P,t+'149'),2) for t in TOT]
bk=xlcalc.load('pdf1.xlsx')
out['fy26_mois']={
 'ventes':[round(bk.get(P,f'{c}26')) for c in 'DEFGHIJKLMNO'],
 'pub':[round(bk.get(P,f'{c}78')) for c in 'DEFGHIJKLMNO'],
}
# La feuille « Sommaire bailleurs » a été retirée du classeur : ces valeurs sont
# soit recalculées depuis le modèle, soit reportées de leur source d'origine
# (Shopify pour les clients et le panier, QuickBooks pour la publicité et la marge).
ALLC=(list('DEFGHIJKLMNO')
      +['R','S','T','U','V','W','X','Y','Z','AA','AB','AC']
      +['AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ']
      +['AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD','BE'])
marge=max(bk.get(P,c+'183') for c in ALLC)
PRET=460000.0; CAPITAL_MARCHAND=367479.0
EDC_AUTORISEE=150000.0; EDC_JUILLET=143026.40
out['sommaire']={
  'cac25':20.11,'cac26':31.88,'aov25':56.47,'aov26':79.92,
  'ltv25':48.76,'ltv26':64.62,'clients25':11509.0,'clients26':8443.0,
  'marge_demandee':round(marge,2),'pret':PRET,
  'argent_neuf':round(PRET-CAPITAL_MARCHAND+marge,2),
  'encaisse_juin':round(bk.get('Bilan2026-27-28','M6'),2),
  'edc_juil':EDC_JUILLET,'coussin':round(EDC_AUTORISEE-EDC_JUILLET,2)}
json.dump(out,open('pdf_data.json','w'),indent=1,ensure_ascii=False)
print(json.dumps(out,indent=1,ensure_ascii=False)[:2600])
