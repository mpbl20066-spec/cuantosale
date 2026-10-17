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

  /* Lista para contactar: los creadores del plan (CS_MKT.contactos, todos uruguayos) mas estos, que se guardan como
     contacto la primera vez que se toca uno. [id, pais, nombre, persona, @instagram, seguidores, nota].
     Seguidores de HypeAuditor (oct 2026) y Feedspot; los sin dato, verificalos en el perfil.
     8º campo opcional: el perfil (PERFILES), si no es influencer. Si el 5º es una URL, va sin Instagram (canal otro). */
  var LISTA = [
    ['cr-viajealavuelta', 'UY', 'A la Vuelta · Viajes por el mundo', '', 'viajealavuelta', '15,5k', ''],
    ['cr-mayuhuba', 'UY', 'Yuli Baquedano', 'Yuli', 'mayuhuba', '180k', ''],
    ['cr-marioneill', 'UY', 'Marina O\'Neill', 'Marina', 'marioneill', '101k', ''],
    ['cr-elcaminoeslarecompensa', 'UY', 'El camino es la recompensa', '', 'el.camino_es.la.recompensa', '137k', ''],
    ['cr-dementeconmochila', 'UY', 'Franca Levin · Demente con mochila', 'Franca', 'dementeconmochila', '146k', ''],
    ['cr-romimochileando', 'UY', 'Romi Graña · Mochileando', 'Romi', 'romimochileando', '191k', ''],
    ['cr-pastoreuy', 'UY', 'Guille Pastorini', 'Guille', 'pastore_uy', '6,9k', 'Cineasta y creador de viajes (Heepsy). Verificá el usuario antes de escribir.'],
    ['cr-agusvarela', 'UY', 'Agus Varela', 'Agus', 'agusvarela', '', 'Aparecía en el ranking de viajes de Uruguay de HypeAuditor (2022). Verificá que siga activo y que sea de viajes.'],
    ['cr-guruguay', 'UY', 'Guru\'Guay', '', 'guruguay1', '45,5k', 'Guía de Uruguay, mucho público extranjero. Sirve más para alianza que para Brasil.'],
    ['cr-tickyyoga', 'UY', 'Mariana Vega · Viajes y retiros', 'Mariana', 'ticky_yoga', '95k', 'Viajes y retiros: probá con un paseo tranqui (Pipa, Jeri).'],
    ['cr-turistaenuruguay', 'UY', 'Nacho · Turista en Uruguay', 'Nacho', 'turistaenuruguay', '101k', ''],
    ['cr-cosasdelpaisito', 'UY', 'Luis Molina · Cosas del paisito', 'Luis', 'cosasdelpaisito', '181k', 'Humor y cultura uruguaya, no solo viajes: proponé algo tipo «el uruguayo en Floripa».'],
    ['cr-uruguaycreadores', 'UY', 'Selección Uruguaya de Creadores', '', 'uruguaycreadores', '', 'Comunidad de creadores uruguayos: pediles que compartan la propuesta con su gente.'],
    ['cr-viajeydescubra', 'AR', 'Flor Zaccagnino · Viaje y descubra', 'Flor', 'viajeydescubra', '108k','Tiene una guía de Florianópolis y compara Floripa, Bombinhas y Camboriú en su blog: la más afín. Empezá por ella.'],
    ['cr-viajandovivamos', 'AR', 'Juliana Alvarez Curetti · Viajando Vivamos', 'Juliana', 'viajandovivamos', '', 'Viajera sola y nómade digital; colabora con marcas de viajes.'],
    ['cr-timetotravelarg', 'AR', 'Chiava · Time to travel', 'Chiava', 'timetotravel_arg', '10,5k', 'Viajera de Córdoba.'],
    ['cr-turistearelmundo', 'AR', 'Janice · Turistear el mundo', 'Janice', 'turistearelmundo', '16,4k', 'Comunicadora de viajes y arma itinerarios.'],
    ['cr-viajandoconsil', 'AR', 'Soy Sil · Viajando con Sil', 'Sil', 'viajandoconsil', '24,5k', 'Hoteles y viajes gourmet.'],
    ['cr-modopasaje', 'AR', 'Ger Farnitano · Modo pasaje', 'Ger', 'modopasaje', '31k', 'Rutas y recomendaciones prácticas.'],
    ['cr-chelotravels', 'AR', 'Chelo Travels', 'Chelo', 'chelotravels', '32k', 'Viajar barato con voluntariados.'],
    ['cr-tramandoviajes', 'AR', 'Florencia Pagano · Tramando viajes', 'Florencia', 'tramandoviajes', '41,7k', ''],
    ['cr-salviajando', 'AR', 'Celes y Salvi · Salviajando', 'Celes', 'salviajando', '51k', 'Pareja, trekking.'],
    ['cr-andreamodoturista', 'AR', 'María Andrea · Modo turista', 'Andrea', 'andreamodoturista', '63k', ''],
    ['cr-camitalpone', 'AR', 'Camila Talpone', 'Camila', 'camitalpone', '66k', 'Trabaja con Despegar.'],
    ['cr-alwaystravelera', 'AR', 'Rocío Ruiz · Always travelera', 'Rocío', 'alwaystravelera', '72,5k', 'Nómade digital, viaja sola.'],
    ['cr-respiroviajes', 'AR', 'Leo Hoop · Respiro viajes', 'Leo', 'respiroviajes', '94k', 'Promos y descuentos de viajes: su público acaba de comprar el vuelo.', 'ofertas'],
    ['cr-valexunviaje', 'AR', 'Vale Orioli · Vale x un viaje', 'Vale', 'valexunviaje', '103k', 'Tips de viaje.'],
    ['cr-myalmundo', 'AR', 'Milagros y Ariel · My al mundo', 'Milagros', 'myalmundo', '124k', 'Datos de destinos, hoteles y experiencias.'],
    ['cr-soyalexrivas', 'AR', 'Alex Rivas', 'Alex', 'soyalexrivas', '176k', ''],
    ['cr-floxie10', 'AR', 'Floxie', '', 'floxie10', '200k', ''],
    ['cr-tanviajeros', 'AR', 'Rodri y Eze · Tan viajeros', 'Rodri', 'tanviajeros', '210k', ''],
    ['cr-viajeracompulsiva', 'AR', 'Mica · Viajera compulsiva', 'Mica', 'viajera.compulsiva', '212k', 'Tips, itinerarios y destinos.'],
    ['cr-gui10road', 'AR', 'Gui · 10 road', 'Gui', 'gui10road', '246k', 'Viaja en van.'],
    ['cr-boletoalafelicidad', 'AR', 'Aye · Boleto a la felicidad', 'Aye', 'boletoalafelicidad', '274k', 'De Rosario, playas e info práctica: muy afín a Brasil.'],
    ['cr-argentinayelmundo', 'AR', 'Fede y Sol · Argentina y el mundo', 'Fede', 'argentinayelmundo', '391k', 'Pareja bloguera de viajes.'],
    ['cr-cadaviajeunmundo', 'AR', 'Caro y Vero Avigliano · Cada viaje un mundo', 'Caro', 'cadaviajeunmundo', '268k', ''],
    ['cr-recomiendoviajar', 'AR', 'Rodri Morales · Recomiendo viajar', 'Rodri', 'recomiendoviajar', '276k', 'Tips y recomendaciones de viaje.'],
    ['cr-panditaonroad', 'AR', 'Sofía Lugón · Pandita on road', 'Sofía', 'panditaonroad', '351k', ''],
    ['cr-tupisaravia', 'AR', 'Martina Saravia Alemán', 'Martina', 'tupisaravia', '419k', ''],
    ['cr-viajarenfoco', 'AR', 'María Laura Vazquez · Viajar en foco', 'María Laura', 'viajarenfoco', '680k', ''],
    ['cr-isaporahi', 'AR', 'Isa por ahí', 'Isa', 'isa_porahi', '682k', ''],
    ['cr-hakunamatataxelmundo', 'AR', 'Caro y Santi · Hakuna Matata x el mundo', 'Caro', 'hakunamatataxelmundo', '685k', 'Motorhome y vanlife.'],
    ['cr-pasajeenmano', 'AR', 'Agus López · Pasaje en mano', 'Agus', 'pasaje.en.mano', '1,1M', 'Periodista de viajes, ofertas de pasajes: su público acaba de comprar el vuelo.', 'ofertas'],
    /* Otros perfiles: viven en Brasil, escuelas que viajan. Los que no tienen Instagram conocido van con su web. */
    ['cr-alojamientofloripa', 'AR', 'Alojamiento Floripa', '', 'alojamientofloripa', '52k', 'Cuenta en español: todo sobre Floripa y alquiler de casas por temporada. Sus huéspedes necesitan traslado y paseos.', 'vivebr'],
    ['cr-comunidadfloripa', 'AR', 'Comunidad Floripa (Pablo y Fernanda)', '', 'https://comunidadfloripa.com/', '', 'Pareja argentina que vive en Floripa: web, Instagram, TikTok y YouTube. Buscá su Instagram en la web y cargalo con ✎.', 'vivebr'],
    ['cr-argentinosenbuzios', 'AR', 'Argentinos en Búzios', '', 'argentinosenbuzios', '5k', 'Comunidad de argentinos en Búzios, con tips y recomendaciones.', 'vivebr'],
    ['cr-giulopez', 'AR', 'Giu López (TikTok)', 'Giu', 'https://www.tiktok.com/@giulopez_', '', 'Entrevista a argentinos que viven y trabajan en Floripa.', 'vivebr'],
    ['cr-kitesurfuruguay', 'UY', 'Kitesurf Uruguay · Samudra (José Ignacio)', '', 'https://www.kitesurfuruguay.com/', '', 'Escuela de kite que hace kitetrips y downwinds por Brasil: sus alumnos van a Jeri y al Nordeste.', 'escuela'],
    ['cr-yobuceo', 'UY', 'YoBuceo (Montevideo)', '', 'https://yobuceo.com.uy/', '', 'Escuela PADI: el director organiza viajes de buceo en grupo, con Brasil entre los destinos.', 'escuela'],
    ['cr-montevideodiving', 'UY', 'Montevideo Diving School', '', 'https://www.montevideodiving.com/', '', 'El instructor buceó en Noronha y Bombinhas: proponé un viaje del grupo con traslados y paseos.', 'escuela'],
    ['cr-bbravekite', 'AR', 'Bbrave Kite School', '', 'https://bbravekiteschool.com.ar/viajes/', '', 'Hace viajes de kite a Jericoacoara y al Nordeste.', 'escuela'],
    ['cr-oceanicabuceo', 'AR', 'Oceánica Buceo', '', 'https://www.oceanicabuceo.com.ar/salidas-buceo/', '', 'Viajes de buceo a Brasil, Noronha incluido.', 'escuela'],
    ['cr-argentinabuceo', 'AR', 'Escuela Argentina de Buceo', '', 'https://argentinabuceo.com/', '', 'Viajes de buceo, Noronha incluido.', 'escuela']
  ];
  var PERFILES = { influencer: 'Influencer de viajes', ofertas: 'Ofertas de vuelos', vivebr: 'Vive en Brasil', escuela: 'Escuela que viaja', grupo: 'Organiza viajes en grupo', familia: 'Familias / lunas de miel' };
  var PAIS = { UY: 'Uruguay', AR: 'Argentina' };
  var MSJ_BASE = '¡Hola {nombre}! ¿Cómo estás? Te escribimos de Cuánto Sale (cuantosale.uy), una app uruguaya y gratis que calcula cuánto sale de verdad un viaje a Brasil: vuelo, traslado, alojamiento y paseos, todo sumado.\n\n' +
    'Nos encanta tu contenido y queríamos proponerte algo: te damos un link propio y te llevás el ' + COMISION + ' % de cada traslado o paseo que reserve tu gente. Sin costo ni compromiso.\n\n' +
    'Si te interesa, te armamos tu próximo viaje en la app con números reales para que lo muestres. ¿Te copa?';
  var MSJ_OTROS = '¡Hola {nombre}! ¿Cómo están? Les escribimos de Cuánto Sale (cuantosale.uy), una app uruguaya que vende traslados y paseos en Brasil, con precios claros y reserva con seña.\n\n' +
    'Vimos que tienen gente que viaja a Brasil y queríamos proponerles algo: les damos un link propio y se llevan el ' + COMISION + ' % de cada traslado o paseo que reserve su gente. Sin costo ni compromiso, y a ustedes no les suma trabajo.\n\n' +
    'Si les sirve, les pasamos los precios de los destinos a los que van. ¿Les interesa?';
  var LS_MSJ = 'cs-creadores-msj', LS_MSJ_OTROS = 'cs-creadores-msj-otros';
  function leerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardarLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* modo privado */ } }

  window.CSCreadoresPanel = function (ctx) {
    var S = ctx.S, esc = ctx.esc, usd = ctx.usd;
    var st = { abierto: {}, pagando: '', mensajes: {}, filtro: 'todos', editando: '', msj: null };
    var ESTADO_CT = { escrito: 'Le escribiste', seguimiento: 'Seguimiento mandado', respondio: 'Respondió', acepto: 'Socio', publico: 'Publicó', no: 'No le interesa' };

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

    /* ---------- Lista para contactar (como la de Motus): mensaje editable, filtro por pais y un boton por canal ---------- */
    function arroba(c) {
      var d = String(c.dato || '').trim();
      if (c.canal && c.canal !== 'instagram') return '';
      return d.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
    }
    function filasLista() {
      var guardados = estado().contactos || {}, l = [];
      ctx.contactos().forEach(function (c) { if (c.tipo === 'creador') l.push(Object.assign({ pais: 'UY' }, c, { perfil: c.perfil || 'influencer' })); });
      LISTA.forEach(function (r) {
        if (guardados[r[0]]) return;   // ya guardado (o quitado): viene de ctx.contactos()
        var web = /^https?:\/\//.test(r[4]);
        l.push({ id: r[0], nuevo: true, tipo: 'creador', pais: r[1], medio: r[2], persona: r[3], canal: web ? 'otro' : 'instagram', dato: web ? r[4] : '@' + r[4], seguidores: r[5], nota: r[6], perfil: r[7] || 'influencer', estado: 'pendiente' });
      });
      return l;
    }
    function base(c) {   // lo que se guarda la primera vez de un creador de LISTA
      return c.nuevo ? { tipo: 'creador', medio: c.medio, persona: c.persona, canal: c.canal, dato: c.dato, pais: c.pais, seguidores: c.seguidores, nota: c.nota, perfil: c.perfil, estado: 'pendiente' } : {};
    }
    function nombreDe(c) {
      if (c.persona) return c.persona;
      var par = /\(([^)]+)\)/.exec(c.medio || ''); if (par) return par[1];
      return String(c.medio || '').split(' · ')[0];
    }
    /* Dos mensajes: a los influencers se los tutea y se les habla de su contenido; al resto (escuelas, gente en
       Brasil, ofertas) se les habla de ustedes y de su gente. */
    function plantilla(k) {
      if (k === 'otros') return st.msjOtros != null ? st.msjOtros : (leerLS(LS_MSJ_OTROS) || MSJ_OTROS);
      return st.msj != null ? st.msj : (leerLS(LS_MSJ) || MSJ_BASE);
    }
    function mensajeDe(c) { return plantilla(c.perfil === 'influencer' ? 'inf' : 'otros').split('{nombre}').join(nombreDe(c)); }
    function waNum(c) { var n = String(c.wa || '').replace(/\D/g, ''); if (/^0?9\d{7}$/.test(n)) n = '598' + n.replace(/^0/, ''); return n; }
    function hrefDe(c, canal) {
      if (canal === 'ig') return 'https://ig.me/m/' + encodeURIComponent(arroba(c));
      if (canal === 'wa') return 'https://wa.me/' + waNum(c) + '?text=' + encodeURIComponent(mensajeDe(c));
      if (canal === 'mail') return 'mailto:' + encodeURIComponent(c.mail) + '?subject=' + encodeURIComponent('Propuesta de Cuánto Sale') + '&body=' + encodeURIComponent(mensajeDe(c));
      return /^https?:\/\//.test(String(c.dato || '')) ? c.dato : '';
    }
    function filaLista(c) {
      var ig = arroba(c), hecho = c.estado !== 'pendiente', otro = !ig && hrefDe(c, 'otro');
      var meta = [c.perfil !== 'influencer' ? PERFILES[c.perfil] || c.perfil : '', ig ? '@' + ig : (/tiktok/i.test(c.dato || '') ? 'TikTok' : c.canal === 'otro' ? 'sin Instagram' : ''), c.seguidores ? c.seguidores + ' seg.' : '', c.ronda ? 'ronda ' + c.ronda : ''].filter(Boolean).join(' · ');
      var b = function (canal, txt, cls) { return '<a class="btn btn--sm crl__btn' + (cls || '') + '" href="' + esc(hrefDe(c, canal)) + '" target="_blank" rel="noopener" data-crl-enviar="' + canal + ':' + esc(c.id) + '">' + txt + '</a>'; };
      var h = '<li class="crl__fila' + (hecho ? ' is-hecho' : '') + '"><span class="crl__tick" aria-hidden="true">' + (hecho ? '✓' : '') + '</span>' +
        '<div class="crl__info"><b>' + esc(c.medio || ig || 'Creador') + '</b><small>' + esc(meta) +
        (hecho ? ' · <span class="crl__est">' + esc(ESTADO_CT[c.estado] || c.estado) + (c.fecha ? ' ' + esc(fechaCorta(c.fecha)) : '') + '</span>' : '') + '</small>' +
        (c.nota ? '<small class="crl__nota">' + esc(c.nota) + '</small>' : '') + '</div><div class="crl__acc">' +
        (ig ? b('ig', 'Instagram', ' crl__btn--ig') : '') + (otro ? b('otro', /tiktok/i.test(c.dato || '') ? 'Abrir TikTok' : 'Abrir web') : '') +
        (waNum(c) ? b('wa', 'WhatsApp', ' crl__btn--wa') : '') + (c.mail ? b('mail', 'Email') : '') +
        '<button class="crl__edit" data-crl-editar="' + esc(c.id) + '" title="Agregar email, WhatsApp o país" aria-label="Editar">✎</button></div>';
      if (st.editando === c.id) {
        h += '<form class="crl__form" data-crl-form="' + esc(c.id) + '"><label class="f">Email<input name="mail" type="email" value="' + esc(c.mail || '') + '" placeholder="contacto@…"></label>' +
          '<label class="f">WhatsApp<input name="wa" inputmode="tel" value="' + esc(c.wa || '') + '" placeholder="099 123 456 o +54 9 11…"></label>' +
          '<label class="f">País<select name="pais">' + Object.keys(PAIS).map(function (k) { return '<option value="' + k + '"' + (c.pais === k ? ' selected' : '') + '>' + PAIS[k] + '</option>'; }).join('') + '</select></label>' +
          '<label class="f">Perfil<select name="perfil">' + Object.keys(PERFILES).map(function (k) { return '<option value="' + k + '"' + (c.perfil === k ? ' selected' : '') + '>' + PERFILES[k] + '</option>'; }).join('') + '</select></label>' +
          '<label class="f">Instagram<input name="ig" value="' + esc(ig ? '@' + ig : '') + '" placeholder="@usuario"></label>' +
          '<label class="f">Seguidores<input name="seguidores" value="' + esc(c.seguidores || '') + '" placeholder="ej. 45k" maxlength="20"></label>' +
          '<div class="crl__form-acc"><button class="btn btn--pri btn--sm" type="submit">Guardar</button><button class="btn btn--sm" type="button" data-crl-editar="">Cancelar</button>' +
          (hecho ? '<button class="btn btn--sm" type="button" data-crl-desmarcar="' + esc(c.id) + '">Volver a «sin escribir»</button>' : '') + '</div></form>';
      }
      return h + '</li>';
    }
    function vistaLista() {
      var todas = filasLista(), f = st.filtro || 'todos', pf = st.perfil || 'todos';
      var dePerfil = todas.filter(function (c) { return pf === 'todos' || c.perfil === pf; });
      var ver = dePerfil.filter(function (c) { return f === 'todos' || (f === 'pend' ? c.estado === 'pendiente' : c.pais === f); });
      var escritos = todas.filter(function (c) { return c.estado !== 'pendiente'; }).length;
      var h = '<section class="sec crl"><div class="crl__cab"><div><h3>Creadores para contactar</h3><p class="sub">' + escritos + ' de ' + todas.length + ' escritos. Mandalos de a 5 por día: Instagram limita los mensajes a cuentas que no te siguen.</p></div></div>' +
        '<div class="crl__tpl"><div class="crl__tpls"><label class="f">Mensaje para influencers<textarea data-crl-msj="inf" rows="8">' + esc(plantilla('inf')) + '</textarea></label>' +
        '<label class="f">Mensaje para escuelas, gente en Brasil y ofertas<textarea data-crl-msj="otros" rows="8">' + esc(plantilla('otros')) + '</textarea></label></div>' +
        '<p class="sub">Donde dice <b>{nombre}</b> va el nombre de cada uno. Instagram no deja precargar el texto: al tocar el botón se copia el mensaje y se abre el chat, pegalo y mandalo. WhatsApp y email lo llevan ya escrito. ' +
        (leerLS(LS_MSJ) || leerLS(LS_MSJ_OTROS) ? '<button class="crl__link" data-crl-reset>Volver a los originales</button>' : '') + '</p></div>' +
        '<div class="crl__chips">' + [['todos', 'Todos los perfiles']].concat(Object.keys(PERFILES).map(function (k) { return [k, PERFILES[k]]; })).map(function (o) {
          var n = o[0] === 'todos' ? todas.length : todas.filter(function (c) { return c.perfil === o[0]; }).length;
          return n ? '<button class="crl__chip" data-crl-perfil="' + o[0] + '" aria-pressed="' + (pf === o[0]) + '">' + o[1] + ' <span>' + n + '</span></button>' : '';
        }).join('') + '</div>' +
        '<div class="crl__chips">' + [['todos', 'Todos'], ['UY', 'Uruguay'], ['AR', 'Argentina'], ['pend', 'Sin escribir']].map(function (o) {
          var n = o[0] === 'todos' ? dePerfil.length : dePerfil.filter(function (c) { return o[0] === 'pend' ? c.estado === 'pendiente' : c.pais === o[0]; }).length;
          return '<button class="crl__chip" data-crl-filtro="' + o[0] + '" aria-pressed="' + (f === o[0]) + '">' + o[1] + ' <span>' + n + '</span></button>';
        }).join('') + '</div>';
      ['UY', 'AR'].forEach(function (p) {
        var rows = ver.filter(function (c) { return c.pais === p; });
        if (!rows.length) return;
        rows.sort(function (a, b) { return (a.estado !== 'pendiente') - (b.estado !== 'pendiente') || (a.ronda || 9) - (b.ronda || 9); });
        var hechos = rows.filter(function (c) { return c.estado !== 'pendiente'; }).length;
        h += '<h4 class="crl__pais">' + PAIS[p] + ' <span>' + hechos + '/' + rows.length + '</span></h4><ul class="crl__lista">' + rows.map(filaLista).join('') + '</ul>';
      });
      if (!ver.length) h += '<p class="sub">No hay ninguno con ese filtro.</p>';
      return h + '</section>';
    }
    function marcarEscrito(c) {
      var campos = Object.assign(base(c), c.estado === 'pendiente' ? { estado: 'escrito', fecha: ctx.hoy() } : {});
      if (!Object.keys(campos).length) return;
      guardar({ contacto: { id: c.id, campos: campos } });
    }
    function filaPorId(id) { return filasLista().filter(function (c) { return c.id === id; })[0]; }

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
        return h + '<div class="cr-vacio"><b>Todavía no hay socios.</b><p>Cuando un creador acepte, marcalo arriba con «Aceptó · hacer socio» (o en Contactos, con el estado «Aceptó · socio»). Le armamos el link, el código y el mensaje para mandarle.</p></div>' + vistaLista();
      }
      h += '<div class="cr-grid">' + xs.map(tarjeta).join('') + '</div>' + vistaLista();

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

    /* Lista para contactar: enviar (deja navegar el enlace), editar, filtrar y el mensaje. */
    document.addEventListener('click', function (e) {
      if (!aqui()) return;
      var t = e.target.closest('[data-crl-enviar],[data-crl-editar],[data-crl-filtro],[data-crl-perfil],[data-crl-reset],[data-crl-desmarcar]');
      if (!t) return;
      if (t.hasAttribute('data-crl-enviar')) {
        var p = t.getAttribute('data-crl-enviar').split(':'), c = filaPorId(p.slice(1).join(':'));
        if (!c) return;
        t.href = hrefDe(c, p[0]);   // con el mensaje como esta ahora
        if (p[0] === 'ig' || p[0] === 'otro') ctx.copiar(mensajeDe(c));
        marcarEscrito(c);
        return;   // sin preventDefault: abre el chat
      }
      e.preventDefault();
      if (t.hasAttribute('data-crl-editar')) { var id = t.getAttribute('data-crl-editar'); st.editando = st.editando === id ? '' : id; ctx.pintar(); return; }
      if (t.hasAttribute('data-crl-filtro')) { st.filtro = t.getAttribute('data-crl-filtro'); ctx.pintar(); return; }
      if (t.hasAttribute('data-crl-perfil')) { st.perfil = t.getAttribute('data-crl-perfil'); ctx.pintar(); return; }
      if (t.hasAttribute('data-crl-reset')) { guardarLS(LS_MSJ, null); guardarLS(LS_MSJ_OTROS, null); st.msj = null; st.msjOtros = null; ctx.pintar(); return; }
      if (t.hasAttribute('data-crl-desmarcar')) { var d = filaPorId(t.getAttribute('data-crl-desmarcar')); if (d) { st.editando = ''; guardar({ contacto: { id: d.id, campos: { estado: 'pendiente', fecha: '' } } }); } }
    });
    document.addEventListener('input', function (e) {
      if (!aqui() || !e.target.hasAttribute || !e.target.hasAttribute('data-crl-msj')) return;
      var v = e.target.value;
      if (e.target.getAttribute('data-crl-msj') === 'otros') { st.msjOtros = v; guardarLS(LS_MSJ_OTROS, v === MSJ_OTROS ? null : v); }
      else { st.msj = v; guardarLS(LS_MSJ, v === MSJ_BASE ? null : v); }
    });
    document.addEventListener('submit', function (e) {
      if (!aqui() || !e.target.hasAttribute('data-crl-form')) return;
      e.preventDefault();
      var f = e.target, c = filaPorId(f.getAttribute('data-crl-form')); if (!c) return;
      var campos = Object.assign(base(c), { mail: f.mail.value.trim(), wa: f.wa.value.trim(), pais: f.pais.value, seguidores: f.seguidores.value.trim(), perfil: f.perfil.value });
      var nuevoIg = f.ig.value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
      if (nuevoIg && nuevoIg !== arroba(c)) { campos.canal = 'instagram'; campos.dato = '@' + nuevoIg; }
      ctx.guardarMkt({ contacto: { id: c.id, campos: campos } }).then(function () { st.editando = ''; ctx.pintar(); });
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
        '.crl{margin-top:22px}.crl__cab h3{margin:0}.crl__cab .sub{margin:2px 0 0}' +
        '.crl__tpls{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:10px}' +
        '.crl__tpl{margin:12px 0}.crl__tpl textarea{width:100%;resize:vertical;font:inherit;font-size:14px}.crl__tpl .sub{margin:6px 0 0}' +
        '.crl__link{background:none;border:0;padding:0;color:var(--info);text-decoration:underline;cursor:pointer;font:inherit}' +
        '.crl__chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}' +
        '.crl__chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:99px;padding:5px 12px;cursor:pointer}' +
        '.crl__chip span{color:var(--muted)}.crl__chip[aria-pressed=true]{background:var(--ink);color:var(--card);border-color:var(--ink)}.crl__chip[aria-pressed=true] span{color:inherit;opacity:.7}' +
        '.crl__pais{margin:16px 0 8px;font-size:15px}.crl__pais span{color:var(--muted);font-weight:500;font-size:13px;font-variant-numeric:tabular-nums}' +
        '.crl__lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}' +
        '.crl__fila{display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}' +
        '.crl__fila.is-hecho{background:var(--okbg)}.crl__fila.is-hecho .crl__info b{color:var(--muted)}' +
        '.crl__tick{flex:none;width:22px;height:22px;border-radius:6px;border:1.5px solid var(--line);display:grid;place-items:center;font-size:13px;font-weight:800;color:var(--ok)}' +
        '.crl__fila.is-hecho .crl__tick{border-color:var(--ok)}' +
        '.crl__info{flex:1;min-width:180px}.crl__info b{display:block;font-size:14.5px}.crl__info small{display:block;color:var(--muted);font-size:12.5px;font-variant-numeric:tabular-nums}' +
        '.crl__nota{margin-top:2px;line-height:1.35}.crl__est{color:var(--ok);font-weight:700}' +
        '.crl__acc{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.crl__btn{text-decoration:none;white-space:nowrap}' +
        '.crl__btn--ig{background:var(--ink);color:var(--card);border-color:var(--ink)}.crl__btn--wa{background:var(--ok);color:#fff;border-color:var(--ok)}' +
        '.crl__edit{background:none;border:0;color:var(--muted);font-size:16px;cursor:pointer;padding:4px 6px}.crl__edit:hover{color:var(--ink)}' +
        '.crl__form{flex-basis:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end;border-top:1px solid var(--line);padding-top:10px}' +
        '.crl__form-acc{display:flex;gap:6px;flex-wrap:wrap;grid-column:1/-1}' +
        '@media (max-width:560px){.crl__acc{width:100%}.crl__acc .crl__btn{flex:1;text-align:center}}' +
        '@media (max-width:560px){.cr{padding:14px}.cr__stats{grid-template-columns:repeat(2,1fr)}.cr__plata{flex-wrap:wrap}.cr__plata .btn{width:100%}.cr-resp li{flex-wrap:wrap}.cr-resp li .btn{width:100%}}';
      document.head.appendChild(css);
    }
    return { vista: vista };
  };
})();
