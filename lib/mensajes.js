/*
 * Bandeja de WhatsApp del panel /admin.
 *
 * El numero de CuantoSale vive en la Cloud API de Meta (ya no en la app del celular): lo que escriben los clientes
 * llega por el webhook (POST /api/whatsapp/webhook) y se guarda aca; lo que se contesta desde el panel sale por la
 * API y tambien se guarda, con el estado que Meta va avisando (enviado, entregado, leido, fallido).
 *
 * Donde se guarda: tabla `wa_mensajes` en Supabase (supabase_mensajes.sql), solo con la service role. Sin Supabase,
 * en data/_trabajo/mensajes.json (desarrollo local). Mismo modelo que lib/pedidos.js.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARCHIVO = path.join(__dirname, '..', 'data', '_trabajo', 'mensajes.json');
const GRAPH = 'https://graph.facebook.com/v21.0/';
const push = require('./push');
const ORDEN_ESTADO = { enviando: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function modo() { return supa() ? 'supabase' : (process.env.VERCEL ? 'sin-base' : 'archivo'); }
function sinBase() { const e = new Error('Falta configurar Supabase para guardar los mensajes.'); e.status = 503; return e; }
async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  if (!s) throw sinBase();
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const t = await r.text();
  if (!r.ok) { const e = new Error('Supabase respondio HTTP ' + r.status + ': ' + t.slice(0, 200)); e.status = 502; throw e; }
  try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
}
let cache = null;
function leerArchivo() {
  if (!cache) { try { cache = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); } catch (e) { cache = {}; } cache.mensajes = cache.mensajes || []; }
  return cache;
}
function escribirArchivo() { fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true }); fs.writeFileSync(ARCHIVO, JSON.stringify(cache, null, 2)); }

function tel(v) { return String(v || '').replace(/\D/g, '').slice(0, 15); }
function txt(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max); }

/* ---------- guardar ---------- */
/* Un mensaje: { wa_id, telefono, nombre, direccion: 'in'|'out', tipo, texto, estado, error }. El wa_id de Meta es unico:
   el webhook a veces manda el mismo mensaje dos veces y no se tiene que duplicar. */
async function guardar(m) {
  const fila = {
    id: crypto.randomUUID(), wa_id: txt(m.wa_id, 200) || null, telefono: tel(m.telefono), nombre: txt(m.nombre, 120),
    direccion: m.direccion === 'out' ? 'out' : 'in', tipo: txt(m.tipo || 'text', 30), texto: txt(m.texto, 4096),
    estado: txt(m.estado || (m.direccion === 'out' ? 'sent' : 'recibido'), 20), error: txt(m.error, 300),
    leido: m.direccion === 'out', created_at: m.created_at || new Date().toISOString()
  };
  if (!fila.telefono) return null;
  if (modo() === 'supabase') {
    const f = await rest('POST', 'wa_mensajes' + (fila.wa_id ? '?on_conflict=wa_id' : ''), fila, { Prefer: 'resolution=ignore-duplicates,return=representation' });
    return (f && f[0]) || fila;
  }
  if (modo() === 'sin-base') throw sinBase();
  const db = leerArchivo();
  if (fila.wa_id && db.mensajes.some(function (x) { return x.wa_id === fila.wa_id; })) return fila;
  db.mensajes.push(fila); escribirArchivo();
  return fila;
}
/* Estado que avisa Meta de un mensaje nuestro. No se retrocede: un "delivered" que llega tarde no pisa un "read". */
async function actualizarEstado(waId, estado, error) {
  waId = txt(waId, 200); if (!waId || !(estado in ORDEN_ESTADO)) return;
  if (modo() === 'supabase') {
    const f = await rest('GET', 'wa_mensajes?select=estado&limit=1&wa_id=eq.' + encodeURIComponent(waId));
    if (!f || !f[0] || (ORDEN_ESTADO[f[0].estado] || 0) >= ORDEN_ESTADO[estado]) return;
    await rest('PATCH', 'wa_mensajes?wa_id=eq.' + encodeURIComponent(waId), { estado: estado, error: txt(error, 300) });
    return;
  }
  if (modo() === 'sin-base') return;
  const m = leerArchivo().mensajes.filter(function (x) { return x.wa_id === waId; })[0];
  if (m && (ORDEN_ESTADO[m.estado] || 0) < ORDEN_ESTADO[estado]) { m.estado = estado; m.error = txt(error, 300); escribirArchivo(); }
}

