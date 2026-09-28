/*
 * Prueba de las funciones puras del checkout con los dos pedidos juntos.
 *
 * Por que existe: el checkout lleva un solo pedido que puede tener actividades Y
 * transfer, y las dos ramas comparten el mismo DOM, el mismo aside y el mismo
 * mensaje de WhatsApp. Un error aca no se ve como error de sintaxis: se ve como
 * un checkout que suma solo una de las dos cosas, o que manda un total que no
 * es el de "Mi Viaje".
 *
 * Se prueban extrayendo las funciones del IIFE de app.js con un stub de las
 * dependencias, no la app entera. Si se renombra o se cambia la firma de alguna,
 * el extractor deja de encontrar la funcion y el test falla con "no existe", que
 * es mejor que un test que pasa en verde probando la copia vieja.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

/* Recorta una funcion por nombre, contando llaves. */
function extraer(nombre) {
  const i = src.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('no existe ' + nombre);
  const k = src.indexOf('{', i);
  let nivel = 0;
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
  transferWizard: { hotelName: 'Casa Joseph' },
  selectedTours: [],
  selectedHotel: true,
  selectedHotelName: 'Casa Joseph',
  selectedHotelTotal: 900
};
const S = { pax: 2, origin: 'MVD' };

/* Dependencias que las funciones del checkout tocan. money y esc se declaran
   como funciones con nombre porque el cuerpo se evalua con new Function. */
const stubs = {
  transferPreciosDe: () => PRECIOS,
  getSelectedTransferAmount: (state) => {
    if (state.transferType === 'private') return PRECIOS.privado;
    if (state.transferType === 'shared') {
      // Igual que la version real: sin van compartida el monto es 0, aunque el
      // estado siga diciendo 'shared' de un destino anterior.
      if (PRECIOS.soloPrivado) return 0;
      return PRECIOS.compartido * state.meta.pax;
    }
    return 0;
  },
  getSelectedFlightSummary: () => ({ airline: 'GOL', flightNumber: 'G3 1748', arrivalText: '17 dic., 02:20 p. m.', summary: 'x' }),
  findSelectedHotelLabel: () => 'Casa Joseph',
  originCityName: () => 'Montevideo',
  storyDateRange: () => '17 – 24 dic. 2026',
  categoryIcon: () => '<svg class="trip-summary__ico"></svg>',
  CHECKOUT_PAYMENTS: [{ id: 'brou', label: 'Banco República', kind: 'Transferencia', mark: 'BROU', brand: '#0d3b8f' }],
  CHECKOUT_TITLES: ['Sr.'], CHECKOUT_DOC_TYPES: ['Cédula'], CHECKOUT_COUNTRIES: ['Uruguay'],
  CHECKOUT_STEPS: [{ label: 'Datos' }, { label: 'Pago' }, { label: 'Listo' }]
};

const cuerpo = ['checkoutTours', 'checkoutTransferLine', 'checkoutPedido', 'checkoutTotals',
  'transferHotelName', 'checkoutAside', 'checkoutField', 'checkoutTransferBlock',
  'checkoutPanelDatos', 'checkoutPanelListo', 'checkoutWhatsappUrl', 'checkoutRef']
  .map(extraer).join('\n');

const deps =
  'function money(n){ var v=Number(n); return "R$ " + (Number.isFinite(v)?v:0).toFixed(2).replace(".", ","); }\n' +
  'function esc(s){ return String(s == null ? "" : s); }\n' +
  'var transferPreciosDe=stubs.transferPreciosDe, getSelectedTransferAmount=stubs.getSelectedTransferAmount;\n' +
  'getSelectedFlightSummary=stubs.getSelectedFlightSummary, findSelectedHotelLabel=stubs.findSelectedHotelLabel,\n' +
  'originCityName=stubs.originCityName, storyDateRange=stubs.storyDateRange, categoryIcon=stubs.categoryIcon;\n' +
  'var CHECKOUT_PAYMENTS=stubs.CHECKOUT_PAYMENTS, CHECKOUT_TITLES=stubs.CHECKOUT_TITLES,\n' +
  'CHECKOUT_DOC_TYPES=stubs.CHECKOUT_DOC_TYPES, CHECKOUT_COUNTRIES=stubs.CHECKOUT_COUNTRIES, CHECKOUT_STEPS=stubs.CHECKOUT_STEPS;\n';

const checkoutState = { step: 0, form: {}, payment: 'brou' };
const fns = new Function('checkoutState', 'detailState', 'S', 'stubs', deps + cuerpo +
  '\nreturn {checkoutTotals, checkoutPedido, checkoutAside, checkoutWhatsappUrl, checkoutPanelDatos, checkoutPanelListo, checkoutTransferBlock};'
)(checkoutState, estado, S, stubs);

function ver(etiqueta) {
  const t = fns.checkoutTotals();
  const wa = decodeURIComponent(fns.checkoutWhatsappUrl().replace('https://wa.me/?text=', ''));
  console.log('\n=== ' + etiqueta + ' ===');
  console.log('  total ' + t.total + ' · count ' + t.count + ' · porPersona ' + t.perPersona);
  console.log('  aside: ' + fns.checkoutAside().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240));
  console.log('  whatsapp:\n    ' + wa.split('\n').join('\n    '));
  console.log('');
  return { t, wa };
}

/* --- 1. Los dos pedidos juntos --- */
estado.selectedTours = [{ title: 'Paseo en escuna', price: 42 }];
let r = ver('actividades + transfer compartido');

