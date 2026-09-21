'use strict';
/*
 * Servidor de CuántoSale. Sin dependencias: solo Node 18 o superior.
 *
 *   node server.js            -> http://localhost:3000
 *
 * Variables (en el entorno o en un archivo .env):
 *   DUFFEL_TOKEN          token de Duffel. Sin esto corre en modo demo.
 *   PORT                  puerto (por defecto 3000)
 *   QUOTE_TTL_MIN         minutos que se recuerda un precio de vuelo (por defecto 60)
 *   DUFFEL_FX             JSON con tipos de cambio a US$ para otras monedas, ej: {"EUR":1.08}
 *   DUFFEL_MAX_CONNECTIONS  0, 1 o 2 escalas máximas (por defecto lo decide Duffel)
 *   RATE_LIMIT_PER_MIN    pedidos por minuto por IP a /api/cotizar (por defecto 30)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Duffel } = require('@duffel/api');

function loadEnv() {
  try {
    fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (line) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  } catch (e) { /* no hay .env: está bien */ }
}
loadEnv();

const model = require('./lib/model');
const providers = require('./lib/providers');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://emrldco.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://emrldco.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://emrldco.com https://*.emrldco.com; base-uri 'none'; form-action 'self'";
const DUFFEL_DESTINATIONS = { buz: 'GIG', rio: 'GIG', fln: 'FLN', sao: 'GRU', ssa: 'SSA', igu: 'IGU', rec: 'REC', for: 'FOR', mcz: 'MCZ', nat: 'NAT', pip: 'NAT', poa: 'POA' };
const transferOrders = new Map();
function roadtripCost(key, kmPerLiter) {
  const fuelPrice = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;
  return model.roadtripCost(key, kmPerLiter, fuelPrice);
}
function transferConfig(destKey, pax) {
  const unit = Number(process.env.OFFICIAL_TRANSFER_PRICE_USD) || 35;
  return { pricePerPassenger: unit, amount: unit * Math.max(1, Number(pax) || 1), destination: destKey, bank: { bank: 'Prex', account: '361333', holder: 'Maria Paola Batista' } };
}

/* ---------- límite de pedidos por IP ---------- */
const hits = new Map();
function limited(ip) {
  const max = Number(process.env.RATE_LIMIT_PER_MIN) || 30;
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now > h.reset) { h = { n: 0, reset: now + 60000 }; hits.set(ip, h); }
  h.n++;
  if (hits.size > 5000) { hits.forEach(function (v, k) { if (now > v.reset) hits.delete(k); }); }
  return h.n > max;
}
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0].trim() : req.socket.remoteAddress) || 'x';
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function readJson(req, maxBytes) {
  maxBytes = maxBytes || 32768;
  return new Promise(function (resolve, reject) {
    let body = '', size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > maxBytes) { const e = new Error('El cuerpo del pedido es demasiado grande.'); e.status = 413; reject(e); req.destroy(); return; }
      body += chunk;
    });
    req.on('end', function () {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { e.status = 400; e.message = 'El cuerpo debe ser JSON válido.'; reject(e); }
    });
    req.on('error', reject);
  });
}

function registrarTransferencia(req, res, body) {
  body = body && typeof body === 'object' ? body : {};
  const amount = Number(body.amount);
  const file = body.receipt;
  if (!Number.isFinite(amount) || amount <= 0 || !file || !file.data) {
    return sendJson(res, 400, { error: 'Adjuntá el comprobante de transferencia.' });
  }
  if (String(file.data).length > 6e6) return sendJson(res, 413, { error: 'El comprobante supera el tamaño máximo permitido.' });
  const order = 'TRF-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  transferOrders.set(order, { order: order, status: 'Pendiente de verificación', amount: Math.round(amount), receipt: { name: String(file.name || 'comprobante'), type: String(file.type || 'application/octet-stream'), data: String(file.data) }, createdAt: new Date().toISOString(), destination: String(body.destination || '') });
  return sendJson(res, 201, { ok: true, order: order, status: 'Pendiente de verificación', message: '¡Reserva de traslado registrada con éxito! En menos de 2 horas validaremos tu comprobante y te enviaremos el voucher definitivo por correo electrónico.' });
}

function durationLabel(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(String(value || ''));
  if (!match) return value || null;
  const hours = Number(match[1] || 0), minutes = Number(match[2] || 0);
  return (hours ? hours + ' h' : '') + (hours && minutes ? ' ' : '') + (minutes ? minutes + ' min' : '');
}

