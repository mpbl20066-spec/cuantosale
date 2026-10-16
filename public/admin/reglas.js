/* Disponibilidad y Temporadas y combos del Catalogo en el panel /admin (lib/reglas.js, /api/admin/reglas).

   - Disponibilidad: bloqueos de fechas (todo, un destino, un proveedor o un servicio), cupo por dia y dias que no opera
     cada servicio, y la ocupacion de los proximos 21 dias. La web saca de la reserva lo que no tiene lugar en las
     fechas del viaje y el server rechaza el pedido si igual llega.
   - Temporadas y combos: % sobre el precio en un rango de fechas que se repite cada año, descuento por combo y la
     cotizacion del real contra la de hoy (con el umbral del aviso diario por mail).

   Lo carga admin.js (vistaReglas) la primera vez que se abre una de las dos pantallas. */
(function () {
  var ALC = { todo: 'Todo el catálogo', destino: 'Un destino', proveedor: 'Un proveedor', servicio: 'Un servicio' };
  var APL = { todo: 'Tours y traslados', tours: 'Solo tours', traslados: 'Solo traslados' };
  var DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  window.CSReglasPanel = function (ctx) {
    var esc = ctx.esc, S = ctx.S;
    var st = { d: null, cargando: false, error: '', guardando: false, fb: { alcance: 'todo' }, fc: { no_opera: [] }, ft: { aplica: 'tours', destinos: [] }, fk: { min_tours: 2, con_traslado: true }, editCupo: null };

    function hoy() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
    function cargar() {
      if (st.cargando) return;
      st.cargando = true; st.error = '';
      ctx.api('reglas').then(function (j) { st.d = j; }).catch(function (e) { st.error = e.message; })
        .then(function () { st.cargando = false; if (mia()) ctx.pintar(); });
    }
    function mia() { return S.vista === 'disponibilidad' || S.vista === 'temporadas'; }
    function R() { return st.d.reglas; }
    function svc(clave) { return (st.d.servicios || []).filter(function (s) { return s.clave === clave; })[0]; }
    function nombreSvc(clave) { var s = svc(clave); return s ? s.titulo + ' · ' + s.destino : clave.replace('#', ' · '); }
    function nombreProv(id) { var p = (st.d.proveedores || []).filter(function (x) { return x.id === id; })[0]; return p ? p.nombre : 'Proveedor borrado'; }
    function fechaCorta(f) { var p = String(f || '').split('-'); return p.length === 3 ? +p[2] + '/' + +p[1] + '/' + p[0].slice(2) : f; }
    function mmdd(s) { var p = String(s || '').split('-'); return p.length === 2 ? +p[1] + '/' + +p[0] : s; }
    function pctTxt(n) { return (n > 0 ? '+' : '') + String(n).replace('.', ',') + ' %'; }
    function opcionesSvc(sel) {
      var por = {};
      (st.d.servicios || []).forEach(function (s) { (por[s.destino] = por[s.destino] || []).push(s); });
      return '<option value="">Elegí el servicio</option>' + Object.keys(por).sort().map(function (d) {
        return '<optgroup label="' + esc(d) + '">' + por[d].map(function (s) { return '<option value="' + esc(s.clave) + '"' + (s.clave === sel ? ' selected' : '') + '>' + esc(s.titulo) + '</option>'; }).join('') + '</optgroup>';
      }).join('');
    }
    function guardar(parte, valor, ok) {
      st.guardando = true; ctx.pintar();
      return ctx.api('reglas/guardar', { parte: parte, valor: valor }).then(function (j) {
        if (parte === 'alerta_cotizacion') R().alerta_cotizacion = j.valor; else R()[parte] = j.valor;
        ctx.toast(ok || 'Guardado'); st.guardando = false; cargar(); return true;
      }).catch(function (e) { st.guardando = false; ctx.toast(e.message); ctx.pintar(); return false; });
    }
    function aviso() {
      return st.d.modo === 'archivo' ? '<p class="aviso">Modo local: las reglas se guardan en data/_trabajo/reglas.json de esta computadora.</p>'
        : st.d.modo === 'sin-base' ? '<p class="aviso">Falta configurar Supabase: sin la base no se pueden guardar reglas.</p>' : '';
    }

    /* ---------- disponibilidad ---------- */
    function valorBloqueo(b) {
      if (b.alcance === 'todo') return 'Todo el catálogo';
      if (b.alcance === 'destino') return 'Destino ' + b.valor;
      if (b.alcance === 'proveedor') return nombreProv(b.valor);
      return nombreSvc(b.valor);
    }
    function vistaDisponibilidad() {
      var r = R(), h = hoy(), fb = st.fb, fc = st.fc;
      var vig = r.bloqueos.filter(function (b) { return b.hasta >= h; }).sort(function (a, b) { return a.desde.localeCompare(b.desde); });
      var viejos = r.bloqueos.length - vig.length;
      var html = '<div class="vhead"><div><h2>Disponibilidad</h2><p>Fechas en las que no se vende, cupo por día y días que no opera cada servicio. La web saca de la reserva lo que no tiene lugar en las fechas del viaje.</p></div></div>' + aviso();

      html += '<section class="card"><h3>Fechas bloqueadas</h3><p class="sub">Mantenimiento, clima, feriados o un proveedor de vacaciones. Si todos los días del viaje están bloqueados, el tour no se puede reservar en la web.</p>';
      html += vig.length ? '<div class="op-tabla"><table><thead><tr><th>Fechas</th><th>Qué</th><th>Motivo</th><th></th></tr></thead><tbody>' + vig.map(function (b) {
        return '<tr><td data-l="Fechas"><b>' + esc(b.desde === b.hasta ? fechaCorta(b.desde) : fechaCorta(b.desde) + ' al ' + fechaCorta(b.hasta)) + '</b>' + (b.desde <= h ? ' <span class="pill p-cancelado">vigente</span>' : '') + '</td>' +
          '<td data-l="Qué">' + esc(valorBloqueo(b)) + '</td><td data-l="Motivo">' + esc(b.motivo || '—') + '</td><td><button class="btn btn--sm" data-rg="quitar-bloqueo" data-id="' + esc(b.id) + '">Quitar</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vacio">No hay fechas bloqueadas.</p>';
      if (viejos) html += '<p class="sub">' + viejos + ' bloqueo(s) que ya pasaron. <button class="btn btn--sm" data-rg="limpiar-bloqueos">Borrarlos</button></p>';
      var valorSel = fb.alcance === 'destino' ? '<select data-fb="valor"><option value="">Elegí el destino</option>' + (st.d.destinos || []).map(function (d) { return '<option' + (fb.valor === d ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select>'
        : fb.alcance === 'proveedor' ? '<select data-fb="valor"><option value="">Elegí el proveedor</option>' + (st.d.proveedores || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (fb.valor === p.id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') + '</select>'
        : fb.alcance === 'servicio' ? '<select data-fb="valor">' + opcionesSvc(fb.valor) + '</select>' : '';
      html += '<div class="rg-form"><label class="f">Desde<input type="date" data-fb="desde" value="' + esc(fb.desde || '') + '"></label><label class="f">Hasta<input type="date" data-fb="hasta" value="' + esc(fb.hasta || '') + '"></label>' +
        '<label class="f">Qué se bloquea<select data-fb="alcance" data-repintar>' + Object.keys(ALC).map(function (k) { return '<option value="' + k + '"' + (fb.alcance === k ? ' selected' : '') + '>' + ALC[k] + '</option>'; }).join('') + '</select></label>' +
        (valorSel ? '<label class="f">' + (fb.alcance === 'destino' ? 'Destino' : fb.alcance === 'proveedor' ? 'Proveedor' : 'Servicio') + valorSel + '</label>' : '') +
        '<label class="f rg-ancho">Motivo<input data-fb="motivo" maxlength="200" value="' + esc(fb.motivo || '') + '" placeholder="Ej. Mantenimiento del barco"></label>' +
        '<button class="btn btn--main" data-rg="agregar-bloqueo"' + (st.guardando ? ' disabled' : '') + '>Bloquear fechas</button></div></section>';

      html += '<section class="card"><h3>Cupos y días que no opera</h3><p class="sub">Lo ocupado sale de los pedidos con el servicio confirmado o en gestión y su fecha asignada (Agenda). Cuenta las personas de cada pedido.</p>';
      html += r.cupos.length ? '<div class="op-tabla"><table><thead><tr><th>Servicio</th><th class="num">Cupo por día</th><th>No opera</th><th>Nota</th><th></th></tr></thead><tbody>' + r.cupos.map(function (c) {
        return '<tr><td data-l="Servicio"><b>' + esc(nombreSvc(c.clave)) + '</b>' + (svc(c.clave) ? '' : '<span class="sub op-warn">ya no está en el catálogo</span>') + '</td><td class="num" data-l="Cupo">' + (c.cupo_dia ? c.cupo_dia + ' pax' : '<span class="sub">sin límite</span>') + '</td>' +
          '<td data-l="No opera">' + (c.no_opera.length ? esc(c.no_opera.map(function (d) { return DOW[d]; }).join(', ')) : '<span class="sub">opera todos los días</span>') + '</td><td data-l="Nota">' + esc(c.nota || '') + '</td>' +
          '<td><div class="op-acc"><button class="btn btn--sm" data-rg="editar-cupo" data-k="' + esc(c.clave) + '">Editar</button><button class="btn btn--sm" data-rg="quitar-cupo" data-k="' + esc(c.clave) + '">Quitar</button></div></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vacio">Ningún servicio tiene cupo. Sin cupo se vende sin límite.</p>';
      html += '<div class="rg-form"><label class="f rg-ancho">Servicio<select data-fc="clave"' + (st.editCupo ? ' disabled' : '') + '>' + opcionesSvc(fc.clave) + '</select></label>' +
        '<label class="f">Cupo por día (personas)<input type="number" min="1" max="999" data-fc="cupo_dia" value="' + esc(fc.cupo_dia == null ? '' : fc.cupo_dia) + '" placeholder="Ej. 30"></label>' +
        '<div class="f"><span>No opera los</span><div class="rg-dias">' + DOW.map(function (n, i) { return '<label><input type="checkbox" data-fc-dow="' + i + '"' + (fc.no_opera.indexOf(i) >= 0 ? ' checked' : '') + '> ' + n + '</label>'; }).join('') + '</div></div>' +
        '<label class="f rg-ancho">Nota<input data-fc="nota" maxlength="200" value="' + esc(fc.nota || '') + '" placeholder="Ej. Buggy: 4 pax por vehículo, 5 vehículos"></label>' +
        '<div class="op-acc"><button class="btn btn--main" data-rg="guardar-cupo"' + (st.guardando ? ' disabled' : '') + '>' + (st.editCupo ? 'Guardar cambios' : 'Agregar cupo') + '</button>' + (st.editCupo ? '<button class="btn" data-rg="cancelar-cupo">Cancelar</button>' : '') + '</div></div></section>';

      var g = st.d.grilla || [];
      if (g.length) {
        var dias = g[0].dias;
        html += '<section class="card"><h3>Ocupación de los próximos 21 días</h3><div class="rg-grilla"><table><thead><tr><th>Servicio</th>' + dias.map(function (d) {
          var x = new Date(d.fecha + 'T12:00:00Z'); return '<th class="num">' + DOW[x.getUTCDay()].slice(0, 2) + '<br>' + x.getUTCDate() + '</th>';
        }).join('') + '</tr></thead><tbody>' + g.map(function (s) {
          return '<tr><td><b>' + esc(s.titulo) + '</b><span class="sub">' + (s.cupo_dia ? 'cupo ' + s.cupo_dia : 'sin cupo') + '</span></td>' + s.dias.map(function (d) {
            if (d.bloqueado) return '<td class="rg-c rg-c--bloq" title="' + esc(d.bloqueado) + '">✕</td>';
            if (d.cerrado) return '<td class="rg-c rg-c--cerr" title="No opera">—</td>';
            var lleno = s.cupo_dia && d.usado >= s.cupo_dia, casi = s.cupo_dia && d.usado >= s.cupo_dia * 0.8;
            return '<td class="rg-c' + (lleno ? ' rg-c--lleno' : casi ? ' rg-c--casi' : d.usado ? ' rg-c--algo' : '') + '" title="' + d.usado + (s.cupo_dia ? ' de ' + s.cupo_dia : '') + ' personas">' + (d.usado || '') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div><p class="sub">Número = personas reservadas ese día. Amarillo: 80 % o más del cupo; rojo: lleno; ✕: bloqueado; —: no opera.</p></section>';
      }
      return html;
    }

    /* ---------- temporadas, combos y cotizacion ---------- */
    function vistaTemporadas() {
      var r = R(), c = st.d.cotizacion || {}, ft = st.ft, fk = st.fk;
      var html = '<div class="vhead"><div><h2>Temporadas y combos</h2><p>Recargos o descuentos por fecha, descuentos por combo y la cotización del real que usa el catálogo.</p></div></div>' + aviso();

      html += '<section class="card' + (c.alerta ? ' rg-alerta' : '') + '"><h3>Cotización del real</h3>';
      if (!c.publicada) html += '<p class="sub">Sin cotización cargada en el catálogo (hace falta Supabase).</p>';
      else {
        html += '<section class="kpis kpis--4">' + ctx.kpi('En el catálogo', 'R$ ' + String(c.publicada).replace('.', ','), c.fuente || 'por dólar') +
          ctx.kpi('Hoy', c.mercado ? 'R$ ' + String(c.mercado).replace('.', ',') : '—', c.fuente_mercado || 'cotización del día') +
          ctx.kpi('Diferencia', c.dif_pct == null ? '—' : pctTxt(c.dif_pct), c.dif_pct == null ? '' : (c.dif_pct > 0 ? 'el real se abarató' : c.dif_pct < 0 ? 'el real se encareció: tu margen se achica' : 'igual'), c.alerta ? 'kpi--warn' : 'kpi--ok') +
          ctx.kpi('Aviso por mail', 'desde ' + String(c.umbral_pct).replace('.', ',') + ' %', 'una vez por día, con el cron') + '</section>';
        if (c.alerta) html += '<p class="aviso">La cotización de hoy se alejó ' + esc(pctTxt(c.dif_pct)) + ' de la del catálogo. Los precios de los tours en reales ' + (c.dif_pct < 0 ? 'te cuestan más dólares de lo que cobrás.' : 'te cuestan menos dólares de lo que cobrás: podés bajarlos.') + '</p>';
        html += '<div class="op-acc">' + (c.mercado ? '<button class="btn btn--main" data-rg="usar-hoy"' + (st.guardando ? ' disabled' : '') + '>Usar la de hoy (R$ ' + String(c.mercado).replace('.', ',') + ')</button>' : '') +
          '<label class="f rg-inline">Avisarme desde<input type="number" min="0.5" max="50" step="0.5" id="rg-umbral" value="' + esc(c.umbral_pct) + '"> %</label><button class="btn" data-rg="umbral">Guardar umbral</button></div>' +
          '<p class="sub">"Usar la de hoy" recalcula los precios en dólares de los tours en reales: quedan en "Por publicar" para que los revises antes de que lleguen a la web.</p>';
      }
      html += '</section>';

      html += '<section class="card"><h3>Temporadas</h3><p class="sub">Un % sobre el precio de venta según la fecha de ida del viaje. Se repite todos los años. Si dos temporadas coinciden, gana la del destino sobre la general y, entre iguales, la de mayor %.</p>';
      html += r.temporadas.length ? '<div class="op-tabla"><table><thead><tr><th>Temporada</th><th>Fechas</th><th class="num">%</th><th>Aplica a</th><th>Destinos</th><th></th></tr></thead><tbody>' + r.temporadas.map(function (t) {
        return '<tr' + (t.activo === false ? ' class="rg-off"' : '') + '><td data-l="Temporada"><b>' + esc(t.nombre) + '</b></td><td data-l="Fechas">' + esc(mmdd(t.desde) + ' al ' + mmdd(t.hasta)) + '</td><td class="num" data-l="%"><b class="' + (t.pct > 0 ? 'deuda' : 'ok') + '">' + esc(pctTxt(t.pct)) + '</b></td>' +
          '<td data-l="Aplica a">' + esc(APL[t.aplica]) + '</td><td data-l="Destinos">' + esc(t.destinos.length ? t.destinos.join(', ') : 'Todos') + '</td>' +
          '<td><div class="op-acc"><button class="btn btn--sm" data-rg="toggle-temp" data-id="' + esc(t.id) + '">' + (t.activo === false ? 'Activar' : 'Pausar') + '</button><button class="btn btn--sm" data-rg="quitar-temp" data-id="' + esc(t.id) + '">Quitar</button></div></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vacio">Sin temporadas: se vende al precio publicado todo el año.</p>';
      html += '<div class="rg-form"><label class="f">Nombre<input data-ft="nombre" maxlength="80" value="' + esc(ft.nombre || '') + '" placeholder="Ej. Alta temporada"></label>' +
        '<label class="f">Desde (día y mes)<input type="date" data-ft="desde" value="' + esc(ft.desde || '') + '"></label><label class="f">Hasta (día y mes)<input type="date" data-ft="hasta" value="' + esc(ft.hasta || '') + '"></label>' +
        '<label class="f">% sobre el precio<input type="number" step="0.5" min="-50" max="200" data-ft="pct" value="' + esc(ft.pct == null ? '' : ft.pct) + '" placeholder="Ej. 15 o -10"></label>' +
        '<label class="f">Aplica a<select data-ft="aplica">' + Object.keys(APL).map(function (k) { return '<option value="' + k + '"' + (ft.aplica === k ? ' selected' : '') + '>' + APL[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="f rg-ancho">Destinos (ninguno = todos)<select multiple size="5" data-ft-dest>' + (st.d.destinos || []).map(function (d) { return '<option' + (ft.destinos.indexOf(d) >= 0 ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label>' +
        '<button class="btn btn--main" data-rg="agregar-temp"' + (st.guardando ? ' disabled' : '') + '>Agregar temporada</button></div>' +
        '<p class="sub">Del año de las fechas solo se toman el día y el mes: "15/12 al 31/1" cruza el año. El precio publicado del catálogo no cambia; la web y la propuesta muestran el precio con la temporada.</p></section>';

      html += '<section class="card"><h3>Combos</h3><p class="sub">Descuento automático sobre los tours cuando el cliente arma un paquete. La web aplica el mejor combo que corresponda y lo muestra en la reserva.</p>';
      html += r.combos.length ? '<div class="op-tabla"><table><thead><tr><th>Combo</th><th>Condición</th><th class="num">Descuento</th><th></th></tr></thead><tbody>' + r.combos.map(function (k) {
        return '<tr' + (k.activo === false ? ' class="rg-off"' : '') + '><td data-l="Combo"><b>' + esc(k.nombre) + '</b></td><td data-l="Condición">' + esc([k.con_traslado ? 'Traslado' : '', k.min_tours ? k.min_tours + ' tour' + (k.min_tours === 1 ? '' : 's') + ' o más' : ''].filter(Boolean).join(' + ')) + '</td>' +
          '<td class="num" data-l="Descuento"><b class="ok">−' + esc(String(k.pct).replace('.', ',')) + ' %</b> en los tours</td>' +
          '<td><div class="op-acc"><button class="btn btn--sm" data-rg="toggle-combo" data-id="' + esc(k.id) + '">' + (k.activo === false ? 'Activar' : 'Pausar') + '</button><button class="btn btn--sm" data-rg="quitar-combo" data-id="' + esc(k.id) + '">Quitar</button></div></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vacio">Sin combos.</p>';
      html += '<div class="rg-form"><label class="f">Nombre<input data-fk="nombre" maxlength="80" value="' + esc(fk.nombre || '') + '" placeholder="Ej. Transfer + 2 tours"></label>' +
        '<label class="f">Tours mínimos<input type="number" min="0" max="10" data-fk="min_tours" value="' + esc(fk.min_tours == null ? '' : fk.min_tours) + '"></label>' +
        '<label class="op-check rg-check"><input type="checkbox" data-fk-tras' + (fk.con_traslado ? ' checked' : '') + '> Con traslado del aeropuerto</label>' +
        '<label class="f">% de descuento<input type="number" min="0.5" max="50" step="0.5" data-fk="pct" value="' + esc(fk.pct == null ? '' : fk.pct) + '" placeholder="Ej. 5"></label>' +
        '<button class="btn btn--main" data-rg="agregar-combo"' + (st.guardando ? ' disabled' : '') + '>Agregar combo</button></div></section>';
      return html;
    }

    function vista() {
      if (!st.d) {
        if (!st.cargando && !st.error) cargar();
        return st.error ? '<p class="aviso">' + esc(st.error) + ' <button class="btn btn--sm" data-rg="reintentar">Reintentar</button></p>' : '<div class="card"><p class="vacio">Cargando…</p></div>';
      }
      return S.vista === 'temporadas' ? vistaTemporadas() : vistaDisponibilidad();
    }

    /* ---------- eventos ---------- */
    function quitar(parte, campo, v) { return R()[parte].filter(function (x) { return x[campo] !== v; }); }
    function cambiar(parte, idv, fn) { return R()[parte].map(function (x) { return x.id === idv ? fn(Object.assign({}, x)) : x; }); }
    function mmddDe(fecha) { return /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') ? fecha.slice(5) : ''; }
    document.addEventListener('click', function (e) {
      if (!mia()) return;
      var t = e.target.closest('[data-rg]'); if (!t) return;
      var a = t.getAttribute('data-rg'), idv = t.getAttribute('data-id'), k = t.getAttribute('data-k');
      if (a === 'reintentar') { st.error = ''; return cargar(); }
      if (a === 'quitar-bloqueo') return guardar('bloqueos', quitar('bloqueos', 'id', idv), 'Bloqueo quitado');
      if (a === 'limpiar-bloqueos') return guardar('bloqueos', R().bloqueos.filter(function (b) { return b.hasta >= hoy(); }), 'Listo');
      if (a === 'agregar-bloqueo') {
        var b = st.fb;
        return guardar('bloqueos', R().bloqueos.concat([{ desde: b.desde, hasta: b.hasta || b.desde, alcance: b.alcance, valor: b.valor || '', motivo: b.motivo || '' }]), 'Fechas bloqueadas').then(function (ok) { if (ok) st.fb = { alcance: b.alcance }; ctx.pintar(); });
      }
      if (a === 'editar-cupo') { var c = R().cupos.filter(function (x) { return x.clave === k; })[0]; st.editCupo = k; st.fc = { clave: k, cupo_dia: c.cupo_dia, no_opera: c.no_opera.slice(), nota: c.nota }; return ctx.pintar(); }
      if (a === 'cancelar-cupo') { st.editCupo = null; st.fc = { no_opera: [] }; return ctx.pintar(); }
      if (a === 'quitar-cupo') return guardar('cupos', quitar('cupos', 'clave', k), 'Cupo quitado');
      if (a === 'guardar-cupo') {
        var f = st.fc, fila = { clave: f.clave, cupo_dia: f.cupo_dia, no_opera: f.no_opera, nota: f.nota || '' };
        var lista = st.editCupo ? R().cupos.map(function (x) { return x.clave === st.editCupo ? fila : x; }) : R().cupos.concat([fila]);
        return guardar('cupos', lista, 'Cupo guardado').then(function (ok) { if (ok) { st.editCupo = null; st.fc = { no_opera: [] }; } ctx.pintar(); });
      }
      if (a === 'agregar-temp') {
        var tt = st.ft;
        return guardar('temporadas', R().temporadas.concat([{ nombre: tt.nombre, desde: mmddDe(tt.desde), hasta: mmddDe(tt.hasta), pct: tt.pct, aplica: tt.aplica, destinos: tt.destinos }]), 'Temporada agregada')
          .then(function (ok) { if (ok) st.ft = { aplica: 'tours', destinos: [] }; ctx.pintar(); });
      }
      if (a === 'toggle-temp') return guardar('temporadas', cambiar('temporadas', idv, function (x) { x.activo = x.activo === false; return x; }));
      if (a === 'quitar-temp') return guardar('temporadas', quitar('temporadas', 'id', idv), 'Temporada quitada');
      if (a === 'agregar-combo') {
        var kk = st.fk;
        return guardar('combos', R().combos.concat([{ nombre: kk.nombre, min_tours: kk.min_tours, con_traslado: !!kk.con_traslado, pct: kk.pct }]), 'Combo agregado')
          .then(function (ok) { if (ok) st.fk = { min_tours: 2, con_traslado: true }; ctx.pintar(); });
      }
      if (a === 'toggle-combo') return guardar('combos', cambiar('combos', idv, function (x) { x.activo = x.activo === false; return x; }));
      if (a === 'quitar-combo') return guardar('combos', quitar('combos', 'id', idv), 'Combo quitado');
      if (a === 'umbral') return guardar('alerta_cotizacion', { umbral_pct: document.getElementById('rg-umbral').value }, 'Umbral guardado');
      if (a === 'usar-hoy') {
        var co = st.d.cotizacion, m = co.margen || { tipo: 'usd', valor: 0 };
        var cuerpo = { cotizacion: co.mercado, margen_tipo: m.tipo, margen_valor: m.valor, cotizacion_fuente: 'Cotización del día ' + hoy().split('-').reverse().join('/') + (co.fuente_mercado ? ' (' + co.fuente_mercado + ')' : '') };
        st.guardando = true; ctx.pintar();
        return ctx.api('ops/config', Object.assign({ simular: true }, cuerpo)).then(function (sim) {
          var n = sim && (sim.cambian != null ? sim.cambian : sim.total);
          if (!confirm('¿Pasar el catálogo a R$ ' + co.mercado + ' por dólar?' + (n != null ? '\n' + n + ' precio(s) quedan en "Por publicar" para revisar.' : ''))) return null;
          return ctx.api('ops/config', cuerpo).then(function () { ctx.toast('Cotización actualizada: revisá "Por publicar"'); if (ctx.recargarOps) ctx.recargarOps(); });
        }).catch(function (er) { ctx.toast(er.message); }).then(function () { st.guardando = false; st.d = null; cargar(); });
      }
    });
    /* Los formularios guardan lo que se escribe sin repintar (asi no se pierde el foco); solo "Qué se bloquea" repinta,
       porque cambia el campo de al lado. */
    function campo(e) {
      if (!mia()) return;
      var el = e.target, v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.hasAttribute('data-fb')) { st.fb[el.getAttribute('data-fb')] = v; if (el.hasAttribute('data-repintar') && e.type === 'change') { st.fb.valor = ''; ctx.pintar(); } return; }
      if (el.hasAttribute('data-fc')) { st.fc[el.getAttribute('data-fc')] = v; return; }
      if (el.hasAttribute('data-fc-dow')) { var d = +el.getAttribute('data-fc-dow'), l = st.fc.no_opera.filter(function (x) { return x !== d; }); if (el.checked) l.push(d); st.fc.no_opera = l.sort(); return; }
      if (el.hasAttribute('data-ft')) { st.ft[el.getAttribute('data-ft')] = v; return; }
      if (el.hasAttribute('data-ft-dest')) { st.ft.destinos = Array.prototype.filter.call(el.options, function (o) { return o.selected; }).map(function (o) { return o.value; }); return; }
      if (el.hasAttribute('data-fk')) { st.fk[el.getAttribute('data-fk')] = v; return; }
      if (el.hasAttribute('data-fk-tras')) { st.fk.con_traslado = el.checked; return; }
    }
    document.addEventListener('input', campo);
    document.addEventListener('change', campo);

    if (!document.getElementById('rg-css')) {
      var css = document.createElement('style'); css.id = 'rg-css';
      css.textContent = '.rg-form{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}.rg-form .f{min-width:150px;flex:0 1 auto}.rg-form .rg-ancho{flex:1 1 240px}' +
        '.rg-dias{display:flex;flex-wrap:wrap;gap:8px;font-size:14px;padding-top:6px}.rg-dias label{display:inline-flex;gap:4px;align-items:center}.rg-check{padding-bottom:10px}.rg-inline{display:inline-flex;align-items:center;gap:6px;flex-direction:row}.rg-inline input{width:80px}' +
        '.rg-grilla{overflow-x:auto}.rg-grilla table{font-size:13px}.rg-grilla td,.rg-grilla th{padding:6px 5px}.rg-c{text-align:center;min-width:30px;border-radius:6px}.rg-c--algo{background:var(--infobg);color:var(--info)}' +
        '.rg-c--casi{background:var(--warnbg);color:var(--warn);font-weight:700}.rg-c--lleno{background:var(--badbg);color:var(--bad);font-weight:800}.rg-c--bloq{background:var(--badbg);color:var(--bad)}.rg-c--cerr{color:var(--muted)}' +
        '.rg-off{opacity:.55}.rg-alerta{border-color:var(--warn)}.card h3{margin:0 0 4px}';
      document.head.appendChild(css);
    }
    return { vista: vista, recargar: function () { st.d = null; cargar(); } };
  };
})();
