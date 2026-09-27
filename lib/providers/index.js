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
const serpapi = require('./serpapi');
const mock = require('./mock');

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

function isLive() { return serpapi.isConfigured() || mock.isEnabled(); }
// Que proveedor esta activo, para que el server lo pueda reportar y un test
// pueda distinguir una oferta real de una de prueba. Es lo que permite, por
// ejemplo, no pedirle a un mock que se comporte como un vuelo real.
function providerName() { return mock.isEnabled() && !serpapi.isConfigured() ? 'mock' : 'serpapi'; }
// El fetch inyectable se pasa al provider: es el provider quien hace las
// llamadas HTTP, y un mock que se quede en el agregador no mockearia nada.
function setFetch(f) { serpapi.setFetch(f); }
function clearCache() { cache.clear(); inflight.clear(); cooldownUntil = 0; saveCache(); }

function ttlMs(found) {
  // 3 horas por defecto. El precio de un vuelo no cambia en tres horas, y el
  // credito de SerpAPI es el recurso scarce: con una hora, cualquiera que
  // vuelve a la pagina a la tarde vuelve a pagar la serie completa.
  // Configurable con QUOTE_TTL_MIN.
  const min = Number(process.env.QUOTE_TTL_MIN) || 180;
  return (found ? min : Math.min(10, min)) * 60000;
}

// El TTL del calendario es mucho mas largo que el de la tarifa principal. Un
// precio de vuelo no cambia de un dia a otro, y el credit es el recurso scarce:
// guardar un punto 24h evita volver a pagarlo en cada visita.
function calendarTtlMs() {
  const hours = Number(process.env.SERPAPI_CALENDAR_TTL_H) || 24;
  return hours * 60 * 60 * 1000;
}

function maxEntries() { return Number(process.env.SERPAPI_CACHE_MAX) || 2000; }

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
  const travelClass = serpapi.travelClassFor(style);
  // Con el mock no hay nada que cachear: la respuesta es local, gratis y ya
  // sale igual para la misma clave. Pasarla por el cache solo agregaria una
  // escritura al disco por cada tarifa.
  if (mock.isEnabled()) {
    return mock.getFlightQuote({ origin, destination, dep, ret, style: travelClass });
  }
  const key = ['q', origin, destination, dep, ret, travelClass].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  if (Date.now() < cooldownUntil) return null;
  if (inflight.has(key)) return inflight.get(key);

  const p = serpapi.getFlightQuote({
    origin: origin, destination: destination, dep: dep, ret: ret, style: style
  }).then(function (q) {
    evict();
    cache.set(key, { at: Date.now(), expiresAt: Date.now() + ttlMs(!!q), value: q });
    scheduleSave();
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
      passengers: pax, travelClass: serpapi.travelClassFor(style)
    }));
  }
  const key = ['c', origin, destination, point.dep, point.ret, pax, serpapi.travelClassFor(style)].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.value);
  if (Date.now() < cooldownUntil) return Promise.resolve(null);
  if (inflight.has(key)) return inflight.get(key);

  const p = serpapi.priceForDate({
    origin: origin, destination: destination, dep: point.dep, ret: point.ret,
    passengers: pax, style: style
  }).then(function (value) {
    evict();
    // Un punto fallido tambien se cachea, pero corto: si fue un problema
    // puntual de red no querimos repetir el gasto 15 veces en la misma tarde.
    const ttl = value ? calendarTtlMs() : Math.min(calendarTtlMs(), 10 * 60000);
    cache.set(key, { at: Date.now(), expiresAt: Date.now() + ttl, value: value });
    scheduleSave();
    return value;
  }).catch(function (e) {
    console.error('[serpapi-calendario]', origin + '->' + destination, point.dep, e.message);
    if (e.status === 429 || e.quotaExhausted) cooldownUntil = Date.now() + 60000;
    return null;
  }).finally(function () { inflight.delete(key); });

  inflight.set(key, p);
  return p;
}

function googleFlightsUrl(input) { return mock.isEnabled() ? mock.googleFlightsUrl(input) : serpapi.googleFlightsUrl(input); }

/*
 * Vuelos para el browse, en una sola búsqueda. El precio que devuelve ya es el
 * total de ida y vuelta, así que no hace falta una segunda etapa para conocerlo
 * (ver la nota en serpapi.searchOutbound: se verificó contra la API real).
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
      passengers: input.passengers, travelClass: serpapi.travelClassFor(input.style)
    });
  }
  const key = ['o', input.origin, input.destination, input.departureDate, input.returnDate || '', input.passengers, serpapi.travelClassFor(input.style)].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  if (Date.now() < cooldownUntil) return { offers: [] };
  if (inflight.has(key)) return inflight.get(key);

  const p = serpapi.searchOutbound({
    origin: input.origin, destination: input.destination,
    departureDate: input.departureDate, returnDate: input.returnDate,
    passengers: input.passengers, travelClass: serpapi.travelClassFor(input.style)
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
  searchOffers, googleFlightsUrl, setFetch, clearCache, stats
};
