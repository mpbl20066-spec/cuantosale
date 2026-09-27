/* Pruebas de "Cómo se salda".
   Extrae el bloque REAL del archivo (por posicion, no por copia) y lo corre con
   stubs: si el codigo cambia, la prueba cambia con el.

   Son dos bloques porque son dos capas distintas y tiene sentido poder romper
   cualquiera de las dos por separado:
     A) el modelo: computeBalances -> settlements -> saldoPendiente. Decide QUE
        queda pendiente. Si esto anda mal, ninguna de las aserciones de la vista
        dice nada.
     B) la vista: el markup. Decide COMO se lee lo que el modelo devolvio. */
const fs = require('fs');
// __dirname y no una ruta fija: con la ruta fija, corrido desde un worktree de
// git leeria el grupo.js del checkout principal y validaria otro codigo.
const path = __dirname.replace(/\\/g, '/') + '/public/grupo.js';

const src = fs.readFileSync(path, 'utf8');
const lines = src.split(/\r?\n/);
const indice = (re) => lines.findIndex(l => re.test(l));

// "cierraIf" es para los bloques que terminan en un if/else de 4 espacios: ahí
// hay que seguir hasta la llave que lo cierra o el codigo queda abierto. Los
// bloques que terminan en una declaración nueva no necesitan esa llave.
function extraer(desdeRe, hastaRe, etiqueta, cierraIf) {
  const desde = indice(desdeRe);
  const ultimo = indice(hastaRe);
  if (desde < 0 || ultimo < 0) { console.log('FALLO: no encontre ' + etiqueta); process.exit(1); }
  let fin = cierraIf ? ultimo + 1 : ultimo - 1;
  if (cierraIf) while (fin < lines.length && !/^\s{4}\}$/.test(lines[fin])) fin++;
  const bruto = lines.slice(desde, fin + 1);
  const bloque = bruto.join('\n');
  if ((bloque.match(/\{/g) || []).length !== (bloque.match(/\}/g) || []).length) {
    console.log('FALLO: llaves desbalanceadas en ' + etiqueta); process.exit(1);
  }
  return bloque;
}
const modelo = extraer(/function computeBalances\(\)/, /^  function dataSignature/, 'el modelo', false);
const vista = extraer(/var meId = me \? me\.id : null;/, /saldosMarkup = mio \+ resto/, 'la vista', true);
console.log('modelo: ' + modelo.split('\n').length + ' lineas, vista: ' + vista.split('\n').length + '\n');

// --- stubs -------------------------------------------------------------
const personas = {
  paola: 'Paola Batista', bruno: 'Bruno Lercari', pepe: 'Pepe', ana: 'Ana Ruiz',
  elquepaga: 'El que paga todo'
};
let group = null;
let expenses = [];
const participants = Object.keys(personas).map(id => ({ id, display_name: personas[id] }));
// El codigo real llama a la lista "participantes" (con n), no "participants".
const participantes = participants;
function participantName(id) { return personas[id] || 'Alguien'; }
function personById(id) { return participants.filter(p => p.id === id)[0]; }
function splitIdsOf(e) { return Array.isArray(e.split_between) ? e.split_between.filter(id => !!personById(id)) : []; }
function aMonedaGrupo(n, code) { return n == null ? null : Number(n); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function icon() { return '[icono]'; }
function moneyVer(v) { return '$' + Number(v).toFixed(2); }

const MODELO = new Function('participantes', 'expenses', 'group', 'personById', 'splitIdsOf', 'aMonedaGrupo',
  modelo + '\n return { balances: computeBalances(), pendientes: saldoPendiente(computeBalances()),' +
  ' moves: settlements(saldoPendiente(computeBalances())), pagadas: saldosSaldados(),' +
  ' marcar: marcarSaldo, migrar: migrarSaldosPlan };');
function correrModelo(saldos, gastos) {
  group = { currency: 'USD', saldos: saldos };
  expenses = gastos;
  return MODELO(participantes, expenses, group, personById, splitIdsOf, aMonedaGrupo);
}

const VISTA = new Function('me', 'moves', 'pagadas', 'expenses', 'currency', 'participantName', 'esc', 'icon',
  'moneyVer', 'saldoKey', vista + '\n return { saldosMarkup: saldosMarkup, alDia: alDiaMarkup };');
function correrVista(me, datos) {
  return VISTA(me, datos.moves, datos.pagadas, expenses, 'USD', participantName, esc, icon, moneyVer, (m) => m.from + '|' + m.to);
}
// El markup solo, que es lo que revisa casi todo. El cartel de "todos al dia"
// se pide aparte con alDiaDe(), porque es una pieza distinta de la pantalla.
const markup = (me, datos) => correrVista(me, datos).saldosMarkup;
const alDiaDe = (me, datos) => correrVista(me, datos).alDia;

const texto = h => h.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '').trim();
// Corta el markup desde uno de los subtitulos hasta el plegable. Necesario
// porque en el fixture Martin esta en los dos lados a la vez: sin esto, "no
// tiene boton" de su bloque de cobro daria falso por el boton de su pago.
function seccion(h, ...subtitulos) {
  let i = -1;
  for (const s of subtitulos) { const j = h.indexOf(s); if (j >= 0 && (i < 0 || j < i)) i = j; }
  if (i < 0) return '';
  const rest = h.slice(i);
  const corte = rest.indexOf('<details');
  return corte < 0 ? rest : rest.slice(0, corte);
}
const COBRO = h => seccion(h, 'Lo que te tienen que pagar');
const PAGO = h => seccion(h, 'Lo que tenés que pagar');
const PAGADOS = h => { const i = h.indexOf('ya saldada'); return i < 0 ? '' : h.slice(i); };
const titular = h => { const m = h.match(/<p class="grupo-mine">([\s\S]*?)<\/p>/); return (m || ['', ''])[1].replace(/<[^>]+>/g, ''); };

