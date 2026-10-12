'use strict';
/*
 * Modulo de Operaciones del panel /admin: servicios (tabla tours), precios
 * publicados, cola de cambios e historial. Ver supabase_operaciones.sql.
 *
 * COMO FUNCIONA UN CAMBIO
 *
 *   proponer()  guarda el cambio como 'pendiente' en precio_cambios. La fila del
 *               servicio NO se toca: la web sigue mostrando lo de antes.
 *   publicar()  aplica el cambio a la fila, recalcula precio_publicado y deja el
 *               cambio como historial ('publicado'), con quien y cuando.
 *   revertir()  propone un cambio nuevo con los valores de antes de uno ya
 *               publicado. No se borra nada del historial.
 *
 * Hay un solo pendiente por servicio (indice unico en la base): proponer otro
 * cambio al mismo servicio lo junta con el que habia, asi lo que se revisa es
 * siempre el estado final propuesto y no una pila de pasos intermedios.
 *
 * EL PRECIO PUBLICADO
 *
 * calcular() es la unica cuenta. Para un tour en reales por persona da lo mismo
 * que lib/tours.js (desdeFila) hasta el centavo: R$ / cotizacion + margen, con
 * toFixed(2). Un precio en dolares sin margen propio se publica tal cual, como
 * siempre se hizo. Un precio por vehiculo, grupo o embarcacion se divide por la
 * capacidad, porque la web suma precios por persona.
 *
 * Todo pasa por el server con la service role: costos y margenes no llegan al
 * navegador publico. Lo llama lib/admin.js despues de validar la sesion.
 */
const tours = require('./tours');

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function falla(status, msg) { const e = new Error(msg); e.status = status; return e; }

async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  if (!s) throw falla(503, 'Falta configurar Supabase en el servidor: Operaciones necesita la base.');
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  if (!r.ok) {
    // 23505 = clave repetida: el unico caso es (destino, titulo), y se dice asi.
    if (/23505/.test(texto)) throw falla(409, 'Ya hay un servicio con ese título en ese destino.');
    if (/precio_cambios_un_pendiente/.test(texto)) throw falla(409, 'Ese servicio ya tiene un cambio pendiente. Actualizá y probá de nuevo.');
    throw falla(502, 'Supabase respondio HTTP ' + r.status + ': ' + texto.slice(0, 200));
  }
  try { return texto ? JSON.parse(texto) : null; } catch (e) { return null; }
}
const REP = { Prefer: 'return=representation' };

/* ---------- campos editables ---------- */

const UNIDADES = ['persona', 'vehiculo', 'grupo', 'embarcacion', 'tramo'];
const TIPOS = ['tour', 'actividad', 'traslado', 'barco', 'otro'];

function txt(max) { return function (v) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }; }
function numONull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 1e6) throw falla(400, 'Precio inválido: ' + v);
  return Math.round(n * 100) / 100;
}
function enteroONull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 500) throw falla(400, 'Capacidad inválida: ' + v);
  return n;
}
function margenValor(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < -100 || n > 1000) throw falla(400, 'Margen inválido: ' + v);
  return Math.round(n * 100) / 100;
}
function uno(lista, nulo) { return function (v) { if ((v === null || v === '') && nulo) return null; if (lista.indexOf(v) < 0) throw falla(400, 'Valor inválido: ' + v); return v; }; }
function fechaONull(v) { if (!v) return null; const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw falla(400, 'Fecha inválida: ' + v); return s; }
function uuidONull(v) { if (!v) return null; if (!/^[0-9a-f-]{36}$/i.test(String(v))) throw falla(400, 'Proveedor inválido.'); return String(v); }
function clave(v) { const s = String(v || '').trim().toLowerCase(); if (!/^[a-z0-9_-]{2,30}$/.test(s)) throw falla(400, 'Destino inválido: ' + v); return s; }
function bool(v) { return v === true || v === 'true'; }

const CAMPOS = {
  destino: clave, titulo: txt(200), descripcion: txt(2000), detalle: txt(2000),
  precio: numONull, precio_brl: numONull, unidad: uno(UNIDADES), capacidad: enteroONull,
  margen_tipo: uno(['usd', 'pct'], true), margen_valor: margenValor,
  activo: bool, fuente: txt(300), verificado: fechaONull, orden: function (v) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(9999, n)) : 100; },
  proveedor_id: uuidONull, tipo: uno(TIPOS),
  duracion: txt(120), grupo: txt(120), punto_salida: txt(200), edad_minima: txt(80),
  incluye: txt(3000), no_incluye: txt(3000), politica_cancelacion: txt(2000), que_llevar: txt(2000), link_web: txt(500)
};

