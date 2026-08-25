# Liste clients Shopify → audience Meta

## Pourquoi un fichier plutôt qu'un téléversement par l'API

L'outil MCP `ads_update_custom_audience_users` exige que les lignes soient
passées **en clair dans l'appel d'outil**. Pour 85 030 courriels, cela
représente ~5,4 millions de caractères de condensats à réémettre sans une
seule erreur de transcription. Ce n'est ni fiable ni raisonnable.

Le proxy général expose bien un connecteur `facebook`, mais il ne couvre que
les Pages (9 actions : publications, commentaires, masquage) — aucun accès aux
audiences publicitaires. Aucun jeton Graph n'est disponible côté shell.

D'où le chemin retenu : **un CSV importé à la main dans le Gestionnaire de
publicités**, qui hache côté navigateur. Deux minutes, zéro risque.

## Régénérer le fichier

```bash
# 1. Lancer l'export en lot Shopify (via le connecteur MCP Shopify)
#    mutation bulkOperationRunQuery sur { customers { ... } }
#    puis interroger currentBulkOperation(type: QUERY) jusqu'à COMPLETED
# 2. Télécharger le JSONL depuis l'url signée
curl -sS -o customers.jsonl "<url signée>"
# 3. Produire le CSV
python3 export_csv.py
```

L'export complet prend environ 2 minutes côté Shopify (85 825 objets, 25 Mo).

## Contenu au 25 août 2026

85 030 courriels uniques, 795 enregistrements écartés faute de courriel exploitable.

| Clé | Couverture |
| --- | --- |
| email | 100,0 % |
| fn (prénom) | 76,8 % |
| ln (nom) | 53,0 % |
| ct / st / country / zip | ~49,6 % |

La couverture d'adresse plafonne à 50 % parce que la moitié de la liste n'a
jamais commandé : ce sont des inscriptions à l'infolettre, des paniers
abandonnés et des participations à des concours.

| Segment | Nombre | Part |
| --- | --- | --- |
| Désabonnés du marketing courriel | 47 643 | 56,0 % |
| Abonnés | 27 308 | 32,1 % |
| Jamais inscrits | 10 079 | 11,9 % |
| **Ont au moins une commande** | **39 630** | **47 %** |
| Canada | 33 319 | — |
| États-Unis | 9 033 | — |

Valeur cumulée des comptes : 3 513 972 $.

La colonne `value` contient le montant dépensé à vie par client. Elle sert à
créer une **audience basée sur la valeur**, donc des similaires pondérés par
la valeur plutôt que par le simple fait d'avoir acheté.

## Garde-fou Loi 25

56 % de la liste s'est explicitement désabonnée du marketing courriel.
Le désabonnement courriel n'est pas juridiquement identique à un refus de
ciblage publicitaire, et l'import complet a été validé par Gabriel le
25 août 2026. Les conditions de Meta sur les listes clients placent la
responsabilité de la base légale sur l'annonceur.

Si la position doit être resserrée un jour, les deux découpes défendables
sont : sans les désabonnés (37 387) ou acheteurs seulement (39 630).
