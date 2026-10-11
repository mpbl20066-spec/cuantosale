#!/usr/bin/env node
/* Fotos de los tours desde Unsplash (API oficial, clave UNSPLASH_ACCESS_KEY en .env).
 *
 *   node scripts/fotos-unsplash.js            busca (con cache) y escribe data/tour-photos.json
 *   node scripts/fotos-unsplash.js --seco     busca y arma la revision, sin tocar tour-photos.json
 *
 * Que tours: los que no tienen foto de la agencia (`image` del catalogo). Los que si tienen
 * quedan con esa, que es la foto real del tour que mando el operador.
 *
 * Por que por destino y por actividad, y no una busqueda por tour: la clave gratis da 50
 * busquedas por hora. Con 36 destinos y unas 15 actividades entra en una o dos horas; las
 * respuestas quedan en data/_trabajo/unsplash-cache.json y la siguiente corrida sigue desde ahi.
 *
 * Como elige: 1) una foto del destino cuya descripcion nombra la actividad (buggy, barco...);
 * 2) una foto de la actividad en Brasil; 3) una foto del destino. Nunca repite una foto, y
 * descarta las de Unsplash+ (pagas).
 *
 * Licencia: Unsplash pide credito ("Foto de X en Unsplash") y usar la URL de sus servidores
 * (hotlink). Cada foto elegida se avisa a su download_location, como piden las guias de la API.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SECO = process.argv.includes('--seco');
const CACHE = path.join(RAIZ, 'data', '_trabajo', 'unsplash-cache.json');
const FOTOS = path.join(RAIZ, 'data', 'tour-photos.json');
const REVISION = path.join(RAIZ, 'outputs', 'fotos-unsplash.html');

function clave() {
  if (process.env.UNSPLASH_ACCESS_KEY) return process.env.UNSPLASH_ACCESS_KEY.trim();
  try {
    const m = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').match(/^UNSPLASH_ACCESS_KEY=(.+)$/m);
    return m ? m[1].trim() : '';
  } catch (e) { return ''; }
}
const KEY = clave();
if (!KEY) { console.error('Falta UNSPLASH_ACCESS_KEY en .env'); process.exit(1); }

const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'tours.json'), 'utf8'));
const fotos = JSON.parse(fs.readFileSync(FOTOS, 'utf8'));
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { /* primera vez */ }
const guardarCache = () => { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(cache)); };

/* Actividad del tour por palabras del titulo -> busqueda en ingles y palabras para reconocerla en la descripcion de la foto. */
const ACTIVIDADES = [
  ['buggy', /buggy|4x4|jeep|dunas de genipabu/i, 'dune buggy beach brazil', /buggy|dune|jeep|off.?road|4x4/i],
  ['cuatri', /cuatriciclo|quad/i, 'atv quad bike beach', /atv|quad/i],
  ['sandboard', /sandboard/i, 'sandboarding dunes', /sand ?board|dune/i],
  ['ballenas', /ballena/i, 'whale watching brazil', /whale/i],
  ['delfines', /delf[ií]n/i, 'dolphins ocean brazil', /dolphin/i],
  ['buceo', /buceo|snorkel|bautismo/i, 'snorkeling tropical brazil', /snorkel|diving|diver|underwater|reef|fish/i],
  ['surf', /surf/i, 'surf lesson beach brazil', /surf/i],
  ['paddle', /paddle|kayak/i, 'stand up paddle lagoon', /paddle|kayak|sup\b/i],
  ['tirolesa', /tirolesa|zipline/i, 'zipline tropical forest', /zip ?line/i],
  ['piscinas', /piscinas? naturales|jangada|recife de fora|galés/i, 'natural pools reef brazil', /pool|reef|turquoise|clear water/i],
  ['barco', /barco|escuna|lancha|catamar[aá]n|goleta|volta à ilha|ilha tour|isla|ilha do|gruta/i, 'boat tour tropical bay brazil', /boat|ship|sail|catamaran|yacht|schooner/i],
  ['trilha', /trilha|caminata|sendero|trekking/i, 'hiking trail coast brazil', /hik|trail|path|walk/i],
  ['vino', /vinhedo|vino|bodega/i, 'vineyard rio grande do sul', /vineyard|wine|grape/i],
  ['cachaca', /cachaça|alambique|destiler/i, 'cachaca distillery', /cacha|distill|barrel/i],
  ['parque', /beto carrero|beach park|parque|snowland|mini mundo|alpen park|unipraias|atracciones/i, '', /park|ride|coaster|cable car/i]
];
const actividadDe = (t) => ACTIVIDADES.filter((a) => a[1].test(t.titulo))[0] || null;
const lugarDe = (t) => String(t.destino || '').split(',')[0].trim();

