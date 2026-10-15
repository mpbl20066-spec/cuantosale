'use strict';
/* Seccion Marketing del panel /admin: guarda lo que se va marcando del plan (tareas hechas), los numeros de cada semana
   que se cargan a mano (Instagram, TikTok, anuncios, creadores) y las notas de la revision semanal.

   El plan en si (estrategia, calendario, mensajes) es contenido fijo: public/admin/marketing-datos.js.
   Esto guarda solo el estado, en una fila de operaciones_config (clave 'marketing', valor jsonb), que ya existe
   (supabase_operaciones.sql): no hace falta crear tablas. lib/operaciones.js lee esa tabla pero solo usa sus claves.

   GET  /api/admin/marketing          -> { estado, almacenamiento }
   POST /api/admin/marketing/guardar  { hecho: { id, valor } } | { semana: { id, campos } } | { nota: { id, texto } }
                                      | { contacto: { id, campos } } | { pago: { id, monto, fecha, nota } }
                                      | { pagoBorrar: { id, n } } | { asignar: { pedido, creador } }

   contactos = la lista de seguimiento de prensa, creadores y alianzas (Marketing > Contactos). Los medios que trae
   el plan vienen de marketing-datos.js; aca se guarda solo lo que se cambio de cada uno (y los contactos nuevos).

   Creadores socios (Marketing > Creadores, public/admin/creadores.js): el que acepta tiene `codigo` (su link es
   ?utm_source=creador-<codigo>) y `comision` (% de lo vendido). pagos = { idContacto: [{ fecha, monto, nota }] }, lo que
   ya se les pago. asignados = { idPedido: idContacto }, los pedidos que llegaron por WhatsApp o sin el link y se le
   cuentan igual a un creador.

   Sin Supabase (desarrollo local) queda en memoria y se pierde al reiniciar. */

