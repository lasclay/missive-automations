# Plan d'envoi et calendrier

Diffusion : **jeudi 17 septembre 2026, 20 h (20 h 30 NT), CBC et CBC Gem.**
CBC commence à publier sur l'épisode le **lundi 14 septembre**.

## Calendrier

Les vagues viennent du chiffrier. Le rythme aussi : **environ 60 messages par jour**, avec une
première ligne réellement différente pour chacun. Deux cents messages quasi identiques en dix
minutes se comportent comme du publipostage aux yeux des filtres.

| Date | Geste | Contacts | Pourquoi ce moment |
| --- | --- | ---: | --- |
| **→ 2 sept.** | Liste chaude, écrite à la main, un par un | 37 | Ils ont besoin de plus de temps pour placer un sujet, et ce sont les meilleures chances. |
| **3 → 5 sept.** | Froide A, les plus susceptibles de couvrir | 71 | Deux semaines d'avance, le délai normal d'un hebdo ou d'un magazine. |
| **8 → 9 sept.** | Froide B | 53 | |
| **9 sept.** | Relance unique sur les sans-réponse de la liste chaude | — | Six jours après le premier envoi. |
| **sam. 12 sept., 9 h** | Ouverture de la prévente | — | Klaviyo vers les clients. **Jamais vers ces listes.** |
| **lun. 14 sept.** | CBC commence à publier. Relais sur les réseaux, sans rien dire de l'issue. | — | On suit CBC, on ne les devance pas. |
| **15 → 16 sept.** | Froide C, s'il reste du souffle | 93 | |
| **jeu. 17 sept., 20 h** | Diffusion | | |
| **ven. 18 sept., 7 h** | Suivi aux sans-réponse : « c'est diffusé, on peut en parler » | — | La contrainte de confidentialité tombe. |

Le vendredi 18 est le moment le plus sous-estimé du plan. Un journaliste qui a dit non avant la
diffusion peut dire oui après, parce que le sujet est devenu vérifiable.

## Le cadre légal, en trois lignes

**Permis :** la sollicitation de presse ciblée vers une adresse professionnelle publiée sans
restriction d'usage. Le répertoire FPJQ est exactement ce cas.

**Plus fragile :** les adresses personnelles de pigistes (gmail, hotmail, vidéotron, outlook).
Elles sont signalées dans la colonne « Précaution » du chiffrier et exigent un message vraiment
individualisé.

**Interdit :** ajouter ces contacts à une liste de diffusion, leur envoyer une infolettre, ou leur
écrire sans objet journalistique réel.

## Réglages Missive avant le premier envoi

Depuis `media@lasclay.com`, un message à la fois. **Désactiver le suivi des ouvertures et des
clics** : le pixel n'apporte rien ici et plusieurs journalistes le voient d'un mauvais œil.

`alicia.chirrey@cbc.ca` et `kylee.habrowski@cbc.ca` sont l'équipe de production de l'émission, pas
la salle de nouvelles. Ils ne sont dans aucune des deux listes, volontairement. Ne pas les
solliciter.

## Envoi par le proxy Missive

`send` crée un **brouillon** par défaut : le message se dépose dans Missive et attend qu'un humain
appuie sur envoyer. C'est le bon mode ici. Ne jamais ajouter `"send": true` sur une prospection
médias.

```bash
echo '{"from":"admin@lasclay.com",
       "to":["journaliste@media.com"],
       "subject":"...",
       "body":"..."}' | node missive_client.js send
```

**Cinq destinataires maximum par appel**, `to` + `cc` + `bcc` confondus. C'est une limite du proxy,
et elle est bien placée : au-delà, ce n'est plus de la prospection ciblée, c'est un envoi de masse,
et ça se fait dans un outil d'infolettre, pas ici.

En pratique, cela veut dire **un appel par journaliste**, en `to` seul. Un communiqué envoyé à 40
personnes en copie conforme se reconnaît en une seconde et se supprime aussi vite.

## Ce qui doit être vérifié avant le premier envoi

- [ ] Gabriel valide le communiqué FR et EN.
- [ ] Confirmer la date de publication du communiqué (le texte dit 2 septembre).
- [ ] Confirmer que `media@lasclay.com` est bien surveillée pendant les deux prochaines semaines.
- [ ] Trouver les courriels de Sophie Poisson (Baron Mag), Caroline Bertrand (ICI Explora) et
      Karine Benoist (Châtelaine). Elles ont mentionné Lasclay et manquent aux deux listes.
- [ ] Trouver le courriel d'Antoine Stab (Espaces) et vérifier qu'il y est toujours.
- [ ] Confirmer que Stéphanie Bérubé signe bien « La sinueuse route de la soie du Nord »
      (La Presse, 2026-02-23). Ne pas déduire un nom d'une adresse courriel.
- [ ] Décider si les chiffres financiers sont autorisés pour l'angle E. Par défaut : non.
- [ ] Préparer les photos haute résolution hors dossier CBC. Le matériel CBC sert à annoncer la
      diffusion, pas à illustrer un portrait d'entreprise.

## Les trois questions qui vont revenir, et les réponses

**« Comment ça s'est passé ? »**
> Je ne peux pas en parler avant le 17. C'est dans l'entente que j'ai signée.

**« Vous ne fabriquez plus au Québec ? »**
> L'asclépiade est cultivée au Québec et l'isolant est transformé à notre atelier de Limoilou.
> L'assemblage textile de la plupart des produits finis se fait à l'externe, notamment en Tunisie,
> depuis 2025. C'est ce qui a permis un manteau autour de 300 $ au lieu de plus de 500 $. Ça a un
> coût symbolique et je ne prétends pas le contraire.

**« Est-ce que ça sauve les monarques ? »**
> Pas directement, et je me méfie des gens qui disent le contraire. Un achat ne sauve pas un
> papillon. Ce qu'on essaie de bâtir, c'est une raison économique de garder l'asclépiade dans les
> champs. S'il y a plus d'asclépiade, il y a plus d'habitat de reproduction. Le lien est
> systémique.
