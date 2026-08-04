# Brancher le compte Postes Canada

But : acheter une vraie étiquette depuis le clone, sur le compte commercial de Lasclay, sans
passer par ShipStation. Ce document dit exactement quoi obtenir, où le mettre, et comment
vérifier que ça marche avant de dépenser un sou.

---

## 1. La fenêtre contextuelle de ShipStation — ce que c'est vraiment

ShipStation ouvre une fenêtre où l'on se connecte à son compte Postes Canada, et ressort avec
le compte branché. Ce mécanisme s'appelle le **DRC** — *Developer Registration & Consent*.
Il fonctionne ainsi :

1. la plateforme (ShipStation) est enregistrée chez Postes Canada et possède un `platform-id` ;
2. elle demande un jeton, envoie le marchand sur la page de consentement de Postes Canada ;
3. le marchand s'authentifie et accepte ;
4. Postes Canada rend à la plateforme les identifiants d'API **du marchand**.

Le `platform-id` n'est accordé qu'aux plateformes qui desservent **plusieurs** marchands. Le
clone en dessert un seul — le sien. Reproduire le DRC reviendrait à demander à Postes Canada
d'enregistrer Lasclay comme fournisseur de logiciel pour se connecter à lui-même.

**Le chemin correct, pour un marchand unique, est la clé d'API du compte.** C'est une saisie
unique, elle ne périme pas, et elle donne exactement les mêmes accès que la fenêtre.

---

## 2. Ce que le compte Lasclay a déjà

Trouvé dans la boîte support (fil « Ouverture de compte colis », mars 2024) :

| Élément | Valeur |
| --- | --- |
| Raison sociale | LES PRODUITS LASCLAY INC. |
| Numéro de client Postes Canada | **5082011** (`0005082011` dans ShipStation) |
| Convention | **Niveau 9** — volume 5 000 à 9 999 colis / 12 mois |
| Signée le | 22 mars 2024 (AAF approuvée par courriel par Gabriel Gouveia) |
| Second compte | `0008084738` — « Rotule », 1,08 $ plus cher sur le même service |
| Tarifs É.-U. et internationaux | activés automatiquement avec la convention |

Il manque **le numéro de contrat** (*contract-id*), qui n'apparaît dans aucun courriel. Il se
trouve dans le portail Postes Canada, section « Mon profil / Mes ententes », ou s'obtient
auprès de la représentante. Sans lui, l'API cote au **tarif du comptoir** — visiblement plus
cher que le Niveau 9. L'écran le dit franchement (« contrat absent — tarifs du comptoir »).

### Contacts, tirés de la boîte support

| Personne | Rôle | Coordonnées |
| --- | --- | --- |
| **Miguel Du Perron** | *Customer Automation — eCommerce Support Technician*, Postes Canada | Miguel.DuPerron@canadapost.ca · 613-734-1656 · 613-668-4820 |
| **Christine Valin** | Représentante, Solutions d'affaires (territoire de Québec) | christine.valin@canadapost.postescanada.ca · 581-998-7265 |
| Stella Nchang | Facturation | stella.nchang@canadapost.postescanada.ca · 1-800-267-7651 p. 8880542 |

Miguel Du Perron est **la bonne personne** : Christine l'a présenté en mars 2024 précisément
comme celui qui aide à *« connecter ton nouveau compte Postes Canada à ShipStation »*. Il faut
lui écrire en précisant le numéro de client et le nom légal. La question à lui poser tient en
deux lignes :

> Nous passons d'une plateforme tierce à notre propre outil d'expédition. Nous avons besoin
> des identifiants d'API *Ship & Track* rattachés au compte 5082011, ainsi que du numéro de
> contrat à utiliser dans les appels. Faut-il ouvrir un compte au Programme des développeurs,
> ou les clés peuvent-elles être émises depuis le compte commercial ?

---

## 3. Obtenir la clé d'API

1. Ouvrir un compte au **Programme des développeurs** de Postes Canada
   (`canadapost-postescanada.ca` → Entreprise → Outils d'expédition → développeurs), avec la
   même adresse de courriel que le compte commercial.
2. Rattacher le numéro de client **5082011**. C'est ce rattachement qui donne accès aux tarifs
   contractuels ; sans lui, la clé fonctionne mais cote au comptoir.
3. Deux paires d'identifiants sont émises, **et elles ne sont pas interchangeables** :

| Milieu | Passerelle | Ce que ça fait |
| --- | --- | --- |
| Essai | `ct.soa-gw.canadapost.ca` | étiquettes générées, **non facturées, non livrables** |
| Production | `soa-gw.canadapost.ca` | **argent réel**, colis réellement livrables |

Commencer en essai. Toujours.

---

## 4. Où mettre les identifiants

Deux chemins, l'environnement gagne toujours sur la base.

**Chemin recommandé — variables d'environnement Render** (les secrets ne touchent jamais le
dépôt) :