prueba('el total suma las dos cosas: 42 x 2 + 35 x 2', () => assert.strictEqual(r.t.total, 154));
prueba('count cuenta las dos lineas', () => assert.strictEqual(r.t.count, 2));
prueba('el total del transfer ya viene escalado y no se vuelve a multiplicar', () => assert.strictEqual(r.t.transferTotal, 70));
prueba('el aside lista las dos cosas', () => {
  const a = fns.checkoutAside();
  assert.ok(a.includes('Paseo en escuna'), 'la actividad');
  assert.ok(a.includes('Transfer compartido'), 'el transfer');
  assert.ok(a.includes('154,00'), 'el total de los dos');
});
prueba('el aside no inventa horario de recogida', () => assert.ok(!fns.checkoutAside().includes('Recogida')));
prueba('el whatsapp abre pidiendo las dos cosas', () => assert.ok(/actividades y un transfer/.test(r.wa)));
prueba('el whatsapp lista actividades y transfer', () => {
  assert.ok(/Actividades:\n- Paseo en escuna \(R\$ 42,00 por persona\)/.test(r.wa), 'actividades');
  assert.ok(/Transfer: Transfer compartido · R\$ 70,00/.test(r.wa), 'transfer');
  assert.ok(/Total de actividades: R\$ 84,00/.test(r.wa), 'subtotal de actividades escalado');
  assert.ok(/Total a confirmar: R\$ 154,00/.test(r.wa), 'total de todo');
});
prueba('el whatsapp pide punto de encuentro y horario', () => assert.ok(/punto de encuentro y el valor final/.test(r.wa)));
prueba('el panel de datos pide el hotel y no la hora', () => {
  const d = fns.checkoutPanelDatos();
  assert.ok(/name="transferHotel"/.test(d));
  assert.ok(/Casa Joseph/.test(d), 'prellenado con el hotel elegido');
  assert.ok(!/type="time"/.test(d), 'no hay campo de horario');
  assert.ok(!/recogida 1 hora/.test(d), 'no propone una hora');
});
prueba('el recap lista los dos bloques', () => {
  const l = fns.checkoutPanelListo();
  assert.ok(/Actividades en Río de Janeiro/.test(l));
  assert.ok(/El traslado/.test(l));
  assert.ok(/A coordinar con el operador/.test(l), 'el horario aparece como a coordinar');
});

/* --- 2. Solo actividades --- */
estado.transferType = '';
r = ver('solo actividades');

prueba('sin transfer el total es el de las actividades', () => assert.strictEqual(r.t.total, 84));
prueba('sin transfer el aside no muestra datos de traslado', () => {
  const a = fns.checkoutAside();
  assert.ok(!a.includes('Vuelo'), 'vuelo');
  assert.ok(!a.includes('<b>Transfer'), 'transfer');
  assert.ok(!a.includes('Recogida'), 'recogida');
});
prueba('sin transfer el panel de datos no pide hotel', () => assert.ok(!fns.checkoutPanelDatos().includes('transferHotel')));
prueba('sin transfer el whatsapp es el de actividades', () => {
  assert.ok(/reservar actividades/.test(r.wa));
  assert.ok(!/Transfer:/.test(r.wa));
});

/* --- 3. Solo transfer privado --- */
estado.selectedTours = [];
estado.transferType = 'private';
r = ver('solo transfer privado');

prueba('el privado no se multiplica por pax', () => assert.strictEqual(r.t.total, 118));
prueba('el privado no muestra precio por persona', () => {
  assert.strictEqual(r.t.perPerson, null, 'perPerson es null, no un numero');
  const a = fns.checkoutAside();
  assert.ok(!/118,00 por persona/.test(a));
  assert.ok(/2 personas/.test(a), 'dice cuantos viajan y nada mas');
});
prueba('el privado no dice "por persona" en el whatsapp', () => {
  assert.ok(/Transfer: Transfer privado · R\$ 118,00/.test(r.wa));
  assert.ok(!/por persona\)/.test(r.wa.split('Transfer:')[1].split('\n')[0]));
});

/* --- 4. Nada elegido --- */
estado.transferType = '';
prueba('sin nada elegido no hay mensaje', () => assert.ok(fns.checkoutWhatsappUrl() === null));
prueba('sin nada elegido count es 0', () => assert.strictEqual(fns.checkoutTotals().count, 0));

/* --- 5. Destino sin van compartida --- */
estado.transferType = 'shared';
/* El bug que esto cazó: detailState.transferType puede quedar en 'shared' cuando
   el destino ya no tiene van compartida — se marcó en Río y después se cambió
   el destino —, y getSelectedTransferAmount() devuelve 0. Mirar solo el precio
   unitario de la tabla metía una línea de R$ 0 en el pedido. */
PRECIOS.soloPrivado = true;
estado.selectedTours = [];
estado.transferType = 'private';
prueba('un destino sin van compartida ofrece igual el privado', () => {
  const t = fns.checkoutTotals();
  assert.strictEqual(t.count, 1);
  assert.strictEqual(t.total, 118);
});
estado.transferType = 'shared';
prueba('el compartido no entra al pedido si el destino no tiene van', () => {
  const t = fns.checkoutTotals();
  assert.strictEqual(t.count, 0, 'no hay linea de un transfer que no existe');
  assert.strictEqual(t.total, 0, 'no suma R$ 0');
});
PRECIOS.soloPrivado = false;
estado.transferType = '';

console.log('\n' + (fallos ? fallos + ' FALLAS' : 'todo bien'));
process.exit(fallos ? 1 : 0);
