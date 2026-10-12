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
const crypto = require('crypto');
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
    rest('GET', 'tours?select=id,destino,titulo,descripcion,detalle,precio,precio_brl,precio_publicado,publicado_at,unidad,capacidad,margen_tipo,margen_valor,activo,revision,revision_motivo,fuente,verificado,orden,proveedor_id,tipo,duracion,grupo,punto_salida,edad_minima,incluye,no_incluye,politica_cancelacion,que_llevar,link_web,updated_at,eliminado_at&order=destino.asc,orden.asc,titulo.asc'),
    rest('GET', 'precio_cambios?select=*&estado=eq.pendiente&order=creado_at.desc'),
    config()
  ]);
  return { servicios: r[0] || [], pendientes: r[1] || [], config: r[2], destinos: destinos(),
    campos_import: CAMPOS_IMPORT.map(function (c) { return { k: c.k, nombre: c.nombre, obligatorio: !!c.obligatorio, sin: c.sin }; }) };
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
      // El archivo no decia si el precio es por persona o por vehiculo y la unidad quedo en "persona" por defecto.
      // Publicarlo tal cual podria vender un precio por auto como precio por persona: alguien tiene que confirmarlo
      // en el editor, que es donde se ve el aviso y se elige la unidad (ese cambio ya no es de la importacion).
      if (futura.activo && c.origen === 'importacion' && fila.revision === 'pendiente' && /unidad|persona o por/.test(fila.revision_motivo)) {
        throw falla(400, 'Falta confirmar si el precio es por persona o por vehículo: abrí el servicio, elegilo y publicá desde ahí.');
      }
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

/* ---------- papelera ---------- */

/* Mandar a la papelera saca el servicio de la web en el momento: es quitar algo, no
   publicar un precio, y esperar a la cola dejaria a la venta algo que ya se decidio
   sacar. Queda en el historial y se puede recuperar tal como estaba. */
async function papelera(id, eliminar, usuario) {
  const fila = await servicio(id);
  const ahora = new Date().toISOString();
  if (eliminar) {
    if (fila.eliminado_at) return { servicio: fila };
    await rest('PATCH', 'precio_cambios?estado=eq.pendiente&tour_id=eq.' + fila.id, { estado: 'descartado', resuelto_por: usuario || '', resuelto_at: ahora, nota: 'Descartado al mandar el servicio a la papelera.' });
    await rest('PATCH', 'tours?id=eq.' + fila.id, { eliminado_at: ahora, activo: false, updated_at: ahora });
    await rest('POST', 'precio_cambios', {
      tour_id: fila.id, tour_clave: fila.destino + '#' + fila.titulo, origen: 'manual', antes: { activo: fila.activo }, despues: { activo: false },
      publicado_antes: fila.precio_publicado, publicado_despues: fila.precio_publicado, nota: 'A la papelera', estado: 'publicado',
      creado_por: usuario || '', resuelto_por: usuario || '', resuelto_at: ahora
    });
  } else {
    if (!fila.eliminado_at) return { servicio: fila };
    // Vuelve como estaba antes de la papelera: si estaba en la web, vuelve a la web.
    const ult = ((await rest('GET', 'precio_cambios?select=antes&nota=eq.A%20la%20papelera&order=creado_at.desc&limit=1&tour_id=eq.' + fila.id)) || [])[0];
    const activo = !!(ult && ult.antes && ult.antes.activo);
    await rest('PATCH', 'tours?id=eq.' + fila.id, { eliminado_at: null, activo: activo, updated_at: ahora });
    await rest('POST', 'precio_cambios', {
      tour_id: fila.id, tour_clave: fila.destino + '#' + fila.titulo, origen: 'manual', antes: { activo: false }, despues: { activo: activo },
      publicado_antes: fila.precio_publicado, publicado_despues: fila.precio_publicado, nota: 'Sale de la papelera', estado: 'publicado',
      creado_por: usuario || '', resuelto_por: usuario || '', resuelto_at: ahora
    });
  }
  tours.invalidar();
  return { servicio: await servicio(id) };
}

