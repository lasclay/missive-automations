import json,re,os
S=os.path.dirname(os.path.abspath(__file__))
def qa(pairs): return "".join("<p><strong>%s</strong><br>%s</p>"%(q,a) for q,a in pairs)
FAQ_TEXTILE_EN=qa([
 ("Is it really warm? Why milkweed?","Milkweed floss is a hollow fibre: each fibre traps air inside, and that air is what insulates. It is very light, naturally water-repellent, plant-based and free of animal material. The warmth of a finished product also depends on its outer fabric, its thickness and how it is used. Our job is to turn the fibre's properties into products that hold up in real life."),
 ("Does the insulation pack down over time?","A little, like any insulation, but it keeps its insulating power. Many insulations rely on the air between fibres, which disappears under compression. In milkweed, the air is held inside each hollow fibre, and it stays there."),
 ("Are the mittens waterproof?","Water-resistant, not 100% waterproof. The outer fabric, a tightly woven polyester, sheds water long enough to shake it off, and the milkweed fibre is itself water-repellent, inside and out. We left out plastic membranes to keep hands that breathe."),
 ("How do I choose my mitten size?","Two measurements are enough: the width across the knuckles and the total length of the hand. If you fall between two sizes, take the larger one. Conflicting result? Send us a photo of your hand next to a ruler or tape measure and we will confirm your size. <a href=\"/pages/sizing-chart\">See the size guide with photos</a>."),
 ("What size for a jacket or vest?","Three measurements: chest, waist and hips, taken with a soft tape measure without pulling tight. Between two sizes, take the larger one. <a href=\"/pages/guide-des-tailles-manteaux-vestes-asclepiade\">See the jacket and vest guide</a>."),
 ("How do I care for my products?","Insulated clothing and accessories: machine wash, cold water, delicate cycle. No bleach. Air dry, hanging, never in the dryer. No ironing. <a href=\"/pages/guides-dentretien\">Care guides</a>."),
 ("What is the warranty on your products?","Official answer: 1 to 2 years depending on the product. That said, even if we cannot promise it unilaterally, we have applied the equivalent of a lifetime warranty on most of our products since we started. If you have a problem, write to us at hey@lasclay.com."),
])
FAQ_INSOLES_EN=qa([
 ("What size for the insulated insoles?","If you wear a half size, take the larger size. An unpadded 6 mm band surrounds the insulated part, which leaves room to trim the outline."),
 ("Is it really warm? Why milkweed?","Milkweed floss is a hollow fibre: each fibre traps air inside, and that air is what insulates. It is very light, naturally water-repellent, plant-based and free of animal material."),
 ("Does the insulation pack down over time?","A little, like any insulation, but it keeps its insulating power. In milkweed, the air is held inside each hollow fibre, and it stays there."),
 ("What is the warranty on your products?","Official answer: 1 to 2 years depending on the product. If you have a problem, write to us at hey@lasclay.com."),
])
FAQ_SEEDS_EN=qa([
 ("Do the seeds need stratification?","Yes. Our seeds are not stratified: plan on about 30 days of cold before sowing. It delays planting a little, but it gives the best germination rates."),
 ("When and how to plant?","Count on a season of patience: milkweed flowers from the second year on. <a href=\"/pages/planting-guide\">Read the planting guide</a>."),
 ("Is milkweed invasive?","Vigorous, yes; invasive, no. Common milkweed is a native plant perfectly adapted to our ecosystems, and it spreads through its rhizomes. If you are short on space, butterfly milkweed, swamp milkweed and poke milkweed spread much less."),
 ("Which species for my hardiness zone?","Every species we offer in packets suits zones 3 to 9, which covers inhabited Québec and most of North America."),
 ("Is it toxic for children or pets?","Milkweed latex is toxic, but so bitter that a child, a dog or a cat will never eat enough to be poisoned. In a garden or a field, the danger is greatly overestimated."),
 ("Does harvesting milkweed harm monarchs?","No, rather the opposite. The floss we harvest is in the pods, in the fall, when the monarchs have already left for Mexico. The more milkweed there is in the fields, the more places monarchs have to breed."),
])
FAQ_BAGS_EN=qa([
 ("How do I care for my insulated bag?","Inside: damp cloth and mild soap. Outside: by hand, or a cold delicate cycle if needed. Air dry. <a href=\"/pages/guides-dentretien\">Care guides</a>."),
 ("Why milkweed in an insulated bag?","Milkweed floss is a hollow fibre: each fibre traps air, and that air is what insulates, against heat as well as cold. It is very light and naturally water-repellent."),
 ("The return policy in brief","15 days after delivery to write to us. Product in new condition. Exchanges are free in Canada; refunds carry a $9.99 fee. <a href=\"/pages/livraison-et-echanges\">Shipping, exchanges and returns</a>."),
 ("What is the warranty on your products?","Official answer: 1 to 2 years depending on the product. If you have a problem, write to us at hey@lasclay.com."),
])
PERF_EN="<p>Weight for weight, milkweed floss insulates slightly better than down in laboratory tests, because each fibre is a hollow tube that traps air. In a finished product, warmth also depends on the cut, the fabric and how it is used: that is what we work on. And it is a plant fibre, with no animal or petroleum-based material.</p>"
ORIGIN_EN="<p>Our products are designed here, for the cold here. The milkweed floss insulation is grown and processed in Québec; assembly is entrusted to our manufacturing partners, and quality control is done at our Limoilou workshop.</p>"
MISSION_EN="<p>We give priority to suppliers close to our operations whenever the expertise and the price allow it, to reduce our carbon footprint. For milkweed floss and its processing into insulation, everything happens in Québec. For textile manufacturing, the Québec industry no longer has some of the expertise or the machinery for technical pieces at an accessible price: the assembly of most finished products is entrusted to partners, mainly in Tunisia. We explain it on our Transparency page.</p><p>Our order of priority stays the same:</p><ol><li>Provincial (Québec)</li><li>Federal (Canada)</li><li>Continental (United States/Mexico)</li><li>Global (as a last resort).</li></ol>"
PALIERS_EN="<p><strong>1 packet:</strong> $6.99 · <strong>5 packets:</strong> $29.99 (save $5) · <strong>10 packets:</strong> $49.99 (save $20)</p>"
EXACT={
 "Produits et accessoires isolés à l'asclépiade, une fibre végétale creuse qui emprisonne l'air.":"Products and accessories insulated with milkweed, a hollow plant fibre that traps air.",
 "Des mitaines chaudes, légères et coupe-vent":"Warm, light and windproof mittens",
 "Ils ont fait leurs preuves dans le froid d'ici":"Proven in our own cold",
 "<p>Cache-cous, tuques et foulards isolés à la soie d'asclépiade: chauds, légers et coupe-vent, du grand froid aux journées plus douces.</p>":"<p>Neck warmers, beanies and scarves insulated with milkweed floss: warm, light and windproof, from deep cold to milder days.</p>",
 "Les plus populaires":"Most popular",
 "Questions fréquentes":"Frequently asked questions",
 "Notre page Transparence":"Our Transparency page",
 "Voir les produits":"See the products",
 "<p>Livraison par la poste: 2,99 $</p>":"<p>Shipped by mail: $2.99</p>",
 "<p>Espèces indigènes du Québec</p>":"<p>Native Québec species</p>",
 "<p>Zones de rusticité 3 à 9</p>":"<p>Hardiness zones 3 to 9</p>",
 "<p>Guide de plantation en ligne</p>":"<p>Planting guide online</p>",
 "<p>Livraison gratuite dès 59,99 $ US</p>":"<p>Free shipping on orders of $59.99+ USD</p>",
 "<p>15 jours pour changer d'idée</p>":"<p>15 days to change your mind</p>",
 "<p>Isolant d'asclépiade cultivé et transformé au Québec</p>":"<p>Milkweed insulation grown and processed in Québec</p>",
 "<p>Retours acceptés, frais de retour à votre charge</p>":"<p>Returns accepted, return shipping at your cost</p>",
 "<p>Expédié par la poste, sans suivi</p>":"<p>Shipped by regular mail, no tracking</p>",
 "<p>Espèces indigènes d'Amérique du Nord</p>":"<p>Native North American species</p>",
}
PREFIX=[("<p>À poids égal, la soie d'asclépiade",PERF_EN),("<p>Nos produits sont dessinés ici",ORIGIN_EN),("<p>Nous priorisons les fournisseurs à proximité",MISSION_EN),("<p><strong>1 sachet:</strong>",PALIERS_EN),
 ("<p><strong>Est-ce vraiment chaud? Pourquoi l'asclépiade?</strong><br>La soie d'asclépiade est une fibre creuse: chaque fibre emprisonne de l'air à l'intérieur, et c'est cet air qui isole. Elle est très légère, naturellement hydrophobe, végétale et sans matière animale. La chaleur",FAQ_TEXTILE_EN),
 ("<p><strong>Quelle taille pour les semelles",FAQ_INSOLES_EN),("<p><strong>Faut-il stratifier",FAQ_SEEDS_EN),("<p><strong>Comment entretenir mon sac isotherme",FAQ_BAGS_EN)]
