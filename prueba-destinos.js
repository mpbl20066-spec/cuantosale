/* Comprueba que un destino est\u00e9 realmente disponible.
   El bug que motivo esto: 11 destinos estaban en model.js, con precio y todo, pero
   fuera de DESTINATION_GROUPS y de DESTINATION_HUBS, asi que nadie los ofrecia.
   Cotizaban bien y no aparecian en ningun lado. Estas aserciones lo cortan.

   Corre contra los archivos reales, no contra una copia: si el c\u00f3digo cambia,
   la prueba cambia con \u00e9l. */
const fs = require('fs');
// __dirname y no una ruta fija: con la ruta fija, corrido desde un worktree de
// git leeria el arbol del checkout principal y validaria otro codigo que este.
const raiz = __dirname.replace(/\\/g, '/') + '/';
const model = require(raiz + 'lib/model.js');
const app = fs.readFileSync(raiz + 'public/app.js', 'utf8');
const modelSrc = fs.readFileSync(raiz + 'lib/model.js', 'utf8');

const fallos = [];
function check(nombre, cond, detalle) {
  console.log((cond ? '  OK   ' : '  FALLA ') + nombre);
  if (!cond) fallos.push(nombre + (detalle ? ' -> ' + detalle : ''));
}
const bloque = (txt, desde, hasta) => txt.slice(txt.indexOf(desde), txt.indexOf(hasta, txt.indexOf(desde)));

// Las dos superficies de la UI, y el modelo.
const grupos = bloque(app, 'var DESTINATION_GROUPS = [', '\n  ];');
const hubs = bloque(app, 'var DESTINATION_HUBS = [', '\n  ];');
const enGrupos = new Set();
for (const g of grupos.matchAll(/keys:\s*\[([^\]]*)\]/g)) {
  for (const k of g[1].matchAll(/'([^']+)'/g)) enGrupos.add(k[1]);
}
const enGruposSub = new Set();
for (const g of grupos.matchAll(/subcategories:\s*\[([\s\S]*?)\]\s*\},?\s*\{|\]\s*\}\s*\]/g)) { /* no-op */ }
for (const s of grupos.matchAll(/subcategories:\s*\[([\s\S]*?)\n\s*\]/g)) {
  for (const k of s[1].matchAll(/key:\s*'([^']+)'/g)) enGruposSub.add(k[1]);
}
const enHubs = new Set();
for (const h of hubs.matchAll(/\{ label:.*?key:\s*'([^']+)'/g)) enHubs.add(h[1]);
const iata = new Set((app.match(/var IATA_BY_DEST = \{([^}]*)\}/) || [, ''])[1]
  .split(',').map(s => s.split(':')[0].trim()).filter(Boolean));

// La lista que pidio el usuario, con la clave que debe existir para cada una.
const PEDIDO = [
  ['Arraial d\'Ajuda', 'trancoso'], ['Porto Seguro', 'portoseguro'], ['Florianópolis', 'fln'],
  ['Bombinhas', 'bombinhas'], ['Balneário Camboriú', 'bcm'], ['Praia do Rosa', 'rosa'],
  ['Ferrugem', 'ferrugem'], ['Torres', 'torres'], ['Capão da Canoa', 'canoa'],
  ['Garopaba', 'garopaba'], ['Itapema', 'itapema'], ['Piçarras', 'picarras'],
  ['Ubatuba', 'ubatuba'], ['Ilhabela', 'ilhabela'], ['Paraty', 'paraty'],
  ['Río de Janeiro', 'rio'], ['Cabo Frio', 'cabo'], ['Búzios', 'buz'],
  ['Arraial do Cabo', 'arraial'], ['Angra dos Reis', 'angra'], ['Ilha Grande', 'ilha'],
  ['Salvador de Bahía', 'ssa'], ['Morro de São Paulo', 'morro'],
  ['Praia do Forte', 'forte'], ['Itacaré', 'itacare'], ['Maragogi', 'maragogi'],
  ['Porto de Galinhas', 'porto'], ['Recife', 'rec'], ['Natal', 'nat'],
  ['Pipa', 'pip'], ['João Pessoa', 'joaopessoa'],
];

console.log('1) Los 31 destinos pedidos existen en el modelo');
for (const [nombre, k] of PEDIDO) {
  check(nombre.padEnd(20) + ' (' + k + ')', !!model.DEST[k], 'no esta en DEST');
}

