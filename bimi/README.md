# BIMI pour Lasclay — logo de marque dans la boîte de réception

BIMI (*Brand Indicators for Message Identification*) affiche le logo de Lasclay à côté de
l'expéditeur, dans la liste des messages. Ce n'est pas un réglage à cocher : c'est la
récompense d'une authentification de courriel serrée. Le logo n'apparaît que si le message
passe DMARC **et** que le domaine applique une politique stricte.

Ce dossier contient le logo prêt à publier ; `../bimi_check.js` mesure où on en est.

```
node bimi_check.js            # rapport complet sur lasclay.com
```

---

## 1. Où on en est (relevé DNS du 19 août 2026)

| Élément | État | Détail |
| --- | --- | --- |
| DNS | Porkbun | `curitiba/salvador/maceio/fortaleza.ns.porkbun.com` — c'est là que tout se joue |
| SPF | ✅ | `v=spf1 include:_spf.google.com ~all` |
| DKIM Google Workspace | ✅ | `google._domainkey.lasclay.com` |
| DKIM Klaviyo | ✅ | `kl` et `kl2._domainkey.lasclay.com` → SendGrid `u161779.wl030` |
| DMARC | ⚠️ | `p=none` — **bloquant pour BIMI** |
| BIMI | ❌ | aucun enregistrement |
| Logo SVG | ✅ | `bimi/lasclay-bimi.svg`, conforme au profil tiny-ps |
| Certificat VMC/CMC | ❌ | aucun — Gmail et Apple Mail n'afficheront rien sans lui |
| Expéditeur Shopify | ❌ | non authentifié — voir l'étape 1 |

Qui écrit aux clients, et sous quelle identité :

| Service | Expéditeur | Aligné DMARC ? |
| --- | --- | --- |
| Google Workspace (Missive, support, `hey@`, `admin@`) | `@lasclay.com` | oui — SPF + DKIM |
| Klaviyo (campagnes, automatisations) | `hey@lasclay.com` | oui — DKIM `kl`, retour d'enveloppe `mail.lasclay.com` |
| Shopify (confirmations de commande, expédition) | **`@shopifyemail.com`** | sans objet — ce n'est pas notre domaine |
| Omnisend | aucun envoi actif | — |

Le point important est le troisième : tant que le domaine expéditeur n'est pas authentifié
côté Shopify, Shopify réécrit l'adresse d'expédition. Les confirmations de commande — les
courriels que les clients ouvrent le plus — partent de `shopifyemail.com` et **n'afficheront
jamais** le logo de Lasclay, peu importe ce qu'on met dans le DNS de `lasclay.com`.

---

## 2. Ce que BIMI exige

1. **DMARC appliqué** sur le domaine de l'adresse *From* : `p=quarantine` avec `pct=100`,
   ou `p=reject`. `p=none` ne compte pas, et un `pct` inférieur à 100 non plus.
2. **Un logo SVG** au profil *SVG Tiny Portable/Secure* (`tiny-ps`) : carré, moins de 32 Ko,
   fond plein, aucun lien externe, un `<title>` en premier élément.
3. **Une URL HTTPS stable** pour ce fichier — elle est inscrite dans le certificat et ne doit
   pas bouger tant qu'il est valide.
4. **Un certificat de marque** pour les grosses boîtes :

| Boîte de réception | Sans certificat | Avec CMC | Avec VMC |
| --- | --- | --- | --- |
| Gmail | rien | logo | logo + coche bleue |
| Apple Mail | rien | rien | logo |
| Yahoo / AOL | logo | logo | logo |
| Fastmail | logo | logo | logo |
| La Poste | logo (vérification manuelle) | logo | logo |

Autrement dit : publier l'enregistrement BIMI sans certificat donne déjà le logo chez
Yahoo, AOL et Fastmail, gratuitement. Gmail — l'essentiel du volume pour une marque
québécoise en vente directe — demande un CMC ou un VMC.

---

## 3. La marche à suivre

### Étape 1 — authentifier le domaine expéditeur de Shopify

Sans ça, la moitié du bénéfice est perdue d'avance.

Admin Shopify → **Paramètres → Notifications → Adresse d'expédition** → *Authentifier votre
domaine*. Shopify affiche quatre enregistrements CNAME (dont `shopifyemail._domainkey`) à
créer chez Porkbun. Les valeurs sont propres à la boutique : les recopier telles quelles.

Ajouter aussi Shopify au SPF, en modifiant l'enregistrement TXT existant à la racine :

```
v=spf1 include:_spf.google.com include:shopifyemail.com ~all
```

⚠️ Un seul enregistrement SPF par domaine. Modifier celui qui existe, ne pas en créer un
deuxième — deux SPF font échouer les deux.

Vérifier ensuite qu'une commande test arrive bien avec un *From* en `@lasclay.com` :

```
node bimi_check.js        # « shopifyemail » doit apparaître dans les sélecteurs trouvés
```

### Étape 2 — lire les rapports DMARC avant de durcir

`rua=mailto:hey@lasclay.com` est déjà en place, mais les rapports agrégés sont des XML
compressés illisibles à l'œil. Brancher un lecteur gratuit (Postmark DMARC Digests ou
dmarcian) sur une adresse dédiée, puis **attendre deux à quatre semaines** de trafic
normal — une campagne Klaviyo, un cycle complet de commandes.

On cherche une seule chose : est-ce qu'un expéditeur légitime échoue encore ? Passer à
`p=quarantine` avec un service oublié, c'est envoyer ses propres courriels dans les
indésirables.

### Étape 3 — durcir DMARC

Quand les rapports sont propres, chez Porkbun, modifier le TXT `_dmarc` :

