#!/usr/bin/env node
/* Alternativas de Unsplash para los tours que tienen foto de la agencia, SIN cambiar la app.
 * Arma outputs/fotos-alternativas.html: la foto actual de la agencia y al lado hasta 8 candidatas.
 * Usa la misma cache que scripts/fotos-unsplash.js; si llega al limite de la hora, arma la pagina
 * con lo que hay y avisa que falta.   node scripts/fotos-alternativas.js */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const CACHE = path.join(RAIZ, 'data', '_trabajo', 'unsplash-cache.json');
const SALIDA = path.join(RAIZ, 'outputs', 'fotos-alternativas.html');
const KEY = (fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').match(/^UNSPLASH_ACCESS_KEY=(.+)$/m) || [])[1];
if (!KEY) { console.error('Falta UNSPLASH_ACCESS_KEY en .env'); process.exit(1); }
const BUSQ = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'unsplash-busquedas-agencia.json'), 'utf8'));
const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'tours.json'), 'utf8'));
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { /* vacia */ }
let limitado = false;

async function buscar(q) {
  if (cache[q]) return cache[q];
  if (limitado) return null;
  const r = await fetch('https://api.unsplash.com/search/photos?' + new URLSearchParams({ query: q, per_page: '30', orientation: 'landscape', content_filter: 'high' }),
    { headers: { Authorization: 'Client-ID ' + KEY.trim(), 'Accept-Version': 'v1' } });
  if (r.status === 403 || r.status === 429) { limitado = true; return null; }
  if (!r.ok) throw new Error('Unsplash ' + r.status + ' en "' + q + '"');
  const j = await r.json();
  cache[q] = (j.results || []).filter((p) => !p.premium && !p.plus).map((p) => ({
    id: p.id, txt: [p.alt_description, p.description].filter(Boolean).join(' · '), url: p.urls && p.urls.regular, thumb: p.urls && p.urls.small,
    autor: p.user && p.user.name, perfil: p.user && p.user.links && p.user.links.html, pagina: p.links && p.links.html, download: p.links && p.links.download_location
  }));
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  if (Number(r.headers.get('x-ratelimit-remaining')) <= 1) limitado = true;
  return cache[q];
}

(async function () {
  const tours = (datos.tours || datos).filter((t) => t && t.activo !== false && t.image && String(t.image).trim());
  const filas = []; let faltan = 0;
  for (const t of tours) {
    const k = t.destinos[0] + '#' + t.titulo.trim(), qs = BUSQ[k] || [String(t.destino).split(',')[0]];
    let cands = [], usada = '', falta = false;
    for (const q of qs) {
      const l = await buscar(q);
      if (!l) { falta = true; break; }
      if (l.length > cands.length) { cands = l; usada = q; }
      if (l.length >= 3) { cands = l; usada = q; break; }
    }
    if (falta) faltan++;
    filas.push({ k: k, t: t, cands: cands.slice(0, 8), usada: usada, falta: falta });
  }
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, '<!doctype html><meta charset="utf-8"><title>Alternativas para fotos de agencia</title><style>body{font-family:system-ui;margin:16px;background:#f6f7f9;color:#101828}h1{font-size:22px}p.n{color:#555;margin:-6px 0 16px}' +
    'section{background:#fff;border-radius:12px;box-shadow:0 1px 3px #0002;padding:12px;margin-bottom:14px}h2{font-size:15px;margin:0 0 8px}h2 small{font-weight:400;color:#667}' +
    '.f{display:grid;grid-template-columns:220px 1fr;gap:12px}.act img{width:220px;height:150px;object-fit:cover;border-radius:8px;outline:3px solid #F7C325}.act span{display:block;font-size:12px;font-weight:700;margin-top:4px}' +
    '.c{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.c figure{margin:0}.c img{width:100%;height:100px;object-fit:cover;border-radius:6px}.c figcaption{font-size:10.5px;color:#555;line-height:1.25;margin-top:2px}</style>' +
    '<h1>Alternativas de Unsplash para los tours con foto de la agencia</h1><p class="n">La foto con borde amarillo es la actual (no se cambio nada). Para usar otra, pasa el nombre del tour y el numero de la alternativa.</p>' +
    filas.map((f) => '<section><h2>' + esc(f.t.titulo) + ' <small>· ' + esc(String(f.t.destino).split(',')[0]) + (f.usada ? ' · busqueda "' + esc(f.usada) + '"' : '') + '</small></h2><div class="f"><div class="act"><img src="' + esc(f.t.image) + '"><span>Actual (agencia)</span></div><div class="c">' +
      (f.cands.length ? f.cands.map((p, i) => '<figure><img src="' + esc(p.thumb) + '" loading="lazy"><figcaption><b>' + (i + 1) + '</b> · ' + esc(String(p.txt).slice(0, 70)) + ' · ' + esc(p.autor) + '</figcaption></figure>').join('') : '<p>' + (f.falta ? 'Falta buscar (limite de la hora).' : 'Unsplash no tiene fotos para esta busqueda.') + '</p>') +
      '</div></div></section>').join(''));
  console.log(filas.length + ' tours · ' + (filas.length - faltan) + ' con alternativas buscadas' + (faltan ? ' · faltan ' + faltan + ' (limite de la hora)' : '') + ' · outputs/fotos-alternativas.html');
  if (faltan) process.exitCode = 2;
})().catch((e) => { console.error(e.message); process.exit(1); });
