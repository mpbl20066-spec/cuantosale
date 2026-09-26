'use strict';
/*
 * Servidor de CuÃ¡ntoSale. Node 18 o superior.
 *
 *   node server.js            -> http://localhost:3000
 *
 * Variables (en el entorno o en un archivo .env):
 *   DUFFEL_API_KEY (o DUFFEL_ACCESS_TOKEN) para bÃºsquedas reales de vuelos.
 *   PORT                  puerto (por defecto 3000)
 *   BOOKING_API_KEY y BOOKING_API_HOST para la API de alojamientos.
 *   RATE_LIMIT_PER_MIN    pedidos por minuto por IP a /api/cotizar (por defecto 30)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

function loadEnv() {
  try {
    fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (line) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  } catch (e) { /* no hay .env: estÃ¡ bien */ }
}
loadEnv();

const model = require('./lib/model');
const duffel = require('./lib/providers/duffel');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};
// Checkout de vuelos con Duffel. Las fuentes son las que exige el FAQ de
// @duffel/components para este trío:
//   - script-src  assets.duffel.com  -> el custom element por CDN
//                 js.evervault.com   -> SDK del desafío 3DS
//   - frame-src   api.duffel.cards   -> iframe PCI del formulario de tarjeta
//                 ui-components.evervault.com -> UI del 3DS
//   - connect-src api.duffel.com    -> la API que el browser consulta
//                 keys.evervault.com / api.evervault.com
//   - img-src     assets.duffel.com  -> spinner del form
//   - style-src-attr 'unsafe-inline' -> estilos inline del componente React
// El CSP es la única barrera que impide que un script de terceros inyectado en
// la página de pago lea la tarjeta: no se le pueden agregar dominios aca.
const CSP = "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://assets.duffel.com https://js.evervault.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "style-src-attr 'unsafe-inline'; " +
  "font-src https://fonts.gstatic.com; " +
  "img-src 'self' data: https: https://assets.duffel.com; " +
  "connect-src 'self' https://*.supabase.co https://*.wikimedia.org https://api.duffel.com https://api.duffel.cards https://keys.evervault.com https://api.evervault.com; " +
  "frame-src https://*.supabase.co https://api.duffel.cards https://ui-components.evervault.com; " +
  "base-uri 'none'; form-action 'self'";
const AIR_DESTINATIONS = { bue: 'EZE', buz: 'GIG', arraial: 'GIG', cabo: 'GIG', ilha: 'GIG', paraty: 'GIG', ilhabela: 'GRU', ubatuba: 'GRU', rio: 'GIG', angra: 'GIG', sao: 'GRU', bho: 'CNF', curitiba: 'CWB', porto: 'REC', mcz: 'MCZ', maragogi: 'MCZ', nat: 'NAT', pip: 'NAT', trancoso: 'SSA', ssa: 'SSA', for: 'FOR', jericoacoara: 'FOR', morro: 'SSA', fernando: 'NVT', fln: 'FLN', camboriu: 'FLN', bombinhas: 'FLN', rosa: 'FLN', bcm: 'FLN', gram: 'POA', canela: 'POA', igu: 'IGU', rec: 'REC', poa: 'POA' };
const HOME_DESTINATION_KEYS = ['rio', 'buz', 'arraial', 'cabo', 'ilha', 'porto', 'mcz', 'ssa', 'fln', 'ilhabela', 'ubatuba', 'paraty'];
const SEARCH_DESTINATION_KEYS = HOME_DESTINATION_KEYS.concat(['bue', 'gram', 'igu']);
// Algunas islas y pueblos pequeÃ±os no estÃ¡n indexados como ciudad en Booking.
// En esos casos buscamos alojamientos en el municipio de acceso mÃ¡s cercano.
const HOTEL_NEARBY_DESTINATIONS = {
  buz: { key: 'cabo', name: 'Cabo Frio', label: 'Cabo Frio, cerca de BÃºzios' },
  arraial: { key: 'cabo', name: 'Cabo Frio', label: 'Cabo Frio, cerca de Arraial do Cabo' },
  cabo: { key: 'arraial', name: 'Arraial do Cabo', label: 'Arraial do Cabo, cerca de Cabo Frio' },
  ilha: { key: 'angra', name: 'Angra dos Reis', label: 'Angra dos Reis, cerca de Ilha Grande' },
  paraty: { key: 'angra', name: 'Angra dos Reis', label: 'Angra dos Reis y alrededores' },
  ilhabela: { key: 'ilhabela', name: 'SÃ£o SebastiÃ£o', label: 'SÃ£o SebastiÃ£o, junto a Ilhabela' },
  ubatuba: { key: 'ubatuba', name: 'Caraguatatuba', label: 'Caraguatatuba, cerca de Ubatuba' },
  maragogi: { key: 'mcz', name: 'MaceiÃ³', label: 'MaceiÃ³, regiÃ³n cercana a Maragogi' },
  porto: { key: 'rec', name: 'Recife', label: 'Recife, regiÃ³n cercana a Porto de Galinhas' },
  trancoso: { key: 'trancoso', name: 'Porto Seguro', label: 'Porto Seguro, cerca de Trancoso' },
  jericoacoara: { key: 'for', name: 'Fortaleza', label: 'Fortaleza, regiÃ³n de acceso a Jericoacoara' },
  morro: { key: 'ssa', name: 'Salvador', label: 'Salvador, regiÃ³n de acceso a Morro de SÃ£o Paulo' },
  pip: { key: 'nat', name: 'Natal', label: 'Natal, regiÃ³n cercana a Pipa' },
  bombinhas: { key: 'bcm', name: 'BalneÃ¡rio CamboriÃº', label: 'BalneÃ¡rio CamboriÃº, cerca de Bombinhas' },
  rosa: { key: 'fln', name: 'FlorianÃ³polis', label: 'FlorianÃ³polis, regiÃ³n cercana a Praia do Rosa' },
  gram: { key: 'canela', name: 'Canela', label: 'Canela, cerca de Gramado' },
  canela: { key: 'gram', name: 'Gramado', label: 'Gramado, cerca de Canela' }
};
// Respaldo cuando Booking.com no devuelve (o no alcanza) 3 opciones reales para
// la categorÃ­a elegida. Usa cadenas hoteleras reales con presencia amplia en
// Brasil por nivel de comodidad; el link de reserva siempre apunta a una
// bÃºsqueda real y funcional de Booking.com para esa ciudad y esas fechas.
const HOTEL_TIER_FALLBACK = [
  { id: 'eco', label: 'EconÃ³mico', brands: ['ibis budget', 'Selina', 'Che Lagarto Hostel'],
    desc: 'Habitaciones simples y funcionales, ideal para dormir bien gastando poco.' },
  { id: 'medio', label: 'Intermedio', brands: ['ibis', 'Travel Inn', 'Slaviero'],
    desc: 'Hotel 3 estrellas con buena ubicaciÃ³n y desayuno incluido.' },
  { id: 'confort', label: 'Confort', brands: ['Mercure', 'Golden Tulip', 'Blue Tree'],
    desc: 'Hotel 4 estrellas con mÃ¡s comodidades y mejor ubicaciÃ³n.' }
];
function fallbackBookingUrl(destName, dep, ret, pax, hotelName) {
  const query = new URLSearchParams({
    ss: (hotelName ? hotelName + ', ' : '') + destName + ', Brasil',
    group_adults: String(Math.max(1, Number(pax) || 1)), no_rooms: '1', group_children: '0'
  });
  if (dep) query.set('checkin', dep);
  if (ret) query.set('checkout', ret);
  return 'https://www.booking.com/searchresults.es.html?' + query.toString();
}
function fallbackHotelsFor(destKey, destName, tierIndex, extra) {
  const dest = model.DEST[destKey];
  const tierInfo = HOTEL_TIER_FALLBACK[tierIndex] || HOTEL_TIER_FALLBACK[1];
  const nights = Math.max(1, Number(extra && extra.nights) || 1);
  const basePerNight = Math.max(20, Math.round((dest && Array.isArray(dest.lodge) ? dest.lodge[tierIndex] : null) || [70, 130, 220][tierIndex] || 130));
  const spread = [0.92, 1, 1.1];
  return tierInfo.brands.map(function (brand, index) {
    const name = brand + ' ' + destName;
    const perNight = Math.round(basePerNight * spread[index]);
    return {
      name: name, hotelId: '', image: '', total: perNight * nights, perNight: perNight, currency: 'USD', rating: 0,
      bookingUrl: fallbackBookingUrl(destName, extra && extra.dep, extra && extra.ret, extra && extra.pax, name),
      similar: [], source: 'fallback', tier: tierInfo.id,
      description: tierInfo.desc
    };
  });
}
function sanitizeHotelName(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Hotel recomendado';
  return raw.replace(/\s*,\s*Brasil\s*$/gi, '').replace(/\s+/g, ' ').trim();
}
function cleanImageUrl(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  const markdown = text.match(/^\[.*?\]\((https?:\/\/[^)]+)\)$/i);
  if (markdown && markdown[1]) return markdown[1].trim();
  const url = text.match(/https?:\/\/[^\s)>"]+/i);
  if (url && url[0]) return url[0].trim();
  return /^https?:\/\//i.test(text) ? text : '';
}
function normalizeHotelKey(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function fetchWithTimeout(url, init, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs || 12000) : null;
  const request = fetch(url, Object.assign({}, init, controller ? { signal: controller.signal } : {}));
  return request.finally(function () {
    if (timer) clearTimeout(timer);
  });
}
function bookingPhoto(hotel) {
  const queue = [hotel && (hotel.data || hotel.photoMainUrl || hotel.photo_main_url || hotel.main_photo_url || hotel.main_photo_url_https || hotel.max_photo_url || hotel.photo_url || hotel.image || hotel.photoUrls || hotel.photos || hotel.images)];
  const seen = new Set();
  while (queue.length) {
    const value = queue.shift();
    if (!value || seen.has(value)) continue;
    if (typeof value === 'string') {
      const candidate = cleanImageUrl(value);
      if (candidate && /^https:\/\//i.test(candidate)) return candidate;
    } else if (Array.isArray(value)) {
      value.forEach(function (item) { queue.push(item); });
    } else if (typeof value === 'object') {
      seen.add(value);
      ['url', 'photoUrl', 'photo_url', 'imageUrl', 'image_url', 'url_max', 'url_max300', 'url_square60', 'src', 'photoUrls', 'photos', 'images', 'data'].forEach(function (key) { if (value[key]) queue.push(value[key]); });
    }
  }
  return '';
}
function safeBookingHotelUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && (url.hostname === 'booking.com' || url.hostname.endsWith('.booking.com')) ? url.toString() : null;
  } catch (error) { return null; }
}
function bookingSettings() {
  return {
    key: process.env.BOOKING_API_KEY || '',
    host: String(process.env.BOOKING_API_HOST || 'booking-com15.p.rapidapi.com').trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
    url: process.env.BOOKING_API_URL || 'https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels',
    destination: process.env.BOOKING_DESTINATION || 'FlorianÃ³polis'
  };
}
function normalizeHotelApiResponse(payload, extra, source) {
  const data = payload && payload.data;
  const roots = [data && data.hotels, data && data.result, data && data.results, payload && payload.result, payload && payload.hotels];
  const rows = (Array.isArray(payload) ? payload : roots.find(Array.isArray) || []).filter(function (item) { return item && typeof item === 'object'; });
  const nights = Math.max(1, Number((extra && extra.nights) || 1));
  return rows.map(function (hotel) {
    const property = hotel.property || hotel;
    const breakdown = hotel.priceBreakdown || hotel.price_breakdown || {};
    const composite = hotel.compositePriceBreakdown || {};
    const gross = breakdown.grossPrice || breakdown.gross_price || {};
    const compositeGross = composite.grossAmount || composite.gross_amount || {};
    const nightlyRaw = Number(hotel.price_pn || hotel.perNight || hotel.per_night || 0);
    const totalCandidates = [gross.value, gross.amount, compositeGross.amount, compositeGross.value, breakdown.totalPrice, hotel.min_total_price, hotel.total_price, hotel.price];
    const totalRaw = Number(totalCandidates.find(function (value) { return value !== undefined && value !== null && value !== ''; }));
    const hasNightly = Number.isFinite(nightlyRaw) && nightlyRaw > 0;
    const hasTotal = Number.isFinite(totalRaw) && totalRaw > 0;
    const total = hasTotal ? totalRaw : hasNightly ? nightlyRaw * nights : 0;
    const rawName = property.name || hotel.hotel_name || hotel.hotelName || hotel.name && (hotel.name.label || hotel.name.en || hotel.name.EN && hotel.name.EN[0] && hotel.name.EN[0].name || hotel.name) || hotel.label || '';
    const name = sanitizeHotelName(rawName);
    const image = bookingPhoto(hotel) || bookingPhoto(property);
    const currency = String(gross.currency || compositeGross.currency || hotel.currency || breakdown.currency || 'USD').toUpperCase();
    const bookingUrl = safeBookingHotelUrl(hotel.url || hotel.hotel_url || hotel.bookingUrl || hotel.link || property.url);
    // Extraer regimen de comidas de todos los posibles campos de Booking API
    var rawMealPlan = String(
      hotel.meal_plan || hotel.mealPlan || hotel.board_type || hotel.board || hotel.meal_type ||
      (property && (property.meal_plan || property.mealPlan || property.board_type)) || ''
    ).toLowerCase().trim();
    return {
      name: name,
      hotelId: String(hotel.hotel_id || hotel.hotelId || property.hotel_id || property.id || hotel.id || ''),
      image: image,
      total: total,
      perNight: hasNightly ? nightlyRaw : total / nights,
      currency: currency,
      rating: Number(property.reviewScore || property.review_score || hotel.review_score || hotel.rating || 0),
      propertyType: String(property.propertyType || property.property_type || hotel.property_type || hotel.hotel_type || ''),
      description: String(property.description || hotel.description || ''),
      mealPlan: rawMealPlan,
      categoryText: JSON.stringify({ property: property, amenities: hotel.facilities || hotel.amenities || hotel.hotelFacilities || hotel.hotel_facilities || [], mealPlan: rawMealPlan }),
      bookingUrl: bookingUrl,
      similar: [],
      source: source || 'booking'
    };
  }).filter(function (hotel) { return hotel.name && hotel.name !== 'Hotel recomendado' && Number(hotel.total) > 0; });
}

