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
  const r = await fetch(url + '/rest/v1/tours?select=id,destino,titulo,activo,url_imagen&order=destino.asc', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  const j = await r.json();
  const c = { true: 0, false: 0 };
  j.forEach(x => { c[String(x.activo)] = (c[String(x.activo)] || 0) + 1; });
  console.log('total ' + j.length + '   activos ' + c.true + '   inactivos ' + c.false);
  const fotos = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tour-photos.json'), 'utf8'));
  let gal = {};
  try { gal = JSON.parse(fs.readFileSync(path.join(R, 'data', 'tour-galerias.json'), 'utf8')); } catch (e) {}
  const sinFoto = j.filter(t => !(String(t.url_imagen || '').trim() || fotos[t.destino + '#' + t.titulo] || (gal[t.destino + '#' + t.titulo] || []).length));
  const c2 = {};
  sinFoto.forEach(t => { const k = String(t.activo) + '/' + (fotos[t.destino + '#' + t.titulo] ? 'foto' : 'nada'); c2[k] = (c2[k] || 0) + 1; });
  console.log('sin foto ' + sinFoto.length + '   desglose ' + JSON.stringify(c2));
  console.log('activos SIN foto: ' + sinFoto.filter(t => t.activo).length);
  console.log('activos CON foto: ' + j.filter(t => t.activo).length + ' - ' + sinFoto.filter(t => t.activo).length);
})();