'use strict';
/*
 * Fotos de un tour sacadas de la pagina del propio operador (tours.link_web).
 *
 *   candidatas(url)        -> las fotos que tiene esa pagina, la mejor primero
 *                             (og:image / twitter:image, despues las <img> grandes).
 *   copiar(urlFoto, clave) -> la baja y la sube al bucket publico `tours` de
 *                             Supabase; devuelve la URL publica.
 *
 * POR QUE SE COPIA Y NO SE ENLAZA
 * Enlazar la foto en la web del operador se rompe cuando el operador cambia su
 * sitio, y muchos bloquean que otro dominio use sus imagenes. Copiada al bucket
 * (donde ya estan las fotos de los tours, ver scripts/galerias-tours.js) queda
 * fija. Es la foto del operador con el que se trabaja: conviene avisarle.
 *
 * SEGURIDAD
 * Las direcciones vienen de un archivo importado, asi que el server no puede
 * pedir cualquier cosa: solo http(s) a hosts publicos (nada de localhost ni de la
 * red interna, tambien despues de cada redireccion), con tiempo y tamano limitados,
 * y solo se suben imagenes JPG, PNG o WebP de verdad.
 */
const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');

const MAX_HTML = 2 * 1024 * 1024;
const MAX_IMG = 8 * 1024 * 1024;
const MIN_IMG = 12 * 1024;          // menos que esto es un icono o un logo
const TIEMPO_MS = 10000;
// Varios sitios de operadores (Wix, algunos WordPress) responden 403 a lo que no parece un navegador.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function falla(status, msg) { const e = new Error(msg); e.status = status; return e; }

function ipPrivada(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
  }
  const x = ip.toLowerCase();
  if (x.indexOf('::ffff:') === 0) return ipPrivada(x.slice(7));
  return x === '::1' || x === '::' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x);
}

