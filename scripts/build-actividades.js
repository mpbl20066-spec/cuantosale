'use strict';
/*
 * Genera public/actividades-civitatis.js desde data/actividades-civitatis.json.
 *
 * Es el mismo patron que build-costos.js y build-transfer.js: la fuente de
 * verdad es el JSON, este script reparte una copia al navegador, y el archivo
 * generado se commitea para que un clon sirva sin correr nada.
 *
 * POR QUE EXISTE ESTO Y NO EL WIDGET
 *
 * El widget de actividades de Civitatis es un iframe. No se puede filtrar por
 * destino (el parametro no existe en la URL: con typeSelection=all devuelve el
 * catalogo global) y no se puede sumar nada al presupuesto, porque desde esta
 * pagina no se lee que actividad se eligio dentro del iframe. Trae fotos y
 * precios reales, pero no deja usar el diseno de la app ni el checkout.
 *
 * Con una lista propia de actividades y el enlace ?aid= de cada una, las cards
 * son las de la app (que ya suman al presupuesto y abren el checkout), y el
 * precio y la foto son los reales de Civitatis.
 *
 * LAS REGLAS QUE VALIDA ESTE SCRIPT
 *
 * 1. Toda foto necesita autor y licencia. Las fotos de los tours locales ya
 *    tienen esa regla y sale de Wikimedia Commons; lo mismo aca. Una actividad
 *    sin foto acreditada no se genera.
 *
 * 2. Las imagenes NO pueden salir del CDN de Civitatis. Enlazar en caliente sus
 *    fotos es usar material de otro con su servidor y sus condiciones. El
 *    validador rechaza cualquier URL de civitatis.com en el campo imagen.
 *
 * 3. El enlace tiene que traer el ?aid= del archivo. Un enlace sin el
 *    identificador genera reservas que no pagan comision y es la forma mas
 *    facil de no saber que se perdio. El script exige que coincida con el
 *    "afiliado" del JSON.
 *
 * Manda a stderr y sale con codigo 1 si algo no esta bien, para que
 * npm run check:todo lo vea.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'actividades-civitatis.json');
const SALIDA = path.join(RAIZ, 'public', 'actividades-civitatis.js');
const GLOBAL = 'CS_ACTIVIDADES_CIVITATIS';

const errores = [];
function Error_(msg) { errores.push(msg); }

if (!fs.existsSync(JSON_PATH)) {
  console.error('No existe ' + JSON_PATH);
  process.exit(1);
}

const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const afiliado = String(datos.afiliado || '').trim();

if (!afiliado) {
  console.error('data/actividades-civitatis.json: falta "afiliado", el identificador del panel.');
  process.exit(1);
}

const OBJETOS_VACIOS = Object.keys(datos).filter(function (k) { return k.charAt(0) === '_'; });

function limpiarUrl(s) { return String(s || '').trim(); }

/* La clave del destino en la app: minuscula y sin acentos, como hacen
   regionSlug() y normalizeDestinationText() en el resto del proyecto. Comparar
   contra los nombres crudos hacia fallar en silencio para 8 de 13 regiones. */
function claveDestino(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');
}

const porDestino = {};
let total = 0;
let conEjemplo = 0;

