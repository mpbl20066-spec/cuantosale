'use strict';
/* Pedidos de reserva de traslados y tours (se reservan con CuantoSale).

   Flujo:
   1. La persona completa nombre, WhatsApp de Uruguay y email, y toca "Reservar".
      POST /api/reserva-solicitud valida los datos otra vez (el navegador no es de fiar), le manda AL INSTANTE el
      WhatsApp de confirmacion al cliente y le manda el pedido al asesor por email (Resend, a RESERVAS_EMAIL). El mail
      dice si el WhatsApp salio y trae un boton para reenviarlo (o para mandarlo si fallo).
   2. El boton abre GET /api/reserva-enviar?t=<token>: una pagina que muestra el pedido y pide un toque mas. El envio
      es un POST y no el GET a proposito: los antivirus y las vistas previas de los correos abren los enlaces solos y
      mandarian el WhatsApp sin que nadie lo decida.
   3. POST /api/reserva-enviar manda al cliente la plantilla aprobada de WhatsApp (la misma de /api/reserva-whatsapp).

   El token lleva el pedido firmado con HMAC (RESERVAS_SECRET, o WELCOME_WEBHOOK_SECRET si no esta): solo el servidor
   puede armarlo, asi que el enlace no sirve para escribirle a un numero cualquiera.

   Variables: RESERVAS_EMAIL (donde llega el pedido), RESEND_API_KEY / RESEND_FROM (ya existen),
   RESERVAS_SECRET, SITE_URL (opcional, para los enlaces del mail; por defecto https://cuantosale.uy),
   WHATSAPP_TOKEN / WHATSAPP_PHONE_ID / WHATSAPP_TEMPLATE / WHATSAPP_TEMPLATE_LANG (ya existen). */

const crypto = require('crypto');

const TEL_UY = /^\+5989[1-9]\d{6}$/;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const VIGENCIA_MS = 14 * 24 * 3600 * 1000;

function texto(v, max) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max); }
function emailValido(m) { return m.length <= 254 && EMAIL.test(m) && !/\.\./.test(m) && !/^\.|\.@/.test(m); }
function secreto() { return String(process.env.RESERVAS_SECRET || process.env.WELCOME_WEBHOOK_SECRET || '').trim(); }
function sitio() { return String(process.env.SITE_URL || 'https://cuantosale.uy').replace(/\/+$/, ''); }

function firmar(obj) {
  const carga = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return carga + '.' + crypto.createHmac('sha256', secreto()).update(carga).digest('base64url');
}
function leer(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 2 || !secreto()) return null;
  const esperada = crypto.createHmac('sha256', secreto()).update(partes[0]).digest('base64url');
  const a = Buffer.from(partes[1]), b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const o = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
    return o && o.exp > Date.now() ? o : null;
  } catch (e) { return null; }
}

