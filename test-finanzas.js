'use strict';
/*
 * Pruebas de Finanzas (lib/finanzas.js): importes, duplicados, saldos por moneda, pagos parciales, verificacion a
 * mano, anulaciones y auditoria.
 *
 *   node test-finanzas.js
 *
 * Corre en modo archivo, sobre un archivo temporal: no toca Supabase ni data/_trabajo. Los pedidos y proveedores
 * son de mentira.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.VERCEL;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-fin-'));
process.env.FIN_ARCHIVO = path.join(tmp, 'finanzas.json');

const fin = require('./lib/finanzas');
const PROV = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Natal e Pipa Passeios', moneda: 'BRL' };
const PED = { id: '22222222-2222-4222-8222-222222222222', ref: 'CS-ABC123', items: [{ id: 'it1', nombre: 'Paseo a Pipa', tipo: 'tour' }, { id: 'it2', nombre: 'Traslado aeropuerto', tipo: 'traslado' }] };
fin._deps.pedidos = function () {
  return { obtenerPedido: async function (id) { return id === PED.id ? PED : null; }, listarProveedores: async function () { return [PROV]; } };
};
const YO = { usuario: 'admin', ip: '127.0.0.1' };

let pruebas = 0, fallas = 0;
const lista = [];
function t(nombre, fn) { lista.push([nombre, fn]); }
async function correr() {
  for (const [nombre, fn] of lista) {
    pruebas++;
    try { await fn(); console.log('  ok     ' + nombre); }
    catch (e) { fallas++; console.log('  FALLÓ  ' + nombre + '\n         ' + String(e.message).split('\n')[0]); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + (pruebas - fallas) + '/' + pruebas + ' pruebas ok');
  if (fallas) process.exit(1);
}
async function rechaza(p, status, texto) {
  try { await p; } catch (e) {
    if (status) assert.strictEqual(e.status, status, 'status ' + e.status + ': ' + e.message);
    if (texto) assert.ok(texto.test(e.message), 'mensaje: ' + e.message);
    return e;
  }
  throw new Error('tenía que rechazarse');
}
const mov = function (x) { return Object.assign({ sentido: 'entrada', moneda: 'USD', importe: 100, fecha: '2026-10-10', referencia: 'OP-1', contraparte: 'Ana' }, x); };

/* ---------- importes y validaciones ---------- */
t('lee importes como los escribe la gente', function () {
  assert.strictEqual(fin.importe('1.234,50'), 1234.5);
  assert.strictEqual(fin.importe('1234,5'), 1234.5);
  assert.strictEqual(fin.importe('1234.5'), 1234.5);
  assert.strictEqual(fin.importe('R$ 1.200'), 1200);
  assert.strictEqual(fin.importe(99.999), 100);
  assert.strictEqual(fin.importe('0'), null);
  assert.strictEqual(fin.importe('-5'), null);
  assert.strictEqual(fin.importe('abc'), null);
});
t('un movimiento sin moneda, importe, fecha o identificacion no pasa', function () {
  assert.throws(function () { fin.limpiarMovimiento(mov({ moneda: 'EUR' })); }, /moneda/);
  assert.throws(function () { fin.limpiarMovimiento(mov({ importe: 0 })); }, /importe/);
  assert.throws(function () { fin.limpiarMovimiento(mov({ fecha: '' })); }, /fecha/);
  assert.throws(function () { fin.limpiarMovimiento(mov({ fecha: '2099-01-01' })); }, /futuro/);
  assert.throws(function () { fin.limpiarMovimiento(mov({ referencia: '', contraparte: '' })); }, /operación/);
});
t('la huella no cambia por mayusculas, espacios o guiones de la referencia', function () {
  assert.strictEqual(fin.huella(fin.limpiarMovimiento(mov({ referencia: 'op 1' }))), fin.huella(fin.limpiarMovimiento(mov({ referencia: 'OP-1' }))));
  assert.notStrictEqual(fin.huella(fin.limpiarMovimiento(mov())), fin.huella(fin.limpiarMovimiento(mov({ moneda: 'UYU' }))));
});
t('solo PDF, JPG o PNG por lo que dicen sus bytes', function () {
  assert.strictEqual(fin.tipoArchivo(Buffer.from('%PDF-1.7 xxxxxx')).ext, 'pdf');
  assert.strictEqual(fin.tipoArchivo(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0])).ext, 'jpg');
  assert.strictEqual(fin.tipoArchivo(Buffer.from('<html><script>alert(1)</script>')), null);
});

