'use strict';
/*
 * Vuelos con Duffel (unico proveedor: Ignav y SerpAPI ya no se usan). Expone getFlightQuote, priceForDate y
 * searchOutbound, que es lo que consume el agregador (index.js).
 *
 * Diferencias con Ignav, verificadas contra la API (test, MVD -> FLN 19/1 -> 26/1, 2 adultos):
 *  - Un offer_request devuelve cientos de ofertas (233 a Florianopolis, 529 a Rio) con el total ya para todos los
 *    pasajeros, en la moneda de la cuenta (USD): no hace falta convertir salvo que Duffel mande otra.
 *  - Las ofertas son reservables: cada una tiene id (off_...), vence en ~30 min (expires_at) y se paga con una orden.
 *    En esta etapa solo se usan los precios; `booking_token` lleva el id de la oferta para la reserva (fase siguiente).
 *  - En modo prueba (duffel_test_) aparece una aerolinea falsa "Duffel Airways" (ZZ). En produccion no.
 *
 * Duffel cobra un recargo por busquedas en exceso si hay muchas mas busquedas que reservas: por eso el cache de
 * index.js (48 h) y el tope diario (DUFFEL_DAILY_MAX) importan.
 */
const duffel = require('./duffel');
const { envVuelos } = require('./config-vuelos');

const CABIN_BY_CLASS = { 1: 'economy', 2: 'premium_economy', 3: 'business', 4: 'first' };
const CABIN_LABEL = { economy: 'Economy', premium_economy: 'Premium Economy', business: 'Business', first: 'First' };

function isConfigured() { return duffel.configurado(); }
function round2(v) { return Math.round(Number(v) * 100) / 100; }

// 1 = Economy, 2 = Premium economy, 3 = Business, 4 = First
function travelClassFor(style) {
  if (style === 'comodo') return Number(envVuelos('CABIN_COMODO')) || 2;
  if (style === 'business') return Number(envVuelos('CABIN_COMODO')) || 3;
  return 1;
}

/* Link a Google Flights con la busqueda armada (solo para "ver en otro sitio"; la reserva va por Duffel). */
function googleFlightsUrl(input) {
  const o = String(input.origin || '').toUpperCase(), d = String(input.destination || '').toUpperCase();
  const q = input.ret ? 'from ' + o + ' to ' + d + ' on ' + input.dep + ' through ' + input.ret : 'from ' + o + ' to ' + d + ' on ' + input.dep;
  return 'https://www.google.com/travel/flights?' + new URLSearchParams({ q: 'Flights ' + q }).toString();
}

/* Duffel cobra en la moneda de la cuenta (USD). Si alguna vez llega otra, se convierte con la cotizacion del dia;
   sin cotizacion NO se inventa un numero: se lanza un error y el agregador cae a la estimacion. */
const FX_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
let fx = { rates: null, hasta: 0, reintentarEn: 0 };
async function usdPor(moneda) {
  const code = String(moneda || 'USD').toUpperCase();
  if (code === 'USD') return 1;
  if (!(fx.rates && Date.now() < fx.hasta) && Date.now() >= fx.reintentarEn) {
    try {
      const r = await fetch(FX_URL, { signal: AbortSignal.timeout(9000), headers: { Accept: 'application/json' } });
      const j = await r.json();
      if (j && j.rates) fx = { rates: j.rates, hasta: Date.now() + 12 * 3600e3, reintentarEn: 0 };
      else fx.reintentarEn = Date.now() + 10 * 60e3;
    } catch (e) { fx.reintentarEn = Date.now() + 10 * 60e3; }
  }
  const rate = fx.rates && Number(fx.rates[code]);
  if (!(rate > 0)) { const e = new Error('Sin cotizacion para convertir ' + code + ' a USD.'); e.status = 502; throw e; }
  return 1 / rate;
}
async function toUsd(monto, moneda) { return round2(Number(monto) * await usdPor(moneda)); }

/* Minutos de una duracion ISO 8601 ("PT2H30M", "P1DT3H"). */
function minutos(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(String(iso || ''));
  if (!m) return 0;
  return (Number(m[1] || 0) * 24 + Number(m[2] || 0)) * 60 + Number(m[3] || 0);
}
function durationText(min) {
  const total = Math.round(Number(min));
  if (!Number.isFinite(total) || total <= 0) return '';
  const h = Math.floor(total / 60), r = total % 60;
  return (h ? h + ' h' : '') + (h && r ? ' ' : '') + (r ? r + ' min' : '');
}

function carriersOf(slice) {
  const names = [];
  ((slice && slice.segments) || []).forEach(function (s) {
    const c = s.operating_carrier || s.marketing_carrier || {};
    const n = c.name || c.iata_code;
    if (n && names.indexOf(n) < 0) names.push(n);
  });
  return names;
}
function stopsOf(slice) { return Math.max(0, ((slice && slice.segments) || []).length - 1); }

