/* Solo lectura: lista los tours de la tabla y, para cada uno, si hoy resolveria
   foto. Sirve para decidir que borrar. No escribe nada. */
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
const fotos = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tour-photos.json'), 'utf8'));
let galerias = {};
try { galerias = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tour-galerias.json'), 'utf8')); } catch (e) {}

(async function () {
  const r = await fetch(url + '/rest/v1/tours?select=*&order=destino.asc,titulo.asc', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  console.log('HTTP ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j)) { console.log('respuesta: ' + JSON.stringify(j).slice(0, 300)); return; }
  console.log('filas en public.tours: ' + j.length);
  console.log('columnas: ' + Object.keys(j[0]).join(', '));
  console.log('');
  const cnt = {};
  j.forEach(x => { cnt[x.destino] = (cnt[x.destino] || 0) + 1; });
  console.log('por destino: ' + JSON.stringify(cnt));
  console.log('');
  const conFoto = [], sinFoto = [];
  for (const t of j) {
    const id = t.destino + '#' + t.titulo;
    const f = (t.url_imagen && String(t.url_imagen).trim()) || fotos[id] || (galerias[id] && galerias[id][0]) || '';
    (f ? conFoto : sinFoto).push(t);
  }
  console.log('CON foto: ' + conFoto.length + '   SIN foto: ' + sinFoto.length + '   (de ' + j.length + ')');
  console.log('');
  console.log('--- SIN FOTO ---');
  sinFoto.forEach(t => console.log('  ' + String(t.destino).padEnd(12) + String(t.titulo).slice(0, 60)));
  console.log('');
  console.log('--- CON FOTO ---');
  conFoto.forEach(t => console.log('  ' + String(t.destino).padEnd(12) + String(t.titulo).slice(0, 60)));
})();