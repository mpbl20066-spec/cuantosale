'use strict';
/*
 * Precios de traslado (aeropuerto -> hotel) por destino.
 *
 *   refrescar()      -> lee la tabla `traslados` de Supabase (cache de 60 s) y la
 *                       aplica a model.TRANSFER_PRICES, que es lo que usan
 *                       comboTransfer(), transferConfig() y el resto del server.
 *   clienteJs()      -> el contenido de /transfer-precios.js para el navegador.
 *   lineasModelo(), generarCliente()
 *                    -> los generadores que usa scripts/build-transfer.js. Estan
 *                       aca para que el archivo generado en el build y el servido
 *                       en vivo salgan del mismo codigo: si no, la app y /web
 *                       podrian ver una tabla distinta que el server.
 *
 * DE DONDE SALE CADA PRECIO
 *
 * data/transfer-precios.json sigue siendo la base y el respaldo: si Supabase no
 * responde o la tabla no existe, todo queda como siempre. La tabla `traslados`
 * (sql/supabase_operaciones_3.sql) guarda, por destino, el MISMO registro que el JSON;
 * lo que esta en la tabla gana. Se edita desde la pestana Traslados de /admin, con
 * borrador y publicacion, como los tours (ver api() abajo).
 *
 * La cuenta de reales a dolares es la de scripts/importar-transfer-escalones.js:
 * USD = R$ / cotizacion de traslados (5,2 por defecto), redondeado a centavos, sin
 * margen: el precio de la planilla ya es el precio final de venta.
 */
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '..', 'data', 'transfer-precios.json');
const TTL_MS = 60 * 1000;
const GLOBAL = 'CS_TRANSFER_PRICES';
const GLOBAL_PROV = 'CS_TRANSFER_PRICES_PROVENANCE';

let _base = null;
function base() {
  if (!_base) _base = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  return _base;
}
function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function nombres() {
  try { return require('./model.js').DEST || {}; } catch (e) { return {}; }
}

/* ---------- generadores (los usa tambien scripts/build-transfer.js) ---------- */

/** Lo que el modelo guarda de cada destino. Mismo contenido que lineasModelo(). */
function entradaModelo(v) {
  const e = { iata: v.iata, modo: v.modo };
  if (v.km != null) e.km = v.km;
  e.compartido = v.compartido;
  e.privado = v.privado;
  if (v.appRideUsd != null) e.appRideUsd = v.appRideUsd;
  if (v.soloPrivado) e.soloPrivado = true;
  if (v.compartido_consultar) e.compartidoConsultar = true;
  e.escalones = v.privado_escalones || [];
  return e;
}

function lineasModelo(D) {
  return Object.keys(D).map((k) => {
    const v = D[k];
    const partes = ['iata: ' + JSON.stringify(v.iata), 'modo: ' + JSON.stringify(v.modo)];
    if (v.km != null) partes.push('km: ' + v.km);
    partes.push('compartido: ' + v.compartido);
    partes.push('privado: ' + v.privado);
    if (v.appRideUsd != null) partes.push('appRideUsd: ' + v.appRideUsd);
    if (v.soloPrivado) partes.push('soloPrivado: true');
    if (v.compartido_consultar) partes.push('compartidoConsultar: true');
    partes.push('escalones: ' + JSON.stringify(v.privado_escalones || []));
    return '  ' + k + ': { ' + partes.join(', ') + ' },';
  }).join('\n');
}

function literal(valor, sangria) {
  const texto = JSON.stringify(valor, null, 2);
  const pre = ' '.repeat(sangria);
  return texto.split('\n').map((linea, i) => (i === 0 ? linea : pre + linea)).join('\n');
}

