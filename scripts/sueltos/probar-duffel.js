'use strict';
/* Prueba de cobertura de Duffel: vuelos, hoteles y autos para los destinos que vende CuantoSale.
   No toca la app ni gasta nada: solo busca y cuenta resultados.
   Uso:  node scripts/sueltos/probar-duffel.js            (todos los destinos)
         node scripts/sueltos/probar-duffel.js fln        (uno) */
const fs = require('fs');
const path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8').split(/\r?\n/).forEach(function (l) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* sin .env */ }
const duffel = require('../../lib/providers/duffel');

const DESTINOS = {
  fln: { nombre: 'Florianopolis', iata: 'FLN', lat: -27.5954, lon: -48.5480 },
  bzz: { nombre: 'Buzios (Cabo Frio)', iata: 'CFB', lat: -22.7469, lon: -41.8817 },
  rio: { nombre: 'Rio de Janeiro', iata: 'GIG', lat: -22.9068, lon: -43.1729 },
  pgl: { nombre: 'Porto de Galinhas (Recife)', iata: 'REC', lat: -8.5063, lon: -35.0016 },
  ssa: { nombre: 'Salvador', iata: 'SSA', lat: -12.9714, lon: -38.5014 }
};

function sumar(dias) { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
async function intento(nombre, fn) {
  try { return await fn(); } catch (e) { console.log('   ' + nombre + ': ERROR ' + (e.status || '') + ' ' + e.message + (e.codigo ? ' [' + e.codigo + ']' : '')); return null; }
}

(async function () {
  if (!duffel.configurado()) { console.log('Falta DUFFEL_TOKEN en .env'); process.exit(1); }
  console.log('Modo: ' + (duffel.modoPrueba() ? 'PRUEBA (test)' : 'PRODUCCION (live)'));
  const pedido = process.argv[2];
  const claves = pedido ? [pedido] : Object.keys(DESTINOS);
  const ida = sumar(60), vuelta = sumar(67);
  for (const k of claves) {
    const d = DESTINOS[k];
    if (!d) { console.log('Destino desconocido: ' + k); continue; }
    console.log('\n== ' + d.nombre + '  (' + ida + ' -> ' + vuelta + ')');

    const v = await intento('Vuelos', function () { return duffel.buscarVuelos({ origen: 'MVD', destino: d.iata, ida: ida, vuelta: vuelta, adultos: 2 }); });
    if (v) console.log('   Vuelos MVD-' + d.iata + ': ' + v.ofertas.length + ' ofertas' + (v.ofertas[0] ? ', la mas barata ' + v.ofertas[0].total_amount + ' ' + v.ofertas[0].total_currency : ''));

    const h = await intento('Hoteles', function () { return duffel.buscarHoteles({ lat: d.lat, lon: d.lon, entrada: ida, salida: vuelta, adultos: 2 }); });
    if (h) { const r = h.results || h.accommodations || []; console.log('   Hoteles: ' + r.length + ' resultados'); }

    const a = await intento('Autos', function () { return duffel.buscarAutos({ lat: d.lat, lon: d.lon, retiroFecha: ida, devolucionFecha: vuelta, edad: 30, paisResidencia: 'UY' }); });
    if (a) console.log('   Autos: ' + a.tarifas.length + ' tarifas' + (a.tarifas[0] ? ', la mas barata ' + a.tarifas[0].total_amount + ' ' + a.tarifas[0].total_currency + ' (' + (a.tarifas[0].car && a.tarifas[0].car.name) + ')' : ''));
  }
})();
