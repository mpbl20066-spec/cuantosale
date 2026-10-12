'use strict';
/*
 * Genera public/web/paradas-datos.js (window.CS_PARADAS): con que destinos se
 * puede combinar cada uno en un viaje de dos paradas ("3 noches en Rio y 4 en
 * Buzios"), y cuanto sale el traslado de una parada a la otra.
 *
 * DE DONDE SALEN LOS PARES
 * Los mismos que ofrecia la app vieja: las subcategorias con `secondKey` de
 * DESTINATION_GROUPS en public/app.js ("Río + Búzios", "Floripa + Bombinhas"...).
 * Se ofrecen en los dos sentidos, como alla (README, "Dos paradas, en los dos
 * sentidos").
 *
 * CUALES QUEDAN
 * - model.comboTransfer() tiene que aceptar el par (coordenadas, ni muy cerca ni
 *   a mas de COMBO_MAX_KM, con carretera o ferry). Es el mismo filtro que aplica
 *   /api/cotizar con ?second=.
 * - Las dos paradas tienen que volar al mismo aeropuerto (AIR_DESTINATIONS de
 *   server.js). El viaje es un vuelo ida y vuelta a la primera parada y el
 *   transfer de vuelta sale de la segunda hacia ese mismo aeropuerto; con dos
 *   aeropuertos distintos haria falta un vuelo multidestino que /web no cotiza.
 * - Hasta MAX_HORAS de ruta entre las dos. La app vieja ofrecia Praia do Forte +
 *   Trancoso (650 km, casi 12 h): eso es un dia entero de viaje, no un traslado.
 *
 * El precio del traslado es por persona (comboTransfer escala por distancia; el
 * ferry de Ilha Grande es fijo). /web lo multiplica por las personas del viaje.
 *
 * Uso: node scripts/build-paradas-datos.js
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'public', 'web', 'paradas-datos.js');
const MAX_HORAS = 8;

/* AIR_DESTINATIONS vive en server.js (no se exporta): se lee la linea tal cual. */
const server = fs.readFileSync(path.join(RAIZ, 'server.js'), 'utf8');
const mAir = /const AIR_DESTINATIONS = (\{[^\n]*\});/.exec(server);
if (!mAir) throw new Error('No encontre AIR_DESTINATIONS en server.js');
const AIR = Function('return ' + mAir[1])();
const aeropuerto = function (k) { return AIR[k] || (model.DEST[k] && model.DEST[k].iata) || ''; };

const app = fs.readFileSync(path.join(RAIZ, 'public', 'app.js'), 'utf8');
const re = /\{\s*label:\s*'[^']*',\s*key:\s*'([a-z0-9-]+)',\s*secondKey:\s*'([a-z0-9-]+)'\s*\}/g;
const pares = {};
let m, leidos = 0;
while ((m = re.exec(app))) {
  leidos++;
  [[m[1], m[2]], [m[2], m[1]]].forEach(function (p) { pares[p[0] + '|' + p[1]] = p; });
}

const out = {}, descartados = [];
Object.keys(pares).sort().forEach(function (clave) {
  const a = pares[clave][0], b = pares[clave][1];
  const t = model.comboTransfer(a, b, 1);
  if (!t) { descartados.push(clave + ' (sin traslado)'); return; }
  if (!aeropuerto(a) || aeropuerto(a) !== aeropuerto(b)) { descartados.push(clave + ' (' + aeropuerto(a) + ' / ' + aeropuerto(b) + ')'); return; }
  if (t.hours > MAX_HORAS) { descartados.push(clave + ' (' + t.hours + ' h)'); return; }
  (out[a] = out[a] || []).push({ k: b, km: t.distanceKm, horas: t.hours, modo: t.mode, pp: t.perPaxUsd });
});
Object.keys(out).forEach(function (k) { out[k].sort(function (x, y) { return x.km - y.km; }); });

const txt = '/* Viajes de dos paradas: con que destinos se combina cada uno y el traslado de una parada a la otra\n' +
  '   (km por ruta, horas, car|ferry y USD por persona). Los pares son los de la app vieja (public/app.js), en los dos\n' +
  '   sentidos, que comparten aeropuerto y que model.comboTransfer() acepta.\n' +
  '   NO EDITAR A MANO: se regenera con `node scripts/build-paradas-datos.js`. */\n' +
  'window.CS_PARADAS = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(SALIDA, txt);
const n = Object.keys(out).reduce(function (s, k) { return s + out[k].length; }, 0);
console.log('Pares en app.js: ' + leidos + ' -> ' + n + ' combinaciones (con sentido) en ' + Object.keys(out).length + ' destinos.');
if (descartados.length) console.log('Descartados: ' + descartados.join(', '));
