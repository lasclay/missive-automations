#!/bin/bash
# Ramasse les adresses masquees par Cloudflare (data-cfemail) et les mailto encodes.
d="$1"
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
for p in / /contact /contact-us /contactez-nous /nous-joindre /a-propos /about /about-us \
         /equipe /notre-equipe /team /masthead /staff /contactez-nous/ /nous-joindre/ \
         /soumettre /tips /pitch /salle-de-presse /presse /medias; do
  curl -s -L --max-time 8 -A "$UA" "https://$d$p" 2>/dev/null
done | grep -oiE 'data-cfemail="[0-9a-f]+"|#[0-9a-f]{20,}' | grep -oiE '[0-9a-f]{20,}' \
  | sort -u | sed "s|^|$d\t|"
