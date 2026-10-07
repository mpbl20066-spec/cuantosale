'use strict';
/*
 * Reúne las fuentes de datos reales. Si no hay SERPAPI_API_KEY, el server queda
 * en "modo demo" y todo se estima con el modelo.
 *
 * Con MOCK_FLIGHTS=1 entra además `mock.js`, que devuelve las mismas formas con
 * datos inventados pero estables. Es para probar la app sin gastar créditos:
 * SerpAPI cobra por búsqueda y el calendario de fechas son 15 por apertura de
 * propuesta, así que probar de punta a punta vaciaba el plan. Con el mock no hay
 * red, no hay cuota y los precios no cambian entre corrida, que es lo que
 * permite que un test afirme sobre el total en vez de tolerar un rango.
 *
 * Acá vive la decisión de costo del gráfico de fechas. Cada punto del calendario
 * es una búsqueda ida y vuelta distinta (las dos fechas se mueven juntas para
 * mantener las mismas noches), así que el cache NO puede ser por serie: es por
 * punto, con clave (ruta, ida, vuelta, pax, cabina) y TTL largo. Dos personas
 * que buscan la misma ruta en el mismo día comparten casi todos sus puntos, y
 * es ese solapamiento lo que paga la cuenta. Con la serie completa cacheada por
 * separado, dos búsquedas casi nunca coincidirían y cada visita costaria 15
 * créditos.
 */
const fs = require('fs');
const path = require('path');
const vuelos = require('./vuelos');
const mock = require('./mock');
const cacheDb = require('./cache-persistente');

const cache = new Map();      // key -> { at, expiresAt, value }
const inflight = new Map();   // key -> Promise (evita pedidos repetidos al mismo tiempo)
let cooldownUntil = 0;        // si responde 429 o se acaban los créditos, frenamos un rato

/*
 * El cache vive en disco, no solo en memoria.
 *
 * Antes era un Map() en memoria: cada reinicio del server lo vaciaba, y
 * reiniciar es exactamente lo que pasa seguido de un deploy o de tocar una
 * variable de entorno. Con el cache en memoria, reiniciar es volver a pagar
 * las 15 busquedas de la serie de fechas. Un precio de vuelo no cambia en
 * reiniciar.
 *
 * El archivo se escribe con rename atomico (escribir a .tmp y mover), asi un
 * corte de luz a mitad de escritura no deja un JSON truncado que rompe el
 * arranque del server.
 */
const CACHE_FILE = path.join(__dirname, '..', '..', '.serpapi-cache.json');
const SAVE_DEBOUNCE_MS = 2000;
let saveTimer = null;
let saveWarned = false;

function loadCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const data = JSON.parse(raw);
    const ahora = Date.now();
    let vivos = 0;
    Object.keys(data).forEach(function (k) {
      const v = data[k];
      // Un TTL vencido no se guarda: al leerlo ya no sirve y ocupa lugar.
      if (v && v.expiresAt > ahora) { cache.set(k, v); vivos++; }
    });
    if (vivos) console.log('[serpapi] cache en disco: ' + vivos + ' entradas vigentes');
  } catch (e) {
    if (e && e.code !== 'ENOENT') {
      console.warn('[serpapi] no se pudo leer el cache en disco: ' + e.message);
    }
  }
}

function saveCache() {
  saveTimer = null;
  const ahora = Date.now();
  const data = {};
  cache.forEach(function (v, k) {
    if (v && v.expiresAt > ahora) data[k] = v;
  });
  const tmp = CACHE_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
    fs.renameSync(tmp, CACHE_FILE);
  } catch (e) {
    // Perder el cache es malo, pero no vale la pena tumbar el server por eso.
    if (!saveWarned) {
      console.warn('[serpapi] no se pudo guardar el cache: ' + e.message);
      saveWarned = true;
    }
    try { fs.unlinkSync(tmp); } catch (e2) { /* ya no esta */ }
  }
}

// Escritura agrupada: una serie de 15 puntos genera 15 escrituras seguidas y
// no tiene sentido tocar el disco 15 veces.
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveCache, SAVE_DEBOUNCE_MS);
  if (saveTimer.unref) saveTimer.unref();
}

