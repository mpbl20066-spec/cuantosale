/* Cuenta y perfil de /test. Usa el mismo Supabase que la app de la raiz (/api/config): Google, link por correo, la
   tabla `trips` para los viajes guardados y user_metadata.full_name para el nombre.

   Panel de perfil: en celular sube desde abajo; en tablet y desktop cae como menu debajo de la barra superior.
   Se abre con cualquier elemento [data-perfil] (el tab "Perfil") o [data-guardados] (el tab "Guardados", que va
   directo a la lista de viajes).

   API para otras pantallas:
     CSCuenta.usuario()                 -> usuario actual o null
     CSCuenta.alCambiar(fn)             -> fn(usuario) al iniciar/cerrar sesion
     CSCuenta.abrir(vista)              -> abre el panel ('menu' | 'viajes' | 'login')
     CSCuenta.guardarViaje(datos)       -> Promise; rechaza con { codigo: 'sin_sesion' } si no hay sesion */
(function () {
  'use strict';
  var WHATSAPP = '5511920836306';   // el mismo numero de ayuda que usa la app
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  var money = function (n) { return 'US$ ' + Math.round(Number(n) || 0).toLocaleString('es-UY'); };
  var MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
  var fdc = function (d) { var q = String(d || '').split('-'); return q.length < 3 ? '' : (+q[2] + ' ' + MESES[+q[1] - 1]); };
  var ic = function (p, s) { return '<svg width="' + (s || 22) + '" height="' + (s || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var I = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    save: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.700M12 17h.01"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.800l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 0 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 0 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 0 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 0 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    split: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M17 5a3 3 0 0 1 0 6M19 14.500c1.500.8 2.500 2.500 2.500 5.500"/>',
    chev: '<path d="m9 5 7 7-7 7"/>', back: '<path d="m15 5-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>'
  };

  /* ---------- Supabase (el mismo proyecto que la app de la raiz) ---------- */
  var cliente = null, iniciando = null, usuario = null, oyentes = [], listo = false;
  function cargarSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; s.async = true;
      s.onload = ok; s.onerror = function () { no(new Error('No pudimos cargar el servicio de cuenta.')); };
      document.head.appendChild(s);
    });
  }
  function iniciar() {
    if (iniciando) return iniciando;
    iniciando = cargarSdk().then(function () { return fetch('/api/config'); }).then(function (r) { return r.json(); }).then(function (c) {
      if (!c.supabaseUrl || !c.supabaseAnonKey) throw new Error('La cuenta no está configurada en este entorno.');
      cliente = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage } });
      cliente.auth.onAuthStateChange(function (_e, sesion) { poner(sesion && sesion.user || null); });
      return cliente.auth.getSession();
    }).then(function (r) { listo = true; poner(r.data && r.data.session && r.data.session.user || null); })
      .catch(function (e) { iniciando = null; listo = true; throw e; });
    return iniciando;
  }
  function poner(u) {
    var cambio = (usuario && usuario.id) !== (u && u.id);
    usuario = u;
    if (cambio) oyentes.forEach(function (fn) { try { fn(usuario); } catch (e) { /* un oyente no rompe a los demas */ } });
    if (panelAbierto()) pintar();
  }
  var nombreDe = function (u) { var m = u && u.user_metadata || {}; return String(m.full_name || m.name || (u && u.email ? u.email.split('@')[0] : '') || '').trim(); };
  var primerNombre = function (u) { var n = nombreDe(u).split(/\s+/)[0] || ''; return n ? n.charAt(0).toUpperCase() + n.slice(1) : ''; };

  /* ---------- Tema ---------- */
  var temaActual = function () { return document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'light'; };
  function aplicarTema(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('cuantosale_tema', t); } catch (e) { /* modo privado: funciona igual, no se recuerda */ }
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'light' ? '#F7F8FA' : '#0A101A');
  }

  /* ---------- Acciones ---------- */
  function loginGoogle() {
    return iniciar().then(function () { return cliente.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname + location.search } }); })
      .then(function (r) { if (r && r.error) throw r.error; });
  }
  function loginCorreo(email) {
    return iniciar().then(function () { return cliente.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname + location.search } }); })
      .then(function (r) { if (r && r.error) throw r.error; });
  }
  function salir() { return iniciar().then(function () { return cliente.auth.signOut(); }); }
  function guardarNombre(n) { return iniciar().then(function () { return cliente.auth.updateUser({ data: { full_name: n } }); }).then(function (r) { if (r.error) throw r.error; poner(r.data.user); }); }
  /* Los viajes de /test van a la misma tabla `trips` que usa la app de la raiz. flight_details.fuente = 'test' los distingue. */
  function guardarViaje(d) {
    return iniciar().then(function () { return cliente.auth.getUser(); }).then(function (r) {
      var u = r.data && r.data.user;
      if (!u) { var e = new Error('Iniciá sesión para guardar tu viaje.'); e.codigo = 'sin_sesion'; throw e; }
      return cliente.from('trips').insert({
        user_id: u.id, origin: 'MVD', destination: d.destination, departure_date: d.departure_date, return_date: d.return_date,
        total_price: Number(d.total_amount) || 0,
        flight_details: { fuente: 'test', destination_key: d.destination_key, pax: d.pax, url: d.url }
      }).select().single();
    }).then(function (r) { if (r.error) throw new Error('No pudimos guardar el viaje: ' + r.error.message); return r.data; });
  }
  function listarViajes() {
    return iniciar().then(function () { return cliente.from('trips').select('*').eq('user_id', usuario.id).order('created_at', { ascending: false }); })
      .then(function (r) { if (r.error) throw new Error('No pudimos cargar tus viajes.'); return r.data || []; });
  }
  function borrarViaje(id) {
    return iniciar().then(function () { return cliente.from('trips').delete().eq('id', id).eq('user_id', usuario.id); })
      .then(function (r) { if (r.error) throw new Error('No pudimos eliminar el viaje.'); });
  }

  /* ---------- Panel ---------- */
  var S = { vista: 'menu', cargando: false, viajes: null, error: '', aviso: '', enviando: false, correo: '' };
  var raiz = null;
  var panelAbierto = function () { return !!raiz && !raiz.hidden; };
  function asegurarRaiz() {
    if (raiz) return;
    raiz = document.createElement('div');
    raiz.id = 'cs-perfil'; raiz.hidden = true;
    document.body.appendChild(raiz);
    raiz.addEventListener('click', alClic);
    raiz.addEventListener('submit', alEnviar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelAbierto()) cerrar(); });
  }
  function abrir(vista) {
    asegurarRaiz();
    S.vista = vista || 'menu'; S.error = ''; S.aviso = '';
    raiz.hidden = false; document.documentElement.classList.add('cs-perfil-abierto');
    pintar();
    iniciar().then(function () {
      if (S.vista === 'viajes') { if (usuario) cargarViajes(); else ir('login'); }
      else if (S.vista === 'editar' && !usuario) ir('login');
      else pintar();
    }, function (e) { if (S.vista === 'viajes' || S.vista === 'editar') S.vista = 'login'; S.error = e.message; pintar(); });
    var f = raiz.querySelector('[data-foco]') || raiz.querySelector('button'); if (f) f.focus();
  }
  function cerrar() { if (!raiz) return; raiz.hidden = true; document.documentElement.classList.remove('cs-perfil-abierto'); }
  function ir(v) { S.vista = v; S.error = ''; S.aviso = ''; pintar(); if (v === 'viajes') cargarViajes(); var f = raiz.querySelector('[data-foco]'); if (f) f.focus(); }
  function cargarViajes() {
    if (!usuario) { S.vista = 'login'; pintar(); return; }
    S.cargando = true; S.viajes = null; S.error = ''; pintar();
    listarViajes().then(function (l) { S.viajes = l; }, function (e) { S.error = e.message; }).then(function () { S.cargando = false; pintar(); });
  }
  var fila = function (icono, texto, attr, extra, rojo) {
    return '<button type="button" class="cp-fila' + (rojo ? ' is-rojo' : '') + '" ' + attr + '><span class="cp-fila__i">' + ic(icono, 22) + '</span><span class="cp-fila__t">' + texto + '</span>' + (extra === undefined ? ic(I.chev, 16) : extra) + '</button>';
  };
  var interruptor = function () {
    var on = temaActual() === 'night';
    return '<button type="button" class="cp-fila" data-tema role="switch" aria-checked="' + on + '"><span class="cp-fila__i">' + ic(I.moon, 22) + '</span><span class="cp-fila__t">Modo oscuro</span><span class="cp-sw' + (on ? ' is-on' : '') + '" aria-hidden="true"><i></i></span></button>';
  };
  var cabecera = function (titulo) {
    return '<div class="cp-top"><button type="button" class="cp-ico" data-' + (S.vista === 'menu' ? 'cerrar' : 'menu') + ' aria-label="' + (S.vista === 'menu' ? 'Cerrar' : 'Volver') + '">' + ic(S.vista === 'menu' ? I.x : I.back, 20) + '</button><h2 class="cp-h">' + esc(titulo) + '</h2><span style="width:36px"></span></div>';
  };
  function pie() {
    return '<div class="cp-pie"><b>CuántoSale<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path transform="rotate(45 12 12)" d="M21 16v-2l-8-5V3.500c0-.8-.7-1.500-1.500-1.500S10 2.700 10 3.500V9l-8 5v2l8-2.500V19l-2 1.500V22l3.500-1 3.500 1v-1.500L13 19v-5.500z"/></svg></b><small>Tu viaje, sin sorpresas</small></div>';
  }
  function menu() {
    var u = usuario, nombre = primerNombre(u);
    var encabezado = u
      ? '<button type="button" class="cp-head" data-editar data-foco><span class="cp-av">' + esc((nombre || '?').charAt(0).toUpperCase()) + '</span><span class="cp-head__t"><b>Hola, ' + esc(nombre || 'viajero') + '</b><small>Ver y editar tu perfil</small></span>' + ic(I.chev, 16) + '</button>'
      : '<button type="button" class="cp-head" data-login data-foco><span class="cp-av cp-av--v">' + ic(I.user, 24) + '</span><span class="cp-head__t"><b>Ingresá a CuántoSale</b><small>Guardá tus viajes y verlos en cualquier lado</small></span>' + ic(I.chev, 16) + '</button>';
    return cabecera('Mi cuenta') + encabezado + '<div class="cp-lista">' +
      fila(I.save, 'Mis viajes guardados', 'data-viajes') +
      fila(I.split, 'Dividir gastos', 'data-dividir') +
      interruptor() +
      fila(I.help, 'Ayuda y soporte', 'data-ayuda') +
      (u ? fila(I.cog, 'Configuración', 'data-editar') : '') +
      fila(I.doc, 'Términos y condiciones', 'data-terminos') +
      (u ? fila(I.out, 'Cerrar sesión', 'data-salir', '', true) : '') + '</div>' + pie();
  }
  function vistaLogin() {
    return cabecera('Ingresar') + '<div class="cp-cuerpo"><p class="cp-p">Creá una cuenta o entrá para guardar tus viajes y verlos cuando quieras. No hace falta contraseña.</p>' +
      '<button type="button" class="cp-btn cp-btn--g" data-google data-foco><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.400-.2-2H12v3.900h5.600a4.800 4.800 0 0 1-2.100 3.100v2.600h3.400c2-1.800 3.100-4.500 3.100-7.600z"/><path fill="#34A853" d="M12 22c2.800 0 5.200-.9 6.900-2.500l-3.400-2.600c-.9.600-2.100 1-3.500 1-2.700 0-5-1.800-5.800-4.300H2.700v2.700A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.200 13.600a6 6 0 0 1 0-3.800V7.100H2.700a10 10 0 0 0 0 9.200z"/><path fill="#EA4335" d="M12 6c1.500 0 2.900.5 4 1.600l3-3A10 10 0 0 0 2.700 7.100l3.500 2.700C7 7.800 9.300 6 12 6z"/></svg>Continuar con Google</button>' +
      '<div class="cp-o"><span>o con tu correo</span></div>' +
      '<form id="cp-correo" novalidate><label class="cp-l" for="cp-mail">Tu correo</label><input id="cp-mail" class="cp-in" type="email" inputmode="email" autocomplete="email" placeholder="nombre@correo.com" value="' + esc(S.correo) + '">' +
      (S.error ? '<p class="cp-err" role="alert">' + esc(S.error) + '</p>' : '') + (S.aviso ? '<p class="cp-ok" role="status">' + esc(S.aviso) + '</p>' : '') +
      '<button type="submit" class="cp-btn"' + (S.enviando ? ' disabled' : '') + '>' + ic(I.mail, 18) + (S.enviando ? 'Enviando…' : 'Enviarme un link para entrar') + '</button></form></div>';
  }
  function vistaViajes() {
    var cuerpo;
    if (S.cargando) cuerpo = '<p class="cp-p" role="status">Cargando tus viajes…</p>';
    else if (S.error) cuerpo = '<p class="cp-err" role="alert">' + esc(S.error) + '</p>';
    else if (!S.viajes || !S.viajes.length) cuerpo = '<p class="cp-p">Todavía no guardaste viajes. Armá uno y tocá <b>Guardar mi viaje</b>.</p><a class="cp-btn" href="/test/">Armar un viaje</a>';
    else cuerpo = S.viajes.map(function (t) {
      var fd = t.flight_details || {}, fechas = fdc(t.departure_date) + (t.return_date ? ' → ' + fdc(t.return_date) : '');
      var url = fd.fuente === 'test' && fd.url ? fd.url : '';
      return '<article class="cp-viaje"><div class="cp-viaje__t"><b>' + esc(t.destination || 'Viaje guardado') + '</b><small>' + esc(fechas) + (fd.pax ? ' · ' + esc(fd.pax) + (Number(fd.pax) === 1 ? ' persona' : ' personas') : '') + '</small></div>' +
        '<div class="cp-viaje__p"><small>Total estimado</small><b>' + esc(money(t.total_amount || t.total_price)) + '</b></div>' +
        '<div class="cp-viaje__a">' + (url ? '<a class="cp-btn cp-btn--s" href="' + esc(url) + '">Abrir</a>' : '<span class="cp-nota">Guardado en la app anterior</span>') +
        '<button type="button" class="cp-btn cp-btn--s cp-btn--o" data-borrar="' + esc(t.id) + '" aria-label="Eliminar el viaje a ' + esc(t.destination || '') + '">' + ic(I.trash, 16) + '</button></div></article>';
    }).join('');
    return cabecera('Mis viajes guardados') + '<div class="cp-cuerpo" data-foco tabindex="-1">' + cuerpo + '</div>';
  }
  function vistaEditar() {
    var u = usuario;
    return cabecera('Mi perfil') + '<div class="cp-cuerpo"><form id="cp-perfil" novalidate><label class="cp-l" for="cp-nom">Nombre</label><input id="cp-nom" class="cp-in" type="text" autocomplete="name" maxlength="60" value="' + esc(nombreDe(u)) + '" data-foco>' +
      '<label class="cp-l" for="cp-em">Correo</label><input id="cp-em" class="cp-in" type="email" value="' + esc(u && u.email || '') + '" readonly aria-readonly="true">' +
      (S.error ? '<p class="cp-err" role="alert">' + esc(S.error) + '</p>' : '') + (S.aviso ? '<p class="cp-ok" role="status">' + esc(S.aviso) + '</p>' : '') +
      '<button type="submit" class="cp-btn"' + (S.enviando ? ' disabled' : '') + '>' + (S.enviando ? 'Guardando…' : 'Guardar cambios') + '</button></form></div>';
  }
  function pintar() {
    if (!raiz) return;
    var v = S.vista;
    if ((v === 'viajes' || v === 'editar') && !usuario && !listo) { raiz.innerHTML = '<div class="cp-fondo" data-cerrar></div><div class="cp-hoja" role="dialog" aria-modal="true" aria-label="Mi cuenta">' + cabecera('Mi cuenta') + '<div class="cp-cuerpo"><p class="cp-p" role="status">Cargando…</p></div></div>'; return; }
    if ((v === 'viajes' || v === 'editar') && !usuario) v = S.vista = 'login';
    raiz.innerHTML = '<div class="cp-fondo" data-cerrar></div><div class="cp-hoja" role="dialog" aria-modal="true" aria-label="Mi cuenta">' + (v === 'login' ? vistaLogin() : v === 'viajes' ? vistaViajes() : v === 'editar' ? vistaEditar() : menu()) + '</div>';
  }
  function alClic(e) {
    if (e.target.closest('.cp-fondo')) { cerrar(); return; }   /* tocar fuera del panel lo cierra (el fondo no es un boton) */
    var t = e.target.closest('button,a'); if (!t) return;
    if (t.hasAttribute('data-cerrar')) { cerrar(); return; }
    if (t.hasAttribute('data-menu')) { ir('menu'); return; }
    if (t.hasAttribute('data-viajes')) { if (usuario) ir('viajes'); else iniciar().then(function () { ir(usuario ? 'viajes' : 'login'); }, function () { ir('login'); }); return; }
    if (t.hasAttribute('data-dividir')) { location.href = '/grupo?volver=' + encodeURIComponent(location.pathname.indexOf('/test') === 0 ? '/test/' : (location.pathname.indexOf('/nuevo') === 0 ? '/nuevo/' : '/app')); return; }
    if (t.hasAttribute('data-login')) { ir('login'); return; }
    if (t.hasAttribute('data-editar')) { ir('editar'); return; }
    if (t.hasAttribute('data-tema')) { aplicarTema(temaActual() === 'night' ? 'light' : 'night'); pintar(); var f = raiz.querySelector('[data-tema]'); if (f) f.focus(); return; }
    if (t.hasAttribute('data-ayuda')) { window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hola! Necesito ayuda con CuántoSale.'), '_blank', 'noopener'); return; }
    if (t.hasAttribute('data-terminos')) { window.open('/terminos', '_blank', 'noopener'); return; }
    if (t.hasAttribute('data-google')) { S.error = ''; loginGoogle().catch(function () { S.error = 'No pudimos conectar con Google. Probá de nuevo en un momento.'; pintar(); }); return; }
    if (t.hasAttribute('data-salir')) { salir().then(function () { S.viajes = null; ir('menu'); }, function () { S.error = 'No pudimos cerrar la sesión.'; pintar(); }); return; }
    if (t.hasAttribute('data-borrar')) {
      var id = t.getAttribute('data-borrar');
      if (!window.confirm('¿Eliminar este viaje guardado?')) return;
      borrarViaje(id).then(function () { S.viajes = (S.viajes || []).filter(function (x) { return String(x.id) !== String(id); }); S.error = ''; pintar(); }, function (er) { S.error = er.message; pintar(); });
    }
  }
  function alEnviar(e) {
    if (e.target.id === 'cp-correo') {
      e.preventDefault();
      var mail = String(raiz.querySelector('#cp-mail').value || '').trim(); S.correo = mail;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { S.error = 'Escribí un correo válido, por ejemplo nombre@correo.com.'; S.aviso = ''; pintar(); return; }
      S.enviando = true; S.error = ''; pintar();
      loginCorreo(mail).then(function () { S.aviso = 'Listo: te enviamos un link a ' + mail + '. Abrilo desde este mismo dispositivo para entrar.'; },
        function () { S.error = 'No pudimos enviar el link. Revisá el correo y probá de nuevo.'; }).then(function () { S.enviando = false; pintar(); });
    } else if (e.target.id === 'cp-perfil') {
      e.preventDefault();
      var n = String(raiz.querySelector('#cp-nom').value || '').trim().slice(0, 60);
      if (!n) { S.error = 'Escribí tu nombre.'; S.aviso = ''; pintar(); return; }
      S.enviando = true; S.error = ''; pintar();
      guardarNombre(n).then(function () { S.aviso = 'Cambios guardados.'; }, function () { S.error = 'No pudimos guardar los cambios.'; }).then(function () { S.enviando = false; pintar(); });
    }
  }

  /* Los disparadores del panel: cualquier [data-perfil] o [data-guardados]. El tab de la home los trae como data-tab. */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-perfil],[data-guardados],[data-tab="perfil"],[data-tab="guardados"]');
    if (!t) return;
    e.preventDefault();
    abrir(t.matches('[data-guardados],[data-tab="guardados"]') ? 'viajes' : 'menu');
  });
  /* Si la persona vuelve del login (Google o link del correo), la sesion se levanta sola; basta con iniciar en segundo plano. */
  if (/[?&#](code|access_token|error_description)=/.test(location.search + location.hash) || (function () { try { return Object.keys(localStorage).some(function (k) { return /^sb-.*-auth-token$/.test(k); }); } catch (e) { return false; } })()) iniciar().catch(function () { /* sin cuenta: la pagina funciona igual */ });

  window.CSCuenta = { usuario: function () { return usuario; }, alCambiar: function (fn) { oyentes.push(fn); iniciar().catch(function () {}); }, abrir: abrir, cerrar: cerrar, guardarViaje: guardarViaje, iniciar: iniciar, loginGoogle: loginGoogle, loginCorreo: loginCorreo };
})();
