# -*- coding: utf-8 -*-
import builder as B

Z = "​"
W = "<span data-color=\"#FFFFFF\" style=\"background-color: rgb(255, 255, 255);\">"
Y = "<span data-color=\"#FFDE00\" style=\"background-color: rgb(255, 222, 0);\">"
S = "<strong style=\"font-weight: 700;\">"
P1 = "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">"
P0 = "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">"

t1 = (P1 + "Bonjour {{ person.first_name|default:'' }},</p>" + P1 +
      "<span style=\"font-size: 15px;\">" + S + "La Prévente printanière de Lasclay commence dans à peine 2 heures!</strong></span> <br/><span style=\"letter-spacing: 0px;\">" + S + "Ce matin à 9h00</strong>, vous pourrez enfin précommander plusieurs nouveaux produits très attendus, livrables pour l'hiver 2026-2027. " + S + Y + "Les codes rabais et le lien pour commander se trouvent en bas du courriel.</span></strong></span></p>" + P0 +
      "<span style=\"font-size: 16px;\"><u>En attendant, ce courriel contient plusieurs informations importantes alors nous conseillons de le lire attentivement</u> </span>😉<br/></p>")

t3 = ("<div><span style=\"font-size: 18px;\">" + S + "Une campagne de financement pour soutenir notre mission</strong></span></div><div>" + Z + "</div>"
      "<div><span style=\"font-size: 14px;\">" + S + "Sans grandes attentes</strong>, nous avons </span><span style=\"font-size: 16px;\">démarré une </span><a href=\"https://gofund.me/b0a62bb7c\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:underline\" target=\"_blank\"><span style=\"font-size: 16px;\">" + S + "campagne de financement</strong></span></a><span style=\"font-size: 14px;\"> pour soutenir le pivot de notre modèle d'affaires et le recentrage vers notre mission: faire connaître l'asclépiade, développer ses débouchés et sauvegarder le papillon monarque par sa culture.</span><br/><br/><span style=\"font-size: 14px;\">" + S + "Si vous y croyez, que vous aimez Lasclay</strong></span>, sachez que votre coup de main sera très bienvenu. en fait, " + S + "si chaque personne de l'infolettre ne donnait que 1$, on quadruplerait l'objectif!</strong> Aucune pression, si ça ne vous tente pas ce n'est vraiment pas plus grave: juste " + S + "votre présence ici à lire ce courriel est déjà bien appréciée</strong>.</div><div>" + Z + "</div>"
      "<div><span style=\"font-size: 16px;\">" + S + Y + "POUR JETER UN OEIL À LA CAMPAGNE, JUSTE À CLIQUER SUR L'IMAGE CI-DESSOUS 👇</span></strong></span></div><div>" + Z + "</div>")

phil = ("<div><span style=\"font-size: 18px;\">" + S + Y + "Une discussion franche avec Phil, mon ex-associé.</span></strong></span></div>"
        "<div>" + W + Z + "</span></div>"
        "<div><span style=\"font-size: 14px;\">" + W + "En plus du </span></span><a href=\"https://youtu.be/GKyHh-Ok9JU\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:underline\" target=\"_blank\"><span style=\"font-size: 14px;\">" + S + W + "mini-documentaire</span></strong></span></a><span style=\"font-size: 14px;\">" + S + W + " " + Z + "</span></strong>" + W + "publié la semaine dernière, où j'expliquais ma </span>" + S + W + "décision de ne plus être manufacturier, </span></strong>" + W + "j'ai récemment eu l'occasion de retrouver</span>" + S + W + " l'autre fondateur de Lasclay, Phil, </span></strong>" + W + "le temps d'une franche discussion</span>" + S + W + ". </span></strong>" + W + "Durant celle-ci, nous sommes revenus sur les </span>" + S + W + "débuts rocambolesques de l'entreprise </span></strong>" + W + "et sur notre </span>" + S + W + "décision de devenir manufacturiers, en 2021.</span></strong></span></div>"
        "<div>" + W + Z + "</span></div>"
        "<div><span style=\"font-size: 14px;\">" + W + "Notre amitié a été mise à rude épreuve durant cette aventure mais heureusement, elle a survécu.</span>" + S + W + Z + " </span></strong>" + W + "Ça boucle la boucle, comme on dit!</span></span>" + W + "<br/></span><span style=\"font-size: 14px;\">" + W + Z + "</span></span>" + W + "<br/></span><span style=\"font-size: 14px;\">" + W + "Pour tous ceux qui s'intéressent à l'entrepreneuriat et aux défis des partenariats,</span>" + S + W + " il me fait plaisir de vous présenter cette discussion (cliquer sur l'image ci-dessous) </span></strong>" + W + "👇</span></span>" + W + "<br/><br/></span></div>")