loadCache();

function isLive() { return vuelos.isConfigured() || mock.isEnabled(); }
// Que proveedor esta activo, para que el server lo pueda reportar y un test
// pueda distinguir una oferta real de una de prueba. Es lo que permite, por
// ejemplo, no pedirle a un mock que se comporte como un vuelo real.
function providerName() { return mock.isEnabled() && !vuelos.isConfigured() ? 'mock' : vuelos.nombre(); }
// El fetch inyectable se pasa al provider: es el provider quien hace las
// llamadas HTTP, y un mock que se quede en el agregador no mockearia nada.
function setFetch(f) { vuelos.setFetch(f); }
/*
 * Tope de gasto de SerpAPI. El plan gratis son 250 busquedas al mes y cada pedido
 * pago a la API es 1. Sin tope, abrir UNA propuesta de avion disparaba el
 * calendario de fechas (15 pedidos): con tráfico real se gastaron ~190 de 250 en
 * pocos dias y la app se quedo sin vuelos reales.
 *
 * Dos palancas, las dos por variable de entorno:
 *  - SERPAPI_CALENDAR_LIVE=1 permite el calendario "mismo viaje, otra fecha" con
 *    pedidos reales (15 creditos por viaje distinto). Apagado por defecto: sin
 *    esto el grafico sale con estimaciones y solo usa lo que ya este en cache.
 *  - SERPAPI_DAILY_MAX tope de pedidos pagos por dia UTC (15 por defecto). Al
 *    llegar, la app responde con estimaciones y el browse dice "saturada".
 *
 * LIMITE CONOCIDO: el contador vive en la memoria del proceso, igual que el
 * limite por IP (ver server.js). En Vercel el tope real es "por instancia".
 */
let gastoDia = '', gastoN = 0;
function hoyUtc() { return new Date().toISOString().slice(0, 10); }
function topeDiario() {
  const n = Number(process.env.SERPAPI_DAILY_MAX);
  return n >= 0 && process.env.SERPAPI_DAILY_MAX !== undefined && process.env.SERPAPI_DAILY_MAX !== '' ? n : 15;
}
function topeAlcanzado() { return gastoDia === hoyUtc() && gastoN >= topeDiario(); }
// Reserva un pedido pago. false = no se puede gastar mas hoy.
function gastar() {
  const hoy = hoyUtc();
  if (gastoDia !== hoy) { gastoDia = hoy; gastoN = 0; }
  if (gastoN >= topeDiario()) return false;
  gastoN += 1;
  return true;
}
function calendarioEnVivo() { return process.env.SERPAPI_CALENDAR_LIVE === '1'; }

// Verdadero mientras se espera tras un 429 o creditos agotados, o si se llego al
// tope diario. Lo usa el server para no decir "no hay vuelos" cuando en realidad
// no se consulto a nadie.
function enPausa() { return Date.now() < cooldownUntil || topeAlcanzado(); }
function clearCache() { cache.clear(); inflight.clear(); cooldownUntil = 0; gastoN = 0; saveCache(); }

function ttlMs(found) {
  // 24 horas por defecto, antes 3. El precio de un vuelo que sale dentro de dos
  // o seis meses no se mueve en tres horas, y el credito de SerpAPI es el
  // recurso scarce: con un TTL corto, cualquiera que vuelve a la pagina a la
  // tarde vuelve a pagar la tarifa completa.
  //
  // Ojo con el cache propio de SerpAPI: ellos devuelven gratis lo que ya
  // consultaron en la ultima hora. Un TTL nuestro MAS CORTO que una hora no
  // ahorra nada, porque el request igual sale y lo que evita es el cobro, no la
  // llamada. Para que el cache de ellos sirva hay que tener un TTL mas largo
  // que el de ellos, no mas corto.
  const min = Number(process.env.QUOTE_TTL_MIN) || 1440;
  return (found ? min : Math.min(10, min)) * 60000;
}

