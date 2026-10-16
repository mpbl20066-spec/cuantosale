'use strict';
/* Demanda insatisfecha: que buscan y no les podemos vender (tabla demanda_eventos, sql/supabase_demanda.sql). Lo ve la
   pestana Sistema > Demanda del panel /admin.

   POR QUE ADEMAS DE lib/uso.js
   uso.js suma toques por dia sin saber de quien son, a proposito. Para ordenar oportunidades hace falta contar PERSONAS
   (diez busquedas de una misma persona no pesan como diez personas), saber quien repite y quien termino pidiendo una
   reserva. Para eso el navegador guarda un numero al azar (cs_v, public/web/home-track.js): no es nombre, ni correo,
   ni IP, y no sale de cuantosale.uy.

   QUE SE GUARDA
   cotizo     entro a armar el viaje (home-flujo.html): destino, segunda parada, fechas, medio, personas
   vuelos     la busqueda de vuelos del flujo: ok | sin | error
   reserva    pidio tours o traslados (lo registra lib/reservas.js, del lado del servidor)
   buscar_sin escribio en un buscador de destinos algo que no tenemos (solo letras, hasta 30)

   POST /api/demanda { v, e, dest, seg, ida, vuelta, medio, pax, r, q }   -> 204
   filas(dias, conPrueba) -> para el panel: los eventos crudos; los cruces (personas, repiten, abandonan) los hace el
   panel (public/admin/demanda.js) para poder filtrar sin volver a pedir.

   "prueba": lo mando un navegador con sesion del panel /admin, o desde localhost. El panel los oculta por defecto. */

const EVENTOS = new Set(['cotizo', 'vuelos', 'reserva', 'buscar_sin']);
const VISITANTE = /^[a-z0-9]{8,24}$/;
const CLAVE = /^[a-z0-9-]{1,30}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MEDIOS = new Set(['avion', 'auto', 'bus']);
const RESULTADOS = new Set(['ok', 'sin', 'error', 'tours', 'traslado', 'tours+traslado']);

let esPrueba = function () { return false; };

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
const memoria = [];   // sin Supabase (desarrollo local): se pierde al reiniciar

function local(req) { return /^(localhost|127\.|\[::1\])/.test(String(req.headers.host || '')); }
function cookieVisitante(req) {
  const m = /(?:^|;\s*)cs_v=([a-z0-9]{8,24})/.exec(String(req.headers.cookie || ''));
  return m ? m[1] : '';
}
/* Lo que escribio en el buscador: solo letras y espacios, en minuscula y sin tildes, para que nadie guarde un telefono
   o un correo ahi y para que "Mórro" y "morro" sumen juntos. */
function limpiarTexto(q) {
  const t = String(q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= 3 && t.length <= 30 ? t : '';
}

async function guardar(fila) {
  const s = supa();
  if (!s) { memoria.push(Object.assign({ creado: new Date().toISOString() }, fila)); if (memoria.length > 5000) memoria.shift(); return; }
  const r = await fetch(s.url + '/rest/v1/demanda_eventos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key, Prefer: 'return=minimal' },
    body: JSON.stringify(fila)
  });
  if (!r.ok) throw new Error('Supabase demanda_eventos HTTP ' + r.status + ': ' + (await r.text()).slice(0, 160));
}

/* Pedido de reserva (lib/reservas.js): el destino viaja como nombre ("Río de Janeiro + Búzios"); se pasa a clave. Nunca
   tira: un fallo aca no puede frenar una reserva. */
async function registrarReserva(req, b) {
  try {
    const v = cookieVisitante(req);
    if (!v || !b) return;
    const DEST = require('./model.js').DEST || {};
    const norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); };
    const partes = String(b.destino || '').split('+').map(norm);
    const clave = function (n) { return Object.keys(DEST).filter(function (k) { return norm(DEST[k].name) === n; })[0] || ''; };
    const tipos = {};
    (Array.isArray(b.servicios) ? b.servicios : []).forEach(function (x) { if (x && (x.tipo === 'tour' || x.tipo === 'traslado')) tipos[x.tipo] = 1; });
    const r = tipos.tour && tipos.traslado ? 'tours+traslado' : (tipos.tour ? 'tours' : (tipos.traslado ? 'traslado' : ''));
    await guardar({
      visitante: v, evento: 'reserva', destino: clave(partes[0]), segundo: partes[1] ? clave(partes[1]) : '',
      ida: FECHA.test(b.fecha_ida || '') ? b.fecha_ida : null, vuelta: FECHA.test(b.fecha_vuelta || '') ? b.fecha_vuelta : null,
      pax: Number.isInteger(b.personas_n) && b.personas_n > 0 && b.personas_n < 20 ? b.personas_n : null,
      resultado: r, prueba: local(req) || !!esPrueba(req)
    });
  } catch (e) { console.warn('[demanda] reserva:', e.message); }
}

