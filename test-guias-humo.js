'use strict';
/*
 * Prueba de humo de los tests de la Guia Secreta.
 *
 *   node test-guias-humo.js
 *
 * Un test que no falla cuando tiene que fallar no sirve de nada. Este script
 * rompe el codigo a proposito, una vez por cada regresion que de verdad
 * ocurrio, y verifica que `node test.js` la marque. Despues restaura los
 * archivos y comprueba que todo vuelva a pasar.
 *
 * Por que hace falta: las dos veces que un pase automatico rompio guiAs.js,
 * el dano fue silencioso. "region" -> "región" dejo coberturaGuias() leyendo
 * d.región, que en DEST es d.region: la cobertura daba 0 y nadie se enteraba
 * porque no tira error. "cuando" -> "cuándo" renombro la clave del schema de
 * las 19 playas y el render recibia undefined. Ninguna de las dos se ve
 * mirando la pantalla; se ven con estas pruebas.
 *
 * No corre el resto de la suite: las pruebas de vuelos y hoteles consumen
 * cuota de RapidAPI (ver README), y para esto no hacen falta.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const RAIZ = __dirname;
const GUIAS = path.join(RAIZ, 'public', 'guias.js');
const APP = path.join(RAIZ, 'public', 'app.js');
const TEST = path.join(RAIZ, 'test.js');

// El bloque de la guia se arma aparte para no tocar la parte que consume
// cuota. Se reescriben los archivos originales al final, pase lo que pase.
const lineas = fs.readFileSync(TEST, 'utf8').split(/\r?\n/);
const desde = lineas.findIndex(l => l.indexOf("console.log('Guia Secreta');") >= 0);
const hasta = lineas.findIndex(l => l.indexOf("console.log('Modelo');") >= 0);
if (desde < 0 || hasta < 0) {
  console.error('test.js no tiene el bloque "Guia Secreta". Agregalo antes de correr esto.');
  process.exit(1);
}
const mainAt = lineas.findIndex(l => l.indexOf('(async function main() {') === 0);
const RUNNER = path.join(RAIZ, '.test-guias-runner.js');
const construirRunner = () => fs.writeFileSync(RUNNER, lineas.slice(0, mainAt + 1)
  .concat(lineas.slice(desde, hasta))
  .concat(['  console.log("\\n" + passed + " pruebas OK" + (process.exitCode ? " (con fallas)" : ""));', '})();', ''])
  .join('\r\n'), 'utf8');

function correrGuia() {
  construirRunner();
  try {
    return cp.execSync('node "' + RUNNER + '" 2>&1', { encoding: 'utf8' });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

const origGuias = fs.readFileSync(GUIAS, 'utf8');
const origApp = fs.readFileSync(APP, 'utf8');

/* Si el archivo ya estaba sucio al arrancar, el "estado bueno" que este
   script usa para restaurar es en realidad un estado roto, y cada corrida lo
   hornea como tal. Pasa de verdad: un smoke test muerto a mitad de camino
   dejo una linea inyectada en app.js, y la corrida siguiente la tomo como
   base y la devolvio al final, asi que el archivo quedo roto en el repo.

   Por eso el baseline sale de git y no de disco. Si hay cambios sin
   commitear en los archivos que este script rompe, no se corre. */