function mapLeg(slice) {
  const segs = (slice && slice.segments) || [];
  if (!segs.length) return null;
  const first = segs[0], last = segs[segs.length - 1];
  const carriers = carriersOf(slice);
  const mc = first.marketing_carrier || {};
  return {
    origin: { code: first.origin.iata_code, name: first.origin.name || first.origin.iata_code },
    destination: { code: last.destination.iata_code, name: last.destination.name || last.destination.iata_code },
    departure: first.departing_at || null,
    arrival: last.arriving_at || null,
    flight_number: String((mc.iata_code || '') + (first.marketing_carrier_flight_number || '')),
    airline: carriers.join(' · ') || null,
    stops: stopsOf(slice),
    duration: durationText(minutos(slice.duration)),
    carriers: carriers,
    segments: segs.map(function (s) {
      return {
        from: String(s.origin.iata_code || '').toUpperCase(), to: String(s.destination.iata_code || '').toUpperCase(),
        date: String(s.departing_at || '').slice(0, 10),
        airline: String((s.marketing_carrier || {}).iata_code || '').toUpperCase(), number: String(s.marketing_carrier_flight_number || '')
      };
    })
  };
}

async function totalUsd(oferta) {
  const cur = String(oferta.total_currency || 'USD').toUpperCase();
  return cur === 'USD' ? round2(oferta.total_amount) : toUsd(oferta.total_amount, cur);
}

async function buscar(input, adultos, travelClass) {
  const r = await duffel.buscarVuelos({
    origen: String(input.origin || '').toUpperCase(), destino: String(input.destination || '').toUpperCase(),
    ida: input.dep || input.departureDate, vuelta: input.ret || input.returnDate || null,
    adultos: adultos, cabina: CABIN_BY_CLASS[travelClass || 1] || 'economy'
  });
  return r.ofertas;
}

async function getFlightQuote(input) {
  if (!isConfigured()) return null;
  const pax = Math.max(1, Number(input.passengers) || 1);
  const ofertas = await buscar(input, pax, travelClassFor(input.style));
  const mejor = ofertas[0];
  if (!mejor) return null;
  const total = await totalUsd(mejor);
  if (!(total > 0)) return null;
  return {
    pp: round2(total / pax), airline: carriersOf(mejor.slices[0]).join(' · ') || null, transfers: stopsOf(mejor.slices[0]),
    exact: true, foundDep: input.dep, foundRet: input.ret, source: 'duffel'
  };
}

async function priceForDate(input) {
  const pax = Math.max(1, Number(input.passengers) || 1);
  const ofertas = await buscar(input, pax, travelClassFor(input.style));
  const mejor = ofertas[0];
  if (!mejor) return null;
  const total = await totalUsd(mejor);
  if (!(total > 0)) return null;
  return { pp: round2(total / pax), total: total, exact: true, airline: carriersOf(mejor.slices[0]).join(' · ') || null, stops: stopsOf(mejor.slices[0]), priceLevel: null };
}

async function searchOutbound(input) {
  const pax = Math.max(1, Number(input.passengers) || 1);
  const ofertas = await buscar(input, pax, input.travelClass || 1);
  const cabin = CABIN_BY_CLASS[input.travelClass || 1] || 'economy';
  const offers = [];
  for (const o of ofertas) {
    const out = mapLeg(o.slices[0]);
    if (!out) continue;
    const back = mapLeg(o.slices[1]);
    const usd = await totalUsd(o);
    offers.push({
      id: o.id,
      provider: 'duffel',
      airline: out.airline || (o.owner && o.owner.name) || 'Aerolínea',
      logo: (o.owner && o.owner.logo_symbol_url) || null,
      cabin_class: cabin, cabin_label: CABIN_LABEL[cabin],
      departure: out.departure, arrival: out.arrival,
      return_departure: back ? back.departure : null, return_arrival: back ? back.arrival : null,
      departure_airport: out.origin, arrival_airport: out.destination,
      flight_number: out.flight_number, stops: out.stops, duration: out.duration,
      price_usd: usd > 0 ? usd : null,
      original_price: String(o.total_amount), original_currency: String(o.total_currency || ''),
      trip_type: input.returnDate ? 'round_trip' : 'one_way',
      outbound: out, inbound: back,
      passenger_ids: (o.passengers || []).map(function (p) { return p.id; }),
      recommendation: 'Tarifa disponible',
      departure_token: null,
      booking_token: o.id,                 // id de la oferta de Duffel: con esto se crea la orden (fase de reserva)
      expires_at: o.expires_at || null,
      book_url: googleFlightsUrl({ origin: input.origin, destination: input.destination, dep: input.departureDate, ret: input.returnDate })
    });
  }
  return { offers: offers };
}

module.exports = { travelClassFor: travelClassFor, googleFlightsUrl: googleFlightsUrl, isConfigured: isConfigured, getFlightQuote: getFlightQuote, priceForDate: priceForDate, searchOutbound: searchOutbound };
