'use strict';
/* PDF del recibo de la sena y del voucher de la reserva paga (va adjunto en el mail, lib/mail-cliente.js).

   Sin dependencias, como el resto del server: un PDF 1.4 armado a mano con Helvetica y Helvetica-Bold, que son
   fuentes que trae todo lector de PDF, con WinAnsiEncoding (tiene las tildes, la ñ, ¿ y ¡). Lo que no entra en
   WinAnsi (flechas, emojis) se cambia o se saca. Coordenadas de arriba hacia abajo (y crece hacia abajo), como en
   una pagina web; se dan vuelta al escribir. A4, una pagina; si los servicios no entran sigue en otra. */

const W = 595.28, H = 841.89, M = 48;
const C = {
  navy: '#0B2A55', mostaza: '#F7C325', tinta: '#101828', gris: '#667085', linea: '#E4E7EC', suave: '#F7F8FA',
  blanco: '#FFFFFF', claro: '#C7D2E5', verde: '#067647', verdeSuave: '#DCFAE6', mostazaSuave: '#FEF6D8', marron: '#7A5A00'
};

/* Anchos de Helvetica (AFM, en milesimas del cuerpo) para medir: alinear montos a la derecha y cortar renglones. */
const ANCHO = (function () {
  const a = {}, t = ' 278!278"355#556$556%889&667\'191(333)333*389+584,278-333.278/278:278;278<584=584>584?556@1015[278\\278]278^469_556`333{334|260}334~584' +
    'A667B667C722D722E667F611G778H722I278J500K667L556M833N722O778P667Q778R722S667T611U722V667W944X667Y667Z611' +
    'a556b556c500d556e556f278g556h556i222j222k500l222m833n556o556p556q556r333s500t278u556v500w722x500y500z500';
  t.replace(/([\s\S])(\d+)/g, function (_, ch, n) { a[ch] = Number(n); });
  for (let d = 0; d < 10; d++) a[String(d)] = 556;
  return a;
})();
function base(ch) { return ch.normalize('NFD').charAt(0); }
function ancho(s, size, bold) {
  let w = 0;
  for (const ch of String(s)) { const n = ANCHO[ch] || ANCHO[base(ch)] || 556; w += bold && !/\d/.test(ch) ? n * 1.06 : n; }
  return w * size / 1000;
}

const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
/* Texto a bytes WinAnsi, escapado para un string de PDF. */
function win(s) {
  s = String(s == null ? '' : s).replace(/[→⇄⇆↔➜]/g, '-').replace(/−/g, '-').replace(/[\r\n\t]+/g, ' ');
  let o = '';
  for (const ch of s) {
    const c = ch.codePointAt(0), b = (c >= 32 && c <= 126) || (c >= 160 && c <= 255) ? c : WIN[ch];
    if (!b) continue;
    o += b === 40 || b === 41 || b === 92 ? '\\' + String.fromCharCode(b) : String.fromCharCode(b);
  }
  return o;
}
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return (v / 255).toFixed(3); }).join(' ');
}
function f(n) { return (Math.round(n * 100) / 100).toString(); }

