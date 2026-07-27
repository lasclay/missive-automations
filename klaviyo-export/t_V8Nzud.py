# -*- coding: utf-8 -*-
import builder as B

H4 = "<h4 style=\"color:#222; font-family:Geneva, Arial; font-size:18px; font-style:normal; font-weight:400; letter-spacing:0; line-height:1.1; margin:0; margin-bottom:9px; text-align:left\">"

# Same head variant as UR5EFg: no mj-full-width-mobile media query.
chunk = "\n@media only screen and (max-width: 480px) {\n    table.mj-full-width-mobile {\n        width: 100% !important\n        }\n    td.mj-full-width-mobile {\n        width: auto !important\n        }\n    }"
assert chunk in B.HEAD
B.HEAD = B.HEAD.replace(chunk, "", 1)

t1 = ("<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\"><span data-key=\"3\" data-slate-object=\"text\"></span></p>\n"
      "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">Bonjour {{ first_name }},</p>")

t2 = ("<div><strong>C'EST OFFICIEL : LA DEUXIÈME PRÉVENTE PRINTANIÈRE DE LASCLAY ARRIVE!</strong></div>\n"
      "<div><br/>Après le lancement de nos premiers <a href=\"https://lasclay.com/collections/vetements-asclepiade\" style=\"color:#d4ad67; text-decoration:underline\">manteaux et vestes d'asclépiade</a> en mai 2025, nous avons décidé de renouveler l'expérience mais cette fois-ci, avec plusieurs <strong>nouveaux produits</strong> dont certains nous ont été <strong>demandés des centaines de fois</strong>.<br/><br/><span style=\"font-size: 16px;\">Nous sommes heureux de vous annoncer que </span><strong><span style=\"font-size: 16px;\">cette prévente débutera le samedi 30 mai à 9h00 sur <a href=\"https://lasclay.com\" style=\"color:#d4ad67; text-decoration:underline\">lasclay.com</a></span> </strong>(<em>on a dit 31 mai quelques fois par erreur, mais c'est vraiment le 30!</em>)<strong>.</strong></div>\n"
      "<div> </div>\n"
      "<div>\n"
      "<p dir=\"ltr\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">Pour <strong>présenter quelques-uns des produits</strong> qui seront lancés, nous avons concocté une petite mise en bouche : une bande-annonce humoristique d'environ 5 minutes.<strong> Pour découvrir ces produits en primeur, juste à cliquer sur l'aperçu ci-dessous </strong>👇</p>\n"
      "<!--EndFragment--></div>\n"
      "<div><!--EndFragment--></div>\n"
      "<div><!--EndFragment--></div>")

t4 = "<div><em><span style=\"font-size: 12px;\">Si le bouton ne fonctionne pas, voici le lien direct: <a href=\"https://youtu.be/W0pEcJaicik\" style=\"color:#d4ad67; text-decoration:underline\">https://youtu.be/W0pEcJaicik</a> </span></em></div>"

t5 = (H4 + " </h4>\n" + H4 + "De gros rabais qui suivent notre philosophie de démocratisation</h4>\n"
      "<div><!--StartFragment-->Si vous suivez notre aventure depuis un moment, vous savez à quel point nous sommes engagés dans notre <a href=\"https://lasclay.com/pages/mission\" style=\"color:#d4ad67; text-decoration:underline\"><strong>mission</strong></a> de faire de l'asclépiade un <strong>fleuron d'envergure mondiale basé au Québec</strong> et d'en faire un moteur de <strong>sauvegarde des papillons monarques menacés. </strong><!--EndFragment--><br/><br/>Fidèles à notre engagement de rendre l'asclépiade accessible au plus grand nombre, nous offrirons, en contrepartie d'un achat hâtif pour l'hiver prochain, <strong>de très gros rabais</strong> :</div>\n"
      "<div>\n<ul>\n"
      "<li><strong>30% de rabais </strong>sur les nouveaux produits et TOUT notre catalogue<strong> le samedi 30 mai seulement pour les deux premières heures (9:00 à 11:00 a.m.)</strong><br/><br/></li>\n"
      "<li><strong>20% de rabais le reste de la journée du samedi 30 mai.<br/><br/><!--StartFragment--><!--EndFragment--></strong></li>\n"
      "<li><strong>15% de rabais jusqu'au 1er juin 11:59 p.m. pour les précommandes tardives.</strong></li>\n"
      "</ul>\n</div>")

t7 = (H4 + " </h4>\n"
      "<h3 style=\"color:#222; font-family:Geneva, Arial; font-size:24px; font-style:normal; font-weight:bold; letter-spacing:0; line-height:1.1; margin:0; margin-bottom:12px; text-align:left\"><strong>Pourquoi cette prévente est cruciale pour l'avenir de Lasclay et de l'asclépiade?</strong></h3>\n"
      "<div> </div>\n"
      "<div><strong>Cette prévente représente bien plus qu'une simple opportunité d'acquérir nos produits à prix réduit. Elle est littéralement essentielle pour l'avenir de Lasclay et de l'asclépiade au Québec.<br/><br/></strong></div>\n"
      "<div><span style=\"letter-spacing: 0px;\">La culture de cette ex-mauvaise-herbe est devenue une bouée de sauvetage pour les papillons monarques en voie d'extinction: chaque été, ils trouvent au Québec de vastes plantations d'asclépiade qui leur permet d'augmenter significativement leur population avant leur retour au Mexique.</span></div>\n"
      "<div><strong><br/>Démarrer une telle production est une démarche complexe et coûteuse</strong>. <strong>Avec votre contribution et votre confiance, nous pourrons démarrer cette roue et ouvrir le chemin vers un avenir radieux pour l'asclépiade au Québec</strong>, en faire un véritable fleuron, ce qui a toujours été notre ambition depuis le premier jour.</div>\n"
      "<div><br/><em><strong>Cette belle plante le mérite. Les papillons monarques le méritent. Les courageux cultivateurs d'asclépiade le méritent. Et vous, notre communauté fidèle qui nous soutenez depuis le début, vous méritez enfin ces produits que vous nous réclamez depuis si longtemps.</strong></em></div>\n"
      "<div><br/><span style=\"font-size: 16px;\"><span style=\"text-decoration: underline;\"><strong>Alors rendez-vous le samedi 30 mai à 9h00</strong></span><strong> sur <a href=\"https://lasclay.com\" style=\"color:#d4ad67; text-decoration:underline\">lasclay.com</a>. </strong></span></div>\n"
      "<div><span style=\"font-size: 16px;\"> </span></div>\n"
      "<div><span style=\"font-size: 16px;\">D'autres annonces importantes sont à venir avant la prévente, restez à l'affût dans les prochaines semaines!</span></div>")

sig = ("<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">Chaleureusement,</p>\n"
       "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\"><strong>Gabriel</strong><br/>Co-fondateur<br/>Lasclay </p>")

blocks = [
    B.text_v1(t1),
    B.text_v1(t2),
    B.image_block("https://www.youtube.com/watch?v=W0pEcJaicik", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/eccaa52b-7635-4297-820a-44cca18b8fc4.jpeg")),
    B.text_v2(t4),
    B.text_v2(t5),
    B.image_block_nolink(B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/696e5714-fe52-4d4d-b805-cc7518307858.jpeg")),
    B.text_v2(t7),
    B.text_v1(sig),
    B.image_block_nolink(B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/a04a41e0-2a1a-4313-8d99-4395690b1b13.jpeg")),
]
B.assemble(blocks, "01KRX1MBST6PSVYW6RME23NS76.html")
