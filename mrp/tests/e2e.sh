#!/bin/sh
# Test de bout en bout : démarre le serveur sur une base jetable et vérifie
# le parcours complet, y compris le modèle de permissions.
set -e
cd "$(dirname "$0")/.."
DB=$(mktemp -d)/t.db; PORT=${PORT:-3199}
export MRP_DB="$DB"
ok(){ printf "  [OK ] %s\n" "$1"; }
ko(){ printf "  [ÉCHEC] %s\n" "$1"; kill $SRV 2>/dev/null; exit 1; }

# Le service charge les données du dépôt au démarrage. Ces tests comptent les
# lignes qu'ils écrivent EUX-MÊMES : trente-quatre produits et cent trente-trois
# points de contrôle arrivant sous leurs pieds feraient échouer des assertions
# justes. D'où MRP_SANS_AMORCE=1 sur chaque lancement de serveur ci-dessous.
# MRP_SANS_RAPPELS=1 pour la même raison : le rappel hebdomadaire crée une tâche
# par compte d'atelier, et les tests comptent les tâches qu'ils écrivent eux-mêmes.
node mrp.js demo >/dev/null 2>&1
node mrp.js utilisateur:creer a@test.com motdepasse1 "Admin" admin >/dev/null 2>&1
node mrp.js utilisateur:creer o@test.com motdepasse2 "Atelier" atelier >/dev/null 2>&1
PORT=$PORT MRP_SANS_AMORCE=1 MRP_SANS_RAPPELS=1 node --no-warnings server.js >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1.5
B="http://localhost:$PORT"; CA=$(mktemp); CO=$(mktemp)

[ "$(curl -s $B/sante | grep -c '"ok":true')" = 1 ] && ok "sonde de santé" || ko "sonde"

[ "$(curl -s -o /dev/null -w '%{http_code}' $B/ordres)" = 303 ] \
  && ok "accès anonyme redirigé vers la connexion" || ko "anonyme non redirigé"

[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/connexion \
     --data 'courriel=a@test.com&mdp=mauvais')" = 401 ] \
  && ok "mot de passe invalide rejeté" || ko "mauvais mdp accepté"

curl -s -c $CA -o /dev/null -X POST $B/connexion --data 'courriel=a@test.com&mdp=motdepasse1'
curl -s -c $CO -o /dev/null -X POST $B/connexion --data 'courriel=o@test.com&mdp=motdepasse2'
grep -q mrp_session $CA && ok "connexion admin" || ko "connexion admin"
grep -q mrp_session $CO && ok "connexion atelier" || ko "connexion atelier"

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/1/avancement --data 'valeur=70'
V=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT avancement a FROM ordre_items WHERE id=1').get().a)" 2>/dev/null)
[ "$V" = 70 ] && ok "l'atelier met à jour l'avancement (40 → 70)" || ko "avancement non enregistré ($V)"

H=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM avancement_historique').get().n)" 2>/dev/null)
[ "$H" -ge 1 ] && ok "mise à jour tracée dans l'historique" || ko "historique vide"

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/1/avancement --data 'valeur=75'
V=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT avancement a FROM ordre_items WHERE id=1').get().a)" 2>/dev/null)
[ "$V" = 70 ] && ok "valeur hors tranche de 10 % rejetée" || ko "valeur 75 acceptée"

R=$(curl -s -b $CO -o /dev/null -w '%{redirect_url}' $B/ordres/nouveau)
case "$R" in *err=*) ok "l'atelier ne peut pas créer d'ordre" ;; *) ko "création autorisée à l'atelier" ;; esac

# Chaque planche atteignable doit s'ouvrir. La route ne testait que le tracé
# SVG, si bien que les vingt-quatre planches nées dessinées — sans tracé, rien
# que des images — répondaient toutes « Planche inconnue ». Aucun test ne
# passait par la route : ils vérifiaient le rendu, jamais l'ouverture.
CLES=$(node --no-warnings -e "
  const P=require('./pictos.js');
  const k=new Set([...Object.keys(P.PLANCHES), ...P.DESSINS]);
  console.log([...k].join(' '));" 2>/dev/null)
RATE=""
for K in $CLES; do
  R=$(curl -s -b $CO -o /dev/null -w '%{redirect_url}' "$B/qualite/planche/$K")
  case "$R" in *Planche+inconnue*|*Planche%20inconnue*) RATE="$RATE $K" ;; esac
done
[ -z "$RATE" ] && ok "chaque planche s'ouvre par sa route" \
  || ko "planches refusées par la route :$RATE"

# Chaque schéma interne cité par les données doit être servi : un nom mal
# recopié donnerait un cadre vide sur le point de contrôle, sans erreur.
SCH=$(grep -rhoE '/schema/[a-z0-9-]+\.(png|jpe?g|webp|svg)' donnees/ | sort -u)
MANQUE=""
for S in $SCH; do
  [ "$(curl -s -b $CO -o /dev/null -w '%{http_code}' "$B$S")" = 200 ] || MANQUE="$MANQUE $S"
done
[ -z "$MANQUE" ] && ok "chaque schéma interne cité est servi" || ko "schémas introuvables :$MANQUE"

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/2/supprimer
N=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM ordre_items').get().n)" 2>/dev/null)
[ "$N" = 4 ] && ok "l'atelier ne peut pas supprimer d'item" || ko "item supprimé par l'atelier"

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/commentaires --data 'texte=Coupe terminée'
C=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM ordre_commentaires').get().n)" 2>/dev/null)
[ "$C" -ge 1 ] && ok "l'atelier peut commenter" || ko "commentaire refusé"

# avancement global pondéré : 2000×70 + 800×20 + 500×0 + 300×10 = 159000 / 3600 = 44 %
P=$(curl -s -b $CA $B/ordres/1 \
  | grep -oE 'aria-label="[0-9]+ % fait"' | head -1 | tr -dc 0-9)
[ "$P" = 44 ] && ok "avancement global pondéré par les quantités = 44 %" || ko "pondération incorrecte ($P)"

# ---------------------------------------------------------------- le fil d'un item
# Le fil vit à côté du produit, pas au bas de la page : une question sur le
# cache-cou ne doit pas atterrir sous une remarque sur les tuques.
Q(){ node -e "const{db}=require('./db.js');console.log(db.prepare(\"$1\").get().n)" 2>/dev/null; }

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/3/fil \
  --data 'type=question&texte=Quel fil pour la doublure ?'
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE item_id=3 AND type='question'")" = 1 ] \
  && ok "l'atelier pose une question sur un lot" || ko "question non enregistrée"

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/3/fil --data 'type=note&texte='
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE item_id=3")" = 1 ] \
  && ok "message vide refusé" || ko "message vide accepté"

# « Demander une mise à jour » est un geste d'administration : l'atelier
# déclare son avancement, il ne se le réclame pas à lui-même.
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/3/demander
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE type='demande'")" = 0 ] \
  && ok "l'atelier ne demande pas de mise à jour" || ko "demande créée par l'atelier"

curl -s -b $CA -o /dev/null -X POST $B/ordres/1/items/3/demander
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE item_id=3 AND type='demande' AND regle_le IS NULL")" = 1 ] \
  && ok "l'administration demande une mise à jour" || ko "demande non créée"

# Appuyer deux fois ne double pas la pression.
curl -s -b $CA -o /dev/null -X POST $B/ordres/1/items/3/demander
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE item_id=3 AND type='demande'")" = 1 ] \
  && ok "une seule demande ouverte à la fois" || ko "demande dupliquée"

# Ce qui attend se voit sans ouvrir l'ordre : deux entrées ouvertes sur l'item 3.
[ "$(curl -s -b $CA $B/ | grep -c 'En attente de réponse')" = 1 ] \
  && ok "l'accueil remonte ce qui attend une réponse" || ko "accueil muet"

# Le geste central : déclarer un avancement REFERME la demande. Sans ça,
# l'atelier devrait faire deux gestes pour une seule information.
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/3/avancement --data 'valeur=30'
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE item_id=3 AND type='demande' AND regle_le IS NULL")" = 0 ] \
  && ok "déclarer un avancement referme la demande" || ko "demande restée ouverte"

# … mais pas la question : elle attend une phrase, pas un chiffre.
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE item_id=3 AND type='question' AND regle_le IS NULL")" = 1 ] \
  && ok "la question reste ouverte, elle attend une phrase" || ko "question refermée à tort"

curl -s -b $CA -o /dev/null -X POST $B/ordres/1/items/3/fil \
  --data 'type=reponse&texte=Fil polyester noir, comme sur la charte.'
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE item_id=3 AND regle_le IS NULL AND type IN ('question','demande')")" = 0 ] \
  && ok "une réponse referme ce qui attendait" || ko "réponse sans effet"

# Un fil appartient à son ordre. Un identifiant d'item valide ailleurs ne doit
# pas ouvrir la porte : c'est la même vérification que sur l'avancement.
curl -s -b $CA -o /dev/null -X POST $B/ordres/nouveau --data 'titre=Ordre témoin'
O2=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT MAX(id) n FROM ordres').get().n)" 2>/dev/null)
curl -s -b $CA -o /dev/null -X POST $B/ordres/$O2/items/3/fil --data 'type=note&texte=ailleurs'
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE texte='ailleurs'")" = 0 ] \
  && ok "un item ne s'écrit pas depuis un autre ordre" || ko "cloisonnement des ordres percé"

# Un message se corrige — mais seulement le sien. Un fil où l'on peut se faire
# réécrire par quelqu'un d'autre ne vaut plus rien comme trace, et c'est comme
# trace qu'il sert, trois semaines plus tard.
F=$(Q "SELECT id n FROM item_fil WHERE item_id=3 AND type='question' ORDER BY id LIMIT 1")
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/3/fil/$F/modifier \
  --data 'texte=Quel fil pour la doublure, le noir ou le gris ?'
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE id=$F AND texte LIKE '%le noir ou le gris%'")" = 1 ] \
  && ok "l'auteur corrige son propre message" || ko "la correction n'a pas pris"

[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE id=$F AND modifie_le IS NOT NULL")" = 1 ] \
  && ok "la correction est datée — elle ne se fait pas en douce" \
  || ko "message corrigé sans trace"

# L'administration non plus : le garde-fou est dans la clause SQL, pas dans un
# contrôle de rôle qu'une URL fabriquée contournerait.
curl -s -b $CA -o /dev/null -X POST $B/ordres/1/items/3/fil/$F/modifier --data 'texte=RÉÉCRIT'
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE texte='RÉÉCRIT'")" = 0 ] \
  && ok "personne ne réécrit le message d'un autre, pas même l'administration" \
  || ko "un message a été réécrit par quelqu'un d'autre"

curl -s -b $CA -o /dev/null -X POST $B/ordres/1/items/3/fil/$F/supprimer
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE id=$F")" = 1 ] \
  && ok "personne ne supprime le message d'un autre" \
  || ko "un message a été supprimé par quelqu'un d'autre"

# Un message vide n'est pas une correction : c'est une suppression, et elle a
# son propre bouton.
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/3/fil/$F/modifier --data 'texte=   '
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE id=$F AND texte != ''")" = 1 ] \
  && ok "une correction vide est refusée" || ko "le message a été vidé"

# Et l'auteur retire le sien — une note posée sur le mauvais lot.
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/3/fil --data 'type=note&texte=mauvais lot'
D=$(Q "SELECT id n FROM item_fil WHERE texte='mauvais lot'")
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/3/fil/$D/supprimer
[ "$(Q "SELECT COUNT(*) n FROM item_fil WHERE texte='mauvais lot'")" = 0 ] \
  && ok "l'auteur retire son propre message" || ko "suppression sans effet"



# ------------------------------------------------------------------- l'écran
# La pastille produit est ce qui rend les listes de travail lisibles : un code
# comme « MIT-POLAR » demande un aller-retour dans la tête, la mitaine non.
# Assez discret pour disparaître à la première refonte de requête — d'où le test.
curl -s -b $CA "$B/priorites" | grep -q 'class="mini' \
  && ok "la liste de fabrication porte une pastille par produit" \
  || ko "plus de pastille produit dans « À fabriquer »"
curl -s -b $CA "$B/ordres/1" | grep -q 'class="mini' \
  && ok "les items d'un ordre portent leur pastille" || ko "pastille absente de l'ordre"

# `.av` a longtemps désigné DEUX choses : le formulaire de tranches (une grille
# de onze colonnes) et la colonne « Avancement » du tableau de fabrication. La
# grille se posait donc sur la cellule du tableau et l'écrasait. La règle doit
# rester scopée au formulaire.
grep -q '^form\.av{' public/style.css \
  && ok "le sélecteur d'avancement reste scopé au formulaire" \
  || ko "la grille .av déborde à nouveau sur la colonne du tableau"
grep -qE '^\.av\{' public/style.css \
  && ko "une règle .av nue est revenue : elle écrase la cellule du tableau" \
  || ok "aucune règle .av nue"

# La grille des pièces est ce que le tableau de bord montre en premier : une
# tuile par produit, sa photo, son pourcentage. « 27 243 pièces à faire » ne
# disait pas DE QUOI.
P=$(curl -s -b $CA "$B/" | grep -c 'class="tuile ')
[ "$P" -ge 1 ] \
  && ok "le tableau de bord montre la grille des pièces ($P tuiles)" \
  || ko "plus de grille de pièces sur le tableau de bord"

