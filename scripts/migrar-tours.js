'use strict';
/*
 * Migra los 111 tours que estaban escritos a mano en public/app.js a
 * data/tours.json, que pasa a ser la fuente de verdad.
 *
 *   node scripts/migrar-tours.js
 *
 * Es una migracion de una sola vez: corre antes de borrar LOCAL_TOURS de
 * app.js, y despues el archivo ya no se vuelve a necesitar. Queda en el repo
 * para que quede registrado de donde salio cada tour.
 *
 * Lo que NO se toca al migrar: los titulos. Eso es deliberado y es lo mas
 * importante del script.
 *
 * TOUR_PHOTOS se indexa por 'destinoKey#Titulo' con el TITULO EXACTO, porque las
 * fotos se revisaron una por una mirando la imagen. Si al migrar se normaliza
 * un titulo (mayusculas, tildes, "Paseo en barco Buzios" contra "Paseo en barco
 * por las playas de Buzios"), la clave deja de existir, la foto no se encuentra
 * y la card cae al degradado con el icono de la actividad. Se pierde la foto
 * sin que nada avise: no es un error, es un dato que no esta.
 *
 * Por eso el `titulo` sale tal cual estaba y la normalizacion, si alguna vez
 * hace falta, va en un campo aparte (`titulo_buscar`) que solo usa el buscador
 * de fotos.
 *
 * Idempotente: si data/tours.json ya existe y tiene 111 tours, no lo pisa.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const APP = path.join(RAIZ, 'public', 'app.js');
const SALIDA = path.join(RAIZ, 'data', 'tours.json');

const INICIO = 'var LOCAL_TOURS = [';
const FIN = '\n  ];';

const YA_MIGRADO = process.argv.includes('--force');

if (fs.existsSync(SALIDA) && !YA_MIGRADO) {
  const actual = JSON.parse(fs.readFileSync(SALIDA, 'utf8'));
  console.log('data/tours.json ya existe (' + actual.tours.length + ' tours).');
  console.log('Si queres volver a generarlo desde app.js: node scripts/migrar-tours.js --force');
  process.exit(0);
}

const app = fs.readFileSync(APP, 'utf8');
const desde = app.indexOf(INICIO);
if (desde < 0) throw new Error('no se encontro ' + INICIO + ' en public/app.js');
const hasta = app.indexOf(FIN, desde);
if (hasta < 0) throw new Error('no se encontro el cierre del array LOCAL_TOURS');

// Solo el cuerpo del array. Se evalua con las dos funciones que el array usa:
// tour() arma el objeto y florianopolisTourPrice() convierte los precios que
// de Florianopolis venian en reales.
const cuerpo = app.slice(desde + INICIO.length, hasta);

/* Los precios de Florianopolis estan en BRL y la conversion a USD la hacia
 * florianopolisTourPrice() con la cotizacion PTAX de un dia fijo (R$5,1414 por
 * US$1) mas US$5 de margen. Migrar solo el USD perdia el numero de origen, que
 * es el unico que sirve para re-cotizar cuando cambia la moneda.
 *
 * Se recovera en dos pasos: la funcion guarda el ultimo BRL que vio y tour() lo
 * se adjudica antes de limpiarlo. Funciona porque el argumento del precio se
 * evalua ANTES de llamar a tour(), asi que el orden es siempre BRL primero,
 * tour() despues. */
let ultimoBRL = null;
function florianopolisTourPrice(brl) {
  ultimoBRL = brl;
  return Number((brl / 5.1414 + 5).toFixed(2));
}
function tour(destinations, destination, title, description, price, details) {
  const precio_brl = ultimoBRL;
  ultimoBRL = null;
  return { destinos: destinations, destino: destination, titulo: title, descripcion: description, precio: price, precio_brl: precio_brl, detalle: details };
}

const crudos = new Function('tour', 'florianopolisTourPrice', 'return [' + cuerpo + '];')(tour, florianopolisTourPrice);

if (ultimoBRL !== null) throw new Error('quedo un precio BRL sin asignar: el tour() que lo consumia no esta en el array');

