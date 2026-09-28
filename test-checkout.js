/*
 * Prueba de las funciones puras del checkout con el transfer.
 *
 * Por que existe: checkoutTotals(), checkoutAside() y checkoutWhatsappUrl()
 * quedaron bifurcadas por pedido (tours / transfer) y las dos ramas comparten
 * el mismo DOM. Un error aca no se ve en ningun tipo de error de sintaxis: se ve
 * como un checkout que dice "0 actividades" o un WhatsApp sin el hotel.
 *
 * Se prueban extrayendo las funciones del IIFE de app.js con un stub de las
 * dependencias (money, detailState, etc.), no la app entera.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

/* Recorta una funcion por nombre, contando llaves. */
function extraer(nombre) {
  const i = src.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('no existe ' + nombre);
  let k = src.indexOf('{', i), nivel = 0;
  for (let p = k; p < src.length; p++) {
    if (src[p] === '{') nivel++;
    else if (src[p] === '}') { nivel--; if (nivel === 0) return src.slice(i, p + 1); }
  }
  throw new Error('llaves sin cerrar en ' + nombre);
}

let fallos = 0;
function prueba(nombre, fn) {
  try { fn(); console.log('  ok  ' + nombre); }
  catch (e) { fallos++; console.log('  FALLA ' + nombre + ': ' + e.message); }
}

/* --- Estado simulado --- */
const PRECIOS = { compartido: 35, privado: 118, soloPrivado: false };
const estado = {
  meta: { dest: { name: 'Río de Janeiro', key: 'rio', photo: '' }, pax: 2, dep: '17 dic.', ret: '24 dic.', nights: 7, origin: 'MVD' },
  transportMode: 'flight',
  transferType: 'shared',
  transferWizard: { pickupMinutes: '60', customTime: '', hotelName: 'Casa Joseph' },
  selectedTours: [],
  selectedHotel: true,
  selectedHotelName: 'Casa Joseph',
  selectedHotelTotal: 900
};
const S = { pax: 2, origin: 'MVD' };

/* Dependencias que las funciones del checkout tocan. money y esc se declaran
   como funciones con nombre porque el cuerpo se evalua con new Function. */
const stubs = {
  money: null, esc: null,
  transferPreciosDe: () => PRECIOS,
  getSelectedTransferAmount: (state) => {
    if (state.transferType === 'private') return PRECIOS.privado;
    if (state.transferType === 'shared') return PRECIOS.compartido * state.meta.pax;
    return 0;
  },
  getTransferPickupWindow: () => ({
    baseDate: new Date('2026-12-17T14:20:00Z'),
    plusOneHour: new Date('2026-12-17T15:20:00Z'),
    plusTwoHours: new Date('2026-12-17T16:20:00Z')
  }),
  transferPickupTimeLabel: (d) => d.toISOString().slice(11, 16),
  getTransferPickupLabel: (m, c) => (m === 'custom' ? 'Horario personalizado' : Number(m) === 60 ? '1 hora después de la llegada' : '2 horas después de la llegada'),
  findSelectedHotelLabel: () => 'Casa Joseph',
  originCityName: () => 'Montevideo',
  storyDateRange: () => '17 – 24 dic. 2026',
  getSelectedFlightSummary: () => ({ airline: 'GOL', flightNumber: 'G3 1748', arrivalText: '17 dic., 02:20 p. m.', summary: 'x' }),
  categoryIcon: () => '<svg class="trip-summary__ico"></svg>',
  checkIcon: () => '<svg></svg>',
  CHECKOUT_PAYMENTS: [{ id: 'brou', label: 'Banco República', kind: 'Transferencia', mark: 'BROU', brand: '#0d3b8f' }],
  CHECKOUT_TITLES: ['Sr.'], CHECKOUT_DOC_TYPES: ['Cédula'], CHECKOUT_COUNTRIES: ['Uruguay'],
  CHECKOUT_STEPS: [{ label: 'Datos' }, { label: 'Pago' }, { label: 'Listo' }],
  detailState: estado, S: S
};

