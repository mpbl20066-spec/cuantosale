'use strict';
/* Embudo de ventas para el panel (Sistema > Uso): de la visita a la seña pagada, con lo que ya registra la web.

   Cada paso viene de una fuente distinta, y por eso no tienen la misma unidad (se dice en cada uno):
     1. Entraron a la web      vistas de la home (contador de uso, lib/uso.js). Son visitas, no personas.
     2. Armaron un viaje       personas distintas que cotizaron (lib/demanda.js, numero al azar del navegador).
     3. Pidieron la reserva    pedidos creados en el periodo (lib/pedidos.js).
     4. Pagaron la seña        pedidos con algun cobro registrado.

   Las visitas que son nuestras (sesion del panel, el navegador marcado en /yo, localhost) no se cuentan: no llegan al
   contador de uso y en demanda quedan marcadas como prueba. `pruebas` dice cuantas hubo en el periodo, para que se vea
   que el filtro anda. */

function dias(n) { return Math.min(90, Math.max(1, Number(n) || 30)); }

async function calcular(fuentes, n) {
  n = dias(n);
  const [uso, dem, demTodo, lista] = await Promise.all([
    fuentes.uso(n),
    fuentes.demanda(n, false),
    fuentes.demanda(n, true),
    fuentes.pedidos().catch(function () { return []; })
  ]);
  const vistas = (uso.filas || []).reduce(function (t, f) { return t + (f.evento === 'vista_pagina' && f.detalle === 'home' ? f.n : 0); }, 0);
  const personas = function (filas, evento) {
    const s = {}; (filas || []).forEach(function (f) { if (f.evento === evento && f.visitante) s[f.visitante] = 1; });
    return Object.keys(s).length;
  };
  const desdeISO = uso.desde + 'T00:00:00-03:00';
  const pedidos = (lista || []).filter(function (p) { return String(p.created_at || '') >= desdeISO; });
  const conSena = pedidos.filter(function (p) {
    return (p.pagos || []).some(function (x) { return !x.reembolso && (x.monto_usd || 0) > 0; });
  }).length;
  const filasTodas = (demTodo && demTodo.filas) || [], filasReales = (dem && dem.filas) || [];
  const pruebas = new Set(filasTodas.filter(function (f) { return f.prueba && f.visitante; }).map(function (f) { return f.visitante; })).size;
  return {
    desde: uso.desde, hasta: uso.hasta, dias: n,
    pasos: [
      { id: 'entraron', nombre: 'Entraron a la web', n: vistas, unidad: 'visitas a la home' },
      { id: 'armaron', nombre: 'Armaron un viaje', n: personas(filasReales, 'cotizo'), unidad: 'personas que cotizaron' },
      { id: 'pidieron', nombre: 'Pidieron la reserva', n: pedidos.length, unidad: 'pedidos' },
      { id: 'sena', nombre: 'Pagaron la seña', n: conSena, unidad: 'pedidos con un cobro' }
    ],
    vuelos: personas(filasReales, 'vuelos'),
    pruebas: pruebas
  };
}

module.exports = { calcular: calcular };
