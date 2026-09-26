'use strict';
/*
 * Pruebas del provider de Travelpayouts.
 *
 * Lo que se verifica aca no es que la API de verdad responda, sino lo que pasa
 * cuando responde bien, cuando falla y cuando no hay token. La razon: un fallo
 * de afiliados nunca debe romper la busqueda de hoteles, y eso hay que
 * probarlo con un fetch inyectado, no contra la API real.
 */

const assert = require('assert');
const tp = require('./lib/providers/travelpayouts');

process.env.TRAVELPAYOUTS_API_TOKEN = '';
process.env.TRAVELPAYOUTS_MARKER = '780345';
process.env.TRAVELPAYOUTS_TRS = '';

const pruebas = [];
function prueba(name, fn) { pruebas.push({ name, fn }); }
function ok(cond, msg) { assert.ok(cond, msg); }

function fakeFetch(responses) {
  let call = 0;
  return async function (url, options) {
    const next = responses[Math.min(call, responses.length - 1)];
    call++;
    if (typeof next === 'function') return next(url, options);
    return {
      ok: next.status === undefined ? true : next.status < 400,
      status: next.status || 200,
      json: async function () { return next.body; }
    };
  };
}
const okBody = (links) => ({
  code: 'success', status: 200,
  result: { marker: 780345, links }
});

// ---------- sin token ----------

prueba('sin token devuelve el link de Booking tal cual', async function () {
  tp.clearCache(); tp.setFetch(fakeFetch([okBody([])]));
  const url = 'https://www.booking.com/hotel/br/ibis.html';
  const out = await tp.toPartnerUrl(url);
  ok(out === url, 'tiene que devolver el mismo link, sin convertir');
});

prueba('sin token isConfigured() es false', function () {
  tp.clearCache();
  ok(tp.isConfigured() === false, 'no deberia estar configurado sin token');
});

// ---------- conversion normal ----------

prueba('convierte el link y lo cachea', async function () {
  tp.clearCache();
  process.env.TRAVELPAYOUTS_API_TOKEN = 'tok-123';
  let calls = 0;
  tp.setFetch(fakeFetch([function () { calls++; return { ok: true, status: 200, json: async () => okBody([{ url: 'https://www.booking.com/hotel/x', code: 'success', partner_url: 'https://tp.st/abc' }]) }; }]));
  const original = 'https://www.booking.com/hotel/br/x.html';
  const first = await tp.toPartnerUrl(original);
  ok(first === 'https://tp.st/abc', 'devuelve el partner_url');
  const second = await tp.toPartnerUrl(original);
  ok(second === 'https://tp.st/abc', 'el segundo llamado tambien devuelve el link convertido');
  ok(calls === 1, 'la segunda vez tiene que salir de la cache, no volver a pedir: calls=' + calls);
});

prueba('agrupa en lotes de a 10 y respeta el limite de la API', async function () {
  tp.clearCache();
  tp.setFetch(fakeFetch([function (url, options) {
    const enviados = JSON.parse(options.body).links;
    ok(enviados.length <= 10, 'no puede mandar mas de 10 links por pedido');
    return { ok: true, status: 200, json: async () => okBody(enviados.map(function (l) { return { url: l.url, code: 'success', partner_url: 'https://tp.st/' + encodeURIComponent(l.url).slice(-6) }; })) };
  }]));
  const urls = [];
  for (let i = 0; i < 25; i++) urls.push('https://www.booking.com/hotel/h' + i);
  const out = await tp.toPartnerUrls(urls);
  ok(out.size === 25, 'tiene que convertir los 25, no solo los 10 primeros');
  urls.forEach(function (u) { ok(out.get(u), 'falta convertir ' + u); });
});

