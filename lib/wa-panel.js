'use strict';
/* WhatsApp que manda el panel /admin desde la ficha del pedido: confirmacion, sena, saludo al cliente y reserva al
   proveedor. Antes eran enlaces wa.me, que abren la app del celular: el numero de CuantoSale vive en la Cloud API y ya
   no esta en ninguna app, asi que esos mensajes no salian del numero de la empresa.

   Regla de WhatsApp: si la persona nos escribio en las ultimas 24 h se le puede mandar texto libre (sale el mismo
   mensaje que armaba el panel). Si no, solo una plantilla aprobada. Cloud API no avisa en la respuesta que la ventana
   esta cerrada (el texto sale "enviado" y despues llega un fallo por el webhook), asi que la ventana se mira antes, con
   el ultimo mensaje entrante guardado en la bandeja.

   Las plantillas se crean en WhatsApp Manager con estos textos exactos (WHATSAPP-PLANTILLA.md). Meta no deja saltos de
   linea en las variables ni empezar o terminar el cuerpo con una. */
const mensajes = require('./mensajes');
const wa = require('./wa-plantilla.js');

const ES = ['es', 'es_AR', 'es_ES', 'es_MX'];
const PLANTILLAS = {
  confirmacion: {
    env: 'WHATSAPP_TEMPLATE_CONFIRMACION', nombre: 'pedido_confirmado', idiomas: ES,
    cuerpo: 'Hola {{1}}, recibimos tu solicitud de reserva en CuántoSale.\n\nViaje: {{2}}\nServicios: {{3}}\nTotal estimado: {{4}}\nReferencia: {{5}}\n\nTe confirmamos la disponibilidad con el proveedor y ahí te pedimos una seña para reservar. Gracias por elegirnos.'
  },
  sena: {
    env: 'WHATSAPP_TEMPLATE_SENA', nombre: 'pedir_sena', idiomas: ES,
    cuerpo: 'Hola {{1}}, el proveedor confirmó tu reserva en {{2}}.\n\nPara dejarla reservada te pedimos una seña de {{3}}.\n\nCómo pagar: {{4}}\nReferencia: {{5}}\n\nCuando pagues, respondé este mensaje con el comprobante. El resto se abona antes del viaje.'
  },
  saludo: {
    env: 'WHATSAPP_TEMPLATE_RETOMAR', nombre: 'retomar_pedido', idiomas: ES,
    cuerpo: 'Hola {{1}}, te escribimos de CuántoSale por tu pedido {{2}}. Respondé este mensaje y seguimos con tu reserva por acá.'
  },
  proveedor: {
    env: 'WHATSAPP_TEMPLATE_RESERVA_PROV', nombre: 'reserva_proveedor', idiomas: ['pt_BR', 'pt_PT'],
    cuerpo: 'Olá, {{1}}! Somos a CuántoSale (cuantosale.uy) e gostaríamos de reservar: {{2}}.\n\nData: {{3}}\nPessoas: {{4}}\nEm nome de: {{5}}\nReferência: {{6}}\n\nPoderiam confirmar a disponibilidade? Obrigado!'
  }
};

function falla(status, msg) { const e = new Error(msg); e.status = status; return e; }
function linea(v, max) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max || 300); }

/* Cliente (Uruguay por defecto: 099 123 456 -> 59899123456) o proveedor (Brasil: (81) 99118-3035 -> 5581991183035). */
function numero(crudo, pais) {
  let d = String(crudo || '').replace(/[^\d+]/g, '');
  const mas = d.charAt(0) === '+';
  d = d.replace(/\D/g, '');
  if (!mas) {
    d = d.replace(/^00/, '');
    if (/^09\d{7}$/.test(d)) d = '598' + d.slice(1);
    else if (/^9\d{7}$/.test(d)) d = '598' + d;
    else if (pais === 'BR' && (d.length === 10 || d.length === 11) && !/^598/.test(d)) d = '55' + d;
  }
  return /^\d{10,15}$/.test(d) ? d : '';
}

/* ¿Nos escribio en las ultimas 24 h? (con 30 min de margen). Mira el numero con y sin el 9 de los celulares de Brasil. */
async function ventanaAbierta(tel) {
  const formas = mensajes._formasTel(tel).filter(function (x) { return x.length >= 10; });
  const listas = await Promise.all(formas.map(function (t) { return mensajes.conversacion(t).catch(function () { return []; }); }));
  const limite = Date.now() - 23.5 * 3600e3;
  return [].concat.apply([], listas).some(function (m) { return m.direccion === 'in' && Date.parse(m.created_at) > limite; });
}

function render(cuerpo, params) {
  return cuerpo.replace(/\{\{(\d+)\}\}/g, function (_, n) { return params[Number(n) - 1] || ''; });
}

/* o = { tipo, telefono, texto, params, pais }. Devuelve { modo: 'texto'|'plantilla', telefono }. */
async function enviar(o) {
  const def = PLANTILLAS[o.tipo];
  if (!def) throw falla(400, 'Tipo de mensaje desconocido.');
  const tel = numero(o.telefono, o.pais);
  if (!tel) throw falla(400, 'El teléfono no es válido para WhatsApp.');
  const token = String(process.env.WHATSAPP_TOKEN || '').trim(), phoneId = String(process.env.WHATSAPP_PHONE_ID || '').trim();
  if (!token || !phoneId) throw falla(503, 'Falta configurar WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.');

  const texto = String(o.texto || '').trim();
  if (texto && await ventanaAbierta(tel)) {
    await mensajes.enviarTexto(tel, texto);
    return { modo: 'texto', telefono: tel };
  }

  const n = (def.cuerpo.match(/\{\{\d+\}\}/g) || []).length;
  const params = (Array.isArray(o.params) ? o.params : []).slice(0, n).map(function (x) { return linea(x, 900); });
  while (params.length < n) params.push('');
  if (params.some(function (x) { return !x; })) throw falla(400, 'Faltan datos del pedido para la plantilla (nombre, fechas, servicios o referencia).');
  const nombre = String(process.env[def.env] || def.nombre).trim();
  const r = await wa.enviarPlantilla(fetch, { token: token, phoneId: phoneId, to: tel, params: params, nombre: nombre, idiomas: def.idiomas });
  if (!r.ok) {
    const er = r.error || {};
    throw falla(502, er.code === 132001
      ? 'Pasaron más de 24 h desde su último mensaje, así que va con la plantilla "' + nombre + '", y Meta no la encuentra aprobada. Creala en WhatsApp Manager (ver WHATSAPP-PLANTILLA.md).'
      : 'Meta: ' + (er.error_user_msg || er.message || 'HTTP ' + r.status) + (er.code ? ' (código ' + er.code + ')' : ''));
  }
  const waId = r.json && r.json.messages && r.json.messages[0] && r.json.messages[0].id;
  await mensajes.guardar({ wa_id: waId, telefono: tel, direccion: 'out', tipo: 'template', texto: render(def.cuerpo, params), estado: 'sent' }).catch(function () { /* el envio ya salio */ });
  return { modo: 'plantilla', telefono: tel, plantilla: nombre };
}

module.exports = { enviar: enviar, PLANTILLAS: PLANTILLAS, _numero: numero };
