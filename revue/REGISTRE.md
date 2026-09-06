# Registre des améliorations — revue quotidienne

Vue générée par `node revue/registre.js md`. **Ne pas éditer à la main** :
la source est `revue/registre.json`, et tout changement d'état passe par le script.

| État | Nombre |
| --- | --- |
| proposee | 11 |
| approuvee | 0 |
| appliquee | 0 |
| refusee | 0 |
| reportee | 1 |

## En attente d'approbation (11)

### R-20260905-01 — Faire entrer les echecs 502 et les doublons dans la mesure de qualite

- **Gravité** : majeur · **Effort** : 1 h 30 · **Proposé le** : 2026-09-05
- **Source** : revue 2026-09-05
- **Constat** : collecte.js calcule les reponses non confirmees a partir du champ confirme des lignes de *-journal.jsonl. Un echec 502 n'ecrit aucune ligne de journal : il n'existe pas pour la collecte. Resultat, la revue a annonce « 0 non confirmee chez Meta, 0 erreur » huit soirs de suite pendant que six doublons publics vivaient sur la page Asclepiade & papillons monarques et que six echecs 502 etaient enregistres dans les seuls messages de commit. Les journaux ne peuvent pas non plus detecter les doublons : sur les quatre tirs, aucun commentaire n'apparait repondu plus d'une fois, y compris sur le tir D ou six doublons ont reellement ete publies.
- **Preuve** : INCIDENT-502-tirD.md (commit 50b9ac5, 2026-09-05) : cinq 502 trompeurs, six doublons publics, sous les parents 988691833397470_619372127668364, _1684105585563933, _536033022871979 et _1388102012370651. Lecture directe le 2026-09-05 via connectors_client.js facebook comments sur le premier parent : 4 reponses de la Page dont 3 identiques, toujours en ligne. Commits du 2026-09-05 mentionnant un echec : quatre au tir C (7 h, 14 h deux fois, 17 h), trois au tir D (6 h, 8 h, 9 h). Fiches de collecte du meme jour : erreurs [] et non_confirmees 0 pour les quatre tirs.
- **Proposition** : Deux ajouts a collecte.js. Premier : compter les echecs en lisant les messages de commit du jour du backlog, qui les nomment deja (« echec 502 », « echec Meta »), et les faire ressortir comme non_confirmees plutot que de laisser zero. Second : pour un echantillon de commentaires parents recents par tir, relire les reponses via l'action facebook comments du General Proxy et signaler tout parent portant plus d'une reponse de la Page — c'est la seule mesure qui voit un doublon, puisque le journal ne le porte pas.
- **Portée** : revue/collecte.js
- **Risque** : La lecture directe consomme des appels Meta a chaque tour : il faut la borner a quelques parents par tir et la degrader proprement — dire « non collecte » — si le proxy ne repond pas, sans faire echouer le tour. Et lire les messages de commit est un pis-aller : si un tir cesse un jour de nommer ses echecs dans son sujet de commit, le compteur retombera silencieusement a zero. La vraie correction est que traiter.js journalise ses echecs ; cette proposition mesure en attendant, elle ne remplace pas le correctif propose dans le rapport d'incident.

### R-20260904-01 — Juger les tirs horaires sur leur cadence du jour, pas sur un seuil de 30 heures

- **Gravité** : majeur · **Effort** : 1 h · **Proposé le** : 2026-09-04
- **Source** : revue 2026-09-04
- **Constat** : Le tir A s'est arrete a 10 h 12 le 4 septembre apres trois tirs, alors que les tirs B, C et D en ont fait 13, 12 et 14. Sept heures ouvrables consecutives sans tir, 9 commentaires traites contre 87 la veille — et la collecte affiche « a jour (11,5 h) », parce que le seuil de fraicheur du tir A est de 30 heures, soit plus qu'une journee ouvrable entiere. Une routine horaire ne peut pas etre jugee sur un seuil concu pour une routine quotidienne : l'arret d'une journee complete passe inapercu.
- **Preuve** : Commits du tir A le 2026-09-04 : trois seulement, a 07:20:27, 08:20:26 et 10:12:57 heure de l'Est. Derniere ligne de A-journal.jsonl : 2026-09-04T14:12:40.247Z. Meme journee, meme fenetre : tir B 13 commits, tir C 12, tir D 14. Fiche de collecte du tir A : age_h 11.5, seuil_h 30, verdict « a jour ». Bilan du jour : 3 publiees et 6 ecartes, contre 87 commentaires traites le 3 septembre.
- **Proposition** : Pour les quatre routines a trace jsonl dont le cron est horaire, remplacer dans collecte.js le seuil unique en heures par un controle de cadence sur la journee ecoulee : compter les heures ouvrables (9 h a 17 h Est, sans midi) ou la routine a laisse au moins une trace, et rendre un verdict INTERROMPUE des que trois creneaux consecutifs sont vides alors qu'une autre routine du meme groupe a tire pendant ce temps — la comparaison entre tirs distinguant une panne propre a un tir d'un arret general.
- **Portée** : revue/collecte.js, revue/routines.json
- **Risque** : L'inventaire documente qu'un tir saute volontairement une fois sur six, deux fois sur six la fin de semaine : un seuil de trois creneaux consecutifs doit etre verifie contre l'historique des journaux avant d'etre fige, sinon la revue criera au faux positif les samedis et perdra sa credibilite exactement comme l'aurait fait le compteur d'inauthenticite de R-20260902-01. Verifier sur les journaux des quatre tirs avant de figer le seuil.

