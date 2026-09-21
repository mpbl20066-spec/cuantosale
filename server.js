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
const duffel = require('./lib/providers/duffel');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'";

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

async function cotizar(req, res, url) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    v = model.validate(Object.fromEntries(url.searchParams), today);
  } catch (e) {
    return sendJson(res, e.status || 400, { error: e.message });
  }
  const cfg = model.DEST[v.S.dest];
  const rooms = Math.ceil(v.S.pax / 2);
  const platform = /Mobi|Android|iPhone|iPad/i.test(String(req.headers['user-agent'] || '')) ? 'mobile' : 'desktop';
  const prov = await providers.getProviderData({ destKey: v.S.dest, cfg: cfg, dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, rooms: rooms, platform: platform });
  const result = model.compute(v.S, v.dep, v.ret, today, prov);
  const flightsLive = providers.isLive(), hotelsLive = providers.hotelsLive();
  sendJson(res, 200, Object.assign({
    meta: {
      mode: flightsLive || hotelsLive ? 'live' : 'demo',
      sources: { flights: flightsLive, hotels: hotelsLive && result.lodging.some(function (l) { return l.source === 'real'; }) },
      dest: { key: v.S.dest, name: cfg.name },
      dep: v.S.dep, ret: v.S.ret, nights: v.nights, days: result.days, rooms: rooms, pax: v.S.pax,
      generatedAt: new Date().toISOString()
    }
  }, result));
}

/* ---------- reserva de vuelos con Duffel Links ---------- */
function redirect(res, url) {
  res.writeHead(302, { 'Location': url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  res.end();
}
function htmlMsg(res, status, msg) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:24px;max-width:520px;margin:auto"><h2>' + msg + '</h2><p><a href="/">Volver a CuántoSale</a></p>');
}

/** GET /go/vuelo: crea la sesión de Duffel Links y redirige. Si algo falla, cae al enlace de afiliados. */
async function goFlight(req, res, url) {
  if (limited('go:' + clientIp(req))) return htmlMsg(res, 429, 'Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.');
  const q = Object.fromEntries(url.searchParams);
  let v;
  try { v = model.validate(q, model.getToday()); } catch (e) { return htmlMsg(res, 400, e.message); }
  const cfg = model.DEST[v.S.dest];
  const origin = q.mode === 'avion_ba' ? 'BUE' : 'MVD';
  if (!cfg.modes[q.mode === 'avion_ba' ? 'avion_ba' : 'avion_mvd']) return htmlMsg(res, 400, 'Ese vuelo no está disponible para el destino.');
  const fallback = duffel.flightBookingUrl({ origin: origin, destination: cfg.iata, dep: v.S.dep, ret: v.S.ret, pax: v.S.pax });
  if (!duffel.linksEnabled()) return fallback ? redirect(res, fallback) : htmlMsg(res, 503, 'La reserva de vuelos no está disponible por ahora.');
  try {
    const target = await duffel.createLinkSession({ reference: duffel.makeReference(v.S), fetchImpl: providers.fetchImpl() });
    redirect(res, target);
  } catch (e) {
    console.error('[duffel-links]', e.message);
    if (fallback) redirect(res, fallback); else htmlMsg(res, 502, 'No pudimos abrir la reserva de vuelos. Probá de nuevo en un momento.');
  }
}

/** GET /api/reservas/vuelo?order_id=...&reference=...: datos de la orden para la página de confirmación. */
async function flightOrder(req, res, url) {
  if (limited('order:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiados pedidos seguidos.' });
  if (!duffel.linksEnabled()) return sendJson(res, 404, { error: 'No disponible.' });
  const orderId = url.searchParams.get('order_id'), reference = url.searchParams.get('reference');
  if (!duffel.verifyReference(reference)) return sendJson(res, 403, { error: 'La referencia de la reserva no es válida.' });
  try {
    sendJson(res, 200, await duffel.getOrder({ orderId: orderId, fetchImpl: providers.fetchImpl() }));
  } catch (e) {
    console.error('[duffel-order]', e.message);
    sendJson(res, e.status === 400 ? 400 : 502, { error: 'No pudimos obtener los datos de tu reserva.' });
  }
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
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
    if (url.pathname === '/api/destinos') {
      return sendJson(res, 200, Object.keys(model.DEST).map(function (k) { return { key: k, name: model.DEST[k].name }; }));
    }
    if (url.pathname === '/api/cotizar') {
      return cotizar(req, res, url).catch(function (e) {
        console.error('[cotizar]', e);
        sendJson(res, 500, { error: 'Error inesperado. Probá de nuevo en un momento.' });
      });
    }
    if (url.pathname === '/go/vuelo') {
      return goFlight(req, res, url).catch(function (e) { console.error('[go/vuelo]', e); htmlMsg(res, 500, 'Error inesperado.'); });
    }
    if (url.pathname === '/api/reservas/vuelo') {
      return flightOrder(req, res, url).catch(function (e) { console.error('[reservas]', e); sendJson(res, 500, { error: 'Error inesperado.' }); });
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

module.exports = { createServer };