prueba('deduplica: el mismo link una sola vez', async function () {
  tp.clearCache();
  let calls = 0;
  tp.setFetch(fakeFetch([function () { calls++; return { ok: true, status: 200, json: async () => okBody([{ url: 'https://www.booking.com/hotel/dup', code: 'success', partner_url: 'https://tp.st/dup' }]) }; }]));
  const dup = ['https://www.booking.com/hotel/dup', 'https://www.booking.com/hotel/dup', 'https://www.booking.com/hotel/dup'];
  await tp.toPartnerUrls(dup);
  ok(calls === 1, 'tres veces el mismo link deberian ser una request, no tres: calls=' + calls);
});

// ---------- filtrado ----------

prueba('ignora links que no son de Booking', async function () {
  tp.clearCache();
  tp.setFetch(fakeFetch([okBody([])]));
  const otro = 'https://www.aviasales.com/somewhere';
  const out = await tp.toPartnerUrl(otro);
  ok(out === otro, 'un link de otro sitio no se toca');
});

prueba('rechaza Booking con http', async function () {
  tp.clearCache();
  const http = 'http://www.booking.com/hotel/x';
  const out = await tp.toPartnerUrl(http);
  ok(out === http, 'sin https no deberia convertir');
});

// ---------- fallos: nunca rompen la busqueda ----------

prueba('si la API falla, devuelve el link original', async function () {
  tp.clearCache();
  tp.setFetch(fakeFetch([{ status: 500, body: { code: 'error', error: 'boom' } }]));
  const original = 'https://www.booking.com/hotel/falla';
  const out = await tp.toPartnerUrl(original);
  ok(out === original, 'un 500 no puede romper el boton de reservar');
});

prueba('si el token esta mal, no explota', async function () {
  tp.clearCache();
  tp.setFetch(fakeFetch([{ status: 401, body: { code: 'incorrect_request_body', error: 'invalid token' } }]));
  const original = 'https://www.booking.com/hotel/401';
  const out = await tp.toPartnerUrl(original);
  ok(out === original, 'un 401 deberia caer al link normal');
});

prueba('un link que falla no arrastra a los demas', async function () {
  tp.clearCache();
  tp.setFetch(fakeFetch([function (url, options) {
    const enviados = JSON.parse(options.body).links;
    return { ok: true, status: 200, json: async () => okBody(enviados.map(function (l) {
      return l.url.includes('malo') ? { url: l.url, code: 'failed', message: 'no se pudo', partner_url: '' } : { url: l.url, code: 'success', partner_url: 'https://tp.st/ok' };
    })) };
  }]));
  const bueno = 'https://www.booking.com/hotel/bueno';
  const malo = 'https://www.booking.com/hotel/malo';
  const out = await tp.toPartnerUrls([bueno, malo]);
  ok(out.get(bueno) === 'https://tp.st/ok', 'el bueno se convierte');
  ok(out.get(malo) === malo, 'el malo vuelve como estaba');
});

prueba('si no hay body valido, no rompe', async function () {
  tp.clearCache();
  tp.setFetch(fakeFetch([{ status: 200, body: null }]));
  const original = 'https://www.booking.com/hotel/sinbody';
  const out = await tp.toPartnerUrl(original);
  ok(out === original, 'una respuesta rara cae al link original');
});

prueba('el lote entero falla sin romper', async function () {
  tp.clearCache();
  tp.setFetch(fakeFetch([{ status: 400, body: { code: 'incorrect_request_body', error: 'invalid trs' } }]));
  const urls = ['https://www.booking.com/a', 'https://www.booking.com/b'];
  const out = await tp.toPartnerUrls(urls);
  urls.forEach(function (u) { ok(out.get(u) === u, 'tiene que devolver el original para ' + u); });
});

(async function () {
  let fails = 0;
  for (const p of pruebas) {
    try { await p.fn(); console.log('  ok  ' + p.name); }
    catch (e) { console.log('  FALLA  ' + p.name + '\n         ' + e.message); fails++; }
  }
  delete process.env.TRAVELPAYOUTS_API_TOKEN;
  console.log(fails ? '\n' + fails + ' prueba(s) fallaron' : '\nTodo OK (' + pruebas.length + ' pruebas)');
  process.exit(fails ? 1 : 0);
})();
