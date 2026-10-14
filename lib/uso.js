'use strict';
/* Contador de uso propio (tabla uso_diario, supabase_uso.sql). Lo ve la pestana "Uso" del panel /admin.

   POR QUE ADEMAS DE GOOGLE ANALYTICS
   GA4 solo mide a quien acepto las cookies, asi que no dice cuanta gente usa cada cosa. Este contador suma por dia
   cuantas veces pasa cada evento, sin guardar nada de la persona (ni IP, ni cookie, ni id), y por eso cuenta a todos.

   QUE SE CUENTA
   Solo los eventos de EVENTOS, y el detalle solo si es una palabra corta (la pagina, el destino, la pestana): asi
   nadie puede llenar la tabla con texto libre. Lo manda public/web/home-track.js con sendBeacon.

   POST /api/uso { e: evento, d: detalle }   -> 204
   resumen(dias) -> para el panel: { desde, hasta, filas: [{ fecha, evento, detalle, n }] }

   Sin Supabase (desarrollo local) se cuenta en memoria: alcanza para probar el panel, se pierde al reiniciar. */

const EVENTOS = new Set([
  'vista_pagina',            // detalle: la pagina (guias, guia, destino, flujo...)
  'guias_ranking',           // Destinos > Cuando viajas: pestana tocada (top, clima, precio)
  'guias_mes',               // cambio de mes
  'guias_abrir',             // abrio la guia de un destino desde Destinos (detalle: destino)
  'guias_cotizar',           // Mas baratos -> cotizar (detalle: destino)
  'guias_fav_agregar',       // corazon en Destinos (detalle: destino)
  'guia_fav_agregar',        // corazon en la guia (detalle: destino)
  'guias_ver_favoritos',
  'guias_buscar',
  'guias_filtro_tipo',       // detalle: beach, city, nature, todos
  'guias_mapa_pin',          // detalle: destino
  'guias_mapa_zoom',         // detalle: in, out, reset
  'guia_calcular_viaje',     // "Calcula tu viaje" de la guia (detalle: destino)
  'guia_alerta_creada',      // "Avisame si baja" desde la guia
  'alerta_precio_creada',    // "Avisame si baja" desde la pantalla de vuelos
  'llegada'                  // primera pagina de la visita con ?utm_source= (detalle: la fuente: instagram, tiktok, creador-x...)
]);
const DETALLE = /^[a-z0-9_-]{0,24}$/;

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function hoyUY() { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); }

const memoria = new Map();   // sin Supabase: 'fecha|evento|detalle' -> n

async function sumar(evento, detalle) {
  const s = supa(), fecha = hoyUY();
  if (!s) { const k = fecha + '|' + evento + '|' + detalle; memoria.set(k, (memoria.get(k) || 0) + 1); return; }
  const r = await fetch(s.url + '/rest/v1/rpc/uso_sumar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key },
    body: JSON.stringify({ p_fecha: fecha, p_evento: evento, p_detalle: detalle })
  });
  if (!r.ok) throw new Error('Supabase uso_sumar HTTP ' + r.status + ': ' + (await r.text()).slice(0, 160));
}

async function resumen(dias) {
  dias = Math.min(90, Math.max(1, Number(dias) || 30));
  const hasta = hoyUY(), d = new Date(hasta + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (dias - 1));
  const desde = d.toISOString().slice(0, 10), s = supa();
  if (!s) {
    const filas = [];
    memoria.forEach(function (n, k) { const p = k.split('|'); if (p[0] >= desde) filas.push({ fecha: p[0], evento: p[1], detalle: p[2], n: n }); });
    return { desde: desde, hasta: hasta, filas: filas, almacenamiento: 'memoria' };
  }
  const r = await fetch(s.url + '/rest/v1/uso_diario?select=fecha,evento,detalle,n&fecha=gte.' + desde + '&order=fecha.asc&limit=20000', {
    headers: { apikey: s.key, Authorization: 'Bearer ' + s.key }
  });
  const texto = await r.text();
  if (!r.ok) {
    const e = new Error(/uso_diario/.test(texto) && r.status === 404
      ? 'Falta crear la tabla: corré supabase_uso.sql en Supabase (SQL Editor).'
      : 'Supabase respondio HTTP ' + r.status + ': ' + texto.slice(0, 160));
    e.status = 502; throw e;
  }
  return { desde: desde, hasta: hasta, filas: JSON.parse(texto), almacenamiento: 'supabase' };
}

/* h: sendJson, readJson, limited, clientIp */
module.exports = function (h) {
  async function api(req, res) {
    if (req.method !== 'POST') return h.sendJson(res, 405, { error: 'Solo POST.' });
    /* sendBeacon no espera respuesta: se contesta 204 siempre que el pedido este bien armado, aunque no se cuente */
    if (h.limited('uso:' + h.clientIp(req))) { res.statusCode = 204; return res.end(); }
    let b = null;
    try { b = await h.readJson(req, 512); } catch (e) { b = null; }
    const evento = b && String(b.e || ''), detalle = b && String(b.d || '').toLowerCase();
    if (!evento || !EVENTOS.has(evento) || !DETALLE.test(detalle)) return h.sendJson(res, 400, { error: 'Evento desconocido.' });
    try { await sumar(evento, detalle); } catch (e) { console.warn('[uso]', e.message); }
    res.statusCode = 204; return res.end();
  }
  return { api: api, resumen: resumen };
};
module.exports.EVENTOS = EVENTOS;
