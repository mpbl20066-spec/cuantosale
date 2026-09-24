'use strict';
/*
 * Servidor de CuántoSale. Node 18 o superior.
 *
 *   node server.js            -> http://localhost:3000
 *
 * Variables (en el entorno o en un archivo .env):
 *   DUFFEL_API_KEY (o DUFFEL_ACCESS_TOKEN) para búsquedas reales de vuelos.
 *   PORT                  puerto (por defecto 3000)
 *   BOOKING_API_KEY y BOOKING_API_HOST para la API de alojamientos.
 *   RATE_LIMIT_PER_MIN    pedidos por minuto por IP a /api/cotizar (por defecto 30)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  try {
    fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (line) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  } catch (e) { /* no hay .env: está bien */ }
}
loadEnv();

const model = require('./lib/model');
const duffel = require('./lib/providers/duffel');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://emrldco.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://emrldco.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://emrldco.com https://*.emrldco.com https://*.supabase.co https://*.wikimedia.org; frame-src https://*.supabase.co; base-uri 'none'; form-action 'self'";
const AIR_DESTINATIONS = { buz: 'GIG', arraial: 'GIG', cabo: 'GIG', ilha: 'GIG', paraty: 'GIG', ilhabela: 'GRU', ubatuba: 'GRU', rio: 'GIG', angra: 'GIG', sao: 'GRU', bho: 'CNF', curitiba: 'CWB', porto: 'REC', mcz: 'MCZ', maragogi: 'MCZ', nat: 'NAT', pip: 'NAT', trancoso: 'SSA', ssa: 'SSA', for: 'FOR', jericoacoara: 'FOR', morro: 'SSA', fernando: 'NVT', fln: 'FLN', camboriu: 'FLN', bombinhas: 'FLN', rosa: 'FLN', bcm: 'FLN', gram: 'POA', canela: 'POA', igu: 'IGU', rec: 'REC', poa: 'POA' };
// Algunas islas y pueblos pequeños no están indexados como ciudad en Booking.
// En esos casos buscamos alojamientos en el municipio de acceso más cercano.
const HOTEL_NEARBY_DESTINATIONS = {
  buz: { key: 'cabo', name: 'Cabo Frio', label: 'Cabo Frio, cerca de Búzios' },
  arraial: { key: 'cabo', name: 'Cabo Frio', label: 'Cabo Frio, cerca de Arraial do Cabo' },
  cabo: { key: 'arraial', name: 'Arraial do Cabo', label: 'Arraial do Cabo, cerca de Cabo Frio' },
  ilha: { key: 'angra', name: 'Angra dos Reis', label: 'Angra dos Reis, cerca de Ilha Grande' },
  paraty: { key: 'angra', name: 'Angra dos Reis', label: 'Angra dos Reis y alrededores' },
  ilhabela: { key: 'ilhabela', name: 'São Sebastião', label: 'São Sebastião, junto a Ilhabela' },
  ubatuba: { key: 'ubatuba', name: 'Caraguatatuba', label: 'Caraguatatuba, cerca de Ubatuba' },
  maragogi: { key: 'mcz', name: 'Maceió', label: 'Maceió, región cercana a Maragogi' },
  porto: { key: 'rec', name: 'Recife', label: 'Recife, región cercana a Porto de Galinhas' },
  trancoso: { key: 'trancoso', name: 'Porto Seguro', label: 'Porto Seguro, cerca de Trancoso' },
  jericoacoara: { key: 'for', name: 'Fortaleza', label: 'Fortaleza, región de acceso a Jericoacoara' },
  morro: { key: 'ssa', name: 'Salvador', label: 'Salvador, región de acceso a Morro de São Paulo' },
  pip: { key: 'nat', name: 'Natal', label: 'Natal, región cercana a Pipa' },
  bombinhas: { key: 'bcm', name: 'Balneário Camboriú', label: 'Balneário Camboriú, cerca de Bombinhas' },
  rosa: { key: 'fln', name: 'Florianópolis', label: 'Florianópolis, región cercana a Praia do Rosa' },
  gram: { key: 'canela', name: 'Canela', label: 'Canela, cerca de Gramado' },
  canela: { key: 'gram', name: 'Gramado', label: 'Gramado, cerca de Canela' }
};
// Respaldo cuando Booking.com no devuelve (o no alcanza) 3 opciones reales para
// la categoría elegida. Usa cadenas hoteleras reales con presencia amplia en
// Brasil por nivel de comodidad; el link de reserva siempre apunta a una
// búsqueda real y funcional de Booking.com para esa ciudad y esas fechas.
const HOTEL_TIER_FALLBACK = [
  { id: 'eco', label: 'Económico', brands: ['ibis budget', 'Selina', 'Che Lagarto Hostel'],
    desc: 'Habitaciones simples y funcionales, ideal para dormir bien gastando poco.' },
  { id: 'medio', label: 'Intermedio', brands: ['ibis', 'Travel Inn', 'Slaviero'],
    desc: 'Hotel 3 estrellas con buena ubicación y desayuno incluido.' },
  { id: 'confort', label: 'Confort', brands: ['Mercure', 'Golden Tulip', 'Blue Tree'],
    desc: 'Hotel 4 estrellas con más comodidades y mejor ubicación.' }
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
    destination: process.env.BOOKING_DESTINATION || 'Florianópolis'
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
    return {
      name: name,
      hotelId: String(hotel.hotel_id || hotel.hotelId || property.hotel_id || property.id || hotel.id || ''),
      image: image,
      total: total,
      perNight: hasNightly ? nightlyRaw : total / nights,
      currency: currency,
      rating: Number(property.reviewScore || property.review_score || hotel.review_score || hotel.rating || 0),
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
      highlight: ['Económico', 'Equilibrado', 'Cerca de tu presupuesto'][index],
      recommended: index === 0
    });
  });
}
function hotelBudgetTarget(destKey, style, extra) {
  const explicit = Number(extra && extra.hotelBudgetPerNight);
  if (extra && extra.hotelBudgetPerNight != null && Number.isFinite(explicit) && explicit >= 0) return Math.min(explicit, 1000000);
  const destination = model.DEST[destKey];
  const tierIndex = ({ ahorro: 0, eq: 1, comodo: 2 })[style] == null ? 1 : ({ ahorro: 0, eq: 1, comodo: 2 })[style];
  const perPerson = destination && Array.isArray(destination.lodge) ? Number(destination.lodge[tierIndex]) : 0;
  return Math.max(0, perPerson * Math.max(1, Number(extra && extra.pax) || 1));
}
async function bookingApiJson(url, settings) {
  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'x-rapidapi-key': settings.key, 'x-rapidapi-host': settings.host, Accept: 'application/json' }
    }, 9000);
  } catch (error) {
    throw new Error(error && error.name === 'AbortError' ? 'Booking API excedió el tiempo de espera.' : 'No se pudo conectar con Booking API.');
  }
  let payload;
  try { payload = await response.json(); } catch (error) { throw new Error('Booking API devolvió una respuesta JSON inválida.'); }
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
  const hotelName = String(destName || settings.destination || 'Florianópolis').trim();
  const dep = String((extra && extra.dep) || '').trim() || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const ret = String((extra && extra.ret) || '').trim() || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const adults = Math.max(1, Number((extra && extra.pax) || 1));
  const destinationUrl = new URL('/api/v1/hotels/searchDestination', 'https://' + settings.host);
  destinationUrl.searchParams.set('query', hotelName);
  destinationUrl.searchParams.set('locale', 'es');
  const destinationPayload = await bookingApiJson(destinationUrl.toString(), settings);
  const destinationRows = responseRows(destinationPayload);
  const target = destinationRows.find(function (item) { return item && /city/i.test(String(item.search_type || item.dest_type || '')); }) || destinationRows[0];
  if (!target || target.dest_id == null || !target.search_type) throw new Error('Booking API no encontró la ciudad "' + hotelName + '".');
  const params = new URLSearchParams({
    dest_id: String(target.dest_id), search_type: String(target.search_type),
    arrival_date: dep, departure_date: ret, adults: String(adults), room_qty: '1',
    page_number: '1', units: 'metric', languagecode: 'es', currency_code: 'USD'
  });
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

