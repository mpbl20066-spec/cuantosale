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
    tip: 'Tarda más, pero cuesta bastante menos que volar.' },
  auto: { label: 'Auto / Roadtrip', short: 'Auto / Roadtrip', kind: 'roadtrip', comfort: 2,
    tip: 'Viajás a tu ritmo; el cálculo incluye combustible y peajes de ida y vuelta.' }
};

const ROADTRIP_ROUTES = {
  fln: { km: 720, tolls: 42, hours: 9 }, rio: { km: 1900, tolls: 120, hours: 23 },
  buz: { km: 2050, tolls: 128, hours: 25 }, igu: { km: 1050, tolls: 76, hours: 14 },
  ssa: { km: 3300, tolls: 205, hours: 40 }, sao: { km: 2050, tolls: 132, hours: 25 },
  poa: { km: 800, tolls: 55, hours: 10 }, rec: { km: 4500, tolls: 270, hours: 54 },
  for: { km: 5100, tolls: 300, hours: 62 }, mcz: { km: 4100, tolls: 245, hours: 49 },
  nat: { km: 4700, tolls: 280, hours: 57 }, pip: { km: 4750, tolls: 282, hours: 58 }
};
const ROADTRIP_ALLOWED_DESTINATIONS = new Set(['rio', 'fln', 'bcm', 'gram', 'canela', 'igu', 'poa']);

function isRoadtripAllowed(destKey) {
  return ROADTRIP_ALLOWED_DESTINATIONS.has(String(destKey || '').toLowerCase());
}

