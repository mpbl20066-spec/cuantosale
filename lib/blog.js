'use strict';
/* Blog (/blog y /blog/<slug>): notas para Google que responden lo que la gente busca ANTES de elegir destino
   ("cuanto sale ir a Floripa en enero", "Floripa o Camboriu"). Las guias (/destino/<slug>) cubren cada destino;
   las notas comparan, rankean y presupuestan, y terminan en la calculadora o en la guia.

   Cada nota es un archivo data/blog/<slug>.html: la primera linea es un comentario con los datos en JSON y el resto es
   el cuerpo en HTML (h2, p, ul, tablas con class="tabla", recuadros con class="caja"). Los numeros salen de
   scripts/blog-datos.js (el mismo calculo que las guias) y cada nota dice de que dia son.

     <!-- {"titulo": "...", "descripcion": "...", "publicada": "2026-10-14", "actualizada": "2026-10-14",
           "foto": "fln", "destinos": ["fln", "bcm"], "resumen": "..."} -->

   Al pie de cada nota va un enlace a la siguiente del mismo destino: la que dice "siguiente" (un slug) en los datos o,
   si no dice, la proxima que comparte el destino principal (o cualquiera de sus destinos), en orden de publicacion.

   Para publicar una nota alcanza con sumar el archivo: la portada, el sitemap y los enlaces se arman solos. Un archivo
   que empieza con "_" es un borrador y no se publica. */

const fs = require('fs');
const path = require('path');
const model = require('./model');
const destinosWeb = require('./destinos-web');

const DIR = path.join(__dirname, '..', 'data', 'blog');
const BASE = 'https://cuantosale.uy';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fechaLarga(iso) {
  const p = String(iso || '').split('-');
  return p.length < 3 ? '' : (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0];
}
const ldJson = function (o) { return '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>'; };

/* Las notas se leen una vez por instancia (en Vercel no cambian dentro de un despliegue); en local en cada pedido. */
let cache = null;
function notas() {
  if (cache && process.env.VERCEL) return cache;
  let archivos = [];
  try { archivos = fs.readdirSync(DIR).filter(function (f) { return /^[a-z0-9-]+\.html$/.test(f); }); } catch (e) { archivos = []; }
  const lista = archivos.map(function (f) {
    const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
    const m = /^\s*<!--([\s\S]*?)-->/.exec(txt);
    if (!m) return null;
    let meta;
    try { meta = JSON.parse(m[1]); } catch (e) { console.error('[blog] meta invalida en ' + f + ': ' + e.message); return null; }
    const cuerpo = txt.slice(m[0].length).trim();
    const palabras = cuerpo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Object.assign({ slug: f.slice(0, -5), cuerpo: cuerpo, minutos: Math.max(2, Math.round(palabras / 200)) }, meta);
  }).filter(Boolean).sort(function (a, b) { return String(b.publicada).localeCompare(String(a.publicada)); });
  cache = lista;
  return lista;
}

const fotoDe = function (n) { return n.foto && /^[a-z]+$/.test(n.foto) ? '/fotos/' + n.foto + '.jpg' : '/og-cuantosale.jpg'; };
const guiaDe = function (clave) {
  const d = model.DEST[clave];
  if (!d) return null;
  const slug = destinosWeb.slugDeClave(clave);
  return slug ? { nombre: d.name, url: '/destino/' + slug, clave: clave } : null;
};