function duffelClient() {
  const token = process.env.DUFFEL_ACCESS_TOKEN || process.env.DUFFEL_TOKEN;
  return token ? new Duffel({ token: token }) : null;
}

function usdAmount(amount, currency) {
  if (String(currency).toUpperCase() === 'USD') return Number(amount);
  try {
    const rates = JSON.parse(process.env.DUFFEL_FX || '{}');
    const rate = Number(rates[String(currency).toUpperCase()]);
    return rate > 0 ? Number(amount) * rate : null;
  } catch (e) { return null; }
}

function formatOffers(offers) {
  return (offers || []).map(function (offer) {
    const slice = offer.slices && offer.slices[0] || {};
    const segments = Array.isArray(slice.segments) ? slice.segments : [];
    const first = segments[0] || {}, last = segments[segments.length - 1] || {};
    const carrier = first.marketing_carrier || first.operating_carrier || offer.owner || {};
    const priceUsd = usdAmount(offer.total_amount, offer.total_currency);
    const formatted = {
      id: offer.id,
      passenger_ids: Array.isArray(offer.passengers) ? offer.passengers.map(function (p) { return p.id; }).filter(Boolean) : [],
      airline: carrier.name || 'Aerolínea',
      logo: carrier.logo_symbol_url || carrier.logo_lockup_url || null,
      departure: first.departing_at || null,
      arrival: last.arriving_at || null,
      stops: Math.max(segments.length - 1, 0),
      duration: durationLabel(slice.duration),
      price_usd: priceUsd === null ? null : Math.round(priceUsd * 100) / 100,
      original_price: String(offer.total_amount || ''),
      original_currency: offer.total_currency || null
    };
    const departureAirport = { code: first.origin && first.origin.iata_code || '', name: first.origin && first.origin.name || '' };
    const arrivalAirport = { code: last.destination && last.destination.iata_code || '', name: last.destination && last.destination.name || '' };
    if (departureAirport.code || departureAirport.name) formatted.departure_airport = departureAirport;
    if (arrivalAirport.code || arrivalAirport.name) formatted.arrival_airport = arrivalAirport;
    if (!formatted.passenger_ids.length) delete formatted.passenger_ids;
    return formatted;
  }).filter(function (offer) { return offer.departure && offer.arrival; }).sort(function (a, b) {
    return (a.price_usd === null ? Infinity : a.price_usd) - (b.price_usd === null ? Infinity : b.price_usd);
  });
}

async function buscarVuelos(req, res, body) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const origin = String(body.origen || '').toUpperCase();
  const destination = DUFFEL_DESTINATIONS[String(body.destino || '').toLowerCase()];
  const date = String(body.fecha_ida || '');
  const returnDate = String(body.fecha_vuelta || '');
  const passengers = Number(body.pasajeros);
  const style = ['ahorro', 'eq', 'comodo'].includes(String(body.style || '').toLowerCase()) ? String(body.style).toLowerCase() : 'eq';
  const cabinClass = style === 'comodo' ? 'premium_economy' : 'economy';
  if (!/^[A-Z]{3}$/.test(origin) || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) || !Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return sendJson(res, 400, { error: 'Datos de búsqueda de vuelo inválidos.' });
  }
  if (!process.env.DUFFEL_ACCESS_TOKEN) return sendJson(res, 503, { error: 'La búsqueda de vuelos no está configurada todavía.' });

  try {
    const duffel = duffelClient();
    const slices = [{ origin: origin, destination: destination, departure_date: date }];
    if (returnDate) slices.push({ origin: destination, destination: origin, departure_date: returnDate });
    const adultPassengers = Array.from({ length: passengers }, function () { return { type: 'adult' }; });
    const cabinCandidates = style === 'comodo' ? ['premium_economy', 'economy'] : ['economy'];
    let request = null;
    let usedCabinClass = cabinCandidates[0];
    let lastError = null;
    for (let i = 0; i < cabinCandidates.length; i++) {
      try {
        const response = await duffel.offerRequests.create({
          slices: slices,
          passengers: adultPassengers,
          cabin_class: cabinCandidates[i],
          return_offers: true,
          supplier_timeout: 15000
        });
        request = response && (response.data || response);
        usedCabinClass = cabinCandidates[i];
        if (request && Array.isArray(request.offers) && request.offers.length) break;
      } catch (error) {
        lastError = error;
        if (i === cabinCandidates.length - 1) throw error;
      }
    }
    if (!request && lastError) throw lastError;
    const offers = formatOffers(request && request.offers);
    if (!offers.length) {
      return sendJson(res, 200, {
        origin: origin, destination: destination, cabin_class: usedCabinClass, style: style,
        offers: [], error: 'No hay vuelos disponibles para esta búsqueda.'
      });
    }
    return sendJson(res, 200, { origin: origin, destination: destination, cabin_class: usedCabinClass, style: style, offers: offers });
  } catch (e) {
    const message = e && e.errors && e.errors[0] && (e.errors[0].message || e.errors[0].title);
    console.error('Error detallado de Duffel:', JSON.stringify(e.errors || e, null, 2));
    return sendJson(res, e.status && e.status < 500 ? e.status : 502, {
      offers: [], error: message || 'No pudimos consultar disponibilidad de vuelos.'
    });
  }
}

