'use strict';
/*
 * Candidatas de foto para los tours que hoy no resuelven foto.
 *
 *   node listar-sin-foto.js            (genera outputs/tours-sin-foto.csv)
 *   node buscar-fotos-sin-foto.js      (todos)
 *   node buscar-fotos-sin-foto.js rio fln   (solo esos destinos)
 *
 * Fuente: Wikimedia Commons, solo licencias libres. Cada candidata se verifica
 * con el GPS del archivo contra data/destinos-geo.json (una foto sin GPS o fuera
 * del radio se descarta: asi no vuelve a pasar lo de la foto de Lisboa en un
 * tour de Buzios). Por tour se prueba, en orden:
 *   1. busqueda por el nombre del tour + destino   (nivel "tour")
 *   2. fotos geolocalizadas alrededor del destino   (nivel "destino")
 *
 * No escribe en data/ ni en la base. Genera:
 *   outputs/fotos-candidatas.html   hoja de contacto para elegir a ojo
 *   outputs/fotos-candidatas.json   mismas candidatas, para cargar despues
 */
const fs = require('fs');
const path = require('path');

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'cuantosale-tour-photos/1.0 (candidatas de foto para tours)' };
const MIN_W = 1200;
const RADIO_KM = 25;
const POR_TOUR = 4;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const geo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'destinos-geo.json'), 'utf8')).destinos;

function leerCsv(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const filas = []; let fila = [], cel = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += c; }
    else if (c === '"') q = true;
    else if (c === ',') { fila.push(cel); cel = ''; }
    else if (c === '\n') { fila.push(cel); filas.push(fila); fila = []; cel = ''; }
    else if (c !== '\r') cel += c;
  }
  if (cel || fila.length) { fila.push(cel); filas.push(fila); }
  const cols = filas.shift();
  return filas.map((f) => Object.fromEntries(cols.map((c, i) => [c, f[i]])));
}

const csv = path.join(__dirname, 'outputs', 'tours-sin-foto.csv');
if (!fs.existsSync(csv)) { console.error('Falta outputs/tours-sin-foto.csv. Corre antes: node listar-sin-foto.js'); process.exit(1); }
let tours = leerCsv(csv);
const filtro = process.argv.slice(2);
if (filtro.length) tours = tours.filter((t) => filtro.includes(t.destino));

