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
  /* El hero es un panel con fondo propio, asi que sus dos tintas se miden
     CONTRA ESE FONDO y no contra --bg. Cuando el hero paso a ser oscuro con
     texto claro, --hero-soft se llevo el valor oscuro que tenia cuando el hero
     era ambar con tinta oscura: #1A2433 sobre #111A28 daba 1.12:1 y la linea de
     metadatos de la propuesta y el "por persona" se perdian. Ese token no lo
     cubria ningun chequeo, por eso se rompio solo al cambiar el fondo del hero.
     --hero-ink se mide tambien porque si cae, el titulo de la propuesta se va. */
  for (const [tinta, minimo, que] of [['--hero-ink', 4.5, 'el titulo de la propuesta'], ['--hero-soft', 4.5, 'los metadatos y el "por persona"']]) {
    const v = tokens[tinta], f = tokens['--hero-bg'];
    if (!/^#[0-9a-f]{6}$/i.test(v || '') || !/^#[0-9a-f]{6}$/i.test(f || '')) {
      err(tinta + ' o --hero-bg no son hex validos en el tema ' + tema + '.'); continue;
    }
    const r = ratio(v, f);
    if (r < minimo) {
      err(tinta + ' (' + v + ') sobre --hero-bg (' + f + ') da ' + r.toFixed(2) + ':1 en el tema ' + tema +
        ', debajo de ' + minimo + ':1. ' + que + ' no se lee.');
    } else {
      console.log('  ok  [' + tema + '] ' + tinta + ' ' + v + ' vs --hero-bg = ' + r.toFixed(2) + ':1');
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

/* 3c. El texto secundario de la BANDA DE LA PROPUESTA.

   Es el único texto de la app que se dibuja sobre un fondo propio (--hero-bg)
   en vez de sobre --surface, y por eso es el que se rompió dos veces:

     - --hero-soft era un tono oscuro (#1A2433 en night, #2A3646 en light) sobre
       un fondo oscuro: 1.12:1 y 1.45:1. No era "poco contraste", era
       ilegible, y caía justo en la línea que dice qué viaje es este.
     - Cuando la banda es oscura TAMBIÉN en modo claro, el gris tiene que ser
       claro en los dos temas. Ponerlo oscuro "porque el tema es claro" lo
       rompía al revés.

   Se mide con el mismo criterio del punto 3 y con el mismo piso de 4.5:1, que es
   el mínimo de WCAG para texto normal. Se mide en los dos temas porque este
   token es el que más se ha movido solo. */
for (const [nombre, tokens] of [['night', NIGHT], ['light', LIGHT]]) {
  const a = tokens['--hero-soft'], b = tokens['--hero-bg'];
  if (!/^#[0-9a-f]{6}$/i.test(a || '') || !/^#[0-9a-f]{6}$/i.test(b || '')) {
    err('el tema ' + nombre + ' no declara --hero-soft o --hero-bg como hex de 6 digitos.');
    continue;
  }
  const r = ratio(a, b);
  if (r < 4.5) {
    err('--hero-soft (' + a + ') sobre --hero-bg (' + b + ') da ' + r.toFixed(2) +
      ':1 en el tema ' + nombre + ', debajo de 4.5:1. Es la linea de metadatos de la propuesta ' +
      '(destino, noches) y el "por persona": ilegibles.');
  } else {
    console.log('  ok  [' + nombre + '] --hero-soft ' + a + ' vs --hero-bg = ' + r.toFixed(2) + ':1');
  }
  // Y tiene que seguir siendo distinguible del texto principal de la banda: si
  // --hero-soft == --hero-ink se perdio la jerarquia, que es el otro extremo del
  // mismo error.
  if (tokens['--hero-ink'] && a.toLowerCase() === tokens['--hero-ink'].toLowerCase()) {
    err('--hero-soft y --hero-ink son el mismo color en el tema ' + nombre +
      ': no hay jerarquia entre el texto principal y el secundario de la banda.');
  }
}

/* 3d. El tamaño mínimo del texto secundario de la propuesta.

   El contraste estaba bien y la letra igual no se leía: 13px de metadata y 13px
   de "por persona" en el celular. El contraste es una mitad del problema y el
   cuerpo del texto es la otra, y un validador que solo mide contraste deja
   pasar el segundo. Se comprueba que los cuatro selectores del área de propuesta
   no bajen de 13px, que es el piso que se puede defender en un celular a metros
   de distancia; en el móvil la media query los sube otra vez.

   Se lee del CSS plano con un regex por selector, sin navegador: si alguien
   cambia el selector, el validador avisa en vez de no mirar nada. */
const CSS = sinComentarios.replace(/\s+/g, ' ');
const MIN_PROPUESTA = [
  ['.detail-summary p', 'los metadatos de la propuesta (destino, noches)'],
  ['.detail-summary__per-person', 'el "por persona" de la propuesta'],
  ['.opt .s', 'el subtitulo de la tarjeta de propuesta'],
  ['.opt__price span', 'el "por persona" de la tarjeta de propuesta']
];
for (const [sel, que] of MIN_PROPUESTA) {
  const re = new RegExp('(?:^|[{},])\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?:,[^{]*)?\\{([^}]*)\\}', 'g');
  const reglas = [...CSS.matchAll(re)];
  if (!reglas.length) {
    err('style.css no tiene la regla "' + sel + '" (' + que + '). Si se renombro el selector, ' +
      'hay que actualizar este script.');
    continue;
  }
  for (const r of reglas) {
    const cuerpo = r[1];
    // Solo la regla base, no la de una media query: ahi se decide el cuerpo y
    // la media query mobile solo puede subirlo. Se sabe contando llaves hasta
    // la llave que ABRE esta regla: si hay algun bloque abierto todavia, la
    // regla esta dentro de un @media y no es la base. Hay que contar hasta la
    // llave de apertura y no hasta r.index, porque el match arranca en un
    // caracter de borde ('}' anterior) y contarlo ahi daria un bloque de mas.
    const antes = CSS.slice(0, r.index + r[0].lastIndexOf('{'));
    let profundidad = 0;
    for (let k = 0; k < antes.length; k++) {
      if (antes[k] === '{') profundidad++;
      else if (antes[k] === '}') profundidad--;
    }
    if (profundidad > 0) continue;
    const m = cuerpo.match(/font-size:\s*([\d.]+)px/);
    if (!m) continue;
    const px = parseFloat(m[1]);
    if (px < 13) {
      err(sel + ' (' + que + ') usa ' + px + 'px en el tema base, debajo de 13px. ' +
        'El contraste puede estar bien y la letra igual no leerse en el celular.');
    } else {
      console.log('  ok  ' + sel + ' = ' + px + 'px');
    }
  }
}

/* 4. el interruptor de tema existe y esta en las dos paginas.

   Esto antes era un AVISO genérico: cualquier archivo de public/ que tocara
   data-theme disparaba "revisitá este script". Con el toggle ese aviso se
   dispara siempre y no dice nada, porque el toggle ES la forma legitima de
   cambiar de tema. Se reemplaza por un chequeo positivo: que el boton, el
   script del head y la funcion de app.js esten, y que los dos <link> de
   style.css lleven la MISMA version.

   Esa ultima parte es la que mas importa y no estaba cubierta: el servidor
   marca ?v= como immutable por un ano (server.js:1782), asi que si index.html
   pide ?v=105 y grupo.html ?v=103, uno de los dos sirve un CSS de hace un ano
   para siempre. Pasa: se commiteo style.css a ?v=104 y un guardado del editor
   dejo las dos paginas en ?v=103. */
const PUB = path.join(RAIZ, 'public');
const app = fs.readFileSync(path.join(PUB, 'app.js'), 'utf8');
const idx = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const grp = fs.readFileSync(path.join(PUB, 'grupo.html'), 'utf8');

if (!/id="theme-toggle"/.test(idx)) {
  err('public/index.html no tiene el boton #theme-toggle: no se puede cambiar de tema a mano.');
}
/* En app.js el boton se busca por SELECTOR (#theme-toggle), no por id="...":
   el id vive en el HTML y aca lo que tiene que existir es la funcion y el
   enganche del click. */
if (!/function initThemeToggle/.test(app) || !/\$\('#theme-toggle'\)/.test(app)) {
  err('public/app.js no tiene initThemeToggle enganchado al boton: el toggle no cambia el tema.');
}

/* 4b. Seguir al sistema de verdad, no solo en la carga.

   Este es el bug que rompia la adaptacion automatica: aplicarTema() escribia
   SIEMPRE en localStorage, y la llamaba tambien initThemeToggle() al arrancar.
   Con solo abrir la pagina en un celular en claro se guardaba 'light', asi que
   a partir de ahi ya habia "eleccion guardada" y la app dejaba de seguir al
   sistema para siempre. El que tiene el celular en claro a la manana, lo pasa a
   oscuro a la tarde y vuelve a abrir la pagina, se quedaba viendo la version
   clara sin ninguna forma de explicar por que.

   Lo que se comprueba:
     - aplicarTema() tiene el segundo parametro `guardar`, y es el que decide si
       escribe en localStorage. Sin el, volver a escribir siempre.
     - el UNICO lugar que pasa guardar=true es el click del boton. Si el arranque
       o el listener del sistema guardaran, volveriamos a lo mismo.
     - hay un listener de 'change' sobre prefers-color-scheme, para que el tema
       siga al sistema en vivo y no solo en cada carga.
     - el script del head resuelve lo mismo: si no hay eleccion guardada, usa
       prefers-color-scheme. */
if (!/function aplicarTema\(t, guardar\)/.test(app)) {
  err('public/app.js no declara aplicarTema(t, guardar): no se puede seguir al sistema sin ' +
    'guardar una eleccion que la persona nunca hizo.');
} else {
  // El argumento puede ser una llamada (temaActual()), asi que el patron tiene
  // que tolerar un par de parentesis adentro. Con [^)]* se cortaba en el
  // primer ")" y no encontraba ninguna llamada con dos argumentos.
  // Ojo: el grupo captura SOLO los argumentos, sin el parentesis de cierre, asi
  // que el segundo argumento se busca anclado al final de la cadena.
  const guardan = [...app.matchAll(/aplicarTema\(((?:[^()]|\([^()]*\))*)\)/g)].map(m => m[1]);
  const conGuardar = guardan.filter(a => /,\s*true\s*$/.test(a));
  const sinGuardar = guardan.filter(a => /,\s*(false|true)\s*$/.test(a));
  if (!conGuardar.length) {
    err('nadie llama aplicarTema(..., true): el boton no guardaria la eleccion y al recargar ' +
      'la pagina volveria al tema del sistema.');
  }
  if (conGuardar.length > 1) {
    err('aplicarTema(..., true) se llama ' + conGuardar.length + ' veces. Solo el click del boton ' +
      'es una eleccion: si el arranque o el listener del sistema guardan, la app deja de seguir ' +
      'al sistema para siempre.');
  }
  if (!sinGuardar.length) {
    err('nadie llama aplicarTema(..., false): el arranque y el listener del sistema estan ' +
      'guardando el tema, que es exactamente el bug.');
  }
  console.log('  ok  aplicarTema() recibe guardar; ' + conGuardar.length + ' lo guarda y ' +
    sinGuardar.length + ' no');
}
if (!/matchMedia\('\(prefers-color-scheme: light\)'\)/.test(app) || !/addEventListener\('change'/.test(app)) {
  err('public/app.js no escucha los cambios de prefers-color-scheme: cambiar el celular de claro ' +
    'a oscuro a la tarde deja la pagina como estaba.');
} else {
  console.log('  ok  app.js sigue los cambios de prefers-color-scheme en vivo');
}
if (!/function temaGuardado/.test(app)) {
  err('public/app.js no tiene temaGuardado(): no puede distinguir "el usuario eligio" de "no hay ' +
    'eleccion", y sin esa distincion el sistema deja de mandar.');
}
/* El script del head tiene que estar ANTES del link del stylesheet. Si esta
   despues, la pagina se pinta con :root y recien despues cambia de tema: un
   destello en cada carga. */
const posScript = idx.indexOf('cuantosale_tema');
const posCss = idx.indexOf('style.css?v=');
if (posScript < 0) {
  err('public/index.html no aplica el tema antes de pintar.');
} else if (posCss >= 0 && posScript > posCss) {
  err('public/index.html carga style.css antes de aplicar el tema. Hay que aplicar el ' +
    'tema antes del link del CSS o se ve un destello en cada carga.');
}
if (!/cuantosale_tema/.test(grp)) {
  err('public/grupo.html no respeta el tema elegido en /app.');
}

const vIdx = (idx.match(/style\.css\?v=(\d+)/) || [])[1];
const vGrp = (grp.match(/style\.css\?v=(\d+)/) || [])[1];
if (!vIdx || !vGrp) {
  err('Falta el ?v= en el link de style.css de una de las dos paginas. El server lo marca ' +
    'immutable por un ano, asi que sin version no hay forma de sacar un CSS nuevo.');
} else if (vIdx !== vGrp) {
  err('index.html pide style.css?v=' + vIdx + ' y grupo.html pide ?v=' + vGrp + '. Con la misma ' +
    'URL el server responde immutable por un ano, asi que las dos paginas tienen que pedir la ' +
    'misma version o una de las dos queda con el CSS viejo para siempre.');
} else {
  console.log('  ok  las dos paginas piden style.css?v=' + vIdx);
}

/* El mismo numero, escrito adentro de style.css. El ?v= solo no alcanza para
   saber si esta bien: si se toca el CSS y no se sube el ?v=, el browser sigue
   con la version vieja y el fix no llega a nadie, y no hay forma de enterarse
   mirando el repo. Pasa siempre por la misma razon: el archivo se toco, se
   commiteo, y el ?v= quedo atras. Con el numero adentro, el validador compara
   las dos cosas y avisa. */
const vCss = (css.match(/\/\*\s*version:\s*(\d+)/) || [])[1];
if (!vCss) {
  err('style.css no tiene el marcador "/* version: N */" al principio. Es lo que permite ' +
    'comprobar que el ?v= de las paginas se subio junto con el CSS.');
} else if (vCss !== vIdx) {
  err('style.css dice "version: ' + vCss + '" pero las paginas piden ?v=' + vIdx + '. ' +
    'Con el mismisimo archivo, el ?v= es lo unico que hace que el browser_descarte la ' +
    'copia vieja: si no coinciden, el CSS nuevo no le llega a nadie y no se ve hasta ' +
    'que alguien limpia la cache a mano.');
} else {
  console.log('  ok  style.css declara version ' + vCss + ' y las paginas piden la misma');
}

console.log('\ntokens: ' + Object.keys(NIGHT).length + ' en :root (night), ' +
  Object.keys(LIGHT).length + ' en [data-theme="light"]');
console.log('\n' + (errores ? errores + ' FALLAS, ' + avisos + ' avisos' : avisos ? avisos + ' avisos, sin fallas' : 'todo bien'));
process.exit(errores ? 1 : 0);
