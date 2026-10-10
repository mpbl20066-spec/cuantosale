'use strict';
/*
 * Configuracion de vuelos. El proveedor es Ignav (SerpAPI esta deshabilitado, ver vuelos.js).
 * Las variables se llaman IGNAV_<NOMBRE> (IGNAV_DAILY_MAX, IGNAV_CALENDAR_LIVE, IGNAV_CALENDAR_TTL_H, ...).
 * Los nombres viejos SERPAPI_<NOMBRE> siguen valiendo como respaldo, para no romper un despliegue que todavia
 * los tiene: si estan las dos, gana la de IGNAV_.
 */
function envVuelos(nombre) {
  const nuevo = process.env['IGNAV_' + nombre];
  return nuevo !== undefined && nuevo !== '' ? nuevo : process.env['SERPAPI_' + nombre];
}
module.exports = { envVuelos };
