'use strict';
/* Prueba de conexion a Supabase. Lee .env, llama tours_todos y dice que hay.
 *
 *   node scripts/probar-supabase.js
 *
 * Es de diagnostico, no de produccion: no escribe nada. Sirve para separar
 * "la key esta mal" de "la tabla no existe" de "anda todo", que son tres
 * errores que se ven iguales desde la terminal.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
try {
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).forEach(function (linea) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* no hay .env */ }

const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !key) {
  console.log('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}
if (key.startsWith('sb_secret_')) {
  console.log('Ojo: la key empieza con sb_secret_. Supabase muestra el JWT pelado.');
  console.log('     Si la copiaste de la pagina, no le pongas el prefijo adelante.');
}

(async function () {
  const h = { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' };

  // 1. La key.
  const r = await fetch(url + '/rest/v1/rpc/tours_todos', { method: 'POST', headers: h, body: '{}' });
  const t = await r.text();
  if (r.status === 401 || r.status === 403) {
    console.log('La key NO sirve (' + r.status + ').');
    console.log('  ' + t.slice(0, 200));
    console.log('');
    console.log('Casi siempre es una de dos:');
    console.log('  - le pegaste "sb_secret_" adelante a un JWT que ya lo traia');
    console.log('  - la key es de otro proyecto');
    process.exit(1);
  }
  if (!r.ok) {
    console.log('La key parece servir pero la consulta fallo (' + r.status + '):');
    console.log('  ' + t.slice(0, 300));
    console.log('');
    console.log('Si dice "function tours_todos does not exist" o "relation does not",');
    console.log('falta correr supabase-setup.sql en el SQL Editor.');
    process.exit(1);
  }

  const tours = JSON.parse(t);
  console.log('La key sirve.');
  console.log('  public.tours: ' + tours.length + ' filas');

  const r2 = await fetch(url + '/rest/v1/transfer_precios?select=destino_key&limit=1000', { headers: h });
  if (!r2.ok) {
    console.log('  public.transfer_precios: no se pudo leer (' + r2.status + ')');
    console.log('    ' + (await r2.text()).slice(0, 200));
  } else {
    const precios = await r2.json();
    const destinos = new Set(precios.map((p) => p.destino_key));
    console.log('  public.transfer_precios: ' + precios.length + ' filas en ' + destinos.size + ' destinos');
  }

  console.log('');
  if (!tours.length) {
    console.log('Las tablas existen pero estan vacias. Corre los scripts de carga:');
    console.log('  npm run cargar:tours');
    console.log('  python scripts/cargar-tours-xlsx.py');
    console.log('  npm run cargar:transfer-precios');
  } else {
    console.log('Todo cargado. Levantá el server con npm start.');
  }
})();
