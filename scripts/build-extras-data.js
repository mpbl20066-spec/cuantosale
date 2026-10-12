'use strict';
/*
 * Genera public/web/extras-data.js (window.MOCK_TOURS) desde el catalogo real.
 *
 *   node scripts/build-extras-data.js
 *
 * QUE HACE
 * Las pantallas de /web muestran tours con precio, foto y ficha. Antes esos datos
 * estaban copiados a mano en extras-data.js, y la copia se separo del catalogo: tres
 * tours que el sitio real muestra con foto (Clases de Surf, el barco pirata de
 * Bombinhas y el Off Road de Ilhabela) salian en /web sin foto, y las 30 galerias
 * de data/tour-galerias.json no llegaban nunca.
 *
 * DE DONDE SALE CADA COSA
 * El archivo se arma con las MISMAS fuentes y en el MISMO orden que lee el server
 * (lib/tours.js), para que /web vea lo que ve el sitio:
 *
 * - Titulo, precio, descripcion, ficha: data/tours.json (la unica fuente de verdad).
 *   El precio se convierte igual que en build-tours.js: precio_brl / cotizacion + margen.
 * - Foto: primero data/tour-photos.json (Wikimedia, con autor y licencia, que es lo que
 *   se muestra con credito) y, si no hay, la foto de la agencia (`image` del catalogo).
 *   Ese es el orden que usa public/app.js al pintar la card.
 * - Galeria: data/tour-galerias.json (hasta 3 fotos, como el server).
 * - Un tour con activo: false no se publica, igual que en el sitio.
 *
 * Idempotente: correrlo dos veces no cambia nada la segunda.
 *
 * Uso: node scripts/build-extras-data.js
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CATALOGO = path.join(RAIZ, 'data', 'tours.json');
const FOTOS = path.join(RAIZ, 'data', 'tour-photos.json');
const GALERIAS = path.join(RAIZ, 'data', 'tour-galerias.json');
const SALIDA = path.join(RAIZ, 'public', 'web', 'extras-data.js');

const datos = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
const meta = datos._meta || {};

function leerJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return {}; }
}
const fotos = leerJson(FOTOS);
const galerias = leerJson(GALERIAS);

// La conversion de reales a dolares. Mismo criterio y mismo _meta que
// scripts/build-tours.js: el precio de origen en reales gana sobre el de dolares,
// porque el de dolares envejece y el de reales es el que hay que re-cotizar.
const COTIZACION = Number(meta.cotizacion_brl_usd || 0);
const MARGEN = Number(meta.margen_usd || 0);
const HAY_CONVERSION = isFinite(COTIZACION) && COTIZACION > 0;

const avisos = [];
const errores = [];

function precioDe(t, donde) {
  const tieneBRL = t.precio_brl != null && String(t.precio_brl).trim() !== '';
  if (tieneBRL && HAY_CONVERSION) {
    const brl = Number(t.precio_brl);
    if (!isFinite(brl)) { errores.push(donde + ': precio_brl no es un numero'); return null; }
    return Number((brl / COTIZACION + MARGEN).toFixed(2));
  }
  const p = Number(t.precio);
  if (!isFinite(p)) { errores.push(donde + ': precio no es un numero (' + JSON.stringify(t.precio) + ')'); return null; }
  return p;
}

const txt = (v) => String(v == null ? '' : v).trim();
const lista = (v) => (Array.isArray(v) ? v : []).map(txt).filter(Boolean);

const porDestino = {};
let n = 0;
datos.tours.forEach(function (t, i) {
  const donde = 'tours[' + i + ']' + (t && t.titulo ? ' ("' + t.titulo.slice(0, 40) + '")' : '');
  if (!t || typeof t !== 'object') { errores.push(donde + ': no es un objeto'); return; }
  // Un tour apagado no se dibuja en el sitio, asi que tampoco en /web.
  if (t.activo === false) return;

  const titulo = txt(t.titulo);
  if (!titulo) { errores.push(donde + ': sin titulo'); return; }
  const destinos = Array.isArray(t.destinos) ? t.destinos.map((d) => String(d).trim()).filter(Boolean) : [];
  if (!destinos.length) { errores.push(donde + ': sin destinos'); return; }
  const precio = precioDe(t, donde);
  if (precio == null) return;

  // Mismo orden que public/app.js: la foto con autor y licencia primero, la de la
  // agencia despues. La de la agencia va sin autor, asi que no se acredita.
  const clave = destinos[0] + '#' + titulo;
  const f = fotos[clave];
  const foto = f && f.url ? f.url : txt(t.image);
  const autor = f && f.url ? (f.autor || 'Wikimedia Commons') : '';
  const licencia = f && f.url ? (f.licencia || '') : '';

  const fila = {
    titulo: titulo,
    precio: precio,
    duracion: txt(t.duracion),
    grupo: txt(t.grupo),
    foto: foto,
    autor: autor,
    licencia: licencia,
    descripcion: txt(t.descripcion),
    detalle: txt(t.detalle),
    incluye: lista(t.incluye),
    noIncluye: lista(t.no_incluye),
    llevar: lista(t.llevar),
    edad: txt(t.edad),
    cancelacion: txt(t.cancelacion)
  };
  const gal = galerias[clave];
  if (Array.isArray(gal) && gal.length) fila.imagenes = gal.slice(0, 3);

  destinos.forEach(function (d) {
    (porDestino[d] = porDestino[d] || []).push(fila);
    n++;
  });
});

// Un destino con dos nombres iguales en la misma fila romperia la lista de la pagina,
// que las recorre por indice.
Object.keys(porDestino).forEach(function (k) {
  const vistos = new Set();
  porDestino[k].forEach(function (f) {
    if (vistos.has(f.titulo)) errores.push(k + ': el tour "' + f.titulo + '" esta dos veces en la misma lista');
    vistos.add(f.titulo);
  });
});

if (errores.length) {
  console.error('data/tours.json tiene ' + errores.length + ' error(es) para extras-data.js:');
  errores.slice(0, 20).forEach((e) => console.error('  - ' + e));
  if (errores.length > 20) console.error('  ... y ' + (errores.length - 20) + ' mas');
  console.error('\nNo se escribio public/web/extras-data.js.');
  process.exit(1);
}

const CABECERA = '/* Snapshot del catalogo real de tours para las pantallas de /web.\n'
  + '   NO EDITAR A MANO: se regenera con `node scripts/build-extras-data.js`.\n'
  + '   Fuentes: data/tours.json (titulo, precio, ficha), data/tour-photos.json (foto con\n'
  + '   autor y licencia) y data/tour-galerias.json (galeria). Es lo mismo que arma\n'
  + '   lib/tours.js para el sitio, con el mismo orden de preferencia de la foto.\n'
  + '   Precio: USD por persona, referencial. */\n';

const cuerpo = CABECERA + 'window.MOCK_TOURS = ' + JSON.stringify(porDestino) + ';\n';
const anterior = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : null;
if (anterior !== cuerpo) {
  fs.writeFileSync(SALIDA, cuerpo, 'utf8');
  console.log('escrito: public/web/extras-data.js (' + n + ' apariciones en ' + Object.keys(porDestino).length + ' destinos)');
} else {
  console.log('public/web/extras-data.js ya estaba al dia (' + n + ' tours en ' + Object.keys(porDestino).length + ' destinos)');
}

const sinFoto = [];
Object.keys(porDestino).forEach(function (k) {
  porDestino[k].forEach(function (f) { if (!f.foto) sinFoto.push(k + '#' + f.titulo); });
});
console.log('  ' + Object.keys(porDestino).length + ' destinos, ' + n + ' filas, ' + sinFoto.length + ' sin foto (degradado con el icono)');
if (sinFoto.length) {
  console.log('  para buscarles foto: node buscar-fotos-tours.js');
  sinFoto.forEach((k) => console.log('    - ' + k));
}
if (avisos.length) { console.log('\navisos:'); avisos.forEach((a) => console.log('  - ' + a)); }