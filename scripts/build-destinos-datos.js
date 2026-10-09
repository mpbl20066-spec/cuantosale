'use strict';
/*
 * Genera public/test/destinos-datos.js (window.CS_DESTS) desde lib/model.js.
 *
 * QUE HAY DENTRO
 * - Los 40 destinos con nombre y region, como ya estaban.
 * - `medios`: los medios de transporte que el sistema puede CALCULAR de verdad
 *   para ese destino. No es lo que el destino "deberia" oferecer: es lo que hay
 *   precio en DEST.modes y en la whitelist de roadtrip.
 *
 * POR QUE MEDIOS Y NO LA REGION
 * Las pantallas de /test decidian el medio de transporte mirando la region
 * (Santa Catarina / Rio Grande do Sul) y con eso offering auto y bus. Contra el
 * modelo esa regla offercia bus en 13 destinos cuando solo hay 2 con pasaje de
 * bus cotizado (fln y poa, los unicos con modes.bus). Offercia una alternativa
 * que despues no se puede cotizar, que es exactamente la promesa que el producto
 * no tiene que hacer.
 *
 * La fuente de verdad de "que medios hay" es el modelo, asi que la disponibilidad
 * se deriva de ahi y no de una lista escrita a mano en cada pantalla. Si el
 * modelo agrega un destino con bus, este archivo lo trae solo.
 *
 * Idempotente: correrlo dos veces no cambia nada la segunda vez.
 *
 * Uso: node scripts/build-destinos-datos.js
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'public', 'test', 'destinos-datos.js');

// Un medio entra en la lista solo si el modelo lo puede cotizar para ese destino.
// - avion: `avion_mvd` esta en los 40. `avion_ba` existe tambien, pero
//   server.js (adaptPackagesToStyle) saca las conexiones por Buenos Aires de las
//   propuestas, asi que no se ofrece como una alternativa aparte.
// - bus: solo donde DEST.modes.bus trae pasaje.
// - auto: solo donde isRoadtripAllowed() da true (ruta de carretera con
//   combustible y peajes). Un destino sin ruta no tiene un auto caro: no tiene
//   auto, que es lo que dice model.js:63.
function mediosDe(key) {
  const modos = (model.DEST[key] && model.DEST[key].modes) || {};
  const l = [];
  if (modos.avion_mvd) l.push('avion');
  if (modos.bus) l.push('bus');
  if (model.isRoadtripAllowed(key)) l.push('auto');
  return l;
}

const datos = Object.keys(model.DEST).map(function (k) {
  return { k: k, name: model.DEST[k].name, region: model.DEST[k].region, medios: mediosDe(k) };
});

const CABECERA = '/* Snapshot de lib/model.js DEST: los mismos 40 destinos que ofrece cuantosale.uy, con su region\n'
  + '   y los medios de transporte que el sistema puede cotizar para cada uno (`medios`).\n'
  + '   NO EDITAR A MANO: se regenera con `node scripts/build-destinos-datos.js`. */\n';

fs.writeFileSync(SALIDA, CABECERA + 'window.CS_DESTS = ' + JSON.stringify(datos) + ';\n', 'utf8');

// Un resumen en consola para que se vea de un vistazo que medio hay donde.
const porMedio = {};
datos.forEach(function (d) {
  d.medios.forEach(function (m) { (porMedio[m] = porMedio[m] || []).push(d.k); });
});
console.log('destinos-datos.js: ' + datos.length + ' destinos');
Object.keys(porMedio).sort().forEach(function (m) {
  console.log('  ' + m + ': ' + porMedio[m].length + (m === 'bus' ? ' (' + porMedio[m].join(', ') + ')' : ''));
});
console.log('  solo un medio: ' + datos.filter(function (d) { return d.medios.length < 2; }).length);