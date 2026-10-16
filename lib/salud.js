'use strict';
/* Salud de produccion: cada cron anota como le fue, y un cron diario revisa todo y avisa por mail SOLO si algo falla.

   POR QUE
   Los errores quedaban en los logs de Vercel y nadie los miraba. Si un cron dejaba de correr o se acababa el saldo de
   Ignav, la web seguia andando pero sin precios reales, y nadie se enteraba.

   DONDE SE GUARDA
   Supabase Storage, bucket privado "interno" (lo crea este modulo la primera vez): estado/cron-<nombre>.json con
   { fecha, ok, detalle }. Un archivo por cron, asi dos crons nunca se pisan. Sin tabla nueva ni SQL que correr.

   GET /api/salud/revisar   (cron de Vercel, CRON_SECRET)  -> { ok, problemas, chequeos, avisado }
   El mail va a ADMIN_NOTIFY_EMAIL, o a RESERVAS_EMAIL si no esta (igual que la alerta de cotizacion de lib/reglas.js).

   marcar() nunca tira: si Storage falla, el cron que lo llama sigue igual. */

const BUCKET = 'interno';
const HORA = 3600 * 1000;

/* Que crons se esperan y cada cuanto. Un cron diario tiene 26 h de margen: si se atrasa un rato no es un problema. */
const CRONS = [
  { nombre: 'precalentar', titulo: 'Precalentar vuelos', maxHoras: 26 },
  { nombre: 'alertas', titulo: 'Alertas de precio', maxHoras: 26 },
  { nombre: 'mails', titulo: 'Mails automaticos al cliente', maxHoras: 26 },
  { nombre: 'respaldo', titulo: 'Respaldo de la base', maxHoras: 26 }
];

let fetchFn = function () { return fetch.apply(null, arguments); };

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function cabeceras(s, extra) { return Object.assign({ apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}); }

