'use strict';
/* Los demas mails al cliente de una reserva, con el mismo diseno que lib/mail-cliente.js (gracias, recibo y voucher):

   Desde el panel /admin (POST /api/admin/pedido/mail), junto con el WhatsApp del mismo aviso, para que llegue aunque
   la plantilla de WhatsApp no salga o el cliente no haya escrito en las ultimas 24 h:
   - sena:               el proveedor confirmo, cuanto es la sena y como pagarla.
   - saldo:              el saldo que falta y como pagarlo.
   - cancelado:          se cancelo la reserva entera, que se devuelve y que no (la linea del reembolso del panel).
   - servicio_cancelado: se cancelo parte de la reserva, con el nuevo total.
   - reembolso:          comprobante del reembolso registrado en el panel.

   Solos, una vez por dia (GET /api/mails/revisar, el cron de Vercel con CRON_SECRET):
   - saldo_recordatorio: faltan 10 dias o menos para viajar y sigue debiendo el saldo (ya pago la sena).
   - previaje:           faltan 1 a 3 dias: cada tour y traslado con lo que hay que saber (punto de salida, que llevar).
   - postviaje:          volvio hace 2 a 10 dias: como le fue y una resena.
   Cada uno sale una sola vez por pedido: queda en el historial del pedido (tipo 'mail') y se mira ahi antes de
   mandarlo. Sin la columna historial no se manda ninguno automatico, para no repetirlos todos los dias.

   Desde la web (lib/reservas.js): cambio, cuando el cliente cambia algo que ya habia pedido (en vez de "gracias").

   Montos: en reales con la cotizacion del dia si lib/mail-cliente.js ya los usa (moneda), si no en US$. */
const pedidos = require('./pedidos');
const P = require('./mail-cliente')._piezas;
const K = P.K, esc = P.esc, bloque = P.bloque, fila = P.fila;

const TITULOS = {
  sena: 'Mail: pedido de seña', saldo: 'Mail: pedido del saldo', cancelado: 'Mail: aviso de cancelación',
  servicio_cancelado: 'Mail: aviso de servicio cancelado', reembolso: 'Mail: comprobante de reembolso',
  saldo_recordatorio: 'Mail: recordatorio del saldo', previaje: 'Mail: antes del viaje', postviaje: 'Mail: después del viaje'
};
const DESDE_PANEL = ['sena', 'saldo', 'cancelado', 'servicio_cancelado', 'reembolso', 'previaje', 'postviaje'];

