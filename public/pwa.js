(function () {
  'use strict';

  var helpDialog = document.getElementById('install-help');
  var helpContent = document.getElementById('install-help-content');
  var deferredInstallPrompt = null;
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // La instalación ahora es automática, así que hace falta una memoria de por
  // qué no se volvió a preguntar. Se guarda la fecha del descarte y se reintenta
  // pasado un tiempo, para no fastidiar en cada carga pero tampoco dejar de
  // preguntar nunca a quien lo cerró por error.
  var DISMISS_KEY = 'cuantosale_install_dismissed_at';
  var REASK_DAYS = 30;
  var AUTO_DELAY_MS = 3500;
  var isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

  var IOS_HELP = '<p>Para agregar CuántoSale a tu iPhone o iPad:</p><ol>'
    + '<li>Si abriste este enlace desde Instagram, toca el menú <b>⋯</b> y elige <b>Abrir en Safari</b>.</li>'
    + '<li>En Safari, toca <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>'
    + '<li>Desplázate y selecciona <b>Añadir a pantalla de inicio</b>, luego toca <b>Añadir</b>.</li></ol>';

  function dismissedRecently() {
    try {
      var raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      var at = Number(raw);
      if (!at) return false;
      return (Date.now() - at) < REASK_DAYS * 24 * 60 * 60 * 1000;
    } catch (error) { return false; }
  }

  function markDismissed() {
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
    var closeButton = helpDialog.querySelector('[data-close-install-help]');
    if (closeButton) closeButton.focus();
  }

  // Un toque en cualquier parte cuenta como "no me interesa ahora": es lo que
  // espera la gente cuando un cartelito aparece solo.
  function noteDismiss() {
    if (!helpDialog || helpDialog.hidden) return;
    closeHelp();
    markDismissed();
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    scheduleAutoInstall();
  });

  function scheduleAutoInstall() {
    if (isStandalone || dismissedRecently()) return;
    window.setTimeout(tryAutoInstall, AUTO_DELAY_MS);
  }

  async function tryAutoInstall() {
    if (isStandalone || dismissedRecently()) return;

    // En iOS no existe beforeinstallprompt: la instalación sólo se puede hacer
    // a mano desde el menú Compartir. Por eso ahí se explica el paso a paso en
    // vez de disparar un cartelito que nunca va a aparecer.
    if (isIOS) {
      showHelp(IOS_HELP);
      return;
    }

    if (!deferredInstallPrompt) return;
    var promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      await promptEvent.prompt();
      var choice = await promptEvent.userChoice;
      if (!choice || choice.outcome !== 'accepted') markDismissed();
    } catch (error) {
      markDismissed();
    }
  }

  if (helpDialog) {
    helpDialog.addEventListener('click', function (event) {
      if (event.target === helpDialog || event.target.closest('[data-close-install-help]')) noteDismiss();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !helpDialog.hidden) noteDismiss();
    });
  }

  window.addEventListener('appinstalled', function () {
    clearDismissed();
    deferredInstallPrompt = null;
  });

  // Si el evento no llega (ya instalada, o el navegador no lo emite) en iOS
  // igual conviene ofrecer las instrucciones, porque ahí nunca se dispara solo.
  if (isIOS && isTouch && !isStandalone) scheduleAutoInstall();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (error) {
        console.warn('No se pudo registrar el service worker:', error);
      });
    });
  }
})();
