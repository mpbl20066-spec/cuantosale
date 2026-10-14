/* El "Desde" de las guias, en un solo lugar: lo usan la guia de la app (/guia, home-guia.html) y la pagina publica
   que indexa Google (/destino/<slug>, lib/destinos-web.js). Antes cada una tenia su copia y un cambio en una dejaba
   a la otra con la regla vieja.

   El viaje tipo es el mismo que cotizan las pestanas de "¿Cuando viajas?" (home-guias.html) y el que abre la app por
   defecto: 2 personas, 7 noches desde el 15 del mes, estilo ahorro, hotel economico y en avion. Se miran los proximos
   11 meses (asi la ultima salida queda dentro del año que cotiza Ignav) y gana el mas barato. Un destino sin vuelo
   usa el medio mas barato que tenga. Precios de /api/destinos-destacados con mes=1: el vuelo real de la salida mas
   barata del mes (de las salidas de lunes a jueves que precarga el cron) y el hotel calibrado con Booking cuando el servidor
   ya los tiene (no gasta busquedas); el item vuelve con esas fechas. Sin precio real, el 15 y el modelo. */
(function () {
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MODO_APP = { avion_mvd: 'avion', avion_ba: 'avion', auto: 'auto', bus: 'bus' };
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function pedir(transporte, items) {
    return fetch('/api/destinos-destacados?' + new URLSearchParams({ pax: '2', style: 'ahorro', origin: 'MVD', transport: transporte, mes: '1', items: items.join(',') }).toString())
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { return (j.items || []).filter(function (x) { return x.pp > 0; }); })
      .catch(function () { return []; });
  }
  var masBarato = function (l) { return l.reduce(function (m, x) { return !m || x.pp < m.pp ? x : m; }, null); };

  /* Promesa con { precio, otro, dep, ret, mes } o null. `precio` es el item del "Desde" (en avion si hay); `otro` es
     el mas barato de cualquier medio para esas mismas fechas, para "Como llegar" (puede ser el mismo). */
  function mesMasBarato(clave) {
    var hoy = new Date(), items = [];
    for (var i = 1; i <= 11; i++) {
      var d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 15, 12), r = new Date(d.getTime() + 7 * 864e5);
      items.push(clave + '~' + iso(d) + '~' + iso(r) + '~economico');
    }
    return pedir('flight', items).then(function (l) {
      var b = masBarato(l);
      return b ? b : pedir('all', items).then(masBarato);
    }).then(function (b) {
      if (!b) return null;
      return pedir('all', [clave + '~' + b.dep + '~' + b.ret + '~economico']).then(function (o) {
        return { precio: b, otro: o[0] || null, dep: b.dep, ret: b.ret, mes: MESES[+b.dep.slice(5, 7) - 1] };
      });
    });
  }

  /* El link a la app con el mismo viaje: fechas, 2 personas y el medio del precio. */
  function linkApp(href, est) {
    if (!est) return href;
    var partes = href.split('?'), q = new URLSearchParams(partes[1] || ''), modo = MODO_APP[est.precio.mode];
    q.set('ida', est.dep); q.set('vuelta', est.ret); q.set('pax', '2');
    if (modo) q.set('modo', modo);
    return partes[0] + '?' + q.toString();
  }

  window.CSEstimado = { mesMasBarato: mesMasBarato, linkApp: linkApp, MESES: MESES };
})();
