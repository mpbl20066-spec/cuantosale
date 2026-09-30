'use strict';
/*
 * Pruebas de la capa de tours: lib/tours.js y el SQL de la tabla.
 *
 *   node test-tours.js
 *
 * Lo que importa probar aca es el respaldo, porque la razon por la que la tabla
 * se lee con la service role y no con la anon es que el catalogo no se pueda
 * leer entero desde el navegador. Si esa capa se rompe, la web sigue andando
 * (cae al JSON) pero se volvio a publicar el contenido.
 *
 * No se prueba contra Supabase real: hacen falta credenciales y una tabla
 * cargada. Lo que se prueba es la decision de cada rama con la entrada simulada,
 * que es donde estan los errores caros.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const LIB = path.join(__dirname, 'lib', 'tours.js');
const SQL = path.join(__dirname, 'supabase_tours.sql');
const APP = path.join(__dirname, 'public', 'app.js');
const SERVIDOR = path.join(__dirname, 'server.js');

let pruebas = 0;
let fallas = 0;
async function t(nombre, fn) {
  pruebas++;
  try { await fn(); console.log('  ok     ' + nombre); }
  catch (e) { fallas++; console.log('  FALLÓ  ' + nombre + '\n         ' + e.message.split('\n')[0]); }
}

// Cada prueba corre con sus propias variables: el modulo lee process.env al
// llamar a config(), no al importarse, asi que alcanza con cambiarlas.
function conEnv(vars, fn) {
  const antes = {};
  Object.keys(vars).forEach((k) => { antes[k] = process.env[k]; if (vars[k] === null) delete process.env[k]; else process.env[k] = vars[k]; });
  delete require.cache[require.resolve(LIB)];
  const mod = require(LIB);
  return Promise.resolve(fn(mod)).finally(() => {
    Object.keys(antes).forEach((k) => { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; });
    delete require.cache[require.resolve(LIB)];
  });
}

(async function () {
  console.log('lib/tours.js: el respaldo');

  await t('sin credenciales devuelve la copia local y dice que viene del json', async function () {
    await conEnv({ SUPABASE_URL: null, SUPABASE_SERVICE_ROLE_KEY: null }, async function (tours) {
      assert.strictEqual(tours.disponible(), false);
      const lista = await tours.todos();
      const esperados = require('./public/tours.generated.js').length;
      assert.ok(esperados > 0 && lista.length === esperados, 'trae ' + lista.length + ' tours y la copia generada tiene ' + esperados);
      assert.strictEqual(tours.estado(), 'json');
    });
  });

  await t('sin SUPABASE_SERVICE_ROLE_KEY no intenta leer, aunque haya URL', async function () {
    // La anon key NO sirve para esta tabla: pasaria por encima de RLS solo si
    // estuviera mal configurada la base, y si lo esta, se abre el catalogo. El
    // modulo tiene que negarse a arrancar con la anon.
    await conEnv({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: null, SUPABASE_ANON_KEY: 'anon-123' }, async function (tours) {
      assert.strictEqual(tours.disponible(), false, 'con la anon no puede leer');
      const lista = await tours.todos();
      assert.strictEqual(lista.length, require('./public/tours.generated.js').length, 'tiene que caer al respaldo');
    });
  });

  await t('si Supabase falla, devuelve la copia local y no tira', async function () {
    await conEnv({ SUPABASE_URL: 'https://no-existe.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-x' }, async function (tours) {
      // No hay red hacia ese host, asi que fetch tira o devuelve error: en los
      // dos casos tiene que caer al respaldo en vez de romper /api/cotizar.
      const lista = await tours.destino('buz');
      assert.ok(lista.length >= 10, 'tiene que devolver los de Búzios, devolvio ' + lista.length);
    });
  });

  await t('el respaldo trae todos los tours con los precios ya convertidos', async function () {
    await conEnv({ SUPABASE_URL: null, SUPABASE_SERVICE_ROLE_KEY: null }, async function (tours) {
      const lista = await tours.todos();
      assert.strictEqual(lista.length, require('./public/tours.generated.js').length, 'trae ' + lista.length);
      const escuna = lista.find((t) => t.title === 'Paseo de Escuna');
      assert.ok(escuna, 'no esta el Paseo de Escuna');
      // R$ 60 con la cotizacion de 5,1414 y US$ 5 de margen.
      assert.strictEqual(escuna.price, 16.67, 'precio: ' + escuna.price);
    });
  });

  await t('la copia local se regenera desde data/tours.json', async function () {
    // Si el respaldo se desincroniza del JSON, el deploy que sale bien puede
    // igual publicar precios viejos cuando Supabase no responde.
    const generado = require('./public/tours.generated.js');
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'tours.json'), 'utf8'));
    // Los apagados (activo: false) no se dibujan: el generado trae solo los activos.
    const activos = json.tours.filter((t) => t.activo !== false);
    assert.strictEqual(generado.length, activos.length, 'tours: ' + generado.length + ' vs ' + activos.length);
    generado.forEach((t, i) => {
      assert.strictEqual(t.title, activos[i].titulo, 'titulo en la posicion ' + i);
    });
  });

  await t('el respaldo expone el mapa de destinos para el panel', function () {
    const generado = require('./public/tours.generated.js');
    const d = generado.destinos;
    assert.ok(d && Object.keys(d).length >= 25, 'el mapa tiene ' + Object.keys(d || {}).length + ' destinos');
    // El panel ofrece estas keys, asi que tienen que existir en el modelo.
    const model = require('./lib/model.js');
    Object.keys(d).forEach((k) => {
      assert.ok(model.DEST[k] !== undefined, 'la key "' + k + '" no existe en lib/model.js: el panel la ofreceria y el tour no se veria nunca');
    });
  });

  await t('una key de destino que no existe en el modelo se avisa al cargar', async function () {
    // El caso que hace que un tour escrito por untypo no aparezca nunca. No es
    // un error de build a proposito (ver build-tours.js), pero tiene que verse.
    const fuente = fs.readFileSync(path.join(__dirname, 'scripts', 'build-tours.js'), 'utf8');
    assert.ok(/no esta en lib\/model\.js/.test(fuente), 'build-tours tiene que avisar los destinos desconocidos');
    const validador = fs.readFileSync(path.join(__dirname, 'scripts', 'validar-tours.js'), 'utf8');
    assert.ok(/no esta en lib\/model\.js/.test(validador), 'validar-tours tambien tiene que avisarlos');
  });

  console.log('');
  console.log('lib/tours.js: la conversion de precios');

  await t('precio_brl gana sobre precio y suma el margen', function () {
    // Asi se construye una fila desde la consola de Supabase: precio_brl crudo.
    // Si la conversion viviera solo en SQL, aca quedaria R$ 190 como US$ 190.
    const fila = { destino: 'fln', titulo: 'X', descripcion: '', precio: 190, precio_brl: 190, detalle: '', fuente: '', verificado: null };
    const t1 = require(LIB).desdeFila(fila, 'Florianópolis, Brasil', 5.1414, 5);
    assert.strictEqual(t1.price, 41.95, 'precio: ' + t1.price);
  });

  await t('sin precio_brl el precio en dolares se respeta tal cual', function () {
    const fila = { destino: 'rio', titulo: 'X', descripcion: '', precio: 65, precio_brl: null, detalle: '' };
    const t1 = require(LIB).desdeFila(fila, 'Río de Janeiro, Brasil', 5.1414, 5);
    assert.strictEqual(t1.price, 65);
  });

  await t('sin cotizacion definida y con precio_brl, se publica el numero de origen', function () {
    // Cotizacion 0 es el estado en que queda si data/tours.json no trae
    // _meta.cotizacion_brl_usd. Publicar 190 como si fuera dolares es el peor
    // resultado posible: un numero creible y cuatro veces el real.
    const fila = { destino: 'fln', titulo: 'X', descripcion: '', precio: 0, precio_brl: 190, detalle: '' };
    const t1 = require(LIB).desdeFila(fila, 'Florianópolis, Brasil', 0, 0);
    assert.strictEqual(t1.price, 190);
  });

  await t('la fila trae la procedencia del precio', function () {
    const fila = { destino: 'rio', titulo: 'X', descripcion: '', precio: 65, detalle: '', fuente: 'Booking, set/2026', verificado: '2026-09-29' };
    const t1 = require(LIB).desdeFila(fila, 'Río', 0, 0);
    assert.strictEqual(t1.fuente, 'Booking, set/2026');
    assert.strictEqual(t1.verificado, '2026-09-29');
    assert.strictEqual(t1.source, 'supabase');
  });

  await t('el shape es el que espera el front', function () {
    const fila = { destino: 'buz', titulo: 'Kayak', descripcion: 'Nadar', precio: 30, detalle: 'Con chaleco' };
    const t1 = require(LIB).desdeFila(fila, 'Búzios, Brasil', 0, 0);
    ['destinations', 'destination', 'title', 'description', 'price', 'details'].forEach((k) => {
      assert.ok(t1[k] !== undefined, 'falta ' + k);
    });
    assert.ok(Array.isArray(t1.destinations), 'destinations tiene que ser un array: toursFor() le hace indexOf');
    assert.strictEqual(t1.destinations[0], 'buz');
  });

  console.log('');
  console.log('supabase_tours.sql: la tabla esta cerrada');

  const sql = fs.readFileSync(SQL, 'utf8');

  await t('la tabla tiene RLS activado y ningun grant a anon', function () {
    assert.ok(/alter table public\.tours enable row level security/i.test(sql), 'falta enable row level security');
    assert.ok(/revoke all on table public\.tours from anon, authenticated/i.test(sql), 'falta revoke a anon/authenticated');
  });

  await t('no hay ninguna policy que deje leer la tabla', function () {
    // Una sola policy de select a anon abriria todo el catalogo, con la fuente
    // de cada precio. El permiso va por función, no por policy.
    const policies = sql.match(/create policy[^;]*;/gi) || [];
    assert.strictEqual(policies.length, 0, 'hay ' + policies.length + ' policy(s) y deberia ser 0: ' + policies.join(' | '));
  });

  await t('escribir exige es_agencia() dentro de la base', function () {
    const escrituras = ['tours_guardar(', 'tours_borrar(', 'tours_alternar_activo('].map((f) => {
      const i = sql.indexOf('function public.' + f);
      assert.ok(i >= 0, 'no encontre ' + f);
      return sql.slice(i, sql.indexOf('$$;', i));
    });
    escrituras.forEach((cuerpo) => {
      assert.ok(/es_agencia\(\)/.test(cuerpo), 'una funcion de escritura no comprueba es_agencia: ' + cuerpo.slice(0, 80));
    });
  });

  await t('es_agencia() se llama SIN argumento, como la define el proyecto', function () {
    // supabase.sql la define como es_agencia() sin parametros, sacando el
    // correo del JWT. Llamarla con un argumento daria "function does not exist".
    assert.ok(!/es_agencia\([^)]/.test(sql), 'la estan llamando con un argumento: revisar contra supabase.sql');
  });

  await t('la carga por lotes no pide permiso de agencia', function () {
    // Es la excepcion deliberada: la corre el server con la service role. Si
    // pidiera es_agencia(), la carga inicial no tendria como arrancar.
    const i = sql.indexOf('function public.tours_guardar_lote');
    const cuerpo = sql.slice(i, sql.indexOf('$$;', i));
    assert.ok(!/es_agencia/.test(cuerpo), 'la carga inicial no puede depender de un usuario');
    assert.ok(/grant execute on function public\.tours_guardar_lote\(jsonb\) to service_role/i.test(sql), 'tiene que estar granted solo a service_role');
  });

  await t('el titulo es unico por destino', function () {
    // Es lo que hace que el upsert por (destino, titulo) sea correcto y lo que
    // evita que dos filas compitan por la misma foto.
    assert.ok(/unique \(destino, titulo\)/i.test(sql), 'falta el unique (destino, titulo)');
  });

  await t('un tour ACTIVO necesita precio, uno inactivo no', function () {
    // La regla es "not activo or ...", y no "precio is not null or ...". Con la
    // version vieja, la planilla de la agencia no cargaba: 14 filas de
    // 'sin-precio-publicado' que no tienen precio se trababan con 23514.
    // Un tour apagado no se ofrece, asi que no necesita precio todavia.
    assert.ok(/constraint tours_precio_alguno check \(\s*not activo or/i.test(sql),
      'la constraint deberia pedir precio solo si activo. Esta: ' +
      (sql.match(/constraint tours_precio_alguno[\s\S]*?\)/i) || ['(no esta)'])[0]);
  });

  await t('tours_guardar_lote acepta un tour inactivo sin precio', function () {
    // El chequeo de la funcion tiene que mirar `activo`, igual que la
    // constraint. Con el chequeo viejo, el importador de la planilla se
    // trababa en la primera fila sin PVP con P0001 "el tour X no tiene precio".
    const i = sql.indexOf('function public.tours_guardar_lote');
    const cuerpo = sql.slice(i, sql.indexOf('$$;', i));
    assert.ok(/not activo or activo/.test(cuerpo) || /\(f->>'activo'\)::boolean\s*\)\s*\n?\s*and/.test(cuerpo) || /coalesce\(\(f->>'activo'\)::boolean, true\)/.test(cuerpo),
      'la funcion no mira activo antes de exigir precio');
  });

  await t('tours_para_cliente tiene los tres parametros que se le pasan', function () {
    const i = sql.indexOf('function public.tours_para_cliente');
    const firma = sql.slice(i, sql.indexOf(')', i));
    assert.ok(/p_destino/.test(firma) && /p_cotizacion_brl/.test(firma) && /p_margen_usd/.test(firma), 'firma: ' + firma);
    // Y el grant tiene que coincidir con la firma, si no el grant falla.
    assert.ok(/tours_para_cliente\(text, numeric, numeric\)/.test(sql), 'el grant no coincide con la firma');
  });

  console.log('');
  console.log('el server manda los tours en /api/cotizar');

  await t('el server pide los tours y los manda en el meta', function () {
    const s = fs.readFileSync(SERVIDOR, 'utf8');
    assert.ok(/tours\.destino\(v\.S\.dest\)/.test(s), 'el server no pide los tours del destino');
    assert.ok(/tours: toursList/.test(s), 'no los manda en el meta');
    assert.ok(/toursSecond: toursSecond/.test(s), 'falta el segundo destino');
    assert.ok(/toursSource: tours\.estado\(\)/.test(s), 'falta el diagnostico de origen');
  });

  await t('los dos destinos se piden en paralelo', function () {
    const s = fs.readFileSync(SERVIDOR, 'utf8');
    // Encadenados, el segundo destino tardaria lo que el primero.
    assert.ok(/Promise\.all\(\[\s*tours\.destino/.test(s), 'no se piden en paralelo');
  });

  await t('el server NO pide los tours en /api/hoteles', function () {
    // /api/hoteles se llama despues, para pintar los hoteles. Si los tours
    // esperaran ahi, la seccion apareceria un instante despues del detalle.
    const s = fs.readFileSync(SERVIDOR, 'utf8');
    const i = s.indexOf('async function cotizarHoteles');
    const cuerpo = s.slice(i, s.indexOf('\nfunction ', i + 10));
    assert.ok(!/tours\.destino/.test(cuerpo), 'los tours se piden tambien en /api/hoteles');
  });

  console.log('');
  console.log('el front: lee meta.tours y no el archivo');

  await t('toursFor recibe el meta y usa meta.tours', function () {
    const a = fs.readFileSync(APP, 'utf8');
    assert.ok(/function toursFor\(destinationKey, destinationName, meta\)/.test(a), 'toursFor no recibe el meta');
    assert.ok(/toursDeMeta\(meta\)\.filter/.test(a), 'toursFor no lee meta.tours');
  });

  await t('los dos que llaman a toursFor le pasan el meta', function () {
    // localToursMarkup dibuja la seccion y guiaSecreta la lista: si uno de los
    // dos se olvida del meta, ese render usa el respaldo y puede mostrar precios
    // viejos al lado de los nuevos.
    const a = fs.readFileSync(APP, 'utf8');
    // Solo las llamadas reales: la definicion, la exposicion como global y las
    // menciones dentro de comentarios no cuentan.
    // Se descartan las menciones sin argumentos (son comentarios, "se piden con
    // toursFor()") y la definicion, que no es una llamada.
    const llamadas = (a.match(/[^\w.]toursFor\(([^)]*)\)/g) || [])
      .map((c) => c.slice(c.indexOf('('), c.lastIndexOf(')') + 1))
      .filter((c) => c !== '()');
    assert.ok(llamadas.length >= 2, 'esperaba al menos 2 llamadas reales, encontre ' + llamadas.length);
    const sinMeta = llamadas.filter((c) => !/meta/.test(c));
    assert.strictEqual(sinMeta.length, 0, 'estas llamadas no pasan el meta y usarian el respaldo: ' + sinMeta.join(' | '));
  });

  await t('app.js ya no trae el catalogo escrito a mano', function () {
    const a = fs.readFileSync(APP, 'utf8');
    assert.ok(!/tour\(\['[a-z]+'\]/.test(a), 'app.js volvio a traer los tours: la unica fuente es la tabla');
  });

  await t('el panel existe y exige sesion', function () {
    assert.ok(fs.existsSync(path.join(__dirname, 'public', 'tours.html')), 'falta public/tours.html');
    const panel = fs.readFileSync(path.join(__dirname, 'public', 'tours.js'), 'utf8');
    assert.ok(/auth\.getSession|auth\.getUser/.test(panel), 'el panel no pide sesion');
    assert.ok(/es_agencia/.test(panel), 'el panel no consulta si es agencia');
    const html = fs.readFileSync(path.join(__dirname, 'public', 'tours.html'), 'utf8');
    assert.ok(/noindex/.test(html), 'el panel tiene que quedar fuera de los buscadores');
  });

  console.log('');
  if (fallas) { console.log(fallas + ' de ' + pruebas + ' pruebas fallaron.'); process.exit(1); }
  console.log(pruebas + ' pruebas OK');
})();
