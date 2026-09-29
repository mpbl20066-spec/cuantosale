'use strict';
/* Borra la fila de prueba que dejo scripts/probar-rpc-tours.js.
 *
 *   node scripts/borrar-prueba-tours.js
 *
 * Va aparte y no dentro del importador a proposito: es una limpieza puntual de
 * diagnostico, y meter "borrar si el titulo es X" en el script de carga
 * significaria que el dia que haya un tour que se llame asi, lo borra.
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
  const r = await fetch(url + '/rest/v1/tours?titulo=eq.PRUEBA%20TEMPORAL', {
    method: 'DELETE',
    headers: { apikey: key, authorization: 'Bearer ' + key, prefer: 'return=representation' }
  });
  if (!r.ok) { console.error('status', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  const borradas = await r.json();
  console.log('borradas ' + borradas.length + ' fila(s) de prueba');
  const r2 = await fetch(url + '/rest/v1/tours?select=id', { headers: { apikey: key, authorization: 'Bearer ' + key } });
  const todas = await r2.json();
  console.log('quedan ' + todas.length + ' tours');
})();