// El nombre del destino vive en el tour, pero se repite en cada entrada. Se
// sube a un mapa aparte para no escribir "Búzios, Brasil" 8 veces, y para que
// el nombre de una ciudad se cambie en UN lugar.
const destinos = {};
for (const t of crudos) {
  if (t.destinos.length !== 1) throw new Error('un tour con ' + t.destinos.length + ' destinos: ' + t.titulo);
  const key = t.destinos[0];
  if (destinos[key] && destinos[key] !== t.destino) {
    throw new Error('el destino ' + key + ' tiene dos nombres: "' + destinos[key] + '" y "' + t.destino + '"');
  }
  destinos[key] = t.destino;
}

const salidas = crudos.map((t) => {
  const o = { destinos: t.destinos, destino: t.destino, titulo: t.titulo, descripcion: t.descripcion, precio: t.precio };
  // precio_brl solo cuando el precio venia en reales. Los demas campos del
  // tour tambien van vacios en la Sheet, y el build los rellena.
  if (t.precio_brl != null) o.precio_brl = t.precio_brl;
  o.detalle = t.detalle;
  return o;
});

const doc = {
  _meta: {
    descripcion: 'Catalogo de tours y actividades por destino. Es la UNICA fuente de verdad: public/tours.generated.js se genera desde acá con `npm run build:tours`, y ese archivo es el que dibuja las cards.',
    unidad: 'USD por persona, con el margen operativo para la venta manual ya incluido. El precio se muestra como REFERENCIAL: no hay operador de tours que lo tome.',
    tipo_cambio_ref: 'R$5,1414 = US$1 (PTAX 23/09/2026). Se uso solo para los tours de Florianopolis, que vienen en reales.',
    cotizacion_brl_usd: 5.1414,
    margen_usd: 5,
    campos_precio: 'precio_brl gana sobre precio: es el precio que cobra el operador de verdad y el que hay que re-cotizar cuando cambia la moneda. El build lo convierte con _meta.cotizacion_brl_usd y le suma _meta.margen_usd. precio se usa solo cuando no hay precio_brl.',
    actualizado: new Date().toISOString().slice(0, 10),
    origen_de_esta_migracion: 'Los 111 tours estaban escritos a mano en public/app.js (array LOCAL_TOURS) y se movieron acá con scripts/migrar-tours.js el ' + new Date().toISOString().slice(0, 10) + '. A partir de este archivo los edita la Sheet de Google Drive.',
    aviso: 'El precio es REFERENCIAL, no un precio de reserva. No hay operador de tours que lo tome: el boton arma el pedido por WhatsApp y el precio se confirma segun fecha, cupo y operador. La card lo rotula como estimacion justamente por esto.',
    aviso_fotos: 'TOUR_PHOTOS se indexa por "destinoKey#titulo" con el titulo EXACTO. Cambiar un titulo deja la card sin foto (cae al degradado con el icono) sin que nada falle. Para fotos de un tour nuevo: node buscar-fotos-tours.js',
    columnas: {
      'destinos': 'Key del destino, como en lib/model.js. Solo uno por tour: si un tour sirve a dos ciudades, se duplica la fila.',
      'destino': 'Nombre para mostrar, con pais. Sale del mapa _destinos si se deja vacio.',
      'titulo': 'EXACTO como se muestra. Es la clave de la foto: no lo reescribas sin correr antes buscar-fotos-tours.js.',
      'descripcion': 'Una linea, la que va en la bajada de la card.',
      'precio': 'Numero en USD por persona. Sin signo ni separador de miles. Acepta "45.50", "45,50" y "US$ 45".',
      'precio_brl': 'Opcional. El precio real en reales. Gana sobre "precio": el build lo convierte con la cotizacion de _meta y le suma el margen. Llenalo cuando el precio venga de un operador brasilero.',
      'detalle': 'El parrafo largo que se abre en el modal. Ahi van incluidas, duracion y qué llevar.'
    }
  },
  _destinos: destinos,
  tours: salidas
};

fs.writeFileSync(SALIDA, JSON.stringify(doc, null, 2) + '\n', 'utf8');

const conBRL = salidas.filter((t) => t.precio_brl != null).length;
console.log('data/tours.json: ' + salidas.length + ' tours, ' + Object.keys(destinos).length + ' destinos');
console.log('  ' + conBRL + ' con precio de origen en BRL (Florianopolis)');
console.log('  siguiente paso: npm run build:tours');
