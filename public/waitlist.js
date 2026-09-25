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

  // Fecha fija de lanzamiento (hora de Uruguay, UTC-3). Si hace falta
  // correrla, es el único lugar a tocar.
  var LAUNCH_DATE = new Date('2026-10-01T20:00:00-03:00');
  function tickCountdown() {
    var els = { d: document.getElementById('wl-cd-d'), h: document.getElementById('wl-cd-h'), m: document.getElementById('wl-cd-m'), s: document.getElementById('wl-cd-s') };
    if (!els.d) return;
    var diff = LAUNCH_DATE.getTime() - Date.now();
    if (diff <= 0) {
      var wrap = document.getElementById('wl-countdown');
      var label = document.querySelector('.wl-countdown__label');
      if (label) label.textContent = '¡Ya lanzamos!';
      if (wrap) wrap.hidden = true;
      return;
    }
    var totalSeconds = Math.floor(diff / 1000);
    els.d.textContent = Math.floor(totalSeconds / 86400);
    els.h.textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, '0');
    els.m.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    els.s.textContent = String(totalSeconds % 60).padStart(2, '0');
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  // Muestra el formulario al toque, sin esperar red: el contador se completa
  // después en paralelo y solo parchea su propio <span>, sin re-renderizar
  // el formulario (así no se pierde lo que el usuario ya tipeó).
  function renderForm(errorMessage) {
    render(
      '<div class="wl-card">' +
      '<div class="wl-logo"><svg width="22" height="27" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 20 12 30 12 30s12-10 12-18.2C24 5.3 18.6 0 12 0z" fill="#FFFFFF"/><circle cx="12" cy="11.5" r="4.6" fill="#F2A93B"/></svg>cuántosale</div>' +
      '<p class="wl-countdown__label">Lanzamiento oficial en</p>' +
      '<div class="wl-countdown" id="wl-countdown" aria-live="polite">' +
      '<div class="wl-countdown__unit"><b id="wl-cd-d">–</b><span>días</span></div>' +
      '<div class="wl-countdown__unit"><b id="wl-cd-h">–</b><span>hs</span></div>' +
      '<div class="wl-countdown__unit"><b id="wl-cd-m">–</b><span>min</span></div>' +
      '<div class="wl-countdown__unit"><b id="wl-cd-s">–</b><span>seg</span></div>' +
      '</div>' +
      '<h1>🚀 Llegamos a Uruguay. Preparate para viajar inteligente</h1>' +
      '<p class="wl-sub">Olvidate de las peleas de plata con tus amigos. Sumate a la lista de espera exclusiva y sé el primero en probar la herramienta definitiva para calcular, comparar y dividir gastos de viajes.</p>' +
      (errorMessage ? '<p class="wl-error">' + esc(errorMessage) + '</p>' : '') +
      '<form id="waitlist-form">' +
      '<label class="wl-field"><input required type="email" name="email" placeholder="tu@email.com" autocomplete="email"></label>' +
      '<button type="submit" class="wl-btn">¡Quiero unirme ahora!</button>' +
      '</form>' +
      '<p class="wl-urgency" id="wl-count-line" hidden></p>' +
      '</div>'
    );
    tickCountdown();
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

  // BETA_CAP es un tope real que pensás sostener (no una cifra de "gente ya
  // anotada" inventada) — el conteo que se muestra junto es siempre el real.
  var BETA_CAP = 500;
  async function fillCount() {
    var line = document.getElementById('wl-count-line');
    try {
      await loadSupabaseSdk();
      var result = await supabaseClient.rpc('waitlist_count');
      var count = result.error ? NaN : Number(result.data);
      if (!Number.isFinite(count) || !line) return;
      line.hidden = false;
      line.innerHTML = '⚠️ <span><b>Acceso limitado:</b> solo ' + BETA_CAP + ' cupos disponibles para la versión Beta. Ya se anotaron <b>' + count + '</b> ' + (count === 1 ? 'viajero' : 'viajeros') + ' — sumate antes de que se llenen.</span>';
    } catch (error) { /* sin contador no se rompe el formulario */ }
  }

  // 5% de descuento por amigo invitado, tope 20% (4 invitados). Solo se
  // muestra el beneficio, nunca la cuenta exacta: la aplicación real del
  // descuento queda para cuando haya checkout, esto es la vidriera.
  var REWARD_STEP_PCT = 5;
  var REWARD_MAX_PCT = 20;
  function renderConfirmation(position, referralCode, invitedCount) {
    var shareUrl = window.location.origin + '/?ref=' + encodeURIComponent(referralCode);
    var unlockedPct = Math.min(REWARD_MAX_PCT, Number(invitedCount) * REWARD_STEP_PCT);
    var atMax = unlockedPct >= REWARD_MAX_PCT;
    var rewardCopy = atMax
      ? '🎉 ¡Desbloqueaste el <b>' + REWARD_MAX_PCT + '% off</b> máximo en tours y transfers para tu viaje!'
      : (invitedCount > 0
          ? 'Ya desbloqueaste <b>' + unlockedPct + '% off</b> en tours y transfers. Seguí invitando para llegar al <b>' + REWARD_MAX_PCT + '%</b>.'
          : 'Invitá amigos y desbloqueá beneficios exclusivos de hasta <b>' + REWARD_MAX_PCT + '% off</b> en tours y transfers para tu viaje.');
    render(
      '<div class="wl-card">' +
      '<p class="wl-confirm-label">Tu lugar en la lista</p>' +
      '<div class="wl-confirm-position">#' + esc(position) + '</div>' +
      '<p class="wl-sub" style="text-align:center;margin-bottom:18px">Compartí tu link y subí de posición cada vez que alguien se anota con él.</p>' +
      '<div class="wl-share"><input readonly value="' + esc(shareUrl) + '" id="share-url"><button type="button" id="copy-share">Copiar</button></div>' +
      '<p class="wl-status" id="copy-status" aria-live="polite"></p>' +
      '<div class="wl-stat"><span>Amigos invitados</span><b>' + esc(invitedCount) + '</b></div>' +
      '<div class="wl-reward"><p>' + rewardCopy + '</p>' +
      '<div class="wl-reward__track"><div class="wl-reward__fill" style="width:' + Math.round((unlockedPct / REWARD_MAX_PCT) * 100) + '%"></div></div>' +
      '<div class="wl-reward__steps"><span>0%</span><span>' + REWARD_MAX_PCT + '% off</span></div></div>' +
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