def en_for(v):
    if v in EXACT: return EXACT[v]
    for p,e in PREFIX:
        if v.startswith(p): return e
    return None
nodes=[]
for f in ['copy_translatable.json','copy_translatable2.json','copy_translatable_ctx.json']:
    nodes+=json.load(open(f'{S}/{f}'))['data']['a']['nodes']
byres={}
for n in nodes:
    name=n['resourceId'].split('/')[-1].split('?')[0]
    if name.endswith('.context.us') and 'ctx' not in ' ' and n['translations']==[] and name in byres: pass
    byres[name]=n  # later files override (ctx file is last)
def path(key): return key.rsplit(':',1)[0]
def parent_en(name):
    p=byres.get(name.replace('.context.us',''))
    if not p: return {}
    en={t['key']:t['value'] for t in p['translations']}
    fr={c['key']:c['value'] for c in p['translatableContent']}
    out={}
    for k,v in en.items():
        out[path(k).replace('.json.','.context.us.json.')]=(fr.get(k),v)
    return out
reg={}; report=[]
for name,n in byres.items():
    trans=[]
    pen=parent_en(name) if name.endswith('.context.us') else {}
    exist={t['key']:t['value'] for t in n['translations']}
    for c in n['translatableContent']:
        v=c['value'] or ''
        if v.startswith('shopify://') or v.startswith('/') or not v.strip(): continue
        e=en_for(v)
        if e is None and pen:
            pv=pen.get(path(c['key']))
            if pv and pv[0]==v: e=pv[1]
        if e is None: continue
        if exist.get(c['key'])==e: continue
        trans.append({"key":c['key'],"locale":"en","value":e,"translatableContentDigest":c['digest']})
        report.append((name,c['key'].split('.')[-1].split(':')[0],v[:60],e[:60]))
    if trans: reg[n['resourceId']]=trans
json.dump(reg,open(f'{S}/translations_reg.json','w'),ensure_ascii=False)
tot=sum(len(v) for v in reg.values()); print(len(reg),'ressources',tot,'traductions', len(json.dumps(reg,ensure_ascii=False)),'octets')
for r in report: print(r[0],'|',r[1],'|',r[2],'=>',r[3])
