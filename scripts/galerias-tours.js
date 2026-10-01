'use strict';
/* Arma data/tour-galerias.json: para cada tour cuya foto vive en el bucket
   `tours` de Supabase, las demas fotos del mismo juego ("x 1", "x 2", "x 3").
   SOLO LEE el bucket (lista); no sube ni borra nada. Las fotos las sube el
   usuario. Uso: node scripts/galerias-tours.js */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' };
const LISTA = env.SUPABASE_URL + '/storage/v1/object/list/tours';
const PUBLICO = env.SUPABASE_URL + '/storage/v1/object/public/tours/';
const baseDe = (n) => n.replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[-_ ]*0?\d+(_\d+x)?$/, '').replace(/\s+/g, ' ').trim();
const ordenDe = (n) => { const m = n.replace(/\.[a-z0-9]+$/i, '').match(/(\d+)(_\d+x)?$/); return m ? Number(m[1]) : 0; };
async function listar(prefix) {
  const r = await fetch(LISTA, { method: 'POST', headers: H, body: JSON.stringify({ prefix, limit: 500 }) });
  return r.json();
}
(async () => {
  const tours = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'tours.json'), 'utf8')).tours;
  const carpetas = new Map();
  const salida = {};
  for (const t of tours) {
    const img = t.image || '';
    const i = img.indexOf('/storage/v1/object/public/tours/');
    if (i < 0) continue;
    const ruta = decodeURIComponent(img.slice(i + '/storage/v1/object/public/tours/'.length));
    const carpeta = ruta.split('/')[0];
    const archivo = ruta.split('/').slice(1).join('/');
    if (!carpetas.has(carpeta)) carpetas.set(carpeta, (await listar(carpeta)).filter((f) => f.id).map((f) => f.name));
    const base = baseDe(archivo);
    const hermanas = carpetas.get(carpeta).filter((n) => baseDe(n) === base).sort((a, b) => ordenDe(a) - ordenDe(b) || a.localeCompare(b));
    if (hermanas.length < 2) continue;
    salida[t.destinos[0] + '#' + t.titulo] = hermanas.map((n) => PUBLICO + encodeURI(carpeta + '/' + n));
  }
  fs.writeFileSync(path.join(RAIZ, 'data', 'tour-galerias.json'), JSON.stringify(salida, null, 1) + '\n');
  Object.keys(salida).forEach((k) => console.log(salida[k].length, k));
  console.log('tours con galeria:', Object.keys(salida).length);
})();
