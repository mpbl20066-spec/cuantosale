'use strict';
/*
 * Links de afiliado de Travelpayouts.
 *
 * Por que existe: Booking.com y RapidAPI son cosas distintas. RapidAPI (o el
 * partner directo) da los PRECIOS. La COMISION viene del programa de
 * afiliados, y la via corta sin esperar el alta de partner de Booking.com es
 * Travelpayouts: su API convierte un link normal de Booking en el mismo link con
 * nuestro marker adentro. Quien reserva a traves de ese link nos paga el
 * 4-5% sin que tengamos que estar aprobada como partners.
 *
 * El endpoint acepta hasta 10 links por pedido y el limite es de 100 requests
 * por minuto y por marker, asi que:
 *   - se mandan en lote, no uno por hotel;
 *   - se cachean por URL, porque el link de un hotel no cambia entre visitas y
 *     regenerarlo en cada render quema cuota sin ganar nada.
 *
 * Documentacion: support.travelpayouts.com -> "API for Travelpayouts partner links".
 */

const API = 'https://api.travelpayouts.com/links/v1/create';

// Cuanto vive un link convertido. Es largo a proposito: el link es
// deterministico (mismo marker + mismo link de Booking = mismo partner_url) y
// 24h cubre todas las sesiones de un viaje sin repedir nada.
const TTL_MS = 24 * 3600 * 1000;
const MAX_BATCH = 10;

const cache = new Map();      // bookingUrl -> { at, url }
const pending = new Map();    // bookingUrl -> Promise (deduplica pedidos simultaneos)
let fetchImpl = null;

function config() {
  return {
    token: String(process.env.TRAVELPAYOUTS_API_TOKEN || '').trim(),
    // El marker ya venia puesto para los links de vuelos. Se acepta el nombre
    // viejo y el nuevo para no romper una instalacion existente.
    marker: String(process.env.TRAVELPAYOUTS_MARKER || process.env.TRAVELPAYOUTS_ID || '780345').trim(),
    // "trs" es el id del proyecto suscrito a Booking.com, NO el marker. Viaja en
    // su propia variable porque son numeros distintos y confundirlos tira 400.
    trs: String(process.env.TRAVELPAYOUTS_TRS || '').trim()
  };
}

function isConfigured() { return !!config().token; }

function setFetch(fn) { fetchImpl = fn; cache.clear(); pending.clear(); }
function clearCache() { cache.clear(); pending.clear(); }

// Solo URLs de Booking.com. Es lo que Travelpayouts convierte; pasar cualquier
// otra cosa gasta cuota y vuelve con code:"failed" por link.
function isBookingUrl(url) {
  try {
    const parsed = new URL(String(url));
    return parsed.protocol === 'https:' &&
      (parsed.hostname === 'booking.com' || parsed.hostname.endsWith('.booking.com'));
  } catch (error) { return false; }
}

async function requestPartnerUrls(urls) {
  const settings = config();
  const fetcher = fetchImpl || fetch;
  const response = await fetcher(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Token': settings.token,
      Accept: 'application/json'
    },
    // shorten:false devuelve el link largo, que es el que Booking acepta
    // redirigir sin romper los parametros de fechas y_epochs.
    body: JSON.stringify({
      marker: settings.marker,
      trs: settings.trs ? Number(settings.trs) : undefined,
      shorten: false,
      links: urls.map(function (url) { return { url: url }; })
    }),
    signal: AbortSignal.timeout(9000)
  });

  let payload;
  try { payload = await response.json(); } catch (error) {
    const failure = new Error('Travelpayouts devolvio una respuesta invalida.');
    failure.status = 502;
    throw failure;
  }
  if (!response.ok || !payload || payload.code !== 'success') {
    const detail = String((payload && (payload.error || payload.message)) || 'No se pudo convertir el link.').slice(0, 200);
    const failure = new Error('Travelpayouts (HTTP ' + response.status + '): ' + detail);
    // 401 casi siempre es token mal copiado; 400 suele ser trs faltante o mal.
    failure.status = response.status === 401 ? 401 : 502;
    throw failure;
  }
  const rows = payload.result && Array.isArray(payload.result.links) ? payload.result.links : [];
  const out = new Map();
  urls.forEach(function (url, index) {
    const row = rows[index];
    // Travelpayouts devuelve un registro por link, en el mismo orden. Si uno
    // falla, ese queda vacio y el resto sigue sirviendo.
    if (row && row.code === 'success' && row.partner_url) out.set(url, String(row.partner_url));
  });
  return out;
}

// Un link solo, con cache y deduplicacion de pedidos simultaneos.
function toPartnerUrl(bookingUrl) {
  const original = String(bookingUrl || '').trim();
  if (!isBookingUrl(original)) return Promise.resolve(original);
  if (!isConfigured()) return Promise.resolve(original);

  const hit = cache.get(original);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.url);
  if (pending.has(original)) return pending.get(original);

  const settings = config();
  const job = requestPartnerUrls([original]).then(function (map) {
    pending.delete(original);
    const partner = map.get(original);
    // Si la API no devolvio el link, se devuelve el original: el usuario igual
    // puede reservar, solo que sin comision para nosotros. Perder la comision
    // es mejor que romper el boton de reservar.
    const url = partner || original;
    if (partner) {
      if (cache.size > 2000) cache.delete(cache.keys().next().value);
      cache.set(original, { at: Date.now(), url: url });
    }
    return url;
  }).catch(function (error) {
    pending.delete(original);
    // Un fallo de Travelpayouts nunca debe voltear la busqueda de hoteles: se
    // avisa por log y sigue el link normal.
    console.warn('[travelpayouts]', error.message);
    return original;
  });

  pending.set(original, job);
  return job;
}

// Varios links de una, que es como conviene pegarlele a la API. Devuelve un
// Map con el mismo key que la entrada.
function toPartnerUrls(bookingUrls) {
  const out = new Map();
  const faltan = [];
  (bookingUrls || []).forEach(function (url) {
    const original = String(url || '').trim();
    if (!original) return;
    if (!isBookingUrl(original) || !isConfigured()) { out.set(original, original); return; }
    const hit = cache.get(original);
    if (hit && Date.now() - hit.at < TTL_MS) { out.set(original, hit.url); return; }
    faltan.push(original);
  });
  if (!faltan.length) return Promise.resolve(out);

  const unique = Array.from(new Set(faltan));
  const chunks = [];
  for (let i = 0; i < unique.length; i += MAX_BATCH) chunks.push(unique.slice(i, i + MAX_BATCH));

  return Promise.all(chunks.map(function (chunk) { return requestPartnerUrls(chunk); }))
    .then(function (maps) {
      const now = Date.now();
      unique.forEach(function (url) {
        let found = null;
        for (let i = 0; i < maps.length && !found; i++) found = maps[i].get(url);
        if (found) {
          if (cache.size > 2000) cache.delete(cache.keys().next().value);
          cache.set(url, { at: now, url: found });
          out.set(url, found);
        } else {
          out.set(url, url);
        }
      });
      return out;
    })
    .catch(function (error) {
      console.warn('[travelpayouts]', error.message);
      unique.forEach(function (url) { out.set(url, url); });
      return out;
    });
}

module.exports = { isConfigured, toPartnerUrl, toPartnerUrls, setFetch, clearCache };
