'use strict';
/*
 * Vuelos falsos para probar la app sin gastar un solo crédito.
 *
 * Por que existe: SerpAPI cobra un crédito por búsqueda y el calendario de
 * fechas son 15 búsquedas por apertura de propuesta (ver lib/model.js, el
 * `for (let s = -7; s <= 7; s++)`). Probar la app de punta a punta terminaba
 * agotando el plan al segundo rato. Para probar no hace falta un precio real:
 * hace falta que el precio sea estable, creíble y que venga con la misma forma
 * que el de verdad, para que el resto de la app no se entere de la diferencia.
 *
 * Eso es lo que hace este módulo: devuelve EXACTAMENTE las mismas tres formas
 * que serpapi.js (getFlightQuote, priceForDate, searchOutbound) con datos
 * generados localmente. No hay red, no hay cuota y no hay que esperar.
 *
 * Determinismo: el precio sale de un hash de (ruta, fechas, cabina), así que
 * la misma búsqueda da siempre el mismo número. Eso es lo que hace que un test
 * pueda afirmar sobre el total y no se intermitente entre corridas. Si el precio
 * fuera aleatorio, cada test tendría que tolerar un rango y no probaría nada.
 *
 * Se prende con MOCK_FLIGHTS=1 en el .env. Apagado, no se ejecuta nada de acá.
 *
 * Lo que NO hace, a propósito:
 *   - no adivina el precio real ni lo aproxima: si se lo muestra a alguien sin
 *     aclarar que es falso, el error es peor que no mostrar nada;
 *   - no pone(book_url) de una reserva real. El link sale a Google Flights como
 *     en el proveedor real, pero el `provider` de cada oferta dice 'mock' para
 *     que una prueba pueda distinguirla de una real.
 */

// Aerolíneas que vuelan de verdad a la región. Los nombres están porque el
// voucher y las tarjetas los muestran: probarlas con "Aerolínea" y "XX" no
// sirve para ver si el texto entra, se corta o desborda.
const AEROLINEAS = [
  { code: 'LA', name: 'LATAM' },
  { code: 'G3', name: 'GOL' },
  { code: 'AD', name: 'Azul' },
  { code: 'CM', name: 'Copa' },
  { code: 'AR', name: 'Aerolíneas Argentinas' },
  { code: 'WJ', name: 'JetSMART' },
  { code: 'FO', name: 'Flybondi' }
];

// Los aeropuertos que el proyecto usa de verdad. Un lugar desconocido cae en
// el mismo formato con el código, que es lo que la app muestra igual.
const AEROPUERTOS = {
  MVD: 'Aeropuerto Internacional de Carrasco',
  BUE: 'Aeropuerto Internacional de Ezeiza',
  EZE: 'Aeropuerto Internacional de Ezeiza',
  AEP: 'Aeropuerto Jorge Newbery',
  GIG: 'Aeropuerto Internacional de Galeão',
  SDU: 'Aeropuerto Santos Dumont',
  GRU: 'Aeropuerto Internacional de Guarulhos',
  CGH: 'Aeropuerto de Congonhas',
  VCP: 'Aeropuerto Internacional de Viracopos',
  IGU: 'Aeropuerto Internacional de Foz do Iguaçu',
  FLN: 'Aeropuerto Internacional Hercílio Luz',
  JPA: 'Aeropuerto de Navegantes',
  NVT: 'Aeropuerto de Navegantes',
  BSB: 'Aeropuerto Internacional de Brasilia',
  CNF: 'Aeropuerto Internacional de Confins',
  POA: 'Aeropuerto Internacional Porto Alegre',
  EZE_ORIG: 'Aeropuerto Internacional de Ezeiza',
  SCL: 'Aeropuerto Internacional de Santiago',
  LIM: 'Aeropuerto Jorge Chávez',
  MEX: 'Aeropuerto Internacional de Ciudad de México',
  ASU: 'Aeropuerto Internacional Silvio Pettirossi'
};

