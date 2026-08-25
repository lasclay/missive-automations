# Brief pour un agent au navigateur — authentifier l'expéditeur Shopify

Brief **à coller tel quel** dans Cowork ou dans l'extension Chrome de Claude. Autonome : il ne
suppose aucun accès au dépôt, parce que l'extension Chrome n'en a pas.

C'est l'étape qui décide si les confirmations de commande de Lasclay afficheront un jour le
logo. Compter **30 minutes**, plus la propagation DNS.

---

## ▼ À COPIER À PARTIR D'ICI ▼

Tu pilotes mon navigateur. Je suis déjà connecté à l'admin Shopify de Lasclay et à Porkbun.
Mission : **authentifier le domaine expéditeur de Shopify** pour que nos courriels
transactionnels partent de `@lasclay.com` au lieu de `@shopifyemail.com`.

### Le problème, en une phrase

Aujourd'hui, Shopify réécrit notre adresse d'expédition : les confirmations de commande et les
avis d'expédition partent de `shopifyemail.com`, un domaine qui ne nous appartient pas. Aucun
logo de marque ne peut s'y afficher, et l'alignement DMARC ne s'y applique pas. Authentifier
le domaine règle les deux.

### L'état DNS actuel de lasclay.com — vérifié aujourd'hui

Chez **Porkbun**. Environ 27 enregistrements. Ceux qui comptent pour toi :

| Type | Host | Valeur |
| --- | --- | --- |
| TXT | *(racine)* | `v=spf1 include:_spf.google.com ~all` ← **c'est celui-ci que tu vas modifier** |
| TXT | *(racine)* | `apple-domain-verification=CsPZJhYoQ93csEK7` |
| TXT | *(racine)* | `google-site-verification=…` et `klaviyo-site-verification=RhpPJR` |
| TXT | `google._domainkey` | clé DKIM Google Workspace |
| CNAME | `kl._domainkey`, `kl2._domainkey`, `mail` | Klaviyo via SendGrid |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; pct=100; …` |
| TXT | `default._bimi` | `v=BIMI1; l=https://lasclay.com/cdn/shop/files/lasclay-bimi.svg;` |
| MX | *(racine)* | 5 serveurs Google |

`shopifyemail._domainkey` **n'existe pas** — c'est bien ce qu'on vient créer.

### Ce que tu ne fais jamais

- **Tu ne crées pas un deuxième enregistrement SPF.** Il y en a exactement un, à la racine, et
  tu le **modifies**. Deux SPF font échouer les deux, et tout le courriel de l'entreprise avec.
  C'est l'erreur la plus grave possible dans cette tâche.
- **Tu ne touches à aucun des enregistrements du tableau ci-dessus**, sauf le SPF. Surtout pas
  les MX (ça couperait la réception) ni `apple-domain-verification` (Apple revalide
  périodiquement, le supprimer ferait retomber Branded Mail).
- **Tu ne saisis aucun mot de passe ni code à deux facteurs.** Écran de connexion → tu
  t'arrêtes, tu me le dis, tu attends.
- **Tu ne changes aucun autre réglage dans Shopify** — pas les modèles de courriel, pas
  l'adresse du compte, rien d'autre que l'authentification du domaine.
- Écran qui ne correspond pas à ce brief, avertissement que tu ne comprends pas : tu
  t'arrêtes et tu me demandes. Ne devine pas.

### Les étapes

**1. Récupérer les enregistrements chez Shopify**

`admin.shopify.com` → boutique **Lasclay** → **Paramètres → Notifications** → section
**Adresse d'expédition** (*Sender email*) → **Authentifier votre domaine**
(*Authenticate your domain*).

Shopify affiche des enregistrements DNS à créer — **typiquement quatre CNAME**, dont un
`shopifyemail._domainkey`. Le nombre peut varier selon la boutique : prends-les tous, quel
qu'en soit le nombre.

