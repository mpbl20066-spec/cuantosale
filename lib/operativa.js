'use strict';
/*
 * Operativa del panel /admin: ficha de cada cliente (alerta, notas, pais), el voucher en PDF para descargar y las
 * salidas: el manifiesto de pasajeros de cada servicio por dia (PDF y WhatsApp al guia o chofer), la suspension de una
 * salida entera (clima, Marina) con aviso a cada cliente, como se resolvio con cada uno y lo que devolvio el proveedor
 * de un servicio cancelado.
 * API en /api/admin/op/* (lib/admin.js la llama despues de validar la sesion).
 *
 * Un cliente no es una tabla aparte de los pedidos: es su telefono (o su email si no dejo telefono). La ficha guarda
 * solo lo que es de la persona y no de un pedido; el historial sale de cruzar los pedidos por esa misma clave
 * (claveCliente, igual en public/admin/operativa.js).
 *
 * Donde se guarda: tabla clientes_fichas (sql/supabase_operativa_1.sql) o, sin Supabase, data/_trabajo/clientes.json
 * (OP_ARCHIVO en las pruebas).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pedidos = require('./pedidos');

function falla(status, msg) { const e = new Error(msg); e.status = status; return e; }
function txt(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }

/* Telefono como lo guarda WhatsApp (099 123 456 -> 59899123456), o el email en minusculas. */
function claveCliente(p) {
  let d = String((p && p.cliente_telefono) || '').replace(/\D/g, '').replace(/^00/, '');
  if (/^09\d{7}$/.test(d)) d = '598' + d.slice(1);
  else if (/^9\d{7}$/.test(d)) d = '598' + d;
  if (/^\d{8,15}$/.test(d)) return 'tel:' + d;
  const m = String((p && p.cliente_email) || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) ? 'mail:' + m : '';
}
function claveValida(c) { return /^(tel:\d{8,15}|mail:[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(String(c || '')) && String(c).length <= 140; }

/* ---------- almacenamiento ---------- */
function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function archivo() { return process.env.OP_ARCHIVO || path.join(__dirname, '..', 'data', '_trabajo', 'clientes.json'); }
function leerArchivo() { try { return JSON.parse(fs.readFileSync(archivo(), 'utf8')); } catch (e) { return { fichas: [] }; } }
async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const t = await r.text();
  if (!r.ok) {
    if (r.status === 404 || /PGRST205|42P01/.test(t)) throw Object.assign(falla(503, 'Falta correr sql/supabase_operativa_1.sql en Supabase para guardar fichas de clientes.'), { sinTabla: true });
    throw falla(502, 'Supabase respondió HTTP ' + r.status + ': ' + t.slice(0, 200));
  }
  try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
}

/* Devuelve { fichas, sinTabla }: sin la tabla el panel igual muestra los clientes, sin alertas ni notas. */
async function fichas() {
  if (supa()) {
    try { return { fichas: (await rest('GET', 'clientes_fichas?select=*&limit=5000')) || [], sinTabla: false }; }
    catch (e) { if (e.sinTabla) return { fichas: [], sinTabla: true }; throw e; }
  }
  if (process.env.VERCEL) return { fichas: [], sinTabla: true };
  return { fichas: leerArchivo().fichas || [], sinTabla: false };
}

async function guardarFicha(b, usuario) {
  b = b || {};
  if (!claveValida(b.clave)) throw falla(400, 'Cliente inválido.');
  const f = { clave: String(b.clave), pais: txt(b.pais, 40), alerta: txt(b.alerta, 300), notas: txt(b.notas, 2000), actualizado_at: new Date().toISOString(), actualizado_por: txt(usuario, 80) };
  if (supa()) {
    const r = await rest('POST', 'clientes_fichas?on_conflict=clave', f, { Prefer: 'resolution=merge-duplicates,return=representation' });
    return r && r[0];
  }
  if (process.env.VERCEL) throw falla(503, 'Falta configurar Supabase.');
  const db = leerArchivo(); db.fichas = (db.fichas || []).filter(function (x) { return x.clave !== f.clave; }).concat([f]);
  fs.mkdirSync(path.dirname(archivo()), { recursive: true }); fs.writeFileSync(archivo(), JSON.stringify(db, null, 1));
  return f;
}

/* ---------- salidas (manifiestos) ----------
   Una salida es un mismo servicio, el mismo dia, a la misma hora y con el mismo proveedor: todos los pedidos que van
   juntos en la combi o en el barco. Los tours cuentan solo con fecha propia (fecha_servicio); un traslado sin fecha
   propia va el dia de llegada (fecha_ida), como en la Agenda. Pedidos y servicios cancelados no van. */
const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function fechaOk(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function diaTxt(f) { const d = new Date(f + 'T12:00:00Z'); return DIAS_SEM[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); }
function idSalida(fecha, k) { return crypto.createHash('sha1').update(fecha + '|' + k).digest('hex').slice(0, 10); }
function pagoDe(c) { return c.cobrado_usd <= 0 ? 'sin_pago' : (c.saldo_cliente_usd > 0.005 ? 'parcial' : 'pagado'); }

function salidasDe(lista, desde, hasta, alertas, proveedores) {
  const g = {}, sinFecha = [];
  const provPor = {}; (proveedores || []).forEach(function (p) { provPor[p.id] = p; });
  (lista || []).forEach(function (p) {
    if (p.estado === 'cancelado') return;
    const c = pedidos.cuentas(p);
    (p.items || []).forEach(function (i) {
      if (!i.nombre || i.estado === 'cancelado' || i.tipo === 'vuelo' || i.tipo === 'alojamiento') return;
      const f = i.fecha_servicio || (i.tipo === 'traslado' ? p.fecha_ida : null);
      if (!f) { if (p.fecha_ida && p.fecha_ida <= hasta && (p.fecha_vuelta || p.fecha_ida) >= desde) sinFecha.push({ pedido_id: p.id, ref: p.ref, cliente: p.cliente_nombre, servicio: i.nombre }); return; }
      if (f < desde || f > hasta) return;
      const k = norm(i.nombre) + '|' + (i.hora || '') + '|' + (i.proveedor_id || norm(i.proveedor_nombre));
      const id = idSalida(f, k);
      const pr = provPor[i.proveedor_id] || null;
      const s = g[id] || (g[id] = { id: id, fecha: f, dia: diaTxt(f), hora: i.hora || '', nombre: i.nombre, tipo: i.tipo, destino: p.destino || '',
        proveedor: { id: i.proveedor_id || '', nombre: i.proveedor_nombre || (pr && pr.nombre) || '', whatsapp: pr ? (pr.whatsapp || pr.telefono || '') : '' }, pax: 0, filas: [] });
      const pas = (p.pasajeros || []).filter(function (x) { return x.nombre; });
      const notas = [i.notas, alertas[claveCliente(p)]].concat(pas.filter(function (x) { return x.nota; }).map(function (x) { return x.nombre.split(' ')[0] + ': ' + x.nota; })).filter(Boolean);
      s.pax += Number(p.personas) || 1;
      s.filas.push({
        pedido_id: p.id, item_id: i.id, ref: p.ref, cliente: p.cliente_nombre || '—', telefono: p.cliente_telefono || '', email: p.cliente_email || '',
        personas: Number(p.personas) || 1, pasajeros: pas.map(function (x) { return x.nombre + (x.edad != null && x.edad < 18 ? ' (' + x.edad + ')' : ''); }),
        pickup: i.pickup || '', estado: i.estado, pago: pagoDe(c), saldo_usd: c.saldo_cliente_usd, ref_proveedor: i.ref_proveedor || '',
        notas: notas, incidencia: i.incidencia || null
      });
    });
  });
  const out = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha) || (a.hora || '99').localeCompare(b.hora || '99') || a.nombre.localeCompare(b.nombre); });
  out.forEach(function (s) {
    s.filas.sort(function (a, b) { return a.pickup.localeCompare(b.pickup) || a.cliente.localeCompare(b.cliente); });
    s.suspendida = s.filas.length > 0 && s.filas.every(function (x) { return x.incidencia && x.incidencia.resolucion === 'pendiente'; });
  });
  return { salidas: out, sin_fecha: sinFecha };
}
async function salidas(desde, hasta) {
  const r = await Promise.all([pedidos.listarPedidos(), fichas().catch(function () { return { fichas: [] }; }), pedidos.listarProveedores().catch(function () { return []; })]);
  const alertas = {}; (r[1].fichas || []).forEach(function (f) { if (f.alerta) alertas[f.clave] = f.alerta; });
  return salidasDe(r[0], desde, hasta, alertas, r[2]);
}
async function salida(fecha, id) {
  if (!fechaOk(fecha)) throw falla(400, 'Fecha inválida.');
  const s = (await salidas(fecha, fecha)).salidas.filter(function (x) { return x.id === id; })[0];
  if (!s) throw falla(404, 'No encontré esa salida. Actualizá la pantalla.');
  return s;
}
const PAGO_TXT = { sin_pago: 'Sin pago', parcial: 'Saldo pendiente', pagado: 'Pagado' };
/* El texto que va al guia o al chofer por WhatsApp. Sin emojis: WhatsApp Web los rompe en los enlaces wa.me. */
function textoSalida(s) {
  const cab = '*Manifiesto CuántoSale*\n*' + s.nombre + '*\n' + s.dia + (s.hora ? ' · ' + s.hora + ' h' : '') + '\nTotal: ' + s.pax + (s.pax === 1 ? ' pasajero' : ' pasajeros');
  const filas = s.filas.filter(function (x) { return !x.incidencia || x.incidencia.resolucion !== 'pendiente'; }).map(function (x, n) {
    return (n + 1) + '. *' + x.cliente + '* (' + x.personas + ')' + (x.ref_proveedor ? ' · cód. ' + x.ref_proveedor : '') +
      '\n   Pickup: ' + (x.pickup || 'a confirmar') + (x.telefono ? '\n   WhatsApp: ' + x.telefono : '') +
      (x.pasajeros.length ? '\n   Pasajeros: ' + x.pasajeros.join(', ') : '') + (x.notas.length ? '\n   Nota: ' + x.notas.join(' · ') : '');
  });
  return cab + '\n\n' + filas.join('\n\n');
}
function pdfSalida(s) {
  const hoy = new Date(Date.now() - 3 * 3600e3);
  return require('./recibo-pdf').manifiesto({
    titulo: s.nombre, fecha: s.dia + (s.hora ? ' · ' + s.hora + ' h' : ''), emitido: hoy.getUTCDate() + '/' + (hoy.getUTCMonth() + 1) + '/' + hoy.getUTCFullYear(),
    datos: [['Fecha', s.dia + ' ' + s.fecha.slice(0, 4)], ['Hora', s.hora ? s.hora + ' h' : 'A confirmar'], ['Proveedor', s.proveedor.nombre || 'Sin asignar'], ['Pasajeros', String(s.pax)], ['Destino', s.destino || '—'], ['Reservas', String(s.filas.length)]],
    filas: s.filas.map(function (x) {
      return { cliente: x.cliente + (x.ref_proveedor ? ' (cód. ' + x.ref_proveedor + ')' : ''), pax: x.personas, pickup: x.pickup, telefono: x.telefono, pago: PAGO_TXT[x.pago], pagado: x.pago === 'pagado',
        pasajeros: x.pasajeros.join(', '), notas: x.notas.join(' · '), aviso: x.incidencia && x.incidencia.resolucion === 'pendiente' ? 'SUSPENDIDO: ' + x.incidencia.motivo : '' };
    }),
    pie: ['CuántoSale · cuantosale.uy · Reservas: +598 98 529 851', 'Manifiesto para el operador. Datos personales de los pasajeros: no compartir fuera del servicio.']
  });
}

