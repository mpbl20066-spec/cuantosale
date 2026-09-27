'use strict';
// Verificacion de SOLO mi parte (tabla de costos diaria). No toca el area de
// vuelos ni los archivos que esta escribiendo otra sesion.
const fs = require('fs');
const assert = require('assert');
const model = require('../lib/model.js');

let n = 0;
const ok = (m) => { n++; console.log('  ok  ' + m); };

// 1. modelo: cobertura total, sin fallback, valores coherentes
const srv = model.DESTINATION_COSTS, D = model.DEST;
assert.deepStrictEqual(Object.keys(srv).filter((k) => !D[k]), [], 'entradas huerfanas');
assert.deepStrictEqual(Object.keys(D).filter((k) => !srv[k]), [], 'destinos sin costos');
for (const k of Object.keys(D)) {
  const c = srv[k];
  assert.ok(c.food.casual < c.food.moderado && c.food.moderado < c.food.gourmet, k + ' comida');
  assert.ok(c.transport.eco < c.transport.confort, k + ' transporte');
}
ok('modelo: ' + Object.keys(D).length + ' destinos, todos con costos propios y coherentes');

// 2. poa: el bug original
assert.ok(srv.poa, 'poa no existe');
assert.notStrictEqual(srv.poa, srv.rio, 'poa sigue resolviendo al fallback de rio');
assert.deepStrictEqual([srv.poa.transport.eco, srv.poa.transport.confort, srv.poa.food.casual, srv.poa.food.moderado, srv.poa.food.gourmet], [13, 30, 27, 50, 90]);
ok('poa con entrada propia: transporte 13/30, comida 27/50/90 (ya no cobra Rio)');

// 3. app.js no tiene segunda copia
const app = fs.readFileSync('public/app.js', 'utf8');
assert.ok(app.includes('var DESTINATION_DAILY_COSTS = window.CS_DESTINATION_DAILY_COSTS'), 'app.js no lee el global');
assert.ok(!app.includes('var DESTINATION_DAILY_COSTS = {'), 'app.js volvio a copiar la tabla');
ok('app.js lee el global generado y no tiene la tabla inline');

// 4. el archivo generado es identico al modelo
const genPath = require.resolve('../public/daily-costs.js');
delete require.cache[genPath];
const cli = require(genPath);
assert.deepStrictEqual(Object.keys(cli).sort(), Object.keys(srv).sort(), 'claves distintas');
for (const k of Object.keys(srv)) {
  assert.deepStrictEqual(
    [cli[k].transport.eco, cli[k].transport.confort, cli[k].food.casual, cli[k].food.moderado, cli[k].food.gourmet],
    [srv[k].transport.eco, srv[k].transport.confort, srv[k].food.casual, srv[k].food.moderado, srv[k].food.gourmet],
    k);
}
ok('daily-costs.js: ' + Object.keys(cli).length + ' entradas identicas al modelo');

// 5. cadena de carga y de cache
const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const iTag = html.indexOf('src="/daily-costs.js');
assert.ok(iTag > 0, 'index.html no carga daily-costs.js');
assert.ok(iTag < html.indexOf('src="/app.js'), 'daily-costs.js debe cargarse antes que app.js');
assert.ok(sw.indexOf("'/daily-costs.js'") > 0, 'sw.js no precachea daily-costs.js');
const vApp = Number((html.match(/app\.js\?v=(\d+)/) || [])[1]);
const vSw = Number((sw.match(/cuantosale-shell-v(\d+)/) || [])[1]);
assert.ok(vApp >= 92, 'app.js sin bumpear: el fix no llega a los usuarios (v=' + vApp + ')');
assert.ok(vSw >= 64, 'sw.js sin bumpear: daily-costs.js queda viejo (v=' + vSw + ')');
ok('cache: app.js?v=' + vApp + ', sw v' + vSw + ', daily-costs.js precacheado y cargado antes que app.js');

// 6. hooks de npm
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.ok(pkg.scripts['build:costos'], 'falta build:costos');
assert.strictEqual(pkg.scripts.pretest, 'npm run build:costos', 'pretest no regenera');
assert.strictEqual(pkg.scripts.prestart, 'npm run build:costos', 'prestart no regenera');
ok('npm: build:costos + pretest + prestart (el generado no se puede agingar)');

console.log('\n' + n + ' verificaciones de mi parte: OK');
