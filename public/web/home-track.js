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
  /* Contador de uso propio (/api/uso, lib/uso.js): para los eventos que importan, suma uno por dia sin guardar nada de
     la persona, asi cuenta tambien a quien no acepto las cookies de Analytics. Solo estos eventos, y como detalle una
     palabra corta (pagina, destino, pestana). */
  var USO = { vista_pagina: 'pagina', guias_ranking: 'ranking', guias_mes: '', guias_abrir: 'destino', guias_cotizar: 'destino',
    guias_fav_agregar: 'destino', guia_fav_agregar: 'destino', guias_ver_favoritos: '', guias_buscar: '', guias_filtro_tipo: 'tipo',
    guias_mapa_pin: 'destino', guias_mapa_zoom: 'accion', guia_calcular_viaje: 'destino', guia_alerta_creada: 'destino', alerta_precio_creada: '', llegada: 'origen' };
  function contar(nombre, params) {
    if (!(nombre in USO) || debug || !/^https?:$/.test(location.protocol)) return;
    var d = USO[nombre] ? String(params[USO[nombre]] || '').toLowerCase() : '';
    if (!/^[a-z0-9_-]{0,24}$/.test(d)) d = '';
    try {
      var cuerpo = JSON.stringify({ e: nombre, d: d });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/uso', new Blob([cuerpo], { type: 'application/json' }));
      else fetch('/api/uso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true }).catch(function () {});
    } catch (e) { /* el contador nunca rompe la pagina */ }
  }
  /* Demanda insatisfecha (/api/demanda, lib/demanda.js, panel Sistema > Demanda): que destinos cotiza la gente, si hubo
     vuelos, si pidio algo y que busca que no tenemos. Para contar PERSONAS y no solo busquedas, el navegador guarda un
     numero al azar (cs_v): no es nombre, ni correo, ni IP. Va tambien como cookie para que el pedido de reserva
     (lib/reservas.js) sepa de que visitante es sin cambiar el formulario. */
  var visitante = '';
  try { visitante = localStorage.getItem('cs_v') || ''; } catch (e) { /* modo privado */ }
  if (!/^[a-z0-9]{8,24}$/.test(visitante)) {
    visitante = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 18);
    try { localStorage.setItem('cs_v', visitante); } catch (e) { /* modo privado: dura la visita */ }
  }
  try { document.cookie = 'cs_v=' + visitante + '; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) { /* sin cookies */ }
  function demanda(evento, datos) {
    if (debug || !/^https?:$/.test(location.protocol)) return;
    try {
      var cuerpo = JSON.stringify(Object.assign({ v: visitante, e: evento }, datos || {}));
      if (navigator.sendBeacon) navigator.sendBeacon('/api/demanda', new Blob([cuerpo], { type: 'application/json' }));
      else fetch('/api/demanda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true }).catch(function () {});
    } catch (e) { /* nunca rompe la pagina */ }
  }
  /* Buscadores de destinos: se llama en cada tecla con lo escrito y si hubo resultados. Manda solo lo que quedo quieto
     1,5 s sin resultados, una vez por texto y visita. */
  var buscarT = null, buscados = {};
  window.CSDemanda = {
    cotizo: function (d) { demanda('cotizo', d); },
    vuelos: function (d) { demanda('vuelos', d); },
    buscado: function (texto, hayResultados) {
      clearTimeout(buscarT);
      var q = String(texto || '').trim().toLowerCase();
      if (hayResultados || q.length < 3 || /[0-9@]/.test(q)) return;
      buscarT = setTimeout(function () { if (buscados[q]) return; buscados[q] = 1; demanda('buscar_sin', { q: q }); }, 1500);
    }
  };
  window.mockTrack = function (nombre, params) {
    params = params || {};
    if (!params.viaje_id) params.viaje_id = window.CS_VIAJE_ID;
    try { if (typeof window.track === 'function') window.track(nombre, params); } catch (e) { /* Analytics nunca rompe la pagina */ }
    contar(nombre, params);
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
  /* De que red vino la visita: los enlaces de la bio, de los creadores y de los anuncios llevan ?utm_source=. Se cuenta
     una vez por visita (pestana), para que el panel (Marketing > Tablero) sepa cuanta gente trae cada uno. */
  var origen = (location.search.match(/[?&]utm_source=([^&#]+)/) || [])[1];
  if (origen) {
    try { origen = decodeURIComponent(origen).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24); } catch (e) { origen = ''; }
    var yaContada = false;
    try { yaContada = !!sessionStorage.getItem('cs_llegada'); sessionStorage.setItem('cs_llegada', origen); } catch (e) { /* modo privado */ }
    if (origen && !yaContada) window.mockTrack('llegada', { origen: origen });
    /* Ademas se recuerda 30 dias (la ultima red de la que vino), para que el pedido diga de donde salio aunque reserve
       otro dia: ve el reel hoy, reserva el fin de semana. Solo el nombre de la fuente, nada de la persona. */
    if (origen) try { localStorage.setItem('cs_fuente', JSON.stringify({ f: origen, t: Date.now() })); } catch (e) { /* modo privado */ }
  }
  window.CS_FUENTE = function () {
    try {
      var x = JSON.parse(localStorage.getItem('cs_fuente') || 'null');
      return x && x.f && Date.now() - x.t < 30 * 864e5 ? String(x.f) : '';
    } catch (e) { return ''; }
  };
})();
