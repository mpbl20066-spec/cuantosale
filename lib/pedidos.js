/*
 * Pedidos y proveedores del panel /admin.
 *
 * Un pedido es una solicitud de reserva de un cliente (traslados y tours, que
 * CuantoSale tercerizo): quien es, que pidio, cuanto se le cobra y, por cada
 * servicio, que proveedor lo hace, cuanto cuesta y si ya se le pago.
 *
 * Donde se guarda:
 *   - Con SUPABASE_URL + SUPABASE_SERVICE_KEY: en las tablas `pedidos` y
 *     `proveedores` (ver supabase_pedidos.sql). Solo el server las toca, con la
 *     service role; la RLS esta activada y sin policies.
 *   - Sin esas variables (desarrollo local): en data/_trabajo/pedidos.json.
 *     En Vercel el disco es efimero, asi que alli SI hace falta Supabase.
 *
 * Los montos van en USD, que es la moneda del modelo de precios de la app.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ESTADOS = ['nuevo', 'en_gestion', 'confirmado', 'completado', 'cancelado'];
const ESTADOS_ITEM = ['pendiente', 'consultado', 'confirmado', 'cancelado'];
const TIPOS_ITEM = ['traslado', 'tour', 'vuelo', 'alojamiento', 'otro'];

const ARCHIVO = path.join(__dirname, '..', 'data', '_trabajo', 'pedidos.json');

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function modo() { return supa() ? 'supabase' : (process.env.VERCEL ? 'sin-base' : 'archivo'); }

/* ---------- saneado: nada de lo que llega se guarda sin pasar por aca ---------- */
function txt(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }
function num(v, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, max || 1e7) * 100) / 100;
}
function fechaISO(v) { const s = txt(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
function uid() { return crypto.randomUUID(); }
function oneOf(v, lista, def) { const s = txt(v, 30); return lista.indexOf(s) >= 0 ? s : def; }

function limpiarItem(it) {
  it = it && typeof it === 'object' ? it : {};
  return {
    id: txt(it.id, 40) || uid(),
    tipo: oneOf(it.tipo, TIPOS_ITEM, 'otro'),
    nombre: txt(it.nombre, 160),
    detalle: txt(it.detalle, 200),
    precio_usd: num(it.precio_usd, 1e6),                 // lo que se le cobra al cliente
    proveedor_id: txt(it.proveedor_id, 40) || null,
    proveedor_nombre: txt(it.proveedor_nombre, 120),     // copia: si se borra el proveedor, el pedido sigue legible
    costo_usd: num(it.costo_usd, 1e6),                   // lo que cuesta, a pagarle al proveedor
    pagado_proveedor_usd: num(it.pagado_proveedor_usd, 1e6),
    estado: oneOf(it.estado, ESTADOS_ITEM, 'pendiente'),
    ref_proveedor: txt(it.ref_proveedor, 80),            // codigo de reserva que da el proveedor
    notas: txt(it.notas, 500)
  };
}
function limpiarPago(p) {
  p = p && typeof p === 'object' ? p : {};
  return {
    id: txt(p.id, 40) || uid(),
    fecha: fechaISO(p.fecha) || new Date().toISOString().slice(0, 10),
    monto_usd: num(p.monto_usd, 1e6),
    medio: txt(p.medio, 40),
    nota: txt(p.nota, 200)
  };
}
function limpiarProveedor(p) {
  p = p && typeof p === 'object' ? p : {};
  return {
    nombre: txt(p.nombre, 120),
    contacto: txt(p.contacto, 120),
    telefono: txt(p.telefono, 40),
    email: txt(p.email, 120),
    servicios: txt(p.servicios, 200),
    datos_pago: txt(p.datos_pago, 300),    // cuenta / alias / Pix donde se le paga
    notas: txt(p.notas, 500),
    activo: p.activo === false ? false : true
  };
}

/* Campos de un pedido que el admin puede cambiar. `ref`, `created_at` y el
   origen no se tocan despues de creado. */
function limpiarPatch(patch) {
  patch = patch && typeof patch === 'object' ? patch : {};
  const out = {};
  if ('estado' in patch) out.estado = oneOf(patch.estado, ESTADOS, 'nuevo');
  if ('cliente_nombre' in patch) out.cliente_nombre = txt(patch.cliente_nombre, 120);
  if ('cliente_telefono' in patch) out.cliente_telefono = txt(patch.cliente_telefono, 40);
  if ('cliente_email' in patch) out.cliente_email = txt(patch.cliente_email, 120);
  if ('destino' in patch) out.destino = txt(patch.destino, 80);
  if ('fecha_ida' in patch) out.fecha_ida = fechaISO(patch.fecha_ida);
  if ('fecha_vuelta' in patch) out.fecha_vuelta = fechaISO(patch.fecha_vuelta);
  if ('personas' in patch) out.personas = Math.max(1, Math.min(60, Math.round(Number(patch.personas)) || 1));
  if ('medio_pago' in patch) out.medio_pago = txt(patch.medio_pago, 40);
  if ('notas' in patch) out.notas = txt(patch.notas, 2000);
  if ('items' in patch) out.items = (Array.isArray(patch.items) ? patch.items : []).slice(0, 40).map(limpiarItem);
  if ('pagos' in patch) out.pagos = (Array.isArray(patch.pagos) ? patch.pagos : []).slice(0, 80).map(limpiarPago);
  return out;
}

/* ---------- cuentas ---------- */
const r2 = function (n) { return Math.round(n * 100) / 100; };
function cuentas(p) {
  const items = (p.items || []).filter(function (i) { return i.estado !== 'cancelado'; });
  const total = r2(items.reduce(function (a, i) { return a + (i.precio_usd || 0); }, 0));
  const costo = r2(items.reduce(function (a, i) { return a + (i.costo_usd || 0); }, 0));
  const pagadoProv = r2(items.reduce(function (a, i) { return a + Math.min(i.pagado_proveedor_usd || 0, i.costo_usd || 0); }, 0));
  const cobrado = r2((p.pagos || []).reduce(function (a, x) { return a + (x.monto_usd || 0); }, 0));
  const cancelado = p.estado === 'cancelado';
  const saldo = cancelado ? 0 : r2(Math.max(0, total - cobrado));
  return {
    total_usd: total,
    cobrado_usd: cobrado,
    saldo_cliente_usd: saldo,                                // lo que el cliente todavia nos debe
    costo_usd: costo,
    a_pagar_proveedores_usd: cancelado ? 0 : r2(Math.max(0, costo - pagadoProv)),   // lo que nosotros todavia debemos
    pagado_proveedores_usd: pagadoProv,
    margen_usd: r2(total - costo),
    estado_pago: cobrado <= 0 ? 'sin_pago' : (cobrado + 0.005 >= total && total > 0 ? 'pagado' : 'parcial'),
    sin_proveedor: items.filter(function (i) { return !i.proveedor_id && !i.proveedor_nombre; }).length
  };
}
function conCuentas(p) { return Object.assign({}, p, { cuentas: cuentas(p) }); }

/* ---------- pedido que llega de la web ---------- */
function parseUsd(s) { const n = parseFloat(String(s == null ? '' : s).replace(/[^0-9.,]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function desdeSolicitud(b) {
  b = b && typeof b === 'object' ? b : {};
  const servicios = (Array.isArray(b.servicios) ? b.servicios : []).slice(0, 12);
  const items = servicios.map(function (s) {
    s = s || {};
    const esTour = s.tipo === 'tour' || /tour|excursi|paseo|actividad/i.test(String(s.nombre || ''));
    return limpiarItem({
      tipo: s.tipo === 'traslado' || s.tipo === 'tour' ? s.tipo : (esTour ? 'tour' : 'traslado'),
      nombre: s.nombre, detalle: s.detalle,
      // Sin precio_usd solo se interpreta el texto si dice US$: "$ 2.400" son pesos y guardarlo como dolares seria un error.
      precio_usd: s.precio_usd != null ? s.precio_usd : (/US\$|USD/i.test(String(s.precio || '')) ? parseUsd(s.precio) : 0)
    });
  }).filter(function (i) { return i.nombre; });
  // Identificador estable: reenviar el mismo pedido (doble toque, reintento) no lo duplica,
  // pero si cambia algun servicio es otra solicitud.
  const firma = crypto.createHash('sha256').update(JSON.stringify([
    b.codigo, b.nombre, b.telefono, items.map(function (i) { return [i.nombre, i.precio_usd]; })
  ])).digest('hex').slice(0, 6).toUpperCase();
  const base = txt(b.codigo, 40).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 10).toUpperCase();
  const pedido = {
    id: uid(),
    ref: (base ? base + '-' : 'CS-') + firma,
    estado: 'nuevo',
    cliente_nombre: txt(b.nombre, 120),
    cliente_telefono: txt(b.telefono, 40),
    cliente_email: txt(b.email, 120),
    destino: txt(b.destino, 80),
    fecha_ida: fechaISO(b.fecha_ida),
    fecha_vuelta: fechaISO(b.fecha_vuelta),
    fechas_txt: txt(b.fechas, 60),
    personas: Math.max(1, Math.min(60, Math.round(Number(b.personas_n)) || parseInt(b.personas, 10) || 1)),
    personas_txt: txt(b.personas, 60),
    medio_pago: txt(b.medio_pago, 40),
    notas: '',
    origen: 'web',
    items: items,
    pagos: []
  };
  return pedido;
}

/* ---------- almacenamiento ---------- */
let cacheArchivo = null;
function leerArchivo() {
  if (cacheArchivo) return cacheArchivo;
  try { cacheArchivo = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); } catch (e) { cacheArchivo = {}; }
  cacheArchivo.pedidos = cacheArchivo.pedidos || [];
  cacheArchivo.proveedores = cacheArchivo.proveedores || [];
  return cacheArchivo;
}
function escribirArchivo() {
  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
  fs.writeFileSync(ARCHIVO, JSON.stringify(cacheArchivo, null, 2));
}
function sinBase() { const e = new Error('Falta configurar Supabase (SUPABASE_URL y SUPABASE_SERVICE_KEY) para guardar pedidos.'); e.status = 503; return e; }

async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  if (!s) throw sinBase();
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  if (!r.ok) {
    const e = new Error('Supabase respondio HTTP ' + r.status + ': ' + texto.slice(0, 200));
    e.status = 502; throw e;
  }
  try { return texto ? JSON.parse(texto) : null; } catch (e) { return null; }
}

async function listarPedidos() {
  if (modo() === 'supabase') return (await rest('GET', 'pedidos?select=*&order=created_at.desc&limit=1000')) || [];
  if (modo() === 'sin-base') throw sinBase();
  return leerArchivo().pedidos.slice().sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
}
async function obtenerPedido(id) {
  id = txt(id, 40);
  if (modo() === 'supabase') {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const f = await rest('GET', 'pedidos?select=*&limit=1&id=eq.' + encodeURIComponent(id));
    return (f && f[0]) || null;
  }
  if (modo() === 'sin-base') throw sinBase();
  return leerArchivo().pedidos.filter(function (p) { return p.id === id; })[0] || null;
}
/* Devuelve { pedido, nuevo }: nuevo=false si ya existia ese ref. */
async function crearPedido(p) {
  const ahora = new Date().toISOString();
  p = Object.assign({ created_at: ahora, updated_at: ahora }, p);
  p.total_usd = cuentas(p).total_usd;
  if (modo() === 'supabase') {
    const f = await rest('POST', 'pedidos?on_conflict=ref', p, { Prefer: 'resolution=ignore-duplicates,return=representation' });
    if (f && f[0]) return { pedido: f[0], nuevo: true };
    const ex = await rest('GET', 'pedidos?select=*&limit=1&ref=eq.' + encodeURIComponent(p.ref));
    return { pedido: ex && ex[0], nuevo: false };
  }
  if (modo() === 'sin-base') throw sinBase();
  const db = leerArchivo();
  const ya = db.pedidos.filter(function (x) { return x.ref === p.ref; })[0];
  if (ya) return { pedido: ya, nuevo: false };
  db.pedidos.push(p); escribirArchivo();
  return { pedido: p, nuevo: true };
}
async function actualizarPedido(id, patch) {
  const actual = await obtenerPedido(id);
  if (!actual) { const e = new Error('Pedido no encontrado.'); e.status = 404; throw e; }
  const cambios = limpiarPatch(patch);
  const nuevo = Object.assign({}, actual, cambios, { updated_at: new Date().toISOString() });
  nuevo.total_usd = cuentas(nuevo).total_usd;
  cambios.total_usd = nuevo.total_usd; cambios.updated_at = nuevo.updated_at;
  if (modo() === 'supabase') {
    const f = await rest('PATCH', 'pedidos?id=eq.' + encodeURIComponent(actual.id), cambios, { Prefer: 'return=representation' });
    return (f && f[0]) || nuevo;
  }
  const db = leerArchivo();
  db.pedidos[db.pedidos.findIndex(function (x) { return x.id === actual.id; })] = nuevo;
  escribirArchivo();
  return nuevo;
}

async function listarProveedores() {
  if (modo() === 'supabase') return (await rest('GET', 'proveedores?select=*&order=nombre.asc')) || [];
  if (modo() === 'sin-base') throw sinBase();
  return leerArchivo().proveedores.slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
}
async function guardarProveedor(id, datos) {
  const d = limpiarProveedor(datos);
  if (d.nombre.length < 2) { const e = new Error('Escribi el nombre del proveedor.'); e.status = 400; throw e; }
  id = txt(id, 40);
  if (modo() === 'supabase') {
    if (id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) { const e = new Error('Proveedor invalido.'); e.status = 400; throw e; }
      const f = await rest('PATCH', 'proveedores?id=eq.' + encodeURIComponent(id), d, { Prefer: 'return=representation' });
      return f && f[0];
    }
    const f = await rest('POST', 'proveedores', Object.assign({ id: uid() }, d), { Prefer: 'return=representation' });
    return f && f[0];
  }
  if (modo() === 'sin-base') throw sinBase();
  const db = leerArchivo();
  if (id) {
    const i = db.proveedores.findIndex(function (x) { return x.id === id; });
    if (i < 0) { const e = new Error('Proveedor no encontrado.'); e.status = 404; throw e; }
    db.proveedores[i] = Object.assign({}, db.proveedores[i], d);
    escribirArchivo(); return db.proveedores[i];
  }
  const nuevo = Object.assign({ id: uid(), created_at: new Date().toISOString() }, d);
  db.proveedores.push(nuevo); escribirArchivo();
  return nuevo;
}

module.exports = {
  ESTADOS: ESTADOS, ESTADOS_ITEM: ESTADOS_ITEM, TIPOS_ITEM: TIPOS_ITEM,
  modo: modo, cuentas: cuentas, conCuentas: conCuentas,
  desdeSolicitud: desdeSolicitud, limpiarItem: limpiarItem, limpiarPatch: limpiarPatch,
  listarPedidos: listarPedidos, obtenerPedido: obtenerPedido, crearPedido: crearPedido, actualizarPedido: actualizarPedido,
  listarProveedores: listarProveedores, guardarProveedor: guardarProveedor
};
