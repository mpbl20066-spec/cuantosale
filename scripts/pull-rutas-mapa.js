'use strict';
/*
 * Trazado de la ruta en auto desde Montevideo hasta cada destino del roadtrip,
 * para dibujarlo en el mapa de la tarjeta "Auto / Roadtrip".
 *
 * Sale de OSRM (https://router.project-osrm.org, perfil auto), el mismo servicio
 * de donde vienen los km de ROADTRIP_ROUTES. Se precalcula ACA y se publica como
 * archivo estatico (public/rutas-auto.js) en vez de pedirlo desde el navegador:
 * el servidor de OSRM es una demo publica sin garantias, y cada visita a la
 * tarjeta no puede depender de que este arriba ni sumarle carga.
 *
 * Se simplifica el trazado (Douglas-Peucker) a ~150-400 puntos por ruta: a la
 * escala de un mapa de tarjeta no se distingue de la ruta completa y el archivo
 * baja de varios MB a unos pocos KB.
 *
 * Buenos Aires queda afuera a proposito: el roadtrip se calcula por el ferry de
 * Colonia (ver ROADTRIP_ROUTES.bue) y OSRM devolveria la ruta por tierra, que es
 * otro viaje. Sin trazado, la tarjeta no muestra mapa en vez de mostrar uno falso.
 *
 * Cache en data/rutas-mapa-cache.json: para rehacer una ruta, borrar su entrada.
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const CACHE = path.join(RAIZ, 'data', 'rutas-mapa-cache.json');
const SALIDA = path.join(RAIZ, 'public', 'rutas-auto.js');
const SIN_TRAZADO = new Set(['bue']);
const TOLERANCIA_GRADOS = 0.003; // ~330 m

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function rutaOsrm(a, b) {
  const url = 'https://router.project-osrm.org/route/v1/driving/' +
    a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=full&geometries=geojson';
  const r = await fetch(url);
  if (!r.ok) throw new Error('OSRM ' + r.status);
  const j = await r.json();
  if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('OSRM ' + j.code);
  return { km: Math.round(j.routes[0].distance / 1000), coords: j.routes[0].geometry.coordinates };
}

// Distancia de un punto al segmento a-b, en grados (suficiente para simplificar).
function distSegmento(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function simplificar(pts, tol) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop();
    let max = 0, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distSegmento(pts[k], pts[i], pts[j]);
      if (d > max) { max = d; idx = k; }
    }
    if (idx > -1 && max > tol) { keep[idx] = 1; pila.push([i, idx], [idx, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

(async function () {
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const origen = model.ORIGIN_COORDS.MVD;
  const claves = Object.keys(model.ROADTRIP_ROUTES).filter((k) => !SIN_TRAZADO.has(k));
  const rutas = {};
  let fallos = 0;

  // Solo los destinos que ofrecen roadtrip: los demas no muestran la tarjeta.
  const ofrecidos = claves.filter((k) => model.isRoadtripAllowed(k));
  for (const k of ofrecidos) {
    const destino = model.DEST_COORDS[k];
    if (!destino) { console.log('  ' + k.padEnd(10) + ' SIN COORDENADAS en DEST_COORDS'); fallos++; continue; }
    if (!cache[k] || !cache[k].coords) {
      try {
        const r = await rutaOsrm(origen, destino);
        cache[k] = { km: r.km, coords: r.coords };
        await dormir(400);
      } catch (e) { console.log('  ' + k.padEnd(10) + ' FALLO: ' + e.message); fallos++; continue; }
    }
    const c = cache[k];
    // INVARIANTE: el trazado tiene que ser el mismo viaje que los km de la
    // tarjeta. Si OSRM y ROADTRIP_ROUTES discrepan mas de 8%, o el mapa o el
    // numero estan mal, y no se publica un mapa que contradiga la tarjeta.
    const km = model.ROADTRIP_ROUTES[k].km;
    const dif = Math.abs(c.km - km) / km;
    const simple = simplificar(c.coords, TOLERANCIA_GRADOS)
      .map(([lng, lat]) => [Math.round(lat * 1e4) / 1e4, Math.round(lng * 1e4) / 1e4]);
    console.log('  ' + k.padEnd(10) + String(c.km).padStart(5) + ' km OSRM vs ' + String(km).padStart(5) + ' tarjeta (' +
      (dif * 100).toFixed(1) + '%)  ' + c.coords.length + ' -> ' + simple.length + ' pts' + (dif > 0.08 ? '  <- NO COINCIDE' : ''));
    if (dif > 0.08) { fallos++; continue; }
    rutas[k] = simple;
  }

  fs.writeFileSync(CACHE, JSON.stringify(cache) + '\n', 'utf8');
  const cuerpo = '/* Generado por scripts/pull-rutas-mapa.js. No editar a mano. */\n' +
    'window.CS_ROUTE_ORIGIN = ' + JSON.stringify([origen.lat, origen.lng]) + ';\n' +
    'window.CS_ROUTES = ' + JSON.stringify(rutas) + ';\n';
  fs.writeFileSync(SALIDA, cuerpo, 'utf8');
  console.log('\n' + Object.keys(rutas).length + ' trazados | ' + (cuerpo.length / 1024).toFixed(1) + ' KB | ' + SALIDA);
  if (fallos) { console.error(fallos + ' con problemas'); process.exit(1); }
})().catch((e) => { console.error('fallo: ' + e.message); process.exit(1); });
