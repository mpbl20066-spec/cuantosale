'use strict';
/*
 * Genera public/tours.generated.js desde data/tours.json.
 *
 *   node scripts/build-tours.js
 *
 * Mismo contrato que los otros generadores del proyecto (build-costos.js,
 * build-transfer.js): el JSON manda, el archivo generado se commitea, y correrlo
 * dos veces no cambia nada la segunda.
 *
 * Por que un archivo aparte y no un bloque escrito dentro de public/app.js:
 * public/app.js son 680 KB y se edita a mano; pegarle 111 lineas de datos
 * generado al medio hace que cada `git diff` muestre ruido y que Edit chops en
 * el lugar equivocado. Con un `<script>` aparte, index.html lo carga antes que
 * app.js (igual que /daily-costs.js) y app.js solo lee window.CS_TOURS_DATA.
 *
 * LO QUE NO VALIDA ESTE SCRIPT, A PROPOSITO:
 *
 * Que el destino exista en lib/model.js. Un destino desconocido no rompe nada:
 * toursFor() filtra por key y un key que no esta en ningun destino simplemente
 * no se dibuja. Faltarlo aca convertia una fila equivocada en un build caido,
 * y en un deploy automatico eso es una web rota por una fila mal escrita.
 *
 * Si el destino no existe, el aviso sale igual, pero el build sigue.
 *
 * Lo que si es error duro: un tour sin titulo, con precio no numerico o con
 * destinos vacio. Esos no se pueden dibujar, y ademas son un error de tipeo
 * silencioso.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'tours.json');
const CLIENTE_PATH = path.join(RAIZ, 'public', 'tours.generated.js');
const APP_PATH = path.join(RAIZ, 'public', 'app.js');

const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const meta = datos._meta || {};
const NOMBRES = datos._destinos || {};

// Un destino existe si el modelo lo trae. Se lee de lib/model.js con un
// require normal, que es lo que hace test.js: si el modelo cambia la forma de
// exportar DEST, esto falla aqui y no en produccion con un try/catch.
let DEST = {};
try {
  DEST = require(path.join(RAIZ, 'lib', 'model.js')).DEST || {};
} catch (e) {
  console.warn('aviso: no se pudo leer DEST de lib/model.js (' + e.message + '). Se saltea el chequeo de destinos.');
}

const errores = [];
const avisos = [];
const usados = new Set();

/* La conversion de reales a dolares.
 *
 * Los 10 tours de Florianopolis tienen el precio de origen en reales, que es lo
 * que el operador cobra de verdad. El precio en dolares que se muestra es una
 * conversion MAS un margen fijo de USD 5 por persona.
 *
 * El precio en reales gana sobre el de dolares cuando esta, y la razon es que
 * el de dolares envejece: es el resultado de una cotizacion de un dia
 * determinado, mientras que el de reales es lo que hay que re-cotizar cuando
 * cambia la moneda. Al reescribir la Sheet con un precio nuevo, hay que tocar
 * precio_brl; el de dolares solo sirve si no hay origien en reales.
 *
 * La cotizacion vive en _meta, no aca. Si mañana cambia el valor, se cambia en
 * un lugar y build-tours no se toca.
 *
 * Sin _meta.cotizacion_brl y sin _meta.margen_usd, la conversion NO se hace y el
 * precio_brl se ignora con un aviso, en vez de publicar R$ 190 como si fueran
 * dolares. Ese es el peor resultado posible: un numero Huge, creible y
 * multiplicado por cuatro. */
const COTIZACION = Number(meta.cotizacion_brl_usd || 0);
const MARGEN = Number(meta.margen_usd || 0);
const HAY_CONVERSION = isFinite(COTIZACION) && COTIZACION > 0;

if (!HAY_CONVERSION && datos.tours.some((t) => t && t.precio_brl != null && String(t.precio_brl).trim() !== '')) {
  avisos.push('hay tours con precio_brl pero _meta no define cotizacion_brl_usd: se usa el precio en dolares de cada fila. Setealo en data/tours.json para no perder el precio de origen.');
}