/** Borra para siempre un servicio que ya esta en la papelera. Su historial queda. */
async function borrarDefinitivo(id) {
  const fila = await servicio(id);
  if (!fila.eliminado_at) throw falla(400, 'Primero mandalo a la papelera.');
  await rest('DELETE', 'tours?id=eq.' + fila.id);
  return { borrado: true };
}

/* ---------- importacion ----------
 *
 * analizarImport() decide que pasa con cada fila del archivo, sin guardar nada.
 * La vista previa y la confirmacion corren la MISMA funcion con los mismos datos:
 * lo que se confirma es lo que se vio.
 *
 * Que es "igual". Un mismo paseo lo venden varios operadores (Praia do Gunga, en
 * Maceio, aparece cinco veces en el directorio). La web muestra una tarjeta por
 * paseo, asi que:
 *   - misma operadora + destino + titulo que un servicio ya cargado -> 'actualiza'
 *     (o 'sin_cambios'): reimportar el archivo no duplica.
 *   - titulo casi igual a un servicio del mismo destino -> 'igual': por defecto no
 *     se importa. Se puede asignar el operador a ese servicio o importarlo igual.
 *   - titulo parecido -> 'parecido': se importa como nuevo, marcado para mirarlo.
 *   - mismo destino y titulo que otra fila del archivo -> 'repetido': entra la primera.
 */
const CAMPOS_IMPORT = [
  { k: 'operador', nombre: 'Proveedor / operador', obligatorio: true, sin: ['operador', 'proveedor', 'agencia', 'empresa', 'operadora'] },
  { k: 'destino', nombre: 'Destino', obligatorio: true, sin: ['destinos servicio', 'destino', 'destinos', 'ciudad'] },
  { k: 'titulo', nombre: 'Título del servicio', obligatorio: true, sin: ['titulo', 'nombre', 'servicio', 'tour', 'nombre servicio'] },
  { k: 'monto', nombre: 'Precio (número)', obligatorio: true, sin: ['monto', 'precio', 'pvp', 'valor', 'tarifa', 'importe'] },
  { k: 'moneda', nombre: 'Moneda (BRL o USD)', sin: ['moneda', 'currency'] },
  { k: 'unidad', nombre: 'Unidad del precio', sin: ['unidad', 'por', 'unidad precio'] },
  { k: 'capacidad', nombre: 'Capacidad', sin: ['capacidad', 'pax', 'lugares', 'grupo'] },
  { k: 'tipo', nombre: 'Tipo (tour, traslado…)', sin: ['tipo', 'tipo servicio', 'categoria'] },
  { k: 'precio_texto', nombre: 'Precio como lo dice el operador', sin: ['preciotexto', 'precio texto'] },
  { k: 'duracion', nombre: 'Duración', sin: ['duracion'] },
  { k: 'descripcion', nombre: 'Descripción', sin: ['descripcion'] },
  { k: 'incluye', nombre: 'Incluye', sin: ['incluye'] },
  { k: 'no_incluye', nombre: 'No incluye', sin: ['noincluye', 'no incluye'] },
  { k: 'que_llevar', nombre: 'Qué llevar', sin: ['llevar', 'que llevar'] },
  { k: 'cancelacion', nombre: 'Cancelación / restricciones', sin: ['restricciones', 'cancelacion', 'politica cancelacion'] },
  { k: 'link', nombre: 'Link del servicio', sin: ['fuente', 'link', 'url', 'link web'] },
  { k: 'fecha', nombre: 'Fecha en que se revisó', sin: ['fecha', 'verificado', 'revisado'] },
  { k: 'region', nombre: 'Región del proveedor', sin: ['region'] },
  { k: 'whatsapp', nombre: 'WhatsApp del proveedor', sin: ['whatsapp'] },
  { k: 'telefono', nombre: 'Teléfono del proveedor', sin: ['telefono'] },
  { k: 'email', nombre: 'Email del proveedor', sin: ['email', 'correo'] },
  { k: 'instagram', nombre: 'Instagram del proveedor', sin: ['instagram'] },
  { k: 'web', nombre: 'Web del proveedor', sin: ['web', 'sitio web'] },
  { k: 'cadastur', nombre: 'Cadastur', sin: ['cadastur'] },
  { k: 'espanol', nombre: 'Atiende en español', sin: ['espanol'] },
  { k: 'avisos', nombre: 'Avisos del proveedor', sin: ['avisos operador', 'avisos'] }
];
const MAX_FILAS = 3000;