/** El archivo public/transfer-precios.js, a partir del JSON ({ _meta, destinos }). */
function generarCliente(datos, DEST) {
  const D = datos.destinos;
  DEST = DEST || nombres();
  const cuerpo = Object.keys(D).map((k) => {
    const v = D[k];
    const partes = [
      'name: ' + JSON.stringify((DEST[k] && DEST[k].name) || '?'),
      'iata: ' + JSON.stringify(v.iata),
      'modo: ' + JSON.stringify(v.modo)
    ];
    if (v.km != null) partes.push('km: ' + v.km);
    partes.push('compartido: ' + v.compartido, 'privado: ' + v.privado);
    if (v.compartido_brl != null) partes.push('compartido_brl: ' + v.compartido_brl);
    if (v.privado_brl != null) partes.push('privado_brl: ' + v.privado_brl);
    if (v.appRideUsd != null) partes.push('appRideUsd: ' + v.appRideUsd);
    if (v.soloPrivado) partes.push('soloPrivado: true');
    if (v.compartido_consultar) partes.push('compartidoConsultar: true');
    partes.push('escalones: ' + JSON.stringify(v.privado_escalones || []));
    return '  ' + k + ': { ' + partes.join(', ') + ' }';
  }).join(',\n');

  const cuerpoProv = Object.keys(D).map((k) => {
    const v = D[k];
    const p = { fuente: v.fuente, confianza: v.confianza, verificado: v.verificado };
    p.real = Array.isArray(v.real) ? v.real : [];
    if (v.derivacion) p.derivacion = v.derivacion;
    if (v.km != null) p.km = v.km;
    if (v.horas != null) p.horas = v.horas;
    if (v.modo && v.modo !== 'car') p.modo = v.modo;
    if (v.appRideUsd != null) p.appRideUsd = v.appRideUsd;
    if (v.soloPrivado) p.soloPrivado = true;
    return '  ' + k + ': ' + literal(p, 4);
  }).join(',\n');

  // El _meta del JSON: unidades, formulas del modelo y calibracion. Es el texto que
  // responde "¿de dónde sale US$ 120 de transfer a Búzios?" cuando la respuesta es
  // "del modelo, y estos son los km".
  const metaProv = {
    unidad: (datos._meta && datos._meta.unidad) || {},
    por_que_no_ida_y_vuelta: (datos._meta && datos._meta.por_que_no_ida_y_vuelta) || '',
    appRide: (datos._meta && datos._meta.appRide) || '',
    modelo: (datos._meta && datos._meta.modelo) || {}
  };

  return "'use strict';\n" +
    '/* GENERADO. No editar a mano: corré `npm run build:transfer`.\n' +
    '   Fuente: data/transfer-precios.json (que a su vez documenta, por destino, de\n' +
    '   dónde sale el número, cuándo se verificó y cuánta confianza tiene).\n' +
    '\n' +
    '   compartido: USD por persona. privado: USD por vehículo de hasta 4 personas.\n' +
    '   Los dos son solo ida (aeropuerto -> hotel). */\n' +
    '(function (root, tabla, proc) {\n' +
    '  root.' + GLOBAL + ' = tabla;\n' +
    '  // De dónde sale cada precio y si es una tarifa publicada o el modelo de\n' +
    '  // distancia. Pocas celdas tienen tarifa publicada; el resto se declara.\n' +
    '  root.' + GLOBAL_PROV + ' = proc;\n' +
    '  // La prueba de test.js lo requirea para compararlo con el modelo, asi que\n' +
    '  // tiene que servir tanto en el navegador como en node.\n' +
    '  if (typeof module !== \'undefined\' && module.exports) {\n' +
    '    module.exports = tabla;\n' +
    '    // enumerable: false a propósito: los validadores comparan Object.keys(cliente)\n' +
    '    // contra las claves del JSON, y una clave enumerable extra las rompe.\n' +
    '    Object.defineProperty(module.exports, \'provenance\', { value: proc, enumerable: false });\n' +
    '  }\n' +
    "})(typeof globalThis !== 'undefined' ? globalThis : this, {\n" + cuerpo + '\n}, {\n' +
    '  _meta: ' + literal(metaProv, 4) + ',\n' + cuerpoProv + '\n});\n';
}

/* ---------- lectura en vivo ---------- */

let estado = { destinos: null, at: 0, origen: 'json' };
let enVuelo = null;
let _cliente = { at: -1, js: '' };
let avisado = 0;

function vencido() { return !estado.destinos || Date.now() - estado.at >= TTL_MS; }

/* El modelo se actualiza en el lugar: comboTransfer() y compania leen
   model.TRANSFER_PRICES[key] en cada llamada, asi que ven el precio nuevo sin cambiar. */
