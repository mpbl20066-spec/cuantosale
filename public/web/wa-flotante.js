/* Boton flotante de WhatsApp (abajo a la derecha). Lo cargan la home, las guias de la app y las paginas publicas
   /destino/<slug>: el numero solo estaba en el pie y la consulta por WhatsApp es como se cierran las reservas.

   El mensaje sale escrito segun la pagina: con el destino si lo hay (data-destino en el <script>, o el <h1> de la guia
   de la app, "Buzios: descubri...") y si no, uno general. Se mide con track('whatsapp_click', { lugar, destino }).

   Se sube por encima de lo que este pegado abajo (pestanas de la home, pie de la guia, barra de cookies): mide esas
   barras al cargar, al cambiar el tamano y al hacer scroll, en vez de fijar un numero que cambia con cada pantalla. */
(function () {
  if (document.getElementById('cs-wa')) return;
  var NUMERO = '59898529851';
  var script = document.currentScript;
  var pagina = document.documentElement.getAttribute('data-pagina') || (script && script.getAttribute('data-lugar')) || 'web';

  function destino() {
    var d = script && script.getAttribute('data-destino');
    if (d) return d;
    if (pagina === 'guia') {
      var h1 = document.querySelector('h1');
      var t = h1 ? h1.textContent.split(':')[0].trim() : '';
      if (t && t.length < 40) return t;
    }
    return '';
  }
  function texto() {
    var d = destino();
    return d ? 'Hola! Estoy viendo ' + d + ' en CuántoSale y tengo una consulta.'
      : 'Hola! Estoy armando un viaje a Brasil en CuántoSale y tengo una consulta.';
  }

  var css = document.createElement('style');
  css.textContent =
    '#cs-wa{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px) + var(--cs-wa-sube,0px));z-index:2147482000;' +
    'display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#F6B21B;color:#0B1F3A;border:2px solid #0B1F3A;' +
    'box-shadow:3px 3px 0 #0B1F3A;text-decoration:none;transition:transform .15s ease,bottom .2s ease}' +
    '#cs-wa:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 #0B1F3A}#cs-wa:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #0B1F3A}' +
    '#cs-wa:focus-visible{outline:3px solid #0B1F3A;outline-offset:3px}' +
    '#cs-wa svg{width:30px;height:30px}' +
    '@media (prefers-reduced-motion:reduce){#cs-wa{transition:none}}' +
    '@media print{#cs-wa{display:none}}';
  document.head.appendChild(css);

  var a = document.createElement('a');
  a.id = 'cs-wa';
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Escribinos por WhatsApp');
  a.href = 'https://wa.me/' + NUMERO;
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3z"/></svg>';
  /* El texto se arma al tocar: en la guia de la app el <h1> se pinta despues de cargar el script. */
  a.addEventListener('click', function () {
    a.href = 'https://wa.me/' + NUMERO + '?text=' + encodeURIComponent(texto());
    try { if (typeof window.track === 'function') window.track('whatsapp_click', { lugar: pagina, destino: destino() || '' }); } catch (e) { /* la medicion nunca rompe */ }
  });

  /* Barras pegadas abajo: pestanas de la home, pie de la guia y del flujo, y el aviso de cookies. */
  var BARRAS = '.tabs,.u-foot,.f-foot,#cs-consent';
  var pend = false;
  function ubicar() {
    pend = false;
    var alto = window.innerHeight, sube = 0, cambio = true;
    var rects = [].map.call(document.querySelectorAll(BARRAS), function (el) { return el.getBoundingClientRect(); })
      .filter(function (r) { return r.height > 0 && r.height < alto * 0.4 && r.top > alto * 0.5; });
    /* Apiladas: el aviso de cookies empuja las pestanas hacia arriba, asi que una barra cuenta si toca el borde de
       la pantalla o el techo de la que ya se conto. */
    while (cambio) {
      cambio = false;
      rects.forEach(function (r) { if (r.bottom >= alto - sube - 2 && alto - r.top > sube) { sube = alto - r.top; cambio = true; } });
    }
    a.style.setProperty('--cs-wa-sube', Math.round(sube) + 'px');
  }
  function pedir() { if (!pend) { pend = true; (window.requestAnimationFrame || setTimeout)(ubicar); } }

  function montar() {
    document.body.appendChild(a);
    ubicar();
    window.addEventListener('resize', pedir);
    window.addEventListener('scroll', pedir, { passive: true, capture: true });
    document.addEventListener('click', function () { setTimeout(ubicar, 350); });
    /* Las barras de la app y el aviso de cookies aparecen un poco despues de cargar. */
    [400, 1200, 2500].forEach(function (ms) { setTimeout(ubicar, ms); });
  }
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();