// pp = precio estimado por persona (ida y vuelta, US$). iata = código para buscar vuelos reales.
const DEST = {
  buz: { name: 'Búzios', iata: 'GIG', group: 'beach', f: 1.00, lodge: [60, 105, 185],
    modes: { avion_ba: { pp: 410, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 500, dur: 'unas 6 h con escala' } } },
  arraial: { name: 'Arraial do Cabo', iata: 'GIG', group: 'beach', f: 0.98, lodge: [55, 95, 165],
    modes: { avion_ba: { pp: 390, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 480, dur: 'unas 6 h con escala' } } },
  cabo: { name: 'Cabo Frio', iata: 'GIG', group: 'beach', f: 0.98, lodge: [52, 92, 160],
    modes: { avion_ba: { pp: 390, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 470, dur: 'unas 6 h con escala' } } },
  ilha: { name: 'Ilha Grande', iata: 'GIG', group: 'beach', f: 0.99, lodge: [60, 100, 175],
    modes: { avion_ba: { pp: 410, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 500, dur: 'unas 6 h con escala' } } },
  paraty: { name: 'Paraty', iata: 'GIG', group: 'beach', f: 0.98, lodge: [58, 100, 170],
    modes: { avion_ba: { pp: 420, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 510, dur: 'unas 6 h con escala' } } },
  ilhabela: { name: 'Ilhabela', iata: 'GRU', group: 'beach', f: 1.02, lodge: [60, 105, 180],
    modes: { avion_ba: { pp: 430, cross: 90, dur: 'unas 10 h en total' }, avion_mvd: { pp: 520, dur: 'unas 7 h con escala' } } },
  ubatuba: { name: 'Ubatuba', iata: 'GRU', group: 'beach', f: 1.00, lodge: [58, 102, 175],
    modes: { avion_ba: { pp: 420, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 510, dur: 'unas 7 h con escala' } } },
  rio: { name: 'Río de Janeiro', iata: 'RIO', group: 'beach', f: 1.05, lodge: [55, 95, 170],
    modes: { avion_ba: { pp: 430, cross: 90, dur: 'unas 10 h en total' }, avion_mvd: { pp: 520, dur: 'unas 6 h con escala' } } },
  angra: { name: 'Angra dos Reis', iata: 'GIG', group: 'beach', f: 1.00, lodge: [58, 100, 175],
    modes: { avion_ba: { pp: 430, cross: 90, dur: 'unas 10 h en total' }, avion_mvd: { pp: 520, dur: 'unas 6 h con escala' } } },
  sao: { name: 'São Paulo', iata: 'SAO', group: 'city', f: 1.00, lodge: [50, 90, 160],
    modes: { avion_ba: { pp: 320, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 390, dur: 'unas 3 h de vuelo' } } },
  bho: { name: 'Belo Horizonte', iata: 'CNF', group: 'city', f: 0.92, lodge: [48, 88, 155],
    modes: { avion_ba: { pp: 290, cross: 90, dur: 'unas 7 h en total' }, avion_mvd: { pp: 360, dur: 'unas 4 h con escala' } } },
  curitiba: { name: 'Curitiba', iata: 'CWB', group: 'city', f: 0.90, lodge: [42, 80, 140],
    modes: { avion_ba: { pp: 260, cross: 90, dur: 'unas 7 h en total' }, avion_mvd: { pp: 330, dur: 'unas 4 h con escala' } } },
  porto: { name: 'Porto de Galinhas', iata: 'REC', group: 'beach', f: 0.96, lodge: [55, 95, 165],
    modes: { avion_ba: { pp: 470, cross: 90, dur: 'unas 11 h en total' }, avion_mvd: { pp: 540, dur: 'unas 8 h con escala' } } },
  mcz: { name: 'Maceió', iata: 'MCZ', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 510, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 600, dur: 'unas 9 h con escala' } } },
  maragogi: { name: 'Maragogi', iata: 'MCZ', group: 'beach', f: 0.94, lodge: [48, 88, 155],
    modes: { avion_ba: { pp: 500, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 590, dur: 'unas 9 h con escala' } } },
  nat: { name: 'Natal', iata: 'NAT', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 530, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 620, dur: 'unas 10 h con escala' } } },
  pip: { name: 'Pipa', iata: 'NAT', group: 'beach', f: 0.90, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 540, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 630, dur: 'unas 10 h con escala' } } },
  trancoso: { name: 'Trancoso / Arraial d’Ajuda', iata: 'SSA', group: 'beach', f: 0.94, lodge: [58, 105, 180],
    modes: { avion_ba: { pp: 520, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 610, dur: 'unas 9 h con escala' } } },
  ssa: { name: 'Salvador de Bahía', iata: 'SSA', group: 'beach', f: 0.95, lodge: [45, 80, 150],
    modes: { avion_ba: { pp: 480, cross: 90, dur: 'unas 11 h en total' }, avion_mvd: { pp: 570, dur: 'unas 8 h con escala' } } },
  for: { name: 'Fortaleza / Jericoacoara', iata: 'FOR', group: 'beach', f: 0.95, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 540, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 630, dur: 'unas 10 h con escala' } } },
  jericoacoara: { name: 'Jericoacoara', iata: 'FOR', group: 'beach', f: 0.96, lodge: [47, 90, 160],
    modes: { avion_ba: { pp: 560, cross: 90, dur: 'unas 13 h en total' }, avion_mvd: { pp: 650, dur: 'unas 10 h con escala' } } },
  morro: { name: 'Morro de São Paulo', iata: 'SSA', group: 'beach', f: 0.94, lodge: [48, 90, 160],
    modes: { avion_ba: { pp: 500, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 590, dur: 'unas 9 h con escala' } } },
  fernando: { name: 'Fernando de Noronha', iata: 'NVT', group: 'beach', f: 1.12, lodge: [80, 145, 240],
    modes: { avion_ba: { pp: 620, cross: 90, dur: 'unas 15 h en total' }, avion_mvd: { pp: 710, dur: 'unas 11 h con escala' } } },
  fln: { name: 'Florianópolis', iata: 'FLN', group: 'beach', f: 0.95, lodge: [50, 90, 160],
    modes: { bus: { pp: 200, dur: 'unas 22 h' }, avion_ba: { pp: 340, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 430, dur: 'unas 6 h con escala' } } },
  camboriu: { name: 'Camboriú', iata: 'FLN', group: 'beach', f: 0.95, lodge: [52, 94, 170],
    modes: { bus: { pp: 210, dur: 'unas 22 h' }, avion_ba: { pp: 350, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 440, dur: 'unas 6 h con escala' } } },
  bombinhas: { name: 'Bombinhas', iata: 'FLN', group: 'beach', f: 0.94, lodge: [52, 96, 170],
    modes: { bus: { pp: 220, dur: 'unas 23 h' }, avion_ba: { pp: 360, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 450, dur: 'unas 6 h con escala' } } },
  rosa: { name: 'Praia do Rosa', iata: 'FLN', group: 'beach', f: 0.93, lodge: [54, 98, 175],
    modes: { bus: { pp: 230, dur: 'unas 23 h' }, avion_ba: { pp: 370, cross: 90, dur: 'unas 9 h en total' }, avion_mvd: { pp: 460, dur: 'unas 6 h con escala' } } },
  bcm: { name: 'Balneário Camboriú', iata: 'FLN', group: 'beach', f: 0.96, lodge: [52, 92, 165],
    modes: { bus: { pp: 190, dur: 'unas 20 h' }, avion_ba: { pp: 330, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 420, dur: 'unas 5 h con escala' } } },
  gram: { name: 'Gramado', iata: 'POA', group: 'nature', f: 0.88, lodge: [48, 89, 155],
    modes: { bus: { pp: 160, dur: 'unas 18 h' }, avion_ba: { pp: 300, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 380, dur: 'unas 4 h con escala' } } },
  canela: { name: 'Canela', iata: 'POA', group: 'nature', f: 0.88, lodge: [50, 90, 160],
    modes: { bus: { pp: 160, dur: 'unas 18 h' }, avion_ba: { pp: 300, cross: 90, dur: 'unas 8 h en total' }, avion_mvd: { pp: 380, dur: 'unas 4 h con escala' } } },
  igu: { name: 'Foz de Iguazú', iata: 'IGU', group: 'city', f: 0.85, lodge: [40, 75, 130],
    modes: { bus: { pp: 160, dur: 'unas 18 h' }, avion_ba: { pp: 280, cross: 90, dur: 'unas 7 h en total' }, avion_mvd: { pp: 350, dur: 'unas 5 h con escala' } } },
  rec: { name: 'Recife', iata: 'REC', group: 'beach', f: 0.95, lodge: [45, 85, 150],
    modes: { avion_ba: { pp: 520, cross: 90, dur: 'unas 12 h en total' }, avion_mvd: { pp: 610, dur: 'unas 9 h con escala' } } },
  poa: { name: 'Porto Alegre', iata: 'POA', group: 'city', f: 0.85, lodge: [40, 75, 130],
    modes: { bus: { pp: 120, dur: 'unas 12 h' }, avion_ba: { pp: 250, cross: 90, dur: 'unas 6 h en total' }, avion_mvd: { pp: 310, dur: 'unas 2 h de vuelo' } } }
};
const TIERS = [
  { id: 'eco',     label: 'económico',  desc: 'Hostel u hotel simple', comfort: 1, meal: 25, local: 6,  transfer: 0.5 },
  { id: 'medio',   label: 'intermedio', desc: 'Hotel 3 estrellas',     comfort: 2, meal: 40, local: 10, transfer: 1 },
  { id: 'confort', label: 'confort',    desc: 'Hotel 4 estrellas',     comfort: 3, meal: 65, local: 18, transfer: 1.4 }
];

