/* Tabla de destinos con y sin tours. Lee el catalogo por la misma via que el
   server (lib/tours.js: Supabase con respaldo local) y cruza contra DEST, que
   es lo que el sitio ofrece. Destinos sin ningun tour quedan marcados FALTA. */
const fs = require('fs');
const path = require('path');
const R = __dirname;

// El server carga el .env el mismo; acá se replica para poder correr el script
// suelto sin depender de dotenv (no está en las dependencias).
for (const linea of fs.readFileSync(path.join(R, '.env'), 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const model = require(path.join(R, 'lib', 'model.js'));
const tours = require(path.join(R, 'lib', 'tours.js'));

/* Los tours apagados (activo: false) en data/tours.json no se publican, pero ya
   estan cargados: son la lista de trabajo de lo que falta publicar, asi que se
   cuentan aparte para no reportar como vacio un destino que ya tiene material. */
const apagados = new Map();
try {
  const j = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tours.json'), 'utf8'));
  for (const t of (j.tours || [])) {
    if (t.activo !== false) continue;
    for (const d of (t.destinos || [])) {
      const k = String(d).toLowerCase();
      if (!apagados.has(k)) apagados.set(k, []);
      apagados.get(k).push(t);
    }
  }
} catch (e) { /* sin el JSON no hay lista de trabajo: se informa igual */ }

(async function () {
  const lista = await tours.todos();
  const origen = tours.estado();
  const porDest = new Map();
  for (const t of lista) {
    for (const d of (t.destinations || [])) {
      const k = String(d).toLowerCase();
      if (!porDest.has(k)) porDest.set(k, []);
      porDest.get(k).push(t);
    }
  }

  // Un destino sin foto ni precio tampoco sirve como oferta real, así que se
  // separa de los que sí están.
  const detalle = (arr) => {
    const conFoto = arr.filter(t => t.foto || (t.images && t.images.length) || t.image).length;
    const conPrecio = arr.filter(t => Number(t.price) > 0).length;
    return { conFoto: conFoto, conPrecio: conPrecio };
  };

  const filas = [];
  for (const k of Object.keys(model.DEST)) {
    const d = model.DEST[k];
    const ts = porDest.get(k) || [];
    const off = apagados.get(k) || [];
    const det = detalle(ts);
    const precios = ts.map(t => Number(t.price) || 0).filter(n => n > 0);
    filas.push({
      clave: k,
      destino: d.name,
      region: d.region || '',
      iata: k === 'bue' ? 'EZE' : (d.iata || ''),
      tours: ts.length,
      conPrecio: det.conPrecio,
      conFoto: det.conFoto,
      desde: precios.length ? Math.min.apply(null, precios) : null,
      apagados: off.length,
      estado: ts.length === 0 ? (off.length ? 'PENDIENTE' : 'FALTA') : (det.conPrecio < ts.length ? 'REVISAR' : 'ok'),
      titulos: ts.map(t => t.title).join(' | ')
    });
  }
  const ORDEN = { FALTA: 0, PENDIENTE: 1, REVISAR: 2, ok: 3 };
  filas.sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.destino.localeCompare(b.destino));

  const cols = ['clave', 'destino', 'region', 'iata', 'tours', 'conPrecio', 'conFoto', 'desde', 'apagados', 'estado', 'titulos'];
  const titulos = { clave: 'clave', destino: 'destino', region: 'región', iata: 'aeropuerto', tours: 'tours', conPrecio: 'con precio', conFoto: 'con foto', desde: 'precio desde US$', apagados: 'sin publicar', estado: 'estado', titulos: 'tours publicados' };
  const md = (v) => (v == null || v === '' ? '-' : String(v).replace(/\|/g, '\\|'));

  const out = [];
  out.push('# Destinos y sus tours');
  out.push('');
  const conTours = filas.filter(f => f.tours > 0).length;
  const falta = filas.filter(f => f.estado === 'FALTA').length;
  const pendiente = filas.filter(f => f.estado === 'PENDIENTE').length;
  out.push('Catalogo leido de: **' + origen + '** (' + lista.length + ' tours publicados). Destinos ofrecidos: **' + filas.length + '**.');
  out.push('');
  out.push('- Con tours publicados: **' + conTours + '**');
  out.push('- Con tours cargados pero apagados: **' + pendiente + '**');
  out.push('- Sin ningun tour cargado: **' + falta + '**');
  out.push('');
  out.push('Estados: `ok` completo, `REVISAR` tiene al menos un tour sin precio, `PENDIENTE` tiene material sin publicar, `FALTA` no tiene nada cargado. La columna "sin publicar" cuenta los tours con `activo: false` en `data/tours.json`.');
  out.push('');
  out.push('Generado con `node tabla-tours.js`.');
  out.push('');
  out.push('| ' + cols.map(c => titulos[c]).join(' | ') + ' |');
  out.push('|' + cols.map(() => '---').join('|') + '|');
  for (const f of filas) out.push('| ' + cols.map(c => md(f[c])).join(' | ') + ' |');

  if (!fs.existsSync(path.join(R, 'outputs'))) fs.mkdirSync(path.join(R, 'outputs'));
  fs.writeFileSync(path.join(R, 'outputs', 'tabla-tours.md'), out.join('\n') + '\n', 'utf8');

  const csv = [cols.join(',')];
  for (const f of filas) csv.push(cols.map(c => (f[c] == null ? '' : String(f[c]).replace(/"/g, '""'))).map(v => '"' + v + '"').join(','));
  fs.writeFileSync(path.join(R, 'outputs', 'tabla-tours.csv'), csv.join('\n') + '\n', 'utf8');

  console.log('origen: ' + origen + '   tours publicados: ' + lista.length);
  console.log('destinos: ' + filas.length + '   con tours: ' + conTours + '   pendientes: ' + pendiente + '   sin nada: ' + falta);
  console.log('');
  console.log('SIN TOURS, CON MATERIAL SIN PUBLICAR (' + pendiente + '):');
  filas.filter(f => f.estado === 'PENDIENTE').forEach(f => console.log('  ' + f.clave.padEnd(12) + f.destino.padEnd(24) + f.apagados + ' apagados'));
  console.log('');
  console.log('SIN NADA CARGADO (' + falta + '):');
  filas.filter(f => f.estado === 'FALTA').forEach(f => console.log('  ' + f.clave.padEnd(12) + f.destino));
  const revisar = filas.filter(f => f.estado === 'REVISAR');
  if (revisar.length) {
    console.log('\nCON ALGUN TOUR SIN PRECIO (' + revisar.length + '):');
    revisar.forEach(f => console.log('  ' + f.clave.padEnd(12) + f.destino + '  ' + (f.tours - f.conPrecio) + ' sin precio'));
  }
})();