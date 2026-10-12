/*
 * Viajes guardados (tabla trips de Supabase).
 *
 * Link corto: el planificador guardaba el viaje con una URL kilometrica (destino, fechas y la
 * seleccion entera en ?sel=). Ahora el link es cuantosale.uy/viaje/<codigo>, donde el codigo es
 * el id (uuid) de la fila en base64url: 22 caracteres. GET /viaje/<codigo> lee la fila con la
 * service role y redirige a la URL larga que quedo en flight_details.url, mas &g=<codigo> para
 * que el planificador vuelva a mostrar el link corto en la barra.
 * El uuid es aleatorio (122 bits): quien tiene el link puede abrir ese viaje, igual que antes con
 * la URL larga, pero no se pueden adivinar otros.
 *
 * El panel /admin lista todos los viajes con el correo de quien los guardo (listar()).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_RE = /^[A-Za-z0-9_-]{22}$/;

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function cab(s) { return { apikey: s.key, Authorization: 'Bearer ' + s.key }; }

function codigoDeId(id) {
  if (!UUID_RE.test(String(id || ''))) return '';
  return Buffer.from(String(id).replace(/-/g, ''), 'hex').toString('base64url');
}
function idDeCodigo(codigo) {
  if (!CODIGO_RE.test(String(codigo || ''))) return '';
  const h = Buffer.from(codigo, 'base64url').toString('hex');
  if (h.length !== 32) return '';
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join('-');
}

/* La URL larga guardada, solo como ruta de este sitio (nunca a otro dominio: el dato lo escribe el
   navegador de la persona). Si no traia la seleccion pero la fila si, se agrega, como en cuenta.js. */
function rutaDelViaje(fila) {
  const fd = (fila && fila.flight_details) || {};
  if (!fd.url) return '';
  let u;
  try { u = new URL(String(fd.url), 'https://cuantosale.uy'); } catch (e) { return ''; }
  if (!/^\/[A-Za-z0-9_-][A-Za-z0-9/_-]*$/.test(u.pathname)) return '';   // sin // al principio (seria otro dominio)
  if (fd.seleccion && !u.searchParams.has('sel')) u.searchParams.set('sel', JSON.stringify(fd.seleccion));
  return u.pathname + u.search;
}

async function leer(id) {
  const s = supa(); if (!s || !id) return null;
  const r = await fetch(s.url + '/rest/v1/trips?select=id,flight_details&limit=1&id=eq.' + encodeURIComponent(id), { headers: cab(s) });
  const filas = r.ok ? await r.json() : [];
  return filas[0] || null;
}

/* GET /viaje/<codigo> */
async function redirigir(req, res, codigo) {
  const irA = function (destino) { res.writeHead(302, { Location: destino, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }); res.end(); };
  try {
    const ruta = rutaDelViaje(await leer(idDeCodigo(codigo)));
    if (ruta) return irA(ruta + (ruta.indexOf('?') < 0 ? '?' : '&') + 'g=' + codigo);
  } catch (e) { console.warn('[viaje] no se pudo leer:', e.message); }
  /* Plan B: el planificador lo busca con la sesion de la persona (rutaGuardada en public/web/cuenta.js). */
  return irA('/planificar?g=' + codigo);
}

/* Para el panel: los ultimos viajes guardados con el correo y nombre de cada cuenta. */
async function listar() {
  const s = supa();
  if (!s) { const e = new Error('Falta configurar Supabase en el servidor.'); e.status = 503; throw e; }
  const rt = await fetch(s.url + '/rest/v1/trips?select=*&order=created_at.desc&limit=1000', { headers: cab(s) });
  if (!rt.ok) {
    const detalle = await rt.text().catch(function () { return ''; });
    const pista = rt.status === 403 ? ' Falta el permiso de la service role sobre trips: ejecutar supabase_trips_admin.sql en el SQL Editor de Supabase.' : '';
    const e = new Error('Supabase respondio HTTP ' + rt.status + ' al leer trips.' + pista + (detalle ? ' (' + detalle.slice(0, 200) + ')' : ''));
    e.status = 502; throw e;
  }
  const filas = await rt.json();
  const usuarios = {};
  for (let pag = 1; pag <= 20; pag++) {
    const ru = await fetch(s.url + '/auth/v1/admin/users?per_page=1000&page=' + pag, { headers: cab(s) });
    if (!ru.ok) break;
    const j = await ru.json();
    const lista = Array.isArray(j) ? j : (j.users || []);
    lista.forEach(function (u) { usuarios[u.id] = { email: u.email || '', nombre: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '' }; });
    if (lista.length < 1000) break;
  }
  return filas.map(function (t) {
    const fd = t.flight_details || {}, u = usuarios[t.user_id] || {};
    const codigo = rutaDelViaje(t) ? codigoDeId(t.id) : '';
    return {
      id: t.id, creado: t.created_at, email: u.email || '', nombre: u.nombre || '',
      destino: t.destination || '', ida: t.departure_date || '', vuelta: t.return_date || '',
      pax: fd.pax || null, total: Number(t.total_price || t.total_amount) || 0,
      link: codigo ? '/viaje/' + codigo : '', detalle: fd.detalle || null
    };
  });
}

module.exports = { redirigir: redirigir, listar: listar, codigoDeId: codigoDeId, idDeCodigo: idDeCodigo, CODIGO_RE: CODIGO_RE, _rutaDelViaje: rutaDelViaje };
