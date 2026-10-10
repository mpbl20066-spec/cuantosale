'use strict';
/* Gamificacion: "Pasaporte del explorador".

   Todo vive en localStorage (clave cs_gm_v1): no hay tabla ni cuenta de por medio, igual que las busquedas
   recientes de los invitados. No toca app.js: se entera de lo que hace la gente mirando el DOM (resultados que
   aparecen, la vista de detalle que se abre) y escuchando clics en los botones que ya existen.

   Que suma:
   - XP por visitar cada dia, buscar, abrir un destino, guardar, compartir y dividir gastos.
   - Nivel (Turista -> Leyenda) con barra de progreso.
   - Racha de dias seguidos.
   - Pasaporte: un sello por cada destino que se abre por primera vez.
   - Insignias.
   El chip del encabezado abre el pasaporte. */
(function () {
  var CLAVE = 'cs_gm_v1';

  var NIVELES = [
    { n: 'Turista', xp: 0, ico: '🧳' },
    { n: 'Mochilero', xp: 50, ico: '🎒' },
    { n: 'Viajero', xp: 150, ico: '🧭' },
    { n: 'Trotamundos', xp: 350, ico: '🌎' },
    { n: 'Leyenda', xp: 700, ico: '👑' }
  ];

  var XP = { visita: 5, busqueda: 3, destino: 15, guardar: 25, compartir: 15, dividir: 15 };
  var TOPE_BUSQUEDAS_DIA = 5;

  var INSIGNIAS = [
    { id: 'primera', ico: '🔍', n: 'Primera búsqueda', d: 'Hacé tu primera búsqueda.', ok: function (s) { return s.busquedas >= 1; } },
    { id: 'curioso', ico: '🤔', n: 'Curioso', d: 'Hacé 10 búsquedas.', ok: function (s) { return s.busquedas >= 10; } },
    { id: 'sello1', ico: '🛂', n: 'Primer sello', d: 'Abrí tu primer destino.', ok: function (s) { return nSellos(s) >= 1; } },
    { id: 'sello5', ico: '🎒', n: 'Mochilero', d: 'Reuní 5 sellos.', ok: function (s) { return nSellos(s) >= 5; } },
    { id: 'sello15', ico: '🌎', n: 'Trotamundos', d: 'Reuní 15 sellos.', ok: function (s) { return nSellos(s) >= 15; } },
    { id: 'planificador', ico: '💾', n: 'Planificador', d: 'Guardá un viaje.', ok: function (s) { return s.acc.guardar >= 1; } },
    { id: 'buenaonda', ico: '🤝', n: 'Buena onda', d: 'Compartí un viaje.', ok: function (s) { return s.acc.compartir >= 1; } },
    { id: 'cuentas', ico: '🧮', n: 'Cuentas claras', d: 'Dividí los gastos de un viaje.', ok: function (s) { return s.acc.dividir >= 1; } },
    { id: 'racha3', ico: '🔥', n: 'Constante', d: 'Entrá 3 días seguidos.', ok: function (s) { return s.mejorRacha >= 3; } },
    { id: 'racha7', ico: '⚡', n: 'Imparable', d: 'Entrá 7 días seguidos.', ok: function (s) { return s.mejorRacha >= 7; } }
  ];

  /* ---------- estado ---------- */
  function vacio() {
    return { xp: 0, sellos: {}, acc: { guardar: 0, compartir: 0, dividir: 0 }, busquedas: 0, insignias: {},
      racha: 0, mejorRacha: 0, ultimoDia: '', dia: '', busquedasHoy: 0, hechos: {}, nivel: 0, pend: [] };
  }
  function leer() {
    var s = vacio();
    try {
      var o = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (o && typeof o === 'object') {
        for (var k in s) if (o[k] !== undefined && o[k] !== null) s[k] = o[k];
        s.acc = { guardar: +(o.acc && o.acc.guardar) || 0, compartir: +(o.acc && o.acc.compartir) || 0, dividir: +(o.acc && o.acc.dividir) || 0 };
      }
    } catch (e) { /* modo privado o JSON roto: arranca de cero */ }
    return s;
  }
  var E = leer();
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(E)); } catch (e) { /* sin espacio */ } }
  function nSellos(s) { return Object.keys((s || E).sellos).length; }

  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function diasEntre(a, b) { // a, b = 'YYYY-MM-DD'
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }
  function nivelDe(xp) {
    var i = 0;
    for (var j = 0; j < NIVELES.length; j++) if (xp >= NIVELES[j].xp) i = j;
    return i;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- premios ---------- */
  var cola = [];
  var hayToast = false;
  function reducido() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* Los avisos sin mostrar se guardan: tocar un destino navega a otra pagina y el premio se mostraria a medias. */
  function aviso(titulo, detalle, ico, grande) {
    cola.push({ t: titulo, d: detalle, i: ico, g: grande });
    E.pend = cola.slice(); guardar();
    if (!hayToast) siguiente();
  }
  function siguiente() {
    var a = cola.shift();
    E.pend = cola.slice(); guardar();
    if (!a) { hayToast = false; return; }
    hayToast = true;
    var el = document.getElementById('gm-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gm-toast'; el.className = 'gm-toast';
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.classList.toggle('is-grande', !!a.g);
    el.innerHTML = '<span class="gm-toast__ico" aria-hidden="true">' + a.i + '</span><span class="gm-toast__txt"><b>' + esc(a.t) + '</b>' + (a.d ? '<small>' + esc(a.d) + '</small>' : '') + '</span>';
    el.classList.remove('is-visible');
    void el.offsetWidth;
    el.classList.add('is-visible');
    if (a.g) confeti();
    setTimeout(function () { el.classList.remove('is-visible'); setTimeout(siguiente, 350); }, a.g ? 3600 : 2200);
  }

  function confeti() {
    if (reducido()) return;
    var cont = document.createElement('div');
    cont.className = 'gm-confeti'; cont.setAttribute('aria-hidden', 'true');
    var colores = ['#F7C325', '#5AD19A', '#FF8A66', '#6EB8FF', '#FFFFFF'];
    for (var i = 0; i < 36; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colores[i % colores.length];
      p.style.animationDelay = (Math.random() * 0.35) + 's';
      p.style.animationDuration = (1.4 + Math.random() * 1.1) + 's';
      p.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      cont.appendChild(p);
    }
    document.body.appendChild(cont);
    setTimeout(function () { if (cont.parentNode) cont.parentNode.removeChild(cont); }, 3200);
  }

  function sumar(xp, motivo) {
    if (!xp) return;
    E.xp += xp;
    var nuevo = nivelDe(E.xp);
    var subio = nuevo > E.nivel;
    E.nivel = nuevo;
    revisarInsignias(true);
    guardar();
    if (subio) aviso('¡Subiste a ' + NIVELES[nuevo].n + '!', 'Nivel ' + (nuevo + 1) + ' · ' + E.xp + ' XP', NIVELES[nuevo].ico, true);
    else aviso('+' + xp + ' XP', motivo, '✨');
    pintar();
  }

  function revisarInsignias(conAviso) {
    INSIGNIAS.forEach(function (b) {
      if (E.insignias[b.id] || !b.ok(E)) return;
      E.insignias[b.id] = Date.now();
      if (conAviso) aviso('Insignia: ' + b.n, b.d, b.ico, true);
    });
  }

  /* Una accion de las "una vez por destino y dia": evita ganar XP apretando Guardar veinte veces. */
  function unaVez(clave) {
    var k = hoy() + '|' + clave;
    if (E.hechos[k]) return false;
    // Se podan los dias viejos para que el objeto no crezca para siempre.
    var h = hoy();
    for (var x in E.hechos) if (x.slice(0, 10) !== h) delete E.hechos[x];
    E.hechos[k] = 1;
    return true;
  }

  /* ---------- eventos del juego ---------- */
  function alEntrar() {
    var h = hoy();
    if (E.ultimoDia === h) return;
    if (E.ultimoDia && diasEntre(E.ultimoDia, h) === 1) E.racha += 1; else E.racha = 1;
    E.ultimoDia = h;
    E.dia = h; E.busquedasHoy = 0;
    if (E.racha > E.mejorRacha) E.mejorRacha = E.racha;
    guardar();
    var bonus = Math.min(E.racha, 7);
    sumar(XP.visita + bonus - 1, E.racha > 1 ? 'Racha de ' + E.racha + ' días 🔥' : 'Bienvenido de vuelta');
  }

  function alBuscar() {
    var h = hoy();
    if (E.dia !== h) { E.dia = h; E.busquedasHoy = 0; }
    E.busquedas += 1;
    if (E.busquedasHoy < TOPE_BUSQUEDAS_DIA) { E.busquedasHoy += 1; sumar(XP.busqueda, 'Por buscar un viaje'); }
    else { revisarInsignias(true); guardar(); pintar(); }
  }

  function estado() { return (window.CS_APP && window.CS_APP.estado) || {}; }
  function etiquetaDestino() {
    var t = document.querySelector('#dest .custom-select__trigger');
    var s = t && t.value ? String(t.value).trim() : '';
    return s || String(estado().dest || '');
  }
  function alAbrirDestino(id, nombre) {
    var S = estado();
    if (!id) { id = S.dest; nombre = etiquetaDestino(); }
    if (!id || id === 'todos') return;
    var clave = id + (!nombre && S.second ? '+' + S.second : '');
    if (E.sellos[clave]) return;
    E.sellos[clave] = { n: nombre || id, t: Date.now() };
    sumar(XP.destino, 'Nuevo sello: ' + E.sellos[clave].n);
  }
  function alAccion(tipo) {
    var S = estado();
    var clave = tipo + '|' + (S.dest || '') + '|' + (S.second || '');
    if (!unaVez(clave)) return;
    E.acc[tipo] += 1;
    var motivos = { guardar: 'Por guardar un viaje', compartir: 'Por compartir un viaje', dividir: 'Por dividir los gastos' };
    sumar(XP[tipo], motivos[tipo]);
  }

  /* ---------- deteccion ---------- */
  function vigilar() {
    // Resultados de busqueda: cuando aparece contenido nuevo y quedo quieto un momento, cuenta una busqueda.
    var ultimaClave = '';
    var espera = null;
    function claveBusqueda() {
      var S = estado();
      return [S.dest, S.second, S.dep, S.ret, S.pax, S.budget, S.style, S.transport, S.origin].join('|');
    }
    function revisar() {
      var hay = ['#results', '#destination-results'].some(function (q) { var n = document.querySelector(q); return n && n.children.length; });
      if (!hay) return;
      var k = claveBusqueda();
      if (k === ultimaClave) return;
      ultimaClave = k;
      alBuscar();
    }
    ['#results', '#destination-results'].forEach(function (q) {
      var n = document.querySelector(q);
      if (!n) return;
      new MutationObserver(function () { clearTimeout(espera); espera = setTimeout(revisar, 900); }).observe(n, { childList: true });
    });

    // Vista de detalle: al sacarle "oculto" se abrio la propuesta de un destino.
    var det = document.getElementById('vista-detalle');
    if (det) {
      var estabaOculto = det.classList.contains('oculto');
      new MutationObserver(function () {
        var oculto = det.classList.contains('oculto');
        if (estabaOculto && !oculto) setTimeout(alAbrirDestino, 400);
        estabaOculto = oculto;
      }).observe(det, { attributes: true, attributeFilter: ['class'] });
    }

    // Home nueva: el control de plata cuenta como busqueda y tocar un destino da su sello.
    var rango = document.getElementById('q-rango');
    if (rango) {
      var esperaR = null, ultimoR = null;
      rango.addEventListener('input', function () {
        clearTimeout(esperaR);
        esperaR = setTimeout(function () { if (ultimoR !== null && rango.value !== ultimoR) alBuscar(); ultimoR = rango.value; }, 1500);
      });
      ultimoR = rango.value;
    }

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var fila = t.closest('.q-fila[data-destino], .hx-dest[data-destino]');
      if (fila) {
        var nom = fila.querySelector('.q-nom, .hx-dest__n');
        var txt = nom ? (nom.firstChild && nom.firstChild.nodeType === 3 ? nom.firstChild.nodeValue : nom.textContent) : '';
        alAbrirDestino(fila.getAttribute('data-destino'), String(txt || '').trim());
        return;
      }
      if (t.closest('[data-save-trip]')) setTimeout(function () { alAccion('guardar'); }, 600);
      else if (t.closest('[data-share-link], [data-share-whatsapp]')) setTimeout(function () { alAccion('compartir'); }, 300);
      else if (t.closest('[data-split-trip]')) setTimeout(function () { alAccion('dividir'); }, 300);
    }, true);
  }

  /* ---------- interfaz ---------- */
  /* Hay un chip por cada lugar donde cabe: el encabezado (app anterior), el del celular y la barra de escritorio
     de la home nueva. El CSS de cada contenedor decide cual se ve. */
  var chips = [];
  function montarChip() {
    ['.account-actions', '.m-head__r', '.tabs'].forEach(function (q) {
      var zona = document.querySelector(q);
      if (!zona) return;
      var c = document.createElement('button');
      c.type = 'button'; c.className = 'gm-chip';
      c.setAttribute('aria-haspopup', 'dialog');
      c.addEventListener('click', abrir);
      var sep = q === '.tabs' ? zona.querySelector('.tabs__sep') : null;
      if (sep) zona.insertBefore(c, sep); else zona.insertBefore(c, zona.firstChild);
      chips.push(c);
    });
  }

  function progreso() {
    var i = nivelDe(E.xp), act = NIVELES[i], sig = NIVELES[i + 1];
    if (!sig) return { i: i, pct: 100, falta: 0, sig: null };
    return { i: i, pct: Math.round((E.xp - act.xp) / (sig.xp - act.xp) * 100), falta: sig.xp - E.xp, sig: sig };
  }

  function pintar() {
    if (!chips.length) return;
    var p = progreso();
    var html = '<span class="gm-chip__ico" aria-hidden="true">' + NIVELES[p.i].ico + '</span><span class="gm-chip__nv">Nv ' + (p.i + 1) + '</span>' +
      (E.racha > 1 ? '<span class="gm-chip__racha" aria-hidden="true">🔥' + E.racha + '</span>' : '') +
      '<span class="gm-chip__bar" aria-hidden="true"><i style="width:' + p.pct + '%"></i></span>';
    chips.forEach(function (chip) {
      chip.innerHTML = html;
      chip.setAttribute('aria-label', 'Tu pasaporte: nivel ' + (p.i + 1) + ', ' + NIVELES[p.i].n + ', ' + E.xp + ' XP');
      chip.title = NIVELES[p.i].n + ' · ' + E.xp + ' XP';
    });
    var m = document.getElementById('gm-modal');
    if (m && !m.hidden) cuerpoModal();
  }

  function cuerpoModal() {
    var m = document.getElementById('gm-modal');
    var p = progreso();
    var sellos = Object.keys(E.sellos).map(function (k) { return E.sellos[k]; }).sort(function (a, b) { return b.t - a.t; });
    var ganadas = INSIGNIAS.filter(function (b) { return E.insignias[b.id]; }).length;
    var h = '<div class="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-titulo">' +
      '<button type="button" class="gm-cerrar" data-gm-cerrar aria-label="Cerrar">×</button>' +
      '<div class="gm-head"><span class="gm-head__ico" aria-hidden="true">' + NIVELES[p.i].ico + '</span>' +
      '<div><p class="gm-kicker">Tu pasaporte</p><h2 id="gm-titulo">' + NIVELES[p.i].n + ' <small>Nv ' + (p.i + 1) + '</small></h2></div></div>' +
      '<div class="gm-xp"><div class="gm-xp__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.pct + '"><i style="width:' + p.pct + '%"></i></div>' +
      '<p>' + E.xp + ' XP' + (p.sig ? ' · te faltan <b>' + p.falta + '</b> para ' + p.sig.n + ' ' + p.sig.ico : ' · ¡nivel máximo!') + '</p></div>' +
      '<div class="gm-stats">' +
      '<div><b>' + (E.racha || 0) + '</b><span>🔥 racha (días)</span></div>' +
      '<div><b>' + sellos.length + '</b><span>🛂 sellos</span></div>' +
      '<div><b>' + ganadas + '/' + INSIGNIAS.length + '</b><span>🏅 insignias</span></div></div>' +
      '<h3>Sellos del pasaporte</h3>';
    if (sellos.length) {
      h += '<ul class="gm-sellos">' + sellos.map(function (s) { return '<li><span aria-hidden="true">🛂</span>' + esc(s.n) + '</li>'; }).join('') + '</ul>';
    } else {
      h += '<p class="gm-vacio">Todavía no tenés sellos. Abrí la propuesta de un destino para ganar el primero.</p>';
    }
    h += '<h3>Insignias</h3><ul class="gm-insignias">' + INSIGNIAS.map(function (b) {
      var ok = !!E.insignias[b.id];
      return '<li class="' + (ok ? 'is-ok' : 'is-bloq') + '"><span class="gm-insignia__ico" aria-hidden="true">' + (ok ? b.ico : '🔒') + '</span>' +
        '<span><b>' + esc(b.n) + '</b><small>' + esc(b.d) + '</small></span></li>';
    }).join('') + '</ul>' +
      '<h3>Cómo sumar XP</h3><ul class="gm-reglas">' +
      '<li><b>+' + XP.visita + '</b> entrar cada día (más con racha)</li>' +
      '<li><b>+' + XP.busqueda + '</b> buscar un viaje (hasta ' + TOPE_BUSQUEDAS_DIA + ' por día)</li>' +
      '<li><b>+' + XP.destino + '</b> abrir un destino nuevo</li>' +
      '<li><b>+' + XP.guardar + '</b> guardar un viaje</li>' +
      '<li><b>+' + XP.compartir + '</b> compartir un viaje</li>' +
      '<li><b>+' + XP.dividir + '</b> dividir los gastos</li></ul>' +
      '<p class="gm-nota">Tu progreso se guarda en este navegador.</p></div>';
    m.innerHTML = h;
  }

  var foco = null;
  function abrir() {
    var m = document.getElementById('gm-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'gm-modal'; m.className = 'gm-modal'; m.hidden = true;
      m.addEventListener('click', function (e) { if (e.target === m || (e.target.closest && e.target.closest('[data-gm-cerrar]'))) cerrar(); });
      document.body.appendChild(m);
    }
    foco = document.activeElement;
    cuerpoModal();
    m.hidden = false;
    document.documentElement.classList.add('gm-abierto');
    var c = m.querySelector('[data-gm-cerrar]'); if (c) c.focus();
  }
  function cerrar() {
    var m = document.getElementById('gm-modal');
    if (!m || m.hidden) return;
    m.hidden = true;
    document.documentElement.classList.remove('gm-abierto');
    if (foco && foco.focus) foco.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });

  function iniciar() {
    montarChip();
    E.nivel = nivelDe(E.xp);
    pintar();
    vigilar();
    // Un pequeno respiro para que no compita con la carga inicial de la pagina.
    setTimeout(alEntrar, 1200);
    if (E.pend && E.pend.length) {
      cola = E.pend.slice();
      setTimeout(function () { if (!hayToast) siguiente(); }, 700);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  window.CS_GAME = { estado: function () { return JSON.parse(JSON.stringify(E)); }, abrir: abrir };
})();
