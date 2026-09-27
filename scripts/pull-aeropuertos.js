'use strict';
/*
 * Saca las coordenadas de los 15 aeropuertos de llegada desde OurAirports.
 *
 * Por que OurAirports y no Wikipedia a mano: son 15 pares de numeros y alguno
 * equivocado se propaga a los 44 destinos que cuelgan de ese aeropuerto. La base
 * es de dominio publico y esta versionada, asi que el numero se puede volver a
 * verificar en cualquier momento.
 *
 * Idempotente: solo imprime. No escribe archivos.
 */
const fs = require('fs');
const path = require('path');

// Los 15 que salen de AIR_DESTINATIONS (server.js). Si se agrega un destino con
// un aeropuerto nuevo, hay que sumarlo aca: el script avisa si falta.
const IATA = ['EZE', 'GIG', 'GRU', 'CNF', 'CWB', 'REC', 'MCZ', 'NAT', 'SSA',
  'FOR', 'NVT', 'FLN', 'POA', 'IGU', 'JPA'];

const CACHE = path.join(__dirname, '..', '.ourairports-cache.csv');

function srcAirport() {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const m = server.match(/const AIR_DESTINATIONS = \{([^}]*)\}/);
  if (!m) throw new Error('no se pudo leer AIR_DESTINATIONS de server.js');
  return [...m[1].matchAll(/(\w+):\s*'([A-Z]{3})'/g)].map((x) => ({ key: x[1], iata: x[2] }));
}

(async function () {
  let csv;
  if (fs.existsSync(CACHE)) {
    csv = fs.readFileSync(CACHE, 'utf8');
  } else {
    console.log('descargando OurAirports...');
    const r = await fetch('https://ourairports.com/data/airports.csv');
    if (!r.ok) throw new Error('OurAirports respondio ' + r.status);
    csv = await r.text();
    fs.writeFileSync(CACHE, csv, 'utf8');
  }

  // El CSV de OurAirports viene con los nombres de columna entre comillas
  // ("name", no name), y con valores que pueden traer comas adentro. Partir la
  // linea con split(',') no sirve: ademas de que indexOf('name') daba -1, un
  // nombre con comacorreria todas las columnas siguientes. Parser minimo que
  // respeta las comas, que es lo unico que hay que hacer con esto.
  function lineaCsv(linea) {
    const out = [];
    let campo = '', dentro = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (dentro) {
        if (ch === '"') { if (linea[i + 1] === '"') { campo += '"'; i++; } else dentro = false; }
        else campo += ch;
      } else if (ch === '"') dentro = true;
      else if (ch === ',') { out.push(campo); campo = ''; }
      else campo += ch;
    }
    out.push(campo);
    return out;
  }

  const lines = csv.split(/\r?\n/);
  const head = lineaCsv(lines[0]).map((h) => h.trim());
  const ix = (n) => head.indexOf(n);
  const iIata = ix('iata_code'), iName = ix('name'), iMun = ix('municipality');
  const iLat = ix('latitude_deg'), iLon = ix('longitude_deg');
  const iPais = ix('iso_country');
  for (const [n, i] of Object.entries({ iata_code: iIata, name: iName, municipality: iMun, latitude_deg: iLat, longitude_deg: iLon }))
    if (i < 0) throw new Error('la columna ' + n + ' no esta en el header de OurAirports');

  const porCodigo = new Map();
  for (const line of lines.slice(1)) {
    // Las lineas se parten con lineaCsv(), no con split(','): ver el comentario
    // de arriba. Un nombre de aeropuerto con coma partia todas las columnas.
    if (!line) continue;
    const c = lineaCsv(line);
    const code = (c[iIata] || '').trim().toUpperCase();
    if (!code || porCodigo.has(code)) continue;
    const lat = parseFloat(c[iLat]), lon = parseFloat(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    porCodigo.set(code, { iata: code, name: c[iName], mun: c[iMun], pais: c[iPais], lat, lon });
  }

  const usados = [...new Set(srcAirport().map((d) => d.iata))];
  const faltan = usados.filter((c) => !porCodigo.has(c));
  const sobran = IATA.filter((c) => !usados.includes(c));

  console.log('aeropuertos en uso: ' + usados.length);
  if (faltan.length) console.log('  FALTAN en OurAirports: ' + faltan.join(' '));
  if (sobran.length) console.log('  sobra en la lista del script: ' + sobran.join(' '));
  console.log('');

  for (const code of usados) {
    const a = porCodigo.get(code);
    if (!a) { console.log(code + '  SIN DATOS'); continue; }
    const destinos = srcAirport().filter((d) => d.iata === code).map((d) => d.key);
    console.log('  ' + code + ': { lat: ' + a.lat + ', lng: ' + a.lon + ' },  // ' +
      a.mun + ' - ' + a.name + '  [' + destinos.length + ' destinos: ' + destinos.join(' ') + ']');
  }
})().catch((e) => { console.error('fallo: ' + e.message); process.exit(1); });
