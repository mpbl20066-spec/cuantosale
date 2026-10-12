/* Que medio recomendar para un destino y en que orden mostrar los destinos, segun la plata de la persona.
   Lo usan la home ("¿Con cuanta plata contas?") y /presupuesto, para que las dos digan lo mismo.

   Medio recomendado: entre los que entran en el presupuesto, el de menor costo "efectivo" = precio por persona + horas
   de viaje de ida y vuelta valuadas a VALOR_HORA. Las horas son las del modelo (destinos-datos.js, `horas`): el auto
   suma 15 % de paradas y el avion 2 h de aeropuerto. Asi 12-13 h de manejo a Porto Alegre o Gramado siguen siendo
   auto, y las 17 h a Florianopolis pasan a avion salvo que el auto sea mucho mas barato (por ejemplo, con 4 en el auto).
   Antes se mostraba siempre el mas barato, y con varias personas era el auto a todos lados.

   Orden (solo entre los que entran): sobre todo cuanto aprovecha la plata (con US$ 2.750 no se busca un viaje de
   US$ 400: arriba salen Fernando de Noronha y los viajes que se acercan al monto), con un empujon para los destinos
   mas buscados (POPULARES, los de la portada), que igual aparecen cerca del principio aunque salgan baratos.
   Necesita destinos-datos.js antes. */
(function () {
  'use strict';
  var VALOR_HORA = 10, POPULARES = ['rio', 'fln', 'buz', 'bcm', 'bombinhas'];
  var HORAS = {};
  (window.CS_DESTS || []).forEach(function (d) { HORAS[d.k] = d.horas || {}; });
  /* Los medios del server (auto, bus, avion_mvd, avion_ba) a los de destinos-datos.js (auto, bus, avion). */
  var base = function (m) { return /^avion/.test(m) ? 'avion' : m; };
  function horas(k, m) {
    var h = (HORAS[k] || {})[base(m)];
    if (h == null) return null;
    return base(m) === 'auto' ? h * 1.15 : base(m) === 'avion' ? h + 2 : h;
  }
  function efectivo(k, m, p) { var h = horas(k, m); return p + (h == null ? 0 : 2 * h * VALOR_HORA); }
  /* ops: [{ m, p }] (p = precio por persona). Devuelve { m, p, alt: [los otros que entran, del mas barato] }.
     Si ninguno entra, el mas barato (para decir "te falta poco"). */
  function medio(k, ops, presupuesto) {
    if (!ops || !ops.length) return null;
    var entran = ops.filter(function (o) { return o.p <= presupuesto; });
    var rec = (entran.length ? entran : ops).slice().sort(function (a, b) { return entran.length ? efectivo(k, a.m, a.p) - efectivo(k, b.m, b.p) : a.p - b.p; })[0];
    return { m: rec.m, p: rec.p, alt: entran.filter(function (o) { return o.m !== rec.m; }).sort(function (a, b) { return a.p - b.p; }) };
  }
  /* Puntaje de relevancia de un destino que entra, con su precio recomendado p. Mayor = va antes. */
  function relevancia(k, p, presupuesto) {
    var pop = POPULARES.indexOf(k);
    return Math.min(1, p / presupuesto) + (pop >= 0 ? 0.35 - pop * 0.02 : 0);
  }
  /* Texto de las horas de ida: "unas 6 h", "17 h de manejo", "22 h de bus". */
  function horasTxt(k, m) {
    var h = (HORAS[k] || {})[base(m)];
    if (h == null) return '';
    return base(m) === 'auto' ? Math.round(h) + ' h de manejo' : base(m) === 'bus' ? Math.round(h) + ' h de bus' : 'unas ' + Math.round(h) + ' h';
  }
  window.CSRecomendar = { medio: medio, relevancia: relevancia, horasTxt: horasTxt, POPULARES: POPULARES };
})();
