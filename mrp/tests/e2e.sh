#!/bin/sh
# Test de bout en bout : démarre le serveur sur une base jetable et vérifie
# le parcours complet, y compris le modèle de permissions.
set -e
cd "$(dirname "$0")/.."
DB=$(mktemp -d)/t.db; PORT=${PORT:-3199}
export MRP_DB="$DB"
ok(){ printf "  [OK ] %s\n" "$1"; }
ko(){ printf "  [ÉCHEC] %s\n" "$1"; kill $SRV 2>/dev/null; exit 1; }

node mrp.js demo >/dev/null 2>&1
node mrp.js utilisateur:creer a@test.com motdepasse1 "Admin" admin >/dev/null 2>&1
node mrp.js utilisateur:creer o@test.com motdepasse2 "Atelier" atelier >/dev/null 2>&1
PORT=$PORT node --no-warnings server.js >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
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

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/items/2/supprimer
N=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM ordre_items').get().n)" 2>/dev/null)
[ "$N" = 4 ] && ok "l'atelier ne peut pas supprimer d'item" || ko "item supprimé par l'atelier"

curl -s -b $CO -o /dev/null -X POST $B/ordres/1/commentaires --data 'texte=Coupe terminée'
C=$(node -e "const{db}=require('./db.js');console.log(db.prepare('SELECT COUNT(*) n FROM ordre_commentaires').get().n)" 2>/dev/null)
[ "$C" -ge 1 ] && ok "l'atelier peut commenter" || ko "commentaire refusé"

# avancement global pondéré : 2000×70 + 800×20 + 500×0 + 300×10 = 159000 / 3600 = 44 %
P=$(curl -s -b $CA $B/ordres/1 | grep -oE '>[0-9]+ %<' | head -1 | tr -dc 0-9)
[ "$P" = 44 ] && ok "avancement global pondéré par les quantités = 44 %" || ko "pondération incorrecte ($P)"

# ce qui compte n'est pas le poids du HTML mais ce qui part sur le réseau
for u in / /ordres /ordres/1 /produits /produits/1 /cedule /priorites /suivi \
         /inventaire /besoins; do
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

# --- amorce du premier compte -------------------------------------------
# Un service fraîchement déployé n'a aucun utilisateur : sans amorce, personne
# ne peut ouvrir de session, et sans shell c'est irrécupérable. L'amorce doit
# créer ce compte UNE fois, et ne jamais toucher à une base déjà peuplée.
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null || true
NEUVE=$(mktemp -d)/neuve.db
MRP_DB="$NEUVE" MRP_ADMIN_COURRIEL=chef@test.com MRP_ADMIN_MDP=motdepasse9 \
  PORT=$((PORT+1)) node --no-warnings server.js >/dev/null 2>&1 & SRV=$!
sleep 1.5
[ "$(MRP_DB="$NEUVE" node --no-warnings mrp.js utilisateur:liste | grep -c 'chef@test.com .*Admin QC')" = 1 ] \
  && ok "amorce : le premier compte est créé sur une base neuve" \
  || ko "amorce : premier compte absent"
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null || true

# relance avec d'autres identifiants : la base n'est plus vide, rien ne bouge
MRP_DB="$NEUVE" MRP_ADMIN_COURRIEL=intrus@test.com MRP_ADMIN_MDP=motdepasse9 \
  PORT=$((PORT+1)) node --no-warnings server.js >/dev/null 2>&1 & SRV=$!
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
  PORT=$((PORT+2)) node --no-warnings server.js >/dev/null 2>&1 & SRV=$!
sleep 1.5
[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$((PORT+2))/sante)" = 200 ] \
  && [ "$(MRP_DB="$COURT" node --no-warnings mrp.js utilisateur:liste | grep -c .)" = 0 ] \
  && ok "amorce : mot de passe trop court refusé, le service démarre quand même" \
  || ko "amorce : mot de passe court accepté ou service en panne"

echo "  Tout est conforme."