/* Cambia un servicio de un pedido sin pisar el resto (el pedido se relee del servidor). fn(item) devuelve el item nuevo. */
async function cambiarItem(pedidoId, itemId, fn, disp) {
  const p = await pedidos.obtenerPedido(pedidoId);
  if (!p) throw falla(404, 'Pedido no encontrado.');
  let hay = false;
  const items = (p.items || []).map(function (i) { if (i.id !== itemId) return i; hay = true; return fn(Object.assign({}, i)); });
  if (!hay) throw falla(404, 'Ese servicio ya no está en el pedido.');
  return pedidos.actualizarPedido(p.id, { items: items }, disp);
}

/* Suspende toda una salida: marca cada servicio y avisa a cada cliente por WhatsApp y por mail. Devuelve que salio. */
async function suspender(b, h) {
  const s = await salida(b.fecha, b.id);
  const motivo = txt(b.motivo, 200);
  if (motivo.length < 3) throw falla(400, 'Escribí el motivo: lo leen los clientes.');
  const t = h.tasas ? await h.tasas().catch(function () { return null; }) : null;
  const out = [];
  for (const x of s.filas) {
    const r = { ref: x.ref, cliente: x.cliente, wa: null, mail: null };
    if (x.incidencia && x.incidencia.resolucion === 'pendiente') { r.ya = true; out.push(r); continue; }
    const avisos = [];
    const p = await cambiarItem(x.pedido_id, x.item_id, function (i) { i.incidencia = { motivo: motivo, fecha_original: s.fecha, t: new Date().toISOString(), resolucion: 'pendiente' }; return i; }, h.disp);
    if (b.wa !== false && x.telefono) {
      const nombre = String(x.cliente || '').split(' ')[0] || 'hola';
      const texto = 'Hola ' + nombre + ', te escribimos de CuántoSale por tu reserva ' + x.ref + ': ' + s.nombre + ' del ' + s.dia + ' se suspendió. Motivo: ' + motivo + '.\n\nPodés elegir otra fecha sin costo o el reembolso de ese servicio. Respondé este mensaje con lo que prefieras y lo coordinamos.';
      try {
        const w = await require('./wa-panel.js').enviar({ tipo: 'suspension', telefono: x.telefono, pais: 'UY', texto: texto, params: [nombre, p.destino || s.destino || 'tu destino', s.nombre, s.dia, motivo, x.ref] });
        r.wa = 'ok'; avisos.push('WhatsApp');
        await pedidos.anotar(p.id, 'whatsapp', 'WhatsApp: salida suspendida' + (w.modo === 'texto' ? '' : ' (plantilla ' + (w.plantilla || '') + ')'), h.disp, 'suspension').catch(function () { return null; });
      } catch (e) { r.wa = e.message; }
    }
    if (b.mail !== false && x.email) {
      try {
        const m = await require('./mail-avisos.js').enviarAviso(p, 'suspension', t && t.rates && t.rates.BRL, { servicio: s.nombre, fecha: s.fecha, motivo: motivo });
        r.mail = 'ok'; avisos.push('mail');
        await pedidos.anotar(p.id, 'mail', 'Mail: salida suspendida a ' + m.email, h.disp, 'suspension').catch(function () { return null; });
      } catch (e) { r.mail = e.message; }
    }
    if (avisos.length) await cambiarItem(x.pedido_id, x.item_id, function (i) { if (i.incidencia) i.incidencia.avisado = 'Avisado por ' + avisos.join(' y '); return i; }, h.disp).catch(function () { return null; });
    out.push(r);
  }
  return { salida: s.nombre, fecha: s.fecha, clientes: out };
}

