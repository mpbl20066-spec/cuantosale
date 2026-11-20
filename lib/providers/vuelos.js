'use strict';
/*
 * De donde salen las tarifas de vuelo: solo Duffel (DUFFEL_TOKEN). Ignav y SerpAPI ya no se usan. Si Duffel no esta
 * configurado, isConfigured() da false y la app muestra los vuelos como no disponibles en vez de consultar a otro
 * proveedor. Los detalles estan en duffel-vuelos.js; el agregador (index.js) consume esta interfaz.
 */
const duffelVuelos = require('./duffel-vuelos');
const duffel = require('./duffel');

function nombre() { return 'duffel'; }
function isConfigured() { return duffelVuelos.isConfigured(); }

/* Las aerolineas venden con unos 330-360 dias de anticipacion. Mas lejos no hay tarifas: mejor no pedirlo (ni gastar
   cupo ni esperar). DUFFEL_MAX_DAYS (330 por defecto) marca el limite. */
function fueraDeRango(dep, ret) {
  if (!isConfigured()) return false;
  const limite = Number(process.env.DUFFEL_MAX_DAYS) || 330;
  const ultimo = Date.parse(String(ret || dep) + 'T00:00:00Z');
  if (!Number.isFinite(ultimo)) return false;
  return (ultimo - Date.now()) / 864e5 > limite;
}

module.exports = {
  nombre: nombre,
  isConfigured: isConfigured,
  fueraDeRango: fueraDeRango,
  setFetch: function (fn) { duffel.setFetch(fn); },
  travelClassFor: duffelVuelos.travelClassFor,
  googleFlightsUrl: duffelVuelos.googleFlightsUrl,
  getFlightQuote: duffelVuelos.getFlightQuote,
  priceForDate: duffelVuelos.priceForDate,
  searchOutbound: duffelVuelos.searchOutbound
};
