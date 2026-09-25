(function () {
  'use strict';
  var app = document.getElementById('grupo-app');
  var supabaseClient = null;
  var group = null;
  var participants = [];
  var expenses = [];
  var me = null; // fila de "participantes" que corresponde a este dispositivo

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return 'US$ ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
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

  async function loadSupabaseSdk() {
    if (window.supabase && window.supabase.createClient) return;
    var config = await fetch('/api/config').then(function (r) { return r.json(); });
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Falta configurar Supabase en el servidor.');
    await new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = function () { reject(new Error('No pudimos cargar Supabase.')); };
      document.head.appendChild(script);
    });
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  function render(html) { app.innerHTML = html; }

  function renderCreateForm(errorMessage) {
    render(
      '<div class="grupo-card"><h1>Dividí los gastos del viaje</h1>' +
      '<p class="grupo-note">Creá un grupo, compartí el link con tus amigos y cada uno puede sumar sus gastos. No hace falta iniciar sesión.</p>' +
      (errorMessage ? '<p class="grupo-error">' + esc(errorMessage) + '</p>' : '') +
      '<form id="create-form">' +
      '<label class="grupo-field">Nombre del viaje o grupo<input required name="groupName" placeholder="Ej: Finde en Florianópolis" maxlength="80"></label>' +
      '<label class="grupo-field">Tu nombre<input required name="yourName" placeholder="Ej: Bruno" maxlength="40"></label>' +
      '<button type="submit" class="grupo-btn">Crear grupo y obtener link</button>' +
      '</form></div>'
    );
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
        window.location.href = '/grupo/' + groupResult.data.id;
      } catch (error) {
        renderCreateForm(error.message || 'No pudimos crear el grupo.');
      }
    });
  }

  function renderJoinForm(groupId, errorMessage) {
    render(
      '<div class="grupo-card"><h1>' + esc(group.name) + '</h1>' +
      '<p class="grupo-note">Sumate a este grupo para agregar y ver los gastos compartidos.</p>' +
      (errorMessage ? '<p class="grupo-error">' + esc(errorMessage) + '</p>' : '') +
      '<form id="join-form">' +
      '<label class="grupo-field">Tu nombre<input required name="yourName" placeholder="¿Cómo te llamás?" maxlength="40"></label>' +
      '<button type="submit" class="grupo-btn">Sumarme al grupo</button>' +
      '</form></div>'
    );
    document.getElementById('join-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var yourName = e.target.yourName.value.trim();
      if (!yourName) return;
      e.target.querySelector('button').disabled = true;
      try {
        var result = await supabaseClient.from('participantes').insert({ grupo_id: groupId, display_name: yourName, device_id: deviceId() }).select().single();
        if (result.error) throw new Error(result.error.message);
        me = result.data;
        await loadGroupData(groupId);
        renderGroup(groupId);
      } catch (error) {
        renderJoinForm(groupId, error.message || 'No pudimos sumarte al grupo.');
      }
    });
  }

  function computeBalances() {
    var balances = {};
    participants.forEach(function (p) { balances[p.id] = 0; });
    expenses.forEach(function (expense) {
      var share = Number(expense.amount) / Math.max(1, expense.split_between.length);
      balances[expense.paid_by_participante_id] = (balances[expense.paid_by_participante_id] || 0) + Number(expense.amount);
      expense.split_between.forEach(function (participantId) { balances[participantId] = (balances[participantId] || 0) - share; });
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
  function participantName(id) { var p = participants.find(function (item) { return item.id === id; }); return p ? p.display_name : 'Alguien'; }

  function renderGroup(groupId) {
    var shareUrl = window.location.origin + '/grupo/' + groupId;
    var balances = computeBalances();
    var moves = settlements(balances);
    var checksMarkup = participants.map(function (p) { return '<label><input type="checkbox" name="split" value="' + esc(p.id) + '" checked> ' + esc(p.display_name) + '</label>'; }).join('');
    var payerOptionsMarkup = participants.map(function (p) { return '<option value="' + esc(p.id) + '"' + (me && p.id === me.id ? ' selected' : '') + '>' + esc(p.display_name) + '</option>'; }).join('');
    var expensesMarkup = expenses.length
      ? expenses.map(function (expense) {
          return '<div class="grupo-expense"><div><b>' + esc(expense.description) + '</b><small>Pagó ' + esc(participantName(expense.paid_by_participante_id)) + ' · dividido entre ' + expense.split_between.length + '</small></div>' +
            '<div style="text-align:right"><b>' + money(expense.amount) + '</b><br><button type="button" class="grupo-btn--danger" data-delete-expense="' + esc(expense.id) + '">Borrar</button></div></div>';
        }).join('')
      : '<p class="grupo-note">Todavía no hay gastos cargados.</p>';
    var balancesMarkup = moves.length
      ? moves.map(function (move) { return '<div class="grupo-balance"><span>' + esc(participantName(move.from)) + ' → ' + esc(participantName(move.to)) + '</span><b class="neg">' + money(move.amount) + '</b></div>'; }).join('')
      : '<p class="grupo-note">Las cuentas están saldadas.</p>';

    render(
      '<div class="grupo-card"><h1>' + esc(group.name) + '</h1>' +
      '<div class="grupo-share"><input readonly value="' + esc(shareUrl) + '" id="share-url"><button type="button" class="grupo-btn" id="copy-share">Copiar link</button></div>' +
      '<p class="grupo-note" id="copy-status" aria-live="polite"></p>' +
      '<div class="grupo-participants">' + participants.map(function (p) { return '<span class="grupo-chip">' + esc(p.display_name) + (me && p.id === me.id ? ' (vos)' : '') + '</span>'; }).join('') + '</div>' +
      '<form id="add-participant-form" style="display:flex;gap:8px;margin-top:10px">' +
      '<input name="participantName" placeholder="Nombre de otro amigo" maxlength="40" style="flex:1;min-width:0;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink)">' +
      '<button type="submit" class="grupo-btn" style="width:auto;white-space:nowrap">+ Agregar</button></form></div>' +

      '<div class="grupo-card"><h2>Agregar gasto</h2><form id="expense-form">' +
      '<label class="grupo-field">Descripción<input required name="description" placeholder="Ej: Supermercado" maxlength="80"></label>' +
      '<label class="grupo-field">Monto (' + esc(group.currency || 'USD') + ')<input required name="amount" type="number" min="0.01" step="0.01" placeholder="0.00"></label>' +
      '<label class="grupo-field">¿Quién pagó?<select name="paidBy">' + payerOptionsMarkup + '</select></label>' +
      '<span class="grupo-field">¿Entre quiénes se divide?<span class="grupo-checks">' + checksMarkup + '</span></span>' +
      '<button type="submit" class="grupo-btn">Agregar gasto</button></form></div>' +

      '<div class="grupo-card"><h2>Gastos (' + expenses.length + ')</h2>' + expensesMarkup + '</div>' +
      '<div class="grupo-card"><h2>Cómo se salda</h2>' + balancesMarkup + '</div>'
    );

    document.getElementById('add-participant-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var form = e.target;
      var name = form.participantName.value.trim();
      if (!name) return;
      var button = form.querySelector('button');
      button.disabled = true;
      try {
        // Sumado a mano por otro participante: no tiene navegador propio en
        // el grupo, así que le asignamos un device_id sintético en vez de
        // exigirle que abra el link para anotarse.
        var syntheticDeviceId = 'manual-' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
        var result = await supabaseClient.from('participantes').insert({ grupo_id: groupId, display_name: name, device_id: syntheticDeviceId });
        if (result.error) throw new Error(result.error.message);
        await loadGroupData(groupId);
        renderGroup(groupId);
      } catch (error) {
        button.disabled = false;
        alert(error.message || 'No pudimos agregar al participante.');
      }
    });
    document.getElementById('copy-share').addEventListener('click', function () {
      var status = document.getElementById('copy-status');
      var copyPromise = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(shareUrl) : Promise.reject(new Error('sin portapapeles'));
      copyPromise.then(function () { status.textContent = 'Link copiado ✓'; }).catch(function () { status.textContent = 'Copiá el link manualmente: ' + shareUrl; });
    });
    document.getElementById('expense-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var form = e.target;
      var splitIds = Array.prototype.slice.call(form.querySelectorAll('input[name="split"]:checked')).map(function (input) { return input.value; });
      if (!splitIds.length) return;
      var amount = Number(form.amount.value);
      if (!(amount > 0)) return;
      form.querySelector('button').disabled = true;
      try {
        var result = await supabaseClient.from('gastos').insert({
          grupo_id: groupId, paid_by_participante_id: form.paidBy.value, description: form.description.value.trim(),
          amount: amount, currency: group.currency || 'USD', split_between: splitIds
        });
        if (result.error) throw new Error(result.error.message);
        await loadGroupData(groupId);
        renderGroup(groupId);
      } catch (error) {
        form.querySelector('button').disabled = false;
        alert(error.message || 'No pudimos agregar el gasto.');
      }
    });
    app.addEventListener('click', function onClick(e) {
      var deleteButton = e.target.closest('[data-delete-expense]');
      if (!deleteButton) return;
      app.removeEventListener('click', onClick);
      (async function () {
        if (!window.confirm('¿Borrar este gasto?')) { app.addEventListener('click', onClick); return; }
        await supabaseClient.from('gastos').delete().eq('id', deleteButton.getAttribute('data-delete-expense'));
        await loadGroupData(groupId);
        renderGroup(groupId);
      }());
    });
  }

  async function loadGroupData(groupId) {
    var groupResult = await supabaseClient.from('grupos_viaje').select('*').eq('id', groupId).maybeSingle();
    if (groupResult.error || !groupResult.data) throw new Error('No encontramos este grupo. Revisá el link.');
    group = groupResult.data;
    var participantsResult = await supabaseClient.from('participantes').select('*').eq('grupo_id', groupId).order('joined_at', { ascending: true });
    participants = participantsResult.data || [];
    var expensesResult = await supabaseClient.from('gastos').select('*').eq('grupo_id', groupId).order('created_at', { ascending: false });
    expenses = expensesResult.data || [];
    me = participants.find(function (p) { return p.device_id === deviceId(); }) || null;
  }

  async function init() {
    var groupId = groupIdFromPath();
    try {
      await loadSupabaseSdk();
      if (!groupId) { renderCreateForm(); return; }
      await loadGroupData(groupId);
      if (!me) { renderJoinForm(groupId); return; }
      renderGroup(groupId);
    } catch (error) {
      render('<div class="grupo-card"><h1>No pudimos cargar el grupo</h1><p class="grupo-error">' + esc(error.message || 'Error desconocido.') + '</p><p class="grupo-note"><a href="/grupo">Crear un grupo nuevo →</a></p></div>');
    }
  }
  init();
})();
