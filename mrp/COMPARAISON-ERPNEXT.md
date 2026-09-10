# ERPNext contre le MRP Lasclay — ce qui vaut la peine d'être repris

Note de lecture du dépôt [`frappe/erpnext`](https://github.com/frappe/erpnext),
consulté le 8 septembre 2026 (dernier commit la veille). C'est le premier des cinq
dépôts d'un carrousel TikTok de `@ty.prompts.ai`, « 5 free repos that run a side hustle
automatically ». Les quatre autres sont notés à la fin.

## D'abord la contrainte qui décide de tout : la licence

**ERPNext est sous GNU GPL v3.** C'est une licence à contamination : tout logiciel qui
incorpore du code GPLv3 doit lui-même être publié sous GPLv3, code source compris.

Conséquence pratique, et elle n'est pas négociable :

- **Lire la conception, oui.** Une idée ne se protège pas. Comprendre comment ils
  ordonnancent, quels champs ils portent, quels pièges ils ont rencontrés — c'est
  précisément ce que fait cette note.
- **Copier du code, non.** Pas une fonction, pas un fichier, même « adapté ». Le MRP
  Lasclay deviendrait GPLv3, avec obligation de publier sa source à quiconque en reçoit
  une copie.
- Réimplémenter un concept à partir de sa description est licite et courant. C'est ce
  qu'on ferait pour l'ordonnancement à rebours ci-dessous.

Ce n'est pas une raison de s'en priver : leur `manufacturing/scheduling/DESIGN.md` est
un document de conception public, argumenté, avec ses décisions et ses questions
ouvertes. C'est un cahier des charges gratuit.

## L'ampleur, pour situer

| | ERPNext | MRP Lasclay |
| --- | --- | --- |
| Code | 2 968 fichiers Python, 161 Mo | 12 fichiers JS, ~5 000 lignes |
| Pile | Python, Frappe, MariaDB, Redis, Node | Node 22 seul — `node:http`, `node:sqlite` |
| Dépendances | des centaines | **aucune** |
| Poids d'une page | application monopage | 2 à 5 Ko compressés |
| Licence | GPL v3 | privé |

Cette colonne de droite n'est pas de la modestie : c'est la contrainte tunisienne. Une
application Frappe ne s'utilise pas sur la connexion de l'atelier. Le choix du sur-mesure
tient toujours.

## Ce que nous faisons déjà comme eux

Rassurant, et pas par hasard — ce sont les invariants du problème.

| Concept ERPNext | Chez nous |
| --- | --- |
| Placement **avant, à capacité finie** | `charge.calendrier()` — les tâches consomment la capacité disponible, jour après jour |
| **Priorité** qui départage sous contention | le tri de `listeFabrication()` : priorité manuelle, retard, échéance, famille, quantité |
| **Calendrier de ressource** : plages de travail + jours fériés | `capacite()` (postes × heures × jours) + les **pauses d'atelier** |
| Les placements déjà faits **contraignent les suivants** | la boucle unique de `calendrier()`, curseur partagé |
| `allow_production_on_holidays` | une pause se retire, et le plan se resserre |

Un point où **nous allons plus loin qu'eux**. Leur moteur est « dry-run par défaut,
l'appelant persiste » : la proposition est calculée, puis écrite dans
`schedule_date` / `planned_start_date` quand l'utilisateur applique. Nous ne stockons
**aucune date** — le calendrier est recalculé à chaque affichage. Ils ont écrit une
section entière (`Production Plan Schedule`, phase 2) pour matérialiser ce que nous
obtenons en ne l'écrivant jamais. Leur propre constat, en tête du document :

> Production Plan today carries dates […] but nothing computes them — users type them in.

C'est exactement le chiffrier `PRODUCTION MASTER SHEET`, et c'est ce qu'on a évité.

## Ce qu'ils ont et que nous n'avons pas

Par ordre de valeur pour Lasclay, pas par ordre de sophistication.

### 1. L'ordonnancement à rebours — le manque le plus criant

Ils placent dans les deux sens : `FORWARD` (au plus tôt depuis une date de départ) et
`BACKWARD` (au plus tard depuis une date due). Nous n'avons que le premier.

Or la vraie question de Gabriel n'est pas « si on commence aujourd'hui, on finit
quand ? » — c'est **« le conteneur part le 20 octobre, l'atelier doit commencer
quand ? »**. Notre verdict répond « ça rentre / ça ne rentre pas » ; il ne dit pas la
date de départ au plus tard.

Leur garde-fou mérite d'être repris tel quel : **repli avant en cas d'échec**. Si le
calcul à rebours place un début dans le passé, la tâche — et tout ce qui en dépend —
est replacée au plus tôt depuis aujourd'hui. Une date de livraison impossible dégénère
en « au plus tôt possible » au lieu de lever une erreur. C'est la bonne réponse à
« il fallait commencer il y a trois semaines ».

**Recommandation : à construire.** C'est une inversion de notre boucle existante, pas
un moteur neuf.

### 2. Le mode infini — le rapport de surcharge gratuit

Deuxième mode de calcul : mêmes calendriers, mais **on ignore la charge déjà posée**.
Comparer la fin en mode fini et la fin en mode infini *est* le rapport de surcharge.

C'est peu de code et ça remplacerait avantageusement notre verdict actuel, qui compare
des heures à des heures. Une date contre une date se lit mieux : « au plus tôt le
12 octobre si l'atelier était vide, le 3 novembre avec ce qui est déjà engagé ».

**Recommandation : à construire, après l'à-rebours.** Les deux se partagent la boucle.

### 3. Les délais d'approvisionnement dans le calendrier

Ils modélisent les achats comme des tâches sur une « voie fournisseur infinie », avec
`purchase_time + buffer_time`, et — question ouverte chez eux — l'idée d'un
`earliest_start` contraint par l'arrivée de la matière.

Chez nous, `/besoins` sait qu'il manquera 631 m² de Vegeto. Le calendrier, lui,
l'ignore : il place la production comme si la matière était là. La colonne
`delai_jours` existe sur les matières et **ne sert à rien pour l'instant**.

**Recommandation : le plus rentable des trois.** Relier le manque de matière à une date
au plus tôt transformerait deux modules justes en un module vrai. C'est aussi ce qui
distingue un MRP d'un calendrier.

### 4. Les opérations et leurs dépendances

Une gamme (`Routing`) enchaîne des opérations, chacune sur un poste, avec
`sequence_id` pour les groupes parallèles et `depends_on` pour l'ordre. Nous traitons
un item comme un bloc unique.

C'est exactement la tension que notre réglage « ce que l'atelier fait » signale déjà :
préparation et assemblage sont deux étapes, on ne sait pas si l'atelier planifié fait
l'une, l'autre ou les deux, et l'écart va du simple au double. Les modéliser comme deux
tâches liées réglerait la question au lieu de la contourner par un réglage.

**Recommandation : intéressant, pas urgent.** Ça demande de découper les temps par
étape, ce que les données ne donnent pas encore proprement.

### 5. Le temps réel contre le temps prévu

`Job Card Time Log` enregistre le temps **réellement passé**, opération par opération.
C'est ce qui permet, à la longue, de remplacer un temps déduit par un temps mesuré.

Nos temps viennent de fichiers statiques : chronomètres, prix BMB, coûts de confection —
et `charge.js` dit honnêtement laquelle des trois sources il utilise. Mais rien ne
remonte du terrain.

**Recommandation : à garder en tête.** L'avancement par tranches de 10 % qu'on demande
déjà à l'atelier pourrait porter un temps sans coût de saisie supplémentaire.

### 6. Le reste, noté sans recommandation

- **Postes multiples** — chaque `Workstation` a son calendrier, sa `production_capacity`
  (travaux parallèles), son `workstation_type`. Nous avons une capacité agrégée
  (20 postes × 8 h). Suffisant tant que l'atelier est un seul lieu.
- **Choix du poste par capacité** — le moteur essaie tous les postes du bon type et
  garde celui qui finit le plus tôt.
- **`Downtime Entry`** — les arrêts *subis*, distincts des fermetures *prévues* que sont
  nos pauses. Alimente l'OEE.
- **`mins_between_operations`**, temps de réglage, de file, de déplacement.
- **`Plant Floor`** — une vue d'atelier avec l'état de chaque poste.

## Les quatre autres dépôts du carrousel

| | Dépôt | Ce que c'est | Pour Lasclay |
| --- | --- | --- | --- |
| 2 | `makeplane/plane` | Alternative libre à Jira / Linear / Monday | Le module `taches` du MRP couvre déjà notre besoin |
| 3 | `triggerdotdev/trigger.dev` | Tâches planifiées, Apache 2.0 | Les Routines et Render font déjà ce travail |
| 4 | `getlago/lago` | Facturation à l'usage (API, jetons) | Sans objet : Lasclay vend des objets, pas des appels d'API |
| 5 | `relaticle/relaticle` | CRM avec serveur MCP, 32 outils | Même idée que nos 34 outils d'assistant — le pari est le bon |

Le cinquième mérite une remarque. Son argument de vente est qu'un agent peut *travailler*
le CRM au lieu qu'un humain clique dedans. C'est exactement ce que fait déjà l'assistant
du MRP, et c'est plutôt une confirmation qu'une piste.

## Ce qu'il faut retenir

ERPNext ne se déploie pas chez Lasclay : trop lourd pour la Tunisie, GPLv3, et il
faudrait de toute façon écrire le PLM textile et les patrons par-dessus. Mais son
document de conception d'ordonnancement est la meilleure spécification gratuite qu'on
trouvera, et trois choses en sortent, dans cet ordre :

1. **La matière contraint la production** — relier `delai_jours` et le manque au
   calendrier.
2. **L'ordonnancement à rebours** — « le conteneur part le 20, on commence quand ».
3. **Le mode infini** — le rapport de surcharge en une date au lieu d'un solde d'heures.

Aucune ne demande de nouveau moteur : les trois sont des variations de la boucle de
`charge.calendrier()`.
