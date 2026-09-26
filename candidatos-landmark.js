'use strict';
/*
 * Candidatos para los landmarks. Devuelve los 3 mejores de cada subject para
 * poder MIRARLOS antes de elegir. La eleccion no es automatica a proposito:
 * el filtro de licencia y de aspecto no alcanza, hace falta verificar que la
 * foto muestre lo que dice.
 *
 *   node candidatos-landmark.js
 */
const fs = require('fs');

const FREE = /^(cc0|cc by|cc by-sa|public domain|pd-|no restrictions)/i;
const UA = 'cuantosale-tour-photos/1.0 (fotos para el catalogo de tours)';

const SUBJECTS = {
  'Cristo Redentor (Rio)': ['Cristo Redentor', 'Corcovado statue Rio'],
  'Pelourinho (Salvador)': ['Pelourinho Salvador', 'Pelourinho'],
  'Pampulha (Belo Horizonte)': ['Pampulha Belo Horizonte', 'Casa da Pampulha'],
  'Cataratas Iguazu lado brasileno': ['Iguazu Falls Brazil', 'Salto Iguacu'],
  'Garganta del Diablo': ['Garganta del Diablo', 'Devil`s Throat Iguazu'],
  'Itaipu': ['Itaipu dam', 'Represa de Itaipu'],
  'Beto Carrero World': ['Beto Carrero World', 'Beto Carrero'],
  'Pedra Furada (Jericoacoara)': ['Pedra Furada', 'Jericoacoara dune']
};

async function buscar(termino) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', 'filetype:bitmap ' + termino);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '12');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|size|mime');
  url.searchParams.set('iiurlwidth', '1100');
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
  const out = [];
  for (const p of pages) {
    const info = p.imageinfo && p.imageinfo[0];
    if (!info || info.mime !== 'image/jpeg') continue;
    if (info.width < 1400) continue;
    const m = info.extmetadata || {};
    const lic = String((m.LicenseShortName && m.LicenseShortName.value) || '');
    if (!FREE.test(lic)) continue;
    // Se descartan panorámicas extremas: en una tarjeta de 210px de alto se
    // ven como una franja de color.
    const ratio = info.width / info.height;
    if (ratio < 1.1 || ratio > 2.3) continue;
    out.push({
      titulo: String(p.title || '').replace(/^File:/, ''),
      thumb: info.thumburl,
      licencia: lic,
      autor: String((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70) || 'Wikimedia Commons',
      w: info.width, h: info.height, ratio: Math.round(ratio * 100) / 100
    });
  }
  return out;
}

(async function () {
  const salida = {};
  for (const [clave, terminos] of Object.entries(SUBJECTS)) {
    let lista = [];
    for (const t of terminos) {
      if (lista.length >= 3) break;
      try { lista = lista.concat(await buscar(t)); } catch (e) { console.error('  ' + clave + ': ' + e.message); }
      await new Promise((r) => setTimeout(r, 350));
    }
    // Se dedupica por titulo y se prioriza el de mejor aspecto.
    const vistos = new Set();
    lista = lista.filter((x) => { const k = x.titulo.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; })
      .sort((a, b) => Math.abs(a.ratio - 1.5) - Math.abs(b.ratio - 1.5))
      .slice(0, 3);
    salida[clave] = lista;
    console.log('\n=== ' + clave + '  (' + lista.length + ' candidatos)');
    lista.forEach((x, i) => {
      console.log('  ' + (i + 1) + ') ' + x.titulo);
      console.log('     ' + x.w + 'x' + x.h + '  ratio ' + x.ratio + '  |  ' + x.licencia + '  |  ' + x.autor);
      console.log('     ' + x.thumb);
    });
    await new Promise((r) => setTimeout(r, 350));
  }
  fs.writeFileSync(__dirname + '/candidatos-landmark.json', JSON.stringify(salida, null, 2), 'utf8');
  console.log('\nGuardado en candidatos-landmark.json');
})();
