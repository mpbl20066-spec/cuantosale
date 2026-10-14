'use strict';
/* Mails al cliente de una reserva (Resend):
   - gracias: sale solo al reservar en la web (lib/reservas.js), con lo que pidio y que sigue.
   - sena:    recibo de la sena, cuando el panel registra "Ya pago la sena". La reserva queda confirmada.
   - saldo:   voucher de la reserva paga, cuando el panel registra "Ya pago el saldo".
   El recibo y el voucher van tambien en PDF adjunto (lib/recibo-pdf.js) para descargarlo o imprimirlo, y salen del
   pedido guardado (montos, pagos y servicios del servidor, nunca del navegador). Los montos se guardan en US$ y van en reales con la cotizacion del dia (moneda()).

   Fondo blanco siempre (color-scheme light only): el diseno oscuro de antes Hotmail/Outlook lo aclaraba solo y quedaba
   gris y sin contraste. Las dudas van por WhatsApp: el mail sale de
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
// Fondo blanco siempre (decision del dueño). La mostaza va en barras, bordes y botones; como texto sobre blanco no se
// lee, para eso esta acento.
const K = { fondo: '#FFFFFF', tarjeta: '#FFFFFF', caja: '#F7F8FA', borde: '#E4E7EC', texto: '#0A101A', suave: '#475467', tenue: '#667085', mostaza: '#F7C325', acento: '#946200', amarilloFondo: '#FEF3C7', verde: '#067647', verdeFondo: '#DCFAE6' };
const FUENTE = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
/* Montos en reales: se guardan en US$ y se pasan con la cotizacion del dia (la misma de /api/tasas que usa el panel
   para pedir la sena, redondeada hacia arriba al centavo como ahi). Los totales son la suma de lo ya convertido, asi
   el mail cierra al centavo. Sin cotizacion (la fuente no respondio) queda en US$ para no inventar un numero. */
function moneda(brl) {
  const r = Number(brl) > 0 ? Number(brl) : 0;
  const v = function (usdN) { const n = Number(usdN) || 0; return r ? Math.ceil(Math.round(n * r * 1e4) / 100) / 100 : Math.round(n * 100) / 100; };
  const t = function (n) {
    const x = Math.round(Number(n) * 100) / 100;
    return (r ? 'R$ ' : 'US$ ') + x.toLocaleString('es-UY', { minimumFractionDigits: r || x % 1 ? 2 : 0, maximumFractionDigits: 2 });
  };
  return { v: v, t: t, m: function (usdN) { return t(v(usdN)); }, suma: function (l) { return Math.round(l.reduce(function (a, x) { return a + x; }, 0) * 100) / 100; },
    nota: r ? 'Valores en reales a la cotización del ' + hoy() + ': US$ 1 = R$ ' + r.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '.' : '' };
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
/* Hotmail/Outlook.com en modo oscuro oscurece el mail aunque diga color-scheme light, y marca cada elemento que cambio
   (data-ogsb el fondo, data-ogsc el texto). Con esas marcas se le devuelven los colores: cada elemento lleva una clase
   segun su color (marcarColores) y el estilo de abajo la restituye. Asi queda blanco tambien ahi. */
const CLASE_FONDO = { FFFFFF: 'cs-b', F7F8FA: 'cs-c', F7C325: 'cs-m', FBE3A0: 'cs-m2', FEF3C7: 'cs-y', DCFAE6: 'cs-g', E4E7EC: 'cs-l' };
const CLASE_TEXTO = { '0A101A': 'cs-t', 475467: 'cs-s', 667085: 'cs-n', 946200: 'cs-a', '067647': 'cs-v' };
const CSS_OUTLOOK = Object.keys(CLASE_FONDO).map(function (c) { return '[data-ogsb] .' + CLASE_FONDO[c] + '{background-color:#' + c + '!important}'; }).join('') +
  Object.keys(CLASE_TEXTO).map(function (c) { return '[data-ogsc] .' + CLASE_TEXTO[c] + '{color:#' + c + '!important}'; }).join('');
function marcarColores(html) {
  return html.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, function (tag, nom, attrs) {
    const st = (/style="([^"]*)"/i.exec(attrs) || [])[1] || '', bg = (/bgcolor="#([0-9A-Fa-f]{6})"/i.exec(attrs) || /background(?:-color)?:\s*#([0-9A-Fa-f]{6})/i.exec(st) || [])[1];
    const tx = (/(?:^|;)\s*color:\s*#([0-9A-Fa-f]{6})/i.exec(st) || [])[1];
    const cl = [bg && CLASE_FONDO[bg.toUpperCase()], tx && CLASE_TEXTO[tx.toUpperCase()]].filter(Boolean);
    if (!cl.length) return tag;
    return /\bclass="/i.test(attrs) ? tag.replace(/\bclass="/i, 'class="' + cl.join(' ') + ' ') : '<' + nom + ' class="' + cl.join(' ') + '"' + attrs + '>';
  });
}
/* Foto del destino para la cabecera: las mismas de la web (public/fotos/<clave>.jpg, 960x464). Se busca la clave por el
   nombre del destino del pedido ("Florianópolis, Brasil" -> fln). Sin foto, el mail va sin cabecera. */
