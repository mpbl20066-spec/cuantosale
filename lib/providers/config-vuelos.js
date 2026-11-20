'use strict';
/*
 * Configuracion de vuelos. El proveedor es Duffel. Las variables se llaman DUFFEL_<NOMBRE> (DUFFEL_DAILY_MAX,
 * DUFFEL_CALENDAR_LIVE, DUFFEL_CALENDAR_TTL_H, ...). Los nombres viejos IGNAV_<NOMBRE> y SERPAPI_<NOMBRE> siguen
 * valiendo como respaldo, para no romper un despliegue que todavia los tiene: gana DUFFEL_, despues IGNAV_, despues SERPAPI_.
 */
function envVuelos(nombre) {
  const orden = ['DUFFEL_', 'IGNAV_', 'SERPAPI_'];
  for (let i = 0; i < orden.length; i++) {
    const v = process.env[orden[i] + nombre];
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}
module.exports = { envVuelos };