// El TTL del calendario es largo a propósito: cada punto es un crédito, y el
// precio de un vuelo a una fecha fija no cambia de un día a otro.
function calendarTtlMs() {
  const hours = Number(process.env.SERPAPI_CALENDAR_TTL_H) || 168;
  return hours * 60 * 60 * 1000;
}

function maxEntries() { return Number(process.env.SERPAPI_CACHE_MAX) || 2000; }

/* ---------- clave de cache ----------
   La clave la arman DOS lugares: el que busca (para ver si ya la tengo) y el
   prefetch (para traerla de la base de antemano). Si esos dos construyeran la
   clave por su cuenta, cualquier diferencia de un carácter las desincroniza y
   el prefetch no serviría para nada, sin ningún error visible: simplemente nunca
   habría aciertos. Por eso la clave vive acá y en un solo lado. */
function quoteKey(origin, destination, dep, ret, travelClass) {
  return ['q', origin, destination, dep, ret, travelClass].join('|');
}
function calendarKey(origin, destination, dep, ret, pax, travelClass) {
  return ['c', origin, destination, dep, ret, pax, travelClass].join('|');
}

/* ---------- cuánto esperar antes de volver a pedir un punto que falló ----------
   Un fallo se cachea corto (antes: 10 minutos) para no repetir el gasto 15 veces
   en la misma tarde si fue un problema puntual de red.

   El problema es otro: hay rutas que fallan SIEMPRE, y no por la red. AIR_DESTINATIONS
   tenía `fernando: 'NVT'`, que es el aeropuerto de Navegantes (Santa Catarina), a
   2.900 km de la isla; el código de Fernando de Noronha es FEN. Con un código que
   no existe, SerpAPI devuelve vacío y SIN error, así que la ruta entra en el
   "falló" cada 10 minutos, para siempre. Son 6 créditos por hora, 4.320 al mes,
   quemados en una sola ruta rota que nadie está mirando. Ya está arreglado.

   Un TTL fijo no resuelve las dos cosas: corto castiga el blip de red, largo
   esconde un error de configuración. Por eso el TTL de fallo CRECE con la
   cantidad de fallos seguidos de la misma clave. El primer fallo se tolera
   (10 min, red); el tercero ya no parece un blip y espera horas. Un blip
   real vuelve a funcionar en 10 minutos; una ruta rota deja de costar en
   cuestion de horas y, sobre todo, queda registrada acá para que se vea. */
const fallosConsecutivos = new Map();
const MAX_FALLOS = 50;

function negativeTtlMs(baseMs) {
  const n = Number(process.env.SERPAPI_NEG_TTL_MIN) || 10;
  const tope = Number(process.env.SERPAPI_NEG_TTL_MAX_MIN) || 720;   // 12 horas
  const factor = Math.min(Math.pow(4, n), tope / Math.max(1, n));
  return Math.min(baseMs, Math.max(n, factor) * 60000);
}

function noteFailure(key) {
  const n = (fallosConsecutivos.get(key) || 0) + 1;
  fallosConsecutivos.set(key, n);
  if (fallosConsecutivos.size > MAX_FALLOS) {
    // Un Map sin techo acá sería una fuga de memoria lenta en un server de larga
    // vida. Se cae lo más viejo, que además es lo más probable que ya se arregló.
    fallosConsecutivos.delete(fallosConsecutivos.keys().next().value);
  }
  // A partir del tercer fallo seguido la ruta se avisa una vez por escalón. Un
  // warning por cada intento fillingía el log de SerpAPI que ya gastamos; esto
  // es para que un error de configuración se note y se arregle.
  if (n === 3 || n === 8) {
    console.warn('[serpapi] ' + key + ' lleva ' + n + ' fallos seguidos. Si es una ruta, el problema es el código de aeropuerto, no la red.');
  }
  return n;
}

function noteSuccess(key) { fallosConsecutivos.delete(key); }

// Prepara las claves contra la base antes de repartir el trabajo. Devuelve
// siempre, y un rechazo nunca tapa el resultado: si la base no está, se sigue
// con SerpAPI como si esta capa no existiera.
function warm(keys) {
  if (!cacheDb.enabled()) return Promise.resolve(0);
  return cacheDb.prefetch(cache, keys).catch(function () { return 0; });
}