let _destinos = null;
function fotoDestino(p) {
  const norm = function (x) { return String(x || '').split(',')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  const d = norm(p && p.destino);
  if (!d) return '';
  try {
    if (!_destinos) { const M = require('./model'); _destinos = Object.keys(M.DEST).map(function (k) { return { k: k, n: norm(M.DEST[k].name) }; }); }
    const x = _destinos.filter(function (y) { return y.n === d; })[0] || _destinos.filter(function (y) { return y.n && (d.indexOf(y.n) === 0 || y.n.indexOf(d) === 0); })[0];
    if (!x || !require('fs').existsSync(require('path').join(__dirname, '..', 'public', 'fotos', x.k + '.jpg'))) return '';
    return 'https://cuantosale.uy/fotos/' + x.k + '.jpg';
  } catch (e) { return ''; }
}
/* Diseno "moderno con foto" (decision del dueño): fondo blanco, logo chico, foto grande del destino, titulo grande, el
   monto bien visible y un boton principal ancho. Sin cajas oscuras ni bordes pesados. */
function marco(preheader, cuerpo, foto) {
  return marcarColores('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">' +
    '<style>' + CSS_OUTLOOK + ':root{color-scheme:light only}body{margin:0;padding:0}a{text-decoration:none}@media (max-width:520px){.pad{padding-left:20px!important;padding-right:20px!important}.monto{font-size:34px!important}.h1{font-size:26px!important}}</style></head>' +
    '<body style="margin:0;padding:0;background:' + K.fondo + '" bgcolor="' + K.fondo + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + K.fondo + '" style="background:' + K.fondo + '"><tr><td align="center" style="padding:20px 8px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + K.tarjeta + '" style="max-width:600px;background:' + K.tarjeta + ';' + FUENTE + 'color:' + K.texto + '">' +
    '<tr><td class="pad" style="padding:4px 28px 18px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="vertical-align:middle"><img src="' + LOGO + '" width="30" height="30" alt="" style="display:block;border-radius:8px"></td>' +
    '<td style="vertical-align:middle;padding-left:9px;font-size:19px;font-weight:800;color:' + K.texto + ';letter-spacing:-.01em">cuántosale</td></tr></table></td></tr>' +
    (foto ? '<tr><td class="pad" style="padding:0 28px"><img src="' + esc(foto) + '" width="544" alt="" style="display:block;width:100%;max-width:544px;height:auto;border-radius:18px;border:0"></td></tr>' : '') +
    cuerpo +
    '<tr><td class="pad" style="padding:10px 28px 8px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ' + K.borde + '"><tr><td align="center" style="padding-top:18px;font-size:12px;line-height:1.6;color:' + K.tenue + '">' +
    '<b style="color:' + K.texto + '">CuántoSale</b> · <a href="https://cuantosale.uy" style="color:' + K.tenue + '">cuantosale.uy</a><br>Este mail sale de una casilla que no recibe respuestas.<br>Para cualquier consulta, escribinos por WhatsApp al +598 98 529 851.' +
    '</td></tr></table></td></tr></table></td></tr></table></body></html>');
}
function bloque(html, pad) { return '<tr><td class="pad" style="padding:' + (pad || '0 28px 24px') + '">' + html + '</td></tr>'; }
function etiqueta(t, color) { return '<div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + (color || K.tenue) + '">' + esc(t) + '</div>'; }
function chip(t, ok) {
  return '<span style="display:inline-block;padding:6px 12px;border-radius:99px;font-size:13px;font-weight:700;white-space:nowrap;background:' + (ok ? K.verdeFondo : K.amarilloFondo) + ';color:' + (ok ? K.verde : K.acento) + '">' + esc(t) + '</span>';
}
/* El monto, grande y suelto: lo primero que se lee despues del titulo. */
function destacado(et, monto, sub, chipHtml) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + K.caja + '" style="background:' + K.caja + ';border-radius:18px"><tr>' +
    '<td style="padding:22px 24px">' + etiqueta(et) +
    '<div class="monto" style="margin-top:6px;font-size:42px;line-height:1.05;font-weight:800;letter-spacing:-.02em;color:' + K.texto + '">' + esc(monto) + '</div>' +
    (sub ? '<div style="margin-top:8px;font-size:14px;line-height:1.5;color:' + K.suave + '">' + esc(sub) + '</div>' : '') +
    (chipHtml ? '<div style="margin-top:14px">' + chipHtml + '</div>' : '') + '</td></tr></table>';
}
/* Por donde va la reserva: Pedido, Seña, Saldo, ¡A viajar! */
function pasos(hechos) {
  const nombres = ['Pedido', 'Seña', 'Saldo', '¡A viajar!'];
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + nombres.map(function (n, i) {
    const ok = i < hechos, ahora = i === hechos;
    return '<td width="25%" style="padding:0 3px;vertical-align:top">' +
      '<div style="height:4px;border-radius:4px;background:' + (ok ? K.mostaza : ahora ? '#FBE3A0' : K.borde) + '"></div>' +
      '<div style="margin-top:7px;font-size:12px;font-weight:' + (ok || ahora ? 700 : 500) + ';color:' + (ok || ahora ? K.texto : K.tenue) + '">' + (ok ? '✓ ' : '') + esc(n) + '</div></td>';
  }).join('') + '</tr></table>';
}
/* Los datos del viaje en renglones simples: etiqueta a la izquierda, valor a la derecha. */
function datos(lista) {
  lista = lista.filter(function (x) { return x[1]; });
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + lista.map(function (x, i) {
    const linea = i < lista.length - 1 ? 'border-bottom:1px solid ' + K.borde + ';' : '';
    return '<tr><td style="padding:10px 0;' + linea + 'font-size:14px;color:' + K.suave + '">' + esc(x[0]) + '</td>' +
      '<td align="right" style="padding:10px 0 10px 12px;' + linea + 'font-size:14px;font-weight:700;color:' + K.texto + '">' + esc(x[1]) + '</td></tr>';
  }).join('') + '</table>';
}
function fila(izq, der, o) {
  o = o || {};
  return '<tr><td style="padding:13px 0;border-bottom:1px solid ' + K.borde + ';font-size:15px;line-height:1.4;color:' + K.texto + (o.fuerte ? ';font-weight:700' : '') + '">' + izq + '</td>' +
    '<td align="right" style="padding:13px 0 13px 12px;border-bottom:1px solid ' + K.borde + ';font-size:' + (o.fuerte ? 17 : 15) + 'px;font-weight:700;white-space:nowrap;vertical-align:top;color:' + (o.color || K.texto) + '">' + esc(der) + '</td></tr>';
}
function tabla(titulo, filas) { return etiqueta(titulo) + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">' + filas.join('') + '</table>'; }
function servicio(i, conCodigo) {
  return '<span style="font-weight:700">' + icono(i) + '&nbsp; ' + esc(i.nombre) + '</span>' +
    (i.detalle ? '<br><span style="font-size:13px;color:' + K.suave + '">' + esc(i.detalle) + '</span>' : '') +
    (conCodigo && i.ref_proveedor ? '<br><span style="font-size:13px;color:' + K.suave + '">Código del operador: <b style="color:' + K.texto + '">' + esc(i.ref_proveedor) + '</b></span>' : '');
}
/* Boton principal: ancho completo, mostaza, texto negro. */
function boton(t, href) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="' + K.mostaza + '" style="border-radius:14px;background:' + K.mostaza + '">' +
    '<a href="' + esc(href) + '" style="display:block;padding:16px 20px;font-size:16px;font-weight:800;color:#0A101A;text-decoration:none;text-align:center">' + esc(t) + '</a></td></tr></table>';
}
function titular(eyebrow, h1, texto) {
  return bloque((eyebrow ? etiqueta(eyebrow, K.acento) : '') +
    '<h1 class="h1" style="margin:' + (eyebrow ? '8px' : '0') + ' 0 12px;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-.02em;color:' + K.texto + '">' + h1 + '</h1>' +
    '<p style="margin:0;font-size:16px;line-height:1.6;color:' + K.suave + '">' + texto + '</p>', '26px 28px 24px');
}

/* ---------- los tres mails ----------
   brl: cotizacion del dia (reales por dolar). Sin ella los montos quedan en US$. */
/* descuentoUsd: el cupon del pasaporte que se canjeo al reservar (ya viene restado del total que vio la persona). */
function gracias(p, descuentoUsd, brl) {
  const M = moneda(brl), n = nombreDe(p), items = itemsVivos(p), desc = Number(descuentoUsd) > 0 ? M.v(descuentoUsd) : 0;
  const total = Math.max(0, Math.round((M.suma(items.map(function (i) { return M.v(i.precio_usd); })) - desc) * 100) / 100);
  const cuerpo = titular('Solicitud de reserva', '¡Gracias por tu reserva' + (n ? ', ' + esc(n) : '') + '!',
      'Recibimos tu pedido. Ahora confirmamos la disponibilidad con cada proveedor y te escribimos por WhatsApp para pedirte la seña. <b style="color:' + K.texto + '">Hasta entonces no tenés que pagar nada.</b>') +
    bloque(destacado('Total estimado', M.t(total), 'Seña para reservar: 50 % de los traslados y 25 % de los tours', chip('Esperando confirmación', false))) +
    bloque(pasos(1)) +
    bloque(datos([['Destino', p.destino], ['Fechas', fechasDe(p)], ['Personas', personasDe(p)], ['Referencia', p.ref]])) +
    bloque(tabla('Lo que pediste', items.map(function (i) { return fila(servicio(i), i.precio_usd ? M.m(i.precio_usd) : ''); })
      .concat(desc ? [fila('Cupón del pasaporte', '−' + M.t(desc), { color: K.verde })] : [])
      .concat([fila('Total estimado', M.t(total), { fuerte: true })]))) +
    bloque(boton('Consultar por WhatsApp', linkWa(p.ref)), '4px 28px ' + (M.nota ? '14px' : '26px')) +
    (M.nota ? bloque('<p style="margin:0;font-size:12px;line-height:1.5;color:' + K.tenue + '">' + esc(M.nota) + ' El monto final se confirma al pedirte la seña.</p>', '0 28px 22px') : '');
  return { asunto: 'Recibimos tu reserva · ' + (p.destino || 'CuántoSale') + ' · ' + p.ref, html: marco('Recibimos tu pedido ' + p.ref + '. Te escribimos por WhatsApp para la seña.', cuerpo, fotoDestino(p)) };
}

/* tipo 'sena' | 'saldo'. El pago que se informa es el ultimo cobro (no reembolso) del pedido: el que el panel acaba de registrar. */
function recibo(p, tipo, brl) {
  const M = moneda(brl), c = pedidos.cuentas(p), n = nombreDe(p), pagado = c.saldo_cliente_usd <= 0.005;
  const cobros = (p.pagos || []).filter(function (x) { return !x.reembolso && x.monto_usd > 0; });
  const ultimo = cobros[cobros.length - 1];
  if (!ultimo) { const e = new Error('El pedido no tiene cobros registrados.'); e.status = 400; throw e; }
  const esVoucher = tipo === 'saldo' || pagado;
  const vivos = itemsVivos(p), movs = (p.pagos || []).filter(function (x) { return x.monto_usd > 0; });
  /* Totales sumando lo ya convertido, para que cierre al centavo. Si hay cargos de servicios cancelados (el total no
     es la suma de los que siguen), se convierte el total directo. */
  const sumaVivosUsd = vivos.reduce(function (a, i) { return a + (i.precio_usd || 0); }, 0);
  const total = Math.abs(sumaVivosUsd - c.total_usd) < 0.005 ? M.suma(vivos.map(function (i) { return M.v(i.precio_usd); })) : M.v(c.total_usd);
  /* Cada pago convertido por separado puede sumar un centavo de mas o de menos: con la reserva paga, el ultimo cobro
     absorbe esa diferencia para que lo pagado sea exactamente el total. */
  const enMoneda = new Map(movs.map(function (x) { return [x, M.v(x.monto_usd)]; }));
  let cobrado = M.suma(movs.map(function (x) { return (x.reembolso ? -1 : 1) * enMoneda.get(x); }));
  if (pagado && Math.abs(total - cobrado) <= 0.05) { enMoneda.set(ultimo, Math.round((enMoneda.get(ultimo) + total - cobrado) * 100) / 100); cobrado = total; }
  const mm = function (x) { return M.t(enMoneda.get(x)); };
  const saldo = pagado ? 0 : Math.max(0, Math.round((total - cobrado) * 100) / 100);
  const conceptoDe = function (x) { return x.reembolso ? 'Reembolso' : (x.nota || 'Pago'); };
  const pie = 'Comprobante de pago de CuántoSale, no válido como factura.' + (M.nota ? ' ' + M.nota : '');
  const cuerpo = titular(esVoucher ? 'Voucher de reserva' : 'Recibo de seña',
      esVoucher ? '¡Tu reserva está paga' + (n ? ', ' + esc(n) : '') + '!' : '¡Recibimos tu seña' + (n ? ', ' + esc(n) : '') + '!',
      esVoucher ? 'Recibimos tu pago y tu reserva quedó paga en su totalidad. Te adjuntamos el voucher en PDF: guardalo o mostralo desde el celular.'
        : 'Tu reserva quedó confirmada. El saldo se abona antes del viaje y te lo pedimos por WhatsApp. Te adjuntamos el recibo en PDF.') +
    bloque(destacado('Pagaste', mm(ultimo), [fechaCorta(ultimo.fecha), ultimo.medio].filter(Boolean).join(' · '),
      chip(esVoucher ? '✓ Reserva paga' : '✓ Reserva confirmada', true))) +
    bloque(pasos(esVoucher ? 3 : 2)) +
    bloque(datos([['Titular', capital(p.cliente_nombre)], ['Destino', p.destino], ['Fechas', fechasDe(p)], ['Personas', personasDe(p)], ['Referencia', p.ref], ['Emitido', hoy()]])) +
    bloque(tabla('Servicios', vivos.map(function (i) { return fila(servicio(i, esVoucher), i.precio_usd ? M.m(i.precio_usd) : ''); })
      .concat([fila('Total de la reserva', M.t(total), { fuerte: true })]))) +
    bloque(tabla('Pagos', movs.map(function (x) {
      return fila(esc(conceptoDe(x)) + '<br><span style="font-size:13px;color:' + K.suave + '">' + esc([fechaCorta(x.fecha), x.medio].filter(Boolean).join(' · ')) + '</span>', (x.reembolso ? '−' : '') + mm(x));
    }).concat([fila('Total pagado', M.t(cobrado), { fuerte: true }),
      fila(pagado ? 'Saldo pendiente' : 'Saldo pendiente (antes del viaje)', pagado ? M.t(0) + ' · pago completo' : M.t(saldo), { fuerte: true, color: pagado ? K.verde : K.acento })]))) +
    bloque(boton('Consultar por WhatsApp', linkWa(p.ref)), '4px 28px 14px') +
    bloque('<p style="margin:0;font-size:12px;line-height:1.5;color:' + K.tenue + '">📎 ' + (esVoucher ? 'Voucher' : 'Recibo') + ' en PDF adjunto. ' + esc(pie) + '</p>', '0 28px 22px');

  const archivo = pdf.recibo({
    doc: esVoucher ? 'Voucher de reserva' : 'Recibo de seña',
    titulo: esVoucher ? 'Reserva paga' : 'Seña recibida',
    estado: esVoucher ? 'Reserva paga' : 'Reserva confirmada · saldo antes del viaje',
    pagado: pagado, ref: p.ref, emitido: hoy(),
    datos: [['Titular', capital(p.cliente_nombre)], ['Destino', p.destino || ''], ['Fechas', fechasDe(p)], ['Personas', personasDe(p)]].filter(function (x) { return x[1]; }),
    servicios: vivos.map(function (i) { return { nombre: i.nombre, detalle: i.detalle, codigo: esVoucher ? i.ref_proveedor : '', monto: i.precio_usd ? M.m(i.precio_usd) : '' }; }),
    total: M.t(total),
    pagos: movs.map(function (x) { return { fecha: fechaCorta(x.fecha), concepto: conceptoDe(x), medio: x.medio, monto: (x.reembolso ? '-' : '') + mm(x) }; }),
    resumen: [['Total de la reserva', M.t(total)], ['Total pagado', M.t(cobrado)]],
    saldoTxt: pagado ? 'Saldo pendiente · pago completo' : 'Saldo pendiente (se abona antes del viaje)', saldo: M.t(saldo),
    pie: ['Comprobante de pago de CuántoSale (cuantosale.uy). No válido como factura.', (M.nota ? M.nota + ' · ' : '') + 'WhatsApp +598 98 529 851 · Ref ' + p.ref]
  });
  return {
    asunto: (esVoucher ? 'Voucher de tu reserva' : 'Recibo de tu seña') + ' · ' + (p.destino || 'CuántoSale') + ' · ' + p.ref,
    html: marco(esVoucher ? 'Tu reserva ' + p.ref + ' quedó paga. Te adjuntamos el voucher en PDF.' : 'Recibimos tu seña y tu reserva ' + p.ref + ' quedó confirmada.', cuerpo, fotoDestino(p)),
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
async function enviarGracias(p, descuentoUsd, brl) {
  try {
    if (!p || !p.ref || graciasEnviados.has(p.ref)) return false;
    await enviar(p.cliente_email, gracias(p, descuentoUsd, brl), 'gracias');
    if (graciasEnviados.size >= MAX_GRACIAS) graciasEnviados.clear();
    graciasEnviados.add(p.ref);
    return true;
  } catch (e) { console.warn('[mail-cliente] gracias no salio:', e.message); return false; }
}

/* Desde el panel. Tira con status para que el panel muestre el motivo. */
async function enviarRecibo(p, tipo, brl) {
  if (tipo !== 'sena' && tipo !== 'saldo') { const e = new Error('Tipo de recibo desconocido.'); e.status = 400; throw e; }
  return enviar(p.cliente_email, recibo(p, tipo, brl), tipo);
}

module.exports = { enviarGracias: enviarGracias, enviarRecibo: enviarRecibo, _gracias: gracias, _recibo: recibo,
  /* Las piezas del diseno para los demas mails (lib/mail-avisos.js). moneda/usd segun cual exista: asi sirve con y sin
     los montos en reales. */
  _piezas: { K: K, esc: esc, marco: marco, fotoDestino: fotoDestino, bloque: bloque, etiqueta: etiqueta, chip: chip, destacado: destacado, pasos: pasos, datos: datos, fila: fila,
    tabla: tabla, servicio: servicio, boton: boton, titular: titular, nombreDe: nombreDe, capital: capital, fechaCorta: fechaCorta, hoy: hoy,
    fechasDe: fechasDe, personasDe: personasDe, itemsVivos: itemsVivos, linkWa: linkWa, enviar: enviar, WA_NUMERO: WA_NUMERO,
    moneda: typeof moneda === 'function' ? moneda : null, usd: typeof usd === 'function' ? usd : null } };
