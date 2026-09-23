'use strict';

const crypto = require('crypto');
const net = require('net');

const API = 'https://api.travelpayouts.com/v1';
const searches = new Map();
const hourlySearches = new Map();
let fetchImpl = null;

function config() {
  return {
    token: process.env.TRAVELPAYOUTS_API_TOKEN || '',
    marker: process.env.TRAVELPAYOUTS_MARKER || '',
    host: String(process.env.TRAVELPAYOUTS_HOST || '').trim().toLowerCase()
  };
}
function isConfigured() {
  const c = config();
  return !!(c.token && c.marker && c.host && c.host !== 'localhost' && c.host !== '127.0.0.1');
}
function setFetch(fn) { fetchImpl = fn; }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
function publicClientIp(value) {
  const ip = String(value || '').trim().replace(/^::ffff:/i, '');
  if (!net.isIP(ip)) return false;
  const lower = ip.toLowerCase();
  if (net.isIPv4(ip)) {
    const octets = ip.split('.').map(Number);
    const a = octets[0], b = octets[1];
    const reserved = a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) || (a === 192 && b === 2) || (a === 198 && (b === 18 || b === 19)) ||
      (a === 203 && b === 0);
    return !reserved;
  }
  return lower !== '::1' && lower !== '0:0:0:0:0:0:0:1' && lower !== '::' &&
    !lower.startsWith('fe80:') && !lower.startsWith('fc') && !lower.startsWith('fd') && !lower.startsWith('ff');
}
function enforceProviderLimit(ip) {
  const now = Date.now();
  let bucket = hourlySearches.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + 60 * 60 * 1000 };
    hourlySearches.set(ip, bucket);
  }
  if (bucket.count >= 200) {
    const error = new Error('Se alcanzó el límite horario de búsquedas de vuelos. Intentá más tarde.');
    error.status = 429;
    throw error;
  }
  bucket.count++;
  if (hourlySearches.size > 5000) {
    hourlySearches.forEach(function (entry, key) { if (now >= entry.resetAt) hourlySearches.delete(key); });
  }
}
function buildSignature(p, credentials) {
  const parts = [credentials.token, p.host, p.locale, credentials.marker,
    String(p.passengers.adults), String(p.passengers.children), String(p.passengers.infants)];
  p.segments.forEach(function (segment) {
    parts.push(segment.date, segment.destination, segment.origin);
  });
  parts.push(p.trip_class, p.user_ip);
  return crypto.createHash('md5').update(parts.join(':')).digest('hex');
}
function parseJson(res, label) {
  return res.json().catch(function () { throw new Error(label + ': respuesta JSON inválida.'); });
}
async function requestJson(url, options, fetcher, label) {
  const res = await fetcher(url, Object.assign({ signal: AbortSignal.timeout(15000) }, options || {}));
  const json = await parseJson(res, label);
  if (!res.ok) {
    const err = new Error(label + ' (HTTP ' + res.status + '): ' + String(json && (json.error || json.message) || 'sin detalle').slice(0, 300));
    err.status = res.status;
    throw err;
  }
  return json;
}
function timeValue(flight, field, dateField) {
  const timestamp = Number(flight && flight[field]);
  if (Number.isFinite(timestamp) && timestamp > 0) return new Date(timestamp * 1000).toISOString();
  const date = String(flight && flight[dateField] || '');
  const time = String(flight && (field === 'local_departure_timestamp' ? flight.departure_time : flight.arrival_time) || '');
  return date && time ? date + 'T' + time + ':00' : null;
}
function airport(code, airports) {
  const item = airports && airports[code] || {};
  return { code: String(code || ''), name: item.name || item.city || String(code || '') };
}
function durationText(minutes) {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60), rest = total % 60;
  return (hours ? hours + ' h' : '') + (hours && rest ? ' ' : '') + (rest ? rest + ' min' : '') || null;
}
function fxTable() {
  try { return JSON.parse(process.env.TRAVELPAYOUTS_FX || '{}'); } catch (e) { return {}; }
}
function convertUsd(amount, currency) {
  const value = Number(amount);
  const code = String(currency || '').toUpperCase();
  if (!Number.isFinite(value) || value <= 0) return null;
  if (code === 'USD') return Math.round(value * 100) / 100;
  const rate = Number(fxTable()[code]);
  return rate > 0 ? Math.round(value * rate * 100) / 100 : null;
}
function mapResults(payload, searchId, cabinClass) {
  const groups = Array.isArray(payload) ? payload : (Array.isArray(payload && payload.results) ? payload.results : []);
  const output = [];
  groups.forEach(function (group, groupIndex) {
    if (!group || !Array.isArray(group.proposals)) return;
    const airports = group.airports || {};
    const airlines = group.airlines || {};
    group.proposals.forEach(function (proposal, proposalIndex) {
      const legs = Array.isArray(proposal.segment) ? proposal.segment : [];
      if (!legs.length) return;
      const fareTerms = proposal.terms && typeof proposal.terms === 'object' ? proposal.terms : {};
      Object.keys(fareTerms).forEach(function (gateId) {
        const term = fareTerms[gateId];
        if (!term || term.url == null || !Number.isFinite(Number(term.price))) return;
        const flightsByLeg = legs.map(function (leg) { return Array.isArray(leg.flight) ? leg.flight : []; });
        const outboundFlights = flightsByLeg[0] || [];
        const inboundFlights = flightsByLeg[1] || [];
        const firstOut = outboundFlights[0] || {};
        const lastOut = outboundFlights[outboundFlights.length - 1] || firstOut;
        const firstIn = inboundFlights[0] || {};
        const lastIn = inboundFlights[inboundFlights.length - 1] || firstIn;
        const airlineCode = proposal.validating_carrier || firstOut.marketing_carrier || firstOut.operating_carrier || '';
        const airline = airlines[airlineCode] && airlines[airlineCode].name || airlineCode || 'Aerolínea';
        const price = Number(term.price);
        const currency = String(term.currency || '').toUpperCase();
        const termCode = String(term.url);
        const outDuration = outboundFlights.reduce(function (sum, flight) { return sum + (Number(flight.duration) || 0); }, 0);
        const inDuration = inboundFlights.reduce(function (sum, flight) { return sum + (Number(flight.duration) || 0); }, 0);
        const makeLeg = function (flights, first, last) {
          return {
            origin: airport(first.departure, airports), destination: airport(last.arrival, airports),
            departure: timeValue(first, 'local_departure_timestamp', 'departure_date'),
            arrival: timeValue(last, 'local_arrival_timestamp', 'arrival_date'),
            flight_number: String(first.marketing_carrier || first.operating_carrier || '') + String(first.number || ''),
            airline: airlines[first.marketing_carrier || first.operating_carrier] && airlines[first.marketing_carrier || first.operating_carrier].name || airline,
            stops: Math.max(flights.length - 1, 0), duration: durationText(flights.reduce(function (sum, flight) { return sum + (Number(flight.duration) || 0); }, 0))
          };
        };
        const outbound = makeLeg(outboundFlights, firstOut, lastOut);
        const inbound = inboundFlights.length ? makeLeg(inboundFlights, firstIn, lastIn) : null;
        const id = [searchId, groupIndex, proposal.sign || proposalIndex, gateId].join('-');
        output.push({
          id: id, provider: 'travelpayouts', search_id: searchId, affiliate_term: termCode,
          airline: airline, agency: group.gates_info && group.gates_info[gateId] && group.gates_info[gateId].label || 'Agencia de viajes',
          logo: airlineCode ? 'https://img.wway.io/pics/root/' + encodeURIComponent(airlineCode) + '@png?exar=1&rs=fit:80:80' : null,
          cabin_class: cabinClass || 'economy', cabin_label: cabinClass === 'business' ? 'Business' : 'Economy',
          departure: outbound.departure, arrival: outbound.arrival,
          return_departure: inbound && inbound.departure || null, return_arrival: inbound && inbound.arrival || null,
          departure_airport: outbound.origin, arrival_airport: outbound.destination,
          flight_number: outbound.flight_number, stops: outbound.stops + (inbound ? inbound.stops : 0),
          duration: [durationText(outDuration), inbound ? durationText(inDuration) : null].filter(Boolean).join(' + '),
          price_usd: convertUsd(price, currency), original_price: String(price), original_currency: currency,
          trip_type: inbound ? 'round_trip' : 'one_way', outbound: outbound, inbound: inbound,
          recommendation: proposal.is_direct ? 'Vuelo directo' : 'Opción disponible'
        });
      });
    });
  });
  return output.sort(function (a, b) {
    if (a.price_usd != null && b.price_usd != null) return a.price_usd - b.price_usd;
    if (a.price_usd != null) return -1;
    if (b.price_usd != null) return 1;
    if (a.original_currency === b.original_currency) return Number(a.original_price) - Number(b.original_price);
    return 0;
  });
}
async function searchFlights(input) {
  const c = config();
  if (!c.token || !c.marker || !c.host) {
    const error = new Error('Falta configurar TRAVELPAYOUTS_API_TOKEN, TRAVELPAYOUTS_MARKER y TRAVELPAYOUTS_HOST.');
    error.status = 503;
    throw error;
  }
  if (!publicClientIp(input.userIp)) {
    const error = new Error('La búsqueda real requiere un dominio público y la IP pública del visitante; Travelpayouts no admite localhost.');
    error.status = 503;
    throw error;
  }
  enforceProviderLimit(input.userIp);
  const segments = [{ origin: input.origin, destination: input.destination, date: input.departureDate }];
  if (input.returnDate) segments.push({ origin: input.destination, destination: input.origin, date: input.returnDate });
  const request = {
    host: c.host, locale: 'es', marker: c.marker, user_ip: input.userIp,
    trip_class: input.tripClass || 'Y', passengers: { adults: input.passengers, children: 0, infants: 0 }, segments: segments
  };
  request.signature = buildSignature(request, c);
  const fetcher = fetchImpl || fetch;
  const started = await requestJson(API + '/flight_search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(request)
  }, fetcher, 'Travelpayouts no pudo iniciar la búsqueda');
  const searchId = String(started && (started.search_id || started.uuid || started.meta && started.meta.uuid) || '');
  if (!/^[a-f0-9-]{16,64}$/i.test(searchId)) throw new Error('Travelpayouts no devolvió el identificador de búsqueda.');

  let results = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    const url = new URL(API + '/flight_search_results');
    url.searchParams.set('uuid', searchId);
    const response = await requestJson(url.toString(), { headers: { Accept: 'application/json' } }, fetcher, 'Travelpayouts no pudo obtener resultados');
    results = Array.isArray(response) ? response : (Array.isArray(response && response.results) ? response.results : []);
    const complete = results.some(function (item) { return item && item.search_id === searchId && Object.keys(item).length === 1; });
    if (complete) break;
    if (attempt < 9) await new Promise(function (resolve) { setTimeout(resolve, 700); });
  }
  const offers = mapResults(results, searchId, request.trip_class === 'C' ? 'business' : 'economy');
  const allowedTerms = new Set(offers.map(function (offer) { return offer.affiliate_term; }));
  searches.set(searchId, { expiresAt: Date.now() + 15 * 60 * 1000, terms: allowedTerms });
  if (searches.size > 500) {
    const now = Date.now();
    searches.forEach(function (entry, key) { if (entry.expiresAt <= now) searches.delete(key); });
    while (searches.size > 500) searches.delete(searches.keys().next().value);
  }
  return { search_id: searchId, offers: offers };
}
async function getAffiliateUrl(searchId, termCode) {
  const c = config();
  const id = String(searchId || '');
  const code = String(termCode || '');
  const entry = searches.get(id);
  if (!entry || entry.expiresAt <= Date.now() || !entry.terms.has(code)) {
    const error = new Error('La tarifa venció. Volvé a buscar para obtener un enlace actualizado.');
    error.status = 410;
    throw error;
  }
  const url = API + '/flight_searches/' + encodeURIComponent(id) + '/clicks/' + encodeURIComponent(code) + '.json?marker=' + encodeURIComponent(c.marker);
  const result = await requestJson(url, { headers: { Accept: 'application/json' } }, fetchImpl || fetch, 'Travelpayouts no pudo crear el enlace de compra');
  if (!result || typeof result.url !== 'string' || !/^https:\/\//i.test(result.url)) throw new Error('Travelpayouts no devolvió un enlace de compra seguro.');
  return result.url;
}

module.exports = { isConfigured, setFetch, searchFlights, getAffiliateUrl, mapResults, buildSignature };
