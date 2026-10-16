'use strict';
/*
 * Pruebas de la revision de salud (lib/salud.js) y del respaldo diario (lib/respaldo.js).
 *
 *   node test-salud.js
 *
 * Supabase (base y Storage) y Resend son un fetch falso: no sale a la red ni manda mails.
 */
const assert = require('assert');

process.env.SUPABASE_URL = 'https://falso.supabase.co'; process.env.SUPABASE_SERVICE_KEY = 'clave';
process.env.RESEND_API_KEY = 're_falso'; process.env.ADMIN_NOTIFY_EMAIL = 'yo@ejemplo.com';
process.env.IGNAV_API_KEY = 'ig'; process.env.BOOKING_API_KEY = 'bk';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const salud = require('./lib/salud');
const respaldo = require('./lib/respaldo');

/* Supabase falso: Storage en un Map y tablas en memoria. */
function falso(opts) {
  opts = opts || {};
  const S = { archivos: new Map(), bucket: !!opts.bucket, mails: [], tablas: opts.tablas || {}, pedidosCaido: false };
  const resp = function (status, cuerpo) {
    const txt = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    return { ok: status < 400, status: status, text: async function () { return txt; }, json: async function () { return JSON.parse(txt); } };
  };
  S.fetch = async function (url, init) {
    init = init || {};
    const u = new URL(url), m = init.method || 'GET', p = decodeURIComponent(u.pathname);
    if (u.hostname === 'api.resend.com') { S.mails.push(JSON.parse(init.body)); return resp(200, { id: 'm1' }); }
    if (p === '/storage/v1/bucket' && m === 'POST') { S.bucket = true; return resp(200, { name: 'interno' }); }
    if (p.indexOf('/storage/v1/object/list/interno') === 0) {
      if (!S.bucket) return resp(400, { error: 'Bucket not found' });
      const pref = JSON.parse(init.body).prefix, vistos = new Map();
      S.archivos.forEach(function (v, k) {
        if (k.indexOf(pref) !== 0) return;
        const resto = k.slice(pref.length), i = resto.indexOf('/');
        if (i < 0) vistos.set(resto, { name: resto, id: 'f' }); else vistos.set(resto.slice(0, i), { name: resto.slice(0, i), id: null });
      });
      return resp(200, Array.from(vistos.values()));
    }
    if (p === '/storage/v1/object/interno' && m === 'DELETE') { JSON.parse(init.body).prefixes.forEach(function (k) { S.archivos.delete(k); }); return resp(200, []); }
    if (p.indexOf('/storage/v1/object/interno/') === 0) {
      const ruta = p.slice('/storage/v1/object/interno/'.length);
      if (m === 'POST') { if (!S.bucket) return resp(400, { error: 'Bucket not found' }); S.archivos.set(ruta, init.body); return resp(200, {}); }
      return S.archivos.has(ruta) ? resp(200, S.archivos.get(ruta)) : resp(400, { error: 'not_found' });
    }
    if (p === '/rest/v1/') {
      const defs = {};
      Object.keys(S.tablas).forEach(function (t) { defs[t] = { properties: { id: { description: 'Note:\nThis is a Primary Key.<pk/>' }, x: {} } }; });
      return resp(200, { definitions: defs });
    }
    if (p.indexOf('/rest/v1/') === 0) {
      const t = p.slice('/rest/v1/'.length);
      if (t === 'pedidos' && S.pedidosCaido) return resp(503, 'caido');
      const filas = S.tablas[t] || [], lim = Number(u.searchParams.get('limit')) || 1000, off = Number(u.searchParams.get('offset')) || 0;
      return resp(200, filas.slice(off, off + lim));
    }
    return resp(404, 'no simulado: ' + p);
  };
  salud.setFetch(S.fetch); respaldo.setFetch(S.fetch); global.fetch = S.fetch;
  return S;
}
function marcaVieja(S, nombre, horas, ok, detalle) {
  S.archivos.set('estado/cron-' + nombre + '.json', JSON.stringify({ fecha: new Date(Date.now() - horas * 3600000).toISOString(), ok: ok, detalle: detalle || null }));
}
function todosBien(S) { salud.CRONS.forEach(function (c) { marcaVieja(S, c.nombre, 2, true); }); }

const lista = [];
function t(nombre, fn) { lista.push([nombre, fn]); }

t('marcar crea el bucket la primera vez y guarda la marca', async function () {
  const S = falso({ bucket: false });
  await salud.marcar('mails', true);
  assert.ok(S.bucket, 'creo el bucket');
  const m = JSON.parse(S.archivos.get('estado/cron-mails.json'));
  assert.strictEqual(m.ok, true);
  assert.ok(Date.now() - Date.parse(m.fecha) < 5000);
});

t('marcar nunca tira, aunque Storage falle', async function () {
  falso({ bucket: true });
  salud.setFetch(async function () { throw new Error('sin red'); });
  const warn = console.warn; console.warn = function () {};
  try { await salud.marcar('mails', true); } finally { console.warn = warn; }
});

t('con todo bien no manda mail', async function () {
  const S = falso({ bucket: true, tablas: { pedidos: [] } });
  todosBien(S);
  const r = await salud.revisar();
  assert.strictEqual(r.ok, true, JSON.stringify(r.chequeos.filter(function (c) { return !c.ok; })));
  assert.strictEqual(S.mails.length, 0);
});

