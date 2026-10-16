/* Agenda de servicios (Pedidos) y Compradores (Clientes) del panel /admin.

   - Agenda: una fila por servicio, no por pedido: fecha y hora, pickup, proveedor, cliente, pago y estado. Es lo que
     hay que mirar cada dia para que nadie se quede esperando en el hotel.
   - Compradores: los clientes que hicieron pedidos, juntados por WhatsApp (o email), con su historial y una ficha
     propia (pais, alerta y notas) que se guarda en lib/operativa.js. La alerta se ve en rojo en la ficha del pedido y
     en la agenda.

   Estado de cada servicio en la agenda (sale de lo que ya hay, no se guarda aparte):
     cancelada        el servicio o el pedido estan cancelados
     finalizada       el pedido esta completado, o la fecha del servicio ya paso
     en_curso         el servicio es hoy y esta confirmado
     por_confirmar    el proveedor todavia no lo confirmo
     pendiente_pago   confirmado, pero el cliente no pago la sena
     confirmada       confirmado y con la sena paga

   - Salidas y manifiestos: lo que sale cada dia, agrupado por servicio, hora y proveedor (lib/operativa.js), con el
     manifiesto en PDF, el WhatsApp al guia o chofer y "Suspender salida" (clima) con aviso a cada cliente.
   - Cancelaciones: lo que hay que devolverle a cada cliente, lo que cada proveedor nos debe devolver y las salidas
     suspendidas sin resolver.
   - Rentabilidad (en Finanzas): facturado, costo y margen por destino, servicio, proveedor o tipo, con CSV.

   Lo carga admin.js (vistaOp) la primera vez que se abre una de estas pantallas. */
