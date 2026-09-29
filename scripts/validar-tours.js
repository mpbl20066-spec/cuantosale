'use strict';
/*
 * Valida data/tours.json y su copia generada.
 *
 *   node scripts/validar-tours.js
 *
 * Lo que mira, en orden de importancia:
 *
 *   1. Que public/tours.generated.js exista y tenga el mismo contenido que
 *      data/tours.json. Si divergen, alguien edito el generado a mano o se
 *     olvido de correr el build, y en el proximo deploy se publica la version
 *      vieja.
 *
 *   2. Que index.html cargue el generado ANTES de app.js. Con los dos scripts
 *      en defer, el orden del HTML es el orden de ejecucion: si tours va
 *      despues, app.js lee window.CS_TOURS_DATA cuando todavia no existe, ve
 *      undefined y deja la seccion de tours vacia sin error visible.
 *
 *   3. Que sw.js lo precachee, por el mismo motivo que los otros generados.
 *
 *   4. Que ningun tour quede apuntando a un destino que lib/model.js no
 *      conoce. NO es un error de build: un key desconocido no rompe nada, el
 *      tour simplemente no se dibuja. Pero es un tour que alguien escribio y
 *      nunca va a ver, y eso hay que reportarlo.
 *
 *   5. Que los titulos de los tours con foto en TOUR_PHOTOS sigan matcheando.
 *      La clave es 'destinoKey#Titulo' con el titulo EXACTO. Este chequeo
 *      detecta la foto huerfana: una entrada en TOUR_PHOTOS que ya no
 *      corresponde a ningun tour. Pasa cuando alguien corrige un titulo en la
 *      Sheet: la foto deja de mostrarse y la del mapa queda sin usar, y las dos
 *      cosas hay que saberlas.
 *
 * Salida: 0 si todo esta bien, 1 si hay algo roto.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'tours.json');
const CLIENTE_PATH = path.join(RAIZ, 'public', 'tours.generated.js');
const HTML_PATH = path.join(RAIZ, 'public', 'index.html');
const SW_PATH = path.join(RAIZ, 'public', 'sw.js');
const APP_PATH = path.join(RAIZ, 'public', 'app.js');

let errores = 0;
let avisos = 0;
const err = (m) => { console.error('  ERROR  ' + m); errores++; };
const av = (m) => { console.log('  aviso  ' + m); avisos++; };
const ok = (m) => console.log('  ok     ' + m);

if (!fs.existsSync(JSON_PATH)) {
  err('falta data/tours.json. El catalogo de tours es la fuente de verdad: sin el, no hay seccion de tours.');
  process.exit(1);
}

const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const NOMBRES = datos._destinos || {};
const tours = datos.tours || [];

// --- 1. el generado esta al dia -----------------------------------------
if (!fs.existsSync(CLIENTE_PATH)) {
  err('falta public/tours.generated.js. Corré npm run build:tours');
  process.exit(1);
}
const generado = require(CLIENTE_PATH);
if (generado.length !== tours.length) {
  err('public/tours.generated.js tiene ' + generado.length + ' tours y data/tours.json tiene ' + tours.length + '. Corré npm run build:tours');
} else {
  let dif = 0;
  tours.forEach((t, i) => {
    const g = generado[i];
    const titulo = t.titulo || t.titulo === '' ? t.titulo : '(sin titulo)';
    if (!g) { dif++; err('tours[' + i + ']: el generado no tiene esa posicion'); return; }
    if (g.title !== t.titulo) {
      dif++;
      err('tours[' + i + '] ("' + titulo + '"): el titulo del generado ("' + g.title + '") no es el del JSON. El generado esta viejo: corré npm run build:tours');
    }
    if (g.description !== (t.descripcion || '')) { dif++; err('tours[' + i + '] ("' + titulo + '"): la descripcion del generado no es la del JSON'); }
    if (g.details !== (t.detalle || '')) { dif++; err('tours[' + i + '] ("' + titulo + '"): el detalle del generado no es el del JSON'); }
  });
  if (!dif) ok('el generado tiene los ' + tours.length + ' tours del JSON, en el mismo orden');
}

// --- 2. index.html lo carga antes que app.js -----------------------------
const html = fs.readFileSync(HTML_PATH, 'utf8');
const iTours = html.indexOf('src="/tours.generated.js');
const iApp = html.indexOf('src="/app.js');
if (iTours < 0) {
  err('index.html no carga /tours.generated.js: la seccion de tours sale vacia');
} else if (iApp < 0) {
  err('index.html no carga /app.js? No se puede comprobar el orden de los scripts');
} else if (iTours > iApp) {
  err('tours.generated.js tiene que cargarse ANTES que app.js (app.js lee window.CS_TOURS_DATA al cargar)');
} else {
  ok('index.html carga /tours.generated.js antes que /app.js');
}

// --- 3. sw.js lo precachea ----------------------------------------------
const sw = fs.readFileSync(SW_PATH, 'utf8');
if (sw.indexOf("'/tours.generated.js'") < 0) {
  av('sw.js no precachea /tours.generated.js: sin senal, la seccion de tours no aparece en la primera apertura');
} else {
  ok('sw.js precachea /tours.generated.js');
}
const vSw = parseInt((sw.match(/cuantosale-shell-v(\d+)/) || [])[1] || '0', 10);
if (vSw < 94) av('sw.js sin bumpear (v' + vSw + '): el catalogo viejo sigue en el cache de quienes ya instalaron la PWA');
else ok('sw.js en v' + vSw);

// --- 4. destinos que el modelo no conoce ---------------------------------
let DEST = {};
try {
  DEST = require(path.join(RAIZ, 'lib', 'model.js')).DEST || {};
} catch (e) {
  av('no se pudo leer DEST de lib/model.js (' + e.message + '): se saltea el chequeo de destinos');
}
let desconocidos = 0;
Object.keys(NOMBRES).forEach((k) => {
  if (DEST[k] === undefined) {
    av('el destino "' + k + '" (' + NOMBRES[k] + ') no esta en lib/model.js: sus ' +
      tours.filter((t) => t.destinos.indexOf(k) >= 0).length + ' tours no se van a ver. Key equivocado, o el destino falta en el modelo');
    desconocidos++;
  }
});
if (!desconocidos && Object.keys(DEST).length) ok('los ' + Object.keys(NOMBRES).length + ' destinos del catalogo existen en lib/model.js');

// --- 5. cobertura de fotos y fotos huerfanas ------------------------------
const app = fs.readFileSync(APP_PATH, 'utf8');
const sF = app.indexOf('var TOUR_PHOTOS = {');
const eF = app.indexOf('\n  };', sF);
if (sF < 0 || eF < 0) {
  av('no se encontro TOUR_PHOTOS en public/app.js: se saltea el chequeo de fotos');
} else {
  const fotos = eval('(' + app.slice(sF + 'var TOUR_PHOTOS = '.length, eF + 4) + ')');
  const claves = Object.keys(fotos);
  const enCatalogo = new Set(tours.map((t) => t.destinos[0] + '#' + t.titulo));
  const huerfanas = claves.filter((k) => !enCatalogo.has(k));
  const conFoto = [...enCatalogo].filter((k) => Object.prototype.hasOwnProperty.call(fotos, k)).length;

  ok(conFoto + ' de ' + tours.length + ' tours tienen foto; ' + (tours.length - conFoto) + ' muestran el degradado con el icono');

  if (huerfanas.length) {
    av(huerfanas.length + ' foto(s) de TOUR_PHOTOS ya no corresponde a ningun tour del catalogo. Casi siempre es un titulo que se corrigio en la Sheet:');
    huerfanas.slice(0, 10).forEach((k) => {
      const destino = k.split('#')[0];
      const tituloViejo = k.split('#').slice(1).join('#');
      // Si el titulo cambio de verdad, se puede sugerir el nuevo: mismo destino
      // y la foto todavia aplica.
      const candidatos = tours.filter((t) => t.destinos[0] === destino).map((t) => t.titulo);
      const parecido = candidatos.filter((c) => c !== tituloViejo &&
        (c.toLowerCase().includes(tituloViejo.toLowerCase().slice(0, 12)) || tituloViejo.toLowerCase().includes(c.toLowerCase().slice(0, 12))));
      console.log('    - ' + k);
      if (parecido.length === 1) console.log('        probablemente renombrado a: ' + parecido[0]);
    });
    if (huerfanas.length > 10) console.log('    ... y ' + (huerfanas.length - 10) + ' mas');
  }
}

console.log('');
if (errores) {
  console.log(errores + ' error(es), ' + avisos + ' aviso(s).');
  process.exit(1);
}
console.log('tours: ok' + (avisos ? ' con ' + avisos + ' aviso(s)' : '') + '.');
process.exit(0);