/* Formato de los montos: el de mail-cliente (reales o dolares) o, si todavia no existe, dolares. */
function moneda(brl) {
  if (P.moneda) return P.moneda(brl);
  const t = function (n) { const x = Math.round(Number(n) * 100) / 100; return 'US$ ' + x.toLocaleString('es-UY', { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  return { v: function (n) { return Math.round((Number(n) || 0) * 100) / 100; }, t: t, m: function (n) { return t(n); }, suma: function (l) { return Math.round(l.reduce(function (a, x) { return a + x; }, 0) * 100) / 100; }, nota: '' };
}
function wa(texto) { return 'https://wa.me/' + P.WA_NUMERO + '?text=' + encodeURIComponent(texto); }
function parrafo(html) { return '<p style="margin:0;font-size:14px;line-height:1.6;color:' + K.suave + '">' + html + '</p>'; }
function nota(M, extra) { const t = [extra, M.nota].filter(Boolean).join(' '); return t ? bloque('<p style="margin:0;font-size:12px;line-height:1.5;color:' + K.tenue + '">' + esc(t) + '</p>', '0 28px 22px') : ''; }
function hola(p) { const n = P.nombreDe(p); return n ? ', ' + esc(n) : ''; }
function asunto(t, p) { return t + ' · ' + (p.destino || 'CuántoSale') + ' · ' + p.ref; }
function diasHasta(iso, ahora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  const hoyUY = new Date((ahora || Date.now()) - 3 * 3600e3).toISOString().slice(0, 10);   // Uruguay, UTC-3
  return Math.round((Date.parse(iso) - Date.parse(hoyUY)) / 86400e3);
}

/* Como pagar: los medios sin recargo (los que estan cargados en Vercel) y Mercado Pago con el recargo. */
function comoPagar(M, montoUsd) {
  const dp = pedidos.datosPago(), rec = Number(pedidos.RECARGO_TARJETA) >= 0 ? Number(pedidos.RECARGO_TARJETA) : 0.05;
  const medios = [['Transferencia bancaria', dp.transferencia], ['Prex', dp.prex], ['Pix', dp.pix]].filter(function (x) { return x[1]; });
  const filas = medios.map(function (x) { return fila('<b>' + esc(x[0]) + '</b><br><span style="font-size:13px;color:' + K.suave + '">' + esc(x[1]) + '</span>', M.m(montoUsd)); });
  filas.push(fila('<b>Mercado Pago con tarjeta</b><br><span style="font-size:13px;color:' + K.suave + '">Te mandamos el link de pago (' + Math.round(rec * 100) + ' % de recargo)</span>', M.m(montoUsd * (1 + rec))));
  return P.tabla(medios.length ? 'Cómo pagar · sin recargo por ' + medios.map(function (x) { return x[0].replace(' bancaria', ''); }).join(', ').replace(/, ([^,]*)$/, ' o $1') : 'Cómo pagar', filas);
}
function serviciosTabla(M, p, titulo) {
  const items = P.itemsVivos(p);
  return P.tabla(titulo || 'Tu reserva', items.map(function (i) { return fila(P.servicio(i), i.precio_usd ? M.m(i.precio_usd) : ''); })
    .concat([fila('Total de la reserva', M.t(M.suma(items.map(function (i) { return M.v(i.precio_usd); }))), { fuerte: true })]));
}

/* ---------- los mails ---------- */
function sena(p, brl) {
  const M = moneda(brl), c = pedidos.cuentas(p), monto = c.sena_pendiente_usd || c.sena_usd;
  const cuerpo = P.titular('Reserva confirmada', '¡El proveedor confirmó tu reserva' + hola(p) + '!',
      'Ya está todo disponible. Para dejarla reservada te pedimos una seña. <b style="color:' + K.texto + '">Cuando pagues, avisanos por WhatsApp con el comprobante</b> y te mandamos el recibo.') +
    bloque(P.destacado('Seña para reservar', M.m(monto), '50 % de los traslados y 25 % de los tours · el resto se abona antes del viaje', P.chip('Esperando la seña', false))) +
    bloque(P.pasos(1)) +
    bloque(comoPagar(M, monto)) +
    bloque(P.datos([['Destino', p.destino], ['Fechas', P.fechasDe(p)], ['Personas', P.personasDe(p)], ['Referencia', p.ref]])) +
    bloque(serviciosTabla(M, p)) +
    bloque(P.boton('Ya pagué: mandar comprobante', wa('Hola! Ya pagué la seña de mi reserva ' + p.ref + '. Te mando el comprobante.')), '4px 28px 14px') +
    nota(M);
  return { asunto: asunto('Tu reserva está confirmada: pagá la seña', p), html: P.marco('El proveedor confirmó tu reserva ' + p.ref + '. Te pedimos la seña de ' + M.m(monto) + '.', cuerpo) };
}

/* recordatorio: lo manda el cron unos dias antes del viaje (mismo mail, otro titulo). */
function saldo(p, brl, recordatorio) {
  const M = moneda(brl), c = pedidos.cuentas(p), monto = c.saldo_cliente_usd, dias = diasHasta(p.fecha_ida);
  const falta = dias != null && dias >= 0 ? (dias === 0 ? 'Tu viaje es hoy' : dias === 1 ? 'Tu viaje es mañana' : 'Faltan ' + dias + ' días para tu viaje') : '';
  const cuerpo = P.titular(recordatorio ? 'Recordatorio' : 'Saldo de tu reserva', recordatorio ? esc(falta || 'Se acerca tu viaje') + hola(p) + ' ✈️' : 'Te pasamos el saldo de tu reserva' + hola(p),
      'Para que todo quede listo, falta abonar el saldo de tu reserva antes de viajar. <b style="color:' + K.texto + '">Cuando pagues, avisanos por WhatsApp con el comprobante</b> y te mandamos el voucher.') +
    bloque(P.destacado('Saldo a pagar', M.m(monto), 'Ya pagaste ' + M.m(c.cobrado_usd) + ' de ' + M.m(c.total_usd), P.chip('Seña recibida ✓', true))) +
    bloque(P.pasos(2)) +
    bloque(comoPagar(M, monto)) +
    bloque(P.datos([['Destino', p.destino], ['Fechas', P.fechasDe(p)], ['Personas', P.personasDe(p)], ['Referencia', p.ref]])) +
    bloque(P.boton('Ya pagué: mandar comprobante', wa('Hola! Ya pagué el saldo de mi reserva ' + p.ref + '. Te mando el comprobante.')), '4px 28px 14px') +
    nota(M);
  return { asunto: asunto(recordatorio ? (falta || 'Se acerca tu viaje') + ': falta el saldo' : 'Saldo de tu reserva', p), html: P.marco('Falta abonar ' + M.m(monto) + ' de tu reserva ' + p.ref + '.', cuerpo) };
}

/* x = { reembolso: la linea que se le dijo por WhatsApp (lineaReembolso del panel), servicios: los nombres cancelados }. */
function cancelacion(p, brl, x, parcial) {
  x = x || {};
  const M = moneda(brl), c = pedidos.cuentas(p);
  const cancelados = (p.items || []).filter(function (i) { return i.nombre && (p.estado === 'cancelado' || i.estado === 'cancelado'); });
  const filas = cancelados.map(function (i) {
    const retiene = Number(i.cargo_cliente_usd) > 0;
    return fila(P.servicio(i), retiene ? 'Se retiene ' + M.m(i.cargo_cliente_usd) : 'Cancelado', { color: retiene ? K.acento : K.suave });
  });
  const dev = c.a_devolver_usd;
  const cuerpo = P.titular(parcial ? 'Cambio en tu reserva' : 'Reserva cancelada',
      parcial ? 'Cancelamos parte de tu reserva' + hola(p) : 'Tu reserva fue cancelada' + hola(p),
      esc(x.reembolso || (dev > 0 ? 'Te devolvemos lo que corresponde en las próximas 24 hs.' : 'No hay pagos para devolver.'))) +
    (dev > 0 ? bloque(P.destacado('Te devolvemos', M.m(dev), 'Lo procesamos en las próximas 24 hs por el mismo medio de pago', P.chip('Reembolso en proceso', false))) : '') +
    bloque(P.tabla(parcial ? 'Lo que se canceló' : 'Servicios cancelados', filas)) +
    (parcial ? bloque(serviciosTabla(M, p, 'Así queda tu reserva')) : '') +
    bloque(P.datos([['Destino', p.destino], ['Fechas', P.fechasDe(p)], ['Referencia', p.ref], ['Fecha', P.hoy()]])) +
    bloque(P.boton('Consultar por WhatsApp', P.linkWa(p.ref)), '4px 28px 14px') +
    nota(M, 'Este mail es la constancia de la cancelación.');
  return { asunto: asunto(parcial ? 'Cambio en tu reserva' : 'Reserva cancelada', p), html: P.marco((parcial ? 'Se canceló parte de tu reserva ' : 'Tu reserva fue cancelada · ') + p.ref, cuerpo) };
}

function reembolso(p, brl) {
  const M = moneda(brl), c = pedidos.cuentas(p);
  const devs = (p.pagos || []).filter(function (x) { return x.reembolso && x.monto_usd > 0; }), ult = devs[devs.length - 1];
  if (!ult) { const e = new Error('El pedido no tiene reembolsos registrados.'); e.status = 400; throw e; }
  const movs = (p.pagos || []).filter(function (x) { return x.monto_usd > 0; });
  const cuerpo = P.titular('Comprobante de reembolso', 'Te devolvimos ' + esc(M.m(ult.monto_usd)) + hola(p),
      'Ya hicimos el reembolso. Según el medio de pago, puede tardar unos días en verse en tu cuenta.') +
    bloque(P.destacado('Reembolso', M.m(ult.monto_usd), [P.fechaCorta(ult.fecha), ult.medio].filter(Boolean).join(' · '), P.chip('✓ Reembolso hecho', true))) +
    bloque(P.tabla('Movimientos de tu reserva', movs.map(function (x) {
      return fila(esc(x.reembolso ? 'Reembolso' : (x.nota || 'Pago')) + '<br><span style="font-size:13px;color:' + K.suave + '">' + esc([P.fechaCorta(x.fecha), x.medio].filter(Boolean).join(' · ')) + '</span>', (x.reembolso ? '−' : '') + M.m(x.monto_usd), { color: x.reembolso ? K.verde : K.texto });
    }).concat([fila('Total que quedó pago', M.m(c.cobrado_usd), { fuerte: true })]))) +
    bloque(P.datos([['Titular', P.capital(p.cliente_nombre)], ['Destino', p.destino], ['Referencia', p.ref], ['Emitido', P.hoy()]])) +
    bloque(P.boton('Consultar por WhatsApp', P.linkWa(p.ref)), '4px 28px 14px') +
    nota(M, 'Comprobante de reembolso de CuántoSale, no válido como factura.');
  return { asunto: asunto('Comprobante de reembolso', p), html: P.marco('Te devolvimos ' + M.m(ult.monto_usd) + ' de tu reserva ' + p.ref + '.', cuerpo) };
}

/* tours: el catalogo (lib/tours.js) para sumar punto de salida, duracion y que llevar de cada tour. */
function previaje(p, brl, tours) {
  const M = moneda(brl), c = pedidos.cuentas(p), dias = diasHasta(p.fecha_ida);
  const tourDe = require('./politicas').tourDe;
  const fichas = P.itemsVivos(p).map(function (i) {
    const t = i.tipo === 'tour' ? tourDe(i, tours || [], p.destino) : null;
    const linea = function (et, v) { return v ? '<br><span style="font-size:13px;color:' + K.suave + '"><b style="color:' + K.texto + '">' + et + ':</b> ' + esc(v) + '</span>' : ''; };
    return fila(P.servicio(i, true) + (t ? linea('Duración', t.duracion) + linea('Salida', t.salida) + linea('Qué llevar', (t.llevar || []).join(' · ')) : '') +
      (i.tipo === 'traslado' ? linea('Importante', 'Tené a mano el número de vuelo y la dirección del alojamiento') : ''), '');
  });
  const debe = c.saldo_cliente_usd > 0.005;
  const cuerpo = P.titular('Tu viaje', (dias === 1 ? '¡Mañana viajás' : '¡Ya casi viajás') + hola(p) + '! 🌴',
      'Te dejamos todo lo de tu reserva en un solo lugar. El día de cada servicio te escribimos por WhatsApp si hay algún cambio.') +
    bloque(P.datos([['Destino', p.destino], ['Fechas', P.fechasDe(p)], ['Personas', P.personasDe(p)], ['Referencia', p.ref]])) +
    bloque(P.tabla('Tus servicios', fichas)) +
    (debe ? bloque(P.destacado('Falta abonar', M.m(c.saldo_cliente_usd), 'Pagalo antes de viajar para que el operador te espere', P.chip('Saldo pendiente', false))) : '') +
    bloque(parrafo('Mostrá este mail o el voucher desde el celular si te lo piden. Ante cualquier imprevisto en el viaje, escribinos por WhatsApp y lo resolvemos.')) +
    bloque(P.boton('WhatsApp de CuántoSale', P.linkWa(p.ref)), '4px 28px 22px') +
    (debe ? nota(M) : '');
  return { asunto: asunto(dias === 1 ? 'Mañana viajás: lo que tenés que saber' : 'Tu viaje: lo que tenés que saber', p), html: P.marco('Todo lo de tu reserva ' + p.ref + ' en un lugar.', cuerpo) };
}

function postviaje(p) {
  const resena = String(process.env.RESENA_URL || '').trim();
  const cuerpo = P.titular('¿Cómo te fue?', '¡Bienvenido de vuelta' + hola(p) + '!',
      '¿Qué tal ' + esc(p.destino || 'el viaje') + '? Nos encantaría saber cómo te fue con los tours y traslados. Tu opinión nos ayuda a elegir mejor a los operadores.') +
    bloque(resena
      ? '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="' + K.mostaza + '" style="border-radius:12px;background:' + K.mostaza + '"><a href="' + esc(resena) + '" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:800;color:#0A101A;text-decoration:none">⭐&nbsp; Dejar una reseña</a></td></tr></table>'
      : P.boton('Contanos cómo te fue', wa('Hola! Volví de mi viaje (' + p.ref + '). Te cuento cómo me fue: ')), '4px 28px 18px') +
    bloque(parrafo('¿Ya estás pensando en el próximo? En <a href="https://cuantosale.uy" style="color:' + K.acento + ';font-weight:700">cuantosale.uy</a> sabés cuánto sale antes de decidir.'), '0 28px 24px');
  return { asunto: '¿Cómo te fue en ' + (p.destino || 'tu viaje') + '?', html: P.marco('¿Cómo te fue en ' + (p.destino || 'tu viaje') + '? Contanos.', cuerpo) };
}

/* Desde la web: el cliente cambio algo que ya habia pedido. refAnterior: la referencia del pedido que reemplaza. */
function cambio(p, refAnterior, brl) {
  const M = moneda(brl);
  const cuerpo = P.titular('Cambio de tu pedido', 'Recibimos el cambio de tu pedido' + hola(p),
      'Confirmamos la disponibilidad de lo nuevo con cada proveedor y te escribimos por WhatsApp. <b style="color:' + K.texto + '">Hasta entonces no tenés que pagar nada.</b>' + (refAnterior ? ' Este pedido reemplaza al ' + esc(refAnterior) + '.' : '')) +
    bloque(P.pasos(1)) +
    bloque(P.datos([['Destino', p.destino], ['Fechas', P.fechasDe(p)], ['Personas', P.personasDe(p)], ['Referencia', p.ref]])) +
    bloque(serviciosTabla(M, p, 'Lo que pediste ahora')) +
    bloque(P.boton('Consultar por WhatsApp', P.linkWa(p.ref)), '4px 28px 14px') +
    nota(M, 'El monto final se confirma al pedirte la seña.');
  return { asunto: asunto('Recibimos el cambio de tu pedido', p), html: P.marco('Recibimos el cambio de tu pedido ' + p.ref + '.', cuerpo) };
}

/* ---------- envio ---------- */
async function armar(p, tipo, brl, extra) {
  if (tipo === 'sena') return sena(p, brl);
  if (tipo === 'saldo') return saldo(p, brl, false);
  if (tipo === 'saldo_recordatorio') return saldo(p, brl, true);
  if (tipo === 'cancelado') return cancelacion(p, brl, extra, false);
  if (tipo === 'servicio_cancelado') return cancelacion(p, brl, extra, true);
  if (tipo === 'reembolso') return reembolso(p, brl);
  if (tipo === 'previaje') return previaje(p, brl, await require('./tours').todos().catch(function () { return []; }));
  if (tipo === 'postviaje') return postviaje(p);
  const e = new Error('Tipo de mail desconocido.'); e.status = 400; throw e;
}
/* Desde el panel. Tira con status para que el panel muestre el motivo. */
async function enviarAviso(p, tipo, brl, extra) {
  if (DESDE_PANEL.indexOf(tipo) < 0) { const e = new Error('Tipo de mail desconocido.'); e.status = 400; throw e; }
  return P.enviar(p.cliente_email, await armar(p, tipo, brl, extra), tipo);
}
/* Desde la web, en vez del "gracias". Nunca tira: el pedido ya quedo guardado. */
async function enviarCambio(p, refAnterior, brl) {
  try { await P.enviar(p.cliente_email, cambio(p, refAnterior, brl), 'cambio'); return true; }
  catch (e) { console.warn('[mail-avisos] cambio no salio:', e.message); return false; }
}

/* ---------- los automaticos (cron diario) ---------- */
function yaSalio(p, tipo) { return (p.historial || []).some(function (e) { return e && e.tipo === 'mail' && e.wa === tipo; }); }
/* Que mail automatico le toca hoy a un pedido (o null). */
function automaticoDe(p, ahora) {
  if (!p || !p.cliente_email || p.estado === 'cancelado' || !Array.isArray(p.historial) || !P.itemsVivos(p).length) return null;
  const c = pedidos.cuentas(p), ida = diasHasta(p.fecha_ida, ahora), vuelta = diasHasta(p.fecha_vuelta, ahora);
  const activo = p.estado === 'confirmado' || p.estado === 'completado';
  if (activo && c.cobrado_usd > 0 && vuelta != null && vuelta <= -2 && vuelta >= -10 && !yaSalio(p, 'postviaje')) return 'postviaje';
  if (activo && ida != null && ida >= 1 && ida <= 3 && !yaSalio(p, 'previaje')) return 'previaje';
  if (p.estado === 'confirmado' && c.cobrado_usd > 0 && c.saldo_cliente_usd > 0.005 && ida != null && ida >= 1 && ida <= 10 && !yaSalio(p, 'saldo_recordatorio')) return 'saldo_recordatorio';
  return null;
}
/* o = { tasas: () => Promise<{ rates: { BRL } }> }. Devuelve que salio. */
async function revisar(o) {
  o = o || {};
  const t = o.tasas ? await o.tasas().catch(function () { return null; }) : null, brl = t && t.rates && t.rates.BRL;
  const lista = await pedidos.listarPedidos();
  const out = { revisados: lista.length, enviados: [], errores: 0, sin_historial: !lista.some(function (p) { return Array.isArray(p.historial); }) };
  const tope = Math.max(1, Number(process.env.MAILS_AUTO_MAX) || 30), hasta = Date.now() + 40000;
  for (let i = 0; i < lista.length && out.enviados.length < tope && Date.now() < hasta; i++) {
    const p = lista[i], tipo = automaticoDe(p);
    if (!tipo) continue;
    try {
      const r = await P.enviar(p.cliente_email, await armar(p, tipo, brl), tipo);
      const h = await pedidos.anotar(p.id, 'mail', TITULOS[tipo] + ' a ' + r.email, 'auto', tipo).catch(function () { return null; });
      out.enviados.push({ ref: p.ref, tipo: tipo });
      if (!h) break;   // sin historial no se puede saber que ya salio: mejor no seguir que repetirlo manana
    } catch (e) { out.errores++; console.warn('[mail-avisos] ' + tipo + ' ' + p.ref + ':', e.message); }
  }
  return out;
}

module.exports = { enviarAviso: enviarAviso, enviarCambio: enviarCambio, revisar: revisar, automaticoDe: automaticoDe, TITULOS: TITULOS,
  _armar: armar, _cambio: cambio };
