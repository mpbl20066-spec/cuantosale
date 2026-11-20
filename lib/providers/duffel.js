'use strict';
/*
 * Cliente de Duffel: vuelos, hoteles (Stays) y alquiler de autos (Cars).
 *
 * Variables: DUFFEL_TOKEN (duffel_test_... en pruebas, duffel_live_... en produccion).
 * Es solo la capa de red: no decide nada del negocio ni reemplaza a Ignav/Booking todavia. Se enciende pieza por pieza
 * (vuelos, hoteles, autos) desde el codigo que lo llame.
 *
 * Los autos (alquiler) son un producto NUEVO y no tienen que ver con el "auto propio / roadtrip" del modelo.
 * Ojo: el acceso a Duffel Cars se pide aparte a Duffel (duffel.com/contact-us); sin eso /cars/* responde error.
 */
const BASE = 'https://api.duffel.com';
const MAX_CONCURRENT = Number(process.env.DUFFEL_CONCURRENCY) || 6;

/* fetch inyectable: las pruebas lo reemplazan para no salir a la red. */
let fetchImpl = null;
function setFetch(fn) { fetchImpl = fn; }

/* Cola: como mucho MAX_CONCURRENT pedidos a la vez. La espera por turno va ANTES de arrancar el reloj de cada pedido,
   asi ninguno se corta por estar esperando. El calendario de fechas pide 11-15 puntos juntos. */
let activos = 0;
const cola = [];
function turno() {
  return new Promise(function (resolve) {
    function entrar() { activos++; resolve(); }
    if (activos < MAX_CONCURRENT) entrar(); else cola.push(entrar);
  });
}
function liberar() { activos--; const s = cola.shift(); if (s) s(); }

function token() { return String(process.env.DUFFEL_TOKEN || '').trim(); }
function configurado() { return !!token(); }
function modoPrueba() { return /^duffel_test_/.test(token()); }

async function llamar(metodo, ruta, cuerpo, opciones) {
  if (!configurado()) { const e = new Error('Falta DUFFEL_TOKEN.'); e.status = 503; throw e; }
  await turno();
  const ctl = new AbortController();
  const t = setTimeout(function () { ctl.abort(); }, (opciones && opciones.timeoutMs) || 30000);
  try {
    let r;
    try {
      r = await (fetchImpl || fetch)(BASE + ruta, {
        method: metodo,
        headers: {
          Authorization: 'Bearer ' + token(),
          'Duffel-Version': 'v2',
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: cuerpo ? JSON.stringify({ data: cuerpo }) : undefined,
        signal: ctl.signal
      });
    } catch (causa) {
      const corte = causa && (causa.name === 'AbortError' || causa.name === 'TimeoutError');
      const e = new Error(corte ? 'La búsqueda de vuelos demoró demasiado. Probá de nuevo.' : 'No se pudo conectar con el buscador de vuelos. Probá de nuevo en unos minutos.');
      e.status = corte ? 504 : 502;
      throw e;
    }
    const txt = await r.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : null; } catch (e) { /* respuesta no JSON */ }
    if (!r.ok) {
      const err = json && json.errors && json.errors[0];
      const e = new Error((err && (err.message || err.title)) || ('Duffel respondio ' + r.status));
      e.status = r.status === 429 ? 429 : (r.status >= 500 ? 502 : r.status);
      e.httpStatus = r.status;
      // 429 (limite), 401 (token malo) y 402 (sin saldo): el agregador frena un rato en vez de insistir.
      e.quotaExhausted = r.status === 429 || r.status === 402 || r.status === 401;
      e.codigo = err && err.code;
      e.tipo = err && err.type;
      throw e;
    }
    return json && json.data !== undefined ? json.data : json;
  } finally { clearTimeout(t); liberar(); }
}

/* ---- Vuelos ----
   pasajeros: cantidad de adultos. Devuelve las ofertas tal cual, ordenadas por precio. */
async function buscarVuelos(p) {
  const slices = [{ origin: p.origen, destination: p.destino, departure_date: p.ida }];
  if (p.vuelta) slices.push({ origin: p.destino, destination: p.origen, departure_date: p.vuelta });
  const pasajeros = [];
  for (let i = 0; i < (p.adultos || 1); i++) pasajeros.push({ type: 'adult' });
  const d = await llamar('POST', '/air/offer_requests?return_offers=true', {
    slices: slices, passengers: pasajeros, cabin_class: p.cabina || 'economy'
  }, { timeoutMs: 45000 });
  const ofertas = (d.offers || []).slice().sort(function (a, b) { return Number(a.total_amount) - Number(b.total_amount); });
  return { id: d.id, ofertas: ofertas };
}

/* ---- Hoteles (Stays) ----
   Busca por coordenadas y radio (km). */
async function buscarHoteles(p) {
  const cuartos = p.cuartos || 1;
  const huespedes = [];
  for (let i = 0; i < (p.adultos || 2); i++) huespedes.push({ type: 'adult' });
  return llamar('POST', '/stays/search', {
    rooms: cuartos,
    location: { radius: p.radioKm || 10, geographic_coordinates: { latitude: p.lat, longitude: p.lon } },
    check_in_date: p.entrada,
    check_out_date: p.salida,
    guests: huespedes
  }, { timeoutMs: 45000 });
}

/* ---- Autos (alquiler) ----
   Busca por coordenadas y radio. El conductor necesita edad (el dia de retiro) y pais de residencia. */
async function buscarAutos(p) {
  const lugar = function (lat, lon) { return { radius: p.radio || 5, geographic_coordinates: { latitude: lat, longitude: lon } }; };
  const d = await llamar('POST', '/cars/search', {
    pickup_date: p.retiroFecha, pickup_time: p.retiroHora || '10:00',
    dropoff_date: p.devolucionFecha, dropoff_time: p.devolucionHora || '10:00',
    pickup_location: lugar(p.lat, p.lon),
    dropoff_location: lugar(p.devolucionLat != null ? p.devolucionLat : p.lat, p.devolucionLon != null ? p.devolucionLon : p.lon),
    driver: { age: p.edad || 30, residence_country_code: p.paisResidencia || 'UY' }
  }, { timeoutMs: 45000 });
  const tarifas = (d.rates || []).slice().sort(function (a, b) { return Number(a.total_amount) - Number(b.total_amount); });
  return { id: d.id, tarifas: tarifas };
}

module.exports = { setFetch: setFetch, configurado: configurado, modoPrueba: modoPrueba, llamar: llamar, buscarVuelos: buscarVuelos, buscarHoteles: buscarHoteles, buscarAutos: buscarAutos };
