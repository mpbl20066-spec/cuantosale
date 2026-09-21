'use strict';
/*
 * Adaptador de vuelos con Duffel (https://duffel.com/docs/api/offer-requests).
 *
 * Hace una búsqueda ida y vuelta para 1 adulto en clase económica y devuelve el
 * precio MÁS BAJO por persona en US$. El server lo multiplica por la cantidad de viajeros.
 *
 * Requiere la variable DUFFEL_TOKEN (token de tu cuenta Duffel, nunca en el frontend).
 */

const crypto = require('crypto');
const { buildUrl } = require('./booking');

const ENDPOINT = 'https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=15000';

// Duffel es una API de reservas, no un programa de afiliados: no entrega un link de compra.
// Por eso el bookingUrl de un vuelo sale de una plantilla que vos configurás (FLIGHT_URL_TEMPLATE)
// con el enlace de tu programa de afiliados de vuelos. Por defecto abre una búsqueda en Google Flights (sin comisión).
const DEFAULT_FLIGHT_TEMPLATE =
  'https://www.google.com/travel/flights?q=Flights%20from%20{origin}%20to%20{destination}%20on%20{dep}%20through%20{ret}';

/** Enlace para que la persona reserve este vuelo en el sitio de tu socio de afiliados. */
function flightBookingUrl(p, env) {
  env = env || process.env;
  return buildUrl(env.FLIGHT_URL_TEMPLATE || DEFAULT_FLIGHT_TEMPLATE,
    { origin: p.origin, destination: p.destination, dep: p.dep, ret: p.ret, pax: p.pax || 1 }, env.FLIGHT_AFFILIATE_ID);
}

/** Convierte a US$. Si la aerolínea cotiza en otra moneda, hace falta un tipo de cambio en DUFFEL_FX. */
function toUsd(amount, currency, fx) {
  const c = String(currency || '').toUpperCase();
  if (c === 'USD') return amount;
  const rate = fx ? Number(fx[c]) : 0;
  return rate > 0 ? amount * rate : null;
}

/** Elige la oferta más barata de la respuesta de Duffel y la resume. */
function parseOffers(json, fx) {
  const offers = json && json.data && Array.isArray(json.data.offers) ? json.data.offers : [];
  let best = null;
  offers.forEach(function (o) {
    const usd = toUsd(Number(o.total_amount), o.total_currency, fx);
    if (usd > 0 && (!best || usd < best.usd)) best = { usd: usd, offer: o };
  });
  if (!best) return null;

  const o = best.offer;
  const segs = function (s) { return s && Array.isArray(s.segments) ? s.segments : []; };
  const out = segs(o.slices && o.slices[0]);
  const back = segs(o.slices && o.slices[1]);
  const day = function (seg) { return seg && seg.departing_at ? String(seg.departing_at).slice(0, 10) : null; };

  return {
    pp: Math.round(best.usd),
    airline: (o.owner && o.owner.name) || null,
    transfers: Math.max(out.length - 1, back.length - 1, 0),
    exact: true,
    foundDep: day(out[0]),
    foundRet: day(back[0]),
    expiresAt: o.expires_at || null,
    source: 'duffel'
  };
}

/**
 * @param {object} p  { token, origin, destination, dep, ret, fx?, maxConnections?, fetchImpl? }
 * @returns {Promise<object|null>} quote o null si no hay ofertas
 */
async function getFlightQuote(p) {
  const fetchImpl = p.fetchImpl || fetch;
  const data = {
    slices: [
      { origin: p.origin, destination: p.destination, departure_date: p.dep },
      { origin: p.destination, destination: p.origin, departure_date: p.ret }
    ],
    passengers: [{ type: 'adult' }],
    cabin_class: 'economy'
  };
  if (p.maxConnections !== undefined && p.maxConnections !== null && p.maxConnections !== '') {
    data.max_connections = Number(p.maxConnections);
  }

  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + p.token,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ data: data }),
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined
  });

  let json = null;
  try { json = await res.json(); } catch (e) { /* respuesta sin JSON */ }

  if (!res.ok) {
    const msg = json && json.errors && json.errors[0] ? (json.errors[0].message || json.errors[0].title) : 'sin detalle';
    const err = new Error('Duffel HTTP ' + res.status + ': ' + msg);
    err.status = res.status;
    throw err;
  }
  const quote = parseOffers(json, p.fx);
  if (quote) quote.bookingUrl = flightBookingUrl(p);
  return quote;
}



/* =====================================================================
 * Reserva de vuelos con Duffel Links (checkout alojado por Duffel)
 *
 * Duffel arma la página donde la persona busca, elige la tarifa, carga los datos de los pasajeros y
 * paga. Nosotros no tocamos datos de pasajeros ni de tarjetas. Al terminar, Duffel vuelve a
 * success_url con ?order_id=...&reference=... (y a failure_url o abandonment_url si no se concreta).
 *
 * Requisitos: DUFFEL_TOKEN, PUBLIC_BASE_URL (la URL pública de tu sitio) y una cuenta de Duffel
 * en un país compatible con Duffel Payments.
 * ===================================================================== */
