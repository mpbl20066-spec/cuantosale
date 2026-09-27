/* Pruebas de la conversion de monedas del grupo.
   Extrae el bloque REAL de grupo.js (por posicion, no por copia) y lo corre con
   tasas de mentira: si el codigo cambia, la prueba cambia con el.

   Lo que se mira aca no es la aritmetica (convertir multiplica por el cociente
   de las dos tasas, y eso se prueba solo), sino la decision de que hacer cuando
   FALTA una tasa. Antes de esto, esa decision no existia: se imprimia el
   importe crudo con el simbolo de la moneda de destino, asi que 100 dolares se
   leian como 100 pesos en un grupo en pesos, con un error de 40 veces y sin
   ningun aviso. */
const fs = require('fs');
const path = __dirname.replace(/\\/g, '/') + '/public/grupo.js';

const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const indice = (re) => lines.findIndex(l => re.test(l));
const desde = indice(/function categorySymbol\(code\)/);
const hasta = indice(/^  function groupIdFromPath/);
if (desde < 0 || hasta < 0) { console.log('FALLO: no encontre el bloque de monedas'); process.exit(1); }
const bloque = lines.slice(desde, hasta).join('\n');
if ((bloque.match(/\{/g) || []).length !== (bloque.match(/\}/g) || []).length) {
  console.log('FALLO: llaves desbalanceadas en el bloque'); process.exit(1);
}
console.log('bloque extraido: ' + bloque.split('\n').length + ' lineas\n');

// Tasas de mentira: 1 USD = 40 UYU = 5,5 BRL. Se escriben con coma para que
// cualquier error de division se note en el resultado.
const MONEDAS = [
  { code: 'UYU', etiqueta: 'Pesos uruguayos', simbolo: '$' },
  { code: 'USD', etiqueta: 'Dólares', simbolo: 'US$' },
  { code: 'BRL', etiqueta: 'Reales', simbolo: 'R$' }
];
const TASAS = { UYU: 40, BRL: 5.5 };

const MONEDA = new Function('FX', 'group', 'verEn', bloque
  + '\n return { convertir, tasaDe, moneyVer, aMonedaGrupo, money, formatAmount, verMoneda, categorySymbol };');

// rates:null es lo que devuelve /api/tasas cuando ninguna fuente responde
// (server.js devuelve { monedas, rates: null, error }), asi que es un caso real.
function armar(rates, groupCurrency, verEn) {
  return MONEDA({ rates: rates, base: 'USD', monedas: MONEDAS }, { currency: groupCurrency }, verEn);
}
// El numero que se lee en la pantalla, para comparar sin el simbolo.
const numero = (texto) => {
  const limpio = String(texto).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(limpio);
};
const simbolo = (texto) => String(texto).trim().split(/\s+/)[0];

const fallos = [];
function check(nombre, cond, detalle) {
  console.log((cond ? '  OK   ' : '  FALLA ') + nombre);
  if (!cond) { fallos.push(nombre + (detalle ? ' -> ' + detalle : '')); }
}
const cerca = (a, b) => Math.abs(a - b) < 0.02;

console.log('1) Con tasas, convierte bien');
{
  const m = armar(TASAS, 'USD', '');
  check('USD a USD no se mueve', m.moneyVer(100, 'USD') === 'US$ 100', m.moneyVer(100, 'USD'));
  check('100 BRL a USD (grupo) son 18,18', cerca(numero(m.moneyVer(100, 'BRL')), 18.18), m.moneyVer(100, 'BRL'));
  check('100 UYU a USD (grupo) son 2,50', cerca(numero(m.moneyVer(100, 'UYU')), 2.5), m.moneyVer(100, 'UYU'));

  const v = armar(TASAS, 'USD', 'UYU');
  check('con "Ver en UYU", 100 USD son 4.000', cerca(numero(v.moneyVer(100, 'USD')), 4000), v.moneyVer(100, 'USD'));
  check('y el simbolo es el de pesos, no el de dolares', simbolo(v.moneyVer(100, 'USD')) === '$', v.moneyVer(100, 'USD'));
  check('100 BRL en pesos son 727,27', cerca(numero(v.moneyVer(100, 'BRL')), 727.27), v.moneyVer(100, 'BRL'));

  const u = armar(TASAS, 'UYU', '');
  check('grupo en pesos, 100 USD son 4.000', cerca(numero(u.moneyVer(100, 'USD')), 4000), u.moneyVer(100, 'USD'));
  check('grupo en pesos, 100 BRL son 727,27', cerca(numero(u.moneyVer(100, 'BRL')), 727.27), u.moneyVer(100, 'BRL'));
}

