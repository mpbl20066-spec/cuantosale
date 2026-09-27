'use strict';

// Vuelos reales vía SerpAPI (motor `google_flights`).
//
// A diferencia de Duffel, SerpAPI no es un GDS: no emite boletos ni cobra. Es un
// buscador que devuelve los mismos precios que muestra Google Flights, más un
// link para terminar la reserva afuera. Para "cuánto cuesta realmente" eso
// alcanza; para vender, no.
//
// Contexto importante: esta API se eligió porque funciona desde Uruguay. Las
// APIs de venta (Duffel, Amadeus Self-Service, Sabre) piden aprobación y tienen
// restricciones por mercado, y para este proyecto eso era un bloqueo.

const API = 'https://serpapi.com/search.json';
const ENGINE = 'google_flights';
const TIMEOUT_MS = 25000;

let fetchImpl = null;

function apiKey() {
  return String(process.env.SERPAPI_API_KEY || '').trim();
}

function isConfigured() { return !!apiKey(); }
function setFetch(fn) { fetchImpl = fn; }

// El motor de Google Flights no entiende los nombres de cabina que usa la app
// (`ahorro` / `eq` / `comodo`). Se traduce al número que espera la API:
// 1 = Economy, 2 = Premium economy, 3 = Business, 4 = First.
function travelClassFor(style) {
  if (style === 'comodo') return Number(process.env.SERPAPI_CABIN_COMODO) || 2;
  if (style === 'business') return Number(process.env.SERPAPI_CABIN_COMODO) || 3;
  return 1;
}

// Un vuelo de ida y vuelta son DOS búsquedas: la primera devuelve el tramo de
// ida y un `departure_token`, y hace falta una segunda llamada con ese token
// para conocer el precio de vuelta. Para el gráfico de fechas eso duplicaría
// el gasto, así que este provider expone además `priceForDates()`, que se
// queda con el precio de ida y con `price_insights` y resuelve los 15 puntos
// con una sola búsqueda por fecha.
function buildQuery(input) {
  const query = new URLSearchParams({
    engine: ENGINE,
    api_key: apiKey(),
    type: input.returnDate ? '1' : '2',
    departure_id: String(input.origin || '').toUpperCase(),
    arrival_id: String(input.destination || '').toUpperCase(),
    adults: String(Math.max(1, Number(input.passengers) || 1)),
    // El modelo entero de la app trabaja en USD. Si se deja la moneda por
    // defecto SerpAPI devuelve USD, pero el dia que cambie el default los
    // precios del grafico mezclarian monedas sin que nada se note.
    currency: 'USD',
    gl: process.env.SERPAPI_GL || 'uy',
    hl: process.env.SERPAPI_HL || 'es'
  });
  if (input.returnDate) {
    query.set('outbound_date', input.departureDate);
    query.set('return_date', input.returnDate);
  } else {
    query.set('outbound_date', input.departureDate);
  }
  query.set('travel_class', String(input.travelClass || 1));
  // `sort_by=1` (Top flights) trae menos respuestas que `2` (Price) y para el
  // grafico solo hace falta el mas barato, asi que no cambia nada util.
  query.set('sort_by', String(process.env.SERPAPI_SORT || 1));
  return query;
}

async function request(input) {
  const key = apiKey();
  if (!key) {
    const error = new Error('Falta configurar SERPAPI_API_KEY en las variables de entorno del servidor.');
    error.status = 503;
    throw error;
  }
  const query = buildQuery(input);
  if (input.jsonRestrictor) query.set('json_restrictor', input.jsonRestrictor);

  const fetcher = fetchImpl || fetch;
  const options = { method: 'GET', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } };

  let response;
  try {
    response = await fetcher(API + '?' + query.toString(), options);
  } catch (cause) {
    const timeout = cause && (cause.name === 'AbortError' || cause.name === 'TimeoutError');
    const error = new Error(timeout
      ? 'La búsqueda de vuelos demoró demasiado. Probá de nuevo.'
      : 'No se pudo conectar con el buscador de vuelos. Probá de nuevo en unos minutos.');
    error.status = timeout ? 504 : 502;
    throw error;
  }

  let payload;
  try { payload = await response.json(); } catch (e) {
    const error = new Error('El buscador de vuelos devolvió una respuesta JSON inválida.');
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    // SerpAPI responde 200 con `error` adentro cuando se acabaron los créditos
    // del mes, así que el status solo no alcanza para detectarlo.
    const detail = payload && (payload.error || payload.message);
    const error = new Error('Buscador de vuelos (HTTP ' + response.status + '): ' + String(detail || 'No se pudo consultar disponibilidad.').slice(0, 240));
    error.status = response.status === 429 ? 429 : 502;
    error.quotaExhausted = /quota|limit|exceed|searches/i.test(String(detail || ''));
    throw error;
  }
  if (payload && payload.error) {
    // Sin crédito o sin key SerpAPI devuelve 200 con error adentro: sin esto la
    // app caería a "estimado" en silencio y nadie entendería por qué.
    throw errorFromPayload(payload);
  }
  return payload || {};
}

