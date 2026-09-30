'use strict';
/*
 * Carga los tours de data/tours.json a la tabla public.tours de Supabase.
 *
 *   node scripts/cargar-tours.js
 *   node scripts/cargar-tours.js --dry-run     (no escribe, muestra el resumen)
 *
 * Es la carga inicial y tambien el camino para volver a subir todo despues de
 * editar el JSON. La edicion de a dia se hace en el panel de /tours, no por aca.
 *
 * POR QUE UN UPSERT Y NO TRUNCATE + INSERT
 *
 * El id de la tabla es un uuid que genera la base, y tours_guardar() identifica
 * una fila por (destino, titulo) en vez de por id. Eso obliga a que la clave
 * natural NO cambie: si el titulo se renombra, la fila vieja se queda como
 * "_titulo viejo" y aparece la nueva. Con truncate + insert eso no pasa.
 *
 * A cambio, un tour que se borro de la Sheet se va a quedar dando vueltas en la
 * base. Por eso al final se listan los sobrantes. No se borran solos: si el
 * pull fallo y leyo 3 filas, borrar 108 tours de la base seria un desastre. La
 * lista es para que los borres a mano cuando sepas que es correcto.
 *
 * EL PRECIO EN REALES SE MANDA EN LA COLUMNA precio_brl
 *
 * El JSON guarda las dos cosas: precio (USD, ya convertido) y precio_brl (el
 * numero de origen). Se sube el de origen cuando esta, porque es el unico que
 * sirve para re-cotizar cuando cambia la moneda. El USD queda en la columna
 * precio solo para los que no tienen precio_brl.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const JSON_PATH = path.join(RAIZ, 'data', 'tours.json');
const DRY = process.argv.includes('--dry-run');

/* Leer .env, igual que hace server.js al arrancar (ver loadEnv() en server.js).
 *
 * Sin esto el script no encuentra SUPABASE_URL ni SUPABASE_SERVICE_ROLE_KEY
 * aunque esten escritos en el archivo, y dice que faltan. Pasa siempre: server.js
 * las carga al arrancar, pero este script corre en una terminal nueva donde no hay
 * ningun proceso que haya arrancado antes. El error es confuso porque la linea
 * esta ahi a la vista.
 *
 * Lo que ya esta en process.env gana: si la variable se paso en la sesion, no se
 * pisa con el archivo. */
function cargarEnv() {
  try {
    fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).forEach(function (linea) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  } catch (e) { /* no hay .env: se usan las variables de la sesion */ }
}
cargarEnv();

// Cuantos registros manda cada pedido. Supabase acepta hasta 1000 filas por
// insert, pero 200 deja el pedido en un tamaño que se ve entero en un error y
// no parte la carga en trozos ilegibles.
const LOTE = 200;

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  // La SERVICE ROLE, no la anon. Es la unica que pasa por encima de RLS y la
  // tabla esta deliberadamente cerrada: el anon no podria escribirla.
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return { url: url, key: key };
}

async function rpc(fn, body) {
  const { url, key } = config();
  const r = await fetch(url + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: 'Bearer ' + key,
      'content-type': 'application/json',
      prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const texto = await r.text();
    throw new Error(fn + ' -> ' + r.status + ' ' + texto.slice(0, 300));
  }
  return r;
}

