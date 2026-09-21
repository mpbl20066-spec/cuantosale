'use strict';
/*
 * Alojamiento con la Demand API de Booking.com (v3.1).
 *
 * Flujo que usa esta app ("buscar, mirar y redirigir a reservar"):
 *   1. POST /accommodations/search   -> propiedades disponibles con precio total de la estadía y `url`
 *                                       (enlace a la propiedad en Booking.com con TU ID de afiliado y las fechas)
 *   2. POST /accommodations/details  -> nombre y estrellas de esas propiedades
 *   3. La persona toca "Reservar" y termina la compra en Booking.com (así se paga la comisión de afiliado).
 *
 * Crear la reserva dentro de esta app (/orders/preview y /orders/create) es otro tipo de integración
 * ("buscar, mirar y reservar") que Booking.com habilita aparte y exige manejar pagos y datos de huéspedes.
 * No está incluido.
 *
 * Variables de entorno:
 *   BOOKING_API_KEY        token de la Demand API (Bearer)
 *   BOOKING_AFFILIATE_ID   tu ID de afiliado (número). También sirve HOTEL_AFFILIATE_ID.
 *   BOOKING_API_BASE       por defecto producción; para pruebas: https://demandapi-sandbox.booking.com/3.1
 *   BOOKING_CITY_IDS       JSON { "fln": <id de ciudad>, ... } (ver scripts/booking-cities.js). Sin esto se busca por aeropuerto.
 *   BOOKING_FX             JSON con tipos de cambio a US$ si Booking devuelve otra moneda, ej: {"BRL":0.18}
 */
const { buildUrl } = require('./booking');

const DEFAULT_BASE = 'https://demandapi.booking.com/3.1';
// Enlace de respaldo (búsqueda en Booking.com) cuando la API no está configurada o falla
const DEFAULT_HOTEL_TEMPLATE =
  'https://www.booking.com/searchresults.html?ss={dest_name}&checkin={dep}&checkout={ret}&group_adults={pax}&no_rooms={rooms}&aid={affiliate}';

function affiliateId(env) { return String((env || process.env).BOOKING_AFFILIATE_ID || (env || process.env).HOTEL_AFFILIATE_ID || ''); }
function isConfigured(env) { env = env || process.env; return !!(env.BOOKING_API_KEY && /^\d+$/.test(affiliateId(env))); }
function parseJson(text) { try { return text ? JSON.parse(text) : null; } catch (e) { return null; } }

function hotelBookingUrl(p, env) {
  env = env || process.env;
  return buildUrl(env.HOTEL_URL_TEMPLATE || DEFAULT_HOTEL_TEMPLATE,
    { dest_name: p.destName, dep: p.dep, ret: p.ret, pax: p.pax, rooms: p.rooms }, affiliateId(env));
}

async function post(path, body, o) {
  const env = o.env || process.env, fetchImpl = o.fetchImpl || fetch;
  const res = await fetchImpl(String(env.BOOKING_API_BASE || DEFAULT_BASE).replace(/\/+$/, '') + path, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.BOOKING_API_KEY,
      'X-Affiliate-Id': affiliateId(env),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body),
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* sin JSON */ }
  if (!res.ok) {
    const first = json && json.errors && json.errors[0];
    const err = new Error('Booking HTTP ' + res.status + ': ' + ((first && (first.message || first.code)) || 'sin detalle'));
    err.status = res.status; throw err;
  }
  return json || {};
}

/** Destino de la búsqueda: por ciudad si la configuraste; si no, por aeropuerto cercano. */
function destinationFor(destKey, cfg, env) {
  const ids = parseJson((env || process.env).BOOKING_CITY_IDS);
  if (ids && Number(ids[destKey])) return { city: Number(ids[destKey]) };
  return { airport: cfg.bookingAirport };
}

function toUsd(amount, currency, env) {
  const c = String(currency || '').toUpperCase();
  if (c === 'USD') return amount;
  const fx = parseJson((env || process.env).BOOKING_FX);
  const rate = fx ? Number(fx[c]) : 0;
  return rate > 0 ? amount * rate : null;
}

