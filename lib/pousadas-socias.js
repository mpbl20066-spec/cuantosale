'use strict';
/* GET /api/pousadas-socias?dest=<clave> -> { pousadas: [...] }

   Las pousadas que aceptaron la comision por recomendacion (Marketing > Pousadas, estado "Aceptó") de un destino, para
   mostrarlas arriba de Booking en el paso de alojamiento de la web (public/web/home-flujo.html). La reserva no pasa por
   Booking: la persona se la pide a CuantoSale por WhatsApp, CuantoSale le consulta disponibilidad a la pousada y la
   persona le paga el alojamiento directo a la pousada.

   La ficha (nombre, playa, categoria, nota) sale de public/admin/pousadas-datos.js; lo acordado (foto y precio por noche)
   y el estado, de lib/marketing.js. Sin precio acordado no se muestra: el de Booking no es el que cobra. Cache de 5 minutos: marcar una
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
function fotoValida(u) { return /^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : ''; }

async function pousadasSocias(dest) {
  dest = String(dest || '').toLowerCase();
  if (!/^[a-z0-9_-]{2,30}$/.test(dest)) return [];
  if (!cache.socias || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), socias: await marketing.socias() };
  const f = leerFichas(), out = [];
  Object.keys(cache.socias).forEach(function (id) {
    const p = f[id], c = cache.socias[id];
    if (!p || p.d !== dest) return;
    /* Solo con el precio por noche acordado con la pousada: el de Booking no es el que va a cobrar. */
    const noche = Number(String(c.precio || '').replace(',', '.'));
    if (!(noche > 0)) return;
    out.push({ id: p.id, nombre: p.n, playa: p.p, categoria: p.c, tipo: p.t === 'Hostel' ? 'Hostel' : 'Pousada', noche: noche,
      nota: p.s || 0, resenas: p.r || 0, foto: fotoValida(c.foto) });
  });
  return out;
}

module.exports = { pousadasSocias: pousadasSocias };