// --- helpers de fixture -----------------------------------------------
const TODOS = ['paola', 'bruno', 'pepe', 'ana'];
// Un gasto: quien lo pago, cuanto y entre quienes se divide.
const gasto = (from, amount, split) => ({ paid_by_participante_id: from, amount, currency: 'USD', split_between: split });
// Un gasto lo pago uno para todos: el que paga queda debiendo a los otros.
const unoPaga = (from, amount, cuantos) => gasto(from, amount, TODOS.slice(0, cuantos));
const suma = (obj) => Object.values(obj).reduce((s, v) => s + v, 0);

const fallos = [];
function check(nombre, cond, detalle) {
  console.log((cond ? '  OK   ' : '  FALLA ') + nombre);
  if (!cond) fallos.push(nombre + (detalle ? ' -> ' + detalle : ''));
}

console.log('1) El modelo reparte lo pendiente y no lo pagado');
{
  // Paula pago 1000 entre 4: cada uno debe 250.
  const d = correrModelo({}, [unoPaga('paola', 1000, 4)]);
  check('los saldos brutos: paola +750, los otros -250',
    d.balances.paola === 750 && d.balances.bruno === -250 && d.balances.pepe === -250, JSON.stringify(d.balances));
  check('sin pagos, lo pendiente es lo bruto',
    d.pendientes.paola === 750 && d.pendientes.ana === -250);
  check('3 transferencias de 250 contra paola',
    d.moves.length === 3 && d.moves.every(m => m.amount === 250), JSON.stringify(d.moves));
  check('no hay nada saldado todavia', d.pagadas.length === 0);
}

