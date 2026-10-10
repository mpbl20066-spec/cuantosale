/* Modelo de costos del viaje, compartido por las pantallas del /test.
   (viaje-datos.js)

   POR QUE ESTE ARCHIVO
   El detalle del destino, el presupuesto y las opciones de reserva son tres
   pantallas de la misma persona sobre el mismo viaje. Si cada una tuviera sus
   numeros, el total del detalle y el del presupuesto no darian igual y la
   persona veria dos precios distintos para lo mismo. Los importes viven aca y las
   tres pantallas los leen de aqui.

   QUE HAY DENTRO
   - PARTES: las partidas del viaje, con lo que cuesta por persona y lo que suma
     por noche. Son cifras de ejemplo de la maqueta, no una cotizacion real.
   - costo(ida, vuelta, pax, extras): el total del viaje para esas fechas y esas
     personas.
   - desglose(): las cuatro lineas que muestra el presupuesto, agrupando las
     partidas como las agrupa la maqueta.

   El precio real sale de /api/cotizar; esto es el modelo de ejemplo de /test. */
(function () {
  'use strict';
  var MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
  var iso = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var sumarDias = function (s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  var fdc = function (d) { var q = String(d || '').split('-'); return q.length < 3 ? '' : (+q[2] + ' ' + MESES[+q[1] - 1]); };
  var money = function (n) { return window.CSMoneda ? CSMoneda.fmt(Number(n) || 0) : 'US$ ' + Math.round(Number(n) || 0).toLocaleString('es-UY'); };

  var ICONOS = {
    avion: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    cama: '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.8"/>',
    comida: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2.5 1.5-3 4.5-3 8h3"/>',
    carro: '<path d="M5 16l1.5-6h11L19 16M3 16h18v3H3zM7 19v2M17 19v2"/>',
    playa: '<path d="M12 21V11M12 11c-1-3-4-4-7-3 2 0 4 1 5 3M12 11c1-3 4-4 7-3-2 0-4 1-5 3"/>',
    est: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9.5 20v-6h5v6"/>'
  };

  /* Partidas: pp es lo que suma por persona, pn lo que suma por noche y por persona. */
  var PARTES = [
    { nom: 'Vuelo + traslados', ico: 'avion', pp: 604, pn: 26, detalle: 'Ida y vuelta desde Montevideo, con el traslado al hotel.' },
    { nom: 'Alojamiento', ico: 'cama', pp: 300, pn: 62, detalle: 'Las noches de tu viaje en el hotel.' },
    { nom: 'Comidas', ico: 'comida', pp: 154, pn: 0, detalle: 'Desayuno y cenas para todo el viaje.' },
    { nom: 'Transporte local', ico: 'carro', pp: 64, pn: 0, detalle: 'Moverse por el destino.' },
    { nom: 'Traslados', ico: 'carro', pp: 88, pn: 0, detalle: 'Aeropuerto a hotel y a la vuelta.' },
    { nom: 'Extras y actividades', ico: 'playa', pp: 86, pn: 0, detalle: 'Tours y actividades que podés sumar.' }
  ];
  var EXTRA = { pp: 86, pn: 0, nom: 'Extras y actividades' };

  function armalo(ida, vuelta, pax, extras) {
    var noches = Math.max(1, Math.round((new Date(vuelta + 'T12:00:00') - new Date(ida + 'T12:00:00')) / 864e5));
    var base = PARTES.reduce(function (a, p) { return a + p.pp * pax + p.pn * pax * noches; }, 0);
    if (extras) base += EXTRA.pp * pax;
    return { ida: ida, vuelta: vuelta, pax: pax, noches: noches, extras: !!extras, total: base, porPersona: base / pax };
  }
  /* Las cuatro lineas del presupuesto: las partidas se agrupan como en la maqueta. */
  function desglose(v) {
    var de = function (nombres) {
      return PARTES.filter(function (p) { return nombres.indexOf(p.nom) >= 0; })
        .reduce(function (a, p) { return a + p.pp * v.pax + p.pn * v.pax * v.noches; }, 0)
        + (v.extras && nombres.indexOf(EXTRA.nom) >= 0 ? EXTRA.pp * v.pax : 0);
    };
    return [
      { nom: 'Vuelo + traslados', ico: 'avion', suma: de(['Vuelo + traslados', 'Traslados']) },
      { nom: 'Alojamiento', ico: 'cama', suma: de(['Alojamiento']) },
      { nom: 'Extras', ico: 'playa', suma: de(['Extras y actividades']) },
      { nom: 'Comidas + transporte local', ico: 'comida', suma: de(['Comidas', 'Transporte local']) }
    ];
  }
  /* Los nombres salen de window.CS_DESTS (destinos-datos.js), que es el snapshot
     GENERADO desde lib/model.js con `npm run build:destinos-datos`. Antes esta lista
     estaba escrita a mano acá y se desactualizo sin avisar: decia "São Sebastião"
     para São Paulo, "Porto Seguro" para Porto de Galinhas y "Fortaleza" para Praia
     do Forte, tres destinos con el nombre de otro. Un destino con el nombre de otro
     es peor que uno sin nombre. */
  var Nombres = {};
  (window.CS_DESTS || []).forEach(function (d) { Nombres[d.k] = d.name; });

  /* Tipo de lugar para los filtros del flujo por presupuesto. Sale del `group` del
     modelo (beach / city / nature) y no de una lista escrita a mano: el modelo ya
     clasifica a cada destino y una copia aparte termina clasificando distinto. */
  var TIPO_DE_GROUP = { beach: 'playa', city: 'ciudad', nature: 'naturaleza' };
  var Tipo = {};
  (window.CS_DESTS || []).forEach(function (d) {
    /* Si el destino no esta en el mapa, se trata como ciudad: es lo menos ofensivo,
       porque "Playas" e "Naturaleza" son filtros que acotan y "Ciudades" no. */
    Tipo[d.k] = TIPO_DE_GROUP[d.group] || 'ciudad';
  });
  var TIPOS_TXT = { todos: 'Todos', playa: 'Playas', ciudad: 'Ciudades', naturaleza: 'Naturaleza' };

  window.CS_Viaje = {
    MESES: MESES, iso: iso, sumarDias: sumarDias, fdc: fdc, money: money, ICONOS: ICONOS,
    PARTES: PARTES, EXTRA: EXTRA, Nombres: Nombres, Tipo: Tipo, TIPOS_TXT: TIPOS_TXT,
    armalo: armalo, desglose: desglose,
    /* Defaults compartidos: fechas a partir de la semana que viene, 2 personas. */
    defaults: function (qs) {
      var hoy = iso(new Date());
      return {
        destino: (qs && qs.get('destino')) || 'fln',
        pax: Math.max(1, Math.min(9, (qs && +qs.get('pax')) || 2)),
        ida: (qs && qs.get('ida')) || sumarDias(hoy, 10),
        vuelta: (qs && qs.get('vuelta')) || sumarDias(hoy, 17),
        medio: (qs && qs.get('medio')) || 'avion',
        extras: !!(qs && qs.get('extras'))
      };
    }
  };
})();