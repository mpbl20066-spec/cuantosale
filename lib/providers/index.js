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
const { envVuelos } = require('./config-vuelos');
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
// VUELOS_CACHE_FILE cambia el archivo: lo usan las pruebas para no leer ni vaciar el cache de la maquina.
const CACHE_FILE = process.env.VUELOS_CACHE_FILE || path.join(__dirname, '..', '..', '.serpapi-cache.json');
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
    if (vivos) console.log('[vuelos] cache en disco: ' + vivos + ' entradas vigentes');
  } catch (e) {
    if (e && e.code !== 'ENOENT') {
      console.warn('[vuelos] no se pudo leer el cache en disco: ' + e.message);
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
      console.warn('[vuelos] no se pudo guardar el cache: ' + e.message);
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
  const n = Number(envVuelos('DAILY_MAX'));
  return n >= 0 && envVuelos('DAILY_MAX') !== undefined && envVuelos('DAILY_MAX') !== '' ? n : 15;
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
function calendarioEnVivo() { return envVuelos('CALENDAR_LIVE') === '1'; }

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

// Cuanto se reusa un precio de Ignav (lista de vuelos y puntos del calendario) antes de volver a pedirlo:
// 48 h (IGNAV_CALENDAR_TTL_H). Cada pedido gasta una busqueda, y el precio de un vuelo a una fecha fija no se mueve
// de un dia para el otro. Excepcion: si la salida es hoy o manana (IGNAV_TTL_CERCA_DIAS) el precio cambia rapido y
// se renueva cada 3 h (IGNAV_TTL_CERCA_H).
function calendarTtlMs(dep) {
  const hours = Number(envVuelos('CALENDAR_TTL_H')) || 48;
  const cercaDias = Number(envVuelos('TTL_CERCA_DIAS')) || 1;
  const cercaHoras = Number(envVuelos('TTL_CERCA_H')) || 3;
  const salida = Date.parse(String(dep || '') + 'T00:00:00Z');
  if (Number.isFinite(salida) && (salida - Date.now()) / 864e5 <= cercaDias) return Math.min(hours, cercaHoras) * 3600e3;
  return hours * 3600e3;
}

function maxEntries() { return Number(envVuelos('CACHE_MAX')) || 2000; }

/* ---------- clave de cache ----------
   La clave la arman DOS lugares: el que busca (para ver si ya la tengo) y el
   prefetch (para traerla de la base de antemano). Si esos dos construyeran la
   clave por su cuenta, cualquier diferencia de un carácter las desincroniza y
   el prefetch no serviría para nada, sin ningún error visible: simplemente nunca
   habría aciertos. Por eso la clave vive acá y en un solo lado. */
function quoteKey(origin, destination, dep, ret, travelClass) {
  return ['q', origin, destination, dep, ret, travelClass].join('|');
}
/* Sin la cantidad de personas: el punto del calendario guarda el precio POR PERSONA (pp), que sirve igual para 1, 2 o 4
   viajeros. Asi dos busquedas de la misma ruta y fechas con distinta gente reusan el mismo precio. */
function calendarKey(origin, destination, dep, ret, pax, travelClass) {
  return ['c2', origin, destination, dep, ret, travelClass].join('|');
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
  const n = Number(envVuelos('NEG_TTL_MIN')) || 10;
  const tope = Number(envVuelos('NEG_TTL_MAX_MIN')) || 720;   // 12 horas
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
    console.warn('[vuelos] ' + key + ' lleva ' + n + ' fallos seguidos. Si es una ruta, el problema es el código de aeropuerto, no la red.');
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
  if (hit && Date.now() < hit.expiresAt) return hit.value && hit.value.pp != null && !ppValido(hit.value.pp) ? null : hit.value;
  if (Date.now() < cooldownUntil) return null;
  if (inflight.has(key)) return inflight.get(key);
  if (vuelos.fueraDeRango(dep, ret)) return null;   // fecha fuera de rango: el modelo estima
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
    console.error('[vuelos]', origin + '->' + destination, dep, e.message);
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
  // Por qué funciona: model.seriesDates() arma la serie de -5 a +5 días con las
  // MISMAS noches. Dos personas que buscan la misma ruta y la misma cantidad de
  // noches con un día de diferencia solapan 14 de 15 puntos. O sea que la
  // segunda persona que llega a esa ruta no paga la serie, casi entera.
  const travelClass = vuelos.travelClassFor(style);
  await warm(list.map(function (point) {
    return calendarKey(origin, destination, point.dep, point.ret, pax, travelClass);
  }));

  // Tope de espera (IGNAV_CALENDAR_WAIT_MS, 16 s): cada punto es una busqueda aparte y el grafico esperaba al mas lento
  // (hasta 40 s con el timeout de Ignav). Los que no llegan a tiempo salen sin precio, pero su pedido sigue y
  // calendarPoint() los guarda en la cache: la proxima consulta de esa ruta ya los tiene.
  // Con 8 s no entraba nada nuevo: la cola de Ignav deja 6 a la vez y cada busqueda tarda ~7 s, asi que los 11 puntos
  // son dos tandas (~14 s). Medido el 13/10 en FLN: 0 de 11 con precio la primera vez, el grafico quedaba vacio.
  const espera = Number(envVuelos('CALENDAR_WAIT_MS')) || 16000;
  const results = await Promise.all(list.map(function (point) {
    let tope;
    const vencido = new Promise(function (resolve) { tope = setTimeout(resolve, espera, null); });
    return Promise.race([calendarPoint(origin, destination, point, style, pax), vencido]).finally(function () { clearTimeout(tope); }).then(function (value) {
      return { shift: point.shift, dep: point.dep, value: value };
    }).catch(function (e) {
      if (e && (e.status === 429 || e.quotaExhausted)) out.quotaExhausted = true;
      return { shift: point.shift, dep: point.dep, value: null };
    });
  }));

  results.forEach(function (row) {
    if (row.value && ppValido(row.value.pp)) {
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
  if (vuelos.fueraDeRango(point.dep, point.ret)) return Promise.resolve(null);   // sin pedido ni cupo gastado
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
    const ttl = value ? (noteSuccess(key), calendarTtlMs(point.dep)) : negativeTtlMs(calendarTtlMs(point.dep));
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

/*
 * Precalentado: pide por adelantado las tarifas de las rutas mas buscadas para que
 * la primera persona del dia no espere los ~12-45 s de Ignav. Guarda por el mismo
 * camino que una busqueda normal (flightQuote), asi que queda en Supabase y lo ve
 * cualquier instancia. `rutas` = [{ origin, destination, dep, ret }]. Se corre de
 * a una con pausa corta: respeta el tope diario y la cola de Ignav, y se detiene
 * si la API pide pausa. Devuelve cuantas se pidieron, cuantas ya estaban y cuantas fallaron.
 */
async function precalentar(rutas, style) {
  const out = { pedidas: 0, yaEstaban: 0, fallidas: 0, detenido: false };
  if (!isLive() || mock.isEnabled()) return out;
  const travelClass = vuelos.travelClassFor(style || 'eq');
  await warm((rutas || []).map(function (r) { return quoteKey(r.origin, r.destination, r.dep, r.ret, travelClass); }));
  if (enPausa()) { out.detenido = true; return out; }
  // En paralelo: la cola de Ignav (IGNAV_CONCURRENCY) ya limita cuantas van a la vez.
  await Promise.all((rutas || []).map(async function (r) {
    const hit = cache.get(quoteKey(r.origin, r.destination, r.dep, r.ret, travelClass));
    if (hit && Date.now() < hit.expiresAt && hit.value) { out.yaEstaban++; return; }
    const q = await flightQuote(r.origin, r.destination, r.dep, r.ret, style || 'eq');
    if (q) out.pedidas++; else out.fallidas++;
  }));
  return out;
}

/* ---------- precio de referencia por mes (guias y "mes mas barato") ----------
   La guia elige el mes mas barato de los proximos 11 y muestra "Desde". Con solo la tabla del modelo, el mes y el
   precio podian no tener nada que ver con lo que la app encontraba al abrir el viaje. Ignav no busca por mes (cada
   fecha es una busqueda), asi que de cada mes se prueban todos los martes y miercoles (7 noches; ver rutasGuias en
   server.js) y gana la salida mas barata (mejorDelMes). Con una sola fecha fija (el 15) Rio daba US$ 338 en
   noviembre porque caia en el feriado largo de Brasil, cuando otros dias del mes salia bastante menos.
   Cada fecha se guarda aparte con TTL largo: 14 dias si sale dentro de 90 (GUIAS_TTL_DIAS), 30 si es mas lejos
   (GUIAS_TTL_LEJOS_DIAS): un vuelo a 3-11 meses casi no se mueve en un mes, y con el TTL de 24 h de las cotizaciones
   comunes habria que volver a pagarlas todas cada dia. */
function monthKey(origin, destination, dep, ret, travelClass) {
  return ['m', origin, destination, dep, ret, travelClass].join('|');
}
/* Piso por persona, ida y vuelta (IGNAV_PP_MINIMO_USD, 60): ningun vuelo desde el Rio de la Plata a Brasil sale menos.
   Lo que esta por debajo es una tarifa rota de Ignav (ver itinerariesOf en ignav.js); se ignora tambien lo que ya
   quedo guardado en la cache con TTL de 14-30 dias. */
function ppValido(pp) { return Number(pp) >= (Number(envVuelos('PP_MINIMO_USD')) || 60); }
function guiasTtlMs(dep) {
  const lejos = dep && new Date(dep + 'T12:00:00').getTime() - Date.now() > 90 * 864e5;
  return (lejos ? Number(process.env.GUIAS_TTL_LEJOS_DIAS) || 30 : Number(process.env.GUIAS_TTL_DIAS) || 14) * 864e5;
}
/* Una fecha sin precio (Ignav no trajo vuelos o se colgo) queda marcada unos dias: antes no se guardaba nada y,
   como se piden primero las mas cercanas, las mismas 3 fallidas se volvian a pedir cada dia y se comian el cupo. */
const GUIAS_FALLO_MS = 3 * 864e5;

/* Pide las rutas que no tienen precio de referencia (o le queda menos de un dia), las mas cercanas primero, hasta
   `max` por llamada y sin arrancar ninguna despues de `hasta` (ms epoch): la funcion de Vercel corta a los 60 s y lo
   que ya termino queda guardado. El cron corre varias veces por dia y de a poco cubre todas. */
async function precalentarMeses(rutas, style, max, hasta) {
  const out = { pendientes: 0, pedidas: 0, fallidas: 0, detenido: false };
  if (!isLive() || mock.isEnabled()) return out;
  const travelClass = vuelos.travelClassFor(style || 'eq');
  const lista = rutas || [];
  await warm(lista.map(function (r) { return monthKey(r.origin, r.destination, r.dep, r.ret, travelClass); }));
  const limite = Date.now() + 864e5;
  const faltan = lista.filter(function (r) {
    const hit = cache.get(monthKey(r.origin, r.destination, r.dep, r.ret, travelClass));
    return !(hit && hit.expiresAt > limite && hit.value);
  }).sort(function (a, b) { return a.dep < b.dep ? -1 : a.dep > b.dep ? 1 : 0; });
  out.pendientes = faltan.length;
  faltan.length = Math.min(faltan.length, Math.max(0, max));
  if (enPausa()) { out.detenido = true; return out; }
  const guardar = async function (r, value, ttl) {
    const key = monthKey(r.origin, r.destination, r.dep, r.ret, travelClass);
    const entrada = { at: Date.now(), expiresAt: Date.now() + ttl, value: value };
    cache.set(key, entrada);
    scheduleSave();
    await cacheDb.store([{ key: key, value: value, expiresAt: entrada.expiresAt }]);
  };
  // Tantos a la vez como deja la cola de Ignav; cada uno toma la siguiente fecha mientras quede tiempo.
  let i = 0;
  const trabajador = async function () {
    while (i < faltan.length && !(hasta && Date.now() > hasta) && !enPausa()) {
      const r = faltan[i++];
      const q = await flightQuote(r.origin, r.destination, r.dep, r.ret, style || 'eq');
      if (q && ppValido(q.pp)) { await guardar(r, { pp: q.pp }, guiasTtlMs(r.dep)); out.pedidas++; } else if (!enPausa()) { await guardar(r, { pp: null, sinPrecio: true }, GUIAS_FALLO_MS); out.fallidas++; } else out.fallidas++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(faltan.length, Number(process.env.IGNAV_CONCURRENCY) || 6) }, trabajador));
  out.pendientes -= out.pedidas + out.fallidas;
  return out;
}

/* La salida mas barata del mes con precio real ya guardado, por pedido: `pedidos` = [{ origin, destination, fechas:
   [{ dep, ret }] }]. Devuelve { pp, dep, ret } o null en el mismo orden. Una sola lectura de la base para todos. */
async function mejorDelMes(pedidos, style) {
  const travelClass = vuelos.travelClassFor(style || 'eq');
  const lista = pedidos || [];
  await warm([].concat.apply([], lista.map(function (p) { return p.fechas.map(function (f) { return monthKey(p.origin, p.destination, f.dep, f.ret, travelClass); }); })));
  const ahora = Date.now();
  return lista.map(function (p) {
    return p.fechas.reduce(function (mejor, f) {
      const hit = cache.get(monthKey(p.origin, p.destination, f.dep, f.ret, travelClass));
      const pp = hit && hit.expiresAt > ahora && hit.value ? Number(hit.value.pp) : 0;
      return ppValido(pp) && (!mejor || pp < mejor.pp) ? { pp: pp, dep: f.dep, ret: f.ret } : mejor;
    }, null);
  });
}

/* Valores de referencia con TTL propio (por ejemplo, el factor de hotel de cada destino): misma cache en disco y en
   la base que los vuelos, pero con la clave y el TTL que elige quien los guarda. */
async function leerReferencias(keys) {
  await warm(keys || []);
  const ahora = Date.now();
  return (keys || []).map(function (k) { const hit = cache.get(k); return hit && hit.expiresAt > ahora ? hit.value : null; });
}
async function guardarReferencia(key, value, ttl) {
  const entrada = { at: Date.now(), expiresAt: Date.now() + ttl, value: value };
  cache.set(key, entrada);
  scheduleSave();
  await cacheDb.store([{ key: key, value: value, expiresAt: entrada.expiresAt }]);
}
/* Para el panel de /admin: por aeropuerto y mes, la salida mas barata con precio real vigente y cuantas de las
   fechas del mes ya se buscaron. `rutas` es la lista plana de rutasGuias(); se agrupa por aeropuerto + mes. */
async function coberturaMeses(rutas, style) {
  const travelClass = vuelos.travelClassFor(style || 'eq');
  const lista = rutas || [];
  const vals = await leerReferencias(lista.map(function (r) { return monthKey(r.origin, r.destination, r.dep, r.ret, travelClass); }));
  const celdas = new Map();
  lista.forEach(function (r, i) {
    const id = r.destination + '|' + r.dep.slice(0, 7);
    if (!celdas.has(id)) celdas.set(id, { destination: r.destination, dep: r.dep.slice(0, 7) + '-01', pp: null, mejor: null, fechas: 0, buscadas: 0 });
    const c = celdas.get(id), v = vals[i];
    c.fechas++;
    if (v) c.buscadas++;
    if (v && ppValido(v.pp) && (c.pp === null || v.pp < c.pp)) { c.pp = v.pp; c.mejor = r.dep; }
  });
  const detalle = Array.from(celdas.values());
  return {
    rutas: detalle.length, conPrecio: detalle.filter(function (c) { return c.pp !== null; }).length,
    fechas: lista.length, buscadas: vals.filter(Boolean).length, detalle: detalle
  };
}

/*
 * Precio real por persona que YA esta en la cache, sin gastar una busqueda. Lo usa la portada ("¿Con cuanta plata
 * contas?"): con el pasaje estimado del modelo decia "Llegas" a Arraial y al abrirlo el vuelo real de esas fechas era
 * US$ 70 mas caro por persona. Si alguien ya busco esa ruta y esas fechas, la portada usa ese precio.
 * Se mira, en orden: la lista de vuelos de la pantalla de vuelos con esa cantidad de personas (el mas barato, que es lo
 * que se ve al abrir), la tarifa de la propuesta y el punto del calendario. Una sola consulta a la base para todas.
 * `rutas` = [{ origin, destination, dep, ret, pax }]; devuelve un pp (USD) o null por ruta, en el mismo orden.
 */
async function preciosEnCache(rutas, style) {
  const lista = rutas || [];
  if (!vuelos.isConfigured() || mock.isEnabled()) return lista.map(function () { return null; });
  const travelClass = vuelos.travelClassFor(style);
  const clavesDe = function (r) {
    return [
      ['o', r.origin, r.destination, r.dep, r.ret, r.pax, travelClass].join('|'),
      quoteKey(r.origin, r.destination, r.dep, r.ret, travelClass),
      calendarKey(r.origin, r.destination, r.dep, r.ret, r.pax, travelClass),
      monthKey(r.origin, r.destination, r.dep, r.ret, travelClass)
    ];
  };
  await warm([].concat.apply([], lista.map(clavesDe)));
  const ahora = Date.now();
  return lista.map(function (r) {
    const claves = clavesDe(r);
    for (let i = 0; i < claves.length; i++) {
      const hit = cache.get(claves[i]);
      if (!hit || ahora >= hit.expiresAt || !hit.value) continue;
      if (i === 0) {
        const totales = (hit.value.offers || []).map(function (o) { return Number(o.price_usd); }).filter(function (n) { return ppValido(n / Math.max(1, r.pax)); });
        if (totales.length) return Math.round(Math.min.apply(null, totales) / Math.max(1, r.pax) * 100) / 100;
      } else if (ppValido(hit.value.pp)) return Number(hit.value.pp);
    }
    return null;
  });
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
  if (!cache.get(key)) await warm([key]);   // la busqueda puede estar guardada en la base por otra visita
  const hit = cache.get(key);
  /* consultado: cuando se le pregunto a Ignav de verdad (la lista puede venir de la cache de hasta 48 h). La web lo
     muestra en cada vuelo. Las entradas viejas no lo traen: se usa `at` si esta. */
  if (hit && Date.now() < hit.expiresAt) {
    const v = hit.value && Array.isArray(hit.value.offers) ? Object.assign({}, hit.value, { offers: hit.value.offers.filter(function (o) { return ppValido(Number(o.price_usd) / Math.max(1, Number(input.passengers) || 1)); }) }) : hit.value;
    return v && !v.consultado && hit.at ? Object.assign({}, v, { consultado: new Date(hit.at).toISOString() }) : v;
  }
  if (Date.now() < cooldownUntil) return { offers: [] };
  if (inflight.has(key)) return inflight.get(key);
  if (vuelos.fueraDeRango(input.departureDate, input.returnDate)) return { offers: [] };
  if (!gastar()) return { offers: [] };   // el server ve enPausa() y avisa "saturada"

  const p = vuelos.searchOutbound({
    origin: input.origin, destination: input.destination,
    departureDate: input.departureDate, returnDate: input.returnDate,
    passengers: input.passengers, travelClass: vuelos.travelClassFor(input.style)
  }).then(function (value) {
    evict();
    if (value && typeof value === 'object') value.consultado = new Date().toISOString();
    // Una lista vacia no se guarda 48 h: Ignav a veces cachea de su lado una
    // respuesta vacia causada por una demora puntual, y repetirla dos dias deja
    // sin vuelos a quien busca esas fechas. Con el TTL corto se vuelve a preguntar.
    const vacia = !value || !Array.isArray(value.offers) || !value.offers.length;
    const expiresAt = Date.now() + (vacia ? negativeTtlMs(calendarTtlMs(input.departureDate)) : calendarTtlMs(input.departureDate));
    cache.set(key, { at: Date.now(), expiresAt: expiresAt, value: value });
    scheduleSave();
    if (!vacia) cacheDb.store([{ key: key, value: value, expiresAt: expiresAt }]);   // compartida entre visitas e instancias
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
    ttlCalendarioHoras: Number(envVuelos('CALENDAR_TTL_H')) || 24,
    // Para diagnosticar en produccion sin ver los logs: cuanto se gasto hoy en esta
    // instancia, el tope vigente, si hay una pausa por 429 y que proveedor esta activo.
    proveedor: vuelos.nombre(),
    gastoHoy: gastoDia === hoyUtc() ? gastoN : 0,
    topeDiario: topeDiario(),
    calendarioEnVivo: calendarioEnVivo(),
    pausaSegundos: Math.max(0, Math.round((cooldownUntil - ahora) / 1000)),
    archivo: CACHE_FILE,
    expiraLaMasViejaEnMin: proxima ? Math.round((proxima - ahora) / 60000) : null
  };
}

module.exports = {
  isLive, providerName, getQuote: flightQuote, getQuotes, getCalendar,
  searchOffers, precalentar, precalentarMeses, mejorDelMes, coberturaMeses,leerReferencias, guardarReferencia, preciosEnCache, googleFlightsUrl, setFetch, clearCache, stats, enPausa
};
