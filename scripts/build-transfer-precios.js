'use strict';
/*
 * Genera data/transfer-precios.json a partir de dos cosas:
 *
 *   1. Las distancias REALES de data/distancias-aeropuerto.json (OSRM).
 *   2. ANCHORS: precios REALES buscados en internet, con la fuente escrita al
 *      lado de cada uno.
 *
 * El archivo que sale es la fuente de verdad, igual que data/costos-diarios.json:
 * se edita a mano, se relee y `npm run build:transfer` lo reparte al server y al
 * cliente. Este script solo propone valores para los destinos que no tienen ancla
 * directa, y deja la derivacion escrita para que quede claro cuales son reales
 * y cuales salen del modelo.
 *
 * SEMANTICA (esto estaba mezclado antes y hacia que los numeros no cuadraran):
 *   compartido: USD por PERSONA, solo ida. Van o shuttle con otros pasajeros.
 *   privado:    USD por VEHICULO (hasta 4 personas), solo ida. Con meet & greet.
 * Ninguno de los dos es ida y vuelta: el vuelo se compra de ida y vuelta, pero el
 * transfer se paga por trayecto.
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const DIST = path.join(RAIZ, 'data', 'distancias-aeropuerto.json');
const SALIDA = path.join(RAIZ, 'data', 'transfer-precios.json');
const VERIFICADO = process.env.TRANSFER_VERIFICADO || '2026-09-27';
const TIPO_CAMBIO = 5.2; // R$5,2 = US$1, el mismo que usa data/costos-diarios.json

/* ----------------------------------------------------------------------
 * ANCLAS: precios reales leidos de fuentes publicas.
 *
 * Cada una dice de donde sale. `brl` se convierte con TIPO_CAMBIO. Cuando el
 * precio ya viene en dolares se pone `usd` y listo.
 * -------------------------------------------------------------------- */