// Valores diarios de referencia en USD basados en precios de mercado locales.
// Se aplican por noche y por pasajero, sin factores estacionales.
const REAL_COSTS = {
  foodPerDay: { eco: 14, medio: 28, confort: 55 },
  localTransportPerDay: { standard: 9, beachSpecific: 12 },
  beachSpecificDestinations: ['buz', 'pip']
};

// Costos diarios por destino (USD por persona). Cada destino conserva sus
// propios valores para movilidad y gastronomía, sin aplicar categorías globales.
const DESTINATION_COSTS = {
  sao: { transport: { eco: 22, confort: 48 }, food: { casual: 35, moderado: 70, gourmet: 125 } },
  buz: { transport: { eco: 18, confort: 38 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  arraial: { transport: { eco: 14, confort: 28 }, food: { casual: 25, moderado: 45, gourmet: 75 } },
  cabo: { transport: { eco: 12, confort: 25 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  ilha: { transport: { eco: 10, confort: 30 }, food: { casual: 28, moderado: 52, gourmet: 90 } },
  paraty: { transport: { eco: 12, confort: 26 }, food: { casual: 24, moderado: 44, gourmet: 75 } },
  ilhabela: { transport: { eco: 16, confort: 35 }, food: { casual: 30, moderado: 58, gourmet: 95 } },
  ubatuba: { transport: { eco: 15, confort: 32 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  rio: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 95 } },
  bho: { transport: { eco: 14, confort: 28 }, food: { casual: 22, moderado: 42, gourmet: 75 } },
  porto: { transport: { eco: 15, confort: 32 }, food: { casual: 28, moderado: 52, gourmet: 85 } },
  mcz: { transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 80 } },
  maragogi: { transport: { eco: 13, confort: 28 }, food: { casual: 24, moderado: 45, gourmet: 75 } },
  nat: { transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 48, gourmet: 80 } },
  pip: { transport: { eco: 16, confort: 35 }, food: { casual: 30, moderado: 55, gourmet: 90 } },
  trancoso: { transport: { eco: 20, confort: 45 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  ssa: { transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 85 } },
  for: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  jericoacoara: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 100 } },
  fernando: { transport: { eco: 30, confort: 75 }, food: { casual: 50, moderado: 95, gourmet: 160 } },
  fln: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  bcm: { transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  gram: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 62, gourmet: 110 } },
  canela: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 62, gourmet: 110 } },
  igu: { transport: { eco: 12, confort: 25 }, food: { casual: 22, moderado: 40, gourmet: 70 } },
  angra: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 95 } },
  curitiba: { transport: { eco: 22, confort: 48 }, food: { casual: 35, moderado: 70, gourmet: 125 } },
  morro: { transport: { eco: 20, confort: 45 }, food: { casual: 38, moderado: 70, gourmet: 120 } },
  camboriu: { transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 50, gourmet: 85 } },
  bombinhas: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } },
  rosa: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } }
};
function destinationCosts(destKey) { return DESTINATION_COSTS[destKey] || DESTINATION_COSTS.rio; }

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
  const season = SEASON[g] || SEASON.beach;
  let s = season[dep.getMonth()] * 0.6 + season[ret.getMonth()] * 0.4;
  s = 1 + (s - 1) * 0.7;
  const w = (WD[dep.getDay()] + WD[ret.getDay()]) / 2;
  const n = 1 + (noise(dep, dk) + noise(ret, dk)) / 2;
  return s * w * n * advance(dep, today);
}
function lodgingCost(dk, ti, dep, nights, rooms) {
  const g = DEST[dk].group, season = SEASON[g] || SEASON.beach; let t = 0;
  for (let i = 0; i < nights; i++) {
    const d = addDays(dep, i), wk = (d.getDay() === 5 || d.getDay() === 6) ? 1.1 : 1;
    t += DEST[dk].lodge[ti] * season[d.getMonth()] * wk * (1 + noise(d, dk + ti) * 0.6);
  }
  return t * rooms;
}