console.log('\n2) Los 31 aparecen en la grilla (DESTINATION_GROUPS)');
for (const [nombre, k] of PEDIDO) {
  check(nombre.padEnd(20) + ' en la grilla', enGrupos.has(k), 'esta en DEST pero no en ningun grupo');
}

console.log('\n3) Los 31 tienen subcategoria, o sea que su tarjeta abre algo');
for (const [nombre, k] of PEDIDO) {
  check(nombre.padEnd(20) + ' con subcategoria', enGruposSub.has(k), 'sin subcategoria: la tarjeta no abre zona');
}

console.log('\n4) Los 31 tienen costos diarios propios (nada cae al fallback de Rio)');
for (const [nombre, k] of PEDIDO) {
  const tiene = !!model.DESTINATION_COSTS[k];
  // Rio se compara consigo mismo, asi que la comprobacion de "no es el fallback"
  // solo aplica a los demas. Sin esta excepcion el test da falsa alarma en Rio
  // y nunca podria pasar.
  const esRio = k !== 'rio' && JSON.stringify(model.DESTINATION_COSTS[k]) === JSON.stringify(model.DESTINATION_COSTS.rio);
  check(nombre.padEnd(20) + ' con costos propios', tiene && !esRio,
    tiene ? (esRio ? 'tiene la MISMA tabla que Rio: es el fallback disfrazado' : '') : 'no tiene entrada, cae al fallback');
}

console.log('\n5) Los 31 tienen codigo IATA para buscar vuelo real');
for (const [nombre, k] of PEDIDO) {
  check(nombre.padEnd(20) + ' con IATA', iata.has(k), 'falta en IATA_BY_DEST');
}

console.log('\n6) Coherencia de las dos superficies con el modelo');
for (const k of enGrupos) {
  check('grupo -> ' + k.padEnd(14) + ' existe en DEST', !!model.DEST[k], 'clave huerfana en la grilla');
}
for (const k of enHubs) {
  check('hub   -> ' + k.padEnd(14) + ' existe en DEST', !!model.DEST[k], 'clave huerfana en el desplegable');
}
for (const k of enGruposSub) {
  check('subcat-> ' + k.padEnd(14) + ' existe en DEST', !!model.DEST[k], 'clave huerfana en una subcategoria');
}

console.log('\n7) Todo destino que se ofrece tiene costos, IATA y subcategoria');
const ofrecidos = new Set([...enGrupos, ...enGruposSub]);
for (const k of ofrecidos) {
  check('ofrecido ' + k.padEnd(14) + ' completo',
    !!model.DEST[k] && !!model.DESTINATION_COSTS[k] && iata.has(k) && enGruposSub.has(k),
    [!model.DEST[k] && 'sin DEST', !model.DESTINATION_COSTS[k] && 'sin costos', !iata.has(k) && 'sin IATA', !enGruposSub.has(k) && 'sin subcategoria']
      .filter(Boolean).join(' + '));
}

console.log('\n8) Coherencia del roadtrip: son TRES tablas, no dos');
{
  // ROADTRIP_ALLOWED_DESTINATIONS no esta exportado, asi que se lee del fuente.
  const setSrc = (modelSrc.match(/ROADTRIP_ALLOWED_DESTINATIONS = new Set\(\[([^\]]*)\]/) || [, ''])[1];
  const permitidos = setSrc.split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  check('se pudo leer la lista de roadtrip', permitidos.length > 0);
  for (const k of permitidos) {
    check('permitido ' + k.padEnd(13) + ' con coordenadas', !!model.DEST_COORDS[k], 'habilitado sin coordenadas');
    // roadtripCost() devuelve null si no hay ruta, y la app ofrece la opcion
    // igual: el selector de transporte muestra "auto" y el precio sale vacio.
    check('permitido ' + k.padEnd(13) + ' con ruta', !!model.ROADTRIP_ROUTES[k], 'habilitado sin ROADTRIP_ROUTES: roadtripCost() daria null');
    const r = model.ROADTRIP_ROUTES[k];
    if (r) {
      check('permitido ' + k.padEnd(13) + ' con numeros sanios',
        r.km > 0 && r.tolls >= 0 && r.hours > 0, JSON.stringify(r));
    }
  }
  // La direccion inversa NO es un fallo tenerla: buz, ssa, sao, rec, for, mcz,
  // nat y pip tienen kilometraje calculado pero no tienen roadtrip habilitado,
  // y es lo correcto porque a esos destinos se vuela en vez de manejar. Que
  // falte la ruta cuando SI esta permitido si rompe, y eso es lo de arriba.
  const sinPermiso = Object.keys(model.ROADTRIP_ROUTES).filter(k => !permitidos.includes(k));
  console.log('  nota  ' + sinPermiso.length + ' destinos con ruta calculada pero sin roadtrip');
  console.log('        (correcto: a esos lugares se vuela): ' + sinPermiso.join(', '));
}