function limpiarCambios(c) {
  const out = {};
  Object.keys(c || {}).forEach(function (k) { if (CAMPOS[k]) out[k] = CAMPOS[k](c[k]); });
  if ('titulo' in out && out.titulo.length < 3) throw falla(400, 'El título es muy corto.');
  return out;
}

function igual(a, b) {
  const va = a === undefined || a === '' ? null : a, vb = b === undefined || b === '' ? null : b;
  if (va === null || vb === null) return va === vb;
  if (typeof va === 'number' || typeof vb === 'number') return Number(va) === Number(vb);
  return String(va) === String(vb);
}
function hoy() { return new Date().toISOString().slice(0, 10); }

/* ---------- configuracion y la cuenta ---------- */

async function config() {
  const filas = (await rest('GET', 'operaciones_config?select=clave,valor')) || [];
  const m = {}; filas.forEach(function (f) { m[f.clave] = f.valor || {}; });
  return {
    cotizacion: Number(m.cotizacion_brl_usd && m.cotizacion_brl_usd.valor) || 0,
    cotizacion_fuente: (m.cotizacion_brl_usd && m.cotizacion_brl_usd.fuente) || '',
    margen: m.margen && m.margen.tipo ? { tipo: m.margen.tipo, valor: Number(m.margen.valor) || 0 } : null,
    dias_desactualizado: Number(m.dias_desactualizado && m.dias_desactualizado.valor) || 90
  };
}

/** Precio publicado (USD por persona) de una fila. { valor, margen } o { error }. */
function calcular(f, prov, cfg) {
  const cot = Number(cfg && cfg.cotizacion) || 0;
  const enReales = f.precio_brl != null;
  let base;
  if (enReales) {
    if (!(cot > 0)) return { error: 'Falta la cotización del real.' };
    base = Number(f.precio_brl) / cot;
  } else if (f.precio != null) {
    base = Number(f.precio);
  } else {
    return { error: 'No tiene precio.' };
  }
  if (f.unidad && f.unidad !== 'persona') {
    const cap = Number(f.capacidad);
    if (!(cap > 0)) return { error: 'El precio es por ' + f.unidad + ' y falta la capacidad para pasarlo a precio por persona.' };
    base = base / cap;
  }
  let m = null;
  if (f.margen_tipo && f.margen_valor != null) m = { tipo: f.margen_tipo, valor: Number(f.margen_valor), de: 'servicio' };
  else if (prov && prov.margen_tipo && prov.margen_valor != null) m = { tipo: prov.margen_tipo, valor: Number(prov.margen_valor), de: 'proveedor' };
  // El margen general va solo sobre precios en reales: es como funcionaba la
  // web, y un tour cargado en dolares ya traia el precio final.
  else if (enReales && cfg && cfg.margen) m = { tipo: cfg.margen.tipo, valor: cfg.margen.valor, de: 'general' };
  const valor = m ? (m.tipo === 'pct' ? base * (1 + m.valor / 100) : base + m.valor) : base;
  if (!(valor >= 0)) return { error: 'El precio da negativo.' };
  return { valor: Number(valor.toFixed(2)), margen: m };
}

/* ---------- lecturas ---------- */

async function servicio(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw falla(400, 'Servicio inválido.');
  const f = await rest('GET', 'tours?select=*&limit=1&id=eq.' + id);
  if (!f || !f[0]) throw falla(404, 'Ese servicio ya no existe.');
  return f[0];
}
async function proveedor(id) {
  if (!id) return null;
  const f = await rest('GET', 'proveedores?select=id,nombre,margen_tipo,margen_valor&limit=1&id=eq.' + encodeURIComponent(id));
  return (f && f[0]) || null;
}
async function pendienteDe(tourId) {
  const f = await rest('GET', 'precio_cambios?select=*&estado=eq.pendiente&limit=1&tour_id=eq.' + tourId);
  return (f && f[0]) || null;
}

async function datos() {
  const r = await Promise.all([
    rest('GET', 'tours?select=id,destino,titulo,descripcion,detalle,precio,precio_brl,precio_publicado,publicado_at,unidad,capacidad,margen_tipo,margen_valor,activo,revision,revision_motivo,fuente,verificado,orden,proveedor_id,tipo,duracion,grupo,punto_salida,edad_minima,incluye,no_incluye,politica_cancelacion,que_llevar,link_web,updated_at&order=destino.asc,orden.asc,titulo.asc'),
    rest('GET', 'precio_cambios?select=*&estado=eq.pendiente&order=creado_at.desc'),
    config()
  ]);
  return { servicios: r[0] || [], pendientes: r[1] || [], config: r[2], destinos: destinos() };
}

/* Las keys de destino que entiende la web, con su nombre. Un servicio con una key
   que no esta aca no aparece en ningun lado, por eso el panel elige de esta lista. */
