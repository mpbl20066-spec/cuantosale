/* Arnés de prueba para la lógica de "Cómo se salda".
   Extrae el bloque REAL del archivo (L526-580) y lo corre con stubs, para no
   probar una reimplementación: si el código cambia, la prueba cambia con él. */
const fs = require('fs');
const path = 'C:/Users/mpbl2/Desktop/CuantoSale/public/grupo.js';

const src = fs.readFileSync(path, 'utf8');
const lines = src.split(/\r?\n/);
const desde = lines.findIndex(l => /var meId = me \? me\.id : null;/.test(l));
const hasta = lines.findIndex(l => /saldosMarkup = mio \+ resto;/.test(l));
if (desde < 0 || hasta < 0) { console.log('FALLO: no encontre el bloque'); process.exit(1); }
// El "saldosMarkup = mio + resto" esta dentro del else: hay que seguir hasta
// la llave que cierra ese bloque, si no el codigo queda con corchetes abiertos.
let cierre = hasta + 1;
while (cierre < lines.length && !/^\s{4}\}$/.test(lines[cierre])) cierre++;
if (cierre >= lines.length) { console.log('FALLO: no encontre el cierre del else'); process.exit(1); }
const bruto = lines.slice(desde, cierre + 1);
const bloque = bruto.join('\n');
if ((bloque.match(/\{/g) || []).length !== (bloque.match(/\}/g) || []).length) {
  console.log('FALLO: llaves desbalanceadas en el bloque'); process.exit(1);
}
console.log(`bloque extraido: L${desde + 1}-L${cierre + 1} (${bruto.length} lineas)\n`);

// --- stubs -------------------------------------------------------------
const PAGOS = [];
const personas = {
  paola: 'Paola Batista', martin: 'Martin Sosa',
  bernardo: 'Bernardo Paessler', ana: 'Ana Ruiz',
};
function personById(id) { return { id, display_name: personas[id] }; }
function participantName(id) { return personById(id).display_name; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function icon() { return '[icono]'; }
function moneyVer(v) { return '$' + Number(v).toFixed(2); }
function saldoKey(m) { return m.from + '|' + m.to; }
function saldoEstaPagado(m) { return PAGOS.indexOf(saldoKey(m)) !== -1; }

function correr(me, moves, pagos) {
  PAGOS.length = 0; if (pagos) pagos.forEach(p => PAGOS.push(p));
  // eslint-disable-next-line no-new-func
  const fn = new Function('me', 'moves', 'currency',
    'saldoEstaPagado', 'saldoKey', 'participantName', 'esc', 'icon', 'moneyVer',
    bloque + '\n return saldosMarkup;');
  return fn(me, moves, 'USD', saldoEstaPagado, saldoKey, participantName, esc, icon, moneyVer);
}
const texto = h => h.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '').trim();

// --- fixtures ----------------------------------------------------------
// El caso del usuario: paola -> martin, y una tercera persona en juego.
const moves = [
  { from: 'paola', to: 'martin', amount: 150 },
  { from: 'bernardo', to: 'martin', amount: 90 },
  { from: 'paola', to: 'martin', amount: 25 },
];

const fallos = [];
function check(nombre, cond, detalle) {
  console.log((cond ? '  OK   ' : '  FALLA ') + nombre);
  if (!cond) { fallos.push(nombre + (detalle ? ' -> ' + detalle : '')); }
}

console.log('1) Paola mira: su transferencia arriba, con su boton');
{
  const h = correr({ id: 'paola' }, moves, []);
  const miBloque = h.slice(0, h.indexOf('<details'));
  const resto = h.slice(h.indexOf('<details'));
  check('arranca con el subhead de lo que tiene que pagar', /Lo que tenés que pagar/.test(miBloque));
  check('dice cuanto tiene que pagar (175 = 150+25)', /175\.00/.test(miBloque), texto(miBloque));
  check('tiene los 2 botones "Ya pague"', (miBloque.match(/Ya pagué/g) || []).length === 2);
  check('el boton esta en la fila de Paola, no en la de Bernardo',
    (miBloque.match(/data-saldo="paola\|martin"/g) || []).length === 2);
  check('NO hay boton en la fila de otro (Bernardo)',
    !/data-saldo="bernardo\|martin"/.test(resto), texto(resto));
  check('las de otros van plegadas en <details>', /^<details/.test(resto));
  check('el plegable aclara que no son pagos tuyos', /No son pagos tuyos/.test(resto));
  check('menciona la 1 transferencia de otro', /1 transferencia de otras personas/.test(resto));
}

