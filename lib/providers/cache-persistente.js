'use strict';
/*
 * Cache persistente de tarifas de SerpAPI, sobre Supabase.
 *
 * POR QUÉ ESTO EXISTE
 *
 * lib/providers/index.js ya tenía dos caches: uno en memoria (Map) y otro en
 * disco (.serpapi-cache.json). Los dos sirven SI el proceso tiene un disco que
 * sobrevive entre requests. En Vercel no lo tiene: cada invocación corre en un
 * contenedor nuevo y el filesystem es de solo lectura fuera de /tmp.
 *
 * El síntoma era silencioso. saveCache() envolvía la escritura en un try/catch
 * que sólo logueaba "[serpapi] no se pudo guardar el cache", así que el server
 * arrancaba, servía el request en curso, y perdía todo. El cache que el README
 * describe como "lo que hace esto viable" no estaba haciendo nada en producción.
 *
 * Por qué eso cuesta plata: el gráfico "mismo viaje, otra fecha" pide 15 tarifas
 * por propuesta, o sea 15 créditos, y la serie se dispara sola al cotizar. Con el
 * cache muerto cada visita pagaba los 15 completos. Y la ventana de
 * model.seriesDates() es de -7 a +7 días con las mismas noches, así que dos
 * personas que buscan la misma ruta con un día de diferencia comparten 14 de 15
 * puntos. Ese solapamiento era el que debía amortizar la serie.
 *
 * EL DISEÑO
 *
 * 1. Todo sigue siendo SINCRÓNICO para el camino caliente: primero se mira el
 *    Map de memoria, que es gratis. La base solo se consulta cuando el Map no
 *    tiene la clave.
 *
 * 2. Las lecturas van EN LOTES. El calendario pide 15 puntos en un Promise.all;
 *    si cada uno leyera la base por su cuenta serían 15 requests HTTP por
 *    apertura de propuesta, que es peor que los 15 créditos que se intentarían
 *    ahorrar. Por eso el agregado pide un prefetch() de las 15 claves antes del
 *    Promise.all: una sola consulta, y después cada calendarPoint() encuentra su
 *    clave en el Map.
 *
 * 3. Las escrituras NO se esperan. Un fallo al guardar solo cuesta una consulta
 *    futura de más; vale más no hacer esperar la respuesta al usuario. Y van en
 *    lote por la misma razón.
 *
 * 4. Un timeout corto en la lectura. Si la base está lenta, el peor caso es que
 *    el punto se pida a SerpAPI, que es lo que pasaba siempre. Nunca al revés.
 *
 * 5. Si no hay configuración, o la base falla, o el timeout se vence, el módulo
 *    se hace el sordo. El comportamiento del server sin esta capa es exactamente
 *    el de hoy: cache en memoria, que en Vercel vale poco pero en local vale
 *    todo.
 */
// Mismo fetch con timeout que usa server.js para /grupo. Si el host es viejo no
// hay AbortSignal.timeout y se cae al camino de siempre.
function fetchWithTimeout(url, options, ms) {
  const init = Object.assign({}, options);
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    init.signal = AbortSignal.timeout(ms);
    return fetch(url, init);
  }
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  if (controller) {
    init.signal = controller.signal;
    const timer = setTimeout(function () { controller.abort(); }, ms);
    if (timer.unref) timer.unref();
    return fetch(url, init).finally(function () { clearTimeout(timer); });
  }
  return fetch(url, init);
}

/*
 * Credenciales.
 *
 * Solo la SERVICE ROLE puede tocar la tabla (las policies de serpapi_cache.sql
 * se lo niegan a anon). La anon key NO sirve: la app la manda al navegador para
 * el split de gastos, así que usarla acá abriría la tabla al público. Por eso
 * esta capa no arranca sin SUPABASE_SERVICE_ROLE_KEY, aunque haya SUPABASE_URL.
 */
function config() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SERPAPI_CACHE_DB_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key: key };
}

function enabled() {
  if (String(process.env.SERPAPI_CACHE_DB || '').trim() === '0') return false;
  return !!config();
}

function headers(key, extra) {
  return Object.assign({
    apikey: key,
    authorization: 'Bearer ' + key,
    accept: 'application/json'
  }, extra || {});
}