const LINKS_ENDPOINT = 'https://api.duffel.com/links/sessions';

function linksEnabled(env) {
  env = env || process.env;
  return !!(env.DUFFEL_TOKEN && env.PUBLIC_BASE_URL && String(env.FLIGHT_BOOKING_MODE || 'links').toLowerCase() === 'links');
}

function secret(env) { env = env || process.env; return env.SESSION_SECRET || env.DUFFEL_TOKEN || ''; }
function sign(text, env) { return crypto.createHmac('sha256', secret(env)).update(text).digest('hex').slice(0, 16); }

/** Referencia firmada: cuenta qué búsqueda originó la reserva y evita que se consulten órdenes ajenas. */
function makeReference(ctx, env) {
  const body = [ctx.dest, String(ctx.dep).replace(/-/g, ''), String(ctx.ret).replace(/-/g, ''), ctx.pax,
    crypto.randomBytes(4).toString('hex')].join('-');
  return body + '.' + sign(body, env);
}
function verifyReference(ref, env) {
  if (typeof ref !== 'string' || !/^[a-z]{2,4}-\d{8}-\d{8}-\d{1,2}-[0-9a-f]{8}\.[0-9a-f]{16}$/.test(ref)) return false;
  const i = ref.lastIndexOf('.');
  const a = Buffer.from(sign(ref.slice(0, i), env)), b = Buffer.from(ref.slice(i + 1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Crea una sesión de Duffel Links y devuelve la URL a la que hay que mandar a la persona. */
async function createLinkSession(p) {
  const env = p.env || process.env, fetchImpl = p.fetchImpl || fetch;
  const base = String(env.PUBLIC_BASE_URL).replace(/\/+$/, '');
  const data = {
    reference: p.reference,
    success_url: base + '/gracias.html',
    failure_url: base + '/gracias.html?estado=fallo',
    abandonment_url: base + '/?volver=reserva',
    logo_url: base + '/logo.svg',
    primary_color: '#10233E',
    traveller_currency: 'USD',
    flights: { enabled: 'true' },
    stays: { enabled: 'false' }
  };
  // Tu comisión: Duffel permite sumar un recargo a las tarifas (ver "markup" en la guía de Duffel Links)
  if (env.DUFFEL_MARKUP_AMOUNT) { data.markup_amount = String(env.DUFFEL_MARKUP_AMOUNT); data.markup_currency = 'USD'; }
  if (env.DUFFEL_MARKUP_RATE) { data.markup_rate = String(env.DUFFEL_MARKUP_RATE); if (!data.markup_currency) data.markup_currency = 'USD'; }

  const res = await fetchImpl(LINKS_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.DUFFEL_TOKEN, 'Duffel-Version': 'v2', 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ data: data }),
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* sin JSON */ }
  if (!res.ok) {
    const msg = json && json.errors && json.errors[0] ? (json.errors[0].message || json.errors[0].title) : 'sin detalle';
    const err = new Error('Duffel Links HTTP ' + res.status + ': ' + msg); err.status = res.status; throw err;
  }
  const url = json && json.data && json.data.url;
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('Duffel Links no devolvió una URL válida');
  return url;
}

/** Datos de una orden ya creada (para la página de confirmación). */
async function getOrder(p) {
  const env = p.env || process.env, fetchImpl = p.fetchImpl || fetch;
  if (!/^ord_[A-Za-z0-9]+$/.test(String(p.orderId))) { const e = new Error('Orden no válida'); e.status = 400; throw e; }
  const res = await fetchImpl('https://api.duffel.com/air/orders/' + p.orderId, {
    headers: { 'Authorization': 'Bearer ' + env.DUFFEL_TOKEN, 'Duffel-Version': 'v2', 'Accept': 'application/json' },
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* sin JSON */ }
  if (!res.ok) { const err = new Error('Duffel HTTP ' + res.status); err.status = res.status; throw err; }
  const o = (json && json.data) || {};
  return {
    bookingReference: o.booking_reference || null,
    airline: (o.owner && o.owner.name) || null,
    total: o.total_amount ? Number(o.total_amount) : null,
    currency: o.total_currency || null,
    passengers: Array.isArray(o.passengers) ? o.passengers.length : null,
    slices: (Array.isArray(o.slices) ? o.slices : []).map(function (s) {
      const seg = s.segments && s.segments[0];
      return { origin: s.origin && s.origin.iata_code, destination: s.destination && s.destination.iata_code,
        departingAt: seg && seg.departing_at ? String(seg.departing_at) : null };
    })
  };
}

module.exports = { getFlightQuote, parseOffers, toUsd, flightBookingUrl, DEFAULT_FLIGHT_TEMPLATE,
  linksEnabled, makeReference, verifyReference, createLinkSession, getOrder };