function aplicarAlModelo(D) {
  try {
    const tp = require('./model.js').TRANSFER_PRICES;
    Object.keys(D).forEach(function (k) { tp[k] = entradaModelo(D[k]); });
  } catch (e) { /* sin modelo (pruebas): no hay nada que actualizar */ }
}

/** Trae la tabla si vencio el cache. Nunca tira: sin base, queda el JSON. */
function refrescar() {
  if (!vencido()) return Promise.resolve(estado);
  if (enVuelo) return enVuelo;
  const s = supa();
  if (!s) { estado = { destinos: base().destinos, at: Date.now(), origen: 'json' }; return Promise.resolve(estado); }
  enVuelo = fetch(s.url + '/rest/v1/traslados?select=destino,publicado', { headers: { apikey: s.key, authorization: 'Bearer ' + s.key } })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (filas) {
      const D = Object.assign({}, base().destinos);
      (filas || []).forEach(function (f) { if (f && f.destino && f.publicado && typeof f.publicado === 'object') D[f.destino] = f.publicado; });
      aplicarAlModelo(D);
      estado = { destinos: D, at: Date.now(), origen: filas && filas.length ? 'supabase' : 'json' };
      return estado;
    })
    .catch(function (e) {
      // Se queda con lo ultimo que tenia (o el JSON) y reintenta cuando vuelva a vencer.
      if (Date.now() - avisado > TTL_MS) { console.warn('[traslados] no se pudo leer Supabase (' + e.message + '); sigue la tabla anterior'); avisado = Date.now(); }
      estado = { destinos: estado.destinos || base().destinos, at: Date.now(), origen: estado.destinos ? estado.origen : 'json' };
      return estado;
    })
    .finally(function () { enVuelo = null; });
  return enVuelo;
}

async function clienteJs() {
  await refrescar();
  if (_cliente.at !== estado.at) _cliente = { at: estado.at, js: generarCliente({ _meta: base()._meta, destinos: estado.destinos }) };
  return _cliente.js;
}
function origen() { return estado.origen; }
function invalidar() { estado.at = 0; }

/* ---------- panel: borrador, publicacion e historial ---------- */

function falla(status, msg) { const e = new Error(msg); e.status = status; return e; }
async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  if (!s) throw falla(503, 'Falta configurar Supabase en el servidor.');
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  if (!r.ok) {
    if (/traslados/.test(texto) && /does not exist|42P01|PGRST205/.test(texto)) throw falla(503, 'Falta correr sql/supabase_operaciones_3.sql en Supabase.');
    throw falla(502, 'Supabase respondio HTTP ' + r.status + ': ' + texto.slice(0, 200));
  }
  try { return texto ? JSON.parse(texto) : null; } catch (e) { return null; }
}
const REP = { Prefer: 'return=representation' };

async function cotizacion() {
  const f = ((await rest('GET', 'operaciones_config?select=valor&clave=eq.cotizacion_traslados')) || [])[0];
  return Number(f && f.valor && f.valor.valor) || 5.2;
}
function usdDe(brl, cot) { return Math.round(brl / cot * 100) / 100; }
function hoy() { return new Date().toISOString().slice(0, 10); }

/**
 * El registro nuevo de un destino a partir de lo que se edita en el panel:
 * compartido por persona en reales (vacio = "Consultar") y los escalones del
 * privado (por vehiculo, segun cuantas personas). El resto del registro (km, horas,
 * modo, appRide...) queda como estaba.
 */
