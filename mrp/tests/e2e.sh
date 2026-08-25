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
PORT=$PORT node server.js >/dev/null 2>&1 & SRV=$!
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

for u in / /ordres /ordres/1 /produits /produits/1 /cedule /priorites /suivi; do
  S=$(curl -s -b $CA "$B$u" -o /dev/null -w '%{size_download}')
  [ "$S" -lt 25000 ] || ko "page $u trop lourde ($S octets)"
done
ok "toutes les pages sous 25 Ko"

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

echo "  Tout est conforme."
