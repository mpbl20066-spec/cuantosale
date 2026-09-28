'use strict';
/*
 * Valida que los dos temas de public/style.css no se separen.
 *
 * Por que existe: public/style.css declaraba el tema oscuro DOS veces.
 *
 *   A) @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) }
 *   B) :root[data-theme="dark"]
 *
 * El bloque B jamas aplicaba: la app no setea data-theme en ningun lado
 * (no hay toggle de tema en index.html ni en app.js), asi que el unico camino
 * real al modo oscuro era A. Cuando se agregaron los tokens de card al tema
 * oscuro se los puso solo en B, y A seguia heredando los valores claros de
 * :root: --card-bg:#FFFFFF y --card-sel-bg:#FEF7E7 pintaban las cards de
 * blanco con --ink:#EEF3F9 encima, o sea 1.12:1 y 1.05:1. En el celular, que
 * suele venir en oscuro, la card salia blanca con el texto gris claro
 * ilegible. Dos copias del mismo tema es exactamente el problema que
 * validar-costos.js y validar-transfer.js ya resuelven para los datos:
 * nada se entera hasta que se rompe en pantalla.
 *
 * QUE CAMBIO: el oscuro paso a ser el tema por defecto (identidad night
 * mostaza) y el claro quedo como :root[data-theme="light"]. Eso deja DOS
 * bloques, uno por tema, y elimina de raiz la duplicacion que habia causado el
 * bug: ya no hay dos copias que puedan separarse porque un token nuevo se
 * agrega a una sola. El script se actualizo para vigilar esta forma.
 *
 * Lo que se comprueba:
 *   1. Los dos temas declaran EXACTAMENTE el mismo set de tokens de color.
 *   2. Los dos temas se DIFERENCIAN: si el claro fuera una copia del night,
 *      pedir data-theme="light" no cambiaria nada y nadie se enteraria.
 *   3. El contraste de los tokens de card, del anillo de foco y de la tinta
 *      del boton de accion contra --ink / --ink2 llega al minimo de WCAG, en
 *      los DOS temas. El numero que estaba roto era 1.05:1.
 *   3b. El contraste de los badges de 11 px del panel "De donde salen los
 *      valores" llega a 4.5:1 en los dos temas.
 *   4. Ningun archivo de public/ vuelve a setear data-theme por su cuenta
 *      sin pasar por el toggle, porque eso abriria una tercera via al tema y
 *      este chequeo dejaria de cubrirla.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CSS_PATH = path.join(RAIZ, 'public', 'style.css');

let errores = 0, avisos = 0;
const err = (m) => { console.log('  FALLA ' + m); errores++; };
const av = (m) => { console.log('  aviso  ' + m); avisos++; };

const css = fs.readFileSync(CSS_PATH, 'utf8');

/* Saca los comentarios primero. Sin esto, un comentario que mencione un
   selector o un nombre de token se lee como si fuera codigo, y el bloque se
   termina cortando en el lugar equivocado. */
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* Recorta un bloque por nombre de selector, buscando la llave de cierre en
   vez de cortar con una segunda busqueda de texto: asi el limite es el que
   corresponde aunque el selector aparezca mencionado en un comentario. */
function bloque(selector) {
  const i = sinComentarios.indexOf(selector);
  if (i < 0) return null;
  const abre = sinComentarios.indexOf('{', i);
  if (abre < 0) return null;
  let nivel = 0;
  for (let k = abre; k < sinComentarios.length; k++) {
    const ch = sinComentarios[k];
    if (ch === '{') nivel++;
    else if (ch === '}') { nivel--; if (nivel === 0) return sinComentarios.slice(abre + 1, k); }
  }
  return null;
}

function tokensDe(cuerpo) {
  const out = {};
  if (!cuerpo) return out;
  for (const m of cuerpo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+)/gi)) {
    out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  }
  return out;
}

/* Dark = :root, porque el tema oscuro paso a ser el DEFAULT y el claro quedo
   como :root[data-theme="light"]. Antes habia tres bloques (:root claro, la
   media query y [data-theme="dark"]) y el oscuro estaba duplicado en dos, que
   es justamente la causa del bug que este script documenta: los tokens se
   agregaron a la copia que nunca aplicaba. Con dos bloques y una sola fuente
   por tema, la duplicacion que lo causaba no puede volver a aparecer.

   NIGHT es el que se compara contra la tinta para el contraste de cards, porque
   es el tema por defecto y el unico que se ve sin pedir nada. LIGHT se mide con
   el mismo criterio: un color de marca puede pasar en oscuro y no en claro. */
const NIGHT = tokensDe(bloque(':root'));
const LIGHT = tokensDe(bloque(':root[data-theme="light"]'));

