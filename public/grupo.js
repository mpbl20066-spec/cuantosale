(function () {
  'use strict';
  var app = document.getElementById('grupo-app');
  var supabaseClient = null;
  var group = null;
  var participants = [];
  var expenses = [];
  var me = null; // fila de "participantes" que corresponde a este dispositivo
  // Gasto cuya división se está editando, con las personas ya marcadas.
  // Vive acá y no en el DOM a propósito: la página se repinta sola cada 12s
  // (poll) y cada vez que alguien carga un gasto, así que guardar la
  // selección en los inputs la perdería en mitad de la elección.
  var editandoSplit = null;
  var currentGroupId = null;
  var pollTimer = null;
  var lastSignature = '';
  // La migración del formato viejo de saldos se intenta una vez por carga de
  // página, no en cada poll.
  var migracionIntentada = false;
  // Tasas de /api/tasas, iguais a las que usa la home. Si no llegan, el grupo
  // entero se muestra en su moneda y no se ofrece cambiar.
  var FX = { rates: null, base: 'USD', monedas: null };
  // Moneda en la que se ve toda la página. Vacío = la del grupo; para compararla
  // con un código está verEnActual(), no el vacío.
  var verEn = '';
  var nameDraft = null; // nombre del viaje precargado desde la app
  var nameFromAuth = ''; // nombre del usuario logueado, para no pedirlo de nuevo
  var authUser = null; // cuenta de Google logueada (opcional: el grupo funciona sin ella)
  var cuentasOk = null; // la base tiene participantes.user_id (supabase_grupo_cuentas.sql)
  var agregadoPorOk = null; // la base tiene gastos.agregado_por
  var vinculados = {}; // participantes ya vinculados a la cuenta en esta carga de pagina
  var otrosGruposVinculados = false;
  var PRESET_KEY = 'cuantosale_grupo_preset';
  var POLL_MS = 12000;
  // Íconos de categoría. La categoría NO se elige: se deduce de la descripción
  // al guardar (ver guessCategory), así que agregar un gasto sigue siendo un
  // paso. El ícono sólo sirve para que la lista se lea de un vistazo.
  var ICONS = {
    share: 'M12 3v12M12 3L8 7M12 3l4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
    link: 'M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1',
    trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
    check: 'M4.5 12.5l5 5 10-11',
    arrow: 'M4 12h16M14 6l6 6-6 6',
    // Tenedor y cuchillo como dos formas separadas y anchas: un plato con
    // cubiertos dibujados en detalle desaparece a este tamaño.
    food: 'M7 3v5a2 2 0 0 0 4 0V3M9 10v11M17 3v18M17 3c2 1.5 2 6 0 7.5',
    cart: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6M9 20h.01M17 20h.01',
    car: 'M4 16v2.5h3V16M17 16v2.5h3V16M5 16V9.5L6.8 5h10.4L19 9.5V16M4 16h16M8 12.5h.01M16 12.5h.01',
    // Cama: cabecero, colchón y dos almohadas bien separadas.
    bed: 'M3 19V6M3 14h18v5M21 19v-3M7 11h3.5M13.5 11H17',
    ticket: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8zM14 6v12',
    bag: 'M5 8h14l1 12H4L5 8zM9 8V6a3 3 0 0 1 6 0v2',
    coffee: 'M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM16 9.5h1.8a2.7 2.7 0 0 1 0 5.4H16M4 21.5h13',
    plane: 'M10.5 3.2a1.6 1.6 0 0 1 3 0V9l7.5 4.4v2.3L13.5 13v4.3l2.8 2v1.7L12 20l-4.3 1v-1.7l2.8-2V13L3 15.7v-2.3L10.5 9V3.2z',
    wash: 'M4.5 4.5h15v15h-15zM4.5 9.5h15M8 6.8h.01M10.5 6.8h.01M13 6.8h.01M12 13.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z'
  };
  // Las categorías de la grilla. El ícono se deduce del texto (guessCategory),
  // así que la grilla no guarda nada por su cuenta: escribe la descripción y el
  // resto sale de ahí. Por eso cada label tiene que contener una palabra que la
  // deducción reconozca, si no el ícono del gasto sale como "General".
  // El color sale de la paleta categórica del sitio (--c1 a --c6) para no
  // inventar una escala de color nueva.
  var CATEGORIAS = [
    { key: 'alojamiento', label: 'Alojamiento', icon: 'bed', color: 'var(--c2)' },
    { key: 'actividades', label: 'Actividades', icon: 'ticket', color: 'var(--c4)' },
    { key: 'restaurantes', label: 'Restaurantes', icon: 'food', color: 'var(--c3)' },
    { key: 'transportes', label: 'Transportes', icon: 'car', color: 'var(--c5)' },
    { key: 'cafe', label: 'Café', icon: 'coffee', color: 'var(--c6)' },
    { key: 'vuelos', label: 'Vuelos', icon: 'plane', color: 'var(--c1)' },
    { key: 'supermercado', label: 'Supermercado', icon: 'cart', color: 'var(--c2)' },
    { key: 'lavanderia', label: 'Lavandería', icon: 'wash', color: 'var(--c4)' },
    { key: 'general', label: 'General', icon: 'bag', color: 'var(--c6)' }
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) {
    // stroke-width 2 y viewBox de 24: a 18px reales los trazos más finos se
    // vuelven ilegibles (la cama y los cubiertos parecían un rayón).
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (ICONS[name] || ICONS.bag) + '"/></svg>';
  }
  // Deduce el ícono del texto del gasto. El orden importa: se prueba primero lo
  // más específico, así "Café" no cae en restaurantes y "vuelo a São Paulo" no
  // cae en alojamiento.
  // Los tokens cortos van con \b porque si no matchean dentro de otras palabras:
  // "bar" encontraba "barrio" y "mercado del barrio" salía como comida, y
  // "bus" encontraba "búsqueda". Los labels de la grilla tienen que matchear
  // alguno de estos patrones para que el ícono del gasto salga bien.
  function guessCategory(description) {
    var text = String(description || '').toLowerCase();
    if (/lavander|lavado|lavatrice|secadora/.test(text)) return 'wash';
    if (/caf[eé]|coffee|capuchino|espresso|latte/.test(text)) return 'coffee';
    if (/vuelo|avi[oó]n|avi[aã]o|a[eé]reo|flight/.test(text)) return 'plane';
    if (/super|market|mercado|almacen|verdul|panader|carnic|despensa/.test(text)) return 'cart';
    if (/hotel|aloj|depto|departamento|cabana|hostal|reserva|playa/.test(text)) return 'bed';
    if (/museo|tour|excursion|entrada|paseo|surf|show|cine|actividad/.test(text)) return 'ticket';
    if (/\btaxi(s)?\b|\buber\b|\bremis\b|\bauto(s)?\b|\bnafta\b|\bgasolin|\bcombus|\bbus(es)?\b|\btren\b|\bcolectivo\b|\bmetro\b|\bestacionamiento\b|\bparking\b|\bpeaje\b|\btransporte/.test(text)) return 'car';
    if (/comida|almuerzo|cena|desayun|pizza|empanad|sandwich|\bbar\b|restaur|cerveza|vino|helado|asado|parrillada|\bpub\b/.test(text)) return 'food';
    return 'bag';
  }
  // El símbolo viene del servidor (/api/tasas) para que el grupo y la home
  // muestren lo mismo. La lista de acá es solo el respaldo cuando las tasas
  // todavía no llegaron.
  function categorySymbol(code) {
    var normalized = String(code || 'USD').toUpperCase();
    // Se lee después de cargarTasas(): si el fetch falló, la lista de respaldo
    // de abajo cubre el caso.
    if (FX.monedas && FX.monedas.length) {
      var found = FX.monedas.filter(function (m) { return m.code === normalized; })[0];
      if (found && found.simbolo) return found.simbolo;
    }
    // Respaldo para cuando las tasas no llegaron. Tiene los mismos simbolos
    // que server.js para que el group no cambie de cara a mitad de carga.
    var symbols = { USD: 'US$', BRL: 'R$', UYU: 'UYU$', ARS: 'ARS$', EUR: '€', GBP: '£', MXN: 'MXN$', CLP: 'CLP$', COP: 'COP$' };
    return symbols[normalized] || normalized + ' ';
  }
  // Centimas solo cuando las hay: en un viaje entre amigos casi todos los
  // gastos son redondos y "US$ 1.200" se lee mejor que "US$ 1.200,00".
  function formatAmount(n) {
    var value = Math.round((Number(n) || 0) * 100) / 100;
    var text = Math.abs(value % 1) > 0.004 ? value.toFixed(2) : String(Math.round(value));
    var parts = text.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  }
  function money(n, code) { return categorySymbol(code || (group && group.currency) || 'USD') + ' ' + formatAmount(n); }
  function groupCurrency() { return (group && group.currency) || 'USD'; }

  /* ---------- monedas ---------- */
  function tasaDe(code) {
    if (!code) return null;
    var normalized = String(code).toUpperCase();
    // La base a si misma es 1 aunque no haya llegado ninguna tasa: si las
    // "/api/tasas" felló, un grupo en USD con gastos en USD tiene que poder
    // igual mostrar sus montos, y no hay nada que convertir.
    if (normalized === FX.base) return 1;
    if (!FX.rates) return null;
    var rate = Number(FX.rates[normalized]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }
  // Pasa un importe de una moneda a otra. Devuelve null si falta alguna de las
  // dos tasas: prefierimos no convertir antes que inventar un número.
  function convertir(amount, from, to) {
    var origen = String(from || '').toUpperCase();
    var destino = String(to || '').toUpperCase();
    if (!origen || !destino) return null;
    // De una moneda a la misma no hay nada que convertir, y no hace falta
    // ninguna tasa. Sin esto, un grupo en pesos se queda sin numeros si
    // /api/tasas cae, que es justo cuando mas los necesita.
    if (origen === destino) return Number(amount) || 0;
    var a = tasaDe(origen), b = tasaDe(destino);
    if (a == null || b == null) return null;
    return (Number(amount) || 0) * (b / a);
  }
  // La moneda en la que se está mostrando. Si no hay tasas, o la elegida no
  // tiene, se cae en la del grupo en vez de dejar un número sin unidad.
  function verMoneda() {
    if (verEn && tasaDe(verEn) != null) return verEn;
    return groupCurrency();
  }
  /* La moneda elegida con el vacío ya resuelto a un código.
     verEn se queda vacío hasta que alguien elige otra, y ese vacío siempre
     quiso decir "la del grupo". Era el único lugar donde se traducía, así que
     también es el único que lo tiene que seguir haciendo ahora que el selector
     muestra la moneda del grupo como una opción más: si alguien compara
     verEn con un código de la lista sin pasar por acá, "vacío" y "USD" dejan de
     ser la misma cosa y el <select> vuelve a marcar una moneda que no es la que
     se está usando. */
  function verEnActual() {
    return verEn || groupCurrency();
  }
  // Un importe cualquiera, ya expresado en la moneda en la que se ve. Las
  // tasas se piden para que "Ver en" funcione; sin ellas cae al importe tal
  // cual viene, que es lo correcto porque todos estan en la misma moneda.
  // Si lo que NO se puede convertir es el importe (viene en otra moneda y no
  // hay tasa), se devuelve con SU propio símbolo y no con el de la moneda que
  // se está mirando: antes se pintaba el número crudo con el símbolo de la
  // destino, y 100 dólares se leían como 100 pesos, un error de 40 veces sin
  // ningún aviso.
  function moneyVer(n, code) {
    var origen = String(code || groupCurrency()).toUpperCase();
    var target = String(verMoneda()).toUpperCase();
    if (origen === target) return money(n, target);
    var value = convertir(n, origen, target);
    return value == null ? money(n, origen) : money(value, target);
  }
  // Los balances y las transferencias se calculan siempre en la moneda del
  // grupo: es la única forma de que sumar gastos cargados en distintas monedas
  // signifique algo. Si un gasto no se puede traer a la moneda del grupo se
  // devuelve null y la fila se deja fuera de la cuenta en vez de sumar un numero
  // en otra moneda como si fuera de esta.
  function aMonedaGrupo(n, code) {
    // Sin moneda se asume la del grupo: es lo que dice el default de la columna
    // y lo unico que se puede suponer sin inventar. Si la columna llegara vacia
    // por una fila vieja, tratarla como "no convertible" dejaria el gasto fuera
    // de todas las cuentas sin que nadie entienda por que.
    var value = convertir(n, code || groupCurrency(), groupCurrency());
    return value == null ? null : value;
  }
  async function cargarTasas() {
    try {
      var r = await fetch('/api/tasas', { headers: { Accept: 'application/json' } });
      var j = await r.json();
      if (j && j.rates && Object.keys(j.rates).length) {
        FX.rates = j.rates;
        FX.base = j.base || 'USD';
      }
      if (j && j.monedas && j.monedas.length) FX.monedas = j.monedas;
    } catch (e) {
      // Sin tasas el grupo sigue funcionando: todo queda en su moneda.
    }
  }
  // Solo las monedas con tasa disponible. El servidor ya publica una lista
  // corta a propósito (no las 160 divisas de la API), así que acá no hay
  //Nothing que filtrar: se usa lo que él manda.
  function monedasVerificables() {
    if (!FX.monedas || !FX.monedas.length) return [];
    return FX.monedas.filter(function (m) { return tasaDe(m.code) != null; });
  }
  function verEnGuardado() {
    try { return localStorage.getItem('cuantosale_grupo_ver_en') || ''; } catch (e) { return ''; }
  }
  function guardarVerEn(code) {
    verEn = code || '';
    try {
      if (verEn) localStorage.setItem('cuantosale_grupo_ver_en', verEn);
      else localStorage.removeItem('cuantosale_grupo_ver_en');
    } catch (e) {}
  }
  function groupIdFromPath() {
    var match = window.location.pathname.match(/^\/grupo\/([0-9a-f-]{36})\/?$/i);
    return match ? match[1] : null;
  }
  function deviceId() {
    try {
      var id = localStorage.getItem('cuantosale_device_id');
      if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); localStorage.setItem('cuantosale_device_id', id); }
      return id;
    } catch (error) { return 'anon-' + Date.now(); }
  }
  // "Quién soy" en este grupo se recuerda localmente por browser, sin tocar
  // la fila de nadie más en Supabase: así elegir tu nombre de una lista no
  // corre el riesgo de que dos personas terminen "siendo" la misma fila.
  function rememberedParticipantId(groupId) {
    try { return localStorage.getItem('cuantosale_grupo_me_' + groupId); } catch (error) { return null; }
  }
  function rememberParticipant(groupId, participantId) {
    try { localStorage.setItem('cuantosale_grupo_me_' + groupId, participantId); } catch (error) {}
  }
  function randomId() {
    return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  }

  /* ---------- cuenta opcional con Google ----------
     Nada de esto es obligatorio: sin cuenta el grupo funciona igual que siempre.
     Con cuenta, la persona del grupo queda vinculada a la cuenta
     (participantes.user_id) y TODO lo que cargó como esa persona pasa a ser de
     la cuenta, incluso lo que cargó antes de entrar. Eso se hace vinculando a la
     persona y no gasto por gasto: un gasto pertenece a un participante. */
  var GOOGLE_OMITIDO_KEY = 'cuantosale_grupo_google_omitido';
  var ME_PREFIX = 'cuantosale_grupo_me_';
  function googleOmitido() {
    try { return localStorage.getItem(GOOGLE_OMITIDO_KEY) === '1'; } catch (error) { return false; }
  }
  function omitirGoogle() {
    try { localStorage.setItem(GOOGLE_OMITIDO_KEY, '1'); } catch (error) {}
  }
  // Las columnas nuevas llegan con supabase_grupo_cuentas.sql. Si todavia no se
  // corrio, la pagina sigue como antes: no se ofrece la cuenta ni se escriben
  // columnas que no existen (un insert con una columna desconocida falla entero).
  async function soportaCuentas() {
    if (cuentasOk === null) {
      try { cuentasOk = !(await supabaseClient.from('participantes').select('user_id').limit(1)).error; } catch (error) { cuentasOk = false; }
    }
    return cuentasOk;
  }
  async function soportaAgregadoPor() {
    if (agregadoPorOk === null) {
      try { agregadoPorOk = !(await supabaseClient.from('gastos').select('agregado_por').limit(1)).error; } catch (error) { agregadoPorOk = false; }
    }
    return agregadoPorOk;
  }
  async function loadAuthUser() {
    try {
      var result = await supabaseClient.auth.getUser();
      authUser = (result && result.data && result.data.user) || null;
    } catch (error) { authUser = null; }
  }
  function authLabel() {
    if (!authUser) return '';
    var metadata = authUser.user_metadata || {};
    return String(metadata.full_name || metadata.name || authUser.email || '').trim();
  }
  async function entrarConGoogle(button) {
    if (button) button.disabled = true;
    // Vuelve a esta misma pagina: el grupo se abre solo y la persona ya esta.
    var result = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
    if (result.error) {
      if (button) button.disabled = false;
      window.alert(result.error.message || 'No pudimos iniciar sesión con Google.');
    }
  }
  /* Vincula a `me` con la cuenta logueada. Cuatro casos:
       - la cuenta ya es una persona de este grupo: es esa, en cualquier
         dispositivo (se elige sola, sin volver a decir quién sos);
       - `me` no tiene cuenta: se le vincula (lo que cargó antes queda a su nombre);
       - `me` es de otra cuenta (otra persona usando este navegador): no es esta
         persona, se suelta;
       - sin sesion o sin las columnas nuevas: no pasa nada.
     Después se intenta lo mismo con los otros grupos que este navegador recuerda. */
  async function vincularCuenta(groupId) {
    if (!authUser || !(await soportaCuentas())) return;
    var propia = participants.filter(function (p) { return p.user_id === authUser.id; })[0];
    if (propia) {
      me = propia;
      rememberParticipant(groupId, propia.id);
    } else if (me && !me.user_id && !vinculados[me.id]) {
      vinculados[me.id] = true;
      try {
        var result = await supabaseClient.rpc('grupo_reclamar_participante', { p_participante: me.id });
        if (!result.error && result.data === true) me.user_id = authUser.id;
      } catch (error) { /* queda sin vincular, se reintenta en la proxima carga */ }
    } else if (me && me.user_id && me.user_id !== authUser.id) {
      try { localStorage.removeItem(ME_PREFIX + groupId); } catch (error) {}
      me = null;
    }
    if (otrosGruposVinculados) return;
    otrosGruposVinculados = true;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(ME_PREFIX) !== 0 || key === ME_PREFIX + groupId) continue;
        supabaseClient.rpc('grupo_reclamar_participante', { p_participante: localStorage.getItem(key) }).then(function () {}, function () {});
      }
    } catch (error) {}
  }
  // Bloque que invita a entrar con Google. Va solo si se puede vincular (las
  // columnas existen), no hay sesión y la persona no dijo que no.
  function googleOfferMarkup(texto) {
    if (authUser) {
      return '<p class="grupo-account">Entraste con Google como <b>' + esc(authLabel()) + '</b>. Tus gastos quedan a tu nombre y los ves desde cualquier dispositivo.</p>';
    }
    if (cuentasOk !== true || googleOmitido()) return '';
    return '<div class="grupo-google"><p>' + texto + '</p>' +
      '<div class="grupo-google__actions"><button type="button" class="grupo-btn" data-google-login>Continuar con Google</button>' +
      '<button type="button" class="grupo-minibtn" data-google-skip>Seguir sin cuenta</button></div></div>';
  }
  function bindGoogleOffer(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-google-login]'), function (button) {
      button.addEventListener('click', function () { entrarConGoogle(button); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-google-skip]'), function (button) {
      button.addEventListener('click', function () {
        omitirGoogle();
        var box = button.closest('.grupo-google');
        if (box) box.parentNode.removeChild(box);
      });
    });
  }

  // La app deja el nombre del viaje guardado un instante antes de saltar acá,
  // para que el grupo no arranque pidiéndole a cada uno que lo vuelva a
  // escribir. Se lee una sola vez y se conserva en memoria: si el alta falla y
  // hay que volver a pintar el formulario, el nombre no se pierde.
  function readTripPreset() {
    if (nameDraft !== null) return nameDraft;
    nameDraft = '';
    try {
      var raw = sessionStorage.getItem(PRESET_KEY);
      if (raw) {
        var preset = JSON.parse(raw);
        if (preset && preset.name) nameDraft = String(preset.name).trim();
      }
    } catch (error) {}
    return nameDraft;
  }
  /* Lo que el presupuesto dejo para la cuenta: los rubros elegidos (con el monto
     del presupuesto) y las personas del viaje. Se lee aparte del nombre porque
     "Cambiar" en el banner solo suelta el nombre; los gastos iniciales siguen
     siendo del presupuesto. Devuelve listas vacias si no hay nada o esta roto. */
  function readBudgetPreset() {
    var out = { items: [], people: [] };
    try {
      var raw = sessionStorage.getItem(PRESET_KEY);
      var preset = raw ? JSON.parse(raw) : null;
      if (preset && Array.isArray(preset.items)) {
        out.items = preset.items.map(function (it) { return { label: String(it && it.label || '').trim().slice(0, 80), amount: Math.round(Number(it && it.amount)) }; })
          .filter(function (it) { return it.label && it.amount > 0; }).slice(0, 20);
      }
      if (preset && Array.isArray(preset.people)) {
        out.people = preset.people.slice(0, 20).map(function (n) { return String(n || '').trim().slice(0, 40); });
      }
    } catch (error) {}
    return out;
  }
  function clearTripPreset() {
    try { sessionStorage.removeItem(PRESET_KEY); } catch (error) {}
  }

  // Si la persona ya está logueada, su nombre no hay que volver a escribirlo.
  // La sesión vive en localStorage bajo el mismo project ref, así que el
  // cliente de esta página la encuentra sola. Es best-effort: si no hay sesión
  // (o el lookup falla) el campo queda con su placeholder y no se rompe nada.
  // Misma precedencia que authDisplayName() en app.js, para que el mismo
  // usuario no aparezca con dos nombres distintos según la página.
  async function loadNameFromSession() {
    try {
      var result = await supabaseClient.auth.getUser();
      var user = result && result.data && result.data.user;
      if (!user) return '';
      var metadata = user.user_metadata || {};
      // Se prueba cada campo ya recortado: un full_name de sólo espacios es
      // truthy en JS, así que con un || normal cortocircuitaba y el nombre
      // quedaba vacío en vez de caer al email.
      var candidates = [metadata.full_name, metadata.name, user.email];
      for (var i = 0; i < candidates.length; i++) {
        var value = String(candidates[i] || '').trim();
        if (value) return value;
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  async function loadSupabaseSdk() {
    if (supabaseClient) return;
    var config = await fetch('/api/config').then(function (r) { return r.json(); });
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Falta configurar Supabase en el servidor.');
    // El SDK sólo se baja la primera vez: si ya está en la página (o lo trajo
    // otra vista) alcanza con armar el cliente con la config del servidor.
    if (!window.supabase || !window.supabase.createClient) {
      await new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = function () { reject(new Error('No pudimos cargar Supabase.')); };
        document.head.appendChild(script);
      });
    }
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  function render(html) { app.innerHTML = html; }
  // El nombre del viaje también pasa a ser el título de la pestaña: al pegar el
  // link en una conversación ya se ve de qué viaje se trata.
  function syncDocumentTitle() {
    if (group && group.name) document.title = group.name + ' · CuántoSale';
  }
  function shareUrl() { return window.location.origin + '/grupo/' + currentGroupId; }
  // Un solo mensaje con el nombre del viaje adentro. Sirve para el botón
  // "Invitar amigos" y para el link, así el nombre del viaje aparece siempre,
  // se comparta como se comparta.
  function shareMessage() {
    return 'Sumate a dividir los gastos de "' + group.name + '". No hace falta crear una cuenta: ' + shareUrl();
  }
  function personById(id) { return participants.filter(function (p) { return p.id === id; })[0]; }
  function expenseById(id) { return expenses.filter(function (e) { return e.id === id; })[0]; }
  /* Quién puede borrar qué: cada persona, solamente lo que ella agregó. El dueño
     de un gasto es quien lo cargó (gastos.agregado_por) y, en los gastos viejos
     que no lo tienen, quien pagó. Ni el admin borra lo de otro: si hay un error
     en un gasto ajeno se le pide a quien lo cargó.
     Sin `me` no se borra nada. La pantalla de suma siempre lo define antes de
     pintar la lista, así que es una red de seguridad, no un camino normal.
     Es una regla de la pantalla. La base la hace cumplir solo para gastos cuyo
     dueño tiene cuenta (supabase_grupo_cuentas.sql); para el resto el link sigue
     siendo la contraseña. */
  function duenoDeGasto(expense) { return expense.agregado_por || expense.paid_by_participante_id; }
  function puedeBorrarGasto(expense) {
    if (!me || !expense) return false;
    return duenoDeGasto(expense) === me.id;
  }
  /* Los nombres de entre quienes se divide un gasto, con "y" antes del último.
     "Entre 2 personas" no alcanza: quien carga el gasto tiene que poder ver a
     quién le está pasando la parte, y en un viaje de seis es la única forma de
     revisar que el reparto esté bien sin hacer la cuenta a mano. */
  function splitNamesText(ids) {
    if (!ids.length) return '';
    if (ids.length === 1) return participantName(ids[0]);
    return ids.slice(0, -1).map(function (id) { return participantName(id); }).join(', ') + ' y ' + participantName(ids[ids.length - 1]);
  }

  function renderCreateForm(errorMessage) {
    var preset = readTripPreset();
    var presetBanner = preset
      ? '<div class="grupo-preset"><span>Usamos el nombre de tu viaje: <b>' + esc(preset) + '</b></span>' +
        '<button type="button" id="preset-clear">Cambiar</button></div>'
      : '';
    render(
      '<div class="grupo-card"><h1>Dividí los gastos del viaje</h1>' +
      '<p class="grupo-note" style="margin-top:8px;margin-bottom:18px">Creá un grupo, compartí el link con tus amigos y cada uno puede sumar sus gastos.</p>' +
      presetBanner +
      (errorMessage ? '<p class="grupo-error">' + esc(errorMessage) + '</p>' : '') +
      '<form id="create-form">' +
      '<label class="grupo-field">Nombre del viaje o grupo<input required name="groupName" placeholder="Ej: Finde en Florianópolis" maxlength="80" value="' + esc(preset) + '"></label>' +
      '<label class="grupo-field">Tu nombre<input required name="yourName" placeholder="Ej: Bruno" maxlength="40" value="' + esc(nameFromAuth || (readBudgetPreset().people[0] || '')) + '"></label>' +
      (readBudgetPreset().items.length ? '<p class="grupo-note">Vamos a cargar ' + readBudgetPreset().items.length + ' gastos del presupuesto y ' + Math.max(1, readBudgetPreset().people.length) + (readBudgetPreset().people.length === 1 ? ' persona' : ' personas') + '.</p>' : '') +
      '<button type="submit" class="grupo-btn grupo-btn--primary">Crear grupo y obtener link</button>' +
      '</form></div>'
    );
    var presetClear = document.getElementById('preset-clear');
    if (presetClear) presetClear.addEventListener('click', function () {
      nameDraft = '';
      clearTripPreset();
      renderCreateForm(null);
    });
    document.getElementById('create-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var form = e.target;
      var groupName = form.groupName.value.trim();
      var yourName = form.yourName.value.trim();
      if (!groupName || !yourName) return;
      var budget = readBudgetPreset();
      form.querySelector('button').disabled = true;
      try {
        await loadSupabaseSdk();
        var groupResult = await supabaseClient.from('grupos_viaje').insert({ name: groupName }).select().single();
        if (groupResult.error) throw new Error(groupResult.error.message);
        // es_admin en la fila de quien CREE el grupo, no en grupos_viaje. Lo del
        // grupo (creator_user_id) no servía: es un id de auth.users y el grupo se
        // puede crear sin sesión, así que quedaba siempre en NULL. Acá la fila
        // del creador se inserta en el mismo acto del alta, y con ella ya se
        // sabe quién es: es la única forma de tener admin sin obligar a
        // loguearse a nadie.
        var creatorRow = { grupo_id: groupResult.data.id, display_name: yourName, device_id: deviceId(), es_admin: true };
        // Con sesion, el creador queda vinculado a su cuenta desde el alta.
        if (authUser && await soportaCuentas()) creatorRow.user_id = authUser.id;
        var participantResult = await supabaseClient.from('participantes').insert(creatorRow).select().single();
        if (participantResult.error) throw new Error(participantResult.error.message);
        /* Los gastos iniciales salen del presupuesto: un gasto por rubro elegido,
           pagado por quien crea el grupo (es quien lo arma; el pagador real se
           corrige borrando y recargando el gasto) y repartido entre todas las
           personas del viaje. Las demas personas entran con el nombre que se
           escribio en el reparto, o "Persona N", y despues cada una puede
           reclamar su nombre desde el link. Si esto falla el grupo ya existe y
           sirve: no se tira abajo por no poder precargar. */
        try {
          var creatorId = participantResult.data.id;
          var allIds = [creatorId];
          var others = [];
          for (var i = 1; i < budget.people.length; i++) {
            others.push({ grupo_id: groupResult.data.id, display_name: budget.people[i] || 'Persona ' + (i + 1), device_id: 'manual-' + randomId() });
          }
          if (others.length) {
            var othersResult = await supabaseClient.from('participantes').insert(others).select();
            if (!othersResult.error) allIds = allIds.concat((othersResult.data || []).map(function (p) { return p.id; }));
          }
          if (budget.items.length) {
            var conAgregadoPor = await soportaAgregadoPor();
            await supabaseClient.from('gastos').insert(budget.items.map(function (it) {
              var fila = { grupo_id: groupResult.data.id, paid_by_participante_id: creatorId, description: it.label, amount: it.amount, currency: 'USD', split_between: allIds };
              if (conAgregadoPor) fila.agregado_por = creatorId;
              return fila;
            }));
          }
        } catch (seedError) { /* el grupo queda creado sin gastos iniciales */ }
        clearTripPreset();
        window.location.href = '/grupo/' + groupResult.data.id;
      } catch (error) {
        renderCreateForm(error.message || 'No pudimos crear el grupo.');
      }
    });
  }

  function renderJoinForm(groupId, errorMessage, showAddForm) {
    syncDocumentTitle();
    var existingMarkup = participants.length
      ? '<p class="grupo-ask">¿Quién sos?</p><div class="grupo-participants" id="join-existing">' +
        participants.map(function (p) { return '<button type="button" class="grupo-claim" data-claim-participant="' + esc(p.id) + '" aria-label="Elegir a ' + esc(p.display_name) + '">' + esc(p.display_name) + '</button>'; }).join('') +
        '</div>'
      : '<p class="grupo-ask">Todavía no hay nadie en este grupo. Sé el primero:</p>';
    render(
      '<div class="grupo-card"><h1>' + esc(group.name) + '</h1>' +
      '<p class="grupo-sub">Te compartieron el link de este viaje. Elegí tu nombre para empezar a cargar los gastos.</p>' +
      googleOfferMarkup('¿Querés que tus gastos queden a tu nombre? <b>Entrá con Google</b> (es opcional).') +
      (errorMessage ? '<p class="grupo-error">' + esc(errorMessage) + '</p>' : '') +
      existingMarkup +
      (participants.length && !showAddForm
        ? '<button type="button" class="grupo-altbtn" id="join-not-listed">No estoy en la lista, agregarme</button>'
        : '<form id="join-form"><label class="grupo-field">Tu nombre<input required name="yourName" placeholder="¿Cómo te llamás?" maxlength="40"></label>' +
          '<button type="submit" class="grupo-btn grupo-btn--primary">Sumarme al grupo</button></form>') +
      '</div>'
    );
    bindGoogleOffer(app);
    var claimButtons = document.getElementById('join-existing');
    if (claimButtons) {
      claimButtons.addEventListener('click', function (e) {
        var button = e.target.closest('[data-claim-participant]');
        if (!button) return;
        var participantId = button.getAttribute('data-claim-participant');
        var participant = personById(participantId);
        if (!participant) return;
        rememberParticipant(groupId, participantId);
        me = participant;
        renderGroup(groupId);
      });
    }
    var notListedButton = document.getElementById('join-not-listed');
    if (notListedButton) notListedButton.addEventListener('click', function () { renderJoinForm(groupId, null, true); });
    var joinForm = document.getElementById('join-form');
    if (joinForm) joinForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var yourName = e.target.yourName.value.trim();
      if (!yourName) return;
      e.target.querySelector('button').disabled = true;
      try {
        var newRow = { grupo_id: groupId, display_name: yourName, device_id: deviceId() };
        if (authUser && await soportaCuentas()) newRow.user_id = authUser.id;
        var result = await supabaseClient.from('participantes').insert(newRow).select().single();
        if (result.error) throw new Error(result.error.message);
        rememberParticipant(groupId, result.data.id);
        me = result.data;
        await loadGroupData(groupId);
        renderGroup(groupId);
      } catch (error) {
        renderJoinForm(groupId, error.message || 'No pudimos sumarte al grupo.', true);
      }
    });
  }

  function splitIdsOf(expense) {
    return Array.isArray(expense.split_between) ? expense.split_between.filter(function (id) { return !!personById(id); }) : [];
  }
  // Los gastos que quedaron afuera de la cuenta por no poder convertirse a la
  // moneda del grupo. Se guardan para poder nombrarlos abajo en vez de dejar
  // un total que no cierra sin explicación.
  var gastosSinConvertir = [];
  function computeBalances() {
    var balances = {};
    participants.forEach(function (p) { balances[p.id] = 0; });
    gastosSinConvertir = [];
    expenses.forEach(function (expense) {
      var splitIds = splitIdsOf(expense);
      if (!splitIds.length) return; // gasto sin participantes válidos: no genera deuda
      // Todo se lleva a la moneda del grupo antes de sumar: un gasto cargado en
      // reales y otro en dólares no se pueden sumar así nomás.
      var total = aMonedaGrupo(expense.amount, expense.currency);
      if (total == null) { gastosSinConvertir.push(expense); return; }
      var share = total / splitIds.length;
      if (expense.paid_by_participante_id) balances[expense.paid_by_participante_id] = (balances[expense.paid_by_participante_id] || 0) + total;
      splitIds.forEach(function (participantId) { balances[participantId] = (balances[participantId] || 0) - share; });
    });
    return balances;
  }
  // Algoritmo greedy: liquida la mayor deuda contra el mayor saldo a favor en
  // cada paso, para llegar al mínimo de transferencias posibles entre pares.
  function settlements(balances) {
    var creditors = [], debtors = [];
    Object.keys(balances).forEach(function (id) {
      var amount = Math.round(balances[id] * 100) / 100;
      if (amount > 0.01) creditors.push({ id: id, amount: amount });
      else if (amount < -0.01) debtors.push({ id: id, amount: -amount });
    });
    creditors.sort(function (a, b) { return b.amount - a.amount; });
    debtors.sort(function (a, b) { return b.amount - a.amount; });
    var moves = [];
    var ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      var pay = Math.min(creditors[ci].amount, debtors[di].amount);
      moves.push({ from: debtors[di].id, to: creditors[ci].id, amount: pay });
      creditors[ci].amount -= pay; debtors[di].amount -= pay;
      if (creditors[ci].amount < 0.01) ci++;
      if (debtors[di].amount < 0.01) di++;
    }
    return moves;
  }
  function participantName(id) { var p = personById(id); return p ? p.display_name : 'Alguien'; }
  // El total de lo cargado. Suma solo lo que se pudo traer a la moneda del
  // grupo: los que no, quedan fuera de la cuenta y la vista los nombra aparte.
  function totalSpent() {
    return expenses.reduce(function (sum, expense) {
      var value = aMonedaGrupo(expense.amount, expense.currency);
      return value == null ? sum : sum + value;
    }, 0);
  }

  /* ---------- saldos pagados ---------- */
  // Lo que ya se pagó, por par, en la moneda del grupo: {"bruno|paola": 13251941721.22}.
  // Se guarda el MONTO y no solo el par porque el greedy recalcula los importes
  // cada vez que se toca un gasto. Con la clave del par sola, un gasto nuevo
  // que volviera a generar esa pareja (cualquier gasto de Bruno cambia lo que
  // debe) salía con el tilde de "Pagado" y el dinero nuevo desaparecía de la
  // lista sin que nadie lo pidiera. Guardando el monto, lo pagado se descuenta
  // del saldo antes de repartir y lo que sobra es deuda nueva de verdad.
  function saldosGuardados() {
    var raw = group && group.saldos;
    if (!raw) return {};
    if (Array.isArray(raw)) {
      // Formato viejo: ["quien|quien", ...], sin monto. El pago existe pero no
      // se sabe cuánto era, así que queda en null hasta que migrarSaldos() lo
      // complete con el importe que tenía esa transferencia.
      return raw.reduce(function (acc, key) {
        if (typeof key === 'string' && key.indexOf('|') > 0) acc[key] = null;
        return acc;
      }, {});
    }
    return typeof raw === 'object' ? raw : {};
  }
  function saldoKey(move) { return move.from + '|' + move.to; }
  // Cuánto se le descuenta a cada quien de lo que ya pagó, para que el greedy
  // reparta solo lo que falta. Se descuenta el mismo monto de los dos lados.
  //
  // Y se descuenta ENTERO, sin recortarlo contra la deuda de hoy. Es lo que
  // hace que la cuenta sea la cuenta: si alguien pagó 500 y después cargó un
  // gasto del que le tocaba menos, ese diferencia no es plata perdida ni un
  // "pagaste de más" que la página no sabe dónde poner: es que le devem a
  // él, y sale como una transferencia en sentido contrario, con su botón de
  // "Ya pagué". Recortarlo dejaba el caso de todos los días del viaje roto:
  // se marcaba el pago, se cargaba el gasto siguiente y la página decía
  // "están todos al día" con plata de nadie.
  function saldoPendiente(balances) {
    var pagado = saldosGuardados();
    var out = {};
    Object.keys(balances).forEach(function (id) { out[id] = balances[id]; });
    Object.keys(pagado).forEach(function (key) {
      var partes = key.split('|');
      var deudor = partes[0], acreedor = partes[1];
      var monto = Number(pagado[key]);
      // Solo se saltea lo que no se puede ubicar: un par con alguien que ya no
      // está en el grupo no tiene a quién moverle el saldo.
      if (!(monto > 0) || out[deudor] == null || out[acreedor] == null) return;
      out[deudor] += monto;
      out[acreedor] -= monto;
    });
    return out;
  }
  // Las transferencias ya saldadas, para mostrarlas tachadas y para poder
  // deshacerlas. Una entrada sin monto (formato viejo sin migrar todavía) no se
  // muestra: no hay cifra que tachar.
  function saldosSaldados() {
    var pagado = saldosGuardados();
    return Object.keys(pagado).map(function (key) {
      var partes = key.split('|');
      return { from: partes[0], to: partes[1], amount: Math.round((Number(pagado[key]) || 0) * 100) / 100 };
    }).filter(function (move) {
      return move.amount > 0 && !!personById(move.from) && !!personById(move.to);
    });
  }
  // Marca o desmarca una transferencia guardando el monto, no solo el par. La
  // accion va explicita porque las dos no se pueden deducir del estado: si
  // alguien pago la mitad, quedan 125 pagados y 125 pendientes para la misma
  // pareja, y el boton de la fila pendiente ("Ya pagué", sumar) es el mismo que
  // el de la fila saldada ("Deshacer", restar). Sin distinguirlos, el segundo
  // toque borraba el pago que ya estaba hecho.
  function marcarSaldo(move, accion) {
    var next = Object.assign({}, saldosGuardados());
    var key = saldoKey(move);
    var actual = Math.round((Number(next[key]) || 0) * 100) / 100;
    if (accion === 'deshacer') {
      // Si ya no queda nada de esa deuda, la marca se va entera: dejar un resto
      // invisible sería peor que no tener registro.
      var queda = Math.round((actual - move.amount) * 100) / 100;
      if (queda > 0.01) next[key] = queda; else delete next[key];
    } else {
      next[key] = Math.round((actual + move.amount) * 100) / 100;
    }
    return next;
  }
  // Los grupos de antes guardaban solo el par. Esos pagos sí existen, así que se
  // completan con el importe que tenía la transferencia en ese momento y se
  // guardan. Si no se completaran, cada gasto nuevo volvería a saldar esa
  // pareja solo y el bug volvería con ellos.
  function migrarSaldosPlan() {
    var pagado = saldosGuardados();
    var viejas = Object.keys(pagado).filter(function (key) { return !(Number(pagado[key]) > 0); });
    if (!viejas.length) return null;
    var crudo = {};
    Object.keys(pagado).forEach(function (key) {
      if (Number(pagado[key]) > 0) crudo[key] = Number(pagado[key]);
    });
    // Con el plan vacío no hay con qué completar los pagos: mejor dejar los
    // datos como están que borrarlos por una migración a ciegas.
    var plan = settlements(computeBalances());
    if (!plan.length) return null;
    plan.forEach(function (move) {
      var key = saldoKey(move);
      if (viejas.indexOf(key) !== -1) crudo[key] = move.amount;
    });
    return crudo;
  }
  // Firma de los datos que pinta la pantalla. El poll la compara para no
  // repintar (y borrar lo que el usuario está escribiendo) si nada cambió.
  function dataSignature() {
    return [group && group.name, participants.map(function (p) { return p.id + ':' + p.display_name; }).join(','),
      expenses.map(function (e) { return e.id + ':' + e.amount + ':' + e.currency + ':' + e.description + ':' + e.paid_by_participante_id + ':' + splitIdsOf(e).join('+'); }).join(','),
      // Los saldos pagados van en la firma: si no, el poll vería la pantalla
      // igual y no repintaría el tilde que el usuario acaba de poner. Se
      // serializan par y monto, que es lo que ahora identifica cada pago.
      saldosSaldados().map(function (m) { return saldoKey(m) + ':' + m.amount; }).sort().join(',')
    ].join('|');
  }

  function renderGroup(groupId) {
    currentGroupId = groupId;
    syncDocumentTitle();
    lastSignature = dataSignature();
    var url = shareUrl();
    var currency = groupCurrency();
    var balances = computeBalances();
    // Lo pendiente sale de los saldos brutos menos lo ya pagado. El greedy
    // reparte sobre eso, así que un gasto nuevo genera deuda nueva de verdad y
    // no vuelve a salir con el tilde de la transferencia anterior.
    var pendiente = saldoPendiente(balances);
    var moves = settlements(pendiente);
    var pagadas = saldosSaldados();
    // Nada pendiente = todo lo cargado está saldado. Lo usan las filas de
    // gastos para tacharse, así que se decide acá y no en cada fila.
    var todoSaldado = !moves.length && !gastosSinConvertir.length;
    var total = totalSpent();
    var checksMarkup = participants.map(function (p) {
      return '<label><input type="checkbox" name="split" value="' + esc(p.id) + '" checked> ' + esc(p.display_name) + '</label>';
    }).join('');
    var payerOptionsMarkup = participants.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (me && p.id === me.id ? ' selected' : '') + '>' + esc(p.display_name) + '</option>';
    }).join('');
    // Monedas para cargar un gasto y para ver la página. Se muestran solo las
    // que tienen tasa; si no llegó ninguna, no se ofrece selector y todos los
    // montos se leen en la moneda del grupo.
    var disponibles = monedasVerificables();
    var currencyPickerMarkup = disponibles.length
      ? disponibles.map(function (m) {
          return '<option value="' + esc(m.code) + '"' + (m.code === currency ? ' selected' : '') + '>' + esc(m.etiqueta || m.code) + '</option>';
        }).join('')
      : '';
    /* "Ver en" ofrece la moneda del grupo como una opción más, con su código.
       Antes era una opción aparte —"USD (del grupo)"— con value="", y eso
       dejaba el <select> mintiendo: un value vacío no es una moneda, así que
       con verEn vacío (nadie eligió otra todavía) el navegador marcaba la
       primera opción de la lista y la página seguía mostrando los montos en la
       del grupo. El desplegable decía una cosa y los números otra. Con la del
       grupo en la lista usando su código de verdad, lo marcado y lo que se está
       viendo siempre son lo mismo.

       La del grupo entra aunque no tenga tasa: es la única moneda en la que los
       montos se leen sin convertir, así que ofrecerla siempre es lo que evita
       dejar a alguien sin números si /api/tasas viene flojo. */
    var opcionesVer = [currency].concat(
      disponibles.map(function (m) { return m.code; }).filter(function (code) { return code !== currency; })
    );
    var verEnMarkup = disponibles.length
      ? '<span class="grupo-veren"><span class="grupo-veren__label">Ver en</span>' +
        '<select class="grupo-veren__sel" aria-label="Moneda para ver los montos">' +
        opcionesVer.map(function (code) {
          return '<option value="' + esc(code) + '"' + (verEnActual() === code ? ' selected' : '') + '>' + esc(code) + '</option>';
        }).join('') +
        '</select></span>'
      : '';
    // Lo que no se pudo convertir se dice, con nombre y apellido. Un total que
    // no cierra sin explicación se lee como error de la app, y un monto con el
    // símbolo de otra moneda se lee como un número inventado. Las dos cosas son
    // peores que un aviso.
    // Esta lista se arma aparte de gastosSinConvertir (que usa computeBalances
    // para no mandar a la cuenta) a propósito: ahí solo entran los gastos que
    // además de no convertir tienen participantes válidos, y el aviso tiene que
    // nombrar a todos los que se quedaron fuera del total, que es lo que totalSpent
    // deja de sumar.
    var sinConvertir = expenses.filter(function (expense) {
      return aMonedaGrupo(expense.amount, expense.currency) == null;
    });
    /* "No hay tasa" es un aviso sobre una conversión, así que solo tiene sentido
       cuando se pidió convertir de verdad. La moneda del grupo puede no tener
       tasa —si /api/tasas no la trajo— y antes eso no se notaba porque no era
       una opción del selector. Ahora que aparece con su código, chequear su
       tasa complainía de un número que ya está bien: los montos se leen tal cual
       en la moneda en la que se gastaron, que es exactamente lo correcto. */
    var faltaTasa = verEnActual() !== currency && tasaDe(verEnActual()) == null;
    var sinConvertirMarkup = (sinConvertir.length || faltaTasa)
      ? '<p class="grupo-warn">' +
        (sinConvertir.length
          ? (sinConvertir.length === 1 ? 'El gasto ' : sinConvertir.length + ' de los gastos ') +
            '"' + esc(sinConvertir.map(function (expense) { return expense.description; }).join('", "')) + '" ' +
            (sinConvertir.length === 1 ? 'está' : 'están') + ' en una moneda sin tasa y no ' +
            (sinConvertir.length === 1 ? 'cuenta' : 'cuentan') + ' en el total ni en los saldos.'
          : '') +
        (faltaTasa
          ? ' No hay tasa para pasar a ' + esc(verEnActual()) + ': los montos se muestran en la moneda en la que se gastaron.'
          : '') +
        '</p>'
      : '';

    /* El editor de la división, abajo de la fila que se tocó y no en un modal:
       un modal tapaba justo la fila que se está corrigiendo, que es la que hay
       que poder comparar mientras se decide. Reutiliza .grupo-checks y
       .grupo-btn del formulario de gasto para que "entre quiénes se divide" se
       vea igual cargándolo y corrigiéndolo.
       Los marcados salen de editandoSplit.ids y no del gasto: mientras se elige
       no se guardó nada, y el poll repinta la página cada 12s. */
    function splitEditorMarkup(expense) {
      if (!editandoSplit || editandoSplit.expenseId !== expense.id) return '';
      var guardando = editandoSplit.guardando;
      // El nombre del gasto y el monto ya están en la fila de arriba, a la que
      // el editor se pegó: repetirlos acá lo convertía en un formulario suelto
      // en vez de la respuesta a la fila que se está tocando.
      var n = editandoSplit.ids.length;
      var cuantos = n === 0
        ? 'No está dividido entre nadie todavía.'
        : n === 1
          ? 'Solo se le carga a ' + esc(participantName(editandoSplit.ids[0])) + ': el resto no debe nada de este gasto.'
          : 'Entre ' + esc(splitNamesText(editandoSplit.ids)) + ': ' +
            esc(moneyVer(Number(expense.amount) / n, expense.currency)) + ' c/u.';
      return '<div class="grupo-split">' +
        '<p class="grupo-split__title">¿Entre quiénes se divide?</p>' +
        '<div class="grupo-checks">' + participants.map(function (p) {
          return '<label><input type="checkbox" data-split-edit value="' + esc(p.id) + '"' +
            (editandoSplit.ids.indexOf(p.id) !== -1 ? ' checked' : '') +
            (guardando ? ' disabled' : '') + '> ' + esc(p.display_name) + '</label>';
        }).join('') + '</div>' +
        '<div class="grupo-checks__tools"><button type="button" class="grupo-minibtn" data-split-all' + (guardando ? ' disabled' : '') + '>Seleccionar todos</button></div>' +
        // La cuenta viva de lo que se está marcando. El editor se abre para
        // cambiar el reparto, así que ver cuánto le toca a cada quien mientras
        // se eligen las personas es el motivo de estar acá: sin esto había que
        // marcar, guardar y recién ahí mirar el resultado en la fila.
        '<p class="grupo-split__hint" aria-live="polite">' + cuantos + '</p>' +
        '<div class="grupo-split__actions">' +
        '<button type="button" class="grupo-btn grupo-btn--ghost" data-split-cancel' + (guardando ? ' disabled' : '') + '>Cancelar</button>' +
        '<button type="button" class="grupo-btn grupo-btn--primary" data-split-save' + (guardando ? ' disabled' : '') + '>' + (guardando ? 'Guardando...' : 'Guardar división') + '</button>' +
        '</div></div>';
    }
    var expensesMarkup = expenses.length
      ? expenses.map(function (expense) {
          // "dividido entre 3" no dice quiénes. Con los nombres al lado, cada
          // quien puede revisar su parte sin tener que hacer la cuenta mental.
          var splitIds = splitIdsOf(expense);
          // Cuando no queda nada pendiente, todos los gastos están saldados y
          // la lista entera se apaga con un tachado. Antes solo se tachaba la
          // fila de la transferencia: el que cargó un gasto de 500.000 no
          // tenía forma de saber que ese gasto ya estaba saldado.
          var saldoneado = todoSaldado && splitIds.length > 0;
          var abierto = !!(editandoSplit && editandoSplit.expenseId === expense.id);
          /* La fila entera es el botón de "cambiar la división", salvo la
             papelera. La papelera va AFUERA del botón y no adentro: un
             <button> dentro de otro <button> es HTML inválido y, más acá,
             haría que tocar la papelera abriera el editor. Como hermanos, el
             área táctil de editar es toda la fila y la de borrar sigue siendo
             la papelera.
             Los hijos van como <span> porque el modelo de contenido de un
             <button> es contenido de frase: los <div> que tenía la fila antes
             eran HTML inválido adentro de un botón. */
          return '<div class="grupo-expense' + (saldoneado ? ' is-saldado' : '') + '">' +
            '<button type="button" class="grupo-expense__edit" data-edit-split="' + esc(expense.id) + '" aria-expanded="' + (abierto ? 'true' : 'false') + '" aria-label="Cambiar entre quiénes se divide ' + esc(expense.description) + '">' +
            '<span class="grupo-expense__ico">' + icon(guessCategory(expense.description)) + '</span>' +
            '<span class="grupo-expense__body">' +
            // El monto va en la MISMA fila que el título, con justify-between.
            // Antes estaba en una columna aparte con align-items:center, así
            // que el precio quedaba flotando en el medio de una fila de tres
            // líneas mientras el ícono y el título quedaban arriba: eso es
            // exactamente la desalineación que se veía.
            '<span class="grupo-expense__top">' +
            '<span class="grupo-expense__name">' + esc(expense.description) + '</span>' +
            '<span class="grupo-expense__amount">' + esc(moneyVer(expense.amount, expense.currency)) + '</span>' +
            '</span>' +
            // Las dos líneas de detalle van dentro de la columna de contenido,
            // debajo del título, y nunca debajo del ícono.
            '<span class="grupo-expense__meta">Pagó ' + esc(participantName(expense.paid_by_participante_id)) + '</span>' +
            // Con los nombres, y no solo el número. Entre una sola persona se
            // dice que no se divide, porque "Entre 1 persona: X c/u" parece un
            // reparto y es solo el gasto entero de esa persona.
            '<span class="grupo-expense__meta">' + (splitIds.length
              ? (splitIds.length === 1
                ? 'No se divide · solo ' + esc(participantName(splitIds[0]))
                : 'Entre ' + esc(splitNamesText(splitIds)) + ': ' + esc(moneyVer(Number(expense.amount) / splitIds.length, expense.currency)) + ' c/u')
              : 'Sin personas para dividir') + '</span>' +
            '</span>' +
            '</button>' +
            splitEditorMarkup(expense) +
            // La papelera se muestra según quién puede borrar: cada uno borra los
            // gastos que cargó, y el que creó el grupo borra cualquiera. Antes
            // salía en todas las filas y cualquiera con el link podía borrar el
            // gasto de otro. Borrar igual pide confirmación, así que no pasa por
            // un clic a secas.
            (puedeBorrarGasto(expense)
              ? '<button type="button" class="grupo-trash" data-delete-expense="' + esc(expense.id) + '" aria-label="Borrar ' + esc(expense.description) + '">' + icon('trash') + '</button>'
              : '') +
            '</div>';
        }).join('')
      : '<p class="grupo-note" style="margin-top:0">Todavía no hay gastos cargados.</p>';
    // El saldo por persona contesta la pregunta que aparece primero ("¿cuánto
    // puse yo?") sin obligar a hacer la resta de los movimientos de abajo. Van
    // los saldos PENDIENTES, no los brutos: con los brutos, después de que
    // todos pagan la lista seguía diciendo "le deben" lo mismo de siempre, que
    // es la misma mentira que el tilde en las transferencias.
    var balancesSummary = expenses.length
      ? participants.map(function (p) {
          var value = Math.round((pendiente[p.id] || 0) * 100) / 100;
          var label = Math.abs(value) < 0.01
            ? '<b class="pos">al día</b>'
            : '<b class="' + (value > 0 ? 'pos' : 'neg') + '">' + (value > 0 ? 'le deben ' : 'debe ') + esc(moneyVer(Math.abs(value), currency)) + '</b>';
          // "(vos)" en el saldo también: la lista es de todos, y sin marcar
          // cuál es el tuyo hay que buscar el nombre entre las filas.
          return '<div class="grupo-balance' + (me && p.id === me.id ? ' is-me' : '') + '"><span>' + esc(p.display_name) + (me && p.id === me.id ? ' <em>(vos)</em>' : '') + '</span>' + label + '</div>';
        }).join('')
      : '';
    var meId = me ? me.id : null;
    // Una fila de transferencia. "mio" y "conBoton" van por separado a
    // proposito: el botón depende de si la fila le compete a quien mira, y la
    // marca de "esto es tuyo" depende ademas de que haya alguien mirando. Sin
    // identidad no se puede marcar la fila de nadie como propia, aunque se le
    // deje el botón.
    // El monto va en el data-saldo-monto porque la marca se guarda con la cifra:
    // desmarcar tiene que sacar exactamente lo que esa fila marcaba, y con la
    // sola clave del par no se sabe cuánto era.
    function settleRow(move, mio, conBoton) {
      var key = saldoKey(move);
      return '<div class="grupo-settle' + (mio ? ' is-mine' : '') + '">' +
        '<span class="grupo-settle__flow"><b>' + esc(participantName(move.from)) + '</b>' +
        '<span class="grupo-settle__arrow" aria-hidden="true">' + icon('arrow') + '</span>' +
        '<b>' + esc(participantName(move.to)) + '</b></span>' +
        '<span class="grupo-settle__amount">' + esc(moneyVer(move.amount, currency)) + '</span>' +
        (conBoton ?
          '<button type="button" class="grupo-settledon" data-saldo="' + esc(key) + '" data-saldo-monto="' + esc(move.amount) + '" data-saldo-accion="pagar" aria-pressed="false">' +
          '<span class="grupo-settledon__box" aria-hidden="true"></span>' +
          'Ya pagué</button>' : '') + '</div>';
    }
    // Las transferencias ya saldadas van aparte, tachadas. Antes vivían
    // mezcladas con las pendientes y el tilde convivía con un titular que decía
    // "te tienen que pagar": dos verdades contradictorias en el mismo bloque.
    function settledRow(move) {
      return '<div class="grupo-settle is-paid' + (me && (move.from === me.id || move.to === me.id) ? ' is-mine' : '') + '">' +
        '<span class="grupo-settle__flow"><b>' + esc(participantName(move.from)) + '</b>' +
        '<span class="grupo-settle__arrow" aria-hidden="true">' + icon('arrow') + '</span>' +
        '<b>' + esc(participantName(move.to)) + '</b></span>' +
        '<span class="grupo-settle__amount">' + esc(moneyVer(move.amount, currency)) + '</span>' +
        // El botón está para poder volver atrás: una marca de pago mal puesta
        // (se marcó la transferencia equivocada) dejaba al resto del grupo
        // viendo una deuda que ya estaba saldada, y sin esto no había cómo
        // arreglarlo.
        // Solo deshace un pago quien lo hizo: el que paga es el `from` de la
        // transferencia. El resto ve la fila tachada, sin boton.
        (me && move.from === me.id
          ? '<button type="button" class="grupo-settledon is-undo" data-saldo="' + esc(saldoKey(move)) + '" data-saldo-monto="' + esc(move.amount) + '" data-saldo-accion="deshacer" aria-pressed="true">' +
            '<span class="grupo-settledon__box" aria-hidden="true">✓</span>' +
            'Deshacer</button>'
          : '<span class="grupo-settledon is-static" aria-label="Pagado"><span class="grupo-settledon__box" aria-hidden="true">✓</span>Pagado</span>') +
        '</div>';
    }
    function saldosDe(arr) {
      return arr.reduce(function (sum, move) { return Math.round((sum + move.amount) * 100) / 100; }, 0);
    }
    /* Plural: "La 1 transferencia ya saldada", no "Las 1 transferencias ya
       saldada". El "Las" fijo con la palabra en plural se veía en pantalla
       como "Las 1 transferencias ya saldada", que es exactamente la clase de
       cosa que hace dudar de si la página está bien. */
    var pagadosMarkup = pagadas.length
      ? '<details class="grupo-other" open><summary>' + (pagadas.length === 1 ? 'La transferencia ya saldada' : 'Las ' + pagadas.length + ' transferencias ya saldadas') + '</summary>' +
        '<p class="grupo-note">Ya están pagadas. No cuentan como deuda pendiente.</p>' +
        pagadas.map(settledRow).join('') + '</details>'
      : '';
    var saldosMarkup;
    // Cuando no queda ninguna transferencia pendiente se dice explícitamente:
    // es la pregunta que todos hacen al final del viaje y "no hay nada para
    // pagar" no contesta nada. Se arma acá arriba y no al final porque en el
    // caso "todo saldado" es justamente el contenido de la rama de abajo, y
    // asi queda pegado a las dos cosas que dependen de el.
    // La excepcion es cuando quedaron gastos sin convertir: si ni esos entraron
    // en la cuenta, no se puede afirmar que no hay nada por pagar, porque en
    // realidad hay gastos que ni siquiera se pudieron mirar.
    /* "Están todos al día" es lo único que se afirma acá, y solo cuando no
       queda ninguna transferencia: con el pago descontado entero, que no
       aparezca ninguna fila significa que las cuentas dan cero de verdad. Antes
       el pago se recortaba contra la deuda del momento y lo que sobraba se
       escondía en un aviso de "pagaste de más": el saldo cerraba en cero con
       plata de alguien sin aparecer, que es peor que una cuenta que no cierra. */
    var alDiaMarkup = !moves.length && expenses.length && !gastosSinConvertir.length
      ? '<div class="grupo-allday">' + icon('check') + '<span>Están todos al día. No queda nada por pagar.</span></div>'
      : '';
    if (!moves.length) {
      // No queda nada pendiente. Si hubo gastos, el cartel de "están todos al
      // día" lo dice más abajo y acá no hace falta repetirlo. Si no se pudo
      // convertir ningún gasto, el aviso de arriba es lo que explica por qué
      // la lista de transferencias está vacía.
      saldosMarkup = (expenses.length ? '' : '<p class="grupo-note">Todavía no hay nada que saldar.</p>') + pagadosMarkup;
    } else if (!meId) {
      // Sin identidad no hay filtrado por rol posible, y esconder transferencias
      // sin saber quién mira sería peor que mostrarlas todas. Queda el
      // comportamiento anterior, con su botón, para el caso de abrir el link
      // sin haberse sentado antes en el grupo.
      saldosMarkup = moves.map(function (move) { return settleRow(move, false, true); }).join('') + pagadosMarkup;
    } else {
      // Lo que le compete a la persona que mira va arriba. Lo del resto del
      // grupo va abajo y plegado: no es lo que tiene que hacer ahora, y con la
      // lista abierta lo primero que se leia era la transferencia de otro.
      var mePaga = moves.filter(function (move) { return move.from === meId; });
      var meCobra = moves.filter(function (move) { return move.to === meId; });
      var losDemas = moves.filter(function (move) { return move.from !== meId && move.to !== meId; });
      // Los dos bloques son independientes: en un grupo se es deudor y
      // acreedor al mismo tiempo, y con un if/else solo se mostraba uno de los
      // dos lados, que es justo la mitad de la situación de esa persona. Acá no
      // hace falta separar lo pagado de lo pendiente: lo pendiente ya viene
      // pendiente de saldoPendiente(), así que todas las filas de estos bloques
      // son deuda real y el titular nunca contradice a las filas de abajo.
      var mio = '';
      if (mePaga.length) {
        mio += '<div class="grupo-subhead">Lo que tenés que pagar</div>' +
          '<p class="grupo-mine">Tenés que pagarle <b>' + esc(moneyVer(saldosDe(mePaga), currency)) + '</b>' +
          (mePaga.length > 1 ? ', en ' + mePaga.length + ' transferencias' : '') + '.</p>' +
          mePaga.map(function (move) { return settleRow(move, true, true); }).join('');
      }
      if (meCobra.length) {
        mio += '<div class="grupo-subhead">Lo que te tienen que pagar</div>' +
          '<p class="grupo-mine">Te tienen que pagar <b>' + esc(moneyVer(saldosDe(meCobra), currency)) + '</b>' +
          (meCobra.length > 1 ? ', en ' + meCobra.length + ' transferencias' : '') + '.</p>' +
          // Sin boton: esto no lo paga la persona que mira, asi que no tiene
          // nada que marcar. El que lo cobra lo confirma por su cuenta.
          meCobra.map(function (move) { return settleRow(move, true, false); }).join('');
      }
      var resto = losDemas.length
        ? '<details class="grupo-other"><summary>Las ' + losDemas.length + ' ' +
          (losDemas.length === 1 ? 'transferencia' : 'transferencias') + ' de otras personas</summary>' +
          '<p class="grupo-note">No son pagos tuyos: son transferencias entre los demás del grupo.</p>' +
          losDemas.map(function (move) { return settleRow(move, false, false); }).join('') + '</details>'
        : '';
      saldosMarkup = mio + resto + pagadosMarkup;
    }

    render(
      '<div class="grupo-card">' +
      '<div class="grupo-card__head"><h1>' + esc(group.name) + '</h1>' +
      '<span class="grupo-badge">' + (participants.length === 1 ? '1 persona' : participants.length + ' personas') + '</span></div>' +

      '<button type="button" class="grupo-invite" id="share-button">' + icon('share') + 'Invitar amigos al grupo</button>' +
      '<button type="button" class="grupo-linkchip" id="copy-share" title="' + esc(url) + '">' +
      icon('link') + '<span>' + esc(url.replace(/^https?:\/\//, '')) + '</span>' +
      '<span class="grupo-toast" id="copy-toast" hidden>¡Enlace copiado!</span></button>' +
      '<p class="grupo-note" id="copy-status" aria-live="polite"></p>' +

      '<div class="grupo-participants">' + participants.map(function (p) {
        return '<span class="grupo-chip">' + esc(p.display_name) + (me && p.id === me.id ? ' (vos)' : '') + '</span>';
      }).join('') + '</div>' +
      '<form id="add-participant-form" class="grupo-add">' +
      '<input name="participantName" placeholder="Nombre de otro amigo" maxlength="40" aria-label="Nombre de otro amigo">' +
      '<button type="submit" class="grupo-btn">+ Agregar</button></form>' +
      '<p class="grupo-error" id="participant-error" role="alert"></p></div>' +

      '<div class="grupo-card"><h2 style="margin-bottom:18px">Agregar gasto</h2>' +
      googleOfferMarkup('<b>Entrá con Google</b> para que los gastos que cargues queden a tu nombre y los veas desde cualquier dispositivo. Es opcional: podés seguir sin cuenta.') +
      '<form id="expense-form">' +
      '<div class="grupo-cats" id="cat-picker">' + CATEGORIAS.map(function (cat) {
        return '<button type="button" class="grupo-cat" data-cat="' + esc(cat.key) + '" data-cat-label="' + esc(cat.label) + '" aria-pressed="false">' +
          '<span class="grupo-cat__ico" style="color:' + cat.color + '">' + icon(cat.icon) + '</span>' +
          '<span class="grupo-cat__label">' + esc(cat.label) + '</span></button>';
      }).join('') + '</div>' +
      '<label class="grupo-field" style="margin-top:18px">Descripción<input required name="description" placeholder="Ej: Supermercado" maxlength="80"></label>' +
      // El símbolo de la moneda ya va adentro del campo, así que el label no
      // la repite: "Monto (USD)" arriba y "US$" abajo era lo mismo dos veces.
      '<label class="grupo-field">Monto<span class="grupo-amount">' +
      '<span class="grupo-amount__code">' + esc(categorySymbol(currency)) + '</span>' +
      '<input required name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="Monto">' +
      // El selector va adentro del campo, a la derecha del número: se elige la
      // moneda en la que se pagó y la app la convierte a la del grupo. Sin
      // tasas no se ofrece nada, porque no hay forma honesta de convertir.
      (currencyPickerMarkup ? '<select class="grupo-amount__cur" name="currency" aria-label="Moneda del gasto">' + currencyPickerMarkup + '</select>' : '') +
      '</span></label>' +
      '<label class="grupo-field">¿Quién pagó?<select name="paidBy">' + payerOptionsMarkup + '</select></label>' +
      '<span class="grupo-field">¿Entre quiénes se divide?<span class="grupo-checks">' + checksMarkup + '</span>' +
      '<span class="grupo-checks__tools"><button type="button" class="grupo-minibtn" data-checks="all">Seleccionar todos</button></span></span>' +
      '<p class="grupo-error" id="expense-error" role="alert"></p>' +
      '<button type="submit" class="grupo-btn grupo-btn--primary">Agregar gasto</button></form></div>' +

      '<div class="grupo-card"><div class="grupo-card__head"><h2>Gastos (' + expenses.length + ')</h2>' +
      (expenses.length ? '<span class="grupo-badge">' + esc(moneyVer(total, currency)) + '</span>' : '') + '</div>' + expensesMarkup +
      // El selector de "Ver en" va arriba de la lista de gastos, que es donde
      // se leen los montos. Solo aparece si hay más de una moneda con tasa.
      (verEnMarkup && disponibles.length > 1 ? verEnMarkup : '') +
      sinConvertirMarkup + '</div>' +

      '<div class="grupo-card"><h2>Cómo se salda</h2>' +
      (balancesSummary ? '<div class="grupo-subhead">Saldo de cada uno</div>' + balancesSummary : '') +
      saldosMarkup +
      alDiaMarkup +
      '</div>'
    );

    var participantError = document.getElementById('participant-error');
    var expenseError = document.getElementById('expense-error');
    var form = document.getElementById('expense-form');
    function splitInputs() { return Array.prototype.slice.call(form.querySelectorAll('input[name="split"]')); }

    // La grilla no guarda una categoría aparte: escribe la descripción y el
    // ícono sale de deduplicarla (guessCategory). Por eso, si después se edita
    // el texto a mano, el resaltado se recalcula: si la grilla y el texto
    // pueden discrepar, un día muestran cosas distintas y nadie sabe cuál gana.
    var catPicker = document.getElementById('cat-picker');
    function markCategory(description) {
      var guessed = guessCategory(description);
      Array.prototype.forEach.call(catPicker.querySelectorAll('[data-cat]'), function (button) {
        var own = guessCategory(button.getAttribute('data-cat-label'));
        var match = own !== 'bag' && own === guessed;
        button.setAttribute('aria-pressed', match ? 'true' : 'false');
      });
    }
    catPicker.addEventListener('click', function (e) {
      var button = e.target.closest('[data-cat]');
      if (!button) return;
      form.description.value = button.getAttribute('data-cat-label');
      markCategory(form.description.value);
      form.amount.focus();
    });
    form.description.addEventListener('input', function () { markCategory(form.description.value); });

    /* ---------- moneda del gasto ---------- */
    // El símbolo a la izquierda del campo sigue a la moneda elegida: si no, al
    // cambiar a reais queda "US$" junto a un número en reales.
    var amountCurrency = form.querySelector('select[name="currency"]');
    var amountCode = form.querySelector('.grupo-amount__code');
    if (amountCurrency && amountCode) {
      amountCurrency.addEventListener('change', function () {
        amountCode.textContent = categorySymbol(amountCurrency.value);
      });
    }

    /* ---------- ver en otra moneda ---------- */
    var verEnSelect = app.querySelector('.grupo-veren__sel');
    if (verEnSelect) {
      verEnSelect.addEventListener('change', function () {
        guardarVerEn(verEnSelect.value);
        // Se repinta entero, así que el scroll y el foco se devuelven: en un
        // viaje se cargan varios gastos seguidos y perder lo que se estaba
        // escribiendo obliga a empezar de nuevo.
        var scrollTop = window.scrollY || window.pageYOffset || 0;
        renderGroup(groupId);
        window.scrollTo(0, scrollTop);
        var refocus = document.querySelector('#expense-form input[name="description"]');
        if (refocus) refocus.focus();
      });
    }

    /* ---------- saldos pagados ---------- */
    Array.prototype.forEach.call(app.querySelectorAll('[data-saldo]'), function (button) {
      button.addEventListener('click', async function () {
        var key = button.getAttribute('data-saldo');
        // El monto y la accion van en el botón. El monto porque la marca guarda
        // la cifra y desmarcar tiene que sacar exactamente lo que esa fila
        // marcaba; la accion porque "Ya pagué" suma y "Deshacer" resta, y con
        // la misma pareja a medio pagar los dos botones pueden tener el mismo
        // par y el mismo monto.
        var monto = Number(button.getAttribute('data-saldo-monto')) || 0;
        var accion = button.getAttribute('data-saldo-accion');
        var partes = key.split('|');
        // Marcar o deshacer un pago es cosa de quien paga (el `from`). El boton
        // no se pinta para nadie mas, pero la regla va tambien aca.
        if (!me || partes[0] !== me.id) return;
        button.disabled = true;
        try {
          var siguiente = marcarSaldo({ from: partes[0], to: partes[1], amount: monto }, accion);
          var result = await supabaseClient.from('grupos_viaje').update({ saldos: siguiente }).eq('id', groupId);
          if (result.error) throw new Error(result.error.message);
          await loadGroupData(groupId);
          renderGroup(groupId);
        } catch (error) {
          button.disabled = false;
          window.alert(error.message || 'No pudimos marcar el pago.');
        }
      });
    });

    bindGoogleOffer(app);
    document.getElementById('share-button').addEventListener('click', function () {
      var status = document.getElementById('copy-status');
      var payload = { title: group.name + ' · CuántoSale', text: shareMessage(), url: url };
      if (navigator.share) {
        navigator.share(payload).then(function () {
          status.textContent = '¡Listo! Tus amigos van a ver el nombre del viaje.';
        }).catch(function (error) {
          // AbortError = el usuario cerró la hoja de compartir sin querer
          // mandar nada. No es un error que haya que mostrarle.
          if (error && error.name === 'AbortError') return;
          copyShareText(url);
        });
        return;
      }
      copyShareText(url);
    });
    document.getElementById('copy-share').addEventListener('click', function () { copyShareText(url); });

    document.getElementById('add-participant-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var addForm = e.target;
      var name = addForm.participantName.value.trim();
      if (!name) return;
      var button = addForm.querySelector('button');
      button.disabled = true;
      participantError.textContent = '';
      try {
        // Un mismo nombre cargado dos veces rompe el reparto: las dos filas
        // serían la misma persona y cada gasto quedaría partido al pedazo.
        var duplicate = participants.some(function (p) { return p.display_name.trim().toLowerCase() === name.toLowerCase(); });
        if (duplicate) throw new Error('Ese nombre ya está en el grupo. Buscalo en la lista de arriba.');
        // Sumado a mano por otro participante: no tiene navegador propio en
        // el grupo, así que le asignamos un device_id sintético en vez de
        // exigirle que abra el link para anotarse.
        var result = await supabaseClient.from('participantes').insert({ grupo_id: groupId, display_name: name, device_id: 'manual-' + randomId() });
        if (result.error) throw new Error(result.error.message);
        await loadGroupData(groupId);
        renderGroup(groupId);
      } catch (error) {
        participantError.textContent = error.message || 'No pudimos agregar al participante.';
        button.disabled = false;
      }
    });

    // "Seleccionar todos" va sobre el contenedor de los checkboxes, no sobre
    // `app`, que se repinta entero y acumularía un listener por render.
    form.querySelector('.grupo-checks__tools').addEventListener('click', function (e) {
      if (!e.target.closest('[data-checks]')) return;
      splitInputs().forEach(function (input) { input.checked = true; });
    });

    // La moneda del gasto. El <select> es opcional (no se pinta si no hay
    // tasas), así que si no está se usa la del grupo.
    function expenseCurrency() {
      var select = form.querySelector('select[name="currency"]');
      return select && select.value ? select.value : groupCurrency();
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var splitIds = splitInputs().filter(function (input) { return input.checked; }).map(function (input) { return input.value; });
      var amount = Number(form.amount.value);
      var description = form.description.value.trim();
      expenseError.textContent = '';
      if (!description) { expenseError.textContent = 'Poné una descripción.'; return; }
      if (!(amount > 0)) { expenseError.textContent = 'El monto tiene que ser mayor a 0.'; return; }
      if (!form.paidBy.value) { expenseError.textContent = 'Elegí quién pagó.'; return; }
      if (!splitIds.length) { expenseError.textContent = 'Elegí al menos una persona para dividir.'; return; }
      form.querySelector('button[type="submit"]').disabled = true;
      try {
        // Se guarda en la moneda en la que se pagó, no en la del grupo: el
        // saldo de cada quien se calculahr converting, pero el importe original
        // es el que de verdad se gastó y conviene no perderlo.
        var nuevoGasto = {
          grupo_id: groupId, paid_by_participante_id: form.paidBy.value, description: description,
          amount: amount, currency: expenseCurrency(), split_between: splitIds
        };
        // Quién lo agregó (no siempre es quien pagó): es el dueño para poder borrarlo.
        if (await soportaAgregadoPor()) nuevoGasto.agregado_por = me.id;
        var result = await supabaseClient.from('gastos').insert(nuevoGasto);
        if (result.error) throw new Error(result.error.message);
        await loadGroupData(groupId);
        // Se repinta para que el gasto nuevo se vea al instante, y después se
        // devuelven scroll y foco: en un viaje se cargan varios gastos seguidos
        // y perder el cursor obliga a volver a hacer clic.
        var scrollTop = window.scrollY || window.pageYOffset || 0;
        renderGroup(groupId);
        window.scrollTo(0, scrollTop);
        var refocus = document.querySelector('#expense-form input[name="description"]');
        if (refocus) refocus.focus();
      } catch (error) {
        form.querySelector('button[type="submit"]').disabled = false;
        expenseError.textContent = error.message || 'No pudimos agregar el gasto.';
      }
    });

    /* Un gasto que se borró no puede quedar con el editor abierto: el editor se
       pinta por id, así que sin esto editandoSplit apuntaría a una fila que ya
       no existe y no habría forma de cerrarlo. */
    if (editandoSplit && !expenseById(editandoSplit.expenseId)) editandoSplit = null;

    /* Abrir y cerrar el editor de división. El click en la fila es un toggle:
       tocarla de nuevo la cierra, así que el mismo botón hace las dos cosas y
       no hace falta un "cerrar" en la fila. */
    Array.prototype.forEach.call(app.querySelectorAll('[data-edit-split]'), function (editButton) {
      editButton.addEventListener('click', function () {
        var expenseId = editButton.getAttribute('data-edit-split');
        var expense = expenseById(expenseId);
        if (!expense) return;
        if (editandoSplit && editandoSplit.expenseId === expenseId) editandoSplit = null;
        else editandoSplit = { expenseId: expenseId, ids: splitIdsOf(expense), guardando: false };
        renderGroup(groupId);
      });
    });

    var splitEditor = app.querySelector('.grupo-split');
    if (splitEditor && editandoSplit) {
      function editorIds() {
        return Array.prototype.slice.call(splitEditor.querySelectorAll('[data-split-edit]'))
          .filter(function (input) { return input.checked; })
          .map(function (input) { return input.value; });
      }
      // La cuenta de "c/u" se escribe a mano, sin volver a pintar la página
      // entera: marcar un checkbox no tiene que perder el scroll ni el foco de
      // quien lo está haciendo, que es justo lo que pasa si se llama a
      // renderGroup en cada cambio.
      function pintarResumen() {
        var hint = splitEditor.querySelector('.grupo-split__hint');
        var expense = expenseById(editandoSplit.expenseId);
        if (!hint || !expense) return;
        var n = editandoSplit.ids.length;
        hint.textContent = n === 0
          ? 'No está dividido entre nadie todavía.'
          : n === 1
            ? 'Solo se le carga a ' + participantName(editandoSplit.ids[0]) + ': el resto no debe nada de este gasto.'
            : 'Entre ' + splitNamesText(editandoSplit.ids) + ': ' + moneyVer(Number(expense.amount) / n, expense.currency) + ' c/u.';
      }
      // La selección vive en editandoSplit, no en los inputs: el poll repinta
      // cada 12s y los checkboxes se voltarían de lo elegido.
      splitEditor.addEventListener('change', function (e) {
        if (!e.target.matches('[data-split-edit]')) return;
        editandoSplit.ids = editorIds();
        pintarResumen();
      });
      var allButton = splitEditor.querySelector('[data-split-all]');
      if (allButton) allButton.addEventListener('click', function () {
        editandoSplit.ids = participants.map(function (p) { return p.id; });
        // Marcar todos ya está guardado en el estado: se repintan los
        // checkboxes y el resumen, no la página entera.
        Array.prototype.slice.call(splitEditor.querySelectorAll('[data-split-edit]')).forEach(function (input) {
          input.checked = true;
        });
        pintarResumen();
      });
      var cancelButton = splitEditor.querySelector('[data-split-cancel]');
      if (cancelButton) cancelButton.addEventListener('click', function () { editandoSplit = null; renderGroup(groupId); });
      var saveButton = splitEditor.querySelector('[data-split-save]');
      if (saveButton) saveButton.addEventListener('click', async function () {
        var ids = editorIds();
        // Nadie es dueño de un gasto sin reparto: sin esto se guardaría una
        // fila que no genera deuda y el total dejaría de cerrar con la lista.
        if (!ids.length) { window.alert('Elegí al menos una persona para dividir.'); return; }
        var expenseId = editandoSplit.expenseId;
        var restoringScroll = window.scrollY || window.pageYOffset || 0;
        editandoSplit.guardando = true;
        renderGroup(groupId);
        try {
          var result = await supabaseClient.from('gastos').update({ split_between: ids }).eq('id', expenseId);
          if (result.error) throw new Error(result.error.message);
          editandoSplit = null;
          await loadGroupData(groupId);
          renderGroup(groupId);
          window.scrollTo(0, restoringScroll);
        } catch (error) {
          // Se deja el editor abierto con lo que la persona había marcado, para
          // que pueda reintentar sin volver a elegir todo desde cero.
          editandoSplit.guardando = false;
          renderGroup(groupId);
          window.scrollTo(0, restoringScroll);
          window.alert(error.message || 'No pudimos cambiar la división.');
        }
      });
    }

    Array.prototype.forEach.call(app.querySelectorAll('[data-delete-expense]'), function (deleteButton) {
      deleteButton.addEventListener('click', async function () {
        var expense = expenseById(deleteButton.getAttribute('data-delete-expense'));
        // El botón no se pinta si no corresponde, pero el chequeo va igual: es
        // una regla de permisos y no tiene que depender de que el marcado se
        // haya generado bien.
        if (!puedeBorrarGasto(expense)) return;
        if (!window.confirm('¿Borrar este gasto?')) return;
        deleteButton.disabled = true;
        try {
          var result = await supabaseClient.from('gastos').delete().eq('id', deleteButton.getAttribute('data-delete-expense'));
          if (result.error) throw new Error(result.error.message);
          await loadGroupData(groupId);
          renderGroup(groupId);
        } catch (error) {
          deleteButton.disabled = false;
          window.alert(error.message || 'No pudimos borrar el gasto.');
        }
      });
    });
    startPolling(groupId);
  }

  // Copia el mensaje completo (con el nombre del viaje adentro) y avisa con un
  // tooltip, así se ve que salió sin tener que leer el texto de estado.
  function copyShareText(url) {
    var status = document.getElementById('copy-status');
    var toast = document.getElementById('copy-toast');
    var text = shareMessage();
    var write = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error('sin portapapeles'));
    write.then(function () {
      if (toast) {
        toast.hidden = false;
        setTimeout(function () { if (toast) toast.hidden = true; }, 1800);
      }
      if (status) status.textContent = 'Ya está en el portapapeles, con el nombre del viaje.';
    }).catch(function () {
      if (status) status.textContent = 'Copiá el link manualmente: ' + url;
    });
  }

  // La página es compartida: si el otro suma un gasto mientras tenés el
  // formulario abierto, el poll lo trae sin que tengas que recargar a mano.
  function startPolling(groupId) {
    stopPolling();
    pollTimer = setInterval(function () {
      if (document.hidden || !me) return;
      loadGroupData(groupId).then(function () { refreshIfChanged(groupId); }).catch(function () {});
    }, POLL_MS);
  }
  // Sólo se repinta si los datos de la pantalla cambiaron. Además se espera a
  // que el usuario no esté escribiendo: si llega un gasto ajeno mientras carga
  // el suyo, se le borraría el formulario a medio llenar.
  function refreshIfChanged(groupId) {
    if (dataSignature() === lastSignature) return;
    var active = document.activeElement;
    if (active && active.form && app.contains(active)) return;
    renderGroup(groupId);
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  // Al volver a la pestaña siempre hay una lectura fresca: el poll puede
  // haberse comido varios minutos con la app en segundo plano.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !currentGroupId || !me) return;
    loadGroupData(currentGroupId).then(function () { refreshIfChanged(currentGroupId); }).catch(function () {});
  });

  async function loadGroupData(groupId) {
    var groupResult = await supabaseClient.from('grupos_viaje').select('*').eq('id', groupId).maybeSingle();
    if (groupResult.error || !groupResult.data) throw new Error('No encontramos este grupo. Revisá el link.');
    group = groupResult.data;
    var participantsResult = await supabaseClient.from('participantes').select('*').eq('grupo_id', groupId).order('joined_at', { ascending: true });
    participants = participantsResult.data || [];
    var expensesResult = await supabaseClient.from('gastos').select('*').eq('grupo_id', groupId).order('created_at', { ascending: false });
    expenses = expensesResult.data || [];
    var rememberedId = rememberedParticipantId(groupId);
    me = participants.find(function (p) { return p.id === rememberedId; })
      // Compatibilidad con quienes ya se habían sumado antes de este cambio,
      // cuando "quién soy" todavía se resolvía por device_id.
      || participants.find(function (p) { return p.device_id === deviceId(); })
      || null;
    await soportaCuentas();
    await soportaAgregadoPor();
    await vincularCuenta(groupId);
    if (me) rememberParticipant(groupId, me.id);
    // Los grupos creados antes de que la marca guardara el monto tienen
    // ["quien|quien"] en vez de {"quien|quien": monto}. Esos pagos existen, así
    // que se completan con el importe que tenía la transferencia y se guardan
    // una sola vez: si no, cada gasto nuevo volvía a saldar esa pareja solo.
    // Va después de cargar participantes y gastos porque migrarSaldos() necesita
    // los dos para saber cuánto se había pagado.
    await migrarSaldos(groupId);
  }

  // Escribe el formato nuevo una vez por carga de página. Si el guardado falla
  // no se reintenta en cada poll: la pantalla igual muestra los pagos bien
  // (saldosSaldados() los resuelve en memoria) y en el próximo poll se vuelve a
  // intentar sin joder a nadie con un error.
  async function migrarSaldos(groupId) {
    if (migracionIntentada) return;
    migracionIntentada = true;
    var migrado = migrarSaldosPlan();
    if (!migrado) return;
    try {
      var result = await supabaseClient.from('grupos_viaje').update({ saldos: migrado }).eq('id', groupId);
      if (!result.error) group.saldos = migrado;
    } catch (error) {
      // Sin migrar: la página funciona igual, solo que el próximo render vuelve
      // a calcular el formato viejo en memoria.
    }
  }

  async function init() {
    var groupId = groupIdFromPath();
    try {
      await loadSupabaseSdk();
      await loadAuthUser();
      if (!groupId) {
        renderCreateForm();
        // El formulario se pinta ya, sin esperar el lookup de la sesión: el
        // nombre se completa solo un instante después si hay sesión abierta.
        // El chequeo de !input.value evita pisar lo que la persona ya empiece
        // a escribir mientras espera.
        loadNameFromSession().then(function (name) {
          nameFromAuth = name;
          var input = document.querySelector('#create-form [name="yourName"]');
          if (name && input && !input.value.trim()) input.value = name;
        });
        return;
      }
      // Las tasas se piden antes de pintar: sin ellas no hay conversión y el
      // formulario se caería a la moneda del grupo. Si el fetch falla, el
      // grupo sigue entrando igual (cargarTasas no propaga el error).
      await cargarTasas();
      verEn = verEnGuardado();
      await loadGroupData(groupId);
      if (!me) { renderJoinForm(groupId); return; }
      renderGroup(groupId);
    } catch (error) {
      stopPolling();
      render('<div class="grupo-card"><h1>No pudimos cargar el grupo</h1><p class="grupo-error">' + esc(error.message || 'Error desconocido.') + '</p><p class="grupo-note"><a href="/grupo">Crear un grupo nuevo →</a></p></div>');
    }
  }
  init();
})();
