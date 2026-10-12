'use strict';
/*
 * Pruebas de la cuenta del precio publicado y de la limpieza de cambios
 * (lib/operaciones.js).
 *
 *   node test-operaciones.js
 *
 * La que mas importa es la primera: para un tour en reales por persona, la
 * cuenta nueva tiene que dar lo mismo que daba la web (lib/tours.js, desdeFila).
 * Si no, publicar cualquier cambio moveria precios que nadie toco.
 */
const assert = require('assert');
const ops = require('./lib/operaciones');
const { desdeFila } = require('./lib/tours');

const CFG = { cotizacion: 5.1414, margen: { tipo: 'usd', valor: 5 } };
let pruebas = 0, fallas = 0;
function t(nombre, fn) {
  pruebas++;
  try { fn(); console.log('  ok     ' + nombre); }
  catch (e) { fallas++; console.log('  FALLÓ  ' + nombre + '\n         ' + e.message.split('\n')[0]); }
}

t('en reales por persona da lo mismo que la web, para muchos montos', function () {
  for (let brl = 1; brl <= 3000; brl += 0.37) {
    const m = Math.round(brl * 100) / 100;
    const web = desdeFila({ destino: 'x', titulo: 'x', precio_brl: m }, '', CFG.cotizacion, CFG.margen.valor).price;
    assert.strictEqual(ops.calcular({ precio_brl: m, unidad: 'persona' }, null, CFG).valor, web, 'R$ ' + m);
  }
});

t('un precio en dolares sin margen propio se publica tal cual', function () {
  assert.strictEqual(ops.calcular({ precio: 65, precio_brl: null, unidad: 'persona' }, null, CFG).valor, 65);
});

t('por vehiculo se divide por la capacidad antes del margen', function () {
  assert.strictEqual(ops.calcular({ precio_brl: 400, unidad: 'vehiculo', capacidad: 4 }, null, CFG).valor, Number((400 / 5.1414 / 4 + 5).toFixed(2)));
});

t('por vehiculo sin capacidad no se puede calcular', function () {
  assert.ok(ops.calcular({ precio_brl: 400, unidad: 'vehiculo', capacidad: null }, null, CFG).error);
});

t('el margen del servicio gana sobre el del proveedor y este sobre el general', function () {
  const prov = { margen_tipo: 'pct', margen_valor: 10 };
  assert.strictEqual(ops.calcular({ precio: 100, unidad: 'persona' }, prov, CFG).valor, 110);
  assert.strictEqual(ops.calcular({ precio: 100, unidad: 'persona', margen_tipo: 'usd', margen_valor: 7 }, prov, CFG).valor, 107);
});

t('sin cotizacion no publica un precio en reales como si fueran dolares', function () {
  assert.ok(ops.calcular({ precio_brl: 190, unidad: 'persona' }, null, { cotizacion: 0, margen: null }).error);
});

t('sin ningun precio no se puede calcular', function () {
  assert.ok(ops.calcular({ precio: null, precio_brl: null }, null, CFG).error);
});

t('limpiarCambios ignora campos que no son editables', function () {
  const c = ops.limpiarCambios({ precio_brl: '180,5', precio_publicado: 1, id: 'x', created_at: 'y' });
  assert.deepStrictEqual(c, { precio_brl: 180.5 });
});

t('limpiarCambios rechaza precios negativos y unidades inventadas', function () {
  assert.throws(function () { ops.limpiarCambios({ precio_brl: -1 }); });
  assert.throws(function () { ops.limpiarCambios({ unidad: 'litro' }); });
});

t('igual trata vacio y null como lo mismo y compara numeros como numeros', function () {
  assert.ok(ops.igual('', null));
  assert.ok(ops.igual(180, '180'));
  assert.ok(!ops.igual(180, 181));
});

/* ---------- importacion ---------- */

t('la unidad en texto libre: vehiculo gana sobre pax y persona sobre tramo', function () {
  assert.strictEqual(ops.unidadDe('por vehículo, hasta 3 pax'), 'vehiculo');
  assert.strictEqual(ops.unidadDe('por persona por tramo, según grupo'), 'persona');
  assert.strictEqual(ops.unidadDe('por adulto'), 'persona');
  assert.strictEqual(ops.unidadDe('por máquina, hasta 2'), 'vehiculo');
  assert.strictEqual(ops.unidadDe('por embarcación'), 'embarcacion');
  assert.strictEqual(ops.unidadDe('por trecho'), 'tramo');
  assert.strictEqual(ops.unidadDe('unidad no indicada'), null);
});

