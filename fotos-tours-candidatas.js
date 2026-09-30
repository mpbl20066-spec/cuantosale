'use strict';
/*
 * Candidatas de foto para los tours sin foto, por CATEGORIA de Commons.
 *
 * POR QUE CATEGORIA Y NO BUSQUEDA POR TEXTO. La busqueda por texto es la que
 * metio la foto de Lisboa en el tour de buggy de Buzios: "Rua das Pedras" existe
 * en los dos lados del Atlantico. Una categoria de Commons ("Category:Paraty")
 * no tiene ese problema: si el archivo esta ahi, es de ese pueblo. El texto se
 * usa solo para ENCONTRAR la categoria, y se confirmo que exista antes de listar.
 *
 * SE VERIFICA IGUAL. Con los GPS de los archivos de la categoria se calcula el
 * centro mediano del pueblo y se descarta lo que cae fuera del radio. Asi se
 * atrapa el caso de los dos Buzios: la categoria puede traer fotos de la playa
 * de Rio Grande do Norte si alguien la metio mal, y a 1.993 km se nota.
 *
 * No escribe nada en el repo: imprime candidatas para que alguien las mire. Una
 * foto de tour muestra el LUGAR, y eso se decide a ojo.
 *
 *   node fotos-tours-candidatas.js arraial paraty angra
 */
const fs = require('fs');
const path = require('path');

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'cuantosale-tour-photos/1.0 (candidatas de foto para tours)' };

// Categorias candidatas por destino, de la mas especifica a la mas generica.
const CATEGORIAS = {
  arraial: ['Arraial do Cabo', 'Prainhas (Arraial do Cabo)'],
  cabo: ['Cabo Frio', 'Praia do Forte (Cabo Frio)'],
  paraty: ['Paraty', 'Paraty (Rio de Janeiro)'],
  angra: ['Angra dos Reis', 'Ilhas Paradisíacas'],
  ilhabela: ['Ilhabela', 'Castelhanos'],
  ubatuba: ['Ubatuba', 'Ilha Anchieta'],
  ilha: ['Ilha Grande, Rio de Janeiro', 'Lopes Mendes'],
  trancoso: ['Trancoso, Bahia', 'Trancoso'],
  gram: ['Gramado', 'Vale dos Vinhedos'],
  canela: ['Canela, Rio Grande do Sul', 'Cascata do Caracol'],
  maragogi: ['Maragogi', 'Piscinas Naturais de Maragogi'],
  jericoacoara: ['Jericoacoara', 'Duna do Jericoacoara'],
  morro: ['Morro de Sao Paulo', 'Morro de São Paulo'],
  fernando: ['Fernando de Noronha', 'Baia do Sancho (Fernando de Noronha)'],
  nat: ['Natal, Rio Grande do Norte', 'Genipabu'],
  pip: ['Pipa, Rio Grande do Norte', 'Praia de Pipa'],
  for: ['Fortaleza', 'Cumbuco'],
  mcz: ['Maceio', 'Palmeira dos Indies (Maceio)'],
  bho: ['Belo Horizonte', 'Pampulha'],
  sao: ['São Paulo', 'Paulista'],
  curitiba: ['Curitiba'],
  poa: ['Porto Alegre'],
  ssa: ['Salvador', 'Pelourinho'],
  rec: ['Recife'],
  bombinhas: ['Bombinhas', 'Costa Esmeralda'],
  rosa: ['Praia do Rosa', 'Praia Grande (Rosa, Santa Catarina)']
};

const MIN_W = 1400;
const RAIZ = __dirname;
/* El radio no es el mismo para todos. Hay destinos a menos de 25 km uno del
   otro (Buzios y Cabo Frio a 14, Camboriu y Balneario Camboriu a 4.5, Gramado
   y Canela a 6.4): con un radio de 30 km el filtro de uno acepta las fotos del
   otro y no sirve para nada. Para esos pares el radio baja a 12 km, que es lo
   que separa el pueblo del vecino. El avisa de los pares esta en
   data/destinos-geo.json, y sale de ahi, no de una constante inventada. */
const RADIO_NORMAL = 30;
const RADIO_PAR_CERCANO = 12;
const VECINOS = { buz: 'cabo', cabo: 'buz', ilha: 'angra', angra: 'ilha', trancoso: 'portoseguro',
  portoseguro: 'trancoso', bcm: 'itapema', itapema: 'bcm',
  bombinhas: 'bcm', bcm: 'bombinhas', bombinhas: 'itapema', itapema: 'bombinhas',
  rosa: 'garopaba', garopaba: 'rosa', rosa: 'ferrugem', ferrugem: 'rosa', garopaba: 'ferrugem',
  ferrugem: 'garopaba', gram: 'canela', canela: 'gram' };