const filas = datos.tours.map((t, i) => {
  const donde = 'tours[' + i + ']' + (t && t.titulo ? ' ("' + t.titulo.slice(0, 40) + '")' : '');

  if (!t || typeof t !== 'object') {
    errores.push(donde + ': no es un objeto');
    return null;
  }

  // Un tour apagado (activo: false) no se dibuja ni se valida: puede estar esperando su precio.
  if (t.activo === false) return null;

  const titulo = String(t.titulo == null ? '' : t.titulo).trim();
  if (!titulo) errores.push(donde + ': sin titulo');

  const destinos = Array.isArray(t.destinos) ? t.destinos.map((d) => String(d).trim()).filter(Boolean) : [];
  if (!destinos.length) errores.push(donde + ': sin destinos');
  destinos.forEach((d) => usados.add(d));

  const tieneBRL = t.precio_brl != null && String(t.precio_brl).trim() !== '';

  // El precio es el dato que mas duele equivocar: si viene "R$ 90" o "45,50"
  // el Number() da NaN y la card muestra "US$ NaN". Por eso se acepta el
  // formato de Sheet ("45.50" con punto, o "45,50" con coma) y se rechaza
  // cualquier otra cosa con un error, en vez de dejar pasar un NaN.
  let precio = aNumero(t.precio, donde, 'precio', errores);
  if (tieneBRL && HAY_CONVERSION) {
    const brl = aNumero(t.precio_brl, donde, 'precio_brl', errores);
    if (brl != null) precio = Number((brl / COTIZACION + MARGEN).toFixed(2));
  } else if (tieneBRL) {
    avisos.push(donde + ': tiene precio_brl pero no hay cotizacion definida, se publica el precio en dolares de la fila');
  }

  if (precio != null && precio < 0) errores.push(donde + ': precio negativo');

  const descripcion = String(t.descripcion == null ? '' : t.descripcion).trim();
  if (!descripcion) avisos.push(donde + ': sin descripcion (la card sale sin bajada)');

  const detalle = String(t.detalle == null ? '' : t.detalle).trim();

  // El nombre del destino se resuelve acá y no en el cliente: si la Sheet lo
  // deja vacio, sale del mapa _destinos que la migracion escribio. Asi el
  // nombre de una ciudad se corrige en un solo lugar, no en 8 filas.
  let destino = String(t.destino == null ? '' : t.destino).trim();
  if (!destino && destinos.length === 1) destino = NOMBRES[destinos[0]] || '';
  if (!destino) errores.push(donde + ': sin nombre de destino y no se puede deducir de _destinos');

  // Foto de la agencia (con permiso): una URL http(s). Sin ella la card usa TOUR_PHOTOS o el degradado.
  const imagen = /^https?:\/\//i.test(String(t.image == null ? '' : t.image).trim()) ? String(t.image).trim() : '';
  // Ficha del modal de detalle: texto tal cual se muestra; vacio = no se dibuja la celda.
  const txt = (v) => String(v == null ? '' : v).trim();
  // Listas (incluye / no incluye / que llevar): un arreglo de frases; se descartan las vacias.
  const lista = (v) => (Array.isArray(v) ? v : []).map(txt).filter(Boolean);
  return { destinos: destinos, destino: destino, titulo: titulo, descripcion: descripcion, precio: precio, details: detalle, image: imagen,
    duracion: txt(t.duracion), grupo: txt(t.grupo), salida: txt(t.salida), edad: txt(t.edad), cancelacion: txt(t.cancelacion),
    incluye: lista(t.incluye), noIncluye: lista(t.no_incluye), llevar: lista(t.llevar) };
});