// Distancia aproximada en km, usada para que el precio tenga escala con el
// viaje. No hace falta que sea precisa: tiene que ser del mismo orden de
// magnitud, para que un vuelo a Buenos Aires no salga mas caro que uno a Rio.
const DISTANCIAS = {
  'MVD-BUE': 560, 'MVD-AEP': 560, 'MVD-EZE': 560, 'BUE-MVD': 560, 'AEP-MVD': 560, 'EZE-MVD': 560,
  'MVD-GIG': 1300, 'MVD-SDU': 1300, 'MVD-GRU': 1450, 'MVD-CGH': 1450, 'MVD-VCP': 1450,
  'GIG-MVD': 1300, 'SDU-MVD': 1300, 'GRU-MVD': 1450, 'CGH-MVD': 1450, 'VCP-MVD': 1450,
  'MVD-IGU': 580, 'IGU-MVD': 580,
  'MVD-FLN': 620, 'MVD-JPA': 620, 'MVD-NVT': 620,
  'FLN-MVD': 620, 'JPA-MVD': 620, 'NVT-MVD': 620,
  'MVD-BSB': 2300, 'MVD-CNF': 1500, 'MVD-POA': 600,
  'BUE-IGU': 1150, 'BUE-FLN': 1100, 'BUE-GIG': 1000, 'BUE-GRU': 1150,
  'BUE-BSB': 1900, 'BUE-POA': 1250, 'BUE-SCL': 1400, 'BUE-LIM': 2300
};

// Las tres cabinas que la app usa. `travelClassFor()` ya traduce ahorro/eq/
// comodo a 1/2/3 antes de llamarnos, asi que aqui se recibe el numero.
const CABINA = {
  1: { label: 'economy', texto: 'Economy', factor: 1 },
  2: { label: 'premium_economy', texto: 'Premium Economy', factor: 1.7 },
  3: { label: 'business', texto: 'Business', factor: 3.1 },
  4: { label: 'first', texto: 'First', factor: 5.4 }
};

function isEnabled() {
  return String(process.env.MOCK_FLIGHTS || '').trim() === '1';
}

/* FNV-1a de 32 bits. Barato, sin dependencias y estable entre corridas, que es
   justo lo que necesita un mock. Math.random() no sirve: cada proceso daria un
   precio distinto y los tests no podrian afirmar sobre el total. */
function hash(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function aAirport(code) {
  const c = String(code || '').toUpperCase();
  return { code: c, name: AEROPUERTOS[c] || ('Aeropuerto ' + c) };
}

function minutos(date, hours, mins) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCHours(hours, mins, 0, 0);
  return d.toISOString();
}

function sumarMin(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60000).toISOString();
}

function durationText(minutes) {
  const total = Math.round(Number(minutes));
  if (!Number.isFinite(total) || total <= 0) return '';
  const hours = Math.floor(total / 60), rest = total % 60;
  return (hours ? hours + ' h' : '') + (hours && rest ? ' ' : '') + (rest ? rest + ' min' : '');
}

// Escalas: 0 directo, 1 con una escala. La mayoria de los vuelos regionales
// son directos, y la escala concentra el grueso del precio cuando la hay.
function escalasDe(seed) {
  const r = seed % 10;
  if (r < 6) return 0;
  if (r < 9) return 1;
  return 2;
}

function distanciaDe(origin, destination) {
  const key = String(origin || '').toUpperCase() + '-' + String(destination || '').toUpperCase();
  if (DISTANCIAS[key] != null) return DISTANCIAS[key];
  const reverse = key.split('-').reverse().join('-');
  if (DISTANCIAS[reverse] != null) return DISTANCIAS[reverse];
  // Ruta no catalogada: se asume un tramo regional-medio. Preferimos un
  // numero plausible antes que 0, que daria un vuelo gratis.
  return 900;
}

