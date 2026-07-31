# shipstation-clone — remplacer ShipStation sans abonnement

Trois documents et un début d'application.

| Fichier | Rôle |
|---|---|
| `AUDIT.md` | l'audit complet : volumétrie réelle, modèle de données, inventaire fonctionnel, économie du tarif drop-off, architecture, phases, risques |
| `BRIEF_CLICKSHIP.md` | les questions à poser aux conseillers techniques ClickShip, dans l'ordre — à sortir tel quel pendant l'appel |
| `lib/carrier.js` | la couche transporteur : le contrat que le reste du code utilise, un bouchon de test, le squelette ClickShip |
| `app/` | la grille de tri du backlog — utilisable dès maintenant |
| `data/` | relevés bruts de l'audit (volumétrie 12 mois, transporteurs, tags, tarifs de référence) |

**En une phrase :** l'enjeu n'est pas l'abonnement ShipStation, c'est le tarif Canada Post drop-off
à 6,31 $ — **33 120 $ par an** sur les 12 derniers mois réels (`AUDIT.md` §7 bis).

---

## Où en est le projet

- [x] Audit de la totalité de ShipStation, API et interface
- [x] Chiffrage de l'économie sur 12 mois réels, avec analyse de sensibilité
- [x] Couche transporteur définie, avec bouchon de test
- [x] Grille de tri du backlog, fonctionnelle sur les données réelles
- [ ] **Bloqué : accès à l'API ClickShip/Freightcom** — demande commerciale déposée, en attente
      des identifiants et d'un échange avec leurs conseillers techniques
- [ ] Coter un colis de 400 g Québec → Toronto par l'API et vérifier que le tarif drop-off en sort
      — *la question qui décide de tout, voir `BRIEF_CLICKSHIP.md` §A*
- [ ] Achat d'étiquette, lots, douanes, notifications

Tant que la question A1 du brief n'a pas de réponse, **aucun code de transport n'est écrit** :
l'adaptateur ClickShip est un squelette qui échoue explicitement, et l'application tourne sur le
bouchon.

---

## L'application de tri

```bash
export GENERAL_PROXY_SECRET=…        # même secret que connectors_client.js
node shipstation-clone/app/server.js # http://localhost:3100
```

Elle lit le backlog de ShipStation par le General Proxy — commandes à expédier, en attente et en
attente de paiement — et donne ce que ShipStation fait bien :

- **filtres cumulables** : texte libre (n° de commande, client, courriel, ville, SKU), statut,
  pays, poids min/max, âge minimum, commandes sans poids ;
- **filtre drop-off** : les commandes sous 500 g, celles qui portent l'économie ;
- **tri par colonne**, clic pour inverser le sens ;
- **vues sauvegardées** en onglets (clic droit pour supprimer), sans limite de nombre ;
- **sélection multiple** et actions de masse ;
- **cotation** d'une commande par l'adaptateur transporteur ;
- **Hold jusqu'à une date** et remise en file.

### Sécurité par défaut

L'application est **en lecture seule**. Hold et remise en file touchent le vrai ShipStation : ils
sont désactivés tant que `CLONE_ALLOW_WRITES=1` n'est pas positionné, et l'interface l'affiche.

La cotation passe par l'adaptateur : sur le bouchon (défaut) elle ne coûte rien et ne sort pas de
la machine. Aucun achat d'étiquette n'est implémenté — c'est délibéré tant que le transporteur
n'est pas choisi.

| Variable | Défaut | Rôle |
|---|---|---|
| `GENERAL_PROXY_SECRET` | — | **requis**, secret d'appel du General Proxy |
| `PORT` | 3100 | |
| `CLONE_APP_SECRET` | — | mot de passe de l'interface, à poser avant tout déploiement |
| `CARRIER_ADAPTER` | `bouchon` | `clickship` quand les identifiants seront là |
| `CLONE_ALLOW_WRITES` | non | `1` pour autoriser Hold/Restore sur le vrai ShipStation |

### Ce qu'elle ne fait pas encore

Pas d'achat d'étiquette, pas de lots, pas de bordereaux, pas de douanes, pas de notifications.
L'ingestion se fait par ShipStation plutôt que directement par Shopify — quand ce sera l'inverse,
seule la fonction `chargerCommandes` de `app/server.js` change.

---

## La couche transporteur

`lib/carrier.js` définit quatre fonctions — `quote`, `buy`, `void_`, `track` — et rien d'autre du
transport ne remonte dans l'application. C'est ce qui permet de développer l'interface aujourd'hui
et de brancher ClickShip plus tard sans y retoucher, ou d'en changer si leur tarif bouge.

`choisirTarif()` porte la règle qui matérialise l'économie : le moins cher, en privilégiant le
drop-off sous 500 g. Elle est isolée là pour rester testable et modifiable en un seul endroit.

Le seuil `SEUIL_DROPOFF_G = 500` vient du programme Canada Post « envoi unique sous 1,1 lb ».
80,5 % des colis de Lasclay passent dessous.
