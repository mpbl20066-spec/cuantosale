'use strict';
/*
 * Valida data/transfer-precios.json y las dos copias generadas.
 *
 * Es el equivalente de scripts/validar-costos.js para la tabla de transfer, y
 * existe por la misma razon: esta tabla ya se divergio una vez sin que nada se
 * enterara. Antes los precios vivian en tres lugares (dos en public/app.js y uno
 * en server.js) y los tres decian una cosa distinta.
 *
 * Lo que se comprueba:
 *   1. Cobertura: los 44 destinos de DEST estan, y no hay destinos de mas.
 *   2. Forma: los precios son numeros positivos y el compartido no supera al privado.
 *   3. Semantica: todo destino de carretera tiene km, y los que no la tienen estan
 *      declarados como ferry o vuelo. Un destino sin carretera al que se le
 *      ofrece una van es el bug que se corrigio con esta tabla.
 *   4. Trazabilidad: cada destino dice de donde sale su numero. Confianza 'baja'
 *      tiene que explicar la derivacion.
 *   5. Las copias generadas (lib/model.js y public/transfer-precios.js) están
 *      sincronizadas con el JSON, y la procedencia (fuente, confianza, fecha y si
 *      cada modalidad tiene tarifa publicada) llega al cliente.
 *   6. La tabla del cliente y la del modelo dan el mismo numero.
 *   7. No quedan numeros hardcodeados en public/app.js: ni 30 ni 150 ni 35.
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'transfer-precios.json');
const MODEL_PATH = path.join(RAIZ, 'lib', 'model.js');
const CLIENTE_PATH = path.join(RAIZ, 'public', 'transfer-precios.js');
const APP_PATH = path.join(RAIZ, 'public', 'app.js');
const SERVER_PATH = path.join(RAIZ, 'server.js');

let errores = 0, avisos = 0;
const err = (m) => { console.log('  FALLA ' + m); errores++; };
const av = (m) => { console.log('  aviso  ' + m); avisos++; };

let datos;
try { datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); }
catch (e) { console.log('  FALLA JSON no parsea: ' + e.message); process.exit(1); }

const D = datos.destinos;
const claves = Object.keys(D);
const delModelo = Object.keys(model.DEST);

console.log('destinos en el JSON: ' + claves.length + ' | en DEST: ' + delModelo.length +
  ' | en TRANSFER_PRICES: ' + Object.keys(model.TRANSFER_PRICES).length + '\n');

/* 1. cobertura */
for (const k of delModelo) {
  if (!D[k]) err('falta ' + k + ' (' + model.DEST[k].name + ')');
  if (!model.TRANSFER_PRICES[k]) err('falta ' + k + ' en TRANSFER_PRICES (lib/model.js)');
}
for (const k of claves) if (!delModelo.includes(k)) err(k + ' esta en el JSON pero no en DEST');

/* 2. forma de los valores */
for (const [k, v] of Object.entries(D)) {
  for (const campo of ['compartido', 'privado']) {
    const n = v[campo];
    if (typeof n !== 'number' || !Number.isFinite(n)) { err(k + '.' + campo + ' no es numero: ' + n); continue; }
    // Un 0 en compartido es valido SOLO si el destino declara soloPrivado: a una
    // isla no se le ofrece van compartida, y 0 sin la bandera seria un transfer
    // gratis. Un 0 en privado no tiene sentido en ningun caso.
    if (n === 0) {
      if (campo === 'compartido' && v.soloPrivado) continue;
      // Sin precio cargado: la app dice "Consultar". Tiene que ser explicito.
      if (campo === 'compartido' && v.compartido_consultar) continue;
      err(k + '.' + campo + ' es 0. Si el destino no tiene traslado compartido, declaralo con "soloPrivado": true; ' +
        'un 0 sin esa bandera es un transfer gratis.');
      continue;
    }
    if (n < 0) err(k + '.' + campo + ' es negativo: ' + n);
    else if (n > 600) err(k + '.' + campo + ' fuera de rango: ' + n);
  }
  if (v.soloPrivado && v.compartido !== 0) {
    err(k + ' declara soloPrivado pero tiene compartido: ' + v.compartido + '. O se ofrece la van compartida, o no.');
  }
  // El compartido se cobra por persona y el privado por vehiculo para hasta 4.
  // Si el privado sale mas barato que el compartido, alguna de las dos columnas
  // esta mal puesta: es el error que se cometio al meter un precio de Uber (por
  // vehiculo) en la columna de compartido (por persona).
  //
  // Solo se exige cuando las dos columnas NO vienen de la planilla. Si las dos son
  // tarifas reales de la agencia, la relacion de precios es su negocio y no un
  // error de unidades: Ilha Grande cobra R$ 468 la van compartida por persona y
  // R$ 444 el auto privado para 4, y puede ser cierto, porque el compartido de la
  // isla incluye el barco. Ese caso se declara, no se corrige.
  const ambasReales = Array.isArray(v.real) && v.real.includes('compartido') && v.real.includes('privado');
  if (typeof v.compartido === 'number' && typeof v.privado === 'number' && v.privado < v.compartido) {
    if (ambasReales) {
      av(k + ': el privado (' + v.privado + ') sale menos que el compartido (' + v.compartido +
        '). Las dos son tarifas de la planilla, asi que se deja como esta; revisar si el precio es el correcto.');
    } else {
      err(k + ': el privado (' + v.privado + ') sale menos que el compartido (' + v.compartido + ')');
    }
  }
  if (v.appRideUsd != null && (typeof v.appRideUsd !== 'number' || v.appRideUsd <= 0)) {
    err(k + '.appRideUsd invalido: ' + v.appRideUsd);
  }
}