**Recopie-les-moi intégralement dans la conversation** — chaque host et chaque valeur, en
texte — avant d'aller chez Porkbun. Ces valeurs sont propres à notre boutique et je veux en
garder trace au cas où la session tourne mal.

Note aussi si Shopify demande d'ajouter `include:shopifyemail.com` au SPF : selon les
parcours, il le mentionne ou pas.

**2. Créer les CNAME chez Porkbun**

`porkbun.com` → **Account → Domain Management** → `lasclay.com` → **DNS Records**.

Deux règles Porkbun, la seconde est le piège classique :
- Le champ **Host** ne contient **que le sous-domaine**. Pour `shopifyemail._domainkey`, tu
  écris `shopifyemail._domainkey` — **jamais** `shopifyemail._domainkey.lasclay.com`, Porkbun
  ajoute le domaine lui-même.
- TTL : laisser 600.

Crée les CNAME un par un, exactement comme Shopify les donne.

**3. Modifier le SPF — l'étape délicate**

Trouve la ligne **TXT** à la racine (champ Host vide) qui commence par `v=spf1`. Clique le
crayon pour la **modifier**. Ne la supprime pas pour la recréer, et n'en ajoute pas une
seconde.

Valeur actuelle, exactement :
```
v=spf1 include:_spf.google.com ~all
```

Nouvelle valeur, exactement :
```
v=spf1 include:_spf.google.com include:shopifyemail.com ~all
```

Enregistre, puis **relis la ligne dans l'interface** et confirme-moi la valeur que tu y vois.

**4. Contrôler la zone avant de quitter**

Relis la liste complète des enregistrements et confirme-moi trois choses :
- il y a **un seul** TXT commençant par `v=spf1` à la racine ;
- les MX, `apple-domain-verification`, `google._domainkey`, `kl._domainkey`, `kl2._domainkey`,
  `mail`, `_dmarc` et `default._bimi` sont intacts ;
- les nouveaux CNAME Shopify apparaissent.

**5. Vérifier chez Shopify**

Retourne dans l'admin Shopify et clique **Vérifier**. Si Shopify ne voit pas encore les
enregistrements, ce n'est **pas** un échec : la propagation Porkbun prend de quelques minutes
à une heure. Attends et réessaie, jusqu'à trois fois espacées.

Si ça ne passe toujours pas, arrête-toi et donne-moi, côte à côte, ce que Shopify demande et
ce que tu as saisi chez Porkbun — c'est presque toujours un host qui a reçu le domaine complet
au lieu du seul sous-domaine.

**6. Confirmer le résultat**

Une fois vérifié, l'adresse d'expédition dans Shopify doit afficher une adresse `@lasclay.com`
sans mention de réécriture vers `shopifyemail.com`.

### Ce que tu me rends à la fin

La liste complète des enregistrements que Shopify a demandés (host et valeur), la confirmation
que chacun est créé chez Porkbun, la valeur exacte du SPF après modification, le résultat des
trois contrôles de l'étape 4, et le statut de vérification côté Shopify.

Si tu t'es arrêté en route : à quelle étape, et ce que tu attends de moi.

## ▲ À COPIER JUSQU'ICI ▲

---

## Après la session — côté dépôt

```
node bimi_check.js
```

`shopifyemail` doit apparaître dans les sélecteurs DKIM trouvés, et l'avertissement sur
l'expéditeur Shopify doit disparaître du bilan. Reporter ensuite les valeurs dans la
section D de `dns-cible.md` et passer la ligne 1 du `JOURNAL.md` à `fait`.

## Pourquoi cette étape ne se fait pas depuis une session distante

Vérifié le 2026-08-25 : l'API Admin de Shopify n'expose **rien** sur l'authentification du
domaine expéditeur — ni requête ni mutation, sur les ~470 champs du schéma. Les quatre valeurs
n'existent que dans l'interface d'administration. Et il n'y a pas de clé d'API Porkbun dans
l'environnement, donc aucune écriture DNS possible sans navigateur.
