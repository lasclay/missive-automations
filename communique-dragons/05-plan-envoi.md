# Plan d'envoi et calendrier

Diffusion : **jeudi 17 septembre 2026, 20 h (20 h 30 NT), CBC et CBC Gem.**
CBC commence à publier sur l'épisode le **lundi 14 septembre**.

## Calendrier

| Date | Geste | Pourquoi ce moment |
| --- | --- | --- |
| **mar. 2 sept.** | Envoi angle A (journalistes qui ont déjà couvert) | Ils ont besoin de plus de temps pour placer un sujet, et ce sont les meilleures chances. Un par un, à la main. |
| **mer. 3 sept.** | Envoi angles C, D, E, F, G | Deux semaines d'avance, c'est le délai normal d'un hebdo ou d'un magazine. |
| **jeu. 4 sept.** | Envoi angles B et H | Les pupitres régionaux et le Canada anglais planifient plus court. |
| **lun. 8 sept.** | Envoi angle I (radio et télé) | Les matinales bookent à environ une semaine. Plus tôt, elles oublient. |
| **mar. 9 sept.** | Relance unique sur les sans-réponse | Six jours après le premier envoi. |
| **lun. 14 sept.** | CBC publie. Relais sur les réseaux Lasclay, sans rien dire de l'issue. | On suit CBC, on ne les devance pas. |
| **jeu. 17 sept., 20 h** | Diffusion | |
| **ven. 18 sept., 7 h** | Courriel de suivi aux contacts qui n'ont pas répondu, angle « c'est diffusé, on peut en parler » | La contrainte de confidentialité tombe. C'est là que l'histoire devient racontable au complet, et c'est souvent là que ça décolle. |

Le vendredi 18 est le moment le plus sous-estimé du plan. Un journaliste qui a dit non avant la
diffusion peut dire oui après, parce que le sujet est devenu vérifiable.

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
- [ ] Aller lire les signatures manquantes à la source : Le Soleil Affaires 2024, Le Soleil / La
      Tribune décembre 2025, La Presse 23 février 2026. Ne pas déduire un nom d'une adresse
      courriel.
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