/** Categoría según estrellas: 0 económico (hasta 2), 1 intermedio (3), 2 confort (4 o más). */
function tierForStars(stars) { return stars <= 2 ? 0 : (stars === 3 ? 1 : 2); }

/**
 * Une búsqueda + detalles. Devuelve propiedades con precio total en US$ y categoría.
 * Si no hay estrellas (dato faltante), se reparte por terciles de precio.
 */
function normalize(searchJson, detailsJson, env) {
  const details = {};
  ((detailsJson && detailsJson.data) || []).forEach(function (d) {
    const name = d.name ? (d.name.es || d.name['es-es'] || d.name['en-gb'] || d.name['en-us'] || Object.values(d.name)[0]) : null;
    const r = d.rating || {};
    details[d.id] = { name: name, stars: Number(r.stars) > 0 ? Number(r.stars) : null,
      score: r.review_score == null ? null : Number(r.review_score), reviews: r.number_of_reviews == null ? null : Number(r.number_of_reviews) };
  });
  const list = [];
  ((searchJson && searchJson.data) || []).forEach(function (h) {
    const total = toUsd(Number(h.price && h.price.total), h.currency, env);
    const url = typeof h.url === 'string' && /^https:\/\//i.test(h.url) ? h.url : null;
    const d = details[h.id];
    if (!(total > 0) || !url || !d || !d.name) return;
    list.push({ id: 'bk_' + h.id, accommodationId: h.id, name: d.name, stars: d.stars, reviewScore: d.score, reviews: d.reviews, total: total, url: url, tier: null });
  });
  const byPrice = list.slice().sort(function (a, b) { return a.total - b.total; });
  list.forEach(function (p) {
    if (p.stars) { p.tier = tierForStars(p.stars); return; }
    const pos = byPrice.indexOf(p) / Math.max(byPrice.length, 1);
    p.tier = pos < 1 / 3 ? 0 : (pos < 2 / 3 ? 1 : 2);
  });
  return list;
}

/** Como mucho 2 propiedades por categoría: las más baratas con buenas opiniones (o las más baratas si no hay puntaje). */
function pickPerTier(list) {
  const out = [];
  [0, 1, 2].forEach(function (t) {
    let g = list.filter(function (p) { return p.tier === t; }).sort(function (a, b) { return a.total - b.total; });
    const good = g.filter(function (p) { return p.reviewScore == null || p.reviewScore >= 6.5; });
    if (good.length) g = good;
    out.push.apply(out, g.slice(0, 2));
  });
  return out;
}

/**
 * Busca propiedades disponibles con precio real.
 * @param p { destKey, cfg, dep, ret, pax, rooms, platform?, env?, fetchImpl? }
 */
async function searchProperties(p) {
  const env = p.env || process.env;
  const body = Object.assign({}, destinationFor(p.destKey, p.cfg, env), {
    booker: { country: 'uy', platform: p.platform || 'desktop' },
    checkin: p.dep, checkout: p.ret,
    guests: { number_of_adults: p.pax, number_of_rooms: p.rooms },
    currency: 'USD', dormitories: 'exclude', rows: 100
  });
  const search = await post('/accommodations/search', body, p);
  const ids = ((search && search.data) || []).map(function (h) { return h.id; }).filter(Boolean).slice(0, 100);
  if (!ids.length) return [];
  const details = await post('/accommodations/details', { accommodations: ids, languages: ['es', 'en-gb'] }, p);
  return pickPerTier(normalize(search, details, env));
}

/** Objeto de proveedor: siempre trae bookingUrl (búsqueda de respaldo en Booking.com). */
async function getHotelQuote(p) {
  return { source: 'estimado', bookingUrl: hotelBookingUrl(p) };
}

module.exports = { getHotelQuote, hotelBookingUrl, searchProperties, normalize, pickPerTier, tierForStars, isConfigured, DEFAULT_HOTEL_TEMPLATE };