// Siempre debe haber exactamente 3 opciones alineadas a la categoría (tier)
// que el usuario eligió arriba (Económico / Intermedio / Confort). Se prioriza
// alojamiento real de Booking.com dentro del rango de precio de esa categoría;
// lo que falte para llegar a 3 se completa con el respaldo de cadenas reales.
async function hotelRecommendations(destKey, destName, style, extra) {
  const tierByStyle = { ahorro: 'eco', eq: 'moderado', comodo: 'alto' };
  const tierIndex = ({ ahorro: 0, eq: 1, comodo: 2 })[style] == null ? 1 : ({ ahorro: 0, eq: 1, comodo: 2 })[style];
  const selectedTier = tierByStyle[style] || 'moderado';
  const budgetTarget = hotelBudgetTarget(destKey, style, extra || {});
  let realHotels = [];
  try {
    realHotels = (await fetchBookingHotels(destKey, destName, selectedTier, extra || {})).map(function (hotel) { return Object.assign({}, hotel, { areaLabel: destName }); });
    if (realHotels.length < 3) {
      const nearby = HOTEL_NEARBY_DESTINATIONS[destKey] || null;
      if (nearby) {
        try {
          const regionalHotels = await fetchBookingHotels(nearby.key, nearby.name, selectedTier, extra || {});
          realHotels = realHotels.concat(regionalHotels.map(function (hotel) { return Object.assign({}, hotel, { areaLabel: nearby.label }); }));
        } catch (regionalError) {
          console.warn('[hotelRecommendations] Búsqueda regional no disponible:', regionalError && regionalError.message ? regionalError.message : regionalError);
        }
      }
    }
  } catch (error) {
    console.warn('[hotelRecommendations] Booking API no disponible:', error && error.message ? error.message : error);
    realHotels = [];
  }
  const priced = uniqueHotelList(realHotels.filter(function (hotel) { return hotel && hotel.name && Number(hotel.perNight) > 0; }));
  // Un hotel real más barato que el objetivo de la categoría sigue siendo válido
  // para esa categoría; lo que se descarta es lo que se pasa claramente de precio.
  const high = budgetTarget > 0 ? budgetTarget * 1.5 : Infinity;
  const matchingCategory = priced
    .filter(function (hotel) { return hotel.perNight <= high; })
    .sort(function (a, b) { return Math.abs(a.perNight - budgetTarget) - Math.abs(b.perNight - budgetTarget); })
    .slice(0, 3)
    .map(function (hotel) { return Object.assign({}, hotel, { tier: selectedTier, similar: [], areaLabel: hotel.areaLabel || destName }); });
  const missing = 3 - matchingCategory.length;
  const fallback = missing > 0 ? fallbackHotelsFor(destKey, destName, tierIndex, extra) : [];
  const combined = uniqueHotelList(matchingCategory.concat(fallback)).slice(0, 3);
  return combined.map(function (hotel, index) {
    return Object.assign({}, hotel, {
      tier: selectedTier,
      highlight: ['Recomendado', 'Buena opción', 'Alternativa'][index],
      recommended: index === 0
    });
  });
}

