'use strict';
/* Prueba cruda del RPC de tours, con una fila minima. De diagnostico: escribe
 * una fila de prueba que se puede borrar. Sirve para ver el cuerpo del error de
 * PostgREST, que el importador no muestra entero.
 *
 *   node scripts/probar-rpc-tours.js
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).forEach(function (l) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
});
const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

(async function () {
  const fila = { destino: 'buz', titulo: 'PRUEBA TEMPORAL', descripcion: '', detalle: '', precio: 30, activo: true, fuente: 'test', orden: 10 };
  const r = await fetch(url + '/rest/v1/rpc/tours_guardar_lote', {
    method: 'POST',
    headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ p_filas: [fila] })
  });
  console.log('status:', r.status);
  const t = await r.text();
  console.log('cuerpo:', t.slice(0, 700));
})();
