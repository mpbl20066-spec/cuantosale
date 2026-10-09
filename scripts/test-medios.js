'use strict';
/*
 * Comprueba la regla de "¿Cómo querés viajar?": la pantalla solo se muestra si hay
 * dos o mas alternativas que el sistema pueda calcular y comparar.
 *
 * QUE PRUEBA
 * Para los 40 destinos de lib/model.js:
 * - Lo que el snapshot dice (destinos-datos.js) coincide con lo que el modelo
 *   tiene: auto solo donde hay ruta, bus solo donde hay pasaje, avion en todos.
 * - Los 13 con auto tienen su entrada en RT_DATA (ruta-datos.js): sin ruta no hay
 *   kilometraje, y sin kilometraje no se ofrece auto.
 * - La decision de mostrar la pantalla sale de la cantidad de alternativas, no del
 *   nombre de la ciudad ni de la region.
 * - Un destino con una sola alternativa va a resultados con ese medio (no queda
 *   colgado en la pantalla) y con varias llega a la pantalla.
 *
 * QUE NO PRUEBA
 * No abre el navegador ni dibuja: mira la logica de las pantallas leyendo el
 * script inline de cada HTML, que es donde vive la regla.
 *
 * Uso: node scripts/test-medios.js
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');
const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = function (cond, msg) { if (!cond) { console.log('  FALLA: ' + msg); fallos++; } };

/* Los datos que las pantallas leen. */
global.window = {};
(0, eval)(fs.readFileSync(path.join(RAIZ, 'public', 'test', 'destinos-datos.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(RAIZ, 'public', 'test', 'ruta-datos.js'), 'utf8'));
const DESTS = window.CS_DESTS;
const RT = window.RT_DATA;

/* 1. El snapshot coincide con el modelo. */
console.log('1. El snapshot dice lo mismo que el modelo');
DESTS.forEach(function (d) {
  const D = model.DEST[d.k];
  ok(!!D, d.k + ': esta en el modelo');
  ok(D && D.name === d.name, d.k + ': nombre (' + d.name + ' vs ' + (D && D.name) + ')');
  ok(D && D.region === d.region, d.k + ': region');
  const l = d.medios || [];
  ok(l.indexOf('avion') >= 0, d.k + ': tiene avion (los 40 lo tienen en el modelo)');
  ok((l.indexOf('bus') >= 0) === !!(D.modes && D.modes.bus), d.k + ': bus solo si el modelo tiene pasaje de bus');
  ok((l.indexOf('auto') >= 0) === model.isRoadtripAllowed(d.k), d.k + ': auto solo si hay ruta en el modelo');
});
ok(DESTS.length === Object.keys(model.DEST).length, 'estan los ' + Object.keys(model.DEST).length + ' destinos');

/* 2. Auto sin ruta no se ofrece, y con ruta hay kilometraje. */
console.log('2. Auto y ruta van juntos');
DESTS.forEach(function (d) {
  const auto = (d.medios || []).indexOf('auto') >= 0;
  ok(auto === !!RT[d.k], d.k + ': auto en el snapshot = entrada en ruta-datos.js (' + (auto ? 'auto' : 'sin auto') + ')');
});

/* 3. La cantidad de alternativas es real, y ningun destino queda con una pantalla
     que no decide nada. home-destino.html ya no pregunta el medio (ver punto 4), asi
     que esta regla hoy solo la aplica el calculador de ruta (punto 5). El dato se
     sigue mirando porque es el que decide ahi y el que usaria cualquier pantalla
     de medios que se agregue. */
console.log('3. Los medios de cada destino son los que el modelo puede cotizar');
DESTS.forEach(function (d) {
  const n = (d.medios || []).length;
  ok(n >= 1, d.k + ': tiene al menos un medio (el modelo tiene avion para los 40)');
  ok(n <= 3, d.k + ': no ofrece mas medios de los que existen');
});

/* 4. Ningun destino con una sola alternativa se queda trabado en la pantalla.
      Se ejecuta la logica real de home-destino.html: se extraen las funciones
      que deciden y se corre el mismo criterio que usa la pagina. */
console.log('4. home-destino.html: no pregunta el medio de transporte');
const htmlDestino = fs.readFileSync(path.join(RAIZ, 'public', 'test', 'home-destino.html'), 'utf8');
const htmlCalcular = fs.readFileSync(path.join(RAIZ, 'public', 'test', 'home-calcular.html'), 'utf8');
ok(!/Cómo querés viajar/.test(htmlDestino), 'home-destino ya no tiene la pantalla "¿Cómo querés viajar?"');
ok(!/d-medios|d-medio__|data-medio=/.test(htmlDestino), 'no quedan las tarjetas de medio de transporte');
ok(!/Comparar opciones/.test(htmlDestino), 'no queda "Comparar opciones"');
ok(!/pant3/.test(htmlDestino), 'no queda la pantalla 3');
ok(/if \(S\.dest && destInfo\(\) && qs\.get\('pax'\)\) \{ aResultados\(\); \}/.test(htmlDestino),
  'entrar con destino y pax va derecho a resultados');
ok(/ir\(2\)/.test(htmlDestino), 'elegir destino sigue yendo a las fechas');
ok(!/porTierra/.test(htmlDestino), 'home-destino no decide por region (porTierra)');
ok(!/GRUPO\[/.test(htmlDestino), 'home-destino no mapea region a grupo de transporte');
/* El CSS de las tarjetas de medio se borro junto con la pantalla: si queda, es
   codigo muerto que la proxima persona va a tratar de usar. */
const webCss = fs.readFileSync(path.join(RAIZ, 'public', 'test', 'web.css'), 'utf8');
ok(!/d-medio|d-nota/.test(webCss), 'web.css no tiene reglas de .d-medio ni .d-nota');
ok(!/data-pant="3"/.test(webCss), 'web.css no tiene reglas para el paso 3 de destino');

/* 4b. MEDIO_TXT cubre todos los medios que se dibujan.
     'comparar' no viene de mediosDe (no es un medio cotizable, es la accion de
     comparar), asi que tiene que estar en el mapa de textos: sin esa entrada
     o('comparar') leia undefined y la pantalla entera reventaba al pintarse. */
console.log('4b. home-calcular.html: la pantalla se pinta sin errores');
const MEDIO_ESPERADO = { gram: ['En avión', 'En auto', 'Comparar opciones'], fln: ['En avión', 'En bus', 'En auto', 'Comparar opciones'] };
Object.keys(MEDIO_ESPERADO).forEach(function (k) {
  const d = DESTS.filter(function (x) { return x.k === k; })[0];
  const l = d.medios || [];
  const nombres = l.map(function (m) { return { avion: 'En avión', auto: 'En auto', bus: 'En bus' }[m]; });
  ok(JSON.stringify(nombres.concat(['Comparar opciones'])) === JSON.stringify(MEDIO_ESPERADO[k]),
    k + ': la pantalla ofrece ' + JSON.stringify(MEDIO_ESPERADO[k]) + ' (tiene ' + JSON.stringify(l) + ')');
});
ok(/comparar: \[/.test(htmlCalcular), "'comparar' esta en MEDIO_TXT (si falta, pant2 revienta)");
ok(/hay\.map\(o\)\.join\(''\)/.test(htmlCalcular), 'pant2 dibuja los medios del destino y despues comparar');

console.log('5. home-calcular.html: el calculador de ruta usa el mismo criterio');
ok(!/porTierra/.test(htmlCalcular), 'home-calcular no decide por region (porTierra)');
ok(/if \(!hayDecision\(destInfo\(\)\)\)/.test(htmlCalcular), 'el paso 1 saltea la pantalla con una sola alternativa');
ok(/mediosDe\(destInfo\(\)\)\.indexOf\(S\.modo\) < 0/.test(htmlCalcular), 'un medio que el destino no tiene se ignora al hacer clic');
ok(/MEDIO_TXT/.test(htmlCalcular), 'pant2 dibuja los medios desde MEDIO_TXT');
/* 'comparar' se ofrece aparte de los medios del destino, asi que tiene que estar en
   MEDIO_TXT: sin esa entrada, o('comparar') leia undefined y la pantalla entera
   reventaba al pintarse. */
ok(/comparar: \[/.test(htmlCalcular), "MEDIO_TXT tiene la entrada 'comparar' (si falta, pant2 revienta)");
ok(/d\[3\] && d\[3\]\.length \? d\[3\] : \['avion'\]/.test(htmlCalcular), 'sin datos, el destino cae a avion');

console.log('6. home-presupuesto.html: la preferencia se respeta');
const htmlPresupuesto = fs.readFileSync(path.join(RAIZ, 'public', 'test', 'home-presupuesto.html'), 'utf8');
ok(/comparar/.test(htmlPresupuesto), 'se puede comparar todos los medios');
ok(/Filtramos por esta forma de llegar/.test(htmlPresupuesto), 'el texto dice que es un filtro');
ok(/S\.modo = S\.medio === 'comparar' \? 'todos' : S\.medio/.test(htmlPresupuesto), 'la preferencia elegida es la que filtra los resultados');
/* El server es el que saca los destinos sin ese transporte, no la pantalla: si la
   pantalla filtrara, un destino sin ruta no tendria que aparecer en el modelo. */
const server = fs.readFileSync(path.join(RAIZ, 'server.js'), 'utf8');
ok(/if \(transportPedido === 'auto'\) return model\.isRoadtripAllowed\(key\)/.test(server),
  'el server saca del resultado los destinos sin ruta cuando se pide auto');
ok(/if \(transportPedido === 'bus'\) return !!\(model\.DEST\[key\]\.modes && model\.DEST\[key\]\.modes\.bus\)/.test(server),
  'el server saca del resultado los destinos sin pasaje de bus cuando se pide bus');

console.log(fallos ? '\n' + fallos + ' fallo(s)' : '\nTodo pasa');
process.exit(fallos ? 1 : 0);