### R-20260903-01 — Compter le reproche d'inauthenticite sur des formes multi-mots, validees sur trois cas connus

- **Gravité** : majeur · **Effort** : 1 h 15 · **Proposé le** : 2026-09-03
- **Source** : revue 2026-09-03
- **Constat** : Trois personnes, sur deux canaux, reprochent a Lasclay de repondre par une IA ou de publier une image generee, et rien ne compte ce signal. La premiere version de cette proposition (R-20260902-01) specifiait une recherche par mots-cles isoles ; testee a la main le 3 septembre, elle ramene 59 occurrences cote Facebook dont la quasi-totalite sont fausses, parce que le motif \bA-?I\b capte le verbe « ai » en francais. Un compteur qui crie 59 fois pour 3 vrais cas serait ignore des le deuxieme soir.
- **Preuve** : Test manuel du 2026-09-03 sur les quatre fichiers a-revoir : 59 correspondances, dont l'echantillon visible ne contient aucun vrai positif — « j'ai rit par contre », « J'ai achete les mitaines, c'est miraculeux! », « je pellette la neige une demi-heure avec mes ». Les trois vrais cas connus sont : Facebook tir C ecarte le 2026-08-31 (« FAKE - A-I - THIS FARMER IS NOT REAL - SHE IS A COMPUTER IMAGE », deux publications, la seconde 934359419303137) ; Missive 640e6213 du 2026-07-16 (« C'est ca l'effet des message realises par l'intelligence artificielle? ») ; Missive df1ba00d, sujet « J'aimerais que ce ne soit pas l'intelligence artificielle qui reponde ».
- **Proposition** : Ajouter a collecte.js un compteur « inauthenticite » fonde uniquement sur des formes multi-mots — intelligence artificielle, artificial intelligence, generated by AI, AI generated, computer image, not real, pas une vraie personne, repondu par un robot — tenues dans un fichier versionne, jamais sur un sigle isole ; balayer les motifs et messages des fichiers a-revoir et les sujets des fils Missive assignes ; et ajouter au depot un petit jeu de validation contenant les trois cas connus plus cinq faux positifs averes, que le tour execute avant de publier son compte, de sorte qu'une regle trop large soit rejetee a l'ecriture plutot qu'a la lecture.
- **Portée** : revue/collecte.js, un fichier de formes versionne, un jeu de validation
- **Risque** : Meme corrige, le compteur restera approximatif : il manquera les formulations qui n'emploient aucune de ces formes, et il ne dira rien du ton. Il doit donc etre presente comme un indicateur a relire avec ses citations, jamais comme une mesure. Et il ne doit jamais declencher de reponse automatique : repondre a une accusation d'inauthenticite par un message genere serait exactement le geste a eviter.

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

## Reportées (1)

### R-20260902-01 — Suivre le reproche d'inauthenticite comme un signal nomme, sur les deux canaux

- **Gravité** : majeur · **Effort** : 45 min · **Proposé le** : 2026-09-02
- **Source** : revue 2026-09-02
- **Constat** : Trois personnes distinctes, sur deux canaux, reprochent a Lasclay de repondre par une IA ou de publier une image generee. Rien ne compte ce signal : la collecte suit les publications, les ecarts et les brouillons, mais pas ce reproche, qui est pourtant le seul a toucher directement la credibilite de la marque. Le troisieme cas est aussi le plus parlant : la personne demande explicitement a ne pas etre repondue par une IA, et le brouillon prepare pour elle attend depuis 48 jours.
- **Preuve** : 1) Facebook tir C, ecarte le 2026-08-31 : « FAKE - A-I - THIS FARMER IS NOT REAL - SHE IS A COMPUTER IMAGE », sur deux publications, la seconde 934359419303137. 2) Missive fil 640e6213, message du 2026-07-16 : « C'est ca l'effet des message realises par l'intelligence artificielle? ». 3) Missive fil df1ba00d, sujet du fil : « J'aimerais que ce ne soit pas l'intelligence artificielle qui reponde », portant un brouillon non envoye date du 2026-07-16.
- **Proposition** : Ajouter a collecte.js un compteur nomme « inauthenticite » qui balaie deux sources — les motifs et messages des fichiers a-revoir du backlog, et les sujets des fils Missive assignes — sur un jeu de formulations tenu dans un fichier versionne (intelligence artificielle, IA, A-I, AI, fake, robot, genere par ordinateur), et qui ressort le compte, les identifiants et la date du plus recent, de sorte que chaque tour puisse dire si le reproche progresse ou reflue.
- **Portée** : revue/collecte.js, un fichier de formulations versionne
- **Risque** : Une recherche par mots-cles ramassera des faux positifs — toute discussion sur l'IA en general, y compris favorable — et manquera les formulations qui n'emploient aucun de ces mots. Le compteur doit donc etre presente comme un indicateur a relire, jamais comme une mesure exacte, et chaque occurrence doit etre citee avec son texte pour que le tour puisse ecarter le bruit a la lecture. Ne jamais en tirer une reponse automatique : repondre a une accusation d'inauthenticite par un message genere serait exactement le geste a eviter.
- **Décidé le** : 2026-09-03
- **Note** : Teste a la main le 3 septembre : la specification produit 59 occurrences cote Facebook dont la quasi-totalite sont fausses. Le motif \bA-?I\b capte le verbe « ai » en francais (« j'ai rit », « j'ai achete »). Remplacee par R-20260903-01, qui exige des formes multi-mots et se valide sur les trois cas connus.

## Appliquées (0)

_rien._

## Refusées (0)

_rien._
