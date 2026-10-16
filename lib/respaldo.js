'use strict';
/* Respaldo diario de la base, automatico (GET /api/respaldo, cron de Vercel con CRON_SECRET).

   QUE GUARDA
   Todas las tablas que la service role puede leer, sacadas de la lista que publica Supabase (/rest/v1/): una tabla
   nueva entra sola, sin tocar este archivo. Salvo SIN_RESPALDO, que son caches que se regeneran.
   Cada tabla va a Supabase Storage, bucket privado "interno": respaldos/<AAAA-MM-DD>/<tabla>.json, mas _resumen.json
   con cuantas filas tenia cada una. Se guardan los ultimos DIAS dias; los mas viejos se borran.

   QUE NO CUBRE
   - Los archivos de Storage (comprobantes, fotos): solo las tablas.
   - Que se pierda el proyecto de Supabase entero: el respaldo vive en el mismo proyecto. Cubre lo que de verdad pasa
     (una migracion que sale mal, un borrado por error); para lo otro, bajar uno de vez en cuando con
     scripts/bajar-respaldo.js.

   Para volver a cargar una tabla: node scripts/bajar-respaldo.js <fecha> y despues scripts/restaurar-base.js. */

const salud = require('./salud');

const DIAS = 30;
const POR_PAGINA = 1000;   // el tope de filas por pedido de Supabase
const SIN_RESPALDO = new Set(['vuelos_cache', 'route_polylines']);

let fetchFn = function () { return fetch.apply(null, arguments); };

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function hoyUY() { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); }

/* Tablas y su clave primaria (para paginar en orden), de la descripcion OpenAPI de PostgREST. */
async function tablas(s) {
  const r = await fetchFn(s.url + '/rest/v1/', { headers: { apikey: s.key, Authorization: 'Bearer ' + s.key, Accept: 'application/openapi+json' } });
  if (!r.ok) throw new Error('No se pudo leer la lista de tablas: HTTP ' + r.status);
  const defs = (await r.json()).definitions || {};
  return Object.keys(defs).filter(function (t) { return !SIN_RESPALDO.has(t); }).sort().map(function (t) {
    const props = defs[t].properties || {};
    const pk = Object.keys(props).filter(function (c) { return /<pk\/>/.test(String(props[c].description || '')); });
    return { nombre: t, orden: pk.length ? pk.join(',') : '' };
  });
}

async function bajarTabla(s, t) {
  const filas = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const q = '?select=*' + (t.orden ? '&order=' + t.orden : '') + '&limit=' + POR_PAGINA + '&offset=' + desde;
    const r = await fetchFn(s.url + '/rest/v1/' + t.nombre + q, { headers: { apikey: s.key, Authorization: 'Bearer ' + s.key } });
    if (!r.ok) throw new Error(t.nombre + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 100));
    const pagina = await r.json();
    filas.push.apply(filas, pagina);
    if (pagina.length < POR_PAGINA) return filas;
  }
}

/* Borra las carpetas respaldos/<fecha> con mas de DIAS dias. */
async function podar(hoy) {
  const limite = new Date(Date.parse(hoy + 'T12:00:00Z') - DIAS * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const carpetas = (await salud.storage.listar('respaldos/')).filter(function (x) { return x.id === null && /^\d{4}-\d{2}-\d{2}$/.test(x.name) && x.name < limite; });
  let borradas = 0;
  for (const c of carpetas) {
    const archivos = await salud.storage.listar('respaldos/' + c.name + '/');
    await salud.storage.borrar(archivos.filter(function (a) { return a.id; }).map(function (a) { return 'respaldos/' + c.name + '/' + a.name; }));
    borradas++;
  }
  return borradas;
}

async function respaldar() {
  const s = supa();
  if (!s) throw new Error('Sin Supabase: no hay nada que respaldar.');
  const hoy = hoyUY(), lista = await tablas(s);
  const resumen = { fecha: new Date().toISOString(), tablas: {}, errores: {} };
  // De a 4 tablas a la vez: rapido sin saturar la base (la funcion corta a los 60 s).
  const cola = lista.slice();
  await Promise.all([0, 1, 2, 3].map(async function () {
    for (let t = cola.shift(); t; t = cola.shift()) {
      try {
        const filas = await bajarTabla(s, t);
        await salud.storage.subir('respaldos/' + hoy + '/' + t.nombre + '.json', JSON.stringify(filas));
        resumen.tablas[t.nombre] = filas.length;
      } catch (e) { resumen.errores[t.nombre] = e.message; }
    }
  }));
  await salud.storage.subir('respaldos/' + hoy + '/_resumen.json', JSON.stringify(resumen, null, 2));
  let podadas = 0;
  try { podadas = await podar(hoy); } catch (e) { resumen.errores._podar = e.message; }
  return { carpeta: 'respaldos/' + hoy, tablas: Object.keys(resumen.tablas).length, filas: Object.values(resumen.tablas).reduce(function (a, b) { return a + b; }, 0), errores: resumen.errores, podadas: podadas };
}

module.exports = { respaldar: respaldar, tablas: tablas, SIN_RESPALDO: SIN_RESPALDO, setFetch: function (fn) { fetchFn = fn; } };
