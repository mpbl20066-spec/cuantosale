'use strict';
/*
 * Mareas de los proximos dias para las playas del Nordeste (piscinas naturales, arrecifes, travesias a pie).
 *
 *   mareas.para(destKey) -> Promise<{ dias: [{ fecha, bajas:[{hora,altura,ideal}], altas:[{hora,altura}] }], fuente } | null>
 *   mareas.DESTINOS      -> claves con tabla de mareas
 *
 * Fuente: Open-Meteo Marine (gratis, sin clave), variable sea_level_height_msl, que trae la marea astronomica
 * de un modelo global. Es un pronostico de modelo, no la tabua de mares de la Marinha: la hora puede correrse
 * unos minutos y la altura es relativa al nivel medio del mar, no al cero de la carta nautica. Por eso la pagina
 * lo muestra como orientativo y marca solo cuales bajamares son las mas bajas de la semana (las que dejan las
 * piscinas al aire), sin prometer centimetros.
 *
 * Cache de proceso de 3 horas por destino: la marea no cambia y asi una pagina muy visitada no le pega al
 * servicio en cada visita.
 */
const playas = require('./playas');
const model = require('./model');

// Destinos de playa del Nordeste donde la marea decide el plan del dia.
const DESTINOS = ['porto', 'rec', 'fernando', 'mcz', 'maragogi', 'nat', 'pip', 'joaopessoa', 'for', 'jericoacoara',
  'ssa', 'morro', 'itacare', 'forte', 'ajuda', 'trancoso', 'caraiva', 'portoseguro'];
// Noronha va una hora adelante del continente.
const ZONA = { fernando: 'America/Noronha' };
const TTL_MS = 3 * 60 * 60 * 1000;
const cache = new Map();

function coords(key) {
  const c = playas.centroDe(key) || (model.DEST_COORDS || {})[key];
  return c && typeof c.lat === 'number' ? { lat: c.lat, lng: c.lng != null ? c.lng : c.lon } : null;
}

/* Extremos de la serie horaria. El maximo o minimo cae entre dos horas: con la parabola que pasa por los tres
   puntos se estima el minuto, que es lo que importa para salir a las piscinas. */
function extremos(times, h) {
  const out = [];
  for (let i = 1; i < h.length - 1; i++) {
    const a = h[i - 1], b = h[i], c = h[i + 1];
    if (a == null || b == null || c == null) continue;
    const esBaja = b < a && b <= c, esAlta = b > a && b >= c;
    if (!esBaja && !esAlta) continue;
    const den = a - 2 * b + c;
    const dx = den ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * den))) : 0;
    const altura = b - (a - c) * dx / 4;
    const base = new Date(times[i] + ':00Z');   // la hora ya viene en la zona pedida; Z solo para sumar minutos
    const t = new Date(base.getTime() + dx * 3600000);
    out.push({ tipo: esBaja ? 'baja' : 'alta', fecha: t.toISOString().slice(0, 10), hora: t.toISOString().slice(11, 16), altura: Math.round(altura * 100) / 100 });
  }
  return out;
}

async function pedir(key) {
  const c = coords(key);
  if (!c) return null;
  const u = 'https://marine-api.open-meteo.com/v1/marine?' + new URLSearchParams({
    latitude: String(c.lat), longitude: String(c.lng), hourly: 'sea_level_height_msl',
    timezone: ZONA[key] || 'America/Recife', forecast_days: '7', cell_selection: 'sea'
  }).toString();
  const r = await fetch(u, { headers: { 'User-Agent': 'cuantosale/1.0' } });
  if (!r.ok) throw new Error('Open-Meteo ' + r.status);
  const j = await r.json();
  const hh = j && j.hourly;
  if (!hh || !Array.isArray(hh.time) || !Array.isArray(hh.sea_level_height_msl)) return null;
  const ex = extremos(hh.time, hh.sea_level_height_msl);
  const bajas = ex.filter(function (e) { return e.tipo === 'baja'; });
  if (!bajas.length) return null;
  // "Ideal para las piscinas": bajamares con luz de dia (6 a 17:30) que caen en el tercio mas bajo de la semana
  // (mareas de sicigia). Una bajamar de noche no sirve para salir a las piscinas.
  const deDia = function (e) { return e.hora >= '06:00' && e.hora <= '17:30'; };
  const alt = bajas.filter(deDia).map(function (e) { return e.altura; }).sort(function (x, y) { return x - y; });
  const corte = alt[Math.max(0, Math.floor(alt.length / 3) - 1)];
  const dias = {};
  ex.forEach(function (e) {
    const d = dias[e.fecha] || (dias[e.fecha] = { fecha: e.fecha, bajas: [], altas: [] });
    if (e.tipo === 'baja') d.bajas.push({ hora: e.hora, altura: e.altura, ideal: deDia(e) && corte != null && e.altura <= corte });
    else d.altas.push({ hora: e.hora, altura: e.altura });
  });
  return {
    dias: Object.keys(dias).sort().map(function (f) { return dias[f]; }),
    fuente: 'Pronóstico de Open-Meteo Marine (modelo global). Orientativo: confirmá con la tábua de marés de la Marinha o en el lugar.'
  };
}

async function para(key) {
  if (DESTINOS.indexOf(key) < 0) return null;
  const c = cache.get(key);
  if (c && Date.now() - c.t < TTL_MS) return c.v;
  const v = await pedir(key);
  if (v) cache.set(key, { t: Date.now(), v: v });
  return v;
}

module.exports = { para, DESTINOS, extremos };
