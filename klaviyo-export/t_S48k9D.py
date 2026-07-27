# -*- coding: utf-8 -*-
import builder as B

P1S = "<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">"
P0S = "<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">"

def A(href, txt):
    return "<a href=\"%s\" style=\"color:#d4ad67; text-decoration:underline\">%s</a>" % (href, txt)

t1 = ("<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\"><span data-key=\"3\" data-slate-object=\"text\"></span></p>\n"
      "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">Bonjour {{ first_name }},</p>")

t2 = ("<div>Nous espérons que tu vas bien en ce samedi matin. Les jours se réchauffent, ça sent le printemps à plein nez et bientôt, on va sortir se réchauffer la peau au soleil de mai.</div>\n"
      "<div> </div>\n"
      "<div><span style=\"font-size: 16px;\">Nous profitons de l'occasion pour <strong>lancer un " + A("https://lasclay.com/products/creme-contour-yeux-huile-asclepiade", "nouveau produit fantastique") + "</strong> <em>(voir au bas du courriel pour les moins patients </em>😉).</span> <br/><br/>Ce lancement surprise est le fruit d'un an de recherche, développement et collaboration avec " + A("https://gourmetsauvage.ca/", "Gourmet Sauvage") + ", une entreprise géniale dont la réputation n'est plus à faire. Ils mettent en valeur des <strong>ingrédients d’ici et un savoir-faire ancré</strong> dans le territoire boréal québécois depuis maintenant de nombreuses années.</div>\n"
      "<div> </div>\n"
      "<div>Comme plusieurs le savent, nous nous sommes surtout fait connaître depuis 5 ans grâce à nos <strong>" + A("https://lasclay.com/collections/produits-products", "accessoires isolés à la soie d'asclépiade") + "</strong>, un isolant phénoménal et naturellement imperméable. Mais notre mission va beaucoup plus loin: <br/><br/>Nous voulons faire de l'asclépiade un fleuron québécois reconnu mondialement, basé sur de " + A("https://drive.google.com/drive/folders/1-8cubf-4aYX7el6ggDjZZgDAtLEiSQhk?usp=drive_link", "vastes plantations qui servent d'habitat") + " pérenne pour les papillons monarques menacés. <br/><!--EndFragment--></div>")

t7 = ("<!--StartFragment-->\n"
      "<div>Pour mener à bien cet ambitieux objectif, nous développons constamment d'autres débouchés à haute valeur ajoutée cette plante que nous adorons. <br/><br/>Avec la soie isolante, nous produisons les <strong>" + A("https://lasclay.com/collections/produits-products/products/mittens", "mitaines les plus chaudes du monde") + "</strong> et des <strong>" + A("https://lasclay.com/collections/sacs-isothermes-glacieres-asclepiade", "glacières et sacs à lunch") + "</strong> performants.<br/><br/>Nous redistribuons les <strong>" + A("https://lasclay.com/collections/garden", "graines d'asclépiade") + "</strong> via une campagne annuelle de plantation à travers l'Amérique du Nord, pour favoriser la création de milliers de jardins à monarques à travers le continent. <br/><br/>Et puis l'an dernier, après des travaux de recherche menés conjointement avec le Centre de Recherche Industrielle du Québec, nous avons découvert que les graines d'asclépiade contenait une <strong>" + A("https://lasclay.com/collections/matieres/products/huile-asclepiade", "huile aux propriétés exceptionnelles") + "</strong>:</div>\n"
      "<div> </div>\n"
      "<div>\n<ul>\n"
      "<li>Elle contient <strong>5 des 8 types de Vitamine E</strong>, incluant des quantités très élevées de tocotriénols, des formes rares dans le monde végétal. La Vitamine E est bien sûr très connue pour ses <strong>effets antioxydants et hydratants</strong> sur la peau.<br/><br/></li>\n"
      "<li>Riche en acides gras Oméga 7, rare dans le monde végétal. Naturellement présent dans la peau, il joue un rôle clé dans le <strong>maintien de sa souplesse et de son intégrité</strong>.<!--EndFragment--></li>\n"
      "</ul>\n</div>\n"
      "<!--EndFragment-->")

t12 = (P1S + "<!--StartFragment-->Nous sommes vraiment heureux de donner un nouveau sens, un nouveau souffle à notre mission de démocratisation de l’asclépiade et de sauvegarde des papillons monarques avec le tout premier soin pour la peau québécois à base d'huile d'asclépiade. </p>\n"
       + P1S + "<span style=\"font-size: 18px;\">La<strong> " + A("https://lasclay.com/products/creme-contour-yeux-huile-asclepiade", "crème contour des yeux à l’huile d’asclépiade") + "</strong> - <br/>Gourmet Sauvage / Lasclay!</span></p>\n"
       + P0S + "<span style=\"font-size: 16px;\">Si vous voulez y jeter un oeil et vous la procurer (quantités TRÈS limitées), juste à cliquer sur l'image 😀</span></p>")

t14 = ("<div><span style=\"font-size: 16px;\"> </span></div>\n"
       "<div><span style=\"font-size: 16px;\">Je t'invite également à rester à l'affût au cours des prochaines semaines: Plusieurs annonces importantes à venir!</span></div>\n"
       "<div> </div>\n"
       "<div><!--StartFragment-->\n"
       "<div style=\"font-size: 14px; font-family: Arial; color: rgb(34, 34, 34); background-color: rgb(255, 255, 255); text-align: left;\">Chaleureusement,<br/><br/></div>\n"
       "<div style=\"font-size: 14px; font-family: Arial; color: rgb(34, 34, 34); background-color: rgb(255, 255, 255); text-align: left;\"><strong>Gabriel</strong><br/>Co-fondateur<br/>Lasclay </div>\n"
       "<!--EndFragment--></div>")

CDN = "https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/"
blocks = [
    B.text_v1(t1),
    B.text_v1(t2),
    B.image_block_nolink(B.img_tag(CDN + "df9c713a-8af0-4eaf-abff-f314588810b3.jpeg")),
    B.SHADOW,
    B.image_block_nolink(B.img_tag(CDN + "8604ec63-c64f-4155-9055-333cf7fd51da.jpeg")),
    B.SHADOW,
    B.text_v2(t7),
    B.image_block_nolink(B.img_tag(CDN + "571f6a11-7205-4322-8504-0b49cc3a18ad.jpeg")),
    B.SHADOW,
    B.image_block_nolink(B.img_tag(CDN + "1245c789-f685-429c-ac9e-392258bab3a3.jpeg")),
    B.SHADOW,
    B.text_v1(t12),
    B.image_block("https://lasclay.com/products/creme-contour-yeux-huile-asclepiade", B.img_tag(CDN + "90c31f98-03c8-4a8b-9963-dedc8391e0fa.jpeg")),
    B.text_v2(t14),
]

footer = "\n".join([B.image_block_nolink(B.img_tag(CDN + "8e1a8a3b-bc9f-4374-bcf2-76d514feb80f.jpeg")), B.FOOTER])

B.assemble(blocks, "01KPG8655CZG3R3FWQ7FQTSPTC.html", footer=footer)