# Un produit présent dans deux ordres compte UNE fois, et son avancement se
# pondère par les quantités : 100 % de 100 pièces et 0 % de 2 000 ne font
# pas 50 %. Une moyenne naïve ferait mentir la tuile du gros morceau.
# Sur SA PROPRE base : écrire dans celle des autres tests changeait le plan
# sous leurs pieds — le tri par priorité tombait deux cents lignes plus bas.
A=$(MRP_DB="$(mktemp -d)/apercu.db" node --no-warnings -e "
  const D=require('./db.js'), {db}=D;
  db.prepare(\"INSERT INTO produits (id,code,nom) VALUES (1,'X','Pièce X')\").run();
  db.prepare(\"INSERT INTO ordres (id,numero,titre,statut) VALUES (1,'OP-1','t','en_cours')\").run();
  const i=db.prepare('INSERT INTO ordre_items (ordre_id,produit_id,quantite,avancement) VALUES (1,1,?,?)');
  i.run(2000, 0); i.run(100, 100);
  const t=D.apercuProduction();
  console.log(t.length + ' ' + (t[0] ? t[0].pct + ' ' + t[0].quantite : ''));" 2>/dev/null)
[ "$A" = "1 5 2100" ] \
  && ok "un produit en double compte une fois, pondéré par les quantités" \
  || ko "la vue d'ensemble double ou moyenne mal les produits ($A)"

# ce qui compte n'est pas le poids du HTML mais ce qui part sur le réseau
for u in / /ordres /ordres/1 /produits /produits/1 /cedule /priorites /suivi \
         /inventaire /besoins /calendrier \
         /qualite /qualite/produits /qualite/general /qualite/ordres \
         '/qualite/ordres/1' '/qualite/ordres/1?vue=liste' \
         '/qualite/ordres/1?vue=liste&ouvert=1'; do
  S=$(curl -s -b $CA "$B$u" -H 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}')
  [ "$S" -lt 12000 ] || ko "page $u trop lourde sur le réseau ($S octets compressés)"
done
ok "toutes les pages sous 12 Ko compressées"

# la compression doit être fidèle : même contenu des deux côtés
A=$(curl -s -b $CA --compressed "$B/ordres/1" | md5sum)
I=$(curl -s -b $CA -H 'Accept-Encoding: identity' "$B/ordres/1" | md5sum)
[ "$A" = "$I" ] && ok "contenu identique avec et sans compression" \
  || ko "la compression altère le contenu"

# un client qui ne demande pas gzip doit recevoir du clair
H=$(curl -s -b $CA -H 'Accept-Encoding: identity' -D - -o /dev/null "$B/ordres/1")
echo "$H" | grep -qi 'content-encoding' \
  && ko "compression imposée à un client qui ne la demande pas" \
  || ok "pas de compression sans Accept-Encoding" 

# aucune image n'est hébergée par l'app : les URL sortent vers le CDN, redimensionnées
node -e "
const{urlImage}=require('./vues.js');
const t=[
 ['https://cdn.shopify.com/s/files/1/x.png?v=1','https://cdn.shopify.com/s/files/1/x.png?v=1&width=320'],
 ['https://cdn.shopify.com/s/files/1/x.png','https://cdn.shopify.com/s/files/1/x.png?width=320'],
 ['https://cdn.shopify.com/s/files/1/x.png?width=800','https://cdn.shopify.com/s/files/1/x.png?width=800'],
 ['https://drive.google.com/file/d/ABC123/view?usp=sharing','https://lh3.googleusercontent.com/d/ABC123=w320'],
 ['https://exemple.com/photo.jpg','https://exemple.com/photo.jpg'],
];
for(const[a,b]of t){const r=urlImage(a,320);if(r!==b){console.error('  '+a+' → '+r+' (attendu '+b+')');process.exit(1)}}
" && ok "URL d'images redimensionnées au CDN (rien n'est hébergé)" || ko "transformation d'URL d'image incorrecte"

# une data: URI embarquerait l'image dans la base et dans chaque page : refusée
curl -s -b $CA -o /dev/null -X POST $B/produits/1/photos \
  --data-urlencode 'url=data:image/png;base64,iVBORw0KGgo=' --data 'type=studio'
D=$(node -e "const{db}=require('./db.js');console.log(db.prepare(\"SELECT COUNT(*) n FROM produit_photos WHERE url LIKE 'data:%'\").get().n)" 2>/dev/null)
[ "$D" = 0 ] && ok "data: URI refusée à l'enregistrement" || ko "data: URI enregistrée en base"

# aucune page ne sert d'image depuis l'app : tous les src pointent ailleurs
for u in /produits /produits/1; do
  curl -s -b $CA "$B$u" | grep -oE '<img[^>]+src="[^"]*"' | grep -qv 'src="http' \
    && ko "image servie localement sur $u"
done
ok "toutes les images pointent vers une URL externe"

# ---- à fabriquer : la liste doit être triée, pas seulement affichée
P=$(curl -s -b $CA $B/priorites)
echo "$P" | grep -q 'items à produire' && ok "liste de fabrication rendue" \
  || ko "liste de fabrication absente"

# le rang 1 doit être celui que le tri désigne, pas le premier item saisi
node -e "
const {db,listeFabrication}=require('./db.js');
// on met une échéance proche sur l'ordre et une priorité haute sur le dernier item
db.exec(\"INSERT INTO ordre_jalons (ordre_id,titre,date,type) VALUES (1,'Test',date('now','+2 days'),'deadline')\");
const dernier=db.prepare('SELECT id FROM ordre_items ORDER BY id DESC LIMIT 1').get().id;
db.prepare('UPDATE ordre_items SET priorite=? WHERE id=?').run('haute',dernier);
const f=listeFabrication();
if(f[0].id!==dernier){console.error('rang 1 = '+f[0].id+' au lieu de '+dernier);process.exit(1)}
" 2>/dev/null && ok "la priorité haute passe en tête du tri" \
  || ko "le tri ignore la priorité haute"

# l'atelier voit la liste mais ne peut pas changer une priorité
curl -s -b $CO $B/priorites | grep -q 'À fabriquer' \
  && ok "l'atelier accède à la liste de fabrication" || ko "liste refusée à l'atelier"
AV=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT priorite p FROM ordre_items WHERE id=1').get().p)" 2>/dev/null)
curl -s -b $CO -o /dev/null -X POST $B/priorites/1 --data 'priorite=haute'
AP=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT priorite p FROM ordre_items WHERE id=1').get().p)" 2>/dev/null)
[ "$AV" = "$AP" ] && ok "l'atelier ne peut pas changer une priorité" \
  || ko "priorité modifiée par l'atelier ($AV → $AP)"

curl -s -b $CA -o /dev/null -X POST $B/priorites/1 --data 'priorite=basse'
[ "$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT priorite p FROM ordre_items WHERE id=1').get().p)" 2>/dev/null)" = basse ] \
  && ok "l'administration change une priorité" || ko "priorité non enregistrée"

# la hiérarchie des familles doit tenir dans le vrai rendu HTML
node -e "
const {db,listeFabrication}=require('./db.js');
db.exec(\"UPDATE produits SET famille='isotherme'\");
db.exec(\"UPDATE produits SET famille='hiver' WHERE id=1\");
db.exec(\"UPDATE ordre_items SET priorite='normale'\");
const f=listeFabrication();
if(f[0].produit_id!==1){console.error('rang 1 = produit '+f[0].produit_id);process.exit(1)}
" 2>/dev/null && ok "la famille hiver passe devant l'isotherme" \
  || ko "la hiérarchie des familles est ignorée"

curl -s -b $CA $B/priorites | grep -q 'f-hiver' \
  && ok "la famille s'affiche dans la liste" || ko "famille absente du rendu"

# ---- suivi
S=$(curl -s -b $CA $B/suivi)
echo "$S" | grep -q 'Dernières mises à jour' && ok "page de suivi rendue" || ko "suivi absent"
echo "$S" | grep -q 'Atelier' \
  && ok "le suivi nomme qui a fait la mise à jour" || ko "auteur absent du suivi"

# l'assistant : la page vit même sans clé API, et le dit au lieu de planter
A=$(curl -s -b $CA $B/assistant)
echo "$A" | grep -q 'ANTHROPIC_API_KEY' \
  && ok "assistant : absence de clé annoncée, pas de plantage" \
  || ko "assistant : la page ne signale pas la clé manquante"
echo "$A" | grep -q 'name="fil" value="[0-9a-f]\{18\}"' \
  && ok "assistant : un fil de conversation est ouvert" || ko "assistant : pas de fil"

# ---- calendrier et cédule : le pliage, les semaines, et le domino
curl -s -b $CO $B/calendrier | grep -q 'table class="cal"' \
  && ok "l'atelier accède au calendrier" || ko "calendrier refusé à l'atelier"
curl -s -b $CA "$B/calendrier?mois=2026-10" | grep -q 'octobre 2026' \
  && ok "le calendrier suit le mois demandé" || ko "mois non honoré"
# Un mois illisible ne doit pas casser la page : on retombe sur un mois valide.
curl -s -o /dev/null -w '%{http_code}' -b $CA "$B/calendrier?mois=pas-un-mois" \
  | grep -q 200 && ok "un mois illisible retombe sur un mois valide" \
  || ko "mois illisible non filtré"

# La cédule doit être pliable, sinon elle fait trois écrans sur un téléphone.
CED=$(curl -s -b $CA $B/cedule)
[ "$(echo "$CED" | grep -c '<summary>')" -ge 4 ] \
  && ok "la cédule est repliable" || ko "aucun bloc repliable sur la cédule"
echo "$CED" | grep -q 'semaine du' \
  && ok "le Gantt porte une échelle de semaines" || ko "Gantt sans semaines"
echo "$CED" | grep -q 'class="g-quand"' \
  && ok "chaque ligne du Gantt porte ses dates" || ko "Gantt sans dates"

# Poser une pause ou déplacer le départ relève de Québec.
R=$(curl -s -b $CO -o /dev/null -w '%{redirect_url}' -X POST $B/cedule/pauses \
    --data 'debut=2026-10-05&fin=2026-10-09')
case "$R" in *err=*) ok "l'atelier ne peut pas poser de pause" ;;
  *) ko "pause autorisée à l'atelier" ;; esac
R=$(curl -s -b $CO -o /dev/null -w '%{redirect_url}' -X POST $B/cedule/depart \
    --data 'depart=2026-10-05')
case "$R" in *err=*) ok "l'atelier ne peut pas déplacer le départ" ;;
  *) ko "départ modifiable par l'atelier" ;; esac

# Le domino, mesuré à travers l'app : une fermeture recule la fin du plan.
# La fermeture doit tomber SUR le plan, pas après : le jeu de démonstration ne
# porte que quelques heures de charge, et une pause posée au-delà de sa fin ne
# prouverait rien.
PLAN=$(node -e "const{listeFabrication}=require('./db.js'),C=require('./charge.js');
const c=C.calendrier(listeFabrication());console.log((c.debut||'')+' '+(c.fin||''))" 2>/dev/null)
DEB0=$(echo "$PLAN" | cut -d' ' -f1); FIN0=$(echo "$PLAN" | cut -d' ' -f2)
FERME=$(node -e "const d=new Date('$DEB0'+'T00:00:00Z');
console.log(new Date(d.getTime()+20*864e5).toISOString().slice(0,10))" 2>/dev/null)
curl -s -b $CA -o /dev/null -X POST $B/cedule/pauses \
  --data "debut=$DEB0&fin=$FERME&motif=Test%20domino"
FIN1=$(node -e "const{listeFabrication}=require('./db.js'),C=require('./charge.js');
console.log(C.calendrier(listeFabrication()).fin||'')" 2>/dev/null)
if [ -z "$FIN0" ]; then ok "aucune charge au plan : domino sans objet"
elif [ "$FIN1" \> "$FIN0" ]; then ok "une fermeture recule la fin du plan ($FIN0 → $FIN1)"
else ko "la fermeture n'a rien décalé ($FIN0 → $FIN1)"; fi

PID2=$(node -e "const{db}=require('./db.js');const p=db.prepare('SELECT id FROM pauses ORDER BY id DESC LIMIT 1').get();console.log(p?p.id:'')" 2>/dev/null)
curl -s -b $CA -o /dev/null -X POST $B/cedule/pauses/$PID2/supprimer
FIN2=$(node -e "const{listeFabrication}=require('./db.js'),C=require('./charge.js');
console.log(C.calendrier(listeFabrication()).fin||'')" 2>/dev/null)
[ "$FIN2" = "$FIN0" ] && ok "retirer la fermeture rend le plan d'avant" \
  || ko "le plan n'est pas revenu ($FIN0 → $FIN2)"

# ---- inventaire : les droits ne sont pas les mêmes des deux côtés
curl -s -b $CO $B/inventaire | grep -q 'Inventaire' \
  && ok "l'atelier accède à l'inventaire" || ko "inventaire refusé à l'atelier"
curl -s -b $CO $B/besoins | grep -q 'Besoins en matières' \
  && ok "l'atelier accède aux besoins" || ko "besoins refusés à l'atelier"

# créer une matière relève de Québec ; la compter relève de l'atelier.
R=$(curl -s -b $CO -o /dev/null -w '%{redirect_url}' $B/matieres/nouveau)
case "$R" in *err=*) ok "l'atelier ne peut pas créer de matière" ;;
  *) ko "création de matière autorisée à l'atelier" ;; esac

curl -s -b $CA -o /dev/null -X POST $B/matieres/nouveau \
  --data 'code=tissu-test&nom=Tissu de test&categorie=tissu&unite=m&cout_unite=5,50&seuil_alerte=20&suivi_stock=1'
MID=$(node -e "const{db}=require('./db.js');const m=db.prepare(\"SELECT id FROM matieres WHERE code='TISSU-TEST'\").get();console.log(m?m.id:'')" 2>/dev/null)
[ -n "$MID" ] && ok "le code d'une matière est normalisé en majuscules" \
  || ko "matière non créée ou code non normalisé"

# Un prix saisi à la française doit être lu comme un nombre, pas rejeté.
C=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT cout_unite c FROM matieres WHERE id=?').get($MID).c)" 2>/dev/null)
[ "$C" = "5.5" ] && ok "« 5,50 » est lu comme 5,50" || ko "virgule décimale mal lue ($C)"

# l'atelier reçoit et compte : c'est lui qui est devant la tablette
curl -s -b $CO -o /dev/null -X POST $B/matieres/$MID/mouvements \
  --data 'motif=reception&quantite=100'
S=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COALESCE(SUM(quantite),0) s FROM mouvements WHERE matiere_id=?').get($MID).s)" 2>/dev/null)
[ "$S" = "100" ] && ok "l'atelier enregistre une réception" || ko "réception refusée à l'atelier ($S)"

curl -s -b $CO -o /dev/null -X POST $B/matieres/$MID/mouvements \
  --data 'motif=inventaire&quantite=88'
S=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COALESCE(SUM(quantite),0) s FROM mouvements WHERE matiere_id=?').get($MID).s)" 2>/dev/null)
[ "$S" = "88" ] && ok "un comptage remplace le stock" || ko "comptage mal appliqué ($S)"

# le code d'une matière est son identité : deux fois le même doit être refusé
curl -s -b $CA -o /dev/null -X POST $B/matieres/nouveau \
  --data 'code=TISSU-TEST&nom=Doublon&categorie=tissu&unite=m'
N=$(node -e "const{db}=require('./db.js');console.log(db.prepare(\"SELECT COUNT(*) n FROM matieres WHERE code='TISSU-TEST'\").get().n)" 2>/dev/null)
[ "$N" = "1" ] && ok "un code de matière en double est refusé" || ko "doublon de code accepté ($N)"

# les gabarits proposés dépendent du rôle
curl -s -b $CO $B/assistant | grep -q "atelier" \
  && ok "assistant : l'atelier est prévenu de ses limites" || ko "assistant : rôle non signalé"
curl -s -b $CO $B/assistant | grep -q 'Crée un ordre de production' \
  && ko "assistant : gabarits d'admin proposés à l'atelier" \
  || ok "assistant : gabarits adaptés au rôle"
curl -s -b $CO $B/assistant | grep -q 'class="modele"' \
  && ok "assistant : l'atelier a des gabarits" || ko "assistant : aucun gabarit"

# Un gabarit REMPLIT la boîte, il ne l'envoie pas. C'est le chemin sans
# JavaScript : le formulaire GET revient avec la demande déjà écrite.
PID=$(curl -s -b $CA $B/produits | grep -o '/produits/[0-9][0-9]*' | head -1 | tr -dc 0-9)
REMPLI=$(curl -s -b $CA "$B/assistant?m=qualite&produit=$PID" | tr '\n' ' ' \
  | grep -o '<textarea.*</textarea>')
echo "$REMPLI" | grep -q 'contrôle qualité' \
  && ok "gabarit : la boîte revient remplie" || ko "gabarit : boîte vide"
echo "$REMPLI" | grep -q '__________' \
  && ko "gabarit : le trou du produit n'a pas été rempli" \
  || ok "gabarit : le menu a rempli son trou"
# Un trou sans menu reste à compléter au clavier plutôt que de disparaître.
curl -s -b $CA "$B/assistant?m=jalon" | tr '\n' ' ' | grep -o '<textarea.*</textarea>' \
  | grep -q '______' \
  && ok "gabarit : les trous libres restent à compléter" || ko "gabarit : trou libre perdu"
# Remplir n'écrit rien : aucun tour ne doit être né d'un simple clic.
curl -s -b $CA "$B/assistant?m=echeances" | grep -q 'class="tour"' \
  && ko "gabarit : un clic a créé un tour" || ok "gabarit : remplir n'envoie rien"

# on n'annule pas le tour d'un autre
curl -s -b $CO -o /dev/null -w '%{redirect_url}' -X POST $B/assistant/1/annuler \
  | grep -q 'err=' && ok "assistant : tour d'autrui non annulable" \
  || ko "assistant : annulation croisée permise"

# --- contrôle qualité ----------------------------------------------------
# /qualite est un carrefour à trois portes. Chacune est vérifiée ici parce que
# chacune est une route distincte : une seule cassée passerait inaperçue.
Q=$(curl -s -b $CA $B/qualite)
for porte in /qualite/general /qualite/produits /qualite/ordres; do
  echo "$Q" | grep -q "$porte" || ko "la porte $porte manque à l'accueil qualité"
done
echo "$Q" | grep -q '/qualite/ordres' \
  && ok "l'accueil qualité offre ses trois portes" || ko "accueil qualité vide"

# Ce qui compte n'est pas le nombre de points, c'est QUELS produits n'en ont
# aucun. L'information a déménagé de /qualite vers /qualite/produits quand le
# carrefour est apparu ; elle doit rester au premier coup d'œil.
curl -s -b $CA $B/qualite/produits | grep -q 'aucun protocole' \
  && ok "la page par produit montre d'abord ce qui n'a rien" \
  || ko "les produits sans protocole ne se voient plus"

# Les procédés généraux : la page que l'atelier lit avant de toucher un lot.
curl -s -b $CO $B/qualite/general | grep -q 'Procédés généraux' \
  && ok "l'atelier accède aux procédés généraux" || ko "procédés généraux muets"

# --- rétroactions clients -------------------------------------------------
# Chaque produit a son onglet, y compris ceux dont personne n'a jamais parlé :
# un produit absent de la liste est un produit dont on ne se demande jamais ce
# que les clients en disent.
curl -s -b $CO $B/retroactions | grep -q 'Rétroactions clients' \
  && ok "l'atelier accède aux rétroactions clients" || ko "page des rétroactions muette"

curl -s -b $CO $B/produits/1/retroactions | grep -q 'Rétroactions clients' \
  && ok "un produit a son onglet de rétroactions" || ko "onglet de rétroactions absent"

# LA RÈGLE QUI COMPTE : les photos de clients ne sortent jamais sans session.
# Elles ne sont pas au Drive pour cette raison, et elles ne doivent surtout
# pas être servies comme un fichier statique — ceux-là passent avant la session.
PH=$(MRP_DB="$DB" node --no-warnings -e "
  const fs=require('fs'), path=require('path');
  const D=require('./db.js');
  const dir=path.join(__dirname,'photos-clients');
  const f=fs.existsSync(dir) ? fs.readdirSync(dir).find(x=>x.endsWith('.jpg')) : null;
  if(!f) process.exit(0);
  const p=D.db.prepare('SELECT id FROM produits LIMIT 1').get();
  D.db.prepare(\"INSERT INTO produit_retroactions (produit_id,probleme,titre,categorie,citation,photos,source_ref) VALUES (?,'couture','Couture décousue','bris',?,?,'missive:test')\")
    .run(p.id, 'Semence e2e : une couture a lâché après deux sorties, photo à l appui.', '/photo-client/'+f);
  console.log('/photo-client/'+f);" 2>/dev/null)
[ -n "$PH" ] && ok "une rétroaction avec photo est en place pour le test" \
  || ko "aucune photo de client à tester — les gardes d'accès ne seraient pas vérifiées"
if [ -n "$PH" ]; then
  [ "$(curl -s -b $CO -o /dev/null -w '%{http_code}' "$B$PH")" = 200 ] \
    && ok "une photo de client se sert dans une session ouverte" \
    || ko "photo de client inaccessible malgré la session"
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$B$PH")" = 303 ] \
    && ok "la même photo est refusée sans session" \
    || ko "UNE PHOTO DE CLIENT SORT SANS SESSION"
fi

# Un nom qui n'est pas un UUID ne doit jamais toucher le disque.
[ "$(curl -s -b $CO -o /dev/null -w '%{http_code}' "$B/photo-client/../../db.js")" = 404 ] \
  && ok "la route des photos refuse une traversée de répertoire" \
  || ko "traversée de répertoire possible sur les photos"

# --- le contrôle par ordre de production ---------------------------------
# La porte prioritaire. Les onglets ne sont pas exclusifs : un même lot peut
# être à la fois grand volume et gradué, et doit se voir dans les deux.
# ONGLET, pas CAT : plus bas, `CAT` est le chemin de la base du catalogue.
# Réutiliser le nom ici laissait CAT=gradation derrière la boucle, et tout
# `MRP_DB="$CAT"` écrit avant la ligne qui le redéfinit ouvrait une base vide
# nommée « gradation » — un test qui interroge le vide passe ou échoue pour la
# mauvaise raison, sans rien dire.
for ONGLET in tous volume nouveau gradation; do
  curl -s -b $CA "$B/qualite/ordres/1?cat=$ONGLET" | grep -q 'qc-onglet' \
    || ko "l'onglet $ONGLET ne rend pas ses onglets"
done
ok "les quatre onglets du contrôle par ordre répondent"

# Deux vues sur la même liste : cartes et liste à cocher. Repliée, la liste ne
# montre qu'une ligne par lot — c'est ce qui garde la page sous le plafond quel
# que soit le nombre de lots.
curl -s -b $CA "$B/qualite/ordres/1?vue=liste" | grep -q 'lot-ferme' \
  && ok "la vue liste tient en une ligne par lot" \
  || ko "la vue liste déplie tout et grossit avec l'ordre"

# Cliquer un produit veut dire « montre-moi ce qu'il y a à contrôler sur
# celui-là ». Le lien portait « vue=liste » sans « ouvert » : on tombait sur la
# liste de tous les lots, tous fermés, et il fallait un second clic.
curl -s -b $CA "$B/qualite/ordres/1?vue=cartes" | grep -q 'vue=liste&ouvert=1#lot1' \
  && ok "cliquer un produit ouvre sa liste de points, pas la liste de tous" \
  || ko "la carte d'un lot mène encore à la liste fermée"

# Choisir entre une seule chose n'est pas un choix : avec un seul ordre vivant,
# l'écran de sélection s'efface. Il reparaît dès qu'il y en a deux. Les tests
# précédents créent et annulent des ordres, donc on ne suppose pas l'état : on
# le lit, puis on vérifie la règle dans les deux sens.
VIVANTS=$(node --no-warnings -e "const{db}=require('./db.js');console.log(
  db.prepare(\"SELECT COUNT(*) n FROM ordres WHERE statut IN ('planifie','en_cours')\").get().n)" 2>/dev/null)
[ "$VIVANTS" -gt 1 ] \
  && { [ "$(curl -s -b $CA -o /dev/null -w '%{http_code}' $B/qualite/ordres)" = 200 ] \
       && ok "$VIVANTS ordres vivants : l'écran de sélection s'affiche" \
       || ko "le raccourci s'applique même quand il y a un choix à faire"; }
# On ne garde qu'un seul ordre vivant, le temps d'une requête.
node --no-warnings -e "require('./db.js').db.prepare(
  \"UPDATE ordres SET statut='termine' WHERE id <> 1\").run()" 2>/dev/null
[ "$(curl -s -b $CA -o /dev/null -w '%{redirect_url}' $B/qualite/ordres)" \
    = "$B/qualite/ordres/1" ] \
  && ok "un seul ordre vivant : on tombe dessus sans choisir" \
  || ko "l'écran de sélection s'affiche encore pour un ordre unique"

# Ouvert, le lot porte ses points et ses liens de procédé, qui s'ouvrent à côté
# sans faire perdre la page en cours.
curl -s -b $CA "$B/qualite/ordres/1?vue=liste&ouvert=1" | grep -q 'target="_blank"' \
  && ok "un lot ouvert donne ses procédés sans quitter le contrôle" \
  || ko "le lot ouvert n'a pas ses liens de procédé"

# Le garde-fou : pas de signature sans compte rendu. C'est la règle qui fait
# tenir tout le reste — un lot coché sans rien écrire ne prouve rien.
curl -s -b $CO -o /dev/null -w '%{redirect_url}' -X POST \
  $B/ordres/1/items/1/rapport --data 'texte=tout est beau' \
  | grep -q 'err=' \
  && ok "un compte rendu trop court ne signe pas le contrôle" \
  || ko "le contrôle s'est signé sans compte rendu"

# Le refus se lit DANS le formulaire, et le texte tapé y revient : affiché en
# haut de page, l'atelier ne le voyait pas et croyait à une panne.
R=$(curl -s -b $CO -o /dev/null -w '%{redirect_url}' -X POST \
  $B/ordres/1/items/1/rapport --data 'texte=tout est beau')
case "$R" in *brouillon=tout*'#signer1') ok "le refus ramène au formulaire avec le texte tapé" ;;
  *) ko "refus sans brouillon ni ancre ($R)" ;; esac
P=$(curl -s -b $CO "${R%%#*}")
echo "$P" | grep -q 'Pas signé : Le compte rendu fait 3 mots' \
  && echo "$P" | grep -q '>tout est beau</textarea>' \
  && ok "le formulaire dit pourquoi et garde le texte" \
  || ko "refus invisible ou texte perdu"

PQ=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT id FROM produits ORDER BY id LIMIT 1').get().id)" 2>/dev/null)

curl -s -b $CO -o /dev/null -X POST $B/qualite/$PQ \
  --data-urlencode 'titre=Presser le col avant d'"'"'insérer l'"'"'isolant' \
  --data-urlencode 'consequence=L'"'"'isolant fond et devient rigide' \
  --data 'type=critique'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_points').get().n)" 2>/dev/null)" = 1 ] \
  && ok "l'atelier écrit dans le protocole" || ko "l'atelier ne peut pas écrire"

P=$(curl -s -b $CA $B/qualite/$PQ)
echo "$P" | grep -q 'Points critiques' \
  && ok "le protocole rend ses quatre volets" || ko "volets absents"
echo "$P" | grep -q 'Sinon : ' \
  && ok "la conséquence s'affiche — c'est elle qui fait respecter la consigne" \
  || ko "conséquence absente"

# un volet inventé ne doit pas passer la contrainte CHECK
curl -s -b $CA -o /dev/null -X POST $B/qualite/$PQ \
  --data 'titre=Test&type=nimportequoi'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare(\"SELECT COUNT(*) n FROM qc_points WHERE type NOT IN ('critique','probleme','mesure','cyclage')\").get().n)" 2>/dev/null)" = 0 ] \
  && ok "un volet inventé retombe sur un volet valide" || ko "volet invalide écrit en base"

curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/qualite/$PQ \
  --data 'titre=  ' | grep -q 'err=' \
  && ok "un point sans titre est refusé" || ko "point vide accepté"

# la fiche produit rappelle les points critiques
curl -s -b $CA $B/produits/$PQ | grep -q 'Contrôle qualité' \
  && ok "la fiche produit rappelle le protocole" || ko "rappel absent de la fiche"

# on ne supprime pas le point d'un autre produit avec un id valide ailleurs
QID=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT id FROM qc_points ORDER BY id LIMIT 1').get().id)" 2>/dev/null)
AUTRE=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT id FROM produits ORDER BY id DESC LIMIT 1').get().id)" 2>/dev/null)
curl -s -b $CA -o /dev/null -X POST $B/qualite/$AUTRE/$QID/supprimer
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_points WHERE id=?').get($QID).n)" 2>/dev/null)" = 1 ] \
  && ok "un point ne se supprime pas depuis un autre produit" || ko "suppression croisée permise"

curl -s -b $CA -o /dev/null -X POST $B/qualite/$PQ/$QID/supprimer
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_points WHERE id=?').get($QID).n)" 2>/dev/null)" = 0 ] \
  && ok "un point se retire de son propre protocole" || ko "suppression impossible"

# --- protocole général et échantillonnage --------------------------------
# Ce qui s'applique à tous les produits ne doit pas se réécrire trente fois.
curl -s -b $CA -o /dev/null -X POST $B/qualite/general \
  --data-urlencode 'titre=Plier en trois, sachet kraft' \
  --data 'type=emballage&ech_type=ratio&ech_valeur=50'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_points WHERE produit_id IS NULL').get().n)" 2>/dev/null)" = 1 ] \
  && ok "un point général s'écrit sans produit" || ko "protocole général non créé"

curl -s -b $CA $B/qualite/general | grep -q 'Plier en trois' \
  && ok "le point général se lit sur la page des procédés généraux" \
  || ko "protocole général absent"

# il doit apparaître sur la checklist de N'IMPORTE quel lot
curl -s -b $CO $B/ordres/1/items/1/qualite | grep -q 'Plier en trois' \
  && ok "le général apparaît sur la checklist d'un lot" || ko "général absent de la checklist"

# et l'échantillon doit être un NOMBRE calculé sur le volume du lot, pas la règle
QTE=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT quantite q FROM ordre_items WHERE id=1').get().q)" 2>/dev/null)
ATTENDU=$(( (QTE + 49) / 50 ))
curl -s -b $CO $B/ordres/1/items/1/qualite | tr -d '\n' | grep -q "$ATTENDU pièce" \
  && ok "l'échantillon est calculé sur le volume du lot ($ATTENDU sur $QTE)" \
  || ko "échantillon non calculé (attendu $ATTENDU pièces sur $QTE)"

# « 1 sur… » sans le nombre ne veut rien dire : la règle à moitié n'est pas gardée
curl -s -b $CA -o /dev/null -X POST $B/qualite/general \
  --data 'titre=Sans nombre&type=emballage&ech_type=ratio'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare(\"SELECT ech_type FROM qc_points WHERE titre='Sans nombre'\").get().ech_type)" 2>/dev/null)" = "" ] \
  && ok "un ratio sans nombre ne s'enregistre pas à moitié" || ko "règle incomplète gardée"

# un point de produit ne se supprime pas par la route « général »
PP=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare(\"INSERT INTO qc_points (produit_id,type,titre) VALUES (1,'critique','Du produit')\").run().lastInsertRowid)" 2>/dev/null)
curl -s -b $CA -o /dev/null -X POST $B/qualite/general/$PP/supprimer
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_points WHERE id=?').get($PP).n)" 2>/dev/null)" = 1 ] \
  && ok "la route générale ne touche pas un point de produit" || ko "suppression croisée permise"

# Un point général vu depuis la fiche d'un produit ne s'y efface pas : il vaut
# pour tous les autres. La route l'annonçait pourtant comme retiré alors que
# son DELETE ne touchait rien — un message qui ment est pire qu'un bouton
# absent. Ce qu'on peut faire ici, c'est l'écarter de CE produit, avec un motif.
PT=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT id FROM produits LIMIT 1').get().id)" 2>/dev/null)
GEN=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT id FROM qc_points WHERE produit_id IS NULL ORDER BY id LIMIT 1').get().id)" 2>/dev/null)

curl -s -b $CA -o /dev/null -X POST $B/qualite/$PT/$GEN/supprimer
[ "$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM qc_points WHERE id=$GEN').get().n)" 2>/dev/null)" = 1 ] \
  && ok "un point général ne s'efface pas depuis la fiche d'un produit" \
  || ko "le protocole général a été amputé depuis un produit"

curl -s -b $CA -o /dev/null -X POST $B/qualite/$PT/$GEN/hors-sujet --data 'motif='
[ "$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM qc_hors_sujet').get().n)" 2>/dev/null)" = 0 ] \
  && ok "écarter sans motif est refusé" || ko "un point a été écarté sans motif"

curl -s -b $CA -o /dev/null -X POST $B/qualite/$PT/$GEN/hors-sujet \
  --data 'motif=Ce produit n%27a pas de fermeture'
[ "$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM qc_hors_sujet WHERE produit_id=$PT AND point_id=$GEN').get().n)" 2>/dev/null)" = 1 ] \
  && ok "un point général s'écarte d'un produit, avec son motif" \
  || ko "l'écart n'a pas été enregistré"

curl -s -b $CA -o /dev/null -X POST $B/qualite/$PT/$GEN/reprendre
[ "$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM qc_hors_sujet').get().n)" 2>/dev/null)" = 0 ] \
  && ok "un point écarté se remet au protocole" || ko "impossible de remettre le point"

MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
db.prepare('DELETE FROM qc_points').run();
db.prepare('DELETE FROM qc_controles').run();" 2>/dev/null

# --- ce qui casse : la preuve devient consigne ----------------------------
PB=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT produit_id FROM ordre_items WHERE id=1').get().produit_id)" 2>/dev/null)

curl -s -b $CO -o /dev/null -X POST $B/qualite/$PB/bris \
  --data-urlencode 'zone=Attache de ganse' \
  --data-urlencode 'texte=La ganse a lâché après trois semaines' \
  --data 'origine=client&survenu_le=2026-08-10'
curl -s -b $CO -o /dev/null -X POST $B/qualite/$PB/bris \
  --data-urlencode 'zone=attache de ganse' --data 'origine=atelier'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_bris').get().n)" 2>/dev/null)" = 2 ] \
  && ok "l'atelier signale un bris" || ko "signalement non enregistré"

curl -s -b $CA $B/qualite/$PB | grep -q 'La ganse a lâché' \
  && ok "le commentaire client est cité mot pour mot" || ko "commentaire absent"
curl -s -b $CA $B/qualite/$PB | grep -q 'sans consigne' \
  && ok "un bris sans consigne se voit comme tel" || ko "orphelin non signalé"

# une photo doit être une URL : jamais une image embarquée dans la base
curl -s -b $CA -o /dev/null -X POST $B/qualite/$PB/bris \
  --data 'zone=X' --data-urlencode 'photo_url=data:image/png;base64,iVBOR'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare(\"SELECT COUNT(*) n FROM qc_bris WHERE photo_url LIKE 'data:%'\").get().n)" 2>/dev/null)" = 0 ] \
  && ok "une photo en data: URI est refusée" || ko "data: URI enregistrée en base"

# tirer une consigne rattache tous les bris de la même zone
BID=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT id FROM qc_bris ORDER BY id LIMIT 1').get().id)" 2>/dev/null)
curl -s -b $CA -o /dev/null -X POST $B/qualite/$PB/bris/$BID/consigne \
  --data-urlencode "titre=Renforcer l'attache de ganse" --data 'type=probleme'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_bris WHERE point_id IS NULL').get().n)" 2>/dev/null)" = 0 ] \
  && ok "une consigne rattache tous les bris de la même zone" || ko "bris restés orphelins"

curl -s -b $CA $B/qualite/$PB | grep -q 'signalements sur le terrain' \
  && ok "le point affiche combien de signalements l'appuient" || ko "appuis non affichés"

curl -s -b $CA $B/qualite | grep -q '/retroactions' \
  && ok "la page Qualité renvoie aux rétroactions clients négatives" \
  || ko "la page Qualité ne mène nulle part côté retours clients"

curl -s -b $CA $B/qualite | grep -q 'Ce qui casse' \
  && ko "« Ce qui casse » traîne encore sur la page Qualité" \
  || ok "« Ce qui casse » a bien disparu de la page Qualité"

# un bris d'un autre produit ne se transforme pas en consigne ici
AUTRE=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT id FROM produits WHERE id != ? LIMIT 1').get($PB).id)" 2>/dev/null)
curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/qualite/$AUTRE/bris/$BID/supprimer \
  | grep -q 'err=' && ok "un bris ne se touche pas depuis un autre produit" \
  || ko "suppression croisée permise"

MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
db.prepare('DELETE FROM qc_bris').run();
db.prepare('DELETE FROM qc_points').run();" 2>/dev/null

# --- tableau de mensurations d'un coup ------------------------------------
# Un tableau de tailles se recopie d'un chiffrier ; le saisir taille par taille
# dans un formulaire, personne ne le fera deux fois.
PM=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT produit_id FROM ordre_items WHERE id=1').get().produit_id)" 2>/dev/null)
curl -s -b $CA -o /dev/null -X POST $B/qualite/$PM/mesures \
  --data-urlencode 'titre=Tour de poitrine' --data 'unite=cm&ech_type=ratio&ech_valeur=10' \
  --data-urlencode 'tableau=S = 104 ± 1,5
M = 112 ± 1,5
L = 120 ± 1,5
ligne illisible'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare(\"SELECT COUNT(*) n FROM qc_points WHERE titre='Tour de poitrine'\").get().n)" 2>/dev/null)" = 3 ] \
  && ok "un tableau crée une mesure par taille, et ignore l'illisible" \
  || ko "tableau de tailles mal lu"

curl -s -b $CA $B/qualite/$PM | grep -q 'mes-tbl' \
  && ok "les tailles d'une même cote se lisent en tableau" || ko "mesures non groupées"

# une taille absente du lot ne doit pas apparaître sur sa checklist
MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
db.prepare('DELETE FROM item_variantes WHERE item_id=1').run();
const v=db.prepare('INSERT INTO item_variantes (item_id,groupe,nom,quantite,rang) VALUES (1,?,?,?,?)');
v.run('','M',600,1); v.run('','L',400,2);" 2>/dev/null
CKM=$(curl -s -b $CO $B/ordres/1/items/1/qualite)
echo "$CKM" | grep -q 'ligne illisible' && ko "une ligne illisible est passée en base"
echo "$CKM" | tr -d '\n' | grep -qE '60 pièces sur 600' \
  && ok "une mesure de taille s'échantillonne sur les pièces de cette taille" \
  || ko "échantillon calculé sur le lot entier au lieu de la taille"
echo "$CKM" | grep -q '>S<' \
  && ko "une taille absente du lot est exigée quand même" \
  || ok "une taille absente du lot n'est pas exigée"

MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
db.prepare('DELETE FROM qc_points').run();
db.prepare('DELETE FROM item_variantes WHERE item_id=1').run();" 2>/dev/null

# --- la checklist obligatoire sur un ordre --------------------------------
# Un protocole qu'on peut ignorer n'est pas un protocole : le formulaire doit
# refuser le 100 % exactement comme l'assistant.
IT=1
PID=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT produit_id FROM ordre_items WHERE id=1').get().produit_id)" 2>/dev/null)
# On repart d'un protocole propre : les blocs précédents ont laissé des points
# sur ce produit, et un test qui dépend de ce qui a tourné avant ne prouve rien.
MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
db.prepare('DELETE FROM qc_controles').run();
db.prepare('DELETE FROM qc_points WHERE produit_id = ?').run($PID);
db.prepare(\"INSERT INTO qc_points (produit_id,type,titre,consequence) VALUES (?,'critique',?,?)\")
  .run($PID,'Presser avant l\'isolant','Il fond');
db.prepare('UPDATE ordre_items SET avancement = 40 WHERE id = 1').run();" 2>/dev/null

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/$IT/avancement --data 'valeur=100'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT avancement a FROM ordre_items WHERE id=1').get().a)" 2>/dev/null)" != 100 ] \
  && ok "le formulaire refuse 100 % tant que le contrôle n'est pas passé" \
  || ko "100 % accepté sans contrôle qualité"

# et il renvoie vers la checklist plutôt que de refuser en silence
curl -s -b $CO -o /dev/null -w '%{redirect_url}' -X POST $B/ordres/1/items/$IT/avancement \
  --data 'valeur=100' | grep -q 'qualite' \
  && ok "le refus mène à la checklist du lot" || ko "refus muet"

CK=$(curl -s -b $CO $B/ordres/1/items/$IT/qualite)
echo "$CK" | grep -q 'Presser avant' \
  && ok "la checklist du lot montre le protocole du produit" || ko "checklist vide"
# « 2 points à vérifier » ne contient pas « point à vérifier » : le pluriel
# doit être dans le motif, sinon le test ment selon le nombre de points.
echo "$CK" | grep -qE 'points? à vérifier' \
  && ok "le bilan dit combien de points restent" || ko "bilan absent"

QP=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT id FROM qc_points ORDER BY id DESC LIMIT 1').get().id)" 2>/dev/null)

# un point d'un AUTRE produit ne doit pas pouvoir être coché sur ce lot
AUTREP=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
const p=db.prepare('SELECT id FROM produits WHERE id != ? LIMIT 1').get($PID);
console.log(db.prepare(\"INSERT INTO qc_points (produit_id,type,titre) VALUES (?,'critique','Ailleurs')\")
  .run(p.id).lastInsertRowid);" 2>/dev/null)
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/$IT/qualite/$AUTREP --data 'verdict=conforme'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_controles').get().n)" 2>/dev/null)" = 0 ] \
  && ok "un point d'un autre produit ne se coche pas sur ce lot" || ko "contrôle croisé accepté"

# l'atelier coche : c'est lui qui a les pièces en main
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/$IT/qualite/$QP \
  --data 'verdict=non_conforme' --data-urlencode 'note=Deux pièces rigides sur vingt'
curl -s -b $CO $B/ordres/1/items/$IT/qualite | grep -q 'non conforme' \
  && ok "l'atelier relève une non-conformité" || ko "non-conformité non enregistrée"

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/$IT/avancement --data 'valeur=100'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT avancement a FROM ordre_items WHERE id=1').get().a)" 2>/dev/null)" != 100 ] \
  && ok "une non-conformité bloque le 100 %" || ko "lot fini malgré un écart"

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/$IT/qualite/$QP --data 'verdict=conforme'
curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/$IT/avancement --data 'valeur=100'
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT avancement a FROM ordre_items WHERE id=1').get().a)" 2>/dev/null)" = 100 ] \
  && ok "écart corrigé, le lot se déclare fini" || ko "lot bloqué après correction"

# le journal garde les deux verdicts
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM qc_controles').get().n)" 2>/dev/null)" = 2 ] \
  && ok "la non-conformité corrigée reste au journal" || ko "historique écrasé"

# l'état se voit sur la page de l'ordre, à côté du sélecteur
curl -s -b $CA $B/ordres/1 | grep -q 'ck-etiq' \
  && ok "l'ordre affiche l'état qualité de chaque lot" || ko "état qualité absent de l'ordre"

# Ce bloc a mené l'item 1 à 100 %, ce qui le sort d'« À fabriquer ». On remet
# l'état d'avant : un test qui casse le suivant ne teste plus rien.
MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
db.prepare('UPDATE ordre_items SET avancement = 70 WHERE id = 1').run();
db.prepare('DELETE FROM qc_controles').run();
db.prepare('DELETE FROM qc_points').run();" 2>/dev/null

# --- tâches : ce qu'on se demande d'un bord à l'autre ---------------------
# Le seul module sans hiérarchie : l'atelier assigne à Québec comme l'inverse.
curl -s -b $CO -o /dev/null -X POST $B/taches \
  --data-urlencode 'titre=Confirmer la quantité de bandeaux' \
  --data "assigne_a=$(MRP_DB="$DB" node --no-warnings -e "
    const{db}=require('./db.js');
    console.log(db.prepare(\"SELECT id FROM utilisateurs WHERE courriel='a@test.com'\").get().id)" 2>/dev/null)"
N=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM taches').get().n)" 2>/dev/null)
[ "$N" = 1 ] && ok "l'atelier peut demander quelque chose à Québec" \
  || ko "tâche non créée par l'atelier ($N)"

curl -s -b $CA $B/taches | grep -q 'Confirmer la quantité de bandeaux' \
  && ok "Québec voit ce que l'atelier lui a demandé" || ko "tâche invisible côté Québec"

# la pastille du menu : une tâche qui attend doit se voir depuis n'importe où
curl -s -b $CA $B/produits | grep -q 'class="pastille' \
  && ok "la pastille suit sur toutes les pages" || ko "pastille absente hors de /taches"

# un destinataire inventé créerait une tâche que personne ne voit
curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/taches \
  --data 'titre=X&assigne_a=99999' | grep -q 'err=' \
  && ok "un destinataire inexistant est refusé" || ko "tâche assignée dans le vide"
curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/taches \
  --data 'titre=   ' | grep -q 'err=' \
  && ok "une tâche sans titre est refusée" || ko "tâche vide acceptée"

TK=$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT id FROM taches ORDER BY id DESC LIMIT 1').get().id)" 2>/dev/null)

# seul le demandeur retire sa demande : le porteur la termine, il ne l'efface pas
curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/taches/$TK/supprimer \
  | grep -q 'err=' && ok "le porteur ne peut pas supprimer ce qu'on lui demande" \
  || ko "suppression permise au porteur"

curl -s -b $CA -o /dev/null -X POST $B/taches/$TK/faite
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT statut FROM taches WHERE id=?').get($TK).statut)" 2>/dev/null)" = faite ] \
  && ok "le porteur marque sa tâche faite" || ko "tâche non terminée"

curl -s -b $CA -o /dev/null -X POST $B/taches/$TK/rouvrir
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT statut FROM taches WHERE id=?').get($TK).statut)" 2>/dev/null)" = a_faire ] \
  && ok "une tâche se rouvre" || ko "réouverture impossible"

# et le demandeur, lui, peut la retirer
curl -s -b $CO -o /dev/null -X POST $B/taches/$TK/supprimer
[ "$(MRP_DB="$DB" node --no-warnings -e "
const{db}=require('./db.js');
console.log(db.prepare('SELECT COUNT(*) n FROM taches').get().n)" 2>/dev/null)" = 0 ] \
  && ok "le demandeur retire sa demande" || ko "suppression refusée au demandeur"

# --- l'assistant sur l'accueil ------------------------------------------
# C'est la première chose qu'on voit en arrivant : la saisie doit être là, et
# elle doit ramener où on était, sans devenir une redirection ouverte.
A=$(curl -s -b $CA $B/)
echo "$A" | grep -q 'id="ia-form"' \
  && ok "l'accueil porte la saisie de l'assistant" || ko "assistant absent de l'accueil"
echo "$A" | grep -q 'action="/assistant"' \
  && ok "la saisie de l'accueil poste vers l'assistant" || ko "formulaire mal câblé"
echo "$A" | grep -q 'name="retour" value="/"' \
  && ok "la saisie de l'accueil demande le retour à l'accueil" || ko "retour absent"

# la salutation : le prénom, et une formule qui correspond à l'heure de CELUI
# qui lit — pas à celle du serveur.
echo "$A" | grep -qE '(Bon matin|Bon après-midi|Bonsoir|Bonne nuit) Admin' \
  && ok "l'accueil salue par son prénom" || ko "pas de salutation"

# l'atelier aussi : c'est lui qui déclare, et il n'a pas de clavier confortable
curl -s -b $CO $B/ | grep -q 'id="ia-form"' \
  && ok "l'atelier a l'assistant sur son accueil" || ko "assistant absent pour l'atelier"

# l'accueil doit REPRENDRE le fil en cours, pas en ouvrir un neuf à chaque
# affichage — sinon « et les mitaines ? » perd son antécédent.
MRP_DB="$DB" node --no-warnings -e "
const {db}=require('./db.js'); const A=require('./assistant.js');
const u=db.prepare('SELECT id FROM utilisateurs LIMIT 1').get().id;
db.prepare('DELETE FROM agent_tours').run();
if(A.dernierFil(u)!==null){console.error('fil fantôme');process.exit(1)}
db.prepare(\"INSERT INTO agent_tours (utilisateur_id,fil,demande,reponse) VALUES (?,?,?,?)\")
  .run(u,'aaaaaaaaaaaaaaaaaa','q','r');
if(A.dernierFil(u)!=='aaaaaaaaaaaaaaaaaa'){console.error('mauvais fil');process.exit(1)}
if(A.dernierTour(u,'aaaaaaaaaaaaaaaaaa').demande!=='q'){console.error('mauvais tour');process.exit(1)}
" 2>&1 && ok "l'accueil reprend le dernier fil au lieu d'en ouvrir un" \
  || ko "le fil n'est pas repris"

# le dernier échange s'affiche sur l'accueil, avec ce qui a été écrit
MRP_DB="$DB" node --no-warnings -e "
const {db}=require('./db.js');
const t=db.prepare('SELECT id FROM agent_tours ORDER BY id DESC LIMIT 1').get().id;
db.prepare(\"INSERT INTO agent_actions (tour_id,outil,resume,defaire,defait) VALUES (?,?,?,?,0)\")
  .run(t,'maj_avancement','CACHE-COU : 0 % vers 30 %','{}');" 2>/dev/null
curl -s -b $CA $B/ | grep -q 'CACHE-COU : 0 % vers 30 %' \
  && ok "l'accueil montre ce que l'assistant a écrit" || ko "actions absentes de l'accueil"

# un « retour » libre serait une redirection ouverte : seul « / » est accepté
R=$(curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/assistant \
  --data 'demande=test&fil=aaaaaaaaaaaaaaaaaa&retour=https://exemple.invalide/vol')
case "$R" in
  *exemple.invalide*) ko "redirection ouverte : $R" ;;
  *) ok "un retour hors liste blanche est ignoré" ;;
esac

# et le retour légitime ramène bien à l'accueil
TID=$(MRP_DB="$DB" node --no-warnings -e "
const {db}=require('./db.js');
console.log(db.prepare('SELECT id FROM agent_tours ORDER BY id DESC LIMIT 1').get().id);" 2>/dev/null)
R=$(curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/assistant/$TID/annuler \
  --data 'retour=/')
case "$R" in
  */assistant*) ko "l'annulation depuis l'accueil renvoie vers /assistant ($R)" ;;
  *) ok "annuler depuis l'accueil ramène à l'accueil" ;;
esac

# --- changer son mot de passe -------------------------------------------
# Un mot de passe transmis par message doit pouvoir être changé par celui qui
# le reçoit, et l'atelier n'a pas de shell.
CO2=$(mktemp)
curl -s -c $CO2 -o /dev/null -X POST $B/connexion --data 'courriel=o@test.com&mdp=motdepasse2'

curl -s -b $CO2 $B/compte | grep -q 'Changer mon mot de passe' \
  && ok "l'atelier a une page de compte" || ko "page de compte absente"

# mauvais mot de passe actuel : refusé
curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST $B/compte \
  --data 'ancien=pasbon&nouveau=nouveaumdp1&nouveau2=nouveaumdp1' | grep -q 'err=' \
  && ok "mot de passe actuel erroné refusé" || ko "mot de passe erroné accepté"

# les deux nouveaux diffèrent : refusé
curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST $B/compte \
  --data 'ancien=motdepasse2&nouveau=nouveaumdp1&nouveau2=autrechose9' | grep -q 'err=' \
  && ok "confirmation qui diffère refusée" || ko "confirmation divergente acceptée"

# trop court : refusé
curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST $B/compte \
  --data 'ancien=motdepasse2&nouveau=court&nouveau2=court' | grep -q 'err=' \
  && ok "nouveau mot de passe trop court refusé" || ko "mot de passe court accepté"

# une deuxième session du même utilisateur, ouverte AVANT le changement
CO3=$(mktemp)
curl -s -c $CO3 -o /dev/null -X POST $B/connexion --data 'courriel=o@test.com&mdp=motdepasse2'
[ "$(curl -s -o /dev/null -w '%{http_code}' -b $CO3 $B/priorites)" = 200 ] \
  && ok "la deuxième session est ouverte" || ko "deuxième session non ouverte"

# le vrai changement
curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST $B/compte \
  --data 'ancien=motdepasse2&nouveau=nouveaumdp1&nouveau2=nouveaumdp1' | grep -q 'ok=' \
  && ok "mot de passe changé" || ko "changement refusé"

# l'ancien ne marche plus, le nouveau oui
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/connexion \
     --data 'courriel=o@test.com&mdp=motdepasse2')" = 401 ] \
  && ok "l'ancien mot de passe ne fonctionne plus" || ko "ancien mot de passe encore valide"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/connexion \
     --data 'courriel=o@test.com&mdp=nouveaumdp1')" = 303 ] \
  && ok "le nouveau mot de passe fonctionne" || ko "nouveau mot de passe refusé"

# la session qui a fait le changement reste ouverte...
[ "$(curl -s -o /dev/null -w '%{http_code}' -b $CO2 $B/priorites)" = 200 ] \
  && ok "la session courante survit au changement" || ko "on s'est déconnecté soi-même"
# ...mais les autres sont fermées
[ "$(curl -s -o /dev/null -w '%{http_code}' -b $CO3 $B/priorites)" = 303 ] \
  && ok "les sessions ouvertes ailleurs sont fermées" \
  || ko "une session ouverte avec l'ancien mot de passe survit"

# --- la répartition par taille et coloris se voit --------------------------
# « 2 000 mitaines » ne dit pas quoi couper : la liste de fabrication doit
# porter la répartition, et la barre doit être proportionnelle.
node --no-warnings mrp.js demo >/dev/null 2>&1 || true
IT=$(MRP_DB="$DB" node --no-warnings -e "
const {db}=require('./db.js');
const it=db.prepare('SELECT id FROM ordre_items ORDER BY id LIMIT 1').get();
const p=db.prepare('INSERT INTO item_variantes (item_id,groupe,nom,quantite,rang) VALUES (?,?,?,?,?)');
p.run(it.id,'','Noir',60,1); p.run(it.id,'','Gris pale',40,2);
console.log(it.id);")
curl -s -b $CA "$B/priorites" | grep -q 'class="rep' \
  && ok "la liste de fabrication porte la répartition" || ko "répartition absente d'À fabriquer"
curl -s -b $CA "$B/priorites" | grep -q 'background:#1c1f22' \
  && ok "un coloris porte sa vraie teinte" || ko "pastille de couleur absente"
curl -s -b $CA "$B/priorites" | grep -q 'rep-quoi' \
  && ok "les compteurs sont repliés derrière un résumé" || ko "pas de repli"
curl -s -b $CA "$B/ordres/1" | grep -q 'Gris pale' \
  && ok "l'ordre montre le détail déplié" || ko "détail absent de l'ordre"
MRP_DB="$DB" node --no-warnings -e "
require('./db.js').db.prepare('DELETE FROM item_variantes').run();"

# --- cédule : le verdict, le Gantt et la capacité ------------------------
# Le graphique n'est pas la réponse : la question est « est-ce que ça rentre ».
# Le verdict doit être là avant le dessin, et la capacité doit rester un
# réglage de Québec — l'atelier la lit, il ne la pose pas.
CE=$(curl -s -b $CA $B/cedule)
echo "$CE" | grep -q 'heures de travail' \
  && ok "cédule : le verdict chiffre la charge" || ko "cédule : verdict absent"
echo "$CE" | grep -qE 'Ça (ne rentre pas|rentre)' \
  && ok "cédule : le verdict tranche" || ko "cédule : pas de verdict tranché"
echo "$CE" | grep -q 'g-barre' \
  && ok "cédule : le Gantt a des barres" || ko "cédule : aucune barre"
echo "$CE" | grep -q 'g-jalon' \
  && ok "cédule : l'échéance est tracée sur le Gantt" || ko "cédule : jalon absent du Gantt"
# chaque ligne dit d'où vient son temps : mesuré ou déduit
echo "$CE" | grep -qE 'g-src-(chrono|cout)' \
  && ok "cédule : chaque ligne dit d'où vient son temps" || ko "cédule : source du temps cachée"

echo "$CE" | grep -q 'action="/cedule/capacite"' \
  && ok "l'administration règle la capacité" || ko "formulaire de capacité absent pour l'admin"
curl -s -b $CO2 $B/cedule | grep -q 'action="/cedule/capacite"' \
  && ko "l'atelier peut régler la capacité" || ok "l'atelier ne règle pas la capacité"

# une capacité hors bornes ne doit pas s'enregistrer
curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/cedule/capacite \
  --data 'postes=0&heures_jour=8&jours_semaine=5' | grep -q 'err=' \
  && ok "capacité hors bornes refusée" || ko "capacité à 0 poste acceptée"

curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/cedule/capacite \
  --data 'postes=12&heures_jour=9&jours_semaine=6' | grep -q 'ok=' \
  && ok "capacité enregistrée" || ko "capacité valide refusée"
# le champ tient sur deux lignes dans le gabarit : on aplatit avant de chercher
curl -s -b $CA $B/cedule | tr -d '\n' | grep -q 'name="postes"[^>]*value="12"' \
  && ok "la capacité posée est reprise dans le formulaire" || ko "capacité non répercutée"

# et elle change vraiment les dates : plus de postes, fin plus tôt
MRP_DB="$DB" node --no-warnings -e "
const C=require('./charge.js'), {listeFabrication}=require('./db.js');
const l=listeFabrication();
const a=C.calendrier(l,{depart:'2026-09-01',cap:{postes:4,heures_jour:8,jours_semaine:5}});
const b=C.calendrier(l,{depart:'2026-09-01',cap:{postes:40,heures_jour:8,jours_semaine:5}});
if(!(b.fin<a.fin)){console.error(a.fin+' → '+b.fin);process.exit(1)}
if(Math.round(a.heuresTotal)!==Math.round(b.heuresTotal)){console.error('charge instable');process.exit(1)}
" 2>/dev/null && ok "plus de postes = fin plus tôt, charge inchangée" \
  || ko "la capacité ne déplace pas les dates"

# l'atelier voit quand même la cédule : c'est lui qui la subit
curl -s -b $CO2 $B/cedule | grep -q 'Charge de l' \
  && ok "l'atelier voit la charge" || ko "cédule refusée à l'atelier"

# --- périmètre : ce que l'atelier fait -----------------------------------
# L'écart entre « assemblage seul » et « préparation + assemblage » dépasse le
# simple au double. Choisir en silence serait pire que de ne rien afficher.
curl -s -b $CA $B/cedule | grep -q 'action="/cedule/perimetre"' \
  && ok "l'administration règle le périmètre" || ko "formulaire de périmètre absent"
curl -s -b $CO2 $B/cedule | grep -q 'action="/cedule/perimetre"' \
  && ko "l'atelier peut régler le périmètre" || ok "l'atelier ne règle pas le périmètre"

curl -s -b $CA -o /dev/null -w '%{redirect_url}' -X POST $B/cedule/perimetre \
  --data 'perimetre=nimporte-quoi' | grep -q 'err=' \
  && ok "périmètre inconnu refusé" || ko "périmètre inconnu accepté"

# et il doit vraiment changer la charge, dans le bon sens. Le jeu de démo porte
# des codes inventés qu'aucune source de temps ne connaît : on prend de vrais
# codes du plan, sinon les trois périmètres valent zéro et le test passe à vide.
MRP_DB="$DB" node --no-warnings -e "
const C=require('./charge.js');
const l=[{code:'CACHE-COU',restant:100,produit_id:1},
         {code:'MIT-PLEIN-AIR',restant:100,produit_id:2}];
const h=(p)=>C.calendrier(l,{perim:p,cap:{postes:4,heures_jour:8,jours_semaine:5}}).heuresTotal;
const tout=h('tout'), asm=h('assemblage'), prep=h('preparation');
if(!(tout>asm&&tout>prep)){console.error(tout+' / '+asm+' / '+prep);process.exit(1)}
" 2>/dev/null && ok "le périmètre change la charge, et « tout » est le plus lourd" \
  || ko "le périmètre n'a pas d'effet"

# --- toutes les étapes du VRAI plan sont chiffrées -----------------------
# Un item à zéro heure est le seul chiffre dont on soit sûr qu'il est faux.
# Ça ne se vérifie que sur le plan importé : c'est lui qu'on planifie.
REEL=$(mktemp -d)/reel.db
MRP_DB="$REEL" node --no-warnings import.js --ecrire >/dev/null 2>&1
MRP_DB="$REEL" node --no-warnings -e "
const C=require('./charge.js'), {listeFabrication}=require('./db.js');
const cal=C.calendrier(listeFabrication());
if(!cal.taches.length){console.error('plan vide');process.exit(1)}
const zero=cal.taches.filter(t=>t.temps.source==='aucune').map(t=>t.code);
if(zero.length){console.error('sans temps : '+zero.join(', '));process.exit(1)}
" 2>&1 && ok "aucun item du plan réel ne compte pour zéro heure" \
  || ko "des items du plan réel comptent encore pour zéro heure"

# une estimation à la main ne doit jamais se faire passer pour un prix facturé
MRP_DB="$REEL" node --no-warnings -e "
const V=require('./vues.js'), C=require('./charge.js');
const {listeFabrication}=require('./db.js');
const h=V.vueCedule({user:{id:1,role:'admin',nom:'A'},jalons:[],msg:{},
  cal:C.calendrier(listeFabrication())});
for(const x of ['g-src-bmb','g-src-estime','g-src-deux'])
  if(!h.includes(x)){console.error('pastille absente : '+x);process.exit(1)}
" 2>&1 && ok "chaque ligne affiche la provenance de son temps" \
  || ko "provenance absente du Gantt"

# le verdict doit avoir trois états, et la couleur doit dire la même chose que
# la phrase : une bordure verte au-dessus de « la marge ne tient pas » ment.
curl -s -b $CA -o /dev/null -X POST $B/cedule/capacite \
  --data 'postes=1&heures_jour=1&jours_semaine=1'
curl -s -b $CA $B/cedule | grep -q 'verdict-non' \
  && ok "capacité dérisoire : verdict rouge" || ko "verdict non rouge alors que ça déborde"

curl -s -b $CA -o /dev/null -X POST $B/cedule/capacite \
  --data 'postes=200&heures_jour=24&jours_semaine=7'
curl -s -b $CA $B/cedule | grep -q 'verdict-oui' \
  && ok "capacité démesurée : verdict vert" || ko "verdict non vert alors que ça rentre large"

# l'état du milieu — « ça rentre, mais la marge est plus petite que ce qui n'est
# pas compté » — est celui qui compte le plus et qu'aucune capacité ronde ne
# produit sur le jeu de démo : on le monte à la main.
MRP_DB="$DB" node --no-warnings -e "
const V=require('./vues.js');
const user={id:1,role:'admin',nom:'A'};
const auj=new Date().toISOString().slice(0,10);
const dans=(n)=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
const jalons=[{date:dans(20),titre:'Expédition',type:'expedition',ordre_id:1,numero:'OP',ordre_titre:'T'}];
// 1 h de travail chiffré, et 1 000 pièces sans temps : la marge est énorme en
// heures, dérisoire au regard de ce qui n'est pas compté.
const cal={cap:{postes:1,heures_jour:8,jours_semaine:5,defaut:false},
  heuresTotal:1,sansTemps:1,debut:auj,fin:auj,
  taches:[{code:'A',produit_id:1,restant:1,heures:1,debut:auj,fin:auj,
           temps:{secondes:3600,source:'chrono'}},
          {code:'B',produit_id:2,restant:1000,heures:0,debut:auj,fin:auj,
           temps:{secondes:0,source:'aucune'}}]};
// le gabarit coupe ses phrases sur plusieurs lignes : le navigateur ramasse
// les blancs, le test doit faire pareil avant de chercher une phrase.
const h=V.vueCedule({user,jalons,msg:{},cal}).replace(/\s+/g,' ');
const veut=['verdict-fragile','Ça rentre sur le papier','ne tient probablement pas'];
for(const x of veut) if(!h.includes(x)){console.error('manque : '+x);process.exit(1)}
if(h.includes('verdict-oui')){console.error('vert ET fragile');process.exit(1)}
" 2>&1 && ok "marge plus petite que l'inconnu : verdict ambre, pas vert" \
  || ko "l'état « ça rentre sur le papier » ne se déclenche pas"

# la fourchette des items non chiffrés doit être un nombre, pas un avertissement
curl -s -b $CA $B/cedule | grep -q 'heures</b> de plus' \
  && ok "les items sans temps sont chiffrés en fourchette" \
  || ko "les items sans temps ne sont pas chiffrés"

curl -s -b $CA -o /dev/null -X POST $B/cedule/capacite \
  --data 'postes=20&heures_jour=8&jours_semaine=5'

# --- changer son nom affiché --------------------------------------------
# C'est lui qui signe les mises à jour dans le suivi : l'amorce crée le premier
# compte au nom d'« Administration », qui n'apprend rien à personne.
curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST $B/compte/nom \
  --data 'nom=Montassar B.' | grep -q 'ok=' \
  && ok "le nom affiché se change" || ko "changement de nom refusé"
curl -s -b $CO2 $B/compte | grep -q 'value="Montassar B."' \
  && ok "le nouveau nom est affiché" || ko "nom non répercuté"
curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST $B/compte/nom \
  --data 'nom=X' | grep -q 'err=' \
  && ok "un nom d'un seul caractère est refusé" || ko "nom trop court accepté"

# --- comparaison avec la boutique : les vraies photos, sur la planche -----
# Le dessin générique montrait une mitaine même pour un cache-cou, et les
# vraies photos étaient trois clics plus loin, dans Produits. La planche du
# point, ouverte depuis un lot, doit montrer les photos de CE produit, et le
# verdict doit s'y donner sans retourner à la liste. ($CO2 : la session de
# $CO est tombée au changement de mot de passe.)
PB=$(node --no-warnings -e "
  const{db}=require('./db.js');
  const it=db.prepare('SELECT produit_id FROM ordre_items WHERE id=1').get();
  db.prepare(\"INSERT INTO produit_photos (produit_id,url,type,legende) VALUES (?,?,'studio','face')\")
    .run(it.produit_id,'https://cdn.shopify.com/s/files/test/vraie-photo-e2e.jpg');
  console.log(db.prepare(\"INSERT INTO qc_points (produit_id,type,titre) VALUES (NULL,'esthetique','Comparaison avec la photo de la boutique')\").run().lastInsertRowid);" 2>/dev/null)
PL=$(curl -s -b $CO2 "$B/qualite/planche/photo_boutique?point=$PB&item=1&retour=%2Fordres%2F1%2Fitems%2F1%2Fqualite")
echo "$PL" | grep -q 'vraie-photo-e2e' \
  && ok "la planche de la boutique montre les vraies photos du produit du lot" \
  || ko "la planche de la boutique ne montre pas les photos du produit"
echo "$PL" | grep -q "action=\"/ordres/1/items/1/qualite/$PB\"" \
  && ok "la planche ouverte depuis un lot porte Conforme / Non conforme" \
  || ko "pas de verdict sur la planche"
R=$(curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST "$B/ordres/1/items/1/qualite/$PB" \
  --data-urlencode 'verdict=conforme' \
  --data-urlencode "retour_url=/qualite/planche/photo_boutique?point=$PB&item=1&retour=%2Fordres%2F1%2Fitems%2F1%2Fqualite")
case "$R" in */qualite/planche/photo_boutique\?point=$PB*ok=*) ok "le verdict ramène à la planche" ;;
  *) ko "le verdict ne ramène pas à la planche ($R)" ;; esac
curl -s -b $CO2 "$B/qualite/planche/photo_boutique?point=$PB&item=1" | grep -q 'Dernier verdict : <b class="ok">conforme' \
  && ok "la planche affiche le dernier verdict du lot" || ko "dernier verdict absent de la planche"
R=$(curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST "$B/ordres/1/items/1/qualite/$PB" \
  --data-urlencode 'verdict=conforme' --data-urlencode 'retour_url=https://ailleurs.example/x')
case "$R" in *ailleurs.example*) ko "retour_url extérieur suivi" ;; *) ok "un retour hors de la planche est ignoré" ;; esac
curl -s -b $CO2 "$B/qualite/planche/photo_boutique?point=$PB" | grep -q 'vraie-photo-e2e' \
  && ko "des photos sans produit en contexte" || ok "sans lot ni produit, la planche garde son dessin"

# --- discussion d'un point ------------------------------------------------
# Québec et l'atelier s'écrivent sous le point ; « ce n'est pas la bonne
# image » reste visible tant que personne ne l'a réglé.
R=$(curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST "$B/qualite/points/$PB/discussion" \
  -F type=image -F 'texte=Ce n est pas la bonne image' -F item=1 -F "retour=/ordres/1/items/1/qualite")
case "$R" in *err=*) ko "message refusé ($R)" ;; *) ok "l'atelier écrit sous un point" ;; esac
curl -s -b $CA "$B/qualite/planche/photo_boutique?point=$PB&item=1" | grep -q 'Ce n est pas la bonne image' \
  && ok "le message reste visible sur la planche, pour Québec" || ko "message invisible sur la planche"
# « Prendre une photo » : le champ `camera` ouvre l'appareil de l'iPad
# (capture="environment") ; sa photo doit être gardée comme l'autre.
curl -s -b $CO2 "$B/qualite/planche/photo_boutique?point=$PB&item=1" \
  | grep -q 'name="camera" accept="image/\*" capture="environment"' \
  && ok "le message offre « Prendre une photo » (appareil de la tablette)" \
  || ko "pas de prise de photo directe"
IMG=$(mktemp).png
node -e "require('fs').writeFileSync('$IMG', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'))"
curl -s -b $CO2 -o /dev/null -X POST "$B/qualite/points/$PB/discussion" \
  -F type=note -F 'texte=Vue de la couture' -F "camera=@$IMG;type=image/png" -F "retour=/ordres/1/items/1/qualite"
F=$(node --no-warnings -e "const{db}=require('./db.js');const r=db.prepare(\"SELECT photo_fichier f FROM qc_discussion WHERE texte='Vue de la couture'\").get();console.log(r?r.f:'')" 2>/dev/null)
[ -n "$F" ] && [ "$(curl -s -b $CA -o /dev/null -w '%{http_code}' "$B/qc-photo/$F")" = 200 ] \
  && ok "la photo prise à l'appareil est gardée et servie" || ko "photo de l'appareil perdue ($F)"
R=$(curl -s -b $CO2 -o /dev/null -w '%{redirect_url}' -X POST "$B/qualite/points/$PB/discussion" \
  -F type=note -F 'texte=' -F "retour=/ordres/1/items/1/qualite")
case "$R" in *err=*) ok "un message vide est refusé" ;; *) ko "message vide accepté" ;; esac

# --- amorce du premier compte -------------------------------------------
# Un service fraîchement déployé n'a aucun utilisateur : sans amorce, personne
# ne peut ouvrir de session, et sans shell c'est irrécupérable. L'amorce doit
# créer ce compte UNE fois, et ne jamais toucher à une base déjà peuplée.
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null || true
NEUVE=$(mktemp -d)/neuve.db
MRP_DB="$NEUVE" MRP_ADMIN_COURRIEL=chef@test.com MRP_ADMIN_MDP=motdepasse9 \
  PORT=$((PORT+1)) MRP_SANS_AMORCE=1 MRP_SANS_RAPPELS=1 node --no-warnings server.js >/dev/null 2>&1 & SRV=$!
sleep 1.5
[ "$(MRP_DB="$NEUVE" node --no-warnings mrp.js utilisateur:liste | grep -c 'chef@test.com .*Admin QC')" = 1 ] \
  && ok "amorce : le premier compte est créé sur une base neuve" \
  || ko "amorce : premier compte absent"
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null || true

# relance avec d'autres identifiants : la base n'est plus vide, rien ne bouge
MRP_DB="$NEUVE" MRP_ADMIN_COURRIEL=intrus@test.com MRP_ADMIN_MDP=motdepasse9 \
  PORT=$((PORT+1)) MRP_SANS_AMORCE=1 MRP_SANS_RAPPELS=1 node --no-warnings server.js >/dev/null 2>&1 & SRV=$!
sleep 1.5
[ "$(MRP_DB="$NEUVE" node --no-warnings mrp.js utilisateur:liste | grep -c intrus)" = 0 ] \
  && ok "amorce : sans effet sur une base déjà peuplée" \
  || ko "amorce : un second compte a été créé"
[ "$(MRP_DB="$NEUVE" node --no-warnings mrp.js utilisateur:liste | grep -c .)" = 1 ] \
  && ok "amorce : un seul compte au total" || ko "amorce : plus d'un compte"
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null || true

# mot de passe trop court : refusé, et le service démarre quand même
COURT=$(mktemp -d)/court.db
MRP_DB="$COURT" MRP_ADMIN_COURRIEL=x@test.com MRP_ADMIN_MDP=court \
  PORT=$((PORT+2)) MRP_SANS_AMORCE=1 MRP_SANS_RAPPELS=1 node --no-warnings server.js >/dev/null 2>&1 & SRV=$!
sleep 1.5
[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$((PORT+2))/sante)" = 200 ] \
  && [ "$(MRP_DB="$COURT" node --no-warnings mrp.js utilisateur:liste | grep -c .)" = 0 ] \
  && ok "amorce : mot de passe trop court refusé, le service démarre quand même" \
  || ko "amorce : mot de passe court accepté ou service en panne"

# --- le catalogue suit le dépôt ------------------------------------------
# Le catalogue ne se recharge pas à chaque démarrage — il écraserait ce que
# quelqu'un aurait corrigé dans l'app. Mais tant que le seul déclencheur était
# « la base est vide », une quantité ajoutée au plan dans le dépôt n'arrivait
# jamais en production. C'est l'empreinte des fichiers qui tranche.
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null || true
CAT=$(mktemp -d)/cat.db
# La sortie est lue EN ENTIER avant d'y chercher : l'amorce est asynchrone, et
# « grep -q » qui ferme le tuyau au premier résultat pouvait couper le
# processus avant qu'il ait posé l'empreinte.
A(){ MRP_DB="$CAT" node --no-warnings -e "require('./amorce.js').amorcerDonnees()" > "$CAT.log" 2>&1; cat "$CAT.log"; }

A | grep -q 'catalogue : chargé (base vide)' \
  && ok "amorce : le catalogue se charge sur une base vide" \
  || ko "amorce : catalogue absent au premier démarrage"

A | grep -q 'catalogue : inchangé' \
  && ok "amorce : redémarrer ne recharge pas le catalogue" \
  || ko "amorce : catalogue rechargé sans raison"

# On fait mentir l'empreinte enregistrée : c'est exactement l'état où un TSV a
# été modifié dans le dépôt depuis le dernier chargement.
MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  db.prepare(\"UPDATE amorce_etat SET valeur='périmé' WHERE cle='empreinte_donnees'\").run();
" 2>/dev/null
A | grep -q 'catalogue : chargé (les fichiers de donnees/ ont changé)' \
  && ok "amorce : un fichier de données modifié recharge le catalogue" \
  || ko "amorce : la modification n'a pas déclenché de rechargement"

# Le sac à dos glacière, 150 vert et 150 noir : la donnée ajoutée au plan doit
# arriver jusqu'à l'ordre de production, sinon elle n'existe pas pour l'atelier.
G=$(MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  const r=db.prepare(\"SELECT i.id,i.quantite q FROM ordre_items i JOIN produits p ON p.id=i.produit_id WHERE p.code='GLACIERE'\").get();
  const v=db.prepare('SELECT nom,quantite FROM item_variantes WHERE item_id=? ORDER BY rang').all(r.id);
  console.log(r.q + ' ' + v.map(x=>x.nom+':'+x.quantite).join(','));" 2>/dev/null)
[ "$G" = "300 Vert:150,Noir:150" ] \
  && ok "le sac à dos glacière est au plan : 300, 150 vert et 150 noir" \
  || ko "sac à dos glacière absent ou mal réparti ($G)"

# Le bandeau intérieur de la tuque de ville est fait à l'atelier, la tuque
# elle-même est tricotée en Chine. Les deux doivent coexister : 1 500 bandeaux
# dans le travail de l'atelier, 1 500 tuques au plan mais hors de cette liste.
B=$(MRP_DB="$CAT" node --no-warnings -e "
  const D=require('./db.js');
  const l=D.listeFabrication().find(x=>x.code==='BANDEAU-TUQUE');
  const a=D.fabriqueAilleurs().find(x=>x.code==='TUQUE-VILLE');
  console.log((l?l.quantite:0)+' '+(a?a.quantite:0)+' '+(a?a.fabrication:''));" 2>/dev/null)
[ "$B" = "1500 1500 chine" ] \
  && ok "1 500 bandeaux à l'atelier, 1 500 tuques tricotées en Chine" \
  || ko "bandeau de la tuque de ville mal réparti ($B)"

# Le bandeau torsadé et le bandeau de la tuque sont DEUX PRODUITS. Le
# rapprochement des consignes se faisait par « premier préfixe qui matche », et
# « Bandeau » est écrit avant « Bandeau tuque urbaine » dans le tableau de
# suivi : le bandeau de la tuque héritait de la consigne de l'autre — « deux
# modèles, torsadé et sport » — alors que la sienne dit que l'assemblage n'a
# pas encore été testé. Le texte affiché avait l'air juste, c'est ce qui rend
# l'erreur coûteuse.
# On compare la CONSIGNE, premier paragraphe des notes techniques : la suite
# parle légitimement de l'autre bandeau, pour dire qu'il n'a rien à voir.
C2=$(MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  const c=(x)=>db.prepare('SELECT notes_tech n FROM produits WHERE code=?')
                 .get(x).n.split('\n\n')[0];
  console.log(/torsad/i.test(c('BANDEAU')) && /chantillon/i.test(c('BANDEAU-TUQUE'))
              && !/torsad/i.test(c('BANDEAU-TUQUE')) ? 'ok' : 'melange');" 2>/dev/null)
[ "$C2" = ok ] \
  && ok "chaque bandeau garde sa consigne : torsadé ici, tuque urbaine là" \
  || ko "les consignes des deux bandeaux se mélangent encore ($C2)"

# `actif` veut dire « au catalogue », pas « vendu ». Quatre pièces AU PLAN en
# étaient sorties : elles n'apparaissaient nulle part et ne pouvaient même pas
# être ajoutées à un ordre depuis le menu « Produit ».
N=$(MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  const q='SELECT COUNT(*) n FROM produits p WHERE p.actif=0 AND EXISTS'
    + ' (SELECT 1 FROM ordre_items i JOIN ordres o ON o.id=i.ordre_id'
    + \" WHERE i.produit_id=p.id AND o.statut IN ('planifie','en_cours'))\";
  console.log(db.prepare(q).get().n);" 2>/dev/null)
[ "$N" = 0 ] \
  && ok "rien de ce qui est au plan n'est hors du catalogue" \
  || ko "$N produit(s) au plan restent inactifs, donc invisibles dans l'app"

# --- les protocoles suivent le dépôt sans rien perdre ---------------------
# L'import efface ce qu'il a lui-même posé, et RIEN d'autre. Deux façons de se
# tromper : effacer un point écrit à la main dans l'app, ou ne pas effacer une
# ligne qui porte sa propre provenance — elle se dupliquerait à chaque
# redémarrage du service.
Z(){ MRP_DB="$CAT" node --no-warnings -e "const{db}=require('./db.js');console.log(db.prepare(\"$1\").get().n)" 2>/dev/null; }
IMP(){ MRP_DB="$CAT" node --no-warnings import_qualite.js --charte --squelettes --ecrire >/dev/null 2>&1; }

# Une consigne donnée de vive voix porte la source « atelier » : elle doit
# survivre à un import, et rester en un seul exemplaire.
AV=$(Z "SELECT COUNT(*) n FROM qc_points WHERE source='atelier'")
IMP
[ "$(Z "SELECT COUNT(*) n FROM qc_points WHERE source='atelier'")" = "$AV" ] && [ "$AV" -ge 1 ] \
  && ok "une source hors des trois fichiers ne se duplique pas à l'import" \
  || ko "les points « atelier » se dupliquent ou ont disparu"

[ "$(Z "SELECT COUNT(*) n FROM qc_points p JOIN produits q ON q.id=p.produit_id WHERE q.code='GANTS-MAGIQUES' AND p.type='critique' AND p.titre LIKE 'Porter le gant%'")" = 1 ] \
  && ok "gants magiques : porter le gant pour l'assouplir est au protocole" \
  || ko "le point d'assouplissement des gants manque"

# Un point écrit dans l'app porte le nom de son auteur. Même s'il reprend la
# source d'un fichier, l'import ne doit pas l'emporter.
MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  const u=db.prepare('SELECT id FROM utilisateurs LIMIT 1').get()
       || {id: db.prepare(\"INSERT INTO utilisateurs (courriel,mdp_hash,nom,role) VALUES ('t@t.co','x','T','admin')\").run().lastInsertRowid};
  const p=db.prepare(\"SELECT id FROM produits WHERE code='GANTS-MAGIQUES'\").get();
  db.prepare(\"INSERT INTO qc_points (produit_id,type,titre,source,cree_par) VALUES (?,'critique','Point saisi à la main','atelier',?)\").run(p.id,u.id);
" 2>/dev/null
IMP
[ "$(Z "SELECT COUNT(*) n FROM qc_points WHERE titre='Point saisi à la main'")" = 1 ] \
  && ok "l'import n'efface pas un point écrit dans l'app" \
  || ko "un point saisi à la main a été emporté par l'import"

# --- une ligne du chiffrier, deux produits d'atelier ----------------------
# Le chiffrier compte 4 665 « Semelles intérieures isolantes ». L'atelier en
# fait deux produits : 2 min 23 la paire jusqu'au 8F, 3 min 35 à partir du 9F.
# Tant que la ligne restait entière, les grandes pointures étaient comptées au
# tarif des petites — une cinquantaine d'heures d'atelier qui n'existaient
# nulle part.
S=$(MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  const q=(c)=>db.prepare(\"SELECT i.quantite n FROM ordre_items i JOIN produits p ON p.id=i.produit_id WHERE p.code=?\").get(c);
  const a=q('SEMELLE-678'), b=q('SEMELLE-9');
  console.log((a?a.n:0) + ' ' + (b?b.n:0));" 2>/dev/null)
[ "$S" = "2179 2486" ] \
  && ok "les semelles sont suivies séparément : 2 179 petites, 2 486 grandes" \
  || ko "le découpage des semelles n'a pas eu lieu ($S)"

# Découper ne doit RIEN ajouter au total : la ligne d'origine est retirée du
# plan, pas laissée à côté de ses morceaux.
#
# Le total est écrit en dur EXPRÈS : c'est ce qui attrape une ligne d'origine
# restée à côté de ses morceaux. Il se met donc à jour à la main, et seulement
# quand on a ajouté quelque chose au plan en le sachant. Dernier mouvement :
# 26 133 → 26 633 le 24/09/2026, les t-shirts brodés — 370 à l'entrée au plan
# (228 vendus en prévente, majorés), portés à 500 le jour même, aux mêmes
# proportions. Avant : 24 633 → 26 133 le 16/09/2026, les 1 500 bandeaux de
# la tuque de ville. Un item EN ATTENTE ne compte pas : le sous-lot conditionnel
# de 200 mitaines de laine (26/09/2026) n'est pas à produire tant qu'il attend.
[ "$(Z "SELECT SUM(quantite) n FROM ordre_items WHERE attente = ''")" = 26633 ] \
  && ok "découper une ligne du plan ne change pas le total à produire" \
  || ko "le total a bougé — la ligne d'origine compte encore"

# Chaque pointure sous son propre produit, et une seule fois.
V=$(MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  const v=(c)=>db.prepare(\"SELECT COUNT(*) n FROM item_variantes WHERE item_id=(SELECT i.id FROM ordre_items i JOIN produits p ON p.id=i.produit_id WHERE p.code=?)\").get(c).n;
  console.log(v('SEMELLE-678') + ' ' + v('SEMELLE-9'));" 2>/dev/null)
[ "$V" = "4 7" ] \
  && ok "les onze pointures sont réparties, quatre petites et sept grandes" \
  || ko "les pointures sont mal réparties ($V)"

# Le 9F+ est plus lent que le 6-7-8 : c'est toute la raison du découpage.
MRP_DB="$CAT" node --no-warnings -e "
  const C=require('./charge.js');
  const t=(c)=>C.tempsUnitaire(c).secondes;
  process.exit(t('SEMELLE-9') > t('SEMELLE-678') ? 0 : 1);" 2>/dev/null \
  && ok "la cédule compte les grandes pointures à leur propre temps" \
  || ko "les deux semelles sont chiffrées au même temps"

# --- les t-shirts sont un ORDRE à part, pas une ligne de plus -------------
# Le t-shirt ne vient pas du chiffrier de la saison : il s'est vendu en
# prévente après, et sa livraison est promise en novembre, pas au départ
# d'octobre. Fondu dans le plan 26-27, il aurait hérité de la mauvaise
# échéance et ses 500 pièces auraient disparu dans 26 133.
T=$(MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  const r=db.prepare(\"SELECT o.numero, o.titre FROM ordre_items i \
     JOIN produits p ON p.id=i.produit_id JOIN ordres o ON o.id=i.ordre_id \
     WHERE p.code='TSHIRT-BRODE'\").get();
  const n=db.prepare('SELECT COUNT(*) n FROM ordres').get().n;
  const seul=db.prepare(\"SELECT COUNT(*) n FROM ordre_items i JOIN ordres o \
     ON o.id=i.ordre_id WHERE o.titre LIKE 'T-shirts%' AND i.attente = ''\").get().n;
  console.log((r?r.titre:'AUCUN')+'|'+n+'|'+seul);" 2>/dev/null)
case "$T" in
  "T-shirts brodés — prévente automne 2026|2|1")
    ok "les t-shirts ont leur propre ordre de production" ;;
  *) ko "les t-shirts ne sont pas sur un ordre distinct ($T)" ;;
esac

# Et cet ordre-là part AVANT celui de la saison est faux : il part après, le
# 24 octobre, par avion — décidé le 24/09/2026. Le mode de transport est sur
# le jalon parce que « 24 octobre » ne se lit pas pareil selon qu'on prend
# l'avion ou le bateau, et que c'est l'atelier qui règle sa cédule dessus.
J=$(MRP_DB="$CAT" node --no-warnings -e "
  const {db}=require('./db.js');
  const j=db.prepare(\"SELECT j.date, j.titre FROM ordre_jalons j JOIN ordres o \
     ON o.id=j.ordre_id WHERE o.titre LIKE 'T-shirts%' AND j.type='expedition'\").get();
  console.log(j ? j.date+'|'+j.titre : 'AUCUN');" 2>/dev/null)
case "$J" in
  "2026-10-24|Expédition vers le Canada (avion)")
    ok "les t-shirts partent le 24 octobre, par avion" ;;
  *) ko "la date ou le mode d'expédition des t-shirts a changé ($J)" ;;
esac

# --- deux ordres, deux dates : le verdict doit dire LAQUELLE il calcule ----
# Le plan de la saison part le 1er octobre, les t-shirts le 24 par avion.
# Comparer TOUT le travail à la date la plus proche réclamerait pour octobre
# des heures dues fin octobre ; n'en montrer qu'une cacherait l'autre.
MRP_DB="$CAT" node --no-warnings -e "
const V=require('./vues.js'), C=require('./charge.js');
const {listeFabrication, db}=require('./db.js');
const cal=C.calendrier(listeFabrication());
const jalons=db.prepare(\"SELECT j.*, o.numero, o.titre AS ordre_titre FROM ordre_jalons j \
   JOIN ordres o ON o.id=j.ordre_id ORDER BY j.date\").all();
const h=V.vueCedule({user:{id:1,role:'admin',nom:'A'},jalons,msg:{},cal}).replace(/\s+/g,' ');
const veut=['01/10/2026','24/10/2026','ech-liste','ech-pire'];
for(const x of veut) if(!h.includes(x)){console.error('manque : '+x);process.exit(1)}
// le verdict porte les heures dues à l'échéance qui commande, pas le carnet
// entier : le total général est relégué en second, marqué comme tel.
if(!/en tout/.test(h)){console.error('le total général a disparu');process.exit(1)}
" 2>&1 && ok "la cédule montre les deux échéances et celle qui commande" \
  || ko "la cédule ne distingue pas les deux échéances"

# --- la photo fléchée du bandeau de tuque ---------------------------------
# C'est la seule image que le MRP sert lui-même comme schéma : la photo Miro
# du bandeau PLUS une flèche rouge, sans laquelle on voit une tuque retournée
# sans savoir lequel des deux tissus est le bandeau.
#
# Elle a été refusée en silence par DEUX gardes successives — celle de
# l'import, celle de la vue — chacune écrite pour bloquer une « data: » URI.
# Une adresse racine n'a aucun des défauts qu'elles visaient. Ce test tient la
# chaîne entière : le fichier existe, la route le sert, et il ressort sur les
# deux pages qui le montrent.
[ -f "public/schema-bandeau-tuque.png" ] \
  && ok "l'image fléchée du bandeau est au dépôt" \
  || ko "l'image fléchée du bandeau a disparu du dépôt"

# Pas de curl ici : à ce point du script le serveur de $B a déjà été remplacé
# par les blocs qui précèdent. On vérifie la déclaration, puis le rendu — qui
# est ce qui compte, parce que c'est la vue qui refusait l'adresse.
grep -q "'/schema/bandeau-tuque.png': \['image/png'" server.js \
  && ok "la route statique de l'image fléchée est déclarée" \
  || ko "la route statique de l'image fléchée a disparu"

MRP_DB="$CAT" node --no-warnings -e "
  const V=require('./vues.js'), D=require('./db.js');
  const p=D.db.prepare(\"SELECT * FROM produits WHERE code='TUQUE-VILLE'\").get();
  const h=V.vueProtocole({user:{id:1,role:'admin',nom:'A'},msg:{},p,
    proto:D.protocole(p.id), photos:[], bris:D.brisProduit(p.id),
    appuis:D.brisParPoint(p.id), ecartes:D.horsSujet(p.id)});
  process.exit(h.includes('/schema/bandeau-tuque.png') ? 0 : 1);" 2>/dev/null \
  && ok "la vue rend bien la photo fléchée sur le point" \
  || ko "la vue refuse encore l'adresse de la photo fléchée"

BT=$(MRP_DB="$CAT" node --no-warnings -e "
  const V=require('./vues.js'), D=require('./db.js');
  const p=D.db.prepare(\"SELECT id FROM produits WHERE code='TUQUE-VILLE'\").get();
  const q=D.protocole(p.id).points.find(x=>/^Bandeau cousu/.test(x.titre));
  if(!q){console.log('POINT ABSENT');process.exit(0)}
  console.log(q.schema_url||'SANS SCHEMA');" 2>/dev/null)
[ "$BT" = "/schema/bandeau-tuque.png" ] \
  && ok "le point du bandeau porte la photo fléchée" \
  || ko "le point du bandeau ne porte pas la photo fléchée ($BT)"

# --- une matière qu'on cesse d'employer ----------------------------------
# `nomenclatures.tsv` recopie les fiches COGS : une matière retirée n'en est
# pas effacée, sinon l'écart de coût avec le chiffrier devient inexplicable.
# Elle porte une date et sort de la composition du produit.
[ "$(Z "SELECT COUNT(*) n FROM produit_materiaux m JOIN produits p ON p.id=m.produit_id WHERE p.code='GLACIERE' AND m.nom='Chanvre'")" = 0 ] \
  && ok "le chanvre ne fait plus partie de la composition de la glacière" \
  || ko "le chanvre est encore dans les matériaux"

[ "$(Z "SELECT COUNT(*) n FROM produit_materiaux m JOIN produits p ON p.id=m.produit_id WHERE p.code='GLACIERE'")" = 8 ] \
  && ok "les huit autres matières de la glacière sont intactes" \
  || ko "le retrait a emporté autre chose"

[ "$(Z "SELECT COUNT(*) n FROM charte c JOIN produits p ON p.id=c.produit_id WHERE p.code='GLACIERE' AND c.section='note' AND c.texte LIKE 'Plus de chanvre%'")" = 1 ] \
  && ok "la fiche dit pourquoi, pour que personne ne le remette" \
  || ko "le retrait du chanvre n'est expliqué nulle part"

# --- un point général qui ne veut rien dire sur CE produit ----------------
# « Comparer à la photo de la boutique » est une bonne consigne partout, et
# n'a aucun sens sur un produit qui n'a pas de fiche en ligne. Le point reste
# juste EN GÉNÉRAL : on l'écarte de ces produits, on ne l'efface pas —
# l'effacer le retirerait de tous les autres.
# Compté en dur, comme le total du plan : un écart qui disparaît sans qu'on
# l'ait décidé remet un point sur une fiche où il ne veut rien dire, et
# personne ne le verrait. Dernier mouvement : 37 → 115 le 24/09/2026, la
# séquence d'abrasion restreinte aux mitaines et aux gants (3 points × 26
# produits). Puis 115 → 103 le 24/09/2026 : les pantoufles, le sac à vin et le
# manchon sortent du catalogue, et leurs douze écarts avec eux.
[ "$(Z "SELECT COUNT(*) n FROM qc_hors_sujet")" = 103 ] \
  && ok "le point hors sujet est écarté de son produit" \
  || ko "l'écart n'est pas chargé"

# Le coussin pour animaux n'avait aucun protocole. Trois points critiques,
# dictés par l'atelier : le geste du roulage, les ganses qui portent le poids,
# et l'intérieur, que l'animal atteint. Un quatrième s'est ajouté le
# 24/09/2026 — la compression du garnissage, le bris le plus fréquent du
# catalogue sur les pièces garnies.
[ "$(Z "SELECT COUNT(*) n FROM qc_points q JOIN produits p ON p.id=q.produit_id WHERE p.code='COUSSIN-ANIMAL' AND q.type='critique'")" = 4 ] \
  && ok "le coussin pour animaux a ses quatre points critiques" \
  || ko "le protocole du coussin pour animaux manque"

# Une tache ne se rattrape pas après coup : c'est la définition du volet
# critique, pas celle d'un problème fréquent.
[ "$(Z "SELECT COUNT(*) n FROM qc_points q JOIN produits p ON p.id=q.produit_id WHERE p.code='OREILLER' AND q.titre='Pas de taches' AND q.type='critique'")" = 1 ] \
  && ok "l'oreiller : « pas de taches » est un point critique" \
  || ko "le contrôle des taches n'est pas classé critique"

# Le bandeau tuque urbaine n'a pas de fiche en ligne : il n'y a littéralement
# pas de photo à laquelle le comparer. (La tuque de ville en a une depuis le
# 22/09/2026 — son écart est tombé le jour même où il avait été posé.) (L'écart portait avant sur « Essai porté » et
# « Fermeture éclair », retirés du protocole général le 23/09/2026 — un
# protocole général ne peut pas supposer un corps à enfiler ni une glissière.)
MRP_DB="$CAT" node --no-warnings -e "
  const D=require('./db.js');
  const p=D.db.prepare(\"SELECT id FROM produits WHERE code='BANDEAU-TUQUE'\").get();
  const t=D.protocole(p.id).points.map(q=>q.titre);
  process.exit(t.some(x=>/Comparaison avec la photo/.test(x)) ? 1 : 0);" 2>/dev/null \
  && ok "le bandeau tuque ne demande plus la comparaison avec une photo qui n'existe pas" \
  || ko "un point écarté figure encore au protocole du bandeau tuque"

# Le bandeau n'est pas un produit : c'est la pièce cousue à l'intérieur de la
# tuque beanie, jamais vendue ni vue. Tout ce qui s'inspecte sur un vêtement
# fini — lavage, étiquette, fils apparents — s'inspecte sur la tuque
# montée. Sur la pièce seule il ne reste que sa coupe. Si un point général
# revient un jour se poser dessus, ce test tombe.
MRP_DB="$CAT" node --no-warnings -e "
  const D=require('./db.js');
  const p=D.db.prepare(\"SELECT id FROM produits WHERE code='BANDEAU-TUQUE'\").get();
  const t=D.protocole(p.id).points.map(q=>q.titre);
  process.exit(t.length===1 && /Dimensions/.test(t[0]) ? 0 : 1);" 2>/dev/null \
  && ok "le bandeau tuque ne garde que sa cote" \
  || ko "le bandeau tuque a autre chose que ses dimensions au contrôle"

# Les mêmes points restent entiers sur la tuque, elle, qui se vend et se porte.
MRP_DB="$CAT" node --no-warnings -e "
  const D=require('./db.js');
  const p=D.db.prepare(\"SELECT id FROM produits WHERE code='TUQUE-VILLE'\").get();
  const t=D.protocole(p.id).points.map(q=>q.titre);
  process.exit(t.some(x=>/Étiquette/.test(x)) && t.some(x=>/Fils qui dépassent/.test(x)) ? 0 : 1);" 2>/dev/null \
  && ok "écarter du bandeau n'a rien retiré à la tuque qui le contient" \
  || ko "un point a disparu de la tuque de ville"

# … mais il vaut toujours ailleurs : c'est toute la différence avec supprimer.
MRP_DB="$CAT" node --no-warnings -e "
  const D=require('./db.js');
  const p=D.db.prepare(\"SELECT id FROM produits WHERE code='CACHE-COU'\").get();
  const t=D.protocole(p.id).points.map(q=>q.titre);
  process.exit(t.some(x=>/Comparaison avec la photo/.test(x)) ? 0 : 1);" 2>/dev/null \
  && ok "la comparaison reste au protocole du cache-cou adulte, qui a une fiche" \
  || ko "écarter d'un produit a emporté le point partout"

# Un point écarté ne doit pas être exigé sur la liste à cocher d'un lot :
# une liste qu'on ne peut pas finir de cocher ne se coche jamais.
MRP_DB="$CAT" node --no-warnings -e "
  const D=require('./db.js');
  const p=D.db.prepare(\"SELECT id FROM produits WHERE code='BANDEAU-TUQUE'\").get();
  const i=D.db.prepare('SELECT id FROM ordre_items WHERE produit_id=?').get(p.id);
  if (!i) process.exit(0);
  const t=D.checklistItem(i.id).points.map(q=>q.titre);
  process.exit(t.some(x=>/Comparaison avec la photo/.test(x)) ? 1 : 0);" 2>/dev/null \
  && ok "la liste à cocher du lot ne demande pas ce qui est écarté" \
  || ko "un point écarté est exigé sur la checklist"


echo "  Tout est conforme."
