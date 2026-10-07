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

/* SerpAPI como respaldo: solo si tiene key y no se sabe agotado. Si SerpAPI
   tambien falla, el error que sube es el de IGNAV, que es el proveedor real. Un
   "se acabaron las busquedas" de SerpAPI NO debe subir como 429: el agregador lo
   toma como cuota agotada y frena TODAS las busquedas un minuto, aunque Ignav
   siga andando. Si SerpAPI responde por cuota, no se le vuelve a pedir por 1 h. */
let serpapiAgotadoHasta = 0;
async function conRespaldo(metodo, args) {
  if (!usaIgnav()) return serpapi[metodo](args);
  try {
    return await ignav[metodo](args);
  } catch (e) {
    if (serpapi.isConfigured() && process.env.IGNAV_NO_FALLBACK !== '1' && Date.now() >= serpapiAgotadoHasta) {
      console.warn('[ignav->serpapi]', metodo, e.message);
      try {
        return await serpapi[metodo](args);
      } catch (e2) {
        if (e2 && (e2.quotaExhausted || e2.status === 429)) serpapiAgotadoHasta = Date.now() + 3600e3;
      }
    }
    throw e;
  }
}

module.exports = {
  nombre: nombre,
  isConfigured: isConfigured,
  fueraDeRango: fueraDeRango,
  setFetch: function (fn) { serpapi.setFetch(fn); ignav.setFetch(fn); },
  travelClassFor: function (style) { return activo().travelClassFor(style); },
  googleFlightsUrl: function (input) { return activo().googleFlightsUrl(input); },
  getFlightQuote: function (input) { return conRespaldo('getFlightQuote', input); },
  priceForDate: function (input) { return conRespaldo('priceForDate', input); },
  searchOutbound: function (input) { return conRespaldo('searchOutbound', input); }
};
