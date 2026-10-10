/* Selector de moneda de /test, el mismo que tiene cuantosale.uy.
   - Mismas monedas y mismas tasas que la app: GET /api/tasas (UYU, USD, BRL; base USD).
   - Misma clave de almacenamiento (cuantosale_moneda): lo que la persona elige aca vale en la app y al reves.
   - Todos los importes de /test estan en dolares (base). Para mostrarlos en otra moneda se multiplican por la tasa;
     si no hay tasa para la moneda elegida se queda en la base, nunca se inventa un numero.
   Uso:  CSMoneda.fmt(usd) -> "US$ 1.234" / "$ 45.000" / "R$ 5.013";  CSMoneda.alCambiar(fn);  CSMoneda.selector() -> nodo del selector. */
(function () {
  var KEY = 'cuantosale_moneda';
  var ST = {
    monedas: [{ code: 'UYU', etiqueta: 'Pesos uruguayos', simbolo: '$' }, { code: 'USD', etiqueta: 'Dólares', simbolo: 'US$' }, { code: 'BRL', etiqueta: 'Reales', simbolo: 'R$' }],
    rates: null, base: 'USD', code: 'USD', cargando: true
  };
  try { var g = localStorage.getItem(KEY); if (g) ST.code = g; } catch (e) { /* modo privado */ }
  var subs = [];

  function tasa(code) {
    if (!code || code === ST.base) return 1;
    var r = ST.rates && Number(ST.rates[code]);
    return isFinite(r) && r > 0 ? r : null;
  }
  function base() { return ST.monedas.filter(function (m) { return m.code === ST.base; })[0] || { code: 'USD', simbolo: 'US$', etiqueta: 'Dólares' }; }
  function activa() {
    var m = ST.monedas.filter(function (x) { return x.code === ST.code; })[0] || base(), t = tasa(m.code);
    if (t == null) { m = base(); t = 1; }   /* sin tasa: la base, no un numero inventado */
    return { m: m, t: t };
  }
  function miles(n, dec) {
    var s = Math.abs(n).toFixed(dec), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '-' : '') + p.join(dec ? ',' : '');
  }
  function fmt(usd) {
    var v = Number(usd); if (!isFinite(v)) return '';
    var a = activa(), t = v * a.t;
    var dec = a.m.code === 'BRL' && Math.abs(t) < 1000 ? 2 : 0;   /* igual que la app: decimales solo si el valor es chico */
    return a.m.simbolo + ' ' + miles(t, dec);
  }
  function simbolo() { return activa().m.simbolo; }
  function code() { return activa().m.code; }
  function avisar() { subs.slice().forEach(function (fn) { try { fn(code()); } catch (e) { /* una pagina no frena a las otras */ } }); }
  function set(c) {
    if (!c || tasa(c) == null) return;
    ST.code = c;
    try { localStorage.setItem(KEY, c); } catch (e) { /* modo privado */ }
    pintarSelectores(); avisar();
  }
  function alCambiar(fn) { if (typeof fn === 'function') subs.push(fn); }

  /* ---- Selector (boton con "$" + codigo, y menu con las opciones) ---- */
  var estilo = document.createElement('style');
  estilo.textContent =
    '.cs-mon{position:relative;display:inline-block;font-family:var(--fb,inherit)}' +
    '.cs-mon__b{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 10px 0 6px;border:1px solid var(--line,#d0d7e2);border-radius:14px;background:transparent;color:var(--ink,#101828);font:800 14px var(--fb,inherit);letter-spacing:.02em;cursor:pointer;transition:border-color .15s}' +
    '.cs-mon__b:hover{border-color:var(--ink2,#48566a)}' +
    '.cs-mon__b:focus-visible{outline:3px solid var(--focus,#F7C325);outline-offset:2px}' +
    '.cs-mon__s{display:grid;place-items:center;width:30px;height:30px;box-sizing:border-box;border-radius:50%;background:#1A2B4A;color:#F5C518;font-size:16px;font-weight:800;line-height:1}' +
    '.cs-mon__v{width:11px;height:11px;color:var(--ink2,#9FADBF);transition:transform .15s}' +
    '.cs-mon__b[aria-expanded="true"] .cs-mon__v{transform:rotate(180deg)}' +
    '.cs-mon__m{position:absolute;right:0;top:calc(100% + 6px);z-index:60;min-width:210px;margin:0;padding:6px;list-style:none;border:1px solid var(--line,#d0d7e2);border-radius:14px;background:var(--surface,#fff);box-shadow:0 14px 34px rgba(10,16,26,.22)}' +
    '.cs-mon__m[hidden]{display:none}' +
    '.cs-mon__o{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:var(--ink,#101828);font:600 14px var(--fb,inherit);text-align:left;cursor:pointer}' +
    '.cs-mon__o:hover,.cs-mon__o:focus-visible{background:var(--cel-soft,#f1f4f8);outline:0}' +
    '.cs-mon__o[aria-selected="true"]{font-weight:800}' +
    '.cs-mon__o[disabled]{opacity:.45;cursor:default}' +
    '.cs-mon__o i{flex:0 0 28px;font-style:normal;font-weight:800;color:var(--ink2,#48566a)}' +
    '.cs-mon__o span{flex:1}' +
    '.cs-mon__o em{font-style:normal;font-weight:800}' +
    '.cs-top__mon{display:inline-flex;align-items:center;margin-left:2px}' +
    '.cs-top__sep{align-self:center;width:1px;height:34px;margin:0 10px;background:var(--line,#d0d7e2)}' +
    '.cs-mon--bar{display:inline-flex;align-items:center}' +
    '@media (min-width:1024px){.cs-mon--bar{display:none}}';
  document.head.appendChild(estilo);

  function nodo() {
    var a = activa();
    var w = document.createElement('div');
    w.className = 'cs-mon'; w.setAttribute('data-cs-mon', '');
    w.innerHTML =
      '<button type="button" class="cs-mon__b" aria-haspopup="listbox" aria-expanded="false" aria-label="Elegir la moneda. Moneda actual: ' + a.m.etiqueta + '">' +
      '<span class="cs-mon__s" aria-hidden="true">$</span><span class="cs-mon__c">' + a.m.code + '</span>' +
      '<svg class="cs-mon__v" viewBox="0 0 10 10" aria-hidden="true"><path d="m1.5 3.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<ul class="cs-mon__m" role="listbox" aria-label="Elegí la moneda" hidden>' + ST.monedas.map(function (m) {
        var ok = tasa(m.code) != null, on = m.code === a.m.code;
        return '<li role="none"><button type="button" class="cs-mon__o" role="option" data-cs-moneda="' + m.code + '" aria-selected="' + on + '"' + (ok ? '' : ' disabled') + '><i>' + m.simbolo + '</i><span>' + m.etiqueta + '</span>' + (on ? '<em aria-hidden="true">✓</em>' : '') + '</button></li>';
      }).join('') + '</ul>';
    return w;
  }
  function selector() { return nodo(); }
  function pintarSelectores() {
    document.querySelectorAll('[data-cs-mon]').forEach(function (w) {
      var abierto = !w.querySelector('.cs-mon__m').hidden, nuevo = nodo();
      w.innerHTML = nuevo.innerHTML;
      if (abierto) { w.querySelector('.cs-mon__m').hidden = true; }
    });
  }
  function cerrar() {
    document.querySelectorAll('[data-cs-mon] .cs-mon__m').forEach(function (m) {
      if (!m.hidden) { m.hidden = true; var b = m.parentNode.querySelector('.cs-mon__b'); if (b) b.setAttribute('aria-expanded', 'false'); }
    });
  }
  document.addEventListener('click', function (e) {
    var op = e.target.closest && e.target.closest('[data-cs-moneda]');
    if (op) { if (!op.disabled) { var c = op.getAttribute('data-cs-moneda'); cerrar(); set(c); } return; }
    var b = e.target.closest && e.target.closest('.cs-mon__b');
    if (b) {
      var m = b.parentNode.querySelector('.cs-mon__m'), abrir = m.hidden;
      cerrar();
      if (abrir) { m.hidden = false; b.setAttribute('aria-expanded', 'true'); var s = m.querySelector('[aria-selected="true"]') || m.querySelector('button:not([disabled])'); if (s) s.focus(); }
      return;
    }
    cerrar();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var abierto = document.querySelector('.cs-mon__m:not([hidden])'); if (abierto) { cerrar(); var bt = document.querySelector('.cs-mon__b'); if (bt) bt.focus(); } }
  });

  /* Tasas reales: mismo endpoint que la app. Hasta que lleguen (o si fallan) se muestra en la base. */
  function cargar() {
    return fetch('/api/tasas', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.monedas && j.monedas.length) ST.monedas = j.monedas.map(function (m) { return { code: m.code, etiqueta: m.etiqueta, simbolo: m.simbolo }; });
        if (j && j.rates) { ST.rates = j.rates; ST.base = j.base || 'USD'; }
      })
      .catch(function () { /* sin tasas: todo en la base */ })
      .then(function () { ST.cargando = false; pintarSelectores(); avisar(); });
  }
  if (/^https?:$/.test(location.protocol)) cargar(); else ST.cargando = false;

  window.CSMoneda = { fmt: fmt, simbolo: simbolo, code: code, set: set, alCambiar: alCambiar, selector: selector, pintar: pintarSelectores };
})();
