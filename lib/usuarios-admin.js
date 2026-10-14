'use strict';
/*
 * Usuarios de la web para el panel /admin (seccion Clientes > Usuarios).
 *
 * Una fila por cuenta (Supabase Auth) con lo que hizo: viajes guardados (trips), alertas de precio activas
 * (alertas_precio), puntos y sellos del pasaporte (pasaporte_eventos) y pedidos hechos con ese correo (pedidos).
 * Todo con la service role, como viajes-guardados.js: nada de esto va al navegador fuera del panel.
 *
 * Si una tabla todavia no existe o no responde, esa columna queda en 0 y la lista sale igual.
 */
const pedidos = require('./pedidos');

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function cab(s) { return { apikey: s.key, Authorization: 'Bearer ' + s.key }; }
async function filas(s, ruta) {
  try {
    const r = await fetch(s.url + '/rest/v1/' + ruta, { headers: cab(s) });
    return r.ok ? await r.json() : [];
  } catch (e) { return []; }
}

async function listar() {
  const s = supa();
  if (!s) { const e = new Error('Falta configurar Supabase en el servidor.'); e.status = 503; throw e; }
  const cuentas = [];
  for (let pag = 1; pag <= 20; pag++) {
    const r = await fetch(s.url + '/auth/v1/admin/users?per_page=1000&page=' + pag, { headers: cab(s) });
    if (!r.ok) {
      if (pag === 1) { const e = new Error('Supabase respondio HTTP ' + r.status + ' al leer los usuarios.'); e.status = 502; throw e; }
      break;
    }
    const j = await r.json(), lista = Array.isArray(j) ? j : (j.users || []);
    cuentas.push.apply(cuentas, lista);
    if (lista.length < 1000) break;
  }
  const res = await Promise.all([
    filas(s, 'trips?select=user_id,destination,created_at&order=created_at.desc&limit=5000'),
    filas(s, 'alertas_precio?select=user_id&activa=eq.true&limit=5000'),
    filas(s, 'pasaporte_eventos?select=user_id,tipo,xp&limit=20000'),
    pedidos.listarPedidos().catch(function () { return []; })
  ]);
  const por = {};
  const de = function (id) { return por[id] || (por[id] = { viajes: 0, ultimo_destino: '', alertas: 0, xp: 0, sellos: 0 }); };
  res[0].forEach(function (t) { const x = de(t.user_id); x.viajes++; if (!x.ultimo_destino) x.ultimo_destino = t.destination || ''; });
  res[1].forEach(function (a) { de(a.user_id).alertas++; });
  res[2].forEach(function (e) { const x = de(e.user_id); x.xp += Number(e.xp) || 0; if (e.tipo === 'sello') x.sellos++; });
  const pedidosPorMail = {};
  res[3].forEach(function (p) {
    const m = String(p.cliente_email || '').trim().toLowerCase(); if (!m) return;
    const x = pedidosPorMail[m] || (pedidosPorMail[m] = { n: 0, ultimo: null });
    x.n++; if (!x.ultimo) x.ultimo = { id: p.id, ref: p.ref, estado: p.estado };
  });
  return cuentas.map(function (u) {
    const md = u.user_metadata || {}, x = por[u.id] || de(u.id), pm = pedidosPorMail[String(u.email || '').toLowerCase()] || { n: 0, ultimo: null };
    return {
      id: u.id, email: u.email || '', nombre: md.full_name || md.name || '',
      proveedor: (u.app_metadata && u.app_metadata.provider) || '', alta: u.created_at || null, ultimo_ingreso: u.last_sign_in_at || null,
      confirmado: !!(u.email_confirmed_at || u.confirmed_at),
      viajes: x.viajes, ultimo_destino: x.ultimo_destino, alertas: x.alertas, xp: x.xp, sellos: x.sellos,
      pedidos: pm.n, ultimo_pedido: pm.ultimo
    };
  }).sort(function (a, b) { return String(b.alta || '').localeCompare(String(a.alta || '')); });
}

module.exports = { listar: listar };
