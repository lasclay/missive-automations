# Brief de session — terminer le chantier BIMI de Lasclay

Brief **à coller tel quel** dans Cowork ou dans l'extension Chrome de Claude. Autonome : il
ne suppose aucun accès au dépôt `missive-automations`, parce que l'extension Chrome n'en a
pas. Toutes les valeurs sont dedans.

Il couvre les deux chantiers qui restent : **authentifier l'expéditeur Shopify** (partie A) et
**terminer Apple Branded Mail** (partie B). Compter une heure au clavier.

**Avant de coller**, avoir sur la machine :
- `lasclay-apple-1081.png` — le logo à téléverser chez Apple ;
- `3. Certificat de constitution Lasclay.pdf` — la pièce de vérification d'organisation.

Et être connecté d'avance à **l'admin Shopify**, **Porkbun** et **Apple Business**
(`admin@lasclay.com`).

---

## ▼ À COPIER À PARTIR D'ICI ▼

Tu pilotes mon navigateur. Deux chantiers à terminer pour que le logo de Lasclay apparaisse
dans les boîtes de réception. Ils sont indépendants : fais la partie A, puis la partie B.
Si ma session Apple est déjà ouverte et pas celle de Shopify, tu peux inverser.

### Le contexte en trente secondes

Lasclay est une marque québécoise de produits isolés à la soie d'asclépiade, vendue sur
`lasclay.com` (Shopify). Le logo est un papillon gris foncé. Personne morale :
**Les Produits Lasclay inc**, NEQ 1177782068.

Le montage BIMI est déjà en place et **vérifié aujourd'hui** — n'y touche pas :

| | Valeur en vigueur |
| --- | --- |
| SPF (racine) | `v=spf1 include:_spf.google.com ~all` |
| DKIM | `google._domainkey` (Google Workspace), `kl._domainkey` et `kl2._domainkey` (Klaviyo) |
| DMARC | `v=DMARC1; p=quarantine; pct=100; rua=mailto:hey@lasclay.com; fo=1; adkim=r; aspf=r` |
| BIMI | `default._bimi` → `https://lasclay.com/cdn/shop/files/lasclay-bimi.svg` |
| Vérification Apple | `apple-domain-verification=CsPZJhYoQ93csEK7` (racine) |
| Autres TXT racine | `google-site-verification=…`, `klaviyo-site-verification=RhpPJR` |
| MX | 5 serveurs Google |

Le DNS est chez **Porkbun**, environ 27 enregistrements.

### Ce que tu ne fais jamais — vaut pour les deux parties

- **Tu ne crées jamais un deuxième enregistrement SPF.** Il y en a exactement un, à la racine.
  S'il faut le changer, tu le **modifies**. Deux SPF font échouer les deux, et tout le courriel
  de l'entreprise avec. C'est l'erreur la plus grave possible dans cette session.
- **Tu ne modifies ni ne supprimes aucun enregistrement du tableau ci-dessus**, sauf le SPF en
  partie A. Surtout pas les **MX** (ça couperait la réception) ni
  **`apple-domain-verification`** (Apple revalide périodiquement ; le supprimer ferait
  retomber Branded Mail).
- **Tu ne saisis aucun mot de passe ni code à deux facteurs.** Écran de connexion ou code →
  tu t'arrêtes, tu me le dis, tu attends que je le fasse, puis tu reprends.
- **Tu n'achètes rien**, tu ne souscris à aucun forfait, tu ne changes aucun réglage qui n'est
  pas décrit ici.
- **Tu ne soumets rien pour révision sans me montrer le dossier d'abord** (partie B).
- Écran qui ne correspond pas à ce brief, avertissement que tu ne comprends pas : tu
  t'arrêtes et tu me demandes. Ne devine pas.

**Le piège Porkbun**, qui revient à chaque fois : le champ **Host** ne contient que le
sous-domaine. Racine = champ **vide**. Pour `shopifyemail._domainkey`, tu écris
`shopifyemail._domainkey` — **jamais** `shopifyemail._domainkey.lasclay.com`, Porkbun ajoute
le domaine lui-même. TTL : 600.

---

# PARTIE A — authentifier l'expéditeur Shopify

C'est l'étape qui rapporte le plus, et la plus délicate. Aujourd'hui Shopify réécrit notre
adresse d'expédition : les confirmations de commande et les avis d'expédition partent de
`shopifyemail.com`, un domaine qui ne nous appartient pas. Aucun logo ne peut s'y afficher, et
DMARC ne s'y applique pas. Ces courriels sont ceux que nos clients ouvrent le plus.