console.log('\n2) La moneda base siempre vale 1, aun sin tasas');
{
  // Si /api/tasas cae, un grupo en USD con gastos en USD tiene que poder igual
  // mostrar sus montos: no hay nada que convertir, asi que no hay motivo para
  // devolver null y dejar toda la pagina sin numeros.
  const m = armar(null, 'USD', '');
  check('tasaDel USD es 1 sin rates', m.tasaDe('USD') === 1, String(m.tasaDe('USD')));
  check('el gasto se muestra tal cual', m.moneyVer(100, 'USD') === 'US$ 100', m.moneyVer(100, 'USD'));
  check('y entra en la cuenta del grupo', m.aMonedaGrupo(100, 'USD') === 100, String(m.aMonedaGrupo(100, 'USD')));
}

console.log('\n3) SIN tasa, el numero se muestra en SU moneda y no inventado');
{
  // Este es el bug. La respuesta NO es convertir: es no convertir, decirlo, y
  // mostrar el numero con el simbolo que le corresponde.
  const m = armar(null, 'UYU', '');
  const v = m.moneyVer(100, 'USD');
  check('100 USD en un grupo en pesos NO se muestra como "$ 100"',
    v !== '$ 100', 'quedo ' + v);
  check('se muestra como "US$ 100", que es lo que es', v === 'US$ 100', v);
  check('el numero no se cambia por laconversion que no se pudo hacer',
    numero(v) === 100, v);

  const b = armar(null, 'USD', '');
  const vb = b.moneyVer(100, 'BRL');
  check('100 BRL en un grupo en dolares NO se muestra como "US$ 100"',
    vb !== 'US$ 100', 'quedo ' + vb);
  check('se muestra como "R$ 100"', vb === 'R$ 100', vb);
}

console.log('\n4) SIN tasa, el gasto queda fuera de la cuenta en vez de mezclar');
{
  // Un gasto que no se puede traer a la moneda del grupo no se puede sumar con
  // los otros. Meterlo igual convierte el saldo en una suma de numeros de
  // monedas distintas, que es un numero que no quiere decir nada.
  const m = armar(null, 'UYU', '');
  check('aMonedaGrupo devuelve null, no el numero crudo', m.aMonedaGrupo(100, 'USD') === null,
    String(m.aMonedaGrupo(100, 'USD')));
  check('con tasa si convierte', armar(TASAS, 'UYU', '').aMonedaGrupo(100, 'USD') === 4000,
    String(armar(TASAS, 'UYU', '').aMonedaGrupo(100, 'USD')));
  // Un gasto sin moneda (los que se cargaron antes de que la columna exista)
  // se toma como de la del grupo: es lo unico que se puede asumir.
  check('sin currency se asume la del grupo', m.aMonedaGrupo(100, null) === 100, String(m.aMonedaGrupo(100, null)));
  check('y con rates caidos tambien', armar(null, 'USD', '').aMonedaGrupo(100, null) === 100,
    String(armar(null, 'USD', '').aMonedaGrupo(100, null)));
}

console.log('\n5) Moneda que el servidor no publica');
{
  // El server solo publica UYU, USD y BRL (MONEDAS en server.js). Si un gasto
  // llega en otra, no hay tasa: el mismo caso del punto 3, y por lo mismo no se
  // puede inventar el numero.
  const m = armar(TASAS, 'USD', '');
  check('tasaDe de una moneda no publicada es null', m.tasaDe('ARS') === null, String(m.tasaDe('ARS')));
  check('y el importe sale con su propio simbolo', m.moneyVer(100, 'ARS') === 'ARS$ 100', m.moneyVer(100, 'ARS'));
  check('no entra en la cuenta del grupo', m.aMonedaGrupo(100, 'ARS') === null, String(m.aMonedaGrupo(100, 'ARS')));
}

console.log('\n6) Formato de los numeros');
{
  const m = armar(TASAS, 'USD', '');
  check('miles con punto y decimales con coma', m.money(53007796987.72, 'USD') === 'US$ 53.007.796.987,72',
    m.money(53007796987.72, 'USD'));
  check('los redondos sin centavos', m.money(16048, 'USD') === 'US$ 16.048', m.money(16048, 'USD'));
  check('0,01 no se pierde', cerca(numero(m.money(0.005, 'USD')), 0.01), m.money(0.005, 'USD'));
}

console.log(fallos.length ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ') : '\nTODO OK');
process.exit(fallos.length ? 1 : 0);
