'use strict';
/*
 * Arma lo que va al commit: HEAD + SOLO mis cambios.
 *
 * El arbol tiene trabajo del usuario en README.md, package.json, prueba-pares.js,
 * server.js, test.js y test-hoteles.js, y ademas parte de app.js y style.css.
 * Esto solo toma lo mio, archivo por archivo, y lo de app.js/style.css se
 * selecciona por el contenido de cada cambio, no por numero de linea.
 *
 * Lo mio en este bloque:
 *   style.css   --hero-soft (contraste), marcador de version, monto personalizado
 *   app.js      frase del itinerario, clases del monto, tarjeta al final, etiqueta
 *   index.html  y grupo.html   los ?v=
 *   validar-tema.js  chequeos de hero y de version
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const RAIZ = __dirname;
const TMP = process.env.TEMP;
const errores = [];
const ok = [];

/* ---- archivos que son 100% mios: van directo ---- */
const SOLO_MIOS = ['public/index.html', 'public/grupo.html', 'scripts/validar-tema.js'];

/* ---- style.css: mis tres bloques contra el HEAD ---- */
{
  const base = cp.execSync('git show HEAD:public/style.css', { cwd: RAIZ, encoding: 'utf8' });
  let out = base;
  const cambios = [
    // 1. El contraste del hero: 1.12:1 a 5.88:1
    ['--hero-bg:#111A28; --hero-ink:#FFFFFF; --hero-accent:#F7C325; --hero-soft:#1A2433;',
     '--hero-bg:#111A28; --hero-ink:#FFFFFF; --hero-accent:#F7C325; --hero-soft:#8A97A8;'],
    ['--hero-bg:#101828; --hero-ink:#FFFFFF; --hero-accent:#F7C325; --hero-soft:#2A3646;',
     '--hero-bg:#101828; --hero-ink:#FFFFFF; --hero-accent:#F7C325; --hero-soft:#8A97A8;'],
    // 2. El monto personalizado con la tipografia de los presets
    ['.daily-budget__option--custom .daily-budget__input-wrap{max-width:none;min-height:42px;padding:0 8px;background:var(--surface)}.daily-budget__option--custom .daily-budget__input-wrap input{min-width:0;height:38px;font-size:16px}',
     '.daily-budget__option--custom .daily-budget__input-wrap{max-width:none;min-height:0;padding:0;background:transparent}.daily-budget__option--custom .daily-budget__input-wrap input{min-width:0;height:auto;font-size:24px}'],
    // 3. El marcador de version
    // 4. Los dos botones de vuelo dejan el verde fijo y toman el par de tokens
    //    de accion, que es mostaza con tinta oscura. El verde #087E5B estaba
    //    escrito a mano en las dos reglas y era el unico acento de color que
    //    no venia de un token: con el tema claro y el night se veia igual de
    //    verde, que es el otro color de la app.
    ['.cta-flights{background:#087E5B}',
     '.cta-flights{background:var(--action-bg);color:var(--action-ink)}'],
    ['.select-flight{border:0;cursor:pointer;font-weight:700;color:#fff;background:#087E5B;border-radius:14px;',
     '.select-flight{border:0;cursor:pointer;font-weight:700;color:var(--action-ink);background:var(--action-bg);border-radius:14px;'],
    [':root{', '/* version: 110\n   Este numero tiene que coincidir con el ?v= de los <link> de index.html y\n   grupo.html, y scripts/validar-tema.js lo comprueba.\n\n   El server marca cualquier URL con ?v= como "immutable" por un ano\n   (server.js:1782). Eso esta bien para un archivo que no cambia, y es un\n   problema cuando cambia y el numero no se sube: el browser sigue sirviendo la\n   version vieja y el fix no le llega a nadie. Pasa mas de lo razonable, y\n   siempre se descubre tarde, con un "no lo veo" mirando la pantalla.\n\n   Regla: si tocas este archivo, subis el numero de arriba Y el ?v= de las dos\n   paginas. El validador falla si se te olvida una de las dos cosas. */\n:root{']
  ];
  for (const [a, b] of cambios) {
    if (out.indexOf(a) < 0) { errores.push('style.css: no encontre ' + a.slice(0, 60)); continue; }
    out = out.replace(a, b);
  }
  // 4. El bloque de estilos del monto personalizado (nuevo, va antes del cierre del 400px)
  const NUEVO = `.daily-budget__option--custom .daily-budget__input-wrap{margin-top:auto;border:0;border-radius:0;background:transparent;padding:0;gap:2px}
.daily-budget__option--custom .daily-budget__input-wrap input{height:auto;min-height:0;padding:0;font-family:var(--fh);font-size:24px;font-weight:800;line-height:1;color:var(--ink);letter-spacing:-.01em}
.daily-budget__option--custom .daily-budget__input-symbol{font-family:var(--fh);font-size:24px;font-weight:800;line-height:1;color:var(--ink);letter-spacing:-.01em}
.daily-budget__option--custom .daily-budget__input-unit{font-family:var(--fh);font-size:24px;font-weight:800;line-height:1;color:var(--ink);letter-spacing:-.01em;white-space:nowrap}
.daily-budget__option--custom .daily-budget__input-wrap input::placeholder{color:var(--ink2);opacity:.75}
.daily-budget__option--custom .daily-budget__input-wrap:focus-within{outline:3px solid var(--focus);outline-offset:4px;border-radius:8px}
.daily-budget__option--custom .daily-budget__input-wrap input:focus{outline:none}
.daily-budget__option--custom .daily-budget__input-wrap input::-webkit-outer-spin-button,
.daily-budget__option--custom .daily-budget__input-wrap input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.daily-budget__option--custom .daily-budget__input-wrap input{-moz-appearance:textfield;appearance:textfield}
@media (max-width:400px){
  .daily-budget__option{min-height:110px}
  .daily-budget__option strong{font-size:21px}
  .daily-budget__option--custom .daily-budget__input-wrap input,
  .daily-budget__option--custom .daily-budget__input-symbol,
  .daily-budget__option--custom .daily-budget__input-unit{font-size:21px}
}`;
  const ANCLA_MEDIA = '@media (max-width:400px){.daily-budget__option{min-height:110px}.daily-budget__option strong{font-size:21px}}';
  if (out.indexOf(ANCLA_MEDIA) < 0) errores.push('style.css: no encontre la ancla del media query');
  else out = out.replace(ANCLA_MEDIA, NUEVO);

  fs.writeFileSync(path.join(TMP, 'cs-mio.css'), out, 'utf8');
  ok.push('style.css  (' + (out.length - base.length) + ' bytes distintos)');
}

