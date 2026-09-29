/*
 * Seccion de alojamiento: que la eleccion inicial del tipo de viaje siempre
 * tenga algo que mostrar.
 *
 * El bug que cubre: al abrir un destino, la app elige sola el tipo de
 * alojamiento a partir del estilo de viaje. Si ese tipo no estaba en la lista de
 * tipos disponibles que mandaba el server, el <select> lo cambiaba por el
 * primero de la lista —en silencio y DESPUES de que el titulo, la nota y la
 * insignia ya se hubieran calculado con el tipo viejo—, y despues las tarjetas
 * se filtraban por el tipo nuevo contra hoteles que venían rotulados con el
 * viejo. La lista quedaba en cero y en pantalla se leia:
 *
 *   Hoteles para viajar intermedio   [select: Económico]
 *   No encontramos alojamientos de categoría Intermedio
 *
 * Tres textos y un filtro que no decian lo mismo, y la seccion de alojamiento
 * arrancando vacia en la pantalla principal.
 *
 * Las funciones se recortan de public/app.js con el mismo metodo que
 * test-checkout.js, contando llaves. Se prueban las de verdad: si alguien las
 * reescribe, la prueba corre contra el codigo nuevo.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

function extraer(nombre) {
  const i = src.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('no existe ' + nombre);
  const k = src.indexOf('{', i);
  let nivel = 0;
  for (let p = k; p < src.length; p++) {
    if (src[p] === '{') nivel++;
    else if (src[p] === '}') { nivel--; if (nivel === 0) return src.slice(i, p + 1); }
  }
  throw new Error('llaves sin cerrar en ' + nombre);
}

let fallos = 0;
function prueba(nombre, fn) {
  try { fn(); console.log('  ok  ' + nombre); }
  catch (e) { fallos++; console.log('  FALLA ' + nombre + ': ' + e.message); }
}
function igual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error((msg ? msg + ': ' : '') + 'esperado ' + JSON.stringify(b) + ', vino ' + JSON.stringify(a));
  }
}

const HOTEL_TYPE_LABELS = {
  'all-inclusive': 'All Inclusive', resort: 'Resort', boutique: 'Boutique',
  economico: 'Económico', intermedio: 'Intermedio', confort: 'Confort'
};
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hotelStyle(meta) {
  const typeProfiles = {
    'all-inclusive': { tier: 'all-inclusive', title: 'All Inclusive', badge: 'ALL INCLUSIVE', description: 'Regimen con comidas.' },
    resort: { tier: 'resort', title: 'Resort', badge: 'RESORT', description: 'Alojamientos tipo resort.' },
    boutique: { tier: 'boutique', title: 'Boutique', badge: 'HOTEL BOUTIQUE', description: 'Alojamientos boutique.' },
    economico: { tier: 'eco', title: 'Económico', badge: 'SÚPER ECONÓMICO', description: 'Opciones de bajo costo.' },
    intermedio: { tier: 'moderado', title: 'Intermedio', badge: 'MEJOR RELACIÓN PRECIO-CALIDAD', description: 'Gama media.' },
    confort: { tier: 'alto', title: 'Confort', badge: 'COMODIDAD PREMIUM', description: 'Categoria superior.' }
  };
  if (typeProfiles[meta.hotelType]) return typeProfiles[meta.hotelType];
  const styles = {
    ahorro: { tier: 'eco', title: 'Ahorrar al máximo', badge: 'SÚPER ECONÓMICO', description: 'Bajo costo.' },
    eq: { tier: 'moderado', title: 'Equilibrado', badge: 'MEJOR RELACIÓN PRECIO-CALIDAD', description: 'Gama media.' },
    comodo: { tier: 'alto', title: 'Con comodidad', badge: 'COMODIDAD PREMIUM', description: 'Alta gama.' }
  };
  return styles[meta.style] || styles.eq;
}

const cuerpo = ['resolveHotelTypeForMeta', 'hotelesQuePasanElTipo', 'hotelTypeSelectMarkup']
  .map(extraer).join('\n');
const deps = 'var HOTEL_TYPE_LABELS = ' + JSON.stringify(HOTEL_TYPE_LABELS) + ';\n' +
  'function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }\n' +
  'function hotelStyle(meta) {\n' +
  '  const p = { "all-inclusive": { tier: "all-inclusive", title: "All Inclusive", badge: "ALL INCLUSIVE", description: "d" },\n' +
  '    resort: { tier: "resort", title: "Resort", badge: "RESORT", description: "d" },\n' +
  '    boutique: { tier: "boutique", title: "Boutique", badge: "HOTEL BOUTIQUE", description: "d" },\n' +
  '    economico: { tier: "eco", title: "Económico", badge: "SUPER ECONOMICO", description: "d" },\n' +
  '    intermedio: { tier: "moderado", title: "Intermedio", badge: "MEDIO", description: "d" },\n' +
  '    confort: { tier: "alto", title: "Confort", badge: "ALTO", description: "d" } };\n' +
  '  if (p[meta.hotelType]) return p[meta.hotelType];\n' +
  '  const s = { ahorro: { tier: "eco", title: "Ahorrar al máximo", badge: "SUPER", description: "d" },\n' +
  '    eq: { tier: "moderado", title: "Equilibrado", badge: "MEDIO", description: "d" },\n' +
  '    comodo: { tier: "alto", title: "Con comodidad", badge: "ALTO", description: "d" } };\n' +
  '  return s[meta.style] || s.eq;\n' +
  '}\n';

const fns = new Function(deps + cuerpo + '\nreturn { resolveHotelTypeForMeta, hotelesQuePasanElTipo, hotelTypeSelectMarkup };')();
const { resolveHotelTypeForMeta, hotelesQuePasanElTipo, hotelTypeSelectMarkup } = fns;

// El caso exacto de la pantalla: el server no declaro disponible el tipo que
// elegía el estilo de viaje. Este es el que devolvia la seccion vacia.
const metaCabo = {
  hotelType: 'intermedio',
  tiposHotelDisponibles: ['economico', 'all-inclusive'],
  hotels: [{ name: 'Apartamento Praia das Dunas', hotelType: 'intermedio' },
    { name: 'Seu Cantinho em Familia', hotelType: 'intermedio' },
    { name: 'Pousada Areia do Forte', hotelType: 'intermedio' }]
};

console.log('Seccion de alojamiento');

prueba('si el tipo pedido esta disponible, no se toca', function () {
  const meta = { hotelType: 'confort', tiposHotelDisponibles: ['economico', 'intermedio', 'confort'] };
  igual(resolveHotelTypeForMeta(meta), 'confort');
  igual(meta.hotelType, 'confort', 'no puede mutar meta');
});

prueba('si no hay dato de disponibles, se respeta lo pedido', function () {
  igual(resolveHotelTypeForMeta({ hotelType: 'boutique' }), 'boutique');
  igual(resolveHotelTypeForMeta({ hotelType: 'boutique', tiposHotelDisponibles: [] }), 'boutique');
  igual(resolveHotelTypeForMeta({ hotelType: 'boutique', tiposHotelDisponibles: null }), 'boutique');
  igual(resolveHotelTypeForMeta({}), 'intermedio', 'sin tipo se asume el de por defecto');
});

prueba('el tipo corregido siempre esta en la lista de disponibles', function () {
  const tipos = ['economico', 'all-inclusive', 'resort'];
  for (const pedido of ['intermedio', 'confort', 'boutique', 'resort', 'all-inclusive', 'economico']) {
    const r = resolveHotelTypeForMeta({ hotelType: pedido, tiposHotelDisponibles: tipos });
    if (tipos.indexOf(r) < 0) throw new Error('pedido ' + pedido + ' -> ' + r + ', que no esta en ' + tipos.join('/'));
  }
});

prueba('el caso de la pantalla: el tipo corregido deja pasar los hoteles que hay', function () {
  // Se resuelve como lo haria hotelOptions: primero el tipo, despues el filtro.
  const tipo = resolveHotelTypeForMeta(metaCabo);
  const strictType = ['all-inclusive', 'resort', 'boutique'].indexOf(tipo) >= 0;
  const pasan = hotelesQuePasanElTipo(metaCabo.hotels, tipo, strictType);
  if (!pasan.length) throw new Error('la lista quedo vacia: el tipo resuelto fue ' + tipo);
  igual(pasan.length, 3, 'con el respaldo tienen que aparecer los tres');
});

prueba('el titulo, la insignia y el mensaje describen el tipo que se filtra', function () {
  // Lo que hotelOptions() hace: resolver el tipo, y de ahi leer el perfil, la
  // etiqueta del estado vacio y el <select>. Si el tipo se corrigiera despues de
  // calcular el perfil, el titulo y el mensaje quedarian con el tipo viejo.
  const tipo = resolveHotelTypeForMeta(metaCabo);
  const profile = hotelStyle({ hotelType: tipo });
  const markup = hotelTypeSelectMarkup(metaCabo, tipo);
  const etiquetaDelSelect = (markup.match(/<option value="([^"]+)" selected>/) || [])[1];
  if (!etiquetaDelSelect) throw new Error('el select no marco ninguna opcion');
  igual(etiquetaDelSelect, tipo, 'el select tiene que marcar el tipo que se esta filtrando');
  if (!profile.title) throw new Error('el perfil del tipo resuelto vino vacio');
});

prueba('el select ofrece solo los tipos disponibles y marca el resuelto', function () {
  const tipo = resolveHotelTypeForMeta(metaCabo);
  const markup = hotelTypeSelectMarkup(metaCabo, tipo);
  const opciones = [...markup.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  igual(opciones, ['economico', 'all-inclusive']);
  igual((markup.match(/ selected>/g) || []).length, 1, 'solo una opcion puede quedar marcada');
});

prueba('el select marca el tipo que se le pasa, no el que esta en meta', function () {
  // El bug era que el select decidia el tipo y mutaba meta. Ahora recibe el tipo
  // ya resuelto: si se le pasara 'confort' con meta en 'intermedio', tiene que
  // marcar 'confort'.
  const markup = hotelTypeSelectMarkup({ hotelType: 'intermedio', tiposHotelDisponibles: ['intermedio', 'confort'] }, 'confort');
  igual((markup.match(/<option value="([^"]+)" selected>/) || [])[1], 'confort');
});

prueba('sin dato de disponibles el select ofrece los seis', function () {
  const markup = hotelTypeSelectMarkup({ hotelType: 'intermedio' }, 'intermedio');
  igual([...markup.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]),
    ['economico', 'intermedio', 'confort', 'boutique', 'resort', 'all-inclusive']);
});

/* El filtro de las tarjetas. Para los tipos del espectro (economico, intermedio,
   confort) nunca puede devolver una lista vacia si hay hoteles: el server ya los
   eligio por banda de precio y garantiza que no manda una lista vacia, asi que
   una lista vacia aca seria un desajuste, no una respuesta. Para los estrictos
   (boutique, resort, all-inclusive) la lista vacia SI es la respuesta honesta. */