// Precio por pasajero del viaje completo (ida y vuelta si hay vuelta). El
// jitter sale del hash, acotado a +-18%: un rango de variación que parece una
// diferencia real de tarifas sin hacer que dos rutas salgan al mismo precio.
function precioDe(origin, destination, dep, ret, travelClass) {
  const cabina = CABINA[travelClass] || CABINA[1];
  const km = distanciaDe(origin, destination);
  const base = 55 + km * 0.085;
  const idaYVuelta = ret ? 1.78 : 1;
  const seed = hash([origin, destination, dep, ret || '', travelClass].join('|'));
  const jitter = 0.82 + (seed % 37) / 100;   // 0.82 .. 1.18
  const escalas = escalasDe(seed >> 5);
  const factorEscala = escalas ? 1.15 + escalas * 0.22 : 1;
  const bruto = base * idaYVuelta * cabina.factor * jitter * factorEscala;
  return Math.max(29, Math.round(bruto));
}

function precioDeRango(origin, destination, dep, ret, travelClass, min, max) {
  const seed = hash([origin, destination, dep, ret || '', travelClass, 'oferta', min, max].join('|'));
  const pp = precioDe(origin, destination, dep, ret, travelClass);
  const rango = Math.max(1, max - min);
  return min + (seed % (rango + 1));
}

// Un tramo con la forma que espera el voucher: `outbound` e `inbound`.
function tramo(aerolinea, origin, destination, date, salidaH, salidaM, duracion, escalas, numeroVuelo) {
  const departure = minutos(date, salidaH, salidaM);
  const arrival = sumarMin(departure, duracion + escalas * 75);
  return {
    origin: aAirport(origin),
    destination: aAirport(destination),
    departure: departure,
    arrival: arrival,
    flight_number: numeroVuelo,
    airline: aerolinea.name,
    stops: escalas,
    duration: durationText(duracion + escalas * 75),
    carriers: [aerolinea.name]
  };
}

/* Misma forma que serpapi.getFlightQuote(): la tarifa de la propuesta. */
function getFlightQuote(input) {
  const travelClass = input.style;   // el caller ya traduce el nombre al numero
  const pp = precioDe(input.origin, input.destination, input.dep, input.ret, travelClass);
  const seed = hash([input.origin, input.destination, input.dep, input.ret, travelClass].join('|'));
  const aerolinea = AEROLINEAS[seed % AEROLINEAS.length];
  const escalas = escalasDe(seed >> 5);
  return {
    pp: pp,
    airline: aerolinea.name,
    transfers: escalas,
    // `exact` distingue "el proveedor dio este numero" de "lo approxime el
    // modelo". El mock siempre es exacto: se lo conoce al peso.
    exact: true,
    foundDep: input.dep,
    foundRet: input.ret,
    source: 'mock'
  };
}

/* Misma forma que serpapi.priceForDate(): un punto suelto del calendario. */
function priceForDate(input) {
  const pp = precioDe(input.origin, input.destination, input.dep, input.ret, input.travelClass || 1);
  const seed = hash([input.origin, input.destination, input.dep, input.ret, input.travelClass || 1].join('|'));
  return {
    pp: pp,
    total: pp * Math.max(1, Number(input.passengers) || 1),
    exact: true,
    airline: AEROLINEAS[seed % AEROLINEAS.length].name,
    stops: escalasDe(seed >> 5),
    priceLevel: (seed % 3 === 0) ? 'low' : ((seed % 3 === 1) ? 'typical' : 'high')
  };
}

/* Misma forma que serpapi.searchOutbound(): las tarjetas de la seccion de
   vuelos. A diferencia del proveedor real, acá SI viene el tramo de vuelta, de
   modo que el voucher se puede probar con las dos patas y no con "Vuelta
   (—) -> Origen (—)", que es lo que devuelve SerpAPI hoy. */
