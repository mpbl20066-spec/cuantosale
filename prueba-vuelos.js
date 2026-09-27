'use strict';
/*
 * Prueba de humo del camino de vuelos sin gastar créditos reales.
 *
 * Levanta el server con una SERPAPI_API_KEY falsa y un fetch interceptado que
 * devuelve una respuesta con la forma de google_flights. Sirve para ver de
 * punta a punta qué devuelve cada endpoint: el browse de ida, el de vuelta y el
 * calendario de fechas. Con una key real y sin este mock, el mismo script
 * muestra el error de cuota o de formato tal cual lo vería la app.
 *
 *   node prueba-vuelos.js            -> con datos de ejemplo
 *   node prueba-vuelos.js --real     -> contra la API de verdad
 */
const http = require('http');

const REAL = process.argv.indexOf('--real') >= 0;
if (!REAL && !process.env.SERPAPI_API_KEY) process.env.SERPAPI_API_KEY = 'mock';
if (!REAL) {
  const serpapi = require('./lib/providers/serpapi');
  // Un vuelo de ida y vuelta por cada fecha, con precio estable para que el
  // calendario no parezca inventado.
  serpapi.setFetch(async function (url) {
    const parsed = new URL(url);
    const out = parsed.searchParams.get('outbound_date') || '2027-01-10';
    // El fin de semana cuesta más: sirve para ver que el gráfico no es plano.
    const weekend = [5, 6, 0].indexOf(new Date(out + 'T12:00').getDay()) >= 0;
    return {
      ok: true, status: 200,
      json: async function () {
        return {
          best_flights: [{
            price: weekend ? 520 : 380, type: 'One way',
            airline: 'Aerolínea Ejemplo', airline_logo: 'https://logo.test/a.svg',
            total_duration: 165, departure_token: 'tok_' + out, booking_token: 'book_' + out,
            layovers: weekend ? [{ id: 'GRU', name: 'Guarulhos', duration: 90 }] : [],
            flights: [{ departure_airport: { id: 'MVD', name: 'Carrasco', time: out + ' 10:00' }, arrival_airport: { id: 'GRU', name: 'Guarulhos', time: out + ' 12:45' }, airline: 'Aerolínea Ejemplo', flight_number: 'AE 123' }]
          }],
          price_insights: { lowest_price: weekend ? 940 : 720, price_level: weekend ? 'high' : 'low' }
        };
      }
    };
  });
  require('./lib/providers').clearCache();
}

const app = require('./server');
const ORIGIN = 'MVD';
const DEST = 'rio';
const DEP = '2027-01-12';
const RET = '2027-01-19';

function call(server, method, path, body) {
  return new Promise(function (resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1', port: server.address().port, path: path, method: method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}
    }, function (res) {
      let text = '';
      res.on('data', function (c) { text += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: text }); });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function usd(n) { return 'US$ ' + Number(n).toFixed(0); }

(async function () {
  const server = app.createServer();
  await new Promise(function (r) { server.listen(0, r); });
  console.log('modo: ' + (REAL ? 'API REAL (gasta créditos)' : 'datos de ejemplo') + '\n');

  // 1. Cotización principal: debe traer el pasaje real.
  const quote = await call(server, 'GET', '/api/cotizar?dest=' + DEST + '&dep=' + DEP + '&ret=' + RET + '&pax=2&budget=3000&style=eq');
  const q = JSON.parse(quote.body);
  const rec = (q.list || []).find(function (p) { return p.id === q.recId; }) || (q.list || [])[0] || {};
  console.log('--- /api/cotizar ---');
  console.log('  status            ' + quote.status);
  console.log('  modo              ' + (q.meta && q.meta.mode));
  console.log('  pasajes/pasajero  ' + (rec.parts ? usd(rec.parts.pasajes / 2) : '?') + '  (' + (rec.sources ? rec.sources.pasajes : '?') + ')');
  console.log('  serie de fechas   ' + ((q.series || []).length) + ' puntos');

  // 2. Browse: una sola búsqueda, y el precio ya es el total de ida y vuelta.
  const out1 = await call(server, 'POST', '/api/vuelos/buscar', { origen: ORIGIN, destino: DEST, fecha_ida: DEP, fecha_vuelta: RET, pasajeros: 2, style: 'eq' });
  const o1 = JSON.parse(out1.body);
  console.log('\n--- /api/vuelos/buscar ---');
  console.log('  status            ' + out1.status + (o1.error ? '  error: ' + o1.error : ''));
  console.log('  ida y vuelta      ' + o1.round_trip);
  (o1.offers || []).forEach(function (f) {
    console.log('  ' + String(f.airline).padEnd(22) + ' ' + String(f.departure).padEnd(18) + usd(f.price_usd || 0) + '  ' + f.stops + ' escala(s)  ' + (f.trip_type || '') + '  (precio total)');
    console.log('    tramo de vuelta informado: ' + (f.inbound ? 'si' : 'no (la API no lo devuelve)'));
  });

  // 4. Calendario de fechas: el gráfico del screenshot.
  const cal = await call(server, 'GET', '/api/vuelos/calendario?dest=' + DEST + '&dep=' + DEP + '&ret=' + RET + '&pax=2&style=eq&origin=' + ORIGIN);
  const c = JSON.parse(cal.body);
  console.log('\n--- /api/vuelos/calendario ---');
  console.log('  status            ' + cal.status + (c.error ? '  error: ' + c.error : ''));
  console.log('  configurado       ' + c.configured);
  console.log('  reales/estimados  ' + c.real + '/' + c.estimados);
  (c.puntos || []).forEach(function (p) {
    const barra = p.real ? usd(p.pp) : '(estimado)';
    console.log('  ' + p.dep + '  shift ' + String(p.shift).padStart(2) + '  ' + barra.padEnd(18) + (p.real ? (p.exact ? 'exacto' : 'insights') : ''));
  });

  server.close();
  console.log('\nlisto.');
})().catch(function (e) { console.error('fallo la prueba:', e); process.exit(1); });