/* 3. semantica: carretera, ferry o vuelo */
for (const [k, v] of Object.entries(D)) {
  const modo = v.modo;
  if (!['car', 'ferry', 'vuelo'].includes(modo)) { err(k + '.modo invalido: ' + modo); continue; }
  if (modo === 'car') {
    if (typeof v.km !== 'number' || v.km <= 0) err(k + ' es de carretera pero no tiene km');
    else if (v.km < 3) err(k + ' con ' + v.km + ' km: corto demais para un traslado de aeropuerto');
  } else {
    if (v.km != null) av(k + ' es ' + modo + ' pero tiene km (' + v.km + '). No deberia: no hay ruta.');
    if (!v.nota) err(k + ' es ' + modo + ' y no explica en "nota" por que no hay carretera');
  }
  // Los destinos sin carretera son un conjunto chico y fijo. Si aparece uno
  // nuevo, hay que decidir a mano si es ferry o vuelo.
  if (modo !== 'car' && !['ilha', 'fernando'].includes(k)) {
    err(k + ' aparece como ' + modo + '. Los unicos destinos sin carretera del catalogo son ilha y fernando; ' +
      'si se sumo otro, hay que decidirlo a mano y anotarlo.');
  }
}

/* 4. trazabilidad */
for (const [k, v] of Object.entries(D)) {
  if (!v.fuente) err(k + ' sin "fuente"');
  if (!v.verificado) err(k + ' sin "verificado"');
  if (!['alta', 'media', 'baja'].includes(v.confianza)) err(k + ' confianza invalida: ' + v.confianza);
  if (!Array.isArray(v.real)) { err(k + ' sin la lista "real" (que columnas salen de un precio publicado)'); continue; }
  // Sin ninguna columna real, todo el numero es conjetura: tiene que ser 'baja'
  // y tiene que decir como se derivo.
  if (!v.real.length) {
    if (v.confianza !== 'baja') err(k + ' no tiene ningun precio real (real: []) pero es de confianza ' + v.confianza + '. Sin fuente, es baja.');
    if (!v.derivacion) err(k + ' no tiene ningun precio real y no dice como se derivo el numero');
  } else if (v.confianza === 'baja' && v.real.length) {
    err(k + ' dice real: [' + v.real + '] pero es de confianza baja. Si tiene un precio publicado, es media o alta.');
  }
  // Una columna real tiene que estar en 'real', y al reves. Si aparece un numero
  // con fuente en una columna que no esta en 'real', la fuente no se esta usando.
  //
  // Confianza 'alta' pide AL MENOS una columna con tarifa publicada, no las dos:
  // hay destinos donde la agencia solo vende una modalidad (Itacaré solo tiene
  // privado, Maceió solo Van y las dos), y en ese caso la columna que falta no es
  // una conjetura sino un "Consultar" sin precio cargado. Exigir las dos daba
  // error en un destino con un solo producto, que no es un error de datos.
  // Lo que no puede pasar es 'alta' sin ninguna tarifa real, y eso lo cubre la
  // rama de `real: []` de mas arriba.
  if (v.confianza === 'alta' && !v.real.length) {
    err(k + ' es de confianza alta pero no declara ninguna tarifa publicada');
  }
}

/* caracteres no esperados, igual que validar-costos.js */
for (const [k, v] of Object.entries(D)) {
  for (const campo of ['fuente', 'nota', 'derivacion']) {
    const t = v[campo];
    if (!t) continue;
    const malos = [...t].filter((c) => {
      const p = c.codePointAt(0);
      return (p >= 0x3000 && p <= 0x9FFF) || (p >= 0xF900 && p <= 0xFAFF) || (p >= 0xFF00 && p <= 0xFFEF);
    });
    if (malos.length) err(k + '.' + campo + ' tiene caracteres de otro idioma: ' + malos.join(''));
  }
}