function selectThreeHotelsByBudget(hotels, dailyBudget) {
  const target = Math.max(0, Number(dailyBudget) || 0);
  const unique = uniqueHotelList((hotels || []).filter(function (hotel) { return hotel && hotel.name; }));
  const priced = unique.filter(function (hotel) { return Number(hotel.perNight) > 0; }).sort(function (a, b) { return Number(a.perNight) - Number(b.perNight); });
  const unpriced = unique.filter(function (hotel) { return !(Number(hotel.perNight) > 0); });
  const selected = [];
  function take(list) {
    const found = list.find(function (hotel) { return !selected.some(function (item) { return normalizeHotelKey(item.name) === normalizeHotelKey(hotel.name); }); });
    if (found) selected.push(found);
  }
  if (priced.length) {
    const lowTarget = target > 0 ? target * 0.8 : priced[0].perNight;
    take(priced.filter(function (hotel) { return hotel.perNight <= lowTarget; }).slice().reverse());
    if (!selected.length) take(priced);
    const mediumTarget = target > 0 ? target : priced[Math.floor((priced.length - 1) / 2)].perNight;
    take(priced.slice().sort(function (a, b) { return Math.abs(a.perNight - mediumTarget) - Math.abs(b.perNight - mediumTarget); }));
    const upper = priced.filter(function (hotel) { return target > 0 ? hotel.perNight > target && hotel.perNight <= target * 1.25 : true; });
    take(upper);
  }
  priced.concat(unpriced).forEach(function (hotel) {
    if (selected.length < 3) take([hotel]);
  });
  return selected.slice(0, 3).map(function (hotel, index) {
    return Object.assign({}, hotel, {
      highlight: ['EconÃ³mico', 'Equilibrado', 'Cerca de tu presupuesto'][index],
      recommended: index === 0
    });
  });
}
const HOTEL_TYPE_LABELS = { 'all-inclusive': 'All Inclusive', resort: 'Resort', boutique: 'Boutique', economico: 'EconÃ³mico', intermedio: 'Intermedio', confort: 'Confort' };
function resolveHotelType(value, subcategory, style) {
  const normalized = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_ ]+/g, '-');
  const context = (normalized + ' ' + String(subcategory || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).replace(/[_ ]+/g, '-');
  if (context.indexOf('all-inclusive') >= 0 || context.indexOf('todo-incluido') >= 0) return 'all-inclusive';
  if (context.indexOf('resort') >= 0) return 'resort';
  if (context.indexOf('boutique') >= 0) return 'boutique';
  if (context.indexOf('economico') >= 0 || context.indexOf('econÃ³mico') >= 0 || context.indexOf('ahorro') >= 0) return 'economico';
  if (context.indexOf('intermedio') >= 0 || context.indexOf('3-estrellas') >= 0) return 'intermedio';
  if (context.indexOf('confort') >= 0 || context.indexOf('premium') >= 0) return 'confort';
  return style === 'ahorro' ? 'economico' : style === 'comodo' ? 'confort' : 'intermedio';
}
function hotelTypeMultiplier(type) {
  return ({ 'all-inclusive': 1.7, resort: 1.35, boutique: 1.22, economico: 0.82, intermedio: 1, confort: 1.3 })[type] || 1;
}
function hotelMatchesType(hotel, type, budgetTarget) {
  if (!type || type === 'intermedio' || type === 'confort' || type === 'economico') {
    const rate = Number(hotel.perNight) || 0;
    if (!rate || !budgetTarget) return type !== 'economico';
    if (type === 'economico') return rate <= budgetTarget * 0.85;
    if (type === 'intermedio') return rate > budgetTarget * 0.75 && rate <= budgetTarget * 1.25;
    return rate > budgetTarget * 1.1;
  }
  const text = normalizeHotelKey([hotel.name, hotel.propertyType, hotel.description, hotel.categoryText].filter(Boolean).join(' '));
  if (type === 'all-inclusive') {
    // Priorizar el campo mealPlan extraido directamente de la API de Booking
    const mp = String(hotel.mealPlan || '').toLowerCase();
    if (mp && (mp.includes('all_inclusive') || mp.includes('all-inclusive') || mp.includes('all inclusive') || mp === '5')) return true;
    // Fallback: buscar en texto libre del hotel
    return /all inclusive|todo incluido|todo inclusivo/.test(text);
  }
  if (type === 'resort') return /resort/.test(text);
  if (type === 'boutique') return /boutique/.test(text);
  return false;
}
function applyHotelTypeToProposal(proposal, type, pax) {
  const factor = hotelTypeMultiplier(type);
  const baseHotel = Number(proposal.parts.alojamiento) || 0;
  const baseMeals = Number(proposal.parts.comidas) || 0;
  proposal.baseHotelCost = baseHotel;
  proposal.baseMealCost = baseMeals;
  proposal.parts.alojamiento = Math.round(baseHotel * factor);
  if (type === 'all-inclusive') proposal.parts.comidas = 0;
  proposal.hotelType = type;
  proposal.hotelTypeLabel = HOTEL_TYPE_LABELS[type] || 'Intermedio';
  proposal.total = Object.keys(proposal.parts).reduce(function (sum, key) { return sum + (Number(proposal.parts[key]) || 0); }, 0);
  proposal.pp = Math.round(proposal.total / Math.max(1, Number(pax) || 1));
  return proposal;
}
function hotelBudgetTarget(destKey, style, extra) {
  const explicit = Number(extra && extra.hotelBudgetPerNight);
  if (extra && extra.hotelBudgetPerNight != null && Number.isFinite(explicit) && explicit >= 0) return Math.min(explicit, 1000000);
  const destination = model.DEST[destKey];
  const tierIndex = ({ ahorro: 0, eq: 1, comodo: 2 })[style] == null ? 1 : ({ ahorro: 0, eq: 1, comodo: 2 })[style];
  const perPerson = destination && Array.isArray(destination.lodge) ? Number(destination.lodge[tierIndex]) : 0;
  const pax = Math.max(1, Number(extra && extra.pax) || 1);
  const rooms = Math.ceil(pax / 2);
  return Math.max(0, perPerson * rooms * hotelTypeMultiplier(extra && extra.hotelType));
}
async function bookingApiJson(url, settings) {
  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'x-rapidapi-key': settings.key, 'x-rapidapi-host': settings.host, Accept: 'application/json' }
    }, 9000);
  } catch (error) {
    throw new Error(error && error.name === 'AbortError' ? 'Booking API excediÃ³ el tiempo de espera.' : 'No se pudo conectar con Booking API.');
  }
  let payload;
  try { payload = await response.json(); } catch (error) { throw new Error('Booking API devolviÃ³ una respuesta JSON invÃ¡lida.'); }
  if (!response || !response.ok || payload && payload.status === false) {
    const message = String(payload && (payload.message || payload.error) || 'No se pudo consultar disponibilidad.').slice(0, 180);
    throw new Error('Booking API (HTTP ' + (response && response.status || 502) + '): ' + message);
  }
  return payload || {};
}
function responseRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload && payload.data)) return payload.data;
  return [];
}
async function fetchBookingHotels(destKey, destName, style, extra) {
  const settings = bookingSettings();
  if (!settings.key) throw new Error('Falta configurar BOOKING_API_KEY en las variables de entorno de Vercel.');
  if (!settings.host || !settings.url) throw new Error('Falta configurar BOOKING_API_HOST o BOOKING_API_URL en Vercel.');
  const hotelName = String(destName || settings.destination || 'FlorianÃ³polis').trim();
  const dep = String((extra && extra.dep) || '').trim() || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const ret = String((extra && extra.ret) || '').trim() || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const adults = Math.max(1, Number((extra && extra.pax) || 1));
  const destinationUrl = new URL('/api/v1/hotels/searchDestination', 'https://' + settings.host);
  destinationUrl.searchParams.set('query', hotelName);
  destinationUrl.searchParams.set('locale', 'es');
  const destinationPayload = await bookingApiJson(destinationUrl.toString(), settings);
  const destinationRows = responseRows(destinationPayload);
  const target = destinationRows.find(function (item) { return item && /city/i.test(String(item.search_type || item.dest_type || '')); }) || destinationRows[0];
  if (!target || target.dest_id == null || !target.search_type) throw new Error('Booking API no encontrÃ³ la ciudad "' + hotelName + '".');
  const isAllInclusive = extra && extra.hotelType === 'all-inclusive';
  const params = new URLSearchParams({
    dest_id: String(target.dest_id), search_type: String(target.search_type),
    arrival_date: dep, departure_date: ret, adults: String(adults), room_qty: '1',
    page_number: '1', units: 'metric', languagecode: 'es', currency_code: 'USD'
  });
  // Filtrar por regimen todo-incluido directamente en la API de Booking
  if (isAllInclusive) { params.set('meal_plan', 'all_inclusive'); params.set('filter_by_meal_plan', '5'); }
  const searchUrl = new URL(settings.url);
  Object.keys(Object.fromEntries(params)).forEach(function (key) { searchUrl.searchParams.set(key, params.get(key)); });
  const payload = await bookingApiJson(searchUrl.toString(), settings);
  const hotels = normalizeHotelApiResponse(payload, extra, 'booking');
  const missingPhotos = hotels.filter(function (hotel) { return !hotel.image && hotel.hotelId; }).slice(0, 3);
  await Promise.all(missingPhotos.map(async function (hotel) {
    try {
      const photosUrl = new URL('/api/v1/hotels/getHotelPhotos', 'https://' + settings.host);
      photosUrl.searchParams.set('hotel_id', hotel.hotelId);
      photosUrl.searchParams.set('languagecode', 'es');
      const photos = await bookingApiJson(photosUrl.toString(), settings);
      hotel.image = bookingPhoto(photos) || bookingPhoto(photos && photos.data);
    } catch (error) { console.warn('[Booking fotos]', error.message); }
  }));
  return hotels.filter(function (hotel) { return hotel.image; });
}