`shopifyemail._domainkey` n'existe pas encore dans notre DNS — vérifié aujourd'hui.

### A1. Récupérer les enregistrements chez Shopify

`admin.shopify.com` → boutique **Lasclay** → **Paramètres → Notifications** → section
**Adresse d'expédition** (*Sender email*) → **Authentifier votre domaine**
(*Authenticate your domain*).

Shopify affiche des enregistrements DNS à créer — **typiquement quatre CNAME**, dont un
`shopifyemail._domainkey`. Le nombre peut varier : prends-les tous.

**Recopie-les-moi intégralement dans la conversation** — chaque host, chaque valeur, en
texte — **avant** d'aller chez Porkbun. Ces valeurs sont propres à notre boutique, et si la
session expire en cours de route je ne veux pas les reperdre.

Note aussi si Shopify demande d'ajouter `include:shopifyemail.com` au SPF : selon les
parcours, il le mentionne ou pas.

### A2. Créer les CNAME chez Porkbun

`porkbun.com` → **Account → Domain Management** → `lasclay.com` → **DNS Records**.

Crée les CNAME un par un, exactement comme Shopify les donne. Rappel du piège Host ci-dessus.

### A3. Modifier le SPF — l'étape à ne pas rater

Trouve la ligne **TXT** à la racine (champ Host vide) qui commence par `v=spf1`. Clique le
crayon pour la **modifier**. Ne la supprime pas pour la recréer. N'en ajoute pas une seconde.

Valeur actuelle, exactement :
```
v=spf1 include:_spf.google.com ~all
```

Nouvelle valeur, exactement :
```
v=spf1 include:_spf.google.com include:shopifyemail.com ~all
```

Enregistre, puis **relis la ligne dans l'interface** et confirme-moi la valeur que tu y vois.

### A4. Contrôler la zone avant de quitter Porkbun

Relis la liste complète et confirme-moi trois choses :
1. il y a **un seul** TXT commençant par `v=spf1` à la racine ;
2. les MX, `apple-domain-verification`, `google._domainkey`, `kl._domainkey`,
   `kl2._domainkey`, `mail`, `_dmarc` et `default._bimi` sont intacts ;
3. les nouveaux CNAME Shopify apparaissent.

### A5. Vérifier chez Shopify

Retourne dans l'admin et clique **Vérifier**. Si Shopify ne voit pas encore les
enregistrements, ce n'est **pas** un échec : la propagation prend de quelques minutes à une
heure. Attends et réessaie, jusqu'à trois fois espacées.

Si ça ne passe toujours pas, arrête-toi et donne-moi côte à côte ce que Shopify demande et ce
que tu as saisi. C'est presque toujours un host qui a reçu le domaine complet au lieu du seul
sous-domaine.

Une fois vérifié, l'adresse d'expédition doit afficher une adresse `@lasclay.com` sans mention
de réécriture vers `shopifyemail.com`.

---

# PARTIE B — terminer Apple Branded Mail

Apple Branded Mail est **indépendant de BIMI** : il ignore l'enregistrement `default._bimi` et
n'utilise pas le SVG. C'est le seul chemin vers Apple Mail tant qu'on n'a pas de certificat
VMC. Gratuit.

### B0. Constater l'état avant d'agir

