'use strict';
/* Paginas publicas por destino (/destino/<slug>), pensadas para que Google las
   indexe: "que hacer en Buzios", "playas de Buzios", etc.

   Salen de la misma guia que usa la Guia Secreta (lib/guias.js) y muestran
   TODO su contenido: es una decision de producto, para que Google tenga texto
   de verdad que indexar. Ojo: el contenido que /api/guia reserva a quien eligio
   hotel queda publico en estas paginas.

   El diseño es visual a proposito: foto grande, playas en tarjetas deslizables
   y el resto en secciones plegables. El texto sigue en el HTML (los <details>
   cerrados se indexan igual), solo que no se le tira todo encima al visitante.

   Para habilitar otro destino alcanza con sumar su clave a HABILITADOS. */

const model = require('./model');
const guias = require('./guias');

// Todos los destinos que tienen guia de ciudad en lib/guias.js.
const HABILITADOS = Object.keys(model.DEST).filter(function (k) { return guias.guias[k]; });

function slugDe(nombre) {
  return String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const POR_SLUG = {};
HABILITADOS.forEach(function (key) {
  if (model.DEST[key]) POR_SLUG[slugDe(model.DEST[key].name)] = key;
});

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function listaMeses(arr) {
  return (arr || []).slice().sort(function (a, b) { return a - b; }).map(function (m) { return MESES[m]; }).join(', ');
}

function slugs() { return Object.keys(POR_SLUG); }

const CSS = ':root{--bg:#0A101A;--surface:#111A28;--line:#2A3646;--ink:#FFFFFF;--ink2:#D3DCE8;--amber:#F7C325;--texto-acento:#F7C325}' +
  '@media(prefers-color-scheme:light){:root{--bg:#F7F8FA;--surface:#FFFFFF;--line:#E2E6EC;--ink:#101828;--ink2:#48566A;--amber:#F7C325;--texto-acento:#8A5A0E}}' +
  '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Poppins,system-ui,sans-serif;font-size:15px;line-height:1.55;padding-bottom:84px}' +
  '.top{max-width:760px;margin:0 auto;padding:14px 18px}' +
  '.logo{color:var(--ink);font-weight:800;font-size:20px;text-decoration:none}.logo span{color:var(--texto-acento)}' +
  '.wrap{max-width:760px;margin:0 auto;padding:0 18px}' +
  '.hero{position:relative;border-radius:24px;overflow:hidden;min-height:300px;display:flex;align-items:flex-end;background:#1E2A3A center/cover no-repeat}' +
  '.hero:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,16,26,.05) 25%,rgba(10,16,26,.88))}' +
  '.hero-t{position:relative;padding:22px;color:#fff}.reg{font-size:12px;font-weight:600;color:#F7C325;text-transform:uppercase;letter-spacing:.06em}' +
  '.hero-t h1{font-size:40px;line-height:1.05;margin:4px 0 8px}.hero-t p{margin:0;color:#E6ECF4;font-size:14px}' +
  '.facts{display:flex;gap:10px;overflow-x:auto;padding:16px 0 4px}.fact{flex:0 0 auto;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 14px}' +
  '.fact small{display:block;color:var(--ink2);font-size:12px}.fact b{font-size:14px}' +
  'h2{font-size:20px;margin:28px 0 12px}' +
  '.carr{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -18px;padding:2px 18px 12px}' +
  '.pc{flex:0 0 78%;max-width:300px;scroll-snap-align:start;background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden}' +
  '.pc img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}.pc-b{padding:12px 14px 14px}.pc h3{margin:0;font-size:17px}' +
  '.zona{margin:0 0 6px;font-size:12px;font-weight:600;color:var(--texto-acento)}' +
  '.vibe{margin:0 0 8px;color:var(--ink2);font-size:13px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}' +
  '.cuando{margin:0;font-size:12px;color:var(--ink2)}.nota{font-size:14px;color:var(--ink2)}' +
  '.ac{background:var(--surface);border:1px solid var(--line);border-radius:16px;margin:10px 0;overflow:hidden}' +
  '.ac summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:16px 18px;font-weight:700;font-size:16px}' +
  '.ac summary::-webkit-details-marker{display:none}' +
  '.ac summary i{font-style:normal;font-size:12px;background:var(--bg);border:1px solid var(--line);border-radius:99px;padding:2px 10px;color:var(--ink2)}' +
  '.lst{list-style:none;margin:0;padding:0 18px 6px}.lst li{padding:12px 0;border-top:1px solid var(--line)}' +
  '.r1{display:flex;justify-content:space-between;gap:10px}.pr{font-size:13px;font-weight:700;color:var(--texto-acento);white-space:nowrap}' +
  '.r2{margin:4px 0 2px}.chip{display:inline-block;font-size:11px;color:var(--ink2);border:1px solid var(--line);border-radius:99px;padding:1px 8px;margin:0 6px 4px 0}' +
  '.lst p{margin:4px 0 0;color:var(--ink2);font-size:13.5px}' +
  '.bar{position:fixed;left:0;right:0;bottom:0;background:var(--surface);border-top:1px solid var(--line);padding:12px 18px calc(12px + env(safe-area-inset-bottom,0px));z-index:10}' +
  '.bar-i{max-width:760px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}.bar-i span{font-weight:700;font-size:14px;line-height:1.3}' +
  '.btn{background:#F7C325;color:#0A101A;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:12px;white-space:nowrap}' +
  '.foot{margin:30px 0 0;font-size:12px;color:var(--ink2)}.foot a{color:var(--texto-acento)}';

function pagina(slug) {
  const key = POR_SLUG[slug];
  if (!key) return null;
  const dest = model.DEST[key];
  const g = guias.guiaPara(key, dest.region);
  if (!g) return null;

  const nombre = dest.name;
  const url = 'https://cuantosale.uy/destino/' + slug;
  const tienePlayas = (g.beaches || []).length > 0;
  const title = 'Qué hacer en ' + nombre + (tienePlayas ? ': playas y cuánto cuesta viajar desde Uruguay' : ': guía y cuánto cuesta viajar desde Uruguay') + ' | CuántoSale';
  const desc = String(g.resumen || '').slice(0, 155);
  // Sin playas (Sao Paulo, Gramado, Canela, Porto Alegre) las tarjetas son las
  // atracciones con foto, y el acordeon 'Que ver' no se repite.
  const playas = tienePlayas ? g.beaches : (g.atracciones || []);
  const atracciones = tienePlayas ? (g.atracciones || []) : [];
  const comer = g.comer || [];
  const hacer = g.hacer || [];
  const tips = g.tips || [];
  const t = g.temporada;
  const portada = (playas.find(function (b) { return b.foto; }) || {}).foto || '';
  const precio = function (n) { return n ? 'USD ' + n : 'Gratis'; };
  const chip = function (txt) { return txt ? '<span class="chip">' + esc(txt) + '</span>' : ''; };

  const tarjetas = playas.map(function (b) {
    return '<article class="pc">' +
      (b.foto ? '<img src="' + esc(b.foto) + '" alt="' + esc(b.name + ', ' + nombre) + '" loading="lazy" width="320" height="240">' : '') +
      '<div class="pc-b"><h3>' + esc(b.name) + '</h3><p class="zona">' + esc(b.zona) + '</p>' +
      '<p class="vibe">' + esc(b.vibe || b.nota) + '</p>' +
      (b.cuando ? '<p class="cuando"><b>Cuándo:</b> ' + esc(b.cuando) + '</p>' : '') + '</div></article>';
  }).join('');

  const fila = function (x, meta) {
    return '<li><div class="r1"><b>' + esc(x.name) + '</b><span class="pr">' + esc(meta.precio) + '</span></div>' +
      '<div class="r2">' + chip(meta.a) + chip(meta.b) + '</div><p>' + esc(x.nota) + '</p></li>';
  };
  const acordeon = function (icono, titulo, n, contenido) {
    return n ? '<details class="ac"><summary><span>' + icono + ' ' + esc(titulo) + '</span><i>' + n + '</i></summary>' + contenido + '</details>' : '';
  };

  const verHtml = '<ul class="lst">' + atracciones.map(function (x) { return fila(x, { precio: 'Gratis', a: x.zona, b: x.dur }); }).join('') + '</ul>';
  const hacerHtml = '<ul class="lst">' + hacer.map(function (x) { return fila(x, { precio: precio(x.usd), a: x.zona, b: x.dur }); }).join('') + '</ul>';
  const comerHtml = '<ul class="lst">' + comer.map(function (x) { return fila(x, { precio: precio(x.usd), a: x.tipo, b: x.zona }); }).join('') + '</ul>';
  const tipsHtml = '<ul class="lst">' + tips.map(function (x) {
    return '<li><div class="r1"><b>' + esc(x.titulo) + '</b></div><p>' + esc(x.texto) + '</p></li>';
  }).join('') + '</ul>';

  const ld = {
    '@context': 'https://schema.org', '@type': 'TouristDestination', name: nombre, url: url,
    description: g.resumen, touristType: 'Viajeros desde Uruguay',
    containedInPlace: { '@type': 'AdministrativeArea', name: dest.region + ', Brasil' }
  };

  return '<!doctype html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(desc) + '">' +
    '<meta name="theme-color" content="#0A101A"><link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="article"><meta property="og:site_name" content="CuántoSale">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + url + '"><meta property="og:image" content="' + esc(portada || 'https://cuantosale.uy/og-cuantosale.jpg') + '">' +
    '<meta property="og:locale" content="es_UY"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    '<style>' + CSS + '</style></head><body>' +
    '<header class="top"><a class="logo" href="/">Cuánto<span>Sale</span></a></header><main class="wrap">' +
    '<section class="hero"' + (portada ? ' style="background-image:url(' + esc(portada) + ')"' : '') + '><div class="hero-t">' +
    '<div class="reg">' + esc(dest.region) + ', Brasil</div><h1>' + esc(nombre) + '</h1><p>' + esc(g.resumen) + '</p></div></section>' +
    (t ? '<div class="facts"><div class="fact"><small>Temporada alta</small><b>' + esc(listaMeses(t.alta)) + '</b></div>' +
      '<div class="fact"><small>Más tranquilo</small><b>' + esc(listaMeses(t.baja)) + '</b></div>' +
      '<div class="fact"><small>' + (tienePlayas ? 'Playas' : 'Lugares') + ' en la guía</small><b>' + playas.length + '</b></div></div>' : '') +
    '<h2>' + (tienePlayas ? '🏖️ Playas de ' : '📍 Qué ver en ') + esc(nombre) + '</h2><div class="carr">' + tarjetas + '</div>' +
    (t && t.nota ? '<p class="nota">' + esc(t.nota) + '</p>' : '') +
    '<h2>Todo lo que tenés que saber</h2>' +
    acordeon('📍', 'Qué ver', atracciones.length, verHtml) +
    acordeon('🚤', 'Qué hacer', hacer.length, hacerHtml) +
    acordeon('🍽️', 'Dónde comer', comer.length, comerHtml) +
    acordeon('💡', 'Tips locales', tips.length, tipsHtml) +
    '<p class="foot">Fotos: Wikimedia Commons. Precios de las actividades en dólares, aproximados. ' +
    '<a href="/">CuántoSale</a> calcula cuánto sale viajar a Brasil desde Uruguay.</p></main>' +
    '<div class="bar"><div class="bar-i"><span>¿Cuánto sale viajar a ' + esc(nombre) + '?</span><a class="btn" href="/">Calcular mi viaje</a></div></div>' +
    '</body></html>';
}

module.exports = { pagina, slugs, slugDe };
