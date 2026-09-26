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
    cabin_class: input.cabinClass || 'economy',
    // Sin esto Duffel usa la moneda por defecto de la cuenta. Si esa no es USD,
    // TODAS las ofertas vuelven con total_currency distinta y mapOffer() las
    // marca price_usd: null, getLiveFlightQuote() las filtra todas y la app
    // degrada en silencio a "Precios estimados" sin dejar una sola línea en los
    // logs. La base del presupuesto es USD, así que se pide explícitamente.
    currency: 'USD'
  };
  const payload = await requestJson('/air/offer_requests?return_offers=true&supplier_timeout=15000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: data })
  });
  const offers = payload && payload.data && Array.isArray(payload.data.offers) ? payload.data.offers : [];
  const requestedOrigin = String(input.origin || 'MVD').toUpperCase();
  const mapped = offers.map(function (offer) { return mapOffer(offer, data.cabin_class); }).filter(function (offer) {
    return offer && offer.departure_airport.code.toUpperCase() === requestedOrigin;
  });
  // Si llegaron ofertas pero ninguna tiene precio en USD, es un problema de
  // configuración (moneda de la cuenta, o respuestas sin total_amount). Antes
  // era imposible diagnosticsarlo desde los logs.
  if (mapped.length && !mapped.some(function (offer) { return offer.price_usd !== null; })) {
    console.warn('[Duffel] ' + mapped.length + ' oferta(s) llegaron sin precio en USD. Revisá la moneda por defecto de la cuenta; la app va a mostrar precios estimados.');
  }
  return mapped;
}

// ---------------------------------------------------------------- markup
// El precio de la tarifa lo fija la aerolínea: en el producto no hay margen.
// Lo ganamos nosotros passando un `amount` de pago mayor que el costo real.
// La fórmula es la de Duffel: ((costo + markup) × fx) / (1 - comisión), para
// que lo que entra cubra el costo, las comisiones del cobro y el margen.
function markupConfig() {
  return {
    percent: Number(process.env.FLIGHT_MARKUP_PERCENT || 10),
    fee: Number(process.env.DUFFEL_PAYMENT_FEE || 0.029),
    fxRate: Number(process.env.DUFFEL_FX_RATE || 1)
  };
}

