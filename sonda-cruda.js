'use strict';
// Vuelca el JSON crudo de RapidAPI para ver que devuelve realmente: el
// normalizador del server puede estar ignorando la forma de la respuesta.
const fs = require('fs');
const path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (l) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) {}

const KEY = String(process.env.BOOKING_API_KEY_OVERRIDE || process.env.BOOKING_API_KEY || '').split(/\s+/)[0];
const HOST = process.env.BOOKING_API_HOST_OVERRIDE || 'booking-com15.p.rapidapi.com';

async function get(url) {
  const r = await fetch(url, { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST, Accept: 'application/json' } });
  const t = await r.text();
  return { status: r.status, body: t };
}

(async function () {
  const d = await get('https://' + HOST + '/api/v1/hotels/searchDestination?query=Florian%C3%B3polis&locale=es');
  console.log('--- searchDestination HTTP ' + d.status);
  console.log(d.body.slice(0, 700));
  console.log('');

  let destId = null, searchType = null;
  try {
    const j = JSON.parse(d.body);
    const rows = Array.isArray(j) ? j : (j && j.data) || [];
    const t = rows.find(x => x && /city/i.test(String(x.search_type || x.dest_type || ''))) || rows[0];
    if (t) { destId = t.dest_id; searchType = t.search_type; }
  } catch (e) {}
  if (destId == null) { console.log('sin dest_id: no se puede seguir'); return; }
  console.log('dest_id=' + destId + '  search_type=' + searchType + '\n');

  const iso = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const q = new URLSearchParams({
    dest_id: String(destId), search_type: String(searchType),
    arrival_date: iso(30), departure_date: iso(35), adults: '2', room_qty: '1',
    page_number: '1', units: 'metric', languagecode: 'es', currency_code: 'USD'
  });
  const h = await get('https://' + HOST + '/api/v1/hotels/searchHotels?' + q.toString());
  console.log('--- searchHotels HTTP ' + h.status + ', ' + h.body.length + ' bytes');
  console.log(h.body.slice(0, 1400));
})();
