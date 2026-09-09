import json,re,os,copy,sys
sys.path.insert(0,'/tmp/claude-0/-home-user-missive-automations/837e4953-8f89-5166-a6b3-862ebc9729af/scratchpad')
from tj import load
T='/tmp/claude-0/-home-user-missive-automations/837e4953-8f89-5166-a6b3-862ebc9729af/scratchpad/theme/'
O='/tmp/claude-0/-home-user-missive-automations/837e4953-8f89-5166-a6b3-862ebc9729af/scratchpad/out/'
journal=[]
def save(fn,obj_or_text):
    p=O+fn; os.makedirs(os.path.dirname(p),exist_ok=True)
    if isinstance(obj_or_text,str): open(p,'w').write(obj_or_text)
    else: open(p,'w').write(json.dumps(obj_or_text,ensure_ascii=False,separators=(",",":")))

ORIGIN_OLD="Nous fabriquons le tout au Québec"
ORIGIN_NEW="<p>Nos produits sont dessinés ici, pour le froid d'ici. L'isolant en soie d'asclépiade est cultivé et transformé au Québec; l'assemblage est confié à nos partenaires manufacturiers, et le contrôle qualité se fait à notre atelier de Limoilou.</p>"
PERF_OLD="performe mieux que ses concurrents"
PERF_NEW="<p>À poids égal, la soie d'asclépiade isole un peu mieux que le duvet en laboratoire, parce que chaque fibre est un tube creux qui emprisonne l'air. Dans un produit fini, la chaleur dépend aussi de la coupe, du tissu et de l'usage: c'est là-dessus qu'on travaille. Et c'est une fibre végétale, sans matière animale ni pétrole.</p>"

DELIVERY_LIQUID="""{%- assign d = product.description | downcase -%}
{%- assign en = false -%}{%- if request.locale.iso_code contains 'en' -%}{%- assign en = true -%}{%- endif -%}
{%- if d contains 'prévente' or d contains 'précommande' or d contains 'presale' or d contains 'pre-order' -%}
<p class="cro-delivery cro-delivery--presale">{% if en %}<strong>Presale:</strong> ships fall 2026, after the date shown on this page. You will get an email with tracking when it ships.{% else %}<strong>Prévente:</strong> livrable automne 2026, après la date indiquée sur cette fiche. Vous recevez un courriel avec le suivi au moment de l'expédition.{% endif %}</p>
{%- elsif localization.country.iso_code == 'US' -%}
<p class="cro-delivery">{% if en %}Ships from Québec, Canada, in 1 to 2 business days, with tracking. Free shipping on orders of $59.99+ USD.{% else %}Expédié de Québec en 1 à 2 jours ouvrables, avec suivi. Livraison gratuite dès 59,99 $ US.{% endif %}</p>
{%- else -%}
<p class="cro-delivery">{% if en %}Ships from Québec City in 1 to 2 business days. Estimated delivery: 2 to 5 business days in Québec, 4 to 8 in Ontario and the Maritimes, 7 to 10 in Western Canada.{% else %}Expédié de Québec en 1 à 2 jours ouvrables. Livraison estimée: 2 à 5 jours ouvrables au Québec, 4 à 8 en Ontario et dans les Maritimes, 7 à 10 dans l'Ouest.{% endif %}</p>
{%- endif -%}"""
SEEDS_DELIVERY_LIQUID="""{%- assign en = false -%}{%- if request.locale.iso_code contains 'en' -%}{%- assign en = true -%}{%- endif -%}
<p class="cro-delivery">{% if en %}Ships from Québec City by regular mail (stamp), no tracking number. Seeds are not stratified: plan about 30 days of cold before sowing.{% else %}Envoi de Québec par la poste (timbre), sans numéro de suivi. Les graines ne sont pas stratifiées: prévoyez environ 30 jours au froid avant le semis.{% endif %}</p>"""

def qa(pairs):
    return "".join("<p><strong>%s</strong><br>%s</p>"%(q,a) for q,a in pairs)