prueba('los tipos del espectro nunca filtran hasta dejar la lista vacia', function () {
  for (const tipo of ['economico', 'intermedio', 'confort']) {
    const catalogo = [{ name: 'A', hotelType: 'confort' }, { name: 'B', hotelType: 'confort' }];
    const pasan = hotelesQuePasanElTipo(catalogo, tipo, false);
    if (!pasan.length) throw new Error(tipo + ': dejo la lista vacia con ' + catalogo.length + ' hoteles del server');
    igual(pasan.length, 2, tipo);
  }
});

prueba('un tipo estricto no se rellena con hoteles de otro tipo', function () {
  const catalogo = [{ name: 'Pousada Comum', hotelType: 'intermedio' }];
  igual(hotelesQuePasanElTipo(catalogo, 'boutique', true), [], 'boutique no admite sustitucion');
  igual(hotelesQuePasanElTipo(catalogo, 'resort', true), [], 'resort no admite sustitucion');
  igual(hotelesQuePasanElTipo(catalogo, 'all-inclusive', true), [], 'all-inclusive no admite sustitucion');
});

prueba('un hotel sin clasificar pasa en el espectro y no en el tipo estricto', function () {
  const catalogo = [{ name: 'Pousada Sin Clasificar' }];
  igual(hotelesQuePasanElTipo(catalogo, 'intermedio', false).length, 1, 'en el espectro entra');
  igual(hotelesQuePasanElTipo(catalogo, 'boutique', true).length, 0, 'en un tipo estricto no');
});