function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
const VACIAS = new Set('de do da dos das e y en a o el la los las con para por the passeio paseo tour excursion'.split(' '));
function palabras(s) { return new Set(norm(s).split(' ').filter(function (w) { return w.length > 2 && !VACIAS.has(w); })); }
function parecido(a, b) {
  const A = palabras(a), B = palabras(b);
  if (!A.size || !B.size) return norm(a) === norm(b) ? 1 : 0;
  let i = 0; A.forEach(function (w) { if (B.has(w)) i++; });
  return i / (A.size + B.size - i);
}
function lista(v) { return String(v == null ? '' : v).split(/\s*\|\s*|\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean).join('\n'); }
function monto(v) {
  let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!s) return null;
  // "1.400,50" y "1400.50" son lo mismo; "1.400" en reales es mil cuatrocientos.
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function tipoDe(v) { const s = norm(v); if (/trasl|transfer/.test(s)) return 'traslado'; if (/activ/.test(s)) return 'actividad'; if (/barco|escuna|lancha|catamar/.test(s)) return 'barco'; return 'tour'; }
/* La unidad en texto libre ("por vehículo, hasta 3 pax", "por persona por tramo"). El orden importa: "por vehículo,
   hasta 3 pax" es por vehiculo aunque diga pax, y "por persona por tramo" es por persona. */
function unidadDe(v) {
  const s = norm(v);
  if (!s || /no indicad|sin unidad/.test(s)) return null;
  if (/vehic|maquina|auto|carro|cuatri/.test(s)) return 'vehiculo';
  if (/embarc/.test(s)) return 'embarcacion';
  if (/persona|adulto|pessoa|pax/.test(s)) return 'persona';
  if (/tramo|trayecto|trecho|sentido/.test(s)) return 'tramo';
  if (/grupo/.test(s)) return 'grupo';
  return null;
}
function capacidadDe(unidadTxt, capTxt) {
  const m = /hasta\s*(\d{1,3})/i.exec(norm(unidadTxt)) || /hasta\s*(\d{1,3})/i.exec(norm(capTxt)) ||
    // "4 personas" si; "1 a 15 pasajeros segun tarifa" no: un rango no es una capacidad, queda para revisar.
    /^(\d{1,3}) (personas|pasajeros|pax|lugares)/.exec(norm(capTxt));
  return m ? Number(m[1]) : null;
}

async function contextoImport() {
  const r = await Promise.all([
    rest('GET', 'tours?select=id,destino,titulo,proveedor_id,precio,precio_brl,precio_publicado,unidad,capacidad,duracion,descripcion,incluye,no_incluye,que_llevar,politica_cancelacion,link_web,activo,eliminado_at,tipo'),
    rest('GET', 'proveedores?select=*'),
    rest('GET', 'destino_alias?select=alias,destino'),
    config()
  ]);
  const alias = {};
  destinos().forEach(function (d) { alias[norm(d.nombre)] = d.key; alias[norm(d.nombre.split(',')[0])] = d.key; alias[norm(d.key)] = d.key; });
  (r[2] || []).forEach(function (a) { alias[norm(a.alias)] = a.destino; });
  return { tours: r[0] || [], proveedores: r[1] || [], alias: alias, cfg: r[3] };
}