console.log('\n2) BUG: un gasto nuevo NO se marca como pagado por lo que ya se pago');
{
  // Este es el caso que se reporto: Bruno marca su pago y despues se carga un
  // gasto mas. Antes la marca era solo el par ("bruno|paola"), asi que el
  // monto nuevo salia con el tilde de "Pagado" y el dinero nuevo desaparecia.
  // El gasto nuevo lo paga PAOLA a proposito: si lo pagara bruno, el reparto lo
  // convertiria en acreedor y el caso seria otro.
  const ANTES = [unoPaga('paola', 1000, 4)];
  const brunoAntes = correrModelo({}, ANTES).moves.filter(m => m.from === 'bruno')[0];
  check('antes: bruno debe 250 a paola', brunoAntes && brunoAntes.amount === 250, JSON.stringify(brunoAntes));

  const pagado = correrModelo({}, ANTES).marcar(brunoAntes, 'pagar');
  check('la marca guarda el monto, no solo el par',
    pagado['bruno|paola'] === 250 && Object.keys(pagado).length === 1, JSON.stringify(pagado));

  // Se carga un gasto nuevo de 200, pagado por paola, dividido entre los 4.
  // A bruno le tocaba una parte mas: debe 50, y eso es deuda nueva.
  const DESPUES = ANTES.concat([unoPaga('paola', 200, 4)]);
  const d2 = correrModelo(pagado, DESPUES);
  const brunoDespues = d2.moves.filter(m => m.from === 'bruno')[0];
  check('el gasto nuevo le deja a bruno una deuda pendiente REAL', !!brunoDespues,
    'bruno quedo con saldo pendiente ' + d2.pendientes.bruno);
  check('esa deuda sale en el plan de pagos, no en el historial de saldadas',
    !!brunoDespues && d2.moves.every(m => !m.pagada), JSON.stringify(d2.moves));
  check('lo que bruno debe ahora es 50, no 250',
    brunoDespues && Math.abs(brunoDespues.amount - 50) < 0.01, JSON.stringify(brunoDespues));
  check('el pago viejo sigue en el historial, por 250',
    d2.pagadas.length === 1 && d2.pagadas[0].amount === 250, JSON.stringify(d2.pagadas));
  check('los otros deben ver su parte nueva (300 y no 250)',
    d2.moves.filter(m => m.to === 'paola' && m.from !== 'bruno').length === 2
    && d2.moves.filter(m => m.to === 'paola' && m.from !== 'bruno').every(m => Math.abs(m.amount - 300) < 0.01),
    JSON.stringify(d2.moves));
  check('los saldos pendientes siguen cerrando en cero', Math.abs(suma(d2.pendientes)) < 0.01, String(suma(d2.pendientes)));
}

console.log('\n3) La deuda que queda se descuenta del resumen de cada uno');
{
  const ANTES = [unoPaga('paola', 1000, 4)];
  const brunoAntes = correrModelo({}, ANTES).moves.filter(m => m.from === 'bruno')[0];
  const pagado = correrModelo({}, ANTES).marcar(brunoAntes, 'pagar');
  const d = correrModelo(pagado, ANTES);
  check('bruno queda al dia en el saldo pendiente', Math.abs(d.pendientes.bruno) < 0.01, String(d.pendientes.bruno));
  check('bruno ya no aparece como deudor en el plan', !d.moves.some(m => m.from === 'bruno'), JSON.stringify(d.moves));
  check('los otros dos siguen debiendo 250', d.moves.filter(m => m.to === 'paola').length === 2, JSON.stringify(d.moves));
  // El invariante que hace que el resumen cierre: lo pendiente suma cero.
  check('los saldos pendientes siguen cerrando en cero', Math.abs(suma(d.pendientes)) < 0.01, String(suma(d.pendientes)));
}

console.log('\n4) Si se borra el gasto, el pago viejo no inventa plata');
{
  // El clamp del modelo: si Bruno ya no debe nada (borraron el gasto), lo
  // pagado se ignora. Sin esto, paola aparecia con un saldo positivo fantasma
  // y el total no cerraba.
  const ANTES = [unoPaga('paola', 1000, 4)];
  const brunoAntes = correrModelo({}, ANTES).moves.filter(m => m.from === 'bruno')[0];
  const pagado = correrModelo({}, ANTES).marcar(brunoAntes, 'pagar');
  const d = correrModelo(pagado, []);   // se borraron todos los gastos
  check('sin gastos no queda saldo positivo de nadie',
    Object.values(d.pendientes).every(v => Math.abs(v) < 0.01), JSON.stringify(d.pendientes));
  check('y sigue cerrando en cero', Math.abs(suma(d.pendientes)) < 0.01, String(suma(d.pendientes)));
  check('no hay transferencias que mostrar', d.moves.length === 0);
}

console.log('\n5) Desmarcar saca el monto y devuelve la deuda');
{
  const ANTES = [unoPaga('paola', 1000, 4)];
  const brunoAntes = correrModelo({}, ANTES).moves.filter(m => m.from === 'bruno')[0];
  const pagado = correrModelo({}, ANTES).marcar(brunoAntes, 'pagar');
  check('marcado queda guardado por 250', pagado['bruno|paola'] === 250, JSON.stringify(pagado));
  const vuelto = correrModelo(pagado, ANTES).marcar(brunoAntes, 'deshacer');
  check('despues de desmarcar no queda nada guardado', Object.keys(vuelto).length === 0, JSON.stringify(vuelto));
  const d = correrModelo(vuelto, ANTES);
  check('bruno vuelve a deber 250', Math.abs(d.pendientes.bruno + 250) < 0.01, String(d.pendientes.bruno));
}