/* Como se resolvio la suspension con un cliente: otra fecha, reembolso (el servicio se cancela desde el pedido), sale
   igual o quitar la marca. */
async function resolver(b, disp) {
  const acc = String(b.resolucion || '');
  if (['reprogramado', 'reembolso', 'mantiene', 'pendiente', 'quitar'].indexOf(acc) < 0) throw falla(400, 'Acción desconocida.');
  if (acc === 'reprogramado' && !fechaOk(b.fecha)) throw falla(400, 'Elegí la nueva fecha.');
  const p = await cambiarItem(b.pedido_id, b.item_id, function (i) {
    if (acc === 'quitar') { i.incidencia = null; return i; }
    if (!i.incidencia) throw falla(400, 'Ese servicio no está suspendido.');
    i.incidencia = Object.assign({}, i.incidencia, { resolucion: acc });
    if (acc === 'reprogramado') { i.fecha_servicio = b.fecha; if (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.hora || ''))) i.hora = b.hora; }
    return i;
  }, disp);
  return pedidos.conCuentas(p);
}

/* El proveedor nos devolvio plata de un servicio cancelado (Pedidos > Cancelaciones). Suma, no reemplaza. */
async function devolucionProveedor(b, disp) {
  const monto = Math.round(Number(String(b.monto == null ? '' : b.monto).replace(',', '.')) * 100) / 100;
  if (!(monto > 0) || monto > 1e6) throw falla(400, 'Monto inválido.');
  const p = await cambiarItem(b.pedido_id, b.item_id, function (i) {
    const max = Math.max(0, (i.pagado_proveedor_usd || 0) - (i.cargo_proveedor_usd || 0)) - (i.devuelto_proveedor_usd || 0);
    if (monto > max + 0.005) throw falla(400, 'El proveedor no nos debe tanto: como mucho US$ ' + Math.round(max * 100) / 100 + '.');
    i.devuelto_proveedor_usd = Math.round(((i.devuelto_proveedor_usd || 0) + monto) * 100) / 100;
    return i;
  }, disp);
  return pedidos.conCuentas(p);
}

