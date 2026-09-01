# Registre des améliorations — revue quotidienne

Vue générée par `node revue/registre.js md`. **Ne pas éditer à la main** :
la source est `revue/registre.json`, et tout changement d'état passe par le script.

| État | Nombre |
| --- | --- |
| proposee | 8 |
| approuvee | 0 |
| appliquee | 0 |
| refusee | 0 |
| reportee | 0 |

## En attente d'approbation (8)

### R-20260831-04 — Recolter les trous de faits-verifies.json que les motifs d'ecart nomment deja

- **Gravité** : mineur · **Effort** : 30 min · **Proposé le** : 2026-08-31
- **Source** : revue 2026-08-31
- **Constat** : Quatre-vingt-douze ecarts du corpus invoquent un trou de fb-backlog/faits-verifies.json, dont cinq aujourd'hui, et plusieurs motifs precisent eux-memes « deja signale plusieurs fois ». La base de faits n'a recu aucun enrichissement depuis sa creation : l'agent identifie ses manques, les ecrit, et rien ne les recolte.
- **Preuve** : 92 ecarts dont le motif mentionne un trou de faits-verifies. Par sujet : statut legal et protege des especes 9, comestibilite de l'asclepiade 3, allegations medicales 2, autres 78. Historique du fichier : f1b5995 le 2026-08-18 (creation), e3e73ad le 2026-08-29, rien depuis.
- **Proposition** : Ajouter a la collecte un regroupement des motifs d'ecart mentionnant un trou de faits-verifies, par sujet et par frequence, limite aux dix premiers, de sorte que chaque tour presente une liste courte de faits a faire trancher par Gabriel — l'ajout au fichier restant une decision humaine, jamais une ecriture automatique.
- **Portée** : revue/collecte.js
- **Risque** : Le regroupement par mots-cles produira des categories grossieres ; c'est acceptable pour une file de decision, mais il ne faut pas presenter ce classement comme une analyse fine, ni laisser un agent ecrire dans faits-verifies.json a partir de la — un fait non verifie qui entre dans la base ressort en reponse publique.

### R-20260831-03 — Compter les brouillons non envoyes et leur age dans la collecte

- **Gravité** : majeur · **Effort** : 1 h · **Proposé le** : 2026-08-31
- **Source** : revue 2026-08-31
- **Constat** : Douze des 21 fils Missive touches le 31 aout portent un brouillon redige et jamais envoye, du 2026-07-15 au 2026-08-30 — jusqu'a 48 jours. Trois ont un champ to vide et ne partiraient pas meme envoyes a la main. Aucune routine suivie ne couvre la boite support, donc aucun instrument ne compte ce stock : il n'apparait ni dans la collecte, ni dans un rapport, nulle part.
- **Preuve** : Recensement complet des 21 fils actifs dans la fenetre du 2026-08-31 : ffae4d7a 2026-07-15 (to vide), 7eb6d62f 2026-07-16, df1ba00d 2026-07-16, 640e6213 2026-07-17, 1d8f9d14 2026-07-19, 5df68402 2026-07-20, 59166b01 2026-07-21, 7434b4bc 2026-07-23, 3a4255f4 2026-08-01, 88f3058f 2026-08-20 (to vide), 5eef512f 2026-08-20 (to vide), eb108a7f 2026-08-30. Sujets concernes dont « Foulard abime », « Missing seed bombs », « Commande L-46837 », « Facture L-50943 ».
- **Proposition** : Ajouter a collecte.js une section missive alimentee par missive_client.js sur le filtre etroit assigned=true : nombre de fils, nombre de brouillons non envoyes, age du plus ancien, et nombre de brouillons au champ to vide ; puis faire echouer bruyamment le resume du tour des que l'age du plus ancien depasse sept jours.
- **Portée** : revue/collecte.js
- **Risque** : Un appel drafts par fil coute une requete : sur 45 fils assignes c'est tolerable, sur inbox=true (3214 fils) le tour ramperait. Le filtre doit rester assigned=true, et la section doit se degrader proprement — dire « non collecte » — si le proxy ne repond pas, plutot que de faire echouer la collecte entiere.

### R-20260831-02 — Router les ecarts marques « a traiter par un humain » hors du fichier a-revoir

