'use strict';
/*
 * Corrige a mano las coordenadas que el geocoder acerto mal, y avisa de las que
 * no se pueden usar.
 *
 * MOTIVO: la version anterior de generar-geo-destinos.js forzaba
 * countrycodes=br para TODOS los destinos, y con eso Buenos Aires (Argentina)
 * salio como "Buenos Aires, Pernambuco, Brasil". Un filtro de pais agregado no
 * sirve cuando el destino esta en otro pais: no acorta la busqueda, la
 * desvirtua. Ademas Ilha Grande y Angra dos Reis salieron con la misma
 * coordenada, que es imposible: son a 15 km, pero una de las dos quedo mal.
 *
 * Las correcciones van con su razon. La coordenada de un destino no es un dato
 * que se pueda regenerar sin revisarla: es la verdad contra la que se filtran
 * las fotos, y si esta mal el filtro deja pasar homonimos.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ARCHIVO = path.join(RAIZ, 'data', 'destinos-geo.json');

/* Correcciones. Cada una con el resultado que dio el geocoder y por que esta
   mal, para que quede el registro y no solo el numero. */
const CORRECCIONES = {
  bue: {
    lat: -34.6037, lon: -58.3816,
    porQue: 'Buenos Aires, ARGENTINA. El geocoder devolvio "Buenos Aires, Pernambuco, Brasil" porque el script forzaba countrycodes=br, y hay un Buenos Aires en Pernambuco. Es el unico destino fuera de Brasil del modelo.'
  },
  angra: {
    lat: -22.9628, lon: -44.1717,
    porQue: 'Angra dos Reis (la ciudad, en la entrada de la bahia). El geocoder devolvia exactamente la misma coordenada que Ilha Grande, a 22 km: no puede ser que dos pueblos distintos coincidan al centesimo.'
  },
  ilha: {
    lat: -23.1400, lon: -44.1200,
    porQue: 'Centro de Ilha Grande, dentro de la isla. El geocoder daba un punto 11 km al oeste, ya del otro lado del canal: con un radio de 30 km las fotos de Angra pasarian el filtro de Ilha Grande.'
  }
};

const doc = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
const d = doc.destinos;

console.log('=== correcciones aplicadas ===');
for (const [k, c] of Object.entries(CORRECCIONES)) {
  const antes = d[k];
  d[k] = Object.assign({}, antes, { lat: c.lat, lon: c.lon, corregido: true, correccion: c.porQue });
  console.log('  ' + k.padEnd(12) + (antes ? antes.lat + ',' + antes.lon : 'no estaba') + '  ->  ' + c.lat + ',' + c.lon);
  console.log('      ' + c.porQue);
}

/* Dos destinos con la misma coordenada significa que el geocoder fallo en uno de
   los dos, y que cualquier foto que pase un filtro pasara el del otro tambien. */
console.log('\n=== destinos que comparten coordenada (deberia ser 0) ===');
const porPunto = {};
for (const [k, v] of Object.entries(d)) {
  const clave = v.lat + ',' + v.lon;
  (porPunto[clave] = porPunto[clave] || []).push(k);
}
let duplicados = 0;
for (const [punto, ks] of Object.entries(porPunto)) {
  if (ks.length > 1) { duplicados++; console.log('  ' + punto + ' -> ' + ks.join(' = ')); }
}
if (!duplicados) console.log('  ninguno');

/* Un destino a menos de 8 km de otro no se puede separar por GPS: el radio
   minimo de verificacion esta en 25 km, asi que los dos aceptarian la misma
   foto. Se avisa para que la revision decida si van juntos. */
console.log('\n=== pares a menos de 25 km (no separables por GPS) ===');
const R = 6371, r = Math.PI / 180;
const dist = (a, b) => {
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const claves = Object.keys(d);
let cerca = 0;
for (let i = 0; i < claves.length; i++) {
  for (let j = i + 1; j < claves.length; j++) {
    const km = dist(d[claves[i]], d[claves[j]]);
    if (km < 25) { cerca++; console.log('  ' + claves[i] + ' <-> ' + claves[j] + ': ' + km.toFixed(1) + ' km'); }
  }
}
if (!cerca) console.log('  ninguno');

doc._meta.advertencias.push(
  'bue es Buenos Aires (Argentina) y NO esta en Brazil: el filtro countrycodes=br del geocoder lo traia a Pernambuco. Cualquier correccion al script tiene que tener en cuenta el pais por destino, no uno global.'
);
doc._meta.revisado = new Date().toISOString().slice(0, 10);
fs.writeFileSync(ARCHIVO, JSON.stringify(doc, null, 2), 'utf8');
console.log('\nescrito ' + path.relative(RAIZ, ARCHIVO) + ' con ' + Object.keys(d).length + ' destinos');
