'use strict';
/*
 * Valida que los dos bloques de modo oscuro de public/style.css no se separen.
 *
 * Por que existe: public/style.css declara el tema oscuro DOS veces.
 *
 *   A) @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) }
 *   B) :root[data-theme="dark"]
 *
 * El bloque B jamas aplica: la app no setea data-theme en ningun lado
 * (no hay toggle de tema en index.html ni en app.js), asi que el unico camino
 * real al modo oscuro es A. Cuando se agregaron los tokens de card al tema
 * oscuro se los puso solo en B, y A seguia heredando los valores claros de
 * :root: --card-bg:#FFFFFF y --card-sel-bg:#FEF7E7 pintaban las cards de
 * blanco con --ink:#EEF3F9 encima, o sea 1.12:1 y 1.05:1. En el celular, que
 * suele venir en oscuro, la card salia blanca con el texto gris claro
 * ilegible. Dos copias del mismo tema es exactamente el problema que
 * validar-costos.js y validar-transfer.js ya resuelven para los datos:
 * nada se entera hasta que se rompe en pantalla.
 *
 * Lo que se comprueba:
 *   1. Los dos bloques oscuridad declaran EXACTAMENTE el mismo set de tokens.
 *   2. Para cada token, los dos bloques declaran el mismo valor.
 *   3. El contraste de los tokens de card contra --ink / --ink2 del modo
 *      oscuro llega al minimo de WCAG, que es el numero que estaba roto.
 *   4. Ningun archivo de public/ vuelve a setear data-theme por su cuenta
 *      sin pasar por el toggle, porque eso abriria una tercera vía al tema
 *      oscuro y este chequeo dejaria de cubrirla.
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

const A = tokensDe(bloque('@media (prefers-color-scheme: dark)'));
const B = tokensDe(bloque(':root[data-theme="dark"]'));
const RAIZ_TOKENS = tokensDe(bloque(':root'));

if (!Object.keys(A).length || !Object.keys(B).length) {
  err('No se pudieron localizar los dos bloques de modo oscuro. Si cambio el ' +
    'nombre de alguno, hay que actualizar este script.');
  process.exit(1);
}

/* 1. mismo set de tokens, con una sola excepcion: un token que NO es de color
      (un radio, un grosor) puede faltar, porque da igual en los dos temas.
      Un token de color no puede faltar, porque ese es justamente el bug: se
      queda con el valor claro de :root y la card se rompe. */
const esColor = (v) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(v || '');
const colorQueFalta = (lista) => lista.filter((k) => esColor(RAIZ_TOKENS[k]));

const soloA = Object.keys(A).filter((k) => !(k in B));
const soloB = Object.keys(B).filter((k) => !(k in A));
const colorSoloA = colorQueFalta(soloA);
const colorSoloB = colorQueFalta(soloB);

if (colorSoloA.length) {
  err('Tokens de color en prefers-color-scheme:dark que NO estan en [data-theme="dark"]: ' +
    colorSoloA.join(' ') + '.');
}
if (colorSoloB.length) {
  err('Tokens de color en [data-theme="dark"] que NO estan en prefers-color-scheme:dark: ' +
    colorSoloB.join(' ') + '. Aca esta el bug original: se agrego el token al bloque que ' +
    'nunca aplica y el celular seguia mostrando el valor claro de :root.');
}

/* 2. mismos valores */
for (const k of Object.keys(B)) {
  if (!(k in A)) continue;
  if (A[k] !== B[k]) {
    err('El token ' + k + ' difiere entre los dos bloques: media query = "' + A[k] +
      '" vs [data-theme="dark"] = "' + B[k] + '".');
  }
}

/* 3. contraste de los tokens de card contra la tinta del modo oscuro */
function lum(hex) {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const raizA = RAIZ_TOKENS;
const tinta = { ink: A['--ink'], ink2: A['--ink2'] };
if (/^#[0-9a-f]{6}$/i.test(tinta.ink) && /^#[0-9a-f]{6}$/i.test(tinta.ink2)) {
  /* --card-sel-bg es el que se rompia (1.05:1). 4.5:1 es el minimo de WCAG
     para texto normal; --ink2 es el tono con el que se dibuja el texto
     secundario de las cards, asi que es el que manda. */
  for (const fondo of ['--card-bg', '--card-sel-bg']) {
    const valor = A[fondo];
    if (!/^#[0-9a-f]{6}$/i.test(valor || '')) { err(fondo + ' no es un hex valido en el tema oscuro: "' + valor + '".'); continue; }
    const r = ratio(valor, tinta.ink2);
    if (r < 4.5) {
      err(fondo + ' (' + valor + ') contra --ink2 (' + tinta.ink2 + ') da ' + r.toFixed(2) +
        ':1, debajo de 4.5:1. La card se lee como un bloque de color sin texto.');
    } else {
      console.log('  ok  ' + fondo + ' ' + valor + ' vs --ink2 = ' + r.toFixed(2) + ':1');
    }
  }
  for (const [borde, fondo] of [['--card-border', '--card-bg'], ['--card-sel-border', '--card-sel-bg']]) {
    if (!/^#[0-9a-f]{6}$/i.test(A[borde] || '')) { err(borde + ' no es un hex valido en el tema oscuro.'); continue; }
    const r = ratio(A[borde], A[fondo]);
    if (r < 3) err(borde + ' (' + A[borde] + ') contra ' + fondo + ' da ' + r.toFixed(2) + ':1, debajo de 3:1.');
    else console.log('  ok  ' + borde + ' ' + A[borde] + ' vs ' + fondo + ' = ' + r.toFixed(2) + ':1');
  }
  /* El anillo de foco es el otro token que se rompio por la misma causa: es
     un celeste elegido para fondo claro y contra el surface oscuro daba
     2.25:1. WCAG 2.4.11 pide 3:1 para el foco, asi que se chequea contra los
     dos fondos donde se dibuja, --surface y --bg. */
  for (const fondo of ['--surface', '--bg']) {
    const v = A['--focus'];
    if (!/^#[0-9a-f]{6}$/i.test(v || '')) { err('--focus no es un hex valido en el tema oscuro: "' + v + '".'); break; }
    const r = ratio(v, A[fondo]);
    if (r < 3) {
      err('--focus (' + v + ') contra ' + fondo + ' (' + A[fondo] + ') da ' + r.toFixed(2) +
        ':1, debajo de 3:1. El foco de teclado no se ve en el tema oscuro.');
    } else {
      console.log('  ok  --focus ' + v + ' vs ' + fondo + ' = ' + r.toFixed(2) + ':1');
    }
  }

  /* Referencia de lo que se estaba viendo: el valor claro de --card-bg contra
     la tinta oscura. Si este numero vuelve a 1.x, el bug de las cards volvio. */
  console.log('\n  (referencia) --card-bg claro ' + (raizA['--card-bg'] || '?') + ' vs --ink2 oscuro = ' +
    ratio(raizA['--card-bg'] || '#FFFFFF', tinta.ink2).toFixed(2) + ':1');
} else {
  av('No se pudieron leer --ink / --ink2 del tema oscuro; se saltea el chequeo de contraste.');
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

console.log('\ntokens modo oscuro: ' + Object.keys(A).length + ' en media query, ' +
  Object.keys(B).length + ' en [data-theme="dark"]');
console.log('\n' + (errores ? errores + ' FALLAS, ' + avisos + ' avisos' : avisos ? avisos + ' avisos, sin fallas' : 'todo bien'));
process.exit(errores ? 1 : 0);
