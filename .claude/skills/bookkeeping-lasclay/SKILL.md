---
name: bookkeeping-lasclay
description: "Tenue de livres de Lasclay dans Dext et QuickBooks Online. Charge ce skill pour classer, reviser ou publier des factures et recus fournisseurs, la boite Dext, un compte de charge, un code de taxe TPS/TVQ, une facture en devise etrangere, un doublon, un rapprochement bancaire, une ecriture de journal, la categorisation d'operations bancaires, une requete QBO par le proxy finance, l'ecriture de paie Desjardins, l'ecriture mensuelle des taxes Shopify, une declaration de TPS ou de TVQ, ou la comptabilisation des financements: Merchant Growth, Shopify Capital, prets BDC, ventilation capital et interets. Declenche-toi aussi sur « classe mes factures », « est-ce un doublon », « categorise les paiements de pret », « passe l'ecriture de paie », « fais les taxes du mois ». Pour les previsions et les etats financiers, utilise finances-lasclay."
---

# Tenue de livres Lasclay — Dext et QuickBooks Online

Ce skill couvre le trajet d'une pièce justificative : elle arrive dans Dext, on la
classe, on valide ses montants contre QBO, puis on la publie. Les Produits Lasclay inc.,
exercice fiscal du 1er septembre au 31 août.

Voix : québécois, direct, pas de cadratins. Virgules, deux-points, parenthèses ou traits
d'union simples.

## Le principe qui prime sur tout le reste

**QuickBooks Online est la vérité.** Dext est un outil de saisie, et sa lecture des pièces
est une hypothèse, pas un fait. Chaque fois qu'un montant, une devise ou une taxe est en
jeu, la question à se poser est « qu'est-ce que QBO en dit », pas « qu'est-ce que Dext a
extrait ».

Ça a des conséquences pratiques :

- Avant de publier une pièce, vérifier dans QBO qu'elle n'y est pas déjà. Dext ne le fait
  pas pour toi, et une dépense comptée deux fois est difficile à repérer après coup.
- Le taux de change à utiliser est celui de la table `ExchangeRate` de QBO, pas celui que
  Dext affiche. Les deux diffèrent régulièrement de 0,5 à 1 %.
- Quand une pièce publiée ne se rapproche pas d'une transaction bancaire, c'est presque
  toujours la pièce qui a tort, pas la banque.

## Accès à QBO

L'API QuickBooks passe par un proxy que Gabriel héberge. **Le secret n'est pas dans ce
skill** : demande-le à Gabriel au début de la session, ou reprends-le s'il l'a déjà fourni.

Le sandbox infonuagique ne peut pas joindre le domaine du proxy (le pare-feu sortant renvoie
un 403). Il faut passer par le **navigateur intégré** : l'ouvrir sur le domaine du proxy, puis
faire les appels en JavaScript avec `fetch`, ce qui les rend same-origin. Voir
`references/qbo-proxy.md` pour les endpoints, l'en-tête d'authentification et des requêtes
prêtes à coller.

## Toujours le navigateur intégré

**Tout ce qui passe par un navigateur dans ce skill passe par le navigateur intégré de la
session.** Pas l'extension Claude in Chrome, pas le Chrome du poste de Gabriel, pas un
Playwright monté à la main, pas de `curl` depuis le Bash.

Ça vaut pour les cinq chemins du skill :

| Besoin | Chemin |
| --- | --- |
| Proxy finance : requêtes, rapports, écritures | navigateur intégré sur le domaine du proxy, appels `fetch` |
| Interface QBO : pièce jointe, écran de rapprochement | navigateur intégré |
| Dext : classer, publier, archiver | navigateur intégré |
| Portails : Shopify Capital, Merchant Growth, BDC, Revenu Québec, ARC | navigateur intégré |
| Lire un PDF sorti du proxy | `pdf.js` chargé dans la page du navigateur intégré |

Pourquoi c'est une règle et pas une préférence : le navigateur intégré est là à chaque
session sans rien installer, il ne dépend pas du poste de Gabriel, la page reste ouverte entre
les appels (les raccourcis posés dans `window` tiennent), et il laisse voir l'écran, ce qui
est la seule façon sûre de cliquer sur un portail.

Trois conséquences pratiques :

- Ne demande pas à Gabriel d'ouvrir un onglet ni d'installer une extension. Ouvre toi-même la
  page dans le navigateur intégré et travaille dedans.
- Les sessions du navigateur intégré sont distinctes des siennes. Sur un portail qui demande
  une authentification, ouvre la page, puis demande-lui de se connecter dans ce
  navigateur-là. Ne saisis jamais ses identifiants toi-même.
