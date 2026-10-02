/* Solo lectura. Compara los 23 tours activos de la base con el respaldo local
   public/tours.generated.js. Si no coinciden, borrar filas de la base cambia lo
   que se ve segun Supabase responda o no. */
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

(async function () {
  const r = await fetch(url + '/rest/v1/tours?select=destino,titulo&activo=eq.true&order=destino.asc', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  const j = await r.json();
  const g = require(path.join(R, 'public', 'tours.generated.js'));
  const db = new Set(j.map((x) => x.destino + '#' + x.titulo));
  const res = new Set(g.map((x) => x.destinations[0] + '#' + x.title));
  const soloRes = [...res].filter((x) => !db.has(x));
  const soloDb = [...db].filter((x) => !res.has(x));
  console.log('activos en la BD: ' + db.size + '   respaldo local: ' + res.size);
  console.log('');
  console.log('solo en el respaldo (se verian si Supabase cae): ' + soloRes.length);
  soloRes.forEach((x) => console.log('   ' + x));
  console.log('solo en la BD (no se verian con el respaldo): ' + soloDb.length);
  soloDb.forEach((x) => console.log('   ' + x));
})();