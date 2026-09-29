#!/usr/bin/env node
/* Lleva a main todo lo que haya en las ramas de trabajo, y solo si esta verde.
 *
 * Que cada sesion mergee a mano hacia que alguien lo haga mal: el merge se hace
 * en un worktree temporal, se corren las pruebas sobre el resultado, y el push
 * ocurre recien despues de que pasan. Si algo falla no se sube nada y el
 * worktree queda en disco para mirarlo.
 *
 * Por que los numeros de version se resuelven solos. Casi todos los conflictos
 * entre dos sesiones son el mismo: las dos movieron el ?v= del CSS o el del JS
 * y git no sabe cual va. Si se resuelve mal queda el numero viejo, el browser
 * sigue sirviendo el CSS anterior por el cache immutable de un ano, y el fix no
 * le llega a nadie sin que aparezca ningun error. Por eso el merge toma el mas
 * alto de los dos.
 *
 * Uso:  node scripts/merge-ramas.js
 *       node scripts/merge-ramas.js --push    (mergea y sube; sin esto solo prueba)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
const TMP = path.join(os.tmpdir(), 'cuantosale-merge');
const RAMA = 'merge-temporal';
const REMOTO = 'origin';
const MAIN = 'main';
const SUBIR = process.argv.includes('--push');

const log = (...a) => console.log(...a);
const dies = (...a) => { console.error(...a); process.exit(1); };

function git(args, cwd) {
  return execFileSync('git', args, { cwd: cwd || RAIZ, encoding: 'utf8' });
}
function correr(args) {
  return execFileSync('git', args, { cwd: RAIZ });
}
function textoDe(e) {
  return ((e.stdout || '') + (e.stderr || '')).toString().trim();
}
const tieneMarcas = (t) => /^(<<<<<<<|=======|>>>>>>>)(\s|$)/m.test(t);

/* ---------------------------------------------------------------- versionado --
 * Los conflictos de version se resuelven por numero, no por lado: se queda con
 * el mas alto y se sube en uno. El mas alto es el cambio mas reciente, y subir
 * en uno garantiza que el numero final supere todo lo que se sirvio antes —si
 * quedara igual, el navegador sigue con el archivo viejo en el cache de un ano.
 *
 * El lado de main es el que se conserva en los bloques que no son de version:
 * main ya esta en produccion, y el contenido que trae la rama entra entero en
 * su commit, no en el merge.
 *
 * Solo se resuelven los archivos de version. Si el conflicto esta en app.js o en
 * cualquier otro, no se toca: se devuelve el nombre y el script para, para que
 * una persona lo mire. Un merge automatico que "arregla" un archivo de 8.000
 * lineas por un conflicto de texto es peor que no mergear. */
const ARCHIVOS_DE_VERSION = ['public/style.css', 'public/index.html', 'public/grupo.html'];

function resolverVersiones(dir) {
  // Primero se mira si hay conflictos fuera de los archivos de version. Si los
  // hay, no se intenta nada: son de codigo y se resuelven a mano.
  const enConflicto = git(['diff', '--name-only', '--diff-filter=U'], dir).split('\n')
    .map((f) => f.trim()).filter(Boolean);
  const ajenos = enConflicto.filter((f) => !ARCHIVOS_DE_VERSION.includes(f));
  if (ajenos.length) {
    return 'el conflicto no es solo de version, esta en ' + ajenos.join(', ');
  }

  for (const f of ARCHIVOS_DE_VERSION) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8');
    if (!tieneMarcas(t)) continue;
    const lineas = t.split(/\r?\n/);
    const salida = [];
    for (let i = 0; i < lineas.length; i++) {
      if (!/^<<<<<<</.test(lineas[i])) { salida.push(lineas[i]); continue; }
      while (i < lineas.length && !/^>>>>>>>/.test(lineas[i])) i++;
    }
    fs.writeFileSync(p, salida.join('\n'));
  }

  const leer = (f, re) => {
    const p = path.join(dir, f);
    const m = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').match(re) : null;
    return m ? Number(m[1]) : 0;
  };
  const css = Math.max(
    leer('public/style.css', /^\/\* version:\s*(\d+)/),
    leer('public/style.css', /\?v=(\d+)/)
  ) + 1;
  const js = Math.max(
    leer('public/index.html', /app\.js\?v=(\d+)/),
    leer('public/grupo.html', /grupo\.js\?v=(\d+)/)
  ) + 1;

  for (const f of ARCHIVOS_DE_VERSION) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    let t = fs.readFileSync(p, 'utf8');
    t = t.replace(/style\.css\?v=\d+/g, 'style.css?v=' + css)
      .replace(/app\.js\?v=\d+/g, 'app.js?v=' + js)
      .replace(/grupo\.js\?v=\d+/g, 'grupo.js?v=' + js);
    fs.writeFileSync(p, t);
  }
  fs.writeFileSync(path.join(dir, 'public/style.css'),
    fs.readFileSync(path.join(dir, 'public/style.css'), 'utf8')
      .replace(/^\/\* version:\s*\d+/, '/* version: ' + css));
  return null;
}

