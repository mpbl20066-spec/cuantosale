/* Medicion de la maqueta. Usa la misma funcion global track() que la app
   (la define server.js junto a GA4); si no existe, no hace nada. Con ?debug=1
   muestra un panel con cada evento, para verificar sin abrir Analytics.
   Cualquier elemento con data-evento="nombre" manda ese evento al hacer clic y
   lleva como parametros el resto de sus data-*. */
(function () {
  /* ID unico del viaje: nace en la primera pantalla y viaja en TODOS los eventos (y en los enlaces de
     salida), asi se puede seguir una misma persona de la home a la reserva y contar cuantos terminan. */
  var viajeId = (location.search.match(/[?&]viaje=([A-Za-z0-9-]+)/) || [])[1] || null;
  try { viajeId = viajeId || sessionStorage.getItem('cs_viaje_id'); } catch (e) { /* modo privado */ }
  if (!viajeId) viajeId = 'CS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  try { sessionStorage.setItem('cs_viaje_id', viajeId); } catch (e) { /* modo privado */ }
  window.CS_VIAJE_ID = viajeId;
  var debug = /[?&]debug=1/.test(location.search), panel = null;
  function mostrar(nombre, params) {
    if (!debug) return;
    if (!panel) {
      panel = document.createElement('pre');
      panel.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:340px;max-height:40vh;overflow:auto;margin:0;padding:8px 10px;background:#0A101A;color:#9FE8C3;font:11px/1.4 monospace;border-radius:8px;z-index:99;white-space:pre-wrap';
      document.body.appendChild(panel);
    }
    panel.textContent += nombre + ' ' + JSON.stringify(params) + '\n';
    panel.scrollTop = panel.scrollHeight;
  }
  window.mockTrack = function (nombre, params) {
    params = params || {};
    if (!params.viaje_id) params.viaje_id = window.CS_VIAJE_ID;
    try { if (typeof window.track === 'function') window.track(nombre, params); } catch (e) { /* Analytics nunca rompe la pagina */ }
    mostrar(nombre, params);
  };
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-evento]');
    if (!el) return;
    var params = {};
    Object.keys(el.dataset).forEach(function (k) { if (k !== 'evento') params[k] = el.dataset[k]; });
    window.mockTrack(el.dataset.evento, params);
  });
  /* Vista de la pagina: "fuente" dice de que boton de la home vino la persona. */
  var fuente = (location.search.match(/[?&]fuente=([^&]+)/) || [])[1];
  var pagina = document.documentElement.getAttribute('data-pagina');
  if (pagina) window.mockTrack('vista_pagina', { pagina: pagina, fuente: fuente ? decodeURIComponent(fuente) : 'directo' });
})();
