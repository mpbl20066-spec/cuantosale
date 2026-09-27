/*
 * Prueba de la persistencia del cache de SerpAPI, SIN gastar un credito.
 *
 * Escribe una entrada con vencimiento futuro en el archivo del cache,
 * reinicia el server, y verifica que la entrada siga ahi. Si el cache fuera
 * solo en memoria, no sobrevive.
 *
 * Uso:  node probar-cache.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

// __dirname es <raiz>/lib, asi que con un solo ".." se llega a la raiz del
// proyecto. Con dos se sube hasta Desktop y el archivo queda en otro lado del
// que lee el server.
const RAIZ = path.join(__dirname, '..');
const CACHE = path.join(RAIZ, '.serpapi-cache.json');
const BASE = 'http://localhost:3000';

function pedir(ruta) {
  return new Promise(function (resolve, reject) {
    http.get(BASE + ruta, function (r) {
      let b = '';
      r.on('data', function (d) { b += d; });
      r.on('end', function () { resolve({ status: r.statusCode, body: b }); });
    }).on('error', reject);
  });
}

const Key = 'q|MVD|GIG|2026-12-16|2026-12-23|ECONOMY';
const TTL_MIN = 180;

(async function main() {
  console.log('1. estado antes de escribir a mano');
  const antes = JSON.parse((await pedir('/api/cache')).body);
  console.log('   ', JSON.stringify(antes));

  // Entrada con vencimiento en 3 horas, igual que un precio real cacheado.
  const expira = Date.now() + TTL_MIN * 60000;
  const datos = {};
  datos[Key] = {
    at: Date.now(),
    expiresAt: expira,
    value: { pp: 214, exact: true, airline: 'Gol', origen: 'PRUEBA', precio: 0 }
  };
  // Y una ya vencida, para ver que la lectura descarta las muertas.
  datos['q|MVD|PRUEBA-VENCIDA|2026-12-16|2026-12-23|ECONOMY'] = {
    at: Date.now() - 7200000, expiresAt: Date.now() - 3600000, value: { pp: 1 }
  };

  fs.writeFileSync(CACHE, JSON.stringify(datos), 'utf8');
  console.log('\n2. escribi 2 entradas a mano en el archivo:');
  console.log('    una vigente (3h) y una vencida (hace 1h)');

  console.log('\n3. reiniciá el server y volvé a correr este script.');
  console.log('   Al correrlo de nuevo, la vigente tiene que estar y la vencida no.');
  console.log(`\n   archivo: ${CACHE}`);
})().catch(function (e) { console.error(e); process.exit(1); });
