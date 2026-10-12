'use strict';
/*
 * Genera data/clima-destinos.json: el clima promedio de cada mes en los 40 destinos, para el ranking
 * "Mejor clima" de /web/home-guias.html (via scripts/build-destinos-datos.js).
 *
 * FUENTE
 * Open-Meteo Historical Weather API (reanalisis ERA5, gratis y sin key), con la coordenada de cada destino de
 * data/destinos-geo.json. Se bajan los datos diarios de 10 años (2015-2024) y se promedian por mes:
 *   max, min      temperatura maxima y minima media (°C)
 *   lluvia        lluvia total del mes (mm)
 *   dias          dias con 5 mm o mas de lluvia
 *   sol           horas de sol por dia
 *
 * Es un reanalisis (celdas de ~25 km), no una estacion: en la costa marca menos calor (la celda mezcla mar y
 * tierra). Arraial do Cabo daba 25 grados de maxima en enero y la estacion del pueblo mide 27,7; Fernando de Noronha,
 * 4 grados menos. Por eso:
 *
 * CORRECCION CON ESTACIONES (Meteostat, gratis y sin key)
 * Donde hay una estacion meteorologica a 25 km o menos, a menos de 300 m de diferencia de altura y con datos en al
 * menos 90 dias de ese mes en 2015-2024, la maxima y la minima son las de la estacion. La lluvia y el sol siguen
 * siendo de Open-Meteo: en las estaciones faltan mas de la mitad de los dias de lluvia.
 * Si Open-Meteo no tiene el destino (Porto Alegre quedo afuera por el limite diario), se arma entero con la
 * estacion: temperaturas y dias de lluvia de sus datos diarios, y lluvia del mes y horas de sol de sus normales.
 * `fuente` de cada destino dice de donde salio cada cosa.
 *
 * Uso: node scripts/build-clima.js        (tarda 10-15 minutos la primera vez por el limite gratuito; despues usa lo guardado)
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const GEO = require('../data/destinos-geo.json').destinos;
const SALIDA = path.join(RAIZ, 'data', 'clima-destinos.json');
// Lo ya bajado queda en data/_trabajo: si Open-Meteo corta a la mitad, la proxima corrida sigue desde ahi.
const PARCIAL = path.join(RAIZ, 'data', '_trabajo', 'clima-diario.json');
const DESDE = '2015-01-01', HASTA = '2024-12-31', ANOS = 10;

/* Dia de lluvia: 5 mm o mas. El reanalisis reparte la lluvia en llovizna casi todos los dias del verano tropical
   (con 1 mm daba 20 dias de lluvia en enero en Bahia); con 5 mm queda cerca de lo que se vive: un dia en que la
   lluvia cambia el plan. */
const UMBRAL_MM = 5;
const r1 = function (n) { return Math.round(n * 10) / 10; };
const espera = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };

async function climaDe(lat, lon) {
  const url = 'https://archive-api.open-meteo.com/v1/archive?' + new URLSearchParams({
    latitude: lat, longitude: lon, start_date: DESDE, end_date: HASTA, timezone: 'America/Sao_Paulo',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration'
  });
  for (let intento = 1; ; intento++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if (intento >= 2) throw new Error('Open-Meteo ' + r.status + ' para ' + lat + ',' + lon);
    await espera(65000);   // 429: el limite gratuito es por minuto (y 10 años de datos diarios pesan varios pedidos)
  }
}

function porMes(d) {
  const m = Array.from({ length: 12 }, function () { return { n: 0, max: 0, min: 0, lluvia: 0, dias: 0, sol: 0 }; });
  d.time.forEach(function (t, i) {
    if (d.temperature_2m_max[i] == null) return;
    const x = m[Number(t.slice(5, 7)) - 1];
    x.n++; x.max += d.temperature_2m_max[i]; x.min += d.temperature_2m_min[i];
    x.lluvia += d.precipitation_sum[i] || 0; if ((d.precipitation_sum[i] || 0) >= UMBRAL_MM) x.dias++;
    x.sol += (d.sunshine_duration[i] || 0) / 3600;
  });
  return m.map(function (x) {
    return { max: r1(x.max / x.n), min: r1(x.min / x.n), lluvia: Math.round(x.lluvia / ANOS), dias: Math.round(x.dias / ANOS), sol: r1(x.sol / x.n) };
  });
}

