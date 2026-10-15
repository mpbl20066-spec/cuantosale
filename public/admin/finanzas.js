/* Finanzas del panel /admin: cobros, pagos a proveedores, transferencias y auditoria (lib/finanzas.js, /api/admin/fin/*).

   - Resumen: lo que necesita atencion hoy (por verificar, vencidas, servicios confirmados sin obligacion de pago).
   - Cobros: transferencias que entraron, a que pedido van y si ya se vieron en el banco.
   - Pagos a proveedores: una fila por obligacion, o la liquidacion agrupada por proveedor. "Registrar Pix" carga el
     pago y lo reparte entre las obligaciones elegidas.
   - Transferencias: todo lo que entro y salio. Auditoria: quien hizo que.

   Nada se marca verificado solo: "Verificar" pide confirmar que se vio acreditado en el home banking y una referencia
   o un comprobante. Nada se borra: se anula con motivo. Los montos se muestran siempre con su moneda, nunca sumados
   entre monedas.

   Lo carga admin.js (vistaFin) la primera vez que se abre la pestana. */
(function () {
  var SIMB = { UYU: '$U', USD: 'US$', BRL: 'R$' };
  var MONEDAS = ['UYU', 'USD', 'BRL'];
  var SIT = { pendiente: 'Pendiente', parcial: 'Parcial', vencida: 'Vencida', por_verificar: 'Pago por verificar', pagada: 'Pagada', anulada: 'Anulada' };
  var SIT_CLS = { pendiente: 'p-pendiente', parcial: 'p-parcial', vencida: 'p-cancelado', por_verificar: 'p-consultado', pagada: 'p-pagado', anulada: 'fin-anul' };
  var EST = { registrado: 'Por verificar', verificado: 'Verificado', anulado: 'Anulado' };
  var EST_CLS = { registrado: 'p-pendiente', verificado: 'p-pagado', anulado: 'fin-anul' };
  var CONC = { sena: 'Seña', saldo: 'Saldo', total: 'Total', penalidad: 'Penalidad', ajuste: 'Ajuste' };
  var MEDIO = { transferencia: 'Transferencia', pix: 'Pix', deposito: 'Depósito', efectivo: 'Efectivo', otro: 'Otro' };

  window.CSFinanzasPanel = function (ctx) {
    var esc = ctx.esc, kpi = ctx.kpi, S = ctx.S;
    var st = { datos: null, estado: null, cargando: false, error: '', fCobros: 'registrado', fPagos: 'abiertas', porProv: false, fMovs: 'todos', audit: null, modal: null, enviando: false };

    /* ---------- util ---------- */
    function m$(mon, n) { return (SIMB[mon] || mon) + ' ' + (Number(n) || 0).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
    function porMon(o) { var p = MONEDAS.filter(function (k) { return o && o[k]; }).map(function (k) { return m$(k, o[k]); }); return p.length ? p.join(' · ') : '—'; }
    function f(d) { return ctx.fecha ? ctx.fecha(d) : d; }
    function hoy() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
    /* tc = destino / origen. Se muestra al reves si queda mas legible: "1 US$ = $U 40,56". */
    function tcTxt(a, origen) { var tc = Number(a.tc) || 0; return tc >= 1 ? '1 ' + mon(origen) + ' = ' + m$(a.moneda_destino, Math.round(tc * 100) / 100) : '1 ' + mon(a.moneda_destino) + ' = ' + m$(origen, Math.round(100 / tc) / 100); }
    function pill(cls, t) { return '<span class="pill ' + cls + '">' + esc(t) + '</span>'; }
    function pedidos() { return (S.datos && S.datos.pedidos) || []; }
    function proveedores() { return ((S.datos && S.datos.proveedores) || []).filter(function (p) { return !p.eliminado_at; }); }
    function pedidoDe(id) { return pedidos().filter(function (p) { return p.id === id; })[0]; }
    function provDe(id) { return proveedores().filter(function (p) { return p.id === id; })[0]; }
    function asigDe(movId) { return ((st.datos && st.datos.asignaciones) || []).filter(function (a) { return a.movimiento_id === movId && !a.anulada; }); }
    function movDe(id) { return ((st.datos && st.datos.movimientos) || []).filter(function (m) { return m.id === id; })[0]; }
    function oblDe(id) { return ((st.datos && st.datos.obligaciones) || []).filter(function (o) { return o.id === id; })[0]; }

    function cargar() {
      st.cargando = true; st.error = '';
      ctx.api('fin/estado').then(function (e) {
        st.estado = e;
        if (!e.tablas || !e.activo) return null;
        return ctx.api('fin/datos').then(function (j) { st.datos = j; });
      }).catch(function (e) { st.error = e.message; })
        .then(function () { st.cargando = false; if (S.vista.indexOf('fin-') === 0) ctx.pintar(); });
    }
    function enviar(ruta, cuerpo, ok) {
      if (st.enviando) return;
      st.enviando = true; pintarModal();
      return ctx.api('fin/' + ruta, cuerpo).then(function (r) {
        st.enviando = false;
        if (ok) ok(r);
        cargar();
        return r;
      }).catch(function (e) {
        st.enviando = false;
        /* El server pide confirmar: misma operacion con la marca de "si, es otra". */
        if (e.status === 409 && /otra distinta|Cargar otra igual/.test(e.message) && window.confirm(e.message)) {
          var c = Object.assign({}, cuerpo); c[/otra distinta/.test(e.message) ? 'confirmar_parecido' : 'confirmar_repetida'] = true;
          return enviar(ruta, c, ok);
        }
        if (st.modal) { st.modal.error = e.message; pintarModal(); } else ctx.toast(e.message);
      });
    }

    /* ---------- pantallas ---------- */
    function vista() {
      if (!st.estado && !st.cargando && !st.error) cargar();
      if (st.error) return '<p class="aviso">' + esc(st.error) + '</p>';
      if (!st.estado || (st.cargando && !st.datos)) return '<div class="card"><p class="vacio">Cargando…</p></div>';
      if (!st.estado.tablas) return '<div class="card fin-pad"><h3>Falta preparar la base</h3><p>Corré <b>supabase_finanzas_1.sql</b> en el SQL Editor de Supabase. Es aditivo: no cambia pedidos, proveedores ni tours.</p><p class="sub">' + esc(st.estado.motivo || '') + '</p></div>';
      if (!st.estado.activo) return '<div class="card fin-pad"><h3>Finanzas está apagado</h3><p class="sub">Se prende en operaciones_config, clave <b>finanzas</b> = {"activo": true}.</p></div>';
      var d = st.datos;
      if (!d) return '<div class="card"><p class="vacio">Cargando…</p></div>';
      var acc = '<div class="fin-acc"><button class="btn btn--main" data-fin="nuevo-cobro">+ Registrar cobro</button><button class="btn" data-fin="nuevo-pix">+ Registrar Pix a proveedor</button><button class="btn" data-fin="nueva-obl">+ Obligación de pago</button></div>';
      var h = acc;
      if (S.vista === 'fin-cobros') return h + vistaCobros(d);
      if (S.vista === 'fin-pagos') return h + vistaPagos(d);
      if (S.vista === 'fin-movs') return h + vistaMovs(d);
      if (S.vista === 'fin-audit') return h + vistaAudit();
      return h + vistaResumen(d);
    }

    /* Servicios confirmados con proveedor que todavia no tienen obligacion: plata que vamos a deber y no esta anotada. */
    function sinObligacion(d) {
      var con = {};
      d.obligaciones.forEach(function (o) { if (o.situacion !== 'anulada' && o.item_id) con[o.pedido_id + '|' + o.item_id] = 1; });
      var out = [];
      pedidos().forEach(function (p) {
        if (p.estado === 'cancelado') return;
        (p.items || []).forEach(function (i) {
          if (i.estado === 'confirmado' && (i.proveedor_id || i.proveedor_nombre) && !con[p.id + '|' + i.id]) out.push({ p: p, i: i });
        });
      });
      return out;
    }
    function vistaResumen(d) {
      var k = d.kpis;
      var h = '<section class="kpis kpis--4" aria-label="Finanzas">' +
        kpi('Por verificar', String(k.por_verificar.n), k.por_verificar.n ? [porMon(k.por_verificar.entrada) !== '—' ? 'entró ' + porMon(k.por_verificar.entrada) : '', porMon(k.por_verificar.salida) !== '—' ? 'salió ' + porMon(k.por_verificar.salida) : ''].filter(Boolean).join(' · ') : 'todo verificado', k.por_verificar.n ? 'kpi--warn' : 'kpi--ok') +
        kpi('A pagar a proveedores', porMon(k.a_pagar), 'saldo de las obligaciones', '') +
        kpi('Vencidas', String(k.vencidas.n), k.vencidas.n ? porMon(k.vencidas.monto) : 'ninguna', k.vencidas.n ? 'kpi--bad' : '') +
        kpi('Vencen en 7 días', String(k.proximas.n), k.proximas.n ? porMon(k.proximas.monto) : 'nada urgente', k.proximas.n ? 'kpi--warn' : '') + '</section>';
      var at = [];
      d.obligaciones.filter(function (o) { return o.situacion === 'vencida'; }).forEach(function (o) {
        at.push(['bad', 'Pago vencido el ' + f(o.vence) + ' · ' + o.proveedor_nombre, (o.servicio || '') + (o.pedido_ref ? ' · ' + o.pedido_ref : '') + ' · falta ' + m$(o.moneda, o.saldo), '<button class="btn btn--sm" data-fin="pagar" data-id="' + o.id + '">Registrar pago</button>']);
      });
      d.obligaciones.filter(function (o) { return o.vence_pronto; }).forEach(function (o) {
        at.push(['warn', 'Vence el ' + f(o.vence) + ' · ' + o.proveedor_nombre, (o.servicio || '') + (o.pedido_ref ? ' · ' + o.pedido_ref : '') + ' · falta ' + m$(o.moneda, o.saldo), '<button class="btn btn--sm" data-fin="pagar" data-id="' + o.id + '">Registrar pago</button>']);
      });
      d.movimientos.filter(function (m) { return m.estado === 'registrado'; }).forEach(function (m) {
        at.push(['warn', (m.sentido === 'entrada' ? 'Cobro' : 'Pago') + ' sin verificar · ' + m$(m.moneda, m.importe), f(m.fecha) + ' · ' + (m.contraparte || m.referencia), '<button class="btn btn--sm" data-fin="verificar" data-id="' + m.id + '">Verificar</button>']);
      });
      d.movimientos.filter(function (m) { return m.estado !== 'anulado' && m.libre > 0; }).forEach(function (m) {
        at.push(['info', 'Transferencia sin asignar · ' + m$(m.moneda, m.libre) + ' libres', f(m.fecha) + ' · ' + (m.contraparte || m.referencia), '<button class="btn btn--sm" data-fin="asignar" data-id="' + m.id + '">Asignar</button>']);
      });
      sinObligacion(d).forEach(function (x) {
        at.push(['info', 'Servicio confirmado sin obligación de pago', x.i.nombre + ' · ' + (x.i.proveedor_nombre || '') + ' · ' + x.p.ref, '<button class="btn btn--sm" data-fin="nueva-obl" data-ped="' + x.p.id + '" data-item="' + esc(x.i.id) + '">Cargar</button>']);
      });
      pedidos().filter(function (p) { return p.cuentas && p.cuentas.a_devolver_usd > 0; }).forEach(function (p) {
        at.push(['bad', 'Reembolso pendiente · ' + ctx.usd(p.cuentas.a_devolver_usd), p.ref + ' · ' + (p.cliente_nombre || ''), '']);
      });
      h += '<div class="card"><h3 class="fin-h">Necesitan atención</h3>' + (at.length ? '<ul class="fin-at">' + at.map(function (a) {
        return '<li class="fin-at--' + a[0] + '"><div><b>' + esc(a[1]) + '</b><span class="sub">' + esc(a[2]) + '</span></div>' + a[3] + '</li>';
      }).join('') + '</ul>' : '<p class="vacio">Nada pendiente.</p>') + '</div>';
      return h;
    }

    function chips(nombre, actual, ops) {
      return '<div class="chips">' + ops.map(function (o) { return '<button class="chip" data-fin-f="' + nombre + '" data-v="' + o[0] + '" aria-pressed="' + (actual === o[0]) + '">' + esc(o[1]) + (o[2] != null ? '<span>' + o[2] + '</span>' : '') + '</button>'; }).join('') + '</div>';
    }
    function accionesMov(m) {
      var b = [];
      if (m.estado === 'registrado') b.push('<button class="btn btn--sm btn--main" data-fin="verificar" data-id="' + m.id + '">Verificar</button>');
      if (m.estado !== 'anulado' && m.libre > 0) b.push('<button class="btn btn--sm" data-fin="asignar" data-id="' + m.id + '">Asignar</button>');
      if (m.comprobante) b.push('<button class="btn btn--sm" data-fin="ver-comp" data-id="' + m.id + '">Comprobante</button>');
      else if (m.estado !== 'anulado') b.push('<button class="btn btn--sm" data-fin="subir-comp" data-id="' + m.id + '">Subir comprobante</button>');
      if (m.estado !== 'anulado') b.push('<button class="btn btn--sm btn--danger" data-fin="anular-mov" data-id="' + m.id + '">Anular</button>');
      b.push('<button class="btn btn--sm" data-fin="historia" data-ent="movimiento" data-id="' + m.id + '">Historia</button>');
      return '<div class="fin-btns">' + b.join('') + '</div>';
    }
    function destinoTxt(a) {
      if (a.tipo === 'pago') { var o = oblDe(a.obligacion_id); return (o ? o.proveedor_nombre + ' · ' + (o.servicio || '') : 'obligación') + (a.pedido_ref ? ' · ' + a.pedido_ref : ''); }
      var p = pedidoDe(a.pedido_id);
      return (a.tipo === 'reembolso' ? 'Reembolso · ' : '') + (a.pedido_ref || '') + (p && p.cliente_nombre ? ' · ' + p.cliente_nombre : '');
    }
    function filaMov(m) {
      var as = asigDe(m.id);
      return '<tr class="' + (m.estado === 'anulado' ? 'fin-tachado' : '') + '"><td data-l="Fecha">' + esc(f(m.fecha)) + '</td>' +
        '<td data-l="De / para"><b>' + esc(m.contraparte || '—') + '</b><span class="sub">' + esc(MEDIO[m.medio] || m.medio) + (m.cuenta ? ' · ' + esc(m.cuenta) : '') + (m.referencia ? ' · ref ' + esc(m.referencia) : '') + '</span></td>' +
        '<td class="num" data-l="Importe"><b>' + (m.sentido === 'salida' ? '− ' : '') + esc(m$(m.moneda, m.importe)) + '</b>' + (m.libre > 0 && m.estado !== 'anulado' ? '<span class="sub">' + esc(m$(m.moneda, m.libre)) + ' sin asignar</span>' : '') + '</td>' +
        '<td data-l="Va a">' + (as.length ? as.map(function (a) { return '<span class="sub">' + esc(destinoTxt(a)) + ' · ' + esc(m$(a.moneda_destino, a.importe_destino)) + (a.moneda_destino !== m.moneda ? ' (' + esc(tcTxt(a, m.moneda)) + ')' : '') + ' <button class="fin-x" data-fin="anular-asig" data-id="' + a.id + '" title="Anular esta asignación" aria-label="Anular esta asignación">×</button></span>'; }).join('') : '<span class="sub">—</span>') + '</td>' +
        '<td data-l="Estado">' + pill(EST_CLS[m.estado], EST[m.estado]) + (m.estado === 'verificado' ? '<span class="sub">' + esc(m.verificado_por) + '</span>' : m.estado === 'anulado' ? '<span class="sub">' + esc(m.anulado_motivo) + '</span>' : '') + '</td>' +
        '<td>' + accionesMov(m) + '</td></tr>';
    }
    function tablaMovs(lista, vacio) {
      if (!lista.length) return '<div class="card"><p class="vacio">' + esc(vacio) + '</p></div>';
      return '<div class="card fin-tabla"><table><thead><tr><th>Fecha</th><th>De / para</th><th class="num">Importe</th><th>Va a</th><th>Estado</th><th></th></tr></thead><tbody>' + lista.map(filaMov).join('') + '</tbody></table></div>';
    }
    function vistaCobros(d) {
      var ent = d.movimientos.filter(function (m) { return m.sentido === 'entrada'; });
      var n = function (e) { return ent.filter(function (m) { return e === 'todos' || m.estado === e; }).length; };
      var lista = ent.filter(function (m) { return st.fCobros === 'todos' || m.estado === st.fCobros; });
      return '<div class="bar">' + chips('fCobros', st.fCobros, [['registrado', 'Por verificar', n('registrado')], ['verificado', 'Verificados', n('verificado')], ['anulado', 'Anulados', n('anulado')], ['todos', 'Todos', n('todos')]]) + '</div>' +
        tablaMovs(lista, 'No hay cobros en esta lista.');
    }
    function vistaMovs(d) {
      var lista = d.movimientos.filter(function (m) { return st.fMovs === 'todos' || m.sentido === st.fMovs; });
      return '<div class="bar">' + chips('fMovs', st.fMovs, [['todos', 'Todas'], ['entrada', 'Entraron'], ['salida', 'Salieron']]) + '</div>' + tablaMovs(lista, 'Todavía no hay transferencias cargadas.');
    }

    function vistaPagos(d) {
      var abiertas = function (o) { return o.situacion !== 'anulada' && o.situacion !== 'pagada'; };
      var filtro = { abiertas: abiertas, vencida: function (o) { return o.situacion === 'vencida'; }, pagada: function (o) { return o.situacion === 'pagada'; }, todas: function () { return true; } }[st.fPagos] || abiertas;
      var lista = d.obligaciones.filter(filtro).sort(function (a, b) { return String(a.vence || '9999').localeCompare(String(b.vence || '9999')); });
      var cnt = function (fn) { return d.obligaciones.filter(fn).length; };
      var h = '<div class="bar">' + chips('fPagos', st.fPagos, [['abiertas', 'Por pagar', cnt(abiertas)], ['vencida', 'Vencidas', cnt(function (o) { return o.situacion === 'vencida'; })], ['pagada', 'Pagadas', cnt(function (o) { return o.situacion === 'pagada'; })], ['todas', 'Todas', d.obligaciones.length]]) +
        '<button class="chip" data-fin="por-prov" aria-pressed="' + st.porProv + '">Liquidación por proveedor</button></div>';
      if (st.porProv) return h + vistaLiquidacion(d);
      if (!lista.length) return h + '<div class="card"><p class="vacio">' + (d.obligaciones.length ? 'No hay obligaciones en esta lista.' : 'Todavía no cargaste obligaciones. Cuando un proveedor confirma un servicio, cargá lo que hay que pagarle con "+ Obligación de pago".') + '</p></div>';
      return h + '<div class="card fin-tabla"><table><thead><tr><th>Proveedor</th><th>Servicio / pedido</th><th class="num">Importe</th><th class="num">Pagado</th><th class="num">Falta</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>' +
        lista.map(function (o) {
          var b = [];
          if (o.saldo > 0) b.push('<button class="btn btn--sm btn--main" data-fin="pagar" data-id="' + o.id + '">Registrar pago</button>');
          if (o.situacion !== 'anulada') b.push('<button class="btn btn--sm" data-fin="editar-obl" data-id="' + o.id + '">Vencimiento</button>', '<button class="btn btn--sm btn--danger" data-fin="anular-obl" data-id="' + o.id + '">Anular</button>');
          b.push('<button class="btn btn--sm" data-fin="historia" data-ent="obligacion" data-id="' + o.id + '">Historia</button>');
          return '<tr class="' + (o.situacion === 'anulada' ? 'fin-tachado' : '') + '"><td data-l="Proveedor"><b>' + esc(o.proveedor_nombre) + '</b></td>' +
            '<td data-l="Servicio">' + esc(o.servicio || '—') + '<span class="sub">' + esc(CONC[o.concepto] || o.concepto) + (o.pedido_ref ? ' · ' + esc(o.pedido_ref) : '') + (o.nota ? ' · ' + esc(o.nota) : '') + '</span></td>' +
            '<td class="num" data-l="Importe">' + esc(m$(o.moneda, o.importe)) + '</td>' +
            '<td class="num" data-l="Pagado">' + esc(m$(o.moneda, o.pagado)) + (o.por_verificar ? '<span class="sub">+ ' + esc(m$(o.moneda, o.por_verificar)) + ' sin verificar</span>' : '') + '</td>' +
            '<td class="num" data-l="Falta"><b class="' + (o.saldo > 0 ? 'deuda' : 'ok') + '">' + esc(m$(o.moneda, o.saldo)) + '</b></td>' +
            '<td data-l="Vence">' + esc(o.vence ? f(o.vence) : '—') + '</td>' +
            '<td data-l="Estado">' + pill(SIT_CLS[o.situacion], SIT[o.situacion]) + '</td><td><div class="fin-btns">' + b.join('') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    /* Liquidacion: cuanto se le debe a cada proveedor, por moneda, y si esta al dia. */
    function vistaLiquidacion(d) {
      var g = {};
      d.obligaciones.forEach(function (o) {
        if (o.situacion === 'anulada') return;
        var k = o.proveedor_id || o.proveedor_nombre;
        var x = g[k] || (g[k] = { id: o.proveedor_id, nombre: o.proveedor_nombre, importe: {}, pagado: {}, saldo: {}, abiertas: 0, vencidas: 0, prox: null });
        x.importe[o.moneda] = (x.importe[o.moneda] || 0) + Number(o.importe);
        x.pagado[o.moneda] = (x.pagado[o.moneda] || 0) + o.pagado;
        x.saldo[o.moneda] = (x.saldo[o.moneda] || 0) + o.saldo;
        if (o.saldo > 0) { x.abiertas++; if (o.situacion === 'vencida') x.vencidas++; if (o.vence && (!x.prox || o.vence < x.prox)) x.prox = o.vence; }
      });
      var filas = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.abiertas - a.abiertas || a.nombre.localeCompare(b.nombre); });
      if (!filas.length) return '<div class="card"><p class="vacio">Todavía no hay obligaciones.</p></div>';
      return '<div class="card fin-tabla"><table><thead><tr><th>Proveedor</th><th class="num">Total</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Próximo venc.</th><th>Estado</th><th></th></tr></thead><tbody>' +
        filas.map(function (x) {
          var pend = x.abiertas > 0;
          return '<tr><td data-l="Proveedor"><b>' + esc(x.nombre) + '</b><span class="sub">' + x.abiertas + ' obligación(es) abierta(s)</span></td>' +
            '<td class="num" data-l="Total">' + esc(porMon(x.importe)) + '</td><td class="num" data-l="Pagado">' + esc(porMon(x.pagado)) + '</td>' +
            '<td class="num" data-l="Saldo"><b class="' + (pend ? 'deuda' : 'ok') + '">' + esc(porMon(x.saldo)) + '</b></td>' +
            '<td data-l="Próximo venc.">' + esc(x.prox ? f(x.prox) : '—') + '</td>' +
            '<td data-l="Estado">' + (pend ? pill(x.vencidas ? 'p-cancelado' : 'p-pendiente', x.vencidas ? 'Vencido' : 'Saldo pendiente') : pill('p-pagado', 'Pagado')) + '</td>' +
            '<td>' + (pend && x.id ? '<button class="btn btn--sm btn--main" data-fin="nuevo-pix" data-prov="' + x.id + '">Pagar por Pix</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function vistaAudit() {
      if (!st.audit) { st.audit = { cargando: true }; ctx.api('fin/auditoria').then(function (j) { st.audit = { filas: j.filas }; ctx.pintar(); }).catch(function (e) { st.audit = { error: e.message }; ctx.pintar(); }); }
      if (st.audit.error) return '<p class="aviso">' + esc(st.audit.error) + '</p>';
      if (st.audit.cargando) return '<div class="card"><p class="vacio">Cargando…</p></div>';
      return '<div class="card fin-tabla">' + tablaAudit(st.audit.filas) + '</div><p class="sub">Las últimas 200 acciones. La auditoría no se edita ni se borra.</p>';
    }
    var ACC = { 'movimiento:registrar': 'Registró una transferencia', 'movimiento:verificar': 'Verificó una transferencia', 'movimiento:anular': 'Anuló una transferencia', 'movimiento:comprobante': 'Subió un comprobante',
      'asignacion:asignar': 'Asignó plata', 'asignacion:anular': 'Anuló una asignación', 'obligacion:crear': 'Creó una obligación', 'obligacion:editar': 'Editó una obligación', 'obligacion:anular': 'Anuló una obligación' };
    function resumenFila(a) {
      var x = a.despues || {};
      if (a.entidad === 'movimiento' && x.importe) return (x.sentido === 'salida' ? 'Salida ' : 'Entrada ') + m$(x.moneda, x.importe) + (x.contraparte ? ' · ' + x.contraparte : '') + (x.anulado_motivo ? ' · ' + x.anulado_motivo : '');
      if (a.entidad === 'asignacion' && x.importe) return m$(x.moneda_destino, x.importe_destino) + ' → ' + (x.pedido_ref || 'obligación') + (x.anulada_motivo ? ' · ' + x.anulada_motivo : '');
      if (a.entidad === 'obligacion' && x.importe) return x.proveedor_nombre + ' · ' + m$(x.moneda, x.importe) + (x.vence ? ' · vence ' + x.vence : '') + (x.anulada_motivo ? ' · ' + x.anulada_motivo : '');
      return '';
    }
    function tablaAudit(filas) {
      if (!filas || !filas.length) return '<p class="vacio">Sin acciones registradas.</p>';
      return '<table><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead><tbody>' + filas.map(function (a) {
        return '<tr><td data-l="Cuándo">' + esc(ctx.fechaHora(a.at)) + '</td><td data-l="Quién">' + esc(a.usuario || '—') + '</td><td data-l="Qué">' + esc(ACC[a.entidad + ':' + a.accion] || (a.accion + ' ' + a.entidad)) + '</td><td data-l="Detalle"><span class="sub">' + esc(resumenFila(a)) + '</span></td></tr>';
      }).join('') + '</tbody></table>';
    }

    /* ---------- formularios (ventana propia, encima de la pantalla) ---------- */
    function opcionesPedidos(sel) {
      return '<option value="">Elegí el pedido…</option>' + pedidos().filter(function (p) { return p.estado !== 'cancelado' || p.id === sel; }).map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.ref + ' · ' + (p.cliente_nombre || 'sin nombre') + ' · ' + ctx.usd(p.total_usd || (p.cuentas && p.cuentas.total_usd) || 0)) + '</option>';
      }).join('');
    }
    function opcionesProv(sel) {
      return '<option value="">Elegí el proveedor…</option>' + proveedores().slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); }).map(function (p) { return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('');
    }
    function opcionesMon(sel) { return MONEDAS.map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + k + ' (' + SIMB[k] + ')</option>'; }).join(''); }
    function cuentasUsadas() { var s = {}; ((st.datos && st.datos.movimientos) || []).forEach(function (m) { if (m.cuenta) s[m.cuenta] = 1; }); return '<datalist id="fin-cuentas">' + Object.keys(s).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>'; }
    function campo(et, html, cls) { return '<label class="f' + (cls ? ' ' + cls : '') + '">' + esc(et) + html + '</label>'; }
    function inp(id, val, extra) { return '<input id="' + id + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '>'; }
    var COMP = campo('Comprobante (PDF, JPG o PNG, opcional)', '<input id="fm-comp" type="file" accept="application/pdf,image/jpeg,image/png">');

    function abrir(m) { st.modal = Object.assign({ error: '' }, m); pintarModal(); }
    function cerrar() { st.modal = null; var el = document.getElementById('fin-modal'); if (el) el.remove(); }
    function pintarModal() {
      var m = st.modal; if (!m) return;
      var el = document.getElementById('fin-modal');
      if (!el) { el = document.createElement('div'); el.id = 'fin-modal'; el.className = 'fin-velo'; document.body.appendChild(el); }
      var cuerpo = FORMS[m.tipo](m);
      el.innerHTML = '<div class="fin-caja" role="dialog" aria-modal="true" aria-labelledby="fin-tit"><div class="panel__head"><h2 id="fin-tit">' + esc(cuerpo[0]) + '</h2><button class="btn btn--x" data-fin="cerrar" aria-label="Cerrar">✕</button></div>' +
        '<div class="fin-form">' + cuerpo[1] + (m.error ? '<p class="aviso">' + esc(m.error) + '</p>' : '') + '</div>' +
        '<div class="foot"><button class="btn" data-fin="cerrar">Cancelar</button>' + (cuerpo[2] ? '<button class="btn btn--main" data-fin="ok"' + (st.enviando ? ' disabled' : '') + '>' + esc(st.enviando ? 'Guardando…' : cuerpo[2]) + '</button>' : '') + '</div></div>';
      var foco = el.querySelector('input:not([type=hidden]),select,textarea'); if (foco && !m.enfocado) { foco.focus(); m.enfocado = true; }
    }
    function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function mon(o) { return o === 'USD' ? 'US$' : SIMB[o]; }

    var FORMS = {
      cobro: function (m) {
        var moneda = m.moneda || 'UYU';
        return ['Registrar cobro de un cliente',
          '<div class="grid">' + campo('Pedido', '<select id="fm-ped">' + opcionesPedidos(m.pedido_id) + '</select>', 'fin-ancho') +
          campo('Fecha en que se acreditó', inp('fm-fecha', m.fecha || hoy(), ' type="date" max="' + hoy() + '"')) +
          campo('Moneda', '<select id="fm-mon" data-fin-re>' + opcionesMon(moneda) + '</select>') +
          campo('Importe que entró (' + mon(moneda) + ')', inp('fm-imp', m.importe, ' inputmode="decimal" placeholder="0"')) +
          (moneda !== 'USD' ? campo('Equivale a (US$, para el pedido)', inp('fm-eq', m.eq, ' inputmode="decimal" placeholder="lo que descuenta del pedido"')) : '') +
          campo('Quién la mandó', inp('fm-contra', m.contraparte, ' placeholder="nombre del titular"')) +
          campo('Número de operación', inp('fm-ref', m.referencia, ' placeholder="del comprobante o del home banking"')) +
          campo('Cuenta donde entró', inp('fm-cta', m.cuenta, ' list="fin-cuentas" placeholder="ej. BROU pesos"') + cuentasUsadas()) +
          campo('Nota', inp('fm-nota', m.nota), 'fin-ancho') + COMP + '</div>' +
          '<p class="sub">Queda <b>por verificar</b> hasta que la veas acreditada en el home banking.</p>', 'Guardar cobro'];
      },
      pix: function (m) {
        var prov = m.proveedor_id || '';
        var obls = ((st.datos && st.datos.obligaciones) || []).filter(function (o) { return o.proveedor_id === prov && o.saldo > 0 && o.moneda === 'BRL'; });
        var otras = ((st.datos && st.datos.obligaciones) || []).filter(function (o) { return o.proveedor_id === prov && o.saldo > 0 && o.moneda !== 'BRL'; }).length;
        m.sel = m.sel || {}; obls.forEach(function (o) { if (!(o.id in m.sel)) m.sel[o.id] = m.solo ? (m.solo === o.id ? o.saldo : '') : o.saldo; });
        var total = obls.reduce(function (a, o) { var v = parseFloat(String(m.sel[o.id] || '').replace(',', '.')); return a + (v > 0 ? v : 0); }, 0);
        var p = provDe(prov);
        return ['Registrar Pix a un proveedor',
          '<div class="grid">' + campo('Proveedor', '<select id="fm-prov" data-fin-re>' + opcionesProv(prov) + '</select>', 'fin-ancho') + '</div>' +
          (p && p.datos_pago ? '<p class="sub">Datos de pago: ' + esc(p.datos_pago) + '</p>' : '') +
          (prov ? (obls.length ? '<div class="fin-obls"><p class="sub">Qué paga este Pix (R$):</p>' + obls.map(function (o) {
            return '<label class="fin-obl"><span><b>' + esc(o.servicio || '—') + '</b><span class="sub">' + esc((CONC[o.concepto] || o.concepto) + (o.pedido_ref ? ' · ' + o.pedido_ref : '') + ' · falta ' + m$(o.moneda, o.saldo) + (o.vence ? ' · vence ' + f(o.vence) : '')) + '</span></span><input data-fin-obl="' + o.id + '" inputmode="decimal" value="' + esc(m.sel[o.id]) + '" placeholder="0"></label>';
          }).join('') + '<p class="fin-total">Total del Pix: <b>' + esc(m$('BRL', Math.round(total * 100) / 100)) + '</b></p></div>' : '<p class="aviso">Este proveedor no tiene obligaciones abiertas en reales. Cargá primero la obligación.</p>') + (otras ? '<p class="sub">' + otras + ' obligación(es) en otra moneda: se pagan desde Transferencias &gt; Asignar.</p>' : '') : '') +
          '<div class="grid">' + campo('Fecha del Pix', inp('fm-fecha', m.fecha || hoy(), ' type="date" max="' + hoy() + '"')) +
          campo('ID del Pix (E2E) o comprobante', inp('fm-ref', m.referencia, ' placeholder="E2E…"')) +
          campo('Cuenta de donde salió', inp('fm-cta', m.cuenta, ' list="fin-cuentas"') + cuentasUsadas()) +
          campo('Nota', inp('fm-nota', m.nota)) + COMP + '</div>', obls.length ? 'Guardar Pix' : ''];
      },
      obligacion: function (m) {
        var p = m.pedido_id ? pedidoDe(m.pedido_id) : null;
        var items = p ? (p.items || []).filter(function (i) { return i.estado !== 'cancelado'; }) : [];
        var it = items.filter(function (i) { return i.id === m.item_id; })[0];
        var prov = m.proveedor_id || (it && it.proveedor_id) || '';
        var pr = provDe(prov);
        var moneda = m.moneda || (pr && pr.moneda) || 'BRL';
        return ['Nueva obligación de pago',
          '<div class="grid">' + campo('Pedido (opcional)', '<select id="fm-ped" data-fin-re>' + opcionesPedidos(m.pedido_id).replace('Elegí el pedido…', 'Sin pedido') + '</select>', 'fin-ancho') +
          (p ? campo('Servicio del pedido', '<select id="fm-item" data-fin-re><option value="">Elegí…</option>' + items.map(function (i) { return '<option value="' + esc(i.id) + '"' + (i.id === m.item_id ? ' selected' : '') + '>' + esc(i.nombre + (i.proveedor_nombre ? ' · ' + i.proveedor_nombre : '')) + '</option>'; }).join('') + '</select>', 'fin-ancho') : campo('Servicio', inp('fm-srv', m.servicio, ' placeholder="qué es"'), 'fin-ancho')) +
          campo('Proveedor', '<select id="fm-prov" data-fin-re>' + opcionesProv(prov) + '</select>', 'fin-ancho') +
          campo('Concepto', '<select id="fm-conc">' + Object.keys(CONC).map(function (k) { return '<option value="' + k + '"' + (k === (m.concepto || 'total') ? ' selected' : '') + '>' + CONC[k] + '</option>'; }).join('') + '</select>') +
          campo('Moneda', '<select id="fm-mon" data-fin-re>' + opcionesMon(moneda) + '</select>') +
          campo('Importe (' + mon(moneda) + ')', inp('fm-imp', m.importe, ' inputmode="decimal"')) +
          campo('Vence', inp('fm-vence', m.vence, ' type="date"')) +
          campo('Nota', inp('fm-nota', m.nota), 'fin-ancho') + '</div>' +
          (it && it.costo_usd ? '<p class="sub">En el pedido figura un costo de ' + esc(ctx.usd(it.costo_usd)) + '.</p>' : '') +
          (pr && pr.condiciones ? '<p class="sub">Condiciones del proveedor: ' + esc(pr.condiciones) + '</p>' : ''), 'Guardar obligación'];
      },
      verificar: function (m) {
        var x = movDe(m.id);
        return ['Verificar transferencia',
          '<div class="fin-det"><b>' + esc((x.sentido === 'entrada' ? 'Entró ' : 'Salió ') + m$(x.moneda, x.importe)) + '</b><span class="sub">' + esc(f(x.fecha) + ' · ' + (x.contraparte || '—') + (x.cuenta ? ' · ' + x.cuenta : '')) + '</span></div>' +
          (x.referencia ? '<p class="sub">Número de operación: <b>' + esc(x.referencia) + '</b></p>' : campo('Número de operación', inp('fm-ref', m.referencia, ' placeholder="hace falta esto o el comprobante"'))) +
          (x.comprobante ? '<p class="sub">Tiene comprobante cargado.</p>' : COMP) +
          '<label class="fin-conf"><input type="checkbox" id="fm-conf"> La vi acreditada en el home banking: misma fecha, moneda e importe.</label>', 'Verificar'];
      },
      asignar: function (m) {
        var x = movDe(m.id);
        var tipo = x.sentido === 'entrada' ? 'cobro' : (m.tipo2 || 'pago');
        var obls = ((st.datos && st.datos.obligaciones) || []).filter(function (o) { return o.saldo > 0; });
        var o = m.obligacion_id ? oblDe(m.obligacion_id) : null;
        var destMon = tipo === 'pago' ? (o ? o.moneda : x.moneda) : 'USD';
        return ['Asignar transferencia',
          '<div class="fin-det"><b>' + esc(m$(x.moneda, x.libre) + ' sin asignar') + '</b><span class="sub">' + esc(f(x.fecha) + ' · ' + (x.contraparte || '—')) + '</span></div><div class="grid">' +
          (x.sentido === 'salida' ? campo('Es', '<select id="fm-tipo" data-fin-re><option value="pago"' + (tipo === 'pago' ? ' selected' : '') + '>Pago a proveedor</option><option value="reembolso"' + (tipo === 'reembolso' ? ' selected' : '') + '>Reembolso a un cliente</option></select>') : '') +
          (tipo === 'pago' ? campo('Obligación', '<select id="fm-obl" data-fin-re><option value="">Elegí…</option>' + obls.map(function (b) { return '<option value="' + b.id + '"' + (b.id === m.obligacion_id ? ' selected' : '') + '>' + esc(b.proveedor_nombre + ' · ' + (b.servicio || '') + ' · falta ' + m$(b.moneda, b.saldo)) + '</option>'; }).join('') + '</select>', 'fin-ancho')
            : campo('Pedido', '<select id="fm-ped">' + opcionesPedidos(m.pedido_id) + '</select>', 'fin-ancho')) +
          campo('Cuánto de la transferencia (' + mon(x.moneda) + ')', inp('fm-imp', m.importe != null ? m.importe : x.libre, ' inputmode="decimal"')) +
          (destMon !== x.moneda ? campo('Equivale a (' + mon(destMon) + ')', inp('fm-eq', m.eq, ' inputmode="decimal"')) : '') +
          campo('Nota', inp('fm-nota', m.nota), 'fin-ancho') + '</div>', 'Asignar'];
      },
      anular: function (m) {
        return [m.titulo, '<p>' + esc(m.texto) + '</p>' + campo('Motivo (queda en la historia)', '<textarea id="fm-motivo" rows="3"></textarea>') + '<p class="sub">No se borra: queda anulado y se ve en Auditoría.</p>', 'Anular'];
      },
      vence: function (m) {
        var o = oblDe(m.id);
        return ['Vencimiento y nota', '<div class="fin-det"><b>' + esc(o.proveedor_nombre + ' · ' + m$(o.moneda, o.importe)) + '</b><span class="sub">' + esc(o.servicio || '') + '</span></div><div class="grid">' +
          campo('Vence', inp('fm-vence', o.vence, ' type="date"')) + campo('Nota', inp('fm-nota', o.nota)) + '</div><p class="sub">El importe no se edita: si está mal, anulá esta obligación y cargá otra.</p>', 'Guardar'];
      },
      comp: function (m) {
        return ['Subir comprobante', COMP.replace(', opcional', ''), 'Subir'];
      },
      historia: function (m) {
        return ['Historia', m.filas ? tablaAudit(m.filas) : '<p class="vacio">Cargando…</p>', ''];
      }
    };

    /* Lee el archivo elegido. Las fotos grandes se achican a JPEG para que entren (3 MB). */
    function leerComp() {
      var inp = document.getElementById('fm-comp'), file = inp && inp.files && inp.files[0];
      if (!file) return Promise.resolve(null);
      return new Promise(function (ok, mal) {
        var r = new FileReader();
        r.onerror = function () { mal(new Error('No se pudo leer el archivo.')); };
        r.onload = function () {
          if (!/^image\//.test(file.type) || file.size < 1.5e6) { if (file.size > 3 * 1024 * 1024) return mal(new Error('El archivo pesa más de 3 MB.')); return ok(r.result); }
          var img = new Image();
          img.onload = function () {
            var esc2 = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
            c.width = Math.round(img.width * esc2); c.height = Math.round(img.height * esc2);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            ok(c.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = function () { mal(new Error('No se pudo leer la imagen.')); };
          img.src = r.result;
        };
        r.readAsDataURL(file);
      });
    }
    function conComp(movId, datos) { return datos ? ctx.api('fin/comprobante', { id: movId, datos: datos }) : Promise.resolve(); }
    /* Guarda lo que hay en los campos antes de volver a pintar la ventana (al cambiar moneda, proveedor, pedido). */
    function guardarCampos() {
      var m = st.modal; if (!m) return;
      var map = { 'fm-ped': 'pedido_id', 'fm-fecha': 'fecha', 'fm-mon': 'moneda', 'fm-imp': 'importe', 'fm-eq': 'eq', 'fm-contra': 'contraparte', 'fm-ref': 'referencia', 'fm-cta': 'cuenta', 'fm-nota': 'nota', 'fm-prov': 'proveedor_id', 'fm-item': 'item_id', 'fm-conc': 'concepto', 'fm-vence': 'vence', 'fm-srv': 'servicio', 'fm-tipo': 'tipo2', 'fm-obl': 'obligacion_id' };
      Object.keys(map).forEach(function (id) { var e = document.getElementById(id); if (e) m[map[id]] = e.value; });
      document.querySelectorAll('[data-fin-obl]').forEach(function (e) { m.sel[e.getAttribute('data-fin-obl')] = e.value; });
    }

    function confirmar() {
      var m = st.modal; guardarCampos(); m.error = '';
      var listo = function () { cerrar(); };
      if (m.tipo === 'cobro') {
        if (!m.pedido_id) { m.error = 'Elegí el pedido.'; return pintarModal(); }
        return leerComp().then(function (comp) {
          var a = { tipo: 'cobro', pedido_id: m.pedido_id, importe: m.importe };
          if ((m.moneda || 'UYU') !== 'USD') a.importe_destino = m.eq;
          return enviar('movimiento', { sentido: 'entrada', medio: 'transferencia', fecha: m.fecha, moneda: m.moneda || 'UYU', importe: m.importe, contraparte: m.contraparte, referencia: m.referencia, cuenta: m.cuenta, nota: m.nota, asignaciones: [a] },
            function (r) { listo(); conComp(r.movimiento.id, comp).then(cargar).catch(function (e) { ctx.toast('Cobro guardado, pero el comprobante no: ' + e.message); }); ctx.toast('Cobro guardado: queda por verificar.'); });
        }).catch(function (e) { m.error = e.message; pintarModal(); });
      }
      if (m.tipo === 'pix') {
        var asigs = Object.keys(m.sel).map(function (id) { return { tipo: 'pago', obligacion_id: id, importe: m.sel[id] }; }).filter(function (a) { return parseFloat(String(a.importe).replace(',', '.')) > 0; });
        if (!asigs.length) { m.error = 'Poné cuánto paga este Pix de al menos una obligación.'; return pintarModal(); }
        var tot = asigs.reduce(function (s, a) { return s + parseFloat(String(a.importe).replace(',', '.')); }, 0);
        return leerComp().then(function (comp) {
          return enviar('movimiento', { sentido: 'salida', medio: 'pix', moneda: 'BRL', importe: Math.round(tot * 100) / 100, fecha: m.fecha, referencia: m.referencia, contraparte: (provDe(m.proveedor_id) || {}).nombre || '', cuenta: m.cuenta, nota: m.nota, asignaciones: asigs },
            function (r) { listo(); conComp(r.movimiento.id, comp).then(cargar).catch(function (e) { ctx.toast('Pix guardado, pero el comprobante no: ' + e.message); }); ctx.toast('Pix guardado: queda por verificar.'); });
        }).catch(function (e) { m.error = e.message; pintarModal(); });
      }
      if (m.tipo === 'obligacion') {
        return enviar('obligacion', { pedido_id: m.pedido_id || null, item_id: m.item_id || '', servicio: m.servicio, proveedor_id: m.proveedor_id, concepto: m.concepto, moneda: m.moneda, importe: m.importe, vence: m.vence, nota: m.nota }, function () { listo(); ctx.toast('Obligación guardada.'); });
      }
      if (m.tipo === 'verificar') {
        if (!document.getElementById('fm-conf').checked) { m.error = 'Marcá que la viste acreditada en el home banking.'; return pintarModal(); }
        return leerComp().then(function (comp) {
          /* El comprobante va primero: puede ser lo que permite verificarla. */
          return conComp(m.id, comp).then(function () { return enviar('verificar', { id: m.id, confirmo: true, referencia: m.referencia }, function () { listo(); ctx.toast('Verificada.'); }); });
        }).catch(function (e) { m.error = e.message; pintarModal(); });
      }
      if (m.tipo === 'asignar') {
        var x = movDe(m.id), tipo = x.sentido === 'entrada' ? 'cobro' : (m.tipo2 || 'pago');
        return enviar('asignar', { movimiento_id: m.id, tipo: tipo, pedido_id: m.pedido_id, obligacion_id: m.obligacion_id, importe: m.importe, importe_destino: m.eq, nota: m.nota }, function () { listo(); ctx.toast('Asignada.'); });
      }
      if (m.tipo === 'anular') {
        return enviar(m.ruta, { id: m.id, motivo: val('fm-motivo') }, function () { listo(); ctx.toast('Anulado.'); });
      }
      if (m.tipo === 'vence') return enviar('editar-obligacion', { id: m.id, vence: m.vence, nota: m.nota }, function () { listo(); ctx.toast('Guardado.'); });
      if (m.tipo === 'comp') {
        return leerComp().then(function (comp) {
          if (!comp) { m.error = 'Elegí el archivo.'; return pintarModal(); }
          return enviar('comprobante', { id: m.id, datos: comp }, function () { listo(); ctx.toast('Comprobante guardado.'); });
        }).catch(function (e) { m.error = e.message; pintarModal(); });
      }
    }

    function verComprobante(id) {
      var w = window.open('', '_blank');   // se abre ya, en el clic: despues del await el navegador lo bloquearia
      ctx.api('fin/comprobante?id=' + encodeURIComponent(id)).then(function (j) {
        if (!w) return ctx.toast('El navegador bloqueó la ventana del comprobante.');
        if (/^data:/.test(j.url)) w.document.write('<title>Comprobante</title><iframe src="' + j.url + '" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>');
        else w.location = j.url;
      }).catch(function (e) { if (w) w.close(); ctx.toast(e.message); });
    }

    /* ---------- eventos ---------- */
    document.addEventListener('click', function (e) {
      if (S.vista.indexOf('fin-') !== 0 && !st.modal) return;
      if (st.modal && e.target.id === 'fin-modal') return cerrar();
      var t = e.target.closest('[data-fin],[data-fin-f]');
      if (!t) return;
      if (t.hasAttribute('data-fin-f')) { st[t.getAttribute('data-fin-f')] = t.getAttribute('data-v'); return ctx.pintar(); }
      var a = t.getAttribute('data-fin'), id = t.getAttribute('data-id');
      if (a === 'cerrar') return cerrar();
      if (a === 'ok') return confirmar();
      if (a === 'por-prov') { st.porProv = !st.porProv; return ctx.pintar(); }
      if (a === 'nuevo-cobro') return abrir({ tipo: 'cobro' });
      if (a === 'nuevo-pix') return abrir({ tipo: 'pix', proveedor_id: t.getAttribute('data-prov') || '' });
      if (a === 'nueva-obl') return abrir({ tipo: 'obligacion', pedido_id: t.getAttribute('data-ped') || '', item_id: t.getAttribute('data-item') || '' });
      if (a === 'pagar') { var o = oblDe(id); if (o.moneda !== 'BRL') return ctx.toast('Esta obligación es en ' + o.moneda + ': cargá la transferencia y asignala desde Transferencias.'); return abrir({ tipo: 'pix', proveedor_id: o.proveedor_id, solo: id }); }
      if (a === 'verificar') return abrir({ tipo: 'verificar', id: id });
      if (a === 'asignar') return abrir({ tipo: 'asignar', id: id });
      if (a === 'subir-comp') return abrir({ tipo: 'comp', id: id });
      if (a === 'ver-comp') return verComprobante(id);
      if (a === 'editar-obl') return abrir({ tipo: 'vence', id: id });
      if (a === 'anular-mov') return abrir({ tipo: 'anular', id: id, ruta: 'anular-movimiento', titulo: 'Anular transferencia', texto: 'Lo que tenga asignado deja de contar: el pedido o la obligación vuelven a tener ese saldo.' });
      if (a === 'anular-asig') return abrir({ tipo: 'anular', id: id, ruta: 'anular-asignacion', titulo: 'Anular asignación', texto: 'La transferencia queda con ese importe libre para asignarlo bien.' });
      if (a === 'anular-obl') return abrir({ tipo: 'anular', id: id, ruta: 'anular-obligacion', titulo: 'Anular obligación', texto: 'Si tiene pagos asignados, primero hay que anular esos pagos.' });
      if (a === 'historia') {
        abrir({ tipo: 'historia' });
        ctx.api('fin/auditoria?entidad=' + t.getAttribute('data-ent') + '&id=' + encodeURIComponent(id)).then(function (j) { if (st.modal && st.modal.tipo === 'historia') { st.modal.filas = j.filas; pintarModal(); } }).catch(function (er) { if (st.modal) { st.modal.error = er.message; pintarModal(); } });
      }
    });
    document.addEventListener('change', function (e) {
      if (!st.modal || !e.target.hasAttribute) return;
      if (e.target.hasAttribute('data-fin-re')) {
        guardarCampos();
        if (e.target.id === 'fm-prov' && st.modal.tipo === 'pix') st.modal.sel = {};
        if (e.target.id === 'fm-ped' && st.modal.tipo === 'obligacion') { st.modal.item_id = ''; st.modal.proveedor_id = ''; }
        if (e.target.id === 'fm-item' || e.target.id === 'fm-prov') st.modal.moneda = '';
        pintarModal();
      }
    });
    document.addEventListener('input', function (e) {
      if (!st.modal || st.modal.tipo !== 'pix' || !e.target.hasAttribute('data-fin-obl')) return;
      guardarCampos();
      var tot = Object.keys(st.modal.sel).reduce(function (s, k) { var v = parseFloat(String(st.modal.sel[k] || '').replace(',', '.')); return s + (v > 0 ? v : 0); }, 0);
      var el = document.querySelector('.fin-total b'); if (el) el.textContent = m$('BRL', Math.round(tot * 100) / 100);
    });
    document.addEventListener('keydown', function (e) { if (st.modal && e.key === 'Escape') cerrar(); });

    /* estilos propios de la pestana */
    if (!document.getElementById('fin-css')) {
      var css = document.createElement('style'); css.id = 'fin-css';
      css.textContent = '.fin-acc{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.fin-pad{padding:18px 20px}.fin-pad h3{margin:0 0 8px}' +
        '.fin-h{margin:0;padding:14px 16px 6px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}' +
        '.fin-at{list-style:none;margin:0;padding:0 8px 8px}.fin-at li{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 10px;border-top:1px solid var(--line);border-left:4px solid var(--info)}' +
        '.fin-at li.fin-at--bad{border-left-color:var(--bad)}.fin-at li.fin-at--warn{border-left-color:var(--warn)}.fin-at .btn{flex:none}' +
        '.fin-tabla{overflow-x:auto}.fin-tabla td[data-l=Fecha],.fin-tabla td[data-l=Vence],.fin-tabla td[data-l="Próximo venc."]{white-space:nowrap}.fin-btns{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.fin-tachado td{opacity:.6}.fin-anul{background:var(--line);color:var(--muted)}' +
        '.fin-x{border:0;background:none;color:var(--bad);font-weight:700;cursor:pointer;padding:0 4px;min-height:0}.kpi--bad b{color:var(--bad)}' +
        '.fin-velo{position:fixed;inset:0;z-index:50;background:rgba(5,8,15,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 16px}' +
        '.fin-caja{width:min(640px,100%);background:var(--bg);border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3)}' +
        '.fin-form{padding:16px 18px;display:grid;gap:12px}.fin-ancho{grid-column:1/-1}.fin-det{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}' +
        '.fin-obls{display:grid;gap:6px}.fin-obl{display:flex;gap:10px;align-items:center;justify-content:space-between;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px}.fin-obl input{width:120px;flex:none;text-align:right}' +
        '.fin-total{margin:4px 0 0;text-align:right}.fin-conf{display:flex;gap:8px;align-items:flex-start;font-weight:600}.fin-conf input{width:18px;height:18px;min-height:0;flex:none;margin-top:2px}' +
        '@media (max-width:640px){.fin-at li{flex-direction:column;align-items:stretch}.fin-btns{justify-content:flex-start}}';
      document.head.appendChild(css);
    }
    return { vista: vista, cargar: cargar };
  };
})();