function flightList(payload) {
  return [].concat(
    Array.isArray(payload.best_flights) ? payload.best_flights : [],
    Array.isArray(payload.other_flights) ? payload.other_flights : []
  );
}

function airlineOf(item) {
  if (!item) return null;
  if (item.airline) return String(item.airline);
  const segments = Array.isArray(item.flights) ? item.flights : [];
  const names = [];
  segments.forEach(function (segment) {
    const name = segment && segment.airline;
    if (name && names.indexOf(name) < 0) names.push(name);
  });
  return names.join(' · ') || null;
}

function stopsOf(item) {
  if (!item) return null;
  if (Number.isFinite(item.layovers)) return item.layovers;
  const layovers = Array.isArray(item.layovers) ? item.layovers : [];
  return layovers.length;
}

function round2(value) { return Math.round(Number(value) * 100) / 100; }

/*
 * Precio de un punto del calendario. Devuelve el minimo entre el vuelo mas
 * barato y `price_insights.lowest_price`, que es lo que Google usa para el
 * grafico de "otras fechas".
 *
 * `exact` en false significa: el precio viene del panel de insights y no de un
 * itinerario concreto, asi que no se puede garantizar que exista ese vuelo.
 * La app lo muestra igual (el precio es real) pero no lo ofrece como tarifa.
 */
function priceFromPayload(payload, passengers) {
  const adults = Math.max(1, Number(passengers) || 1);
  const flights = flightList(payload);
  const cheapest = flights.reduce(function (min, item) {
    const price = Number(item && item.price);
    if (!Number.isFinite(price) || price <= 0) return min;
    return min === null || price < min.price ? { price: price, item: item } : min;
  }, null);

  const insights = payload.price_insights || {};
  const insightPrice = Number(insights.lowest_price);
  const hasInsight = Number.isFinite(insightPrice) && insightPrice > 0;

  if (!cheapest) {
    if (!hasInsight) return null;
    return { total: round2(insightPrice), pp: round2(insightPrice / adults), airline: null, stops: null, exact: false, priceLevel: insights.price_level || null, history: Array.isArray(insights.price_history) ? insights.price_history.length : 0 };
  }

  // Si el vuelo más barato trae ya el total del viaje, se usa. La API devuelve
  // `type: "One way"` cuando todavía falta resolver la vuelta, y en ese caso
  // el precio es solo de ida: mezclado con el de insights daría un total mal.
  const isRoundTrip = !cheapest.item || String(cheapest.item.type || '').toLowerCase() !== 'one way';
  if (isRoundTrip) {
    return {
      total: round2(cheapest.price), pp: round2(cheapest.price / adults),
      airline: airlineOf(cheapest.item), stops: stopsOf(cheapest.item),
      exact: true, priceLevel: insights.price_level || null, history: Array.isArray(insights.price_history) ? insights.price_history.length : 0
    };
  }
  if (hasInsight && insightPrice > cheapest.price) {
    // El precio de ida es menor, pero el que se busca es el de ida y vuelta:
    // el de insights es el correcto para el grafico.
    return {
      total: round2(insightPrice), pp: round2(insightPrice / adults),
      airline: airlineOf(cheapest.item), stops: stopsOf(cheapest.item),
      exact: false, priceLevel: insights.price_level || null, history: Array.isArray(insights.price_history) ? insights.price_history.length : 0
    };
  }
  return {
    total: round2(cheapest.price), pp: round2(cheapest.price / adults),
    airline: airlineOf(cheapest.item), stops: stopsOf(cheapest.item),
    exact: false, priceLevel: insights.price_level || null, history: Array.isArray(insights.price_history) ? insights.price_history.length : 0
  };
}

/*
 * Tarifa real de 1 pasajero, ida y vuelta, para anclar la propuesta
 * recomendada. Devuelve la misma forma que consumía Duffel para que el modelo
 * no cambie: { pp, airline, transfers, exact, foundDep, foundRet, source }.
 */