let _destinos = null;
function destinos() {
  if (_destinos) return _destinos;
  try {
    const dest = require('./model.js').DEST || {};
    _destinos = Object.keys(dest).map(function (k) { return { key: k, nombre: (dest[k] && dest[k].name) || k }; })
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  } catch (e) { _destinos = []; }
  return _destinos;
}

/* ---------- cambios ---------- */

/**
 * Propone un cambio a un servicio (o crea uno nuevo si no hay id). No toca lo
 * publicado. Devuelve { cambio, servicio, aviso }.
 */
async function proponer(id, cambios, o) {
  o = o || {};
  const limpio = limpiarCambios(cambios);
  let fila;
  if (!id) {
    // Un servicio nuevo nace apagado y sin precio publicado: existe para poder
    // colgarle el cambio, pero la web no lo ve hasta que se publique.
    if (!limpio.destino || !limpio.titulo) throw falla(400, 'Elegí el destino y escribí el título.');
    const creada = await rest('POST', 'tours', {
      destino: limpio.destino, titulo: limpio.titulo, activo: false, revision: 'pendiente', revision_motivo: 'Nuevo, sin publicar',
      proveedor_id: limpio.proveedor_id || null, tipo: limpio.tipo || 'tour'
    }, REP);
    fila = creada[0];
    delete limpio.destino; delete limpio.titulo;
    if (!('activo' in limpio)) limpio.activo = true;
  } else {
    fila = await servicio(id);
  }

  const previo = await pendienteDe(fila.id);
  const desp = Object.assign({}, previo ? previo.despues : {}, limpio);
  // Cambiar el precio sin decir cuando se verifico = se verifico hoy.
  if (('precio' in limpio || 'precio_brl' in limpio) && !('verificado' in limpio)) desp.verificado = hoy();
  Object.keys(desp).forEach(function (k) { if (igual(desp[k], fila[k])) delete desp[k]; });
  // Si el que se volvio igual es el precio, la fecha sola no es un cambio.
  if (Object.keys(desp).length === 1 && 'verificado' in desp && !('verificado' in limpio)) delete desp.verificado;

  if (!Object.keys(desp).length) {
    if (previo) await rest('PATCH', 'precio_cambios?id=eq.' + previo.id, { estado: 'descartado', resuelto_por: o.usuario || '', resuelto_at: new Date().toISOString() });
    return { cambio: null, servicio: fila, aviso: 'No hay nada distinto de lo publicado.' };
  }

  const futura = Object.assign({}, fila, desp);
  const calc = calcular(futura, await proveedor(futura.proveedor_id), await config());
  const registro = {
    tour_id: fila.id,
    tour_clave: futura.destino + '#' + futura.titulo,
    origen: o.origen || 'manual',
    importacion_id: o.importacion_id || null,
    antes: Object.keys(desp).reduce(function (a, k) { a[k] = fila[k] === undefined ? null : fila[k]; return a; }, {}),
    despues: desp,
    publicado_antes: fila.precio_publicado,
    publicado_despues: calc.error ? null : calc.valor,
    fuente: txt(300)(o.fuente || ''),
    nota: txt(500)(o.nota || ''),
    creado_por: o.usuario || '',
    creado_at: new Date().toISOString()
  };
  const g = previo
    ? await rest('PATCH', 'precio_cambios?id=eq.' + previo.id, registro, REP)
    : await rest('POST', 'precio_cambios', Object.assign({ estado: 'pendiente' }, registro), REP);
  return { cambio: g && g[0], servicio: fila, aviso: calc.error || '' };
}

