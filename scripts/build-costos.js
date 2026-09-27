'use strict';
/*
 * Genera las dos copias de la tabla de costos desde data/costos-diarios.json:
 *
 *   1. DESTINATION_COSTS en lib/model.js  (la que cotiza el server)
 *   2. public/daily-costs.js               (la que dibuja las tarjetas)
 *
 * ANTES: la tabla vivia escrita a mano en los dos archivos. Se divergieron una
 * vez: el cliente se quedo 17 destinos atras y cotizaba angra, curitiba, rec,
 * torres y demas con numeros de Rio de Janeiro sin que nada se enterara, porque
 * las dos tablas caian al fallback de rio sin dar error.
 *
 * AHORA: los numeros viven solo en el JSON, con su fuente, su fecha y su nivel
 * de confianza. Este script escribe el bloque de lib/model.js entre dos
 * marcadores, y regenera el archivo del cliente entero.
 *
 * Idempotente: correrlo dos veces no cambia nada la segunda vez.
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'costos-diarios.json');
const MODEL_PATH = path.join(RAIZ, 'lib', 'model.js');
const CLIENTE_PATH = path.join(RAIZ, 'public', 'daily-costs.js');

// El nombre del global que consume public/app.js. Unico punto de acoplamiento.
const GLOBAL = 'CS_DESTINATION_DAILY_COSTS';
const INICIO = 'const DESTINATION_COSTS = {';
const FIN = '\n};';

const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const D = datos.destinos;

// --- 1. bloque del modelo, entre marcadores ---------------------------
const lineas = Object.keys(D).map((k) => {
  const v = D[k];
  return '  ' + k + ': { transport: { eco: ' + v.traslado.eco + ', confort: ' + v.traslado.confort +
    ' }, food: { casual: ' + v.comida.casual + ', moderado: ' + v.comida.moderado + ', gourmet: ' + v.comida.gourmet + ' } },';
}).join('\n');

const modelo = fs.readFileSync(MODEL_PATH, 'utf8');
const desde = modelo.indexOf(INICIO);
if (desde < 0) throw new Error('no se encontro ' + INICIO + ' en lib/model.js');
const largo = modelo.indexOf(FIN, desde);
if (largo < 0) throw new Error('no se encontro el cierre de DESTINATION_COSTS');

const nuevoModelo = modelo.slice(0, desde + INICIO.length) + '\n' + lineas + modelo.slice(largo);
const cambioModelo = nuevoModelo !== modelo;
if (cambioModelo) fs.writeFileSync(MODEL_PATH, nuevoModelo, 'utf8');

// --- 2. archivo del cliente, entero -------------------------------------
const cuerpo = Object.keys(D).map((k) => {
  const v = D[k];
  const nombre = (model.DEST[k] && model.DEST[k].name) || '?';
  return '  ' + k + ': { name: \'' + nombre.replace(/'/g, "\\'") + '\',' +
    ' transport: { eco: ' + v.traslado.eco + ', confort: ' + v.traslado.confort + ' },' +
    ' food: { casual: ' + v.comida.casual + ', moderado: ' + v.comida.moderado + ', gourmet: ' + v.comida.gourmet + ' } },';
}).join('\n');

const cliente =
  "'use strict';\n" +
  '/* GENERADO. No editar a mano: corré `npm run build:costos`.\n' +
  '   Fuente: data/costos-diarios.json (que a su vez documenta, por destino, de\n' +
  '   dónde sale el número, cuándo se verificó y cuánta confianza tiene). */\n' +
  '(function (root, tabla) {\n' +
  '  root.' + GLOBAL + ' = tabla;\n' +
  '  // La prueba de test.js lo requirea para compararlo con el modelo, asi que\n' +
  '  // tiene que servir tanto en el navegador como en node.\n' +
  '  if (typeof module !== \'undefined\' && module.exports) module.exports = tabla;\n' +
  '})(typeof globalThis !== \'undefined\' ? globalThis : this, {\n' + cuerpo + '\n});\n';

const anterior = fs.existsSync(CLIENTE_PATH) ? fs.readFileSync(CLIENTE_PATH, 'utf8') : null;
const cambioCliente = anterior !== cliente;
if (cambioCliente) fs.writeFileSync(CLIENTE_PATH, cliente, 'utf8');

// --- 3. resumen ---------------------------------------------------------
const n = Object.keys(D).length;
const conf = { alta: 0, media: 0, baja: 0 };
for (const v of Object.values(D)) conf[v.confianza]++;
console.log('modelo      ' + (cambioModelo ? 'actualizado (' + n + ' destinos)' : 'sin cambios'));
console.log('daily-costs ' + (cambioCliente ? 'regenerado (' + n + ' destinos)' : 'sin cambios'));
console.log('confianza   alta ' + conf.alta + ' / media ' + conf.media + ' / baja ' + conf.baja);
