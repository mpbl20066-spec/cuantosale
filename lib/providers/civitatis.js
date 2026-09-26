'use strict';
/*
 * Civitatis: actividades y tours con precio real.
 *
 * Por que hace falta: los tours que tenia la app eran ~30 escritos a mano en
 * public/app.js, con precio estimado (florianopolisTourPrice dividia por una
 * cotizacion de la PTAX y le sumaba 5 dolares). Civitatis trae el catalogo real
 * con el precio de la fecha que esta mirando el usuario, que es justo lo que la
 * app promete: cuanto sale REALMENTE.
 *
 * Autenticacion: OAuth 2.0 client_credentials, que es lo que pide la
 * documentacion. El token dura poco, asi que se pide y se cachea aparte.
 *
 * Un detalle del modelo de Civitatis que hay que respetar: los IDs de destino
 * son suyos, no los nuestros. La app usa claves propias (rio, fln, buz...), y
 * para consultar hay que traducir con CIVITATIS_DESTINATIONS. Búzios esta
 * aparte a proposito: se pidio que quedara fuera de la integracion, y como el
 * filtro es por ID de destino y no por region, no se cuela con Rio de Janeiro
 * aunque Civitatis los agrupe.
 */

const API = 'https://api.civitatis.com';
const AUTH_URL = 'https://api.civitatis.com/v2/auth/token';

// El token de OAuth dura poco. 50 minutos deja margen sin repedirlo en cada
// request; si Civitatis lo cambia antes, el 401 dispara un reintento (ver abajo).
const TOKEN_TTL_MS = 50 * 60 * 1000;
// Las actividades cambian poco entre consultas. Cache largo porque el precio
// real se recalcula aparte por fecha (ver priceForDate).
const TTL_MS = 30 * 60 * 1000;

const cache = new Map();      // key -> { at, value }
const pending = new Map();    // key -> Promise
let fetchImpl = null;
let tokenCache = { token: '', at: 0 };

function config() {
  return {
    key: String(process.env.CIVITATIS_API_KEY || '').trim(),
    secret: String(process.env.CIVITATIS_API_SECRET || '').trim()
  };
}

function isConfigured() { return !!config().key && !!config().secret; }
function setFetch(fn) { fetchImpl = fn; cache.clear(); pending.clear(); tokenCache = { token: '', at: 0 }; }
function clearCache() { cache.clear(); pending.clear(); tokenCache = { token: '', at: 0 }; }

/*
 * Mapa destino-nuestro -> destinationId de Civitatis.
 *
 * Vive en una variable de entorno y no en el codigo para no tener que tocar el
 * repo cada vez que Civitatis cambia un ID. El formato es "rio=1,fln=2".
 *
 * Búzios va a proposito excluido: se pidio que los tours de Búzios sigan
 * saliendo de la lista local y no de la API.
 */
const EXCLUIDOS = new Set(['buz']);

function destinoIdDe(destKey) {
  const key = String(destKey || '').trim().toLowerCase();
  if (!key || EXCLUIDOS.has(key)) return null;
  const crudo = String(process.env.CIVITATIS_DESTINATIONS || '');
  for (const par of crudo.split(',')) {
    const [nuestro, suyo] = par.split('=').map(function (s) { return String(s || '').trim(); });
    if (nuestro === key && suyo) return suyo;
  }
  return null;
}

// De la moneda que devuelve la API a la que entiende la app. Civitatis acepta
// br, mx y ar como parametros regional, asi que se le pide la moneda del grupo
// cuando se puede.
function currencyArg(code) {
  const c = String(code || 'USD').toUpperCase();
  return ['USD', 'EUR', 'BRL', 'ARS', 'MXN', 'COP', 'CLP', 'PEN'].indexOf(c) >= 0 ? c : 'USD';
}

