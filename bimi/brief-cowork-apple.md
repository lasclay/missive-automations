# Brief pour un agent au navigateur — Apple Branded Mail pour Lasclay

Ce fichier est un **brief à coller tel quel** dans Cowork ou dans l'extension Chrome de
Claude, au début de la session. Il est volontairement autonome : il ne suppose aucun accès au
dépôt `missive-automations`, parce que l'extension Chrome n'en a pas. Toutes les valeurs
nécessaires sont dedans.

**Avant de coller :** télécharger `bimi/lasclay-apple-1081.png` sur la machine (typiquement
dans `~/Téléchargements`) — il faudra le sélectionner dans un formulaire de téléversement.

---

## ▼ À COPIER À PARTIR D'ICI ▼

Tu pilotes mon navigateur. Je suis déjà connecté à Porkbun. Mission : inscrire Lasclay à
**Apple Branded Mail** pour que notre logo apparaisse dans Apple Mail.

### Contexte — ce qui est déjà fait, ne le refais pas

Lasclay est une marque québécoise de produits isolés à la soie d'asclépiade, vendue sur
`lasclay.com` (Shopify). Le logo est un papillon gris foncé.

L'authentification courriel du domaine est déjà en place et **vérifiée aujourd'hui** :

| | Valeur en vigueur |
| --- | --- |
| SPF | `v=spf1 include:_spf.google.com ~all` |
| DKIM | `google._domainkey` (Google Workspace), `kl._domainkey` et `kl2._domainkey` (Klaviyo) |
| DMARC | `v=DMARC1; p=quarantine; pct=100; rua=mailto:hey@lasclay.com; fo=1; adkim=r; aspf=r` |
| BIMI | `default._bimi` → `https://lasclay.com/cdn/shop/files/lasclay-bimi.svg` |

Apple exige DKIM plus DMARC à `quarantine` ou `reject` : **les deux conditions sont
remplies**. Tu n'as aucun réglage d'authentification à changer.

Apple Branded Mail est **indépendant de BIMI** : il ignore l'enregistrement `default._bimi` et
n'utilise pas le SVG. Ne va pas modifier l'enregistrement BIMI, il n'a rien à voir avec cette
tâche.

### Informations à fournir aux formulaires

| Champ | Valeur |
| --- | --- |
| Dénomination légale | **Les produits Lasclay Inc.** |
| Adresse | 1286 ave De La Ronde, Québec (Québec) G1J 4B7, Canada |
| Site web | `https://lasclay.com` |
| Domaine à enregistrer | `lasclay.com` — **celui-là et rien d'autre** |
| Logo à téléverser | `lasclay-apple-1081.png`, dans mes téléchargements — PNG carré 1081 × 1081, fond blanc opaque |

### Ce que tu ne fais jamais

- **Tu ne saisis aucun mot de passe, aucun code de double authentification.** Quand un écran
  de connexion ou un code apparaît, tu t'arrêtes, tu me le dis, tu attends que je l'aie fait,
  puis tu reprends.
- **Tu ne modifies ni ne supprimes aucun enregistrement DNS existant.** Tu n'as qu'une seule
  chose à créer chez Porkbun : le TXT de vérification qu'Apple te donnera. Les MX, le A, les
  TXT de Google et Klaviyo, les CNAME `kl`, `kl2` et `mail` : on n'y touche pas. Y toucher
  coupe le courriel de l'entreprise.
- **Tu n'enregistres pas `mail.lasclay.com`** (c'est le retour d'enveloppe de Klaviyo, pas une
  adresse d'expédition) **ni `shopifyemail.com`** (ce domaine ne nous appartient pas).
- **Tu n'achètes rien** et tu ne souscris à aucun forfait.
- Devant un avertissement que tu ne comprends pas, ou un écran qui ne correspond pas à ce
  brief : tu t'arrêtes et tu me demandes. Ne devine pas.

### Les étapes

**1. Compte et vérification de l'entreprise**

