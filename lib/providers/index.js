'use strict';
/*
 * Reúne las fuentes de datos. Si no hay DUFFEL_TOKEN, el server queda en "modo demo":
 * los precios se estiman con el modelo. Los enlaces de reserva (bookingUrl) se generan siempre.
 */
const duffel = require('./duffel');
const busbud = require('./busbud');
const hotels = require('./hotels');
const insurance = require('./insurance');

const cache = new Map();      // key -> { at, ttl, value }
const inflight = new Map();   // key -> Promise (evita pedidos repetidos al mismo tiempo)
let cooldownUntil = 0;        // si Duffel responde 429, frenamos un rato
const hotelCache = new Map(); // búsquedas de Booking.com
let hotelCooldownUntil = 0;
let fetchImpl = null;         // inyectable para tests

function isLive() { return !!process.env.DUFFEL_TOKEN; }
function setFetch(f) { fetchImpl = f; }
function getFetch() { return fetchImpl || undefined; }
function clearCache() { cache.clear(); inflight.clear(); hotelCache.clear(); cooldownUntil = 0; hotelCooldownUntil = 0; }
function hotelsLive() { return hotels.isConfigured(process.env); }

function fx() {
  try { return process.env.DUFFEL_FX ? JSON.parse(process.env.DUFFEL_FX) : null; } catch (e) { return null; }
}
function ttlMs(found) {
  const okMin = Number(process.env.QUOTE_TTL_MIN) || 60;
  return (found ? okMin : Math.min(10, okMin)) * 60000;
}

/** Precio real de vuelo (con caché). Devuelve null si no hay o si falla. */
async function flightQuote(origin, destination, dep, ret) {
  const key = [origin, destination, dep, ret].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  if (Date.now() < cooldownUntil) return null;
  if (inflight.has(key)) return inflight.get(key);

  const p = duffel.getFlightQuote({
    token: process.env.DUFFEL_TOKEN, origin: origin, destination: destination, dep: dep, ret: ret,
    fx: fx(), maxConnections: process.env.DUFFEL_MAX_CONNECTIONS, fetchImpl: fetchImpl || undefined
  }).then(function (q) {
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), ttl: ttlMs(!!q), value: q });
    return q;
  }).catch(function (e) {
    console.error('[duffel]', origin + '->' + destination, e.message);
    if (e.status === 429) cooldownUntil = Date.now() + 30000;
    return null;   // si falla, el modelo estima el pasaje
  }).finally(function () { inflight.delete(key); });

  inflight.set(key, p);
  return p;
}


/** Propiedades reales de Booking.com (con caché de 30 minutos). Si falla, devuelve [] y el modelo estima. */
async function bookingProperties(o) {
  const key = [o.destKey, o.dep, o.ret, o.pax, o.rooms].join('|');
  const hit = hotelCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60000) return hit.value;
  if (Date.now() < hotelCooldownUntil) return [];
  try {
    const value = await hotels.searchProperties({
      destKey: o.destKey, cfg: o.cfg, dep: o.dep, ret: o.ret, pax: o.pax, rooms: o.rooms,
      platform: o.platform, fetchImpl: fetchImpl || undefined
    });
    if (hotelCache.size > 300) hotelCache.delete(hotelCache.keys().next().value);
    hotelCache.set(key, { at: Date.now(), value: value });
    return value;
  } catch (e) {
    console.error('[booking]', o.destKey, e.message);
    if (e.status === 429) hotelCooldownUntil = Date.now() + 30000;
    return [];
  }
}

/**
 * Devuelve, para una búsqueda:
 *   transport: { [modeId]: { pp?, airline?, ..., bookingUrl } }
 *   lodging:   { bookingUrl }
 *   insurance: { bookingUrl }
 * Cada objeto incluye SIEMPRE bookingUrl; pp solo cuando hay precio real.
 *
 * @param o { destKey, cfg (entrada de DEST), dep, ret, pax, rooms, platform? }
 */
async function getProviderData(o) {
  const cfg = o.cfg;
  const common = { destName: cfg.name, dep: o.dep, ret: o.ret, pax: o.pax, rooms: o.rooms };
  const transport = {};
  const jobs = [];

  Object.keys(cfg.modes).forEach(function (mode) {
    if (mode === 'avion_mvd' || mode === 'avion_ba') {
      const origin = mode === 'avion_mvd' ? 'MVD' : 'BUE';
      jobs.push((async function () {
        const q = isLive() ? await flightQuote(origin, cfg.iata, o.dep, o.ret) : null;
        // el enlace se rearma en cada pedido: el precio se recuerda en caché, pero la cantidad de viajeros cambia
        const links = duffel.linksEnabled();
        transport[mode] = Object.assign({ pp: null, source: 'estimado' }, q || {}, {
          // con Duffel Links el enlace pasa por /go/vuelo (el server crea la sesión y redirige); si no, enlace de afiliados
          bookingUrl: links
            ? '/go/vuelo?' + new URLSearchParams({ mode: mode, dest: o.destKey, dep: o.dep, ret: o.ret, pax: String(o.pax) }).toString()
            : duffel.flightBookingUrl({ origin: origin, destination: cfg.iata, dep: o.dep, ret: o.ret, pax: o.pax }),
          bookingKind: links ? 'duffel-links' : 'external'
        });
      })());
    } else {
      jobs.push(busbud.getBusQuote(Object.assign({ mode: mode }, common)).then(function (q) { transport[mode] = q; }));
    }
  });

  let lodging = null, ins = null;
  jobs.push((async function () {
    const h = await hotels.getHotelQuote(common);
    const properties = hotels.isConfigured(process.env)
      ? await bookingProperties({ destKey: o.destKey, cfg: cfg, dep: o.dep, ret: o.ret, pax: o.pax, rooms: o.rooms, platform: o.platform })
      : [];
    lodging = { bookingUrl: h.bookingUrl, properties: properties };
  })());
  jobs.push(insurance.getInsuranceQuote(common).then(function (i) { ins = i; }));
  await Promise.all(jobs);
  return { transport: transport, lodging: lodging, insurance: ins };
}

module.exports = { isLive, hotelsLive, getProviderData, setFetch, fetchImpl: getFetch, clearCache };
