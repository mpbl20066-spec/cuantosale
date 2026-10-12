#!/usr/bin/env node
/* Avisa a Unsplash de cada foto que usa la app (download_location), como piden las guias de su API.
 * Va de a poco por el limite de 50 pedidos por hora: lo ya avisado queda en data/_trabajo/unsplash-descargas.json
 * y la siguiente corrida sigue desde ahi.   node scripts/unsplash-descargas.js */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const HECHAS = path.join(RAIZ, 'data', '_trabajo', 'unsplash-descargas.json');
const m = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').match(/^UNSPLASH_ACCESS_KEY=(.+)$/m);
if (!m) { console.error('Falta UNSPLASH_ACCESS_KEY en .env'); process.exit(1); }
const KEY = m[1].trim();
const fotos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'tour-photos.json'), 'utf8'));
let hechas = {}; try { hechas = JSON.parse(fs.readFileSync(HECHAS, 'utf8')); } catch (e) { /* primera vez */ }
(async function () {
  const pendientes = Object.values(fotos).filter((f) => f && f.fuente === 'unsplash' && f.download && !hechas[f.id]);
  let n = 0;
  for (const f of pendientes) {
    const r = await fetch(f.download, { headers: { Authorization: 'Client-ID ' + KEY, 'Accept-Version': 'v1' } });
    if (r.status === 403 || r.status === 429) break;
    if (r.ok) { hechas[f.id] = new Date().toISOString(); n++; }
    if (Number(r.headers.get('x-ratelimit-remaining')) <= 1) break;
  }
  fs.mkdirSync(path.dirname(HECHAS), { recursive: true });
  fs.writeFileSync(HECHAS, JSON.stringify(hechas, null, 1));
  const faltan = pendientes.length - n;
  console.log(n + ' avisadas ahora, ' + Object.keys(hechas).length + ' en total' + (faltan ? ', faltan ' + faltan + ' (correr de nuevo en una hora)' : ''));
  if (faltan) process.exitCode = 2;
})().catch((e) => { console.error(e.message); process.exit(1); });