const CSS = destinosWeb.FUENTES +
  ':root{--bg:#0A101A;--surface:#111A28;--surface2:#16212F;--line:#2A3646;--ink:#FFFFFF;--ink2:#D3DCE8;--acento:#F7C325}' +
  ':root[data-theme="light"]{--bg:#F7F8FA;--surface:#FFFFFF;--surface2:#F1F4F8;--line:#E2E6EC;--ink:#101828;--ink2:#48566A;--acento:#8A5A0E}' +
  '@media(prefers-color-scheme:light){:root:not([data-theme]){--bg:#F7F8FA;--surface:#FFFFFF;--surface2:#F1F4F8;--line:#E2E6EC;--ink:#101828;--ink2:#48566A;--acento:#8A5A0E}}' +
  '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Poppins,system-ui,sans-serif;font-size:16px;line-height:1.65}' +
  '.top{max-width:760px;margin:0 auto;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}' +
  '.logo{display:inline-flex;align-items:center;gap:8px;min-height:44px;color:var(--ink);font-weight:800;font-size:20px;letter-spacing:-.01em;text-decoration:none}' +
  '.nav{display:flex;gap:4px}.nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border-radius:10px;color:var(--ink2);font-size:14px;font-weight:600;text-decoration:none}' +
  '.nav a:hover{color:var(--ink)}.nav a.cta{background:#F7C325;color:#0A101A;font-weight:700}' +
  '@media(max-width:420px){.nav a:not(.cta){display:none}}' +
  'a:focus-visible{outline:3px solid #F7C325;outline-offset:2px}' +
  '.wrap{max-width:760px;margin:0 auto;padding:0 16px 64px}' +
  '.migas{margin:6px 0 12px;font-size:13px;color:var(--ink2)}.migas a{color:var(--ink2)}' +
  '.hero{position:relative;border-radius:22px;overflow:hidden;min-height:260px;display:flex;align-items:flex-end;background:#1E2A3A center/cover no-repeat}' +
  '.hero:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,16,26,.05) 20%,rgba(10,16,26,.9))}' +
  '.hero-t{position:relative;padding:22px;color:#fff;min-width:0}.hero h1{margin:0 0 8px;font-size:clamp(26px,7vw,38px);line-height:1.12;overflow-wrap:anywhere}' +
  '.hero p{margin:0;color:#E6ECF4;font-size:13.5px}' +
  '.lead{margin:22px 0 0;font-size:18px;line-height:1.6}' +
  '.art h2{font-size:23px;line-height:1.25;margin:38px 0 10px}.art h3{font-size:18px;margin:24px 0 6px}' +
  '.art p,.art li{color:var(--ink2)}.art b,.art strong{color:var(--ink)}.art a{color:var(--acento)}' +
  '.art ul,.art ol{padding-left:22px}.art li{margin:6px 0}' +
  '.tabla-w{overflow-x:auto;margin:14px 0}' +
  '.tabla{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14.5px}' +
  '.tabla th,.tabla td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;color:var(--ink2)}' +
  '.tabla th{font-size:12px;letter-spacing:.04em;text-transform:uppercase}.tabla td:first-child{color:var(--ink);font-weight:600}' +
  '.tabla td.n,.tabla th.n{text-align:right;white-space:nowrap}.tabla tr:last-child td{border-bottom:0}.tabla tr.total td{color:var(--ink);font-weight:800}' +
  '.tabla tr.dest td{background:rgba(247,195,37,.12)}' +
  /* En el celular entran las 4 columnas (rubro + auto, bus y avion) sin scroll: menos aire y letra un poco mas chica. */
  '@media(max-width:520px){.tabla{font-size:13px}.tabla th,.tabla td{padding:8px 6px}.tabla th{font-size:10.5px;letter-spacing:.02em}.tabla td:first-child{padding-left:10px}}' +
  '.caja{margin:16px 0;padding:16px 18px;border-radius:14px;background:var(--surface2);border:1px solid var(--line)}.caja p{margin:6px 0 0}.caja p:first-child{margin:0}' +
  '.nota{font-size:13.5px;color:var(--ink2)}' +
  /* Tarjetas lado a lado (X o Y) y dato destacado en grande: para que la nota no sea solo tablas. */
  '.vs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.vs>div{padding:16px 18px;border-radius:16px;background:var(--surface);border:1px solid var(--line)}' +
  '.vs .em{display:block;font-size:30px;line-height:1.1}.vs h3{margin:6px 0 4px;font-size:19px}.vs p{margin:6px 0 0;font-size:14.5px;line-height:1.55}' +
  '.vs .tag{display:inline-block;margin-top:10px;padding:3px 11px;border-radius:99px;background:rgba(247,195,37,.16);color:var(--ink);font-size:12.5px;font-weight:700}' +
  '@media(max-width:520px){.vs{grid-template-columns:1fr}}' +
  '.dato{display:flex;gap:16px;align-items:center;margin:20px 0;padding:16px 18px;border-radius:16px;background:rgba(247,195,37,.12);border:1px solid rgba(247,195,37,.35)}' +
  '.dato .gr{flex:none;font-size:34px;line-height:1;font-weight:800;color:var(--ink);white-space:nowrap}.dato span{color:var(--ink2);font-size:15px;line-height:1.5}' +
  '@media(max-width:420px){.dato{flex-direction:column;align-items:flex-start;gap:6px}}' +
  '.cta-in{display:inline-flex;align-items:center;min-height:46px;margin:6px 0;padding:0 18px;border-radius:12px;background:#F7C325;color:#0A101A!important;font-weight:800;text-decoration:none}' +
  '.fin{margin:44px 0 0;padding:22px;border-radius:18px;background:var(--surface);border:1px solid var(--line);text-align:center}' +
  '.fin h2{margin:0 0 6px;font-size:22px}.fin p{margin:0 auto 14px;max-width:520px;color:var(--ink2)}' +
  '.guias{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0 0;padding:0;list-style:none}' +
  '.guias a{display:inline-block;padding:7px 13px;border:1px solid var(--line);border-radius:99px;background:var(--surface2);color:var(--ink);font-size:14px;font-weight:600;text-decoration:none}' +
  /* La siguiente nota del mismo destino, al terminar de leer. */
  '.sig{display:flex;gap:14px;align-items:center;margin:34px 0 0;padding:12px;border-radius:18px;background:var(--surface);border:1px solid var(--acento);color:var(--ink);text-decoration:none}' +
  '.sig img{flex:none;width:132px;aspect-ratio:4/3;object-fit:cover;border-radius:12px;background:#1E2A3A}.sig div{min-width:0}' +
  '.sig small{display:block;color:var(--acento);font-size:13px;font-weight:700}.sig b{display:block;margin:2px 0 0;font-size:17px;line-height:1.3}' +
  '.sig p{margin:4px 0 0;color:var(--ink2);font-size:14px;line-height:1.45}.sig:hover b{color:var(--acento)}' +
  '@media(max-width:480px){.sig img{width:92px}.sig p{display:none}}' +
  '.mas{margin-top:40px}.mas h2{font-size:20px;margin:0 0 12px}' +
  '.lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin:0;padding:0;list-style:none}' +
  '.card{display:flex;flex-direction:column;height:100%;background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;color:var(--ink);text-decoration:none}' +
  '.card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#1E2A3A}' +
  '.card div{padding:12px 14px 16px}.card b{display:block;font-size:16.5px;line-height:1.3}.card p{margin:6px 0 0;color:var(--ink2);font-size:14px;line-height:1.5}' +
  '.card small{display:block;margin-top:8px;color:var(--ink2);font-size:12.5px}' +
  '.card:hover b{color:var(--acento)}' +
  '.foot{margin:40px 0 0;padding-top:18px;border-top:1px solid var(--line);font-size:13px;color:var(--ink2)}.foot a{color:var(--acento)}';

