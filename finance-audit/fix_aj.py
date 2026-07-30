#!/usr/bin/env python3
"""Phase AJ — les mentions du scénario prudent, qui n'existe plus."""
import sys
sys.path.insert(0,'tools')
from xledit import Editor
F='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
S='Sommaire bailleurs'; N='Notes d’audit'
e=Editor(F); e.expand_shared()
e.set(S,'A57','• Aucune amélioration du taux de conversion publicitaire n’est supposée : la '
              'publicité reste à 22 %, 20,5 % puis 19,5 % du revenu brut du web.')
e.set(S,'A58','• Les ventes B2B et les produits hors catalogue modélisé (102 469 $ en FY2026) sont')
e.set(S,'A59','  inclus mais ne croissent qu’au rythme des accessoires d’hiver ; le canal détail '
              'de la section 11 s’y ajoute et ne s’y substitue pas.')
e.set(S,'A60','• Le déploiement détail est supposé linéaire sur l’exercice, sans reprise de stock '
              'ni retour de marchandise : ces deux hypothèses sont favorables et il faut les')
e.set(S,'A61','  savoir. Une reprise de 5 % du stock en consignation coûterait environ 12 000 $ '
              'en FY2029.')
e.set(S,'A62','• Les coûts unitaires cibles des fiches Tunisie (13-15 % du prix de vente) ne sont '
              'PAS l’hypothèse retenue : le modèle retient 33 % des ventes nettes en ligne.')
e.set(N,'A50','• Canal détail (consignation au Canada) ajouté au modèle : pilotes dans Inputs '
              'rangées 121 à 138, revenu au résultat rangée 12, points de vente rangée 13, stock '
              'en consignation isolé au bilan rangée 84. Les escomptes, le transport au '
              'consommateur et la publicité restent calculés sur le commerce en ligne seul.')
e.set(N,'A51','• La bascule Inputs!C70 porte désormais deux scénarios : 1 = conservateur réaliste '
              '(bailleurs institutionnels), 2 = ambitieux (investisseur privé). Les anciennes '
              'valeurs du scénario prudent sont conservées en colonne F d’Inputs comme '
              'sensibilité baissière, non branchée.')
e.set_full_calc(); e.save(F)
print(len(e.log),'écritures')