console.log('\n9) Los grupos cubren los 31 sin repetir destino entre grupos');
{
  const porDestino = new Map();
  for (const g of grupos.matchAll(/label:\s*'([^']+)'[\s\S]*?keys:\s*\[([^\]]*)\]/g)) {
    for (const k of g[2].matchAll(/'([^']+)'/g)) {
      if (!porDestino.has(k[1])) porDestino.set(k[1], []);
      porDestino.get(k[1]).push(g[1]);
    }
  }
  const repetidos = [...porDestino].filter(([, v]) => v.length > 1);
  check('ningun destino esta en dos grupos a la vez', repetidos.length === 0,
    repetidos.map(([k, v]) => k + ' en ' + v.join(' y ')).join('; '));
  const subHuerfanas = [...enGruposSub].filter(k => !enGrupos.has(k));
  check('ninguna subcategoria apunta a algo fuera de su grupo', subHuerfanas.length === 0, subHuerfanas.join(', '));
}

console.log('\n10) El desplegable de arriba cubre los 31 (segunda superficie)');
for (const [nombre, k] of PEDIDO) {
  check(nombre.padEnd(20) + ' en el desplegable', enHubs.has(k), 'esta en la grilla pero no en DESTINATION_HUBS');
}

console.log('\n11) El backend cotiza todo lo que la grilla ofrece');
{
  // Esta es la causa raiz de que un destino exista y no se vea:
  // HOME_DESTINATION_KEYS en server.js es una copia de la union de
  // DESTINATION_GROUPS, y estaba clavada en 12 claves. Lo que no estaba ahi no
  // existia en la busqueda por presupuesto, por mas que estuviera en el modelo,
  // en el desplegable y en la grilla.
  const srv = fs.readFileSync(raiz + 'server.js', 'utf8');
  const m = srv.match(/const HOME_DESTINATION_KEYS = \[([\s\S]*?)\];/);
  check('se pudo leer HOME_DESTINATION_KEYS', !!m, 'no se encontro la lista en server.js');
  if (m) {
    // La lista en server.js lleva comentarios de region entre las claves, y sin
    // limpiarlos el parser se come "// Rio de Janeiro" como si fuera un destino.
    const sinComentarios = m[1].replace(/\/\/[^\n]*/g, '');
    const home = new Set(sinComentarios.split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean));
    check('la lista no esta vacia', home.size > 0);
    check('no se colaron comentarios como destinos', ![...home].some(k => k.startsWith('/')), 'el parser no filtro los comentarios');
    for (const k of enGrupos) {
      check('cotizable ' + k.padEnd(13), home.has(k),
        'esta en la grilla pero NO en HOME_DESTINATION_KEYS: no aparece en "Todos los destinos"');
    }
    for (const k of home) {
      check('en la lista ' + k.padEnd(13) + ' existe en DEST', !!model.DEST[k], 'clave huerfana en el backend');
    }
    const deMas = [...home].filter(k => !enGrupos.has(k));
    check('no cotiza destinos que la grilla no ofrece', deMas.length === 0,
      'ofrece sin mostrar: ' + deMas.join(', '));

    // Quinta comprobacion: /api/vuelos/buscar usa AIR_DESTINATIONS, y rechaza
    // con "!destination" toda clave que no este ahi. Sin esta entrada el destino
    // se ofrece, cotiza y no puede buscar vuelo real.
    const air = srv.match(/const AIR_DESTINATIONS = \{([^}]*)\}/);
    check('se pudo leer AIR_DESTINATIONS', !!air);
    if (air) {
      const conAir = new Set(air[1].split(',').map(s => s.split(':')[0].trim()).filter(Boolean));
      for (const k of home) {
        check('vuelo ' + k.padEnd(13), conAir.has(k),
          'falta en AIR_DESTINATIONS: /api/vuelos/buscar lo rechaza con "!destination"');
      }
    }
  }
}

console.log(fallos.length
  ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ')
  : '\nTODO OK (' + 'los 31 destinos quedan completos en las tres capas' + ')');
process.exit(fallos.length ? 1 : 0);
