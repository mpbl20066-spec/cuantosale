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
const traslados = require('../lib/traslados.js');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'transfer-precios.json');
const MODEL_PATH = path.join(RAIZ, 'lib', 'model.js');
const CLIENTE_PATH = path.join(RAIZ, 'public', 'transfer-precios.js');

const INICIO = 'const TRANSFER_PRICES = {';
const FIN = '\n};';

const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const D = datos.destinos;

/* ---------- 1. bloque del modelo ---------- */
// El generador vive en lib/traslados.js: el server arma la misma tabla en vivo desde
// Supabase, y los dos tienen que dar exactamente lo mismo.
const lineas = traslados.lineasModelo(D);

const modelo = fs.readFileSync(MODEL_PATH, 'utf8');
const desde = modelo.indexOf(INICIO);
if (desde < 0) throw new Error('no se encontro ' + INICIO + ' en lib/model.js');
const largo = modelo.indexOf(FIN, desde);
if (largo < 0) throw new Error('no se encontro el cierre de TRANSFER_PRICES');

const nuevoModelo = modelo.slice(0, desde + INICIO.length) + '\n' + lineas + modelo.slice(largo);
const cambioModelo = nuevoModelo !== modelo;
if (cambioModelo) fs.writeFileSync(MODEL_PATH, nuevoModelo, 'utf8');

/* ---------- 2. archivo del cliente ---------- */
const cliente = traslados.generarCliente(datos, model.DEST);

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
