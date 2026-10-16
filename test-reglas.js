'use strict';
/*
 * Pruebas de las reglas del catalogo (lib/reglas.js) y de las salidas de la operativa (lib/operativa.js):
 * bloqueos, cupos, dias que no opera, temporadas, combos, manifiesto (texto y PDF), suspension y devoluciones.
 *
 *   node test-reglas.js
 *
 * Todo va a archivos temporales (REGLAS_ARCHIVO, OP_ARCHIVO): no toca Supabase ni data/_trabajo.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.VERCEL;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-reglas-'));
process.env.REGLAS_ARCHIVO = path.join(tmp, 'reglas.json');
process.env.OP_ARCHIVO = path.join(tmp, 'clientes.json');

const reglas = require('./lib/reglas');
const pedidos = require('./lib/pedidos');
const op = require('./lib/operativa');

const lista = [];
function t(nombre, fn) { lista.push([nombre, fn]); }

const BARCO = { clave: 'arraial#Paseo en barco', destino: 'arraial', titulo: 'Paseo en barco', proveedor_id: 'p1' };
const BUGGY = { clave: 'arraial#Buggy por las dunas', destino: 'arraial', titulo: 'Buggy por las dunas', proveedor_id: 'p2' };
function R(x) { return Object.assign({ bloqueos: [], cupos: [], temporadas: [], combos: [] }, x); }

t('un bloqueo de destino frena todo el destino; uno de proveedor, solo sus servicios', function () {
  const r = R({ bloqueos: [{ desde: '2026-10-16', hasta: '2026-10-17', alcance: 'destino', valor: 'arraial', motivo: 'Marina cerrada' }, { desde: '2026-10-20', hasta: '2026-10-20', alcance: 'proveedor', valor: 'p2', motivo: 'Mantenimiento' }] });
  assert.strictEqual(reglas.motivoDia(r, BARCO, '2026-10-16', 2, {}), 'Marina cerrada');
  assert.strictEqual(reglas.motivoDia(r, BARCO, '2026-10-18', 2, {}), null);
  assert.strictEqual(reglas.motivoDia(r, BUGGY, '2026-10-20', 2, {}), 'Mantenimiento');
  assert.strictEqual(reglas.motivoDia(r, BARCO, '2026-10-20', 2, {}), null);
});
t('el cupo cuenta las personas de los pedidos con fecha propia y deja afuera lo cancelado', function () {
  const ocup = reglas.ocupacionDe([
    { estado: 'confirmado', personas: 3, items: [{ nombre: 'Paseo en barco', fecha_servicio: '2026-10-16', estado: 'confirmado' }] },
    { estado: 'en_gestion', personas: 2, items: [{ nombre: 'Paseo en Barco', fecha_servicio: '2026-10-16', estado: 'pendiente' }] },
    { estado: 'cancelado', personas: 9, items: [{ nombre: 'Paseo en barco', fecha_servicio: '2026-10-16' }] },
    { estado: 'confirmado', personas: 9, items: [{ nombre: 'Paseo en barco', fecha_servicio: '2026-10-16', estado: 'cancelado' }] },
    { estado: 'confirmado', personas: 9, items: [{ nombre: 'Paseo en barco' }] }
  ]);
  assert.strictEqual(ocup['paseo en barco|2026-10-16'], 5);
  const r = R({ cupos: [{ clave: BARCO.clave, cupo_dia: 6, no_opera: [0] }] });
  assert.strictEqual(reglas.motivoDia(r, BARCO, '2026-10-16', 1, ocup), null);
  assert.strictEqual(reglas.motivoDia(r, BARCO, '2026-10-16', 2, ocup), 'Quedan 1 lugares');
  assert.strictEqual(reglas.motivoDia(r, BARCO, '2026-10-18', 1, ocup), 'No opera los domingos');   // 18/10/2026 es domingo
});
t('un viaje con algun dia libre deja reservar; sin ninguno, no', function () {
  const r = R({ bloqueos: [{ desde: '2026-10-16', hasta: '2026-10-17', alcance: 'servicio', valor: BARCO.clave, motivo: 'Clima' }] });
  assert.deepStrictEqual(reglas.enViaje(r, BARCO, '2026-10-16', '2026-10-18', 2, {}).libres, ['2026-10-18']);
  assert.strictEqual(reglas.enViaje(r, BARCO, '2026-10-16', '2026-10-17', 2, {}).libres.length, 0);
});
t('temporada: cruza el año, la del destino gana y respeta tours o traslados', function () {
  const r = R({ temporadas: [
    { nombre: 'Verano', desde: '12-15', hasta: '01-31', pct: 10, aplica: 'todo', destinos: [], activo: true },
    { nombre: 'Verano Arraial', desde: '12-20', hasta: '01-10', pct: 20, aplica: 'tours', destinos: ['arraial'], activo: true },
    { nombre: 'Pausada', desde: '01-01', hasta: '12-31', pct: 50, aplica: 'todo', destinos: [], activo: false }
  ] });
  assert.deepStrictEqual(reglas.temporadaDe(r, 'arraial', '2027-01-05', 'tours'), { nombre: 'Verano Arraial', pct: 20 });
  assert.deepStrictEqual(reglas.temporadaDe(r, 'arraial', '2027-01-05', 'traslados'), { nombre: 'Verano', pct: 10 });
  assert.deepStrictEqual(reglas.temporadaDe(r, 'fln', '2026-12-16', 'tours'), { nombre: 'Verano', pct: 10 });
  assert.strictEqual(reglas.temporadaDe(r, 'fln', '2026-03-01', 'tours'), null);
  assert.strictEqual(reglas.conPct(50, 10), 55);
});
t('combo: el de mayor descuento que se cumpla', function () {
  const r = R({ combos: [{ nombre: 'Transfer + 2 tours', min_tours: 2, con_traslado: true, pct: 5 }, { nombre: '3 tours', min_tours: 3, con_traslado: false, pct: 8 }] });
  assert.strictEqual(reglas.comboPara(r, { tours: 2, traslado: true }).pct, 5);
  assert.strictEqual(reglas.comboPara(r, { tours: 2, traslado: false }), null);
  assert.strictEqual(reglas.comboPara(r, { tours: 3, traslado: true }).pct, 8);
});
t('guardar valida y los datos vuelven limpios', async function () {
  await assert.rejects(reglas.guardar('bloqueos', [{ desde: '2026-10-20', hasta: '2026-10-19' }]), /anterior/);
  await assert.rejects(reglas.guardar('cupos', [{ clave: BARCO.clave }]), /cupo por día/);
  const c = await reglas.guardar('cupos', [{ clave: BARCO.clave, cupo_dia: '30', no_opera: [0, 0, 9] }]);
  assert.deepStrictEqual(c[0], { clave: BARCO.clave, cupo_dia: 30, no_opera: [0], nota: '' });
  const tp = await reglas.guardar('temporadas', [{ nombre: 'Alta', desde: '12-15', hasta: '02-28', pct: '15', aplica: 'tours', destinos: ['ARRAIAL', 'x y'] }]);
  assert.deepStrictEqual(tp[0].destinos, ['arraial']);
  assert.ok((await reglas.leer()).temporadas.length === 1);
});
t('la reserva de la web se frena si un tour no tiene ningun dia libre', async function () {
  reglas.invalidar();
  await reglas.guardar('bloqueos', [{ desde: '2026-12-01', hasta: '2026-12-31', alcance: 'todo', motivo: 'Cerrado por fiestas' }]);
  const cat = await reglas.catalogo();
  if (!cat.length) return;   // sin catalogo local no hay con que cruzar
  const titulo = cat[0].titulo;
  const no = await reglas.sinLugar({ fecha_ida: '2026-12-10', fecha_vuelta: '2026-12-15', personas_n: 2, servicios: [{ tipo: 'tour', nombre: titulo }, { tipo: 'traslado', nombre: 'Aeropuerto' }] });
  assert.strictEqual(no.length, 1);
  assert.strictEqual(no[0].motivo, 'Cerrado por fiestas');
  assert.strictEqual((await reglas.sinLugar({ fecha_ida: '2027-01-10', fecha_vuelta: '2027-01-15', servicios: [{ tipo: 'tour', nombre: titulo }] })).length, 0);
  await reglas.guardar('bloqueos', []);
});

const PEDIDOS = [
  { id: 'a', ref: 'CS-A', estado: 'confirmado', cliente_nombre: 'Ana Pérez', cliente_telefono: '099123456', cliente_email: 'ana@x.uy', destino: 'Arraial do Cabo', personas: 2,
    pagos: [{ monto_usd: 100 }], pasajeros: [{ nombre: 'Ana Pérez' }, { nombre: 'Leo Pérez', edad: 6, nota: 'silla de bebé' }],
    items: [{ id: 'i1', tipo: 'tour', nombre: 'Paseo en barco', precio_usd: 100, fecha_servicio: '2026-10-16', hora: '09:00', pickup: 'Pousada Sol', proveedor_id: 'p1', proveedor_nombre: 'Barcos SA', estado: 'confirmado' }] },
  { id: 'b', ref: 'CS-B', estado: 'confirmado', cliente_nombre: 'Bruno Gómez', cliente_telefono: '098765432', destino: 'Arraial do Cabo', personas: 3, pagos: [],
    items: [{ id: 'i2', tipo: 'tour', nombre: 'Paseo en Barco', precio_usd: 150, fecha_servicio: '2026-10-16', hora: '09:00', proveedor_id: 'p1', proveedor_nombre: 'Barcos SA', estado: 'confirmado', notas: 'Llega tarde' },
      { id: 'i3', tipo: 'tour', nombre: 'Buggy', precio_usd: 60, estado: 'confirmado' }], fecha_ida: '2026-10-15', fecha_vuelta: '2026-10-20' },
  { id: 'c', ref: 'CS-C', estado: 'cancelado', cliente_nombre: 'X', personas: 5, items: [{ id: 'i4', nombre: 'Paseo en barco', fecha_servicio: '2026-10-16', hora: '09:00', proveedor_id: 'p1' }] }
];
t('las salidas juntan el mismo servicio, dia, hora y proveedor; los cancelados no van', function () {
  const r = op.salidasDe(PEDIDOS, '2026-10-16', '2026-10-16', { 'tel:59899123456': 'Viaja con bebé' }, [{ id: 'p1', nombre: 'Barcos SA', whatsapp: '22 99999 0000' }]);
  assert.strictEqual(r.salidas.length, 1);
  const s = r.salidas[0];
  assert.strictEqual(s.pax, 5);
  assert.strictEqual(s.filas.length, 2);
  assert.strictEqual(s.proveedor.whatsapp, '22 99999 0000');
  const ana = s.filas.filter(function (x) { return x.ref === 'CS-A'; })[0];
  assert.strictEqual(ana.pago, 'pagado');
  assert.ok(ana.notas.indexOf('Viaja con bebé') >= 0 && ana.notas.some(function (n) { return /silla/.test(n); }));
  assert.deepStrictEqual(ana.pasajeros, ['Ana Pérez', 'Leo Pérez (6)']);
  assert.strictEqual(r.sin_fecha.length, 1);   // el buggy sin fecha del viaje de Bruno
  const txt = op.textoSalida(s);
  assert.ok(/Total: 5 pasajeros/.test(txt) && /Pickup: Pousada Sol/.test(txt) && /Pickup: a confirmar/.test(txt));
});
t('el manifiesto en PDF sale bien formado', function () {
  const s = op.salidasDe(PEDIDOS, '2026-10-16', '2026-10-16', {}, [])[ 'salidas'][0];
  const buf = op.pdfSalida(s);
  const txt = buf.toString('latin1');
  assert.ok(txt.indexOf('%PDF-1.4') === 0 && /%%EOF\n$/.test(txt));
  assert.ok(txt.indexOf('Paseo en barco') > 0 && txt.indexOf('Pousada Sol') > 0);
});
t('incidencia y devolucion del proveedor se guardan limpias y quedan en el historial', function () {
  const i = pedidos.limpiarItem({ nombre: 'Barco', devuelto_proveedor_usd: '20', incidencia: { motivo: 'Clima', fecha_original: '2026-10-16', resolucion: 'cualquiera' } });
  assert.strictEqual(i.devuelto_proveedor_usd, 20);
  assert.strictEqual(i.incidencia.resolucion, 'pendiente');
  assert.strictEqual(pedidos.limpiarItem({ nombre: 'Barco', incidencia: { motivo: '' } }).incidencia, null);
  const antes = { items: [{ id: 'x', nombre: 'Barco', estado: 'confirmado' }] };
  const ev = pedidos.limpiarPatch({ items: [{ id: 'x', nombre: 'Barco', estado: 'confirmado', incidencia: { motivo: 'Clima' } }] });
  assert.ok(require('./lib/pedidos').limpiarItem(ev.items[0]).incidencia);
  assert.ok(antes);
});

(async function () {
  let fallas = 0;
  for (const [n, fn] of lista) {
    try { await fn(); console.log('ok   ' + n); }
    catch (e) { fallas++; console.log('FALLA ' + n + '\n      ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n      ')); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + (lista.length - fallas) + '/' + lista.length + ' pruebas');
  process.exit(fallas ? 1 : 0);
})();