FAQ_TEXTILE=qa([
 ("Est-ce vraiment chaud? Pourquoi l'asclépiade?","La soie d'asclépiade est une fibre creuse: chaque fibre emprisonne de l'air à l'intérieur, et c'est cet air qui isole. Elle est très légère, naturellement hydrophobe, végétale et sans matière animale. La chaleur d'un produit fini dépend aussi de son tissu extérieur, de son épaisseur et de l'usage. Notre travail est de traduire les propriétés de la fibre en produits qui tiennent dans la vraie vie."),
 ("L'isolant s'écrase-t-il avec le temps?","Un peu, comme tout isolant, mais il garde son pouvoir isolant. Beaucoup d'isolants dépendent de l'air entre les fibres, qui disparaît à la compression. Dans l'asclépiade, l'air est contenu dans chaque fibre creuse, et il reste là."),
 ("Les mitaines sont-elles imperméables?","Résistantes à l'eau, pas étanches à 100 %. Le tissu extérieur, un polyester tissé serré, repousse l'eau le temps de la secouer, et la fibre d'asclépiade est elle-même hydrophobe, dedans comme dehors. On a écarté les membranes plastiques pour garder des mains qui respirent."),
 ("Comment choisir ma taille de mitaines?","Deux mesures suffisent: la largeur des jointures et la longueur totale de la main. Si vous tombez entre deux tailles, prenez la plus grande. Résultat contradictoire? Envoyez-nous une photo de votre main à côté d'une règle ou d'un ruban, on vous confirme la taille. <a href=\"/pages/sizing-chart\">Voir le guide des tailles avec photos</a>."),
 ("Quelle taille pour un manteau ou une veste?","Trois mesures: tour de poitrine, tour de taille, tour de hanches, prises avec un ruban souple sans serrer. Entre deux tailles, prenez la plus large. <a href=\"/pages/guide-des-tailles-manteaux-vestes-asclepiade\">Voir le guide des manteaux et vestes</a>."),
 ("Comment entretenir mes produits?","Vêtements et accessoires isolés: lavage à la machine, eau froide, cycle délicat. Pas de javellisant. Séchage à l'air, suspendu, jamais à la sécheuse. Pas de repassage. <a href=\"/pages/guides-dentretien\">Guides d'entretien</a>."),
 ("Quelle est la garantie sur vos produits?","Réponse officielle: 1 à 2 ans selon les produits. Ceci dit, même si nous ne pouvons pas le promettre unilatéralement, nous avons appliqué l'équivalent d'une garantie à vie sur la plupart de nos produits depuis nos débuts. Si vous avez un problème, écrivez-nous à hey@lasclay.com."),
])
FAQ_INSOLES=qa([
 ("Quelle taille pour les semelles isolantes?","Si vous portez une demi-pointure, prenez la taille supérieure. Une bande non rembourrée de 6 mm entoure la partie isolée, ce qui laisse de la marge pour ajuster le contour."),
 ("Est-ce vraiment chaud? Pourquoi l'asclépiade?","La soie d'asclépiade est une fibre creuse: chaque fibre emprisonne de l'air à l'intérieur, et c'est cet air qui isole. Elle est très légère, naturellement hydrophobe, végétale et sans matière animale."),
 ("L'isolant s'écrase-t-il avec le temps?","Un peu, comme tout isolant, mais il garde son pouvoir isolant. Dans l'asclépiade, l'air est contenu dans chaque fibre creuse, et il reste là."),
 ("Quelle est la garantie sur vos produits?","Réponse officielle: 1 à 2 ans selon les produits. Si vous avez un problème, écrivez-nous à hey@lasclay.com."),
])
FAQ_SEEDS=qa([
 ("Faut-il stratifier les graines?","Oui. Nos graines ne sont pas stratifiées: prévoyez environ 30 jours au froid avant le semis. Ça retarde un peu la plantation, mais c'est ce qui donne les meilleurs taux de levée."),
 ("Quand et comment planter?","Comptez une saison de patience: l'asclépiade fleurit à partir de la deuxième année. <a href=\"/pages/planting-guide\">Lire le guide de plantation</a>."),
 ("L'asclépiade est-elle envahissante?","Vigoureuse, oui; envahissante, non. L'asclépiade commune est une plante indigène parfaitement adaptée à nos écosystèmes, et elle s'étend par ses rhizomes. Si vous manquez de place, l'asclépiade tubéreuse, l'asclépiade incarnate et l'asclépiade très grande s'étendent beaucoup moins."),
 ("Quelle espèce pour ma zone de rusticité?","Toutes les espèces qu'on offre en sachets conviennent aux zones 3 à 9, ce qui couvre le Québec habité et la majeure partie de l'Amérique du Nord."),
 ("Est-ce toxique pour les enfants ou les animaux?","Le latex de l'asclépiade est toxique, mais tellement amer qu'un enfant, un chien ou un chat n'en mangera jamais assez pour s'intoxiquer. Dans un jardin ou un champ, le danger est très surestimé."),
 ("Récolter l'asclépiade nuit-il aux monarques?","Non, plutôt l'inverse. La soie qu'on récolte se trouve dans les follicules, à l'automne, quand les monarques sont déjà partis vers le Mexique. Plus il y en a dans les champs, plus les monarques ont d'endroits où se reproduire."),
])
FAQ_BAGS=qa([
 ("Comment entretenir mon sac isotherme?","Intérieur: chiffon humide et savon doux. Extérieur: à la main, ou cycle délicat à l'eau froide au besoin. Séchage à l'air. <a href=\"/pages/guides-dentretien\">Guides d'entretien</a>."),
 ("Pourquoi l'asclépiade dans un sac isotherme?","La soie d'asclépiade est une fibre creuse: chaque fibre emprisonne de l'air, et c'est cet air qui isole, du chaud comme du froid. Elle est très légère et naturellement hydrophobe."),
 ("La politique de retour en bref","15 jours après la réception pour nous écrire. Produit à l'état neuf. L'échange est gratuit au Canada; le remboursement a des frais de 9,99 $. <a href=\"/pages/livraison-et-echanges\">Livraison, échanges et retours</a>."),
 ("Quelle est la garantie sur vos produits?","Réponse officielle: 1 à 2 ans selon les produits. Si vous avez un problème, écrivez-nous à hey@lasclay.com."),
])
FAQ_BY_TEMPLATE={
 'product.produit-hiver.json':FAQ_TEXTILE,'product.json':FAQ_TEXTILE,'product.mitaines-four-1.json':FAQ_TEXTILE,
 'product.semelles-isolantes.json':FAQ_INSOLES,'product.graines-syriaca-1.json':FAQ_SEEDS,
 'product.boite-lunch.json':FAQ_BAGS,'product.sac-30l.json':FAQ_BAGS,'product.sac-tote-bag.json':FAQ_BAGS,'product.manchons-seat-pad.json':FAQ_BAGS,'product.sac-vin.json':FAQ_BAGS,
}
US_TRUST={"text1":"<p>Free shipping on orders of $59.99+ USD</p>","icon1":"truck","text2":"<p>15 days to change your mind</p>","icon2":"calendar","text3":"<p>Milkweed insulation grown and processed in Québec</p>","icon3":"leaf","text4":"<p>Returns accepted, return shipping at your cost</p>","icon4":"return"}
US_TRUST_SEEDS={"text1":"<p>Shipped by regular mail, no tracking</p>","icon1":"truck","text2":"<p>Native North American species</p>","icon2":"leaf","text3":"<p>Hardiness zones 3 to 9</p>","icon3":"star","text4":"<p>Planting guide online</p>","icon4":"box"}

