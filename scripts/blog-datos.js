#!/usr/bin/env node
/* Numeros para las notas del blog (data/blog/*.html), sacados del mismo calculo que las guias: /api/destinos-destacados
   con mes=1 (el vuelo real mas barato de las salidas que precarga el cron, si esta en la cache, y el hotel calibrado
   con Booking) y desglose=1 (el detalle por rubro de cada medio). Viaje tipo de las guias: 2 personas, 7 noches,
   estilo ahorro, hotel economico, saliendo de Montevideo.

   Uso: con el server corriendo (node server.js, que lee las mismas caches de Supabase que produccion):
     node scripts/blog-datos.js [http://localhost:3000] > data/blog-datos.json
   Las notas citan la fecha de consulta: los numeros son una foto de ese dia, no se actualizan solos. */
'use strict';
const model = require('../lib/model');

const BASE = (process.argv[2] || 'http://localhost:' + (process.env.PORT || 3000)).replace(/\/$/, '');
const NORDESTE = ['porto', 'mcz', 'maragogi', 'nat', 'pip', 'ssa', 'for', 'jericoacoara', 'morro', 'portoseguro', 'itacare', 'forte', 'ajuda', 'trancoso', 'rec', 'joaopessoa'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = function (n) { return String(n).padStart(2, '0'); };

/* El 15 de cada mes, 7 noches: lo mismo que pide estimado-guia.js. Con mes=1 el server lo cambia por la salida mas
   barata del mes si tiene vuelo real. */
function itemMes(clave, anio, mes) {
  const ret = new Date(anio, mes - 1, 22);
  return clave + '~' + anio + '-' + pad(mes) + '-15~' + ret.getFullYear() + '-' + pad(ret.getMonth() + 1) + '-' + pad(ret.getDate()) + '~economico';
}
async function pedir(items, pax) {
  const out = [];
  for (let i = 0; i < items.length; i += 40) {
    const q = new URLSearchParams({ pax: String(pax || 2), style: 'ahorro', origin: 'MVD', transport: 'all', mes: '1', desglose: '1', items: items.slice(i, i + 40).join(',') });
    let r = null;
    /* El endpoint tiene limite por minuto: ante un 429 se espera y se reintenta. */
    for (let intento = 0; intento < 6; intento++) {
      r = await fetch(BASE + '/api/destinos-destacados?' + q.toString());
      if (r.status !== 429) break;
      await new Promise(function (ok) { setTimeout(ok, 15000); });
    }
    if (!r.ok) throw new Error('HTTP ' + r.status + ' en destinos-destacados');
    out.push.apply(out, (await r.json()).items || []);
  }
  return out;
}
const resumen = function (it) {
  const porMedio = {};
  (it.opciones || []).forEach(function (o) { porMedio[o.mode] = { pp: o.pp, total: o.total, dur: o.dur, parts: o.parts, vueloReal: !!o.vueloReal }; });
  return { clave: it.key, nombre: model.DEST[it.key].name, region: model.DEST[it.key].region, dep: it.dep, ret: it.ret,
    masBarato: { modo: it.mode, pp: it.pp }, vuelo: it.vuelo, hotel: it.hotel, porMedio: porMedio };
};

async function main() {
  const hoy = new Date();
  /* Los proximos 11 meses, como las guias. */
  const meses = [];
  for (let i = 1; i <= 11; i++) { const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 15); meses.push([d.getFullYear(), d.getMonth() + 1]); }
  const porMes = async function (clave) {
    const l = await pedir(meses.map(function (m) { return itemMes(clave, m[0], m[1]); }));
    return l.map(function (it, i) { return Object.assign({ mes: MESES[meses[i][1] - 1] + ' ' + meses[i][0] }, resumen(it)); });
  };
  const enero = [2027, 1], marzo = [2027, 3];
  const claves = Object.keys(model.DEST).filter(function (k) { return model.DEST[k].modes && model.DEST[k].modes.avion_mvd; });
  const ranking = async function (m, pax) {
    return (await pedir(claves.map(function (k) { return itemMes(k, m[0], m[1]); }), pax)).map(resumen)
      .sort(function (a, b) { return a.masBarato.pp - b.masBarato.pp; });
  };
  const datos = {
    consultado: hoy.toISOString().slice(0, 10),
    viaje: '2 personas, 7 noches, estilo ahorro, hotel economico, desde Montevideo',
    floripaPorMes: await porMes('fln'),
    camboriuPorMes: await porMes('bcm'),
    rankingEnero2027: await ranking(enero),
    rankingMarzo2027: await ranking(marzo),
    /* Lo mismo viajando de a 4 (dos habitaciones, un auto): para comparar auto, bus y avion segun el grupo. */
    rankingEnero2027Pax4: await ranking(enero, 4),
    rioPorMes: await porMes('rio'),
    buziosPorMes: await porMes('buz'),
    arraialPorMes: await porMes('arraial'),
    nordestePorMes: {}
  };
  for (const k of NORDESTE) datos.nordestePorMes[k] = await porMes(k);
  process.stdout.write(JSON.stringify(datos, null, 1) + '\n');
}
main().catch(function (e) { console.error(e.message); process.exit(1); });
