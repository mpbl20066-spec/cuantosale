// Merger de guias: reemplaza o agrega una seccion de una guia.
//
// Por que es un script y no ediciones a mano: editar el .js a mano con este
// volumen de datos se rompió cuatro veces. Y por que valida antes de
// escribir: una de esas roturas dejo public/guias.js sin parsear.
//
//   node merger-guias.js <guia> <seccion> <archivo-de-items>
//
// El archivo de items exporta un objeto con una clave por seccion:
//   exports.beaches = [ { name: '...', ... } ];
//   node merger-guias.js santa-catarina beaches _sc.js
const fs = require('fs');
const path = require('path');

const [, , CLAVE, SECCION, ARCHIVO] = process.argv;
if (!CLAVE || !SECCION || !ARCHIVO) {
  console.error('uso: node merger-guias.js <guia> <seccion> <archivo-de-items>');
  process.exit(1);
}

const DESTINO = path.join(__dirname, 'public', 'guias.js');
const original = fs.readFileSync(DESTINO, 'utf8');

delete require.cache[require.resolve(path.resolve(ARCHIVO))];
const modulo = require(path.resolve(ARCHIVO));
const items = Array.isArray(modulo) ? modulo : modulo[SECCION];
if (!Array.isArray(items)) {
  console.error('el archivo de items no exporta un array en la clave "' + SECCION + '"');
  process.exit(1);
}

const lineas = original.split(/\r?\n/);

// --- localizar la guia emparejando llaves ---------------------------------
const lineaClave = new RegExp("^  '" + CLAVE + "': \\{");
const ini = lineas.findIndex(l => lineaClave.test(l));
if (ini < 0) { console.error('no se encontro la guia ' + CLAVE); process.exit(1); }

let nivel = 0, fin = -1;
for (let i = ini; i < lineas.length; i++) {
  // Las llaves y corchetes dentro de strings no cuentan. No es un parser,
  // pero el archivo tiene formato fijo y alcanza.
  const limpio = lineas[i].replace(/'[^']*'/g, "''");
  for (const ch of limpio) {
    if (ch === '{' || ch === '[') nivel++;
    else if (ch === '}' || ch === ']') nivel--;
  }
  if (nivel === 0 && i > ini) { fin = i; break; }
}
if (fin < 0) { console.error('no se cerro la guia ' + CLAVE); process.exit(1); }

// --- formatear los items como los del archivo ----------------------------
// { name: 'x', zona: 'y', usd: 3 } con comillas simples y espacio despues
// de cada coma, que es como esta escrito el resto.
function valor(v) {
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  return String(v);
}
const itemsTexto = items.map((it, i) => {
  const campos = Object.keys(it).map(k => k + ': ' + valor(it[k]));
  const cierre = i < items.length - 1 ? ',' : '';
  return '      { ' + campos.join(', ') + ' }' + cierre;
});
const bloque = ['    ' + SECCION + ': ['].concat(itemsTexto).concat(['    ]' + (items.length ? ',' : '')]);

// --- reemplazar o agregar -------------------------------------------------
// Matchea `seccion: [` con cualquier contenido. Buscar solo `seccion: []`
// caia en lo contrario: se agregaba una segunda clave con el mismo nombre en
// vez de reemplazar. El objeto parseaba, pero la clave vieja quedaba y la
// nueva la pisaba en silencio.
const reSeccion = new RegExp('^    ' + SECCION + ': \\[$');
let a = -1;
for (let i = ini; i <= fin; i++) if (reSeccion.test(lineas[i])) { a = i; break; }

let salida;
if (a >= 0) {
  // Reemplazar el array existente.
  let c = a + 1, depth = 1;
  for (let i = a + 1; i <= fin; i++) {
    const limpio = lineas[i].replace(/'[^']*'/g, "''");
    for (const ch of limpio) { if (ch === '[') depth++; else if (ch === ']') depth--; }
    if (depth === 0) { c = i; break; }
  }
  salida = lineas.slice(0, a).concat(bloque).concat(lineas.slice(c + 1));
  console.log('  ' + SECCION + ': reemplazada (' + items.length + ')');
} else {
  // Agregar justo antes del cierre de la guia. La linea anterior al cierre
  // tiene que quedar con coma, o el objeto queda sin separar.
  const previo = fin - 1;
  if (!/,\s*$/.test(lineas[previo])) lineas[previo] = lineas[previo] + ',';
  salida = lineas.slice(0, fin).concat(bloque).concat(lineas.slice(fin));
  console.log('  ' + SECCION + ': agregada (' + items.length + ')');
}

// --- validar antes de escribir -------------------------------------------
const nuevo = salida.join('\n');
try {
  new Function(nuevo.replace(/^'use strict';/, '').replace(/\bwindow\./g, 'globalThis.'));
} catch (e) {
  console.error('\nNO SE ESCRIBIO NADA: el resultado no parsea.');
  console.error('  ' + e.message);
  process.exit(1);
}
fs.writeFileSync(DESTINO, nuevo, 'utf8');
console.log('escrito: public/guias.js');