function calcularEntrada(actual, ed, cot) {
  const v = JSON.parse(JSON.stringify(actual));
  const esc = (Array.isArray(ed.escalones) ? ed.escalones : []).map(function (e) {
    const x = { min: Math.round(Number(e.min)), max: Math.round(Number(e.max)), vehiculo: String(e.vehiculo || '').trim().slice(0, 40), brl: Math.round(Number(String(e.brl).replace(',', '.'))) };
    if (!(x.min >= 1 && x.max >= x.min && x.max <= 60)) throw falla(400, 'Personas inválidas en un escalón: ' + e.min + ' a ' + e.max + '.');
    if (!(x.brl > 0 && x.brl < 100000)) throw falla(400, 'Precio inválido en un escalón: ' + e.brl + '.');
    if (!x.vehiculo) throw falla(400, 'Falta el vehículo en un escalón.');
    return x;
  }).sort(function (a, b) { return a.min - b.min || a.brl - b.brl; });
  for (let i = 1; i < esc.length; i++) {
    if (esc[i].min <= esc[i - 1].max) throw falla(400, 'Los escalones se superponen: ' + esc[i - 1].min + '–' + esc[i - 1].max + ' y ' + esc[i].min + '–' + esc[i].max + ' personas.');
  }
  const comp = ed.compartido_brl === '' || ed.compartido_brl == null ? null : Math.round(Number(String(ed.compartido_brl).replace(',', '.')));
  if (comp != null && !(comp > 0 && comp < 100000)) throw falla(400, 'Precio compartido inválido.');

  v.privado_escalones = esc;
  if (esc.length) {
    const entrada = esc.find(function (e) { return e.min <= 1; }) || esc[0];
    v.privado_brl = entrada.brl;
    v.privado = usdDe(entrada.brl, cot);
  }
  // Sin escalones el privado no se toca, igual que el importador de la planilla: la
  // app muestra "Consultar" para toda cantidad de personas sin escalon con precio.
  if (comp != null) {
    v.compartido_brl = comp;
    v.compartido = usdDe(comp, cot);
    delete v.compartido_consultar;
  } else if (!v.soloPrivado) {
    v.compartido = 0;
    delete v.compartido_brl;
    v.compartido_consultar = true;
  }
  const real = [];
  if (esc.length) real.push('privado');
  if (comp != null) real.push('compartido');
  v.real = real;
  if (real.length) v.confianza = 'alta';
  v.verificado = /^\d{4}-\d{2}-\d{2}$/.test(String(ed.verificado || '')) ? ed.verificado : hoy();
  return v;
}

/* Que cambio de verdad en el precio: si solo cambia la fecha o la nota, no se toca la fuente. */
function preciosIguales(a, b) {
  return JSON.stringify([a.compartido, a.compartido_brl || null, a.privado, a.privado_brl || null, a.privado_escalones || []]) ===
    JSON.stringify([b.compartido, b.compartido_brl || null, b.privado, b.privado_brl || null, b.privado_escalones || []]);
}

async function filas() {
  return (await rest('GET', 'traslados?select=*&order=destino.asc')) || [];
}
async function fila(destino) {
  if (!/^[a-z0-9_-]{2,30}$/.test(String(destino || ''))) throw falla(400, 'Destino inválido.');
  const f = ((await rest('GET', 'traslados?select=*&limit=1&destino=eq.' + destino)) || [])[0];
  if (!f) throw falla(404, 'Ese destino no tiene traslado cargado.');
  return f;
}

async function datosPanel() {
  const r = await Promise.all([filas(), cotizacion()]);
  const DEST = nombres();
  return {
    cotizacion: r[1],
    traslados: r[0].map(function (f) { return Object.assign({ nombre: (DEST[f.destino] && DEST[f.destino].name) || f.destino }, f); })
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); })
  };
}

async function publicarEntrada(f, nueva, usuario, nota) {
  const ahora = new Date().toISOString();
  await rest('PATCH', 'traslados?destino=eq.' + f.destino, { publicado: nueva, borrador: null, borrador_por: '', borrador_at: null, actualizado_at: ahora, actualizado_por: usuario || '' });
  await rest('POST', 'traslados_historial', { destino: f.destino, antes: f.publicado, despues: nueva, nota: String(nota || '').slice(0, 500), por: usuario || '' });
  invalidar();
}