const activos = (datos.tours || datos).filter((t) => t && t.activo !== false && t.titulo && Array.isArray(t.destinos) && t.destinos.length);
/* Primero los destinos mas buscados: si se corta por el limite de la hora, los populares ya quedan hechos. */
const POPULARES = ['fln', 'rio', 'buz', 'bcm', 'bombinhas', 'itapema', 'picarras', 'garopaba', 'rosa', 'ferrugem', 'ssa', 'porto', 'mcz', 'maragogi', 'nat', 'pip',
  'for', 'jericoacoara', 'rec', 'morro', 'forte', 'portoseguro', 'ajuda', 'trancoso', 'cabo', 'arraial', 'paraty', 'ilha', 'angra', 'fernando', 'gram', 'canela', 'poa', 'sao'];
const prioridad = (t) => { const i = POPULARES.indexOf(t.destinos[0]); return i < 0 ? 99 : i; };
const objetivo = activos.filter((t) => !(t.image && String(t.image).trim())).sort((a, b) => prioridad(a) - prioridad(b));

async function buscar(q) {
  if (cache[q]) return cache[q];
  const url = 'https://api.unsplash.com/search/photos?' + new URLSearchParams({ query: q, per_page: '30', orientation: 'landscape', content_filter: 'high' });
  const r = await fetch(url, { headers: { Authorization: 'Client-ID ' + KEY, 'Accept-Version': 'v1' } });
  const quedan = Number(r.headers.get('x-ratelimit-remaining'));
  if (r.status === 403 || r.status === 429) { const e = new Error('limite'); e.limite = true; throw e; }
  if (!r.ok) throw new Error('Unsplash ' + r.status + ' en "' + q + '"');
  const j = await r.json();
  cache[q] = (j.results || []).filter((p) => !p.premium && !p.plus).map((p) => ({
    id: p.id, w: p.width, h: p.height, txt: [p.alt_description, p.description].filter(Boolean).join(' · '),
    url: p.urls && p.urls.regular, thumb: p.urls && p.urls.small, autor: p.user && p.user.name, perfil: p.user && p.user.links && p.user.links.html,
    pagina: p.links && p.links.html, download: p.links && p.links.download_location
  }));
  guardarCache();
  if (quedan <= 1) { const e = new Error('limite'); e.limite = true; throw e; }
  return cache[q];
}

/* Variantes de cada busqueda, de la mas especifica a la mas simple: se usa la primera que trae 5 fotos o mas. */
const sinAcentos = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
const variantesDestino = (t) => { const n = lugarDe(t), s = sinAcentos(n); return [n + ' Brazil', s, s.replace(/^Praia d[oa] /, '') + ' beach']; };
const SIMPLES = { 'dolphins ocean brazil': ['dolphins'], 'boat tour tropical bay brazil': ['boat tour', 'schooner boat'], 'cachaca distillery': ['distillery barrels'],
  'stand up paddle lagoon': ['paddle board'], 'vineyard rio grande do sul': ['vineyard'], 'whale watching brazil': ['whale watching'], 'natural pools reef brazil': ['natural pool reef'] };
const variantesActividad = (q) => [q].concat(SIMPLES[q] || []);
async function resolver(variantes) {
  let mejor = [];
  for (const v of variantes) { const l = await buscar(v); if (l.length >= 5) return l; if (l.length > mejor.length) mejor = l; }
  return mejor;
}