// El `found` decide si el TTL es largo o corto, pero hay un piso: cuando el
// grafico se dibuja en automatico, un TTL corto obliga a los 15 puntos a volver
// a salir en cada busqueda aunque la respuesta anterior fuera correcta.
function evict() {
  while (cache.size > maxEntries()) cache.delete(cache.keys().next().value);
}

/**
 * Tarifa real de 1 pasajero para una fecha, con cache e inflight.
 * @returns {Promise<object|null>} null si falla o no hay configuracion
 */
async function flightQuote(origin, destination, dep, ret, style) {
  const travelClass = vuelos.travelClassFor(style);
  // Con el mock no hay nada que cachear: la respuesta es local, gratis y ya
  // sale igual para la misma clave. Pasarla por el cache solo agregaria una
  // escritura al disco por cada tarifa.
  if (mock.isEnabled()) {
    return mock.getFlightQuote({ origin, destination, dep, ret, style: travelClass });
  }
  const key = quoteKey(origin, destination, dep, ret, travelClass);
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  if (Date.now() < cooldownUntil) return null;
  if (inflight.has(key)) return inflight.get(key);
  if (!gastar()) return null;   // tope diario: el modelo estima el pasaje

  const p = vuelos.getFlightQuote({
    origin: origin, destination: destination, dep: dep, ret: ret, style: style
  }).then(function (q) {
    evict();
    const expiresAt = Date.now() + (q ? (noteSuccess(key), ttlMs(true)) : negativeTtlMs(ttlMs(false)));
    cache.set(key, { at: Date.now(), expiresAt: expiresAt, value: q });
    scheduleSave();
    // A la base solo lo que se encontró. Un fallo no se persiste: el TTL corto
    // del Map alcanza para no repetir el gasto dentro de la misma tarde, y
    // guardar un null en la base lo convertiría en un miss con TTL largo.
    if (q) cacheDb.store([{ key: key, value: q, expiresAt: expiresAt }]);
    return q;
  }).catch(function (e) {
    console.error('[serpapi]', origin + '->' + destination, dep, e.message);
    // 429 incluye "se acabaron los busquedas del mes": en ese caso no tiene
    // sentido reintentar en 30 segundos, pero frenar igual evita el martilleo
    // mientras los creditos se reponen.
    if (e.status === 429 || e.quotaExhausted) cooldownUntil = Date.now() + 60000;
    return null;   // si falla, el modelo estima el pasaje
  }).finally(function () { inflight.delete(key); });

  inflight.set(key, p);
  return p;
}

/**
 * Devuelve { avion_mvd?, avion_ba? } con el precio real por persona (o null).
 * @param {object} destCfg  entrada de DEST (con iata y modes)
 */
async function getQuotes(destCfg, dep, ret, style) {
  const out = {};
  if (!isLive()) return out;
  const travelClass = vuelos.travelClassFor(style);
  // Una sola consulta a la base para las dos tarifas (MVD y BUE) en vez de una
  // cada una. Son 2 créditos, pero es el request que abre cada cotización y el
  // que más se repite: es el que más fácil es cachear y el que peor sale si se
  // paga dos veces.
  await warm([
    destCfg.modes.avion_mvd ? quoteKey('MVD', destCfg.iata, dep, ret, travelClass) : null,
    destCfg.modes.avion_ba ? quoteKey('BUE', destCfg.iata, dep, ret, travelClass) : null
  ].filter(Boolean));

  const jobs = [];
  if (destCfg.modes.avion_mvd) jobs.push(flightQuote('MVD', destCfg.iata, dep, ret, style).then(function (q) { out.avion_mvd = q; }));
  if (destCfg.modes.avion_ba) jobs.push(flightQuote('BUE', destCfg.iata, dep, ret, style).then(function (q) { out.avion_ba = q; }));
  await Promise.all(jobs);
  return out;
}