function adaptPackagesToStyle(result, trip, dep, ret, today) {
  const tierByStyle = { ahorro: 0, eq: 1, comodo: 2 };
  const tier = tierByStyle[trip.style] == null ? 1 : tierByStyle[trip.style];
  // Las propuestas no deben ofrecer ni conservar conexiones que impliquen
  // partir por Buenos Aires. Cuando la capa del estilo deja muy pocas opciones,
  // se rellena con alternativas válidas de otras categorías para mantener una
  // respuesta útil en modo demo y en búsquedas rápidas.
  const preferredCore = result.list.filter(function (proposal) { return proposal.mode !== 'avion_ba' && proposal.ti === tier; });
  // Para destinos donde ir en auto es una alternativa real (Florianópolis hacia
  // el sur), se suma como una propuesta comparable más en "Todas las
  // propuestas" -- sin tocar la recomendación, que sigue anclada a vuelo/bus
  // para no alterar el resto del flujo (cotización real de Duffel, transfer
  // desde el aeropuerto, etc.), pensado para llegar en avión o bus.
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
  // La recomendación (Gran total, hotel, etc.) siempre debe salir de la
  // categoría que el usuario eligió arriba, aunque el presupuesto no la
  // cubra del todo: rellenar `list` con otras categorías es solo para no
  // dejar la grilla de tarjetas vacía, nunca para elegir la propuesta.
  const picked = model.pick(trip, preferredCore.length ? preferredCore : list);
  const rec = picked.rec;
  const series = model.seriesFor(trip, rec, dep, ret, today);
  const cozy = list.slice().sort(function (a, b) { return b.comfort - a.comfort || a.total - b.total; })[0];
  const roadtripList = Array.isArray(result.roadtripList)
    ? result.roadtripList.filter(function (proposal) { return proposal.mode === 'auto'; }).slice().sort(function (a, b) { return a.total - b.total; }).slice(0, 3)
    : [];
  return Object.assign({}, result, {
    fits: picked.fits, recId: rec.id, cheapestId: list[0].id, cozyId: cozy.id,
    list: list, roadtripList: roadtripList, series: series, tips: model.tipsFor(trip, rec, list, series)
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

/* ---------- límite de pedidos por IP ---------- */
const hits = new Map();
function limited(ip) {
  const max = Number(process.env.RATE_LIMIT_PER_MIN) || 30;
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now > h.reset) { h = { n: 0, reset: now + 60000 }; hits.set(ip, h); }
  h.n++;
  if (hits.size > 5000) { hits.forEach(function (v, k) { if (now > v.reset) hits.delete(k); }); }
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
      catch (e) { e.status = 400; e.message = 'El cuerpo debe ser JSON válido.'; reject(e); }
    });
    req.on('error', reject);
  });
}

