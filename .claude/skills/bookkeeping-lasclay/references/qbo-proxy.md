# Accès à QuickBooks Online par le proxy finance

## Le secret

Le secret d'authentification n'est pas stocké ici et ne doit pas l'être. Le demander à
Gabriel au début de la session. L'URL du proxy vient aussi de lui : c'est un service qu'il
héberge, et elle peut changer.

## Pourquoi passer par le navigateur intégré

Le sandbox infonuagique ne peut pas joindre le domaine du proxy — le pare-feu sortant refuse
la connexion avec un 403. `curl` depuis le Bash de la session échouera donc toujours, peu
importe la commande.

La solution : ouvrir le domaine du proxy dans le **navigateur intégré de la session**, puis
faire les appels en JavaScript avec `fetch`. Comme la page est déjà sur ce domaine, les
requêtes sont same-origin et passent sans problème de CORS.

C'est le navigateur intégré, toujours : pas l'extension Claude in Chrome, pas le Chrome du
poste de Gabriel, pas un Playwright monté à la main. Il est disponible à chaque session sans
installation, et la page reste ouverte entre les appels, donc les raccourcis posés dans
`window` tiennent d'un appel à l'autre.

Deux détails pratiques appris à l'usage :

- Le service est hébergé sur une plateforme qui met les instances en veille. Le premier
  appel peut prendre une dizaine de secondes. `GET /health` sert à le réveiller avant de
  lancer une vraie requête.
- Les appels `fetch` en boucle dépassent facilement le délai d'exécution du JavaScript.
  Limiter chaque exécution à deux ou trois requêtes et accumuler dans `window`.

## Mise en place

Une fois le navigateur intégré ouvert sur le domaine du proxy, installer les raccourcis dans
la page pour éviter de retaper l'en-tête à chaque appel :

```javascript
window.__S = '<secret fourni par Gabriel>';
window.__q = async (q) => {
  const r = await fetch('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-proxy-secret': window.__S },
    body: JSON.stringify({ query: q })
  });
  return await r.json();
};
window.__call = async (action, body) => {
  const r = await fetch('/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-proxy-secret': window.__S },
    body: JSON.stringify(body)
  });
  return await r.json();
};
```

Les deux raccourcis vivent dans la page. Tant que le navigateur intégré reste sur ce domaine,
ils survivent d'une exécution de JavaScript à l'autre ; après une navigation ailleurs, les
reposer.

L'en-tête d'authentification est **`x-proxy-secret`**. Ni `Authorization: Bearer`, ni
`x-api-key`, ni `x-secret` ne fonctionnent : ils renvoient tous un 401.

## Endpoints

`POST /<action>`, corps JSON, en-tête `x-proxy-secret`.

| Action | Corps | Usage |
|--------|-------|-------|
| `query` | `{"query": "<SQL QBO>"}` | Lire des entités |
| `report` | `{"name": "...", "params": {...}}` | Rapports QBO |
| `companyinfo` | `{}` | Infos du dossier |
| `read` | entité + Id | Lire une pièce précise |
| `download` | — | Pièces jointes |
| `create` | entité + corps | Créer |
| `update` | entité + corps avec Id et SyncToken | Modifier |
| `remove` | entité + Id | Supprimer |

`GET /health` répond `{"ok":true,"service":"finance-proxy"}` sans authentification : utile
pour vérifier que le service est réveillé.

Entités acceptées par `create`, `update` et `remove` : purchase, journalentry, deposit,
transfer, bill, billpayment, invoice, payment, salesreceipt, creditmemo, vendorcredit,
refundreceipt, vendor, customer, item, account, attachable.

Un appel mal formé renvoie un 502 avec un message qui explique ce qui manque. C'est le
moyen le plus rapide de découvrir la forme attendue d'une requête.

## Requêtes utiles

### Taux de change officiel

C'est la référence pour convertir une facture en devise étrangère.

```javascript
await window.__q("select * from ExchangeRate where SourceCurrencyCode = 'USD' and AsOfDate = '2026-07-14'");
```

Le taux est dans `.data.QueryResponse.ExchangeRate[0].Rate`.

### Chercher une pièce avant de publier

QBO n'accepte pas `LIKE` sur les noms de fournisseur : ramener une plage de dates et filtrer
en JavaScript.

```javascript
const j = await window.__q("select * from Bill where TxnDate >= '2026-07-01' maxresults 900");
const rows = j.data.QueryResponse.Bill || [];
rows.filter(b => /anthropic/i.test((b.VendorRef && b.VendorRef.name) || ''))
    .map(b => [b.TxnDate, b.DocNumber, b.TotalAmt, b.CurrencyRef.value, b.Balance]);
```

