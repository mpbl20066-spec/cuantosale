'use strict';
/*
 * Lee los costos de transfer de Supabase y arma el .xlsx.
 *
 *   node scripts/db-tabla.js estado   dice si esta configurado y como esta la tabla
 *   node scripts/db-tabla.js ver      imprime las filas
 *   node scripts/db-tabla.js pull     lee los costos -> data/costos-transfers.json -> .xlsx
 *
 * POR QUE SUPABASE Y NO GOOGLE SHEETS
 *
 * El proyecto ya tiene una base Postgres configurada (SUPABASE_URL en .env, y
 * seis archivos .sql con tablas). Agregar Google para esto era traer un
 * proyecto en la nube, una cuenta de servicio y una clave privada para escribir
 * tres numeros por fila. Con Supabase no hay nada que montar: se pega un .sql
 * en el editor y la tabla existe.
 *
 * Y el editor de tablas del dashboard de Supabase es la misma grilla que se
 * pedia: doble clic, se escribe, se guarda.
 *
 * LA DIRECCION DE LOS DATOS
 *
 * La base NO tiene km ni los precios que cobra la app: esos estan en
 * data/transfer-precios.json y no se tocan. La base solo tiene el costo del
 * operador, que antes no existia en ningun lado. pull junta las dos por
 * destino_key.
 *
 * Si la tabla no esta creada o falta la service role key, esto dice que falta
 * y sale con codigo 1. No inventa numeros ni deja el .xlsx a medio escribir.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = path.resolve(__dirname, '..');
const OUT_JSON = path.join(BASE, 'data', 'costos-transfers.json');
const TABLA = 'transfer_destinos';

/* El mismo lector de .env que server.js (lineas 21-25) y el mismo fallback de
   clave que lib/providers/cache-persistente.js. Reusar SUPABASE_SERVICE_ROLE_KEY
   es a proposito: si la clave del cache no esta puesta, la del servicio tampoco
   suele estar, y es una sola variable que aprender. */
function loadEnv() {
  try {
    fs.readFileSync(path.join(BASE, '.env'), 'utf8').split(/\r?\n/).forEach(function (line) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  } catch (e) { /* no hay .env: esta bien */ }
}

/* La anon key NO sirve para esto, y no es un detalle de estilo: la tabla queda
   con revoke all para anon y authenticated (ver el .sql), asi que con la anon
   key la API responde 401 aunque SUPABASE_URL este bien. La anon key es la que
   la app manda al navegador para el split de gastos; el costo de un transfer no
   es un dato que deba viajar ahi. */
function config() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERPAPI_CACHE_DB_KEY || '').trim();
  if (!url) return { error: 'falta SUPABASE_URL en .env' };
  if (!key) return { error: 'falta la service role key: SUPABASE_SERVICE_ROLE_KEY en .env' };
  return { url: url.replace(/\/+$/, ''), key: key };
}

function headers(key, extra) {
  return Object.assign({
    apikey: key,
    authorization: 'Bearer ' + key,
    accept: 'application/json'
  }, extra || {});
}

const COLS = 'destino_key,nombre,aeropuerto,modo,km,compartido_usd,privado_usd,'
  + 'costo_compartido,costo_privado,comision,precio_compartido,precio_privado,nota,actualizado_at';

async function fetchRows(cfg, soloConCosto) {
  let url = cfg.url + '/rest/v1/' + TABLA + '?select=' + COLS.split(',').join(',');
  if (soloConCosto) url += '&costo_compartido=not.is.null';
  url += '&order=destino_key';
  const res = await fetch(url, { headers: headers(cfg.key) });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try { msg = JSON.parse(text).message || msg; } catch (e) { /* texto plano */ }
    if (res.status === 404 || /relation .* does not exist/i.test(msg)) {
      msg = 'la tabla ' + TABLA + ' no existe. Corré supabase_transfer_costos.sql '
          + 'en el SQL Editor del dashboard de Supabase.';
    } else if (res.status === 401 || res.status === 403) {
      msg = 'la clave no tiene permiso sobre ' + TABLA + '. Es la service role, '
          + 'no la anon (la anon esta revocada a proposito).';
    }
    const e = new Error('Supabase ' + res.status + ': ' + msg);
    e.status = res.status;
    throw e;
  }
  return JSON.parse(text);
}

/** Postgres devuelve los numeric como string para no perder precision. */
const num = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

function usage() {
  console.log('Uso: node scripts/db-tabla.js [estado|ver|pull]');
}

