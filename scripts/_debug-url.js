'use strict';
// Reproduce una sola ruta tal cual la arma pull-distancias.js, imprimiendo la URL
// exacta, para ver por difiere de la sonda.
const model = require('../lib/model.js');

const AEROPUERTO_COORD = {
  EZE: { lat: -34.8222, lng: -58.5358 }, GIG: { lat: -22.809999, lng: -43.250557 },
  FOR: { lat: -3.775833, lng: -38.532222 }
};

(async function () {
  for (const [k, iata] of [['bue', 'EZE'], ['for', 'FOR'], ['rio', 'GIG']]) {
    const a = AEROPUERTO_COORD[iata], b = model.DEST_COORDS[k];
    const url = 'https://router.project-osrm.org/route/v1/driving/' + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=false';
    const res = await fetch(url);
    const j = await res.json();
    const rt = j.routes && j.routes[0];
    console.log(k + ' (' + iata + ')');
    console.log('  url: ' + url);
    console.log('  a=' + JSON.stringify(a) + '  b=' + JSON.stringify(b));
    console.log('  code=' + j.code + ' km=' + (rt ? Math.round(rt.distance / 1000) : '?') +
      '  geoms=' + (j.routes ? j.routes.length : 0));
    await new Promise((x) => setTimeout(x, 500));
  }
})();
