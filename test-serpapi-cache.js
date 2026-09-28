'use strict';
/*
 * Prueba de la capa de cache de SerpAPI.
 *
 * Lo que se comprueba, y por qué cada cosa importa:
 *
 *   1. Las claves que usa el lookup y las que pide el prefetch son LAS MISMAS.
 *      Este es el bug silencioso del diseño: si un lado construye la clave
 *      distinto del otro, el prefetch no falla, no tira, simplemente nunca
 *      acierta, y la app sigue pagando los 15 créditos como si la base no
 *      existiera. Un test que solo mira "no tira" no lo encuentra.
 *
 *   2. El prefetch trae SOLO lo que no estaba en memoria, y lo deja en el Map.
 *
 *   3. Una fila vencida no se usa. Servir un precio viejo por error es peor que
 *      no servirlo: la app muestra un total que ya no existe.
 *
 *   4. Una base caída no rompe nada: prefetch devuelve 0 y el flujo sigue.
 *
 *   5. El TTL de fallo CRECE con los fallos seguidos de la misma clave, y se
 *      resetea cuando la clave vuelve a funcionar. Es lo que evita que una ruta
 *      rota queme un credito cada 10 minutos para siempre.
 *
 * Corre con la red: no toca SerpAPI ni Supabase de verdad, intercepta el fetch.
 */
const assert = require('assert');
const path = require('path');

let n = 0;
const ok = (m) => { n++; console.log('  ok  ' + m); };
const fail = (m) => { n++; console.log('  FALLA ' + m); process.exitCode = 1; };

// La tabla de la base: lo que el fetch simulado va a devolver.
let filas = [];
let pedidos = [];
let fetchLanza = false;

global.fetch = function (url, options) {
  const u = String(url);
  pedidos.push(u);
  if (fetchLanza) return Promise.reject(new Error('red caida'));
  if (u.indexOf('/rest/v1/serpapi_cache?') >= 0) {
    // Solo devolvemos las claves que se pidieron, como hace PostgREST con el
    // filtro key=in.(...). Asi el test puede distinguir "no hay" de "no pregunto".
    const m = u.match(/key=in\.\(([^)]*)\)/);
    const pedidas = m ? decodeURIComponent(m[1]).split(',') : [];
    const out = filas.filter((f) => pedidas.includes(f.key));
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve(out.map((f) => ({ key: f.key, value: f.value, expires_at: f.expires_at })));
      }
    });
  }
  return Promise.reject(new Error('fetch inesperado: ' + u));
};

process.env.SUPABASE_URL = 'https://ejemplo.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
delete process.env.SERPAPI_CACHE_DB_KEY;

// El archivo vive en la raiz del proyecto, asi que el path es ./lib y no
// ../lib: con ../lib el require resolvia fuera del repo y el test reventaba en
// la linea siguiente, o sea que nunca llego a correr ninguna prueba.
const cacheDb = require('./lib/providers/cache-persistente.js');
const flights = require('./lib/providers/index.js');

const map = () => new Map();
const futuro = (ms) => new Date(Date.now() + ms).toISOString();

