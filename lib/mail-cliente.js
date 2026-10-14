'use strict';
/* Mails al cliente de una reserva (Resend):
   - gracias: sale solo al reservar en la web (lib/reservas.js), con lo que pidio y que sigue.
   - sena:    recibo de la sena, cuando el panel registra "Ya pago la sena". La reserva queda confirmada.
   - saldo:   voucher de la reserva paga, cuando el panel registra "Ya pago el saldo".
   El recibo y el voucher van tambien en PDF adjunto (lib/recibo-pdf.js) para descargarlo o imprimirlo, y salen del
   pedido guardado (montos, pagos y servicios del servidor, nunca del navegador). Todo en US$, como se guardan.

   Diseno oscuro (la marca) declarado como tal: Outlook y Gmail en modo oscuro invierten los mails claros y los dejan
   grises; uno que ya es oscuro y lo dice (color-scheme) queda como esta. Las dudas van por WhatsApp: el mail sale de
   no-reply, asi que no se invita a responderlo.

   Variables: RESEND_API_KEY y RESEND_FROM (ya existen). RESERVAS_EMAIL, si esta, va como reply_to por si igual
   responden. */
const pedidos = require('./pedidos');
const pdf = require('./recibo-pdf');

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const MAX_GRACIAS = 500;
const graciasEnviados = new Set();   // ref -> ya salio: el doble toque en "Reservar" no manda dos mails
const WA_NUMERO = '59898529851';
const LOGO = 'https://cuantosale.uy/icons/apple-touch-icon.png';
const K = { fondo: '#0A101A', tarjeta: '#111A29', caja: '#18233A', borde: '#243149', texto: '#F2F4F7', suave: '#AEB8CB', tenue: '#7C879C', mostaza: '#F7C325', verde: '#3CCB7F', verdeFondo: '#12352A' };
const FUENTE = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function usd(n) {
  const v = Math.round(Number(n) * 100) / 100;
  return 'US$ ' + v.toLocaleString('es-UY', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
/* "paola batista" -> "Paola Batista" (las particulas quedan en minuscula). */
function capital(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').split(' ').map(function (w, i) {
    const l = w.toLowerCase();
    return i && /^(de|del|da|das|do|dos|la|las|los|y|e)$/.test(l) ? l : l.charAt(0).toUpperCase() + l.slice(1);
  }).join(' ');
}
function nombreDe(p) { return capital(p.cliente_nombre).split(' ')[0] || ''; }
const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'set.', 'oct.', 'nov.', 'dic.'];
function fechaCorta(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Number(m[3]) + ' ' + MESES[Number(m[2]) - 1] + ' ' + m[1] : ''; }
function hoy() { return fechaCorta(new Date().toISOString().slice(0, 10)); }
function fechasDe(p) {
  if (p.fecha_ida) return fechaCorta(p.fecha_ida).replace(/ \d{4}$/, '') + (p.fecha_vuelta ? ' al ' + fechaCorta(p.fecha_vuelta) : '');
  return String(p.fechas_txt || '').replace(/\s*[→⇄-]\s*/, ' al ');
}
function personasDe(p) { return p.personas ? p.personas + (p.personas == 1 ? ' persona' : ' personas') : (p.personas_txt || ''); }
function itemsVivos(p) { return (p.items || []).filter(function (i) { return i.nombre && i.estado !== 'cancelado'; }); }
function icono(i) { return i.tipo === 'traslado' ? '🚐' : i.tipo === 'tour' ? '🌴' : '✨'; }
function linkWa(ref) { return 'https://wa.me/' + WA_NUMERO + '?text=' + encodeURIComponent('Hola! Tengo una consulta por mi reserva ' + ref); }

