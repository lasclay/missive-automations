# -*- coding: utf-8 -*-
import builder as B

Z = "​"

t1 = "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">Bonjour {{ person.first_name|default:'' }},</p><p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\"><span style=\"font-size: 15px;\"><strong style=\"font-weight: 700;\">La Prévente printanière de Lasclay a commencé hier matin et ce fut un énorme succès! </strong></span><br/><br/><span style=\"font-size: 15px;\">Je voulais vous remercier très chaleureusement pour ce soutien dans tous nos défis. J'avais tellement peur que vous nous laissiez tomber après avoir révélé notre pivot dans </span><a href=\"https://www.youtube.com/watch?v=GKyHh-Ok9JU\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:underline\" target=\"_blank\"><span style=\"font-size: 15px;\"><strong style=\"font-weight: 700;\">cette vidéo</strong></span></a><span style=\"font-size: 15px;\">, ça me fait vraiment chaud au cœur de voir tout ce soutien.</span></p><p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">MERCI, MERCI MERCI! <br/><strong style=\"font-weight: 700;\">À ceux qui ont commandé, on vous tient au courant des développements au cours des prochaines semaines et mois.</strong></p><p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\"><span style=\"font-size: 16px;\"><strong style=\"font-weight: 700;\">Voici également quelques rappels ci-dessous, pour ceux qui ont manqué les derniers courriels:</strong></span></p>"

t2 = "<div><span style=\"font-size: 20px;\"><strong style=\"font-weight: 700;\">La prévente continue</strong></span></div><div>" + Z + "</div><div><span style=\"font-size: 16px;\"><strong style=\"font-weight: 700;\">J</strong></span><span style=\"font-size: 17px;\"><strong style=\"font-weight: 700;\">usqu'au 1er juin 23h59</strong>: Vous pouvez encore bénéficier de <strong style=\"font-weight: 700;\">15% de rabais</strong> sur TOUS les produits<strong style=\"font-weight: 700;\"> avec le code </strong><strong style=\"font-weight: 700;\"><span data-color=\"#FFDE00\" style=\"background-color: rgb(255, 222, 0);\">LASCLAY15</span></strong></span><br/><span style=\"font-size: 16px;\"><br/>Pour précommander en grande primeur l'ensemble des nouveaux produits et les existants, c'est par ici 👇</span></div>"

W = "<span data-color=\"#FFFFFF\" style=\"background-color: rgb(255, 255, 255);\">"
phil = ("<div>" + Z + "</div><div><span style=\"font-size: 20px;\"><strong style=\"font-weight: 700;\"><span data-color=\"#FFDE00\" style=\"background-color: rgb(255, 222, 0);\">Une discussion franche avec Phil, mon ex-associé.</span></strong></span></div>"
        "<div>" + W + Z + "</span></div>"
        "<div><span style=\"font-size: 14px;\">" + W + "J'ai récemment eu l'occasion de retrouver</span><strong style=\"font-weight: 700;\">" + W + " l'autre fondateur de Lasclay, Phil, </span></strong>" + W + "le temps d'une franche discussion</span><strong style=\"font-weight: 700;\">" + W + ". </span></strong>" + W + "Nous y sommes revenus sur les </span><strong style=\"font-weight: 700;\">" + W + "débuts rocambolesques de l'entreprise </span></strong>" + W + "et sur notre </span><strong style=\"font-weight: 700;\">" + W + "décision de devenir manufacturiers, en 2021.</span></strong></span></div>"
        "<div>" + W + Z + "</span></div>"
        "<div><span style=\"font-size: 14px;\">" + W + "Pour visionner, </span><strong style=\"font-weight: 700;\">" + W + "cliquer sur l'image ci-dessous </span></strong>" + W + "👇</span></span>" + W + "<br/><br/></span></div>")

camp = ("<div><span style=\"font-size: 20px;\">" + Z + "</span></div><div><span style=\"font-size: 20px;\"><strong style=\"font-weight: 700;\">Campagne de financement</strong></span></div>"
        "<div><span style=\"font-size: 14px;\"><strong style=\"font-weight: 700;\">Sans trop se faire d'attentes</strong>, nous avons </span><span style=\"font-size: 16px;\">démarré une </span><a href=\"https://gofund.me/b0a62bb7c\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:underline\" target=\"_blank\"><span style=\"font-size: 16px;\"><strong style=\"font-weight: 700;\">campagne de financement</strong></span></a><span style=\"font-size: 14px;\"> pour nous donner un petit coup de pouce dans le pivot de notre modèle d'affaires et le recentrage vers notre mission.</span></div>"
        "<div>" + Z + "</div>"
        "<div><span style=\"font-size: 16px;\"><strong style=\"font-weight: 700;\"><span data-color=\"#FFDE00\" style=\"background-color: rgb(255, 222, 0);\">POUR  CONTRIBUER JUSTE À CLIQUER SUR L'IMAGE CI-DESSOUS 👇</span></strong></span></div>")

alt = "Fundraiser page for &quot;Faire de l'asclépiade un fleuron du Québec&quot; with a video and donation options."

blocks = [
    B.text_v1(t1),
    B.DIVIDER,
    B.text_v2(t2),
    B.BUTTON,
    B.IMG_PREVENTE,
    B.SHADOW,
    B.text_v2(phil),
    B.image_block("https://youtu.be/hNDH1rcrXyU", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/b120c1df-d046-47e8-ac9b-fb09d2065488.png")),
    B.SHADOW,
    B.text_v2(camp, pad_top="8px"),
    B.image_block("https://gofund.me/b0a62bb7c", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/2b4a8eb8-d1b3-4865-bdc3-7764e4f54acd.png", alt=alt, title=alt)),
    B.SIGNATURE,
    B.IMG_GAB,
]
B.assemble(blocks, "01KSZ2CG0DQ86XH07GH0XVBH43.html")
