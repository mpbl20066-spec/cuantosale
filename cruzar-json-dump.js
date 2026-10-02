/* Solo lectura. Cruza data/tours.json con el dump de lo borrado, para saber
   que filas del JSON quedaron sin fila en la base: esas son las que un
   scripts/cargar-tours.js volveria a subir. */
const fs = require('fs');
const path = require('path');
const R = __dirname;
const j = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tours.json'), 'utf8'));
const dump = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tours-borrados.json'), 'utf8'));
const model = require(path.join(R, 'lib', 'model.js'));
const clave = (d, t) => d + '#' + t;

const enBase = new Set(dump.filas.map((f) => clave(f.destino, f.titulo)));
const activosEnBase = new Set(j.tours.filter((t) => t.activo !== false).map((t) => clave(t.destinos[0], t.titulo)));

const apagados = j.tours.filter((t) => t.activo === false);
const resucitan = apagados.filter((t) => !enBase.has(clave(t.destinos[0], t.titulo)));
const yaNo = apagados.filter((t) => enBase.has(clave(t.destinos[0], t.titulo)));

console.log('data/tours.json: ' + j.tours.length + ' filas  (' + j.tours.filter((t) => t.activo !== false).length + ' activos, ' + apagados.length + ' apagados)');
console.log('');
console.log('Apagados del JSON que YA NO estan en la base (el borrado se los llevo): ' + yaNo.length);
console.log('Apagados del JSON que NO estan ni en la base ni antes (nunca se subiieron): ' + resucitan.length);
console.log('');
const porD = {};
resucitan.forEach((t) => { (porD[t.destinos[0]] = porD[t.destinos[0]] || []).push(t); });
console.log('Activos del JSON que un cargar-tours.js volveria a subir como APAGADOS: ' + resucitan.length);
Object.keys(porD).sort().forEach((k) => {
  console.log('  ' + k + ' (' + (model.DEST[k] ? model.DEST[k].name : 'NO EN EL MODELO') + ')');
  porD[k].forEach((t) => console.log('     - ' + t.titulo.slice(0, 58) + '   ' + (t.precio_brl ? 'R$ ' + t.precio_brl : 'US$ ' + t.precio)));
});
console.log('');
console.log('Activos del JSON que si coinciden con los 23 de la base: ' + activosEnBase.size);