/* ---------- piezas del mail (tablas e inline styles: lo que respetan Gmail y Outlook) ---------- */
function marco(preheader, cuerpo) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">' +
    '<style>:root{color-scheme:dark}body{margin:0;padding:0}a{text-decoration:none}@media (max-width:520px){.pad{padding-left:18px!important;padding-right:18px!important}.monto{font-size:30px!important}}</style></head>' +
    '<body style="margin:0;padding:0;background:' + K.fondo + '" bgcolor="' + K.fondo + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + K.fondo + '" style="background:' + K.fondo + '"><tr><td align="center" style="padding:28px 10px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + K.tarjeta + '" style="max-width:580px;background:' + K.tarjeta + ';border:1px solid ' + K.borde + ';border-radius:20px;' + FUENTE + 'color:' + K.texto + '">' +
    '<tr><td class="pad" style="padding:24px 28px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="vertical-align:middle"><img src="' + LOGO + '" width="34" height="34" alt="" style="display:block;border-radius:9px"></td>' +
    '<td style="vertical-align:middle;padding-left:10px;font-size:21px;font-weight:800;color:' + K.texto + ';letter-spacing:-.01em">cuántosale</td></tr></table></td></tr>' +
    cuerpo +
    '<tr><td class="pad" style="padding:6px 28px 28px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ' + K.borde + '"><tr><td style="padding-top:18px;font-size:12px;line-height:1.6;color:' + K.tenue + '">' +
    'CuántoSale · <a href="https://cuantosale.uy" style="color:' + K.tenue + '">cuantosale.uy</a><br>Este mail sale de una casilla que no recibe respuestas. Para cualquier consulta, escribinos por WhatsApp al +598 98 529 851.' +
    '</td></tr></table></td></tr></table></td></tr></table></body></html>';
}
function bloque(html, pad) { return '<tr><td class="pad" style="padding:' + (pad || '0 28px 22px') + '">' + html + '</td></tr>'; }
function etiqueta(t, color) { return '<div style="font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:' + (color || K.tenue) + '">' + esc(t) + '</div>'; }
function chip(t, ok) {
  return '<span style="display:inline-block;padding:6px 12px;border-radius:99px;font-size:12px;font-weight:700;white-space:nowrap;background:' + (ok ? K.verdeFondo : '#3A3112') + ';color:' + (ok ? K.verde : K.mostaza) + '">' + esc(t) + '</span>';
}
/* Monto grande en una caja: lo primero que se ve. */
function destacado(et, monto, sub, chipHtml) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + K.caja + '" style="background:' + K.caja + ';border-radius:16px;border-left:4px solid ' + K.mostaza + '"><tr>' +
    '<td style="padding:18px 20px">' + etiqueta(et) +
    '<div class="monto" style="margin-top:4px;font-size:36px;line-height:1.1;font-weight:800;color:' + K.mostaza + '">' + esc(monto) + '</div>' +
    (sub ? '<div style="margin-top:4px;font-size:13px;color:' + K.suave + '">' + esc(sub) + '</div>' : '') +
    (chipHtml ? '<div style="margin-top:12px">' + chipHtml + '</div>' : '') + '</td></tr></table>';
}
/* Por donde va la reserva: Pedido, Seña, Saldo, ¡A viajar! */
function pasos(hechos) {
  const nombres = ['Pedido', 'Seña', 'Saldo', '¡A viajar!'];
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + nombres.map(function (n, i) {
    const ok = i < hechos, ahora = i === hechos;
    return '<td width="25%" style="padding:0 3px;vertical-align:top">' +
      '<div style="height:5px;border-radius:5px;background:' + (ok ? K.mostaza : ahora ? '#6B5A1F' : K.borde) + '"></div>' +
      '<div style="margin-top:7px;font-size:12px;font-weight:700;color:' + (ok ? K.texto : K.tenue) + '">' + (ok ? '✓ ' : '') + esc(n) + '</div></td>';
  }).join('') + '</tr></table>';
}
function datos(lista) {
  lista = lista.filter(function (x) { return x[1]; });
  let h = '';
  for (let i = 0; i < lista.length; i += 2) {
    h += '<tr>' + [lista[i], lista[i + 1]].map(function (x) {
      return '<td width="50%" style="padding:9px 0;vertical-align:top">' + (x ? etiqueta(x[0]) + '<div style="margin-top:3px;font-size:15px;font-weight:700;color:' + K.texto + '">' + esc(x[1]) + '</div>' : '') + '</td>';
    }).join('') + '</tr>';
  }
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + K.caja + '" style="background:' + K.caja + ';border-radius:16px"><tr><td style="padding:8px 20px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + h + '</table></td></tr></table>';
}
function fila(izq, der, o) {
  o = o || {};
  return '<tr><td style="padding:12px 0;border-bottom:1px solid ' + K.borde + ';font-size:14px;line-height:1.4;color:' + K.texto + (o.fuerte ? ';font-weight:700' : '') + '">' + izq + '</td>' +
    '<td align="right" style="padding:12px 0 12px 12px;border-bottom:1px solid ' + K.borde + ';font-size:' + (o.fuerte ? 16 : 14) + 'px;font-weight:700;white-space:nowrap;vertical-align:top;color:' + (o.color || K.texto) + '">' + esc(der) + '</td></tr>';
}
function tabla(titulo, filas) { return etiqueta(titulo) + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">' + filas.join('') + '</table>'; }
function servicio(i, conCodigo) {
  return '<span style="font-weight:700">' + icono(i) + '&nbsp; ' + esc(i.nombre) + '</span>' +
    (i.detalle ? '<br><span style="font-size:13px;color:' + K.suave + '">' + esc(i.detalle) + '</span>' : '') +
    (conCodigo && i.ref_proveedor ? '<br><span style="font-size:13px;color:' + K.suave + '">Código del operador: <b style="color:' + K.texto + '">' + esc(i.ref_proveedor) + '</b></span>' : '');
}
function boton(t, href) {
  return '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="' + K.mostaza + '" style="border-radius:12px;background:' + K.mostaza + '">' +
    '<a href="' + esc(href) + '" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:800;color:#0A101A;text-decoration:none">💬&nbsp; ' + esc(t) + '</a></td></tr></table>';
}
function titular(eyebrow, h1, texto) {
  return bloque((eyebrow ? etiqueta(eyebrow, K.mostaza) : '') +
    '<h1 style="margin:' + (eyebrow ? '8px' : '0') + ' 0 10px;font-size:27px;line-height:1.2;font-weight:800;color:' + K.texto + '">' + h1 + '</h1>' +
    '<p style="margin:0;font-size:15px;line-height:1.6;color:' + K.suave + '">' + texto + '</p>', '22px 28px 22px');
}

/* ---------- los tres mails ---------- */
/* descuentoUsd: el cupon del pasaporte que se canjeo al reservar (ya viene restado del total que vio la persona). */
function gracias(p, descuentoUsd) {
  const n = nombreDe(p), items = itemsVivos(p), total = pedidos.cuentas(p).total_usd, desc = Number(descuentoUsd) > 0 ? Number(descuentoUsd) : 0;
  const cuerpo = titular('Solicitud de reserva', '¡Gracias por tu reserva' + (n ? ', ' + esc(n) : '') + '!',
      'Recibimos tu pedido. Ahora confirmamos la disponibilidad con cada proveedor y te escribimos por WhatsApp para pedirte la seña. <b style="color:' + K.texto + '">Hasta entonces no tenés que pagar nada.</b>') +
    bloque(destacado('Total estimado', usd(Math.max(0, total - desc)), 'Seña para reservar: 50 % de los traslados y 25 % de los tours', chip('Esperando confirmación', false))) +
    bloque(pasos(1)) +
    bloque(datos([['Destino', p.destino], ['Fechas', fechasDe(p)], ['Personas', personasDe(p)], ['Referencia', p.ref]])) +
    bloque(tabla('Lo que pediste', items.map(function (i) { return fila(servicio(i), i.precio_usd ? usd(i.precio_usd) : ''); })
      .concat(desc ? [fila('Cupón del pasaporte', '−' + usd(desc), { color: K.verde })] : [])
      .concat([fila('Total estimado', usd(Math.max(0, total - desc)), { fuerte: true })]))) +
    bloque(boton('Consultar por WhatsApp', linkWa(p.ref)), '4px 28px 26px');
  return { asunto: 'Recibimos tu reserva · ' + (p.destino || 'CuántoSale') + ' · ' + p.ref, html: marco('Recibimos tu pedido ' + p.ref + '. Te escribimos por WhatsApp para la seña.', cuerpo) };
}

/* tipo 'sena' | 'saldo'. El pago que se informa es el ultimo cobro (no reembolso) del pedido: el que el panel acaba de registrar. */
function recibo(p, tipo) {
  const c = pedidos.cuentas(p), n = nombreDe(p), pagado = c.saldo_cliente_usd <= 0.005;
  const cobros = (p.pagos || []).filter(function (x) { return !x.reembolso && x.monto_usd > 0; });
  const ultimo = cobros[cobros.length - 1];
  if (!ultimo) { const e = new Error('El pedido no tiene cobros registrados.'); e.status = 400; throw e; }
  const esVoucher = tipo === 'saldo' || pagado;
  const saldo = Math.max(0, c.saldo_cliente_usd);
  const movs = (p.pagos || []).filter(function (x) { return x.monto_usd > 0; });
  const conceptoDe = function (x) { return x.reembolso ? 'Reembolso' : (x.nota || 'Pago'); };
  const cuerpo = titular(esVoucher ? 'Voucher de reserva' : 'Recibo de seña',
      esVoucher ? '¡Tu reserva está paga' + (n ? ', ' + esc(n) : '') + '!' : '¡Recibimos tu seña' + (n ? ', ' + esc(n) : '') + '!',
      esVoucher ? 'Recibimos tu pago y tu reserva quedó paga en su totalidad. Te adjuntamos el voucher en PDF: guardalo o mostralo desde el celular.'
        : 'Tu reserva quedó confirmada. El saldo se abona antes del viaje y te lo pedimos por WhatsApp. Te adjuntamos el recibo en PDF.') +
    bloque(destacado('Pagaste', usd(ultimo.monto_usd), [fechaCorta(ultimo.fecha), ultimo.medio].filter(Boolean).join(' · '),
      chip(esVoucher ? '✓ Reserva paga' : '✓ Reserva confirmada', true))) +
    bloque(pasos(esVoucher ? 3 : 2)) +
    bloque(datos([['Titular', capital(p.cliente_nombre)], ['Destino', p.destino], ['Fechas', fechasDe(p)], ['Personas', personasDe(p)], ['Referencia', p.ref], ['Emitido', hoy()]])) +
    bloque(tabla('Servicios', itemsVivos(p).map(function (i) { return fila(servicio(i, esVoucher), i.precio_usd ? usd(i.precio_usd) : ''); })
      .concat([fila('Total de la reserva', usd(c.total_usd), { fuerte: true })]))) +
    bloque(tabla('Pagos', movs.map(function (x) {
      return fila(esc(conceptoDe(x)) + '<br><span style="font-size:13px;color:' + K.suave + '">' + esc([fechaCorta(x.fecha), x.medio].filter(Boolean).join(' · ')) + '</span>', (x.reembolso ? '−' : '') + usd(x.monto_usd));
    }).concat([fila('Total pagado', usd(c.cobrado_usd), { fuerte: true }),
      fila(pagado ? 'Saldo pendiente' : 'Saldo pendiente (antes del viaje)', pagado ? usd(0) + ' · pago completo' : usd(saldo), { fuerte: true, color: pagado ? K.verde : K.mostaza })]))) +
    bloque(boton('Consultar por WhatsApp', linkWa(p.ref)), '4px 28px 14px') +
    bloque('<p style="margin:0;font-size:12px;color:' + K.tenue + '">📎 ' + (esVoucher ? 'Voucher' : 'Recibo') + ' en PDF adjunto. Comprobante de pago de CuántoSale, no válido como factura.</p>', '0 28px 22px');

  const archivo = pdf.recibo({
    doc: esVoucher ? 'Voucher de reserva' : 'Recibo de seña',
    titulo: esVoucher ? 'Reserva paga' : 'Seña recibida',
    estado: esVoucher ? 'Reserva paga' : 'Reserva confirmada · saldo antes del viaje',
    pagado: pagado, ref: p.ref, emitido: hoy(),
    datos: [['Titular', capital(p.cliente_nombre)], ['Destino', p.destino || ''], ['Fechas', fechasDe(p)], ['Personas', personasDe(p)]].filter(function (x) { return x[1]; }),
    servicios: itemsVivos(p).map(function (i) { return { nombre: i.nombre, detalle: i.detalle, codigo: esVoucher ? i.ref_proveedor : '', monto: i.precio_usd ? usd(i.precio_usd) : '' }; }),
    total: usd(c.total_usd),
    pagos: movs.map(function (x) { return { fecha: fechaCorta(x.fecha), concepto: conceptoDe(x), medio: x.medio, monto: (x.reembolso ? '-' : '') + usd(x.monto_usd) }; }),
    resumen: [['Total de la reserva', usd(c.total_usd)], ['Total pagado', usd(c.cobrado_usd)]],
    saldoTxt: pagado ? 'Saldo pendiente · pago completo' : 'Saldo pendiente (se abona antes del viaje)', saldo: usd(saldo),
    pie: ['Comprobante de pago de CuántoSale (cuantosale.uy). No válido como factura.', 'Consultas por WhatsApp al +598 98 529 851 · Ref ' + p.ref]
  });
  return {
    asunto: (esVoucher ? 'Voucher de tu reserva' : 'Recibo de tu seña') + ' · ' + (p.destino || 'CuántoSale') + ' · ' + p.ref,
    html: marco(esVoucher ? 'Tu reserva ' + p.ref + ' quedó paga. Te adjuntamos el voucher en PDF.' : 'Recibimos tu seña y tu reserva ' + p.ref + ' quedó confirmada.', cuerpo),
    adjuntos: [{ filename: (esVoucher ? 'Voucher-' : 'Recibo-sena-') + String(p.ref).replace(/[^A-Za-z0-9-]/g, '') + '.pdf', content: archivo.toString('base64') }]
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
    }, reply ? { reply_to: reply } : {}, m.adjuntos ? { attachments: m.adjuntos } : {})),
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) {
    const d = await r.text().catch(function () { return ''; });
    const e = new Error('Resend respondió ' + r.status + (d ? ': ' + d.slice(0, 160) : '')); e.status = 502; throw e;
  }
  return { ok: true, email: to };
}

/* Desde la reserva web. Nunca tira: el mail es un extra y el pedido ya quedo guardado. */
async function enviarGracias(p, descuentoUsd) {
  try {
    if (!p || !p.ref || graciasEnviados.has(p.ref)) return false;
    await enviar(p.cliente_email, gracias(p, descuentoUsd), 'gracias');
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