/* ---------- flujo completo en modo archivo ---------- */
let cobro, oblig, pix;
t('registra un cobro asignado al pedido, sin verificar', async function () {
  const r = await fin.registrarMovimiento(mov({ asignaciones: [{ tipo: 'cobro', pedido_id: PED.id, importe: 100 }] }), YO);
  cobro = r.movimiento;
  assert.strictEqual(cobro.estado, 'registrado');
  assert.strictEqual(r.asignaciones[0].pedido_ref, 'CS-ABC123');
  const c = fin.calcular(await fin.todo());
  assert.strictEqual(c.pedidos[PED.id].cobrado_usd, 0);
  assert.strictEqual(c.pedidos[PED.id].por_verificar_usd, 100);
  assert.strictEqual(c.kpis.por_verificar.n, 1);
});
t('la misma transferencia no entra dos veces', async function () {
  const e = await rechaza(fin.registrarMovimiento(mov({ referencia: 'op 1' }), YO), 409, /ya está cargada/);
  assert.ok(e.duplicado);
});
t('una parecida (mismo importe, otra referencia, 1 dia despues) pide confirmar', async function () {
  const e = await rechaza(fin.registrarMovimiento(mov({ referencia: 'OP-2', fecha: '2026-10-11' }), YO), 409, /otra distinta/);
  assert.ok(e.parecido);
});
t('no se verifica sin confirmar que se vio en el banco', async function () {
  await rechaza(fin.verificar(cobro.id, {}, YO), 400, /home banking/);
});
t('verificada pasa a contar como cobrada', async function () {
  const v = await fin.verificar(cobro.id, { confirmo: true }, YO);
  assert.strictEqual(v.estado, 'verificado');
  assert.strictEqual(v.verificado_por, 'admin');
  const c = fin.calcular(await fin.todo());
  assert.strictEqual(c.pedidos[PED.id].cobrado_usd, 100);
  assert.strictEqual(c.kpis.por_verificar.n, 0);
});
t('sin referencia ni comprobante no se puede verificar', async function () {
  const r = await fin.registrarMovimiento(mov({ referencia: '', contraparte: 'Beto', importe: 50, fecha: '2026-10-01' }), YO);
  await rechaza(fin.verificar(r.movimiento.id, { confirmo: true }, YO), 400, /comprobante/);
  const v = await fin.verificar(r.movimiento.id, { confirmo: true, referencia: '998877' }, YO);
  assert.strictEqual(v.referencia, '998877');
});
t('un cobro en pesos a un pedido en dolares pide el equivalente y guarda el tipo de cambio', async function () {
  const r = await fin.registrarMovimiento(mov({ moneda: 'UYU', importe: '4.100', referencia: 'BROU-55', fecha: '2026-10-05' }), YO);
  await rechaza(fin.asignar({ movimiento_id: r.movimiento.id, tipo: 'cobro', pedido_id: PED.id, importe: 4100 }, YO), 400, /equivale/);
  const a = await fin.asignar({ movimiento_id: r.movimiento.id, tipo: 'cobro', pedido_id: PED.id, importe: 4100, importe_destino: 100 }, YO);
  assert.strictEqual(a.moneda_destino, 'USD');
  assert.strictEqual(a.tc, Math.round(100 / 4100 * 1e6) / 1e6);
});
t('no se asigna mas de lo que tiene la transferencia', async function () {
  const r = await fin.registrarMovimiento(mov({ importe: 80, referencia: 'OP-80', fecha: '2026-09-20' }), YO);
  await fin.asignar({ movimiento_id: r.movimiento.id, tipo: 'cobro', pedido_id: PED.id, importe: 50 }, YO);
  await rechaza(fin.asignar({ movimiento_id: r.movimiento.id, tipo: 'cobro', pedido_id: PED.id, importe: 31 }, YO), 409, /quedan USD 30/);
});
t('un cobro tiene que ser plata que entro', async function () {
  const r = await fin.registrarMovimiento(mov({ sentido: 'salida', moneda: 'BRL', importe: 10, referencia: 'E2E-X', fecha: '2026-09-01' }), YO);
  await rechaza(fin.asignar({ movimiento_id: r.movimiento.id, tipo: 'cobro', pedido_id: PED.id, importe: 10 }, YO), 400, /entró/);
});

