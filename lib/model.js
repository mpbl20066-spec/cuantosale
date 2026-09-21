'use strict';
/*
 * Modelo de costos de CuántoSale.
 *
 * El servidor devuelve COMPONENTES independientes (transportes, hoteles, seguro, estilos de viaje
 * y una serie de fechas). El frontend los combina en tiempo real según lo que elija la persona.
 *
 * Todo lo que no viene de una fuente real se ESTIMA con reglas simples (temporada, día de la
 * semana, anticipación). Cuando un proveedor entrega un precio real de vuelo, reemplaza la
 * estimación del pasaje y queda marcado como "real".
 */

const MODES = {
  avion_mvd: { label: 'Vuelo desde Montevideo', short: 'Vuelo desde Montevideo', kind: 'flight', comfort: 3,
    tip: 'Salís desde Carrasco, sin cruces ni combinaciones.' },
  avion_ba: { label: 'Salir por Buenos Aires', short: 'Salir por Buenos Aires', kind: 'flight', comfort: 2,
    tip: 'Cruzás a Buenos Aires en ferry o bus y volás desde Aeroparque o Ezeiza.' },
  ferry: { label: 'Ferry desde Colonia', short: 'Ferry desde Colonia', kind: 'ground', comfort: 2,
    tip: 'Cruce corto en barco, sin pasar por aeropuertos.' },
  bus: { label: 'Ómnibus', short: 'Ómnibus', kind: 'ground', comfort: 1,
    tip: 'Tarda más, pero cuesta bastante menos que volar.' }
};

// pp = precio estimado por persona (ida y vuelta, US$). ins = seguro estimado por persona por día.
const DEST = {
  ba:  { name: 'Buenos Aires', iata: 'BUE', bookingAirport: 'AEP', group: 'city', f: 0.90, ins: 2.5, lodge: [45, 80, 140],
    modes: { ferry: { pp: 110, dur: 'unas 3 h' }, bus: { pp: 75, dur: 'unas 9 h' }, avion_mvd: { pp: 190, dur: '1 h de vuelo' } } },
  fln: { name: 'Florianópolis', iata: 'FLN', bookingAirport: 'FLN', group: 'beach', f: 0.95, ins: 3, lodge: [50, 90, 160],
    modes: { bus: { pp: 200, dur: 'unas 22 h' }, avion_ba: { pp: 340, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 430, dur: 'unas 6 h con escala' } } },
  rio: { name: 'Río de Janeiro', iata: 'RIO', bookingAirport: 'SDU', group: 'beach', f: 1.05, ins: 3, lodge: [55, 95, 170],
    modes: { avion_ba: { pp: 430, cross: 90, dur: 'unas 10 h en total' }, avion_mvd: { pp: 520, dur: 'unas 6 h con escala' } } },
  scl: { name: 'Santiago de Chile', iata: 'SCL', bookingAirport: 'SCL', group: 'city', f: 1.00, ins: 3, lodge: [55, 95, 165],
    modes: { avion_ba: { pp: 300, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 390, dur: 'unas 3 h de vuelo' } } },
  pdc: { name: 'Punta Cana', iata: 'PUJ', bookingAirport: 'PUJ', group: 'beach', f: 1.30, ins: 4, lodge: [70, 130, 260],
    modes: { avion_ba: { pp: 870, cross: 90, dur: 'unas 14 h en total' }, avion_mvd: { pp: 980, dur: 'unas 12 h con escala' } } },
  mad: { name: 'Madrid', iata: 'MAD', bookingAirport: 'MAD', group: 'europe', f: 1.40, ins: 6, lodge: [70, 115, 190],
    modes: { avion_ba: { pp: 990, cross: 90, dur: 'unas 16 h en total' }, avion_mvd: { pp: 1070, dur: 'unas 13 h de vuelo' } } }
};

// Categorías de alojamiento
const TIERS = [
  { id: 'eco',     label: 'económico',  desc: 'Hostel u hotel simple', comfort: 1 },
  { id: 'medio',   label: 'intermedio', desc: 'Hotel 3 estrellas',     comfort: 2 },
  { id: 'confort', label: 'confort',    desc: 'Hotel 4 estrellas',     comfort: 3 }
];

// Estilos de viaje: definen el gasto diario en comidas y transporte local (US$ por persona por día, antes de ajustar por destino)
const STYLES = [
  { id: 'mochilero', label: 'Mochilero', meal: 25, local: 6,  transfer: 0.5, tier: 0, note: 'Comidas simples y transporte público.' },
  { id: 'estandar',  label: 'Estándar',  meal: 40, local: 10, transfer: 1,   tier: 1, note: 'Restaurantes comunes y algún taxi.' },
  { id: 'confort',   label: 'Confort',   meal: 65, local: 18, transfer: 1.4, tier: 2, note: 'Buenos restaurantes y traslados privados.' }
];

