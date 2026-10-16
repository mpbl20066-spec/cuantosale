'use strict';
/*
 * Finanzas del panel /admin (etapa 1): transferencias que entran y salen, a que se asignan y lo que les debemos a
 * los proveedores. Tablas en sql/supabase_finanzas_1.sql; para volver atras, sql/supabase_finanzas_1_revertir.sql.
 *
 *   movimiento   una transferencia real, en su moneda (UYU, USD o BRL). Nace 'registrado'; pasa a 'verificado'
 *                solo a mano, con referencia o comprobante, despues de verla en el home banking. No hay integracion
 *                bancaria: nada se verifica solo.
 *   asignacion   que paga un movimiento: un cobro a un pedido, un Pix a una obligacion, un reembolso a un pedido.
 *                Un movimiento puede pagar varias cosas y una cosa se puede pagar en partes.
 *   obligacion   lo que le debemos a un proveedor por un servicio de un pedido, con moneda y vencimiento. El saldo
 *                no se escribe: sale de las asignaciones.
 *
 * Nada se borra: lo equivocado se anula con motivo y queda. Cada cambio deja una fila en `auditoria`.
 *
 * Monedas: nunca se suman monedas distintas. Una asignacion entre monedas distintas (un cobro en pesos a un pedido
 * en dolares) guarda los dos importes y el tipo de cambio queda fijo en la fila.
 *
 * Donde se guarda: igual que lib/pedidos.js. Con Supabase, en las tablas; sin Supabase (desarrollo local), en
 * data/_trabajo/finanzas.json (o FIN_ARCHIVO, que usan las pruebas).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MONEDAS = ['UYU', 'USD', 'BRL'];
const MEDIOS = ['transferencia', 'pix', 'deposito', 'efectivo', 'otro'];
const CONCEPTOS = ['sena', 'saldo', 'total', 'penalidad', 'ajuste'];
const MAX_COMPROBANTE = 3 * 1024 * 1024;   // Vercel no acepta cuerpos de mas de 4,5 MB y el archivo viaja en base64
const TABLAS = ['movimientos', 'obligaciones', 'asignaciones', 'auditoria'];

/* Pedidos y proveedores salen de lib/pedidos.js. Las pruebas lo cambian por uno de mentira. */
const deps = {
  pedidos: function () { return require('./pedidos'); }
};

