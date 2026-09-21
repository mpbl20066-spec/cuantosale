'use strict';
/*
 * Armado de enlaces de reserva (bookingUrl) a partir de plantillas.
 *
 * Una plantilla es una URL con marcadores entre llaves. Marcadores disponibles:
 *   {origin} {destination}     códigos IATA (vuelos)
 *   {origin_name} {dest_name}  nombres de ciudad
 *   {dep} {ret}                fechas de ida y vuelta (AAAA-MM-DD)
 *   {pax} {rooms}              viajeros y habitaciones
 *   {affiliate}                tu ID de afiliado (variable *_AFFILIATE_ID del .env)
 *
 * Todos los valores se codifican para URL. Si el ID de afiliado no está configurado, el parámetro
 * queda vacío y se elimina, así el enlace sigue funcionando (pero sin comisión).
 * Solo se aceptan enlaces http o https.
 */
function buildUrl(template, vars, affiliateId) {
  if (!template) return null;
  const all = Object.assign({}, vars, { affiliate: affiliateId || '' });
  const filled = String(template).replace(/\{(\w+)\}/g, function (m, k) {
    return encodeURIComponent(all[k] == null ? '' : String(all[k]));
  });
  let u;
  try { u = new URL(filled); } catch (e) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const empty = [];
  u.searchParams.forEach(function (v, k) { if (v === '') empty.push(k); });
  if (empty.length) empty.forEach(function (k) { u.searchParams.delete(k); });
  return u.toString();
}

module.exports = { buildUrl };