/* ---------- Storage (bucket privado "interno") ---------- */
async function crearBucket(s) {
  const r = await fetchFn(s.url + '/storage/v1/bucket', {
    method: 'POST', headers: cabeceras(s, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false })
  });
  // 409 / "already exists": lo creo otra instancia al mismo tiempo, esta bien.
  if (!r.ok && !/already exists|Duplicate/i.test(await r.text())) throw new Error('No se pudo crear el bucket ' + BUCKET + ': HTTP ' + r.status);
}
async function subir(ruta, cuerpo, tipo) {
  const s = supa();
  if (!s) throw new Error('Sin Supabase');
  const intento = function () {
    return fetchFn(s.url + '/storage/v1/object/' + BUCKET + '/' + ruta, {
      method: 'POST', headers: cabeceras(s, { 'Content-Type': tipo || 'application/json', 'x-upsert': 'true' }), body: cuerpo
    });
  };
  let r = await intento();
  if (!r.ok) {
    const texto = await r.text();
    if (!/Bucket not found/i.test(texto)) throw new Error('Storage ' + ruta + ': HTTP ' + r.status + ' ' + texto.slice(0, 120));
    await crearBucket(s);
    r = await intento();
    if (!r.ok) throw new Error('Storage ' + ruta + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  }
}
async function bajar(ruta) {
  const s = supa();
  if (!s) throw new Error('Sin Supabase');
  const r = await fetchFn(s.url + '/storage/v1/object/' + BUCKET + '/' + ruta, { headers: cabeceras(s) });
  if (r.status === 400 || r.status === 404) return null;   // Storage responde 400 "not_found" cuando no existe
  if (!r.ok) throw new Error('Storage ' + ruta + ': HTTP ' + r.status);
  return r.text();
}
/* Lista un "directorio": devuelve [{ name, id }] (id null = subcarpeta). */
async function listar(prefijo) {
  const s = supa();
  if (!s) throw new Error('Sin Supabase');
  const r = await fetchFn(s.url + '/storage/v1/object/list/' + BUCKET, {
    method: 'POST', headers: cabeceras(s, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefix: prefijo, limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  });
  if (!r.ok) {
    const texto = await r.text();
    if (/Bucket not found/i.test(texto)) return [];
    throw new Error('Storage list ' + prefijo + ': HTTP ' + r.status);
  }
  return r.json();
}
async function borrar(rutas) {
  const s = supa();
  if (!s || !rutas.length) return;
  const r = await fetchFn(s.url + '/storage/v1/object/' + BUCKET, {
    method: 'DELETE', headers: cabeceras(s, { 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: rutas })
  });
  if (!r.ok) throw new Error('Storage delete: HTTP ' + r.status);
}

/* ---------- Marcas de los crons ---------- */
async function marcar(nombre, ok, detalle) {
  try {
    await subir('estado/cron-' + nombre + '.json', JSON.stringify({ fecha: new Date().toISOString(), ok: !!ok, detalle: detalle || null }));
  } catch (e) { console.warn('[salud] no se pudo anotar el cron ' + nombre + ': ' + e.message); }
}
async function leerMarca(nombre) {
  const t = await bajar('estado/cron-' + nombre + '.json');
  return t ? JSON.parse(t) : null;
}

/* ---------- Revision diaria ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

async function chequear() {
  const chequeos = [];
  const agregar = function (nombre, ok, texto) { chequeos.push({ nombre: nombre, ok: ok, texto: texto }); };
  const s = supa();

  // 1. Supabase responde
  if (!s) agregar('Supabase', false, 'Faltan SUPABASE_URL o la service key en el servidor.');
  else {
    try {
      const r = await fetchFn(s.url + '/rest/v1/pedidos?select=id&limit=1', { headers: cabeceras(s) });
      agregar('Supabase', r.ok, r.ok ? 'Responde.' : 'La base respondio HTTP ' + r.status + ' al leer pedidos.');
    } catch (e) { agregar('Supabase', false, 'No responde: ' + e.message); }
  }

  // 2. Proveedores configurados
  agregar('Ignav (vuelos)', !!String(process.env.IGNAV_API_KEY || '').trim(), String(process.env.IGNAV_API_KEY || '').trim() ? 'Configurado.' : 'Falta IGNAV_API_KEY: la web no muestra vuelos.');
  agregar('Booking (hoteles)', !!String(process.env.BOOKING_API_KEY || '').trim(), String(process.env.BOOKING_API_KEY || '').trim() ? 'Configurado.' : 'Falta BOOKING_API_KEY: la web no muestra hoteles reales.');

  // 3. Cada cron corrio a tiempo y salio bien
  const ahora = Date.now();
  let marcas = {};
  if (s) {
    await Promise.all(CRONS.map(async function (c) {
      try { marcas[c.nombre] = await leerMarca(c.nombre); }
      catch (e) { marcas[c.nombre] = { error: e.message }; }
    }));
  }
  CRONS.forEach(function (c) {
    const m = marcas[c.nombre];
    if (!s) return agregar(c.titulo, false, 'Sin Supabase no se puede saber si corrio.');
    if (!m) return agregar(c.titulo, false, 'No hay registro de que haya corrido nunca.');
    if (m.error) return agregar(c.titulo, false, 'No se pudo leer su registro: ' + m.error);
    const horas = Math.round((ahora - Date.parse(m.fecha)) / HORA);
    if (horas > c.maxHoras) return agregar(c.titulo, false, 'No corre hace ' + horas + ' h (la ultima vez: ' + m.fecha.slice(0, 16).replace('T', ' ') + ' UTC).');
    if (!m.ok) return agregar(c.titulo, false, 'La ultima corrida fallo: ' + ((m.detalle && m.detalle.error) || 'sin detalle'));
    agregar(c.titulo, true, 'Corrio hace ' + horas + ' h.');
  });

  // 4. Ignav de verdad: si el ultimo precalentar pidio vuelos y fallaron todos, es la key o el saldo
  const p = marcas.precalentar && marcas.precalentar.detalle;
  if (p && p.vuelos) {
    const g = p.guias || {};
    const pedidas = (p.vuelos.pedidas || 0) + (g.pedidas || 0), fallidas = (p.vuelos.fallidas || 0) + (g.fallidas || 0);
    if (pedidas > 0 && fallidas >= pedidas) agregar('Ignav responde', false, 'En el ultimo precalentar fallaron los ' + pedidas + ' pedidos de vuelos: revisar la key o el saldo de Ignav.');
    else if (pedidas > 0) agregar('Ignav responde', true, (pedidas - fallidas) + ' de ' + pedidas + ' pedidos bien en el ultimo precalentar.');
  }
  return chequeos;
}

async function avisar(problemas) {
  const para = String(process.env.ADMIN_NOTIFY_EMAIL || process.env.RESERVAS_EMAIL || '').trim();
  if (!para) return { avisado: false, motivo: 'sin ADMIN_NOTIFY_EMAIL ni RESERVAS_EMAIL' };
  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#101828;max-width:560px">' +
    '<h2 style="margin:0 0 12px">' + (problemas.length === 1 ? 'Hay 1 problema' : 'Hay ' + problemas.length + ' problemas') + ' en CuántoSale</h2>' +
    '<ul style="padding-left:18px;margin:0 0 14px">' + problemas.map(function (c) { return '<li style="margin:0 0 8px"><b>' + esc(c.nombre) + ':</b> ' + esc(c.texto) + '</li>'; }).join('') + '</ul>' +
    '<p style="color:#475467;font-size:13px">Este mail sale solo cuando algo falla (revision diaria, lib/salud.js). Los detalles de cada error estan en los logs de Vercel.</p></div>';
  await require('./mail-cliente')._piezas.enviar(para, { asunto: 'CuántoSale: ' + problemas.map(function (c) { return c.nombre; }).join(', '), html: html }, 'salud');
  return { avisado: true };
}

async function revisar() {
  const chequeos = await chequear();
  const problemas = chequeos.filter(function (c) { return !c.ok; });
  let aviso = { avisado: false };
  if (problemas.length) {
    try { aviso = await avisar(problemas); }
    catch (e) { aviso = { avisado: false, motivo: e.message }; console.error('[salud] no se pudo mandar el aviso: ' + e.message); }
  }
  return Object.assign({ ok: !problemas.length, problemas: problemas.length, chequeos: chequeos }, aviso);
}

module.exports = {
  marcar: marcar, revisar: revisar, chequear: chequear, CRONS: CRONS,
  storage: { subir: subir, bajar: bajar, listar: listar, borrar: borrar, BUCKET: BUCKET },
  setFetch: function (fn) { fetchFn = fn; }
};
