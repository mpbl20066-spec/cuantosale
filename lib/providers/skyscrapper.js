'use strict';

const DEFAULT_HOST = 'sky-scrapper.p.rapidapi.com';
const AIRPORT_SEARCH_PATH = '/api/v1/flights/searchAirport';
const FLIGHT_SEARCH_PATH = '/api/v1/flights/searchFlights';
let fetchImpl = null;
const locationCache = new Map();

function normalizeHost(value) {
  return String(value || DEFAULT_HOST).trim()
    .replace(/^https?:\/\//i, '')
    .split(/[/?#]/, 1)[0]
    .replace(/\.+$/, '')
    .toLowerCase();
}

function config() {
  return {
    key: process.env.FLIGHT_RAPIDAPI_KEY || process.env.RAPIDAPI_FLIGHTS_KEY || process.env.SKY_SCRAPPER_API_KEY || process.env.RAPIDAPI_KEY || '',
    host: normalizeHost(process.env.FLIGHT_RAPIDAPI_HOST || process.env.RAPIDAPI_FLIGHTS_HOST || process.env.SKY_SCRAPPER_API_HOST || process.env.RAPIDAPI_HOST || DEFAULT_HOST)
  };
}
function isConfigured() { return !!config().key; }
function setFetch(fn) { fetchImpl = fn; locationCache.clear(); }
function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  return undefined;
}
function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && (url.hostname === 'skyscanner.com' || url.hostname.endsWith('.skyscanner.com')) ? url.toString() : '';
  } catch (e) { return ''; }
}
async function getJson(path, params, credentials, fetcher) {
  const url = new URL(path, 'https://' + credentials.host);
  Object.keys(params || {}).forEach(function (key) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') url.searchParams.set(key, String(params[key]));
  });
  let response;
  try {
    response = await fetcher(url.toString(), {
      method: 'GET', signal: timeoutSignal(18000),
      headers: { 'x-rapidapi-host': credentials.host, 'x-rapidapi-key': credentials.key, Accept: 'application/json' }
    });
  } catch (error) {
    if (error && error.name === 'AbortError' || error && error.name === 'TimeoutError') throw Object.assign(new Error('La búsqueda de vuelos tardó demasiado. Probá de nuevo en unos minutos.'), { status: 504 });
    throw Object.assign(new Error('No se pudo conectar con Sky Scrapper. Probá de nuevo en unos minutos.'), { status: 502 });
  }
  let payload;
  try { payload = await response.json(); } catch (e) { throw Object.assign(new Error('Sky Scrapper devolvió una respuesta inválida.'), { status: 502 }); }
  if (!response.ok || payload && payload.status === false) {
    const message = String(payload && (payload.message || payload.error || payload.errors) || 'No se pudo consultar disponibilidad.').slice(0, 200);
    throw Object.assign(new Error('Sky Scrapper (HTTP ' + response.status + '): ' + message), { status: response.status === 429 ? 429 : 502 });
  }
  return payload || {};
}
function rowsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload && payload.data)) return payload.data;
  return [];
}
async function resolveLocation(iata, credentials, fetcher) {
  const code = String(iata || '').toUpperCase();
  if (!code) throw Object.assign(new Error('No se pudo identificar uno de los aeropuertos.'), { status: 400 });
  if (locationCache.has(code)) return locationCache.get(code);
  const payload = await getJson(AIRPORT_SEARCH_PATH, { query: code, locale: 'en-US' }, credentials, fetcher);
  const results = rowsFrom(payload);
  const selected = results.find(function (item) { return item && String(item.skyId || '').toUpperCase() === code; }) || results.find(function (item) { return item && String(item.navigation && item.navigation.localizedName || '').toUpperCase().includes(code); }) || results[0];
  const skyId = selected && (selected.skyId || selected.navigation && selected.navigation.relevantFlightParams && selected.navigation.relevantFlightParams.skyId);
  const entityId = selected && (selected.entityId || selected.navigation && selected.navigation.relevantFlightParams && selected.navigation.relevantFlightParams.entityId);
  if (!skyId || !entityId) throw Object.assign(new Error('Sky Scrapper no encontró el aeropuerto ' + code + '.'), { status: 502 });
  const result = { skyId: String(skyId), entityId: String(entityId) };
  locationCache.set(code, result);
  return result;
}
function styleCabins(style) {
  if (style === 'ahorro') return ['economy'];
  if (style === 'comodo') return ['premium_economy', 'business'];
  return ['economy', 'premium_economy'];
}
function mapItinerary(item, cabinClass) {
  if (!item || typeof item !== 'object') return null;
  const legs = Array.isArray(item.legs) ? item.legs : [];
  const outbound = legs[0], inbound = legs[1] || null;
  if (!outbound) return null;
  const priceRaw = Number(item.price && (item.price.raw !== undefined ? item.price.raw : item.price.amount));
  const carriers = outbound.carriers || {};
  const marketing = Array.isArray(carriers.marketing) ? carriers.marketing : Array.isArray(carriers.operating) ? carriers.operating : [];
  const airline = marketing.map(function (carrier) { return carrier && carrier.name; }).filter(Boolean).join(', ') || 'Aerolínea';
  function mapLeg(leg) {
    if (!leg) return null;
    const legCarriers = leg.carriers || {};
    const names = (Array.isArray(legCarriers.marketing) ? legCarriers.marketing : []).map(function (carrier) { return carrier && carrier.name; }).filter(Boolean);
    const mins = Number(leg.durationInMinutes);
    return {
      origin: { code: String(leg.origin && leg.origin.id || ''), name: String(leg.origin && leg.origin.name || '') },
      destination: { code: String(leg.destination && leg.destination.id || ''), name: String(leg.destination && leg.destination.name || '') },
      departure: leg.departure || null, arrival: leg.arrival || null,
      duration: Number.isFinite(mins) ? Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + (mins % 60) + ' min' : '') : '',
      stops: Math.max(0, Number(leg.stopCount) || 0), airline: names.join(', ')
    };
  }
  const out = mapLeg(outbound), back = mapLeg(inbound);
  const deepLink = safeUrl(item.deepLink || item.deep_link || item.url);
  const currency = String(item.price && item.price.currency || 'USD').toUpperCase();
  return {
    id: String(item.id || [out.origin.code, out.destination.code, out.departure, priceRaw].join('-')),
    provider: 'skyscrapper', agency: 'Sky Scrapper', airline: airline, logo: marketing[0] && marketing[0].logoUrl || null,
    cabin_class: cabinClass, cabin_label: cabinClass === 'premium_economy' ? 'Premium Economy' : cabinClass === 'business' ? 'Business' : 'Economy',
    departure: out.departure, arrival: out.arrival, return_departure: back && back.departure || null, return_arrival: back && back.arrival || null,
    departure_airport: out.origin, arrival_airport: out.destination, flight_number: '',
    stops: out.stops + (back ? back.stops : 0), duration: [out.duration, back && back.duration].filter(Boolean).join(' + '),
    price_usd: Number.isFinite(priceRaw) && currency === 'USD' ? Math.round(priceRaw * 100) / 100 : null,
    original_price: Number.isFinite(priceRaw) ? String(priceRaw) : String(item.price && item.price.formatted || ''), original_currency: currency,
    trip_type: back ? 'round_trip' : 'one_way', outbound: out, inbound: back,
    recommendation: 'Tarifa en Sky Scrapper', booking_url: deepLink
  };
}
async function searchFlights(input) {
  const credentials = config();
  if (!credentials.key) throw Object.assign(new Error('Falta configurar FLIGHT_RAPIDAPI_KEY en las variables de entorno de Vercel.'), { status: 503 });
  const fetcher = fetchImpl || fetch;
  const places = await Promise.all([resolveLocation(input.origin, credentials, fetcher), resolveLocation(input.destination, credentials, fetcher)]);
  const from = places[0], to = places[1];
  const params = {
    originSkyId: from.skyId, destinationSkyId: to.skyId,
    originEntityId: from.entityId, destinationEntityId: to.entityId,
    date: input.departureDate, returnDate: input.returnDate || undefined,
    adults: input.passengers, currency: 'USD', countryCode: 'UY', market: 'es-UY',
    cabinClass: input.cabinClass || 'economy'
  };
  const payload = await getJson(FLIGHT_SEARCH_PATH, params, credentials, fetcher);
  const data = payload.data || {};
  const itineraries = data.itineraries || data.results || data.flights || [];
  if (!Array.isArray(itineraries)) return [];
  return itineraries.map(function (item) { return mapItinerary(item, params.cabinClass); }).filter(function (offer) {
    return offer && offer.departure_airport.code.toUpperCase() === 'MVD';
  });
}

module.exports = { isConfigured, setFetch, searchFlights, mapItinerary, styleCabins };
