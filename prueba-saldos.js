/* Pruebas de "Cómo se salda".
   Extrae el bloque REAL del archivo (por posicion, no por copia) y lo corre con
   stubs: si el codigo cambia, la prueba cambia con el. */
const fs = require('fs');
const path = 'C:/Users/mpbl2/Desktop/CuantoSale/public/grupo.js';

const src = fs.readFileSync(path, 'utf8');
const lines = src.split(/\r?\n/);
const desde = lines.findIndex(l => /var meId = me \? me\.id : null;/.test(l));
const ultimo = lines.findIndex(l => /saldosMarkup = mio \+ resto;/.test(l));
if (desde < 0 || ultimo < 0) { console.log('FALLO: no encontre el bloque'); process.exit(1); }
// El "saldosMarkup = mio + resto" esta dentro del else: hay que seguir hasta
// la llave que cierra ese bloque, si no el codigo queda con corchetes abiertos.
let cierre = ultimo + 1;
while (cierre < lines.length && !/^\s{4}\}$/.test(lines[cierre])) cierre++;
const bruto = lines.slice(desde, cierre + 1);
const bloque = bruto.join('\n');
if ((bloque.match(/\{/g) || []).length !== (bloque.match(/\}/g) || []).length) {
  console.log('FALLO: llaves desbalanceadas en el bloque'); process.exit(1);
}
console.log(`bloque extraido: L${desde + 1}-L${cierre + 1} (${bruto.length} lineas)\n`);

