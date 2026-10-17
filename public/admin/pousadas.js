/* Marketing > Pousadas: la lista de pousadas a las que se les propone comision por recomendacion (el huesped paga
   directo a la pousada y la pousada le paga a CuantoSale la comision, con el codigo CUANTOSALE). Los datos vienen de
   pousadas-datos.js; aca se guarda solo lo que cambia de cada una (estado, WhatsApp, Instagram, email y nota), como
   contacto de Marketing de tipo 'pousada' (lib/marketing.js). Los mensajes van en portugues. */
(function () {
  var DESTINOS = { arraial: 'Arraial do Cabo', fln: 'Florianópolis', rio: 'Rio de Janeiro', porto: 'Porto de Galinhas' };
  var CATS = { economico: 'Económico', intermedio: 'Equilibrado', confort: 'Cómodo' };
  var ESTADOS = { pendiente: 'Sin escribir', escrito: 'Le escribiste', respondio: 'Respondió', acepto: 'Aceptó', no: 'No le interesa' };
  var MSJ_WA = 'Olá, {nombre}! Tudo bem? Somos a CuántoSale (cuantosale.uy), do Uruguai. Ajudamos uruguaios e argentinos a planejar viagens ao Brasil e gostaríamos de indicar a pousada de vocês aos nossos clientes que vão para {destino}.\n\n' +
    'O hóspede reserva e paga direto para vocês, e vocês nos pagam uma comissão só pelas reservas que chegarem através da gente (o hóspede informa o código CUANTOSALE). Sem custo fixo nem risco.\n\n' +
    'Teriam interesse? Posso mandar mais detalhes por e-mail 😊';
  var MSJ_MAIL = 'Olá, {nombre}! Tudo bem?\n\n' +
    'Somos a CuántoSale (cuantosale.uy), uma plataforma do Uruguai que ajuda viajantes uruguaios e argentinos a planejar e calcular quanto custa uma viagem ao Brasil: voo, hospedagem, traslados e passeios, tudo em um só lugar.\n\n' +
    'Muitos dos nossos usuários nos pedem recomendação de onde ficar em {destino}, e gostaríamos de indicar a pousada de vocês.\n\n' +
    'A proposta é simples:\n' +
    '• Nós indicamos a pousada para os nossos clientes que viajam para {destino}.\n' +
    '• O hóspede faz a reserva e paga diretamente para vocês, como qualquer reserva.\n' +
    '• Para identificar que veio da gente, ele informa o código CUANTOSALE ao reservar.\n' +
    '• Depois do check-out, vocês nos pagam uma comissão sobre o valor da hospedagem (pensamos em 10%, mas estamos abertos a conversar).\n\n' +
    'Para vocês não tem custo fixo nem risco: só pagam pelas reservas que chegam através da gente. E, como atendemos em espanhol, chegam hóspedes que muitas vezes não encontram vocês sozinhos.\n\n' +
    'Vocês teriam interesse? Se sim, poderiam nos enviar:\n' +
    '1. As tarifas de alta temporada (dezembro a março) e de baixa temporada.\n' +
    '2. A política de cancelamento.\n' +
    '3. Algumas fotos que possamos usar para apresentar a pousada.\n\n' +
    'Muito obrigado!\nEquipe CuántoSale\ncuantosale.uy';
  var LS_WA = 'cs-pousadas-msj-wa', LS_MAIL = 'cs-pousadas-msj-mail';
  function leerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardarLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* modo privado */ } }

  window.CSPousadasPanel = function (ctx) {
    var S = ctx.S, esc = ctx.esc;
    var st = { papelera: false, dest: 'todos', playa: 'todas', cat: 'todas', pend: false, editando: '', pidiendo: '', msjWa: null, msjMail: null };

    function guardados() { return (S.mkt && S.mkt.estado && S.mkt.estado.contactos) || {}; }
    function filas() {
      var g = guardados();
      return (window.CS_POUSADAS || []).map(function (p) {
        var x = g[p.id] || {};
        /* Lo guardado (cargado con el lapiz) manda; si nunca se toco, lo que trae la lista. */
        return Object.assign({}, p, { estado: x.estado || 'pendiente', fecha: x.fecha || '', wa: x.wa != null ? x.wa : (p.wa || ''),
          ig: x.dato != null ? String(x.dato).replace(/^@/, '') : (p.ig || ''), mail: x.mail != null ? x.mail : (p.mail || ''),
          nota: x.nota != null ? x.nota : (p.nota || ''), foto: x.foto || '', habs: habsDe(x), oculto: !!x.oculto });
      });
    }
    /* Las habitaciones acordadas (lo guardado en habs; las de antes, con un solo precio, como una doble). */
    function habsDe(x) {
      var l = []; try { l = JSON.parse(x.habs || '[]'); } catch (e) { l = []; }
      l = (Array.isArray(l) ? l : []).filter(function (h) { return h && h.nombre && Number(h.alta) > 0; });
      if (!l.length && Number(x.precio) > 0) l = [{ nombre: 'Habitación doble', personas: 2, alta: Number(x.precio), baja: '' }];
      return l;
    }
    function filaHab(h) {
      h = h || {};
      return '<div class="pzl__hab"><input data-h="nombre" value="' + esc(h.nombre || '') + '" placeholder="Ej.: Suite vista al mar" aria-label="Habitación">' +
        '<input data-h="personas" inputmode="numeric" value="' + esc(h.personas || '') + '" placeholder="2" aria-label="Personas">' +
        '<input data-h="alta" inputmode="decimal" value="' + esc(h.alta || '') + '" placeholder="US$" aria-label="Temporada alta, US$ la noche">' +
        '<input data-h="baja" inputmode="decimal" value="' + esc(h.baja || '') + '" placeholder="= alta" aria-label="Temporada baja, US$ la noche"></div>';
    }
    function filaPorId(id) { return filas().filter(function (p) { return p.id === id; })[0]; }
    function plantilla(k) {
      if (k === 'mail') return st.msjMail != null ? st.msjMail : (leerLS(LS_MAIL) || MSJ_MAIL);
      return st.msjWa != null ? st.msjWa : (leerLS(LS_WA) || MSJ_WA);
    }
    function mensajeDe(p, k) { return plantilla(k).split('{nombre}').join(p.n).split('{destino}').join(DESTINOS[p.d] || p.d); }
    function waNum(p) { var n = String(p.wa || '').replace(/\D/g, ''); if (n.length === 10 || n.length === 11) n = '55' + n; return n.length >= 12 ? n : ''; }
    /* El email se escribe en Gmail web (mailto abre el programa de correo de la computadora, que no se usa). */
    function gmail(para, asunto, cuerpo) {
      return 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(para) + '&su=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
    }
    function hrefDe(p, canal) {
      if (canal === 'wa') return 'https://wa.me/' + waNum(p) + '?text=' + encodeURIComponent(mensajeDe(p, 'wa'));
      if (canal === 'ig') return 'https://ig.me/m/' + encodeURIComponent(p.ig);
      if (canal === 'mail') return gmail(p.mail, 'Parceria para indicar hóspedes – CuántoSale', mensajeDe(p, 'mail'));
      if (canal === 'web') return p.web || '';
      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.n + ' ' + (p.p || '') + ' ' + (DESTINOS[p.d] || ''));
    }
    /* Lo que se le manda a la pousada socia cuando un cliente la pide (llega por WhatsApp desde la web). */
    function msjDisponibilidad(p, cli, fechas, pers) {
      return 'Olá, ' + p.n + '! Tudo bem? Reserva indicada pela CuántoSale:\n\n• Hóspede: ' + cli + '\n• Datas: ' + fechas + '\n• Pessoas: ' + pers +
        '\n\nVocês têm disponibilidade? Se sim, qual o valor total e como o hóspede faz o pagamento? Obrigado!';
    }
    function base(p) { return { tipo: 'pousada', medio: p.n, pais: 'BR' }; }
    function guardar(id, campos) { return ctx.guardarMkt({ contacto: { id: id, campos: campos } }).then(function () { ctx.pintar(); }); }
    function marcarEscrito(p) { if (p.estado === 'pendiente') guardar(p.id, Object.assign(base(p), { estado: 'escrito', fecha: ctx.hoy() })); }

    /* Lo que tiene cargado cada una, a la vista y tocable: web, WhatsApp, Instagram, telefono y email. */
    function contactos(p) {
      var l = [];
      if (p.web) l.push('<a href="' + esc(p.web) + '" target="_blank" rel="noopener">🌐 ' + esc(String(p.web).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>');
      if (waNum(p)) l.push('<a href="https://wa.me/' + waNum(p) + '" target="_blank" rel="noopener">💬 ' + esc(p.wa) + '</a>');
      if (p.ig) l.push('<a href="https://www.instagram.com/' + encodeURIComponent(p.ig) + '/" target="_blank" rel="noopener">📷 @' + esc(p.ig) + '</a>');
      if (p.tel && String(p.tel).replace(/\D/g, '') !== waNum(p)) l.push('<a href="tel:' + esc(String(p.tel).replace(/[^\d+]/g, '')) + '">📞 ' + esc(p.tel) + '</a>');
      if (p.mail) l.push('<a href="' + esc(gmail(p.mail, 'Parceria para indicar hóspedes – CuántoSale', mensajeDe(p, 'mail'))) + '" target="_blank" rel="noopener">✉️ ' + esc(p.mail) + '</a>');
      return l.length ? '<span class="pzl__cont">' + l.join('') + '</span>' : '<span class="pzl__cont pzl__cont--no">Sin contacto todavía</span>';
    }
    function fila(p) {
      var hecho = p.estado !== 'pendiente';
      var meta = [p.t, p.u ? 'US$ ' + p.u + ' la noche' + (p.guia ? ' (aprox.)' : '') : '', p.s ? 'nota ' + String(p.s).replace('.', ',') + (p.r ? ' (' + p.r + ' reseñas)' : '') : (p.guia ? 'de las guías de viaje' : '')].filter(Boolean).join(' · ');
      /* Un solo boton de envio, por el mejor canal que tenga: WhatsApp (lleva el texto), Instagram (se copia), email. */
      var canal = waNum(p) ? 'wa' : p.ig ? 'ig' : p.mail ? 'mail' : '';
      var b = function (canal, txt, cls) { return '<a class="btn btn--sm pzl__btn' + (cls || '') + '" href="' + esc(hrefDe(p, canal)) + '" target="_blank" rel="noopener" data-pzl-enviar="' + canal + ':' + esc(p.id) + '">' + txt + '</a>'; };
      var h = '<li class="pzl__fila' + (hecho ? ' is-hecho' : '') + '"><span class="pzl__tick" aria-hidden="true">' + (hecho ? '✓' : '') + '</span>' +
        '<div class="pzl__info"><b>' + esc(p.n) + '</b>' + contactos(p) + '<small>' + esc(meta) +
        (hecho ? ' · <span class="pzl__est pzl__est--' + esc(p.estado) + '">' + esc(ESTADOS[p.estado] || p.estado) + (p.fecha ? ' ' + esc(p.fecha.slice(8, 10) + '/' + p.fecha.slice(5, 7)) : '') + '</span>' : '') + '</small>' +
        (p.nota ? '<small class="pzl__nota">' + esc(p.nota) + '</small>' : '') +
        (p.estado === 'acepto' ? (p.habs.length ? '<small class="pzl__web">Sale en la web, arriba de Booking · ' + p.habs.length + (p.habs.length === 1 ? ' habitación' : ' habitaciones') + ', desde US$ ' +
            Math.min.apply(null, p.habs.map(function (h) { return Math.min(Number(h.alta), Number(h.baja) || Number(h.alta)); })) + ' la noche' + (p.foto ? '' : ' · sin foto') + '</small>'
          : '<small class="pzl__web pzl__web--no">Todavía no sale en la web: cargá las habitaciones con su precio con el lápiz (✎).</small>') : '') +
        '</div><div class="pzl__acc">' +
        (canal ? b(canal, 'Enviar mensaje · ' + { wa: 'WhatsApp', ig: 'Instagram', mail: 'Email' }[canal], { wa: ' pzl__btn--wa', ig: ' pzl__btn--ig', mail: ' btn--pri' }[canal])
          : '<button class="btn btn--sm btn--pri" data-pzl-copiar="' + esc(p.id) + '">Copiar mensaje</button>') +
        (p.mail && canal !== 'mail' ? b('mail', 'Enviar email') : '') +
        b('buscar', canal ? 'Maps' : 'Buscar contacto') +
        (p.estado === 'pendiente' ? '<button class="btn btn--sm" data-pzl-escribi="' + esc(p.id) + '">Ya le escribí</button>'
          : p.estado === 'escrito' ? '<button class="pzl__link pzl__desh" data-pzl-deshacer="' + esc(p.id) + '">Deshacer</button>' : '') +
        (p.estado === 'acepto' ? '<button class="btn btn--sm btn--pri" data-pzl-pedir="' + esc(p.id) + '">Pedir disponibilidad</button>' : '') +
        (p.oculto ? '<button class="btn btn--sm" data-pzl-restaurar="' + esc(p.id) + '">Restaurar</button>'
          : '<button class="pzl__edit" data-pzl-borrar="' + esc(p.id) + '" title="Mandar a la papelera" aria-label="Mandar a la papelera">🗑</button>') +
        '<button class="pzl__edit" data-pzl-editar="' + esc(p.id) + '" title="Cargar WhatsApp, Instagram, email o estado" aria-label="Editar">✎</button></div>';
      if (st.pidiendo === p.id) {
        h += '<form class="pzl__form" data-pzl-pedido="' + esc(p.id) + '"><label class="f">Cliente<input name="cli" required placeholder="Nombre y apellido"></label>' +
          '<label class="f">Fechas<input name="fechas" required placeholder="10/01 a 17/01"></label><label class="f">Personas<input name="pers" required placeholder="2 adultos"></label>' +
          '<div class="pzl__form-acc"><button class="btn btn--pri btn--sm" type="submit">' + (waNum(p) ? 'Abrir WhatsApp de la pousada' : 'Copiar mensaje' + (p.ig ? ' y abrir Instagram' : '')) + '</button><button class="btn btn--sm" type="button" data-pzl-pedir="">Cancelar</button></div></form>';
      }
      if (st.editando === p.id) {
        h += '<form class="pzl__form" data-pzl-form="' + esc(p.id) + '">' +
          '<label class="f">WhatsApp<input name="wa" inputmode="tel" value="' + esc(p.wa) + '" placeholder="+55 48 99999-9999"></label>' +
          '<label class="f">Instagram<input name="ig" value="' + esc(p.ig ? '@' + p.ig : '') + '" placeholder="@pousada"></label>' +
          '<label class="f">Email<input name="mail" type="email" value="' + esc(p.mail) + '" placeholder="reservas@…"></label>' +
          '<label class="f">Estado<select name="estado">' + Object.keys(ESTADOS).map(function (k) { return '<option value="' + k + '"' + (p.estado === k ? ' selected' : '') + '>' + ESTADOS[k] + '</option>'; }).join('') + '</select></label>' +
          '<label class="f">Foto (link https)<input name="foto" value="' + esc(p.foto) + '" placeholder="https://…"></label>' +
          '<label class="f pzl__fnota">Nota<input name="nota" value="' + esc(p.nota) + '" maxlength="300" placeholder="Qué respondió, qué comisión ofrece…"></label>' +
          '<div class="pzl__habs"><b>Habitaciones acordadas</b><small>US$ por noche por habitación. Temporada alta: noches de diciembre a febrero; si la baja queda vacía, se usa la de alta. Para borrar una, dejale el nombre vacío.</small>' +
          '<div class="pzl__hab pzl__hab--cab"><span>Habitación</span><span>Personas</span><span>Alta</span><span>Baja</span></div>' +
          p.habs.concat([{}]).map(filaHab).join('') + '<button class="pzl__link" type="button" data-pzl-mashab>+ Otra habitación</button></div>' +
          '<div class="pzl__form-acc"><button class="btn btn--pri btn--sm" type="submit">Guardar</button><button class="btn btn--sm" type="button" data-pzl-editar="">Cancelar</button></div></form>';
      }
      return h + '</li>';
    }

    function chips(lista, actual, attr, contar) {
      return '<div class="pzl__chips">' + lista.map(function (o) {
        var n = contar(o[0]);
        return n || o[0] === actual ? '<button class="pzl__chip" ' + attr + '="' + esc(o[0]) + '" aria-pressed="' + (actual === o[0]) + '">' + esc(o[1]) + ' <span>' + n + '</span></button>' : '';
      }).join('') + '</div>';
    }
    function vista() {
      /* La papelera: las que no gustaron quedan guardadas (oculto) y se ven solo con el filtro, para poder restaurarlas. */
      var conTodo = filas(), enPapelera = conTodo.filter(function (p) { return p.oculto; }).length;
      var todas = conTodo.filter(function (p) { return st.papelera ? p.oculto : !p.oculto; }), escritas = todas.filter(function (p) { return p.estado !== 'pendiente'; }).length;
      var aceptaron = todas.filter(function (p) { return p.estado === 'acepto'; }).length;
      var deDest = todas.filter(function (p) { return st.dest === 'todos' || p.d === st.dest; });
      var dePlaya = deDest.filter(function (p) { return st.playa === 'todas' || p.p === st.playa; });
      var deCat = dePlaya.filter(function (p) { return st.cat === 'todas' || p.c === st.cat; });
      var ver = deCat.filter(function (p) { return !st.pend || p.estado === 'pendiente'; });
      var playas = []; deDest.forEach(function (p) { if (playas.indexOf(p.p) < 0) playas.push(p.p); });

      var h = '<div class="vhead"><div><h2>Pousadas</h2><p>Pousadas a las que les proponés comisión por recomendarlas: el huésped reserva y paga directo a la pousada con el código CUANTOSALE, y la pousada te paga la comisión. Así no vendés alojamiento como agencia.</p></div></div>' +
        '<section class="sec pzl"><div class="pzl__cab"><h3>Para contactar</h3><p class="sub">' + escritas + ' de ' + todas.length + ' escritas' + (aceptaron ? ' · ' + aceptaron + ' aceptaron' : '') +
        '. Sin WhatsApp cargado, tocá «Buscar contacto»: Google Maps suele mostrar el teléfono y el Instagram. Cargalo con el lápiz y aparece el botón.</p></div>' +
        '<div class="pzl__tpl"><div class="pzl__tpls"><label class="f">Mensaje de WhatsApp e Instagram<textarea data-pzl-msj="wa" rows="7">' + esc(plantilla('wa')) + '</textarea></label>' +
        '<label class="f">Mensaje de email<textarea data-pzl-msj="mail" rows="7">' + esc(plantilla('mail')) + '</textarea></label></div>' +
        '<p class="sub">Donde dice <b>{nombre}</b> va el nombre de la pousada y en <b>{destino}</b>, el destino. Instagram no deja precargar el texto: al tocar el botón se copia el mensaje y se abre el chat, pegalo y mandalo. ' +
        (leerLS(LS_WA) || leerLS(LS_MAIL) ? '<button class="pzl__link" data-pzl-reset>Volver a los originales</button>' : '') + '</p></div>' +
        chips([['todos', 'Todos los destinos']].concat(Object.keys(DESTINOS).map(function (k) { return [k, DESTINOS[k]]; })), st.dest, 'data-pzl-dest', function (k) { return todas.filter(function (p) { return k === 'todos' || p.d === k; }).length; }) +
        (st.dest !== 'todos' ? chips([['todas', 'Todas las playas']].concat(playas.map(function (x) { return [x, x]; })), st.playa, 'data-pzl-playa', function (k) { return deDest.filter(function (p) { return k === 'todas' || p.p === k; }).length; }) : '') +
        chips([['todas', 'Todas las categorías']].concat(Object.keys(CATS).map(function (k) { return [k, CATS[k]]; })), st.cat, 'data-pzl-cat', function (k) { return dePlaya.filter(function (p) { return k === 'todas' || p.c === k; }).length; }) +
        '<div class="pzl__chips"><button class="pzl__chip" data-pzl-pend aria-pressed="' + st.pend + '">Solo sin escribir <span>' + deCat.filter(function (p) { return p.estado === 'pendiente'; }).length + '</span></button>' +
        (enPapelera || st.papelera ? '<button class="pzl__chip" data-pzl-papelera aria-pressed="' + st.papelera + '">🗑 Papelera <span>' + enPapelera + '</span></button>' : '') + '</div>';
      Object.keys(DESTINOS).forEach(function (d) {
        var deD = ver.filter(function (p) { return p.d === d; });
        if (!deD.length) return;
        h += '<h3 class="pzl__dest">' + esc(DESTINOS[d]) + '</h3>';
        var ps = []; deD.forEach(function (p) { if (ps.indexOf(p.p) < 0) ps.push(p.p); });
        ps.forEach(function (pl) {
          var deP = deD.filter(function (p) { return p.p === pl; });
          h += '<h4 class="pzl__playa">' + esc(pl) + ' <span>' + deP.filter(function (p) { return p.estado !== 'pendiente'; }).length + '/' + deP.length + '</span></h4>';
          Object.keys(CATS).forEach(function (c) {
            var rows = deP.filter(function (p) { return p.c === c; });
            if (rows.length) h += '<p class="pzl__cat">' + CATS[c] + '</p><ul class="pzl__lista">' + rows.map(fila).join('') + '</ul>';
          });
        });
      });
      if (!ver.length) h += '<p class="sub">No hay ninguna con ese filtro.</p>';
      return h + '</section>';
    }

    /* ---------- eventos (solo los de esta pestana) ---------- */
    function aqui() { return S.vista === 'mkt-pousadas'; }
    document.addEventListener('click', function (e) {
      if (!aqui()) return;
      var t = e.target.closest('[data-pzl-enviar],[data-pzl-editar],[data-pzl-pedir],[data-pzl-copiar],[data-pzl-mashab],[data-pzl-borrar],[data-pzl-restaurar],[data-pzl-papelera],[data-pzl-escribi],[data-pzl-deshacer],[data-pzl-dest],[data-pzl-playa],[data-pzl-cat],[data-pzl-pend],[data-pzl-reset]');
      if (!t) return;
      if (t.hasAttribute('data-pzl-enviar')) {
        var q = t.getAttribute('data-pzl-enviar').split(':'), p = filaPorId(q.slice(1).join(':'));
        if (!p) return;
        t.href = hrefDe(p, q[0]);   // con el mensaje como esta ahora
        if (q[0] === 'ig') ctx.copiar(mensajeDe(p, 'wa'));
        if (q[0] === 'wa' || q[0] === 'ig' || q[0] === 'mail') marcarEscrito(p);
        return;   // sin preventDefault: abre el chat, el mail o Maps
      }
      e.preventDefault();
      if (t.hasAttribute('data-pzl-mashab')) { t.insertAdjacentHTML('beforebegin', filaHab({})); return; }
      if (t.hasAttribute('data-pzl-copiar')) { var pc = filaPorId(t.getAttribute('data-pzl-copiar')); if (pc) ctx.copiar(mensajeDe(pc, 'wa')); return; }
      if (t.hasAttribute('data-pzl-escribi')) { var pe = filaPorId(t.getAttribute('data-pzl-escribi')); if (pe) marcarEscrito(pe); return; }
      if (t.hasAttribute('data-pzl-deshacer')) { var pd = filaPorId(t.getAttribute('data-pzl-deshacer')); if (pd) guardar(pd.id, Object.assign(base(pd), { estado: 'pendiente', fecha: '' })); return; }
      if (t.hasAttribute('data-pzl-pedir')) { var pid = t.getAttribute('data-pzl-pedir'); st.pidiendo = st.pidiendo === pid ? '' : pid; ctx.pintar(); return; }
      if (t.hasAttribute('data-pzl-editar')) { var id = t.getAttribute('data-pzl-editar'); st.editando = st.editando === id ? '' : id; ctx.pintar(); return; }
      if (t.hasAttribute('data-pzl-dest')) { st.dest = t.getAttribute('data-pzl-dest'); st.playa = 'todas'; ctx.pintar(); return; }
      if (t.hasAttribute('data-pzl-playa')) { st.playa = t.getAttribute('data-pzl-playa'); ctx.pintar(); return; }
      if (t.hasAttribute('data-pzl-cat')) { st.cat = t.getAttribute('data-pzl-cat'); ctx.pintar(); return; }
      if (t.hasAttribute('data-pzl-pend')) { st.pend = !st.pend; ctx.pintar(); return; }
      if (t.hasAttribute('data-pzl-papelera')) { st.papelera = !st.papelera; ctx.pintar(); return; }
      if (t.hasAttribute('data-pzl-borrar') || t.hasAttribute('data-pzl-restaurar')) {
        var pb = filaPorId(t.getAttribute('data-pzl-borrar') || t.getAttribute('data-pzl-restaurar')); if (!pb) return;
        var tirar = t.hasAttribute('data-pzl-borrar');
        ctx.guardarMkt({ contacto: { id: pb.id, campos: Object.assign(base(pb), { oculto: tirar }) } }).then(function () { ctx.pintar(); ctx.toast(tirar ? 'Mandada a la papelera' : 'Restaurada'); });
        return;
      }
      if (t.hasAttribute('data-pzl-reset')) { guardarLS(LS_WA, null); guardarLS(LS_MAIL, null); st.msjWa = null; st.msjMail = null; ctx.pintar(); }
    });
    document.addEventListener('input', function (e) {
      if (!aqui() || !e.target.hasAttribute || !e.target.hasAttribute('data-pzl-msj')) return;
      var v = e.target.value;
      if (e.target.getAttribute('data-pzl-msj') === 'mail') { st.msjMail = v; guardarLS(LS_MAIL, v === MSJ_MAIL ? null : v); }
      else { st.msjWa = v; guardarLS(LS_WA, v === MSJ_WA ? null : v); }
    });
    document.addEventListener('submit', function (e) {
      if (!aqui() || !e.target.hasAttribute('data-pzl-pedido')) return;
      e.preventDefault();
      var f = e.target, p = filaPorId(f.getAttribute('data-pzl-pedido')); if (!p) return;
      var m = msjDisponibilidad(p, f.cli.value.trim(), f.fechas.value.trim(), f.pers.value.trim());
      if (waNum(p)) window.open('https://wa.me/' + waNum(p) + '?text=' + encodeURIComponent(m), '_blank', 'noopener');
      else { ctx.copiar(m); if (p.ig) window.open('https://ig.me/m/' + encodeURIComponent(p.ig), '_blank', 'noopener'); }
      st.pidiendo = ''; ctx.pintar();
    });
    document.addEventListener('submit', function (e) {
      if (!aqui() || !e.target.hasAttribute('data-pzl-form')) return;
      e.preventDefault();
      var f = e.target, p = filaPorId(f.getAttribute('data-pzl-form')); if (!p) return;
      var ig = f.ig.value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
      var habs = [].map.call(f.querySelectorAll('.pzl__hab:not(.pzl__hab--cab)'), function (r) {
        var v = function (k) { return r.querySelector('[data-h="' + k + '"]').value.trim().replace(',', '.'); };
        return { nombre: v('nombre').slice(0, 60), personas: Math.max(1, Math.round(Number(v('personas'))) || 2), alta: Number(v('alta')) || 0, baja: Number(v('baja')) || '' };
      }).filter(function (h) { return h.nombre && h.alta > 0; });
      var campos = Object.assign(base(p), { wa: f.wa.value.trim(), mail: f.mail.value.trim(), nota: f.nota.value.trim(), foto: f.foto.value.trim(), habs: habs.length ? JSON.stringify(habs) : '', precio: '', canal: ig ? 'instagram' : 'otro', dato: ig ? '@' + ig : '', estado: f.estado.value });
      if (campos.estado !== p.estado) campos.fecha = campos.estado === 'pendiente' ? '' : ctx.hoy();
      ctx.guardarMkt({ contacto: { id: p.id, campos: campos } }).then(function () { st.editando = ''; ctx.pintar(); ctx.toast('Guardado'); });
    });

    if (!document.getElementById('pzl-css')) {
      var css = document.createElement('style'); css.id = 'pzl-css';
      css.textContent =
        '.btn--pri{background:var(--brand);color:#fff;border-color:var(--brand)}' +
        '.pzl{margin-top:18px}.pzl__cab h3{margin:0}.pzl__cab .sub{margin:2px 0 0}' +
        '.pzl__tpls{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:10px}' +
        '.pzl__tpl{margin:12px 0}.pzl__tpl textarea{width:100%;resize:vertical;font:inherit;font-size:14px}.pzl__tpl .sub{margin:6px 0 0}' +
        '.pzl__link{background:none;border:0;padding:0;color:var(--info);text-decoration:underline;cursor:pointer;font:inherit}' +
        '.pzl__chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}' +
        '.pzl__chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:99px;padding:5px 12px;cursor:pointer}' +
        '.pzl__chip span{color:var(--muted)}.pzl__chip[aria-pressed=true]{background:var(--ink);color:var(--card);border-color:var(--ink)}.pzl__chip[aria-pressed=true] span{color:inherit;opacity:.7}' +
        '.pzl__dest{margin:22px 0 4px;font-size:17px}.pzl__playa{margin:14px 0 4px;font-size:15px}.pzl__playa span{color:var(--muted);font-weight:500;font-size:13px;font-variant-numeric:tabular-nums}' +
        '.pzl__cat{margin:8px 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}' +
        '.pzl__lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}' +
        '.pzl__fila{display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}' +
        '.pzl__fila.is-hecho{background:var(--okbg)}' +
        '.pzl__tick{flex:none;width:22px;height:22px;border-radius:6px;border:1.5px solid var(--line);display:grid;place-items:center;font-size:13px;font-weight:800;color:var(--ok)}' +
        '.pzl__fila.is-hecho .pzl__tick{border-color:var(--ok)}' +
        '.pzl__info{flex:1;min-width:180px}.pzl__info b{display:block;font-size:14.5px}.pzl__info small{display:block;color:var(--muted);font-size:12.5px;font-variant-numeric:tabular-nums}' +
        '.pzl__cont{display:flex;flex-wrap:wrap;gap:4px 12px;margin:2px 0 1px;font-size:13px}.pzl__cont a{color:var(--info);text-decoration:none;font-weight:600;overflow-wrap:anywhere}.pzl__cont a:hover{text-decoration:underline}.pzl__cont--no{color:var(--muted);font-style:italic}' +
        '.pzl__habs{grid-column:1/-1;display:flex;flex-direction:column;gap:6px;border:1px solid var(--line);border-radius:12px;padding:10px 12px}.pzl__habs small{color:var(--muted);font-size:12.5px}' +
        '.pzl__hab{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,.8fr) minmax(0,1fr) minmax(0,1fr);gap:6px}.pzl__hab input{width:100%;min-width:0}' +
        '.pzl__hab--cab span{font-size:12px;font-weight:700;color:var(--muted)}.pzl__habs .pzl__link{align-self:flex-start}' +
        '.pzl__desh{font-size:13px;padding:4px 6px}' +
        '.pzl__web{margin-top:3px;color:var(--ok)!important;font-weight:600}.pzl__web--no{color:var(--warn)!important}.pzl__nota{margin-top:2px;line-height:1.35}.pzl__est{color:var(--ok);font-weight:700}.pzl__est--no{color:var(--bad)}' +
        '.pzl__acc{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.pzl__btn{text-decoration:none;white-space:nowrap}' +
        '.pzl__btn--ig{background:var(--ink);color:var(--card);border-color:var(--ink)}.pzl__btn--wa{background:var(--ok);color:#fff;border-color:var(--ok)}' +
        '.pzl__edit{background:none;border:0;color:var(--muted);font-size:16px;cursor:pointer;padding:4px 6px}.pzl__edit:hover{color:var(--ink)}' +
        '.pzl__form{flex-basis:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end;border-top:1px solid var(--line);padding-top:10px}' +
        '.pzl__fnota{grid-column:1/-1}.pzl__form-acc{display:flex;gap:6px;flex-wrap:wrap;grid-column:1/-1}' +
        '@media (max-width:560px){.pzl__acc{width:100%}.pzl__acc .pzl__btn{flex:1;text-align:center}}';
      document.head.appendChild(css);
    }
    return { vista: vista };
  };
})();
