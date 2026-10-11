/*
 * Notificaciones del panel /admin en el celular (Web Push).
 *
 * Cada dispositivo donde se activan los avisos guarda su "suscripcion" (la direccion de push que da el navegador).
 * Cuando entra un mensaje de WhatsApp o un pedido nuevo, el server le manda a cada suscripcion un push VACIO,
 * firmado con VAPID. Vacio a proposito: un push con contenido hay que cifrarlo por dispositivo, y uno vacio no. Al
 * recibirlo, el service worker del panel (public/admin/sw.js) le pide el resumen a /api/admin/push/resumen con la
 * cookie de la sesion y muestra la notificacion. Asi el texto de los mensajes nunca pasa por el servicio de push
 * (Google, Apple, Mozilla) y si la sesion vencio solo se ve un aviso generico.
 *
 * Variables: VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (base64url, par P-256; se generan una vez con
 * `node -e "require('./lib/push').generarClaves()"`) y VAPID_SUBJECT (mailto: de contacto, opcional).
 * Las suscripciones van en la tabla admin_push (supabase_push.sql) o, sin Supabase, en data/_trabajo/push.json.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARCHIVO = path.join(__dirname, '..', 'data', '_trabajo', 'push.json');

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const t = await r.text();
  if (!r.ok) { const e = new Error('Supabase respondio HTTP ' + r.status + ': ' + t.slice(0, 200)); e.status = 502; throw e; }
  try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
}
function leerArchivo() { try { return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); } catch (e) { return { subs: [] }; } }
function escribirArchivo(db) { fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true }); fs.writeFileSync(ARCHIVO, JSON.stringify(db, null, 2)); }

/* ---------- claves VAPID ---------- */
function claves() {
  const pub = String(process.env.VAPID_PUBLIC_KEY || '').trim(), priv = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pub || !priv) return null;
  const punto = Buffer.from(pub, 'base64url');
  if (punto.length !== 65 || punto[0] !== 4) return null;
  try {
    const key = crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: priv, x: punto.subarray(1, 33).toString('base64url'), y: punto.subarray(33).toString('base64url') } });
    return { publica: pub, privada: key };
  } catch (e) { return null; }
}
function generarClaves() {
  const k = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = k.privateKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
  console.log('VAPID_PUBLIC_KEY=' + pub + '\nVAPID_PRIVATE_KEY=' + jwk.d);
  return { publica: pub, privada: jwk.d };
}
function configurado() { return !!claves(); }
function clavePublica() { const c = claves(); return c ? c.publica : ''; }

/* JWT de VAPID (ES256) para el origen del servicio de push. */
function firmaVapid(endpoint, c) {
  const aud = new URL(endpoint).origin;
  const sub = String(process.env.VAPID_SUBJECT || 'mailto:admin@cuantosale.uy').trim();
  const cab = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const cuerpo = Buffer.from(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: sub })).toString('base64url');
  const firma = crypto.sign('sha256', Buffer.from(cab + '.' + cuerpo), { key: c.privada, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return 'vapid t=' + cab + '.' + cuerpo + '.' + firma + ', k=' + c.publica;
}

/* ---------- suscripciones ---------- */
function endpointValido(u) {
  try { const x = new URL(String(u || '')); return x.protocol === 'https:' && String(u).length < 1000; } catch (e) { return false; }
}
async function suscribir(sub, dispositivo) {
  if (!sub || !endpointValido(sub.endpoint)) { const e = new Error('Suscripción inválida.'); e.status = 400; throw e; }
  const fila = { endpoint: String(sub.endpoint), dispositivo: String(dispositivo || '').slice(0, 120), created_at: new Date().toISOString() };
  if (supa()) { await rest('POST', 'admin_push?on_conflict=endpoint', fila, { Prefer: 'resolution=merge-duplicates,return=minimal' }); return; }
  if (process.env.VERCEL) { const e = new Error('Falta configurar Supabase.'); e.status = 503; throw e; }
  const db = leerArchivo(); db.subs = db.subs.filter(function (s) { return s.endpoint !== fila.endpoint; }).concat([fila]); escribirArchivo(db);
}
async function baja(endpoint) {
  if (!endpointValido(endpoint)) return;
  if (supa()) { await rest('DELETE', 'admin_push?endpoint=eq.' + encodeURIComponent(endpoint)); return; }
  if (process.env.VERCEL) return;
  const db = leerArchivo(); db.subs = db.subs.filter(function (s) { return s.endpoint !== endpoint; }); escribirArchivo(db);
}
async function todas() {
  if (supa()) return (await rest('GET', 'admin_push?select=endpoint')) || [];
  if (process.env.VERCEL) return [];
  return leerArchivo().subs;
}

/* Avisa a todos los dispositivos. Nunca tira: un aviso que no sale no puede romper el webhook ni la reserva.
   Las suscripciones que el servicio da por muertas (404/410: se desinstalo la app o se revoco el permiso) se borran. */
async function avisar() {
  const c = claves(); if (!c) return 0;
  let subs;
  try { subs = await todas(); } catch (e) { console.warn('[push] no se pudieron leer las suscripciones:', e.message); return 0; }
  let ok = 0;
  await Promise.all(subs.map(async function (s) {
    try {
      const r = await fetch(s.endpoint, { method: 'POST', headers: { Authorization: firmaVapid(s.endpoint, c), TTL: '86400', Urgency: 'high', 'Content-Length': '0' } });
      if (r.status === 404 || r.status === 410) await baja(s.endpoint).catch(function () {});
      else if (r.ok) ok++;
      else console.warn('[push] el servicio respondio ' + r.status + ': ' + (await r.text().catch(function () { return ''; })).slice(0, 120));
    } catch (e) { console.warn('[push] no se pudo avisar:', e.message); }
  }));
  return ok;
}

module.exports = { configurado: configurado, clavePublica: clavePublica, generarClaves: generarClaves, suscribir: suscribir, baja: baja, avisar: avisar };