def replace_text_columns(t,fn):
    n=0
    for sk,sec in t['sections'].items():
        if sec.get('type')=='text-columns-with-images':
            for bk,b in sec.get('blocks',{}).items():
                txt=b['settings'].get('text','')
                if PERF_OLD in txt:
                    journal.append((fn,f'{sk}/{bk}/text',txt,PERF_NEW)); b['settings']['text']=PERF_NEW; n+=1
    return n

def patch_product_template(fn):
    t=load(T+'templates/'+fn); main=t['sections']['main']; blocks=main['blocks']; order=main['block_order']
    # variant picker
    if 'variant_picker' in blocks:
        vp=blocks['variant_picker']['settings']
        if fn in ('product.produit-hiver.json','product.json','product.semelles-isolantes.json','product.mitaines-four-1.json'):
            journal.append((fn,'variant_picker',json.dumps(vp,ensure_ascii=False),'show_size_chart=true, size_chart_variant=Taille, size_chart_page=sizing-chart'))
            vp.update({"show_size_chart":True,"size_chart_variant":"Taille","size_chart_page":"sizing-chart"})
    if 'buy_buttons' in blocks and fn!='product.gift-card.json':
        bb=blocks['buy_buttons']['settings']
        if not bb.get('enable_mobile_sticky_cart'):
            journal.append((fn,'buy_buttons/enable_mobile_sticky_cart','false','true')); bb['enable_mobile_sticky_cart']=True
        # delivery block after buy_buttons
        liquid=SEEDS_DELIVERY_LIQUID if fn=='product.graines-syriaca-1.json' else DELIVERY_LIQUID
        blocks['cro_delivery']={"type":"custom_liquid","settings":{"custom_liquid":liquid,"variant_content":False}}
        i=order.index('buy_buttons'); order.insert(i+1,'cro_delivery'); journal.append((fn,'bloc cro_delivery','(absent)','ajouté après buy_buttons'))
    # FAQ accordion
    faq=FAQ_BY_TEMPLATE.get(fn)
    if faq:
        blocks['cro_faq']={"type":"accordion","settings":{"icon":"question_mark","title":"Questions fréquentes","content":faq,"page":"","open":False}}
        if 'accordion_livraison' in order: order.insert(order.index('accordion_livraison')+1,'cro_faq')
        else: order.append('cro_faq')
        journal.append((fn,'bloc cro_faq','(absent)','accordéon Questions fréquentes, texte de la FAQ inchangé'))
    # seeds: trust icons + paliers
    if fn=='product.graines-syriaca-1.json':
        ti=blocks['trust_icons_lasclay']['settings']
        journal.append((fn,'trust_icons',json.dumps({k:ti[k] for k in ('text1','text2','text3','text4')},ensure_ascii=False),'Livraison par la poste 2,99 $ / Espèces indigènes / Zones 3 à 9 / Guide de plantation'))
        ti.update({"text1":"<p>Livraison par la poste: 2,99 $</p>","icon1":"truck","text2":"<p>Espèces indigènes du Québec</p>","icon2":"leaf","text3":"<p>Zones de rusticité 3 à 9</p>","icon3":"star","text4":"<p>Guide de plantation en ligne</p>","icon4":"box"})
        blocks['cro_paliers']={"type":"richtext","settings":{"text":"<p><strong>1 sachet:</strong> 6,99 $ · <strong>5 sachets:</strong> 29,99 $ (économisez 5 $) · <strong>10 sachets:</strong> 49,99 $ (économisez 20 $)</p>"}}
        order.insert(order.index('variant_picker'),'cro_paliers'); journal.append((fn,'bloc cro_paliers','(absent)','économie affichée pour 5 et 10 sachets, au-dessus du sélecteur'))
    # produit-hiver specifics
    if fn=='product.produit-hiver.json':
        for sk,sec in t['sections'].items():
            if sec.get('type')=='image-with-text' and ORIGIN_OLD in sec['settings'].get('text',''):
                journal.append((fn,f'{sk}/text',sec['settings']['text'],ORIGIN_NEW)); sec['settings']['text']=ORIGIN_NEW
    n=replace_text_columns(t,fn)
    save('templates/'+fn,t)
    # US context override for trust icons
    if 'trust_icons_lasclay' in blocks:
        ctx={"context":{"market":"us"},"sections":{"main":{"settings":{},"blocks":{"trust_icons_lasclay":{"settings":(US_TRUST_SEEDS if fn=='product.graines-syriaca-1.json' else US_TRUST)}}}}}
        save('templates/'+fn.replace('.json','.context.us.json'),ctx); journal.append((fn.replace('.json','.context.us.json'),'nouveau fichier','(absent)','réassurances du marché US: 59,99 $ US, retours à vos frais'))
    return n

