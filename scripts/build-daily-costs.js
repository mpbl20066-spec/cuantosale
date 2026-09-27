'use strict';
/*
 * Genera public/daily-costs.js a partir de DESTINATION_COSTS (lib/model.js).
 *
 * Por que existe: la tabla de costos diarios por destino vivia escrita a mano
 * en DOS lugares, lib/model.js (la que cotiza el server) y public/app.js (la que
 * dibuja las tarjetas en el navegador). Las dos caian al fallback de Rio de
 * Janeiro cuando no encontraba la clave, asi que una clave faltante no rompia
 * nada: cobraba Rio en silencio. Paso de verdad: el cliente se quedo 17
 * destinos atras y cotizaba angra, curitiba, rec, torres y companhia con
 * numeros de Rio sin que ninguna prueba se enterara.
 *
 * Con este archivo la tabla tiene una sola fuente de verdad. El cliente la
 * recibe como global, y `npm test` corre esto antes (pretest) para que el
 * archivo commiteado nunca quede viejo. La prueba 'la tabla de costos del
 * cliente es copia fiel de la del servidor' igual lo verifica, para que correr
 * `node test.js` sin npm tampoco deje pasar una desincronizacion.
 *
 * Uso:  node scripts/build-daily-costs.js   (o npm run build:costos)
 */
const fs = require('fs');
const path = require('path');

const MODEL = path.join(__dirname, '..', 'lib', 'model.js');
const OUT = path.join(__dirname, '..', 'public', 'daily-costs.js');

const model = require(MODEL);
const C = model.DESTINATION_COSTS;

// El nombre del global que consume public/app.js. Si lo cambias, cambialo en
// app.js tambien: es el unico punto de acoplamiento entre los dos archivos.
var GLOBAL = 'CS_DESTINATION_DAILY_COSTS';

const body = Object.keys(C).map((k) => {
  const c = C[k];
  const nombre = (model.DEST[k] && model.DEST[k].name) || '?';
  const linea =
    "  " + k + ": { name: '" + nombre.replace(/'/g, "\\'") + "'," +
    " transport: { eco: " + c.transport.eco + ", confort: " + c.transport.confort + " }," +
    " food: { casual: " + c.food.casual + ", moderado: " + c.food.moderado + ", gourmet: " + c.food.gourmet + " } },";
  return linea;
}).join('\n');

const salida =
  "'use strict';\n" +
  "/* GENERADO. No editar a mano: corré `npm run build:costos`.\n" +
  "   Fuente: lib/model.js -> DESTINATION_COSTS. Editá ahí y regenerá. */\n" +
  "(function (root, tabla) {\n" +
  "  root." + GLOBAL + " = tabla;\n" +
  "  // La prueba de test.js lo requirea para compararlo con el modelo, asi que\n" +
  "  // tiene que servir tanto en el navegador como en node.\n" +
  "  if (typeof module !== 'undefined' && module.exports) module.exports = tabla;\n" +
  "})(typeof globalThis !== 'undefined' ? globalThis : this, {\n" + body + "\n});\n";

const anterior = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (anterior === salida) {
  console.log('daily-costs.js al dia (' + Object.keys(C).length + ' destinos)');
} else {
  fs.writeFileSync(OUT, salida, 'utf8');
  const antes = anterior ? (anterior.match(/\n\s{2}[a-z_]+: \{/g) || []).length : 0;
  console.log('daily-costs.js regenerado: ' + Object.keys(C).length + ' destinos' +
    (antes && antes !== Object.keys(C).length ? ' (antes ' + antes + ')' : ''));
}
