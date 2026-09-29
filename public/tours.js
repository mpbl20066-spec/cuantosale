'use strict';
/*
 * Panel de edicion del catalogo de tours: /tours
 *
 * Habla con Supabase desde el navegador, con la ANON key, igual que hace
 * /grupo para el split de gastos. Y NO hay contradiccion con que la tabla este
 * cerrada: la tabla no se abre, lo que se abren son las funciones.
 *
 * Que se pueda escribir el catalogo desde el navegador NO significa que se
 * pueda leer entero. tours_todos() y tours_para_cliente() son de solo lectura
 * y devuelven lo mismo que veria cualquiera. Escribir pasa por tours_guardar(),
 * tours_borrar() y tours_alternar_activo(), que son SECURITY DEFINER y
 * comprueban public.es_agencia() DENTRO: la respuesta sale de la base, no de un
 * if del navegador, que es del cliente y se puede editar.
 *
 * Por que el panel existe y no se edita la tabla en la consola de Supabase:
 * editar precio_brl a mano deja R$ 190 donde la UI espera dolares, y el error
 * aparece en la card de un destino, semanas despues, sin relacion aparente. Aca
 * el precio se ve en la misma unidad en que se muestra.
 */
(function () {
  'use strict';

  var client = null;
  var authUser = null;
  var catalogo = [];
  var editando = null;   // { destino, titulo } del tour en edicion, o null para uno nuevo

  var $ = function (sel) { return document.querySelector(sel); };
  var lista = $('[data-list]');
  var status = $('[data-status]');
  var bar = $('[data-bar]');
  var editor = $('[data-editor]');
  var nota = $('[data-nota]');
  var botonSalir = document.querySelector('[data-signout]');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function avisar(texto, tipo) {
    if (!texto) { status.hidden = true; status.textContent = ''; return; }
    status.hidden = false;
    status.textContent = texto;
    status.className = 'panel-status ' + (tipo === 'ok' ? 'is-ok' : 'is-error');
  }

  async function sdk() {
    if (window.supabase && window.supabase.createClient) return;
    await new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('No pudimos cargar el servicio de cuenta.')); };
      document.head.appendChild(s);
    });
  }

  async function conectar() {
    await sdk();
    var cfg = await fetch('/api/config').then(function (r) { return r.json(); });
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      avisar('Falta SUPABASE_URL o SUPABASE_ANON_KEY en el servidor. El panel no puede funcionar sin ellas.');
      lista.innerHTML = '';
      return null;
    }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return client;
  }

  async function sesion() {
    var r = await client.auth.getSession();
    var s = r.data && r.data.session;
    if (!s) return null;
    var u = await client.auth.getUser();
    return (u.data && u.data.user) || null;
  }

  /* Que la persona sea de la agencia.
   *
   * Esto NO decide nada: es solo para no mostrarle el panel a quien no puede
   * escribir. La decision real la toma tours_guardar() dentro de la base. Si
   * esta comprobacion mintiera, el guardado igual fallaria con "no autorizado".
   *
   * Se llama al RPC y no se lee la tabla de agencia a mano porque la tabla no
   * tiene grants para anon: leerla directo dari��a "permission denied". */
  async function esAgencia() {
    try {
      var r = await client.rpc('es_agencia');
      if (r.error) throw r.error;
      return !!r.data;
    } catch (e) {
      return false;
    }
  }

  async function cargar() {
    avisar('Cargando el catálogo…');
    var r = await client.rpc('tours_todos');
    if (r.error) {
      // El error mas probable es que falte correr supabase_tours.sql. Se dice
      // exactamente eso, porque el mensaje de PostgREST ("relation does not
      // exist") no dice de donde sale el problema.
      var msg = r.error.message || '';
      avisar('No pudimos leer el catálogo: ' + msg +
        (/\.?\s*relation|tours_todos/i.test(msg)
          ? ' — Si es la primera vez, corré supabase_tours.sql en el SQL Editor de Supabase.'
          : ''));
      lista.innerHTML = '<div class="empty">Sin catálogo.</div>';
      bar.hidden = true;
      return;
    }
    catalogo = Array.isArray(r.data) ? r.data : [];
    avisar('');
    bar.hidden = false;
    pintarDestinos();
    pintar();
  }

  function destinosConocidos() {
    // Lo que hay en la tabla, mas el mapa de destinos que ya esta verificado en
    // data/tours.json. El mapa va aparte porque se expone como global desde
    // public/tours.generated.js, y asi el desplegable ofrece tambien los
    // destinos que todavia no tienen ningun tour: es la forma de crear el
    // primero sin escribir la key de memoria.
    var set = new Set(catalogo.map(function (t) { return t.destino; }));
    var mapa = window.CS_TOURS_META && window.CS_TOURS_META.destinos;
    if (mapa) Object.keys(mapa).forEach(function (k) { set.add(k); });
    return [...set].sort();
  }

  function pintarDestinos() {
    var sel = $('#filtroDestino');
    var actual = sel.value;
    sel.innerHTML = '<option value="">Todos los destinos</option>' +
      destinosConocidos().map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('');
    sel.value = actual;
  }

  function visibles() {
    var q = ($('#q').value || '').trim().toLowerCase();
    var d = $('#filtroDestino').value;
    var soloOff = $('#soloInactivos').checked;
    return catalogo.filter(function (t) {
      if (soloOff ? t.activo : !t.activo) return false;
      if (d && t.destino !== d) return false;
      if (q && (String(t.titulo).toLowerCase().indexOf(q) < 0 && String(t.destino).toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
  }

  function precioDe(t) {
    // La funcion tours_todos ya devuelve el precio convertido. Se muestra el
    // de origen aparte, porque es el que hay que re-cotizar cuando la moneda
    // se mueve y el derivado no dice nada de eso.
    if (t.precio_brl != null) return 'US$ ' + Number(t.precio).toFixed(2) + ' · R$ ' + Number(t.precio_brl).toFixed(2);
    return 'US$ ' + Number(t.precio || 0).toFixed(2);
  }

  function pintar() {
    var listaFiltrada = visibles();
    $('[data-count]').textContent = listaFiltrada.length + ' de ' + catalogo.length;
    if (!listaFiltrada.length) {
      lista.innerHTML = '<div class="empty">' + (catalogo.length ? 'Ninguno coincide con el filtro.' : 'La tabla está vacía. Cargá los tours o creá el primero abajo.') + '</div>';
      return;
    }
    lista.innerHTML = listaFiltrada.map(function (t) {
      return '<div class="tour-row' + (t.activo ? '' : ' is-off') + '">' +
        '<div class="tour-row__main">' +
        '<p class="tour-row__title">' + esc(t.titulo) + '</p>' +
        '<div class="tour-row__meta">' +
        '<code>' + esc(t.destino) + '</code>' +
        '<span>' + esc(precioDe(t)) + '</span>' +
        (t.fuente ? '<span>' + esc(t.fuente) + '</span>' : '') +
        (t.activo ? '' : '<span>desactivado</span>') +
        '</div></div>' +
        '<div class="tour-row__actions">' +
        '<button type="button" data-editar="' + esc(t.destino) + '|' + esc(t.titulo) + '">Editar</button>' +
        '<button type="button" data-toggle="' + esc(t.destino) + '|' + esc(t.titulo) + '">' + (t.activo ? 'Desactivar' : 'Activar') + '</button>' +
        '<button type="button" class="danger" data-borrar="' + esc(t.destino) + '|' + esc(t.titulo) + '">Borrar</button>' +
        '</div></div>';
    }).join('');
  }

  function abrirEditor(t) {
    editando = t ? { destino: t.destino, titulo: t.titulo } : null;
    var f = editor.querySelectorAll('input, textarea');
    editor.hidden = false;
    $('[data-editor-title]').textContent = t ? 'Editar tour' : 'Nuevo tour';
    editor.destino.value = t ? t.destino : '';
    editor.titulo.value = t ? t.titulo : '';
    editor.descripcion.value = t ? (t.descripcion || '') : '';
    editor.precio.value = t && t.precio_brl == null && t.precio != null ? t.precio : '';
    editor.precio_brl.value = t && t.precio_brl != null ? t.precio_brl : '';
    editor.fuente.value = t ? (t.fuente || '') : '';
    editor.detalle.value = t ? (t.detalle || '') : '';
    editor.activo.checked = t ? !!t.activo : true;
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void f;
  }

  function cerrarEditor() {
    editor.hidden = true;
    editando = null;
  }

  async function guardar(evento) {
    evento.preventDefault();
    var destino = editor.destino.value.trim().toLowerCase();
    var titulo = editor.titulo.value.trim();
    if (!destino || !titulo) { avisar('Faltan el destino y el título.'); return; }

    var precio = editor.precio.value.trim() === '' ? null : Number(editor.precio.value);
    var precio_brl = editor.precio_brl.value.trim() === '' ? null : Number(editor.precio_brl.value);
    if (precio == null && precio_brl == null) { avisar('Poné un precio en USD o en BRL. Un tour sin precio no se puede cotizar.'); return; }

    var boton = $('[data-guardar]');
    boton.disabled = true;
    try {
      var r = await client.rpc('tours_guardar', {
        p_destino: destino,
        p_titulo: titulo,
        p_descripcion: editor.descripcion.value.trim(),
        p_precio: precio,
        p_precio_brl: precio_brl,
        p_detalle: editor.detalle.value.trim(),
        p_activo: editor.activo.checked,
        p_fuente: editor.fuente.value.trim(),
        p_verificado: null,
        p_orden: 100
      });
      if (r.error) throw r.error;
      // Si se edito y se cambio el titulo, la fila nueva se creo aparte y la
      // vieja quedo. Se avisa en vez de borrarla sola: borrar una fila es
      // justo lo que no se puede deshacer desde este panel.
      if (editando && (editando.titulo !== titulo || editando.destino !== destino)) {
        avisar('Guardado como "' + titulo + '". La versión anterior ("' + editando.titulo + '") sigue en la tabla: bórrala si no la querés.', 'ok');
      } else {
        avisar('Guardado.', 'ok');
      }
      cerrarEditor();
      await cargar();
    } catch (e) {
      // "no autorizado" es el caso real y el mas probable si la tabla existe y
      // el panel esta abierto: el correo no esta en la tabla agencia.
      var m = String(e.message || e);
      avisar(/no autorizado/i.test(m)
        ? 'Tu sesión no tiene permiso para editar el catálogo. Revisá que tu correo esté en la tabla agencia de Supabase.'
        : 'No pudimos guardar: ' + m);
    } finally {
      boton.disabled = false;
    }
  }

  lista.addEventListener('click', async function (e) {
    var editar = e.target.closest('[data-editar]');
    if (editar) {
      var partes = editar.getAttribute('data-editar').split('|');
      var encontrado = catalogo.find(function (t) { return t.destino === partes[0] && t.titulo === partes.slice(1).join('|'); });
      if (encontrado) abrirEditor(encontrado);
      return;
    }
    var toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      var p = toggle.getAttribute('data-toggle').split('|');
      var fila = catalogo.find(function (t) { return t.destino === p[0] && t.titulo === p.slice(1).join('|'); });
      toggle.disabled = true;
      try {
        var r = await client.rpc('tours_alternar_activo', { p_destino: p[0], p_titulo: p.slice(1).join('|'), p_activo: fila ? !fila.activo : false });
        if (r.error) throw r.error;
        await cargar();
        avisar(fila && fila.activo ? 'Tour desactivado. Desaparece de la web sin borrarse.' : 'Tour activado.', 'ok');
      } catch (e2) { avisar('No pudimos cambiar el estado: ' + (e2.message || e2)); }
      finally { toggle.disabled = false; }
      return;
    }
    var borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      var q = borrar.getAttribute('data-borrar').split('|');
      var tituloBorrar = q.slice(1).join('|');
      if (!window.confirm('¿Borrar "' + tituloBorrar + '"?\n\nSe elimina de la base para siempre. Si solo es de temporada, usá "Desactivar": el tour desaparece de la web pero se puede volver a activar.')) return;
      borrar.disabled = true;
      try {
        var r2 = await client.rpc('tours_borrar', { p_destino: q[0], p_titulo: tituloBorrar });
        if (r2.error) throw r2.error;
        await cargar();
        avisar('Tour borrado.', 'ok');
      } catch (e3) { avisar('No pudimos borrar: ' + (e3.message || e3)); }
      finally { borrar.disabled = false; }
    }
  });

  editor.addEventListener('submit', guardar);
  document.querySelector('[data-cancelar]').addEventListener('click', cerrarEditor);
  $('#q').addEventListener('input', pintar);
  $('#filtroDestino').addEventListener('change', pintar);
  $('#soloInactivos').addEventListener('change', pintar);

  if (botonSalir) botonSalir.addEventListener('click', async function () {
    await client.auth.signOut();
    authUser = null;
    avisar('Sesión cerrada. Recargá la página para entrar de nuevo.');
    bar.hidden = true;
    editor.hidden = true;
    lista.innerHTML = '<div class="empty">Sesión cerrada.</div>';
  });

  (async function () {
    try {
      await conectar();
      if (!client) return;
      authUser = await sesion();
      if (!authUser) {
        avisar('Esta página es del equipo. Entrá con la cuenta de la agencia para editar el catálogo.');
        lista.innerHTML = '<div class="empty">Necesitás iniciar sesión.</div>';
        return;
      }
      if (!await esAgencia()) {
        avisar('Tu sesión puede ver el catálogo pero no editarlo: el correo no está en la tabla agencia de Supabase.');
        botonSalir.hidden = false;
        bar.hidden = true;
        editor.hidden = true;
        lista.innerHTML = '<div class="empty">Sin permiso de edición.</div>';
        return;
      }
      botonSalir.hidden = false;
      await cargar();
    } catch (e) {
      avisar('No pudimos iniciar el panel: ' + (e && e.message || e));
    }
  })();
})();
