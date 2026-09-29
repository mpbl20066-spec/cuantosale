'use strict';
/*
 * Lectura del catalogo de tours desde Supabase.
 *
 *   tours.destino(key)   -> Promise<[tour]>   (vacío si no hay tabla)
 *   tours.todos()        -> Promise<[tour]>
 *   tours.estado()       -> 'supabase' | 'json' | 'vacio'
 *
 * POR QUE UN ARCHIVO APARTE Y NO DENTRO DE server.js
 *
 * Es el mismo criterio que lib/providers/: server.js es el ruteo y ya tiene
 * 2100 lineas. La lectura de una tabla, con su cache y su degradacion, tiene
 * forma propia y se puede probar sola.
 *
 * LA TABLA ES CONTENIDO VENDIBLE Y ESTA CERRADA
 *
 * Los 111 tours estaban en public/app.js, o sea que cualquiera que bajara el
 * JS con curl tenia el catalogo entero con precios. Es el mismo problema que se
 * resolvio con la Guia Secreta: esa paso de public/guias.js a lib/guias.js y
 * ahora sale por /api/guia. Ver supabase_tours.sql para el porque de las RLS.
 *
 * aqui se lee con la SERVICE ROLE, que es la unica que pasa por encima de RLS.
 * La anon key NO sirve: va al navegador, y usarla abriria la tabla.
 *
 *
 * QUE PASA SI SUPABASE NO RESPONDE
 *
 * El catalogo se cae al JSON, que es el mismo de antes de la migracion. No es
 * un detalle menor: si el server se publica sin esto, la seccion de tours
 * desaparece de TODAS las propuestas y nadie se entera de por que.
 *
 * Por eso el respaldo NO es opcional y por eso la copia local tiene que estar
 * siempre commiteada: es lo unico que garantiza que la web siga mostrando
 * precios si la base no responde.
 *
 *
 * EL CACHE ES DE PROCESO, NO DE BD
 *
 * Como el resto de las cosas de este server (/api/cotizar-todos, los hoteles).
 * En Vercel cada instancia es efimera, asi que dos visitas pueden pegarle a
 * Supabase dos veces: es una tabla de 111 filas, no la cache de SerpAPI que si
 * cuesta plata, asi que no vale la pena el tripwire de cache-persistente.js.
 * Lo que si importa es el TTL corto, para que editar un tour en el panel se vea
 * sin esperar un redeploy.
 */
const fs = require('fs');
const path = require('path');

// La copia local. Va commiteada a proposito: es el respaldo del que se habla
// arriba. NO editar a mano: sale de data/tours.json con npm run build:tours.
const RESPALDO = path.join(__dirname, '..', 'public', 'tours.generated.js');

const TTL_MS = 60 * 1000;

// En memoria. La instance que atendio la propuesta anterior la tiene a mano.
let cache = null;
let cacheEn = 0;
let enVuelo = null;

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return { url: url, key: key };
}

function disponible() { return !!config(); }

// Normaliza una fila de la tabla al shape que espera el front. El nombre del
// tour no lo manda el front: las funciones de tours() filtran por key y arman
// el nombre con el destino.
function desdeFila(f, nombreDestino, cotizacion, margen) {
  let precio = f.precio;
  // La conversion se hace aca y no en SQL, aunque la funcion tambien la sabe
  // hacer. Motivo: este archivo es el unico que el server corre, y si la tabla
  // se llena a mano con tours_guardar() el precio_brl va a venir crudo. Si la
  // conversion viviera solo en SQL, alguien que escriba la fila desde la
  // consola de Supabase publicaria R$ 190 como si fueran US$ 190.
  if (f.precio_brl != null && cotizacion > 0) {
    precio = Number((Number(f.precio_brl) / cotizacion + margen).toFixed(2));
  } else if (f.precio_brl != null) {
    /* Sin cotizacion definida, el precio de origen es lo unico que hay.
     *
     * Se publica el numero crudo en vez del precio en dolares de la fila, que
     * en una fila guardada a mano suele venir en 0. Mostrar 0 seria peor que
     * mostrar el numero sin convertir: 0 es un precio que parece real y rompe el
     * total del viaje; 190 es un numero que se ve demasiado alto y se corrige.
     *
     * Solo pasa cuando data/tours.json no trae _meta.cotizacion_brl_usd, que es
     * una situacion de configuracion, no de datos. */
    precio = Number(f.precio_brl);
  }
  return {
    destinations: [String(f.destino)],
    destination: nombreDestino || String(f.destino).toUpperCase(),
    title: String(f.titulo),
    description: String(f.descripcion || ''),
    price: Number(precio),
    details: String(f.detalle || ''),
    // La procedencia viaja en el dato para que el front pueda decir de donde
    // sale el precio. Antes no habia ninguna: el precio era un numero que
    // alguien habia escrito en el codigo hace semanas.
    source: 'supabase',
    fuente: f.fuente || '',
    verificado: f.verificado || null
  };
}

