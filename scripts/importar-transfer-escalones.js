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
 * Y con la lista de escalones llena, `privado` y `privado_brl` pasan a ser el
 * escalon de entrada (el que arranca en una persona), que es el precio real. Antes
 * se quedaban clavados en el numero del modelo de distancia, y con el compartido
 * real de la planilla ya cargado eso hacia que la tabla se contradijera sola: el
 * privado del modelo salia mas barato que el compartido, que no puede ser. Eso lo
 * detecta validar-transfer.js. Sin escalones, `privado` no se toca.
 *
 * Tambien actualiza la procedencia (real, confianza, fuente, derivacion), que antes
 * no se movia: un destino con tarifa cargada de la planilla seguia declarando que
 * sus dos precios salian del modelo de distancia. Eso era una afirmacion falsa, y
 * `real` es justamente el campo que separa una tarifa de una conjetura. Ver
 * actualizarProcedencia() abajo.
 *
 * ES UN REEMPLAZO, no una fusion: los destinos ausentes de la planilla pierden lo
 * que tuvieran. Para eso esta la fila de precio 0 (que el script saltea y deja el
 * destino en "Consultar") y no hace falta que el destino aparezca en la planilla.
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
// Fecha de verificacion de lo que viene de la planilla. Se puede fijar con
// TRANSFER_VERIFICADO=AAAA-MM-DD para no cambiar la fecha en cada corrida.
const VERIFICADO = process.env.TRANSFER_VERIFICADO || new Date().toISOString().slice(0, 10);

const cliente = require('../public/transfer-precios.js');
const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const D = datos.destinos;

const claveDe = {};
for (const [k, v] of Object.entries(cliente)) claveDe[v.iata + '|' + v.name] = k;

const filas = fs.readFileSync(TSV, 'utf8').split(/\r?\n/).filter(Boolean).slice(1).map((l) => l.split('\t'));
const problemas = [];
const escalones = {};
const compartido = {};
// La fila de la planilla de la que salio cada numero, para poder citarla en
// "fuente" y que la procedencia sea rastreable hasta la fila exacta.
const planilla = {};
for (const k of Object.keys(D)) { escalones[k] = []; planilla[k] = { iata: null, privado: [], compartido: null }; }

for (const f of filas) {
  const [iata, destino, km, , modalidad, vehiculo, cmin, cmax, base, comision, precio, unidad] = f;
  const k = claveDe[iata + '|' + destino];
  if (!k) { problemas.push('destino sin clave (se pierde la fila): ' + iata + ' ' + destino); continue; }
  // Precios en reales enteros: 425,50 -> 426.
  const brl = Math.round(Number(String(precio || '').replace(',', '.')));
  if (!Number.isFinite(brl) || !(brl > 0)) {
    // Fila sin precio: no es un error, es "no hay dato todavia". El destino queda
    // en "Consultar", que es lo que ya muestra.
    continue;
  }
  const de = { base: (base || '').trim(), comision: (comision || '').trim(), brl: brl, km: km || '' };
  if (!planilla[k].iata) planilla[k].iata = iata;
  if (modalidad === 'Privado') {
    const min = Number(cmin), max = Number(cmax);
    if (!(min >= 1 && max >= min)) { problemas.push('capacidad invalida: ' + destino + ' ' + cmin + '-' + cmax); continue; }
    if (unidad !== 'Por vehiculo') problemas.push('privado que no es por vehiculo: ' + destino);
    escalones[k].push({ min, max, vehiculo, brl });
    de.min = min; de.max = max; de.vehiculo = vehiculo;
    planilla[k].privado.push(de);
  } else if (modalidad === 'Compartido') {
    // "Por vehiculo" en una van compartida no significa nada, y Noronha no tiene
    // van compartida a la isla: en los dos casos la fila se descarta.
    // Una fila "Por persona" con precio es la agencia diciendo que SI hay
    // compartido (la planilla de octubre carga Noronha en vuelo compartido a R$ 95):
    // manda la planilla y el destino deja de ser solo privado.
    if (unidad === 'Por persona' && D[k].soloPrivado) delete D[k].soloPrivado;
    if (unidad !== 'Por persona') {
      problemas.push('compartido omitido (unidad "' + unidad + '"): ' + destino);
      continue;
    }
    compartido[k] = brl;
    de.min = Number(cmin) || null; de.max = Number(cmax) || null; de.vehiculo = (vehiculo || '').trim();
    planilla[k].compartido = de;
  }
}

for (const k of Object.keys(D)) {
  escalones[k].sort((a, b) => a.min - b.min || a.brl - b.brl);
  D[k].privado_escalones = escalones[k];
  if (escalones[k].length) {
    const entrada = escalones[k].find((e) => e.min <= 1) || escalones[k][0];
    D[k].privado_brl = entrada.brl;
    D[k].privado = Math.round(entrada.brl / BRL_POR_USD * 100) / 100;
  }
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
  actualizarProcedencia(k);
}

