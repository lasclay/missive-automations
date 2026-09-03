# Les listes médias : ce que l'assignation a donné

Source : `Lasclay_listes_medias_2026.xlsx`, préparé le 31 août 2026.
Résultat : `Lasclay_listes_medias_2026_angles.xlsx`, produit par `assigner_angles.py`.

Le script ajoute quatre colonnes (Angle, Objet suggéré, Salutation, Précaution) et un onglet
« Plan d'envoi ». Il ne touche à aucune donnée récoltée, ni aux colonnes jaunes réservées au suivi.

## Deux événements, pas un

Le chiffrier couvre **la prévente d'automne du samedi 12 septembre, 9 h** en plus de la diffusion
du 17. Pour les médias, c'est la diffusion qui est la nouvelle. La prévente se joue dans Klaviyo,
vers les clients, et **jamais vers ces listes** : des rebonds sur des adresses froides
dégraderaient `mail.lasclay.com`, le domaine qui doit livrer l'infolettre de prévente.

## Répartition des 254 contacts

| Angle | Contacts | Ce que le courriel doit faire |
| --- | ---: | --- |
| A — a déjà couvert Lasclay | 34 | Citer son article par titre et année dès la première phrase |
| B — média régional | 35 | Nommer la région dans l'objet |
| C — agriculture et filière | 32 | Y a-t-il enfin un acheteur stable au bout du champ |
| D — environnement et monarques | 45 | La conservation par le débouché, sans greenwashing |
| E — affaires et manufacturier | 26 | Rapatrier puis délocaliser en partie |
| F — plein air et équipement | 20 | Offrir de tester plutôt que de convaincre |
| G — style de vie et design | 21 | Le contraste visuel gousse, soie, manteau |
| H — presse anglophone | **0** | voir plus bas |
| I — radio et télévision | 39 | Trois lignes, disponibilité en clair |
| J — a couvert l'asclépiade, jamais Lasclay | 2 | Partir de sa propre couverture de la filière |

## Ce que le dépouillement a changé

**Trois journalistes qui ont mentionné Lasclay manquaient aux deux listes.** Ajoutés à la liste
chaude, sans courriel : Sophie Poisson (Baron Mag, 2020-11-10), Caroline Bertrand (ICI Explora,
2021-09-28), Karine Benoist (Châtelaine, 2023-11-29). Leurs adresses ne figurent ni dans la boîte
LAS Media ni au répertoire FPJQ. Aucune n'a été devinée.

**Deux signatures confirmées, une rendue probable.** Annie Lafrance signe Le Soleil Affaires du
20 avril 2024. Chloé Pouliot signe « Lasclay devant le dilemme de fabriquer au Québec », repris
par Le Soleil, La Tribune et Le Droit le 1er décembre 2025. Stéphanie Bérubé est probablement
l'autrice de « La sinueuse route de la soie du Nord » (La Presse, 23 février 2026) : c'est la
seule contact de la liste chaude dont la date de dernier échange coïncide exactement. À confirmer,
pas à affirmer.

**Deux doublons.** Annie Lafrance et Francis Higgins, tous deux du Soleil, figuraient dans la
liste chaude **et** dans la liste froide en priorité C. Leur ligne froide est neutralisée, pas
supprimée, pour que le chiffrier garde sa traçabilité. Sans ce contrôle, chacun aurait reçu un
message écrit à la main puis une sollicitation froide.

**Un angle est né du dépouillement.** L'angle J couvre les journalistes qui ont suivi la filière
pendant des années sans jamais avoir parlé à Lasclay. Jean-Michel Leprince (Radio-Canada, nombreux
reportages au Téléjournal depuis 2014) et Antoine Stab (Espaces, 2015). Ce sont les meilleurs
contacts froids du dossier, et les plus faciles à gâcher : ils ont déjà raconté la faillite
d'Encore3, de Fibre Monark et de Protec-Style, et il leur manque seulement la suite.

## Deux constats à trancher par Gabriel

**L'angle H n'a aucun contact.** Les deux listes sont entièrement de presse francophone. Les sept
fiches classées « Canada anglais » ou « Ontario » au répertoire FPJQ sont Radio-Canada, TFO et
Le Devoir : la francophonie hors Québec, pas la presse anglophone. Pour une émission de CBC
diffusée dans tout le Canada, c'est un trou réel. Le communiqué anglais existe et attend une
liste. Une liste anglophone se bâtirait autour du Globe and Mail, du National Post, de BetaKit,
des quotidiens de Toronto, Calgary et Vancouver, et de la presse plein air canadienne-anglaise.

**Le dépouillement du web n'est pas exhaustif.** Radio-Canada, La Presse, Le Devoir et laterre.ca
refusent la lecture automatisée (HTTP 403), et les moteurs ne renvoient pas les signatures. Les
articles suivants sont identifiés sans leur auteur : « L'impasse persiste dans le dossier de
l'asclépiade », « La soie d'Amérique passe en production industrielle », « L'industrie de la soie
d'Amérique relancée », « Le principal client des producteurs d'asclépiade fait faillite » (tous
Radio-Canada), et « La soie d'Amérique comme substitut au polyester ? » (Le Devoir). Chacun est un
candidat sérieux à l'angle J. Les récupérer demande d'ouvrir les pages à la main.

## Deux pièges de données, corrigés

Ils valent d'être notés, parce qu'ils se reproduiraient sur n'importe quelle liste FPJQ.

**« Radio-Canada » contient « radio ».** Une détection naïve des antennes envoyait toute la salle
de nouvelles écrite vers l'angle radio-télé : 62 contacts au lieu de 39. La règle ne reconnaît
maintenant que les antennes réelles, `(Radio - Montréal)`, RDI, TVA, Noovo, TFO, Radio VM.

**« Canada anglais » ne veut pas dire anglophone.** Au répertoire FPJQ, c'est la francophonie hors
Québec. Sept journalistes francophones auraient reçu un argumentaire en anglais.

## L'ordre de la cascade est un choix éditorial

L'environnement touche 127 des 217 fiches froides. Le placer tôt aurait mis presque tout le monde
en angle D, c'est-à-dire dans l'argumentaire le plus générique et le plus concurrencé du dossier.
L'agriculture passe donc devant, volontairement : l'effondrement de 2018 est le récit le moins
banal de Lasclay, et tout journaliste qui couvre l'agriculture le trouvera plus pertinent qu'un
énième texte sur le monarque.

## Régénérer

```bash
python3 assigner_angles.py <source.xlsx> <destination.xlsx>
```

Dépendance : `openpyxl`. Le script est idempotent, il relit toujours la source d'origine.
