# handle: (FR list, EN list). Faits tirés des fiches (description, caractéristiques, dimensions, composition).
P={}
def add(h,fr,en): P[h]=(fr,en)
PRINT_FR=["Illustration de Maude Côté, imprimée à Montréal","Format 8 x 10 po, deux qualités de papier au choix","Papier supérieur: fini mat texturé, 300 g/m², encres résistantes","Production 4 à 5 jours ouvrables, cadre non inclus","Vente finale, non retournable"]
PRINT_EN=["Illustrated by Maude Côté, printed in Montréal","8 x 10 in format, two paper grades to choose from","Premium paper: textured matte finish, 300 gsm, durable inks","4 to 5 business days production, frame not included","Final sale, non-returnable"]
for h in ["asclepias-01-print-8x10","asclepias-02-print-8x10","asclepias-03-print-8x10","asclepias-04-print-8x10","asclepias-05-print-8x10"]: add(h,PRINT_FR,PRINT_EN)
add("danaus-01-print-10x8",[PRINT_FR[0],"Format 10 x 8 po, deux qualités de papier au choix"]+PRINT_FR[2:],[PRINT_EN[0],"10 x 8 in format, two paper grades to choose from"]+PRINT_EN[2:])
add("milkweed-seeds",
 ["11 espèces d'asclépiades indigènes d'Amérique du Nord","Syriaca: 60 à 70 semences par sachet; autres espèces: 30 à 50","Non stratifiées: 30 jours au froid avant le semis du printemps","Plante hôte du monarque, zones de rusticité 3 à 9","Expédié par la poste; vente finale"],
 ["11 native North American milkweed species","Syriaca: 60 to 70 seeds per packet; other species: 30 to 50","Not stratified: 30 days of cold before spring sowing","Monarch host plant, hardiness zones 3 to 9","Shipped by mail; final sale"])
add("milkweed-cooler-backpack-30l",
 ["Glacière sac à dos de 28 litres, environ 40 canettes","Isolant 70 % soie d'asclépiade (250 g), extérieur 100 % coton","Doublure PVC étanche, lavage à la main à l'eau froide","Se roule: 48 cm roulé, 58 cm déroulé","Échange gratuit au Canada"],
 ["28-litre backpack cooler, about 40 cans","70% milkweed floss insulation (250 g), 100% cotton shell","Waterproof PVC lining, hand wash in cold water","Rolls down: 48 cm rolled, 58 cm unrolled","Free exchanges in Canada"])
add("scarf",
 ["Foulard matelassé de 55 x 7 po, cinq couleurs","Tissu doux 85 % viscose de bambou","Isolant végétal: asclépiade du Québec, kapok et PLA","Lavage à la main à l'eau froide, séchage à l'air","Échange gratuit au Canada"],
 ["Quilted scarf, 55 x 7 in, five colours","Soft fabric, 85% bamboo viscose","Plant-based insulation: Québec milkweed, kapok and PLA","Hand wash in cold water, air dry","Free exchanges in Canada"])
add("mittens",
 ["Testées à -32 °C; confort optimal entre -7 et -25 °C","Isolant 85 % soie d'asclépiade, cultivée au Québec","Extérieur coupe-vent et imperméable, tissé au Canada; paume renforcée","Unisexes, cinq tailles, guide des tailles avec photos","Échange gratuit au Canada si la taille ne fait pas"],
 ["Tested at -32°C; optimal comfort between -7 and -25°C","85% milkweed floss insulation, grown in Québec","Windproof, waterproof shell woven in Canada; reinforced palm","Unisex, five sizes, size guide with photos","Free exchange in Canada if the size is wrong"])
add("headband",
 ["Deux styles: torsadé ou sport, extensible","Isolant 70 % soie d'asclépiade","Tour de tête 56 cm, extensible","Lavage à la main à l'eau froide","Échange gratuit au Canada"],
 ["Two styles: twisted or sport, stretchy","70% milkweed floss insulation","Head circumference 56 cm, stretchy","Hand wash in cold water","Free exchanges in Canada"])
add("neckwarmer",
 ["Ajustable par cordon, il reste en place","Isolant 80 % soie d'asclépiade, hydrophobe: ne se mouille pas avec la respiration","Tissu doux 85 % viscose de bambou, cinq couleurs","Hauteur 10 po devant, 6 po derrière","Échange gratuit au Canada"],
 ["Adjustable drawcord, stays in place","80% milkweed floss insulation, water-repellent: does not get wet from your breath","Soft fabric, 85% bamboo viscose, five colours","10 in high in front, 6 in at the back","Free exchanges in Canada"])
