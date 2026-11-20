/* Instalar CuántoSale como app desde la web nueva.
   Antes /web no traia manifest ni service worker, asi que el navegador nunca ofrecia instalarla.
   - Registra /sw.js (el mismo de la app; deja pasar /web a la red, ver sw.js).
   - Android y Chrome/Edge de escritorio: guarda beforeinstallprompt y muestra un aviso chico abajo con "Instalar".
   - iPhone/iPad (Safari no tiene ese evento): el aviso explica Compartir -> "Agregar a inicio".
   - Samsung Internet en Android: el aviso ofrece "Abrir en Chrome" (su instalacion la bloquea Android 14/15, ver abrirEnChrome).
   - "Ahora no" lo calla 30 dias (misma clave que pwa.js de la app). Ya instalada, no aparece.
   - El panel de la cuenta (cuenta.js) agrega "Instalar la app" con CSInstalar.disponible() / CSInstalar.instalar(). */
(function () {
  var KEY = 'cuantosale_install_dismissed_at', DIAS = 30, DEMORA = 8000;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var samsung = /Android/i.test(navigator.userAgent) && /SamsungBrowser/i.test(navigator.userAgent);   // ver abrirEnChrome
  var evento = null, aviso = null;

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* sin SW: la web funciona igual */ }); });
  }
  if (standalone) { window.CSInstalar = { disponible: function () { return false; }, instalar: function () {} }; return; }

  var callado = function () { try { var t = +localStorage.getItem(KEY); return t && Date.now() - t < DIAS * 864e5; } catch (e) { return false; } };
  var callar = function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* modo privado */ } };

  var css = document.createElement('style');
  css.textContent =
    '.cs-inst{position:fixed;left:12px;right:12px;bottom:calc(var(--cs-inst-sube,88px) + var(--cs-wa-sube,0px) + env(safe-area-inset-bottom,0px));box-sizing:border-box;z-index:80;display:flex;align-items:center;gap:12px;max-width:460px;margin:0 auto;padding:12px 12px 12px 14px;border:1px solid var(--line,#d0d7e2);border-radius:16px;background:var(--surface,#fff);color:var(--ink,#101828);box-shadow:0 14px 34px rgba(10,16,26,.24);font-family:var(--fb,inherit)}' +
    '.cs-inst img{flex:0 0 40px;width:40px;height:40px;border-radius:10px}' +
    '.cs-inst p{flex:1;min-width:0;margin:0;font-size:13px;font-weight:600;line-height:1.35;color:var(--ink2,#48566a)}' +
    '.cs-inst p b{display:block;font-size:14px;font-weight:800;color:var(--ink,#101828)}' +
    '.cs-inst__si{flex:0 0 auto;min-height:40px;padding:0 16px;border:0;border-radius:12px;background:#F5C518;color:#0B1F3A;font:800 14px var(--fb,inherit);cursor:pointer}' +
    '.cs-inst__no{flex:0 0 auto;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:var(--ink2,#48566a);font-size:18px;line-height:1;cursor:pointer}' +
    '.cs-inst button:focus-visible{outline:3px solid var(--focus,#F7C325);outline-offset:2px}' +
    '@media (min-width:1024px){.cs-inst{left:auto;right:24px;width:min(460px,calc(100vw - 48px))}}' +
    '@media (max-width:380px){.cs-inst{gap:8px;padding:10px}.cs-inst p{font-size:12px}.cs-inst p b{font-size:13px}.cs-inst__si{padding:0 12px}}';
  document.head.appendChild(css);

  var esperaCookies = false;
  function cerrarAviso() { if (aviso) { aviso.remove(); aviso = null; } }
  function mostrar(forzado) {
    if (aviso || (!forzado && callado())) return;
    if (!evento && !ios && !samsung) return;
    /* Con el aviso de cookies abierto no se muestra: ese pide una decision y los dos juntos tapaban el contenido. */
    if (!forzado && document.getElementById('cs-consent')) { if (!esperaCookies) { esperaCookies = true; setTimeout(function () { esperaCookies = false; mostrar(false); }, 1500); } return; }
    aviso = document.createElement('div');
    aviso.className = 'cs-inst'; aviso.setAttribute('role', 'dialog'); aviso.setAttribute('aria-label', 'Instalar CuántoSale');
    aviso.innerHTML = '<img src="/icons/icon-192.png" alt="">' +
      (samsung ? '<p><b>Instalá CuántoSale</b>Se instala desde Chrome.</p><button type="button" class="cs-inst__si">Abrir en Chrome</button>'
        : evento ? '<p><b>Instalá CuántoSale</b>Abrila como una app, sin buscarla en el navegador.</p><button type="button" class="cs-inst__si">Instalar</button>'
        : '<p><b>Instalá CuántoSale</b>Tocá Compartir <span aria-hidden="true">⬆</span> y después “Agregar a inicio”.</p>') +
      '<button type="button" class="cs-inst__no" aria-label="Ahora no">✕</button>';
    aviso.addEventListener('click', function (e) {
      if (e.target.closest('.cs-inst__no')) { callar(); cerrarAviso(); return; }
      if (e.target.closest('.cs-inst__si')) instalar();
    });
    document.body.appendChild(aviso);
    ubicarAviso();
  }
  /* El aviso queda siempre por ENCIMA de la barra pegada abajo (CTA del flujo, pie de la guia, pestanas) y del boton de
     WhatsApp, y nunca fuera de la pantalla. Las paginas sin wa-flotante.js (el flujo) no median esa barra: se mide aca. */
  function ubicarAviso() {
    if (!aviso) return;
    /* Con una hoja o modal abierto el aviso se esconde: no se encima con el contenido ni con el overlay. */
    var mod = document.getElementById('modal');
    aviso.style.display = mod && !mod.hidden ? 'none' : '';
    var alto = window.innerHeight, techo = alto;
    [].forEach.call(document.querySelectorAll('.tabs,.u-foot,.f-foot,#cs-consent'), function (el) {
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < alto * 0.4 && r.top > alto * 0.5 && r.top < techo) techo = r.top;
    });
    var sube = Math.max(88, Math.round(alto - techo) + 12);
    aviso.style.setProperty('--cs-inst-sube', Math.min(sube, Math.round(alto * 0.5)) + 'px');
  }
  window.addEventListener('resize', function () { ubicarAviso(); });
  document.addEventListener('DOMContentLoaded', function () { var m = document.getElementById('modal'); if (m && window.MutationObserver) new MutationObserver(ubicarAviso).observe(m, { attributes: true, attributeFilter: ['hidden'] }); });
  window.addEventListener('scroll', function () { ubicarAviso(); }, { passive: true, capture: true });
  [600, 1800].forEach(function (ms) { setTimeout(ubicarAviso, ms); });
  /* Samsung Internet instala la web como un APK propio armado para una version vieja de Android, y Android 14/15
     (Galaxy S24, S25...) lo bloquea: "Unsafe app blocked... doesn't include the latest privacy protections". Desde
     Chrome el paquete lo arma Google con una version actual y se instala bien. El intent abre esta misma pagina en
     Chrome; si no esta instalado, Android va al fallback (Chrome en Play Store). */
  function abrirEnChrome() {
    var fallback = 'https://play.google.com/store/apps/details?id=com.android.chrome';
    location.href = 'intent://' + location.host + location.pathname + location.search + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(fallback) + ';end';
  }
  function instalar() {
    if (samsung) { cerrarAviso(); abrirEnChrome(); return; }
    if (!evento) { mostrar(true); return; }
    var ev = evento; evento = null; cerrarAviso();
    Promise.resolve(ev.prompt()).then(function () { return ev.userChoice; }).then(function (c) { if (!c || c.outcome !== 'accepted') callar(); }).catch(function () {});
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    if (samsung) return;   // su instalacion es la que Android bloquea: el aviso lleva a Chrome
    evento = e;
    setTimeout(function () { mostrar(false); }, DEMORA);
  });
  window.addEventListener('appinstalled', function () { evento = null; cerrarAviso(); });
  if (ios || samsung) setTimeout(function () { mostrar(false); }, DEMORA);

  window.CSInstalar = { disponible: function () { return !!evento || ios || samsung; }, instalar: instalar };
})();