function searchOffers(input) {
  const travelClass = input.travelClass || 1;
  const cabina = CABINA[travelClass] || CABINA[1];
  const origen = String(input.origin || '').toUpperCase();
  const destino = String(input.destination || '').toUpperCase();
  const salida = String(input.departureDate || '');
  const vuelta = String(input.returnDate || '');
  const esIdaYVuelta = !!vuelta;
  const base = precioDe(origen, destino, salida, vuelta, travelClass);
  const ofertas = [];

  for (let i = 0; i < 6; i++) {
    const seed = hash([origen, destino, salida, vuelta, travelClass, 'oferta', i].join('|'));
    const aerolinea = AEROLINEAS[(seed + i) % AEROLINEAS.length];
    const escalas = escalasDe(seed >> 3);
    const numero = String(100 + (seed % 8900));
    const numeroVuelta = String(100 + ((seed >> 4) % 8900));
    const km = distanciaDe(origen, destino);
    // 840 km/h de crucero, que es lo que hacen estos aviones en la region.
    const duracion = Math.round(km / 8.4) + 40;
    const horaOut = 5 + (seed % 15);           // salidas entre 05:00 y 19:00
    const minOut = (seed >> 3) % 4 * 15;
    const outbound = tramo(aerolinea, origen, destino, salida, horaOut, minOut, duracion, escalas, numero);
    const inbound = esIdaYVuelta
      ? tramo(aerolinea, destino, origen, vuelta, 9 + ((seed >> 2) % 12), ((seed >> 5) % 4) * 15, duracion, escalas, numeroVuelta)
      : null;
    // El precio de cada tarjeta es el TOTAL del viaje (ida y vuelta) y ya
    // viene escalado por pasajeros, igual que en SerpAPI: por eso el browse
    // cuesta un solo crédito y no hace falta una segunda etapa.
    const pp = precioDeRango(origen, destino, salida, vuelta, travelClass, base, base + 140);
    const total = pp * Math.max(1, Number(input.passengers) || 1);

    ofertas.push({
      id: 'dep_' + i,
      provider: 'mock',
      airline: aerolinea.name,
      logo: null,
      cabin_class: cabina.label,
      cabin_label: cabina.texto,
      departure: outbound.departure,
      arrival: outbound.arrival,
      return_departure: inbound ? inbound.departure : null,
      return_arrival: inbound ? inbound.arrival : null,
      departure_airport: outbound.origin,
      arrival_airport: outbound.destination,
      flight_number: numero,
      stops: escalas,
      duration: outbound.duration,
      price_usd: total,
      original_price: String(total),
      original_currency: 'USD',
      trip_type: esIdaYVuelta ? 'round_trip' : 'one_way',
      outbound: outbound,
      inbound: inbound,
      // Sin `passenger_ids`: el mock no emite boletos, asi que no hay oferta que
      // reservar. El array va vacio a proposito en vez de inventar
      // identificadores de pasajero.
      passenger_ids: [],
      recommendation: 'Tarifa de prueba',
      departure_token: 'mock_dep_' + i,
      booking_token: 'mock_book_' + i,
      book_url: googleFlightsUrl({
        origin: origen, destination: destino, dep: salida, ret: esIdaYVuelta ? vuelta : null
      })
    });
  }

  ofertas.sort(function (a, b) { return a.price_usd - b.price_usd; });
  return { offers: ofertas };
}

// El link real de reserva sigue siendo el de Google Flights: el mock no emite
// boletos y no tiene sentido inventar uno.
function googleFlightsUrl(input) {
  const origin = String(input.origin || '').toUpperCase();
  const destination = String(input.destination || '').toUpperCase();
  const when = input.ret
    ? 'from ' + origin + ' to ' + destination + ' on ' + input.dep + ' through ' + input.ret
    : 'from ' + origin + ' to ' + destination + ' on ' + input.dep;
  return 'https://www.google.com/travel/flights?q=' + encodeURIComponent('Flights ' + when);
}

module.exports = {
  isEnabled, getFlightQuote, priceForDate, searchOffers, googleFlightsUrl,
  AEROLINEAS, AEROPUERTOS, hash, precioDe
};
