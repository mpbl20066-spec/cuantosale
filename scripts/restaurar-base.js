/* Vuelve a cargar una tabla desde un respaldo de scripts/respaldo-base.js.

     node scripts/restaurar-base.js data/respaldos/20261015-2300 proveedores            (solo muestra que haria)
     node scripts/restaurar-base.js data/respaldos/20261015-2300 proveedores --aplicar  (lo hace)

   Hace upsert por la clave primaria: las filas del respaldo vuelven a como estaban y las que se crearon despues
   quedan como estan (no borra nada). Antes de aplicar, conviene sacar otro respaldo del estado actual.

   La auditoria no se restaura: solo se agrega, y lo que paso despues del respaldo tambien paso. */
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

const CLAVE = { pedidos: 'id', proveedores: 'id', tours: 'id', traslados: 'destino', traslados_historial: 'id', operaciones_config: 'clave', precio_cambios: 'id', movimientos: 'id', obligaciones: 'id', asignaciones: 'id' };
const [dirArg, tabla] = process.argv.slice(2);
const aplicar = process.argv.includes('--aplicar');

(async function () {
  if (!url || !key) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en .env');
  if (!dirArg || !CLAVE[tabla]) throw new Error('Uso: node scripts/restaurar-base.js <carpeta del respaldo> <tabla> [--aplicar]\nTablas: ' + Object.keys(CLAVE).join(', '));
  const archivo = path.resolve(R, dirArg, tabla + '.json');
  const filas = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const k = CLAVE[tabla];
  const cab = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  const r = await fetch(url + '/rest/v1/' + tabla + '?select=' + k, { headers: cab });
  if (!r.ok) throw new Error('No pude leer ' + tabla + ': HTTP ' + r.status);
  const hoy = new Set((await r.json()).map(function (x) { return String(x[k]); }));
  const vuelven = filas.filter(function (f) { return !hoy.has(String(f[k])); }).length;
  console.log(tabla + ': ' + filas.length + ' filas en el respaldo; ' + (filas.length - vuelven) + ' se pisan con la version del respaldo, ' + vuelven + ' vuelven a crearse.');
  if (!aplicar) { console.log('Nada cambiado. Para hacerlo: agregar --aplicar'); return; }
  for (let i = 0; i < filas.length; i += 500) {
    const w = await fetch(url + '/rest/v1/' + tabla + '?on_conflict=' + k, { method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, cab), body: JSON.stringify(filas.slice(i, i + 500)) });
    if (!w.ok) throw new Error('Fallo el lote ' + (i / 500 + 1) + ': HTTP ' + w.status + ' ' + (await w.text()).slice(0, 300));
  }
  console.log('Listo.');
})().catch(function (e) { console.error(e.message); process.exit(1); });