add("insulated-tote-bag",
 ["Format compact: quelques canettes ou deux bouteilles de 750 ml","Isolant 70 % soie d'asclépiade, extérieur 100 % coton","Doublure nylon, lavage à la main à l'eau froide","Six couleurs","Échange gratuit au Canada"],
 ["Compact size: a few cans or two 750 ml bottles","70% milkweed floss insulation, 100% cotton shell","Nylon lining, hand wash in cold water","Six colours","Free exchanges in Canada"])
add("lunchbag",
 ["Format lunch: 26 x 22 cm, 32 cm déroulé","Isolant 70 % soie d'asclépiade, extérieur 100 % coton","Doublure PVC étanche, lavage à la main","Fermeture roulée et clip, poignée attachable","Échange gratuit au Canada"],
 ["Lunch size: 26 x 22 cm, 32 cm unrolled","70% milkweed floss insulation, 100% cotton shell","Waterproof PVC lining, hand wash","Roll-top with clip, attachable handle","Free exchanges in Canada"])
add("thermal-insoles",
 ["Isolant végétal: asclépiade du Québec, kapok et PLA","Dessus réfléchissant en Mylar, version plus résistante à l'abrasion","12 pointures, de 5 femme à 14 homme","Bottes ajustées: prendre une pointure en dessous","Prévente, livrable automne 2026"],
 ["Plant-based insulation: Québec milkweed, kapok and PLA","Reflective Mylar top, more abrasion-resistant version","12 sizes, from women's 5 to men's 14","Fitted boots: take one size down","Presale, shipping fall 2026"])
add("besace",
 ["17 litres: quatre bouteilles de vin ou quinze canettes","Isolant 60 % soie d'asclépiade, extérieur 100 % coton","Bandoulière amovible de 74 à 142 cm, poignées, pochette frontale","Doublure nylon, lavage à la main","Échange gratuit au Canada"],
 ["17 litres: four wine bottles or fifteen cans","60% milkweed floss insulation, 100% cotton shell","Removable 74 to 142 cm strap, handles, front pocket","Nylon lining, hand wash","Free exchanges in Canada"])
add("nettoyant-visage-huile-asclepiade",
 ["Base d'aloès et huile de graines d'asclépiade pressée à froid","Nettoie et démaquille sans décaper les huiles naturelles","Parfum frais d'eucalyptus et de menthe","120 ml, par Monarch Botanika","Vente finale sur les cosmétiques ouverts"],
 ["Aloe base with cold-pressed milkweed seed oil","Cleans and removes makeup without stripping natural oils","Fresh eucalyptus and mint scent","120 ml, by Monarch Botanika","Final sale on opened cosmetics"])
add("hydratant-visage-huile-asclepiade",
 ["Base d'aloès et huile de graines d'asclépiade pressée à froid","Tous types de peau, y compris peaux sensibles","Texture légère, une quantité de la taille d'un pois suffit","60 ml, par Monarch Botanika","Vente finale sur les cosmétiques ouverts"],
 ["Aloe base with cold-pressed milkweed seed oil","All skin types, including sensitive skin","Light texture, a pea-sized amount is enough","60 ml, by Monarch Botanika","Final sale on opened cosmetics"])
add("combo-soin-visage-huile-asclepiade",
 ["Nettoyant 120 ml et crème hydratante 60 ml","Base d'aloès et huile de graines d'asclépiade pressée à froid","Deux soins complémentaires, par Monarch Botanika","Vente finale sur les cosmétiques ouverts"],
 ["120 ml cleanser and 60 ml moisturizer","Aloe base with cold-pressed milkweed seed oil","Two complementary products, by Monarch Botanika","Final sale on opened cosmetics"])
add("manchon-isotherme-canettes-bouteilles",
 ["Deux formats: canette 355 ml ou 473 ml, aussi pour café à emporter","Isolant 70 % soie d'asclépiade, pellicule réfléchissante","Extérieur 100 % coton, six couleurs","Lavable à la machine","Échange gratuit au Canada"],
 ["Two sizes: 355 ml or 473 ml can, also for takeout coffee","70% milkweed floss insulation, reflective film","100% cotton shell, six colours","Machine washable","Free exchanges in Canada"])
