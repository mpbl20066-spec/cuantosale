'use strict';
/*
 * Reúne las fuentes de datos reales. Si no hay DUFFEL_TOKEN, el server queda en
 * "modo demo" y todo se estima con el modelo.
 */
const duffel = require('./duffel');

const cache = new Map();      // key -> { at, ttl, value }
const inflight = new Map();   // key -> Promise (evita pedidos repetidos al mismo tiempo)
let cooldownUntil = 0;        // si Duffel responde 429, frenamos un rato
let fetchImpl = null;         // inyectable para tests

function accessToken() { return process.env.DUFFEL_ACCESS_TOKEN || process.env.DUFFEL_TOKEN; }
function isLive() { return !!accessToken(); }
function setFetch(f) { fetchImpl = f; }
function clearCache() { cache.clear(); inflight.clear(); cooldownUntil = 0; }

function fx() {
  try { return process.env.DUFFEL_FX ? JSON.parse(process.env.DUFFEL_FX) : null; } catch (e) { return null; }
}
function ttlMs(found) {
  const okMin = Number(process.env.QUOTE_TTL_MIN) || 60;
  return (found ? okMin : Math.min(10, okMin)) * 60000;
}

async function flightQuote(origin, destination, dep, ret) {
  const key = [origin, destination, dep, ret].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  if (Date.now() < cooldownUntil) return null;
  if (inflight.has(key)) return inflight.get(key);

  const p = duffel.getFlightQuote({
    token: accessToken(), origin: origin, destination: destination, dep: dep, ret: ret,
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

/**
 * Devuelve { avion_mvd?, avion_ba? } con el precio real por persona (o null).
 * @param {object} destCfg  entrada de DEST (con iata y modes)
 */
async function getQuotes(destCfg, dep, ret) {
  const out = {};
  if (!isLive()) return out;
  const jobs = [];
  if (destCfg.modes.avion_mvd) jobs.push(flightQuote('MVD', destCfg.iata, dep, ret).then(function (q) { out.avion_mvd = q; }));
  if (destCfg.modes.avion_ba) jobs.push(flightQuote('BUE', destCfg.iata, dep, ret).then(function (q) { out.avion_ba = q; }));
  await Promise.all(jobs);
  return out;
}

module.exports = { isLive, getQuotes, setFetch, clearCache };