function normalizePassengers(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 9) return null;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const out = [];
  for (let i = 0; i < input.length; i++) {
    const p = input[i] || {};
    const given = String(p.given_name || '').trim();
    const family = String(p.family_name || '').trim();
    const born = String(p.born_on || '');
    const gender = String(p.gender || '').toLowerCase();
    const email = String(p.email || '').trim();
    const phone = String(p.phone_number || '').trim();
    const doc = p.identity_documents && p.identity_documents[0] || {};
    const docType = String(doc.type || '').toLowerCase();
    const docNumber = String(doc.unique_identifier || '').trim();
    const passengerId = String(p.id || '').trim();
    if (!given || !family || !/^\d{4}-\d{2}-\d{2}$/.test(born) || !['m', 'f'].includes(gender) || !emailRe.test(email) || !phone || !['passport', 'identity_card'].includes(docType) || !docNumber) return null;
    out.push({
      id: passengerId || undefined, title: gender === 'm' ? 'mr' : 'ms', given_name: given, family_name: family,
      gender: gender, born_on: born, email: email, phone_number: phone,
      identity_documents: [{ type: docType, unique_identifier: docNumber }]
    });
  }
  return out;
}

async function reservarVuelo(req, res, body) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const offerId = String(body.offer_id || '').trim();
  const passengers = normalizePassengers(body.passengers);
  if (!/^off_[A-Za-z0-9]+$/.test(offerId) || !passengers) return sendJson(res, 400, { error: 'Completá correctamente los datos de todos los pasajeros.' });
  if (process.env.DUFFEL_BOOKING_ENABLED !== 'true') return sendJson(res, 503, { error: 'La emisión de reservas está deshabilitada. Activala después de configurar el pago del proveedor aéreo.' });
  const duffel = duffelClient();
  if (!duffel) return sendJson(res, 503, { error: 'La reserva aérea no está configurada.' });

  try {
    // El precio confiable sale de Duffel, no del navegador, para evitar que el
    // cliente altere el importe del pago.
    const offerResponse = await duffel.offers.get(offerId);
    const offer = offerResponse.data || offerResponse;
    const amount = String(offer.total_amount || '');
    const currency = String(offer.total_currency || '').toUpperCase();
    if (!/^\d+(\.\d+)?$/.test(amount) || !currency) return sendJson(res, 502, { error: 'La aerolínea no devolvió un precio válido para esta oferta.' });
    const orderResponse = await duffel.orders.create({
      selected_offers: [offerId], passengers: passengers, type: 'instant',
      payments: [{ amount: amount, currency: currency, type: 'balance' }]
    });
    const order = orderResponse.data || orderResponse;
    return sendJson(res, 200, {
      booking_reference: order.booking_reference || order.booking_reference_code || null,
      airline: order.owner && order.owner.name || (offer.owner && offer.owner.name) || null,
      order_id: order.id || null,
      documents: order.documents || [],
      slices: order.slices || offer.slices || [],
      passengers: passengers,
      total_amount: amount,
      total_currency: currency
    });
  } catch (e) {
    let detail;
    try { detail = JSON.stringify(e, null, 2); } catch (jsonError) { detail = String(e); }
    console.error('Error detallado de Duffel:', detail);
    const message = e && e.errors && e.errors[0] && (e.errors[0].message || e.errors[0].title);
    return sendJson(res, 400, { error: message || e.message || 'No pudimos emitir la reserva. La oferta puede haber vencido.' });
  }
}

