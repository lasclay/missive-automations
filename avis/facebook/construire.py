# Construit les deux CSV Judge.me a partir des avis Facebook recoupes.
# Regle de fer, la meme que pour la boite support: seuls les mots ecrits par le client
# sont publies. Un resume de ce qu'il a dit n'est pas un avis signe par lui.
import csv, json, re, unicodedata
R = "../reviews"

def empreinte(t):
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "", t)[:60]

COL = ["title","body","rating","review_date","source","curated","reviewer_name","reviewer_email",
       "product_id","product_handle","reply","reply_date","picture_urls","ip_address","location","metaobject_handle"]

cat = {}
for l in open(f"{R}/catalogue.tsv", encoding="utf-8"):
    p = l.rstrip("\n").split("\t")
    if len(p) >= 2: cat[p[0]] = p[1]

def cle(t):
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()

# Ce qui est deja en ligne ou deja dans les fichiers en attente d'import.
# On garde aussi le texte complet par auteur: un client qui a ecrit la meme chose sur
# Facebook et dans le formulaire Judge.me n'ecrit pas deux fois mot pour mot. Jacinthe
# Riverin ouvre par la meme phrase et poursuit differemment, meme jour, meme produit.
import difflib
par_auteur = {}
par_jour = {}
deja = set()
for a in json.load(open(f"{R}/judgeme_avis.json")):
    deja.add(empreinte(a.get("corps")))
    par_auteur.setdefault(cle(a.get("auteur")), []).append(a.get("corps"))
    par_jour.setdefault((cle(a.get("auteur")), (a.get("date") or "")[:10]), []).append(a.get("corps"))
for r in json.load(open(f"{R}/importes.json")): deja.add(empreinte(r.get("corps")))
for f in ("import_judgeme.csv","import_judgeme_boutique.csv","import_judgeme_a_relire.csv"):
    for r in csv.DictReader(open(f"{R}/{f}", encoding="utf-8")): deja.add(empreinte(r["body"]))

# nom, courriel, date, produit (vide = avis de boutique), titre, corps verbatim
AVIS = [
 ("Dominique Trottier","dominiquetrottiergelinas@gmail.com","2025-02-15","mittens",
  "Très satisfaite de mes mitaines","Je suis très satisfaite de mes mitaines! Merci!!!"),
 ("Angèle Fournier","mangrove6@hotmail.com","2025-01-22","",
  "Produits de qualité","Produits de qualité et très bon service après-vente"),
 ("Nathalie Michaud","frasermichaud@gmail.com","2024-10-20","",
  "","Le service à la clientèle est hors pair!"),
 ("Josée Denis","joseeden@hotmail.ca","2023-12-31","",
  "","Bravo pour votre service après vente!"),
 ("Sophie Lemieux","sofilemieu@gmail.com","2023-12-26","",
  "Des gens courtois","Des gens courtois et soucieux d'offrir un super service."),
 ("Marie-Hélène Boivin","mh_boivin@hotmail.com","2022-12-29","mittens",
  "Belles mitaines chaudes","Belles mitaines chaudes et locales, on aime ça!"),
 # Anne-Julie Frenette n'a qu'une commande, six mois APRES son avis, et des bombes
 # semencieres n'ont rien a voir avec « ca ne mouille pas ». La commande ne corrobore
 # donc pas: pas de fiche produit, pas de pastille d'acheteur verifie. Mais son nom est
 # unique dans Shopify et un avis de boutique ne vouche pour aucun article, donc il passe.
 ("Anne-Julie Frenette","ajfrenette@gmail.com","2024-01-05","",
  "","C'est vrai que ça mouille pas. Pour vrai."),
 ("Denise Emond","demond29@hotmail.fr","2022-08-25","",
  "Elle en vaut la peine","Pour ceux qui sont dans l'attente, je vous le dis, elle en vaut la peine."),
 ("Philippe Dubé","philippe.dube.1@ulaval.ca","2022-02-03","",
  "","Le service et l'attention portée à la clientèle."),
 ("Roger Gagnon","rogag246@videotron.ca","2022-01-22","mittens",
  "Vraiment chaudes","Elles sont vraiment chaudes. Bravo au coton d'asclépiade!"),
 ("Louise Marchand","loulouchemarchand@gmail.com","2022-01-21","",
  "","Excellent service!"),
 ("Roland Baker","orab1@hotmail.ca","2022-01-21","mittens",
  "Bon produit de qualité","Bon produit de qualité, très satisfait de mes mitaines."),
 ("Jacinthe Riverin","jacintheriverin@live.ca","2021-04-30","mittens",
  "Belle confection","J'ai reçu mes belles mitaines. Belle confection."),
 ("Denis Auger","denis.auger@hotmail.com","2021-03-08","",
  "","L'attente a tellement valu la peine!"),
 ("Justin Gélinas","justin.gelinas.3@ulaval.ca","2021-03-06","mittens",
  "","Je dois avouer que ça m'a donné le goût de les garder."),
 ("Françoise Legault","francoise.legault55@gmail.com","2021-03-15","mittens",
  "Chaudes et légères","Bien chaudes, légères, confortables et minimalistes."),
 ("Isabelle Martineau","isabellebouzi@yahoo.ca","2021-05-26","mittens",
  "Enfin reçu mes mitaines","J'ai enfin reçu mes mitaines! Aussi satisfaite du produit que du service à la clientèle en amont. Merci Lasclay!"),
]

