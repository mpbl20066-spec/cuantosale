/* Marketing > Grupos del panel /admin: presencia en grupos y foros de viajeros. Costo bajo (solo tiempo), impacto muy
   alto: ahi esta la gente que ya decidio viajar y pregunta cuanto sale.

   - Grupos: los que se anotan a mano (Facebook, WhatsApp, Reddit, foros), con su estado y si aceptan links. Cada uno
     tiene su link cuantosale.uy/?utm_source=grupo-<codigo>: la web lo recuerda 30 dias (home-track.js) y el pedido
     queda con origen "web:grupo-<codigo>". Visitas: los eventos 'llegada' de lib/uso.js (90 dias).
   - Respuestas: cada aporte que se deja (grupo, fecha, de que era la pregunta, si llevaba el link). Meta: 3 por dia.
   - Regla 4 a 1: 4 respuestas sin link y recien la 5ª, si preguntan "¿cuanto me sale?", con link.
   Todo se guarda en lib/marketing.js (grupos y aportes).

   Lo carga admin.js (vistaMkt) la primera vez que se abre la pestana. */
(function () {
  var META_DIA = 3, SIN_LINK = 4;
  var ESTADOS = [['buscar', 'Por entrar'], ['pedido', 'Pedí entrar'], ['unido', 'Adentro'], ['activo', 'Respondo seguido'], ['nosirve', 'No sirve']];
  var REDES = [['facebook', 'Facebook'], ['whatsapp', 'WhatsApp'], ['reddit', 'Reddit'], ['instagram', 'Instagram'], ['telegram', 'Telegram'], ['foro', 'Foro'], ['otra', 'Otra']];
  var ORDEN = { activo: 0, unido: 1, pedido: 2, buscar: 3, nosirve: 4 };
  var BUSCAR = [
    ['Viajar a Brasil desde Uruguay', 'https://www.facebook.com/search/groups/?q=' + encodeURIComponent('viajar a Brasil Uruguay')],
    ['Uruguayos en Florianópolis', 'https://www.facebook.com/search/groups/?q=' + encodeURIComponent('uruguayos Florianópolis')],
    ['Nordeste desde Uruguay', 'https://www.facebook.com/search/groups/?q=' + encodeURIComponent('Nordeste Brasil Uruguay')],
    ['Búzios viajeros', 'https://www.facebook.com/search/groups/?q=' + encodeURIComponent('Búzios viajeros')],
    ['Porto de Galinhas viajeros', 'https://www.facebook.com/search/groups/?q=' + encodeURIComponent('Porto de Galinhas viajeros')],
    ['Mochileros Brasil', 'https://www.facebook.com/search/groups/?q=' + encodeURIComponent('mochileros Brasil')],
    ['r/uruguay: preguntas de Brasil', 'https://www.reddit.com/r/uruguay/search/?q=brasil&sort=new'],
    ['Foros de TripAdvisor (Brasil)', 'https://www.google.com/search?q=' + encodeURIComponent('site:tripadvisor.com.ar ShowTopic Brasil traslado')]
  ];
  /* Subreddits para sumar con un toque: [nombre, link, si acepta links, nota]. */
  var SUGERIDOS = [
    ['r/uruguay', 'https://www.reddit.com/r/uruguay/', '', 'Tu público directo. El post mensual con precios va acá. Avisá siempre que la app es tuya.'],
    ['r/Montevideo', 'https://www.reddit.com/r/Montevideo/', '', 'Más chico, la misma gente. Mejor responder que postear.'],
    ['r/viajes', 'https://www.reddit.com/r/viajes/', '', 'Viajeros en español. El post con precios sirve si aporta datos, no links.'],
    ['r/argentina', 'https://www.reddit.com/r/argentina/', 'no', 'Muchos van a Floripa y Bombinhas. Muy estrictos con la autopromoción: solo responder.'],
    ['r/Brazil', 'https://www.reddit.com/r/Brazil/', 'no', 'En inglés: extranjeros preguntando traslados y destinos. Solo respuestas útiles.'],
    ['r/brasil', 'https://www.reddit.com/r/brasil/', 'no', 'En portugués, casi todo de brasileños. Solo si preguntan por turistas.']
  ];
  var MODELOS = [
    ['Pregunta de precio (sin link)', 'Te paso lo que vengo viendo para [mes]: el vuelo [ciudad] ida y vuelta anda en US$ [x] por persona. Del aeropuerto a [destino] son [horas]; el traslado compartido sale unos US$ [y] por persona y el privado US$ [z] por auto (si van 3 o 4, conviene el privado).\n\nOjo que el vuelo cambia mucho según el día: saliendo [día] suele estar más barato.'],
    ['La 5ª respuesta (con link)', 'Para una semana de a 2 calculá unos US$ [total] por persona entre vuelo, traslado y alojamiento, sin comidas.\n\nSi querés verlo con tus fechas, lo armamos todo sumado en Cuánto Sale (somos uruguayos, es gratis): [link del grupo]'],
    ['Grupo que no acepta links', '[El dato concreto que preguntaron].\n\nSi te sirve, nosotros armamos el viaje entero sumado (vuelo, traslado, alojamiento y paseos) en una app que se llama Cuánto Sale: la encontrás en Google.'],
    ['Post para Reddit (precios del 12 y 13/10: actualizalos el día que lo publiques)', 'Título: Sumé lo que sale de verdad una semana en Brasil saliendo de Montevideo. El pasaje es la mitad del viaje\n\n' +
      'Cada verano aparece acá la misma pregunta, «¿cuánto me sale ir a Brasil?», y casi siempre la respuesta es el precio del pasaje. Así que sumamos todo para varios destinos, de a 2 y 7 noches, con precios consultados el 12 y 13 de octubre:\n\n' +
      '| Destino | Fechas | Por persona | Qué incluye |\n|---|---|---|---|\n' +
      '| Río de Janeiro | 25/10 al 1/11 | US$ 608 | Vuelo Gol directo, traslado y alojamiento |\n' +
      '| Balneário Camboriú | 9 al 16/2 | US$ 826 | Vuelo, traslado, hotel, comidas y moverse |\n' +
      '| Bombinhas | enero | US$ 958 | El viaje entero |\n' +
      '| Jericoacoara | 9 al 16/1 | US$ 1.222 | Vuelo, traslado, posada, comidas (sin paseos) |\n\n' +
      'Lo que aprendimos armándolo:\n\n' +
      '- **Mover un día la salida pesa más que cambiar de hotel.** A Camboriú, saliendo el 31/12 en vez del 3/1 son US$ 224 menos para los 2, con las mismas noches.\n' +
      '- **El traslado es lo que nadie calcula.** Búzios está a 174 km del aeropuerto de Río: traslado compartido ida y vuelta y un paseo en barco son unos US$ 86 por persona. Jeri está a 5 h 36 de Fortaleza, y el último tramo es por arena.\n' +
      '- **A Camboriú en auto cierra si tenés los días.** Nafta y peajes, ida y vuelta (2.620 km): unos US$ 302 para los 2, contra US$ 713 del vuelo.\n\n' +
      'Si quieren que mire otro destino o fechas, pregunten y lo sumo en los comentarios.\n\n' +
      'Para que quede claro: los números salen de Cuánto Sale, una app uruguaya que hicimos nosotros. Calcular es gratis; ganamos si alguien reserva un traslado o un paseo con nosotros.'],
    ['Pedir entrar al grupo', 'Hola! Somos uruguayos y armamos viajes a Brasil (Cuánto Sale). Nos gustaría sumarnos para responder dudas de traslados, horarios y precios con datos actualizados. No hacemos spam ni publicamos promociones.']
  ];

  window.CSGruposPanel = function (ctx) {
    var S = ctx.S, esc = ctx.esc;
    var st = { abierto: {}, agregando: false, textos: [] };

    function estado() { return S.mkt.estado; }
    function link(g) { return 'https://cuantosale.uy/?utm_source=grupo-' + g.codigo; }
    function fechaCorta(f) { return f ? f.slice(8, 10) + '/' + f.slice(5, 7) : ''; }
    function sumarDias(f, n) { var d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function slug(t) {
      return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16).replace(/-+$/, '');
    }
    function opciones(lista, v) { return lista.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
    function etiqueta(lista, v) { return (lista.filter(function (o) { return o[0] === v; })[0] || [v, v])[1]; }
    function copiable(titulo, t) {
      var i = st.textos.push(t) - 1;
      return '<div class="mkt-copy"><div class="mkt-copy__cab"><small>' + esc(titulo) + '</small><button class="btn btn--sm" data-gr-copiar="' + i + '">Copiar</button></div><pre>' + esc(t) + '</pre></div>';
    }

    function grupos() {
      var gs = estado().grupos || {};
      return Object.keys(gs).filter(function (id) { return !gs[id].oculto; }).map(function (id) { return Object.assign({ id: id, estado: 'buscar', red: 'facebook' }, gs[id]); });
    }
    function aportes() { return (estado().aportes || []).map(function (a, n) { return Object.assign({ n: n }, a); }); }

    /* Todo lo de cada grupo: respuestas, cuantas sin link desde la ultima con link, visitas y pedidos con su link. */
    function cuentas() {
      var gs = grupos(), porId = {}, porCodigo = {}, as = aportes();
      gs.forEach(function (g) {
        var x = { g: g, aportes: [], sinLink: 0, ultima: '', visitas: 0, pedidos: 0, confirmados: 0 };
        porId[g.id] = x; if (g.codigo) porCodigo['grupo-' + g.codigo] = x;
      });
      as.forEach(function (a) {
        var x = porId[a.grupo]; if (!x) return;
        x.aportes.push(a);
        x.sinLink = a.link ? 0 : x.sinLink + 1;
        if (a.fecha > x.ultima) x.ultima = a.fecha;
      });
      ((S.mktUso && S.mktUso.filas) || []).forEach(function (f) { if (f.evento === 'llegada' && porCodigo[f.detalle]) porCodigo[f.detalle].visitas += f.n; });
      ((S.datos && S.datos.pedidos) || []).forEach(function (p) {
        var m = /^web:(grupo-.+)$/.exec(p.origen || ''), x = m && porCodigo[m[1]];
        if (!x || p.estado === 'cancelado') return;
        x.pedidos++; if (p.estado === 'confirmado' || p.estado === 'completado') x.confirmados++;
      });
      return gs.map(function (g) { return porId[g.id]; }).sort(function (a, b) {
        return (ORDEN[a.g.estado] - ORDEN[b.g.estado]) || String(b.ultima).localeCompare(String(a.ultima)) || String(a.g.nombre).localeCompare(String(b.g.nombre));
      });
    }

    /* La regla 4 a 1, dicha para este grupo. */
    function regla(x) {
      if (x.g.links === 'no') return '<p class="gr__regla gr__regla--no">No acepta links: dejá el dato y, si viene al caso, nombrá «Cuánto Sale» para que lo busquen.</p>';
      if (x.sinLink >= SIN_LINK) return '<p class="gr__regla gr__regla--ok">Ya diste ' + x.sinLink + ' respuestas sin link: en la próxima que pregunten «¿cuánto me sale?» podés dejar el link.</p>';
      var f = SIN_LINK - x.sinLink;
      return '<p class="gr__regla">Faltan ' + f + ' respuesta' + (f === 1 ? '' : 's') + ' sin link antes de poder dejar el link (regla 4 a 1).</p>';
    }

    function tarjeta(x) {
      var g = x.g, abierto = st.abierto[g.id];
      var a = function (campo) { return ' data-gr-id="' + esc(g.id) + '" data-gr-campo="' + campo + '"'; };
      var h = '<article class="gr gr--' + esc(g.estado) + '"><header class="gr__cab"><div class="gr__nom"><h3>' +
        (g.url ? '<a href="' + esc(g.url) + '" target="_blank" rel="noopener">' + esc(g.nombre || 'Grupo') + '</a>' : esc(g.nombre || 'Grupo')) + '</h3>' +
        '<small>' + esc(etiqueta(REDES, g.red)) + (g.miembros ? ' · ' + esc(g.miembros) + ' miembros' : '') + '</small></div>' +
        '<select class="gr__estado"' + a('estado') + ' aria-label="Estado">' + opciones(ESTADOS, g.estado) + '</select></header>';
      if (g.estado === 'unido' || g.estado === 'activo') {
        h += '<div class="gr__stats"><div><b>' + x.aportes.length + '</b><small>respuestas</small></div>' +
          '<div><b>' + (x.ultima ? esc(fechaCorta(x.ultima)) : '—') + '</b><small>la última</small></div>' +
          '<div><b>' + x.visitas + '</b><small>visitas con su link</small></div>' +
          '<div><b>' + x.confirmados + '<i>/' + x.pedidos + '</i></b><small>confirmados / pedidos</small></div></div>' + regla(x);
      }
      if (g.codigo && g.links !== 'no') h += '<div class="gr__link"><code>' + esc(link(g).replace('https://', '')) + '</code><button class="btn btn--sm" data-gr-copiar-link="' + esc(g.id) + '">Copiar link</button></div>';
      h += '<button class="gr__mas" data-gr-abrir="' + esc(g.id) + '" aria-expanded="' + !!abierto + '">' + (abierto ? 'Ocultar' : 'Editar datos, reglas y notas') + '</button>';
      if (abierto) {
        h += '<div class="gr__ajustes">' +
          '<label class="f">Nombre<input' + a('nombre') + ' value="' + esc(g.nombre || '') + '" maxlength="120"></label>' +
          '<label class="f">Red<select' + a('red') + '>' + opciones(REDES, g.red) + '</select></label>' +
          '<label class="f gr__ancho">Link del grupo<input' + a('url') + ' value="' + esc(g.url || '') + '" placeholder="https://…" inputmode="url"></label>' +
          '<label class="f">Miembros<input' + a('miembros') + ' value="' + esc(g.miembros || '') + '" placeholder="ej. 12k" maxlength="12"></label>' +
          '<label class="f">¿Acepta links?<select' + a('links') + '>' + opciones([['', 'No sé todavía'], ['si', 'Sí'], ['no', 'No']], g.links || '') + '</select></label>' +
          '<label class="f">Código del link<input' + a('codigo') + ' value="' + esc(g.codigo || '') + '" maxlength="16"></label>' +
          '<label class="f gr__ancho">Notas (reglas del grupo, quién es el admin, qué preguntan)<textarea' + a('nota') + ' rows="3" maxlength="1000">' + esc(g.nota || '') + '</textarea></label>' +
          '</div>';
        if (x.aportes.length) h += '<ul class="gr__aportes">' + x.aportes.slice(-8).reverse().map(function (y) {
          return '<li><span>' + esc(fechaCorta(y.fecha)) + ' · ' + esc(y.tema || 'respuesta') + '</span>' + (y.link ? '<em>con link</em>' : '') + '</li>';
        }).join('') + '</ul>';
        h += '<button class="btn btn--sm gr__quitar" data-gr-quitar="' + esc(g.id) + '">Quitar el grupo</button>';
      }
      return h + '</article>';
    }

    function vista() {
      st.textos = [];
      var xs = cuentas(), as = aportes(), hoy = ctx.hoy(), desde = sumarDias(hoy, -6);
      var deHoy = as.filter(function (a) { return a.fecha === hoy; }).length;
      var semana = as.filter(function (a) { return a.fecha >= desde && a.fecha <= hoy; }).length;
      var adentro = xs.filter(function (x) { return x.g.estado === 'unido' || x.g.estado === 'activo'; });
      var visitas = 0; ((S.mktUso && S.mktUso.filas) || []).forEach(function (f) { if (f.evento === 'llegada' && /^grupo-/.test(f.detalle || '')) visitas += f.n; });
      var pedidos = xs.reduce(function (t, x) { return t + x.pedidos; }, 0);

      var h = '<div class="vhead"><div><h2>Grupos y foros</h2><p>Costo bajo (solo tu tiempo), impacto muy alto: ahí está la gente que ya decidió viajar y pregunta cuánto sale. ' +
        META_DIA + ' respuestas por día, con datos concretos y sin spam.</p></div></div>';
      h += '<section class="kpis kpis--4">' +
        ctx.kpi('Respuestas hoy', deHoy + ' / ' + META_DIA, deHoy >= META_DIA ? 'listo por hoy' : 'faltan ' + (META_DIA - deHoy), deHoy >= META_DIA ? 'kpi--ok' : '') +
        ctx.kpi('Últimos 7 días', semana, 'meta: ' + META_DIA * 7 + ' respuestas') +
        ctx.kpi('Grupos adentro', adentro.length, xs.length ? 'de ' + xs.length + ' anotados' : 'anotá el primero abajo') +
        ctx.kpi('Visitas desde grupos', visitas, pedidos ? pedidos + ' pedido' + (pedidos === 1 ? '' : 's') + ' · 90 días' : 'últimos 90 días') + '</section>';

      /* Anotar una respuesta */
      var elegibles = adentro.length ? adentro : xs;
      h += '<section class="sec gr-anotar"><h3>Anotar una respuesta</h3>';
      if (!xs.length) h += '<p class="sub">Primero agregá un grupo (abajo) para poder anotar lo que respondés.</p>';
      else {
        h += '<form class="gr-anotar__f" data-gr-aporte><select name="grupo" required>' + elegibles.map(function (x) {
          return '<option value="' + esc(x.g.id) + '">' + esc(x.g.nombre || 'Grupo') + (x.g.links !== 'no' && x.sinLink >= SIN_LINK ? ' · ya podés dejar link' : '') + '</option>';
        }).join('') + '</select><input name="tema" placeholder="¿Qué preguntaban? ej. traslado Floripa → Bombinhas" maxlength="200">' +
          '<label class="gr-anotar__chk"><input type="checkbox" name="link"> Dejé el link</label><button class="btn btn--pri" type="submit">Anotar</button></form>';
        var ult = as.slice(-6).reverse(), nombre = {}; xs.forEach(function (x) { nombre[x.g.id] = x.g.nombre; });
        if (ult.length) h += '<ul class="gr__aportes">' + ult.map(function (y) {
          return '<li><span>' + esc(fechaCorta(y.fecha)) + ' · <b>' + esc(nombre[y.grupo] || 'grupo quitado') + '</b> · ' + esc(y.tema || 'respuesta') + '</span>' + (y.link ? '<em>con link</em>' : '') +
            '<button class="gr__x" data-gr-borrar-aporte="' + y.n + '" title="Borrar">×</button></li>';
        }).join('') + '</ul>';
      }
      h += '</section>';

      /* Preguntas que se repiten: material para videos y respuestas guardadas. */
      var temas = {}; as.forEach(function (a) { var k = String(a.tema || '').trim().toLowerCase(); if (k) temas[k] = (temas[k] || 0) + 1; });
      var rep = Object.keys(temas).filter(function (k) { return temas[k] > 1; }).sort(function (a, b) { return temas[b] - temas[a]; }).slice(0, 6);
      if (rep.length) h += '<section class="gr-rep"><h3>Lo que más preguntan</h3><p class="sub">Cada una de estas es un video «Preguntas que nos hacen» y una respuesta guardada en WhatsApp.</p><ul>' +
        rep.map(function (k) { return '<li><b>' + temas[k] + '×</b> ' + esc(k) + '</li>'; }).join('') + '</ul></section>';

      /* Los grupos */
      h += '<div class="gr-tit"><h3>Tus grupos</h3><button class="btn btn--sm' + (xs.length ? '' : ' btn--pri') + '" data-gr-agregar>' + (st.agregando ? 'Cancelar' : '+ Agregar grupo') + '</button></div>';
      if (st.agregando) {
        h += '<form class="gr-nuevo" data-gr-nuevo><label class="f">Nombre del grupo<input name="nombre" required maxlength="120" placeholder="ej. Viajeros a Floripa desde Uruguay"></label>' +
          '<label class="f">Red<select name="red">' + opciones(REDES, 'facebook') + '</select></label>' +
          '<label class="f">Link<input name="url" placeholder="https://…" inputmode="url"></label>' +
          '<label class="f">Miembros<input name="miembros" placeholder="ej. 12k" maxlength="12"></label>' +
          '<button class="btn btn--pri" type="submit">Agregar</button></form>';
      }
      h += xs.length ? '<div class="gr-grid">' + xs.map(tarjeta).join('') + '</div>' :
        '<div class="cr-vacio"><b>Todavía no anotaste ningún grupo.</b><p>Buscalos con los botones de abajo, quedate con los que tengan publicaciones de esta semana y agregalos acá.</p></div>';

      /* Subreddits sugeridos que todavia no se agregaron */
      var yaEsta = {}; grupos().forEach(function (g) { yaEsta[String(g.url || '').toLowerCase()] = 1; });
      var faltan = SUGERIDOS.filter(function (r) { return !yaEsta[r[1].toLowerCase()]; });
      if (faltan.length) h += '<section class="sec"><h3>Reddit: sugeridos</h3><p class="sub">Agregalos y leé las reglas de cada uno (en la barra del costado) antes de postear.</p><ul class="gr-sug">' +
        faltan.map(function (r) {
          return '<li><div><a href="' + esc(r[1]) + '" target="_blank" rel="noopener"><b>' + esc(r[0]) + '</b></a><small>' + esc(r[3]) + '</small></div>' +
            '<button class="btn btn--sm" data-gr-sugerido="' + SUGERIDOS.indexOf(r) + '">Agregar a mis grupos</button></li>';
        }).join('') + '</ul></section>';

      /* Donde buscar, reglas y respuestas modelo */
      h += '<section class="sec"><h3>Dónde buscar</h3><p class="sub">Quedate con los que tengan publicaciones de esta semana y gente preguntando, no solo fotos.</p><div class="gr-buscar">' +
        BUSCAR.map(function (b) { return '<a class="btn btn--sm" href="' + esc(b[1]) + '" target="_blank" rel="noopener">' + esc(b[0]) + ' ↗</a>'; }).join('') + '</div></section>';
      h += '<section class="sec"><h3>Las reglas</h3><ul class="mkt-ul">' +
        '<li><b>4 a 1:</b> 4 respuestas sin link, con el dato concreto (precio, horas de traslado, qué día sale más barato). Recién en la 5ª, si preguntan «¿cuánto me sale?», el link.</li>' +
        '<li><b>Nunca la misma respuesta pegada en todos lados:</b> adaptala a lo que preguntaron. Los admins echan a quien copia y pega.</li>' +
        '<li><b>Decí quién sos</b> si te preguntan: «somos de Cuánto Sale». Nada de hacerse pasar por un viajero cualquiera.</li>' +
        '<li><b>No abras publicaciones de promoción.</b> En Reddit, como mucho 1 post por mes y que sea un aporte con datos (el modelo de abajo), avisando que la app es tuya. El resto del tiempo, solo respondé.</li>' +
        '<li><b>Leé las reglas del grupo</b> antes de la primera respuesta y anotalas en el grupo (si acepta links o no).</li></ul></section>';
      h += '<section class="sec"><h3>Respuestas modelo</h3><p class="sub">Completá lo que va entre corchetes con el dato real del día. El link de cada grupo lo copiás de su tarjeta.</p><div class="gr-modelos">' +
        MODELOS.map(function (m) { return copiable(m[0], m[1]); }).join('') + '</div></section>';
      return h;
    }

    function guardar(cuerpo) { return ctx.guardarMkt(cuerpo).then(function () { ctx.pintar(); }); }
    function codigoLibre(nombre, menos) {
      var usados = {}; grupos().forEach(function (g) { if (g.codigo && g.id !== menos) usados[g.codigo] = 1; });
      var base = slug(nombre); if (base.length < 2) base = 'g' + Date.now().toString(36).slice(-5);
      var cod = base, n = 2; while (usados[cod]) cod = base.slice(0, 14) + n++;
      return cod;
    }

    /* ---------- eventos (solo los controles de esta pestana) ---------- */
    function aqui() { return S.vista === 'mkt-grupos'; }
    document.addEventListener('click', function (e) {
      if (!aqui()) return;
      var t = e.target.closest('[data-gr-copiar],[data-gr-copiar-link],[data-gr-abrir],[data-gr-agregar],[data-gr-quitar],[data-gr-borrar-aporte],[data-gr-sugerido]');
      if (!t) return;
      e.preventDefault();
      if (t.hasAttribute('data-gr-sugerido')) {
        var r = SUGERIDOS[+t.getAttribute('data-gr-sugerido')]; if (!r) return;
        t.disabled = true;
        guardar({ grupo: { id: 'g' + Date.now().toString(36), campos: { nombre: r[0], red: 'reddit', url: r[1], links: r[2], nota: r[3], estado: 'buscar', codigo: codigoLibre(r[0]) } } }).then(function () { ctx.toast(r[0] + ' agregado'); });
        return;
      }
      if (t.hasAttribute('data-gr-copiar')) return ctx.copiar(st.textos[+t.getAttribute('data-gr-copiar')] || '');
      if (t.hasAttribute('data-gr-copiar-link')) { var g = grupos().filter(function (x) { return x.id === t.getAttribute('data-gr-copiar-link'); })[0]; if (g) ctx.copiar(link(g)); return; }
      if (t.hasAttribute('data-gr-abrir')) { var id = t.getAttribute('data-gr-abrir'); st.abierto[id] = !st.abierto[id]; ctx.pintar(); return; }
      if (t.hasAttribute('data-gr-agregar')) { st.agregando = !st.agregando; ctx.pintar(); return; }
      if (t.hasAttribute('data-gr-quitar')) { if (confirm('¿Quitar este grupo? Las respuestas anotadas quedan.')) guardar({ grupo: { id: t.getAttribute('data-gr-quitar'), campos: { oculto: true } } }); return; }
      if (t.hasAttribute('data-gr-borrar-aporte') && confirm('¿Borrar esta respuesta?')) guardar({ aporteBorrar: { n: +t.getAttribute('data-gr-borrar-aporte') } });
    });
    document.addEventListener('submit', function (e) {
      if (!aqui()) return;
      var f = e.target;
      if (f.hasAttribute('data-gr-nuevo')) {
        e.preventDefault();
        var id = 'g' + Date.now().toString(36);
        var campos = { nombre: f.nombre.value, red: f.red.value, url: f.url.value.trim(), miembros: f.miembros.value, estado: 'buscar', codigo: codigoLibre(f.nombre.value) };
        if (campos.url && !/^https?:\/\//i.test(campos.url)) campos.url = 'https://' + campos.url;
        ctx.guardarMkt({ grupo: { id: id, campos: campos } }).then(function () { st.agregando = false; ctx.pintar(); });
      } else if (f.hasAttribute('data-gr-aporte')) {
        e.preventDefault();
        guardar({ aporte: { grupo: f.grupo.value, fecha: ctx.hoy(), tema: f.tema.value, link: f.link.checked } }).then(function () { ctx.toast('Anotada'); });
      }
    });
    document.addEventListener('change', function (e) {
      if (!aqui()) return;
      var el = e.target, id = el.getAttribute && el.getAttribute('data-gr-id');
      if (!id) return;
      var campo = el.getAttribute('data-gr-campo'), v = String(el.value).trim(), campos = {};
      if (campo === 'codigo') v = v.toLowerCase();
      if (campo === 'url' && v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
      campos[campo] = v;
      /* Al pasar a "Adentro" se le asegura el codigo del link. */
      var g = grupos().filter(function (x) { return x.id === id; })[0];
      if (g && !g.codigo && campo !== 'codigo') campos.codigo = codigoLibre(g.nombre, id);
      guardar({ grupo: { id: id, campos: campos } });
    });

    /* estilos propios de la pestana (reusa .cr-vacio de Creadores si ya cargo; si no, el suyo) */
    if (!document.getElementById('gr-css')) {
      var css = document.createElement('style'); css.id = 'gr-css';
      css.textContent =
        '.gr-anotar__f{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.gr-anotar__f select{flex:1 1 200px;width:auto}.gr-anotar__f input[name=tema]{flex:2 1 260px;width:auto}' +
        '.gr-anotar__chk{display:flex;align-items:center;gap:6px;font-size:14px;white-space:nowrap}' +
        '.gr-tit{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:24px 0 0}.gr-tit h3{margin:0}' +
        '.gr-nuevo{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;align-items:end;margin-top:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}' +
        '.gr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:14px;margin:14px 0 8px;align-items:start}' +
        '.gr{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;min-width:0}' +
        '.gr--activo{border-left-color:var(--ok)}.gr--unido{border-left-color:var(--info)}.gr--pedido{border-left-color:var(--warn)}.gr--nosirve{opacity:.6}' +
        '.gr__cab{display:flex;align-items:flex-start;gap:10px}.gr__nom{flex:1;min-width:0}.gr__nom h3{margin:0;font-size:16px;line-height:1.3;overflow-wrap:anywhere}' +
        '.gr__nom h3 a{color:inherit}.gr__nom small{color:var(--muted);font-size:13px}.gr__estado{width:auto;flex:none;max-width:48%}' +
        '.gr__stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}' +
        '.gr__stats div{background:var(--card);padding:8px 6px;text-align:center}.gr__stats b{display:block;font-size:17px;font-variant-numeric:tabular-nums}' +
        '.gr__stats b i{font-style:normal;color:var(--muted);font-weight:500;font-size:13px}.gr__stats small{color:var(--muted);font-size:11px;line-height:1.2;display:block}' +
        '.gr__regla{margin:0;font-size:13.5px;border-radius:10px;padding:8px 12px;background:var(--bg)}.gr__regla--ok{background:var(--okbg);color:var(--ok);font-weight:600}.gr__regla--no{background:var(--warnbg)}' +
        '.gr__link{display:flex;align-items:center;gap:8px;background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:6px 6px 6px 12px}' +
        '.gr__link code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}' +
        '.gr__mas{background:none;border:0;border-top:1px solid var(--line);padding:10px 0 0;color:var(--info);font-weight:600;text-align:left;cursor:pointer;font-size:13.5px}' +
        '.gr__ajustes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gr__ancho{grid-column:1/-1}.gr__ajustes textarea{width:100%;resize:vertical}' +
        '.gr__aportes{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}' +
        '.gr__aportes li{display:flex;align-items:center;gap:8px;font-size:13.5px;padding:6px 10px;border-radius:9px;background:var(--bg)}.gr__aportes li span{flex:1;min-width:0}' +
        '.gr__aportes em{font-style:normal;font-size:12px;font-weight:700;color:var(--ok);background:var(--okbg);border-radius:99px;padding:1px 8px}' +
        '.gr__x{background:none;border:0;color:var(--muted);font-size:16px;line-height:1;cursor:pointer;padding:0 4px}.gr__x:hover{color:var(--bad)}' +
        '.gr__quitar{align-self:flex-start}' +
        '.gr-rep{margin-top:16px;background:var(--infobg);border-radius:16px;padding:14px 18px}.gr-rep h3{margin:0}.gr-rep .sub{margin:2px 0 8px}' +
        '.gr-rep ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.gr-rep li{background:var(--card);border-radius:99px;padding:4px 12px;font-size:13.5px}' +
        '.gr-buscar{display:flex;flex-wrap:wrap;gap:6px}' +
        '.gr-sug{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:8px}' +
        '.gr-sug li{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 10px 10px 14px}' +
        '.gr-sug li div{flex:1;min-width:0}.gr-sug a{color:inherit}.gr-sug small{display:block;color:var(--muted);font-size:12.5px;line-height:1.35}' +
        '.gr-modelos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:10px}.gr-modelos pre{white-space:pre-wrap}' +
        '.cr-vacio{margin-top:14px;border:2px dashed var(--line);border-radius:18px;padding:24px;text-align:center;color:var(--muted)}.cr-vacio b{color:var(--ink);font-size:16px}' +
        '@media (max-width:560px){.gr{padding:13px}.gr__stats{grid-template-columns:repeat(2,1fr)}.gr__ajustes{grid-template-columns:1fr}.gr-anotar__f .btn{width:100%}}';
      document.head.appendChild(css);
    }
    return { vista: vista };
  };
})();
