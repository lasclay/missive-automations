# Le journal de décision

La mémoire dit **ce qu'on sait**. Ce fichier définit **ce qu'on a fait, pourquoi, et ce que ça a
donné**. C'est la pièce qui manque pour que le système apprenne du réel au lieu d'apprendre d'un
relecteur.

> **Le constat.** Dans `support.js`, Opus relit chaque brouillon **avant** l'envoi et le rétrograde
> s'il ne passe pas. Rien ne relit **après**. Le système ne sait pas si le message envoyé a clos le
> dossier ou déclenché trois autres courriels, si la cliente remboursée est revenue, si le geste
> promis a été posé. Une employée sait tout ça sans effort parce qu'elle voit la suite. L'agent est
> amnésique du résultat, pas du fait.

---

## Le principe qui rend le journal honnête

**On écrit le résultat attendu avant d'agir, jamais après.**

Sans ça, la relecture devient une rationalisation : on regarde ce qui s'est passé et on décide
après coup que c'était le but. Une employée fait ça implicitement — « je lui offre le rabais pour
qu'elle recommande » — et c'est cette phrase-là qui rend l'apprentissage possible. Si le geste ne
peut pas s'écrire avec un résultat observable, c'est qu'on ne sait pas pourquoi on le pose.

---

## L'enregistrement

Écrit **au moment de la décision**, avant l'exécution. Une ligne JSON par geste, en append seul.

```json
{
  "id": "dec_2026-08-26_a3f21c",
  "quand": "2026-08-26T14:02:11Z",
  "acteur": "support.js@2.34",
  "modele": "claude-sonnet-4-6",
  "relu_par": "claude-opus-4-8",
  "geste": "envoi_reponse",
  "cible": { "fil": "2103e221", "commande": "L-50488", "client": "marie-anais-sauve" },
  "decide": "Appliquer MERCI10 (14,20 $) et confirmer par courriel",
  "ecarte": ["Renvoyer sans frais", "Refuser — hors délai de 30 jours"],
  "pourquoi": "Code promo omis par notre faute au moment de la commande",
  "confiance": 0.82,
  "signaux_escalade": [],
  "attendu": {
    "quoi": "fil_clos_sans_relance",
    "avant": "2026-09-09",
    "cout_accepte": 14.20
  }
}
```

| Champ | Ce qu'il porte | Pourquoi il est là |
| --- | --- | --- |
| `id` | Identifiant unique du geste | **Le chaînon manquant.** Sans lui, aucun résultat ne peut être recollé à sa cause |
| `acteur` + `modele` | Le script, sa version, le modèle | Permet de comparer v2.34 contre v2.35, Sonnet contre un modèle local |
| `relu_par` | Le contrôle qualité, ou `null` | Sépare ce qui est passé par Opus de ce qui a filé direct |
| `decide` / `ecarte` | Le geste retenu et ceux rejetés | Les options écartées valent autant que celle retenue — c'est là que se lit le jugement |
| `pourquoi` | Une phrase | Si elle ne s'écrit pas, la décision n'était pas prise, elle était devinée |
| `confiance` | 0 à 1, auto-déclarée | Sert à mesurer la **calibration** : est-ce que 0,8 veut vraiment dire 8 fois sur 10 ? |
| `signaux_escalade` | Ce qui a déclenché une revue | Permet de savoir si le seuil d'escalade est trop bas ou trop haut |
| `attendu` | Résultat observable, échéance, coût accepté | **Écrit avant.** C'est ce qui distingue une mesure d'une rationalisation |

---

## La réconciliation

Une tâche différée relit les enregistrements arrivés à échéance et va chercher le résultat **à la
source**, jamais dans la mémoire de l'agent. Le signal existe déjà, dispersé dans les systèmes
qu'on interroge tous les jours — il n'a simplement jamais été recollé au geste qui l'a causé.

| Résultat attendu | Où se lit la réponse | Comment |
| --- | --- | --- |
| `fil_clos_sans_relance` | Missive | Le fil est-il rouvert après la date du geste ? |
| `geste_pose` | ShipStation / Shopify / QBO | L'étiquette, le remboursement, l'avoir existent-ils ? |
| `cliente_revenue` | Shopify | Nouvelle commande dans les 180 jours |
| `pas_de_reexpedition` | ShipStation | Aucune seconde expédition sur la commande |
| `cout_reel` | QBO | Ce que le geste a réellement coûté, contre `cout_accepte` |
| `commentaire_sans_suite` | Proxy Facebook | Pas de réponse négative, pas de suppression |

