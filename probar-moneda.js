/*
 * Prueba la conversion de money() con las tasas reales de /api/tasas.
 *
 * No puedo renderizar la app desde aca, asi que extraigo las funciones
 * TAL CUAL estan en public/app.js y las corro en Node, que es el runtime real.
 * Si los numeros no dan, el error es de las funciones, no de la prueba.
 *
 * Uso:  node probar-moneda.js
 */
const fs = require('fs');
const http = require('http');

const src = fs.readFileSync('public/app.js', 'utf8');

// recorta una funcion del fuente por nombre, con su llave de cierre
function extraer(nombre) {
  const i = src.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('no encontre ' + nombre);
  let p = src.indexOf('{', i);
  let nivel = 0;
  for (let k = p; k < src.length; k++) {
    if (src[k] === '{') nivel++;
    else if (src[k] === '}') { nivel--; if (!nivel) return src.slice(i, k + 1); }
  }
  throw new Error('llave sin cerrar en ' + nombre);
}

const N = ['tasaDe', 'monedaActiva', 'formatoMiles', 'decimalesDe', 'money', 'moneySolo', 'moneyPrecise'];
const sandbox = 'const MONEDAS_APP = CFG.monedas, FX = CFG.fx, S = CFG.s;\n' +
  N.map(extraer).join('\n') +
  '\nreturn { money, moneySolo, moneyPrecise };';

function pedir(url) {
  return new Promise((ok, ko) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => ok(JSON.parse(d))); })
        .on('error', ko);
  });
}

(async function () {
  const t = await pedir('http://localhost:3000/api/tasas');
  const CFG = {
    monedas: t.monedas.map(m => ({ code: m.code, etiqueta: m.etiqueta, simbolo: m.simbolo })),
    fx: { rates: t.rates, base: t.base, until: 0, cargando: false },
    s: { currency: 'USD' }
  };
  const fn = new Function('CFG', sandbox)(CFG);

  console.log('  tasas :', Object.entries(t.rates).map(([k, v]) => `${k}=${v}`).join('  '));
  console.log('  base  :', t.base, '  fuente:', t.fuente);
  console.log();
  const fila = (a, b, c, d) => '  ' + a.padEnd(5) + ' | ' + b.padEnd(12) + ' | ' + c.padEnd(12) + ' | ' + d.padEnd(12);
  console.log(fila('moneda', 'de US$ 967', 'de US$ 1.353', 'de US$ 2.705'));
  console.log('  ' + '-'.repeat(52));

  const esperado = {
    USD: ['US$ 967', 'US$ 1.353', 'US$ 2.705'],
    BRL: ['R$ 5.013', 'R$ 7.014', 'R$ 14.024'],
    UYU: ['UYU$ 38.796', 'UYU$ 54.282', 'UYU$ 108.524']
  };
  let ok = true;
  for (const code of ['USD', 'BRL', 'UYU']) {
    CFG.s.currency = code;
    const vals = [967, 1353, 2705].map(v => fn.money(v));
    const exp = esperado[code];
    if (JSON.stringify(vals) !== JSON.stringify(exp)) ok = false;
    const marca = JSON.stringify(vals) === JSON.stringify(exp) ? '' : '   <-- revisar';
    console.log(fila(code, vals[0], vals[1], vals[2]) + marca);
  }

  console.log();
  console.log('  moneySolo (etiquetas de barras, sin simbolo):');
  for (const code of ['USD', 'BRL', 'UYU']) {
    CFG.s.currency = code;
    console.log(`    ${code.padEnd(4)} 2705 -> ${JSON.stringify(fn.moneySolo(2705))}`);
  }
  console.log();
  console.log('  moneyPrecise (tarifas fraccionarias):');
  for (const code of ['USD', 'BRL']) {
    CFG.s.currency = code;
    console.log(`    ${code.padEnd(4)} 0.35 -> ${JSON.stringify(fn.moneyPrecise(0.35))}`);
  }
  console.log();
  console.log('  borde: moneda sin tasa');
  CFG.fx.rates = { USD: 1 };
  CFG.s.currency = 'BRL';
  const borde = fn.money(967);
  console.log('    BRL sin tasa ->', JSON.stringify(borde), borde.startsWith('US$') ? '(cae a la base, no inventa)' : '<-- FALLA');
  console.log();
  console.log('  resultado:', ok ? 'los tres numeros coinciden' : 'ALGUN NUMERO NO COINCIDE');
})().catch(e => { console.error('  error:', e.message); process.exit(1); });