if (!Object.keys(NIGHT).length || !Object.keys(LIGHT).length) {
  err('No se pudieron localizar :root y :root[data-theme="light"]. Si cambio el ' +
    'nombre de alguno, hay que actualizar este script.');
  process.exit(1);
}

/* 1. mismo set de tokens, con una sola excepcion: un token que NO es de color
      (un radio, un grosor) puede faltar, porque da igual en los dos temas.
      Un token de color no puede faltar, porque ese es justamente el bug: se
      queda con el valor claro de :root y la card se rompe. */
const esColor = (v) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(v || '');

const soloNight = Object.keys(NIGHT).filter((k) => !(k in LIGHT));
const soloLight = Object.keys(LIGHT).filter((k) => !(k in NIGHT));
const colorSoloNight = soloNight.filter((k) => esColor(NIGHT[k]));
const colorSoloLight = soloLight.filter((k) => esColor(LIGHT[k]));

if (colorSoloNight.length) {
  err('Tokens de color en :root (night) que NO estan en [data-theme="light"]: ' +
    colorSoloNight.join(' ') + '.');
}
if (colorSoloLight.length) {
  err('Tokens de color en [data-theme="light"] que NO estan en :root (night): ' +
    colorSoloLight.join(' ') + '. Aca esta el bug original: se agrego el token a ' +
    'un solo tema y el otro se queda con el valor del lado contrario.');
}

/* 2. los dos temas tienen que SER distintos.
   Antes esta asercion comparaba los dos bloques de modo oscuro entre si, que ya
   no tiene sentido: son el mismo tema. Lo que si importa es que el claro no se
   vuelva una copia del night. Si alguien pega :root dentro de
   [data-theme="light"], la app sigue arrancando y se ve bien en el tema por
   defecto, pero el tema claro desaparece sin que nada se entere: el mismo
   fallo silencioso que este script vino a corregir, del otro lado. */
let distintos = 0;
for (const k of Object.keys(LIGHT)) {
  if (esColor(LIGHT[k]) && NIGHT[k] && LIGHT[k] !== NIGHT[k]) distintos++;
}
if (distintos < 8) {
  err('night y light declaran solo ' + distintos + ' tokens de color distintos. El tema claro ' +
    'parece una copia del night, asi que pedir data-theme="light" no cambia nada.');
} else {
  console.log('  ok  los dos temas difieren en ' + distintos + ' tokens de color');
}