prueba('un catalogo vacio sigue devolviendo vacio', function () {
  igual(hotelesQuePasanElTipo([], 'intermedio', false), []);
  igual(hotelesQuePasanElTipo([], 'boutique', true), []);
});

prueba('el filtro de tipo queda definido antes de usarlo', function () {
  // Guarda contra la forma en que estaba antes: la correccion vivia adentro de
  // hotelTypeSelectMarkup y se llamaba al final de hotelOptions, ya calculados
  // el titulo y las cards. Si vuelve a mutar meta, el problema regresa entero.
  const cuerpoSelect = extraer('hotelTypeSelectMarkup');
  if (/meta\.hotelType\s*=/.test(cuerpoSelect)) {
    throw new Error('hotelTypeSelectMarkup vuelve a escribir meta.hotelType: el titulo y las cards se desincronizan otra vez');
  }
  const cuerpoHotelOptions = extraer('hotelOptions');
  const iTipo = cuerpoHotelOptions.indexOf('resolveHotelTypeForMeta(meta)');
  const iPerfil = cuerpoHotelOptions.indexOf('hotelStyle(meta)');
  if (iTipo < 0) throw new Error('hotelOptions no resuelve el tipo antes de nada');
  if (iPerfil < 0) throw new Error('hotelOptions no calcula el perfil');
  if (iTipo > iPerfil) throw new Error('el perfil se calcula antes de resolver el tipo: el titulo y las cards van a quedar con tipos distintos');
  if (!/hotelTypeSelectMarkup\(meta, hotelType\)/.test(cuerpoHotelOptions)) {
    throw new Error('el select no recibe el tipo ya resuelto');
  }
});

console.log(fallos ? '\n' + fallos + ' FALLAS' : '\ntodo bien');
process.exit(fallos ? 1 : 0);
