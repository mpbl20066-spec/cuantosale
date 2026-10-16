/* Baja un respaldo automatico (lib/respaldo.js, Supabase Storage "interno/respaldos/<fecha>/") a esta computadora,
   en el mismo formato que scripts/respaldo-base.js, para poder usar scripts/restaurar-base.js. Solo lee.

     node scripts/bajar-respaldo.js               lista los respaldos que hay
     node scripts/bajar-respaldo.js 2026-10-16    lo baja a data/respaldos/2026-10-16/

   data/respaldos/ no va al repo: tiene datos de clientes. */
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
const storage = require('../lib/salud').storage;

(async function () {
  const fecha = process.argv[2];
  if (!fecha) {
    const carpetas = (await storage.listar('respaldos/')).filter(function (x) { return x.id === null; }).map(function (x) { return x.name; });
    console.log(carpetas.length ? 'Respaldos en Supabase:\n  ' + carpetas.join('\n  ') : 'No hay respaldos todavia.');
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('La fecha va como AAAA-MM-DD.');
  const archivos = (await storage.listar('respaldos/' + fecha + '/')).filter(function (a) { return a.id; });
  if (!archivos.length) throw new Error('No hay respaldo del ' + fecha + '. Correlo sin fecha para ver la lista.');
  const dir = path.join(R, 'data', 'respaldos', fecha);
  fs.mkdirSync(dir, { recursive: true });
  for (const a of archivos) {
    fs.writeFileSync(path.join(dir, a.name), await storage.bajar('respaldos/' + fecha + '/' + a.name));
  }
  console.log(archivos.length + ' archivos en ' + path.relative(R, dir) + '. Para restaurar una tabla:');
  console.log('  node scripts/restaurar-base.js ' + path.relative(R, dir).replace(/\\/g, '/') + ' <tabla>');
})().catch(function (e) { console.error(e.message); process.exit(1); });