function uniqueHotelList(list, fallbackImages) {
  const seen = new Set();
  const unique = [];
  list.forEach(function (entry) {
    const name = normalizeHotelKey(entry && entry.name);
    if (!name || seen.has(name)) return;
    seen.add(name);
    unique.push(Object.assign({}, entry, { image: entry && entry.image ? String(entry.image).trim() : '' }));
  });
  return unique;
}

// Siempre debe haber exactamente 3 opciones alineadas a la categorÃ­a (tier)
// que el usuario eligiÃ³ arriba (EconÃ³mico / Intermedio / Confort). Se prioriza
// alojamiento real de Booking.com dentro del rango de precio de esa categorÃ­a;
// lo que falte para llegar a 3 se completa con el respaldo de cadenas reales.
async function hotelRecommendations(destKey, destName, style, extra) {
  const tierByStyle = { ahorro: 'eco', eq: 'moderado', comodo: 'alto' };
  const tierIndex = ({ ahorro: 0, eq: 1, comodo: 2 })[style] == null ? 1 : ({ ahorro: 0, eq: 1, comodo: 2 })[style];
  const selectedTier = tierByStyle[style] || 'moderado';
  const hotelType = resolveHotelType(extra && extra.hotelType, extra && extra.subcategory, style);
  const hotelExtra = Object.assign({}, extra || {}, { hotelType: hotelType });
  const budgetTarget = hotelBudgetTarget(destKey, style, hotelExtra);
  let realHotels = [];
  try {
    realHotels = (await fetchBookingHotels(destKey, destName, selectedTier, hotelExtra)).map(function (hotel) { return Object.assign({}, hotel, { areaLabel: destName }); });
    if (realHotels.length < 3) {
      const nearby = HOTEL_NEARBY_DESTINATIONS[destKey] || null;
      if (nearby) {
        try {
          const regionalHotels = await fetchBookingHotels(nearby.key, nearby.name, selectedTier, hotelExtra);
          realHotels = realHotels.concat(regionalHotels.map(function (hotel) { return Object.assign({}, hotel, { areaLabel: nearby.label }); }));
        } catch (regionalError) {
          console.warn('[hotelRecommendations] BÃºsqueda regional no disponible:', regionalError && regionalError.message ? regionalError.message : regionalError);
        }
      }
    }
  } catch (error) {
    console.warn('[hotelRecommendations] Booking API no disponible:', error && error.message ? error.message : error);
    realHotels = [];
  }
  const priced = uniqueHotelList(realHotels.filter(function (hotel) { return hotel && hotel.name && Number(hotel.perNight) > 0; }));
  // Un hotel real mÃ¡s barato que el objetivo de la categorÃ­a sigue siendo vÃ¡lido
  // para esa categorÃ­a; lo que se descarta es lo que se pasa claramente de precio.
  const high = budgetTarget > 0 ? budgetTarget * 1.6 : Infinity;
  const matchingCategory = priced
    .filter(function (hotel) { return hotel.perNight <= high && hotelMatchesType(hotel, hotelType, budgetTarget); })
    .sort(function (a, b) { return Math.abs(a.perNight - budgetTarget) - Math.abs(b.perNight - budgetTarget); })
    .slice(0, 3)
    .map(function (hotel) { return Object.assign({}, hotel, { tier: selectedTier, similar: [], areaLabel: hotel.areaLabel || destName }); });
  const missing = 3 - matchingCategory.length;
  const canUseGenericFallback = hotelType === 'economico' || hotelType === 'intermedio' || hotelType === 'confort';
  // Para all-inclusive no usamos el fallback generico (son cadenas que NO son all-inclusive).
  // En su lugar generamos entradas con el link de Booking filtrado por todo-incluido.
  var fallback = [];
  if (missing > 0) {
    if (canUseGenericFallback) {
      fallback = fallbackHotelsFor(destKey, destName, hotelType === 'economico' ? 0 : hotelType === 'confort' ? 2 : tierIndex, hotelExtra);
    } else if (hotelType === 'all-inclusive') {
      // Generar N entradas que apuntan a Booking con filtro all-inclusive real
      var aiQuery = new URLSearchParams({
        ss: destName + ', Brasil', group_adults: String(Math.max(1, Number(hotelExtra.pax) || 1)),
        no_rooms: '1', group_children: '0', nflt: 'mealplan%3D5',
        checkin: hotelExtra.dep || '', checkout: hotelExtra.ret || ''
      });
      var aiUrl = 'https://www.booking.com/searchresults.es.html?' + aiQuery.toString();
      var aiNames = ['Complejo Todo Incluido', 'Resort All Inclusive', 'Hotel All Inclusive'];
      for (var ai = 0; ai < missing; ai++) {
        fallback.push({
          name: aiNames[ai] || ('All Inclusive ' + destName),
          hotelId: '', image: '',
          total: Math.round((budgetTarget || 200) * Math.max(1, Number(hotelExtra.nights) || 1)),
          perNight: budgetTarget || 200, currency: 'USD', rating: 0,
          mealPlan: 'all_inclusive', hotelType: 'all-inclusive',
          bookingUrl: aiUrl,
          description: 'Régimen todo incluido: comidas, bebidas y actividades incluidas en el precio.',
          similar: [], source: 'fallback-ai', tier: selectedTier,
          hotelTypeLabel: 'All Inclusive'
        });
      }
    }
  }
  const combined = uniqueHotelList(matchingCategory.concat(fallback)).slice(0, 3);
  return combined.map(function (hotel, index) {
    return Object.assign({}, hotel, {
      tier: selectedTier, hotelType: hotelType, hotelTypeLabel: HOTEL_TYPE_LABELS[hotelType] || 'Intermedio',
      highlight: ['Recomendado', 'Buena opciÃ³n', 'Alternativa'][index],
      recommended: index === 0
    });
  });
}

