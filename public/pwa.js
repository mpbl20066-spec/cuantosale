(function () {
  'use strict';

  var helpDialog = document.getElementById('install-help');
  var helpContent = document.getElementById('install-help-content');
  var deferredInstallPrompt = null;
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // Antes el prompt salia solo a los 3.5s de cargar la pagina: antes de que la
  // persona hubiera elegido un destino o visto un precio. En iOS era un modal a
  // pantalla completa encima del landing. Para una app que se abre desde
  // Instagram y WhatsApp, ese es el peor momento posible.
  //
  // Ahora se pide por intencion: nunca antes de MIN_DELAY_MS, y solo despues de
  // que haya visto resultados (o, si nunca busca, despues de MAX_DELAY_MS).
  // Un MutationObserver sobre #results evita couplear este archivo con app.js.
  var DISMISS_KEY = 'cuantosale_install_dismissed_at';
  var REASK_DAYS = 30;
  // Rechazar el cartel nativo del navegador no es lo mismo que decir "no me
  // volvas a preguntar": son 7 dias, no 30.
  var DECLINE_DAYS = 7;
  var MIN_DELAY_MS = 15000;
  var MAX_DELAY_MS = 45000;
  var isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

  var startAt = Date.now();
  var sawResults = false;
  var elapsedTimer = null;
  var alreadyAsked = false;

  var IOS_HELP = '<p>Para agregar CuántoSale a tu iPhone o iPad:</p><ol>'
    + '<li>Si abriste este enlace desde Instagram, toca el menú <b>⋯</b> y elige <b>Abrir en Safari</b>.</li>'
    + '<li>En Safari, toca <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>'
    + '<li>Desplázate y selecciona <b>Añadir a pantalla de inicio</b>, luego toca <b>Añadir</b>.</li></ol>'
    + '<div class="install-help__actions">'
    + '<button type="button" class="btn btn-secondary" data-install-later>Ahora no</button>'
    + '<button type="button" class="btn btn-secondary" data-install-never>No mostrar más</button>'
    + '</div>';

  function dismissedRecently(days) {
    try {
      var raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      var at = Number(raw);
      if (!at) return false;
      return (Date.now() - at) < (days || REASK_DAYS) * 24 * 60 * 60 * 1000;
    } catch (error) { return false; }
  }

  function markDismissed(days) {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (error) { /* modo privado */ }
  }

  function clearDismissed() {
    try { localStorage.removeItem(DISMISS_KEY); } catch (error) { /* modo privado */ }
  }

  function closeHelp() {
    if (!helpDialog) return;
    helpDialog.hidden = true;
    helpDialog.setAttribute('aria-hidden', 'true');
  }

  function showHelp(markup) {
    if (!helpDialog || !helpContent) return;
    helpContent.innerHTML = markup;
    helpDialog.hidden = false;
    helpDialog.setAttribute('aria-hidden', 'false');
    // No se roba el foco: la persona puede estar escribiendo en el formulario o
    // con un dialog de reserva abierto.
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    scheduleAutoInstall();
  });

  // "Hubo resultados" = los contenedores de resultados tienen contenido.
  function watchForResults() {
    if (typeof MutationObserver !== 'function') return;
    var targets = ['results', 'destination-results']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (!targets.length) return;
    var observer = new MutationObserver(function () {
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].children.length) { sawResults = true; observer.disconnect(); return; }
      }
    });
    targets.forEach(function (node) { observer.observe(node, { childList: true }); });
  }

  function scheduleAutoInstall() {
    if (isStandalone || alreadyAsked) return;
    if (elapsedTimer) window.clearTimeout(elapsedTimer);
    // Plan A: la persona busca y ve resultados. El observer dispara el intento.
    // Plan B: nunca busca, pero despues de MAX_DELAY_MS se ofrece igual, que es
    // cuando ya demonstró interes y se quedo mirando la pagina.
    elapsedTimer = window.setTimeout(function () { tryAutoInstall(); }, MAX_DELAY_MS);
  }

  function tryAutoInstall() {
    if (isStandalone || alreadyAsked || dismissedRecently(REASK_DAYS)) return;
    var waited = Date.now() - startAt;
    if (waited < MIN_DELAY_MS) {
      window.setTimeout(tryAutoInstall, MIN_DELAY_MS - waited);
      return;
    }
    alreadyAsked = true;
    if (elapsedTimer) { window.clearTimeout(elapsedTimer); elapsedTimer = null; }

    // En iOS no existe beforeinstallprompt: la instalacion solo se puede hacer
    // a mano desde el menu Compartir. Por eso ahi se explica el paso a paso en
    // vez de disparar un cartelito que nunca va a aparecer.
    if (isIOS) { showHelp(IOS_HELP); return; }
    if (!deferredInstallPrompt) return;

    var promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    Promise.resolve(promptEvent.prompt())
      .then(function () { return promptEvent.userChoice; })
      .then(function (choice) {
        if (!choice || choice.outcome !== 'accepted') markDismissed(DECLINE_DAYS);
      })
      .catch(function () { markDismissed(DECLINE_DAYS); });
  }

  if (helpDialog) {
    helpDialog.addEventListener('click', function (event) {
      // Solo las decisiones explicitas se recuerdan. Tocar el fondo o la X
      // cierra solo esta vez: antes cualquier toque, incluso un scroll
      // accidental, silenciaba el prompt por 30 dias.
      if (event.target.closest('[data-install-never]')) { closeHelp(); markDismissed(REASK_DAYS); return; }
      if (event.target.closest('[data-install-later]')) { closeHelp(); return; }
      if (event.target === helpDialog || event.target.closest('[data-close-install-help]')) closeHelp();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !helpDialog.hidden) closeHelp();
    });
  }

  // La app avisa cuando ya pintó un resultado.
  window.addEventListener('cuantosale:resultados', function () { sawResults = true; tryAutoInstall(); });

  window.addEventListener('appinstalled', function () {
    clearDismissed();
    deferredInstallPrompt = null;
  });

  watchForResults();
  // Si el evento no llega (ya instalada, o el navegador no lo emite) en iOS
  // igual conviene ofrecer las instrucciones, porque ahi nunca se dispara solo.
  if (isIOS && isTouch && !isStandalone) scheduleAutoInstall();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (error) {
        console.warn('No se pudo registrar el service worker:', error);
      });
    });
  }
})();
