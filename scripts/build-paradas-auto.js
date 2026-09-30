'use strict';
/*
 * Ciudades reales sobre cada ruta del roadtrip, con el kilometro en que pasa la
 * ruta por ellas. Sirve para nombrar las paradas de descanso que recomienda la
 * tarjeta ("parar cada ~356 km"): en vez de solo un numero de km, se sugiere una
 * ciudad concreta cerca de ese punto.
 *
 * Datos: Natural Earth "populated places" (dominio publico) contra el trazado
 * COMPLETO de OSRM guardado en data/rutas-mapa-cache.json (correr antes
 * scripts/pull-rutas-mapa.js). Una ciudad cuenta si queda a menos de
 * DISTANCIA_MAX_KM de la ruta y tiene al menos POBLACION_MIN habitantes: una
 * parada de descanso necesita nafta y donde comer, y eso no lo hay en un pueblo
 * de 3.000 personas. NO se afirma que una ciudad tenga estaciones ni cargadores
 * electricos: la lista dice donde hay poblacion, no que servicios hay.
 *
 * El km es el de la tarjeta: la posicion a lo largo del trazado se escala al
 * kilometraje de ROADTRIP_ROUTES para que "parar en el km 356" signifique lo
 * mismo en el texto y en el mapa.
 *
 * Salida: public/paradas-auto.js (window.CS_STOPS = { destino: [[nombre, km, lat,
 * lng, poblacion, pais], ...] }, ordenado por km).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const CACHE = path.join(RAIZ, 'data', 'rutas-mapa-cache.json');
const SALIDA = path.join(RAIZ, 'public', 'paradas-auto.js');
const URL_LUGARES = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';
const DISTANCIA_MAX_KM = 12;
const POBLACION_MIN = 15000;
const PAIS = { Uruguay: 'Uruguay', Brazil: 'Brasil', Argentina: 'Argentina', Paraguay: 'Paraguay' };

const rad = (g) => g * Math.PI / 180;
function haversine(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

async function lugares() {
  const f = path.join(os.tmpdir(), 'ne_10m_populated_places_simple.geojson');
  if (!fs.existsSync(f)) {
    console.log('bajando lugares poblados...');
    const r = await fetch(URL_LUGARES);
    if (!r.ok) throw new Error('lugares ' + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(f, 'utf8')).features
    .filter((x) => x.properties.pop_max >= POBLACION_MIN && PAIS[x.properties.adm0name])
    .map((x) => ({ nombre: x.properties.name, lat: x.geometry.coordinates[1], lng: x.geometry.coordinates[0], pob: x.properties.pop_max, pais: PAIS[x.properties.adm0name] }));
}

(async function () {
  if (!fs.existsSync(CACHE)) throw new Error('falta ' + CACHE + ': correr scripts/pull-rutas-mapa.js primero');
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const todos = await lugares();
  const salida = {};

  for (const k of Object.keys(cache)) {
    if (!model.isRoadtripAllowed(k) || !cache[k].coords) continue;
    const coords = cache[k].coords; // [lng, lat]
    const acum = [0];
    for (let i = 1; i < coords.length; i++) acum.push(acum[i - 1] + haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]));
    const escala = model.ROADTRIP_ROUTES[k].km / acum[acum.length - 1];
    // Prefiltro por caja para no medir contra toda la base de ciudades.
    const lats = coords.map((c) => c[1]), lngs = coords.map((c) => c[0]);
    const caja = { s: Math.min(...lats) - 0.2, n: Math.max(...lats) + 0.2, w: Math.min(...lngs) - 0.2, e: Math.max(...lngs) + 0.2 };
    const lista = [];
    for (const p of todos) {
      if (p.lat < caja.s || p.lat > caja.n || p.lng < caja.w || p.lng > caja.e) continue;
      let mejor = Infinity, idx = -1;
      for (let i = 0; i < coords.length; i++) {
        const d = haversine(p.lat, p.lng, coords[i][1], coords[i][0]);
        if (d < mejor) { mejor = d; idx = i; }
      }
      if (mejor > DISTANCIA_MAX_KM) continue;
      lista.push([p.nombre, Math.round(acum[idx] * escala), Math.round(p.lat * 1e3) / 1e3, Math.round(p.lng * 1e3) / 1e3, p.pob, p.pais]);
    }
    lista.sort((a, b) => a[1] - b[1]);
    salida[k] = lista;
    console.log('  ' + k.padEnd(10) + String(lista.length).padStart(3) + ' ciudades: ' + lista.map((x) => x[0] + '@' + x[1]).join(', '));
  }
  const cuerpo = '/* Generado por scripts/build-paradas-auto.js (Natural Earth + trazado OSRM). No editar a mano. */\n' +
    'window.CS_STOPS = ' + JSON.stringify(salida) + ';\n';
  fs.writeFileSync(SALIDA, cuerpo, 'utf8');
  console.log('\n' + Object.keys(salida).length + ' rutas | ' + (cuerpo.length / 1024).toFixed(1) + ' KB -> ' + SALIDA);
})().catch((e) => { console.error('fallo: ' + e.message); process.exit(1); });
