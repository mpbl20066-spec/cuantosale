'use strict';
/*
 * Sincroniza el ?v= de los assets versionados con el numero que declara el
 * propio asset.
 *
 *   node scripts/sync-version.js
 *
 * POR QUE ESTE SCRIPT Y NO EDITAR A MANO
 * El server sirve style.css y app.js con "immutable" de un anio cuando la URL
 * trae ?v= (ver serveStatic en server.js). Eso obliga a que TODAS las paginas
 * que cargan el CSS pidan el mismo numero: si una se queda atras, el browser
 * de quien la visito no vuelve a pedirla en un ano y queda con el CSS viejo
 * para siempre, sin error visible en ningun lado.
 *
 * El numero vivia en tres lugares (index.html, grupo.html y el comentario
 * adentro de style.css) y se subia a mano. Se desincrono tres veces en una
 * semana: 144 contra 177, despues 178 contra 180, despues 178 contra 181. Cada
 * vez el sintoma era el mismo y ninguno aparecia en los tests: el CSS nuevo
 * no llegaba a la pagina que se había quedado atrás.
 *
 * Ahora style.css es la unica fuente: declara su version adentro, este script
 * la copia a todos los HTML, y validar-tema.js sigue comprobando que esten
 * todos iguales. El error se sigue detectando solo; lo que cambia es que
 * arreglarlo es un comando y no tres ediciones coordinadas.
 *
 * LA REGLA: SUBIR, NUNCA BAJAR
 * Cuando el numero baja, el ?v= viejo queda sirviendo un archivo viejo para
 * quien ya lo tenga cacheado, y como el cache es immutable no se arregla
 * nunca. Por eso si style.css dice 180 y una pagina pide 181, el maestro
 * tiene que subir a 181 y no bajar la pagina a 180: el numero siempre
 * acompaña al archivo, nunca al revés.
 *
 * Las paginas que NO traen ?v= (tours.html y transfers.html) se dejan como
 * estan: el server las sirve con no-cache, siempre revalidan, y por lo tanto
 * nunca quedan con una copia vieja. Versionarlas seria una mejora aparte.
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

// Solo las paginas que se sirven publicamente. Las que arrancan con "_" son
// mockups privados de desarrollo y no van a produccion.
const HTML = ['index.html', 'grupo.html', 'tours.html', 'transfers.html',
              'waitlist.html', 'privacidad.html', 'terminos.html'];

// El numero maestro esta adentro del CSS. El de app.js se toma del HTML
// porque app.js no lo declara.
const CSS = path.join(PUBLIC, 'style.css');

function versionDeclarada() {
  const css = fs.readFileSync(CSS, 'utf8');
  const m = css.match(/\/\*\s*version:\s*(\d+)/);
  if (!m) {
    throw new Error('style.css no tiene el marcador "/* version: N */" al principio. '
      + 'Sin ese numero no hay de donde copiar.');
  }
  return m[1];
}

function main() {
  const v = versionDeclarada();
  console.log('version maestra (style.css): ' + v);
  let cambios = 0;

  for (const nombre of HTML) {
    const ruta = path.join(PUBLIC, nombre);
    if (!fs.existsSync(ruta)) { console.log('  ' + nombre + ': no existe, se omite'); continue; }
    const antes = fs.readFileSync(ruta, 'utf8');
    // Se reescriben los ?v= con numero Y el placeholder CS_VERSION. El
    // placeholder lo usan las paginas que se versionaron despues de existir el
    // script (tours.html y transfers.html venian sin ?v=, servidas con
    // no-cache); asi la version se agrega sola en vez de a mano.
    const despues = antes
      .replace(/(style\.css\?v=)\d+/g, '$1' + v)
      .replace(/style\.css\?v=CS_VERSION/g, 'style.css?v=' + v);
    if (despues === antes) {
      const tiene = /style\.css\?v=\d+/.test(antes);
      console.log('  ' + nombre + ': ' + (tiene ? 'ya en ' + v : 'sin stylesheet, se omite'));
      continue;
    }
    fs.writeFileSync(ruta, despues, 'utf8');
    cambios++;
    const viejo = (antes.match(/style\.css\?v=(\d+|CS_VERSION)/) || [])[1] || '?';
    console.log('  ' + nombre + ': ' + viejo + ' -> ' + v);
  }

  console.log('');
  console.log(cambios ? (cambios + ' archivo(s) sincronizado(s)') : 'todo estaba sincronizado');
  if (cambios) {
    console.log('Falta sumar el numero adentro de style.css? No: ese ES el maestro. '
      + 'Subilo a mano solo cuando toques el CSS.');
  }
}

main();
