# Construit les deux CSV Judge.me a partir des avis Facebook recoupes.
# Regle de fer, la meme que pour la boite support: seuls les mots ecrits par le client
# sont publies. Un resume de ce qu'il a dit n'est pas un avis signe par lui.
import csv, json, re, unicodedata
R = "../reviews"
COL = ["title","body","rating","review_date","source","curated","reviewer_name","reviewer_email",
       "product_id","product_handle","reply","reply_date","picture_urls","ip_address","location","metaobject_handle"]

cat = {}
for l in open(f"{R}/catalogue.tsv", encoding="utf-8"):
    p = l.rstrip("\n").split("\t")
    if len(p) >= 2: cat[p[0]] = p[1]

# nom, courriel, date, produits, titre, corps verbatim
AVIS = [
 ("Dominique Trottier","dominiquetrottiergelinas@gmail.com","2025-02-15",["mittens"],
  "Très satisfaite de mes mitaines","Je suis très satisfaite de mes mitaines! Merci!!!"),
 # Commande de mitaines en mai 2021 et de foulard en septembre 2021, les deux avant son
 # avis: son « chauds, confortables » porte bien sur ces deux articles-la.
 ("Dominique Lemelin","dominique.lemelin@icloud.com","2022-01-08",["mittens","scarf"],
  "Belle confection","Chauds, confortables et tellement d'une belle confection. Vivement les produits du Québec!!!"),
 ("Isabelle Martineau","isabellebouzi@yahoo.ca","2021-05-26",["mittens"],
  "Enfin reçu mes mitaines","J'ai enfin reçu mes mitaines! Aussi satisfaite du produit que du service à la clientèle en amont."),
 ("Samuel Pinna","samuel.pinna@gmail.com","2026-01-14",[],
  "Quelle qualité de produits","Quelle qualité de produits et quel super service de Lasclay!!!"),
 ("Angèle Fournier","mangrove6@hotmail.com","2025-01-22",[],
  "Produits de qualité","Produits de qualité et très bon service après-vente"),
 ("Nathalie Michaud","frasermichaud@gmail.com","2024-10-20",[],
  "","Le service à la clientèle est hors pair!"),
 ("Danielle Olivier","danielle.olivier30@gmail.com","2024-04-28",[],
  "","Service à la clientèle très efficace."),
 # Une seule commande, six mois APRES son avis, et des bombes semencieres n'ont rien a voir
 # avec « ca ne mouille pas ». La commande ne corrobore donc pas: pas de fiche produit, pas
 # de pastille. Mais son nom est unique dans Shopify et un avis de boutique ne vouche pour
 # aucun article, donc il passe.
 ("Anne-Julie Frenette","ajfrenette@gmail.com","2024-01-05",[],
  "","C'est vrai que ça mouille pas. Pour vrai. Fait 40 ans j'attends ça."),
 ("Josée Denis","joseeden@hotmail.ca","2023-12-31",[],
  "","Bravo pour votre service après vente!"),
 ("Sophie Lemieux","sofilemieu@gmail.com","2023-12-26",[],
  "Des gens courtois","Des gens courtois et soucieux d'offrir un super service."),
 ("Denise Emond","demond29@hotmail.fr","2022-08-25",[],
  "Elle en vaut la peine","Pour ceux qui sont dans l'attente, je vous le dis, elle en vaut la peine."),
 ("Suzanne Levasseur","suzlevas@hotmail.com","2022-02-18",[],
  "Service vraiment exceptionnel","Service vraiment exceptionnel! Entreprise québécoise en laquelle on peut faire confiance!"),
]

produits, boutique = [COL], [COL]
for nom, courriel, date, handles, titre, corps in AVIS:
    for h in (handles or [""]):
        l = {c: "" for c in COL}
        l.update(title=titre, body=corps, rating="5",
                 review_date=f"{date} 12:00:00 UTC", source="web", curated="ok",
                 reviewer_name=nom, reviewer_email=courriel,
                 product_handle=h, product_id=cat.get(h, ""))
        (produits if h else boutique).append([l[c] for c in COL])

for f, lot in (("avis_fb_produits.csv", produits), ("avis_fb_boutique.csv", boutique)):
    with open(f, "w", newline="", encoding="utf-8") as fh: csv.writer(fh).writerows(lot)
    print(f, ":", len(lot) - 1, "lignes")
