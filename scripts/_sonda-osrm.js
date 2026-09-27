'use strict';
// Sonda de diagnostico: OSRM contra rutas con distancia conocida, para ver si el
// servidor publico sigue sirviendo la red real o algo degenerado.
const RUTAS = [
  { nombre: 'Sao Paulo centro -> Rio centro', a: { lng: -46.6333, lat: -23.5505 }, b: { lng: -43.1729, lat: -22.9068 }, real: 430 },
  { nombre: 'Rio centro -> Buzios', a: { lng: -43.1729, lat: -22.9068 }, b: { lng: -41.9455, lat: -22.7759 }, real: 150 },
  { nombre: 'Fortaleza aero -> Fortaleza centro', a: { lng: -38.532222, lat: -3.775833 }, b: { lng: -38.5267, lat: -3.7319 }, real: 12 },
  { nombre: 'GIG -> Rio centro', a: { lng: -43.250557, lat: -22.809999 }, b: { lng: -43.1729, lat: -22.9068 }, real: 24 },
  { nombre: 'Florianopolis aero -> centro', a: { lng: -48.552502, lat: -27.670279 }, b: { lng: -48.548, lat: -27.5954 }, real: 12 }
];

(async function () {
  for (const r of RUTAS) {
    const url = 'https://router.project-osrm.org/route/v1/driving/' + r.a.lng + ',' + r.a.lat + ';' + r.b.lng + ',' + r.b.lat + '?overview=false';
    try {
      const res = await fetch(url);
      const j = await res.json();
      const rt = j.routes && j.routes[0];
      console.log(r.nombre.padEnd(40) + ' http ' + res.status + ' code=' + j.code +
        ' km=' + (rt ? Math.round(rt.distance / 1000) : '?') +
        ' (' + (rt ? Math.round(rt.duration / 60) : '?') + ' min)' +
        '  real~' + r.real + ' km');
      if (j.message) console.log('    message: ' + j.message);
    } catch (e) { console.log(r.nombre.padEnd(40) + ' fallo: ' + e.message); }
    await new Promise((x) => setTimeout(x, 400));
  }
})();
