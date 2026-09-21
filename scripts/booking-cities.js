'use strict';
/*
 * Busca el ID de ciudad de Booking.com para usarlo en BOOKING_CITY_IDS.
 *
 *   node scripts/booking-cities.js br florian     -> ciudades de Brasil cuyo nombre contiene "florian"
 *   node scripts/booking-cities.js ar "buenos"
 *
 * El primer dato es el código de país (2 letras, minúsculas). Necesita BOOKING_API_KEY y
 * BOOKING_AFFILIATE_ID en el .env. Después pegá el resultado así:
 *   BOOKING_CITY_IDS={"fln": <id>, "ba": <id>}
 */
const fs = require('fs');
const path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach(function (l) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* sin .env */ }

const hotels = require('../lib/providers/hotels');
const country = (process.argv[2] || '').toLowerCase();
const term = (process.argv[3] || '').toLowerCase();
if (!/^[a-z]{2}$/.test(country) || !hotels.isConfigured()) {
  console.error('Uso: node scripts/booking-cities.js <país de 2 letras> [parte del nombre]\nHace falta BOOKING_API_KEY y BOOKING_AFFILIATE_ID en el .env.');
  process.exit(1);
}
const nameOf = function (c) {
  if (typeof c.name === 'string') return c.name;
  return c.name ? (c.name.es || c.name['en-gb'] || Object.values(c.name)[0] || '') : '';
};

(async function () {
  const base = (process.env.BOOKING_API_BASE || 'https://demandapi.booking.com/3.1').replace(/\/+$/, '');
  let page = null, found = 0;
  for (let i = 0; i < 200; i++) {
    const body = { country: country, languages: ['es', 'en-gb'] };
    if (page) body.page = page;
    const res = await fetch(base + '/common/locations/cities', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.BOOKING_API_KEY, 'X-Affiliate-Id': process.env.BOOKING_AFFILIATE_ID || process.env.HOTEL_AFFILIATE_ID,
        'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(function () { return {}; });
    if (!res.ok) { console.error('Booking respondió ' + res.status, JSON.stringify(json).slice(0, 300)); process.exit(1); }
    (json.data || []).forEach(function (c) {
      const n = nameOf(c);
      if (!term || n.toLowerCase().indexOf(term) >= 0) { console.log(c.id + '\t' + n); found++; }
    });
    page = json.next_page;
    if (!page) break;
  }
  if (!found) console.log('Sin resultados.');
})().catch(function (e) { console.error(e.message); process.exit(1); });
