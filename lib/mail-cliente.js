'use strict';
/* Mails al cliente de una reserva (Resend):
   - gracias: sale solo al reservar en la web (lib/reservas.js), con lo que pidio y que sigue.
   - sena:    recibo de la sena, cuando el panel registra "Ya pago la sena". La reserva queda confirmada.
   - saldo:   voucher de la reserva paga, cuando el panel registra "Ya pago el saldo".
   El recibo y el voucher salen del pedido guardado (montos, pagos y servicios del servidor, nunca del navegador).
   Todo en US$, que es como se guardan los cobros.

   Variables: RESEND_API_KEY y RESEND_FROM (ya existen). RESERVAS_EMAIL, si esta, va como reply_to: si el cliente
   responde el mail, la respuesta llega ahi y no a no-reply. */
const pedidos = require('./pedidos');

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const MAX_GRACIAS = 500;
const graciasEnviados = new Set();   // ref -> ya salio: el doble toque en "Reservar" no manda dos mails

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function usd(n) { return 'US$ ' + (Math.round(Number(n) * 100) / 100).toLocaleString('es-UY', { maximumFractionDigits: 2 }); }
function nombreDe(p) { return String(p.cliente_nombre || '').trim().split(' ')[0] || ''; }
function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? Number(m[3]) + ' ' + ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'set.', 'oct.', 'nov.', 'dic.'][Number(m[2]) - 1] + ' ' + m[1] : '';
}
function fechasDe(p) { return p.fechas_txt || (p.fecha_ida ? fechaCorta(p.fecha_ida) + (p.fecha_vuelta ? ' al ' + fechaCorta(p.fecha_vuelta) : '') : ''); }
function personasDe(p) { return p.personas_txt || (p.personas ? p.personas + (p.personas == 1 ? ' persona' : ' personas') : ''); }
function itemsVivos(p) { return (p.items || []).filter(function (i) { return i.nombre && i.estado !== 'cancelado'; }); }

/* ---------- html ----------
   Tablas e inline styles: es lo que respetan Gmail y Outlook. Modo oscuro arriba (marca) y el cuerpo claro, que es
   lo que se lee bien impreso o reenviado. */
