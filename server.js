'use strict';
/*
 * Servidor de CuántoSale. Node 18 o superior.
 *
 *   node server.js            -> http://localhost:3000
 *
 * Variables (en el entorno o en un archivo .env):
 *   SERPAPI_API_KEY         para búsquedas reales de vuelos (Google Flights).
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
  } catch (e) { /* no hay .env: está bien */ }
}
loadEnv();

const model = require('./lib/model');
// Guia Secreta. Vive en lib/, no en public/: en public/ era un .js estatico y
// cualquiera lo bajaba con curl, con la guia de los 88 destinos, sin comprar
// nada. Ver guiaToken() mas abajo para como se decide quien la recibe.
const guiSecreta = require('./lib/guias');
const playas = require('./lib/playas');
// Vuelos reales. El agregador es el único que habla con SerpAPI: ahí viven el
// cache, el dedupe de pedidos simultáneos y la pausa cuando se acaban los
// créditos del mes. Si el server llamara al provider directo, cada endpoint
// pagaría su propio precio por la misma búsqueda.
const flightProviders = require('./lib/providers');
// Convierte los links de Booking en links de Travelpayouts para que las
// reservas generen comision. Es independiente de los precios: la API de
// precios (RapidAPI o partner) y la de afiliados son dos cuentas distintas.
const travelpayouts = require('./lib/providers/travelpayouts');
// Catalogo de tours. Mismo caso que la guia: son precios vendibles, asi que
// salen de la tabla de Supabase y no de un archivo publico. Si la base no
// responde, esta capa cae a public/tours.generated.js, que es la copia local
// commiteada: sin ella, un problema de Supabase sacaria la seccion de tours de
// todas las propuestas.
const tours = require('./lib/tours');

/*
 * Tasas de cambio para el selector de moneda.
 *
 * Fuente: exchangerate-api.com. Con EXCHANGERATE_API_KEY usa v6; sin key cae a
 * v4, que es gratis y no pide autenticacion. Se cachea hasta
 * time_next_update_utc porque la API publica una vez por dia: pegarle en cada
 * carga de pagina no sirve y, consume el cuota.
 *
 * Si ninguna fuente responde se devuelve rates:null y el cliente se queda solo
 * con USD. Preferimos mostrar un selector incompleto a multiplicar por un numero
 * inventado.
 */
// El símbolo lleva el código adelante cuando el "$" a secas no alcanza. Con
// pesos Belgrano, pesosCb ordenados y dólares publishing en la misma pantalla,
// un "$" suelto no dice nada: "UYU$" y "ARS$" se leen de un vistazo y no
// hacen falta dosguias.
// Ojo: esto ropes en cada monto de la app. "US$ 1.200" pasa a "US$ 1.200"
// (igual, el dólar ya lo llevaba) pero "UYU$ 1.200" es mas largo que "$ 1.200".
// Es el precio de no tener que adivinar.
// Solo las tres que le sirven a un traveler uruguayo que va a Brasil: la que
// quiere ver (UYU), la que están cotizando todos los sitios (USD, y es la base
// del presupuesto) y la que va a pagar allá (BRL). Agregar monedas acá cambia
// la lista del selector, que es exactamente lo que se quiere: la app es para
// este mercado, no para el mundo.
const MONEDAS = [
  { code: 'UYU', etiqueta: 'Pesos uruguayos', simbolo: '$' },
  { code: 'USD', etiqueta: 'Dólares', simbolo: 'US$' },
  { code: 'BRL', etiqueta: 'Reales', simbolo: 'R$' }
];
let fxCache = { rates: null, base: 'USD', until: 0, source: '', at: 0 };

function exchangerateKey() {
  return String(process.env.EXCHANGERATE_API_KEY || '').trim();
}
async function pedirTasas() {
  const key = exchangerateKey();
  if (key) {
    const url = 'https://v6.exchangerate-api.com/v6/' + encodeURIComponent(key) + '/latest/USD';
    const r = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 9000);
    const j = await r.json();
    if (j && j.result === 'success' && j.conversion_rates) {
      return {
        rates: j.conversion_rates, base: j.base_code || 'USD', source: 'v6',
        until: Date.parse(j.time_next_update_utc || '') || (Date.now() + 12 * 3600e3)
      };
    }
  }
  // v4: gratis, sin key, forma distinta (rates en vez de conversion_rates)
  const r4 = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD',
    { headers: { Accept: 'application/json' } }, 9000);
  const j4 = await r4.json();
  if (j4 && j4.rates) {
    return {
      rates: j4.rates, base: j4.base || 'USD', source: 'v4',
      until: (Number(j4.time_last_updated) || Math.floor(Date.now() / 1000)) * 1000 + 12 * 3600e3
    };
  }
  throw new Error('ninguna fuente de tasas respondio');
}
async function getTasas() {
  const ahora = Date.now();
  if (fxCache.rates && ahora < fxCache.until) return fxCache;
  if (fxCache.intentarEn && ahora < fxCache.intentarEn) return fxCache;   // no reintentar en bucle
  fxCache.intentarEn = ahora + 10 * 60e3;
  try {
    const t = await pedirTasas();
    // no publicamos esto, solo BRL y UYU. Mandar 160 divisas por request es
    // regalarle datos a cualquier curioso que llame al endpoint.
    const rates = {};
    MONEDAS.forEach(function (m) {
      const v = Number(t.rates[m.code]);
      if (Number.isFinite(v) && v > 0) rates[m.code] = v;
    });
    fxCache = { rates: Object.keys(rates).length ? rates : null, base: t.base, until: t.until, source: t.source, at: ahora };
  } catch (e) {
    console.warn('[tasas]', e.message);
    fxCache.intentarEn = ahora + 10 * 60e3;
  }
  return fxCache;
}

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};
// Los precios de vuelo llegan por el server y los links de reserva apuntan a
// Google Flights, así que el browser no necesita hablar con ningun proveedor de
// vuelos. Lo que queda permitido es lo que la pagina ya usaba: Supabase para
// autenticacion, Wikimedia para las fotos de destinos y el CDN de iconos.
// El CSP es la unica barrera que impide que un script inyectado se lleve datos
// de sesion, asi que no se le pueden agregar dominios sin necesidad.
const CSP = "default-src 'self'; " +
  // www.googletagmanager.com es el script de gtag.js y *.google-analytics.com /
  // *.analytics.google.com son adonde van los beacons. Sin estas dos lineas la
  // etiqueta de Analytics queda bloqueada por CSP y no reporta nada, sin error
  // visible en la consola: es un fallo silencioso.
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "style-src-attr 'unsafe-inline'; " +
  "font-src https://fonts.gstatic.com; " +
  "img-src 'self' data: https:; " +
  "connect-src 'self' https://*.supabase.co https://*.wikimedia.org https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com; " +
  "frame-src https://*.supabase.co; " +
  "base-uri 'none'; form-action 'self'";