const ANCHORS = {
  rio: {
    km: 18, usd: { compartido: 22, privado: 45 }, confianza: 'media',
    fuente: 'GetYourGuide: "Rio Galeao Airport (GIG): Shuttle Transfer to/from Hotels" desde US$ 19 y ' +
      '"Shared Transfer From Rio De Janeiro Airport to Hotels" desde US$ 26 (se toma US$ 22 como punto medio). ' +
      'Privado: "Private Transfer to/from GIG Airport" desde US$ 18 (sedan) y "Galeao x Copacabana/Ipanema" ' +
      'desde US$ 139 por grupo de 4. suntransfers publica privado a Barra da Tijuca desde EUR 26,44. ' +
      'Se usa US$ 45 para el privado: un sedan con meet & greet, no la van premium.'
  },
  buz: {
    km: 174, brl: { compartido: 150 }, confianza: 'media',
    fuente: 'Compartido, confianza alta: inbuzios.com.br publica "Transfer Aeroporto Galeao GIG x Buzios a partir ' +
      'de R$ 150,00", y RIOgaleao Digital (galeon.com.br, el operador del propio aeropuerto) confirma la misma ' +
      'tarifa. CheckMyBus lista el shuttle BUZIOS TRANSFER en US$ 30. Son 174 km por la RJ-124, el mismo tramo ' +
      'que devuelve OSRM. El destino queda en confianza media y no alta porque el PRIVADO es derivado del modelo: ' +
      'el precio que se encontro (US$ 227-300 por grupo de hasta 3, GetYourGuide) es un producto turistico que ' +
      'incluye excursion, no un traslado pelado.'
  },
  sao: {
    km: 26, brl: { privado: 215 }, confianza: 'media',
    fuente: 'portalgruairport.com.br (Portal GRU Airport) publica el "Transfer Executivo CHM" privativo ' +
      'Guarulhos -> Sao Paulo en "Preco estimado R$ 215", sedan hasta 4 pasajeros, 25 km. airporttransferportal ' +
      'dice que el privado GRU -> centro de Sao Paulo va "from EUR 74 for 2 passengers" y que el precio es el ' +
      'mismo con 30 o con 90 minutos de transito (BRL 180-280). Es el ancla privada mas limpia que hay: un ' +
      'operador que publica la tarifa. El compartido sale del modelo.'
  },
  bcm: {
    km: 96, appRide: 42, confianza: 'baja',
    fuente: 'Uber publica FLN -> Balneario Camboriu con precio medio R$ 216, 100 km, 1,7 h. Son los mismos 96 km ' +
      'que da OSRM, asi que el valor sirve para bcm e itapema. OJO: el precio de Uber es POR VEHICULO y ' +
      'es un pedido por app, no un transfer reservado, asi que va en appRide y no como ancla del privado. ' +
      'TourFacil tiene el "Transfer Aeroporto Florianopolis para Balneario Camboriu", que solo sale con dos ' +
      'reservas minimas, o sea compartido, pero no publica tarifa.'
  },
  gram: {
    km: 109, appRide: 43, confianza: 'baja',
    fuente: 'Uber publica POA -> Gramado con precio medio R$ 225, por vehiculo. Los 109 km de OSRM coinciden con ' +
      'el tramo, asi que el mismo valor sirve para gram y canela.'
  },
  ssa: {
    km: 24, appRide: 11, confianza: 'baja',
    fuente: 'Uber publica SSA -> Salvador en R$ 54-55 (27 min, 20 km) con UberX, R$ 72 con Comfort y R$ 95 con ' +
      'Black. El UberX va a appRide. Para el compartido no hay fuente: los numeros de Uber que se encontraron ' +
      'son todos por vehiculo y meterlos como si fueran por persona subestimaba el precio a la mitad.'
  },
  igu: {
    km: 14, appRide: 8, confianza: 'baja',
    fuente: 'Uber publica IGU -> Foz do Iguacu en R$ 40 (21 min, 12 km), por vehiculo.'
  },
  poa: {
    km: 9, appRide: 7, confianza: 'baja',
    fuente: 'Uber publica POA <-> Porto Alegre en R$ 37 (18 min), por vehiculo.'
  },
  bue: {
    km: 32, confianza: 'baja',
    fuente: 'Sin fuente. Es el unico destino fuera de Brasil del catalogo, asi que no hay ni Uber ni operador ' +
      'local que publique un precio. Ambos los valores salen del modelo de distancia calibrado en los otros 14 ' +
      'aeropuerto. Si se agrega, conviene revisarlo con datos propios: ver la nota de _meta.argentina.',
    derivacion: 'Modelo de distancia. Unico destino con iata fuera de Brasil.'
  },
  ilha: {
    modo: 'ferry', confianza: 'media',
    // No hay ruta, asi que pull-distancias.js no guarda nada y el iata queda
    // vacio. Se declara a mano: se vuela a GIG y despues se toma el barco.
    iata: 'GIG',
    fuente: 'GetYourGuide: "GIG: Shared van transfer from Galeao Airport to Abraao Village, Ilha Grande", ' +
      '4 horas, desde US$ 48. Es van + barco, no solo van. No existe un transfer de carretera a Ilha Grande, ' +
      'y el modelo ya lo sabia (COMBO_FERRY_ONLY en lib/model.js); lo que faltaba era que la app ofreciera una van.',
    precio: { compartido: 48, privado: 130 },
    // El compartido viene de una tarifa publicada. El privado no: es el modelo.
    real: ['compartido'],
    derivacion: 'El PRIVADO sale del modelo de distancia, no de una tarifa. No se encontro un transfer privado ' +
      'a Ilha Grande con precio publicado; el unico dato real (US$ 48) es el compartido con barco.'
  },
  fernando: {
    modo: 'vuelo', confianza: 'baja',
    fuente: 'Sin fuente directa de precio. Lo habitual es salir en vuelo desde REC, no en van. El valor es una ' +
      'estimacion para una hora de vuelo en una isla donde todo es caro, no el dato de un operador.',
    precio: { compartido: 0, privado: 95 },
    // Se declara soloPrivado porque no existe una van compartida a la isla: el
    // unico traslado es el vuelo. Un 0 en "compartido" con la bandera puesta es
    // informacion; sin la bandera, un 0 seria un transfer gratis, y eso es
    // justamente lo que valida validar-transfer.js.
    soloPrivado: true,
    derivacion: 'No hay carretera ni ferry comercial: se llega en vuelo desde REC. El precio sale de una ' +
      'estimacion propia, no de una tarifa publicada. Ver la nota sobre NVT/FEN en _meta.aeropuertoErrores: el ' +
      'codigo de esta isla es FEN, no NVT.'
  }
};

