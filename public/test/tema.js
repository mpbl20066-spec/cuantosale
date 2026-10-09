/* Tema claro / oscuro de /test. Va en el <head>, antes del CSS, para que la pagina no se pinte clara y despues cambie.
   Usa la misma clave que la app de la raiz (cuantosale_tema): lo que la persona elija en una vale en la otra.
   Sin eleccion guardada, /test arranca en claro (que es como esta disenado). */
(function () {
  var t = 'light';
  try { var g = localStorage.getItem('cuantosale_tema'); if (g === 'night' || g === 'light') t = g; } catch (e) { /* modo privado: queda claro */ }
  document.documentElement.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'light' ? '#F7F8FA' : '#0A101A');
})();
