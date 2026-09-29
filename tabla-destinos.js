/* Tabla de todos los destinos que la pagina ofrece.
   Lee de las mismas fuentes que usa la app: DEST (modelo), DESTINATION_GROUPS
   (el menu), HOME_DESTINATION_KEYS (lo que el backend acepta) y las tablas
   generadas de costos y traslados. Un destino que no esta en las cuatro no se
   puede cotizar de punta a punta. */
const fs = require('fs');
const path = require('path');
const R = __dirname;
const model = require(path.join(R, 'lib', 'model.js'));
const app = fs.readFileSync(path.join(R, 'public', 'app.js'), 'utf8');
const srv = fs.readFileSync(path.join(R, 'server.js'), 'utf8');
const geo = JSON.parse(fs.readFileSync(path.join(R, 'data', 'destinos-geo.json'), 'utf8')).destinos;

/* Los dos desplegables se cortan por su propia llave de arranque, no por un
   "];": el bloque de grupos tiene un ] antes del de hubs, asi que cortar por el
   primer cierre dejaba el hub entero afuera y la columna salia vacia. */
function bloque(desde, hasta) {
  const a = app.indexOf(desde);
  if (a < 0) throw new Error('no se encontro ' + desde);
  const b = app.indexOf(hasta, a + desde.length);
  if (b < 0) throw new Error('no se encontro ' + hasta);
  return app.slice(a, b);
}
const gGrupos = bloque('var DESTINATION_GROUPS = [', 'var DESTINATION_HUBS = [');
const gHub = bloque('var DESTINATION_HUBS = [', 'function comboNombreDestino');

// grupo de cada destino, segun DESTINATION_GROUPS
const grupoDe = new Map();
for (const g of gGrupos.matchAll(/\{ id: '([^']+)', label: '([^']*)', image: '[^']*', keys: \[([^\]]*)\]/g)) {
  for (const k of g[3].matchAll(/'([^']+)'/g)) {
    if (!grupoDe.has(k[1])) grupoDe.set(k[1], g[2]);
  }
}
// el hub es otro desplegable, ordenado por aeropuerto. Va como { name: 'X',
// codes: 'YYY', options: [ { label, key, codes }, ... ] }: la clave del hub no
// esta en las options, asi que hay que buscar cada opcion suelta.
const enHub = new Set();
for (const m of gHub.matchAll(/\{ label: '((?:[^'\\]|\\.)*)', key: '(\w+)', codes:/g)) {
  if (m[1].indexOf(' + ') >= 0) continue;
  enHub.add(m[2]);
}
// que destinos son par de alguien, y de quien
const esPrimera = new Set(), esSegunda = new Set();
for (const m of gGrupos.matchAll(/\{ label: '((?:[^'\\]|\\.)* \+ (?:[^'\\]|\\.)*)', key: '(\w+)', secondKey: '(\w+)' \}/g)) {
  esPrimera.add(m[3]); esSegunda.add(m[4]);
}
const nPares = (k) => [...gGrupos.matchAll(new RegExp("secondKey: '" + k + "'", 'g'))].length;

const homeTxt = srv.match(/const HOME_DESTINATION_KEYS = \[([\s\S]*?)\];/)[1].replace(/\/\/[^\n]*/g, '');
const home = new Set(homeTxt.split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean));
const airTxt = srv.match(/const AIR_DESTINATIONS = \{([^}]*)\}/)[1];
const airSet = new Set([...airTxt.matchAll(/(\w+):/g)].map(x => x[1]));

const comida = (k) => (model.DESTINATION_COSTS[k] ? model.DESTINATION_COSTS[k].food.moderado : null);
const trasladoKm = (k) => { const t = model.transferOptions(k); return t ? t.km : null; };
const aeropuerto = (k) => (k === 'bue' ? 'EZE' : (model.DEST[k] ? model.DEST[k].iata : ''));