async function cotizar(req, res, url) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    v = model.validate(Object.fromEntries(url.searchParams), today);
  } catch (e) {
    return sendJson(res, e.status || 400, { error: e.message });
  }
  v.S.fuelPriceUsd = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;
  const quotes = await providers.getQuotes(model.DEST[v.S.dest], v.S.dep, v.S.ret, v.S.style);
  const result = model.compute(v.S, v.dep, v.ret, today, quotes);
  sendJson(res, 200, Object.assign({
    meta: {
      mode: providers.isLive() ? 'live' : 'demo',
      dest: { key: v.S.dest, name: model.DEST[v.S.dest].name },
      dep: v.S.dep, ret: v.S.ret, nights: v.nights, pax: v.S.pax, budget: v.S.budget, style: v.S.style,
      costBasis: model.REAL_COSTS, roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax),
      generatedAt: new Date().toISOString()
    }
  }, result));
}

function cotizarTodos(req, res, url) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    // La validación del viaje es compartida con la cotización individual; el
    // destino de referencia solo satisface ese validador y luego se reemplaza.
    v = model.validate(Object.assign({}, Object.fromEntries(url.searchParams), { dest: 'fln' }), today);
  } catch (e) {
    return sendJson(res, e.status || 400, { error: e.message });
  }
  v.S.fuelPriceUsd = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;

  // Estas diez opciones son comparables y estimadas: consultar Duffel para
  // cada destino dispararía hasta 19 requests externos en un solo clic.
  const options = Object.keys(model.DEST).map(function (key) {
    const trip = Object.assign({}, v.S, { dest: key });
    const result = model.compute(trip, v.dep, v.ret, today, {});
    const rec = result.list.find(function (p) { return p.id === result.recId; });
    return {
      dest: { key: key, name: model.DEST[key].name }, total: rec.total, pp: rec.pp,
      parts: rec.parts, title: rec.modeShort + ' + hotel ' + rec.tierLabel,
      tierDesc: rec.tierDesc, fits: result.fits
    };
  }).sort(function (a, b) { return a.total - b.total; });

  sendJson(res, 200, {
    meta: { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, budget: v.S.budget, style: v.S.style, mode: 'estimated', costBasis: model.REAL_COSTS, roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax) },
    options: options
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && file.indexOf(PUBLIC_DIR + path.sep) !== 0) { res.writeHead(403); return res.end('Prohibido'); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache', 'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
    });
    res.end(data);
  });
}

function createServer() {
  return http.createServer(function (req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
    if (req.method === 'POST' && url.pathname === '/api/vuelos/buscar') {
      return readJson(req).then(function (body) { return buscarVuelos(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos leer la búsqueda.' });
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/vuelos/reservar') {
      return readJson(req).then(function (body) { return reservarVuelo(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos leer la reserva.' });
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/traslados/transferencia') {
      return readJson(req, 6 * 1024 * 1024).then(function (body) { return registrarTransferencia(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos registrar la transferencia.' });
      });
    }
    if (req.method === 'POST') { res.writeHead(404); return res.end(); }
    if (url.pathname === '/api/destinos') {
      return sendJson(res, 200, Object.keys(model.DEST).map(function (k) { return { key: k, name: model.DEST[k].name }; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); }));
    }
    if (url.pathname === '/api/cotizar') {
      return cotizar(req, res, url).catch(function (e) {
        console.error('[cotizar]', e);
        sendJson(res, 500, { error: 'Error inesperado. Probá de nuevo en un momento.' });
      });
    }
    if (url.pathname === '/api/cotizar-todos') {
      return cotizarTodos(req, res, url);
    }
    try { serveStatic(req, res, url.pathname); } catch (e) { res.writeHead(400); res.end(); }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, function () {
    console.log('CuántoSale en http://localhost:' + port + ' (' + (providers.isLive() ? 'vuelos reales con Duffel' : 'modo demo, sin DUFFEL_TOKEN') + ')');
  });
}

const app = createServer();
module.exports = app;
// Vercel consume la función `app`; exponer el factory permite levantar un
// servidor aislado en las pruebas sin alterar el handler desplegado.
module.exports.createServer = createServer;
module.exports.formatOffers = formatOffers;
module.exports.normalizePassengers = normalizePassengers;