function adaptPackagesToStyle(result, trip, dep, ret, today) {
  const tierByStyle = { ahorro: 0, eq: 1, comodo: 2 };
  const tier = tierByStyle[trip.style] == null ? 1 : tierByStyle[trip.style];
  // Las propuestas no deben ofrecer ni conservar conexiones que impliquen
  // partir por Buenos Aires. Cuando la capa del estilo deja muy pocas opciones,
  // se rellena con alternativas vÃ¡lidas de otras categorÃ­as para mantener una
  // respuesta Ãºtil en modo demo y en bÃºsquedas rÃ¡pidas.
  const preferredCore = result.list.filter(function (proposal) { return proposal.mode !== 'avion_ba' && proposal.ti === tier; });
  // Para destinos donde ir en auto es una alternativa real (FlorianÃ³polis hacia
  // el sur), se suma como una propuesta comparable mÃ¡s en "Todas las
  // propuestas" -- sin tocar la recomendaciÃ³n, que sigue anclada a vuelo/bus
  // para no alterar el resto del flujo (cotizaciÃ³n real de Duffel, transfer
  // desde el aeropuerto, etc.), pensado para llegar en aviÃ³n o bus.
  const roadtripSameTier = Array.isArray(result.roadtripList)
    ? result.roadtripList.filter(function (proposal) { return proposal.mode === 'auto' && proposal.ti === tier; })
    : [];
  const preferred = preferredCore.concat(roadtripSameTier).sort(function (a, b) { return a.total - b.total; });
  const filtered = result.list.filter(function (proposal) { return proposal.mode !== 'avion_ba'; });
  const list = (preferred.length >= 3 ? preferred : filtered.filter(function (proposal) {
    return !preferred.some(function (item) { return item.id === proposal.id; });
  }).reduce(function (acc, proposal) {
    if (acc.some(function (item) { return item.id === proposal.id; })) return acc;
    acc.push(proposal);
    return acc;
  }, preferred.slice()).slice(0, 3)).slice().sort(function (a, b) { return a.total - b.total; });
  // La recomendaciÃ³n (Gran total, hotel, etc.) siempre debe salir de la
  // categorÃ­a que el usuario eligiÃ³ arriba, aunque el presupuesto no la
  // cubra del todo: rellenar `list` con otras categorÃ­as es solo para no
  // dejar la grilla de tarjetas vacÃ­a, nunca para elegir la propuesta.
  const picked = model.pick(trip, preferredCore.length ? preferredCore : list);
  const rec = picked.rec;
  const series = model.seriesFor(trip, rec, dep, ret, today);
  const cozy = list.slice().sort(function (a, b) { return b.comfort - a.comfort || a.total - b.total; })[0];
  const roadtripList = Array.isArray(result.roadtripList)
    ? result.roadtripList.filter(function (proposal) { return proposal.mode === 'auto'; }).slice().sort(function (a, b) { return a.total - b.total; }).slice(0, 3)
    : [];
  return Object.assign({}, result, {
    fits: picked.fits, recId: rec.id, cheapestId: list[0].id, cozyId: cozy.id,
    list: list,
    alternatives: (Array.isArray(result.alternatives) ? result.alternatives : []).filter(function (proposal) { return proposal.mode !== 'avion_ba'; }),
    roadtripList: roadtripList, series: series, tips: model.tipsFor(trip, rec, list, series)
  });
}
function roadtripCost(key, kmPerLiter) {
  const fuelPrice = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;
  return model.roadtripCost(key, kmPerLiter, fuelPrice);
}
function calculateLocalTransportCost({ style = 'eq', dest = 'rio', nights = 3, pax = 2 } = {}) {
  const normalizedStyle = ['eco', 'eq', 'comodo'].includes(String(style).toLowerCase()) ? String(style).toLowerCase() : 'eq';
  const normalizedDest = String(dest || 'rio').toLowerCase();
  const destination = model.destinationCosts(normalizedDest);
  const dailyUsd = normalizedStyle === 'comodo' ? destination.transport.confort : destination.transport.eco;
  const totalDays = Math.max(1, Number(nights) || 0) + 1;
  const travelers = Math.max(1, Number(pax) || 1);
  const totalUsd = Number((dailyUsd * totalDays * travelers).toFixed(2));
  return {
    style: normalizedStyle,
    destination: normalizedDest,
    baseDailyUsd: dailyUsd,
    multiplier: 1,
    nights: Number(nights) || 0,
    totalDays: totalDays,
    pax: travelers,
    dailyUsd: dailyUsd,
    totalUsd: totalUsd
  };
}
function transferConfig(destKey, pax) {
  const unit = Number(process.env.OFFICIAL_TRANSFER_PRICE_USD) || 35;
  return { pricePerPassenger: unit, amount: unit * Math.max(1, Number(pax) || 1), destination: destKey, bank: { bank: 'Prex', account: '361333', holder: 'Maria Paola Batista' } };
}

/* ---------- lÃ­mite de pedidos por IP ---------- */
/* ---------- lÃ­mite de pedidos por IP ---------- */
/*
 * Cada tipo de pedido lleva su propio cubo (el prefijo de la clave) por una
 * razón práctica: /api/cotizar-todos y /api/destinos-destacados son cálculo
 * local y no cuestan nada, mientras que /api/cotizar, /api/hoteles y
 * /api/vuelos/buscar gastan cuota de Duffel y de Booking. Con un cubo
 * compartido, alguien que golpeara los endpoints gratuitos podía agotarle el
 * cupo de cotizar a un usuario legítimo.
 *
 * LÍMITE CONOCIDO, no resuelto por este código: el contador vive en la
 * memoria del proceso. En Vercel cada instancia es efímera, así que el límite
 * real es "por instancia": con varias instancias a la vez el tope se multiplica
 * y se reinicia en cada despliegue. Para un límite compartido de verdad hace
 * falta un store externo (Upstash Redis o similar). En un host de un solo
 * proceso —un VPS, o el desarrollo local— esto funciona correctamente.
 *
 * Variables: RATE_LIMIT_PER_MIN (pedidos por minuto y cubo, 30 por defecto) y
 * RATE_LIMIT_MAX_IPS (techo de entradas guardadas, 20000 por defecto).
 */