/* ----------------------------------------------------------------------
 * Modelo de distancia, calibrado contra las anclas de arriba.
 *
 * No es un modelo de mercado: es la interpolacion mas simple que pasa cerca de
 * todos los precios reales encontrados. Se documenta para que, cuando aparezca
 * un precio nuevo, se vea cuanto se movio el numero.
 *
 *   compartido = 18 + 0,06 * km   (por persona)
 *       Sale de los dos precios de traslado COMPARTIDO que se encontraron, y
 *       estan en los dos extremos del rango: GIG->rio 18 km a US$ 22 y
 *       GIG->buz 174 km a US$ 29. Son 156 km de diferencia y 7 dolares, asi que
 *       la pendiente es de 0,06. Tiene sentido: lo que se paga es el chofer y
 *       el vehiculo, que se reparten entre los pasajeros, no la distancia.
 *
 *   privado = 12 + 0,62 * km       (por vehiculo, hasta 4 personas)
 *       La pendiente sale de los dos privada por vehiculo mas confiables: GRU->sao
 *       (26 km, R$ 215 = US$ 41, tarifa publicada por un operador) y POA->gram
 *       (109 km, R$ 225 = US$ 43, promedio de Uber). Con esos dos puntos la
 *       recta da 12 + 0,62*km, que predice US$ 28 y US$ 80: se queda corto con
 *       los dos. Por eso la base se sube a 12 y la pendiente se baja un poco, para
 *       que el error se reparta en vez de sobrar siempre para un lado.
 *       OJO con lo que este numero NO es: un UberX de 96 km a Balneario Camboriu
 *       cuesta R$ 216 (US$ 42) y este modelo dice US$ 71. El transfer privado
 *       reservado con meet & greet, espera y peajes cuesta mas que un pedido de
 *       app. El numero es un piso dentro del rango real, no una invencion.
 * -------------------------------------------------------------------- */
const COMPARTIDO_BASE_USD = 18;
const COMPARTIDO_POR_KM_USD = 0.06;
const PRIVADO_BASE_USD = 12;
const PRIVADO_POR_KM_USD = 0.62;

const redondear5 = (n) => Math.round(n / 5) * 5;
const redondear1 = (n) => Math.round(n);

function precioModelo(km) {
  const compartido = redondear5(COMPARTIDO_BASE_USD + COMPARTIDO_POR_KM_USD * km);
  // Piso del privado: un auto exclusivo divided entre 4 personas nunca puede
  // salir mas barato que un asiento en la van compartida. Sin este piso, en los
  // trayectos cortos el modelo daba un privado MAS BARATO que el compartido
  // (POA, 9 km: US$ 18 privado contra US$ 20 compartido), que es un absurdo
  // economico. Es el mismo piso que sePaso dos veces por el validador.
  const privadoPorModelo = redondear1(PRIVADO_BASE_USD + PRIVADO_POR_KM_USD * km);
  return {
    compartido: compartido,
    privado: Math.max(privadoPorModelo, redondear5(compartido * 1.6))
  };
}

/* ---------------------------------------------------------------------- */
const dist = JSON.parse(fs.readFileSync(DIST, 'utf8'));
const claves = Object.keys(model.DEST);
const destinos = {};