function aNumero(valor, donde, campo, colector) {
  if (valor == null || valor === '') {
    colector.push(donde + ': sin ' + campo);
    return null;
  }
  if (typeof valor === 'number') {
    if (!isFinite(valor)) {
      colector.push(donde + ': ' + campo + ' no es un numero finito');
      return null;
    }
    return valor;
  }
  // Sheet manda texto. Acepta "45.50", "45,50", "US$ 45", "R$ 90" y "45".
  const limpio = String(valor).replace(/[^\d,.-]/g, '');
  if (!/[0-9]/.test(limpio)) {
    colector.push(donde + ': ' + campo + ' no se puede leer como numero (' + JSON.stringify(valor) + ')');
    return null;
  }
  // Si hay coma y NO punto, la coma es el separador decimal. "1.234,56" es
  // brasileiro/europeo; "1,234.56" es ingles. El caso de un solo separador se
  // resuelve por cuál aparece.
  const coma = limpio.indexOf(',');
  const punto = limpio.indexOf('.');
  let normalizado = limpio;
  if (coma >= 0 && punto < 0) normalizado = limpio.replace(',', '.');
  else if (coma >= 0 && punto >= 0 && coma > punto) normalizado = limpio.replace(/\./g, '').replace(',', '.');
  else if (coma >= 0 && punto >= 0) normalizado = limpio.replace(/,/g, '');
  const n = Number(normalizado);
  if (!isFinite(n)) {
    colector.push(donde + ': ' + campo + ' no se puede leer como numero (' + JSON.stringify(valor) + ')');
    return null;
  }
  return n;
}

// Destinos escritos a mano que el modelo no trae. Aviso, no error: el tour
// el tour no se dibuja en ningun lado hasta que el key exista.
Object.keys(NOMBRES).forEach((k) => {
  if (DEST[k] === undefined) avisos.push('el destino "' + k + '" (' + NOMBRES[k] + ') no esta en lib/model.js: sus tours no se van a ver');
});

if (errores.length) {
  console.error('data/tours.json tiene ' + errores.length + ' error(es):');
  errores.forEach((e) => console.error('  - ' + e));
  console.error('\nNo se escribio public/tours.generated.js.');
  process.exit(1);
}

const validos = filas.filter(Boolean);

// --- cobertura de fotos -------------------------------------------------
// No es un error: la mayoria de los tours muestran un degradado con el icono de
// la actividad, que es lo que ya pasaba. Se reporta porque es la falla
// silenciosa tipica de este catalogo: un tour nuevo del Drive entra a publicar
// sin foto y no se nota hasta que alguien lo mira.
let conFoto = 0;
const sinFoto = [];
try {
  const app = fs.readFileSync(APP_PATH, 'utf8');
  const s = app.indexOf('var TOUR_PHOTOS = {');
  const e = app.indexOf('\n  };', s);
  if (s >= 0 && e > 0) {
    const fotos = new Set(Object.keys(eval('(' + app.slice(s + 'var TOUR_PHOTOS = '.length, e + 4) + ')')));
    validos.forEach((t) => {
      const clave = t.destinos[0] + '#' + t.titulo;
      if (fotos.has(clave)) conFoto++;
      else sinFoto.push(clave);
    });
  }
} catch (e) {
  console.warn('aviso: no se pudo leer TOUR_PHOTOS de app.js (' + e.message + ')');
}

// --- archivo del cliente ------------------------------------------------
const literal = (valor, sangria) => {
  const pre = ' '.repeat(sangria);
  return JSON.stringify(valor, null, 2).split('\n').map((l, i) => (i === 0 ? l : pre + l)).join('\n');
};