async function filas(dias, conPrueba) {
  dias = Math.min(90, Math.max(1, Number(dias) || 30));
  const desde = new Date(Date.now() - dias * 864e5).toISOString(), s = supa();
  if (!s) return { desde: desde, filas: memoria.filter(function (f) { return f.creado >= desde && (conPrueba || !f.prueba); }), almacenamiento: 'memoria' };
  const cols = 'creado,visitante,evento,destino,segundo,ida,vuelta,medio,pax,resultado,texto,prueba';
  const r = await fetch(s.url + '/rest/v1/demanda_eventos?select=' + cols + '&creado=gte.' + encodeURIComponent(desde) +
    (conPrueba ? '' : '&prueba=eq.false') + '&order=creado.asc&limit=50000', { headers: { apikey: s.key, Authorization: 'Bearer ' + s.key } });
  const texto = await r.text();
  if (!r.ok) {
    const e = new Error(/demanda_eventos/.test(texto) && r.status === 404
      ? 'Falta crear la tabla: corré sql/supabase_demanda.sql en Supabase (SQL Editor).'
      : 'Supabase respondio HTTP ' + r.status + ': ' + texto.slice(0, 160));
    e.status = 502; throw e;
  }
  return { desde: desde, filas: JSON.parse(texto), almacenamiento: 'supabase' };
}

/* h: sendJson, readJson, limited, clientIp */
function crear(h) {
  async function api(req, res) {
    if (req.method !== 'POST') return h.sendJson(res, 405, { error: 'Solo POST.' });
    /* sendBeacon no espera respuesta: 204 siempre que el pedido este bien armado, aunque no se guarde */
    if (h.limited('demanda:' + h.clientIp(req))) { res.statusCode = 204; return res.end(); }
    let b = null;
    try { b = await h.readJson(req, 1024); } catch (e) { b = null; }
    b = b && typeof b === 'object' ? b : {};
    const v = String(b.v || ''), e = String(b.e || '');
    if (!VISITANTE.test(v) || !EVENTOS.has(e)) return h.sendJson(res, 400, { error: 'Evento desconocido.' });
    const fila = { visitante: v, evento: e, destino: '', segundo: '', ida: null, vuelta: null, medio: '', pax: null, resultado: '', texto: '', prueba: local(req) || !!esPrueba(req) };
    if (e === 'buscar_sin') {
      fila.texto = limpiarTexto(b.q);
      if (!fila.texto) return h.sendJson(res, 400, { error: 'Texto inválido.' });
    } else {
      const DEST = require('./model.js').DEST || {};
      const dest = String(b.dest || '').toLowerCase(), seg = String(b.seg || '').toLowerCase();
      if (!CLAVE.test(dest) || !DEST[dest]) return h.sendJson(res, 400, { error: 'Destino inválido.' });
      fila.destino = dest;
      if (seg && CLAVE.test(seg) && DEST[seg]) fila.segundo = seg;
      if (FECHA.test(b.ida || '')) fila.ida = b.ida;
      if (FECHA.test(b.vuelta || '')) fila.vuelta = b.vuelta;
      if (MEDIOS.has(b.medio)) fila.medio = b.medio;
      const pax = Number(b.pax); if (Number.isInteger(pax) && pax > 0 && pax < 20) fila.pax = pax;
      if (RESULTADOS.has(b.r)) fila.resultado = b.r;
    }
    try { await guardar(fila); } catch (er) { console.warn('[demanda]', er.message); }
    res.statusCode = 204; return res.end();
  }
  return { api: api };
}

module.exports = {
  crear: crear, filas: filas, registrarReserva: registrarReserva,
  /* server.js le pasa como reconocer al panel (sesion de /admin) para marcar sus visitas como prueba */
  configurar: function (o) { if (o && typeof o.esPrueba === 'function') esPrueba = o.esPrueba; }
};
