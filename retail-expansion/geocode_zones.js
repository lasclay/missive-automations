#!/usr/bin/env node
// Geocode les villes-ancres des zones (Nominatim) pour permettre l'affectation
// d'un commerce a sa zone par distance quand la ville n'est pas renseignee.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const zones = JSON.parse(fs.readFileSync(path.join(__dirname, 'zones.json'), 'utf8'));

const PROV_NOM = { QC: 'Quebec', ON: 'Ontario', BC: 'British Columbia', AB: 'Alberta',
  SK: 'Saskatchewan', MB: 'Manitoba', NS: 'Nova Scotia', NB: 'New Brunswick',
  PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador', YT: 'Yukon',
  NT: 'Northwest Territories', NU: 'Nunavut' };

function get(url) {
  return new Promise((resolve) => {
    execFile('curl', ['-sS', '--max-time', '30', '-A', 'lasclay-retail-research/1.0 (admin@lasclay.com)', url],
      { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => resolve(err ? '' : stdout));
  });
}

(async () => {
  for (const z of zones) {
    if (z.lat) continue;
    const q = encodeURIComponent(`${z.ancre}, ${PROV_NOM[z.prov]}, Canada`);
    const body = await get(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
    try {
      const r = JSON.parse(body);
      if (r[0]) { z.lat = parseFloat(r[0].lat); z.lon = parseFloat(r[0].lon); }
      else console.error(`introuvable: ${z.ancre}`);
    } catch { console.error(`erreur: ${z.ancre}`); }
    await new Promise(r => setTimeout(r, 1100));
  }
  fs.writeFileSync(path.join(__dirname, 'zones.json'), JSON.stringify(zones, null, 1));
  console.log(`geocodes: ${zones.filter(z => z.lat).length}/${zones.length}`);
})();
