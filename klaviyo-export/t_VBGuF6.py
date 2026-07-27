# -*- coding: utf-8 -*-
import builder as B

Z = "​"
AR = "<span style=\"font-size: 14px; font-family: Arial, sans-serif; color: rgb(0, 0, 0);\">"
AR18 = "<span style=\"font-size: 18px; font-family: Arial, sans-serif; color: rgb(0, 0, 0);\">"
AR2 = "<span style=\"font-family: Arial, sans-serif; color: rgb(0, 0, 0);\">"
ARB = "<span style=\"font-weight: bold; font-family: Arial, sans-serif; color: rgb(0, 0, 0);\">"
LH = "<div style=\"line-height: 138%;\">"
F14 = "<span style=\"font-size: 14px;\">"
P1S = "<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">"
H3 = "<h3 style=\"color:#222; font-family:Geneva, Arial; font-size:24px; font-style:normal; font-weight:bold; letter-spacing:0; line-height:138%; margin:0; margin-bottom:12px; text-align:left\">"

def A(href, txt):
    return "<a href=\"%s\" style=\"color:#d4ad67; text-decoration:underline\">%s</a>" % (href, txt)

t1 = ("<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\"><span data-key=\"3\" data-slate-object=\"text\"></span></p>\n"
      "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">Bonjour {{ first_name }},</p>")

t2 = ("<div><span style=\"font-size: 1px;\"><!--StartFragment--></span></div>\n"
      + LH + AR + "Avec le printemps bien avancé et l’été qui se fait désirer, il nous fait grand plaisir de lancer notre prévente d’été 2026 de produits d'asclépiade! <strong>Nous avons aussi quelques annonces en fin de courriel, si vous souhaitez y sauter directement.</strong></span></div>\n"
      "<div>" + F14 + " </span></div>\n"
      + LH + AR + "Dès maintenant, il est possible de précommander <strong>nos produits d’été et toute saison avec des rabais très intéressants.</strong></span></div>\n"
      + LH + AR + " </span></div>\n"
      + LH + AR + "Voici une petite présentation de chacun de ces produits, qui vous feront apprécier la très isolante soie d’asclépiade dans un tout autre contexte que l’hiver, pour lequel elle est devenue presque légendaire. <em><strong>PS: chaque titre est cliquable pour voir le produit sur notre site web et à la fin du courriel se trouvent des images et un lien vers notre catalogue complet!</strong></em></span></div>\n"
      "<div> </div>\n"
      "<div><strong>" + A("https://lasclay.com/collections/manchons-isothermes-boissons-canettes", "Manchons isothermes pour boissons") + "<br/>30% de rabais sur les 3 formats<br/></strong></div>\n"
      + LH + AR + "Petit, pratique, et redoutablement efficace : il garde votre boisson à la température initiale pendant plusieurs heures, qu’elle soit chaude ou froide. Terminé les cafés tièdes ou les bières chaudes qu’on boit à contrecœur pour ne pas gaspiller! ! </span></div>\n"
      "<div> </div>\n"
      "<!--StartFragment-->\n"
      "<div><strong>" + A("https://lasclay.com/products/lunchbag", "Sac à lunch ") + "<br/>20% de rabais sur 1 (-12$), 30% pour 2 et + (-18$)<br/></strong></div>\n"
      "<!--EndFragment-->\n"
      + LH + AR + "Notre sac à lunch utilise l’isolation très performante de l’asclépiade pour garder vos repas frais jusqu’à l’heure du lunch, même en pleine canicule et sans “ice pack”, selon les témoignages de plusieurs clients satisfaits. Facile à nettoyer avec son intérieur “dry bag” indéchirable, il est vite devenu un indispensable du quotidien pour des milliers de clients. C’est de loin notre meilleur vendeur au niveau des sacs isothermes.</span></div>\n"
      "<div>" + F14 + " </span></div>\n"
      + LH + "<strong>" + AR + A("https://lasclay.com/products/insulated-tote-bag", "Sac isotherme “tote bag”") + "<br/>25% de rabais sur les noirs</span></strong></div>\n"
      + LH + AR + "L’allié parfait des virées au marché, des pique-niques ou des cueillettes. Léger, spacieux, il accueille plusieurs aliments, boissons, et même deux bouteilles de vin. Fraîcheur et style réunis.</span></div>\n"
      "<div>" + F14 + " </span></div>\n"
      + LH + F14 + "<strong>" + AR2 + A("https://lasclay.com/products/milkweed-cooler-backpack-30l", "Sac à dos glacière 30L") + "</span></strong>" + ARB + "<br/></span><strong>" + AR2 + "20% de rabais sur 1 (-20$), 30% pour 2 et + (-30$)</span></strong></span></div>\n"
      + LH + F14 + AR2 + "Conçu pour les sorties d’un jour ou le camping, ce sac à dos minimaliste offre la performance d’une glacière rigide, dans un format flexible et pratique. Plusieurs de nos clients l’utilisent d’ailleurs comme sac frais et sec pour les fruits et légumes en camping. Sans glace, il peut garder les végétaux au frais et au sec jusqu’à une semaine. Ça fera changement des tomates détrempées au fond de la glacière!</span></span></div>\n"
      + LH + F14 + AR2 + " </span></span></div>\n"
      + LH + F14 + "<strong>" + AR2 + AR2 + A("https://lasclay.com/products/sac-bouteille-vin", "Sac à bouteille de vin") + "</span></span></strong>" + ARB + "<br/></span><em>" + ARB + "Liquidation - 55% de rabais</span></em></span></div>\n"
      + LH + F14 + AR2 + "Transportez votre vin en toute élégance tout en le gardant à la bonne température, que ce soit pour un souper d’amis ou un pique-nique improvisé. Plus simple et plus propre que le seau de glace!</span>" + AR2 + "<br/></span>" + A("https://lasclay.com/products/coussin-assise-thermal-pliable", Z) + "</span></div>\n"
      "<div>" + F14 + " </span></div>\n"
      "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em; line-height:138%\"><span style=\"font-size: 18px;\"><strong>" + AR2 + "Une collaboration prometteuse</span></strong></span>" + F14 + "<strong><a href=\"https://lasclay.com/products/creme-contour-yeux-huile-asclepiade\" style=\"color:#d4ad67; text-decoration:underline\"><!--StartFragment--></a></strong></span></p>\n"
      "<div><strong>" + A("https://lasclay.com/products/creme-contour-yeux-huile-asclepiade", "Crème contour des yeux à base d’huile de graines d’asclépiade - Collab avec Gourmet Sauvage") + "</strong></div>\n"
      "<!--EndFragment--><!--EndFragment-->\n"
      "<div>" + ARB + "<br/></span>" + AR2 + "Lancé la semaine dernière, ce produit est extrêmement riche en omégas, antioxydants et en formes rares de vitamine E hydratante, extraite des graines de l’asclépiade. <strong>Nous avons presque écoulé notre première commande de 150 pots. Il n'en reste que quelques-unes!</strong></span></div>\n"
      "<div>" + F14 + "<!--EndFragment--></span></div>")

t6 = ("<!--StartFragment-->\n"
      + H3 + AR18 + " </span></h3>\n"
      + H3 + AR18 + "L’asclépiade, à la croisée des chemins?</span></h3>\n"
      + LH + F14 + AR2 + "Nous sommes véritablement à un moment charnière pour l’asclépiade au Québec et pour notre entreprise. <strong>Des 125 cultivateurs qui s’étaient lancés dans cette grande aventure en 2014, il n’en reste à peine une douzaine.<br/></strong></span></span></div>\n"
      + LH + F14 + AR2 + " </span></span></div>\n"
      + LH + F14 + AR2 + "Il faut préserver cette culture innovante et écoresponsable au Québec, car elle sert d’habitat d'urgence pour le papillon monarque menacé. Chez Lasclay, nous croyons fermement au futur de l’asclépiade comme fleuron d'envergure mondiale pour le Québec. Les produits et les technologies que nous créons à une vitesse grandissante prouvent, petit à petit, le potentiel de cette belle plante. Mais tout ça ne serait rien sans la demande, sans le soutien de notre belle clientèle.</span></span></div>\n"
      + LH + F14 + AR2 + " </span></span></div>\n"
      + LH + "<strong>" + F14 + AR2 + "Acheter des produits d’asclépiade, c'est soutenir directement pour les agriculteurs pionniers de cette culture salvatrice pour le monarque et les terres marginales de nos régions.</span></span></strong></div>\n"
      + LH + F14 + AR2 + " </span></span></div>\n"
      + LH + "<!--StartFragment--><span style=\"font-size: 18px;\">" + AR2 + "<strong>Nous aurons dans les prochaines semaines d'importantes annonces à faire sur l'avenir de notre entreprise et de la culture de l'asclépiade. C'est du positif, mais ce sont de grosses nouvelles. Restez à l'affût. 😉</strong></span></span><!--EndFragment--></div>\n"
      "<!--EndFragment-->")

sig = (P1S + "<span data-key=\"3\" data-slate-object=\"text\">" + AR + " </span></span></p>\n"
       + P1S + "<span data-key=\"3\" data-slate-object=\"text\">" + AR + "Bonne fin de semaine {{ first_name }}, et merci de nous soutenir dans cette aventure. On apprécie vraiment. 🧡</span><!--EndFragment--></span></p>\n"
       + P1S + "Chaleureusement,</p>\n"
       "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\"><strong>Gabriel</strong><br/>Co-fondateur<br/>Lasclay </p>")

blocks = [
    B.text_v1(t1),
    B.text_v1(t2),
    B.button_block("https://lasclay.com/collections/collabs", "Voir la section Collaborations de Lasclay"),
    B.image_block("https://lasclay.com/products/creme-contour-yeux-huile-asclepiade", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/90c31f98-03c8-4a8b-9963-dedc8391e0fa.jpeg")),
    B.SHADOW,
    B.text_v2(t6),
    B.button_block("https://lasclay.com/collections/produits-products", "Voir le catalogue complet de produits d'asclépiade"),
    B.text_v1(sig),
]

imgs = ["3ca13526-875b-4167-8e37-c5e1be7f4acd.jpeg", "88b62acb-3d53-465f-a13b-def9e82efafc.jpeg",
        "850b5847-3428-47a9-8441-583c133302a4.jpeg", "bc5f3839-04ae-428c-b635-ddc0b8e3e505.jpeg",
        "571f6a11-7205-4322-8504-0b49cc3a18ad.jpeg"]
footer = "\n".join([B.image_block_nolink(B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/" + i)) for i in imgs] + [B.FOOTER])

B.assemble(blocks, "01KQM4YQKWG0XFXB3ZWAG6DQW0.html", footer=footer)