- Si le navigateur intégré n'arrive pas à joindre un domaine, c'est une question de
  configuration de la session : le dire à Gabriel. Ne pas retomber sur `curl`, qui échouera
  de toute façon, et ne pas lui refiler la manœuvre.

## Les quatre pièges de l'API QBO

Chacun a produit une conclusion fausse dans une session réelle. Ils sont silencieux : rien
dans la réponse ne signale le problème.

### 1. `CurrentBalance` vaut 0 pour tous les comptes de charge

Ce n'est pas un solde nul, c'est un champ que QBO ne remplit pas pour les comptes de
résultat. S'y fier mène à conclure qu'une charge n'a jamais été comptabilisée, puis à la
passer une deuxième fois. C'est exactement comme ça qu'une charge d'intérêts a failli être
surévaluée de 6 353,67 $ le 30 juillet 2026.

Pour un compte de charge, la seule source est un état des résultats, ou la somme des lignes
relevées par requête.

### 2. `maxresults` tronque sans le dire

Le maximum par requête est de 1 000 et il n'y a **aucun indicateur de troncature** dans la
réponse. Le dossier compte plus de 1 500 écritures de journal, 3 000 dépenses et 1 500
factures : une requête « sur tout l'historique » en rate donc une partie.

La méthode correcte, avant toute conclusion sur un solde ou un cumul :

```javascript
// 1. compter
await window.__q("select count(*) from JournalEntry");   // .data.QueryResponse.totalCount
// 2. paginer
await window.__q("select * from JournalEntry startposition 501 maxresults 500");
```

Boucler jusqu'à ce qu'une page revienne avec moins de 500 lignes. Limiter chaque exécution de
JavaScript dans le navigateur intégré à 3 ou 4 pages, sinon le délai saute : accumuler dans
`window.__scan` entre les appels, la page reste ouverte donc l'accumulateur survit.

### 3. L'action `report` ignore les paramètres de dates

Les paramètres `start_date` et `end_date` ne sont pas appliqués : le rapport revient toujours
sur l'exercice courant **arrêté à aujourd'hui**. Deux conséquences :

- impossible d'obtenir un état des résultats d'un exercice antérieur par cette voie, il faut
  relever les lignes par requête et filtrer sur `TxnDate` ;
- une pièce datée de demain n'apparaît pas. Un écart entre un rapport et la somme des
  écritures s'explique souvent comme ça, pas par une anomalie.

Le paramètre `account` n'est pas appliqué non plus.

### 4. Les entités multiples

Une même réalité économique entre par des portes différentes selon qui l'a saisie. Un
remboursement de prêt peut être un `Transfer`, un `Purchase` ou un `JournalEntry`. Chercher
dans une seule entité et conclure à l'absence est une erreur classique : elle a fait conclure
à tort que 38 versements Merchant Growth manquaient, alors qu'ils étaient tous là en
`Transfer`.

Balayer `JournalEntry`, `Purchase`, `Bill`, `Deposit`, `Transfer` et `VendorCredit`. Les
`Transfer` ne se lisent pas comme les autres : ils portent `FromAccountRef` et
`ToAccountRef`, pas de lignes.

### 5. `update` efface les pièces jointes

L'action `update` remplace la pièce au complet, et le lien vers les `Attachable` ne survit
pas. Le fichier reste dans le dossier, mais l'écriture ne le montre plus, et rien ne le
signale.

**Toujours rattacher la pièce après la dernière modification, jamais avant.** Si une écriture
doit être corrigée après coup, prévoir de rejoindre le document.

### 6. Le proxy ne peut pas téléverser de fichier

Les actions disponibles sont `report`, `query`, `companyinfo`, `read`, `download`, `create`,
`update`, `remove`. Il n'y a pas d'action `upload`, et `create` sur `attachable` ne crée
qu'une note texte : QBO refuse une pièce jointe sans fichier.

Pour attacher un vrai document, passer par l'interface QBO dans le navigateur intégré : ouvrir
la pièce, repérer le champ de fichier caché de la zone « Pièces jointes », et y déposer le
fichier ou une capture.
Ça fonctionne aussi bien pour un PDF local que pour une capture d'écran d'un portail.

## Discipline de vérification

Avant d'écrire quoi que ce soit qui touche un solde cumulatif, poser une **identité de
contrôle** : une égalité entre ce que disent les livres et ce que dit une source externe
(contrat, portail, relevé). L'écriture n'est bonne que si l'identité tombe.