t('la capacidad sale de "hasta N", y un rango no es una capacidad', function () {
  assert.strictEqual(ops.capacidadDe('por vehículo', 'Hasta 4 personas (según la portada)'), 4);
  assert.strictEqual(ops.capacidadDe('por vehículo, hasta 3 pax', ''), 3);
  assert.strictEqual(ops.capacidadDe('por vehículo', '1 a 15 pasajeros según tarifa'), null);
});

t('montos en formato brasilero y en formato con punto', function () {
  assert.strictEqual(ops.monto('1.400,50'), 1400.5);
  assert.strictEqual(ops.monto('R$ 1.400'), 1400);
  assert.strictEqual(ops.monto('180'), 180);
  assert.strictEqual(ops.monto('24.99'), 24.99);
  assert.strictEqual(ops.monto(''), null);
});

function ctxPrueba() {
  return {
    tours: [{ id: 't1', destino: 'mcz', titulo: 'Praia do Gunga', proveedor_id: null, precio_brl: 90, precio_publicado: 22.5, unidad: 'persona' },
      { id: 't2', destino: 'mcz', titulo: 'Paseo X', proveedor_id: 'p1', precio_brl: 100, precio_publicado: 24.45, unidad: 'persona' }],
    proveedores: [{ id: 'p1', nombre: 'Operadora Uno' }],
    alias: { 'maceio': 'mcz' },
    cfg: CFG
  };
}
const base = { operador: 'Otra', destino: 'Maceió', monto: '50', moneda: 'BRL', unidad: 'por persona' };

t('igual a uno que ya esta: por defecto queda para comparar con el tuyo', function () {
  const r = ops.analizarImport([Object.assign({}, base, { titulo: 'Praia do Gunga' })], {}, ctxPrueba())[0];
  assert.strictEqual(r.accion, 'igual');
  assert.strictEqual(r.decision, 'comparar');
  assert.ok(r.opciones.indexOf('nuevo') < 0, 'mismo titulo exacto: no se puede importar como otro');
  assert.strictEqual(r.ref.id, 't1');
});

t('dos filas con el mismo paseo en el archivo: entra la primera y la otra queda para comparar', function () {
  const r = ops.analizarImport([Object.assign({}, base, { titulo: 'Morro do Camaleão' }), Object.assign({}, base, { operador: 'Tercera', titulo: 'Morro do Camaleão' })], {}, ctxPrueba());
  assert.strictEqual(r[0].decision, 'nuevo');
  assert.strictEqual(r[1].accion, 'repetido');
  assert.strictEqual(r[1].decision, 'comparar');
  assert.strictEqual(r[1].ref_n, 1);
});

t('reimportar el mismo servicio del mismo operador actualiza en vez de duplicar', function () {
  const ctx = ctxPrueba();
  const r = ops.analizarImport([Object.assign({}, base, { operador: 'Operadora Uno', titulo: 'Paseo X', monto: '120' })], {}, ctx)[0];
  assert.strictEqual(r.accion, 'actualiza');
  const igual = ops.analizarImport([Object.assign({}, base, { operador: 'Operadora Uno', titulo: 'Paseo X', monto: '100' })], {}, ctx)[0];
  assert.strictEqual(igual.accion, 'sin_cambios');
});

t('una oferta para comparar de otra importacion no cuenta como parecido, y reimportarla la actualiza', function () {
  const ctx = ctxPrueba();
  ctx.proveedores.push({ id: 'p2', nombre: 'Otra' });
  ctx.tours.push({ id: 'o1', destino: 'mcz', titulo: 'Praia do Gunga · Otra', proveedor_id: 'p2', precio_brl: 50, unidad: 'persona', alternativa_de: 't1' });
  const r = ops.analizarImport([Object.assign({}, base, { titulo: 'Praia do Gunga', monto: '60' })], {}, ctx)[0];
  assert.strictEqual(r.accion, 'actualiza');
  assert.strictEqual(r.ref.id, 'o1');
});

