/* Comprueba que las aserciones muerden: se mete un bug a proposito y se espera
   que la prueba falle. Si pasa, la asercion no esta mirando lo que dice mirar.

   No escribe nada al final: parte de una copia en memoria y restaura app.js
   despues de cada mutacion. */
const fs = require('fs');
const { execFileSync } = require('child_process');
const raiz = 'C:/Users/mpbl2/AppData/Local/Temp/opencode/wt-combo/';
const app = raiz + 'public/app.js';
const prueba = raiz + 'prueba-pares.js';
const orig = fs.readFileSync(app, 'utf8');
const pruebaOrig = fs.readFileSync(prueba, 'utf8');

const MUTACIONES = [
  ['secondKey equivocado',
    "{ label: 'Búzios + Cabo Frio', key: 'buz', secondKey: 'cabo' }",
    "{ label: 'Búzios + Cabo Frio', key: 'buz', secondKey: 'arraial' }"],
  ['par repetido en el grupo',
    "{ label: 'Arraial do Cabo + Cabo Frio', key: 'arraial', secondKey: 'cabo' }",
    "{ label: 'Arraial do Cabo + Cabo Frio', key: 'arraial', secondKey: 'cabo' },\r\n      { label: 'Arraial do Cabo + Cabo Frio', key: 'arraial', secondKey: 'arraial' }"],
  ['par repetido en el desplegable',
    "{ label: 'Natal + Pipa', key: 'nat', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Natal + Pipa' }",
    "{ label: 'Natal + Pipa', key: 'nat', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Natal + Pipa' },\r\n      { label: 'Natal + Pipa', key: 'nat', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Natal + Pipa' }"],
  ['secondKey que no existe',
    "{ label: 'Natal + Pipa', key: 'nat', secondKey: 'pip' }",
    "{ label: 'Natal + Pipa', key: 'nat', secondKey: 'noexiste' }"],
  ['par sin segunda parada',
    "{ label: 'Natal + Pipa', key: 'nat', secondKey: 'pip' }",
    "{ label: 'Natal + Pipa', key: 'nat' }"],
  ['la primera parada es su propia segunda',
    "{ label: 'Natal + Pipa', key: 'nat', secondKey: 'pip' }",
    "{ label: 'Natal + Pipa', key: 'nat', secondKey: 'nat' }"],
  ['el nombre no corresponde al secondKey',
    "{ label: 'Maragogi + Maceió', key: 'maragogi', secondKey: 'mcz' }",
    "{ label: 'Maragogi + Maceió', key: 'maragogi', secondKey: 'rec' }"],
  ['el par no esta en el desplegable',
    "{ label: 'Porto Seguro + Itacaré', key: 'portoseguro', secondKey: 'itacare' }", ''],
  ['el par no esta en la subcategoria',
    "{ label: 'Torres + Capão da Canoa', key: 'torres', codes: 'POA', subcategory: 'Torres + Capão da Canoa' }", ''],
  ['el mismo destino en las dos mitades',
    "{ label: 'Torres + Capão da Canoa', key: 'torres', secondKey: 'canoa' }",
    "{ label: 'Torres + Capão da Canoa', key: 'torres', secondKey: 'torres' }"]
];

let fallos = 0;
// execFileSync solo lanza si la prueba falla; cuando pasa no hay nada que
// capturar salvo que se le pida el stdout, asi que se lo pide siempre.
const correr = () => {
  const r = execFileSync('node', [prueba], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return r || '';
};

// Primero, sin mutar, la prueba tiene que pasar. Si ya falla, los resultados de
// abajo no dicen nada.
const limpio = correr();
if (/FALLA/.test(limpio)) {
  console.log('ABORTO: la prueba ya falla sin mutar nada');
  console.log(limpio.split(/\r?\n/).filter(x => /FALLA/.test(x)).join('\n'));
  process.exit(1);
}
console.log('sin mutar: pasa (' + (limpio.match(/^ {2}OK {3}/gm) || []).length + ' aserciones)');

try {
  for (const [nombre, buscar, poner] of MUTACIONES) {
    if (orig.split(buscar).length - 1 !== 1) {
      console.log('  ?  ' + nombre.padEnd(40) + 'el texto a mutar aparece ' + (orig.split(buscar).length - 1) + ' veces');
      fallos++;
      continue;
    }
    fs.writeFileSync(app, orig.replace(buscar, poner), 'utf8');
    let salida = '';
    try { salida = correr(); }
    catch (e) { salida = (e.stdout || '') + (e.stderr || ''); }
    // Se restaura antes de comparar: si se comparara ahora, la diferencia seria
    // la mutacion que se acaba de poner, no un cambio de la prueba.
    fs.writeFileSync(app, orig, 'utf8');
    const intacta = fs.readFileSync(app, 'utf8') === orig;
    if (!intacta) { console.log('  !  ' + nombre + ': la prueba MODIFICO app.js'); fallos++; }
    const atrapado = /FALLA/.test(salida);
    const cuantos = (salida.match(/FALLA/g) || []).length;
    console.log('  ' + (atrapado ? 'OK   ' : 'FALLA ') + nombre.padEnd(40)
      + (atrapado ? 'la ven ' + cuantos + ' asercion(es)' : 'NO la ve: debil'));
    if (!atrapado) fallos++;
  }
} finally {
  fs.writeFileSync(app, orig, 'utf8');
  fs.writeFileSync(prueba, pruebaOrig, 'utf8');
}

console.log('');
console.log('app.js restaurado: ' + (fs.readFileSync(app, 'utf8') === orig));
console.log(fallos ? fallos + ' problemas' : 'las ' + MUTACIONES.length + ' mutaciones se detectan');
process.exit(fallos ? 1 : 0);
