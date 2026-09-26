// Verifica que la migracion de "saldos" quedo aplicada en Supabase:
// la columna existe, los grupos viejos la traen vacia (no null) y el update
// con la anon key (la que usa el browser) tiene permission.
//
// Se habla directo con PostgREST porque el proyecto no tiene supabase-js
// instalado en node: el browser lo carga por CDN.
'use strict';

const fs = require('fs');
const path = require('path');

// El proyecto no usa dotenv: server.js tiene su propio lector de .env y no
// depende del paquete. Se copia ese approach para no agregar una dependencia.
const envPath = process.argv[2] || path.join(__dirname, '.env');
try {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(function (line) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* sin .env: se usan las variables del entorno */ }

// Mismo fallback que server.js:1396, para que el script funcione aunque el
// .env no tenga la URL puesta.
const URL_BASE = process.env.SUPABASE_URL || 'https://hqyzmeordvjccytgltse.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let fails = 0;
function ok(cond, name, detail) {
  console.log((cond ? '  ok  ' : '  FALLA  ') + name + (detail && !cond ? '\n         ' + detail : ''));
  if (!cond) fails++;
}

async function api(p, method, key, body) {
  const r = await fetch(URL_BASE + '/rest/v1/' + p, {
    method: method,
    headers: {
      apikey: key, Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return {
    status: r.status, data: data,
    error: r.ok ? null : ((data && data.message) || text || ('HTTP ' + r.status))
  };
}

(async function () {
  // La URL tiene el mismo fallback que server.js: si no esta en el .env se usa
  // la del proyecto, asi el script anda sin configuracion. La anon key y la
  // service_role no tienen fallback posible: sin ellas no hay a quien pegarle.
  if (!URL_BASE) {
    console.log('Falta SUPABASE_URL en el .env');
    process.exit(1);
  }
  if (!ANON) {
    console.log('Falta SUPABASE_ANON_KEY en el .env');
    console.log('  Va en Supabase -> Project Settings -> API -> anon public.');
    console.log('  (En Vercel ya esta puesta; aca se necesita la del .env local.)');
    process.exit(1);
  }
  if (!SERVICE) {
    console.log('Falta SUPABASE_SERVICE_ROLE_KEY en el .env (la que empieza con eyJ y dice service_role).');
    console.log('  Solo se usa para leer la tabla; el update se prueba con la anon key,');
    console.log('  que es lo que hace el boton "Ya pagué" desde el browser.');
    process.exit(1);
  }
  console.log('Proyecto:', URL_BASE.replace(/https?:\/\//, '').split('.')[0] + '\n');

  // 1. La columna existe: si no, select('saldos') vuelve 400.
  const probe = await api('grupos_viaje?select=id,saldos&limit=3', 'GET', SERVICE);
  ok(!probe.error, 'la columna saldos existe y se puede leer', probe.error);
  if (probe.error) { console.log('\nLa migracion no esta aplicada.'); process.exit(1); }

  const rows = Array.isArray(probe.data) ? probe.data : [];
  console.log('  grupos de muestra: ' + rows.length);

  // 2. Los grupos viejos no quedaron en null.
  const malos = rows.filter(function (r) { return r.saldos === null || r.saldos === undefined; });
  ok(malos.length === 0, 'ningun grupo quedo con saldos en null',
    malos.length + ' grupo(s) con null: ' + malos.map(function (r) { return r.id; }).join(', '));

  if (!rows.length) {
    console.log('\nNo hay grupos en la base para probar el update. Crea uno desde la app y volve a correr esto.');
    process.exit(fails ? 1 : 0);
  }

  // 3. El update con la ANON key tiene que pasar. Es exactamente lo que hace
  //    el boton "Ya pagué" desde el browser. Se aplica y se revierte.
  const objetivo = rows[0].id;
  const antes = rows[0].saldos;
  const prueba = ['mpbl|pao'];

  const up = await api('grupos_viaje?id=eq.' + objetivo, 'PATCH', ANON, { saldos: prueba });
  ok(!up.error, 'el update con la anon key funciona (es el boton "Ya pagué")', up.error);
  if (up.error) {
    console.log('\n  -> falta el grant update o la policy. Correlos de nuevo en el SQL Editor.');
    process.exit(1);
  }

  // 4. Se guardo de verdad y se lee de vuelta.
  const check = await api('grupos_viaje?select=saldos&id=eq.' + objetivo, 'GET', ANON);
  ok(JSON.stringify(check.data && check.data[0] && check.data[0].saldos) === JSON.stringify(prueba),
    'el valor se guardo y se lee de vuelta', 'se leyo ' + JSON.stringify(check.data));

  // 5. Revertir, para no dejar datos de prueba.
  await api('grupos_viaje?id=eq.' + objetivo, 'PATCH', ANON, { saldos: antes });
  const rev = await api('grupos_viaje?select=saldos&id=eq.' + objetivo, 'GET', ANON);
  ok(JSON.stringify(rev.data && rev.data[0] && rev.data[0].saldos) === JSON.stringify(antes),
    'revertido a como estaba', 'quedo ' + JSON.stringify(rev.data && rev.data[0]));

  console.log(fails ? '\n' + fails + ' falla(s)' : '\nTodo OK. La migracion quedo aplicada.');
  process.exit(fails ? 1 : 0);
})();