async function guardar(b, usuario) {
  const f = await fila(b.destino);
  const cot = await cotizacion();
  const nueva = calcularEntrada(f.publicado, b, cot);
  if (!preciosIguales(nueva, f.publicado)) {
    nueva.fuente = 'Precio cargado en el panel de Operaciones el ' + hoy() + (b.nota ? ' (' + String(b.nota).slice(0, 200) + ')' : '') +
      '. Precio final de venta en reales, un solo trayecto. USD = R$ / ' + cot + '.';
    // La derivacion explica la modalidad que no tiene precio; con las dos cargadas no hace falta.
    const sin = ['privado', 'compartido'].filter(function (m) { return nueva.real.indexOf(m) < 0 && !(m === 'compartido' && nueva.soloPrivado); });
    if (sin.length) nueva.derivacion = 'La modalidad ' + sin.join(' y ') + ' no tiene precio cargado: la app muestra "Consultar".';
    else delete nueva.derivacion;
  }
  if (JSON.stringify(nueva) === JSON.stringify(f.publicado)) {
    if (f.borrador) await rest('PATCH', 'traslados?destino=eq.' + f.destino, { borrador: null, borrador_por: '', borrador_at: null });
    return { sin_cambios: true };
  }
  if (b.publicar) { await publicarEntrada(f, nueva, usuario, b.nota); return { publicado: true, traslado: nueva }; }
  await rest('PATCH', 'traslados?destino=eq.' + f.destino, { borrador: nueva, borrador_por: usuario || '', borrador_at: new Date().toISOString() });
  return { borrador: true, traslado: nueva };
}

async function publicarBorradores(destinos, usuario) {
  let n = 0;
  for (const d of (Array.isArray(destinos) ? destinos : []).slice(0, 100)) {
    const f = await fila(d);
    if (!f.borrador) continue;
    await publicarEntrada(f, f.borrador, usuario, 'Borrador de ' + (f.borrador_por || 'el panel'));
    n++;
  }
  return { publicados: n };
}

async function descartarBorradores(destinos) {
  const ok = (Array.isArray(destinos) ? destinos : []).filter(function (d) { return /^[a-z0-9_-]{2,30}$/.test(String(d)); });
  if (!ok.length) return { descartados: 0 };
  const r = await rest('PATCH', 'traslados?destino=in.(' + ok.join(',') + ')&borrador=not.is.null', { borrador: null, borrador_por: '', borrador_at: null }, REP);
  return { descartados: (r || []).length };
}

async function historial(destino) {
  if (!/^[a-z0-9_-]{2,30}$/.test(String(destino || ''))) throw falla(400, 'Destino inválido.');
  return (await rest('GET', 'traslados_historial?select=*&order=at.desc&limit=50&destino=eq.' + destino)) || [];
}

/* Volver a como estaba antes de un cambio publicado. Se publica en el momento: es
   volver a un precio que ya estuvo en la web. */
async function revertir(id, usuario) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw falla(400, 'Cambio inválido.');
  const h = ((await rest('GET', 'traslados_historial?select=*&limit=1&id=eq.' + id)) || [])[0];
  if (!h || !h.antes) throw falla(400, 'Ese cambio no tiene un precio anterior.');
  const f = await fila(h.destino);
  await publicarEntrada(f, h.antes, usuario, 'Vuelve a lo de antes del cambio del ' + String(h.at).slice(0, 10));
  return { publicado: true };
}

async function api(ruta, req, res, url, b, h) {
  const usuario = h.usuario || '';
  if (ruta === 'datos' && req.method === 'GET') return h.sendJson(res, 200, await datosPanel());
  if (ruta === 'historial' && req.method === 'GET') return h.sendJson(res, 200, { cambios: await historial(url.searchParams.get('destino')) });
  if (req.method !== 'POST') return h.sendJson(res, 404, { error: 'No existe.' });
  if (ruta === 'guardar') return h.sendJson(res, 200, await guardar(b, usuario));
  if (ruta === 'publicar') return h.sendJson(res, 200, await publicarBorradores(b.destinos, usuario));
  if (ruta === 'descartar') return h.sendJson(res, 200, await descartarBorradores(b.destinos));
  if (ruta === 'revertir') return h.sendJson(res, 200, await revertir(b.id, usuario));
  return h.sendJson(res, 404, { error: 'No existe.' });
}

module.exports = {
  refrescar: refrescar, vencido: vencido, clienteJs: clienteJs, origen: origen, invalidar: invalidar,
  entradaModelo: entradaModelo, lineasModelo: lineasModelo, generarCliente: generarCliente,
  calcularEntrada: calcularEntrada, api: api
};