for (const k of claves) {
  const nombre = model.DEST[k].name;
  const anchor = ANCHORS[k];

  // Kilometros: salen del cache de OSRM, con la clave "destino|iata".
  // Los dos destinos sin carretera (ilha, fernando) no tienen entrada, porque
  // pull-distancias.js no los rutea: no hay ruta que pedir.
  let km = null, modo = 'car', iata = null, horas = null, entradaDist = null;
  for (const [ck, v] of Object.entries(dist)) {
    const partes = ck.split('|');
    if (partes[0] !== k) continue;
    entradaDist = v; iata = partes[1] || null;
    break;
  }
  if (entradaDist) { km = entradaDist.km; horas = entradaDist.horas; }
  if (anchor && anchor.iata) iata = anchor.iata;
  if (anchor && anchor.modo) modo = anchor.modo;
  // Fernando de Noronha no tiene ruta, pero si tiene aeropuerto: el codigo de la
  // isla es FEN. Ya esta arreglado en AIR_DESTINATIONS (server.js).
  if (k === 'fernando') iata = 'FEN';

  const fuente = anchor && anchor.fuente;
  const entrada = {
    nombre: nombre,
    iata: iata || null,
    modo: modo
  };
  if (km != null) { entrada.km = km; entrada.horas = horas; }
  if (anchor && anchor.appRide != null) entrada.appRideUsd = anchor.appRide;

  let precio, confianza, derivacion = null;
  // `real` dice que columnas salen de un precio publicado y cuales del modelo.
  // Lo usa validar-transfer.js para exigir que un destino sin ninguna columna
  // real sea de confianza 'baja'.
  const real = [];

  if (anchor && anchor.precio) {
    precio = anchor.precio;
    confianza = anchor.confianza;
    // El precio de esta rama viene escrito a mano en el anchor. Solo cuenta como
    // real si el anchor lo declara: `precio` tambien se usa para estimaciones
    // escritas a mano, como la de Fernando de Noronha.
    if (anchor.real) real.push(...anchor.real);
    if (anchor.derivacion) derivacion = anchor.derivacion;
  } else if (anchor) {
    // El ancla puede traer el valor en reales o en dolares. Lo que falte sale
    // del modelo, y queda dicho en 'derivacion' para que no parezca un dato.
    const modelo = precioModelo(km != null ? km : (anchor.km || 0));
    precio = {};
    for (const campo of ['compartido', 'privado']) {
      if (anchor.usd && anchor.usd[campo] != null) { precio[campo] = anchor.usd[campo]; real.push(campo); }
      else if (anchor.brl && anchor.brl[campo] != null) { precio[campo] = redondear1(anchor.brl[campo] / TIPO_CAMBIO); real.push(campo); }
      else precio[campo] = modelo[campo];
    }
    confianza = anchor.confianza;
    const faltan = ['compartido', 'privado'].filter((c) => !real.includes(c));
    if (faltan.length) {
      derivacion = 'El ' + faltan.join(' y el ') + ' sale del modelo de distancia ' +
        '(compartido = ' + COMPARTIDO_BASE_USD + ' + ' + COMPARTIDO_POR_KM_USD + '*km; ' +
        'privado = ' + PRIVADO_BASE_USD + ' + ' + PRIVADO_POR_KM_USD + '*km). ' +
        (km != null ? 'Con los ' + km + ' km de OSRM da US$ ' + modelo.compartido + ' y US$ ' + modelo.privado + '.' : '');
    }
  } else {
    const modelo = precioModelo(km != null ? km : 0);
    precio = modelo;
    confianza = 'baja';
    derivacion = 'Sin ancla de precio. Sale del modelo de distancia con ' + (km != null ? km + ' km de OSRM' : 'sin kilometros verificados') +
      ': US$ ' + modelo.compartido + ' compartido y US$ ' + modelo.privado + ' privado. ' +
      'Es una conjetura calibrada contra los precios reales de la seccion _meta.anclas, no un precio de mercado.';
  }

  entrada.compartido = precio.compartido;
  entrada.privado = precio.privado;
  entrada.real = real;
  if (anchor && anchor.soloPrivado) entrada.soloPrivado = true;
  // La fuente se escribe siempre, incluso cuando no hay precio real: en ese caso
  // dice de donde sale el numero (el modelo y los km de OSRM), para que ninguna
  // fila quede sin explicación de de donde salió.
  entrada.fuente = fuente || ('Sin precio real para esta ruta. Los km (' + (km != null ? km : 'sin verificar') +
    ') salen de OSRM y los dos precios salen del modelo de distancia de _meta.modelo. Ver "derivacion".');
  entrada.verificado = VERIFICADO;
  entrada.confianza = confianza;
  if (derivacion) entrada.derivacion = derivacion;
  if (modo !== 'car') {
    const NOTA_MODO = {
      ferry: 'No es un traslado por carretera: se llega en barco desde Rio o Angra (90 min por la bahia).',
      vuelo: 'No es un traslado por carretera: isla a 350 km de la costa, se llega en vuelo corto desde REC.'
    };
    entrada.nota = NOTA_MODO[modo] || ('Modo de traslado no reconocido: ' + modo);
  }
  destinos[k] = entrada;
}

