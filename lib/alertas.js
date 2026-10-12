'use strict';
/* Alertas de precio de vuelos (tabla alertas_precio, supabase_alertas.sql).

   La persona, con sesion, toca "Avisame si baja" en la pantalla de vuelos. Se guarda el destino, las fechas, los
   pasajeros y el precio TOTAL (ida y vuelta, todos los pasajeros, USD) del vuelo mas barato, medido aca con la misma
   busqueda que usa la pantalla (h.precio). Una vez por dia el cron de Vercel llama a /api/alertas/revisar: vuelve a
   medir cada ruta y, si bajo de verdad (debeAvisar), manda un email con Resend y, en los dispositivos donde la persona
   activo las notificaciones, un push (mandarPush, tabla alertas_push).

   Creditos de Ignav: la busqueda es la misma de la pantalla de vuelos, con su cache de hasta 48 h, asi que una ruta que
   alguien busco hace poco no se vuelve a pagar. Varias alertas con la misma ruta se miden una sola vez. Y la revision
   deja de pedir cuando gasto ALERTAS_MAX_DIA busquedas pagas (50 por defecto) o pasaron ALERTAS_SEGUNDOS (40): lo
   que quedo sin revisar va primero al dia siguiente (orden por revisada_at).

   Endpoints:
     GET    /api/alertas              las alertas activas de quien tiene la sesion
     POST   /api/alertas              { destino, fecha_ida, fecha_vuelta, pasajeros } crea una (tope MAX_POR_PERSONA)
     DELETE /api/alertas?id=          la apaga
     GET    /api/alertas/baja?id=&f=  link del email para dejar de seguir, firmado (sin sesion)
     GET    /api/alertas/revisar      el cron (CRON_SECRET, igual que /api/precalentar)
     /api/alertas/push*               notificaciones push (ver apiPush) */

const crypto = require('crypto');

const MAX_POR_PERSONA = 3;
const BAJA_MIN_PCT = 5, BAJA_MIN_USD = 10;

/* Avisa solo si bajo al menos 5 % y al menos US$ 10 contra la referencia (el precio inicial o el del ultimo aviso):
   un movimiento de centavos no merece un email, y despues de avisar solo se vuelve a avisar si baja otra vez. */
function debeAvisar(referencia, nuevo) {
  const r = Number(referencia), n = Number(nuevo);
  if (!(r > 0) || !(n > 0)) return false;
  return n <= r * (1 - BAJA_MIN_PCT / 100) && r - n >= BAJA_MIN_USD;
}

function hoyUY() { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); }
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

