# Politiques Shopify (Paramètres > Politiques)

Copies maîtresses des politiques rédigées le 4 septembre 2026, en français (langue principale) et en
anglais. La source de vérité côté boutique reste
Paramètres > Politiques; on recolle ces fichiers en cas de page abîmée.

| Fichier | Politique Shopify | Faits utilisés |
| --- | --- | --- |
| `expedition.fr.html` / `.en.html` | Shipping policy | tarifs du profil d'expédition « Profil général » (Canada, États-Unis, UK, Euro-FR, AUS+NZ, Mexique), points de cueillette, règles de la FAQ |
| `mentions-legales.fr.html` / `.en.html` | Legal notice | raison sociale et adresses (Shopify, QuickBooks), courriels de la page Contact, numéro d'entreprise ARC (QuickBooks) |

Numéros fournis par Lasclay le 4 septembre 2026 : NEQ 1177782068, NE Canada 713032803, TPS 713032803 RT0001,
TVQ 1229731102 TQ0001. Les tarifs internationaux sont ceux du 4 septembre 2026 : à réviser si le profil
d'expédition change. L'API n'a pas le droit `write_legal_policies` : les textes se collent à la main dans
Paramètres > Politiques (mode HTML), la version anglaise dans Translate & Adapt ou Langify.
