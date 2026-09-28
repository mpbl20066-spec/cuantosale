'use strict';
/*
 * Genera las dos copias de la tabla de transfer desde data/transfer-precios.json:
 *
 *   1. TRANSFER_PRICES en lib/model.js  (la que usa el server)
 *   2. public/transfer-precios.js       (la que dibuja las cards)
 *
 * Mismo criterio que scripts/build-costos.js: los numeros viven solo en el JSON,
 * con su fuente y su fecha, y este script los reparte. El bloque de model.js se
 * reescribe entre marcadores y el archivo del cliente se regenera entero.
 *
 * Que el precio este en los dos lados y no solo en el server es lo que evita que
 * vuelvan a aparecer tres numeros distintos: antes, las cards de public/app.js
 * traian 30 y 150 escritos a mano, getSelectedTransferAmount() repetia esos dos
 * y transferConfig() en server.js usaba OFFICIAL_TRANSFER_PRICE_USD (35) por
 * pasajero. Tres fuentes de verdad para el mismo numero.
 *
 * Igual que en build-costos.js, el archivo del cliente lleva la procedencia en un
 * segundo global. En esta tabla importa mas que en ninguna otra: 83 de las 88
 * celdas salen de un modelo de distancia y NO de un precio publicado, y eso
 * estaba escrito en el JSON pero no llegaba a la pantalla. Un "estimado" sin
 * decir "estimado con este modelo, desde estos km de OSRM" no es informacion.
 *
 * Idempotente: correrlo dos veces no cambia nada la segunda vez.
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'transfer-precios.json');
const MODEL_PATH = path.join(RAIZ, 'lib', 'model.js');
const CLIENTE_PATH = path.join(RAIZ, 'public', 'transfer-precios.js');

const GLOBAL = 'CS_TRANSFER_PRICES';
const GLOBAL_PROV = 'CS_TRANSFER_PRICES_PROVENANCE';
const INICIO = 'const TRANSFER_PRICES = {';
const FIN = '\n};';

const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const D = datos.destinos;

/* ---------- 1. bloque del modelo ---------- */
const lineas = Object.keys(D).map((k) => {
  const v = D[k];
  const partes = [
    'iata: ' + JSON.stringify(v.iata),
    'modo: ' + JSON.stringify(v.modo)
  ];
  if (v.km != null) partes.push('km: ' + v.km);
  partes.push('compartido: ' + v.compartido);
  partes.push('privado: ' + v.privado);
  if (v.appRideUsd != null) partes.push('appRideUsd: ' + v.appRideUsd);
  if (v.soloPrivado) partes.push('soloPrivado: true');
  return '  ' + k + ': { ' + partes.join(', ') + ' },';
}).join('\n');

const modelo = fs.readFileSync(MODEL_PATH, 'utf8');
const desde = modelo.indexOf(INICIO);
if (desde < 0) throw new Error('no se encontro ' + INICIO + ' en lib/model.js');
const largo = modelo.indexOf(FIN, desde);
if (largo < 0) throw new Error('no se encontro el cierre de TRANSFER_PRICES');

const nuevoModelo = modelo.slice(0, desde + INICIO.length) + '\n' + lineas + modelo.slice(largo);
const cambioModelo = nuevoModelo !== modelo;
if (cambioModelo) fs.writeFileSync(MODEL_PATH, nuevoModelo, 'utf8');

/* ---------- 2. archivo del cliente ---------- */
const cuerpo = Object.keys(D).map((k) => {
  const v = D[k];
  const partes = [
    'name: ' + JSON.stringify((model.DEST[k] && model.DEST[k].name) || '?'),
    'iata: ' + JSON.stringify(v.iata),
    'modo: ' + JSON.stringify(v.modo)
  ];
  if (v.km != null) partes.push('km: ' + v.km);
  partes.push('compartido: ' + v.compartido, 'privado: ' + v.privado);
  if (v.appRideUsd != null) partes.push('appRideUsd: ' + v.appRideUsd);
  if (v.soloPrivado) partes.push('soloPrivado: true');
  return '  ' + k + ': { ' + partes.join(', ') + ' }';
}).join(',\n');

// La procedencia, que hasta ahora se descartaba al generar el cliente. Va en un
// segundo objeto y NO como campos de la tabla: los validadores comparan
// Object.keys(cliente) contra las claves del JSON, asi que una clave enumerable
// extra los rompe.
//
// El campo `real` del JSON es lo que hace util este panel: dice que modalidades
// de cada destino tienen tarifa publicada y cuales salen del modelo de
// distancia. Rio tiene las dos; buz solo la compartida. Mostrar "estimado" a
// secas para las dos seria menos preciso de lo que allows los datos.
const literal = (valor, sangria) => {
  const texto = JSON.stringify(valor, null, 2);
  const pre = ' '.repeat(sangria);
  return texto.split('\n').map((linea, i) => (i === 0 ? linea : pre + linea)).join('\n');
};

const cuerpoProv = Object.keys(D).map((k) => {
  const v = D[k];
  const p = { fuente: v.fuente, confianza: v.confianza, verificado: v.verificado };
  // Que modalidades tienen precio publicado. El default es "ninguna": si el
  // JSON no lo dice, no se muestra ninguna como real.
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

const cliente =
  "'use strict';\n" +
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

const anterior = fs.existsSync(CLIENTE_PATH) ? fs.readFileSync(CLIENTE_PATH, 'utf8') : null;
const cambioCliente = anterior !== cliente;
if (cambioCliente) fs.writeFileSync(CLIENTE_PATH, cliente, 'utf8');

/* ---------- 3. resumen ---------- */
const conf = { alta: 0, media: 0, baja: 0 };
for (const v of Object.values(D)) conf[v.confianza]++;
console.log('modelo        ' + (cambioModelo ? 'actualizado (' + Object.keys(D).length + ' destinos)' : 'sin cambios'));
console.log('transfer-precios ' + (cambioCliente ? 'regenerado (' + Object.keys(D).length + ' destinos)' : 'sin cambios'));
console.log('confianza     alta ' + conf.alta + ' / media ' + conf.media + ' / baja ' + conf.baja);
console.log('con appRide   ' + Object.values(D).filter((v) => v.appRideUsd != null).length);
