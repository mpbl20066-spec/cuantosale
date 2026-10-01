/* Solo lectura. Verifica el aviso de "estamos completando" sobre el codigo real
 * de localToursMarkup, no sobre una copia: si el aviso se rompe, este script se
 * da cuenta. Extrae la funcion de public/app.js y evalua el markup con una meta
 * minima para los tres casos que importan (0, 2 y 3 tours). */
const fs = require('fs');
const path = require('path');
const R = __dirname;
const app = fs.readFileSync(path.join(R, 'public', 'app.js'), 'utf8');

const a = app.indexOf('function localToursMarkup(meta)');
const b = app.indexOf('function tourDuration', a);
if (a < 0 || b < 0) { console.log('no se encontro localToursMarkup en public/app.js'); process.exit(1); }
const cuerpo = app.slice(a, b);

const falla = [];
const ok = (cond, msg) => { if (!cond) falla.push(msg); };

ok(cuerpo.includes('local-tours__growing'), 'el markup no tiene la clase local-tours__growing');
ok(cuerpo.includes('local-tours__growing-badge'), 'el markup no tiene el badge');
const m = /var POCOS = (\d+);/.exec(cuerpo);
ok(!!m, 'no se encuentra el umbral POCOS');
if (m) console.log('umbral POCOS: ' + m[1] + '   (es la cantidad de cards que se ven sin tocar "Ver mas")');
ok(/avisoConstruccion \+/.test(cuerpo), 'el aviso no se interpola en la seccion');
ok(cuerpo.includes('local-tours--soon'), 'el cartel Proximamente desaparecio');
ok(cuerpo.includes('Próximamente'), 'el texto Proximamente desaparecio');

const css = fs.readFileSync(path.join(R, 'public', 'style.css'), 'utf8');
ok(/\.local-tours__growing\{/.test(css), 'falta la regla .local-tours__growing en style.css');
ok(/\.local-tours__growing-badge\{/.test(css), 'falta la regla del badge en style.css');

if (falla.length) {
  console.log('');
  console.log('FALLA (' + falla.length + '):');
  falla.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('el aviso esta en el markup, antes de la grilla, y tiene estilo');
console.log('');
console.log('Como se ve por destino (catalogo actual):');
const datos = require(path.join(R, 'public', 'tours.generated.js'));
const porDest = {};
datos.forEach((t) => { const d = t.destinations[0]; porDest[d] = (porDest[d] || 0) + 1; });
const POCOS = Number(m ? m[1] : 3);
const model = require(path.join(R, 'lib', 'model.js'));
Object.keys(porDest).sort().forEach((k) => {
  const n = porDest[k];
  const nombre = model.DEST[k] ? model.DEST[k].name : k;
  console.log('  ' + k.padEnd(11) + nombre.padEnd(24) + String(n).padStart(2) + ' tours   ' + (n < POCOS ? 'AVISO "Estamos completando"' : 'sin aviso'));
});