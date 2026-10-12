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
/* Clave del destino (rio, fln...) -> slug de su pagina publica, o null si no tiene. */
function slugDeClave(key) { return slugs().find(function (s) { return POR_SLUG[s] === key; }) || null; }
/* Enlaces <a> a todas las paginas publicas, ordenados por nombre: los usa /guias para que Google las encuentre
   por enlaces internos y no solo por el sitemap. */
function enlacesHtml() {
  return slugs().map(function (s) { return { s: s, n: model.DEST[POR_SLUG[s]].name }; })
    .sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); })
    .map(function (d) { return '<li><a href="/destino/' + d.s + '">' + esc(d.n) + '</a></li>'; }).join('');
}

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
  '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Poppins,system-ui,sans-serif;font-size:15px;line-height:1.55;}' +
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
  '.carr{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin:0;padding:2px 0 12px}.carr>*{flex:0 0 calc((100% - 28px)/3);min-width:0}.carr>.mapa{flex-basis:100%}' +
  '@media(max-width:820px){.carr>*{flex-basis:calc((100% - 14px)/2)}}@media(max-width:520px){.carr>*{flex-basis:100%}}' +
  '.pc{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden}' +
  '.pc img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}.pc-b{padding:12px 14px 14px}.pc h3{margin:0;font-size:17px}' +
  '.zona{margin:0 0 6px;font-size:12px;font-weight:600;color:var(--texto-acento)}' +
  '.vibe{margin:0 0 8px;color:var(--ink2);font-size:13px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}' +
  '.clima{overflow-x:auto;margin:6px 0 4px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}' +
  '.clima table{border-collapse:collapse;width:100%;font-size:13px}.clima th,.clima td{padding:8px 4px;text-align:center;border-bottom:1px solid var(--line);white-space:nowrap}' +
  '.clima thead th{font-size:12px;color:var(--ink2);font-weight:700}.clima th[scope=row]{position:sticky;left:0;text-align:left;padding-left:12px;font-size:12px;color:var(--ink2);font-weight:600;background:var(--surface)}.clima tr:last-child th,.clima tr:last-child td{border-bottom:0}' +
  '.dem{display:inline-block;width:11px;height:11px;border-radius:50%;vertical-align:middle}.dem-alta{background:#E54848}.dem-media{background:#F6B21B}.dem-baja{background:#2FB66F}' +
  '.ley{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 0;font-size:12.5px;color:var(--ink2)}.ley span{display:inline-flex;align-items:center;gap:6px}' +
  '.meses{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px;margin:28px 0 0}.meses+.ley{margin:12px 0 0}.meses+.ley+.nota{margin:20px 0 0;line-height:1.6}' +
  '.mes{border-radius:10px;padding:8px 2px;text-align:center;font-size:12.5px;line-height:1.25;border:1px solid transparent}.mes b{display:block;font-size:13px}' +
  '.mes-baja{background:rgba(47,182,111,.16);border-color:rgba(47,182,111,.4)}.mes-media{background:rgba(246,178,27,.16);border-color:rgba(246,178,27,.45)}.mes-alta{background:rgba(229,72,72,.14);border-color:rgba(229,72,72,.4)}' +
  '.mes-baja b{color:#2FB66F}.mes-media b{color:#D99A00}.mes-alta b{color:#E54848}' +
  '@media(max-width:560px){.meses{grid-template-columns:repeat(6,minmax(0,1fr))}}' +
  '.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:10px 0}' +
  '.tab{flex:0 0 auto;min-height:40px;padding:0 16px;border:1.5px solid var(--line);border-radius:99px;background:var(--surface);color:var(--ink);font:700 14px Poppins,system-ui,sans-serif;cursor:pointer}' +
  '.tab small{font-weight:600;color:var(--ink2);margin-left:5px;font-size:12px}.tab[aria-selected=true]{background:#F7C325;border-color:#F7C325;color:#0A101A}.tab[aria-selected=true] small{color:#0A101A}' +
  '.tab:focus-visible{outline:3px solid #F7C325;outline-offset:2px}html.js .tp[hidden]{display:none}.tp>h2:first-child{margin-top:16px}' +
  '.pc-f{position:relative}.num{position:absolute;top:10px;left:10px;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#0F1B2D;color:#fff;font-size:12.5px;font-weight:800;border:1.5px solid rgba(255,255,255,.7)}' +
  '.num-in{position:static;display:inline-grid;margin-right:8px;vertical-align:middle}' +
  '.llegar{display:inline-flex;align-items:center;gap:7px;margin-top:12px;min-height:38px;padding:0 14px;border-radius:99px;background:rgba(255,255,255,.07);color:#F7C325;font-size:13.5px;font-weight:800;text-decoration:none}:root[data-theme="light"] .llegar{background:rgba(10,16,26,.06);color:#9A6B00}' +
  '.mapa{grid-column:1/-1;min-height:380px;padding:0;background:#1E2A3A}.mapa .leaflet-container{background:#1E2A3A}' +
  '.pin{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#0F1B2D;color:#fff;font:800 12px Poppins,system-ui,sans-serif;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)}' +
  '.hero2{position:relative;border-radius:24px;overflow:hidden;min-height:380px;display:flex;align-items:flex-end;background:#0B1F3A center/cover no-repeat}' +
  '.hero2:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,16,26,.5) 0,rgba(10,16,26,.1) 30%,rgba(10,16,26,.88) 100%)}' +
  '.hero2-t{position:relative;width:100%;padding:70px 22px 24px;color:#fff}' +
  '.eye{display:inline-block;margin-bottom:12px;padding:6px 12px;border-radius:99px;background:rgba(10,16,26,.6);font-size:13px;font-weight:700}' +
  '.hero2-t h1{margin:0;font-size:clamp(30px,6vw,44px);font-weight:800;line-height:1.1;text-shadow:0 2px 10px rgba(0,0,0,.5)}.hero2-t h1 span{color:#F7C325}' +
  '.hero2-p{margin:12px 0 0;max-width:580px;font-size:16px;font-weight:600;line-height:1.45;text-shadow:0 1px 6px rgba(0,0,0,.5)}' +
  '.val{margin:10px 0 0;font-size:13.5px;font-weight:700;color:rgba(255,255,255,.92)}.val:before{content:"✓";color:#F7C325;margin-right:8px}' +
  '.accion{display:flex;flex-wrap:wrap;align-items:center;gap:14px 26px;margin-top:20px}' +
  '.precio{color:#fff;font-size:13.5px;font-weight:700;line-height:1.3}.precio b{display:block;font-size:30px;font-weight:800;color:#F7C325;line-height:1.1}.precio:empty{display:none}' +
  '.cta-h{display:inline-flex;align-items:center;min-height:52px;padding:0 24px;border-radius:14px;background:#F7C325;color:#0A101A;font-size:16px;font-weight:800;text-decoration:none}' +
  '.franja{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:16px;border:1px solid var(--line);border-radius:18px;background:var(--surface);overflow:hidden}' +
  '.franja>div{padding:16px 18px;border-top:1px solid var(--line);margin-top:-1px}.franja>div+div{border-left:1px solid var(--line)}' +
  '@media(max-width:700px){.franja>div+div{border-left:0}}' +
  '.dl{display:block;margin-bottom:6px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink2)}' +
  '.dr{display:block;font-size:15px;font-weight:700;line-height:1.4}.dr+.dr{margin-top:5px}.dr small{display:block;font-size:13px;font-weight:600;color:var(--ink2)}' +
  '.dn{display:block;margin-top:6px;font-size:12.5px;color:var(--ink2);line-height:1.45}.franja>div[hidden]{display:none}' +
  '.lead{margin:18px 0 0;font-size:16px;font-weight:600;line-height:1.55}' +
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
  '.tc{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column}' +
  '.tc img,.tc .ph{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#1E2A3A}.tc .pc-b{display:flex;flex-direction:column;flex:1}' +
  '.tc .go{margin-top:auto;padding-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px}' +
  '.btn-s{display:inline-flex;align-items:center;min-height:44px;background:#F7C325;color:#0A101A;font-weight:700;font-size:13px;text-decoration:none;padding:0 14px;border-radius:10px;white-space:nowrap}' +
  '.ph{display:flex;align-items:center;justify-content:center;font-size:34px}' +
  '.p2{margin:4px 0 6px;color:var(--ink2);font-size:13.5px}.lk{display:inline-block;padding:10px 0;font-size:13px;font-weight:700;color:var(--texto-acento);text-decoration:none}' +
  '.cta2{margin:40px 0 10px;text-align:center}.cta2 h2{margin:0 0 6px;font-size:22px}.cta2 p{margin:0 auto 16px;max-width:520px;color:var(--ink2)}.cta2 .btn{display:inline-block;max-width:100%;white-space:normal;padding:14px 28px;font-size:16px}' +
  '.cta2 small{display:block;margin-bottom:6px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--texto-acento)}' +
  '.visit{display:flex;flex-wrap:wrap;justify-content:center;gap:0 .32em;margin:0 auto 14px;font-weight:800;font-size:clamp(30px,7vw,52px);line-height:1.1;letter-spacing:-.01em}.visit .p{white-space:nowrap}.visit i{display:inline-block;font-style:normal;color:#F7C325;opacity:0;transform:translateY(.4em);animation:vl-in .5s cubic-bezier(.2,.8,.2,1) forwards,vl-ola 2.6s ease-in-out infinite;animation-delay:calc(var(--i)*55ms),calc(900ms + var(--i)*90ms)}.visit .v i{color:var(--ink)}@keyframes vl-in{to{opacity:1;transform:none}}@keyframes vl-ola{0%,100%{transform:none}50%{transform:translateY(-.12em)}}@media (prefers-reduced-motion:reduce){.visit i{animation:none;opacity:1;transform:none}}' +
  '.esc{display:block;width:100%;max-width:340px;height:auto;margin:0 auto 6px;overflow:hidden}.esc-sol{fill:#F7C325;animation:esc-sol 4s ease-in-out infinite;transform-origin:250px 34px}.esc-tronco{fill:none;stroke:#A06A3A;stroke-width:5;stroke-linecap:round}.esc-hojas path{fill:#2FB66F}.esc-palma{animation:esc-palma 3.5s ease-in-out infinite}.esc-ola path{fill:#2E8BC0}.esc-ola2 path{fill:#5AB7E6;opacity:.85}.esc-ola1{animation:esc-ola 5s linear infinite}.esc-ola2{animation:esc-ola 3.6s linear infinite reverse}.esc-ed{fill:#22324A;stroke:#33476A}.esc-ve{fill:#F7C325;opacity:.2;animation:esc-ve 4s ease-in-out infinite;animation-delay:var(--d)}.esc-luna{fill:#F3E9C6}.esc-piso{fill:#33476A}.esc-mont{fill:#2B4A3A}.esc-pino path{fill:#2FB66F}.esc-pino{animation:esc-palma 4s ease-in-out infinite;animation-delay:var(--d)}.esc-nube ellipse{fill:#D3DCE8;opacity:.55}.esc-nube{animation:esc-nube 14s linear infinite}.esc-nube2{animation-duration:20s}@keyframes esc-sol{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes esc-palma{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}@keyframes esc-ola{from{transform:translateX(0)}to{transform:translateX(-40px)}}@keyframes esc-ve{0%,100%{opacity:.2}40%,60%{opacity:1}}@keyframes esc-nube{from{transform:translateX(-40px)}to{transform:translateX(60px)}}@media (prefers-reduced-motion:reduce){.esc *{animation:none!important}}' +
  '.ruta{display:block;width:100%;max-width:320px;height:auto;margin:0 auto 10px;overflow:visible}.ruta-l{fill:none;stroke:var(--line);stroke-width:2.5;stroke-dasharray:6 7;stroke-linecap:round}' +
  '.ruta-o{fill:var(--ink2)}.ruta-d{fill:#F7C325;animation:pulso 1.8s ease-in-out infinite}.ruta-a path{fill:#F7C325}' +
  '.ruta-a{offset-path:path("M20 70 Q160 -10 300 60");offset-rotate:auto;animation:vuelo 4.5s cubic-bezier(.45,0,.4,1) infinite}' +
  '@keyframes vuelo{0%{offset-distance:0%;opacity:0}8%{opacity:1}88%{opacity:1}100%{offset-distance:100%;opacity:0}}@keyframes pulso{0%,100%{r:6;opacity:1}50%{r:8.5;opacity:.65}}' +
  '@media (prefers-reduced-motion:reduce){.ruta-a,.ruta-d{animation:none}.ruta-a{offset-distance:55%}}' +
  '.otros{margin-top:30px}.otros-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.otros-h h2{margin:0 0 12px}.otros-h a{font-size:14px;font-weight:700;color:var(--texto-acento);text-decoration:none;white-space:nowrap}' +
  '.otros ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}' +
  '.otros li a{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-height:120px;padding:10px 12px;border-radius:14px;overflow:hidden;background:#1E2A3A center/cover no-repeat;color:#fff;text-decoration:none;border:1px solid var(--line)}' +
  '.otros li a:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,16,26,0) 30%,rgba(10,16,26,.88))}.otros li a>*{position:relative}' +
  '.otros li b{font-size:15px;line-height:1.2}.otros li small{font-size:12px;color:#D3DCE8}.otros li a:focus-visible{outline:3px solid #F7C325;outline-offset:2px}' +
  '.foot{margin:30px 0 0;font-size:12px;color:var(--ink2)}.foot a{color:var(--texto-acento)}' +
  'html.cs-consent .bar{bottom:var(--csh,0px)}' +
  '@media(max-width:560px){.otros ul{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:900px){.top,.wrap,.bar-i{max-width:960px}}';