/* ---------- leer ---------- */
async function todos() {
  if (modo() === 'supabase') return (await rest('GET', 'wa_mensajes?select=*&order=created_at.desc&limit=3000')) || [];
  if (modo() === 'sin-base') throw sinBase();
  return leerArchivo().mensajes.slice().sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
}
/* Lista de chats: uno por telefono, con el ultimo mensaje, los no leidos y si la ventana de 24 h esta abierta
   (WhatsApp solo deja mandar texto libre hasta 24 h despues del ultimo mensaje del cliente). */
async function chats() {
  const lista = await todos(), por = {};
  lista.forEach(function (m) {
    const c = por[m.telefono] || (por[m.telefono] = { telefono: m.telefono, nombre: '', ultimo: m, no_leidos: 0, ultimo_entrante: null });
    if (!c.nombre && m.nombre) c.nombre = m.nombre;
    if (m.direccion === 'in') {
      if (!m.leido) c.no_leidos++;
      if (!c.ultimo_entrante) c.ultimo_entrante = m.created_at;
    }
  });
  return Object.keys(por).map(function (k) {
    const c = por[k];
    c.ventana_abierta = !!c.ultimo_entrante && Date.now() - new Date(c.ultimo_entrante).getTime() < 24 * 3600 * 1000;
    return c;
  }).sort(function (a, b) { return String(b.ultimo.created_at).localeCompare(String(a.ultimo.created_at)); });
}
async function conversacion(telefono) {
  const t = tel(telefono);
  if (!t) return [];
  let lista;
  if (modo() === 'supabase') lista = (await rest('GET', 'wa_mensajes?select=*&order=created_at.asc&limit=500&telefono=eq.' + t)) || [];
  else if (modo() === 'sin-base') throw sinBase();
  else lista = leerArchivo().mensajes.filter(function (m) { return m.telefono === t; }).sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
  return lista;
}
async function marcarLeidos(telefono) {
  const t = tel(telefono); if (!t) return;
  if (modo() === 'supabase') { await rest('PATCH', 'wa_mensajes?telefono=eq.' + t + '&direccion=eq.in&leido=eq.false', { leido: true }); return; }
  if (modo() === 'sin-base') return;
  let cambio = false;
  leerArchivo().mensajes.forEach(function (m) { if (m.telefono === t && m.direccion === 'in' && !m.leido) { m.leido = true; cambio = true; } });
  if (cambio) escribirArchivo();
}

/* ---------- webhook de Meta ---------- */
/* Lo que puede llegar en un mensaje que no es texto se guarda como una etiqueta legible: el panel no descarga
   fotos ni audios (eso pide otra llamada a la API con el token), pero tiene que quedar claro que llego algo. */
function textoDe(m) {
  switch (m.type) {
    case 'text': return (m.text && m.text.body) || '';
    case 'button': return (m.button && m.button.text) || '[botón]';
    case 'interactive': { const i = m.interactive || {}; return (i.button_reply && i.button_reply.title) || (i.list_reply && i.list_reply.title) || '[respuesta]'; }
    case 'image': return '[foto]' + (m.image && m.image.caption ? ' ' + m.image.caption : '');
    case 'video': return '[video]' + (m.video && m.video.caption ? ' ' + m.video.caption : '');
    case 'audio': return '[audio]';
    case 'document': return '[documento]' + (m.document && m.document.filename ? ' ' + m.document.filename : '');
    case 'sticker': return '[sticker]';
    case 'location': return '[ubicación]' + (m.location && m.location.name ? ' ' + m.location.name : '');
    case 'contacts': return '[contacto]';
    case 'reaction': return '[reacción ' + ((m.reaction && m.reaction.emoji) || '') + ']';
    default: return '[' + (m.type || 'mensaje') + ']';
  }
}
/* Proveedor que contesta el pedido de tarifa neta: si le escribimos (tarifa "esperando" o "no respondio") y llega un
   mensaje suyo, queda "respondio" solo. Los celulares de Brasil a veces llegan sin el 9 de adelante (5581991183035
   llega como 558191183035), asi que se comparan las dos formas. */
