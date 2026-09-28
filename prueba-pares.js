/* Que los 88 pares de dos paradas resuelvan a una segunda parada real, y que el
   nombre que se muestra sea el del viaje que se esta cotizando.

   Reproduce la logica de secondKeyForSubcategory() contra los archivos reales y
   ademas le pide el precio a la API como lo haria el navegador. Un par que no
   resuelve, o que la API rechaza, es un par que el usuario elige y no pasa nada.

   El punto 3 es el que atrapo el bug de plata: "Buzios + Cabo Frio" tenia
   secondKey 'arraial', asi que cotizaba Buzios -> Arraial do Cabo con el nombre
   de Cabo Frio. Las otras dos verificaciones pasaban, porque solo preguntaban si
   el secondKey existia, no si era el que decia el nombre. */
const fs = require('fs');
const raiz = __dirname.replace(/\\/g, '/') + '/';
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

// Los pares que ofrece el desplegable. Los grupos del patron son 1=label,
// 2=key, 3=subcategory.
const ops = [...gHub.matchAll(/\{ label: '((?:[^'\\]|\\.)* \+ (?:[^'\\]|\\.)*)', key: '(\w+)', codes: '[^']*', subcategory: '((?:[^'\\]|\\.)*)' \}/g)]
  .map(m => ({ label: m[1], key: m[2], sub: m[3] }));
// Las subcategorias de par. La clave es "primeraParada|nombre", que es como
// secondKeyForSubcategory() las busca: compara el label y la key, y el secondKey
// es el valor. Antes la armaba invertida y por eso daba 88 "SIN RESOLVER".
const subs = new Map();
for (const m of gGrupos.matchAll(/\{ label: '((?:[^'\\]|\\.)* \+ (?:[^'\\]|\\.)*)', key: '(\w+)', secondKey: '(\w+)' \}/g)) {
  subs.set(m[2] + '|' + m[1], m[3]);
}
// La clave de subs es "primera|nombre" y el nombre ya trae el " + " adentro, as
// que no se puede recuperar la segunda parada partiendola: hace falta aparte.
const segundaDe = new Map();
for (const m of gGrupos.matchAll(/\{ label: '((?:[^'\\]|\\.)* \+ (?:[^'\\]|\\.)*)', key: '(\w+)', secondKey: '(\w+)' \}/g)) {
  segundaDe.set(m[2] + '|' + m[1], { a: m[2], b: m[3] });
}

// El nombre que lleva cada destino dentro de un par.
//
// Sale de las opciones sueltas de los hubs, que si son nombres de destino
// ("Búzios", "Balneário Camboriú"). No puede salir de las subcategorias de los
// grupos, porque esas son zonas: la de Búzios es "Sólo Búzios" y la de Cabo
// Frio es "Ruta de Playas (Cabo Frio)", y con esa tabla el punto 3 daba 23
// falsos positivos.
//
// Se les saca el agregado de zona: "Río de Janeiro (Centro / Sur)" es "Río de
// Janeiro", "Arraial d'Ajuda / Trancoso" es "Arraial d'Ajuda".
function sinZona(s) {
  return s.split(' (')[0].split(' / ')[0];
}
const NOM = new Map();
for (const m of gHub.matchAll(/\{ label: '((?:[^'\\]|\\.)*)', key: '(\w+)'/g)) {
  if (m[1].indexOf(' + ') >= 0) continue;
  if (!NOM.has(m[2])) NOM.set(m[2], sinZona(m[1]));
}
// Rio, Salvador y Fortaleza van cortos en los pares porque en el nombre del par
// se leen mejor. Son las tres excepciones, y estan aca a proposito: si alguien
// las cambia en los pares, el punto 3 avisa.
const CORTO = { rio: 'Río', ssa: 'Salvador', for: 'Fortaleza' };
for (const k in CORTO) if (NOM.has(k)) NOM.set(k, CORTO[k]);
// Gramado tiene dos subcategorias ("Centro" y "Vale dos Vinhedos") pero es un
// destino solo, asi que el par usa el nombre a secas.
if (NOM.has('gram')) NOM.set('gram', 'Gramado');
console.log('nombres de destino conocidos: ' + NOM.size);

console.log('\n1) Los ' + ops.length + ' pares del desplegable resuelven a una segunda parada');
const sinResolver = [];
for (const o of ops) {
  const second = subs.get(o.key + '|' + o.sub);
  if (!second) sinResolver.push(o.label);
  check(o.label.padEnd(40) + ' -> ' + (second || 'SIN RESOLVER'), !!second);
}
check('ninguno queda sin resolver', sinResolver.length === 0, sinResolver.join(', '));

console.log('\n2) Los nombres del desplegable y de la subcategoria coinciden');
{
  const huerfanos = ops.filter(o => !subs.has(o.key + '|' + o.sub));
  check('toda opcion tiene su subcategoria con el mismo nombre', huerfanos.length === 0,
    huerfanos.map(o => o.sub).join(', '));
  const alReves = [...subs.keys()].filter(k => !ops.some(o => o.key + '|' + o.sub === k));
  check('toda subcategoria tiene su opcion en el desplegable', alReves.length === 0, alReves.join(', '));
  const dup = ops.map(o => o.key + '|' + o.sub).filter((x, i, A) => A.indexOf(x) !== i);
  check('ningun par esta dos veces en el desplegable', dup.length === 0, [...new Set(dup)].join(', '));
  // Y lo mismo en las subcategorias, que es donde estaba el bug: dos
  // subcategorias con el mismo nombre y la segunda sin secondKey.
  // secondKeyForSubcategory() corta en la primera coincidencia, asi que la
  // segunda era inalcanzable y la que ganaba no llevaba segunda parada.
  const subLabels = [...gGrupos.matchAll(/\{ label: '((?:[^'\\]|\\.)* \+ (?:[^'\\]|\\.)*)', key: '(\w+)'/g)]
    .map(m => m[2] + '|' + m[1]);
  const dupSub = subLabels.filter((x, i, A) => A.indexOf(x) !== i);
  check('ninguna subcategoria de par esta repetida', dupSub.length === 0, [...new Set(dupSub)].join(', '));
  // Un par no puede repetir la misma parada en las dos mitades del nombre.
  const mismo = [...subs.keys()].filter(k => {
    const p = k.split('|')[1].split(' + ');
    return p.length === 2 && p[0] === p[1];
  });
  check('ningun par repite la misma parada', mismo.length === 0, mismo.join(', '));
}

console.log('\n3) El nombre del par dice el viaje que se cotiza');
{
  // Esta es la que atrapa el bug de Cabo Frio: no basta con que el secondKey
  // exista, tiene que ser el que dice la segunda mitad del nombre.
  const malos = [], sinNombre = [];
  for (const [k, second] of subs) {
    const label = k.split('|')[1], key = k.split('|')[0];
    const partes = label.split(' + ');
    if (partes.length !== 2) { malos.push(label + ' -> el nombre no tiene dos paradas'); continue; }
    if (!NOM.has(key) || !NOM.has(second)) { sinNombre.push(label + ' (' + (NOM.has(key) ? key : '?') + '/' + (NOM.has(second) ? second : '?') + ')'); continue; }
    if (partes[0] !== NOM.get(key) || partes[1] !== NOM.get(second)) {
      malos.push(label + ' -> key ' + key + ' + second ' + second + '  (el nombre dice "' + partes.join(' / ') + '")');
    }
  }
  check('los ' + subs.size + ' nombres coinciden con sus secondKey', malos.length === 0, malos.join(' | '));
  check('todo destino de un par tiene nombre conocido', sinNombre.length === 0, sinNombre.join(', '));
}

console.log('\n4) Cada segunda parada esta en el modelo y es combinable');
{
  const malos = [];
  for (const [k, second] of subs) {
    const label = k.split('|')[1], key = k.split('|')[0];
    if (!model.DEST[second]) { malos.push(label + ' -> ' + second + ' no existe en DEST'); continue; }
    if (!model.comboTransfer(second, key, 1)) malos.push(label + ' -> la API lo rechaza (distancia)');
  }
  check('los ' + subs.size + ' pares cotizan', malos.length === 0, malos.length + ': ' + malos.join(' | '));
}

console.log('\n5) Ningun par se combina consigo mismo');
{
  const raros = [...subs.entries()].filter(([k, s]) => s === k.split('|')[0]);
  check('nadie es su propia segunda parada', raros.length === 0, raros.map(r => r[0]).join(', '));
}

console.log('\n6) Los ' + subs.size + ' salen de los grupos, no de una lista a mano');
{
  // A que grupo pertenece cada destino. Se matchea el encabezado entero del
  // grupo: el id, la etiqueta y las claves estan en la misma linea, asi que
  // buscarlo hacia atras desde "keys" no encuentra nada.
  const grupoDe = new Map();
  let posible = 0;
  for (const m of gGrupos.matchAll(/\{ id: '([^']+)', label: '[^']*', image: '[^']*', keys: \[([^\]]*)\], subcategories: \[/g)) {
    const claves = [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
    for (const k of claves) grupoDe.set(k, m[1]);
    posible += claves.length * (claves.length - 1) / 2;
  }
  console.log('   grupos leidos: ' + new Set(grupoDe.values()).size + ', destinos: ' + grupoDe.size + ', C(n,2) suma ' + posible);
  check('se leen los 10 grupos', new Set(grupoDe.values()).size === 10, new Set(grupoDe.values()).size + ' grupos');
  check('todos los destinos de un par pertenecen a un grupo',
    [...segundaDe.keys()].every(k => grupoDe.has(segundaDe.get(k).a) && grupoDe.has(segundaDe.get(k).b)),
    [...segundaDe.keys()].filter(k => !grupoDe.has(segundaDe.get(k).a) || !grupoDe.has(segundaDe.get(k).b)).join(', '));

  // Un par cruza grupos cuando sus dos paradas no estan en el mismo. Solo los
  // tiene Rio, y no por descuido: Rio es un grupo de una sola clave pero su hub
  // (GIG) sirve todo el corredor, asi que Búzios, Arraial, Cabo Frio, Paraty,
  // Ilha Grande y Angra se toman con el mismo vuelo redondo. Antes solo estaban
  // Búzios y Angra y los otros cuatro quedaban sin poder combinar con la capital.
  const cruzan = [...segundaDe.entries()].filter(([, v]) => grupoDe.get(v.a) !== grupoDe.get(v.b))
    .map(([k]) => k.split('|')[0] + ' + ' + k.split('|')[1]);
  check('cruzan grupos solo ' + cruzan.length + ': ' + cruzan.join(', '),
    cruzan.length === 6 && cruzan.every(x => x.indexOf('rio + ') === 0), cruzan.join(', '));
  // Y todos tienen que seguir vuelo por el mismo hub: un par Rio + Ubatuba
  // (GRU) no es un vuelo redondo y no se puede ofrecer.
  const HUBS_RIO = ['buz', 'arraial', 'cabo', 'paraty', 'ilha', 'angra'];
  const conRio = [...segundaDe.entries()].filter(([, v]) => v.a === 'rio').map(([, v]) => v.b);
  check('Rio combina solo con destinos que vuelan por su hub: ' + HUBS_RIO.join(', '),
    conRio.length === HUBS_RIO.length && HUBS_RIO.every(k => conRio.includes(k)),
    conRio.join(', '));
  check('el total es C(n,2) de los grupos mas los ' + cruzan.length + ' de Rio: ' + (posible + cruzan.length),
    subs.size === posible + cruzan.length, 'hay ' + subs.size + ', C(n,2) suma ' + posible);
}

console.log('\n7) El control de segunda parada ofrece los mismos pares');
{
  // El control "¿Sumás una segunda parada?" y el desplegable de Destino leen
  // los mismos DESTINATION_GROUPS, pero por caminos distintos: el control arma
  // su menú con comboGroups() y despues resuelve la segunda parada con
  // secondKeyForSubcategory(). Si uno de los dos deja de filtrar por secondKey,
  // la opción se sigue viendo pero abre un viaje de UNA sola parada: el error no
  // da error, cobras el precio de otra cosa. Por eso se evaluan las funciones
  // reales del archivo y no una copia.
  //
  // Brace matching a mano: ninguna de las dos tiene llaves dentro de un string,
  // asi que contar {} alcanza y no hace falta traer un parser.
  function extraerFuncion(nombre) {
    const desde = app.indexOf('function ' + nombre + '(');
    if (desde < 0) return null;
    let nivel = 0;
    for (let j = app.indexOf('{', desde); j < app.length; j++) {
      if (app[j] === '{') nivel++;
      else if (app[j] === '}') { nivel--; if (nivel === 0) return app.slice(desde, j + 1); }
    }
    return null;
  }

  const DESTINATION_GROUPS = [...gGrupos.matchAll(/\{ id: '([^']+)', label: '((?:[^'\\]|\\.)*)', image: '[^']*', keys: \[[^\]]*\], subcategories: \[([\s\S]*?)\n    \] \}/g)]
    .map(g => ({
      id: g[1], label: g[2],
      subcategories: [...g[3].matchAll(/\{ label: '((?:[^'\\]|\\.)*)', key: '(\w+)'(?:, secondKey: '(\w+)')? \}/g)]
        .map(s => ({ label: s[1], key: s[2], secondKey: s[3] || '' }))
    }));

  const srcCombo = extraerFuncion('comboGroups');
  const srcSecond = extraerFuncion('secondKeyForSubcategory');
  check('comboGroups() esta en app.js', !!srcCombo);
  check('secondKeyForSubcategory() esta en app.js', !!srcSecond);
  if (!srcCombo || !srcSecond) throw new Error('faltan las funciones del control');

  const comboGroups = eval('(' + srcCombo + ')');
  const secondKeyForSubcategory = eval('(' + srcSecond + ')');

  const entradas = comboGroups();
  const opciones = entradas.reduce((n, e) => n + e.pairs.length, 0);
  console.log('   regiones: ' + entradas.length + ', pares: ' + opciones);
  check('el control ofrece los ' + subs.size + ' pares', opciones === subs.size, opciones + ' pares');

  // Cada opcion tiene que resolver a la MISMA segunda parada que la declara la
  // subcategoria: es el dato que viaja en ?second= y el que decide el precio.
  const sinResolver = [], conSecondDistinto = [];
  for (const entrada of entradas) {
    for (const sub of entrada.pairs) {
      const second = secondKeyForSubcategory(sub.label, sub.key);
      if (!second) sinResolver.push(sub.label);
      else if (second !== sub.secondKey) conSecondDistinto.push(sub.label + ' -> ' + second + ' en vez de ' + sub.secondKey);
    }
  }
  check('ninguna opcion queda sin segunda parada', sinResolver.length === 0, sinResolver.slice(0, 5).join(', '));
  check('cada opcion resuelve la segunda parada que declara', conSecondDistinto.length === 0, conSecondDistinto.slice(0, 5).join(', '));

  // Un par no puede aparecer en dos regiones: el menú los muestra por región y
  // duplicado es un par que se ofrece dos veces.
  const repetidos = new Map();
  for (const e of entradas) for (const p of e.pairs) repetidos.set(p.label, (repetidos.get(p.label) || 0) + 1);
  const duplos = [...repetidos.entries()].filter(([, n]) => n > 1).map(([l]) => l);
  check('ningun par aparece dos veces', duplos.length === 0, duplos.join(', '));

  const html = fs.readFileSync(raiz + 'public/index.html', 'utf8');
  const css = fs.readFileSync(raiz + 'public/style.css', 'utf8');
  check('index.html tiene el control #combo', html.indexOf('id="combo"') >= 0 && html.indexOf('id="combo-menu"') >= 0);
  check('el control es un campo del formulario, no una seccion',
    html.indexOf('combo-field') >= 0 && html.indexOf('id="combo"') < html.indexOf('id="btn-buscar-todos"'),
    'el control tiene que estar antes del boton de buscar');
  check('no quedo la seccion de pares que se habia descartado',
    html.indexOf('trip-combos') < 0 && app.indexOf('trip-combos') < 0 && css.indexOf('.trip-combos') < 0);
  check('el menu se arma con renderComboMenu() al arrancar',
    app.indexOf('renderComboMenu();') > app.indexOf('function renderComboMenu'));
  check('el precio de un par depende de las noches: el menu no muestra numeros',
    !/class="custom-select__option"[\s\S]{0,600}?money\(/.test(app),
    'renderComboMenu() usa money()');

  // Sin esto, elegir el par por el desplegable de Destino dejaba el control de
  // segunda parada mostrando un par viejo: los dos ofrecen lo mismo y tienen que
  // verse iguales.
  check('elegir por cualquiera de los dos lados sincroniza el otro',
    app.indexOf('syncComboDisplay();') > app.indexOf('function selectDestination'),
    'selectDestination() tiene que llamar a syncComboDisplay()');
}

console.log(fallos.length ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ') : '\nTODO OK');
process.exit(fallos.length ? 1 : 0);