/* Fotos de portada de la app (public/fotos/<clave>.jpg): la pagina publica usa la misma que la guia de la app. */
const FOTOS_PORTADA = new Set((function () {
  try { return require('fs').readdirSync(require('path').join(__dirname, '..', 'public', 'fotos')).filter(function (f) { return /\.jpg$/.test(f); }).map(function (f) { return f.slice(0, -4); }); } catch (e) { return []; }
})());

/* Escena animada del cierre segun el tipo de destino. */
function escenaSvg(tipo) {
  var s = '<svg class="esc" viewBox="0 0 320 110" aria-hidden="true">';
  if (tipo === 'city') {
    var ed = [[18, 48, 26], [48, 30, 22], [74, 58, 30], [108, 20, 24], [136, 40, 34], [174, 12, 26], [204, 44, 22], [230, 26, 30], [264, 50, 24], [292, 36, 22]], v = '', n = 0;
    ed.forEach(function (b) {
      s += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (104 - b[1]) + '" rx="2" class="esc-ed"/>';
      for (var y = b[1] + 8; y < 96; y += 12) for (var x = b[0] + 5; x < b[0] + b[2] - 6; x += 9) {
        n++; if (n % 3 === 0) v += '<rect x="' + x + '" y="' + y + '" width="4" height="5" class="esc-ve" style="--d:' + ((n * 0.37) % 4).toFixed(2) + 's"/>';
      }
    });
    return s + '<circle cx="290" cy="16" r="9" class="esc-luna"/>' + v + '<rect x="0" y="103" width="320" height="2" class="esc-piso"/></svg>';
  }
  if (tipo === 'nature') {
    s += '<g class="esc-nube"><ellipse cx="60" cy="20" rx="20" ry="7"/><ellipse cx="74" cy="16" rx="13" ry="8"/></g>';
    s += '<g class="esc-nube esc-nube2"><ellipse cx="220" cy="26" rx="18" ry="6"/><ellipse cx="232" cy="22" rx="11" ry="7"/></g>';
    s += '<path d="M0 104 L70 38 L120 80 L170 30 L240 90 L280 56 L320 86 L320 104Z" class="esc-mont"/>';
    [[40, 70], [62, 78], [150, 74], [196, 80], [262, 72], [290, 82]].forEach(function (p, i) {
      s += '<g class="esc-pino" style="--d:' + (i * 0.4) + 's;transform-origin:' + p[0] + 'px 104px"><path d="M' + p[0] + ' ' + p[1] + ' l-9 ' + (104 - p[1] - 4) + ' h18z"/></g>';
    });
    return s + '</svg>';
  }
  s += '<circle cx="250" cy="34" r="16" class="esc-sol"/>';
  s += '<g class="esc-palma" style="transform-origin:62px 100px"><path d="M62 100 C60 80 58 62 64 44" class="esc-tronco"/>' +
    '<g class="esc-hojas"><path d="M64 44 C50 34 36 38 28 46 C40 40 52 42 64 46Z"/><path d="M64 44 C76 32 92 34 100 42 C88 38 76 40 64 46Z"/>' +
    '<path d="M64 44 C58 28 46 22 36 24 C48 28 56 34 64 46Z"/><path d="M64 44 C72 28 84 24 94 26 C82 30 72 36 64 46Z"/></g></g>';
  s += '<g class="esc-ola esc-ola1"><path d="M-40 92 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V110 H-40Z"/></g>';
  s += '<g class="esc-ola esc-ola2"><path d="M-40 98 q20 -7 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V110 H-40Z"/></g>';
  return s + '</svg>';
}

