# DNS cible de lasclay.com — la source de vérité

Ce fichier décrit **l'état DNS visé à la fin du chantier BIMI**. Il sert de contrat : on
compare la zone Porkbun à ce tableau, on ajoute ce qui manque, on corrige ce qui diverge —
et **on ne touche à rien d'autre**.

Registraire et DNS : **Porkbun**, serveurs de noms `curitiba` / `salvador` / `maceio` /
`fortaleza.ns.porkbun.com`.

> Chez Porkbun, le champ **Host** ne contient que le sous-domaine, jamais le domaine.
> Racine = champ **vide**. Pour `_dmarc.lasclay.com`, on écrit `_dmarc`. TTL : laisser 600.

---

## A. Ce qui existe déjà et ne doit JAMAIS être touché

Ces enregistrements font vivre la boutique et le courriel. Les modifier ou les supprimer
casse la production.

| Type | Host | Valeur | À quoi ça sert |
| --- | --- | --- | --- |
| A | *(vide)* | `23.227.38.65` | la boutique Shopify |
| MX | *(vide)* | `aspmx.l.google.com` (1), `alt1`/`alt2` (5), `alt3`/`alt4` (10) | la réception du courriel — **y toucher coupe la boîte** |
| TXT | *(vide)* | `google-site-verification=3naqxB_t1tSlY-7wlm4cZbG1mQigx0IFYW0oQ8KlCGw` | vérification Google Workspace |
| TXT | *(vide)* | `klaviyo-site-verification=RhpPJR` | vérification Klaviyo |
| TXT | `google._domainkey` | clé publique DKIM (longue, commence par `v=DKIM1; k=rsa; p=MIIBIjAN…`) | signature Google Workspace |
| CNAME | `kl._domainkey` | `kl.domainkey.u161779.wl030.sendgrid.net` | signature DKIM Klaviyo |
| CNAME | `kl2._domainkey` | `kl2.domainkey.u161779.wl030.sendgrid.net` | rotation DKIM Klaviyo |
| CNAME | `mail` | `u161779.wl030.sendgrid.net` | domaine d'envoi Klaviyo |
| TXT | `mail` | `v=spf1 include:sendgrid.net ~all` | SPF du domaine d'envoi Klaviyo |

## B. Les enregistrements à créer ou à modifier

Dans l'ordre du chantier. Une ligne « à remplir » veut dire que la valeur se récupère dans
une console (Shopify, Render, Apple) — jamais inventée.

| # | Type | Host | Valeur cible | Action | Étape |
| --- | --- | --- | --- | --- | --- |
| 1 | CNAME | *(4 hosts fournis par Shopify, dont `shopifyemail._domainkey`)* | *(à remplir depuis l'admin Shopify)* | créer | 1 |
| 2 | TXT | *(vide)* | `v=spf1 include:_spf.google.com include:shopifyemail.com ~all` | **modifier** le SPF existant | 1 |
| 3 | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hey@lasclay.com, mailto:`*(adresse du lecteur de rapports)*`; fo=1; adkim=r; aspf=r` | modifier | 2 |
| 4 | TXT | `_dmarc` | `v=DMARC1; p=quarantine; pct=100; rua=mailto:hey@lasclay.com, mailto:`*(adresse du lecteur)*`; fo=1; adkim=r; aspf=r` | modifier — **seulement après feu vert humain** | 3 |
| 5 | CNAME | `bimi` | `general-proxy-5muf.onrender.com` | créer | 4 |
| 6 | TXT | `default._bimi` | `v=BIMI1; l=https://bimi.lasclay.com/bimi/logo.svg;` | créer | 5 |
| 7 | TXT | *(host fourni par Apple)* | *(à remplir depuis Apple Business Connect)* | créer | 6 |
| 8 | TXT | `default._bimi` | `v=BIMI1; l=https://bimi.lasclay.com/bimi/logo.svg; a=https://bimi.lasclay.com/bimi/lasclay.pem;` | modifier — le jour où un certificat est acheté | 8 |

### Règles qui coûtent cher si on les rate

- **Un seul SPF à la racine.** La ligne 2 se fait en **modifiant** l'enregistrement TXT qui
  commence par `v=spf1`, jamais en en créant un second. Deux SPF font échouer les deux, et
  tout le courrier de Lasclay avec.
- **La ligne 4 n'est pas une formalité.** Passer à `p=quarantine` avec un expéditeur légitime
  encore mal aligné envoie les courriels de Lasclay dans les indésirables. Elle ne se fait
  qu'après avoir lu les rapports DMARC, et qu'après un « vas-y » explicite.
- **Ligne 6 avant ligne 5, ça ne marche pas.** `bimi.lasclay.com` doit répondre en HTTPS
  avant que l'enregistrement BIMI le désigne.
- **Les lignes 1 et 7 ont une date de péremption.** Shopify et Apple vérifient dans une
  fenêtre limitée (14 jours chez Apple) : créer l'enregistrement le jour où on le récupère.

## C. Vérifier

Après chaque changement, depuis le dépôt :

```
node bimi_check.js
```

La propagation prend de quelques minutes à une heure chez Porkbun. Un enregistrement absent
juste après la saisie n'est pas une erreur — recontrôler avant de conclure.

## D. Valeurs récupérées

À remplir au fur et à mesure, pour ne jamais avoir à retourner les chercher.

| Quoi | Valeur | Récupérée le |
| --- | --- | --- |
| CNAME Shopify n° 1 | | |
| CNAME Shopify n° 2 | | |
| CNAME Shopify n° 3 | | |
| CNAME Shopify n° 4 | | |
| Adresse `rua` du lecteur de rapports | | |
| Cible CNAME donnée par Render | | |
| Host + valeur TXT de vérification Apple | | |