console.log('\n5b) Marcar dos veces el mismo par acumula, no pisa');
{
  // Dos pagos parciales de a 100: el guardado tiene que ser 200. Con la versión
  // de "pisar" el segundo toque dejaba al deudor debiendo 100 de más.
  const m = { from: 'bruno', to: 'paola', amount: 100 };
  const uno = correrModelo({}, []).marcar(m, 'pagar');
  const dos = correrModelo(uno, []).marcar(m, 'pagar');
  check('el segundo pago se suma al primero', uno['bruno|paola'] === 100 && dos['bruno|paola'] === 200,
    JSON.stringify({ uno, dos }));
  check('y al deshacer una vez queda el otro', correrModelo(dos, []).marcar(m, 'deshacer')['bruno|paola'] === 100,
    JSON.stringify(correrModelo(dos, []).marcar(m, 'deshacer')));
}

console.log('\n6) Un pago parcial deja el resto pendiente');
{
  // Bruno paga la mitad de lo que debe. El plan tiene que seguir mostrando la
  // otra mitad, no darlo por saldado.
  const ANTES = [unoPaga('paola', 1000, 4)];
  const mitad = { from: 'bruno', to: 'paola', amount: 125 };
  const pagado = correrModelo({}, ANTES).marcar(mitad, 'pagar');
  const d = correrModelo(pagado, ANTES);
  check('guarda solo lo pagado', pagado['bruno|paola'] === 125, JSON.stringify(pagado));
  check('a bruno le queda 125 de deuda', Math.abs(d.pendientes.bruno + 125) < 0.01, String(d.pendientes.bruno));
  const sigue = d.moves.filter(m => m.from === 'bruno')[0];
  check('y sigue apareciendo en el plan de pagos', sigue && Math.abs(sigue.amount - 125) < 0.01, JSON.stringify(sigue));
  check('la fila saldada y la pendiente no se pisan', d.pagadas[0].amount === 125 && sigue.amount === 125);
  // El caso que obliga a que la accion sea explicita: misma pareja, mismo
  // monto, dos botones distintos. "Ya pagué" tiene que SUMAR 125 a los 125 que
  // ya estan guardados (quedan 250), no borrarlos.
  check('"Ya pagué" sobre lo pendiente suma, no borra lo ya pagado',
    correrModelo(pagado, ANTES).marcar(sigue, 'pagar')['bruno|paola'] === 250,
    JSON.stringify(correrModelo(pagado, ANTES).marcar(sigue, 'pagar')));
  check('"Deshacer" sobre lo ya pagado saca justo ese monto',
    correrModelo(pagado, ANTES).marcar(d.pagadas[0], 'deshacer')['bruno|paola'] === undefined,
    JSON.stringify(correrModelo(pagado, ANTES).marcar(d.pagadas[0], 'deshacer')));
}

console.log('\n7) Migracion del formato viejo (["quien|quien"], sin monto)');
{
  const ANTES = [unoPaga('paola', 1000, 4)];
  const viejo = ['bruno|paola'];
  const d = correrModelo(viejo, ANTES);
  check('el formato viejo se lee sin romper nada', d.pagadas.length === 0, JSON.stringify(d.pagadas));
  check('y la deuda sigue pendiente hasta que se migra', d.moves.some(m => m.from === 'bruno'));
  const migrado = correrModelo(viejo, ANTES).migrar();
  check('la migracion completa el par con el importe de la transferencia',
    migrado['bruno|paola'] === 250, JSON.stringify(migrado));
  const d2 = correrModelo(migrado, ANTES);
  check('ya migrado, bruno queda al dia y la fila va a "ya saldadas"',
    Math.abs(d2.pendientes.bruno) < 0.01 && d2.pagadas.length === 1 && d2.pagadas[0].amount === 250,
    JSON.stringify({ p: d2.pendientes, s: d2.pagadas }));
  check('las marcas ya migradas no se vuelven a migrar', correrModelo(migrado, ANTES).migrar() === null);
  check('con el plan vacio la migracion no borra nada (no migra a ciegas)',
    correrModelo(['bruno|paola'], []).migrar() === null);
}

// Las pruebas de la vista entran con el plan YA calculado, no con gastos. La
// razon es que aca lo que se prueba es como se lee lo que el modelo devolvio:
// si el plan tambien viene del greedy, un cambio en el reparto rompe estas
// aserciones por numeros feos y no por un problema de la vista. El modelo se
// prueba aparte, de punta a punta, en los bloques 1 a 7.
const datos = (moves, pagadas) => ({ moves, pagadas });