const SEASON = {
  beach:  [1.45, 1.35, 0.95, 0.85, 0.75, 0.80, 1.15, 0.90, 0.85, 0.90, 0.95, 1.30],
  city:   [1.10, 1.00, 1.00, 1.00, 0.90, 0.90, 1.20, 0.95, 0.95, 1.00, 1.00, 1.25],
  europe: [0.85, 0.85, 0.95, 1.10, 1.10, 1.20, 1.35, 1.30, 1.10, 1.00, 0.85, 1.10]
};
const WD = [1.10, 0.98, 0.93, 0.92, 1.00, 1.12, 1.05];

/* ---------- utilidades de fecha ---------- */
function getToday() { const t = new Date(); t.setHours(12, 0, 0, 0); return t; }
function addDays(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parse(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
function daysBetween(a, b) { return Math.round((b - a) / 864e5); }
function hash(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; }
function noise(d, k) { return ((hash(iso(d) + k) % 1000) / 1000 - 0.5) * 0.12; }

/* ---------- estimaciones ---------- */
function advance(dep, today) { const n = daysBetween(today, dep); return n < 21 ? 1.25 : (n < 45 ? 1.10 : (n > 120 ? 0.95 : 1)); }
function flightMult(dk, dep, ret, today) {
  const g = DEST[dk].group;
  let s = SEASON[g][dep.getMonth()] * 0.6 + SEASON[g][ret.getMonth()] * 0.4;
  s = 1 + (s - 1) * 0.7;
  const w = (WD[dep.getDay()] + WD[ret.getDay()]) / 2;
  const n = 1 + (noise(dep, dk) + noise(ret, dk)) / 2;
  return s * w * n * advance(dep, today);
}
function lodgingCost(dk, ti, dep, nights, rooms) {
  const g = DEST[dk].group; let t = 0;
  for (let i = 0; i < nights; i++) {
    const d = addDays(dep, i), wk = (d.getDay() === 5 || d.getDay() === 6) ? 1.1 : 1;
    t += DEST[dk].lodge[ti] * SEASON[g][d.getMonth()] * wk * (1 + noise(d, dk + ti) * 0.6);
  }
  return t * rooms;
}

/* ---------- componentes ---------- */

/** Una opción de transporte. `quote` (opcional) es el resultado de un proveedor: si trae pp > 0, es precio real. */
function transportOption(dk, modeId, pax, dep, ret, today, quote) {
  const D = DEST[dk], M = D.modes[modeId], MO = MODES[modeId];
  const fm = flightMult(dk, dep, ret, today), flight = MO.kind === 'flight';
  const real = !!(flight && quote && quote.pp > 0);
  const cars = Math.ceil(pax / 4);
  const base = real ? quote.pp * pax : M.pp * pax * (flight ? fm : 1 + (fm - 1) * 0.5);
  const cross = (M.cross || 0) * pax * (1 + (fm - 1) * 0.3);
  const extras = flight ? (pax * 45 + pax * 8 + (real ? 0 : base * 0.06)) : pax * 8;   // valijas, tasas y seguro de equipaje
  const pasajes = Math.round(base + cross), ext = Math.round(extras);
  return {
    id: modeId, mode: modeId, label: MO.label, short: MO.short, kind: MO.kind, comfort: MO.comfort, tip: MO.tip,
    dur: M.dur,
    price: pasajes + ext, parts: { pasajes: pasajes, extras: ext }, pp: Math.round((pasajes + ext) / pax),
    // traslados entre aeropuerto/terminal y el alojamiento, antes de ajustar por estilo de viaje
    transferBase: Math.round(cars * 2 * 25 * D.f * (flight ? 1 : 0.5) + (modeId === 'avion_ba' ? cars * 2 * 20 : 0)),
    source: real ? 'real' : 'estimado',
    quote: real ? { airline: quote.airline || null, transfers: quote.transfers == null ? null : quote.transfers,
                    exact: !!quote.exact, foundDep: quote.foundDep || null, foundRet: quote.foundRet || null } : null,
    bookingUrl: null, bookingKind: (quote && quote.bookingKind) || 'external'
  };
}

function lodgingOptions(dk, pax, dep, nights, properties) {
  const rooms = Math.ceil(pax / 2);
  const estimated = TIERS.map(function (T, ti) {
    const total = Math.round(lodgingCost(dk, ti, dep, nights, rooms));
    return { id: T.id, tierId: T.id, tier: ti, kind: 'tier', name: 'Hotel ' + T.label, label: T.label, desc: T.desc,
      stars: null, reviewScore: null, reviews: null, comfort: T.comfort, rooms: rooms, nights: nights,
      rate: Math.round(total / (rooms * nights)), total: total, source: 'estimado', bookingUrl: null };
  });
  if (!properties || !properties.length) return estimated;
  // Propiedades reales (Booking.com) por categoría; si una categoría no tiene, queda la estimación
  const out = [];
  TIERS.forEach(function (T, ti) {
    const props = properties.filter(function (p) { return p.tier === ti; });
    if (!props.length) { out.push(estimated[ti]); return; }
    props.sort(function (a, b) { return a.total - b.total; }).forEach(function (p) {
      const total = Math.round(p.total);
      out.push({ id: p.id, tierId: T.id, tier: ti, kind: 'property', name: p.name, label: T.label,
        desc: (p.stars ? p.stars + (p.stars === 1 ? ' estrella' : ' estrellas') : T.desc) +
          (p.reviewScore ? '. Puntaje ' + String(p.reviewScore).replace('.', ',') + (p.reviews ? ' (' + p.reviews + ' opiniones)' : '') : ''),
        stars: p.stars, reviewScore: p.reviewScore, reviews: p.reviews, comfort: T.comfort, rooms: rooms, nights: nights,
        rate: Math.round(total / (rooms * nights)), total: total, source: 'real', bookingUrl: p.url });
    });
  });
  return out;
}

/**
 * Serie "mismo viaje, otra fecha". Para no pedir 15 consultas por búsqueda usamos el precio de la
 * fecha elegida (real si existe) y le aplicamos la diferencia que estima el modelo.
 */
function seriesFor(S, transport, dep, ret, nights, today) {
  const rooms = Math.ceil(S.pax / 2);
  const est0 = {};
  transport.forEach(function (t) { est0[t.id] = transportOption(S.dest, t.mode, S.pax, dep, ret, today, null).price; });
  const base0 = {};
  TIERS.forEach(function (T, ti) { base0[T.id] = Math.round(lodgingCost(S.dest, ti, dep, nights, rooms)); });
  const out = [];
  for (let s = -7; s <= 7; s++) {
    const d1 = addDays(dep, s), d2 = addDays(ret, s);
    if (daysBetween(today, d1) < 1) continue;
    const row = { shift: s, dep: iso(d1), transport: {}, lodging: {} };
    transport.forEach(function (t) {
      const est = transportOption(S.dest, t.mode, S.pax, d1, d2, today, null).price;
      row.transport[t.id] = Math.max(1, t.price + (est - est0[t.id]));
    });
    TIERS.forEach(function (T, ti) { row.lodging[T.id] = Math.round(lodgingCost(S.dest, ti, d1, nights, rooms)) - base0[T.id]; });   // diferencia frente a la fecha elegida
    out.push(row);
  }
  return out;
}

/* ---------- validación de entrada ---------- */
function validate(q, today) {
  const fail = function (m) { const e = new Error(m); e.status = 400; throw e; };
  const dest = String(q.dest || '');
  if (!DEST[dest]) fail('Destino no válido.');
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(q.dep || '') || !re.test(q.ret || '')) fail('Fechas no válidas.');
  const dep = parse(q.dep), ret = parse(q.ret);
  if (isNaN(dep) || isNaN(ret)) fail('Fechas no válidas.');
  if (daysBetween(today, dep) < 1) fail('La fecha de ida tiene que ser a partir de mañana.');
  const nights = daysBetween(dep, ret);
  if (nights < 1) fail('La vuelta tiene que ser después de la ida.');
  if (nights > 30) fail('Por ahora calculamos viajes de hasta 30 noches.');
  const pax = parseInt(q.pax, 10);
  if (!(pax >= 1 && pax <= 10)) fail('La cantidad de viajeros tiene que ser entre 1 y 10.');
  return { S: { dest: dest, dep: q.dep, ret: q.ret, pax: pax }, dep: dep, ret: ret, nights: nights };
}

/**
 * @param prov  { transport: {modeId: {pp?, airline?, bookingUrl}}, lodging: {bookingUrl}, insurance: {bookingUrl} }
 */
function compute(S, dep, ret, today, prov) {
  prov = prov || {};
  const D = DEST[S.dest];
  const nights = daysBetween(dep, ret), days = nights + 1, rooms = Math.ceil(S.pax / 2);
  const tprov = prov.transport || {};

  const transport = Object.keys(D.modes).map(function (m) {
    const o = transportOption(S.dest, m, S.pax, dep, ret, today, tprov[m]);
    o.bookingUrl = (tprov[m] && tprov[m].bookingUrl) || null;
    if (tprov[m] && tprov[m].bookingKind) o.bookingKind = tprov[m].bookingKind;
    return o;
  }).sort(function (a, b) { return a.price - b.price; });

  const lodging = lodgingOptions(S.dest, S.pax, dep, nights, prov.lodging && prov.lodging.properties);
  lodging.forEach(function (l) { if (!l.bookingUrl) l.bookingUrl = (prov.lodging && prov.lodging.bookingUrl) || null; });

  const insurance = {
    perPersonDay: D.ins, total: Math.round(D.ins * S.pax * days), source: 'estimado',
    bookingUrl: (prov.insurance && prov.insurance.bookingUrl) || null
  };
  const styles = STYLES.map(function (st) {
    return { id: st.id, label: st.label, note: st.note, tier: st.tier, transfer: st.transfer,
      meal: Math.round(st.meal * D.f), local: Math.round(st.local * D.f) };
  });

  return {
    days: days, rooms: rooms, nights: nights,
    transport: transport, lodging: lodging, insurance: insurance, styles: styles,
    series: seriesFor(S, transport, dep, ret, nights, today)
  };
}

module.exports = { MODES, DEST, TIERS, STYLES, getToday, addDays, iso, parse, daysBetween, transportOption, lodgingOptions, validate, compute };
