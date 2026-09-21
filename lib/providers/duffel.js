'use strict';
/*
 * Adaptador de vuelos con Duffel (https://duffel.com/docs/api/offer-requests).
 *
 * Hace una búsqueda ida y vuelta para 1 adulto y devuelve el
 * precio MÁS BAJO por persona en US$. El server lo multiplica por la cantidad de viajeros.
 *
 * Requiere la variable DUFFEL_TOKEN (token de tu cuenta Duffel, nunca en el frontend).
 */

const ENDPOINT = 'https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=15000';

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
 * @param {object} p  { token, origin, destination, dep, ret, cabinClass?, fx?, maxConnections?, fetchImpl? }
 * @returns {Promise<object|null>} quote o null si no hay ofertas
 */
async function getFlightQuote(p) {
  const fetchImpl = p.fetchImpl || fetch;
  async function request(cabinClass) {
    const data = {
      slices: [
        { origin: p.origin, destination: p.destination, departure_date: p.dep },
        { origin: p.destination, destination: p.origin, departure_date: p.ret }
      ],
      passengers: [{ type: 'adult' }], cabin_class: cabinClass
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
    return parseOffers(json, p.fx);
  }

  const requested = p.cabinClass || 'economy';
  const quote = await request(requested);
  // Algunas rutas no publican Premium Economy; intentamos Business antes de
  // caer al modo estimado sin alterar las búsquedas económicas.
  return quote || (requested === 'premium_economy' ? request('business') : null);
}

module.exports = { getFlightQuote, parseOffers, toUsd };