`businessconnect.apple.com` (le service s'appelle maintenant **Apple Business** ; l'adresse et
la fonction n'ont pas changé). Si je ne suis pas connecté, dis-le-moi et attends — je me
connecte avec `admin@lasclay.com`.

**Ne présume pas de ce qui est fait.** Fais le tour et dis-moi, poste par poste, ce que
l'interface montre :

| Poste | Ce qu'on croit savoir | À constater |
| --- | --- | --- |
| Compte | créé, `admin@lasclay.com`, fuseau Canada/Eastern | ✓ ? |
| Vérification du domaine `lasclay.com` | ✅ réussie, pastille verte | toujours verte ? |
| Vérification de l'organisation — méthode 1 | ✅ le domaine | ✓ ? |
| Vérification de l'organisation — méthode 2 | **pas faite** — c'est la première tâche | statut ? |
| Logo Branded Mail | **probablement pas téléversé** | téléversé ou non ? |
| Soumission pour révision | pas faite | statut ? |

Apple exige **deux** méthodes de vérification de l'organisation, à compléter dans les
**60 jours** à partir du 25 août 2026 — sinon Apple supprime l'organisation et ses données.

### B1. Vérifier la cohérence de l'adresse *avant* de soumettre

Le compte Apple déclare **408 rue Riopelle, Québec G1C 6L3**.

Un réviseur d'Apple consulte le registre public. Si le siège déclaré au Registraire des
entreprises du Québec (REQ) ne correspond pas à cette adresse, c'est là que le dossier casse —
pas sur le certificat. Ouvre le registre du REQ, cherche le NEQ **1177782068**, et compare
l'adresse du siège avec celle du compte Apple. **Dis-moi ce que tu trouves.**

- Si elles concordent → continue en B2.
- Si elles diffèrent → **arrête-toi et dis-le-moi**. On corrige le champ Apple avant de
  soumettre ; une minute de travail contre des jours de rejet.

### B2. Téléverser la pièce de la méthode 2

Sous **Business Registration** (ou l'intitulé équivalent de la deuxième méthode), téléverse le
fichier `3. Certificat de constitution Lasclay.pdf` de mes téléchargements.

C'est un document du Registraire des entreprises qui établit le nom légal
**LES PRODUITS LASCLAY INC.**, la constitution le 27 juin 2022, et le NEQ 1177782068. Il est
volontairement préféré au bail commercial : un bail prouve un loyer, pas l'existence de la
personne morale.

Si Apple propose plutôt un numéro D-U-N-S ou un numéro fiscal et que le formulaire refuse le
PDF, arrête-toi et dis-le-moi.

### B3. Téléverser le logo Branded Mail

Section **Branded Mail** → téléverse `lasclay-apple-1081.png` de mes téléchargements.

C'est un PNG carré 1081 × 1081 à fond blanc opaque. Apple demande du JPG, PNG ou HEIF, carré,
entre 1024 et 4864 px : ce fichier est conforme. **N'envoie pas le SVG** et ne cherche pas une
version transparente — l'aplat blanc est voulu.

### B4. Me montrer le dossier, puis soumettre

Avant de toucher à **Send for Review** : fais-moi un résumé de ce que le dossier contient —
nom légal, adresse, les deux méthodes de vérification et leur statut, le logo téléversé. Je te
donne le feu vert, et **c'est seulement là** que tu soumets.

Après soumission : jusqu'à 5 jours ouvrables pour la vérification de l'organisation, puis
jusqu'à 7 jours ouvrables pour la revue de Branded Mail.

---

# PARTIE C — ce que tu me rends à la fin

Un compte rendu structuré, sans enjoliver. Si une chose n'a pas été faite, dis-le : un tableau
qui coche « fait » à tort est pire que pas de tableau.

**Partie A**
- la liste complète des enregistrements demandés par Shopify (host et valeur) ;
- la confirmation que chacun est créé chez Porkbun ;
- la valeur exacte du SPF après modification ;
- le résultat des trois contrôles de A4 ;
- le statut de vérification affiché par Shopify.

**Partie B**
- l'état constaté en B0, poste par poste ;
- ce que dit le REQ sur l'adresse du siège, comparé au compte Apple ;
- le statut de la méthode 2 après téléversement ;
- la confirmation du téléversement du logo ;
- si tu as soumis : la date. Sinon : ce qui bloque.

**Et si tu t'es arrêté en route** : à quelle étape exactement, et ce que tu attends de moi.

## ▲ À COPIER JUSQU'ICI ▲

---

## Après la session — côté dépôt

```
node bimi_check.js
```

Ce qui doit avoir changé : `shopifyemail` apparaît dans les sélecteurs DKIM trouvés, et
l'avertissement sur l'expéditeur Shopify disparaît du bilan. C'est ce test qui tranche, pas
un tableau de fin de session.

Puis reporter les valeurs dans la section D de `dns-cible.md`, et mettre `JOURNAL.md` à jour :
ligne 1 à `fait`, ligne 6 à `en attente` avec la date de soumission.

## Ce que cette session ne réglera pas

- **Gmail.** Il exige un certificat CMC (~650–1 100 $US/an, possible dès maintenant sur nos
  cinq ans d'usage) ou VMC (~750–1 750 $US/an, qui suppose d'abord le dépôt du papillon à
  l'OPIC). Décision d'argent, hors périmètre d'une session au navigateur.
- **Le dépôt du papillon à l'OPIC** (~491 $CA la première classe). C'est le geste dont le
  compteur court — la demande de 2020 n'a abouti qu'en 2025 — mais il demande un conseil en PI
  et un paiement.

## Le test qui dit si ça marche

Envoyer un courriel depuis `hey@lasclay.com` vers une adresse **Yahoo** ou **Fastmail**. Ce
sont les seules boîtes qui affichent le logo sans certificat. Le logo s'applique à la
livraison : un courriel déjà reçu ne changera pas rétroactivement, il faut un nouvel envoi.