/* Busqueda propia de cada tour (data/unsplash-busquedas.json) y, si hace falta, la foto elegida a mano entre las
   candidatas (data/unsplash-eleccion.json: { "destino#titulo": "<id de la foto>" }, o null para dejarlo sin foto). */
const BUSQ = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'unsplash-busquedas.json'), 'utf8'));
let ELECCION = {}; try { ELECCION = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'unsplash-eleccion.json'), 'utf8')); } catch (e) { /* sin elecciones a mano */ }
const claveDe = (t) => t.destinos[0] + '#' + t.titulo.trim();

(async function () {
  /* 1) Una busqueda por tour (con su alternativa si trae menos de 3 fotos). */
  const pool = {};
  try {
    for (const t of objetivo) {
      const k = claveDe(t), qs = BUSQ[k] || variantesDestino(t);
      let mejor = [];
      for (const q of qs) { const l = await buscar(q); if (l.length > mejor.length) mejor = l; if (l.length >= 3) { mejor = l; break; } }
      pool[k] = mejor; process.stdout.write('.');
    }
  } catch (e) {
    if (!e.limite) throw e;
    console.log('\nSe llego al limite de la hora de Unsplash: corre de nuevo en una hora (lo ya buscado queda en cache).');
    process.exit(2);
  }
  console.log('\nbusquedas listas');

  /* 2) Eleccion: la elegida a mano, o la primera candidata que no use otro tour. */
  const usadas = new Set(Object.values(ELECCION).filter(Boolean));
  const elegidas = [];
  objetivo.forEach((t) => {
    const k = claveDe(t), cands = pool[k] || [];
    if (ELECCION[k] === null) return;
    let p = ELECCION[k] ? cands.filter((x) => x.id === ELECCION[k])[0] : null;
    if (!p) p = cands.filter((x) => !usadas.has(x.id) && x.url)[0] || null;
    if (!p) return console.log('sin foto: ' + k);
    usadas.add(p.id);
    elegidas.push({ clave: k, t: t, p: p, cands: cands.slice(0, 8) });
  });

  /* 3) Revision: la elegida grande y las otras candidatas chicas, con su id para elegir a mano. */
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  fs.mkdirSync(path.dirname(REVISION), { recursive: true });
  fs.writeFileSync(REVISION, '<!doctype html><meta charset="utf-8"><title>Fotos Unsplash de tours</title><style>body{font-family:system-ui;margin:16px;background:#f6f7f9}section{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}article{background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px #0002}article>img{width:100%;height:170px;object-fit:cover;display:block}p{margin:0;padding:8px 10px;font-size:12px;line-height:1.35}b{display:block;font-size:13px}.c{display:flex;gap:4px;padding:0 10px 10px;flex-wrap:wrap}.c img{width:52px;height:38px;object-fit:cover;border-radius:4px}</style>' +
    '<h1>' + elegidas.length + ' tours con foto de Unsplash</h1><section>' + elegidas.map((e) =>
      '<article><img src="' + esc(e.p.thumb) + '" loading="lazy"><p><b>' + esc(e.t.titulo) + '</b>' + esc(lugarDe(e.t)) + ' · ' + esc(e.p.txt) + '<br>Foto: ' + esc(e.p.autor) + ' · id ' + esc(e.p.id) + '</p><div class="c">' +
      e.cands.filter((c) => c.id !== e.p.id).map((c) => '<img src="' + esc(c.thumb) + '" title="' + esc(c.id + ' · ' + c.txt) + '" loading="lazy">').join('') + '</div></article>').join('') + '</section>');
  console.log(elegidas.length + ' fotos elegidas · revision en outputs/fotos-unsplash.html');
  if (SECO) return;

  elegidas.forEach((e) => {
    fotos[e.clave] = { url: e.p.url, autor: e.p.autor + ' en Unsplash', licencia: 'Licencia Unsplash', fuente: 'unsplash', id: e.p.id, perfil: e.p.perfil, pagina: e.p.pagina, download: e.p.download };
  });
  fs.writeFileSync(FOTOS, JSON.stringify(fotos, null, 1));
  console.log('data/tour-photos.json actualizado');
})().catch((e) => { console.error(e.message); process.exit(1); });
