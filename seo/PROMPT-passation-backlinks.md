# Prompt de passation, prospection de backlinks Lasclay

Copier-coller le bloc ci-dessous au prochain agent.

---

Charge d'abord le skill `/lasclay-seo` (et `lasclay-master` si tu as besoin du contexte de
marque). Tout ce qui suit s'y rattache.

## Où on en est

Un audit de prospection de backlinks vers lasclay.com a été réalisé le 3 août 2026. Le livrable
existe déjà : `seo/backlinks-lasclay-audit.xlsx`, dans le dépôt `missive-automations`, sur la
branche `claude/reload-skills-5xcm2o`. Ne le refais pas, complète-le.

Le chiffrier contient 72 occasions de lien, triées du meilleur score au moins bon, réparties en
trois feuilles :

- **Opportunités** : score sur 100, priorité A/B/C, type d'occasion, URL de la page cible,
  contexte, page suggérée sur lasclay.com, angle de la demande, courriel, statut du courriel,
  autre contact, quatre sous-scores, et une colonne « Statut de la démarche » pour le suivi.
- **Barème et méthode** : décomposition du score (pertinence /30, autorité /25, facilité /25,
  valeur /20), ordre de travail conseillé, limites de l'audit.
- **Gabarits de courriel** : cinq modèles selon le type de cible.

Les occasions se répartissent en cinq familles : mentions de Lasclay déjà publiées sans lien,
revendeurs et points de vente, pages de ressources sur l'asclépiade et le monarque, répertoires,
et presse spécialisée anglophone.

Le score sur 100 est une formule qui additionne les quatre sous-scores. Les sous-scores sont des
estimations qualitatives, pas des métriques d'outil. Corrige-les si tu as mieux.

## La contrainte technique qui a façonné l'audit

La politique réseau de l'environnement bloquait tout l'HTTPS sortant sauf `api.github.com`,
`registry.npmjs.org` et `pypi.org`. Même lasclay.com était inaccessible. WebFetch et curl
retournaient un 403 au tunnel. Seul WebSearch fonctionnait, parce qu'il est servi du côté de
l'API et ne sort pas du conteneur.

**Vérifie l'état du réseau avant de promettre quoi que ce soit.** Un simple
`curl -sS -o /dev/null -w "%{http_code}" https://lasclay.com` te le dit. Si tu obtiens 200, tu
peux faire le travail de vérification que je n'ai pas pu faire. Si tu obtiens 000 ou 403, la
politique est toujours fermée : ne cherche pas à la contourner, signale-le et travaille avec
WebSearch.

Conséquence directe pour toi : la colonne « Mentionne déjà Lasclay ? » repose sur des résultats
de recherche, pas sur une lecture du HTML. Aucune ligne ne confirme si un lien vers lasclay.com
existe déjà.

## Ce qu'il reste à faire, dans l'ordre

1. **Confirmer l'état réel des liens.** Pour chacune des 72 lignes : la mention existe-t-elle
   encore, et porte-t-elle déjà un lien vers lasclay.com ? La voie rapide est l'API Ahrefs
   (domaines référents actuels) croisée avec la liste, plutôt que 72 ouvertures de page. Marque
   comme classées celles qui ont déjà le lien.
2. **Compléter les courriels.** 26 sont confirmés, environ 46 sont à « À trouver » avec la page
   de contact ou le nom de la personne responsable déjà inscrits. N'invente jamais une adresse.
   Si tu ne la trouves pas, laisse « À trouver » et mets le formulaire de contact.
3. **Écrire le guide de plantation de l'asclépiade.** C'est le vrai goulot. La moitié des
   demandes de la catégorie « page ressource » (Aiglon Indigo, Craque-Bitume, Jardinier
   paresseux, municipalités, Fondation David Suzuki) supposent qu'une ressource gratuite,
   sérieuse et bien présentée existe sur lasclay.com. Sans elle, ces courriels n'ont pas
   d'argument et il vaut mieux ne pas les envoyer.
4. **Lancer la première vague.** Les priorités A d'abord, personnalisées une par une. Les
   gabarits sont un point de départ, pas un envoi de masse.
5. **Tenir le suivi.** La colonne « Statut de la démarche » a un menu déroulant. Mets-la à jour
   à chaque envoi et chaque réponse.

## Garde-fous non négociables

- Pas de cadratins, ni dans le chiffrier ni dans les courriels ni dans tes réponses.
- Ton humain, savant, accessible, jamais publicitaire. Pas de promesse absolue sur la
  performance de l'asclépiade.
- L'isolation d'asclépiade est cultivée, conçue et fabriquée au Québec, et ça se dit avec
  fierté. Ne laisse jamais entendre que le produit fini est fabriqué au Québec ou au Canada.
- N'invente aucun chiffre, aucune adresse, aucune date.
- Seulement des tactiques honnêtes. On n'achète pas de liens, on ne s'inscrit pas dans des
  fermes d'annuaires, et on n'ajoute pas soi-même un lien commercial sur Wikipédia. Si tu passes
  par la page de discussion, déclare le conflit d'intérêts.
- Aucun article de blogue n'est publié automatiquement sur Shopify. Statut brouillon, un humain
  approuve.
- Zone verte (contenu réversible) : autonomie avec journal avant/après. Zone rouge (prix,
  inventaire, code du thème) : jamais en autonomie.

## Deux points de vigilance repérés dans la liste

- **Espace-inc** : une source indique que l'organisme aurait cessé ses activités en 2025.
  Valide avant d'investir du temps.
- **Xerces Society** : l'organisme déclare explicitement ne pas faire de publicité pour des
  produits commerciaux. N'insiste pas, l'angle est le partenariat de mission, pas le lien.

## Ce qu'on cherche vraiment

Deux objectifs, jamais le trafic en soi : bâtir l'autorité du site, et vendre. Un lien qui ne
sert ni l'un ni l'autre n'est pas prioritaire, même s'il vient d'un gros domaine. Le contenu de
mission (asclépiade, monarque, plantation) attire et bâtit l'autorité ; le maillage interne doit
ensuite canaliser ce public vers les pages qui vendent (mitaines, tuques, glacières, manteaux).
