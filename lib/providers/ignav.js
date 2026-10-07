'use strict';
/*
 * Vuelos con Ignav (https://ignav.com/docs). Misma interfaz que serpapi.js, para
 * que el agregador (index.js) pueda usar cualquiera de los dos sin cambios.
 *
 * Lo que se verifico contra la API real (MVD -> GIG, 25 dic -> 1 ene):
 *  - POST /api/fares/round-trip y /api/fares/one-way, header X-Api-Key.
 *  - `adults` es el campo de pasajeros: el precio que devuelve es el TOTAL para
 *    esa cantidad (2 adultos ~ 2 x 1 adulto). `passengers` no existe.
 *  - La moneda sale del `market`: market "UY" devuelve UYU (las mismas tarifas
 *    que veia el usuario con SerpAPI gl=uy), market "US" devuelve USD pero con
 *    tarifas del mercado US. No hay campo `currency`.
 *  - Trae el tramo de VUELTA completo (inbound), cosa que SerpAPI no daba.
 *  - cabin_class acepta economy / premium_economy. Business y first dieron
 *    cero resultados en esta ruta.
 *
 * El modelo de la app trabaja en USD, asi que los precios en otra moneda se
 * convierten con la cotizacion del dia (la misma fuente que el selector de
 * moneda del server). Sin cotizacion NO se inventa un numero: se lanza un
 * error y el agregador cae al respaldo o a la estimacion.
 */

const BASE = 'https://ignav.com/api/fares';
const TIMEOUT_MS = Number(process.env.IGNAV_TIMEOUT_MS) || 40000;
const MAX_CONCURRENT = Number(process.env.IGNAV_CONCURRENCY) || 6;
const FX_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

let fetchImpl = null;
function setFetch(fn) { fetchImpl = fn; }
function apiKey() { return String(process.env.IGNAV_API_KEY || '').trim(); }
function isConfigured() { return !!apiKey(); }
function market() { return String(process.env.IGNAV_MARKET || 'UY').trim().toUpperCase(); }

// 1 = Economy, 2 = Premium economy, 3 = Business, 4 = First (igual que serpapi.js)
const CABIN_BY_CLASS = { 1: 'economy', 2: 'premium_economy', 3: 'business', 4: 'first' };
function travelClassFor(style) {
  if (style === 'comodo') return Number(process.env.SERPAPI_CABIN_COMODO) || 2;
  if (style === 'business') return Number(process.env.SERPAPI_CABIN_COMODO) || 3;
  return 1;
}

function round2(value) { return Math.round(Number(value) * 100) / 100; }

// ------------------------------------------------------------------ cotizacion
let fx = { rates: null, until: 0, intentarEn: 0 };
let fxEnCurso = null;
/* Una sola descarga de cotizacion aunque lleguen 15 pedidos a la vez (el
   calendario pide 15 fechas en paralelo): los demas esperan la misma promesa.
   Sin esto, el primero marcaba "ya intente" y los otros 14 fallaban sin
   cotizacion. Si la descarga falla se sigue usando la ultima cotizacion buena
   (hasta 7 dias) antes que dejar la app sin precio. */
