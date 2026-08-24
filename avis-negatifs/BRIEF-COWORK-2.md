# Brief pour Cowork, deuxième passe : ce qui manque encore

Ce brief reprend là où `RAPPORT-LECTURE-FICHE.md` s'est arrêté : « le rendu de la console est
devenu instable en fin de session ». Il ne remplace pas `BRIEF-COWORK.md`, il le termine, et il
ajoute une chose qui n'était pas demandée la première fois : **les captures d'écran**.

Il faut un agent avec un **navigateur** et la **session Google de Lasclay**.

## Ce qui bloque en ce moment

Dix-sept messages privés sont rédigés dans `messages.md` et quinze réponses publiques dans
`reponses-publiques.md`. **Rien ne peut partir tant que ces quatre trous ne sont pas bouchés.**

| # | Trou | Ce que ça bloque |
| --- | --- | --- |
| 1 | 5 avis jamais atteints | 4 messages privés ne peuvent pas être envoyés, 1 réponse publique ne peut pas être écrite |
| 2 | 3 textes tronqués + 1 réponse publique non relevée | la réponse à Marie L., qui est la plus urgente de la fiche |
| 3 | **Aucune capture d'écran** | les 17 messages privés en contiennent une, obligatoire |
| 4 | 4 jours écoulés depuis la lecture | une note peut avoir bougé, un avis peut être arrivé |

## Périmètre : lecture seule, sans exception

| Autorisé | Interdit |
| --- | --- |
| Ouvrir la fiche et lire les avis | Cliquer « Répondre » ou publier quoi que ce soit |
| Copier le texte intégral d'un avis | Signaler, masquer ou demander la suppression d'un avis |
| Prendre des captures d'écran | Écrire à un client, par courriel ou autrement |
| Écrire dans le dépôt | Modifier `messages.md` ou `reponses-publiques.md` |

**Aucun avis ne se signale à Google**, même celui qui fait le plus mal. Signaler un avis qui
déplaît est le meilleur moyen de perdre la fiche.

## Où aller

- Console propriétaire : <https://business.google.com/n/715788570095415146/reviews>
- Fiche publique : `https://www.google.com/maps/place/?q=place_id:ChIJeXcP65DHd6YRhr5TXMN_4-M`
- Repères : `place_id ChIJeXcP65DHd6YRhr5TXMN_4-M` · `ludocid 16421109143367302790` ·
  `feature_id 0xa677c790eb0f7779:0xe3e37fc35c53be86`

**La méthode qui a marché la première fois, à reprendre telle quelle :** dans la console, cliquer
le sélecteur de tri en haut de la liste et choisir **« La note la moins élevée »**. Tous les avis
de 1 à 3 étoiles se regroupent en tête. Ensuite **le clavier, pas la souris** : Tab, puis Entrée
sur « Afficher l'avis complet ». C'est ce qui déroule la liste de façon fiable.

---

# Tâche 1 : les captures d'écran (la nouveauté, et la plus longue)

Chaque message privé remet son avis sous les yeux du client, parce que ces gens ont écrit il y a
des mois et parfois des années. Il faut donc **une image par avis**.

## Où capturer

**Sur la fiche publique, pas dans la console.** La console affiche une interface d'administration
avec des boutons « Répondre » et « Signaler ». Envoyer ça à un client donne l'impression qu'on lui
montre son dossier interne. La fiche publique montre exactement ce que n'importe qui voit.

Trouver l'avis dans la console si c'est plus rapide, puis aller le recapturer côté public.

## Comment capturer

1. Déplier l'avis au complet (« Plus », « Afficher l'avis complet »).
2. Si Google affiche une traduction, cliquer **« Voir l'original »** avant de capturer. Un client
   francophone ne doit pas recevoir la version anglaise de son propre texte.
3. Cadrer **la carte de l'avis seule** : nom d'auteur, étoiles, date, texte complet. Rien du reste
   de la page, aucune barre de navigation, aucun avis voisin.
4. Si Lasclay a déjà répondu sous l'avis, **inclure la réponse dans le cadrage**.
5. Format **PNG**, thème clair, largeur suffisante pour que le texte reste lisible sans zoom.

## Où déposer

Dans `avis-negatifs/captures/`, nommées en minuscules sans accent :

```
avis-negatifs/captures/tim-sullivan.png
avis-negatifs/captures/yingyan-zhu.png
avis-negatifs/captures/stephane-vincent.png
...
```

## Les 17 captures nécessaires