```
Type   TXT
Hôte   _dmarc
Valeur v=DMARC1; p=quarantine; pct=100; rua=mailto:hey@lasclay.com; fo=1; adkim=r; aspf=r
```

Rampe plus prudente si on préfère : `pct=25`, puis `50`, puis `100` à une semaine
d'intervalle. **BIMI ne compte qu'à `pct=100`** — la rampe est une précaution, pas une
destination.

### Étape 4 — publier le logo à une adresse stable

Le SVG est déjà servi par le proxy général (`server.js`, route publique sans secret), donc
il suffit de fusionner cette branche dans `main` pour que Render le déploie :

```
https://general-proxy-5muf.onrender.com/bimi/logo.svg
https://general-proxy-5muf.onrender.com/bimi/logo-inverse.svg
```

Deux réserves à peser avant de figer cette URL dans un certificat : l'adresse ne porte pas
le nom de la marque, et le plan gratuit de Render met le service en veille (première requête
lente). Les deux solutions, par ordre de préférence :

- **`bimi.lasclay.com`** — un CNAME chez Porkbun vers le service Render, déclaré comme
  domaine personnalisé dans Render. Adresse propre, sous notre contrôle, gratuite.
- **Un fichier statique dans le thème Shopify** — Shopify sert les SVG du dossier `assets`
  d'un thème, mais l'URL contient l'identifiant du thème et change quand on change de
  thème. À éviter pour une adresse qui doit tenir des années.

Vérifier le résultat :

```
curl -I https://bimi.lasclay.com/bimi/logo.svg    # doit répondre Content-Type: image/svg+xml
```

### Étape 5 — publier l'enregistrement BIMI

Chez Porkbun :

```
Type   TXT
Hôte   default._bimi
Valeur v=BIMI1; l=https://bimi.lasclay.com/bimi/logo.svg;
```

À ce stade, le logo apparaît chez Yahoo, AOL et Fastmail. Rien chez Gmail : il manque le
certificat.

### Étape 6 — le certificat, si on veut Gmail

Deux chemins, à choisir selon l'état de la marque de commerce :

| | CMC (*Common Mark Certificate*) | VMC (*Verified Mark Certificate*) |
| --- | --- | --- |
| Condition | logo en usage public continu depuis 12 mois | marque de commerce **enregistrée** |
| Preuve | archives web du site (le papillon est en ligne depuis des années) | certificat d'enregistrement |
| Prix indicatif | ~650–1 100 $US / an | ~750–1 750 $US / an |
| Délai d'émission | 1 à 3 semaines | 2 à 4 semaines |
| Gmail | logo | logo + coche bleue |
| Apple Mail | rien | logo |

Émetteurs : DigiCert ou Entrust (les deux autorités de vérification reconnues).

Pour un VMC, la marque doit être enregistrée auprès d'un des offices reconnus — **l'OPIC
canadien en fait partie**. Si « Lasclay » et le papillon ne sont pas encore déposés, compter
un dépôt à l'OPIC (quelques centaines de dollars, mais 12 à 24 mois de traitement) : c'est
un projet parallèle, pas un préalable. **Le CMC est le bon choix pour commencer** — même
logo dans Gmail, sans coche bleue, sans attendre l'OPIC.

Une fois le certificat en main (fichier `.pem`), le déposer à côté du SVG et compléter
l'enregistrement :

```
v=BIMI1; l=https://bimi.lasclay.com/bimi/logo.svg; a=https://bimi.lasclay.com/bimi/lasclay.pem;
```

### En prime, gratuit — Apple Business Connect

Apple Mail affiche aussi un logo de marque via **Apple Business Connect**, sans BIMI et sans
certificat : on inscrit l'entreprise, on vérifie le domaine, on téléverse le logo. Aucun lien
avec ce qui précède, et ça couvre les clients sur iPhone. À faire en parallèle.

---

## 4. Les fichiers

| Fichier | Ce que c'est |
| --- | --- |
| `lasclay-bimi.svg` | Le papillon `#333333` sur fond blanc — fidèle à l'usage actuel de la marque. **C'est celui à faire certifier** : un CMC comme un VMC compare le logo à celui qu'on utilise publiquement. |
| `lasclay-bimi-inverse.svg` | Le même en blanc sur `#333333`. Se détache mieux en pastille ronde, mais s'écarte de l'usage établi — à ne retenir que si l'autorité de certification l'accepte. |

Les deux sont tracés depuis le favicon officiel (1081 × 1081), en `viewBox` carré de 512,
8,1 Ko chacun, marque cadrée à 74 % de la toile pour survivre au rognage circulaire que
Gmail applique. `node bimi_check.js` valide la conformité tiny-ps à chaque exécution.

Pour visualiser un changement avant de le publier, ouvrir le SVG dans un navigateur : c'est
exactement ce que la boîte de réception rendra.

## 5. Ordre de grandeur

| Étape | Effort | Coût |
| --- | --- | --- |
| 1. Authentifier Shopify | 30 min + propagation DNS | 0 |
| 2. Lire les rapports DMARC | 15 min de mise en place, 2–4 semaines d'attente | 0 |
| 3. Durcir DMARC | 5 min | 0 |
| 4–5. Publier logo + enregistrement | 30 min | 0 |
| 6. CMC | 1 à 3 semaines | ~650–1 100 $US / an |

Les étapes 1 à 5 se font en une soirée de travail réparties sur un mois d'observation, et
donnent déjà le logo chez Yahoo, AOL et Fastmail. Seule l'étape 6 coûte de l'argent — c'est
elle qui ouvre Gmail.
