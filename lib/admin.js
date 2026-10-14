/*
 * Panel /admin: login con usuario y contrasena, sesion por cookie y la API que lo
 * alimenta (pedidos, proveedores, cobros y pagos).
 *
 * Variables de entorno:
 *   ADMIN_USER, ADMIN_PASS   credenciales del panel. SIN las dos el panel queda
 *                            apagado (503): no hay usuario por defecto.
 *   ADMIN_SECRET             (opcional) clave para firmar la sesion. Si falta se
 *                            deriva de ADMIN_PASS; cambiarla cierra todas las sesiones.
 *   ADMIN_NOTIFY_EMAIL       (opcional) a donde avisar cada pedido nuevo (usa Resend).
 *
 * Seguridad:
 *   - La sesion es una cookie HttpOnly + SameSite=Strict firmada con HMAC y con
 *     vencimiento (12 h). No guarda nada del usuario: solo "esta firmada y no vencio".
 *   - Todo POST exige Content-Type: application/json. Un formulario de otro sitio no
 *     puede mandarlo, y sumado a SameSite=Strict cierra el CSRF.
 *   - Los intentos fallidos de login se cuentan por IP (6 cada 15 min) y cada fallo
 *     espera un momento antes de responder.
 *   - Usuario y contrasena se comparan en tiempo constante, las dos siempre.
 */
const crypto = require('crypto');
const pedidos = require('./pedidos');
const mensajes = require('./mensajes');
const push = require('./push');
const viajesGuardados = require('./viajes-guardados');
const operaciones = require('./operaciones');

const COOKIE = 'cs_admin';
const DURACION_MS = 12 * 60 * 60 * 1000;
const DURACION_LARGA_MS = 30 * 24 * 60 * 60 * 1000;   // "Mantener la sesion en este dispositivo" 
const MAX_FALLOS = 6;
const VENTANA_MS = 15 * 60 * 1000;