function analizarImport(filas, decisiones, ctx) {
  decisiones = decisiones || {};
  const provPorNombre = {};
  ctx.proveedores.forEach(function (p) { provPorNombre[norm(p.nombre)] = p; });
  const enArchivo = {};
  const out = [];
  (Array.isArray(filas) ? filas : []).slice(0, MAX_FILAS).forEach(function (f, i) {
    f = f || {};
    const n = i + 1, errores = [], avisos = [];
    const titulo = String(f.titulo || '').trim().slice(0, 200);
    const operador = String(f.operador || '').trim().slice(0, 120);
    if (titulo.length < 3) errores.push('Falta el título.');
    if (operador.length < 2) errores.push('Falta el proveedor.');
    const m = monto(f.monto);
    if (m == null || m <= 0) errores.push('Precio inválido: "' + String(f.monto == null ? '' : f.monto).slice(0, 30) + '".');
    const mon = String(f.moneda || 'BRL').trim().toUpperCase().replace('R$', 'BRL').replace('US$', 'USD');
    if (mon !== 'BRL' && mon !== 'USD') errores.push('Moneda "' + mon + '": solo BRL o USD.');
    let destino = null;
    const nombresDest = String(f.destino || '').split(/\s*[|;/]\s*/).filter(Boolean);
    for (const d of nombresDest) { if (ctx.alias[norm(d)]) { destino = ctx.alias[norm(d)]; break; } }
    if (!destino) errores.push(nombresDest.length ? 'El destino "' + nombresDest.join(' | ') + '" no está en la web.' : 'Falta el destino.');
    const tipo = tipoDe(f.tipo);
    const unidad = unidadDe(f.unidad);
    let capacidad = unidad && unidad !== 'persona' ? capacidadDe(f.unidad, f.capacidad) : null;
    if (!unidad) avisos.push('No dice si el precio es por persona o por vehículo.');
    else if (unidad !== 'persona' && !capacidad) avisos.push('Precio ' + (UNIDADES.indexOf(unidad) >= 0 ? 'por ' + unidad : '') + ' sin capacidad.');
    if (tipo === 'traslado') avisos.push('Traslado: queda en el catálogo, la web calcula los traslados aparte.');

    const datos = {
      destino: destino, titulo: titulo, tipo: tipo, unidad: unidad || 'persona', capacidad: capacidad,
      precio_brl: mon === 'BRL' ? m : null, precio: mon === 'USD' ? m : undefined,
      duracion: String(f.duracion || '').trim().slice(0, 120), descripcion: String(f.descripcion || '').trim().slice(0, 2000),
      incluye: lista(f.incluye), no_incluye: lista(f.no_incluye), que_llevar: lista(f.que_llevar),
      politica_cancelacion: String(f.cancelacion || '').trim().slice(0, 2000), link_web: String(f.link || '').trim().slice(0, 500),
      verificado: /^\d{4}-\d{2}-\d{2}/.test(String(f.fecha || '')) ? String(f.fecha).slice(0, 10) : hoy()
    };
    const prov = provPorNombre[norm(operador)] || null;

    let accion = 'nuevo', ref = null, opciones = ['nuevo', 'omitir'], defecto = 'nuevo', similitud = 0;
    if (errores.length) { accion = 'error'; opciones = []; defecto = 'omitir'; }
    else {
      const mismos = ctx.tours.filter(function (t) { return t.destino === destino; });
      const propio = prov ? mismos.filter(function (t) { return t.proveedor_id === prov.id && norm(t.titulo) === norm(titulo); })[0] : null;
      if (propio) {
        ref = propio;
        const cambios = cambiosDeImport(datos, propio, prov);
        accion = Object.keys(cambios).length ? 'actualiza' : 'sin_cambios';
        opciones = accion === 'actualiza' ? ['actualizar', 'omitir'] : ['omitir'];
        defecto = accion === 'actualiza' ? 'actualizar' : 'omitir';
      } else {
        let mejor = null;
        mismos.forEach(function (t) { const s = norm(t.titulo) === norm(titulo) ? 1 : parecido(t.titulo, titulo); if (!mejor || s > mejor.s) mejor = { t: t, s: s }; });
        similitud = mejor ? mejor.s : 0;
        const clave = destino + '#' + norm(titulo);
        if (mejor && mejor.s >= 0.8) { accion = 'igual'; ref = mejor.t; opciones = ['omitir', 'asignar', 'nuevo']; defecto = 'omitir'; }
        else if (enArchivo[clave]) { accion = 'repetido'; opciones = ['omitir']; defecto = 'omitir'; avisos.push('Igual a la fila ' + enArchivo[clave] + ' del archivo.'); }
        else if (mejor && mejor.s >= 0.5) { accion = 'parecido'; ref = mejor.t; opciones = ['nuevo', 'asignar', 'omitir']; defecto = 'nuevo'; }
        // Un nuevo con el mismo titulo exacto que otro chocaria en la base: solo si se pide igual.
        if (accion === 'igual' && norm(ref.titulo) === norm(titulo)) opciones = ['omitir', 'asignar'];
        // A uno que esta en la papelera no se le asigna nada: se ve como igual y, si se quiere, se importa de nuevo.
        if (ref && ref.eliminado_at) { opciones = opciones.filter(function (o) { return o !== 'asignar'; }); if (!opciones.length) opciones = ['omitir']; avisos.push('El parecido está en la papelera.'); }
      }
      if (accion !== 'repetido' && accion !== 'error') enArchivo[destino + '#' + norm(titulo)] = enArchivo[destino + '#' + norm(titulo)] || n;
    }
    let decision = decisiones[n] && opciones.indexOf(decisiones[n]) >= 0 ? decisiones[n] : defecto;
    const calc = errores.length ? {} : calcular(Object.assign({}, datos, { precio: mon === 'USD' ? m : null }), prov, ctx.cfg);
    out.push({
      n: n, accion: accion, decision: decision, opciones: opciones, errores: errores, avisos: avisos, similitud: Math.round(similitud * 100) / 100,
      titulo: titulo, operador: operador, proveedor_nuevo: !prov && !!operador, destino: destino, destino_texto: String(f.destino || '').slice(0, 120),
      tipo: tipo, monto: m, moneda: mon, unidad: unidad, capacidad: capacidad, publicado_estimado: calc.valor == null ? null : calc.valor,
      ref: ref ? { id: ref.id, titulo: ref.titulo, precio_publicado: ref.precio_publicado, papelera: !!ref.eliminado_at } : null,
      _datos: datos, _fila: f, _prov: prov
    });
  });
  return out;
}

