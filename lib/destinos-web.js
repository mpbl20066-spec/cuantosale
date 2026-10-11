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
const tours = require('./tours');
const completa = require('./destinos-guia-completa');

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

/* Las fotos de la guia son miniaturas de Wikimedia de 960-1280px (~300 KB cada una) y en esta pagina se ven a 300px
   en las tarjetas: en un celular con 4G la pagina bajaba 2 MB y la portada tardaba 6 s. Wikimedia arma la miniatura
   del ancho que diga la URL; se piden anchos de su lista estandar (500 y 960), que ya estan generados y no cuentan
   para el limite de pedidos (con anchos arbitrarios respondia 429). Solo achica: una foto mas chica queda igual. */
function miniatura(url, ancho) {
  return String(url || '').replace(/^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/)(\d+)px-([^/]+)$/, function (m, base, w, nombre) {
    return Number(w) > ancho ? base + ancho + 'px-' + nombre : m;
  });
}

// Poppins desde el propio dominio, como index.html: antes se pedia el CSS a fonts.googleapis.com (bloquea el primer
// pintado) y despues los .woff2 a fonts.gstatic.com, dos conexiones nuevas en cada visita que llega desde Google.
const FUENTES = [400, 600, 700, 800].map(function (w) {
  return "@font-face{font-family:'Poppins';font-style:normal;font-weight:" + w + ";font-display:swap;src:url(/fonts/poppins-" + w + ".woff2?v=1) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}";
}).join('');

// El tema sigue la eleccion guardada en el resto del sitio (cuantosale_tema) y, sin eleccion, al sistema. Va antes
// del CSS para que no haya un destello del otro tema. Sin JS manda la media query.
const TEMA_JS = "(function(){var g=null;try{g=localStorage.getItem('cuantosale_tema');}catch(e){}" +
  "if(g!=='light'&&g!=='night')g=(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'light':'night';" +
  "document.documentElement.setAttribute('data-theme',g);})();";

const CLARO = '--bg:#F7F8FA;--surface:#FFFFFF;--line:#E2E6EC;--ink:#101828;--ink2:#48566A;--amber:#F7C325;--texto-acento:#8A5A0E';
const CSS = FUENTES + ':root{--bg:#0A101A;--surface:#111A28;--line:#2A3646;--ink:#FFFFFF;--ink2:#D3DCE8;--amber:#F7C325;--texto-acento:#F7C325}' +
  ':root[data-theme="light"]{' + CLARO + '}' +
  '@media(prefers-color-scheme:light){:root:not([data-theme]){' + CLARO + '}}' +
  '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Poppins,system-ui,sans-serif;font-size:15px;line-height:1.55;padding-bottom:84px}' +
  '.top{max-width:760px;margin:0 auto;padding:8px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}' +
  '.logo{display:inline-flex;align-items:center;gap:8px;min-height:44px;color:var(--ink);font-weight:800;font-size:20px;letter-spacing:-.01em;text-decoration:none}' +
  '.nav{display:flex;gap:4px}.nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border-radius:10px;color:var(--ink2);font-size:14px;font-weight:600;text-decoration:none}' +
  '.nav a:hover{color:var(--ink)}.nav a.cta{background:#F7C325;color:#0A101A;font-weight:700}' +
  '.logo:focus-visible,.nav a:focus-visible,.btn:focus-visible,.btn-s:focus-visible,.lk:focus-visible{outline:3px solid #F7C325;outline-offset:2px}' +
  '@media(max-width:420px){.nav a:not(.cta){display:none}}' +
  '.wrap{max-width:760px;margin:0 auto;padding:0 18px}' +
  '.hero{position:relative;border-radius:24px;overflow:hidden;min-height:300px;display:flex;align-items:flex-end;background:#1E2A3A center/cover no-repeat}' +
  '.hero:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,16,26,.05) 25%,rgba(10,16,26,.88))}' +
  '.hero-t{position:relative;padding:22px;color:#fff}.reg{font-size:12px;font-weight:600;color:#F7C325;text-transform:uppercase;letter-spacing:.06em}' +
  '.hero-t{min-width:0}.hero-t h1{font-size:clamp(30px,10vw,40px);line-height:1.05;margin:4px 0 8px;overflow-wrap:anywhere}.hero-t p{margin:0;color:#E6ECF4;font-size:14px}' +
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
  '.r2{margin:4px 0 2px}.chip{display:inline-block;font-size:12px;color:var(--ink2);border:1px solid var(--line);border-radius:99px;padding:1px 8px;margin:0 6px 4px 0}' +
  '.lst p{margin:4px 0 0;color:var(--ink2);font-size:13.5px}' +
  '.bar{position:fixed;left:0;right:0;bottom:0;background:var(--surface);border-top:1px solid var(--line);padding:12px 18px calc(12px + env(safe-area-inset-bottom,0px));z-index:10}' +
  '.bar-i{max-width:760px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}.bar-i span{font-weight:700;font-size:14px;line-height:1.3}' +
  '.btn{background:#F7C325;color:#0A101A;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:12px;white-space:nowrap}' +
  '.tc{flex:0 0 78%;max-width:300px;scroll-snap-align:start;background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column}' +
  '.tc img,.tc .ph{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#1E2A3A}.tc .pc-b{display:flex;flex-direction:column;flex:1}' +
  '.tc .go{margin-top:auto;padding-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px}' +
  '.btn-s{display:inline-flex;align-items:center;min-height:44px;background:#F7C325;color:#0A101A;font-weight:700;font-size:13px;text-decoration:none;padding:0 14px;border-radius:10px;white-space:nowrap}' +
  '.ph{display:flex;align-items:center;justify-content:center;font-size:34px}' +
  '.p2{margin:4px 0 6px;color:var(--ink2);font-size:13.5px}.lk{display:inline-block;padding:10px 0;font-size:13px;font-weight:700;color:var(--texto-acento);text-decoration:none}' +
  '.cta2{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px;margin:26px 0;text-align:center}.cta2 h2{margin:0 0 6px;font-size:19px}.cta2 p{margin:0 0 12px;color:var(--ink2)}.cta2 .btn{display:inline-block;max-width:100%;white-space:normal}' +
  '.foot{margin:30px 0 0;font-size:12px;color:var(--ink2)}.foot a{color:var(--texto-acento)}' +
  'html.cs-consent .bar{bottom:var(--csh,0px)}' +
  '@media(min-width:900px){.top,.wrap,.bar-i{max-width:960px}.pc,.tc{flex-basis:300px}}';