add("coussin-assise-thermal-pliable",
 ["Isolant 70 % soie d'asclépiade, extérieur 100 % coton","Se plie en quatre: 33 x 10 cm plié, 45 x 33 cm déplié","150 grammes, ganse à velcro pour le transport","Pour randonnée, camping, feux de camp, estrades","Échange gratuit au Canada"],
 ["70% milkweed floss insulation, 100% cotton shell","Folds in four: 33 x 10 cm folded, 45 x 33 cm open","150 grams, velcro strap for carrying","For hiking, camping, campfires, bleachers","Free exchanges in Canada"])
add("sac-bouteille-vin",
 ["Une bouteille de 750 ml, 38 cm de haut","Isolant 70 % soie d'asclépiade, extérieur 100 % coton","Ganse poignée ou bandoulière, ajustable","Six couleurs","Échange gratuit au Canada"],
 ["One 750 ml bottle, 38 cm tall","70% milkweed floss insulation, 100% cotton shell","Strap works as a handle or shoulder strap, adjustable","Six colours","Free exchanges in Canada"])
add("boucles-oreilles-asclepias",
 ["Argent sterling, moulage d'une graine ou d'une fleur d'asclépiade","Deux finis: oxydé et poli, ou argenté","Diamètre 7 mm","Fabriquées sur commande par la joaillère Lucie Veilleux","Prévente; délai d'expédition variable"],
 ["Sterling silver, cast from a real milkweed seed or flower","Two finishes: oxidized and polished, or silver","7 mm diameter","Made to order by jeweller Lucie Veilleux","Presale; shipping time varies"])
add("pendentif-asclepias",
 ["Argent sterling, moulage d'une fleur d'asclépiade commune","Deux finis, chaîne de 16 ou 18 po","Fleur de 7 mm","Fabriqué sur commande par la joaillère Lucie Veilleux","Délai d'expédition variable"],
 ["Sterling silver, cast from a real common milkweed flower","Two finishes, 16 or 18 in chain","7 mm flower","Made to order by jeweller Lucie Veilleux","Shipping time varies"])
add("pendentif-aile-de-monarque",
 ["Argent sterling, aile de monarque miniature","Chaîne de 16 ou 18 po","Fabriqué sur commande par la joaillère Lucie Veilleux","Délai d'expédition variable"],
 ["Sterling silver, miniature monarch wing","16 or 18 in chain","Made to order by jeweller Lucie Veilleux","Shipping time varies"])
add("bague-aile-monarque",
 ["Argent sterling, aile de monarque miniature","Tailles 5 à 9, par demi-pointure","Fabriquée sur commande par la joaillère Lucie Veilleux","Vente finale: vérifiez votre taille avant de commander"],
 ["Sterling silver, miniature monarch wing","Sizes 5 to 9, in half sizes","Made to order by jeweller Lucie Veilleux","Final sale: check your size before ordering"])
add("pantoufles-dasclepiade",
 ["Fin de série: polar légèrement dépareillé, confort intact","Isolant 60 % soie d'asclépiade, dessous antidérapant","Taille S: pointures 8 à 9 femme","Vente finale, sans échange ni remboursement"],
 ["End of series: slightly mismatched fleece, comfort intact","60% milkweed floss insulation, non-slip sole","Size S: women's 8 to 9","Final sale, no exchange or refund"])
add("tuque-ville-asclepiade",
 ["Tricot acrylique avec bandeau amovible isolé à l'asclépiade","Isolant 70 % soie d'asclépiade dans le bandeau","Taille unique, très extensible, couvre les oreilles","Trois couleurs","Échange gratuit au Canada"],
 ["Acrylic knit with a removable milkweed-insulated headband","70% milkweed floss insulation in the headband","One size, very stretchy, covers the ears","Three colours","Free exchanges in Canada"])
add("tuque-sport-asclepiade",
 ["Tissu mince et respirant pour la course, le ski de fond, la raquette","Coussinets isolés à l'asclépiade sur les oreilles (70 % soie)","Deux tailles: S/M et M/L","Lavage à la main ou cycle délicat, séchage à l'air","Échange gratuit au Canada"],
 ["Thin, breathable fabric for running, cross-country skiing, snowshoeing","Milkweed-insulated ear pads (70% floss)","Two sizes: S/M and M/L","Hand wash or delicate cycle, air dry","Free exchanges in Canada"])
