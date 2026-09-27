'use strict';
/*
 * Renderiza la tarjeta de vuelo obvio en un HTML suelto, con datos de ejemplo,
 * para poder mirarla sin levantar la app ni gastar un crédito.
 *
 *   node prueba-tarjeta-vuelo.js
 *
 * Sale un archivo en public/_preview-tarjeta.html. Abrilo con doble clic.
 * Sirve para revisar copy y jerarquía visual antes de subirlo.
 */
const fs = require('fs');
const path = require('path');

// Mismas funciones que usa public/app.js, copiadas acá para no cargar la app
// entera (que necesita DOM y Supabase).
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}
function money(value) { return 'US$ ' + Number(value).toLocaleString('es-UY', { maximumFractionDigits: 0 }); }
function flightTime(value) {
  if (!value) return 'Horario no disponible';
  return new Date(value).toLocaleString('es-UY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function airportCode(a) { return a && a.code ? a.code : '—'; }
function routeOf(leg, offer) {
  var from = leg && leg.origin ? airportCode(leg.origin) : airportCode(offer && offer.departure_airport);
  var to = leg && leg.destination ? airportCode(leg.destination) : airportCode(offer && offer.arrival_airport);
  return (from || '—') + ' → ' + (to || '—');
}

function flightSummaryCard(offer, pax) {
  var iconInfo = '<svg class="fi" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 9v5M10 6.3v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var iconSwap = '<svg class="fi" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M16 7a6.5 6.5 0 0 0-11.4-2M4 13a6.5 6.5 0 0 0 11.4 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4.2 2.4v3.2h3.2M15.8 17.6v-3.2h-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var total = offer.price_usd === null ? null : Number(offer.price_usd);
  var priceText;
  var priceSub = '';
  if (total === null) {
    priceText = esc(offer.original_price + ' ' + (offer.original_currency || ''));
  } else if (pax > 1) {
    priceText = money(Math.round(total / pax));
    priceSub = '<span class="flight-summary-pax">por pasajero</span>' +
      '<span class="flight-summary-total-group">' + money(total) + ' total · ' + pax + ' viajeros</span>';
  } else {
    priceText = money(total);
    priceSub = '<span class="flight-summary-pax">1 viajero · precio total</span>';
  }

  var logo = offer.logo ? '<img src="' + esc(offer.logo) + '" alt="" class="flight-logo">' : '<span class="flight-logo-fallback" aria-hidden="true">✈️</span>';
  var cabin = offer.cabin_label || 'Economy';
  var backFrom = airportCode(offer.arrival_airport);
  var backTo = airportCode(offer.departure_airport);
  var backRoute = (backFrom && backFrom !== '—' ? backFrom : 'destino') + ' → ' + (backTo && backTo !== '—' ? backTo : 'origen');

  return '<div class="flight-summary-card">' +
    '<div class="flight-summary-head">' + logo + '<b>' + esc(offer.airline) + '</b>' + (cabin ? '<span class="flight-badge cabin-badge">' + esc(cabin) + '</span>' : '') + '</div>' +
    '<div class="flight-summary-line">' +
      '<span class="flight-summary-tag">Ida</span>' +
      '<span class="flight-summary-path">' + esc(routeOf(offer.outbound, offer)) + '</span>' +
      '<span class="flight-summary-when">Sale ' + esc(flightTime(offer.departure)) + ' · Llega ' + esc(flightTime(offer.arrival)) + '</span>' +
    '</div>' +
    '<div class="flight-summary-line is-muted">' +
      '<span class="flight-summary-tag">Vuelta</span>' +
      '<span class="flight-summary-path">' + esc(backRoute) + '</span>' +
      '<span class="flight-summary-when">Horarios sujetos a confirmación en el sitio oficial</span>' +
    '</div>' +
    '<div class="flight-summary-total"><span class="flight-summary-total-label">Tarifa final · Ida y vuelta</span>' +
      '<b class="flight-summary-total-value">' + priceText + '</b>' + priceSub + '</div>' +
    '<a class="btn btn-primary flight-summary-book" href="#" onclick="return false">Reservar en Google Flights</a>' +
    '<button type="button" class="flight-summary-change">' + iconSwap + 'Elegir otro vuelo</button>' +
    '<p class="flight-summary-foot">' + iconInfo + '<span>Tarifa final de ida y vuelta con ' + esc(offer.airline) + '. Al hacer clic, completás la reserva de forma segura en Google Flights.</span></p>' +
    '</div>';
}

var oferta = {
  airline: 'JetSMART', logo: null, cabin_label: 'Economy',
  price_usd: 310, original_price: '310', original_currency: 'USD',
  departure_airport: { code: 'MVD', name: 'Carrasco' },
  arrival_airport: { code: 'GIG', name: 'Galeão' },
  departure: '2027-09-30T14:20', arrival: '2027-09-30T17:05',
  outbound: { origin: { code: 'MVD' }, destination: { code: 'GIG' } },
  book_url: '#'
};

var html = '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Preview tarjeta de vuelo</title>' +
  '<link rel="stylesheet" href="/style.css?v=73">' +
  '<style>body{background:#f4f7fb;padding:18px;font-family:Poppins,sans-serif}' +
  '.wrap{max-width:520px;margin:0 auto}' +
  'h1{font:700 15px Poppins,sans-serif;color:#10233e;margin:0 0 4px}' +
  'p.aviso{font:400 12px Poppins,sans-serif;color:#5a6b85;margin:0 0 16px}' +
  '.caso{margin-bottom:22px}.caso h2{font:700 12px Poppins,sans-serif;letter-spacing:.08em;' +
  'text-transform:uppercase;color:#5a6b85;margin:0 0 8px}' +
  '.btn-primary{background:#f5a623;border:0;border-radius:12px;color:#10233e;font-weight:700}' +
  '.flight-badge{font:700 10px Poppins,sans-serif;text-transform:uppercase;letter-spacing:.06em;' +
  'background:#e8eef7;color:#10233e;padding:4px 8px;border-radius:99px}</style>' +
  '</head><body><div class="wrap">' +
  '<h1>Tarjeta de vuelo — preview</h1>' +
  '<p class="aviso">Datos de ejemplo. El copy y la jerarquía son los reales de public/app.js.</p>' +

  '<div class="caso"><h2>2 viajeros (lo que pediste: total + desglose)</h2>' + flightSummaryCard(oferta, 2) + '</div>' +

  '<div class="caso"><h2>1 viajero (sin desglose, no hay division que mostrar)</h2>' + flightSummaryCard(oferta, 1) + '</div>' +

  '<div class="caso"><h2>3 viajeros, precio impar</h2>' + flightSummaryCard(Object.assign({}, oferta, { price_usd: 1187 }), 3) + '</div>' +

  '<div class="caso"><h2>Sin precio en la respuesta</h2>' +
  flightSummaryCard(Object.assign({}, oferta, { price_usd: null, original_price: '890' }), 2) + '</div>' +

  '</div></body></html>';

var destino = path.join(__dirname, 'public', '_preview-tarjeta.html');
fs.writeFileSync(destino, html, 'utf8');
console.log('escrito: public/_preview-tarjeta.html');
console.log('abrilo con doble clic. El CSS sale del style.css real, asi que si se ve feo es que esta feo de verdad.');
