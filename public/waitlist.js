(function () {
  'use strict';
  var app = document.getElementById('waitlist-app');
  var supabaseClient = null;
  var sdkPromise = null;
  // Tope de la Beta. Bajó de 500 a 100 porque con 15 anotados el "500" se
  // leía como una cifra inventada: cualquiera hacía la cuenta y veía que
  // faltaba el 97% del cupo, y esa sensación de "no va a pasar nada" se
  // llevaba el signup. Un número que se puede alcanzar de verdad se lee
  // como un límite, y la escasez suma en vez de restar.
  var BETA_CAP = 100;

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

  /* Contador público. waitlist_count() sigue existiendo y se puede seguir
     llamando, pero la landing NO lo muestra.

     Antes decía "Ya somos N personas en la lista", con el número real que
     devolvía el RPC. Se saco porque el cupo es de 100 y publicar el conteo
     convierte la scarcity en un dato: si dice 14 quedan 86, y si dice 96 la landing ya dice "quedan 4" sin que haga falta decirlo. El tope de BETA_CAP sigue
     dicho de forma explícita, que es un número que uno decide sostener; lo que
     no va es medir cuántos van.

     Lo que sí quedó: el tope (100 cupos), el contador regresivo de lanzamiento
     y el premio por invitar, que es sobre tu propia cuenta y no del total. */
  function refreshCount() {
    return Promise.resolve();
  }

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
      '<div class="wl-logo"><svg width="22" height="27" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 20 12 30 12 30s12-10 12-18.2C24 5.3 18.6 0 12 0z" fill="#FFFFFF"/><circle cx="12" cy="11.5" r="4.6" fill="#F2A93B"/></svg>CuantoSale.uy</div>' +
      '<p class="wl-countdown__label">Lanzamiento oficial en</p>' +
      '<div class="wl-countdown" id="wl-countdown" aria-live="polite">' +
      '<div class="wl-countdown__unit"><b id="wl-cd-d">–</b><span>días</span></div>' +
      '<div class="wl-countdown__unit"><b id="wl-cd-h">–</b><span>hs</span></div>' +
      '<div class="wl-countdown__unit"><b id="wl-cd-m">–</b><span>min</span></div>' +
      '<div class="wl-countdown__unit"><b id="wl-cd-s">–</b><span>seg</span></div>' +
      '</div>' +
      '<h1>🚀 Llegamos a Uruguay. Preparate para viajar inteligente</h1>' +
      // Lo que va dentro de .wl-long se oculta en pantallas angostas: en el
      // celo sobra texto y lo que hace falta es que la tarjeta entre entera,
      // no que la letra se vuelva ilegible. En compu se ve la versión corta
      // de la descripción.
      '<p class="wl-sub">Olvidate de las peleas de plata con tus amigos.<span class="wl-long"> </span>Calculá el costo total de tu viaje<span class="wl-long"> &mdash; vuelos, alojamiento, comidas y nafta incluidos &mdash;</span> y dividilo entre todos sin vueltas.</p>' +
      (errorMessage ? '<p class="wl-error">' + esc(errorMessage) + '</p>' : '') +
      '<form id="waitlist-form">' +
      '<label class="wl-field"><input required type="email" name="email" placeholder="tu@email.com" autocomplete="email"></label>' +
      '<button type="submit" class="wl-btn">¡Quiero unirme ahora!</button>' +
      '<p class="wl-free-note">Gratis, sin tarjeta de crédito.</p>' +
      '</form>' +
// No va "Ya somos N personas en la lista": con el tope en 100, publicar el
      // conteo dice cuantos quedan sin que nadie lo calcule. El tope (BETA_CAP) si
      // se dice, y el contador regresivo de lanzamiento tambien.
      '<p class="wl-urgency">⚠️ <span><b>Acceso limitado:</b> solo ' + BETA_CAP + ' cupos<span class="wl-long"> disponibles para la versi&oacute;n Beta. ¡Los lugares se est&aacute;n llenando r&aacute;pido!</span></span></p>' +
      '</div>'
    );
    tickCountdown();
    // En paralelo, sin esperarlo: el formulario ya está en pantalla y el
    // número aparece solo cuando llega.
    refreshCount();
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
  }

  // 5% de descuento por persona invitada, tope 20% (4 invitadas).
  //
  // OJO, esto cambió de significado y hay que mantenerlo coherente: la app
  // no tiene checkout, así que el descuento NO se aplica solo. Se acredita a
  // mano sobre los tours y transfers que la app cotiza, que sí tienen precio
  // real. Si algún día el descuento se descuenta en el flujo de pago, esta
  // frase tiene que volver a decir "se aplica al reservar" para no prometer
  // menos de lo que se cumple. El contador, la barra y los topes ya usan
  // "personas" en vez de "amigos" a propósito: lo que suma es el grupo de
  // viaje, no un contacto suelto.
  var REWARD_STEP_PCT = 5;
  var REWARD_MAX_PCT = 20;
  function renderConfirmation(position, referralCode, invitedCount) {
    var shareUrl = window.location.origin + '/?ref=' + encodeURIComponent(referralCode);
    var shareMessage = 'Armamos CuántoSale para que un viaje en grupo no termine en una pelea de plata. Sumate a la lista:';
    var shareText = shareMessage + ' ' + shareUrl;
    var unlockedPct = Math.min(REWARD_MAX_PCT, Number(invitedCount) * REWARD_STEP_PCT);
    var atMax = unlockedPct >= REWARD_MAX_PCT;
    var rewardCopy = atMax
      ? '🎉 ¡Desbloqueaste el <b>' + REWARD_MAX_PCT + '% off</b> máximo en tours y transfers para tu viaje! Te lo acreditamos a mano cuando te cotizamos el viaje.'
      : (invitedCount > 0
          ? 'Ya desbloqueaste <b>' + unlockedPct + '% off</b> en tours y transfers, y te lo acreditamos a mano. Seguí invocando gente para llegar al <b>' + REWARD_MAX_PCT + '%</b>.'
          : 'Invitá a quien viaja con vos y desbloqueá hasta <b>' + REWARD_MAX_PCT + '% off</b> en tours y transfers. Te lo acreditamos a mano cuando te cotizamos el viaje.');
    // Compartir es la acción que más suma (trae referidos y sube la posición),
    // así que va como botón grande. En el celu se usa el share sheet nativo
    // cuando existe, que además de WhatsApp llega a Stories y a SMS; en
    // escritorio, donde no existe, cae en wa.me.
    var canNativeShare = !!(navigator.share);
    render(
      '<div class="wl-card">' +
      '<p class="wl-confirm-label">Tu lugar en la lista</p>' +
      '<div class="wl-confirm-position">#' + esc(position) + '</div>' +
      '<p class="wl-sub" style="text-align:center;margin-bottom:18px">Mandáselo a tu grupo: cada persona que se anota con tu link te sube de posición.</p>' +
      '<button type="button" class="wl-share-btn" id="share-primary">' + (canNativeShare ? 'Compartir con mi grupo' : 'Enviar por WhatsApp') + '</button>' +
      '<div class="wl-share"><input readonly value="' + esc(shareUrl) + '" id="share-url"><button type="button" id="copy-share">Copiar</button></div>' +
      '<p class="wl-status" id="copy-status" aria-live="polite"></p>' +
      '<div class="wl-stat"><span>Personas invitadas</span><b>' + esc(invitedCount) + '</b></div>' +
      '<div class="wl-reward"><p>' + rewardCopy + '</p>' +
      '<div class="wl-reward__track"><div class="wl-reward__fill" style="width:' + Math.round((unlockedPct / REWARD_MAX_PCT) * 100) + '%"></div></div>' +
      '<div class="wl-reward__steps"><span>0%</span><span>' + REWARD_MAX_PCT + '% off</span></div></div>' +
      '</div>'
    );
    document.getElementById('share-primary').addEventListener('click', function () {
      // Cancelar el share sheet no es un error: no se muestra status.
      if (canNativeShare) {
        navigator.share({ text: shareMessage, url: shareUrl }).catch(function () {});
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank', 'noopener');
      }
    });
    document.getElementById('copy-share').addEventListener('click', function () {
      var status = document.getElementById('copy-status');
      var copyPromise = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(shareUrl) : Promise.reject(new Error('sin portapapeles'));
      copyPromise.then(function () { status.textContent = 'Link copiado ✓'; }).catch(function () { status.textContent = 'Copiá el link manualmente: ' + shareUrl; });
    });
  }

  function init() {
    renderForm();
    // Si el SDK no carga, el formulario igual queda usable (el submit reintenta
    // por su cuenta) y el contador simplemente no aparece: refreshCount se
    // encarga de mantener la línea oculta cuando algo falla.
    loadSupabaseSdk().catch(function (error) {
      var form = document.getElementById('waitlist-form');
      if (form) { var errorP = document.createElement('p'); errorP.className = 'wl-error'; errorP.textContent = error.message || 'No pudimos conectar con el servidor.'; form.parentNode.insertBefore(errorP, form); }
    });
  }
  init();
})();
