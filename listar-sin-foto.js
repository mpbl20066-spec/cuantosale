/* Solo lectura. Lista las filas de public.tours que hoy no resuelven foto, con
   todo lo que hace falta para decidir una por una: estado, precio de origen y
   convertido, de donde salio y si el destino existe en el modelo. No escribe. */
const fs = require('fs');
const path = require('path');
const R = __dirname;
for (const l of fs.readFileSync(path.join(R, '.env'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}
const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const model = require(path.join(R, 'lib', 'model.js'));
const fotos = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tour-photos.json'), 'utf8'));
let gal = {};
try { gal = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tour-galerias.json'), 'utf8')); } catch (e) {}

const CAMPOS = 'id,destino,titulo,precio,precio_brl,activo,fuente,verificado,orden,url_imagen,duracion,estado_scrapeo,agencia';

(async function () {
  const r = await fetch(url + '/rest/v1/tours?select=' + CAMPOS + '&order=activo.desc,destino.asc,titulo.asc', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  if (!r.ok) { console.log('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300)); return; }
  const j = await r.json();
  const id = (t) => t.destino + '#' + t.titulo;
  const sinFoto = j.filter((t) => !(String(t.url_imagen || '').trim() || fotos[id(t)] || (gal[id(t)] || []).length));
  const activos = sinFoto.filter((t) => t.activo);
  const nombre = (k) => (model.DEST[k] ? model.DEST[k].name : 'NO EXISTE EN EL MODELO');

  const cols = ['id', 'destino', 'nombre', 'titulo', 'activo', 'precio', 'precio_brl', 'fuente', 'estado_scrapeo', 'duracion'];
  const esc = (v) => String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const line = (t) => '| ' + [t.id, t.destino, nombre(t.destino), t.titulo, t.activo ? 'ACTIVO' : 'apagado',
    esc(t.precio), esc(t.precio_brl), esc(t.fuente), esc(t.estado_scrapeo), esc(t.duracion)].join(' | ') + ' |';

  const out = [];
  out.push('# Filas de public.tours sin foto');
  out.push('');
  out.push('De ' + j.length + ' filas, ' + sinFoto.length + ' no resuelven foto. Generado con `node listar-sin-foto.js`.');
  out.push('');
  out.push('## Activas, sin foto (' + activos.length + ')');
  out.push('');
  out.push('Son las unicas que ve el usuario hoy. ' + activos.map((t) => t.destino).filter((v, i, a) => a.indexOf(v) === i).join(', ') + '.');
  out.push('');
  out.push('| id | destino | nombre | tour | activo | precio USD | precio BRL | fuente | scrapeo | duración |');
  out.push('|' + cols.map(() => '---').join('|') + '|');
  activos.forEach((t) => out.push(line(t)));

  // Solo las apagadas acá: las 3 activas ya salen arriba, y repetir la fila en
  // las dos secciones hacia que el total no cuadre con el conteo.
  const porDest = {};
  sinFoto.filter((t) => !t.activo).forEach((t) => { (porDest[t.destino] = porDest[t.destino] || []).push(t); });
  out.push('');
  out.push('## Todas sin foto, agrupadas por destino (' + sinFoto.length + ')');
  out.push('');
  out.push('Solo las apagadas (las 3 activas ya van arriba). La columna "nombre" avisa cuando el key ya no existe en lib/model.js: esas filas no se dibujan en ningun lado, esten activas o no.');
  out.push('');
  Object.keys(porDest).sort().forEach((k) => {
    out.push('### ' + k + ' — ' + nombre(k) + ' (' + porDest[k].length + ')');
    out.push('');
    out.push('| id | destino | nombre | tour | activo | precio USD | precio BRL | fuente | scrapeo | duración |');
    out.push('|' + cols.map(() => '---').join('|') + '|');
    porDest[k].forEach((t) => out.push(line(t)));
    out.push('');
  });

  const huerfanos = sinFoto.filter((t) => !model.DEST[t.destino]);
  out.push('## Resumen');
  out.push('');
  out.push('- Sin foto y activas: **' + activos.length + '**');
  out.push('- Sin foto y apagadas: **' + (sinFoto.length - activos.length) + '**');
  out.push('- Con destino que ya no existe en el modelo: **' + huerfanos.length + '** (' + [...new Set(huerfanos.map((t) => t.destino))].join(', ') + ')');
  out.push('- Con precio: **' + sinFoto.filter((t) => Number(t.precio) > 0 || Number(t.precio_brl) > 0).length + '**   Sin precio: **' + sinFoto.filter((t) => !(Number(t.precio) > 0 || Number(t.precio_brl) > 0)).length + '**');
  out.push('');

  if (!fs.existsSync(path.join(R, 'outputs'))) fs.mkdirSync(path.join(R, 'outputs'));
  fs.writeFileSync(path.join(R, 'outputs', 'tours-sin-foto.md'), out.join('\n'), 'utf8');
  const csv = [cols.join(',')];
  sinFoto.forEach((t) => csv.push([t.id, t.destino, nombre(t.destino), t.titulo, t.activo ? 'ACTIVO' : 'apagado',
    t.precio == null ? '' : t.precio, t.precio_brl == null ? '' : t.precio_brl,
    t.fuente || '', t.estado_scrapeo || '', t.duracion || ''].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')));
  fs.writeFileSync(path.join(R, 'outputs', 'tours-sin-foto.csv'), csv.join('\n'), 'utf8');

  console.log('escrito outputs/tours-sin-foto.md y .csv con ' + sinFoto.length + ' filas');
  console.log('activas sin foto: ' + activos.length + '   apagadas: ' + (sinFoto.length - activos.length));
  console.log('destinos huerfanos: ' + huerfanos.length + ' -> ' + [...new Set(huerfanos.map((t) => t.destino))].join(', '));
})();