(function () {
  'use strict';
  var app = document.getElementById('waitlist-app');
  var supabaseClient = null;
  var sdkPromise = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function refCodeFromUrl() {
    var match = window.location.search.match(/[?&]ref=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  // Memoizada: si el submit llega antes de que termine de cargar el SDK,
  // reusa la misma promesa en vez de disparar la carga de nuevo.
  function loadSupabaseSdk() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = (async function () {
      var config = await fetch('/api/config').then(function (r) { return r.json(); });
      if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Falta configurar Supabase en el servidor.');
      if (!(window.supabase && window.supabase.createClient)) {
        await new Promise(function (resolve, reject) {
          var script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          script.onload = resolve;
          script.onerror = function () { reject(new Error('No pudimos cargar Supabase.')); };
          document.head.appendChild(script);
        });
      }
      supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    })();
    return sdkPromise;
  }

  function render(html) { app.innerHTML = html; }

  // Muestra el formulario al toque, sin esperar red: el contador se completa
  // después en paralelo y solo parchea su propio <span>, sin re-renderizar
  // el formulario (así no se pierde lo que el usuario ya tipeó).
  function renderForm(errorMessage) {
    render(
      '<div class="wl-card">' +
      '<h1>Sé de los primeros en usar CuántoSale</h1>' +
      '<p class="wl-sub">La plataforma definitiva para organizar y dividir viajes con amigos en Uruguay. Dejanos tu email y entrá antes que nadie.</p>' +
      (errorMessage ? '<p class="wl-error">' + esc(errorMessage) + '</p>' : '') +
      '<form id="waitlist-form">' +
      '<label class="wl-field"><input required type="email" name="email" placeholder="tu@email.com" autocomplete="email"></label>' +
      '<button type="submit" class="wl-btn">Quiero unirme al acceso anticipado</button>' +
      '</form>' +
      '<p class="wl-urgency" id="wl-count-line" hidden></p>' +
      '</div>'
    );
    document.getElementById('waitlist-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var form = e.target;
      var email = form.email.value.trim();
      if (!email) return;
      var button = form.querySelector('button');
      var originalLabel = button.textContent;
      button.disabled = true; button.textContent = 'Anotando...';
      try {
        await loadSupabaseSdk();
        var refCode = refCodeFromUrl();
        var result = await supabaseClient.rpc('waitlist_signup', { p_email: email, p_ref_code: refCode || null });
        if (result.error) throw new Error(result.error.message || 'No pudimos anotarte.');
        var row = Array.isArray(result.data) ? result.data[0] : result.data;
        if (!row) throw new Error('No pudimos anotarte.');
        renderConfirmation(row.out_position, row.out_referral_code, row.out_invited_count);
      } catch (error) {
        button.disabled = false; button.textContent = originalLabel;
        renderForm(error.message || 'No pudimos anotarte. Probá de nuevo.');
      }
    });
    fillCount();
  }

  // Prueba social con el conteo real (nunca un número inventado): funciona
  // igual de bien recién arrancada la waitlist que con miles de anotados.
  async function fillCount() {
    var line = document.getElementById('wl-count-line');
    try {
      await loadSupabaseSdk();
      var result = await supabaseClient.rpc('waitlist_count');
      var count = result.error ? NaN : Number(result.data);
      if (!Number.isFinite(count) || !line) return;
      line.hidden = false;
      line.innerHTML = '⚠️ Cupos limitados para la beta. <b>' + count + '</b> ' + (count === 1 ? 'viajero ya se anotó' : 'viajeros ya se anotaron') + ' — sumate antes de que se llenen.';
    } catch (error) { /* sin contador no se rompe el formulario */ }
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

  function init() {
    renderForm();
    loadSupabaseSdk().catch(function (error) {
      var line = document.getElementById('wl-count-line');
      if (line) { line.hidden = false; line.textContent = ''; }
      var form = document.getElementById('waitlist-form');
      if (form) { var errorP = document.createElement('p'); errorP.className = 'wl-error'; errorP.textContent = error.message || 'No pudimos conectar con el servidor.'; form.parentNode.insertBefore(errorP, form); }
    });
  }
  init();
})();
