'use strict';
/*
 * Modelo de costos de CuántoSale.
 *
 * Todo lo que no viene de una fuente real se ESTIMA con reglas simples
 * (temporada, día de la semana, anticipación). Cuando un proveedor entrega un
 * precio real de vuelo (quote), reemplaza la estimación del pasaje y el
 * resultado lo marca como "real".º
 */

const MODES = {
  avion_mvd: { label: 'Vuelo desde Montevideo', short: 'Vuelo desde Montevideo', kind: 'flight', comfort: 3,
    tip: 'Salís desde Carrasco, sin cruces ni combinaciones.' },
  avion_ba: { label: 'Salir por Buenos Aires', short: 'Salir por Buenos Aires', kind: 'flight', comfort: 2,
    tip: 'Cruzás a Buenos Aires en ferry o bus y volás desde Aeroparque o Ezeiza.' },
  ferry: { label: 'Ferry desde Colonia', short: 'Ferry desde Colonia', kind: 'ground', comfort: 2,
    tip: 'Cruce corto en barco, sin pasar por aeropuertos.' },
  bus: { label: 'Bus', short: 'Bus', kind: 'ground', comfort: 1,
    tip: 'Tarda más, pero cuesta bastante menos que volar.' }
};

// pp = precio estimado por persona (ida y vuelta, US$). iata = código para buscar vuelos reales.
const DEST = {
  buz: { name: 'Búzios', iata: 'GIG', group: 'beach', f: 1.00, lodge: [60, 105, 185],
    modes: { avion_ba: { pp: 410, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 500, dur: 'unas 6 h con escala' } } },
  rio: { name: 'Río de Janeiro', iata: 'RIO', group: 'beach', f: 1.05, lodge: [55, 95, 170],
    modes: { avion_ba: { pp: 430, cross: 90, dur: 'unas 10 h en total' }, avion_mvd: { pp: 520, dur: 'unas 6 h con escala' } } },
  fln: { name: 'Florianópolis', iata: 'FLN', group: 'beach', f: 0.95, lodge: [50, 90, 160],
    modes: { bus: { pp: 200, dur: 'unas 22 h' }, avion_ba: { pp: 340, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 430, dur: 'unas 6 h con escala' } } },
  sao: { name: 'San Pablo', iata: 'SAO', group: 'city', f: 1.00, lodge: [50, 90, 160],
    modes: { avion_ba: { pp: 320, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 390, dur: 'unas 3 h de vuelo' } } },
  ssa: { name: 'Salvador de Bahía', iata: 'SSA', group: 'beach', f: 0.95, lodge: [45, 80, 150],
    modes: { avion_ba: { pp: 480, cross: 90, dur: 'unas 11 h en total' }, avion_mvd: { pp: 570, dur: 'unas 8 h con escala' } } },
  igu: { name: 'Foz de Iguazú', iata: 'IGU', group: 'city', f: 0.85, lodge: [40, 75, 130],
    modes: { bus: { pp: 160, dur: 'unas 18 h' }, avion_ba: { pp: 280, cross: 90, dur: 'unas 7 h en total' }, avion_mvd: { pp: 350, dur: 'unas 5 h con escala' } } },
  rec: { name: 'Recife', iata: 'REC', group: 'beach', f: 0.95, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 520, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 610, dur: 'unas 9 h con escala' } } },
  for: { name: 'Fortaleza', iata: 'FOR', group: 'beach', f: 0.95, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 540, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 630, dur: 'unas 10 h con escala' } } },
  mcz: { name: 'Maceió', iata: 'MCZ', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 510, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 600, dur: 'unas 9 h con escala' } } },
  nat: { name: 'Natal', iata: 'NAT', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 530, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 620, dur: 'unas 10 h con escala' } } },
  pip: { name: 'Pipa', iata: 'NAT', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 540, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 630, dur: 'unas 10 h con escala' } } },
  poa: { name: 'Porto Alegre', iata: 'POA', group: 'city', f: 0.85, lodge: [40, 75, 130],
    modes: { bus: { pp: 120, dur: 'unas 12 h' }, avion_ba: { pp: 250, cross: 90, dur: 'unas 6 h en total' }, avion_mvd: { pp: 310, dur: 'unas 2 h de vuelo' } } }
};
const TIERS = [
  { id: 'eco',     label: 'económico',  desc: 'Hostel u hotel simple', comfort: 1, meal: 25, local: 6,  transfer: 0.5 },
  { id: 'medio',   label: 'intermedio', desc: 'Hotel 3 estrellas',     comfort: 2, meal: 40, local: 10, transfer: 1 },
  { id: 'confort', label: 'confort',    desc: 'Hotel 4 estrellas',     comfort: 3, meal: 65, local: 18, transfer: 1.4 }
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

/* ---------- cálculo de una propuesta ---------- */
function calc(dk, modeId, ti, pax, dep, ret, today, quote) {
  const D = DEST[dk], M = D.modes[modeId], T = TIERS[ti], MO = MODES[modeId];
  const nights = daysBetween(dep, ret), days = nights + 1;
  const rooms = Math.ceil(pax / 2), cars = Math.ceil(pax / 4);
  const fm = flightMult(dk, dep, ret, today), flight = MO.kind === 'flight';
  const realFlight = flight && quote && quote.pp > 0;
  const base = realFlight ? quote.pp * pax : M.pp * pax * (flight ? fm : 1 + (fm - 1) * 0.5);
  const cross = (M.cross || 0) * pax * (1 + (fm - 1) * 0.3);
  const parts = {
    pasajes: base + cross,
    alojamiento: lodgingCost(dk, ti, dep, nights, rooms),
    comidas: T.meal * D.f * pax * days,
    local: T.local * D.f * pax * days,
    traslados: cars * 2 * 25 * D.f * T.transfer * (flight ? 1 : 0.5) + (modeId === 'avion_ba' ? cars * 2 * 20 : 0),
    extras: flight ? (pax * 45 + pax * 8 + (realFlight ? 0 : base * 0.06)) : pax * 8
  };
  let total = 0;
  Object.keys(parts).forEach(function (k) { parts[k] = Math.round(parts[k]); total += parts[k]; });
  return {
    id: modeId + '-' + ti, dk: dk, mode: modeId, modeLabel: MO.label, modeShort: MO.short,
    ti: ti, tierLabel: T.label, tierDesc: T.desc,
    parts: parts,
    sources: { pasajes: realFlight ? 'real' : 'estimado', alojamiento: 'estimado', comidas: 'estimado',
               local: 'estimado', traslados: 'estimado', extras: 'estimado' },
    total: total, pp: Math.round(total / pax), comfort: MO.comfort + T.comfort,
    nights: nights, dur: M.dur,
    quote: realFlight ? { airline: quote.airline || null, transfers: quote.transfers == null ? null : quote.transfers,
                          exact: !!quote.exact, foundDep: quote.foundDep || null, foundRet: quote.foundRet || null } : null
  };
}

function build(S, dep, ret, today, quotes) {
  const out = [];
  Object.keys(DEST[S.dest].modes).forEach(function (m) {
    for (let t = 0; t < TIERS.length; t++) out.push(calc(S.dest, m, t, S.pax, dep, ret, today, quotes ? quotes[m] : null));
  });
  out.sort(function (a, b) { return a.total - b.total; });
  return out;
}

function pick(S, list) {
  const within = list.filter(function (p) { return p.total <= S.budget; });
  if (!within.length) return { rec: list[0], fits: false };
  if (S.style === 'ahorro') return { rec: within[0], fits: true };
  if (S.style === 'comodo') {
    return { rec: within.slice().sort(function (a, b) { return b.comfort - a.comfort || a.total - b.total; })[0], fits: true };
  }
  let best = null, bs = -1;
  within.forEach(function (p) {
    const sc = 0.5 * ((p.comfort - 2) / 4) + 0.5 * (1 - p.total / Math.max(S.budget, 1));
    if (sc > bs) { bs = sc; best = p; }
  });
  return { rec: best, fits: true };
}

/*
 * Serie "mismo viaje, otra fecha". Para no pedir 15 consultas por búsqueda usamos el precio
 * de la fecha elegida (real si existe) y le aplicamos la diferencia que estima el modelo.
 */
function seriesFor(S, rec, dep, ret, today) {
  const est0 = calc(S.dest, rec.mode, rec.ti, S.pax, dep, ret, today, null).total;
  const out = [];
  for (let s = -7; s <= 7; s++) {
    const d1 = addDays(dep, s), d2 = addDays(ret, s);
    if (daysBetween(today, d1) < 1) continue;
    const est = calc(S.dest, rec.mode, rec.ti, S.pax, d1, d2, today, null).total;
    out.push({ shift: s, dep: iso(d1), total: Math.max(1, rec.total + (est - est0)) });
  }
  return out;
}

function tipsFor(S, rec, list, series) {
  const out = [];
  let best = null;
  series.forEach(function (x) { if (!best || x.total < best.total) best = x; });
  if (best && best.shift !== 0 && rec.total - best.total >= 15) {
    out.push({ kind: 'fecha', save: rec.total - best.total, shift: best.shift, dep: best.dep });
  }
  let bm = null;
  list.forEach(function (p) { if (p.ti === rec.ti && p.mode !== rec.mode && p.total < rec.total && (!bm || p.total < bm.total)) bm = p; });
  if (bm && rec.total - bm.total >= 15) {
    out.push({ kind: 'ruta', save: rec.total - bm.total, title: 'Probá: ' + MODES[bm.mode].label.toLowerCase(), text: MODES[bm.mode].tip });
  }
  let bt = null;
  list.forEach(function (p) { if (p.mode === rec.mode && p.ti < rec.ti && (!bt || p.total < bt.total)) bt = p; });
  if (bt && rec.total - bt.total >= 15) {
    out.push({ kind: 'alojamiento', save: rec.total - bt.total, title: 'Alojamiento ' + TIERS[bt.ti].label,
      text: TIERS[bt.ti].desc + '. Cambia el total más de lo que parece.' });
  }
  out.sort(function (a, b) { return b.save - a.save; });
  return out.slice(0, 3);
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
  let budget = Number(q.budget);
  if (!isFinite(budget) || budget < 0) budget = 0;
  budget = Math.min(budget, 1e6);
  const style = ['ahorro', 'eq', 'comodo'].indexOf(q.style) >= 0 ? q.style : 'eq';
  return { S: { dest: dest, dep: q.dep, ret: q.ret, pax: pax, budget: budget, style: style }, dep: dep, ret: ret, nights: nights };
}

function compute(S, dep, ret, today, quotes) {
  const list = build(S, dep, ret, today, quotes);
  const pk = pick(S, list), rec = pk.rec;
  const cozy = list.slice().sort(function (a, b) { return b.comfort - a.comfort || a.total - b.total; })[0];
  const series = seriesFor(S, rec, dep, ret, today);
  return {
    fits: pk.fits, recId: rec.id, cheapestId: list[0].id, cozyId: cozy.id,
    list: list, series: series, tips: tipsFor(S, rec, list, series)
  };
}

module.exports = { MODES, DEST, TIERS, getToday, addDays, iso, parse, daysBetween, calc, build, pick, seriesFor, tipsFor, validate, compute };