produits, boutique, jetes = [COL], [COL], []
def deja_publie(nom, date, corps):
    """Renvoie le motif si cet avis est deja en ligne, sinon None.
    Trois signaux, du plus sur au moins sur: le texte mot pour mot; le meme auteur le
    meme jour (une personne n'ecrit pas deux avis differents le meme jour, elle a
    simplement publie sur Facebook et dans le formulaire); le meme auteur avec un texte
    tres proche, quand le texte est assez long pour que le rapprochement veuille dire
    quelque chose. Judge.me n'affichant que le prenom, on teste nom complet et prenom."""
    if empreinte(corps) in deja:
        return "deja publie mot pour mot"
    # Judge.me abrege souvent le nom de famille en initiale: « Tom R. », « Lucie B. »,
    # « Luc P. ». Sans cette forme, trois avis deja en ligne passaient pour inedits.
    mots = cle(nom).split(" ")
    formes = [cle(nom), mots[0], f"{mots[0]} {mots[-1][0]}"]
    for f in formes:
        if date and par_jour.get((f, date)):
            return f"deja publie le meme jour: {par_jour[(f, date)][0][:60]}"
    # Dernier filet: n'importe quel auteur au meme prenom, le meme jour. Un homonyme qui
    # publie exactement le jour de l'avis Facebook, c'est la meme personne.
    if date:
        for a, d in par_jour:
            if d == date and a.startswith(mots[0]):
                return f"deja publie le meme jour ({a}): {par_jour[(a, d)][0][:50]}"
    if len(cle(corps)) > 40:
        for f in formes:
            for autre in par_auteur.get(f, []):
                a, b = cle(corps), cle(autre)
                # La citation relevee sur Facebook est souvent un extrait de l'avis complet:
                # « bien chaudes, legeres, confortables et minimalistes » est un morceau de la
                # phrase que Francoise Legault a deja publiee. Le taux de ressemblance chute
                # avec l'ecart de longueur et ne voit rien; l'inclusion, elle, la trouve.
                if a in b or b in a:
                    return f"extrait d'un avis deja publie: {autre[:60]}"
                if difflib.SequenceMatcher(None, a, b).ratio() > 0.6:
                    return f"le meme auteur a deja publie: {autre[:60]}"
    return None

for nom, courriel, date, handle, titre, corps in AVIS:
    motif = deja_publie(nom, date, corps)
    if motif:
        jetes.append((nom, motif)); continue
    l = {c: "" for c in COL}
    l.update(title=titre, body=corps, rating="5",
             review_date=f"{date} 12:00:00 UTC", source="web", curated="ok",
             reviewer_name=nom, reviewer_email=courriel,
             product_handle=handle, product_id=cat.get(handle, ""))
    (produits if handle else boutique).append([l[c] for c in COL])

with open("avis_fb_produits.csv","w",newline="",encoding="utf-8") as f: csv.writer(f).writerows(produits)
with open("avis_fb_boutique.csv","w",newline="",encoding="utf-8") as f: csv.writer(f).writerows(boutique)
print("avis_fb_produits.csv :", len(produits)-1, "lignes")
print("avis_fb_boutique.csv :", len(boutique)-1, "lignes")
for n,m in jetes: print("  ecarte :", n, "|", m)