function respaldo() {
  try {
    if (!fs.existsSync(RESPALDO)) return [];
    delete require.cache[require.resolve(RESPALDO)];
    const datos = require(RESPALDO);
    return Array.isArray(datos) ? datos : [];
  } catch (e) {
    return [];
  }
}

function meta() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tours.json'), 'utf8'));
    return { cotizacion: Number(j._meta && j._meta.cotizacion_brl_usd) || 0, margen: Number(j._meta && j._meta.margen_usd) || 0 };
  } catch (e) {
    return { cotizacion: 0, margen: 0 };
  }
}

async function pedirTodos() {
  const { url, key } = config();
  const m = meta();
  // El RPC y no un select directo: la tabla esta cerrada, y ademas la
  // funcion es la que sabe filtrar activo y devolver el precio ya convertido.
  const r = await fetch(url + '/rest/v1/rpc/tours_todos', {
    method: 'POST',
    headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ p_cotizacion_brl: m.cotizacion || null, p_margen_usd: m.margen || 0 })
  });
  if (!r.ok) {
    const texto = await r.text();
    throw new Error('tours_todos respondio ' + r.status + ': ' + texto.slice(0, 200));
  }
  return r.json();
}

/**
 * Todos los tours, con el cache de proceso.
 *
 * Nunca tira: si Supabase falla, devuelve la copia local. El error se loguea
 * una vez por TTL, no en cada request, porque si la base esta caida esto se
 * llama en cada propuesta y llenaria el log de Vercel de lineas iguales.
 */
async function todos() {
  const ahora = Date.now();
  if (cache && ahora - cacheEn < TTL_MS) return cache;

  // El vuelo en curso se comparte: sin esto, 20 propuestas simultaneas con la
  // cache vencida pegan 20 veces a Supabase para el mismo dato.
  if (enVuelo) return enVuelo;

  if (!config()) {
    const local = respaldo();
    cache = local;
    cacheEn = ahora;
    return cache;
  }

  enVuelo = pedirTodos().then((filas) => {
    if (!Array.isArray(filas) || !filas.length) {
      // Tabla vacia. Puede ser que este mal cargada. Es el mismo caso que la
      // base caida a proposito: se usa el respaldo y se avisa.
      console.warn('[tours] la tabla vino vacia; se usa la copia local');
      return respaldo();
    }
    const m = meta();
    const nombres = nombresDestinos();
    cache = filas.map((f) => desdeFila(f, nombres[String(f.destino)], m.cotizacion, m.margen));
    cacheEn = Date.now();
    return cache;
  }).catch((e) => {
    console.warn('[tours] no se pudo leer Supabase (' + e.message + '); se usa la copia local');
    return respaldo();
  }).finally(() => { enVuelo = null; });

  return enVuelo;
}

// El nombre legible de cada destino sale del mismo lugar que el respaldo: el
// mapa _destinos de data/tours.json, que ya esta verificado. Consultar el modelo
// por cada fila seria 111 llamadas a un require que ya esta en memoria; y
// mostrar la key ("BUZ") en la card seria un error visible.
let _nombres = null;
function nombresDestinos() {
  if (_nombres) return _nombres;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tours.json'), 'utf8'));
    _nombres = j._destinos || {};
  } catch (e) {
    _nombres = {};
  }
  return _nombres;
}

/** Los tours de un destino, en el shape que espera el front. */
async function destino(key) {
  const k = String(key || '').toLowerCase();
  if (!k) return [];
  const lista = await todos();
  return lista.filter((t) => t.destinations.indexOf(k) >= 0);
}

/** De donde vinieron los datos del ultimo uso. Para diagnostico. */
function estado() {
  if (!config()) return 'json';
  if (!cache) return 'vacio';
  if (cacheEn && Date.now() - cacheEn >= TTL_MS) return 'vencido';
  return 'supabase';
}

/** Para las pruebas: fuerza la proxima lectura. */
function invalidar() {
  cache = null;
  cacheEn = 0;
  enVuelo = null;
}

module.exports = { destino: destino, todos: todos, estado: estado, disponible: disponible, invalidar: invalidar, desdeFila: desdeFila };