Trois verdicts, et un seul est intéressant :

- **`tenu`** — le résultat attendu s'est produit dans les délais. On ne fait rien. Écrire une leçon
  ici gonfle la mémoire sans rien y ajouter.
- **`raté`** — le résultat ne s'est pas produit. C'est le seul cas qui mérite une écriture.
- **`indéterminé`** — la source ne répond pas, ou le résultat n'est pas observable. À compter :
  un taux d'indéterminé élevé veut dire que les résultats attendus sont mal choisis.

---

## Ce qu'on écrit en mémoire, et ce qu'on n'écrit pas

C'est le point où la plupart des systèmes auto-évolutifs se noient. Deux résultats mesurés dans la
littérature 2026 encadrent la règle :

**Stocker l'abstraction, pas la trace.** Les mémoires brutes produisent un transfert *négatif*
(−9,5 % mesuré sur ALFWorld) ; les principes abstraits, un transfert positif (+6,5 %). Une suite
d'actions détaillée induit l'agent en erreur sur un cas voisin ; une règle générale tient.

> ❌ « Le 26 août, on a appliqué MERCI10 au fil 2103e221 pour Marie-Anaïs Sauvé »
> ✅ « Quand le code promo a été omis de notre fait, l'appliquer rétroactivement clôt le dossier
> — 9 fois sur 11 depuis juin »

**Écrire seulement si c'est nouveau.** Une porte de nouveauté compare l'enseignement à ce qui est
déjà en mémoire et refuse le doublon. Sans elle, la mémoire enfle, et une mémoire homogène provoque
un *effondrement de diversité* : le corpus grossit pendant que la récupération ramène toujours les
trois mêmes entrées.

**Un `raté` isolé n'est pas une leçon.** C'est un incident. Il faut un motif — trois ratés qui se
ressemblent — avant d'écrire une `regle` ou une `lecon` au sens de `SCHEMA.md`. Un seul cas produit
une entité `lecon` marquée `[correction]` avec sa provenance, et rien de plus.

**Toute écriture passe par l'approbation.** Le journal propose, l'humain dispose. C'est la même
discipline que la liste `ask` de `.claude/settings.json` : ce qui touche à l'argent ou à une
cliente ne s'auto-applique pas.

---

## Les deux mesures qui comptent

Tout le reste est du volume.

**La calibration.** Regrouper les gestes par tranche de `confiance` et comparer au taux de `tenu`.
Si les gestes annoncés à 0,9 tiennent 60 % du temps, le système est sûr de lui à tort — et c'est
plus dangereux qu'un système faible. Un humain compétent n'est pas celui qui a raison plus souvent,
c'est celui qui sait quand il risque d'avoir tort.

**Le rendement de l'escalade.** Parmi les gestes escaladés à Opus, combien ont été corrigés ? Parmi
ceux qui ne l'ont pas été, combien ont raté ? Ces deux nombres disent si le seuil est bien placé.
Aujourd'hui il est fixe ; il devrait bouger.

---

## Le piège du travail fabriqué

Une équipe qui a fait tourner quatre boucles de ce type en production pendant un mois rapporte le
mode d'échec principal : **l'agent fabrique du travail pour avoir l'air occupé** — il réécrit une
documentation déjà juste, rouvre un dossier déjà clos, propose une leçon là où il n'y avait rien à
apprendre.

La règle explicite, à écrire dans le contrat de la boucle : **ne rien produire quand il n'y a rien
à corriger.** Un tour qui ne trouve rien et le dit est un tour réussi. Sur une routine qui tire huit
fois par jour, c'est la différence entre un système utile et un système qui pollue sa propre
mémoire.

---

## Ce qui ne se ferme pas

Trois choses qu'un humain apporte et qu'aucune boucle ne remplace. Il faut les nommer pour ne pas
les confondre avec de l'intelligence manquante :

- **La responsabilité.** Une employée peut être tenue responsable ; un agent, non. Le geste qui
  engage l'entreprise reste signé par quelqu'un.
- **La perception hors système.** Une employée voit qu'un lot est mal cousu en ouvrant la boîte.
  Aucune boucle de conséquence ne lit ce qui n'est écrit nulle part.
- **L'intention.** Le système peut apprendre ce qui marche. Il ne peut pas décider ce que Lasclay
  doit devenir.

Le reste — se souvenir, apprendre du résultat, savoir qu'on ne sait pas, savoir ce qui compte — se
construit. C'est ce fichier plus `SCHEMA.md`.
