# Revue quotidienne — samedi 12 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-12T04:00Z → 2026-09-13T04:00Z.
Preuves : `revue/jour/2026-09-12/collecte.json`, API Meta, **API Shopify en lecture seule**.

**71 réponses publiées, 71 confirmées, 0 erreur** (A 0, B 1, C 33, D 37). 43 commits. Proxys à 200
(`general-proxy` à 12,5 s : réveil Render). **Zéro échec 502, septième jour.**

## 1. Six personnes en quatre jours — et cette fois j'ai la cause probable — **bloquant**

Deux nouveaux rapports aujourd'hui, les plus explicites à ce jour :

> *« I ordered seed but the order website was crap. One of the option[s]… »*
> *« I have tried to order but it. Is. Impossible »*

Ce qui fait **six signalements en quatre jours** (9, 10 ×2, 11, 12 ×2), tous sur la page
Milkweed & Monarchs, tous en anglais.

### Ce que l'API Shopify dit du produit, en lecture seule

| | |
| --- | --- |
| Produit | « Graines d'asclépiade », `milkweed-seeds` |
| Statut | **ACTIVE** |
| Inventaire total | **1 002** — donc pas une rupture de stock |
| **Nombre de variantes** | **33** |
| Devise affichée | **CAD** |
| Description | *« Prévente — livrable en novembre 2026. »* |

Quatre faits qui, ensemble, expliquent les six commentaires sans qu'il faille tester la caisse :

1. **33 variantes** sur un sachet de graines. *« One of the options… »* et *« too hard to order »*
   décrivent exactement un sélecteur qu'on n'arrive pas à franchir.
2. **C'est une prévente livrable en novembre 2026.** Une personne aux États-Unis qui veut semer cet
   automne ne trouve pas ce qu'elle croit acheter.
3. **Les prix sont en CAD**, sur une page dont le public est américain.
4. **L'inventaire est plein** : ce n'est pas « épuisé », c'est le chemin d'achat.

### Ce que je ne fais pas

Je ne tente pas de commande. Vérifier si la caisse **échoue** — *« my order wouldn't go through »*
suggère un échec dur, pas seulement de la confusion — demande d'ouvrir le tunnel en conditions
américaines avec un navigateur. Soixante secondes pour un humain ; de l'argent réel sur un système
de production pour moi. La question est cadrée, elle n'est pas à moi.

**Ce qu'il en coûte :** six personnes ont pris la peine de l'écrire en public. Celles qui n'écrivent
pas ferment l'onglet.

## 2. Le seuil de fraîcheur du tir A donne maintenant une fausse alerte **rouge**

La collecte déclare ce soir **`PÉRIMÉE (35,5 h)`** sur le tir A — première alerte rouge depuis que
je le suis. **Elle est fausse**, et je l'ai vérifiée de la même façon que j'avais vérifié le faux
vert :

| Publication | Commentaires du public | Traités par le tir A | Inconnus |
| --- | --- | --- | --- |
| 10 sept (la plus récente) | 3 | 3 | **0** |
| 8 sept | 7 | 5 | 2 — *« Bravo!👏 »*, *« Bravo! »* |

Le tir A n'a rien laissé derrière lui. Les 35,5 heures de silence sont l'absence de matière, pas
l'absence de tir.

Le même instrument a donc produit **six jours de faux vert** (4–9 septembre, quand je le croyais en
panne) puis **du faux rouge** (ce soir, quand il va bien). Un seuil en heures ne peut pas juger une
routine dont la charge varie de 115 éléments à zéro : il mesure le temps, alors que la question est
*reste-t-il du travail non fait ?*

C'est la seule chose que je propose ce soir, et elle est maintenant fondée sur trois vérifications
manuelles concordantes plutôt que sur une intuition.

## 3. Récidives

| Constat | Signalé les | État |
| --- | --- | --- |
| Campagne à vide | 30 août – 12 sept | **37 jours** |
| Écarts du tir D non comptés | 30 août – 12 sept | **915 entrées, 0 `ecarte_le`** |
| Escalades sans sortie | 31 août – 12 sept | **43** |
| Brouillons non envoyés | 31 août – 12 sept | 11, le plus vieux à **59 jours** |
| `buildFilter` non fusionné | 31 août – 12 sept | treizième soir |
| Doublons publics | 5–12 sept | huitième jour |

## 4. Ce qui attend Gabriel

1. **Le chemin d'achat des graines.** Six personnes, quatre jours, cause probable identifiée :
   33 variantes, prévente à novembre 2026, prix en CAD sur un public américain. Ouvrir la page
   comme une cliente américaine tranche la question.
2. **Les 43 escalades** — c'est là que les six rapports dorment.
3. **La campagne points de vente** — 37 jours.
4. **Les 11 brouillons**, les **doublons publics**.

**Registre : dix `proposee`, deux `reportee`, zéro `approuvee` — quinzième soir sans décision.**

## 5. Amélioration proposée

- **`R-20260912-01`** *(majeur)* — Juger les tirs du backlog sur le travail qui reste, pas sur le
  temps écoulé.
