'use strict';
/*
 * Reglas del catalogo: disponibilidad (bloqueos de fechas, cupos y dias que no opera), temporadas, combos y la alerta
 * de la cotizacion del real. Las edita el panel /admin (Catalogo > Disponibilidad y Catalogo > Temporadas y combos) y
 * las aplica la web: GET /api/disponibilidad (home-flujo.html), /api/cotizar (los tours de la propuesta) y
 * POST /api/reserva-solicitud, que rechaza un tour sin lugar en las fechas del viaje.
 *
 *   bloqueo    del dia D al dia H no se vende: todo, un destino, los servicios de un proveedor o un servicio. Motivo
 *              libre (mantenimiento, clima, feriado).
 *   cupo       por servicio: cuantas personas por dia como mucho y que dias de la semana no opera. Lo ocupado sale de
 *              los pedidos: los servicios no cancelados con fecha propia (fecha_servicio) y las personas del pedido.
 *              Un pedido de la web todavia sin fecha asignada no ocupa ningun dia.
 *   temporada  del MM-DD al MM-DD (puede cruzar el año: 15/12 al 31/01) un % sobre el precio de los tours, los
 *              traslados o los dos, en todos los destinos o en algunos. Se mira la fecha de ida del viaje.
 *   combo      "traslado + 2 tours = 5 % menos en los tours". La web lo aplica sola al total de los tours.
 *
 * Un servicio se nombra con su clave "destino#titulo", la misma de las fotos y las etiquetas (lib/tours.js). Los
 * pedidos guardan el nombre del servicio, no su id: se cruzan por titulo sin tildes (politicas.tourDe).
 *
 * Donde se guarda: en operaciones_config (sql/supabase_operaciones.sql), una fila por parte. No hace falta SQL nuevo. Sin
 * Supabase (desarrollo local), en data/_trabajo/reglas.json (REGLAS_ARCHIVO en las pruebas).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PARTES = ['bloqueos', 'cupos', 'temporadas', 'combos', 'alerta_cotizacion'];
const ALCANCES = ['todo', 'destino', 'proveedor', 'servicio'];
const APLICA = ['tours', 'traslados', 'todo'];
const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const TTL_MS = 60 * 1000;
const MAX_DIAS_VIAJE = 60;

function falla(status, msg) { const e = new Error(msg); e.status = status; return e; }
function txt(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }
function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function fechaOk(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s + 'T12:00:00Z')); }
function mmddOk(s) { const m = /^(\d{2})-(\d{2})$/.exec(String(s || '')); return !!m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31; }
function mas(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function dow(d) { return new Date(d + 'T12:00:00Z').getUTCDay(); }
function hoyUY() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
function numEn(v, min, max, que) {
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw falla(400, que + ': valor inválido (' + v + ').');
  return Math.round(n * 100) / 100;
}

/* ---------- almacenamiento ---------- */
function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function archivo() { return process.env.REGLAS_ARCHIVO || path.join(__dirname, '..', 'data', '_trabajo', 'reglas.json'); }
function leerArchivo() { try { return JSON.parse(fs.readFileSync(archivo(), 'utf8')); } catch (e) { return {}; } }
async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const t = await r.text();
  if (!r.ok) throw falla(502, 'Supabase respondió HTTP ' + r.status + ': ' + t.slice(0, 200));
  try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
}

const VACIO = function () { return { bloqueos: [], cupos: [], temporadas: [], combos: [], alerta_cotizacion: { umbral_pct: 3, ultimo_aviso: '' } }; };
let cache = null, cacheEn = 0;
function invalidar() { cache = null; cacheEn = 0; cacheOcup = null; cacheCat = null; }

async function leer() {
  if (cache && Date.now() - cacheEn < TTL_MS) return cache;
  const r = VACIO();
  let crudo = {};
  if (supa()) {
    const filas = (await rest('GET', 'operaciones_config?select=clave,valor&clave=in.(' + PARTES.map(function (p) { return 'regla_' + p; }).join(',') + ')')) || [];
    filas.forEach(function (f) { crudo[f.clave.replace(/^regla_/, '')] = f.valor; });
  } else if (!process.env.VERCEL) crudo = leerArchivo();
  ['bloqueos', 'cupos', 'temporadas', 'combos'].forEach(function (k) { if (crudo[k] && Array.isArray(crudo[k].lista)) r[k] = crudo[k].lista; });
  if (crudo.alerta_cotizacion && typeof crudo.alerta_cotizacion === 'object') r.alerta_cotizacion = Object.assign(r.alerta_cotizacion, crudo.alerta_cotizacion);
  cache = r; cacheEn = Date.now();
  return r;
}