add("isolant-asclepiade-soie-amerique",
 ["100 % soie d'asclépiade pure, en vrac","Trois formats: 2,5 g, 5 g ou 15 g","Fibre très légère et volumineuse, naturellement hydrophobe","Pour rembourrage, bricolage, absorption d'huile","Sac refermable pour un rangement sec"],
 ["100% pure milkweed floss, loose","Three sizes: 2.5 g, 5 g or 15 g","Very light, bulky fibre, naturally water-repellent","For stuffing, crafts, oil absorption","Resealable bag for dry storage"])
add("coussin-dassise-thermal-pliable-imparfait",
 ["Défauts esthétiques seulement (taches, pourtour, velcro), 15 % de rabais","Isolant 70 % soie d'asclépiade, extérieur 100 % coton","Se plie en quatre, 150 grammes, ganse à velcro","Vente finale, sans échange ni remboursement"],
 ["Cosmetic flaws only (stains, edge, velcro), 15% off","70% milkweed floss insulation, 100% cotton shell","Folds in four, 150 grams, velcro strap","Final sale, no exchange or refund"])
add("sac-a-lunch-imparfait",
 ["Défauts esthétiques mineurs, 20 % de rabais, couleur au choix de l'atelier","Isolant 70 % soie d'asclépiade, doublure PVC étanche","26 x 22 cm, 32 cm déroulé","Vente finale, sans échange ni remboursement"],
 ["Minor cosmetic flaws, 20% off, colour chosen by the workshop","70% milkweed floss insulation, waterproof PVC lining","26 x 22 cm, 32 cm unrolled","Final sale, no exchange or refund"])
add("manteau-asclepiade",
 ["Manteau 3 saisons style doudoune, léger","Isolant 60 % soie d'asclépiade cultivée au Québec","Coupes femme et homme, XS à 2XL, guide des tailles","Lavable à la machine, cycle délicat, eau froide","Prévente, livrable automne 2026"],
 ["3-season puffer-style jacket, lightweight","60% milkweed floss insulation, grown in Québec","Women's and men's fits, XS to 2XL, size guide","Machine washable, delicate cycle, cold water","Presale, shipping fall 2026"])
add("veste-sans-manche-asclepiade",
 ["Veste 4 saisons style doudoune, légère","Isolant 60 % soie d'asclépiade cultivée au Québec","Coupes femme et homme, XS à 2XL, guide des tailles","Lavable à la machine, cycle délicat, eau froide","Prévente, livrable automne 2026"],
 ["4-season puffer-style vest, lightweight","60% milkweed floss insulation, grown in Québec","Women's and men's fits, XS to 2XL, size guide","Machine washable, delicate cycle, cold water","Presale, shipping fall 2026"])
add("couverture-imprimee-asclepiade-monarques",
 ["Trois motifs: monarque, fleurs d'asclépiade, soies au vent","Trois tailles, de 30 x 40 po à 60 x 80 po","Photographies exclusives de Lasclay","Échange gratuit au Canada"],
 ["Three prints: monarch, milkweed flowers, floss in the wind","Three sizes, from 30 x 40 in to 60 x 80 in","Exclusive Lasclay photographs","Free exchanges in Canada"])
add("manchon-isolant-canettes-slim",
 ["Pour canettes minces de 355 ml","Isolant 50 % soie d'asclépiade, extérieur 100 % coton","Sangle intégrée: support, poignée et attache","Lavable à la machine, cinq couleurs","Échange gratuit au Canada"],
 ["For 355 ml slim cans","50% milkweed floss insulation, 100% cotton shell","Built-in strap: base, handle and clip","Machine washable, five colours","Free exchanges in Canada"])
add("etui-telephone-asclepiade",
 ["Protège le téléphone du froid et du soleil, batterie préservée","Isolant 50 % soie d'asclépiade, extérieur 100 % coton","Intérieur 5 x 9 po, convient à la plupart des appareils avec étui","Fermeture éclair et petite bandoulière incluse","Échange gratuit au Canada"],
 ["Protects your phone from cold and sun, saves the battery","50% milkweed floss insulation, 100% cotton shell","5 x 9 in inside, fits most phones with their case","Zipper and small shoulder strap included","Free exchanges in Canada"])
add("mitaines-ville-asclepiade",
 ["Polar doux et respirant, pour la ville","Isolant végétal: asclépiade du Québec, kapok et PLA","Unisexes, cinq tailles, guide des tailles avec photos","Lavage à l'eau froide, séchage à l'air","Échange gratuit au Canada si la taille ne fait pas"],
 ["Soft, breathable fleece, for the city","Plant-based insulation: Québec milkweed, kapok and PLA","Unisex, five sizes, size guide with photos","Cold wash, air dry","Free exchange in Canada if the size is wrong"])