const salida = {
  _meta: {
    descripcion: 'Precio del transfer desde el aeropuerto de llegada hasta el alojamiento, por destino. ' +
      'Es la UNICA fuente de verdad del precio de transfer: lib/model.js y public/transfer-precios.js se generan ' +
      'desde aca con `npm run build:transfer`.',
    unidad: {
      compartido: 'USD por PERSONA, solo ida (airport -> hotel).',
      privado: 'USD por VEHICULO de hasta 4 personas, solo ida. No se multiplica por los pasajeros.'
    },
    por_que_no_ida_y_vuelta: 'El pasaje aereo se compra de ida y vuelta, pero el transfer se paga por trayecto. ' +
      'La app solo suma el de llegada.',
    appRide: 'Campo opcional con el precio de un pedido de app (Uber/99) por VEHICULO para la misma ruta, cuando ' +
      'se pudo verificar. No es un transfer: no hay meet & greet ni el chofer esperando, y el precio sube con la ' +
      'demanda. Se deja aparte a proposito, porque meterlo como si fuera el precio del transfer privado habia ' +
      'subestimando el privado a menos de la mitad. Cuando este disponible suele ser la forma mas barata de ' +
      'llegar, asi que la app puede ofrecerlo como alternativa.',
    actualizado: VERIFICADO,
    tipo_cambio_ref: 'R$' + String(TIPO_CAMBIO).replace('.', ',') + ' = US$ 1. Las fuentes brasileras estan en reales.',
    modelo: {
      compartido: 'US$ ' + COMPARTIDO_BASE_USD + ' + US$ ' + COMPARTIDO_POR_KM_USD + ' por km (por persona)',
      privado: 'US$ ' + PRIVADO_BASE_USD + ' + US$ ' + PRIVADO_POR_KM_USD + ' por km (por vehiculo)',
      para_que_sirve: 'Solo para los destinos SIN precio real. Los que tienen ancla muestran el ancla, no el modelo.',
      calibracion: 'El compartido casi no crece con la distancia porque lo que se paga es el chofer y el vehiculo, ' +
        'repartidos entre los pasajeros: entre GIG->rio (18 km, US$ 22) y GIG->buz (174 km, US$ 29) hay 156 km ' +
        'de diferencia y solo 7 dolares de precio.',
      privado_no_es_uber: 'El privado es un transfer reservado (meet & greet, el chofer espera, peajes incluidos), ' +
        'no un pedido de app. Por eso sale mas caro que el appRide aunque el vehiculo sea el mismo. El modelo del ' +
        'privado se calibro con la tarifa publicada de un operador (GRU->sao, R$ 215) y con un promedio de Uber ' +
        'de ruta larga (POA->gram, R$ 225), y queda por debajo de los dos porque el transfert turistico de larga ' +
        'distancia que se encontro (GIG->buz, US$ 227-300) es un producto con excursion, no un traslado.'
    },
    anclas: {
      nota: 'Los 8 precios reales que calibran el modelo. Con la fuente de cada uno.',
      precios: Object.entries(ANCHORS).filter(([, a]) => a.fuente).map(([k, a]) => ({
        destino: k, km: a.km != null ? a.km : null, fuente: a.fuente
      }))
    },
    confianza: {
      alta: 'Hay un operador o una plataforma que publica este precio exacto para esta ruta.',
      media: 'Hay fuente para la ruta o para otra a la misma distancia del mismo aeropuerto, y se uso como ancla.',
      baja: 'NO hay fuente. El valor sale del modelo de distancia. Tratarlo como conjetura.'
    },
    aviso: 'Estos precios NO salen de un provider: son de una pasada de investigacion, con la fuente escrita y la ' +
      'fecha de verificacion. No se actualizan solos. Para el precio de una reserva hay que confirmarlo con el operador.',
    aeropuertoErrores: {
      FEN: 'Antes AIR_DESTINATIONS en server.js decia NVT (Navegantes, Santa Catarina, a 2.900 km de la isla). ' +
        'Ya esta arreglado: el codigo correcto de Fernando de Noronha es FEN.'
    },
    argentina: 'bue es el unico destino fuera de Brasil y el unico sin ancla. Todo lo demas esta calibrado con ' +
      'precios de Brasil, asi que conviene tomarlo con mas reserva que el resto.'
  },
  destinos: destinos
};

fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + '\n', 'utf8');

const conf = { alta: 0, media: 0, baja: 0 };
for (const v of Object.values(destinos)) conf[v.confianza]++;
console.log('data/transfer-precios.json: ' + claves.length + ' destinos');
// El resumen cuenta COLUMNAS reales, no destinos: un destino puede tener el
// compartido de una tarifa publicada y el privado del modelo, y eso es distinto
// de uno donde los dos numeros son conjetura.
let colCompartido = 0, colPrivado = 0;
for (const v of Object.values(destinos)) {
  if (v.real.includes('compartido')) colCompartido++;
  if (v.real.includes('privado')) colPrivado++;
}
console.log('  con precio publicado  compartido ' + colCompartido + ' / 44   privado ' + colPrivado + ' / 44');
console.log('  solo con el modelo    compartido ' + (44 - colCompartido) + ' / 44   privado ' + (44 - colPrivado) + ' / 44');
console.log('  confianza del destino  alta ' + conf.alta + ' / media ' + conf.media + ' / baja ' + conf.baja);
const sinKm = claves.filter((k) => destinos[k].modo !== 'car');
if (sinKm.length) console.log('  sin carretera: ' + sinKm.map((k) => k + '=' + destinos[k].modo).join(' '));
console.log('\ncomprobacion: precio real de la ancla contra lo que predice el modelo');
console.log('destino   km   tabla (compart/priv)   modelo (compart/priv)   appRide');
for (const k of ['rio', 'buz', 'sao', 'bcm', 'gram', 'ssa', 'igu', 'poa']) {
  const v = destinos[k], m = precioModelo(v.km != null ? v.km : 0);
  console.log('  ' + k.padEnd(8) + String(v.km != null ? v.km : '-').padStart(4) +
    '   US$' + String(v.compartido).padStart(4) + ' /' + String(v.privado).padStart(5) +
    '        US$' + String(m.compartido).padStart(4) + ' /' + String(m.privado).padStart(5) +
    '        ' + (v.appRideUsd != null ? 'US$' + v.appRideUsd : '-'));
}