// --- stubs -------------------------------------------------------------
const PAGOS = [];
const personas = { paola: 'Paola Batista', martin: 'Martin Sosa', bernardo: 'Bernardo Paessler', ana: 'Ana Ruiz' };
function participantName(id) { return personas[id]; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function icon() { return '[icono]'; }
function moneyVer(v) { return '$' + Number(v).toFixed(2); }
function saldoKey(m) { return m.from + '|' + m.to; }
function saldoEstaPagado(m) { return PAGOS.indexOf(saldoKey(m)) !== -1; }

function correr(me, moves, pagos) {
  PAGOS.length = 0; if (pagos) pagos.forEach(p => PAGOS.push(p));
  const fn = new Function('me', 'moves', 'currency',
    'saldoEstaPagado', 'saldoKey', 'participantName', 'esc', 'icon', 'moneyVer',
    bloque + '\n return saldosMarkup;');
  return fn(me, moves, 'USD', saldoEstaPagado, saldoKey, participantName, esc, icon, moneyVer);
}
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
const COBRO = h => seccion(h, 'Lo que te tienen que pagar', 'Lo que ya te pagaron');
const PAGO = h => seccion(h, 'Lo que tenés que pagar', 'Lo que ya liquidaste');
const titular = h => { const m = h.match(/<p class="grupo-mine">([\s\S]*?)<\/p>/); return (m || ['', ''])[1].replace(/<[^>]+>/g, ''); };

// --- fixtures ----------------------------------------------------------
// Un movimiento por par (deudor, acreedor), que es lo que produce el greedy de
// settlements(): al liquidar un par avanza los dos indices y no lo vuelve a
// usar. Armar dos filas para el mismo par repetiria la clave "paola|martin", y
// como el marcado de pago es por par, marcaria las dos de un golpe: un estado
// que la app nunca genera, y que hacia fallar la prueba por motivos que no
// existen en produccion.
const TODOS = [
  { from: 'paola', to: 'martin', amount: 175 },
  { from: 'bernardo', to: 'martin', amount: 90 },
  { from: 'martin', to: 'ana', amount: 40 },
];
const SOLO_PAOLA = [
  { from: 'paola', to: 'martin', amount: 175 },
  { from: 'bernardo', to: 'martin', amount: 90 },
];

const fallos = [];
function check(nombre, cond, detalle) {
  console.log((cond ? '  OK   ' : '  FALLA ') + nombre);
  if (!cond) { fallos.push(nombre + (detalle ? ' -> ' + detalle : '')); }
}

console.log('1) Paola mira: su pago arriba, con su boton, el resto plegado');
{
  const h = correr({ id: 'paola' }, TODOS, []);
  const mio = PAGO(h), resto = h.slice(h.indexOf('<details'));
  check('abre con "Lo que tenés que pagar"', /Lo que tenés que pagar/.test(mio));
  check('dice cuanto tiene que pagar: 175', /175\.00/.test(titular(mio)), titular(mio));
  check('su fila tiene el boton "Ya pagué"', (mio.match(/data-saldo="paola\|martin"/g) || []).length === 1);
  check('el boton NO esta en la fila de otro', !/data-saldo="bernardo\|martin"/.test(resto), texto(resto));
  check('lo de otros va en <details>', /^<details/.test(resto));
  check('el plegable aclara que no son pagos tuyos', /No son pagos tuyos/.test(resto));
  check('menciona las 2 transferencias de otros', /2 transferencias de otras personas/.test(resto));
  check('no tiene bloque de cobro (nadie le debe)', !/Lo que te tienen que pagar/.test(h), texto(h));
}

console.log('\n2) Martin: esta en los dos lados a la vez, ve los dos');
{
  const h = correr({ id: 'martin' }, TODOS, []);
  const pago = PAGO(h), cobro = COBRO(h);
  check('aparece "Lo que tenés que pagar"', /Lo que tenés que pagar/.test(pago), texto(h));
  check('aparece "Lo que te tienen que pagar"', /Lo que te tienen que pagar/.test(cobro), texto(h));
  check('su pago a Ana es 40, con boton',
    /40\.00/.test(titular(pago)) && /data-saldo="martin\|ana"/.test(pago), titular(pago));
  check('lo que le pagan suma 265 (175+90)', /265\.00/.test(titular(cobro)), titular(cobro));
  check('su bloque de cobro NO lleva boton (no lo paga el)',
    !/data-saldo/.test(cobro), texto(cobro));
  check('su bloque de pago lleva 1 boton', (pago.match(/data-saldo=/g) || []).length === 1);
  check('no le queda ninguna fila en el plegable', !/<details/.test(h), texto(h));
}

console.log('\n3) Bernardo: debe una sola vez, ve solo lo suyo');
{
  const h = correr({ id: 'bernardo' }, TODOS, []);
  const mio = PAGO(h);
  check('dice que tiene que pagar 90', /90\.00/.test(titular(mio)), texto(h));
  check('su unica fila tiene boton', (mio.match(/data-saldo=/g) || []).length === 1);
  check('no tiene bloque de cobro', !/Lo que te tienen que pagar/.test(h), texto(h));
  check('las 2 de los otros van plegadas', /2 transferencias de otras personas/.test(h), texto(h));
}

console.log('\n4) Sin identidad: no se filtra, como antes (no se pierde nada)');
{
  const h = correr(null, TODOS, []);
  // Con barra a proposito: "grupo-settledon" arranca igual que "grupo-settle",
  // asi que sin la barra el conteo suma los botones y da el doble. Y con
  // clase en vez de comilla, porque la fila puede llevar "is-paid is-mine".
  check('no hay plegable', !/<details/.test(h), texto(h));
  check('no hay subhead "tu transferencia"', !/Lo que tenés que pagar|Lo que te tienen que pagar/.test(h), texto(h));
  check('las 3 filas salen', (h.match(/class="grupo-settle[ "]/g) || []).length === 3, texto(h));
  check('las 3 con boton (comportamiento previo)', (h.match(/data-saldo=/g) || []).length === 3);
  check('ninguna se marca como propia sin identidad', !/is-mine/.test(h), texto(h));
}

console.log('\n5) Del lado del pago, ya saldado');
{
  const h = correr({ id: 'paola' }, TODOS, ['paola|martin']);
  const mio = PAGO(h);
  check('la fila queda en is-paid', /is-paid/.test(mio));
  check('el boton dice "Pagado"', /Pagado/.test(mio));
  check('ya no afirma que tiene que pagar', !/Tenés que pagarle/.test(mio), texto(mio));
  check('dice que ya liquidaste los 175', /Ya liquidaste los \$175\.00/.test(titular(mio)), titular(mio));
  check('el subtitulo pasa a "Lo que ya liquidaste"', /Lo que ya liquidaste/.test(mio), texto(mio));
  check('el boton sigue ahi para poder desmarcar', (mio.match(/data-saldo=/g) || []).length === 1);
}

