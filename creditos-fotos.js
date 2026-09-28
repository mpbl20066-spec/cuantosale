'use strict';
/*
 * Resuelve autor y licencia de cada foto que usa la app.
 *
 *   node creditos-fotos.js
 *
 * Lee las URLs de Wikimedia de public/app.js, consulta la ficha de cada
 * archivo y escribe public/creditos-fotos.generated.js con los datos que hay
 * que mostrar. No se inventa nada: si la API no devuelve autor o licencia, la
 * foto queda marcada para revisarla a mano en vez de publikar un crédito
 * inventado.
 */
const fs = require('fs');
const path = require('path');

// Se leen los dos archivos que tienen URLs de fotos. Antes era uno solo
// (app.js), y las fotos de la Guia Secreta, que viven en public/guias.js,
// quedaban sin acreditar: exactamente lo que este archivo existe para evitar.
const SRC = [
  path.join(__dirname, 'public', 'app.js'),
  path.join(__dirname, 'lib', 'guias.js')
];
const OUT = path.join(__dirname, 'public', 'creditos-fotos.generated.js');
const UA = 'cuantosale-creditos/1.0 (atribucion de fotos)';

// De la URL de Wikimedia se recupera el nombre real del archivo en Commons.
// Hay dos formatos y no se parecen:
//   thumbnail:  /commons/thumb/3/3a/Archivo.jpg/1280px-Archivo.jpg
//   original:   /commons/6/6b/Archivo.jpg   (upload.wikimedia.org)
// En los dos hay un hash MD5 de dos carpetas antes del nombre.
//
// El nombre va URL-encoded, y en varios casos trae %2C (coma) y %28/%29
// (paréntesis). Con la expresión regular sin decodificar antes, el archivo se
// pedía con el nombre sin decodificar y la API no lo encontraba: un archivo
// que existe en Commons devolvía "no encontrada".
function commonsFileName(url) {
  const thumb = url.match(/\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\/\d+px-/i);
  if (thumb) return 'File:' + decodeURIComponent(thumb[1]);
  // En el formato original las carpetas del hash pueden traer un punto o un
  // guion (hashs como "6.6b"), así que el patrón es más laxo que [0-9a-f].
  const original = url.match(/\/commons\/[^/]+\/[^/]+\/([^/?#]+)$/i);
  if (original) return 'File:' + decodeURIComponent(original[1]);
  return null;
}

const OUTROS = {
  'Gobierno de la Ciudad Autónoma de Buenos Aires': 'Gobierno de la Ciudad Autónoma de Buenos Aires'
};

async function ficha(fileName) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('titles', fileName);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'extmetadata');
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  // La API de Commons corta con 429 si se la consulta muy rápido, y devuelve
  // texto plano en lugar de JSON. Sin esto el script reportaba "no encontrada"
  // para casi todo y parecía un problema de nombres de archivo.
  if (r.status === 429) { const e = new Error('RATE'); e.rate = true; throw e; }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
  const info = pages[0] && pages[0].imageinfo && pages[0].imageinfo[0];
  if (!info) return null;
  const m = info.extmetadata || {};
  const autor = String((m.Artist && m.Artist.value) || '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const licencia = String((m.LicenseShortName && m.LicenseShortName.value) || '').trim();
  return { autor: autor, licencia: licencia };
}

(async function () {
  const src = SRC.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const urls = [...new Set([...src.matchAll(/'(https?:\/\/[^']+\.(?:jpg|jpeg|JPG|png|webp))'/g)].map((m) => m[1]))];
  const creditos = {};
  const sinFicha = [];
  for (const u of urls) {
    const file = commonsFileName(u);
    if (!file) { sinFicha.push(u); continue; }
    let datos = null;
    // Se reintenta con pausas crecientes: Commons corta con 429 y la espera
    // tiene que ser de segundos, no de milisegundos.
    for (let intento = 0; intento < 5 && !datos; intento++) {
      try { datos = await ficha(file); }
      catch (e) { if (!e.rate) break; }
      if (!datos) await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
    }
    if (datos && datos.autor && datos.licencia) {
      creditos[u] = { autor: datos.autor, licencia: datos.licencia };
    } else {
      // Se guarda también el título consultado: sin él es imposible saber si
      // falló la extracción del nombre o si el archivo no tiene metadatos.
      sinFicha.push(u + '   [titulo consultado: ' + file + ']' +
        (datos ? '  (ficha ok pero sin autor o licencia)' : '  (no devolvio ficha)'));
    }
    process.stdout.write('\r' + (Object.keys(creditos).length + sinFicha.length) + '/' + urls.length + '   ');
    await new Promise((r) => setTimeout(r, 900));
  }

  const lineas = Object.keys(creditos).sort().map((u) => {
    const c = creditos[u];
    return '  ' + JSON.stringify(u) + ': { autor: ' + JSON.stringify(c.autor) + ', licencia: ' + JSON.stringify(c.licencia) + ' }';
  });

  const cuerpo = `'use strict';
/*
 * Créditos de las fotos. Archivo GENERADO por creditos-fotos.js: no editar a
 * mano.
 *
 * CC BY y CC BY-SA no permiten usar una foto sin atribuir a su autor y nombrar
 * la licencia. Esta tabla es lo que la app muestra al visitante y también la
 * prueba de que hay derecho a usar cada imagen. Sin esto, el uso deja de estar
 * autorizado.
 *
 * Cualquier foto nueva que se sume a app.js tiene que pasar por
 * creditos-fotos.js: si no aparece acá, no se está acreditando.
 */
var FOTO_CREDITOS = {
${lineas.join(',\n')}
};
if (typeof module !== 'undefined' && module.exports) module.exports = FOTO_CREDITOS;
`;

  // Guarda contra regresiones. Commons corta con 429 y este script lleva casi
  // un minuto por corrida: si lo cortan a mitad de camino, la tabla que
  // escribe tiene MENOS creditos que la que ya estaba, y pisa los datos
  // buenos de las fotos que ya estaban. Pasó: la tabla bajo de 46 a 35
  // entradas y seis fotos quedaron sin acreditar por un Ctrl+C.
  //
  // Un archivo generado que pierde información nunca es una mejora, asi que
  // una corrida incompleta no escribe nada y dice por que.
  let previas = 0;
  if (fs.existsSync(OUT)) {
    try {
      const viejo = require(OUT);
      previas = viejo && typeof viejo === 'object' ? Object.keys(viejo).length : 0;
    } catch (e) { previas = 0; }
  }
  const nuevas = Object.keys(creditos).length;

  console.log('Fotos con credito: ' + nuevas + ' / ' + urls.length +
    (previas ? '  (la tabla actual tiene ' + previas + ')' : ''));
  if (sinFicha.length) {
    console.log('\nSin credito (' + sinFicha.length + '), hay que revisarlas a mano:');
    sinFicha.forEach((u) => console.log('   ' + u));
  }

  if (nuevas < previas) {
    console.log('\nNO SE ESCRIBIO NADA: la corrida dio ' + nuevas + ' creditos y el archivo ' +
      'tiene ' + previas + '. Suele ser un 429 de Commons a mitad de camino.');
    console.log('Volvé a correrlo. No borres el archivo a mano: este es el que hay que conservar.');
    process.exit(1);
  }

  fs.writeFileSync(OUT, cuerpo, 'utf8');
  console.log('\nEscrito: public/creditos-fotos.generated.js');
})();
