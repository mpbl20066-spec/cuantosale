'use strict';
const assert = require('assert');
const http = require('http');
const model = require('./lib/model');
const duffel = require('./lib/providers/duffel');
const providers = require('./lib/providers');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FALLÓ  ' + name + '\n', e); process.exitCode = 1; }
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

function fakeOffers(list) { return { data: { offers: list } }; }
function offer(amount, cur, name, segsOut, segsBack) {
  const seg = function (d) { return { departing_at: d + 'T10:00:00' }; };
  return { total_amount: String(amount), total_currency: cur, owner: { name: name }, expires_at: 'x',
    slices: [{ segments: segsOut.map(seg) }, { segments: segsBack.map(seg) }] };
}

(async function main() {
  console.log('Duffel');
  await t('elige la oferta más barata en US$ y resume escalas', function () {
    const r = duffel.parseOffers(fakeOffers([
      offer(640, 'USD', 'Aerolínea A', ['2027-01-10'], ['2027-01-17']),
      offer(512.4, 'USD', 'Aerolínea B', ['2027-01-10', '2027-01-10'], ['2027-01-17']),
      offer(300, 'EUR', 'Aerolínea C', ['2027-01-10'], ['2027-01-17'])
    ]));
    assert.strictEqual(r.pp, 512); assert.strictEqual(r.airline, 'Aerolínea B');
    assert.strictEqual(r.transfers, 1); assert.strictEqual(r.foundDep, '2027-01-10'); assert.strictEqual(r.source, 'duffel');
  });
  await t('convierte otras monedas si hay tipo de cambio', function () {
    const r = duffel.parseOffers(fakeOffers([offer(300, 'EUR', 'C', ['2027-01-10'], ['2027-01-17'])]), { EUR: 1.1 });
    assert.strictEqual(r.pp, 330);
  });
  await t('sin ofertas devuelve null', function () { assert.strictEqual(duffel.parseOffers(fakeOffers([])), null); });
  await t('arma bien el pedido a Duffel', async function () {
    let seen;
    const f = async function (url, opts) { seen = { url: url, opts: opts }; return { ok: true, status: 200, json: async function () { return fakeOffers([]); } }; };
    await duffel.getFlightQuote({ token: 'tok', origin: 'MVD', destination: 'FLN', dep: '2027-01-10', ret: '2027-01-17', maxConnections: 1, fetchImpl: f });
    assert.ok(seen.url.indexOf('https://api.duffel.com/air/offer_requests') === 0);
    assert.strictEqual(seen.opts.headers['Duffel-Version'], 'v2');
    assert.strictEqual(seen.opts.headers['Authorization'], 'Bearer tok');
    const body = JSON.parse(seen.opts.body).data;
    assert.strictEqual(body.slices.length, 2);
    assert.deepStrictEqual(body.slices[1], { origin: 'FLN', destination: 'MVD', departure_date: '2027-01-17' });
    assert.strictEqual(body.max_connections, 1); assert.strictEqual(body.passengers.length, 1);
  });
  await t('propaga el estado HTTP de un error', async function () {
    const f = async function () { return { ok: false, status: 429, json: async function () { return { errors: [{ message: 'Too many' }] }; } }; };
    await assert.rejects(duffel.getFlightQuote({ token: 't', origin: 'A', destination: 'B', dep: 'x', ret: 'y', fetchImpl: f }), function (e) { return e.status === 429; });
  });

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

  console.log('Servidor');
  delete process.env.DUFFEL_TOKEN;
  process.env.RATE_LIMIT_PER_MIN = '1000';
  const app = require('./server');
  await t('formatea las ofertas de la SDK de Duffel para el frontend', function () {
    const offers = app.formatOffers([{ id: 'off_1', total_amount: '299.50', total_currency: 'USD', owner: { name: 'Aerolínea Test' },
      slices: [{ duration: 'PT3H45M', segments: [{ departing_at: '2027-01-10T10:00:00', arriving_at: '2027-01-10T13:45:00', marketing_carrier: { name: 'Aerolínea Test', logo_symbol_url: 'https://logo.test/a.png' } }] }] }]);
    assert.strictEqual(offers[0].id, 'off_1');
    assert.strictEqual(offers[0].airline, 'Aerolínea Test');
    assert.strictEqual(offers[0].logo, 'https://logo.test/a.png');
    assert.strictEqual(offers[0].departure, '2027-01-10T10:00:00');
    assert.strictEqual(offers[0].arrival, '2027-01-10T13:45:00');
    assert.strictEqual(offers[0].stops, 0);
    assert.strictEqual(offers[0].duration, '3 h 45 min');
    assert.strictEqual(offers[0].price_usd, 299.5);
    assert.strictEqual(offers[0].original_price, '299.50');
    assert.strictEqual(offers[0].original_currency, 'USD');
  });
  await t('mantiene los tramos de ida y vuelta en ofertas round-trip', function () {
    const offers = app.formatOffers([{
      id: 'off_round', total_amount: '550.00', total_currency: 'USD', owner: { name: 'Aerolínea Test' },
      slices: [
        { duration: 'PT4H', segments: [{ departing_at: '2027-01-10T10:00:00', arriving_at: '2027-01-10T14:00:00', origin: { iata_code: 'MVD', name: 'Montevideo' }, destination: { iata_code: 'NAT', name: 'Natal' }, marketing_carrier: { name: 'Aerolínea Test', logo_symbol_url: 'https://logo.test/a.png' } }] },
        { duration: 'PT4H10M', segments: [{ departing_at: '2027-01-17T10:00:00', arriving_at: '2027-01-17T14:10:00', origin: { iata_code: 'NAT', name: 'Natal' }, destination: { iata_code: 'MVD', name: 'Montevideo' }, marketing_carrier: { name: 'Aerolínea Test', logo_symbol_url: 'https://logo.test/a.png' } }] }
      ]
    }]);
    assert.strictEqual(offers[0].trip_type, 'round_trip');
    assert.strictEqual(offers[0].outbound.origin.code, 'MVD');
    assert.strictEqual(offers[0].inbound.destination.code, 'MVD');
    assert.strictEqual(offers[0].departure, '2027-01-10T10:00:00');
    assert.strictEqual(offers[0].arrival, '2027-01-17T14:10:00');
  });
  await t('usa precios y fotos reales de Booking cuando está configurada', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'rapid-key';
    process.env.BOOKING_API_HOST = 'booking-com.p.rapidapi.com';
    process.env.BOOKING_API_URL = 'https://booking-com.p.rapidapi.com/v1/hotels/search';
    global.fetch = async function () {
      return {
        ok: true,
        json: async function () {
          return {
            result: [{
              hotel_name: 'Hotel Booking Floripa',
              min_total_price: '460',
              currency: 'USD',
              main_photo_url: 'https://images.example/hotel.jpg',
              review_score: '9.2'
            }]
          };
        }
      };
    };
    const list = await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2 });
    assert.strictEqual(list[0].name, 'Hotel Booking Floripa');
    assert.strictEqual(list[0].image, 'https://images.example/hotel.jpg');
    assert.strictEqual(list[0].total, 460);
    global.fetch = originalFetch;
  });
  await t('normaliza nombres e imágenes markdown de Booking antes de renderizar', async function () {
    const originalFetch = global.fetch;
    global.fetch = async function () {
      return {
        ok: true,
        json: async function () {
          return {
            result: [{
              hotel_name: '  Hotel Booking Floripa  ',
              min_total_price: '460',
              currency: 'USD',
              main_photo_url: '[https://images.example/hotel.jpg](https://images.example/hotel.jpg)',
              review_score: '9.2'
            }]
          };
        }
      };
    };
    const list = await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2 });
    assert.strictEqual(list[0].name, 'Hotel Booking Floripa');
    assert.strictEqual(list[0].image, 'https://images.example/hotel.jpg');
    global.fetch = originalFetch;
  });
  await t('si Booking no devuelve foto real, no rellena con imágenes falsas genéricas', async function () {
    const originalFetch = global.fetch;
    global.fetch = async function () {
      return {
        ok: true,
        json: async function () {
          return {
            result: [{
              hotel_name: 'Hotel sin foto',
              min_total_price: '460',
              currency: 'USD',
              review_score: '9.2'
            }]
          };
        }
      };
    };
    const list = await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2 });
    assert.strictEqual(list[0].image, '');
    global.fetch = originalFetch;
  });
  await t('si Booking falla por timeout, el servidor cae al fallback sin romper la respuesta', async function () {
    const originalFetch = global.fetch;
    global.fetch = async function () {
      throw new Error('timeout');
    };
    const list = await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2 });
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 1);
    assert.ok(list[0].name);
    global.fetch = originalFetch;
  });
  const server = app.createServer();
  await new Promise(function (r) { server.listen(0, r); });
  const port = server.address().port;

  await t('modo demo: responde propuestas estimadas', async function () {
    const r = await get(port, '/api/cotizar?' + q);
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.meta.mode, 'demo');
    assert.ok(j.list.length >= 3); assert.ok(j.recId);
    assert.ok(j.list.every(function (p) { return p.sources.pasajes === 'estimado'; }));
    assert.ok(j.series.length > 5);
  });
  await t('lista de destinos', async function () {
    const j = JSON.parse((await get(port, '/api/destinos')).body);
    assert.ok(j.some(function (d) { return d.key === 'fln'; }));
    assert.deepStrictEqual(j.map(function (d) { return d.key; }), ['buz', 'fln', 'for', 'igu', 'mcz', 'nat', 'pip', 'poa', 'rec', 'rio', 'ssa', 'sao']);
  });
  await t('cotiza todos los destinos ordenados por total', async function () {
    const r = await get(port, '/api/cotizar-todos?dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.options.length, 12);
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
  });

  process.env.DUFFEL_TOKEN = 'duffel_test_fake';
  providers.clearCache();
  let calls = 0;
  providers.setFetch(async function (url, opts) {
    calls++;
    const b = JSON.parse(opts.body).data;
    const price = b.slices[0].origin === 'MVD' ? 380 : 300;   // vuelo directo vs saliendo por Buenos Aires
    return { ok: true, status: 200, json: async function () {
      return fakeOffers([offer(price, 'USD', 'Aerolínea Test', [b.slices[0].departure_date], [b.slices[1].departure_date])]);
    } };
  });
  await t('modo real: usa precios reales desde MVD y excluye Buenos Aires', async function () {
    const j = JSON.parse((await get(port, '/api/cotizar?' + q)).body);
    assert.strictEqual(j.meta.mode, 'live');
    const mvd = j.list.find(function (p) { return p.mode === 'avion_mvd'; });
    assert.strictEqual(mvd.sources.pasajes, 'real'); assert.strictEqual(mvd.parts.pasajes, 760);
    assert.ok(j.list.every(function (p) { return p.mode !== 'avion_ba' && p.ti === 1; }));
    assert.strictEqual(mvd.quote.airline, 'Aerolínea Test');
    const bus = j.list.find(function (p) { return p.mode === 'bus'; });
    assert.strictEqual(bus.sources.pasajes, 'estimado');
  });
  await t('recuerda los precios: la misma búsqueda no vuelve a llamar a Duffel', async function () {
    const before = calls;
    await get(port, '/api/cotizar?' + q + '&budget=3500');
    assert.strictEqual(calls, before);
  });
  await t('si Duffel falla, cae a estimaciones sin romper', async function () {
    providers.clearCache();
    providers.setFetch(async function () { return { ok: false, status: 500, json: async function () { return {}; } }; });
    const origErr = console.error; console.error = function () {};
    const r = await get(port, '/api/cotizar?' + q);
    console.error = origErr;
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200);
    assert.ok(j.list.every(function (p) { return p.sources.pasajes === 'estimado'; }));
  });

  server.close();
  console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' (con fallas)' : ''));
})();
