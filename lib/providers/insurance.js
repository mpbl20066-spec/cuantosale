'use strict';
/*
 * Seguro de viaje.
 *
 * Precio: ESTIMADO por el modelo (persona x día, según destino).
 * Enlace (bookingUrl): configurable con INSURANCE_URL_TEMPLATE / INSURANCE_AFFILIATE_ID.
 * El valor por defecto es solo un ejemplo (sitio de Assist Card, sin comisión): reemplazalo por el
 * enlace de tu socio o aseguradora.
 */
const { buildUrl } = require('./booking');

const DEFAULT_INSURANCE_TEMPLATE = 'https://www.assistcard.com/';

/** @param p { destName, dep, ret, pax } */
async function getInsuranceQuote(p, env) {
  env = env || process.env;
  return {
    total: null, source: 'estimado',
    bookingUrl: buildUrl(env.INSURANCE_URL_TEMPLATE || DEFAULT_INSURANCE_TEMPLATE,
      { dest_name: p.destName, dep: p.dep, ret: p.ret, pax: p.pax }, env.INSURANCE_AFFILIATE_ID)
  };
}

module.exports = { getInsuranceQuote, DEFAULT_INSURANCE_TEMPLATE };
