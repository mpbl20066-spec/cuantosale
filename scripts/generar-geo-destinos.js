'use strict';
/*
 * Genera data/destinos-geo.json: la coordenada REAL de cada destino.
 *
 * POR QUE HACE FALTA. Para verificar una foto hay que saber donde esta el
 * lugar, y esa verdad tiene que venir de AFUERA del conjunto que se verifica.
 * La primera version de la herramienta calculaba el centro del pueblo con la
 * mediana del GPS de los propios archivos candidatos, y por eso aprobo
 * Category:Trancoso, que es el Trancoso de PORTUGAL: la mayoria de los archivos
 * de esa categoria tienen GPS, y todos estan en Portugal, asi que la mediana
 * daba 40.7,-7.4 y todo pasaba el filtro a 0 km. Un check que se valida a si
 * mismo no es un check.
 *
 * Con la coordenada de Nominatim el filtro es contra una verdad externa: los
 * archivos de Portugal quedan a 2.500 km y se descartan solos.
 *
 * Nominatim pide 1 consulta por segundo, de ahi el delay. Se genera una vez y el
 * JSON queda commiteado: no se vuelve a pegarle al servicio.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const RAIZ = path.join(__dirname, '..');
const UA = { 'User-Agent': 'cuantosale-tour-photos/1.0 (coordenadas de destinos)' };
const SALIDA = path.join(RAIZ, 'data', 'destinos-geo.json');

// Los nombres salen del modelo, que es la fuente de verdad de los destinos.
const model = fs.readFileSync(path.join(RAIZ, 'lib', 'model.js'), 'utf8');
const destinos = {};
for (const m of model.matchAll(/^\s{2}(\w+):\s*\{\s*name:\s*'([^']+)'.*?region:\s*'([^']+)'/gm)) {
  destinos[m[1]] = { name: m[2], region: m[3] };
}

const espera = (ms) => new Promise(r => setTimeout(r, ms));

async function geocodear(sinEspacios) {
  const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' +
    encodeURIComponent(sinEspacios);
  const r = await fetch(u, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.length) return null;
  return { lat: Number(j[0].lat), lon: Number(j[0].lon), pantalla: j[0].display_name };
}

(async function main() {
  const salida = {};
  const problemas = [];
  const claves = Object.keys(destinos);

  for (const k of claves) {
    const d = destinos[k];
    // Se fuerza countrycodes=br: si el nombre existe en otro pais, el filtro
    // de pais lo saca antes de devolver algo.
    const g = await geocodear(d.name + ', ' + d.region + ', Brazil');
    if (!g || !isFinite(g.lat) || Math.abs(g.lat) > 34) {
      problemas.push(k + ' (' + d.name + '): sin coordenada en Brasil');
      console.log('  -- ' + k.padEnd(13) + d.name.padEnd(26) + ' SIN COORDENADA');
    } else {
      salida[k] = { name: d.name, region: d.region, lat: +g.lat.toFixed(5), lon: +g.lon.toFixed(5) };
      console.log('  ok ' + k.padEnd(13) + d.name.padEnd(26) + g.lat.toFixed(4) + ',' + g.lon.toFixed(4) + '   ' + g.pantalla.slice(0, 46));
    }
    await espera(1100);
  }

  const doc = {
    _meta: {
      descripcion: 'Coordenada de cada destino, para verificar que una foto sea de ese lugar y no de un homonimo.',
      para_que_no_se_calcula: 'La primera version de la herramienta的地区 centro se media con los GPS de los propios candidatos, y por eso aprobo el Trancoso de Portugal. El centro tiene que ser una verdad externa a lo que se verifica.',
      fuente: 'OpenStreetMap via Nominatim (geocoding), filtrado con countrycodes=br.',
      generado: new Date().toISOString().slice(0, 10),
      advertencias: [
        'Un radio de 30 km acepta Nearby si el destino tiene una laguna o不是一个 un pueblo. Con radios menores aparecen los homonimos de barrio.',
        'Toda coordenada tiene que revisarse a mano una vez. Un geocoder devuelve el pueblo mas conocido con ese nombre, no el que esta en la lista de destinos.'
      ]
    },
    destinos: salida
  };
  fs.writeFileSync(path.join(RAIZ, 'data', 'destinos-geo.json'), JSON.stringify(doc, null, 2), 'utf8');
  console.log('\nescrito data/destinos-geo.json con ' + Object.keys(salida).length + ' destinos');
  if (problemas.length) { console.log('\nSIN COORDENADA (' + problemas.length + '):'); problemas.forEach(p => console.log('  ' + p)); }
})();