async function main() {
  const cmd = process.argv[2] || 'estado';
  if (cmd === '-h' || cmd === '--help') { usage(); return; }

  loadEnv();
  const cfg = config();
  if (cfg.error) {
    console.error(cfg.error);
    console.error('');
    console.error('Montaje: dashboard de Supabase -> SQL Editor -> pegá');
    console.error('supabase_transfer_costos.sql y dale Run. Después:');
    console.error('  node scripts/db-tabla.js estado');
    console.error('');
    console.error('La service role sale de Project Settings -> API -> service_role.');
    process.exitCode = 1;
    return;
  }

  let filas;
  try {
    filas = await fetchRows(cfg, false);
  } catch (e) {
    console.error((cmd === 'estado' ? 'Tabla    : NO abre. ' : '') + e.message);
    process.exitCode = 1;
    return;
  }

  const conCosto = filas.filter((f) => f.costo_compartido != null || f.costo_privado != null);
  const completa = filas.filter((f) => f.costo_compartido != null && f.costo_privado != null
    && f.comision != null);

  if (cmd === 'estado') {
    console.log('Url      : ' + cfg.url);
    console.log('Tabla    : ' + TABLA + ' abre OK');
    console.log('Destinos : ' + filas.length + ' (la app tiene 45)');
    console.log('Con costo: ' + conCosto.length + ' | completos (las dos modalidades + comisión): ' + completa.length);
    if (conCosto.length && conCosto.length < completa.length) {
      console.log('Ojo      : hay costos a medio cargar. Price Final queda vacio hasta que cargues la comision.');
    }
    const sinFila = require('../lib/model.js').DEST;
    const claves = new Set(filas.map((f) => f.destino_key));
    const faltan = Object.keys(sinFila).filter((k) => !claves.has(k));
    if (faltan.length) console.log('Sin fila : ' + faltan.join(', '));
    console.log('');
    console.log('Para cargar: dashboard de Supabase -> Table Editor -> ' + TABLA);
    return;
  }

  if (cmd === 'ver') {
    console.log('destino_key'.padEnd(14) + 'nombre'.padEnd(24) + 'costo_com'.padEnd(12)
      + 'costo_priv'.padEnd(12) + 'com'.padEnd(8) + 'p_com'.padEnd(10) + 'p_priv');
    filas.forEach((f) => console.log(
      String(f.destino_key).padEnd(14) + String(f.nombre).padEnd(24)
      + String(f.costo_compartido == null ? '-' : f.costo_compartido).padEnd(12)
      + String(f.costo_privado == null ? '-' : f.costo_privado).padEnd(12)
      + String(f.comision == null ? '-' : (num(f.comision) * 100).toFixed(0) + '%').padEnd(8)
      + String(f.precio_compartido == null ? '-' : f.precio_compartido).padEnd(10)
      + String(f.precio_privado == null ? '-' : f.precio_privado)));
    return;
  }

  if (cmd === 'pull') {
    const costos = {};
    for (const f of filas) {
      const fila = {};
      const cc = num(f.costo_compartido), cp = num(f.costo_privado), co = num(f.comision);
      if (cc !== null) fila.costoCompartido = cc;
      if (cp !== null) fila.costoPrivado = cp;
      if (co !== null) fila.comision = co;
      if (f.nota) fila.nota = f.nota;
      if (!Object.keys(fila).length) continue;
      // Los precios finales se recalculan acá y no se copian de la base: si el
      // trigger de Postgres no llegara a correr, el .xlsx igual sale bien.
      if (fila.costoCompartido != null && fila.comision != null) {
        fila.precioCompartido = Math.round(fila.costoCompartido * (1 + fila.comision) * 100) / 100;
      }
      if (fila.costoPrivado != null && fila.comision != null) {
        fila.precioPrivado = Math.round(fila.costoPrivado * (1 + fila.comision) * 100) / 100;
      }
      costos[f.destino_key] = fila;
    }

    fs.writeFileSync(OUT_JSON, JSON.stringify({
      _nota: 'Generado por scripts/db-tabla.js pull desde Supabase (tabla '
        + TABLA + '). No editar aca: se sobrescribe en cada pull.',
      origen: cfg.url,
      destinos: costos
    }, null, 2), 'utf8');

    console.log('Leidas ' + filas.length + ' filas, ' + Object.keys(costos).length
      + ' con costo -> data/costos-transfers.json');
    if (!Object.keys(costos).length) {
      console.log('Ningun costo cargado todavia. El .xlsx sale igual, con las columnas en amarillo.');
    }

    const py = process.env.PYTHON || 'python';
    try {
      execFileSync(py, [path.join(BASE, 'scripts', 'armar-tabla-transfers.py')], { stdio: 'inherit' });
    } catch (e) {
      console.error('No se pudo correr armar-tabla-transfers.py. A mano:');
      console.error('  ' + py + ' scripts/armar-tabla-transfers.py');
      process.exitCode = 1;
    }
    return;
  }

  console.error('Comando desconocido: ' + cmd);
  usage();
  process.exitCode = 1;
}

main().catch(function (e) {
  console.error(e.message || e);
  process.exitCode = 1;
});
