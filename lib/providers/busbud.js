'use strict';
/*
 * Buses y ferry.
 *
 * Precio: PENDIENTE. Busbud da acceso a su inventario a socios (hay que pedirles un convenio) y
 * documenta su API al darte acceso. Hasta entonces el modelo usa una ESTIMACIÓN (pp = null).
 * Cuando tengas acceso: consultá origen/destino/fechas y devolvé pp (US$ por persona, ida y vuelta).
 *
 * Enlace de reserva (bookingUrl): sí funciona ya. Se arma con plantillas configurables:
 *   BUS_URL_TEMPLATE / BUS_AFFILIATE_ID       (ómnibus)  por defecto Rome2Rio, sin comisión
 *   FERRY_URL_TEMPLATE / FERRY_AFFILIATE_ID   (ferry)    por defecto el sitio de Buquebus, sin comisión
 * Cuando tengas tu enlace de afiliado de Busbud u otro, pegalo en la plantilla.
 */
const { buildUrl } = require('./booking');

const DEFAULT_BUS_TEMPLATE = 'https://www.rome2rio.com/map/{origin_name}/{dest_name}';
const DEFAULT_FERRY_TEMPLATE = 'https://www.buquebus.com/';

function groundBookingUrl(modeId, p, env) {
  env = env || process.env;
  const vars = { origin_name: 'Montevideo', dest_name: p.destName, dep: p.dep, ret: p.ret, pax: p.pax };
  if (modeId === 'ferry') return buildUrl(env.FERRY_URL_TEMPLATE || DEFAULT_FERRY_TEMPLATE, vars, env.FERRY_AFFILIATE_ID);
  return buildUrl(env.BUS_URL_TEMPLATE || DEFAULT_BUS_TEMPLATE, vars, env.BUS_AFFILIATE_ID);
}

/** @param p { mode: 'bus'|'ferry', destName, dep, ret, pax } */
async function getBusQuote(p) {
  return { pp: null, source: 'estimado', bookingUrl: groundBookingUrl(p.mode, p) };
}

module.exports = { getBusQuote, groundBookingUrl, DEFAULT_BUS_TEMPLATE, DEFAULT_FERRY_TEMPLATE };