/* Lo que cambia en un servicio que ya existe. Solo lo que el archivo trae: una celda
   vacia no borra un dato que ya estaba. */
function cambiosDeImport(datos, fila, prov, soloPrecio) {
  const c = {};
  const poner = function (k, v) { if (v !== undefined && v !== null && v !== '' && !igual(v, fila[k])) c[k] = v; };
  if (datos.precio_brl != null) { poner('precio_brl', datos.precio_brl); }
  else if (datos.precio != null) { poner('precio', datos.precio); if (fila.precio_brl != null) c.precio_brl = null; }
  poner('unidad', datos.unidad); poner('capacidad', datos.capacidad);
  if (prov && fila.proveedor_id !== prov.id) c.proveedor_id = prov.id;
  if (!soloPrecio) {
    ['duracion', 'descripcion', 'incluye', 'no_incluye', 'que_llevar', 'politica_cancelacion', 'link_web'].forEach(function (k) { poner(k, datos[k]); });
  } else poner('link_web', datos.link_web);
  // La fecha de revision solo cuenta si cambia algo mas.
  if (Object.keys(c).length) poner('verificado', datos.verificado);
  return c;
}

function previaPublica(filas) {
  const tot = { total: filas.length };
  filas.forEach(function (r) { tot[r.accion] = (tot[r.accion] || 0) + 1; });
  return { totales: tot, filas: filas.map(function (r) { const x = Object.assign({}, r); delete x._datos; delete x._fila; delete x._prov; return x; }) };
}