Exemple qui a servi : le cumulatif du compte `7012 Intérêts Shopify Capital` depuis l'origine
doit égaler la somme des frais fixes contractuellement gagnés sur les cinq avances. 40 320,08
des deux côtés : plus aucun doute sur un double comptage.

Quand une identité ne tombe pas à quelques dollars près, **ne pas forcer l'écart**. Le
nommer, l'expliquer si possible, et le laisser visible. Un plug non documenté est ce qui a
créé les deux actifs reportés qu'il a fallu défaire en juillet 2026.

## Reconnaître un doublon

Le numéro de facture est le seul identifiant fiable. Deux pièces qui portent le même numéro
sont la même transaction, peu importe qu'elles diffèrent par la devise, le montant, le type
de document ou la date de capture.

Ne te fie pas au montant et à la date : le 14 juillet 2026, Anthropic a émis deux factures
distinctes de 46,07 USD le même jour. Même fournisseur, même date, même montant, deux
transactions réelles. Seuls les numéros `-0007` et `-0008` permettaient de trancher.

Le contrôle inverse est aussi utile : une série de numéros séquentiels doit être continue.
Un trou dans la série veut dire qu'une pièce est ailleurs (archivée, déjà publiée) ou
qu'elle n'a jamais été captée. Chercher avant de conclure.

### Facture ou reçu

Plusieurs fournisseurs SaaS envoient deux documents par transaction : la facture (*Invoice*,
avec date d'échéance) et le reçu de paiement (*Receipt*, avec un numéro de reçu et un
historique de paiement). Les deux atterrissent dans Dext et portent le même numéro de
facture.

**Garder la facture, archiver le reçu.** La facture porte la devise réelle et le champ
« Montant TTC (CAD) » qu'on veut contrôler. Les reçus, eux, se font souvent lire par Dext
comme des montants en CAD alors qu'ils sont en USD, ce qui est exactement la source d'erreur
qu'on cherche à éliminer.

## Devises étrangères

Le champ « Montant TTC (CAD) » de Dext détermine ce qui entre dans les livres. Le calculer
ainsi :

```
CAD = montant USD × taux ExchangeRate de QBO à la date de la facture
```

Arrondir au cent. Après avoir écrit le montant, Dext recalcule la TVA en CAD tout seul :
c'est un bon contrôle. Plusieurs fournisseurs impriment l'équivalent canadien de la taxe
directement sur la facture (A2X écrit « GST $3.95 (CA$5.56) ») — si le chiffre recalculé
par Dext correspond, le taux est bon.

Ne pas utiliser le taux de la charge de carte de crédit, même s'il paraît plus « réel » :
elle n'est souvent pas encore comptabilisée au moment où on classe la pièce, et QBO
convertit de toute façon avec sa propre table. Utiliser le même taux que QBO, c'est ce qui
permet au rapprochement de fonctionner.

**Piège à connaître :** certains fournisseurs sont enregistrés dans QBO en devise CAD, pas
en USD avec un taux. Pour ceux-là, le montant CAD de Dext devient directement le montant
comptabilisé, sans filet. Une erreur de conversion passe sans être détectée. Voir la
colonne « devise QBO » dans `references/fournisseurs.md`.

## Taxes

Le champ « TVA » de Dext est un code, pas juste un montant. Le réglage par défaut
« Montant Extrait » demande à Dext de deviner à partir de l'image, et il se trompe surtout
sur les factures en devise étrangère, où il ne capte souvent que la portion TPS.

Assigner explicitement le code qui correspond au fournisseur :

| Situation | Code Dext |
|-----------|-----------|
| Fournisseur inscrit TPS et TVQ | `TPS/TVQ QC - 9,975` |
| Fournisseur inscrit TPS seulement | `TPS` |
| Fournisseur étranger non inscrit, aucune taxe facturée | `Exonéré` |

Pour savoir dans quelle case tombe un fournisseur, regarder les numéros d'inscription
imprimés sur sa facture. Un fournisseur qui affiche un numéro de TVQ (format `NR000…`) et un
numéro de TPS (format `…RT0001`) charge les deux taxes. Un fournisseur qui n'affiche qu'un
numéro `RT0001` ne charge que la TPS.

Une fois le code assigné, Dext recalcule le montant de taxe sur le HT. Vérifier que le total
retombe sur le montant de la facture : si l'écart dépasse un cent ou deux, quelque chose ne
va pas.

### Autoliquidation