async function getFlightQuote(input) {
  if (!isConfigured()) return null;
  const passengers = Math.max(1, Number(input.passengers) || 1);
  const payload = await request({
    origin: input.origin, destination: input.destination,
    departureDate: input.dep, returnDate: input.ret,
    passengers: passengers, travelClass: travelClassFor(input.style),
    // Payload minimo: para la propuesta principal solo hacen falta el precio,
    // la aerolínea y las escalas. Cuanto mas chico el restrictor, mas rapido
    // responde la API.
    jsonRestrictor: 'best_flights[0:3].{price,airline,layovers},price_insights'
  });
  const price = priceFromPayload(payload, passengers);
  if (!price || !price.pp) return null;
  return {
    pp: price.pp,
    airline: price.airline,
    transfers: price.stops,
    exact: price.exact,
    foundDep: input.dep,
    foundRet: input.ret,
    source: 'serpapi'
  };
}

// Un solo punto del calendario. `pp` es por pasajero, que es la unidad con la
// que trabaja el modelo.
async function priceForDate(input) {
  const passengers = Math.max(1, Number(input.passengers) || 1);
  const payload = await request({
    origin: input.origin, destination: input.destination,
    departureDate: input.dep, returnDate: input.ret,
    passengers: passengers, travelClass: travelClassFor(input.style),
    // `type` va incluido a propósito: `priceFromPayload()` lo usa para decidir
    // si el precio es de ida o de ida y vuelta. Si el restrictor lo oculta, el
    // campo llega vacío y la decisión queda en manos de un valor por defecto.
    jsonRestrictor: 'best_flights[0].{price,type,layovers},price_insights.{lowest_price,price_level}'
  });
  const price = priceFromPayload(payload, passengers);
  if (!price || !price.pp) return null;
  return { pp: price.pp, total: price.total, exact: price.exact, airline: price.airline, stops: price.stops, priceLevel: price.priceLevel };
}

/*
 * Link a Google Flights con la búsqueda ya armada. Es a donde manda el usuario
 * a terminar la reserva: SerpAPI no devuelve link de compra propio ni acepta
 * parametros de afiliado.
 *
 * Se usa el formato `q=` en lenguaje natural en vez del `tfs=` opaco porque
 * `tfs` es un token interno de Google que cambia sin aviso: el primero se lee
 * y se depura, el segundo un dia deja de funcionar sin que nada avise.
 */
function googleFlightsUrl(input) {
  const origin = String(input.origin || '').toUpperCase();
  const destination = String(input.destination || '').toUpperCase();
  const when = input.ret
    ? 'from ' + origin + ' to ' + destination + ' on ' + input.dep + ' through ' + input.ret
    : 'from ' + origin + ' to ' + destination + ' on ' + input.dep;
  const query = new URLSearchParams({ q: 'Flights ' + when });
  return 'https://www.google.com/travel/flights?' + query.toString();
}

/*
 * Clasifica el `error` que SerpAPI devuelve DENTRO de un HTTP 200.
 *
 * Esto importa mucho más de lo que parece: SerpAPI responde 200 con
 * `{ error: "..." }` tanto para "se te acabaron las búsquedas" como para
 * "falta el parámetro departure_id". Si todo eso se tratara como cuota
 * agotada, un simple error de parámetro congelaría los precios de vuelos un
 * minuto entero por el cooldown, y el gráfico volvería a estimaciones sin que
 * nada pareciera roto. Solo lo que habla de cuota, límite o key inválida
 * apaga el proveedor.
 */
const QUOTA_PATTERN = /quota|rate limit|too many|exceed|run out|searches remaining|invalid api key|api key not found/i;

function errorFromPayload(payload, fallbackStatus) {
  const detail = String((payload && (payload.error || payload.message)) || 'No se pudo consultar disponibilidad.').slice(0, 240);
  const quota = QUOTA_PATTERN.test(detail);
  const error = new Error(detail);
  error.status = quota ? 429 : (fallbackStatus || 502);
  error.quotaExhausted = quota;
  return error;
}

// ---------------------------------------------------------------- browse

const CABIN_LABELS = { 1: 'economy', 2: 'premium_economy', 3: 'business', 4: 'first' };

function airportOf(node) {
  node = node || {};
  return { code: String(node.id || '').toUpperCase(), name: String(node.name || node.id || '') };
}

function durationText(minutes) {
  const total = Math.round(Number(minutes));
  if (!Number.isFinite(total) || total <= 0) return '';
  const hours = Math.floor(total / 60), rest = total % 60;
  return (hours ? hours + ' h' : '') + (hours && rest ? ' ' : '') + (rest ? rest + ' min' : '') || 'Menos de 1 min';
}

