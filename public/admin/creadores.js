/* Marketing > Creadores del panel /admin: los creadores que aceptaron la colaboracion (socios), su link, lo que
   trajeron y lo que se les debe.

   - Socio = contacto de tipo creador con estado 'acepto' (Marketing > Contactos). Lo suyo se guarda en lib/marketing.js:
     codigo y comision en el contacto; pagos y asignados aparte.
   - Su link: cuantosale.uy/?utm_source=creador-<codigo>. La web lo recuerda 30 dias (home-track.js) y el pedido queda
     con origen "web:creador-<codigo>". Los que reservaron sin el link (WhatsApp, "me dijo el codigo") se asignan a mano.
   - Comision: % de lo vendido en el pedido (traslados y paseos no cancelados). Se gana con el pedido confirmado o
     completado; mientras esta nuevo o en gestion queda "en camino". Cancelado no suma.
   - Visitas: los eventos 'llegada' de lib/uso.js (90 dias) con su fuente.

   Lo carga admin.js (vistaMkt) la primera vez que se abre la pestana. */
(function () {
  var ESTADO_PED = { nuevo: 'Nuevo', en_gestion: 'En gestión', confirmado: 'Confirmado', completado: 'Completado', cancelado: 'Cancelado' };
  var COMISION = 6;   // % por defecto: la mitad del margen general (15 % sobre el costo = ~13 % del precio) es ~6,5 %

  window.CSCreadoresPanel = function (ctx) {
    var S = ctx.S, esc = ctx.esc, usd = ctx.usd;
    var st = { abierto: {}, pagando: '', mensajes: {} };

    function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
    function estado() { return S.mkt.estado; }
    function link(c) { return 'https://cuantosale.uy/?utm_source=creador-' + c.codigo; }
    function codigoDe(c) {
      var base = String(c.dato || c.medio || '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]/g, '').slice(0, 16);
      return base.length >= 2 ? base : 'creador' + Date.now().toString(36).slice(-4);
    }
    function iniciales(t) {
      var p = String(t || '?').replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
      return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    }
    function fechaCorta(f) { return f ? f.slice(8, 10) + '/' + f.slice(5, 7) : ''; }
    function diaUY(iso) { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Montevideo' }); }

    /* Lo vendido de un pedido para la comision: los items que siguen en pie. */
    function vendido(p) {
      if (p.estado === 'cancelado') return 0;
      return r2((p.items || []).reduce(function (t, i) { return t + (i.estado === 'cancelado' ? 0 : Number(i.precio_usd) || 0); }, 0));
    }
    function socios() { return ctx.contactos().filter(function (c) { return c.tipo === 'creador' && c.estado === 'acepto'; }); }

    /* Todo lo de cada socio: sus pedidos (por link o asignados), visitas, ganado, pagado y lo que se le debe. */
    function cuentas() {
      var ss = socios(), porCodigo = {}, porId = {}, asig = estado().asignados || {}, pagos = estado().pagos || {};
      ss.forEach(function (c) {
        var x = { c: c, pedidos: [], visitas: 0, vendido: 0, ganado: 0, enCamino: 0, confirmados: 0, pagos: pagos[c.id] || [] };
        porId[c.id] = x; if (c.codigo) porCodigo['creador-' + c.codigo] = x;
      });
      ((S.datos && S.datos.pedidos) || []).forEach(function (p) {
        var m = /^web:(.+)$/.exec(p.origen || ''), x = asig[p.id] ? porId[asig[p.id]] : m && porCodigo[m[1]];
        if (!x) return;
        var pct = Number(x.c.comision === '' || x.c.comision == null ? COMISION : x.c.comision) || 0;
        var v = vendido(p), com = r2(v * pct / 100), ok = p.estado === 'confirmado' || p.estado === 'completado';
        x.pedidos.push({ p: p, vendido: v, com: com, ok: ok, aMano: !!asig[p.id] });
        if (ok) { x.vendido = r2(x.vendido + v); x.ganado = r2(x.ganado + com); x.confirmados++; }
        else if (p.estado !== 'cancelado') x.enCamino = r2(x.enCamino + com);
      });
      ((S.mktUso && S.mktUso.filas) || []).forEach(function (f) { if (f.evento === 'llegada' && porCodigo[f.detalle]) porCodigo[f.detalle].visitas += f.n; });
      ss.forEach(function (c) {
        var x = porId[c.id];
        x.pagado = r2(x.pagos.reduce(function (t, y) { return t + (Number(y.monto) || 0); }, 0));
        x.debe = r2(Math.max(0, x.ganado - x.pagado));
        x.pedidos.sort(function (a, b) { return String(b.p.created_at).localeCompare(String(a.p.created_at)); });
      });
      return ss.map(function (c) { return porId[c.id]; });
    }

    /* El mensaje para mandarle al que acepta: su link, su codigo y como cobra. */
    function bienvenida(c) {
      var pct = String(c.comision === '' || c.comision == null ? COMISION : c.comision).replace('.', ',');
      return '¡Buenísimo! Qué alegría que se sumen 🙌\n\nEste es su link: ' + link(c) + '\n\n' +
        'Cualquiera que entre por ahí queda registrado 30 días: si reserva un traslado o un paseo en ese tiempo, les suma el ' + pct + ' % de lo que reserve. ' +
        'Si alguien prefiere escribirnos por WhatsApp, que nos diga el código ' + c.codigo.toUpperCase() + ' y se lo contamos igual.\n\n' +
        'Les pagamos por Pix o transferencia cuando el viaje queda confirmado, y les vamos pasando cómo viene. Cualquier cosa, acá estamos.\n\nCuánto Sale';
    }

    function tarjeta(x) {
      var c = x.c, abierto = st.abierto[c.id], ig = String(c.dato || '').replace(/^@/, '');
      var a = function (campo) { return ' data-cr-id="' + esc(c.id) + '" data-cr-campo="' + campo + '"'; };
      var h = '<article class="cr">' +
        '<header class="cr__cab"><span class="cr__av">' + esc(iniciales(c.medio)) + '</span><div class="cr__nom"><h3>' + esc(c.medio || 'Creador') + '</h3>' +
        (ig ? '<a href="https://www.instagram.com/' + encodeURIComponent(ig) + '/" target="_blank" rel="noopener">@' + esc(ig) + '</a>' : '') + '</div>' +
        '<span class="cr__socio">Socio' + (c.fecha ? ' desde ' + esc(fechaCorta(c.fecha)) : '') + '</span></header>';
      if (!c.codigo) {
        return h + '<div class="cr__falta"><p>Le falta el código para armar su link.</p><button class="btn btn--sm" data-cr-codigo="' + esc(c.id) + '">Crear código «' + esc(codigoDe(c)) + '»</button></div></article>';
      }
      h += '<div class="cr__link"><code>' + esc(link(c).replace('https://', '')) + '</code><button class="btn btn--sm" data-cr-copiar="link:' + esc(c.id) + '">Copiar link</button></div>' +
        '<div class="cr__stats">' +
        '<div><b>' + x.visitas + '</b><small>visitas</small></div>' +
        '<div><b>' + x.confirmados + '<i>/' + x.pedidos.length + '</i></b><small>confirmados / pedidos</small></div>' +
        '<div><b>' + esc(usd(x.vendido)) + '</b><small>vendido</small></div>' +
        '<div><b>' + esc(usd(x.ganado)) + '</b><small>ganó</small></div></div>' +
        '<div class="cr__plata' + (x.debe ? ' cr__plata--debe' : '') + '"><div><small>A pagarle</small><b>' + esc(usd(x.debe)) + '</b>' +
        '<em>' + (x.pagado ? 'ya le pagaste ' + esc(usd(x.pagado)) : 'todavía no le pagaste nada') + (x.enCamino ? ' · ' + esc(usd(x.enCamino)) + ' en camino' : '') + '</em></div>' +
        (st.pagando === c.id ? '' : '<button class="btn' + (x.debe ? ' btn--pri' : ' btn--sm') + '" data-cr-pagar="' + esc(c.id) + '">Registrar pago</button>') + '</div>';
      if (st.pagando === c.id) {
        h += '<form class="cr__pago" data-cr-pago-form="' + esc(c.id) + '"><label class="f">Monto (US$)<input name="monto" inputmode="decimal" value="' + (x.debe || '') + '" required></label>' +
          '<label class="f">Fecha<input name="fecha" type="date" value="' + esc(ctx.hoy()) + '"></label><label class="f">Cómo<input name="nota" value="Pix" placeholder="Pix, transferencia…"></label>' +
          '<div class="cr__pago-acc"><button class="btn btn--pri" type="submit">Guardar pago</button><button class="btn" type="button" data-cr-pagar="">Cancelar</button></div></form>';
      }
      h += '<div class="cr__ajustes"><label class="f">Código<input' + a('codigo') + ' value="' + esc(c.codigo) + '" maxlength="16"></label>' +
        '<label class="f">Comisión<span class="cr__pct"><input' + a('comision') + ' inputmode="decimal" value="' + esc(c.comision === '' || c.comision == null ? COMISION : c.comision) + '"><span>%</span></span></label>' +
        '<button class="btn btn--sm" data-cr-copiar="msj:' + esc(c.id) + '" title="Copia el mensaje con su link, su código y cómo cobra">Copiar mensaje de bienvenida</button></div>';
      h += '<button class="cr__mas" data-cr-abrir="' + esc(c.id) + '" aria-expanded="' + !!abierto + '">' + (abierto ? 'Ocultar' : 'Ver') + ' pedidos (' + x.pedidos.length + ') y pagos (' + x.pagos.length + ')</button>';
      if (abierto) {
        h += x.pedidos.length ? '<table class="cr__tabla"><thead><tr><th>Pedido</th><th>Estado</th><th class="num">Vendido</th><th class="num">Comisión</th></tr></thead><tbody>' + x.pedidos.map(function (y) {
          return '<tr' + (y.p.estado === 'cancelado' ? ' class="cr__tachado"' : '') + '><td><b>' + esc(y.p.ref || '') + '</b><span class="sub">' + esc(fechaCorta(diaUY(y.p.created_at))) + ' · ' + esc(y.p.destino || '') +
            (y.aMano ? ' · asignado a mano <button class="cr__x" data-cr-desasignar="' + esc(y.p.id) + '" title="Quitarle este pedido">×</button>' : '') + '</span></td>' +
            '<td><span class="pill p-' + esc(y.p.estado) + '">' + esc(ESTADO_PED[y.p.estado] || y.p.estado) + '</span></td><td class="num">' + esc(usd(y.vendido)) + '</td><td class="num">' + (y.ok ? '<b>' + esc(usd(y.com)) + '</b>' : '<span class="sub">' + esc(usd(y.com)) + '</span>') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="sub">Todavía ningún pedido con su link. Si alguien reservó por WhatsApp y dijo su código, asignáselo abajo.</p>';
        if (x.pagos.length) h += '<ul class="cr__pagos">' + x.pagos.map(function (y, n) {
          return '<li><span>' + esc(fechaCorta(y.fecha)) + ' · ' + esc(y.nota || 'pago') + '</span><b>' + esc(usd(y.monto)) + '</b><button class="cr__x" data-cr-borrar-pago="' + esc(c.id) + ':' + n + '" title="Borrar este pago">×</button></li>';
        }).join('') + '</ul>';
      }
      return h + '</article>';
    }

    function vista() {
      var xs = cuentas(), sum = function (k) { return r2(xs.reduce(function (t, x) { return t + x[k]; }, 0)); };
      st.mensajes = {}; xs.forEach(function (x) { if (x.c.codigo) st.mensajes[x.c.id] = { link: link(x.c), msj: bienvenida(x.c) }; });
      var h = '<div class="vhead"><div><h2>Creadores</h2><p>Los que aceptaron la colaboración: su link, lo que trajeron y lo que les debés. Se gana la comisión cuando el pedido queda confirmado.</p></div></div>';
      h += '<section class="kpis kpis--4">' + ctx.kpi('Socios', xs.length, xs.length === 1 ? 'creador con link' : 'creadores con link') +
        ctx.kpi('Visitas con su link', sum('visitas'), 'últimos 90 días') +
        ctx.kpi('Pedidos', xs.reduce(function (t, x) { return t + x.pedidos.length; }, 0), xs.reduce(function (t, x) { return t + x.confirmados; }, 0) + ' confirmados · ' + usd(sum('vendido')) + ' vendido') +
        ctx.kpi('A pagar', usd(sum('debe')), sum('pagado') ? 'ya pagaste ' + usd(sum('pagado')) : 'comisiones ganadas sin pagar', sum('debe') ? 'kpi--warn' : '') + '</section>';

      /* Los que respondieron: un toque para pasarlos a socios. */
      var resp = ctx.contactos().filter(function (c) { return c.tipo === 'creador' && c.estado === 'respondio'; });
      if (resp.length) {
        h += '<section class="cr-resp"><div><h3>Respondieron · ¿aceptaron?</h3><p class="sub">Cuando te digan que sí, pasalos a socios: se les arma el código y el link.</p></div><ul>' + resp.map(function (c) {
          return '<li><span class="cr__av cr__av--sm">' + esc(iniciales(c.medio)) + '</span><span class="cr-resp__nom">' + esc(c.medio || c.dato || 'Creador') + '</span>' +
            '<button class="btn btn--sm btn--pri" data-cr-socio="' + esc(c.id) + '">Aceptó · hacer socio</button></li>';
        }).join('') + '</ul></section>';
      }
      if (!xs.length) {
        return h + '<div class="cr-vacio"><b>Todavía no hay socios.</b><p>Cuando un creador acepte, marcalo arriba con «Aceptó · hacer socio» (o en Contactos, con el estado «Aceptó · socio»). Le armamos el link, el código y el mensaje para mandarle.</p></div>';
      }
      h += '<div class="cr-grid">' + xs.map(tarjeta).join('') + '</div>';

      /* Asignar a mano: pedidos sin link de creador. */
      var asig = estado().asignados || {}, conLink = function (p) { return /^web:creador-/.test(p.origen || ''); };
      var libres = ((S.datos && S.datos.pedidos) || []).filter(function (p) { return !asig[p.id] && !conLink(p) && p.estado !== 'cancelado'; })
        .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); }).slice(0, 60);
      h += '<section class="sec cr-asig"><h3>¿Reservó alguien de parte de un creador, sin el link?</h3><p class="sub">Por ejemplo, te escribió por WhatsApp y dijo el código. Asignale el pedido y la comisión se le cuenta igual.</p>' +
        '<form class="cr-asig__f" data-cr-asignar><select name="pedido" required><option value="">Elegí el pedido…</option>' + libres.map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc((p.ref || '') + ' · ' + (p.cliente_nombre || 'sin nombre') + ' · ' + (p.destino || '') + ' · ' + fechaCorta(diaUY(p.created_at))) + '</option>';
        }).join('') + '</select><select name="creador" required>' + xs.map(function (x) { return '<option value="' + esc(x.c.id) + '">' + esc(x.c.medio || x.c.codigo) + '</option>'; }).join('') + '</select>' +
        '<button class="btn btn--pri" type="submit">Asignar</button></form></section>';
      return h;
    }

    function guardar(cuerpo) { return ctx.guardarMkt(cuerpo).then(function () { ctx.pintar(); }); }
    function hacerSocio(id) {
      var c = ctx.contactos().filter(function (x) { return x.id === id; })[0]; if (!c) return;
      var usados = {}; socios().forEach(function (x) { if (x.codigo) usados[x.codigo] = 1; });
      var cod = c.codigo || codigoDe(c), n = 2; while (usados[cod]) cod = cod.slice(0, 14) + n++;
      guardar({ contacto: { id: id, campos: { estado: 'acepto', codigo: cod, comision: c.comision || String(COMISION), fecha: ctx.hoy() } } }).then(function () { ctx.toast('Listo: ya es socio. Copiale el mensaje de bienvenida.'); });
    }

    /* ---------- eventos (solo los controles de esta pestana) ---------- */
    function aqui() { return S.vista === 'mkt-creadores'; }
    document.addEventListener('click', function (e) {
      if (!aqui()) return;
      var t = e.target.closest('[data-cr-socio],[data-cr-codigo],[data-cr-copiar],[data-cr-pagar],[data-cr-abrir],[data-cr-borrar-pago],[data-cr-desasignar]');
      if (!t) return;
      e.preventDefault();
      if (t.hasAttribute('data-cr-socio')) return hacerSocio(t.getAttribute('data-cr-socio'));
      if (t.hasAttribute('data-cr-codigo')) return hacerSocio(t.getAttribute('data-cr-codigo'));
      if (t.hasAttribute('data-cr-copiar')) { var p = t.getAttribute('data-cr-copiar').split(':'), m = st.mensajes[p[1]]; if (m) ctx.copiar(p[0] === 'link' ? m.link : m.msj); return; }
      if (t.hasAttribute('data-cr-pagar')) { st.pagando = t.getAttribute('data-cr-pagar'); ctx.pintar(); return; }
      if (t.hasAttribute('data-cr-abrir')) { var id = t.getAttribute('data-cr-abrir'); st.abierto[id] = !st.abierto[id]; ctx.pintar(); return; }
      if (t.hasAttribute('data-cr-borrar-pago')) {
        var q = t.getAttribute('data-cr-borrar-pago').split(':');
        if (confirm('¿Borrar este pago?')) guardar({ pagoBorrar: { id: q[0], n: +q[1] } });
        return;
      }
      if (t.hasAttribute('data-cr-desasignar') && confirm('¿Quitarle este pedido al creador?')) guardar({ asignar: { pedido: t.getAttribute('data-cr-desasignar'), creador: '' } });
    });
    document.addEventListener('submit', function (e) {
      if (!aqui()) return;
      var f = e.target;
      if (f.hasAttribute('data-cr-pago-form')) {
        e.preventDefault();
        var id = f.getAttribute('data-cr-pago-form');
        ctx.guardarMkt({ pago: { id: id, monto: f.monto.value, fecha: f.fecha.value, nota: f.nota.value } }).then(function () { st.pagando = ''; st.abierto[id] = true; ctx.pintar(); });
      } else if (f.hasAttribute('data-cr-asignar')) {
        e.preventDefault();
        guardar({ asignar: { pedido: f.pedido.value, creador: f.creador.value } }).then(function () { ctx.toast('Pedido asignado'); });
      }
    });
    document.addEventListener('change', function (e) {
      if (!aqui()) return;
      var el = e.target, id = el.getAttribute && el.getAttribute('data-cr-id');
      if (!id) return;
      var campo = el.getAttribute('data-cr-campo'), v = String(el.value).trim();
      if (campo === 'codigo') v = v.toLowerCase();
      if (campo === 'comision') v = v.replace(',', '.');
      var campos = {}; campos[campo] = v;
      guardar({ contacto: { id: id, campos: campos } });
    });

    /* estilos propios de la pestana */
    if (!document.getElementById('cr-css')) {
      var css = document.createElement('style'); css.id = 'cr-css';
      css.textContent =
        '.cr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:16px;margin:18px 0 24px;align-items:start}' +
        '.cr{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0}' +
        '.cr__cab{display:flex;align-items:center;gap:12px}.cr__nom{flex:1;min-width:0}.cr__nom h3{margin:0;font-size:16.5px;line-height:1.25}' +
        '.cr__nom a{color:var(--muted);font-size:13.5px;text-decoration:none}.cr__nom a:hover{text-decoration:underline}' +
        '.cr__av{flex:none;width:46px;height:46px;border-radius:50%;background:var(--accent);color:#0A101A;display:grid;place-items:center;font-weight:800;font-size:16px;letter-spacing:.5px}' +
        '.cr__av--sm{width:32px;height:32px;font-size:12.5px}' +
        '.cr__socio{flex:none;background:var(--okbg);color:var(--ok);border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700}' +
        '.cr__link{display:flex;align-items:center;gap:8px;background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:8px 8px 8px 12px}' +
        '.cr__link code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}' +
        '.cr__stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}' +
        '.cr__stats div{background:var(--card);padding:10px 8px;text-align:center}.cr__stats b{display:block;font-size:18px;font-variant-numeric:tabular-nums}' +
        '.cr__stats b i{font-style:normal;color:var(--muted);font-weight:500;font-size:14px}.cr__stats small{color:var(--muted);font-size:11.5px;line-height:1.2;display:block}' +
        '.cr__plata{display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:14px;padding:12px 14px;background:var(--bg)}' +
        '.cr__plata small{display:block;color:var(--muted);font-size:12.5px;font-weight:600}.cr__plata b{display:block;font-size:24px;font-variant-numeric:tabular-nums}' +
        '.cr__plata em{font-style:normal;font-size:12.5px;color:var(--muted)}' +
        '.cr__plata--debe{background:var(--warnbg)}.cr__plata--debe b{color:var(--warn)}' +
        '.btn--pri{background:var(--brand);color:#fff;border-color:var(--brand)}' +
        '.cr__pago{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;align-items:end;border:1px solid var(--line);border-radius:12px;padding:12px}' +
        '.cr__pago-acc{display:flex;gap:6px;grid-column:1/-1}' +
        '.cr__ajustes{display:grid;grid-template-columns:1fr 92px;gap:8px;align-items:end}.cr__ajustes .btn{grid-column:1/-1}' +
        '.cr__pct{display:flex;align-items:center;gap:4px}.cr__pct span{color:var(--muted);font-weight:600}' +
        '.cr__mas{background:none;border:0;border-top:1px solid var(--line);padding:10px 0 0;color:var(--info);font-weight:600;text-align:left;cursor:pointer;font-size:13.5px}' +
        '.cr__tabla{width:100%;font-size:13.5px}.cr__tabla .sub{display:block}.cr__tachado td{opacity:.55;text-decoration:line-through}' +
        '.cr__pagos{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}' +
        '.cr__pagos li{display:flex;align-items:center;gap:8px;font-size:13.5px;padding:6px 10px;border-radius:9px;background:var(--okbg)}.cr__pagos li span{flex:1}' +
        '.cr__x{background:none;border:0;color:var(--muted);font-size:16px;line-height:1;cursor:pointer;padding:0 4px}.cr__x:hover{color:var(--bad)}' +
        '.cr__falta{background:var(--warnbg);border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.cr__falta p{margin:0}' +
        '.cr-resp{display:flex;gap:14px 24px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-top:16px;background:var(--infobg);border-radius:16px;padding:14px 18px}' +
        '.cr-resp h3{margin:0}.cr-resp .sub{margin:2px 0 0}.cr-resp ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}' +
        '.cr-resp li{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:12px;padding:6px 6px 6px 8px}.cr-resp__nom{flex:1;font-weight:600;min-width:120px}' +
        '.cr-vacio{margin-top:18px;border:2px dashed var(--line);border-radius:18px;padding:28px;text-align:center;color:var(--muted)}.cr-vacio b{color:var(--ink);font-size:16px}' +
        '.cr-asig__f{display:flex;gap:8px;flex-wrap:wrap}.cr-asig__f select{flex:1 1 220px;width:auto}' +
        '@media (max-width:560px){.cr{padding:14px}.cr__stats{grid-template-columns:repeat(2,1fr)}.cr__plata{flex-wrap:wrap}.cr__plata .btn{width:100%}.cr-resp li{flex-wrap:wrap}.cr-resp li .btn{width:100%}}';
      document.head.appendChild(css);
    }
    return { vista: vista };
  };
})();