function secreto() { return String(process.env.ALERTAS_SECRET || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(); }
/* Firma del link para darse de baja: sin secreto no se firma nada (falla cerrado). */
function firmaBaja(id) {
  const s = secreto();
  return s ? crypto.createHmac('sha256', s).update('baja.' + id).digest('hex').slice(0, 32) : null;
}
function firmaValida(id, f) {
  const esperada = firmaBaja(id);
  if (!esperada || typeof f !== 'string' || f.length !== esperada.length) return false;
  return crypto.timingSafeEqual(Buffer.from(f), Buffer.from(esperada));
}

const esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
const usd = function (n) { return 'US$ ' + Math.round(Number(n) || 0).toLocaleString('es-UY'); };
const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
const fdc = function (d) { const q = String(d || '').split('-'); return q.length < 3 ? '' : (+q[2] + ' ' + MESES[+q[1] - 1]); };

/* h: sendJson, readJson, limited, clientIp, fetchWithTimeout,
      precio(destino, ida, vuelta, pax) -> Promise<number|null>  (total del vuelo mas barato, la busqueda de la pantalla)
      gastoHoy() -> busquedas pagas de hoy en esta instancia, nombreDestino(k) -> string|null */
module.exports = function (h) {
  function cfg() {
    const url = String(process.env.SUPABASE_URL || 'https://hqyzmeordvjccytgltse.supabase.co').replace(/\/+$/, '');
    const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anon = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    return key && anon ? { url: url, key: key, anon: anon } : null;
  }
  async function rest(c, camino, init) {
    init = init || {};
    const r = await h.fetchWithTimeout(c.url + '/rest/v1/' + camino, {
      method: init.method || 'GET',
      headers: Object.assign({ apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, init.headers || {}),
      body: init.body ? JSON.stringify(init.body) : undefined
    }, 8000);
    if (!r.ok) { const e = new Error('Supabase respondió ' + r.status); e.status = 502; e.supabase = r.status; throw e; }
    const t = await r.text();
    return t ? JSON.parse(t) : [];
  }
  async function usuarioDe(req) {
    const c = cfg();
    const m = /^Bearer\s+([A-Za-z0-9._-]{20,4000})$/.exec(String(req.headers.authorization || ''));
    if (!c || !m) return null;
    try {
      const r = await h.fetchWithTimeout(c.url + '/auth/v1/user', { headers: { apikey: c.anon, Authorization: 'Bearer ' + m[1] } }, 6000);
      if (!r.ok) return null;
      const u = await r.json();
      const meta = u && u.user_metadata || {};
      return u && UUID.test(u.id || '') && u.email ? { id: u.id, email: String(u.email), nombre: String(meta.full_name || meta.name || '') } : null;
    } catch (e) { return null; }
  }
  /* La tabla todavia no creada (404 de PostgREST) no es un error del pedido: las alertas no estan activas. */
  function fallo(res, e) {
    if (e && (e.supabase === 404 || e.supabase === 400)) return h.sendJson(res, 503, { error: 'Las alertas de precio todavía no están disponibles.' });
    return h.sendJson(res, 502, { error: 'No pudimos guardar la alerta ahora. Probá de nuevo en un momento.' });
  }
  const publica = function (a) {
    return { id: a.id, destino: a.destino, nombre_destino: h.nombreDestino(a.destino) || a.destino, fecha_ida: a.fecha_ida, fecha_vuelta: a.fecha_vuelta,
      pasajeros: a.pasajeros, precio_inicial: Number(a.precio_inicial), precio_ultimo: a.precio_ultimo == null ? null : Number(a.precio_ultimo), revisada_at: a.revisada_at };
  };

  async function api(req, res, url) {
    const c = cfg();
    if (!c) return h.sendJson(res, 503, { error: 'Las alertas de precio todavía no están disponibles.' });
    if (h.limited('alertas:' + h.clientIp(req))) return h.sendJson(res, 429, { error: 'Demasiados pedidos seguidos. Esperá un minuto.' });
    const u = await usuarioDe(req);
    if (!u) return h.sendJson(res, 401, { error: 'Iniciá sesión para usar las alertas de precio.' });
    try {
      if (req.method === 'GET') {
        const filas = await rest(c, 'alertas_precio?select=*&user_id=eq.' + u.id + '&activa=eq.true&order=created_at.desc&limit=20');
        return h.sendJson(res, 200, { alertas: filas.map(publica), max: MAX_POR_PERSONA });
      }
      if (req.method === 'DELETE') {
        const id = String(url.searchParams.get('id') || '');
        if (!UUID.test(id)) return h.sendJson(res, 400, { error: 'Alerta inválida.' });
        await rest(c, 'alertas_precio?id=eq.' + id + '&user_id=eq.' + u.id, { method: 'PATCH', body: { activa: false, fin: 'baja' } });
        return h.sendJson(res, 200, { ok: true });
      }
      if (req.method !== 'POST') return h.sendJson(res, 405, { error: 'Método no permitido.' });
      let b; try { b = await h.readJson(req, 2048); } catch (e) { return h.sendJson(res, e.status || 400, { error: e.message }); }
      b = b && typeof b === 'object' ? b : {};
      const destino = String(b.destino || '').toLowerCase(), ida = String(b.fecha_ida || ''), vuelta = String(b.fecha_vuelta || ''), pax = Number(b.pasajeros);
      if (!h.nombreDestino(destino) || !FECHA.test(ida) || !FECHA.test(vuelta) || vuelta <= ida || ida <= hoyUY() || !Number.isInteger(pax) || pax < 1 || pax > 9) {
        return h.sendJson(res, 400, { error: 'Datos de la alerta inválidos.' });
      }
      const activas = await rest(c, 'alertas_precio?select=id,destino,fecha_ida,fecha_vuelta,pasajeros,precio_inicial,precio_ultimo,revisada_at&user_id=eq.' + u.id + '&activa=eq.true');
      const igual = activas.filter(function (a) { return a.destino === destino && a.fecha_ida === ida && a.fecha_vuelta === vuelta && Number(a.pasajeros) === pax; })[0];
      if (igual) return h.sendJson(res, 200, { alerta: publica(igual), email: u.email, ya: true });
      if (activas.length >= MAX_POR_PERSONA) return h.sendJson(res, 409, { error: 'Ya seguís ' + MAX_POR_PERSONA + ' vuelos. Dejá de seguir alguno desde Mi cuenta → Alertas de precio para agregar otro.' });
      /* El precio de partida se mide aca, con la misma busqueda que la pantalla (casi siempre sale de la cache). */
      const precio = await h.precio(destino, ida, vuelta, pax);
      if (!(precio > 0)) return h.sendJson(res, 503, { error: 'No pudimos consultar el precio de este vuelo ahora. Probá de nuevo en un momento.' });
      const filas = await rest(c, 'alertas_precio', { method: 'POST', headers: { Prefer: 'return=representation' }, body: {
        user_id: u.id, email: u.email, nombre: u.nombre.slice(0, 60) || null, destino: destino, fecha_ida: ida, fecha_vuelta: vuelta, pasajeros: pax,
        precio_inicial: precio, precio_referencia: precio, precio_ultimo: precio, revisada_at: new Date().toISOString()
      } });
      return h.sendJson(res, 201, { alerta: publica(filas[0]), email: u.email });
    } catch (e) {
      console.error('[alertas]', e.message);
      return fallo(res, e);
    }
  }

  /* Link del email "Dejar de seguir": responde una pagina chica, sin sesion. */
  async function baja(req, res, url) {
    const id = String(url.searchParams.get('id') || ''), f = String(url.searchParams.get('f') || '');
    const pagina = function (status, titulo, texto) {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
      res.end('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
        '<title>' + esc(titulo) + ' · CuántoSale</title><style>body{margin:0;background:#F2F4F8;color:#0B1F3A;font:16px/1.55 Arial,Helvetica,sans-serif}' +
        'main{max-width:460px;margin:12vh auto 0;padding:28px 24px;background:#fff;border-radius:16px}h1{margin:0 0 8px;font-size:22px}p{margin:0 0 18px;color:#475467}' +
        'a{display:inline-block;background:#0B1F3A;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700}' +
        '@media(prefers-color-scheme:dark){body{background:#0A101A;color:#fff}main{background:#111A28}p{color:#C9D4E2}a{background:#F7C325;color:#0B1F3A}}</style></head>' +
        '<body><main><h1>' + esc(titulo) + '</h1><p>' + esc(texto) + '</p><a href="/">Ir a CuántoSale</a></main></body></html>');
    };
    if (!UUID.test(id) || !firmaValida(id, f)) return pagina(400, 'Link inválido', 'Este link para dejar de seguir el vuelo no es válido. Podés apagar tus alertas desde Mi cuenta → Alertas de precio.');
    const c = cfg();
    if (!c) return pagina(503, 'Probá en un rato', 'No pudimos procesar el pedido ahora.');
    try {
      await rest(c, 'alertas_precio?id=eq.' + id, { method: 'PATCH', body: { activa: false, fin: 'baja' } });
      return pagina(200, 'Listo, no te avisamos más', 'Dejaste de seguir el precio de este vuelo. Podés crear otra alerta cuando quieras desde la pantalla de vuelos.');
    } catch (e) { return pagina(502, 'Probá en un rato', 'No pudimos procesar el pedido ahora.'); }
  }

  function mailBaja(a, nuevo) {
    const sitio = String(process.env.SITE_URL || 'https://cuantosale.uy').replace(/\/+$/, '');
    const nom = h.nombreDestino(a.destino) || a.destino, pax = Number(a.pasajeros), ref = Number(a.precio_referencia);
    const ahorro = ref - nuevo, pct = Math.round(ahorro / ref * 100);
    const ver = sitio + '/planificar?' + new URLSearchParams({ destino: a.destino, ida: a.fecha_ida, vuelta: a.fecha_vuelta, pax: String(pax), fuente: 'alerta_precio' }).toString();
    const bajaUrl = sitio + '/api/alertas/baja?' + new URLSearchParams({ id: a.id, f: firmaBaja(a.id) || '' }).toString();
    const nombre = String(a.nombre || '').trim().split(/\s+/)[0];
    const AZUL = '#0B1F3A', AMARILLO = '#F7C325', VERDE = '#067647';
    const personas = pax === 1 ? '1 persona' : pax + ' personas';
    const html = '<div style="background:#F2F4F8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:' + AZUL + '">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">' +
      '<tr><td style="background:' + AZUL + ';padding:20px 24px"><span style="font-size:22px;font-weight:800;color:#ffffff">cuánto<span style="color:' + AMARILLO + '">sale</span></span>' +
      '<br><span style="font-size:12px;color:#B8C4D6">Tu viaje, sin sorpresas</span></td></tr>' +
      '<tr><td style="padding:28px 24px 8px"><p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + VERDE + '">Alerta de precio</p>' +
      '<h1 style="margin:0 0 10px;font-size:24px;line-height:1.25">' + (nombre ? esc(nombre) + ', bajó' : 'Bajó') + ' el vuelo a ' + esc(nom) + '</h1>' +
      '<p style="margin:0;font-size:15px;line-height:1.5;color:#475467">Montevideo → ' + esc(nom) + ' · ' + esc(fdc(a.fecha_ida)) + ' – ' + esc(fdc(a.fecha_vuelta)) + ' · ' + esc(personas) + '</p></td></tr>' +
      '<tr><td style="padding:20px 24px"><div style="background:#ECFDF3;border-radius:14px;padding:20px;text-align:center">' +
      '<div style="font-size:13px;color:#475467">Antes <s>' + esc(usd(ref)) + '</s></div>' +
      '<div style="margin-top:4px;font-size:32px;font-weight:800;color:' + AZUL + '">' + esc(usd(nuevo)) + '</div>' +
      '<div style="margin-top:4px;font-size:14px;color:#475467">ida y vuelta, ' + esc(personas) + (pax > 1 ? ' (' + esc(usd(nuevo / pax)) + ' por persona)' : '') + '</div>' +
      '<div style="margin-top:10px;display:inline-block;background:' + VERDE + ';color:#ffffff;border-radius:99px;padding:5px 12px;font-size:13px;font-weight:700">Ahorrás ' + esc(usd(ahorro)) + ' (' + pct + ' %)</div></div></td></tr>' +
      '<tr><td style="padding:0 24px 8px"><a href="' + esc(ver) + '" style="display:inline-block;background:' + AMARILLO + ';color:' + AZUL + ';padding:14px 26px;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px">Ver los vuelos</a></td></tr>' +
      '<tr><td style="padding:16px 24px 28px"><p style="margin:0;font-size:12px;line-height:1.5;color:#667085">Es el vuelo más barato que encontramos hoy en Google Flights para estas fechas. Los precios de los vuelos cambian rápido y la aerolínea confirma el precio final al reservar. ' +
      'Te avisamos de nuevo solo si vuelve a bajar. <a href="' + esc(bajaUrl) + '" style="color:#667085">Dejar de seguir este vuelo</a>.</p></td></tr>' +
      '</table><p style="max-width:520px;margin:14px auto 0;text-align:center;font-size:11px;color:#98A2B3">CuántoSale · cuantosale.uy · admin@cuantosale.uy</p></div>';
    return { html: html, asunto: 'Bajó el vuelo a ' + nom + ': ' + usd(nuevo) + ' (antes ' + usd(ref) + ')', bajaUrl: bajaUrl };
  }
  async function mandarMail(a, nuevo) {
    const key = String(process.env.RESEND_API_KEY || '').trim();
    if (!key || !a.email) return false;
    const m = mailBaja(a, nuevo);
    try {
      const r = await h.fetchWithTimeout('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: String(process.env.RESEND_FROM_ALERTAS || 'CuántoSale <admin@cuantosale.uy>').trim(), to: [a.email], subject: m.asunto, html: m.html,
          headers: { 'List-Unsubscribe': '<' + m.bajaUrl + '>' }, tags: [{ name: 'tipo', value: 'alerta_precio' }] })
      }, 8000);
      return r.ok;
    } catch (e) { return false; }
  }

  /* Notificacion push de una baja (tabla alertas_push, supabase_alertas_push.sql). El push viaja vacio (lib/push.js):
     el texto se guarda en `pendientes` de cada dispositivo y el service worker lo pide a /api/alertas/push-resumen.
     Se guardan las bajas de las ultimas 24 h (hasta 5), asi dos alertas que bajan el mismo dia se ven las dos.
     Devuelve cuantos dispositivos la recibieron. Nunca tira. */
  async function mandarPush(c, a, nuevo) {
    if (!h.push || !h.push.configurado()) return 0;
    let subs;
    try { subs = await rest(c, 'alertas_push?select=id,endpoint,pendientes&user_id=eq.' + a.user_id); } catch (e) { return 0; }
    if (!subs.length) return 0;
    const nom = h.nombreDestino(a.destino) || a.destino, pax = Number(a.pasajeros) || 1;
    const aviso = { id: a.id, at: new Date().toISOString(), titulo: 'Bajó el vuelo a ' + nom,
      cuerpo: usd(nuevo) + ' ida y vuelta (antes ' + usd(a.precio_referencia) + ') · ' + fdc(a.fecha_ida) + ' – ' + fdc(a.fecha_vuelta) + ' · ' + (pax === 1 ? '1 persona' : pax + ' personas'),
      url: '/planificar?' + new URLSearchParams({ destino: a.destino, ida: a.fecha_ida, vuelta: a.fecha_vuelta, pax: String(pax), fuente: 'alerta_push' }).toString() };
    const desde = Date.now() - 864e5;
    let ok = 0;
    for (const s of subs) {
      const previos = (Array.isArray(s.pendientes) ? s.pendientes : []).filter(function (p) { return p && p.id !== a.id && Date.parse(p.at) > desde; });
      try { await rest(c, 'alertas_push?id=eq.' + s.id, { method: 'PATCH', body: { pendientes: [aviso].concat(previos).slice(0, 5) } }); } catch (e) { continue; }
      const r = await h.push.empujar(s.endpoint);
      if (r === 'ok') ok++;
      else if (r === 'muerta') await rest(c, 'alertas_push?id=eq.' + s.id, { method: 'DELETE' }).catch(function () {});
    }
    return ok;
  }

  /* Dispositivos de la persona para las alertas:
       GET    /api/alertas/push-clave            clave publica VAPID (sin sesion) y si esta configurado
       POST   /api/alertas/push                  { suscripcion } activa este dispositivo (con sesion)
       DELETE /api/alertas/push?endpoint=        lo desactiva (con sesion)
       POST   /api/alertas/push-prueba           notificacion de prueba a todos sus dispositivos (con sesion, 1 por minuto)
       GET    /api/alertas/push-resumen?endpoint= lo pide el service worker al recibir el push: el endpoint es la llave
                                                  (una URL larga y secreta que solo conoce ese navegador). */
  const ultimaPrueba = new Map();   // user_id -> cuando mando su ultima prueba (una por minuto)
  async function apiPush(req, res, url) {
    const ruta = url.pathname;
    if (ruta === '/api/alertas/push-clave') return h.sendJson(res, 200, { configurado: !!(h.push && h.push.configurado()), clave: h.push ? h.push.clavePublica() : '' });
    const c = cfg();
    if (!c || !h.push || !h.push.configurado()) return h.sendJson(res, 503, { error: 'Las notificaciones todavía no están disponibles.' });
    if (ruta === '/api/alertas/push-resumen') {
      const ep = String(url.searchParams.get('endpoint') || '');
      if (!h.push.endpointValido(ep)) return h.sendJson(res, 400, { avisos: [] });
      try {
        const filas = await rest(c, 'alertas_push?select=pendientes&endpoint=eq.' + encodeURIComponent(ep));
        const desde = Date.now() - 864e5;
        const avisos = (filas[0] && Array.isArray(filas[0].pendientes) ? filas[0].pendientes : []).filter(function (p) { return p && Date.parse(p.at) > desde; });
        return h.sendJson(res, 200, { avisos: avisos });
      } catch (e) { return h.sendJson(res, 200, { avisos: [] }); }
    }
    if (h.limited('alertas:' + h.clientIp(req))) return h.sendJson(res, 429, { error: 'Demasiados pedidos seguidos. Esperá un minuto.' });
    const u = await usuarioDe(req);
    if (!u) return h.sendJson(res, 401, { error: 'Iniciá sesión para activar las notificaciones.' });
    try {
      /* Notificacion de prueba a TODOS los dispositivos de la persona: para ver que funciona sin esperar una baja. */
      if (ruta === '/api/alertas/push-prueba') {
        if (req.method !== 'POST') return h.sendJson(res, 405, { error: 'Método no permitido.' });
        if (Date.now() - (ultimaPrueba.get(u.id) || 0) < 60000) return h.sendJson(res, 429, { error: 'Ya mandamos una prueba hace un momento. Esperá un minuto.' });
        ultimaPrueba.set(u.id, Date.now());
        if (ultimaPrueba.size > 5000) ultimaPrueba.clear();
        const subs = await rest(c, 'alertas_push?select=id,endpoint,pendientes&user_id=eq.' + u.id);
        if (!subs.length) return h.sendJson(res, 409, { error: 'Todavía no activaste las notificaciones en ningún dispositivo.' });
        const aviso = { id: 'prueba', at: new Date().toISOString(), titulo: 'Notificación de prueba de CuántoSale',
          cuerpo: 'Funciona: así te vamos a avisar cuando baje un vuelo que seguís.', url: '/' };
        let ok = 0;
        for (const s of subs) {
          const previos = (Array.isArray(s.pendientes) ? s.pendientes : []).filter(function (p) { return p && p.id !== 'prueba' && Date.parse(p.at) > Date.now() - 864e5; });
          await rest(c, 'alertas_push?id=eq.' + s.id, { method: 'PATCH', body: { pendientes: [aviso].concat(previos).slice(0, 5) } });
          const r = await h.push.empujar(s.endpoint);
          if (r === 'ok') ok++;
          else if (r === 'muerta') await rest(c, 'alertas_push?id=eq.' + s.id, { method: 'DELETE' }).catch(function () {});
        }
        return h.sendJson(res, 200, { dispositivos: subs.length, enviadas: ok });
      }
      if (req.method === 'DELETE') {
        const ep = String(url.searchParams.get('endpoint') || '');
        if (h.push.endpointValido(ep)) await rest(c, 'alertas_push?endpoint=eq.' + encodeURIComponent(ep) + '&user_id=eq.' + u.id, { method: 'DELETE' });
        return h.sendJson(res, 200, { ok: true });
      }
      if (req.method !== 'POST') return h.sendJson(res, 405, { error: 'Método no permitido.' });
      let b; try { b = await h.readJson(req, 4096); } catch (e) { return h.sendJson(res, e.status || 400, { error: e.message }); }
      const ep = b && b.suscripcion && String(b.suscripcion.endpoint || '');
      if (!h.push.endpointValido(ep)) return h.sendJson(res, 400, { error: 'Suscripción inválida.' });
      /* Mismo endpoint, otra cuenta (se cerro sesion y entro otra persona en ese navegador): pasa a la cuenta nueva. */
      await rest(c, 'alertas_push?on_conflict=endpoint', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { user_id: u.id, endpoint: ep, dispositivo: String(req.headers['user-agent'] || '').slice(0, 160) } });
      return h.sendJson(res, 200, { ok: true });
    } catch (e) {
      console.error('[alertas push]', e.message);
      if (e.supabase === 404) return h.sendJson(res, 503, { error: 'Las notificaciones todavía no están disponibles.' });
      return h.sendJson(res, 502, { error: 'No pudimos activar las notificaciones ahora. Probá de nuevo en un momento.' });
    }
  }

  /* El cron diario. Devuelve un resumen para el log de Vercel. */
  async function revisar(req, res) {
    const cron = String(process.env.CRON_SECRET || '').trim();
    if (cron && req.headers.authorization !== 'Bearer ' + cron) { res.writeHead(401); return res.end(); }
    const c = cfg();
    if (!c) return h.sendJson(res, 503, { error: 'sin Supabase' });
    const maxPagas = Math.max(0, Number(process.env.ALERTAS_MAX_DIA) >= 0 && process.env.ALERTAS_MAX_DIA !== undefined && process.env.ALERTAS_MAX_DIA !== '' ? Number(process.env.ALERTAS_MAX_DIA) : 50);
    const hasta = Date.now() + 1000 * Math.max(5, Number(process.env.ALERTAS_SEGUNDOS) || 40);
    const out = { rutas: 0, revisadas: 0, avisos: 0, sinPrecio: 0, pendientes: 0, vencidas: 0, pagas: 0 };
    try {
      const venc = await rest(c, 'alertas_precio?activa=eq.true&fecha_ida=lte.' + hoyUY(), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { activa: false, fin: 'vencida' } });
      out.vencidas = venc.length;
      const filas = await rest(c, 'alertas_precio?select=*&activa=eq.true&order=revisada_at.asc.nullsfirst&limit=500');
      /* Una medicion por ruta: varias personas siguiendo el mismo vuelo cuestan una sola busqueda. */
      const rutas = new Map();
      filas.forEach(function (a) { const k = [a.destino, a.fecha_ida, a.fecha_vuelta, a.pasajeros].join('|'); if (!rutas.has(k)) rutas.set(k, []); rutas.get(k).push(a); });
      out.rutas = rutas.size;
      const gasto0 = h.gastoHoy();
      for (const grupo of rutas.values()) {
        out.pagas = h.gastoHoy() - gasto0;
        if (out.pagas >= maxPagas || Date.now() > hasta) { out.pendientes += grupo.length; continue; }
        const a0 = grupo[0];
        const precio = await h.precio(a0.destino, a0.fecha_ida, a0.fecha_vuelta, Number(a0.pasajeros));
        const ahora = new Date().toISOString();
        for (const a of grupo) {
          out.revisadas++;
          if (!(precio > 0)) { out.sinPrecio++; await rest(c, 'alertas_precio?id=eq.' + a.id, { method: 'PATCH', body: { revisada_at: ahora } }); continue; }
          const cambio = { revisada_at: ahora, precio_ultimo: precio };
          if (debeAvisar(a.precio_referencia, precio)) {
            /* Email siempre; push ademas en los dispositivos donde se activo. Si salio por alguno de los dos, la
               referencia pasa al precio nuevo. Si no salio por ninguno, se reintenta manana. */
            const porMail = await mandarMail(a, precio), porPush = await mandarPush(c, a, precio);
            if (porMail || porPush) {
              Object.assign(cambio, { precio_referencia: precio, avisada_at: ahora, avisos: (Number(a.avisos) || 0) + 1 });
              out.avisos++; if (porPush) out.push = (out.push || 0) + porPush;
            }
          }
          await rest(c, 'alertas_precio?id=eq.' + a.id, { method: 'PATCH', body: cambio });
        }
      }
      out.pagas = h.gastoHoy() - gasto0;
      console.log('[alertas] revision', JSON.stringify(out));
      return h.sendJson(res, 200, out);
    } catch (e) {
      console.error('[alertas] revision', e.message);
      return h.sendJson(res, e.supabase === 404 ? 503 : 502, Object.assign({ error: e.message }, out));
    }
  }

  return { api: api, apiPush: apiPush, baja: baja, revisar: revisar, mailBaja: mailBaja };
};
module.exports.debeAvisar = debeAvisar;
module.exports.firmaBaja = firmaBaja;
module.exports.firmaValida = firmaValida;
module.exports.MAX_POR_PERSONA = MAX_POR_PERSONA;