- **Gravité** : majeur · **Effort** : 45 min · **Proposé le** : 2026-08-31
- **Source** : revue 2026-08-31
- **Constat** : Quand l'agent du backlog rencontre un commentaire qu'il ne peut pas trancher, il l'ecarte et ecrit dans le motif une escalade explicite — « A TRAITER PAR UN HUMAIN, en priorite ». Cette escalade n'a aucune sortie : elle est ecrite dans *-a-revoir.json, que rien ni personne ne relit. Le mecanisme fonctionne cote agent et se perd cote reception.
- **Preuve** : Trois entrees du corpus portent cette marque. La plus recente, tir C ecartee le 2026-08-31 : accusation publique adressee a la Page, « FAKE - A-I - THIS FARMER IS NOT REAL - SHE IS A COMPUTER IMAGE », touchant deux publications (la seconde : 934359419303137), motif contenant « A TRAITER PAR UN HUMAIN, en priorite ». Une autre dort depuis le 2026-08-20, soit 11 jours (tir A, usage de fonds collectes). Aucune n'a ete routee nulle part.
- **Proposition** : Dans fb-backlog/traiter.js, ecrire toute entree dont le motif porte la marque d'escalade dans un fichier dedie fb-backlog/etat/escalades.jsonl (id, page, lien, extrait, motif, date), et faire remonter ce fichier en tete de la collecte quotidienne avec le nombre d'items ouverts et l'age du plus ancien, comme le registre le fait deja pour les propositions.
- **Portée** : fb-backlog/traiter.js, revue/collecte.js
- **Risque** : Si la marque d'escalade est reperee par expression reguliere sur un texte libre, une reformulation de l'agent la fera manquer en silence. La marque doit devenir un champ explicite pose par traiter.js, la regex ne servant que de repli pour l'historique deja ecrit.

### R-20260831-01 — Reconcilier l'inventaire des routines, et cesser de supposer mcp__* absent

- **Gravité** : majeur · **Effort** : 1 h · **Proposé le** : 2026-08-31
- **Source** : revue 2026-08-30 (reprise du 31)
- **Constat** : list_triggers retourne 11 routines la ou revue/routines.json en suit 9. L'inventaire suit la revue sous l'id d'une routine DESACTIVEE et ignore la routine vivante qui l'a remplacee ; il ignore aussi entierement « Chief — point du matin ». La cause tient a une affirmation non verifiee : ROUTINE.md etape 2 et le champ non_collecte de collecte.js declarent qu'une session de Routine ne recoit aucun outil mcp__*, ce qui est faux dans cette session — et c'est cette croyance qui a fait declarer deux routines « inverifiables » le 30 au soir.
- **Preuve** : list_triggers : 11 entrees. revue/routines.json : 9. La revue s'y suit sous trig_017tFgWR75UBgBu5FhwJQ9Bh, enabled:false, nomme « Revue quotidienne — DESACTIVEE » ; la routine vivante est trig_01XH6MqfMFPaYP5Vebb66Xie, creee 2026-08-30T12:31:34Z. trig_01Yb5B4FJ8CrVTfPEwTPai9 « Chief — point du matin » (13 11 * * *, enabled) n'est suivie nulle part. Ramassages verifies sains par last_run : trig_01UKZahS3efWGPqGWR5L9cht SUCCEEDED 2026-08-31T13:03:30Z, trig_016Bq8cq3sQjpCoSFYKJmWiH SUCCEEDED 2026-08-25T11:25:07Z.
- **Proposition** : Ajouter a l'etape 1 du tour un appel list_triggers quand l'outil repond, comparer les ids retournes a revue/routines.json, et faire ressortir dans la collecte trois listes nommees : routines actives non suivies, routines suivies desactivees ou disparues, et ecarts de cron ; puis remplacer dans ROUTINE.md et dans le champ non_collecte de collecte.js l'affirmation « aucun outil mcp__* » par le resultat reel de l'appel, en gardant le repli sur la trace quand l'appel echoue.
- **Portée** : revue/ROUTINE.md, revue/collecte.js, revue/routines.json
- **Risque** : Le repli doit rester le defaut : si list_triggers echoue ou n'est pas la, le tour doit continuer sur la trace et le dire, jamais s'interrompre. Et un ecart d'inventaire est un constat a signaler, pas une autorisation d'editer routines.json en cours de tour — la mise a jour reste une amelioration approuvee.

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
