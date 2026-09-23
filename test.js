'use strict';
const assert = require('assert');
const http = require('http');
const model = require('./lib/model');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FALLÓ  ' + name + '\n', e); process.exitCode = 1; }
}
function post(port, path, value) {
  return new Promise(function (resolve, reject) {
    const request = http.request({ port: port, path: path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, function (res) {
      let body = ''; res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () { resolve({ status: res.statusCode, body: body, headers: res.headers }); });
    });
    request.on('error', reject); request.end(JSON.stringify(value));
  });
}
function get(port, path) {
  return new Promise(function (resolve, reject) {
    http.get({ port: port, path: path }, function (res) {
      let b = ''; res.on('data', function (c) { b += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: b, headers: res.headers }); });
    }).on('error', reject);
  });
}
const today = model.getToday();
const dep = model.iso(model.addDays(today, 60));
const ret = model.iso(model.addDays(today, 67));
const q = 'dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq';


(async function main() {
  console.log('Modelo');
  await t('un precio real de vuelo reemplaza la estimación y se marca como real', function () {
    const d = model.parse(dep), r = model.parse(ret);
    const est = model.calc('fln', 'avion_mvd', 1, 2, d, r, today, null);
    const real = model.calc('fln', 'avion_mvd', 1, 2, d, r, today, { pp: 500, airline: 'X', exact: true });
    assert.strictEqual(est.sources.pasajes, 'estimado'); assert.strictEqual(real.sources.pasajes, 'real');
    assert.strictEqual(real.parts.pasajes, 1000);
  });
  await t('las propuestas salen ordenadas por precio', function () {
    Object.keys(model.DEST).forEach(function (k) {
      const l = model.build({ dest: k, pax: 2 }, model.parse(dep), model.parse(ret), today, {});
      for (let i = 1; i < l.length; i++) assert.ok(l[i].total >= l[i - 1].total);
    });
  });
  await t('valida entradas incorrectas', function () {
    const bad = [{ dest: 'zz' }, { dest: 'fln', dep: 'x', ret: 'y' }, { dest: 'fln', dep: ret, ret: dep, pax: 2 },
      { dest: 'fln', dep: dep, ret: ret, pax: 99 }];
    bad.forEach(function (b) { assert.throws(function () { model.validate(b, today); }); });
    assert.ok(model.validate({ dest: 'fln', dep: dep, ret: ret, pax: '2', budget: '3000', style: 'eq' }, today));
  });
  await t('reserva roadtrip solo para destinos geográficamente habilitados', function () {
    assert.ok(model.validate({ dest: 'fln', dep: dep, ret: ret, pax: '2', budget: '3000', style: 'eq', transport: 'auto' }, today));
    assert.throws(function () { model.validate({ dest: 'ssa', dep: dep, ret: ret, pax: '2', budget: '3000', style: 'eq', transport: 'auto' }, today); }, /roadtrip|auto/i);
    assert.throws(function () { model.validate({ dest: 'fln', dep: dep, ret: ret, pax: '2', budget: '3000', style: 'eq', transport: 'bus' }, today); }, /transporte/i);
  });

  console.log('Servidor y proveedores');
  process.env.RATE_LIMIT_PER_MIN = '1000';
  process.env.FLIGHT_RAPIDAPI_KEY = '';
  process.env.FLIGHT_RAPIDAPI_HOST = 'sky-scrapper.p.rapidapi.com';
  process.env.RAPIDAPI_KEY = '';
  process.env.RAPIDAPI_HOST = '';
  process.env.BOOKING_API_KEY = '';
  process.env.BOOKING_API_HOST = 'booking-com15.p.rapidapi.com';
  const app = require('./server');
  const skyScrapper = require('./lib/providers/skyscrapper');
  await t('mapea las ofertas de Sky Scrapper a la interfaz de vuelos', function () {
    const offer = skyScrapper.mapItinerary({
      id: 'itinerary-1', price: { raw: 299.5, currency: 'USD' },
      legs: [{ origin: { id: 'MVD', name: 'Carrasco' }, destination: { id: 'FLN', name: 'Florianópolis' },
        departure: '2027-01-10T10:00:00', arrival: '2027-01-10T13:45:00', durationInMinutes: 225, stopCount: 0,
        carriers: { marketing: [{ name: 'Aerolínea Test', logoUrl: 'https://logo.test/a.png' }] } },
      { origin: { id: 'FLN', name: 'Florianópolis' }, destination: { id: 'MVD', name: 'Carrasco' }, departure: '2027-01-17T10:00:00', arrival: '2027-01-17T14:10:00', durationInMinutes: 250, stopCount: 1, carriers: { marketing: [{ name: 'Aerolínea Test' }] } }],
      deepLink: 'https://www.skyscanner.com/transport/flights/'
    }, 'economy');
    assert.strictEqual(offer.provider, 'skyscrapper');
    assert.strictEqual(offer.trip_type, 'round_trip');
    assert.strictEqual(offer.departure_airport.code, 'MVD');
    assert.strictEqual(offer.inbound.destination.code, 'MVD');
    assert.strictEqual(offer.price_usd, 299.5);
    assert.strictEqual(offer.booking_url, 'https://www.skyscanner.com/transport/flights/');
  });
  await t('mantiene las reglas de cabina por estilo', function () {
    assert.deepStrictEqual(skyScrapper.styleCabins('ahorro'), ['economy']);
    assert.deepStrictEqual(skyScrapper.styleCabins('eq'), ['economy', 'premium_economy']);
    assert.deepStrictEqual(skyScrapper.styleCabins('comodo'), ['premium_economy', 'business']);
  });
  await t('resuelve aeropuertos y busca vuelos con las cabeceras de RapidAPI', async function () {
    const oldKey = process.env.FLIGHT_RAPIDAPI_KEY;
    const seen = [];
    process.env.FLIGHT_RAPIDAPI_KEY = 'test-key';
    skyScrapper.setFetch(async function (url, options) {
      seen.push({ url: new URL(url), options: options });
      if (new URL(url).pathname.endsWith('/searchAirport')) {
        const code = new URL(url).searchParams.get('query');
        return { ok: true, status: 200, json: async function () { return { status: true, data: [{ skyId: code, entityId: 'entity-' + code }] }; } };
      }
      return { ok: true, status: 200, json: async function () { return { status: true, data: { itineraries: [{
        id: 'flight-mvd-fln', price: { raw: 321, currency: 'USD' }, legs: [{
          origin: { id: 'MVD', name: 'Carrasco' }, destination: { id: 'FLN', name: 'Florianópolis' }, departure: '2027-01-10T10:00:00', arrival: '2027-01-10T13:00:00', durationInMinutes: 180, stopCount: 0,
          carriers: { marketing: [{ name: 'Aerolínea Test' }] }
        }]
      }] } }; } };
    });
    const offers = await skyScrapper.searchFlights({ origin: 'MVD', destination: 'FLN', departureDate: dep, returnDate: ret, passengers: 2, cabinClass: 'economy' });
    assert.strictEqual(offers.length, 1);
    assert.strictEqual(offers[0].departure_airport.code, 'MVD');
    assert.strictEqual(offers[0].price_usd, 321);
    assert.ok(seen.some(function (request) { return request.url.pathname.endsWith('/api/v1/flights/searchFlights'); }));
    assert.ok(seen.every(function (request) { return request.options.headers['x-rapidapi-key'] === 'test-key'; }));
    skyScrapper.setFetch(null);
    process.env.FLIGHT_RAPIDAPI_KEY = oldKey;
  });
  await t('normaliza hoteles reales de Booking.com con tarifa e imagen', async function () {
    const originalFetch = global.fetch;
    const seen = [];
    process.env.BOOKING_API_KEY = 'test-key';
    global.fetch = async function (url, options) {
      const parsed = new URL(url); seen.push({ url: parsed, options: options });
      if (parsed.pathname.endsWith('/searchDestination')) return { ok: true, status: 200, json: async function () { return { status: true, data: [{ dest_id: '-123', search_type: 'city', name: 'Florianópolis' }] }; } };
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { status: true, data: { hotels: [
        { hotel_id: 'hotel-1', property: { name: 'Hotel Booking Floripa', reviewScore: 9.2, photoMainUrl: 'https://images.example/hotel.jpg' }, priceBreakdown: { grossPrice: { value: 700, currency: 'USD' } }, url: 'https://www.booking.com/hotel/br/test.html' }
      ] } }; } };
      return { ok: true, status: 200, json: async function () { return { status: true, data: [] }; } };
    };
    try {
      const list = await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7 });
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].name, 'Hotel Booking Floripa');
      assert.strictEqual(list[0].image, 'https://images.example/hotel.jpg');
      assert.strictEqual(list[0].total, 700);
      assert.strictEqual(list[0].perNight, 100);
      assert.strictEqual(list[0].source, 'booking');
      assert.ok(seen.some(function (request) { return request.url.hostname === 'booking-com15.p.rapidapi.com' && request.url.pathname.endsWith('/api/v1/hotels/searchHotels'); }));
      assert.ok(seen.every(function (request) { return request.options.headers['x-rapidapi-key'] === 'test-key'; }));
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  await t('sin foto o precio real no inventa resultados de alojamiento', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    global.fetch = async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: '-123', search_type: 'city' }] }; } };
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [{ hotel_id: 'hotel-2', property: { name: 'Hotel sin foto' }, priceBreakdown: { grossPrice: { value: 460, currency: 'USD' } } }] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    try { assert.deepStrictEqual(await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7 }), []); }
    finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  await t('ante fallos de Booking no devuelve catálogo simulado', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    global.fetch = async function () { throw new Error('timeout'); };
    const originalWarn = console.warn; console.warn = function () {};
    try { assert.deepStrictEqual(await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2 }), []); }
    finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; console.warn = originalWarn; }
  });

  const server = app.createServer();
  await new Promise(function (r) { server.listen(0, r); });
  const port = server.address().port;
  await t('cotiza un viaje estimado sin credenciales externas', async function () {
    const r = await get(port, '/api/cotizar?' + q);
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.meta.mode, 'estimated');
    assert.ok(j.list.length >= 3); assert.ok(j.recId);
    assert.ok(j.list.every(function (p) { return p.sources.pasajes === 'estimado'; }));
  });
  await t('devuelve todos los destinos configurados', async function () {
    const j = JSON.parse((await get(port, '/api/destinos')).body);
    assert.ok(j.some(function (d) { return d.key === 'fln'; }));
    assert.strictEqual(j.length, Object.keys(model.DEST).length);
  });
  await t('cotiza todos los destinos ordenados por total', async function () {
    const r = await get(port, '/api/cotizar-todos?dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.options.length, Object.keys(model.DEST).length);
    for (let i = 1; i < j.options.length; i++) assert.ok(j.options[i].total >= j.options[i - 1].total);
    assert.ok(j.options.every(function (o) { return o.parts && o.dest && typeof o.fits === 'boolean'; }));
  });
  await t('rechaza parámetros inválidos con 400', async function () {
    const r = await get(port, '/api/cotizar?dest=zz&dep=' + dep + '&ret=' + ret + '&pax=2');
    assert.strictEqual(r.status, 400); assert.ok(JSON.parse(r.body).error);
  });
  await t('sirve la web y bloquea rutas fuera de /public', async function () {
    const r = await get(port, '/');
    assert.strictEqual(r.status, 200); assert.ok(r.body.indexOf('cuántosale') >= 0);
    assert.ok(r.headers['content-security-policy']);
    const bad = await get(port, '/..%2Fserver.js');
    assert.ok(bad.status === 403 || bad.status === 404);
    const bad2 = await get(port, '/%2e%2e/server.js');
    assert.ok(bad2.status === 403 || bad2.status === 404);
    const appScript = await get(port, '/app.js');
    assert.strictEqual(appScript.status, 200);
    ['Cristo Redentor', 'Isla de Campeche', 'Piscinas Naturales', 'Playa en Playa', 'Tour del Vino', 'Reservar con asistencia', 'https://wa.me/?text='].forEach(function (copy) { assert.ok(appScript.body.includes(copy), 'Falta contenido de tours: ' + copy); });
  });
  await t('con clave vacía la búsqueda real de vuelos responde con error controlado', async function () {
    const r = await post(port, '/api/vuelos/buscar', { origen: 'MVD', destino: 'fln', fecha_ida: dep, fecha_vuelta: ret, pasajeros: 2, style: 'eq' });
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 503); assert.deepStrictEqual(j.offers, []); assert.match(j.error, /FLIGHT_RAPIDAPI_KEY/);
  });
  server.close();
  console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' (con fallas)' : ''));
})();
