// Genera _run.js con SOLO el bloque de pruebas de la guia, sin la parte que
// consume cuota de RapidAPI. Script de una vez.
const fs = require('fs');
const L = fs.readFileSync('./test.js', 'utf8').split(/\r?\n/);

const desde = L.findIndex(l => l.indexOf("console.log('Guia Secreta');") >= 0);
const hasta = L.findIndex(l => l.indexOf("console.log('Modelo');") >= 0);
if (desde < 0 || hasta < 0) { console.log('no se encontro el bloque'); process.exit(1); }

const mainAt = L.findIndex(l => l.indexOf('(async function main() {') === 0);
const out = L.slice(0, mainAt + 1)
  .concat(L.slice(desde, hasta))
  .concat(['  console.log("\\n" + passed + " pruebas OK" + (process.exitCode ? " (con fallas)" : ""));', '})();', '']);

fs.writeFileSync('./_run.js', out.join('\r\n'), 'utf8');
console.log('_run.js: ' + (L.slice(desde, hasta).join('\n').match(/await t\(/g) || []).length + ' pruebas');