// Fotos extra por tour (data/tour-galerias.json, lo arma scripts/galerias-tours.js).
let galerias = {};
try { galerias = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'tour-galerias.json'), 'utf8')); } catch (e) { galerias = {}; }
const cuerpo = validos.map((t) => {
  return '  { destinations: ' + JSON.stringify(t.destinos) +
    ', destination: ' + JSON.stringify(t.destino) +
    ', title: ' + JSON.stringify(t.titulo) +
    ', description: ' + JSON.stringify(t.descripcion) +
    ', price: ' + JSON.stringify(t.precio) +
    ', details: ' + JSON.stringify(t.details) +
    (t.image ? ', image: ' + JSON.stringify(t.image) : '') +
    (galerias[t.destinos[0] + '#' + t.titulo] ? ', images: ' + JSON.stringify(galerias[t.destinos[0] + '#' + t.titulo].slice(0, 3)) : '') +
    (t.duracion ? ', duracion: ' + JSON.stringify(t.duracion) : '') +
    (t.grupo ? ', grupo: ' + JSON.stringify(t.grupo) : '') +
    (t.salida ? ', salida: ' + JSON.stringify(t.salida) : '') +
    (t.edad ? ', edad: ' + JSON.stringify(t.edad) : '') +
    (t.cancelacion ? ', cancelacion: ' + JSON.stringify(t.cancelacion) : '') +
    (t.incluye.length ? ', incluye: ' + JSON.stringify(t.incluye) : '') +
    (t.noIncluye.length ? ', noIncluye: ' + JSON.stringify(t.noIncluye) : '') +
    (t.llevar.length ? ', llevar: ' + JSON.stringify(t.llevar) : '') + ' }';
}).join(',\n');

/* Los destinos van como cuarto parametro, y no dentro de _meta, porque no son
   metadata del catalogo: son la lista de destinos que existen en lib/model.js.
   El panel de /tours la usa para ofrecer las keys validas al crear un tour, que
   es justo el dato que hace falta y que no esta en la tabla. */
const destinosOrdenados = {};
Object.keys(NOMBRES).sort().forEach(function (k) { destinosOrdenados[k] = NOMBRES[k]; });

const encabezado =
  "'use strict';\n" +
  "/* GENERADO. No editar a mano: corré `npm run build:tours`.\n" +
  "   Fuente: data/tours.json (que a su vez documenta, por tour, de dónde sale el\n" +
  '   precio, en qué moneda y cuándo se verificó).\n' +
  '   Es el RESPALDO: la web lee los tours de la tabla de Supabase (lib/tours.js)\n' +
  '   y usa este archivo solo si la base no responde. Por eso se commitea. */\n' +
  '(function (root, tours, meta, destinos) {\n' +
  '  root.CS_TOURS_DATA = tours;\n' +
  '  root.CS_TOURS_META = meta;\n' +
  '  root.CS_TOURS_DESTINOS = destinos;\n' +
  '  // La prueba de test.js lo requirea, asi que tiene que servir en node tambien.\n' +
  '  if (typeof module !== \'undefined\' && module.exports) {\n' +
  '    module.exports = tours;\n' +
  '    Object.defineProperty(module.exports, "destinos", { value: destinos, enumerable: false });\n' +
  '  }\n' +
  "})(typeof globalThis !== 'undefined' ? globalThis : this, [\n" + cuerpo + '\n], ' + literal({
  descripcion: meta.descripcion || '',
  unidad: meta.unidad || '',
  aviso: meta.aviso || '',
  aviso_fotos: meta.aviso_fotos || '',
  actualizado: meta.actualizado || ''
}, 2).split('\n').join('\n') + ', ' + literal(destinosOrdenados, 0) + ');\n';

const anterior = fs.existsSync(CLIENTE_PATH) ? fs.readFileSync(CLIENTE_PATH, 'utf8') : null;
if (anterior !== encabezado) {
  fs.writeFileSync(CLIENTE_PATH, encabezado, 'utf8');
  console.log('escrito: public/tours.generated.js (' + validos.length + ' tours)');
} else {
  console.log('public/tours.generated.js ya estaba al dia (' + validos.length + ' tours)');
}

console.log('  ' + usados.size + ' destinos, ' + conFoto + ' con foto, ' + sinFoto.length + ' sin foto');
if (sinFoto.length) {
  console.log('  sin foto (muestran el degradado con el icono):');
  sinFoto.slice(0, 8).forEach((k) => console.log('    - ' + k));
  if (sinFoto.length > 8) console.log('    ... y ' + (sinFoto.length - 8) + ' mas');
  console.log('  para buscarles foto: node buscar-fotos-tours.js');
}
if (avisos.length) {
  console.log('\navisos:');
  avisos.forEach((a) => console.log('  - ' + a));
}
