# BIMI pour Lasclay — logo de marque dans la boîte de réception

BIMI (*Brand Indicators for Message Identification*) affiche le logo de Lasclay à côté de
l'expéditeur, dans la liste des messages. Ce n'est pas un réglage à cocher : c'est la
récompense d'une authentification de courriel serrée. Le logo n'apparaît que si le message
passe DMARC **et** que le domaine applique une politique stricte.

Ce dossier contient les logos prêts à publier ; `../bimi_check.js` mesure où on en est.

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
| Marque de commerce | ⚠️ | **LASCLAY**, TMA1285531, OPIC, enregistrée le 2025-01-24 (exp. 2035-01-24), titulaire Les produits Lasclay Inc. — mais en **caractères standard**, donc le papillon n'est pas couvert (voir l'étape 8) |
| Certificat VMC/CMC | ❌ | aucun — c'est Gmail, et seulement Gmail, qui l'exige (Apple passe par l'étape 6) |
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
| Apple Mail | *(voir ci-dessous)* | idem | logo |
| Yahoo / AOL | logo | logo | logo |
| Fastmail | logo | logo | logo |
| La Poste | logo (vérification manuelle) | logo | logo |

Autrement dit : publier l'enregistrement BIMI sans certificat donne déjà le logo chez
Yahoo, AOL, Fastmail et La Poste, gratuitement.

Apple Mail est un cas à part, et une bonne nouvelle : depuis iOS 18.2, Apple a son propre
système — **Branded Mail**, dans Apple Business Connect — qui affiche le logo sans BIMI et
**sans certificat**, gratuitement (étape 6). Le VMC n'est donc pas le seul chemin vers Apple
Mail ; c'est même le chemin cher.

Reste Gmail, et seulement Gmail, derrière un certificat payant.

---

## 3. Le plan, en trois temps

L'objectif retenu est le **VMC sur le papillon** : le logo de la marque partout, coche bleue
comprise. Mais le certificat ne s'achète pas ce trimestre, et le papillon devra de toute
façon être déposé à l'OPIC avant qu'un VMC soit possible. On avance donc dans cet ordre :

| Temps | Ce qu'on fait | Ce que ça donne | Coût |
| --- | --- | --- | --- |
| **Maintenant** | étapes 1 à 6 | logo chez Yahoo, AOL, Fastmail, La Poste **et Apple Mail** | 0 $ |
| **En parallèle, dès que possible** | déposer le papillon à l'OPIC comme *Design Mark* (étape 7) | rien tout de suite — c'est le billet d'entrée du VMC, et il met des années à arriver | ~491 $CA (1 classe) à ~640 $CA (2 classes), une fois |
| **Quand les liquidités suivent** | acheter le certificat (étape 8) | ajoute Gmail | 650–1 750 $US / an |

Trois choses valent la peine d'être dites tout de suite :

- **Le gratuit couvre déjà presque tout sauf Gmail.** Apple Mail passe par Branded Mail, pas
  par le VMC. Ce qui manque à la fin de l'étape 6, c'est Gmail — rien d'autre.
- **Le dépôt à l'OPIC est le geste urgent, pas le certificat.** Votre demande de 2020 a été
  enregistrée en 2025 : le délai est le vrai coût, pas les 491 $. Déposé aujourd'hui, le
  papillon sera certifiable bien avant que le budget certificat ne devienne un problème.
- **Un CMC aujourd'hui n'hypothèque pas le VMC de demain.** Les deux se branchent sur la même
  balise `a=` de l'enregistrement BIMI. Si les liquidités arrivent avant l'OPIC, un CMC sur le
  papillon (~650–1 100 $US/an) ouvre Gmail immédiatement, et on le remplace par le VMC le jour
  où la marque figurative est enregistrée. Rien à refaire.

---

## 4. La marche à suivre

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

### Étape 6 — Apple Branded Mail (gratuit, et c'est le papillon)

Apple a son propre système depuis iOS 18.2, indépendant de BIMI : **Branded Mail**, dans
Apple Business Connect. Pas de certificat, pas de marque de commerce, pas de SVG — on inscrit
l'entreprise, Apple vérifie le domaine par un enregistrement DNS, on téléverse un PNG carré,
et le logo apparaît dans Apple Mail. Gratuit.

Prérequis, les mêmes qu'aux étapes précédentes : DKIM sur tous les envois (SPF seul ne suffit
pas) et DMARC à `p=quarantine` ou `p=reject`. L'organisation doit être vérifiée par Apple, la
vérification du domaine expire après 14 jours si on ne la termine pas, et la revue finale
prend 5 à 7 jours.

