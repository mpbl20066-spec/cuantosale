/* Instalar CuántoSale como app desde la web nueva.
   Antes /web no traia manifest ni service worker, asi que el navegador nunca ofrecia instalarla.
   - Registra /sw.js (el mismo de la app; deja pasar /web a la red, ver sw.js).
   - Android y Chrome/Edge de escritorio: guarda beforeinstallprompt y muestra un aviso chico abajo con "Instalar".
   - iPhone/iPad (Safari no tiene ese evento): el aviso explica Compartir -> "Agregar a inicio".
   - "Ahora no" lo calla 30 dias (misma clave que pwa.js de la app). Ya instalada, no aparece.
   - El panel de la cuenta (cuenta.js) agrega "Instalar la app" con CSInstalar.disponible() / CSInstalar.instalar(). */
(function () {
  var KEY = 'cuantosale_install_dismissed_at', DIAS = 30, DEMORA = 8000;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var evento = null, aviso = null;

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* sin SW: la web funciona igual */ }); });
  }
  if (standalone) { window.CSInstalar = { disponible: function () { return false; }, instalar: function () {} }; return; }

  var callado = function () { try { var t = +localStorage.getItem(KEY); return t && Date.now() - t < DIAS * 864e5; } catch (e) { return false; } };
  var callar = function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* modo privado */ } };

  var css = document.createElement('style');
  css.textContent =
    '.cs-inst{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:80;display:flex;align-items:center;gap:12px;max-width:460px;margin:0 auto;padding:12px 12px 12px 14px;border:1px solid var(--line,#d0d7e2);border-radius:16px;background:var(--surface,#fff);color:var(--ink,#101828);box-shadow:0 14px 34px rgba(10,16,26,.24);font-family:var(--fb,inherit)}' +
    '.cs-inst img{flex:0 0 40px;width:40px;height:40px;border-radius:10px}' +
    '.cs-inst p{flex:1;min-width:0;margin:0;font-size:13px;font-weight:600;line-height:1.35;color:var(--ink2,#48566a)}' +
    '.cs-inst p b{display:block;font-size:14px;font-weight:800;color:var(--ink,#101828)}' +
    '.cs-inst__si{flex:0 0 auto;min-height:40px;padding:0 16px;border:0;border-radius:12px;background:#F5C518;color:#0B1F3A;font:800 14px var(--fb,inherit);cursor:pointer}' +
    '.cs-inst__no{flex:0 0 auto;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:var(--ink2,#48566a);font-size:18px;line-height:1;cursor:pointer}' +
    '.cs-inst button:focus-visible{outline:3px solid var(--focus,#F7C325);outline-offset:2px}' +
    '@media (min-width:1024px){.cs-inst{left:auto;right:24px;bottom:24px}}';
  document.head.appendChild(css);

  function cerrarAviso() { if (aviso) { aviso.remove(); aviso = null; } }
  function mostrar(forzado) {
    if (aviso || (!forzado && callado())) return;
    if (!evento && !ios) return;
    aviso = document.createElement('div');
    aviso.className = 'cs-inst'; aviso.setAttribute('role', 'dialog'); aviso.setAttribute('aria-label', 'Instalar CuántoSale');
    aviso.innerHTML = '<img src="/icons/icon-192.png" alt="">' +
      (evento ? '<p><b>Instalá CuántoSale</b>Abrila como una app, sin buscarla en el navegador.</p><button type="button" class="cs-inst__si">Instalar</button>'
        : '<p><b>Instalá CuántoSale</b>Tocá Compartir <span aria-hidden="true">⬆</span> y después “Agregar a inicio”.</p>') +
      '<button type="button" class="cs-inst__no" aria-label="Ahora no">✕</button>';
    aviso.addEventListener('click', function (e) {
      if (e.target.closest('.cs-inst__no')) { callar(); cerrarAviso(); return; }
      if (e.target.closest('.cs-inst__si')) instalar();
    });
    document.body.appendChild(aviso);
  }
  function instalar() {
    if (!evento) { mostrar(true); return; }
    var ev = evento; evento = null; cerrarAviso();
    Promise.resolve(ev.prompt()).then(function () { return ev.userChoice; }).then(function (c) { if (!c || c.outcome !== 'accepted') callar(); }).catch(function () {});
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); evento = e;
    setTimeout(function () { mostrar(false); }, DEMORA);
  });
  window.addEventListener('appinstalled', function () { evento = null; cerrarAviso(); });
  if (ios) setTimeout(function () { mostrar(false); }, DEMORA);

  window.CSInstalar = { disponible: function () { return !!evento || ios; }, instalar: instalar };
})();