function roadtripCost(dk, kmPerLiter, fuelPriceUsd) {
  const route = ROADTRIP_ROUTES[dk];
  if (!route) return null;
  const consumption = Number(kmPerLiter);
  const safeConsumption = Number.isFinite(consumption) && consumption >= 3 && consumption <= 40 ? consumption : 12;
  const fuelPrice = Number(fuelPriceUsd) > 0 ? Number(fuelPriceUsd) : 1.2;
  const liters = Math.round((route.km * 2 / safeConsumption) * 10) / 10;
  const fuelUsd = Math.round(liters * fuelPrice);
  return { distanceKm: route.km, roundTripKm: route.km * 2, kmPerLiter: safeConsumption, liters: liters,
    fuelPriceUsd: fuelPrice, fuelUsd: fuelUsd, tollsUsd: route.tolls, totalUsd: fuelUsd + route.tolls,
    hours: route.hours, source: 'estimación de ruta ida y vuelta, combustible en Brasil y peajes' };
}

/* ---------- cálculo de una propuesta ---------- */
function calc(dk, modeId, ti, pax, dep, ret, today, quote, kmPerLiter, fuelPriceUsd) {
  const D = DEST[dk], roadtrip = modeId === 'auto' ? roadtripCost(dk, kmPerLiter, fuelPriceUsd) : null;
  const M = D.modes[modeId] || { dur: roadtrip ? 'unas ' + roadtrip.hours + ' h de manejo' : '' }, T = TIERS[ti], MO = MODES[modeId];
  const nights = daysBetween(dep, ret);
  const rooms = Math.ceil(pax / 2), cars = Math.ceil(pax / 4);
  const dailyCosts = destinationCosts(dk);
  const fm = roadtrip ? 1 : flightMult(dk, dep, ret, today), flight = MO.kind === 'flight';
  const realFlight = flight && quote && quote.pp > 0;
  // Tanto el precio real de Duffel (por adulto) como la estimación son
  // multiplicados aquí una sola vez por la cantidad de pasajeros.
  const flightPerPerson = roadtrip ? 0 : (realFlight ? quote.pp : M.pp * (flight ? fm : 1 + (fm - 1) * 0.5));
  const base = flightPerPerson * pax;
  const cross = (M.cross || 0) * pax * (1 + (fm - 1) * 0.3);
  const parts = {
    pasajes: roadtrip ? 0 : base + cross,
    alojamiento: lodgingCost(dk, ti, dep, nights, rooms),
    comidas: dailyCosts.food[T.id === 'eco' ? 'casual' : T.id === 'confort' ? 'gourmet' : 'moderado'] * nights * pax,
    local: dailyCosts.transport[T.id === 'confort' ? 'confort' : 'eco'] * nights * pax,
    traslados: roadtrip ? 0 : cars * 2 * 25 * D.f * T.transfer * (flight ? 1 : 0.5) + (modeId === 'avion_ba' ? cars * 2 * 20 : 0),
    auto: roadtrip ? roadtrip.totalUsd : 0
  };
  let total = 0;
  Object.keys(parts).forEach(function (k) { parts[k] = Math.round(parts[k]); total += parts[k]; });
  return {
    id: modeId + '-' + ti, dk: dk, mode: modeId, modeLabel: MO.label, modeShort: MO.short,
    ti: ti, tierLabel: T.label, tierDesc: T.desc,
    parts: parts,
    sources: { pasajes: realFlight ? 'real' : 'estimado', alojamiento: 'estimado', comidas: 'real',
               local: 'real', traslados: 'estimado', auto: 'estimado' },
    total: total, pp: Math.round(total / pax), comfort: MO.comfort + T.comfort,
    nights: nights, dur: M.dur, roadtrip: roadtrip,
    quote: realFlight ? { airline: quote.airline || null, transfers: quote.transfers == null ? null : quote.transfers,
                          exact: !!quote.exact, foundDep: quote.foundDep || null, foundRet: quote.foundRet || null } : null
  };
}

