'use strict';
const assert = require('assert');
const http = require('http');
const model = require('./lib/model');
const fs = require('fs');
const path = require('path');

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
  console.log('Guia Secreta');
  const GUIAS_SECCIONES = ['beaches', 'atracciones', 'comer', 'hacer', 'tips'];
  const GUIAS_FUENTE = path.join(__dirname, 'lib', 'guias.js');

  // guiAs.js publica window.CS_GUIAS porque lo carga el browser. Para poder
  // requirearlo desde aca se simula window y se saca del cache: sin el
  // delete, el segundo require devuelve el objeto viejo.
  function cargarGuias() {
    const previo = global.window;
    global.window = {};
    try {
      delete require.cache[require.resolve(GUIAS_FUENTE)];
      require(GUIAS_FUENTE);
      return global.window.CS_GUIAS;
    } finally {
      if (previo === undefined) delete global.window; else global.window = previo;
    }
  }

  await t('guias: cada destino de DEST recibe una guia', function () {
    const G = cargarGuias();
    const cov = G.cobertura(model.DEST);
    assert.deepStrictEqual(cov.sinGuia, [], 'destinos sin guia: ' + cov.sinGuia.join(', '));
    assert.strictEqual(cov.propio + cov.regional, Object.keys(model.DEST).length);
  });

  await t('guias: la region resuelve aunque el nombre tenga tilde', function () {
    const G = cargarGuias();
    // "Ceará" y "Ceara" son dos strings distintas. Comparar contra el nombre
    // crudo dejaba 8 de 13 regiones sin resolver, en silencio: no tira error,
    // devuelve null y el destino cae en "sin guia".
    ['Ceará', 'Paraíba', 'Río de Janeiro', 'São Paulo', 'Bahía', 'Río Grande do Sul'].forEach(function (region) {
      assert.ok(G.guiaPara('fln', region), 'la region "' + region + '" no resolvio');
    });
    assert.strictEqual(G.regionSlug('Ceará'), 'ceara');
    assert.strictEqual(G.regionSlug('Río Grande do Norte'), 'rio-grande-do-norte');
    // Con y sin tilde tienen que dar el mismo slug.
    assert.strictEqual(G.regionSlug('Maceió'), G.regionSlug('Maceio'));
  });

  await t('guias: ninguna referencia a la API quedo con tilde', function () {
    const src = fs.readFileSync(GUIAS_FUENTE, 'utf8');
    // Regresión: un pase de acentes renombró "region" a "región" y dejó
    // coberturaGuias() leyendo d.región, que en DEST es d.region. La cobertura
    // entera daba 0 sin tirar error. Estas referencias con tilde no existen.
    ['dest.región', 'd.región', 'meta.dest.región', 'DEST[].región', 'version: CACHE_VERSION con tilde']
      .forEach(function (roto) { assert.ok(src.indexOf(roto) === -1, 'quedo roto: ' + roto); });
    assert.match(src, /version:\s*CACHE_VERSION/, 'el export version: cambio');
    assert.match(src, /function regionSlug\(region\)/, 'el parametro de regionSlug cambio');
  });

  await t('guias: la clave del schema es `cuando`, sin tilde', function () {
    const G = cargarGuias();
    // Regresión: el mismo pase renombró la clave "cuando" de las 19 playas a
    // "cuándo". El render lee b.cuando y recibía undefined, así que la línea
    // "Cuándo" desaparecía de cada playa sin que nada se quejara.
    const todas = Object.assign({}, G.guias, G.regiones);
    let revisadas = 0;
    Object.keys(todas).forEach(function (k) {
      (todas[k].beaches || []).forEach(function (b) {
        revisadas++;
        assert.notStrictEqual(b.cuando, undefined, k + ' / ' + b.name + ': falta la clave cuando');
      });
    });
    assert.ok(revisadas > 15, 'se esperaban mas de 15 playas, hay ' + revisadas);
  });

  await t('guias: "si" condicional no quedo como "sí" afirmativa', function () {
    const src = fs.readFileSync(GUIAS_FUENTE, 'utf8');
    // Mismo pase, distinto caso: "si lo pides" paso a "sí lo pides". No se
    // puede revisar con un reemplazo general porque "si" y "sí" dependen del
    // sentido de la frase, asi que se listan los que se rompiaron.
    ['sí lo pides', 'sí fuera', 'sí vas a', 'sí hacés', 'Auto solo sí']
      .forEach(function (roto) { assert.ok(src.indexOf(roto) === -1, 'quedo roto: "' + roto + '"'); });
  });

  await t('guias: cada seccion tiene los campos que el render lee', function () {
    const G = cargarGuias();
    const todas = Object.assign({}, G.guias, G.regiones);
    Object.keys(todas).forEach(function (k) {
      const g = todas[k];
      assert.ok(g.resumen, k + ': falta resumen');
      GUIAS_SECCIONES.forEach(function (s) {
        if (g[s] === undefined) return;
        assert.ok(Array.isArray(g[s]), k + '.' + s + ' no es un array');
        g[s].forEach(function (item, i) {
          const etiqueta = k + '.' + s + '[' + i + ']';
          if (s === 'tips') assert.ok(item.titulo && item.texto, etiqueta + ' sin titulo o texto');
          else assert.ok(item.name, etiqueta + ' sin name');
          if (s === 'beaches') assert.notStrictEqual(item.cuando, undefined, etiqueta + ' sin cuando');
          if (s === 'comer') assert.notStrictEqual(item.momento, undefined, etiqueta + ' sin momento');
          if (s === 'atracciones' || s === 'hacer') assert.notStrictEqual(item.dur, undefined, etiqueta + ' sin dur');
          if (item.usd !== undefined) {
            assert.strictEqual(typeof item.usd, 'number', etiqueta + ': usd tiene que ser numero');
            assert.ok(isFinite(item.usd) && item.usd >= 0, etiqueta + ': usd invalido ' + item.usd);
          }
        });
      });
    });
  });

  await t('guias: no hay items repetidos dentro de una seccion', function () {
    const G = cargarGuias();
    Object.keys(model.DEST).forEach(function (dk) {
      const g = G.guiaPara(dk, model.DEST[dk].region);
      assert.ok(g, dk + ' quedo sin guia al resolver');
      GUIAS_SECCIONES.forEach(function (s) {
        // Los tips se identifican por `titulo`; el resto, por `name`. Con la
        // clave equivocada todos dan undefined y marca duplicado falso.
        const clave = s === 'tips' ? 'titulo' : 'name';
        const nombres = (g[s] || []).map(function (x) { return x[clave]; });
        const repetidos = nombres.filter(function (n, i) { return nombres.indexOf(n) !== i; });
        assert.deepStrictEqual(repetidos, [], dk + '/' + s + ' repetidos: ' + [...new Set(repetidos)].join(', '));
      });
    });
  });

  await t('guias: el texto no tiene caracteres fuera del alfabeto latino', function () {
    const src = fs.readFileSync(GUIAS_FUENTE, 'utf8');
    const lineas = src.split(/\r?\n/);
    const desde = lineas.findIndex(function (l) { return l.indexOf('var GUIAS') === 0; });
    assert.ok(desde > 0, 'no se encontro el bloque de datos');
    // Al escribir la prosa se colaron caracteres CJK y cirilicos en el medio de
    // frases en espanol. Se detectan leyendo, pero un caracter fuera del
    // alfabeto latino es inequivoco.
    lineas.slice(desde).forEach(function (l, i) {
      assert.ok(!/[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff]/.test(l),
        'caracter fuera del alfabeto en la linea ' + (desde + i + 1) + ': ' + l.trim().slice(0, 60));
    });
  });

  await t('guias: los precios de comida no superan un dia de comida', function () {
    const G = cargarGuias();
    const food = model.REAL_COSTS.foodPerDay;
    // Object.assign devuelve un objeto, no un array: hay que iterar por
    // Object.keys. Con .forEach directo tira TypeError.
    const todas = Object.assign({}, G.guias, G.regiones);
    Object.keys(todas).forEach(function (k) {
      (todas[k].comer || []).forEach(function (c) {
        if (c.usd === undefined) return;
        assert.ok(c.usd <= food.confort, k + ' / ' + c.name + ': usd ' + c.usd + ' supera el foodPerDay de confort');
        assert.ok(c.usd >= 1, k + ' / ' + c.name + ': usd ' + c.usd + ' no es un precio de comida');
      });
    });
  });

  await t('guias: la guia de ciudad se mezcla con la regional sin pisarse', function () {
    const G = cargarGuias();
    // sao tiene guia propia y su region tambien es sao-paulo. La ciudad
    // declara beaches: [] explicito, y eso tiene que GANARLE a la regional,
    // que si tiene una entrada de costa.
    const sao = G.guiaPara('sao', model.DEST.sao.region);
    assert.deepStrictEqual(sao.beaches, [], 'la ciudad perdio el beaches vacio explicito');
    // Y donde la ciudad no define nada, tiene que aparecer lo suyo.
    const fln = G.guiaPara('fln', model.DEST.fln.region);
    assert.ok(fln.beaches.length >= 5, 'fln quedo con pocas playas: ' + fln.beaches.length);
    assert.ok((fln.atracciones || []).length >= 3, 'fln quedo sin atracciones propias');
  });

  await t('guias: toda foto de playa esta acreditada', function () {
    const G = cargarGuias();
    const creditos = require('./public/creditos-fotos.generated.js');
    let vistas = 0;
    Object.keys(model.DEST).forEach(function (dk) {
      const g = G.guiaPara(dk, model.DEST[dk].region);
      (g.beaches || []).forEach(function (b) {
        if (!b.foto) return;
        vistas++;
        assert.ok(creditos[b.foto], dk + ' / ' + b.name + ': la foto no esta en la tabla de creditos');
        assert.ok(creditos[b.foto].autor, dk + ' / ' + b.name + ': credito sin autor');
        assert.ok(creditos[b.foto].licencia, dk + ' / ' + b.name + ': credito sin licencia');
      });
    });
    assert.ok(vistas > 0, 'no hay ninguna foto de playa para verificar');
  });

  await t('guias: la tabla de creditos no perdio fotos ya acreditadas', function () {
    // creditos-fotos.js sobreescribia una tabla completa con una parcial
    // cuando se lo cortaba a mitad de camino, y seis fotos quedaban
    // publicadas sin licencia. El script ahora no escribe si la corrida da
    // menos creditos de los que ya habia; esto es la segunda linea.
    const creditos = require('./public/creditos-fotos.generated.js');
    const total = Object.keys(creditos).length;
    assert.ok(total >= 35, 'la tabla quedo con ' + total + ' entradas: parece una corrida incompleta');
    Object.keys(creditos).forEach(function (u) {
      assert.ok(creditos[u].autor && creditos[u].licencia, 'credito incompleto para ' + u);
    });
  });

  await t('guias: DEST_PHOTOS cubre los 44 destinos', function () {
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const m = app.match(/var DEST_PHOTOS = \{([\s\S]*?)\r?\n  \};/);
    assert.ok(m, 'no se encontro DEST_PHOTOS en app.js');
    const claves = [...m[1].matchAll(/^\s{4}(\w+):/gm)].map(function (x) { return x[1]; });
    const faltan = Object.keys(model.DEST).filter(function (k) { return claves.indexOf(k) === -1; });
    assert.deepStrictEqual(faltan, [], 'destinos sin foto de portada: ' + faltan.join(', '));
  });

  await t('app: toursFor esta definida una vez y no usa LAST_DEST_NAMES', function () {
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    assert.strictEqual((app.match(/function toursFor\(/g) || []).length, 1, 'toursFor duplicada o faltante');
    assert.strictEqual((app.match(/function localToursMarkup\(/g) || []).length, 1, 'localToursMarkup duplicada o faltante');
    assert.ok(app.indexOf('LAST_DEST_NAMES') === -1, 'quedo una referencia a LAST_DEST_NAMES, que no existe');
    assert.match(app, /window\.CS_TOURS = toursFor/, 'falta exponer CS_TOURS para la guia');
  });

  await t('fotos de tours: toda clave de SUBJECTS coincide con un tour del catalogo', function () {
    // buscar-fotos-tours.js cruza sus claves "destino#Titulo" contra los
    // tours con un indexOf literal. Si el titulo no calza al
    // caracter, el cruce no falla: la clave simplemente no aparece y ese tour
    // se queda sin foto sin error ni aviso. Por eso 15 claves estaban rotas y
    // nadie lo notaba: 3 por acentos que quedaron en latin1 ("JaponÃªs" en vez
    // de "Japonês") y 12 porque el titulo se escribio en Portuguese ("em", "e",
    // "os") mientras el de app.js esta en Castellano ("en", "y", "los").
    //
    // El catalogo paso de estar escrito en app.js a estar GENERADO en
    // public/tours.generated.js, asi que la lista sale de ahi. Si esta prueba
    // se queda leyendo app.js, el cruce se hace contra un archivo que ya no
    // tiene el catalogo y pasa con 0 tours, que es justo el fallo silencioso
    // que la prueba existe para detectar.
    const catalogo = require(path.join(__dirname, 'public', 'tours.generated.js'));
    assert.ok(catalogo.length > 100, 'tours.generated.js tiene ' + catalogo.length + ' entradas');
    const tours = new Set(catalogo.map(function (x) { return x.destinations[0] + '#' + x.title; }));

    const script = fs.readFileSync(path.join(__dirname, 'buscar-fotos-tours.js'), 'utf8');
    const bloque = script.slice(script.indexOf('const SUBJECTS'), script.indexOf('const UA'));
    const claves = [...bloque.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map(function (x) { return x[1]; });
    assert.ok(claves.length > 40, 'no se pudo leer SUBJECTS: ' + claves.length + ' claves');

    const rotas = claves.filter(function (k) { return !tours.has(k); });
    assert.deepStrictEqual(rotas, [],
      'estas claves de SUBJECTS no matchean ningun tour de app.js, asi que el buscador de fotos las ignora en silencio: ' + rotas.join(' | '));

    // Y lo mismo con el resultado ya guardado: si se renombra una clave, el
    // JSON compilado tiene que renombrarse con ella.
    const jsonPath = path.join(__dirname, 'tour-photos.buscar.json');
    if (fs.existsSync(jsonPath)) {
      const guardadas = Object.keys(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
      const viejas = guardadas.filter(function (k) { return !tours.has(k); });
      assert.deepStrictEqual(viejas, [],
        'tour-photos.buscar.json tiene claves de una version vieja de los titulos: ' + viejas.join(' | '));
    }
  });



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
  process.env.SERPAPI_API_KEY = '';
  process.env.BOOKING_API_KEY = '';
  process.env.BOOKING_API_HOST = 'booking-com15.p.rapidapi.com';
  const app = require('./server');
  const serpapi = require('./lib/providers/serpapi');
  const flights = require('./lib/providers');

  // Respuesta de google_flights recortada a lo que el provider realmente lee.
  // El fixture imita el caso real: en una búsqueda de ida y vuelta, `price` es
  // el de la IDA solamente y el total de vuelta recién aparece si se sigue el
  // `departure_token`.
  const serpapiOutboundFixture = function () {
    return {
      best_flights: [
        {
          price: 180, type: 'One way', airline: 'Aerolínea Test', airline_logo: 'https://logo.test/a.svg',
          total_duration: 165, departure_token: 'tok_out_1', booking_token: 'book_1',
          layovers: [],
          flights: [{ departure_airport: { id: 'MVD', name: 'Carrasco', time: '2027-01-10T10:00' }, arrival_airport: { id: 'FLN', name: 'Florianópolis', time: '2027-01-10T12:45' }, airline: 'Aerolínea Test', flight_number: 'AR 123' }]
        },
        {
          price: 240, type: 'One way', airline: 'Aerolínea Barata', airline_logo: null,
          total_duration: 300, departure_token: 'tok_out_2', booking_token: 'book_2',
          layovers: [{ id: 'GRU', name: 'Guarulhos', duration: 90 }],
          flights: [
            { departure_airport: { id: 'MVD', name: 'Carrasco', time: '2027-01-10T08:00' }, arrival_airport: { id: 'GRU', name: 'Guarulhos', time: '2027-01-10T10:30' }, airline: 'Aerolínea Barata', flight_number: 'BR 10' },
            { departure_airport: { id: 'GRU', name: 'Guarulhos', time: '2027-01-10T12:00' }, arrival_airport: { id: 'FLN', name: 'Florianópolis', time: '2027-01-10T13:00' }, airline: 'Aerolínea Barata', flight_number: 'BR 20' }
          ]
        }
      ]
    };
  };

  await t('mapea un vuelo de Google Flights al contrato visual de la app', async function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    serpapi.setFetch(async function () {
      return { ok: true, status: 200, json: async function () { return serpapiOutboundFixture(); } };
    });
    try {
      const result = await serpapi.searchOutbound({ origin: 'MVD', destination: 'FLN', departureDate: dep, returnDate: ret, passengers: 2, travelClass: 1 });
      assert.strictEqual(result.offers.length, 2);
      const first = result.offers[0];
      assert.strictEqual(first.provider, 'serpapi');
      assert.strictEqual(first.departure_airport.code, 'MVD');
      assert.strictEqual(first.arrival_airport.code, 'FLN');
      assert.strictEqual(first.price_usd, 180);
      assert.strictEqual(first.stops, 0);
      // La fixture trae fecha de vuelta, así que la tarjeta es de ida y vuelta
      // y su precio es el total del viaje.
      assert.strictEqual(first.trip_type, 'round_trip');
      // El tramo de vuelta no viene en la respuesta de la API: queda en null
      // en vez de inventarse horarios.
      assert.strictEqual(first.inbound, null);
      // Sin passenger_ids: SerpAPI no emite boletos, asi que no hay oferta que
      // reservar y no se inventan identificadores de pasajero.
      assert.deepStrictEqual(first.passenger_ids, []);
      assert.ok(first.departure_token, 'la tarjeta de ida necesita departure_token para pedir la vuelta');
      assert.ok(first.book_url.indexOf('google.com/travel/flights') > -1);
      // El segundo vuelo tiene una escala y debe contarla.
      assert.strictEqual(result.offers[1].stops, 1);
    } finally {
      serpapi.setFetch(null);
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });

  await t('traduce el estilo de viaje a la cabina que espera la API', function () {
    process.env.SERPAPI_CABIN_COMODO = '';
    delete process.env.SERPAPI_CABIN_COMODO;
    assert.strictEqual(serpapi.travelClassFor('ahorro'), 1);
    assert.strictEqual(serpapi.travelClassFor('eq'), 1);
    assert.strictEqual(serpapi.travelClassFor('comodo'), 2);
  });

  await t('armá la consulta con los parametros de google_flights y la key solo en el server', function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'secreta';
    try {
      const query = serpapi.buildQuery({ origin: 'mvd', destination: 'fln', departureDate: dep, returnDate: ret, passengers: 2, travelClass: 1 });
      assert.strictEqual(query.get('engine'), 'google_flights');
      assert.strictEqual(query.get('departure_id'), 'MVD');
      assert.strictEqual(query.get('arrival_id'), 'FLN');
      assert.strictEqual(query.get('outbound_date'), dep);
      assert.strictEqual(query.get('return_date'), ret);
      assert.strictEqual(query.get('adults'), '2');
      // La moneda se pide explicita: el modelo entero de la app trabaja en USD.
      assert.strictEqual(query.get('currency'), 'USD');
      assert.strictEqual(query.get('api_key'), 'secreta');
    } finally {
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });

  await t('el destino se resuelve al aeropuerto, no al código de ciudad', function () {
    const model = require('./lib/model');
    // `model.DEST.rio.iata` es "RIO" y `sao` es "SAO": son áreas metropolitanas,
    // no aeropuertos. Con SerpAPI eso hace que la búsqueda vuelva VACÍA y sin
    // error, o sea que la app caía a estimado en silencio y no había forma de
    // enterarse desde los logs. Rio y São Paulo son los destinos más buscados.
    // Los mocks no lo detectaban porque ignoraban el código de destino.
    ['rio', 'sao'].forEach(function (key) {
      const cityCode = model.DEST[key].iata;
      assert.notStrictEqual(cityCode, 'GIG', 'rio no debe usar el código de ciudad');
    });
    // El endpoint tiene que usar la tabla de aeropuertos, no la del modelo.
    assert.ok(app.airportFor('rio') === 'GIG', 'rio debe resolverse a GIG');
    assert.ok(app.airportFor('sao') === 'GRU', 'sao debe resolverse a GRU');
    // Y ningún destino puede quedar con el código de ciudad.
    Object.keys(model.DEST).forEach(function (key) {
      const resolved = app.airportFor(key);
      assert.ok(/^[A-Z]{3}$/.test(resolved), key + ' debe resolver a un código de aeropuerto de 3 letras');
    });
  });

  await t('el browse de ida y vuelta trae el total en una sola busqueda', async function () {
    // Verificado contra la API real: con outbound_date + return_date, `price`
    // llega como `type: "Round trip"` y ya es el total del viaje (1 adulto =
    // US$ 249, 2 adultos = US$ 499 en la misma ruta y fechas). Por eso no hay
    // segunda etapa ni un token de por medio.
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    serpapi.setFetch(async function () {
      return { ok: true, status: 200, json: async function () {
        return { best_flights: [{ price: 499, type: 'Round trip', airline: 'Aerolínea Test', total_duration: 163, departure_token: 'tok_1', layovers: [],
          flights: [{ departure_airport: { id: 'MVD', name: 'Carrasco', time: '2027-03-10 13:57' }, arrival_airport: { id: 'GIG', name: 'Galeão', time: '2027-03-10 16:40' }, airline: 'Aerolínea Test', flight_number: 'AR 763' }] }] };
      } };
    });
    try {
      const result = await serpapi.searchOutbound({ origin: 'MVD', destination: 'GIG', departureDate: '2027-03-10', returnDate: '2027-03-17', passengers: 2, travelClass: 1 });
      assert.strictEqual(result.offers.length, 1);
      const offer = result.offers[0];
      assert.strictEqual(offer.trip_type, 'round_trip', 'con fecha de vuelta la tarjeta es de ida y vuelta');
      assert.strictEqual(offer.price_usd, 499, 'el precio es el total de ida y vuelta, no solo la ida');
      // El tramo de vuelta no viene en la respuesta: se deja en null en vez de
      // inventar horarios que la API nunca devolvió.
      assert.strictEqual(offer.inbound, null);
      assert.ok(offer.outbound, 'el tramo de ida sí viene');
    } finally {
      serpapi.setFetch(null);
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });

  await t('marca la búsqueda de solo ida como one_way', async function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    serpapi.setFetch(async function () {
      return { ok: true, status: 200, json: async function () {
        return { best_flights: [{ price: 314, type: 'One way', airline: 'Gol', total_duration: 163, layovers: [], flights: [
          { departure_airport: { id: 'MVD', name: 'Carrasco', time: '2027-03-10 04:35' }, arrival_airport: { id: 'GIG', name: 'Galeão', time: '2027-03-10 07:15' }, airline: 'Gol', flight_number: 'G3 7589' }] }] };
      } };
    });
    try {
      const result = await serpapi.searchOutbound({ origin: 'MVD', destination: 'GIG', departureDate: '2027-03-10', returnDate: '', passengers: 2, travelClass: 1 });
      assert.strictEqual(result.offers[0].trip_type, 'one_way');
      assert.strictEqual(result.offers[0].price_usd, 314);
    } finally {
      serpapi.setFetch(null);
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });

  await t('trata el error de cuota como 429 aunque SerpAPI responda 200', async function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    serpapi.setFetch(async function () {
      return { ok: true, status: 200, json: async function () { return { error: 'Your API key has run out of searches' }; } };
    });
    try {
      let threw = null;
      try { await serpapi.priceForDate({ origin: 'MVD', destination: 'FLN', dep: dep, ret: ret, passengers: 1 }); } catch (e) { threw = e; }
      assert.ok(threw, 'una key sin créditos tiene que lanzar un error, no devolver precio vacío en silencio');
      assert.strictEqual(threw.status, 429);
      assert.strictEqual(threw.quotaExhausted, true);
    } finally {
      serpapi.setFetch(null);
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });

  await t('un error de parámetro NO se confunde con cuota agotada', async function () {
    // SerpAPI responde 200 con `{ error: "..." }` para los dos casos. Si todo
    // eso activara el cooldown, un typo en un parámetro congelaría los precios
    // de vuelos un minuto entero y el gráfico volvería a estimaciones sin que
    // nada pareciera roto. Esto se rompió en producción y por eso tiene test.
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    serpapi.setFetch(async function () {
      return { ok: true, status: 200, json: async function () { return { error: 'Missing `departure_id` parameter.' }; } };
    });
    flights.clearCache();
    try {
      let threw = null;
      try { await serpapi.priceForDate({ origin: 'MVD', destination: 'FLN', dep: dep, ret: ret, passengers: 1 }); } catch (e) { threw = e; }
      assert.ok(threw);
      assert.strictEqual(threw.quotaExhausted, false, 'un parámetro faltante no es cuota agotada');
      assert.notStrictEqual(threw.status, 429, 'no debe activar el cooldown de cuota');
    } finally {
      serpapi.setFetch(null);
      flights.clearCache();
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });

  await t('el cache evita pagar dos veces la misma fecha', async function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    process.env.SERPAPI_CALENDAR_TTL_H = '24';
    let calls = 0;
    serpapi.setFetch(async function () {
      calls += 1;
      return { ok: true, status: 200, json: async function () {
        return { best_flights: [{ price: 100, type: 'Round trip', total_duration: 100, layovers: [], flights: [] }], price_insights: { lowest_price: 210, price_level: 'low' } };
      } };
    });
    flights.clearCache();
    try {
      const points = [{ shift: 0, dep: dep, ret: ret }, { shift: 1, dep: dep, ret: ret }];
      const first = await flights.getCalendar('MVD', 'FLN', points, 'eq', 2);
      const callsAfterFirst = calls;
      const second = await flights.getCalendar('MVD', 'FLN', points, 'eq', 2);
      assert.strictEqual(second.real, first.real, 'la segunda pasada devuelve lo mismo');
      // Los dos puntos comparten la clave (mismo dep y ret en el fixture), asi
      // que el segundo tiene que salir del cache sin gastar otro crédito.
      assert.strictEqual(calls, callsAfterFirst, 'la segunda consulta no puede volver a pegarle a SerpAPI');
    } finally {
      serpapi.setFetch(null);
      flights.clearCache();
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });

  await t('el calendario reparte precio real y estimado por separado', async function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    serpapi.setFetch(async function () {
      return { ok: true, status: 200, json: async function () {
        return { best_flights: [{ price: 200, type: 'Round trip', total_duration: 100, layovers: [], flights: [] }] };
      } };
    });
    flights.clearCache();
    try {
      const points = [
        { shift: -1, dep: '2027-01-09', ret: '2027-01-16' },
        { shift: 0, dep: '2027-01-10', ret: '2027-01-17' },
        { shift: 1, dep: '2027-01-11', ret: '2027-01-18' }
      ];
      const result = await flights.getCalendar('MVD', 'FLN', points, 'eq', 2);
      assert.strictEqual(result.puntos.length, 3);
      assert.strictEqual(result.real + result.estimados, 3, 'cada punto tiene que estar en una de las dos listas');
      result.puntos.forEach(function (punto) {
        if (punto.real) assert.ok(punto.pp > 0, 'un punto real siempre trae precio');
        else assert.strictEqual(punto.pp, null, 'un punto estimado no inventa precio');
      });
    } finally {
      serpapi.setFetch(null);
      flights.clearCache();
      process.env.SERPAPI_API_KEY = oldKey;
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
  await t('un hotel real sin foto se conserva y completa con el respaldo', async function () {
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
      // El real sin foto entra: perder el precio por falta de imagen es lo que
      // hacia que la pantalla cayera entera al respaldo con precios inventados.
      assert.strictEqual(list[0].name, 'Hotel sin foto');
      assert.strictEqual(list[0].source, 'booking');
      assert.strictEqual(list[0].image, '');
      assert.strictEqual(list[0].perNight, Math.round((460 / 7) * 100) / 100);
      // Los dos que faltan para llegar a 3 si son del respaldo, y todos con
      // link de Booking para que se pueda reservar igual.
      assert.deepStrictEqual(list.slice(1).map(function (hotel) { return hotel.source; }), ['fallback', 'fallback']);
      // El link del hotel real lo arma Booking, no el respaldo, así que sólo se
      // exige que los del fallback lleven la búsqueda de Booking.
      assert.ok(list.slice(1).every(function (hotel) { return /^https:\/\/www\.booking\.com\//.test(hotel.bookingUrl); }));
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  /* Los tipos que el selector ofrece tienen que coincidir con los que la función
     devuelve. Cuando no coincidian, el cliente los usaba para corregir el tipo
     elegido —cambiandolo por el primero de la lista— y despues filtraba las
     cards por ese tipo nuevo, con lo cual la lista quedaba en cero: en pantalla
     "Hoteles para viajar intermedio" con el selector en "Económico" y abajo "No
     encontramos alojamientos de categoría Intermedio".

     El caso de abajo lo provocaba con datos que no tienen NADA en la banda de
     "confort" (el objetivo era 200 y los 20 hoteles de Booking iban de 10 a 90).
     La segunda pasada los acepta igual porque relaja el precio, asi que se
     devolvian 3 hoteles de tipo "confort" mientras el server declaraba que
     "confort" no era un tipo disponible en ese destino. */
  await t('el tipo que se devuelve siempre esta declarado como disponible', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    global.fetch = async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: '-123', search_type: 'city' }] }; } };
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [
        { hotel_id: 'a', property: { name: 'Pousada Barata 1' }, priceBreakdown: { grossPrice: { value: 70, currency: 'USD' } } },
        { hotel_id: 'b', property: { name: 'Pousada Barata 2' }, priceBreakdown: { grossPrice: { value: 80, currency: 'USD' } } },
        { hotel_id: 'c', property: { name: 'Pousada Barata 3' }, priceBreakdown: { grossPrice: { value: 90, currency: 'USD' } } }
      ] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    try {
      for (const estilo of ['ahorro', 'eq', 'comodo']) {
        const diag = {};
        const list = await app.hotelRecommendations('cabo', 'Cabo Frío', estilo, { dep: dep, ret: ret, pax: 2, nights: 7 }, diag);
        assert.ok(list.length > 0, estilo + ': la lista no puede volver vacia');
        assert.ok(Array.isArray(diag.tiposDisponibles) && diag.tiposDisponibles.length, estilo + ': tiene que declarar los tipos disponibles');
        const tiposDevueltos = [...new Set(list.map(function (hotel) { return hotel.hotelType; }))];
        tiposDevueltos.forEach(function (tipo) {
          assert.ok(diag.tiposDisponibles.indexOf(tipo) >= 0,
            estilo + ': devuelve hoteles de tipo "' + tipo + '" pero tiposDisponibles es [' + diag.tiposDisponibles.join(', ') + ']');
        });
      }
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  /* Los tres tipos del espectro son bandas de precio, no categorias: el mismo
     hotel puede ser economico, intermedio o confort segun cuanto cueste. Con al
     menos un hotel con precio las tres bandas tienen que devolver algo, porque
     la segunda pasada completa con cualquier real por debajo del techo y el
     respaldo generico llena hasta tres. Si alguna volviera vacia, el selector
     dejaria de ofrecerla y habria destinos donde la eleccion inicial del tipo
     de viaje —que es lo que arma la pantalla al abrirla— no muestra nada. */
  await t('con un hotel cargado, los tres tipos del espectro siempre devuelven 3', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    global.fetch = async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: '-123', search_type: 'city' }] }; } };
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [
        { hotel_id: 'a', property: { name: 'Pousada Unica' }, priceBreakdown: { grossPrice: { value: 90, currency: 'USD' } } }
      ] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    try {
      for (const tipo of ['economico', 'intermedio', 'confort']) {
        const diag = {};
        const list = await app.hotelRecommendations('cabo', 'Cabo Frío', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7, hotelType: tipo }, diag);
        assert.strictEqual(list.length, 3, tipo + ': tiene que devolver 3, devolvio ' + list.length);
        assert.ok(list.every(function (hotel) { return hotel.hotelType === tipo; }), tipo + ': los tres tienen que venir rotulados con ese tipo');
        assert.ok(diag.tiposDisponibles.indexOf(tipo) >= 0, tipo + ': tiene que estar declarado como disponible');
      }
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  /* Al reves: un tipo estricto que no tiene nada NO se declara disponible, para
     que el cliente caiga a uno del espectro en vez de prometer una lista vacia.
     Y no se rellena con lofts: el estado vacio dice que no se muestran
     categorias distintas como reemplazo, asi que tiene que ser cierto. */
  await t('un tipo estricto sin datos no se declara disponible ni se rellena', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    global.fetch = async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: '-123', search_type: 'city' }] }; } };
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [
        { hotel_id: 'a', property: { name: 'Pousada Comum' }, priceBreakdown: { grossPrice: { value: 90, currency: 'USD' } } }
      ] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    try {
      for (const tipo of ['boutique', 'resort']) {
        const diag = {};
        const list = await app.hotelRecommendations('cabo', 'Cabo Frío', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7, hotelType: tipo }, diag);
        assert.strictEqual(list.length, 0, tipo + ': no hay nada de ese tipo, la lista tiene que venir vacia');
        assert.ok(diag.tiposDisponibles.indexOf(tipo) < 0, tipo + ': no se puede declarar disponible si la lista esta vacia');
        assert.ok(diag.tiposDisponibles.indexOf('intermedio') >= 0, 'los tipos del espectro tienen que seguir disponibles');
      }
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  /* El dest_id de Booking no cambia, pero searchDestination falla de a ratos.
     Cuando fallaba, el destino entero caia al respaldo de hoteles inventados
     aunque las fechas y el tipo estuvieran bien: la seccion de alojamiento
     mostraba tres estimados donde antes habia tres de Booking. Se cachea solo
     el acierto, y el acierto tiene que evitar la segunda llamada. */
  await t('el id de ciudad de Booking se consulta una vez y se reusa', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    // Se cuenta por query y no en total: Cabo Frio tiene una ciudad cercana
    // asociada, asi que un pedido legitimo puede mirar dos.
    const busquedas = [];
    global.fetch = async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) {
        busquedas.push(parsed.searchParams.get('query'));
        return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: 'dest-cache-' + busquedas.length, search_type: 'city', name: 'algo' }] }; } };
      }
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [
        { hotel_id: 'x', property: { name: 'Pousada da Praia' }, priceBreakdown: { grossPrice: { value: 500, currency: 'USD' } } }
      ] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    const vecesQue = function (q) { return busquedas.filter(function (x) { return x === q; }).length; };
    try {
      app.resetBookingDestCache();
      await app.hotelRecommendations('cabo', 'Cabo Frio', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7 });
      assert.strictEqual(vecesQue('Cabo Frio'), 1, 'la primera consulta tiene que buscar el id');
      await app.hotelRecommendations('cabo', 'Cabo Frio', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7 });
      assert.strictEqual(vecesQue('Cabo Frio'), 1, 'la segunda no puede volver a buscar: el id ya se sabe');
      await app.hotelRecommendations('cabo', 'Cabo Frio', 'comodo', { dep: dep, ret: ret, pax: 2, nights: 7 });
      assert.strictEqual(vecesQue('Cabo Frio'), 1, 'cambiar de estilo no puede volver a buscar el id');
      await app.hotelRecommendations('cabo', 'Cabo Frio', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7, hotelType: 'boutique' });
      assert.strictEqual(vecesQue('Cabo Frio'), 1, 'cambiar de tipo de alojamiento tampoco');
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  await t('un id de ciudad que no se pudo resolver no se cachea', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    const Torres = 'Destino Que Solo Existe Para Esta Prueba';
    let intentos = 0;
    global.fetch = async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) {
        if (parsed.searchParams.get('query') !== Torres) return { ok: true, status: 200, json: async function () { return { data: [] }; } };
        intentos++;
        // Falla la primera vez y anda la segunda. Cachear el fallo dejaria este
        // destino sin hoteles reales para el resto de la vida del proceso.
        if (intentos === 1) return { ok: true, status: 200, json: async function () { return { data: [] }; } };
        return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: 'dest-flate-1', search_type: 'city', name: Torres }] }; } };
      }
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [
        { hotel_id: 'x', property: { name: 'Hotel Que Se Resolvio' }, priceBreakdown: { grossPrice: { value: 400, currency: 'USD' } } }
      ] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    try {
      app.resetBookingDestCache();
      const primera = await app.hotelRecommendations('tor', Torres, 'eq', { dep: dep, ret: ret, pax: 2, nights: 7 });
      assert.strictEqual(primera[0].source, 'fallback', 'con el id sin resolver solo hay respaldo');
      const segunda = await app.hotelRecommendations('tor', Torres, 'eq', { dep: dep, ret: ret, pax: 2, nights: 7 });
      assert.strictEqual(intentos, 2, 'el fallo no se cachea: hay que volver a intentar');
      assert.strictEqual(segunda[0].source, 'booking', 'con el id resuelto entran hoteles reales');
      assert.strictEqual(segunda[0].name, 'Hotel Que Se Resolvio');
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  await t('el nombre sin barra va en una sola consulta y resuelve', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    const consultas = [];
    global.fetch = async function (url, options) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) {
        const q = parsed.searchParams.get('query');
        consultas.push(q);
        // El nombre de 'for' ya es solo "Fortaleza", asi que la barra se fue de
        // este destino. El caso que se prueba ahora es el de trancoso, que sigue
        // siendo "Arraial d'Ajuda / Trancoso": Booking no entiende la barra y
        // por eso hotelRecommendations() la parte y prueba cada parte por
        // separado. Con el nombre viejo, este test pasaba probando un nombre que
        // ya no existe; ahora prueba el que queda.
        if (q === 'Fortaleza') return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: '-9', search_type: 'city', name: 'Fortaleza' }] }; } };
        return { ok: true, status: 200, json: async function () { return { data: [] }; } };
      }
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [{ hotel_id: 'f1', property: { name: 'Hotel de Fortaleza', photoUrls: ['https://images.example/f.jpg'] }, priceBreakdown: { grossPrice: { value: 595, currency: 'USD' } } }] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    try {
      const list = await app.hotelRecommendations('for', 'Fortaleza', 'eq', { dep: dep, ret: ret, pax: 2, nights: 7 });
      // El nombre ya no tiene barra, asi que va una sola consulta y resuelve al
      // primer intento. La particion por "/" sigue existiendo para los otros
      // destinos con dos ciudades (trancoso), no para este.
      assert.deepStrictEqual(consultas, ['Fortaleza']);
      assert.strictEqual(list[0].source, 'booking');
      assert.strictEqual(list[0].name, 'Hotel de Fortaleza');
      assert.strictEqual(list[0].image, 'https://images.example/f.jpg');
    } finally { global.fetch = originalFetch; process.env.BOOKING_API_KEY = ''; }
  });
  await t('sin hoteles en la banda de la categoría igual muestra los reales', async function () {
    const originalFetch = global.fetch;
    process.env.BOOKING_API_KEY = 'test-key';
    // Todos los reales quedan muy por debajo de la banda de "confort": antes
    // se descartaban y la pantalla ofrecia 3 hoteles inventados sin foto.
    global.fetch = async function (url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/searchDestination')) return { ok: true, status: 200, json: async function () { return { data: [{ dest_id: '-123', search_type: 'city' }] }; } };
      if (parsed.pathname.endsWith('/searchHotels')) return { ok: true, status: 200, json: async function () { return { data: { hotels: [
        { hotel_id: 'h1', property: { name: 'Barato Uno', photoUrls: ['https://images.example/1.jpg'] }, priceBreakdown: { grossPrice: { value: 350, currency: 'USD' } } },
        { hotel_id: 'h2', property: { name: 'Barato Dos', photoUrls: ['https://images.example/2.jpg'] }, priceBreakdown: { grossPrice: { value: 420, currency: 'USD' } } }
      ] } }; } };
      return { ok: true, status: 200, json: async function () { return { data: [] }; } };
    };
    try {
      const list = await app.hotelRecommendations('rio', 'Río de Janeiro', 'comodo', { dep: dep, ret: ret, pax: 2, nights: 7 });
      assert.strictEqual(list.length, 3);
      // Los dos reales, con su foto, en vez de los tres de fábrica.
      assert.deepStrictEqual(list.slice(0, 2).map(function (hotel) { return hotel.source; }), ['booking', 'booking']);
      // El más caro (420/7=60) está más cerca del objetivo de "confort" que el
      // de 350/7=50, así que va primero.
      assert.deepStrictEqual(list.slice(0, 2).map(function (hotel) { return hotel.image; }), ['https://images.example/2.jpg', 'https://images.example/1.jpg']);
      assert.deepStrictEqual(list.slice(0, 2).map(function (hotel) { return hotel.perNight; }), [60, 50]);
      assert.strictEqual(list[2].source, 'fallback');
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
  await t('expone vuelos de Google Flights por la ruta de búsqueda que consume la PWA', async function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    flights.clearCache();
    serpapi.setFetch(async function (url) {
      const parsed = new URL(url);
      assert.strictEqual(parsed.pathname, '/search.json');
      assert.strictEqual(parsed.searchParams.get('engine'), 'google_flights');
      return { ok: true, status: 200, json: async function () { return serpapiOutboundFixture(); } };
    });
    try {
      const response = await post(port, '/api/vuelos/buscar', { origen: 'MVD', destino: 'fln', fecha_ida: dep, fecha_vuelta: ret, pasajeros: 1, style: 'ahorro' });
      const payload = JSON.parse(response.body);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(payload.provider, 'serpapi');
      assert.strictEqual(payload.offers[0].departure_airport.code, 'MVD');
      assert.strictEqual(payload.offers[0].price_usd, 180);
      assert.strictEqual(payload.offers[0].airline, 'Aerolínea Test');
      // Ninguna tarjeta puede llevar un link de pago propio: la reserva se
      // completa afuera y la app no cobra vuelos.
      assert.ok(payload.offers.every(function (o) { return !o.booking_url && !o.checkout_url; }));
    } finally {
      serpapi.setFetch(null);
      flights.clearCache();
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });
  await t('el calendario de fechas responde puntos con precio por separado', async function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = 'test-key';
    flights.clearCache();
    serpapi.setFetch(async function () {
      return { ok: true, status: 200, json: async function () { return { best_flights: [{ price: 300, type: 'Round trip', total_duration: 100, layovers: [], flights: [] }] }; } };
    });
    try {
      const r = await get(port, '/api/vuelos/calendario?dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2&style=eq&origin=MVD');
      const j = JSON.parse(r.body);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(j.configured, true);
      assert.ok(Array.isArray(j.puntos));
      assert.ok(j.puntos.length > 1, 'el calendario tiene que traer varias fechas');
      assert.ok(j.puntos.every(function (p) { return typeof p.dep === 'string' && typeof p.shift === 'number'; }));
      assert.ok(j.puntos.some(function (p) { return p.real; }), 'con el buscador andando algun punto tiene que traer precio real');
    } finally {
      serpapi.setFetch(null);
      flights.clearCache();
      process.env.SERPAPI_API_KEY = oldKey;
    }
  });
  await t('el calendario rechaza destinos que no vuelan', async function () {
    const r = await get(port, '/api/vuelos/calendario?dest=zz&dep=' + dep + '&ret=' + ret + '&pax=2&style=eq');
    assert.strictEqual(r.status, 400);
  });
  await t('cotiza un viaje estimado sin credenciales externas', async function () {
    const r = await get(port, '/api/cotizar?' + q + '&origin=PDP&subcategory=Praia%20dos%20Ingleses');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.meta.mode, 'estimated');
    assert.strictEqual(j.meta.origin, 'PDP'); assert.strictEqual(j.meta.subcategory, 'Praia dos Ingleses');
    assert.ok(j.list.length >= 3); assert.ok(j.recId);
    assert.ok(j.list.every(function (p) { return p.sources.pasajes === 'estimado'; }));
  });
  await t('devuelve exactamente los destinos que la grilla ofrece', async function () {
    const j = JSON.parse((await get(port, '/api/destinos')).body);
    // Antes comparaba contra una lista de 15 claves escrita a mano, y se pudrio
    // tres veces: le sobraba 'ilha' (que el picker no ofrece), le faltaba
    // 'canela' (que si ofrecia) y despues le faltaban 25 destinos mas. La lista
    // se lee ahora de DESTINATION_GROUPS, que es la unica fuente de verdad de
    // "que se ofrece". Si el backend y la grilla se desincronizan, esta prueba
    // lo dice en vez de que un destino exista y no se vea.
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const desde = app.indexOf('var DESTINATION_GROUPS = [');
    const grupos = app.slice(desde, app.indexOf('\n  ];', desde));
    const expected = new Set();
    for (const g of grupos.matchAll(/keys:\s*\[([^\]]*)\]/g)) {
      for (const k of g[1].matchAll(/'([^']+)'/g)) expected.add(k[1]);
    }
    assert.ok(expected.size >= 30, 'no se pudo leer DESTINATION_GROUPS: ' + expected.size + ' claves');
    assert.ok(j.some(function (d) { return d.key === 'fln'; }));
    assert.ok(j.some(function (d) { return d.key === 'bue' && d.name === 'Buenos Aires'; }));
    assert.deepStrictEqual(j.map(function (d) { return d.key; }).sort(), [...expected].sort());
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
  await t('daily-costs.js esta al dia y app.js no vuelve a copiar la tabla', function () {
    // La tabla daily vivia escrita a mano en DOS archivos: DESTINATION_COSTS en
    // lib/model.js (la que cotiza el server) y DESTINATION_DAILY_COSTS en
    // public/app.js (la que dibuja las tarjetas). Las dos caian al fallback de
    // Rio cuando no encontraban la clave, asi que una clave faltante no rompia
    // nada: se cobraba Rio de Janeiro en silencio. Paso de verdad: el cliente se
    // quedo 17 destinos atras y cotizaba angra, curitiba, rec, torres y demas
    // con numeros de Rio sin que nada se enterara.
    //
    // Ahora hay una sola fuente, lib/model.js. El cliente la recibe por
    // public/daily-costs.js, que genera scripts/build-costos.js (lo corren
    // pretest y prestart). Esta prueba igual la verifica, para que correr
    // `node test.js` sin npm tampoco deje pasar una desincronizacion.
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    assert.ok(app.indexOf('var DESTINATION_DAILY_COSTS = window.CS_DESTINATION_DAILY_COSTS') >= 0,
      'app.js deberia leer el global generado, no tener la tabla escrita adentro');
    assert.ok(app.indexOf('var DESTINATION_DAILY_COSTS = {') < 0,
      'app.js volvio a copiar la tabla: quedo una segunda fuente de verdad');

    const generado = path.join(__dirname, 'public', 'daily-costs.js');
    assert.ok(fs.existsSync(generado), 'falta public/daily-costs.js: corré npm run build:costos');
    delete require.cache[require.resolve(generado)];
    const cliente = require(generado);
    const server = model.DESTINATION_COSTS;

    const faltan = Object.keys(server).filter((k) => !cliente[k]);
    const sobran = Object.keys(cliente).filter((k) => !server[k]);
    assert.deepStrictEqual(faltan, [], 'destinos que el cliente no tiene: ' + faltan.join(', '));
    assert.deepStrictEqual(sobran, [], 'destinos que el servidor no tiene: ' + sobran.join(', '));

    for (const k of Object.keys(server)) {
      const s = server[k], c = cliente[k];
      assert.deepStrictEqual(
        [c.transport.eco, c.transport.medio, c.transport.confort, c.food.casual, c.food.moderado, c.food.gourmet],
        [s.transport.eco, s.transport.medio, s.transport.confort, s.food.casual, s.food.moderado, s.food.gourmet],
        'costos distintos en ' + k + ' (' + (model.DEST[k] && model.DEST[k].name) + ')'
      );
    }

    // El index tiene que pedirlo antes que app.js y el service worker tiene que
    // precachearlo: sin lo primero el global no existe cuando app.js corre, y
    // sin lo segundo la primera apertura sin senal no arma las tarjetas.
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    const iTag = html.indexOf('src="/daily-costs.js');
    assert.ok(iTag > 0, 'index.html no carga /daily-costs.js');
    assert.ok(iTag < html.indexOf('src="/app.js'), 'daily-costs.js tiene que cargarse antes que app.js');
    const sw = fs.readFileSync(path.join(__dirname, 'public', 'sw.js'), 'utf8');
    assert.ok(sw.indexOf("'/daily-costs.js'") > 0, 'sw.js no precachea /daily-costs.js');
  });
  await t('todo destino tiene costos propios y no cae al fallback de Rio', function () {
    // Si un destino no esta en la tabla, destinationCosts() devuelve la de Rio
    // y el presupuesto sale con la comida y el traslado de otra ciudad, sin
    // error. Porto Alegre estuvo asi: sin entrada, cobraba Rio siendo el
    // alojamiento mas barato del catalogo.
    const fallback = model.destinationCosts('__no_existe__');
    for (const k of Object.keys(model.DEST)) {
      const c = model.DESTINATION_COSTS[k];
      assert.ok(c, k + ' (' + model.DEST[k].name + ') no tiene costos diarios propios');
      if (k !== 'rio') assert.notStrictEqual(model.destinationCosts(k), fallback, k + ' resuelve al fallback de Rio');
      assert.ok(c.food.casual < c.food.moderado && c.food.moderado < c.food.gourmet,
        k + ': la comida tiene que crecer de casual a moderado a gourmet, es ' + JSON.stringify(c.food));
      assert.ok(c.transport.eco < c.transport.medio && c.transport.medio < c.transport.confort,
        k + ': el traslado tiene que crecer de eco a medio a confort, es ' + JSON.stringify(c.transport));
      // El nivel medio es derivado. Si deja de serlo, la comprobacion de arriba
      // sigue pasando y nadie se entera de que el numero cambio de origen.
      assert.strictEqual(c.transport.medio, Math.round(Math.sqrt(c.transport.eco * c.transport.confort)),
        k + ': el traslado medio tiene que seguir siendo la media geometrica de los otros dos, es ' + c.transport.medio);
    }
  });
  /* ---------- transfer desde el aeropuerto ---------- */
  await t('el precio del transfer sale de la tabla y no de constantes', function () {
    // Antes el mismo precio vivia en tres lugares distintos: las cards de
    // public/app.js ponian 30 (compartido) y 150 (privado) para los 44
    // destinos, getSelectedTransferAmount() repetia esos dos numeros, y
    // transferConfig() en server.js usaba OFFICIAL_TRANSFER_PRICE_USD (35) POR
    // PASAJERO. Para dos personas el wizard decia 70 y la card decia 30, y no
    // habia forma de que coincidieran. Si alguien vuelve a escribir un numero
    // adentro, esta prueba falla.
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    assert.ok(!/transferType === 'private'\) return \d/.test(app),
      'app.js tiene un precio de transfer fijo en getSelectedTransferAmount: deberia salir de la tabla');
    assert.ok(!/data-transfer-amount="\d+"/.test(app),
      'app.js tiene un data-transfer-amount fijo: las cards deberian tomar el precio de la tabla');
    assert.ok(!/amount: 30, icon/.test(app) && !/amount: 150, icon/.test(app),
      'app.js volvio a las cards de transfer con 30 y 150 written a mano');
    const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(server.indexOf('model.transferOptions(destKey)') > 0,
      'transferConfig() deberia leer la tabla con model.transferOptions()');
  });
  await t('transfer-precios.js esta al dia y coincide con el modelo', function () {
    // Misma logica que el test de daily-costs: una sola fuente (el JSON), dos
    // copias generadas. Si divergen, la card y el presupuesto muestran precios
    // distintos sin que nada se entere.
    const generado = path.join(__dirname, 'public', 'transfer-precios.js');
    assert.ok(fs.existsSync(generado), 'falta public/transfer-precios.js: corré npm run build:transfer');
    delete require.cache[require.resolve(generado)];
    const cliente = require(generado);
    const server = model.TRANSFER_PRICES;

    const faltan = Object.keys(server).filter((k) => !cliente[k]);
    const sobran = Object.keys(cliente).filter((k) => !server[k]);
    assert.deepStrictEqual(faltan, [], 'destinos que el cliente no tiene: ' + faltan.join(', '));
    assert.deepStrictEqual(sobran, [], 'destinos que el servidor no tiene: ' + sobran.join(', '));
    for (const k of Object.keys(server)) {
      assert.deepStrictEqual(
        [cliente[k].compartido, cliente[k].privado, cliente[k].modo],
        [server[k].compartido, server[k].privado, server[k].modo],
        'precios de transfer distintos en ' + k + ' (' + (model.DEST[k] && model.DEST[k].name) + ')'
      );
    }
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    const iTag = html.indexOf('src="/transfer-precios.js');
    assert.ok(iTag > 0, 'index.html no carga /transfer-precios.js');
    assert.ok(iTag < html.indexOf('src="/app.js'), 'transfer-precios.js tiene que cargarse antes que app.js');
    const sw = fs.readFileSync(path.join(__dirname, 'public', 'sw.js'), 'utf8');
    assert.ok(sw.indexOf("'/transfer-precios.js'") > 0, 'sw.js no precachea /transfer-precios.js');
  });
  await t('todo destino tiene precio de transfer propio y no cae al fallback', function () {
    // transferConfig() tiene un piso para destinos fuera de la tabla. Si algum
    // destino del catalogo llegara a ese piso, todos los destinos se cotizarian
    // con el mismo precio sin error visible, que es el bug que se quiere evitar.
    for (const k of Object.keys(model.DEST)) {
      const t = model.transferOptions(k);
      assert.ok(t, k + ' (' + model.DEST[k].name + ') no tiene entrada en la tabla de transfer');
      assert.ok(!t.sinTabla, k + ' cae al piso de OFFICIAL_TRANSFER_PRICE_USD en vez de a la tabla');
      assert.ok(t.compartido > 0 || t.soloPrivado,
        k + ' no tiene traslado compartido y no declara soloPrivado');
      assert.ok(t.privado > 0, k + ' no tiene precio de transfer privado');
      assert.ok(t.privado >= t.compartido,
        k + ': el privado (' + t.privado + ') sale menos que el compartido (' + t.compartido + ')');
    }
    assert.strictEqual(model.transferOptions('__no_existe__'), null,
      'un destino inexistente no deberia devolver precios');
  });
  await t('el transfer de la isla no se ofrece como una van por carretera', function () {
    // Ilha Grande no tiene carretera (se llega en barco) y Fernando de Noronha
    // es una isla a 350 km de la costa (se llega en vuelo desde REC). Antes la
    // app ofrecia las dos cards de van igual que para Rio, que no existe.
    const ilha = model.transferOptions('ilha');
    assert.strictEqual(ilha.modo, 'ferry', 'ilha deberia declararse ferry');
    assert.ok(ilha.compartido > 0, 'a Ilha Grande se llega en barco, pero con precio');
    assert.strictEqual(ilha.km, null, 'ilha no deberia tener km de carretera');

    const fernando = model.transferOptions('fernando');
    assert.strictEqual(fernando.modo, 'vuelo', 'fernando deberia declararse vuelo');
    assert.ok(fernando.soloPrivado, 'a Fernando de Noronha no hay van compartida');
    assert.strictEqual(fernando.compartido, 0, 'sin van compartida, el compartido es 0');
    assert.ok(fernando.privado > 0, 'pero el vuelo tiene precio');
    // El codigo de la isla es FEN. NVT es Navegantes, en Santa Catarina, a
    // 2.900 km: con NVT la busqueda de vuelos mandaba a otra provincia.
    assert.strictEqual(fernando.iata, 'FEN', 'fernando deberia llegar por FEN, no por NVT (que es Navegantes/SC)');
  });
  await t('AIR_DESTINATIONS y el iata del modelo no pueden contradecirse', function () {
    /* Por que este test existe: el de arriba PASABA con NVT en el modelo, y el
       bug seguia vivo. Motivo: `fernando.iata` sale de la tabla de transfer, que
       ya decia FEN, mientras el vuelo se pedia con `AIR_DESTINATIONS`, que
       decia NVT. Los dos tests leian tablas distintas y los dosgive "ok" con
       el bug puesto. El unico que lo ve es comparar las dos tablas entre si. */
    const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    const bloque = server.match(/const AIR_DESTINATIONS = \{([^}]*)\}/);
    assert.ok(bloque, 'no se encontro AIR_DESTINATIONS en server.js');
    const air = {};
    for (const m of bloque[1].matchAll(/(\w+):\s*'([A-Z]{3})'/g)) air[m[1]] = m[2];

    const falta = Object.keys(model.DEST).filter((k) => !air[k]);
    assert.deepStrictEqual(falta, [], 'destinos del modelo sin codigo en AIR_DESTINATIONS: ' + falta.join(' '));

    /* Rio y Sao Paulo son la excepcion conocida y a proposito: el modelo guarda
       "RIO" y "SAO" para mostrar, que son areas metropolitanas y no
       aeropuertos, y AIR_DESTINATIONS guarda el aeropuerto real (GIG, GRU).
       Ver la nota de airportFor() en server.js. */
    const EXCEPCIONES = { rio: ['RIO', 'GIG'], sao: ['SAO', 'GRU'] };
    const malas = [];
    for (const k of Object.keys(air)) {
      const iata = model.DEST[k] && model.DEST[k].iata;
      if (!iata) continue;
      const ex = EXCEPCIONES[k];
      if (ex) {
        if (iata !== ex[0] || air[k] !== ex[1]) malas.push(k + ' deberia ser ' + ex[0] + '/' + ex[1] + ' y es ' + iata + '/' + air[k]);
      } else if (iata !== air[k]) {
        malas.push(k + ': modelo dice ' + iata + ', busqueda de vuelo usa ' + air[k]);
      }
    }
    assert.deepStrictEqual(malas, [], 'las dos tablas de aeropuerto se contradicen: ' + malas.join(' | '));

    /* Un shorthand de area metropolitana en AIR_DESTINATIONS hace que SerpAPI
       devuelva vacio SIN error, y la app cae a estimado en silencio. Estos son
       los que existen en el mundo; si alguno aparece aqui, es un NVT. */
    const SHORTHANDS = ['RIO', 'SAO', 'NYC', 'LON', 'PAR', 'BER', 'MAD', 'ROM', 'MIL', 'WAS', 'TYO', 'BUE'];
    const metro = Object.keys(air).filter((k) => SHORTHANDS.includes(air[k]));
    assert.deepStrictEqual(metro, [], 'AIR_DESTINATIONS con codigo de area metropolitana, no de aeropuerto: ' + metro.join(' '));
  });
  await t('el precio del transfer crece con la distancia al aeropuerto', function () {
    // El bug de fondo: el mismo precio para todos los destinos. De GIG a Rio hay
    // 18 km y de GIG a Buzios hay 174 por la RJ-124, y antes los dos costaban lo
    // mismo. Ademas el compartido casi no crece (lo que se paga es el chofer, que
    // se reparte) mientras que el privado crece con la distancia.
    const rio = model.transferOptions('rio'), buz = model.transferOptions('buz');
    assert.ok(rio.km < buz.km, 'Rio deberia estar mas cerca del aeropuerto que Buzios');
    assert.ok(buz.compartido > rio.compartido, 'el compartido de Buzios deberia costar mas que el de Rio');
    assert.ok(buz.privado > rio.privado * 1.5,
      'el privado de Buzios (' + buz.privado + ') deberia subir bastante mas que el de Rio (' + rio.privado + ')');
    // El compartido no puede depender tanto de la distancia como el privado.
    const subidaCompartido = buz.compartido / rio.compartido;
    const subidaPrivado = buz.privado / rio.privado;
    assert.ok(subidaCompartido < subidaPrivado,
      'el compartido (' + subidaCompartido.toFixed(1) + 'x) no deberia subir tanto como el privado (' + subidaPrivado.toFixed(1) + 'x)');
  });
  await t('un destino sin van compartida nunca cobra el precio de la compartida', function () {
    // Regresión: fernando tiene compartido: 0 con soloPrivado, porque a la isla
    // se llega en vuelo. Pero el cliente armaba el precio con `oficial.compartido
    // || 20`, y 0 es falsy: caia al piso y el presupuesto cobraba US$ 20 por
    // persona de una van que no existe. No hacia falta que la persona eligiera
    // la option: si marco "compartido" en Rio y despues cambio el destino a
    // Fernando de Noronha, el estado seguia diciendo 'shared'.
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    assert.ok(!/oficial && oficial\.compartido\) \|\|/.test(app),
      'app.js sigue usando truthiness para el precio: con compartido 0 cae al piso');

    // Se corre la funcion real del cliente contra la tabla real.
    const tabla = require(path.join(__dirname, 'public', 'transfer-precios.js'));
    const desdeFn = app.indexOf('function transferPreciosDe(meta)');
    // transferPreciosDe() usa AIRPORT_NAMES para nombrar el aeropuerto, y esa
    // tabla se declara unas lineas ANTES de la funcion. El corte arrancaba en la
    // funcion, asi que la declaracion quedaba afuera del bloque evaluado y el
    // test moria con "AIRPORT_NAMES is not defined" sin arrives a comprobar nada
    // del transfer. Se sube el corte hasta la declaracion para que viajen juntas.
    const desdeTabla = app.indexOf('var AIRPORT_NAMES =');
    const desde = (desdeTabla > 0 && desdeTabla < desdeFn) ? desdeTabla : desdeFn;
    const hastaFn = app.indexOf('function getSelectedTransferAmount(state)');
    const hasta = app.indexOf('// Iconos por categoría', hastaFn);
    assert.ok(desde > 0 && hasta > desde, 'no se pudo extraer transferPreciosDe del cliente');
    // tasaDe (la tasa BRL de la pantalla) se simula sin tasa: cae al USD derivado.
    const fn = new Function('CS_TRANSFER_PRICES', 'Number', 'tasaDe',
      app.slice(desde, hasta) + '; return { transferPreciosDe: transferPreciosDe, getSelectedTransferAmount: getSelectedTransferAmount };'
    )(tabla, Number, function () { return null; });

    const precios = fn.transferPreciosDe({ dest: { key: 'fernando' }, pax: 2 });
    assert.strictEqual(precios.compartido, 0, 'la compartida de fernando deberia seguir en 0, no caer al piso');
    assert.ok(precios.soloPrivado, 'fernando deberia declarar soloPrivado');
    assert.ok(precios.privado > 0, 'pero el privado tiene que valer');

    for (const pax of [1, 2, 4]) {
      const state = { meta: { dest: { key: 'fernando' }, pax: pax }, transportMode: 'flight', transferType: 'shared' };
      assert.strictEqual(fn.getSelectedTransferAmount(state), 0,
        'con ' + pax + ' personas la compartida de fernando no puede costar nada');
    }
    // Y el privado sigue siendo el mismo auto para cualquier cantidad de gente.
    for (const pax of [1, 2, 4]) {
      const state = { meta: { dest: { key: 'fernando' }, pax: pax }, transportMode: 'flight', transferType: 'private' };
      assert.strictEqual(fn.getSelectedTransferAmount(state), precios.privado,
        'el privado de fernando con ' + pax + ' personas');
    }
    // Un destino normal: el compartido escala con la gente, el privado no.
    const rio = fn.transferPreciosDe({ dest: { key: 'rio' }, pax: 3 });
    assert.strictEqual(fn.getSelectedTransferAmount({ meta: { dest: { key: 'rio' }, pax: 3 }, transportMode: 'flight', transferType: 'shared' }), rio.compartido * 3);
    assert.strictEqual(fn.getSelectedTransferAmount({ meta: { dest: { key: 'rio' }, pax: 3 }, transportMode: 'flight', transferType: 'private' }), rio.privado);
  });
  await t('el server manda el precio de transfer del destino en el meta', async function () {
    // Ojo con la query: `subcategory` es el nombre que se muestra, no el destino
    // que se cotiza. Hay que pedir dest=buz, porque si se deja el dest de la
    // query compartida (fln) el server cotiza Florianópolis y el precio de
    // transfer que devuelve es el de Florianópolis, no el de Búzios.
    const r = await get(port, '/api/cotizar?dest=buz&dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq&origin=MVD');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(j.meta.dest.key, 'buz', 'no cotizó Búzios: ' + j.meta.dest.key);
    const t = j.meta.officialTransfer;
    assert.ok(t, 'el meta no trae officialTransfer');
    assert.ok(!t.sinTabla, 'la cotizacion de buzios cae al piso, no a la tabla');
    assert.strictEqual(t.compartido, model.transferOptions('buz').compartido,
      'el server no mande el precio de la tabla');
    assert.strictEqual(t.privado, model.transferOptions('buz').privado, 'el privado no coincide con la tabla');
    assert.strictEqual(t.monto, t.compartido * j.meta.pax, 'el monto es el compartido por la cantidad de personas');
    assert.ok(t.km > 0, 'no manda los km del aeropuerto');
  });

  await t('cada destino declara de donde sale su costo, cuando y cuanta confianza tiene', function () {    // Los numeros de comida y traslado son ESTIMACIONES: no hay ningun provider
    // detras, y calc() los marca sources.comidas = 'estimado'. Lo unico que
    // hace que un conjunto de estimaciones sea defendible es que cada numero
    // diga de donde salio. data/costos-diarios.json es la fuente unica de esos
    // numeros y de esa metadata, y de ahi se generan el modelo y el cliente.
    //
    // Esta prueba falla si alguien agrega un destino o edita un numero sin
    // documentar el origen. Antes no habia nada que lo obligara: los 44
    // destinos entaron con numeros de la nada.
    const ruta = path.join(__dirname, 'data', 'costos-diarios.json');
    assert.ok(fs.existsSync(ruta), 'falta data/costos-diarios.json');
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    const D = datos.destinos;
    const NIVELES = ['alta', 'media', 'baja'];

    for (const k of Object.keys(model.DEST)) {
      const v = D[k];
      assert.ok(v, k + ' (' + model.DEST[k].name + ') no esta en data/costos-diarios.json');
      assert.ok(v.fuente && v.fuente.length > 20, k + ': "fuente" vacia o demasiado corta');
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(v.verificado || ''), k + ': "verificado" no es una fecha ISO');
      assert.ok(NIVELES.indexOf(v.confianza) >= 0, k + ': confianza invalida: ' + v.confianza);
      // Confianza baja tiene que explicar por que: o de donde se derivo, o que
      // le pasa a la fuente (poco dato, viejo, crowdsourced finito).
      if (v.confianza === 'baja') {
        assert.ok(v.derivacion || v.nota, k + ': confianza baja sin explicar la derivacion ni el problema de la fuente');
      }
      // Y los numeros del JSON tienen que ser los que quedaron en el codigo.
      const c = model.DESTINATION_COSTS[k];
      assert.deepStrictEqual(
        [c.transport.eco, c.transport.medio, c.transport.confort, c.food.casual, c.food.moderado, c.food.gourmet],
        [v.traslado.eco, v.traslado.medio, v.traslado.confort, v.comida.casual, v.comida.moderado, v.comida.gourmet],
        k + ': el codigo no coincide con data/costos-diarios.json. Corré npm run build:costos');
    }
    assert.deepStrictEqual(Object.keys(D).filter((k) => !model.DEST[k]), [],
      'hay destinos en el JSON que no existen en el modelo');
  });
  await t('cotiza Buenos Aires como destino de Argentina', async function () {
    const r = await get(port, '/api/cotizar?dest=bue&dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200); assert.strictEqual(j.meta.dest.key, 'bue');
    assert.strictEqual(j.meta.dest.country, 'Argentina'); assert.ok(j.list.length >= 3);
  });
  await t('cotiza todos los destinos de la grilla, ordenados por total', async function () {
    const r = await get(port, '/api/cotizar-todos?dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq');
    const j = JSON.parse(r.body);
    assert.strictEqual(r.status, 200);
    // El total de destinos se deriva de los grupos en vez de estar escrito: la
    // lista estaba clavada en 12 y por eso 25 destinos que el picker ofrecia
    // no aparecian nunca en la busqueda por presupuesto. Entre ellos Torres y
    // Capao da Canoa, que son mas baratos que los 12 y tampoco aparecian.
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const desde = app.indexOf('var DESTINATION_GROUPS = [');
    const grupos = app.slice(desde, app.indexOf('\n  ];', desde));
    const expected = new Set();
    for (const g of grupos.matchAll(/keys:\s*\[([^\]]*)\]/g)) {
      for (const k of g[1].matchAll(/'([^']+)'/g)) expected.add(k[1]);
    }
    assert.ok(j.options.length > 12, 'siguen siendo pocas opciones: ' + j.options.length);
    const keys = new Set(j.options.map(function (o) { return o.dest.key; }));
    for (const k of expected) {
      assert.ok(keys.has(k), 'la grilla ofrece ' + k + ' pero cotizar-todos no lo devuelve');
    }
    assert.strictEqual(keys.size, j.options.length, 'hay destinos repetidos en las opciones');
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
    // devolvían cotizaciones reales quemando la cuota de SerpAPI y de Booking.
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
  await t('los hoteles de un viaje combinado traen las dos paradas', async function () {
    // Regresión: /api/hoteles solo miraba `dest`, así que el alojamiento de la
    // segunda parada se cobraba con el promedio del modelo (lodgingNightlyCosts)
    // sin que el usuario lo pudiera ver ni cambiar. En la misma sección había un
    // hotel real de Booking en la primera parada y un número inventado en la
    // segunda, sin que nada lo dijera.
    const base = '/api/hoteles?dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq&hotel_type=intermedio';
    const uno = JSON.parse((await get(port, base + '&dest=buz')).body);
    // Sin segunda parada la respuesta no cambia: hotelsSecond vacío y la clave
    // en blanco, para que el front sepa que no se consultó nada.
    assert.ok(Array.isArray(uno.hotels), 'hotels tiene que ser una lista');
    assert.strictEqual(uno.hotelsSecond.length, 0, 'sin second no hay hoteles de una segunda parada');
    assert.strictEqual(uno.secondKey, '', 'sin second la clave de la segunda parada viene vacía');

    const par = JSON.parse((await get(port, base + '&dest=buz&subcategory=B%C3%BAzios+%2B+Arraial+do+Cabo&second=arraial')).body);
    assert.strictEqual(par.secondKey, 'arraial', 'el server tiene que devolver la segunda parada que se pidió');
    assert.strictEqual(par.secondName, 'Arraial do Cabo', 'y su nombre, para rotular el grupo de hoteles');
    assert.ok(Array.isArray(par.hotelsSecond), 'hotelsSecond tiene que ser una lista');
    assert.ok(Array.isArray(par.hotels), 'y no puede romper la lista de la primera parada');
    // Sin key de Booking las dos vienen vacías, pero la estructura tiene que estar:
    // es lo que le dice al front "no hay" y no "no se consultó".
    assert.strictEqual(typeof par.hotelsNearbySecond, 'string', 'hotelsNearbySecond es string aunque no haya zona');
    assert.ok(par.tiposDisponibles === null || Array.isArray(par.tiposDisponibles), 'tiposDisponibles sigue siendo lista o null');
    // El presupuesto por noche de la segunda parada se resuelve por separado: si
    // saliera el de la primera, el filtro de Booking de los dos grupos apuntaría al
    // mismo número y uno de los dos quedaría siempre vacío.
    assert.ok(par.hotelBudgetPerNightSecond === null || Number.isFinite(Number(par.hotelBudgetPerNightSecond)),
      'hotelBudgetPerNightSecond tiene que ser un número o null');

    // Una segunda parada que no existe, o que queda demasiado lejos para un mismo
    // viaje, no puede pasar: se cobraría la cuota de Booking de un destino que no
    // se va a cotizar. El par se valida con comboTransfer(), el mismo criterio que
    // usa /api/cotizar.
    assert.strictEqual((await get(port, base + '&dest=buz&second=noexiste')).status, 400,
      'una segunda parada inexistente tiene que rechazarse');
    assert.strictEqual((await get(port, base + '&dest=buz&second=for')).status, 400,
      'una segunda parada lejana tiene que rechazarse');
  });
  await t('los endpoints que cuestan plata no comparten cupo con los gratuitos', async function () {
    // /api/cotizar-todos es cálculo local y no gasta cuota. Antes compartía
    // cubo con /api/cotizar, que sí consulta el buscador de vuelos: golpear el endpoint
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
    // El bloque termina en featuredMonthWindows(), que es la ultima funcion del
    // grupo de fechas que esta prueba ejercita. featuredMonthContext() y
    // nextSpecialDateAfter() se fueron con la linea de contexto de la seccion
    // de escapadas, asi que ya no forman parte de lo que hay que ejecutar.
    const block = source.match(/var MONTH_NAMES[\s\S]*?function featuredMonthWindows[\s\S]*?\n  }/);
    assert.ok(block, 'no se encontró el bloque de fechas en app.js');
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const addDays = function (d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
    const iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const scope = { today: today, addDays: addDays, iso: iso, module: { exports: {} } };
    const factory = new Function('today', 'addDays', 'iso',
      block[0] + '\nreturn { easterSunday: easterSunday, featuredMonthWindows: featuredMonthWindows, MONTH_NAMES: MONTH_NAMES };');
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
    // Salvo el ultimo dia del mes: ahi ya no queda ninguna fecha futura en el mes
    // actual y la primera ventana es la del mes que viene.
    const esUltimoDia = today.getDate() === new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const primero = new Date(today.getFullYear(), today.getMonth() + (esUltimoDia ? 1 : 0), 1, 12);
    assert.strictEqual(windows[0].month, primero.getMonth());
    assert.strictEqual(windows[0].year, primero.getFullYear());
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
    // Y la etiqueta de cada ventana tiene que ser una ocasión que la app sepa
    // nombrar. Antes estas fechas aparecían también en un párrafo arriba de la
    // barra de meses, y se notaba que la pestaña y el párrafo contaban la misma
    // salida con palabras distintas. La barra quedó como el único lugar donde
    // aparece la fecha, así que ahora el nombre de la ocasión es la única pista
    // de qué se está mirando, y un nombre mal escrito se vería tal cual en la
    // pestaña del mes.
    const OCASIONES = ['Año Nuevo', 'Día de la Independencia', 'Día de la Raza', 'Día de los Difuntos', 'Navidad', 'Carnaval', 'Semana Santa', 'Fin de año', 'Fin de semana'];
    windows.forEach(function (w) {
      assert.ok(OCASIONES.indexOf(w.label) >= 0,
        'la etiqueta de ' + MONTHS[w.month] + ' es "' + w.label + '", que no es una ocasión conocida');
    });
  });
  await t('el calendario no ofrece fechas más allá de un año', async function () {
    // El tope vive en el navegador (public/app.js), así que se evalúa la función
    // real. El error que se corrige acá no daba ningún symptom visible: el
    // calendario dejaba scrollear hasta meses que nadie viaja, y el precio de un
    // vuelo a esa altura sale del modelo, no de una consulta. Lo que se fixe es
    // que el último día habilitable sea exactamente hoy + 1 año, y no "el mes que
    // viene" ni "12 meses", que son dos cosas distintas.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const fn = function (nombre) {
      const desde = source.indexOf('function ' + nombre + '(');
      assert.ok(desde >= 0, 'no se encontró ' + nombre + '() en app.js');
      let nivel = 0;
      for (let j = source.indexOf('{', desde); j < source.length; j++) {
        if (source[j] === '{') nivel++;
        else if (source[j] === '}') { nivel--; if (nivel === 0) return source.slice(desde, j + 1); }
      }
      throw new Error('llaves desbalanceadas en ' + nombre);
    };
    const iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const leer = function (value) { const p = String(value).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12); };
    // `today` es una constante del módulo de app.js, no un parámetro: se la pasa
    // como argumento y se declara local adentro, para que la función evaluada
    // (que es el código real) cierre sobre esa y no sobre un undefined.
    const maxDepartureDate = new Function('hoy', 'iso',
      'var today = hoy;\n' + fn('maxDepartureDate') + '\nreturn maxDepartureDate();');

    for (const fecha of ['2026-09-28', '2026-12-31', '2027-01-01', '2026-02-27', '2024-02-29']) {
      const h = leer(fecha);
      const hoy = h;
      const tope = maxDepartureDate(h, iso);
      const esperado = new Date(hoy.getTime());
      esperado.setFullYear(esperado.getFullYear() + 1);
      assert.strictEqual(tope, iso(esperado), 'desde ' + fecha + ' el tope tendría que ser ' + iso(esperado) + ' y es ' + tope);
      // Y el tope es un año exacto, no 365 días: en un año bisiesto son 366.
      const dias = Math.round((leer(tope) - hoy) / 864e5);
      assert.ok(dias === 365 || dias === 366, 'desde ' + fecha + ' el tope cae a ' + dias + ' días, no es un año');
    }

    // El día del tope todavía se puede elegir y el siguiente no. Se comprueba
    // sobre el texto de calendarMonthMarkup(), que es donde se deshabilita: si
    // el filtro disappears, la grilla vuelve a pintar meses enteros tachados.
    const markup = fn('calendarMonthMarkup');
    assert.ok(/value > maxDeparture/.test(markup),
      'calendarMonthMarkup() no deshabilita los días que pasan del tope');
    // Y la flecha de "mes siguiente" se apaga en el mismo límite, o el menú deja
    // avanzar a un mes entero de días tachados.
    const render = fn('renderDateRangeCalendar');
    assert.ok(/next\.disabled = rangeCalendarMonth >= lastAllowedMonth/.test(render),
      'renderDateRangeCalendar() no apaga la flecha de adelante en el tope');
    // Y el tope se dice en pantalla: un calendario con la última fila en gris no
    // explica por qué no se puede seguir.
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    assert.ok(html.includes('data-calendar-limit'), 'el panel del calendario no tiene el aviso del tope');
    assert.ok(/textContent = 'Elegí fechas de ida hasta el /.test(fn('renderDateRangeCalendar')),
      'el aviso del tope no se está escribiendo');
  });
  await t('el menú de moneda y el de destinos se quedan dentro de la pantalla', async function () {
    // Los dos desbordes de móvil. Ninguno daba error: el menú de moneda se
    // cortaba por el borde de la ventana (anclado con right:0 a un botón que
    // está en el medio del header, con 238px de ancho) y el de destinos se
    // trababa al scrollear porque la cadena de scroll no estaba cortada y su
    // alto era un número fijo que en un celular alto se pasaba de la pantalla.
    const fs = require('fs');
    const path = require('path');
    const raiz = path.join(__dirname, 'public');
    const app = fs.readFileSync(path.join(raiz, 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(raiz, 'style.css'), 'utf8');
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const regla = function (sel) {
      const m = sinComentarios.match(new RegExp('(?:^|[{},])\\s*' + sel + '\\s*\\{([^}]*)\\}'));
      return m ? m[1] : null;
    };

    const moneda = regla('\\.currency-menu');
    assert.ok(moneda, 'no se encontró la regla .currency-menu');
    assert.ok(/position:fixed/.test(moneda),
      '.currency-menu tiene que ser position:fixed: con absolute y right:0 el menú se ancla al botón, que en un celular está en el medio del header, y se sale por el otro borde');
    assert.ok(/max-width:calc\(100vw - 24px\)/.test(moneda), '.currency-menu puede ser más ancho que la pantalla');
    assert.ok(/max-height:min\(62vh/.test(moneda), '.currency-menu no tiene alto máximo: con muchas monedas se sale por abajo');
    assert.ok(/overflow:auto/.test(moneda) && /overscroll-behavior:contain/.test(moneda),
      '.currency-menu no scrollea contenido, o la lista se va de la pantalla');
    // Y las coordenadas las pone JS, ya con el menu visible: en display:none no
    // hay caja y la medida daria 0, con lo que la decision seria siempre "abajo".
    assert.ok(/function posicionarMenuMoneda/.test(app), 'falta posicionarMenuMoneda()');
    const pos = app.slice(app.indexOf('function posicionarMenuMoneda'), app.indexOf('function posicionarMenosMonedaAbiertos'));
    assert.ok(/holguraAbajo|arriba/.test(pos) || /t\.bottom \+ separacion/.test(pos),
      'posicionarMenuMoneda() no decide si el menu va arriba o abajo');
    assert.ok(/left = margen/.test(pos) || /left < margen/.test(pos),
      'posicionarMenuMoneda() no recorta el menú contra el borde de la ventana');
    assert.ok(/addEventListener\('resize', posicionarMenosMonedaAbiertos\)/.test(app),
      'el menú no se reposiciona al cambiar el tamaño de la ventana');
    assert.ok(/addEventListener\('scroll', posicionarMenosMonedaAbiertos, true\)/.test(app),
      'el menú no se reposiciona al scrollear: queda flotando lejos del botón');
    assert.ok(/posicionarMenuMoneda\(menu, trigger\)/.test(app), 'abrir el menú no lo posiciona');

    const destinos = regla('\\.custom-select__menu');
    assert.ok(destinos, 'no se encontró la regla .custom-select__menu');
    assert.ok(/overscroll-behavior:contain/.test(destinos),
      '.custom-select__menu sin overscroll-behavior:contain: al llegar al final de la lista el dedo sigue scrolleando la página de atrás y la lista parece trabada');
    assert.ok(/max-height:min\(420px,calc\(100dvh/.test(destinos),
      '.custom-select__menu tiene un alto fijo: en un celular alto termina abajo de la pantalla y las últimas opciones no se alcanzan');
    assert.ok(/touch-action:pan-y/.test(destinos), '.custom-select__menu no declara touch-action');
    assert.ok(/-webkit-overflow-scrolling:touch/.test(destinos), 'falta el touch-scrolling para iOS');
    // Y el menu se invierte cuando no hay lugar debajo.
    assert.ok(regla('\\.custom-select\\.is-open-up \\.custom-select__menu'),
      'falta la regla que dibuja el menu hacia arriba');
    assert.ok(/function elegirLadoDelMenu/.test(app), 'falta elegirLadoDelMenu()');
    assert.ok(/menu\.hidden\) return;/.test(app.slice(app.indexOf('function elegirLadoDelMenu'), app.indexOf('function clearActiveDestOption'))),
      'elegirLadoDelMenu() mide un menu oculto y siempre elige abajo');
    const elige = app.slice(app.indexOf('function elegirLadoDelMenu'), app.indexOf('function clearActiveDestOption'));
    assert.ok(/holguraAbajo/.test(elige) && /holguraArriba/.test(elige), 'elegirLadoDelMenu() no mide el hueco de los dos lados');
    assert.ok(/classList\.toggle\('is-open-up'/.test(elige), 'elegirLadoDelMenu() no deja la clase que invierte el menu');
    assert.ok(/offsetHeight/.test(elige), 'elegirLadoDelMenu() no mide el alto real del menu');
    ['openDestMenu', 'openComboMenu'].forEach(function (fn) {
      const cuerpo = app.slice(app.indexOf('function ' + fn), app.indexOf('function ', app.indexOf('function ' + fn) + 10));
      assert.ok(cuerpo.includes('elegirLadoDelMenu('), fn + '() no elige el lado del menu');
    });
    assert.ok(/classList\.remove\('is-open', 'is-open-up'\)/.test(app),
      'cerrar el menu tiene que sacar is-open-up, o el siguiente queda invertido de una apertura anterior');
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
    /* El contenido de los tours se partio en dos archivos: los DATOS viven en
       public/tours.generated.js (generado desde data/tours.json, que a su vez
       viene de la Sheet de Drive) y el CODIGO que los dibuja sigue en app.js.

       Por eso se piden los dos. Pedir los textos del catalogo en app.js ya no
       tiene sentido: no los tiene, y el fallo que encuentra seria "el archivo
       se sirvio vacio", no "faltan tours". Y al reves: si app.js se sirviera
       bien pero el generado no, la seccion de tours sale vacia en silencio. */
    const toursScript = await get(port, '/tours.generated.js');
    assert.strictEqual(toursScript.status, 200);
    ['Cristo Redentor', 'Isla de Campeche', 'Piscinas Naturales', 'Playa en Playa', 'Noche suiza'].forEach(function (copy) { assert.ok(toursScript.body.includes(copy), 'Falta contenido de tours en tours.generated.js: ' + copy); });
    ['data-tour-choice', 'data-tour-detail-open', 'Los imperdibles de', 'Créditos de las fotos'].forEach(function (copy) { assert.ok(appScript.body.includes(copy), 'Falta la mecanica de tours en app.js: ' + copy); });
    // app.js ya no debe llevar el catalogo: si vuelve a entrar, alguien copio
    // tours a mano y quedan dos fuentes que se van a divergir. Se busca el
    // helper tour(), no un titulo suelto: los titulos siguen apareciendo en
    // app.js como claves de TOUR_PHOTOS, que es lo correcto.
    assert.ok(!/tour\(\['[a-z]+'\]/.test(appScript.body),
      'app.js volvio a traer el catalogo de tours escrito a mano. La unica fuente es data/tours.json');
    // La tarjeta entera es la zona sensible: el checkbox se estira sobre el
    // article y sólo el botón de detalle queda por encima.
    assert.ok(appScript.body.includes('class="local-tour__input"'), 'el checkbox del tour debe ser hijo directo de la tarjeta');
    assert.ok(!appScript.body.includes('local-tour__add'), 'el botón "Sumar" ya no debe existir');
    assert.ok(!appScript.body.includes('Reservar los tours seleccionados'), 'el pie con la nota y el botón de reserva ya no debe existir');
  });
  await t('con key vacía la búsqueda real de vuelos responde con error controlado', async function () {
    const oldKey = process.env.SERPAPI_API_KEY;
    process.env.SERPAPI_API_KEY = '';
    flights.clearCache();
    try {
      const r = await post(port, '/api/vuelos/buscar', { origen: 'MVD', destino: 'fln', fecha_ida: dep, fecha_vuelta: ret, pasajeros: 2, style: 'eq' });
      const j = JSON.parse(r.body);
      assert.strictEqual(r.status, 503); assert.deepStrictEqual(j.offers, []);
      assert.match(j.error, /no está disponible/i);
      // Sin key el calendario responde 200 con la lista vacía: es una mejora
      // sobre la estimación y no puede romper la pantalla de resultados.
      const c = await get(port, '/api/vuelos/calendario?dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2&style=eq');
      const cj = JSON.parse(c.body);
      assert.strictEqual(c.status, 200);
      assert.strictEqual(cj.configured, false);
      assert.deepStrictEqual(cj.puntos, []);
    } finally {
      process.env.SERPAPI_API_KEY = oldKey;
      flights.clearCache();
    }
  });
  server.close();
  console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' (con fallas)' : ''));
})();