/*
 * Precios reales para las fechas vecinas del grafico "mismo viaje, otra fecha".
 *
 * Recibe la lista de puntos ya calculada por el modelo (que sabe quantas noches
 * son y que fechas son validas) y devuelve, para cada punto, el precio real del
 * pasaje. Los puntos van en paralelo y cada uno cae por su cuenta: uno que
 * falla o agota el tiempo sale con `precio: null` y el grafico lo muestra
 * vacio en vez de romper la pagina entera.
 *
 * El `pp` que devuelve SerpAPI es por pasajero, que es justo lo que recalcula
 * `seriesFor()` del modelo.
 *
 * @param {Array<{dep:string, ret:string, shift:number}>} points
 */
async function getCalendar(origin, destination, points, style, passengers) {
  const out = { puntos: [], real: 0, estimados: 0, quotaExhausted: false };
  if (!isLive()) return out;
  const pax = Math.max(1, Number(passengers) || 1);
  const list = Array.isArray(points) ? points : [];

  // ESTE es el ahorro grande, y está acá y no adentro de calendarPoint() a
  // propósito. Cada punto se resuelve por su cuenta, así que leer la base desde
  // calendarPoint() serían 15 requests HTTP por serie: peor que los 15 créditos
  // que se intentan ahorrar. Con un prefetch previo es UNA consulta para las 15
  // claves, y después el Promise.all de abajo las encuentra todas en el Map.
  //
  // Por qué funciona: model.seriesDates() arma la serie de -7 a +7 días con las
  // MISMAS noches. Dos personas que buscan la misma ruta y la misma cantidad de
  // noches con un día de diferencia solapan 14 de 15 puntos. O sea que la
  // segunda persona que llega a esa ruta no paga la serie, casi entera.
  const travelClass = vuelos.travelClassFor(style);
  await warm(list.map(function (point) {
    return calendarKey(origin, destination, point.dep, point.ret, pax, travelClass);
  }));

  const results = await Promise.all(list.map(function (point) {
    return calendarPoint(origin, destination, point, style, pax).then(function (value) {
      return { shift: point.shift, dep: point.dep, value: value };
    }).catch(function (e) {
      if (e && (e.status === 429 || e.quotaExhausted)) out.quotaExhausted = true;
      return { shift: point.shift, dep: point.dep, value: null };
    });
  }));

  results.forEach(function (row) {
    if (row.value && row.value.pp > 0) {
      out.real += 1;
      out.puntos.push({
        shift: row.shift, dep: row.dep, pp: row.value.pp,
        real: true, exact: !!row.value.exact,
        airline: row.value.airline || null, priceLevel: row.value.priceLevel || null
      });
    } else {
      out.estimados += 1;
      out.puntos.push({ shift: row.shift, dep: row.dep, pp: null, real: false });
    }
  });
  return out;
}

function calendarPoint(origin, destination, point, style, pax) {
  if (mock.isEnabled()) {
    return Promise.resolve(mock.priceForDate({
      origin, destination, dep: point.dep, ret: point.ret,
      passengers: pax, travelClass: vuelos.travelClassFor(style)
    }));
  }
  const key = calendarKey(origin, destination, point.dep, point.ret, pax, vuelos.travelClassFor(style));
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.value);
  if (Date.now() < cooldownUntil) return Promise.resolve(null);
  if (inflight.has(key)) return inflight.get(key);
  // Un fallo de gasto no se cachea: cuando se habilite el calendario o cambie el
  // dia, el punto tiene que poder pedirse.
  if (!calendarioEnVivo() || !gastar()) return Promise.resolve(null);

  const p = vuelos.priceForDate({
    origin: origin, destination: destination, dep: point.dep, ret: point.ret,
    passengers: pax, style: style
  }).then(function (value) {
    evict();
    // Un punto fallido tambien se cachea, pero corto: si fue un problema
    // puntual de red no querimos repetir el gasto 15 veces en la misma tarde.
    // El TTL CRECE si la MISMA clave sigue fallando (ver negativeTtlMs): eso es
    // lo que distingue un blip de red de una ruta rota, que en el segundo caso
    // no debe volver a costar un credito cada 10 minutos para siempre.
    const ttl = value ? (noteSuccess(key), calendarTtlMs()) : negativeTtlMs(calendarTtlMs());
    const expiresAt = Date.now() + ttl;
    cache.set(key, { at: Date.now(), expiresAt: expiresAt, value: value });
    scheduleSave();
    // A la base solo lo que se encontró, por el mismo motivo que en
    // flightQuote(): un null en la base es un miss caro y de larga duración.
    if (value) cacheDb.store([{ key: key, value: value, expiresAt: expiresAt }]);
    return value;
  }).catch(function (e) {
    console.error('[serpapi-calendario]', origin + '->' + destination, point.dep, e.message);
    if (e.status === 429 || e.quotaExhausted) cooldownUntil = Date.now() + 60000;
    return null;
  }).finally(function () { inflight.delete(key); });

  inflight.set(key, p);
  return p;
}