function build(S, dep, ret, today, quotes) {
  const out = [];
  const transport = String(S.transport || 'flight').toLowerCase();
  const options = Object.keys(DEST[S.dest].modes).concat('auto');
  options.forEach(function (m) {
    if (transport === 'flight' && m === 'auto') return;
    if (transport === 'auto' && m !== 'auto') return;
    for (let t = 0; t < TIERS.length; t++) out.push(calc(S.dest, m, t, S.pax, dep, ret, today, quotes ? quotes[m] : null, S.kmPerLiter, S.fuelPriceUsd));
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
  const est0 = calc(S.dest, rec.mode, rec.ti, S.pax, dep, ret, today, null, S.kmPerLiter, S.fuelPriceUsd).total;
  const out = [];
  for (let s = -7; s <= 7; s++) {
    const d1 = addDays(dep, s), d2 = addDays(ret, s);
    if (daysBetween(today, d1) < 1) continue;
    const est = calc(S.dest, rec.mode, rec.ti, S.pax, d1, d2, today, null, S.kmPerLiter, S.fuelPriceUsd).total;
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
  const transport = String(q.transport || 'flight').toLowerCase();
  if (!['flight', 'auto', 'roadtrip'].includes(transport)) fail('El tipo de transporte debe ser vuelo o auto.');
  if ((transport === 'auto' || transport === 'roadtrip') && !isRoadtripAllowed(dest)) {
    fail('Auto / Roadtrip solo está disponible para Río de Janeiro o destinos más al sur.');
  }
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
  const kmPerLiter = Number(q.kmPerLiter);
  return { S: { dest: dest, dep: q.dep, ret: q.ret, pax: pax, budget: budget, style: style,
    transport: transport === 'roadtrip' ? 'auto' : transport,
    kmPerLiter: Number.isFinite(kmPerLiter) && kmPerLiter >= 3 && kmPerLiter <= 40 ? kmPerLiter : 12 }, dep: dep, ret: ret, nights: nights };
}

function compute(S, dep, ret, today, quotes) {
  const list = build(S, dep, ret, today, quotes);
  // Cuando se consultan propuestas de vuelo para Río, también dejamos
  // disponibles las alternativas en auto para mostrarlas debajo del listado.
  const roadtripList = S.transport === 'flight' && isRoadtripAllowed(S.dest)
    ? build(Object.assign({}, S, { transport: 'auto' }), dep, ret, today, null)
    : [];
  const pk = pick(S, list), rec = pk.rec;
  const cozy = list.slice().sort(function (a, b) { return b.comfort - a.comfort || a.total - b.total; })[0];
  const series = seriesFor(S, rec, dep, ret, today);
  return {
    fits: pk.fits, recId: rec.id, cheapestId: list[0].id, cozyId: cozy.id,
    list: list, roadtripList: roadtripList, series: series, tips: tipsFor(S, rec, list, series)
  };
}

module.exports = { MODES, DEST, TIERS, REAL_COSTS, DESTINATION_COSTS, destinationCosts, ROADTRIP_ROUTES, roadtripCost, getToday, addDays, iso, parse, daysBetween, calc, build, pick, seriesFor, tipsFor, validate, compute };
