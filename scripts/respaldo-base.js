/* Respaldo de las tablas del panel antes de cada etapa de Finanzas. Solo lee.

     node scripts/respaldo-base.js

   Guarda cada tabla entera en data/respaldos/<fecha-hora>/<tabla>.json (no va al repo: tiene datos de clientes) y
   compara las filas bajadas con las que dice la base (count=exact). Si alguna no coincide, termina con error y el
   respaldo no sirve: no seguir con la migracion.

   Las tablas de Finanzas se respaldan si ya existen; si no, se saltean. Para volver a cargar un respaldo:
   scripts/restaurar-base.js. */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');

for (const l of fs.readFileSync(path.join(R, '.env'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}
const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
if (!url || !key) { console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en .env'); process.exit(1); }

/* [tabla, columna para ordenar, obligatoria] */
const TABLAS = [
  ['pedidos', 'id', true], ['proveedores', 'id', true], ['tours', 'id', true], ['traslados', 'destino', true],
  ['traslados_historial', 'id', true], ['operaciones_config', 'clave', true], ['precio_cambios', 'id', true],
  ['movimientos', 'id', false], ['obligaciones', 'id', false], ['asignaciones', 'id', false], ['auditoria', 'id', false]
];
const PAGINA = 1000;
const cab = { apikey: key, Authorization: 'Bearer ' + key };

async function contar(tabla) {
  const r = await fetch(url + '/rest/v1/' + tabla + '?select=*', { method: 'HEAD', headers: Object.assign({ Prefer: 'count=exact', Range: '0-0' }, cab) });
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok && r.status !== 206) throw new Error(tabla + ': HTTP ' + r.status);
  const m = String(r.headers.get('content-range') || '').match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}
async function bajar(tabla, orden) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const r = await fetch(url + '/rest/v1/' + tabla + '?select=*&order=' + orden + '.asc', { headers: Object.assign({ Range: desde + '-' + (desde + PAGINA - 1) }, cab) });
    if (!r.ok && r.status !== 206) throw new Error(tabla + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const lote = await r.json();
    filas.push.apply(filas, lote);
    if (lote.length < PAGINA) return filas;
  }
}

(async function () {
  const sello = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const dir = path.join(R, 'data', 'respaldos', sello);
  fs.mkdirSync(dir, { recursive: true });
  const resumen = { creado: new Date().toISOString(), base: url.replace(/^https:\/\/([^.]+).*/, '$1'), tablas: {} };
  let mal = 0;
  for (const [tabla, orden, obligatoria] of TABLAS) {
    const n = await contar(tabla);
    if (n === null) {
      if (obligatoria) { console.log('  FALTA   ' + tabla); mal++; } else console.log('  (no existe todavia) ' + tabla);
      continue;
    }
    const filas = await bajar(tabla, orden);
    fs.writeFileSync(path.join(dir, tabla + '.json'), JSON.stringify(filas, null, 1));
    const ok = filas.length === n;
    if (!ok) mal++;
    resumen.tablas[tabla] = { filas: filas.length, en_base: n };
    console.log('  ' + (ok ? 'ok     ' : 'NO COINCIDE') + ' ' + tabla.padEnd(22) + filas.length + (ok ? '' : ' de ' + n));
  }
  fs.writeFileSync(path.join(dir, '_resumen.json'), JSON.stringify(resumen, null, 2));
  console.log('\nRespaldo en ' + path.relative(R, dir));
  if (mal) { console.error('\n' + mal + ' tabla(s) con problemas: este respaldo no esta completo.'); process.exit(1); }
})().catch(function (e) { console.error(e.message); process.exit(1); });
