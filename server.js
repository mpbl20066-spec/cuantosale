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
const DUFFEL_DESTINATIONS = { rio: 'GIG', fln: 'FLN', sao: 'GRU', ssa: 'SSA', igu: 'IGU', rec: 'REC', for: 'FOR', mcz: 'MCZ', nat: 'NAT', poa: 'POA' };

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

function readJson(req) {
  return new Promise(function (resolve, reject) {
    let body = '', size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > 32768) { const e = new Error('El cuerpo del pedido es demasiado grande.'); e.status = 413; reject(e); req.destroy(); return; }
      body += chunk;
    });
    req.on('end', function () {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { e.status = 400; e.message = 'El cuerpo debe ser JSON válido.'; reject(e); }
    });
    req.on('error', reject);
  });
}

function durationLabel(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(String(value || ''));
  if (!match) return value || null;
  const hours = Number(match[1] || 0), minutes = Number(match[2] || 0);
  return (hours ? hours + ' h' : '') + (hours && minutes ? ' ' : '') + (minutes ? minutes + ' min' : '');
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
    return {
      id: offer.id,
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
  const passengers = Number(body.pasajeros);
  if (!/^[A-Z]{3}$/.test(origin) || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return sendJson(res, 400, { error: 'Datos de búsqueda de vuelo inválidos.' });
  }
  if (!process.env.DUFFEL_ACCESS_TOKEN) return sendJson(res, 503, { error: 'La búsqueda de vuelos no está configurada todavía.' });

  try {
    const duffel = new Duffel({ token: process.env.DUFFEL_ACCESS_TOKEN });
    const response = await duffel.offerRequests.create({
      slices: [{ origin: origin, destination: destination, departure_date: date }],
      passengers: Array.from({ length: passengers }, function () { return { type: 'adult' }; }),
      cabin_class: 'economy', return_offers: true, supplier_timeout: 15000
    });
    const request = response.data || response;
    return sendJson(res, 200, { origin: origin, destination: destination, offers: formatOffers(request.offers) });
  } catch (e) {
    const message = e && e.errors && e.errors[0] && (e.errors[0].message || e.errors[0].title);
    console.error('[duffel search]', message || e.message);
    return sendJson(res, e.status && e.status < 500 ? e.status : 502, { error: message || 'No pudimos buscar vuelos en este momento.' });
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
  const quotes = await providers.getQuotes(model.DEST[v.S.dest], v.S.dep, v.S.ret);
  const result = model.compute(v.S, v.dep, v.ret, today, quotes);
  sendJson(res, 200, Object.assign({
    meta: {
      mode: providers.isLive() ? 'live' : 'demo',
      dest: { key: v.S.dest, name: model.DEST[v.S.dest].name },
      dep: v.S.dep, ret: v.S.ret, nights: v.nights, pax: v.S.pax, budget: v.S.budget, style: v.S.style,
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
    meta: { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, budget: v.S.budget, style: v.S.style, mode: 'estimated' },
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
