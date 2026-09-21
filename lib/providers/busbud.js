'use strict';
/*
 * Buses (pendiente).
 *
 * Busbud da acceso a su inventario a socios (hay que pedirles un convenio) y
 * su API la documentan ellos al darte acceso. Hasta entonces esta función
 * devuelve null y el modelo usa una ESTIMACIÓN para buses y ferry.
 *
 * Cuando tengas acceso: consultá origen/destino/fecha, devolvé
 * { pp: <US$ por persona ida y vuelta>, dur: '...' } y usalo en lib/providers/index.js
 * de la misma forma que se usan los vuelos.
 */
async function getBusQuote(/* { origin, destination, dep, ret } */) {
  return null;
}
module.exports = { getBusQuote };
