'use strict';
/* Busquedas recientes de la Home.

   Invitados: se guardan en localStorage del navegador.
   Con sesion: se guardan ademas en el perfil de la cuenta (user_metadata de
   Supabase Auth, clave `busquedas_recientes`), asi siguen ahi en otro
   dispositivo. No hace falta una tabla nueva: son 4 entradas chicas.

   Al iniciar sesion se unen las del navegador con las de la cuenta (las mas
   nuevas primero, sin repetidas, maximo 4).

   Cada entrada: { dest, destLabel, subcategory, second, hotelType, dep, ret,
   pax, style, transport, origin, t }. Tocarla llama a CS_APP.aplicar(), que
   rellena el formulario y relanza la cotizacion. */
(function () {
  var CLAVE = 'cs_recientes_v1';
  var MAX = 4;
  var ESTILOS = { ahorro: 'Económica', eq: 'Equilibrada', comodo: 'Premium' };
  var TRANSPORTES = { flight: '✈️ Vuelo', bus: '🚌 Bus', auto: '🚗 Auto', roadtrip: '🚗 Auto' };
  var temporizador = null;
  var ultimoUsuario = null;
  var ignorarRemotoHasta = 0; // tras Borrar, la cuenta tarda un momento en reflejarlo

  function leerLocal() {
    try { var l = JSON.parse(localStorage.getItem(CLAVE) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  function guardarLocal(lista) {
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (e) { /* modo privado o sin espacio */ }
  }
  function clave(b) { return [b.dest, b.subcategory || '', b.second || '', b.dep, b.ret, b.pax, b.style, b.transport].join('|'); }
  function limpiar(lista) {
    var vistos = {};
    return (Array.isArray(lista) ? lista : []).filter(function (b) { return b && b.dest && b.t; })
      .sort(function (a, b) { return b.t - a.t; })
      .filter(function (b) { var k = clave(b); if (vistos[k]) return false; vistos[k] = 1; return true; })
      .slice(0, MAX);
  }
  function usuario() { return window.CS_APP && window.CS_APP.usuario ? window.CS_APP.usuario() : null; }
  function listaRemota(u) {
    var l = u && u.user_metadata && u.user_metadata.busquedas_recientes;
    return Array.isArray(l) ? l : [];
  }
  function subirARemoto(lista) {
    var c = window.CS_APP && window.CS_APP.cliente && window.CS_APP.cliente();
    var u = usuario();
    if (!c || !u) return;
    var igual = JSON.stringify(limpiar(listaRemota(u))) === JSON.stringify(lista);
    if (igual) return;
    c.auth.updateUser({ data: { busquedas_recientes: lista } }).then(function () { /* ok */ }, function () { /* sin red: queda en el navegador */ });
  }
  function actual() {
    var u = usuario();
    return limpiar(u && Date.now() > ignorarRemotoHasta ? listaRemota(u).concat(leerLocal()) : leerLocal());
  }

  function etiquetaDestino() {
    var t = document.querySelector('#dest .custom-select__trigger');
    var s = t && t.value ? String(t.value).trim() : '';
    return s;
  }
  function fechaCorta(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    try { return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', ''); } catch (e) { return iso; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Se anota la busqueda cuando el formulario se queda quieto un momento: el
     usuario cambia viajeros o fechas y cada cambio dispara una cotizacion, y no
     queremos una entrada por cada paso intermedio. */
  function registrar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      var S = window.CS_APP && window.CS_APP.estado;
      if (!S || !S.dest || S.dest === 'todos' || !S.dep || !S.ret) return;
      var nueva = {
        dest: S.dest, destLabel: etiquetaDestino(), subcategory: S.subcategory || '', second: S.second || '',
        hotelType: S.hotelTypeExplicit ? S.hotelType : '', dep: S.dep, ret: S.ret, pax: S.pax, style: S.style,
        transport: S.transport, origin: S.origin, t: Date.now()
      };
      var lista = actual();
      // Un ajuste del mismo destino hecho hace poco reemplaza a la entrada anterior.
      lista = lista.filter(function (b) { return !(b.dest === nueva.dest && (b.subcategory || '') === nueva.subcategory && nueva.t - b.t < 90000); });
      lista = limpiar([nueva].concat(lista));
      guardarLocal(lista);
      subirARemoto(lista);
      pintar();
    }, 1500);
  }

  function pintar() {
    var sec = document.getElementById('recent-searches');
    if (!sec) return;
    var lista = actual();
    var destacados = document.getElementById('destination-highlights');
    var home = !destacados || !destacados.hidden;
    if (!lista.length || !home) { sec.hidden = true; sec.innerHTML = ''; return; }
    var manana = new Date(); manana.setDate(manana.getDate() + 1);
    var minimo = manana.getFullYear() + '-' + String(manana.getMonth() + 1).padStart(2, '0') + '-' + String(manana.getDate()).padStart(2, '0');
    sec.innerHTML = '<div class="recent-searches__head"><h2 id="recent-searches-title">Tus búsquedas recientes</h2>'
      + '<button type="button" class="recent-searches__clear" data-recientes-borrar>Borrar</button></div>'
      + '<ul class="recent-searches__list">' + lista.map(function (b, i) {
        var fechas = b.dep >= minimo ? fechaCorta(b.dep) + ' – ' + fechaCorta(b.ret) : 'Elegí nuevas fechas';
        var meta = [b.pax + (b.pax === 1 ? ' viajero' : ' viajeros'), ESTILOS[b.style] || '', TRANSPORTES[b.transport] || ''].filter(Boolean);
        return '<li><button type="button" class="recent-search" data-reciente="' + i + '">'
          + '<span class="recent-search__dest">' + esc(b.destLabel || b.dest) + '</span>'
          + '<span class="recent-search__dates">' + esc(fechas) + '</span>'
          + '<span class="recent-search__meta">' + meta.map(esc).join(' · ') + '</span>'
          + '<span class="recent-search__go" aria-hidden="true">Repetir →</span></button></li>';
      }).join('') + '</ul>';
    sec.hidden = false;
    sec.__lista = lista;
  }

  function alCambiarSesion() {
    var u = usuario();
    var id = u ? u.id : null;
    if (id === ultimoUsuario) { pintar(); return; }
    ultimoUsuario = id;
    if (u) {
      // Al entrar: se unen las del navegador con las de la cuenta.
      var unidas = limpiar(listaRemota(u).concat(leerLocal()));
      guardarLocal(unidas);
      subirARemoto(unidas);
    }
    pintar();
  }

  document.addEventListener('click', function (e) {
    var sec = document.getElementById('recent-searches');
    if (!sec || !sec.contains(e.target)) return;
    if (e.target.closest('[data-recientes-borrar]')) {
      guardarLocal([]);
      ignorarRemotoHasta = Date.now() + 8000;
      var c = window.CS_APP && window.CS_APP.cliente && window.CS_APP.cliente();
      if (usuario() && c) c.auth.updateUser({ data: { busquedas_recientes: [] } }).then(function () {}, function () {});
      // user_metadata local puede tardar en refrescarse: se oculta ya.
      sec.hidden = true; sec.innerHTML = ''; sec.__lista = null;
      return;
    }
    var b = e.target.closest('[data-reciente]');
    if (!b || !sec.__lista) return;
    var item = sec.__lista[Number(b.getAttribute('data-reciente'))];
    if (item && window.CS_APP && window.CS_APP.aplicar) window.CS_APP.aplicar(item);
  });

  window.CS_RECIENTES = { registrar: registrar, alCambiarSesion: alCambiarSesion, pintar: pintar };

  function iniciar() {
    var destacados = document.getElementById('destination-highlights');
    // Las recientes conviven con los destacados: se van cuando ellos se van.
    if (destacados && typeof MutationObserver === 'function') new MutationObserver(pintar).observe(destacados, { attributes: true, attributeFilter: ['hidden'] });
    pintar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