add("mitaines-bebe-asclepiade",
 ["Pour bébé de 0 à 24 mois","Isolant 62 % laine mérinos et 19 % soie d'asclépiade","Se porte seule ou en surcouche","Lavable à la machine, cycle délicat","Prévente, livrable automne 2026"],
 ["For babies 0 to 24 months","62% merino wool and 19% milkweed floss insulation","Wear alone or as an outer layer","Machine washable, delicate cycle","Presale, shipping fall 2026"])
add("coussin-ecoresponsable-animaux",
 ["Rembourrage 20 % asclépiade et 80 % retailles textiles de notre production","Trois tailles, de 21 x 14,5 po à 41,5 x 31,5 po","Housse amovible 100 % coton, lavable à l'eau froide","Sangles pour le rouler et le transporter","Échange gratuit au Canada"],
 ["Stuffing: 20% milkweed and 80% textile offcuts from our production","Three sizes, from 21 x 14.5 in to 41.5 x 31.5 in","Removable 100% cotton cover, cold wash","Straps to roll it up and carry it","Free exchanges in Canada"])
add("huile-asclepiade",
 ["100 % huile de graines d'asclépiade commune, pressée à froid","Riche en oméga 6, 7 et 9 et en vitamine E","Flacon de verre opaque de 30 ml","Sur la peau ou comme ingrédient de soins maison (3 à 10 %)","Usage externe, garder au réfrigérateur"],
 ["100% common milkweed seed oil, cold-pressed","Rich in omega 6, 7 and 9 and vitamin E","30 ml opaque glass bottle","On the skin or as an ingredient in homemade care (3 to 10%)","External use, keep refrigerated"])
add("isolant-asclepiade-vegan-naturel",
 ["Non-tissé isolant: asclépiade du Québec, kapok et PLA","Deux grammages: 100 g/m² mince ou 200 g/m² (2 cm)","Largeur 150 cm, vendu au demi-mètre ou au mètre","Lavable à la machine, cycle délicat","Fabriqué par Eko-Terre à Cowansville"],
 ["Nonwoven insulation: Québec milkweed, kapok and PLA","Two weights: thin 100 g/m² or 200 g/m² (2 cm)","150 cm wide, sold by the half metre or metre","Machine washable, delicate cycle","Made by Eko-Terre in Cowansville"])
add("bandeau-copy",
 ["Bandeau torsadé en viscose de bambou, extra-doux","Isolant 80 % soie d'asclépiade","Tour de tête 56 cm, extensible; cinq couleurs","Lavage à la main à l'eau froide","Échange gratuit au Canada"],
 ["Twisted headband in bamboo viscose, extra soft","80% milkweed floss insulation","Head circumference 56 cm, stretchy; five colours","Hand wash in cold water","Free exchanges in Canada"])
add("porte-cle-bois-asclepiade-monarque",
 ["Bois de merisier gravé et découpé au laser à notre atelier de Québec","Deux illustrations: soie d'asclépiade ou monarque","1,5 x 2 po","Chaque pièce est unique, nuances du bois variables"],
 ["Birch wood, laser engraved and cut in our Québec City workshop","Two illustrations: milkweed floss or monarch","1.5 x 2 in","Each piece is unique, wood tones vary"])
add("sous-verre-bois-cadeau-asclepiade-monarque",
 ["Bois de merisier gravé et découpé au laser à notre atelier de Québec","Paquets de 2, 4 ou 8","9 cm de diamètre","Chaque pièce est unique, nuances du bois variables"],
 ["Birch wood, laser engraved and cut in our Québec City workshop","Packs of 2, 4 or 8","9 cm diameter","Each piece is unique, wood tones vary"])
add("cache-cou-dasclepiade-imparfait",
 ["Ancienne version non ajustable, dernières unités","Isolant 80 % soie d'asclépiade, viscose de bambou","Hauteur 10 po devant, 6 po derrière","Vente finale, sans échange ni remboursement"],
 ["Previous non-adjustable version, last units","80% milkweed floss insulation, bamboo viscose","10 in high in front, 6 in at the back","Final sale, no exchange or refund"])