Ce sont les 17 destinataires des messages privés. Les treize premières concernent des avis dont
le texte est déjà connu : la capture est la seule chose qui manque.

| # | Auteur sur la fiche | Note connue | Capture | Texte |
| --- | --- | --- | --- | --- |
| 1 | Tim Sullivan | 1★ | à faire | connu |
| 2 | Stephane Vincent | 1★ | à faire | connu |
| 3 | Patrick Lessnick | 2★ | à faire, **avec la mise à jour visible** | connu |
| 4 | toby lanthier | 1★ | à faire | connu |
| 5 | Nathalie Durand | 2★ | à faire | connu |
| 6 | Charlotte Bourgoing | 1★ | à faire | connu |
| 7 | Annie Hubert | 1★ | à faire | connu |
| 8 | Sonia Pouliot | 1★ | à faire | connu |
| 9 | Melanie Boucher | 1★ | à faire | connu |
| 10 | Susan Lockhart | 1★ | à faire, **avec la réponse de Lasclay visible** | connu |
| 11 | Jimmy Allaire | 3★ | à faire | **tronqué, voir tâche 2** |
| 12 | Ariane Poirier | 2★ | à faire | **tronqué, voir tâche 2** |
| 13 | Marie Blouin | 2★ | à faire | **tronqué, voir tâche 2** |
| 14 | Yingyan Janet Zhu | 1★ | à faire | **inconnu, voir tâche 3** |
| 15 | Sarah Resch | 1★ | à faire | **inconnu, voir tâche 3** |
| 16 | Guillaume Lanteigne-Voyer | 2★ | à faire | **inconnu, voir tâche 3** |
| 17 | Sylvie Internoscia | 2★ | à faire | **inconnu, voir tâche 3** |

**Si un de ces avis n'est plus en ligne**, ne pas fabriquer de capture : le noter, c'est une
information qui change le message (voir tâche 4).

---

# Tâche 2 : les trois textes tronqués, plus une réponse publique

La coupure tombe pile sur le mot qui compte. Il faut le texte **intégral et verbatim**, sans
correction, sans traduction, sans résumé.

| Auteur | Ce qu'on a | Ce qu'il faut |
| --- | --- | --- |
| **Jimmy Allaire** · 3★ | « elles sont bien chaudes, mais le hic est qu'elles ne sont pas assez rigides et qu'après… » | la fin de la phrase : après combien de temps, et ce qui arrive |
| **Ariane Poirier** · 2★ | « On ne répond pas aux courriels sous prétexte que c'est une forte période où ils reçoivent… » | la suite complète |
| **Marie Blouin** · 2★ | « Après plusieurs courriels et des mois d'attente, toujours aucune vraie réponse de… » | la suite complète, et surtout **quel produit** |

Et une réponse publique jamais relevée :

| Sous quel avis | Pourquoi elle est urgente |
| --- | --- |
| **patrick lambert** · 1★ · fabrication hors Québec | La réponse à **Marie L.** porte sur exactement le même grief et doit se tenir avec celle-là sans la répéter ni la contredire. Impossible de l'écrire à l'aveugle |

Relever aussi, tant qu'à y être, le **texte intégral des deux autres réponses publiques**, sous
**Susan Lockhart** et **Cyr-Marc Debien**. On n'en a que des bouts cités.

---

# Tâche 3 : les cinq avis jamais atteints

Ceux-là bloquent des envois. Pour chacun : texte intégral, note relue sur la fiche, date, réponse
publique s'il y en a une, et la capture.

| Priorité | Auteur | Ce que ça débloque |
| --- | --- | --- |
| 1 | **Yingyan Janet Zhu** · 1★ | Message privé prêt, offre maximale (remboursement 116,45 $ + 2 articles + carte 200 $) |
| 2 | **Sarah Resch** · 1★ | Message privé prêt, carte 100 $. Cliente revenue **cinq fois** depuis |
| 3 | **Guillaume Lanteigne-Voyer** · 2★ | Message privé prêt, carte 100 $. Client revenu **six fois** depuis |
| 4 | **Sylvie Internoscia** · 2★ | Message privé prêt, paire offerte + carte 100 $ |
| 5 | **David** · 1★ · 23 déc. 2025 | **Non identifié dans Shopify.** Prénom seul, dix « David » ont commandé dans la fenêtre. S'il nomme un produit, une ville ou une date, on peut enfin savoir qui c'est. Sinon, réponse publique seulement |

