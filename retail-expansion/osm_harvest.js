#!/usr/bin/env node
// Moissonne OpenStreetMap (Overpass) autour de chaque zone-ancre canadienne les
// commerces correspondant aux archetypes de detaillants Lasclay, avec coordonnees.
// Requeter par rayon autour d'une ville canadienne evite de ramasser des commerces
// americains le long de la frontiere.
//
// Deux pieges corriges ici :
//  - Overpass renvoie un JSON valide mais vide avec un champ "remark" quand la
//    requete deborde. Sans verification, une grande ville rend 0 resultat en
//    silence. On detecte le remark et on refait la requete en plus petit.
//  - Les rayons se chevauchent entre zones voisines. On ne dedoublonne donc pas
//    a la moisson : l'affectation finale a la zone la plus proche se fait au
//    montage du chiffrier, a partir des coordonnees.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// Miroirs verifies sur des donnees canadiennes. Attention: overpass.osm.ch ne
// sert qu'un extrait suisse et renvoie 0 element sans erreur pour le Canada.
const MIRRORS = [
  'https://overpass.osm.jp/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const RAYON = 30000; // metres autour de la ville-ancre
const SORTIE = path.join(__dirname, 'osm_brut.json');

const CAT = {
  gift: 'Cadeaux / artisans',
  art: 'Galerie / artisans',
  craft: 'Artisanat / materiaux creatifs',
  zero_waste: 'Eco / zero dechet',
  refill: 'Eco / zero dechet',
  second_hand: 'Friperie / eco',
  health_food: 'Alimentation sante / bio',
  farm: 'Kiosque fermier / terroir',
  greengrocer: 'Kiosque fermier / terroir',
  garden_centre: 'Jardinerie / horticulture',
  florist: 'Fleuriste / jardin',
  outdoor: 'Plein air',
  sports: 'Plein air / sport',
  fishing: 'Chasse et peche',
  hunting: 'Chasse et peche',
  deli: 'Epicerie fine / terroir',
  cheese: 'Fromagerie / terroir',
  wine: 'Vin / spiritueux',
  alcohol: 'Vin / spiritueux',
  beverages: 'Boissons / brassage',
  books: 'Librairie independante',
  bag: 'Maroquinerie / sacs',
  interior_decoration: 'Deco / maison',
  houseware: 'Articles de maison',
};

// groupes de tags: des requetes plus petites passent sans deborder
const GROUPES = [
  ['gift', 'art', 'craft', 'zero_waste', 'refill', 'second_hand'],
  ['health_food', 'farm', 'greengrocer', 'garden_centre', 'florist'],
  ['outdoor', 'sports', 'fishing', 'hunting', 'bag'],
  ['deli', 'cheese', 'wine', 'alcohol', 'beverages'],
  ['books', 'interior_decoration', 'houseware'],
];

function get(url) {
  return new Promise((resolve) => {
    execFile('curl', ['-sS', '--max-time', '150', url], { maxBuffer: 100 * 1024 * 1024 },
      (err, stdout) => resolve(err ? '' : stdout));
  });
}

// renvoie les elements, ou null si la requete a echoue ou deborde
async function overpass(query, mirror) {
  for (const m of [...new Set([mirror, ...MIRRORS])]) {
    const body = await get(`${m}?data=${encodeURIComponent(query)}`);
    if (body && body.trim().startsWith('{')) {
      try {
        const d = JSON.parse(body);
        if (d.remark && !(d.elements || []).length) continue; // debordement
        return d.elements || [];
      } catch { /* miroir suivant */ }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  return null;
}

async function interroger(z, tags, mirror, rayon) {
  const q = `[out:json][timeout:150];nwr["shop"~"^(${tags.join('|')})$"]["name"]`
    + `(around:${rayon},${z.lat},${z.lon});out center tags;`;
  return overpass(q, mirror);
}

(async () => {
  // argument facultatif: ne moissonner que les zones dont le nom contient ce texte
  const filtre = process.argv[2] || '';
  const zones = JSON.parse(fs.readFileSync(path.join(__dirname, 'zones.json'), 'utf8'))
    .filter(z => z.lat && (!filtre || z.zone.includes(filtre)));
  // en moisson partielle, on conserve ce qui a deja ete ramasse
  let rows = [];
  if (filtre) { try { rows = JSON.parse(fs.readFileSync(SORTIE, 'utf8')); } catch { rows = []; } }
  let i = 0, fini = 0, echecs = 0;

  async function worker(mirror) {
    while (i < zones.length) {
      const z = zones[i++];
      const vus = new Set();
      let n = 0;
      for (const g of GROUPES) {
        let els = await interroger(z, g, mirror, RAYON);
        if (els === null) els = await interroger(z, g, mirror, 15000); // repli
        if (els === null) { echecs++; continue; }
        for (const e of els) {
          const t = e.tags || {};
          const lat = e.lat || (e.center && e.center.lat);
          const lon = e.lon || (e.center && e.center.lon);
          const key = `${(t.name || '').toLowerCase()}|${(lat || 0).toFixed(4)}`;
          if (vus.has(key)) continue;
          vus.add(key);
          rows.push({
            nom: t.name,
            type: CAT[t.shop] || 'Boutique / cadeaux',
            zone: z.zone,
            ville: t['addr:city'] || '',
            prov: z.prov,
            adresse: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
            cp: t['addr:postcode'] || '',
            tel: t.phone || t['contact:phone'] || '',
            courriel: t.email || t['contact:email'] || '',
            web: t.website || t['contact:website'] || '',
            lat, lon,
          });
          n++;
        }
        await new Promise(r => setTimeout(r, 400));
      }
      fini++;
      console.error(`[${fini}/${zones.length}] ${z.zone}: ${n} (total ${rows.length})`);
      if (fini % 5 === 0) fs.writeFileSync(SORTIE, JSON.stringify(rows, null, 1));
    }
  }

  await Promise.all(MIRRORS.map(m => worker(m)));
  fs.writeFileSync(SORTIE, JSON.stringify(rows, null, 1));
  console.log(`Total OSM: ${rows.length} (echecs de requete: ${echecs})`);
})();
