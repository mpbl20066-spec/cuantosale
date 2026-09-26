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
function get(port, path, headers) {
  return new Promise(function (resolve, reject) {
    const opts = { port: port, path: path };
    if (headers) opts.headers = headers;
    http.get(opts, function (res) {
      let b = ''; res.on('data', function (c) { b += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: b, headers: res.headers }); });
    }).on('error', reject);
  });
}
function basic(user, pass) {
  return { Authorization: 'Basic ' + Buffer.from(user + ':' + pass, 'utf8').toString('base64') };
}
const today = model.getToday();
const dep = model.iso(model.addDays(today, 60));
const ret = model.iso(model.addDays(today, 67));
const q = 'dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq';

// Distancia en línea recta entre dos puntos, en km. Es la cota inferior de
// cualquier ruta por carretera: ningún camino puede ser más corto que el
// vuelo de pájaro. Sirve para detectar kilómetros inventados.
function haversineKm(a, b) {
  const R = 6371, rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}


(async function main() {
  console.log('Modelo');
  await t('ningún roadtrip es más corto que la línea recta', function () {
    // Regresión: el roadtrip a Florianópolis declaraba 720 km cuando la línea
    // recta son 1087. Ese error subestimaba el combustible de todo el
    // litoral de Santa Catarina sin que ninguna prueba lo notara.
    const errors = [];
    Object.keys(model.ROADTRIP_ROUTES).forEach(function (key) {
      const destino = model.DEST_COORDS[key];
      if (!destino) return; // sin coordenadas no hay contra qué comparar
      Object.keys(model.ORIGIN_COORDS).forEach(function (origen) {
        const piso = haversineKm(model.ORIGIN_COORDS[origen], destino);
        const declarado = model.ROADTRIP_ROUTES[key].km;
        if (declarado < piso) errors.push(key + ' desde ' + origen + ': ' + declarado + ' km < ' + Math.round(piso) + ' km de línea recta');
      });
    });
    assert.deepStrictEqual(errors, [], 'rutas por debajo de la línea recta: ' + errors.join('; '));
  });
  await t('las horas de manejo son proporcionales a la distancia', function () {
    Object.keys(model.ROADTRIP_ROUTES).forEach(function (key) {
      const r = model.ROADTRIP_ROUTES[key];
      assert.ok(r.km > 0, key + ' sin kilómetros');
      assert.ok(r.hours > 0, key + ' sin horas');
      // Ni 400 km/h (imposible) ni 25 km/h de promedio (excesivamente
      // conservador en ruta). Un promedio de 60-95 km/h cubre rutas mixtas.
      const promedio = r.km / r.hours;
      assert.ok(promedio > 45 && promedio < 100, key + ' promedio de ' + Math.round(promedio) + ' km/h fuera de rango razonable');
    });
  });
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
    const florianopolisBus = model.validate({ dest: 'fln', dep: dep, ret: ret, pax: '2', budget: '3000', style: 'eq', transport: 'bus' }, today);
    assert.strictEqual(florianopolisBus.S.transport, 'bus');
    const buenosAiresAuto = model.validate({ dest: 'bue', dep: dep, ret: ret, pax: '2', budget: '3000', style: 'eq', transport: 'auto' }, today);
    assert.strictEqual(buenosAiresAuto.S.transport, 'auto');
  });

  console.log('Servidor y proveedores');
  process.env.RATE_LIMIT_PER_MIN = '1000';
  process.env.DUFFEL_API_KEY = '';
  process.env.DUFFEL_ACCESS_TOKEN = '';
  process.env.DUFFEL_TOKEN = '';
  process.env.BOOKING_API_KEY = '';
  process.env.BOOKING_API_HOST = 'booking-com15.p.rapidapi.com';
  const app = require('./server');
  const duffel = require('./lib/providers/duffel');
  await t('mapea las ofertas de Duffel al contrato visual de vuelos', function () {
    const offer = duffel.mapOffer({
      id: 'off_test_1', total_amount: '321.50', total_currency: 'USD',
      owner: { name: 'Aerolínea propietaria', logo_symbol_url: 'https://logo.test/a.svg' },
      passengers: [{ id: 'pas_1', cabin_class: 'economy' }],
      slices: [
        { segments: [{ origin: { iata_code: 'MVD', name: 'Carrasco' }, destination: { iata_code: 'FLN', name: 'Florianópolis' }, departing_at: '2027-01-10T10:00:00Z', arriving_at: '2027-01-10T13:45:00Z', marketing_carrier: { iata_code: 'XX', name: 'Marca' }, operating_carrier: { name: 'Aerolínea Operadora' }, marketing_carrier_flight_number: '123' }] },
        { segments: [{ origin: { iata_code: 'FLN', name: 'Florianópolis' }, destination: { iata_code: 'MVD', name: 'Carrasco' }, departing_at: '2027-01-17T10:00:00Z', arriving_at: '2027-01-17T14:10:00Z', marketing_carrier: { name: 'Marca' }, operating_carrier: { name: 'Aerolínea Operadora' } }] }
      ]
    }, 'economy');
    assert.strictEqual(offer.provider, 'duffel');
    assert.strictEqual(offer.trip_type, 'round_trip');
    assert.strictEqual(offer.departure_airport.code, 'MVD');
    assert.strictEqual(offer.inbound.destination.code, 'MVD');
    assert.strictEqual(offer.airline, 'Aerolínea Operadora');
    assert.strictEqual(offer.price_usd, 321.5);
    assert.strictEqual(offer.passenger_ids[0], 'pas_1');
  });
  await t('mantiene las reglas de cabina por estilo', function () {
    assert.deepStrictEqual(duffel.styleCabins('ahorro'), ['economy']);
    assert.deepStrictEqual(duffel.styleCabins('eq'), ['economy', 'premium_economy']);
    assert.deepStrictEqual(duffel.styleCabins('comodo'), ['premium_economy', 'business']);
  });
  await t('resuelve lugares y busca vuelos con Duffel-Version v2 y Bearer auth', async function () {
    const oldKey = process.env.DUFFEL_API_KEY;
    const seen = [];
    process.env.DUFFEL_API_KEY = 'test-token';
    duffel.setFetch(async function (url, options) {
      const parsed = new URL(url);
      seen.push({ url: parsed, options: options });
      if (parsed.pathname === '/places/suggestions') {
        const code = parsed.searchParams.get('query');
        return { ok: true, status: 200, json: async function () { return { data: [{ type: 'airport', iata_code: code, name: code === 'MVD' ? 'Carrasco' : 'Florianópolis' }] }; } };
      }
      return { ok: true, status: 200, json: async function () { return { data: { offers: [{
        id: 'off_mvd_fln', total_amount: '321.00', total_currency: 'USD', passengers: [{ id: 'pas_1' }], slices: [{ segments: [{
          origin: { iata_code: 'MVD', name: 'Carrasco' }, destination: { iata_code: 'FLN', name: 'Florianópolis' }, departing_at: '2027-01-10T10:00:00Z', arriving_at: '2027-01-10T13:00:00Z', operating_carrier: { name: 'Aerolínea Test' }
        }] }] }] } }; } };
    });
    try {
      const offers = await duffel.searchFlights({ origin: 'MVD', destination: 'FLN', departureDate: dep, returnDate: ret, passengers: 2, cabinClass: 'economy' });
      assert.strictEqual(offers.length, 1);
      assert.strictEqual(offers[0].departure_airport.code, 'MVD');
      assert.strictEqual(offers[0].price_usd, 321);
      assert.strictEqual(seen.filter(function (request) { return request.url.pathname === '/places/suggestions'; }).length, 2);
      const request = seen.find(function (item) { return item.url.pathname === '/air/offer_requests'; });
      assert.ok(request);
      assert.strictEqual(request.url.searchParams.get('return_offers'), 'true');
      assert.strictEqual(request.options.headers.Authorization, 'Bearer test-token');
      assert.strictEqual(request.options.headers['Duffel-Version'], 'v2');
      const body = JSON.parse(request.options.body);
      assert.deepStrictEqual(body.data.slices, [{ origin: 'MVD', destination: 'FLN', departure_date: dep }, { origin: 'FLN', destination: 'MVD', departure_date: ret }]);
      assert.strictEqual(body.data.passengers.length, 2);
    } finally {
      duffel.setFetch(null);
      process.env.DUFFEL_API_KEY = oldKey;
    }
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
      // Siempre son 3: el hotel real de Booking más 2 de respaldo que completan la categoría.
      assert.strictEqual(list.length, 3);
      assert.strictEqual(list[0].name, 'Hotel Booking Floripa');
      assert.strictEqual(list[0].image, 'https://images.example/hotel.jpg');
      assert.strictEqual(list[0].total, 700);
      assert.strictEqual(list[0].perNight, 100);
      assert.strictEqual(list[0].source, 'booking');
      assert.deepStrictEqual(list.slice(1).map(function (hotel) { return hotel.source; }), ['fallback', 'fallback']);
      assert.ok(seen.some(function (request) { return request.url.hostname === 'booking-com15.p.rapidapi.com' && request.url.pathname.endsWith('/api/v1/hotels/searchHotels'); }));
      // Solo los pedidos a Booking llevan la key. La conversion de links de
      // Travelpayouts es otro proveedor y va por otro lado; si se mezclara el
      // mock, el assertion de aca miraria la key equivocada.
      assert.ok(seen.filter(function (request) { return request.url.hostname === 'booking-com15.p.rapidapi.com'; }).every(function (request) { return request.options.headers['x-rapidapi-key'] === 'test-key'; }));
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  await t('sin foto real completa el resto con el respaldo de cadenas conocidas', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    global.fetch = async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: '-123', search_type: 'city' }] }; } };
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [{ hotel_id: 'hotel-2', property: { name: 'Hotel sin foto' }, priceBreakdown: { grossPrice: { value: 460, currency: 'USD' } } }] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    try {
      const list = await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7 });
      assert.strictEqual(list.length, 3);
      assert.ok(list.every(function (hotel) { return hotel.source === 'fallback'; }));
      assert.ok(list.every(function (hotel) { return /^https:\/\/www\.booking\.com\//.test(hotel.bookingUrl); }));
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  await t('ante fallos de Booking siempre entrega 3 opciones de respaldo de la categoría elegida', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    global.fetch = async function () { throw new Error('timeout'); };
    const originalWarn = console.warn; console.warn = function () {};
    try {
      const list = await app.hotelRecommendations('fln', 'Florianópolis', 'eq', { dep: dep, ret: ret, pax: 2 });
      assert.strictEqual(list.length, 3);
      assert.ok(list.every(function (hotel) { return hotel.source === 'fallback' && hotel.tier === 'moderado'; }));
      assert.ok(list.every(function (hotel) { return Number(hotel.perNight) > 0 && Number(hotel.total) > 0; }));
      assert.strictEqual(new Set(list.map(function (hotel) { return hotel.name; })).size, 3);
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; console.warn = originalWarn; }
  });

  const server = app.createServer();
  await new Promise(function (r) { server.listen(0, r); });
  const port = server.address().port;
  await t('expone ofertas Duffel por la ruta de búsqueda que consume la PWA', async function () {
    process.env.DUFFEL_API_KEY = 'test-token';
    duffel.setFetch(async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname === '/places/suggestions') {
        const code = parsed.searchParams.get('query');
        return { ok: true, status: 200, json: async function () { return { data: [{ type: 'airport', iata_code: code, name: code }] }; } };
      }
      return { ok: true, status: 200, json: async function () { return { data: { offers: [{
        id: 'off_api_test', total_amount: '250.00', total_currency: 'USD', slices: [{ segments: [{
          origin: { iata_code: 'MVD', name: 'Carrasco' }, destination: { iata_code: 'FLN', name: 'Florianópolis' }, departing_at: '2027-01-10T10:00:00Z', arriving_at: '2027-01-10T13:00:00Z', operating_carrier: { name: 'Operadora Test' }
        }] }]
      }] } }; } };
    });
    try {
      const response = await post(port, '/api/vuelos/buscar', { origen: 'MVD', destino: 'fln', fecha_ida: dep, fecha_vuelta: ret, pasajeros: 1, style: 'ahorro' });
      const payload = JSON.parse(response.body);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(payload.provider, 'duffel');
      assert.strictEqual(payload.offers[0].id, 'off_api_test');
      assert.strictEqual(payload.offers[0].price_usd, 250);
      assert.strictEqual(payload.offers[0].airline, 'Operadora Test');
    } finally {
      duffel.setFetch(null);
      process.env.DUFFEL_API_KEY = '';
    }
  });
  await t('cotiza un viaje estimado sin credenciales externas', async function () {
    const r = await get(port, '/api/cotizar?' + q + '&origin=PDP&subcategory=Praia%20dos%20Ingleses');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.meta.mode, 'estimated');
    assert.strictEqual(j.meta.origin, 'PDP'); assert.strictEqual(j.meta.subcategory, 'Praia dos Ingleses');
    assert.ok(j.list.length >= 3); assert.ok(j.recId);
    assert.ok(j.list.every(function (p) { return p.sources.pasajes === 'estimado'; }));
  });
  await t('devuelve únicamente destinos de los cinco bloques de Brasil', async function () {
    const j = JSON.parse((await get(port, '/api/destinos')).body);
    // Gramado, Foz de Iguazú y Canela se agregaron al buscador después de que
    // esta lista se escribiera; si la volvés a tocar, actualizá también acá.
    // Canela entró en lugar de Ilha: el picker de public/app.js ofrece Canela
    // y no ofrece Ilha, y con la lista anterior elegir Canela devolvía 400
    // mientras la búsqueda por presupuesto cotizaba Ilha, que nadie podía ver.
    const allowed = ['rio', 'buz', 'arraial', 'cabo', 'canela', 'porto', 'mcz', 'ssa', 'fln', 'ilhabela', 'ubatuba', 'paraty', 'bue', 'gram', 'igu'];
    assert.ok(j.some(function (d) { return d.key === 'fln'; }));
    assert.ok(j.some(function (d) { return d.key === 'bue' && d.name === 'Buenos Aires'; }));
    assert.strictEqual(j.length, allowed.length);
    assert.deepStrictEqual(j.map(function (d) { return d.key; }).sort(), allowed.slice().sort());
  });
  await t('todo destino del buscador existe en el modelo y es de Brasil salvo Buenos Aires', async function () {
    // Esta es la que habría detectado el desfase de Gramado y Foz: la lista
    // de arriba se desactualiza en silencio, pero el modelo no.
    const j = JSON.parse((await get(port, '/api/destinos')).body);
    j.forEach(function (d) {
      assert.ok(model.DEST[d.key], 'destino del buscador ausente del modelo: ' + d.key);
      const country = d.key === 'bue' ? 'Argentina' : 'Brasil';
      assert.strictEqual(model.DEST[d.key].country || 'Brasil', country, 'país inesperado en ' + d.key);
      assert.ok(d.name && typeof d.name === 'string', 'destino sin nombre: ' + d.key);
    });
  });
  await t('cotiza Buenos Aires como destino de Argentina', async function () {
    const r = await get(port, '/api/cotizar?dest=bue&dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.meta.dest.key, 'bue');
    assert.strictEqual(j.meta.dest.country, 'Argentina'); assert.ok(j.list.length >= 3);
  });
  await t('cotiza destinos de los cinco bloques ordenados por total', async function () {
    const r = await get(port, '/api/cotizar-todos?dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.options.length, 12);
    assert.ok(j.options.every(function (o) { return ['rio', 'buz', 'arraial', 'cabo', 'canela', 'porto', 'mcz', 'ssa', 'fln', 'ilhabela', 'ubatuba', 'paraty'].includes(o.dest.key); }));
    for (let i = 1; i < j.options.length; i++) assert.ok(j.options[i].total >= j.options[i - 1].total);
    assert.ok(j.options.every(function (o) { return o.parts && o.dest && typeof o.fits === 'boolean'; }));
  });
  await t('rechaza parámetros inválidos con 400', async function () {
    const r = await get(port, '/api/cotizar?dest=zz&dep=' + dep + '&ret=' + ret + '&pax=2');
    assert.strictEqual(r.status, 400); assert.ok(JSON.parse(r.body).error);
  });
  await t('precifica las tarjetas de destinos destacados con el modelo real', async function () {
    const items = ['rio', 'fln', 'bue'].map(function (k) { return k + '~' + dep + '~' + ret + '~intermedio'; }).join(',');
    const j = JSON.parse((await get(port, '/api/destinos-destacados?items=' + items + '&pax=2&style=eq&origin=MVD')).body);
    assert.strictEqual(j.items.length, 3);
    assert.ok(j.items.every(function (i) { return i.pp > 0 && i.total >= i.pp; }));
    // El cartel anuncia la opción más barata, pero nunca una salida por Buenos
    // Aires: esa conexión la app la descarta y no debe aparecer en el precio.
    assert.ok(j.items.every(function (i) { return i.modeShort !== 'Salir por Buenos Aires'; }));
    assert.ok(j.items.every(function (i) { return i.nights > 0; }));
  });
  await t('descarta destinos y fechas inválidos sin perder los válidos', async function () {
    const junk = ['basura', 'rio~xx~' + ret, 'rio~' + ret + '~' + dep, 'noexiste~' + dep + '~' + ret].join(',');
    const ok = 'rio~' + dep + '~' + ret;
    const j = JSON.parse((await get(port, '/api/destinos-destacados?items=' + junk + ',' + ok)).body);
    // La basura no puede agotar el cupo: el válido del final tiene que entrar.
    assert.strictEqual(j.items.length, 1);
    assert.strictEqual(j.items[0].key, 'rio');
  });
  await t('acota los viajeros de las tarjetas al rango válido', async function () {
    const items = 'rio~' + dep + '~' + ret;
    const up = JSON.parse((await get(port, '/api/destinos-destacados?items=' + items + '&pax=999')).body);
    const down = JSON.parse((await get(port, '/api/destinos-destacados?items=' + items + '&pax=-4')).body);
    assert.strictEqual(up.pax, 10); assert.strictEqual(down.pax, 1);
    // Con 10 viajeros el total por persona tiene que bajar: el vuelo se comparte.
    assert.ok(up.items[0].pp < down.items[0].total);
  });
  await t('el candado de prelanzamiento cierra la API, no sólo las páginas', async function () {
    // Regresión: el candado filtraba por nombre de archivo, así que
    // /api/cotizar y /api/hoteles seguían respondiendo 200 sin contraseña y
    // devolvían cotizaciones reales quemando la cuota de Duffel y Booking.
    const user = 'prelaunch-user', pass = 'prelaunch-pass';
    const cotizar = '/api/cotizar?dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000';
    process.env.APP_USER = user; process.env.APP_PASS = pass;
    try {
      const sinCred = await get(port, cotizar);
      assert.strictEqual(sinCred.status, 401, '/api/cotizar respondió sin credenciales');
      assert.ok(JSON.parse(sinCred.body).error, 'el 401 de la API tiene que ser JSON, no el HTML del navegador');

      const hoteles = await get(port, '/api/hoteles?dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000');
      assert.strictEqual(hoteles.status, 401, '/api/hoteles respondió sin credenciales');

      // La waitlist es la cara pública y lee /api/config para guardar el email.
      assert.strictEqual((await get(port, '/api/config')).status, 200, '/api/config tiene que quedar público para la waitlist');

      const conCred = await get(port, cotizar, basic(user, pass));
      assert.strictEqual(conCred.status, 200, 'con la contraseña correcta tiene que responder');
      assert.strictEqual((await get(port, cotizar, basic(user, 'incorrecta'))).status, 401, 'con la contraseña incorrecta tiene que rechazar');
      assert.strictEqual((await get(port, cotizar, basic('otro', pass))).status, 401, 'con el usuario incorrecto tiene que rechazar');
    } finally {
      delete process.env.APP_USER; delete process.env.APP_PASS;
    }
    // Sin variables el desarrollo local sigue abierto.
    assert.strictEqual((await get(port, cotizar)).status, 200, 'sin candado configurado la API responde');
  });
  await t('los endpoints que cuestan plata no comparten cupo con los gratuitos', async function () {
    // /api/cotizar-todos es cálculo local y no gasta cuota. Antes compartía
    // cubo con /api/cotizar, que sí llama a Duffel: golpear el endpoint
    // gratuito le agotaba el cupo de cotizar al usuario.
    const libre = '/api/cotizar-todos?dep=' + dep + '&ret=' + ret + '&pax=2&budget=9000&style=eq';
    const caro = '/api/cotizar?dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2&budget=9000&style=eq';
    // IP propia para no arrastrar el consumo de las pruebas anteriores.
    const ip = { 'X-Forwarded-For': '203.0.113.7' };
    const original = process.env.RATE_LIMIT_PER_MIN;
    process.env.RATE_LIMIT_PER_MIN = '3';
    try {
      for (let i = 0; i < 6; i++) await get(port, libre, ip);
      assert.strictEqual((await get(port, libre, ip)).status, 429, 'el propio endpoint gratuito tiene que bloquear');
      assert.strictEqual((await get(port, caro, ip)).status, 200, 'el endpoint de pago quedó bloqueado por golpear el gratuito');
    } finally { if (original === undefined) delete process.env.RATE_LIMIT_PER_MIN; else process.env.RATE_LIMIT_PER_MIN = original; }
  });
  await t('el mapa de límites no crece sin techo con muchas IPs distintas', async function () {
    // Regresión: el barrido sólo corría al pasar de 5000 entradas y sólo
    // borraba lo vencido, así que con muchos orígenes dentro del mismo
    // minuto no se borraba nada y el mapa crecía hasta agotar la memoria.
    // Con límite 1 por minuto, la segunda petición de una IP da 429. Si su
    // entrada fue descartada por el techo, el contador arranca de cero y da
    // 200: eso es lo que distingue un mapa acotado de uno que crece.
    const original = process.env.RATE_LIMIT_MAX_IPS;
    const originalMax = process.env.RATE_LIMIT_PER_MIN;
    process.env.RATE_LIMIT_MAX_IPS = '5';
    process.env.RATE_LIMIT_PER_MIN = '1';
    const ipVieja = { 'X-Forwarded-For': '198.51.100.42' };
    // /api/destinos no pasa por limited(), así que sirve /api/cotizar-todos,
    // que sí lo usa.
    const golpe = '/api/cotizar-todos?dep=' + dep + '&ret=' + ret + '&pax=2&budget=9000&style=eq';
    try {
      assert.strictEqual((await get(port, golpe, ipVieja)).status, 200);
      assert.strictEqual((await get(port, golpe, ipVieja)).status, 429, 'sin techo, la segunda petición da 429');
      for (let i = 0; i < 60; i++) {
        await get(port, golpe, { 'X-Forwarded-For': '198.51.100.' + (100 + i) });
      }
      assert.strictEqual((await get(port, golpe, ipVieja)).status, 200,
        'la entrada vieja debió descartarse por el techo y reiniciar su contador');
    } finally {
      if (original === undefined) delete process.env.RATE_LIMIT_MAX_IPS; else process.env.RATE_LIMIT_MAX_IPS = original;
      if (originalMax === undefined) delete process.env.RATE_LIMIT_PER_MIN; else process.env.RATE_LIMIT_PER_MIN = originalMax;
    }
  });
  await t('las ventanas de escapada ofrecen seis meses distintos y en el futuro', async function () {
    // El código de fechas vive en public/app.js, que es un script de navegador
    // sin build: no se puede require()ar. Se ejecuta tal cual está, para que
    // la prueba ejercite el código real y no una copia.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const block = source.match(/var MONTH_NAMES[\s\S]*?function nextSpecialDateAfter[\s\S]*?\n  }/);
    assert.ok(block, 'no se encontró el bloque de fechas en app.js');
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const addDays = function (d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
    const iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const scope = { today: today, addDays: addDays, iso: iso, module: { exports: {} } };
    const factory = new Function('today', 'addDays', 'iso',
      block[0] + '\nreturn { easterSunday: easterSunday, featuredMonthWindows: featuredMonthWindows, nextSpecialDateAfter: nextSpecialDateAfter, MONTH_NAMES: MONTH_NAMES };');
    const fechas = factory(today, addDays, iso);

    // Pascua contra el calendario gregoriano publicado. Si este algoritmo se
    // rompe, Carnaval y Semana Santa caen en fechas que no existen.
    const pascua = { 2020: [3, 12], 2021: [3, 4], 2022: [3, 17], 2023: [3, 9], 2024: [2, 31], 2025: [3, 20], 2026: [3, 5], 2027: [2, 28], 2028: [3, 16], 2030: [3, 21] };
    Object.keys(pascua).forEach(function (year) {
      const d = fechas.easterSunday(Number(year));
      assert.ok(d.getMonth() === pascua[year][0] && d.getDate() === pascua[year][1],
        'Pascua ' + year + ': calculó ' + d.toDateString() + ', el calendario dice ' + pascua[year][0] + '/' + pascua[year][1]);
    });

    const windows = fechas.featuredMonthWindows(6);
    assert.strictEqual(windows.length, 6, 'deben ofrecerse seis meses');
    // Empiezan en el mes actual, que es lo que se pidió: nada de meses pasados.
    assert.strictEqual(windows[0].month, today.getMonth());
    assert.strictEqual(windows[0].year, today.getFullYear());
    // Ninguna ventana en el pasado y ninguna repetida: si Fin de año saliera
    // en diciembre y en enero con las mismas fechas, cambiar de mes no
    // cambiaría nada.
    const departures = windows.map(function (w) { return w.depIso; });
    const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    assert.strictEqual(new Set(departures).size, 6, 'hay meses con las mismas fechas: ' + departures.join(', '));
    windows.forEach(function (w) {
      // w.dep y w.ret ya son Date; w.depIso/w.retIso son las strings.
      assert.ok(w.dep > today, 'ventana en el pasado: ' + w.depIso);
      assert.ok(w.ret > w.dep, 'la vuelta es anterior a la ida: ' + w.depIso);
      assert.ok(w.label, 'ventana sin etiqueta');
    });
    // Los seis meses son correlativos.
    for (let i = 1; i < windows.length; i++) {
      const expected = (new Date(windows[0].year, windows[0].month + i, 1, 12)).getMonth();
      assert.strictEqual(windows[i].month, expected, 'el mes ' + (i + 1) + ' no es correlativo');
    }
    // Y cada ventana sale de verdad en el mes que muestra, o con días de
    // anticipación como para un viaje que arranca el último día. Este es el
    // invariante que hace falta: sin él, comparar sólo el número de mes
    // dejaba que enero tomara el 30 de diciembre del año siguiente, y como
    // esa fecha está en el futuro igual pasaba todos los demás controles.
    windows.forEach(function (w) {
      const monthStart = new Date(w.year, w.month, 1, 12);
      const monthEnd = new Date(w.year, w.month + 1, 0, 12);
      const earliest = new Date(monthStart.getTime() - 10 * 864e5);
      assert.ok(w.dep >= earliest && w.dep <= monthEnd,
        'la ventana de ' + MONTHS[w.month] + ' sale el ' + w.depIso + ', que no pertenece a ese mes');
    });
    // El próximo feriado largo tiene que caer fuera de la ventana visible.
    const next = fechas.nextSpecialDateAfter(6);
    if (next) assert.ok(departures.indexOf(next.depIso) < 0, 'el "próximo feriado" ya está en la ventana visible');
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
    ['Cristo Redentor', 'Isla de Campeche', 'Piscinas Naturales', 'Playa en Playa', 'Tour del Vino', 'data-tour-choice', 'data-tour-detail-open', 'Los imperdibles de', 'Créditos de las fotos'].forEach(function (copy) { assert.ok(appScript.body.includes(copy), 'Falta contenido de tours: ' + copy); });
    // La tarjeta entera es la zona sensible: el checkbox se estira sobre el
    // article y sólo el botón de detalle queda por encima.
    assert.ok(appScript.body.includes('class="local-tour__input"'), 'el checkbox del tour debe ser hijo directo de la tarjeta');
    assert.ok(!appScript.body.includes('local-tour__add'), 'el botón "Sumar" ya no debe existir');
    assert.ok(!appScript.body.includes('Reservar los tours seleccionados'), 'el pie con la nota y el botón de reserva ya no debe existir');
  });
  await t('con clave vacía la búsqueda real de vuelos responde con error controlado', async function () {
    const r = await post(port, '/api/vuelos/buscar', { origen: 'MVD', destino: 'fln', fecha_ida: dep, fecha_vuelta: ret, pasajeros: 2, style: 'eq' });
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 503); assert.deepStrictEqual(j.offers, []); assert.match(j.error, /DUFFEL_API_KEY|DUFFEL_ACCESS_TOKEN/);
  });
  server.close();
  console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' (con fallas)' : ''));
})();
