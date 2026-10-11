'use strict';
/* Precio del seguro de viaje (Protege tu Viaje, API del Centro de Aliados: b2b2c.protegetuviaje.com/backend/api-docs).
   GET /api/seguro?ida=YYYY-MM-DD&vuelta=YYYY-MM-DD&pax=2&ninos=0  ->  { ok, desde, plan, planes: [{ nombre, total }] }
   Las credenciales (PROTEGE_API_KEY y PROTEGE_API_SECRET) quedan en el servidor. Cada consulta crea una cotizacion en
   la cuenta de aliado, por eso el resultado se guarda 12 h por fechas y personas. */
const BASE = 'https://b2b2c.protegetuviaje.com/backend';
const DOCE_HORAS = 12 * 3600 * 1000;
const cache = new Map();
let tipoProducto = null;   // id de "Seguro Viaje Puntual", de /api/quotes/data

module.exports = function (h) {
  function cred() {
    return { key: String(process.env.PROTEGE_API_KEY || '').trim(), secret: String(process.env.PROTEGE_API_SECRET || '').trim() };
  }
  async function api(metodo, camino, cuerpo) {
    const c = cred();
    const r = await h.fetchWithTimeout(BASE + camino, {
      method: metodo,
      headers: Object.assign({ 'x-api-key': c.key, 'x-api-secret': c.secret, Accept: 'application/json' }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    }, 15000);
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) { const e = new Error('Protege tu Viaje: ' + (j.error || j.message || 'HTTP ' + r.status)); e.status = r.status === 401 ? 503 : 502; throw e; }
    return j;
  }
  async function producto() {
    if (tipoProducto) return tipoProducto;
    const d = await api('GET', '/api/quotes/data');
    const tipos = d.productTypes || [];
    const p = tipos.filter(function (t) { return /puntual/i.test(t.name || ''); })[0] || tipos[0];
    if (!p) throw new Error('Protege tu Viaje no devolvio tipos de seguro.');
    tipoProducto = String(p.id);
    return tipoProducto;
  }
  const fecha = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : ''; };

  async function precio(req, res, url) {
    const c = cred();
    if (!c.key || !c.secret) return h.sendJson(res, 503, { error: 'Falta configurar PROTEGE_API_KEY y PROTEGE_API_SECRET.' });
    const q = url.searchParams, ida = fecha(q.get('ida')), vuelta = fecha(q.get('vuelta'));
    const pax = Math.max(1, Math.min(9, parseInt(q.get('pax'), 10) || 1)), ninos = Math.max(0, Math.min(pax - 1, parseInt(q.get('ninos'), 10) || 0));
    const destino = /^[A-Z]{2}$/.test(String(q.get('pais') || '')) ? q.get('pais') : 'BR';
    if (!ida || !vuelta || vuelta < ida) return h.sendJson(res, 400, { error: 'Fechas invalidas.' });
    const clave = [ida, vuelta, pax, ninos, destino].join('|'), hay = cache.get(clave);
    if (hay && Date.now() - hay.t < DOCE_HORAS) return h.sendJson(res, 200, hay.v);
    if (h.limited('seguro:' + h.clientIp(req))) return h.sendJson(res, 429, { error: 'Demasiadas consultas seguidas.' });
    /* Edades de referencia: 30 para adultos y 8 para niños (el precio cambia por rango de edad, no por año). */
    const edades = [];
    for (let i = 0; i < pax; i++) edades.push(i < pax - ninos ? 30 : 8);
    const cot = await api('POST', '/api/quotes/new', {
      date_from: ida, date_to: vuelta, origin: 'UY', destinations: [destino], passengers: edades,
      product_type: await producto(), email: String(process.env.PROTEGE_EMAIL || 'reservas@cuantosale.uy'), coin: 'USD'
    });
    const planes = (cot.plans || []).map(function (p) {
      const t = p.prices && p.prices.total;
      return { nombre: String(p.name || '').replace(/\.$/, ''), nivel: p.level, total: t ? Math.round(Number(t.amount_base_coin) * 100) / 100 : null };
    }).filter(function (p) { return p.total > 0; }).sort(function (a, b) { return a.total - b.total; });
    const v = planes.length ? { ok: true, desde: planes[0].total, plan: planes[0].nombre, planes: planes } : { ok: false, error: 'Sin planes para estas fechas.' };
    cache.set(clave, { t: Date.now(), v: v });
    if (cache.size > 2000) cache.clear();
    return h.sendJson(res, 200, v);
  }
  return { precio: precio };
};