console.log('\n6) Del lado del cobro, ya saldado (el caso de tu captura)');
{
  // Paola y Bernardo marcaron "Ya pagué" cada uno en su dispositivo. Martin
  // abría y veía:
  //   LO QUE TE TIENEN QUE PAGAR
  //   Te tienen que pagar $265.00
  //   paola -> martin     $175.00   [Pagado, verde]
  //   bernardo -> martin   $90.00   [Pagado, verde]
  //   [Están todos al día. No queda nada por pagar.]
  // O sea: le decía que le debían, con las dos filas en verde justo arriba.
  const h = correr({ id: 'martin' }, SOLO_PAOLA, ['paola|martin', 'bernardo|martin']);
  const cobro = COBRO(h);
  check('NO dice "Te tienen que pagar"', !/Te tienen que pagar/.test(h), texto(h));
  check('el subtitulo ya no dice "Lo que te tienen que pagar"', !/Lo que te tienen que pagar/.test(h), texto(h));
  check('el subtitulo pasa a "Lo que ya te pagaron"', /Lo que ya te pagaron/.test(cobro), texto(cobro));
  check('dice que ya le pagaron los 265', /Ya te pagaron los \$265\.00/.test(titular(cobro)), titular(cobro));
  check('las 2 filas siguen en verde is-paid', (cobro.match(/is-paid/g) || []).length === 2, texto(cobro));
  check('su bloque de cobro sigue sin boton (no lo pago yo)', !/data-saldo/.test(cobro), texto(cobro));
  check('no quedan las dos cosas contradictorias a la vez',
    !(/Te tienen que pagar/.test(h) && /is-paid/.test(h)));
}

console.log('\n7) Pago parcial: el titular dice lo que FALTA, no la suma');
{
  // Solo Paola marco la suya. A Martin le falta la de Bernardo.
  const h = correr({ id: 'martin' }, SOLO_PAOLA, ['paola|martin']);
  const cobro = COBRO(h);
  check('el titular pendiente es 90, no la suma 265',
    /90\.00/.test(titular(cobro)) && !/265\.00/.test(titular(cobro)), titular(cobro));
  check('no cuenta como pendientes las ya pagadas', !/en 2/.test(titular(cobro)), titular(cobro));
  check('el subtitulo sigue siendo "Lo que te tienen que pagar"', /Lo que te tienen que pagar/.test(cobro), texto(cobro));
  check('la fila pagada sigue en verde', (cobro.match(/is-paid/g) || []).length === 1, texto(cobro));
}

console.log('\n8) Saldos vacios');
{
  const h = correr({ id: 'paola' }, [], []);
  check('dice que estan saldadas', /Las cuentas están saldadas/.test(h), texto(h));
  check('no inventa un plegable', !/<details/.test(h));
  check('no inventa un titular', !/grupo-mine/.test(h), texto(h));
}

console.log('\n9) Solo hay transferencias de otros (yo no debo ni me deben)');
{
  const otros = [{ from: 'bernardo', to: 'martin', amount: 90 }];
  const h = correr({ id: 'paola' }, otros, []);
  check('no hay bloque de pago', !/Lo que tenés que pagar/.test(h), texto(h));
  check('no hay bloque de cobro', !/Lo que te tienen que pagar/.test(h), texto(h));
  check('la de otro sigue visible, plegada', /1 transferencia de otras personas/.test(h), texto(h));
  check('sin boton en la de otro', !/data-saldo/.test(h), texto(h));
}

console.log('\n10) El marcado es por par, no por importe');
{
  // Documenta una decision que ya venia del diseño: si las dos personas tienen
  // varias transferencias entre si, el greedy igual genera una sola por par, y
  // marcar "Ya pagué" las saldaria a todas juntas. No se cambia acá (es el
  // modelo de datos, no la vista), pero queda dicho y verificado.
  const h = correr({ id: 'paola' }, [{ from: 'paola', to: 'martin', amount: 175 }], ['paola|martin']);
  check('una sola fila para el unico par', (h.match(/class="grupo-settle[ "]/g) || []).length === 1, texto(h));
  check('marcada, el titular pasa a "ya liquidaste"', /Ya liquidaste/.test(h), texto(h));
}

console.log(fallos.length ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ') : '\nTODO OK');
process.exit(fallos.length ? 1 : 0);
