'use strict';
/*
 * Buscador de fotos para los tours.
 *
 *   node buscar-fotos-tours.js            -> escribe public/tour-photos.generated.js
 *
 * Consulta Wikimedia Commons, se queda solo con licencias libres y guarda por
 * tour la foto, el autor y la licencia. El archivo generado es el que se
 * commitea; este script queda para poder regenerar la lista.
 *
 * No inventa: si un subject no devuelve nada con licencia libre, no lo agrega
 * y lo reporta, para que la tarjeta caiga en la foto del destino.
 */
const fs = require('fs');
const path = require('path');

// Licencias aceptadas. Commons mezcla material libre con material con
// derechos restringidos, así que el filtro es explícito y no opcional.
const FREE = /^(cc0|cc by|cc by-sa|public domain|pd-|no restrictions)/i;

// La búsqueda de Commons exige TODAS las palabras del término: con cuatro o
// cinco términos la chances de cero resultado se disparan. Por eso cada
// subject trae una lista de alternativas que se prueban en orden, de la más
// específica a la más genérica. Con dos o tres palabras distintivas acierta
// casi siempre.
const SUBJECTS = {

  'bcm#Beto Carrero World desde Camboriú': ['Beto Carrero', 'Beto Carrero World'],
};

const UA = 'cuantosale-tour-photos/1.0 (fotos para el catalogo de tours)';

async function buscar(termino, limite) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', 'filetype:bitmap ' + termino);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', String(limite || 8));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|size|mime');
  url.searchParams.set('iiurlwidth', '900');
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
  const out = [];
  for (const p of pages) {
    const info = p.imageinfo && p.imageinfo[0];
    if (!info || info.mime !== 'image/jpeg') continue;
    if (info.width < 900) continue;                       // se ve pixelado en un celular
    const m = info.extmetadata || {};
    const lic = String((m.LicenseShortName && m.LicenseShortName.value) || '');
    if (!FREE.test(lic)) continue;
    const author = String((m.Artist && m.Artist.value) || '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    out.push({
      titulo: String(p.title || '').replace(/^File:/, ''),
      thumb: info.thumburl,
      licencia: lic,
      autor: author || 'Wikimedia Commons',
      w: info.width, h: info.height
    });
  }
  // Se prioriza el que mejor se recorta en una tarjeta: apaisado y no muy alto.
  out.sort((a, b) => {
    const score = (x) => (x.w / x.h > 1.2 ? 0 : 3) + (x.w / x.h > 2.4 ? 0 : 1);
    return score(a) - score(b);
  });
  return out;
}

(async function () {
  const claves = Object.keys(SUBJECTS);
  const encontrado = {};
  const sinFoto = [];
  for (let i = 0; i < claves.length; i++) {
    const clave = claves[i];
    const terminos = SUBJECTS[clave];
    let lista = [];
    // Se prueban las alternativas en orden hasta que una devuelva algo usable.
    for (const termino of terminos) {
      if (lista.length) break;
      try { lista = await buscar(termino); }
      catch (e) { console.error("\n  error " + clave + " (" + termino + "): " + e.message); }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (lista.length) {
      encontrado[clave] = lista[0];
      console.log("OK   " + clave + "   <- " + lista[0].titulo.slice(0, 48));
    } else {
      sinFoto.push(clave);
      console.log("FALTA " + clave);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("\n");
  console.log("Con foto: " + Object.keys(encontrado).length + " / " + claves.length);
  if (sinFoto.length) {
    console.log("Sin foto libre: " + sinFoto.length);
    sinFoto.forEach((k) => console.log("   " + k));
  }
  fs.writeFileSync(path.join(__dirname, "tour-photos.buscar.json"), JSON.stringify(encontrado, null, 2), "utf8");
  console.log("\nRevisa tour-photos.buscar.json antes de convertirlo a JS.");
})();