Pour ces cinq, la **note affichée aujourd'hui** compte autant que le texte : elle a pu monter
depuis la notification Gmail, comme c'est arrivé pour quatre autres auteurs.

---

# Tâche 4 : revérifier l'état des 17, et le compteur

Quatre jours se sont écoulés depuis la première lecture, et la dernière fois un avis 1★ est arrivé
**pendant** la session. Avant qu'un seul message parte, il faut savoir où on en est.

Pour chacun des 17 destinataires, confirmer :

- l'avis est **toujours en ligne** (`present`) ;
- la **note affichée aujourd'hui** ;
- s'il a été **modifié ou complété** depuis.

C'est une vérification qui a déjà servi : quatre auteurs avaient relevé leur note sans qu'on le
sache, et quatre brouillons étaient devenus faux.

Reprendre aussi les deux chiffres de contrôle :

- **note globale** de la fiche (4,4 / 5 à la dernière lecture) ;
- **nombre total d'avis** (132 à la dernière lecture).

Et signaler **tout avis de 1 à 3 étoiles absent de `google_avis_negatifs.tsv`**, y compris ceux
publiés depuis le 20 août.

## Une vérification en passant

Pendant que la fiche est ouverte : est-ce qu'elle affiche l'entreprise comme **ouverte, fermée ou
fermée définitivement**? La question est restée en suspens dans le dossier et elle pèse lourd sur
la conversion, bien plus qu'un avis négatif.

---

# Ce qu'il faut écrire

## 1. `avis-negatifs/avis-complets.jsonl`

Un objet JSON par ligne. **Remplacer** les lignes existantes des auteurs relus, **ajouter** celles
des cinq nouveaux. Un champ de plus par rapport à la première passe : `capture`.

```json
{"nom":"Jimmy Allaire","etoiles":3,"date":"2026-03-02","present":true,
 "texte":"<texte intégral, verbatim, déplié, dans la langue d'origine>",
 "reponse_proprietaire":null,
 "capture":"avis-negatifs/captures/jimmy-allaire.png",
 "note":"<écart avec notre liste, ou vide>"}
```

`capture` vaut `null` si l'avis n'est plus en ligne.

## 2. `avis-negatifs/captures/*.png`

Les 17 images, nommées comme au tableau de la tâche 1.

## 3. Un résumé en clair, sans JSON

- La note globale et le nombre d'avis **aujourd'hui**, et l'écart avec 4,4 / 5 et 132.
- Combien des 17 sont toujours en ligne, combien ont changé de note, combien ont disparu.
- **Ce que disent vraiment les trois textes tronqués**, en particulier la fin de la phrase de
  Jimmy Allaire sur les semelles : c'est un défaut produit, pas un grief de service.
- Le texte des trois réponses publiques déjà en ligne.
- Ce que l'avis de **David** permet ou ne permet pas d'identifier.
- Les avis inconnus trouvés en chemin.
- L'état ouvert / fermé de la fiche.

## 4. Pousser

```
git checkout claude/lasclay-negative-reviews-outreach-g2ddoc
git pull --rebase
git add avis-negatifs/avis-complets.jsonl avis-negatifs/captures/
git commit && git push
```

---

# Ce que ça débloque

| Une fois fait | Ce qui devient possible |
| --- | --- |
| Les 17 captures | Les 17 messages privés peuvent partir, étalés sur deux ou trois semaines |
| Les 5 avis lus | 4 messages débloqués, et l'identité de David tranchée |
| Le texte de Jimmy Allaire | Le message cesse de reposer sur une demi-phrase, et le défaut de semelle remonte à la conception |
| La réponse à patrick lambert | La réponse publique à **Marie L.** peut s'écrire. C'est la plus urgente de la fiche : deuxième avis en trois mois sur la fabrication en Tunisie |
| Les notes revérifiées | Aucun message ne part sur une prémisse fausse |

---

⚠️ **Deux rappels qui valent pour toute la suite.**

**Ne jamais conditionner** une carte-cadeau, un remboursement ou un remplacement au retrait ou à
la modification d'un avis. Les messages de `messages.md` suggèrent une mise à jour, en dernière
ligne, après que le geste a été annoncé comme fait et sans contrepartie. **Cet ordre est la
protection** : il ne se change pas.

**Ne jamais faire remarquer à un client qu'on voit son avis tronqué.** La coupure est de notre
côté ; chez lui, son avis est complet. Le lui dire, ou lui demander de « compléter sa phrase »,
révèle qu'on n'a pas su lire ce qu'il a écrit.