const LOGO = '<svg width="20" height="25" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 20 12 30 12 30s12-10 12-18.2C24 5.3 18.6 0 12 0z" fill="currentColor"/><circle cx="12" cy="11.5" r="4.6" fill="#F6B21B"/></svg>';

function cabeza(o) {
  return '<!doctype html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<title>' + esc(o.title) + '</title><meta name="description" content="' + esc(o.desc) + '">' +
    '<meta name="theme-color" content="#0A101A"><link rel="canonical" href="' + o.url + '">' +
    '<meta property="og:type" content="' + o.ogType + '"><meta property="og:site_name" content="CuántoSale">' +
    '<meta property="og:title" content="' + esc(o.title) + '"><meta property="og:description" content="' + esc(o.desc) + '">' +
    '<meta property="og:url" content="' + o.url + '"><meta property="og:image" content="' + esc(BASE + o.foto) + '">' +
    '<meta property="og:locale" content="es_UY"><meta name="twitter:card" content="summary_large_image">' +
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="icon" href="/favicon.ico" sizes="any">' +
    '<script>' + destinosWeb.TEMA_JS + '</script>' +
    '<link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-400.woff2?v=1" crossorigin>' +
    '<link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-700.woff2?v=1" crossorigin>' +
    o.ld.map(ldJson).join('') +
    '<style>' + CSS + '</style></head><body>' +
    '<header class="top"><a class="logo" href="/" aria-label="CuántoSale, ir al inicio">' + LOGO + 'cuántosale</a>' +
    '<nav class="nav" aria-label="Principal"><a href="/guias">Destinos</a><a href="/blog">Blog</a><a class="cta" href="/destinos?fuente=blog">Calcular viaje</a></nav></header>';
}
const pie = '<p class="foot"><a href="/">CuántoSale</a> calcula cuánto sale viajar a Brasil desde Uruguay. ' +
  '<a href="/como-calculamos">De dónde salen los precios</a> · <a href="/preguntas-frecuentes">Preguntas frecuentes</a> · <a href="/quienes-somos">Quiénes somos</a> · Fotos: Wikimedia Commons.</p>';

