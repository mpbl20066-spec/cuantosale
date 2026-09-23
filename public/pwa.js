(function () {
  'use strict';

  var installButton = document.getElementById('install-app-button');
  var helpDialog = document.getElementById('install-help');
  var helpContent = document.getElementById('install-help-content');
  var deferredInstallPrompt = null;
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function closeHelp() {
    if (!helpDialog) return;
    helpDialog.hidden = true;
    helpDialog.setAttribute('aria-hidden', 'true');
    if (installButton) installButton.focus();
  }

  function showHelp(markup) {
    if (!helpDialog || !helpContent) return;
    helpContent.innerHTML = markup;
    helpDialog.hidden = false;
    helpDialog.setAttribute('aria-hidden', 'false');
    var closeButton = helpDialog.querySelector('[data-close-install-help]');
    if (closeButton) closeButton.focus();
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  if (installButton) {
    if (isStandalone) installButton.hidden = true;
    installButton.addEventListener('click', async function () {
      if (isIOS) {
        showHelp('<p>Para agregar CuántoSale a tu iPhone o iPad:</p><ol><li>Si abriste este enlace desde Instagram, toca el menú <b>⋯</b> y elige <b>Abrir en Safari</b>.</li><li>En Safari, toca <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li><li>Desplázate y selecciona <b>Añadir a pantalla de inicio</b>, luego toca <b>Añadir</b>.</li></ol>');
        return;
      }

      if (deferredInstallPrompt) {
        var promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        await promptEvent.prompt();
        var choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') installButton.hidden = true;
        return;
      }

      showHelp('<p>Para instalar CuántoSale en Android:</p><ol><li>Abre este sitio en <b>Chrome</b>. Si llegaste desde Instagram, usa el menú para abrirlo en Chrome.</li><li>Toca <b>⋮</b> en Chrome y selecciona <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</li><li>Confirma con <b>Instalar</b> o <b>Añadir</b>.</li></ol>');
    });
  }

  if (helpDialog) {
    helpDialog.addEventListener('click', function (event) {
      if (event.target === helpDialog || event.target.closest('[data-close-install-help]')) closeHelp();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !helpDialog.hidden) closeHelp();
    });
  }

  window.addEventListener('appinstalled', function () {
    if (installButton) installButton.hidden = true;
    deferredInstallPrompt = null;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (error) {
        console.warn('No se pudo registrar el service worker:', error);
      });
    });
  }
})();