// Google Analytics (GA4). La etiqueta se inyecta una sola vez desde serveStatic
// para todas las paginas HTML, en vez de pegada en cada archivo: asi no puede
// quedar duplicada en una pagina ni olvidada en una nueva.
const GA_MEASUREMENT_ID = String(process.env.GA_MEASUREMENT_ID || 'G-JJSG6WSTYZ').trim();
function analyticsSnippet() {
  if (!GA_MEASUREMENT_ID) return '';
  return '<script async src="https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID + '"></script>' +
    '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}' +
    "gtag('js',new Date());gtag('config'," + JSON.stringify(GA_MEASUREMENT_ID) + ");</script>";
}
function injectAnalytics(payload, ext) {
  if (ext !== '.html' || !GA_MEASUREMENT_ID) return payload;
  const html = payload.toString('utf8');
  // Google avisa que no puede haber dos etiquetas en la misma pagina, y las
  // vistas previas de desarrollo no existen para el usuario final.
  if (html.indexOf('googletagmanager.com/gtag/js') >= 0 || html.indexOf(GA_MEASUREMENT_ID) >= 0) return payload;
  const snippet = analyticsSnippet();
  if (!snippet) return payload;
  // Justo despues de <head>, como pide Google; si el HTML no lo tiene, antes
  // de cerrar la etiqueta.
  const conHead = /<head[^>]*>/i.exec(html);
  if (conHead) {
    const cut = conHead.index + conHead[0].length;
    return Buffer.from(html.slice(0, cut) + snippet + html.slice(cut), 'utf8');
  }
  const close = html.toLowerCase().indexOf('</head>');
  if (close < 0) return payload;
  return Buffer.from(html.slice(0, close) + snippet + html.slice(close), 'utf8');
}
// Cuarta lista de destinos, y la que el cliente no ve: si una clave no esta
// aca, /api/vuelos/buscar la rechaza con "!destination" y el destino no puede
// buscar vuelo real aunque el modelo, el desplegable y la grilla lo ofrezcan.
// Tiene que coincidir con HOME_DESTINATION_KEYS.
const AIR_DESTINATIONS = { buz: 'GIG', arraial: 'GIG', cabo: 'GIG', ilha: 'GIG', paraty: 'GIG', ilhabela: 'GRU', ubatuba: 'GRU', rio: 'GIG', angra: 'GIG', sao: 'GRU', porto: 'REC', mcz: 'MCZ', maragogi: 'MCZ', nat: 'NAT', pip: 'NAT', trancoso: 'SSA', ajuda: 'SSA', ssa: 'SSA', for: 'FOR', jericoacoara: 'FOR', morro: 'SSA', fernando: 'FEN', fln: 'FLN', bombinhas: 'FLN', rosa: 'FLN', bcm: 'FLN', gram: 'POA', canela: 'POA', rec: 'REC', poa: 'POA', portoseguro: 'SSA', itacare: 'SSA', forte: 'SSA', itapema: 'FLN', garopaba: 'FLN', ferrugem: 'FLN', picarras: 'FLN', torres: 'POA', canoa: 'POA', joaopessoa: 'JPA' };
// Los destinos que la app ofrece, agrupados por región. Esta lista estaba
// desincronizada del picker de public/app.js en las dos direcciones: tenía
// 'ilha', que el picker nunca ofrece (la búsqueda por presupuesto cotizaba un
// destino invisible) y le faltaba 'canela', que el picker sí ofrece (elegir
// Canela devolvía 400 "Elegí un destino disponible en el buscador").
//
// Esta lista es la que recorre cotizarTodos(), o sea la que decide qué
// DestinationCards de "Todos los destinos" existen. Estaba clavada en 12
// destinos: los 10 de la grilla + gram. Con eso, 25 de los destinos
// que el picker ofrecia nunca aparecian en la busqueda por presupuesto, y
// Torres o Capao da Canoa, que son mas baratos que los 12, tampoco aparecian.
// El comentario de abajo decia que era por los requests externos, pero este
// path es todo local: model.compute() por destino mide 3 ms, o sea 135 ms los
// 44. No hay tope tecnico, habia un tope editorial.
//
// Debe coincidir con la union de DESTINATION_GROUPS en public/app.js.
// prueba-destinos.js lo verifica, porque la desincronizacion es la causa raiz
// de que un destino exista y no se vea.
const HOME_DESTINATION_KEYS = [
  // Rio de Janeiro
  'rio',
  // Buzios / Arraial do Cabo / Cabo Frio
  'buz', 'arraial', 'cabo',
  // Costa Verde
  'paraty', 'ubatuba', 'ilhabela', 'angra', 'ilha',
  // Ciudades con aeropuerto propio. Estaban en DEST con precio, traslado,
  // actividades y foto, pero no en ninguna de las dos listas: cotizaban bien y
  // no aparecian en ningun lado.
  'sao', 
  // Litoral de Santa Catarina
  'fln', 'bcm', 'itapema', 'bombinhas', 'garopaba', 'rosa', 'ferrugem', 'picarras',
  // Litoral de Rio Grande do Sul
  'torres', 'canoa',
  // Bahia
  'ssa', 'portoseguro', 'forte', 'morro', 'itacare', 'trancoso', 'ajuda',
  // Nordeste. 'jericoacoara' se sumo cuando la entrada "Fortaleza /
  // Jericoacoara" se separo en dos destinos mas el par "Fortaleza + Jeri": la
  // clave existia en el modelo con costos, traslados y actividades desde antes,
  // pero no estaba en ninguna lista, o sea que era data que nadie podia cotizar.
  'porto', 'maragogi', 'mcz', 'rec', 'joaopessoa', 'nat', 'pip', 'for', 'jericoacoara', 'fernando',
  // Buenos Aires, Porto Alegre, Serra gaucha y Foz. Porto Alegre entra con
  // Gramado y Canela: los tres vuelan por POA y POA a Gramado son 80 km de
  // ruta, asi que el par de dos paradas existe y se cotiza.
  'poa', 'gram', 'canela'
];
const SEARCH_DESTINATION_KEYS = HOME_DESTINATION_KEYS;
// Un destino es válido si existe en el modelo. La lista de arriba define qué se
// ofrece y cómo se agrupa, pero no se usa para rechazar pedidos: así, si el
// picker suma un destino nuevo, este no devuelve un 400 invisible hasta que
// alguien acuerda las dos listas a mano.
const VALID_DESTINATION_KEYS = new Set(Object.keys(model.DEST));
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
// Los 32 caracteres que Windows-1252 ubica entre 0x80 y 0x9F, donde Latin-1 no
// tiene nada. Sin esta tabla "â€™" (un apostrophe curly de UTF-8 doble
// codificado) no se puede deshacer, porque '€' y '™' caen fuera de Latin-1.
// El listado sale de la implementación de WHATWG de Node y no de memoria:
// varios de estos caracteres son de control (U+0081, U+008D, U+008F, U+0090,
// U+009D) y es fácil cambiarlos de lugar sin darse cuenta, lo que rompe el
// repair sin que salte ningún error.
const CP1252_HIGH = '\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178';
// Traduce el texto a sus bytes Windows-1252. Devuelve null si algún carácter no
// se puede representar, en cuyo caso el texto no viene de un doble encoding.
function cp1252Bytes(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 0x80) { bytes.push(code); continue; }
    // El bloque alto de CP1252 se busca por carácter y no por rango: '€' es
    // U+20AC, muy por encima de 0x9F, y representa el byte 0x80.
    const high = CP1252_HIGH.indexOf(ch);
    if (high >= 0) { bytes.push(0x80 + high); continue; }
    if (code >= 0xa0 && code <= 0xff) { bytes.push(code); continue; }
    return null;
  }
  return Buffer.from(bytes);
}
// La API de Booking/Booqio a veces devuelve el nombre del hotel ya doble
// codificado: los bytes UTF-8 de "Búzios" leídos como Latin-1, que en pantalla
// aparecen como "BÃºzios". Se re-decodifica sólo cuando está la firma del
// problema y el resultado es texto UTF-8 válido, así una cadena correcta
// queda intacta.
function fixMojibake(value) {
  const text = String(value == null ? '' : value);
  // "Ã", "Â" y "â" son la huella de UTF-8 interpretado como un código de una
  // byte por carácter.
  if (!/[ÃÂâ]/.test(text)) return text;
  const bytes = cp1252Bytes(text);
  if (!bytes) return text;
  const fixed = bytes.toString('utf8');
  // Caracteres de reemplazo = la secuencia no era UTF-8 válido: es un texto que
  // ya traía esas letras de forma legítima ("Hotel São Paulo" en mayúsculas).
  if (fixed.indexOf('\uFFFD') >= 0) return text;
  return fixed;
}
function sanitizeHotelName(value) {
  const raw = fixMojibake(value).trim();
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
/*
 * Limpia BOOKING_API_KEY antes de mandarla como header.
 *
 * Un header HTTP no puede contener saltos de linea, asi que si la variable
 * tiene la key pegada dos veces (lo que paso en Vercel) el fetch ni siquiera
 * sale: Headers.append tira "is an invalid header value" y el mensaje de error
 * incluye la key entera. Se queda con el primer token, que es la key real.
 */
function normalizeBookingKey(raw) {
  const value = String(raw == null ? '' : raw);
  const first = value.split(/\s+/).find(function (part) { return part.length > 0; }) || '';
  return first;
}
/*
 * Saca la key de un texto antes de mandarlo por HTTP o al log. Los errores de
 * fetch incluyen los valores de los headers, asi que sin esto /api/hoteles
 * devuelve el secreto a cualquiera que llame al endpoint.
 */
function redactBookingKey(text, key) {
  let out = String(text == null ? '' : text);
  const clean = normalizeBookingKey(key);
  if (clean) out = out.split(clean).join('[REDACTED]');
  // Por si el mensaje trae la key partida o repetida con otros separadores.
  out = out.replace(/[A-Za-z0-9]{32,}/g, function (chunk) { return chunk === clean ? chunk : '[REDACTED]'; });
  return out;
}
function bookingSettings() {
  return {
    key: normalizeBookingKey(process.env.BOOKING_API_KEY),
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
    // El priceBreakdown de Booking viene ANIDADO en `property`, no en la raiz
    // del hotel. Leyendolo solo en la raiz, `breakdown` quedaba siempre vacio,
    // `gross` daba 0 y el filtro de `total > 0` se comia los 20 hoteles reales
    // que llegaban en la respuesta: la API respondia 200 y la app servia
    // igual los 3 estimados del modelo, sin error y sin aviso.
    const breakdown = hotel.priceBreakdown || hotel.price_breakdown
      || property.priceBreakdown || property.price_breakdown || {};
    const composite = hotel.compositePriceBreakdown || property.compositePriceBreakdown || {};
    const gross = breakdown.grossPrice || breakdown.gross_price || {};
    const compositeGross = composite.grossAmount || composite.gross_amount || {};
    const nightlyRaw = Number(hotel.price_pn || hotel.perNight || hotel.per_night || property.price_pn || 0);
    const totalCandidates = [gross.value, gross.amount, compositeGross.amount, compositeGross.value, breakdown.totalPrice, hotel.min_total_price, hotel.total_price, property.min_total_price, property.total_price, hotel.price];
    const totalRaw = Number(totalCandidates.find(function (value) { return value !== undefined && value !== null && value !== ''; }));
    const hasNightly = Number.isFinite(nightlyRaw) && nightlyRaw > 0;
    const hasTotal = Number.isFinite(totalRaw) && totalRaw > 0;
    // Booking manda los precios con toda la precision del float (266.4285714...),
    // y eso llegaba crudo a la tarjeta. Se redondea a centésimas, que es como
    // se muestran todos los demás precios de la app.
    const total = Math.round((hasTotal ? totalRaw : hasNightly ? nightlyRaw * nights : 0) * 100) / 100;
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
      perNight: hasNightly ? Math.round(nightlyRaw * 100) / 100 : Math.round((total / nights) * 100) / 100,
      currency: currency,
      lat: Number(property.latitude || hotel.latitude || hotel.lat || 0) || 0,
      lng: Number(property.longitude || hotel.longitude || hotel.lng || hotel.lon || 0) || 0,
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
      highlight: ['Económico', 'Equilibrado', 'Cerca de tu presupuesto'][index],
      recommended: index === 0
    });
  });
}
const PLAYAS_CONSULTADAS = 12; // busquedas extra por playa a Booking (cada una gasta cuota)
const HOTEL_TYPE_LABELS = { 'all-inclusive': 'All Inclusive', resort: 'Resort', boutique: 'Boutique', economico: 'Económico', intermedio: 'Intermedio', confort: 'Confort' };
// Los seis tipos del selector. La lista vive tambien en hotelTypeSelectMarkup()
// (public/app.js); si se agrega uno hay que tocar los dos lados. Aca, en scope de
// modulo: hotelRecommendations() tambien los necesita, para saber que tipos hay de
// verdad en un destino. Dentro de resolveHotelType no se ve desde ahi.
const HOTEL_TYPES = new Set(['economico', 'intermedio', 'confort', 'boutique', 'resort', 'all-inclusive']);
/* Los tres tipos que son un ESPECTRO de precio y no una categoria: el mismo
   hotel puede ser economico, intermedio o confort segun cuanto cueste, asi que
   hotelEsDelTipo() los acepta a todos sin mirar nada y lo unico que los separa
   es hotelPasaElPrecio(). Los otros tres (boutique, resort, all-inclusive) son
   categorias cerradas: un loft no es un resort por mas barato que sea.

   Vive en un Set porque el mismo criterio aparece en cuatro lugares y ya se
   desincronizo: hotelPasaElPrecio, hotelEsDelTipo, el canUseGenericFallback de
   hotelRecommendations() y el tiposDisponibles que se le manda al selector
   comparaban cada uno contra su propia lista escrita a mano. */
