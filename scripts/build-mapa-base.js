'use strict';
/*
 * Mapa base del roadtrip, dibujado por nosotros: paises y provincias/estados de
 * la region (Uruguay, sur de Brasil, litoral argentino) como poligonos.
 *
 * Por que propio y no tiles de un servidor: los tiles publicos de
 * OpenStreetMap bloquean apps con "Access blocked" (403) si el pedido no cumple
 * su politica, y los proveedores buenos piden clave o licencia comercial. Con
 * poligonos precalculados el mapa no depende de nadie, carga instantaneo y se ve
 * como un mapa politico limpio: tierra clara, agua celeste, fronteras finas.
 *
 * Datos: Natural Earth 1:10m (dominio publico, https://www.naturalearthdata.com).
 * Se recorta a la region, se simplifica (Douglas-Peucker) y se redondea a 2
 * decimales (~1 km). Salida: public/mapa-base.js (window.CS_BASEMAP).
 *
 * Uso: node scripts/build-mapa-base.js
 * Baja los .geojson a la carpeta temporal la primera vez y los reutiliza.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const CAJA = { w: -70, e: -40, s: -38, n: -21 };
const PAISES = new Set(['UY', 'AR', 'BR', 'PY', 'CL', 'BO']);
const SALIDA = path.join(__dirname, '..', 'public', 'mapa-base.js');

async function bajar(nombre) {
  const f = path.join(os.tmpdir(), nombre + '.geojson');
  if (!fs.existsSync(f)) {
    console.log('bajando ' + nombre + '...');
    const r = await fetch(BASE + nombre + '.geojson');
    if (!r.ok) throw new Error(nombre + ' ' + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

// Recorte Sutherland-Hodgman contra un rectangulo.
function recortar(anillo) {
  const bordes = [
    [(p) => p[0] >= CAJA.w, (a, b) => { const t = (CAJA.w - a[0]) / (b[0] - a[0]); return [CAJA.w, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= CAJA.e, (a, b) => { const t = (CAJA.e - a[0]) / (b[0] - a[0]); return [CAJA.e, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= CAJA.s, (a, b) => { const t = (CAJA.s - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), CAJA.s]; }],
    [(p) => p[1] <= CAJA.n, (a, b) => { const t = (CAJA.n - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), CAJA.n]; }]
  ];
  let sal = anillo;
  for (const [dentro, cruce] of bordes) {
    const ent = sal; sal = [];
    for (let i = 0; i < ent.length; i++) {
      const a = ent[i], b = ent[(i + 1) % ent.length];
      if (dentro(b)) { if (!dentro(a)) sal.push(cruce(a, b)); sal.push(b); }
      else if (dentro(a)) sal.push(cruce(a, b));
    }
    if (!sal.length) return [];
  }
  return sal;
}

function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function simplificar(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop(); let max = 0, idx = -1;
    for (let k = i + 1; k < j; k++) { const d = distSeg(pts[k], pts[i], pts[j]); if (d > max) { max = d; idx = k; } }
    if (idx > -1 && max > tol) { keep[idx] = 1; pila.push([i, idx], [idx, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Devuelve una lista de anillos [[lat,lng],...] (formato Leaflet) ya recortados.
function anillos(geom, tol) {
  const polis = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  const out = [];
  for (const poli of polis) {
    const ext = recortar(poli[0]);
    if (ext.length < 3) continue;
    const s = simplificar(ext, tol);
    if (s.length < 4) continue; // islote que se simplifica a nada
    out.push(s.map(([lng, lat]) => [Math.round(lat * 100) / 100, Math.round(lng * 100) / 100]));
  }
  return out;
}

// Lineas (rios): se queda con los tramos que caen dentro de la caja.
function lineas(geom, tol) {
  const ls = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : [];
  const dentro = (p) => p[0] >= CAJA.w && p[0] <= CAJA.e && p[1] >= CAJA.s && p[1] <= CAJA.n;
  const out = [];
  for (const l of ls) {
    let run = [];
    const cerrar = () => { if (run.length > 1) out.push(simplificar(run, tol).map(([lng, lat]) => [Math.round(lat * 100) / 100, Math.round(lng * 100) / 100])); run = []; };
    for (const p of l) { if (dentro(p)) run.push(p); else cerrar(); }
    cerrar();
  }
  return out;
}

(async function () {
  const paises = await bajar('ne_10m_admin_0_countries');
  const estados = await bajar('ne_10m_admin_1_states_provinces');
  const lagos = await bajar('ne_10m_lakes');
  const rios = await bajar('ne_10m_rivers_lake_centerlines');
  const tierra = [];
  for (const f of paises.features) {
    const iso = f.properties.ISO_A2 !== '-99' ? f.properties.ISO_A2 : f.properties.ISO_A2_EH;
    if (PAISES.has(iso)) tierra.push(...anillos(f.geometry, 0.012));
  }
  const limites = [];
  for (const f of estados.features) {
    if (!['UY', 'AR', 'BR', 'PY'].includes(f.properties.iso_a2)) continue;
    limites.push(...anillos(f.geometry, 0.02));
  }
  // Lagunas y embalses grandes (Lagoa Mirim, Iberá, Itaipú...) y ríos principales.
  const agua = [];
  for (const f of lagos.features) if (f.geometry && f.properties.scalerank <= 8) agua.push(...anillos(f.geometry, 0.01));
  const rioslin = [];
  for (const f of rios.features) if (f.geometry && f.properties.scalerank <= 6) rioslin.push(...lineas(f.geometry, 0.01));
  // Nombres de estados y provincias, en el punto de etiqueta que trae Natural Earth.
  const nombres = [];
  for (const f of estados.features) {
    const p = f.properties;
    if (!['AR', 'BR'].includes(p.iso_a2) || p.labelrank > 7 || p.name === 'Ciudad de Buenos Aires') continue;
    if (p.longitude < CAJA.w || p.longitude > CAJA.e || p.latitude < CAJA.s || p.latitude > CAJA.n) continue;
    nombres.push([p.name, Math.round(p.latitude * 100) / 100, Math.round(p.longitude * 100) / 100]);
  }
  const cuerpo = '/* Generado por scripts/build-mapa-base.js con datos de Natural Earth (dominio publico). No editar a mano. */\n' +
    'window.CS_BASEMAP = ' + JSON.stringify({ bbox: [[CAJA.s, CAJA.w], [CAJA.n, CAJA.e]], tierra, limites, agua, rios: rioslin, nombres }) + ';\n';
  fs.writeFileSync(SALIDA, cuerpo, 'utf8');
  console.log('tierra: ' + tierra.length + ' | estados: ' + limites.length + ' | agua: ' + agua.length + ' | rios: ' + rioslin.length + ' | nombres: ' + nombres.length + ' | ' + (cuerpo.length / 1024).toFixed(0) + ' KB -> ' + SALIDA);
})().catch((e) => { console.error('fallo: ' + e.message); process.exit(1); });
