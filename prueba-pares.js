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
/* Saca una función del fuente de app.js por nombre. Se usa para EVALUAR el
   código real y no una copia: una copia puede quedar vieja y el test pasa igual
   mientras la app está rota, que es el peor resultado posible para un test de
   este tipo.

   Brace matching a mano: las funciones que se evalúan acá no tienen llaves
   adentro de un string, asi que contar {} alcanza y no hace falta traer un
   parser. */
function extraer(nombre) {
  const desde = app.indexOf('function ' + nombre + '(');
  if (desde < 0) return null;
  let nivel = 0;
  for (let j = app.indexOf('{', desde); j < app.length; j++) {
    if (app[j] === '{') nivel++;
    else if (app[j] === '}') { nivel--; if (nivel === 0) return app.slice(desde, j + 1); }
  }
  return null;
}
const gHub = bloque(app, 'var DESTINATION_HUBS = [', '\n  ];');
const gGrupos = bloque(app, 'var DESTINATION_GROUPS = [', '\n  ];');
// Cuantos grupos hay, contado del fuente. Ver la comprobacion que lo usa: el
// numero estaba escrito a mano y ya no coincidia con la app.
const GRUPOS_ESPERADOS = [...gGrupos.matchAll(/\{ id: '[^']+', label: '[^']*', image: '[^']*', keys: \[/g)].length;

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
// Jericoacoara se sumo cuarta porque el par se llama "Fortaleza + Jeri": el
// nombre completo son 12 letras mas y en una fila de menu compite con el precio.
const CORTO = { rio: 'Río', ssa: 'Salvador', for: 'Fortaleza', jericoacoara: 'Jeri' };
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
  const clavesPorGrupo = new Map();
  for (const m of gGrupos.matchAll(/\{ id: '([^']+)', label: '[^']*', image: '[^']*', keys: \[([^\]]*)\], subcategories: \[/g)) {
    const claves = [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
    for (const k of claves) grupoDe.set(k, m[1]);
    clavesPorGrupo.set(m[1], claves);
  }
  console.log('   grupos leidos: ' + new Set(grupoDe.values()).size + ', destinos: ' + grupoDe.size);
  // El numero de grupos no se escribe a mano: se cuenta sobre DESTINATION_GROUPS.
  // Estaba en 11 y hacia tiempo que son mas, asi que la comprobacion fallaba por
  // un numero viejo y no por un grupo roto, que es peor: entrena a leer el rojo
  // como ruido.
  check('se leen todos los grupos', new Set(grupoDe.values()).size === GRUPOS_ESPERADOS,
    new Set(grupoDe.values()).size + ' grupos, esperados ' + GRUPOS_ESPERADOS);
  check('todos los destinos de un par pertenecen a un grupo',
    [...segundaDe.keys()].every(k => grupoDe.has(segundaDe.get(k).a) && grupoDe.has(segundaDe.get(k).b)),
    [...segundaDe.keys()].filter(k => !grupoDe.has(segundaDe.get(k).a) || !grupoDe.has(segundaDe.get(k).b)).join(', '));

  // Un par cruza grupos cuando sus dos paradas no estan en el mismo. Son dos
  // motivos y ninguno es descuido.
  //
  // Rio: es un grupo de una sola clave pero su hub (GIG) sirve todo el corredor,
  // asi que Búzios, Arraial, Cabo Frio, Paraty, Ilha Grande y Angra se toman con
  // el mismo vuelo redondo. Antes solo estaban Búzios y Angra y los otros cuatro
  // quedaban sin poder combinar con la capital.
  //
  // Jericoacoara: quedo en un grupo propio (esta a 358 km de Fortaleza y a mas de
  // 1.100 de Recife, asi que no es un Nordeste mas) y los tres pares que si se
  // pueden hacer quedan en el Nordeste, que es el grupo de la primera parada.
  // O sea que si vuelve a cruzar, como los de Rio.
  const cruzan = [...segundaDe.entries()].filter(([, v]) => grupoDe.get(v.a) !== grupoDe.get(v.b))
    .map(([k]) => k.split('|')[0] + ' + ' + k.split('|')[1]);
  const cruzanRio = cruzan.filter(x => x.indexOf('rio + ') === 0);
  const cruzanJeri = cruzan.filter(x => x.indexOf('+ Jeri') >= 0);
  check('cruzan grupos solo Rio y Jericoacoara: ' + cruzan.length,
    cruzan.length === 9 && cruzanRio.length === 6 && cruzanJeri.length === 3, cruzan.join(', '));
  // Y los de Jeri son con las tres paradas del Nordeste que quedan a menos
  // de 1.100 km: Fortaleza, Natal y Pipa. Cualquier otro seria un par que el
  // server rechaza.
  check('Jeri combina solo con Fortaleza, Natal y Pipa',
    cruzanJeri.length === 3 && ['for', 'nat', 'pip'].every(k => cruzanJeri.some(x => x.indexOf(k + ' + ') === 0)),
    cruzanJeri.join(', '));
  // Y todos los de Rio tienen que seguir vuelo por el mismo hub: un par
  // Rio + Ubatuba (GRU) no es un vuelo redondo y no se puede ofrecer.
  const HUBS_RIO = ['buz', 'arraial', 'cabo', 'paraty', 'ilha', 'angra'];
  const conRio = [...segundaDe.entries()].filter(([, v]) => v.a === 'rio').map(([, v]) => v.b);
  check('Rio combina solo con destinos que vuelan por su hub: ' + HUBS_RIO.join(', '),
    conRio.length === HUBS_RIO.length && HUBS_RIO.every(k => conRio.includes(k)),
    conRio.join(', '));

  /* QUE HAY QUE TENER TODOS LOS PARES COMBINABLES DE UN GRUPO, Y NO C(n,2).
     Antes el total se comparaba contra la suma de C(n,2), que da por hecho que
     cualquier par de destinos de un mismo grupo se puede cotizar. No es asi, y
     el caso lo dio Jericoacoara: esta a 358 km de Fortaleza, asi que con ella
     se puede, pero a mas de 1.100 de Recife y Maceió, asi que no. Con el
     C(n,2) el total esperado era 8 pares mas de los que se pueden cotizar, y la
     unica forma de pasarlo era offering combinaciones que el server rechaza con
     un 400.

     Ahora la pregunta es la que importa y es la misma que se le hace al server:
     model.comboTransfer() devuelve null cuando el par no se puede hacer. Se
     cuentan los pares combinables de cada grupo y se verifica que esten TODOS
     en la lista. Un par que falta es exactamente el sintoma que reporto la
     gente: "Fortaleza -> Natal" existe y "Natal -> Fortaleza" no. */
  const existentes = new Set([...segundaDe.values()].map(v => v.a + '|' + v.b));
  const faltan = [];
  let combinables = 0;
  for (const [, claves] of clavesPorGrupo) {
    for (let i = 0; i < claves.length; i++) {
      for (let j = i + 1; j < claves.length; j++) {
        const t = model.comboTransfer(claves[j], claves[i], 1);
        if (!t) continue; // no se puede cotizar: no hace falta ofrecerlo
        combinables++;
        if (!existentes.has(claves[i] + '|' + claves[j])) faltan.push(claves[i] + ' + ' + claves[j]);
      }
    }
  }
  console.log('   pares combinables dentro de los grupos: ' + combinables + ', mas ' + cruzan.length + ' que cruzan');
  check('dentro de cada grupo estan TODOS los pares que se pueden cotizar', faltan.length === 0, faltan.join(' | '));
  // Y al reves: ningun par del listado puede ser incombinable. Si aparece uno,
  // la persona elige una combinacion y el server le responde que no.
  const imposibles = [...segundaDe.values()].filter(v => !model.comboTransfer(v.b, v.a, 1))
    .map(v => v.a + ' + ' + v.b);
  check('ningun par del listado es incombinable', imposibles.length === 0, imposibles.join(' | '));

  /* Un par de dos paradas que estan en el mismo lugar no es un par, y el filtro
     de distancia no lo ve: 0 km es una distancia valida. Balneário Camboriú y
     Camboriú estan a 270 metros, asi que el par pasaba el techo de 1.100 km y se
     ofrecia con un traslado de 0 dolares. El corte esta en COMBO_MIN_KM, y esta
     comprobacion existe para que siga ahi: si alguien lo sube, avisa.

     El piso es 3 km y no 20 porque hay pares cortos y de verdad: Trancoso y
     Arraial d'Ajuda son 15, Porto Seguro y Arraial 19. Con 20 el filtro se
     comia los tres. */
  const mismoPueblo = [];
  for (const v of segundaDe.values()) {
    const a = model.DEST_COORDS[v.a], b = model.DEST_COORDS[v.b];
    if (!a || !b) continue;
    const km = Math.round(model.haversineKm(a, b) * 1.45);
    if (km < 3) mismoPueblo.push(v.a + ' + ' + v.b + ' (' + km + ' km)');
  }
  check('ningun par del listado son el mismo pueblo', mismoPueblo.length === 0, mismoPueblo.join(' | '));

  check('el total es lo que dice la geografia: ' + (combinables + cruzan.length),
    subs.size === combinables + cruzan.length, 'hay ' + subs.size);
}

console.log('\n6b) El precio del tramo responde a la distancia');
{
  /* La app pone los km del tramo al lado de su precio, asi que el precio tiene
     que depender de esos km. No lo hacia: la formula era
     35 * (0,6 + 0,4 * (km/300)^0,6) y el 0,6 inicial era un piso tan alto que
     a 7 km el termino de distancia valia 0,11. Los 18 pares mas cortos del
     menu pagaban entre $12 y $25 por persona: trece dolares de diferencia en 31
     km, y la etiqueta decia algo que el numero no media.

     Ahora la curva va de un piso explicito (COMBO_TRANSFER_MIN_USD) al tope de
     un traslado de aeropuerto (COMBO_TRANSFER_FULL_USD) a 300 km. Estas
     comprobaciones existen para que los dos extremos no vuelvan a mentir. */
  const precioEn = (km) => {
    // mismo camino que comboTransfer, sin tener que buscar un par real
    const t = Math.pow(km / 300, 0.6);
    return Math.round(12 + (35 - 12) * t);
  };
  check('a 300 km sale lo que un traslado de aeropuerto', precioEn(300) === 35, precioEn(300) + ' vs 35');
  check('cerca de 0 km sale el piso', precioEn(0) === 12, precioEn(0) + ' vs 12');
  check('7 km y 37 km dan numeros distintos', precioEn(7) !== precioEn(37),
    '7 km = $' + precioEn(7) + ', 37 km = $' + precioEn(37));

  let anterior = 0, monotona = true;
  for (let km = 3; km <= 1100; km += 7) { const v = precioEn(km); if (v < anterior) monotona = false; anterior = v; }
  check('el precio crece con la distancia, sin saltos', monotona);

  // Y sobre los pares reales, que es donde se nota: el mas corto y el mas largo
  // del menu no pueden costar lo mismo.
  const conPrecio = [...segundaDe.values()]
    .map(v => ({ v, t: model.comboTransfer(v.b, v.a, 1) }))
    .filter(x => x.t)
    .sort((x, y) => x.t.distanceKm - y.t.distanceKm);
  const corto = conPrecio[0], largo = conPrecio[conPrecio.length - 1];
  check('el par mas corto del menu no cuesta lo mismo que el mas largo',
    corto.t.perPaxUsd !== largo.t.perPaxUsd,
    corto.v.a + ' + ' + corto.v.b + ' ($' + corto.t.perPaxUsd + ') contra ' +
    largo.v.a + ' + ' + largo.v.b + ' ($' + largo.t.perPaxUsd + ')');
}

console.log('\n7) El control de segunda parada ofrece los mismos pares');
{
  // El control "¿Sumás una segunda parada?" y el desplegable de Destino leen
  // los mismos DESTINATION_GROUPS, pero por caminos distintos: el control arma
  // su menú con comboGroups() y despues resuelve la segunda parada con
  // secondKeyForSubcategory(). Si uno de los dos deja de filtrar por secondKey,
  // la opción se sigue viendo pero abre un viaje de UNA sola parada: el error no
  // da error, cobras el precio de otra cosa. Por eso se evaluan las funciones
  // reales del archivo y no una copia (helper `extraer`, arriba).

  const DESTINATION_GROUPS = [...gGrupos.matchAll(/\{ id: '([^']+)', label: '((?:[^'\\]|\\.)*)', image: '[^']*', keys: \[[^\]]*\], subcategories: \[([\s\S]*?)\n    \] \}/g)]
    .map(g => ({
      id: g[1], label: g[2],
      subcategories: [...g[3].matchAll(/\{ label: '((?:[^'\\]|\\.)*)', key: '(\w+)'(?:, secondKey: '(\w+)')? \}/g)]
        .map(s => ({ label: s[1], key: s[2], secondKey: s[3] || '' }))
    }));

  const srcCombo = extraer('comboGroups');
  const srcSecond = extraer('secondKeyForSubcategory');
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

console.log('\n8) Las rutas funcionan en los DOS sentidos');
{
  /* El bug que se reporto: con Destino = Natal aparecia "Natal + Fortaleza" y
     con Destino = Fortaleza el menu se abria vacio con "Desde Fortaleza no hay
     combinaciones de dos paradas". Los pares se escriben una vez, en un orden, y
     el filtro miraba solo la primera parada, asi que el mismo viaje existia en
     un sentido y no en el otro.

     Se evaluan las funciones REALES de app.js —comboInvertido(), comboLabel(),
     comboPasaElFiltro()— con un S de mentira, y se comprueban las dos
     direcciones de cada par. Sin esto, volver a filtrar por `key` solo rompe en
     la pantalla: no hay error, no hay 400, la lista simplemente queda corta.

     No se corre en un navegador porque las tres funciones son puras sobre
     atributos: con un objeto que devuelva getAttribute, alcanzan. */
  const srcFiltra = extraer('comboFiltraPorDestino');
  const srcInvertido = extraer('comboInvertido');
  const srcLabel = extraer('comboLabel');
  const srcPasa = extraer('comboPasaElFiltro');
  check('comboFiltraPorDestino / comboInvertido / comboLabel / comboPasaElFiltro estan en app.js',
    !!srcFiltra && !!srcInvertido && !!srcLabel && !!srcPasa);

  if (srcFiltra && srcInvertido && srcLabel && srcPasa) {
    const S = { dest: 'todos' };
    const comboFiltraPorDestino = eval('(' + srcFiltra + ')');
    const comboInvertido = eval('(' + srcInvertido + ')');
    const comboLabel = eval('(' + srcLabel + ')');
    const comboPasaElFiltro = eval('(' + srcPasa + ')');

    const opcion = (key, second, label) => ({
      _k: key, _s: second,
      getAttribute: function (a) {
        return a === 'data-combo-key' ? key : a === 'data-combo-second' ? second : a === 'data-combo-sub' ? label : null;
      },
      hasAttribute: function (a) { return a === 'data-combo-clear' ? false : false; }
    });

    const pares = [...segundaDe.values()].map(v => ({ a: v.a, b: v.b, label: v.a + ' + ' + v.b }));

    let invisibles = 0, malNombre = 0, sinInvertir = 0, casos = 0;
    for (const p of pares) {
      const opt = opcion(p.a, p.b, p.label);
      for (const lado of [p.a, p.b]) {
        casos++;
        S.dest = lado;
        // 1. el par tiene que pasar el filtro con CUALQUIERA de sus dos paradas
        if (!comboPasaElFiltro(opt)) { invisibles++; continue; }
        // 2. si el destino elegido es la segunda parada, el par tiene que leerse
        //    al reves
        const invertido = lado === p.b && p.a !== p.b;
        if (comboInvertido(opt) !== invertido) sinInvertir++;
        // 3. y el nombre tiene que salir en el orden en que se va a cotizar
        const esperado = invertido ? p.b + ' + ' + p.a : p.label;
        if (comboLabel(opt) !== esperado) malNombre++;
      }
    }
    console.log('   comprobados ' + casos + ' sentidos de ' + pares.length + ' pares');
    check('todo par pasa el filtro con cualquiera de sus dos paradas', invisibles === 0, invisibles + ' sentidos sin offering');
    check('el par se marca como invertido solo si el destino es la segunda parada', sinInvertir === 0, sinInvertir + ' mal marcados');
    check('el nombre del par sale en el orden en que se va a cotizar', malNombre === 0, malNombre + ' nombres al reves de mas o de menos');

    // Y el caso del reporte, escrito literal, para que quede a la vista.
    S.dest = 'for';
    const forNat = opcion('nat', 'for', 'Natal + Fortaleza');
    check('con Destino = Fortaleza el par "Natal + Fortaleza" se ve como "Fortaleza + Natal"',
      comboPasaElFiltro(forNat) && comboInvertido(forNat) && comboLabel(forNat) === 'Fortaleza + Natal');
    S.dest = 'nat';
    check('con Destino = Natal el mismo par se ve como "Natal + Fortaleza"',
      comboPasaElFiltro(forNat) && !comboInvertido(forNat) && comboLabel(forNat) === 'Natal + Fortaleza');
  }

  // La eleccion tiene que llegar al server con las dos paradas en el orden
  // correcto. Si el nombre invertido se buscara en DESTINATION_GROUPS, no
  // existiria y el server cotizaria un viaje de UNA sola parada: el error no
  // da error, se cobra menos.
  const srcSel = extraer('selectDestination');
  check('selectDestination() recibe la segunda parada cuando el par va al reves',
    /function selectDestination\([^)]*secondKeyForzado/.test(app),
    'falta el quinto argumento');
  check('el par invertido se elige con la segunda parada del dato',
    /comboInvertido\(option\) \? option\.getAttribute\('data-combo-key'\) : undefined/.test(app),
    'chooseCombo() no invierte la segunda parada');
  check('selectDestination() respeta la segunda parada forzada',
    srcSel ? /secondKeyForzado != null/.test(srcSel) : false,
    'S.second se sigue deduciendo solo del nombre');
  check('"Un solo destino" decide por S.second y no por el nombre del par',
    /var eraPar = !!S\.second;/.test(app),
    'con un par invertido, secondKeyForSubcategory() daria vacio y no sacaria la segunda parada');
  // Y el menu tiene que llevar las dos paradas en atributos, si no el filtro no
  // tiene con que decidir.
  check('cada opcion del menu lleva data-combo-second',
    /data-combo-second="' \+ esc\(sub\.secondKey\) \+ '"/.test(app),
    'renderComboMenu() no escribe la segunda parada');
}

console.log(fallos.length ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ') : '\nTODO OK');
process.exit(fallos.length ? 1 : 0);
