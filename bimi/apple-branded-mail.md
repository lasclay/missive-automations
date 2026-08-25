# Apple Branded Mail — fiche d'exécution

Mettre le papillon dans Apple Mail, gratuitement, sans certificat et sans marque figurative.
Système d'Apple **indépendant de BIMI** : il ignore complètement l'enregistrement
`default._bimi`. C'est le seul chemin vers Apple Mail tant qu'il n'y a pas de VMC.

Compter **30 minutes** au clavier, puis **jusqu'à 7 jours ouvrables** de revue chez Apple.

---

## Prérequis — vérifiés le 2026-08-25, tous verts

| Exigence d'Apple | État |
| --- | --- |
| DMARC à `quarantine` ou `reject` | ✅ `v=DMARC1; p=quarantine; pct=100; rua=mailto:hey@lasclay.com; fo=1; adkim=r; aspf=r` |
| DKIM sur tous les envois — **SPF seul ne suffit pas** | ✅ `google._domainkey` (Google Workspace), `kl` et `kl2._domainkey` (Klaviyo) |
| SPF | ✅ `v=spf1 include:_spf.google.com ~all` |
| Logo carré, JPG/PNG/HEIF, entre 1024 et 4864 px | ✅ `bimi/lasclay-apple-1081.png` — 1081 × 1081, PNG RVB, fond opaque, 21 Ko |
| Compte Apple Business Connect | à créer — c'est l'étape 1 |

Revérifier avant de commencer, au cas où le DNS aurait bougé :

```
node bimi_check.js
```

## À avoir sous la main

- L'identifiant Apple de l'entreprise (avec la double authentification — l'appareil qui reçoit
  le code).
- Un onglet ouvert sur Porkbun, `lasclay.com` → **DNS Records**.
- Le fichier `bimi/lasclay-apple-1081.png`.
- Les informations légales : **Les produits Lasclay Inc.**, 1286 ave De La Ronde, Québec
  (QC) G1J 4B7.

---

## La marche à suivre

### 1. Créer le compte et faire vérifier l'entreprise

`businessconnect.apple.com` → s'inscrire avec l'identifiant Apple de l'entreprise.

Apple demande de prouver que l'entreprise existe et qu'on la représente : dénomination
légale exacte (**Les produits Lasclay Inc.**, telle qu'au registre et sur TMA1285531),
adresse, site web `lasclay.com`. Selon les cas, Apple demande un document d'entreprise ou
une vérification par téléphone.

C'est l'étape la plus longue et la plus imprévisible. Les suivantes sont mécaniques.

### 2. Ouvrir Branded Mail et ajouter le domaine

Dans Business Connect → section **Branded Mail** → ajouter un domaine → `lasclay.com`.

> **Un seul domaine à enregistrer : `lasclay.com`.** C'est de là que partent les infolettres
> Klaviyo (`hey@lasclay.com`) et le courrier Google Workspace. Ne pas enregistrer
> `mail.lasclay.com` — c'est le retour d'enveloppe de Klaviyo, pas l'adresse d'expédition —
> ni `shopifyemail.com`, qui ne nous appartient pas.

### 3. Créer l'enregistrement de vérification chez Porkbun

Apple affiche un **TXT de vérification**. Le noter dans le tableau du bas de cette fiche,
puis le créer chez Porkbun **le jour même**.

> ⏳ **Fenêtre de 14 jours calendaires.** Passé ce délai, la vérification expire et il faut
> tout reprendre depuis l'étape 2.

Rappel Porkbun : le champ **Host** ne contient que le sous-domaine. Racine = champ **vide**.
TTL : 600. Ne toucher à aucune autre ligne — voir la section A de `dns-cible.md`.

Revenir dans Business Connect et cliquer **Verify**. Si Apple ne voit pas encore
l'enregistrement, ce n'est pas un échec : la propagation Porkbun prend de quelques minutes à
une heure. Réessayer.

### 4. Téléverser le logo

Téléverser `bimi/lasclay-apple-1081.png`.

Ne pas envoyer le SVG : Apple veut une image matricielle. Ne pas envoyer non plus une version
à fond transparent — celle-ci est déjà aplatie sur blanc, c'est voulu.

### 5. Soumettre et attendre

Apple examine la marque **et** le logo. Jusqu'à **7 jours ouvrables**.

Passer la ligne 6 du `JOURNAL.md` à `en attente` avec la date de soumission.

### 6. Vérifier une fois approuvé

Envoyer un courriel de `hey@lasclay.com` vers une adresse iCloud et l'ouvrir dans Apple Mail
sur un appareil en **iOS 18.2 ou plus récent**, iPadOS 18.2, macOS Sequoia 15.2, ou sur
`icloud.com`. Le papillon doit remplacer le rond gris avec un « L ».

Le logo s'affiche à la **livraison** : un courriel reçu avant l'approbation ne changera pas
rétroactivement. Il faut un nouvel envoi.

---

## Ce que cette étape ne règle pas

**Les confirmations de commande Shopify.** Elles partent de `shopifyemail.com`, un domaine
qui n'est pas le nôtre : ni Branded Mail ni BIMI ne peuvent les marquer. Tant que le domaine
expéditeur Shopify n'est pas authentifié (étape 1 du `README.md`), les courriels que les
clients ouvrent le plus resteront sans logo — dans Apple Mail comme ailleurs.

**Gmail.** Branded Mail est propre à Apple. Gmail continue d'exiger un CMC ou un VMC.

---

## Valeurs à noter en cours de route

| Quoi | Valeur | Date |
| --- | --- | --- |
| Identifiant Apple utilisé | | |
| Statut de vérification de l'entreprise | | |
| Host du TXT de vérification Apple | | |
| Valeur du TXT de vérification Apple | | |
| TXT créé chez Porkbun | | |
| Domaine vérifié par Apple | | |
| Logo téléversé | | |
| Soumis pour revue | | |
| Approuvé | | |