function crear(deps) {
  const sendJson = deps.sendJson, readJson = deps.readJson, clientIp = deps.clientIp, safeEqual = deps.safeEqual;

  const credenciales = function () {
    const user = String(process.env.ADMIN_USER || '').trim();
    const pass = String(process.env.ADMIN_PASS || '');
    return user && pass ? { user: user, pass: pass } : null;
  };
  const secreto = function () {
    const c = credenciales();
    const base = String(process.env.ADMIN_SECRET || '').trim() || (c ? 'derivada:' + c.user + ':' + c.pass : '');
    return crypto.createHash('sha256').update('cs-admin-v1|' + base).digest();
  };
  const firmar = function (payload) { return crypto.createHmac('sha256', secreto()).update(payload).digest('base64url'); };

  function emitirSesion(duracion) {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + (duracion || DURACION_MS) })).toString('base64url');
    return payload + '.' + firmar(payload);
  }
  function cookieDe(req) {
    const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)').exec(String(req.headers.cookie || ''));
    return m ? m[1] : '';
  }
  function sesionValida(req) {
    if (!credenciales()) return false;
    const partes = cookieDe(req).split('.');
    if (partes.length !== 2) return false;
    if (!safeEqual(partes[1], firmar(partes[0]))) return false;
    try { return JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8')).exp > Date.now(); }
    catch (e) { return false; }
  }
  function atributosCookie(req, maxAgeSeg) {
    const https = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || !!process.env.VERCEL;
    return 'Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAgeSeg + (https ? '; Secure' : '');
  }

  const fallos = new Map();
  function bloqueado(ip) {
    const f = fallos.get(ip);
    if (f && Date.now() > f.reset) { fallos.delete(ip); return false; }
    return !!f && f.n >= MAX_FALLOS;
  }
  function anotarFallo(ip) {
    const f = fallos.get(ip);
    if (!f || Date.now() > f.reset) fallos.set(ip, { n: 1, reset: Date.now() + VENTANA_MS });
    else f.n++;
    if (fallos.size > 5000) fallos.clear();
  }
  const esperar = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function login(req, res) {
    const cred = credenciales();
    if (!cred) return sendJson(res, 503, { error: 'El panel no esta configurado: faltan ADMIN_USER y ADMIN_PASS en el servidor.' });
    const ip = clientIp(req);
    if (bloqueado(ip)) return sendJson(res, 429, { error: 'Demasiados intentos. Proba de nuevo en 15 minutos.' });
    const b = await readJson(req, 2048);
    // Las dos comparaciones corren siempre: cortocircuitar diria si el usuario existe midiendo el tiempo.
    const okUser = safeEqual(String((b && b.user) || ''), cred.user);
    const okPass = safeEqual(String((b && b.pass) || ''), cred.pass);
    if (!(okUser && okPass)) {
      anotarFallo(ip);
      await esperar(500);
      return sendJson(res, 401, { error: 'Usuario o contrasena incorrectos.' });
    }
    fallos.delete(ip);
    // Con "mantener la sesion" dura 30 dias en ese dispositivo; si no, 12 h. Cambiar ADMIN_PASS o ADMIN_SECRET las cierra todas.
    const duracion = b && b.recordar ? DURACION_LARGA_MS : DURACION_MS;
    res.setHeader('Set-Cookie', COOKIE + '=' + emitirSesion(duracion) + '; ' + atributosCookie(req, duracion / 1000));
    return sendJson(res, 200, { ok: true });
  }

  /* ---------- resumen del tablero ---------- */
  function tablero(lista) {
    const k = { total: lista.length, por_estado: {}, nuevos: 0, facturado_usd: 0, cobrado_usd: 0, por_cobrar_usd: 0, por_pagar_proveedores_usd: 0, margen_usd: 0, sin_proveedor: 0 };
    pedidos.ESTADOS.forEach(function (e) { k.por_estado[e] = 0; });
    lista.forEach(function (p) {
      k.por_estado[p.estado] = (k.por_estado[p.estado] || 0) + 1;
      if (p.estado === 'nuevo') k.nuevos++;
      if (p.estado === 'cancelado') return;
      const c = p.cuentas;
      k.facturado_usd += c.total_usd; k.cobrado_usd += c.cobrado_usd;
      k.por_cobrar_usd += c.saldo_cliente_usd; k.por_pagar_proveedores_usd += c.a_pagar_proveedores_usd;
      k.margen_usd += c.margen_usd; k.sin_proveedor += c.sin_proveedor;
    });
    Object.keys(k).forEach(function (n) { if (typeof k[n] === 'number') k[n] = Math.round(k[n] * 100) / 100; });
    return k;
  }

  /* ---------- aviso por correo de un pedido nuevo (opcional, nunca rompe el pedido) ---------- */
  async function avisarPedidoNuevo(p) {
    await push.avisar();
    const para = String(process.env.ADMIN_NOTIFY_EMAIL || '').trim();
    const key = String(process.env.RESEND_API_KEY || '').trim();
    if (!para || !key) return;
    const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    const c = pedidos.cuentas(p);
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: String(process.env.RESEND_FROM || 'CuántoSale <no-reply@cuantosale.uy>').trim(), to: [para],
          subject: 'Pedido nuevo ' + p.ref + ' · ' + (p.cliente_nombre || 'sin nombre') + ' · US$ ' + c.total_usd,
          html: '<p><b>Pedido ' + esc(p.ref) + '</b> — ' + esc(p.destino) + ' · ' + esc(p.fechas_txt) + '</p>' +
            '<p>' + esc(p.cliente_nombre) + ' · ' + esc(p.cliente_telefono) + ' · ' + esc(p.cliente_email) + '</p>' +
            '<ul>' + p.items.map(function (i) { return '<li>' + esc(i.nombre) + ' — US$ ' + i.precio_usd + '</li>'; }).join('') + '</ul>' +
            '<p>Total: <b>US$ ' + c.total_usd + '</b></p>'
        })
      });
    } catch (e) { /* el aviso es un extra: el pedido ya quedo guardado */ }
  }

  /* ---------- WhatsApp (Cloud API de Meta) ----------
     Estado del numero, registro con el PIN de 6 digitos y un envio de prueba de la plantilla. Existe porque la pantalla
     de Meta falla al registrar sin decir por que: desde aca se ve el mensaje real de la API. El token nunca sale del
     servidor; el panel solo ve las respuestas. */
  const GRAPH = 'https://graph.facebook.com/v21.0/';
  function waEnv() {
    return { token: String(process.env.WHATSAPP_TOKEN || '').trim(), phoneId: String(process.env.WHATSAPP_PHONE_ID || '').trim(),
      template: String(process.env.WHATSAPP_TEMPLATE || 'reserva_recibida').trim(), lang: String(process.env.WHATSAPP_TEMPLATE_LANG || 'es').trim() };
  }
  async function graph(metodo, camino, cuerpo) {
    const w = waEnv();
    const r = await fetch(GRAPH + camino, {
      method: metodo,
      headers: Object.assign({ Authorization: 'Bearer ' + w.token }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      const er = j.error || {};
      const e = new Error('Meta: ' + (er.error_user_msg || er.message || 'HTTP ' + r.status) + (er.code ? ' (código ' + er.code + (er.error_subcode ? '/' + er.error_subcode : '') + ')' : ''));
      e.status = 502; throw e;
    }
    return j;
  }
  /* Que plantillas tiene de verdad la cuenta de WhatsApp (WABA) y si el numero es de esa cuenta. La cuenta sale de
     WHATSAPP_WABA_ID o, si no esta, de los permisos del token (debug_token). Leer plantillas pide el permiso
     whatsapp_business_management; si el token no lo tiene, se dice eso. */
  const ESTADOS = { APPROVED: 'aprobada', PENDING: 'en revisión', REJECTED: 'rechazada', PAUSED: 'pausada', DISABLED: 'desactivada', IN_APPEAL: 'en apelación' };
  async function diagnosticoPlantillas() {
    const w = waEnv(), env = String(process.env.WHATSAPP_WABA_ID || '').trim();
    let cuentas = env ? [env] : [];
    if (!cuentas.length) {
      const dbg = await graph('GET', 'debug_token?input_token=' + encodeURIComponent(w.token)).catch(function () { return {}; });
      ((dbg.data && dbg.data.granular_scopes) || []).forEach(function (s) {
        if (/^whatsapp_business_(management|messaging)$/.test(s.scope)) (s.target_ids || []).forEach(function (id) { if (cuentas.indexOf(id) < 0) cuentas.push(id); });
      });
    }
    const out = [];
    for (const id of cuentas.slice(0, 5)) {
      const c = { id: id, plantillas: null, tieneNumero: null, error: '' };
      try { const j = await graph('GET', id + '/message_templates?fields=name,language,status&limit=200'); c.plantillas = (j.data || []).map(function (t) { return { nombre: t.name, idioma: t.language, estado: t.status }; }); }
      catch (e) { c.error = e.message; }
      try { const n = await graph('GET', id + '/phone_numbers?fields=id,display_phone_number'); c.tieneNumero = (n.data || []).some(function (x) { return String(x.id) === w.phoneId; }); }
      catch (e) { /* sin permiso para ver los numeros */ }
      out.push(c);
    }
    return out;
  }
  function explicarDiagnostico(cuentas, nombre) {
    if (!cuentas.length) return 'No pude ver qué plantillas tiene la cuenta: el token no trae el permiso whatsapp_business_management. Agregale ese permiso al usuario del sistema o poné WHATSAPP_WABA_ID con el ID de la cuenta de WhatsApp Business.';
    return cuentas.map(function (c) {
      const pre = 'Cuenta ' + c.id + (c.tieneNumero === false ? ' (el número configurado NO es de esta cuenta)' : c.tieneNumero ? ' (es la del número)' : '') + ': ';
      if (!c.plantillas) return pre + 'no se pudieron leer las plantillas (' + c.error + ').';
      if (!c.plantillas.length) return pre + 'no tiene ninguna plantilla creada.';
      const igual = c.plantillas.filter(function (t) { return t.nombre === nombre; });
      const lista = c.plantillas.slice(0, 12).map(function (t) { return t.nombre + ' (' + t.idioma + ', ' + (ESTADOS[t.estado] || t.estado) + ')'; }).join(', ');
      if (igual.length) return pre + '"' + nombre + '" existe: ' + igual.map(function (t) { return t.idioma + ', ' + (ESTADOS[t.estado] || t.estado); }).join('; ') + (igual.some(function (t) { return t.estado === 'APPROVED'; }) ? '.' : '. Solo se puede mandar cuando esté aprobada.');
      return pre + 'no hay ninguna "' + nombre + '". Las que hay: ' + lista + (c.plantillas.length > 12 ? '…' : '') + '.';
    }).join(' ');
  }
  /* Para el error 200 ("API access blocked"): que app es el token, si es valido y que permisos trae y sobre que cuentas */
  async function diagnosticoToken() {
    const w = waEnv();
    const d = (await graph('GET', 'debug_token?input_token=' + encodeURIComponent(w.token))).data || {};
    const scopes = d.granular_scopes || [];
    const msg = scopes.filter(function (s) { return s.scope === 'whatsapp_business_messaging'; })[0];
    const partes = ['Token: app ' + (d.application || d.app_id || '?') + ' (' + (d.app_id || '?') + ')' + (d.is_valid === false ? ', NO válido' : '') +
      (d.expires_at ? ', vence ' + new Date(d.expires_at * 1000).toISOString().slice(0, 10) : ', no vence') + '.'];
    if (!msg) partes.push('Le falta el permiso whatsapp_business_messaging: generá el token del usuario del sistema marcando ese permiso.');
    else if (msg.target_ids && msg.target_ids.length) partes.push('whatsapp_business_messaging sobre la cuenta ' + msg.target_ids.join(', ') + '.');
    if (msg) partes.push('Los permisos están: revisá en developers.facebook.com que la app esté en modo Live (publicada) y sin restricciones, y en business.facebook.com → Seguridad del negocio que la empresa no tenga avisos ni restricciones.');
    return partes.join(' ');
  }
  /* Si hasta debug_token falla, no es un permiso suelto: Meta bloquea todo lo que se haga con ese token */
  const BLOQUEO_TOTAL = 'Meta bloquea todo con este token (ni siquiera deja revisarlo): el problema está en la app o la empresa, no en el número ni la plantilla. ' +
    'Revisá en developers.facebook.com → tu app → avisos arriba (restricción, Data Use Checkup, verificación pendiente) y en business.facebook.com → Seguridad del negocio. ' +
    'Si la app está bien, generá un token nuevo del usuario del sistema y reemplazá WHATSAPP_TOKEN en Vercel.';
  async function whatsapp(req, res, accion) {
    const w = waEnv();
    if (!w.token || !w.phoneId) return sendJson(res, 200, { configurado: false, falta: [!w.token && 'WHATSAPP_TOKEN', !w.phoneId && 'WHATSAPP_PHONE_ID'].filter(Boolean) });
    if (!/^\d{5,20}$/.test(w.phoneId)) return sendJson(res, 400, { error: 'WHATSAPP_PHONE_ID tiene que ser el numero largo de "Identificacion del numero de telefono".' });
    if (accion === 'estado' && req.method === 'GET') {
      const n = await graph('GET', w.phoneId + '?fields=display_phone_number,verified_name,name_status,code_verification_status,status,platform_type,quality_rating,messaging_limit_tier').catch(async function (e) {
        if (/\(código (200|10)\b/.test(e.message)) e.message += ' ' + await diagnosticoToken().catch(function () { return BLOQUEO_TOTAL; });
        throw e;
      });
      return sendJson(res, 200, { configurado: true, numero: n, plantilla: w.template });
    }
    if (accion === 'registrar' && req.method === 'POST') {
      const b = await readJson(req, 1024);
      const pin = String((b && b.pin) || '');
      if (!/^\d{6}$/.test(pin)) return sendJson(res, 400, { error: 'El PIN tiene que ser de 6 numeros.' });
      await graph('POST', w.phoneId + '/register', { messaging_product: 'whatsapp', pin: pin });
      return sendJson(res, 200, { ok: true });
    }
    if (accion === 'prueba' && req.method === 'POST') {
      const b = await readJson(req, 1024);
      let d = String((b && b.telefono) || '').replace(/\D/g, '');
      if (/^09\d{7}$/.test(d)) d = '598' + d.slice(1);
      if (!/^\d{9,15}$/.test(d)) return sendJson(res, 400, { error: 'Escribi un celular valido, por ejemplo 099123456.' });
      const params = ['Prueba', 'Florianópolis', '26 dic. → 2 ene. · 2 personas', 'Traslado aeropuerto (Aeropuerto ⇄ alojamiento)', 'US$ 60'];
      const wa = require('./wa-plantilla.js');
      let r = await wa.enviarPlantilla(fetch, { token: w.token, phoneId: w.phoneId, to: d, params: params });
      if (!r.ok && r.error && r.error.code === 132001) {
        /* Se le pregunta a Meta que plantillas hay. Si la plantilla esta aprobada en otro idioma, se prueba con ese. */
        const cuentas = await diagnosticoPlantillas().catch(function () { return []; });
        const aprobada = [].concat.apply([], cuentas.map(function (c) { return c.plantillas || []; })).filter(function (t) { return t.nombre === w.template && t.estado === 'APPROVED' && r.probados.indexOf(t.idioma) < 0; })[0];
        if (aprobada) r = await wa.enviarPlantilla(fetch, { token: w.token, phoneId: w.phoneId, to: d, params: params, idioma: aprobada.idioma });
        if (!r.ok) {
          const e = new Error('Meta no encuentra la plantilla "' + w.template + '" para este número (probé ' + r.probados.join(', ') + '). ' + explicarDiagnostico(cuentas, w.template));
          e.status = 502; throw e;
        }
      }
      if (!r.ok) {
        const er = r.error || {};
        const detalle = er.error_data && er.error_data.details ? ' ' + er.error_data.details : '';
        let msg = 'Meta: ' + (er.error_user_msg || er.message || 'HTTP ' + r.status) + (er.code ? ' (código ' + er.code + (er.error_subcode ? '/' + er.error_subcode : '') + ')' : '') + detalle;
        /* 200 / 10 = permisos: se mira el token (debug_token) para decir que le falta */
        if (er.code === 200 || er.code === 10) msg += ' ' + await diagnosticoToken().catch(function () { return BLOQUEO_TOTAL; });
        const e = new Error(msg.trim());
        e.status = 502; throw e;
      }
      return sendJson(res, 200, { ok: true, idioma: r.idioma, idiomaConfigurado: w.lang, id: r.json.messages && r.json.messages[0] && r.json.messages[0].id });
    }
    return sendJson(res, 404, { error: 'No existe.' });
  }

  /* ---------- API ---------- */
  async function api(req, res, url) {
    const ruta = url.pathname.replace(/^\/api\/admin\/?/, '');
    if (req.method === 'POST' && !/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
      return sendJson(res, 415, { error: 'Content-Type debe ser application/json.' });
    }
    if (ruta === 'login' && req.method === 'POST') return login(req, res);
    if (ruta === 'logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', COOKIE + '=; ' + atributosCookie(req, 0));
      return sendJson(res, 200, { ok: true });
    }
    if (ruta === 'sesion') return sendJson(res, 200, { activo: sesionValida(req), configurado: !!credenciales(), almacenamiento: pedidos.modo() });
    if (!credenciales()) return sendJson(res, 503, { error: 'El panel no esta configurado.' });
    if (!sesionValida(req)) return sendJson(res, 401, { error: 'Sesion vencida. Volve a entrar.' });

    /* Cuanto cubrio la precarga diaria: rutas de las guias con vuelo real, destinos con el hotel calibrado y busquedas
       de Ignav de hoy. Para ver de un vistazo que el cron anda y no gasta de mas. */
    if (ruta === 'precarga' && req.method === 'GET') {
      if (typeof deps.precarga !== 'function') return sendJson(res, 404, { error: 'No disponible.' });
      return sendJson(res, 200, await deps.precarga());
    }
    /* Contador de uso propio (lib/uso.js): eventos por dia de los ultimos N dias, para la pestana "Uso". */
    if (ruta === 'uso' && req.method === 'GET') {
      if (typeof deps.uso !== 'function') return sendJson(res, 404, { error: 'No disponible.' });
      return sendJson(res, 200, await deps.uso(url.searchParams.get('dias')));
    }
    if (ruta === 'datos' && req.method === 'GET') {
      const res2 = await Promise.all([pedidos.listarPedidos(), pedidos.listarProveedores()]);
      const lista = res2[0].map(pedidos.conCuentas);
      return sendJson(res, 200, {
        pedidos: lista, proveedores: res2[1], tablero: tablero(lista), estados: pedidos.ESTADOS, almacenamiento: pedidos.modo(),
        pago: { datos: pedidos.datosPago(), sena_pct: pedidos.SENA_PCT, recargo_tarjeta: pedidos.RECARGO_TARJETA }
      });
    }
    if (ruta === 'pedido/actualizar' && req.method === 'POST') {
      const b = await readJson(req, 256 * 1024);
      const p = await pedidos.actualizarPedido(b && b.id, b && b.cambios);
      return sendJson(res, 200, { pedido: pedidos.conCuentas(p) });
    }
    if (ruta === 'pedido/borrar' && req.method === 'POST') {
      const b = await readJson(req, 1024);
      const p = await pedidos.borrarPedido(b && b.id);
      return sendJson(res, 200, { ok: true, ref: p.ref });
    }
    if (ruta === 'pedido/crear' && req.method === 'POST') {
      // Pedidos que llegan por WhatsApp o telefono: se cargan a mano con el mismo formato.
      const b = await readJson(req, 64 * 1024);
      const p = pedidos.desdeSolicitud({
        nombre: b.cliente_nombre, telefono: b.cliente_telefono, email: b.cliente_email, destino: b.destino,
        fecha_ida: b.fecha_ida, fecha_vuelta: b.fecha_vuelta, personas_n: b.personas, personas: b.personas ? b.personas + ' personas' : '',
        codigo: 'MAN' + Date.now().toString(36), servicios: []
      });
      p.origen = 'manual';
      p.items = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map(pedidos.limpiarItem);
      p.notas = String(b.notas || '').slice(0, 2000);
      if (!p.cliente_nombre) return sendJson(res, 400, { error: 'Escribi el nombre del cliente.' });
      const r = await pedidos.crearPedido(p);
      return sendJson(res, 200, { pedido: pedidos.conCuentas(r.pedido) });
    }
    if (ruta.indexOf('whatsapp/') === 0) return whatsapp(req, res, ruta.slice(9));
    /* Bandeja de WhatsApp (lib/mensajes.js). Cada chat trae los pedidos de ese telefono para ir directo al pedido. */
    /* Notificaciones (lib/push.js). El resumen lo pide el service worker del panel al recibir un push: dice que paso
       (mensaje o pedido nuevo) sin que el texto viaje por el servicio de push. */
    if (ruta === 'push/clave' && req.method === 'GET') return sendJson(res, 200, { configurado: push.configurado(), clave: push.clavePublica() });
    if (ruta === 'push/suscribir' && req.method === 'POST') {
      const b = await readJson(req, 4096);
      await push.suscribir(b && b.suscripcion, String(req.headers['user-agent'] || ''));
      return sendJson(res, 200, { ok: true });
    }
    if (ruta === 'push/baja' && req.method === 'POST') {
      const b = await readJson(req, 4096);
      await push.baja(b && b.endpoint);
      return sendJson(res, 200, { ok: true });
    }
    if (ruta === 'push/resumen' && req.method === 'GET') {
      const res2 = await Promise.all([mensajes.chats().catch(function () { return []; }), pedidos.listarPedidos().catch(function () { return []; })]);
      const chats = res2[0], noLeidos = chats.reduce(function (a, c) { return a + c.no_leidos; }, 0);
      const chat = chats.filter(function (c) { return c.no_leidos; })[0];
      const ped = res2[1].filter(function (p) { return p.estado === 'nuevo'; })[0];
      const tMsg = chat ? new Date(chat.ultimo_entrante).getTime() : 0, tPed = ped ? new Date(ped.created_at).getTime() : 0;
      if (ped && tPed >= tMsg && Date.now() - tPed < 10 * 60 * 1000) {
        return sendJson(res, 200, { titulo: 'Pedido nuevo · ' + (ped.cliente_nombre || ped.ref), cuerpo: (ped.destino ? ped.destino + ' · ' : '') + (ped.items || []).map(function (i) { return i.nombre; }).join(' + ').slice(0, 140), url: '/admin/?pedido=' + encodeURIComponent(ped.id), tag: 'pedido-' + ped.id, no_leidos: noLeidos });
      }
      if (chat) {
        const ultimoIn = chat.ultimo.direccion === 'in' ? chat.ultimo.texto : 'Mensaje nuevo';
        return sendJson(res, 200, { titulo: (chat.nombre || ('+' + chat.telefono)) + (chat.no_leidos > 1 ? ' (' + chat.no_leidos + ')' : ''), cuerpo: String(ultimoIn).slice(0, 160), url: '/admin/?chat=' + chat.telefono, tag: 'chat-' + chat.telefono, no_leidos: noLeidos });
      }
      return sendJson(res, 200, { titulo: 'CuántoSale', cuerpo: 'Tenés novedades en el panel.', url: '/admin/', tag: 'cs-panel', no_leidos: noLeidos });
    }
    if (ruta === 'mensajes/chats' && req.method === 'GET') {
      const res2 = await Promise.all([mensajes.chats(), pedidos.listarPedidos().catch(function () { return []; })]);
      const porTel = {};
      res2[1].forEach(function (p) {
        const t = mensajes._tel(p.cliente_telefono); if (!t) return;
        (porTel[t] = porTel[t] || []).push({ id: p.id, ref: p.ref, estado: p.estado, nombre: p.cliente_nombre });
      });
      const lista = res2[0].map(function (c) { return Object.assign({}, c, { pedidos: porTel[c.telefono] || [] }); });
      return sendJson(res, 200, { chats: lista, no_leidos: lista.reduce(function (a, c) { return a + c.no_leidos; }, 0), almacenamiento: mensajes.modo() });
    }
    if (ruta === 'mensajes/chat' && req.method === 'GET') {
      const t = url.searchParams.get('tel');
      const lista = await mensajes.conversacion(t);
      await mensajes.marcarLeidos(t);
      return sendJson(res, 200, { mensajes: lista });
    }
    if (ruta === 'mensajes/enviar' && req.method === 'POST') {
      const b = await readJson(req, 16384);
      const m = await mensajes.enviarTexto(b && b.telefono, b && b.texto);
      return sendJson(res, 200, { mensaje: m });
    }
    /* Viajes que la gente guardo en su cuenta (tabla trips), con el correo de cada una. */
    if (ruta === 'viajes' && req.method === 'GET') return sendJson(res, 200, { viajes: await viajesGuardados.listar() });
    /* Operaciones (lib/operaciones.js): servicios, precios publicados, cola de cambios e historial. Cada cambio queda
       a nombre de ADMIN_USER, que es quien entro. */
    if (ruta.indexOf('ops/') === 0) {
      return operaciones.api(ruta.slice(4), req, res, url, { sendJson: sendJson, readJson: readJson, usuario: credenciales().user });
    }
    /* Pedido de tarifa neta por la Cloud API. Al proveedor nunca le escribimos, asi que va con la plantilla aprobada
       WHATSAPP_TEMPLATE_TARIFA (pedido_tarifa, portugues): {{1}} el nombre y {{2}} los paseos en una linea (Meta no
       deja saltos de linea en las variables). Queda en la bandeja y la respuesta del proveedor llega ahi. */
    /* Confirmacion, sena, saludo al cliente y reserva al proveedor desde la ficha del pedido (lib/wa-panel.js). El
       telefono sale del pedido o del proveedor del servicio, nunca del navegador. */
    if (ruta === 'whatsapp/enviar' && req.method === 'POST') {
      const b = await readJson(req, 32 * 1024) || {};
      const p = await pedidos.obtenerPedido(b.pedido_id);
      if (!p) return sendJson(res, 404, { error: 'Pedido no encontrado.' });
      let telefono = p.cliente_telefono, pais = 'UY';
      if (b.tipo === 'proveedor') {
        const it = (p.items || [])[Number(b.item)];
        const pr = it && (await pedidos.listarProveedores()).filter(function (x) { return x.id === it.proveedor_id; })[0];
        if (!pr) return sendJson(res, 400, { error: 'Ese servicio no tiene proveedor asignado (guardá el pedido después de elegirlo).' });
        telefono = pr.whatsapp || pr.telefono; pais = 'BR';
      }
      const r = await require('./wa-panel.js').enviar({ tipo: b.tipo, telefono: telefono, pais: pais, texto: b.texto, params: b.params });
      return sendJson(res, 200, Object.assign({ ok: true }, r));
    }
    if (ruta === 'proveedor/pedir-tarifa' && req.method === 'POST') {
      const b = await readJson(req, 16 * 1024);
      const pr = (await pedidos.listarProveedores()).filter(function (x) { return x.id === (b && b.id); })[0];
      if (!pr) return sendJson(res, 404, { error: 'Proveedor no encontrado.' });
      let d = String(pr.whatsapp || pr.telefono || '').replace(/\D/g, '');
      if (d.length === 10 || d.length === 11) d = '55' + d;   // "(81) 99118-3035" viene sin el 55 de Brasil
      if (d.length < 12 || d.length > 15) return sendJson(res, 400, { error: 'El proveedor no tiene un WhatsApp válido.' });
      const w = waEnv();
      if (!w.token || !w.phoneId) return sendJson(res, 503, { error: 'Falta configurar WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.' });
      const nombre = String(pr.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'tudo bem';
      const paseos = (Array.isArray(b.paseos) ? b.paseos : []).map(function (x) { return String(x || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean).slice(0, 8);
      const lista = (paseos.length ? paseos.join('; ') : 'os passeios de vocês').slice(0, 900);
      const plantilla = String(process.env.WHATSAPP_TEMPLATE_TARIFA || 'pedido_tarifa').trim();
      const idioma = String(process.env.WHATSAPP_TEMPLATE_TARIFA_LANG || 'pt_BR').trim();
      const r = await require('./wa-plantilla.js').enviarPlantilla(fetch, { token: w.token, phoneId: w.phoneId, to: d, params: [nombre, lista], nombre: plantilla, idiomas: [idioma, 'pt_BR', 'pt_PT'].filter(function (c, i, a) { return a.indexOf(c) === i; }) });
      if (!r.ok) {
        const er = r.error || {};
        const e = new Error(er.code === 132001
          ? 'Meta no encuentra la plantilla "' + plantilla + '" aprobada en portugués. Creala en WhatsApp Manager (ver WHATSAPP-PLANTILLA.md) y esperá a que la aprueben.'
          : 'Meta: ' + (er.error_user_msg || er.message || 'HTTP ' + r.status) + (er.code ? ' (código ' + er.code + ')' : ''));
        e.status = 502; throw e;
      }
      const texto = 'Olá, ' + nombre + '! Tudo bem?\n\nSomos a CuántoSale (cuantosale.uy), uma plataforma do Uruguai que ajuda viajantes uruguaios e argentinos a planejar e calcular quanto custa uma viagem ao Brasil.\n\n' +
        'Gostaríamos de oferecer aos nossos clientes estes passeios de vocês: ' + lista + '.\n\n' +
        'Vocês trabalham com tarifas para agências (tarifa neta ou comissão)? Poderiam nos enviar a tabela de preços netos, as formas de pagamento e a política de cancelamento?\n\nMuito obrigado!\nEquipe CuántoSale';
      const waId = r.json && r.json.messages && r.json.messages[0] && r.json.messages[0].id;
      await mensajes.guardar({ wa_id: waId, telefono: d, direccion: 'out', tipo: 'template', texto: texto, estado: 'sent' }).catch(function () { /* el envio ya salio */ });
      return sendJson(res, 200, { ok: true, telefono: d });
    }
    if (ruta === 'proveedor/papelera' && req.method === 'POST') {
      const b = await readJson(req, 1024);
      const pr = await pedidos.papeleraProveedor(b && b.id, !!(b && b.eliminar));
      return sendJson(res, 200, { proveedor: pr });
    }
    if (ruta === 'proveedor/guardar' && req.method === 'POST') {
      const b = await readJson(req, 8192);
      const pr = await pedidos.guardarProveedor(b && b.id, b);
      // Si cambio su margen, los precios de sus servicios en la web cambiarian: quedan como pendientes para revisar.
      let cambios = null;
      if (pr && pr.id && b && 'margen_tipo' in b && pedidos.modo() === 'supabase') cambios = await operaciones.recalcularProveedor(pr.id, credenciales().user);
      return sendJson(res, 200, { proveedor: pr, cambios: cambios });
    }
    return sendJson(res, 404, { error: 'No existe.' });
  }

  /* Devuelve una promesa si manejo la ruta, o null si no es suya. */
  function manejar(req, res, url) {
    if (url.pathname.indexOf('/api/admin/') !== 0 && url.pathname !== '/api/admin') return null;
    return api(req, res, url).catch(function (e) {
      if (!res.headersSent) sendJson(res, e.status || 500, { error: e.status ? e.message : 'Error inesperado.' });
      if (!e.status) console.error('[admin]', e);
    });
  }

  return { manejar: manejar, sesionValida: sesionValida, avisarPedidoNuevo: avisarPedidoNuevo, _tablero: tablero };
}

module.exports = { crear: crear };