function registrarTransferencia(req, res, body) {
  body = body && typeof body === 'object' ? body : {};
  const amount = Number(body.amount);
  const file = body.receipt;
  if (!Number.isFinite(amount) || amount <= 0 || !file || !file.data) {
    return sendJson(res, 400, { error: 'Adjuntá el comprobante de transferencia.' });
  }
  if (String(file.data).length > 6e6) return sendJson(res, 413, { error: 'El comprobante supera el tamaño máximo permitido.' });
  // El comprobante se valida de forma administrativa; no exponemos ni pedimos
  // números de operación en la interfaz de transferencias.
  return sendJson(res, 201, { ok: true, status: 'Pendiente de verificación', message: '¡Reserva de traslado registrada con éxito! En menos de 2 horas validaremos tu comprobante y te enviaremos el voucher definitivo por correo electrónico.' });
}

async function buscarVuelos(req, res, body) {
  if (limited('vuelos:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const origin = String(body.origen || '').toUpperCase();
  const destination = AIR_DESTINATIONS[String(body.destino || '').toLowerCase()];
  const date = String(body.fecha_ida || '');
  const returnDate = String(body.fecha_vuelta || '');
  const passengers = Number(body.pasajeros);
  const style = ['ahorro', 'eq', 'comodo'].includes(String(body.style || '').toLowerCase()) ? String(body.style).toLowerCase() : 'eq';
  if (origin !== 'MVD' || !destination || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || (returnDate && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(returnDate)) || !Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return sendJson(res, 400, { error: 'Datos de búsqueda de vuelo inválidos.' });
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
    return sendJson(res, 200, { provider: 'duffel', origin: origin, destination: destination, style: style, cabin_fallback: usedFallback, offers: offers, error: offers.length ? null : 'No hay vuelos disponibles para esas fechas. Probá con otras fechas.' });
  } catch (e) {
    console.error('[Duffel vuelos]', e.message);
    return sendJson(res, e.status || 502, { provider: 'duffel', offers: [], error: e.message || 'No pudimos consultar disponibilidad de vuelos.' });
  }
}

// Una sola tarifa real de Duffel (1 pasajero, ida y vuelta) para anclar la
// propuesta recomendada y, con ella, toda la serie de "otra fecha" (que ya
// se calcula como el total recomendado + la variación estimada del modelo).
// Evita las N consultas que implicaría cotizar cada fecha o cada destino.
async function getLiveFlightQuote(destinationIata, dep, ret, style) {
  if (!duffel.isConfigured()) return null;
  const cabinClass = duffel.styleCabins(style)[0] || 'economy';
  const offers = await duffel.searchFlights({ origin: 'MVD', destination: destinationIata, departureDate: dep, returnDate: ret, passengers: 1, cabinClass: cabinClass });
  const priced = offers.filter(function (offer) { return Number.isFinite(offer.price_usd) && offer.price_usd > 0; });
  if (!priced.length) return null;
  const cheapest = priced.reduce(function (min, offer) { return offer.price_usd < min.price_usd ? offer : min; });
  return { pp: cheapest.price_usd, airline: cheapest.airline || null, exact: true, foundDep: dep, foundRet: ret, source: 'duffel' };
}

async function cotizar(req, res, url) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    v = model.validate(Object.fromEntries(url.searchParams), today);
  } catch (e) {
    return sendJson(res, e.status || 400, { error: e.message });
  }
  v.S.fuelPriceUsd = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;
  // La pantalla inicial anda con una tarifa real de Duffel para la ruta/fechas
  // elegidas cuando está disponible; si Duffel falla o no está configurado,
  // se cae de vuelta a la estimación local sin romper la respuesta.
  let quotes = {};
  let liveQuoteApplied = false;
  const destCfgForQuote = model.DEST[v.S.dest];
  if (destCfgForQuote && destCfgForQuote.modes.avion_mvd) {
    try {
      const quote = await getLiveFlightQuote(destCfgForQuote.iata, v.dep, v.ret, v.S.style);
      if (quote) { quotes = { avion_mvd: quote }; liveQuoteApplied = true; }
    } catch (e) {
      console.error('[cotizar] tarifa real de Duffel no disponible:', e.message);
    }
  }
  const result = adaptPackagesToStyle(model.compute(v.S, v.dep, v.ret, today, quotes), v.S, v.dep, v.ret, today);
  const recommendedProposal = result.list.find(function (proposal) { return proposal.id === result.recId; });
  const nonHotelCost = recommendedProposal ? Number(recommendedProposal.total) - Number(recommendedProposal.parts.alojamiento || 0) : 0;
  const hotelBudgetPerNight = url.searchParams.has('hotel_budget_per_night')
    ? Number(url.searchParams.get('hotel_budget_per_night'))
    : (v.S.budget > 0 ? Math.max(0, (v.S.budget - nonHotelCost) / Math.max(1, v.nights)) : null);
  const hotelExtra = { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, nights: v.nights };
  if (Number.isFinite(hotelBudgetPerNight) && hotelBudgetPerNight >= 0) hotelExtra.hotelBudgetPerNight = hotelBudgetPerNight;
  const localTransport = calculateLocalTransportCost({ style: v.S.style, dest: v.S.dest, nights: v.nights, pax: v.S.pax });
  sendJson(res, 200, Object.assign({
    meta: {
      mode: liveQuoteApplied ? 'live' : 'estimated',
      dest: { key: v.S.dest, name: model.DEST[v.S.dest].name },
      dep: v.S.dep, ret: v.S.ret, nights: v.nights, pax: v.S.pax, budget: v.S.budget, style: v.S.style,
      costBasis: Object.assign({}, model.REAL_COSTS, { destinationCosts: model.DESTINATION_COSTS }), roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax), localTransport: localTransport,
      hotels: [], hotelsPending: true, hotelBudgetPerNight: Number.isFinite(hotelBudgetPerNight) ? hotelBudgetPerNight : hotelBudgetTarget(v.S.dest, v.S.style, hotelExtra), hotelsNearby: '', generatedAt: new Date().toISOString()
    },
    localTransport: localTransport
  }, result));
}

