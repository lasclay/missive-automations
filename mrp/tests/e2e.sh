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
for u in / /ordres /ordres/1 /produits /produits/1 /cedule /priorites /suivi; do
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

# les exemples proposés dépendent du rôle
curl -s -b $CO $B/assistant | grep -q "atelier" \
  && ok "assistant : l'atelier est prévenu de ses limites" || ko "assistant : rôle non signalé"
curl -s -b $CO $B/assistant | grep -q 'Crée un ordre « Prévente' \
  && ko "assistant : exemples d'admin proposés à l'atelier" \
  || ok "assistant : exemples adaptés au rôle"

# on n'annule pas le tour d'un autre
curl -s -b $CO -o /dev/null -w '%{redirect_url}' -X POST $B/assistant/1/annuler \
  | grep -q 'err=' && ok "assistant : tour d'autrui non annulable" \
  || ko "assistant : annulation croisée permise"

# --- contrôle qualité ----------------------------------------------------
# Ce qui compte n'est pas le nombre de points, c'est QUELS produits n'en ont
# aucun — et que le plus gros volume passe devant.
Q=$(curl -s -b $CA $B/qualite)
echo "$Q" | grep -q 'Sans protocole' \
  && ok "la page qualité montre d'abord ce qui n'a rien" || ko "page qualité vide"

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
