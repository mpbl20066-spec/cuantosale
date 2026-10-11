'use strict';
/* Pasaporte del explorador, del lado del servidor (tablas en supabase_pasaporte.sql).

   La persona tiene que haber iniciado sesion: el navegador manda el token de Supabase y aca se verifica con
   /auth/v1/user. El XP se guarda como eventos con clave unica (repetir no suma) y topes por tipo; el nivel sale de la
   suma. Al llegar a un nivel con premio se crea el cupon (uno por nivel). El cupon se canjea al reservar
   (lib/reservas.js) con un UPDATE atomico, asi no se puede usar dos veces.

   Honestidad sobre el limite: un script con una cuenta real puede mandar eventos inventados dentro de los topes. Por
   eso los premios son chicos (2-5%, tope US$ 5) y el cupon solo se usa en una reserva, que pasa por el asesor. */

const crypto = require('crypto');

const NIVELES_XP = [0, 50, 150, 350, 700];
/* nivel (indice en NIVELES_XP) -> premio. Mochilero (1) y Turista (0) no llevan cupon. */
const PREMIOS = { 2: { pct: 2 }, 3: { pct: 3 }, 4: { pct: 5 } };
const TOPE_USD = 5, MINIMO_USD = 40, VIGENCIA_DIAS = 90;

/* Reglas por tipo: xp, tope de cantidad total (max) y como se arma la clave. */
const REGLAS = {
  visita: { xp: 5, max: 100000 },
  busqueda: { xp: 3, max: 100000, porDia: 5 },
  sello: { xp: 15, max: 25 },
  guardar: { xp: 25, max: 10 },
  compartir: { xp: 15, max: 10 },
  dividir: { xp: 15, max: 10 },
  reserva: { xp: 60, max: 100000, soloServidor: true }
};
const REF_RE = /^[A-Za-z0-9_+.-]{1,40}$/;