/* ---------- errores y saneado ---------- */
function falla(status, msg, extra) { const e = new Error(msg); e.status = status; if (extra) Object.assign(e, extra); return e; }
function txt(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }
function r2(n) { return Math.round(n * 100) / 100; }
function uid() { return crypto.randomUUID(); }
function hoyUY(ahora) { return new Date((ahora || Date.now()) - 3 * 3600e3).toISOString().slice(0, 10); }
function fechaISO(v) { const s = txt(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z')) ? s : null; }
function sumarDias(f, n) { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/* Importe como lo escribe la gente: 1234.5, "1.234,50", "1234,5", "R$ 1.200". Devuelve null si no es un numero > 0. */
function importe(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 && v < 1e9 ? r2(v) : null;
  let s = String(v == null ? '' : v).replace(/[^0-9.,-]/g, '');
  if (!s || s.indexOf('-') >= 0) return null;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 1e9 ? r2(n) : null;
}
function moneda(v) { const s = txt(v, 3).toUpperCase(); return MONEDAS.indexOf(s) >= 0 ? s : null; }
function normRef(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function esId(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '')); }

/* La misma transferencia da siempre la misma huella. Sin numero de operacion se usa quien la mando: dos
   transferencias iguales del mismo dia y de la misma persona piden poner la referencia para distinguirlas. */
function huella(m) {
  return [m.sentido, m.moneda, Number(m.importe).toFixed(2), m.fecha, normRef(m.referencia) || 'c:' + normRef(m.contraparte)].join('|');
}

function limpiarMovimiento(b, ahora) {
  b = b && typeof b === 'object' ? b : {};
  const m = {
    sentido: b.sentido === 'entrada' || b.sentido === 'salida' ? b.sentido : null,
    medio: MEDIOS.indexOf(b.medio) >= 0 ? b.medio : 'transferencia',
    cuenta: txt(b.cuenta, 60),
    fecha: fechaISO(b.fecha),
    moneda: moneda(b.moneda),
    importe: importe(b.importe),
    referencia: txt(b.referencia, 80),
    contraparte: txt(b.contraparte, 120),
    nota: txt(b.nota, 300)
  };
  if (!m.sentido) throw falla(400, 'Falta decir si la plata entró o salió.');
  if (!m.moneda) throw falla(400, 'Elegí la moneda: pesos (UYU), dólares (USD) o reales (BRL).');
  if (!m.importe) throw falla(400, 'Escribí el importe, mayor que cero.');
  if (!m.fecha) throw falla(400, 'Falta la fecha de la transferencia.');
  if (m.fecha > sumarDias(hoyUY(ahora), 1)) throw falla(400, 'La fecha es del futuro: poné el día en que se acreditó.');
  if (!m.referencia && !m.contraparte) throw falla(400, 'Poné el número de operación o quién la mandó/recibió: sin eso no se pueden detectar duplicados.');
  m.huella = huella(m);
  return m;
}

/* ---------- cuentas (sin tocar la base: las pruebas las usan directo) ---------- */
function asignacionCuenta(a, movs) {
  const m = movs[a.movimiento_id];
  return !a.anulada && m && m.estado !== 'anulado';
}
/* Saldos de cada movimiento, obligacion y pedido. db = { movimientos, obligaciones, asignaciones }. */
function calcular(db, ahora) {
  const hoy = hoyUY(ahora), en7 = sumarDias(hoy, 7);
  const movs = {}; (db.movimientos || []).forEach(function (m) { movs[m.id] = m; });
  const activas = (db.asignaciones || []).filter(function (a) { return asignacionCuenta(a, movs); });

  const asignadoMov = {};
  activas.forEach(function (a) { asignadoMov[a.movimiento_id] = r2((asignadoMov[a.movimiento_id] || 0) + Number(a.importe)); });
  const movimientos = (db.movimientos || []).map(function (m) {
    const asignado = asignadoMov[m.id] || 0;
    return Object.assign({}, m, { asignado: asignado, libre: m.estado === 'anulado' ? 0 : r2(Math.max(0, Number(m.importe) - asignado)) });
  });

  const pagos = {};
  activas.forEach(function (a) {
    if (a.tipo !== 'pago') return;
    const x = pagos[a.obligacion_id] || (pagos[a.obligacion_id] = { verificado: 0, por_verificar: 0 });
    x[movs[a.movimiento_id].estado === 'verificado' ? 'verificado' : 'por_verificar'] += Number(a.importe_destino);
  });
  const obligaciones = (db.obligaciones || []).map(function (o) {
    const p = pagos[o.id] || { verificado: 0, por_verificar: 0 };
    const ver = r2(p.verificado), porVer = r2(p.por_verificar), imp = Number(o.importe);
    const saldo = r2(Math.max(0, imp - ver - porVer));
    let estado;
    if (o.estado === 'anulada') estado = 'anulada';
    else if (ver + 0.005 >= imp) estado = 'pagada';
    else if (ver + porVer + 0.005 >= imp) estado = 'por_verificar';
    else if (o.vence && o.vence < hoy) estado = 'vencida';
    else if (ver + porVer > 0) estado = 'parcial';
    else estado = 'pendiente';
    return Object.assign({}, o, {
      pagado: ver, por_verificar: porVer, saldo: o.estado === 'anulada' ? 0 : saldo, situacion: estado,
      vence_pronto: estado !== 'anulada' && saldo > 0 && !!o.vence && o.vence >= hoy && o.vence <= en7
    });
  });

  /* Lo cobrado a cada pedido, en dolares (la moneda de los pedidos): verificado y por verificar. */
  const pedidos = {};
  activas.forEach(function (a) {
    if (a.tipo === 'pago') return;
    const x = pedidos[a.pedido_id] || (pedidos[a.pedido_id] = { ref: a.pedido_ref, cobrado_usd: 0, por_verificar_usd: 0, reembolsado_usd: 0 });
    const ok = movs[a.movimiento_id].estado === 'verificado', v = Number(a.importe_destino);
    if (a.tipo === 'cobro') x[ok ? 'cobrado_usd' : 'por_verificar_usd'] = r2(x[ok ? 'cobrado_usd' : 'por_verificar_usd'] + v);
    else if (ok) x.reembolsado_usd = r2(x.reembolsado_usd + v);
  });

  /* Totales: siempre por moneda, nunca mezclados. */
  const porMoneda = function () { const o = {}; MONEDAS.forEach(function (k) { o[k] = 0; }); return o; };
  const k = {
    por_verificar: { n: 0, entrada: porMoneda(), salida: porMoneda() },
    a_pagar: porMoneda(), vencidas: { n: 0, monto: porMoneda() }, proximas: { n: 0, monto: porMoneda() },
    sin_asignar: { n: 0, monto: porMoneda() }
  };
  movimientos.forEach(function (m) {
    if (m.estado === 'registrado') { k.por_verificar.n++; k.por_verificar[m.sentido][m.moneda] = r2(k.por_verificar[m.sentido][m.moneda] + Number(m.importe)); }
    if (m.estado !== 'anulado' && m.libre > 0) { k.sin_asignar.n++; k.sin_asignar.monto[m.moneda] = r2(k.sin_asignar.monto[m.moneda] + m.libre); }
  });
  obligaciones.forEach(function (o) {
    if (o.situacion === 'anulada' || !o.saldo) return;
    k.a_pagar[o.moneda] = r2(k.a_pagar[o.moneda] + o.saldo);
    if (o.situacion === 'vencida') { k.vencidas.n++; k.vencidas.monto[o.moneda] = r2(k.vencidas.monto[o.moneda] + o.saldo); }
    if (o.vence_pronto) { k.proximas.n++; k.proximas.monto[o.moneda] = r2(k.proximas.monto[o.moneda] + o.saldo); }
  });
  return { hoy: hoy, movimientos: movimientos, obligaciones: obligaciones, asignaciones: db.asignaciones || [], pedidos: pedidos, kpis: k };
}

/* Valida una asignacion contra lo que hay. Devuelve la fila lista para guardar. */
function prepararAsignacion(b, db, ahora) {
  b = b && typeof b === 'object' ? b : {};
  const c = calcular(db, ahora);
  const mov = c.movimientos.filter(function (m) { return m.id === b.movimiento_id; })[0];
  if (!mov) throw falla(404, 'No encontré esa transferencia.');
  if (mov.estado === 'anulado') throw falla(409, 'Esa transferencia está anulada.');
  const tipo = b.tipo;
  if (['cobro', 'pago', 'reembolso'].indexOf(tipo) < 0) throw falla(400, 'Tipo de asignación inválido.');
  if (tipo === 'cobro' && mov.sentido !== 'entrada') throw falla(400, 'Un cobro tiene que ser plata que entró.');
  if (tipo !== 'cobro' && mov.sentido !== 'salida') throw falla(400, 'Un pago o un reembolso tiene que ser plata que salió.');
  const imp = importe(b.importe);
  if (!imp) throw falla(400, 'Escribí cuánto de la transferencia va a esto.');
  if (imp > mov.libre + 0.005) throw falla(409, 'De esa transferencia quedan ' + mov.moneda + ' ' + mov.libre + ' sin asignar.');

  const fila = { id: uid(), movimiento_id: mov.id, tipo: tipo, importe: imp, nota: txt(b.nota, 200), pedido_id: null, pedido_ref: '', obligacion_id: null };
  if (tipo === 'pago') {
    const o = c.obligaciones.filter(function (x) { return x.id === b.obligacion_id; })[0];
    if (!o) throw falla(404, 'No encontré esa obligación.');
    if (o.situacion === 'anulada') throw falla(409, 'Esa obligación está anulada.');
    fila.obligacion_id = o.id; fila.moneda_destino = o.moneda;
    fila.pedido_id = o.pedido_id || null; fila.pedido_ref = o.pedido_ref || '';
  } else {
    if (!esId(b.pedido_id)) throw falla(400, 'Elegí el pedido.');
    fila.pedido_id = b.pedido_id; fila.pedido_ref = txt(b.pedido_ref, 40); fila.moneda_destino = 'USD';
  }
  if (fila.moneda_destino === mov.moneda) { fila.importe_destino = imp; fila.tc = 1; }
  else {
    const eq = importe(b.importe_destino);
    if (!eq) throw falla(400, 'La transferencia es en ' + mov.moneda + ' y esto va en ' + fila.moneda_destino + ': escribí cuánto equivale en ' + fila.moneda_destino + '.');
    fila.importe_destino = eq; fila.tc = Math.round(eq / imp * 1e6) / 1e6;
  }
  if (tipo === 'pago') {
    const o = c.obligaciones.filter(function (x) { return x.id === fila.obligacion_id; })[0];
    if (fila.importe_destino > o.saldo + 0.005) throw falla(409, 'A esa obligación le faltan ' + o.moneda + ' ' + o.saldo + ': no se puede pagar de más.');
  }
  return fila;
}

/* ---------- almacenamiento ---------- */
function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function modo() { return supa() ? 'supabase' : (process.env.VERCEL ? 'sin-base' : 'archivo'); }
function archivo() { return process.env.FIN_ARCHIVO || path.join(__dirname, '..', 'data', '_trabajo', 'finanzas.json'); }
let cache = null;
function leerArchivo() {
  if (cache && cache.ruta === archivo()) return cache.db;
  let db = {};
  try { db = JSON.parse(fs.readFileSync(archivo(), 'utf8')); } catch (e) { db = {}; }
  TABLAS.forEach(function (t) { db[t] = db[t] || []; });
  if (!db.config) db.config = { activo: true };
  cache = { ruta: archivo(), db: db };
  return db;
}
function escribirArchivo() { fs.mkdirSync(path.dirname(archivo()), { recursive: true }); fs.writeFileSync(archivo(), JSON.stringify(cache.db, null, 1)); }
function _reiniciar() { cache = null; }

async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const t = await r.text();
  if (!r.ok) {
    const msg = (t.match(/"message":"([^"]+)"/) || [])[1] || '';
    if (/23505/.test(t)) throw falla(409, 'Esa transferencia ya está cargada.', { duplicado: true });
    if (r.status === 404 || /PGRST205|42P01/.test(t)) throw falla(503, 'Faltan las tablas de Finanzas: corré sql/supabase_finanzas_1.sql en Supabase.', { sinTablas: true });
    if (/P0001/.test(t)) throw falla(409, msg || 'La base no dejó hacer ese cambio.');
    if (/23503/.test(t)) throw falla(409, 'Lo que querés vincular ya no existe (pedido, proveedor u obligación).');
    if (/23514/.test(t)) throw falla(400, 'La base rechazó un dato: ' + msg);
    throw falla(502, 'Supabase respondió HTTP ' + r.status + ': ' + t.slice(0, 200));
  }
  try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
}
function sinBase() { return falla(503, 'Falta configurar Supabase para guardar Finanzas.'); }

async function todo() {
  if (modo() === 'supabase') {
    const r = await Promise.all(['movimientos', 'obligaciones', 'asignaciones'].map(function (t) {
      return rest('GET', t + '?select=*&order=creado_at.desc&limit=5000');
    }));
    return { movimientos: r[0] || [], obligaciones: r[1] || [], asignaciones: r[2] || [] };
  }
  if (modo() === 'sin-base') throw sinBase();
  const db = leerArchivo();
  return { movimientos: db.movimientos.slice(), obligaciones: db.obligaciones.slice(), asignaciones: db.asignaciones.slice() };
}
async function insertar(tabla, fila) {
  fila = Object.assign({ creado_at: new Date().toISOString() }, fila);
  if (modo() === 'supabase') { const f = await rest('POST', tabla, fila, { Prefer: 'return=representation' }); return f && f[0]; }
  if (modo() === 'sin-base') throw sinBase();
  const db = leerArchivo();
  if (tabla === 'movimientos' && db.movimientos.some(function (m) { return m.huella === fila.huella && m.estado !== 'anulado'; })) throw falla(409, 'Esa transferencia ya está cargada.', { duplicado: true });
  db[tabla].unshift(fila); escribirArchivo();
  return fila;
}
async function actualizar(tabla, id, cambios) {
  if (modo() === 'supabase') { const f = await rest('PATCH', tabla + '?id=eq.' + encodeURIComponent(id), cambios, { Prefer: 'return=representation' }); return f && f[0]; }
  if (modo() === 'sin-base') throw sinBase();
  const db = leerArchivo();
  const i = db[tabla].findIndex(function (x) { return x.id === id; });
  if (i < 0) return null;
  db[tabla][i] = Object.assign({}, db[tabla][i], cambios); escribirArchivo();
  return db[tabla][i];
}
async function uno(tabla, id) {
  if (!esId(id)) return null;
  if (modo() === 'supabase') { const f = await rest('GET', tabla + '?select=*&limit=1&id=eq.' + id); return (f && f[0]) || null; }
  if (modo() === 'sin-base') throw sinBase();
  return leerArchivo()[tabla].filter(function (x) { return x.id === id; })[0] || null;
}

/* La auditoria se escribe despues del cambio. Si falla, el cambio ya esta hecho: se avisa en el log del server y la
   respuesta lo dice, pero no se deshace lo que si se guardo. */
async function auditar(quien, entidad, id, accion, antes, despues) {
  const fila = { usuario: txt(quien.usuario, 80), ip: txt(quien.ip, 60), entidad: entidad, entidad_id: String(id || ''), accion: accion, antes: antes || null, despues: despues || null };
  try {
    if (modo() === 'supabase') { await rest('POST', 'auditoria', fila, { Prefer: 'return=minimal' }); return true; }
    const db = leerArchivo();
    db.auditoria.unshift(Object.assign({ id: db.auditoria.length + 1, at: new Date().toISOString() }, fila)); escribirArchivo();
    return true;
  } catch (e) { console.error('[finanzas] no se pudo auditar', accion, id, e.message); return false; }
}
async function auditoria(entidad, id) {
  if (modo() === 'supabase') {
    let q = 'auditoria?select=*&order=at.desc&limit=200';
    if (entidad) q += '&entidad=eq.' + encodeURIComponent(entidad);
    if (id) q += '&entidad_id=eq.' + encodeURIComponent(id);
    return (await rest('GET', q)) || [];
  }
  return leerArchivo().auditoria.filter(function (a) { return (!entidad || a.entidad === entidad) && (!id || a.entidad_id === id); }).slice(0, 200);
}

/* ---------- llave ---------- */
async function estado() {
  if (modo() === 'sin-base') return { activo: false, tablas: false, modo: modo(), motivo: 'Falta configurar Supabase.' };
  if (modo() === 'archivo') return { activo: leerArchivo().config.activo !== false, tablas: true, modo: modo() };
  let activo = false;
  try {
    const c = await rest('GET', 'operaciones_config?select=valor&clave=eq.finanzas');
    activo = !!(c && c[0] && c[0].valor && c[0].valor.activo === true);
    await rest('GET', 'movimientos?select=id&limit=1');
    return { activo: activo, tablas: true, modo: modo() };
  } catch (e) {
    if (e.sinTablas) return { activo: false, tablas: false, modo: modo(), motivo: e.message };
    throw e;
  }
}

/* ---------- acciones ---------- */
async function registrarMovimiento(b, quien) {
  const m = limpiarMovimiento(b);
  const db = await todo();
  const ya = db.movimientos.filter(function (x) { return x.huella === m.huella && x.estado !== 'anulado'; })[0];
  if (ya) throw falla(409, 'Esa transferencia ya está cargada (' + ya.fecha + ', ' + ya.moneda + ' ' + ya.importe + '). Si es otra distinta, poné su número de operación.', { duplicado: true, id: ya.id });
  /* Mismo importe y moneda en +-2 dias con otra referencia: puede ser la misma cargada distinto. Se pide confirmar. */
  if (!b.confirmar_parecido) {
    const parecido = db.movimientos.filter(function (x) {
      return x.estado !== 'anulado' && x.sentido === m.sentido && x.moneda === m.moneda && Math.abs(Number(x.importe) - m.importe) < 0.005 &&
        Math.abs(Date.parse(x.fecha) - Date.parse(m.fecha)) <= 2 * 864e5;
    })[0];
    if (parecido) throw falla(409, 'Hay otra transferencia de ' + m.moneda + ' ' + m.importe + ' del ' + parecido.fecha + (parecido.contraparte ? ' (' + parecido.contraparte + ')' : '') + '. ¿Es otra distinta?', { parecido: true, id: parecido.id });
  }
  /* Las asignaciones que vienen con el movimiento se validan TODAS antes de guardar nada. */
  const pedidosMod = deps.pedidos();
  const fila = Object.assign({ id: uid(), estado: 'registrado', verificado_por: '', anulado_por: '', anulado_motivo: '', comprobante: '', creado_por: txt(quien.usuario, 80) }, m);
  const sim = { movimientos: [fila].concat(db.movimientos), obligaciones: db.obligaciones, asignaciones: db.asignaciones.slice() };
  const asigs = [];
  for (const a of (Array.isArray(b.asignaciones) ? b.asignaciones : []).slice(0, 20)) {
    if (a.tipo !== 'pago') {
      const p = await pedidosMod.obtenerPedido(a.pedido_id);
      if (!p) throw falla(404, 'No encontré el pedido.');
      a.pedido_ref = p.ref;
    }
    const x = prepararAsignacion(Object.assign({}, a, { movimiento_id: fila.id }), sim);
    x.creado_por = fila.creado_por;
    sim.asignaciones.push(x); asigs.push(x);
  }
  const guardado = await insertar('movimientos', fila);
  await auditar(quien, 'movimiento', fila.id, 'registrar', null, guardado);
  const hechas = [];
  try {
    for (const x of asigs) { const g = await insertar('asignaciones', x); hechas.push(g); await auditar(quien, 'asignacion', x.id, 'asignar', null, g); }
  } catch (e) {
    /* Sin transacciones por REST: si una asignacion falla a mitad, el movimiento se anula para que no quede a medias. */
    await anularMovimiento(fila.id, 'Se anuló solo: falló una de sus asignaciones (' + e.message.slice(0, 80) + ')', quien).catch(function () {});
    throw e;
  }
  return { movimiento: guardado, asignaciones: hechas };
}

async function verificar(id, b, quien) {
  b = b || {};
  if (b.confirmo !== true) throw falla(400, 'Marcá que la viste acreditada en el home banking.');
  const m = await uno('movimientos', id);
  if (!m) throw falla(404, 'No encontré esa transferencia.');
  if (m.estado !== 'registrado') throw falla(409, m.estado === 'verificado' ? 'Ya estaba verificada.' : 'Está anulada: no se puede verificar.');
  const cambios = { estado: 'verificado', verificado_por: txt(quien.usuario, 80) || 'admin', verificado_at: new Date().toISOString() };
  const ref = txt(b.referencia, 80);
  if (ref && !m.referencia) { cambios.referencia = ref; cambios.huella = huella(Object.assign({}, m, { referencia: ref })); }
  if (!(cambios.referencia || m.referencia) && !m.comprobante) throw falla(400, 'Para verificarla poné el número de operación o subí el comprobante.');
  const g = await actualizar('movimientos', id, cambios);
  await auditar(quien, 'movimiento', id, 'verificar', m, g);
  return g;
}

function motivo(v) { const s = txt(v, 300); if (s.length < 3) throw falla(400, 'Escribí el motivo.'); return s; }

async function anularMovimiento(id, mot, quien) {
  const s = motivo(mot);
  const m = await uno('movimientos', id);
  if (!m) throw falla(404, 'No encontré esa transferencia.');
  if (m.estado === 'anulado') throw falla(409, 'Ya estaba anulada.');
  const g = await actualizar('movimientos', id, { estado: 'anulado', anulado_por: txt(quien.usuario, 80) || 'admin', anulado_at: new Date().toISOString(), anulado_motivo: s });
  await auditar(quien, 'movimiento', id, 'anular', m, g);
  return g;
}

async function asignar(b, quien) {
  b = b || {};
  if (b.tipo !== 'pago') {
    const p = await deps.pedidos().obtenerPedido(b.pedido_id);
    if (!p) throw falla(404, 'No encontré el pedido.');
    b = Object.assign({}, b, { pedido_ref: p.ref });
  }
  const fila = prepararAsignacion(b, await todo());
  fila.creado_por = txt(quien.usuario, 80);
  const g = await insertar('asignaciones', fila);
  await auditar(quien, 'asignacion', fila.id, 'asignar', null, g);
  return g;
}

async function anularAsignacion(id, mot, quien) {
  const s = motivo(mot);
  const a = await uno('asignaciones', id);
  if (!a) throw falla(404, 'No encontré esa asignación.');
  if (a.anulada) throw falla(409, 'Ya estaba anulada.');
  const g = await actualizar('asignaciones', id, { anulada: true, anulada_por: txt(quien.usuario, 80) || 'admin', anulada_at: new Date().toISOString(), anulada_motivo: s });
  await auditar(quien, 'asignacion', id, 'anular', a, g);
  return g;
}

async function crearObligacion(b, quien) {
  b = b || {};
  const P = deps.pedidos();
  const o = { id: uid(), estado: 'abierta', anulada_motivo: '', anulada_por: '', creado_por: txt(quien.usuario, 80), nota: txt(b.nota, 300) };
  o.concepto = CONCEPTOS.indexOf(b.concepto) >= 0 ? b.concepto : 'total';
  o.importe = importe(b.importe);
  if (!o.importe) throw falla(400, 'Escribí cuánto le debemos.');
  o.vence = b.vence ? fechaISO(b.vence) : null;
  if (b.vence && !o.vence) throw falla(400, 'La fecha de vencimiento no es válida.');
  if (!esId(b.proveedor_id)) throw falla(400, 'Elegí el proveedor.');
  const prov = (await P.listarProveedores()).filter(function (p) { return p.id === b.proveedor_id; })[0];
  if (!prov) throw falla(404, 'No encontré ese proveedor.');
  o.proveedor_id = prov.id; o.proveedor_nombre = txt(prov.nombre, 120);
  o.moneda = moneda(b.moneda) || moneda(prov.moneda) || 'BRL';
  o.pedido_id = null; o.pedido_ref = ''; o.item_id = ''; o.servicio = txt(b.servicio, 160);
  if (b.pedido_id) {
    const p = await P.obtenerPedido(b.pedido_id);
    if (!p) throw falla(404, 'No encontré el pedido.');
    o.pedido_id = p.id; o.pedido_ref = p.ref;
    const it = (p.items || []).filter(function (i) { return i.id === b.item_id; })[0];
    if (b.item_id && !it) throw falla(404, 'Ese servicio ya no está en el pedido.');
    if (it) { o.item_id = it.id; o.servicio = txt(it.nombre, 160); }
  }
  if (!o.servicio && !o.pedido_id) throw falla(400, 'Decí por qué servicio es.');
  if (o.item_id && !b.confirmar_repetida) {
    const ya = (await todo()).obligaciones.filter(function (x) { return x.estado !== 'anulada' && x.pedido_id === o.pedido_id && x.item_id === o.item_id && x.concepto === o.concepto; })[0];
    if (ya) throw falla(409, 'Ese servicio ya tiene una obligación de ' + o.concepto + ' (' + ya.moneda + ' ' + ya.importe + '). ¿Cargar otra igual?', { repetida: true, id: ya.id });
  }
  const g = await insertar('obligaciones', o);
  await auditar(quien, 'obligacion', o.id, 'crear', null, g);
  return g;
}

/* Del importe no se cambia nada: para corregirlo se anula y se carga otra, asi queda la historia. */
async function editarObligacion(id, b, quien) {
  b = b || {};
  const o = await uno('obligaciones', id);
  if (!o) throw falla(404, 'No encontré esa obligación.');
  if (o.estado === 'anulada') throw falla(409, 'Está anulada.');
  const cambios = {};
  if ('vence' in b) { cambios.vence = b.vence ? fechaISO(b.vence) : null; if (b.vence && !cambios.vence) throw falla(400, 'La fecha de vencimiento no es válida.'); }
  if ('nota' in b) cambios.nota = txt(b.nota, 300);
  if (!Object.keys(cambios).length) return o;
  const g = await actualizar('obligaciones', id, cambios);
  await auditar(quien, 'obligacion', id, 'editar', o, g);
  return g;
}

async function anularObligacion(id, mot, quien) {
  const s = motivo(mot);
  const o = await uno('obligaciones', id);
  if (!o) throw falla(404, 'No encontré esa obligación.');
  if (o.estado === 'anulada') throw falla(409, 'Ya estaba anulada.');
  const db = await todo(), movs = {};
  db.movimientos.forEach(function (m) { movs[m.id] = m; });
  if (db.asignaciones.some(function (a) { return a.obligacion_id === id && asignacionCuenta(a, movs); })) throw falla(409, 'Tiene pagos asignados: primero anulá esos pagos.');
  const g = await actualizar('obligaciones', id, { estado: 'anulada', anulada_por: txt(quien.usuario, 80) || 'admin', anulada_at: new Date().toISOString(), anulada_motivo: s });
  await auditar(quien, 'obligacion', id, 'anular', o, g);
  return g;
}

/* ---------- comprobantes (bucket privado) ---------- */
const FIRMAS = [
  { tipo: 'application/pdf', ext: 'pdf', es: function (b) { return b.slice(0, 5).toString('latin1') === '%PDF-'; } },
  { tipo: 'image/jpeg', ext: 'jpg', es: function (b) { return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; } },
  { tipo: 'image/png', ext: 'png', es: function (b) { return b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); } }
];
/* Lo que dice el archivo por dentro manda, no la extension ni lo que dice el navegador. */
function tipoArchivo(buf) { return FIRMAS.filter(function (f) { return buf.length > 8 && f.es(buf); })[0] || null; }

