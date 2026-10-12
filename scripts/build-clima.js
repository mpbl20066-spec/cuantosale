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
 * Es un reanalisis (celdas de ~25 km), no una estacion: en la costa puede marcar algo menos de calor y un poco
 * mas de dias de lluvia que el aeropuerto. Sirve para comparar destinos y meses entre si, que es para lo que se usa.
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
    console.log(k.padEnd(14), destinos[k].map(function (x) { return x.max + '°/' + x.dias + 'd'; }).join(' '));
  }
  const salida = {
    _meta: {
      descripcion: 'Clima promedio por mes de cada destino (indice 0 = enero): max/min °C, lluvia mm del mes, dias con 5 mm o mas, horas de sol por dia.',
      fuente: 'Open-Meteo Historical Weather API (ERA5), datos diarios ' + DESDE + ' a ' + HASTA + ', en la coordenada de data/destinos-geo.json.',
      generado: new Date().toISOString().slice(0, 10),
      regenerar: 'node scripts/build-clima.js && node scripts/build-destinos-datos.js'
    },
    destinos: destinos
  };
  fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 1) + '\n', 'utf8');
  console.log('clima-destinos.json: ' + Object.keys(destinos).length + ' destinos');
})().catch(function (e) { console.error(e); process.exit(1); });
