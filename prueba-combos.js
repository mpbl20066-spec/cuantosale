/* Pruebas del viaje combinado (dos paradas en un mismo viaje).
   Lo que mas importa acá no es la aritmética sino dos cosas que se pueden
   romper sin que se note: que ningun par del mismo grupo regional quede afuera
   por el techo de distancia, y que el precio de un tramo corto no sea el de uno
   largo. */
const fs = require('fs');
const raiz = __dirname.replace(/\\/g, '/') + '/';
const model = require(raiz + 'lib/model.js');

const fallos = [];
function check(nombre, cond, detalle) {
  console.log((cond ? '  OK   ' : '  FALLA ') + nombre);
  if (!cond) fallos.push(nombre + (detalle ? ' -> ' + detalle : ''));
}

// Los grupos se leen del archivo real: la prueba tiene que fallar si alguien
// agrupa un destino nuevo y el techo de distancia lo deja afuera.
const app = fs.readFileSync(raiz + 'public/app.js', 'utf8');
const desde = app.indexOf('var DESTINATION_GROUPS = [');
const grupos = [];
for (const x of app.slice(desde, app.indexOf('\n  ];', desde))
  .matchAll(/\{ id: '([^']+)', label: '([^']+)'[\s\S]*?keys: \[([^\]]*)\]/g)) {
  grupos.push({ label: x[2], keys: [...x[3].matchAll(/'([^']+)'/g)].map(y => y[1]) });
}
const pares = [];
for (const g of grupos) {
  for (let i = 0; i < g.keys.length; i++) {
    for (let j = i + 1; j < g.keys.length; j++) pares.push({ grupo: g.label, a: g.keys[i], b: g.keys[j] });
  }
}

console.log('1) Los grupos se leen del archivo real');
check('se encontraron los 10 grupos', grupos.length === 10, 'encontre ' + grupos.length);
check('hay 86 pares dentro de un grupo', pares.length === 86, 'encontre ' + pares.length);

console.log('\n2) Todo par del mismo grupo es combinable');
{
  const rechazados = [];
  for (const p of pares) if (!model.comboTransfer(p.a, p.b, 1)) rechazados.push(p.a + '/' + p.b + ' (' + p.grupo + ')');
  check('ningun par del mismo grupo se rechaza', rechazados.length === 0,
    rechazados.length + ' rechazados: ' + rechazados.slice(0, 6).join(', '));
}

console.log('\n3) El techo de distancia no deja afuera ninguna pareja');
{
  // Con el primer valor que se probo (420 km) se rechazaban 18 de los 86, casi
  // todos del Nordeste y de Bahia. Este es el control contra esa regresion.
  let max = 0, par = '';
  for (const p of pares) {
    const t = model.comboTransfer(p.a, p.b, 1);
    if (t && t.distanceKm > max) { max = t.distanceKm; par = p.a + '/' + p.b + ' (' + p.grupo + ')'; }
  }
  check('el par mas largo del mismo grupo entra en el techo',
    max <= model.COMBO_MAX_KM, 'el mas largo es ' + par + ' a ' + max + ' km y el techo es ' + model.COMBO_MAX_KM);
  check('el techo deja margen (no esta pegado al maximo)', model.COMBO_MAX_KM > max * 1.05,
    'techo ' + model.COMBO_MAX_KM + ' contra maximo ' + max);
}

console.log('\n4) Lo absurdo se rechaza');
for (const [a, b, porQue] of [
  ['fln', 'for', 'Florianopolis con Fortaleza son 2400 km'],
  ['portoseguro', 'nat', 'Porto Seguro con Natal son 880 km'],
  ['bue', 'rio', 'Buenos Aires con Rio son 1500 km'],
  ['fln', 'porto', 'Santa Catarina con Pernambuco']
]) {
  check(a + ' + ' + b + ' se rechaza', model.comboTransfer(a, b, 1) === null, porQue);
}
{
  // Salvador con Recife NO es absurdo: son 850 km por ruta y hay linea de bus.
  // No lo ofrece la interfaz porque estan en grupos regionales distintos, pero
  // el techo de sanity es un tope de locomocion, no una regla de alcance: si
  // alguien lo pidiera a mano, se cotiza con un numero honesto.
  const t = model.comboTransfer('ssa', 'rec', 1);
  check('Salvador + Recife se puede cotizar (850 km por ruta, hay bus)',
    t !== null && t.distanceKm > 700, t ? t.distanceKm + ' km' : 'null');
  check('y sale caro, como corresponde a un tramo de ese largo',
    t && t.perPaxUsd > 35, t ? String(t.perPaxUsd) : 'null');
}

console.log('\n5) Casos borde que devuelven null');
check('el mismo destino dos veces', model.comboTransfer('buz', 'buz', 1) === null);
check('un destino inexistente', model.comboTransfer('buz', 'noexiste', 1) === null);
check('el primero inexistente', model.comboTransfer('noexiste', 'buz', 1) === null);
check('un destino sin coordenadas', model.comboTransfer('buz', 'sao', 1) === null,
  'sao esta en DEST pero no tiene coordenada: no se puede cotizar el traslado');

console.log('\n6) El precio crece con la distancia');
{
  const corto = model.comboTransfer('rosa', 'ferrugem', 1);   // 6 km
  const medio = model.comboTransfer('fln', 'bombinhas', 1);  // 72 km
  const largo = model.comboTransfer('rec', 'joaopessoa', 1); // 151 km
  const enorme = model.comboTransfer('mcz', 'for', 1);       // 1045 km
  check('6 km sale menos que 72 km', corto.perPaxUsd < medio.perPaxUsd, corto.perPaxUsd + ' vs ' + medio.perPaxUsd);
  check('72 km sale menos que 151 km', medio.perPaxUsd < largo.perPaxUsd, medio.perPaxUsd + ' vs ' + largo.perPaxUsd);
  check('151 km sale menos que 1045 km', largo.perPaxUsd < enorme.perPaxUsd, largo.perPaxUsd + ' vs ' + enorme.perPaxUsd);
  check('el mas corto no es gratis', corto.perPaxUsd > 0, String(corto.perPaxUsd));
  check('ningun tramo pasa los 60 por persona', enorme.perPaxUsd <= 60, String(enorme.perPaxUsd));
}

console.log('\n7) La calibracion contra el caso que ya existia');
{
  // Antes eran 30 por pasajero, escritos a mano y sin ninguna formula detras.
  const t = model.comboTransfer('buz', 'arraial', 1);
  check('Búzios + Arraial queda cerca de los 30 de antes', Math.abs(t.perPaxUsd - 30) <= 8, 'queda en ' + t.perPaxUsd);
  check('con 1 persona el total es el precio por pasajero',
    t.totalUsd === t.perPaxUsd, t.totalUsd + ' vs ' + t.perPaxUsd);
  const dos = model.comboTransfer('buz', 'arraial', 2);
  check('con 2 personas el total es el doble', dos.totalUsd === t.perPaxUsd * 2, dos.totalUsd + ' vs ' + t.perPaxUsd * 2);
  check('el precio por pasajero no cambia con la cantidad', dos.perPaxUsd === t.perPaxUsd, dos.perPaxUsd + ' vs ' + t.perPaxUsd);
}

console.log('\n8) El ferry de Ilha Grande');
{
  const t = model.comboTransfer('angra', 'ilha', 1);
  check('Angra + Ilha Grande es ferry', t.mode === 'ferry', t.mode);
  check('el ferry no usa combustible', t.driveFuelUsd === null, String(t.driveFuelUsd));
  check('el ferry cuesta como un pasaje, no como un transfer', t.perPaxUsd < 20, String(t.perPaxUsd));
  check('el ferry tiene horas fijas de travesía', t.hours > 1 && t.hours <= 2, String(t.hours));
  check('funciona en las dos direcciones', model.comboTransfer('ilha', 'angra', 1).mode === 'ferry');
}

console.log('\n9) Los datos que devuelve el traslado');
{
  const t = model.comboTransfer('buz', 'arraial', 1);
  for (const campo of ['from', 'to', 'fromName', 'toName', 'mode', 'distanceKm', 'straightKm', 'hours',
    'perPaxUsd', 'totalUsd', 'driveFuelUsd', 'driveTollsUsd', 'driveTotalUsd', 'label', 'source']) {
    check('trae ' + campo, t[campo] !== undefined && t[campo] !== null, 'viene ' + t[campo]);
  }
  check('el recorrido es mas largo que la recta', t.distanceKm > t.straightKm, t.distanceKm + ' vs ' + t.straightKm);
  check('el nombre del traslado menciona los dos destinos',
    t.label.indexOf('Búzios') >= 0 && t.label.indexOf('Arraial') >= 0, t.label);
  check('el texto dice que es estimado', /estimado/.test(t.label), t.label);
}

console.log('\n10) Las coordenadas que usa esto estan verificadas');
{
  // Se comparan contra un par de referencia conocidos. No es una geocodificacion
  // completa, es una guarda contra que alguien ponga una coordenada de memoria.
  const C = model.DEST_COORDS;
  const cerca = (a, b, kmMax) => model.haversineKm(C[a], C[b]) <= kmMax;
  check('Recife y Porto de Galinhas quedan a menos de 70 km', cerca('rec', 'porto', 70), model.haversineKm(C.rec, C.porto) + ' km');
  check('Salvador y Praia do Forte quedan a mas de 55 km', !cerca('ssa', 'forte', 55), model.haversineKm(C.ssa, C.forte) + ' km');
  check('Natal y Pipa quedan a menos de 20 km', cerca('nat', 'pip', 20), model.haversineKm(C.nat, C.pip) + ' km');
  check('Maceio y Maragogi quedan entre 80 y 120 km', (() => { const d = model.haversineKm(C.mcz, C.maragogi); return d > 80 && d < 120; })(), model.haversineKm(C.mcz, C.maragogi) + ' km');
  check('Porto Seguro e Itacare quedan a mas de 200 km', !cerca('portoseguro', 'itacare', 200), model.haversineKm(C.portoseguro, C.itacare) + ' km');
  const sinCoordenadas = Object.keys(model.DEST).filter(k => !C[k]);
  check('sin coordenadas quedan solo los que no se combinan', sinCoordenadas.length <= 12,
    sinCoordenadas.length + ' sin coordenada: ' + sinCoordenadas.join(', '));
}

console.log('\n11) Las subcategorias que combinan apuntan a un segundo destino real');
{
  const subs = [...app.slice(desde, app.indexOf('\n  ];', desde)).matchAll(/secondKey: '([^']+)'/g)].map(m => m[1]);
  check('hay subcategorias que combinan', subs.length > 0, subs.length + ' encontradas');
  for (const s of subs) {
    check('secondKey ' + s + ' existe en DEST', !!model.DEST[s]);
    check('secondKey ' + s + ' es combinable con algo del mismo grupo',
      grupos.some(g => g.keys.includes(s) && g.keys.length > 1), s + ' esta en un grupo de ' +
      (grupos.find(g => g.keys.includes(s)) || { keys: [] }).keys.length + ' destinos');
  }
}

console.log(fallos.length
  ? '\n' + fallos.length + ' FALLOS:\n - ' + fallos.join('\n - ')
  : '\nTODO OK (' + 'los 86 pares cotizan, lo absurdo se rechaza, el precio escala' + ')');
process.exit(fallos.length ? 1 : 0);