/* 5. las copias generadas están al día */
const modeloTxt = fs.readFileSync(MODEL_PATH, 'utf8');
for (const [k, v] of Object.entries(D)) {
  const linea = new RegExp('^\\s*' + k + ': \\{[^}]*compartido: ' + v.compartido + '[^}]*\\}', 'm');
  if (!linea.test(modeloTxt)) err('lib/model.js no tiene ' + k + ' con compartido: ' + v.compartido + '. Corré npm run build:transfer');
}
if (!fs.existsSync(CLIENTE_PATH)) {
  err('no existe public/transfer-precios.js. Corré npm run build:transfer');
} else {
  const cliente = require(CLIENTE_PATH);
  for (const k of claves) {
    if (!cliente[k]) { err('public/transfer-precios.js no tiene ' + k); continue; }
    if (cliente[k].compartido !== D[k].compartido || cliente[k].privado !== D[k].privado) {
      err('el cliente y el JSON difieren en ' + k + ': cliente ' + cliente[k].compartido + '/' + cliente[k].privado +
        ' vs JSON ' + D[k].compartido + '/' + D[k].privado);
    }
  }

  // 5b. La procedencia tiene que viajar al cliente.
  // Esta tabla es la que mas lo necesita: 5 de 88 celdas tienen tarifa publicada
  // y el resto sale de un modelo de distancia. Sin esto en pantalla, la app puede
  // decir "estimado" pero no "estimado con esta formula y estos km", que es la
  // diferencia entre una conjetura declarada y una presentada como precio.
  const prov = cliente.provenance;
  if (!prov) {
    err('public/transfer-precios.js no exporta la procedencia. Corré npm run build:transfer');
  } else {
    if (!prov._meta || !prov._meta.modelo || !prov._meta.modelo.compartido) {
      err('la procedencia no trae las formulas del modelo de distancia');
    }
    for (const k of claves) {
      if (!prov[k]) { err('sin procedencia para ' + k); continue; }
      if (prov[k].fuente !== D[k].fuente) err('la fuente de ' + k + ' no coincide con el JSON');
      if (prov[k].confianza !== D[k].confianza) err('la confianza de ' + k + ' no coincide con el JSON');
      if (prov[k].verificado !== D[k].verificado) err('la fecha de ' + k + ' no coincide con el JSON');
      // 'real' declara que modalidades tienen tarifa publicada. Si el destino es de
      // confianza baja y dice tener alguna real, o algo esta mal en el JSON o la
      // app va a mostrar "precio real" al lado de una conjetura.
      if (D[k].confianza === 'baja' && (prov[k].real || []).length) {
        err(k + ' es de confianza baja pero declara tarifas reales: ' + prov[k].real.join(', '));
      }
      // Toda modalidad que no sea real tiene que poder explicar como se calculo.
      const sinAncla = ['compartido', 'privado'].filter((m) => !(prov[k].real || []).includes(m));
      if (sinAncla.length && !prov[k].derivacion) {
        err(k + ' no tiene tarifa publicada para ' + sinAncla.join('/') + ' y no explica la derivacion');
      }
    }
  }
}

/* 6. la tabla del modelo y la del JSON dan lo mismo */
for (const [k, v] of Object.entries(D)) {
  const t = model.TRANSFER_PRICES[k];
  if (!t) continue;
  if (t.compartido !== v.compartido || t.privado !== v.privado) {
    err('TRANSFER_PRICES y el JSON difieren en ' + k + ': ' + t.compartido + '/' + t.privado +
      ' vs ' + v.compartido + '/' + v.privado);
  }
}

/* 7. no quedan numeros de transfer written a mano en el cliente */
const appTxt = fs.readFileSync(APP_PATH, 'utf8');
const serverTxt = fs.readFileSync(SERVER_PATH, 'utf8');
if (/transferType === 'private'\) return \d/.test(appTxt)) {
  err('public/app.js tiene un precio de transfer fijo en getSelectedTransferAmount. Debe salir de la tabla.');
}
if (/data-transfer-amount="\d+"/.test(appTxt)) {
  err('public/app.js tiene un data-transfer-amount fijo. Las cards deben tomar el precio de la tabla.');
}
if (/amount: 30|amount: 150/.test(appTxt)) {
  err('public/app.js tiene las cards de transfer con 30 y 150 escritos a mano.');
}
if (/OFFICIAL_TRANSFER_PRICE_USD\) \|\| 35/.test(serverTxt)) {
  av('server.js todavia usa OFFICIAL_TRANSFER_PRICE_USD como piso. Esta bien que quede como red de ' +
    'seguridad, pero chequear que la tabla cubra todos los destinos (validar-transfer.js lo comprueba).');
}

/* resumen */
const conf = { alta: 0, media: 0, baja: 0 };
for (const v of Object.values(D)) conf[v.confianza]++;
const conApp = Object.values(D).filter((v) => v.appRideUsd != null).length;
console.log('confianza  alta ' + conf.alta + ' / media ' + conf.media + ' / baja ' + conf.baja +
  '   (con precio de app: ' + conApp + ')');
const sinKm = claves.filter((k) => D[k].modo !== 'car');
console.log('sin carretera: ' + sinKm.join(' ') + '  (' + sinKm.map((k) => k + '=' + D[k].modo).join(', ') + ')');
console.log('\n' + (errores ? errores + ' FALLAS, ' + avisos + ' avisos' : avisos ? avisos + ' avisos, sin fallas' : 'todo bien'));
process.exit(errores ? 1 : 0);
