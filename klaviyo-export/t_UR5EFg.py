# -*- coding: utf-8 -*-
import builder as B

Z = "​"
S = "<strong style=\"font-weight: 700;\">"
S16 = "<strong style=\"font-size: 16px; font-weight: 700;\">"
P1 = "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">"
P0 = "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">"

# This template's <head> lacks the mj-full-width-mobile media query block.
chunk = "\n@media only screen and (max-width: 480px) {\n    table.mj-full-width-mobile {\n        width: 100% !important\n        }\n    td.mj-full-width-mobile {\n        width: auto !important\n        }\n    }"
assert chunk in B.HEAD
B.HEAD = B.HEAD.replace(chunk, "", 1)

t1 = P0 + "Bonjour {{ person.first_name|default:'' }}</p>"

t2 = ("<div>J'écris ce matin pour " + S + "annoncer un changement de cap majeur pour Lasclay</strong>.<br/><span style=\"font-size: 16px;\">Nous avons décidé de ne plus être manufacturiers.</span><br/><br/>Ce fut une " + S + "décision très difficile mais mûrement réfléchie</strong>, en raison de nombreux défis opérationnels, financiers, personnels et réglementaires (sur l'immigration et les travailleurs étrangers, notamment).<br/><br/>Ceci inclut les " + S + "produits qui seront offerts lors de </strong><span style=\"font-size: 14px;\">" + S + "la prévente printanière qui débutera le 30 mai à 9h00 sur </strong></span><a href=\"http://lasclay.com\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:none\" target=\"_blank\"><span style=\"font-size: 14px;\">" + S + "<u>lasclay.com</u></strong></span></a><span style=\"font-size: 14px;\">. Par souci de transparence, qui a toujours été ma valeur maîtresse, j'estimais important d'en informer ma précieuse clientèle. </span></div>")

t3 = (P0 + "En fait, j'ai décidé de" + S + " faire plus que simplement informer. </strong>Nous avons produit une vidéo de style documentaire pour" + S + " expliquer </strong>cette décision sous toutes ces facettes" + S + ". </strong><br/><br/><span style=\"font-size: 16px;\">Pour visionner ce" + S16 + " mini-documentaire </strong>sur lequel nous avons travaillé très fort" + S16 + ", rempli d'images inédites, </strong>juste à" + S16 + " cliquer sur l'image </strong>ci-dessous" + S16 + " </strong>👇</span></p>")

t5 = "<div><span style=\"font-size: 12px;\"><em>Si l'image ne fonctionne pas, voici le lien direct: </em></span><a href=\"https://youtu.be/GKyHh-Ok9JU\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:none\" target=\"_blank\"><span style=\"font-size: 12px;\"><em><u>https://youtu.be/GKyHh-Ok9JU</u></em></span></a></div>"

t6 = ("<h4 style=\"color:#222; font-family:Geneva, Arial; font-size:18px; font-style:normal; font-weight:400; letter-spacing:0; line-height:1.1; margin:0; margin-bottom:9px; text-align:left\"> </h4><div>" + S + "Mon espoir est qu'après le visionnement de la vidéo, </strong>vous compreniez mieux notre position et ayez toujours envie de nous soutenir, de même que notre mission de faire de de l'asclépiade un fleuron québécois d'envergure mondiale et un moteur de sauvegarde des papillons monarques.<br/><br/>Mais je ne peux ni m'y attendre, ni l'exiger. <br/><br/>" + S + "La décision vous revient.</strong><br/><br/></div>")

sig = (P1 + Z + "</p>" + P1 + "N'hésitez pas à répondre à ce courriel, commenter la vidéo et nous donner vos rétroactions. Plus d'informations suivront dans les prochains jours par rapport à la prévente, les produits, les prix, etc.</p>" + P1 + Z + "</p>" + P1 + "Merci d'être là {{ person.first_name|default:'' }}.</p>" + P1 + "Chaleureusement,</p>" + P0 + S + "Gabriel</strong><br/>Co-fondateur<br/>Lasclay </p>")

blocks = [
    B.text_v1(t1),
    B.text_v2(t2),
    B.text_v1(t3),
    B.image_block("https://youtu.be/GKyHh-Ok9JU", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/dcd15cdd-b59b-4407-999c-b64d8d6c9a3c.png")),
    B.text_v2(t5),
    B.text_v2(t6),
    B.image_block_nolink(B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/696e5714-fe52-4d4d-b805-cc7518307858.jpeg")),
    B.text_v1(sig),
    B.image_block_nolink(B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/8e1a8a3b-bc9f-4374-bcf2-76d514feb80f.jpeg")),
]
B.assemble(blocks, "01KSCYFRHZFXTA6Z4SYBNCE8D1.html")