// Un tramo del itinerario en la forma que espera la app: `outbound` e
// `inbound` usan este mismo objeto.
function mapLeg(item) {
  const segments = Array.isArray(item && item.flights) ? item.flights : [];
  if (!segments.length) return null;
  const first = segments[0], last = segments[segments.length - 1];
  const layovers = Array.isArray(item.layovers) ? item.layovers : [];
  const carriers = [];
  segments.forEach(function (segment) {
    const name = segment && segment.airline;
    if (name && carriers.indexOf(name) < 0) carriers.push(name);
  });
  return {
    origin: airportOf(first.departure_airport),
    destination: airportOf(last.arrival_airport),
    departure: first.departure_airport && first.departure_airport.time || null,
    arrival: last.arrival_airport && last.arrival_airport.time || null,
    flight_number: String(first.flight_number || ''),
    airline: carriers.join(' · ') || null,
    stops: layovers.length,
    duration: durationText(item.total_duration),
    carriers: carriers
  };
}

/*
 * Vuelos para el browse.
 *
 * UNA sola búsqueda alcanza, y esto se verificó contra la API real: una
 * búsqueda de ida y vuelta con `outbound_date` + `return_date` devuelve en
 * `best_flights[]` el precio TOTAL del viaje ya marcado como `type: "Round
 * trip"`, y ese total es coherente entre pasajeros (1 adulto = US$ 249,
 * 2 adultos = US$ 499 para la misma ruta y fechas). O sea que `price` es por
 * persona y por viaje completo, no solo la ida.
 *
 * Lo que NO trae es el tramo de vuelta: `flights[]` viene con un solo segmento
 * (el de ida) y la llamada de vuelta con `departure_token` devuelve cero
 * resultados. Por eso el browse es de una sola etapa y la tarjeta rotula el
 * precio como "Ida y vuelta" sin prometer un itinerario de vuelta que la API no
 * devolvió.
 *
 * Antes esto se hacía en dos etapas, asumiendo que el precio de la vuelta venía
 * aparte. No es así: la segunda llamada costaba un crédito y no devolvía nada.
 */
async function searchOutbound(input) {
  const payload = await request({
    origin: input.origin, destination: input.destination,
    departureDate: input.departureDate, returnDate: input.returnDate,
    passengers: input.passengers, travelClass: input.travelClass || 1,
    jsonRestrictor: 'best_flights[].{price,type,airline,airline_logo,layovers,total_duration,departure_token,booking_token,flights[].{departure_airport,arrival_airport,airline,flight_number}}'
  });
  const items = flightList(payload);
  const offers = [];
  items.forEach(function (item, index) {
    const leg = mapLeg(item);
    if (!leg) return;
    const price = Number(item.price);
    const cabin = CABIN_LABELS[input.travelClass || 1] || 'economy';
    offers.push({
      id: 'dep_' + index,
      provider: 'serpapi',
      airline: leg.airline || 'Aerolínea',
      logo: item.airline_logo || null,
      cabin_class: cabin,
      cabin_label: cabin === 'premium_economy' ? 'Premium Economy' : cabin === 'business' ? 'Business' : cabin === 'first' ? 'First' : 'Economy',
      departure: leg.departure,
      arrival: leg.arrival,
      return_departure: null,
      return_arrival: null,
      departure_airport: leg.origin,
      arrival_airport: leg.destination,
      flight_number: leg.flight_number,
      stops: leg.stops,
      duration: leg.duration,
      price_usd: Number.isFinite(price) && price > 0 ? round2(price) : null,
      original_price: Number.isFinite(price) ? String(price) : '',
      original_currency: 'USD',
      trip_type: input.returnDate ? 'round_trip' : 'one_way',
      outbound: leg,
      // El tramo de vuelta no viene en la respuesta. Se deja en null y la app
      // lo muestra como "no informado" en vez de inventar horarios.
      inbound: null,
      // Sin `passenger_ids`: SerpAPI no emite boletos, asi que no hay oferta que
      // reservar. La app usa este array solo para guardar el viaje, y queda
      // vacio a proposito en vez de inventar identificadores de pasajero.
      passenger_ids: [],
      recommendation: 'Tarifa disponible',
      departure_token: item.departure_token || null,
      booking_token: item.booking_token || null,
      book_url: googleFlightsUrl({ origin: input.origin, destination: input.destination, dep: input.departureDate, ret: input.returnDate })
    });
  });
  return { offers: offers };
}

module.exports = {
  isConfigured, setFetch, travelClassFor, buildQuery,
  priceFromPayload, getFlightQuote, priceForDate, googleFlightsUrl,
  searchOutbound
};
