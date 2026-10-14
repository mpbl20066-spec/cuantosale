'use strict';
/* Politica de cancelacion de cada servicio de un pedido, para saber si una cancelacion tiene reembolso.

   La politica es texto libre del tour (tours.politica_cancelacion): hoy casi todas son "Gratis hasta 72 hs antes",
   "Gratis hasta 24 hs antes" o "Cancelación gratuita". Se entiende eso (tambien en portugues) y lo demas queda
   "sin_dato" para revisarlo a mano: nunca se promete un reembolso que la politica no dice.

   Los servicios del pedido no guardan su fecha ni el id del tour: el tour se busca por nombre (y destino) y la
   anticipacion se cuenta hasta la fecha de ida del viaje. Ningun tour es antes de la ida, asi que la cuenta solo
   puede quedarse corta, nunca dar reembolso de mas. */

function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }

/* Horas de anticipacion que pide la politica: N (gratis hasta N horas antes), 0 (gratis sin plazo), -1 (sin
   reembolso) o null (no se entiende). */
function horasDePolitica(texto) {
  const t = sinTildes(texto);
  if (!t) return null;
  if (/(sin|no) (reembolso|devolucion)|no reembolsable|nao reembols|sem reembolso|non.?refundable/.test(t)) return -1;
  const m = t.match(/(?:hasta|ate|up to)\s+(\d{1,3})\s*(h|hs|hrs|hora|horas|d|dia|dias)\b/);
  if (m) return /^d/.test(m[2]) ? Number(m[1]) * 24 : Number(m[1]);
  if (/gratis|gratuit|sin cargo|sem custo|free cancel/.test(t)) return 0;
  return null;
}

/* Horas que faltan hasta la fecha de ida (medianoche de Uruguay, UTC-3). */
function horasHasta(fechaIda, ahora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaIda || ''))) return null;
  return (Date.parse(fechaIda + 'T00:00:00-03:00') - (ahora || Date.now())) / 3600e3;
}

/* estado: 'reembolso' | 'sin_reembolso' | 'sin_dato' */
function evaluar(politica, fechaIda, ahora) {
  const horas = horasDePolitica(politica), faltan = horasHasta(fechaIda, ahora);
  if (horas === null) return { estado: 'sin_dato', horas: null, faltan: faltan };
  if (horas === -1) return { estado: 'sin_reembolso', horas: horas, faltan: faltan };
  if (faltan === null) return { estado: 'sin_dato', horas: horas, faltan: null };
  return { estado: faltan >= horas ? 'reembolso' : 'sin_reembolso', horas: horas, faltan: faltan };
}

/* El tour de un servicio: mismo titulo (sin tildes ni mayusculas), o uno que empieza con el otro; se prefiere el del
   destino del pedido. */
function tourDe(item, tours, destino) {
  const n = sinTildes(item && item.nombre);
  if (!n) return null;
  const d = sinTildes(destino);
  const candidatos = (tours || []).filter(function (t) {
    const tt = sinTildes(t.title || t.titulo);
    return tt && (tt === n || n.indexOf(tt) === 0 || tt.indexOf(n) === 0);
  });
  return candidatos.filter(function (t) { return (t.destinations || []).some(function (x) { return d && sinTildes(x).indexOf(d) >= 0; }); })[0] || candidatos[0] || null;
}

function delPedido(p, tours, ahora) {
  return (p.items || []).map(function (it) {
    const t = tourDe(it, tours, p.destino);
    const politica = t ? String(t.cancelacion || t.politica_cancelacion || '').trim() : '';
    return Object.assign({ id: it.id, nombre: it.nombre, politica: politica }, evaluar(politica, p.fecha_ida, ahora));
  });
}

module.exports = { horasDePolitica: horasDePolitica, evaluar: evaluar, tourDe: tourDe, delPedido: delPedido };