Faire la même chose sur `Purchase` avec `EntityRef` au lieu de `VendorRef` : selon le
fournisseur, la pièce entre comme facture ou comme achat par carte.

### Liste des fournisseurs

```javascript
await window.__q("select * from Vendor maxresults 900");
```

Beaucoup de fournisseurs ont une fiche par devise. Vérifier le `CurrencyRef` avant de
conclure qu'un fournisseur est absent.

### Rapport de transactions

Montre les factures et leurs paiements côte à côte, donc ce qui est rapproché et ce qui ne
l'est pas.

```javascript
await fetch('/report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-proxy-secret': window.__S },
  body: JSON.stringify({ name: 'TransactionList', params: { start_date: '2026-07-01', end_date: '2026-07-31' } })
});
```

Les lignes sont dans `.data.Rows.Row[].ColData[].value`, colonnes : Date, Type d'opération,
N°, Reporté, Nom, Mémo, Compte, Répartition, Montant.

### Corriger une facture

**Accord explicite de Gabriel requis avant chaque écriture.** Lire d'abord la pièce pour
obtenir son `SyncToken`, qui change à chaque modification.

```javascript
await fetch('/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-proxy-secret': window.__S },
  body: JSON.stringify({
    entity: 'bill',
    body: {
      Id: '11126', SyncToken: '1', sparse: true,
      VendorRef: { value: '341' }, CurrencyRef: { value: 'CAD' },
      TxnDate: '2026-07-14', DueDate: '2026-07-14', DocNumber: 'U9BST0XW-0007',
      GlobalTaxCalculation: 'TaxExcluded', APAccountRef: { value: '59' },
      Line: [{
        Id: '1', LineNum: 1, Amount: 56.36,
        DetailType: 'AccountBasedExpenseLineDetail',
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: '44' }, BillableStatus: 'NotBillable',
          TaxCodeRef: { value: '9' }
        }
      }]
    }
  })
});
```

Avec `GlobalTaxCalculation: TaxExcluded`, ne corriger que le montant de la ligne : QBO
recalcule les taxes à partir du `TaxCodeRef`. Relire ensuite pour confirmer que le
`SyncToken` a augmenté de 1.

### Paginer correctement

`maxresults` plafonne à 1 000 et rien ne signale la troncature. Toujours compter d'abord.

```javascript
await window.__q("select count(*) from Purchase");  // .data.QueryResponse.totalCount
await window.__q("select * from Purchase startposition 1001 maxresults 500");
```

Accumuler entre les appels pour ne pas dépasser le délai d'exécution du JavaScript :

```javascript
window.__scan = window.__scan || [];
window.__page = async (ent, start) => {
  const j = await window.__q(`select * from ${ent} startposition ${start} maxresults 500`);
  const rows = (j.data.QueryResponse[ent]) || [];
  rows.forEach(e => (e.Line || []).forEach(l => {
    const d = l.JournalEntryLineDetail || l.AccountBasedExpenseLineDetail || l.DepositLineDetail;
    if (d && d.AccountRef && CIBLES.includes(d.AccountRef.value))
      window.__scan.push({ ent, id: e.Id, date: e.TxnDate, acc: d.AccountRef.value,
                           t: d.PostingType || 'Debit', amt: l.Amount });
  }));
  return rows.length;
};
```

Les `Transfer` n'ont pas de `Line` : ils portent `FromAccountRef`, `ToAccountRef` et
`Amount`. Les traiter à part, sinon les remboursements de prêt passent inaperçus.

### Créer une écriture de journal

```javascript
const L = (t, acc, amt, desc) => ({
  DetailType: 'JournalEntryLineDetail', Amount: amt, Description: desc,
  JournalEntryLineDetail: { PostingType: t, AccountRef: { value: acc } }
});
await window.__call('create', { entity: 'journalentry', body: {
  TxnDate: '2026-07-30',
  DocNumber: 'Int MG 2025-2026',
  PrivateNote: 'expliquer le raisonnement et les sources ici',
  Line: [ L('Debit', '1150040015', 13126.81, '...'), L('Credit', '1150040008', 13126.81, '...') ]
}});
```

Trois choses à savoir :

- **`DocNumber` fait 21 caractères au maximum.** Au-delà, QBO renvoie « La chaîne est trop
  courte ou trop longue », un message qui n'aide pas.
