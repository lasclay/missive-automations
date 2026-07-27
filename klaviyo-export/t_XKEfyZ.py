# -*- coding: utf-8 -*-
import builder as B

Z = "​"
S = "<strong style=\"font-weight: 700;\">"
S16 = "<strong style=\"font-size: 16px; font-weight: 700;\">"
P1 = "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">"
P0 = "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">"

t1 = (P1 + "Bonjour {{ person.first_name|default:'' }},</p>" + P1 +
      "<span style=\"font-size: 15px;\"><strong style=\"font-size: 15px; font-weight: 700;\">La Prévente printanière de Lasclay arrive dans à peine 2 jours!</strong></span> <br/><br/>" + S + "Samedi matin le 30 mai à 9h00</strong>, vous pourrez enfin précommander plusieurs nouveaux produits très attendus, livrables pour l'hiver 2026-2027. <br/><br/><span style=\"font-size: 17px;\">" + S + "Rappel des rabais appliqués sur TOUS nos produits lors de cette prévente</strong></span></p>" + P0 +
      "<span style=\"font-size: 17px;\">Samedi 9h00-11h00: " + S + "-30%</strong><br/>Samedi 11h01-23h59:" + S + " -20%</strong><br/>Jusqu'au 1er juin 23h59: " + S + "-15%</strong></span><br/><span style=\"font-size: 16px;\"><br/>Pour découvrir en grande primeur l'ensemble des nouveaux produits, c'est par ici (les prix affichés sont les prix réguliers, " + S16 + "AVANT </strong>rabais). 👇</span></p>")

t3 = "<div><span style=\"font-size: 12px;\"><em>Si le lien ne fonctionne pas, voici le lien direct: </em></span><a href=\"https://lasclay.com/prevente\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:underline\" target=\"_blank\"><span style=\"font-size: 12px;\"><em>https://lasclay.com/prevente</em></span></a></div>"

t5 = ("<div><span style=\"font-size: 16px;\">" + S16 + "MERCI POUR VOTRE SOUTIEN</strong></span></div><div>" + Z + "</div>"
      "<div>J'écrivais dimanche matin pour " + S + "annoncer un changement de cap majeur pour Lasclay</strong>: notre décision de ne plus être manufacturiers et de continuer nos activités sous un nouveau modèle.<br/><br/>Pour ceux qui n'ont pas vu le <span style=\"font-size: 14px;\">" + S16 + "mini-documentaire </strong>que nous avons produit pour cette occasion" + S16 + ", rempli d'images inédites, </strong>le revoici" + S16 + " (cliquer sur l'image </strong>ci-dessous)" + S16 + " </strong>👇</span><br/><br/></div>")

t8 = "<div><span style=\"font-size: 12px;\"><em>Si l'image ne fonctionne pas, voici le lien direct: </em></span><a href=\"https://youtu.be/GKyHh-Ok9JU\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:none\" target=\"_blank\"><span style=\"font-size: 12px;\"><em><u>https://youtu.be/GKyHh-Ok9JU</u></em></span></a></div>"

t9 = (P1 + "Ce fut une " + S + "décision difficile et j'avais vraiment peur que vous débarquiez. </strong>Mais à mon grand bonheur et soulagement, on a reçu une" + S + " ÉNORME vague d'encouragements </strong>et de commentaires positifs qui me rassure tellement." + S + Z + "</strong>Ça fait vraiment du bien et" + S + " je veux vous remercier du fond du cœur pour ça.</strong></p>" + P1 +
      S + "Pour vous remercier</strong>, il nous fait plaisir de vous " + S + "partager une vidéo montrant en détail les étapes de fabrication d'un cache-cou chez Lasclay</strong>. Nous trouvions important d'immortaliser ce procédé ayant atteint ses limites, certes, mais dont nous sommes néanmoins très fiers pour toute l'innovation qui y a été déployée.</p>" + P0 +
      S + "Pour la visionner:</strong> <span style=\"font-size: 14px;\">" + S16 + "Cliquer sur l'image </strong>ci-dessous)" + S16 + " </strong>👇</span><br/><br/></p>")

t12 = "<div><span style=\"font-size: 12px;\"><em>Si l'image ne fonctionne pas, voici le lien direct: </em></span><a href=\"https://www.youtube.com/watch?v=81fXfZ3NR30\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:underline\" target=\"_blank\"><span style=\"font-size: 12px;\"><em>https://www.youtube.com/watch?v=81fXfZ3NR30</em></span></a></div>"

sig = (P1 + Z + "N'hésitez pas à répondre à ce courriel, commenter et poser vos questions.</p>" + P1 + "Merci d'être encore là {{ person.first_name|default:'' }}.</p>" + P1 + "Chaleureusement,</p>" + P0 + S + "Gabriel</strong><br/>Co-fondateur<br/>Lasclay </p>")

btn = B.button_block("https://lasclay.com/prevente", "DÉCOUVRIR LES NOUVEAUX PRODUITS D'ASCLÉPIADE").replace("font-size:18px", "font-size:16px")

blocks = [
    B.text_v1(t1),
    btn,
    B.text_v2(t3),
    B.DIVIDER,
    B.text_v2(t5),
    B.image_block("https://youtu.be/GKyHh-Ok9JU", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/dcd15cdd-b59b-4407-999c-b64d8d6c9a3c.png")),
    B.SHADOW,
    B.text_v2(t8),
    B.text_v1(t9),
    B.image_block("https://www.youtube.com/watch?v=81fXfZ3NR30", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/4fe5bd19-5ede-481e-9792-c79756860209.png")),
    B.SHADOW,
    B.text_v2(t12),
    B.text_v1(sig),
    B.image_block_nolink(B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/8e1a8a3b-bc9f-4374-bcf2-76d514feb80f.jpeg")),
]
B.assemble(blocks, "01KSQ4N8RP8S7WVP8PKS0TBZ3F.html")