function googleFlightsUrl(input) { return mock.isEnabled() ? mock.googleFlightsUrl(input) : vuelos.googleFlightsUrl(input); }

/*
 * Vuelos para el browse, en una sola búsqueda. El precio que devuelve ya es el
 * total de ida y vuelta, así que no hace falta una segunda etapa para conocerlo
 * (ver la nota en vuelos.searchOutbound: se verificó contra la API real).
 *
 * La cache es la misma del calendario: mismo TTL largo, porque el crédito es el
 * recurso caro y un browse repetido por la misma ruta no debería volver a pagar.
 */
async function searchOffers(input) {
  if (!isLive()) return { offers: [] };
  if (mock.isEnabled()) {
    return mock.searchOffers({
      origin: input.origin, destination: input.destination,
      departureDate: input.departureDate, returnDate: input.returnDate,
      passengers: input.passengers, travelClass: vuelos.travelClassFor(input.style)
    });
  }
  const key = ['o', input.origin, input.destination, input.departureDate, input.returnDate || '', input.passengers, vuelos.travelClassFor(input.style)].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  if (Date.now() < cooldownUntil) return { offers: [] };
  if (inflight.has(key)) return inflight.get(key);
  if (!gastar()) return { offers: [] };   // el server ve enPausa() y avisa "saturada"

  const p = vuelos.searchOutbound({
    origin: input.origin, destination: input.destination,
    departureDate: input.departureDate, returnDate: input.returnDate,
    passengers: input.passengers, travelClass: vuelos.travelClassFor(input.style)
  }).then(function (value) {
    evict();
    cache.set(key, { at: Date.now(), expiresAt: Date.now() + calendarTtlMs(), value: value });
    scheduleSave();
    return value;
  }).catch(function (e) {
    console.error('[serpapi-browse]', input.origin + '->' + input.destination, input.departureDate, e.message);
    if (e.status === 429 || e.quotaExhausted) cooldownUntil = Date.now() + 60000;
    throw e;
  }).finally(function () { inflight.delete(key); });

  inflight.set(key, p);
  return p;
}

// Un vistazo al cache sin gastar un solo credito. Sirve para responder
// "esto ya estaba?" antes de pedir algo yPagarlo dos veces.
function stats() {
  const ahora = Date.now();
  let vigentes = 0, vencidas = 0, proxima = null;
  cache.forEach(function (v) {
    if (v && v.expiresAt > ahora) {
      vigentes++;
      if (!proxima || v.expiresAt < proxima) proxima = v.expiresAt;
    } else vencidas++;
  });
  return {
    entradas: cache.size, vigentes: vigentes, vencidas: vencidas,
    ttlMinutos: Number(process.env.QUOTE_TTL_MIN) || 180,
    ttlCalendarioHoras: Number(process.env.SERPAPI_CALENDAR_TTL_H) || 24,
    archivo: CACHE_FILE,
    expiraLaMasViejaEnMin: proxima ? Math.round((proxima - ahora) / 60000) : null
  };
}

module.exports = {
  isLive, providerName, getQuote: flightQuote, getQuotes, getCalendar,
  searchOffers, googleFlightsUrl, setFetch, clearCache, stats, enPausa
};