const CLAVE = 'marketing';
const ID = /^[a-z0-9_.:-]{1,60}$/i;
let memoria = { hechas: {}, semanas: {}, notas: {}, contactos: {}, pagos: {}, asignados: {} };
const CAMPOS_CONTACTO = { tipo: 20, medio: 120, persona: 120, canal: 20, dato: 200, estado: 20, fecha: 10, tema: 200, nota: 1000, codigo: 16, comision: 5 };

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
async function rest(metodo, ruta, cuerpo, extra) {
  const s = supa();
  const r = await fetch(s.url + '/rest/v1/' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json', apikey: s.key, Authorization: 'Bearer ' + s.key }, extra || {}),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  if (!r.ok) { const e = new Error('Supabase respondio HTTP ' + r.status + ': ' + texto.slice(0, 200)); e.status = 502; throw e; }
  try { return texto ? JSON.parse(texto) : null; } catch (e) { return null; }
}
function limpio(v) {
  v = v && typeof v === 'object' ? v : {};
  const o = function (x) { return x && typeof x === 'object' ? x : {}; };
  return { hechas: o(v.hechas), semanas: o(v.semanas), notas: o(v.notas), contactos: o(v.contactos), pagos: o(v.pagos), asignados: o(v.asignados) };
}
async function leer() {
  if (!supa()) return limpio(memoria);
  const f = await rest('GET', 'operaciones_config?select=valor&clave=eq.' + CLAVE);
  return limpio(f && f[0] && f[0].valor);
}
async function escribir(v) {
  if (!supa()) { memoria = v; return; }
  await rest('POST', 'operaciones_config?on_conflict=clave', [{ clave: CLAVE, valor: v, actualizado_at: new Date().toISOString(), actualizado_por: 'panel' }], { Prefer: 'resolution=merge-duplicates' });
}

/* Un solo usuario en el panel: leer, cambiar una cosa y escribir alcanza. */
async function guardar(b) {
  const v = await leer();
  if (b.hecho && ID.test(String(b.hecho.id))) {
    if (b.hecho.valor) v.hechas[b.hecho.id] = new Date().toISOString(); else delete v.hechas[b.hecho.id];
  } else if (b.semana && ID.test(String(b.semana.id)) && b.semana.campos && typeof b.semana.campos === 'object') {
    const s = v.semanas[b.semana.id] || {};
    Object.keys(b.semana.campos).slice(0, 80).forEach(function (k) {
      if (!ID.test(k)) return;
      const x = b.semana.campos[k];
      if (x === '' || x == null) delete s[k];
      else if (Number.isFinite(Number(x))) s[k] = Number(x);
    });
    v.semanas[b.semana.id] = s;
  } else if (b.nota && ID.test(String(b.nota.id))) {
    const t = String(b.nota.texto || '').slice(0, 4000);
    if (t.trim()) v.notas[b.nota.id] = t; else delete v.notas[b.nota.id];
  } else if (b.contacto && ID.test(String(b.contacto.id)) && b.contacto.campos && typeof b.contacto.campos === 'object') {
    if (!v.contactos[b.contacto.id] && Object.keys(v.contactos).length >= 500) { const e = new Error('Hay demasiados contactos.'); e.status = 400; throw e; }
    const c = v.contactos[b.contacto.id] || {};
    Object.keys(b.contacto.campos).forEach(function (k) {
      const x = b.contacto.campos[k];
      if (k === 'oculto') { if (x) c.oculto = true; else delete c.oculto; return; }
      if (!CAMPOS_CONTACTO[k]) return;
      const t = String(x == null ? '' : x).trim().slice(0, CAMPOS_CONTACTO[k]);
      if (k === 'fecha' && t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return;
      if (k === 'codigo' && t && !/^[a-z0-9_-]{2,16}$/.test(t)) { const e = new Error('El código va en minúsculas, sin espacios ni tildes (2 a 16 letras o números).'); e.status = 400; throw e; }
      if (k === 'comision' && t && !(Number(t) >= 0 && Number(t) <= 50)) { const e = new Error('La comisión va de 0 a 50 %.'); e.status = 400; throw e; }
      c[k] = t;
    });
    c.actualizado = new Date().toISOString();
    v.contactos[b.contacto.id] = c;
  } else if (b.pago && ID.test(String(b.pago.id))) {
    const monto = Math.round(Number(String(b.pago.monto).replace(',', '.')) * 100) / 100;
    if (!(monto > 0 && monto < 100000)) { const e = new Error('Poné cuánto le pagaste, en dólares.'); e.status = 400; throw e; }
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(b.pago.fecha)) ? b.pago.fecha : new Date().toISOString().slice(0, 10);
    const l = v.pagos[b.pago.id] = (v.pagos[b.pago.id] || []).slice(-199);
    l.push({ fecha: fecha, monto: monto, nota: String(b.pago.nota || '').trim().slice(0, 200) });
  } else if (b.pagoBorrar && ID.test(String(b.pagoBorrar.id))) {
    const l = v.pagos[b.pagoBorrar.id] || [];
    const n = Number(b.pagoBorrar.n);
    if (Number.isInteger(n) && n >= 0) l.splice(n, 1);
    if (l.length) v.pagos[b.pagoBorrar.id] = l; else delete v.pagos[b.pagoBorrar.id];
  } else if (b.asignar && ID.test(String(b.asignar.pedido))) {
    if (b.asignar.creador && ID.test(String(b.asignar.creador))) v.asignados[b.asignar.pedido] = b.asignar.creador;
    else delete v.asignados[b.asignar.pedido];
  } else {
    const e = new Error('Nada para guardar.'); e.status = 400; throw e;
  }
  await escribir(v);
  return v;
}

async function api(req, res, ruta, h) {
  try {
    if (ruta === 'marketing' && req.method === 'GET') return h.sendJson(res, 200, { estado: await leer(), almacenamiento: supa() ? 'supabase' : 'memoria' });
    if (ruta === 'marketing/guardar' && req.method === 'POST') {
      const b = await h.readJson(req, 64 * 1024) || {};
      return h.sendJson(res, 200, { estado: await guardar(b) });
    }
    return h.sendJson(res, 404, { error: 'No existe.' });
  } catch (e) {
    return h.sendJson(res, e.status || 500, { error: e.message || 'Error' });
  }
}

module.exports = { api: api };
