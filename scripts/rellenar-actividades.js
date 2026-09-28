'use strict';
/*
 * Rellena data/actividades-civitatis.json con productos reales de Civitatis.
 *
 *   node scripts/rellenar-actividades.js            -> solo informa, no escribe
 *   node scripts/rellenar-actividades.js --escribir  -> escribe el JSON
 *
 * DE DONDE SALE CADA COSA
 *
 * Precio y titulo: de la PAGINA DEL PRODUCTO, en su JSON-LD de schema.org (el
 * mismo que usa el SEO de Civitatis). No del listado de la ciudad.
 *
 * Esa distincion no es menor. El listado de destino trae un blob de tracking con
 * el precio BASE del producto, que cuando hay variantes —solo transporte, solo
 * entrada, completo— es la mas barata. Medido el 28/09/2026:
 *
 *   "Tour por el Cristo Redentor y el Pan de Azucar"
 *     listado de la ciudad ........ 19,07 USD
 *     pagina del producto ......... 95,63 USD
 *
 * Y al reves, en otro producto el listado daba mas que la pagina: Rocinha,
 * 80,10 contra 53,17. O sea que el numero del listado no es un precio de este
 * producto, es un precio de otra cosa. Meterlo en la app seria publicar una
 * cifra que no corresponde con lo que el viajero va a pagar.
 *
 * Lo que el precio SIGUE sin ser: el de la fecha que esta mirando la persona.
 * El de la pagina es el de la fecha por defecto del visitante. El JSON lo dice y
 * la card de la app lo muestra. Para el precio por fecha exacta hace falta la API
 * B2B (CIVITATIS_API_KEY), que ya esta implementada en lib/providers/civitatis.js
 * y no esta configurada.
 *
 * FOTOS: POR QUE CATEGORIAS Y NO BUSQUEDA DE TEXTO
 *
 * La primera version buscaba con gsrsearch y elegia el primer resultado. Traia
 * una catedral para un paseo en barco, una playa de Santa Catarina para un curso
 * de surf en Buzios y los Obama con niebla para una excursion a Rio. La causa no
 * es que las fotos no existieran: es que la busqueda de Commons corre sobre el
 * OCR de PDFs escaneados, asi que "Buzios boats bay" leonia un directorio
 * comercial de San Francisco de 1910 y "Buzios" le devolvia una postal del
 * Congo de 1888.
 *
 * Las categorias no tienen ese problema: sus miembros son los archivos que
 * alguien\subio ahi. "Category:Beaches in Arraial do Cabo" son fotos de las
 * playas de Arraial do Cabo, sin exceptions. Por eso cada actividad declara sus
 * categorias y el script elige dentro de ellas, Filename y no fecha: lo que
 * importa es que la foto sea de la cosa, no cuando se subio.
 *
 * El orden de categorias es de mas especifica a mas general, y se recorren en
 * ese orden. La primera categoria con una foto que pase los filtros gana, y el
 * script informa cual fue para que se pueda revisar.
 *
 * Los filtros descartan lo que no es una foto de la actividad: los .pdf y .svg
 * (que es donde caen los escaneos), los banners y logos de wiki, y los archivos
 * en vertical, porque una card de la app es apaisada y una foto vertical sale
 * recortada a algo irreconocible.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'actividades-civitatis.json');
const ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
const AFILIADO = '115515';
const FREE = /^(cc0|cc by|cc by-sa|public domain|pd-|no restrictions)/i;

const NO_ES_FOTO = /banner|logo|coat of arms|escudo|flag|bandera|\bseal\b|locator|diagram|chart|panoramio de/i;
const ES_IMAGEN = /\.(jpe?g|png)$/i;
/* Menos que esto es vertical y sale recortado. */
const ANCHO_MINIMO = 1.15;