async function authToken() {
  const settings = config();
  if (!isConfigured()) {
    const error = new Error('Falta configurar CIVITATIS_API_KEY y CIVITATIS_API_SECRET.');
    error.status = 503;
    throw error;
  }
  if (tokenCache.token && Date.now() - tokenCache.at < TOKEN_TTL_MS) return tokenCache.token;

  const fetcher = fetchImpl || fetch;
  let response;
  try {
    response = await fetcher(AUTH_URL, {
      method: 'POST',
      headers: {
        // OAuth 2.0 client_credentials, segun la documentacion de Civitatis.
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(settings.key + ':' + settings.secret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
  } catch (cause) {
    const error = new Error('No se pudo conectar con Civitatis para pedir el token.');
    error.status = 502;
    throw error;
  }
  let payload;
  try { payload = await response.json(); } catch (e) {
    const error = new Error('Civitatis devolvio una respuesta invalida al pedir el token.');
    error.status = 502;
    throw error;
  }
  if (!response.ok || !payload || !payload.access_token) {
    const detail = String((payload && (payload.error_description || payload.error)) || 'credenciales rechazadas').slice(0, 180);
    const error = new Error('Civitatis (HTTP ' + response.status + '): ' + detail);
    // 401 = key o secret mal. Es el error de alta mas comun.
    error.status = response.status === 401 ? 401 : 502;
    throw error;
  }
  tokenCache = { token: String(payload.access_token), at: Date.now() };
  return tokenCache.token;
}

async function requestJson(path, options) {
  const token = await authToken();
  const fetcher = fetchImpl || fetch;
  const response = await fetcher(API + path, Object.assign({
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000)
  }, options || {}));

  // Un token puede vencer antes de lo que creimos expires_in. Un 401 se
  // resuelve tirando el token y reintentando una vez, no laissant toda la
  // pagina de tours vacia por un detalle de cache.
  if (response.status === 401) {
    tokenCache = { token: '', at: 0 };
    const nuevo = await authToken();
    const retry = await fetcher(API + path, Object.assign({
      headers: { Authorization: 'Bearer ' + nuevo, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    }, options || {}));
    if (!retry.ok) {
      const error = new Error('Civitatis (HTTP ' + retry.status + ').');
      error.status = retry.status;
      throw error;
    }
    return retry.json();
  }

  let payload;
  try { payload = await response.json(); } catch (e) {
    const error = new Error('Civitatis devolvio una respuesta JSON invalida.');
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    const detail = String((payload && (payload.message || payload.error)) || 'No se pudo consultar el catalogo.').slice(0, 180);
    const error = new Error('Civitatis (HTTP ' + response.status + '): ' + detail);
    error.status = response.status;
    throw error;
  }
  return payload || {};
}

// La respuesta de listado trae actividades con el precio base, no el de la
// fecha. Este helper deja cada una con los campos que la app ya sabe pintar.
function normalizar(actividad, currency) {
  const rates = Array.isArray(actividad.rates) ? actividad.rates : [];
  const precioMin = Number(actividad.minimumPrice);
  return {
    id: String(actividad.id || actividad.activityId || ''),
    title: String(actividad.title || actividad.name || 'Experiencia'),
    description: String(actividad.shortDescription || actividad.description || '').replace(/<[^>]*>/g, '').slice(0, 240),
    price: Number.isFinite(precioMin) ? precioMin : (rates[0] && Number(rates[0].price)) || 0,
    currency: String(actividad.currency || currency || 'USD').toUpperCase(),
    duration: Number(actividad.duration) || 0,
    image: String(actividad.mainImage || actividad.image || actividad.photo || ''),
    rating: Number(actividad.rating) || 0,
    reviewsCount: Number(actividad.reviewsCount || actividad.totalReviews || 0),
    freeCancellation: !!actividad.freeCancellation,
    url: String(actividad.url || ('https://www.civitatis.com/' + String(actividad.id || ''))).trim(),
    source: 'civitatis'
  };
}

/*
 * Actividades de un destino para una fecha.
 *
 * Hace dos llamadas porque Civitatis separa el catalogo del precio: el listado
 * trae minimumPrice, que es un piso, y el precio de la fecha concreta vive en
 * dynamic-prices. Mostrar el piso como si fuera el precio real seria mentir,
 * que es justo lo que la app no puede hacer.
 */
async function actividades(destKey, extra) {
  const destinoId = destinoIdDe(destKey);
  // Destino sin mapear, o excluido a proposito (Búzios): no se consulta.
  if (!destinoId) return [];

  const currency = currencyArg((extra && extra.currency) || 'USD');
  const dep = String((extra && extra.dep) || '').trim();
  const key = [destinoId, currency, dep].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  if (pending.has(key)) return pending.get(key);

  const params = new URLSearchParams({ currency: currency, limit: '12' });
  if (dep) { params.set('startDate', dep); params.set('endDate', dep); }
  const job = requestJson('/v2/destinations/' + encodeURIComponent(destinoId) + '/activities?' + params.toString())
    .then(function (payload) {
      const lista = Array.isArray(payload) ? payload : (payload.activities || payload.data || []);
      const vistas = lista.map(function (a) { return normalizar(a, currency); })
        // Sin precio o sin id no se pueden mostrar ni enlazar.
        .filter(function (a) { return a.id && a.price > 0; });
      if (cache.size > 300) cache.delete(cache.keys().next().value);
      cache.set(key, { at: Date.now(), value: vistas });
      return vistas;
    })
    .catch(function (error) {
      console.warn('[civitatis]', destKey, error.message);
      return [];
    })
    .finally(function () { pending.delete(key); });

  pending.set(key, job);
  return job;
}

/*
 * Precio real de una actividad en una fecha. Opcional a proposito: si falla, la
 * tarjeta sigue mostrando el minimumPrice y el usuario ve el precio exacto
 * al abrir. Perder el precio exacto es mejor que no mostrar la actividad.
 */
async function precioEnFecha(activityId, date, currency) {
  if (!activityId || !date) return null;
  const key = ['precio', activityId, date, currency].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const params = new URLSearchParams({ date: date, currency: currency || 'USD' });
    const payload = await requestJson('/v2/activities/' + encodeURIComponent(activityId) + '/dynamic-prices?' + params.toString());
    const precio = Number(payload && (payload.price || payload.amount || (payload.prices && payload.prices[0] && payload.prices[0].price)));
    if (!Number.isFinite(precio) || precio <= 0) return null;
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), value: precio });
    return precio;
  } catch (error) {
    return null;
  }
}

module.exports = { isConfigured, actividades, precioEnFecha, destinoIdDe, setFetch, clearCache };