console.log('\n8) Vista: Paola mira, su pago arriba y el resto plegado');
{
  const h = markup({ id: 'paola' }, datos(
    [{ from: 'paola', to: 'martin', amount: 175 }, { from: 'bruno', to: 'martin', amount: 90 }], []));
  const mio = PAGO(h), resto = h.slice(h.indexOf('<details'));
  check('abre con "Lo que tenés que pagar"', /Lo que tenés que pagar/.test(mio));
  check('dice cuanto tiene que pagar: 175', /175\.00/.test(titular(mio)), titular(mio));
  check('su fila tiene el boton "Ya pagué"', (mio.match(/Ya pagué/g) || []).length === 1, texto(mio));
  check('el boton lleva el monto, que es lo que se guarda', /data-saldo="paola\|martin" data-saldo-monto="175"/.test(mio), texto(mio));
  check('y dice que la accion es sumar', /data-saldo-accion="pagar"/.test(mio), texto(mio));
  check('lo de otros va en <details>', /^<details/.test(resto), texto(resto));
  check('el plegable aclara que no son pagos tuyos', /No son pagos tuyos/.test(resto), texto(resto));
  check('menciona la 1 transferencia de otro', /1 transferencia de otras personas/.test(resto), texto(resto));
  check('no tiene bloque de cobro (nadie le debe)', !/Lo que te tienen que pagar/.test(h), texto(h));
  check('no hay bloque de ya saldadas todavia', !/ya saldada/.test(h), texto(h));
}

console.log('\n9) Vista: Martin esta en los dos lados a la vez');
{
  const h = markup({ id: 'martin' }, datos([
    { from: 'paola', to: 'martin', amount: 175 },
    { from: 'bruno', to: 'martin', amount: 90 },
    { from: 'martin', to: 'ana', amount: 40 }
  ], []));
  const pago = PAGO(h), cobro = COBRO(h);
  check('aparece "Lo que tenés que pagar"', /Lo que tenés que pagar/.test(pago), texto(h));
  check('aparece "Lo que te tienen que pagar"', /Lo que te tienen que pagar/.test(cobro), texto(h));
  check('su pago a Ana es 40, con boton',
    /40\.00/.test(titular(pago)) && /data-saldo="martin\|ana"/.test(pago), titular(pago));
  check('lo que le pagan suma 265 (175+90)', /265\.00/.test(titular(cobro)), titular(cobro));
  check('su bloque de cobro NO lleva boton (no lo paga el)', !/data-saldo/.test(cobro), texto(cobro));
  check('su bloque de pago lleva 1 boton', (pago.match(/data-saldo=/g) || []).length === 1);
  check('no le queda ninguna fila en el plegable', !/<details/.test(h), texto(h));
}

console.log('\n10) Vista: lo ya pagado va aparte, tachado, y se puede deshacer');
{
  const h = markup({ id: 'paola' }, datos(
    [{ from: 'pepe', to: 'paola', amount: 250 }, { from: 'ana', to: 'paola', amount: 250 }],
    [{ from: 'bruno', to: 'paola', amount: 250 }]));
  const pagados = PAGADOS(h);
  check('la fila de bruno sale en "ya saldadas"', /bruno/i.test(pagados) && /ya saldada/.test(h), texto(h));
  check('sale tachada con is-paid', /is-paid/.test(pagados), texto(pagados));
  check('con el monto de lo que se pago', /250\.00/.test(pagados), texto(pagados));
  check('tiene boton para deshacer', /Deshacer/.test(pagados), texto(pagados));
  check('el titular ya NO dice que le deben lo de bruno: son 500 y no 750',
    /500\.00/.test(titular(COBRO(h))) && !/750\.00/.test(titular(COBRO(h))), titular(COBRO(h)));
  check('no se contradice: "te tienen que pagar" sin ninguna fila Pagada al lado',
    !(/Te tienen que pagar/.test(h) && /is-paid/.test(COBRO(h))), texto(h));
  check('el boton de deshacer lleva el monto que se saco y la accion de restar',
    /data-saldo="bruno\|paola" data-saldo-monto="250" data-saldo-accion="deshacer"/.test(pagados), texto(pagados));
  check('el bloque de ya saldadas va despues del de los pendientes, no mezclado',
    h.indexOf('ya saldada') > h.indexOf('Lo que te tienen que pagar'), texto(h));
}

