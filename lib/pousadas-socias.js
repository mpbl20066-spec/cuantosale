'use strict';
/* GET /api/pousadas-socias?dest=<clave> -> { pousadas: [...] }

   Las pousadas que aceptaron la comision por recomendacion (Marketing > Pousadas, estado "Aceptó") de un destino, para
   mostrarlas arriba de Booking en el paso de alojamiento de la web (public/web/home-flujo.html). La reserva no pasa por
   Booking: la persona se la pide a CuantoSale por WhatsApp, CuantoSale le consulta disponibilidad a la pousada y la
   persona le paga el alojamiento directo a la pousada.

   La ficha (nombre, playa, categoria, nota) sale de public/admin/pousadas-datos.js; lo acordado (foto y habitaciones)
   y el estado, de lib/marketing.js. Sin habitaciones con precio acordado no se muestra: el de Booking no es el que
   cobra. Cache de 5 minutos: marcar una
   pousada como socia en el panel tarda eso en verse en la web. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const marketing = require('./marketing');

const DATOS = path.join(__dirname, '..', 'public', 'admin', 'pousadas-datos.js');
const TTL_MS = 5 * 60 * 1000;
let fichas = null, cache = { at: 0, socias: null };

function leerFichas() {
  if (fichas) return fichas;
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(DATOS, 'utf8'), ctx, { timeout: 1000 });
  fichas = {};
  (ctx.window.CS_POUSADAS || []).forEach(function (p) { fichas[p.id] = p; });
  return fichas;
}
/* Las habitaciones acordadas: [{ nombre, personas, alta, baja }] (US$ por noche; baja vacia = la de alta). Lo que no
   tiene nombre o precio de alta se descarta. Las socias de antes (un solo precio) quedan como una doble. */
function num(v) { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function habitaciones(c) {
  let l = [];
  try { l = JSON.parse(c.habs || '[]'); } catch (e) { l = []; }
  l = (Array.isArray(l) ? l : []).slice(0, 10).map(function (h) {
    const alta = num(h && h.alta), baja = num(h && h.baja);
    return { nombre: String((h && h.nombre) || '').trim().slice(0, 60), personas: Math.min(12, Math.max(1, Math.round(num(h && h.personas)) || 2)),
      alta: alta, baja: baja > 0 ? baja : alta };
  }).filter(function (h) { return h.nombre && h.alta > 0 && h.alta <= 5000 && h.baja <= 5000; });
  if (!l.length && num(c.precio) > 0) l = [{ nombre: 'Habitación doble', personas: 2, alta: num(c.precio), baja: num(c.precio) }];
  return l;
}
function fotoValida(u) { return /^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : ''; }

async function pousadasSocias(dest) {
  dest = String(dest || '').toLowerCase();
  if (!/^[a-z0-9_-]{2,30}$/.test(dest)) return [];
  if (!cache.socias || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), socias: await marketing.socias() };
  const f = leerFichas(), out = [];
  Object.keys(cache.socias).forEach(function (id) {
    const p = f[id], c = cache.socias[id];
    if (!p || p.d !== dest) return;
    /* Solo con precios acordados con la pousada: el de Booking no es el que va a cobrar. */
    const habs = habitaciones(c);
    if (!habs.length) return;
    out.push({ id: p.id, nombre: p.n, playa: p.p, categoria: p.c, tipo: p.t === 'Hostel' ? 'Hostel' : 'Pousada', habitaciones: habs,
      nota: p.s || 0, resenas: p.r || 0, foto: fotoValida(c.foto) });
  });
  return out;
}

module.exports = { pousadasSocias: pousadasSocias };
