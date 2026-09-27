'use strict';
// Geocodifica con Nominatim los 4 destinos que no estan en DEST_COORDS.
// El repo ya usa Nominatim como metodo ("Verificadas contra Nominatim" en el
// comentario de DEST_COORDS), asi que se sigue el mismo criterio: centro de la
// localidad, no un punto turistico.
const model = require('../lib/model.js');

const FALTAN = {
  sao: 'Sao Paulo, SP, Brazil',
  bho: 'Belo Horizonte, MG, Brazil',
  curitiba: 'Curitiba, PR, Brazil',
  jericoacoara: 'Jericoacoara, CE, Brazil'
};

(async function () {
  const faltan = Object.keys(model.DEST).filter((k) => !model.DEST_COORDS[k]);
  console.log('DEST sin coordenada: ' + faltan.length + ' -> ' + faltan.join(' ') + '\n');
  for (const k of faltan) {
    const q = FALTAN[k];
    if (!q) { console.log('  ' + k + ': sin consulta preparada'); continue; }
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
    const r = await fetch(url, { headers: { 'User-Agent': 'cuantosale-costos/1.0 (tabla de precios de transfer)' } });
    const j = await r.json();
    if (!j.length) { console.log('  ' + k + ': Nominatim no devolvio nada para "' + q + '"'); continue; }
    const c = j[0];
    console.log('  ' + k.padEnd(13) + '{ lat: ' + c.lat + ', lng: ' + c.lon + ' },  // ' + c.display_name.slice(0, 70));
    await new Promise((x) => setTimeout(x, 1100));
  }
})();
