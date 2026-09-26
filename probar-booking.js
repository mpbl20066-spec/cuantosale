/*
 * Verificador de BOOKING_API_KEY.
 *
 *   node probar-booking.js [ciudad] [noches]
 *
 * Hace los mismos 3 calls que fetchBookingHotels() en server.js y te dice si
 * la key sirve y si las fotos llegan. No toca la app: solo consulta.
 *
 * Si esto imprime 3 hoteles con foto https, la app va a mostrar fotos.
 * Si dice "Falta BOOKING_API_KEY", la clave no esta en .env.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  try {
    fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
      .split(/\r?\n/)
      .forEach(function (line) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      });
  } catch (e) { /* sin .env */ }
}
loadEnv();

const KEY = process.env.BOOKING_API_KEY || '';
const HOST = String(process.env.BOOKING_API_HOST || 'booking-com15.p.rapidapi.com')
  .trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
const BASE = 'https://' + HOST;

const ciudad = process.argv[2] || process.env.BOOKING_DESTINATION || 'Florianópolis';
const noches = Number(process.argv[3]) || 7;

function iso(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function get(url) {
  const r = await fetch(url, {
    headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST, Accept: 'application/json' }
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch (e) { /* no es JSON */ }
  return { status: r.status, ok: r.ok, json: j, texto: t.slice(0, 300) };
}

/* misma logica que bookingPhoto() en server.js */
function bookingPhoto(hotel) {
  const queue = [hotel && (hotel.data || hotel.photoMainUrl || hotel.photo_main_url
    || hotel.main_photo_url || hotel.main_photo_url_https || hotel.max_photo_url
    || hotel.photo_url || hotel.image || hotel.photoUrls || hotel.photos || hotel.images)];
  const seen = new Set();
  while (queue.length) {
    const v = queue.shift();
    if (!v || seen.has(v)) continue;
    if (typeof v === 'string') {
      if (/^https:\/\//i.test(v)) return v;
    } else if (Array.isArray(v)) {
      v.forEach(x => queue.push(x));
    } else if (typeof v === 'object') {
      seen.add(v);
      ['url', 'photoUrl', 'photo_url', 'imageUrl', 'image_url', 'url_max',
        'url_max300', 'url_square60', 'src', 'photoUrls', 'photos', 'images', 'data']
        .forEach(k => { if (v[k]) queue.push(v[k]); });
    }
  }
  return '';
}

(async function main() {
  console.log('host:', HOST);
  if (!KEY) {
    console.log('\nFalta BOOKING_API_KEY en .env  -> la app cae al fallback y no hay fotos.');
    console.log('Eso explica el "Sin foto disponible".\n');
    process.exit(1);
  }
  console.log('key : ' + KEY.slice(0, 6) + '...' + KEY.slice(-4) + '  (' + KEY.length + ' chars)\n');

  /* 1) searchDestination */
  const dUrl = new URL('/api/v1/hotels/searchDestination', BASE);
  dUrl.searchParams.set('query', ciudad);
  dUrl.searchParams.set('locale', 'es');
  const d = await get(dUrl);
  console.log('1) searchDestination  HTTP ' + d.status);
  if (!d.ok) { console.log('   ' + d.texto + '\n'); process.exit(1); }
  const rows = Array.isArray(d.json) ? d.json : (d.json && d.json.data) || [];
  const target = rows.find(x => x && /city/i.test(String(x.search_type || x.dest_type || ''))) || rows[0];
  if (!target || target.dest_id == null || !target.search_type) {
    console.log('   No encontro la ciudad "' + ciudad + '".\n');
    process.exit(1);
  }
  console.log('   ok: ' + ciudad + '  dest_id=' + target.dest_id + '  type=' + target.search_type + '\n');

  /* 2) searchHotels */
  const hUrl = new URL('/api/v1/hotels/searchHotels', BASE);
  const p = {
    dest_id: String(target.dest_id), search_type: String(target.search_type),
    arrival_date: iso(30), departure_date: iso(30 + noches), adults: '2', room_qty: '1',
    page_number: '1', units: 'metric', languagecode: 'es', currency_code: 'USD'
  };
  Object.keys(p).forEach(k => hUrl.searchParams.set(k, p[k]));
  const h = await get(hUrl);
  console.log('2) searchHotels       HTTP ' + h.status);
  if (!h.ok) { console.log('   ' + h.texto + '\n'); process.exit(1); }
  const root = [h.json && h.json.data, h.json && h.json.result, h.json && h.json.results, h.json && h.json.hotels]
    .find(Array.isArray) || [];
  const hotels = root.filter(Boolean);
  console.log('   ' + hotels.length + ' hoteles\n');
  if (!hotels.length) { console.log('   La API respondio pero sin resultados.\n'); process.exit(1); }

  /* 3) revision de precio + foto */
  console.log('3) los primeros 6');
  let conFoto = 0;
  hotels.slice(0, 6).forEach((x, i) => {
    const prop = x.property || x;
    const foto = bookingPhoto(x) || bookingPhoto(prop);
    if (foto) conFoto++;
    const noche = Number(x.price_pn || x.perNight || x.per_night || 0);
    const br = x.priceBreakdown || x.price_breakdown || {};
    const gross = br.grossPrice || br.gross_price || {};
    const total = Number(gross.value || gross.amount || x.min_total_price || x.total_price || x.price || 0);
    console.log('   ' + (i + 1) + ') ' + String(prop.name || x.hotel_name || '?').slice(0, 44));
    console.log('      US$ ' + (noche || '?') + '/noche   total US$ ' + (total || '?') + '   ' + (foto ? 'FOTO ok' : 'SIN FOTO'));
    if (foto) console.log('      ' + foto.slice(0, 96));
  });

  const pct = Math.round(conFoto / Math.min(6, hotels.length) * 100);
  console.log('\n' + conFoto + '/' + Math.min(6, hotels.length) + ' con foto (' + pct + '%)');
  console.log(conFoto > 0
    ? '\nLa key funciona. Cargala en .env y en las variables de Vercel, y la app deja de mostrar "Sin foto disponible".\n'
    : '\nLa key responde pero NO viene ninguna foto: el plan no incluye images, o hay que pedir acceso a /hotels/getHotelPhotos.\n');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