Le fichier à téléverser est prêt : `bimi/lasclay-apple-1081.png` — le papillon officiel,
1081 × 1081, carré, fond blanc opaque.

### Étape 7 — déposer le papillon à l'OPIC (le geste urgent)

C'est la seule chose qui débloque un jour le VMC sur le papillon, et c'est celle qui prend le
plus de temps : la demande de 2020 pour le mot a été enregistrée en 2025. Déposer maintenant,
c'est acheter du délai, pas un service.

Ce qu'il faut déposer : le papillon comme **marque figurative** (*Design Mark*), au nom de
Les produits Lasclay Inc. Dans les mêmes classes que TMA1285531 — 25 (vêtements) et 35 (vente
en ligne) — ou la classe 25 seule si on veut réduire la facture. Tarifs OPIC 2026 en ligne :
**491,06 $CA** pour la première classe, **149,04 $CA** par classe additionnelle. À confirmer
sur le barème officiel au moment du dépôt.

L'usage est déjà largement établi, ce qui aide au dossier : les fichiers du logo sur le CDN de
la boutique sont horodatés **février 2021**, soit cinq ans d'usage public continu.

À décider avec un conseil en PI : déposer le papillon seul, ou le logo complet (papillon +
lettrage) comme marque combinée. Le papillon seul est ce qui fonctionne dans une pastille de
96 pixels ; la marque combinée protège l'ensemble. Les deux se déposent, ce sont deux demandes.

### Étape 8 — le certificat, quand les liquidités suivent

Lasclay détient bien une marque enregistrée : **LASCLAY**, TMA1285531, OPIC, enregistrée le
24 janvier 2025, valide jusqu'au 24 janvier 2035, au nom de Les produits Lasclay Inc.
L'OPIC est un office reconnu pour les VMC. Mais l'enregistrement est en **caractères
standard** — un *Word Mark* au sens des règles BIMI.

Ce que disent les *VMC Guidelines* (v0.986), qui font autorité :

> **Mark:** A Combined Mark, Design Mark, or Word Mark.
>
> **Word Mark:** A trademark consisting exclusively of text expressed without regard to the
> font, style, size or color that has been registered as a trademark with a Trademark Office.
>
> The CA SHALL confirm that the Mark Representation submitted by the Subject organization
> **matches the Registered Mark** as it appears in the official database of the applicable
> Trademark Office.

Deux conséquences, et c'est tout le nœud du dossier :

- **Le papillon n'est pas la marque enregistrée.** Aucune image n'est déposée à l'OPIC —
  seul le mot l'est. Une autorité de certification refusera donc un VMC sur le papillon,
  peu importe qu'il soit utilisé depuis des années.
- **Le mot « LASCLAY », lui, est certifiable dès maintenant.** Et comme un *Word Mark*
  s'entend « sans égard à la police, au style, à la taille ou à la couleur », le lettrage
  maison de Lasclay convient — c'est celui de `lasclay-bimi-mot.svg`.

#### Ce qui ne marche pas, et pourquoi

Soumettre le logo complet (papillon + lettrage) en espérant que le rognage n'en montre que le
papillon : non, dans les deux sens. L'autorité compare la représentation soumise à ce qui
figure au registre — ajouter le papillon à un *Word Mark* éloigne la demande de la marque
enregistrée au lieu de l'en rapprocher, et elle est refusée. Et un SVG qui cacherait le
lettrage hors du `viewBox` pour ne laisser voir que le papillon reviendrait à faire certifier
une chose et à en afficher une autre : c'est précisément ce que le certificat existe pour
empêcher, l'autorité valide le rendu, et ça se voit.

Il n'y a pas de raccourci ici — mais il n'y en a pas besoin : le papillon s'affiche déjà
partout sauf dans Gmail sans rien payer (étapes 5 et 6), et le CMC l'ajoute à Gmail sans
toucher à l'OPIC.

#### Les trois chemins

