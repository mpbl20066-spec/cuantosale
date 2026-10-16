'use strict';
/*
 * Etapa 1 del modulo de Operaciones: congela como precio_publicado el precio que
 * la web muestra HOY de cada tour, y lo deja anotado en el historial como punto
 * de partida.
 *
 *   node scripts/ops-publicar-inicial.js            (muestra lo que haria)
 *   node scripts/ops-publicar-inicial.js --aplicar
 *
 * El precio se calcula con lib/tours.js (desdeFila) y la cotizacion y el margen
 * de data/tours.json, que es exactamente la cuenta que hace la web ahora: asi el
 * numero publicado es el mismo hasta el centavo, sin depender de como redondea
 * Postgres. Solo toca filas sin precio_publicado, asi que correrlo de nuevo no
 * pisa nada publicado desde el panel.
 *
 * Requiere haber corrido sql/supabase_operaciones.sql.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
try {
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).forEach(function (linea) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* no hay .env */ }

const { desdeFila } = require('../lib/tours');

const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const H = { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' };

async function pedir(ruta, opciones) {
  const r = await fetch(url + '/rest/v1/' + ruta, Object.assign({ headers: H }, opciones || {}));
  const texto = await r.text();
  if (!r.ok) throw new Error(ruta.split('?')[0] + ' respondio ' + r.status + ': ' + texto.slice(0, 300));
  return texto ? JSON.parse(texto) : null;
}

(async function () {
  if (!url || !key) throw new Error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  const aplicar = process.argv.includes('--aplicar');

  const j = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'tours.json'), 'utf8'));
  const cotizacion = Number(j._meta && j._meta.cotizacion_brl_usd) || 0;
  const margen = Number(j._meta && j._meta.margen_usd) || 0;

  let filas;
  try {
    filas = await pedir('tours?select=id,destino,titulo,precio,precio_brl,precio_publicado,activo&precio_publicado=is.null');
  } catch (e) {
    if (/precio_publicado/.test(e.message)) {
      console.log('La columna precio_publicado no existe: primero corre sql/supabase_operaciones.sql en Supabase.');
      process.exit(1);
    }
    throw e;
  }

  const plan = filas
    .filter((f) => f.precio != null || f.precio_brl != null)
    .map((f) => ({ fila: f, publicado: desdeFila(f, '', cotizacion, margen).price }));

  console.log('Cotizacion ' + cotizacion + ', margen US$ ' + margen + '.');
  console.log(plan.length + ' tours sin precio publicado (' + (filas.length - plan.length) + ' sin ningun precio, se dejan).');
  plan.slice(0, 5).forEach((p) => console.log('  ' + p.fila.destino + ' · ' + p.fila.titulo + ' -> US$ ' + p.publicado));
  if (!aplicar) { console.log('\nNo se cambio nada. Para guardar: --aplicar'); return; }

  const ahora = new Date().toISOString();
  let n = 0;
  for (const p of plan) {
    await pedir('tours?id=eq.' + p.fila.id, {
      method: 'PATCH',
      body: JSON.stringify({ precio_publicado: p.publicado, publicado_at: ahora })
    });
    n++;
  }

  // El punto de partida del historial: sin esto, el primer cambio real no tiene
  // contra que compararse en la pantalla de historial.
  const historial = plan.map((p) => ({
    tour_id: p.fila.id,
    tour_clave: p.fila.destino + '#' + p.fila.titulo,
    origen: 'inicial',
    antes: {},
    despues: { precio: p.fila.precio, precio_brl: p.fila.precio_brl },
    publicado_antes: null,
    publicado_despues: p.publicado,
    fuente: 'Precio que mostraba la web al activar Operaciones (R$/' + cotizacion + ' + US$ ' + margen + ')',
    estado: 'publicado',
    creado_por: 'sistema',
    resuelto_por: 'sistema',
    resuelto_at: ahora
  }));
  for (let i = 0; i < historial.length; i += 200) {
    await pedir('precio_cambios', { method: 'POST', body: JSON.stringify(historial.slice(i, i + 200)) });
  }
  console.log('Listo: ' + n + ' precios publicados y anotados en el historial.');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