Quand une facture porte une mention du genre « Reverse charge: Exempted VAT/GST », le
fournisseur ne facture aucune taxe parce que Lasclay lui a fourni son numéro d'inscription.
Il n'y a donc aucun CTI à réclamer : on ne récupère pas une taxe qu'on n'a jamais payée.
L'autocotisation correspondante n'est en principe pas requise non plus, un inscrit ne
s'autocotisant sur un service importé que dans la mesure où le service n'est pas utilisé
dans ses activités commerciales. Le code `Exonéré` est le bon choix. Signaler la mention à
Gabriel pour validation par le comptable plutôt que de trancher soi-même, surtout côté TVQ.

## Publier

Séquence complète, dans cet ordre :

1. **Vérifier dans QBO** qu'aucune facture ni aucun achat ne porte déjà ce numéro. Une
  requête sur `Bill` et sur `Purchase` couvre les deux modes d'entrée.
2. **Assigner le compte de charge et le code de taxe** selon `references/fournisseurs.md`.
3. **Corriger le montant CAD** si le fournisseur est en devise étrangère.
4. **Vérifier « Publier comme »** : Facture fournisseur ou Carte de Crédit selon le
  fournisseur. Ce choix détermine si la pièce devient un `Bill` ou un `Purchase` dans QBO,
  et donc si elle se rapprochera correctement.
5. **Publier**, puis relire dans QBO pour confirmer que le montant, la devise, le taux et la
  taxe sont ceux attendus.

### Le bouton « Publier » de Dext

Le premier clic après le chargement de la page n'enregistre pas : il n'affiche que
l'infobulle. Le réflexe de cliquer deux fois est piégeux, parce qu'une fois la pièce
publiée, Dext passe automatiquement à la suivante et le deuxième clic la publie elle aussi.

La parade : cliquer une fois, regarder le compteur de la boîte de réception, et ne
re-cliquer que s'il n'a pas bougé.

### Le statut « Publié » de Dext ne prouve rien

Le statut peut être mis à la main sans que la pièce ait jamais été poussée vers QBO. Le reçu
Render du 4 juillet 2026 portait « Publié » dans les archives alors qu'aucun achat ni facture
Render n'existait dans QBO entre le 25 juin et le 20 août.

**Vérifier dans QBO, pas dans Dext.** Et quand une charge attendue manque, aller voir si sa
pièce dort dans les archives Dext avec un statut menteur : il y en a probablement d'autres.

## Corriger une pièce déjà publiée

Ça se fait par l'action `update` du proxy. C'est une écriture dans les livres :
**demander l'accord explicite de Gabriel avant, chaque fois, sans exception.** Lui présenter
le détail chiffré de ce qui change avant de le faire, pas après.

Avec `GlobalTaxCalculation: TaxExcluded`, il suffit de corriger le montant de la ligne de
dépense : QBO recalcule les taxes à partir du `TaxCodeRef`. Le corps de la requête exige
`Id` et `SyncToken`, qu'on obtient en lisant la pièce juste avant. Relire après coup pour
confirmer : le `SyncToken` doit avoir augmenté de 1.

## Paie

Rapport Desjardins, écriture `Sal Dist AAAA-MM-JJ` datée au jour du débit bancaire, soit deux
jours avant la date payable. Méthode complète, formule de contrôle et table structure →
compte : voir `references/paie.md`.

Les deux choses à ne pas oublier : **la CNT est exclue** du montant, et le compte de charge
vient de la **structure division / service** du rapport des coûts distribués, pas du nom de
l'employé.

## Taxes Shopify

Écriture mensuelle `AAAA-MM Taxes` datée au dernier jour du mois, à partir du rapport Taxes de
Shopify. Périmètre, gabarit de lignes et table des `TaxRateRef` : voir
`references/taxes-shopify.md`.

Le piège central : **une ligne de taxe sans `TaxRateRef` s'enregistre et se balance, mais
n'alimente pas la déclaration.** Le symptôme visible est un total affiché à 0,00 dans la
grille QBO.

## Déclarations de taxes

Les chiffres viennent de QBO, Taxe de vente → Préparer la déclaration, jamais d'un calcul
maison. La page donne les lignes 101 à 116 pour la TPS et 201 à 217 pour la TVQ.

Sur le portail de Revenu Québec, la ligne 201 refuse un montant négatif. Quand QBO affiche un
chiffre d'affaires négatif pour la période, c'est presque toujours une « exception » de QBO,
c'est-à-dire une pièce d'une période antérieure ramenée dans le calcul. **Retracer l'exception
avant de décider quoi inscrire, et faire valider le choix par Gabriel.** Ne pas inventer un
substitut.

## Financements

Avances Merchant Growth et Shopify Capital, prêts BDC : voir `references/financements.md`.

La règle qui prime, donnée par Gabriel : **le passif porte le montant reçu, pas le montant à
rembourser.** Le coût du financement devient une charge au rythme des remboursements. Pas
d'actif reporté, pas de passif gonflé.