module.exports = function (h) {
  const esc = h.escapeHtml;
  const porNumero = new Map(); // numero -> { dia, n }: como mucho 3 WhatsApp por numero y por dia

  function htmlMail(p, enlace, wa) {
    const filas = p.servicios.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    return '<div style="font-family:Arial,sans-serif;font-size:15px;color:#101828;max-width:520px">' +
      '<h2 style="margin:0 0 12px">Nuevo pedido de reserva</h2>' +
      '<p><b>' + esc(p.nombre) + '</b><br>WhatsApp: <a href="https://wa.me/' + esc(p.tel.replace('+', '')) + '">' + esc(p.tel) + '</a><br>Email: ' + esc(p.email) + '</p>' +
      '<p><b>' + esc(p.destino) + '</b> · ' + esc(p.fechas) + ' · ' + esc(p.personas) + '</p>' +
      '<ul>' + filas + '</ul><p><b>Total estimado: ' + esc(p.total) + '</b></p>' + (p.cupon ? '<p>Cupón del pasaporte: <b>' + esc(p.cupon) + '</b> (descuento ' + esc(p.descuento) + '). Ya está canjeado.</p>' : '') +
      (p.codigo ? '<p style="color:#667085">Código del viaje: ' + esc(p.codigo) + '</p>' : '') +
      '<p style="padding:10px 12px;border-radius:8px;background:' + (wa.ok ? '#E6F6EC' : '#FDECEA') + '"><b>' + (wa.ok ? 'WhatsApp automático enviado al cliente.' : 'No se pudo enviar el WhatsApp automático (' + esc(wa.error || '') + '). Mandáselo desde el botón.') + '</b></p>' +
      '<p style="margin:22px 0"><a href="' + esc(enlace) + '" style="background:#F7C325;color:#0A101A;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + (wa.ok ? 'Volver a enviar el WhatsApp' : 'Enviar WhatsApp al cliente') + '</a></p>' +
      '<p style="color:#667085;font-size:13px">El botón abre una página donde confirmás el envío. El enlace vale 14 días.</p></div>';
  }

  async function solicitud(req, res) {
    if (h.limited('reserva-sol:' + h.clientIp(req))) return h.sendJson(res, 429, { error: 'Demasiados pedidos seguidos.' });
    const para = String(process.env.RESERVAS_EMAIL || '').trim(), key = String(process.env.RESEND_API_KEY || '').trim();
    const hayMail = !!(para && key && secreto());
    const pas = h.pasaporte;
    const usuario = req.headers.authorization && pas ? await pas.usuarioDe(req) : null;
    let b;
    try { b = await h.readJson(req, 8192); } catch (e) { return h.sendJson(res, e.status || 400, { error: e.message }); }
    b = b && typeof b === 'object' ? b : {};
    const p = {
      nombre: texto(b.nombre, 60), tel: texto(b.telefono, 14).replace(/\s/g, ''), email: texto(b.email, 254),
      destino: texto(b.destino, 40), fechas: texto(b.fechas, 40), personas: texto(b.personas, 20), total: texto(b.total, 20), codigo: texto(b.codigo, 30),
      servicios: (Array.isArray(b.servicios) ? b.servicios : []).slice(0, 8).map(function (s) {
        const nom = texto(s && s.nombre, 60), det = texto(s && s.detalle, 60), pr = texto(s && s.precio, 20);
        return nom ? nom + (det ? ' (' + det + ')' : '') + (pr ? ' — ' + pr : '') : '';
      }).filter(Boolean)
    };
    if (p.nombre.length < 3 || p.nombre.indexOf(' ') < 1) return h.sendJson(res, 400, { error: 'Falta nombre y apellido.' });
    if (!TEL_UY.test(p.tel)) return h.sendJson(res, 400, { error: 'El celular de Uruguay no es válido.' });
    if (!emailValido(p.email)) return h.sendJson(res, 400, { error: 'El email no es válido.' });
    if (b.mayor_edad !== true) return h.sendJson(res, 400, { error: 'Para reservar tenés que ser mayor de 18 años y aceptar los términos.' });
    if (!p.servicios.length || !p.destino || !p.fechas || !p.total) return h.sendJson(res, 400, { error: 'Faltan datos del pedido.' });

    /* Cupon del pasaporte: hace falta la sesion de quien lo gano. Se canjea (atomico) antes de mandar nada y se libera
       si no sale ni el WhatsApp ni el mail. */
    const codigoCupon = texto(b.cupon, 12).toUpperCase();
    let canje = null;
    if (codigoCupon) {
      if (!usuario) return h.sendJson(res, 401, { error: 'Iniciá sesión para usar tu cupón.' });
      canje = await pas.canjear(usuario.id, codigoCupon, Number(b.totalUsd) || 0);
      if (!canje.ok) return h.sendJson(res, 400, { error: canje.error });
      p.cupon = canje.codigo; p.descuento = 'US$ ' + String(canje.descuentoUsd.toFixed(2)).replace(/[.]00$/, '');
      p.total += ' (con cupón de ' + (canje.montoBrl != null ? 'R$ ' + canje.montoBrl : canje.pct + '%') + ': −' + p.descuento + ')';
    }
    const soltarCupon = function () { return canje && canje.ok ? pas.liberar(usuario.id, canje.codigo) : null; };
    /* Corre en cada camino donde la reserva salio bien: ahi tambien va el mail de "gracias por tu reserva" al cliente
       (lib/mail-cliente.js, nunca tira). La referencia es la misma que guarda el panel porque sale del mismo cuerpo. */
    const premiar = async function () {
      const t = h.tasas ? await h.tasas().catch(function () { return null; }) : null;   // el mail va en reales
      const ped = require('./pedidos'), nuevo = ped.desdeSolicitud(b), brl = t && t.rates && t.rates.BRL;
      /* Si cambia algo que ya habia pedido, el mail es "recibimos el cambio" (lib/mail-avisos.js), no otro "gracias". */
      const ant = typeof b.reemplaza === 'string' ? await ped.obtenerPedido(b.reemplaza.slice(0, 40)).catch(function () { return null; }) : null;
      if (ant) await require('./mail-avisos').enviarCambio(nuevo, ant.ref, brl);
      else await require('./mail-cliente').enviarGracias(nuevo, canje && canje.ok ? canje.descuentoUsd : 0, brl);
      if (usuario) return pas.eventoServidor(usuario.id, 'reserva', p.codigo || ('r' + Date.now().toString(36)));
    };

    /* El pedido queda guardado para el panel /admin (nunca falla: guardarPedido atrapa sus errores). Se espera a que termine
       porque en Vercel la funcion se congela al responder y un guardado sin esperar se perderia. */
    const enPanel = h.guardarPedido ? await h.guardarPedido(b) : false;
    const idPedido = typeof enPanel === 'string' ? enPanel : null;

    /* El WhatsApp al cliente sale ahora mismo, antes que el mail: es lo que la persona espera al tocar "Reservar". */
    const wa = await enviarWA(p);
    if (!hayMail) {
      /* Si el pedido quedo en el panel, la reserva no se perdio: el asesor la ve ahi y le escribe. Al cliente no se le
         muestra un error de configuracion. */
      if (!wa.ok && enPanel) { console.warn('[reservas] WhatsApp automatico no salio:', wa.error); await premiar(); return h.sendJson(res, 200, { ok: true, whatsapp: false, email: false, panel: true, pedido: idPedido }); }
      if (!wa.ok) { await soltarCupon(); return h.sendJson(res, wa.status === 429 ? 429 : 503, { error: wa.error }); }
      await premiar();
      return h.sendJson(res, 200, { ok: true, whatsapp: true, email: false, pedido: idPedido });
    }
    const enlace = sitio() + '/api/reserva-enviar?t=' + encodeURIComponent(firmar({ p: p, exp: Date.now() + VIGENCIA_MS }));
    const r = await h.fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: String(process.env.RESEND_FROM || 'CuántoSale <no-reply@cuantosale.uy>').trim(), to: [para], reply_to: p.email,
        subject: 'Reserva: ' + p.nombre + ' · ' + p.destino, html: htmlMail(p, enlace, wa), tags: [{ name: 'tipo', value: 'pedido_reserva' }]
      })
    }, 10000);
    if (!r.ok) {
      const d = await r.text().catch(function () { return ''; });
      /* Si el cliente ya recibio su WhatsApp, para el no fallo nada: el mail al asesor se reintenta a mano. */
      if (wa.ok || enPanel) { await premiar(); return h.sendJson(res, 200, { ok: true, whatsapp: wa.ok, email: false, panel: !!enPanel, pedido: idPedido }); }
      await soltarCupon();
      return h.sendJson(res, 502, { error: 'No pudimos enviar el pedido.', detalle: d.slice(0, 200) });
    }
    await premiar();
    return h.sendJson(res, 200, { ok: true, whatsapp: wa.ok, email: true, pedido: idPedido });
  }

  function pagina(res, status, titulo, cuerpo) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' });
    res.end('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
      '<title>' + esc(titulo) + '</title><style>body{font-family:Arial,sans-serif;background:#F7F8FA;color:#101828;margin:0;padding:24px}main{max-width:480px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:16px;padding:24px}' +
      'h1{font-size:20px;margin:0 0 12px}button{width:100%;padding:15px;border:0;border-radius:12px;background:#F7C325;color:#0A101A;font-size:16px;font-weight:700;cursor:pointer}button:disabled{opacity:.6}' +
      '.m{margin-top:14px;font-weight:700}</style></head><body><main>' + cuerpo + '</main></body></html>');
  }

  function verEnvio(req, res, token) {
    const o = leer(token);
    if (!o || !o.p) return pagina(res, 400, 'Enlace no válido', '<h1>Este enlace no es válido o venció.</h1><p>Pedí que el cliente repita la reserva.</p>');
    const p = o.p;
    pagina(res, 200, 'Enviar WhatsApp', '<h1>Enviar WhatsApp al cliente</h1><p><b>' + esc(p.nombre) + '</b> · ' + esc(p.tel) + '<br>' + esc(p.destino) + ' · ' + esc(p.fechas) + ' · ' + esc(p.personas) +
      '</p><ul>' + p.servicios.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul><p><b>Total: ' + esc(p.total) + '</b></p>' +
      '<button id="b" type="button">Enviar WhatsApp ahora</button><p class="m" id="m" role="status"></p>' +
      '<script>var b=document.getElementById("b"),m=document.getElementById("m");b.onclick=function(){b.disabled=true;m.textContent="Enviando…";' +
      'fetch("/api/reserva-enviar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({t:' + JSON.stringify(token).replace(/</g, '\\u003c') + '})})' +
      '.then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||"Error");m.textContent="Listo: el cliente recibió el WhatsApp.";})})' +
      '.catch(function(e){b.disabled=false;m.textContent="No se pudo enviar: "+e.message;});};</script>');
  }

  /* Manda al cliente la plantilla de WhatsApp. Devuelve { ok } o { ok:false, status, error }. */
  async function enviarWA(p) {
    const wt = String(process.env.WHATSAPP_TOKEN || '').trim(), phoneId = String(process.env.WHATSAPP_PHONE_ID || '').trim();
    if (!wt || !phoneId) return { ok: false, status: 503, error: 'Falta configurar WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.' };
    const numero = p.tel.replace('+', ''), hoy = new Date().toISOString().slice(0, 10), previo = porNumero.get(numero), n = previo && previo.dia === hoy ? previo.n : 0;
    if (n >= 3) return { ok: false, status: 429, error: 'A este número ya se le enviaron 3 mensajes hoy.' };
    porNumero.set(numero, { dia: hoy, n: n + 1 });
    const nombre = texto(p.nombre.split(' ')[0], 30) || 'viajero';
    const params = [nombre, p.destino, p.fechas + ' · ' + p.personas, p.servicios.join(' + '), p.total];
    let r;
    try {
      r = await require('./wa-plantilla.js').enviarPlantilla(function (u, op) { return h.fetchWithTimeout(u, op, 10000); }, { token: wt, phoneId: phoneId, to: numero, params: params });
    } catch (e) { porNumero.set(numero, { dia: hoy, n: n }); return { ok: false, status: 502, error: 'WhatsApp no respondió.' }; }
    if (!r.ok) {
      porNumero.set(numero, { dia: hoy, n: n });
      return { ok: false, status: 502, error: 'WhatsApp respondió ' + r.status, detalle: String(r.texto || '').slice(0, 200) };
    }
    /* Queda en la bandeja del panel (lib/mensajes.js) para ver la conversacion entera con el cliente. */
    if (h.guardarMensaje) {
      const j = r.json || {};
      await h.guardarMensaje({ wa_id: j.messages && j.messages[0] && j.messages[0].id, telefono: numero, nombre: p.nombre, direccion: 'out', tipo: 'template',
        texto: 'Confirmación automática: ' + p.destino + ' · ' + p.fechas + ' · ' + p.personas + ' · ' + p.servicios.join(' + ') + ' · Total ' + p.total });
    }
    return { ok: true };
  }

  async function enviar(req, res) {
    if (h.limited('reserva-env:' + h.clientIp(req))) return h.sendJson(res, 429, { error: 'Demasiados intentos seguidos.' });
    let b;
    try { b = await h.readJson(req, 4096); } catch (e) { return h.sendJson(res, e.status || 400, { error: e.message }); }
    const o = leer(b && b.t);
    if (!o || !o.p) return h.sendJson(res, 400, { error: 'El enlace no es válido o venció.' });
    const p = o.p;
    const w = await enviarWA(p);
    if (!w.ok) return h.sendJson(res, w.status, { error: w.error, detalle: w.detalle });
    return h.sendJson(res, 200, { ok: true });
  }

  return { solicitud: solicitud, verEnvio: verEnvio, enviar: enviar, _firmar: firmar, _leer: leer };
};
