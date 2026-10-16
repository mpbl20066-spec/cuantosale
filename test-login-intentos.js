'use strict';
/*
 * Pruebas del contador de intentos de login del panel (lib/login-intentos.js).
 *
 *   node test-login-intentos.js
 *
 * Supabase es un fetch falso que imita la tabla admin_login_fallos y la RPC admin_login_fallo
 * (sql/supabase_admin_login.sql): no sale a la red.
 */
const assert = require('assert');

delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const li = require('./lib/login-intentos');

const lista = [];
function t(nombre, fn) { lista.push([nombre, fn]); }
const OPC = { max: 3, ventanaMs: 60 * 1000 };

/* Supabase falso: misma logica que la funcion SQL (ventana vencida -> arranca en 1). */
function supabaseFalso() {
  const filas = new Map();
  const db = { filas: filas, caido: false, pedidos: 0 };
  db.fetch = async function (url, init) {
    db.pedidos++;
    if (db.caido) return { ok: false, status: 503, text: async function () { return 'caido'; } };
    const u = new URL(url), metodo = (init && init.method) || 'GET';
    const resp = function (obj) { return { ok: true, status: 200, text: async function () { return obj == null ? '' : JSON.stringify(obj); } }; };
    if (u.pathname === '/rest/v1/rpc/admin_login_fallo') {
      const b = JSON.parse(init.body), ahora = Date.now(), f = filas.get(b.p_ip_hash);
      if (!f || f.reset_en < ahora) filas.set(b.p_ip_hash, { n: 1, reset_en: ahora + b.p_ventana_seg * 1000 });
      else f.n++;
      return resp(filas.get(b.p_ip_hash).n);
    }
    const hash = String(u.searchParams.get('ip_hash') || '').replace(/^eq\./, '');
    if (metodo === 'DELETE') { filas.delete(hash); return resp(null); }
    const f = filas.get(hash);
    return resp(f ? [{ n: f.n, reset_en: new Date(f.reset_en).toISOString() }] : []);
  };
  return db;
}
function conSupabase(db) {
  process.env.SUPABASE_URL = 'https://falso.supabase.co'; process.env.SUPABASE_SERVICE_KEY = 'clave';
  li.setFetch(db.fetch);
}
function sinSupabase() { delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; }

t('sin Supabase cuenta en memoria y bloquea al llegar al tope', async function () {
  sinSupabase();
  const c = li.crear(OPC);
  for (let i = 0; i < 2; i++) await c.anotarFallo('1.1.1.1');
  assert.strictEqual(await c.bloqueado('1.1.1.1'), false);
  await c.anotarFallo('1.1.1.1');
  assert.strictEqual(await c.bloqueado('1.1.1.1'), true);
  assert.strictEqual(await c.bloqueado('2.2.2.2'), false, 'otra IP no queda bloqueada');
});

t('un login bueno limpia la cuenta', async function () {
  sinSupabase();
  const c = li.crear(OPC);
  for (let i = 0; i < 3; i++) await c.anotarFallo('1.1.1.1');
  await c.limpiar('1.1.1.1');
  assert.strictEqual(await c.bloqueado('1.1.1.1'), false);
});

t('con Supabase la cuenta se comparte entre instancias', async function () {
  const db = supabaseFalso(); conSupabase(db);
  const a = li.crear(OPC), b = li.crear(OPC);   // dos instancias de Vercel
  await a.anotarFallo('9.9.9.9'); await b.anotarFallo('9.9.9.9');
  assert.strictEqual(await a.bloqueado('9.9.9.9'), false);
  await b.anotarFallo('9.9.9.9');
  assert.strictEqual(await a.bloqueado('9.9.9.9'), true, 'la instancia a ve los fallos de la b');
  await b.limpiar('9.9.9.9');
  assert.strictEqual(await a.bloqueado('9.9.9.9'), false, 'el login bueno en b limpia la cuenta compartida');
});

t('en la base se guarda el hash, nunca la IP', async function () {
  const db = supabaseFalso(); conSupabase(db);
  await li.crear(OPC).anotarFallo('200.40.1.2');
  const claves = Array.from(db.filas.keys());
  assert.deepStrictEqual(claves, [li.hashIp('200.40.1.2')]);
  assert.ok(!/200\.40/.test(claves[0]));
});

t('la ventana vencida en la base no bloquea', async function () {
  const db = supabaseFalso(); conSupabase(db);
  db.filas.set(li.hashIp('5.5.5.5'), { n: 10, reset_en: Date.now() - 1000 });
  assert.strictEqual(await li.crear(OPC).bloqueado('5.5.5.5'), false);
});

t('con Supabase caido el login sigue andando y la memoria cuenta igual', async function () {
  const db = supabaseFalso(); db.caido = true; conSupabase(db);
  const avisos = [], warn = console.warn;
  console.warn = function (m) { avisos.push(m); };
  try {
    const c = li.crear(OPC);
    assert.strictEqual(await c.bloqueado('7.7.7.7'), false);
    for (let i = 0; i < 3; i++) await c.anotarFallo('7.7.7.7');
    assert.strictEqual(await c.bloqueado('7.7.7.7'), true, 'la memoria bloquea aunque la base no responda');
    await c.limpiar('7.7.7.7');
  } finally { console.warn = warn; }
  assert.strictEqual(avisos.length, 1, 'avisa una sola vez, no en cada intento');
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
