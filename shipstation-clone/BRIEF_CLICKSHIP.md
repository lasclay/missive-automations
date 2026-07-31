# Brief technique — accès API ClickShip / Freightcom

À l'attention des conseillers techniques de ClickShip. Objectif : obtenir en un échange les
réponses qui décident de l'intégration, plutôt qu'en cinq allers-retours.

**Contexte à leur donner en une phrase :** Les Produits Lasclay Inc, marque québécoise expédiant
~8 300 colis/an depuis Québec, dont 80 % sous 500 g, veut remplacer sa plateforme actuelle par un
outil interne branché sur l'API ClickShip.

Volume à mettre sur la table — il justifie l'accès et cadre les questions de débit :

| | |
|---|---|
| Expéditions, 12 derniers mois | 8 338 |
| Dépense de transport | 98 828 $ |
| Colis sous 500 g | 80,5 % |
| Pic mensuel (décembre) | 2 755 envois |
| Pointe journalière estimée | ~130 colis / jour ouvrable |
| Part achetée en lot aujourd'hui | 96 % |
| Origine | Québec (G1J 3R4), 5 lieux d'expédition |
| Destinations | Canada 99,7 %, États-Unis et international marginal |

---

## A. Les deux questions qui décident du projet

**A1. Le tarif Canada Post « Expedited Parcel — Drop-Off Only » est-il retourné par l'API de
cotation, au même prix que dans l'interface web ClickShip ?**

Référence précise à leur soumettre : devis du 22 juillet 2026, colis 9 × 6 × 1 po, 0,10 lb,
Québec → Lac-Beauport (G3B 0P2) — **6,31 $ CAD**, mention « Drop-Off Only », dans le cadre du
programme annoncé pour les envois uniques sous 1,1 lb / 500 g.

*Si la réponse est non, le projet s'arrête là et on reste sur une interface web.*

**A2. Comment ce service se désigne-t-il dans la réponse d'API ?** Identifiant de service distinct,
ou service standard assorti d'un indicateur drop-off ? C'est ce qui détermine si on peut le
sélectionner par programme, notamment dans une règle « sous 500 g → drop-off ».

---

## B. Accès et contractualisation

1. Quelle est la procédure exacte d'octroi des identifiants d'API, et le délai ?
2. Y a-t-il un environnement **bac à sable** ? Peut-on coter et générer des étiquettes de test
   sans débit ? (Équivalent du `testLabel: true` de la plateforme actuelle.)
3. Les tarifs vus dans l'interface web s'appliquent-ils **à l'identique** par API, ou existe-t-il
   une grille distincte pour les comptes API ?
4. Modèle de facturation : prépayé, à terme, dépôt exigé ? Le pic de décembre représente environ
   17 000 $ de transport sur un mois — quelles sont les implications de trésorerie ?
5. Engagement de volume ou de durée ?

## C. Cotation

6. La cotation est-elle **synchrone ou asynchrone** ? Si asynchrone (soumission puis récupération),
   quel est le délai typique jusqu'à des tarifs complets, et peut-on récupérer partiellement ?
7. Limite de débit : requêtes par minute, et existe-t-il une cotation par lot ?
8. Peut-on demander **un seul transporteur** pour éviter d'attendre l'ensemble du panel ?
9. Durée de validité d'un tarif coté avant achat ?

## D. Étiquettes

10. **Achat en lot** — existe-t-il un appel qui achète N étiquettes en une fois, ou faut-il
    paralléliser des appels unitaires ? À 130 colis par jour en pointe, c'est structurant.
11. Format des étiquettes : PDF 4 × 6, ZPL ? Retournées en ligne ou par URL, et pendant combien de
    temps l'URL reste-t-elle valide ?
12. Annulation : délai maximal, remboursement, et existe-t-il un appel d'annulation en lot ?
13. Étiquettes de retour — environ 107 par an chez nous.

## E. Drop-off en exploitation

14. Le dépôt exige-t-il un document de transmission, un manifeste ou un code-barres de dépôt, ou
    suffit-il de déposer les colis étiquetés au comptoir ?
15. Y a-t-il une limite de colis par dépôt, ou un préavis à donner au bureau de poste ?
16. Peut-on mêler drop-off et ramassage dans une même journée sur le même compte ?
17. Le suivi et les réclamations fonctionnent-ils identiquement en drop-off ?

## F. Suivi, douanes, exploitation

18. **Webhooks** disponibles (étiquette créée, colis en transit, livré, exception) ou faut-il
    interroger périodiquement ?
19. Douanes : génération automatique des CN22/CN23 et factures commerciales ? Le code SH est-il
    obligatoire par article ? *(À noter : notre référentiel actuel n'a pas de codes SH — on les
    ajoutera, c'est corrigé dans le nouvel outil.)*
20. Assurance disponible par API, et à quel taux ?
21. Adresses : validation incluse ? Gestion des adresses de type case postale — l'interface
    signale que seuls les envois Canada Post y sont livrés.
22. Multi-origines : nos 5 lieux d'expédition (Québec, Lévis, Saint-Zacharie, et un en Californie)
    peuvent-ils coexister sur un compte ?
23. Environnement de production : disponibilité annoncée, statut de service, contact d'escalade.

---

## G. Ce qu'on peut leur montrer pour lever la méfiance

L'accès API est manifestement filtré. Trois arguments concrets, dans l'ordre :

1. **Le volume est réel et vérifiable** — 8 338 expéditions et 98 828 $ sur 12 mois, historique
   complet disponible. Ce n'est pas un projet spéculatif.
2. **On ne revend pas leur service.** L'API sert un outil interne à une seule entreprise, pas une
   plateforme redistribuée à des tiers — c'est la crainte habituelle derrière un accès filtré.
3. **On est déjà client de plateforme**, pas des débutants : intégrations Shopify, Etsy et Faire
   en place, achats d'étiquettes par lot quotidiens depuis plus de deux ans.

Si l'API reste fermée, **demander explicitement la position de repli** : un accès en lecture pour
récupérer les étiquettes achetées via leur interface web, ou un import de commandes par fichier.
Cela permettrait de garder le tarif drop-off tout en pilotant le tri depuis notre outil — moins
élégant, mais l'économie est dans le tarif, pas dans l'automatisation.

---

## H. Ce qu'on retient de la réponse

À remplir pendant l'appel — ces quatre lignes suffisent à décider :

| Question | Réponse | Conséquence |
|---|---|---|
| A1 — tarif drop-off par API | | non → on arrête l'intégration |
| B2 — bac à sable | | non → développer contre des étiquettes réelles, prévoir le coût |
| D10 — achat en lot | | non → paralléliser, vérifier la limite de débit |
| C6 — cotation asynchrone | | oui → prévoir la file d'attente dans l'application |