(async function () {
  if (!config()) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    console.error('');
    console.error('La service role va en .env (local) o en las variables de Vercel. En Supabase:');
    console.error('  Project Settings -> API Keys -> service_role');
    console.error('');
    console.error('Ojo: la anon key NO sirve. La tabla tours esta cerrada a proposito (ver');
    console.error('supabase_tours.sql) y solo la service role pasa por encima de RLS.');
    process.exit(1);
  }

  const datos = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const NOMBRES = datos._destinos || {};
  const fuente = (datos._meta && datos._meta.origen_de_esta_migracion) || 'migrado de data/tours.json';

  // La fila va con precio_brl si el JSON lo trae, y con precio solo si no. Es
  // al reves de lo que hace el build del cliente, y a proposito: aca se sube
  // el dato crudo, la conversion la hace tours_todos() cuando se lee.
  /* Un tour apagado y sin precio (esperando que le pongan uno) no se sube: la funcion
     tours_guardar_lote de la base rechaza cualquier fila sin precio, apagada o no, y
     tira abajo el lote entero. Queda en data/tours.json y se sube cuando tenga precio. */
  const sinPrecioApagados = datos.tours.filter((t) => t.activo === false && t.precio == null && t.precio_brl == null);
  const filas = datos.tours.map((t, i) => {
    if (sinPrecioApagados.includes(t)) return null;
    const f = {
      destino: t.destinos[0],
      titulo: t.titulo,
      descripcion: t.descripcion || '',
      detalle: t.detalle || '',
      activo: t.activo !== false,
      fuente: fuente,
      verificado: (datos._meta && datos._meta.actualizado) || null,
      orden: (i + 1) * 10
    };
    if (t.precio_brl != null) f.precio_brl = t.precio_brl;
    else f.precio = t.precio;
    return f;
  }).filter(Boolean);
  if (sinPrecioApagados.length) console.log('  no se suben (apagados y sin precio): ' + sinPrecioApagados.map((t) => t.titulo).join(' | '));

  // Un destino sin nombre en el mapa es un key mal escrito, y sube igual pero
  // queda marcado en el log: la UI lo va a mostrar como "key" en mayusculas.
  const sinNombre = [...new Set(filas.map((f) => f.destino).filter((d) => !NOMBRES[d]))];

  console.log('data/tours.json: ' + filas.length + ' tours, ' + Object.keys(NOMBRES).length + ' destinos');
  console.log('  ' + filas.filter((f) => f.precio_brl != null).length + ' con precio de origen en BRL');
  if (sinNombre.length) console.log('  aviso: destinos sin nombre en _destinos: ' + sinNombre.join(', '));

  // El mismo filtro del pull, por el mismo motivo: si el JSON vino con pocas
  // filas, algo fallo antes y subir eso vacia el catalogo de la base.
  if (filas.length < 20) {
    console.error('');
    console.error('data/tours.json tiene ' + filas.length + ' filas. No se sube nada.');
    console.error('Con menos de 20 el problema esta antes, en el pull o en la migracion.');
    process.exit(1);
  }

  if (DRY) {
    console.log('');
    console.log('--dry-run: no se escribio nada. Se subirian ' + filas.length + ' filas.');
    console.log('  muestra: ' + JSON.stringify(filas[0]));
    return;
  }

  /* Se leen los que hay antes, para poder upsert por (destino, titulo) y para
     listar los que quedan despues.
     `url` y `key` salen de config() una sola vez y se guardan en cfg. Referenciar
     config().url en la linea de al lado nocia: url es una variable local de
     config(), no existe en este scope, y el ReferenceError salta recien en la
     corrida real porque el --dry-run vuelve antes de llegar aca. */
  const cfg = config();
  const existentes = await fetch(cfg.url + '/rest/v1/tours?select=*', {
    headers: { apikey: cfg.key, authorization: 'Bearer ' + cfg.key }
  }).then((r) => {
    if (!r.ok) throw new Error('no se pudo leer la tabla: ' + r.status + ' ' + r.text().slice(0, 200));
    return r.json();
  });
  console.log('  la tabla tiene ' + existentes.length + ' filas');

  const clave = (f) => f.destino + '#' + f.titulo;
  const antes = new Set(existentes.map((e) => e.destino + '#' + e.titulo));
  const despues = new Set(filas.map(clave));

  const nuevos = filas.filter((f) => !antes.has(clave(f)));
  const aActualizar = filas.filter((f) => antes.has(clave(f)));
  const sobrantes = [...antes].filter((k) => !despues.has(k));

  console.log('  ' + nuevos.length + ' nuevos, ' + aActualizar.length + ' a actualizar');

  /* NO PISAR LO QUE EL JSON NO TRAE.
     tours_guardar_lote() reescribe TODAS las columnas de la fila con lo que
     llega: lo que no se manda se guarda como '' o null. Y en la base hay datos
     que no viven en data/tours.json (pvp, link_web, agencia, estado_scrapeo,
     politica_cancelacion, si el tour esta apagado...). Sin este paso, correr el
     script los borraba para todos los tours. Se copian de la fila existente;
     duracion, url_imagen y la ficha (grupo, salida, edad) salen del JSON cuando
     el JSON los trae, y si no, se deja lo que ya habia. */
  const previa = new Map(existentes.map((e) => [clave(e), e]));
  const porClave = new Map(datos.tours.map((t) => [t.destinos[0] + '#' + t.titulo, t]));
  const CONSERVAR = ['pvp', 'comision', 'neto', 'tipo_servicio', 'incluye', 'no_incluye',
    'politica_cancelacion', 'dias_salida', 'link_web', 'agencia', 'estado_scrapeo', 'activo',
    // De donde salio el dato, cuando se verifico y en que orden se ve: no cambian por re-subir.
    'fuente', 'verificado', 'orden'];
  filas.forEach((f) => {
    const e = previa.get(clave(f));
    const t = porClave.get(clave(f)) || {};
    if (e) {
      CONSERVAR.forEach((c) => { if (e[c] !== null && e[c] !== undefined) f[c] = e[c]; });
      f.duracion = t.duracion || e.duracion || '';
      f.url_imagen = t.image || e.url_imagen || '';
    } else {
      f.duracion = t.duracion || '';
      f.url_imagen = t.image || '';
    }
  });

  // El upsert va por lotes porque un solo pedido con 111 filas de detalle largo
  // puede acercarse del limite de PostgREST, y el error que devuelve no dice que
  // fila fue la que fallo.
  let escritas = 0;
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    await rpc('tours_guardar_lote', { p_filas: lote });
    escritas += lote.length;
    console.log('  ' + escritas + '/' + filas.length);
  }

  console.log('');
  console.log('cargados ' + escritas + ' tours en public.tours');

  /* La ficha (grupo, punto de salida, edad y el apagado) va por su propia
     funcion, tours_ficha_lote(), que solo actualiza filas existentes. Solo se
     manda lo que el JSON trae: una clave ausente deja la columna como esta. Si
     la migracion supabase_tours_ficha.sql no se corrio, avisa y sigue. */
  const ficha = datos.tours.map((t) => {
    const f = { destino: t.destinos[0], titulo: t.titulo };
    if (t.grupo) f.grupo = t.grupo;
    if (t.salida) f.punto_salida = t.salida;
    if (t.edad) f.edad_minima = t.edad;
    if (t.duracion) f.duracion = t.duracion;
    if (t.image) f.url_imagen = t.image;
    if (t.cancelacion) f.politica_cancelacion = t.cancelacion;
    // Las listas viajan como texto, una frase por linea.
    if (t.incluye && t.incluye.length) f.incluye = t.incluye.join('\n');
    if (t.no_incluye && t.no_incluye.length) f.no_incluye = t.no_incluye.join('\n');
    if (t.llevar && t.llevar.length) f.que_llevar = t.llevar.join('\n');
    if (t.activo === false) f.activo = false;
    return f;
  }).filter((f) => Object.keys(f).length > 2);
  if (ficha.length) {
    try {
      for (let i = 0; i < ficha.length; i += LOTE) await rpc('tours_ficha_lote', { p_filas: ficha.slice(i, i + LOTE) });
      console.log('ficha (grupo, salida, edad, apagados) actualizada en ' + ficha.length + ' tours');
    } catch (e) {
      console.log('');
      console.log('AVISO: no se pudo guardar la ficha (' + e.message.slice(0, 160) + ')');
      console.log('Si dice que la funcion no existe, corré supabase_tours_ficha.sql en el SQL Editor de Supabase y volvé a correr este script.');
    }
  }

  if (sobrantes.length) {
    console.log('');
    console.log(sobrantes.length + ' fila(s) quedaron en la base y NO estan en el JSON:');
    sobrantes.slice(0, 20).forEach((k) => console.log('    - ' + k));
    if (sobrantes.length > 20) console.log('    ... y ' + (sobrantes.length - 20) + ' mas');
    console.log('');
    console.log('No se borran solas. Si el pull fallo y leyo de menos, borrarlas seria un');
    console.log('desastre. Cuando sepas que el JSON esta bien, borralas desde el panel.');
  }

  console.log('');
  console.log('  siguiente paso: el server ya los lee. npm start y fijate /app.');
})();
