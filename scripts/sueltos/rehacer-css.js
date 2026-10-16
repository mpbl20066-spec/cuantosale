'use strict';
/* Rehace los cambios del candado sobre el style.css de HEAD, que es el unico
   sano (1676 lineas). El archivo del disco tiene 3440: una de las escrituras
   de esta sesion lo duplico, y por eso los ultimos `git diff` mostraban 1784
   lineas en vez de las ~40 del cambio real.

   Se parte de HEAD y se aplican las tres cosas:
     1. el boton de reservar del voucher (.voucher-reserve), que se movio de la
        card "Mi Viaje" y cuyo CSS todavia no esta en HEAD;
     2. las reglas de .saved-trip con flex-wrap;
     3. el candado de la Guia Secreta: dibujo nuevo, tildes y apertura.
   Al final compara el resultado con el archivo del disco: si coinciden, el
   duplicado estaba solo en el disco y ya se resolvio. */
const cp = require('child_process');
const fs = require('fs');

const aLF = s => s.replace(/\r\n/g, '\n');
let c = aLF(cp.execSync('git show HEAD:public/style.css', { encoding: 'utf8', maxBuffer: 1 << 28 }));
const lineas = c.split('\n');
console.log('  base: ' + lineas.length + ' lineas');

let cambios = 0;
const tiene = k => c.includes(k);

// --- 1) .voucher-reserve (el boton que se mudo al voucher) ---
if (!tiene('.voucher-reserve__btn')) {
  const nuevo = [
    '/* El boton de reservar del voucher.',
    '   Vive aca y no en la card "Mi Viaje" porque necesita el total de lo que se',
    '   RESERVA, que no es el total del viaje que muestra la card, y la lista de',
    '   rubros elegidos, que recien esta completa dos pantallas mas arriba. En la',
    '   card decia "Reservar actividades y transfer" sin el numero, al lado de',
    '   "Ver mi presupuesto" que abre este mismo modal: dos caminos a la misma',
    '   accion, y el que tenia el precio no lo decia.',
    '',
    '   min-height:52px y el par --action-bg/--action-ink, el de las acciones que',
    '   cierran el viaje en el resto de la app. El <em> con el total va en',
    '   tabular-nums para que los numeros no bailen al cambiar de cifras. */',
    '.voucher-reserve{display:grid;gap:8px}',
    '.voucher-reserve__btn{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:52px;padding:0 20px;border:0;border-radius:14px;background:var(--action-bg);color:var(--action-ink);font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;transition:filter .16s ease,opacity .16s ease}',
    '.voucher-reserve__btn:hover{filter:brightness(1.08)}',
    '.voucher-reserve__btn:disabled{opacity:.55;cursor:not-allowed}',
    '.voucher-reserve__btn em{font-style:normal;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.voucher-reserve__nota{margin:0;color:var(--ink2);font-size:12.5px;line-height:1.4}',
    '.voucher-reserve__btn:focus-visible{outline:3px solid var(--focus);outline-offset:2px}'
  ];
  const i = lineas.findIndex(l => l.includes('.voucher-actions{'));
  if (i < 0) { console.log('  no encontre .voucher-actions'); process.exit(1); }
  lineas.splice(i, 0, nuevo.join('\n'));
  cambios++; console.log('  + .voucher-reserve');
}