const cuerpo = ['checkoutIsTransfer', 'checkoutTours', 'checkoutTransferLine', 'checkoutTotals',
  'transferPickupSummary', 'transferHotelName', 'checkoutAside', 'checkoutField',
  'checkoutTransferBlock', 'checkoutPanelDatos', 'checkoutPanelListo', 'checkoutWhatsappUrl', 'checkoutRef']
  .map(extraer).join('\n');

const sandbox = Object.assign({}, stubs, {
  checkoutState: { step: 0, form: {}, payment: 'brou', kind: 'transfer' },
  console: console
});
const deps =
  'function money(n){ var v=Number(n); return "R$ " + (Number.isFinite(v)?v:0).toFixed(2).replace(".", ","); }\n' +
  'function esc(s){ return String(s == null ? "" : s); }\n' +
  'var transferPreciosDe=stubs.transferPreciosDe, getSelectedTransferAmount=stubs.getSelectedTransferAmount,\n' +
  'getTransferPickupWindow=stubs.getTransferPickupWindow, transferPickupTimeLabel=stubs.transferPickupTimeLabel,\n' +
  'getTransferPickupLabel=stubs.getTransferPickupLabel, findSelectedHotelLabel=stubs.findSelectedHotelLabel,\n' +
  'originCityName=stubs.originCityName, storyDateRange=stubs.storyDateRange, getSelectedFlightSummary=stubs.getSelectedFlightSummary,\n' +
  'categoryIcon=stubs.categoryIcon, checkIcon=stubs.checkIcon;\n' +
  'var CHECKOUT_PAYMENTS=stubs.CHECKOUT_PAYMENTS, CHECKOUT_TITLES=stubs.CHECKOUT_TITLES,\n' +
  'CHECKOUT_DOC_TYPES=stubs.CHECKOUT_DOC_TYPES, CHECKOUT_COUNTRIES=stubs.CHECKOUT_COUNTRIES, CHECKOUT_STEPS=stubs.CHECKOUT_STEPS;\n';
const fns = new Function('checkoutState', 'detailState', 'S', 'stubs', deps + cuerpo +
  '\nreturn {checkoutTotals, checkoutAside, checkoutWhatsappUrl, checkoutPanelDatos, checkoutPanelListo, checkoutTransferBlock, transferPickupSummary, transferHotelName};'
)(sandbox.checkoutState, estado, S, stubs);

const T = fns.checkoutTotals();
const ASIDE = fns.checkoutAside();
const WA = decodeURIComponent(fns.checkoutWhatsappUrl().replace('https://wa.me/?text=', ''));
const DATOS = fns.checkoutPanelDatos();
const LISTO = fns.checkoutPanelListo();

console.log('\n  total: ' + T.total + ' · pax ' + T.pax + ' · count ' + T.count + ' · perPerson ' + T.perPerson);
console.log('  aside: ' + ASIDE.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220));
console.log('  whatsapp:\n    ' + WA.split('\n').join('\n    '));
console.log('  datos: ' + DATOS.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200));
console.log('  listo: ' + LISTO.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200));