/* La siguiente nota del mismo destino. Sin "siguiente" en los datos: se recorren las notas de la mas vieja a la mas
   nueva (dando la vuelta) y gana la primera que tiene el destino principal; si ninguna lo tiene, la primera que
   comparte alguno. */
function siguienteDe(n) {
  const todas = notas();
  if (n.siguiente) { const s = todas.find(function (x) { return x.slug === n.siguiente && x.slug !== n.slug; }); if (s) return s; }
  const dest = n.destinos || [];
  if (!dest.length) return null;
  const orden = todas.slice().sort(function (a, b) { return String(a.publicada).localeCompare(String(b.publicada)) || a.slug.localeCompare(b.slug); });
  const i = orden.findIndex(function (x) { return x.slug === n.slug; });
  const ronda = orden.slice(i + 1).concat(orden.slice(0, i));
  return ronda.find(function (x) { return (x.destinos || []).indexOf(dest[0]) >= 0; }) ||
    ronda.find(function (x) { return (x.destinos || []).some(function (d) { return dest.indexOf(d) >= 0; }); }) || null;
}

function tarjeta(n) {
  return '<li><a class="card" href="/blog/' + n.slug + '"><img src="' + fotoDe(n) + '" alt="" loading="lazy" width="640" height="360">' +
    '<div><b>' + esc(n.titulo) + '</b><p>' + esc(n.resumen || n.descripcion) + '</p><small>' + fechaLarga(n.publicada) + ' · ' + n.minutos + ' min de lectura</small></div></a></li>';
}

const ORG = { '@type': 'Organization', '@id': BASE + '/#org', name: 'CuántoSale', url: BASE, logo: BASE + '/icons/apple-touch-icon.png' };