console.log('\n2) Martin mira: paga a Ana y le deben a el. Los DOS lados.');
{
  // Martin es deudor (paga a Ana) y acreedor (Paola y Bernardo le pagan). Con
  // un if/else solo se le mostraba un lado de su situacion.
  const suyos = moves.concat([{ from: 'martin', to: 'ana', amount: 40 }]);
  const h = correr({ id: 'martin' }, suyos, []);
  const miBloque = h.slice(0, h.indexOf('<details'));
  const resto = h.slice(h.indexOf('<details'));
  check('aparece el bloque de lo que paga', /Lo que tenés que pagar/.test(miBloque), texto(miBloque));
  check('aparece el bloque de lo que le pagan', /Lo que te tienen que pagar/.test(miBloque));
  check('su pago es 40 y sale con boton',
    /40\.00/.test(miBloque) && /data-saldo="martin\|ana"/.test(miBloque));
  check('lo que le pagan NO lleva boton (el no paga eso)',
    (miBloque.match(/data-saldo=/g) || []).length === 1, texto(miBloque));
  check('las filas de cobro suman 265', /265\.00/.test(miBloque), texto(miBloque));
  check('no queda ninguna fila de Martin en el plegable', !/Martín|Martin Sosa<\/b><\/span><span class="grupo-settle__amount">\$40/.test(resto), texto(resto));
  check('el plegable queda vacio (todo lo demas es suyo)', !/<details/.test(h), texto(h));
}

console.log('\n2b) Martin solo acreedor: ve lo suyo, Paola queda de otras personas');
{
  const h = correr({ id: 'martin' }, moves, []);
  const miBloque = h.slice(0, h.indexOf('<details'));
  const resto = h.slice(h.indexOf('<details'));
  check('dice "Te tienen que pagar"', /Te tienen que pagar/.test(miBloque), texto(miBloque));
  check('su total es 265', /265\.00/.test(miBloque), texto(miBloque));
  check('sus filas NO tienen boton', !/data-saldo/.test(miBloque), texto(miBloque));
  check('no hay bloque de pago', !/Lo que tenés que pagar/.test(miBloque));
  check('todas las filas de Martin son suyas, no queda ninguna en "otras"', !/<details/.test(h), texto(h));
}

console.log('\n3) Bernardo mira: paga una sola vez');
{
  const h = correr({ id: 'bernardo' }, moves, []);
  const miBloque = h.slice(0, h.indexOf('<details'));
  check('dice que tiene que pagar 90', /90\.00/.test(miBloque), texto(miBloque));
  check('su unica fila tiene boton', (miBloque.match(/data-saldo=/g) || []).length === 1);
  check('las 2 de los otros van plegadas',
    /2 transferencias de otras personas/.test(h), texto(h));
}

console.log('\n4) Sin identidad: no se filtra, como antes (no se pierde nada)');
{
  const h = correr(null, moves, []);
  check('no hay plegable', !/<details/.test(h), texto(h));
  check('no hay "Tu transferencia"', !/Tu transferencia/.test(h));
  // Con barra a proposito: "grupo-settledon" arranca igual que "grupo-settle",
  // asi que sin la barra el conteo suma los botones y da 6 en vez de 3.
  check('las 3 filas salen', (h.match(/class="grupo-settle"/g) || []).length === 3, texto(h));
  check('las 3 con boton (comportamiento previo)', (h.match(/data-saldo=/g) || []).length === 3);
  check('ninguna se marca como propia sin identidad', !/is-mine/.test(h), texto(h));
}

console.log('\n5) Todo pagado por mi parte');
{
  const h = correr({ id: 'paola' }, moves, ['paola|martin']);
  check('sus filas quedan en is-paid', /is-paid/.test(h));
  check('el boton dice "Pagado"', /Pagado/.test(h));
  check('ya no afirma que tiene que pagar', !/Tenés que pagarle/.test(h), texto(h));
  // El monto va dentro de <b>, asi que el regex tiene que tolerar la etiqueta.
  check('dice que ya liquidaste los 175', /Ya liquidaste los <b>\$175\.00<\/b>/.test(h), texto(h));
  check('el boton sigue ahi para poder desmarcar', (h.match(/data-saldo=/g) || []).length === 2);
  check('la de Bernardo sigue sin boton', (h.match(/data-saldo=/g) || []).length !== 3);
}

console.log('\n6) Saldos vacios');
{
  const h = correr({ id: 'paola' }, [], []);
  check('dice que estan saldadas', /Las cuentas están saldadas/.test(h), texto(h));
  check('no inventa un plegable', !/<details/.test(h));
}

console.log('\n7) Solo hay transferencias de otros (yo no debo nada)');
{
  const otros = [{ from: 'bernardo', to: 'martin', amount: 90 }];
  const h = correr({ id: 'paola' }, otros, []);
  check('no hay bloque "Tu transferencia"', !/Tu transferencia/.test(h), texto(h));
  check('la de otro sigue visible, plegada', /1 transferencia de otras personas/.test(h));
}

console.log(fallos.length ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ') : '\nTODO OK');
process.exit(fallos.length ? 1 : 0);