console.log('');
prueba('el total del compartido es por persona', () => assert.strictEqual(T.total, 70));
prueba('count vale 1 con una modalidad elegida', () => assert.strictEqual(T.count, 1));
prueba('perPerson es el precio unitario del compartido', () => assert.strictEqual(T.perPerson, 35));
prueba('el aside trae el total', () => assert.ok(ASIDE.includes('R$ 70,00')));
prueba('el aside trae el horario de recogida', () => assert.ok(ASIDE.includes('1 hora después de la llegada')));
prueba('el aside trae el hotel', () => assert.ok(ASIDE.includes('Casa Joseph')));
prueba('el aside trae el vuelo', () => assert.ok(ASIDE.includes('G3 1748')));
prueba('el aside NO dice "por persona" para el privado', () => {
  estado.transferType = 'private';
  const t2 = fns.checkoutTotals();
  assert.strictEqual(t2.total, 118, 'el privado no se multiplica por pax');
  assert.strictEqual(t2.perPerson, null, 'sin division para el auto');
  const a2 = fns.checkoutAside();
  assert.ok(a2.includes('vehículo exclusivo'), 'el aside lo dice con palabras');
  assert.ok(!a2.includes('118,00 por persona'), 'no inventa un precio por persona');
  estado.transferType = 'shared';
});
prueba('sin modalidad no hay linea y el checkout no abre', () => {
  estado.transferType = '';
  assert.strictEqual(fns.checkoutTotals().count, 0);
  assert.ok(fns.checkoutWhatsappUrl() === null, 'sin linea no hay mensaje');
  estado.transferType = 'shared';
});
prueba('el whatsapp del transfer lleva modalidad, recogida, vuelo y hotel', () => {
  assert.ok(/Transfer: Transfer compartido/.test(WA), 'modalidad');
  assert.ok(/Recogida: 1 hora después de la llegada \(15:20\)/.test(WA), 'horario');
  assert.ok(/Vuelo: GOL · G3 1748/.test(WA), 'vuelo');
  assert.ok(/Hotel: Casa Joseph/.test(WA), 'hotel');
  assert.ok(/Total del transfer: R\$ 70,00/.test(WA), 'total');
  assert.ok(/Medio de pago preferido: Banco República/.test(WA), 'pago');
  assert.ok(!/Actividades/.test(WA), 'no menciona actividades');
});
prueba('el panel de datos pide el hotel y reminds la recogida', () => {
  assert.ok(/name="transferHotel"/.test(DATOS), 'campo del hotel');
  assert.ok(/checkout-panel__subtitle">El traslado/.test(DATOS), 'subtitulo');
  assert.ok(/checkout-transfer-note/.test(DATOS), 'recordatorio del horario');
  assert.ok(/Casa Joseph/.test(DATOS), 'va prellenado con el hotel elegido');
});
prueba('el recap del transfer no dice actividades', () => {
  assert.ok(/El traslado/.test(LISTO));
  assert.ok(!/Actividades en/.test(LISTO));
  assert.ok(/R\$ 70,00 · R\$ 35,00 c\/u/.test(LISTO), 'total y unitario');
});

/* El mismo codigo con el pedido de actividades no puede romperse. */
sandbox.checkoutState.kind = 'tours';
estado.selectedTours = [{ title: 'Paseo en escuna', price: 42 }];
estado.toursTotal = 42;
const T2 = fns.checkoutTotals();
const A2 = fns.checkoutAside();
const W2 = decodeURIComponent(fns.checkoutWhatsappUrl().replace('https://wa.me/?text=', ''));
const D2 = fns.checkoutPanelDatos();
const L2 = fns.checkoutPanelListo();
console.log('\n  tours: total ' + T2.total + ' · ' + W2.split('\n')[0]);
prueba('tours: el total es por persona por pax', () => assert.strictEqual(T2.total, 84));
prueba('tours: el aside no muestra datos de transfer', () => assert.ok(!A2.includes('Recogida')));
prueba('tours: el panel de datos no pide hotel', () => assert.ok(!D2.includes('transferHotel')));
prueba('tours: el whatsapp es el de actividades', () => {
  assert.ok(/reservar actividades/.test(W2));
  assert.ok(/Actidades:/.test(W2.replace('Actividades:', 'Actidades:')));
  assert.ok(/Paseo en escuna \(R\$ 42,00 por persona\)/.test(W2));
});
prueba('tours: el recap lista actividades', () => assert.ok(/Actividades en Río de Janeiro/.test(L2)));

console.log('\n' + (fallos ? fallos + ' FALLAS' : 'todo bien'));
process.exit(fallos ? 1 : 0);