async function cotizarHoteles(req, res, url) {
  if (limited('hoteles:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas de alojamiento. Esperá un minuto y probá de nuevo.' });
  let v;
  try { v = model.validate(Object.fromEntries(url.searchParams), model.getToday()); }
  catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
  const dest = model.DEST[v.S.dest];
  const rawBudget = url.searchParams.get('hotel_budget_per_night');
  const extra = { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, nights: v.nights };
  if (rawBudget !== null && Number.isFinite(Number(rawBudget)) && Number(rawBudget) >= 0) extra.hotelBudgetPerNight = Number(rawBudget);
  const hotels = await hotelRecommendations(v.S.dest, dest.name, v.S.style, extra);
  return sendJson(res, 200, {
    hotels: hotels,
    hotelBudgetPerNight: hotelBudgetTarget(v.S.dest, v.S.style, extra),
    hotelsNearby: (hotels.find(function (hotel) { return hotel.areaLabel && hotel.areaLabel !== dest.name; }) || {}).areaLabel || ''
  });
}

function cotizarTodos(req, res, url) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    // La validación del viaje es compartida con la cotización individual; el
    // destino de referencia solo satisface ese validador y luego se reemplaza.
    v = model.validate(Object.assign({}, Object.fromEntries(url.searchParams), { dest: 'fln' }), today);
  } catch (e) {
    return sendJson(res, e.status || 400, { error: e.message });
  }
  v.S.fuelPriceUsd = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;

  const localTransport = calculateLocalTransportCost({ style: v.S.style, dest: v.S.dest, nights: v.nights, pax: v.S.pax });

  // Estas diez opciones son comparables y estimadas: consultar el proveedor para
  // cada destino dispararía hasta 19 requests externos en un solo clic.
  const options = Object.keys(model.DEST).map(function (key) {
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
    meta: { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, budget: v.S.budget, style: v.S.style, mode: 'estimated', costBasis: Object.assign({}, model.REAL_COSTS, { destinationCosts: model.DESTINATION_COSTS }), roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax), localTransport: localTransport },
    options: options,
    localTransport: localTransport
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && file.indexOf(PUBLIC_DIR + path.sep) !== 0) { res.writeHead(403); return res.end('Prohibido'); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache', 'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
    });
    res.end(data);
  });
}

