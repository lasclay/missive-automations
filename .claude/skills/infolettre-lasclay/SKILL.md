---
name: infolettre-lasclay
description: Rédiger une infolettre (newsletter) Lasclay dans le style exact de la marque. Utiliser dès qu'on demande d'écrire, rédiger, réviser ou créer une infolettre, une newsletter, une campagne courriel, un objet de courriel ou un preview text pour Lasclay — en français ou en anglais. Va chercher sur GitHub le guide de style complet et l'archive des 325 infolettres réellement envoyées depuis 2020.
---

# Écrire une infolettre Lasclay

Lasclay a envoyé **325 infolettres entre 2020 et 2026**. Elles sont archivées avec leur
mise en page complète, et un guide de style mesuré sur ce corpus existe. **Ne jamais écrire
d'infolettre Lasclay de mémoire ou d'intuition : toujours charger le guide d'abord.**

## Comment aller chercher les fichiers

Le dépôt `lasclay/missive-automations` est **privé** : `curl` sur
`raw.githubusercontent.com` renvoie 404 sans jeton. Deux chemins fonctionnent :

1. **Si on travaille déjà dans le dépôt `missive-automations`** (le cas courant) : lire les
   fichiers directement sur disque, dans `infolettres/`. C'est le plus simple et le plus rapide.
2. **Sinon**, utiliser l'outil GitHub MCP :
   `mcp__github__get_file_contents` avec `owner: lasclay`, `repo: missive-automations`,
   `path: infolettres/GUIDE-REDACTION.md`. (Ajouter `ref` seulement si le contenu n'est pas
   encore fusionné dans la branche par défaut.)

## Étape 1 — Charger le guide de style (obligatoire)

Fichier : **`infolettres/GUIDE-REDACTION.md`**

Il contient tout : le ton et les sept règles non négociables, le tutoiement vs vouvoiement
(⚠️ la marque **vouvoie** depuis 2025), la structure canonique en 11 blocs, les règles
d'objet et de preview text, la palette exacte (`#D4AD67` doré signature, `#222222` texte,
`#727272` pied), la typographie (Arial, 14 px, interligne 1.5, crénage 0), la spécification
des boutons et des images, les formules réutilisables, le calendrier éditorial, les
contraintes LCAP et la liste de contrôle finale.

## Étape 2 — Trouver les précédents pertinents

**`infolettres/INDEX.md`** donne les 325 envois avec date, objet, preview, langue, type et
audience.

Repérer 2 ou 3 envois du **même type** (prévente/lancement, promotion/vente, mission et
plantation, concours, suivi de commande, infolettre générale saisonnière, B2B) et de la
**même saison**, puis lire leur transcription intégrale dans le fichier de leur année :
`infolettres/infolettres-2020.md` … `infolettres-2026.md`.

**Privilégier 2025-2026** : c'est la voix actuelle (vouvoiement, objets courts, séries de
réchauffement). Les fichiers d'année sont volumineux (jusqu'à ~650 Ko) — n'extraire que les
sections utiles, par exemple :

```bash
awk '/^## 2026-03-14/,/^## 2026-04/' infolettres/infolettres-2026.md
```

Pour le rendu exact (pixel-perfect) d'un envoi donné :
`infolettres/html/<date>-<slug>.html`.

## Étape 3 — Rédiger

Suivre la structure canonique du guide. Les points sur lesquels une infolettre Lasclay se
reconnaît immédiatement :

1. **C'est Gabriel, co-fondateur, qui parle** — première personne, jamais de voix corporative.
2. **La vérité d'abord**, y compris les retards, bugs et erreurs : on les annonce soi-même.
3. **La mission (papillon monarque, asclépiade, territoire québécois) avant le produit.**
4. **Vouvoyer.**
5. Ouvrir sur `Bonjour {{ first_name }},` puis fermer sur `Chaleureusement,` +
   **Gabriel** / Co-fondateur / Lasclay.
6. Une seule idée, un seul appel à l'action, ~400 mots.
7. Objet ~36 caractères, preview text **complémentaire** (motif fréquent : « + autre chose »).

Livrer : **objet**, **preview text**, puis le corps avec les blocs `[IMAGE]` et `[BOUTON]`
explicités (libellé, URL, couleurs) comme dans les transcriptions de l'archive, pour que le
montage dans Klaviyo soit direct.

## Étape 4 — Vérifier

Repasser la liste de contrôle de la section 9 du guide avant de livrer. En particulier :
aucune ombre portée, aucun crénage non nul, aucune police autre qu'Arial, boutons `#D4AD67`
à texte blanc, liens dorés soulignés avec libellé explicite, pied de page avec l'adresse
`298 Boulevard des Capucins, Québec, QC, G1J3R4` et `{% unsubscribe 'Se désabonner' %}`.

## Monter la campagne dans Klaviyo

Audiences standard d'un envoi FR de grande portée (trio historique) :

| Audience | ID |
|---|---|
| Newsletter Français | `TGKgFC` |
| LAS Customer QC (All time) | `T8qXdj` |
| JdC - Acquisition courriels | `VEMFYt` |

Exclusion habituelle : `UG8xUu` (unsub + inactif). Expéditeur invariable :
`Lasclay <hey@lasclay.com>`. Les outils MCP Klaviyo (`create_campaign`,
`create_email_template`, `assign_template_to_campaign_message`) permettent de créer le
brouillon ; le connecteur `klaviyo` du proxy général est en **lecture seule**.