function distKm(a, b, c, d) {
  const r = Math.PI / 180, R = 6371, dLat = (c - a) * r, dLon = (d - b) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const meta = (i, c) => (i.extmetadata && i.extmetadata[c] ? String(i.extmetadata[c].value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
const libre = (l) => /cc[\s-]*0|cc[\s-]*by|public domain|dominio p/i.test(l) && !/\bnc\b|by-nc/i.test(l);
const sinAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const DE_ARCHIVO = /\b1[5-9]\d\d\b|pintura|painting|engraving|desenho|mapa|map\b|logo|brasao|bandeira|flag/i;

async function api(params) {
  for (let n = 0; n < 4; n++) {
    let r;
    try { r = await fetch(API + '?action=query&format=json&formatversion=2&' + params, { headers: UA }); }
    catch (e) { r = { ok: false, status: 'red' }; }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status === 503 || r.status === 'red') { await espera(3000 * (n + 1)); continue; }
    return { _error: 'HTTP ' + r.status };
  }
  return { _error: 'sin respuesta tras 4 intentos' };
}

// Pagina de resultados -> candidatas verificadas por GPS y licencia.
function filtrar(j, centro, usados) {
  const out = [];
  for (const p of (j.query && j.query.pages) || []) {
    const i = p.imageinfo && p.imageinfo[0];
    if (!i || i.mime !== 'image/jpeg' || i.width < MIN_W || i.width < i.height) continue;
    const lic = meta(i, 'LicenseShortName');
    if (!libre(lic)) continue;
    const lat = parseFloat(meta(i, 'GPSLatitude')), lon = parseFloat(meta(i, 'GPSLongitude'));
    if (!isFinite(lat) || !isFinite(lon) || lat === 0) continue;
    const km = distKm(centro.lat, centro.lon, lat, lon);
    if (km > RADIO_KM) continue;
    const nombre = p.title.replace(/^File:/, '');
    if (usados.has(nombre) || DE_ARCHIVO.test(nombre + ' ' + meta(i, 'ImageDescription'))) continue;
    out.push({ archivo: nombre, url: i.thumburl, pagina: i.descriptionurl, w: i.width, h: i.height,
      licencia: lic, autor: meta(i, 'Artist').slice(0, 60) || 'Wikimedia Commons', km: Math.round(km) });
  }
  return out;
}
const PROP = 'prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1000';

// Palabras que no distinguen un tour de otro.
const RUIDO = new Set(['paseo', 'excursion', 'tour', 'entrada', 'ingreso', 'dia', 'completo', 'guiado', 'con', 'por', 'los', 'las', 'del', 'de', 'en', 'el', 'la', 'y', 'a', 'al', 'desde', 'cupo', 'limitado', 'ponta']);
function terminosTour(t) {
  const pal = sinAcento(t.titulo).toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !RUIDO.has(p));
  return pal.slice(0, 3).join(' ');
}

(async function () {
  const resultado = [];
  const usados = new Set();
  const sinResultado = [];
  const cacheGeo = {};

  for (const t of tours) {
    const centro = geo[t.destino];
    if (!centro) { console.log('SIN GEO ' + t.destino); continue; }
    let cand = [], nivel = '';

    // 1. Busqueda por texto del tour + nombre del destino, verificada por GPS.
    const q = terminosTour(t) + ' ' + sinAcento(centro.name);
    const j1 = await api('generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + q) + '&' + PROP);
    if (!j1._error) cand = filtrar(j1, centro, usados);
    if (cand.length) nivel = 'tour';
    await espera(400);

    // 2. Fotos geolocalizadas alrededor del destino (una consulta por destino).
    if (!cand.length) {
      if (!cacheGeo[t.destino]) {
        const j2 = await api('generator=geosearch&ggsnamespace=6&ggsradius=10000&ggslimit=60&ggscoord=' + centro.lat + '%7C' + centro.lon + '&' + PROP);
        cacheGeo[t.destino] = j2._error ? [] : filtrar(j2, centro, new Set());
        await espera(400);
      }
      cand = cacheGeo[t.destino].filter((c) => !usados.has(c.archivo));
      if (cand.length) nivel = 'destino';
    }

    cand.sort((a, b) => (b.w / b.h > 1.3 ? 1 : 0) - (a.w / a.h > 1.3 ? 1 : 0) || b.w - a.w);
    const elegidas = cand.slice(0, POR_TOUR);
    elegidas.slice(0, 1).forEach((c) => usados.add(c.archivo));
    resultado.push({ id: t.id, clave: t.destino + '#' + t.titulo, destino: t.destino, nombre: centro.name, titulo: t.titulo, nivel, candidatas: elegidas });
    if (!elegidas.length) sinResultado.push(t.destino + '#' + t.titulo);
    console.log((elegidas.length ? 'OK   ' : 'FALTA') + ' [' + (nivel || '-').padEnd(7) + '] ' + t.destino + ' / ' + t.titulo.slice(0, 50) + '  (' + elegidas.length + ')');
  }

  const out = path.join(__dirname, 'outputs');
  if (!fs.existsSync(out)) fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'fotos-candidatas.json'), JSON.stringify(resultado, null, 2), 'utf8');

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const html = ['<!doctype html><meta charset="utf-8"><title>Fotos candidatas</title><style>',
    'body{font:14px system-ui;margin:20px;background:#f4f4f4}h2{margin:28px 0 4px}h3{margin:14px 0 4px}',
    '.f{display:flex;gap:10px;flex-wrap:wrap}.c{background:#fff;width:240px;padding:6px;border-radius:6px;font-size:11px}',
    '.c img{width:100%;height:150px;object-fit:cover;border-radius:4px}.d{color:#b45309}.t{color:#047857}</style>',
    '<h1>Fotos candidatas (' + resultado.length + ' tours, ' + sinResultado.length + ' sin candidata)</h1>',
    '<p>Nivel <b class="t">tour</b>: salio de buscar el nombre del tour. Nivel <b class="d">destino</b>: foto del lugar, no del tour. Todas con GPS a menos de ' + RADIO_KM + ' km. Elegir a ojo.</p>'];
  let ult = '';
  for (const r of resultado) {
    if (r.destino !== ult) { html.push('<h2>' + esc(r.nombre) + ' (' + r.destino + ')</h2>'); ult = r.destino; }
    html.push('<h3>' + esc(r.titulo) + ' <small class="' + (r.nivel === 'tour' ? 't' : 'd') + '">' + (r.nivel || 'SIN CANDIDATA') + '</small></h3><div class="f">');
    r.candidatas.forEach((c) => html.push('<div class="c"><a href="' + esc(c.pagina) + '" target="_blank"><img loading="lazy" src="' + esc(c.url) + '"></a>' +
      esc(c.archivo.slice(0, 50)) + '<br>' + esc(c.licencia) + ' · ' + esc(c.autor) + ' · ' + c.km + ' km · ' + c.w + 'x' + c.h + '</div>'));
    html.push('</div>');
  }
  fs.writeFileSync(path.join(out, 'fotos-candidatas.html'), html.join('\n'), 'utf8');

  const porNivel = (n) => resultado.filter((r) => r.nivel === n).length;
  console.log('\nTours: ' + resultado.length + '   nivel tour: ' + porNivel('tour') + '   nivel destino: ' + porNivel('destino') + '   sin candidata: ' + sinResultado.length);
  console.log('Revisa outputs/fotos-candidatas.html');
})();