const hits = new Map();
let hitsCalls = 0;
function sweepHits(now) {
  hits.forEach(function (v, k) { if (now > v.reset) hits.delete(k); });
}
function limited(bucket) {
  // Las dos variables se leen en cada llamada, no al cargar el módulo, para
  // que cambiarlas en caliente (tests, y un ajuste en un despliegue) surta
  // efecto sin reiniciar el proceso.
  const max = Number(process.env.RATE_LIMIT_PER_MIN) || 30;
  const maxIps = Number(process.env.RATE_LIMIT_MAX_IPS) || 20000;
  const now = Date.now();
  // Barrido amortizado: limpiar en cada pedido sería recorrer el mapa entero
  // siempre. Cada 256 pedidos alcanza para que no crezca sin control.
  if ((++hitsCalls & 0xff) === 0) sweepHits(now);
  let h = hits.get(bucket);
  if (!h || now > h.reset) { h = { n: 0, reset: now + 60000 }; hits.set(bucket, h); }
  h.n++;
  if (hits.size > maxIps) {
    // Techo duro de memoria. El barrido solo no alcanza: si entran IPs de
    // golpe (muchos orígenes distintos dentro del mismo minuto) todavía no
    // hay nada vencido que borrar y el mapa crecería hasta agotar la memoria
    // del proceso. El Map conserva el orden de inserción, así que las
    // primeras claves son las más viejas y son las que se descartan.
    sweepHits(now);
    while (hits.size > maxIps) {
      const oldest = hits.keys().next();
      if (oldest.done) break;
      hits.delete(oldest.value);
    }
  }
  return h.n > max;
}
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0].trim() : req.socket.remoteAddress) || 'x';
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function readJson(req, maxBytes) {
  maxBytes = maxBytes || 32768;
  return new Promise(function (resolve, reject) {
    let body = '', size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > maxBytes) { const e = new Error('El cuerpo del pedido es demasiado grande.'); e.status = 413; reject(e); req.destroy(); return; }
      body += chunk;
    });
    req.on('end', function () {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { e.status = 400; e.message = 'El cuerpo debe ser JSON vÃ¡lido.'; reject(e); }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------- checkout
// Cuerpo crudo: la firma HMAC del webhook se calcula sobre los bytes exactos
// que envió Duffel, así que no se puede pasar por JSON.parse antes de verificar.
function readRaw(req, maxBytes) {
  maxBytes = maxBytes || 65536;
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > maxBytes) { const e = new Error('Cuerpo demasiado grande.'); e.status = 413; reject(e); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

// El client key habilita el formulario de tarjeta PCI de Duffel. No es el
// access token, así que puede viajar al browser. Se cachea unos minutos para
// no gastarse una llamada de Duffel en cada apertura del checkout.
let clientKeyCache = { value: null, expiresAt: 0 };
async function duffelClientKey(req, res) {
  if (!duffel.isConfigured()) return sendJson(res, 503, { error: 'La reserva de vuelos todavía no está disponible.' });
  if (clientKeyCache.value && clientKeyCache.expiresAt > Date.now()) {
    return sendJson(res, 200, { clientKey: clientKeyCache.value });
  }
  const key = await duffel.createClientKey();
  clientKeyCache = { value: key, expiresAt: Date.now() + 10 * 60 * 1000 };
  sendJson(res, 200, { clientKey: key });
}

// Crea la orden en Duffel y la cobra. El importe lo calcula el server leyendo
// la oferta otra vez: el browser solo manda el id de la oferta y los datos de
// los pasajeros, nunca un precio.
async function crearOrdenVuelo(req, res, body) {
  if (!duffel.isConfigured()) return sendJson(res, 503, { error: 'La reserva de vuelos todavía no está disponible.' });
  if (limited('orden-vuelo:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const result = await duffel.createOrder({
    offerId: body.offerId,
    cardId: body.cardId,
    threeDSecureSessionId: body.threeDSecureSessionId,
    passengers: body.passengers
  });
  sendJson(res, 201, {
    orderId: result.order_id,
    bookingReference: result.booking_reference,
    status: result.status,
    charged: result.quote.charge_amount,
    currency: result.quote.currency,
    cost: result.quote.cost,
    markupAmount: result.quote.markup_amount,
    markupPercent: result.quote.markup_percent
  });
}

// Webhook de Duffel. NO es crítico para cobrar: la orden se crea de a cara en
// crearOrdenVuelo y devuelve el resultado de forma síncrona. Esto solo mantiene
// el estado alineado si el vuelo se cancela o modifica después.
//
// El esquema de firma de Duffel no está documentado públicamente con certeza,
// así que el nombre del header y el algoritmo son configurables. Si no hay
// secreto configurado el endpoint se cierra: es preferible no sincronizar a
// aceptar pedidos de cualquiera que adivine la URL.
function duffelWebhook(req, res) {
  const secret = String(process.env.DUFFEL_WEBHOOK_SECRET || '');
  if (!secret) return sendJson(res, 503, { error: 'Webhooks deshabilitados.' });
  const headerName = String(process.env.DUFFEL_WEBHOOK_SIGNATURE_HEADER || 'x-duffel-signature').toLowerCase();
  const provided = String(req.headers[headerName] || '');
  return readRaw(req).then(function (raw) {
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // timingSafeEqual exige mismo largo: comparar sin isso filtra el largo real.
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return sendJson(res, 401, { error: 'Firma inválida.' });
    }
    let event;
    try { event = JSON.parse(raw.toString('utf8') || '{}'); } catch (e) { return sendJson(res, 400, { error: 'JSON inválido.' }); }
    const data = event && event.data || {};
    console.log('[duffel-webhook]', JSON.stringify({
      type: String(event.type || data.type || ''),
      order: String(data.id || ''),
      status: String(data.status || data.identifier || '')
    }));
    sendJson(res, 200, { received: true });
  }).catch(function (e) {
    sendJson(res, e.status || 500, { error: e.message || 'No se pudo procesar el webhook.' });
  });
}

function registrarTransferencia(req, res, body) {
  body = body && typeof body === 'object' ? body : {};
  const amount = Number(body.amount);
  const file = body.receipt;
  if (!Number.isFinite(amount) || amount <= 0 || !file || !file.data) {
    return sendJson(res, 400, { error: 'AdjuntÃ¡ el comprobante de transferencia.' });
  }
  if (String(file.data).length > 6e6) return sendJson(res, 413, { error: 'El comprobante supera el tamaÃ±o mÃ¡ximo permitido.' });
  // El comprobante se valida de forma administrativa; no exponemos ni pedimos
  // nÃºmeros de operaciÃ³n en la interfaz de transferencias.
  return sendJson(res, 201, { ok: true, status: 'Pendiente de verificaciÃ³n', message: 'Â¡Reserva de traslado registrada con Ã©xito! En menos de 2 horas validaremos tu comprobante y te enviaremos el voucher definitivo por correo electrÃ³nico.' });
}

async function buscarVuelos(req, res, body) {
  if (limited('vuelos:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas bÃºsquedas seguidas. EsperÃ¡ un minuto y probÃ¡ de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const origin = String(body.origen || '').toUpperCase();
  const destination = AIR_DESTINATIONS[String(body.destino || '').toLowerCase()];
  const date = String(body.fecha_ida || '');
  const returnDate = String(body.fecha_vuelta || '');
  const passengers = Number(body.pasajeros);
  const style = ['ahorro', 'eq', 'comodo'].includes(String(body.style || '').toLowerCase()) ? String(body.style).toLowerCase() : 'eq';
  if (!['MVD', 'PDP'].includes(origin) || !destination || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || (returnDate && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(returnDate)) || !Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return sendJson(res, 400, { error: 'Datos de bÃºsqueda de vuelo invÃ¡lidos.' });
  }
  try {
    const cabins = duffel.styleCabins(style);
    const cabinResults = await Promise.all(cabins.map(function (cabinClass) {
      return duffel.searchFlights({ origin: origin, destination: destination, departureDate: date, returnDate: returnDate, passengers: passengers, cabinClass: cabinClass })
        .then(function (results) { return { offers: results, error: null }; })
        .catch(function (error) { return { offers: [], error: error }; });
    }));
    let offers = cabinResults.reduce(function (all, result) { return all.concat(result.offers); }, []);
    let providerErrors = cabinResults.map(function (result) { return result.error; }).filter(Boolean);
    let usedFallback = false;
    if (style === 'comodo' && !offers.length) {
      usedFallback = true;
      try {
        offers = await duffel.searchFlights({ origin: origin, destination: destination, departureDate: date, returnDate: returnDate, passengers: passengers, cabinClass: 'economy' });
      } catch (error) {
        providerErrors.push(error);
      }
    }
    if (!offers.length && providerErrors.length) throw providerErrors[0];
    offers.sort(function (a, b) { return (a.price_usd == null ? Infinity : a.price_usd) - (b.price_usd == null ? Infinity : b.price_usd); });
    return sendJson(res, 200, { provider: 'duffel', origin: origin, destination: destination, style: style, cabin_fallback: usedFallback, offers: offers, error: offers.length ? null : 'No hay vuelos disponibles para esas fechas. ProbÃ¡ con otras fechas.' });
  } catch (e) {
    console.error('[Duffel vuelos]', e.message);
    return sendJson(res, e.status || 502, { provider: 'duffel', offers: [], error: e.message || 'No pudimos consultar disponibilidad de vuelos.' });
  }
}

// Una sola tarifa real de Duffel (1 pasajero, ida y vuelta) para anclar la
// propuesta recomendada y, con ella, toda la serie de "otra fecha" (que ya
// se calcula como el total recomendado + la variaciÃ³n estimada del modelo).
// Evita las N consultas que implicarÃ­a cotizar cada fecha o cada destino.
async function getLiveFlightQuote(destinationIata, dep, ret, style, origin) {
  if (!duffel.isConfigured()) return null;
  const cabinClass = duffel.styleCabins(style)[0] || 'economy';
  const offers = await duffel.searchFlights({ origin: origin || 'MVD', destination: destinationIata, departureDate: dep, returnDate: ret, passengers: 1, cabinClass: cabinClass });
  const priced = offers.filter(function (offer) { return Number.isFinite(offer.price_usd) && offer.price_usd > 0; });
  if (!priced.length) return null;
  const cheapest = priced.reduce(function (min, offer) { return offer.price_usd < min.price_usd ? offer : min; });
  return { pp: cheapest.price_usd, airline: cheapest.airline || null, exact: true, foundDep: dep, foundRet: ret, source: 'duffel' };
}

async function cotizar(req, res, url) {
  if (limited('cotizar:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas bÃºsquedas seguidas. EsperÃ¡ un minuto y probÃ¡ de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    v = model.validate(Object.fromEntries(url.searchParams), today);
  } catch (e) {
    return sendJson(res, e.status || 400, { error: e.message });
  }
  if (!SEARCH_DESTINATION_KEYS.includes(v.S.dest)) return sendJson(res, 400, { error: 'ElegÃ­ un destino disponible en el buscador.' });
  const origin = String(url.searchParams.get('origin') || 'MVD').toUpperCase();
  if (!['MVD', 'PDP'].includes(origin)) return sendJson(res, 400, { error: 'El aeropuerto de salida debe ser MVD o PDP.' });
  v.S.origin = origin;
  const subcategory = String(url.searchParams.get('subcategory') || '').slice(0, 100);
  v.S.fuelPriceUsd = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;
  // La pantalla inicial anda con una tarifa real de Duffel para la ruta/fechas
  // elegidas cuando estÃ¡ disponible; si Duffel falla o no estÃ¡ configurado,
  // se cae de vuelta a la estimaciÃ³n local sin romper la respuesta.
  let quotes = {};
  let liveQuoteApplied = false;
  const destCfgForQuote = model.DEST[v.S.dest];
  if (v.S.transport === 'flight' && destCfgForQuote && destCfgForQuote.modes.avion_mvd) {
    try {
      const quote = await getLiveFlightQuote(destCfgForQuote.iata, v.dep, v.ret, v.S.style, origin);
      if (quote) { quotes = { avion_mvd: quote }; liveQuoteApplied = true; }
    } catch (e) {
      console.error('[cotizar] tarifa real de Duffel no disponible:', e.message);
    }
  }
  const hotelType = resolveHotelType(url.searchParams.get('hotel_type'), subcategory, v.S.style);
  v.S.hotelType = hotelType;
  const result = adaptPackagesToStyle(model.compute(v.S, v.dep, v.ret, today, quotes), v.S, v.dep, v.ret, today);
  const recommendedProposal = result.list.find(function (proposal) { return proposal.id === result.recId; });
  const isBuziosArraial = /b[uÃº]zios\s*\+\s*arraial/i.test(subcategory);
  const multiStay = isBuziosArraial && recommendedProposal ? {
    hub: { name: 'RÃ­o de Janeiro', iata: 'GIG' },
    stays: [
      { key: 'buz', name: 'BÃºzios', nightlyRates: model.lodgingNightlyCosts('buz', recommendedProposal.ti, v.dep, v.nights) },
      { key: 'arraial', name: 'Arraial do Cabo', nightlyRates: model.lodgingNightlyCosts('arraial', recommendedProposal.ti, v.dep, v.nights) }
    ],
    transferBetweenUsd: 30 * v.S.pax,
    transferBetweenLabel: 'Traslado entre BÃºzios y Arraial do Cabo (estimado, un tramo)'
  } : null;
  const nonHotelCost = recommendedProposal ? Number(recommendedProposal.total) - Number(recommendedProposal.parts.alojamiento || 0) : 0;
  const hotelBudgetPerNight = url.searchParams.has('hotel_budget_per_night')
    ? Number(url.searchParams.get('hotel_budget_per_night'))
    : (v.S.budget > 0 ? Math.max(0, (v.S.budget - nonHotelCost) / Math.max(1, v.nights) / Math.ceil(Math.max(1, v.S.pax) / 2)) : null);
  const hotelExtra = { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, nights: v.nights, hotelType: hotelType, subcategory: subcategory };
  if (Number.isFinite(hotelBudgetPerNight) && hotelBudgetPerNight >= 0) hotelExtra.hotelBudgetPerNight = hotelBudgetPerNight;
  const localTransport = calculateLocalTransportCost({ style: v.S.style, dest: v.S.dest, nights: v.nights, pax: v.S.pax });
  sendJson(res, 200, Object.assign({
    meta: {
      mode: liveQuoteApplied ? 'live' : 'estimated',
       dest: { key: v.S.dest, name: model.DEST[v.S.dest].name, region: model.DEST[v.S.dest].region || '', country: model.DEST[v.S.dest].country || 'Brasil' }, origin: origin, subcategory: subcategory, hotelType: hotelType, hotelTypeLabel: HOTEL_TYPE_LABELS[hotelType] || 'Intermedio', multiStay: multiStay,
      dep: v.S.dep, ret: v.S.ret, nights: v.nights, pax: v.S.pax, budget: v.S.budget, style: v.S.style,
      costBasis: Object.assign({}, model.REAL_COSTS, { destinationCosts: model.DESTINATION_COSTS }), roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax), localTransport: localTransport,
      hotels: [], hotelsPending: true, hotelBudgetPerNight: Number.isFinite(hotelBudgetPerNight) ? hotelBudgetPerNight : hotelBudgetTarget(v.S.dest, v.S.style, hotelExtra), hotelsNearby: '', generatedAt: new Date().toISOString()
    },
    localTransport: localTransport
  }, result));
}

async function cotizarHoteles(req, res, url) {
  if (limited('hoteles:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas bÃºsquedas de alojamiento. EsperÃ¡ un minuto y probÃ¡ de nuevo.' });
  let v;
  try { v = model.validate(Object.fromEntries(url.searchParams), model.getToday()); }
  catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
  if (!SEARCH_DESTINATION_KEYS.includes(v.S.dest)) return sendJson(res, 400, { error: 'ElegÃ­ un destino disponible en el buscador.' });
  const dest = model.DEST[v.S.dest];
  const hotelType = resolveHotelType(url.searchParams.get('hotel_type'), url.searchParams.get('subcategory'), v.S.style);
  const rawBudget = url.searchParams.get('hotel_budget_per_night');
  const extra = { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, nights: v.nights, hotelType: hotelType, subcategory: url.searchParams.get('subcategory') || '' };
  if (rawBudget !== null && Number.isFinite(Number(rawBudget)) && Number(rawBudget) >= 0) extra.hotelBudgetPerNight = Number(rawBudget);
  const hotels = await hotelRecommendations(v.S.dest, dest.name, v.S.style, extra);
  return sendJson(res, 200, {
    hotels: hotels,
    hotelBudgetPerNight: hotelBudgetTarget(v.S.dest, v.S.style, extra), hotelType: hotelType,
    hotelsNearby: (hotels.find(function (hotel) { return hotel.areaLabel && hotel.areaLabel !== dest.name; }) || {}).areaLabel || ''
  });
}

function cotizarTodos(req, res, url) {
  if (limited('cotizar-todos:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas bÃºsquedas seguidas. EsperÃ¡ un minuto y probÃ¡ de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    // La validaciÃ³n del viaje es compartida con la cotizaciÃ³n individual; el
    // destino de referencia solo satisface ese validador y luego se reemplaza.
    v = model.validate(Object.assign({}, Object.fromEntries(url.searchParams), { dest: 'fln' }), today);
  } catch (e) {
    return sendJson(res, e.status || 400, { error: e.message });
  }
  const origin = String(url.searchParams.get('origin') || 'MVD').toUpperCase();
  if (!['MVD', 'PDP'].includes(origin)) return sendJson(res, 400, { error: 'El aeropuerto de salida debe ser MVD o PDP.' });
  v.S.origin = origin;
  v.S.fuelPriceUsd = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;

  const localTransport = calculateLocalTransportCost({ style: v.S.style, dest: v.S.dest, nights: v.nights, pax: v.S.pax });

  // Estas diez opciones son comparables y estimadas: consultar el proveedor para
  // cada destino dispararÃ­a hasta 19 requests externos en un solo clic.
  const options = HOME_DESTINATION_KEYS.map(function (key) {
    const trip = Object.assign({}, v.S, { dest: key });
    const result = adaptPackagesToStyle(model.compute(trip, v.dep, v.ret, today, {}), trip, v.dep, v.ret, today);
    const rec = result.list.find(function (p) { return p.id === result.recId; });
    return {
      dest: { key: key, name: model.DEST[key].name, region: model.DEST[key].region || '', country: 'Brasil' }, total: rec.total, pp: rec.pp,
      parts: rec.parts, title: rec.modeShort + ' + hotel ' + rec.tierLabel,
      tierDesc: rec.tierDesc, fits: result.fits
    };
  }).sort(function (a, b) { return a.total - b.total; });

  sendJson(res, 200, {
    meta: { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, budget: v.S.budget, style: v.S.style, origin: origin, mode: 'estimated', costBasis: Object.assign({}, model.REAL_COSTS, { destinationCosts: model.DESTINATION_COSTS }), roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax), localTransport: localTransport },
    options: options,
    localTransport: localTransport
  });
}

/*
 * Precios de las tarjetas de "Destinos destacados".
 *
 * El cliente resuelve las fechas de cada tarjeta (incluye el caso especial de
 * Réveillon) y las manda ya resueltas en `items`, con el formato
 * `clave~ida~vuelta~tipoHotel`. El servidor no vuelve a decidir fechas: sólo
 * aplica el modelo de costos a lo que le llega. Así no hay dos reglas de
 * fechas que puedan desincronizarse entre cliente y servidor.
 *
 * Para cada grupo devolvemos la opción MÁS BARATA que la app realmente
 * ofrecería: el mismo filtro de `adaptPackagesToStyle` (se descartan las
 * salidas por Buenos Aires) para no prometer un precio con una conexión que
 * la app no va a mostrar.
 */
const FEATURED_MAX_ITEMS = 12;
const FEATURED_HOTEL_TYPES = ['all-inclusive', 'resort', 'boutique', 'economico', 'intermedio', 'confort'];

function featuredPriceItems(req, res, url) {
  if (limited('destacados:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas consultas seguidas. Esperá un minuto y probá de nuevo.' });
  const pax = Math.min(10, Math.max(1, parseInt(url.searchParams.get('pax'), 10) || 2));
  const style = ['ahorro', 'eq', 'comodo'].indexOf(String(url.searchParams.get('style') || '').toLowerCase()) >= 0
    ? String(url.searchParams.get('style')).toLowerCase() : 'eq';
  const origin = ['MVD', 'PDP'].indexOf(String(url.searchParams.get('origin') || 'MVD').toUpperCase()) >= 0
    ? String(url.searchParams.get('origin')).toUpperCase() : 'MVD';
  const today = model.getToday();
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const items = String(url.searchParams.get('items') || '').split(',')
    .map(function (raw) { return raw.split('~'); })
    .filter(function (parts) { return parts.length >= 3; })
    .map(function (parts) {
      const key = String(parts[0] || '').trim();
      const dep = String(parts[1] || '').trim();
      const ret = String(parts[2] || '').trim();
      const hotelType = FEATURED_HOTEL_TYPES.indexOf(String(parts[3] || '').trim()) >= 0 ? String(parts[3]).trim() : 'intermedio';
      if (!model.DEST[key] || !re.test(dep) || !re.test(ret)) return null;
      const depDate = model.parse(dep), retDate = model.parse(ret);
      const nights = model.daysBetween(depDate, retDate);
      if (isNaN(depDate) || isNaN(retDate) || nights < 1 || nights > 30) return null;
      // 'flight' (el transporte por defecto de la app) y no 'all': con 'all'
      // el precio más bajo salía siempre en Auto / Roadtrip, que es una
      // alternativa que la app muestra aparte y no la que se abre al tocar
      // "Ver propuesta". El cartel tiene que anticipar lo que se ve después.
      // El filtro de avion_ba es el mismo que usa adaptPackagesToStyle.
      const trip = { dest: key, pax: pax, budget: 0, style: style, transport: 'flight', kmPerLiter: 12,
        hotelType: hotelType, origin: origin, fuelPriceUsd: Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2 };
      const cheapest = model.build(trip, depDate, retDate, today, null)
        .filter(function (proposal) { return proposal.mode !== 'avion_ba'; })
        .sort(function (a, b) { return a.total - b.total; })[0];
      if (!cheapest) return null;
      return {
        key: key, total: cheapest.total, pp: cheapest.pp, nights: nights,
        modeShort: cheapest.modeShort, tierLabel: cheapest.tierLabel
      };
    })
    .filter(Boolean)
    // El tope se aplica DESPUÉS de descartar los inválidos: si se cortara antes,
    // un cliente que mandara basura en los primeros items se quedaría sin
    // precios y la sección se mostraría sin cifras.
    .slice(0, FEATURED_MAX_ITEMS);
  return sendJson(res, 200, { pax: pax, style: style, items: items });
}

// Páginas que sólo existen durante el prelanzamiento: la app de cotización y
// el reparto de gastos. La raíz del dominio muestra la waitlist al público,
// así que estas no pueden quedar accesibles sólo por adivinar la URL.
//
// El candado va por ARCHIVO y no por ruta a propósito: la app también se
// alcanza como /app, como /app/ y como /index.html (el catch-all de más abajo
// sirve ese archivo directamente), y el reparto como /grupo y /grupo.html.
// Filtrando sólo la ruta /app, esas otras entradas quedarían abiertas.
const PRELAUNCH_FILES = new Set(['index.html', 'grupo.html']);

function prelaunchGuard() {
  const user = String(process.env.APP_USER || '').trim();
  const pass = String(process.env.APP_PASS || '');
  // Sin las dos variables no hay candado: el desarrollo local sigue abierto.
  if (!user || !pass) return null;
  return { user: user, pass: pass };
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab); // igual trabajo, resultado falso
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

function denyPrelaunch(res) {
  const body = '<!doctype html><meta charset="utf-8"><title>Acceso restringido</title>'
    + '<body style="font-family:system-ui;background:#0B1330;color:#F3F6FC;display:grid;place-items:center;height:100vh;margin:0">'
    + '<div style="text-align:center"><h1 style="font-size:20px;margin:0 0 8px">Acceso restringido</h1>'
    + '<p style="color:#9AA6C7;margin:0">Esta p&aacute;gina a&uacute;n no es p&uacute;blica.</p></div>';
  res.writeHead(401, {
    'Content-Type': 'text/html; charset=utf-8',
    'WWW-Authenticate': 'Basic realm="CuantoSale", charset="UTF-8"',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

// Devuelve true si la petición trae credenciales válidas del candado, o si
// no hay candado configurado (desarrollo local).
function prelaunchAuthorized(req) {
  const guard = prelaunchGuard();
  if (!guard) return true;
  const header = String(req.headers.authorization || '');
  const m = /^Basic\s+(.+)$/i.exec(header);
  if (!m) return false;
  let decoded = '';
  try { decoded = Buffer.from(m[1], 'base64').toString('utf8'); } catch (e) { decoded = ''; }
  const sep = decoded.indexOf(':');
  const user = sep >= 0 ? decoded.slice(0, sep) : decoded;
  const pass = sep >= 0 ? decoded.slice(sep + 1) : '';
  // Se calculan las dos comparaciones siempre: cortocircuitar aquí
  // devolvería si el usuario existe midiendo el tiempo de respuesta.
  const userOk = safeEqual(user, guard.user);
  const passOk = safeEqual(pass, guard.pass);
  return userOk && passOk;
}

/*
 * API que queda pública aunque la app esté candada.
 *
 * Es una lista de excepciones, no de bloqueos: todo /api/* queda detrás del
 * candado salvo lo que esté acá, así que un endpoint nuevo nace protegido y
 * hay que abrirlo a propósito.
 *
 * /api/config es la única excepción real. La waitlist es la cara pública del
 * sitio y necesita leer de ahí la URL y la clave anónima de Supabase para
 * guardar el email (ver public/waitlist.js). La clave anónima está pensada
 * para ser pública y la protege el RLS de Supabase.
 */
const PRELAUNCH_PUBLIC_API = new Set(['/api/config']);

// Rutas que NO pasan por el candado de pre-lanzamiento. El webhook queda
// fuera porque lo llama Duffel desde sus servidores, no el navegador: si
// exigiera el user/pass de /app, nunca llegaría. No es un hueco de seguridad
// porque duffelWebhook() rechaza el pedido salvo que la firma HMAC cuadre.
const PRELAUNCH_EXEMPT = new Set(['/api/duffel/webhook']);

function denyPrelaunchJson(res) {
  // Sin WWW-Authenticate a propósito: en una respuesta a un fetch de la app
  // ese encabezado hace que el navegador abra el diálogo de Basic Auth en
  // medio de la pantalla. Acá alcanza con un 401 que el cliente pueda leer.
  sendJson(res, 401, { error: 'Acceso restringido. Esta aplicación todavía no es pública.' });
}

// Devuelve true si ya respondió con un 401 (acceso denegado).
function checkPrelaunchAccess(req, res, relPath) {
  const guard = prelaunchGuard();
  if (!guard) return false;
  if (!PRELAUNCH_FILES.has(path.basename(relPath).toLowerCase())) return false;
  const header = String(req.headers.authorization || '');
  const m = /^Basic\s+(.+)$/i.exec(header);
  let ok = false;
  if (m) {
    let decoded = '';
    try { decoded = Buffer.from(m[1], 'base64').toString('utf8'); } catch (e) { decoded = ''; }
    const sep = decoded.indexOf(':');
    const user = sep >= 0 ? decoded.slice(0, sep) : decoded;
    const pass = sep >= 0 ? decoded.slice(sep + 1) : '';
    // Se calculan las dos comparaciones siempre: cortocircuitar aquí
    // devolvería si el usuario existe midiendo el tiempo de respuesta.
    const userOk = safeEqual(user, guard.user);
    const passOk = safeEqual(pass, guard.pass);
    ok = userOk && passOk;
  }
  if (ok) return false;
  denyPrelaunch(res);
  return true;
}

const COMPRESSIBLE_EXT = new Set(['.html', '.css', '.js', '.json', '.svg']);
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/waitlist.html';
  if (checkPrelaunchAccess(req, res, rel)) return;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && file.indexOf(PUBLIC_DIR + path.sep) !== 0) { res.writeHead(403); return res.end('Prohibido'); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    const ext = path.extname(file);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // Las rutas con `?v=N` son inmutables por diseño: cambiar el archivo
      // implica bumpear la versión, así que cachearlas fuerte es seguro y
      // evita redescargar app.js/style.css enteros en cada visita. Lo que no
      // lleva versión (HTML de entrada, manifest, íconos) sigue sin cachear.
      'Cache-Control': req.url.indexOf('?') >= 0 ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
    };
    if (COMPRESSIBLE_EXT.has(ext) && data.length > 512) {
      const acceptEncoding = String(req.headers['accept-encoding'] || '');
      if (acceptEncoding.indexOf('gzip') >= 0) {
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        return res.end(zlib.gzipSync(data, { level: 6 }));
      }
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

function createServer() {
  return http.createServer(function (req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
    // Candado de prelanzamiento para la API. Va antes de cualquier ruta para
    // que ningún endpoint quede por afuera, tampoco los POST de más abajo.
    //
    // Sin esto el candado sólo cerraba las páginas: /api/cotizar y /api/hoteles
    // seguían respondiendo 200 sin contraseña y devolvían cotizaciones reales,
    // consumiendo la cuota de Duffel y de Booking a nombre de cualquiera que
    // supiera la URL.
    if (url.pathname.indexOf('/api/') === 0 && !PRELAUNCH_PUBLIC_API.has(url.pathname) && !PRELAUNCH_EXEMPT.has(url.pathname)) {
      if (!prelaunchAuthorized(req)) return denyPrelaunchJson(res);
    }
    if (req.method === 'POST' && url.pathname === '/api/vuelos/buscar') {
      return readJson(req).then(function (body) { return buscarVuelos(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos leer la bÃºsqueda.' });
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/duffel/client-key') {
      return duffelClientKey(req, res).catch(function (e) {
        console.error('[duffel-client-key]', e);
        sendJson(res, e.status || 502, { error: e.message || 'No pudimos preparar el pago.' });
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/duffel/orden') {
      return readJson(req).then(function (body) { return crearOrdenVuelo(req, res, body); }).catch(function (e) {
        console.error('[duffel-orden]', e);
        sendJson(res, e.status || 502, { error: e.message || 'No pudimos completar la reserva.' });
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/duffel/webhook') {
      return duffelWebhook(req, res);
    }
    if (req.method === 'GET' && url.pathname === '/api/vuelos/comprar') {
      if (limited('vuelos-comprar:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas bÃºsquedas seguidas. EsperÃ¡ un minuto y probÃ¡ de nuevo.' });
      return sendJson(res, 410, { error: 'La reserva de vuelos se gestiona directamente con Duffel.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/traslados/transferencia') {
      return readJson(req, 6 * 1024 * 1024).then(function (body) { return registrarTransferencia(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos registrar la transferencia.' });
      });
    }
    if (req.method === 'POST') { res.writeHead(404); return res.end(); }
    if (url.pathname === '/api/destinos') {
      return sendJson(res, 200, SEARCH_DESTINATION_KEYS.map(function (k) { return { key: k, name: model.DEST[k].name }; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); }));
    }
    if (url.pathname === '/api/config') {
      return sendJson(res, 200, {
        supabaseUrl: process.env.SUPABASE_URL || 'https://hqyzmeordvjccytgltse.supabase.co',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        travelpayoutsMarker: process.env.TRAVELPAYOUTS_MARKER || '780345',
        // Diagnóstico del candado de prelanzamiento. Dice sólo si el proceso
        // recibió las variables, nunca cuáles son: sirve para distinguir un
        // problema de configuración de un bug, sin filtrar el secreto.
        prelaunchLock: {
          userPresent: Boolean(String(process.env.APP_USER || '').trim()),
          passPresent: Boolean(String(process.env.APP_PASS || '').trim()),
          active: Boolean(prelaunchGuard())
        }
      });
    }
    if (url.pathname === '/api/cotizar') {
      return cotizar(req, res, url).catch(function (e) {
        console.error('[cotizar]', e);
        sendJson(res, 500, { error: 'Error inesperado. ProbÃ¡ de nuevo en un momento.' });
      });
    }
    if (url.pathname === '/api/hoteles') {
      return cotizarHoteles(req, res, url).catch(function (e) {
        console.error('[hoteles]', e);
        sendJson(res, 502, { error: 'No pudimos cargar alojamientos ahora.' });
      });
    }
    if (url.pathname === '/api/cotizar-todos') {
      return cotizarTodos(req, res, url);
    }
    if (url.pathname === '/api/destinos-destacados') {
      return featuredPriceItems(req, res, url);
    }
    if (url.pathname === '/api/cargadores') {
      // El endpoint se retiró: Open Charge Map sólo tiene cargadores alrededor
      // del destino, no en el corredor, así que la lista que servía no
      // correspondía a las paradas del viaje. Se responde 410 en vez de 404
      // para que quede claro que fue una decisión y no un error.
      return sendJson(res, 410, { error: 'Ya no mostramos cargadores: la fuente disponible sólo cubre el destino, no el trayecto.' });
    }
    // /grupo y /grupo/<uuid> son rutas cliente (SPA): el id se lee del path
    // en el navegador, así que el servidor siempre entrega el mismo HTML.
    if (/^\/grupo(\/[0-9a-f-]{1,36})?\/?$/i.test(url.pathname)) {
      try { serveStatic(req, res, '/grupo.html'); } catch (e) { res.writeHead(400); res.end(); }
      return;
    }
    if (/^\/waitlist\/?$/i.test(url.pathname)) {
      try { serveStatic(req, res, '/waitlist.html'); } catch (e) { res.writeHead(400); res.end(); }
      return;
    }
    // La raíz del dominio es la landing de waitlist mientras dure el
    // prelanzamiento; la app real de cotización queda corrida a /app, sin
    // link público hacia ella (nadie llega ahí por accidente).
    if (/^\/app\/?$/i.test(url.pathname)) {
      try { serveStatic(req, res, '/index.html'); } catch (e) { res.writeHead(400); res.end(); }
      return;
    }
    try { serveStatic(req, res, url.pathname); } catch (e) { res.writeHead(400); res.end(); }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, function () {
    console.log('CuÃ¡ntoSale en http://localhost:' + port + ' (' + (duffel.isConfigured() ? 'bÃºsqueda Duffel configurada' : 'Duffel sin configurar; se mostrarÃ¡ un aviso controlado') + ')');
  });
}

const app = createServer();
module.exports = app;
// Vercel consume la funciÃ³n `app`; exponer el factory permite levantar un
// servidor aislado en las pruebas sin alterar el handler desplegado.
module.exports.createServer = createServer;
module.exports.hotelRecommendations = hotelRecommendations;
module.exports.fetchBookingHotels = fetchBookingHotels;
module.exports.normalizeHotelApiResponse = normalizeHotelApiResponse;
module.exports.selectThreeHotelsByBudget = selectThreeHotelsByBudget;
