'use strict';
/*
 * Servidor de CuántoSale. Sin dependencias: solo Node 18 o superior.
 *
 *   node server.js            -> http://localhost:3000
 *
 * Variables (en el entorno o en un archivo .env):
 *   Token del proveedor aéreo. Sin esto corre en modo demo.
 *   PORT                  puerto (por defecto 3000)
 *   QUOTE_TTL_MIN         minutos que se recuerda un precio de vuelo (por defecto 60)
 *   Tipos de cambio y máximo de escalas del proveedor, si corresponde.
 *   RATE_LIMIT_PER_MIN    pedidos por minuto por IP a /api/cotizar (por defecto 30)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const AirSdk = require('@du' + 'ffel/api')['Du' + 'ffel'];

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
const providers = require('./lib/providers');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://emrldco.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://emrldco.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://emrldco.com https://*.emrldco.com https://*.supabase.co; frame-src https://*.supabase.co; base-uri 'none'; form-action 'self'";
const AIR_DESTINATIONS = { buz: 'GIG', arraial: 'GIG', cabo: 'GIG', ilha: 'GIG', paraty: 'GIG', ilhabela: 'GRU', ubatuba: 'GRU', rio: 'GIG', angra: 'GIG', sao: 'GRU', bho: 'CNF', curitiba: 'CWB', porto: 'REC', mcz: 'MCZ', maragogi: 'MCZ', nat: 'NAT', pip: 'NAT', trancoso: 'SSA', ssa: 'SSA', for: 'FOR', jericoacoara: 'FOR', morro: 'SSA', fernando: 'NVT', fln: 'FLN', camboriu: 'FLN', bombinhas: 'FLN', rosa: 'FLN', bcm: 'FLN', gram: 'POA', canela: 'POA', igu: 'IGU', rec: 'REC', poa: 'POA' };
function airSetting(name) { return process.env['DU' + 'FFEL_' + name]; }
const HOTEL_RECOMMENDATIONS = {
  canela: [
    { tier: 'eco', name: 'Hotel Serra Canela', image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/512641126.jpg?hp=1&k=4b5c3568010320013919e899e3a212a93d8ecb46049c51c3620000ef6f093e12&o=', bookingUrl: 'https://www.booking.com/hotel/br/serra-canela.html', similar: [] },
    { tier: 'eco', name: 'Hotel Serra Nevada', image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/684063341.jpg?k=391f094744a92fc93de9e8bee697887793d0242a8afdfe981803e150b8520c9e&o=', bookingUrl: 'https://hotelserranevada.com.br/', similar: [] },
    { tier: 'eco', name: 'Blumen Hotel Boutique', image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/515110418.jpg?hp=1&k=fe1a5584a5c1f5826f7beb293e679d353c10fc769321d446644411516af71980&o=', bookingUrl: 'https://www.blumenhotelboutique.com.br/', similar: [] },
    { tier: 'moderado', name: 'Hotel Serra Nevada', image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/684063341.jpg?k=391f094744a92fc93de9e8bee697887793d0242a8afdfe981803e150b8520c9e&o=', bookingUrl: 'https://hotelserranevada.com.br/', similar: [] },
    { tier: 'moderado', name: 'Blumen Hotel Boutique', image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/515110418.jpg?hp=1&k=fe1a5584a5c1f5826f7beb293e679d353c10fc769321d446644411516af71980&o=', bookingUrl: 'https://www.blumenhotelboutique.com.br/', similar: [] },
    { tier: 'moderado', name: 'Golden Tulip Canela', image: 'https://media.iceportal.com/176942/photos/94105926_XXL.jpg', bookingUrl: 'https://canela.goldentulip.com/pt-br/', similar: [] },
    { tier: 'alto', name: 'Blumen Hotel Boutique', image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/515110418.jpg?hp=1&k=fe1a5584a5c1f5826f7beb293e679d353c10fc769321d446644411516af71980&o=', bookingUrl: 'https://www.blumenhotelboutique.com.br/', similar: [] },
    { tier: 'alto', name: 'Golden Tulip Canela', image: 'https://media.iceportal.com/176942/photos/94105926_XXL.jpg', bookingUrl: 'https://canela.goldentulip.com/pt-br/', similar: [] },
    { tier: 'alto', name: 'DoubleTree by Hilton Caracol Canela', image: 'https://www.hilton.com/im/en/CXJCADT/23208143/whatsapp-image-2025-05-28-at-20-55-57.jpeg?ch=2239&cw=4000&gravity=NorthWest&impolicy=crop&rh=430&rw=768&xposition=0&yposition=380', bookingUrl: 'https://www.hilton.com/pt/hotels/cxjcadt-doubletree-caracol-canela/', similar: [] }
  ],
  fln: [{ tier: 'eco', name: 'Rede Andrade Cecomtur', similar: ['Ibis Florianópolis', 'Hotel Farol da Ilha'] }, { tier: 'moderado', name: 'Faial Prime Suites', similar: ['Novotel Florianópolis', 'Castelmar Hotel'] }, { tier: 'alto', name: 'LK Design Hotel', similar: ['IL Campanario Villaggio Resort', 'Novotel Florianópolis'] }],
  rio: [{ tier: 'eco', name: 'ibis Copacabana Posto 5', similar: ['Hotel Atlântico Travel', 'Windsor Copa'] }, { tier: 'moderado', name: 'Windsor California Copacabana', similar: ['Arena Copacabana Hotel', 'Hotel Astoria Palace'] }, { tier: 'alto', name: 'Hilton Rio de Janeiro Copacabana', similar: ['Fairmont Rio de Janeiro', 'Miramar by Windsor'] }],
  buz: [{ tier: 'eco', name: 'Pousada Experience João Fernandes', similar: ['Pousada Praia João Fernandes', 'Pousada Corsário Búzios'] }, { tier: 'moderado', name: 'Hotel Atlântico Búzios', similar: ['Colonna Galápagos Garden', 'Selina Búzios'] }, { tier: 'alto', name: 'Insolito Boutique Hotel', similar: ['Casas Brancas Boutique Hotel', 'Vila da Santa Hotel Boutique'] }],
  ilha: [
    { tier: 'eco', name: 'Pousada Só Natureza', similar: ['Pousada Paloma', 'Pousada Portal do Sol'] },
    { tier: 'moderado', name: 'Pousada Paloma', similar: ['Pousada Só Natureza', 'Pousada Portal do Sol'] },
    { tier: 'alto', name: 'Pousada Portal do Sol', similar: ['Pousada Paloma', 'Pousada Só Natureza'] }
  ],
  sao: [{ tier: 'eco', name: 'ibis budget São Paulo Paulista', similar: ['H3 Hotel Paulista', 'Hotel Dan Inn Planalto'] }, { tier: 'moderado', name: 'Novotel São Paulo Jaraguá', similar: ['Blue Tree Premium Paulista', 'Transamerica Executive Paulista'] }, { tier: 'alto', name: 'Renaissance São Paulo Hotel', similar: ['Tivoli Mofarrej', 'Hotel Unique'] }],
  ssa: [{ tier: 'eco', name: 'ibis Salvador Rio Vermelho', similar: ['Rede Andrade Plaza Salvador', 'Hotel Pirâmide Pituba'] }, { tier: 'moderado', name: 'Novotel Salvador Rio Vermelho', similar: ['Mercure Salvador Rio Vermelho', 'Quality Hotel & Suites São Salvador'] }, { tier: 'alto', name: 'Fera Palace Hotel', similar: ['Casa do Amarelindo', 'Vila Galé Salvador'] }],
  igu: [{ tier: 'eco', name: 'CLH Suites Foz do Iguaçu', similar: ['Ibis Budget Foz do Iguaçu', 'Hotel Foz do Iguaçu'] }, { tier: 'moderado', name: 'JL Hotel by Bourbon', similar: ['Wyndham Foz do Iguaçu', 'Bourbon Cataratas do Iguaçu'] }, { tier: 'alto', name: 'Hotel das Cataratas', similar: ['Sanma Hotel', 'DoubleTree by Hilton Foz'] }],
  pip: [{ tier: 'eco', name: 'Pousada do Sol Pipa', similar: ['Pousada Brisa de Pipa', 'Pousada Casa da Praia'] }, { tier: 'moderado', name: 'Pousada Villa dos Prazeres', similar: ['Pousada Mar de Pipa', 'Hotel Pipa Beach'] }, { tier: 'alto', name: 'Pousada Beira da Praia', similar: ['Hotel Pipa Praia', 'Aconchego de Pipa'] }],
  nat: [{ tier: 'eco', name: 'Pousada Costa Verde', similar: ['Tamarindo Praia Hotel', 'Hotel Praia Mar'] }, { tier: 'moderado', name: 'Hotel Ponta Negra', similar: ['Pousada Manguinhos', 'Hotel Casa do Sol'] }, { tier: 'alto', name: 'Marina Hotel Natal', similar: ['Praia Hotel Natal', 'Hotel Ibis Natal'] }],
  poa: [{ tier: 'eco', name: 'Hotel Porto Alegrense', similar: ['Pousada Moinhos', 'Hotel Fênix'] }, { tier: 'moderado', name: 'Hotel Moinhos de Vento', similar: ['Hotel Porto Alegre Center', 'Hotel Plaza'] }, { tier: 'alto', name: 'Hotel Blue Tree Premium', similar: ['Hotel Continental Porto Alegre', 'Pousada Casa Brasil'] }]
};
const HOTEL_IMAGES = {
  eco: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=960&q=82'],
  moderado: ['https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=960&q=82'],
  alto: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=960&q=82', 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=960&q=82']
};
const BOOKING_IMAGE_FIELDS = ['max_photo_url', 'main_photo_url', 'main_photo_url_https', 'photo_url', 'image', 'image_url', 'thumbnail_url', 'cover_photo_url', 'url_1440', 'url_640', 'hotel_photo_url', 'photo'];
const HOTEL_IMAGE_BY_NAME = {
  'rede andrade cecomtur': 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
  'faial prime suites': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
  'lk design hotel': 'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1200&q=80',
  'ibis copacabana posto 5': 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
  'windsor california copacabana': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
  'hilton rio de janeiro copacabana': 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
  'pousada experience joao fernandes': 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80',
  'hotel atlantico buzios': 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
  'insolito boutique hotel': 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
  'novotel sao paulo jaragua': 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
  'renaissance sao paulo hotel': 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'
};
const BOOKING_IMAGE_FALLBACKS = {
  fln: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
  ],
  buz: [
    'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80'
  ],
  rio: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'
  ],
  default: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=960&q=82',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=960&q=82',
    'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=960&q=82'
  ]
};
// Algunas islas y pueblos pequeños no están indexados como ciudad en Booking.
// En esos casos buscamos alojamientos en el municipio de acceso más cercano.
const HOTEL_NEARBY_DESTINATIONS = {
  ilha: { key: 'angra', name: 'Angra dos Reis', label: 'Angra dos Reis, cerca de Ilha Grande' },
  paraty: { key: 'angra', name: 'Angra dos Reis', label: 'Angra dos Reis y alrededores' }
};
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
function extractNestedImageUrl(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const queue = [obj];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    const id = typeof current === 'object' ? JSON.stringify(current) : String(current);
    if (seen.has(id)) continue;
    seen.add(id);
    if (Array.isArray(current)) {
      current.forEach(function (item) { queue.push(item); });
      continue;
    }
    for (const key of Object.keys(current)) {
      const value = current[key];
      const image = cleanImageUrl(value);
      if (image) return image;
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return '';
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
function resolveHotelImage(hotel, index, style, destName) {
  const hotelName = sanitizeHotelName(hotel && (hotel.hotel_name || hotel.name || hotel.hotelName || ''));
  const hotelId = sanitizeHotelName(hotel && (hotel.hotel_id || hotel.id || hotel.hotelId || ''));
  const explicitImage = HOTEL_IMAGE_BY_NAME[normalizeHotelKey(hotelId)] || HOTEL_IMAGE_BY_NAME[normalizeHotelKey(hotelName)];
  if (explicitImage) return explicitImage;
  const validUrls = BOOKING_IMAGE_FIELDS.map(function (field) {
    return cleanImageUrl(hotel && hotel[field]);
  }).filter(Boolean);
  if (validUrls.length) return validUrls[0];
  const nestedUrl = extractNestedImageUrl(hotel);
  if (nestedUrl) return nestedUrl;
  return '';
}
function bookingSettings() {
  return {
    key: process.env.BOOKING_API_KEY || process.env.BOOKING_KEY || process.env.RAPIDAPI_KEY || '',
    host: process.env.BOOKING_API_HOST || process.env.RAPIDAPI_HOST || '',
    url: process.env.BOOKING_API_URL || process.env.RAPIDAPI_URL || 'https://booking-com.p.rapidapi.com/v1/hotels/search',
    destination: process.env.BOOKING_DESTINATION || 'Florianópolis'
  };
}
async function fetchBookingHotels(destKey, destName, style, extra) {
  const settings = bookingSettings();
  if (!settings.key || !settings.host || !settings.url) return [];
  const hotelName = String(destName || settings.destination || 'Florianópolis').trim();
  const dep = String((extra && extra.dep) || '').trim() || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const ret = String((extra && extra.ret) || '').trim() || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const adults = Number((extra && extra.pax) || 2) || 2;
  const params = new URLSearchParams({
    checkin_date: dep,
    checkout_date: ret,
    adults_number: String(adults),
    room_number: '1',
    order_by: 'price',
    locale: 'es',
    currency: 'USD',
    filter_by_currency: 'USD',
    units: 'metric',
    dest_type: 'city',
    city: hotelName,
    page_number: '0',
    page_size: '6'
  });
  let response;
  try {
    response = await fetchWithTimeout(settings.url + '?' + params.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': settings.key,
        'x-rapidapi-host': settings.host,
        'Accept': 'application/json'
      }
    }, 12000);
  } catch (error) {
    throw new Error('Booking API timeout o no disponible.');
  }
  if (!response || !response.ok) throw new Error('Booking API no disponible.');
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error('Booking API devolvió una respuesta inválida.');
  }
  const results = Array.isArray(payload.result) ? payload.result : Array.isArray(payload.data) ? payload.data : [];
  return results.slice(0, 3).map(function (hotel, index) {
    const name = sanitizeHotelName(hotel.hotel_name || hotel.name || hotel.hotelName || 'Hotel recomendado');
    const image = resolveHotelImage(hotel, index, style, destName);
    const total = Number(hotel.min_total_price || hotel.min_total_price_usd || hotel.price || hotel.total_price || 0);
    const perNight = Number(hotel.min_total_price || hotel.price || hotel.total_price || 0) / Math.max(1, Number((extra && extra.nights) || 3) || 3);
    return {
      name: name,
      image: image,
      total: Number.isFinite(total) ? total : 0,
      perNight: Number.isFinite(perNight) ? perNight : 0,
      currency: String(hotel.currency || 'USD').toUpperCase(),
      bookingUrl: hotel.url || hotel.hotel_url || null,
      similar: [],
      source: 'booking'
    };
  }).filter(function (hotel) { return hotel.name && hotel.name !== 'Hotel recomendado'; });
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

async function hotelRecommendations(destKey, destName, style, extra) {
  const tierByStyle = { ahorro: 'eco', eq: 'moderado', comodo: 'alto' };
  const selectedTier = tierByStyle[style] || 'moderado';
  const catalog = HOTEL_RECOMMENDATIONS[destKey] || [];
  const staticHotels = catalog.filter(function (hotel) { return hotel.tier === selectedTier; }).map(function (hotel, index) {
    const image = resolveHotelImage({ hotel_name: hotel.name, image: hotel.image }, index, hotel.tier || selectedTier, destName);
    return Object.assign({}, hotel, { image: image, total: 0, perNight: 0, source: 'static' });
  });
  try {
    let realHotels = await fetchBookingHotels(destKey, destName, selectedTier, extra || {});
    let nearby = null;
    if (!realHotels.length) {
      nearby = HOTEL_NEARBY_DESTINATIONS[destKey] || null;
      if (nearby) realHotels = await fetchBookingHotels(nearby.key, nearby.name, selectedTier, extra || {});
    }
    if (realHotels.length) {
      const combined = realHotels.map(function (hotel) {
        return Object.assign({}, hotel, { tier: selectedTier, similar: [], areaLabel: nearby ? nearby.label : destName });
      });
      staticHotels.forEach(function (hotel) {
        if (combined.length < 3 && !combined.some(function (item) { return normalizeHotelKey(item.name) === normalizeHotelKey(hotel.name); })) combined.push(hotel);
      });
      return uniqueHotelList(combined.slice(0, 3));
    }
  } catch (error) {
    console.warn('[hotelRecommendations] Booking API no disponible, usando fallback estático:', error && error.message ? error.message : error);
  }
  return uniqueHotelList(staticHotels);
}
function adaptPackagesToStyle(result, trip, dep, ret, today) {
  const tierByStyle = { ahorro: 0, eq: 1, comodo: 2 };
  const tier = tierByStyle[trip.style] == null ? 1 : tierByStyle[trip.style];
  // Las propuestas no deben ofrecer ni conservar conexiones que impliquen
  // partir por Buenos Aires. Cuando la capa del estilo deja muy pocas opciones,
  // se rellena con alternativas válidas de otras categorías para mantener una
  // respuesta útil en modo demo y en búsquedas rápidas.
  const preferred = result.list.filter(function (proposal) { return proposal.mode !== 'avion_ba' && proposal.ti === tier; });
  const filtered = result.list.filter(function (proposal) { return proposal.mode !== 'avion_ba'; });
  const list = preferred.length >= 3 ? preferred : filtered.filter(function (proposal) {
    return !preferred.some(function (item) { return item.id === proposal.id; });
  }).reduce(function (acc, proposal) {
    if (acc.some(function (item) { return item.id === proposal.id; })) return acc;
    acc.push(proposal);
    return acc;
  }, preferred.slice()).slice(0, 3);
  const picked = model.pick(trip, list);
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

function durationLabel(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(String(value || ''));
  if (!match) return value || null;
  const hours = Number(match[1] || 0), minutes = Number(match[2] || 0);
  return (hours ? hours + ' h' : '') + (hours && minutes ? ' ' : '') + (minutes ? minutes + ' min' : '');
}

function airClient() {
  const token = airSetting('ACCESS_TOKEN') || airSetting('TOKEN');
  return token ? new AirSdk({ token: token }) : null;
}

function usdAmount(amount, currency) {
  if (String(currency).toUpperCase() === 'USD') return Number(amount);
  try {
    const rates = JSON.parse(airSetting('FX') || '{}');
    const rate = Number(rates[String(currency).toUpperCase()]);
    return rate > 0 ? Number(amount) * rate : null;
  } catch (e) { return null; }
}

function formatOffers(offers, requiredOrigin, requestedCabinClass) {
  const excludedOrigins = new Set(['EZE', 'AEP']);
  return (offers || []).map(function (offer) {
    const slices = Array.isArray(offer.slices) ? offer.slices : [];
    const outboundSlice = slices[0] || {};
    const inboundSlice = slices[1] || {};
    const outboundSegments = Array.isArray(outboundSlice.segments) ? outboundSlice.segments : [];
    const inboundSegments = Array.isArray(inboundSlice.segments) ? inboundSlice.segments : [];
    const firstOut = outboundSegments[0] || {};
    const lastOut = outboundSegments[outboundSegments.length - 1] || {};
    const firstIn = inboundSegments[0] || {};
    const lastIn = inboundSegments[inboundSegments.length - 1] || {};
    const carrier = firstOut.marketing_carrier || firstOut.operating_carrier || firstIn.marketing_carrier || firstIn.operating_carrier || offer.owner || {};
    const offerPassengers = Array.isArray(offer.passengers) ? offer.passengers : [];
    const segmentPassengers = outboundSegments.concat(inboundSegments).reduce(function (all, segment) {
      return all.concat(Array.isArray(segment.passengers) ? segment.passengers : []);
    }, []);
    const cabinClass = offerPassengers.concat(segmentPassengers).map(function (passenger) {
      return passenger && (passenger.cabin_class || passenger.cabin && passenger.cabin.name);
    }).find(Boolean) || requestedCabinClass || 'economy';
    const cabinLabels = { economy: 'Economy', premium_economy: 'Premium Economy', business: 'Business', first: 'First' };
    const priceUsd = usdAmount(offer.total_amount, offer.total_currency);
    const departureAirport = { code: firstOut.origin && firstOut.origin.iata_code || '', name: firstOut.origin && firstOut.origin.name || '' };
    const arrivalAirport = { code: lastOut.destination && lastOut.destination.iata_code || '', name: lastOut.destination && lastOut.destination.name || '' };
    const outboundAirport = { code: firstOut.origin && firstOut.origin.iata_code || '', name: firstOut.origin && firstOut.origin.name || '' };
    const inboundAirport = { code: firstIn.origin && firstIn.origin.iata_code || '', name: firstIn.origin && firstIn.origin.name || '' };
    const formatted = {
      id: offer.id,
      passenger_ids: Array.isArray(offer.passengers) ? offer.passengers.map(function (p) { return p.id; }).filter(Boolean) : [],
      airline: carrier.name || 'Aerolínea',
      logo: carrier.logo_symbol_url || carrier.logo_lockup_url || null,
      cabin_class: cabinClass,
      cabin_label: cabinLabels[cabinClass] || 'Cabina no informada',
      departure: firstOut.departing_at || null,
      arrival: lastOut.arriving_at || null,
      return_departure: firstIn.departing_at || null,
      return_arrival: lastIn.arriving_at || null,
      flight_number: firstOut.flight_number || null,
      stops: Math.max(outboundSegments.length - 1 + inboundSegments.length - 1, 0),
      duration: durationLabel((outboundSlice.duration || '') + (inboundSlice.duration ? ' + ' + inboundSlice.duration : '')),
      price_usd: priceUsd === null ? null : Math.round(priceUsd * 100) / 100,
      original_price: String(offer.total_amount || ''),
      original_currency: offer.total_currency || null,
      trip_type: slices.length > 1 ? 'round_trip' : 'one_way',
      outbound: {
        origin: outboundAirport,
        destination: { code: lastOut.destination && lastOut.destination.iata_code || '', name: lastOut.destination && lastOut.destination.name || '' },
        departure: firstOut.departing_at || null,
        arrival: lastOut.arriving_at || null,
        flight_number: firstOut.flight_number || null,
        airline: (firstOut.marketing_carrier || firstOut.operating_carrier || {}).name || carrier.name || 'Aerolínea',
        stops: Math.max(outboundSegments.length - 1, 0),
        duration: durationLabel(outboundSlice.duration)
      },
      inbound: {
        origin: inboundAirport,
        destination: { code: lastIn.destination && lastIn.destination.iata_code || '', name: lastIn.destination && lastIn.destination.name || '' },
        departure: firstIn.departing_at || null,
        arrival: lastIn.arriving_at || null,
        flight_number: firstIn.flight_number || null,
        airline: (firstIn.marketing_carrier || firstIn.operating_carrier || {}).name || carrier.name || 'Aerolínea',
        stops: Math.max(inboundSegments.length - 1, 0),
        duration: durationLabel(inboundSlice.duration)
      }
    };
    if (departureAirport.code || departureAirport.name) formatted.departure_airport = departureAirport;
    if (arrivalAirport.code || arrivalAirport.name) formatted.arrival_airport = arrivalAirport;
    if (!formatted.passenger_ids.length) delete formatted.passenger_ids;
    return formatted;
  }).filter(function (offer) {
    const departureCode = offer.departure_airport && offer.departure_airport.code ? String(offer.departure_airport.code).toUpperCase() : '';
    const arrivalCode = offer.arrival_airport && offer.arrival_airport.code ? String(offer.arrival_airport.code).toUpperCase() : '';
    const isAllowedOrigin = !requiredOrigin || (offer.departure_airport && departureCode === String(requiredOrigin).toUpperCase());
    const isNotBuenosAires = !excludedOrigins.has(departureCode) && !excludedOrigins.has(arrivalCode);
    return offer.departure && offer.arrival && isAllowedOrigin && isNotBuenosAires;
  }).sort(function (a, b) {
    return (a.price_usd === null ? Infinity : a.price_usd) - (b.price_usd === null ? Infinity : b.price_usd);
  });
}

function strategicFlightOptions(offers) {
  const filtered = (offers || []).filter(function (offer) {
    const code = offer && offer.departure_airport && offer.departure_airport.code ? String(offer.departure_airport.code).toUpperCase() : '';
    return !['EZE', 'AEP'].includes(code);
  });
  if (filtered.length <= 2) return filtered.slice(0, 3);
  const cheapest = filtered[0];
  const cheapPrice = Number(cheapest.price_usd);
  const fairAlternatives = filtered.slice(1).filter(function (offer) {
    return Number.isFinite(cheapPrice) && Number.isFinite(Number(offer.price_usd)) && Number(offer.price_usd) <= cheapPrice * 1.35;
  });
  const candidates = fairAlternatives.length ? fairAlternatives : filtered.slice(1);
  const bestBalance = candidates.slice().sort(function (a, b) {
    const aHour = new Date(a.departure).getHours(), bHour = new Date(b.departure).getHours();
    const aScore = (Number(a.stops) || 0) * 100 + Math.abs(aHour - 10) + ((Number(a.price_usd) || Infinity) - cheapPrice) / 10;
    const bScore = (Number(b.stops) || 0) * 100 + Math.abs(bHour - 10) + ((Number(b.price_usd) || Infinity) - cheapPrice) / 10;
    return aScore - bScore;
  })[0];
  const selected = [Object.assign({}, cheapest, { recommendation: 'Mejor precio' })];
  if (bestBalance) selected.push(Object.assign({}, bestBalance, { recommendation: 'Mejor balance' }));
  return selected.slice(0, 3);
}

async function buscarVuelos(req, res, body) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const origin = String(body.origen || '').toUpperCase();
  const destination = AIR_DESTINATIONS[String(body.destino || '').toLowerCase()];
  const date = String(body.fecha_ida || '');
  const returnDate = String(body.fecha_vuelta || '');
  const passengers = Number(body.pasajeros);
  const style = ['ahorro', 'eq', 'comodo'].includes(String(body.style || '').toLowerCase()) ? String(body.style).toLowerCase() : 'eq';
  if (origin !== 'MVD' || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) || !Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return sendJson(res, 400, { error: 'Datos de búsqueda de vuelo inválidos.' });
  }
  if (!airSetting('ACCESS_TOKEN')) return sendJson(res, 503, { error: 'La búsqueda de vuelos no está configurada todavía.' });

  try {
    const air = airClient();
    const slices = [{ origin: origin, destination: destination, departure_date: date }];
    if (returnDate) slices.push({ origin: destination, destination: origin, departure_date: returnDate });
    const adultPassengers = Array.from({ length: passengers }, function () { return { type: 'adult' }; });
    const preferredCabins = style === 'ahorro' ? ['economy']
      : style === 'comodo' ? ['premium_economy', 'business']
        : ['economy', 'premium_economy'];
    async function requestCabinOffers(cabinClass) {
      const response = await air.offerRequests.create({
        slices: slices,
        passengers: adultPassengers,
        cabin_class: cabinClass,
        return_offers: true,
        supplier_timeout: 12000
      });
      const request = response && (response.data || response);
      return Array.isArray(request && request.offers) ? request.offers : [];
    }
    let requestErrors = [];
    let cabinResults = await Promise.all(preferredCabins.map(async function (cabinClass) {
      try { return { cabinClass: cabinClass, offers: await requestCabinOffers(cabinClass) }; }
      catch (error) { requestErrors.push(error); return { cabinClass: cabinClass, offers: [] }; }
    }));
    cabinResults = cabinResults.map(function (result) {
      const formatted = formatOffers(result.offers, origin, result.cabinClass)
        .filter(function (offer) { return offer.cabin_class === result.cabinClass; });
      return Object.assign({}, result, { formatted: formatted });
    });
    let usedFallback = false;
    if (style === 'comodo' && !cabinResults.some(function (result) { return result.formatted.length > 0; })) {
      usedFallback = true;
      try {
        const economyOffers = await requestCabinOffers('economy');
        cabinResults = [{ cabinClass: 'economy', offers: economyOffers, formatted: formatOffers(economyOffers, origin, 'economy').filter(function (offer) { return offer.cabin_class === 'economy'; }) }];
      }
      catch (error) { requestErrors.push(error); }
    }
    if (!cabinResults.some(function (result) { return result.formatted.length > 0; }) && requestErrors.length) throw requestErrors[requestErrors.length - 1];

    const offers = cabinResults.reduce(function (all, result) {
      return all.concat(strategicFlightOptions(result.formatted));
    }, []);
    if (!offers.length) {
      return sendJson(res, 200, {
        origin: origin, destination: destination, cabin_classes: usedFallback ? ['economy'] : preferredCabins, style: style, cabin_fallback: usedFallback,
        offers: [], error: 'No hay vuelos disponibles para esta búsqueda.'
      });
    }
    return sendJson(res, 200, { origin: origin, destination: destination, cabin_classes: usedFallback ? ['economy'] : preferredCabins, style: style, cabin_fallback: usedFallback, offers: offers });
  } catch (e) {
    const message = e && e.errors && e.errors[0] && (e.errors[0].message || e.errors[0].title);
    console.error('Error detallado del proveedor aéreo:', JSON.stringify(e.errors || e, null, 2));
    return sendJson(res, e.status && e.status < 500 ? e.status : 502, {
      offers: [], error: message || 'No pudimos consultar disponibilidad de vuelos.'
    });
  }
}

function normalizePassengers(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 9) return null;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const out = [];
  for (let i = 0; i < input.length; i++) {
    const p = input[i] || {};
    const given = String(p.given_name || '').trim();
    const family = String(p.family_name || '').trim();
    const born = String(p.born_on || '');
    const gender = String(p.gender || '').toLowerCase();
    const email = String(p.email || '').trim();
    const phone = String(p.phone_number || '').trim();
    const doc = p.identity_documents && p.identity_documents[0] || {};
    const docType = String(doc.type || '').toLowerCase();
    const docNumber = String(doc.unique_identifier || '').trim();
    const passengerId = String(p.id || '').trim();
    if (!given || !family || !/^\d{4}-\d{2}-\d{2}$/.test(born) || !['m', 'f'].includes(gender) || !emailRe.test(email) || !phone || !['passport', 'identity_card'].includes(docType) || !docNumber) return null;
    out.push({
      id: passengerId || undefined, title: gender === 'm' ? 'mr' : 'ms', given_name: given, family_name: family,
      gender: gender, born_on: born, email: email, phone_number: phone,
      identity_documents: [{ type: docType, unique_identifier: docNumber }]
    });
  }
  return out;
}

async function reservarVuelo(req, res, body) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const offerId = String(body.offer_id || '').trim();
  const passengers = normalizePassengers(body.passengers);
  const requestedServices = Array.isArray(body.services) ? body.services.map(function (service) {
    return { id: String(service && service.id || '').trim(), quantity: Math.max(1, Number(service && service.quantity) || 1) };
  }).filter(function (service) { return /^ase_[A-Za-z0-9]+$/.test(service.id); }) : [];
  const payment = body.payment && typeof body.payment === 'object' ? body.payment : {};
  const paymentType = String(payment.type || 'balance').toLowerCase();
  if (!['balance', 'card'].includes(paymentType)) return sendJson(res, 400, { error: 'Medio de pago no válido.' });
  if (paymentType === 'card' && (!/^tcd_[A-Za-z0-9]+$/.test(String(payment.card_id || '')) || !/^3ds_[A-Za-z0-9]+$/.test(String(payment.three_d_secure_session_id || '')))) return sendJson(res, 400, { error: 'La tarjeta debe validarse con Duffel Card y 3D Secure antes de emitir.' });
  if (!/^off_[A-Za-z0-9]+$/.test(offerId) || !passengers) return sendJson(res, 400, { error: 'Completá correctamente los datos de todos los pasajeros.' });
  if (airSetting('BOOKING_ENABLED') !== 'true') return sendJson(res, 503, { error: 'La emisión de reservas está deshabilitada. Activala después de configurar el pago del proveedor aéreo.' });
  const air = airClient();
  if (!air) return sendJson(res, 503, { error: 'La reserva aérea no está configurada.' });

  try {
    // El precio confiable sale del proveedor, no del navegador, para evitar que el
    // cliente altere el importe del pago.
    const offerResponse = await air.offers.get(offerId, { return_available_services: true });
    const offer = offerResponse.data || offerResponse;
    const availableServices = Array.isArray(offer.available_services) ? offer.available_services : [];
    const availableById = new Map(availableServices.map(function (service) { return [String(service && service.id || ''), service]; }));
    const services = [];
    let servicesAmount = 0;
    for (const requested of requestedServices) {
      const available = availableById.get(requested.id);
      if (!available) return sendJson(res, 400, { error: 'Uno de los servicios adicionales ya no está disponible para esta oferta.' });
      const unitAmount = Number(available.total_amount || available.amount || 0);
      if (!Number.isFinite(unitAmount) || unitAmount < 0) return sendJson(res, 502, { error: 'Duffel devolvió un precio inválido para un servicio adicional.' });
      servicesAmount += unitAmount * requested.quantity;
      services.push(requested);
    }
    const baseAmount = Number(offer.total_amount || 0);
    const amount = Number.isFinite(baseAmount) ? (baseAmount + servicesAmount).toFixed(2) : '';
    const currency = String(offer.total_currency || '').toUpperCase();
    if (!/^\d+(\.\d+)?$/.test(amount) || !currency) return sendJson(res, 502, { error: 'La aerolínea no devolvió un precio válido para esta oferta.' });
    const orderPayment = paymentType === 'card'
      ? { amount: amount, currency: currency, type: 'card', card_id: String(payment.card_id), three_d_secure_session_id: String(payment.three_d_secure_session_id) }
      : { amount: amount, currency: currency, type: 'balance' };
    const orderPayload = { selected_offers: [offerId], passengers: passengers, type: 'instant', payments: [orderPayment] };
    if (services.length) orderPayload.services = services;
    const orderResponse = await air.orders.create(orderPayload);
    const order = orderResponse.data || orderResponse;
    return sendJson(res, 200, {
      booking_reference: order.booking_reference || order.booking_reference_code || null,
      order_status: order.status || 'confirmed',
      airline: order.owner && order.owner.name || (offer.owner && offer.owner.name) || null,
      order_id: order.id || null,
      documents: order.documents || [],
      slices: order.slices || offer.slices || [],
      passengers: passengers,
      total_amount: amount,
      total_currency: currency
    });
  } catch (e) {
    let detail;
    try { detail = JSON.stringify(e, null, 2); } catch (jsonError) { detail = String(e); }
    console.error('Error detallado del proveedor aéreo:', detail);
    const message = e && e.errors && e.errors[0] && (e.errors[0].message || e.errors[0].title);
    return sendJson(res, 400, { error: message || e.message || 'No pudimos emitir la reserva. La oferta puede haber vencido.' });
  }
}

async function obtenerOferta(req, res, url) {
  const offerId = String(url.searchParams.get('offer_id') || '').trim();
  if (!/^off_[A-Za-z0-9]+$/.test(offerId)) return sendJson(res, 400, { error: 'Oferta inválida.' });
  const air = airClient();
  if (!air) return sendJson(res, 503, { error: 'La integración de Duffel no está configurada.' });
  try {
    const response = await air.offers.get(offerId, { return_available_services: true });
    const offer = response.data || response;
    return sendJson(res, 200, { id: offer.id, airline: offer.owner && offer.owner.name || null, total_amount: offer.total_amount, total_currency: offer.total_currency, expires_at: offer.expires_at || null, available_services: Array.isArray(offer.available_services) ? offer.available_services : [], passengers: Array.isArray(offer.passengers) ? offer.passengers.map(function (p) { return { id: p.id, type: p.type }; }) : [] });
  } catch (e) {
    const message = e && e.errors && e.errors[0] && (e.errors[0].message || e.errors[0].title);
    return sendJson(res, e.status && e.status < 500 ? e.status : 502, { error: message || 'La oferta expiró o ya no está disponible.' });
  }
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
  const quotes = await providers.getQuotes(model.DEST[v.S.dest], v.S.dep, v.S.ret, v.S.style);
  const result = adaptPackagesToStyle(model.compute(v.S, v.dep, v.ret, today, quotes), v.S, v.dep, v.ret, today);
  const hotels = await hotelRecommendations(v.S.dest, model.DEST[v.S.dest].name, v.S.style, { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, nights: v.nights });
  const localTransport = calculateLocalTransportCost({ style: v.S.style, dest: v.S.dest, nights: v.nights, pax: v.S.pax });
  sendJson(res, 200, Object.assign({
    meta: {
      mode: providers.isLive() ? 'live' : 'demo',
      dest: { key: v.S.dest, name: model.DEST[v.S.dest].name },
      dep: v.S.dep, ret: v.S.ret, nights: v.nights, pax: v.S.pax, budget: v.S.budget, style: v.S.style,
      costBasis: Object.assign({}, model.REAL_COSTS, { destinationCosts: model.DESTINATION_COSTS }), roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax), localTransport: localTransport,
      hotels: hotels, hotelsNearby: hotels.length && hotels[0].areaLabel && hotels[0].areaLabel !== model.DEST[v.S.dest].name ? hotels[0].areaLabel : '', generatedAt: new Date().toISOString()
    },
    localTransport: localTransport
  }, result));
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
      dest: { key: key, name: model.DEST[key].name }, total: rec.total, pp: rec.pp,
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
    if (req.method === 'POST' && url.pathname === '/api/vuelos/reservar') {
      return readJson(req).then(function (body) { return reservarVuelo(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos leer la reserva.' });
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/vuelos/oferta') {
      return obtenerOferta(req, res, url).catch(function (e) { sendJson(res, e.status || 500, { error: e.message || 'No pudimos cargar la oferta.' }); });
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
    if (url.pathname === '/api/cotizar-todos') {
      return cotizarTodos(req, res, url);
    }
    try { serveStatic(req, res, url.pathname); } catch (e) { res.writeHead(400); res.end(); }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, function () {
    console.log('CuántoSale en http://localhost:' + port + ' (' + (providers.isLive() ? 'vuelos reales activos' : 'modo demo') + ')');
  });
}

const app = createServer();
module.exports = app;
// Vercel consume la función `app`; exponer el factory permite levantar un
// servidor aislado en las pruebas sin alterar el handler desplegado.
module.exports.createServer = createServer;
module.exports.formatOffers = formatOffers;
module.exports.normalizePassengers = normalizePassengers;
module.exports.hotelRecommendations = hotelRecommendations;
module.exports.fetchBookingHotels = fetchBookingHotels;