function Lienzo() { this.paginas = [[]]; }
Lienzo.prototype.op = function (s) { this.paginas[this.paginas.length - 1].push(s); };
Lienzo.prototype.nueva = function () { this.paginas.push([]); };
Lienzo.prototype.rect = function (x, y, w, h, color, r) {
  const yb = H - y - h;
  if (!r) return this.op(rgb(color) + ' rg ' + f(x) + ' ' + f(yb) + ' ' + f(w) + ' ' + f(h) + ' re f');
  const k = r * 0.5523, x2 = x + w, y2 = yb + h;
  this.op(rgb(color) + ' rg ' + f(x + r) + ' ' + f(yb) + ' m ' + f(x2 - r) + ' ' + f(yb) + ' l ' +
    f(x2 - r + k) + ' ' + f(yb) + ' ' + f(x2) + ' ' + f(yb + r - k) + ' ' + f(x2) + ' ' + f(yb + r) + ' c ' + f(x2) + ' ' + f(y2 - r) + ' l ' +
    f(x2) + ' ' + f(y2 - r + k) + ' ' + f(x2 - r + k) + ' ' + f(y2) + ' ' + f(x2 - r) + ' ' + f(y2) + ' c ' + f(x + r) + ' ' + f(y2) + ' l ' +
    f(x + r - k) + ' ' + f(y2) + ' ' + f(x) + ' ' + f(y2 - r + k) + ' ' + f(x) + ' ' + f(y2 - r) + ' c ' + f(x) + ' ' + f(yb + r) + ' l ' +
    f(x) + ' ' + f(yb + r - k) + ' ' + f(x + r - k) + ' ' + f(yb) + ' ' + f(x + r) + ' ' + f(yb) + ' c f');
};
Lienzo.prototype.linea = function (x1, y1, x2, y2, color, grosor) {
  this.op(rgb(color) + ' RG ' + f(grosor || 0.75) + ' w ' + f(x1) + ' ' + f(H - y1) + ' m ' + f(x2) + ' ' + f(H - y2) + ' l S');
};
Lienzo.prototype.circulo = function (cx, cy, r, color) {
  const k = r * 0.5523, y = H - cy;
  this.op(rgb(color) + ' rg ' + f(cx + r) + ' ' + f(y) + ' m ' +
    f(cx + r) + ' ' + f(y + k) + ' ' + f(cx + k) + ' ' + f(y + r) + ' ' + f(cx) + ' ' + f(y + r) + ' c ' +
    f(cx - k) + ' ' + f(y + r) + ' ' + f(cx - r) + ' ' + f(y + k) + ' ' + f(cx - r) + ' ' + f(y) + ' c ' +
    f(cx - r) + ' ' + f(y - k) + ' ' + f(cx - k) + ' ' + f(y - r) + ' ' + f(cx) + ' ' + f(y - r) + ' c ' +
    f(cx + k) + ' ' + f(y - r) + ' ' + f(cx + r) + ' ' + f(y - k) + ' ' + f(cx + r) + ' ' + f(y) + ' c f');
};
/* El pin de la marca: gota blanca con el punto mostaza. (cx, cy) es el centro de la cabeza. */
Lienzo.prototype.pin = function (cx, cy, r) {
  this.circulo(cx, cy, r, C.blanco);
  this.op(rgb(C.blanco) + ' rg ' + f(cx - r * 0.86) + ' ' + f(H - cy - r * 0.5) + ' m ' + f(cx + r * 0.86) + ' ' + f(H - cy - r * 0.5) + ' l ' + f(cx) + ' ' + f(H - cy - r * 2.1) + ' l f');
  this.circulo(cx, cy, r * 0.42, C.mostaza);
};
/* o = { size, bold, color, align: 'right' }. y es la linea de base. */
Lienzo.prototype.texto = function (x, y, s, o) {
  o = o || {};
  const size = o.size || 10, bold = !!o.bold;
  if (o.align === 'right') x -= ancho(s, size, bold);
  this.op('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + rgb(o.color || C.tinta) + ' rg ' + f(x) + ' ' + f(H - y) + ' Td (' + win(s) + ') Tj ET');
};
function cortar(s, size, bold, max) {
  const out = []; let cur = '';
  String(s || '').split(/\s+/).filter(Boolean).forEach(function (p) {
    const prueba = cur ? cur + ' ' + p : p;
    if (cur && ancho(prueba, size, bold) > max) { out.push(cur); cur = p; } else cur = prueba;
  });
  if (cur) out.push(cur);
  return out.length ? out : [''];
}
Lienzo.prototype.pdf = function () {
  const objs = [];
  const n = this.paginas.length;
  // 1 catalogo, 2 paginas, 3 y 4 fuentes, despues por pagina: la pagina y su contenido.
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = [];
  for (let i = 0; i < n; i++) kids.push((5 + i * 2) + ' 0 R');
  objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  this.paginas.forEach(function (ops, i) {
    const cont = ops.join('\n');
    objs[5 + i * 2] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (6 + i * 2) + ' 0 R >>';
    objs[6 + i * 2] = '<< /Length ' + Buffer.byteLength(cont, 'latin1') + ' >>\nstream\n' + cont + '\nendstream';
  });
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offs = [];
  for (let i = 1; i < objs.length; i++) { offs[i] = Buffer.byteLength(out, 'latin1'); out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let i = 1; i < objs.length; i++) out += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
};

/* d = { doc, titulo, estado, pagado, ref, emitido, datos: [[etiqueta, valor]], servicios: [{ nombre, detalle, codigo, monto }],
         total, pagos: [{ fecha, concepto, medio, monto }], resumen: [[etiqueta, valor]], saldo, saldoTxt, pie } */
function recibo(d) {
  const L = new Lienzo(), ancho_ = W - M * 2, der = W - M;
  let y;
  function cabecera(primera) {
    L.rect(0, 0, W, 96, C.navy);
    L.pin(M + 10, 40, 11);
    L.texto(M + 30, 55, 'cuántosale', { size: 22, bold: true, color: C.blanco });
    L.texto(M + 31, 70, 'Tu viaje, sin sorpresas', { size: 8.5, color: C.claro });
    L.texto(der, 40, d.doc.toUpperCase(), { size: 9.5, bold: true, color: C.mostaza, align: 'right' });
    L.texto(der, 57, 'Ref ' + d.ref, { size: 12, bold: true, color: C.blanco, align: 'right' });
    L.texto(der, 72, 'Emitido el ' + d.emitido + (primera ? '' : ' · continuación'), { size: 8.5, color: C.claro, align: 'right' });
    y = 132;
  }
  function lugar(h) { if (y + h > H - 90) { L.nueva(); cabecera(false); } }
  function seccion(t) { lugar(40); L.texto(M, y, t.toUpperCase(), { size: 8.5, bold: true, color: C.gris }); y += 8; L.linea(M, y, der, y, C.linea, 1); y += 16; }

  cabecera(true);
  L.texto(M, y, d.titulo, { size: 20, bold: true });
  y += 16;
  const est = d.estado.toUpperCase(), wEst = ancho(est, 9, true) + 22;
  L.rect(M, y, wEst, 20, d.pagado ? C.verdeSuave : C.mostazaSuave, 10);
  L.texto(M + 11, y + 13.5, est, { size: 9, bold: true, color: d.pagado ? C.verde : C.marron });
  y += 38;

  // Datos del viaje en una caja de dos columnas
  const filas = Math.ceil(d.datos.length / 2), alto = filas * 38 + 14;
  L.rect(M, y, ancho_, alto, C.suave, 10);
  d.datos.forEach(function (x, i) {
    const cx = M + 16 + (i % 2) * (ancho_ / 2), cy = y + 22 + Math.floor(i / 2) * 38;
    L.texto(cx, cy, x[0].toUpperCase(), { size: 7.5, bold: true, color: C.gris });
    L.texto(cx, cy + 15, cortar(x[1], 11, true, ancho_ / 2 - 28)[0], { size: 11, bold: true });
  });
  y += alto + 30;

  seccion('Servicios');
  d.servicios.forEach(function (s) {
    const lineas = cortar(s.nombre, 10.5, true, ancho_ - 110), extra = [s.detalle, s.codigo ? 'Código del operador: ' + s.codigo : ''].filter(Boolean);
    lugar(lineas.length * 14 + extra.length * 12 + 14);
    lineas.forEach(function (t, i) { L.texto(M, y + i * 14, t, { size: 10.5, bold: true }); });
    if (s.monto) L.texto(der, y, s.monto, { size: 10.5, bold: true, align: 'right' });
    let yy = y + (lineas.length - 1) * 14;
    extra.forEach(function (t) { yy += 13; L.texto(M, yy, cortar(t, 9, false, ancho_ - 110)[0], { size: 9, color: C.gris }); });
    y = yy + 11; L.linea(M, y, der, y, C.linea); y += 18;
  });
  L.texto(M, y, 'Total de la reserva', { size: 11, bold: true });
  L.texto(der, y, d.total, { size: 11, bold: true, align: 'right' });
  y += 34;

  seccion('Pagos');
  d.pagos.forEach(function (p) {
    lugar(26);
    L.texto(M, y, p.fecha, { size: 10, color: C.gris });
    L.texto(M + 90, y, p.concepto + (p.medio ? ' (' + p.medio + ')' : ''), { size: 10, bold: true });
    L.texto(der, y, p.monto, { size: 10, bold: true, align: 'right' });
    y += 9; L.linea(M, y, der, y, C.linea); y += 17;
  });

  // Resumen: lo pagado y el saldo, destacado
  lugar(110);
  y += 4;
  const rh = d.resumen.length * 22 + 50;
  L.rect(M, y, ancho_, rh, C.suave, 10);
  d.resumen.forEach(function (r, i) {
    L.texto(M + 16, y + 24 + i * 22, r[0], { size: 10.5, color: C.gris });
    L.texto(der - 16, y + 24 + i * 22, r[1], { size: 10.5, bold: true, align: 'right' });
  });
  const ys = y + rh - 34;
  L.rect(M + 10, ys, ancho_ - 20, 26, d.pagado ? C.verdeSuave : C.mostazaSuave, 8);
  L.texto(M + 22, ys + 17, d.saldoTxt, { size: 10.5, bold: true, color: d.pagado ? C.verde : C.marron });
  L.texto(der - 22, ys + 17, d.saldo, { size: 12, bold: true, color: d.pagado ? C.verde : C.marron, align: 'right' });
  y += rh;

  // Pie en cada pagina
  const total = L.paginas.length;
  L.paginas.forEach(function (_, i) {
    L.paginas[i].push('');
    const pie = new Lienzo();
    pie.linea(M, H - 62, der, H - 62, C.linea, 1);
    pie.texto(M, H - 46, d.pie[0], { size: 8.5, color: C.gris });
    pie.texto(M, H - 34, d.pie[1], { size: 8.5, color: C.gris });
    if (total > 1) pie.texto(der, H - 46, 'Página ' + (i + 1) + ' de ' + total, { size: 8.5, color: C.gris, align: 'right' });
    L.paginas[i] = L.paginas[i].concat(pie.paginas[0]);
  });
  return L.pdf();
}

/* Manifiesto de una salida, para el guia o el chofer: un bloque por reserva con quien viaja, cuantos son, de donde se
   los pasa a buscar, su WhatsApp, si ya pagaron y las notas. Mismo encabezado que el recibo, sin montos.
   d = { titulo, fecha, emitido, datos: [[etiqueta, valor]], filas: [{ cliente, pax, pickup, telefono, pago, pagado,
         pasajeros, notas, aviso }], pie: [linea1, linea2] } */
function manifiesto(d) {
  const L = new Lienzo(), ancho_ = W - M * 2, der = W - M;
  let y;
  function cabecera(primera) {
    L.rect(0, 0, W, 96, C.navy);
    L.pin(M + 10, 40, 11);
    L.texto(M + 30, 55, 'cuántosale', { size: 22, bold: true, color: C.blanco });
    L.texto(M + 31, 70, 'Manifiesto de pasajeros', { size: 8.5, color: C.claro });
    L.texto(der, 40, 'MANIFIESTO', { size: 9.5, bold: true, color: C.mostaza, align: 'right' });
    L.texto(der, 57, d.fecha, { size: 12, bold: true, color: C.blanco, align: 'right' });
    L.texto(der, 72, 'Emitido el ' + d.emitido + (primera ? '' : ' · continuación'), { size: 8.5, color: C.claro, align: 'right' });
    y = 132;
  }
  function lugar(h) { if (y + h > H - 90) { L.nueva(); cabecera(false); } }

  cabecera(true);
  cortar(d.titulo, 18, true, ancho_).slice(0, 3).forEach(function (t) { L.texto(M, y, t, { size: 18, bold: true }); y += 22; });
  const filasDatos = Math.ceil(d.datos.length / 2), alto = filasDatos * 38 + 14;
  L.rect(M, y, ancho_, alto, C.suave, 10);
  d.datos.forEach(function (x, i) {
    const cx = M + 16 + (i % 2) * (ancho_ / 2), cy = y + 22 + Math.floor(i / 2) * 38;
    L.texto(cx, cy, x[0].toUpperCase(), { size: 7.5, bold: true, color: C.gris });
    L.texto(cx, cy + 15, cortar(x[1], 11, true, ancho_ / 2 - 28)[0], { size: 11, bold: true });
  });
  y += alto + 26;

  L.texto(M, y, 'RESERVAS', { size: 8.5, bold: true, color: C.gris }); y += 8; L.linea(M, y, der, y, C.linea, 1); y += 20;
  d.filas.forEach(function (r, n) {
    const extra = [
      r.pickup ? 'Pickup: ' + r.pickup : 'Pickup: a confirmar',
      r.telefono ? 'WhatsApp: ' + r.telefono : '',
      r.pasajeros ? 'Pasajeros: ' + r.pasajeros : '',
      r.notas ? 'Notas: ' + r.notas : ''
    ].filter(Boolean);
    const lineas = []; extra.forEach(function (t) { cortar(t, 9.5, false, ancho_ - 20).forEach(function (l) { lineas.push(l); }); });
    lugar(26 + lineas.length * 13 + (r.aviso ? 14 : 0));
    L.texto(M, y, (n + 1) + '. ' + r.cliente + '  ·  ' + r.pax + (r.pax === 1 ? ' persona' : ' personas'), { size: 11, bold: true });
    const est = String(r.pago || '').toUpperCase();
    if (est) {
      const w = ancho(est, 8, true) + 16;
      L.rect(der - w, y - 11, w, 16, r.pagado ? C.verdeSuave : C.mostazaSuave, 8);
      L.texto(der - 8, y, est, { size: 8, bold: true, color: r.pagado ? C.verde : C.marron, align: 'right' });
    }
    lineas.forEach(function (t, i) { L.texto(M + 14, y + 15 + i * 13, t, { size: 9.5, color: C.tinta }); });
    y += 15 + lineas.length * 13;
    if (r.aviso) { y += 1; L.texto(M + 14, y + 13, r.aviso, { size: 9.5, bold: true, color: '#B42318' }); y += 14; }
    y += 6; L.linea(M, y, der, y, C.linea); y += 18;
  });
  if (!d.filas.length) { L.texto(M, y, 'Sin reservas para esta salida.', { size: 10.5, color: C.gris }); y += 20; }

  const total = L.paginas.length;
  L.paginas.forEach(function (_, i) {
    const pie = new Lienzo();
    pie.linea(M, H - 62, der, H - 62, C.linea, 1);
    pie.texto(M, H - 46, d.pie[0], { size: 8.5, color: C.gris });
    pie.texto(M, H - 34, d.pie[1], { size: 8.5, color: C.gris });
    if (total > 1) pie.texto(der, H - 46, 'Página ' + (i + 1) + ' de ' + total, { size: 8.5, color: C.gris, align: 'right' });
    L.paginas[i] = L.paginas[i].concat(pie.paginas[0]);
  });
  return L.pdf();
}

module.exports = { recibo: recibo, manifiesto: manifiesto, _ancho: ancho, _win: win };