t('crea la obligacion con la moneda del proveedor y el nombre del servicio', async function () {
  oblig = await fin.crearObligacion({ proveedor_id: PROV.id, pedido_id: PED.id, item_id: 'it1', concepto: 'total', importe: '900', vence: '2026-10-20' }, YO);
  assert.strictEqual(oblig.moneda, 'BRL');
  assert.strictEqual(oblig.servicio, 'Paseo a Pipa');
  assert.strictEqual(oblig.pedido_ref, 'CS-ABC123');
});
t('la misma obligacion dos veces pide confirmar', async function () {
  const e = await rechaza(fin.crearObligacion({ proveedor_id: PROV.id, pedido_id: PED.id, item_id: 'it1', concepto: 'total', importe: 900 }, YO), 409);
  assert.ok(e.repetida);
});
t('pago parcial por Pix: queda parcial con su saldo', async function () {
  const r = await fin.registrarMovimiento({ sentido: 'salida', medio: 'pix', moneda: 'BRL', importe: 270, fecha: '2026-10-12', referencia: 'E2E-001', contraparte: PROV.nombre, asignaciones: [{ tipo: 'pago', obligacion_id: oblig.id, importe: 270 }] }, YO);
  pix = r.movimiento;
  const o = fin.calcular(await fin.todo(), Date.parse('2026-10-15T15:00:00Z')).obligaciones.filter(function (x) { return x.id === oblig.id; })[0];
  assert.strictEqual(o.situacion, 'parcial');
  assert.strictEqual(o.por_verificar, 270);
  assert.strictEqual(o.saldo, 630);
  assert.strictEqual(o.vence_pronto, true);
});
t('no se le paga de mas a una obligacion', async function () {
  await rechaza(fin.registrarMovimiento({ sentido: 'salida', medio: 'pix', moneda: 'BRL', importe: 700, fecha: '2026-10-13', referencia: 'E2E-002', contraparte: PROV.nombre, asignaciones: [{ tipo: 'pago', obligacion_id: oblig.id, importe: 700 }] }, YO), 409, /faltan BRL 630/);
  const d = await fin.todo();
  assert.ok(!d.movimientos.some(function (m) { return m.referencia === 'E2E-002'; }), 'no tenía que guardarse el movimiento');
});
t('vencida si pasa la fecha con saldo', async function () {
  const o = fin.calcular(await fin.todo(), Date.parse('2026-10-25T15:00:00Z')).obligaciones.filter(function (x) { return x.id === oblig.id; })[0];
  assert.strictEqual(o.situacion, 'vencida');
});
t('los totales a pagar van por moneda, sin mezclar', async function () {
  await fin.crearObligacion({ proveedor_id: PROV.id, servicio: 'Traslado suelto', moneda: 'USD', importe: 40 }, YO);
  const k = fin.calcular(await fin.todo()).kpis;
  assert.strictEqual(k.a_pagar.BRL, 630);
  assert.strictEqual(k.a_pagar.USD, 40);
  assert.strictEqual(k.a_pagar.UYU, 0);
});
t('anular el Pix devuelve el saldo y lo deja en la historia', async function () {
  await rechaza(fin.anularMovimiento(pix.id, '', YO), 400, /motivo/);
  await fin.anularMovimiento(pix.id, 'Lo cargué con el importe mal', YO);
  const d = await fin.todo();
  const o = fin.calcular(d).obligaciones.filter(function (x) { return x.id === oblig.id; })[0];
  assert.strictEqual(o.saldo, 900);
  assert.ok(d.movimientos.some(function (m) { return m.id === pix.id && m.estado === 'anulado'; }), 'el movimiento sigue estando');
});
t('una obligacion con pagos no se anula hasta anular los pagos', async function () {
  const r = await fin.registrarMovimiento({ sentido: 'salida', medio: 'pix', moneda: 'BRL', importe: 900, fecha: '2026-10-14', referencia: 'E2E-003', contraparte: PROV.nombre, asignaciones: [{ tipo: 'pago', obligacion_id: oblig.id, importe: 900 }] }, YO);
  await rechaza(fin.anularObligacion(oblig.id, 'Se canceló', YO), 409, /pagos asignados/);
  await fin.verificar(r.movimiento.id, { confirmo: true }, YO);
  const o = fin.calcular(await fin.todo()).obligaciones.filter(function (x) { return x.id === oblig.id; })[0];
  assert.strictEqual(o.situacion, 'pagada');
  assert.strictEqual(o.saldo, 0);
});
t('el importe de una obligacion no se edita (solo vencimiento y nota)', async function () {
  const g = await fin.editarObligacion(oblig.id, { importe: 1, vence: '2026-11-01', nota: 'pagado en dos' }, YO);
  assert.strictEqual(Number(g.importe), 900);
  assert.strictEqual(g.vence, '2026-11-01');
});
t('comprobante: rechaza lo que no es PDF/imagen y guarda el bueno con nombre al azar', async function () {
  const r = await fin.registrarMovimiento(mov({ importe: 15, referencia: 'OP-15', fecha: '2026-08-01' }), YO);
  await rechaza(fin.subirComprobante(r.movimiento.id, { datos: Buffer.from('<html>hola</html>').toString('base64') }, YO), 415);
  const g = await fin.subirComprobante(r.movimiento.id, { datos: Buffer.from('%PDF-1.7 prueba de comprobante').toString('base64') }, YO);
  assert.ok(/^2026\/08\/[0-9a-f-]{36}\.pdf$/.test(g.comprobante), g.comprobante);
  assert.ok(/^data:application\/pdf;base64,/.test(await fin.linkComprobante(r.movimiento.id)));
});
t('cada cambio quedo en la auditoria, con quien', async function () {
  const a = await fin.auditoria();
  const acciones = a.map(function (x) { return x.entidad + ':' + x.accion; });
  ['movimiento:registrar', 'movimiento:verificar', 'movimiento:anular', 'asignacion:asignar', 'obligacion:crear', 'obligacion:editar', 'movimiento:comprobante'].forEach(function (k) {
    assert.ok(acciones.indexOf(k) >= 0, 'falta ' + k);
  });
  assert.ok(a.every(function (x) { return x.usuario === 'admin'; }));
});

correr();