console.log('\n11) Vista: sin identidad no se filtra, como antes');
{
  const h = markup(null, datos([
    { from: 'paola', to: 'martin', amount: 175 },
    { from: 'bruno', to: 'martin', amount: 90 },
    { from: 'martin', to: 'ana', amount: 40 }
  ], []));
  check('no hay plegable', !/<details/.test(h), texto(h));
  check('no hay subhead "tu transferencia"', !/Lo que tenés que pagar|Lo que te tienen que pagar/.test(h), texto(h));
  check('las 3 filas salen', (h.match(/class="grupo-settle[ "]/g) || []).length === 3, texto(h));
  check('las 3 con boton (comportamiento previo)', (h.match(/data-saldo=/g) || []).length === 3);
  check('ninguna se marca como propia sin identidad', !/is-mine/.test(h), texto(h));
}

console.log('\n12) Vista: saldos vacios y solo los de otros');
{
  const vacio = datos([], []);
  check('no inventa un titular', !/grupo-mine/.test(markup({ id: 'paola' }, vacio)), texto(markup({ id: 'paola' }, vacio)));
  check('dice que no hay nada que saldar', /Todavía no hay nada que saldar/.test(markup({ id: 'paola' }, vacio)),
    texto(markup({ id: 'paola' }, vacio)));

  // Ana no debe ni le deben: lo único que hay es una transferencia de otros.
  // Sin gastos cargados tampoco se tira el cartel de "todos al dia", porque
  // no hay cuentas que saldar todavia.
  const h2 = markup({ id: 'ana' }, datos([{ from: 'bruno', to: 'paola', amount: 300 }], []));
  check('si no debo ni me deben, no hay bloque propio', !/Lo que tenés que pagar|Lo que te tienen que pagar/.test(h2), texto(h2));
  check('la de otro sigue visible, plegada', /1 transferencia de otras personas/.test(h2), texto(h2));
  check('sin boton en la de otro', !/data-saldo/.test(h2), texto(h2));
}

console.log('\n13) Vista: cuando todos pagaron, lo dice');
{
  const gastos = [unoPaga('paola', 1000, 4)];
  // Se van marcando de a uno sobre el estado anterior, que es como pasa en la
  // vida real: cada persona marca la suya desde su dispositivo.
  let guardado = {};
  for (let i = 0; i < 4; i++) {
    const dd = correrModelo(guardado, gastos);
    const m = dd.moves[0];
    if (!m) break;
    guardado = dd.marcar(m, 'pagar');
  }
  const d = correrModelo(guardado, gastos);
  const final = markup({ id: 'paola' }, d);
  check('no quedan transferencias pendientes', d.moves.length === 0, JSON.stringify(d.moves));
  check('dice que estan todos al dia', /Están todos al día/.test(alDiaDe({ id: 'paola' }, d)), alDiaDe({ id: 'paola' }, d));
  check('y lista las que se pagaron', /ya saldada/.test(final), texto(final));
  check('las 3 pagadas aparecen tachadas', (final.match(/is-paid/g) || []).length === 3, texto(final));
  check('no inventa un titular de deuda', !/grupo-mine/.test(final), texto(final));
}

console.log('\n13) Vista: cuando todos pagaron, lo dice');
{
  const gastos = [unoPaga('paola', 1000, 4)];
  // Se van marcando de a uno sobre el estado anterior, que es como pasa en la
  // vida real: cada persona marca la suya desde su dispositivo.
  let guardado = {};
  for (let i = 0; i < 4; i++) {
    const dd = correrModelo(guardado, gastos);
    const m = dd.moves[0];
    if (!m) break;
    guardado = dd.marcar(m, 'pagar');
  }
  const d = correrModelo(guardado, gastos);
  const final = markup({ id: 'paola' }, d);
  check('no quedan transferencias pendientes', d.moves.length === 0, JSON.stringify(d.moves));
  check('dice que estan todos al dia', /Están todos al día/.test(alDiaDe({ id: 'paola' }, d)), alDiaDe({ id: 'paola' }, d));
  check('y lista las que se pagaron', /ya saldada/.test(final), texto(final));
  check('las 3 pagadas aparecen tachadas', (final.match(/is-paid/g) || []).length === 3, texto(final));
  check('no inventa un titular de deuda', !/grupo-mine/.test(final), texto(final));
}

console.log(fallos.length ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ') : '\nTODO OK');
process.exit(fallos.length ? 1 : 0);
