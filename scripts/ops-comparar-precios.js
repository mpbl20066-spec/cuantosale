'use strict';
/*
 * Foto de los precios de tours que ve la web, para comparar antes y despues de
 * tocar la base.
 *
 *   node scripts/ops-comparar-precios.js --guardar data/_trabajo/precios-web-antes.json
 *   node scripts/ops-comparar-precios.js --comparar data/_trabajo/precios-web-antes.json
 *
 * Lee por lib/tours.js, que es el mismo camino que usan /api/cotizar, la guia y
 * las paginas /destino: si aca da igual, la web da igual. Sale con codigo 1 si
 * hay alguna diferencia, para poder usarlo antes de un deploy.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
try {
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).forEach(function (linea) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* no hay .env */ }

const tours = require('../lib/tours');

async function foto() {
  const lista = await tours.todos();
  const out = {};
  lista.forEach((t) => { out[t.destinations[0] + '#' + t.title] = t.price; });
  return { origen: tours.estado(), total: lista.length, precios: out };
}

(async function () {
  const modo = process.argv[2];
  const archivo = process.argv[3];
  if (!archivo || (modo !== '--guardar' && modo !== '--comparar')) {
    console.log('Uso: --guardar <archivo> | --comparar <archivo>');
    process.exit(2);
  }
  const ahora = await foto();
  if (ahora.origen !== 'supabase') {
    console.log('Ojo: los precios no vinieron de Supabase sino de "' + ahora.origen + '". La foto no sirve.');
    process.exit(1);
  }
  if (modo === '--guardar') {
    fs.mkdirSync(path.dirname(path.resolve(archivo)), { recursive: true });
    fs.writeFileSync(archivo, JSON.stringify(ahora, null, 2));
    console.log('Guardados ' + ahora.total + ' precios en ' + archivo);
    return;
  }
  const antes = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const claves = new Set(Object.keys(antes.precios).concat(Object.keys(ahora.precios)));
  const difs = [];
  claves.forEach((k) => {
    const a = antes.precios[k];
    const b = ahora.precios[k];
    if (a !== b) difs.push(k + ': ' + (a == null ? '(no estaba)' : 'US$ ' + a) + ' -> ' + (b == null ? '(ya no esta)' : 'US$ ' + b));
  });
  console.log('Antes: ' + antes.total + ' tours. Ahora: ' + ahora.total + ' tours.');
  if (!difs.length) { console.log('Todos los precios son iguales.'); return; }
  console.log(difs.length + ' diferencias:\n  ' + difs.join('\n  '));
  process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