for fn in ['product.produit-hiver.json','product.json','product.manchons-seat-pad.json','product.cosmetics.json','product.sac-vin.json','product.semelles-isolantes.json','product.boite-lunch.json','product.graines-syriaca-1.json','product.sac-30l.json','product.sac-tote-bag.json','product.plantule.json','product.mitaines-four-1.json','product.gift-card.json']:
    n=patch_product_template(fn); print(fn,'text_columns replaced:',n)

# index.json
t=load(T+'templates/index.json'); ss=t['sections']['slideshow']; b=ss['blocks']
journal.append(('index.json','slideshow/image_TGyCXC/title',b['image_TGyCXC']['settings']['title'],"Produits et accessoires isolés à l'asclépiade, une fibre végétale creuse qui emprisonne l'air."))
b['image_TGyCXC']['settings']['title']="Produits et accessoires isolés à l'asclépiade, une fibre végétale creuse qui emprisonne l'air."
b['image_TGyCXC']['settings']['heading_h1']=True
journal.append(('index.json','slideshow/image_AVtRwm/title',b['image_AVtRwm']['settings']['title'],"Des mitaines chaudes, légères et coupe-vent"))
b['image_AVtRwm']['settings']['title']="Des mitaines chaudes, légères et coupe-vent"; b['image_AVtRwm']['settings']['slide_link']="shopify://collections/mitaines"
journal.append(('index.json','slideshow/image_mFA6LU/title+text',b['image_mFA6LU']['settings']['title']+' | '+b['image_mFA6LU']['settings']['text'],"Ils ont fait leurs preuves dans le froid d'ici | Cache-cous, tuques et foulards isolés à la soie d'asclépiade: chauds, légers et coupe-vent, du grand froid aux journées plus douces."))
b['image_mFA6LU']['settings']['title']="Ils ont fait leurs preuves dans le froid d'ici"; b['image_mFA6LU']['settings']['text']="<p>Cache-cous, tuques et foulards isolés à la soie d'asclépiade: chauds, légers et coupe-vent, du grand froid aux journées plus douces.</p>"
for k in ('image_MaAJhT','image_mFA6LU','image_kGijfg','image_VPW8wc'): b[k]['disabled']=True
ss['block_order']=['image_TGyCXC','image_AVtRwm','image_pE9wez','image_MaAJhT','image_mFA6LU','image_kGijfg','image_VPW8wc']
ss['settings']['autoplay']=False
journal.append(('index.json','slideshow','7 diapos en défilement automatique','3 diapos actives (héros, mitaines, prévente), 4 désactivées, autoplay off'))
t['sections']['cro_rating']={"type":"custom-liquid","settings":{"no_margins":True,"custom_liquid":"{%- assign r = shop.metafields.judgeme.all_reviews_rating -%}{%- assign n = shop.metafields.judgeme.all_reviews_count -%}{%- if r != blank and n != blank -%}<p class=\"cro-rating\">{% if request.locale.iso_code contains 'en' %}&#9733; {{ r }} out of 5, {{ n }} verified reviews{% else %}&#9733; {{ r | replace: '.', ',' }} sur 5, {{ n }} avis vérifiés{% endif %}</p>{%- endif -%}"}}
t['sections']['cro_best_sellers']={"type":"featured-collection","settings":{"title":"Les plus populaires","collection":"meilleurs-vendeurs","layout":"rows","show_vendor":False,"grid":4,"rows":1,"grid_mobile":"2","hide_swatches":False,"alternate_bg_color":False,"show_view_all":True}}
cl=t['sections']['collection-list']; cl['settings']['layout']='rows'; cl['settings']['grid']=4
for bk,bb in cl['blocks'].items():
    if bb['settings'].get('collection')=='skincare': bb['settings']['collection']='idees-cadeaux'; journal.append(('index.json',f'collection-list/{bk}/collection','skincare (inexistante)','idees-cadeaux'))