/* ---------- API ---------- */
async function api(ruta, req, res, url, h) {
  if (ruta === 'clientes' && req.method === 'GET') return h.sendJson(res, 200, await fichas());
  if (ruta === 'salidas' && req.method === 'GET') {
    const desde = url.searchParams.get('desde'), hasta = url.searchParams.get('hasta') || desde;
    if (!fechaOk(desde) || !fechaOk(hasta) || hasta < desde) return h.sendJson(res, 400, { error: 'Fechas inválidas.' });
    const r = await salidas(desde, hasta);
    r.salidas.forEach(function (s) { s.texto = textoSalida(s); });
    return h.sendJson(res, 200, r);
  }
  if (ruta === 'salida/pdf' && req.method === 'GET') {
    const s = await salida(url.searchParams.get('fecha'), url.searchParams.get('id'));
    const buf = pdfSalida(s);
    const nombre = 'Manifiesto-' + s.fecha + '-' + norm(s.nombre).replace(/ /g, '-').slice(0, 40) + '.pdf';
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': buf.length, 'Content-Disposition': 'inline; filename="' + nombre + '"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.end(buf);
  }
  /* El manifiesto por la Cloud API, como texto: solo si el chofer o el proveedor nos escribio en las ultimas 24 h (si
     no, WhatsApp exige una plantilla y el panel ofrece abrirlo en WhatsApp Web). */
  if (ruta === 'salida/whatsapp' && req.method === 'POST') {
    const b = (await h.readJson(req, 16 * 1024)) || {};
    const s = await salida(b.fecha, b.id);
    const wp = require('./wa-panel.js');
    const tel = wp._numero(b.telefono || s.proveedor.whatsapp, 'BR');
    if (!tel) return h.sendJson(res, 400, { error: 'Poné un WhatsApp válido para el guía o el chofer.' });
    if (!(await wp.ventanaAbierta(tel))) return h.sendJson(res, 409, { error: 'Ese número no nos escribió en las últimas 24 h: WhatsApp no deja mandarle texto libre desde el número de la empresa. Usá "Abrir en WhatsApp".', ventana: false, telefono: tel });
    await require('./mensajes').enviarTexto(tel, String(b.texto || textoSalida(s)).slice(0, 4000));
    return h.sendJson(res, 200, { ok: true, telefono: tel });
  }
  if (ruta === 'salida/suspender' && req.method === 'POST') {
    const b = (await h.readJson(req, 8 * 1024)) || {};
    return h.sendJson(res, 200, await suspender(b, h));
  }
  if (ruta === 'incidencia' && req.method === 'POST') {
    const b = (await h.readJson(req, 4 * 1024)) || {};
    return h.sendJson(res, 200, { pedido: await resolver(b, h.disp) });
  }
  if (ruta === 'proveedor-devolucion' && req.method === 'POST') {
    const b = (await h.readJson(req, 4 * 1024)) || {};
    return h.sendJson(res, 200, { pedido: await devolucionProveedor(b, h.disp) });
  }
  if (ruta === 'cliente/guardar' && req.method === 'POST') {
    const b = (await h.readJson(req, 8 * 1024)) || {};
    return h.sendJson(res, 200, { ficha: await guardarFicha(b, h.usuario) });
  }
  /* El mismo PDF que va adjunto en el mail del recibo o del voucher, para bajarlo o imprimirlo desde el panel. */
  if (ruta === 'voucher' && req.method === 'GET') {
    const p = await pedidos.obtenerPedido(url.searchParams.get('id'));
    if (!p) return h.sendJson(res, 404, { error: 'Pedido no encontrado.' });
    const tipo = url.searchParams.get('tipo') === 'sena' ? 'sena' : 'saldo';
    const t = h.tasas ? await h.tasas().catch(function () { return null; }) : null;
    const m = require('./mail-cliente.js')._recibo(p, tipo, t && t.rates && t.rates.BRL);
    const a = m.adjuntos && m.adjuntos[0];
    if (!a) return h.sendJson(res, 500, { error: 'No se pudo armar el PDF.' });
    const buf = Buffer.from(a.content, 'base64');
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': buf.length, 'Content-Disposition': 'inline; filename="' + a.filename + '"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.end(buf);
  }
  return h.sendJson(res, 404, { error: 'No existe.' });
}

module.exports = { api: api, claveCliente: claveCliente, claveValida: claveValida, fichas: fichas, guardarFicha: guardarFicha,
  salidasDe: salidasDe, textoSalida: textoSalida, pdfSalida: pdfSalida };