/* Que la procedencia diga la verdad despues de cargar la planilla.
 *
 * `real` lista que columnas salen de un precio publicado, y es lo que separa una
 * tarifa de una conjetura. El _meta del JSON define:
 *   alta: 'Hay un operador o una plataforma que publica este precio exacto para esta ruta.'
 * La planilla de transfers ES la agencia publicando su tarifa para esa ruta exacta,
 * asi que lo que sale de ahi es 'alta'. Antes de este script, cargar una tarifa
 * real no movia ni `real` ni `confianza` ni `fuente`: el destino seguia declarando
 * "sale del modelo de distancia" al lado de un precio de la planilla.
 *
 * Como el import es un reemplazo, despues de correrlo una columna que no vino de
 * la planilla ya no sale del modelo: el import la puso en 0 con `consultar`, y el
 * privado sin escalones queda en 0. O sea, toda columna que no es real ahora se
 * muestra como "Consultar", y la derivacion tiene que decir eso, no "sale del
 * modelo", que seria falso.
 *
 * Los km y la nota de ferry/vuelo no se tocan: no vienen de la planilla. */
function actualizarProcedencia(k) {
  const v = D[k];
  const de = planilla[k];
  const real = [];
  if (escalones[k].length) real.push('privado');
  if (compartido[k] != null) real.push('compartido');
  v.real = real;

  const nombre = cliente[k] ? cliente[k].name : k;
  const kmTxt = v.km != null ? v.km + ' km de OSRM' : '';
  // El modo va por destino: decir "barco o en vuelo" para los dos seria tan impreciso
  // como no decir nada. ilha es barco desde Rio o Angra, fernando es vuelo desde REC.
  const como = v.modo === 'ferry' ? 'No hay carretera: se llega en barco desde Rio o Angra.'
    : v.modo === 'vuelo' ? 'No hay carretera: es una isla, se llega en vuelo corto desde REC.'
    : null;

  if (!real.length) {
    // Ninguna fila con precio: la planilla no dice nada de este destino.
    v.confianza = 'baja';
    v.derivacion = 'Sin fila con precio en la planilla de transfers. Ninguna de las dos modalidades tiene ' +
      'precio cargado y la app muestra "Consultar" en las dos: no es que sean gratis, es que el precio se ' +
      'confirma al reservar. La distancia' + (kmTxt ? ' (' + kmTxt + ')' : '') + ' no alcanza para calcular un precio de mercado.';
    v.fuente = 'Sin fila con precio para esta ruta en la planilla de transfers (data/transfer-escalones.tsv). ' +
      'Los ' + kmTxt + '. El precio real de las dos modalidades se confirma con la agencia al reservar.';
    v.verificado = VERIFICADO;
    return;
  }

  const citas = [];
  if (real.includes('privado')) {
    const rango = escalones[k].map((e) => (e.min === e.max ? e.min + (e.min === 1 ? ' persona' : ' personas')
      : e.min + ' a ' + e.max + ' personas') + ', ' + (e.vehiculo || 'vehiculo') + ', R$ ' + e.brl);
    // El costo base va con su propia modalidad. Poner el de una al lado del precio
    // de la otra se lee como si el auto de Gramado costara R$ 90, que es el base
    // de la van compartida.
    const bases = planilla[k].privado.filter((p) => p.base).map((p) => 'R$ ' + p.base + ' + ' + (p.comision || '?')).join(' y ');
    citas.push('Privado por vehiculo' + (bases ? ' (base ' + bases + ')' : '') + ': ' + rango.join('; ') + '.');
  }
  if (real.includes('compartido')) {
    const c = planilla[k].compartido;
    const det = [];
    if (c.vehiculo) det.push(c.vehiculo);
    if (c.min && c.max) det.push(c.min === c.max ? c.min + ' persona' : c.min + ' a ' + c.max + ' personas');
    citas.push('Compartido por persona' + (c.base ? ' (base R$ ' + c.base + ' + ' + (c.comision || '?') + ')' : '') +
      ': R$ ' + compartido[k] + (det.length ? ' (' + det.join(', ') + ')' : '') + '.');
  }

  v.confianza = 'alta';
  v.verificado = VERIFICADO;
  v.fuente = 'Fuente: la planilla de transfers (data/transfer-escalones.tsv), fila ' +
    (de.iata || v.iata || '?') + ' a ' + nombre + '. ' + citas.join(' ') +
    ' Precio final de venta, en reales. ' + (como || (kmTxt ? 'Trayecto de ' + kmTxt + '.' : '')) +
    ' Un solo trayecto (aeropuerto a hotel), en reales.';

  const faltan = ['compartido', 'privado'].filter((c) => !real.includes(c));
  if (faltan.length) {
    v.derivacion = 'La modalidad ' + faltan.join(' y la ') + ' no tiene fila con precio en la planilla: la app ' +
      'muestra "Consultar". La otra sale de la fila citada, con su precio real.';
  } else {
    delete v.derivacion;
  }
}

fs.writeFileSync(JSON_PATH, JSON.stringify(datos, null, 2) + '\n', 'utf8');
const con = Object.keys(D).filter((k) => escalones[k].length);
console.log('destinos con escalones de privado: ' + con.length + ' de ' + Object.keys(D).length);
console.log('compartido con precio: ' + Object.keys(compartido).length + ' (' + Object.keys(compartido).join(', ') + ')');
console.log('sin ninguna modalidad con precio: ' + Object.keys(D).filter((k) => !escalones[k].length && compartido[k] == null).join(', '));
if (problemas.length) problemas.forEach((p) => console.log('AVISO ' + p));
