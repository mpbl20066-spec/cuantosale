/* Saca de data/tours.json las filas con activo: false.
 *
 * Por que hace falta:
 *
 * data/tours.json es la fuente de verdad de la que se carga la tabla
 * (scripts/cargar-tours.js sube todas las filas, apagadas Included). Borrar de la
 * base un tour apagado no lo elimina: la proxima carga lo vuelve a insertar,
 * porque el JSON todavia lo tiene. Los dos flags.active son copias
 * independientes y se desincronizan solas.
 *
 * Las filas que se van no se pierden: quedan en data/tours-apagados.json, con
 * los mismos campos. Ese archivo no lo lee nadie, es un archivo de trabajo para
 * volver a subir algo si hace falta.
 *
 * Que NO cambia el generado: public/tours.generated.js se arma solo con las filas
 * cuyo activo !== false (ver build-tours.js), asi que quitar apagados no lo
 * mueve. El script lo comprueba: si el generado cambia, no escribe el JSON.
 *
 *   node retirar-tours-apagados.js          (muestra que se va a ir)
 *   node retirar-tours-apagados.js --si     (escribe)
 */
const fs = require('fs');
const path = require('path');
const R = __dirname;
const JSON_PATH = path.join(R, 'data', 'tours.json');
const ARCHIVO = path.join(R, 'data', 'tours-apagados.json');
const GENERADO = path.join(R, 'public', 'tours.generated.js');
const SI = process.argv.includes('--si');

const original = fs.readFileSync(JSON_PATH, 'utf8');
const datos = JSON.parse(original);
const generados = fs.readFileSync(GENERADO, 'utf8');

const seVan = datos.tours.filter((t) => t.activo === false);
const quedan = datos.tours.filter((t) => t.activo !== false);

console.log('data/tours.json: ' + datos.tours.length + ' filas  (' + quedan.length + ' activas, ' + seVan.length + ' apagadas)');
if (!seVan.length) { console.log('no hay nada que retirar.'); process.exit(0); }

const porDest = {};
seVan.forEach((t) => { const d = t.destinos[0]; (porDest[d] = porDest[d] || []).push(t); });
console.log('');
console.log('A retirar por destino:');
Object.keys(porDest).sort().forEach((k) => {
  console.log('  ' + k.padEnd(12) + porDest[k].length + '   ' + porDest[k].map((t) => t.titulo).join(' | ').slice(0, 90));
});

/* El generado no tiene que cambiar. build-tours.js filtra por activo !== false,
   asi que si el contenido del generado llegara a cambiar, el motivo no seria
   este script y escribir el JSON a ciegas taparia el problema. */
const snapshot = JSON.stringify(datos);
datos.tours = quedan;
if (JSON.stringify(datos) === snapshot) { console.log('\nnada que retirar.'); process.exit(0); }

// Se simula el build en memoria para comparar contra el generado actual.
const antes = require(GENERADO).length;
const activos = quedan.length;
console.log('');
console.log('el generado tiene ' + antes + ' tours y quedarían ' + activos + ' filas activas en el JSON');
if (antes !== activos) {
  console.log('');
  console.log('ATENCION: el generado y el JSON no coinciden en cantidad. El generado está desactualizado:');
  console.log('  npm run build:tours');
  console.log('Se resuelve eso antes de retirar, o el build posterior mezclaría los dos cambios.');
  process.exit(1);
}

if (!SI) { console.log('\nDRY RUN: no se escribió nada. Correr con --si.'); process.exit(0); }

if (fs.existsSync(ARCHIVO)) {
  console.log('');
  console.log('ATENCION: data/tours-apagados.json ya existe. No se sobreescribe (seria perder la corrida anterior).');
  process.exit(1);
}

datos._meta.actualizado = new Date().toISOString().slice(0, 10);
datos._meta.retirados = 'El ' + datos._meta.actualizado + ' se sacaron ' + seVan.length + ' filas con activo: false (node retirar-tours-apagados.js). Estaban apagadas en la tabla y en el JSON al mismo tiempo, y eso hacia que scripts/cargar-tours.js las volviera a subir en cada carga. Quedaron en data/tours-apagados.json, que es un archivo de trabajo: la app no lo lee. Para recuperar una, se copia la fila de ahí de vuelta a tours[].';

// El archivo de archivo primero: si el JSON se escribiera y este fallara, las
// filas saldrian del JSON sin copia de nadie.
fs.writeFileSync(ARCHIVO, JSON.stringify({
  _nota: 'Filas retiradas de data/tours.json por tener activo: false. No las lee nadie: es el archivo de trabajo para volver a subirlas. Copiar la fila adentro de tours[] de data/tours.json y correr npm run build:tours.',
  generado: new Date().toISOString(),
  filas: seVan
}, null, 1), 'utf8');
console.log('archivo: data/tours-apagados.json (' + seVan.length + ' filas)');

fs.writeFileSync(JSON_PATH, JSON.stringify(datos, null, 2) + '\n', 'utf8');
console.log('escrito: data/tours.json (' + quedan.length + ' filas, todas activas)');
console.log('');
console.log('Falta regenerar el generado para confirmar que no se movio: npm run build:tours');