/* ------------------------------------------------------------------- arranque */
const actual = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
if (actual !== MAIN) {
  dies('Esto corre sobre la carpeta compartida, que está en main. Ahora estás en "' + actual + '".\n' +
    'Las ramas de trabajo se mergean desde main, no desde sesion-X.');
}

git(['fetch', '--all', '--prune']);

const ramas = git(['branch', '--format=%(refname:short)']).split('\n')
  .map((r) => r.trim()).filter((r) => r && r !== MAIN && r !== RAMA);

const adelante = [];
for (const r of ramas) {
  let c = '';
  try { c = git(['log', '--oneline', `${MAIN}..${r}`]).trim(); } catch (e) { continue; }
  if (!c) continue;
  const n = c.split('\n').length;
  log('  ' + r + ': ' + n + (n === 1 ? ' commit' : ' commits'));
  c.split('\n').forEach((l) => log('      ' + l));
  adelante.push(r);
}
if (!adelante.length) { log('Ninguna rama está adelante de main. Ya está todo subido.'); process.exit(0); }

/* --------------------------------------------------------------------- merge */
/* Limpieza de la corrida anterior antes de empezar. Sin esto, un intento que
   se corta a mitad (un conflicto que el script no supo resolver, un Ctrl+C)
   deja la rama RAMA y el worktree puestos, y la corrida siguiente muere con
   "a branch named 'merge-temporal' already exists" antes de llegar a hacer
   nada. */
try { correr(['worktree', 'remove', TMP, '--force']); } catch (e) { /* no estaba */ }
try { correr(['branch', '-D', RAMA]); } catch (e) { /* no estaba */ }
correr(['worktree', 'prune']);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* no estaba */ }
correr(['worktree', 'add', TMP, '-b', RAMA, `${REMOTO}/${MAIN}`]);
const T = (args) => execFileSync('git', args, { cwd: TMP, encoding: 'utf8' });

for (const r of adelante) {
  log('\n--- mergeando ' + r + ' ---');
  try {
    T(['merge', r, '--no-edit', '--no-commit']);
  } catch (e) {
    const out = textoDe(e);
    if (!/CONFLICT/.test(out)) { dies('  el merge falló:\n' + out + '\n\nQuedó el worktree en ' + TMP); }
    const mal = resolverVersiones(TMP);
    if (mal) {
      dies('  ' + mal + '\n\nQuedó el worktree en ' + TMP + ' para mirarlo a mano.\n' +
        'Si son numeros de ?v=, el script los resuelve solo: vuelve a correrlo.\n' +
        'Si es codigo, hay que decidir cual version gana antes de seguir.');
    }
    log('  conflictos de versión resueltos solos');
    try { T(['add', '-A']); } catch (e2) { /* el add puede fallar si quedo algo sin resolver */ }
  }
  try {
    T(['commit', '-m',
      'Merge ' + r + ': trabajo de las sesiones\n\n' +
      'Traído a main con node scripts/merge-ramas.js, que corre las pruebas\n' +
      'antes de dejar subir nada.']);
  } catch (e) {
    dies('  no se pudo commitear:\n' + textoDe(e) + '\nQuedó el worktree en ' + TMP);
  }
  log('  ok');
}

/* -------------------------------------------------------------------- pruebas */
log('\n--- pruebas sobre el merge ---');
const SUITE = [
  ['node', ['--check', 'public/app.js'], 'app.js'],
  ['node', ['--check', 'public/grupo.js'], 'grupo.js'],
  ['node', ['--check', 'server.js'], 'server.js'],
  ['node', ['scripts/validar-tema.js'], 'tema'],
  ['node', ['test.js'], 'test'],
  ['node', ['test-checkout.js'], 'checkout'],
  ['node', ['test-hoteles.js'], 'hoteles']
];
for (const [bin, args, nombre] of SUITE) {
  try {
    execFileSync(bin, args, { cwd: TMP, encoding: 'utf8' });
    log('  ok  ' + nombre);
  } catch (e) {
    const out = textoDe(e).split('\n').slice(-6).join('\n');
    dies('\nFALLÓ ' + nombre + ':\n' + out + '\n\nNo se sube nada. Quedó el worktree en ' + TMP);
  }
}

/* ---------------------------------------------------------------------- push */
if (!SUBIR) { log('\nTodo verde. Correr de nuevo con --push para subirlo.'); process.exit(0); }
try { T(['push', REMOTO, 'HEAD:' + MAIN]); }
catch (e) {
  dies('El push fue rechazado:\n' + textoDe(e) +
    '\n\nCasi seguro otra sesión commiteó mientras esto corría. Volver a correr el script.');
}
log('\nSubido a ' + REMOTO + '/' + MAIN + '.');

try { correr(['worktree', 'remove', TMP, '--force']); } catch (e) { /* queda para mirarlo */ }
try { correr(['branch', '-D', RAMA]); } catch (e) { /* ya no está */ }
correr(['worktree', 'prune']);
correr(['fetch', REMOTO, '--prune']);
log('Worktree temporal borrado.');