journal.append(('index.json','collection-list/layout','carousel','rows (grille, 4 par rangée)'))
t['order']=['scrolling_banner_rTdiWy','slideshow','cro_rating','cro_best_sellers','custom_liquid_VbGMgU','collection-list','4e797a63-7a8a-4c44-8aa5-31af9ab9c547','c07fecaf-25d5-4df9-8f0f-23d54c654d5d','45c3f0e5-b7e6-426c-aa73-325be8a2665a']
journal.append(('index.json','sections','(aucune rangée produit)','cro_rating (note Judge.me) + cro_best_sellers (collection meilleurs-vendeurs, prix et étoiles)'))
save('templates/index.json',t)

# header-group: logo_h1 false
h=load(T+'sections/header-group.json'); h['sections']['header']['settings']['logo_h1']=False; save('sections/header-group.json',h); journal.append(('header-group.json','header/logo_h1','true','false (le H1 devient le titre de la première diapo)'))

# cart.json
c=load(T+'templates/cart.json'); c['sections']['main']['settings']['cart_note_show']=False; save('templates/cart.json',c); journal.append(('cart.json','main/cart_note_show','true','false (note repliée derrière un lien dans main-cart.liquid)'))

# collection.json filters
co=load(T+'templates/collection.json'); co['sections']['main']['settings']['filter_mode']='sidebar'; save('templates/collection.json',co); journal.append(('collection.json','main/filter_mode','none','sidebar (les filtres doivent être configurés dans Search & Discovery)'))