async function verificar(url) {
  let u;
  try { u = new URL(url); } catch (e) { throw falla(400, 'Dirección inválida.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw falla(400, 'Solo direcciones web (http o https).');
  if (u.username || u.password) throw falla(400, 'Dirección inválida.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(function () { throw falla(400, 'No existe el sitio ' + host + '.'); })).map(function (a) { return a.address; });
  if (!ips.length || ips.some(ipPrivada)) throw falla(400, 'Esa dirección no es un sitio público.');
  return u;
}

/* fetch con limite de tiempo y de tamano, siguiendo hasta 4 redirecciones y verificando cada una. */
async function pedir(url, max, acepta) {
  let actual = url;
  for (let i = 0; i < 5; i++) {
    await verificar(actual);
    const ctl = new AbortController();
    const t = setTimeout(function () { ctl.abort(); }, TIEMPO_MS);
    let r;
    try {
      r = await fetch(actual, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': UA, accept: acepta } });
    } catch (e) {
      clearTimeout(t);
      throw falla(502, e.name === 'AbortError' ? 'La página del proveedor tardó demasiado.' : 'No se pudo abrir la página del proveedor.');
    }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      clearTimeout(t);
      actual = new URL(r.headers.get('location'), actual).toString();
      continue;
    }
    if (!r.ok) { clearTimeout(t); throw falla(502, 'La página del proveedor respondió ' + r.status + '.'); }
    const largo = Number(r.headers.get('content-length') || 0);
    if (largo > max) { clearTimeout(t); throw falla(400, 'El archivo es demasiado grande.'); }
    const partes = []; let total = 0;
    const lector = r.body.getReader();
    try {
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        total += value.length;
        if (total > max) { ctl.abort(); throw falla(400, 'El archivo es demasiado grande.'); }
        partes.push(value);
      }
    } finally { clearTimeout(t); }
    return { url: actual, tipo: String(r.headers.get('content-type') || '').toLowerCase(), cuerpo: Buffer.concat(partes.map(function (p) { return Buffer.from(p); })) };
  }
  throw falla(502, 'Demasiadas redirecciones.');
}

const NO_FOTO = /logo|icon|favicon|sprite|avatar|whatsapp|wa-|pix|cadastur|selo|seal|bandeira|flag|badge|banner-cookie|loading|placeholder|blank|pixel|tracking|emoji|payment|pagamento|cartao|visa|master|tripadvisor|google|facebook|instagram/i;

function atributo(tag, nombre) {
  const m = new RegExp('\\s' + nombre + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
  return m ? (m[2] != null ? m[2] : (m[3] != null ? m[3] : m[4])) : '';
}
/* Los constructores de sitios mandan versiones chicas en el link; se pide la grande. */
function grande(u) {
  // Wix: .../media/<id>~mv2.jpg/v1/fit/w_40,h_30,... -> el original.
  let m = /^(https:\/\/static\.wixstatic\.com\/media\/[^/]+\.(?:jpe?g|png|webp))\/v1\//i.exec(u);
  if (m) return m[1];
  // Cloudflare Images: .../<id>/w=40 -> w=1600.
  if (/^https:\/\/imagedelivery\.net\//i.test(u)) return u.replace(/\/w=\d+[^/]*$/i, '/w=1600');
  return u;
}
function decodificar(s) { return String(s).replace(/&amp;/g, '&').replace(/&#0?38;/g, '&').replace(/&quot;/g, '"').trim(); }

/** Las fotos de una pagina, la mejor primero. */
function extraer(html, base) {
  const vistas = new Set(), out = [];
  const sumar = function (u, prioridad) {
    u = decodificar(u || '');
    if (!u || /^data:/i.test(u)) return;
    let abs;
    try { abs = new URL(u, base).toString(); } catch (e) { return; }
    abs = grande(abs);
    if (!/^https?:/i.test(abs) || /\.(svg|gif|ico)(\?|#|$)/i.test(abs) || NO_FOTO.test(abs.split('?')[0])) return;
    if (vistas.has(abs)) return;
    vistas.add(abs); out.push({ url: abs, p: prioridad });
  };
  // 1. Las que la pagina declara como su imagen (las que usa al compartirse en WhatsApp o Facebook).
  (html.match(/<meta\b[^>]*>/gi) || []).forEach(function (tag) {
    const prop = (atributo(tag, 'property') || atributo(tag, 'name')).toLowerCase();
    if (/^(og:image(:secure_url|:url)?|twitter:image(:src)?)$/.test(prop)) sumar(atributo(tag, 'content'), 0);
  });
  (html.match(/<link\b[^>]*rel=["']?image_src[^>]*>/gi) || []).forEach(function (tag) { sumar(atributo(tag, 'href'), 0); });
  // 2. Las del contenido. De un srcset, la mas grande.
  (html.match(/<img\b[^>]*>/gi) || []).forEach(function (tag) {
    const ancho = Number(atributo(tag, 'width')) || 0;
    if (ancho && ancho < 250) return;
    const srcset = atributo(tag, 'srcset') || atributo(tag, 'data-srcset');
    let grande = '';
    if (srcset) {
      let mejor = 0;
      srcset.split(',').forEach(function (p) { const m = p.trim().split(/\s+/); const w = parseInt(m[1], 10) || 0; if (w >= mejor) { mejor = w; grande = m[0]; } });
    }
    sumar(grande || atributo(tag, 'data-src') || atributo(tag, 'data-lazy-src') || atributo(tag, 'src'), ancho >= 600 ? 1 : 2);
  });
  return out.sort(function (a, b) { return a.p - b.p; }).slice(0, 24).map(function (x) { return x.url; });
}

async function candidatas(url) {
  const r = await pedir(url, MAX_HTML, 'text/html,application/xhtml+xml');
  if (r.tipo && r.tipo.indexOf('html') < 0) throw falla(400, 'El link del proveedor no es una página web.');
  return extraer(r.cuerpo.toString('utf8'), r.url);
}

function supa() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}

/* El tipo se mira en los primeros bytes, no en lo que dice el servidor del operador. */
function tipoReal(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (b.length > 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

/** Baja la foto y la sube al bucket `tours`. Devuelve la URL publica. */
async function copiar(urlFoto, clave) {
  const s = supa();
  if (!s) throw falla(503, 'Falta configurar Supabase en el servidor.');
  const r = await pedir(urlFoto, MAX_IMG, 'image/avif,image/webp,image/jpeg,image/png,image/*');
  const t = tipoReal(r.cuerpo);
  if (!t) throw falla(400, 'Eso no es una foto JPG, PNG o WebP.');
  if (r.cuerpo.length < MIN_IMG) throw falla(400, 'La imagen es muy chica (parece un ícono).');
  const nombre = 'proveedores/' + String(clave || 'tour').replace(/[^a-z0-9-]/gi, '').slice(0, 40) + '-' +
    crypto.createHash('sha1').update(r.url).digest('hex').slice(0, 10) + '.' + t.ext;
  const up = await fetch(s.url + '/storage/v1/object/tours/' + nombre, {
    method: 'POST',
    headers: { apikey: s.key, Authorization: 'Bearer ' + s.key, 'content-type': t.mime, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
    body: r.cuerpo
  });
  if (!up.ok) throw falla(502, 'No se pudo guardar la foto: ' + (await up.text()).slice(0, 150));
  return s.url + '/storage/v1/object/public/tours/' + nombre;
}

/* El texto de la pagina del operador, para completar la ficha (fichaDesdePagina, abajo): titulo, descripcion declarada y el
   contenido sin scripts, estilos, menus ni pies. Se corta a ~14.000 caracteres: alcanza para la ficha de un paseo. */
async function texto(url) {
  const r = await pedir(url, MAX_HTML, 'text/html,application/xhtml+xml');
  if (r.tipo && r.tipo.indexOf('html') < 0) throw falla(400, 'El link del proveedor no es una página web.');
  const html = r.cuerpo.toString('utf8');
  const meta = function (re) { const m = re.exec(html); return m ? decodificar(m[1]) : ''; };
  const titulo = meta(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = meta(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*content=["']([^"']*)["']/i);
  const cuerpo = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(Number(n)); })
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
  return { url: r.url, titulo: titulo.slice(0, 300), descripcion: desc.slice(0, 600), texto: cuerpo.slice(0, 14000) };
}

/* La ficha del paseo sacada del texto de la pagina, tal cual (casi siempre en portugues), para que la persona la
   corrija en el editor. Busca las secciones tipicas de los sitios de operadores ("Inclui", "Não inclui", "O que levar",
   "Duração", "Cancelamento") y, para el detalle, los parrafos largos. Lo que no encuentra queda vacio. */
const SECCIONES = [
  ['no_incluye', /^(o que )?n[aã]o (est[aá] )?inclu|^no incluye|^n[aã]o incluso|^exclu/i],
  ['incluye', /^(o (passeio|pacote|que) )?(est[aá] )?inclu[ií]|^incluye|^incluso|^inclusos|^o que inclui/i],
  ['que_llevar', /^(o )?que levar|^qu[eé] llevar|^levar|^leve |^recomenda[cç][oõ]es|^itens recomendados/i],
  ['politica_cancelacion', /^(pol[ií]tica (de )?)?cancelamento|^cancelaci[oó]n|^pol[ií]tica de cancel/i],
  ['duracion', /^dura[cç][aã]o|^duraci[oó]n|^tempo de passeio/i],
  ['punto_salida', /^(ponto|local) de (sa[ií]da|encontro|embarque)|^embarque|^sa[ií]da/i]
];
function seccionDe(linea) {
  const l = linea.replace(/^[\s•\-–*✔✓✅❌✗>]+/, '').trim();
  if (l.length > 60) return null;
  for (const s of SECCIONES) if (s[1].test(l)) return { campo: s[0], resto: l.split(/[:\-–]\s*/).slice(1).join(' ').trim() };
  return null;
}
async function fichaDesdePagina(url) {
  const t = await texto(url);
  const lineas = t.texto.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  const f = { descripcion: '', detalle: '', duracion: '', punto_salida: '', politica_cancelacion: '', incluye: '', no_incluye: '', que_llevar: '' };
  const listas = { incluye: [], no_incluye: [], que_llevar: [], politica_cancelacion: [] };
  let actual = null, usadas = new Set();
  lineas.forEach(function (l, i) {
    const s = seccionDe(l);
    if (s) {
      usadas.add(i);
      if (s.campo === 'duracion' || s.campo === 'punto_salida') {
        const v = s.resto || (lineas[i + 1] && !seccionDe(lineas[i + 1]) ? lineas[i + 1] : '');
        if (v && !f[s.campo]) f[s.campo] = v.slice(0, 120);
        if (!s.resto) usadas.add(i + 1);
        actual = null;
      } else {
        actual = s.campo;
        if (s.resto) listas[actual].push(s.resto);
      }
      return;
    }
    if (!actual) return;
    // Una seccion termina en una linea larga (un parrafo) o despues de 12 items.
    if (l.length > 160 || listas[actual].length >= 12) { actual = null; return; }
    listas[actual].push(l.replace(/^[\s•\-–*✔✓✅❌✗>]+/, '').trim());
    usadas.add(i);
  });
  ['incluye', 'no_incluye', 'que_llevar'].forEach(function (k) { f[k] = listas[k].filter(Boolean).join('\n'); });
  f.politica_cancelacion = listas.politica_cancelacion.filter(Boolean).join(' ').slice(0, 1000);
  // La descripcion: la que la pagina declara (la que se ve al compartirla), si no el primer parrafo.
  // Parrafos de verdad: ni el titulo de la pagina, ni lineas en mayusculas, ni barras de menu ("A | B | C").
  const parrafos = lineas.filter(function (l, i) {
    return !usadas.has(i) && l.length >= 80 && l !== t.titulo && l !== l.toUpperCase() && (l.match(/ \| /g) || []).length < 2 &&
      !/R\$|cookies|copyright|todos os direitos|whatsapp/i.test(l);
  });
  f.descripcion = (t.descripcion && t.descripcion.length >= 40 ? t.descripcion : (parrafos[0] || '')).slice(0, 400);
  let detalle = '';
  for (const p of parrafos) {
    if (p === f.descripcion) continue;
    if ((detalle + '\n\n' + p).length > 1800) break;
    detalle += (detalle ? '\n\n' : '') + p;
  }
  f.detalle = detalle;
  return f;
}

/** Una foto subida desde el panel (la compu o el celular), ya achicada en el navegador. Mismo bucket `tours`.
    El nombre sale del contenido: subir la misma foto dos veces no la duplica. */
async function subir(cuerpo, clave) {
  const s = supa();
  if (!s) throw falla(503, 'Falta configurar Supabase en el servidor.');
  if (!Buffer.isBuffer(cuerpo) || !cuerpo.length) throw falla(400, 'No llegó la foto.');
  if (cuerpo.length > MAX_IMG) throw falla(400, 'La foto es muy pesada.');
  const t = tipoReal(cuerpo);
  if (!t) throw falla(400, 'Eso no es una foto JPG, PNG o WebP.');
  if (cuerpo.length < MIN_IMG) throw falla(400, 'La imagen es muy chica.');
  const nombre = 'subidas/' + String(clave || 'tour').replace(/[^a-z0-9-]/gi, '').slice(0, 40) + '-' +
    crypto.createHash('sha1').update(cuerpo).digest('hex').slice(0, 12) + '.' + t.ext;
  const up = await fetch(s.url + '/storage/v1/object/tours/' + nombre, {
    method: 'POST',
    headers: { apikey: s.key, Authorization: 'Bearer ' + s.key, 'content-type': t.mime, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
    body: cuerpo
  });
  if (!up.ok) throw falla(502, 'No se pudo guardar la foto: ' + (await up.text()).slice(0, 150));
  return s.url + '/storage/v1/object/public/tours/' + nombre;
}

module.exports = { subir: subir, texto: texto, fichaDesdePagina: fichaDesdePagina, candidatas: candidatas, copiar: copiar, extraer: extraer, ipPrivada: ipPrivada, verificar: verificar };
