'use strict';
// Lista los campos de precio y foto TAL COMO VIENEN, para arreglar el
// normalizador de lib/... / server.js contra la forma real de la respuesta.
const fs = require('fs');
const path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (l) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) {}

const KEY = String(process.env.BOOKING_API_KEY_OVERRIDE || '').split(/\s+/)[0] || String(process.env.BOOKING_API_KEY || '').split(/\s+/)[0];
const HOST = 'booking-com15.p.rapidapi.com';
const iso = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function get(url) {
  const r = await fetch(url, { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST, Accept: 'application/json' } });
  return { status: r.status, body: await r.text() };
}

function conPrecio(o, pre) {
  return Object.keys(o).filter(k => /price|precio|amount|total|cost/i.test(k))
    .map(k => pre + k + ' = ' + JSON.stringify(o[k]).slice(0, 120));
}

(async function () {
  const d = await get('https://' + HOST + '/api/v1/hotels/searchDestination?query=Florian%C3%B3polis&locale=es');
  const dj = JSON.parse(d.body);
  const rows = dj.data || [];
  const t = rows.find(x => x && /city/i.test(String(x.search_type || ''))) || rows[0];
  const q = new URLSearchParams({
    dest_id: String(t.dest_id), search_type: String(t.search_type),
    arrival_date: iso(30), departure_date: iso(35), adults: '2', room_qty: '1',
    page_number: '1', units: 'metric', languagecode: 'es', currency_code: 'USD'
  });
  const h = await get('https://' + HOST + '/api/v1/hotels/searchHotels?' + q.toString());
  const hj = JSON.parse(h.body);
  const hotels = (hj.data && hj.data.hotels) || [];
  console.log('hoteles: ' + hotels.length + '\n');

  hotels.slice(0, 3).forEach(function (x, i) {
    const p = x.property || {};
    console.log('=== hotel ' + (i + 1) + ': ' + (p.name || x.hotel_name || '?'));
    console.log('  claves raiz: ' + Object.keys(x).join(', '));
    console.log('  -- precio --');
    conPrecio(x, '    raiz.').forEach(l => console.log(l));
    conPrecio(p, '    prop.').forEach(l => console.log(l));
    if (x.priceBreakdown) { console.log('  -- priceBreakdown --'); console.log('    ' + JSON.stringify(x.priceBreakdown).slice(0, 500)); }
    if (x.price_breakdown) { console.log('  -- price_breakdown --'); console.log('    ' + JSON.stringify(x.price_breakdown).slice(0, 500)); }
    if (p.photoUrls) console.log('  prop.photoUrls[0] = ' + String(p.photoUrls[0]).slice(0, 80));
    if (p.mainPhotoId) console.log('  prop.mainPhotoId = ' + p.mainPhotoId);
    console.log('');
  });
})();