# settings_data cart_type
sd=open(T+'config/settings_data.json').read()
assert '"cart_type": ""' in sd
sd=sd.replace('"cart_type": ""','"cart_type": "add_in_modal"',1); save('config/settings_data.json',sd); journal.append(('settings_data.json','cart_type','"" (reste sur la page)','add_in_modal (fenêtre avec bouton de paiement à l\'ajout)'))

# mission template
m=load(T+'templates/page.page-mission.json')
for sk,sec in m['sections'].items():
    for bk,bb in sec.get('blocks',{}).items():
        if bb['settings'].get('title')=='Approvisionnement':
            old=bb['settings']['text']
            new="<p>Nous priorisons les fournisseurs à proximité de nos opérations quand l'expertise et le prix le permettent, afin de réduire notre empreinte carbone. Pour la soie d'asclépiade et sa transformation en isolant, tout se passe au Québec. Pour la confection textile, la filière québécoise n'a plus certaines expertises ni les machines pour des pièces techniques à un prix accessible: l'assemblage de la plupart des produits finis est confié à des partenaires, surtout en Tunisie. On l'explique sur notre page Transparence.</p><p>Notre ordre de priorité reste le même:</p><ol><li>Provincial (Québec)</li><li>Fédéral (Canada)</li><li>Continental (États-Unis/Mexique)</li><li>Global (en dernier recours).</li></ol>"
            bb['settings']['text']=new; bb['settings']['button_label']="Notre page Transparence"; bb['settings']['link']="shopify://pages/transparence-asclepiade"
            journal.append(('page.page-mission.json',f'{sk}/{bk}/text',old,new))
        if bb['settings'].get('title')=='Comment y arriver':
            bb['settings']['button_label']="Voir les produits"; bb['settings']['link']="shopify://collections/produits-products"