async function pagina(slug) {
  const key = POR_SLUG[slug];
  if (!key) return null;
  const dest = model.DEST[key];
  const g = guias.guiaPara(key, dest.region);
  if (!g) return null;

  const nombre = dest.name;
  // La home de la raiz no lee ?destino=; /destinos (home-destino.html) si, y arranca con el destino elegido.
  const app = '/destinos?destino=' + encodeURIComponent(key) + '&fuente=seo_destino';
  const ex = completa[key] || null;
  let ts = [];
  try { ts = (await tours.destino(key)).slice(0, 8); } catch (e) { ts = []; }
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
  const portada = miniatura((playas.find(function (b) { return b.foto; }) || {}).foto || '', 960);
  const precio = function (n) { return n ? 'USD ' + n : 'Gratis'; };
  const chip = function (txt) { return txt ? '<span class="chip">' + esc(txt) + '</span>' : ''; };

  const tarjetas = playas.map(function (b) {
    return '<article class="pc">' +
      (b.foto ? '<img src="' + esc(miniatura(b.foto, 500)) + '" alt="' + esc(b.name + ', ' + nombre) + '" loading="lazy" decoding="async" width="320" height="240">' : '') +
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

  const lista = function (items) {
    return '<ul class="lst">' + items.map(function (x) {
      return '<li><div class="r1"><b>' + esc(x.t) + '</b></div><p>' + esc(x.d) + '</p></li>';
    }).join('') + '</ul>';
  };
  const bullets = function (arr) { return '<ul class="lst">' + arr.map(function (b) { return '<li><p>' + esc(b) + '</p></li>'; }).join('') + '</ul>'; };
  const intro = function (txt) { return txt ? '<p class="p2" style="padding:0 18px">' + esc(txt) + '</p>' : ''; };
  const seccion = function (sec) {
    return '<details class="ac"><summary><span>' + sec.icono + ' ' + esc(sec.titulo) + '</span></summary>' + intro(sec.intro) +
      (sec.items ? lista(sec.items) : '') +
      (sec.grupos ? sec.grupos.map(function (gr) { return '<p class="p2" style="padding:0 18px"><b>' + esc(gr.titulo) + '</b></p>' + bullets(gr.bullets); }).join('') : '') +
      (sec.bullets ? bullets(sec.bullets) : '') +
      (sec.cierre ? lista([sec.cierre]) : '') + '</details>';
  };
  const imperdibles = ex ? '<h2>⭐ Los imperdibles de ' + esc(nombre) + '</h2><div class="carr">' + ex.imperdibles.map(function (x) {
    return '<article class="pc">' + (x.foto ? '<img src="' + esc(miniatura(x.foto, 500)) + '" alt="' + esc(x.name + ', ' + nombre) + '" loading="lazy" decoding="async" width="320" height="240">' : '') +
      '<div class="pc-b"><h3>' + esc(x.name) + '</h3><p class="vibe">' + esc(x.d) + '</p><a class="lk" href="' + app + '">Ver tours y precios →</a></div></article>';
  }).join('') + '</div>' : '';
  const toursHtml = ts.length ? '<h2>🎟️ Tours y excursiones en ' + esc(nombre) + '</h2><div class="carr">' + ts.map(function (x) {
    const img = (x.images && x.images[0]) || (x.foto && x.foto.url) || x.image || '';
    return '<article class="tc">' + (img ? '<img src="' + esc(miniatura(img, 500)) + '" alt="' + esc(x.title) + '" loading="lazy" decoding="async" width="320" height="240">' : '<div class="ph">🎟️</div>') +
      '<div class="pc-b"><h3>' + esc(x.title) + '</h3>' + (x.duracion ? '<p class="zona">' + esc(x.duracion) + '</p>' : '') +
      '<p class="vibe">' + esc(x.description) + '</p><div class="go"><b>' + (x.price ? 'Desde USD ' + Math.round(x.price) : '') + '</b>' +
      '<a class="btn-s" href="' + app + '">Reservar en la app</a></div></div></article>';
  }).join('') + '</div>' : '';
  const faqHtml = ex ? '<details class="ac"><summary><span>❓ Preguntas frecuentes</span><i>' + ex.faq.length + '</i></summary>' +
    lista(ex.faq.map(function (f) { return { t: f.q, d: f.a }; })) + '</details>' : '';
  const faqLd = ex ? '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: ex.faq.map(function (f) { return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }; })
  }).replace(/</g, '\\u003c') + '</script>' : '';
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
    '<link rel="icon" href="/favicon.ico" sizes="any"><script>' + TEMA_JS + '</script>' +
    '<link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-400.woff2?v=1" crossorigin>' +
    '<link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-700.woff2?v=1" crossorigin>' +
    (portada ? '<link rel="preload" as="image" href="' + esc(portada) + '" fetchpriority="high">' : '') +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    faqLd +
    '<style>' + CSS + '</style></head><body>' +
    '<header class="top"><a class="logo" href="/" aria-label="CuántoSale, ir al inicio"><svg width="20" height="25" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 20 12 30 12 30s12-10 12-18.2C24 5.3 18.6 0 12 0z" fill="currentColor"/><circle cx="12" cy="11.5" r="4.6" fill="#F6B21B"/></svg>cuántosale</a>' +
    '<nav class="nav" aria-label="Principal"><a href="/guias">Destinos</a><a class="cta" href="' + app + '">Calcular viaje</a></nav></header><main class="wrap">' +
    '<section class="hero"' + (portada ? ' style="background-image:url(' + esc(portada) + ')"' : '') + '><div class="hero-t">' +
    '<div class="reg">' + esc(dest.region) + ', Brasil</div><h1>' + esc(nombre) + '</h1><p>' + esc(g.resumen) + '</p></div></section>' +
    (t ? '<div class="facts"><div class="fact"><small>Temporada alta</small><b>' + esc(listaMeses(t.alta)) + '</b></div>' +
      '<div class="fact"><small>Más tranquilo</small><b>' + esc(listaMeses(t.baja)) + '</b></div>' +
      '<div class="fact"><small>' + (tienePlayas ? 'Playas' : 'Lugares') + ' en la guía</small><b>' + playas.length + '</b></div></div>' : '') +
    (ex ? seccion({ icono: '🧳', titulo: ex.antes.titulo, intro: ex.antes.intro, items: ex.antes.items, bullets: ex.antes.bullets }) : '') +
    imperdibles +
    '<h2>' + (tienePlayas ? '🏖️ Playas de ' : '📍 Qué ver en ') + esc(nombre) + '</h2><div class="carr">' + tarjetas + '</div>' +
    (t && t.nota ? '<p class="nota">' + esc(t.nota) + '</p>' : '') +
    toursHtml +
    '<h2>Todo lo que tenés que saber</h2>' +
    (ex ? ex.secciones.map(seccion).join('') : '') +
    acordeon('📍', 'Qué ver', atracciones.length, verHtml) +
    acordeon('🚤', 'Qué hacer', hacer.length, hacerHtml) +
    acordeon('🍽️', 'Dónde comer', comer.length, comerHtml) +
    acordeon('💡', 'Tips locales', tips.length, tipsHtml) +
    faqHtml +
    '<div class="cta2"><h2>¿Cuánto sale tu viaje a ' + esc(nombre) + '?</h2><p>Vuelo, hotel, traslados y tours en un solo presupuesto, según tus fechas y cuántos viajan.</p><a class="btn" href="' + app + '">Calcular mi viaje a ' + esc(nombre) + '</a></div>' +
    '<p class="foot">' + (ex ? esc(ex.fuentes) + ' ' : '') + 'Fotos: Wikimedia Commons. Precios de las actividades en dólares, aproximados. ' +
    '<a href="/">CuántoSale</a> calcula cuánto sale viajar a Brasil desde Uruguay.</p></main>' +
    '<div class="bar"><div class="bar-i"><span>¿Cuánto sale viajar a ' + esc(nombre) + '?</span><a class="btn" href="' + app + '">Calcular mi viaje</a></div></div>' +
    '</body></html>';
}

module.exports = { pagina, slugs, slugDe };