async function subirComprobante(id, b, quien) {
  b = b || {};
  const m = await uno('movimientos', id);
  if (!m) throw falla(404, 'No encontré esa transferencia.');
  if (m.estado === 'anulado') throw falla(409, 'Está anulada.');
  if (m.estado === 'verificado' && m.comprobante) throw falla(409, 'Ya está verificada con su comprobante: no se reemplaza.');
  const buf = Buffer.from(String(b.datos || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) throw falla(400, 'No llegó el archivo.');
  if (buf.length > MAX_COMPROBANTE) throw falla(413, 'El comprobante pesa más de 3 MB. Mandá una captura o un PDF más chico.');
  const f = tipoArchivo(buf);
  if (!f) throw falla(415, 'El comprobante tiene que ser PDF, JPG o PNG.');
  /* Sin el nombre original ni datos del cliente en la ruta. */
  const ruta = m.fecha.slice(0, 7).replace('-', '/') + '/' + uid() + '.' + f.ext;
  if (modo() === 'supabase') {
    const s = supa();
    const r = await fetch(s.url + '/storage/v1/object/comprobantes/' + ruta, { method: 'POST', headers: { apikey: s.key, Authorization: 'Bearer ' + s.key, 'Content-Type': f.tipo, 'x-upsert': 'false' }, body: buf });
    if (!r.ok) throw falla(502, 'No se pudo guardar el comprobante (HTTP ' + r.status + '). ¿Se corrió sql/supabase_finanzas_1.sql?');
  } else {
    const dest = path.join(path.dirname(archivo()), 'comprobantes', ruta);
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf);
  }
  const g = await actualizar('movimientos', id, { comprobante: ruta });
  await auditar(quien, 'movimiento', id, 'comprobante', { comprobante: m.comprobante }, { comprobante: ruta, tipo: f.tipo, bytes: buf.length });
  return g;
}
/* Link que vence en 5 minutos. Nunca se guarda ni se manda una URL publica. */
async function linkComprobante(id) {
  const m = await uno('movimientos', id);
  if (!m || !m.comprobante) throw falla(404, 'Esa transferencia no tiene comprobante.');
  if (modo() === 'supabase') {
    const s = supa();
    const r = await fetch(s.url + '/storage/v1/object/sign/comprobantes/' + m.comprobante, { method: 'POST', headers: { apikey: s.key, Authorization: 'Bearer ' + s.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok || !(j.signedURL || j.signedUrl)) throw falla(502, 'No se pudo abrir el comprobante.');
    return s.url + '/storage/v1' + (j.signedURL || j.signedUrl);
  }
  const buf = fs.readFileSync(path.join(path.dirname(archivo()), 'comprobantes', m.comprobante));
  return 'data:' + tipoArchivo(buf).tipo + ';base64,' + buf.toString('base64');
}

/* ---------- API: /api/admin/fin/* (lib/admin.js la llama despues de validar la sesion) ---------- */
async function api(ruta, req, res, url, h) {
  const quien = { usuario: h.usuario || '', ip: h.ip || '' };
  const st = await estado();
  if (ruta === 'estado' && req.method === 'GET') return h.sendJson(res, 200, st);
  if (!st.tablas) return h.sendJson(res, 503, { error: st.motivo || 'Faltan las tablas de Finanzas.', sinTablas: true });
  if (!st.activo) return h.sendJson(res, 409, { error: 'Finanzas está apagado (operaciones_config, clave finanzas).', apagado: true });
  if (req.method === 'GET') {
    if (ruta === 'datos') return h.sendJson(res, 200, Object.assign(calcular(await todo()), { modo: st.modo }));
    if (ruta === 'auditoria') return h.sendJson(res, 200, { filas: await auditoria(url.searchParams.get('entidad'), url.searchParams.get('id')) });
    if (ruta === 'comprobante') return h.sendJson(res, 200, { url: await linkComprobante(url.searchParams.get('id')) });
    return h.sendJson(res, 404, { error: 'No existe.' });
  }
  if (req.method !== 'POST') return h.sendJson(res, 404, { error: 'No existe.' });
  const b = (await h.readJson(req, ruta === 'comprobante' ? 4300 * 1024 : 64 * 1024)) || {};
  try {
    if (ruta === 'movimiento') return h.sendJson(res, 200, await registrarMovimiento(b, quien));
    if (ruta === 'verificar') return h.sendJson(res, 200, { movimiento: await verificar(b.id, b, quien) });
    if (ruta === 'anular-movimiento') return h.sendJson(res, 200, { movimiento: await anularMovimiento(b.id, b.motivo, quien) });
    if (ruta === 'asignar') return h.sendJson(res, 200, { asignacion: await asignar(b, quien) });
    if (ruta === 'anular-asignacion') return h.sendJson(res, 200, { asignacion: await anularAsignacion(b.id, b.motivo, quien) });
    if (ruta === 'obligacion') return h.sendJson(res, 200, { obligacion: await crearObligacion(b, quien) });
    if (ruta === 'editar-obligacion') return h.sendJson(res, 200, { obligacion: await editarObligacion(b.id, b, quien) });
    if (ruta === 'anular-obligacion') return h.sendJson(res, 200, { obligacion: await anularObligacion(b.id, b.motivo, quien) });
    if (ruta === 'comprobante') return h.sendJson(res, 200, { movimiento: await subirComprobante(b.id, b, quien) });
  } catch (e) {
    if (e.status && e.status < 500) return h.sendJson(res, e.status, { error: e.message, duplicado: !!e.duplicado, parecido: !!e.parecido, repetida: !!e.repetida, id: e.id || null });
    throw e;
  }
  return h.sendJson(res, 404, { error: 'No existe.' });
}

module.exports = {
  api: api, estado: estado, modo: modo,
  MONEDAS: MONEDAS, importe: importe, huella: huella, limpiarMovimiento: limpiarMovimiento, calcular: calcular, prepararAsignacion: prepararAsignacion, tipoArchivo: tipoArchivo,
  registrarMovimiento: registrarMovimiento, verificar: verificar, anularMovimiento: anularMovimiento, asignar: asignar, anularAsignacion: anularAsignacion,
  crearObligacion: crearObligacion, editarObligacion: editarObligacion, anularObligacion: anularObligacion,
  subirComprobante: subirComprobante, linkComprobante: linkComprobante, auditoria: auditoria, todo: todo,
  _deps: deps, _reiniciar: _reiniciar
};
