'use strict';
/*
 * Sonda: ¿qué trae `flights[]` en una búsqueda de ida y vuelta?
 *
 * Es la pregunta que decide si hace falta la segunda búsqueda con
 * `departure_token` o si el primer resultado ya trae los dos tramos. Imprime la
 * estructura real (cantidad de segmentos, horarios, aeropuertos) y no los
 * precios completos.
 */
const fs = require('fs');
const path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (linea) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  });
} catch (e) { /* sin .env */ }
const key = process.env.SERPAPI_API_KEY;
if (!key) { console.error('falta SERPAPI_API_KEY'); process.exit(1); }

async function pedir(nombre, params) {
  const query = new URLSearchParams(Object.assign({ engine: 'google_flights', api_key: key }, params));
  console.log('\n======== ' + nombre + ' ========');
  const r = await fetch('https://serpapi.com/search.json?' + query.toString());
  const j = await r.json();
  if (j.error) { console.log('ERROR: ' + j.error); return null; }
  return j;
}

function dump(item, etiqueta) {
  console.log('\n' + etiqueta + ':');
  console.log('  type            = ' + JSON.stringify(item.type));
  console.log('  price           = ' + item.price);
  console.log('  total_duration  = ' + item.total_duration);
  console.log('  layovers        = ' + JSON.stringify((item.layovers || []).map(function (l) { return l.id + ' ' + l.duration + 'min'; })));
  console.log('  departure_token = ' + (item.departure_token ? 'si' : 'no'));
  console.log('  booking_token   = ' + (item.booking_token ? 'si' : 'no'));
  console.log('  flights[]       = ' + (item.flights || []).length + ' segmentos:');
  (item.flights || []).forEach(function (s, i) {
    console.log('    [' + i + '] ' + (s.departure_airport || {}).id + ' ' + (s.departure_airport || {}).time +
      '  ->  ' + (s.arrival_airport || {}).id + ' ' + (s.arrival_airport || {}).time +
      '  ' + s.airline + ' ' + (s.flight_number || '') + '  ' + s.travel_class);
  });
  console.log('  claves del item = ' + Object.keys(item).join(', '));
}

(async function () {
  const j = await pedir('ida y vuelta MVD->GIG 10-17 marzo 2027, 2 adultos', {
    departure_id: 'MVD', arrival_id: 'GIG',
    outbound_date: '2027-03-10', return_date: '2027-03-17', type: '1',
    adults: '2', travel_class: '1', currency: 'USD', gl: 'uy', hl: 'es', sort_by: '1'
  });
  if (!j) return;
  console.log('best_flights:   ' + (j.best_flights || []).length + ' opciones');
  console.log('other_flights:  ' + (j.other_flights || []).length + ' opciones');
  console.log('price_insights: ' + JSON.stringify(j.price_insights));
  if (j.best_flights && j.best_flights[0]) dump(j.best_flights[0], 'best_flights[0]');
  if (j.best_flights && j.best_flights[1]) dump(j.best_flights[1], 'best_flights[1]');

  // Y ahora la vuelta, con TODOS los parametros que la API exija.
  const token = j.best_flights && j.best_flights[0] && j.best_flights[0].departure_token;
  if (token) {
    const r = await pedir('vuelta: departure_token + departure_id + outbound_date + arrival_id', {
      departure_token: token,
      departure_id: 'MVD', arrival_id: 'GIG',
      outbound_date: '2027-03-10', return_date: '2027-03-17', type: '1',
      adults: '2', travel_class: '1', currency: 'USD', gl: 'uy', hl: 'es', sort_by: '1'
    });
    if (r) {
      console.log('best_flights: ' + (r.best_flights || []).length + ' opciones de vuelta');
      if (r.best_flights && r.best_flights[0]) dump(r.best_flights[0], 'vuelta best_flights[0]');
    }
  }
})().catch(function (e) { console.error('fallo la sonda:', e.message); process.exit(1); });
