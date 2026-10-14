/* Panel /admin de CuántoSale. Habla solo con /api/admin/* (lib/admin.js). */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var ESTADOS = { nuevo: 'Nuevo', en_gestion: 'En gestión', confirmado: 'Confirmado', completado: 'Completado', cancelado: 'Cancelado' };
  var ESTADOS_ITEM = { pendiente: 'Pendiente', consultado: 'Consultado al proveedor', confirmado: 'Confirmado', cancelado: 'Cancelado' };
  var TIPOS = { traslado: 'Traslado', tour: 'Tour / actividad', vuelo: 'Vuelo', alojamiento: 'Alojamiento', otro: 'Otro' };
  var PAGO = { sin_pago: 'Sin pago', parcial: 'Pago parcial', pagado: 'Pagado' };
  var S = { vista: 'pedidos', filtro: 'todos', provDest: 'todos', q: '', soloDeuda: false, datos: null, draft: null, dirty: false, prov: null, msg: '', cargando: false, senaMoneda: 'USD', tasas: null };

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function usd(n) { return 'US$ ' + (Number(n) || 0).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function fecha(iso) { if (!iso) return '—'; var d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return isNaN(d) ? '—' : d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }).replace('.', ''); }
  function fechaHora(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('es-UY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', ''); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function opts(map, sel) { return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join(''); }
  function digitos(t) { return String(t || '').replace(/\D/g, ''); }
  function waUrl(tel, texto) { var d = digitos(tel); return 'https://wa.me/' + d + '?text=' + encodeURIComponent(texto); }
  /* La confirmacion de reserva ya escrita, la misma que arma lib/pedidos.js para el email. Sin emojis: WhatsApp Web
     los muestra como "?" cuando llegan dentro de un enlace wa.me. */
  function mensajeConfirmacion(p) {
    var items = (p.items || []).filter(function (i) { return i.estado !== 'cancelado' && i.nombre; });
    var fechas = p.fechas_txt || (p.fecha_ida ? fecha(p.fecha_ida) + (p.fecha_vuelta ? ' al ' + fecha(p.fecha_vuelta) : '') : '');
    var personas = p.personas_txt || (p.personas ? p.personas + (p.personas == 1 ? ' persona' : ' personas') : '');
    var L = ['Hola ' + (String(p.cliente_nombre || '').trim().split(' ')[0] || '') + '! Gracias por elegir CuántoSale.', '', 'Recibimos tu solicitud de reserva:'];
    if (p.destino) L.push('*Destino:* ' + p.destino);
    if (fechas || personas) L.push('*Fechas:* ' + [fechas, personas].filter(Boolean).join(' · '));
    if (items.length) { L.push('*Servicios:*'); items.forEach(function (i) { L.push('- ' + i.nombre + (i.detalle ? ' (' + i.detalle + ')' : '')); }); }
    L.push('*Total estimado:* ' + usd(calc(p).total), '', 'Te confirmamos disponibilidad con el proveedor y ahí te pedimos una seña para reservar (50 % de los traslados y 25 % de los tours).', 'Ref: ' + (p.ref || ''));
    return L.join('\n');
  }

  function api(ruta, cuerpo) {
    var init = cuerpo === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
    return fetch('/api/admin/' + ruta, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && ruta !== 'login') { S.datos = null; S.draft = null; S.prov = null; pintar('login'); }
        if (!r.ok) { var e = new Error(j.error || 'Error ' + r.status); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function toast(t) {
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  /* ---------- cuentas (misma logica que lib/pedidos.js) ---------- */
  function calc(p) {
    var items = (p.items || []).filter(function (i) { return i.estado !== 'cancelado'; });
    var sum = function (a, fn) { return r2(a.reduce(function (x, i) { return x + (Number(fn(i)) || 0); }, 0)); };
    var total = sum(items, function (i) { return i.precio_usd; });
    var costo = sum(items, function (i) { return i.costo_usd; });
    var pagProv = sum(items, function (i) { return Math.min(i.pagado_proveedor_usd || 0, i.costo_usd || 0); });
    var cobrado = sum(p.pagos || [], function (x) { return x.monto_usd; });
    var canc = p.estado === 'cancelado';
    var pct = (S.datos && S.datos.pago && S.datos.pago.sena_pct) || { traslado: 0.5, tour: 0.25 };
    var sena = sum(items, function (i) { return (i.precio_usd || 0) * (pct[i.tipo] || 0); });
    return { sena: sena, senaPend: canc ? 0 : r2(Math.max(0, sena - cobrado)), total: total, cobrado: cobrado, saldo: canc ? 0 : r2(Math.max(0, total - cobrado)), costo: costo, aPagar: canc ? 0 : r2(Math.max(0, costo - pagProv)), margen: r2(total - costo) };
  }

  /* ---------- pantallas ---------- */
  function pintar(modo) {
    if (modo === 'login') return pintarLogin();
    var d = S.datos; if (!d) { app.innerHTML = '<p class="vacio">Cargando…</p>'; return; }
    var k = d.tablero;
    var cuenta = function (e) { return e === 'todos' ? d.pedidos.length : (k.por_estado[e] || 0); };
    var html = '<header class="top"><div class="wrap"><h1>Cuánto<i>Sale</i> · Panel</h1>' +
      '<nav class="tabs" role="tablist"><button class="tab" role="tab" data-vista="pedidos" aria-selected="' + (S.vista === 'pedidos') + '">Pedidos' + (k.nuevos ? ' (' + k.nuevos + ')' : '') + '</button>' +
      '<button class="tab" role="tab" data-vista="proveedores" aria-selected="' + (S.vista === 'proveedores') + '">Proveedores</button>' +
      '<button class="tab" role="tab" data-vista="operaciones" aria-selected="' + (S.vista === 'operaciones') + '">Operaciones</button>' +
      '<button class="tab" role="tab" data-vista="servicios" aria-selected="' + (S.vista === 'servicios') + '">Servicios</button>' +
      '<button class="tab" role="tab" data-vista="publicar" aria-selected="' + (S.vista === 'publicar') + '">Por publicar<span id="tab-pub">' + (nPend() ? ' (' + nPend() + ')' : '') + '</span></button>' +
      '<button class="tab" role="tab" data-vista="importar" aria-selected="' + (S.vista === 'importar') + '">Importar</button>' +
      '<button class="tab" role="tab" data-vista="mensajes" aria-selected="' + (S.vista === 'mensajes') + '">Mensajes<span id="tab-noleidos">' + (S.chats && S.chats.no_leidos ? ' (' + S.chats.no_leidos + ')' : '') + '</span></button>' +
      '<button class="tab" role="tab" data-vista="whatsapp" aria-selected="' + (S.vista === 'whatsapp') + '">WhatsApp</button>' +
      '<button class="tab" role="tab" data-vista="viajes" aria-selected="' + (S.vista === 'viajes') + '">Viajes guardados</button>' +
      '<button class="tab" role="tab" data-vista="uso" aria-selected="' + (S.vista === 'uso') + '">Uso</button></nav>' +
      '<button class="btn btn--sm" data-act="recargar">Actualizar</button><button class="btn btn--sm" data-act="salir">Salir</button></div></header><div class="wrap">';
    if (d.almacenamiento !== 'supabase') {
      html += '<p class="aviso">' + (d.almacenamiento === 'archivo'
        ? 'Modo local: los pedidos se guardan en un archivo de esta computadora. En producción hace falta configurar Supabase (SUPABASE_URL y SUPABASE_SERVICE_KEY).'
        : 'Falta configurar Supabase en el servidor: sin eso no se pueden guardar pedidos.') + '</p>';
    }
    html += '<section class="kpis" aria-label="Resumen">' +
      kpi('Pedidos nuevos', k.nuevos, 'de ' + k.total + ' en total', k.nuevos ? 'kpi--warn' : '') +
      kpi('Facturado', usd(k.facturado_usd), 'sin contar cancelados') +
      kpi('Cobrado', usd(k.cobrado_usd), 'de clientes', 'kpi--ok') +
      kpi('Por cobrar', usd(k.por_cobrar_usd), 'clientes que nos deben', k.por_cobrar_usd ? 'kpi--warn' : '') +
      kpi('Por pagar', usd(k.por_pagar_proveedores_usd), 'a proveedores', k.por_pagar_proveedores_usd ? 'kpi--warn' : '') +
      kpi('Margen', usd(k.margen_usd), k.sin_proveedor ? k.sin_proveedor + ' servicio(s) sin proveedor' : 'facturado − costo') + '</section>';
    /* Precarga de los precios de las guias (cron diario): cuanto ya es real y cuanto se gasto hoy en Ignav. */
    var pc = S.precarga;
    if (pc && pc.vuelos) {
      html += '<section class="kpis" aria-label="Precios de las guías">' +
        kpiPre('vuelos', 'Vuelos de las guías', pc.vuelos.conPrecio + ' / ' + pc.vuelos.rutas, 'meses con precio real · ' + (pc.vuelos.buscadas || 0) + ' de ' + (pc.vuelos.fechas || 0) + ' fechas buscadas', pc.vuelos.conPrecio < pc.vuelos.rutas ? 'kpi--warn' : 'kpi--ok') +
        kpiPre('hoteles', 'Hoteles calibrados', pc.hoteles.calibrados + ' / ' + pc.hoteles.destinos, pc.hoteles.sinDatos ? pc.hoteles.sinDatos + ' sin hoteles en Booking' : 'con Booking, se renueva cada 30 días', pc.hoteles.calibrados < pc.hoteles.destinos ? 'kpi--warn' : 'kpi--ok') +
        kpi('Ignav hoy', pc.ignav.gastoHoy + (pc.ignav.topeDiario ? ' / ' + pc.ignav.topeDiario : ''), 'búsquedas del día (tope)', pc.ignav.topeDiario && pc.ignav.gastoHoy >= pc.ignav.topeDiario ? 'kpi--warn' : '') +
        kpiBooking(pc.booking) + '</section>';
      if (S.verPre) html += detallePrecarga(pc, S.verPre);
    }
    html += S.vista === 'pedidos' ? vistaPedidos(d, cuenta) : (S.vista === 'whatsapp' ? vistaWhatsapp() : (S.vista === 'mensajes' ? vistaMensajes() : (S.vista === 'viajes' ? vistaViajes() : (S.vista === 'uso' ? vistaUso() :
      (S.vista === 'servicios' ? vistaServicios() : (S.vista === 'publicar' ? vistaPublicar() : (S.vista === 'importar' ? vistaImportar() : (S.vista === 'operaciones' ? vistaOperaciones() : vistaProveedores(d)))))))));
    html += '</div>';
    app.innerHTML = html;
    if (S.draft) abrirPanel();
    else if (S.prov) abrirProv();
    else if (S.srv) abrirSrv();
    else if (S.modal) abrirModal();
  }
  /* Cuota de Booking (RapidAPI): lo que queda del plan segun la ultima respuesta. Avisa con menos del 15 %. */
  function kpiBooking(b) {
    if (!b) return '';
    if (b.restantes == null) return kpi('Booking', '—', 'todavía sin lectura de la cuota');
    var renueva = b.resetSeg != null && b.at ? new Date(b.at + b.resetSeg * 1000) : null;
    var sub = 'consultas que quedan' + (renueva ? ' · se renueva el ' + renueva.getDate() + '/' + (renueva.getMonth() + 1) : '') + ' · leído ' + new Date(b.at).toLocaleString('es-UY', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    return kpi('Booking', b.restantes.toLocaleString('es-UY') + (b.limite ? ' / ' + b.limite.toLocaleString('es-UY') : ''), sub, b.limite && b.restantes < b.limite * 0.15 ? 'kpi--warn' : 'kpi--ok');
  }
  /* Tarjeta de la precarga que se puede tocar: abre (o cierra) el detalle debajo. */
  function kpiPre(cual, t, v, sub, cls) {
    var abierto = S.verPre === cual;
    return '<button type="button" class="kpi kpi--btn ' + (cls || '') + '" data-precarga="' + cual + '" aria-expanded="' + abierto + '"><small>' + esc(t) + '</small><b>' + esc(v) + '</b><em>' + esc(sub) + '</em><span class="kpi__ver">' + (abierto ? 'Ocultar detalle ▲' : 'Ver detalle ▼') + '</span></button>';
  }
  var MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function detallePrecarga(pc, cual) {
    if (cual === 'vuelos') {
      var fechas = [], aeros = [];
      pc.vuelos.detalle.forEach(function (r) { if (fechas.indexOf(r.dep) < 0) fechas.push(r.dep); if (aeros.indexOf(r.destination) < 0) aeros.push(r.destination); });
      var celda = function (a, f) { var r = pc.vuelos.detalle.filter(function (x) { return x.destination === a && x.dep === f; })[0]; return r && r.pp ? '<td class="ok" title="Sale el ' + esc(r.mejor || '') + ' · ' + r.buscadas + ' de ' + r.fechas + ' fechas buscadas">US$ ' + Math.round(r.pp) + '</td>' : '<td class="falta">—</td>'; };
      return '<section class="precarga"><p><b>Cómo funciona:</b> el "Desde" de cada guía busca el mes más barato para ir. Para eso, todos los días entre las 6:00 y las 10:00 (hora de Uruguay) el servidor busca en Ignav el vuelo real Montevideo → aeropuerto del destino, saliendo cada martes y miércoles de los próximos 11 meses y volviendo 7 días después; cada celda es la salida más barata del mes (pasá el mouse para ver la fecha). Son 4 corridas, de hasta ' + pc.topes.vuelosPorCorrida + ' fechas por vez, y cada precio sirve 14 días (30 si sale a más de 3 meses). Mientras un mes no tiene precio real (—), la guía usa el estimado del modelo. Los precios son ida y vuelta, por persona.</p>' +
        '<div class="precarga__tabla"><table><thead><tr><th>Aeropuerto</th>' + fechas.map(function (f) { return '<th>' + MES_CORTO[+f.slice(5, 7) - 1] + ' ' + f.slice(2, 4) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        aeros.map(function (a) { var ds = (pc.vuelos.aeropuertos || {})[a] || []; return '<tr><th title="' + esc(ds.join(', ')) + '">' + esc(a) + '<small>' + esc(ds.slice(0, 3).join(', ') + (ds.length > 3 ? '…' : '')) + '</small></th>' + fechas.map(function (f) { return celda(a, f); }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div></section>';
    }
    var fac = pc.hoteles.factores.slice().sort(function (a, b) { return (b.factor > 0) - (a.factor > 0) || a.nombre.localeCompare(b.nombre, 'es'); });
    return '<section class="precarga"><p><b>Cómo funciona:</b> el alojamiento del "Desde" sale del modelo de costos. Para que se parezca a lo que la persona ve al abrir el viaje, el servidor busca en Booking el hotel económico más barato de cada destino en 2 fechas y lo compara con lo que estimaba el modelo. La diferencia es el ajuste del destino: "+15 %" quiere decir que los hoteles reales salen 15 % más caros y el precio ya lo incluye. Calibra hasta ' + pc.topes.hotelesPorDia + ' destinos por día y cada ajuste dura 30 días. "Sin hoteles" es un destino donde Booking no devolvió nada: se vuelve a probar en 7 días.</p><ul class="precarga__hoteles">' +
      fac.map(function (x) {
        var t = x.factor > 0 ? (x.factor >= 1 ? '+' : '−') + Math.round(Math.abs(x.factor - 1) * 100) + ' %' : x.factor === null ? 'sin hoteles' : 'pendiente';
        return '<li class="' + (x.factor > 0 ? 'ok' : 'falta') + '"><span>' + esc(x.nombre) + '</span><b>' + t + '</b></li>';
      }).join('') + '</ul></section>';
  }
  function kpi(t, v, sub, cls) { return '<div class="kpi ' + (cls || '') + '"><small>' + esc(t) + '</small><b>' + esc(v) + '</b><em>' + esc(sub) + '</em></div>'; }

  function pintarLogin(err) {
    app.innerHTML = '<div class="login"><form id="login" autocomplete="on"><h1>Panel de CuántoSale</h1><p>Entrá con tu usuario y contraseña.</p>' +
      '<label class="f">Usuario<input name="user" autocomplete="username" required autofocus></label>' +
      '<label class="f">Contraseña<input name="pass" type="password" autocomplete="current-password" required></label>' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="recordar" checked style="width:auto;min-height:0"> Mantener la sesión en este dispositivo (30 días)</label>' +
      '<p class="err" id="login-err" role="alert">' + esc(err || '') + '</p><button class="btn btn--main" type="submit">Entrar</button></form></div>';
  }

  function pedidosFiltrados() {
    var q = S.q.trim().toLowerCase();
    return S.datos.pedidos.filter(function (p) {
      if (S.filtro !== 'todos' && p.estado !== S.filtro) return false;
      if (S.soloDeuda && !(p.estado !== 'cancelado' && (p.cuentas.saldo_cliente_usd > 0 || p.cuentas.a_pagar_proveedores_usd > 0))) return false;
      if (!q) return true;
      var heno = [p.ref, p.cliente_nombre, p.cliente_telefono, p.cliente_email, p.destino].concat((p.items || []).map(function (i) { return i.nombre + ' ' + i.proveedor_nombre; })).join(' ').toLowerCase();
      return heno.indexOf(q) >= 0;
    });
  }
  function vistaPedidos(d, cuenta) {
    var chips = ['todos'].concat(d.estados).map(function (e) {
      return '<button class="chip" data-filtro="' + e + '" aria-pressed="' + (S.filtro === e) + '">' + esc(e === 'todos' ? 'Todos' : ESTADOS[e]) + '<span>' + cuenta(e) + '</span></button>';
    }).join('');
    var lista = pedidosFiltrados();
    var h = '<div class="bar"><div class="chips">' + chips + '</div>' +
      '<label class="chip" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-deuda style="width:auto;min-height:0"' + (S.soloDeuda ? ' checked' : '') + '> Con saldos pendientes</label>' +
      '<input type="search" id="q" placeholder="Buscar cliente, ref, proveedor…" value="' + esc(S.q) + '" aria-label="Buscar">' +
      '<button class="btn btn--main" data-act="nuevo">+ Pedido manual</button></div>';
    if (!lista.length) return h + '<div class="card"><p class="vacio">' + (d.pedidos.length ? 'Ningún pedido coincide con el filtro.' : 'Todavía no llegó ningún pedido. Cuando alguien reserve en la web, aparece acá.') + '</p></div>';
    h += '<div class="card"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Viaje</th><th>Servicios y proveedor</th><th class="num">Total</th><th class="num">Cobrado</th><th class="num">A pagar prov.</th><th>Estado</th></tr></thead><tbody>';
    lista.forEach(function (p) {
      var c = p.cuentas, items = p.items || [];
      var servs = items.map(function (i) {
        return '<span class="sub" style="color:inherit;' + (i.estado === 'cancelado' ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(i.nombre) +
          ' <span class="sub" style="display:inline">→ ' + (i.proveedor_nombre ? esc(i.proveedor_nombre) : '<b style="color:var(--warn)">sin proveedor</b>') + '</span></span>';
      }).join('') || '<span class="sub">Sin servicios</span>';
      h += '<tr class="row" data-abrir="' + esc(p.id) + '">' +
        '<td data-l="Pedido"><b>' + esc(p.ref) + '</b><span class="sub">' + esc(fechaHora(p.created_at)) + (p.origen === 'manual' ? ' · manual' : '') + '</span></td>' +
        '<td data-l="Cliente"><b>' + esc(p.cliente_nombre || '—') + '</b><span class="sub">' + esc(p.cliente_telefono) + '</span>' +
          (p.cliente_telefono && items.length && p.estado !== 'cancelado' ? '<a class="lnk sub" target="_blank" rel="noopener" href="' + esc(waUrl(p.cliente_telefono, mensajeConfirmacion(p))) + '">Confirmar por WhatsApp</a>' : '') + '</td>' +
        '<td data-l="Viaje">' + esc(p.destino || '—') + '<span class="sub">' + fecha(p.fecha_ida) + ' → ' + fecha(p.fecha_vuelta) + ' · ' + esc(p.personas) + ' pers.</span></td>' +
        '<td data-l="Servicios" style="text-align:left">' + servs + '</td>' +
        '<td class="num" data-l="Total"><b>' + usd(c.total_usd) + '</b></td>' +
        '<td class="num" data-l="Cobrado">' + usd(c.cobrado_usd) + '<span class="sub">' + (c.saldo_cliente_usd ? '<span class="deuda">falta ' + usd(c.saldo_cliente_usd) + '</span>' : (c.total_usd ? '<span class="ok">al día</span>' : '')) + '</span></td>' +
        '<td class="num" data-l="A pagar prov.">' + (c.a_pagar_proveedores_usd ? '<span class="deuda">' + usd(c.a_pagar_proveedores_usd) + '</span>' : (c.costo_usd ? '<span class="ok">al día</span>' : '<span class="sub">sin costo</span>')) + '</td>' +
        '<td data-l="Estado"><span class="pill p-' + p.estado + '">' + esc(ESTADOS[p.estado]) + '</span><span class="sub"><span class="pill p-' + c.estado_pago + '">' + PAGO[c.estado_pago] + '</span></span></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function deudaProveedor(id) {
    var out = { pedidos: 0, aPagar: 0, servicios: 0 }, vistos = {};
    S.datos.pedidos.forEach(function (p) {
      if (p.estado === 'cancelado') return;
      (p.items || []).forEach(function (i) {
        if (i.proveedor_id !== id || i.estado === 'cancelado') return;
        out.servicios++; if (!vistos[p.id]) { vistos[p.id] = 1; out.pedidos++; }
        out.aPagar += Math.max(0, (i.costo_usd || 0) - (i.pagado_proveedor_usd || 0));
      });
    });
    out.aPagar = r2(out.aPagar); return out;
  }
  /* Los destinos viven dentro de `servicios`, despues del punto medio: "Tours y traslados · Búzios, Cabo Frio".
     Asi no hace falta otra columna en la base; el formulario los edita por separado y los vuelve a juntar. */
  function partesProv(pr) {
    var s = String(pr.servicios || ''), i = s.indexOf(' · ');
    var dest = i < 0 ? '' : s.slice(i + 3), vistos = {};
    /* Los importados vienen con "|", repetidos y cortados a 200 letras: si se corto, el ultimo queda a medias y se descarta. */
    var lista = dest.split(/[,|]/).map(function (x) { return x.trim(); });
    if (s.length >= 200) lista.pop();
    return { hace: i < 0 ? s : s.slice(0, i), destinos: lista.filter(function (x) { var k = x.toLowerCase(); if (!x || vistos[k]) return false; vistos[k] = 1; return true; }) };
  }
  function vistaProveedores(d) {
    var enPapelera = d.proveedores.filter(function (pr) { return pr.eliminado_at; }).length;
    var h = '<div class="bar"><div class="chips"><b>' + (S.provPapelera ? 'Papelera de proveedores' : 'Proveedores a los que tercerizás') + '</b></div>' +
      (enPapelera || S.provPapelera ? '<button class="btn btn--sm" data-act="ver-papelera">' + (S.provPapelera ? 'Volver a los proveedores' : 'Papelera (' + enPapelera + ')') + '</button>' : '') +
      '<button class="btn btn--main" data-act="nuevo-prov">+ Proveedor</button></div>';
    d = Object.assign({}, d, { proveedores: d.proveedores.filter(function (pr) { return S.provPapelera ? pr.eliminado_at : !pr.eliminado_at; }) });
    var enCatalogo = {}; ((S.ops && S.ops.datos && S.ops.datos.servicios) || []).forEach(function (sv) { if (sv.proveedor_id) enCatalogo[sv.proveedor_id] = (enCatalogo[sv.proveedor_id] || 0) + 1; });
    if (!d.proveedores.length && S.provPapelera) return h + '<div class="card"><p class="vacio">La papelera está vacía.</p></div>';
    if (!d.proveedores.length) return h + '<div class="card"><p class="vacio">Todavía no cargaste proveedores. Agregalos para asignarlos a cada servicio y llevar lo que les debés.</p></div>';
    var cuenta = {};
    d.proveedores.forEach(function (pr) { partesProv(pr).destinos.forEach(function (x) { cuenta[x] = (cuenta[x] || 0) + 1; }); });
    var dests = Object.keys(cuenta).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    if (S.provDest !== 'todos' && !cuenta[S.provDest]) S.provDest = 'todos';
    h += '<div class="bar"><div class="chips">' + ['todos'].concat(dests).map(function (x) {
      return '<button class="chip" data-pdest="' + esc(x) + '" aria-pressed="' + (S.provDest === x) + '">' + esc(x === 'todos' ? 'Todos' : x) + '<span>' + (x === 'todos' ? d.proveedores.length : cuenta[x]) + '</span></button>';
    }).join('') + '</div></div>';
    var lista = d.proveedores.filter(function (pr) { return S.provDest === 'todos' || partesProv(pr).destinos.indexOf(S.provDest) >= 0; });
    h += '<div class="card"><table><thead><tr><th>Proveedor</th><th>Destinos</th><th>Contacto</th><th>Hace</th><th>Datos de pago</th><th>Tarifa neta</th><th class="num">En catálogo</th><th class="num">En pedidos</th><th class="num">Le debemos</th></tr></thead><tbody>';
    lista.forEach(function (pr) {
      var dp = deudaProveedor(pr.id), pp = partesProv(pr);
      h += '<tr class="row" data-prov="' + esc(pr.id) + '"><td data-l="Proveedor"><b>' + esc(pr.nombre) + '</b>' + (pr.activo === false ? ' <span class="pill p-cancelado">inactivo</span>' : '') + '</td>' +
        '<td data-l="Destinos">' + (pp.destinos.length ? '<span class="tags">' + pp.destinos.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join('') + '</span>' : '<span class="sub">sin destino</span>') + '</td>' +
        '<td data-l="Contacto">' + esc(pr.contacto) + '<span class="sub">' + esc(pr.telefono) + (pr.email ? ' · ' + esc(pr.email) : '') + '</span></td>' +
        '<td data-l="Hace">' + esc(pp.hace) + '</td><td data-l="Datos de pago">' + esc(pr.datos_pago) + '</td>' +
        '<td data-l="Tarifa neta">' + (pr.tarifa_estado ? '<span class="pill ' + (pr.tarifa_estado === 'respondio' ? 'p-confirmado' : (pr.tarifa_estado === 'sin_respuesta' ? 'p-cancelado' : 'p-pendiente')) + '">' + esc(TARIFA_TXT[pr.tarifa_estado] || pr.tarifa_estado) + '</span><span class="sub">pedida ' + esc(fecha(pr.tarifa_pedida_at)) + '</span>' : '<span class="sub">no se pidió</span>') + '</td>' +
        '<td class="num" data-l="En catálogo">' + (enCatalogo[pr.id] ? '<a class="lnk" href="#" data-ver-srv-prov="' + esc(pr.id) + '">' + enCatalogo[pr.id] + '</a>' : '—') + '</td>' +
        '<td class="num" data-l="En pedidos">' + dp.servicios + '<span class="sub">en ' + dp.pedidos + ' pedido(s)</span></td>' +
        '<td class="num" data-l="Le debemos">' + (dp.aPagar ? '<span class="deuda">' + usd(dp.aPagar) + '</span>' : '<span class="ok">al día</span>') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ---------- Viajes guardados ----------
     Lo que la gente guardo en su cuenta (tabla trips), con su correo. "Abrir" va al link corto /viaje/<codigo>. */
  function cargarViajes() {
    S.viajes = { cargando: true }; pintar();
    api('viajes').then(function (j) { S.viajes = { lista: j.viajes || [] }; if (S.vista === 'viajes') pintar(); })
      .catch(function (e) { S.viajes = { error: e.message }; if (S.vista === 'viajes') pintar(); });
  }
  /* ---------- Uso: el contador propio (lib/uso.js, tabla uso_diario) ----------
     Cuenta a todos (no guarda nada de la persona, no depende de las cookies). Lo que mas importa: cuanta gente llega a
     Destinos y a las guias, y cuantos de ahi van a cotizar, guardan o crean una alerta. */
  function cargarUso() {
    S.uso = { cargando: true }; pintar();
    api('uso?dias=' + (S.usoDias || 30)).then(function (j) { S.uso = j; if (S.vista === 'uso') pintar(); })
      .catch(function (e) { S.uso = { error: e.message }; if (S.vista === 'uso') pintar(); });
  }
  function vistaUso() {
    var u = S.uso || {}, dias = S.usoDias || 30;
    var sel = '<div class="bar"><div class="chips">' + [7, 30, 90].map(function (n) { return '<button class="chip" data-uso-dias="' + n + '" aria-pressed="' + (n === dias) + '">' + n + ' días</button>'; }).join('') + '</div></div>';
    if (u.cargando) return sel + '<div class="card"><p class="vacio">Cargando…</p></div>';
    if (u.error) return sel + '<p class="aviso">' + esc(u.error) + '</p>';
    var filas = u.filas || [], nom = u.nombres || {};
    var suma = function (ev, det) { return filas.reduce(function (t, f) { return t + ((Array.isArray(ev) ? ev.indexOf(f.evento) >= 0 : f.evento === ev) && (det == null || f.detalle === det) ? f.n : 0); }, 0); };
    var porDetalle = function (ev) { var m = {}; filas.forEach(function (f) { if ((Array.isArray(ev) ? ev.indexOf(f.evento) >= 0 : f.evento === ev)) m[f.detalle] = (m[f.detalle] || 0) + f.n; }); return m; };
    var pct = function (a, b) { return b ? Math.round(a / b * 100) + ' %' : '—'; };
    var vDest = suma('vista_pagina', 'guias'), vGuia = suma('vista_pagina', 'guia');
    var cot = suma('guias_cotizar') + suma('guia_calcular_viaje'), fav = suma(['guias_fav_agregar', 'guia_fav_agregar']), alerta = suma(['guia_alerta_creada', 'alerta_precio_creada']);
    var h = sel + (u.almacenamiento === 'memoria' ? '<p class="aviso">Sin Supabase: se cuenta en memoria y se pierde al reiniciar. En producción hace falta correr supabase_uso.sql.</p>' : '');
    h += '<section class="kpis" aria-label="Uso">' +
      kpi('Visitas a Destinos', vDest, 'pantalla de destinos') +
      kpi('Guías abiertas', vGuia, 'páginas de guía') +
      kpi('Fueron a cotizar', cot, 'desde Destinos y las guías', 'kpi--ok') +
      kpi('Favoritos guardados', fav, 'corazones') +
      kpi('Alertas de precio', alerta, 'guía y vuelos') + '</section>';
    /* embudo de la pantalla Destinos */
    var pasos = [['Entraron a Destinos', vDest], ['Tocaron una pestaña del mes', suma('guias_ranking')], ['Abrieron una guía desde Destinos', suma('guias_abrir')], ['Fueron a cotizar desde Más baratos', suma('guias_cotizar')]];
    h += '<div class="card uso-card"><h3 class="uso-h">Destinos: de la visita a la cotización</h3><table><tbody>' + pasos.map(function (p) {
      var w = vDest ? Math.min(100, Math.round(p[1] / vDest * 100)) : 0;
      /* son toques, no personas: alguien que toca dos pestañas suma 2, por eso "por visita" y no un porcentaje */
      var x = vDest ? p[1] / vDest : 0, xt = p === pasos[0] ? '' : (vDest ? x.toLocaleString('es-UY', { maximumFractionDigits: 2 }) + ' por visita' : '—');
      return '<tr><td>' + esc(p[0]) + '</td><td class="num">' + p[1] + '</td><td class="num">' + xt + '</td><td style="width:40%"><span class="uso-barra" style="width:' + w + '%"></span></td></tr>';
    }).join('') + '</tbody></table><p class="sub">Cuenta toques, no personas: alguien que toca dos pestañas suma 2.</p></div>';
    /* pestanas de Cuando viajas */
    var rk = porDetalle('guias_ranking'), rkTot = (rk.top || 0) + (rk.clima || 0) + (rk.precio || 0);
    h += '<div class="card uso-card"><h3 class="uso-h">Pestañas de "¿Cuándo viajás?"</h3><table><tbody>' +
      [['top', 'Recomendados'], ['clima', 'Mejor clima'], ['precio', 'Más baratos']].map(function (x) { return '<tr><td>' + x[1] + '</td><td class="num">' + (rk[x[0]] || 0) + '</td><td class="num">' + pct(rk[x[0]] || 0, rkTot) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="sub">Cuenta los toques en la pestaña; Recomendados es la que se ve al entrar.</p></div>';
    /* destinos */
    var cols = { abrir: porDetalle('guias_abrir'), fav: porDetalle(['guias_fav_agregar', 'guia_fav_agregar']), cot: porDetalle(['guias_cotizar', 'guia_calcular_viaje']), pin: porDetalle('guias_mapa_pin') };
    var claves = {}; Object.keys(cols).forEach(function (c) { Object.keys(cols[c]).forEach(function (k) { if (k) claves[k] = 1; }); });
    var lista = Object.keys(claves).map(function (k) { return { k: k, a: cols.abrir[k] || 0, f: cols.fav[k] || 0, c: cols.cot[k] || 0, p: cols.pin[k] || 0 }; })
      .sort(function (a, b) { return (b.a + b.f + b.c + b.p) - (a.a + a.f + a.c + a.p); }).slice(0, 20);
    h += '<div class="card uso-card"><h3 class="uso-h">Destinos que más interesan</h3>' + (lista.length ? '<table><thead><tr><th>Destino</th><th class="num">Abrieron la guía</th><th class="num">Tocaron en el mapa</th><th class="num">Guardaron</th><th class="num">Fueron a cotizar</th></tr></thead><tbody>' +
      lista.map(function (x) { return '<tr><td data-l="Destino">' + esc(nom[x.k] || x.k) + '</td><td class="num" data-l="Abrieron la guía">' + x.a + '</td><td class="num" data-l="Tocaron en el mapa">' + x.p + '</td><td class="num" data-l="Guardaron">' + x.f + '</td><td class="num" data-l="Fueron a cotizar">' + x.c + '</td></tr>'; }).join('') +
      '</tbody></table>' : '<p class="vacio">Todavía no hay datos.</p>') + '</div>';
    /* paginas vistas */
    var pg = porDetalle('vista_pagina'), pgs = Object.keys(pg).sort(function (a, b) { return pg[b] - pg[a]; });
    h += '<div class="card uso-card"><h3 class="uso-h">Páginas vistas</h3>' + (pgs.length ? '<table><tbody>' + pgs.map(function (k) { return '<tr><td>' + esc(k || '(sin nombre)') + '</td><td class="num">' + pg[k] + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="vacio">Todavía no hay datos.</p>') + '</div>';
    return h + '<p class="sub">Del ' + esc(fecha(u.desde)) + ' al ' + esc(fecha(u.hasta)) + '. Cuenta a todos, sin cookies ni datos de la persona (lib/uso.js); Google Analytics solo ve a quien aceptó las cookies.</p>';
  }
  function vistaViajes() {
    var v = S.viajes || {};
    if (v.cargando) return '<div class="card"><p class="vacio">Cargando viajes…</p></div>';
    if (v.error) return '<p class="aviso">' + esc(v.error) + '</p>';
    var q = String(S.qViajes || '').toLowerCase().trim();
    var lista = (v.lista || []).filter(function (t) { return !q || (t.email + ' ' + t.nombre + ' ' + t.destino).toLowerCase().indexOf(q) >= 0; });
    var h = '<div class="bar"><div class="chips"><b>' + lista.length + ' viaje(s) guardado(s)</b></div><input type="search" id="q-viajes" placeholder="Buscar por correo, nombre o destino" value="' + esc(S.qViajes || '') + '"></div>';
    if (!lista.length) return h + '<div class="card"><p class="vacio">' + (q ? 'Nada coincide con la búsqueda.' : 'Todavía nadie guardó un viaje.') + '</p></div>';
    h += '<div class="card"><table><thead><tr><th>Guardado</th><th>Persona</th><th>Destino</th><th>Viaje</th><th>Qué eligió</th><th class="num">Total</th><th></th></tr></thead><tbody>';
    lista.forEach(function (t) {
      var dt = t.detalle || {}, el = [];
      if (dt.vuelo) el.push('Vuelo ' + dt.vuelo.aerolinea);
      if (dt.bus) el.push('Bus'); if (dt.auto) el.push('Auto');
      if (dt.alojamiento) el.push(dt.alojamiento.nombre);
      if (dt.transfer) el.push(dt.transfer.nombre);
      (dt.tours || []).forEach(function (x) { el.push(x.nombre); });
      h += '<tr><td data-l="Guardado">' + esc(fechaHora(t.creado)) + '</td>' +
        '<td data-l="Persona"><b>' + esc(t.nombre || '—') + '</b><span class="sub">' + (t.email ? '<a class="lnk" href="mailto:' + esc(t.email) + '">' + esc(t.email) + '</a>' : 'sin correo') + '</span></td>' +
        '<td data-l="Destino">' + esc(t.destino) + '</td>' +
        '<td data-l="Viaje">' + esc(fecha(t.ida)) + (t.vuelta ? ' → ' + esc(fecha(t.vuelta)) : '') + (t.pax ? '<span class="sub">' + esc(t.pax) + (Number(t.pax) === 1 ? ' persona' : ' personas') + '</span>' : '') + '</td>' +
        '<td data-l="Qué eligió">' + (el.length ? '<span class="tags">' + el.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join('') + '</span>' : '<span class="sub">—</span>') + '</td>' +
        '<td class="num" data-l="Total">' + usd(t.total) + '</td>' +
        '<td data-l="">' + (t.link ? '<a class="btn btn--sm" href="' + esc(t.link) + '" target="_blank" rel="noopener">Abrir</a>' : '<span class="sub">app anterior</span>') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ---------- Mensajes: la bandeja de WhatsApp ----------
     El numero vive en la API de Meta y no en un celular: lo que escriben los clientes llega solo aca. Se actualiza
     cada 15 s. Al refrescar solo se tocan la lista y los mensajes, nunca la caja de texto, para no borrar lo escrito. */
  function horaCorta(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var hora = d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
    return new Date().toDateString() === d.toDateString() ? hora : d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }).replace('.', '') + ' ' + hora;
  }
  function telLindo(t) { t = String(t || ''); return /^598\d{8}$/.test(t) ? '0' + t.slice(3, 5) + ' ' + t.slice(5, 8) + ' ' + t.slice(8) : '+' + t; }
  function chatActual() { return S.chats && S.chats.chats.filter(function (c) { return c.telefono === S.chatTel; })[0]; }
  function listaChatsHtml() {
    if (!S.chats) return '<p class="sub" style="padding:14px">Cargando…</p>';
    if (!S.chats.chats.length) return '<p class="sub" style="padding:14px">Todavía no hay mensajes. Cuando un cliente le escriba al WhatsApp de CuántoSale, aparece acá.</p>';
    return S.chats.chats.map(function (c) {
      var u = c.ultimo, prev = (u.direccion === 'out' ? 'Vos: ' : '') + u.texto;
      return '<button class="chat-it' + (c.telefono === S.chatTel ? ' is-on' : '') + '" data-chat="' + esc(c.telefono) + '">' +
        '<span class="chat-it__top"><b>' + esc(c.nombre || (c.pedidos[0] && c.pedidos[0].nombre) || telLindo(c.telefono)) + '</b><small>' + esc(horaCorta(u.created_at)) + '</small></span>' +
        '<span class="chat-it__prev">' + esc(prev.slice(0, 80)) + (c.no_leidos ? '<i class="chat-badge">' + c.no_leidos + '</i>' : '') + '</span></button>';
    }).join('');
  }
  var TILDE = { sent: '✓', delivered: '✓✓', read: '✓✓', failed: '⚠', enviando: '…' };
  function mensajesHtml() {
    if (!S.chatTel) return '<p class="sub" style="margin:auto">Elegí un chat.</p>';
    if (!S.conv) return '<p class="sub" style="margin:auto">Cargando…</p>';
    return S.conv.map(function (m) {
      var out = m.direccion === 'out';
      return '<div class="msg ' + (out ? 'msg--out' : 'msg--in') + (m.tipo === 'template' ? ' msg--auto' : '') + '">' + esc(m.texto).replace(/\n/g, '<br>') +
        '<span class="msg__h">' + esc(horaCorta(m.created_at)) + (out ? ' <span class="tilde' + (m.estado === 'read' ? ' is-leido' : '') + (m.estado === 'failed' ? ' is-mal' : '') + '" title="' + esc(m.estado + (m.error ? ': ' + m.error : '')) + '">' + (TILDE[m.estado] || '') + '</span>' : '') + '</span>' +
        (m.estado === 'failed' && m.error ? '<span class="msg__err">No se entregó: ' + esc(m.error) + '</span>' : '') + '</div>';
    }).join('');
  }
  function cabeceraChatHtml() {
    var c = chatActual(); if (!c) return '';
    return '<div class="chat-cab"><button class="btn btn--sm chat-volver" data-chat="" aria-label="Volver a los chats">←</button><div><b>' + esc(c.nombre || telLindo(c.telefono)) + '</b><small>' + esc(telLindo(c.telefono)) + '</small></div>' +
      c.pedidos.map(function (p) { return '<button class="btn btn--sm" data-ir-pedido="' + esc(p.id) + '">Pedido ' + esc(p.ref) + '</button>'; }).join('') + '</div>';
  }
  function cajaHtml() {
    var c = chatActual(); if (!c) return '';
    if (!c.ventana_abierta) return '<p class="chat-aviso">Pasaron más de 24 h desde el último mensaje de este cliente. WhatsApp solo deja escribirle de nuevo con una plantilla aprobada, o cuando él te vuelva a escribir.</p>';
    return '<form id="chat-form" class="chat-caja"><textarea id="chat-txt" rows="2" placeholder="Escribí tu respuesta… (Enter envía, Shift+Enter baja de línea)" aria-label="Respuesta">' + esc(S.borrador || '') + '</textarea><button class="btn btn--main" type="submit">Enviar</button></form><p id="chat-err" class="err" role="alert"></p>';
  }
  function vistaMensajes() {
    if (!S.chats) cargarChats();
    return avisosHtml() + '<div class="chat' + (S.chatTel ? ' con-chat' : '') + '"><div class="chat-lista" id="chat-lista">' + listaChatsHtml() + '</div>' +
      '<div class="chat-conv">' + (S.chatTel ? '<div id="chat-cab">' + cabeceraChatHtml() + '</div>' : '') + '<div class="chat-msgs" id="chat-msgs">' + mensajesHtml() + '</div>' +
      (S.chatTel ? '<div id="chat-caja">' + cajaHtml() + '</div>' : '') + '</div></div>';
  }
  function abajo() { var m = document.getElementById('chat-msgs'); if (m) m.scrollTop = m.scrollHeight; }
  function refrescarMensajes(irAbajo) {
    var n = S.chats && S.chats.no_leidos ? S.chats.no_leidos : 0;
    var tab = document.getElementById('tab-noleidos'); if (tab) tab.textContent = n ? ' (' + n + ')' : '';
    /* El titulo (pestaña y app instalada) muestra los no leidos, y el icono de la app instalada lleva el numero
       donde el sistema lo permite (Android/Chrome y PC). */
    document.title = (n ? '(' + n + ') ' : '') + 'Panel · CuántoSale';
    try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (er) { /* sin soporte */ }
    if (S.vista !== 'mensajes') return;
    var l = document.getElementById('chat-lista'); if (l) l.innerHTML = listaChatsHtml();
    var m = document.getElementById('chat-msgs');
    if (m) { var alFinal = m.scrollHeight - m.scrollTop - m.clientHeight < 40; m.innerHTML = mensajesHtml(); if (irAbajo || alFinal) abajo(); }
    var cab = document.getElementById('chat-cab'); if (cab) cab.innerHTML = cabeceraChatHtml();
    var caja = document.getElementById('chat-caja'), c = chatActual();
    if (caja && !!document.getElementById('chat-txt') !== !!(c && c.ventana_abierta)) caja.innerHTML = cajaHtml();
  }
  function cargarChats() {
    if (S.cargandoChats) return; S.cargandoChats = true;
    return api('mensajes/chats').then(function (j) { S.chats = j; S.cargandoChats = false; refrescarMensajes(false); })
      .catch(function () { S.cargandoChats = false; });
  }
  function cargarConv(irAbajo) {
    var tel = S.chatTel; if (!tel) return;
    return api('mensajes/chat?tel=' + encodeURIComponent(tel)).then(function (j) {
      if (S.chatTel !== tel) return;
      S.conv = j.mensajes;
      var c = chatActual(); if (c && c.no_leidos) { S.chats.no_leidos -= c.no_leidos; c.no_leidos = 0; }
      refrescarMensajes(irAbajo);
    }).catch(function () {});
  }
  function abrirChat(tel) {
    S.chatTel = tel || null; S.conv = null; S.borrador = '';
    pintar(); if (tel) cargarConv(true);
  }
  setInterval(function () {
    if (!S.datos || document.hidden) return;
    cargarChats(); if (S.vista === 'mensajes' && S.chatTel) cargarConv(false);
  }, 15000);

  /* ---------- Notificaciones en este dispositivo (lib/push.js + /admin/sw.js) ----------
     En iPhone solo funcionan con el panel agregado a la pantalla de inicio (iOS 16.4 o mas nuevo). */
  var AV = { estado: 'cargando' };
  function soportaAvisos() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function b64aBytes(b64) { var s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)); var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function registroSW() { return navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }); }
  function revisarAvisos() {
    if (!soportaAvisos()) { AV = { estado: 'sin-soporte' }; return pintarAvisos(); }
    if (Notification.permission === 'denied') { AV = { estado: 'bloqueado' }; return pintarAvisos(); }
    registroSW().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      AV = { estado: sub && Notification.permission === 'granted' ? 'activo' : 'apagado' };
      // Se vuelve a mandar en cada carga: si la base se reinicio o la suscripcion cambio, queda al dia.
      if (sub && AV.estado === 'activo') api('push/suscribir', { suscripcion: sub.toJSON() }).catch(function () {});
      pintarAvisos();
    }).catch(function () { AV = { estado: 'apagado' }; pintarAvisos(); });
  }
  function activarAvisos() {
    AV = { estado: 'activando' }; pintarAvisos();
    var clave;
    api('push/clave').then(function (j) {
      if (!j.configurado) throw new Error('Las notificaciones todavía no están configuradas en el servidor.');
      clave = j.clave;
      return Notification.requestPermission();
    }).then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'Bloqueaste las notificaciones. Activalas desde los ajustes del navegador para este sitio.' : 'No diste el permiso.');
      return registroSW();
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(clave) }); });
    }).then(function (sub) { return api('push/suscribir', { suscripcion: sub.toJSON() }); })
      .then(function () { AV = { estado: 'activo' }; pintarAvisos(); toast('Listo: te avisamos en este dispositivo'); })
      .catch(function (e) { AV = { estado: 'error', error: e.message }; pintarAvisos(); });
  }
  function desactivarAvisos() {
    registroSW().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return;
      return api('push/baja', { endpoint: sub.endpoint }).catch(function () {}).then(function () { return sub.unsubscribe(); });
    }).then(function () { AV = { estado: 'apagado' }; pintarAvisos(); });
  }
  function avisosHtml() {
    var e = AV.estado, h = '<div class="avisos" id="avisos">';
    if (e === 'activo') h += '<span>🔔 Avisos activados en este dispositivo.</span><button class="btn btn--sm" data-act="avisos-off">Desactivar</button>';
    else if (e === 'sin-soporte') h += '<span>Este navegador no permite notificaciones.' + (/iPhone|iPad/.test(navigator.userAgent) ? ' En iPhone, agregá el panel a la pantalla de inicio (Compartir → Agregar a inicio) y abrilo desde ahí.' : '') + '</span>';
    else if (e === 'bloqueado') h += '<span>Las notificaciones están bloqueadas para este sitio. Activalas desde los ajustes del navegador.</span>';
    else if (e === 'activando') h += '<span>Activando…</span>';
    else if (e === 'cargando') h += '<span class="sub">Revisando avisos…</span>';
    else h += '<span>Recibí una notificación cuando un cliente te escriba o llegue un pedido.' + (AV.error ? ' <b class="deuda">' + esc(AV.error) + '</b>' : '') + '</span><button class="btn btn--sm btn--main" data-act="avisos-on">Activar avisos</button>';
    return h + '</div>';
  }
  function pintarAvisos() { var el = document.getElementById('avisos'); if (el) el.outerHTML = avisosHtml(); }
  /* Al tocar una notificacion: /admin/?chat=<tel> abre ese chat y /admin/?pedido=<id> abre el pedido. */
  function irA(url) {
    var u; try { u = new URL(url, location.origin); } catch (e) { return; }
    var tel = u.searchParams.get('chat'), ped = u.searchParams.get('pedido');
    if (tel) { S.vista = 'mensajes'; S.chatTel = tel; S.conv = null; pintar(); cargarConv(true); }
    else if (ped && S.datos) { S.vista = 'pedidos'; pintar(); abrir(ped); }
    else { S.vista = 'mensajes'; pintar(); }
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.tipo === 'abrir') { cargar(); irA(e.data.url); } });

  /* ---------- WhatsApp: estado del numero, registro y prueba ---------- */
  var WA_ESTADOS = { CONNECTED: 'Conectado', PENDING: 'Pendiente', NOT_VERIFIED: 'Sin verificar', VERIFIED: 'Verificado', APPROVED: 'Aprobado', PENDING_REVIEW: 'En revisión', DECLINED: 'Rechazado', FLAGGED: 'Marcado', RESTRICTED: 'Restringido', DISCONNECTED: 'Desconectado', CLOUD_API: 'API en la nube', NOT_APPLICABLE: 'Sin registrar', AVAILABLE_WITHOUT_REVIEW: 'Aprobado', NONE: 'Sin revisar', EXPIRED: 'Vencido' };
  function waTxt(v) { return v ? (WA_ESTADOS[v] || v) : '—'; }
  function cargarWa() {
    S.wa = { cargando: true };
    api('whatsapp/estado').then(function (j) { S.wa = { datos: j }; if (S.vista === 'whatsapp') pintar(); })
      .catch(function (e) { S.wa = { error: e.message }; if (S.vista === 'whatsapp') pintar(); });
  }
  function vistaWhatsapp() {
    var w = S.wa;
    if (!w) { cargarWa(); w = S.wa; }
    var h = '<div class="sec" style="max-width:640px">';
    if (w.cargando) return h + '<p class="sub">Consultando a Meta…</p></div>';
    if (w.error) h += '<p class="err">' + esc(w.error) + '</p>';
    var d = w.datos;
    if (d && !d.configurado) return h + '<h3>Falta configurar</h3><p>Cargá en Vercel: <b>' + esc(d.falta.join(' y ')) + '</b>, y hacé Redeploy.</p></div>';
    if (d && d.numero) {
      var n = d.numero, ok = n.status === 'CONNECTED' && n.platform_type === 'CLOUD_API';
      h += '<h3>Número</h3><p style="margin:0 0 8px;font-size:18px"><b>' + esc(n.display_phone_number || '') + '</b> · ' + esc(n.verified_name || '') + '</p>' +
        '<div class="cuentas"><div><small>Estado</small><b class="' + (ok ? 'ok' : 'deuda') + '">' + esc(waTxt(n.status)) + '</b></div>' +
        '<div><small>Registro</small><b>' + esc(waTxt(n.platform_type)) + '</b></div>' +
        '<div><small>Código SMS</small><b>' + esc(waTxt(n.code_verification_status)) + '</b></div>' +
        '<div><small>Nombre visible</small><b>' + esc(waTxt(n.name_status)) + '</b></div></div>';
      h += ok ? '<p class="ok" style="margin:12px 0 0">Listo: los WhatsApp automáticos salen desde este número.</p>'
        : '<p class="sub" style="margin:12px 0 0">Si el registro no dice "API en la nube", registralo abajo.</p>';
    }
    h += '<h3 style="margin-top:20px">Registrar el número</h3><p class="sub" style="margin:0 0 8px">Inventá un PIN de 6 números y anotalo: es la verificación en dos pasos del número.</p>' +
      '<form id="wa-reg" style="display:flex;gap:8px;flex-wrap:wrap"><input name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="PIN de 6 números" style="max-width:200px" required><button class="btn btn--main" type="submit">Registrar</button></form>' +
      '<h3 style="margin-top:20px">Mandar una prueba</h3><p class="sub" style="margin:0 0 8px">Manda la plantilla "' + esc((d && d.plantilla) || 'reserva_recibida') + '" con datos de ejemplo. La plantilla tiene que estar aprobada.</p>' +
      '<form id="wa-prueba" style="display:flex;gap:8px;flex-wrap:wrap"><input name="tel" inputmode="tel" placeholder="Tu celular, ej. 099123456" style="max-width:240px" required><button class="btn" type="submit">Enviar prueba</button></form>' +
      '<p id="wa-msg" role="status" style="margin:12px 0 0;font-weight:600">' + esc(w.msg || '') + '</p>' +
      '<p style="margin:14px 0 0"><button class="btn btn--sm" data-act="wa-recargar">Actualizar estado</button></p></div>';
    return h;
  }

  /* ---------- detalle de un pedido ---------- */
  function nuevoDraft() { return { id: null, ref: 'Pedido manual', estado: 'nuevo', cliente_nombre: '', cliente_telefono: '', cliente_email: '', destino: '', fecha_ida: '', fecha_vuelta: '', personas: 2, medio_pago: '', notas: '', items: [], pagos: [], origen: 'manual' }; }
  function itemVacio() { return { id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), tipo: 'tour', nombre: '', detalle: '', precio_usd: 0, proveedor_id: '', proveedor_nombre: '', costo_usd: 0, pagado_proveedor_usd: 0, estado: 'pendiente', ref_proveedor: '', notas: '' }; }
  /* Los proveedores que nombran el destino del pedido en "Qué servicios hace" van primero. */
  function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function provOpts(sel) {
    var lugar = sinTildes(String(S.draft.destino || '').split(',')[0]).trim();
    var op = function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; };
    var lista = S.datos.proveedores.filter(function (p) { return p.activo !== false || p.id === sel; });
    var aca = lugar.length > 2 ? lista.filter(function (p) { return sinTildes(p.servicios).indexOf(lugar) >= 0; }) : [];
    var resto = lista.filter(function (p) { return aca.indexOf(p) < 0; });
    if (!aca.length) return '<option value="">— Sin asignar —</option>' + resto.map(op).join('');
    return '<option value="">— Sin asignar —</option><optgroup label="Trabajan en ' + esc(String(S.draft.destino).split(',')[0]) + '">' + aca.map(op).join('') + '</optgroup>' +
      (resto.length ? '<optgroup label="Otros">' + resto.map(op).join('') + '</optgroup>' : '');
  }
  function cuentasHtml(p) {
    var c = calc(p);
    return [['Total del cliente', c.total], ['Cobrado', c.cobrado], ['Saldo del cliente', c.saldo], ['Costo proveedores', c.costo], ['A pagar a proveedores', c.aPagar], ['Margen', c.margen]]
      .map(function (x) { return '<div><small>' + x[0] + '</small><b' + ((x[0] === 'Saldo del cliente' || x[0] === 'A pagar a proveedores') && x[1] ? ' class="deuda"' : '') + '>' + usd(x[1]) + '</b></div>'; }).join('');
  }
  /* ---------- sena (misma regla que lib/pedidos.js) ----------
     Se pide cuando el proveedor ya confirmo. El monto sale en USD (la moneda del modelo) y se puede mandar en la
     moneda que prefiera el cliente con la cotizacion del dia de /api/tasas. La tarjeta va por un link de Mercado
     Pago que se arma a mano, con 5 % de recargo. */
  var MONEDA_SENA = { USD: 'Dólares (US$)', UYU: 'Pesos uruguayos ($)', BRL: 'Reales (R$)' };
  function cargarTasas() {
    if (S.tasas) return;
    S.tasas = { cargando: true };
    fetch('/api/tasas', { credentials: 'same-origin' }).then(function (r) { return r.json(); })
      .then(function (j) { S.tasas = j && j.rates ? { rates: j.rates } : { error: true }; if (S.draft) refrescarPanel(); })
      .catch(function () { S.tasas = { error: true }; if (S.draft) refrescarPanel(); });
  }
  /* Monto en la moneda elegida, o null si todavia no hay cotizacion para convertir. */
  function enMoneda(montoUsd, moneda) {
    if (moneda === 'USD') return montoUsd;
    var rate = S.tasas && S.tasas.rates && Number(S.tasas.rates[moneda]);
    return rate > 0 ? montoUsd * rate : null;
  }
  function plata(montoUsd, moneda) {
    var v = enMoneda(montoUsd, moneda);
    if (v === null) return usd(montoUsd);
    var sim = { USD: 'US$ ', UYU: '$ ', BRL: 'R$ ' }[moneda];
    var dec = moneda === 'UYU' ? 0 : 2;
    return sim + (moneda === 'UYU' ? Math.ceil(v) : Math.ceil(v * 100) / 100).toLocaleString('es-UY', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function recargoTarjeta() { var r = S.datos && S.datos.pago && Number(S.datos.pago.recargo_tarjeta); return r >= 0 ? r : 0.05; }
  function mensajeSena(p) {
    var c = calc(p), m = S.senaMoneda, dp = (S.datos && S.datos.pago && S.datos.pago.datos) || {};
    var monto = c.senaPend, conTarjeta = r2(monto * (1 + recargoTarjeta()));
    var L = ['Hola ' + (String(p.cliente_nombre || '').trim().split(' ')[0] || '') + '! Buenas noticias: el proveedor confirmó tu reserva' + (p.destino ? ' en ' + p.destino : '') + '.', '',
      'Para dejarla reservada te pedimos una seña de *' + plata(monto, m) + '* (50 % de los traslados y 25 % de los tours).', '', '*Cómo pagar la seña:*'];
    if (dp.transferencia) L.push('- Transferencia bancaria: ' + dp.transferencia);
    if (dp.prex) L.push('- Prex: ' + dp.prex);
    if (dp.pix) L.push('- Pix: ' + dp.pix);
    if (dp.abitab_redpagos) L.push('- Abitab / Redpagos: ' + dp.abitab_redpagos);
    L.push('- Tarjeta de crédito: te mandamos un link de Mercado Pago por ' + plata(conTarjeta, m) + ' (incluye ' + Math.round(recargoTarjeta() * 100) + ' % de recargo).');
    L.push('', 'Cuando pagues, mandanos el comprobante por acá. El resto se abona antes del viaje.', 'Ref: ' + (p.ref || ''));
    return L.join('\n');
  }
  function senaHtml(p) {
    var c = calc(p);
    if (!c.sena) return '<p class="sub">Este pedido no lleva seña: solo los traslados (50 %) y los tours (25 %) se señan.</p>';
    var m = S.senaMoneda, dp = (S.datos && S.datos.pago && S.datos.pago.datos) || {};
    var faltan = !dp.transferencia && !dp.prex && !dp.pix && !dp.abitab_redpagos;
    var sinTasa = m !== 'USD' && enMoneda(1, m) === null;
    var wa = p.cliente_telefono && c.senaPend > 0 ? waUrl(p.cliente_telefono, mensajeSena(p)) : '';
    return '<div class="cuentas"><div><small>Seña del pedido</small><b>' + usd(c.sena) + '</b></div>' +
      '<div><small>Seña pendiente</small><b' + (c.senaPend ? ' class="deuda"' : ' class="ok"') + '>' + (c.senaPend ? plata(c.senaPend, m) : 'Cobrada') + '</b></div>' +
      (c.senaPend ? '<div><small>Con tarjeta (+' + Math.round(recargoTarjeta() * 100) + ' %)</small><b>' + plata(r2(c.senaPend * (1 + recargoTarjeta())), m) + '</b></div>' : '') + '</div>' +
      (c.senaPend ? '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin-top:10px">' +
        '<label class="f" style="min-width:200px">Moneda para el cliente<select data-sena-moneda>' + opts(MONEDA_SENA, m) + '</select></label>' +
        (wa ? '<a class="btn btn--wa" target="_blank" rel="noopener" href="' + esc(wa) + '">Pedir seña por WhatsApp</a>' : '<span class="sub">Cargá el teléfono del cliente para mandarle la seña.</span>') +
        '<button type="button" class="btn btn--sm" data-act="registrar-sena">Registrar seña cobrada</button></div>' : '') +
      (c.senaPend && p.estado !== 'confirmado' ? '<p class="sub" style="margin-top:8px">Pedila cuando el proveedor confirme (estado "Confirmado").</p>' : '') +
      (sinTasa ? '<p class="sub">' + (S.tasas && S.tasas.error ? 'No se pudo traer la cotización: el monto queda en dólares.' : 'Cargando cotización…') + '</p>' : '') +
      (faltan && c.senaPend ? '<p class="aviso">Faltan tus datos para cobrar: cargá PAGO_TRANSFERENCIA, PAGO_PREX, PAGO_PIX y PAGO_ABITAB_REDPAGOS en las variables de Vercel. Mientras tanto el mensaje solo ofrece tarjeta.</p>' : '');
  }
  function itemHtml(it, i) {
    var pr = S.datos.proveedores.filter(function (x) { return x.id === it.proveedor_id; })[0];
    var msgProv = 'Hola' + (pr && pr.contacto ? ' ' + pr.contacto : '') + '! Te consulto disponibilidad para: ' + it.nombre + (it.detalle ? ' (' + it.detalle + ')' : '') +
      '. Fecha: ' + fecha(S.draft.fecha_ida) + (S.draft.fecha_vuelta ? ' al ' + fecha(S.draft.fecha_vuelta) : '') + '. Pasajeros: ' + S.draft.personas + '. A nombre de ' + S.draft.cliente_nombre + '. Ref ' + S.draft.ref + '. ¡Gracias!';
    var f = function (campo, tipo, extra) { return 'data-i="' + i + '" data-f="' + campo + '"' + (tipo ? ' type="' + tipo + '"' : '') + (extra || ''); };
    return '<div class="item"><div class="item__top"><input ' + f('nombre') + ' value="' + esc(it.nombre) + '" placeholder="Servicio (ej. Traslado aeropuerto – hotel)" aria-label="Servicio">' +
      '<button type="button" class="btn btn--sm btn--danger btn--x" data-quitar-item="' + i + '" aria-label="Quitar servicio">✕</button></div>' +
      '<div class="grid"><label class="f">Tipo<select ' + f('tipo') + '>' + opts(TIPOS, it.tipo) + '</select></label>' +
      '<label class="f">Detalle<input ' + f('detalle') + ' value="' + esc(it.detalle) + '"></label>' +
      '<label class="f">Estado del servicio<select ' + f('estado') + '>' + opts(ESTADOS_ITEM, it.estado) + '</select></label></div>' +
      '<div class="grid"><label class="f">Precio al cliente (US$)<input ' + f('precio_usd', 'number', ' min="0" step="0.01" inputmode="decimal"') + ' value="' + (it.precio_usd || '') + '"></label>' +
      '<label class="f">Proveedor<select ' + f('proveedor_id') + '>' + provOpts(it.proveedor_id) + '</select></label>' +
      '<label class="f">Costo proveedor (US$)<input ' + f('costo_usd', 'number', ' min="0" step="0.01" inputmode="decimal"') + ' value="' + (it.costo_usd || '') + '"></label>' +
      '<label class="f">Ya pagado al proveedor (US$)<input ' + f('pagado_proveedor_usd', 'number', ' min="0" step="0.01" inputmode="decimal"') + ' value="' + (it.pagado_proveedor_usd || '') + '"></label>' +
      '<label class="f">Código de reserva del proveedor<input ' + f('ref_proveedor') + ' value="' + esc(it.ref_proveedor) + '"></label></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button type="button" class="btn btn--sm" data-pagado-total="' + i + '">Marcar pagado al proveedor</button>' +
      (pr && pr.telefono ? '<a class="lnk" target="_blank" rel="noopener" href="' + esc(waUrl(pr.telefono, msgProv)) + '">WhatsApp a ' + esc(pr.nombre) + '</a>' : '') +
      (pr && pr.email ? '<a class="lnk" href="mailto:' + esc(pr.email) + '?subject=' + encodeURIComponent('Reserva ' + S.draft.ref) + '&body=' + encodeURIComponent(msgProv) + '">Email</a>' : '') +
      (pr && pr.datos_pago ? '<span class="sub">Pagar a: ' + esc(pr.datos_pago) + '</span>' : '') + '</div></div>';
  }
  function pagoHtml(pg, i) {
    var f = function (campo, tipo, extra) { return 'data-p="' + i + '" data-f="' + campo + '"' + (tipo ? ' type="' + tipo + '"' : '') + (extra || ''); };
    return '<div class="pagoRow"><input ' + f('fecha', 'date') + ' value="' + esc(pg.fecha) + '" aria-label="Fecha">' +
      '<input ' + f('monto_usd', 'number', ' min="0" step="0.01" inputmode="decimal"') + ' value="' + (pg.monto_usd || '') + '" placeholder="US$" aria-label="Monto en US$">' +
      '<input ' + f('medio') + ' value="' + esc(pg.medio) + '" placeholder="Medio (transferencia, Pix…)" aria-label="Medio">' +
      '<input ' + f('nota') + ' value="' + esc(pg.nota) + '" placeholder="Nota" aria-label="Nota">' +
      '<button type="button" class="btn btn--sm btn--danger btn--x" data-quitar-pago="' + i + '" aria-label="Quitar cobro">✕</button></div>';
  }
  function abrirPanel() {
    var p = S.draft, esNuevo = !p.id;
    var wa = p.cliente_telefono ? waUrl(p.cliente_telefono, 'Hola ' + (p.cliente_nombre || '').split(' ')[0] + '! Te escribimos de CuántoSale por tu pedido ' + p.ref + '.') : '';
    var waConf = p.cliente_telefono && p.items.length ? waUrl(p.cliente_telefono, mensajeConfirmacion(p)) : '';
    var el = document.getElementById('drawer');
    if (!el) { el = document.createElement('div'); el.id = 'drawer'; el.className = 'drawer'; document.body.appendChild(el); }
    var f = function (campo) { return 'data-f="' + campo + '"'; };
    el.innerHTML = '<div class="panel" role="dialog" aria-modal="true" aria-label="Detalle del pedido">' +
      '<div class="panel__head"><h2>' + esc(esNuevo ? 'Nuevo pedido manual' : p.ref) + (esNuevo ? '' : ' <span class="pill p-' + p.estado + '" id="pill-estado">' + esc(ESTADOS[p.estado]) + '</span>') + '</h2>' +
      '<button class="btn btn--sm" data-act="cerrar">Cerrar</button></div><div class="panel__body">' +
      '<section class="sec"><h3>Cuentas</h3><div class="cuentas" id="cuentas-box">' + cuentasHtml(p) + '</div></section>' +
      (esNuevo || !p.items.length ? '' : '<section class="sec"><h3>Seña</h3><div id="sena-box">' + senaHtml(p) + '</div></section>') +
      '<section class="sec"><h3>Cliente y viaje</h3><div class="grid">' +
      '<label class="f">Estado del pedido<select ' + f('estado') + '>' + opts(ESTADOS, p.estado) + '</select></label>' +
      '<label class="f">Nombre<input ' + f('cliente_nombre') + ' value="' + esc(p.cliente_nombre) + '"></label>' +
      '<label class="f">Teléfono / WhatsApp<input ' + f('cliente_telefono') + ' value="' + esc(p.cliente_telefono) + '" inputmode="tel"></label>' +
      '<label class="f">Email<input ' + f('cliente_email') + ' value="' + esc(p.cliente_email) + '" inputmode="email"></label>' +
      '<label class="f">Destino<input ' + f('destino') + ' value="' + esc(p.destino) + '"></label>' +
      '<label class="f">Ida<input ' + f('fecha_ida') + ' type="date" value="' + esc(p.fecha_ida || '') + '"></label>' +
      '<label class="f">Vuelta<input ' + f('fecha_vuelta') + ' type="date" value="' + esc(p.fecha_vuelta || '') + '"></label>' +
      '<label class="f">Personas<input ' + f('personas') + ' type="number" min="1" max="60" value="' + esc(p.personas) + '"></label>' +
      '<label class="f">Medio de pago preferido<input ' + f('medio_pago') + ' value="' + esc(p.medio_pago) + '"></label></div>' +
      (waConf ? '<p style="margin:12px 0 0"><a class="btn btn--wa" target="_blank" rel="noopener" href="' + esc(waConf) + '">Enviar confirmación por WhatsApp</a></p>' : '') +
      (wa ? '<p style="margin:10px 0 0"><a class="lnk" target="_blank" rel="noopener" href="' + esc(wa) + '">Escribirle al cliente por WhatsApp</a></p>' : '') +
      (p.created_at ? '<p class="sub" style="margin-top:8px">Recibido ' + esc(fechaHora(p.created_at)) + ' · origen: ' + esc(p.origen || 'web') + '</p>' : '') + '</section>' +
      '<section class="sec"><h3>Servicios y proveedores</h3><div id="items-box">' + (p.items.length ? p.items.map(itemHtml).join('') : '<p class="sub">Sin servicios todavía.</p>') + '</div>' +
      '<button type="button" class="btn btn--sm" data-act="add-item">+ Agregar servicio</button></section>' +
      (esNuevo ? '' : '<section class="sec"><h3>Cobros del cliente</h3><div id="pagos-box">' + (p.pagos.length ? p.pagos.map(pagoHtml).join('') : '<p class="sub">Todavía no registraste cobros.</p>') + '</div>' +
        '<button type="button" class="btn btn--sm" data-act="add-pago">+ Registrar cobro</button> <button type="button" class="btn btn--sm" data-act="cobrar-saldo">Cobrar el saldo completo</button></section>') +
      '<section class="sec"><h3>Notas internas</h3><textarea ' + f('notas') + '>' + esc(p.notas) + '</textarea></section></div>' +
      '<div class="foot">' + (esNuevo ? '' : '<button class="btn btn--danger" data-act="borrar-pedido" style="margin-right:auto">Borrar pedido</button>') + '<span class="msg" id="foot-msg" role="status"></span><button class="btn" data-act="cerrar">Cancelar</button><button class="btn btn--main" data-act="guardar">' + (esNuevo ? 'Crear pedido' : 'Guardar cambios') + '</button></div></div>';
  }
  function refrescarPanel() {
    var y = (document.querySelector('#drawer .panel') || {}).scrollTop || 0;
    abrirPanel();
    var pn = document.querySelector('#drawer .panel'); if (pn) pn.scrollTop = y;
  }
  function cerrarPanel(forzar) {
    if (!forzar && S.dirty && !confirm('Tenés cambios sin guardar. ¿Cerrar igual?')) return;
    S.draft = null; S.prov = null; S.srv = null; S.modal = null; S.dirty = false;
    var el = document.getElementById('drawer'); if (el) el.remove();
  }

  /* ---------- proveedor ---------- */
  function abrirProv() {
    var p = S.prov, el = document.getElementById('drawer');
    if (p._hace === undefined) { var pp = partesProv(p); p._hace = pp.hace; p._destinos = pp.destinos.join(', '); }
    if (!el) { el = document.createElement('div'); el.id = 'drawer'; el.className = 'drawer'; document.body.appendChild(el); }
    var dp = p.id ? deudaProveedor(p.id) : null;
    var f = function (campo) { return 'data-pf="' + campo + '"'; };
    el.innerHTML = '<div class="panel" role="dialog" aria-modal="true" style="width:min(560px,100%)"><div class="panel__head"><h2>' + esc(p.id ? p.nombre : 'Nuevo proveedor') + '</h2><button class="btn btn--sm" data-act="cerrar">Cerrar</button></div>' +
      '<div class="panel__body"><section class="sec"><div class="grid" style="grid-template-columns:1fr">' +
      '<label class="f">Nombre / empresa<input ' + f('nombre') + ' value="' + esc(p.nombre) + '"></label>' +
      '<label class="f">Persona de contacto<input ' + f('contacto') + ' value="' + esc(p.contacto) + '"></label>' +
      '<label class="f">Teléfono / WhatsApp (con código de país)<input ' + f('telefono') + ' value="' + esc(p.telefono) + '" inputmode="tel" placeholder="5989XXXXXXX"></label>' +
      '<label class="f">Email<input ' + f('email') + ' value="' + esc(p.email) + '"></label>' +
      '<label class="f">WhatsApp (si es otro que el teléfono)<input ' + f('whatsapp') + ' value="' + esc(p.whatsapp || '') + '" inputmode="tel"></label>' +
      '<label class="f">Sitio web<input ' + f('web') + ' value="' + esc(p.web || '') + '" inputmode="url"></label>' +
      '<label class="f">Instagram<input ' + f('instagram') + ' value="' + esc(p.instagram || '') + '" placeholder="@usuario"></label>' +
      '<label class="f">Región<input ' + f('region') + ' value="' + esc(p.region || '') + '" placeholder="Noreste, Sudeste…"></label>' +
      '<label class="f">Cadastur<input ' + f('cadastur') + ' value="' + esc(p.cadastur || '') + '"></label>' +
      '<label class="f">Moneda en que cobra<select ' + f('moneda') + '><option value="BRL"' + (p.moneda !== 'USD' ? ' selected' : '') + '>Reales (R$)</option><option value="USD"' + (p.moneda === 'USD' ? ' selected' : '') + '>Dólares (US$)</option></select></label>' +
      '<label class="f">Atiende en español<input ' + f('espanol') + ' value="' + esc(p.espanol || '') + '" placeholder="sí, web en español, solo portugués…"></label>' +
      '<label class="f">Qué servicios hace<input ' + f('_hace') + ' value="' + esc(p._hace) + '" placeholder="Tours y traslados"></label>' +
      '<label class="f">Destinos (separados por coma)<input ' + f('_destinos') + ' value="' + esc(p._destinos) + '" placeholder="Búzios, Cabo Frio, Arraial do Cabo"></label>' +
      '<label class="f">Datos para pagarle (cuenta, alias, Pix)<textarea ' + f('datos_pago') + '>' + esc(p.datos_pago) + '</textarea></label>' +
      '<label class="f">Condiciones (cancelación, seña, forma de pago)<textarea ' + f('condiciones') + '>' + esc(p.condiciones || '') + '</textarea></label>' +
      '<label class="f">Avisos antes de cotizarle<textarea ' + f('avisos') + '>' + esc(p.avisos || '') + '</textarea></label>' +
      '<label class="f">Notas<textarea ' + f('notas') + '>' + esc(p.notas) + '</textarea></label>' +
      '<label class="f">Margen para sus servicios<select ' + f('margen_tipo') + '><option value="">El general</option><option value="usd"' + (p.margen_tipo === 'usd' ? ' selected' : '') + '>Propio en US$ por persona</option><option value="pct"' + (p.margen_tipo === 'pct' ? ' selected' : '') + '>Propio en %</option></select></label>' +
      '<label class="f">Valor del margen propio<input ' + f('margen_valor') + ' type="number" step="0.01" value="' + esc(p.margen_valor == null ? '' : p.margen_valor) + '" placeholder="solo si no usa el general"></label>' +
      '<p class="sub" style="margin:0">Si cambiás el margen, los precios de sus servicios en la web quedan como cambios para revisar en "Por publicar".</p>' +
      '<label class="f" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-pf="activo" style="width:auto;min-height:0"' + (p.activo === false ? '' : ' checked') + '> Activo (aparece al asignar servicios)</label></div>' +
      (dp ? '<p class="sub" style="margin-top:10px">' + dp.servicios + ' servicio(s) en ' + dp.pedidos + ' pedido(s). Le debemos: <b class="' + (dp.aPagar ? 'deuda' : 'ok') + '">' + usd(dp.aPagar) + '</b></p>' : '') +
      (p.id ? (function () {
        var suyos = ((S.ops && S.ops.datos && S.ops.datos.servicios) || []).filter(function (x) { return x.proveedor_id === p.id && !x.eliminado_at; })
          .sort(function (a, b) { return (b.publicado_at ? 1 : 0) - (a.publicado_at ? 1 : 0); });
        var l = tarifaHtml(p, suyos, 'Pedir tarifas netas', true);
        return l ? '<p style="margin:10px 0 0">' + l + '</p><p class="sub" style="margin:4px 0 0">Mensaje en portugués que presenta CuántoSale y pide tarifas para agencia' + (suyos.length ? ', con ' + Math.min(suyos.length, 8) + ' de sus paseos' : '') + '.</p>' : '';
      })() : '') + '</section></div>' +
      '<div class="foot"><span class="msg" id="foot-msg" role="status"></span>' + (p.id ? '<button class="btn btn--danger" data-act="papelera-prov">' + (p.eliminado_at ? 'Sacar de la papelera' : 'Mandar a la papelera') + '</button>' : '') + '<button class="btn" data-act="cerrar">Cancelar</button><button class="btn btn--main" data-act="guardar-prov">Guardar proveedor</button></div></div>';
  }

  /* ---------- Operaciones: servicios, precios y cola de cambios (lib/operaciones.js) ----------
     La fila de cada servicio es lo publicado; lo que se edita aca se guarda como cambio pendiente y recien llega a la
     web al publicarlo. La cuenta del precio esta repetida de lib/operaciones.js (calcular) solo para la vista previa:
     el numero que vale es el que calcula el server al publicar. */
  var UNIDADES = { persona: 'por persona', vehiculo: 'por vehículo', grupo: 'por grupo', embarcacion: 'por embarcación', tramo: 'por tramo' };
  var TIPOS_SRV = { tour: 'Tour', actividad: 'Actividad', traslado: 'Traslado', barco: 'Paseo en barco', otro: 'Otro' };
  var ORIGENES = { manual: 'Edición', importacion: 'Importación', ajuste: 'Ajuste masivo', cotizacion: 'Cotización', reversion: 'Vuelta atrás', inicial: 'Precio inicial' };
  var ESTADOS_CAMBIO = { pendiente: 'Pendiente', publicado: 'Publicado', descartado: 'Descartado', reemplazado: 'Reemplazado' };
  var CAMPO_NOMBRE = { precio_brl: 'Precio R$', precio: 'Precio US$', unidad: 'Unidad', capacidad: 'Capacidad', margen_tipo: 'Tipo de margen', margen_valor: 'Margen',
    activo: 'Activo', fuente: 'Fuente', verificado: 'Verificado', destino: 'Destino', titulo: 'Título', descripcion: 'Descripción', detalle: 'Detalle', orden: 'Orden',
    proveedor_id: 'Proveedor', tipo: 'Tipo', duracion: 'Duración', grupo: 'Grupo', punto_salida: 'Punto de salida', edad_minima: 'Edad mínima', incluye: 'Incluye',
    no_incluye: 'No incluye', politica_cancelacion: 'Cancelación', que_llevar: 'Qué llevar', link_web: 'Link', url_imagen: 'Foto', galeria: 'Fotos' };
  var CAMPOS_SRV = ['url_imagen', 'galeria', 'destino', 'titulo', 'descripcion', 'detalle', 'precio', 'precio_brl', 'unidad', 'capacidad', 'margen_tipo', 'margen_valor', 'activo', 'fuente', 'verificado',
    'orden', 'proveedor_id', 'tipo', 'duracion', 'grupo', 'punto_salida', 'edad_minima', 'incluye', 'no_incluye', 'politica_cancelacion', 'que_llevar', 'link_web'];

  function brl(n) { return 'R$ ' + (Number(n) || 0).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  /* El precio publicado se guarda en US$ por persona, que es lo que usa la web (y cada visitante lo ve en su moneda).
     En el panel se muestra en reales, con la misma cotizacion de operaciones, para compararlo de un vistazo con lo que
     cobra el proveedor. Sin cotizacion cargada se muestra en dolares. */
  function pub(n) {
    var cot = S.ops && S.ops.datos && Number(S.ops.datos.config.cotizacion);
    return cot > 0 ? brl(r2(Number(n) * cot)) : usd(n);
  }
  function hoyISO() { return new Date().toISOString().slice(0, 10); }
  function provDe(id) { return id && S.datos ? S.datos.proveedores.filter(function (p) { return p.id === id; })[0] : null; }
  function destNombre(k) { var o = S.ops && S.ops.datos; var d = o ? o.destinos.filter(function (x) { return x.key === k; })[0] : null; return d ? d.nombre : k; }
  function pendPorTour() { var m = {}; ((S.ops && S.ops.datos && S.ops.datos.pendientes) || []).forEach(function (c) { if (c.tour_id) m[c.tour_id] = c; }); return m; }
  function pctTxt(a, b) {
    if (a == null || b == null || !Number(a)) return '';
    var p = Math.round((b - a) / a * 1000) / 10;
    return p === 0 ? '=' : (p > 0 ? '+' : '') + p.toLocaleString('es-UY') + ' %';
  }
  function origenTxt(s) {
    var m = s.precio_brl != null ? brl(s.precio_brl) : (s.precio != null ? usd(s.precio) : '—');
    return m + ' <span class="sub">' + esc(UNIDADES[s.unidad] || 'por persona') + (s.unidad && s.unidad !== 'persona' && s.capacidad ? ' · hasta ' + s.capacidad : '') + '</span>';
  }
  /* Lo que le falta para verse como los tours ya publicados: foto, descripcion, detalle, duracion y que incluye.
     Se mira con el cambio sin publicar encima, que es lo que quedaria en la web al publicarlo. */
  function conPendiente(s) { var p = pendPorTour()[s.id]; return p ? Object.assign({}, s, p.despues) : s; }
  function faltantes(s) {
    var x = conPendiente(s), f = [];
    if (!x.foto_wiki && !x.url_imagen && !(x.galeria || []).length) f.push('foto');
    if (!String(x.descripcion || '').trim()) f.push('descripción');
    if (!String(x.detalle || '').trim()) f.push('detalle');
    if (!String(x.duracion || '').trim()) f.push('duración');
    if (!String(x.incluye || '').trim()) f.push('qué incluye');
    return f;
  }
  function faltaHtml(s) {
    if (s.eliminado_at || s.tipo === 'traslado') return '';
    var f = faltantes(s), sinFoto = f.indexOf('foto') >= 0, resto = f.filter(function (x) { return x !== 'foto'; });
    return (sinFoto ? ' <span class="pill p-cancelado">sin foto</span>' : '') +
      (resto.length ? ' <span class="pill p-pendiente" title="Le falta: ' + esc(resto.join(', ')) + '">ficha: faltan ' + resto.length + '</span>' : '');
  }
  function viejo(s, dias) { if (!s.verificado) return true; return (Date.now() - new Date(s.verificado + 'T12:00:00').getTime()) / 864e5 > dias; }
  function calcPub(f, prov, cfg) {
    var cot = Number(cfg.cotizacion) || 0, enReales = f.precio_brl != null && f.precio_brl !== '', base, pasos = [];
    if (enReales) { if (!(cot > 0)) return { error: 'Falta la cotización del real.' }; base = Number(f.precio_brl) / cot; pasos.push(brl(f.precio_brl) + ' ÷ ' + cot.toLocaleString('es-UY', { maximumFractionDigits: 4 }) + ' = ' + usd(r2(base))); }
    else if (f.precio != null && f.precio !== '') { base = Number(f.precio); pasos.push(usd(base)); }
    else return { error: 'No tiene precio.' };
    if (f.unidad && f.unidad !== 'persona') {
      var cap = Number(f.capacidad);
      if (!(cap > 0)) return { error: 'El precio es ' + UNIDADES[f.unidad] + ': poné la capacidad para pasarlo a precio por persona.' };
      base = base / cap; pasos.push('÷ ' + cap + ' personas = ' + usd(r2(base)));
    }
    var m = null;
    if (f.margen_tipo && f.margen_valor !== '' && f.margen_valor != null) m = { tipo: f.margen_tipo, valor: Number(f.margen_valor), de: 'propio' };
    else if (prov && prov.margen_tipo && prov.margen_valor != null) m = { tipo: prov.margen_tipo, valor: Number(prov.margen_valor), de: 'del proveedor' };
    else if (enReales && cfg.margen) m = { tipo: cfg.margen.tipo, valor: cfg.margen.valor, de: 'general' };
    var v = m ? (m.tipo === 'pct' ? base * (1 + m.valor / 100) : base + m.valor) : base;
    if (m) pasos.push((m.tipo === 'pct' ? '+ ' + m.valor + ' %' : '+ ' + usd(m.valor)) + ' de margen ' + m.de);
    return { valor: Number(v.toFixed(2)), pasos: pasos };
  }

  function cargarOps() {
    if (!S.ops || S.ops.error) S.ops = { cargando: true };
    return api('ops/datos').then(function (d) {
      S.ops = { datos: d };
      if (S.vista === 'servicios' || S.vista === 'publicar' || S.vista === 'importar' || S.vista === 'operaciones') pintarFondo(); else actualizarBadgePub();
      if (S.srv) refrescarSrv();
    }).catch(function (e) { S.ops = { error: e.message }; if (S.vista === 'servicios' || S.vista === 'publicar') pintarFondo(); });
  }
  function actualizarBadgePub() { var b = document.getElementById('tab-pub'); if (b) b.textContent = nPend() ? ' (' + nPend() + ')' : ''; }
  function nPend() { return S.ops && S.ops.datos ? S.ops.datos.pendientes.length : 0; }

  function vistaServicios() {
    var o = S.ops;
    if (!o || o.cargando) return '<p class="vacio">Cargando servicios…</p>';
    if (o.error) return '<div class="card"><p class="vacio">No se pudieron cargar los servicios: ' + esc(o.error) + ' <button class="btn" data-act="ops-recargar">Reintentar</button></p></div>';
    var d = o.datos, pend = pendPorTour(), dias = d.config.dias_desactualizado;
    var clase = function (s) {
      if (s.eliminado_at) return { papelera: true };
      if (s.alternativa_de) return { comparar: true };
      return { todos: true, sinfoto: s.tipo !== 'traslado' && faltantes(s).indexOf('foto') >= 0, publicados: s.activo && s.revision === 'ok', nuevos: !s.publicado_at, pendientes: !!pend[s.id], revision: s.revision === 'pendiente', inactivos: !s.activo && !!s.publicado_at, viejos: s.activo && viejo(s, dias) };
    };
    var nombres = { todos: 'Todos', publicados: 'Activos', nuevos: 'Nuevos', comparar: 'Para comparar', sinfoto: 'Sin foto', pendientes: 'Con cambios sin publicar', revision: 'Para revisar', viejos: 'Precio viejo (+' + dias + ' días)', inactivos: 'Apagados', papelera: 'Papelera' };
    var cuenta = {}; Object.keys(nombres).forEach(function (k) { cuenta[k] = 0; });
    d.servicios.forEach(function (s) { var c = clase(s); Object.keys(c).forEach(function (k) { if (c[k]) cuenta[k]++; }); });
    var f = S.srvFiltro || 'todos', q = sinTildes(S.qSrv || '');
    var lista = d.servicios.filter(function (s) {
      if (!clase(s)[f]) return false;
      if (S.srvDest && s.destino !== S.srvDest) return false;
      if (S.srvProv && (S.srvProv === '-' ? s.proveedor_id : s.proveedor_id !== S.srvProv)) return false;
      if (q) { var pr = provDe(s.proveedor_id); if (sinTildes(s.titulo + ' ' + destNombre(s.destino) + ' ' + (pr ? pr.nombre : '')).indexOf(q) < 0) return false; }
      return true;
    });
    /* Ultimo cambio: lo mas nuevo entre la ultima vez que se toco la fila y su cambio sin publicar. */
    var ultimo = function (s) { var p = pend[s.id], a = s.updated_at || ''; return p && p.creado_at > a ? p.creado_at : a; };
    if (S.srvOrden === 'reciente') lista.sort(function (a, b) { return ultimo(b).localeCompare(ultimo(a)); });
    else if (S.srvOrden === 'precio') lista.sort(function (a, b) { return (Number(conPendiente(a).precio_brl) || 0) - (Number(conPendiente(b).precio_brl) || 0); });
    var destUsados = {}, provUsados = {};
    d.servicios.forEach(function (s) { destUsados[s.destino] = 1; if (s.proveedor_id) provUsados[s.proveedor_id] = 1; });
    var h = '<div class="bar"><div class="chips"><b>Servicios: tours, actividades y traslados</b></div><button class="btn" data-act="cfg-abrir">Cotización y margen</button><button class="btn btn--main" data-act="nuevo-srv">+ Servicio</button></div>' +
      '<p class="sub" style="margin:-4px 0 12px">Cotización ' + esc(String(d.config.cotizacion).replace('.', ',')) + (d.config.cotizacion_fuente ? ' (' + esc(d.config.cotizacion_fuente) + ')' : '') +
      ' · margen general ' + (d.config.margen ? (d.config.margen.tipo === 'pct' ? d.config.margen.valor + ' %' : usd(d.config.margen.valor) + ' (' + pub(d.config.margen.valor) + ')') + ' por persona sobre precios en reales' : 'sin margen') +
      ' · los precios publicados se muestran en reales; la web los guarda en dólares</p>' +
      '<div class="bar"><div class="chips">' + Object.keys(nombres).map(function (k) {
        return '<button class="chip" data-sfiltro="' + k + '" aria-pressed="' + (f === k) + '">' + esc(nombres[k]) + '<span>' + cuenta[k] + '</span></button>';
      }).join('') + '</div></div>' +
      '<div class="bar"><select data-sdest style="max-width:220px"><option value="">Todos los destinos</option>' + Object.keys(destUsados).map(function (k) { return { k: k, n: destNombre(k) }; })
        .sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); }).map(function (x) { return '<option value="' + esc(x.k) + '"' + (S.srvDest === x.k ? ' selected' : '') + '>' + esc(x.n) + '</option>'; }).join('') + '</select>' +
      '<select data-sprov style="max-width:240px"><option value="">Todos los proveedores</option><option value="-"' + (S.srvProv === '-' ? ' selected' : '') + '>Sin proveedor</option>' +
        S.datos.proveedores.filter(function (p) { return provUsados[p.id]; }).map(function (p) { return '<option value="' + esc(p.id) + '"' + (S.srvProv === p.id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') + '</select>' +
      '<input type="search" id="q-srv" placeholder="Buscar servicio, destino o proveedor" value="' + esc(S.qSrv || '') + '">' +
      '<select data-sorden style="max-width:210px"><option value="">Ordenar por destino</option><option value="reciente"' + (S.srvOrden === 'reciente' ? ' selected' : '') + '>Último cambio primero</option><option value="precio"' + (S.srvOrden === 'precio' ? ' selected' : '') + '>Precio del proveedor</option></select></div>';
    if (f === 'comparar') return h + vistaComparar(lista);
    if (!lista.length) return h + '<div class="card"><p class="vacio">' + (f === 'papelera' ? 'La papelera está vacía.' : 'No hay servicios con ese filtro.') + '</p></div>';
    if (f === 'papelera') h += '<p class="sub" style="margin:-4px 0 12px">Lo que está en la papelera no se ve en la web. "Recuperar" lo deja como estaba; "Borrar" lo elimina para siempre (su historial de precios queda).</p>';
    S.srvSel = S.srvSel || {};
    S.srvVisibles = lista.map(function (s) { return s.id; });
    var nSel = Object.keys(S.srvSel).length;
    if (f !== 'papelera') {
      h += '<div class="bar"><span class="sub" style="flex:1">' + (nSel ? '<b>' + nSel + ' elegido(s)</b>' : 'Elegí servicios con la casilla para ajustarles el precio todos juntos.') + '</span>' +
        '<button class="btn btn--sm" data-act="sel-filtro">Elegir los ' + lista.length + ' de este filtro</button>' +
        (nSel ? '<button class="btn btn--sm" data-act="sel-limpiar">Quitar selección</button><button class="btn btn--sm" data-act="fotos-auto">Traer fotos del proveedor</button><button class="btn btn--main btn--sm" data-act="aj-abrir">Ajustar precio %</button>' : '') + '</div>';
    }
    h += '<div class="card"><table><thead><tr>' + (f !== 'papelera' ? '<th></th>' : '') + '<th>Servicio</th><th>Precio del proveedor</th><th class="num">Publicado</th><th class="num">Sin publicar</th><th>Estado</th><th>Verificado</th><th>Último cambio</th><th></th></tr></thead><tbody>';
    lista.forEach(function (s) {
      var pr = provDe(s.proveedor_id), p = pend[s.id], c = clase(s);
      var estado = s.eliminado_at ? '<span class="pill p-cancelado">en la papelera</span>' : (!s.publicado_at ? '<span class="pill p-nuevo">Nuevo</span>' : (s.activo ? '<span class="pill p-confirmado">Activo</span>' : '<span class="pill p-cancelado">Apagado</span>'));
      estado += faltaHtml(s);
      if (s.tipo === 'traslado' && !s.eliminado_at) estado += ' <span class="pill p-consultado" title="La web calcula los traslados aparte">no va a la web</span>';
      if (s.revision === 'pendiente') estado += ' <span class="pill p-pendiente" title="' + esc(s.revision_motivo) + '">revisar</span>';
      h += '<tr class="row" data-srv="' + esc(s.id) + '">' + (s.eliminado_at ? '' : '<td data-l="Elegir"><input type="checkbox" data-ssel="' + esc(s.id) + '" style="width:auto;min-height:0"' + (S.srvSel[s.id] ? ' checked' : '') + '></td>') + '<td data-l="Servicio"><b>' + esc(s.titulo) + '</b><span class="sub">' + esc(destNombre(s.destino)) + ' · ' + esc(TIPOS_SRV[s.tipo] || s.tipo) + ' · ' + (pr ? esc(pr.nombre) : '<i>sin proveedor</i>') + '</span></td>' +
        // Un nuevo tiene su precio en el cambio sin publicar: se muestra ese.
        '<td data-l="Proveedor cobra">' + origenTxt(conPendiente(s)) + (verProv(p && p.despues.link_web || s.link_web) ? '<span class="sub">' + verProv(p && p.despues.link_web || s.link_web) + '</span>' : '') +
          (pr && !s.eliminado_at && tarifaHtml(pr, [s]) ? '<span class="sub">' + tarifaHtml(pr, [s]) + '</span>' : '') + '</td>' +
        '<td class="num" data-l="Publicado">' + (s.precio_publicado != null ? '<b>' + pub(s.precio_publicado) + '</b><span class="sub">' + usd(s.precio_publicado) + ' por persona</span>' : '—') + '</td>' +
        '<td class="num" data-l="Sin publicar">' + (p ? (p.publicado_despues != null ? pub(p.publicado_despues) : 'cambio') + '<span class="sub">' + esc(pctTxt(s.precio_publicado, p.publicado_despues)) + '</span>' : '') + '</td>' +
        '<td data-l="Estado">' + estado + '</td>' +
        '<td data-l="Verificado"' + (c.viejos ? ' class="deuda"' : '') + '>' + (conPendiente(s).verificado ? esc(fecha(conPendiente(s).verificado)) + ' ' + esc(conPendiente(s).verificado.slice(0, 4)) : 'nunca') + '</td>' +
        '<td data-l="Último cambio">' + (ultimo(s) ? esc(fechaHora(ultimo(s))) + (p ? '<span class="sub">sin publicar</span>' : '') : '—') + '</td>' +
        '<td data-l="" style="white-space:nowrap">' + (s.eliminado_at
          ? '<button class="btn btn--sm" data-recuperar="' + esc(s.id) + '">Recuperar</button> <button class="btn btn--sm btn--danger" data-borrar="' + esc(s.id) + '">Borrar</button>'
          : '<button class="btn btn--sm btn--x" data-papelera="' + esc(s.id) + '" title="Mandar a la papelera" aria-label="Mandar a la papelera">🗑</button>') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function valorCampo(k, v) {
    if (v === null || v === undefined || v === '') return '—';
    if (k === 'precio_brl') return brl(v);
    if (k === 'precio' || (k === 'margen_valor')) return String(v);
    if (k === 'activo') return v ? 'sí' : 'no';
    if (k === 'unidad') return UNIDADES[v] || v;
    if (k === 'tipo') return TIPOS_SRV[v] || v;
    if (k === 'destino') return destNombre(v);
    if (k === 'proveedor_id') { var p = provDe(v); return p ? p.nombre : '(otro)'; }
    var s = String(v); return s.length > 70 ? s.slice(0, 67) + '…' : s;
  }
  /* El link del operador se muestra como enlace ("Ver en el proveedor") y no como la direccion, que es larga y
     quedaba cortada. Solo http(s): un link cargado desde un archivo no puede ser javascript: ni nada raro. */
  function urlSegura(u) { u = String(u || '').trim(); return /^https?:\/\/[^\s"<>]+$/i.test(u) ? u : ''; }
  function verProv(u, texto) {
    var x = urlSegura(u);
    return x ? '<a class="lnk" target="_blank" rel="noopener noreferrer" href="' + esc(x) + '">' + esc(texto || 'Ver en el proveedor') + ' ↗</a>' : '';
  }
  /* "Importado de x.csv · https://..." -> el texto y, aparte, el enlace. */
  function fuenteHtml(f) {
    var m = /(https?:\/\/\S+)/.exec(String(f || ''));
    if (!m) return esc(f);
    var resto = String(f).replace(m[1], '').replace(/\s*·\s*$/, '').trim();
    return esc(resto) + (resto ? ' · ' : '') + verProv(m[1]);
  }
  function difsHtml(c) {
    return Object.keys(c.despues || {}).map(function (k) {
      if (k === 'galeria') {
        var gl = (c.despues[k] || []).map(urlSegura).filter(Boolean);
        return '<span class="sub"><b>Fotos:</b> ' + (gl.length ? gl.map(function (u) { return '<a target="_blank" rel="noopener noreferrer" href="' + esc(u) + '"><img src="' + esc(u) + '" alt="" style="height:40px;border-radius:6px;vertical-align:middle;margin-right:3px"></a>'; }).join('') : 'sin fotos') + '</span>';
      }
      if (k === 'url_imagen' && 'galeria' in (c.despues || {})) return '';
      if (k === 'url_imagen') {
        var fd = urlSegura(c.despues[k]);
        return '<span class="sub"><b>Foto:</b> ' + (fd ? '<a target="_blank" rel="noopener noreferrer" href="' + esc(fd) + '"><img src="' + esc(fd) + '" alt="" style="height:40px;border-radius:6px;vertical-align:middle"></a>' : 'sin foto') + '</span>';
      }
      if (k === 'link_web') {
        var a = (c.antes || {})[k], d = c.despues[k];
        return '<span class="sub"><b>' + esc(CAMPO_NOMBRE[k]) + ':</b> ' + (a ? verProv(a, 'el de antes') : '—') + ' → ' + (d ? verProv(d) : '—') + '</span>';
      }
      return '<span class="sub"><b>' + esc(CAMPO_NOMBRE[k] || k) + ':</b> ' + esc(valorCampo(k, (c.antes || {})[k])) + ' → ' + esc(valorCampo(k, c.despues[k])) + '</span>';
    }).join('');
  }

  function vistaPublicar() {
    var o = S.ops;
    if (!o || o.cargando) return '<p class="vacio">Cargando…</p>';
    if (o.error) return '<div class="card"><p class="vacio">No se pudo cargar: ' + esc(o.error) + ' <button class="btn" data-act="ops-recargar">Reintentar</button></p></div>';
    var d0 = o.datos, porId = {}; d0.servicios.forEach(function (s) { porId[s.id] = s; });
    /* Filtro por destino: para revisar los nuevos de un lugar y decidir cuales publicar. Seleccionar todos, publicar y
       descartar se aplican solo a lo que se ve. */
    var destPend = {}; d0.pendientes.forEach(function (c) { var s = porId[c.tour_id]; var k = s ? s.destino : String(c.tour_clave).split('#')[0]; destPend[k] = (destPend[k] || 0) + 1; });
    if (S.pubDest && !destPend[S.pubDest]) S.pubDest = '';
    var d = Object.assign({}, d0, { pendientes: d0.pendientes.filter(function (c) { if (!S.pubDest) return true; var s = porId[c.tour_id]; return (s ? s.destino : String(c.tour_clave).split('#')[0]) === S.pubDest; }) });
    S.pubVisibles = d.pendientes.map(function (c) { return c.id; });
    S.sel = S.sel || {};
    Object.keys(S.sel).forEach(function (k) { if (!d.pendientes.some(function (c) { return c.id === k; })) delete S.sel[k]; });
    var nSel = Object.keys(S.sel).length;
    var h = '<div class="bar"><div class="chips"><b>' + (d.pendientes.length ? d.pendientes.length + ' cambio(s) esperando tu revisión' : 'Nada para publicar') + '</b></div>' +
      (d.pendientes.length ? '<button class="btn btn--sm" data-act="sel-todos">' + (nSel === d.pendientes.length ? 'Ninguno' : 'Seleccionar todos') + '</button>' +
        '<button class="btn btn--sm btn--danger" data-act="desc-sel"' + (nSel ? '' : ' disabled') + '>Descartar (' + nSel + ')</button>' +
        '<button class="btn btn--main" data-act="pub-sel"' + (nSel ? '' : ' disabled') + '>Publicar (' + nSel + ')</button>' : '') + '</div>' +
      '<p class="sub" style="margin:-4px 0 12px">Nada de esto se ve en la web hasta que lo publicás. Los cambios de más de 20 % aparecen en rojo.</p>' +
      (Object.keys(destPend).length > 1 ? '<div class="bar"><select data-pdes style="max-width:280px"><option value="">Todos los destinos (' + d0.pendientes.length + ')</option>' +
        Object.keys(destPend).sort(function (a, b) { return destNombre(a).localeCompare(destNombre(b), 'es'); }).map(function (k) { return '<option value="' + esc(k) + '"' + (S.pubDest === k ? ' selected' : '') + '>' + esc(destNombre(k)) + ' (' + destPend[k] + ')</option>'; }).join('') + '</select></div>' : '');
    if (!d.pendientes.length) return h + '<div class="card"><p class="vacio">Cuando edites un precio o importes un archivo, los cambios quedan acá para que los revises antes de publicarlos.</p></div>';
    h += '<div class="card"><table><thead><tr><th></th><th>Servicio</th><th>Qué cambia</th><th class="num">Publicado hoy</th><th class="num">Quedaría</th><th>Origen</th><th></th></tr></thead><tbody>';
    d.pendientes.forEach(function (c) {
      var s = porId[c.tour_id] || {}, p = pctTxt(c.publicado_antes, c.publicado_despues);
      var fuerte = c.publicado_antes && c.publicado_despues != null && Math.abs((c.publicado_despues - c.publicado_antes) / c.publicado_antes) >= 0.2;
      var noSe = c.publicado_despues == null && (c.despues.activo === true || (c.despues.activo === undefined && s.activo));
      /* Igual que en lib/operaciones.js publicar(): importado sin unidad, hay que confirmarla en el editor. */
      var sinUnidad = c.origen === 'importacion' && s.revision === 'pendiente' && /unidad|persona o por/.test(s.revision_motivo || '') && c.despues.activo === true;
      h += '<tr><td data-l="Elegir"><input type="checkbox" data-sel="' + esc(c.id) + '" style="width:auto;min-height:0"' + (S.sel[c.id] ? ' checked' : '') + '></td>' +
        '<td data-l="Servicio"><a class="lnk" href="#" data-srv="' + esc(c.tour_id || '') + '">' + esc(s.titulo || String(c.tour_clave).split('#')[1] || '?') + '</a><span class="sub">' + esc(destNombre(s.destino || String(c.tour_clave).split('#')[0])) + (s.precio_publicado == null && !s.activo ? ' · nuevo' : '') + '</span>' + (s.id ? faltaHtml(s) : '') + '</td>' +
        '<td data-l="Qué cambia">' + difsHtml(c) + (c.nota ? '<span class="sub"><i>' + esc(c.nota) + '</i></span>' : '') +
          (!('link_web' in c.despues) && verProv(s.link_web) ? '<span class="sub">' + verProv(s.link_web) + '</span>' : '') + '</td>' +
        '<td class="num" data-l="Publicado hoy">' + (c.publicado_antes != null ? pub(c.publicado_antes) + '<span class="sub">' + usd(c.publicado_antes) + '</span>' : '—') + '</td>' +
        '<td class="num" data-l="Quedaría">' + (noSe ? '<span class="deuda">no se puede calcular</span>' : (c.publicado_despues != null ? '<b' + (fuerte ? ' class="deuda"' : '') + '>' + pub(c.publicado_despues) + '</b><span class="sub">' + usd(c.publicado_despues) + ' · ' + esc(p) + '</span>' : '—')) +
          (sinUnidad ? '<span class="sub deuda">Falta confirmar si es por persona o por vehículo: abrilo y publicalo desde ahí</span>' : '') + '</td>' +
        '<td data-l="Origen">' + esc(ORIGENES[c.origen] || c.origen) + '<span class="sub">' + esc(fechaHora(c.creado_at)) + (c.creado_por ? ' · ' + esc(c.creado_por) : '') + '</span></td>' +
        '<td data-l=""><button class="btn btn--sm" data-pub-uno="' + esc(c.id) + '">Publicar</button></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* El editor arranca desde lo publicado mas el cambio pendiente, si hay: se sigue editando ese mismo cambio. */
  function abrirServicio(id) {
    var d = S.ops && S.ops.datos; if (!d) return;
    var s = id ? d.servicios.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !s) return toast('Ese servicio ya no existe');
    var p = s ? pendPorTour()[s.id] : null, f = {};
    CAMPOS_SRV.forEach(function (k) { f[k] = s ? s[k] : null; });
    if (!s) { f.activo = true; f.unidad = 'persona'; f.tipo = 'tour'; f.orden = 100; f.verificado = hoyISO(); }
    f.galeria = Array.isArray(f.galeria) ? f.galeria.slice(0, 3) : [];
    if (p) Object.keys(p.despues).forEach(function (k) { f[k] = p.despues[k]; });
    if (!Array.isArray(f.galeria)) f.galeria = [];
    if (!f.galeria.length && f.url_imagen) f.galeria = [f.url_imagen];
    f._moneda = f.precio_brl != null ? 'BRL' : (f.precio != null ? 'USD' : 'BRL');
    f._monto = f.precio_brl != null ? f.precio_brl : (f.precio != null ? f.precio : '');
    S.srv = { id: s ? s.id : null, orig: s, pend: p, f: f, hist: null };
    S.dirty = false;
    abrirSrv();
    if (s) api('ops/historial?id=' + encodeURIComponent(s.id)).then(function (j) { if (S.srv && S.srv.id === s.id) { S.srv.hist = j.cambios; pintarHist(); } }).catch(function () {});
  }
  function refrescarSrv() {
    if (!S.srv || !S.srv.id) return;
    var y = (document.querySelector('#drawer .panel') || {}).scrollTop || 0;
    abrirServicio(S.srv.id);
    var pn = document.querySelector('#drawer .panel'); if (pn) pn.scrollTop = y;
  }
  function srvParaCalc() {
    var f = S.srv.f, x = Object.assign({}, f);
    if (f._moneda === 'BRL') { x.precio_brl = f._monto === '' ? null : Number(f._monto); } else { x.precio_brl = null; x.precio = f._monto === '' ? null : Number(f._monto); }
    return x;
  }
  function prevHtml() {
    var cfg = S.ops.datos.config, x = srvParaCalc(), c = calcPub(x, provDe(x.proveedor_id), cfg), o = S.srv.orig;
    var hoy = o && o.precio_publicado != null ? pub(o.precio_publicado) : 'nada (no está en la web)';
    if (c.error) return '<div><small>Publicado hoy</small><b>' + esc(hoy) + '</b></div><div style="grid-column:span 2"><small>Quedaría</small><b class="deuda" style="font-size:14px">' + esc(c.error) + '</b></div>';
    return '<div><small>Publicado hoy</small><b>' + esc(hoy) + '</b></div><div><small>Quedaría (por persona)</small><b>' + pub(c.valor) + '</b> <span class="sub">' + esc(pctTxt(o && o.precio_publicado, c.valor)) + '</span></div>' +
      '<div style="grid-column:1/-1"><small>Cuenta</small><span class="sub">' + esc(c.pasos.join(' ') + ' = ' + usd(c.valor) + ' en la web (' + pub(c.valor) + ')') + '</span></div>';
  }
  function abrirSrv() {
    var s = S.srv, f = s.f, d = S.ops.datos, el = document.getElementById('drawer');
    if (!el) { el = document.createElement('div'); el.id = 'drawer'; el.className = 'drawer'; document.body.appendChild(el); }
    var a = function (campo, extra) { return 'data-sf="' + campo + '"' + (extra || ''); };
    var inp = function (campo, label, extra) { return '<label class="f">' + label + '<input ' + a(campo, extra) + ' value="' + esc(f[campo] == null ? '' : f[campo]) + '"></label>'; };
    var area = function (campo, label, ayuda) { return '<label class="f">' + label + (ayuda ? ' <span class="sub" style="display:inline;font-weight:400">' + ayuda + '</span>' : '') + '<textarea ' + a(campo) + '>' + esc(f[campo] || '') + '</textarea></label>'; };
    var provs = S.datos.proveedores.filter(function (p) { return !p.eliminado_at || p.id === f.proveedor_id; });
    var pend = s.pend;
    el.innerHTML = '<div class="panel" role="dialog" aria-modal="true" aria-label="Servicio" style="width:min(820px,100%)"><div class="panel__head"><h2>' + esc(s.orig ? s.orig.titulo : 'Nuevo servicio') +
      (s.orig ? ' <span class="pill ' + (s.orig.eliminado_at ? 'p-cancelado">en la papelera' : (!s.orig.publicado_at ? 'p-nuevo">Nuevo' : (s.orig.activo ? 'p-confirmado">Activo' : 'p-cancelado">Apagado'))) + '</span>' : '') + '</h2><button class="btn btn--sm" data-act="cerrar">Cerrar</button></div><div class="panel__body">' +
      (pend ? '<p class="aviso" style="margin:0">Tiene un cambio sin publicar (' + esc(ORIGENES[pend.origen] || pend.origen) + ', ' + esc(fechaHora(pend.creado_at)) + '). Lo que ves abajo ya lo incluye. ' +
        '<button class="btn btn--sm" data-pub-uno="' + esc(pend.id) + '">Publicarlo</button> <button class="btn btn--sm btn--danger" data-desc-uno="' + esc(pend.id) + '">Descartarlo</button></p>' : '') +
      (s.orig && s.orig.revision === 'pendiente' ? '<p class="aviso" style="margin:0">Para revisar: ' + esc(s.orig.revision_motivo || 'faltan datos') + '</p>' : '') +
      (s.orig && faltantes(Object.assign({}, s.orig, srvParaCalc())).length ? '<p class="aviso" style="margin:0">Para verse como tus tours publicados le falta: <b>' + esc(faltantes(Object.assign({}, s.orig, srvParaCalc())).join(', ')) + '</b>.' +
        (s.orig.tipo !== 'traslado' && s.f.link_web ? ' ' + '<button class="btn btn--sm btn--main" data-act="ficha-traer"' + (s.trayendo ? ' disabled' : '') + '>' + (s.trayendo ? 'Trayendo…' : 'Traer textos del proveedor') + '</button>' : '') + '</p>' : '') +
      '<section class="sec"><h3>Foto</h3><div id="srv-foto">' + fotoSecHtml() + '</div></section>' +
      '<section class="sec"><h3>Precio</h3><div class="grid">' +
      '<label class="f">El proveedor cobra en<select ' + a('_moneda') + '><option value="BRL"' + (f._moneda === 'BRL' ? ' selected' : '') + '>Reales (R$)</option><option value="USD"' + (f._moneda === 'USD' ? ' selected' : '') + '>Dólares (US$)</option></select></label>' +
      '<label class="f">Monto<input ' + a('_monto') + ' type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(f._monto) + '"></label>' +
      '<label class="f">Es un precio<select ' + a('unidad') + '>' + opts(UNIDADES, f.unidad || 'persona') + '</select></label>' +
      '<label class="f">Capacidad (personas)<input ' + a('capacidad') + ' type="number" min="1" value="' + esc(f.capacidad == null ? '' : f.capacidad) + '" placeholder="solo si no es por persona"></label>' +
      '<label class="f">Margen<select ' + a('margen_tipo') + '><option value="">El general</option><option value="usd"' + (f.margen_tipo === 'usd' ? ' selected' : '') + '>Propio en US$ por persona</option><option value="pct"' + (f.margen_tipo === 'pct' ? ' selected' : '') + '>Propio en %</option></select></label>' +
      '<label class="f">Valor del margen propio<input ' + a('margen_valor') + ' type="number" step="0.01" value="' + esc(f.margen_valor == null ? '' : f.margen_valor) + '"></label>' +
      inp('fuente', 'De dónde salió el precio', ' placeholder="Web del operador, WhatsApp con…"') +
      '<label class="f">Verificado el<input ' + a('verificado') + ' type="date" value="' + esc(f.verificado || '') + '"></label></div>' +
      '<div class="cuentas" id="srv-prev" style="margin-top:12px">' + prevHtml() + '</div></section>' +
      '<section class="sec"><h3>Servicio</h3><div class="grid">' +
      '<label class="f">Destino<select ' + a('destino') + '><option value="">Elegí…</option>' + d.destinos.map(function (x) { return '<option value="' + esc(x.key) + '"' + (x.key === f.destino ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Tipo<select ' + a('tipo') + '>' + opts(TIPOS_SRV, f.tipo || 'tour') + '</select></label>' +
      '<label class="f">Proveedor<select ' + a('proveedor_id') + '><option value="">Sin proveedor</option>' + provs.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === f.proveedor_id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') + '</select>' +
        (tarifaHtml(provDe(f.proveedor_id), [Object.assign({}, s.orig || {}, { titulo: f.titulo, destino: f.destino })]) ? '<span class="sub" style="font-weight:400">' + tarifaHtml(provDe(f.proveedor_id), [Object.assign({}, s.orig || {}, { titulo: f.titulo, destino: f.destino })]) + '</span>' : '') + '</label>' +
      inp('orden', 'Orden en la lista', ' type="number" min="0"') + '</div>' +
      '<div class="grid" style="grid-template-columns:1fr;margin-top:10px">' + inp('titulo', 'Título (tal cual se muestra)') +
      (s.orig ? '<p class="sub" style="margin:-4px 0 0">Ojo: la foto del tour está atada al título. Si lo cambiás, la tarjeta queda sin foto.</p>' : '') +
      area('descripcion', 'Descripción') + area('detalle', 'Detalle') +
      '<label class="f" style="display:flex;gap:8px;align-items:center"><input type="checkbox" ' + a('activo') + ' style="width:auto;min-height:0"' + (f.activo ? ' checked' : '') + '> Mostrarlo en la web</label></div></section>' +
      '<section class="sec"><h3>Ficha' + (s.orig && s.orig.tipo !== 'traslado' ? ' <button class="btn btn--sm" data-act="ficha-traer" style="float:right;text-transform:none;letter-spacing:0"' + (s.trayendo ? ' disabled' : '') + '>' + (s.trayendo ? 'Trayendo…' : 'Traer textos del proveedor') + '</button>' : '') + '</h3><div class="grid">' + inp('duracion', 'Duración') + inp('grupo', 'Grupo') + inp('punto_salida', 'Punto de salida') + inp('edad_minima', 'Edad mínima') + '</div>' +
      '<div class="grid" style="grid-template-columns:1fr;margin-top:10px">' + area('incluye', 'Incluye', 'una cosa por línea') + area('no_incluye', 'No incluye', 'una cosa por línea') + area('que_llevar', 'Qué llevar', 'una cosa por línea') +
      area('politica_cancelacion', 'Cancelación') + inp('link_web', 'Link del operador') + (verProv(f.link_web) ? '<p style="margin:-4px 0 0">' + verProv(f.link_web) + '</p>' : '') + '</div></section>' +
      (s.orig ? '<section class="sec"><h3>Historial</h3><div id="srv-hist"><p class="sub">Cargando…</p></div></section>' : '') + '</div>' +
      '<div class="foot"><span class="msg" id="foot-msg" role="status"></span><button class="btn" data-act="cerrar">Cancelar</button>' +
      '<button class="btn" data-act="srv-guardar">Guardar para revisar</button><button class="btn btn--main" data-act="srv-publicar">Publicar ahora</button></div></div>';
    if (s.hist) pintarHist();
  }
  /* Las fotos: hasta 3. La primera es la portada de la tarjeta; las tres van a la galeria del detalle. Se buscan en
     la pagina del proveedor y se copian al bucket de fotos al elegirlas. Se guardan o publican con el resto del servicio.
     Si el tour tiene foto de Wikimedia, la tarjeta sigue usando esa. */
  function sincFotos() { var f = S.srv.f; f.galeria = (f.galeria || []).slice(0, 3); f.url_imagen = f.galeria[0] || ''; S.dirty = true; pintarFoto(); }
  function fotoSecHtml() {
    var s = S.srv, f = s.f, wiki = s.orig && s.orig.foto_wiki, gal = f.galeria || [], fo = s.fotos || {}, origen = s.origenFoto || {};
    var elegidas = {}; gal.forEach(function (u) { if (origen[u]) elegidas[origen[u]] = u; });
    var h = (wiki ? '<p class="sub" style="margin:0 0 8px">Tiene foto de Wikimedia (con autor y licencia): es la portada de la tarjeta en la web. Las de acá se usan para la galería del detalle.</p>' : '') +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:600px">' + [0, 1, 2].map(function (i) {
        var u = urlSegura(gal[i]);
        if (!u) return '<div class="vacio" style="height:110px;border:1px dashed var(--line);border-radius:10px;padding:42px 6px;font-size:13px">' + (i === 0 ? 'Portada' : 'Foto ' + (i + 1)) + '</div>';
        return '<div style="position:relative"><img src="' + esc(u) + '" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:10px;border:' + (i === 0 ? '2px solid var(--accent)' : '1px solid var(--line)') + ';display:block">' +
          '<span class="pill ' + (i === 0 ? 'p-pendiente' : 'p-consultado') + '" style="position:absolute;left:6px;top:6px">' + (i === 0 ? 'Portada' : 'Foto ' + (i + 1)) + '</span>' +
          '<span style="position:absolute;right:6px;top:6px;display:flex;gap:4px">' + (i > 0 ? '<button type="button" class="btn btn--sm" data-foto-portada="' + i + '" title="Hacerla portada" style="min-height:26px;padding:2px 7px">★</button>' : '') +
          '<button type="button" class="btn btn--sm btn--x" data-foto-quitar="' + i + '" title="Quitar" style="width:26px;height:26px;min-height:26px">✕</button></span></div>';
      }).join('') + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:flex-end">' +
      '<button class="btn btn--sm" data-act="fotos-buscar">' + (fo.cargando ? 'Buscando…' : 'Buscar fotos en la página del proveedor') + '</button>' +
      '<label class="f" style="flex:1;min-width:220px">O pegá el link de una foto<span style="display:flex;gap:6px"><input id="foto-link" placeholder="https://…"><button type="button" class="btn btn--sm" data-act="foto-link">Agregar</button></span></label></div>';
    if (fo.error) h += '<p class="err" style="margin-top:8px">' + esc(fo.error) + '</p>';
    if (fo.lista) {
      h += fo.lista.length ? '<p class="sub" style="margin:10px 0 6px">' + fo.lista.length + ' foto(s) en ' + verProv(fo.link, 'la página del proveedor') + '. Tocá hasta 3 (tocá de nuevo para sacarla):</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">' + fo.lista.map(function (u) {
          var sel = !!elegidas[u], cop = (fo.copiando || {})[u];
          return '<button type="button" class="btn" data-foto-cand="' + esc(u) + '" style="padding:3px;min-height:0;position:relative;' + (sel ? 'border:3px solid var(--accent);' : '') + (cop ? 'opacity:.5' : '') + '">' +
            '<img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:90px;object-fit:cover;border-radius:7px;display:block" onerror="this.parentNode.style.display=\'none\'">' +
            (sel ? '<span class="pill p-pendiente" style="position:absolute;left:6px;top:6px">' + (gal.indexOf(elegidas[u]) === 0 ? 'Portada' : 'Foto ' + (gal.indexOf(elegidas[u]) + 1)) + '</span>' : '') + '</button>';
        }).join('') + '</div>' : '<p class="sub" style="margin-top:8px">No encontré fotos en esa página.</p>';
    }
    return h;
  }
  function pintarFoto() { var el = document.getElementById('srv-foto'); if (el) el.innerHTML = fotoSecHtml(); }
  function buscarFotos() {
    var s = S.srv; if (!s) return;
    if (!s.id && !s.f.link_web) return toast('Pegá primero el link del proveedor');
    s.fotos = { cargando: true }; pintarFoto();
    api('ops/fotos/buscar', s.id && s.f.link_web === (s.orig || {}).link_web ? { id: s.id } : { id: s.id, url: s.f.link_web })
      .then(function (r) { if (S.srv === s) { s.fotos = { lista: r.fotos, link: r.link, copiando: {} }; pintarFoto(); } })
      .catch(function (e) { if (S.srv === s) { s.fotos = { error: e.message }; pintarFoto(); } });
  }
  /* Tocar una miniatura: si ya esta elegida la saca; si no, la copia al bucket y la suma (hasta 3). */
  function elegirFoto(u) {
    var s = S.srv; if (!s || !s.fotos) return;
    if (!s.id) return toast('Guardá el servicio primero y después elegí las fotos');
    s.origenFoto = s.origenFoto || {};
    var ya = (s.f.galeria || []).filter(function (g) { return s.origenFoto[g] === u; })[0];
    if (ya) { s.f.galeria = s.f.galeria.filter(function (g) { return g !== ya; }); return sincFotos(); }
    if ((s.f.galeria || []).length >= 3) return toast('Ya elegiste 3: sacá una para cambiarla');
    s.fotos.copiando = s.fotos.copiando || {}; s.fotos.copiando[u] = 1; pintarFoto();
    api('ops/fotos/copiar', { id: s.id, url: u }).then(function (r) {
      delete s.fotos.copiando[u];
      if (S.srv !== s) return;
      if ((s.f.galeria || []).length >= 3) { pintarFoto(); return toast('Ya elegiste 3'); }
      s.origenFoto[r.url] = u; s.f.galeria = (s.f.galeria || []).concat([r.url]); sincFotos();
    }).catch(function (e) { delete s.fotos.copiando[u]; pintarFoto(); toast(e.message); });
  }
  function agregarFotoLink() {
    var s = S.srv, el = document.getElementById('foto-link'), u = el ? el.value.trim() : '';
    if (!s || !u) return;
    if (!urlSegura(u)) return toast('Ese link no es una dirección web');
    if ((s.f.galeria || []).length >= 3) return toast('Ya elegiste 3: sacá una para cambiarla');
    if (!s.id) { s.f.galeria = (s.f.galeria || []).concat([u]); return sincFotos(); }
    // Tambien se copia al bucket, para que no dependa del sitio de donde viene.
    toast('Copiando la foto…');
    api('ops/fotos/copiar', { id: s.id, url: u }).then(function (r) { if (S.srv === s) { s.f.galeria = (s.f.galeria || []).concat([r.url]); sincFotos(); } })
      .catch(function (e) { toast(e.message); });
  }
  /* En lote, de a 3 por pedido (cada uno abre la pagina del operador y copia hasta 3 fotos). */
  function fotosAuto() {
    var ids = Object.keys(S.srvSel || {}); if (!ids.length) return;
    if (!confirm('¿Buscar hasta 3 fotos de ' + ids.length + ' servicio(s) en la página de su proveedor? Los que ya tienen foto se saltean. Las fotos quedan como cambio en "Por publicar".')) return;
    var ok = 0, mal = [], i = 0;
    var paso = function () {
      if (i >= ids.length) {
        S.srvSel = {};
        toast(ok + ' con fotos nuevas' + (mal.length ? ' · ' + mal.length + ' sin foto (' + mal.slice(0, 3).join('; ') + (mal.length > 3 ? '…' : '') + ')' : ''));
        return cargarOps();
      }
      var lote = ids.slice(i, i + 3); i += 3;
      toast('Buscando fotos… ' + Math.min(i, ids.length) + ' de ' + ids.length);
      return api('ops/fotos/auto', { ids: lote }).then(function (r) {
        r.resultados.forEach(function (x) { if (x.ok) ok++; else if (x.motivo !== 'ya tiene foto') mal.push((x.titulo || '?') + ': ' + x.motivo); });
        return paso();
      }).catch(function (e) { toast(e.message); return cargarOps(); });
    };
    paso();
  }
  /* ---------- Traer los textos de la pagina del proveedor (lib/fotos-proveedor.js fichaDesdePagina) ----------
     Llena los campos vacios con lo que dice la pagina del operador, tal cual (casi siempre en portugues), para
     corregirlo en el editor. Nada se guarda hasta que se toca "Guardar para revisar" o "Publicar ahora". */
  var FICHA_CAMPOS = ['descripcion', 'detalle', 'duracion', 'punto_salida', 'politica_cancelacion', 'incluye', 'no_incluye', 'que_llevar'];
  var FICHA_NOMBRES = { descripcion: 'descripción', detalle: 'detalle', duracion: 'duración', punto_salida: 'punto de salida', politica_cancelacion: 'cancelación', incluye: 'qué incluye', no_incluye: 'no incluye', que_llevar: 'qué llevar' };
  function repintarSrv() {
    var y = (document.querySelector('#drawer .panel') || {}).scrollTop || 0;
    abrirSrv();
    var pn = document.querySelector('#drawer .panel'); if (pn) pn.scrollTop = y;
  }
  function traerFicha() {
    var s = S.srv; if (!s || !s.id) return toast('Guardá el servicio primero');
    if (!s.f.link_web) return toast('Pegá primero el link del proveedor');
    s.trayendo = true; repintarSrv();
    api('ops/ficha/traer', { id: s.id, link: s.f.link_web }).then(function (r) {
      s.trayendo = false;
      if (S.srv !== s) return;
      var fi = r.ficha, f = s.f, llenados = [];
      FICHA_CAMPOS.forEach(function (k) {
        var v = String(fi[k] || '').trim();
        if (v && !String(f[k] || '').trim()) { f[k] = v; llenados.push(FICHA_NOMBRES[k]); }
      });
      if (llenados.length) S.dirty = true;
      repintarSrv();
      toast(llenados.length ? 'Completé: ' + llenados.join(', ') : 'La página no tenía más datos para los campos vacíos');
    }).catch(function (e) { s.trayendo = false; if (S.srv === s) repintarSrv(); toast(e.message); });
  }
  function pintarHist() {
    var el = document.getElementById('srv-hist'); if (!el || !S.srv) return;
    var h = S.srv.hist || [];
    if (!h.length) { el.innerHTML = '<p class="sub">Sin cambios registrados.</p>'; return; }
    el.innerHTML = h.map(function (c) {
      var pill = c.estado === 'publicado' ? 'p-confirmado' : (c.estado === 'pendiente' ? 'p-pendiente' : 'p-cancelado');
      return '<div class="item"><div class="item__top"><div style="flex:1"><b>' + esc(fechaHora(c.resuelto_at || c.creado_at)) + '</b> · ' + esc(ORIGENES[c.origen] || c.origen) +
        ' <span class="pill ' + pill + '">' + esc(ESTADOS_CAMBIO[c.estado] || c.estado) + '</span>' +
        (c.publicado_despues != null ? '<span class="sub">Precio publicado: ' + (c.publicado_antes != null ? pub(c.publicado_antes) + ' → ' : '') + pub(c.publicado_despues) + ' ' + esc(pctTxt(c.publicado_antes, c.publicado_despues)) + '</span>' : '') +
        (c.origen !== 'inicial' ? difsHtml(c) : '') + (c.fuente ? '<span class="sub">Fuente: ' + fuenteHtml(c.fuente) + '</span>' : '') + (c.nota ? '<span class="sub"><i>' + esc(c.nota) + '</i></span>' : '') +
        '<span class="sub">' + (c.creado_por ? 'Por ' + esc(c.creado_por) : '') + (c.resuelto_por && c.estado === 'publicado' ? ' · publicó ' + esc(c.resuelto_por) : '') + '</span></div>' +
        (c.estado === 'publicado' && c.origen !== 'inicial' && Object.keys(c.antes || {}).length ? '<button class="btn btn--sm" data-revertir="' + esc(c.id) + '">Volver a lo de antes</button>' : '') + '</div></div>';
    }).join('');
  }
  function guardarSrv(publicarYa) {
    var s = S.srv, f = s.f, cambios = {};
    CAMPOS_SRV.forEach(function (k) { cambios[k] = f[k]; });
    if (f._moneda === 'BRL') { cambios.precio_brl = f._monto === '' ? null : f._monto; delete cambios.precio; }
    else { cambios.precio = f._monto === '' ? null : f._monto; cambios.precio_brl = null; }
    if (!f.destino) return mensaje('Elegí el destino.', true);
    if (!f.titulo || String(f.titulo).trim().length < 3) return mensaje('Escribí el título.', true);
    if (f.activo && f._monto === '') return mensaje('Para mostrarlo en la web necesita precio.', true);
    if (publicarYa) {
      var c = calcPub(srvParaCalc(), provDe(f.proveedor_id), S.ops.datos.config);
      if (f.activo && c.error) return mensaje(c.error, true);
      var antes = s.orig && s.orig.precio_publicado;
      if (!confirm('¿Publicar ya?' + (c.valor != null ? '\nPrecio publicado: ' + (antes != null ? pub(antes) + ' → ' : '') + pub(c.valor) + ' por persona (' + usd(c.valor) + ').' : ''))) return;
    }
    mensaje(publicarYa ? 'Publicando…' : 'Guardando…');
    api('ops/proponer', { id: s.id, cambios: cambios, publicar: !!publicarYa }).then(function (r) {
      S.dirty = false;
      var pub = r.publicacion;
      if (pub && pub.errores && pub.errores.length) { toast('No se publicó: ' + pub.errores[0].error); }
      else toast(!r.cambio ? 'No había nada distinto' : (pub ? 'Publicado. En la web en hasta 1 minuto.' : 'Guardado en "Por publicar"' + (r.aviso ? ' · ' + r.aviso : '')));
      var id = (r.servicio && r.servicio.id) || s.id;
      S.srv = null; var el = document.getElementById('drawer'); if (el) el.remove();
      return cargarOps().then(function () { if (id) abrirServicio(id); });
    }).catch(function (e) { mensaje(e.message, true); });
  }
  function publicarCambios(ids) {
    if (!ids.length) return;
    return api('ops/publicar', { ids: ids }).then(function (r) {
      S.sel = {};
      toast(r.errores.length ? r.publicados + ' publicado(s). No se pudo: ' + r.errores.map(function (x) { return x.servicio + ' (' + x.error + ')'; }).join('; ') : r.publicados + ' publicado(s). En la web en hasta 1 minuto.');
      return cargarOps();
    }).catch(function (e) { toast(e.message); });
  }
  function descartarCambios(ids) {
    if (!ids.length || !confirm('¿Descartar ' + ids.length + ' cambio(s)? La web sigue como está.')) return;
    return api('ops/descartar', { ids: ids }).then(function (r) { S.sel = {}; toast(r.descartados + ' descartado(s)'); return cargarOps(); }).catch(function (e) { toast(e.message); });
  }

  /* ---------- Comparar ofertas (lib/operaciones.js elegirOferta) ----------
     Cada servicio tuyo con las ofertas parecidas de otros proveedores, lado a lado. La mas barata (por persona, ya
     publicada) va marcada. Desde cada oferta: me quedo con el mio, uso este operador, o publico los dos. */
  /* ---------- Pedir tarifa neta al proveedor ----------
     WhatsApp (o email si no hay) con un mensaje en portugues que presenta CuantoSale y pide tarifas para agencia. */
  function telWa(pr) {
    var d = digitos(pr && (pr.whatsapp || pr.telefono));
    if (!d) return '';
    // "(81) 99118-3035" viene sin el 55 de Brasil.
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d.length >= 12 && d.length <= 15 ? d : '';
  }
  function msgTarifa(pr, servicios) {
    var lista = (servicios || []).filter(Boolean).slice(0, 8).map(function (x) { return '• ' + String(x.titulo).replace(/ · [^·]*$/, '') + ' (' + destNombre(x.destino) + ')'; });
    return 'Olá' + (pr && pr.nombre ? ', ' + pr.nombre : '') + '! Tudo bem?\n\n' +
      'Somos a CuántoSale (cuantosale.uy), uma plataforma do Uruguai que ajuda viajantes uruguaios e argentinos a planejar e calcular quanto custa uma viagem ao Brasil: voo, hospedagem, traslados e passeios, tudo em um só lugar.\n\n' +
      (lista.length === 1 ? 'Vimos o passeio ' + lista[0].slice(2) + ' no site de vocês e gostaríamos de oferecê-lo aos nossos clientes.' :
        lista.length ? 'Gostaríamos de oferecer aos nossos clientes estes passeios de vocês:\n' + lista.join('\n') : 'Gostaríamos de oferecer os passeios de vocês aos nossos clientes.') + '\n\n' +
      'Vocês trabalham com tarifas para agências (tarifa neta ou comissão)? Poderiam nos enviar a tabela de preços netos, as formas de pagamento e a política de cancelamento?\n\n' +
      'Muito obrigado!\nEquipe CuántoSale';
  }
  function linkTarifa(pr, servicios, texto) {
    if (!pr) return '';
    var m = msgTarifa(pr, servicios), tel = telWa(pr), mail = String(pr.email || '').trim();
    var href = tel ? 'https://wa.me/' + tel + '?text=' + encodeURIComponent(m)
      : (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? 'mailto:' + mail + '?subject=' + encodeURIComponent('Tarifas para agência - CuántoSale') + '&body=' + encodeURIComponent(m) : '');
    return href ? '<a class="lnk" target="_blank" rel="noopener noreferrer" data-tarifa-prov="' + esc(pr.id) + '" href="' + esc(href) + '">' + esc(texto || 'Pedir tarifa neta') + (tel ? ' (WhatsApp)' : ' (email)') + ' ↗</a>' : '';
  }
  /* Donde estaba el link: si ya se le escribio, el estado (y los botones para marcar si respondio). El link para
     volver a escribir queda, pero avisa antes (ver el clic en data-tarifa-prov). */
  var TARIFA_TXT = { esperando: 'esperando respuesta', respondio: 'respondió', sin_respuesta: 'no respondió' };
  function tarifaHtml(pr, servicios, texto, completo) {
    if (!pr) return '';
    var l = linkTarifa(pr, servicios, texto);
    if (!pr.tarifa_estado) return l;
    var cls = pr.tarifa_estado === 'respondio' ? 'p-confirmado' : (pr.tarifa_estado === 'sin_respuesta' ? 'p-cancelado' : 'p-pendiente');
    var cuando = pr.tarifa_estado === 'respondio' && pr.tarifa_respondio_at ? pr.tarifa_respondio_at : pr.tarifa_pedida_at;
    var marcar = function (estado, t) { return '<button type="button" class="btn btn--sm" data-tarifa-marca="' + esc(pr.id) + '|' + estado + '" style="min-height:24px;padding:1px 8px;font-size:12px">' + t + '</button>'; };
    return '<span class="pill ' + cls + '" title="Tarifa neta pedida el ' + esc(fechaHora(pr.tarifa_pedida_at)) + '">Tarifa: ' + esc(TARIFA_TXT[pr.tarifa_estado] || pr.tarifa_estado) + (cuando ? ' · ' + esc(fecha(cuando)) : '') + '</span> ' +
      (pr.tarifa_estado === 'esperando' ? marcar('respondio', 'Respondió') + ' ' + marcar('sin_respuesta', 'No respondió') + ' ' : '') +
      (completo && pr.tarifa_estado !== 'esperando' ? marcar('esperando', 'Volver a esperando') + ' ' : '') +
      (completo ? marcar('borrar', 'Borrar marca') + ' ' : '') +
      (l ? l.replace('>' + esc(texto || 'Pedir tarifa neta'), '>Volver a escribir') : '');
  }
  function marcarTarifa(id, estado) {
    /* Si se tocan dos marcas seguidas (escribir y enseguida "Respondió"), las respuestas pueden llegar al reves:
       solo se aplica la del ultimo pedido. */
    S.tarifaSeq = S.tarifaSeq || {};
    var seq = S.tarifaSeq[id] = (S.tarifaSeq[id] || 0) + 1;
    return api('ops/proveedor/tarifa', { id: id, estado: estado }).then(function (r) {
      if (S.tarifaSeq[id] !== seq) return r;
      var lista = S.datos.proveedores;
      for (var i = 0; i < lista.length; i++) if (lista[i].id === id) lista[i] = Object.assign({}, lista[i], r.proveedor);
      if (S.prov && S.prov.id === id) Object.assign(S.prov, { tarifa_pedida_at: r.proveedor.tarifa_pedida_at, tarifa_estado: r.proveedor.tarifa_estado, tarifa_respondio_at: r.proveedor.tarifa_respondio_at });
      pintarFondo();
      // El editor abierto se repinta con lo que se esta editando (no se recarga: se perderia lo no guardado).
      if (S.srv) repintarSrv(); else if (S.prov) abrirProv();
      return r;
    }).catch(function (e) { toast(e.message); });
  }
  function contactoProv(pr, x) {
    if (!pr) return '';
    return (tarifaHtml(pr, x ? [x] : []) ? tarifaHtml(pr, x ? [x] : []) + ' ' : '') +
      (pr.web ? '<a class="lnk" target="_blank" rel="noopener" href="' + esc(/^https?:/.test(pr.web) ? pr.web : 'https://' + pr.web) + '">Web</a>' : '');
  }
  function columnaCmp(x, esMio, barato) {
    var cfg = S.ops.datos.config, pr = provDe(x.proveedor_id), sinU = /persona o por/.test(x.revision_motivo || '');
    var c = calcPub(x, pr, cfg), inc = String(x.incluye || '').split('\n').filter(Boolean);
    var fila = function (t, v) { return '<div class="cmp__f"><small>' + t + '</small>' + (v || '<span class="sub" style="display:inline">—</span>') + '</div>'; };
    var precio = (x.precio_brl != null ? brl(x.precio_brl) : (x.precio != null ? usd(x.precio) : '—')) + ' <span class="sub" style="display:inline">' + esc(sinU ? 'unidad sin indicar' : (UNIDADES[x.unidad] || '')) + (x.unidad !== 'persona' && x.capacidad ? ' · hasta ' + x.capacidad : '') + '</span>';
    var h = '<div class="cmp__col' + (esMio ? ' cmp__col--mio' : '') + '">' +
      '<div class="cmp__cab">' + (esMio ? '<span class="pill p-confirmado">' + (x.publicado_at ? 'Tuyo' : 'Tuyo · nuevo') + '</span>' : '<span class="pill p-pendiente">Oferta</span>') + (barato ? ' <span class="pill p-nuevo">más barato</span>' : '') +
      '<b>' + esc(pr ? pr.nombre : 'sin proveedor') + '</b><span class="sub">' + esc(esMio ? x.titulo : String(x.titulo).replace(/ · [^·]*$/, '')) + '</span></div>' +
      fila('Cobra', precio) +
      fila(esMio && x.precio_publicado != null ? 'Publicado hoy' : 'Quedaría publicado', esMio && x.precio_publicado != null ? '<b>' + pub(x.precio_publicado) + '</b> por persona' : (c.valor != null ? '<b>' + pub(c.valor) + '</b> por persona' : '<span class="deuda">' + esc(c.error || '') + '</span>')) +
      fila('Duración', esc(x.duracion || '')) +
      fila('Incluye', inc.length ? esc(inc.slice(0, 4).join(' · ')) + (inc.length > 4 ? '…' : '') : '') +
      fila('Verificado', x.verificado ? esc(fecha(x.verificado) + ' ' + x.verificado.slice(0, 4)) : '') +
      fila('Contacto', (x.link_web ? '<a class="lnk" target="_blank" rel="noopener" href="' + esc(x.link_web) + '">Ver la oferta</a> ' : '') + contactoProv(pr, x));
    if (!esMio) {
      h += (sinU ? '<label class="f" style="margin-top:6px">El precio es<select data-cmp-unidad="' + esc(x.id) + '"><option value="">Elegí…</option>' + opts(UNIDADES, (S.cmpUnidad || {})[x.id] || '') + '</select></label>' : '') +
        '<div class="cmp__acc"><button class="btn btn--sm btn--main" data-cmp="este" data-cmp-id="' + esc(x.id) + '">Usar este operador</button>' +
        '<button class="btn btn--sm" data-cmp="ambos" data-cmp-id="' + esc(x.id) + '">Publicar los dos</button>' +
        '<button class="btn btn--sm btn--danger" data-cmp="mio" data-cmp-id="' + esc(x.id) + '">Me quedo con el mío</button></div>';
    } else {
      h += '<div class="cmp__acc"><button class="btn btn--sm" data-srv="' + esc(x.id) + '">Abrir el tuyo</button></div>';
    }
    return h + '</div>';
  }
  function vistaComparar(ofertas) {
    if (!ofertas.length) return '<div class="card"><p class="vacio">No hay ofertas para comparar. Cuando importes un archivo, lo parecido a tus servicios queda acá.</p></div>';
    var todos = S.ops.datos.servicios, porId = {}; todos.forEach(function (x) { porId[x.id] = x; });
    var grupos = {}, orden = [];
    ofertas.forEach(function (x) { if (!grupos[x.alternativa_de]) { grupos[x.alternativa_de] = []; orden.push(x.alternativa_de); } grupos[x.alternativa_de].push(x); });
    orden.sort(function (a, b) { var A = porId[a] || {}, B = porId[b] || {}; return (destNombre(A.destino) + A.titulo).localeCompare(destNombre(B.destino) + B.titulo, 'es'); });
    var cfg = S.ops.datos.config;
    return '<p class="sub" style="margin:-4px 0 12px">' + ofertas.length + ' oferta(s) de otros proveedores para ' + orden.length + ' servicio(s) tuyos. Elegí en cada una: usar ese operador (su precio queda en "Por publicar"), publicar los dos, o quedarte con el tuyo.</p>' +
      orden.map(function (id) {
        var mio = porId[id]; if (!mio) return '';
        /* Si el tuyo es nuevo (o tiene un cambio sin publicar), sus datos estan en el pendiente: se compara con eso. */
        var pm = pendPorTour()[id]; if (pm) mio = Object.assign({}, mio, pm.despues);
        var cols = [mio].concat(grupos[id]);
        var precios = cols.map(function (x) { var v = x === mio && x.precio_publicado != null ? Number(x.precio_publicado) : calcPub(x, provDe(x.proveedor_id), cfg).valor; return v == null ? Infinity : v; });
        var min = Math.min.apply(null, precios);
        return '<div class="card uso-card"><h3 class="uso-h">' + esc(mio.titulo) + ' <span class="sub" style="display:inline">· ' + esc(destNombre(mio.destino)) + ' · ' + grupos[id].length + ' oferta(s)</span></h3>' +
          '<div class="cmp">' + cols.map(function (x, i) { return columnaCmp(x, i === 0, cols.length > 1 && precios[i] === min && min !== Infinity); }).join('') + '</div></div>';
      }).join('');
  }
  function elegirCmp(accion, id) {
    var x = S.ops.datos.servicios.filter(function (s) { return s.id === id; })[0]; if (!x) return;
    var pr = provDe(x.proveedor_id), nom = pr ? pr.nombre : 'este operador', cuerpo = { id: id, accion: accion, unidad: (S.cmpUnidad || {})[id] || '' };
    if (accion !== 'mio' && /persona o por/.test(x.revision_motivo || '') && !cuerpo.unidad) return toast('Elegí primero si el precio es por persona o por vehículo');
    if (accion === 'mio' && !confirm('¿Te quedás con el tuyo? La oferta de ' + nom + ' va a la papelera (el proveedor queda en tu directorio).')) return;
    if (accion === 'este' && !confirm('¿Usar a ' + nom + ' para tu servicio? Su precio queda en "Por publicar" para que lo revises, y la oferta va a la papelera.')) return;
    if (accion === 'ambos') {
      var t = prompt('Va a ser un servicio nuevo. ¿Con qué título se muestra?', String(x.titulo).replace(/ · [^·]*$/, ''));
      if (t == null) return; cuerpo.titulo = t;
    }
    document.querySelectorAll('[data-cmp-id="' + id + '"]').forEach(function (bt) { bt.disabled = true; });
    api('ops/comparar', cuerpo).then(function () {
      toast(accion === 'mio' ? 'Listo: te quedás con el tuyo' : (accion === 'este' ? 'Listo: el cambio está en "Por publicar"' : 'Listo: quedó como Nuevo, con su precio en "Por publicar"'));
      return cargar();
    }).catch(function (e) { toast(e.message); document.querySelectorAll('[data-cmp-id="' + id + '"]').forEach(function (bt) { bt.disabled = false; }); });
  }

  /* ---------- Resumen de Operaciones ----------
     Todo sale de lo que ya carga el panel (ops/datos y los proveedores) mas ops/resumen (ultimas importaciones y
     ultimos publicados). Cada numero lleva a la lista filtrada donde se resuelve. */
  function cargarResumen() {
    if (S.resumen && S.resumen.cargando) return;
    S.resumen = { cargando: true };
    api('ops/resumen').then(function (r) { S.resumen = r; if (S.vista === 'operaciones') pintarFondo(); })
      .catch(function (e) { S.resumen = { error: e.message }; if (S.vista === 'operaciones') pintarFondo(); });
    /* La cotizacion del dia, solo para avisar si la guardada quedo lejos. */
    fetch('/api/tasas', { credentials: 'same-origin' }).then(function (r) { return r.json(); })
      .then(function (j) { var v = j && j.rates && Number(j.rates.BRL); if (v > 0) { S.cotHoy = v; if (S.vista === 'operaciones') pintarFondo(); } }).catch(function () {});
  }
  function kpiIr(t, v, sub, ir, cls) {
    return '<button class="kpi kpi--btn ' + (cls || '') + '" data-ir="' + esc(ir) + '"><small>' + esc(t) + '</small><b>' + esc(v) + '</b><em>' + esc(sub) + '</em><span class="kpi__ver">Ver →</span></button>';
  }
  function vistaOperaciones() {
    var o = S.ops;
    if (!o || o.cargando) return '<p class="vacio">Cargando…</p>';
    if (o.error) return '<div class="card"><p class="vacio">No se pudo cargar: ' + esc(o.error) + ' <button class="btn" data-act="ops-recargar">Reintentar</button></p></div>';
    if (!S.resumen) cargarResumen();
    var d = o.datos, cfg = d.config, dias = cfg.dias_desactualizado, pend = pendPorTour();
    var vivos = d.servicios.filter(function (x) { return !x.eliminado_at && !x.alternativa_de; });
    var ofertas = d.servicios.filter(function (x) { return !x.eliminado_at && x.alternativa_de; });
    var enWeb = vivos.filter(function (x) { return x.activo && x.revision === 'ok' && x.tipo !== 'traslado'; });
    var nuevos = vivos.filter(function (x) { return !x.publicado_at; });
    var revisar = vivos.filter(function (x) { return x.revision === 'pendiente'; });
    var viejos = vivos.filter(function (x) { return x.activo && viejo(x, dias); });
    var papelera = d.servicios.length - vivos.length;
    var provs = S.datos.proveedores.filter(function (p) { return !p.eliminado_at; });
    var provActivos = provs.filter(function (p) { return p.activo !== false; });
    var conServ = {}; vivos.forEach(function (x) { if (x.proveedor_id) conServ[x.proveedor_id] = 1; });
    var grandes = d.pendientes.filter(function (c) { return c.publicado_antes && c.publicado_despues != null && Math.abs((c.publicado_despues - c.publicado_antes) / c.publicado_antes) >= 0.2; });
    var h = '<div class="bar"><div class="chips"><b>Operaciones</b></div><button class="btn btn--sm" data-act="ops-recargar">Actualizar</button></div>';
    if (S.cotHoy && cfg.cotizacion && Math.abs(S.cotHoy - cfg.cotizacion) / cfg.cotizacion >= 0.03) {
      h += '<p class="aviso">La cotización guardada es R$ ' + esc(String(cfg.cotizacion).replace('.', ',')) + (cfg.cotizacion_fuente ? ' (' + esc(cfg.cotizacion_fuente) + ')' : '') + ' y hoy está en R$ ' + esc(String(S.cotHoy).replace('.', ',')) +
        '. <button class="btn btn--sm" data-act="ir-cfg">Revisar cotización</button></p>';
    }
    h += '<section class="kpis" aria-label="Operaciones">' +
      kpiIr('Proveedores activos', provActivos.length, Object.keys(conServ).length + ' con servicios en el catálogo', 'v:proveedores') +
      kpiIr('En la web', enWeb.length, 'servicios publicados', 's:publicados', 'kpi--ok') +
      kpiIr('Nuevos sin publicar', nuevos.length, 'importados o creados', 's:nuevos', nuevos.length ? 'kpi--warn' : '') +
      (ofertas.length ? kpiIr('Para comparar', ofertas.length, 'ofertas de otros proveedores', 's:comparar', 'kpi--warn') : '') +
      kpiIr('Para revisar', revisar.length, 'les falta un dato', 's:revision', revisar.length ? 'kpi--warn' : '') +
      kpiIr('Precio viejo', viejos.length, 'verificado hace más de ' + dias + ' días', 's:viejos', viejos.length ? 'kpi--warn' : '') +
      kpiIr('Por publicar', d.pendientes.length, grandes.length ? grandes.length + ' cambian más de 20 %' : 'cambios esperando revisión', 'v:publicar', d.pendientes.length ? 'kpi--warn' : '') +
      (papelera ? kpiIr('Papelera', papelera, 'fuera de la web', 's:papelera') : '') + '</section>';

    /* Por destino */
    var porDest = {};
    vivos.forEach(function (x) {
      var r = porDest[x.destino] = porDest[x.destino] || { web: 0, nuevos: 0, revisar: 0, viejos: 0, pend: 0, prov: {} };
      if (x.activo && x.revision === 'ok' && x.tipo !== 'traslado') r.web++;
      if (!x.publicado_at) r.nuevos++;
      if (x.revision === 'pendiente') r.revisar++;
      if (x.activo && viejo(x, dias)) r.viejos++;
      if (pend[x.id]) r.pend++;
      if (x.proveedor_id) r.prov[x.proveedor_id] = 1;
    });
    var dests = Object.keys(porDest).sort(function (a, b) { return destNombre(a).localeCompare(destNombre(b), 'es'); });
    var celda = function (n, cls) { return n ? (cls ? '<span class="' + cls + '">' + n + '</span>' : n) : '<span class="sub" style="display:inline">—</span>'; };
    h += '<div class="card uso-card"><h3 class="uso-h">Servicios por destino</h3><table><thead><tr><th>Destino</th><th class="num">En la web</th><th class="num">Nuevos</th><th class="num">Para revisar</th><th class="num">Precio viejo</th><th class="num">Por publicar</th><th class="num">Proveedores</th></tr></thead><tbody>' +
      dests.map(function (k) {
        var r = porDest[k];
        return '<tr class="row" data-ir="d:' + esc(k) + '"><td data-l="Destino"><b>' + esc(destNombre(k)) + '</b></td><td class="num" data-l="En la web">' + celda(r.web) + '</td><td class="num" data-l="Nuevos">' + celda(r.nuevos) + '</td>' +
          '<td class="num" data-l="Para revisar">' + celda(r.revisar, 'deuda') + '</td><td class="num" data-l="Precio viejo">' + celda(r.viejos, 'deuda') + '</td><td class="num" data-l="Por publicar">' + celda(r.pend) + '</td>' +
          '<td class="num" data-l="Proveedores">' + celda(Object.keys(r.prov).length) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    /* Cambios por publicar, por origen */
    if (d.pendientes.length) {
      var porOrigen = {}; d.pendientes.forEach(function (c) { porOrigen[c.origen] = (porOrigen[c.origen] || 0) + 1; });
      var masViejo = d.pendientes.reduce(function (a, c) { return !a || c.creado_at < a ? c.creado_at : a; }, '');
      h += '<div class="card uso-card"><h3 class="uso-h">Por publicar</h3><p class="sub" style="padding:0 14px 12px">' +
        Object.keys(porOrigen).map(function (k) { return '<b>' + porOrigen[k] + '</b> de ' + esc((ORIGENES[k] || k).toLowerCase()); }).join(' · ') +
        ' · el más viejo espera desde el ' + esc(fechaHora(masViejo)) + ' <button class="btn btn--sm" data-ir="v:publicar">Revisar</button></p></div>';
    }

    /* Importaciones y ultimos publicados */
    var rs = S.resumen || {};
    if (rs.error) h += '<p class="aviso">No se pudo leer el historial: ' + esc(rs.error) + '</p>';
    var imps = rs.importaciones || [];
    h += '<div class="card uso-card"><h3 class="uso-h">Últimas importaciones</h3>' + (rs.cargando ? '<p class="vacio">Cargando…</p>' : !imps.length ? '<p class="vacio">Todavía no importaste archivos. <button class="btn btn--sm" data-ir="v:importar">Importar</button></p>' :
      '<table><thead><tr><th>Archivo</th><th>Cuándo</th><th class="num">Nuevos</th><th class="num">Actualiza</th><th class="num">No importados</th><th class="num">Errores</th><th></th></tr></thead><tbody>' +
      imps.map(function (x) { var t = x.totales || {}; return '<tr><td data-l="Archivo">' + esc(x.archivo || '—') + '<span class="sub">' + esc(x.creado_por || '') + '</span></td><td data-l="Cuándo">' + esc(fechaHora(x.confirmado_at || x.creado_at)) + '</td>' +
        '<td class="num" data-l="Nuevos">' + (t.nuevos || 0) + '</td><td class="num" data-l="Actualiza">' + (t.actualiza || 0) + '</td><td class="num" data-l="No importados">' + ((t.omitidas || 0) + (t.sin_cambios || 0)) + '</td>' +
        '<td class="num" data-l="Errores">' + (t.errores ? '<span class="deuda">' + t.errores + '</span>' : 0) + '</td><td data-l=""><button class="btn btn--sm" data-imp-detalle="' + esc(x.id) + '">Descargar detalle</button></td></tr>'; }).join('') + '</tbody></table>') + '</div>';
    var pubs = rs.publicados || [];
    h += '<div class="card uso-card"><h3 class="uso-h">Últimos cambios publicados</h3>' + (rs.cargando ? '<p class="vacio">Cargando…</p>' : !pubs.length ? '<p class="vacio">Todavía no publicaste cambios desde el panel.</p>' :
      '<table><thead><tr><th>Servicio</th><th>Qué</th><th class="num">Precio publicado</th><th>Quién y cuándo</th></tr></thead><tbody>' +
      pubs.map(function (c) { var k = String(c.tour_clave || '').split('#');
        return '<tr' + (c.tour_id ? ' class="row" data-srv="' + esc(c.tour_id) + '"' : '') + '><td data-l="Servicio"><b>' + esc(k[1] || '?') + '</b><span class="sub">' + esc(destNombre(k[0])) + '</span></td>' +
          '<td data-l="Qué">' + esc(ORIGENES[c.origen] || c.origen) + (c.nota ? '<span class="sub">' + esc(c.nota.length > 80 ? c.nota.slice(0, 77) + '…' : c.nota) + '</span>' : '') + '</td>' +
          '<td class="num" data-l="Precio">' + (c.publicado_despues != null ? (c.publicado_antes != null && c.publicado_antes !== c.publicado_despues ? pub(c.publicado_antes) + ' → ' : '') + '<b>' + pub(c.publicado_despues) + '</b>' : '—') + '</td>' +
          '<td data-l="Quién">' + esc(c.resuelto_por || '') + '<span class="sub">' + esc(fechaHora(c.resuelto_at)) + '</span></td></tr>'; }).join('') + '</tbody></table>') + '</div>';
    return h;
  }

  /* ---------- Precios masivos: cotizacion y margen, ajuste % (lib/operaciones.js guardarConfig / ajustar) ----------
     Las dos ventanas primero muestran que cambiaria (simular) y recien despues preparan los cambios. Nada se publica:
     todo va a "Por publicar". */
  function abrirModal() {
    var m = S.modal, el = document.getElementById('drawer');
    if (!el) { el = document.createElement('div'); el.id = 'drawer'; el.className = 'drawer'; document.body.appendChild(el); }
    var cuerpo = m.tipo === 'cfg' ? modalCfg(m) : modalAjuste(m);
    el.innerHTML = '<div class="panel" role="dialog" aria-modal="true" style="width:min(640px,100%)"><div class="panel__head"><h2>' + (m.tipo === 'cfg' ? 'Cotización y margen' : 'Ajustar precio') + '</h2><button class="btn btn--sm" data-act="cerrar">Cerrar</button></div>' +
      '<div class="panel__body">' + cuerpo.cuerpo + '</div><div class="foot"><span class="msg" id="foot-msg" role="status"></span><button class="btn" data-act="cerrar">Cancelar</button>' + cuerpo.botones + '</div></div>';
  }
  function statsHtml(st) {
    if (!st) return '';
    if (!st.cambian) return '<p class="sub" style="margin:0">Ningún precio publicado cambia.</p>';
    return '<div class="cuentas"><div><small>Precios que cambian</small><b>' + st.cambian + '</b></div><div><small>Suben</small><b>' + st.suben + '</b></div><div><small>Bajan</small><b>' + st.bajan + '</b></div></div>' +
      (st.ejemplos.length ? '<p class="sub" style="margin:10px 0 0">Por ejemplo: ' + st.ejemplos.map(function (x) { return esc(x.servicio) + ' ' + (x.antes != null ? pub(x.antes) + ' → ' : '') + (x.despues != null ? pub(x.despues) : '—'); }).join(' · ') + '</p>' : '');
  }
  function modalCfg(m) {
    var a = function (k, extra) { return 'data-cfg="' + k + '"' + (extra || ''); };
    var hoyTxt = m.hoy ? 'Hoy: R$ ' + String(m.hoy).replace('.', ',') + ' por dólar (exchangerate-api)' : '';
    return { cuerpo: '<section class="sec"><div class="grid">' +
      '<label class="f">Cotización (reales por dólar)<input ' + a('cotizacion', ' type="number" step="0.0001" min="1"') + ' value="' + esc(m.cotizacion) + '"></label>' +
      '<label class="f">Margen general<select ' + a('margen_tipo') + '><option value="usd"' + (m.margen_tipo !== 'pct' ? ' selected' : '') + '>US$ por persona</option><option value="pct"' + (m.margen_tipo === 'pct' ? ' selected' : '') + '>Porcentaje</option></select></label>' +
      '<label class="f">Valor del margen<input ' + a('margen_valor', ' type="number" step="0.01"') + ' value="' + esc(m.margen_valor) + '"></label>' +
      '<label class="f">Precio viejo después de (días)<input ' + a('dias_desactualizado', ' type="number" min="7"') + ' value="' + esc(m.dias_desactualizado) + '"></label></div>' +
      '<p style="margin:10px 0 0"><button class="btn btn--sm" data-act="cfg-hoy">Traer la cotización de hoy</button> <span class="sub" style="display:inline">' + esc(hoyTxt) + '</span></p>' +
      '<p class="sub" style="margin:10px 0 0">El margen general se suma a los precios en reales de los servicios que no tienen margen propio ni de su proveedor. Al guardar, cada precio que cambiaría queda en "Por publicar"; la web no cambia hasta que publiques.</p></section>' +
      (m.st ? '<section class="sec"><h3>Qué cambia' + (m.st.nota ? ': ' + esc(m.st.nota) : '') + '</h3>' + statsHtml(m.st) + '</section>' : ''),
      botones: '<button class="btn" data-act="cfg-simular">Ver qué cambia</button><button class="btn btn--main" data-act="cfg-guardar">Guardar y preparar cambios</button>' };
  }
  function modalAjuste(m) {
    var d = S.ops.datos, pend = pendPorTour(), cfg = d.config, pct = Number(String(m.pct).replace(',', '.')) || 0;
    var filas = d.servicios.filter(function (x) { return m.ids.indexOf(x.id) >= 0; }).map(function (x) {
      var base = Object.assign({}, x, pend[x.id] ? pend[x.id].despues : {});
      var campo = base.precio_brl != null ? 'precio_brl' : (base.precio != null ? 'precio' : null);
      if (!campo) return null;
      var v = Number(base[campo]) * (1 + pct / 100); v = m.entero ? Math.round(v) : r2(v);
      var fut = Object.assign({}, base); fut[campo] = v;
      var c = calcPub(fut, provDe(fut.proveedor_id), cfg);
      return { s: x, campo: campo, antes: Number(base[campo]), despues: v, pub: c.valor };
    }).filter(Boolean);
    return { cuerpo: '<section class="sec"><div class="grid">' +
      '<label class="f">Porcentaje (negativo para bajar)<input data-aj="pct" type="number" step="0.1" value="' + esc(m.pct) + '" placeholder="Ej: 8 o -5"></label>' +
      '<label class="f" style="display:flex;gap:8px;align-items:center;margin-top:22px"><input type="checkbox" data-aj="entero" style="width:auto;min-height:0"' + (m.entero ? ' checked' : '') + '> Redondear a reales enteros</label></div>' +
      '<p class="sub" style="margin:10px 0 0">Se ajusta lo que cobra el proveedor. El precio publicado se recalcula con la cotización y el margen. Todo queda en "Por publicar".</p></section>' +
      '<section class="sec"><h3>' + filas.length + ' servicio(s)</h3><table><tbody>' + filas.slice(0, 40).map(function (x) {
        var fm = x.campo === 'precio_brl' ? brl : usd;
        return '<tr><td data-l="Servicio">' + esc(x.s.titulo) + '<span class="sub">' + esc(destNombre(x.s.destino)) + '</span></td><td class="num" data-l="Proveedor">' + fm(x.antes) + (pct ? ' → <b>' + fm(x.despues) + '</b>' : '') + '</td>' +
          '<td class="num" data-l="Quedaría publicado">' + (x.pub != null ? pub(x.pub) + '<span class="sub">publicado por persona</span>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table>' + (filas.length > 40 ? '<p class="sub">…y ' + (filas.length - 40) + ' más.</p>' : '') + '</section>',
      botones: '<button class="btn btn--main" data-act="aj-guardar"' + (pct && filas.length ? '' : ' disabled') + '>Preparar ' + filas.length + ' cambio(s)</button>' };
  }
  function abrirCfg() {
    var c = S.ops.datos.config;
    S.modal = { tipo: 'cfg', cotizacion: c.cotizacion, margen_tipo: c.margen ? c.margen.tipo : 'usd', margen_valor: c.margen ? c.margen.valor : 0, dias_desactualizado: c.dias_desactualizado, st: null, fuente: '' };
    abrirModal();
  }
  function cuerpoCfg(simular) {
    var m = S.modal;
    return { cotizacion: m.cotizacion, margen_tipo: m.margen_tipo, margen_valor: m.margen_valor, dias_desactualizado: m.dias_desactualizado, cotizacion_fuente: m.fuente, simular: simular };
  }
  function simularCfg() {
    mensaje('Calculando…');
    api('ops/config', cuerpoCfg(true)).then(function (st) { if (S.modal) { S.modal.st = st; abrirModal(); } }).catch(function (e) { mensaje(e.message, true); });
  }
  function guardarCfg() {
    var m = S.modal;
    if (!confirm('¿Guardar la cotización y el margen?' + (m.st && m.st.cambian ? '\n' + m.st.cambian + ' precio(s) quedan para revisar en "Por publicar".' : ''))) return;
    mensaje('Guardando…');
    api('ops/config', cuerpoCfg(false)).then(function (r) {
      toast('Guardado' + (r.cambian ? ' · ' + r.cambian + ' precio(s) para revisar en "Por publicar"' : ''));
      cerrarPanel(true); return cargarOps();
    }).catch(function (e) { mensaje(e.message, true); });
  }
  function guardarAjuste() {
    var m = S.modal;
    if (!confirm('¿Preparar el ajuste de ' + m.pct + ' %? Los cambios quedan en "Por publicar".')) return;
    mensaje('Preparando…');
    api('ops/ajustar', { ids: m.ids, pct: m.pct, redondeo: m.entero ? 'entero' : '' }).then(function (r) {
      toast(r.cambian + ' cambio(s) en "Por publicar"'); S.srvSel = {}; cerrarPanel(true); return cargarOps();
    }).catch(function (e) { mensaje(e.message, true); });
  }

  /* ---------- Importar (CSV o Excel) ----------
     El archivo se lee en el navegador; al server van solo las columnas elegidas, ya con el nombre de CuántoSale.
     La vista previa y la confirmacion las calcula el server con la misma funcion (lib/operaciones.js analizarImport),
     asi que lo que se confirma es lo que se vio. Nada se publica: todo queda en "Por publicar". */
  var ACCIONES_IMP = { nuevo: 'Nuevo', parecido: 'Parecido a uno tuyo', igual: 'Igual a uno tuyo', repetido: 'Repetido en el archivo', actualiza: 'Cambia', sin_cambios: 'Sin cambios', error: 'Con error' };
  var DECISIONES_IMP = { comparar: 'Dejar para comparar', nuevo: 'Importar como nuevo', omitir: 'No importar', asignar: 'Asignar el operador al tuyo', actualizar: 'Actualizar' };
  var PILL_IMP = { nuevo: 'p-nuevo', parecido: 'p-pendiente', igual: 'p-cancelado', repetido: 'p-cancelado', actualiza: 'p-consultado', sin_cambios: 'p-completado', error: 'p-cancelado' };

  function normH(s) { return sinTildes(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function leerCSV(texto) {
    texto = String(texto).replace(/^﻿/, '');
    var primera = texto.split(/\r?\n/)[0] || '';
    var sep = (primera.split(';').length > primera.split(',').length) ? ';' : (primera.indexOf('\t') >= 0 && primera.split('\t').length > primera.split(',').length ? '\t' : ',');
    var filas = [], fila = [], campo = '', q = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (q) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
      else if (c === '"') q = true;
      else if (c === sep) { fila.push(campo); campo = ''; }
      else if (c === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
      else campo += c;
    }
    if (campo || fila.length) { fila.push(campo.replace(/\r$/, '')); filas.push(fila); }
    filas = filas.filter(function (f) { return f.some(function (x) { return String(x).trim(); }); });
    var cab = (filas.shift() || []).map(function (x) { return String(x).trim(); });
    return { cabeceras: cab, filas: filas.map(function (f) { var o = {}; cab.forEach(function (h, j) { o[h] = f[j] == null ? '' : f[j]; }); return o; }) };
  }
  function cargarSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = function () { ok(window.XLSX); }; s.onerror = function () { mal(new Error('No se pudo cargar el lector de Excel. Probá guardando el archivo como CSV.')); };
      document.head.appendChild(s);
    });
  }
  function leerArchivo(file) {
    S.imp = { paso: 'leyendo', archivo: file.name }; pintar();
    var esExcel = /\.(xlsx|xls)$/i.test(file.name);
    var p = esExcel
      ? Promise.all([cargarSheetJS(), file.arrayBuffer()]).then(function (r) {
        var wb = r[0].read(r[1], { type: 'array' }), hoja = wb.Sheets[wb.SheetNames[0]];
        var filas = r[0].utils.sheet_to_json(hoja, { defval: '', raw: false });
        return { cabeceras: filas.length ? Object.keys(filas[0]) : [], filas: filas };
      })
      : file.text().then(leerCSV);
    p.then(function (d) {
      if (!d.filas.length) throw new Error('El archivo no tiene filas.');
      var mapeo = {};
      S.ops.datos.campos_import.forEach(function (c) {
        var opciones = [c.k, c.nombre].concat(c.sin).map(normH);
        var h = d.cabeceras.filter(function (x) { return opciones.indexOf(normH(x)) >= 0; })[0];
        if (h) mapeo[c.k] = h;
      });
      S.imp = { paso: 'columnas', archivo: file.name, cabeceras: d.cabeceras, filas: d.filas, mapeo: mapeo };
      pintar();
    }).catch(function (e) { S.imp = { paso: 'archivo', error: e.message }; pintar(); });
  }
  function filasMapeadas() {
    var m = S.imp.mapeo;
    return S.imp.filas.map(function (f) { var o = {}; Object.keys(m).forEach(function (k) { if (m[k]) o[k] = f[m[k]]; }); return o; });
  }
  function decisionDe(r) { return (S.imp.decisiones && S.imp.decisiones[r.n]) || r.decision; }
  function resumenDecisiones() {
    var t = { nuevo: 0, comparar: 0, asignar: 0, actualizar: 0, omitir: 0, error: 0 };
    S.imp.previa.filas.forEach(function (r) { if (r.accion === 'error') t.error++; else t[decisionDe(r)] = (t[decisionDe(r)] || 0) + 1; });
    return t;
  }
  function cargarImportaciones() {
    api('ops/importaciones').then(function (j) { S.impHist = j.importaciones; if (S.vista === 'importar') pintar(); }).catch(function () { S.impHist = []; });
  }
  function descargarCSV(nombre, filas) {
    var csv = '﻿' + filas.map(function (f) { return f.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = nombre; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function vistaImportar() {
    if (!S.ops || !S.ops.datos) return '<p class="vacio">Cargando…</p>';
    var im = S.imp || { paso: 'archivo' }, h = '<div class="bar"><div class="chips"><b>Importar servicios y precios</b></div>' +
      (im.paso !== 'archivo' && im.paso !== 'leyendo' ? '<button class="btn btn--sm" data-act="imp-reiniciar">Empezar de nuevo</button>' : '') + '</div>';
    if (im.paso === 'leyendo' || im.paso === 'analizando' || im.paso === 'confirmando') return h + '<div class="card"><p class="vacio">' + (im.paso === 'confirmando' ? 'Importando… no cierres esta pestaña.' : (im.paso === 'analizando' ? 'Comparando con lo que ya tenés…' : 'Leyendo ' + esc(im.archivo) + '…')) + '</p></div>';
    if (im.paso === 'archivo') {
      if (S.impHist === undefined) { S.impHist = null; cargarImportaciones(); }
      h += '<section class="sec"><h3>1. Elegí el archivo</h3><p class="sub" style="margin:0 0 10px">CSV o Excel, una fila por servicio. Nada se publica: lo que importes queda como <b>Nuevo</b> en Servicios y los precios esperan en <b>Por publicar</b>. Si volvés a subir el mismo archivo, actualiza en vez de duplicar.</p>' +
        '<input type="file" id="imp-archivo" accept=".csv,.txt,.xlsx,.xls">' + (im.error ? '<p class="err" style="margin-top:8px">' + esc(im.error) + '</p>' : '') + '</section>';
      var hist = S.impHist || [];
      if (hist.length) {
        h += '<div class="card uso-card"><h3 class="uso-h">Últimas importaciones</h3><table><thead><tr><th>Archivo</th><th>Cuándo</th><th class="num">Nuevos</th><th class="num">Actualiza</th><th class="num">No importados</th><th class="num">Errores</th><th></th></tr></thead><tbody>' +
          hist.map(function (x) { var t = x.totales || {}; return '<tr><td data-l="Archivo">' + esc(x.archivo || '—') + (x.estado !== 'confirmada' ? ' <span class="pill p-cancelado">' + esc(x.estado) + '</span>' : '') + '</td><td data-l="Cuándo">' + esc(fechaHora(x.confirmado_at || x.creado_at)) + '</td>' +
            '<td class="num" data-l="Nuevos">' + (t.nuevos || 0) + '</td><td class="num" data-l="Actualiza">' + (t.actualiza || 0) + '</td><td class="num" data-l="No importados">' + ((t.omitidas || 0) + (t.sin_cambios || 0)) + '</td>' +
            '<td class="num" data-l="Errores">' + (t.errores ? '<span class="deuda">' + t.errores + '</span>' : 0) + '</td><td data-l=""><button class="btn btn--sm" data-imp-detalle="' + esc(x.id) + '">Descargar detalle</button></td></tr>'; }).join('') + '</tbody></table></div>';
      }
      return h;
    }
    if (im.paso === 'columnas') {
      var campos = S.ops.datos.campos_import, faltan = campos.filter(function (c) { return c.obligatorio && !im.mapeo[c.k]; });
      var ejemplo = function (col) { var f = im.filas.filter(function (x) { return String(x[col] || '').trim(); })[0]; var v = f ? String(f[col]) : ''; return v.length > 60 ? v.slice(0, 57) + '…' : v; };
      h += '<section class="sec"><h3>2. Qué es cada columna</h3><p class="sub" style="margin:0 0 10px">' + esc(im.archivo) + ' · ' + im.filas.length + ' filas · ' + im.cabeceras.length + ' columnas. Las que reconocí ya están elegidas; revisalas.</p>' +
        '<div class="card"><table><thead><tr><th>Dato de CuántoSale</th><th>Columna del archivo</th><th>Ejemplo</th></tr></thead><tbody>' +
        campos.map(function (c) {
          return '<tr><td data-l="Dato"><b>' + esc(c.nombre) + '</b>' + (c.obligatorio ? ' <span class="deuda">*</span>' : '') + '</td><td data-l="Columna"><select data-imp-col="' + esc(c.k) + '"><option value="">— no usar —</option>' +
            im.cabeceras.map(function (x) { return '<option' + (im.mapeo[c.k] === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></td>' +
            '<td data-l="Ejemplo"><span class="sub">' + esc(im.mapeo[c.k] ? ejemplo(im.mapeo[c.k]) : '') + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="bar" style="margin-top:12px"><span class="sub" style="flex:1">' + (faltan.length ? 'Falta elegir: ' + esc(faltan.map(function (c) { return c.nombre; }).join(', ')) : '') + '</span>' +
        '<button class="btn btn--main" data-act="imp-previa"' + (faltan.length ? ' disabled' : '') + '>Ver vista previa</button></div></section>';
      return h;
    }
    if (im.paso === 'previa') {
      var pv = im.previa, tot = pv.totales, f = im.filtro || 'todos', rs = resumenDecisiones();
      var provNuevos = {}; pv.filas.forEach(function (r) { if (r.proveedor_nuevo && r.accion !== 'error' && decisionDe(r) !== 'omitir') provNuevos[r.operador] = 1; });
      h += '<section class="sec"><h3>3. Vista previa</h3><p style="margin:0 0 6px">' + esc(im.archivo) + ': se van a crear <b>' + rs.nuevo + '</b> servicios nuevos' + (rs.actualizar ? ', actualizar <b>' + rs.actualizar + '</b>' : '') + (rs.asignar ? ', asignar operador a <b>' + rs.asignar + '</b> de los tuyos' : '') +
        (rs.comparar ? ', dejar <b>' + rs.comparar + '</b> para comparar con los tuyos' : '') + ' y <b>' + rs.omitir + '</b> no se importan' + (rs.error ? ' (<span class="deuda">' + rs.error + ' con error</span>)' : '') + '. Proveedores nuevos: <b>' + Object.keys(provNuevos).length + '</b>.</p>' +
        '<p class="sub" style="margin:0">Lo parecido a uno tuyo (y el mismo paseo de otro operador) queda <b>para comparar</b>: en Servicios → "Para comparar" lo ves al lado del tuyo y elegís con qué proveedor quedarte. No va a la web ni a "Por publicar". Los nuevos quedan como Nuevo hasta que los publiques.</p></section>';
      h += '<div class="bar"><div class="chips">' + ['todos'].concat(Object.keys(ACCIONES_IMP)).filter(function (k) { return k === 'todos' || tot[k]; }).map(function (k) {
        return '<button class="chip" data-imp-filtro="' + k + '" aria-pressed="' + (f === k) + '">' + esc(k === 'todos' ? 'Todas' : ACCIONES_IMP[k]) + '<span>' + (k === 'todos' ? tot.total : tot[k]) + '</span></button>';
      }).join('') + '</div>' + (tot.error ? '<button class="btn btn--sm" data-act="imp-errores">Descargar errores</button>' : '') + '</div>';
      var filas = pv.filas.filter(function (r) { return f === 'todos' || r.accion === f; });
      h += '<div class="card"><table><thead><tr><th class="num">#</th><th>Servicio</th><th>Precio</th><th>Qué pasa</th><th>Qué hacer</th></tr></thead><tbody>' +
        filas.map(function (r) {
          var que = '<span class="pill ' + (PILL_IMP[r.accion] || '') + '">' + esc(ACCIONES_IMP[r.accion] || r.accion) + '</span>' +
            (r.ref ? '<span class="sub">' + (r.accion === 'actualiza' || r.accion === 'sin_cambios' ? 'Ya cargado' : 'Tuyo: ') + ' «' + esc(r.ref.titulo) + '»' + (r.ref.precio_publicado != null ? ' · ' + pub(r.ref.precio_publicado) : '') + (r.similitud && r.similitud < 1 ? ' · ' + Math.round(r.similitud * 100) + ' % parecido' : '') + '</span>' : '') +
            r.errores.map(function (x) { return '<span class="sub deuda">' + esc(x) + '</span>'; }).join('') + r.avisos.map(function (x) { return '<span class="sub">' + esc(x) + '</span>'; }).join('');
          var dec = r.opciones.length > 1 ? '<select data-imp-dec="' + r.n + '">' + r.opciones.map(function (o) { return '<option value="' + o + '"' + (decisionDe(r) === o ? ' selected' : '') + '>' + esc(DECISIONES_IMP[o]) + '</option>'; }).join('') + '</select>'
            : '<span class="sub">' + esc(r.accion === 'error' ? 'Corregí el archivo' : DECISIONES_IMP[r.opciones[0] || 'omitir']) + '</span>';
          return '<tr><td class="num" data-l="Fila">' + r.n + '</td><td data-l="Servicio"><b>' + esc(r.titulo || '(sin título)') + '</b><span class="sub">' + esc(r.destino ? destNombre(r.destino) : r.destino_texto) + ' · ' + esc(TIPOS_SRV[r.tipo] || r.tipo) + '</span>' +
            '<span class="sub">' + esc(r.operador) + (r.proveedor_nuevo ? ' <span class="tag">proveedor nuevo</span>' : '') + '</span></td>' +
            '<td data-l="Precio">' + (r.monto != null ? (r.moneda === 'USD' ? usd(r.monto) : brl(r.monto)) + '<span class="sub">' + esc(r.unidad ? UNIDADES[r.unidad] : 'unidad sin indicar') + (r.capacidad ? ' · hasta ' + r.capacidad : '') + '</span>' : '—') +
            (r.publicado_estimado != null && r.tipo !== 'traslado' ? '<span class="sub">→ publicado ' + pub(r.publicado_estimado) + ' por persona</span>' : '') + '</td>' +
            '<td data-l="Qué pasa">' + que + '</td><td data-l="Qué hacer">' + dec + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="bar" style="margin:12px 0 24px"><button class="btn" data-act="imp-columnas">Volver a las columnas</button><span style="flex:1"></span><button class="btn btn--main" data-act="imp-confirmar"' + (rs.nuevo + rs.actualizar + rs.asignar ? '' : ' disabled') + '>Confirmar importación</button></div>';
      return h;
    }
    if (im.paso === 'listo') {
      var t = im.resultado.totales;
      return h + '<section class="sec"><h3>4. Listo</h3><div class="cuentas">' +
        [['Servicios nuevos', t.nuevos], ['Para comparar', t.para_comparar || 0], ['Actualizados / asignados', t.actualiza], ['Proveedores nuevos', t.proveedores_nuevos], ['Cambios para revisar', t.cambios_pendientes], ['No importados', t.omitidas + t.sin_cambios], ['Con error', t.errores]]
          .map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
        '<p class="sub" style="margin:12px 0">Los nuevos están en Servicios con la etiqueta <b>Nuevo</b> y todavía no se ven en la web. Revisá los precios en "Por publicar" y publicá los que estén bien.</p>' +
        '<button class="btn btn--main" data-vista="publicar">Ir a Por publicar</button> <button class="btn" data-act="imp-reiniciar">Importar otro archivo</button></section>';
    }
    return h;
  }
  function pedirPrevia() {
    var filas = filasMapeadas();
    S.imp.paso = 'analizando'; pintar();
    api('ops/importar/previa', { filas: filas }).then(function (pv) { S.imp.previa = pv; S.imp.decisiones = {}; S.imp.paso = 'previa'; S.imp.filtro = 'todos'; pintar(); })
      .catch(function (e) { S.imp.paso = 'columnas'; pintar(); toast(e.message); });
  }
  function confirmarImport() {
    var rs = resumenDecisiones();
    if (!confirm('¿Importar?\n\n' + rs.nuevo + ' servicios nuevos (quedan como Nuevo, sin publicar)\n' + (rs.actualizar + rs.asignar) + ' servicios tuyos con cambios para revisar\n' + rs.comparar + ' ofertas para comparar con las tuyas\n' + rs.omitir + ' filas no se importan')) return;
    var im = S.imp;
    im.paso = 'confirmando'; pintar();
    api('ops/importar/confirmar', { archivo: im.archivo, mapeo: im.mapeo, filas: filasMapeadas(), decisiones: im.decisiones })
      // cargar() y no solo cargarOps(): la importacion crea proveedores, y sin recargarlos las ofertas dicen "sin proveedor".
      .then(function (r) { im.resultado = r; im.paso = 'listo'; S.impHist = undefined; pintar(); cargar(); })
      .catch(function (e) { im.paso = 'previa'; pintar(); toast('No se pudo importar: ' + e.message); });
  }

  /* ---------- acciones ---------- */
  function cargar() {
    S.cargando = true;
    api('precarga').then(function (p) { S.precarga = p; if (S.datos) pintarFondo(); }).catch(function () { /* el resumen de precarga es un extra */ });
    cargarOps();
    return api('datos').then(function (d) { S.datos = d; S.cargando = false; cargarChats(); if (AV.estado === 'cargando') revisarAvisos();
      if (S.primeraVez !== false) { S.primeraVez = false; if (/[?&](chat|pedido)=/.test(location.search)) { setTimeout(function () { irA(location.href); history.replaceState(null, '', '/admin/'); }, 0); } } if (!S.draft && !S.prov && !S.srv) pintar(); else pintarFondo(); }).catch(function (e) {
      S.cargando = false; if (e.status !== 401) { app.innerHTML = '<p class="vacio">No se pudo cargar: ' + esc(e.message) + ' <button class="btn" data-act="recargar">Reintentar</button></p>'; }
    });
  }
  /* Repinta el tablero sin tocar el panel abierto. */
  function pintarFondo() { var dr = document.getElementById('drawer'), draft = S.draft, prov = S.prov, srv = S.srv, modal = S.modal; S.draft = null; S.prov = null; S.srv = null; S.modal = null; pintar(); S.draft = draft; S.prov = prov; S.srv = srv; S.modal = modal; if (dr && !document.getElementById('drawer')) document.body.appendChild(dr); }
  function mensaje(t, mal) { var m = document.getElementById('foot-msg'); if (m) { m.textContent = t; m.style.color = mal ? 'var(--bad)' : 'var(--ok)'; } }

  function guardar() {
    var p = S.draft;
    var cuerpo = { estado: p.estado, cliente_nombre: p.cliente_nombre, cliente_telefono: p.cliente_telefono, cliente_email: p.cliente_email, destino: p.destino,
      fecha_ida: p.fecha_ida || null, fecha_vuelta: p.fecha_vuelta || null, personas: p.personas, medio_pago: p.medio_pago, notas: p.notas, items: p.items, pagos: p.pagos };
    var llamada = p.id ? api('pedido/actualizar', { id: p.id, cambios: cuerpo }) : api('pedido/crear', cuerpo);
    mensaje('Guardando…');
    return llamada.then(function (r) {
      S.draft = JSON.parse(JSON.stringify(r.pedido)); S.dirty = false;
      toast('Guardado'); return api('datos').then(function (d) { S.datos = d; pintarFondo(); refrescarPanel(); });
    }).catch(function (e) { mensaje(e.message, true); });
  }
  function borrarPedido() {
    var p = S.draft;
    if (!p || !p.id || !confirm('¿Borrar el pedido ' + (p.ref || '') + ' para siempre? No se puede deshacer.')) return;
    mensaje('Borrando…');
    api('pedido/borrar', { id: p.id }).then(function () { toast('Pedido ' + (p.ref || '') + ' borrado'); S.dirty = false; cerrarPanel(true); return cargar(); }).catch(function (e) { mensaje(e.message, true); });
  }
  function guardarProv() {
    var p = S.prov;
    if (!p.nombre || p.nombre.trim().length < 2) return mensaje('Escribí el nombre del proveedor.', true);
    var dest = String(p._destinos || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).join(', ');
    p.servicios = String(p._hace || '').replace(/ · /g, ' - ').trim() + (dest ? ' · ' + dest : '');
    p.destinos = dest;
    mensaje('Guardando…');
    if (!p.margen_tipo) p.margen_valor = null;
    api('proveedor/guardar', p).then(function (r) { toast('Proveedor guardado' + (r.cambios && r.cambios.cambian ? ' · ' + r.cambios.cambian + ' precio(s) para revisar en "Por publicar"' : '')); cerrarPanel(true); return cargar(); }).catch(function (e) { mensaje(e.message, true); });
  }
  function papeleraProv() {
    var p = S.prov, eliminar = !p.eliminado_at;
    if (eliminar && !confirm('¿Mandar a la papelera a ' + p.nombre + '? Queda inactivo y escondido; sus pedidos y servicios no se tocan.')) return;
    api('proveedor/papelera', { id: p.id, eliminar: eliminar }).then(function () { toast(eliminar ? 'En la papelera' : 'Fuera de la papelera (sigue inactivo hasta que lo actives)'); cerrarPanel(true); return cargar(); })
      .catch(function (e) { mensaje(e.message, true); });
  }
  function abrir(id) {
    var p = S.datos.pedidos.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    S.draft = JSON.parse(JSON.stringify(p)); S.dirty = false; cargarTasas(); abrirPanel();
  }
  function nuevoProveedor() { return { id: null, nombre: '', contacto: '', telefono: '', email: '', servicios: '', datos_pago: '', notas: '', activo: true }; }

  /* ---------- eventos ---------- */
  function valor(el) { return el.type === 'number' ? (el.value === '' ? 0 : parseFloat(el.value)) : el.value; }
  function alEditar(e) {
    var el = e.target;
    if (el.id === 'chat-txt') { S.borrador = el.value; return; }
    if (el.id === 'q') { S.q = el.value; var pos = el.selectionStart; pintar(); var q = document.getElementById('q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (er) { /* sin rango */ } } return; }
    if (el.id === 'q-viajes') { S.qViajes = el.value; var pv = el.selectionStart; pintar(); var qv = document.getElementById('q-viajes'); if (qv) { qv.focus(); try { qv.setSelectionRange(pv, pv); } catch (er) { /* sin rango */ } } return; }
    if (el.matches && el.matches('[data-deuda]')) { S.soloDeuda = el.checked; pintar(); return; }
    if (el.id === 'q-srv') { S.qSrv = el.value; var ps = el.selectionStart; pintar(); var qs = document.getElementById('q-srv'); if (qs) { qs.focus(); try { qs.setSelectionRange(ps, ps); } catch (er) { /* sin rango */ } } return; }
    if (el.hasAttribute('data-cmp-unidad')) { S.cmpUnidad = S.cmpUnidad || {}; S.cmpUnidad[el.getAttribute('data-cmp-unidad')] = el.value; return; }
    if (el.hasAttribute('data-pdes')) { if (e.type === 'change') { S.pubDest = el.value; pintar(); } return; }
    if (el.hasAttribute('data-ssel')) { if (e.type === 'change') { if (el.checked) S.srvSel[el.getAttribute('data-ssel')] = 1; else delete S.srvSel[el.getAttribute('data-ssel')]; pintar(); } return; }
    if (el.hasAttribute('data-cfg') && S.modal) { S.modal[el.getAttribute('data-cfg')] = el.value; if (el.getAttribute('data-cfg') === 'cotizacion') S.modal.fuente = ''; S.modal.st = null; return; }
    if (el.hasAttribute('data-aj') && S.modal) {
      if (el.getAttribute('data-aj') === 'entero') S.modal.entero = el.checked; else S.modal.pct = el.value;
      if (e.type === 'change') { var y = (document.querySelector('#drawer .panel') || {}).scrollTop || 0; abrirModal(); var pn = document.querySelector('#drawer .panel'); if (pn) pn.scrollTop = y; }
      return;
    }
    if (el.id === 'imp-archivo') { if (e.type === 'change' && el.files && el.files[0]) leerArchivo(el.files[0]); return; }
    if (el.hasAttribute('data-imp-col')) { if (e.type === 'change') { S.imp.mapeo[el.getAttribute('data-imp-col')] = el.value; pintar(); } return; }
    if (el.hasAttribute('data-imp-dec')) { if (e.type === 'change') { S.imp.decisiones[el.getAttribute('data-imp-dec')] = el.value; pintar(); } return; }
    if (el.hasAttribute('data-sorden')) { if (e.type === 'change') { S.srvOrden = el.value; pintar(); } return; }
    if (el.hasAttribute('data-sdest')) { if (e.type === 'change') { S.srvDest = el.value; pintar(); } return; }
    if (el.hasAttribute('data-sprov')) { if (e.type === 'change') { S.srvProv = el.value; pintar(); } return; }
    if (el.hasAttribute('data-sel')) { if (e.type === 'change') { if (el.checked) S.sel[el.getAttribute('data-sel')] = 1; else delete S.sel[el.getAttribute('data-sel')]; pintar(); } return; }
    if (el.hasAttribute('data-sf') && S.srv) {
      var sk = el.getAttribute('data-sf');
      S.srv.f[sk] = el.type === 'checkbox' ? el.checked : (el.type === 'number' && sk !== '_monto' ? (el.value === '' ? null : parseFloat(el.value)) : el.value);
      if (sk === 'margen_tipo' && !el.value) S.srv.f.margen_valor = null;
      /* Cambiar el monto es haberlo verificado hoy, salvo que se ponga otra fecha despues. */
      if (sk === '_monto' || sk === '_moneda') { S.srv.f.verificado = hoyISO(); var vf = document.querySelector('[data-sf="verificado"]'); if (vf) vf.value = S.srv.f.verificado; }
      S.dirty = true;
      var pv = document.getElementById('srv-prev'); if (pv) pv.innerHTML = prevHtml();

      return;
    }
    if (el.hasAttribute('data-pf') && S.prov) { S.prov[el.getAttribute('data-pf')] = el.type === 'checkbox' ? el.checked : el.value; return; }
    if (el.hasAttribute('data-sena-moneda')) { S.senaMoneda = el.value; refrescarPanel(); return; }
    if (!S.draft || !el.hasAttribute('data-f')) return;
    var campo = el.getAttribute('data-f'), v = valor(el);
    S.dirty = true;
    if (el.hasAttribute('data-i')) {
      var it = S.draft.items[+el.getAttribute('data-i')];
      it[campo] = v;
      if (campo === 'proveedor_id') {
        var pr = S.datos.proveedores.filter(function (x) { return x.id === v; })[0];
        it.proveedor_nombre = pr ? pr.nombre : '';
        if (e.type === 'change') refrescarPanel();      // para mostrar el WhatsApp y los datos de pago del proveedor
      }
    } else if (el.hasAttribute('data-p')) {
      S.draft.pagos[+el.getAttribute('data-p')][campo] = v;
    } else {
      S.draft[campo] = (campo === 'fecha_ida' || campo === 'fecha_vuelta') && !v ? null : v;
      if (campo === 'estado') { var pl = document.getElementById('pill-estado'); if (pl) { pl.className = 'pill p-' + v; pl.textContent = ESTADOS[v]; } }
    }
    var cb = document.getElementById('cuentas-box'); if (cb) cb.innerHTML = cuentasHtml(S.draft);
    /* La sena se repinta en el change y no en cada tecla: tiene un select y repintarlo mientras se escribe en
       otro campo no molesta, pero si el foco estuviera en el select lo perderia. */
    var sb = document.getElementById('sena-box'); if (sb && e.type === 'change') sb.innerHTML = senaHtml(S.draft);
  }
  document.addEventListener('input', alEditar);
  document.addEventListener('change', alEditar);

  document.addEventListener('submit', function (e) {
    if (e.target.id === 'chat-form') {
      e.preventDefault();
      var ta = document.getElementById('chat-txt'), err = document.getElementById('chat-err'), bt = e.target.querySelector('button'), texto = (ta.value || '').trim();
      if (!texto) return;
      bt.disabled = true; err.textContent = '';
      api('mensajes/enviar', { telefono: S.chatTel, texto: texto }).then(function (r) {
        S.borrador = ''; ta.value = ''; bt.disabled = false;
        S.conv = (S.conv || []).concat([r.mensaje]); refrescarMensajes(true); cargarChats(); ta.focus();
      }).catch(function (er) { bt.disabled = false; err.textContent = er.message; });
      return;
    }
    if (e.target.id === 'wa-reg' || e.target.id === 'wa-prueba') {
      e.preventDefault();
      var f = new FormData(e.target), msg = document.getElementById('wa-msg'), b = e.target.querySelector('button');
      var reg = e.target.id === 'wa-reg';
      b.disabled = true; msg.style.color = ''; msg.textContent = reg ? 'Registrando…' : 'Enviando…';
      (reg ? api('whatsapp/registrar', { pin: String(f.get('pin') || '') }) : api('whatsapp/prueba', { telefono: String(f.get('tel') || '') }))
        .then(function (r) {
          cargarWa(); pintar();
          /* Si anduvo con otro idioma que el configurado, se avisa cual poner en WHATSAPP_TEMPLATE_LANG */
          toast(reg ? 'Número registrado' : 'Prueba enviada: revisá tu WhatsApp' + (r && r.idioma && r.idioma !== r.idiomaConfigurado ? '. La plantilla está en ' + r.idioma + ': poné WHATSAPP_TEMPLATE_LANG=' + r.idioma : ''));
        })
        .catch(function (er) { b.disabled = false; msg.style.color = 'var(--bad)'; msg.textContent = er.message; });
      return;
    }
    if (e.target.id !== 'login') return;
    e.preventDefault();
    var fd = new FormData(e.target), btn = e.target.querySelector('button');
    btn.disabled = true;
    api('login', { user: fd.get('user'), pass: fd.get('pass'), recordar: !!fd.get('recordar') }).then(function () { return cargar(); })
      .catch(function (er) { pintarLogin(er.message); });
  });

  document.addEventListener('click', function (e) {
    var tm = e.target.closest('[data-tarifa-marca]'); if (tm) { e.preventDefault(); var pz = tm.getAttribute('data-tarifa-marca').split('|'); marcarTarifa(pz[0], pz[1]); return; }
    var tp = e.target.closest('a[data-tarifa-prov]');
    if (tp) {
      var prv = provDe(tp.getAttribute('data-tarifa-prov'));
      if (prv && prv.tarifa_pedida_at && !confirm('Ya le escribiste a ' + prv.nombre + ' el ' + fechaHora(prv.tarifa_pedida_at) + ' (' + (TARIFA_TXT[prv.tarifa_estado] || 'sin estado') + '). ¿Escribirle otra vez?')) { e.preventDefault(); return; }
      // El enlace se abre solo (WhatsApp o email); aca se anota que se le escribio.
      if (prv) marcarTarifa(prv.id, 'enviado');
      return;
    }
    if (e.target.closest('a[href]:not([href="#"])')) return;   // los enlaces (WhatsApp, email) se abren solos, sin abrir el detalle
    var ch = e.target.closest('[data-chat]'); if (ch) { abrirChat(ch.getAttribute('data-chat')); return; }
    var ip = e.target.closest('[data-ir-pedido]'); if (ip) { S.vista = 'pedidos'; pintar(); abrir(ip.getAttribute('data-ir-pedido')); return; }
    var pv = e.target.closest('[data-precarga]'); if (pv) { var cual = pv.getAttribute('data-precarga'); S.verPre = S.verPre === cual ? '' : cual; pintarFondo(); return; }
    var ud = e.target.closest('[data-uso-dias]'); if (ud) { S.usoDias = +ud.getAttribute('data-uso-dias'); cargarUso(); return; }
    var pd = e.target.closest('[data-pdest]'); if (pd) { S.provDest = pd.getAttribute('data-pdest'); pintar(); return; }
    var vsp = e.target.closest('[data-ver-srv-prov]'); if (vsp) { e.preventDefault(); S.srvProv = vsp.getAttribute('data-ver-srv-prov'); S.srvFiltro = 'todos'; S.vista = 'servicios'; pintar(); return; }
    var ir = e.target.closest('[data-ir]'); if (ir) {
      var dest = ir.getAttribute('data-ir'), tipo = dest.slice(0, 2), val = dest.slice(2);
      if (tipo === 'v:') { S.vista = val; }
      else { S.vista = 'servicios'; S.qSrv = ''; S.srvProv = ''; S.srvFiltro = tipo === 's:' ? val : 'todos'; S.srvDest = tipo === 'd:' ? val : ''; }
      pintar(); window.scrollTo(0, 0); return;
    }
    var sfc = e.target.closest('[data-sfiltro]'); if (sfc) { S.srvFiltro = sfc.getAttribute('data-sfiltro'); pintar(); return; }
    var fc = e.target.closest('[data-foto-cand]'); if (fc) { elegirFoto(fc.getAttribute('data-foto-cand')); return; }
    var fq = e.target.closest('[data-foto-quitar]'); if (fq && S.srv) { S.srv.f.galeria.splice(+fq.getAttribute('data-foto-quitar'), 1); sincFotos(); return; }
    var fpo = e.target.closest('[data-foto-portada]'); if (fpo && S.srv) { var gi = +fpo.getAttribute('data-foto-portada'), gu = S.srv.f.galeria.splice(gi, 1)[0]; S.srv.f.galeria.unshift(gu); sincFotos(); return; }
    var cm = e.target.closest('[data-cmp]'); if (cm) { elegirCmp(cm.getAttribute('data-cmp'), cm.getAttribute('data-cmp-id')); return; }
    var pp = e.target.closest('[data-papelera],[data-recuperar],[data-borrar]');
    if (pp) {
      var pid = pp.getAttribute('data-papelera') || pp.getAttribute('data-recuperar') || pp.getAttribute('data-borrar');
      var ps = S.ops.datos.servicios.filter(function (x) { return x.id === pid; })[0] || { titulo: '' };
      if (pp.hasAttribute('data-borrar')) {
        if (!confirm('¿Borrar para siempre «' + ps.titulo + '»? No se puede deshacer (el historial de precios queda).')) return;
        api('ops/borrar', { id: pid }).then(function () { toast('Borrado'); return cargarOps(); }).catch(function (er) { toast(er.message); });
      } else {
        var tirar = pp.hasAttribute('data-papelera');
        if (tirar && !confirm('¿Mandar «' + ps.titulo + '» a la papelera?' + (ps.activo ? '\nSale de la web ahora.' : '') + '\nLo podés recuperar desde Papelera.')) return;
        api('ops/papelera', { id: pid, eliminar: tirar }).then(function () { toast(tirar ? 'En la papelera' : 'Recuperado'); return cargarOps(); }).catch(function (er) { toast(er.message); });
      }
      return;
    }
    var imf = e.target.closest('[data-imp-filtro]'); if (imf) { S.imp.filtro = imf.getAttribute('data-imp-filtro'); pintar(); return; }
    var imd = e.target.closest('[data-imp-detalle]'); if (imd) {
      api('ops/importacion?id=' + encodeURIComponent(imd.getAttribute('data-imp-detalle'))).then(function (j) {
        descargarCSV('importacion-detalle.csv', [['Fila', 'Resultado', 'Servicio', 'Proveedor', 'Avisos y errores']].concat(j.filas.map(function (f) { return [f.n, f.accion, (f.datos || {}).titulo, (f.datos || {}).operador, (f.errores || []).join(' · ')]; })));
      }).catch(function (er) { toast(er.message); });
      return;
    }
    var sv = e.target.closest('[data-srv]'); if (sv && !e.target.closest('input')) { e.preventDefault(); if (S.dirty && document.getElementById('drawer') && !confirm('Tenés cambios sin guardar. ¿Seguir?')) return; abrirServicio(sv.getAttribute('data-srv')); return; }
    var pu = e.target.closest('[data-pub-uno]'); if (pu) { if (S.dirty && !confirm('Lo que editaste y no guardaste se pierde. ¿Publicar igual?')) return; S.dirty = false; publicarCambios([pu.getAttribute('data-pub-uno')]); return; }
    var du = e.target.closest('[data-desc-uno]'); if (du) { S.dirty = false; descartarCambios([du.getAttribute('data-desc-uno')]); return; }
    var rv = e.target.closest('[data-revertir]'); if (rv) {
      if (!confirm('Se prepara un cambio que vuelve a lo de antes. Queda en "Por publicar" para que lo publiques. ¿Seguir?')) return;
      api('ops/revertir', { id: rv.getAttribute('data-revertir') }).then(function (r) { toast(r.cambio ? 'Listo: revisalo y publicalo' : (r.aviso || 'Ya está así')); S.dirty = false; return cargarOps(); }).catch(function (er) { toast(er.message); });
      return;
    }
    var t = e.target.closest('[data-vista],[data-filtro],[data-abrir],[data-prov],[data-act],[data-quitar-item],[data-quitar-pago],[data-pagado-total]');
    if (!t) return;
    if (t.hasAttribute('data-vista')) { S.vista = t.getAttribute('data-vista'); if (S.vista === 'viajes' && (!S.viajes || S.viajes.error)) cargarViajes(); else if (S.vista === 'uso') cargarUso(); else pintar(); return; }
    if (t.hasAttribute('data-filtro')) { S.filtro = t.getAttribute('data-filtro'); pintar(); return; }
    if (t.hasAttribute('data-abrir')) { abrir(t.getAttribute('data-abrir')); return; }
    if (t.hasAttribute('data-prov')) { var id = t.getAttribute('data-prov'); S.prov = JSON.parse(JSON.stringify(S.datos.proveedores.filter(function (x) { return x.id === id; })[0])); S.dirty = false; abrirProv(); return; }
    if (t.hasAttribute('data-quitar-item')) { S.draft.items.splice(+t.getAttribute('data-quitar-item'), 1); S.dirty = true; refrescarPanel(); return; }
    if (t.hasAttribute('data-quitar-pago')) { S.draft.pagos.splice(+t.getAttribute('data-quitar-pago'), 1); S.dirty = true; refrescarPanel(); return; }
    if (t.hasAttribute('data-pagado-total')) { var it = S.draft.items[+t.getAttribute('data-pagado-total')]; it.pagado_proveedor_usd = it.costo_usd || 0; S.dirty = true; refrescarPanel(); return; }
    switch (t.getAttribute('data-act')) {
      case 'recargar': cargar(); if (S.vista === 'viajes') cargarViajes(); break;
      case 'avisos-on': activarAvisos(); break;
      case 'avisos-off': desactivarAvisos(); break;
      case 'wa-recargar': cargarWa(); pintar(); break;
      case 'salir': api('logout', {}).then(function () { S.datos = null; cerrarPanel(true); pintarLogin(); }); break;
      case 'nuevo': S.draft = nuevoDraft(); S.dirty = false; abrirPanel(); break;
      case 'nuevo-prov': S.prov = nuevoProveedor(); S.dirty = false; abrirProv(); break;
      case 'cerrar': cerrarPanel(false); break;
      case 'add-item': S.draft.items.push(itemVacio()); S.dirty = true; refrescarPanel(); break;
      case 'add-pago': S.draft.pagos.push({ id: 'n' + Date.now(), fecha: new Date().toISOString().slice(0, 10), monto_usd: 0, medio: S.draft.medio_pago || '', nota: '' }); S.dirty = true; refrescarPanel(); break;
      case 'cobrar-saldo': var c = calc(S.draft); if (c.saldo > 0) { S.draft.pagos.push({ id: 'n' + Date.now(), fecha: new Date().toISOString().slice(0, 10), monto_usd: c.saldo, medio: S.draft.medio_pago || '', nota: 'Saldo' }); S.dirty = true; refrescarPanel(); } break;
      case 'registrar-sena': var cs = calc(S.draft); if (cs.senaPend > 0) { S.draft.pagos.push({ id: 'n' + Date.now(), fecha: new Date().toISOString().slice(0, 10), monto_usd: cs.senaPend, medio: S.draft.medio_pago || '', nota: 'Seña' }); S.dirty = true; refrescarPanel(); } break;
      case 'guardar': guardar(); break;
      case 'borrar-pedido': borrarPedido(); break;
      case 'guardar-prov': guardarProv(); break;
      case 'papelera-prov': papeleraProv(); break;
      case 'ver-papelera': S.provPapelera = !S.provPapelera; pintar(); break;
      case 'ops-recargar': cargarOps(); if (S.vista === 'operaciones') { S.resumen = null; } pintar(); break;
      case 'nuevo-srv': abrirServicio(null); break;
      case 'cfg-abrir': abrirCfg(); break;
      case 'ir-cfg': S.vista = 'servicios'; pintar(); abrirCfg(); break;
      case 'cfg-simular': simularCfg(); break;
      case 'cfg-guardar': guardarCfg(); break;
      case 'cfg-hoy':
        fetch('/api/tasas', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
          var v = j && j.rates && Number(j.rates.BRL);
          if (!(v > 0) || !S.modal) return mensaje('No se pudo traer la cotización.', true);
          S.modal.hoy = v; S.modal.cotizacion = v; S.modal.fuente = 'exchangerate-api ' + new Date().toISOString().slice(0, 10); S.modal.st = null; abrirModal();
        }).catch(function () { mensaje('No se pudo traer la cotización.', true); });
        break;
      case 'sel-filtro': (S.srvVisibles || []).forEach(function (id) { var sv = S.ops.datos.servicios.filter(function (x) { return x.id === id; })[0]; if (sv && !sv.eliminado_at) S.srvSel[id] = 1; }); pintar(); break;
      case 'sel-limpiar': S.srvSel = {}; pintar(); break;
      case 'aj-abrir': S.modal = { tipo: 'ajuste', ids: Object.keys(S.srvSel), pct: '', entero: false }; abrirModal(); break;
      case 'aj-guardar': guardarAjuste(); break;
      case 'fotos-buscar': buscarFotos(); break;
      case 'foto-link': agregarFotoLink(); break;
      case 'ficha-traer': traerFicha(); break;
      case 'fotos-auto': fotosAuto(); break;
      case 'imp-reiniciar': S.imp = null; S.impHist = undefined; pintar(); break;
      case 'imp-previa': pedirPrevia(); break;
      case 'imp-columnas': S.imp.paso = 'columnas'; pintar(); break;
      case 'imp-confirmar': confirmarImport(); break;
      case 'imp-errores': descargarCSV('errores-importacion.csv', [['Fila', 'Servicio', 'Proveedor', 'Error']].concat(S.imp.previa.filas.filter(function (r) { return r.accion === 'error'; }).map(function (r) { return [r.n, r.titulo, r.operador, r.errores.join(' · ')]; }))); break;
      case 'srv-guardar': guardarSrv(false); break;
      case 'srv-publicar': guardarSrv(true); break;
      case 'pub-sel': if (confirm('¿Publicar ' + Object.keys(S.sel).length + ' cambio(s)? Se ven en la web en hasta 1 minuto.')) publicarCambios(Object.keys(S.sel)); break;
      case 'desc-sel': descartarCambios(Object.keys(S.sel)); break;
      case 'sel-todos': var todos = S.pubVisibles || [], ya = Object.keys(S.sel).length === todos.length; S.sel = {}; if (!ya) todos.forEach(function (id) { S.sel[id] = 1; }); pintar(); break;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'chat-txt' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var f = document.getElementById('chat-form'); if (f) f.requestSubmit(); return; } if (e.key === 'Escape' && document.getElementById('drawer')) cerrarPanel(false); });

  /* ---------- arranque ---------- */
  var vq = /[?&]vista=(operaciones|servicios|publicar|proveedores|importar)(?:&|$)/.exec(location.search); if (vq) S.vista = vq[1];
  api('sesion').then(function (s) {
    if (!s.configurado) { app.innerHTML = '<div class="login"><div class="sec"><h1 style="margin:0 0 8px;font-size:18px">Panel sin configurar</h1><p class="sub">Definí las variables ADMIN_USER y ADMIN_PASS en el servidor (y reiniciá) para activar el panel.</p></div></div>'; return; }
    if (s.activo) cargar(); else pintarLogin();
  }).catch(function () { pintarLogin('No se pudo conectar con el servidor.'); });
})();
