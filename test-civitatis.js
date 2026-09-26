'use strict';
/*
 * Pruebas del provider de Civitatis.
 *
 * Lo importante acá es el filtro de Búzios y que un fallo de la API caiga a la
 * lista local. Si eso se rompe, la seccion de tours queda vacia y el usuario ve
 * un人均 error; si no, sigue mostrando los tours de antes.
 */

const assert = require('assert');
const civ = require('./lib/providers/civitatis');

process.env.CIVITATIS_API_KEY = '';
process.env.CIVITATIS_API_SECRET = '';
process.env.CIVITATIS_DESTINATIONS = 'rio=1,fln=2';

const pruebas = [];
function prueba(name, fn) { pruebas.push({ name, fn }); }
function ok(cond, msg) { assert.ok(cond, msg); }

// Respuesta de listado, recortada a lo que el provider lee.
const LISTADO = {
  activities: [
    { id: '101', title: 'Cristo Redentor', shortDescription: 'Visita guiada', minimumPrice: 45.5, currency: 'USD', duration: 240, mainImage: 'https://img/cristo.jpg', rating: 4.8, reviewsCount: 120, freeCancellation: true, url: 'https://www.civitatis.com/101' },
    { id: '102', title: 'Paseo en barco', minimumPrice: 30, currency: 'USD', duration: 180 }
  ]
};

function fakeFetch(plan) {
  let i = 0;
  return async function (url, options) {
    const paso = plan[Math.min(i, plan.length - 1)];
    i++;
    if (typeof paso === 'function') return paso(url, options);
    return { ok: paso.status < 400, status: paso.status || 200, json: async function () { return paso.body; } };
  };
}
const authOk = { status: 200, body: { access_token: 'tok-civ', expires_in: 3600 } };

// ---------- filtro de Búzios: lo que se pidió explícitamente ----------

prueba('Búzios no se consulta a la API', async function () {
  civ.clearCache();
  let consultada = false;
  civ.setFetch(fakeFetch([{ status: 500, body: {} }].map(function (p) { return function () { consultada = true; return { ok: false, status: 500, json: async () => ({}) }; }; })));
  const out = await civ.actividades('buz', { dep: '2026-11-10' });
  ok(out.length === 0, 'sin actividades');
  ok(consultada === false, 'no debe pegarle a la API para Búzios: sus tours son locales');
});

prueba('destinoIdDe devuelve null para Búzios aunque esté en el mapa', function () {
  process.env.CIVITATIS_DESTINATIONS = 'rio=1,buz=99,fln=2';
  civ.clearCache();
  ok(civ.destinoIdDe('buz') === null, 'aunque el mapa lo tenga, Búzios queda afuera');
  process.env.CIVITATIS_DESTINATIONS = 'rio=1,fln=2';
});

prueba('destino sin mapear devuelve lista vacía y no rompe', async function () {
  civ.clearCache();
  civ.setFetch(fakeFetch([authOk, { status: 200, body: LISTADO }]));
  const out = await civ.actividades('destino-inexistente', { dep: '2026-11-10' });
  ok(Array.isArray(out) && out.length === 0, 'sin actividades y sin excepcion');
});

// ---------- el camino feliz ----------

prueba('sin credenciales no intenta nada', async function () {
  civ.clearCache();
  ok(civ.isConfigured() === false, 'no deberia estar configurado');
  const out = await civ.actividades('fln', { dep: '2026-11-10' });
  ok(out.length === 0, 'devuelve vacio sin credenciales');
});

prueba('trae actividades normalizadas al contrato de la app', async function () {
  civ.clearCache();
  process.env.CIVITATIS_API_KEY = 'k';
  process.env.CIVITATIS_API_SECRET = 's';
  civ.setFetch(fakeFetch([authOk, { status: 200, body: LISTADO }]));
  const out = await civ.actividades('fln', { dep: '2026-11-10' });
  ok(out.length === 2, 'devuelve las 2 actividades, hay: ' + out.length);
  const a = out[0];
  ok(a.id === '101' && a.title === 'Cristo Redentor', 'id y title');
  ok(a.price === 45.5 && a.currency === 'USD', 'precio y moneda');
  ok(a.image === 'https://img/cristo.jpg', 'imagen');
  ok(a.rating === 4.8, 'rating');
  ok(a.source === 'civitatis', 'marca de origen');
});

