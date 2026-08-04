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
# Le canal détail, tel que « Détail par ville » le construit : la référence des
# Défricheuses, les quarante villes, le registre des points de vente et le
# calendrier de déploiement.
V='Détail par ville'
bkv=xlcalc.load('pdf1.xlsx'); bka=xlcalc.load('pdf2.xlsx')

def bloc(bk, r0, cols, arret):
    """Lit un bloc de la feuille jusqu'à la ligne qui déclenche `arret`."""
    out, r = [], r0
    while True:
        nom=bk.get(V,f'A{r}')
        if not isinstance(nom,str) or not nom or arret(nom): return out, r
        out.append({k: bk.get(V,f'{c}{r}') for k, c in cols.items()})
        r+=1

villes,_=bloc(bkv, 25, {'ville':'A','prov':'B','pop':'C','en_ligne':'D',
                        'indice':'F','capacite':'G','revenu':'H','total':'I'},
              lambda n: n.startswith('TOTAL'))
for v in villes:
    v['pop']=int(v['pop']); v['en_ligne']=round(v['en_ligne'])
    v['indice']=round(v['indice'],2); v['capacite']=int(v['capacite'])
    v['revenu']=round(v['revenu']); v['total']=round(v['total'])
reg0=25+len(villes)+3
points,rfin=bloc(bkv, reg0, {'ville':'A','rang':'B','revenu':'D',
                             'ouv_c':'E','ouv_a':'F'},
                 lambda n: n.startswith('PLAFOND'))
dep0=rfin+3
out['detail']={
 'defricheuses':[round(bkv.get(V,f'B{5+i}'),2) for i in range(12)],
 'defricheuses_an':round(bkv.get(V,'B17'),2),
 'defricheuses_detail':round(bkv.get(V,'B18'),2),
 'calibre_c':bkv.get(V,'B19'),'calibre_a':bkv.get(V,'B20'),
 'facteur_roc':bkv.get(V,'B23'),
 'villes':villes,
 'nb_points':len(points),
 'plafond':round(bkv.get(V,f'D{rfin}')),
 'marginal_c':round(min(p['revenu'] for p in points
                        if p['ouv_c'] and not str(p['ouv_c']).startswith('non'))),
 'marginal_a':round(min(p['revenu'] for p in points
                        if p['ouv_a'] and not str(p['ouv_a']).startswith('non'))),
 'pos_c':[1.0]+[bkv.get(V,f'B{dep0+1+i}') for i in range(3)],
 'pos_a':[1.0]+[bkv.get(V,f'B{dep0+4+i}') for i in range(3)],
}

# Sensibilité au calibre : c'est le seul jugement du modèle, alors on montre ce
# qu'il coûte de se tromper. Le classeur est recalculé pour chaque valeur.
sens=[]
for cal in (2.0, 3.0, 4.0, 5.0):
    ed=Editor(F); ed.expand_shared()
    ed.set('Inputs','C70',1.0)
    ed.set(V,'B19',cal); ed.set(V,'B20',cal)
    ed.set_full_calc(); ed.save('sens.xlsx')
    bs=xlcalc.load('sens.xlsx')
    sens.append({'calibre':cal,
      'par_pdv':round(bs.get(V,'B22')),
      'detail':round(bs.get(P,'BF12')),
      'ventes':round(bs.get(P,'BF26')),
      'hors':round(bs.get(P,'BF141'))})
out['detail']['sensibilite']=sens

out['fy26_mois']={
 'ventes':[round(bk.get(P,f'{c}26')) for c in 'DEFGHIJKLMNO'],
 'pub':[round(bk.get(P,f'{c}78')) for c in 'DEFGHIJKLMNO'],
}
# Le dernier point de la série historique du mémo. Il doit être sur la MÊME base
# que les quatre précédents, qui viennent des états financiers compilés : le
# revenu après escomptes, plus les revenus de transport. C'est la ligne
# « revenu » d'un état des résultats compilé. Ni la ligne 3 seule (les ventes
# avant escomptes, et amputées du canal détail depuis la reclassification des
# Défricheuses), ni la ligne 18 seule (qui laisse le transport dehors).
out['revenu_total_fy26']=round(bk.get(P,'P18')+bk.get(P,'P21')+bk.get(P,'P22'))
# Main-d'œuvre de production (l.38) : ce que coûte l'isolant fabriqué à la main
# en 2025-2026, contre ce qu'il coûte en rouleau à partir de 2026-2027.
out['mod_production']={'avant':round(bk.get(P,'P38')),'apres':round(bk.get(P,'AD38'))}
# Loyer de l'atelier (l.59) et amortissement de l'équipement et des améliorations
# locatives (l.54 + l.55). Le mémo affirmait un loyer de 88 236 $ en 2026-2027 :
# le chiffrier n'a jamais porté ce montant, à aucune étape de la révision.
out['loyer']=[round(bk.get(P,t+'59')) for t in TOT]
out['amort_atelier']=round(bk.get(P,'P54')+bk.get(P,'P55'))
# La feuille « Sommaire bailleurs » a été retirée du classeur : ces valeurs sont
# soit recalculées depuis le modèle, soit reportées de leur source d'origine
# (Shopify pour les clients et le panier, QuickBooks pour la publicité et la marge).
ALLC=(list('DEFGHIJKLMNO')
      +['R','S','T','U','V','W','X','Y','Z','AA','AB','AC']
      +['AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ']
      +['AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD','BE'])
marge=max(bk.get(P,c+'183') for c in ALLC)
PRET=460000.0
# Le capital marchand à refinancer se lit au bilan du 31 août 2026, pas d'une
# constante : l'échéancier disait 367 479 $ là où QuickBooks montre des soldes
# plus bas au 31 juillet. Le mémo affirmerait sinon un refinancement de
# 62 608 $ de plus que la dette qui existe.
CAPITAL_MARCHAND=round(bk.get(B,'O48')+bk.get(B,'O58'),2)
EDC_AUTORISEE=150000.0
EDC_JUILLET=round(bk.get(P,'N183'),2)
out['sommaire']={
  'cac25':20.11,'cac26':31.88,'aov25':56.47,'aov26':79.92,
  'ltv25':48.76,'ltv26':64.62,'clients25':11509.0,'clients26':8443.0,
  'marge_demandee':round(marge,2),'pret':PRET,
  'shopify_capital':round(bk.get(B,'O48'),2),
  'merchant_growth':round(bk.get(B,'O58'),2),
  'capital_marchand':CAPITAL_MARCHAND,
  'argent_neuf':round(PRET-CAPITAL_MARCHAND+marge,2),
  'encaisse_juil':round(bk.get(B,'N6'),2),
  'tirage_du_mois':round(bk.get(P,'N183')-bk.get(P,'M183'),2),
  'edc_juil':EDC_JUILLET,'coussin':round(EDC_AUTORISEE-EDC_JUILLET,2)}
json.dump(out,open('pdf_data.json','w'),indent=1,ensure_ascii=False)
print(json.dumps(out,indent=1,ensure_ascii=False)[:2600])
