/* Borra de public.tours las filas que no aportan nada:
 *   - destinos que ya no existen en lib/model.js (bho, bue, camboriu, curitiba)
 *   - filas con activo = false
 * Las dos condiciones se combinan, asi que la interseccion (huérfanas apagadas)
 * se cuenta una sola vez.
 *
 * Antes de tocar la base guarda un dump completo de todo lo que se va a borrar
 * en data/tours-borrados.json. Un DELETE no se deshace con git: las filas nunca
 * estuvieron en el repo. Ese archivo es la unica vuelta atras.
 */
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

const DRY = process.argv.indexOf('--si') < 0;
const DUMP = path.join(R, 'data', 'tours-borrados.json');

(async function () {
  const r = await fetch(url + '/rest/v1/tours?select=*&order=destino.asc,titulo.asc', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  if (!r.ok) { console.log('no se pudo leer: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300)); process.exit(1); }
  const todas = await r.json();
  const huerfana = (t) => model.DEST[t.destino] === undefined;

  const aBorrar = todas.filter((t) => !t.activo || huerfana(t));
  const quedan = todas.filter((t) => t.activo && !huerfana(t));

  console.log('filas en la tabla: ' + todas.length);
  console.log('  a borrar: ' + aBorrar.length + '   (apagadas ' + aBorrar.filter((t) => !t.activo).length
    + ', huerfanas ' + aBorrar.filter(huerfana).length
    + ', de las cuales huerfanas y apagadas ' + aBorrar.filter((t) => !t.activo && huerfana(t)).length + ')');
  console.log('  quedan:   ' + quedan.length + '   (todas activas y con destino en el modelo)');
  const porDest = {};
  aBorrar.forEach((t) => { porDest[t.destino] = (porDest[t.destino] || 0) + 1; });
  console.log('  por destino: ' + Object.keys(porDest).sort().map((k) => k + '(' + porDest[k] + ')').join(' '));
  console.log('');

  if (DRY) { console.log('DRY RUN: no se borro nada. Correr con --si para escribir.'); return; }

  if (fs.existsSync(DUMP)) {
    console.log('ATENCION: ' + path.relative(R, DUMP) + ' ya existe. No se sobreescribe: renombralo o borralo, porque es la copia de lo que ya se borro en una corrida anterior.');
    process.exit(1);
  }
  fs.writeFileSync(DUMP, JSON.stringify({
    _nota: 'Dump de las filas eliminadas de public.tours. Para restaurar: insert into public.tours (id, destino, titulo, descripcion, precio, precio_brl, detalle, activo, fuente, verificado, orden, created_at, updated_at) values (...); Ver data/tours.json y public/tours.generated.js, que tambien conservan material parte de este catalogo.',
    generado: new Date().toISOString(),
    filas: aBorrar
  }, null, 1), 'utf8');
  console.log('dump de seguridad: data/tours-borrados.json (' + aBorrar.length + ' filas)');

  const cab = { apikey: key, Authorization: 'Bearer ' + key, 'content-type': 'application/json', Prefer: 'return=representation' };
  let ok = 0;
  // De a 50: el filtro por id in (...) es lo que evita traer de mas, y un lote
  // chico deja un error aislado en vez de perder 80 filas de una.
  for (let i = 0; i < aBorrar.length; i += 50) {
    const lote = aBorrar.slice(i, i + 50).map((t) => t.id);
    const res = await fetch(url + '/rest/v1/tours?id=in.(' + lote.join(',') + ')', { method: 'DELETE', headers: cab });
    if (!res.ok) { console.log('  LOTE ' + i + ' FALLO: HTTP ' + res.status + ' ' + (await res.text()).slice(0, 300)); break; }
    const borradas = await res.json();
    ok += Array.isArray(borradas) ? borradas.length : 0;
    console.log('  lote ' + i + ': ' + (Array.isArray(borradas) ? borradas.length : '?') + ' borradas');
  }

  const v = await fetch(url + '/rest/v1/tours?select=id,activo,destino', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  const restante = await v.json();
  console.log('');
  console.log('borradas confirmadas por la base: ' + ok);
  console.log('filas que quedan en la tabla: ' + restante.length + ' (esperado ' + quedan.length + ')');
  const malos = restante.filter((t) => !t.activo || model.DEST[t.destino] === undefined);
  console.log('quedan apagadas o huerfanas: ' + malos.length);
})();