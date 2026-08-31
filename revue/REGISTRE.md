# Registre des améliorations — revue quotidienne

Vue générée par `node revue/registre.js md`. **Ne pas éditer à la main** :
la source est `revue/registre.json`, et tout changement d'état passe par le script.

| État | Nombre |
| --- | --- |
| proposee | 4 |
| approuvee | 0 |
| appliquee | 0 |
| refusee | 0 |
| reportee | 0 |

## En attente d'approbation (4)

### R-20260830-03 — Trancher dans REGLES.md le cas des felicitations generiques sur un billet deja repondu

- **Gravité** : mineur · **Effort** : 15 min · **Proposé le** : 2026-08-30
- **Source** : revue 2026-08-30
- **Constat** : Au tir A, 24 des 65 ecarts du jour portent le meme motif : des felicitations generiques sur le billet du recit de maladie, ecartees parce que plusieurs reponses y ont deja ete publiees. Le raisonnement est refait a neuf a chaque tir au lieu d'etre tranche une fois.
- **Preuve** : Collecte du jour, tir A : 65 ecartes_du_jour, dont 22 motifs identiques mentionnant « Felicitations generiques sur le billet du recit de maladie » et 2 variantes « Six reponses… » — 24 au total sur 65.
- **Proposition** : Ajouter dans fb-backlog/REGLES.md une regle nommee : sur un billet ou trois reponses ou plus ont deja ete publiees, ecarter sans deliberation tout commentaire de felicitations sans question, avec le motif fixe « billet deja servi, felicitations sans question ».
- **Portée** : fb-backlog/REGLES.md
- **Risque** : Un seuil trop bas ferait taire des commentaires qui posent une vraie question sous une forme elogieuse. La regle doit exiger l'absence de question, pas seulement la presence de felicitations.

### R-20260830-02 — Compter les ecarts du tir D, qui n'entrent dans aucun total

- **Gravité** : majeur · **Effort** : 20 min · **Proposé le** : 2026-08-30
- **Source** : revue 2026-08-30
- **Constat** : collecte.js filtre les ecarts sur x.ecarte_le === jour. Le tir D horodate ses ecarts dans un champ quand (ISO complet) et n'a aucun champ ecarte_le, contrairement aux tirs A, B et C. La collecte rapporte donc systematiquement 0 ecarte et aucun motif pour le tir D.
- **Preuve** : fb-backlog/etat/D-a-revoir.json : 108 entrees sur 108 sans champ ecarte_le ; cles reelles id, date, extrait, motif, page_id, quand. 44 de ces entrees portent un quand dans la fenetre du 2026-08-30. Le fichier a gagne 328 lignes dans la journee. Collecte du jour : tir D ecartes_du_jour 0, motifs_du_jour []. Code fautif : revue/collecte.js ligne 152.
- **Proposition** : Dans revue/collecte.js, remplacer le filtre x.ecarte_le === jour par un filtre qui accepte les deux schemas : la date ecarte_le si presente, sinon les dix premiers caracteres de quand ramenes au fuseau America/Toronto ; et faire remonter dans fiche.erreurs tout fichier a-revoir.json dont aucune entree ne porte de date exploitable, pour qu'un troisieme schema ne redevienne pas silencieux.
- **Portée** : revue/collecte.js
- **Risque** : quand est un horodatage UTC : le convertir naivement par slice(0,10) decalerait les ecarts faits apres 20 h Est au lendemain. La conversion doit passer par le meme Intl.DateTimeFormat que le reste du fichier.

### R-20260830-01 — Mesurer la campagne points de vente sur ses envois, pas sur ses commits

- **Gravité** : majeur · **Effort** : 45 min · **Proposé le** : 2026-08-30
- **Source** : revue 2026-08-30
- **Constat** : La routine « Campagne points de vente » n'a produit aucun envoi depuis le 6 aout 2026, alors que 339 fiches sont a l'etat en_attente. La collecte la declare pourtant « a jour » parce qu'elle mesure la fraicheur sur le dernier commit touchant retail-expansion/ — commit bc8f309 du 24 aout, une reecriture de gabarits par une session humaine, pas un envoi de la routine.
- **Preuve** : retail-expansion/journal_envois.json : 30 entrees, toutes datees 2026-08-06. retail-expansion/file_attente.json : 1419 fiches, 339 a l'etat en_attente. Fiche collecte trig_01MpfDwYo8AMsBc5GC3SgQvf : age_h 150.9, seuil_h 192, verdict « a jour ». Dernier commit sur le chemin : bc8f309 (2026-08-24 14:50 EDT).
- **Proposition** : Dans revue/routines.json, remplacer la trace de trig_01MpfDwYo8AMsBc5GC3SgQvf par une trace de type production lisant retail-expansion/journal_envois.json et prenant le plus recent envoye_le comme derniere trace, avec fraicheur_max_h a 192 ; et dans collecte.js, ajouter le support de ce type de trace, de sorte qu'un commit sur le repertoire ne compte plus comme une production.
- **Portée** : revue/routines.json, revue/collecte.js
- **Risque** : journal_envois.json vit sur la branche claude/lasclay-retail-expansion-v6jay7, absente de main : la lecture doit se faire via git show sur cette branche, sinon la trace ressort vide et la routine passe de « faussement saine » a « faussement morte ».

### R-20260829-01 — Rendre les journaux Render lisibles par la revue

- **Gravité** : majeur · **Effort** : 20 min côté Render, 1 h côté script · **Proposé le** : 2026-08-29
- **Source** : mise en place de la routine, 2026-08-29
- **Constat** : La revue ne peut rien dire des services Render au-delà d'une sonde HTTP : aucune RENDER_API_KEY n'est présente dans l'environnement des sessions. Un service qui répond 200 tout en journalisant des erreurs à chaque appel passerait inaperçu, et les cron jobs Render n'ont aucune trace vérifiable de ce côté.
- **Preuve** : env | grep -i render → rien ; revue/collecte.js ne sonde que /health et /connectors.
- **Proposition** : Poser une RENDER_API_KEY en lecture seule dans les variables de l'environnement Claude Code Remote, puis ajouter à revue/collecte.js un volet qui liste les services, leur dernier déploiement et les lignes de journal en erreur des 24 h.
- **Portée** : variables d'environnement + revue/collecte.js
- **Risque** : Une clé Render lit toute l'infrastructure : la prendre en lecture seule, et ne jamais la faire transiter par le code ni par un dépôt.

## Approuvées, à appliquer au prochain tour (0)

_rien._

## Reportées (0)

_rien._

## Appliquées (0)

_rien._

## Refusées (0)

_rien._
