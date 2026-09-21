'use strict';
/*
 * Alojamiento (pendiente).
 *
 * Por ahora el alojamiento, las comidas y los traslados son ESTIMACIONES del modelo
 * (lib/model.js). Para precios reales de hoteles hay que conectar un programa de
 * afiliados o una API de alojamiento (Booking.com, Expedia, Hotelbeds, etc.),
 * que piden alta y aprobación. Devolvé { perNight: <US$ por habitación> } por categoría.
 */
async function getHotelQuote(/* { destination, checkIn, checkOut, tier } */) {
  return null;
}
module.exports = { getHotelQuote };
