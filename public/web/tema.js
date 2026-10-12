/* Tema claro / oscuro de /web. Va en el <head>, antes del CSS, para que la pagina no se pinte clara y despues cambie.
   Sigue al sistema (prefers-color-scheme) y cambia en vivo si la persona cambia el modo del celular o la compu.
   Solo si la persona toca "Modo oscuro" en el panel de la cuenta (cuenta.js) queda fijo lo que eligio: se guarda en
   cs_tema_manual. La clave vieja de la app (cuantosale_tema) ya no se lee: la escribia sola y tapaba al sistema. */
(function () {
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var manual = function () { try { var g = localStorage.getItem('cs_tema_manual'); return g === 'night' || g === 'light' ? g : ''; } catch (e) { return ''; } };
  var aplicar = function () {
    var t = manual() || (mq && mq.matches ? 'night' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'light' ? '#F7F8FA' : '#0A101A');
  };
  aplicar();
  if (mq) {
    var cambio = function () { if (!manual()) aplicar(); };
    if (mq.addEventListener) mq.addEventListener('change', cambio); else if (mq.addListener) mq.addListener(cambio);
  }
})();