/* PostgREST filtra por comas, así que una clave con coma o paréntesis rompe la
 * consulta. Las claves las arma el propio index.js con '|' y fechas ISO, así que
 * esto no debería pasar nunca; el sanitize es para que un destino raro no
 * transforme un cache miss en un error 400 que tumbe la serie entera. */
function sanitizeKey(k) {
  return String(k).replace(/[,()%\s]/g, '_');
}

/**
 * Precarga N claves en el Map de memoria del agregador.
 *
 * Devuelve cuántas encontró. Se llama una vez por propuesta, antes de repartir
 * el trabajo en el Promise.all: una consulta para las 15 claves en vez de 15
 * consultas.
 *
 * @param {Map} cache  el Map de index.js, para llenarlo acá
 * @param {string[]} keys
 * @returns {Promise<number>} cuántas claves quedaron pobladas
 */
async function prefetch(cache, keys) {
  const cfg = config();
  const faltan = (keys || []).filter(function (k) {
    const hit = cache.get(k);
    return !(hit && Date.now() < hit.expiresAt);
  });
  if (!cfg || !faltan.length) return 0;

  const unicos = [];
  const vistos = new Set();
  faltan.forEach(function (k) {
    const s = sanitizeKey(k);
    if (!vistos.has(s)) { vistos.add(s); unicos.push(s); }
  });

  const ms = Number(process.env.SERPAPI_CACHE_DB_TIMEOUT_MS) || 1200;
  const url = cfg.url + '/rest/v1/serpapi_cache?select=key,value,expires_at&expires_at=gt.' +
    encodeURIComponent(new Date().toISOString()) +
    '&key=in.(' + unicos.map(encodeURIComponent).join(',') + ')';

  let rows;
  try {
    const res = await fetchWithTimeout(url, { headers: headers(cfg.key) }, ms);
    if (!res.ok) return 0;
    rows = await res.json();
  } catch (e) {
    // Un timeout o un 5xx acá NO es un error de la app: se sigue con SerpAPI,
    // que es exactamente lo que pasaba sin esta capa.
    return 0;
  }
  if (!Array.isArray(rows) || !rows.length) return 0;

  let cargadas = 0;
  rows.forEach(function (row) {
    if (!row || !row.key || !row.value) return;
    const exp = Date.parse(row.expires_at);
    if (!Number.isFinite(exp) || exp <= Date.now()) return;
    cache.set(row.key, { at: Date.now(), expiresAt: exp, value: row.value });
    cargadas += 1;
  });
  if (cargadas) console.log('[serpapi-cache] ' + cargadas + '/' + unicos.length + ' desde supabase');
  return cargadas;
}

/**
 * Guarda un lote de entradas. No espera: se dispara y se olvida.
 *
 * @param {Array<{key:string, value:*, expiresAt:number}>} entries
 */
function store(entries) {
  const cfg = config();
  const lista = (entries || []).filter(function (e) {
    return e && e.key && e.value != null && Number(e.expiresAt) > Date.now();
  });
  if (!cfg || !lista.length) return;

  const body = lista.map(function (e) {
    return {
      key: sanitizeKey(e.key),
      value: e.value,
      expires_at: new Date(Number(e.expiresAt)).toISOString()
    };
  });

  const url = cfg.url + '/rest/v1/serpapi_cache';
  const ms = Number(process.env.SERPAPI_CACHE_DB_TIMEOUT_MS) || 2500;
  fetchWithTimeout(url, {
    method: 'POST',
    headers: headers(cfg.key, {
      'content-type': 'application/json',
      // resolution=merge-duplicates hace que el POST sea un upsert: la clave
      // primaria ya existe en el caso normal (mismo punto, TTL renovado).
      prefer: 'resolution=merge-duplicates,return=minimal'
    }),
    body: JSON.stringify(body)
  }, ms).catch(function (e) {
    // Perder el cache es malo, pero vale más no romper el request que ya se
    // está por responder. El error queda en el log y el siguiente lo reintenta.
    console.warn('[serpapi-cache] no se pudo guardar:', e && e.message);
  });
}

module.exports = { enabled: enabled, prefetch: prefetch, store: store, config: config };
