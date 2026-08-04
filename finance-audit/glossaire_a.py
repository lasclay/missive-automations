# -*- coding: utf-8 -*-
"""Glossaire français → anglais du mémo aux bailleurs.

La clé est le segment français EXACT tel qu'il apparaît dans un nœud de texte du
HTML, espaces normalisés. `traduire.py` signale tout segment absent d'ici plutôt
que de le laisser passer en français : c'est ce qui garantit qu'une modification
du mémo français ne peut pas être oubliée du côté anglais.

Les nombres ne sont pas traduits ici — `traduire.py` les reformate
mécaniquement (espace insécable et virgule décimale du français vers virgule des
milliers et point décimal de l'anglais).
"""

GLOSSAIRE = {
# ---------------------------------------------------------------- couverture
"Lasclay · Prévisions financières 2026-2029 · mémo explicatif":
    "Lasclay · Financial projections 2026-2029 · explanatory memo",
"LASCLAY": "LASCLAY",
"MÉMO EXPLICATIF": "EXPLANATORY MEMO",
"Prévisions financières": "Financial projections",
"Ce que le modèle contient, sur quoi il repose, et ce que la restructuration de 2026 change à la trajectoire.":
    "What the model contains, what it rests on, and what the 2026 restructuring changes about the trajectory.",
"Revenu 2025-2026": "Revenue 2025-2026",
"Ventes nettes visées 2028-2029": "Net sales targeted 2028-2029",
"Rentable hors aides publiques": "Profitable excluding public funding",
"Clients depuis 2020": "Customers since 2020",
"CE QUE CONTIENT CE DOCUMENT": "WHAT THIS DOCUMENT CONTAINS",
"L’asclépiade, et ce qu’elle vaut": "Milkweed, and what it is worth",
"Pourquoi tout le monde a échoué avant": "Why everyone failed before",
"Pourquoi nous, et pourquoi ça continue": "Why us, and why it continues",
"Ce que disent six ans de ventes": "What six years of sales say",
"La demande, testée trois fois": "Demand, tested three times",
"Juin et juillet 2026 : le coût du manque de trésorerie":
    "June and July 2026: the cost of running short of cash",
"Le coût de la fibre, et le réseau qui le fera baisser":
    "The cost of the fibre, and the network that will bring it down",
"De la production artisanale à l’isolant en rouleau":
    "From craft production to roll insulation",
"Le marketing et le développement des marchés":
    "Marketing and market development",
"Les coûts fixes et l’infrastructure numérique":
    "Fixed costs and digital infrastructure",
"Deux moteurs, et le plus gros existe déjà":
    "Two engines, and the larger one already exists",
"Le détail au Canada, construit ville par ville":
    "Retail across Canada, built city by city",
"Les quarante villes, et le calendrier": "The forty cities, and the schedule",
"Trois marchés qui ne sont pas dans les chiffres":
    "Three markets that are not in the numbers",
"Les projections : deux scénarios": "The projections: two scenarios",
"Structure de financement et facteurs de risque":
    "Financing structure and risk factors",
"La méthode et les sources": "Method and sources",
"Synthèse": "Summary",
"Deux scénarios dans le même modèle, qu'une seule cellule bascule : conservateur réaliste à 2,78 M$ de ventes nettes en 2028-2029, ambitieux à 3,41 M$. Ni l'un ni l'autre n'inclut de subvention non confirmée.":
    "Two scenarios in the same model, switched by a single cell: realistic conservative at $2.78M of net sales in 2028-2029, ambitious at $3.41M. Neither includes any unconfirmed grant.",
"LES PRODUITS LASCLAY INC. · QUÉBEC (LIMOILOU) · 30 JUILLET 2026":
    "LES PRODUITS LASCLAY INC. · QUÉBEC CITY (LIMOILOU) · 30 JULY 2026",
"Exercice financier du 1": "Fiscal year running from",
"er": "1",
"septembre au 31 août : « 2025-2026 » couvre septembre 2025 à août 2026 · Modèle mensuel de 48 mois rapproché de QuickBooks":
    "September to 31 August: “2025-2026” covers September 2025 to August 2026 · 48-month monthly model reconciled to QuickBooks",

# ------------------------------------------------------------ 01 la matière
"La matière": "The material",
"Une fibre que personne n’a réussi à commercialiser, non pas faute d’acheteurs, mais faute d’avoir su la récolter.":
    "A fibre nobody has managed to commercialise — not for lack of buyers, but for lack of knowing how to harvest it.",
"La plante": "The plant",
"L’asclépiade commune (": "Common milkweed (",
"Asclepias syriaca": "Asclepias syriaca",
") est une vivace indigène d’Amérique du Nord, longtemps éliminée comme mauvaise herbe et aujourd’hui cultivée commercialement au Québec, à une échelle unique au monde. Ses follicules produisent une soie dont la fibre est creuse et":
    ") is a perennial native to North America, long eradicated as a weed and today farmed commercially in Quebec on a scale found nowhere else. Its pods produce a floss whose fibre is hollow and",
"vide à 80 %": "80% empty",
": elle emprisonne l’air, ce qui la rend isolante, légère, hydrophobe, antibactérienne et imputrescible. La Chaire de recherche industrielle sur les matériaux innovants en composites de l’Université de Sherbrooke la décrit comme":
    ": it traps air, which makes it insulating, light, hydrophobic, antibacterial and rot-proof. The Industrial Research Chair on Innovative Composite Materials at Université de Sherbrooke describes it as",
"20 % plus chaude que le duvet d’oie": "20% warmer than goose down",
"à poids égal, et le Groupe CTT a mesuré qu’elle conserve":
    "at equal weight, and Groupe CTT measured that it retains",
"trois fois plus de chaleur que le polyester": "three times more heat than polyester",
"Polyester": "Polyester",
"Laine": "Wool",
"Asclépiade": "Milkweed",
"Duvet": "Down",
"Prix indicatif au kilo des principaux isolants textiles, échelle logarithmique. L’asclépiade se vend au prix du duvet pour une performance supérieure, ce qui la classe parmi les matériaux de luxe et lui ferme les marchés de volume.":
    "Indicative price per kilo of the main textile insulators, logarithmic scale. Milkweed sells at the price of down for higher performance, which classes it among luxury materials and closes volume markets to it.",
"Un mécanisme de conservation mesuré": "A conservation mechanism that has been measured",
"L’asclépiade est l’unique plante hôte des chenilles du monarque, espèce inscrite comme en voie de disparition au Canada. Les colonies mexicaines ont frôlé l’extinction en 2014, puis ont atteint":
    "Milkweed is the sole host plant of monarch caterpillars, a species listed as endangered in Canada. The Mexican colonies came close to extinction in 2014, then reached",
"leur plus haut niveau en vingt ans": "their highest level in twenty years",
"après la plantation de plus de 1 000 hectares d’asclépiade au Québec, en Ontario et aux États-Unis. Le levier n’est pas militant, il est économique : un pilier écosystémique qui ne se restaure que si sa culture devient payante.":
    "after more than 1,000 hectares of milkweed were planted in Quebec, Ontario and the United States. The lever is not activism, it is economics: an ecosystem keystone that is only restored if growing it pays.",
"Une ressource comparable à aucune autre": "A resource comparable to no other",
"Contrairement aux synthétiques fossiles, elle est renouvelable et sa culture stocke du carbone. Contrairement au duvet, à la laine et à la fourrure, elle ne dépend d’aucun élevage. Contrairement au kapok, elle est locale et pousse densément. Contrairement au PLA, elle occupe des terres marginales sans concurrencer l’alimentaire. Contrairement au coton, elle pousse en région nordique sans irrigation, sans engrais et sans insecticide.":
    "Unlike fossil synthetics, it is renewable and growing it stores carbon. Unlike down, wool and fur, it depends on no animal husbandry. Unlike kapok, it is local and grows densely. Unlike PLA, it occupies marginal land without competing with food crops. Unlike cotton, it grows in northern regions with no irrigation, no fertiliser and no insecticide.",
"La demande a toujours été là. De grands joueurs de partout dans le monde se sont intéressés à l’asclépiade. Tous les échecs ont été dus à des déficits technologiques au niveau agricole.":
    "The demand has always been there. Major players from all over the world have taken an interest in milkweed. Every failure came down to technology gaps on the farming side.",
"Ghyslain Bouchard, directeur général de la division asclépiade d’Eko-Terre, quarante-cinq ans de carrière dans le textile, mars 2026":
    "Ghyslain Bouchard, general manager of Eko-Terre’s milkweed division, forty-five years in textiles, March 2026",
"LASCLAY · PRÉVISIONS FINANCIÈRES 2026-2029":
    "LASCLAY · FINANCIAL PROJECTIONS 2026-2029",

# ------------------------------------------------------------- 02 la filière
"La filière": "The supply chain",
"Dix ans de tentatives, et toujours le même mur. Il n’est ni commercial ni technique du côté de l’usine : il est agricole.":
    "Ten years of attempts, always the same wall. It is neither commercial nor technical on the plant side: it is agricultural.",
"La demande n’a jamais manqué": "Demand was never the problem",
"La Garde côtière canadienne et Postes Canada ont habillé leur personnel de vêtements isolés à l’asclépiade. Les Forces armées canadiennes l’ont testée avec succès en Arctique. En 2017, Quartz co. a lancé le premier parka isolé à l’asclépiade à près de 1 000 $ l’unité : vif succès. Chaque fois que la matière est mise en marché, elle trouve preneur.":
    "The Canadian Coast Guard and Canada Post have clothed their staff in milkweed-insulated garments. The Canadian Armed Forces tested it successfully in the Arctic. In 2017, Quartz co. launched the first milkweed-insulated parka at close to $1,000 a unit: an immediate success. Every time the material reaches the market, it finds buyers.",
"Le piège de la fenêtre de récolte": "The harvest-window trap",
"L’asclépiade se récolte dans une fenêtre": "Milkweed is harvested in a window of",
"d’à peine deux semaines": "barely two weeks",
", quand les follicules sont mûrs et pas encore ouverts. La filière s’est construite sur le modèle que connaissent les agriculteurs québécois : de grandes surfaces, de la grosse machinerie. Deux semaines suffisent pourtant à récolter au plus":
    ", when the pods are ripe and not yet open. The supply chain was built on the model Quebec farmers know: large acreage, heavy machinery. Yet two weeks are only enough to harvest at most",
"cinq hectares": "five hectares",
"à la main ou avec de petites machines. Au-delà, il faudrait une récolteuse qui n’existe pas : deux tentatives ont échoué entre 2011 et 2017, et depuis personne ne recommence, faute d’un marché assez grand pour la rentabiliser.":
    "by hand or with small equipment. Beyond that, it would take a harvester that does not exist: two attempts failed between 2011 and 2017, and nobody has tried since, for want of a market large enough to pay for it.",
"Marché trop petit": "Market too small",
"aucun acheteur de volume": "no volume buyer",
"Pas d’investissement": "No investment",
"mécaniser ne se rentabilise pas": "mechanising does not pay for itself",
"Pas de récolte substantielle": "No substantial harvest",
"cinq hectares au mieux": "five hectares at best",
"Prix élevé": "High price",
"tout amortir sur peu de kilos": "everything amortised over few kilos",
"Aucun des acteurs ne peut rompre ce cercle depuis sa position : le cultivateur ne crée pas le marché, et l’usine ne cultive pas.":
    "None of the players can break this circle from where they stand: the grower does not create the market, and the plant does not farm.",
"Le reste suit. Les cultivateurs sèment grand, n’arrivent pas à récolter et abandonnent un par un. Protec-Style fait faillite en 2017 faute d’approvisionnement, Quartz co. discontinue son parka faute de matière. L’asclépiade reste étiquetée comme un matériau de luxe, non parce qu’elle est rare, mais parce que son prix doit porter l’amortissement de ceux qui n’arrivent pas à en vendre.":
    "The rest follows. Growers sow large acreage, cannot harvest it and drop out one by one. Protec-Style went bankrupt in 2017 for lack of supply; Quartz co. discontinued its parka for lack of material. Milkweed stays labelled a luxury material, not because it is scarce, but because its price has to carry the amortisation of those who cannot sell enough of it.",
"La moitié industrielle du problème est réglée": "The industrial half of the problem is solved",
"Eko-Terre, à Cowansville, y a consacré ses efforts depuis 2019. Les techniques antérieures brisaient la fibre à l’extraction et la réduisaient en poussière. La clé s’est révélée être":
    "Eko-Terre, in Cowansville, has worked on it since 2019. Earlier techniques broke the fibre during extraction and reduced it to dust. The key turned out to be",
"le séchage des follicules avant l’extraction": "drying the pods before extraction",
": abaisser le taux d’humidité du follicule entier avant de séparer la fibre des graines permet de décortiquer sans briser. Ce changement d’ordre a donné la membrane Vegeto, un isolant biodégradable sans plastique pétrolier, produit à 200 000 mètres par année.":
    ": lowering the moisture content of the whole pod before separating fibre from seed makes it possible to shell without breaking. That change of order produced the Vegeto membrane, a biodegradable insulator free of petroleum plastic, made at 200,000 metres a year.",
"J’ai perdu tous mes cultivateurs d’asclépiade. Un nouveau cultivateur qui se lance aujourd’hui n’a accès à aucune technologie de récolte, de séchage et d’extraction : il doit tout apprendre seul, à ses frais, pendant des années.":
    "I lost every one of my milkweed growers. A new grower starting today has access to no harvesting, drying or extraction technology: they have to learn it all alone, at their own expense, for years.",
"Ghyslain Bouchard, Eko-Terre, mars 2026": "Ghyslain Bouchard, Eko-Terre, March 2026",
"Voilà l’état de la filière : une usine qui sait transformer la fibre et manque de matière, des terres disponibles dont les propriétaires ne savent pas comment s’y prendre, et personne entre les deux.":
    "That is the state of the chain: a plant that knows how to process the fibre and lacks material, available land whose owners do not know how to go about it, and nobody in between.",

# --------------------------------------------------------- 03 pourquoi nous
"Ce qui distingue Lasclay": "What sets Lasclay apart",
"Tous ceux qui ont échoué étaient excellents dans un maillon. Un agronome, une usine, une marque de manteaux. Aucun ne tenait les deux bouts de la chaîne en même temps, et c’est entre les maillons que la filière casse.":
    "Everyone who failed was excellent at one link. An agronomist, a plant, a coat brand. None held both ends of the chain at once, and it is between the links that this chain breaks.",
"La transdisciplinarité": "Working across disciplines",
"Lasclay va du follicule au colis livré. L’entreprise achète la soie brute à des cultivateurs qu’elle connaît par leur prénom, fabrique l’isolant, conçoit les produits, gère la marque, vend en ligne et répond au service à la clientèle. Personne d’autre dans cette filière ne couvre cette amplitude, et c’est ce qui permet d’agir aux intersections plutôt que d’attendre que le maillon voisin se débloque.":
    "Lasclay goes from pod to delivered parcel. The company buys raw floss from growers it knows by first name, makes the insulation, designs the products, runs the brand, sells online and answers customer service. Nobody else in this chain covers that span, and that is what makes it possible to act at the intersections rather than wait for the neighbouring link to unblock.",
"Gabriel et son équipe ont bâti une entreprise qui maîtrise presque toute la chaîne, de la soie d’asclépiade brute jusqu’à la distribution des produits finis à des particuliers. Ils comprennent les contraintes de la fibre mieux que quiconque. C’est la pièce manquante du puzzle de cette filière.":
    "Gabriel and his team have built a company that masters almost the entire chain, from raw milkweed floss through to distributing finished products to individuals. They understand the constraints of the fibre better than anyone. That is the missing piece of this industry’s puzzle.",
"Ghyslain Bouchard, Eko-Terre, lettre de soutien, mars 2026":
    "Ghyslain Bouchard, Eko-Terre, letter of support, March 2026",
"Une vision moderne du marché": "A modern read on the market",
"Les projets précédents visaient l’appel d’offres institutionnel et le manteau haut de gamme : des marchés qui se gagnent au plus bas prix ou se vendent à mille dollars l’unité, et qui laissent la matière invisible. Lasclay a fait l’inverse. Une marque grand public, une vente directe, une communauté de 70 000 clients, et un produit d’entrée abordable qui fait découvrir la fibre avant de vendre le manteau.":
    "Earlier ventures aimed at institutional tenders and the high-end coat: markets won on lowest price or sold at a thousand dollars a unit, and which leave the material invisible. Lasclay did the opposite. A consumer brand, direct sales, a community of 70,000 customers, and an affordable entry product that introduces the fibre before selling the coat.",
"Des capacités qui manquaient à la filière": "Capabilities the chain was missing",
"Marketing, développement des affaires, développement de produit : trois métiers qu’aucun des acteurs précédents n’avait à l’interne. Soixante-seize produits au catalogue, une gamme construite du sachet de semences à huit dollars jusqu’au manteau, et trois preventes qui ont validé la demande avant d’engager la production.":
    "Marketing, business development, product development: three disciplines none of the earlier players had in house. Seventy-six products in the catalogue, a range built from the eight-dollar seed packet up to the coat, and three pre-sales that validated demand before committing production.",
"Ce que ça change pour la matière": "What that changes for the material",
"Un transformateur industriel achète la fibre au prix que son client final accepte de payer, et ce client est un appel d’offres au plus bas soumissionnaire. Une marque grand public achète au prix que sa clientèle accepte de payer, et cette clientèle achète justement parce que c’est de l’asclépiade cultivée au Québec. Lasclay peut donc soutenir un prix que l’industrie ne peut pas soutenir, et acheter directement aux cultivateurs plutôt qu’au bout d’une chaîne d’intermédiaires.":
    "An industrial processor buys fibre at the price its end customer will pay, and that customer is a lowest-bidder tender. A consumer brand buys at the price its customers will pay, and those customers buy precisely because it is milkweed grown in Quebec. Lasclay can therefore sustain a price the industry cannot, and buy directly from growers rather than at the end of a chain of intermediaries.",
"C’est aussi ce qui rend la suite crédible. Les quatre contraintes techniques décrites plus loin se lèvent parce qu’il existe enfin, dans la filière, une entreprise qui a à la fois la connaissance de la fibre, le marché qui la paie et les compétences commerciales pour le faire croître.":
    "It is also what makes what follows credible. The four technical constraints described further on lift because there is at last, in this chain, a company that has the knowledge of the fibre, the market that pays for it and the commercial skills to grow it.",
}
