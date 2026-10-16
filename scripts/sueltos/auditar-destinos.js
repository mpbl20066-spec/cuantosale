'use strict';
// Recorre TODOS los destinos contra /api/hoteles en produccion. Un destino esta
// bien solo si trae 3 hoteles con source=booking, los 3 con foto y los 3 con
// precio real. Reintenta ante 429 y aísla los fallos para no cortar la corrida.
const b64 = (s) => Buffer.from(s).toString('base64');
const auth = 'Basic ' + b64('admin:admin');
const origin = 'https://www.cuantosale.uy';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(path, intentos) {
  let ultimo = null;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(origin + path, { headers: { Authorization: auth, Accept: 'application/json' } });
      if (r.status === 429) { await sleep(12000); continue; }
      return { status: r.status, json: await r.json().catch(() => null) };
    } catch (e) { ultimo = 'red: ' + e.message; await sleep(1500); }
  }
  return { status: 0, json: null, err: ultimo || 'agotados los reintentos' };
}

async function revisar(k, estilo) {
  const url = '/api/hoteles?dest=' + k + '&dep=2026-11-10&ret=2026-11-15&pax=2&style=' + estilo + '&hotel_type=intermedio';
  const r = await get(url, 4);
  if (r.status !== 200) return { k, estilo, ok: false, motivo: r.status ? 'HTTP ' + r.status : (r.err || 'sin respuesta') };
  const h = r.json.hotels || [];
  const booking = h.filter(x => x.source === 'booking').length;
  const fotos = h.filter(x => x.image).length;
  const precios = h.filter(x => x.source === 'booking' && Number(x.perNight) > 0).length;
  return { k, estilo, ok: h.length === 3 && booking === 3 && fotos === 3 && precios === 3,
    n: h.length, booking, fotos, precios, real: r.json.bookingCount, err: r.json.bookingError || '' };
}

(async function () {
  const estilo = process.argv[2] || 'eq';
  const cat = await get('/api/destinos', 3);
  const keys = cat.json.map(d => d.key);
  console.log('destinos: ' + keys.length + '   estilo: ' + estilo + '\n');

  const lote = 6;
  const res = [];
  for (let i = 0; i < keys.length; i += lote) {
    const trozo = keys.slice(i, i + lote);
    const r = await Promise.all(trozo.map(k => revisar(k, estilo)));
    r.forEach(x => {
      res.push(x);
      if (x.ok) console.log('  ' + x.k.padEnd(12) + ' OK        booking=3 foto=3/3 precio=3  (llegaron ' + x.real + ')');
      else console.log('  ' + x.k.padEnd(12) + ' MAL       n=' + (x.n || 0) + ' booking=' + (x.booking || 0)
        + ' foto=' + (x.fotos || 0) + ' real=' + (x.real === undefined ? '?' : x.real)
        + (x.motivo ? '  ' + x.motivo : '') + (x.err ? '  err=' + x.err : ''));
    });
  }

  const ok = res.filter(x => x.ok);
  const mal = res.filter(x => !x.ok);
  console.log('\n================ RESUMEN (estilo ' + estilo + ') ================');
  console.log('BIEN: ' + ok.length + '/' + res.length);
  console.log('MAL:  ' + mal.length);
  mal.forEach(m => console.log('   ' + m.k + ': ' + (m.motivo || ('booking=' + m.booking + ' foto=' + m.fotos + '/3 real=' + m.real + (m.err ? ' err=' + m.err : '')))));
})();
