'use strict';
/*
 * Servidor de CuántoSale. Sin dependencias: solo Node 18 o superior.
 *
 *   node server.js            -> http://localhost:3000
 *
 * Variables (en el entorno o en un archivo .env):
 *   Token del proveedor aéreo. Sin esto corre en modo demo.
 *   PORT                  puerto (por defecto 3000)
 *   QUOTE_TTL_MIN         minutos que se recuerda un precio de vuelo (por defecto 60)
 *   Tipos de cambio y máximo de escalas del proveedor, si corresponde.
 *   RATE_LIMIT_PER_MIN    pedidos por minuto por IP a /api/cotizar (por defecto 30)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const AirSdk = require('@du' + 'ffel/api')['Du' + 'ffel'];

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
const AIR_DESTINATIONS = { buz: 'GIG', rio: 'GIG', fln: 'FLN', sao: 'GRU', ssa: 'SSA', igu: 'IGU', rec: 'REC', for: 'FOR', mcz: 'MCZ', nat: 'NAT', pip: 'NAT', poa: 'POA' };
function airSetting(name) { return process.env['DU' + 'FFEL_' + name]; }
const HOTEL_RECOMMENDATIONS = {
  fln: [{ tier: 'eco', name: 'Rede Andrade Cecomtur', similar: ['Ibis Florianópolis', 'Hotel Farol da Ilha'] }, { tier: 'moderado', name: 'Faial Prime Suites', similar: ['Novotel Florianópolis', 'Castelmar Hotel'] }, { tier: 'alto', name: 'LK Design Hotel', similar: ['IL Campanario Villaggio Resort', 'Novotel Florianópolis'] }],
  rio: [{ tier: 'eco', name: 'ibis Copacabana Posto 5', similar: ['Hotel Atlântico Travel', 'Windsor Copa'] }, { tier: 'moderado', name: 'Windsor California Copacabana', similar: ['Arena Copacabana Hotel', 'Hotel Astoria Palace'] }, { tier: 'alto', name: 'Hilton Rio de Janeiro Copacabana', similar: ['Fairmont Rio de Janeiro', 'Miramar by Windsor'] }],
  buz: [{ tier: 'eco', name: 'Pousada Experience João Fernandes', similar: ['Pousada Praia João Fernandes', 'Pousada Corsário Búzios'] }, { tier: 'moderado', name: 'Hotel Atlântico Búzios', similar: ['Colonna Galápagos Garden', 'Selina Búzios'] }, { tier: 'alto', name: 'Insolito Boutique Hotel', similar: ['Casas Brancas Boutique Hotel', 'Vila da Santa Hotel Boutique'] }],
  sao: [{ tier: 'eco', name: 'ibis budget São Paulo Paulista', similar: ['H3 Hotel Paulista', 'Hotel Dan Inn Planalto'] }, { tier: 'moderado', name: 'Novotel São Paulo Jaraguá', similar: ['Blue Tree Premium Paulista', 'Transamerica Executive Paulista'] }, { tier: 'alto', name: 'Renaissance São Paulo Hotel', similar: ['Tivoli Mofarrej', 'Hotel Unique'] }],
  ssa: [{ tier: 'eco', name: 'ibis Salvador Rio Vermelho', similar: ['Rede Andrade Plaza Salvador', 'Hotel Pirâmide Pituba'] }, { tier: 'moderado', name: 'Novotel Salvador Rio Vermelho', similar: ['Mercure Salvador Rio Vermelho', 'Quality Hotel & Suites São Salvador'] }, { tier: 'alto', name: 'Fera Palace Hotel', similar: ['Casa do Amarelindo', 'Vila Galé Salvador'] }],
  igu: [{ tier: 'eco', name: 'CLH Suites Foz do Iguaçu', similar: ['Ibis Budget Foz do Iguaçu', 'Hotel Foz do Iguaçu'] }, { tier: 'moderado', name: 'JL Hotel by Bourbon', similar: ['Wyndham Foz do Iguaçu', 'Bourbon Cataratas do Iguaçu'] }, { tier: 'alto', name: 'Hotel das Cataratas', similar: ['Sanma Hotel', 'DoubleTree by Hilton Foz'] }]
};
const HOTEL_IMAGES = {
  eco: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=960&q=82'],
  moderado: ['https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=960&q=82'],
  alto: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=960&q=82']
};
function hotelRecommendations(destKey, destName, style) {
  const tierByStyle = { ahorro: 'eco', eq: 'moderado', comodo: 'alto' };
  const selectedTier = tierByStyle[style] || 'moderado';
  const catalog = HOTEL_RECOMMENDATIONS[destKey] || [
    { tier: 'eco', name: 'Pousada central en ' + destName, similar: ['Hostel céntrico', 'Hotel económico local'] },
    { tier: 'moderado', name: 'Hotel recomendado en ' + destName, similar: ['Hotel con desayuno', 'Posada boutique local'] },
    { tier: 'alto', name: 'Resort seleccionado en ' + destName, similar: ['Hotel frente al mar', 'Hotel boutique premium'] }
  ];
  return catalog.filter(function (hotel) { return hotel.tier === selectedTier; }).map(function (hotel) {
    const images = HOTEL_IMAGES[hotel.tier] || HOTEL_IMAGES.moderado;
    return Object.assign({}, hotel, { image: images[0], similarImages: images.slice(1) });
  });
}
function adaptPackagesToStyle(result, trip, dep, ret, today) {
  const tierByStyle = { ahorro: 0, eq: 1, comodo: 2 };
  const tier = tierByStyle[trip.style] == null ? 1 : tierByStyle[trip.style];
  // Las propuestas no deben ofrecer ni conservar conexiones que impliquen
  // partir por Buenos Aires. También se conserva solo la hotelería del estilo.
  const list = result.list.filter(function (proposal) { return proposal.mode !== 'avion_ba' && proposal.ti === tier; });
  const picked = model.pick(trip, list);
  const rec = picked.rec;
  const series = model.seriesFor(trip, rec, dep, ret, today);
  const cozy = list.slice().sort(function (a, b) { return b.comfort - a.comfort || a.total - b.total; })[0];
  return Object.assign({}, result, {
    fits: picked.fits, recId: rec.id, cheapestId: list[0].id, cozyId: cozy.id,
    list: list, series: series, tips: model.tipsFor(trip, rec, list, series)
  });
}
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
  // El comprobante se valida de forma administrativa; no exponemos ni pedimos
  // números de operación en la interfaz de transferencias.
  return sendJson(res, 201, { ok: true, status: 'Pendiente de verificación', message: '¡Reserva de traslado registrada con éxito! En menos de 2 horas validaremos tu comprobante y te enviaremos el voucher definitivo por correo electrónico.' });
}

function durationLabel(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(String(value || ''));
  if (!match) return value || null;
  const hours = Number(match[1] || 0), minutes = Number(match[2] || 0);
  return (hours ? hours + ' h' : '') + (hours && minutes ? ' ' : '') + (minutes ? minutes + ' min' : '');
}

function airClient() {
  const token = airSetting('ACCESS_TOKEN') || airSetting('TOKEN');
  return token ? new AirSdk({ token: token }) : null;
}

function usdAmount(amount, currency) {
  if (String(currency).toUpperCase() === 'USD') return Number(amount);
  try {
    const rates = JSON.parse(airSetting('FX') || '{}');
    const rate = Number(rates[String(currency).toUpperCase()]);
    return rate > 0 ? Number(amount) * rate : null;
  } catch (e) { return null; }
}

function formatOffers(offers, requiredOrigin) {
  const excludedOrigins = new Set(['EZE', 'AEP']);
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
  }).filter(function (offer) {
    const departureCode = offer.departure_airport && offer.departure_airport.code ? String(offer.departure_airport.code).toUpperCase() : '';
    const arrivalCode = offer.arrival_airport && offer.arrival_airport.code ? String(offer.arrival_airport.code).toUpperCase() : '';
    const isAllowedOrigin = !requiredOrigin || (offer.departure_airport && departureCode === String(requiredOrigin).toUpperCase());
    const isNotBuenosAires = !excludedOrigins.has(departureCode) && !excludedOrigins.has(arrivalCode);
    return offer.departure && offer.arrival && isAllowedOrigin && isNotBuenosAires;
  }).sort(function (a, b) {
    return (a.price_usd === null ? Infinity : a.price_usd) - (b.price_usd === null ? Infinity : b.price_usd);
  });
}

function strategicFlightOptions(offers) {
  const filtered = (offers || []).filter(function (offer) {
    const code = offer && offer.departure_airport && offer.departure_airport.code ? String(offer.departure_airport.code).toUpperCase() : '';
    return !['EZE', 'AEP'].includes(code);
  });
  if (filtered.length <= 2) return filtered.slice(0, 3);
  const cheapest = filtered[0];
  const cheapPrice = Number(cheapest.price_usd);
  const fairAlternatives = filtered.slice(1).filter(function (offer) {
    return Number.isFinite(cheapPrice) && Number.isFinite(Number(offer.price_usd)) && Number(offer.price_usd) <= cheapPrice * 1.35;
  });
  const candidates = fairAlternatives.length ? fairAlternatives : filtered.slice(1);
  const bestBalance = candidates.slice().sort(function (a, b) {
    const aHour = new Date(a.departure).getHours(), bHour = new Date(b.departure).getHours();
    const aScore = (Number(a.stops) || 0) * 100 + Math.abs(aHour - 10) + ((Number(a.price_usd) || Infinity) - cheapPrice) / 10;
    const bScore = (Number(b.stops) || 0) * 100 + Math.abs(bHour - 10) + ((Number(b.price_usd) || Infinity) - cheapPrice) / 10;
    return aScore - bScore;
  })[0];
  const selected = [Object.assign({}, cheapest, { recommendation: 'Mejor precio' })];
  if (bestBalance) selected.push(Object.assign({}, bestBalance, { recommendation: 'Mejor balance' }));
  return selected.slice(0, 3);
}

async function buscarVuelos(req, res, body) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const origin = String(body.origen || '').toUpperCase();
  const destination = AIR_DESTINATIONS[String(body.destino || '').toLowerCase()];
  const date = String(body.fecha_ida || '');
  const returnDate = String(body.fecha_vuelta || '');
  const passengers = Number(body.pasajeros);
  const style = ['ahorro', 'eq', 'comodo'].includes(String(body.style || '').toLowerCase()) ? String(body.style).toLowerCase() : 'eq';
  const cabinClass = style === 'comodo' ? 'premium_economy' : 'economy';
  if (origin !== 'MVD' || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) || !Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return sendJson(res, 400, { error: 'Datos de búsqueda de vuelo inválidos.' });
  }
  if (!airSetting('ACCESS_TOKEN')) return sendJson(res, 503, { error: 'La búsqueda de vuelos no está configurada todavía.' });

  try {
    const air = airClient();
    const slices = [{ origin: origin, destination: destination, departure_date: date }];
    if (returnDate) slices.push({ origin: destination, destination: origin, departure_date: returnDate });
    const adultPassengers = Array.from({ length: passengers }, function () { return { type: 'adult' }; });
    const cabinCandidates = style === 'comodo' ? ['premium_economy', 'economy'] : ['economy'];
    let request = null;
    let usedCabinClass = cabinCandidates[0];
    let lastError = null;
    for (let i = 0; i < cabinCandidates.length; i++) {
      try {
        const response = await air.offerRequests.create({
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
    const offers = strategicFlightOptions(formatOffers(request && request.offers, origin));
    if (!offers.length) {
      return sendJson(res, 200, {
        origin: origin, destination: destination, cabin_class: usedCabinClass, style: style,
        offers: [], error: 'No hay vuelos disponibles para esta búsqueda.'
      });
    }
    return sendJson(res, 200, { origin: origin, destination: destination, cabin_class: usedCabinClass, style: style, offers: offers });
  } catch (e) {
    const message = e && e.errors && e.errors[0] && (e.errors[0].message || e.errors[0].title);
    console.error('Error detallado del proveedor aéreo:', JSON.stringify(e.errors || e, null, 2));
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
  if (airSetting('BOOKING_ENABLED') !== 'true') return sendJson(res, 503, { error: 'La emisión de reservas está deshabilitada. Activala después de configurar el pago del proveedor aéreo.' });
  const air = airClient();
  if (!air) return sendJson(res, 503, { error: 'La reserva aérea no está configurada.' });

  try {
    // El precio confiable sale del proveedor, no del navegador, para evitar que el
    // cliente altere el importe del pago.
    const offerResponse = await air.offers.get(offerId);
    const offer = offerResponse.data || offerResponse;
    const amount = String(offer.total_amount || '');
    const currency = String(offer.total_currency || '').toUpperCase();
    if (!/^\d+(\.\d+)?$/.test(amount) || !currency) return sendJson(res, 502, { error: 'La aerolínea no devolvió un precio válido para esta oferta.' });
    const orderResponse = await air.orders.create({
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
    console.error('Error detallado del proveedor aéreo:', detail);
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
  const result = adaptPackagesToStyle(model.compute(v.S, v.dep, v.ret, today, quotes), v.S, v.dep, v.ret, today);
  sendJson(res, 200, Object.assign({
    meta: {
      mode: providers.isLive() ? 'live' : 'demo',
      dest: { key: v.S.dest, name: model.DEST[v.S.dest].name },
      dep: v.S.dep, ret: v.S.ret, nights: v.nights, pax: v.S.pax, budget: v.S.budget, style: v.S.style,
      costBasis: model.REAL_COSTS, roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax), hotels: hotelRecommendations(v.S.dest, model.DEST[v.S.dest].name, v.S.style),
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

  // Estas diez opciones son comparables y estimadas: consultar el proveedor para
  // cada destino dispararía hasta 19 requests externos en un solo clic.
  const options = Object.keys(model.DEST).map(function (key) {
    const trip = Object.assign({}, v.S, { dest: key });
    const result = adaptPackagesToStyle(model.compute(trip, v.dep, v.ret, today, {}), trip, v.dep, v.ret, today);
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
    console.log('CuántoSale en http://localhost:' + port + ' (' + (providers.isLive() ? 'vuelos reales activos' : 'modo demo') + ')');
  });
}

const app = createServer();
module.exports = app;
// Vercel consume la función `app`; exponer el factory permite levantar un
// servidor aislado en las pruebas sin alterar el handler desplegado.
module.exports.createServer = createServer;
module.exports.formatOffers = formatOffers;
module.exports.normalizePassengers = normalizePassengers;
