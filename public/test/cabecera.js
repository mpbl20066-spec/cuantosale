/* Barra superior de escritorio para todas las pantallas internas de /test (la home trae la suya).
   En celular y tablet (< 1024px) no se ve: ahi cada pantalla sigue con su encabezado de siempre.
   Mismos accesos que la barra de la home: Inicio y Destinos navegan; Guardados, Perfil y el menu abren el panel de cuenta
   (los maneja cuenta.js por data-guardados / data-perfil). */
(function () {
  var p = document.documentElement.getAttribute('data-pagina');
  if (!p || p === 'home') return;
  var ic = function (d, f) { return '<svg viewBox="0 0 24 24" ' + (f ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"') + ' aria-hidden="true">' + d + '</svg>'; };
  var h = document.createElement('header');
  h.className = 'cs-top';
  h.innerHTML =
    '<a class="cs-top__logo" href="home-dos-caminos.html" aria-label="CuántoSale, ir al inicio"><svg width="28" height="34" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 20 12 30 12 30s12-10 12-18.2C24 5.3 18.6 0 12 0z" fill="var(--ink)"/><circle cx="12" cy="11.5" r="4.6" fill="#F6B21B"/></svg><span><b>cuántosale</b><small>Tu viaje, sin sorpresas</small></span></a>' +
    '<nav class="cs-top__nav" aria-label="Navegación principal">' +
    '<a class="cs-top__a" href="home-dos-caminos.html">' + ic('<path d="M12 3 3 10.5V21h6v-6h6v6h6V10.5z"/>', true) + 'Inicio</a>' +
    '<a class="cs-top__a' + (p === 'guias' || p === 'guia' ? ' is-on' : '') + '" href="home-guias.html?fuente=nav_destinos">' + ic('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>') + 'Destinos</a>' +
    '<button type="button" class="cs-top__a" data-guardados>' + ic('<path d="M6 3h12v18l-6-4.5L6 21z"/>') + 'Guardados</button>' +
    '<button type="button" class="cs-top__a" data-perfil>' + ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>') + 'Perfil</button>' +
    '<button type="button" class="cs-top__menu" data-perfil aria-label="Abrir el menú de la cuenta"><span></span><span></span><span></span></button>' +
    '</nav>';
  document.body.insertBefore(h, document.body.firstChild);
  document.documentElement.classList.add('cs-hdr');

  /* En escritorio (>= 1024px) scrollea la pagina y no la caja #main (ver web.css). Las pantallas guardan y restauran
     $('main').scrollTop al repintar: se redirige a la ventana para no tocar cada una. */
  var mq = window.matchMedia('(min-width:1024px)');
  var m = document.getElementById('main');
  if (m) {
    var d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(m, 'scrollTop', {
      configurable: true,
      get: function () { return mq.matches ? window.pageYOffset : d.get.call(m); },
      set: function (v) { if (mq.matches) window.scrollTo(0, v); else d.set.call(m, v); }
    });
  }
})();