/* ---------- Estaciones (Meteostat bulk) ---------- */
const zlib = require('zlib');
const CACHE_EST = path.join(RAIZ, 'data', '_trabajo', 'meteostat');
const MAX_KM = 25, MAX_ALTURA = 300, MIN_DIAS = 90;
const km = function (a, b, c, d) {
  const r = Math.PI / 180, h = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
async function bajar(url, archivo) {
  const f = path.join(CACHE_EST, archivo);
  if (fs.existsSync(f)) return zlib.gunzipSync(fs.readFileSync(f)).toString();
  const r = await fetch(url);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(CACHE_EST, { recursive: true }); fs.writeFileSync(f, buf);
  return zlib.gunzipSync(buf).toString();
}
/* Por mes, de los datos diarios de 2015-2024: maxima y minima media (dias con las dos), y dias con 5 mm o mas
   escalados al mes con los dias que si tienen dato de lluvia. */
function estacionPorMes(csv) {
  const m = Array.from({ length: 12 }, function () { return { n: 0, max: 0, min: 0, pn: 0, p5: 0 }; });
  csv.trim().split('\n').forEach(function (l) {
    const c = l.split(','), y = Number(c[0].slice(0, 4));
    if (y < 2015 || y > 2024) return;
    const x = m[Number(c[0].slice(5, 7)) - 1];
    if (c[2] !== '' && c[3] !== '') { x.n++; x.max += Number(c[3]); x.min += Number(c[2]); }
    if (c[4] !== '') { x.pn++; if (Number(c[4]) >= UMBRAL_MM) x.p5++; }
  });
  return m.map(function (x, i) {
    const dm = new Date(2023, i + 1, 0).getDate();
    return { n: x.n, max: x.n ? r1(x.max / x.n) : null, min: x.n ? r1(x.min / x.n) : null, pn: x.pn, dias: x.pn ? Math.round(x.p5 / x.pn * dm) : null };
  });
}
async function estacionesCerca() {
  const lista = JSON.parse(await bajar('https://bulk.meteostat.net/v2/stations/full.json.gz', 'stations.json.gz')).filter(function (s) { return s.country === 'BR'; });
  const out = {};
  for (const k of Object.keys(GEO)) {
    const g = GEO[k];
    const cands = lista.map(function (s) { return { s: s, d: km(g.lat, g.lon, s.location.latitude, s.location.longitude) }; })
      .filter(function (x) { return x.d <= MAX_KM && x.s.inventory && x.s.inventory.daily && x.s.inventory.daily.end; })
      .sort(function (a, b) { return a.d - b.d; });
    for (const c of cands) {
      const csv = await bajar('https://bulk.meteostat.net/v2/daily/' + c.s.id + '.csv.gz', 'd_' + c.s.id + '.csv.gz');
      if (!csv) continue;
      const pm = estacionPorMes(csv);
      if (pm.some(function (x) { return x.n < MIN_DIAS; })) continue;
      out[k] = { id: c.s.id, nombre: c.s.name.en, km: Math.round(c.d), elev: c.s.location.elevation, meses: pm };
      const normales = await bajar('https://bulk.meteostat.net/v2/normals/' + c.s.id + '.csv.gz', 'n_' + c.s.id + '.csv.gz');
      if (normales) {
        /* las normales mas nuevas que tenga (1991-2020 si esta, si no 1961-1990): lluvia del mes y sol (minutos del mes) */
        const filas = normales.trim().split('\n').map(function (l) { return l.split(','); });
        const fin = Math.max.apply(null, filas.map(function (f) { return Number(f[1]); }));
        out[k].normales = filas.filter(function (f) { return Number(f[1]) === fin; }).sort(function (a, b) { return a[2] - b[2]; })
          .map(function (f) { return { lluvia: f[5] === '' ? null : Math.round(Number(f[5])), solMin: f[8] === '' ? null : Number(f[8]) }; });
        out[k].periodo = filas.find(function (f) { return Number(f[1]) === fin; })[0] + '-' + fin;
      }
      break;
    }
  }
  return out;
}

(async function () {
  const destinos = {};
  let crudo = {};
  try { crudo = JSON.parse(fs.readFileSync(PARCIAL, 'utf8')); } catch (e) { crudo = {}; }
  for (const k of Object.keys(GEO)) {
    const g = GEO[k];
    if (!crudo[k]) {
      /* si Open-Meteo sigue cortando (limite por hora), ese destino queda sin clima esta vez y se completa en la
         proxima corrida: el resto no se pierde */
      try { crudo[k] = (await climaDe(g.lat, g.lon)).daily; } catch (e) { console.warn('SIN CLIMA ' + k + ': ' + e.message); continue; }
      fs.mkdirSync(path.dirname(PARCIAL), { recursive: true });
      fs.writeFileSync(PARCIAL, JSON.stringify(crudo), 'utf8');
      await espera(8000);
    }
    destinos[k] = porMes(crudo[k]);
  }
  /* temperaturas de la estacion donde la hay; Porto Alegre (y cualquiera sin Open-Meteo) entero desde la estacion */
  const est = await estacionesCerca();
  const fuentes = {};
  for (const k of Object.keys(GEO)) {
    const e = est[k], g = GEO[k];
    const altaOk = e && (e.elev == null || Math.abs(e.elev - (g.elev || 0)) < MAX_ALTURA || k === 'gram' || k === 'canela');
    if (destinos[k] && e && altaOk) {
      destinos[k].forEach(function (x, i) { x.max = e.meses[i].max; x.min = e.meses[i].min; });
      fuentes[k] = 'temperatura: estacion ' + e.nombre + ' (' + e.km + ' km); lluvia y sol: Open-Meteo';
    } else if (!destinos[k] && e && e.normales && e.normales.every(function (n) { return n.lluvia != null && n.solMin != null; }) && e.meses.every(function (x) { return x.dias != null; })) {
      destinos[k] = e.meses.map(function (x, i) {
        const dm = new Date(2023, i + 1, 0).getDate();
        return { max: x.max, min: x.min, lluvia: e.normales[i].lluvia, dias: x.dias, sol: r1(e.normales[i].solMin / 60 / dm) };
      });
      fuentes[k] = 'todo de la estacion ' + e.nombre + ' (' + e.km + ' km): temperatura y dias de lluvia 2015-2024, lluvia del mes y sol de las normales ' + e.periodo;
    } else if (destinos[k]) fuentes[k] = 'Open-Meteo (sin estacion cerca con datos suficientes)';
    if (destinos[k]) console.log(k.padEnd(14), destinos[k].map(function (x) { return x.max + '°/' + x.dias + 'd'; }).join(' '), '|', fuentes[k]);
    else console.warn('SIN CLIMA ' + k);
  }
  const salida = {
    _meta: {
      descripcion: 'Clima promedio por mes de cada destino (indice 0 = enero): max/min °C, lluvia mm del mes, dias con 5 mm o mas, horas de sol por dia.',
      fuente: 'Open-Meteo Historical Weather API (ERA5), datos diarios ' + DESDE + ' a ' + HASTA + ', en la coordenada de data/destinos-geo.json; temperaturas corregidas con estaciones de Meteostat (ver fuentes).',
      fuentes: fuentes,
      generado: new Date().toISOString().slice(0, 10),
      regenerar: 'node scripts/build-clima.js && node scripts/build-destinos-datos.js'
    },
    destinos: destinos
  };
  fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 1) + '\n', 'utf8');
  console.log('clima-destinos.json: ' + Object.keys(destinos).length + ' destinos');
})().catch(function (e) { console.error(e); process.exit(1); });
