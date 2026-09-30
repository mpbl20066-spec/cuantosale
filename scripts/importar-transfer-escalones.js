'use strict';
/*
 * Importa data/transfer-escalones.tsv (la planilla de transfers, exportada de
 * Google Sheets como TSV) a data/transfer-precios.json.
 *
 *   privado:    cada fila con precio pasa a destinos[k].privado_escalones, una
 *               lista de { min, max, vehiculo, brl } (Precio Final BRL, por
 *               vehiculo). TODOS los destinos quedan con la lista, vacia si la
 *               planilla no trae ninguna fila con precio: la app muestra
 *               "Consultar" para toda cantidad de personas sin escalon con precio.
 *   compartido: la fila con precio actualiza compartido_brl y su equivalente en
 *               USD. Los destinos sin fila con precio quedan en compartido 0 con
 *               compartido_consultar: true (la app dice "Consultar"). No se toca
 *               soloPrivado ni las filas "Por vehiculo" (Noronha: no hay van
 *               compartida a la isla).
 *
 * Despues correr `npm run build:transfer`.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const TSV = path.join(RAIZ, 'data', 'transfer-escalones.tsv');
const JSON_PATH = path.join(RAIZ, 'data', 'transfer-precios.json');
// La misma tasa con la que ya estan calculados los USD de la tabla: 450 BRL = 86,54 USD.
const BRL_POR_USD = 5.2;

const cliente = require('../public/transfer-precios.js');
const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const D = datos.destinos;

const claveDe = {};
for (const [k, v] of Object.entries(cliente)) claveDe[v.iata + '|' + v.name] = k;

const filas = fs.readFileSync(TSV, 'utf8').split(/\r?\n/).filter(Boolean).slice(1).map((l) => l.split('\t'));
const problemas = [];
const escalones = {};
const compartido = {};
for (const k of Object.keys(D)) escalones[k] = [];

for (const f of filas) {
  const [iata, destino, , , modalidad, vehiculo, cmin, cmax, , , precio, unidad] = f;
  const k = claveDe[iata + '|' + destino];
  // Precios en reales enteros: 425,50 -> 426.
  const brl = Math.round(Number(String(precio).replace(',', '.')));
  if (!k) { problemas.push('destino sin clave: ' + iata + ' ' + destino); continue; }
  if (!(brl > 0)) continue;
  if (modalidad === 'Privado') {
    const min = Number(cmin), max = Number(cmax);
    if (!(min >= 1 && max >= min)) { problemas.push('capacidad invalida: ' + destino + ' ' + cmin + '-' + cmax); continue; }
    if (unidad !== 'Por vehiculo') problemas.push('privado que no es por vehiculo: ' + destino);
    escalones[k].push({ min, max, vehiculo, brl });
  } else if (modalidad === 'Compartido') {
    if (unidad !== 'Por persona' || D[k].soloPrivado) { problemas.push('compartido omitido (' + (D[k].soloPrivado ? 'solo privado' : unidad) + '): ' + destino); continue; }
    compartido[k] = brl;
  }
}

for (const k of Object.keys(D)) {
  escalones[k].sort((a, b) => a.min - b.min || a.brl - b.brl);
  D[k].privado_escalones = escalones[k];
  if (compartido[k] != null) {
    D[k].compartido_brl = compartido[k];
    D[k].compartido = Math.round(compartido[k] / BRL_POR_USD * 100) / 100;
    delete D[k].compartido_consultar;
  } else if (!D[k].soloPrivado) {
    // Sin precio en la planilla: los valores viejos eran estimados de un modelo
    // de distancia, no tarifas, y no se muestran. La app dice "Consultar".
    D[k].compartido = 0;
    delete D[k].compartido_brl;
    D[k].compartido_consultar = true;
  }
}

fs.writeFileSync(JSON_PATH, JSON.stringify(datos, null, 2) + '\n', 'utf8');
const con = Object.keys(D).filter((k) => escalones[k].length);
console.log('destinos con escalones de privado: ' + con.length + ' de ' + Object.keys(D).length + ' (' + con.join(', ') + ')');
console.log('compartido actualizado: ' + Object.keys(compartido).join(', '));
problemas.forEach((p) => console.log('AVISO ' + p));