const HOTEL_SPECTRUM_TYPES = new Set(['economico', 'intermedio', 'confort']);
function resolveHotelType(value, subcategory, style) {
  const normalized = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_ ]+/g, '-');
  // La eleccion explicita del selector gana siempre. Antes se concatenaba con
  // la subcategoria y ganaba la subcategoria: con "boutique" elegido y la
  // subcategoria "Maceio (Resort)", el contexto decia "boutique maceio
  // (resort)" y el chequeo de resort, que va antes, devolvia resort. La
  // persona pedia boutique y le daban resorts sin que nada lo dijera.
  if (normalized && HOTEL_TYPES.has(normalized)) return normalized;
  const context = (' ' + String(subcategory || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).replace(/[_ ]+/g, '-');
  if (context.indexOf('all-inclusive') >= 0 || context.indexOf('todo-incluido') >= 0) return 'all-inclusive';
  if (context.indexOf('resort') >= 0) return 'resort';
  if (context.indexOf('boutique') >= 0) return 'boutique';
  if (context.indexOf('economico') >= 0 || context.indexOf('económico') >= 0 || context.indexOf('ahorro') >= 0) return 'economico';
  if (context.indexOf('intermedio') >= 0 || context.indexOf('3-estrellas') >= 0) return 'intermedio';
  if (context.indexOf('confort') >= 0 || context.indexOf('premium') >= 0) return 'confort';
  return style === 'ahorro' ? 'economico' : style === 'comodo' ? 'confort' : 'intermedio';
}
function hotelTypeMultiplier(type) {
  return ({ 'all-inclusive': 1.7, resort: 1.35, boutique: 1.22, economico: 0.82, intermedio: 1, confort: 1.3 })[type] || 1;
}
// El precio y el tipo son dos filtros distintos y hacen falta por separado: la
// segunda pasada de requetas relaja el precio (un hotel real fuera de banda es
// un mal dato) pero el tipo no se relaja nunca, porque un loft no es un resort
// por mas barato que sea.
function hotelPasaElPrecio(hotel, type, budgetTarget) {
  if (!type || HOTEL_SPECTRUM_TYPES.has(type)) {
    const rate = Number(hotel.perNight) || 0;
    if (!rate || !budgetTarget) return type !== 'economico';
    if (type === 'economico') return rate <= budgetTarget * 0.85;
    if (type === 'intermedio') return rate > budgetTarget * 0.75 && rate <= budgetTarget * 1.25;
    return rate > budgetTarget * 1.1;
  }
  // Resort, boutique y all-inclusive no se filtran por precio: su banda la
  // decide el multiplicador del tipo, no el objetivo de la categoria.
  return true;
}
function hotelEsDelTipo(hotel, type) {
  if (!type || HOTEL_SPECTRUM_TYPES.has(type)) return true;
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
function hotelMatchesType(hotel, type, budgetTarget) {
  return hotelPasaElPrecio(hotel, type, budgetTarget) && hotelEsDelTipo(hotel, type);
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
    // Antes se pisaba el motivo real con un texto generico, y en produccion
    // todo fallo de red llegaba al log y a /api/hoteles como el mismo
    // "No se pudo conectar": DNS, TLS, timeout y un host mal configurado eran
    // indistinguibles. El codigo del error (ENOTFOUND, ECONNREFUSED,
    // CERT_...) es lo que dice que host hay que corregir.
    //
    // OJO: este mensaje sale por HTTP. Los errores de fetch traen los valores
    // de los headers en el texto (un BOOKING_API_KEY pegado dos veces sale
    // entero en el mensaje de Headers.append), asi que antes de devolverlo hay
    // que sacarle la key: este endpoint no puede filtrar el secreto.
    const codigo = (error && (error.code || error.cause && error.cause.code)) || '';
    const detalle = redactBookingKey(
      (error && error.message ? String(error.message) : String(error)),
      settings.key
    ).slice(0, 160);
    throw new Error(error && error.name === 'AbortError'
      ? 'Booking API excedió el tiempo de espera.'
      : 'No se pudo conectar con Booking API (' + settings.host + ')' + (codigo ? ' [' + codigo + ']' : '') + ': ' + detalle);
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
/* El dest_id de Booking para una ciudad no cambia: es un id de la ciudad, no un
   precio ni una disponibilidad. Consultarlo en cada pedido de hoteles era tirar
   una llamada extra por cada render, y lo que hacia peor era que la consulta
   falla de a ratos: cuando searchDestination no devolvia nada, el destino entero
   caia al respaldo de hoteles inventados —con precio estimado y sin foto—
   aunque las fechas y el tipo estuvieran bien. Paso en Cabo Frio durante las
   pruebas de esto, y no es un caso raro.

   Solo se cachean los aciertos. Un fallo puede ser del proveedor, del throttle o
   de un nombre mal escrito, y cachear un fallo convertiria un tropiezo de un
   segundo en un destino roto para siempre en ese proceso. */
const bookingDestIdCache = new Map();
function bookingCacheKey(host, candidate) { return host + '|' + candidate.toLowerCase(); }
/* Vacia el cache. Lo usan las pruebas, que simulan distintas respuestas de
   searchDestination para la misma ciudad y sin esto dependerian del orden en que
   corren. */
function resetBookingDestCache() { bookingDestIdCache.clear(); }
async function fetchBookingHotels(destKey, destName, style, extra) {
  const settings = bookingSettings();
  if (!settings.key) throw new Error('Falta configurar BOOKING_API_KEY en las variables de entorno de Vercel.');
  if (!settings.host || !settings.url) throw new Error('Falta configurar BOOKING_API_HOST o BOOKING_API_URL en Vercel.');
  const hotelName = String(destName || settings.destination || 'Florianópolis').trim();
  const dep = String((extra && extra.dep) || '').trim() || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const ret = String((extra && extra.ret) || '').trim() || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const adults = Math.max(1, Number((extra && extra.pax) || 1));
  // El nombre del destino en lib/model.js está escrito para que se lea bien en
  // la interfaz, y a veces son dos ciudades: "Fortaleza / Jericoacoara",
  // "Trancoso / Arraial d'Ajuda". Booking no entiende esa barra: searchDestination
  // no devuelve nada y el destino caía entero al respaldo, sin hoteles reales.
  // Se prueban las partes en orden y se usa la primera que resuelva.
  const candidatos = hotelName.split(/\s*\/\s*/).map(function (part) { return part.trim(); }).filter(Boolean);
  if (!candidatos.length) candidatos.push(hotelName);
  let target = null;
  let consultado = null;
  for (const candidato of candidatos) {
    const cacheKey = bookingCacheKey(settings.host, candidato);
    const guardado = bookingDestIdCache.get(cacheKey);
    if (guardado) { target = guardado; consultado = candidato; break; }
    const destinationUrl = new URL('/api/v1/hotels/searchDestination', 'https://' + settings.host);
    destinationUrl.searchParams.set('query', candidato);
    destinationUrl.searchParams.set('locale', 'es');
    const destinationPayload = await bookingApiJson(destinationUrl.toString(), settings);
    const destinationRows = responseRows(destinationPayload);
    /* Una busqueda por playa (extra.soloDistrito) necesita el barrio: si Booking
       no tiene un distrito con ese nombre no se cae a la ciudad, porque traeria
       los mismos hoteles de siempre y repetiria la consulta para nada. */
    const esDistrito = function (item) { return item && /district/i.test(String(item.search_type || item.dest_type || '')); };
    const elegido = extra && extra.soloDistrito
      ? destinationRows.find(esDistrito)
      : destinationRows.find(function (item) { return item && /city/i.test(String(item.search_type || item.dest_type || '')); }) || destinationRows[0];
    if (elegido && elegido.dest_id != null && elegido.search_type) {
      target = elegido;
      consultado = candidato;
      bookingDestIdCache.set(cacheKey, elegido);
      break;
    }
  }
  if (!target) throw new Error('Booking API no encontró la ciudad "' + hotelName + '" (probó: ' + candidatos.join(', ') + ').');
  const isAllInclusive = extra && extra.hotelType === 'all-inclusive';
  const params = new URLSearchParams({
    dest_id: String(target.dest_id), search_type: String(target.search_type),
    arrival_date: dep, departure_date: ret, adults: String(adults), room_qty: '1',
    page_number: '1', units: 'metric', languagecode: 'es', currency_code: 'USD'
  });
  // Filtrar por regimen todo-incluido directamente en la API de Booking
  if (isAllInclusive) { params.set('meal_plan', 'all_inclusive'); params.set('filter_by_meal_plan', '5'); }
  // NO se manda filter_by_property_type. Se probo y esta RapidAPI lo rechaza:
  // con el parametro, bookingCount baja a 0 para TODOS los tipos y la pantalla
  // pasa a servir los tres hoteles estimados del modelo sin decir que no hay
  // ningun hotel real. El tipo se resuelve sobre los 20 que ya llegan, sin
  // gastarlos.
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
  // Un hotel real sin foto sigue siendo un hotel real, con su precio real.
  // Antes se filtraba por `hotel.image` y se tiraba abajo TODA la respuesta de
  // Booking si faltaba alguna foto: un fallo del endpoint getHotelPhotos
  // terminaba en la pantalla completa de hotels estimados, con precios
  // inventados, sin que nada dejara claro que la falla era de imagenes y no de
  // cotizacion. Ahora la foto solo ordena (primero las que la traen) y no
  // descarta: el front ya sabe pintar un hotel sin foto con su degradado.
  const ranked = hotels.slice().sort(function (a, b) { return (b.image ? 1 : 0) - (a.image ? 1 : 0); });
  return ranked;
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
async function hotelRecommendations(destKey, destName, style, extra, diag) {
  const tierByStyle = { ahorro: 'eco', eq: 'moderado', comodo: 'alto' };
  const tierIndex = ({ ahorro: 0, eq: 1, comodo: 2 })[style] == null ? 1 : ({ ahorro: 0, eq: 1, comodo: 2 })[style];
  const selectedTier = tierByStyle[style] || 'moderado';
  const hotelType = resolveHotelType(extra && extra.hotelType, extra && extra.subcategory, style);
  const hotelExtra = Object.assign({}, extra || {}, { hotelType: hotelType });
  const budgetTarget = hotelBudgetTarget(destKey, style, hotelExtra);
  let realHotels = [];
  try {
    realHotels = (await fetchBookingHotels(destKey, destName, selectedTier, hotelExtra)).map(function (hotel) { return Object.assign({}, hotel, { areaLabel: destName, geoKey: destKey }); });
    if (realHotels.length < 3) {
      const nearby = HOTEL_NEARBY_DESTINATIONS[destKey] || null;
      if (nearby) {
        try {
          // El nombre va reparado: esta es la query que se manda a Booking, y si
          // el source se vuelve a guardar con el encoding equivocado el fallback
          // regional buscaria "MaceiÃ³" y volveria con cero resultados, sin
          // avisar. fixMojibake ya corre sobre los nombres que vuelven; este es
          // el mismo problema del otro lado del cable.
          const regionalHotels = await fetchBookingHotels(nearby.key, fixMojibake(nearby.name), selectedTier, hotelExtra);
          realHotels = realHotels.concat(regionalHotels.map(function (hotel) { return Object.assign({}, hotel, { areaLabel: nearby.label, geoKey: nearby.key }); }));
        } catch (regionalError) {
          console.warn('[hotelRecommendations] Búsqueda regional no disponible:', regionalError && regionalError.message ? regionalError.message : regionalError);
        }
      }
    }
    /* Booking devuelve 20 hoteles por busqueda, y la de la ciudad entera no los
       reparte por playa: en Florianopolis (9.566 alojamientos) alcanzaba para 1 o
       2 por playa. Con la pantalla agrupada por playa se consulta ademas el
       distrito de cada una (Canasvieiras, Ingleses...), que trae 20 propios. Van
       en paralelo y una que falle se ignora; los repetidos los saca
       uniqueHotelList. */
    if (diag && !(extra && extra.noGroups) && realHotels.length) {
      const nombres = playas.nombresDePlayas(destKey).slice(0, PLAYAS_CONSULTADAS);
      const porPlaya = await Promise.all(nombres.map(function (nombre) {
        return fetchBookingHotels(destKey, nombre + ', ' + destName, selectedTier, Object.assign({}, hotelExtra, { soloDistrito: true }))
          .catch(function () { return []; });
      }));
      porPlaya.forEach(function (lista) {
        realHotels = realHotels.concat(lista.map(function (hotel) { return Object.assign({}, hotel, { areaLabel: destName, geoKey: destKey }); }));
      });
    }
  } catch (error) {
    const motivo = error && error.message ? error.message : String(error);
    console.warn('[hotelRecommendations] Booking API no disponible:', motivo);
    realHotels = [];
    // El motivo se devuelve en la respuesta en vez de morir en el log. Antes
    // una key sin suscripcion, un host mal configurado o un 403 se veian
    // IGUAL que unhotel sin precio: la pantalla servia estimados del modelo
    //como si fueran cotizaciones. Con `diag` el front puede decirlo.
    if (diag) diag.bookingError = motivo;
  }
  const pricedTodos = uniqueHotelList(realHotels.filter(function (hotel) { return hotel && hotel.name && Number(hotel.perNight) > 0; }))
    .map(function (hotel) {
      // Playa mas cercana y distancia al centro, calculadas con las coordenadas
      // que manda Booking (ver lib/playas.js).
      const ubicacion = playas.ubicacionDeHotel(hotel.geoKey || destKey, hotel.lat, hotel.lng);
      return ubicacion ? Object.assign({}, hotel, ubicacion) : hotel;
    });
  const priced = pricedTodos;
  // cuantos vinieron con precio real de Booking: si es 0, lo que se muestra en
  // pantalla es estimacion del modelo, y el front tiene que poder decirlo.
  if (diag) diag.bookingCount = priced.length;
  /* Que tipos hay de verdad entre los hoteles reales que llegaron.

     Esto tiene que COINCIDIR con lo que la seleccion de abajo devuelve, porque el
     cliente usa la lista para dos cosas: llenar el <select> y, si el tipo que
     esta elegido no esta en la lista, cambiarlo por el primero que si. Con los
     dos criterios distintos, el server devolvia 3 hoteles de tipo "confort" y de
     paso declaraba que "confort" no era un tipo disponible en ese destino: el
     cliente cambiaba a "economico" y despues filtraba los 3 hoteles por
     hotelType === "economico", con lo cual la lista quedaba en cero y la pantalla
     decia "No encontramos alojamientos de categoría Confort" al lado de un
     selector que mostraba Económico.

     La causa era hotelMatchesType() acá, que usa la banda de precio ajustada
     (0.75 a 1.25 del objetivo), mientras que la segunda pasada de abajo relaja
     el precio y solo pide no pasar del techo (1.6). Lo que la banda deja afuera,
     la segunda pasada lo levanta. Medido antes del arreglo: 9 de 60
     combinaciones destino x estilo con esa contradiccion — Cabo Frío, Rio,
     Salvador, Recife, Porto Alegre y Florianópolis en "cómodo", y Búzios, Porto
     Alegre y Buenos Aires en "ahorro" — y el dato del hotel mas barato era el
     engano, porque era el que la segunda pasada devolvia.

     Los tres tipos del espectro (economico, intermedio, confort) se declaran
     siempre disponibles cuando vino al menos un hotel con precio. No es una
     simplificacion: para esos tipos el precio ES la banda, la segunda pasada
     completa con cualquier hotel real por debajo del techo y, si todavia falta,
     el respaldo generico llena hasta tres. O sea que con un hotel cargado las
     tres bandas siempre devuelven algo, y declararlas vacias seria mentir en el
     otro sentido. Ademas es lo que sostiene la eleccion inicial: la pantalla
     arma el tipo de alojamiento a partir del estilo de viaje, y sin esta
     garantia hay destinos donde esa eleccion se queda sin nada que mostrar.

     Los tipos estrictos (boutique, resort) se comprueban con hotelEsDelTipo,
     que es el mismo criterio que usa la seleccion: hotelPasaElPrecio devuelve
     true para ellos, asi que la banda de precio no los toca. Con bookingCount en
     0 (sin key o caida de la API) no se dice nada, porque no sabemos nada, y el
     selector ofrece los seis como antes. */
  if (diag && priced.length) {
    diag.tiposDisponibles = Array.from(HOTEL_TYPES).filter(function (type) {
      if (type === 'all-inclusive') return true;      // tiene su propio respaldo
      if (HOTEL_SPECTRUM_TYPES.has(type)) return true; // el precio es la banda
      return priced.some(function (hotel) { return hotelEsDelTipo(hotel, type); });
    });
  }
  // Un hotel real más barato que el objetivo de la categoría sigue siendo válido
  // para esa categoría; lo que se descarta es lo que se pasa claramente de precio.
  const high = budgetTarget > 0 ? budgetTarget * 1.6 : Infinity;
  const porDistancia = function (a, b) { return Math.abs(a.perNight - budgetTarget) - Math.abs(b.perNight - budgetTarget); };
  const conTier = function (list) {
    return list.map(function (hotel) { return Object.assign({}, hotel, { tier: selectedTier, similar: [], areaLabel: hotel.areaLabel || destName }); });
  };
  const matchingCategory = conTier(priced
    .filter(function (hotel) { return hotel.perNight <= high && hotelMatchesType(hotel, hotelType, budgetTarget); })
    .sort(porDistancia)
    .slice(0, 3));
  // Cuando NADA real entra en la banda de la categoría, se mostraba el
  // respaldo inventado y se perdían los 20 hoteles reales que ya habían
  // llegado. En Río con estilo "comodo" el objetivo es US$187/noche y Booking
  // no tenía nada por encima: la pantalla ofrecía tres hoteles de fábrica sin
  // foto en vez de los reales, que eran más baratos pero con precio y foto.
  // Un hotel real fuera de banda es un mal dato; uno inventado es peor, así que
  // la segunda pasada completa con los reales más cercanos al objetivo.
  let realesExtra = [];
  if (matchingCategory.length < 3) {
    const yaElegidos = new Set(matchingCategory.map(function (hotel) { return normalizeHotelKey(hotel.name); }));
    const restantes = priced.filter(function (hotel) {
      // El tipo se mantiene: antes esta pasada no filtraba por nada, asi que si
      // no habia resorts completaba con lofts y apartamentos y los ofrecia como
      // si fueran. Relajar el precio era la idea del comentario de arriba;
      // relajar tambien el tipo convertia el selector en una decoracion.
      //
      // Y para economico/intermedio/confort el precio se mantiene tambien, con el
      // mismo techo que la primera pasada. Antes esta pasada no filtraba por
      // precio para NADIE, y como hotelEsDelTipo() devuelve true sin mirar nada
      // para esos tres tipos, el selector no separaba nada: los tres devolvian
      // la misma lista, con un hostel de US$199 bajo "Confort" y mas caro que
      // lo que salia como "Economico". Para los tres tipos del espectro el
      // precio es el unico discriminador que hay, asi que aflojarlo es
      // exactamente lo mismo que dejar el selector sin efecto.
      return !yaElegidos.has(normalizeHotelKey(hotel.name))
        && hotel.perNight <= high
        && hotelEsDelTipo(hotel, hotelType);
    });
    realesExtra = conTier(restantes.sort(porDistancia).slice(0, 3 - matchingCategory.length));
  }
  const combinedReales = matchingCategory.concat(realesExtra);
  const missing = 3 - combinedReales.length;
  const canUseGenericFallback = HOTEL_SPECTRUM_TYPES.has(hotelType);
  /* Para all-inclusive no hay fallback: antes se fabricaban tres entradas con
     nombres tipo "Complejo Todo Incluido" y el precio puesto en budgetTarget, sin
     foto y con un link de Booking. Se veian igual que un hotel real y con el
     numero a dos decimales, al lado de los que si venian de Booking: la unica
     pista de que eran inventados era una linea de texto ("Estimacion para...
     total estimado") que cualquiera pasa por alto.

     All Inclusive no es una categoria que admita sustitucion: o hay un hotel con
     regimen todo incluido para esas fechas, o no hay. Fabricar uno es justo lo
     que el estado vacio del cliente dice que no se hace. Ahora la lista puede
     volver vacia y el cliente muestra "No encontramos alojamientos verificados
     de tipo All Inclusive", con el link de Booking filtrado por mealplan para
     que la persona siga buscando en el sitio. */
  var fallback = [];
  if (missing > 0 && canUseGenericFallback) {
    fallback = fallbackHotelsFor(destKey, destName, hotelType === 'economico' ? 0 : hotelType === 'confort' ? 2 : tierIndex, hotelExtra);
  }
  const combined = uniqueHotelList(combinedReales.concat(fallback)).slice(0, 3);
  // Ultimo paso: convertir los links de Booking en links de Travelpayouts para
  // que la reserva entre por nuestro marker y genere comision. Va aca, y no
  // adentro de fetchBookingHotels, porque los links del fallback tambien son de
  // Booking y esos tambien generan comision. Se hace en un solo lote al final
  // para no gastar una request por hotel.
  let partnerLinks = null;
  try {
    if (travelpayouts.isConfigured()) {
      partnerLinks = await travelpayouts.toPartnerUrls(combined.map(function (hotel) { return hotel.bookingUrl; }));
    }
  } catch (error) {
    console.warn('[hotelRecommendations] Travelpayouts no disponible:', error && error.message ? error.message : error);
  }
  /* Los hoteles agrupados por playa, para que la pantalla los muestre en una
     seccion por playa (hasta 3 a la vista y el resto tras "Ver mas"). Solo en un
     destino que tiene playas cargadas (lib/playas.js) y con al menos un hotel
     ubicado en alguna. Usa el mismo criterio de tipo y precio que la lista de
     arriba, pero sin el tope de 3 y sin respaldo generico: una playa sin hoteles
     reales de ese tipo no tiene seccion. Los que no quedan cerca de ninguna
     playa van juntos en "Otras zonas". */
  if (diag && !(extra && extra.noGroups) && playas.nombresDePlayas(destKey).length && priced.some(function (hotel) { return hotel.playa; })) {
    const POR_PLAYA_MAX = 12;
    const porPlaya = new Map();
    const coinciden = new Set();
    priced
      .filter(function (hotel) { return hotel.perNight <= high && hotelMatchesType(hotel, hotelType, budgetTarget); })
      .sort(porDistancia)
      .forEach(function (hotel) {
        const clave = hotel.playa || 'Otras zonas';
        if (!porPlaya.has(clave)) porPlaya.set(clave, []);
        coinciden.add(hotel);
        if (porPlaya.get(clave).length < POR_PLAYA_MAX) porPlaya.get(clave).push(hotel);
      });
    /* Cada playa muestra al menos 3 hoteles: si el tipo y el precio elegidos dejan
       menos, se completa con los demas hoteles de esa misma playa, los mas cercanos
       al presupuesto primero. Solo en tipos de espectro (economico, equilibrado,
       comodo); All Inclusive, Resort y Boutique no admiten sustitucion. */
    if (['all-inclusive', 'resort', 'boutique'].indexOf(hotelType) < 0) {
      const resto = priced.filter(function (hotel) { return !coinciden.has(hotel); }).sort(porDistancia);
      const claves = new Set(priced.map(function (hotel) { return hotel.playa || 'Otras zonas'; }));
      claves.forEach(function (clave) {
        const lista = porPlaya.get(clave) || [];
        resto.forEach(function (hotel) {
          if (lista.length < 3 && (hotel.playa || 'Otras zonas') === clave) lista.push(hotel);
        });
        if (lista.length) porPlaya.set(clave, lista);
      });
    }
    const grupos = Array.from(porPlaya.entries())
      .filter(function (par) { return par[0] !== 'Otras zonas'; })
      .sort(function (a, b) { return b[1].length - a[1].length; });
    if (porPlaya.has('Otras zonas') && grupos.length) grupos.push(['Otras zonas', porPlaya.get('Otras zonas')]);
    let conversion = null;
    try {
      if (travelpayouts.isConfigured()) {
        const urls = [];
        grupos.forEach(function (par) { par[1].forEach(function (hotel) { urls.push(hotel.bookingUrl); }); });
        conversion = await travelpayouts.toPartnerUrls(urls);
      }
    } catch (error) {
      console.warn('[hotelRecommendations] Travelpayouts no disponible (playas):', error && error.message ? error.message : error);
    }
    diag.hotelsPorPlaya = grupos.map(function (par) {
      return {
        playa: par[0],
        hotels: par[1].map(function (hotel) {
          const convertido = conversion && conversion.get(hotel.bookingUrl) ? conversion.get(hotel.bookingUrl) : '';
          return Object.assign({}, hotel, {
            bookingUrl: convertido || hotel.bookingUrl,
            affiliate: convertido ? 'travelpayouts' : '',
            tier: selectedTier, hotelType: hotelType, hotelTypeLabel: HOTEL_TYPE_LABELS[hotelType] || 'Intermedio',
            similar: [], areaLabel: hotel.areaLabel || destName, highlight: '', recommended: false
          });
        })
      };
    });
  }
  return combined.map(function (hotel, index) {
    // El provider solo deja la entrada en el Map si el link se CONVIRTIO de
    // verdad. Si no esta, el link va sin marker: el usuario puede reservar
    // igual, pero no suma comision. Y el campo affiliate queda vacio, para no
    // aparentar un tracking que no existe.
    const convertido = partnerLinks && partnerLinks.get(hotel.bookingUrl) ? partnerLinks.get(hotel.bookingUrl) : '';
    return Object.assign({}, hotel, {
      bookingUrl: convertido || hotel.bookingUrl,
      affiliate: convertido ? 'travelpayouts' : '',
      tier: selectedTier, hotelType: hotelType, hotelTypeLabel: HOTEL_TYPE_LABELS[hotelType] || 'Intermedio',
      // Solo las dos primeras llevan placa. La tercera se queda sin nada: con
      // tres, la de "Alternativa" competia con la de "Recomendado" por el mismo
      // ojo y ninguna decía nada que la otra no dijera. Un sello que no
      // diferencia es ruido.
      //
      // "Destacado" y no "Buena opción": dice lo mismo con una sola palabra y
      // sin pedirle al lector que se fije. "Buena opción" suena a que evaluamos
      // el hotel y lo encontramos bueno, y eso no se sabe: lo que sabemos es
      // que nos pareció una de las dos que destacamos al ordenar, que no es lo
      // mismo que una calidad del hotel.
      highlight: ['Recomendado', 'Destacado', ''][index] || '',
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
  // para no alterar el resto del flujo (cotización real de vuelos, transfer
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
/*
 * Transfer desde el aeropuerto: el precio sale de la tabla por destino
 * (data/transfer-precios.json, via model.TRANSFER_PRICES), no de una constante.
 *
 * ANTES eran tres numeros distintos para lo mismo: las cards del cliente
 * mostraban 30 y 150 fijos, y esta funcion usaba OFFICIAL_TRANSFER_PRICE_USD
 * (35) por pasajero. Para dos personas el wizard decia 70 y la card decia 30.
 * Ademas los tres eran iguales para los 44 destinos, y de GIG a Rio hay 18 km
 * contra 174 km de GIG a Buzios.
 *
 * La semantica que se fijo, y que antes estaba mezclada:
 *   compartido: USD por PERSONA, solo ida.
 *   privado:    USD por VEHICULO de hasta 4 personas, solo ida. NO se multiplica
 *               por los pasajeros: es el mismo auto para los dos.
 *
 * `bank` se mantiene porque la app lo usa para mostrar los datos de la cuenta de
 * Prex. Es informacion del servicio, no del precio, asi que no se toca.
 */
function transferConfig(destKey, pax) {
  const personas = Math.max(1, Number(pax) || 1);
  const tabla = model.transferOptions(destKey);
  // Destino fuera de la tabla: se cae al precio por pasajero de antes, que al
  // menos es un piso conocido. No deberia pasar: validar-transfer.js obliga a
  // que los 44 destinos de DEST esten en la tabla.
  if (!tabla) {
    const unit = Number(process.env.OFFICIAL_TRANSFER_PRICE_USD) || 35;
    return {
      destino: destKey, sinTabla: true, iata: null, modo: 'car', km: null,
      compartido: unit, privado: unit * 3, appRideUsd: null,
      precioPorPasajero: unit, monto: unit * personas, personas: personas,
      banco: { bank: 'Prex', account: '361333', holder: 'Maria Paola Batista' }
    };
  }
  return {
    destino: destKey, nombre: tabla.nombre, sinTabla: false,
    iata: tabla.iata, modo: tabla.modo, km: tabla.km, soloPrivado: tabla.soloPrivado,
    // Se mandan los dos precios y el app elige. `monto` queda como el compartido
    // por la persona, que es lo que se venia usando para el total.
    compartido: tabla.compartido, privado: tabla.privado, appRideUsd: tabla.appRideUsd,
    precioPorPasajero: tabla.compartido,
    monto: tabla.compartido * personas,
    personas: personas,
    banco: { bank: 'Prex', account: '361333', holder: 'Maria Paola Batista' }
  };
}

/* ---------- límite de pedidos por IP ---------- */
/* ---------- límite de pedidos por IP ---------- */
/*
 * Cada tipo de pedido lleva su propio cubo (el prefijo de la clave) por una
 * razón práctica: /api/cotizar-todos y /api/destinos-destacados son cálculo
 * local y no cuestan nada, mientras que /api/cotizar, /api/hoteles y
 * /api/vuelos/calendario gastan cuota de SerpAPI y de Booking. Con un cubo
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
    // golpe (muchos origenes distintos dentro del mismo minuto) todavia no
    // hay nada vencido que borrar y el mapa crecera hasta agotar la memoria
    // del proceso.
    //
    // Antes se expulsaba por orden de insercion del Map, asumiendo que la
    // primera clave era la mas vieja. Es falso: un cubo solo vuelve a
    // insertarse cuando EXPIRA, asi que el frente del Map es el cubo que lleva
    // mas tiempo vivo, no el mas vencido. Borrarlo tiraba el contador de un
    // usuario legitimo que recien estaba usando la app, y un atacante podia
    // provocarlo a voluntad inserte 20.000 IPs falsas (cada una con su cubo
    // nuevo) y vaciar todos los contadores reales del proceso.
    //
    // Ahora se expulsa el cubo que vence antes: es el que mas probablemente
    // este solo, y el que menos informacion de limite vale perder.
    sweepHits(now);
    while (hits.size > maxIps) {
      let soonest = null;
      let soonestAt = Infinity;
      hits.forEach(function (v, k) { if (v.reset < soonestAt) { soonestAt = v.reset; soonest = k; } });
      if (soonest === null) break;
      hits.delete(soonest);
    }
  }
  return h.n > max;
}
function clientIp(req) {
  // La IP que decide el cubo del rate limit tiene que ser la que ve el proxy
  // de confianza, NO la primera de X-Forwarded-For. Ese header lo arma el
  // cliente: `curl -H 'X-Forwarded-For: 1.2.3.4'` en cada pedido devolvia un
  // cubo nuevo y `limited()` nunca llegaba a frenar nada. El formato de XFF es
  // `cliente, proxy1, proxy2`, y el valor de la derecha lo agrega el ultimo
  // salto (en Vercel, la plataforma), que es el unico que no se puede falsear.
  // Por eso se toma el ULTIMO elemento y no el primero.
  const vercel = String(req.headers['x-vercel-forwarded-for'] || '').trim();
  if (/^[0-9a-f:.]{3,45}$/i.test(vercel)) return vercel;
  const xf = String(req.headers['x-forwarded-for'] || '').split(',');
  for (let i = xf.length - 1; i >= 0; i--) {
    const candidate = xf[i].trim();
    if (/^[0-9a-f:.]{3,45}$/i.test(candidate)) return candidate;
  }
  return req.socket.remoteAddress || 'x';
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

/*
 * Precios de las fechas vecinas del grafico "mismo viaje, otra fecha".
 *
 * Va aparte de /api/cotizar a proposito: son 15 busquedas, no una. Encima es
 * trabajo desperdiciado si el usuario nunca mira el grafico, asi que el cliente
 * lo pide aparte y solo cuando decide pedirlo.
 */
/*
 * Browse de vuelos, en una sola búsqueda.
 *
 * Se implementó en dos etapas al principio (elegir ida, después vuelta, con un
 * `departure_token` entre medio) porque así funcionaba con Duffel. Contra
 * SerpAPI no: la segunda llamada devuelve cero resultados y, además, no hacía
 * falta, porque el precio de la primera ya viene como total de ida y vuelta.
 * El browse quedó en un paso y cuesta un crédito.
 */
async function buscarVuelos(req, res, body) {
  if (!flightProviders.isLive()) return sendJson(res, 503, { provider: 'serpapi', offers: [], error: 'La búsqueda de vuelos no está disponible en este momento.' });
  if (limited('vuelos:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  body = body && typeof body === 'object' ? body : {};
  const origin = String(body.origen || '').toUpperCase();
  const destination = AIR_DESTINATIONS[String(body.destino || '').toLowerCase()];
  const date = String(body.fecha_ida || '');
  const returnDate = String(body.fecha_vuelta || '');
  const passengers = Number(body.pasajeros);
  const style = ['ahorro', 'eq', 'comodo'].indexOf(String(body.style || '').toLowerCase()) >= 0 ? String(body.style).toLowerCase() : 'eq';
  if (['MVD', 'PDP'].indexOf(origin) < 0 || !destination || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || (returnDate && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(returnDate)) || !Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return sendJson(res, 400, { error: 'Datos de búsqueda de vuelo inválidos.' });
  }

  try {
    const result = await flightProviders.searchOffers({
      origin: origin, destination: destination,
      departureDate: date, returnDate: returnDate,
      passengers: passengers, style: style
    });
    if (!result.offers.length && typeof flightProviders.enPausa === 'function' && flightProviders.enPausa()) {
      return sendJson(res, 503, { provider: flightProviders.providerName(), offers: [], error: 'La búsqueda de vuelos está saturada en este momento. Probá de nuevo en unos minutos o mirá los vuelos directo en Google Flights.' });
    }
    return sendJson(res, 200, {
      provider: flightProviders.providerName(), origin: origin, destination: destination,
      // El precio de cada tarjeta ya es el TOTAL de ida y vuelta, no solo la
      // ida: la API lo marca como `type: "Round trip"` y escala con la cantidad
      // de pasajeros (1 adulto = US$ 249, 2 = US$ 499 en la misma ruta). Por
      // eso no hace falta una segunda etapa para conocer el total, y el browse
      // cuesta un solo crédito.
      round_trip: !!returnDate,
      offers: result.offers,
      error: result.offers.length ? null : browseVacioMsg()
    });
  } catch (e) {
    console.error('[browse vuelos]', e.message);
    /* Cuota agotada o limite de la API: el mensaje crudo viene en ingles ("Your
       account has run out of searches") y no es culpa de las fechas. */
    if (e.status === 429 || e.quotaExhausted) {
      return sendJson(res, 503, { provider: flightProviders.providerName(), offers: [], error: 'La búsqueda de vuelos está saturada en este momento. Probá de nuevo en unos minutos o mirá los vuelos directo en Google Flights.' });
    }
    return sendJson(res, e.status || 502, { provider: flightProviders.providerName(), offers: [], error: e.message || 'No pudimos consultar disponibilidad de vuelos.' });
  }
}

/*
 * El browse sin(key ni mock) cae en el modelo, y antes devolvia el mismo
 * "No hay vuelos disponibles para esas fechas. Proba con otras fechas." que un
 * buscador de verdad. Es un mensaje que miente: no es que no haya vuelos, es que
 * no se consulto a nadie. Alguien que prueba la app sin credenciales lo leia
 * como un fallo de la ruta y no como un modo de la app.
 */
function browseVacioMsg() {
  if (!flightProviders.isLive()) {
    return 'Busqueda de vuelos sin credenciales: se muestra el precio estimado del modelo. Poné SERPAPI_API_KEY para precios reales, o MOCK_FLIGHTS=1 para probar con datos falsos.';
  }
  return 'No hay vuelos disponibles para esas fechas. Probá con otras fechas.';
}

async function calendarioVuelos(req, res, url) {
  // Se valida antes de mirar si hay credenciales: un destino inválido es un 400
  // siempre, tenga o no key puesta. Si se invirtiera el orden, con la app sin
  // key un destino garbage devolvería 200 y la respuesta no significaría nada.
  const dest = String(url.searchParams.get('dest') || '').toLowerCase();
  const destCfg = model.DEST[dest];
  if (!destCfg || !destCfg.modes.avion_mvd) return sendJson(res, 400, { error: 'Elegí un destino disponible en el buscador.' });
  const origin = String(url.searchParams.get('origin') || 'MVD').toUpperCase();
  if (['MVD', 'PDP'].indexOf(origin) < 0) return sendJson(res, 400, { error: 'El aeropuerto de salida debe ser MVD o PDP.' });
  const pax = Number(url.searchParams.get('pax'));
  if (!(pax >= 1 && pax <= 10)) return sendJson(res, 400, { error: 'La cantidad de viajeros tiene que ser entre 1 y 10.' });
  const styleRaw = String(url.searchParams.get('style') || '').toLowerCase();
  const style = ['ahorro', 'eq', 'comodo'].indexOf(styleRaw) >= 0 ? styleRaw : 'eq';
  const dep = String(url.searchParams.get('dep') || '');
  const ret = String(url.searchParams.get('ret') || '');
  if (!model.parse(dep) || !model.parse(ret)) return sendJson(res, 400, { error: 'Las fechas no son válidas.' });
  if (!flightProviders.isLive()) return sendJson(res, 200, { puntos: [], real: 0, estimados: 0, configured: false });
  if (limited('calendario:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });

  // Las fechas salen de la misma función que usa /api/cotizar, así que el
  // calendario del server y el del cliente no pueden mostrar fechas distintas.
  const points = model.seriesDates(model.parse(dep), model.parse(ret), model.getToday());
  if (!points.length) return sendJson(res, 200, { puntos: [], real: 0, estimados: 0, configured: true });

  const calendar = await flightProviders.getCalendar(origin, airportFor(dest), points, style, pax);
  sendJson(res, 200, Object.assign({
    configured: true, origin: origin, destination: airportFor(dest),
    dep: dep, ret: ret, pax: pax, style: style
  }, calendar));
}

/*
 * Aeroluerto de un destino.
 *
 * OJO con esto: `model.DEST[...].iata` a veces es el código de la CIUDAD y no
 * del aeropuerto. `rio` vale "RIO" y `sao` vale "SAO", que no son aeropuertos:
 * son áreas metropolitanas. Con Duffel no pasaba nada porque resolvía el lugar
 * por nombre, pero SerpAPI busca por código de aeropuerto y con "RIO" no
 * encuentra nada: devuelve una respuesta vacía y SIN error, así que la app caía
 * a estimado en silencio. Rio y São Paulo, que son los dos destinos más
 * buscados, nunca mostraban precio real por esto.
 *
 * `AIR_DESTINATIONS` sí tiene los códigos de aeropuerto correctos (GIG, GRU), y
 * es la misma tabla que ya usa el browse. Por eso se resuelve por ahí primero.
 */
function airportFor(destKey) {
  const key = String(destKey || '').toLowerCase();
  return AIR_DESTINATIONS[key] || (model.DEST[key] && model.DEST[key].iata) || '';
}

/*
 * Tarifa real por pasajero para anclar la propuesta recomendada. La cache y el
 * dedupe de pedidos simultaneos viven en el agregador (`lib/providers`), no
 * aca: si vivieran en el server, el endpoint del calendario pagaria su propia
 * tarifa por la misma fecha.
 *
 * `dep` y `ret` llegan como Date desde `model.validate()`, y SerpAPI exige
 * `YYYY-MM-DD`: mandarle un ISO con hora y minutos (que es lo que sale de
 * `toISOString()`) devuelve 400 y la app cae a estimado sin avisar. Por eso se
 * normalizan acá y no se confía en que el llamador traiga el formato correcto.
 */
function isoDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : '';
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

async function getLiveFlightQuote(destinationIata, dep, ret, style, origin) {
  return flightProviders.getQuote(origin || 'MVD', destinationIata, isoDate(dep), isoDate(ret), style);
}

async function cotizar(req, res, url) {
  if (limited('cotizar:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    v = model.validate(Object.fromEntries(url.searchParams), today);
  } catch (e) {
    return sendJson(res, e.status || 400, { error: e.message });
  }
  if (!VALID_DESTINATION_KEYS.has(v.S.dest)) return sendJson(res, 400, { error: 'Elegí un destino disponible en el buscador.' });
  const origin = String(url.searchParams.get('origin') || 'MVD').toUpperCase();
  if (!['MVD', 'PDP'].includes(origin)) return sendJson(res, 400, { error: 'El aeropuerto de salida debe ser MVD o PDP.' });
  v.S.origin = origin;
  const subcategory = String(url.searchParams.get('subcategory') || '').slice(0, 100);
  v.S.fuelPriceUsd = Number(process.env.BRAZIL_GAS_PRICE_USD) || 1.2;
  // La pantalla inicial anda con una tarifa real de vuelo para la ruta/fechas
  // elegidas cuando está disponible; si el buscador falla o no está configurado,
  // se cae de vuelta a la estimación local sin romper la respuesta.
  let quotes = {};
  let liveQuoteApplied = false;
  const destCfgForQuote = model.DEST[v.S.dest];
  if (v.S.transport === 'flight' && destCfgForQuote && destCfgForQuote.modes.avion_mvd) {
    try {
      const quote = await getLiveFlightQuote(airportFor(v.S.dest), v.dep, v.ret, v.S.style, origin);
      if (quote) { quotes = { avion_mvd: quote }; liveQuoteApplied = true; }
    } catch (e) {
      console.error('[cotizar] tarifa real de vuelo no disponible:', e.message);
    }
  }
  const hotelType = resolveHotelType(url.searchParams.get('hotel_type'), subcategory, v.S.style);
  v.S.hotelType = hotelType;
  const result = adaptPackagesToStyle(model.compute(v.S, v.dep, v.ret, today, quotes), v.S, v.dep, v.ret, today);
  const recommendedProposal = result.list.find(function (proposal) { return proposal.id === result.recId; });
  /* ---------- dos paradas en un mismo viaje ---------- */
  // Antes esto era un caso unico: un regex sobre el texto de la subcategoria
  // ("búzios + arraial") que/armaba exactamente dos paradas, buz y arraial, con
  // un traslado de 30 dolares por pasajero escrito a mano. No habia forma de
  // combinar Paraty con Angra, ni Bombinhas con Praia do Rosa, ni ninguna otra
  // pareja.
  //
  // Ahora la combinacion viaja como un parametro: `dest` es la primera parada y
  // `second` la segunda. Que dos paradas sean combinables no se decide con una
  // lista sino con la geografia: model.comboTransfer() devuelve null si el par
  // no existe, no tiene coordenadas, o queda a mas de COMBO_MAX_KM. Asi no hay
  // una octava lista que se pueda desincronizar.
  const secondKey = String(url.searchParams.get('second') || '').trim().toLowerCase();
  let comboTransfer = null;
  if (secondKey) {
    comboTransfer = model.comboTransfer(secondKey, v.S.dest, v.S.pax, v.S.kmPerLiter, v.S.fuelPriceUsd);
    if (!comboTransfer) {
      return sendJson(res, 400, {
        error: model.DEST[secondKey]
          ? 'No se puede combinar ' + model.DEST[secondKey].name + ' con ' + model.DEST[v.S.dest].name + ': quedan demasiado lejos para un mismo viaje.'
          : 'Ese segundo destino no existe.'
      });
    }
  }
  // El hub es el aeropuerto de la primera parada. Las dos paradas de un mismo
  // grupo regional comparten aeropuerto, asi que el vuelo redondo alcanza y no
  // hay que modelar open-jaw. Si alguna combinacion futura no lo cumpliera,
  // comboTransfer traeria las dos claves y habria que avisarlo.
  //
  // El hub se resuelve con airportFor() y NO con DEST[].iata, que son cosas
  // distintas: DEST.rio.iata es 'RIO' (Santos Dumont, solo domestico) mientras
  // que el vuelo desde Montevideo se compra con GIG (Galeao), que es lo que
  // AIR_DESTINATIONS dice. Comparando los iata del modelo, todo par de Rio
  // daba sharedHub false y pintaba "las dos paradas no comparten aeropuerto:
  // este precio asume un vuelo redondo a RIO" — un aviso falso sobre un vuelo
  // que en realidad ya se cotizó por GIG.
  const firstCfg = model.DEST[v.S.dest], secondCfg = secondKey ? model.DEST[secondKey] : null;
  const firstHub = airportFor(v.S.dest), secondHub = secondKey ? airportFor(secondKey) : '';
  const sharedHub = !!(firstCfg && secondCfg && firstHub && secondHub && firstHub === secondHub);
  const multiStay = comboTransfer && recommendedProposal ? {
    hub: { name: firstCfg.region || firstCfg.name, iata: firstHub || firstCfg.iata },
    sharedHub: sharedHub,
    hubWarning: sharedHub ? null : 'Las dos paradas no comparten aeropuerto: este precio asume un vuelo redondo a ' + (firstHub || firstCfg.iata) + '.',
    stays: [
      { key: v.S.dest, name: firstCfg.name, nightlyRates: model.lodgingNightlyCosts(v.S.dest, recommendedProposal.ti, v.dep, v.nights) },
      { key: secondKey, name: secondCfg.name, nightlyRates: model.lodgingNightlyCosts(secondKey, recommendedProposal.ti, v.dep, v.nights) }
    ],
    transfer: comboTransfer,
    transferBetweenUsd: comboTransfer.totalUsd,
    transferBetweenLabel: comboTransfer.label
  } : null;
  const nonHotelCost = recommendedProposal ? Number(recommendedProposal.total) - Number(recommendedProposal.parts.alojamiento || 0) : 0;
  const hotelBudgetPerNight = url.searchParams.has('hotel_budget_per_night')
    ? Number(url.searchParams.get('hotel_budget_per_night'))
    : (v.S.budget > 0 ? Math.max(0, (v.S.budget - nonHotelCost) / Math.max(1, v.nights) / Math.ceil(Math.max(1, v.S.pax) / 2)) : null);
  const hotelExtra = { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, nights: v.nights, hotelType: hotelType, subcategory: subcategory };
  if (Number.isFinite(hotelBudgetPerNight) && hotelBudgetPerNight >= 0) hotelExtra.hotelBudgetPerNight = hotelBudgetPerNight;
  const localTransport = calculateLocalTransportCost({ style: v.S.style, dest: v.S.dest, nights: v.nights, pax: v.S.pax });
  /* Los tours se piden aca y NO en /api/hoteles, que es el otro candidato
     natural: /api/hoteles se llama DESPUES, para pintar los hoteles, y la
     seccion de tours se dibuja junto con el resto del detalle. Si esperaran a
     esa segunda respuesta, la seccion apareceria un instante despues del resto
     del detalle, que es la sensacion de "algo todavia esta cargando" que la
     pagina no quiere.
   */
  const [toursList, toursSecond] = await Promise.all([
    tours.destino(v.S.dest),
    secondKey ? tours.destino(secondKey) : Promise.resolve([])
  ]);
  sendJson(res, 200, Object.assign({
    meta: {
      mode: liveQuoteApplied ? 'live' : 'estimated',
       dest: { key: v.S.dest, name: model.DEST[v.S.dest].name, region: model.DEST[v.S.dest].region || '', country: model.DEST[v.S.dest].country || 'Brasil' }, origin: origin, subcategory: subcategory, hotelType: hotelType, hotelTypeLabel: HOTEL_TYPE_LABELS[hotelType] || 'Intermedio', multiStay: multiStay,
      dep: v.S.dep, ret: v.S.ret, nights: v.nights, pax: v.S.pax, budget: v.S.budget, style: v.S.style,
      costBasis: Object.assign({}, model.REAL_COSTS, { destinationCosts: model.DESTINATION_COSTS }), roadtrip: roadtripCost(v.S.dest, v.S.kmPerLiter), officialTransfer: transferConfig(v.S.dest, v.S.pax), localTransport: localTransport,
      hotels: [], hotelsPending: true, hotelBudgetPerNight: Number.isFinite(hotelBudgetPerNight) ? hotelBudgetPerNight : hotelBudgetTarget(v.S.dest, v.S.style, hotelExtra), hotelsNearby: '', generatedAt: new Date().toISOString(),
      /* Los tours del destino, ya con el precio convertido a USD.
         *
         * Van en el meta de /api/cotizar y no en un endpoint aparte a proposito:
         * esta respuesta ya se pide una vez por propuesta, asi que no suma
         * ninguna request ni latency nueva. Un /api/tours seria un request mas
         * que la pagina tiene que esperar antes de pintar las cards.
         *
         * Con segundo destino van los suyos en toursSecond, con la misma logica
         * que los hoteles: sin ese campo el front no podria distinguir "no hay
         * tours ahi" de "no se consulto". */
      tours: toursList,
      toursSecond: toursSecond,
      /* De donde salieron: 'supabase' si se leyo la tabla, 'json' si cayo al
         respaldo local. Sirve para diagnosticar desde la consola si la tabla
         esta bien cargada, sin tener que abrir Supabase. */
      toursSource: tours.estado()
    },
    localTransport: localTransport
  }, result));
}

/* Guia Secreta: el token que abre la puerta.
 *
 * QUE CONDICION ABRE LA GUIA
 * Elegir un hotel con precio real de Booking. No "comprar": la app no tiene
 * compra de hotel, el card abre Booking.com en otra pestana y el server nunca
 * se entera de si el usuario reservo. La unica señal real que existe es que
 * /api/hoteles devolvio al menos un hotel con source === 'booking', o sea algo
 * que se puede reservar de verdad y no una estimacion del modelo.
 *
 * POR QUE UN TOKEN Y NO UN CHECK EN EL PARAMETRO
 * Si /api/guia aceptara solo ?dest=rio, seria un endpoint publico: la guia
 * completa se bajaria con una llamada curl, que es exactamente el problema que
 * movimos el archivo a lib/ para arreglar. El token ata la guia a que el
 * cliente haya pasado por la busqueda de hoteles de ESE destino, que es la
 * unica forma de tener un hotel de Booking.
 *
 * LO QUE ESTO NO ES
 * No es un secreto criptografico. Quien llame a /api/hoteles con fechas
 * validas recibe un token y despues puede pedir la guia. La diferencia real con
 * antes es que el contenido dejo de estar en el bundle de todo el mundo y en
 * el precache del service worker, y que no se lee con el verificador de
 * elementos ni sale con window.print(). Para que sea un secreto de verdad
 * hace falta atarlo a la sesion del usuario, que es el paso siguiente.
 *
 * La firma usa BOOKING_API_KEY porque es un secreto que el server ya tiene y
 * que nunca sale al cliente. Si falta, no se firma nada y la guia no se abre:
 * falla cerrado, porque un token sin secreto seria un token que cualquiera
 * puede fabricar.
 */
function guiaSecret() {
  return String(process.env.GUIA_TOKEN_SECRET || process.env.BOOKING_API_KEY || '').trim();
}
function guiaToken(dest) {
  const secret = guiaSecret();
  if (!secret) return null;
  const payload = String(dest) + '.' + (Date.now() + 30 * 60 * 1000);
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return payload + '.' + sig;
}
function guiaTokenValido(token, dest) {
  const secret = guiaSecret();
  if (!secret || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [key, exp, sig] = parts;
  if (key !== String(dest)) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const esperado = crypto.createHmac('sha256', secret).update(key + '.' + exp).digest('hex');
  // Comparacion de tiempo constante: no filtra cuanto coincidieron los
  // caracteres, asi que un atacante no puede adivinar la firma probando.
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* GET /api/guia?dest=X&token=T
 * Devuelve la guia de un destino, o 403 si el token no vale. Sin token
 * valido responde 403 y no una lista vacia: vacia parece un destino sin guia
 * escrito, que es otra cosa. */
function servirGuiaSecreta(req, res, url) {
  const dest = String(url.searchParams.get('dest') || '').toLowerCase();
  if (!dest || !VALID_DESTINATION_KEYS.has(dest)) return sendJson(res, 400, { error: 'Destino desconocido.' });
  if (!guiaTokenValido(url.searchParams.get('token'), dest)) {
    return sendJson(res, 403, { error: 'La Guia Secreta se abre eligiendo un hotel con precio real de Booking.' });
  }
  const guia = guiSecreta.guiaPara(dest, model.DEST[dest].region);
  if (!guia) return sendJson(res, 404, { error: ' todavia no hay una guia escrita para este destino.' });
  return sendJson(res, 200, { guia: guia });
}

async function cotizarHoteles(req, res, url) {
  if (limited('hoteles:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas de alojamiento. Esperá un minuto y probá de nuevo.' });
  let v;
  try { v = model.validate(Object.fromEntries(url.searchParams), model.getToday()); }
  catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
  if (!VALID_DESTINATION_KEYS.has(v.S.dest)) return sendJson(res, 400, { error: 'Elegí un destino disponible en el buscador.' });
  const dest = model.DEST[v.S.dest];
  const hotelType = resolveHotelType(url.searchParams.get('hotel_type'), url.searchParams.get('subcategory'), v.S.style);
  const rawBudget = url.searchParams.get('hotel_budget_per_night');
  const extra = { dep: v.S.dep, ret: v.S.ret, pax: v.S.pax, nights: v.nights, hotelType: hotelType, subcategory: url.searchParams.get('subcategory') || '' };
  if (rawBudget !== null && Number.isFinite(Number(rawBudget)) && Number(rawBudget) >= 0) extra.hotelBudgetPerNight = Number(rawBudget);
  const hotelDiag = {};
  // Segunda parada del viaje combinado. Antes el endpoint solo miraba `dest`, y
  // el alojamiento de la segunda parada se cobraba con el promedio del modelo
  // (lodgingNightlyCosts) sin que el usuario lo pudiera ver ni cambiar: en la
  // MISMA seccion, un hotel real de Booking en la primera parada y un numero
  // inventado en la segunda, sin que nada lo dijera.
  //
  // La clave se valida con comboTransfer(), el mismo criterio que usa
  // /api/cotizar: si el par no existe o queda muy lejos no se gasta una consulta
  // de Booking en un destino que no se va a cotizar.
  const secondKey = String(url.searchParams.get('second') || '').trim().toLowerCase();
  let second = null;
  if (secondKey) {
    if (!VALID_DESTINATION_KEYS.has(secondKey) ||
        !model.comboTransfer(secondKey, v.S.dest, v.S.pax, v.S.kmPerLiter, v.S.fuelPriceUsd)) {
      return sendJson(res, 400, { error: 'Esa segunda parada no se puede combinar con el destino elegido.' });
    }
    second = model.DEST[secondKey];
  }
  const hotelDiagSecond = {};
  // Las dos paradas se piden en paralelo. Encadenadas, una propuesta combinada
  // tardaba el doble en pintar los hoteles, que es justo la seccion que la
  // persona esta mirando para decidir.
  const [hotels, hotelsSecond] = second
    ? await Promise.all([
      hotelRecommendations(v.S.dest, dest.name, v.S.style, extra, hotelDiag),
      hotelRecommendations(secondKey, second.name, v.S.style, extra, hotelDiagSecond)
    ])
    : [await hotelRecommendations(v.S.dest, dest.name, v.S.style, extra, hotelDiag), []];
  const nearbyOf = function (list, baseName) {
    return (list.find(function (hotel) { return hotel.areaLabel && hotel.areaLabel !== baseName; }) || {}).areaLabel || '';
  };
  // El selector de tipo de alojamiento es uno solo para las dos paradas, asi que
  // solo puede ofrecer los tipos que existen en AMBAS. Con el de la primera nada
  // mas, elegir "boutique" con una segunda parada sin boutique dejaba un grupo
  // entero vacio al lado del otro lleno.
  let tiposDisponibles = hotelDiag.tiposDisponibles || null;
  if (second && Array.isArray(tiposDisponibles) && Array.isArray(hotelDiagSecond.tiposDisponibles)) {
    tiposDisponibles = tiposDisponibles.filter(function (tipo) {
      return hotelDiagSecond.tiposDisponibles.indexOf(tipo) >= 0;
    });
  }
  return sendJson(res, 200, {
    hotels: hotels,
    hotelBudgetPerNight: hotelBudgetTarget(v.S.dest, v.S.style, extra), hotelType: hotelType,
    hotelsNearby: nearbyOf(hotels, dest.name),
    hotelsPorPlaya: hotelDiag.hotelsPorPlaya || [],
    hotelsPorPlayaSecond: hotelDiagSecond.hotelsPorPlaya || [],
    // Lo mismo para la segunda parada. Sin estos campos `hotelsSecond` seria []
    // y el front no distinguiria "no hay hoteles ahi" de "no se consulto".
    hotelsSecond: hotelsSecond,
    hotelsNearbySecond: second ? nearbyOf(hotelsSecond, second.name) : '',
    hotelBudgetPerNightSecond: second ? hotelBudgetTarget(secondKey, v.S.style, extra) : null,
    secondKey: second ? secondKey : '',
    secondName: second ? second.name : '',
    // Que el frontend pueda distinguir "precio real de Booking" de "estimado del
    // modelo" sin adivinar por la forma del dato. Con la key sin suscribir,
    // bookingCount viene 0 y bookingError explica por que.
    bookingCount: Number(hotelDiag.bookingCount) || 0,
    bookingError: hotelDiag.bookingError || null,
    bookingCountSecond: Number(hotelDiagSecond.bookingCount) || 0,
    bookingErrorSecond: hotelDiagSecond.bookingError || null,
    // Que tipos de alojamiento offering de verdad para este destino. El selector
    // los ofrece todos y con esto puede dejar de ofrecer los que no existen: en Rio
    // no hay ni un resort entre los 20 hoteles que trae Booking, y ofrecerlo
    // llevaba a una lista vacia. Sale gratis porque los 20 ya vienen sin filtrar
    // por tipo: se corre el mismo filtro que se usaria para mostrarlos.
    tiposDisponibles: tiposDisponibles,
    // El token que abre la Guia Secreta. Solo se firma si hay al menos un hotel
    // con precio real de Booking entre los que seDevuelven: sin booking no hay
    // nada que reservar, asi que no hay guia que mostrar. El cliente lo guarda
    // y lo presenta despues en /api/guia.
    guiaToken: (hotels.some(function (h) { return h && h.source === 'booking'; }) ? guiaToken(v.S.dest) : null)
  });
}

function cotizarTodos(req, res, url) {
  if (limited('cotizar-todos:' + clientIp(req))) return sendJson(res, 429, { error: 'Demasiadas búsquedas seguidas. Esperá un minuto y probá de nuevo.' });
  const today = model.getToday();
  let v;
  try {
    // La validación del viaje es compartida con la cotización individual; el
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
  // cada destino dispararía hasta 19 requests externos en un solo clic.
  const options = HOME_DESTINATION_KEYS.map(function (key) {
    const trip = Object.assign({}, v.S, { dest: key });
    const result = adaptPackagesToStyle(model.compute(trip, v.dep, v.ret, today, {}), trip, v.dep, v.ret, today);
    const rec = result.list.find(function (p) { return p.id === result.recId; });
    return {
      dest: { key: key, name: model.DEST[key].name, region: model.DEST[key].region || '', country: model.DEST[key].country || 'Brasil' }, total: rec.total, pp: rec.pp,
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

// Páginas que sólo existen durante el prelanzamiento: la app de cotización. La
// raíz del dominio muestra la waitlist al público, así que ésta no puede quedar
// accesible sólo por adivinar la URL.
//
// El candado va por ARCHIVO y no por ruta a propósito: la app también se alcanza
// como /app, como /app/ y como /index.html (el catch-all de más abajo sirve ese
// archivo directamente). Filtrando sólo la ruta /app, esas otras entradas
// quedarían abiertas.
//
// grupo.html NO va acá a propósito. El reparto de gastos es un link para
// mandar por WhatsApp: si pidiera user/pass, el receptor no podría abrirlo y la
// vista previa del link (que no manda credenciales) saldría como "Acceso
// restringido" en vez de mostrar el nombre del viaje. Queda abierto, y no
// contradice el motivo del candado: el riesgo era /api/cotizar y /api/hoteles
// respondiendo sin contraseña y quemando cuota de SerpAPI y de Booking, y /grupo no
// toca ninguno de los dos (sólo /api/config, que ya es público, y Supabase
// directo con la anon key). El acceso a los datos de un grupo lo protege el
// uuid de la URL, no el candado: es el mismo modelo que ya estaba antes.
const PRELAUNCH_FILES = new Set(['index.html']);

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

// Rutas que NO pasan por el candado de pre-lanzamiento. Queda vacío a propósito:
// el único que lo necesitaba era el webhook de Duffel, que ya no existe porque
// la app ya no emite boletos. Todos los endpoints de la API, incluido el
// calendario de vuelos, siguen pidiendo user/pass.
const PRELAUNCH_EXEMPT = new Set();

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
// app.js pesa ~350KB sin minificar. Comprimirlo con gzipSync() bloquea el event
// loop del proceso durante toda la compresión, y como vercel.json rutea
// /(.*) a esta función no hay CDN de estáticos delante: cada cache miss pagaba
// una lectura de disco + una compresión de 350KB en el hilo único, con todas las
// requests concurrentes esperando. El resultado se cachea por archivo+mtime para
// que solo se pague una vez por despliegue.
const gzipCache = new Map();
function gzipCached(file, mtimeMs, payload) {
  const key = file + '|' + mtimeMs;
  const hit = gzipCache.get(key);
  if (hit) return hit;
  const compressed = zlib.gzipSync(payload, { level: 6 });
  // Poda de seguridad: si se despliega muchas veces sin reiniciar, el mapa no
  // tiene que crecer sin límite.
  if (gzipCache.size > 24) gzipCache.clear();
  gzipCache.set(key, compressed);
  return compressed;
}
function serveStatic(req, res, pathname, transform) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/waitlist.html';
  if (checkPrelaunchAccess(req, res, rel)) return;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && file.indexOf(PUBLIC_DIR + path.sep) !== 0) { res.writeHead(403); return res.end('Prohibido'); }
  fs.stat(file, function (statErr, stat) {
    if (statErr) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    fs.readFile(file, function (err, data) {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    const ext = path.extname(file);
    // Las vistas previas se nombran con _ y son de desarrollo: no entran al
    //Analytics, asi que no mandan datos de una pagina que no existe.
    const esPreview = path.basename(file).charAt(0) === '_';
    const send = function (payload) {
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        // Solo lo que lleva un `?v=N` explicito es inmutable: cambiar el archivo
        // implica bumpear la version, asi que cachearlo fuerte es seguro y evita
        // redescargar app.js/style.css enteros en cada visita. Lo demas va con
        // no-cache para que el HTML de entrada (que es quien lleva el ?v=N) se
        // vuelva a pedir y pueda apuntar a una version nueva.
        //
        // Antes la condición era `req.url.indexOf('?') >= 0`, o sea CUALQUIER
        // query string. Eso congelaba un año el HTML de entrada de cualquier
        // visita con tag de marketing: /app?utm_source=ig o /?utm_source=whatsapp.
        // Y como el HTML es justamente el que referencia app.js?v=N, un link de
        // Instagram dejaba pineado el app shell entero: un ?v=71 futuro nunca
        // llegaba a ese usuario. Para una app que se abre desde WhatsApp e
        // Instagram, el caso con utm es el caso normal, no el borde.
        'Cache-Control': /[?&]v=\d+/.test(req.url) ? 'public, max-age=31536000, immutable' : 'no-cache',
        'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        // Vary tiene que ir en AMBAS variantes (comprimida y sin comprimir): si
        // solo va en la comprimida, un cache compartido puede guardar la
        // respuesta identity y la gzip bajo la misma URL y despues servirle
        // gzip a un cliente que no lo pidio.
        'Vary': 'Accept-Encoding'
      };
      if (COMPRESSIBLE_EXT.has(ext) && payload.length > 512) {
        const acceptEncoding = String(req.headers['accept-encoding'] || '');
        if (acceptEncoding.indexOf('gzip') >= 0) {
          headers['Content-Encoding'] = 'gzip';
          res.writeHead(200, headers);
          return res.end(gzipCached(file, stat.mtimeMs, payload));
        }
      }
      res.writeHead(200, headers);
      res.end(payload);
    };
    // `transform` deja reescribir el archivo antes de mandarlo (ver
    // serveGrupoPage). Si falla, se manda el archivo original: una vista
    // previa sin el nombre del viaje es mucho mejor que una página rota.
    if (typeof transform !== 'function') return send(injectAnalytics(data, esPreview ? '.bin' : ext));
    Promise.resolve(transform(data)).then(function (out) { send(injectAnalytics(out, esPreview ? '.bin' : ext)); }).catch(function () { send(injectAnalytics(data, esPreview ? '.bin' : ext)); });
    });
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// La página de /grupo es una SPA: el navegador arma todo con JS, así que si el
// servidor entrega el HTML tal cual, la vista previa del link que se pega en
// WhatsApp o iMessage no tiene idea de qué viaje es. Con el nombre del grupo
// en los og:tags, la vista previa ya sale con el nombre del viaje.
const grupoNameCache = new Map();
const grupoNameInFlight = new Map();
const GRUPO_NAME_TTL_MS = 60000;
const GRUPO_NAME_STALE_MS = 3600000; // hasta una hora de datos viejos antes de cortar
const GRUPO_NAME_MAX = 500;
async function grupoNombre(groupId) {
  const cached = grupoNameCache.get(groupId);
  const age = cached ? Date.now() - cached.at : Infinity;
  if (cached && age < GRUPO_NAME_TTL_MS) return cached.name;
  // Un link compartido en un grupo de 200 personas abre 200 veces casi juntas.
  // Con stale-while-revalidate cada una sale con la última respuesta buena sin
  // esperar el round-trip, y sólo una pega a Supabase por grupo. El nombre del
  // viaje es un dato cosmético para la vista previa: que llegue con hasta una
  // hora de atraso no molesta, y por eso el HTML sin nombre es un resultado
  // aceptable (y el que se devuelve si la consulta falla).
  if (cached && age < GRUPO_NAME_STALE_MS) {
    grupoNombreRefresh(groupId);
    return cached.name;
  }
  return grupoNombreRefresh(groupId);
}
// Deduplica refrescos: si llegan 50 requests juntas y no hay nada cacheado,
// sale una sola consulta, no 50. El resultado (incluido el fallo) se comparte
// con todas las que estavam esperando.
function grupoNombreRefresh(groupId) {
  const pending = grupoNameInFlight.get(groupId);
  if (pending) return pending;
  const request = fetchGrupoNombre(groupId).then(function (name) {
    grupoNameInFlight.delete(groupId);
    if (name) {
      // Cache acotada: los ids son uuid que cualquiera puede inventar, así que
      // un crawler probando /grupo/<random> no debe hacer crecer el Map sin fin.
      if (grupoNameCache.size >= GRUPO_NAME_MAX) {
        const oldest = grupoNameCache.keys().next().value;
        grupoNameCache.delete(oldest);
      }
      grupoNameCache.set(groupId, { name, at: Date.now() });
    }
    return name;
  }, function () {
    grupoNameInFlight.delete(groupId);
    return null;
  });
  grupoNameInFlight.set(groupId, request);
  return request;
}
async function fetchGrupoNombre(groupId) {
  const url = process.env.SUPABASE_URL || 'https://hqyzmeordvjccytgltse.supabase.co';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!anonKey) return null;
  const endpoint = url + '/rest/v1/grupos_viaje?select=name&limit=1&id=eq.' + encodeURIComponent(groupId);
  const response = await fetchWithTimeout(endpoint, { headers: { apikey: anonKey, authorization: 'Bearer ' + anonKey, accept: 'application/json' } }, 2500);
  if (!response.ok) return null;
  const rows = await response.json();
  const name = rows && rows[0] && rows[0].name ? String(rows[0].name).trim() : '';
  return name || null;
}
function serveGrupoPage(req, res, groupId) {
  if (!groupId) { serveStatic(req, res, '/grupo.html'); return; }
  serveStatic(req, res, '/grupo.html', async function (data) {
    const name = await grupoNombre(groupId);
    if (!name) return data;
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
    const pageUrl = proto + '://' + String(req.headers.host || 'cuantosale.uy') + '/grupo/' + groupId;
    const title = escapeHtml(name + ' · CuántoSale');
    const description = escapeHtml('Sumate a dividir los gastos de "' + name + '" con tus amigos. No hace falta crear una cuenta.');
    const tags = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="CuántoSale">',
      '<meta property="og:title" content="' + title + '">',
      '<meta property="og:description" content="' + description + '">',
      '<meta property="og:url" content="' + escapeHtml(pageUrl) + '">',
      '<meta name="twitter:card" content="summary">',
      '<meta name="twitter:title" content="' + title + '">',
      '<meta name="twitter:description" content="' + description + '">'
    ].join('');
    let html = data.toString('utf8').replace(/<title>[\s\S]*?<\/title>/i, '<title>' + title + '</title>');
    html = html.replace('</head>', tags + '</head>');
    return Buffer.from(html, 'utf8');
  });
}

function createServer() {
  return http.createServer(function (req, res) {
    // Red de seguridad para TODO el handler. Antes cada ruta tenía su propio
    // try/catch y cinco no lo tenían (/api/destinos, /api/config,
    // /api/cotizar-todos, /api/destinos-destacados, /api/cargadores). Un throw
    // sincrónico ahí escapaba del listener y terminaba el proceso: en una
    // instancia de Vercel caliente, eso se llevaba por delante TODAS las
    // requests concurrentes como 502, no solo la que falló.
    try {
      handleRequest(req, res);
    } catch (error) {
      console.error('[servidor] ' + (req.url || '') + ' ->', error);
      if (res.headersSent) { try { res.end(); } catch (e) { /* socket ya muerto */ } return; }
      try { sendJson(res, 500, { error: 'Error inesperado. Probá de nuevo en un momento.' }); }
      catch (e) { try { res.end(); } catch (e2) { /* nada que hacer */ } }
    }
  });
}

// Un rechazo de promesa que nadie atiende también tumbaba el proceso. Se loguea
// y se sigue sirviendo: perder una búsqueda es un error, perder el servidor es
// una caída.
process.on('unhandledRejection', function (reason) {
  console.error('[servidor] promesa rechazada sin manejar:', reason);
});
process.on('uncaughtException', function (error) {
  console.error('[servidor] excepción sin capturar:', error);
});

function handleRequest(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
    // Candado de prelanzamiento para la API. Va antes de cualquier ruta para
    // que ningún endpoint quede por afuera, tampoco los POST de más abajo.
    //
    // Sin esto el candado sólo cerraba las páginas: /api/cotizar y /api/hoteles
    // seguían respondiendo 200 sin contraseña y devolvían cotizaciones reales,
    // consumiendo la cuota de SerpAPI y de Booking a nombre de cualquiera que
    // supiera la URL.
    if (url.pathname.indexOf('/api/') === 0 && !PRELAUNCH_PUBLIC_API.has(url.pathname) && !PRELAUNCH_EXEMPT.has(url.pathname)) {
      if (!prelaunchAuthorized(req)) return denyPrelaunchJson(res);
    }
    if (req.method === 'POST' && url.pathname === '/api/vuelos/buscar') {
      return readJson(req).then(function (body) { return buscarVuelos(req, res, body); }).catch(function (e) {
        sendJson(res, e.status || 400, { error: e.message || 'No pudimos leer la búsqueda.' });
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/vuelos/calendario') {
      return calendarioVuelos(req, res, url).catch(function (e) {
        console.error('[calendario-vuelos]', e.message);
        // El grafico es una mejora sobre la estimacion, nunca la unica fuente:
        // si falla, el cliente conserva lo que ya tinha y sigue funcionando.
        return sendJson(res, 200, { puntos: [], real: 0, estimados: 0, configured: true, error: e.message || 'No pudimos consultar los precios de otras fechas.' });
      });
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
    // Estado del cache de SerpAPI. Publico y sin costo: sirve para responder
    // "esto ya estaba cacheado?" antes de pedir algo y pagarlo dos veces.
    if (url.pathname === '/api/cache') {
      return sendJson(res, 200, flightProviders.stats());
    }
    if (url.pathname === '/api/tasas') {
    return getTasas().then(function (t) {
      return sendJson(res, 200, {
        monedas: MONEDAS, rates: t.rates, base: t.base,
        fuente: t.source, actualizado: t.at ? new Date(t.at).toISOString() : null
      });
    }).catch(function (e) {
      return sendJson(res, 503, { monedas: MONEDAS, rates: null, error: e.message });
    });
  }
  if (url.pathname === '/api/config') {
      return sendJson(res, 200, {
        supabaseUrl: process.env.SUPABASE_URL || 'https://hqyzmeordvjccytgltse.supabase.co',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        travelpayoutsMarker: process.env.TRAVELPAYOUTS_MARKER || '780345',
        // Si hay token, el server puede convertir los links de hotel en links de
        // afiliado. El front lo usa para saber si los clics generan comision.
        travelpayoutsConfigured: travelpayouts.isConfigured(),
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
        sendJson(res, 500, { error: 'Error inesperado. Probá de nuevo en un momento.' });
      });
    }
    if (url.pathname === '/api/hoteles') {
      return cotizarHoteles(req, res, url).catch(function (e) {
        console.error('[hoteles]', e);
        sendJson(res, 502, { error: 'No pudimos cargar alojamientos ahora.' });
      });
    }
    if (url.pathname === '/api/guia') {
      return servirGuiaSecreta(req, res, url);
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
    // en el navegador, así que el servidor siempre entrega el mismo HTML. Para
    // /grupo/<uuid> eso se completa con los og:tags del nombre del viaje, que
    // es lo único que un crawler o una vista previa de chat llega a ver.
    const grupoRoute = url.pathname.match(/^\/grupo(?:\/([0-9a-f-]{1,36}))?\/?$/i);
    if (grupoRoute) {
      try { serveGrupoPage(req, res, grupoRoute[1] || null); } catch (e) { res.writeHead(400); res.end(); }
      return;
    }
    if (/^\/waitlist\/?$/i.test(url.pathname)) {
      try { serveStatic(req, res, '/waitlist.html'); } catch (e) { res.writeHead(400); res.end(); }
      return;
    }
    /* El panel de edicion del catalogo de tours.
     *
     * Se declara como ruta propia y no cae en el serveStatic del final por
     * dos motivos. El primero es que el candado de prelanzamiento esta en
     * serveStatic: si /tours no pasara por aca, serviria el panel sin pedir
     * usuario y contrasena, o sea abierto a cualquiera que pruebe la ruta. El
     * segundo es que el panel tiene que quedar fuera del service worker y del
     * precache: es una pantalla de la agencia, no parte de la app.
     *
     * El permiso real no es este: el panel pide sesion de Supabase y las
     * funciones tours_guardar() comprueban es_agencia() dentro de la base. Esto
     * solo evita que la pagina se vea en una maquina que no es la del equipo. */
    // Paginas legales publicas: Google las pide para la pantalla de consentimiento del login.
    if (/^\/(privacidad|terminos)\/?$/i.test(url.pathname)) {
      return serveStatic(req, res, '/' + url.pathname.replace(/\//g, '').toLowerCase() + '.html');
    }
    if (/^\/tours\/?$/i.test(url.pathname)) {
      return serveStatic(req, res, '/tours.html');
    }
    // La raíz del dominio es la landing de waitlist mientras dure el
    // prelanzamiento; la app real de cotización queda corrida a /app, sin
    // link público hacia ella (nadie llega ahí por accidente).
    if (/^\/app\/?$/i.test(url.pathname)) {
      try { serveStatic(req, res, '/index.html'); } catch (e) { res.writeHead(400); res.end(); }
      return;
    }
    try { serveStatic(req, res, url.pathname); } catch (e) { res.writeHead(400); res.end(); }
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, function () {
    // El banner dice que proveedor esta activo. Con MOCK_FLIGHTS=1 el proyecto
    // responde precios, pero inventados: anunciar "precios reales" ahi seria
    // mentira, y es el unico lugar donde se ve de un vistazo que se esta
    // probando con datos falsos.
    const modoVuelos = flightProviders.providerName() === 'mock'
      ? 'MOCK_FLIGHTS=1; los precios de vuelo son INVENTADOS, no los gastes en produccion'
      : (flightProviders.isLive()
        ? 'precios de vuelo reales via SerpAPI'
        : 'sin SERPAPI_API_KEY; los vuelos mostraran precios estimados');
    console.log('CuántoSale en http://localhost:' + port + ' (' + modoVuelos + ')');
  });
}

const app = createServer();
module.exports = app;
// Vercel consume la función `app`; exponer el factory permite levantar un
// servidor aislado en las pruebas sin alterar el handler desplegado.
module.exports.createServer = createServer;
// Expuesto para las pruebas: el destino tiene que resolverse al aeropuerto real
// y no al código de ciudad, y esa diferencia no se ve desde afuera.
module.exports.airportFor = airportFor;
module.exports.hotelRecommendations = hotelRecommendations;
module.exports.fetchBookingHotels = fetchBookingHotels;
module.exports.normalizeHotelApiResponse = normalizeHotelApiResponse;
module.exports.selectThreeHotelsByBudget = selectThreeHotelsByBudget;
module.exports.resetBookingDestCache = resetBookingDestCache;