/* "Visitá <destino>" con las letras animadas (entran de a una y despues ondulan). Lo lee un lector de pantalla como
   texto corrido gracias al aria-label; las letras sueltas quedan ocultas. */
function cartel(nombre) {
  let i = 0;
  const palabra = function (w, cls) { return '<span class="p ' + cls + '">' + Array.from(w).map(function (c) { return '<i style="--i:' + (i++) + '">' + esc(c) + '</i>'; }).join('') + '</span>'; };
  return '<div class="visit" role="img" aria-label="Visitá ' + esc(nombre) + '">' + palabra('Visitá', 'v') + String(nombre).split(' ').map(function (w) { return palabra(w, 'n'); }).join('') + '</div>';
}

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
  // Antes era el resumen cortado a 155 caracteres, a mitad de frase.
  const nLugares = (tienePlayas ? g.beaches : (g.atracciones || [])).length;
  const desc = 'Qué hacer en ' + nombre + ': ' + (nLugares ? nLugares + (tienePlayas ? ' playas' : ' lugares para ver') + ', ' : '') +
    'dónde comer, cuándo ir y cuánto cuesta viajar desde Uruguay con vuelo, hotel y traslados.';
  // Sin playas (Sao Paulo, Gramado, Canela, Porto Alegre) las tarjetas son las
  // atracciones con foto, y el acordeon 'Que ver' no se repite.
  const playas = tienePlayas ? g.beaches : (g.atracciones || []);
  const atracciones = tienePlayas ? (g.atracciones || []) : [];
  const comer = g.comer || [];
  const hacer = g.hacer || [];
  const tips = g.tips || [];
  const t = g.temporada;
  const portada = miniatura((playas.find(function (b) { return b.foto; }) || {}).foto || '', 960);
  const precio = function (n) { return typeof n !== 'number' ? '' : n ? 'USD ' + n : 'Gratis'; };
  const chip = function (txt) { return txt ? '<span class="chip">' + esc(txt) + '</span>' : ''; };

  const conLugar = function (b) { return typeof b.lat === 'number' && typeof b.lng === 'number'; };
  let nPin = 0;
  const pines = [];
  const tarjetas = playas.map(function (b) {
    const n = conLugar(b) ? ++nPin : 0;
    if (n) pines.push([b.lat, b.lng, b.name]);
    return '<article class="pc">' +
      (b.foto ? '<div class="pc-f"><img src="' + esc(miniatura(b.foto, 500)) + '" alt="' + esc(b.name + ', ' + nombre) + '" loading="lazy" decoding="async" width="320" height="240">' + (n ? '<span class="num">' + n + '</span>' : '') + '</div>' : '') +
      '<div class="pc-b"><h3>' + (!b.foto && n ? '<span class="num num-in">' + n + '</span>' : '') + esc(b.name) + '</h3><p class="zona">' + esc(b.zona) + '</p>' +
      '<p class="vibe">' + esc(b.vibe || b.nota) + '</p>' +
      (b.cuando ? '<p class="cuando"><b>Cuándo:</b> ' + esc(b.cuando) + '</p>' : '') +
      (n ? '<a class="llegar" href="https://www.google.com/maps/search/?api=1&amp;query=' + b.lat + ',' + b.lng + '" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>Cómo llegar</a>' : '') +
      '</div></article>';
  }).join('');
  // El mapa va como primera celda de la grilla; los pines se dibujan con Leaflet (el mismo de la app) al cargar.
  const mapaHtml = pines.length ? '<div class="pc mapa" id="mapa" role="img" aria-label="Mapa con los lugares de esta lista" data-pines="' + esc(JSON.stringify(pines)) + '"></div>' : '';

  const fila = function (x, meta) {
    return '<li><div class="r1"><b>' + esc(x.name) + '</b><span class="pr">' + esc(meta.precio) + '</span></div>' +
      '<div class="r2">' + chip(meta.a) + chip(meta.b) + '</div><p>' + esc(x.nota) + '</p></li>';
  };
  const acordeon = function (icono, titulo, n, contenido) {
    return n ? '<details class="ac"><summary><span>' + icono + ' ' + esc(titulo) + '</span><i>' + n + '</i></summary>' + contenido + '</details>' : '';
  };

  const verHtml = '<ul class="lst">' + atracciones.map(function (x) { return fila(x, { precio: precio(x.usd), a: x.zona, b: x.dur }); }).join('') + '</ul>';
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
      '<a class="btn-s" href="' + app + '">Ver en la app →</a></div></div></article>';
  }).join('') + '</div>' : '';
  const cl = g.clima;
  const climaHtml = cl ? '<h2>🌡️ ' + esc(cl.titulo) + '</h2>' + (cl.intro ? '<p class="nota">' + esc(cl.intro) + '</p>' : '') +
    '<div class="clima"><table><thead><tr><th></th>' + cl.meses.map(function (x) { return '<th scope="col">' + esc(x.m) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    [['Máx.', function (x) { return x.max + '°'; }], ['Agua del mar', function (x) { return Math.round(x.mar) + '°'; }], ['Lluvia (mm)', function (x) { return x.lluvia; }],
      ['Gente', function (x) { return '<span class="dem dem-' + esc(x.demanda) + '"></span>'; }]].map(function (f) {
      return '<tr><th scope="row">' + f[0] + '</th>' + cl.meses.map(function (x) { return '<td>' + f[1](x) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>' +
    '<p class="ley"><span><i class="dem dem-baja"></i>Poca gente y mejores precios</span><span><i class="dem dem-media"></i>Media</span><span><i class="dem dem-alta"></i>Mucha gente y precios altos</span></p>' +
    (cl.nota ? '<p class="nota">' + esc(cl.nota) + '</p>' : '') + (cl.fuente ? '<p class="cuando">' + esc(cl.fuente) + '</p>' : '') : '';
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
  const migas = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'CuántoSale', item: 'https://cuantosale.uy/' },
      { '@type': 'ListItem', position: 2, name: 'Destinos', item: 'https://cuantosale.uy/guias' },
      { '@type': 'ListItem', position: 3, name: nombre, item: url }
    ]
  };
  /* Precio por mes: con tabla de clima sale de su demanda; si no, de la temporada (alta $$$, baja $, el resto $$). */
  const nivelMes = function (m) {
    if (cl) return (cl.meses[m - 1] || {}).demanda || 'media';
    return (t.alta || []).indexOf(m) >= 0 ? 'alta' : (t.baja || []).indexOf(m) >= 0 ? 'baja' : 'media';
  };
  const SIGNO = { baja: '$', media: '$$', alta: '$$$' };
  const MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const mesesHtml = (cl || t) ? '<div class="meses" aria-label="Precios por mes">' + MES3.map(function (n, i) {
    const nv = nivelMes(i + 1);
    return '<div class="mes mes-' + nv + '">' + n + '<b>' + SIGNO[nv] + '</b></div>';
  }).join('') + '</div><p class="ley"><span><i class="dem dem-baja"></i>Temporada baja (más barato)</span><span><i class="dem dem-media"></i>Media</span><span><i class="dem dem-alta"></i>Alta (más gente y más caro)</span></p>' : '';
  /* Pestanas como las de la guia en la app. Todo el contenido queda en el HTML (Google lo lee igual); el script solo
     muestra una por vez. Sin JavaScript se ven todas, una debajo de la otra. */
  const secs = ex ? ex.secciones : [];
  const info = (ex ? [Object.assign({ icono: '🧳' }, ex.antes)] : []).concat(secs);
  const panel = function (titulo, contenido) { return '<h2>' + esc(titulo) + '</h2>' + contenido; };
  const pestanas = [
    { id: 'playas', nom: tienePlayas ? 'Playas' : 'Qué ver', n: playas.length, html: panel((tienePlayas ? 'Playas de ' : 'Qué ver en ') + nombre, '<div class="carr">' + mapaHtml + tarjetas + '</div>') },
    { id: 'ver', nom: 'Qué ver', n: atracciones.length, html: imperdibles + (atracciones.length ? panel('Qué ver en ' + nombre, verHtml) : '') },
    { id: 'hacer', nom: 'Qué hacer', n: hacer.length, html: panel('Qué hacer en ' + nombre, hacerHtml) },
    { id: 'tours', nom: 'Tours', n: ts.length, html: toursHtml },
    { id: 'comer', nom: 'Dónde comer', n: comer.length, html: panel('Dónde comer en ' + nombre, comerHtml) },
    { id: 'tips', nom: 'Tips', n: tips.length, html: panel('Tips locales', tipsHtml) },
    { id: 'clima', nom: 'Clima', n: cl ? 12 : 0, html: climaHtml },
    { id: 'info', nom: 'Info útil', n: info.length, html: info.length ? panel('Todo lo que tenés que saber', info.map(seccion).join('') + faqHtml) : '' }
  ].filter(function (p) { return p.n > 0 && p.html; });
  const tabsHtml = '<div class="tabs" role="tablist" aria-label="Secciones de la guía">' + pestanas.map(function (p, i) {
    return '<button type="button" class="tab" role="tab" id="t-' + p.id + '" aria-controls="p-' + p.id + '" aria-selected="' + (i === 0) + '">' + esc(p.nom) + (p.id === 'clima' ? '' : '<small>' + p.n + '</small>') + '</button>';
  }).join('') + '</div>' + pestanas.map(function (p, i) {
    return '<section class="tp" role="tabpanel" id="p-' + p.id + '" aria-labelledby="t-' + p.id + '"' + (i ? ' hidden' : '') + '>' + p.html + '</section>';
  }).join('');
  const MAPA_JS = "(function(){var el=document.getElementById('mapa');if(!el)return;var pts=JSON.parse(el.getAttribute('data-pines')||'[]');" +
    "var css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/leaflet/leaflet.css?v=1';document.head.appendChild(css);" +
    "var sc=document.createElement('script');sc.src='/vendor/leaflet/leaflet.js?v=1';sc.onerror=function(){el.remove();};sc.onload=function(){var L=window.L;" +
    "var m=L.map(el,{scrollWheelZoom:false});window.csMapa=m;" +
    "L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a>'}).addTo(m);" +
    "var b=[];pts.forEach(function(p,i){b.push([p[0],p[1]]);L.marker([p[0],p[1]],{title:p[2],icon:L.divIcon({className:'',html:'<span class=\"pin\">'+(i+1)+'</span>',iconSize:[26,26],iconAnchor:[13,13]})}).bindPopup(p[2].replace(/</g,'&lt;')).addTo(m);});" +
    "if(b.length===1)m.setView(b[0],13);else m.fitBounds(L.latLngBounds(b),{padding:[26,26],maxZoom:13});};document.head.appendChild(sc);})();";
  const TABS_JS = "document.documentElement.classList.add('js');document.addEventListener('click',function(e){var b=e.target.closest('.tab');if(!b)return;" +
    "document.querySelectorAll('.tab').forEach(function(x){x.setAttribute('aria-selected',String(x===b))});" +
    "document.querySelectorAll('.tp').forEach(function(p){p.hidden=p.id!==b.getAttribute('aria-controls')});if(window.csMapa)setTimeout(function(){window.csMapa.invalidateSize();},0);" +
    "var t=document.querySelector('.tabs');if(t.getBoundingClientRect().top<=1)window.scrollTo({top:t.offsetTop-4,behavior:'smooth'});});";

  const fotoPortada = FOTOS_PORTADA.has(key) ? '/fotos/' + key + '.jpg' : (portada || '');
  const ESTIMADO_JS = "(function(){var K=" + JSON.stringify(key) + ";var iso=function(d){return d.toISOString().slice(0,10)};" +
    "var hoy=new Date();var dep=new Date(hoy.getTime()+45*864e5),ret=new Date(dep.getTime()+7*864e5);var item=K+'~'+iso(dep)+'~'+iso(ret)+'~economico';" +
    "var pedir=function(tr){return fetch('/api/destinos-destacados?'+new URLSearchParams({pax:'2',style:'ahorro',origin:'MVD',transport:tr,items:item})).then(function(r){return r.ok?r.json():{}}).then(function(j){var x=(j.items||[])[0];return x&&x.pp>0?x:null}).catch(function(){return null})};" +
    "var MEDIO={avion_mvd:'En avión desde Montevideo',avion_ba:'En avión vía Buenos Aires',auto:'En auto desde Montevideo',bus:'En bus desde Montevideo',ferry:'En ferry'};" +
    "var INC={avion_mvd:'Vuelo',avion_ba:'Vuelo',auto:'Nafta y peajes',bus:'Pasaje de bus',ferry:'Ferry'};" +
    "var tras=function(m){if(m!=='avion_mvd'&&m!=='avion_ba')return '';var t=(window.CS_TRANSFER_PRICES||{})[K];if(!t)return '';if(t.modo==='ferry')return '<small>Más el cruce en barco desde el continente</small>';if(!(t.km>30))return '';return '<small>Más unos '+Math.round(t.km)+' km por ruta desde el aeropuerto</small>'};" +
    "var esc=function(s){return String(s||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})};" +
    "Promise.all([pedir('all'),pedir('flight')]).then(function(r){var b=r[0],v=r[1];if(!b)return;" +
    "document.getElementById('precio').innerHTML='<b>Desde US$ '+Math.round(b.pp).toLocaleString('es-UY')+'</b>por persona, estimado';" +
    "var inc=[INC[b.mode]||'Transporte','alojamiento económico','comidas','transporte local'].concat(b.mode==='auto'?[]:['traslados']);" +
    "var fi=document.getElementById('f-incluye');fi.innerHTML='<span class=\"dl\">💲 Qué incluye el estimado</span><span class=\"dr\">'+inc.slice(0,-1).join(', ')+' y '+inc[inc.length-1]+'</span><span class=\"dn\">Para 2 personas y 7 noches, saliendo de Montevideo. El precio final depende de tus fechas.</span>';fi.hidden=false;" +
    "var filas=[],vis={};[b,v].forEach(function(x){if(!x||vis[x.mode]||!MEDIO[x.mode])return;vis[x.mode]=1;filas.push('<span class=\"dr\">'+MEDIO[x.mode]+(x.dur?'<small>'+esc(x.dur)+' (aprox.)</small>':'')+tras(x.mode)+'</span>')});" +
    "if(filas.length){var fl=document.getElementById('f-llegar');fl.innerHTML='<span class=\"dl\">✈️ Cómo llegar</span>'+filas.join('');fl.hidden=false;}});})();";

  // Enlaces a los otros destinos: cada pagina le pasa autoridad a las demas.
  /* Abajo, hasta 6 destinos con foto: primero los de la misma region, despues los mas elegidos. Antes era la lista
     entera de 39 nombres; los 40 siguen enlazados desde /guias y la home. */
  const POPULARES = ['rio', 'fln', 'buz', 'ilha', 'maragogi', 'bcm', 'ssa', 'porto'];
  const candidatos = Object.keys(POR_SLUG).map(function (s2) { return { s: s2, k: POR_SLUG[s2] }; }).filter(function (x) { return x.k !== key; });
  const rango = function (x) { return (model.DEST[x.k].region === dest.region ? 0 : 100) + (POPULARES.indexOf(x.k) < 0 ? 50 : POPULARES.indexOf(x.k)); };
  const otros = candidatos.sort(function (a, b) { return rango(a) - rango(b) || model.DEST[a.k].name.localeCompare(model.DEST[b.k].name, 'es'); }).slice(0, 6).map(function (x) {
    const d = model.DEST[x.k];
    return '<li><a href="/destino/' + x.s + '"' + (FOTOS_PORTADA.has(x.k) ? ' style="background-image:url(/fotos/' + x.k + '.jpg)"' : '') + '><b>' + esc(d.name) + '</b><small>' + esc(d.region) + '</small></a></li>';
  }).join('');

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
    '<link rel="preload" as="image" href="' + esc(fotoPortada) + '" fetchpriority="high">' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    '<script type="application/ld+json">' + JSON.stringify(migas).replace(/</g, '\\u003c') + '</script>' +
    faqLd +
    '<style>' + CSS + '</style></head><body>' +
    '<header class="top"><a class="logo" href="/" aria-label="CuántoSale, ir al inicio"><svg width="20" height="25" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 20 12 30 12 30s12-10 12-18.2C24 5.3 18.6 0 12 0z" fill="currentColor"/><circle cx="12" cy="11.5" r="4.6" fill="#F6B21B"/></svg>cuántosale</a>' +
    '<nav class="nav" aria-label="Principal"><a href="/guias">Destinos</a><a class="cta" href="' + app + '">Calcular viaje</a></nav></header><main class="wrap">' +
    '<section class="hero2" style="background-image:url(' + esc(fotoPortada) + ')"><div class="hero2-t">' +
    '<span class="eye">Guía de viaje · ' + esc(dest.region) + ', Brasil</span>' +
    '<h1>' + esc(nombre) + ': <span>descubrí cuánto cuesta viajar</span></h1>' +
    '<p class="hero2-p">Qué hacer, cómo llegar desde Uruguay y cuánto presupuestar para organizar tu viaje.</p>' +
    '<p class="val">Con el costo total desde Montevideo, no solo el pasaje.</p>' +
    '<div class="accion"><span class="precio" id="precio"></span><a class="cta-h" href="' + app + '">Calculá tu viaje →</a></div></div></section>' +
    '<div class="franja"><div id="f-incluye" hidden></div><div id="f-llegar" hidden></div>' +
    (t ? '<div><span class="dl">📅 Cuándo ir</span><span class="dr">Temporada alta<small>' + esc(listaMeses(t.alta)) + '</small></span>' +
      ((t.baja || []).length ? '<span class="dr">Temporada baja<small>' + esc(listaMeses(t.baja)) + '</small></span>' : '') + '</div>' : '') +
    '</div>' +
    '<p class="lead">' + esc(g.resumen) + '</p>' +
    mesesHtml +
    (t && t.nota && !cl ? '<p class="nota">' + esc(t.nota) + '</p>' : '') +
    tabsHtml +
    '<div class="cta2">' + escenaSvg(dest.group || 'beach') + cartel(nombre) +
    '<small>Tu próximo viaje</small><h2>¿Cuánto sale tu viaje a ' + esc(nombre) + '?</h2><p>Vuelo, hotel, traslados y tours en un solo presupuesto, según tus fechas y cuántos viajan.</p><a class="btn" href="' + app + '">Calcular mi viaje a ' + esc(nombre) + '</a></div>' +
    '<p class="foot">' + (ex ? esc(ex.fuentes) + ' ' : '') + 'Fotos: Wikimedia Commons. Precios de las actividades en dólares, aproximados. ' +
    '<a href="/">CuántoSale</a> calcula cuánto sale viajar a Brasil desde Uruguay.</p>' +
    '<nav class="otros" aria-label="Otros destinos"><div class="otros-h"><h2>Otros destinos</h2><a href="/guias">Ver todos los destinos →</a></div><ul>' + otros + '</ul></nav></main>' +
    '<script src="/transfer-precios.js"></script><script>' + TABS_JS + MAPA_JS + ESTIMADO_JS + '</script></body></html>';
}

module.exports = { pagina, slugs, slugDe, slugDeClave, enlacesHtml };