function formasTel(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  const out = [d];
  if (/^55\d{2}9\d{8}$/.test(d)) out.push(d.slice(0, 4) + d.slice(5));
  if (/^55\d{2}\d{8}$/.test(d)) out.push(d.slice(0, 4) + '9' + d.slice(4));
  return out;
}
async function marcarRespuestasProveedores(tels) {
  if (!tels.length || modo() !== 'supabase') return 0;
  const provs = (await rest('GET', 'proveedores?select=id,nombre,whatsapp,telefono&tarifa_estado=in.(esperando,sin_respuesta)')) || [];
  const entrantes = new Set([].concat.apply([], tels.map(formasTel)));
  const ahora = new Date().toISOString();
  let n = 0;
  for (const p of provs) {
    const suyos = formasTel(p.whatsapp).concat(formasTel(p.telefono)).filter(function (x) { return x.length >= 12; });
    if (!suyos.some(function (x) { return entrantes.has(x); })) continue;
    await rest('PATCH', 'proveedores?id=eq.' + p.id, { tarifa_estado: 'respondio', tarifa_respondio_at: ahora, updated_at: ahora });
    n++;
  }
  return n;
}

async function procesarWebhook(cuerpo) {
  let nuevos = 0;
  const entrantes = [];
  const entradas = (cuerpo && Array.isArray(cuerpo.entry)) ? cuerpo.entry : [];
  for (const e of entradas) {
    for (const ch of (e.changes || [])) {
      const v = ch.value || {};
      const nombres = {};
      (v.contacts || []).forEach(function (c) { nombres[c.wa_id] = c.profile && c.profile.name; });
      for (const m of (v.messages || [])) {
        await guardar({
          wa_id: m.id, telefono: m.from, nombre: nombres[m.from] || '', direccion: 'in', tipo: m.type, texto: textoDe(m),
          created_at: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : undefined
        });
        nuevos++;
        if (m.from && entrantes.indexOf(m.from) < 0) entrantes.push(m.from);
      }
      for (const s of (v.statuses || [])) {

        const er = s.errors && s.errors[0];
        await actualizarEstado(s.id, s.status, er ? (er.title || er.message || '') + (er.code ? ' (' + er.code + ')' : '') : '');
      }
    }
  }
  await marcarRespuestasProveedores(entrantes).catch(function (e) { console.warn('[mensajes] marcar respuesta de proveedor:', e.message); });
  /* Aviso al celular (lib/push.js). Se espera: en Vercel la funcion se congela al responder. */
  if (nuevos) await push.avisar();
  return nuevos;
}

/* ---------- enviar ---------- */
async function enviarTexto(telefono, texto) {
  const t = tel(telefono), cuerpo = txt(texto, 4096).trim();
  const token = String(process.env.WHATSAPP_TOKEN || '').trim(), phoneId = String(process.env.WHATSAPP_PHONE_ID || '').trim();
  if (!token || !phoneId) { const e = new Error('Falta configurar WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.'); e.status = 503; throw e; }
  if (!t || !cuerpo) { const e = new Error('Falta el mensaje.'); e.status = 400; throw e; }
  const r = await fetch(GRAPH + phoneId + '/messages', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: t, type: 'text', text: { preview_url: true, body: cuerpo } })
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const er = j.error || {};
    const fuera = er.code === 131047 || /24 hours|re-engagement/i.test(er.message || '');
    const e = new Error(fuera
      ? 'Pasaron más de 24 h desde el último mensaje de este cliente: WhatsApp solo deja escribirle con una plantilla aprobada.'
      : 'Meta: ' + (er.error_user_msg || er.message || 'HTTP ' + r.status) + (er.code ? ' (código ' + er.code + ')' : ''));
    e.status = fuera ? 409 : 502; throw e;
  }
  const waId = j.messages && j.messages[0] && j.messages[0].id;
  return guardar({ wa_id: waId, telefono: t, direccion: 'out', tipo: 'text', texto: cuerpo, estado: 'sent' });
}

module.exports = { modo: modo, guardar: guardar, actualizarEstado: actualizarEstado, chats: chats, conversacion: conversacion,
  marcarLeidos: marcarLeidos, procesarWebhook: procesarWebhook, enviarTexto: enviarTexto, _tel: tel, _formasTel: formasTel };
