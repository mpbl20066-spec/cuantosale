'use strict';
const assert = require('assert');
const http = require('http');
const model = require('./lib/model');
const duffel = require('./lib/providers/duffel');
const busbud = require('./lib/providers/busbud');
const hotels = require('./lib/providers/hotels');
const insurance = require('./lib/providers/insurance');
const { buildUrl } = require('./lib/providers/booking');
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
const q = 'dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2';
const fakeOffers = function (list) { return { data: { offers: list } }; };
const offer = function (amount, cur, name, segsOut, segsBack) {
  const seg = function (d) { return { departing_at: d + 'T10:00:00' }; };
  return { total_amount: String(amount), total_currency: cur, owner: { name: name }, expires_at: 'x',
    slices: [{ segments: segsOut.map(seg) }, { segments: segsBack.map(seg) }] };
};
const env = function (o) { return Object.assign({}, o); };

(async function main() {
  console.log('Enlaces de reserva (bookingUrl)');
  await t('completa la plantilla, codifica valores y quita el parámetro de afiliado vacío', function () {
    const tpl = 'https://ejemplo.com/buscar?ss={dest_name}&aid={affiliate}&d={dep}';
    const sin = buildUrl(tpl, { dest_name: 'Florianópolis', dep: '2027-01-10' }, '');
    assert.ok(sin.indexOf('aid') < 0); assert.ok(sin.indexOf('Florian%C3%B3polis') >= 0);
    const con = buildUrl(tpl, { dest_name: 'Río', dep: '2027-01-10' }, 'AF 1&2');
    assert.ok(/aid=AF(\+|%20)1%262/.test(con), con);
  });
  await t('rechaza enlaces que no sean http o https', function () {
    assert.strictEqual(buildUrl('javascript:alert(1)', {}, ''), null);
    assert.strictEqual(buildUrl('', {}, ''), null);
    assert.strictEqual(buildUrl('ftp://x.com/a', {}, ''), null);
  });
  await t('vuelos: por defecto abre Google Flights y una plantilla propia lo reemplaza', function () {
    const p = { origin: 'MVD', destination: 'FLN', dep: '2027-01-10', ret: '2027-01-17', pax: 2 };
    const def = duffel.flightBookingUrl(p, env({}));
    assert.ok(def.indexOf('https://www.google.com/travel/flights') === 0); assert.ok(def.indexOf('MVD') > 0 && def.indexOf('2027-01-17') > 0);
    const own = duffel.flightBookingUrl(p, env({ FLIGHT_URL_TEMPLATE: 'https://socio.com/vuelos/{origin}-{destination}?fecha={dep}&ref={affiliate}', FLIGHT_AFFILIATE_ID: 'ABC123' }));
    assert.strictEqual(own, 'https://socio.com/vuelos/MVD-FLN?fecha=2027-01-10&ref=ABC123');
  });
  await t('hoteles: Booking.com con el ID de afiliado como aid (y sin aid si no hay ID)', function () {
    const p = { destName: 'Florianópolis', dep: '2027-01-10', ret: '2027-01-17', pax: 3, rooms: 2 };
    const u = new URL(hotels.hotelBookingUrl(p, env({ HOTEL_AFFILIATE_ID: '999' })));
    assert.strictEqual(u.hostname, 'www.booking.com'); assert.strictEqual(u.searchParams.get('aid'), '999');
    assert.strictEqual(u.searchParams.get('checkin'), '2027-01-10'); assert.strictEqual(u.searchParams.get('group_adults'), '3');
    assert.strictEqual(u.searchParams.get('no_rooms'), '2'); assert.strictEqual(u.searchParams.get('ss'), 'Florianópolis');
    assert.strictEqual(new URL(hotels.hotelBookingUrl(p, env({}))).searchParams.has('aid'), false);
  });
  await t('ómnibus, ferry y seguro tienen enlace por defecto y se pueden reemplazar', async function () {
    const p = { destName: 'Buenos Aires', dep: dep, ret: ret, pax: 2 };
    assert.ok(busbud.groundBookingUrl('bus', p, env({})).indexOf('rome2rio.com/map/Montevideo/Buenos%20Aires') > 0);
    assert.ok(busbud.groundBookingUrl('ferry', p, env({})).indexOf('buquebus.com') > 0);
    assert.strictEqual(busbud.groundBookingUrl('bus', p, env({ BUS_URL_TEMPLATE: 'https://b.com/{dest_name}?a={affiliate}', BUS_AFFILIATE_ID: 'X' })), 'https://b.com/Buenos%20Aires?a=X');
    const bq = await busbud.getBusQuote(Object.assign({ mode: 'bus' }, p));
    assert.strictEqual(bq.pp, null); assert.ok(bq.bookingUrl);
    assert.ok((await hotels.getHotelQuote(Object.assign({ rooms: 1 }, p))).bookingUrl);
    assert.ok((await insurance.getInsuranceQuote(p, env({}))).bookingUrl);
  });

  console.log('Duffel');
  await t('elige la oferta más barata en US$ y resume escalas', function () {
    const r = duffel.parseOffers(fakeOffers([
      offer(640, 'USD', 'Aerolínea A', ['2027-01-10'], ['2027-01-17']),
      offer(512.4, 'USD', 'Aerolínea B', ['2027-01-10', '2027-01-10'], ['2027-01-17']),
      offer(300, 'EUR', 'Aerolínea C', ['2027-01-10'], ['2027-01-17'])
    ]));
    assert.strictEqual(r.pp, 512); assert.strictEqual(r.airline, 'Aerolínea B'); assert.strictEqual(r.transfers, 1);
  });
  await t('convierte otras monedas si hay tipo de cambio; sin ofertas devuelve null', function () {
    assert.strictEqual(duffel.parseOffers(fakeOffers([offer(300, 'EUR', 'C', ['2027-01-10'], ['2027-01-17'])]), { EUR: 1.1 }).pp, 330);
    assert.strictEqual(duffel.parseOffers(fakeOffers([])), null);
  });
  await t('arma bien el pedido a Duffel y agrega bookingUrl a la oferta', async function () {
    let seen;
    const f = async function (url, opts) {
      seen = { url: url, opts: opts };
      return { ok: true, status: 200, json: async function () { return fakeOffers([offer(500, 'USD', 'X', ['2027-01-10'], ['2027-01-17'])]); } };
    };
    const r = await duffel.getFlightQuote({ token: 'tok', origin: 'MVD', destination: 'FLN', dep: '2027-01-10', ret: '2027-01-17', maxConnections: 1, fetchImpl: f });
    assert.strictEqual(seen.opts.headers['Duffel-Version'], 'v2'); assert.strictEqual(seen.opts.headers['Authorization'], 'Bearer tok');
    const body = JSON.parse(seen.opts.body).data;
    assert.deepStrictEqual(body.slices[1], { origin: 'FLN', destination: 'MVD', departure_date: '2027-01-17' });
    assert.strictEqual(body.max_connections, 1);
    assert.ok(r.bookingUrl && r.bookingUrl.indexOf('https://') === 0);
  });
  await t('propaga el estado HTTP de un error', async function () {
    const f = async function () { return { ok: false, status: 429, json: async function () { return { errors: [{ message: 'Too many' }] }; } }; };
    await assert.rejects(duffel.getFlightQuote({ token: 't', origin: 'A', destination: 'B', dep: 'x', ret: 'y', fetchImpl: f }), function (e) { return e.status === 429; });
  });

  console.log('Modelo');
  await t('devuelve componentes: transportes ordenados, 3 hoteles, 3 estilos y seguro', function () {
    const v = model.validate({ dest: 'fln', dep: dep, ret: ret, pax: '2' }, today);
    const r = model.compute(v.S, v.dep, v.ret, today, {});
    assert.strictEqual(r.days, 8); assert.strictEqual(r.lodging.length, 3); assert.strictEqual(r.styles.length, 3);
    for (let i = 1; i < r.transport.length; i++) assert.ok(r.transport[i].price >= r.transport[i - 1].price);
    assert.ok(r.insurance.total > 0);
    r.styles.forEach(function (s) { assert.ok(s.meal > 0 && s.local > 0); });
    assert.ok(r.styles[0].meal < r.styles[1].meal && r.styles[1].meal < r.styles[2].meal);   // mochilero < estándar < confort
  });
  await t('la serie de fechas coincide con los precios en el desplazamiento 0', function () {
    const v = model.validate({ dest: 'ba', dep: dep, ret: ret, pax: '3' }, today);
    const r = model.compute(v.S, v.dep, v.ret, today, {});
    const z = r.series.find(function (x) { return x.shift === 0; });
    r.transport.forEach(function (tr) { assert.strictEqual(z.transport[tr.id], tr.price); });
    Object.keys(z.lodging).forEach(function (k) { assert.strictEqual(z.lodging[k], 0); });   // el alojamiento viaja como diferencia frente a tu fecha
  });
  await t('un precio real de vuelo reemplaza la estimación y se marca como real', function () {
    const v = model.validate({ dest: 'fln', dep: dep, ret: ret, pax: '2' }, today);
    const est = model.compute(v.S, v.dep, v.ret, today, {}).transport.find(function (x) { return x.id === 'avion_mvd'; });
    const real = model.compute(v.S, v.dep, v.ret, today, { transport: { avion_mvd: { pp: 500, airline: 'X', bookingUrl: 'https://x.com' } } })
      .transport.find(function (x) { return x.id === 'avion_mvd'; });
    assert.strictEqual(est.source, 'estimado'); assert.strictEqual(real.source, 'real');
    assert.strictEqual(real.parts.pasajes, 1000); assert.strictEqual(real.bookingUrl, 'https://x.com');
  });
  await t('valida entradas incorrectas', function () {
    [{ dest: 'zz' }, { dest: 'fln', dep: 'x', ret: 'y' }, { dest: 'fln', dep: ret, ret: dep, pax: 2 }, { dest: 'fln', dep: dep, ret: ret, pax: 99 }]
      .forEach(function (b) { assert.throws(function () { model.validate(b, today); }); });
  });

  console.log('Servidor');
  delete process.env.DUFFEL_TOKEN;
  process.env.RATE_LIMIT_PER_MIN = '1000';
  const server = require('./server').createServer();
  await new Promise(function (r) { server.listen(0, r); });
  const port = server.address().port;

  await t('modo demo: componentes estimados y todos con bookingUrl', async function () {
    const r = await get(port, '/api/cotizar?' + q);
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.meta.mode, 'demo'); assert.strictEqual(j.meta.days, j.meta.nights + 1);
    assert.ok(j.transport.length >= 3);
    j.transport.forEach(function (x) { assert.ok(/^https?:\/\//.test(x.bookingUrl), x.id); assert.strictEqual(x.source, 'estimado'); });
    j.lodging.forEach(function (l) { assert.ok(/^https:\/\/www\.booking\.com\//.test(l.bookingUrl)); });
    assert.ok(/^https?:\/\//.test(j.insurance.bookingUrl));
  });
  await t('lista de destinos, errores 400 y archivos de la web', async function () {
    assert.ok(JSON.parse((await get(port, '/api/destinos')).body).some(function (d) { return d.key === 'fln'; }));
    const bad = await get(port, '/api/cotizar?dest=zz&dep=' + dep + '&ret=' + ret + '&pax=2');
    assert.strictEqual(bad.status, 400);
    const page = await get(port, '/');
    assert.ok(page.body.indexOf('id="openCheckout"') >= 0 && page.body.indexOf('id="checkout"') >= 0); assert.ok(page.headers['content-security-policy']);
    assert.strictEqual((await get(port, '/app.js')).status, 200); assert.strictEqual((await get(port, '/style.css')).status, 200);
  });
  await t('bloquea rutas fuera de /public', async function () {
    const a = await get(port, '/..%2Fserver.js'), b = await get(port, '/%2e%2e/server.js');
    assert.ok([403, 404].indexOf(a.status) >= 0 && [403, 404].indexOf(b.status) >= 0);
  });

  process.env.DUFFEL_TOKEN = 'duffel_test_fake';
  providers.clearCache();
  let calls = 0;
  providers.setFetch(async function (url, opts) {
    calls++;
    const b = JSON.parse(opts.body).data;
    const price = b.slices[0].origin === 'MVD' ? 380 : 300;
    return { ok: true, status: 200, json: async function () {
      return fakeOffers([offer(price, 'USD', 'Aerolínea Test', [b.slices[0].departure_date], [b.slices[1].departure_date])]);
    } };
  });
  await t('modo real: precios de Duffel marcados como reales, con enlace de reserva', async function () {
    const j = JSON.parse((await get(port, '/api/cotizar?' + q)).body);
    assert.strictEqual(j.meta.mode, 'live');
    const mvd = j.transport.find(function (x) { return x.id === 'avion_mvd'; });
    const ba = j.transport.find(function (x) { return x.id === 'avion_ba'; });
    assert.strictEqual(mvd.source, 'real'); assert.strictEqual(mvd.parts.pasajes, 760); assert.strictEqual(mvd.quote.airline, 'Aerolínea Test');
    assert.strictEqual(ba.source, 'real'); assert.ok(ba.parts.pasajes > 600);
    assert.ok(/^https?:\/\//.test(mvd.bookingUrl));
    assert.strictEqual(j.transport.find(function (x) { return x.id === 'bus'; }).source, 'estimado');
  });
  await t('recuerda los precios: otra cantidad de viajeros no vuelve a llamar a Duffel', async function () {
    const before = calls;
    const j = JSON.parse((await get(port, '/api/cotizar?dest=fln&dep=' + dep + '&ret=' + ret + '&pax=4')).body);
    assert.strictEqual(calls, before);
    assert.strictEqual(j.transport.find(function (x) { return x.id === 'avion_mvd'; }).parts.pasajes, 380 * 4);
  });
  await t('si Duffel falla, cae a estimaciones sin romper y conserva los enlaces', async function () {
    providers.clearCache();
    providers.setFetch(async function () { return { ok: false, status: 500, json: async function () { return {}; } }; });
    const origErr = console.error; console.error = function () {};
    const r = await get(port, '/api/cotizar?' + q);
    console.error = origErr;
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200);
    j.transport.forEach(function (x) { assert.strictEqual(x.source, 'estimado'); assert.ok(x.bookingUrl); });
  });


  console.log('Booking.com (hoteles con precio real)');
  const searchResp = { data: [
    { id: 1, currency: 'USD', price: { total: 300 }, url: 'https://www.booking.com/hotel/br/uno.html?aid=42&checkin=x' },
    { id: 2, currency: 'USD', price: { total: 420 }, url: 'https://www.booking.com/hotel/br/dos.html?aid=42' },
    { id: 3, currency: 'USD', price: { total: 900 }, url: 'https://www.booking.com/hotel/br/tres.html?aid=42' },
    { id: 4, currency: 'BRL', price: { total: 5000 }, url: 'https://www.booking.com/hotel/br/cuatro.html?aid=42' },
    { id: 5, currency: 'USD', price: { total: 350 }, url: 'https://www.booking.com/hotel/br/cinco.html?aid=42' }
  ] };
  const detailsResp = { data: [
    { id: 1, name: { 'en-gb': 'Hostel Uno' }, rating: { stars: 2, review_score: 8.1, number_of_reviews: 120 } },
    { id: 2, name: { es: 'Hotel Dos' }, rating: { stars: 3, review_score: 8.6, number_of_reviews: 900 } },
    { id: 3, name: { es: 'Gran Hotel Tres' }, rating: { stars: 5, review_score: 9.2, number_of_reviews: 4000 } },
    { id: 4, name: { es: 'Cuatro' }, rating: { stars: 4, review_score: 8, number_of_reviews: 10 } },
    { id: 5, name: { es: 'Posada Cinco' }, rating: { stars: 2, review_score: 5.9, number_of_reviews: 30 } }
  ] };
  await t('une búsqueda y detalles, pasa a US$ y clasifica por estrellas', function () {
    const list = hotels.normalize(searchResp, detailsResp, {});
    assert.strictEqual(list.length, 4);                                   // el de BRL se descarta sin tipo de cambio
    assert.strictEqual(list.find(function (p) { return p.accommodationId === 1; }).tier, 0);
    assert.strictEqual(list.find(function (p) { return p.accommodationId === 2; }).tier, 1);
    assert.strictEqual(list.find(function (p) { return p.accommodationId === 3; }).tier, 2);
    assert.strictEqual(list.find(function (p) { return p.accommodationId === 2; }).name, 'Hotel Dos');
    const conFx = hotels.normalize(searchResp, detailsResp, { BOOKING_FX: '{"BRL":0.2}' });
    assert.strictEqual(conFx.find(function (p) { return p.accommodationId === 4; }).total, 1000);
  });
  await t('por categoría deja las más baratas y evita las de opiniones bajas', function () {
    const picked = hotels.pickPerTier(hotels.normalize(searchResp, detailsResp, {}));
    assert.ok(!picked.some(function (p) { return p.accommodationId === 5; }));   // puntaje 5,9: se descarta habiendo mejores
    assert.deepStrictEqual(picked.map(function (p) { return p.accommodationId; }), [1, 2, 3]);
  });
  await t('arma bien el pedido a Booking (encabezados, aeropuerto o ciudad, moneda)', async function () {
    const calls = [];
    const f = async function (url, opts) {
      calls.push({ url: url, opts: opts });
      return { ok: true, status: 200, json: async function () { return calls.length === 1 ? searchResp : detailsResp; } };
    };
    const e = { BOOKING_API_KEY: 'key123', BOOKING_AFFILIATE_ID: '42' };
    const cfg = model.DEST.fln;
    const r = await hotels.searchProperties({ destKey: 'fln', cfg: cfg, dep: '2027-01-10', ret: '2027-01-17', pax: 3, rooms: 2, platform: 'mobile', env: e, fetchImpl: f });
    assert.strictEqual(r.length, 3);
    assert.strictEqual(calls[0].url, 'https://demandapi.booking.com/3.1/accommodations/search');
    assert.strictEqual(calls[0].opts.headers['Authorization'], 'Bearer key123'); assert.strictEqual(calls[0].opts.headers['X-Affiliate-Id'], '42');
    const b = JSON.parse(calls[0].opts.body);
    assert.strictEqual(b.airport, 'FLN'); assert.strictEqual(b.city, undefined); assert.strictEqual(b.currency, 'USD');
    assert.deepStrictEqual(b.guests, { number_of_adults: 3, number_of_rooms: 2 }); assert.deepStrictEqual(b.booker, { country: 'uy', platform: 'mobile' });
    assert.strictEqual(b.checkin, '2027-01-10'); assert.strictEqual(JSON.parse(calls[1].opts.body).accommodations.length, 5);
    assert.strictEqual(calls[1].url, 'https://demandapi.booking.com/3.1/accommodations/details');
    calls.length = 0;
    await hotels.searchProperties({ destKey: 'fln', cfg: cfg, dep: '2027-01-10', ret: '2027-01-17', pax: 2, rooms: 1,
      env: Object.assign({ BOOKING_CITY_IDS: '{"fln": -123456}' }, e), fetchImpl: f });
    assert.strictEqual(JSON.parse(calls[0].opts.body).city, -123456); assert.strictEqual(JSON.parse(calls[0].opts.body).airport, undefined);
  });
  await t('el modelo muestra propiedades reales por categoría y estima la que falte', function () {
    const props = hotels.pickPerTier(hotels.normalize(searchResp, detailsResp, {})).filter(function (p) { return p.tier !== 2; });   // sin confort
    const v = model.validate({ dest: 'fln', dep: dep, ret: ret, pax: '2' }, today);
    const r = model.compute(v.S, v.dep, v.ret, today, { lodging: { properties: props, bookingUrl: 'https://respaldo.example/' } });
    assert.strictEqual(r.lodging.filter(function (l) { return l.kind === 'property'; }).length, 2);
    const conf = r.lodging.find(function (l) { return l.tier === 2; });
    assert.strictEqual(conf.kind, 'tier'); assert.strictEqual(conf.source, 'estimado'); assert.strictEqual(conf.bookingUrl, 'https://respaldo.example/');
    const uno = r.lodging.find(function (l) { return l.id === 'bk_1'; });
    assert.strictEqual(uno.source, 'real'); assert.strictEqual(uno.total, 300); assert.ok(/booking\.com\/hotel\/br\/uno/.test(uno.bookingUrl));
    assert.ok(/2 estrellas/.test(uno.desc));
  });

  console.log('Reserva de vuelos con Duffel Links');
  await t('la referencia va firmada y no se puede falsificar', function () {
    const e = { SESSION_SECRET: 'secreto', DUFFEL_TOKEN: 't' };
    const ref = duffel.makeReference({ dest: 'fln', dep: dep, ret: ret, pax: 2 }, e);
    assert.ok(duffel.verifyReference(ref, e));
    assert.ok(!duffel.verifyReference(ref.replace('fln', 'mad'), e));
    assert.ok(!duffel.verifyReference(ref, { SESSION_SECRET: 'otro' }));
    assert.ok(!duffel.verifyReference('cualquier-cosa', e));
  });
  await t('crea la sesión de Links con las URL de vuelta y la comisión opcional', async function () {
    let seen;
    const f = async function (url, opts) { seen = { url: url, opts: opts }; return { ok: true, status: 200, json: async function () { return { data: { url: 'https://links.duffel.com/abc' } }; } }; };
    const e = { DUFFEL_TOKEN: 'tok', PUBLIC_BASE_URL: 'https://cuantosale.uy/', DUFFEL_MARKUP_RATE: '0.05' };
    const u = await duffel.createLinkSession({ reference: 'ref1', env: e, fetchImpl: f });
    assert.strictEqual(u, 'https://links.duffel.com/abc'); assert.strictEqual(seen.url, 'https://api.duffel.com/links/sessions');
    const d = JSON.parse(seen.opts.body).data;
    assert.strictEqual(d.success_url, 'https://cuantosale.uy/gracias.html'); assert.strictEqual(d.abandonment_url, 'https://cuantosale.uy/?volver=reserva');
    assert.strictEqual(d.reference, 'ref1'); assert.strictEqual(d.markup_rate, '0.05'); assert.strictEqual(d.markup_currency, 'USD');
    assert.strictEqual(seen.opts.headers['Duffel-Version'], 'v2');
    await assert.rejects(duffel.createLinkSession({ reference: 'r', env: e, fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { data: {} }; } }; } }));
  });
  await t('lee una orden y resume el itinerario', async function () {
    const f = async function (url) {
      assert.strictEqual(url, 'https://api.duffel.com/air/orders/ord_ABC123');
      return { ok: true, status: 200, json: async function () { return { data: { booking_reference: 'XY12Z3', total_amount: '812.40', total_currency: 'USD',
        owner: { name: 'Aerolínea Test' }, passengers: [{}, {}], slices: [{ origin: { iata_code: 'MVD' }, destination: { iata_code: 'FLN' }, segments: [{ departing_at: '2027-01-10T09:00:00' }] }] } }; } };
    };
    const o = await duffel.getOrder({ orderId: 'ord_ABC123', env: { DUFFEL_TOKEN: 't' }, fetchImpl: f });
    assert.strictEqual(o.bookingReference, 'XY12Z3'); assert.strictEqual(o.passengers, 2); assert.strictEqual(o.slices[0].destination, 'FLN');
    await assert.rejects(duffel.getOrder({ orderId: '../x', env: {}, fetchImpl: f }));
  });

  // ---- servidor con Booking y Duffel Links configurados (respuestas simuladas) ----
  process.env.BOOKING_API_KEY = 'key123'; process.env.BOOKING_AFFILIATE_ID = '42';
  process.env.PUBLIC_BASE_URL = 'https://cuantosale.uy'; process.env.SESSION_SECRET = 'secreto-de-prueba';
  providers.clearCache();
  let linkBody = null, failLinks = false;
  providers.setFetch(async function (url, opts) {
    const ok = function (j) { return { ok: true, status: 200, json: async function () { return j; } }; };
    if (url.indexOf('demandapi') >= 0) return ok(url.endsWith('/search') ? searchResp : detailsResp);
    if (url.indexOf('links/sessions') >= 0) {
      if (failLinks) return { ok: false, status: 403, json: async function () { return { errors: [{ message: 'country not supported' }] }; } };
      linkBody = JSON.parse(opts.body).data; return ok({ data: { url: 'https://links.duffel.com/sesion-1' } });
    }
    if (url.indexOf('/air/orders/') >= 0) return ok({ data: { booking_reference: 'ABC123', total_amount: '900', total_currency: 'USD', slices: [], passengers: [{}] } });
    const b = JSON.parse(opts.body).data;
    return ok(fakeOffers([offer(b.slices[0].origin === 'MVD' ? 380 : 300, 'USD', 'Aerolínea Test', [b.slices[0].departure_date], [b.slices[1].departure_date])]));
  });
  await t('con Booking y Links: hoteles reales y vuelos con enlace interno /go/vuelo', async function () {
    const j = JSON.parse((await get(port, '/api/cotizar?' + q)).body);
    assert.strictEqual(j.meta.sources.hotels, true); assert.strictEqual(j.meta.sources.flights, true);
    const props = j.lodging.filter(function (l) { return l.kind === 'property'; });
    assert.strictEqual(props.length, 3);
    props.forEach(function (l) { assert.ok(/^https:\/\/www\.booking\.com\/hotel\//.test(l.bookingUrl)); assert.strictEqual(l.source, 'real'); });
    const mvd = j.transport.find(function (x) { return x.id === 'avion_mvd'; });
    assert.strictEqual(mvd.bookingKind, 'duffel-links');
    assert.ok(mvd.bookingUrl.indexOf('/go/vuelo?') === 0 && mvd.bookingUrl.indexOf('mode=avion_mvd') > 0);
    assert.strictEqual(j.transport.find(function (x) { return x.id === 'bus'; }).bookingKind, 'external');
  });
  await t('/go/vuelo crea la sesión y redirige al reservador de Duffel', async function () {
    const r = await get(port, '/go/vuelo?mode=avion_mvd&dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2');
    assert.strictEqual(r.status, 302); assert.strictEqual(r.headers.location, 'https://links.duffel.com/sesion-1');
    assert.ok(duffel.verifyReference(linkBody.reference)); assert.ok(linkBody.reference.indexOf('fln-') === 0);
  });
  await t('/go/vuelo cae al enlace de afiliados si Duffel Links falla, y valida datos', async function () {
    failLinks = true;
    const origErr = console.error; console.error = function () {};
    const r = await get(port, '/go/vuelo?mode=avion_ba&dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2');
    const bad = await get(port, '/go/vuelo?mode=avion_ba&dest=zz&dep=' + dep + '&ret=' + ret + '&pax=2');
    console.error = origErr; failLinks = false;
    assert.strictEqual(r.status, 302); assert.ok(r.headers.location.indexOf('https://www.google.com/travel/flights') === 0 && r.headers.location.indexOf('BUE') > 0);
    assert.strictEqual(bad.status, 400);
  });
  await t('la confirmación solo entrega datos con una referencia firmada por nosotros', async function () {
    const ref = duffel.makeReference({ dest: 'fln', dep: dep, ret: ret, pax: 2 });
    const ok = await get(port, '/api/reservas/vuelo?order_id=ord_ABC123&reference=' + encodeURIComponent(ref));
    assert.strictEqual(ok.status, 200); assert.strictEqual(JSON.parse(ok.body).bookingReference, 'ABC123');
    assert.strictEqual((await get(port, '/api/reservas/vuelo?order_id=ord_ABC123&reference=fln-20270101-20270108-2-deadbeef.0000000000000000')).status, 403);
    assert.strictEqual((await get(port, '/api/reservas/vuelo?order_id=ord_ABC123')).status, 403);
    const page = await get(port, '/gracias.html'); assert.strictEqual(page.status, 200);
    assert.strictEqual((await get(port, '/logo.svg')).status, 200);
  });
  delete process.env.BOOKING_API_KEY; delete process.env.BOOKING_AFFILIATE_ID; delete process.env.PUBLIC_BASE_URL; delete process.env.SESSION_SECRET;

  server.close();
  console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' (con fallas)' : ''));
})();