t('un cron que no corre hace mas de 26 h es un problema y sale mail', async function () {
  const S = falso({ bucket: true, tablas: { pedidos: [] } });
  todosBien(S); marcaVieja(S, 'alertas', 30, true);
  const r = await salud.revisar();
  assert.strictEqual(r.problemas, 1);
  assert.strictEqual(r.avisado, true);
  assert.strictEqual(S.mails.length, 1);
  assert.deepStrictEqual(S.mails[0].to, ['yo@ejemplo.com']);
  assert.ok(/Alertas de precio/.test(S.mails[0].subject) && /No corre hace 30 h/.test(S.mails[0].html));
});

t('un cron que nunca corrio y uno que fallo se reportan', async function () {
  const S = falso({ bucket: true, tablas: { pedidos: [] } });
  todosBien(S); S.archivos.delete('estado/cron-respaldo.json'); marcaVieja(S, 'mails', 1, false, { error: 'Resend 500' });
  const r = await salud.revisar();
  const textos = r.chequeos.filter(function (c) { return !c.ok; }).map(function (c) { return c.texto; }).join(' | ');
  assert.ok(/nunca/.test(textos) && /Resend 500/.test(textos), textos);
});

t('si fallaron todos los pedidos de Ignav avisa la key o el saldo', async function () {
  const S = falso({ bucket: true, tablas: { pedidos: [] } });
  todosBien(S); marcaVieja(S, 'precalentar', 1, true, { vuelos: { pedidas: 6, fallidas: 6 }, guias: { pedidas: 0, fallidas: 0 } });
  const r = await salud.revisar();
  const ig = r.chequeos.filter(function (c) { return c.nombre === 'Ignav responde'; })[0];
  assert.ok(ig && !ig.ok && /saldo/.test(ig.texto));
});

t('Supabase caido y una key faltante se reportan', async function () {
  const S = falso({ bucket: true, tablas: { pedidos: [] } });
  todosBien(S); S.pedidosCaido = true; delete process.env.BOOKING_API_KEY;
  try {
    const malos = (await salud.revisar()).chequeos.filter(function (c) { return !c.ok; }).map(function (c) { return c.nombre; });
    assert.deepStrictEqual(malos.sort(), ['Booking (hoteles)', 'Supabase']);
  } finally { process.env.BOOKING_API_KEY = 'bk'; }
});

t('el respaldo baja todas las tablas paginando, salvo los caches', async function () {
  const muchas = []; for (let i = 0; i < 2500; i++) muchas.push({ id: i });
  const S = falso({ bucket: false, tablas: { pedidos: [{ id: 1 }], tours: muchas, vuelos_cache: [{ id: 9 }] } });
  const r = await respaldo.respaldar();
  assert.deepStrictEqual(r.errores, {});
  assert.strictEqual(r.tablas, 2);
  assert.strictEqual(r.filas, 2501);
  const hoy = r.carpeta.split('/')[1];
  assert.strictEqual(JSON.parse(S.archivos.get('respaldos/' + hoy + '/tours.json')).length, 2500, 'pagino de a 1000');
  assert.ok(!S.archivos.has('respaldos/' + hoy + '/vuelos_cache.json'), 'el cache no se respalda');
  assert.ok(S.archivos.has('respaldos/' + hoy + '/_resumen.json'));
});

t('el respaldo borra las carpetas de mas de 30 dias y deja las nuevas', async function () {
  const S = falso({ bucket: true, tablas: { pedidos: [] } });
  S.archivos.set('respaldos/2020-01-01/pedidos.json', '[]'); S.archivos.set('respaldos/2020-01-01/_resumen.json', '{}');
  const ayer = new Date(Date.now() - 27 * 3600000).toISOString().slice(0, 10);
  S.archivos.set('respaldos/' + ayer + '/pedidos.json', '[]');
  const r = await respaldo.respaldar();
  assert.strictEqual(r.podadas, 1);
  assert.ok(!S.archivos.has('respaldos/2020-01-01/pedidos.json'));
  assert.ok(S.archivos.has('respaldos/' + ayer + '/pedidos.json'));
});

t('una tabla que falla queda en errores y el resto se respalda igual', async function () {
  const S = falso({ bucket: true, tablas: { pedidos: [], tours: [{ id: 1 }] } });
  const base = S.fetch;
  respaldo.setFetch(function (url, init) { return /\/rest\/v1\/tours/.test(url) ? Promise.resolve({ ok: false, status: 403, text: async function () { return 'permission denied'; } }) : base(url, init); });
  const r = await respaldo.respaldar();
  assert.ok(/403/.test(r.errores.tours));
  assert.strictEqual(r.tablas, 1);
});

(async function () {
  let ok = 0;
  for (const [nombre, fn] of lista) {
    try { await fn(); ok++; console.log('  ok  ' + nombre); }
    catch (e) { console.log('  FALLA  ' + nombre + '\n        ' + e.message); }
  }
  console.log(ok + '/' + lista.length + ' pruebas ok');
  process.exit(ok === lista.length ? 0 : 1);
})();