const PRODUCTOS = {
  rio: [
    { url: 'https://www.civitatis.com/es/rio-de-janeiro/tour-corcovado-pan-azucar',
      cats: ['Christ the Redeemer', 'Corcovado (Rio de Janeiro)'] },
    { url: 'https://www.civitatis.com/es/rio-de-janeiro/tour-completo-rio-janeiro',
      cats: ['Sugarloaf Mountain', 'Copacabana'] },
    { url: 'https://www.civitatis.com/es/rio-de-janeiro/tour-favela',
      cats: ['Rocinha'] },
    { url: 'https://www.civitatis.com/es/rio-de-janeiro/tour-favela-santa-marta',
      cats: ['Morro Dona Marta', 'Favelas in Rio de Janeiro'] },
    { url: 'https://www.civitatis.com/es/rio-de-janeiro/excursion-arraial-cabo',
      cats: ['Beaches in Arraial do Cabo', 'Arraial do Cabo'] },
    { url: 'https://www.civitatis.com/es/rio-de-janeiro/tour-privado-rio-janeiro',
      cats: ['Ipanema', 'Leblon'] }
  ],
  buz: [
    { url: 'https://www.civitatis.com/es/buzios/paseo-catamaran-buzios',
      cats: ['Beaches in Armação dos Búzios'] },
    { url: 'https://www.civitatis.com/es/buzios/paseo-goleta-buzios',
      cats: ['Área 1 do Litoral de Armação dos Búzios', 'Armação dos Búzios'] },
    { url: 'https://www.civitatis.com/es/buzios/tour-buggy-buzios',
      cats: ['Igreja de Santana (Armação dos Búzios)', 'Praia do Canto (Búzios)'] },
    { url: 'https://www.civitatis.com/es/buzios/bautismo-buceo-buzios',
      cats: ['Diving in Arraial do Cabo'] },
    { url: 'https://www.civitatis.com/es/buzios/curso-surf-buzios',
      cats: ['Surfing in Rio de Janeiro', 'Surfing in Brazil'] },
    { url: 'https://www.civitatis.com/es/buzios/excursion-arraial-cabo-paseo-barco',
      cats: ['Praia do Forno (Arraial do Cabo)', 'Pontal do Atalaia'] },
    { url: 'https://www.civitatis.com/es/buzios/excursion-rio-janeiro',
      cats: ['Niterói', 'Botafogo'] }
  ]
};

/* El script ya eligio una foto para estas dos, y son la misma. Dos cards con la
   misma foto parece un bug de复制 aunque sean dos productos distintos, asi que
   se listan aparte para elegir una diferente. */
const REPETIDAS = {
  'excursion-arraial-cabo': ['Beaches in Arraial do Cabo', 'Praia do Forno (Arraial do Cabo)', 'Arraial do Cabo'],
  'excursion-rio-janeiro': ['Botafogo', 'Niterói', 'Santa Teresa (Rio de Janeiro)']
};

function get(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (armado del catalogo de actividades)', 'Accept-Language': 'es' },
      timeout: 25000
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve(raw));
      res.on('error', () => resolve(''));
    }).on('error', () => resolve(''));
  });
}

async function api(params) {
  try { return JSON.parse(await get('https://commons.wikimedia.org/w/api.php?format=json&' + params)); }
  catch (e) { return {}; }
}

async function leerProducto(url) {
  const html = await get(url);
  if (!html) return null;
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  let nombre = null, precio = null, moneda = null;
  for (const ld of lds) {
    let j;
    try { j = JSON.parse(ld); } catch (e) { continue; }
    if (j.offers && j.offers.price) {
      nombre = String(j.name || '').trim();
      precio = Number(j.offers.price);
      moneda = String(j.offers.priceCurrency || '').trim();
    }
  }
  if (!nombre || !(precio > 0)) return null;
  let desc = '';
  const meta = html.match(/<meta name="description" content="([^"]{20,400})"/i)
    || html.match(/<meta property="og:description" content="([^"]{20,400})"/i);
  if (meta) {
    desc = meta[1]
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é')
      .replace(/\s*\.\s*$/, '').trim();
    // El precio no va en la descripcion: la card ya lo muestra y el numero
    // cambia con la fecha.
    desc = desc.replace(/\s*(US\$|USD|R\$|BRL)\s?[\d.,]+/gi, '').replace(/\s{2,}/g, ' ').trim();
  }
  return { nombre, precio, moneda, descripcion: desc.slice(0, 240) };
}

/* Los archivos de una categoria, con su autor y su licencia. Se piden de a diez
   porque la API corta la lista larga y no devuelve metadatos de todo. */
