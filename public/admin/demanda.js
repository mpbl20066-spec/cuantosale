/* Sistema > Demanda del panel /admin: que quiere la gente que no le estamos vendiendo.
   Los eventos vienen de GET /api/admin/demanda (lib/demanda.js): cotizo, vuelos, reserva y buscar_sin, cada uno con el
   numero al azar del visitante (cs_v). Aca se cruzan para poder filtrar sin volver a pedir:

   - cluster = destino · mes de viaje · medio (avion, auto, bus)
   - personas = visitantes distintos que lo cotizaron; busquedas = dias distintos de cada uno (recargar no suma)
   - repiten = lo cotizaron en 2 dias o mas; reservaron otra cosa = pidieron reserva en otro destino;
     abandonan = no pidieron nada
   - brecha = el destino no tiene tours o traslado en el catalogo, o a la mitad o mas no le aparecieron vuelos
   - orden: las personas pesan mas que las busquedas (personas x3 + repiten x2 + busquedas)

   Lo carga admin.js (vistaDemanda) la primera vez que se abre la pestana. */
(function () {
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MEDIOS = { avion: 'avión', auto: 'auto', bus: 'bus' };

  window.CSDemandaPanel = function (ctx) {
    var esc = ctx.esc, kpi = ctx.kpi;
    var st = { dias: 7, tab: 'brecha', dest: '', mes: '', medio: '', personas: 'todas', conOferta: false, prueba: false, datos: null, cargando: false, error: '' };

    function cargar() {
      st.cargando = true; st.error = '';
      ctx.pintar();
      ctx.api('demanda?dias=' + st.dias + (st.prueba ? '&prueba=1' : '')).then(function (j) { st.datos = j; })
        .catch(function (e) { st.error = e.message; })
        .then(function () { st.cargando = false; if (ctx.S.vista === 'demanda') ctx.pintar(); });
    }
    function mesDe(f) { return f && /^\d{4}-\d{2}/.test(f) ? f.slice(0, 7) : ''; }
    function mesTxt(m) { return m ? MESES[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4) : 'sin fecha'; }
    function diaUY(iso) { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Montevideo' }); }
    function nombre(k) { var o = st.datos && st.datos.oferta && st.datos.oferta[k]; return o ? o.nombre : k; }
    function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '—'; }
    function cuenta(o) { return Object.keys(o).length; }

    /* ---------- cruces ---------- */
    function calcular() {
      var filas = (st.datos && st.datos.filas) || [], oferta = (st.datos && st.datos.oferta) || {};
      var reservas = {}, vuelos = {}, diasVis = {}, buscados = {};
      filas.forEach(function (f) {
        if (f.evento === 'reserva') { (reservas[f.visitante] = reservas[f.visitante] || {})[f.destino] = 1; }
        else if (f.evento === 'vuelos') {
          var kv = f.destino + '|' + mesDe(f.ida), x = (vuelos[kv] = vuelos[kv] || {});
          x[f.visitante] = x[f.visitante] || f.resultado === 'ok';
        } else if (f.evento === 'cotizo') { (diasVis[f.visitante] = diasVis[f.visitante] || {})[diaUY(f.creado)] = 1; }
        else if (f.evento === 'buscar_sin' && f.texto) { var b = (buscados[f.texto] = buscados[f.texto] || { v: {}, n: 0 }); b.v[f.visitante] = 1; b.n++; }
      });
      var pasaPersona = function (v) { var n = cuenta(diasVis[v] || {}); return st.personas === 'todas' || (st.personas === 'repiten' ? n >= 2 : n < 2); };
      var cl = {};
      filas.forEach(function (f) {
        if (f.evento !== 'cotizo') return;
        var m = mesDe(f.ida), medio = f.medio || 'avion';
        if ((st.dest && f.destino !== st.dest) || (st.mes && m !== st.mes) || (st.medio && medio !== st.medio) || !pasaPersona(f.visitante)) return;
        var k = f.destino + '|' + m + '|' + medio, c = cl[k] || (cl[k] = { dest: f.destino, mes: m, medio: medio, vis: {} });
        (c.vis[f.visitante] = c.vis[f.visitante] || {})[diaUY(f.creado)] = 1;
      });
      var lista = Object.keys(cl).map(function (k) {
        var c = cl[k], vs = Object.keys(c.vis), o = oferta[c.dest] || { tours: 0, traslado: false };
        var vu = c.medio === 'avion' ? (vuelos[c.dest + '|' + c.mes] || {}) : {};
        var conV = vs.filter(function (v) { return v in vu; }), sinV = conV.filter(function (v) { return !vu[v]; });
        var aca = vs.filter(function (v) { return reservas[v] && reservas[v][c.dest]; });
        var otra = vs.filter(function (v) { return reservas[v] && !reservas[v][c.dest]; });
        var r = {
          dest: c.dest, mes: c.mes, medio: c.medio, vis: vs, sinVis: sinV,
          personas: vs.length, busquedas: vs.reduce(function (t, v) { return t + cuenta(c.vis[v]); }, 0),
          repiten: vs.filter(function (v) { return cuenta(c.vis[v]) >= 2; }).length,
          conV: conV.length, sinV: sinV.length, aca: aca.length, otra: otra.length,
          abandonan: vs.length - aca.length - otra.length, tours: o.tours, traslado: o.traslado
        };
        r.falta = [];
        if (!r.tours) r.falta.push('tours');
        if (!r.traslado) r.falta.push('traslado');
        if (r.conV && r.sinV / r.conV >= 0.5) r.falta.push('vuelos');
        r.brecha = r.falta.length > 0;
        r.puntaje = r.personas * 3 + r.repiten * 2 + r.busquedas;
        return r;
      }).sort(function (a, b) { return b.puntaje - a.puntaje || b.personas - a.personas; });
      return { lista: lista, buscados: buscados, oferta: oferta };
    }

    /* ---------- pantalla ---------- */
    function selector(id, valor, opciones) {
      return '<select data-dem-f="' + id + '" aria-label="' + esc(opciones[0][1]) + '">' + opciones.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    }
    function controles() {
      var filas = (st.datos && st.datos.filas) || [], oferta = (st.datos && st.datos.oferta) || {}, meses = {};
      filas.forEach(function (f) { var m = mesDe(f.ida); if (m) meses[m] = 1; });
      var dests = Object.keys(oferta).sort(function (a, b) { return oferta[a].nombre.localeCompare(oferta[b].nombre, 'es'); });
      return '<div class="bar dem-bar"><div class="chips">' +
        [['brecha', 'Demanda insatisfecha'], ['mes', 'Demanda por mes de viaje']].map(function (t) { return '<button class="chip" data-dem-tab="' + t[0] + '" aria-pressed="' + (st.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') +
        '</div><button class="chip" data-dem-prueba aria-pressed="' + st.prueba + '">Datos de prueba: ' + (st.prueba ? 'visibles' : 'ocultos') + '</button></div>' +
        '<div class="bar dem-bar"><div class="chips">' + [[1, '24 h'], [7, '7 días'], [30, '30 días']].map(function (d) { return '<button class="chip" data-dem-dias="' + d[0] + '" aria-pressed="' + (st.dias === d[0]) + '">' + d[1] + '</button>'; }).join('') + '</div>' +
        '<div class="dem-filtros">' +
        selector('dest', st.dest, [['', 'Todos los destinos']].concat(dests.map(function (k) { return [k, oferta[k].nombre]; }))) +
        selector('mes', st.mes, [['', 'Cualquier mes']].concat(Object.keys(meses).sort().map(function (m) { return [m, mesTxt(m)]; }))) +
        selector('medio', st.medio, [['', 'Cualquier medio'], ['avion', 'Avión'], ['auto', 'Auto'], ['bus', 'Bus']]) +
        selector('personas', st.personas, [['todas', 'Todas las personas'], ['repiten', 'Las que volvieron otro día'], ['una', 'Las que vinieron un solo día']]) +
        (st.tab === 'brecha' ? '<label class="dem-check"><input type="checkbox" data-dem-oferta' + (st.conOferta ? ' checked' : '') + '> incluir destinos con oferta</label>' : '') +
        '</div></div>';
    }
    function vistaBrecha(c) {
      var lista = c.lista.filter(function (r) { return st.conOferta || r.brecha; }), brechas = c.lista.filter(function (r) { return r.brecha; });
      var noAt = {}, sinVuelo = {}, paraCargar = {};
      brechas.forEach(function (r) { r.vis.forEach(function (v) { noAt[v] = 1; }); r.sinVis.forEach(function (v) { sinVuelo[v] = 1; }); if (!r.tours && r.personas >= 2) paraCargar[r.dest] = 1; });
      /* "no atendida" = no pidio reserva en ese destino */
      c.lista.forEach(function (r) { if (r.brecha) return; r.sinVis.forEach(function (v) { sinVuelo[v] = 1; }); });
      var h = '<section class="kpis kpis--4" aria-label="Resumen de demanda">' +
        kpi('Clusters con brecha', brechas.length, 'destino · mes · medio') +
        kpi('Personas con demanda no atendida', cuenta(noAt), 'cotizaron algo que no vendemos completo', cuenta(noAt) ? 'kpi--warn' : '') +
        kpi('Personas que no encontraron vuelo', cuenta(sinVuelo), 'la búsqueda de vuelos vino vacía o falló') +
        kpi('Destinos para cargar tours', cuenta(paraCargar), cuenta(paraCargar) ? Object.keys(paraCargar).map(nombre).join(', ') : '2 o más personas y sin tours', cuenta(paraCargar) ? 'kpi--ok' : '') + '</section>';
      h += '<div class="card uso-card"><h3 class="uso-h">Oportunidades rankeadas (personas únicas pesan más que búsquedas)</h3>';
      if (!lista.length) h += '<p class="vacio">' + (c.lista.length ? 'Todo lo que se cotizó tiene tours, traslado y vuelos. Tildá "incluir destinos con oferta" para ver quién no reservó.' : 'Todavía no hay cotizaciones en este período.') + '</p>';
      else {
        h += '<div class="dem-tabla"><table><thead><tr><th class="num">#</th><th>Destino · mes · medio</th><th class="num">Personas</th><th class="num">Búsquedas</th><th class="num">Sin vuelo</th><th class="num">Repiten</th><th class="num">Abandonan</th><th class="num">Reservaron otra cosa</th><th class="num">Pidieron acá</th><th class="num">Tours / traslado hoy</th><th>Qué falta</th></tr></thead><tbody>';
        lista.slice(0, 60).forEach(function (r, i) {
          var sv = r.medio !== 'avion' ? '—' : pct(r.sinV, r.conV);
          h += '<tr><td class="num" data-l="#">' + (i + 1) + '</td>' +
            '<td data-l="Cluster"><b>' + esc(nombre(r.dest)) + '</b> · ' + esc(mesTxt(r.mes)) + ' · ' + esc(MEDIOS[r.medio] || r.medio) + '</td>' +
            '<td class="num" data-l="Personas"><b>' + r.personas + '</b></td>' +
            '<td class="num" data-l="Búsquedas">' + r.busquedas + '</td>' +
            '<td class="num' + (r.conV && r.sinV / r.conV >= 0.5 ? ' dem-mal' : '') + '" data-l="Sin vuelo">' + sv + '</td>' +
            '<td class="num" data-l="Repiten">' + r.repiten + '</td>' +
            '<td class="num" data-l="Abandonan">' + r.abandonan + '</td>' +
            '<td class="num" data-l="Reservaron otra cosa">' + r.otra + '</td>' +
            '<td class="num" data-l="Pidieron acá">' + r.aca + '</td>' +
            '<td class="num' + (!r.tours || !r.traslado ? ' dem-mal' : '') + '" data-l="Tours / traslado hoy">' + r.tours + ' / ' + (r.traslado ? 'sí' : 'no') + '</td>' +
            '<td data-l="Qué falta">' + (r.falta.length ? '<span class="tags">' + r.falta.map(function (x) { return '<span class="tag dem-tag">' + esc(x) + '</span>'; }).join('') + '</span>' : '<span class="sub">nada: no cerró</span>') + '</td></tr>';
        });
        h += '</tbody></table></div>';
      }
      h += '</div>';
      /* lo que escribieron en los buscadores de destinos y no existe */
      var bs = Object.keys(c.buscados).map(function (t) { return { t: t, p: cuenta(c.buscados[t].v), n: c.buscados[t].n }; }).sort(function (a, b) { return b.p - a.p || b.n - a.n; }).slice(0, 25);
      h += '<div class="card uso-card"><h3 class="uso-h">Buscaron un destino que no tenemos</h3>' + (bs.length ? '<table><thead><tr><th>Lo que escribieron</th><th class="num">Personas</th><th class="num">Veces</th></tr></thead><tbody>' +
        bs.map(function (x) { return '<tr><td data-l="Escribieron">' + esc(x.t) + '</td><td class="num" data-l="Personas"><b>' + x.p + '</b></td><td class="num" data-l="Veces">' + x.n + '</td></tr>'; }).join('') + '</tbody></table>' :
        '<p class="vacio">Nadie buscó un destino que no esté en la lista.</p>') + '<p class="sub">De los buscadores de Destinos, Guías y Calcular (solo letras: lo escrito a medias o con números no se guarda).</p></div>';
      return h;
    }
    function vistaMes(c) {
      var pm = {};
      c.lista.forEach(function (r) {
        var x = pm[r.mes] || (pm[r.mes] = { vis: {}, busq: 0, dest: {}, sinV: 0, conV: 0 });
        r.vis.forEach(function (v) { x.vis[v] = 1; }); x.busq += r.busquedas; x.dest[r.dest] = (x.dest[r.dest] || 0) + r.personas; x.sinV += r.sinV; x.conV += r.conV;
      });
      var meses = Object.keys(pm).sort(function (a, b) { return (a || '9999') < (b || '9999') ? -1 : 1; });
      var max = Math.max.apply(null, meses.map(function (m) { return cuenta(pm[m].vis); }).concat([1]));
      var h = '<div class="card uso-card"><h3 class="uso-h">¿Para cuándo quieren viajar?</h3>';
      if (!meses.length) return h + '<p class="vacio">Todavía no hay cotizaciones en este período.</p></div>';
      h += '<table><thead><tr><th>Mes de viaje</th><th class="num">Personas</th><th class="num">Búsquedas</th><th class="num">Sin vuelo</th><th>Destinos más pedidos</th><th style="width:28%"></th></tr></thead><tbody>';
      meses.forEach(function (m) {
        var x = pm[m], n = cuenta(x.vis), top = Object.keys(x.dest).sort(function (a, b) { return x.dest[b] - x.dest[a]; }).slice(0, 3);
        h += '<tr><td data-l="Mes"><b>' + esc(mesTxt(m)) + '</b></td><td class="num" data-l="Personas"><b>' + n + '</b></td><td class="num" data-l="Búsquedas">' + x.busq + '</td>' +
          '<td class="num" data-l="Sin vuelo">' + pct(x.sinV, x.conV) + '</td>' +
          '<td data-l="Destinos">' + top.map(function (k) { return esc(nombre(k)) + ' (' + x.dest[k] + ')'; }).join(', ') + '</td>' +
          '<td data-l=""><span class="uso-barra" style="width:' + Math.max(2, Math.round(n / max * 100)) + '%"></span></td></tr>';
      });
      return h + '</tbody></table><p class="sub">Si nadie tocó las fechas, la web abre con 26/12 al 2/1: diciembre puede venir inflado.</p></div>';
    }
    function vista() {
      if (!st.datos && !st.cargando && !st.error) { setTimeout(cargar, 0); return '<div class="card"><p class="vacio">Cargando…</p></div>'; }
      var h = '<div class="vhead"><h2>' + (st.tab === 'mes' ? 'Demanda por mes de viaje' : 'Demanda insatisfecha · qué quieren que no tenemos') + '</h2></div>' + controles();
      if (st.cargando && !st.datos) return h + '<div class="card"><p class="vacio">Cargando…</p></div>';
      if (st.error) return h + '<p class="aviso">' + esc(st.error) + '</p>';
      if (st.datos.almacenamiento === 'memoria') h += '<p class="aviso">Sin Supabase: se guarda en memoria y se pierde al reiniciar. En producción hace falta correr supabase_demanda.sql.</p>';
      var c = calcular();
      h += st.tab === 'mes' ? vistaMes(c) : vistaBrecha(c);
      return h + '<p class="sub">Desde el 15/10/2026. Cuenta personas con un número al azar que guarda su navegador (sin nombre, correo ni IP). ' +
        'Tus visitas con sesión del panel abierta quedan como prueba.</p>';
    }

    /* ---------- eventos (solo los controles de esta pestana) ---------- */
    document.addEventListener('click', function (e) {
      if (ctx.S.vista !== 'demanda') return;
      var t = e.target.closest('[data-dem-tab],[data-dem-dias],[data-dem-prueba]');
      if (!t) return;
      if (t.hasAttribute('data-dem-tab')) { st.tab = t.getAttribute('data-dem-tab'); ctx.pintar(); }
      else if (t.hasAttribute('data-dem-dias')) { st.dias = +t.getAttribute('data-dem-dias'); cargar(); }
      else { st.prueba = !st.prueba; cargar(); }
    });
    document.addEventListener('change', function (e) {
      if (ctx.S.vista !== 'demanda') return;
      var f = e.target.getAttribute && e.target.getAttribute('data-dem-f');
      if (f) { st[f] = e.target.value; ctx.pintar(); }
      else if (e.target.hasAttribute && e.target.hasAttribute('data-dem-oferta')) { st.conOferta = e.target.checked; ctx.pintar(); }
    });

    /* estilos propios de la pestana */
    if (!document.getElementById('dem-css')) {
      var css = document.createElement('style'); css.id = 'dem-css';
      css.textContent = '.dem-bar{justify-content:space-between}.dem-filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
        '.dem-filtros select{width:auto;min-width:150px}.dem-check{display:inline-flex;gap:6px;align-items:center;font-size:13.5px;color:var(--muted)}.dem-check input{width:auto;min-height:0}' +
        '.dem-tabla{overflow-x:auto}.dem-mal{color:var(--bad);font-weight:600}.dem-tag{background:var(--badbg);color:var(--bad)}';
      document.head.appendChild(css);
    }
    return { vista: vista, cargar: cargar };
  };
})();