Corollaire pratique : sur une avance à frais fixes, la portion frais de chaque versement est
strictement proportionnelle au remboursement. Ne jamais reconstituer un taux d'intérêt
annuel, ces produits n'en ont pas.

## Diagnostiquer une pièce qui ne se rapproche pas

Un solde qui reste ouvert dans les Comptes fournisseurs est un signal, pas un détail. La
charge de carte existe, mais elle ne correspond à rien d'assez proche pour que QBO fasse le
lien. Dans l'ordre :

1. Comparer le montant comptabilisé au montant réel converti. Un écart d'environ 40 % sur
  une facture en USD veut dire que le montant USD a été comptabilisé comme du CAD.
2. Vérifier la devise de la pièce dans QBO.
3. Vérifier que la charge est bien descendue dans le flux bancaire. Les éléments « à
  examiner » ne sont pas exposés par l'API : leur absence dans une requête `Purchase` ne
  veut pas dire qu'ils n'existent pas, seulement qu'ils ne sont pas encore comptabilisés.

## Journal de session

Tenir un fichier markdown pendant le travail et le livrer à Gabriel à la fin. Y consigner
chaque décision de classement, chaque correction avec les montants avant et après, et les
identifiants QBO rencontrés. Ce journal sert autant à retracer une écriture dans six mois
qu'à enrichir ce skill.

## Garde-fous

- Ne jamais publier une pièce sans avoir vérifié son absence dans QBO.
- Ne jamais écrire dans QBO sans accord explicite et préalable.
- Ne pas supprimer de pièces dans Dext : archiver, ce qui est réversible.
- Signaler les questions fiscales plutôt que de les trancher. Le rôle ici est de préparer
  proprement, pas de remplacer le comptable.
- Ne pas stocker le secret du proxy dans un fichier.
- Ne jamais saisir les identifiants de Gabriel sur un portail de prêteur ou de banque. Ouvrir
  la page dans le navigateur intégré, lui demander de s'y connecter, puis travailler dans
  cette page.
- Ne pas chercher un chemin de rechange au navigateur intégré. `curl`, l'extension Chrome et
  un Playwright monté à la main sont hors jeu, même quand le navigateur intégré donne du fil
  à retordre.
- **Sur un portail gouvernemental ou bancaire, aucun clic par script.** Pas de
  `querySelector` suivi d'un `.click()`, même pour un bouton qui a l'air inoffensif. Prendre
  une capture, lire le bouton à l'écran, cliquer aux coordonnées. Un script qui cherche
  « Calculer » par son texte a transmis une déclaration de TVQ que Gabriel avait demandé de
  ne pas envoyer, le 24 août 2026.
- Quand Gabriel dit « n'envoie pas », remplir s'arrête au dernier champ. Ne pas chercher à
  faire calculer, valider ou prévisualiser : ces boutons soumettent souvent.
- Ne pas inventer une valeur qu'un formulaire refuse. Si le portail rejette le chiffre sorti
  de QBO, s'arrêter et demander, plutôt que de substituer un montant qui a l'air raisonnable.
- Ne jamais dériver une ventilation de taxe d'un montant total. Une facture de Postes Canada
  peut porter une composante TVH : 14,975 % appliqué au total donne un chiffre faux. Lire la
  ventilation sur la pièce.
- Quand Gabriel dit « fais-les », c'est un ordre d'exécution complet, pas une invitation à
  préparer et à revenir avec des questions. Chercher soi-même les réponses dans l'historique
  QBO avant de demander.
- Ne pas attribuer un problème technique à la session ou au poste de Gabriel sans preuve.

## Fichiers de référence

- `references/fournisseurs.md` — compte de charge, code de taxe, devise QBO et mode de
  publication pour chaque fournisseur récurrent. Le consulter avant de classer.
- `references/qbo-proxy.md` — endpoints du proxy, authentification, requêtes prêtes à
  coller et identifiants QBO du dossier.
- `references/financements.md` — méthode de comptabilisation des avances et des prêts,
  contrats Merchant Growth et Shopify Capital, comptes, conventions de numérotation des
  écritures et dossiers ouverts.
- `references/paie.md` — écriture de paie Desjardins : nomenclature, formule du coût
  employeur, table structure division / service vers compte de charge, et comment relire un
  ancien rapport archivé dans QBO.
- `references/taxes-shopify.md` — écriture mensuelle des taxes Shopify : requête ShopifyQL,
  périmètre, gabarit des seize lignes et table des `TaxRateRef`.