add("manchon-isotherme-pour-boissons-imparfait",
 ["Version coton ciré discontinuée, vert forêt","Deux formats: canette 355 ml ou 473 ml","Isolant 70 % soie d'asclépiade, lavable à la machine","Vente finale, sans échange ni remboursement"],
 ["Discontinued waxed cotton version, forest green","Two sizes: 355 ml or 473 ml can","70% milkweed floss insulation, machine washable","Final sale, no exchange or refund"])
add("semelles-interieures-isolantes-en-asclepiade-imparfait",
 ["Ancien modèle, moins durable que la nouvelle version cousue","Isolant 80 % soie d'asclépiade, dessus Mylar feutré","9 pointures, de 6 femme à 12 homme","Bottes ajustées: prendre une pointure en dessous","Vente finale, sans échange ni remboursement"],
 ["Previous model, less durable than the new stitched version","80% milkweed floss insulation, felted Mylar top","9 sizes, from women's 6 to men's 12","Fitted boots: take one size down","Final sale, no exchange or refund"])
add("cache-cou-dasclepiade-imparfait-1",
 ["Cache-cou ajustable avec défauts esthétiques (colle, couture, étiquette)","Isolant 80 % soie d'asclépiade, viscose de bambou","Quatre couleurs","Vente finale, sans échange ni remboursement"],
 ["Adjustable neck warmer with cosmetic flaws (glue, stitching, label)","80% milkweed floss insulation, bamboo viscose","Four colours","Final sale, no exchange or refund"])
add("service-plantation-asclepiade-papillons-monarques",
 ["Plantation chez vous d'asclépiades indigènes, de 25 à 1500 pi²","Plants, aménagement et conseils inclus","Rachat de vos follicules chaque automne","Régions de Québec, Lévis, Trois-Rivières, Drummondville, Victoriaville et environs","30 places pour 2026"],
 ["Native milkweed planted at your place, 25 to 1500 sq ft","Plants, layout and advice included","We buy back your pods every fall","Québec City, Lévis, Trois-Rivières, Drummondville, Victoriaville areas","30 spots for 2026"])
add("creme-contour-yeux-huile-asclepiade",
 ["Huile d'asclépiade du Québec, aloès, argan et chanvre","Texture légère pour le contour de l'œil, matin et soir","Collaboration Gourmet Sauvage et Lasclay","Vente finale sur les cosmétiques ouverts"],
 ["Québec milkweed oil, aloe, argan and hemp","Light texture for the eye area, morning and evening","Gourmet Sauvage and Lasclay collaboration","Final sale on opened cosmetics"])
add("manteau-hiver-asclepiade-quebecoise",
 ["Manteau d'hiver de plein air, capuchon intégré, poche interne","Isolant végétal: asclépiade du Québec, kapok et PLA","Coupes femme et homme, XS à 2XL, guide des tailles","Lavable à la machine, cycle délicat, eau froide","Prévente, livrable automne 2026"],
 ["Winter outdoor jacket, built-in hood, inside pocket","Plant-based insulation: Québec milkweed, kapok and PLA","Women's and men's fits, XS to 2XL, size guide","Machine washable, delicate cycle, cold water","Presale, shipping fall 2026"])
add("sac-couchage-isole-fibre-asclepiade-canadien",
 ["Deux chaleurs: 150 g/m² (0 à 15 °C) ou 250 g/m² (0 à -18 °C)","Isolant végétal hydrophobe: asclépiade du Québec, kapok et PLA","Se dézippe en couverture de taille Queen","190 x 80 cm déroulé","Prévente, livrable automne 2026"],
 ["Two warmths: 150 g/m² (0 to 15°C) or 250 g/m² (0 to -18°C)","Water-repellent plant-based insulation: Québec milkweed, kapok and PLA","Unzips into a queen-size blanket","190 x 80 cm unrolled","Presale, shipping fall 2026"])
add("oreiller-camping-asclepiade-quebecois",
 ["Rembourré de retailles d'isolant d'asclépiade, seconde vie","12 x 16 po, léger et compact","Compagnon du sac de couchage ou du sac de voyage","Prévente, livrable automne 2026"],
 ["Stuffed with milkweed insulation offcuts, a second life","12 x 16 in, light and compact","Companion to the sleeping bag or travel bag","Presale, shipping fall 2026"])
