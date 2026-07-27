# -*- coding: utf-8 -*-
import builder as B

Z = "​"
AR = "<span style=\"font-size: 14px; font-family: Arial, sans-serif; color: rgb(0, 0, 0);\">"
AR2 = "<span style=\"font-family: Arial, sans-serif; color: rgb(0, 0, 0);\">"
ARB = "<span style=\"font-weight: bold; font-family: Arial, sans-serif; color: rgb(0, 0, 0);\">"
LH = "<div style=\"line-height: 138%;\">"
PC1 = "<p class=\"font-claude-response-body break-words whitespace-normal leading-[1.7]\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">"
PC0 = "<p class=\"font-claude-response-body break-words whitespace-normal leading-[1.7]\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">"

def A(href, txt):
    return "<a href=\"%s\" style=\"color:#d4ad67; text-decoration:underline\">%s</a>" % (href, txt)

t1 = ("<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\"><span data-key=\"3\" data-slate-object=\"text\"> </span></p>\n"
      "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\">Hello {{ first_name }},</p>")

t2 = ("<div><span style=\"font-size: 1px;\"><!--StartFragment--></span></div>\n"
      + LH + AR + "With spring well underway and summer on its way, we are delighted to launch our summer 2026 pre-sale of milkweed products! </span></div>\n"
      "<div><span style=\"font-size: 14px;\"> </span></div>\n"
      + LH + "<!--StartFragment-->Starting now, you can pre-order <strong>our summer products for the entire season with very attractive discounts.</strong><!--EndFragment--></div>\n"
      + LH + AR + " </span></div>\n"
      + LH + "<!--StartFragment-->Here is a brief presentation of each of these products, which will help you appreciate the highly insulating milkweed silk in a completely different context than winter, for which it has become almost legendary. <strong><em>PS: each title is clickable to view the product on our website, and at the end of the email you'll find images and a link to our full catalogue!</em></strong><!--EndFragment--></div>\n"
      "<div> </div>\n"
      "<div><strong>" + A("https://lasclay.com/en/collections/milkweed-insulated-drink-cozies", "Insulated drink sleeves") + "<br/>30% off on all 3 formats<br/></strong></div>\n"
      + LH + "Small, practical, and remarkably effective: it keeps your drink at its initial temperature for several hours, whether hot or cold. No more lukewarm coffees or warm beers you drink reluctantly just to avoid wasting them!</div>\n"
      "<div> </div>\n"
      "<!--StartFragment-->\n"
      "<div><strong>" + A("https://lasclay.com/en/products/lunchbag", "Milkweed lunch bag") + "<br/>20% off on 1 (-12$), 30% for 2+ units (-18$)<br/></strong></div>\n"
      "<!--EndFragment-->\n"
      + LH + AR + "Our lunch bag uses the high-performance insulation of milkweed to keep your meals fresh until lunchtime, even during a heat wave and without an ice pack, according to testimonials from many satisfied customers. Easy to clean with its tearproof \"dry bag\" interior, it has quickly become a daily essential for thousands of customers. It is by far our best seller in the insulated bag category..</span></div>\n"
      "<div><span style=\"font-size: 14px;\"> </span></div>\n"
      + LH + "<strong>" + AR + A("https://lasclay.com/en/products/insulated-tote-bag", "Zip tote bag") + "<br/>25% off on black bags</span></strong></div>\n"
      + LH + "The perfect companion for trips to the market, picnics, or berry picking. Light, spacious, it holds multiple foods, drinks, and even two bottles of wine. Freshness and style combined.</div>\n"
      "<div><span style=\"font-size: 14px;\"> </span></div>\n"
      + LH + "<span style=\"font-size: 14px;\"><strong>" + AR2 + A("https://lasclay.com/products/milkweed-cooler-backpack-30l", "Sac à dos glacière 30L") + "</span></strong>" + ARB + "<br/></span><!--StartFragment--><strong>20% off on 1 (-12$), 30% for 2+ units (-18$)</strong><!--EndFragment--><br/></span></div>\n"
      + LH + "Designed for day trips or camping, this minimalist backpack offers the performance of a rigid cooler in a flexible, practical format. Many of our customers also use it as a fresh and dry bag for fruits and vegetables while camping. Without ice, it can keep vegetables fresh and dry for up to a week. No more soggy tomatoes at the bottom of the cooler!</div>\n"
      + LH + "<span style=\"font-size: 14px;\">" + AR2 + " </span></span></div>\n"
      + LH + "<span style=\"font-size: 14px;\">" + ARB + A("https://lasclay.com/en/products/cooler-wine-bag-milkweed", "Insulated wine bag") + "<br/></span><em>" + ARB + "Clearance - 55% off</span></em></span></div>\n"
      + LH + "<span style=\"font-size: 14px;\">" + AR2 + "Bring your wine in style while keeping it at the right temperature, whether for a dinner party or an impromptu picnic. Simpler and cleaner than a messy ice bucket!</span>" + A("https://lasclay.com/products/coussin-assise-thermal-pliable", Z) + "</span></div>\n"
      "<div><span style=\"font-size: 14px;\"> </span></div>\n"
      "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em; line-height:138%\"><span style=\"font-size: 18px;\"><strong>" + AR2 + "<br/>A promising collab, a great innovation</span></strong></span><span style=\"font-size: 14px;\"><strong><a href=\"https://lasclay.com/products/creme-contour-yeux-huile-asclepiade\" style=\"color:#d4ad67; text-decoration:underline\"><!--StartFragment--></a></strong></span></p>\n"
      "<div><strong>" + A("https://lasclay.com/en/products/milkweed-oil-eye-contour-cream-moisturizer", "Eye contour cream") + " made with " + A("https://lasclay.com/en/products/milkweed-seed-oil", "milkweed seed oil") + " – Collab with " + A("https://gourmetsauvage.ca/en/", "Gourmet Sauvage") + "</strong></div>\n"
      "<!--EndFragment--><!--EndFragment-->\n"
      "<div>" + ARB + "<br/></span>" + AR2 + "Our latest discovery: an oil exceptionally rich in omegas and rare forms of moisturizing vitamin E, extracted from milkweed seeds. It is a key ingredient in our newest collaboration <em>(Projects with other companies or artists who share our values, our mission, and our love for milkweed and monarch butterflies). </em></span></div>\n"
      "<div><span style=\"font-size: 14px;\"><!--EndFragment--></span></div>")

