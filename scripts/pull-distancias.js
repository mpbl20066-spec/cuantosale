'use strict';
/*
 * Kilómetros REALES de carretera desde el aeropuerto de llegada hasta cada
 * destino, con OSRM (https://router.project-osrm.org, perfil auto).
 *
 * Por que OSRM y no haversine: el repositorio ya lo decidio asi para
 * ROADTRIP_ROUTES, con el argumento de que una ruta por carretera nunca es mas
 * corta que la linea recta y que estimar a ojo ya metio errores de 70 a 150 km.
 * El precio de un transfer es proporcional a los km, asi que el km tiene que ser
 * el de la ruta y no el de la linea recta.
 *
 * Se cachea en data/distancias-aeropuerto.json: OSRM es un servicio publico
 * gratuito, y pegarle 44 veces cada vez que se corre el script es abuso. Para
 * rehacerlo, borrar el cache.
 *
 * Dos destinos no son un traslado por carretera y el script lo dice, en vez de
 * devolver un numero imposible:
 *   - ilha:    Ilha Grande no tiene carretera. Se llega en barco desde Rio o
 *              Angra. El modelo ya lo sabe (COMBO_FERRY_ONLY en lib/model.js).
 *   - fernando: Fernando de Noronha es una isla a 350 km de la costa. No hay
 *              puente ni ferry comercial desde el continente: se llega en un
 *              vuelo corto desde REC. Es el unico destino del catalogo que
 *              necesita un AVIo, no una van.
 */
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RAIZ = path.join(__dirname, '..');
const CACHE = path.join(RAIZ, 'data', 'distancias-aeropuerto.json');
const SERVER = fs.readFileSync(path.join(RAIZ, 'server.js'), 'utf8');
const CLIENTE = fs.existsSync(path.join(RAIZ, 'public', 'transfer-precios.js'))
  ? fs.readFileSync(path.join(RAIZ, 'public', 'transfer-precios.js'), 'utf8') : '';

function airportDe(key) {
  const m = SERVER.match(/const AIR_DESTINATIONS = \{([^}]*)\}/);
  const hit = m && m[1].match(new RegExp('\\b' + key + ":\\s*'([A-Z]{3})'"));
  return hit ? hit[1] : null;
}
// Coordenadas de aeropuerto: las que imprime scripts/pull-aeropuertos.js. Van
// aca embebidas y no en un require porque todavia no viven en ningun archivo de
// datos; cuando se escriban data/transfer-precios.json pasan a leerse de alla.
const AEROPUERTO_COORD = {
  EZE: { lat: -34.8222, lng: -58.5358 }, GIG: { lat: -22.809999, lng: -43.250557 },
  GRU: { lat: -23.431274, lng: -46.469954 }, CNF: { lat: -19.63571, lng: -43.966928 },
  CWB: { lat: -25.5285, lng: -49.1758 }, REC: { lat: -8.12747, lng: -34.922961 },
  MCZ: { lat: -9.512559, lng: -35.791839 }, NAT: { lat: -5.769822, lng: -35.36661 },
  SSA: { lat: -12.908611, lng: -38.322498 }, FOR: { lat: -3.775833, lng: -38.532222 },
  NVT: { lat: -26.879431, lng: -48.650979 }, FLN: { lat: -27.670279, lng: -48.552502 },
  POA: { lat: -29.993984, lng: -51.167482 }, IGU: { lat: -25.594167, lng: -54.489444 },
  JPA: { lat: -7.148691, lng: -34.950554 }, FEN: { lat: -3.854534, lng: -32.423017 }
};

// Fernando de Noronha no se busca desde NVT: NVT es Navegantes, en Santa
// Catarina, a 2.900 km de la isla. AIR_DESTINATIONS dice NVT (server.js:148) y
// esta equivocado; el codigo de la isla es FEN. Se pisa aca para que las
// distancias sean correctas, y el bug se reporta aparte.
const IATA_CORREGIDO = { fernando: 'FEN' };

const SIN_CARRETERA = {
  ilha: { modo: 'ferry', nota: 'Sin carretera: se llega en barco desde Rio o Angra (90 min por la bahia).' },
  fernando: { modo: 'vuelo', nota: 'Isla a 350 km de la costa: se llega en vuelo corto desde REC, no en van.' }
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function rutaOsrm(a, b) {
  const url = 'https://router.project-osrm.org/route/v1/driving/' +
    a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=false';
  const r = await fetch(url);
  if (!r.ok) throw new Error('OSRM ' + r.status);
  const j = await r.json();
  if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('OSRM ' + j.code);
  return { km: Math.round(j.routes[0].distance / 1000), horas: Math.round(j.routes[0].duration / 360) / 10 };
}

(async function () {
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const claves = Object.keys(model.DEST);
  const salida = {};

  for (const k of claves) {
    const iata = IATA_CORREGIDO[k] || airportDe(k);
    const nombre = model.DEST[k].name;
    if (SIN_CARRETERA[k]) {
      salida[k] = Object.assign({ iata, modo: SIN_CARRETERA[k].modo, nota: SIN_CARRETERA[k].nota }, cache[k] && cache[k].km ? { km: cache[k].km } : {});
      console.log('  ' + k.padEnd(13) + ' ' + String(iata).padEnd(4) + ' ' + SIN_CARRETERA[k].modo.toUpperCase() + '  (sin carretera)');
      continue;
    }
    const b = model.DEST_COORDS[k];
    if (!b) { console.log('  ' + k.padEnd(13) + ' SIN COORDENADAS en DEST_COORDS'); continue; }
    const ck = k + '|' + iata;
    if (cache[ck] && cache[ck].km) { salida[k] = Object.assign({ iata, modo: 'car' }, cache[ck]); }
    else {
      try {
        const r = await rutaOsrm(AEROPUERTO_COORD[iata], b);
        const recto = model.haversineKm(AEROPUERTO_COORD[iata], b);
        // Una ruta por carretera nunca es mas corta que la linea recta, y
        // rarely pasa de 2x. Esta guarda existe porque el script una vez dividio
        // metros por 100 en vez de por 1000 y devolvio 320 km para un tramo que
        // son 32: todos los precios salieron 10x sin que nada se quejara. Un
        // numero de ruta que no pasa esto no es un dato, es un error.
        if (!(r.km >= recto)) throw new Error('ruta ' + r.km + ' km menor que la linea recta ' + recto + ' km');
        if (r.km > recto * 2.5) throw new Error('ruta ' + r.km + ' km contra ' + recto + ' km de linea recta: sinuosidad sospechosa');
        cache[ck] = { km: r.km, horas: r.horas, lineaRecta: recto };
        salida[k] = Object.assign({ iata, modo: 'car' }, cache[ck]);
        await dormir(350);
      } catch (e) {
        console.log('  ' + k.padEnd(13) + ' ' + String(iata).padEnd(4) + ' FALLO: ' + e.message);
        continue;
      }
    }
    const s = salida[k];
    console.log('  ' + k.padEnd(13) + ' ' + String(iata).padEnd(4) +
      String(s.km).padStart(5) + ' km  ' + String(s.horas).padStart(5) + ' h  (recta ' + s.lineaRecta + ' km, x' + (s.km / s.lineaRecta).toFixed(2) + ')');
  }

  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  console.log('\ncache: ' + Object.keys(cache).length + ' rutas | ' + CLIENTE);
})().catch((e) => { console.error('fallo: ' + e.message); process.exit(1); });
