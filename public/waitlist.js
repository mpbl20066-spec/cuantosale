(function () {
  'use strict';
  var app = document.getElementById('waitlist-app');
  var supabaseClient = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function refCodeFromUrl() {
    var match = window.location.search.match(/[?&]ref=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
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

  function renderForm(count, errorMessage) {
    var countMarkup = Number.isFinite(count) ? '<p class="wl-count"><b>' + count + '</b> ' + (count === 1 ? 'persona ya está anotada' : 'personas ya están anotadas') + '</p>' : '';
    render(
      '<div class="wl-card">' +
      '<h1>Sé de los primeros en usar CuántoSale</h1>' +
      '<p class="wl-sub">Dejanos tu email y te avisamos apenas esté listo. Invitá a tus amigos con tu link y subí en la lista.</p>' +
      (errorMessage ? '<p class="wl-error">' + esc(errorMessage) + '</p>' : '') +
      '<form id="waitlist-form">' +
      '<label class="wl-field"><input required type="email" name="email" placeholder="tu@email.com" autocomplete="email"></label>' +
      '<button type="submit" class="wl-btn">Anotarme</button>' +
      '</form>' + countMarkup +
      '</div>'
    );
    document.getElementById('waitlist-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var form = e.target;
      var email = form.email.value.trim();
      if (!email) return;
      var button = form.querySelector('button');
      button.disabled = true; button.textContent = 'Anotando...';
      try {
        var refCode = refCodeFromUrl();
        var result = await supabaseClient.rpc('waitlist_signup', { p_email: email, p_ref_code: refCode || null });
        if (result.error) throw new Error(result.error.message || 'No pudimos anotarte.');
        var row = Array.isArray(result.data) ? result.data[0] : result.data;
        if (!row) throw new Error('No pudimos anotarte.');
        renderConfirmation(row.out_position, row.out_referral_code, row.out_invited_count);
      } catch (error) {
        var freshCount = await fetchCount();
        renderForm(freshCount, error.message || 'No pudimos anotarte. Probá de nuevo.');
      }
    });
  }

  function renderConfirmation(position, referralCode, invitedCount) {
    var shareUrl = window.location.origin + '/waitlist?ref=' + encodeURIComponent(referralCode);
    render(
      '<div class="wl-card">' +
      '<p class="wl-confirm-label">Tu lugar en la lista</p>' +
      '<div class="wl-confirm-position">#' + esc(position) + '</div>' +
      '<p class="wl-sub" style="text-align:center;margin-bottom:18px">Compartí tu link y subí de posición cada vez que alguien se anota con él.</p>' +
      '<div class="wl-share"><input readonly value="' + esc(shareUrl) + '" id="share-url"><button type="button" id="copy-share">Copiar</button></div>' +
      '<p class="wl-status" id="copy-status" aria-live="polite"></p>' +
      '<div class="wl-stat"><span>Amigos invitados</span><b>' + esc(invitedCount) + '</b></div>' +
      '</div>'
    );
    document.getElementById('copy-share').addEventListener('click', function () {
      var status = document.getElementById('copy-status');
      var copyPromise = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(shareUrl) : Promise.reject(new Error('sin portapapeles'));
      copyPromise.then(function () { status.textContent = 'Link copiado ✓'; }).catch(function () { status.textContent = 'Copiá el link manualmente: ' + shareUrl; });
    });
  }

  async function fetchCount() {
    try {
      var result = await supabaseClient.rpc('waitlist_count');
      return result.error ? NaN : Number(result.data);
    } catch (error) { return NaN; }
  }

  async function init() {
    try {
      await loadSupabaseSdk();
      var count = await fetchCount();
      renderForm(count);
    } catch (error) {
      render('<div class="wl-card"><h1>No pudimos cargar la waitlist</h1><p class="wl-error">' + esc(error.message || 'Error desconocido.') + '</p></div>');
    }
  }
  init();
})();