Object.keys(datos.destinos || {}).forEach(function (destinoCrudo) {
  const clave = claveDestino(destinoCrudo);
  if (!clave) return;
  const lista = datos.destinos[destinoCrudo];
  if (!Array.isArray(lista)) {
    Error_(destinoCrudo + ': se esperaba una lista de actividades.');
    return;
  }
  const salientes = [];
  lista.forEach(function (a, i) {
    const donde = destinoCrudo + '[' + i + '] ' + (a && a.titulo ? '"' + a.titulo + '"' : 'sin titulo');
    // El bloque de ejemplo no es una actividad: se documenta arriba y no se
    // genera. Sin esto, el archivo recien creado ya traeria una card con una
    // foto PLACEHOLDER que 404 y un precio inventado.
    if (a && a._ejemplo) { conEjemplo++; return; }
    if (!a || typeof a !== 'object') { Error_(donde + ': no es un objeto.'); return; }

    const titulo = String(a.titulo || '').trim();
    if (!titulo) { Error_(donde + ': falta "titulo".'); return; }

    const url = limpiarUrl(a.url);
    if (!url) { Error_(donde + ': falta "url".'); return; }
    if (!/^https:\/\/(www\.)?civitatis\.com\//i.test(url)) {
      Error_(donde + ': la url tiene que ser de civitatis.com, no "' + url.slice(0, 60) + '".');
      return;
    }
    if (url.indexOf('aid=' + afiliado) < 0) {
      Error_(donde + ': la url no trae ?aid=' + afiliado + '. Sin el identificador la reserva no paga comision.');
      return;
    }

    const precio = Number(a.precio);
    if (!Number.isFinite(precio) || precio <= 0) {
      Error_(donde + ': "precio" tiene que ser un numero mayor a 0.');
      return;
    }

    // Foto acreditada o nada. Ver la regla 1 y 2 de la cabecera.
    const imagen = limpiarUrl(a.imagen);
    const autor = String(a.autor || '').trim();
    const licencia = String(a.licencia || '').trim();
    if (!imagen) {
      /* El mensaje decia antes que sin foto la card sale con el degradado y el
         icono, "que es aceptable" — pero el return de abajo impedia generar la
         actividad igual. O sea: el texto describia una opcion que el codigo no
         tenia. La foto es obligatoria; se dice sin prometer una salida que no
         existe. */
      Error_(donde + ': falta "imagen". Es obligatorio: hace falta una foto de Wikimedia Commons con su autor y su licencia.');
      return;
    }
    if (/civitatis\.com/i.test(imagen)) {
      Error_(donde + ': la imagen no puede salir del CDN de Civitatis. Usar una foto de Wikimedia Commons con su autor y su licencia.');
      return;
    }
    if (!/^https:\/\//i.test(imagen)) {
      Error_(donde + ': la imagen tiene que ser una https de una fuente con licencia libre.');
      return;
    }
    if (!autor || !licencia) {
      Error_(donde + ': con foto va tambien "autor" y "licencia". Las licencias CC BY y CC BY-SA obligan a dar credito.');
      return;
    }

    salientes.push({
      titulo: titulo,
      url: url,
      precio: Math.round(precio * 100) / 100,
      descripcion: String(a.descripcion || '').trim().slice(0, 240),
      rating: Number(a.rating) || 0,
      resenas: Number(a.resenas) || 0,
      cancelacionGratis: !!a.cancelacionGratis,
      imagen: imagen,
      autor: autor,
      licencia: licencia
    });
    total++;
  });
  if (salientes.length) porDestino[clave] = salientes;
});

if (errores.length) {
  console.error('\n  FALLA build-actividades: ' + errores.length + ' problema(s)\n');
  errores.forEach(function (e) { console.error('    - ' + e); });
  console.error('\n  Arreglalos y volve a correr. El archivo generado NO se toco.\n');
  process.exit(1);
}

const claves = Object.keys(porDestino);
const cuerpo = 'window.' + GLOBAL + ' = ' + JSON.stringify(porDestino, null, 2).replace(/\n/g, '\n') + ';\n';
const cabecera = [
  "'use strict';",
  '/* GENERADO. No editar a mano: corré `npm run build:actividades`.',
  '   Fuente: data/actividades-civitatis.json.',
  '',
  '   Catalogo de actividades de Civitatis para pintar en las cards de la app, con',
  '   precio y foto reales y enlace de afiliado. Es lo que permite que la actividad',
  '   sume al presupuesto y abra el checkout, cosa que el widget embebido no puede',
  '   hacer por ser un iframe de otro origen.',
  '',
  '   Clave de destino: minuscula, sin acentos y con guiones.',
  '   Origen de los precios: los publica Civitatis, no son el precio de la fecha',
  '   que esta mirando la persona. La card lo dice. Para el precio por fecha hace',
  '   falta la API B2B.',
  '*/',
  ''
].join('\n');

const salida = cabecera + cuerpo;
const anterior = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : null;
if (anterior !== salida) fs.writeFileSync(SALIDA, salida, 'utf8');

console.log('actividades-civitatis' + (anterior === salida ? ' sin cambios' : ' regenerado') +
  ' (' + total + ' actividades en ' + claves.length + ' destinos, af ' + afiliado + ')');
if (conEjemplo) {
  console.log('  ' + conEjemplo + ' bloque(s) de ejemplo ignorado(s): no se generan');
  console.log('  el catálogo sigue vacío si eso es todo lo que hay en el JSON.');
}
if (!total) {
  console.log('  Sin actividades: la sección de tours sigue mostrando la lista local.');
}
void OBJETOS_VACIOS;
