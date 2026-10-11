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

const COOKIE = 'cs_admin';
const DURACION_MS = 12 * 60 * 60 * 1000;
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

  function emitirSesion() {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + DURACION_MS })).toString('base64url');
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
    res.setHeader('Set-Cookie', COOKIE + '=' + emitirSesion() + '; ' + atributosCookie(req, DURACION_MS / 1000));
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
  async function whatsapp(req, res, accion) {
    const w = waEnv();
    if (!w.token || !w.phoneId) return sendJson(res, 200, { configurado: false, falta: [!w.token && 'WHATSAPP_TOKEN', !w.phoneId && 'WHATSAPP_PHONE_ID'].filter(Boolean) });
    if (!/^\d{5,20}$/.test(w.phoneId)) return sendJson(res, 400, { error: 'WHATSAPP_PHONE_ID tiene que ser el numero largo de "Identificacion del numero de telefono".' });
    if (accion === 'estado' && req.method === 'GET') {
      const n = await graph('GET', w.phoneId + '?fields=display_phone_number,verified_name,name_status,code_verification_status,status,platform_type,quality_rating,messaging_limit_tier');
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
      const j = await graph('POST', w.phoneId + '/messages', {
        messaging_product: 'whatsapp', to: d, type: 'template',
        template: { name: w.template, language: { code: w.lang }, components: [{ type: 'body', parameters: params.map(function (t) { return { type: 'text', text: t }; }) }] }
      });
      return sendJson(res, 200, { ok: true, id: j.messages && j.messages[0] && j.messages[0].id });
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

    if (ruta === 'datos' && req.method === 'GET') {
      const res2 = await Promise.all([pedidos.listarPedidos(), pedidos.listarProveedores()]);
      const lista = res2[0].map(pedidos.conCuentas);
      return sendJson(res, 200, { pedidos: lista, proveedores: res2[1], tablero: tablero(lista), estados: pedidos.ESTADOS, almacenamiento: pedidos.modo() });
    }
    if (ruta === 'pedido/actualizar' && req.method === 'POST') {
      const b = await readJson(req, 256 * 1024);
      const p = await pedidos.actualizarPedido(b && b.id, b && b.cambios);
      return sendJson(res, 200, { pedido: pedidos.conCuentas(p) });
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
    if (ruta === 'proveedor/guardar' && req.method === 'POST') {
      const b = await readJson(req, 8192);
      const pr = await pedidos.guardarProveedor(b && b.id, b);
      return sendJson(res, 200, { proveedor: pr });
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