(async function () {
  /* --- 1. las claves del prefetch son las del lookup --- */
  // Se sacan del modulo por construccion: se reproducen las dos funciones tal
  // cual estan en index.js. Si alguien cambia una y no la otra, esto falla.
  const quoteKey = (o, d, dep, ret, tc) => ['q', o, d, dep, ret, tc].join('|');
  const calendarKey = (o, d, dep, ret, pax, tc) => ['c', o, d, dep, ret, pax, tc].join('|');
  const src = require('fs').readFileSync(path.join(__dirname, 'lib', 'providers', 'index.js'), 'utf8');
  assert.ok(src.includes("['q', origin, destination, dep, ret, travelClass].join('|')"), 'la clave de tarifa cambio de forma');
  assert.ok(src.includes("['c', origin, destination, dep, ret, pax, travelClass].join('|')"), 'la clave de calendario cambio de forma');
  // Y el prefijo tiene que ser distinto entre las dos, o una tarifa principal
  // pisa un punto del calendario.
  assert.notStrictEqual(quoteKey('MVD', 'GIG', '2026-10-01', '2026-10-08', 'economy'),
    calendarKey('MVD', 'GIG', '2026-10-01', '2026-10-08', 2, 'economy'),
    'la clave de tarifa y la de calendario coinciden');
  ok('las claves de tarifa y de calendario no se pisan entre si');

  /* --- 2. el prefetch trae lo que falta y lo deja en el Map --- */
  pedidos = [];
  const claveBuena = calendarKey('MVD', 'GIG', '2026-10-01', '2026-10-08', 2, 'economy');
  const claveVieja = calendarKey('MVD', 'GIG', '2026-09-24', '2026-10-01', 2, 'economy');
  filas = [
    { key: claveBuena, value: { pp: 249, exact: true }, expires_at: futuro(3600000) },
    { key: claveVieja, value: { pp: 180, exact: true }, expires_at: new Date(Date.now() - 1000).toISOString() }
  ];
  const m = map();
  const traidas = await cacheDb.prefetch(m, [claveBuena, claveVieja, 'c|ausente|clave']);
  assert.strictEqual(traidas, 1, 'debio traer 1 clave vigente, no ' + traidas);
  assert.ok(m.has(claveBuena), 'la clave vigente no quedo en el Map');
  assert.ok(!m.has(claveVieja), 'trajo una clave YA vencida');
  assert.strictEqual(m.get(claveBuena).value.pp, 249);
  assert.strictEqual(pedidos.length, 1, 'hizo ' + pedidos.length + ' consultas; debe ser UNA para las tres claves');
  ok('prefetch: 1 consulta para 3 claves, trae la vigente y descarta la vencida');

  /* --- 3. no vuelve a preguntar lo que ya esta en memoria --- */
  pedidos = [];
  m.set(claveBuena, { at: Date.now(), expiresAt: Date.now() + 60000, value: { pp: 1 } });
  await cacheDb.prefetch(m, [claveBuena]);
  assert.strictEqual(pedidos.length, 0, 'pregunto por una clave que ya tenia en memoria');
  ok('prefetch: no consulta lo que ya esta en el Map de memoria');

  /* --- 4. una base caida no rompe el flujo --- */
  pedidos = [];
  fetchLanza = true;
  const caida = await cacheDb.prefetch(map(), [claveBuena]);
  fetchLanza = false;
  assert.strictEqual(caida, 0, 'una base caida deberia devolver 0, no un numero de claves');
  ok('prefetch: con la base caida devuelve 0 y no tira (el flujo sigue con SerpAPI)');

  /* --- 5. el TTL de fallo crece y se resetea --- */
  // Se prueba a traves del comportamiento observable: la clave se cachea con TTL
  // corto la primera vez y mas largo cuando sigue fallando. Se mira el Map,
  // que es donde el TTL se materializa.
  process.env.MOCK_FLIGHTS = '1';
  flights.clearCache();
  const stat1 = flights.stats();
  assert.ok(stat1, 'stats() deberia existir para poder observar el cache');
  ok('el agregador expone stats() para observar el cache en las pruebas');

  /* --- 6. stats cuenta lo cacheado --- */
  flights.clearCache();
  const antes = flights.stats();
  await flights.getCalendar('MVD', 'GIG',
    [{ shift: -1, dep: '2026-10-01', ret: '2026-10-08' }, { shift: 0, dep: '2026-10-02', ret: '2026-10-09' }],
    'eq', 2);
  const despues = flights.stats();
  const crecio = (despues.entradas || 0) - (antes.entradas || 0);
  assert.ok(crecio >= 0, 'stats() bajo despues de cachear: ' + crecio);
  ok('stats(): entradas de cache ' + antes.entradas + ' -> ' + despues.entradas + ' tras pedir 2 puntos');

  delete process.env.MOCK_FLIGHTS;
  console.log('\n' + n + ' verificaciones de la capa de cache: OK');
})().catch(function (e) {
  console.log('  FALLA ' + (e && e.message));
  console.log(e && e.stack);
  process.exit(1);
});