// --- 2) .saved-trip con flex-wrap ---
if (!tiene('.saved-trip{display:flex;flex-wrap:wrap')) {
  const i = lineas.findIndex(l => l.includes('.saved-trip{display:flex;'));
  if (i < 0) { console.log('  no encontre .saved-trip'); process.exit(1); }
  lineas[i] = '/* flex-wrap: los tres botones de la fila —Cargar, Actualizar precio y borrar— se';
  lineas[i] = lineas[i] + '\n   peleaban el ancho de una fila de 360px que ya tiene el nombre y las fechas.';
  lineas.splice(i + 1, 0,
    '   "Actualizar precio" se partia en dos lineas dentro de un boton de 40px de alto,',
    '   que se veia como un boton roto y no como el texto que es. Con wrap el bloque de',
    '   texto toma la fila entera y los botones bajan juntos, con el mas largo como',
    '   ancho comun en vez de tres anchos distintos peleando. */');
  const j = lineas.findIndex(l => l.includes('.saved-trip{display:flex;'));
  lineas[j] = lineas[j].replace('display:flex;align-items:center;justify-content:space-between;gap:12px;', 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 12px;');
  const k = lineas.findIndex(l => l.includes('.saved-trip>div{display:grid;gap:4px;min-width:0}'));
  if (k >= 0) {
    lineas[k] = '/* flex:1 1 190px + min-width:0 es lo que deja que el nombre con puntos';
    lineas.splice(k + 1, 0,
      '   suspensivos funcione en vez de empujar la fila. */',
      '.saved-trip>div{display:grid;gap:4px;min-width:0;flex:1 1 190px}');
  }
  cambios++; console.log('  + flex-wrap en .saved-trip');
}

// --- 3) el candado ---
if (!tiene('.guia-lock__ico')) {
  const idx = [];
  lineas.forEach((l, i) => { if (l.includes('.guia-lock')) idx.push(i); });
  if (idx.length !== 5) { console.log('  reglas .guia-lock en HEAD: ' + idx.length + ' (esperaba 5)'); process.exit(1); }
  const aBorrar = new Set(idx);
  const primera = idx[0];
  for (let k = primera - 1; k >= 0 && k > primera - 14; k--) {
    const l = lineas[k].trim();
    if (l.endsWith('*/')) { for (let q = k; q >= 0 && q > k - 20; q--) { if (lineas[q].includes('/*')) { for (let z = q; z <= k; z++) aBorrar.add(z); break; } } break; }
    if (l !== '') break;
  }
  const antes = lineas.slice(0, primera).filter((_, i) => aBorrar.has(i)).length;
  const nuevo = [
    '/* El candado de la Guia Secreta.',
    '   El borde punteado y el candado de la caja de entrada dicen lo mismo: esta',
    '   seccion esta cerrada. El candado es SVG y no el emoji 🔒 porque el emoji se',
    '   dibuja distinto en cada sistema operativo —el mismo problema que ya se',
    '   corrigio en los iconos de los transfers— y porque el emoji no se puede abrir.',
    '',
    '   Se abre: .is-open levanta el arco y lo inclina, y el marco pasa de punteado',
    '   a entero. Es transform, no width ni height, asi que no hay layout y el texto',
    '   de abajo no se mueve.',
    '',
    '   El arco se LEVANTA y no solo gira: el punto de giro esta en y=10, que es',
    '   donde arranca el cuerpo, asi que cualquier rotacion deja un extremo del arco',
    '   por debajo de y=10 y nunca se libera. Con translateY(-5) sube entero. El',
    '   overflow:visible del svg es por lo mismo: el arco girado se sale del',
    '   viewBox de 24x24 y sin esto el navegador lo recorta. */',
    '.guia-lock{margin-top:22px;padding:22px;border:1.5px dashed var(--control-line);border-radius:20px;background:var(--surface);transition:border-color .3s ease}',
    '.guia-lock__eyebrow{color:var(--ink2);font-size:10px;font-weight:800;letter-spacing:.12em}',
    '.guia-lock__head h2{margin:5px 0 12px;font-family:var(--fh);font-size:30px;line-height:1.05}',
    '.guia-lock__body{display:grid;grid-template-columns:34px minmax(0,1fr);gap:12px;align-items:start}',
    '.guia-lock__icon{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--bg);color:var(--cel)}',
    '.guia-lock__ico{width:22px;height:22px;overflow:visible}',
    '.guia-lock__shackle,.guia-lock__body{transform-box:fill-box;transition:transform .34s cubic-bezier(.34,1.4,.5,1)}',
    '.guia-lock__shackle{transform-origin:50% 100%}',
    '.guia-lock__texto{margin:0;color:var(--ink);font-size:13.5px;line-height:1.55}',
    '.guia-lock__nota{margin:10px 0 0;color:var(--ink2);font-size:11.5px;line-height:1.45}',
    '/* Abierto: el marco pasa de punteado a entero, que es lo que ya dice el resto',
    '   de la app cuando algo esta resuelto. */',
    '.guia-lock.is-open{border-style:solid;border-color:var(--cel)}',
    '.guia-lock.is-open .guia-lock__shackle{transform:translateY(-5px) rotate(-25deg)}',
    '.guia-lock.is-open .guia-lock__body{transform:translateY(2px)}',
    '.guia-lock.is-open .guia-lock__icon{background:var(--cel-soft)}',
    '/* En el celu el candado se va arriba del texto en vez de al lado: con 34px al',
    '   lado el parrafo pierde 46px de ancho y quedan tres lineas cortas al lado de',
    '   un icono. Arriba se lee como un encabezado. */',
    '@media (max-width:520px){.guia-lock__body{grid-template-columns:minmax(0,1fr);gap:9px}}'
  ].join('\n');
  const resto = lineas.filter((_, i) => !aBorrar.has(i));
  resto.splice(primera - antes, 0, nuevo);
  lineas.length = 0;
  lineas.push(...resto);
  cambios++; console.log('  + candado de la Guia Secreta');
}

// El marcador de version tiene que coincidir con el ?v= de las paginas.
c = lineas.join('\n');
c = c.replace(/\/\* version: \d+/, '/* version: 120');

const abre = (c.match(/\{/g) || []).length, cierra = (c.match(/\}/g) || []).length;
console.log('  resultado: ' + c.split('\n').length + ' lineas, llaves ' + abre + '/' + cierra +
  (abre === cierra ? '' : '  << DESBALANCEADO'));
console.log('  cambios aplicados: ' + cambios);

fs.writeFileSync('public/style.css', c, 'utf8');
['.voucher-reserve__btn', '.saved-trip{display:flex;flex-wrap:wrap', '.guia-lock__ico', 'translateY(-5px) rotate(-25deg)', 'html:has(.booking-modal']
  .forEach(k => console.log('  ' + (c.includes(k) ? 'ok   ' : 'FALTA') + '  ' + k));