/* 3. contraste de los tokens de card y del foco, en los DOS temas */
function lum(hex) {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

for (const [tema, tokens] of [['night', NIGHT], ['light', LIGHT]]) {
  const tinta = { ink: tokens['--ink'], ink2: tokens['--ink2'] };
  if (!/^#[0-9a-f]{6}$/i.test(tinta.ink) || !/^#[0-9a-f]{6}$/i.test(tinta.ink2)) {
    av('No se pudieron leer --ink / --ink2 del tema ' + tema + '; se saltea su contraste.');
    continue;
  }
  /* --card-sel-bg es el que se rompia (1.05:1). 4.5:1 es el minimo de WCAG
     para texto normal; --ink2 es el tono con el que se dibuja el texto
     secundario de las cards, asi que es el que manda. */
  for (const fondo of ['--card-bg', '--card-sel-bg']) {
    const valor = tokens[fondo];
    if (!/^#[0-9a-f]{6}$/i.test(valor || '')) { err(fondo + ' no es un hex valido en el tema ' + tema + ': "' + valor + '".'); continue; }
    const r = ratio(valor, tinta.ink2);
    if (r < 4.5) {
      err(fondo + ' (' + valor + ') contra --ink2 (' + tinta.ink2 + ') da ' + r.toFixed(2) +
        ':1 en el tema ' + tema + ', debajo de 4.5:1. La card se lee como un bloque de color sin texto.');
    } else {
      console.log('  ok  [' + tema + '] ' + fondo + ' ' + valor + ' vs --ink2 = ' + r.toFixed(2) + ':1');
    }
  }
  for (const [borde, fondo] of [['--card-border', '--card-bg'], ['--card-sel-border', '--card-sel-bg']]) {
    if (!/^#[0-9a-f]{6}$/i.test(tokens[borde] || '')) { err(borde + ' no es un hex valido en el tema ' + tema + '.'); continue; }
    const r = ratio(tokens[borde], tokens[fondo]);
    if (r < 3) err(borde + ' (' + tokens[borde] + ') contra ' + fondo + ' da ' + r.toFixed(2) + ':1 en el tema ' + tema + ', debajo de 3:1.');
    else console.log('  ok  [' + tema + '] ' + borde + ' ' + tokens[borde] + ' vs ' + fondo + ' = ' + r.toFixed(2) + ':1');
  }
  /* El anillo de foco es el otro token que se rompio por la misma causa: un
     celeste elegido para fondo claro contra el surface oscuro daba 2.25:1.
     WCAG 2.4.11 pide 3:1 para el foco, asi que se chequea contra los dos
     fondos donde se dibuja, --surface y --bg. */
  for (const fondo of ['--surface', '--bg']) {
    const v = tokens['--focus'];
    if (!/^#[0-9a-f]{6}$/i.test(v || '')) { err('--focus no es un hex valido en el tema ' + tema + ': "' + v + '".'); break; }
    const r = ratio(v, tokens[fondo]);
    if (r < 3) {
      err('--focus (' + v + ') contra ' + fondo + ' (' + tokens[fondo] + ') da ' + r.toFixed(2) +
        ':1 en el tema ' + tema + ', debajo de 3:1. El foco de teclado no se ve.');
    } else {
      console.log('  ok  [' + tema + '] --focus ' + v + ' vs ' + fondo + ' = ' + r.toFixed(2) + ':1');
    }
  }
  /* La tinta del boton de accion va sobre su propio relleno. Con mostaza de
     fondo el blanco no sirve (1.64:1), asi que este chequeo existe para que
     nadie vuelva a poner --action-ink en blanco creyendo que el boton es
     oscuro. */
  if (/^#[0-9a-f]{6}$/i.test(tokens['--action-bg'] || '') && /^#[0-9a-f]{6}$/i.test(tokens['--action-ink'] || '')) {
    const r = ratio(tokens['--action-ink'], tokens['--action-bg']);
    if (r < 4.5) {
      err('--action-ink (' + tokens['--action-ink'] + ') sobre --action-bg (' + tokens['--action-bg'] +
        ') da ' + r.toFixed(2) + ':1 en el tema ' + tema + ', debajo de 4.5:1. El texto del boton no se lee.');
    } else {
      console.log('  ok  [' + tema + '] --action-ink sobre --action-bg = ' + r.toFixed(2) + ':1');
    }
  }
}

/* 3b. contraste de los badges del panel "De donde salen los valores".
      Son pastillas de 11 px, o sea texto normal, y van sobre un fondo teñido
      (--good-soft, --cel-soft, --coral-soft). Es el mismo criterio del punto 3,
      aplicado a los tokens que los badges usan. Se miden en los DOS temas: un
      color de marca puede pasar en oscuro y no en claro, que es lo que pasaba
      con --coral (3.48:1 sobre --coral-soft en claro). Por eso existe
      --warn-ink y no se oscureció --coral. */
const BADGES = [
  ['--good', '--good-soft', 'badge "precio real" / "confianza alta"'],
  ['--cel', '--cel-soft', 'badge "estimado" / "confianza media"'],
  ['--warn-ink', '--coral-soft', 'badge "confianza baja"']
];
for (const [tinta, fondo, que] of BADGES) {
  for (const [nombre, tokens] of [['night', NIGHT], ['light', LIGHT]]) {
    const a = tokens[tinta], b = tokens[fondo];
    if (!/^#[0-9a-f]{6}$/i.test(a || '') || !/^#[0-9a-f]{6}$/i.test(b || '')) {
      err(que + ': en el tema ' + nombre + ' falta ' + tinta + ' o ' + fondo + '.');
      continue;
    }
    const r = ratio(a, b);
    if (r < 4.5) {
      err(que + ': ' + tinta + ' (' + a + ') sobre ' + fondo + ' (' + b + ') da ' + r.toFixed(2) +
        ':1 en el tema ' + nombre + ', debajo de 4.5:1. Es una pastilla de 11 px.');
    } else {
      console.log('  ok  ' + que + ' [' + nombre + '] = ' + r.toFixed(2) + ':1');
    }
  }
}

/* 4. nadie reintroduce una tercera via al tema oscuro */
for (const f of fs.readdirSync(path.join(RAIZ, 'public'))) {
  if (!/\.(js|html)$/.test(f) || f === 'sw.js') continue;
  const txt = fs.readFileSync(path.join(RAIZ, 'public', f), 'utf8');
  if (txt.includes('data-theme')) {
    av('public/' + f + ' menciona data-theme. Si eso setea el atributo, el bloque ' +
      ':root[data-theme="dark"] pasa a ser real y hay que revisitar este script.');
  }
}

console.log('\ntokens: ' + Object.keys(NIGHT).length + ' en :root (night), ' +
  Object.keys(LIGHT).length + ' en [data-theme="light"]');
console.log('\n' + (errores ? errores + ' FALLAS, ' + avisos + ' avisos' : avisos ? avisos + ' avisos, sin fallas' : 'todo bien'));
process.exit(errores ? 1 : 0);