async function previaImport(filas) {
  if (!Array.isArray(filas) || !filas.length) throw falla(400, 'El archivo no tiene filas.');
  if (filas.length > MAX_FILAS) throw falla(400, 'Son ' + filas.length + ' filas: el máximo por archivo es ' + MAX_FILAS + '.');
  return previaPublica(analizarImport(filas, {}, await contextoImport()));
}

async function confirmarImport(b, usuario) {
  const filas = b.filas, ctx = await contextoImport();
  const res = analizarImport(filas, b.decisiones || {}, ctx);
  const ahora = new Date().toISOString();
  const archivo = txt(200)(b.archivo || '');
  const imp = (await rest('POST', 'importaciones', { archivo: archivo, plantilla: txt(80)(b.plantilla || ''), mapeo: b.mapeo || {}, estado: 'borrador', creado_por: usuario || '' }, REP))[0];

  // 1. Proveedores: los nuevos se crean; a los que ya estaban solo se les completan datos vacios.
  const provNuevos = {}, provPatch = {};
  res.forEach(function (r) {
    if (r.decision === 'omitir' || r.accion === 'error') return;
    const f = r._fila, campos = { whatsapp: f.whatsapp, telefono: f.telefono, email: f.email, instagram: f.instagram, web: f.web, cadastur: f.cadastur, region: f.region, espanol: f.espanol, avisos: f.avisos };
    if (!r._prov) {
      const k = norm(r.operador);
      const p = provNuevos[k] = provNuevos[k] || { nombre: r.operador, destinos: [], activo: true, moneda: r.moneda, notas: 'Importado de ' + (archivo || 'un archivo') };
      Object.keys(campos).forEach(function (c) { if (!p[c] && campos[c]) p[c] = String(campos[c]).trim().slice(0, 1000); });
      const dn = r.destino_texto; if (dn && p.destinos.indexOf(dn) < 0) p.destinos.push(dn);
    } else {
      const pp = provPatch[r._prov.id] = provPatch[r._prov.id] || {};
      Object.keys(campos).forEach(function (c) { if (!r._prov[c] && !pp[c] && campos[c]) pp[c] = String(campos[c]).trim().slice(0, 1000); });
    }
  });
  const nuevosLista = Object.keys(provNuevos).map(function (k) {
    const p = provNuevos[k];
    p.destinos = p.destinos.join(' | ').slice(0, 400);
    p.servicios = ('Tours · ' + p.destinos).slice(0, 200);
    if (!p.telefono && p.whatsapp) p.telefono = String(p.whatsapp).replace(/\D/g, '');
    return p;
  });
  const provId = {};
  ctx.proveedores.forEach(function (p) { provId[norm(p.nombre)] = p.id; });
  for (let i = 0; i < nuevosLista.length; i += 200) {
    const creados = await rest('POST', 'proveedores', nuevosLista.slice(i, i + 200).map(function (p) { return Object.assign({ id: crypto.randomUUID() }, p); }), REP);
    (creados || []).forEach(function (p) { provId[norm(p.nombre)] = p.id; });
  }
  for (const id of Object.keys(provPatch)) {
    if (Object.keys(provPatch[id]).length) await rest('PATCH', 'proveedores?id=eq.' + id, Object.assign(provPatch[id], { updated_at: ahora }));
  }

  // 2. Servicios nuevos: nacen apagados, y lo demas va como cambio pendiente (con
  //    activo: true salvo los traslados), igual que uno creado a mano en el panel.
  const nuevos = res.filter(function (r) { return r.decision === 'nuevo' && r.accion !== 'error'; });
  const creadosPorN = {};
  for (let i = 0; i < nuevos.length; i += 200) {
    const lote = nuevos.slice(i, i + 200);
    const filasT = lote.map(function (r) {
      const motivo = r.avisos.filter(function (a) { return !/^Traslado/.test(a); })[0];
      return { destino: r.destino, titulo: r.titulo, tipo: r.tipo, proveedor_id: provId[norm(r.operador)], activo: false, revision: 'pendiente', revision_motivo: motivo ? 'Importado: ' + motivo : 'Nuevo, importado' };
    });
    const creados = await rest('POST', 'tours', filasT, REP);
    (creados || []).forEach(function (t, j) { creadosPorN[lote[j].n] = t; });
  }

  // 3. Cambios pendientes.
  const cambios = [], porN = {};
  const provMargen = {}; ctx.proveedores.forEach(function (p) { provMargen[p.id] = p; });
  res.forEach(function (r) {
    if (r.accion === 'error' || r.decision === 'omitir') return;
    let fila, desp;
    if (r.decision === 'nuevo') {
      fila = creadosPorN[r.n]; if (!fila) return;
      const d = r._datos;
      desp = {};
      ['precio_brl', 'unidad', 'capacidad', 'duracion', 'descripcion', 'incluye', 'no_incluye', 'que_llevar', 'politica_cancelacion', 'link_web', 'verificado'].forEach(function (k) { if (d[k] !== null && d[k] !== undefined && d[k] !== '') desp[k] = d[k]; });
      if (d.precio != null) desp.precio = d.precio;
      if (r.tipo !== 'traslado') desp.activo = true;
    } else {
      // 'actualizar' (mismo operador) o 'asignar' (el operador pasa a ser el de un servicio que ya estaba).
      fila = ctx.tours.filter(function (t) { return t.id === r.ref.id; })[0]; if (!fila) return;
      const prov = { id: provId[norm(r.operador)] };
      desp = cambiosDeImport(r._datos, fila, prov, r.decision === 'asignar');
      if (!Object.keys(desp).length) return;
    }
    const futura = Object.assign({}, fila, desp);
    const calc = calcular(futura, provMargen[futura.proveedor_id] || null, ctx.cfg);
    porN[r.n] = fila.id;
    cambios.push({
      tour_id: fila.id, tour_clave: futura.destino + '#' + futura.titulo, origen: 'importacion', importacion_id: imp.id,
      antes: Object.keys(desp).reduce(function (a, k) { a[k] = fila[k] === undefined ? null : fila[k]; return a; }, {}),
      despues: desp, publicado_antes: fila.precio_publicado == null ? null : fila.precio_publicado, publicado_despues: calc.error ? null : calc.valor,
      fuente: ('Importado de ' + (archivo || 'un archivo') + (r._datos.link_web ? ' · ' + r._datos.link_web : '')).slice(0, 300),
      nota: String(r._fila.precio_texto || '').trim().slice(0, 500), estado: 'pendiente', creado_por: usuario || '', creado_at: ahora
    });
  });
  // Un servicio que ya tenia un pendiente: el de la importacion lo reemplaza (el
  // indice unico no deja dos). El reemplazado queda en el historial.
  const conPend = cambios.map(function (c) { return c.tour_id; });
  for (let i = 0; i < conPend.length; i += 150) {
    await rest('PATCH', 'precio_cambios?estado=eq.pendiente&tour_id=in.(' + conPend.slice(i, i + 150).join(',') + ')', { estado: 'reemplazado', resuelto_por: usuario || '', resuelto_at: ahora });
  }
  for (let i = 0; i < cambios.length; i += 200) await rest('POST', 'precio_cambios', cambios.slice(i, i + 200));

  // 4. El registro de la importacion, fila por fila.
  const accionFila = function (r) {
    if (r.accion === 'error') return 'error';
    if (r.decision === 'omitir') return r.accion === 'sin_cambios' ? 'sin_cambios' : 'omitida';
    return r.decision === 'nuevo' ? 'nuevo' : 'actualiza';
  };
  const regs = res.map(function (r) {
    return { importacion_id: imp.id, n: r.n, datos: r._fila, accion: accionFila(r), errores: r.errores.concat(r.avisos), tour_id: porN[r.n] || (creadosPorN[r.n] && creadosPorN[r.n].id) || null, proveedor_id: provId[norm(r.operador)] || null };
  });
  for (let i = 0; i < regs.length; i += 300) await rest('POST', 'importacion_filas', regs.slice(i, i + 300));
  const tot = { total: res.length, nuevos: 0, actualiza: 0, sin_cambios: 0, omitidas: 0, errores: 0, proveedores_nuevos: nuevosLista.length, cambios_pendientes: cambios.length };
  regs.forEach(function (x) { const k = { nuevo: 'nuevos', actualiza: 'actualiza', sin_cambios: 'sin_cambios', omitida: 'omitidas', error: 'errores' }[x.accion]; tot[k]++; });
  await rest('PATCH', 'importaciones?id=eq.' + imp.id, { estado: 'confirmada', totales: tot, confirmado_at: new Date().toISOString() });
  return { importacion: imp.id, totales: tot };
}