| | CMC — le papillon | VMC — le mot LASCLAY | VMC — le papillon |
| --- | --- | --- | --- |
| Condition | usage public continu depuis 12 mois (on en a cinq) | TMA1285531, déjà en main | étape 7 d'abord |
| Ce qui s'affiche | le papillon | le mot, en petit | le papillon |
| Gmail | logo | logo + **coche bleue** | logo + coche bleue |
| Prix indicatif | ~650–1 100 $US / an | ~750–1 750 $US / an | ~750–1 750 $US / an |
| Délai | 1 à 3 semaines | 2 à 4 semaines | **des années** — le temps de l'OPIC |

Émetteurs : DigiCert ou Entrust (les deux autorités de vérification reconnues).

Le chemin retenu est le troisième. En attendant, le deuxième afficherait du texte à la place
du papillon — c'est le seul des trois qui abîme la marque, et le seul dont on n'a pas besoin.
Si Gmail devient prioritaire avant l'OPIC, c'est le **CMC** qu'il faut acheter : même papillon,
sans coche, remplaçable par le VMC le jour venu.

Une fois le certificat en main (fichier `.pem`), le déposer à côté du SVG et compléter
l'enregistrement :

```
v=BIMI1; l=https://bimi.lasclay.com/bimi/logo.svg; a=https://bimi.lasclay.com/bimi/lasclay.pem;
```

---

## 5. Les fichiers

| Fichier | Ce que c'est |
| --- | --- |
| `lasclay-bimi.svg` | Le papillon `#333333` sur fond blanc — fidèle à l'usage actuel. **Le fichier du chemin CMC.** |
| `lasclay-bimi-inverse.svg` | Le même en blanc sur `#333333`. Se détache mieux en pastille ronde, mais s'écarte de l'usage établi — à ne retenir que si l'autorité de certification l'accepte. |
| `lasclay-bimi-mot.svg` | Le lettrage « Lasclay » seul, `#333333` sur blanc. **Le fichier du chemin VMC** : c'est le mot, et rien que le mot, qui correspond à TMA1285531. Y ajouter le papillon ferait sortir la demande du cadre de la marque enregistrée. |
| `lasclay-bimi-mot-inverse.svg` | Le lettrage en blanc sur `#333333`. |
| `lasclay-apple-1081.png` | Le papillon officiel aplati sur fond blanc, 1081 × 1081. **Le fichier d'Apple Branded Mail** (étape 6), qui veut un PNG carré d'au moins 1024 px, pas un SVG. |

Le papillon est tracé depuis le favicon officiel (1081 × 1081) et cadré à 74 % de la toile ;
le lettrage vient du logo pleine largeur (2048 px) et occupe 82 % de la largeur. Tous les
quatre : `viewBox` carré de 512, entre 3,9 et 8,1 Ko, dimensionnés pour survivre au rognage
circulaire que Gmail applique. `node bimi_check.js` valide la conformité tiny-ps ; passer un
chemin de fichier en second argument pour en vérifier un autre que le papillon.

Pour visualiser un changement avant de le publier, ouvrir le SVG dans un navigateur : c'est
exactement ce que la boîte de réception rendra.

## 6. Ordre de grandeur

| Étape | Effort | Coût |
| --- | --- | --- |
| 1. Authentifier Shopify | 30 min + propagation DNS | 0 |
| 2. Lire les rapports DMARC | 15 min de mise en place, 2–4 semaines d'attente | 0 |
| 3. Durcir DMARC | 5 min | 0 |
| 4–5. Publier logo + enregistrement | 30 min | 0 |
| 6. Apple Branded Mail | 30 min + 5 à 7 jours de revue | 0 |
| 7. Dépôt du papillon à l'OPIC | une demande, puis des années d'attente | ~491–640 $CA, une fois |
| 8. CMC (papillon, si Gmail presse) | 1 à 3 semaines | ~650–1 100 $US / an |
| 8. VMC (papillon, après l'étape 7) | 2 à 4 semaines | ~750–1 750 $US / an |

Les étapes 1 à 6 se font en une soirée de travail répartie sur un mois d'observation, et
donnent le papillon chez Yahoo, AOL, Fastmail, La Poste et Apple Mail — sans rien payer.
L'étape 7 coûte une fois et n'achète que du temps. Seule l'étape 8 est récurrente, et elle
n'achète qu'une chose : Gmail.