save('templates/page.page-mission.json',m)

# main-cart.liquid: note behind details after checkout; aria-label; keep note textarea in form
mc=open(T+'sections/main-cart.liquid').read()
note_old="""          {% if section.settings.cart_note_show %}
            <div class="note-area">
              <label for="note" class="feature-subheader--small">{{ 'cart.label.note' | t }}</label>
              <textarea id="note" name="note">{{ cart.note }}</textarea>
            </div>
          {% endif %}
"""
assert note_old in mc
mc=mc.replace(note_old,"",1)
btn_old="""          <input type="submit" class="checkout-btn" name="checkout" value="{{ 'cart.general.checkout' | t | escape }}" />
"""
assert btn_old in mc
btn_new="""          <input type="submit" class="checkout-btn" name="checkout" value="{{ 'cart.general.checkout' | t | escape }}" aria-label="{{ 'cart.general.checkout' | t | escape }}" />

          {% if section.settings.cart_note_show %}
            <div class="note-area">
              <label for="note" class="feature-subheader--small">{{ 'cart.label.note' | t }}</label>
              <textarea id="note" name="note">{{ cart.note }}</textarea>
            </div>
          {% else %}
            <details class="note-area cro-note">
              <summary class="feature-subheader--small">{{ 'cart.label.note' | t }}</summary>
              <textarea id="note" name="note" aria-label="{{ 'cart.label.note' | t | escape }}">{{ cart.note }}</textarea>
            </details>
          {% endif %}
"""
mc=mc.replace(btn_old,btn_new,1); save('sections/main-cart.liquid',mc)
journal.append(('main-cart.liquid','bouton de paiement / note','note au-dessus du bouton, bouton sans aria-label','bouton avant la note, note repliée dans <details>, aria-label ajouté'))

# theme.liquid: cro.css + critical css for backorder
tl=open(T+'layout/theme.liquid').read()
inc="  {{ 'styles.css' | asset_url | stylesheet_tag: preload: true }}\n"
assert inc in tl
tl=tl.replace(inc,inc+"  <style>.backorder.hidden{display:none !important}</style>\n  {{ 'cro.css' | asset_url | stylesheet_tag }}\n",1); save('layout/theme.liquid',tl)
journal.append(('theme.liquid','head','','ajout de cro.css et d\'un style critique .backorder.hidden{display:none}'))

css="""/* CRO sept 2026 (tickets L-016, L-017, L-022, L-023, L-027, L-029) */
.backorder.hidden { display: none !important; }
.product-options .option-selector .opt-label--btn { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; box-sizing: border-box; }
.product-options .option-selector .opt-label--swatch { min-height: 44px; min-width: 44px; }
.product-options .option-selector .opt-btn.is-unavailable + .opt-label { opacity: .45; text-decoration: line-through; order: 99; }
.custom-select__option { min-height: 44px; display: flex; align-items: center; }
.cro-delivery { margin: .35em 0 0; font-size: .92em; line-height: 1.45; }
.cro-delivery--presale { color: #8a5a00; }
.cro-rating { text-align: center; margin: 1.2em 0 0; font-weight: 600; }
.cro-note summary { cursor: pointer; margin-top: .8em; }
.cro-note textarea { margin-top: .5em; width: 100%; }
cart-form .update-continue .update { display: none; }
cart-form .update-continue span { display: none; }
@media (max-width: 767px) { .under-cart .checkout-btn { position: sticky; bottom: 0; z-index: 3; } }
"""
save('assets/cro.css',css); journal.append(('assets/cro.css','nouveau fichier','(absent)','cibles tactiles 44 px, variantes épuisées grisées et en fin de liste, rupture masquée, bouton Mettre à jour masqué (ajax), bouton de paiement collant mobile'))

json.dump(journal,open(O+'../theme_journal.json','w'),ensure_ascii=False,indent=1)
print('files:',len([f for r,d,fs in os.walk(O) for f in fs]))