add("oreiller-asclepiade-hypoallergene",
 ["Garni de soie d'asclépiade du Québec, sans matière animale","Fibre hydrophobe: repousse l'humidité, oreiller plus sec","Enveloppe 100 % coton","Deux tailles: standard 20 x 26 po, très grand 20 x 36 po","Prévente, livrable automne 2026"],
 ["Filled with Québec milkweed floss, no animal material","Water-repellent fibre: repels moisture, drier pillow","100% cotton cover","Two sizes: standard 20 x 26 in, king 20 x 36 in","Presale, shipping fall 2026"])
add("gants-magiques-asclepiade",
 ["Gants extensibles doublés de fibre d'asclépiade recyclée","Dextérité conservée, couche mince","Deux tailles: S/M et L/XL","Lavage à l'eau froide, séchage à l'air","Prévente, livrable automne 2026"],
 ["Stretch gloves lined with recycled milkweed fibre","Dexterity preserved, thin layer","Two sizes: S/M and L/XL","Cold wash, air dry","Presale, shipping fall 2026"])
add("mitaines-hiver-asclepiade-laine-cuir-naturel",
 ["Cuir de mouton, doublure laine, isolant à l'asclépiade du Québec","Testées à -32 °C; confort optimal entre -7 et -25 °C","Unisexes, cinq tailles, guide des tailles avec photos","Entretien au chiffon humide, jamais en machine","Prévente, livrable automne 2026"],
 ["Sheepskin leather, wool lining, Québec milkweed insulation","Tested at -32°C; optimal comfort between -7 and -25°C","Unisex, five sizes, size guide with photos","Wipe with a damp cloth, never machine wash","Presale, shipping fall 2026"])
add("chandail-polaire-asclepiade-polar",
 ["Polaire doublée d'asclépiade à la poitrine, au haut du dos et au col","Col montant demi-zip, bas ajustable","Unisexe, coupe ample, S à 2XL","Lavable à la machine, cycle délicat, eau froide","Prévente, livrable automne 2026"],
 ["Fleece lined with milkweed at the chest, upper back and collar","Half-zip high collar, adjustable hem","Unisex, relaxed fit, S to 2XL","Machine washable, delicate cycle, cold water","Presale, shipping fall 2026"])
add("mitaines-hiver-laine-asclepiade-naturelles",
 ["Extérieur et doublure 100 % laine de mouton","Isolant végétal: asclépiade du Québec, kapok et PLA","Unisexes, cinq tailles, guide des tailles avec photos","Lavage à la main à l'eau froide, séchage à plat","Prévente, livrable automne 2026"],
 ["100% sheep's wool shell and lining","Plant-based insulation: Québec milkweed, kapok and PLA","Unisex, five sizes, size guide with photos","Hand wash in cold water, dry flat","Presale, shipping fall 2026"])
add("savon",
 ["Savon à la glycérine avec 6 % d'huile de graines d'asclépiade","Deux parfums botaniques: floral ou boisé; doux ou exfoliant","Coulé à la main à notre atelier de Québec","Paquet découverte: les quatre versions","Prévente; vente finale sur les cosmétiques ouverts"],
 ["Glycerin soap with 6% milkweed seed oil","Two botanical scents: floral or woody; gentle or exfoliating","Hand-poured in our Québec City workshop","Discovery pack: all four versions","Presale; final sale on opened cosmetics"])
add("mitaines-urbaines-isolees-en-asclepiade-ancienne-version",
 ["Ancienne version des mitaines polar, à petit prix","Isolant 50 % soie d'asclépiade cultivée au Québec","Unisexes, cinq tailles, élastique au poignet","Lavage à l'eau froide, séchage à l'air","Vente finale sur les fins de série"],
 ["Previous version of the fleece mittens, at a low price","50% milkweed floss insulation, grown in Québec","Unisex, five sizes, elastic wrist","Cold wash, air dry","Final sale on end-of-series items"])
add("t-shirt-coton-brode-monarque-asclepiade",
 ["100 % coton, broderie au fil qui ne craque pas au lavage","Deux motifs: papillon et asclépiade, ou chenille monarque","Crème ou noir, coupe unisexe, XS à 2XL","Ne contient pas de fibre d'asclépiade","Prévente: production lancée après les commandes"],
 ["100% cotton, thread embroidery that will not crack in the wash","Two designs: butterfly and milkweed, or monarch caterpillar","Cream or black, unisex fit, XS to 2XL","Contains no milkweed fibre","Presale: production starts after orders are in"])
