'use strict';
/*
 * Pruebas de la operativa de reservas: fecha, hora y pickup de cada servicio, pasajeros, ficha del cliente y el
 * voucher con esos datos.
 *
 *   node test-operativa.js
 *
 * Las fichas van a un archivo temporal (OP_ARCHIVO): no toca Supabase ni data/_trabajo.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.VERCEL;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-op-'));
process.env.OP_ARCHIVO = path.join(tmp, 'clientes.json');

const pedidos = require('./lib/pedidos');
const op = require('./lib/operativa');
const mail = require('./lib/mail-cliente');

let pruebas = 0, fallas = 0;
const lista = [];
function t(nombre, fn) { lista.push([nombre, fn]); }

t('cada servicio guarda fecha, hora y pickup; lo invalido queda vacio', function () {
  const i = pedidos.limpiarItem({ nombre: 'Traslado', fecha_servicio: '2026-10-18', hora: '08:30', pickup: '  Hotel Ibis, hab. 204 ' });
  assert.strictEqual(i.fecha_servicio, '2026-10-18');
  assert.strictEqual(i.hora, '08:30');
  assert.strictEqual(i.pickup, 'Hotel Ibis, hab. 204');
  const mal = pedidos.limpiarItem({ fecha_servicio: '18/10', hora: '25:00' });
  assert.strictEqual(mal.fecha_servicio, null);
  assert.strictEqual(mal.hora, '');
});
t('un pedido viejo sin esos campos sigue leyendose igual', function () {
  const i = pedidos.limpiarItem({ nombre: 'Tour', precio_usd: 50 });
  assert.strictEqual(i.fecha_servicio, null);
  assert.strictEqual(i.pickup, '');
  assert.strictEqual(pedidos.operativaTxt(i), '');
});
t('la linea operativa dice dia, hora y pickup', function () {
  assert.strictEqual(pedidos.operativaTxt({ fecha_servicio: '2026-10-17', hora: '07:15', pickup: 'Pousada do Sol' }), 'sáb 17/10 · 07:15 h · Pickup: Pousada do Sol');
});
t('pasajeros: se limpian, la edad es un numero y las filas vacias se descartan', function () {
  const c = pedidos.limpiarPatch({ pasajeros: [{ nombre: ' Ana Pérez ', documento: 'C1234567', edad: '34', nota: 'vegetariana' }, { nombre: 'Tomi', edad: '4' }, {}, { edad: '200' }] });
  assert.deepStrictEqual(c.pasajeros, [{ nombre: 'Ana Pérez', documento: 'C1234567', edad: 34, nota: 'vegetariana' }, { nombre: 'Tomi', documento: '', edad: 4, nota: '' }]);
});
t('un patch sin pasajeros no los toca', function () {
  assert.ok(!('pasajeros' in pedidos.limpiarPatch({ notas: 'x' })));
});
t('la clave del cliente es su WhatsApp normalizado, o su email', function () {
  assert.strictEqual(op.claveCliente({ cliente_telefono: '099 123 456' }), 'tel:59899123456');
  assert.strictEqual(op.claveCliente({ cliente_telefono: '+598 99 123 456' }), 'tel:59899123456');
  assert.strictEqual(op.claveCliente({ cliente_telefono: '', cliente_email: 'Ana@Mail.com ' }), 'mail:ana@mail.com');
  assert.strictEqual(op.claveCliente({}), '');
});
t('la clave del panel es la misma que la del server', function () {
  const src = fs.readFileSync(path.join(__dirname, 'public', 'admin', 'admin.js'), 'utf8');
  const cuerpo = src.slice(src.indexOf('function claveCli(p) {'), src.indexOf('function fichaDe(p)'));
  const claveCli = new Function(cuerpo + '; return claveCli;')();
  [{ cliente_telefono: '099 123 456' }, { cliente_telefono: '+55 (81) 99118-3035' }, { cliente_email: 'X@y.com' }, { cliente_telefono: '12' }].forEach(function (p) {
    assert.strictEqual(claveCli(p), op.claveCliente(p), JSON.stringify(p));
  });
});
t('ficha: guarda alerta y notas y se vuelve a leer; una clave invalida no pasa', async function () {
  await op.guardarFicha({ clave: 'tel:59899123456', pais: 'Uruguay', alerta: 'Requiere silla de bebé', notas: 'Viaja con un bebé de 1 año' }, 'admin');
  await op.guardarFicha({ clave: 'tel:59899123456', pais: 'Uruguay', alerta: 'Requiere silla de bebé en el traslado', notas: '' }, 'admin');
  const f = (await op.fichas()).fichas;
  assert.strictEqual(f.length, 1, 'la segunda vez actualiza, no duplica');
  assert.strictEqual(f[0].alerta, 'Requiere silla de bebé en el traslado');
  assert.strictEqual(f[0].actualizado_por, 'admin');
  await assert.rejects(op.guardarFicha({ clave: 'cualquier cosa' }, 'admin'), /inválido/);
});
t('el voucher (mail y PDF) lleva la fecha, la hora y el pickup del servicio', function () {
  const p = { ref: 'CS-TEST01', estado: 'confirmado', cliente_nombre: 'Ana Pérez', cliente_email: 'ana@mail.com', destino: 'Natal', fecha_ida: '2026-10-16', fecha_vuelta: '2026-10-22', personas: 2,
    items: [pedidos.limpiarItem({ tipo: 'traslado', nombre: 'Aeropuerto – hotel', precio_usd: 40, estado: 'confirmado', fecha_servicio: '2026-10-16', hora: '14:00', pickup: 'Aeropuerto de Natal, salida nacional' })],
    pagos: [{ id: 'a', fecha: '2026-10-10', monto_usd: 40, medio: 'Transferencia' }] };
  const m = mail._recibo(p, 'saldo', 5.4);
  assert.ok(m.html.indexOf('14:00 h · Pickup: Aeropuerto de Natal, salida nacional') >= 0, 'en el mail');
  const pdf = Buffer.from(m.adjuntos[0].content, 'base64').toString('latin1');
  assert.ok(pdf.indexOf('Pickup: Aeropuerto de Natal') >= 0, 'en el PDF');
});

(async function () {
  for (const [nombre, fn] of lista) {
    pruebas++;
    try { await fn(); console.log('  ok     ' + nombre); }
    catch (e) { fallas++; console.log('  FALLÓ  ' + nombre + '\n         ' + String(e.message).split('\n')[0]); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + (pruebas - fallas) + '/' + pruebas + ' pruebas ok');
  if (fallas) process.exit(1);
})();