t9 = "<div><span style=\"font-size: 12px;\"><em>Si l'image ne fonctionne pas, voici le lien direct: </em></span><a href=\"https://youtu.be/hNDH1rcrXyU\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:underline\" target=\"_blank\"><span style=\"font-size: 12px;\"><em>https://youtu.be/hNDH1rcrXyU</em></span></a><span style=\"font-size: 12px;\"><em> </em></span></div>"

t10 = ("<div><span style=\"font-size: 16px;\">Alors voilà. Le moment tant attendu arrive bientôt!</span></div><div>" + Z + "</div>"
       "<div><span style=\"font-size: 18px;\">" + S + Y + "Rappel des rabais appliqués sur TOUS nos produits:</span></strong></span></div>" + P0 +
       "<span style=\"font-size: 17px;\">Samedi 9h00-11h00: " + S + "-30% avec le code " + Y + "LASCLAY30</span></strong><br/>Samedi 11h01-23h59:" + S + " -20% avec le code " + Y + "LASCLAY20</span></strong><br/>Jusqu'au 1er juin 23h59: " + S + "-15% avec le code " + Y + "LASCLAY15</span></strong></span><br/><span style=\"font-size: 16px;\"><br/>Pour précommander en grande primeur l'ensemble des nouveaux produits et les existants, c'est par ici (les prix affichés sont les prix réguliers, " + S + "AVANT </strong>rabais). 👇</span></p>")

t12 = "<div><span style=\"font-size: 12px;\"><em>Si le lien ne fonctionne pas, voici le lien direct: </em></span><a href=\"https://lasclay.com/prevente\" rel=\"noopener noreferrer nofollow\" style=\"color:#d4ad67; text-decoration:underline\" target=\"_blank\"><span style=\"font-size: 12px;\"><em>https://lasclay.com/prevente</em></span></a></div>"

sig = (P1 + Z + "</p>" + P1 + "Merci d'être encore là {{ person.first_name|default:'' }}.</p>" + P1 + "Chaleureusement,</p>" + P0 + S + "Gabriel</strong><br/>Co-fondateur<br/>Lasclay </p>")

alt = "Fundraiser page for &quot;Faire de l'asclépiade un fleuron du Québec&quot; with a video and donation options."

blocks = [
    B.text_v1(t1),
    B.DIVIDER,
    B.text_v2(t3),
    B.image_block("https://gofund.me/b0a62bb7c", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/df271ad2-9a66-452d-b931-2805a3e2a247.png", alt=alt, title=alt)),
    B.SHADOW,
    B.text_v2(phil),
    B.image_block("https://youtu.be/hNDH1rcrXyU", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/24550d3d-8b41-4763-9669-4ed4d44a4fbb.png")),
    B.SHADOW,
    B.text_v2(t9),
    B.text_v2(t10),
    B.BUTTON,
    B.text_v2(t12),
    B.IMG_PREVENTE,
    B.SHADOW,
    B.text_v1(sig),
    B.image_block_nolink(B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/855e9941-e594-40a7-b5e4-898bbcfa5ec8.jpeg")),
]
B.assemble(blocks, "01KSVFGFHWHMS8FPR1BRH1GM73.html")