Ouvre `businessconnect.apple.com`. Si je ne suis pas connecté, dis-le-moi et attends.

Inscris l'entreprise avec les informations du tableau ci-dessus. Apple va demander de prouver
qu'elle existe et que je la représente — document d'entreprise, appel téléphonique, ou autre
selon le parcours. **Tu remplis ce que tu peux, tu me passes la main dès qu'il faut un
document ou une action hors navigateur.** C'est l'étape la plus imprévisible ; les suivantes
sont mécaniques.

**2. Ajouter le domaine**

Section **Branded Mail** → ajouter un domaine → `lasclay.com`.

**3. Le TXT de vérification, chez Porkbun**

Apple affiche un enregistrement TXT de vérification. **Recopie-le-moi d'abord intégralement
dans la conversation** (le host et la valeur), pour qu'on en garde trace, avant d'aller le
créer.

Puis, dans un autre onglet : `porkbun.com` → **Account → Domain Management** → `lasclay.com`
→ **DNS Records**.

Deux règles Porkbun, la deuxième est un piège classique :
- Le champ **Host** ne contient **que le sous-domaine**. Pour la racine, on le laisse
  **vide** — on n'écrit jamais `lasclay.com` dedans, Porkbun l'ajoute.
- TTL : laisser 600.

Crée le TXT. Avant de quitter la page, relis la liste complète et confirme-moi qu'aucune
autre ligne n'a bougé.

⏳ **La fenêtre d'Apple est de 14 jours calendaires.** Si l'enregistrement n'est pas créé et
vérifié dans ce délai, tout est à recommencer depuis l'étape 2. Fais-le le jour même.

**4. Vérifier**

Retourne dans Business Connect, clique **Verify**. Si Apple ne voit pas encore
l'enregistrement, ce n'est **pas** un échec : la propagation prend de quelques minutes à une
heure. Attends et réessaie — jusqu'à trois fois espacées. Si ça ne passe toujours pas,
arrête-toi et dis-le-moi avec la valeur exacte que tu as saisie, qu'on la compare à celle
d'Apple.

**5. Téléverser le logo**

Sélectionne `lasclay-apple-1081.png` dans mes téléchargements. C'est un PNG carré à fond
blanc opaque : c'est voulu, ne cherche pas une version transparente ni le SVG.

**6. Soumettre**

Soumets pour revue. Apple examine la marque **et** le logo, jusqu'à 7 jours ouvrables.

### Ce que tu me rends à la fin

Un compte rendu court avec : le statut de la vérification de l'entreprise, le host et la
valeur exacts du TXT Apple, la confirmation que le TXT est créé chez Porkbun et qu'aucune
autre ligne n'a bougé, le statut de la vérification du domaine, la confirmation du
téléversement, et la date de soumission.

Si tu t'es arrêté en cours de route, dis-moi précisément à quelle étape et ce que tu attends
de moi.

## ▲ À COPIER JUSQU'ICI ▲

---

## Après la session — ce qui reste à faire côté dépôt

1. Reporter les valeurs dans le tableau du bas de `bimi/apple-branded-mail.md`.
2. Passer la ligne 6 du `bimi/JOURNAL.md` à `en attente` avec la date de soumission.
3. Une fois approuvé : envoyer un courriel de `hey@lasclay.com` vers une adresse iCloud et
   l'ouvrir sur iOS 18.2 ou plus récent, macOS Sequoia 15.2, ou `icloud.com`. Le logo
   s'applique à la **livraison** — un courriel déjà reçu ne changera pas rétroactivement.

## Ce que cette étape ne réglera pas

- **Les confirmations de commande Shopify** partent de `shopifyemail.com` : ni Branded Mail
  ni BIMI ne peuvent les marquer. C'est l'étape 1 du `README.md`, et c'est celle qui touche
  les courriels les plus ouverts.
- **Gmail** continue d'exiger un CMC ou un VMC. Branded Mail est propre à Apple.
