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

/* Los scripts con su propio numero.
 *
  (style.css se sincroniza con el ?v= de todas las paginas, pero waitlist.js y
   grupo.js tienen numero propio y el suyo se sube a mano. Es el mismo problema
   queغال con el CSS: si se toca waitlist.js y no se sube el ?v=, el servidor lo
   sirve con immutable de un anio y el arreglo no le llega a nadie. Paso
   realmente: se agrego el aviso de privacidad a la waitlist, se subio el numero
   del CSS por otro motivo y el texto nuevo no apareció en la pagina.
 *
   Estos archivos declaran su version adentro, asi que el numero maestro es el
   de ellos y se copia al HTML, al reves que con el CSS. */
const SCRIPTS = [
  { archivo: 'waitlist.js', nombre: 'waitlist.js' },
  { archivo: 'grupo.js', nombre: 'grupo.js' }
];

function versionDeScript(archivo) {
  const ruta = path.join(PUBLIC, archivo);
  if (!fs.existsSync(ruta)) return null;
  const txt = fs.readFileSync(ruta, 'utf8');
  const m = txt.match(/^\s*(?:\/\*|\/\/)\s*version:\s*(\d+)/m);
  return m ? m[1] : null;
}

/* Sube el numero de un script en uno. Se usa cuando se toca el archivo: no
   sirve de mucho levantarlo solo, porque el script no cambia y el numero solo
   serviria para invalidar una copia que ya no existe. */
function subirVersionDeScript(archivo) {
  const ruta = path.join(PUBLIC, archivo);
  const txt = fs.readFileSync(ruta, 'utf8');
  const m = txt.match(/^(\s*(?:\/\*|\/\/)\s*version:\s*)(\d+)/m);
  if (!m) return null;
  const nuevo = String(Number(m[2]) + 1);
  fs.writeFileSync(ruta, txt.replace(m[0], m[1] + nuevo), 'utf8');
  return nuevo;
}

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

  // Los scripts con numero propio. El maestro es el marcador adentro del .js,
  // y aca se copia al HTML. Con --subir se incrementa el maestro de los que
  // aparezcan en la linea de comandos, que es lo que se usa despues de tocar
  // uno de esos archivos.
  const subir = process.argv.slice(2);
  console.log('');
  console.log('scripts versionados');
  for (const s of SCRIPTS) {
    const rutaJs = path.join(PUBLIC, s.archivo);
    if (!fs.existsSync(rutaJs)) { console.log('  ' + s.archivo + ': no existe'); continue; }
    let vjs = versionDeScript(s.archivo);
    if (subir.indexOf(s.archivo) >= 0) {
      const nueva = subirVersionDeScript(s.archivo);
      if (nueva) { vjs = nueva; console.log('  ' + s.archivo + ': subido a ' + nueva); }
    }
    if (!vjs) { console.log('  ' + s.archivo + ': sin marcador de version, se omite'); continue; }

    for (const pagina of HTML) {
      const ruta = path.join(PUBLIC, pagina);
      if (!fs.existsSync(ruta)) continue;
      const antes = fs.readFileSync(ruta, 'utf8');
      const re = new RegExp('(/?' + s.nombre.replace('.', '\\.') + '\\?v=)\\d+', 'g');
      if (!re.test(antes)) continue;
      const despues = antes.replace(re, '$1' + vjs);
      if (despues !== antes) {
        const viejo = (antes.match(re) || [''])[0].match(/\d+$/);
        const previo = viejo ? Number(viejo[0]) : null;
        /* Un numero que BAJA es un bug, no una sincronizacion. Con
           immutable de un ano, quien ya tiene la copia del numero alto la
           sigue teniendo para siempre, asi que bajar deja a esa persona
           con una version vieja del archivo sin que nadie lo note. */
        if (previo !== null && Number(vjs) < previo) {
          throw new Error(s.nombre + ' en ' + pagina + ': el maestro quedo en ' + vjs
            + ' y la pagina pide ' + previo + '. Bajar un ?v= deja copias viejas '
            + 'sirviendose para siempre. Subi el marcador del script.');
        }
        fs.writeFileSync(ruta, despues, 'utf8');
        cambios++;
        console.log('  ' + pagina + ': ' + s.nombre + ' ' + (previo === null ? '?' : previo) + ' -> ' + vjs);
      }
    }
    console.log('  ' + s.archivo + ': maestro ' + vjs);
  }

  console.log('');
  console.log(cambios ? (cambios + ' archivo(s) sincronizado(s)') : 'todo estaba sincronizado');
  if (cambios) {
    console.log('style.css y los scripts son los maestros: se suben a mano solo cuando se tocan.');
  }
  if (!subir.length) {
    console.log('Para subir el numero de un script que editaste: npm run fix:version -- waitlist.js');
  }
}

main();