function nivelDe(xp) { let n = 0; for (let i = 0; i < NIVELES_XP.length; i++) if (xp >= NIVELES_XP[i]) n = i; return n; }
function hoyUY() { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); } // Uruguay es UTC-3, sin horario de verano
function nombreLimpio(v) { return String(v == null ? '' : v).replace(/[<>"'`\r\n\t]/g, '').trim().slice(0, 40); }
function codigoCupon() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = '';
  const b = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) c += abc[b[i] % abc.length];
  return 'CS-' + c;
}

module.exports = function (h) {
  function cfg() {
    const url = String(process.env.SUPABASE_URL || 'https://hqyzmeordvjccytgltse.supabase.co').replace(/\/+$/, '');
    const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anon = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    return key && anon ? { url: url, key: key, anon: anon } : null;
  }
  async function rest(c, camino, init) {
    init = init || {};
    const r = await h.fetchWithTimeout(c.url + '/rest/v1/' + camino, {
      method: init.method || 'GET',
      headers: Object.assign({ apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, init.headers || {}),
      body: init.body ? JSON.stringify(init.body) : undefined
    }, 8000);
    if (!r.ok) { const e = new Error('Supabase respondió ' + r.status); e.status = 502; throw e; }
    const t = await r.text();
    return t ? JSON.parse(t) : [];
  }

  /* Devuelve { id } del usuario del token Bearer, o null. */
  async function usuarioDe(req) {
    const c = cfg();
    const m = /^Bearer\s+([A-Za-z0-9._-]{20,4000})$/.exec(String(req.headers.authorization || ''));
    if (!c || !m) return null;
    try {
      const r = await h.fetchWithTimeout(c.url + '/auth/v1/user', { headers: { apikey: c.anon, Authorization: 'Bearer ' + m[1] } }, 6000);
      if (!r.ok) return null;
      const u = await r.json();
      return u && /^[0-9a-f-]{36}$/i.test(u.id || '') ? { id: u.id } : null;
    } catch (e) { return null; }
  }

  async function eventosDe(c, uid) {
    return rest(c, 'pasaporte_eventos?select=clave,tipo,nombre,xp,creado&user_id=eq.' + uid + '&order=creado.asc&limit=2000');
  }

  /* Crea los cupones de los niveles alcanzados (uno por nivel) y devuelve todos los de la persona. */
  async function cuponesDe(c, uid, xp) {
    const nivel = nivelDe(xp);
    const nuevos = Object.keys(PREMIOS).map(Number).filter(function (n) { return n <= nivel; }).map(function (n) {
      return { codigo: codigoCupon(), user_id: uid, nivel: n, pct: PREMIOS[n].pct, tope_usd: TOPE_USD, minimo_usd: MINIMO_USD,
        expira: new Date(Date.now() + VIGENCIA_DIAS * 86400000).toISOString() };
    });
    if (nuevos.length) {
      try { await rest(c, 'cupones?on_conflict=user_id,nivel', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: nuevos }); } catch (e) { /* se reintenta en la proxima lectura */ }
    }
    return rest(c, 'cupones?select=codigo,nivel,pct,tope_usd,minimo_usd,expira,usado_en&user_id=eq.' + uid + '&order=nivel.asc');
  }

  async function estado(c, uid) {
    const ev = await eventosDe(c, uid);
    let xp = 0, busquedas = 0;
    const sellos = {}, acc = { guardar: 0, compartir: 0, dividir: 0, reserva: 0 }, dias = [];
    ev.forEach(function (e) {
      xp += e.xp;
      if (e.tipo === 'sello') sellos[e.clave.slice(6)] = { n: e.nombre || e.clave.slice(6), t: Date.parse(e.creado) };
      else if (e.tipo === 'busqueda') busquedas++;
      else if (e.tipo === 'visita') dias.push(e.clave.slice(7));
      else if (acc[e.tipo] !== undefined) acc[e.tipo]++;
    });
    const cupones = await cuponesDe(c, uid, xp);
    return { xp: xp, nivel: nivelDe(xp), sellos: sellos, acc: acc, busquedas: busquedas, dias: dias.slice(-120), cupones: cupones };
  }

  /* Registra un evento (idempotente) si respeta las reglas. Devuelve true si sumo algo. */
  async function registrar(c, uid, tipo, ref, nombre, desdeServidor) {
    const regla = REGLAS[tipo];
    if (!regla || (regla.soloServidor && !desdeServidor)) return { ok: false, motivo: 'tipo' };
    let clave;
    if (tipo === 'visita') clave = 'visita:' + hoyUY();
    else if (tipo === 'busqueda') {
      const hoy = hoyUY();
      const previas = await rest(c, 'pasaporte_eventos?select=clave&user_id=eq.' + uid + '&tipo=eq.busqueda&clave=like.' + encodeURIComponent('busq:' + hoy + ':') + '*');
      if (previas.length >= regla.porDia) return { ok: false, motivo: 'tope' };
      clave = 'busq:' + hoy + ':' + (previas.length + 1);
    } else {
      if (!REF_RE.test(String(ref || ''))) return { ok: false, motivo: 'ref' };
      clave = tipo + ':' + ref;
      const previos = await rest(c, 'pasaporte_eventos?select=clave&user_id=eq.' + uid + '&tipo=eq.' + tipo + '&limit=' + (regla.max + 1));
      if (previos.length >= regla.max && !previos.some(function (p) { return p.clave === clave; })) return { ok: false, motivo: 'tope' };
    }
    const filas = await rest(c, 'pasaporte_eventos?on_conflict=user_id,clave', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: { user_id: uid, clave: clave, tipo: tipo, nombre: tipo === 'sello' ? nombreLimpio(nombre) || String(ref) : '', xp: regla.xp }
    });
    return { ok: true, nuevo: filas.length > 0 };
  }

  /* ---- endpoints ---- */
  async function getEstado(req, res) {
    if (h.limited('pasaporte:' + h.clientIp(req))) return h.sendJson(res, 429, { error: 'Demasiados pedidos seguidos.' });
    const c = cfg(); if (!c) return h.sendJson(res, 503, { error: 'El pasaporte no está configurado.' });
    const u = await usuarioDe(req); if (!u) return h.sendJson(res, 401, { error: 'Iniciá sesión.' });
    return h.sendJson(res, 200, await estado(c, u.id));
  }
  async function postEvento(req, res) {
    if (h.limited('pasaporte-ev:' + h.clientIp(req))) return h.sendJson(res, 429, { error: 'Demasiados pedidos seguidos.' });
    const c = cfg(); if (!c) return h.sendJson(res, 503, { error: 'El pasaporte no está configurado.' });
    const u = await usuarioDe(req); if (!u) return h.sendJson(res, 401, { error: 'Iniciá sesión.' });
    let b; try { b = await h.readJson(req, 2048); } catch (e) { return h.sendJson(res, e.status || 400, { error: e.message }); }
    b = b && typeof b === 'object' ? b : {};
    const lista = Array.isArray(b.eventos) ? b.eventos.slice(0, 30) : [b];   // en lote al migrar los sellos del navegador
    for (const e of lista) await registrar(c, u.id, String(e && e.tipo || ''), e && e.ref, e && e.nombre, false);
    return h.sendJson(res, 200, await estado(c, u.id));
  }

  /* ---- para lib/reservas.js ---- */
  /* Canjea un cupon con un UPDATE atomico. Devuelve { ok, descuentoUsd, pct } o { ok:false, error }. */
  async function canjear(uid, codigo, totalUsd) {
    const c = cfg(); if (!c) return { ok: false, error: 'Los cupones no están disponibles ahora.' };
    codigo = String(codigo || '').toUpperCase().trim();
    if (!/^CS-[A-Z0-9]{6}$/.test(codigo)) return { ok: false, error: 'El cupón no es válido.' };
    const fila = (await rest(c, 'cupones?select=codigo,pct,tope_usd,minimo_usd,expira,usado_en&codigo=eq.' + codigo + '&user_id=eq.' + uid))[0];
    if (!fila) return { ok: false, error: 'El cupón no es válido.' };
    if (fila.usado_en) return { ok: false, error: 'Ese cupón ya se usó.' };
    if (Date.parse(fila.expira) < Date.now()) return { ok: false, error: 'Ese cupón venció.' };
    if (!(totalUsd >= fila.minimo_usd)) return { ok: false, error: 'El cupón pide una compra mínima de US$ ' + fila.minimo_usd + '.' };
    const tomado = await rest(c, 'cupones?codigo=eq.' + codigo + '&user_id=eq.' + uid + '&usado_en=is.null', {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { usado_en: new Date().toISOString() }
    });
    if (!tomado.length) return { ok: false, error: 'Ese cupón ya se usó.' };
    const descuento = Math.min(Math.round(totalUsd * fila.pct) / 100, Number(fila.tope_usd));
    return { ok: true, codigo: codigo, pct: Number(fila.pct), descuentoUsd: Math.round(descuento * 100) / 100 };
  }
  /* Solo el XP total (sin crear cupones): lo usa el candado de la Guia Secreta. null si no hay Supabase. */
  async function xpDe(uid) {
    const c = cfg(); if (!c) return null;
    const ev = await rest(c, 'pasaporte_eventos?select=xp&user_id=eq.' + uid + '&limit=5000');
    return ev.reduce(function (s, e) { return s + (Number(e.xp) || 0); }, 0);
  }
  async function liberar(uid, codigo) {
    const c = cfg(); if (!c) return;
    try { await rest(c, 'cupones?codigo=eq.' + encodeURIComponent(codigo) + '&user_id=eq.' + uid, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { usado_en: null } }); } catch (e) { /* queda para revisar a mano */ }
  }
  async function eventoServidor(uid, tipo, ref) {
    const c = cfg(); if (!c) return;
    try { await registrar(c, uid, tipo, ref, '', true); } catch (e) { /* el XP no es critico */ }
  }

  return { getEstado: getEstado, postEvento: postEvento, usuarioDe: usuarioDe, canjear: canjear, liberar: liberar, eventoServidor: eventoServidor,
    xpDe: xpDe, XP_GUIA: NIVELES_XP[1], _nivelDe: nivelDe };
};