async function archivosDe(categoria) {
  const d = await api('action=query&generator=categorymembers&gcmtitle=Category:' + encodeURIComponent(categoria) +
    '&gcmtype=file&gcmlimit=50&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1280');
  const paginas = d.query && d.query.pages ? Object.values(d.query.pages) : [];
  return paginas.map((p) => {
    const ii = p.imageinfo && p.imageinfo[0];
    const archivo = String(p.title || '').replace(/^File:/, '');
    if (!ii || !ES_IMAGEN.test(archivo) || NO_ES_FOTO.test(archivo)) return null;
    if (!ii.thumburl) return null;
    if (ii.width && ii.height && ii.width / ii.height < ANCHO_MINIMO) return null;
    const m = ii.extmetadata || {};
    const licencia = String((m.LicenseShortName && m.LicenseShortName.value) || '').trim();
    let autor = String((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    autor = autor.replace(/^Original author:\s*/i, '').split(/\s*[,;]\s*/)[0].trim();
    if (!FREE.test(licencia) || !autor) return null;
    return {
      archivo: archivo,
      categoria: categoria,
      url: ii.thumburl.split('?')[0],
      autor: autor.slice(0, 80),
      licencia: licencia
    };
  }).filter(Boolean);
}

async function fotoDe(categorias) {
  for (const c of categorias) {
    const archivos = await archivosDe(c);
    if (archivos.length) return archivos[0];
  }
  return null;
}

(async function () {
  const actual = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const salida = {
    _COMO_USAR: actual._COMO_USAR || [],
    _COMO_SE_GENERO: [
      'Generado por scripts/rellenar-actividades.js.',
      '',
      'PRECIO: de la pagina del producto (JSON-LD de schema.org), no del listado de',
      'la ciudad. El del listado es el de la variante mas barata y puede ser cinco',
      'veces menor: el Cristo Redentor aparece a 19,07 USD en el listado y a 95,63',
      'en su pagina. El del listado no es un precio de este producto.',
      '',
      'FOTOS: de categorias de Wikimedia Commons, no de busqueda de texto. La',
      'busqueda corre sobre el OCR de PDFs escaneados y devolvia un directorio',
      'comercial de San Francisco para "Buzios boats bay". Las categorias si',
      'contienen lo que alguien适当的 subio ahi.',
      '',
      'LO QUE HAY QUE REVISAR A MANO:',
      '  - El precio es el de la fecha por defecto del visitante, no el de la fecha',
      '    que esta mirando quien cotiza. La card lo dice. Para el precio exacto hace',
      '    falta CIVITATIS_API_KEY (la API B2B ya esta implementada).',
      '  - La foto es la primera que pasa los filtros dentro de la categoria, no una',
      '    foto del producto exacto: es una foto del lugar. Conviene mirarlas.',
      '  - "_categoria" deja ver de que lista salio cada una.'
    ].join('\n'),
    afiliado: AFILIADO,
    destinos: {}
  };

  let ok = 0, sinFoto = 0, sinPrecio = 0;
  for (const [clave, items] of Object.entries(PRODUCTOS)) {
    const lista = [];
    console.log('\n=== ' + clave + ' ===');
    for (const item of items) {
      const slug = item.url.split('/').pop();
      const p = await leerProducto(item.url);
      if (!p) { console.log('  SIN PRECIO  ' + slug); sinPrecio++; continue; }
      const cats = (REPETIDAS[slug] || item.cats);
      const foto = await fotoDe(cats);
      if (!foto) { console.log('  SIN FOTO    ' + p.nombre.slice(0, 48)); sinFoto++; continue; }
      lista.push({
        titulo: p.nombre,
        url: item.url.replace(/\?.*$/, '') + '/?aid=' + AFILIADO,
        precio: Math.round(p.precio * 100) / 100,
        descripcion: p.descripcion,
        rating: 0,
        resenas: 0,
        cancelacionGratis: false,
        imagen: foto.url,
        autor: foto.autor,
        licencia: foto.licencia,
        _categoria: foto.categoria,
        _archivo: foto.archivo,
        _moneda: p.moneda
      });
      ok++;
      console.log('  ' + String(p.precio).padStart(7) + ' USD  ' + p.nombre.slice(0, 44));
      console.log('           ' + foto.archivo.slice(0, 60));
      console.log('           cat: ' + foto.categoria + '  [' + foto.licencia + ', ' + foto.autor + ']');
    }
    if (lista.length) salida.destinos[clave] = lista;
  }

  console.log('\n' + ok + ' actividades · ' + sinFoto + ' sin foto · ' + sinPrecio + ' sin precio');
  if (!ESCRIBIR) {
    console.log('\nSolo informe. Revisalo y despues: node scripts/rellenar-actividades.js --escribir');
    return;
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(salida, null, 2) + '\n', 'utf8');
  console.log('escrito: ' + JSON_PATH);
})();