t('un destino que no esta en la web es un error, no un servicio invisible', function () {
  const r = ops.analizarImport([Object.assign({}, base, { titulo: 'Algo', destino: 'Atlantida' })], {}, ctxPrueba())[0];
  assert.strictEqual(r.accion, 'error');
});

t('la decision elegida en la vista previa se respeta solo si es una opcion valida', function () {
  const fila = [Object.assign({}, base, { titulo: 'Praia do Gunga' })];
  assert.strictEqual(ops.analizarImport(fila, { 1: 'asignar' }, ctxPrueba())[0].decision, 'asignar');
  assert.strictEqual(ops.analizarImport(fila, { 1: 'cualquiera' }, ctxPrueba())[0].decision, 'comparar');
});

/* ---------- precios masivos (recalcular es async: van al final) ---------- */

async function tAsync(nombre, fn) {
  pruebas++;
  try { await fn(); console.log('  ok     ' + nombre); }
  catch (e) { fallas++; console.log('  FALLÓ  ' + nombre + '\n         ' + e.message.split('\n')[0]); }
}

function ctxMasivo() {
  const ctx = {
    tours: [
      { id: 'a', destino: 'fln', titulo: 'A', precio_brl: 100, unidad: 'persona', activo: true, publicado_at: 'x', proveedor_id: null },
      { id: 'b', destino: 'fln', titulo: 'B', precio_brl: 200, unidad: 'persona', activo: true, publicado_at: 'x', proveedor_id: 'p' },
      { id: 'c', destino: 'fln', titulo: 'C', precio_brl: 300, unidad: 'persona', activo: false, publicado_at: 'x', proveedor_id: null },
      { id: 'd', destino: 'fln', titulo: 'D', precio_brl: 300, unidad: 'persona', activo: true, publicado_at: null, proveedor_id: null },
      { id: 'e', destino: 'fln', titulo: 'E', precio: 65, precio_brl: null, unidad: 'persona', activo: true, publicado_at: 'x', proveedor_id: null }
    ],
    prov: { p: { id: 'p', nombre: 'P', margen_tipo: 'pct', margen_valor: 10 } },
    pend: {},
    cfg: CFG
  };
  // Lo publicado es lo que da la configuracion de hoy.
  ctx.tours.forEach(function (t) { t.precio_publicado = ops.calcular(t, ctx.prov[t.proveedor_id], CFG).valor; });
  return ctx;
}

(async function () {
  await tAsync('con la misma cotizacion y margen no cambia ningun precio publicado', async function () {
    assert.strictEqual((await ops.recalcular(null, CFG, { simular: true }, ctxMasivo())).cambian, 0);
  });
  await tAsync('otra cotizacion mueve solo los que estan en la web y en reales', async function () {
    const st = await ops.recalcular(null, { cotizacion: 5, margen: CFG.margen }, { simular: true }, ctxMasivo());
    // a y b: en la web y en reales. c esta apagado, d nunca se publico, e es en dolares.
    assert.strictEqual(st.cambian, 2);
    assert.strictEqual(st.suben, 2);
  });
  await tAsync('otro margen general no toca al que tiene margen de su proveedor', async function () {
    const st = await ops.recalcular(null, { cotizacion: CFG.cotizacion, margen: { tipo: 'usd', valor: 8 } }, { simular: true }, ctxMasivo());
    assert.deepStrictEqual(st.ejemplos.map(function (x) { return x.servicio; }), ['A']);
  });
  await tAsync('un servicio con un cambio pendiente no recibe otro: se recalcula al mostrarlo y al publicarlo', async function () {
    const ctx = ctxMasivo(); ctx.pend.a = { id: 'x', despues: {} };
    const st = await ops.recalcular(null, { cotizacion: 5, margen: CFG.margen }, { simular: true }, ctx);
    assert.ok(st.ejemplos.every(function (x) { return x.servicio !== 'A'; }));
  });
  console.log('\n' + (fallas ? fallas + ' de ' + pruebas + ' pruebas FALLARON' : pruebas + ' pruebas OK'));
  process.exit(fallas ? 1 : 0);
})();