```
CP_USERNAME=…        nom d'utilisateur d'API
CP_PASSWORD=…        mot de passe d'API
CP_CUSTOMER=0005082011
CP_CONTRACT=…        numéro de contrat, si connu
CP_ENV=essai         ou « prod »
CP_MOBO=…            facultatif : expédier pour le compte d'un tiers
```

**Chemin par l'écran** — *Réglages ▸ Compte transporteur — Postes Canada ▸ Brancher…*
C'est l'équivalent de la fenêtre de ShipStation. Les valeurs sont stockées dans la table
`settings` du disque persistant. Le mot de passe n'est **jamais** renvoyé au navigateur : le
formulaire le laisse vide, et un champ vide ne remplace rien.

Une valeur définie par variable d'environnement est affichée avec la pastille `env` et ne peut
pas être modifiée depuis l'écran — c'est voulu : une valeur oubliée en base ne doit jamais
prendre le pas sur la vraie.

Enfin, pour que le clone utilise réellement Postes Canada plutôt que le bouchon de
démonstration :

```
CARRIER_ADAPTER=postescanada
```

---

## 5. Vérifier

```bash
node shipstation-clone/verifier_postescanada.js          # hors ligne, 52 contrôles, aucun réseau
node shipstation-clone/verifier_postescanada.js --reel   # une cotation réelle, aucun achat
```

Le mode hors ligne valide la forme des requêtes XML avec un `fetch` remplacé par un espion :
type MIME, authentification, conversion des unités, options, lecture des réponses et des
erreurs. Le mode `--reel` ajoute une cotation véritable avec les identifiants en place.

Depuis l'écran, le bouton **Tester la connexion** fait la même chose et affiche les tarifs
renvoyés. La cotation est en **lecture pure** : elle ne crée aucune étiquette.

---

## 6. Ce que l'API fait, et ce qu'elle ne fait pas

| Opération | Chemin | Effet |
| --- | --- | --- |
| Cotation | `POST /rs/ship/price` | aucun — lecture pure |
| Créer une étiquette | `POST /rs/{client}/{mobo}/shipment` | **facture** en production |
| Annuler | `DELETE …/shipment/{id}` | possible **avant** transmission |
| Rembourser | `POST …/shipment/{id}/refund` | après transmission, non instantané, sur billet de service |
| Manifeste de fin de journée | `POST /rs/{client}/{mobo}/manifest` | transmet les étiquettes créées |
| Suivi | `GET /vis/track/pin/{pin}/detail` | lecture pure |

L'option **`DNS`** (*ne pas laisser sans surveillance*) est appliquée à tout envoi domestique
sans signature : c'est le pendant exact du `Confirmation = 5` que la règle 6 du compte
ShipStation appliquait à tous les services Postes Canada. La bascule ne change donc rien à la
politique de livraison.

### La réserve, écrite noir sur blanc

`AUDIT.md` § 7 bis avait **écarté** l'API Postes Canada directe : elle perd le tarif
**drop-off à 6,31 $**, qui représente à lui seul l'essentiel de l'économie du projet
(≈ 33 000 $ par an). Ce constat tient toujours. Ce module ne le contredit pas :

- il ouvre l'achat d'étiquette au **tarif contractuel Niveau 9**, ce qui permet de tester la
  chaîne complète — cotation, achat, PDF, suivi, manifeste — dès maintenant ;
- aucun tarif qu'il renvoie n'est marqué `dropOff` : le comparateur affiche ce qui est vrai,
  pas ce qu'on aimerait ;
- la couche `lib/carrier.js` reste inchangée, donc brancher plus tard un courtier qui expose
  le tarif de dépôt ne demandera aucune retouche à l'interface.

Autrement dit : Postes Canada direct est le chemin qui **fonctionne tout de suite**, le
courtier reste le chemin qui **rapporte**. Les deux coexistent derrière le même adaptateur.

---

## 7. Ordre des opérations avant le premier achat réel

1. Obtenir la clé d'essai, la saisir, **Tester la connexion** → des tarifs s'affichent.
2. Obtenir le numéro de contrat → les tarifs baissent au Niveau 9, l'avertissement disparaît.
3. Acheter une étiquette **en essai** : vérifier le PDF 4 × 6, le numéro de suivi, l'annulation.
4. Seulement ensuite : basculer `CP_ENV=prod` et armer `CLONE_ALLOW_LABELS=1`.
5. Premier achat en production sur **une** commande réelle, dont le colis part vraiment.
   Comparer le montant facturé à la cotation.

Les étapes 4 et 5 restent soumises aux items V1-07 à V1-11 de l'audit, et à la décision du
propriétaire. Rien dans ce module ne les contourne : l'achat traverse toujours
`lib/shipments.js`, la permission `labels_buy` et le drapeau `CLONE_ALLOW_LABELS`.