/* ---------- validacion de lo que manda el panel ---------- */
function id(x) { return /^[a-z0-9-]{6,40}$/i.test(String(x && x.id || '')) ? String(x.id) : crypto.randomUUID().slice(0, 8); }
const LIMPIAR = {
  bloqueos: function (x) {
    if (!fechaOk(x.desde) || !fechaOk(x.hasta)) throw falla(400, 'Bloqueo: poné las dos fechas.');
    if (x.hasta < x.desde) throw falla(400, 'Bloqueo: la fecha "hasta" es anterior a "desde".');
    const alcance = ALCANCES.indexOf(x.alcance) >= 0 ? x.alcance : 'todo';
    const valor = alcance === 'todo' ? '' : txt(x.valor, 260);
    if (alcance !== 'todo' && !valor) throw falla(400, 'Bloqueo: elegí ' + (alcance === 'destino' ? 'el destino' : alcance === 'proveedor' ? 'el proveedor' : 'el servicio') + '.');
    return { id: id(x), desde: x.desde, hasta: x.hasta, alcance: alcance, valor: valor, nombre: txt(x.nombre, 200), motivo: txt(x.motivo, 200) };
  },
  cupos: function (x) {
    const clave = txt(x.clave, 260);
    if (!/^[a-z0-9_-]{2,30}#.{2,}$/.test(clave)) throw falla(400, 'Cupo: elegí el servicio.');
    const cupo = x.cupo_dia === '' || x.cupo_dia == null ? null : Math.round(numEn(x.cupo_dia, 1, 999, 'Cupo por día'));
    const no = (Array.isArray(x.no_opera) ? x.no_opera : []).map(Number).filter(function (d, i, a) { return d >= 0 && d <= 6 && a.indexOf(d) === i; }).sort();
    if (cupo == null && !no.length) throw falla(400, 'Cupo: poné un cupo por día o marcá algún día que no opera.');
    return { clave: clave, cupo_dia: cupo, no_opera: no, nota: txt(x.nota, 200) };
  },
  temporadas: function (x) {
    if (!mmddOk(x.desde) || !mmddOk(x.hasta)) throw falla(400, 'Temporada: poné desde y hasta como día y mes.');
    const pct = numEn(x.pct, -50, 200, 'Temporada');
    if (!pct) throw falla(400, 'Temporada: el porcentaje no puede ser 0.');
    const destinos = (Array.isArray(x.destinos) ? x.destinos : []).map(function (d) { return txt(d, 30).toLowerCase(); }).filter(function (d) { return /^[a-z0-9_-]{2,30}$/.test(d); }).slice(0, 80);
    return { id: id(x), nombre: txt(x.nombre, 80) || 'Temporada', desde: x.desde, hasta: x.hasta, pct: pct, aplica: APLICA.indexOf(x.aplica) >= 0 ? x.aplica : 'todo', destinos: destinos, activo: x.activo !== false };
  },
  combos: function (x) {
    const pct = numEn(x.pct, 0.5, 50, 'Combo');
    const min = Math.round(numEn(x.min_tours, 0, 10, 'Tours mínimos'));
    if (!min && !x.con_traslado) throw falla(400, 'Combo: pedí al menos un tour o el traslado.');
    return { id: id(x), nombre: txt(x.nombre, 80) || 'Combo', min_tours: min, con_traslado: x.con_traslado === true, pct: pct, activo: x.activo !== false };
  }
};
async function guardar(parte, valor, usuario) {
  if (PARTES.indexOf(parte) < 0) throw falla(400, 'Parte desconocida.');
  let limpio;
  if (parte === 'alerta_cotizacion') {
    const actual = (await leer()).alerta_cotizacion;
    limpio = { umbral_pct: numEn(valor && valor.umbral_pct, 0.5, 50, 'Umbral'), ultimo_aviso: actual.ultimo_aviso || '' };
  } else {
    const lista = (Array.isArray(valor) ? valor : []).slice(0, 500).map(LIMPIAR[parte]);
    if (parte === 'cupos') { const vistos = {}; lista.forEach(function (c) { if (vistos[c.clave]) throw falla(400, 'Ese servicio ya tiene cupo: editá la fila que ya está.'); vistos[c.clave] = 1; }); }
    limpio = { lista: lista };
  }
  await escribir(parte, limpio, usuario);
  return (await leer())[parte];
}
async function escribir(parte, valor, usuario) {
  if (supa()) {
    await rest('POST', 'operaciones_config?on_conflict=clave', [{ clave: 'regla_' + parte, valor: valor, actualizado_at: new Date().toISOString(), actualizado_por: txt(usuario, 80) }], { Prefer: 'resolution=merge-duplicates' });
  } else {
    if (process.env.VERCEL) throw falla(503, 'Falta configurar Supabase.');
    const db = leerArchivo(); db[parte] = valor;
    fs.mkdirSync(path.dirname(archivo()), { recursive: true }); fs.writeFileSync(archivo(), JSON.stringify(db, null, 1));
  }
  invalidar();
}

/* ---------- catalogo y ocupacion ---------- */
/* [{ clave, destino, titulo, proveedor_id, tipo }]. Con Supabase sale de la tabla (trae el proveedor); sin ella, del
   catalogo de lib/tours.js. */
let cacheCat = null, cacheCatEn = 0;
async function catalogo() {
  if (cacheCat && Date.now() - cacheCatEn < TTL_MS) return cacheCat;
  let lista = [];
  if (supa()) {
    const filas = await rest('GET', 'tours?select=id,destino,titulo,proveedor_id,tipo,activo,eliminado_at&order=destino.asc,titulo.asc').catch(function () { return null; });
    if (filas) lista = filas.filter(function (t) { return !t.eliminado_at; }).map(function (t) { return { id: t.id, clave: t.destino + '#' + t.titulo, destino: t.destino, titulo: t.titulo, proveedor_id: t.proveedor_id || '', tipo: t.tipo || 'tour', activo: t.activo !== false }; });
  }
  if (!lista.length) {
    const ts = await require('./tours').todos().catch(function () { return []; });
    lista = (ts || []).map(function (t) { const d = (t.destinations || [])[0] || ''; return { clave: d + '#' + t.title, destino: d, titulo: t.title, proveedor_id: '', tipo: 'tour', activo: true }; });
  }
  cacheCat = lista; cacheCatEn = Date.now();
  return lista;
}
function porTitulo(cat, nombre) {
  const n = norm(nombre);
  if (!n) return null;
  return cat.filter(function (s) { return norm(s.titulo) === n; })[0] || cat.filter(function (s) { const t = norm(s.titulo); return t && (n.indexOf(t) === 0 || t.indexOf(n) === 0); })[0] || null;
}
/* Personas ocupadas por servicio y dia: { "titulo sin tildes|2026-10-16": 6 }. */
function ocupacionDe(lista) {
  const o = {};
  (lista || []).forEach(function (p) {
    if (p.estado === 'cancelado') return;
    (p.items || []).forEach(function (i) {
      if (!i.nombre || !i.fecha_servicio || i.estado === 'cancelado') return;
      const k = norm(i.nombre) + '|' + i.fecha_servicio;
      o[k] = (o[k] || 0) + (Number(p.personas) || 1);
    });
  });
  return o;
}
let cacheOcup = null, cacheOcupEn = 0;
async function ocupacion() {
  if (cacheOcup && Date.now() - cacheOcupEn < TTL_MS) return cacheOcup;
  const lista = await require('./pedidos').listarPedidos().catch(function () { return []; });
  cacheOcup = ocupacionDe(lista); cacheOcupEn = Date.now();
  return cacheOcup;
}

/* ---------- la cuenta ---------- */
function bloqueoDe(R, svc, fecha) {
  return (R.bloqueos || []).filter(function (b) {
    if (fecha < b.desde || fecha > b.hasta) return false;
    if (b.alcance === 'todo') return true;
    if (b.alcance === 'destino') return b.valor === svc.destino;
    if (b.alcance === 'proveedor') return !!svc.proveedor_id && b.valor === svc.proveedor_id;
    return b.valor === svc.clave;
  })[0] || null;
}
function cupoDe(R, svc) { return (R.cupos || []).filter(function (c) { return c.clave === svc.clave; })[0] || null; }
/* null si se puede ese dia; si no, el motivo. ocup: ocupacionDe(); pax: las personas que quieren reservar. */
function motivoDia(R, svc, fecha, pax, ocup) {
  const b = bloqueoDe(R, svc, fecha);
  if (b) return b.motivo || 'Fecha bloqueada';
  const c = cupoDe(R, svc);
  if (!c) return null;
  if (c.no_opera && c.no_opera.indexOf(dow(fecha)) >= 0) return 'No opera los ' + DIAS[dow(fecha)];
  if (c.cupo_dia) {
    const usado = (ocup && ocup[norm(svc.titulo) + '|' + fecha]) || 0;
    if (usado + (pax || 1) > c.cupo_dia) return usado >= c.cupo_dia ? 'Sin cupo' : 'Quedan ' + (c.cupo_dia - usado) + ' lugares';
  }
  return null;
}
function diasDel(ida, vuelta) {
  if (!fechaOk(ida)) return [];
  const fin = fechaOk(vuelta) && vuelta >= ida ? vuelta : ida, out = [];
  for (let d = ida; d <= fin && out.length < MAX_DIAS_VIAJE; d = mas(d, 1)) out.push(d);
  return out;
}
/* Para un servicio y un viaje: { libres: [dias], no: [{ fecha, motivo }] }. */
function enViaje(R, svc, ida, vuelta, pax, ocup) {
  const libres = [], no = [];
  diasDel(ida, vuelta).forEach(function (d) { const m = motivoDia(R, svc, d, pax, ocup); if (m) no.push({ fecha: d, motivo: m }); else libres.push(d); });
  return { libres: libres, no: no };
}
function hayCupos(R) { return (R.cupos || []).some(function (c) { return c.cupo_dia; }); }

function enTemporada(t, fecha) {
  const md = String(fecha || '').slice(5);
  if (!/^\d{2}-\d{2}$/.test(md)) return false;
  return t.desde <= t.hasta ? md >= t.desde && md <= t.hasta : md >= t.desde || md <= t.hasta;
}
/* La temporada que corre para ese destino, esa fecha y ese tipo ('tours' | 'traslados'), o null. Si hay dos, la del
   destino gana sobre la general, y entre iguales la de mayor %. */
function temporadaDe(R, destino, fecha, tipo) {
  const ok = (R.temporadas || []).filter(function (t) {
    return t.activo !== false && (t.aplica === 'todo' || t.aplica === tipo) && (!t.destinos.length || t.destinos.indexOf(destino) >= 0) && enTemporada(t, fecha);
  }).sort(function (a, b) { return (b.destinos.length ? 1 : 0) - (a.destinos.length ? 1 : 0) || b.pct - a.pct; });
  return ok[0] ? { nombre: ok[0].nombre, pct: ok[0].pct } : null;
}
function conPct(precio, pct) { return Math.round(Number(precio) * (1 + pct / 100) * 100) / 100; }

/* El mejor combo para lo elegido: { tours, traslado }. */
function comboPara(R, sel) {
  return (R.combos || []).filter(function (c) { return c.activo !== false && (sel.tours || 0) >= c.min_tours && (!c.con_traslado || sel.traslado); })
    .sort(function (a, b) { return b.pct - a.pct; })[0] || null;
}

/* Para la web: que tours no se pueden en el viaje, cuales tienen dias sin lugar, la temporada y los combos. */
async function paraViaje(destinos, ida, vuelta, pax) {
  const R = await leer(), cat = await catalogo();
  const ocup = hayCupos(R) ? await ocupacion() : {};
  const out = { no: [], parcial: [], temporada: {}, combos: (R.combos || []).filter(function (c) { return c.activo !== false; }).map(function (c) { return { nombre: c.nombre, min_tours: c.min_tours, con_traslado: c.con_traslado, pct: c.pct }; }) };
  if (!fechaOk(ida)) return out;
  destinos.forEach(function (d) {
    out.temporada[d] = { tours: temporadaDe(R, d, ida, 'tours'), traslados: temporadaDe(R, d, ida, 'traslados') };
    cat.filter(function (s) { return s.destino === d; }).forEach(function (s) {
      const v = enViaje(R, s, ida, vuelta, pax, ocup);
      if (!v.no.length) return;
      if (!v.libres.length) out.no.push({ titulo: s.titulo, destino: d, motivo: v.no[0].motivo });
      else out.parcial.push({ titulo: s.titulo, destino: d, dias: v.libres });
    });
  });
  return out;
}

/* /api/cotizar: saca los tours sin lugar en el viaje y les aplica la temporada. No tira: sin reglas, la lista tal cual. */
async function aplicarATours(lista, destino, ida, vuelta, pax) {
  if (!Array.isArray(lista) || !lista.length) return lista;
  try {
    const R = await leer();
    if (!R.bloqueos.length && !R.cupos.length && !R.temporadas.length) return lista;
    const v = await paraViaje([destino], ida, vuelta, pax);
    const fuera = {}; v.no.forEach(function (x) { fuera[norm(x.titulo)] = 1; });
    const t = v.temporada[destino] && v.temporada[destino].tours;
    return lista.filter(function (x) { return !fuera[norm(x.title)]; }).map(function (x) {
      return t && Number(x.price) > 0 ? Object.assign({}, x, { price: conPct(x.price, t.pct), temporada: t.nombre }) : x;
    });
  } catch (e) { console.warn('[reglas] tours:', e.message); return lista; }
}

/* POST /api/reserva-solicitud: los tours pedidos que no tienen ningun dia libre en el viaje. [] si se puede todo. */
async function sinLugar(b) {
  b = b || {};
  const R = await leer();
  if (!R.bloqueos.length && !R.cupos.length) return [];
  const cat = await catalogo(), ocup = hayCupos(R) ? await ocupacion() : {};
  const pax = Math.max(1, Math.min(60, Math.round(Number(b.personas_n)) || 1));
  return (Array.isArray(b.servicios) ? b.servicios : []).filter(function (s) { return s && s.tipo === 'tour'; }).map(function (s) {
    const svc = porTitulo(cat, s.nombre);
    if (!svc) return null;
    const v = enViaje(R, svc, b.fecha_ida, b.fecha_vuelta, pax, ocup);
    return v.libres.length || !v.no.length ? null : { nombre: svc.titulo, motivo: v.no[0].motivo };
  }).filter(Boolean);
}

/* ---------- cotizacion del real ---------- */
async function cotizacion(tasas) {
  const R = await leer();
  let publicada = 0, fuente = '', margen = null, dias = null;
  try { const c = await require('./operaciones')._config(); publicada = c.cotizacion; fuente = c.cotizacion_fuente; margen = c.margen; dias = c.dias_desactualizado; } catch (e) { /* sin Supabase */ }
  const t = tasas ? await tasas().catch(function () { return null; }) : null;
  const mercado = Number(t && t.rates && t.rates.BRL) || 0;
  const dif = publicada > 0 && mercado > 0 ? Math.round((mercado - publicada) / publicada * 1000) / 10 : null;
  const umbral = Number(R.alerta_cotizacion.umbral_pct) || 3;
  return { publicada: publicada, fuente: fuente, margen: margen, dias_desactualizado: dias, mercado: mercado ? Math.round(mercado * 10000) / 10000 : 0, fuente_mercado: (t && t.source) || '', dif_pct: dif, umbral_pct: umbral, alerta: dif != null && Math.abs(dif) >= umbral };
}
/* Cron diario: si la cotizacion del dia se alejo de la publicada mas que el umbral, un mail por dia al panel. */
async function revisarCotizacion(tasas) {
  const c = await cotizacion(tasas);
  if (!c.alerta) return { alerta: false, dif_pct: c.dif_pct };
  const R = await leer(), hoy = hoyUY();
  if (R.alerta_cotizacion.ultimo_aviso === hoy) return { alerta: true, avisado: false, dif_pct: c.dif_pct };
  const para = String(process.env.ADMIN_NOTIFY_EMAIL || process.env.RESERVAS_EMAIL || '').trim();
  if (!para) return { alerta: true, avisado: false, dif_pct: c.dif_pct, motivo: 'sin ADMIN_NOTIFY_EMAIL' };
  const sube = c.mercado > c.publicada;
  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#101828;max-width:520px"><h2 style="margin:0 0 12px">La cotización del real se movió ' + (c.dif_pct > 0 ? '+' : '') + c.dif_pct + ' %</h2>' +
    '<p>Publicada en el catálogo: <b>R$ ' + c.publicada + '</b> por dólar' + (c.fuente ? ' (' + c.fuente + ')' : '') + '.<br>Hoy: <b>R$ ' + c.mercado + '</b>.</p>' +
    '<p>' + (sube ? 'El real se abarató: los tours en reales hoy te cuestan menos dólares de lo que cobrás. Podés bajar los precios.' : 'El real se encareció: los tours en reales te cuestan más dólares de lo que cobrás y el margen se achica.') + '</p>' +
    '<p>Para actualizarla: panel → Catálogo → Temporadas y combos → "Usar la de hoy". Los precios quedan en "Por publicar" para revisarlos.</p></div>';
  await require('./mail-cliente')._piezas.enviar(para, { asunto: 'Cotización del real: ' + (c.dif_pct > 0 ? '+' : '') + c.dif_pct + ' % contra el catálogo', html: html }, 'alerta_cotizacion');
  await escribir('alerta_cotizacion', Object.assign({}, R.alerta_cotizacion, { ultimo_aviso: hoy }), 'cron');
  return { alerta: true, avisado: true, dif_pct: c.dif_pct };
}

/* ---------- API ---------- */
/* Panel: GET /api/admin/reglas, POST /api/admin/reglas/guardar { parte, valor }. */
async function apiPanel(ruta, req, res, url, h) {
  if (ruta === '' && req.method === 'GET') {
    const r = await Promise.all([leer(), catalogo(), ocupacion(), cotizacion(h.tasas), require('./pedidos').listarProveedores().catch(function () { return []; })]);
    const R = r[0], cat = r[1], ocup = r[2];
    /* La ocupacion de los proximos 21 dias de los servicios con cupo, para la grilla del panel. */
    const dias = diasDel(hoyUY(), mas(hoyUY(), 20));
    const grilla = (R.cupos || []).map(function (c) {
      const svc = cat.filter(function (s) { return s.clave === c.clave; })[0] || { clave: c.clave, titulo: c.clave.split('#')[1] || c.clave, destino: c.clave.split('#')[0], proveedor_id: '' };
      return { clave: c.clave, titulo: svc.titulo, cupo_dia: c.cupo_dia, dias: dias.map(function (d) {
        const b = bloqueoDe(R, svc, d), cerrado = c.no_opera.indexOf(dow(d)) >= 0;
        return { fecha: d, usado: ocup[norm(svc.titulo) + '|' + d] || 0, bloqueado: b ? (b.motivo || 'Bloqueado') : '', cerrado: cerrado };
      }) };
    });
    const destinos = {}; cat.forEach(function (s) { destinos[s.destino] = 1; });
    return h.sendJson(res, 200, { reglas: R, servicios: cat, destinos: Object.keys(destinos).sort(), proveedores: (r[4] || []).filter(function (p) { return !p.eliminado_at; }).map(function (p) { return { id: p.id, nombre: p.nombre }; }), grilla: grilla, cotizacion: r[3], modo: supa() ? 'supabase' : (process.env.VERCEL ? 'sin-base' : 'archivo') });
  }
  if (ruta === 'guardar' && req.method === 'POST') {
    const b = (await h.readJson(req, 256 * 1024)) || {};
    return h.sendJson(res, 200, { parte: b.parte, valor: await guardar(String(b.parte || ''), b.valor, h.usuario) });
  }
  return h.sendJson(res, 404, { error: 'No existe.' });
}
/* Web: GET /api/disponibilidad?dest=fln&dest2=bombinhas&ida=2026-12-20&vuelta=2026-12-27&pax=2 */
async function apiPublica(req, res, url, h) {
  const destinos = [url.searchParams.get('dest'), url.searchParams.get('dest2')].map(function (d) { return String(d || '').toLowerCase(); }).filter(function (d) { return /^[a-z0-9_-]{2,30}$/.test(d); }).slice(0, 2);
  const ida = String(url.searchParams.get('ida') || ''), vuelta = String(url.searchParams.get('vuelta') || '');
  const pax = Math.max(1, Math.min(60, parseInt(url.searchParams.get('pax'), 10) || 1));
  if (!destinos.length || !fechaOk(ida)) return h.sendJson(res, 400, { error: 'Faltan destino y fechas.' });
  const r = await paraViaje(destinos, ida, vuelta, pax).catch(function (e) { console.warn('[reglas] web:', e.message); return { no: [], parcial: [], temporada: {}, combos: [] }; });
  res.setHeader('Cache-Control', 'public, max-age=60');
  return h.sendJson(res, 200, r);
}

module.exports = {
  leer: leer, guardar: guardar, invalidar: invalidar, catalogo: catalogo, ocupacionDe: ocupacionDe, porTitulo: porTitulo,
  motivoDia: motivoDia, enViaje: enViaje, temporadaDe: temporadaDe, comboPara: comboPara, conPct: conPct, paraViaje: paraViaje,
  aplicarATours: aplicarATours, sinLugar: sinLugar, cotizacion: cotizacion, revisarCotizacion: revisarCotizacion,
  apiPanel: apiPanel, apiPublica: apiPublica, norm: norm, DIAS: DIAS
};
