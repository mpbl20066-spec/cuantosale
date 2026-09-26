(function () {
  'use strict';
  var app = document.getElementById('grupo-app');
  var supabaseClient = null;
  var group = null;
  var participants = [];
  var expenses = [];
  var me = null; // fila de "participantes" que corresponde a este dispositivo
  var currentGroupId = null;
  var pollTimer = null;
  var lastSignature = '';
  // Tasas de /api/tasas, iguais a las que usa la home. Si no llegan, el grupo
  // entero se muestra en su moneda y no se ofrece cambiar.
  var FX = { rates: null, base: 'USD', monedas: null };
  // Moneda en la que se ve toda la página. Vacío = la del grupo.
  var verEn = '';
  var nameDraft = null; // nombre del viaje precargado desde la app
  var nameFromAuth = ''; // nombre del usuario logueado, para no pedirlo de nuevo
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
  function categorySymbol(code) {
    var symbols = { USD: 'US$', BRL: 'R$', UYU: '$', ARS: '$', EUR: '€', GBP: '£', MXN: '$', CLP: '$', COP: '$' };
    var normalized = String(code || 'USD').toUpperCase();
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
    if (!code || !FX.rates) return null;
    var normalized = String(code).toUpperCase();
    if (normalized === FX.base) return 1;
    var rate = Number(FX.rates[normalized]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }
  // Pasa un importe de una moneda a otra. Devuelve null si falta alguna de las
  // dos tasas: prefierimos no convertir antes que inventar un número.
  function convertir(amount, from, to) {
    var a = tasaDe(from), b = tasaDe(to);
    if (a == null || b == null) return null;
    return (Number(amount) || 0) * (b / a);
  }
  // La moneda en la que se está mostrando. Si no hay tasas, o la elegida no
  // tiene, se cae en la del grupo en vez de dejar un número sin unidad.
  function verMoneda() {
    if (verEn && tasaDe(verEn) != null) return verEn;
    return groupCurrency();
  }
  // Un importe cualquiera, ya expresado en la moneda en la que se ve. Las
  // tasas se piden para que "Ver en" funcione; sin ellas cae al importe tal
  // cual came, que es lo correcto porque en ese caso todos están en la misma.
  function moneyVer(n, code) {
    var target = verMoneda();
    var value = convertir(n, code || groupCurrency(), target);
    return money(value == null ? n : value, target);
  }
  // Los balances y las transferencias se calculan siempre en la moneda del
  // grupo: es la única forma de que sumar gastos cargados en distintas monedas
  // signifique algo.
  function aMonedaGrupo(n, code) {
    var value = convertir(n, code, groupCurrency());
    return value == null ? (Number(n) || 0) : value;
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
      '<label class="grupo-field">Tu nombre<input required name="yourName" placeholder="Ej: Bruno" maxlength="40" value="' + esc(nameFromAuth) + '"></label>' +
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
      form.querySelector('button').disabled = true;
      try {
        await loadSupabaseSdk();
        var groupResult = await supabaseClient.from('grupos_viaje').insert({ name: groupName }).select().single();
        if (groupResult.error) throw new Error(groupResult.error.message);
        var participantResult = await supabaseClient.from('participantes').insert({ grupo_id: groupResult.data.id, display_name: yourName, device_id: deviceId() }).select().single();
        if (participantResult.error) throw new Error(participantResult.error.message);
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
      ? '<p class="grupo-note" style="margin-top:18px">¿Quién sos?</p><div class="grupo-participants" id="join-existing">' +
        participants.map(function (p) { return '<button type="button" class="grupo-chip" data-claim-participant="' + esc(p.id) + '">' + esc(p.display_name) + '</button>'; }).join('') +
        '</div>'
      : '<p class="grupo-note" style="margin-top:18px">Todavía no hay nadie en este grupo. Sé el primero:</p>';
    render(
      '<div class="grupo-card"><h1>' + esc(group.name) + '</h1>' +
      '<p class="grupo-sub">Te compartieron el link de este viaje. Elegí tu nombre para empezar a cargar los gastos.</p>' +
      (errorMessage ? '<p class="grupo-error">' + esc(errorMessage) + '</p>' : '') +
      existingMarkup +
      (participants.length && !showAddForm
        ? '<button type="button" class="grupo-btn grupo-btn--ghost" id="join-not-listed" style="width:100%;margin-top:14px">No estoy en la lista / Agregarme</button>'
        : '<form id="join-form"><label class="grupo-field">Tu nombre<input required name="yourName" placeholder="¿Cómo te llamás?" maxlength="40"></label>' +
          '<button type="submit" class="grupo-btn grupo-btn--primary">Sumarme al grupo</button></form>') +
      '</div>'
    );
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
        var result = await supabaseClient.from('participantes').insert({ grupo_id: groupId, display_name: yourName, device_id: deviceId() }).select().single();
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
  function computeBalances() {
    var balances = {};
    participants.forEach(function (p) { balances[p.id] = 0; });
    expenses.forEach(function (expense) {
      var splitIds = splitIdsOf(expense);
      if (!splitIds.length) return; // gasto sin participantes válidos: no genera deuda
      // Todo se lleva a la moneda del grupo antes de sumar: un gasto cargado en
      // reales y otro en dólares no se pueden sumar así nomás.
      var total = aMonedaGrupo(expense.amount, expense.currency);
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
  function totalSpent() { return expenses.reduce(function (sum, expense) { return sum + aMonedaGrupo(expense.amount, expense.currency); }, 0); }

  /* ---------- saldos pagados ---------- */
  function saldosGuardados() {
    return Array.isArray(group && group.saldos) ? group.saldos : [];
  }
  // La clave es el par, no el importe: el greedy recalcula los montos cada vez
  // que se toca un gasto, así que una marca atada al número se perdería.
  function saldoKey(move) { return move.from + '|' + move.to; }
  function saldoEstaPagado(move) { return saldosGuardados().indexOf(saldoKey(move)) !== -1; }
  function alternarSaldo(key) {
    var next = saldosGuardados().slice();
    var i = next.indexOf(key);
    if (i === -1) next.push(key); else next.splice(i, 1);
    return next;
  }
  // Firma de los datos que pinta la pantalla. El poll la compara para no
  // repintar (y borrar lo que el usuario está escribiendo) si nada cambió.
  function dataSignature() {
    return [group && group.name, participants.map(function (p) { return p.id + ':' + p.display_name; }).join(','),
      expenses.map(function (e) { return e.id + ':' + e.amount + ':' + e.currency + ':' + e.description + ':' + e.paid_by_participante_id + ':' + splitIdsOf(e).join('+'); }).join(','),
      // Los saldos pagados van en la firma: si no, el poll vería la pantalla
      // igual y no repintaría el tilde que el usuario acaba de poner.
      saldosGuardados().slice().sort().join(',')
    ].join('|');
  }

  function renderGroup(groupId) {
    currentGroupId = groupId;
    syncDocumentTitle();
    lastSignature = dataSignature();
    var url = shareUrl();
    var currency = groupCurrency();
    var balances = computeBalances();
    var moves = settlements(balances);
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
    var verEnMarkup = disponibles.length
      ? '<span class="grupo-veren"><span class="grupo-veren__label">Ver en</span>' +
        '<select class="grupo-veren__sel" aria-label="Moneda para ver los montos">' +
        '<option value="">' + esc(currency) + ' (del grupo)</option>' +
        disponibles.filter(function (m) { return m.code !== currency; }).map(function (m) {
          return '<option value="' + esc(m.code) + '"' + (verEn === m.code ? ' selected' : '') + '>' + esc(m.code) + '</option>';
        }).join('') +
        '</select></span>'
      : '';
    var expensesMarkup = expenses.length
      ? expenses.map(function (expense) {
          // "dividido entre 3" no dice quiénes. Con los nombres al lado, cada
          // quien puede revisar su parte sin tener que hacer la cuenta mental.
          var splitIds = splitIdsOf(expense);
          var canDelete = !me || expense.paid_by_participante_id === me.id;
          return '<div class="grupo-expense">' +
            '<div class="grupo-expense__main">' +
            '<span class="grupo-expense__ico">' + icon(guessCategory(expense.description)) + '</span>' +
            '<div class="grupo-expense__body">' +
            '<div class="grupo-expense__name">' + esc(expense.description) + '</div>' +
            '<div class="grupo-expense__meta">Pagó ' + esc(participantName(expense.paid_by_participante_id)) + '</div>' +
            '<div class="grupo-expense__meta">Entre ' + (splitIds.length === 1 ? '1 persona' : splitIds.length + ' personas') +
            (splitIds.length ? ': ' + esc(moneyVer(Number(expense.amount) / splitIds.length, expense.currency)) + ' c/u' : '') + '</div>' +
            '</div></div>' +
            '<div class="grupo-expense__right"><span class="grupo-expense__amount">' + esc(moneyVer(expense.amount, expense.currency)) + '</span>' +
            (canDelete ? '<button type="button" class="grupo-trash" data-delete-expense="' + esc(expense.id) + '" aria-label="Borrar ' + esc(expense.description) + '">' + icon('trash') + '</button>' : '') +
            '</div></div>';
        }).join('')
      : '<p class="grupo-note" style="margin-top:0">Todavía no hay gastos cargados.</p>';
    // El saldo por persona contesta la pregunta que aparece primero ("¿cuánto
    // puse yo?") sin obligar a hacer la resta de los movimientos de abajo.
    var balancesSummary = expenses.length
      ? participants.map(function (p) {
          var value = Math.round((balances[p.id] || 0) * 100) / 100;
          var label = Math.abs(value) < 0.01
            ? '<b class="pos">al día</b>'
            : '<b class="' + (value > 0 ? 'pos' : 'neg') + '">' + (value > 0 ? 'le deben ' : 'debe ') + esc(moneyVer(Math.abs(value), currency)) + '</b>';
          return '<div class="grupo-balance"><span>' + esc(p.display_name) + '</span>' + label + '</div>';
        }).join('')
      : '';
    // Cada transferencia trae su botón de "Ya pagué". Se marca por par (from|to)
    // y no por importe, porque el greedy vuelve a calcular los montos cada vez
    // que se toca un gasto.
    var pendientes = moves.filter(function (move) { return !saldoEstaPagado(move); }).length;
    var balancesMarkup = moves.length
      ? moves.map(function (move) {
          var pagado = saldoEstaPagado(move);
          var key = saldoKey(move);
          return '<div class="grupo-settle' + (pagado ? ' is-paid' : '') + '">' +
            '<span class="grupo-settle__flow"><b>' + esc(participantName(move.from)) + '</b>' +
            '<span class="grupo-settle__arrow" aria-hidden="true">' + icon('arrow') + '</span>' +
            '<b>' + esc(participantName(move.to)) + '</b></span>' +
            '<span class="grupo-settle__amount">' + esc(moneyVer(move.amount, currency)) + '</span>' +
            '<button type="button" class="grupo-settledon" data-saldo="' + esc(key) + '" aria-pressed="' + (pagado ? 'true' : 'false') + '">' +
            '<span class="grupo-settledon__box" aria-hidden="true">' + (pagado ? '✓' : '') + '</span>' +
            (pagado ? 'Pagado' : 'Ya pagué') + '</button></div>';
        }).join('')
      : '<p class="grupo-note">Las cuentas están saldadas.</p>';
    // Cuando no queda ninguna transferencia pendiente se dice explícitamente:
    // es la pregunta que todos hacen al final del viaje y "no hay nada para
    // pagar" no contesta nada.
    var alDiaMarkup = moves.length && !pendientes
      ? '<div class="grupo-allday">' + icon('check') + '<span>Están todos al día. No queda nada por pagar.</span></div>'
      : '';

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

      '<div class="grupo-card"><h2 style="margin-bottom:18px">Agregar gasto</h2><form id="expense-form">' +
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
      (verEnMarkup && disponibles.length > 1 ? verEnMarkup : '') + '</div>' +

      '<div class="grupo-card"><h2>Cómo se salda</h2>' +
      (balancesSummary ? '<div class="grupo-subhead">Saldo de cada uno</div>' + balancesSummary : '') +
      (moves.length ? '<div class="grupo-subhead">Transferencias</div>' + balancesMarkup : balancesMarkup) +
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
        var result = await supabaseClient.from('gastos').insert({
          grupo_id: groupId, paid_by_participante_id: form.paidBy.value, description: description,
          amount: amount, currency: groupCurrency(), split_between: splitIds
        });
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

    Array.prototype.forEach.call(app.querySelectorAll('[data-delete-expense]'), function (deleteButton) {
      deleteButton.addEventListener('click', async function () {
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
    if (me) rememberParticipant(groupId, me.id);
  }

  async function init() {
    var groupId = groupIdFromPath();
    try {
      await loadSupabaseSdk();
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
