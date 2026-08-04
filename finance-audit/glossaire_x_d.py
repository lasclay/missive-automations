# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, partie D — le catalogue de produits.

Les noms de produits sont ceux de la boutique. Ils sont traduits pour un lecteur
anglophone, mais les marques et les collaborations gardent leur nom : « Monarch
Botanika » et « Gourmet Sauvage » sont des marques, pas des descriptions.
"""

IDENTIQUE = [
    'Parka', 'Tote bag', 'Tote-bag Discontinué', 'T-shirts',
    'Illustrations', 'Horticole', 'Maison', 'maison', 'jardin',
    'Monarch Botanika', 'Gourmet Sauvage',
]

TRADUIT = {
    # ------------------------------------------------------- produits d'hiver
    'Produits hiver:': 'Winter products:',
    'Totaux Produits hiver': 'Winter products total',
    'Mitaines légères': 'Lightweight mittens',
    'Mitaines 3 doigts légères': 'Lightweight 3-finger mittens',
    'Gants légers': 'Lightweight gloves',
    'Manteau doudoune': 'Puffer coat',
    'Veste sans manche': 'Vest',
    'Pantalon de neige': 'Snow pants',
    'Semelles': 'Insoles',
    'Semelles barefoot (larges orteils)': 'Barefoot insoles (wide toe box)',
    'Mitaines bébé': 'Baby mittens',
    'Mitaines enfant': "Children's mittens",
    'Bottes bébé': 'Baby booties',
    'Couverture bébé': 'Baby blanket',
    'Manteau bébé': 'Baby coat',
    'Bandeau sport': 'Sport headband',
    'Bandeau torsade': 'Cable-knit headband',
    'Tuque mode': 'Fashion beanie',
    'Tuque de ville': 'City beanie',
    'Tuque sport': 'Sport beanie',
    'Siège thermal': 'Thermal seat pad',
    'Étui cellulaire': 'Phone case',

    # --------------------------------------------------------- produits d'été
    'Produits été :': 'Summer products:',
    'Totaux Produits été': 'Summer products total',
    'acc. été': 'summer acc.',
    'Glacière': 'Cooler',
    'Glacière sac à dos': 'Backpack cooler',
    'Besace': 'Messenger bag',
    'Sac à vin': 'Wine tote',
    'Sac à lunch': 'Lunch bag',
    'Manchons boissons deluxe (paire)': 'Deluxe drink sleeves (pair)',
    'Manchons canette large': 'Can sleeve, large',
    'Manchons canette petit': 'Can sleeve, small',
    'Manchons slim (pret-a-boire)': 'Slim sleeves (ready-to-drink)',
    'Glacière cube textile (15L)': 'Soft cooler cube (15 L)',
    'Glacière cube textile (30L)': 'Soft cooler cube (30 L)',
    'Glacière cube textile (60L)': 'Soft cooler cube (60 L)',
    'Glacière cube textile (90L)': 'Soft cooler cube (90 L)',
    'Sac de couchage basic': 'Sleeping bag, basic',
    'Oreiller camping': 'Camping pillow',
    'Couvert. camping': 'Camping blanket',
    'Sleeping performance': 'Sleeping bag, performance',

    # ------------------------------------------------------------ horticole
    'Pour le jardin': 'For the garden',
    'Graines': 'Seeds',
    'Paquets de 10': 'Packs of 10',
    "Plants d'asclépiade": 'Milkweed plants',
    "Plants d'asclépiade / service de plantation":
        'Milkweed plants / planting service',
    'Totaux Produits horticoles': 'Horticultural products total',
    '2024 revenu réel': '2024 actual revenue',

    # ---------------------------------------------------------------- maison
    'Pour la maison': 'For the home',
    'Totaux Maison': 'Home products total',
    'Mitaines de four': 'Oven mitts',
    'Sous-plats': 'Trivets',
    'Maniques four': 'Pot holders',
    'Poignées four': 'Oven grips',
    '(paire)': '(pair)',
    'Pantoufle': 'Slipper',
    'Pantoufles': 'Slippers',
    'Pantoufles (modèle discontinué)': 'Slippers (discontinued model)',
    'Tapis pour animaux petit': 'Pet mat, small',
    'Tapis pour animaux moyen': 'Pet mat, medium',
    'Tapis pour animaux grand': 'Pet mat, large',
    'Douillette king (literie)': 'Duvet, king (bedding)',
    'Douillette queen (literie)': 'Duvet, queen (bedding)',
    'Oreiller (literie)': 'Pillow (bedding)',
    'Oreiller long (literie)': 'Body pillow (bedding)',

    # ------------------------------------------------ collabs et dérivés
    'Collabs / produits dérivés': 'Collaborations / merchandise',
    'TOT. Collabs / Produits dérivés': 'Collaborations / merchandise total',
    'prod. dériv.': 'merch.',
    'Crème hydratante Monarch Botanika': 'Monarch Botanika moisturising cream',
    'Nettoyant visage Monarch Botanika': 'Monarch Botanika facial cleanser',
    'Crème contour des yeux Gourmet Sauvage': 'Gourmet Sauvage eye cream',
    "Lotion hydratante huile d'asclépiade": 'Milkweed oil moisturising lotion',
    "Baume à lèvre huile d'asclépiade": 'Milkweed oil lip balm',
    "Crème réparatrice mains huile d'asclépiade":
        'Milkweed oil repairing hand cream',
    'Boucles oreilles asclépiade': 'Milkweed earrings',
    'Pendentif asclépiade': 'Milkweed pendant',
    'Pendentif monarque': 'Monarch pendant',
    'Bague monarque': 'Monarch ring',
    'Couvertures impr. small': 'Printed blanket, small',
    'Couvertures impr. moy.': 'Printed blanket, medium',
    'Couvertures impr. large': 'Printed blanket, large',
    'Casquettes': 'Caps',
    'Porte-clés': 'Keychains',
    'Sous-verres': 'Coasters',
    'Affiches jardin': 'Garden signs',

    # ------------------------------------------------------------- matériaux
    'Matériaux': 'Materials',
    "Soie d'asclépiade vrac": 'Bulk milkweed floss',
}

GLOSSAIRE = {**{s: s for s in IDENTIQUE}, **TRADUIT}