t6 = ("<!--StartFragment-->\n"
      "<h3 style=\"color:#222; font-family:Geneva, Arial; font-size:24px; font-style:normal; font-weight:bold; letter-spacing:0; line-height:138%; margin:0; margin-bottom:12px; text-align:left\">Milkweed, at a crossroads?</h3>\n"
      + LH + "<!--StartFragment-->\n"
      + PC1 + "We are truly at a pivotal moment for milkweed in Quebec and for our company. <strong>Of the 125 growers who embarked on this great adventure in 2014, barely a dozen remain.</strong></p>\n"
      + PC1 + "We must preserve this innovative and eco-freindly crop in Canada, as it serves as critical habitat for the endangered monarch butterfly. At Lasclay, we firmly believe in the future of milkweed as a world-class flagship industry for Canada. The products and technologies we are developing at an ever-growing pace are proving, little by little, the potential of this beautiful plant. But none of this would be possible without the demand and support of our wonderful customers.</p>\n"
      + PC1 + "<strong>Buying milkweed products means directly supporting the pioneering farmers of this life-saving crop for the monarch butterfly and for the marginal lands of our regions.</strong></p>\n"
      + PC0 + "<strong>In the coming weeks, we will have major announcements to make about the future of our company and of milkweed farming. It's positive news, but it's big news. Stay tuned.</strong> 😉</p>\n"
      "<!--EndFragment--></div>\n"
      + LH + "<!--EndFragment--></div>\n"
      "<!--EndFragment-->")

sig = ("<div data-test-render-count=\"1\">\n<div class=\"group\">\n<div class=\"contents\">\n<div class=\"group relative relative pb-3\" data-is-streaming=\"false\">\n"
       "<div class=\"font-claude-response relative leading-[1.65rem] [&amp;_pre&gt;div]:bg-bg-000/50 [&amp;_pre&gt;div]:border-0.5 [&amp;_pre&gt;div]:border-border-400 [&amp;_.ignore-pre-bg&gt;div]:bg-transparent [&amp;_.standard-markdown_:is(p,blockquote,h1,h2,h3,h4,h5,h6)]:pl-2 [&amp;_.standard-markdown_:is(p,blockquote,ul,ol,h1,h2,h3,h4,h5,h6)]:pr-8 [&amp;_.progressive-markdown_:is(p,blockquote,h1,h2,h3,h4,h5,h6)]:pl-2 [&amp;_.progressive-markdown_:is(p,blockquote,ul,ol,h1,h2,h3,h4,h5,h6)]:pr-8\">\n"
       "<div>\n<div class=\"standard-markdown grid-cols-1 grid [&amp;_&gt;_*]:min-w-0 gap-3 standard-markdown\">\n"
       + PC0 + "Have a great weekend {{ first_name }}, and thank you for supporting us in this adventure. We truly appreciate it. 🧡<br/><br/></p>\n"
       "</div>\n</div>\n</div>\n</div>\n</div>\n</div>\n</div>\n"
       "<!--EndFragment--><!--EndFragment-->\n"
       "<p class=\"_3ya0-\" data-key=\"2\" data-slate-object=\"block\" style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:1em\">Warmly,</p>\n"
       "<p style=\"margin-bottom:0; margin-left:0; margin-right:0; margin-top:0; padding-bottom:0\"><strong>Gabriel</strong><br/>Co-founder<br/>Lasclay </p>")

blocks = [
    B.text_v1(t1),
    B.text_v1(t2),
    B.button_block("https://lasclay.com/en/collections/collabs", "See Lasclay's collab section"),
    B.image_block("https://lasclay.com/en/products/milkweed-oil-eye-contour-cream-moisturizer", B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/90c31f98-03c8-4a8b-9963-dedc8391e0fa.jpeg")),
    B.SHADOW,
    B.text_v2(t6),
    B.button_block("https://lasclay.com/en/collections/produits-products", "View milkweed products' full catalogue"),
    B.text_v1(sig),
]

imgs = ["3ca13526-875b-4167-8e37-c5e1be7f4acd.jpeg", "88b62acb-3d53-465f-a13b-def9e82efafc.jpeg",
        "850b5847-3428-47a9-8441-583c133302a4.jpeg", "bc5f3839-04ae-428c-b635-ddc0b8e3e505.jpeg",
        "571f6a11-7205-4322-8504-0b49cc3a18ad.jpeg"]
footer_text = B.FOOTER.replace("Lasclay, 298 Boulevard des Capucins, Québec, QC, G1J3R4", "Lasclay inc.")
footer_text = footer_text.replace("Vous ne voulez plus recevoir notre infolettre?<br/>{% unsubscribe 'Se d&eacute;sabonner' %}",
                                  "Don't want to receive our newsletter anymore?<br/>{% unsubscribe 'Unsubscribe' %}")
footer = "\n".join([B.image_block_nolink(B.img_tag("https://d3k81ch9hvuctc.cloudfront.net/company/RhpPJR/images/" + i)) for i in imgs] + [footer_text])

B.assemble(blocks, "01KQM78PHDKB6N003P21PC2H0W.html", footer=footer)