add("shampoing-huile-asclepiade",
 ["Sans sulfates, mousse discrète, ne décape pas","Huile de graines d'asclépiade, coproduit de notre soie du Québec","Floral, boisé ou neutre sans parfum","350 ml, embouteillé à la main à Québec","Prévente; vente finale sur les cosmétiques ouverts"],
 ["Sulfate-free, gentle lather, does not strip","Milkweed seed oil, a co-product of our Québec floss","Floral, woody or unscented","350 ml, hand-bottled in Québec City","Presale; final sale on opened cosmetics"])
add("gel-de-douche-huile-asclepiade",
 ["Sans sulfates, avec aloès et panthénol","Huile de graines d'asclépiade, coproduit de notre soie du Québec","Floral, boisé ou neutre sans parfum","500 ml, embouteillé à la main à Québec","Prévente; vente finale sur les cosmétiques ouverts"],
 ["Sulfate-free, with aloe and panthenol","Milkweed seed oil, a co-product of our Québec floss","Floral, woody or unscented","500 ml, hand-bottled in Québec City","Presale; final sale on opened cosmetics"])
add("savon-liquide-mains-huile-asclepiade",
 ["Assez doux pour des mains lavées dix fois par jour","Aloès, panthénol et huile de graines d'asclépiade","Floral, boisé ou neutre sans parfum","250 ml avec pompe, embouteillé à la main à Québec","Prévente; vente finale sur les cosmétiques ouverts"],
 ["Gentle enough for hands washed ten times a day","Aloe, panthenol and milkweed seed oil","Floral, woody or unscented","250 ml with pump, hand-bottled in Québec City","Presale; final sale on opened cosmetics"])
add("creme-mains-corps-huile-asclepiade",
 ["Crème épaisse pour mains qui travaillent et peau sèche d'hiver","Tournesol, jojoba, limnanthe et 3 % d'huile d'asclépiade","250 ml, empotée à la main à Québec","Prévente; vente finale sur les cosmétiques ouverts"],
 ["Thick cream for working hands and dry winter skin","Sunflower, jojoba, meadowfoam and 3% milkweed oil","250 ml, hand-potted in Québec City","Presale; final sale on opened cosmetics"])
add("pince-a-cheveux-plastique-recycle-asclepiade",
 ["PETG recyclé de nos anciens moules, refondu à Lévis","Version brune au tourteau de graines d'asclépiade, chaque pince unique","Petite (6 cm) pour cheveux fins; moyenne (9 cm) pour chignon","Entièrement fabriquée au Québec","Prévente"],
 ["Recycled PETG from our old moulds, remoulded in Lévis","Brown version with milkweed seed cake, each clip unique","Small (6 cm) for fine hair; medium (9 cm) for a bun","Made entirely in Québec","Presale"])
add("cache-cou-asclepiade-enfant",
 ["Deux tailles: 18 mois à 4 ans, 5 à 14 ans","Sans cordon pour les petits, ajustable dès 5 ans","Viscose de bambou douce; isolant végétal hydrophobe","Lavage à la main à l'eau froide","Prévente"],
 ["Two sizes: 18 months to 4 years, 5 to 14 years","No drawcord for little ones, adjustable from age 5","Soft bamboo viscose; water-repellent plant-based insulation","Hand wash in cold water","Presale"])
add("boite-essai-soins-huile-asclepiade",
 ["Cinq formats d'essai: shampoing 100 ml, gel douche 100 ml, crème 30 ml, deux savons","Huile de graines d'asclépiade, coproduit de notre soie du Québec","Embouteillé à la main à Québec","Formats d'essai non vendus séparément","Prévente; vente finale une fois ouverte"],
 ["Five trial sizes: 100 ml shampoo, 100 ml shower gel, 30 ml cream, two soaps","Milkweed seed oil, a co-product of our Québec floss","Hand-bottled in Québec City","Trial sizes not sold separately","Presale; final sale once opened"])
import json,sys
if __name__=='__main__':
    allp=json.load(open(sys.argv[1]))
    ids={p['handle']:p['id'] for p in allp}
    missing=[h for h in P if h not in ids]; print('inconnus:',missing)
    active=[p['handle'] for p in allp if p['handle'] not in P]; print('sans puces:',active)
    out=[{"handle":h,"id":ids[h],"fr":fr,"en":en} for h,(fr,en) in P.items() if h in ids]
    json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=0); print(len(out))
    bad=[(h,len(fr),len(en)) for h,(fr,en) in P.items() if len(fr)!=len(en) or not 3<=len(fr)<=5]; print('longueurs:',bad)
