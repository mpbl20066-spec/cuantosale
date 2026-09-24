'use strict';

const API = 'https://api.duffel.com';
const API_VERSION = 'v2';
const placeCache = new Map();
let fetchImpl = null;

function config() {
  return {
    token: process.env.DUFFEL_API_KEY || process.env.DUFFEL_ACCESS_TOKEN || process.env.DUFFEL_TOKEN || ''
  };
}

function isConfigured() { return !!config().token; }
function setFetch(fn) { fetchImpl = fn; placeCache.clear(); }

function styleCabins(style) {
  if (style === 'ahorro') return ['economy'];
  if (style === 'comodo') return ['premium_economy', 'business'];
  return ['economy', 'premium_economy'];
}

async function requestJson(path, options) {
  const credentials = config();
  if (!credentials.token) {
    const error = new Error('Falta configurar DUFFEL_API_KEY o DUFFEL_ACCESS_TOKEN en las variables de entorno del servidor.');
    error.status = 503;
    throw error;
  }
  const fetcher = fetchImpl || fetch;
  const requestOptions = Object.assign({
    method: 'GET',
    signal: AbortSignal.timeout(25000)
  }, options || {});
  requestOptions.headers = Object.assign({
    Authorization: 'Bearer ' + credentials.token,
    'Duffel-Version': API_VERSION,
    Accept: 'application/json'
  }, options && options.headers || {});
  let response;
  try {
    response = await fetcher(API + path, requestOptions);
  } catch (cause) {
    const error = new Error(cause && (cause.name === 'AbortError' || cause.name === 'TimeoutError')
      ? 'Duffel demoró demasiado en responder. Probá de nuevo.'
      : 'No se pudo conectar con Duffel. Probá de nuevo en unos minutos.');
    error.status = cause && (cause.name === 'AbortError' || cause.name === 'TimeoutError') ? 504 : 502;
    throw error;
  }
  let payload;
  try { payload = await response.json(); } catch (e) {
    const error = new Error('Duffel devolvió una respuesta JSON inválida.');
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    const detail = payload && payload.errors && payload.errors[0] && (payload.errors[0].message || payload.errors[0].title);
    const error = new Error('Duffel (HTTP ' + response.status + '): ' + String(detail || 'No se pudo consultar disponibilidad.').slice(0, 240));
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return payload || {};
}

async function resolvePlace(iataCode) {
  const code = String(iataCode || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    const error = new Error('Código de aeropuerto o ciudad inválido para Duffel.');
    error.status = 400;
    throw error;
  }
  if (placeCache.has(code)) return placeCache.get(code);
  const query = new URLSearchParams({ query: code });
  const payload = await requestJson('/places/suggestions?' + query.toString());
  const places = Array.isArray(payload.data) ? payload.data : [];
  const airportMatch = places.find(function (item) { return item && String(item.iata_code || '').toUpperCase() === code; });
  const cityMatch = places.find(function (item) {
    return item && (String(item.iata_city_code || '').toUpperCase() === code || item.type === 'city' && String(item.iata_code || '').toUpperCase() === code);
  });
  const place = airportMatch || cityMatch;
  const resolvedCode = airportMatch ? airportMatch.iata_code : place && (place.iata_city_code || place.iata_code);
  if (!resolvedCode) {
    const error = new Error('Duffel no encontró el aeropuerto o ciudad ' + code + '.');
    error.status = 422;
    throw error;
  }
  const result = String(resolvedCode).toUpperCase();
  placeCache.set(code, result);
  return result;
}

function airport(place) {
  place = place || {};
  return {
    code: String(place.iata_code || place.iata_city_code || ''),
    name: String(place.name || place.city_name || place.iata_code || place.iata_city_code || '')
  };
}

function durationText(segments) {
  const first = segments[0], last = segments[segments.length - 1];
  const start = Date.parse(first && first.departing_at || '');
  const end = Date.parse(last && last.arriving_at || '');
  const seconds = Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 1000 : 0;
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return (hours ? hours + ' h' : '') + (hours && remainder ? ' ' : '') + (remainder ? remainder + ' min' : '') || 'Menos de 1 min';
}

function mapSlice(slice) {
  const segments = Array.isArray(slice && slice.segments) ? slice.segments : [];
  if (!segments.length) return null;
  const first = segments[0], last = segments[segments.length - 1];
  const carriers = [];
  segments.forEach(function (segment) {
    const carrier = segment.operating_carrier || segment.marketing_carrier || {};
    if (carrier.name && carriers.indexOf(carrier.name) < 0) carriers.push(carrier.name);
  });
  return {
    origin: airport(first.origin),
    destination: airport(last.destination),
    departure: first.departing_at || null,
    arrival: last.arriving_at || null,
    flight_number: String(first.marketing_carrier && first.marketing_carrier.iata_code || '') + String(first.marketing_carrier_flight_number || ''),
    airline: carriers.join(' · '),
    stops: Math.max(0, segments.length - 1),
    duration: durationText(segments),
    carriers: carriers
  };
}

function mapOffer(offer, cabinClass) {
  if (!offer || typeof offer !== 'object') return null;
  const slices = Array.isArray(offer.slices) ? offer.slices : [];
  const outbound = mapSlice(slices[0]);
  if (!outbound) return null;
  const inbound = mapSlice(slices[1]);
  const allSegments = slices.reduce(function (items, slice) {
    return items.concat(Array.isArray(slice && slice.segments) ? slice.segments : []);
  }, []);
  const airlines = [];
  allSegments.forEach(function (segment) {
    const carrier = segment.operating_carrier || segment.marketing_carrier || {};
    if (carrier.name && airlines.indexOf(carrier.name) < 0) airlines.push(carrier.name);
  });
  const amount = Number(offer.total_amount);
  const currency = String(offer.total_currency || '').toUpperCase();
  const cabin = cabinClass || (offer.passengers || []).map(function (passenger) { return passenger && passenger.cabin_class; }).filter(Boolean)[0] || 'economy';
  return {
    id: String(offer.id || ''),
    provider: 'duffel',
    airline: airlines.join(' · ') || (offer.owner && offer.owner.name) || 'Aerolínea',
    logo: offer.owner && (offer.owner.logo_symbol_url || offer.owner.logo_lockup_url) || null,
    cabin_class: cabin,
    cabin_label: cabin === 'premium_economy' ? 'Premium Economy' : cabin === 'business' ? 'Business' : cabin === 'first' ? 'First' : 'Economy',
    departure: outbound.departure,
    arrival: outbound.arrival,
    return_departure: inbound && inbound.departure || null,
    return_arrival: inbound && inbound.arrival || null,
    departure_airport: outbound.origin,
    arrival_airport: outbound.destination,
    flight_number: outbound.flight_number,
    stops: outbound.stops + (inbound ? inbound.stops : 0),
    duration: [outbound.duration, inbound && inbound.duration].filter(Boolean).join(' + '),
    price_usd: Number.isFinite(amount) && amount > 0 && currency === 'USD' ? Math.round(amount * 100) / 100 : null,
    original_price: Number.isFinite(amount) ? String(amount) : '',
    original_currency: currency || 'USD',
    trip_type: inbound ? 'round_trip' : 'one_way',
    outbound: outbound,
    inbound: inbound,
    passenger_ids: Array.isArray(offer.passengers) ? offer.passengers.map(function (passenger) { return passenger && passenger.id; }).filter(Boolean) : [],
    recommendation: 'Tarifa disponible'
  };
}

async function searchFlights(input) {
  if (!isConfigured()) {
    const error = new Error('Falta configurar DUFFEL_API_KEY o DUFFEL_ACCESS_TOKEN en las variables de entorno del servidor.');
    error.status = 503;
    throw error;
  }
  const places = await Promise.all([resolvePlace(input.origin), resolvePlace(input.destination)]);
  const slices = [{ origin: places[0], destination: places[1], departure_date: input.departureDate }];
  if (input.returnDate) slices.push({ origin: places[1], destination: places[0], departure_date: input.returnDate });
  const data = {
    slices: slices,
    passengers: Array.from({ length: input.passengers }, function () { return { type: 'adult' }; }),
    cabin_class: input.cabinClass || 'economy'
  };
  const payload = await requestJson('/air/offer_requests?return_offers=true&supplier_timeout=15000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: data })
  });
  const offers = payload && payload.data && Array.isArray(payload.data.offers) ? payload.data.offers : [];
  const requestedOrigin = String(input.origin || 'MVD').toUpperCase();
  return offers.map(function (offer) { return mapOffer(offer, data.cabin_class); }).filter(function (offer) {
    return offer && offer.departure_airport.code.toUpperCase() === requestedOrigin;
  });
}

module.exports = { isConfigured, setFetch, styleCabins, resolvePlace, mapOffer, searchFlights };