/** Publica cambios pendientes. Los que no se pueden publicar quedan pendientes y se dice por que. */
async function publicar(ids, usuario) {
  const cfg = await config();
  const out = { publicados: 0, errores: [] };
  for (const cid of (Array.isArray(ids) ? ids : []).slice(0, 1000)) {
    if (!/^[0-9a-f-]{36}$/i.test(String(cid))) continue;
    const c = ((await rest('GET', 'precio_cambios?select=*&limit=1&estado=eq.pendiente&id=eq.' + cid)) || [])[0];
    if (!c) continue;
    if (!c.tour_id) { await rest('PATCH', 'precio_cambios?id=eq.' + cid, { estado: 'descartado', nota: 'El servicio se borró.' }); continue; }
    try {
      const fila = await servicio(c.tour_id);
      const futura = Object.assign({}, fila, c.despues);
      const calc = calcular(futura, await proveedor(futura.proveedor_id), cfg);
      if (futura.activo && calc.error) throw falla(400, calc.error);
      const ahora = new Date().toISOString();
      const patch = Object.assign({}, c.despues, { updated_at: ahora });
      if (!calc.error) { patch.precio_publicado = calc.valor; patch.publicado_at = ahora; patch.revision = 'ok'; patch.revision_motivo = ''; }
      // Apagado y sin precio calculable: se guarda, pero queda marcado con el motivo
      // para que no se pierda entre los que estan bien.
      else { patch.revision = 'pendiente'; patch.revision_motivo = calc.error; }
      await rest('PATCH', 'tours?id=eq.' + fila.id, patch);
      await rest('PATCH', 'precio_cambios?id=eq.' + cid, {
        estado: 'publicado',
        // Lo de antes se vuelve a leer al publicar: es lo que de verdad se reemplazo.
        antes: Object.keys(c.despues).reduce(function (a, k) { a[k] = fila[k] === undefined ? null : fila[k]; return a; }, {}),
        publicado_antes: fila.precio_publicado,
        publicado_despues: calc.error ? fila.precio_publicado : calc.valor,
        tour_clave: futura.destino + '#' + futura.titulo,
        resuelto_por: usuario || '', resuelto_at: ahora
      });
      out.publicados++;
    } catch (e) {
      out.errores.push({ id: cid, servicio: String(c.tour_clave || '').replace('#', ' · '), error: e.status ? e.message : 'Error inesperado.' });
      if (!e.status) console.error('[operaciones] publicar', e);
    }
  }
  // La instancia que publico ve el cambio ya; las demas, cuando venza su cache (60 s).
  if (out.publicados) tours.invalidar();
  return out;
}

async function descartar(ids, usuario) {
  const lista = (Array.isArray(ids) ? ids : []).filter(function (x) { return /^[0-9a-f-]{36}$/i.test(String(x)); }).slice(0, 1000);
  if (!lista.length) return { descartados: 0 };
  const r = await rest('PATCH', 'precio_cambios?estado=eq.pendiente&id=in.(' + lista.join(',') + ')',
    { estado: 'descartado', resuelto_por: usuario || '', resuelto_at: new Date().toISOString() }, REP);
  return { descartados: (r || []).length };
}

async function historial(tourId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(tourId || ''))) throw falla(400, 'Servicio inválido.');
  return (await rest('GET', 'precio_cambios?select=*&order=creado_at.desc&limit=100&tour_id=eq.' + tourId)) || [];
}

/** Vuelve a lo que habia antes de un cambio publicado. Queda pendiente, salvo que se pida publicar ya. */
async function revertir(cambioId, usuario, publicarYa) {
  if (!/^[0-9a-f-]{36}$/i.test(String(cambioId || ''))) throw falla(400, 'Cambio inválido.');
  const c = ((await rest('GET', 'precio_cambios?select=*&limit=1&id=eq.' + cambioId)) || [])[0];
  if (!c || c.estado !== 'publicado') throw falla(400, 'Solo se puede volver atrás un cambio publicado.');
  if (!c.tour_id) throw falla(400, 'El servicio de ese cambio se borró.');
  if (!Object.keys(c.antes || {}).length) throw falla(400, 'Es el precio inicial: no hay uno anterior.');
  const r = await proponer(c.tour_id, c.antes, {
    origen: 'reversion', usuario: usuario,
    nota: 'Vuelve a lo que había antes del cambio del ' + String(c.resuelto_at || c.creado_at).slice(0, 10)
  });
  if (publicarYa && r.cambio) r.publicacion = await publicar([r.cambio.id], usuario);
  return r;
}

/* ---------- API (la llama lib/admin.js con la sesion ya validada) ---------- */

async function api(ruta, req, res, url, h) {
  const usuario = h.usuario || '';
  if (ruta === 'datos' && req.method === 'GET') return h.sendJson(res, 200, await datos());
  if (ruta === 'historial' && req.method === 'GET') return h.sendJson(res, 200, { cambios: await historial(url.searchParams.get('id')) });
  if (req.method !== 'POST') return h.sendJson(res, 404, { error: 'No existe.' });
  const b = (await h.readJson(req, 512 * 1024)) || {};
  if (ruta === 'proponer') {
    const r = await proponer(b.id || null, b.cambios, { usuario: usuario, nota: b.nota, fuente: b.fuente, origen: 'manual' });
    if (b.publicar && r.cambio) r.publicacion = await publicar([r.cambio.id], usuario);
    return h.sendJson(res, 200, r);
  }
  if (ruta === 'publicar') return h.sendJson(res, 200, await publicar(b.ids, usuario));
  if (ruta === 'descartar') return h.sendJson(res, 200, await descartar(b.ids, usuario));
  if (ruta === 'revertir') return h.sendJson(res, 200, await revertir(b.id, usuario, !!b.publicar));
  return h.sendJson(res, 404, { error: 'No existe.' });
}

module.exports = { api: api, calcular: calcular, limpiarCambios: limpiarCambios, igual: igual, UNIDADES: UNIDADES, TIPOS: TIPOS };
