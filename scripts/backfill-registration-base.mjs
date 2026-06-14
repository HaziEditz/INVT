/**
 * Backfill baseLat/baseLng on registration records from area+city geocode.
 * Usage: node scripts/backfill-registration-base.mjs [companyId]
 */
import crypto from 'crypto';
import https from 'https';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const filterCid = process.argv[2] || null;
const regFile = join(__dirname, '..', '.data', 'registrationRequests.json');
const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';

function forwardGeocode(query) {
  return new Promise((resolve) => {
    if (!query || !apiKey) return resolve(null);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    https.get(url, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(buf);
          const loc = json?.results?.[0]?.geometry?.location;
          if (loc && isFinite(loc.lat) && isFinite(loc.lng)) resolve({ lat: loc.lat, lng: loc.lng });
          else resolve(null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

const regs = JSON.parse(readFileSync(regFile, 'utf8'));
let changed = 0;
for (const reg of regs) {
  if (!reg || !reg.companyId) continue;
  if (filterCid && String(reg.companyId) !== filterCid) continue;
  if (String(reg.companyId) === '620611') {
    console.log(`#${reg.companyId} skipped — legacy company (excluded from backfill)`);
    continue;
  }
  if (reg.baseLat != null && reg.baseLng != null) {
    console.log(`#${reg.companyId} already has baseLat/baseLng`);
    continue;
  }
  const city = String(reg.area || reg.city || '').trim();
  const country = String(reg.country || 'New Zealand').trim();
  if (!city) {
    console.log(`#${reg.companyId} skipped — no area/city`);
    continue;
  }
  const query = `${city}, ${country}`;
  const coords = await forwardGeocode(query);
  if (!coords) {
    console.log(`#${reg.companyId} geocode failed for "${query}"`);
    continue;
  }
  reg.baseLat = coords.lat;
  reg.baseLng = coords.lng;
  reg.baseGeoSource = 'geocode';
  changed++;
  console.log(`#${reg.companyId} "${query}" → ${coords.lat}, ${coords.lng}`);
}
if (changed) {
  writeFileSync(regFile, JSON.stringify(regs, null, 2));
  console.log(`Updated ${changed} registration(s) in ${regFile}`);
} else {
  console.log('No registrations updated.');
}