function createServer() {
  return http.createServer(function (req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
    if (req.method === 'POST' && url.pathname === '/api/vuelos/buscar') {
      return readJson(req).then(function (body) { return buscarVuelos(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos leer la búsqueda.' });
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/vuelos/comprar') {
      if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
      return sendJson(res, 410, { error: 'La reserva de vuelos se gestiona directamente con Duffel.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/traslados/transferencia') {
      return readJson(req, 6 * 1024 * 1024).then(function (body) { return registrarTransferencia(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos registrar la transferencia.' });
      });
    }
    if (req.method === 'POST') { res.writeHead(404); return res.end(); }
    if (url.pathname === '/api/destinos') {
      return sendJson(res, 200, Object.keys(model.DEST).map(function (k) { return { key: k, name: model.DEST[k].name }; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); }));
    }
    if (url.pathname === '/api/config') {
      return sendJson(res, 200, {
        supabaseUrl: process.env.SUPABASE_URL || 'https://hqyzmeordvjccytgltse.supabase.co',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      });
    }
    if (url.pathname === '/api/cotizar') {
      return cotizar(req, res, url).catch(function (e) {
        console.error('[cotizar]', e);
        sendJson(res, 500, { error: 'Error inesperado. Probá de nuevo en un momento.' });
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
    try { serveStatic(req, res, url.pathname); } catch (e) { res.writeHead(400); res.end(); }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, function () {
    console.log('CuántoSale en http://localhost:' + port + ' (' + (duffel.isConfigured() ? 'búsqueda Duffel configurada' : 'Duffel sin configurar; se mostrará un aviso controlado') + ')');
  });
}

const app = createServer();
module.exports = app;
// Vercel consume la función `app`; exponer el factory permite levantar un
// servidor aislado en las pruebas sin alterar el handler desplegado.
module.exports.createServer = createServer;
module.exports.hotelRecommendations = hotelRecommendations;
module.exports.fetchBookingHotels = fetchBookingHotels;
module.exports.normalizeHotelApiResponse = normalizeHotelApiResponse;
module.exports.selectThreeHotelsByBudget = selectThreeHotelsByBudget;