const filas = [];
for (const k of Object.keys(model.DEST)) {
  const d = model.DEST[k];
  filas.push({
    clave: k,
    destino: d.name,
    region: d.region || '',
    grupo: grupoDe.get(k) || '(sin grupo)',
    hub: enHub.has(k) ? 'si' : '-',
    presupuesto: home.has(k) ? 'si' : 'NO',
    vuelos: airSet.has(k) ? 'si' : 'NO',
    comida: comida(k),
    traslado: trasladoKm(k),
    aeropuerto: aeropuerto(k),
    coord: model.DEST_COORDS[k] ? 'si' : 'NO',
    geo: geo[k] ? 'si' : 'NO',
    pares: nPares(k),
    rol: [esPrimera.has(k) ? '1ra' : null, esSegunda.has(k) ? '2da' : null].filter(Boolean).join('/') || '-'
  });
}
filas.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.destino.localeCompare(b.destino));

const cols = ['clave', 'destino', 'region', 'grupo', 'hub', 'presupuesto', 'vuelos', 'comida', 'traslado', 'aeropuerto', 'coord', 'geo', 'pares', 'rol'];
const titulos = {
  clave: 'clave', destino: 'destino', region: 'región', grupo: 'grupo', hub: 'hub',
  presupuesto: 'búsqueda $', vuelos: 'vuelos', comida: 'comida/mo', traslado: 'trasl km',
  aeropuerto: 'aeropuerto', coord: 'coord', geo: 'geo', pares: 'pares', rol: 'rol'
};
const md = (v) => (v == null || v === '' ? '-' : String(v).replace(/\|/g, '\\|'));

const out = [];
out.push('# Destinos de la pagina');
out.push('');
out.push('Total en el modelo: **' + filas.length + '**. Generado con `node tabla-destinos.js`.');
out.push('');
out.push('| ' + cols.map(c => titulos[c]).join(' | ') + ' |');
out.push('|' + cols.map(() => '---').join('|') + '|');
for (const f of filas) out.push('| ' + cols.map(c => md(f[c])).join(' | ') + ' |');

if (!fs.existsSync(path.join(R, 'outputs'))) fs.mkdirSync(path.join(R, 'outputs'));
fs.writeFileSync(path.join(R, 'outputs', 'tabla-destinos.md'), out.join('\n') + '\n', 'utf8');

const csv = [cols.join(',')];
for (const f of filas) csv.push(cols.map(c => f[c]).join(','));
fs.writeFileSync(path.join(R, 'outputs', 'tabla-destinos.csv'), csv.join('\n') + '\n', 'utf8');

console.log('escrito outputs/tabla-destinos.md y .csv con ' + filas.length + ' destinos');
console.log('grupos (' + new Set(filas.map(f => f.grupo)).size + '): ' + [...new Set(filas.map(f => f.grupo))].join(' | '));
const sin = (campo, etiqueta) => {
  const l = filas.filter(f => f[campo] === 'NO').map(f => f.clave);
  console.log((l.length ? 'FALTA' : 'ok   ') + ' ' + etiqueta + ': ' + (l.join(', ') || '-'));
};
sin('coord', 'sin coordenada en el modelo');
sin('geo', 'sin coordenada en el archivo de fotos');
sin('presupuesto', 'sin busqueda por presupuesto');
sin('vuelos', 'sin busqueda de vuelos');
const sinComida = filas.filter(f => f.comida == null).map(f => f.clave);
console.log((sinComida.length ? 'FALTA' : 'ok   ') + ' sin costos diarios: ' + (sinComida.join(', ') || '-'));
const sinTraslado = filas.filter(f => f.traslado == null).map(f => f.clave);
console.log((sinTraslado.length ? 'FALTA' : 'ok   ') + ' sin precio de traslado: ' + (sinTraslado.join(', ') || '-'));
const sinGrupo = filas.filter(f => f.grupo === '(sin grupo)').map(f => f.clave);
console.log((sinGrupo.length ? 'FALTA' : 'ok   ') + ' sin grupo en el menu: ' + (sinGrupo.join(', ') || '-'));
