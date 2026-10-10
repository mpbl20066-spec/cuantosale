'use strict';
/*
 * De donde salen las tarifas de vuelo: solo Ignav (IGNAV_API_KEY). SerpAPI quedo
 * deshabilitado: ni como proveedor ni como respaldo cuando Ignav falla. Si Ignav
 * no esta configurado, isConfigured() da false y la app muestra los vuelos como
 * no disponibles en vez de consultar a otro proveedor. serpapi.js sigue en el repo
 * pero ya no se carga desde aca.
 * Expone la misma interfaz que ignav.js para que el agregador (index.js) no cambie.
 */
const ignav = require('./ignav');

function usaIgnav() { return ignav.isConfigured(); }
function nombre() { return 'ignav'; }
function isConfigured() { return ignav.isConfigured(); }

/* Ignav no cotiza fechas demasiado lejanas: el viaje de ida y vuelta falla con
   HTTP 424 ("outside the available search range") cuando la vuelta pasa de ~360
   dias desde hoy, y tarda ~12 s en fallar. Se verifico: vuelta a 352 dias anda,
   a 364 no. Mejor no pedirlo (ni gastar cupo ni esperar): IGNAV_MAX_DAYS (355
   por defecto) marca el limite. Solo aplica con Ignav activo. */
function fueraDeRango(dep, ret) {
  if (!usaIgnav()) return false;
  const limite = Number(process.env.IGNAV_MAX_DAYS) || 355;
  const ultimo = Date.parse(String(ret || dep) + 'T00:00:00Z');
  if (!Number.isFinite(ultimo)) return false;
  return (ultimo - Date.now()) / 864e5 > limite;
}

async function conRespaldo(metodo, args) { return ignav[metodo](args); }

module.exports = {
  nombre: nombre,
  isConfigured: isConfigured,
  fueraDeRango: fueraDeRango,
  setFetch: function (fn) { ignav.setFetch(fn); },
  travelClassFor: function (style) { return ignav.travelClassFor(style); },
  googleFlightsUrl: function (input) { return ignav.googleFlightsUrl(input); },
  getFlightQuote: function (input) { return conRespaldo('getFlightQuote', input); },
  priceForDate: function (input) { return conRespaldo('priceForDate', input); },
  searchOutbound: function (input) { return conRespaldo('searchOutbound', input); }
};
