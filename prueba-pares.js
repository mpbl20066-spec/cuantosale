/* Que los 26 pares del desplegable resuelvan a una segunda parada real.
   Reproduce la logica de secondKeyForSubcategory() contra los archivos reales, y
   ademas le pide el precio a la API como lo haria el navegador. Un par que no
   resuelve, o que la API rechaza, es un par que el usuario elige y no pasa nada. */
const fs = require('fs');
const raiz = 'C:/Users/mpbl2/AppData/Local/Temp/opencode/wt-combo/';
const app = fs.readFileSync(raiz + 'public/app.js', 'utf8');
const model = require(raiz + 'lib/model.js');

const fallos = [];
function check(n, cond, d) {
  console.log((cond ? '  OK   ' : '  FALLA ') + n);
  if (!cond) fallos.push(n + (d ? ' -> ' + d : ''));
}

const bloque = (txt, desde, hasta) => txt.slice(txt.indexOf(desde), txt.indexOf(hasta, txt.indexOf(desde)));
const gHub = bloque(app, 'var DESTINATION_HUBS = [', '\n  ];');
const gGrupos = bloque(app, 'var DESTINATION_GROUPS = [', '\n  ];');

// Los pares que ofrece el desplegable
const ops = [...gHub.matchAll(/\{ label: '([^']+ \+ [^']+)', key: '(\w+)', codes: '[^']+', subcategory: '([^']+)' \}/g)]
  .map(m => ({ label: m[1], key: m[2], sub: m[3] }));
// Las subcategorias de par. La clave es "primeraParada|nombre", que es como
// secondKeyForSubcategory() las busca: compara el label y la key, y el secondKey
// es el valor. Antes la armaba invertida y por eso daba 26 "SIN RESOLVER".
const subs = new Map();
for (const m of gGrupos.matchAll(/\{ label: '([^']+ \+ [^']+)', key: '(\w+)', secondKey: '(\w+)' \}/g)) {
  subs.set(m[2] + '|' + m[1], m[3]);
}

console.log('1) Los 26 pares del desplegable resuelven a una segunda parada');
const sinResolver = [];
for (const o of ops) {
  const second = subs.get(o.key + '|' + o.sub);
  if (!second) sinResolver.push(o.label);
  check(o.label.padEnd(38) + ' -> ' + (second || 'SIN RESOLVER'), !!second);
}
check('ninguno queda sin resolver', sinResolver.length === 0, sinResolver.join(', '));

console.log('\n2) Los nombres del desplegable y de la subcategoria coinciden');
{
  const labelsSub = new Set([...gGrupos.matchAll(/\{ label: '([^']+ \+ [^']+)', key: '\w+', secondKey/g)].map(m => m[1]));
  const huerfanos = ops.filter(o => !labelsSub.has(o.sub));
  check('toda opcion tiene su subcategoria con el mismo nombre', huerfanos.length === 0,
    huerfanos.map(o => o.sub).join(', '));
}

console.log('\n3) Cada segunda parada esta en el modelo y es combinable');
{
  const malos = [];
  for (const o of ops) {
    const second = subs.get(o.key + '|' + o.sub);
    if (!second) continue;
    if (!model.DEST[second]) { malos.push(o.label + ' -> ' + second + ' no existe'); continue; }
    if (!model.comboTransfer(second, o.key, 1)) malos.push(o.label + ' -> la API lo rechaza');
  }
  check('los 26 pares cotizan', malos.length === 0, malos.join(' | '));
}

console.log('\n4) Ningun par se combina consigo mismo');
{
  const raros = ops.filter(o => { const s = subs.get(o.key + '|' + o.sub); return s && s === o.key; });
  check('nadie es su propia segunda parada', raros.length === 0, raros.map(r => r.label).join(', '));
}

console.log(fallos.length ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ') : '\nTODO OK');
process.exit(fallos.length ? 1 : 0);
