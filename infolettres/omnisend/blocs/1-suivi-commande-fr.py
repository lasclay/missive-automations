# -*- coding: utf-8 -*-
import json, io, secrets
def I(): return secrets.token_hex(12)

GOLD='#d4ad67'
def A(h,l): return "<a href='%s'><strong>%s</strong></a>" % (h,l)

SP={"padding":"9px 18px"}
def T(html, preset='paragraph'):
    return {"id": I(), "type": "text", "stylePresetID": preset, "styleProperties": SP, "text": html}
def BTN(txt, link):
    return {"id": I(), "type": "button", "stylePresetID": "primary_button", "styleProperties": SP,
            "button": {"text": txt, "link": link, "isFullWidth": False}}

P = lambda s: "<p>%s</p>" % s

blocks = [
 T(P("Bonjour,")),
 T(P("Tu as commandé chez nous entre la fin mai et le début de septembre. Merci. Ce sont ces commandes-là, en dehors des grosses semaines de prévente, qui font rouler l'atelier le reste de l'année.")),
 T(P("On ne t'a pas beaucoup écrit depuis. Voici où on en est.")),
 T(P("Si ta commande contenait des articles en stock"), 'heading_small'),
 T(P("Elle est partie dans les jours qui ont suivi. Si quelque chose cloche, réponds directement à ce courriel. Une taille qui ne va pas, un colis jamais arrivé, une question d'entretien : c'est une vraie personne qui lit.")),
 T(P("Si ta commande contenait un article en prévente"), 'heading_small'),
 T(P("La boîte d'essai des soins, les t-shirts brodés, les cache-cous, les savons et crèmes à l'huile d'asclépiade : tout ça est <strong>livrable en novembre 2026</strong>, comme indiqué au moment de l'achat. Les échanges sont gratuits et les retours possibles jusqu'au 31 janvier 2027.")
   + P("Tu n'as rien à faire. On t'écrit quand ton colis part.")),
 T(P("Ce qui s'est passé ici depuis"), 'heading_small'),
 T(P("La prévente d'automne a eu lieu le 12 septembre. C'est une des meilleures préventes d'automne de notre histoire. La production démarre une fois les commandes reçues, alors ce sont ces commandes-là qui décident des quantités qu'on fabrique cet hiver.")
   + P("Et jeudi, notre passage à Dragons' Den a été diffusé sur CBC.")),
 BTN("VOIR L'ÉPISODE", "https://www.cbc.ca/dragonsden/episodes/season-21-episode-1"),
 T(P("Ce qui est encore commandable"), 'heading_small'),
 T(P("La prévente reste ouverte. Tout ce qui suit est livrable en novembre 2026, avec échanges gratuits et retours jusqu'au 31 janvier 2027, le temps de l'essayer une fois le froid arrivé.")
   + "<ul>"
   + "<li>" + A("https://lasclay.com/products/manteau-hiver-asclepiade-quebecoise","Le manteau hivernal") + " et la " + A("https://lasclay.com/products/veste-sans-manche-asclepiade","veste sans manche") + "</li>"
   + "<li>" + A("https://lasclay.com/products/cache-cou-asclepiade","Le cache-cou nouveau format") + ", et sa " + A("https://lasclay.com/products/cache-cou-asclepiade-enfant","version pour enfant") + "</li>"
   + "<li>" + A("https://lasclay.com/products/mittens","Les mitaines plein air") + ", les " + A("https://lasclay.com/products/mitaines-ville-asclepiade","mitaines urbaines") + " et la " + A("https://lasclay.com/products/tuque-ville-asclepiade","tuque de ville") + "</li>"
   + "<li>" + A("https://lasclay.com/products/boite-essai-soins-huile-asclepiade","La boîte d'essai des soins à l'huile") + ", cinq formats pour goûter à la gamme</li>"
   + "<li>" + A("https://lasclay.com/products/t-shirt-coton-brode-monarque-asclepiade","Les t-shirts brodés") + ", monarque et asclépiade</li>"
   + "<li>" + A("https://lasclay.com/products/milkweed-seeds","Les graines d'asclépiade") + ", à semer cet automne pour qu'elles lèvent au printemps</li>"
   + "</ul>"),
 T(P("Et un merci"), 'heading_small'),
 T(P("Le code <strong>MERCI10</strong> donne 10 % sur ta prochaine commande, sans montant minimum et sans date de fin. Il est réservé à nos clients : tu en fais partie.")),
 BTN("VOIR LES PRODUITS", "https://lasclay.com/collections/produits-products"),
 T(P("Merci d'avoir commandé.") + P("Gabriel<br>Lasclay, Canada")),
 T(P("Tu reçois ce courriel parce que tu as commandé chez Lasclay.<br>Lasclay, 1286 avenue de la Ronde, Québec (QC) G1J 4B7, Canada<br><a href='[[unsubscribe_link]]'>Se désabonner</a></p>"), 'footnote'),
]

def preset(pid, name, st): return {"id": pid, "name": name, "styles": st}
BS = {"backgroundColor": GOLD, "borderRadius": "4px", "color": "#fff", "fontFamily": "Arial", "fontSize": "15px",
      "paddingTop": "14px", "paddingBottom": "14px", "paddingLeft": "28px", "paddingRight": "28px"}

payload = {
 "name": "[Claude] 1 Suivi commande FR",
 "generalSettings": {
   "content": {"backgroundColor": "#ffffff", "color": "#2b2b2b", "fontFamily": "Arial", "fontSize": "16px", "width": "600px"},
   "body": {"backgroundColor": "#f6f4f0"},
   "buttonPresets": [
     preset("primary_button", "P", BS),
     preset("secondary_button", "S", dict(BS, backgroundColor="#ffffff", color="#2b2b2b")),
     preset("tertiary_button", "T", dict(BS, backgroundColor="transparent", color=GOLD)),
   ],
   "textPresets": [
     preset("heading_large", "HL", {"fontFamily": "Arial", "color": "#2b2b2b", "fontSize": "30px"}),
     preset("heading_medium", "HM", {"fontFamily": "Arial", "color": "#2b2b2b", "fontSize": "24px"}),
     preset("heading_small", "HS", {"fontFamily": "Arial", "color": "#2b2b2b", "fontSize": "18px"}),
     preset("paragraph", "P", {"fontFamily": "Arial", "color": "#2b2b2b", "fontSize": "16px", "lineHeight": "160%"}),
     preset("footnote", "F", {"fontFamily": "Arial", "color": "#8a8a8a", "fontSize": "12px"}),
   ],
 },
 "sections": [{
   "id": I(),
   "styleProperties": {"backgroundColor": "#ffffff", "paddingTop": "24px", "paddingBottom": "24px", "paddingLeft": "24px", "paddingRight": "24px"},
   "rows": [{"id": I(), "columns": [{"id": I(), "width": "552px", "blocks": blocks}]}],
 }],
}
out = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
io.open('native1.json', 'w', encoding='utf-8').write(out)
print("blocs:", len(blocks), "| taille:", len(out), "octets | guillemets doubles dans le HTML:", out.count('\\"'))