prueba('pide token una sola vez y lo reusa', async function () {
  civ.clearCache();
  let authCalls = 0;
  civ.setFetch(fakeFetch([
    function (url) { if (url.indexOf('auth') >= 0) { authCalls++; return { ok: true, status: 200, json: async () => authOk.body }; } return { ok: true, status: 200, json: async () => LISTADO }; }
  ]));
  await civ.actividades('fln', { dep: '2026-11-10' });
  await civ.actividades('rio', { dep: '2026-11-10' });
  ok(authCalls === 1, 'no debe pedir el token en cada request, lo pidio ' + authCalls + ' veces');
});

prueba('cachea por destino+fecha', async function () {
  civ.clearCache();
  let listCalls = 0;
  civ.setFetch(fakeFetch([
    function (url) { if (url.indexOf('auth') >= 0) return { ok: true, status: 200, json: async () => authOk.body }; listCalls++; return { ok: true, status: 200, json: async () => LISTADO }; }
  ]));
  await civ.actividades('fln', { dep: '2026-11-10' });
  await civ.actividades('fln', { dep: '2026-11-10' });
  ok(listCalls === 1, 'la segunda va de cache, no pega otra vez: ' + listCalls);
});

// ---------- fallos: la seccion no puede quedar vacia por un error de red ----------

prueba('credenciales malas devuelven vacio y avisan', async function () {
  civ.clearCache();
  civ.setFetch(fakeFetch([{ status: 401, body: { error: 'invalid_client' } }]));
  const out = await civ.actividades('fln', { dep: '2026-11-10' });
  ok(out.length === 0, 'sin actividades, para que caiga la lista local');
});

prueba('error 500 devuelve vacio, no rompe la pagina', async function () {
  civ.clearCache();
  civ.setFetch(fakeFetch([authOk, { status: 500, body: { message: 'boom' } }]));
  const out = await civ.actividades('fln', { dep: '2026-11-10' });
  ok(out.length === 0, 'sin actividades');
});

prueba('respuesta rara no rompe', async function () {
  civ.clearCache();
  civ.setFetch(fakeFetch([authOk, { status: 200, body: null }]));
  const out = await civ.actividades('fln', { dep: '2026-11-10' });
  ok(Array.isArray(out), 'siempre devuelve un array');
});

prueba('filtra actividades sin precio o sin id', async function () {
  civ.clearCache();
  civ.setFetch(fakeFetch([authOk, { status: 200, body: { activities: [
    { id: '1', title: 'Con precio', minimumPrice: 20 },
    { id: '2', title: 'Sin precio' },
    { title: 'Sin id', minimumPrice: 30 }
  ] } }]));
  const out = await civ.actividades('fln', { dep: '2026-11-10' });
  ok(out.length === 1, 'solo la que tiene id y precio, hay: ' + out.length);
  ok(out[0].id === '1', 'es la correcta');
});

prueba('limpia HTML de la descripcion', async function () {
  civ.clearCache();
  civ.setFetch(fakeFetch([authOk, { status: 200, body: { activities: [
    { id: '1', title: 'T', minimumPrice: 10, description: '<p>Con <b>negrita</b></p>' }
  ] } }]));
  const out = await civ.actividades('fln', { dep: '2026-11-10' });
  ok(out[0].description === 'Con negrita', 'sin etiquetas: ' + out[0].description);
});

(async function () {
  let fails = 0;
  for (const p of pruebas) {
    try { await p.fn(); console.log('  ok  ' + p.name); }
    catch (e) { console.log('  FALLA  ' + p.name + '\n         ' + e.message); fails++; }
  }
  delete process.env.CIVITATIS_API_KEY;
  delete process.env.CIVITATIS_API_SECRET;
  console.log(fails ? '\n' + fails + ' prueba(s) fallaron' : '\nTodo OK (' + pruebas.length + ' pruebas)');
  process.exit(fails ? 1 : 0);
})();
