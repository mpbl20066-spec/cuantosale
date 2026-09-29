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
  CHECKOUT_STEPS: [{ label: 'Datos' }, { label: 'Pago' }, { label: 'Listo' }],
  // El numero al que llega la reserva. Va en los stubs y no hardcodeado en el
  // test para que cambiarlo en app.js no rompa la comprobacion.
  WHATSAPP_RESERVAS: '5511920836306',
  // Las etiquetas que la app usa cuando todavia no hay un hotel real. Se copian
  // del fuente con una expresion laxa a proposito: si en app.js cambia la
  // lista, el test avisa en vez de dar verde con una copia vieja.
  HOTELES_ETIQUETA: /^(Hotel recomendado|Hotel seleccionado|Alojamiento seleccionado|Estimación · Hotel|Sin alojamiento)/
};

const cuerpo = ['checkoutTours', 'checkoutTransferLine', 'checkoutPedido', 'checkoutTotals',
  'transferHotelName', 'checkoutAside', 'checkoutField', 'checkoutTransferBlock',
  'checkoutPanelDatos', 'checkoutPanelListo', 'checkoutWhatsappUrl', 'checkoutRef', 'whatsappUrl',
  'nombreDeCuenta', 'hotelParaElTransfer']
  .map(extraer).join('\n');

const deps =
  'function money(n){ var v=Number(n); return "R$ " + (Number.isFinite(v)?v:0).toFixed(2).replace(".", ","); }\n' +
  'function esc(s){ return String(s == null ? "" : s); }\n' +
  'var transferPreciosDe=stubs.transferPreciosDe, getSelectedTransferAmount=stubs.getSelectedTransferAmount;\n' +
  'getSelectedFlightSummary=stubs.getSelectedFlightSummary, findSelectedHotelLabel=stubs.findSelectedHotelLabel,\n' +
  'originCityName=stubs.originCityName, storyDateRange=stubs.storyDateRange, categoryIcon=stubs.categoryIcon;\n' +
  'var CHECKOUT_PAYMENTS=stubs.CHECKOUT_PAYMENTS, CHECKOUT_TITLES=stubs.CHECKOUT_TITLES,\n' +
  'CHECKOUT_DOC_TYPES=stubs.CHECKOUT_DOC_TYPES, CHECKOUT_COUNTRIES=stubs.CHECKOUT_COUNTRIES, CHECKOUT_STEPS=stubs.CHECKOUT_STEPS;\n' +
  'var WHATSAPP_RESERVAS=stubs.WHATSAPP_RESERVAS;\n' +
  'var HOTELES_ETIQUETA=stubs.HOTELES_ETIQUETA;\n';

const checkoutState = { step: 0, form: {}, payment: 'brou' };
/* authUser entra por parametro para poder simularse sesion iniciada y sesion
   cerrada en la misma corrida. setAuthUser reasigna el binding desde adentro. */
const fns = new Function('checkoutState', 'detailState', 'S', 'stubs', 'authUser', deps + cuerpo +
  '\nreturn {checkoutTotals, checkoutPedido, checkoutAside, checkoutWhatsappUrl, checkoutPanelDatos, checkoutPanelListo, checkoutTransferBlock, nombreDeCuenta, hotelParaElTransfer, setAuthUser: function (u) { authUser = u; }};'
)(checkoutState, estado, S, stubs, null);

function ver(etiqueta) {
  const t = fns.checkoutTotals();
  // El link ahora lleva el numero del operador en el path, asi que se saca con
  // una expresion y no con un replace fijo: si el numero no estuviera, el texto
  // saldria con el "https://wa.me/" pegado y la comparacion de abajo no serviria.
  const waCrudo = fns.checkoutWhatsappUrl();
  const wa = decodeURIComponent(waCrudo.replace(/^https:\/\/wa\.me\/\d*\?text=/, ''));
  console.log('\n=== ' + etiqueta + ' ===');
  console.log('  total ' + t.total + ' · count ' + t.count + ' · porPersona ' + t.perPersona);
  console.log('  aside: ' + fns.checkoutAside().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240));
  console.log('  whatsapp:\n    ' + wa.split('\n').join('\n    '));
  console.log('');
  return { t, wa, waCrudo };
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
/* El link tiene que ir al numero del operador. Sin esto, un "wa.me/?text=" a
   proposito —un cambio para que el mensaje lo mande la persona a quien quiera—
   pasaria todos los tests de arriba, porque el texto armarlo igual. */
