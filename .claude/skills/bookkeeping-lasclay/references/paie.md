# Paie Desjardins — de l'avis au journal

Desjardins Services de paie, compagnie 00263148. Le rapport arrive en PDF, nommé
`RP_PD263148_AAAAMMJJ_HHMM.pdf`. Il contient le relevé des frais, le registre des salaires,
les remises aux organismes, le rapport des coûts distribués et le calendrier de paie.

## L'écriture

Une seule écriture par paie, très simple : les comptes de salaires au débit, le compte de
banque au crédit. **Aucun compte de passif, aucune banque de vacances.**

```
Débit   compte de salaires (un par structure)
Crédit  13 — 1001 Compte chèques CAD          montant réellement débité
```

**Nomenclature** : `Sal Dist AAAA-MM-JJ`, datée **au jour du débit bancaire**, soit deux
jours avant la date payable imprimée sur le rapport. Vérifié sur onze paies de mars à
juillet 2026. Exemple : payable le 2026-08-14 → `Sal Dist 2026-08-12`.

## Le montant

```
crédit banque = brut + charges employeur, CNT exclue
```

La CNT n'est jamais débitée par Desjardins et n'entre donc pas dans l'écriture. Sur PP16 elle
valait 3,20 : ce montant reste dehors.

Charges employeur à retenir : **RRQ, FSS, AE, RQAP, SST**. Pas la CNT.

### Formule de contrôle

Calibrée sur PP16, vérifiée sur quatre périodes, **par employé** :

```
coût = 1,12032 × brut − 8,48
```

Le 8,48 vient de l'exemption RRQ de 134,62 par paie. Décomposition du 12,032 % :
RRQ 6,30 % au-dessus de l'exemption, FSS 1,25 %, AE 1,82 % (1,4 × 1,30 %),
RQAP employeur 0,602 %, SST 2,06 %.

Avec *n* employés dans la paie : `total = 1,12032 × brut_total − n × 8,48`.

### Identité de contrôle

Toujours la poser avant d'écrire :

```
brut + charges employeur (hors CNT) = paie nette + remises gouvernementales
```

Sur PP16 : 5 327,44 + 624,04 = 3 891,56 + 2 059,92 = **5 951,48**. Les deux côtés tombent au
cent, l'écriture est bonne.

## La ventilation

Le rapport « coûts distribués » répartit chaque employé par **division et service**. Cette
structure détermine le compte de charge. Table décodée en téléchargeant les rapports archivés
dans QBO et en les rapprochant des écritures correspondantes :

| Structure Desjardins | Compte QBO | Preuve |
|---|---|---|
| DIV 01 / SERV 011 | 18 — 5020 Salaires - Production | nov. 2025 : 4 928,22 attendu, 4 928,56 écrit |
| DIV 02 / SERV 011 | 78 — 6061 RSDE - Salaires et avantages sociaux | déc. 2025 : seuls 18 et 78 bougent, DIV 02 y est |
| DIV 02 / SERV 022 | 77 — 6420 Salaires - ADMIN | nov. 2025 : Véronique Édé, 1 686,37 attendu, 1 686,27 écrit |
| DIV 03 / SERV 022 | 78 — 6061 RSDE - Salaires et avantages sociaux | PP15 : Catherine seule, 100 % RSDE |

**La structure suit le poste, pas la personne.** Laurence Delarosbil était en DIV 02 / 011 à
l'automne 2025, Gabriel y est en 2026. Ne jamais présumer du compte à partir du nom : lire la
structure sur le rapport de la période.

Un écart de quelques dollars entre la somme des structures et l'écriture est normal : le
fichier de transfert GL de Desjardins arrondit à sa façon. Le nommer, ne pas le forcer.

## Retrouver un ancien rapport

Les rapports de paie de 2024 et 2025 sont en pièce jointe dans QBO, attachés par paire à une
écriture de journal et à un achat (les frais Desjardins). Pour les relire :

```javascript
// 1. trouver la pièce jointe
const att = await window.__q("select * from Attachable maxresults 1000 startposition 2001");
// filtrer sur FileName qui commence par RP_PD263148

// 2. la télécharger
const r = await window.__call('download', { id: '<Id de l Attachable>' });
// r.data.base64 contient le PDF
```

Ne pas ramener le base64 hors de la page : c'est un blob de plusieurs mégaoctets qui n'a rien
à faire dans la conversation. Charger `pdf.js` depuis cdnjs dans la page du navigateur intégré
et extraire le texte sur place :

```javascript
await new Promise((res,rej)=>{const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  s.onload=res;s.onerror=rej;document.head.appendChild(s);});
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const bin = Uint8Array.from(atob(r.data.base64), c=>c.charCodeAt(0));
const pdf = await pdfjsLib.getDocument({data:bin}).promise;
```

Les pages « coûts distribués » sont vers la fin, avant le calendrier. Chercher
`GRAND TOTAL APRES CORRECTIONS SERV.` pour les sous-totaux par structure.

Attention : ne pas compter sur un visionneur PDF de navigateur. Un blob PDF part en
téléchargement au lieu de s'afficher, autant dans le navigateur intégré que sur le poste de
Gabriel, dont le visionneur Chrome est désactivé. Passer par pdf.js, pas par un iframe.

## Frais Desjardins

Le relevé des frais est en première page du rapport. Il entre séparément comme achat sur la
carte, pas dans l'écriture de salaires. Vérifier qu'il n'est pas déjà saisi avant d'en créer
un : il arrive souvent par Dext de son côté.

## Vacances accumulées

La banque de vacances apparaît au rapport (colonne « % VACANCES ACC ») mais **n'est pas
comptabilisée** dans ces écritures. C'est la méthode en place. Ne pas la provisionner sans
accord de Gabriel et de son comptable.