const geo = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'destinos-geo.json'), 'utf8')).destinos; }
  catch (e) { console.error('falta data/destinos-geo.json. Corré: node scripts/generar-geo-destinos.js'); process.exit(1); }
})();
const radioDe = (dest) => (VECINOS[dest] ? RADIO_PAR_CERCANO : RADIO_NORMAL);

/* Fotos de archivo: pinturas, grabados yibrated del siglo XIX, y material del
   Instituto Moreira Salles. Aparecen mucho en categorias brasileras y no sirven
   para una card de viaje: no muestran el lugar como se ve hoy. Se marcan para
   que la revision las descarte de un vistazo, no para filtrarlas solas. */
const DE_ARCHIVO = /\b(\d{4})\b.*(Castagneto|Rugendas|Hetel|DL-VP|DL-UNL|FRNB|Wellcome)|\b(18|19)\d\d\b|pintura|painting|engraving|desenho antigo/i;
const meta = (i, c) => (i.extmetadata && i.extmetadata[c] ? String(i.extmetadata[c].value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function mediana(xs) { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function licencia(lic) {
  const l = String(lic || '');
  if (!l) return { ok: false, motivo: 'sin licencia' };
  if (/by[\s-]*sa[\s-]*2\.0\s+br\b|by[\s-]*nc/i.test(l)) return { ok: false, motivo: 'licencia restringida: ' + l };
  if (!/cc[\s-]*by|public domain|dominio p/i.test(l)) return { ok: false, motivo: 'no es libre: ' + l };
  return { ok: true };
}

/* Commons devuelve 429 si se le pegan muchas consultas seguidas, y un 429 con
   este manejo de errores se ve igual que "la categoria no existe": el mensaje
   dice que no hay categoria cuando en realidad no se pudo preguntar. Con 29
   destinos seguidos pasa siempre. Por eso: se espera entre consultas, se
   reintenta un 429, y si la consulta falla se DICE que fallo, en vez de
   informar que no hay nada. Informar "no hay" cuando no se pudo mirar es la
   forma rapida de dejar un destino sin foto sin que nadie se entere. */
const espera = (ms) => new Promise(r => setTimeout(r, ms));
let ultimo429 = 0;

async function api(params, intentos) {
  intentos = intentos === undefined ? 3 : intentos;
  const u = API + '?action=query&format=json&formatversion=2&' + params;
  for (let n = 0; n < intentos; n++) {
    if (Date.now() - ultimo429 < 2500) await espera(2500 - (Date.now() - ultimo429));
    let r;
    try { r = await fetch(u, { headers: UA }); }
    catch (e) { r = { ok: false, status: 'red' }; }
    if (r.ok) return await r.json();
    if (r.status === 429 || r.status === 503) { ultimo429 = Date.now(); await espera(4000 * (n + 1)); continue; }
    return { _error: 'HTTP ' + r.status };
  }
  return { _error: '429/503 después de ' + intentos + ' intentos' };
}

async function infoDe(titulos) {
  const out = new Map();
  for (let i = 0; i < titulos.length; i += 40) {
    const lote = titulos.slice(i, i + 40);
    const j = await api('prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280&titles=' +
      encodeURIComponent(lote.map(t => 'File:' + t).join('|')));
    if (!j || !j.query) continue;
    for (const p of j.query.pages) {
      if (p.imageinfo && p.imageinfo[0]) out.set(p.title.replace(/^File:/, ''), p.imageinfo[0]);
    }
  }
  return out;
}

(async function main() {
  const pedidos = process.argv.slice(2).filter(a => CATEGORIAS[a]);
  if (!pedidos.length) { console.log('Uso: node ' + path.basename(__filename) + ' ' + Object.keys(CATEGORIAS).join(' ')); return; }

  // Los tours sin foto, para poder proponer por titulo.
  const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
  const ini = app.indexOf('var TOUR_PHOTOS = {');
  const conFoto = new Set([...app.slice(ini, app.indexOf('};', ini)).matchAll(/'([a-z]+#[^']+)'/g)].map(m => m[1]));
  const toursPorDest = {};
  for (const m of app.matchAll(/tour\(\['([a-z0-9]+)'\],\s*'([^']*)',\s*'((?:[^'\\]|\\.)*)'/g)) {
    const clave = m[1] + '#' + m[3];
    if (conFoto.has(clave)) continue;
    (toursPorDest[m[1]] = toursPorDest[m[1]] || []).push({ titulo: m[3], lugar: m[2] });
  }

  for (const dest of pedidos) {
    const tours = toursPorDest[dest] || [];
    console.log('\n' + '='.repeat(74));
    console.log(dest.toUpperCase() + '   tours sin foto: ' + tours.length);
    console.log('='.repeat(74));

    let categoria = null, buscando = true, fallo = '';
    for (const c of CATEGORIAS[dest]) {
      const j = await api('list=categorymembers&cmtitle=Category:' + encodeURIComponent(c) + '&cmtype=file&cmlimit=3');
      if (j._error) { fallo = j._error; break; }
      if (j.query && j.query.categorymembers && j.query.categorymembers.length) { categoria = c; break; }
      await espera(350);
    }
    if (fallo) { console.log('  NO SE PUDO PREGUNTAR (' + fallo + '). Este destino queda sin dato, no sin foto.'); continue; }
    if (!categoria) { console.log('  no existe ninguna de estas categorias: ' + CATEGORIAS[dest].join(' | ')); continue; }

    const j = await api('list=categorymembers&cmtitle=Category:' + encodeURIComponent(categoria) + '&cmtype=file&cmlimit=120');
    if (!j || !j.query || !j.query.categorymembers) { console.log('  la API no respondio para Category:' + categoria + ' (reintentar)'); continue; }
    const archivos = j.query.categorymembers.map(m => m.title.replace(/^File:/, ''));
    console.log('  categoria: Category:' + categoria + '   (' + archivos.length + ' archivos)');

    const infos = await infoDe(archivos);
    const centro = geo[dest];
    if (!centro) { console.log('  ' + dest + ' no esta en data/destinos-geo.json'); continue; }
    const RADIO = radioDe(dest);
    console.log('  verificacion contra ' + centro.lat + ',' + centro.lon + '  radio ' + RADIO + ' km' +
      (RADIO < RADIO_NORMAL ? '  (reducido: hay un destino vecino a menos de 25 km)' : ''));

    const aptas = [];
    for (const [nombre, i] of infos) {
      const lic = licencia(meta(i, 'LicenseShortName'));
      if (!lic.ok) continue;
      if (i.width < MIN_W) continue;
      const lat = parseFloat(meta(i, 'GPSLatitude')), lon = parseFloat(meta(i, 'GPSLongitude'));
      if (!isFinite(lat) || !isFinite(lon) || lat === 0) continue;   // sin GPS: no se puede verificar
      const d = distKm(centro.lat, centro.lon, lat, lon);
      if (d > RADIO) continue;
      aptas.push({ nombre, i, nota: d.toFixed(0) + ' km', lic: meta(i, 'LicenseShortName'),
        autor: meta(i, 'Artist'), archivo: DE_ARCHIVO.test(nombre + ' ' + meta(i, 'ImageDescription')) });
    }
    const sinGps = [...infos.values()].filter(i => {
      const la = parseFloat(meta(i, 'GPSLatitude')), lo = parseFloat(meta(i, 'GPSLongitude'));
      return !isFinite(la) || la === 0;
    }).length;
    console.log('  APTAS: ' + aptas.length + '   (de archivo: ' + aptas.filter(a => a.archivo).length +
      '   descartadas por GPS: ' + (infos.size - aptas.length - sinGps) + '   sin GPS, no verificables: ' + sinGps + ')\n');
    if (!aptas.length) {
      console.log('    SIN FOTOS VERIFICABLES. Este destino queda con el degradado y el icono.\n');
      continue;
    }
    aptas.sort((a, b) => b.i.width - a.i.width);
    aptas.slice(0, 8).forEach(a => {
      console.log('    ' + (a.archivo ? 'ARQ ' : '    ') + (a.i.width + 'x' + a.i.height).padEnd(11) + a.lic.padEnd(15) + a.nota.padEnd(9) + a.nombre.slice(0, 54));
    });

    /* Emparejar cada tour con lo que el nombre del archivo dice del lugar. Es una
       SUGERENCIA para que la revision Humana arranque por ahi, no una
       eleccion: "Schooner por las islas" y una foto que se llame "Ilhas
       Paradisacas" es una conjetura razonable, no una verificacion. */
    console.log('\n    sugerencias por tour (revisar a ojo):');
    for (const t of tours) {
      const palabras = (t.titulo + ' ' + t.lugar).toLowerCase()
        .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
        .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c').replace(/ñ/g, 'n')
        .split(/[^a-z0-9]+/).filter(p => p.length > 4 && !['barco', 'paseo', 'playas', 'cosata'].includes(p));
      const conPuntaje = aptas.map(a => {
        const nombre = a.nombre.toLowerCase();
        let s = 0;
        palabras.forEach(p => { if (nombre.includes(p)) s += 10; });
        if (s && !a.archivo) s += 3;
        if (s && a.nota !== 'sin GPS') s += 2;
        return { a, s };
      }).filter(x => x.s > 0).sort((x, y) => y.s - x.s);
      if (conPuntaje.length) {
        console.log('      "' + t.titulo + '"');
        conPuntaje.slice(0, 3).forEach(x => console.log('         -> ' + x.a.nombre.slice(0, 62) + '   (' + x.s + ')'));
      } else {
        console.log('      "' + t.titulo + '"  -> SIN coincidencia por nombre, hay que mirar la categoria a mano');
      }
    }
  }
})();