function cargarCotizacion() {
  const ahora = Date.now();
  if (fx.rates && ahora < fx.until) return Promise.resolve();
  if (fxEnCurso) return fxEnCurso;
  if (ahora < fx.intentarEn) return Promise.resolve();
  fxEnCurso = (async function () {
    try {
      const response = await (fetchImpl || fetch)(FX_URL, { signal: AbortSignal.timeout(9000), headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (json && json.rates) fx = { rates: json.rates, until: Date.now() + 12 * 3600e3, vence: Date.now() + 7 * 24 * 3600e3, intentarEn: 0 };
      else fx.intentarEn = Date.now() + 10 * 60e3;
    } catch (e) { fx.intentarEn = Date.now() + 10 * 60e3; }
  })().then(function () { fxEnCurso = null; }, function () { fxEnCurso = null; });
  return fxEnCurso;
}
async function usdPer(currency) {
  const code = String(currency || 'USD').toUpperCase();
  if (code === 'USD') return 1;
  await cargarCotizacion();
  const vigente = fx.rates && (Date.now() < fx.until || Date.now() < (fx.vence || 0));
  const rate = vigente && Number(fx.rates[code]);
  if (!(rate > 0)) {
    const error = new Error('Sin cotizacion para convertir ' + code + ' a USD.');
    error.status = 502;
    throw error;
  }
  return 1 / rate;   // USD por 1 unidad de la moneda
}
async function toUsd(amount, currency) {
  return round2(Number(amount) * await usdPer(currency));
}

// -------------------------------------------------------------------- pedidos
/* Maximo de pedidos simultaneos a Ignav. Medido: con 30 en paralelo la latencia
   de cada uno llega a 45 s (la API procesa unos ~0,6 pedidos por segundo en
   fechas frias), asi que muchos pasaban el limite de espera y fallaban. Con una
   cola de 6 la espera se hace ANTES de arrancar el reloj de cada pedido y
   ninguno se corta por estar esperando turno. El total no cambia; los
   resultados dejan de perderse. */
let activos = 0;
const cola = [];
function turno() {
  return new Promise(function (resolve) {
    function entrar() { activos++; resolve(); }
    if (activos < MAX_CONCURRENT) entrar(); else cola.push(entrar);
  });
}
function liberar() {
  activos--;
  const siguiente = cola.shift();
  if (siguiente) siguiente();
}

async function request(input) {
  const key = apiKey();
  if (!key) {
    const error = new Error('Falta configurar IGNAV_API_KEY en las variables de entorno del servidor.');
    error.status = 503;
    throw error;
  }
  const roundTrip = !!input.returnDate;
  const body = {
    origin: String(input.origin || '').toUpperCase(),
    destination: String(input.destination || '').toUpperCase(),
    departure_date: input.departureDate,
    market: market(),
    adults: Math.max(1, Number(input.passengers) || 1)
  };
  if (roundTrip) body.return_date = input.returnDate;
  const cabin = CABIN_BY_CLASS[input.travelClass || 1];
  if (cabin && cabin !== 'economy') body.cabin_class = cabin;

  let response;
  await turno();
  try {
    response = await (fetchImpl || fetch)(BASE + (roundTrip ? '/round-trip' : '/one-way'), {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Api-Key': key },
      body: JSON.stringify(body)
    });
  } catch (cause) {
    const timeout = cause && (cause.name === 'AbortError' || cause.name === 'TimeoutError');
    const error = new Error(timeout
      ? 'La búsqueda de vuelos demoró demasiado. Probá de nuevo.'
      : 'No se pudo conectar con el buscador de vuelos. Probá de nuevo en unos minutos.');
    error.status = timeout ? 504 : 502;
    liberar();
    throw error;
  }
  liberar();
  let payload;
  try { payload = await response.json(); } catch (e) {
    const error = new Error('El buscador de vuelos devolvió una respuesta JSON inválida.');
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    const detail = payload && payload.error && (payload.error.message || payload.error.code) || payload && payload.message || '';
    const error = new Error('Buscador de vuelos (HTTP ' + response.status + '): ' + String(detail || 'No se pudo consultar disponibilidad.').slice(0, 240));
    error.status = response.status === 429 ? 429 : 502;
    error.quotaExhausted = response.status === 429 || response.status === 402 || response.status === 401 || response.status === 403;
    throw error;
  }
  return payload || {};
}

// ------------------------------------------------------------------ itinerarios
function itinerariesOf(payload) {
  const list = Array.isArray(payload && payload.itineraries) ? payload.itineraries : [];
  // Un itinerario con "self transfer" son tramos sueltos: si uno se retrasa el
  // siguiente se pierde sin reembolso. No se ofrece como tarifa de la app.
  return list.filter(function (it) {
    return it && it.price && Number(it.price.amount) > 0 && !it.requires_self_transfer;
  });
}
function cheapestOf(payload) {
  return itinerariesOf(payload).reduce(function (min, it) {
    return min === null || Number(it.price.amount) < Number(min.price.amount) ? it : min;
  }, null);
}
function stopsOf(leg) {
  const segments = leg && Array.isArray(leg.segments) ? leg.segments : [];
  return Math.max(0, segments.length - 1);
}
function carriersOf(leg) {
  const names = [];
  ((leg && leg.segments) || []).forEach(function (segment) {
    const name = segment && (segment.operating_carrier_name || segment.marketing_carrier_code);
    if (name && names.indexOf(name) < 0) names.push(name);
  });
  if (!names.length && leg && leg.carrier) names.push(leg.carrier);
  return names;
}

async function quoteFrom(payload, passengers) {
  const best = cheapestOf(payload);
  if (!best) return null;
  const total = await toUsd(best.price.amount, best.price.currency);
  return {
    total: total, pp: round2(total / passengers),
    airline: carriersOf(best.outbound).join(' · ') || null,
    stops: stopsOf(best.outbound)
  };
}

/* Tarifa de 1 pasajero (o de `passengers`), ida y vuelta, para anclar la propuesta. */
async function getFlightQuote(input) {
  if (!isConfigured()) return null;
  const passengers = Math.max(1, Number(input.passengers) || 1);
  const payload = await request({
    origin: input.origin, destination: input.destination,
    departureDate: input.dep, returnDate: input.ret,
    passengers: passengers, travelClass: travelClassFor(input.style)
  });
  const quote = await quoteFrom(payload, passengers);
  if (!quote || !quote.pp) return null;
  return {
    pp: quote.pp, airline: quote.airline, transfers: quote.stops,
    exact: true, foundDep: input.dep, foundRet: input.ret, source: 'ignav'
  };
}

/* Un punto del calendario. */
async function priceForDate(input) {
  const passengers = Math.max(1, Number(input.passengers) || 1);
  const payload = await request({
    origin: input.origin, destination: input.destination,
    departureDate: input.dep, returnDate: input.ret,
    passengers: passengers, travelClass: travelClassFor(input.style)
  });
  const quote = await quoteFrom(payload, passengers);
  if (!quote || !quote.pp) return null;
  return { pp: quote.pp, total: quote.total, exact: true, airline: quote.airline, stops: quote.stops, priceLevel: null };
}

/* Mismo link que serpapi.js: a Google Flights con la busqueda armada. */
function googleFlightsUrl(input) {
  const origin = String(input.origin || '').toUpperCase();
  const destination = String(input.destination || '').toUpperCase();
  const when = input.ret
    ? 'from ' + origin + ' to ' + destination + ' on ' + input.dep + ' through ' + input.ret
    : 'from ' + origin + ' to ' + destination + ' on ' + input.dep;
  return 'https://www.google.com/travel/flights?' + new URLSearchParams({ q: 'Flights ' + when }).toString();
}

// ----------------------------------------------------------------------- browse
function durationText(minutes) {
  const total = Math.round(Number(minutes));
  if (!Number.isFinite(total) || total <= 0) return '';
  const hours = Math.floor(total / 60), rest = total % 60;
  return (hours ? hours + ' h' : '') + (hours && rest ? ' ' : '') + (rest ? rest + ' min' : '') || 'Menos de 1 min';
}
function airportNode(code) { const c = String(code || '').toUpperCase(); return { code: c, name: c }; }
function mapLeg(leg) {
  const segments = leg && Array.isArray(leg.segments) ? leg.segments : [];
  if (!segments.length) return null;
  const first = segments[0], last = segments[segments.length - 1];
  const carriers = carriersOf(leg);
  return {
    origin: airportNode(first.departure_airport),
    destination: airportNode(last.arrival_airport),
    departure: first.departure_time_local || null,
    arrival: last.arrival_time_local || null,
    flight_number: String((first.marketing_carrier_code || '') + (first.flight_number || '')),
    airline: carriers.join(' · ') || null,
    stops: stopsOf(leg),
    duration: durationText(leg.duration_minutes),
    carriers: carriers
  };
}

/*
 * Ofertas para el browse: ida y vuelta en UNA llamada, con los dos tramos.
 * `price_usd` es el total para `passengers` (igual que con SerpAPI).
 */
async function searchOutbound(input) {
  const passengers = Math.max(1, Number(input.passengers) || 1);
  const payload = await request({
    origin: input.origin, destination: input.destination,
    departureDate: input.departureDate, returnDate: input.returnDate,
    passengers: passengers, travelClass: input.travelClass || 1
  });
  const cabin = CABIN_BY_CLASS[input.travelClass || 1] || 'economy';
  const offers = [];
  const items = itinerariesOf(payload);
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const out = mapLeg(item.outbound);
    if (!out) continue;
    const back = mapLeg(item.inbound);
    const usd = await toUsd(item.price.amount, item.price.currency);
    offers.push({
      id: 'ign_' + index,
      provider: 'ignav',
      airline: out.airline || 'Aerolínea',
      logo: null,
      cabin_class: cabin,
      cabin_label: cabin === 'premium_economy' ? 'Premium Economy' : cabin === 'business' ? 'Business' : cabin === 'first' ? 'First' : 'Economy',
      departure: out.departure,
      arrival: out.arrival,
      return_departure: back ? back.departure : null,
      return_arrival: back ? back.arrival : null,
      departure_airport: out.origin,
      arrival_airport: out.destination,
      flight_number: out.flight_number,
      stops: out.stops,
      duration: out.duration,
      price_usd: usd > 0 ? usd : null,
      original_price: String(item.price.amount),
      original_currency: String(item.price.currency || ''),
      trip_type: input.returnDate ? 'round_trip' : 'one_way',
      outbound: out,
      inbound: back,
      passenger_ids: [],
      recommendation: 'Tarifa disponible',
      departure_token: null,
      booking_token: item.ignav_id || null,
      book_url: googleFlightsUrl({ origin: input.origin, destination: input.destination, dep: input.departureDate, ret: input.returnDate })
    });
  }
  return { offers: offers };
}

module.exports = {
  isConfigured, setFetch, travelClassFor, googleFlightsUrl,
  getFlightQuote, priceForDate, searchOutbound
};