function pagina(slug) {
  const n = notas().find(function (x) { return x.slug === slug; });
  if (!n) return null;
  const url = BASE + '/blog/' + n.slug, foto = fotoDe(n);
  const guias = (n.destinos || []).map(guiaDe).filter(Boolean);
  const principal = guias[0] || null;
  const app = '/destinos?' + (principal ? 'destino=' + principal.clave + '&' : '') + 'fuente=blog_' + n.slug.slice(0, 40);
  const sig = siguienteDe(n);
  const otras = notas().filter(function (x) { return x.slug !== n.slug && (!sig || x.slug !== sig.slug); }).slice(0, 3);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: n.titulo, description: n.descripcion, image: [BASE + foto],
      datePublished: n.publicada, dateModified: n.actualizada || n.publicada, inLanguage: 'es-UY',
      author: ORG, publisher: ORG, mainEntityOfPage: url },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: BASE + '/blog' },
      { '@type': 'ListItem', position: 3, name: n.titulo, item: url }] }
  ];
  return cabeza({ title: n.titulo + ' | CuántoSale', desc: n.descripcion, url: url, ogType: 'article', foto: foto, ld: ld }) +
    '<main class="wrap"><nav class="migas" aria-label="Estás en"><a href="/">Inicio</a> › <a href="/blog">Blog</a></nav>' +
    '<article><header class="hero" style="background-image:url(' + foto + ')"><div class="hero-t"><h1>' + esc(n.titulo) + '</h1>' +
    '<p>' + (n.actualizada && n.actualizada !== n.publicada ? 'Actualizada el ' + fechaLarga(n.actualizada) : 'Publicada el ' + fechaLarga(n.publicada)) + ' · ' + n.minutos + ' min de lectura</p></div></header>' +
    '<div class="art">' + n.cuerpo + '</div></article>' +
    (sig ? '<a class="sig" href="/blog/' + sig.slug + '"><img src="' + fotoDe(sig) + '" alt="" loading="lazy" width="640" height="360">' +
      '<div><small>Seguí leyendo →</small><b>' + esc(sig.titulo) + '</b><p>' + esc(sig.resumen || sig.descripcion) + '</p></div></a>' : '') +
    '<section class="fin"><h2>' + (principal ? '¿Cuánto te sale a vos ir a ' + esc(principal.nombre) + '?' : '¿Cuánto te sale a vos?') + '</h2>' +
    '<p>Poné tus fechas y cuántos viajan: vuelo, hotel, traslados y gastos del día en un solo número.</p>' +
    '<a class="cta-in" href="' + app + '">Calcular mi viaje</a>' +
    (guias.length ? '<ul class="guias">' + guias.map(function (g) { return '<li><a href="' + g.url + '">Guía de ' + esc(g.nombre) + '</a></li>'; }).join('') + '</ul>' : '') + '</section>' +
    (otras.length ? '<section class="mas"><h2>Más notas</h2><ul class="lista">' + otras.map(tarjeta).join('') + '</ul></section>' : '') +
    pie + '</main>' +
    '<script src="/web/wa-flotante.js" data-lugar="blog"' + (principal ? ' data-destino="' + esc(principal.nombre) + '"' : '') + ' defer></script></body></html>';
}

function indice() {
  const l = notas();
  const url = BASE + '/blog';
  const ld = [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Blog de CuántoSale', url: url, inLanguage: 'es-UY', publisher: ORG,
    blogPost: l.map(function (n) { return { '@type': 'BlogPosting', headline: n.titulo, url: url + '/' + n.slug, datePublished: n.publicada }; }) }];
  return cabeza({ title: 'Blog: cuánto sale viajar a Brasil desde Uruguay | CuántoSale',
    desc: 'Presupuestos, comparaciones y rankings para viajar a Brasil desde Uruguay, con precios reales de vuelos y hoteles.',
    url: url, ogType: 'website', foto: '/og-cuantosale.jpg', ld: ld }) +
    '<main class="wrap"><nav class="migas" aria-label="Estás en"><a href="/">Inicio</a> › Blog</nav>' +
    '<h1 style="font-size:clamp(28px,7vw,38px);line-height:1.15;margin:8px 0 8px">Blog</h1>' +
    '<p class="lead" style="margin:0 0 24px;color:var(--ink2)">Cuánto sale, cuándo conviene y a dónde llegás con tu plata: notas para armar tu viaje a Brasil desde Uruguay, con precios reales.</p>' +
    (l.length ? '<ul class="lista">' + l.map(tarjeta).join('') + '</ul>' : '<p>Pronto, las primeras notas.</p>') +
    pie + '</main><script src="/web/wa-flotante.js" data-lugar="blog" defer></script></body></html>';
}

/* Para el sitemap: la portada del blog y cada nota, con su fecha. */
function urlsSitemap() {
  const l = notas();
  if (!l.length) return '';
  return '  <url>\n    <loc>' + BASE + '/blog</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n' +
    l.map(function (n) {
      return '  <url>\n    <loc>' + BASE + '/blog/' + n.slug + '</loc>\n    <lastmod>' + (n.actualizada || n.publicada) + '</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n';
    }).join('');
}

module.exports = { pagina, indice, notas, urlsSitemap };