- Toujours remplir `PrivateNote` avec le raisonnement et la source des chiffres. C'est ce qui
  permet de retracer une écriture dans six mois, et c'est l'absence de cette note qui rend
  les écritures de forçage du dossier illisibles aujourd'hui.
- Relire la pièce par `read` après création. Le `TotalAmt` renvoyé à la création n'est pas
  fiable.

### Le piège `TaxInclusive`

`GlobalTaxCalculation: 'TaxInclusive'` fait **ajouter** la taxe par-dessus le montant de la
ligne, au lieu de l'en extraire. Une facture de 651,31 est ressortie à 748,85 comme ça.

Pour forcer des montants au cent près, utiliser une ligne au net et un `TxnTaxDetail`
explicite avec les `TaxLine`. `TaxRateRef` 6 = TPS 5 %, 20 = TVQ 9,975 %.

### Limites de l'action `report`

Les paramètres `start_date`, `end_date`, `account` et `columns` **ne sont pas appliqués**. Le
rapport revient sur l'exercice courant arrêté à aujourd'hui, tous comptes confondus. Pour un
exercice antérieur ou un compte précis, relever les lignes par requête et filtrer soi-même.

Conséquence à connaître : une pièce datée de demain n'apparaît pas au rapport. Un écart entre
un état des résultats et la somme des écritures s'explique souvent comme ça.

## Identifiants du dossier Lasclay

Relevés le 29 juillet 2026.

### Comptes

| Id | Compte |
|----|--------|
| 13 | 1001 Compte chèques CAD |
| 44 | 6401 Administration et RH:Logiciels Admin et RH |
| 59 | Comptes fournisseurs (CF), aussi 2010 |
| 11 | Cartes de crédit:VISA PRINCIPALE (8010 ou 9028), aussi 2031 |
| 18 | 5020 Salaires et avantages sociaux - Production |
| 77 | 6420 Administration et RH:Salaires et avantages sociaux - ADMIN |
| 78 | 6061 Frais généraux:R&D:RSDE - Salaires et avantages sociaux |
| 249 | 6065 Salaires et avantages sociaux - Design |

### Financements

| Id | Compte |
|----|--------|
| 1150040008 | Prêts privés et corporatifs:Merchant Growth Capital |
| 1150040015 | 7020 Frais financiers:Intérêts:Intérêts Merchant Growth |
| 1150040014 | Intérêts Merchant Growth (actif reporté, doit rester à zéro) |
| 89 | Prêts privés et corporatifs:Emprunt - Shopify Capital 100K |
| 264 | Prêts privés et corporatifs:Emprunt Shopify Capital #2 55K |
| 1150040006 | Prêts privés et corporatifs:Emprunt Shopify Capital #3 180K |
| 1150040009 | Prêts privés et corporatifs:Shopify Capital #4 250K |
| 207 | 7012 Frais financiers:Intérêts:Intérêts Shopify Capital |
| 267 | Intérêts Shopify (actif reporté, doit rester à zéro) |
| 248 | 7014 Frais financiers:Intérêts:Intérêts Prêt BDC 100k |
| 1150040004 | 7016 Frais financiers:Intérêts:Intérêts Prêt BDC 18K |
| 1150040002 | Prêts bancaires:Prêt BDC 18K |

### Codes de taxe

| Id | Code |
|----|------|
| 9 | TPS/TVQ (TaxRateRef 6 = TPS 5 %, TaxRateRef 20 = TVQ 9,975 %) |

### Fournisseurs

| Id | Fournisseur | Devise |
|----|-------------|--------|
| 341 | Anthropic | CAD |
| 288 | A2X | USD |
| 150 | A2X Software | USD |
| 241 | A2X Usa | USD |
| 149 | Klaviyo | USD |
| 28 | Klaviyo CAD | CAD |
| 185 | ShipStation | USD |
| 225 | shipstationcad | CAD |

## Repères de taux USD vers CAD

Table `ExchangeRate` de QBO, juillet 2026. Donne un ordre de grandeur pour repérer une
valeur aberrante.

| Date | Taux |
|------|------|
| 3 juil | 1,420192 |
| 14 juil | 1,406440 |
| 15 juil | 1,404169 |
| 16 juil | 1,404682 |
| 21 juil | 1,410706 |
| 23 juil | 1,408223 |
| 25 juil | 1,410250 |

Fin juin, les taux tournaient plutôt autour de 1,45 à 1,46. Un taux hors de la fourchette
1,36 à 1,47 pour 2026 mérite une vérification.
