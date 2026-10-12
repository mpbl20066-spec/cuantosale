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

console.log('\n' + (fallas ? fallas + ' de ' + pruebas + ' pruebas FALLARON' : pruebas + ' pruebas OK'));
process.exit(fallas ? 1 : 0);
