/* Panel /admin de CuántoSale. Habla solo con /api/admin/* (lib/admin.js). */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var ESTADOS = { nuevo: 'Nuevo', en_gestion: 'En gestión', confirmado: 'Confirmado', completado: 'Completado', cancelado: 'Cancelado' };
  var ESTADOS_ITEM = { pendiente: 'Pendiente', consultado: 'Consultado al proveedor', confirmado: 'Confirmado', cancelado: 'Cancelado' };
  var TIPOS = { traslado: 'Traslado', tour: 'Tour / actividad', vuelo: 'Vuelo', alojamiento: 'Alojamiento', otro: 'Otro' };
  var PAGO = { sin_pago: 'Sin pago', parcial: 'Pago parcial', pagado: 'Pagado' };
  var S = { vista: 'pedidos', filtro: 'todos', q: '', soloDeuda: false, datos: null, draft: null, dirty: false, prov: null, msg: '', cargando: false };

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
    L.push('*Total estimado:* ' + usd(calc(p).total), '', 'Te confirmamos disponibilidad y, una vez confirmado, te enviamos el link de pago.', 'Ref: ' + (p.ref || ''));
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
    return { total: total, cobrado: cobrado, saldo: canc ? 0 : r2(Math.max(0, total - cobrado)), costo: costo, aPagar: canc ? 0 : r2(Math.max(0, costo - pagProv)), margen: r2(total - costo) };
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
      '<button class="tab" role="tab" data-vista="mensajes" aria-selected="' + (S.vista === 'mensajes') + '">Mensajes<span id="tab-noleidos">' + (S.chats && S.chats.no_leidos ? ' (' + S.chats.no_leidos + ')' : '') + '</span></button>' +
      '<button class="tab" role="tab" data-vista="whatsapp" aria-selected="' + (S.vista === 'whatsapp') + '">WhatsApp</button></nav>' +
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
    html += S.vista === 'pedidos' ? vistaPedidos(d, cuenta) : (S.vista === 'whatsapp' ? vistaWhatsapp() : (S.vista === 'mensajes' ? vistaMensajes() : vistaProveedores(d)));
    html += '</div>';
    app.innerHTML = html;
    if (S.draft) abrirPanel();
    else if (S.prov) abrirProv();
  }
  function kpi(t, v, sub, cls) { return '<div class="kpi ' + (cls || '') + '"><small>' + esc(t) + '</small><b>' + esc(v) + '</b><em>' + esc(sub) + '</em></div>'; }

  function pintarLogin(err) {
    app.innerHTML = '<div class="login"><form id="login" autocomplete="on"><h1>Panel de CuántoSale</h1><p>Entrá con tu usuario y contraseña.</p>' +
      '<label class="f">Usuario<input name="user" autocomplete="username" required autofocus></label>' +
      '<label class="f">Contraseña<input name="pass" type="password" autocomplete="current-password" required></label>' +
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
  function vistaProveedores(d) {
    var h = '<div class="bar"><div class="chips"><b>Proveedores a los que tercerizás</b></div><button class="btn btn--main" data-act="nuevo-prov">+ Proveedor</button></div>';
    if (!d.proveedores.length) return h + '<div class="card"><p class="vacio">Todavía no cargaste proveedores. Agregalos para asignarlos a cada servicio y llevar lo que les debés.</p></div>';
    h += '<div class="card"><table><thead><tr><th>Proveedor</th><th>Contacto</th><th>Hace</th><th>Datos de pago</th><th class="num">Servicios activos</th><th class="num">Le debemos</th></tr></thead><tbody>';
    d.proveedores.forEach(function (pr) {
      var dp = deudaProveedor(pr.id);
      h += '<tr class="row" data-prov="' + esc(pr.id) + '"><td data-l="Proveedor"><b>' + esc(pr.nombre) + '</b>' + (pr.activo === false ? ' <span class="pill p-cancelado">inactivo</span>' : '') + '</td>' +
        '<td data-l="Contacto">' + esc(pr.contacto) + '<span class="sub">' + esc(pr.telefono) + (pr.email ? ' · ' + esc(pr.email) : '') + '</span></td>' +
        '<td data-l="Hace">' + esc(pr.servicios) + '</td><td data-l="Datos de pago">' + esc(pr.datos_pago) + '</td>' +
        '<td class="num" data-l="Servicios">' + dp.servicios + '<span class="sub">en ' + dp.pedidos + ' pedido(s)</span></td>' +
        '<td class="num" data-l="Le debemos">' + (dp.aPagar ? '<span class="deuda">' + usd(dp.aPagar) + '</span>' : '<span class="ok">al día</span>') + '</td></tr>';
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
    return '<div class="chat' + (S.chatTel ? ' con-chat' : '') + '"><div class="chat-lista" id="chat-lista">' + listaChatsHtml() + '</div>' +
      '<div class="chat-conv">' + (S.chatTel ? '<div id="chat-cab">' + cabeceraChatHtml() + '</div>' : '') + '<div class="chat-msgs" id="chat-msgs">' + mensajesHtml() + '</div>' +
      (S.chatTel ? '<div id="chat-caja">' + cajaHtml() + '</div>' : '') + '</div></div>';
  }
  function abajo() { var m = document.getElementById('chat-msgs'); if (m) m.scrollTop = m.scrollHeight; }
  function refrescarMensajes(irAbajo) {
    var tab = document.getElementById('tab-noleidos'); if (tab) tab.textContent = S.chats && S.chats.no_leidos ? ' (' + S.chats.no_leidos + ')' : '';
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
  function provOpts(sel) {
    return '<option value="">— Sin asignar —</option>' + S.datos.proveedores.filter(function (p) { return p.activo !== false || p.id === sel; }).map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nombre) + '</option>';
    }).join('');
  }
  function cuentasHtml(p) {
    var c = calc(p);
    return [['Total del cliente', c.total], ['Cobrado', c.cobrado], ['Saldo del cliente', c.saldo], ['Costo proveedores', c.costo], ['A pagar a proveedores', c.aPagar], ['Margen', c.margen]]
      .map(function (x) { return '<div><small>' + x[0] + '</small><b' + ((x[0] === 'Saldo del cliente' || x[0] === 'A pagar a proveedores') && x[1] ? ' class="deuda"' : '') + '>' + usd(x[1]) + '</b></div>'; }).join('');
  }
  function itemHtml(it, i) {
    var pr = S.datos.proveedores.filter(function (x) { return x.id === it.proveedor_id; })[0];
    var msgProv = 'Hola' + (pr && pr.contacto ? ' ' + pr.contacto : '') + '! Te consulto disponibilidad para: ' + it.nombre + (it.detalle ? ' (' + it.detalle + ')' : '') +
      '. Fecha: ' + fecha(S.draft.fecha_ida) + (S.draft.fecha_vuelta ? ' al ' + fecha(S.draft.fecha_vuelta) : '') + '. Pasajeros: ' + S.draft.personas + '. A nombre de ' + S.draft.cliente_nombre + '. Ref ' + S.draft.ref + '. ¡Gracias!';
    var f = function (campo, tipo, extra) { return 'data-i="' + i + '" data-f="' + campo + '"' + (tipo ? ' type="' + tipo + '"' : '') + (extra || ''); };
    return '<div class="item"><div class="item__top"><input ' + f('nombre') + ' value="' + esc(it.nombre) + '" placeholder="Servicio (ej. Traslado aeropuerto – hotel)" aria-label="Servicio">' +
      '<button type="button" class="btn btn--sm btn--danger" data-quitar-item="' + i + '" aria-label="Quitar servicio">✕</button></div>' +
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
      '<button type="button" class="btn btn--sm btn--danger" data-quitar-pago="' + i + '" aria-label="Quitar cobro">✕</button></div>';
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
      '<div class="foot"><span class="msg" id="foot-msg" role="status"></span><button class="btn" data-act="cerrar">Cancelar</button><button class="btn btn--main" data-act="guardar">' + (esNuevo ? 'Crear pedido' : 'Guardar cambios') + '</button></div></div>';
  }
  function refrescarPanel() {
    var y = (document.querySelector('#drawer .panel') || {}).scrollTop || 0;
    abrirPanel();
    var pn = document.querySelector('#drawer .panel'); if (pn) pn.scrollTop = y;
  }
  function cerrarPanel(forzar) {
    if (!forzar && S.dirty && !confirm('Tenés cambios sin guardar. ¿Cerrar igual?')) return;
    S.draft = null; S.prov = null; S.dirty = false;
    var el = document.getElementById('drawer'); if (el) el.remove();
  }

  /* ---------- proveedor ---------- */
  function abrirProv() {
    var p = S.prov, el = document.getElementById('drawer');
    if (!el) { el = document.createElement('div'); el.id = 'drawer'; el.className = 'drawer'; document.body.appendChild(el); }
    var dp = p.id ? deudaProveedor(p.id) : null;
    var f = function (campo) { return 'data-pf="' + campo + '"'; };
    el.innerHTML = '<div class="panel" role="dialog" aria-modal="true" style="width:min(560px,100%)"><div class="panel__head"><h2>' + esc(p.id ? p.nombre : 'Nuevo proveedor') + '</h2><button class="btn btn--sm" data-act="cerrar">Cerrar</button></div>' +
      '<div class="panel__body"><section class="sec"><div class="grid" style="grid-template-columns:1fr">' +
      '<label class="f">Nombre / empresa<input ' + f('nombre') + ' value="' + esc(p.nombre) + '"></label>' +
      '<label class="f">Persona de contacto<input ' + f('contacto') + ' value="' + esc(p.contacto) + '"></label>' +
      '<label class="f">Teléfono / WhatsApp (con código de país)<input ' + f('telefono') + ' value="' + esc(p.telefono) + '" inputmode="tel" placeholder="5989XXXXXXX"></label>' +
      '<label class="f">Email<input ' + f('email') + ' value="' + esc(p.email) + '"></label>' +
      '<label class="f">Qué servicios hace<input ' + f('servicios') + ' value="' + esc(p.servicios) + '" placeholder="Traslados Florianópolis, tours en buggy…"></label>' +
      '<label class="f">Datos para pagarle (cuenta, alias, Pix)<textarea ' + f('datos_pago') + '>' + esc(p.datos_pago) + '</textarea></label>' +
      '<label class="f">Notas<textarea ' + f('notas') + '>' + esc(p.notas) + '</textarea></label>' +
      '<label class="f" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-pf="activo" style="width:auto;min-height:0"' + (p.activo === false ? '' : ' checked') + '> Activo (aparece al asignar servicios)</label></div>' +
      (dp ? '<p class="sub" style="margin-top:10px">' + dp.servicios + ' servicio(s) en ' + dp.pedidos + ' pedido(s). Le debemos: <b class="' + (dp.aPagar ? 'deuda' : 'ok') + '">' + usd(dp.aPagar) + '</b></p>' : '') + '</section></div>' +
      '<div class="foot"><span class="msg" id="foot-msg" role="status"></span><button class="btn" data-act="cerrar">Cancelar</button><button class="btn btn--main" data-act="guardar-prov">Guardar proveedor</button></div></div>';
  }

  /* ---------- acciones ---------- */
  function cargar() {
    S.cargando = true;
    return api('datos').then(function (d) { S.datos = d; S.cargando = false; cargarChats(); if (!S.draft && !S.prov) pintar(); else pintarFondo(); }).catch(function (e) {
      S.cargando = false; if (e.status !== 401) { app.innerHTML = '<p class="vacio">No se pudo cargar: ' + esc(e.message) + ' <button class="btn" data-act="recargar">Reintentar</button></p>'; }
    });
  }
  /* Repinta el tablero sin tocar el panel abierto. */
  function pintarFondo() { var dr = document.getElementById('drawer'), draft = S.draft, prov = S.prov; S.draft = null; S.prov = null; pintar(); S.draft = draft; S.prov = prov; if (dr && !document.getElementById('drawer')) document.body.appendChild(dr); }
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
  function guardarProv() {
    var p = S.prov;
    if (!p.nombre || p.nombre.trim().length < 2) return mensaje('Escribí el nombre del proveedor.', true);
    mensaje('Guardando…');
    api('proveedor/guardar', p).then(function () { toast('Proveedor guardado'); cerrarPanel(true); return cargar(); }).catch(function (e) { mensaje(e.message, true); });
  }
  function abrir(id) {
    var p = S.datos.pedidos.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    S.draft = JSON.parse(JSON.stringify(p)); S.dirty = false; abrirPanel();
  }
  function nuevoProveedor() { return { id: null, nombre: '', contacto: '', telefono: '', email: '', servicios: '', datos_pago: '', notas: '', activo: true }; }

  /* ---------- eventos ---------- */
  function valor(el) { return el.type === 'number' ? (el.value === '' ? 0 : parseFloat(el.value)) : el.value; }
  function alEditar(e) {
    var el = e.target;
    if (el.id === 'chat-txt') { S.borrador = el.value; return; }
    if (el.id === 'q') { S.q = el.value; var pos = el.selectionStart; pintar(); var q = document.getElementById('q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (er) { /* sin rango */ } } return; }
    if (el.matches && el.matches('[data-deuda]')) { S.soloDeuda = el.checked; pintar(); return; }
    if (el.hasAttribute('data-pf') && S.prov) { S.prov[el.getAttribute('data-pf')] = el.type === 'checkbox' ? el.checked : el.value; return; }
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
        .then(function () { cargarWa(); pintar(); toast(reg ? 'Número registrado' : 'Prueba enviada: revisá tu WhatsApp'); })
        .catch(function (er) { b.disabled = false; msg.style.color = 'var(--bad)'; msg.textContent = er.message; });
      return;
    }
    if (e.target.id !== 'login') return;
    e.preventDefault();
    var fd = new FormData(e.target), btn = e.target.querySelector('button');
    btn.disabled = true;
    api('login', { user: fd.get('user'), pass: fd.get('pass') }).then(function () { return cargar(); })
      .catch(function (er) { pintarLogin(er.message); });
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('a[href]')) return;   // los enlaces (WhatsApp, email) se abren solos, sin abrir el detalle
    var ch = e.target.closest('[data-chat]'); if (ch) { abrirChat(ch.getAttribute('data-chat')); return; }
    var ip = e.target.closest('[data-ir-pedido]'); if (ip) { S.vista = 'pedidos'; pintar(); abrir(ip.getAttribute('data-ir-pedido')); return; }
    var t = e.target.closest('[data-vista],[data-filtro],[data-abrir],[data-prov],[data-act],[data-quitar-item],[data-quitar-pago],[data-pagado-total]');
    if (!t) return;
    if (t.hasAttribute('data-vista')) { S.vista = t.getAttribute('data-vista'); pintar(); return; }
    if (t.hasAttribute('data-filtro')) { S.filtro = t.getAttribute('data-filtro'); pintar(); return; }
    if (t.hasAttribute('data-abrir')) { abrir(t.getAttribute('data-abrir')); return; }
    if (t.hasAttribute('data-prov')) { var id = t.getAttribute('data-prov'); S.prov = JSON.parse(JSON.stringify(S.datos.proveedores.filter(function (x) { return x.id === id; })[0])); S.dirty = false; abrirProv(); return; }
    if (t.hasAttribute('data-quitar-item')) { S.draft.items.splice(+t.getAttribute('data-quitar-item'), 1); S.dirty = true; refrescarPanel(); return; }
    if (t.hasAttribute('data-quitar-pago')) { S.draft.pagos.splice(+t.getAttribute('data-quitar-pago'), 1); S.dirty = true; refrescarPanel(); return; }
    if (t.hasAttribute('data-pagado-total')) { var it = S.draft.items[+t.getAttribute('data-pagado-total')]; it.pagado_proveedor_usd = it.costo_usd || 0; S.dirty = true; refrescarPanel(); return; }
    switch (t.getAttribute('data-act')) {
      case 'recargar': cargar(); break;
      case 'wa-recargar': cargarWa(); pintar(); break;
      case 'salir': api('logout', {}).then(function () { S.datos = null; cerrarPanel(true); pintarLogin(); }); break;
      case 'nuevo': S.draft = nuevoDraft(); S.dirty = false; abrirPanel(); break;
      case 'nuevo-prov': S.prov = nuevoProveedor(); S.dirty = false; abrirProv(); break;
      case 'cerrar': cerrarPanel(false); break;
      case 'add-item': S.draft.items.push(itemVacio()); S.dirty = true; refrescarPanel(); break;
      case 'add-pago': S.draft.pagos.push({ id: 'n' + Date.now(), fecha: new Date().toISOString().slice(0, 10), monto_usd: 0, medio: S.draft.medio_pago || '', nota: '' }); S.dirty = true; refrescarPanel(); break;
      case 'cobrar-saldo': var c = calc(S.draft); if (c.saldo > 0) { S.draft.pagos.push({ id: 'n' + Date.now(), fecha: new Date().toISOString().slice(0, 10), monto_usd: c.saldo, medio: S.draft.medio_pago || '', nota: 'Saldo' }); S.dirty = true; refrescarPanel(); } break;
      case 'guardar': guardar(); break;
      case 'guardar-prov': guardarProv(); break;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'chat-txt' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var f = document.getElementById('chat-form'); if (f) f.requestSubmit(); return; } if (e.key === 'Escape' && document.getElementById('drawer')) cerrarPanel(false); });

  /* ---------- arranque ---------- */
  api('sesion').then(function (s) {
    if (!s.configurado) { app.innerHTML = '<div class="login"><div class="sec"><h1 style="margin:0 0 8px;font-size:18px">Panel sin configurar</h1><p class="sub">Definí las variables ADMIN_USER y ADMIN_PASS en el servidor (y reiniciá) para activar el panel.</p></div></div>'; return; }
    if (s.activo) cargar(); else pintarLogin();
  }).catch(function () { pintarLogin('No se pudo conectar con el servidor.'); });
})();
