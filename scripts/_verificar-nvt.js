'use strict';
// Verificacion puntual: NVT y FEN en OurAirports, y todos los aeropuertos de
// Pernambuco con servicio programado. Es para confirmar si el codigo de
// AIR_DESTINATIONS para 'fernando' apunta a la isla o al continente.
const fs = require('fs');
const path = require('path');
const csv = fs.readFileSync(path.join(__dirname, '..', '.ourairports-cache.csv'), 'utf8');

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
const C = { iata: ix('iata_code'), nombre: ix('name'), mun: ix('municipality'), pais: ix('iso_country'), lat: ix('latitude_deg'), lon: ix('longitude_deg'), srv: ix('scheduled_service'), region: ix('iso_region') };
const rows = lines.slice(1).filter(Boolean).map((l) => lineaCsv(l));

console.log('--- IATA NVT, IATA FEN, y todo lo que mencione Fernando ---');
for (const c of rows) {
  const iata = (c[C.iata] || '').trim();
  const texto = (c[C.nombre] || '') + ' ' + (c[C.mun] || '');
  if (iata === 'NVT' || iata === 'FEN' || /Fernando/i.test(texto)) {
    console.log('  ' + (iata || '---').padEnd(5) + ' ' + (c[C.pais] || '').padEnd(4) +
      (c[C.region] || '').padEnd(6) + ' ' + String(c[C.mun]).padEnd(20) +
      ' | ' + c[C.nombre] + ' | servicio=' + (c[C.srv] || '').trim() +
      ' | ' + c[C.lat] + ',' + c[C.lon]);
  }
}

console.log('\n--- Pernambuco (BR-PE) con servicio programado ---');
for (const c of rows) {
  if ((c[C.pais] || '').trim() !== 'BR' || (c[C.region] || '').trim() !== 'PE') continue;
  if ((c[C.srv] || '').trim() !== 'yes') continue;
  console.log('  ' + ((c[C.iata] || '').trim() || '---').padEnd(5) + String(c[C.mun]).padEnd(22) + c[C.nombre]);
}