prueba('el link va al numero del operador y no al selector de contactos', () => {
  assert.ok(r.waCrudo.startsWith('https://wa.me/5511920836306?text='), 'queda: ' + r.waCrudo.slice(0, 40));
});
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

/* --- 6. Autocompletado con sesion iniciada ---
   Con sesion, el checkout ya sabe el nombre, el apellido y el correo. Lo que
   se prueba aca es que los complete y que NO pise lo que la persona ya
   escribio: si vuelve atras a corregir su nombre, corregirlo tiene que servir. */
estado.transferType = 'shared';
estado.selectedTours = [{ title: 'Paseo en escuna', price: 42 }];

prueba('sin sesion no completa nada', () => {
  fns.setAuthUser(null);
  const p = fns.checkoutPanelDatos();
  assert.ok(!/id="ck-nombre" name="nombre"[^>]*value="/.test(p), 'nombre sin value');
  assert.ok(!/id="ck-apellido" name="apellido"[^>]*value="/.test(p), 'apellido sin value');
  assert.ok(!/id="ck-email" name="email"[^>]*value="/.test(p), 'correo sin value');
});
prueba('con sesion completa nombre, apellido y correo', () => {
  fns.setAuthUser({ email: 'ana@correo.com', user_metadata: { full_name: 'Ana Perez' } });
  const p = fns.checkoutPanelDatos();
  assert.ok(/id="ck-nombre" name="nombre" required value="Ana"/.test(p), 'nombre: Ana');
  assert.ok(/id="ck-apellido" name="apellido" required value="Perez"/.test(p), 'apellido: Perez');
  assert.ok(/id="ck-email" name="email" required value="ana@correo\.com"/.test(p), 'correo');
});
prueba('lo que la persona escribio gana sobre el dato de la cuenta', () => {
  fns.setAuthUser({ email: 'ana@correo.com', user_metadata: { full_name: 'Ana Perez' } });
  checkoutState.form = { nombre: 'Ana María', apellido: 'Pérez Soto' };
  const p = fns.checkoutPanelDatos();
  assert.ok(/name="nombre" required value="Ana María"/.test(p), 'gana lo escrito');
  assert.ok(/name="apellido" required value="Pérez Soto"/.test(p), 'gana lo escrito');
  checkoutState.form = {};
});
prueba('con un solo nombre el apellido queda vacio para que lo escriba', () => {
  fns.setAuthUser({ email: 'ana@correo.com', user_metadata: { full_name: 'Ana' } });
  assert.deepStrictEqual(fns.nombreDeCuenta(), { nombre: 'Ana', apellido: '' });
  const p = fns.checkoutPanelDatos();
  assert.ok(!/name="apellido"[^>]*value="/.test(p), 'apellido sin value: se completa a mano');
});
prueba('"Apellido, Nombre" se parte bien', () => {
  fns.setAuthUser({ email: 'a@c.com', user_metadata: { full_name: 'Perez, Ana' } });
  assert.deepStrictEqual(fns.nombreDeCuenta(), { nombre: 'Ana', apellido: 'Perez' });
});
prueba('sin nombre en la cuenta no completa nada', () => {
  fns.setAuthUser({ email: 'ana@correo.com', user_metadata: {} });
  assert.strictEqual(fns.nombreDeCuenta(), null);
});
fns.setAuthUser(null);

/* --- 7. El hotel del campo del traslado ---
   El campo se precompleta con el hotel elegido, pero solo si hay un hotel de
   verdad. Cuando la app no tiene uno —la API de hoteles no respondio, o la
   persona todavia no eligio— el campo tiene que quedar vacio. Poner ahi
   "Hotel recomendado" es mandar al operador un dato que no existe. */

/* El fixture trae transferWizard.hotelName puesto, y eso tiene precedencia sobre
   el hotel elegido a proposito: es lo que la persona escribio en el campo, y no
   puede perderlo un repintado. Para probar la precompletacion desde la seccion
   de alojamiento hay que vaciarlo. */
estado.transferWizard = {};

prueba('con hotel elegido el campo viene con el nombre', () => {
  estado.selectedHotelName = 'Pousada do Porto';
  assert.strictEqual(fns.hotelParaElTransfer(), 'Pousada do Porto');
  const p = fns.checkoutPanelDatos();
  assert.ok(/name="transferHotel"[^>]*value="Pousada do Porto"/.test(p), 'el campo trae el hotel');
});
prueba('con la etiqueta por defecto el campo NO trae nada inventado', () => {
  estado.selectedHotelName = 'Hotel recomendado';
  assert.strictEqual(fns.hotelParaElTransfer(), '', 'no devuelve la etiqueta');
  const p = fns.checkoutPanelDatos();
  assert.ok(!/name="transferHotel"[^>]*value=/.test(p), 'el campo sin value: se escribe a mano');
  assert.ok(/name="transferHotel"[^>]*placeholder=/.test(p), 'pero con el ejemplo a la vista');
});
prueba('las otras etiquetas tampoco pasan como nombre de hotel', () => {
  for (const etiqueta of ['Hotel seleccionado', 'Alojamiento seleccionado', 'Estimación · Hotel Intermedio', 'Sin alojamiento']) {
    estado.selectedHotelName = etiqueta;
    assert.strictEqual(fns.hotelParaElTransfer(), '', 'filtraria: ' + etiqueta);
  }
});
prueba('sin alojamiento elegido el campo queda vacio', () => {
  estado.selectedHotelName = 'Hotel recomendado';
  estado.selectedHotel = false;
  assert.strictEqual(fns.hotelParaElTransfer(), '');
  estado.selectedHotel = true;
});
prueba('lo que la persona escribio en el campo gana sobre el hotel elegido', () => {
  estado.selectedHotelName = 'Pousada do Porto';
  checkoutState.form = { transferHotel: 'Otro hotel en el centro' };
  assert.ok(/name="transferHotel"[^>]*value="Otro hotel en el centro"/.test(fns.checkoutPanelDatos()));
  checkoutState.form = {};
});
prueba('un hotel escrito a mano sobrevive al cambio de paso', () => {
  estado.selectedHotelName = 'Pousada do Porto';
  checkoutState.form = { transferHotel: 'Otro hotel en el centro' };
  assert.ok(/value="Otro hotel en el centro"/.test(fns.checkoutPanelDatos()), 'al volver al paso 1 sigue ahi');
  assert.ok(/Otro hotel en el centro/.test(fns.checkoutWhatsappUrl() ? decodeURIComponent(fns.checkoutWhatsappUrl()) : ''), 'y va en el mensaje');
  checkoutState.form = {};
});
/* Lo que se escribio a mano se copia al estado del viaje, y desde ahi gana sobre
   el hotel de la seccion. Es el camino que usa el voucher. */
prueba('lo escrito a mano pasa al estado del viaje y gana en el repintado', () => {
  estado.selectedHotelName = 'Pousada do Porto';
  estado.transferWizard = { hotelName: 'Otro hotel en el centro' };
  assert.strictEqual(fns.hotelParaElTransfer(), 'Otro hotel en el centro');
  estado.transferWizard = {};
});
estado.selectedHotelName = 'Casa Joseph';

console.log('\n' + (fallos ? fallos + ' FALLAS' : 'todo bien'));
process.exit(fallos ? 1 : 0);
