'use strict';
/* Intentos fallidos de login del panel /admin, contados por IP (tabla admin_login_fallos, sql/supabase_admin_login.sql).

   POR QUE EN SUPABASE
   En Vercel cada instancia tenia su propio Map: con varias instancias vivas el tope se multiplicaba. En la base la
   cuenta es una sola. No se guarda la IP, solo su sha256.

   NUNCA ROMPE EL LOGIN
   La memoria cuenta siempre. Supabase se suma cuando esta configurado; si falla (caido, o la tabla todavia no se
   creo) se avisa una vez en el log y se sigue solo con la memoria, que es como andaba antes.

   crear({ max, ventanaMs }) -> { bloqueado(ip), anotarFallo(ip), limpiar(ip) }   (las tres async) */
const crypto = require('crypto');

let fetchFn = function () { return fetch.apply(null, arguments); };

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function hashIp(ip) { return crypto.createHash('sha256').update('cs-login|' + String(ip || '')).digest('hex'); }

function crear(opts) {
  const MAX = opts.max, VENTANA_MS = opts.ventanaMs;
  const memoria = new Map();
  let avisado = false;

  function avisar(e) {
    if (avisado) return;
    avisado = true;
    console.warn('[login-intentos] Supabase no disponible, cuento solo en memoria: ' + e.message
      + (/admin_login_fallo/.test(e.message) ? ' (correr sql/supabase_admin_login.sql)' : ''));
  }
  async function pedir(s, ruta, init) {
    const r = await fetchFn(s.url + ruta, Object.assign({}, init, {
      headers: Object.assign({ apikey: s.key, Authorization: 'Bearer ' + s.key }, (init && init.headers) || {})
    }));
    const texto = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + texto.slice(0, 160));
    return texto ? JSON.parse(texto) : null;
  }

  function nMemoria(ip) {
    const f = memoria.get(ip);
    if (f && Date.now() > f.reset) { memoria.delete(ip); return 0; }
    return f ? f.n : 0;
  }

  async function bloqueado(ip) {
    if (nMemoria(ip) >= MAX) return true;
    const s = supa();
    if (!s) return false;
    try {
      const filas = await pedir(s, '/rest/v1/admin_login_fallos?select=n,reset_en&ip_hash=eq.' + hashIp(ip));
      const f = filas && filas[0];
      return !!f && Date.parse(f.reset_en) > Date.now() && f.n >= MAX;
    } catch (e) { avisar(e); return false; }
  }

  async function anotarFallo(ip) {
    const f = memoria.get(ip);
    if (!f || Date.now() > f.reset) memoria.set(ip, { n: 1, reset: Date.now() + VENTANA_MS });
    else f.n++;
    if (memoria.size > 5000) memoria.clear();
    const s = supa();
    if (!s) return;
    try {
      await pedir(s, '/rest/v1/rpc/admin_login_fallo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ip_hash: hashIp(ip), p_ventana_seg: Math.round(VENTANA_MS / 1000) })
      });
    } catch (e) { avisar(e); }
  }

  async function limpiar(ip) {
    memoria.delete(ip);
    const s = supa();
    if (!s) return;
    try { await pedir(s, '/rest/v1/admin_login_fallos?ip_hash=eq.' + hashIp(ip), { method: 'DELETE' }); }
    catch (e) { avisar(e); }
  }

  return { bloqueado: bloqueado, anotarFallo: anotarFallo, limpiar: limpiar };
}

module.exports = { crear: crear, hashIp: hashIp, setFetch: function (fn) { fetchFn = fn; } };
