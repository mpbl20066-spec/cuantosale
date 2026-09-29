'use strict';
/*
 * Busca en Wikimedia Commons una foto libre para cada tour del catalogo cargado
 * desde tours.xlsx (data/tours-es.json) y escribe data/tour-photos.json.
 *
 *   node scripts/buscar-fotos-catalogo.js            (usa el cache de consultas)
 *
 * Reglas, las mismas que buscar-fotos-tours.js:
 *  - solo licencias libres (CC0, CC BY, CC BY-SA, dominio publico),
 *  - solo JPEG de al menos 900 px de ancho,
 *  - se guarda autor y licencia, porque CC BY/CC BY-SA exigen acreditarlos.
 *
 * Y una regla mas, por el tamano del catalogo: una foto solo se acepta si el
 * NOMBRE DEL ARCHIVO menciona el lugar buscado (un atractivo concreto o, si no
 * hay, la ciudad). Sin eso, una busqueda por "Carneiros" puede devolver
 * cualquier cosa. Si nada pasa el filtro, el tour queda sin foto y la tarjeta
 * cae al degradado con el icono: es mejor que una foto de otro lugar.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const TRABAJO = path.join(RAIZ, 'data', '_trabajo');
const SALIDA = path.join(RAIZ, 'data', 'tour-photos.json');
const CACHE = path.join(TRABAJO, 'commons-cache.json');
const UA = 'cuantosale-tour-photos/1.0 (fotos para el catalogo de tours)';
const FREE = /^(cc0|cc by|cc by-sa|public domain|pd-|no restrictions)/i;

const en = JSON.parse(fs.readFileSync(path.join(TRABAJO, 'tours-en.json'), 'utf8'));
const es = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'tours-es.json'), 'utf8'));
const model = require(path.join(RAIZ, 'lib', 'model.js'));

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Palabras que describen la actividad y no un lugar.
const GENERICAS = new Set(('tour tours trip trips day full half private guided excursion ride boat cruise catamaran schooner sailing sailboat hike hiking trek trekking ' +
  'walk walking tickets ticket entrance visit experience lesson course class beginners beginner intro introduction diving scuba dive snorkeling snorkelling snorkel ' +
  'buggy quad bike bicycle cycling kayak canoe paddle surf surfing off roading road 4x4 jeep with and the of to in at from by for a an de da do dos das e y la el los las ' +
  'transfer transport included optional pub crawl food wine beer show dinner lunch sunset sunrise night city sightseeing bus route rafting zip ziplining ' +
  'helicopter flight balloon hot air hang gliding paragliding whale watching horseback horse riding cooking workshop museum park beach beaches island islands ' +
  'waterfall waterfalls lagoon lake river bay coast coastline natural pools pool viewpoint viewpoints nature adventure family classic premium ' +
  'brazil brazilian brasil').split(' '));

// Terminos de busqueda por actividad, en portugues (que es como se titulan los
// archivos de Commons sobre Brasil).
const ACTIVIDAD = [
  [/boat|cruise|catamaran|schooner|sailing|sailboat|jangada|speedboat|lancha/i, 'passeio de barco'],
  [/diving|scuba|snorkel/i, 'mergulho'],
  [/hik|trek|trail|walk/i, 'trilha'],
  [/buggy/i, 'buggy dunas'],
  [/quad/i, 'quadriciclo'],
  [/kayak|canoe|paddle/i, 'caiaque'],
  [/waterfall|cachoeira/i, 'cachoeira'],
  [/helicopter/i, 'helicoptero'],
  [/hang gliding|paragliding|paramotor/i, 'parapente'],
  [/whale/i, 'baleia jubarte'],
  [/wine|winery/i, 'vinicola'],
  [/tango/i, 'tango'],
  [/bike|cycling|bicycle/i, 'bicicleta'],
  [/museum|museu/i, 'museu'],
  [/church|catedral|cathedral/i, 'igreja'],
  [/beach/i, 'praia'],
  [/island|ilha/i, 'ilha']
];

const NEGATIVAS = /\b(map|mapa|logo|flag|bandeira|brasao|coat of arms|diagram|svg|escudo|selo|portrait|retrato|selfie|cartaz|poster|banner|screenshot|infographic)\b/i;

function lugarDe(destKey) {
  const d = model.DEST[destKey];
  return d ? d.name : destKey;
}

function propios(tituloEn) {
  const sacar = String(tituloEn).replace(/\|.*$/, '').replace(/[()+:,&–\-/]/g, ' ');
  const toks = sacar.split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of toks) {
    const n = norm(t);
    if (!n || n.length < 4) continue;
    if (GENERICAS.has(n)) continue;
    if (!/^[A-ZÀ-Ý]/.test(t)) continue;
    out.push(t);
  }
  return out;
}

const OVERRIDES = fs.existsSync(path.join(TRABAJO, 'fotos-consultas.json')) ? JSON.parse(fs.readFileSync(path.join(TRABAJO, 'fotos-consultas.json'), 'utf8')) : {};
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const guardarCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache), 'utf8');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(termino) {
  if (cache[termino]) return cache[termino];
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', 'filetype:bitmap ' + termino);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '12');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|size|mime');
  url.searchParams.set('iiurlwidth', '1000');
  let intentos = 0;
  for (;;) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429) {
        // Commons limita el ritmo: se espera lo que pida, o 20 s, y se reintenta.
        const espera = (Number(r.headers.get('retry-after')) || 20) * 1000;
        if (++intentos > 8) return [];   // no se cachea un fallo: se reintenta en otra corrida
        console.log('   429, espero ' + Math.round(espera / 1000) + ' s');
        await dormir(espera);
        continue;
      }
      if (r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
      const out = [];
      for (const p of pages) {
        const info = p.imageinfo && p.imageinfo[0];
        if (!info || info.mime !== 'image/jpeg' || info.width < 900) continue;
        const m = info.extmetadata || {};
        const lic = String((m.LicenseShortName && m.LicenseShortName.value) || '');
        if (!FREE.test(lic)) continue;
        const autor = String((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
        out.push({ archivo: String(p.title || '').replace(/^File:/, ''), url: info.thumburl, licencia: lic, autor: autor || 'Wikimedia Commons', w: info.width, h: info.height, idx: p.index || 0 });
      }
      out.sort((a, b) => a.idx - b.idx);
      cache[termino] = out;
      return out;
    } catch (e) {
      if (++intentos > 5) return [];
      await dormir(3000 * intentos);
    }
  }
}

function puntaje(f) {
  const ratio = f.w / f.h;
  return (ratio >= 1.2 && ratio <= 2.4 ? 0 : 3) + (f.w >= 1600 ? 0 : 1);
}

(async function () {
  const resultado = fs.existsSync(SALIDA) ? JSON.parse(fs.readFileSync(SALIDA, 'utf8')) : {};
  const usadas = {}; // destino -> archivos ya usados, para no repetir la misma foto
  Object.keys(resultado).forEach((k) => { const d = k.split('#')[0]; (usadas[d] = usadas[d] || new Set()).add(resultado[k].archivo); });
  const SOLO = (process.env.DESTINOS || '').split(',').map((x) => x.trim()).filter(Boolean);
  const filas = en.filter((x) => es[x.destino + '|' + x.titulo] && (!SOLO.length || SOLO.includes(x.destino)));
  let ok = 0; let sin = 0; let n = 0;
  for (const x of filas) {
    n++;
    const ficha = es[x.destino + '|' + x.titulo];
    const clave = x.destino + '#' + ficha.titulo;
    if (resultado[clave]) { ok++; continue; }
    const lugar = lugarDe(x.destino);
    const lugarN = norm(lugar);
    const props = propios(x.titulo).filter((p) => !lugarN.split(' ').includes(norm(p)));
    const act = (ACTIVIDAD.find((a) => a[0].test(x.titulo)) || [null, ''])[1];
    // De lo mas especifico a lo mas general. Cada consulta lleva su "debe
    // aparecer": el nombre del archivo tiene que contener alguna de estas palabras
    // COMPLETAS (con "rio" suelto pasaban "Orlando" o "historia").
    const consultas = [];
    const manual = OVERRIDES[clave];
    if (manual) {
      // Consulta escrita a mano para este tour: el "debe" es una regex sobre el nombre normalizado.
      consultas.push({ q: manual[0], re: new RegExp(manual[1], 'i') });
    }
    if (props.length) {
      consultas.push({ q: props.join(' ') + ' ' + lugar, debe: props.map(norm) });
      consultas.push({ q: props.join(' '), debe: props.map(norm) });
    }
    if (act) consultas.push({ q: act + ' ' + lugar, debe: lugarN.split(' ').filter((w) => w.length > 3) });
    consultas.push({ q: lugar + ' praia', debe: lugarN.split(' ').filter((w) => w.length > 3) });
    consultas.push({ q: lugar, debe: lugarN.split(' ').filter((w) => w.length > 3) });
    let elegido = null;
    for (const c of consultas) {
      const lista = await buscar(c.q);
      await dormir(1200);
      const validas = lista.filter((f) => {
        if (NEGATIVAS.test(f.archivo)) return false;
        const t = norm(f.archivo);
        if (c.re) return c.re.test(t) || c.re.test(f.archivo.toLowerCase());
        const palabras = ' ' + t + ' ';
        return c.debe.some((w) => w && palabras.includes(' ' + w + ' '));
      });
      if (!validas.length) continue;
      const libres = validas.filter((f) => !(usadas[x.destino] && usadas[x.destino].has(f.archivo)));
      // Sin una foto sin usar de esta busqueda, se sigue con la consulta siguiente en vez de repetir.
      if (!libres.length && consultas.indexOf(c) < consultas.length - 1) continue;
      const pool = (libres.length ? libres : validas).slice().sort((a, b) => puntaje(a) - puntaje(b));
      elegido = pool[0];
      break;
    }
    if (elegido) {
      resultado[clave] = { url: elegido.url, autor: elegido.autor, licencia: elegido.licencia, archivo: elegido.archivo };
      (usadas[x.destino] = usadas[x.destino] || new Set()).add(elegido.archivo);
      ok++;
    } else { sin++; }
    console.log(n + '/' + filas.length + ' ' + clave + ' -> ' + (elegido ? elegido.archivo.slice(0, 50) : 'SIN FOTO'));
    if (n % 10 === 0) {
      guardarCache();
      fs.writeFileSync(SALIDA, JSON.stringify(resultado, null, 1), 'utf8');
      console.log(n + '/' + filas.length + '  con foto ' + ok + '  sin foto ' + sin);
    }
  }
  guardarCache();
  fs.writeFileSync(SALIDA, JSON.stringify(resultado, null, 1), 'utf8');
  console.log('LISTO  con foto ' + ok + '  sin foto ' + sin + '  de ' + filas.length);
})();