function marco(preheader, cuerpo) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#F2F4F7">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#101828">' +
    '<tr><td style="background:#0A101A;padding:20px 24px"><span style="font-size:22px;font-weight:800;color:#F7C325">CuántoSale</span></td></tr>' +
    '<tr><td style="padding:24px">' + cuerpo + '</td></tr>' +
    '<tr><td style="padding:16px 24px 24px;font-size:12px;color:#667085;border-top:1px solid #EAECF0">CuántoSale · <a href="https://cuantosale.uy" style="color:#667085">cuantosale.uy</a><br>¿Dudas? Respondé este mail o escribinos por WhatsApp al +598 98 529 851.</td></tr>' +
    '</table></td></tr></table></body></html>';
}
function filaDato(et, val) {
  return val ? '<tr><td style="padding:4px 12px 4px 0;color:#667085;font-size:14px;white-space:nowrap;vertical-align:top">' + esc(et) + '</td><td style="padding:4px 0;font-size:14px">' + esc(val) + '</td></tr>' : '';
}
function tablaDatos(filas) { return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">' + filas.join('') + '</table>'; }
function filaMonto(izq, der, fuerte) {
  const st = 'padding:8px 0;font-size:14px;border-bottom:1px solid #EAECF0;' + (fuerte ? 'font-weight:700;' : '');
  return '<tr><td style="' + st + '">' + izq + '</td><td align="right" style="' + st + 'white-space:nowrap;padding-left:12px">' + esc(der) + '</td></tr>';
}
function tablaMontos(filas) { return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">' + filas.join('') + '</table>'; }
function titulo(t) { return '<h3 style="margin:0 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#667085">' + esc(t) + '</h3>'; }
function aviso(t, color, fondo) { return '<p style="margin:0 0 20px;padding:12px 14px;border-radius:10px;background:' + fondo + ';color:' + color + ';font-size:15px;font-weight:700">' + t + '</p>'; }
function servicioHtml(i, conCodigo) {
  return esc(i.nombre) + (i.detalle ? '<br><span style="color:#667085;font-size:13px">' + esc(i.detalle) + '</span>' : '') +
    (conCodigo && i.ref_proveedor ? '<br><span style="color:#667085;font-size:13px">Código del operador: ' + esc(i.ref_proveedor) + '</span>' : '');
}

/* ---------- los tres mails ---------- */
function gracias(p, totalTxt) {
  const n = nombreDe(p);
  const items = itemsVivos(p);
  const cuerpo = '<h1 style="margin:0 0 8px;font-size:24px">¡Gracias por tu reserva' + (n ? ', ' + esc(n) : '') + '!</h1>' +
    '<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Recibimos tu solicitud. Ahora confirmamos la disponibilidad con cada proveedor y te escribimos por WhatsApp para pedirte la seña (50 % de los traslados y 25 % de los tours). <b>Hasta entonces no tenés que pagar nada.</b></p>' +
    tablaDatos([filaDato('Referencia', p.ref), filaDato('Destino', p.destino), filaDato('Fechas', fechasDe(p)), filaDato('Personas', personasDe(p))]) +
    titulo('Lo que pediste') +
    tablaMontos(items.map(function (i) { return filaMonto(servicioHtml(i), i.precio_usd ? usd(i.precio_usd) : ''); })
      .concat([filaMonto('Total estimado', totalTxt || usd(pedidos.cuentas(p).total_usd), true)]));
  return { asunto: 'Recibimos tu reserva · ' + (p.destino || 'CuántoSale') + ' · ' + p.ref, html: marco('Recibimos tu solicitud de reserva ' + p.ref + '. Te escribimos por WhatsApp para la seña.', cuerpo) };
}

/* tipo 'sena' | 'saldo'. El pago que se informa es el ultimo cobro (no reembolso) del pedido: el que el panel acaba de registrar. */
function recibo(p, tipo) {
  const c = pedidos.cuentas(p), n = nombreDe(p), pagado = c.saldo_cliente_usd <= 0.005;
  const cobros = (p.pagos || []).filter(function (x) { return !x.reembolso && x.monto_usd > 0; });
  const ultimo = cobros[cobros.length - 1];
  if (!ultimo) { const e = new Error('El pedido no tiene cobros registrados.'); e.status = 400; throw e; }
  const esVoucher = tipo === 'saldo' || pagado;
  const nombreDoc = esVoucher ? 'Voucher de reserva' : 'Recibo de seña';
  const cuerpo = '<p style="margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#667085">' + nombreDoc + '</p>' +
    '<h1 style="margin:0 0 8px;font-size:24px">' + (esVoucher ? '¡Tu reserva está paga' + (n ? ', ' + esc(n) : '') + '!' : '¡Recibimos tu seña' + (n ? ', ' + esc(n) : '') + '!') + '</h1>' +
    '<p style="margin:0 0 20px;font-size:15px;line-height:1.5">' + (esVoucher
      ? 'Recibimos tu pago de <b>' + esc(usd(ultimo.monto_usd)) + '</b> y tu reserva quedó paga en su totalidad. Guardá este mail: es el comprobante de tu reserva.'
      : 'Recibimos tu pago de <b>' + esc(usd(ultimo.monto_usd)) + '</b> y tu reserva quedó confirmada. El saldo se abona antes del viaje: te lo pedimos por WhatsApp.') + '</p>' +
    (esVoucher ? aviso('✓ Reserva paga · Ref ' + esc(p.ref), '#05603A', '#E6F6EC') : aviso('✓ Reserva confirmada · Ref ' + esc(p.ref), '#05603A', '#E6F6EC')) +
    tablaDatos([filaDato('Titular', p.cliente_nombre), filaDato('Destino', p.destino), filaDato('Fechas', fechasDe(p)), filaDato('Personas', personasDe(p)), filaDato('Emitido', fechaCorta(new Date().toISOString().slice(0, 10)))]) +
    titulo('Servicios') +
    tablaMontos(itemsVivos(p).map(function (i) { return filaMonto(servicioHtml(i, esVoucher), i.precio_usd ? usd(i.precio_usd) : ''); })
      .concat([filaMonto('Total', usd(c.total_usd), true)])) +
    titulo('Pagos') +
    tablaMontos((p.pagos || []).filter(function (x) { return x.monto_usd > 0; }).map(function (x) {
      return filaMonto(esc(fechaCorta(x.fecha)) + ' · ' + esc(x.reembolso ? 'Reembolso' : (x.nota || 'Pago')) + (x.medio ? ' <span style="color:#667085">(' + esc(x.medio) + ')</span>' : ''), (x.reembolso ? '−' : '') + usd(x.monto_usd));
    }).concat([filaMonto('Total pagado', usd(c.cobrado_usd), true), filaMonto(pagado ? 'Saldo pendiente' : '<b>Saldo pendiente (antes del viaje)</b>', usd(Math.max(0, c.saldo_cliente_usd)), !pagado)])) +
    '<p style="margin:0;font-size:12px;color:#667085">Comprobante de pago de CuántoSale. No válido como factura.</p>';
  return {
    asunto: (esVoucher ? 'Voucher de tu reserva' : 'Recibo de tu seña') + ' · ' + (p.destino || 'CuántoSale') + ' · ' + p.ref,
    html: marco(esVoucher ? 'Tu reserva ' + p.ref + ' quedó paga. Este es tu voucher.' : 'Recibimos tu seña. Tu reserva ' + p.ref + ' quedó confirmada.', cuerpo)
  };
}

/* ---------- envio ---------- */
async function enviar(para, m, tipo) {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!key) { const e = new Error('Falta configurar RESEND_API_KEY.'); e.status = 503; throw e; }
  const to = String(para || '').trim();
  if (!EMAIL.test(to)) { const e = new Error('El cliente no tiene un email válido.'); e.status = 400; throw e; }
  const reply = String(process.env.RESERVAS_EMAIL || '').trim();
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({
      from: String(process.env.RESEND_FROM || 'CuántoSale <no-reply@cuantosale.uy>').trim(), to: [to],
      subject: m.asunto, html: m.html, tags: [{ name: 'tipo', value: 'cliente_' + tipo }]
    }, reply ? { reply_to: reply } : {})),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) {
    const d = await r.text().catch(function () { return ''; });
    const e = new Error('Resend respondió ' + r.status + (d ? ': ' + d.slice(0, 160) : '')); e.status = 502; throw e;
  }
  return { ok: true, email: to };
}

/* Desde la reserva web. Nunca tira: el mail es un extra y el pedido ya quedo guardado. */
async function enviarGracias(p, totalTxt) {
  try {
    if (!p || !p.ref || graciasEnviados.has(p.ref)) return false;
    await enviar(p.cliente_email, gracias(p, totalTxt), 'gracias');
    if (graciasEnviados.size >= MAX_GRACIAS) graciasEnviados.clear();
    graciasEnviados.add(p.ref);
    return true;
  } catch (e) { console.warn('[mail-cliente] gracias no salio:', e.message); return false; }
}

/* Desde el panel. Tira con status para que el panel muestre el motivo. */
async function enviarRecibo(p, tipo) {
  if (tipo !== 'sena' && tipo !== 'saldo') { const e = new Error('Tipo de recibo desconocido.'); e.status = 400; throw e; }
  return enviar(p.cliente_email, recibo(p, tipo), tipo);
}

module.exports = { enviarGracias: enviarGracias, enviarRecibo: enviarRecibo, _gracias: gracias, _recibo: recibo };