const COMMITTED = {};
['public/guias.js', 'public/app.js'].forEach(function (rel) {
  try {
    COMMITTED[rel] = cp.execSync('git show HEAD:' + rel, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  } catch (e) { COMMITTED[rel] = null; }
});
const sucios = [];
[['public/guias.js', origGuias], ['public/app.js', origApp]].forEach(function (par) {
  const base = COMMITTED[par[0]];
  if (base !== null && base !== par[1]) sucios.push(par[0]);
});
if (sucios.length) {
  console.error('No se corre con ' + sucios.join(' y ') + ' sin commitear.');
  console.error('Este script rompe y restaura esos archivos, y para eso necesita que el');
  console.error('estado bueno este en git. Commitea primero:  git add ' + sucios.join(' '));
  process.exit(1);
}

const CASOS = [
  {
    nombre: 'la clave del schema "cuando" renombrada a "cuándo:"',
    archivo: GUIAS, orig: origGuias,
    romper: (s) => s.replace(/cuando: 'Todo el año\./, 'cuándo: \'Todo el año.\'')
  },
  {
    nombre: '"d.region" renombrado a "d.región" en cobertura()',
    archivo: GUIAS, orig: origGuias,
    romper: (s) => s.replace('if (d.region && REGIONES[regionSlug(d.region)])', 'if (d.región && REGIONES[regionSlug(d.región)])')
  },
  {
    nombre: 'el export "version:" renombrado a "versión:"',
    archivo: GUIAS, orig: origGuias,
    romper: (s) => s.replace('version: CACHE_VERSION', 'versión: CACHE_VERSION')
  },
  {
    nombre: '"si" condicional convertido en "sí" afirmativa',
    archivo: GUIAS, orig: origGuias,
    romper: (s) => s.replace('Si lo pides como si fuera bus urbano', 'Si lo pides como sí fuera bus urbano')
  },
  {
    nombre: 'un caracter fuera del alfabeto colado en el texto',
    archivo: GUIAS, orig: origGuias,
    romper: (s) => s.replace('con el mejor atardecer del estado', 'con el mejor atardecer del 奇怪 estado')
  },
  {
    nombre: 'un precio de comida mas caro que un dia entero',
    archivo: GUIAS, orig: origGuias,
    romper: (s) => s.replace("usd: 3, momento: 'Cualquier hora', nota: 'Se hace en el momento", "usd: 900, momento: 'Cualquier hora', nota: 'Se hace en el momento")
  },
  {
    nombre: 'toursFor duplicada en app.js',
    archivo: APP, orig: origApp,
    romper: (s) => s.replace('  function localToursMarkup(meta) {', '  function toursFor() { return []; }\n  function localToursMarkup(meta) {')
  },
  {
    nombre: 'una foto de playa sin acreditar',
    archivo: GUIAS, orig: origGuias,
    romper: (s) => s.replace("foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/", "foto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/inexistente.jpg/1280px-inexistente.jpg?x=' + 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/")
  }
];

let sinDetectar = 0;
console.log('Prueba de humo: cada escenario tiene que ser detectado.\n');
for (const caso of CASOS) {
  const roto = caso.romper(caso.orig);
  if (roto === caso.orig) {
    console.log('  MAL   ' + caso.nombre);
    console.log('        el escenario no cambio nada: el ancla ya no esta en el archivo,');
    console.log('        asi que esto no prueba que el test funcione');
    sinDetectar++;
    continue;
  }
  fs.writeFileSync(caso.archivo, roto, 'utf8');
  let detectado = false, cual = '';
  let salida = '';
  try {
    salida = correrGuia();
    const m = salida.match(/FALLÓ\s+(.+)/);
    if (m) { detectado = true; cual = m[1].trim(); }
  } catch (e) {
    salida = '(correrGuia tiro: ' + e.message + ')';
  } finally {
    fs.writeFileSync(caso.archivo, caso.orig, 'utf8');
    // Verificar que la restauracion fue exacta. Si un escenario deja el
    // archivo distinto de como estaba, el resto de la corrida corre sobre un
    // estado que ya no es el bueno.
    if (fs.readFileSync(caso.archivo, 'utf8') !== caso.orig) {
      console.error('\n  ABORTA: ' + caso.archivo + ' quedo distinto despues de restaurarlo.');
      console.error('  El escenario de arriba no volvio el archivo a su estado.');
      process.exit(1);
    }
  }
  if (!detectado) {
    console.log('        [debug] largo=' + String(salida).length +
      ' contiene FALL=' + String(salida).includes('FALL'));
  }
  console.log((detectado ? '  ok    detecta  ' : '  FALLA no detecta  ') + caso.nombre + (cual ? '\n        -> ' + cual : ''));
  if (!detectado) sinDetectar++;
}

// Que restaurar los archivos deje todo en verde otra vez.
const final = correrGuia();
const limpio = !/FALLÓ/.test(final);
console.log('\ntras restaurar los archivos: ' + (limpio ? 'todo en verde' : 'FALLA, se restauro mal'));
try { fs.unlinkSync(RUNNER); } catch (e) { /* no importa */ }

if (sinDetectar || !limpio) {
  console.log('\n' + sinDetectar + ' de ' + CASOS.length + ' escenarios sin detectar');
  process.exit(1);
}
console.log('los ' + CASOS.length + ' escenarios se detectan');