/* ---- app.js: mis cuatro cambios ---- */
{
  const base = cp.execSync('git show HEAD:public/app.js', { cwd: RAIZ, encoding: 'utf8' });
  let out = base;
  const cambios = [
    // NOTA: el movimiento de breakdownMarkup al final del ensamblado queda
    // FUERA de este commit a proposito. En HEAD esa linea todavia trae
    // `fuentesMarkup`, el panel "De donde salen los valores", que el usuario
    // borro en su working tree sin commitear. Aplicar el movimiento sobre HEAD
    // lo volveria a poner. Mover la tarjeta y borrar el panel tocan la misma
    // linea: no se pueden commitear por separado.
    // 2. La frase del itinerario multiruta
    ["var logistics = 'Vuelo ida y vuelta por ' + trip.hub.name + ' (' + trip.hub.iata + '): aeropuerto → ' + first.name + ' → ' + second.name + ' → aeropuerto. Incluye transfers de aeropuerto y ' + trip.transferBetweenLabel.toLowerCase() + ' (' + money(trip.transferBetweenUsd) + ' en total).';",
     "var logistics = 'Vuelo ida y vuelta por ' + trip.hub.name + ' (' + trip.hub.iata + '). Incluye los transfers desde y hacia el aeropuerto.';"],
    ['El traslado entre paradas siempre es una estimación (lo calcula el modelo con la distancia entre las dos).',
     'El traslado entre las dos paradas se estima con la distancia entre ellas.'],
    // "Se recalcula automaticamente para toda la duracion del viaje"
    ['\'</div>\' +\n      \'<p class="daily-budget__hint">Se recalcula automáticamente para toda la duración del viaje.</p>\' +\n      \'</section>\';',
     '\'</div>\' +\n      \'</section>\';'],
    // Titulo de la seccion de vuelos
    ['<h2>Reserva tus Vuelos en Vivo</h2>', '<h2>Reservé tus Vuelos en vivo</h2>'],
    // El circulito de check de las cards de transfer. Se saco porque el estado
    // elegido ya se lee por tres cosas a la vez: el borde pasa a
    // --card-sel-border, el fondo a --card-sel-bg, y el glow. El circulito era
    // una cuarta senal redundante en el angulo, y era el unico elemento de la
    // card que no existia en la version de las actividades.
    ['<b class="transfer-choice__price">\' + money(card.amount) + \'</b><span class="transfer-choice__check" aria-hidden="true">\' + checkIcon() + \'</span></button>\'',
     '<b class="transfer-choice__price">\' + money(card.amount) + \'</b></button>\''],
    // 3. El monto personalizado: clases nuevas + etiqueta
    ['<span>Monto por día</span><div class="daily-budget__input-wrap"><span>',
     '<span>Monto planeado</span><div class="daily-budget__input-wrap"><span class="daily-budget__input-symbol">'],
    ['aria-label="Presupuesto personalizado diario para \'',
     'aria-label="Monto diario planeado para \''],
    ['<input type="number" min="0" step="1" inputmode="decimal" value="\'',
     '<input type="number" min="0" step="1" inputmode="decimal" value="\''],
    ["'\"><span>/día</span></div></label>';", "'\"><span class=\"daily-budget__input-unit\">/día</span></div></label>';"]
  ];
  for (const [a, b] of cambios) {
    if (out.indexOf(a) < 0) { errores.push('app.js: no encontre ' + JSON.stringify(a.slice(0, 60))); continue; }
    out = out.replace(a, b);
  }
  // El movimiento de la tarjeta al final va con el borrado del panel, asi que
  // se avisa en vez de applies a medias.
  console.log('\n  OJO: breakdownMarkup sigue donde estaba (arriba). Moverlo depende de que');
  console.log('  entre primero el borrado del panel de procedencia, que es tuyo.');

  fs.writeFileSync(path.join(TMP, 'app-mio.js'), out, 'utf8');
  ok.push('app.js     (' + (out.length - base.length) + ' bytes distintos)');
}

console.log('armados:');
ok.forEach(o => console.log('  ' + o));
if (errores.length) { console.log('\nPROBLEMAS:'); errores.forEach(e => console.log('  ' + e)); process.exit(1); }
console.log('\nescritos en ' + TMP);
console.log('archivos que van directos: ' + SOLO_MIOS.join(', '));