(function () {
  var EST = { por_confirmar: 'Por confirmar', pendiente_pago: 'Pendiente de pago', confirmada: 'Confirmada', en_curso: 'En curso', finalizada: 'Finalizada', cancelada: 'Cancelada' };
  var EST_CLS = { por_confirmar: 'p-consultado', pendiente_pago: 'p-pendiente', confirmada: 'p-confirmado', en_curso: 'p-nuevo', finalizada: 'p-completado', cancelada: 'p-cancelado' };
  var PAGO = { sin_pago: 'Sin pago', parcial: 'Seña / parcial', pagado: 'Pagado' };
  var TIPO = { traslado: 'Traslado', tour: 'Tour', vuelo: 'Vuelo', alojamiento: 'Alojamiento', otro: 'Otro' };
  var PAISES = { '598': 'Uruguay', '55': 'Brasil', '54': 'Argentina', '56': 'Chile', '595': 'Paraguay', '591': 'Bolivia', '51': 'Perú', '57': 'Colombia', '52': 'México', '34': 'España', '1': 'EE. UU. / Canadá' };

  window.CSOperativaPanel = function (ctx) {
    var esc = ctx.esc, S = ctx.S;
    var st = { estado: 'activos', rango: 'proximos', prov: '', q: '', qCli: '', ficha: null, guardando: false };

    function hoy() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
    function mas(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
    function pedidos() { return (S.datos && S.datos.pedidos) || []; }
    function fichas() { return (S.fichas && S.fichas.fichas) || []; }
    function fichaDe(clave) { return fichas().filter(function (f) { return f.clave === clave; })[0] || null; }
    function pill(cls, t) { return '<span class="pill ' + cls + '">' + esc(t) + '</span>'; }
    function diaTxt(f) { if (!f) return ''; var d = new Date(f + 'T12:00:00Z'); return ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getUTCDay()] + ' ' + ctx.fecha(f); }

    /* ---------- agenda ---------- */
    function estadoDe(p, i, c) {
      var f = i.fecha_servicio || p.fecha_ida, h = hoy();
      if (p.estado === 'cancelado' || i.estado === 'cancelado') return 'cancelada';
      if (p.estado === 'completado' || (f && f < h)) return 'finalizada';
      if (i.estado !== 'confirmado') return 'por_confirmar';
      if (f === h) return 'en_curso';
      return c.senaPend > 0 || c.cobrado <= 0 ? 'pendiente_pago' : 'confirmada';
    }
    function filas() {
      var out = [];
      pedidos().forEach(function (p) {
        var c = ctx.calc(p), clave = ctx.claveCli(p), fi = fichaDe(clave);
        (p.items || []).forEach(function (i, n) {
          if (!i.nombre || i.tipo === 'vuelo' || i.tipo === 'alojamiento') return;   // vuelos y alojamiento se reservan afuera
          out.push({ p: p, i: i, n: n, c: c, f: i.fecha_servicio || p.fecha_ida || '', propia: !!i.fecha_servicio, est: estadoDe(p, i, c), alerta: fi && fi.alerta });
        });
      });
      return out.sort(function (a, b) { return (a.f || '9999').localeCompare(b.f || '9999') || (a.i.hora || '99').localeCompare(b.i.hora || '99'); });
    }
    function enRango(x) {
      var h = hoy();
      if (st.rango === 'hoy') return x.f === h;
      if (st.rango === 'manana') return x.f === mas(h, 1);
      if (st.rango === 'semana') return x.f >= h && x.f <= mas(h, 7);
      if (st.rango === 'proximos') return !x.f || x.f >= h;
      if (st.rango === 'pasados') return x.f && x.f < h;
      return true;
    }
    function avisos(x) {
      var a = [], h = hoy(), cerca = x.f && x.f >= h && x.f <= mas(h, 3);
      if (x.est === 'cancelada' || x.est === 'finalizada') return a;
      if (!x.propia) a.push('sin fecha propia');
      if (!x.i.proveedor_id && !x.i.proveedor_nombre) a.push('sin proveedor');
      if (cerca && !x.i.pickup && x.i.tipo === 'traslado') a.push('falta pickup');
      if (cerca && !x.i.hora) a.push('falta hora');
      if (cerca && !(x.p.pasajeros || []).length) a.push('sin pasajeros');
      return a;
    }
    function vistaAgenda() {
      var todas = filas().filter(enRango);
      var provs = {}; filas().forEach(function (x) { if (x.i.proveedor_nombre) provs[x.i.proveedor_nombre] = 1; });
      var q = st.q.toLowerCase().trim();
      var base = todas.filter(function (x) { return (!st.prov || x.i.proveedor_nombre === st.prov) && (!q || [x.p.cliente_nombre, x.p.ref, x.i.nombre, x.i.pickup, x.i.proveedor_nombre, x.p.destino].join(' ').toLowerCase().indexOf(q) >= 0); });
      var cuenta = function (e) { return base.filter(function (x) { return e === 'activos' ? x.est !== 'cancelada' && x.est !== 'finalizada' : (e === 'todos' || x.est === e); }).length; };
      var lista = base.filter(function (x) { return st.estado === 'todos' || (st.estado === 'activos' ? x.est !== 'cancelada' && x.est !== 'finalizada' : x.est === st.estado); });
      var chip = function (k, v, t, n) { return '<button class="chip" data-op-f="' + k + '" data-v="' + v + '" aria-pressed="' + (st[k] === v) + '">' + esc(t) + (n != null ? '<span>' + n + '</span>' : '') + '</button>'; };
      var h = '<div class="vhead"><div><h2>Agenda de servicios</h2><p>Cada tour y traslado con su fecha, hora y pickup.</p></div></div>' +
        '<div class="bar op-bar"><div class="chips">' + [['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', 'Próximos 7 días'], ['proximos', 'Todos los próximos'], ['pasados', 'Ya pasaron'], ['todo', 'Todo']].map(function (r) { return chip('rango', r[0], r[1]); }).join('') + '</div>' +
        '<div class="op-filtros"><select data-op-sel="prov" aria-label="Proveedor"><option value="">Proveedor: todos</option>' + Object.keys(provs).sort().map(function (n) { return '<option' + (st.prov === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
        '<input type="search" data-op-q="q" placeholder="Buscar cliente, servicio, hotel" value="' + esc(st.q) + '" aria-label="Buscar"></div></div>' +
        '<div class="bar"><div class="chips">' + chip('estado', 'activos', 'Activos', cuenta('activos')) + ['por_confirmar', 'pendiente_pago', 'confirmada', 'en_curso', 'finalizada', 'cancelada'].map(function (e) { return chip('estado', e, EST[e], cuenta(e)); }).join('') + chip('estado', 'todos', 'Todos', cuenta('todos')) + '</div></div>';
      if (!lista.length) return h + '<div class="card"><p class="vacio">' + (pedidos().length ? 'No hay servicios con este filtro.' : 'Todavía no hay pedidos.') + '</p></div>';
      h += '<div class="card op-tabla"><table><thead><tr><th>Fecha · hora</th><th>Servicio</th><th>Cliente</th><th>Pickup / salida</th><th>Proveedor</th><th>Pago</th><th class="num">Total</th><th>Estado</th></tr></thead><tbody>';
      lista.forEach(function (x) {
        var av = avisos(x), ep = x.p.cuentas ? x.p.cuentas.estado_pago : (x.c.cobrado > 0 ? (x.c.saldo > 0 ? 'parcial' : 'pagado') : 'sin_pago');
        h += '<tr class="row' + (x.f === hoy() ? ' op-hoy' : '') + '" data-abrir="' + esc(x.p.id) + '">' +
          '<td data-l="Fecha"><b>' + esc(x.f ? diaTxt(x.f) : 'Sin fecha') + '</b><span class="sub">' + esc(x.i.hora ? x.i.hora + ' h' : 'sin hora') + (x.f && !x.propia ? ' · fecha del viaje' : '') + '</span></td>' +
          '<td data-l="Servicio">' + esc(x.i.nombre) + '<span class="sub">' + esc((TIPO[x.i.tipo] || '') + (x.p.destino ? ' · ' + x.p.destino : '')) + '</span></td>' +
          '<td data-l="Cliente"><b>' + esc(x.p.cliente_nombre || '—') + '</b><span class="sub">' + esc(x.p.personas + ' pers. · ' + String(x.p.ref || '').split('-').pop()) + '</span>' + (x.alerta ? '<span class="op-alerta">⚠ ' + esc(x.alerta) + '</span>' : '') + '</td>' +
          '<td data-l="Pickup">' + (x.i.pickup ? esc(x.i.pickup) : '<span class="sub">—</span>') + '</td>' +
          '<td data-l="Proveedor">' + esc(x.i.proveedor_nombre || '—') + (x.i.ref_proveedor ? '<span class="sub">cód. ' + esc(x.i.ref_proveedor) + '</span>' : '') + '</td>' +
          '<td data-l="Pago">' + pill('p-' + ep, PAGO[ep] || ep) + '</td>' +
          '<td class="num" data-l="Total">' + esc(ctx.usd(x.i.precio_usd)) + '</td>' +
          '<td data-l="Estado">' + pill(EST_CLS[x.est], EST[x.est]) + (av.length ? '<span class="sub op-warn">' + esc(av.join(' · ')) + '</span>' : '') + '</td></tr>';
      });
      return h + '</tbody></table></div><p class="sub">Tocá una fila para abrir el pedido y completar fecha, hora, pickup y pasajeros.</p>';
    }

    /* ---------- compradores ---------- */
    function clientes() {
      var g = {};
      pedidos().forEach(function (p) {
        var k = ctx.claveCli(p) || 'ref:' + p.id;
        var x = g[k] || (g[k] = { clave: k, nombre: '', tel: '', email: '', pedidos: [], gastado: 0, ultimo: '' });
        x.pedidos.push(p);
        if (!x.nombre && p.cliente_nombre) x.nombre = p.cliente_nombre;
        if (!x.tel && p.cliente_telefono) x.tel = p.cliente_telefono;
        if (!x.email && p.cliente_email) x.email = p.cliente_email;
        if (p.estado !== 'cancelado') x.gastado += (p.cuentas && p.cuentas.total_usd) || 0;
        var f = p.fecha_ida || String(p.created_at || '').slice(0, 10);
        if (f > x.ultimo) x.ultimo = f;
      });
      return Object.keys(g).map(function (k) { var x = g[k]; x.ficha = fichaDe(k); return x; });
    }
    function paisDe(x) {
      if (x.ficha && x.ficha.pais) return x.ficha.pais;
      var d = /^tel:(\d+)/.exec(x.clave); if (!d) return '';
      var pref = ['598', '595', '591', '55', '54', '56', '51', '57', '52', '34', '1'].filter(function (p) { return d[1].indexOf(p) === 0; })[0];
      return pref ? PAISES[pref] : '';
    }
    function vistaClientes() {
      if (!S.fichas) { ctx.cargarFichas().then(function () { if (S.vista === 'clientes') ctx.pintar(); }); }
      if (S.opFicha) { st.ficha = S.opFicha; S.opFicha = null; }
      var todos = clientes();
      if (st.ficha) { var f = todos.filter(function (x) { return x.clave === st.ficha; })[0]; if (f) return vistaFicha(f); st.ficha = null; }
      var q = st.qCli.toLowerCase().trim();
      var lista = todos.filter(function (x) { return !q || [x.nombre, x.tel, x.email, paisDe(x)].join(' ').toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return b.ultimo.localeCompare(a.ultimo); });
      var h = '<div class="vhead"><div><h2>Compradores</h2><p>' + todos.length + ' cliente(s) con pedidos. Los usuarios con cuenta en la web están en "Usuarios de la web".</p></div></div>' +
        (S.fichas && S.fichas.sinTabla ? '<p class="aviso">Para guardar alertas y notas de clientes falta correr supabase_operativa_1.sql en Supabase.</p>' : '') +
        '<div class="bar"><input type="search" data-op-q="qCli" placeholder="Buscar por nombre, WhatsApp, email o país" value="' + esc(st.qCli) + '" aria-label="Buscar cliente"></div>';
      if (!lista.length) return h + '<div class="card"><p class="vacio">' + (todos.length ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay pedidos.') + '</p></div>';
      h += '<div class="card op-tabla"><table><thead><tr><th>Cliente</th><th>Contacto</th><th>País</th><th class="num">Pedidos</th><th class="num">Comprado</th><th>Último viaje</th></tr></thead><tbody>';
      lista.forEach(function (x) {
        h += '<tr class="row" data-op-ficha="' + esc(x.clave) + '"><td data-l="Cliente"><b>' + esc(x.nombre || '—') + '</b>' + (x.ficha && x.ficha.alerta ? '<span class="op-alerta">⚠ ' + esc(x.ficha.alerta) + '</span>' : '') + '</td>' +
          '<td data-l="Contacto">' + esc(x.tel || '—') + '<span class="sub">' + esc(x.email || '') + '</span></td><td data-l="País">' + esc(paisDe(x) || '—') + '</td>' +
          '<td class="num" data-l="Pedidos">' + x.pedidos.length + '</td><td class="num" data-l="Comprado">' + esc(ctx.usd(x.gastado)) + '</td><td data-l="Último viaje">' + esc(x.ultimo ? ctx.fecha(x.ultimo) : '—') + '</td></tr>';
      });
      return h + '</tbody></table></div>';
    }
    function vistaFicha(x) {
      var fi = x.ficha || {}, tel = (/^tel:(\d+)/.exec(x.clave) || [])[1];
      var guardable = /^(tel|mail):/.test(x.clave) && !(S.fichas && S.fichas.sinTabla);
      var h = '<div class="vhead"><div><button class="btn btn--sm" data-op="volver">← Compradores</button><h2 style="margin-top:10px">' + esc(x.nombre || 'Cliente') + '</h2>' +
        '<p>' + esc([x.tel, x.email, paisDe(x)].filter(Boolean).join(' · ')) + '</p></div><div class="op-acc">' +
        (tel ? '<button class="btn btn--wa-borde" data-op="chat" data-tel="' + esc(tel) + '">Abrir chat de WhatsApp</button>' : '') +
        (x.email ? '<a class="btn" href="mailto:' + esc(x.email) + '">Email</a>' : '') + '</div></div>';
      h += '<div class="op-ficha"><section class="sec"><h3>Ficha</h3><div class="grid" style="grid-template-columns:1fr">' +
        '<label class="f">País de origen<input id="op-pais" value="' + esc(fi.pais || paisDe(x)) + '" placeholder="Uruguay"' + (guardable ? '' : ' disabled') + '></label>' +
        '<label class="f">Alerta operativa (se ve en rojo en sus pedidos y en la agenda)<input id="op-alerta" value="' + esc(fi.alerta || '') + '" placeholder="Ej. Requiere silla de bebé en el traslado"' + (guardable ? '' : ' disabled') + '></label>' +
        '<label class="f">Notas<textarea id="op-notas" rows="4" placeholder="Lo que conviene saber de este cliente"' + (guardable ? '' : ' disabled') + '>' + esc(fi.notas || '') + '</textarea></label></div>' +
        (guardable ? '<div class="op-acc" style="margin-top:10px"><button class="btn btn--main" data-op="guardar-ficha"' + (st.guardando ? ' disabled' : '') + '>' + (st.guardando ? 'Guardando…' : 'Guardar ficha') + '</button>' + (fi.actualizado_at ? '<span class="sub">Editada ' + esc(ctx.fechaHora(fi.actualizado_at)) + '</span>' : '') + '</div>'
          : '<p class="sub">' + (S.fichas && S.fichas.sinTabla ? 'Falta correr supabase_operativa_1.sql para guardar la ficha.' : 'Este cliente no dejó WhatsApp ni email: no se puede guardar una ficha.') + '</p>') + '</section>';
      h += '<section class="sec"><h3>Historial (' + x.pedidos.length + ' pedido' + (x.pedidos.length === 1 ? '' : 's') + ' · ' + esc(ctx.usd(x.gastado)) + ')</h3>' + x.pedidos.slice().sort(function (a, b) { return String(b.fecha_ida || b.created_at).localeCompare(String(a.fecha_ida || a.created_at)); }).map(function (p) {
        var its = (p.items || []).filter(function (i) { return i.nombre; });
        return '<div class="op-ped" data-abrir="' + esc(p.id) + '"><div class="op-ped__cab"><b>' + esc((p.destino || 'Sin destino') + ' · ' + (p.fecha_ida ? ctx.fecha(p.fecha_ida) + ' → ' + ctx.fecha(p.fecha_vuelta) : 'sin fecha')) + '</b>' + pill('p-' + p.estado, ctx.ESTADOS[p.estado] || p.estado) + '</div>' +
          '<ul>' + its.map(function (i) { return '<li' + (i.estado === 'cancelado' ? ' class="op-tachado"' : '') + '>' + esc(i.nombre + (i.fecha_servicio ? ' · ' + diaTxt(i.fecha_servicio) : '') + (i.proveedor_nombre ? ' · ' + i.proveedor_nombre : '')) + '</li>'; }).join('') + '</ul>' +
          '<span class="sub">' + esc(p.ref + ' · ' + ctx.usd((p.cuentas && p.cuentas.total_usd) || 0) + ((p.pasajeros || []).length ? ' · ' + p.pasajeros.length + ' pasajero(s) cargado(s)' : '')) + '</span></div>';
      }).join('') + '</section></div>';
      return h;
    }

    /* ---------- salidas y manifiestos ----------
       Lo arma el server (GET op/salidas): un mismo servicio, el mismo dia, a la misma hora y con el mismo proveedor. */
    var sal = { rango: 'hoy', fecha: '', clave: '', datos: null, cargando: false, error: '', abierto: {}, enviando: false };
    function rangoSal() {
      var h = hoy();
      if (sal.rango === 'manana') return [mas(h, 1), mas(h, 1)];
      if (sal.rango === 'semana') return [h, mas(h, 6)];
      if (sal.rango === 'fecha' && sal.fecha) return [sal.fecha, sal.fecha];
      return [h, h];
    }
    function cargarSalidas(forzar) {
      var r = rangoSal(), k = r.join('|');
      if (!forzar && (sal.cargando || sal.clave === k)) return;
      sal.cargando = true; sal.clave = k; sal.error = '';
      ctx.api('op/salidas?desde=' + r[0] + '&hasta=' + r[1]).then(function (j) { if (sal.clave === k) sal.datos = j; })
        .catch(function (e) { sal.error = e.message; sal.datos = null; })
        .then(function () { sal.cargando = false; if (S.vista === 'salidas') ctx.pintar(); });
    }
    function telVisible(t) { return String(t || '').replace(/^\+?598\s?/, '0'); }
    function waLink(tel, texto) { var d = String(tel || '').replace(/\D/g, ''); if (/^0?9\d{7}$/.test(d)) d = '598' + d.replace(/^0/, ''); return 'https://wa.me/' + d + '?text=' + encodeURIComponent(texto); }
    var RES_TXT = { pendiente: 'Esperando respuesta', reprogramado: 'Reprogramado', reembolso: 'Pidió reembolso', mantiene: 'Sale igual' };
    function incidenciaHtml(x, pedidoId, itemId) {
      var inc = x.incidencia; if (!inc) return '';
      if (inc.resolucion !== 'pendiente') return '<span class="pill ' + (inc.resolucion === 'reembolso' ? 'p-cancelado' : 'p-confirmado') + '">' + esc(RES_TXT[inc.resolucion] || inc.resolucion) + '</span>';
      var k = esc(pedidoId) + '|' + esc(itemId);
      return '<div class="op-inc"><span class="pill p-pendiente">Suspendido · ' + esc(RES_TXT.pendiente) + '</span><span class="sub">' + esc(inc.motivo) + (inc.avisado ? ' · ' + esc(inc.avisado) : ' · sin avisar') + '</span>' +
        '<div class="op-acc"><input type="date" data-inc-fecha="' + k + '" min="' + hoy() + '" aria-label="Nueva fecha"><button class="btn btn--sm" data-inc="reprogramado" data-k="' + k + '">Otra fecha</button>' +
        '<button class="btn btn--sm" data-inc="reembolso" data-k="' + k + '">Reembolso</button><button class="btn btn--sm" data-inc="mantiene" data-k="' + k + '">Sale igual</button></div></div>';
    }
    function vistaSalidas() {
      var r = rangoSal(); if (sal.clave !== r.join('|')) cargarSalidas();
      var chip = function (v, t) { return '<button class="chip" data-sal-r="' + v + '" aria-pressed="' + (sal.rango === v) + '">' + esc(t) + '</button>'; };
      var h = '<div class="vhead"><div><h2>Salidas y manifiestos</h2><p>Cada salida junta a todos los que van en el mismo servicio, el mismo día y a la misma hora. Bajá el manifiesto en PDF o mandáselo al guía o al chofer.</p></div></div>' +
        '<div class="bar op-bar"><div class="chips">' + chip('hoy', 'Hoy') + chip('manana', 'Mañana') + chip('semana', 'Próximos 7 días') + '</div>' +
        '<div class="op-filtros"><input type="date" data-sal-fecha value="' + esc(sal.rango === 'fecha' ? sal.fecha : '') + '" aria-label="Otra fecha"><button class="btn btn--sm" data-sal="recargar">Actualizar</button></div></div>';
      if (sal.error) return h + '<p class="aviso">' + esc(sal.error) + '</p>';
      if (!sal.datos) return h + '<div class="card"><p class="vacio">Cargando…</p></div>';
      var L = sal.datos.salidas || [], pax = L.reduce(function (a, s) { return a + s.pax; }, 0);
      var sinPick = L.reduce(function (a, s) { return a + s.filas.filter(function (x) { return !x.pickup; }).length; }, 0);
      var susp = L.filter(function (s) { return s.suspendida; }).length;
      h += '<section class="kpis kpis--4">' + ctx.kpi('Salidas', String(L.length), r[0] === r[1] ? diaTxt(r[0]) : diaTxt(r[0]) + ' al ' + diaTxt(r[1])) + ctx.kpi('Pasajeros', String(pax), 'en todas las salidas') +
        ctx.kpi('Sin pickup', String(sinPick), 'reservas sin lugar de búsqueda', sinPick ? 'kpi--warn' : 'kpi--ok') + ctx.kpi('Suspendidas', String(susp), 'esperando respuesta de los clientes', susp ? 'kpi--warn' : '') + '</section>';
      var sf = sal.datos.sin_fecha || [];
      if (sf.length) h += '<div class="card op-sinf"><b>' + sf.length + ' servicio(s) de viajes en estas fechas todavía no tienen día asignado</b>, así que no aparecen en ninguna salida: ' +
        sf.slice(0, 12).map(function (x) { return '<a class="op-link" role="button" tabindex="0" data-abrir="' + esc(x.pedido_id) + '">' + esc(x.servicio + ' · ' + (x.cliente || x.ref)) + '</a>'; }).join(', ') + (sf.length > 12 ? '…' : '') + '</div>';
      if (!L.length) return h + '<div class="card"><p class="vacio">No hay salidas en estas fechas.</p></div>';
      L.forEach(function (s) {
        var ab = sal.abierto[s.id] || '';
        h += '<section class="card op-sal' + (s.suspendida ? ' op-sal--susp' : '') + '"><div class="op-sal__cab"><div><span class="sub">' + esc(s.dia + (s.hora ? ' · ' + s.hora + ' h' : ' · sin hora')) + '</span><h3>' + esc(s.nombre) + '</h3>' +
          '<span class="sub">' + esc([TIPO[s.tipo], s.destino, s.proveedor.nombre ? 'Proveedor: ' + s.proveedor.nombre : 'Sin proveedor'].filter(Boolean).join(' · ')) + '</span></div>' +
          '<div class="op-sal__pax"><b>' + s.pax + '</b><span>pasajero' + (s.pax === 1 ? '' : 's') + '</span>' + (s.suspendida ? pill('p-cancelado', 'Suspendida') : '') + '</div></div>' +
          '<div class="op-tabla"><table><thead><tr><th>Cliente</th><th class="num">Pax</th><th>Pasajeros</th><th>Pickup</th><th>WhatsApp</th><th>Pago</th><th>Notas</th></tr></thead><tbody>' +
          s.filas.map(function (x) {
            return '<tr><td data-l="Cliente"><a class="op-link" role="button" tabindex="0" data-abrir="' + esc(x.pedido_id) + '"><b>' + esc(x.cliente) + '</b></a><span class="sub">' + esc(String(x.ref).split('-').pop() + (x.ref_proveedor ? ' · cód. ' + x.ref_proveedor : '') + (x.estado !== 'confirmado' ? ' · ' + (x.estado === 'pendiente' ? 'sin confirmar' : x.estado) : '')) + '</span>' + incidenciaHtml(x, x.pedido_id, x.item_id) + '</td>' +
              '<td class="num" data-l="Pax">' + x.personas + '</td><td data-l="Pasajeros">' + (x.pasajeros.length ? esc(x.pasajeros.join(', ')) : '<span class="sub">sin cargar</span>') + '</td>' +
              '<td data-l="Pickup">' + (x.pickup ? esc(x.pickup) : '<span class="op-warn">falta</span>') + '</td>' +
              '<td data-l="WhatsApp">' + (x.telefono ? '<a href="' + esc(waLink(x.telefono, '')) + '" target="_blank" rel="noopener">' + esc(telVisible(x.telefono)) + '</a>' : '—') + '</td>' +
              '<td data-l="Pago">' + pill('p-' + x.pago, PAGO[x.pago]) + (x.saldo_usd > 0.005 ? '<span class="sub">saldo ' + esc(ctx.usd(x.saldo_usd)) + '</span>' : '') + '</td>' +
              '<td data-l="Notas">' + (x.notas.length ? '<span class="op-nota">' + esc(x.notas.join(' · ')) + '</span>' : '<span class="sub">—</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="op-acc op-sal__acc"><a class="btn btn--sm" href="/api/admin/op/salida/pdf?fecha=' + esc(s.fecha) + '&id=' + esc(s.id) + '" target="_blank" rel="noopener">Manifiesto en PDF</a>' +
          '<button class="btn btn--sm btn--wa-borde" data-sal="wa" data-id="' + esc(s.id) + '">WhatsApp al guía o chofer</button>' +
          (s.suspendida ? '' : '<button class="btn btn--sm btn--peligro" data-sal="susp" data-id="' + esc(s.id) + '">Suspender salida</button>') + '</div>';
        if (ab === 'wa') {
          h += '<div class="op-panel"><label class="f">WhatsApp del guía o chofer<input id="sal-tel-' + esc(s.id) + '" value="' + esc(s.proveedor.whatsapp || '') + '" placeholder="Ej. 48 99999 9999 (Brasil) o 099 123 456"></label>' +
            '<label class="f">Mensaje<textarea id="sal-txt-' + esc(s.id) + '" rows="9">' + esc(s.texto) + '</textarea></label>' +
            '<div class="op-acc"><button class="btn btn--main" data-sal="wa-abrir" data-id="' + esc(s.id) + '">Abrir en WhatsApp</button>' +
            '<button class="btn" data-sal="wa-api" data-id="' + esc(s.id) + '"' + (sal.enviando ? ' disabled' : '') + '>Enviar desde el número de la empresa</button>' +
            '<button class="btn" data-sal="copiar" data-id="' + esc(s.id) + '">Copiar</button></div>' +
            '<p class="sub">"Abrir en WhatsApp" sale de tu WhatsApp. Desde el número de la empresa solo se puede si esa persona nos escribió en las últimas 24 h. El PDF lo bajás con el botón de arriba y lo adjuntás en el chat.</p></div>';
        }
        if (ab === 'susp') {
          h += '<div class="op-panel op-panel--peligro"><b>Suspender la salida entera (' + s.filas.length + ' reserva' + (s.filas.length === 1 ? '' : 's') + ', ' + s.pax + ' pasajeros)</b>' +
            '<p class="sub">A cada cliente le llega que se suspendió, el motivo y que puede elegir otra fecha sin costo o el reembolso. Después marcás acá lo que elige cada uno.</p>' +
            '<div class="chips">' + ['Mal tiempo: la Marina no autorizó las salidas', 'Mal tiempo: lluvia y viento fuerte', 'El operador canceló la salida'].map(function (m) { return '<button class="chip" data-sal-motivo="' + esc(m) + '" data-id="' + esc(s.id) + '">' + esc(m) + '</button>'; }).join('') + '</div>' +
            '<label class="f">Motivo (lo leen los clientes)<input id="sal-mot-' + esc(s.id) + '" maxlength="200" placeholder="Ej. Mal tiempo: la Marina no autorizó las salidas"></label>' +
            '<div class="op-acc"><label class="op-check"><input type="checkbox" id="sal-wa-' + esc(s.id) + '" checked> Avisar por WhatsApp</label><label class="op-check"><input type="checkbox" id="sal-mail-' + esc(s.id) + '" checked> Avisar por mail</label></div>' +
            '<div class="op-acc"><button class="btn btn--peligro" data-sal="susp-ok" data-id="' + esc(s.id) + '"' + (sal.enviando ? ' disabled' : '') + '>' + (sal.enviando ? 'Avisando…' : 'Suspender y avisar') + '</button><button class="btn" data-sal="cerrar" data-id="' + esc(s.id) + '">Cancelar</button></div></div>';
        }
        h += '</section>';
      });
      return h;
    }
    function salidaDe(id) { return ((sal.datos && sal.datos.salidas) || []).filter(function (s) { return s.id === id; })[0]; }
    /* Un pedido que devolvio el server reemplaza al de la lista, asi la Agenda y la ficha ven el cambio sin recargar. */
    function reemplazar(p) {
      if (!p || !S.datos) return;
      S.datos.pedidos = S.datos.pedidos.map(function (x) { return x.id === p.id ? p : x; });
    }
    function resolverInc(k, acc) {
      var partes = k.split('|'), fechaEl = document.querySelector('[data-inc-fecha="' + k + '"]'), f = fechaEl ? fechaEl.value : '';
      if (acc === 'reprogramado' && !f) return ctx.toast('Elegí la nueva fecha al lado del botón.');
      ctx.api('op/incidencia', { pedido_id: partes[0], item_id: partes[1], resolucion: acc, fecha: f }).then(function (j) {
        reemplazar(j.pedido);
        ctx.toast(acc === 'reprogramado' ? 'Reprogramado para el ' + ctx.fecha(f) : acc === 'reembolso' ? 'Anotado. Ahora cancelá el servicio en el pedido con el reembolso.' : 'Anotado');
        if (acc === 'reembolso') ctx.abrirPedido(partes[0]);
        cargarSalidas(true);
        if (S.vista === 'cancelaciones') ctx.pintar();
      }).catch(function (e) { ctx.toast(e.message); });
    }

    /* ---------- cancelaciones y reembolsos ----------
       Sale de los pedidos que ya tiene el panel: servicios cancelados, lo que hay que devolverle al cliente (cobrado de
       mas, igual que la ficha) y lo que el proveedor nos tiene que devolver (lo que se le pago de mas sobre su cargo de
       cancelacion, menos lo que ya devolvio). Y las salidas suspendidas que esperan respuesta del cliente. */
    var can = { filtro: 'pendientes' };
    function datosCancel() {
      var susp = [], filas = [];
      pedidos().forEach(function (p) {
        var c = ctx.calc(p), pedCanc = p.estado === 'cancelado';
        var devueltos = r2((p.pagos || []).filter(function (x) { return x.reembolso; }).reduce(function (a, x) { return a + (x.monto_usd || 0); }, 0));
        var its = (p.items || []).filter(function (i) { return i.nombre && (pedCanc || i.estado === 'cancelado'); });
        (p.items || []).forEach(function (i) { if (i.incidencia && i.incidencia.resolucion === 'pendiente' && !pedCanc && i.estado !== 'cancelado') susp.push({ p: p, i: i }); });
        if (!its.length) return;
        var prov = its.map(function (i) { return { i: i, debe: r2(Math.max(0, (i.pagado_proveedor_usd || 0) - (i.cargo_proveedor_usd || 0) - (i.devuelto_proveedor_usd || 0))) }; });
        filas.push({ p: p, c: c, its: its, prov: prov, devueltos: devueltos, provDebe: r2(prov.reduce(function (a, x) { return a + x.debe; }, 0)) });
      });
      return { susp: susp, filas: filas };
    }
    function r2(n) { return Math.round(n * 100) / 100; }
    function vistaCancelaciones() {
      var d = datosCancel(), pend = function (x) { return x.c.devolver > 0.005 || x.provDebe > 0.005; };
      var aDev = r2(d.filas.reduce(function (a, x) { return a + x.c.devolver; }, 0)), aRec = r2(d.filas.reduce(function (a, x) { return a + x.provDebe; }, 0));
      var lista = d.filas.filter(function (x) { return can.filtro === 'todas' || pend(x); }).sort(function (a, b) { return String(b.p.updated_at || '').localeCompare(String(a.p.updated_at || '')); });
      var h = '<div class="vhead"><div><h2>Cancelaciones y reembolsos</h2><p>Lo que hay que devolverle a cada cliente, lo que cada proveedor nos tiene que devolver y las salidas suspendidas sin resolver.</p></div></div>' +
        '<section class="kpis kpis--4">' + ctx.kpi('A devolver a clientes', ctx.usd(aDev), 'cobrado de más en pedidos cancelados', aDev ? 'kpi--warn' : 'kpi--ok') +
        ctx.kpi('A recuperar de proveedores', ctx.usd(aRec), 'pagado de más sobre su cargo', aRec ? 'kpi--warn' : 'kpi--ok') +
        ctx.kpi('Suspensiones sin resolver', String(d.susp.length), 'el cliente todavía no eligió', d.susp.length ? 'kpi--warn' : '') +
        ctx.kpi('Pedidos con cancelaciones', String(d.filas.length), 'total o de algún servicio') + '</section>';
      if (d.susp.length) {
        h += '<section class="card"><h3>Salidas suspendidas: esperando que el cliente elija</h3><div class="op-tabla"><table><thead><tr><th>Servicio</th><th>Cliente</th><th>Qué hacer</th></tr></thead><tbody>' +
          d.susp.map(function (x) {
            return '<tr><td data-l="Servicio"><b>' + esc(x.i.nombre) + '</b><span class="sub">' + esc((x.i.incidencia.fecha_original ? diaTxt(x.i.incidencia.fecha_original) + ' · ' : '') + x.i.incidencia.motivo) + '</span></td>' +
              '<td data-l="Cliente"><a class="op-link" role="button" tabindex="0" data-abrir="' + esc(x.p.id) + '"><b>' + esc(x.p.cliente_nombre || '—') + '</b></a><span class="sub">' + esc(x.p.ref + (x.i.incidencia.avisado ? ' · ' + x.i.incidencia.avisado : ' · sin avisar')) + '</span></td>' +
              '<td data-l="Qué hacer">' + incidenciaHtml({ incidencia: x.i.incidencia }, x.p.id, x.i.id) + '</td></tr>';
          }).join('') + '</tbody></table></div></section>';
      }
      h += '<div class="bar"><div class="chips"><button class="chip" data-can="pendientes" aria-pressed="' + (can.filtro === 'pendientes') + '">Con algo pendiente<span>' + d.filas.filter(pend).length + '</span></button><button class="chip" data-can="todas" aria-pressed="' + (can.filtro === 'todas') + '">Todas<span>' + d.filas.length + '</span></button></div></div>';
      if (!lista.length) return h + '<div class="card"><p class="vacio">' + (d.filas.length ? 'Nada pendiente: todo lo cancelado está devuelto y los proveedores al día.' : 'No hay cancelaciones.') + '</p></div>';
      h += '<div class="card op-tabla"><table><thead><tr><th>Pedido</th><th>Lo cancelado</th><th class="num">Cobrado</th><th>Cliente</th><th>Proveedor</th></tr></thead><tbody>';
      lista.forEach(function (x) {
        var cli = x.c.devolver > 0.005 ? '<span class="op-warn">Devolverle ' + esc(ctx.usd(x.c.devolver)) + '</span>' + (x.devueltos ? '<span class="sub">ya devuelto ' + esc(ctx.usd(x.devueltos)) + '</span>' : '')
          : (x.devueltos ? pill('p-pagado', 'Devuelto ' + ctx.usd(x.devueltos)) : '<span class="sub">' + (x.c.cobrado > 0 ? 'retenido (cargo de cancelación)' : 'no había pagado') + '</span>');
        var prov = x.prov.map(function (y) {
          if (y.debe <= 0.005) return '<div class="sub">' + esc(y.i.nombre) + ': ' + ((y.i.devuelto_proveedor_usd || 0) > 0 ? 'devolvió ' + esc(ctx.usd(y.i.devuelto_proveedor_usd)) : (y.i.pagado_proveedor_usd ? 'al día' : 'no se le había pagado')) + '</div>';
          var k = esc(x.p.id) + '|' + esc(y.i.id);
          return '<div class="op-provdev"><span class="op-warn">' + esc((y.i.proveedor_nombre || 'Proveedor') + ' nos debe ' + ctx.usd(y.debe)) + '</span><span class="sub">' + esc(y.i.nombre) + '</span>' +
            '<div class="op-acc"><input type="number" min="0" step="0.01" inputmode="decimal" data-dev-monto="' + k + '" value="' + y.debe + '" aria-label="Monto devuelto en US$"><button class="btn btn--sm" data-dev="' + k + '">Registrar devolución</button></div></div>';
        }).join('');
        h += '<tr><td data-l="Pedido"><a class="op-link" role="button" tabindex="0" data-abrir="' + esc(x.p.id) + '"><b>' + esc(x.p.cliente_nombre || '—') + '</b></a><span class="sub">' + esc(x.p.ref + (x.p.destino ? ' · ' + x.p.destino : '')) + '</span>' + (x.p.estado === 'cancelado' ? pill('p-cancelado', 'Pedido cancelado') : '') + '</td>' +
          '<td data-l="Lo cancelado">' + x.its.map(function (i) { return '<div>' + esc(i.nombre) + (i.cargo_cliente_usd ? '<span class="sub">se retiene ' + esc(ctx.usd(i.cargo_cliente_usd)) + '</span>' : '') + '</div>'; }).join('') + '</td>' +
          '<td class="num" data-l="Cobrado">' + esc(ctx.usd(x.c.cobrado)) + '</td><td data-l="Cliente">' + cli + '</td><td data-l="Proveedor">' + prov + '</td></tr>';
      });
      return h + '</tbody></table></div><p class="sub">La devolución al cliente se registra en el pedido (Cobros → reembolso) y le llega el comprobante por mail. La del proveedor se registra acá.</p>';
    }

    /* ---------- rentabilidad ----------
       Facturado, costo y margen de los pedidos, por destino, por servicio y por proveedor. Un servicio cancelado vale su
       cargo de cancelacion (lo que se cobro y se pago igual), como en las cuentas del pedido. */
    var ren = { periodo: 'mes', base: 'viaje', estados: 'confirmados', por: 'destino' };
    function rangoRen() {
      var h = hoy(), y = h.slice(0, 4), m = h.slice(0, 7);
      if (ren.periodo === 'mes') return [m + '-01', h.slice(0, 7) + '-31'];
      if (ren.periodo === 'mesant') { var d = new Date(m + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); var mm = d.toISOString().slice(0, 7); return [mm + '-01', mm + '-31']; }
      if (ren.periodo === '90') return [mas(h, -90), h];
      if (ren.periodo === 'anio') return [y + '-01-01', y + '-12-31'];
      return ['0000-00-00', '9999-99-99'];
    }
    function filasRen() {
      var r = rangoRen(), out = [];
      pedidos().forEach(function (p) {
        if (ren.estados === 'confirmados' ? (p.estado !== 'confirmado' && p.estado !== 'completado') : p.estado === 'nuevo') return;
        var f = ren.base === 'viaje' ? (p.fecha_ida || String(p.created_at || '').slice(0, 10)) : String(p.created_at || '').slice(0, 10);
        if (f < r[0] || f > r[1]) return;
        (p.items || []).forEach(function (i) {
          if (!i.nombre || i.tipo === 'vuelo' || i.tipo === 'alojamiento') return;
          var fuera = p.estado === 'cancelado' || i.estado === 'cancelado';
          var venta = Number(fuera ? i.cargo_cliente_usd : i.precio_usd) || 0, costo = Number(fuera ? i.cargo_proveedor_usd : i.costo_usd) || 0;
          if (!venta && !costo) return;
          out.push({ p: p, i: i, venta: venta, costo: costo, sinCosto: !fuera && venta > 0 && !costo, pax: Number(p.personas) || 1 });
        });
      });
      return out;
    }
    function agrupar(filas, claveFn, nombreFn) {
      var g = {};
      filas.forEach(function (x) {
        var k = claveFn(x), a = g[k] || (g[k] = { nombre: nombreFn(x), pedidos: {}, ventas: 0, pax: 0, venta: 0, costo: 0, sinCosto: 0 });
        a.pedidos[x.p.id] = 1; a.ventas++; a.pax += x.pax; a.venta += x.venta; a.costo += x.costo; if (x.sinCosto) a.sinCosto++;
      });
      return Object.keys(g).map(function (k) { var a = g[k]; a.nPed = Object.keys(a.pedidos).length; a.venta = r2(a.venta); a.costo = r2(a.costo); a.margen = r2(a.venta - a.costo); a.pct = a.venta ? Math.round(a.margen / a.venta * 1000) / 10 : 0; return a; })
        .sort(function (a, b) { return b.margen - a.margen; });
    }
    var POR = {
      destino: { t: 'Destino', k: function (x) { return String(x.p.destino || 'Sin destino').toLowerCase(); }, n: function (x) { return x.p.destino || 'Sin destino'; } },
      servicio: { t: 'Servicio', k: function (x) { return x.i.tipo + '|' + String(x.i.nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }, n: function (x) { return x.i.nombre; } },
      proveedor: { t: 'Proveedor', k: function (x) { return x.i.proveedor_id || String(x.i.proveedor_nombre || 'sin').toLowerCase(); }, n: function (x) { return x.i.proveedor_nombre || 'Sin proveedor'; } },
      tipo: { t: 'Tipo', k: function (x) { return x.i.tipo; }, n: function (x) { return TIPO[x.i.tipo] || x.i.tipo; } }
    };
    function vistaRentabilidad() {
      var filas = filasRen(), G = agrupar(filas, POR[ren.por].k, POR[ren.por].n), tot = agrupar(filas, function () { return 't'; }, function () { return 'Total'; })[0];
      var chip = function (k, v, t) { return '<button class="chip" data-ren="' + k + '" data-v="' + v + '" aria-pressed="' + (ren[k] === v) + '">' + esc(t) + '</button>'; };
      var h = '<div class="vhead"><div><h2>Rentabilidad</h2><p>Facturado, costo de proveedores y margen de lo vendido, por destino, servicio o proveedor.</p></div><div class="op-acc"><button class="btn" data-ren-csv>Bajar CSV</button></div></div>' +
        '<div class="bar"><div class="chips">' + chip('periodo', 'mes', 'Este mes') + chip('periodo', 'mesant', 'Mes pasado') + chip('periodo', '90', 'Últimos 90 días') + chip('periodo', 'anio', 'Este año') + chip('periodo', 'todo', 'Todo') + '</div></div>' +
        '<div class="bar"><div class="chips">' + chip('base', 'viaje', 'Por fecha del viaje') + chip('base', 'pedido', 'Por fecha del pedido') + '</div><div class="chips">' + chip('estados', 'confirmados', 'Confirmados y completados') + chip('estados', 'todos', 'También en gestión y cancelados') + '</div></div>';
      if (!tot) return h + '<div class="card"><p class="vacio">No hay ventas en este período.</p></div>';
      h += '<section class="kpis kpis--4">' + ctx.kpi('Facturado', ctx.usd(tot.venta), tot.nPed + ' pedido(s) · ' + tot.ventas + ' servicio(s)') + ctx.kpi('Costo proveedores', ctx.usd(tot.costo), tot.sinCosto ? tot.sinCosto + ' servicio(s) sin costo cargado' : 'todo con costo', tot.sinCosto ? 'kpi--warn' : '') +
        ctx.kpi('Margen', ctx.usd(tot.margen), String(tot.pct).replace('.', ',') + ' % de lo facturado', 'kpi--ok') + ctx.kpi('Ticket promedio', ctx.usd(r2(tot.venta / Math.max(1, tot.nPed))), 'por pedido') + '</section>';
      h += '<div class="bar"><div class="chips">' + ['destino', 'servicio', 'proveedor', 'tipo'].map(function (k) { return chip('por', k, 'Por ' + POR[k].t.toLowerCase()); }).join('') + '</div></div>';
      var max = Math.max.apply(null, G.map(function (a) { return Math.abs(a.margen); }).concat([1]));
      h += '<div class="card op-tabla"><table><thead><tr><th>' + esc(POR[ren.por].t) + '</th><th class="num">Pedidos</th><th class="num">Servicios</th><th class="num">Pax</th><th class="num">Facturado</th><th class="num">Costo</th><th class="num">Margen</th><th class="num">%</th><th></th></tr></thead><tbody>' +
        G.map(function (a) {
          return '<tr><td data-l="' + esc(POR[ren.por].t) + '"><b>' + esc(a.nombre) + '</b>' + (a.sinCosto ? '<span class="sub op-warn">' + a.sinCosto + ' sin costo cargado: el margen está inflado</span>' : '') + '</td>' +
            '<td class="num" data-l="Pedidos">' + a.nPed + '</td><td class="num" data-l="Servicios">' + a.ventas + '</td><td class="num" data-l="Pax">' + a.pax + '</td>' +
            '<td class="num" data-l="Facturado">' + esc(ctx.usd(a.venta)) + '</td><td class="num" data-l="Costo">' + esc(ctx.usd(a.costo)) + '</td>' +
            '<td class="num" data-l="Margen"><b class="' + (a.margen < 0 ? 'deuda' : '') + '">' + esc(ctx.usd(a.margen)) + '</b></td><td class="num" data-l="%">' + String(a.pct).replace('.', ',') + ' %</td>' +
            '<td class="op-barra-td"><span class="op-barra' + (a.margen < 0 ? ' op-barra--neg' : '') + '" style="width:' + Math.round(Math.abs(a.margen) / max * 100) + '%"></span></td></tr>';
        }).join('') + '</tbody></table></div>';
      return h + '<p class="sub">Un servicio cancelado cuenta por su cargo de cancelación (lo que el cliente pagó igual y lo que se le pagó igual al proveedor). Vuelos y alojamiento no se venden por CuántoSale y no entran.</p>';
    }
    function csvRen() {
      var filas = filasRen(), q = function (v) { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var out = [['Fecha viaje', 'Referencia', 'Cliente', 'Destino', 'Estado', 'Servicio', 'Tipo', 'Proveedor', 'Personas', 'Facturado US$', 'Costo US$', 'Margen US$'].join(';')];
      filas.forEach(function (x) { out.push([x.p.fecha_ida || '', x.p.ref, x.p.cliente_nombre, x.p.destino, x.p.estado, x.i.nombre, TIPO[x.i.tipo] || x.i.tipo, x.i.proveedor_nombre, x.pax, String(x.venta).replace('.', ','), String(x.costo).replace('.', ','), String(r2(x.venta - x.costo)).replace('.', ',')].map(q).join(';')); });
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.join('\n')], { type: 'text/csv;charset=utf-8' }));
      a.download = 'rentabilidad-' + hoy() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    var VISTAS = { clientes: vistaClientes, agenda: vistaAgenda, salidas: vistaSalidas, cancelaciones: vistaCancelaciones, rentabilidad: vistaRentabilidad };
    function vista() { return (VISTAS[S.vista] || vistaAgenda)(); }
    function mia() { return !!VISTAS[S.vista]; }

    document.addEventListener('click', function (e) {
      if (!mia()) return;
      var t = e.target.closest('[data-sal-r],[data-sal],[data-sal-motivo],[data-inc],[data-can],[data-dev],[data-ren],[data-ren-csv]');
      if (!t) return;
      if (t.hasAttribute('data-sal-r')) { sal.rango = t.getAttribute('data-sal-r'); sal.datos = null; return ctx.pintar(); }
      if (t.hasAttribute('data-sal-motivo')) { var mi = document.getElementById('sal-mot-' + t.getAttribute('data-id')); if (mi) { mi.value = t.getAttribute('data-sal-motivo'); mi.focus(); } return; }
      if (t.hasAttribute('data-inc')) { e.preventDefault(); return resolverInc(t.getAttribute('data-k'), t.getAttribute('data-inc')); }
      if (t.hasAttribute('data-can')) { can.filtro = t.getAttribute('data-can'); return ctx.pintar(); }
      if (t.hasAttribute('data-ren')) { ren[t.getAttribute('data-ren')] = t.getAttribute('data-v'); return ctx.pintar(); }
      if (t.hasAttribute('data-ren-csv')) return csvRen();
      if (t.hasAttribute('data-dev')) {
        var k = t.getAttribute('data-dev'), inp = document.querySelector('[data-dev-monto="' + k + '"]'), pk = k.split('|');
        t.disabled = true;
        return ctx.api('op/proveedor-devolucion', { pedido_id: pk[0], item_id: pk[1], monto: inp ? inp.value : '' })
          .then(function (j) { reemplazar(j.pedido); ctx.toast('Devolución registrada'); ctx.pintar(); })
          .catch(function (er) { t.disabled = false; ctx.toast(er.message); });
      }
      var a = t.getAttribute('data-sal'), id = t.getAttribute('data-id'), s = salidaDe(id);
      if (a === 'recargar') { return cargarSalidas(true); }
      if (a === 'wa' || a === 'susp') { sal.abierto[id] = sal.abierto[id] === a ? '' : a; return ctx.pintar(); }
      if (a === 'cerrar') { sal.abierto[id] = ''; return ctx.pintar(); }
      if (!s) return;
      var tel = document.getElementById('sal-tel-' + id), txtEl = document.getElementById('sal-txt-' + id);
      if (a === 'copiar') { (navigator.clipboard ? navigator.clipboard.writeText(txtEl.value) : Promise.reject()).then(function () { ctx.toast('Copiado'); }).catch(function () { txtEl.select(); ctx.toast('Copialo con Ctrl+C'); }); return; }
      if (a === 'wa-abrir') {
        var d = String(tel.value || '').replace(/\D/g, '');
        if (d.length < 8) return ctx.toast('Poné el WhatsApp del guía o chofer.');
        if (/^0?9\d{7}$/.test(d)) d = '598' + d.replace(/^0/, ''); else if (d.length === 10 || d.length === 11) d = '55' + d;
        return window.open('https://wa.me/' + d + '?text=' + encodeURIComponent(txtEl.value), '_blank', 'noopener');
      }
      if (a === 'wa-api') {
        sal.enviando = true; t.disabled = true;
        return ctx.api('op/salida/whatsapp', { fecha: s.fecha, id: id, telefono: tel.value, texto: txtEl.value })
          .then(function () { ctx.toast('Manifiesto enviado por WhatsApp'); })
          .catch(function (er) { ctx.toast(er.message); })
          .then(function () { sal.enviando = false; t.disabled = false; });
      }
      if (a === 'susp-ok') {
        var mot = document.getElementById('sal-mot-' + id).value.trim();
        if (mot.length < 3) return ctx.toast('Escribí el motivo: lo leen los clientes.');
        if (!confirm('¿Suspender ' + s.nombre + ' del ' + s.dia + ' y avisar a ' + s.filas.length + ' cliente(s)?')) return;
        sal.enviando = true; ctx.pintar();
        return ctx.api('op/salida/suspender', { fecha: s.fecha, id: id, motivo: mot, wa: document.getElementById('sal-wa-' + id).checked, mail: document.getElementById('sal-mail-' + id).checked })
          .then(function (j) {
            var mal = j.clientes.filter(function (c) { return (c.wa && c.wa !== 'ok') || (c.mail && c.mail !== 'ok'); });
            ctx.toast('Salida suspendida: ' + j.clientes.length + ' cliente(s)' + (mal.length ? ', ' + mal.length + ' con algún aviso que no salió' : ', todos avisados'));
            if (mal.length) alert('Avisos que no salieron:\n\n' + mal.map(function (c) { return c.cliente + ' (' + c.ref + '): ' + [c.wa && c.wa !== 'ok' ? 'WhatsApp: ' + c.wa : '', c.mail && c.mail !== 'ok' ? 'Mail: ' + c.mail : ''].filter(Boolean).join(' · '); }).join('\n'));
            sal.abierto[id] = ''; return ctx.recargarDatos();
          })
          .catch(function (er) { ctx.toast(er.message); })
          .then(function () { sal.enviando = false; cargarSalidas(true); });
      }
    });
    document.addEventListener('change', function (e) {
      if (S.vista !== 'salidas' || !e.target.hasAttribute || !e.target.hasAttribute('data-sal-fecha')) return;
      if (!e.target.value) return;
      sal.rango = 'fecha'; sal.fecha = e.target.value; sal.datos = null; ctx.pintar();
    });

    /* ---------- eventos ---------- */
    document.addEventListener('click', function (e) {
      if (S.vista !== 'agenda' && S.vista !== 'clientes') return;
      var t = e.target.closest('[data-op-f],[data-op],[data-op-ficha]');
      if (!t) return;
      if (t.hasAttribute('data-op-f')) { st[t.getAttribute('data-op-f')] = t.getAttribute('data-v'); return ctx.pintar(); }
      if (t.hasAttribute('data-op-ficha')) { st.ficha = t.getAttribute('data-op-ficha'); window.scrollTo(0, 0); return ctx.pintar(); }
      var a = t.getAttribute('data-op');
      if (a === 'volver') { st.ficha = null; return ctx.pintar(); }
      if (a === 'chat') return ctx.irChat(t.getAttribute('data-tel'));
      if (a === 'guardar-ficha') {
        st.guardando = true; ctx.pintar();
        var cuerpo = { clave: st.ficha, pais: document.getElementById('op-pais').value, alerta: document.getElementById('op-alerta').value, notas: document.getElementById('op-notas').value };
        ctx.api('op/cliente/guardar', cuerpo).then(function () { ctx.toast('Ficha guardada'); return ctx.cargarFichas(); })
          .catch(function (er) { ctx.toast(er.message); })
          .then(function () { st.guardando = false; if (S.vista === 'clientes') ctx.pintar(); });
      }
    });
    document.addEventListener('change', function (e) {
      if (S.vista !== 'agenda') return;
      var k = e.target.getAttribute && e.target.getAttribute('data-op-sel');
      if (k) { st[k] = e.target.value; ctx.pintar(); }
    });
    document.addEventListener('input', function (e) {
      if (S.vista !== 'agenda' && S.vista !== 'clientes') return;
      var k = e.target.getAttribute && e.target.getAttribute('data-op-q');
      if (!k) return;
      st[k] = e.target.value;
      var pos = e.target.selectionStart; ctx.pintar();
      var el = document.querySelector('[data-op-q="' + k + '"]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (er) {} }
    });

    if (!document.getElementById('op-css')) {
      var css = document.createElement('style'); css.id = 'op-css';
      css.textContent = '.op-bar{justify-content:space-between;flex-wrap:wrap;gap:10px}.op-filtros{display:flex;gap:8px;flex-wrap:wrap}.op-filtros select{width:auto;min-width:170px}' +
        '.op-tabla{overflow-x:auto}.op-tabla td[data-l=Fecha]{white-space:nowrap}.op-hoy td:first-child{box-shadow:inset 4px 0 0 var(--accent)}.op-warn{color:var(--warn);font-weight:600}' +
        '.op-alerta{display:block;color:var(--bad);font-weight:700;font-size:12.5px;margin-top:2px}.op-acc{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
        '.op-ficha{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:14px;align-items:start}@media (max-width:800px){.op-ficha{grid-template-columns:1fr}}' +
        '.op-ped{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer}.op-ped:hover{background:color-mix(in srgb,var(--info) 6%,transparent)}' +
        '.op-ped__cab{display:flex;justify-content:space-between;gap:8px;align-items:center}.op-ped ul{margin:6px 0;padding-left:18px;font-size:14px}.op-tachado{text-decoration:line-through;color:var(--muted)}' +
        '.op-link{cursor:pointer;color:inherit;text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px}.op-link:hover{text-decoration-color:currentColor}' +
        '.op-sal{margin-bottom:14px}.op-sal--susp{border-color:var(--bad)}.op-sal__cab{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.op-sal__cab h3{margin:2px 0;font-size:18px}' +
        '.op-sal__pax{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px}.op-sal__pax b{font-size:26px;line-height:1}.op-sal__pax span{font-size:12px;color:var(--muted)}' +
        '.op-sal__acc{margin-top:12px}.op-panel{margin-top:12px;border:1px solid var(--line);border-radius:10px;padding:12px;display:grid;gap:10px}.op-panel--peligro{border-color:var(--bad);background:var(--badbg)}' +
        '.op-panel textarea{font-family:inherit;font-size:13.5px}.op-check{display:inline-flex;gap:6px;align-items:center;font-size:14px}.op-inc{display:grid;gap:4px;margin-top:6px}.op-inc input[type=date]{width:auto;padding:4px 6px}' +
        '.btn--peligro{border-color:var(--bad);color:var(--bad)}.op-panel--peligro .btn--peligro{background:var(--bad);color:#fff}.op-nota{color:var(--bad);font-weight:600;font-size:13px}' +
        '.op-sinf{background:var(--warnbg);color:var(--warn);font-size:14px;margin-bottom:12px}.op-sinf .op-link{color:inherit}.op-provdev{display:grid;gap:3px;margin-bottom:8px}.op-provdev input{width:110px;padding:4px 6px}' +
        '.op-barra-td{min-width:90px}.op-barra{display:block;height:8px;border-radius:4px;background:var(--ok)}.op-barra--neg{background:var(--bad)}';
      document.head.appendChild(css);
    }
    return { vista: vista };
  };
})();