// Duffel exige redondear "half away from zero" (0.5 -> 1, -0.5 -> -1). El
// Math.round de JS hace half-up toward +Infinity y mandaría -0.5 a -0.
function roundHalfAwayFromZero(value) {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

// Redondeo a dos decimales (centavos), que es como viaja el dinero por la API.
// No sirve roundHalfAwayFromZero(x)/100 sobre un valor ya redondeado a entero:
// eso trunca la parte decimal en lugar de ajustarla.
function roundCents(value) {
  return roundHalfAwayFromZero(value * 100) / 100;
}

function quoteWithMarkup(totalAmount, currency) {
  const settings = markupConfig();
  const cost = roundCents(Number(totalAmount));
  if (!Number.isFinite(cost) || cost <= 0) {
    const error = new Error('La tarifa ya no está disponible.');
    error.status = 422;
    throw error;
  }
  // `percent` se configura en puntos porcentuales (10 = 10%), así que va
  // dividido por 100 para obtener la fracción.
  const markup = roundCents(cost * settings.percent / 100);
  const charged = roundCents(((cost + markup) * settings.fxRate) / (1 - settings.fee));
  return {
    cost: cost,
    markup_percent: settings.percent,
    markup_amount: markup,
    charge_amount: charged,
    payment_fee: settings.fee,
    fx_rate: settings.fxRate,
    currency: String(currency || 'USD').toUpperCase()
  };
}

// Cuántos componentes habilita el client key. Los nombres exactos hay que
// confirmarlos contra el dashboard de Duffel: si alguno no existe, la API
// responde 422 y el error sube tal cual al cliente.
function cardComponents() {
  return String(process.env.DUFFEL_CARD_COMPONENTS || 'card_form,three_d_secure_session')
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

// El client key NO es el access token: es un token pensado para viajar al
// navegador y solo habilita los componentes de pago. Por eso se puede
// devolver por HTTP al frontend sin riesgo.
async function createClientKey() {
  const payload = await requestJson('/component-client-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { components: cardComponents() } })
  });
  const key = payload && payload.data && payload.data.id;
  if (!key) {
    const error = new Error('Duffel no devolvió un client key válido.');
    error.status = 502;
    throw error;
  }
  return key;
}

// Las ofertas se vuelven obsoletas enseguida: el precio que se pintó en el
// buscador puede no ser el de un segundo después. Antes de cobrar hay que
// releer la oferta y usar SIEMPRE ese total, nunca el que envio el navegador.
async function getOffer(offerId) {
  const id = String(offerId || '').trim();
  if (!/^off_[A-Za-z0-9]+$/.test(id)) {
    const error = new Error('La tarifa indicada no es válida.');
    error.status = 400;
    throw error;
  }
  const payload = await requestJson('/offers/' + encodeURIComponent(id));
  const offer = payload && payload.data;
  if (!offer) {
    const error = new Error('Esa tarifa ya no está disponible. Buscá de nuevo.');
    error.status = 410;
    throw error;
  }
  return offer;
}

// Duffel exige datos reales de cada pasajero para emitir el boleto: nombre,
// fecha de nacimiento, género, email y teléfono. El `id` tiene que ser el que
// Duffel asignó en el offer request, no uno inventado por el cliente.
function normalizePassenger(raw) {
  const given = String(raw && raw.given_name || '').trim();
  const family = String(raw && raw.family_name || '').trim();
  const born = String(raw && raw.born_on || '').trim();
  const gender = String(raw && raw.gender || '').trim().toLowerCase();
  const email = String(raw && raw.email || '').trim();
  const phone = String(raw && raw.phone_number || '').trim();
  const missing = [];
  if (!given || !family) missing.push('nombre y apellido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(born)) missing.push('fecha de nacimiento');
  if (gender !== 'm' && gender !== 'f') missing.push('género');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('email');
  if (!/^\+?[\d\s()-]{6,20}$/.test(phone)) missing.push('teléfono');
  if (!String(raw && raw.id || '').trim()) missing.push('pasajero');
  if (missing.length) {
    const error = new Error('Falta completar: ' + missing.join(', ') + '.');
    error.status = 400;
    throw error;
  }
  const passenger = {
    id: String(raw.id).trim(),
    given_name: given,
    family_name: family,
    born_on: born,
    gender: gender,
    email: email,
    phone_number: phone
  };
  const title = String(raw.title || '').trim();
  if (title) passenger.title = title;
  // Los infants (0-1 años) van colgados del adulto responsable. Cada adulto
  // puede tener uno solo.
  if (raw.infant_passenger_id) passenger.infant_passenger_id = String(raw.infant_passenger_id).trim();
  return passenger;
}

// Crea la orden y cobra. El `amount` sale de quoteWithMarkup sobre el precio
// REAL de la oferta releída del server: nunca se usa un importe que mande el
// navegador, porque ahí es donde se puede alterar el precio.
//
// `type: 'balance'` (no 'card') es lo que corresponde a Managed Content cuando
// el cobro se hace con la tarjeta del cliente vía Duffel Cards.
async function createOrder(input) {
  const offer = await getOffer(input.offerId);
  const passengers = (Array.isArray(input.passengers) ? input.passengers : []).map(normalizePassenger);
  if (!passengers.length) {
    const error = new Error('El viaje necesita al menos un pasajero.');
    error.status = 400;
    throw error;
  }
  // Los ids de pasajero tienen que pertenecer a esta oferta: si no, Duffel
  // rechaza la orden y habríamos cobrado de más o de menos.
  const validIds = new Set((Array.isArray(offer.passengers) ? offer.passengers : [])
    .map(function (item) { return item && item.id; }).filter(Boolean));
  passengers.forEach(function (passenger) {
    if (!validIds.has(passenger.id)) {
      const error = new Error('Los datos del pasajero no coinciden con la tarifa.');
      error.status = 400;
      throw error;
    }
  });
  const quote = quoteWithMarkup(offer.total_amount, offer.total_currency);
  const payload = {
    data: {
      selected_offers: [offer.id],
      passengers: passengers,
      payments: [{
        type: 'balance',
        currency: quote.currency,
        amount: quote.charge_amount
      }]
    }
  };
  const threeDSecureSessionId = String(input.threeDSecureSessionId || '').trim();
  if (threeDSecureSessionId) payload.data.payments[0].three_d_secure_session_id = threeDSecureSessionId;
  const cardId = String(input.cardId || '').trim();
  if (!cardId) {
    const error = new Error('No se recibió la tarjeta.');
    error.status = 400;
    throw error;
  }
  const created = await requestJson('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const order = created && created.data;
  return {
    order_id: order && order.id || null,
    booking_reference: order && order.booking_reference || null,
    status: order && order.identifier || 'confirmed',
    quote: quote
  };
}

module.exports = {
  isConfigured, setFetch, styleCabins, resolvePlace, mapOffer, searchFlights,
  markupConfig, quoteWithMarkup, roundHalfAwayFromZero, cardComponents,
  createClientKey, getOffer, normalizePassenger, createOrder
};