async function importaciones() {
  return (await rest('GET', 'importaciones?select=id,archivo,estado,totales,creado_por,creado_at,confirmado_at&order=creado_at.desc&limit=20')) || [];
}
async function importacionFilas(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw falla(400, 'Importación inválida.');
  return (await rest('GET', 'importacion_filas?select=n,accion,errores,datos&order=n.asc&importacion_id=eq.' + id)) || [];
}

/* ---------- API (la llama lib/admin.js con la sesion ya validada) ---------- */

async function api(ruta, req, res, url, h) {
  const usuario = h.usuario || '';
  if (ruta === 'datos' && req.method === 'GET') return h.sendJson(res, 200, await datos());
  if (ruta === 'historial' && req.method === 'GET') return h.sendJson(res, 200, { cambios: await historial(url.searchParams.get('id')) });
  if (ruta === 'importaciones' && req.method === 'GET') return h.sendJson(res, 200, { importaciones: await importaciones() });
  if (ruta === 'importacion' && req.method === 'GET') return h.sendJson(res, 200, { filas: await importacionFilas(url.searchParams.get('id')) });
  if (req.method !== 'POST') return h.sendJson(res, 404, { error: 'No existe.' });
  // Un archivo de importacion son cientos de filas; el resto de los pedidos es chico.
  const b = (await h.readJson(req, ruta.indexOf('importar/') === 0 ? 4 * 1024 * 1024 : 512 * 1024)) || {};
  if (ruta === 'proponer') {
    const r = await proponer(b.id || null, b.cambios, { usuario: usuario, nota: b.nota, fuente: b.fuente, origen: 'manual' });
    if (b.publicar && r.cambio) r.publicacion = await publicar([r.cambio.id], usuario);
    return h.sendJson(res, 200, r);
  }
  if (ruta === 'importar/previa') return h.sendJson(res, 200, await previaImport(b.filas));
  if (ruta === 'importar/confirmar') return h.sendJson(res, 200, await confirmarImport(b, usuario));
  if (ruta === 'papelera') return h.sendJson(res, 200, await papelera(b.id, !!b.eliminar, usuario));
  if (ruta === 'borrar') return h.sendJson(res, 200, await borrarDefinitivo(b.id));
  if (ruta === 'publicar') return h.sendJson(res, 200, await publicar(b.ids, usuario));
  if (ruta === 'descartar') return h.sendJson(res, 200, await descartar(b.ids, usuario));
  if (ruta === 'revertir') return h.sendJson(res, 200, await revertir(b.id, usuario, !!b.publicar));
  return h.sendJson(res, 404, { error: 'No existe.' });
}

module.exports = { api: api, calcular: calcular, analizarImport: analizarImport, unidadDe: unidadDe, capacidadDe: capacidadDe, monto: monto, parecido: parecido, limpiarCambios: limpiarCambios, igual: igual, UNIDADES: UNIDADES, TIPOS: TIPOS };
