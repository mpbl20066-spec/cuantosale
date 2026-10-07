'use strict';
/*
 * Elige de donde salen las tarifas de vuelo, sin que el agregador (index.js) se
 * entere: expone la misma interfaz que serpapi.js e ignav.js.
 *
 *   FLIGHTS_PROVIDER=ignav   usa Ignav (si hay IGNAV_API_KEY); cualquier otro
 *                            valor o vacio, SerpAPI (el comportamiento de siempre)
 *
 * Con Ignav activo y SerpAPI configurado, un error de Ignav (cuota, red, sin
 * cotizacion para convertir moneda) cae a SerpAPI en vez de dejar la app sin
 * vuelos. IGNAV_NO_FALLBACK=1 lo desactiva (util para medir Ignav solo).
 */
const serpapi = require('./serpapi');
const ignav = require('./ignav');

function usaIgnav() {
  return String(process.env.FLIGHTS_PROVIDER || '').trim().toLowerCase() === 'ignav' && ignav.isConfigured();
}
function activo() { return usaIgnav() ? ignav : serpapi; }
function nombre() { return usaIgnav() ? 'ignav' : 'serpapi'; }
function isConfigured() { return activo().isConfigured(); }

async function conRespaldo(metodo, args) {
  if (!usaIgnav()) return serpapi[metodo](args);
  try {
    return await ignav[metodo](args);
  } catch (e) {
    if (serpapi.isConfigured() && process.env.IGNAV_NO_FALLBACK !== '1') {
      console.warn('[ignav->serpapi]', metodo, e.message);
      return serpapi[metodo](args);
    }
    throw e;
  }
}

module.exports = {
  nombre: nombre,
  isConfigured: isConfigured,
  setFetch: function (fn) { serpapi.setFetch(fn); ignav.setFetch(fn); },
  travelClassFor: function (style) { return activo().travelClassFor(style); },
  googleFlightsUrl: function (input) { return activo().googleFlightsUrl(input); },
  getFlightQuote: function (input) { return conRespaldo('getFlightQuote', input); },
  priceForDate: function (input) { return conRespaldo('priceForDate', input); },
  searchOutbound: function (input) { return conRespaldo('searchOutbound', input); }
};
