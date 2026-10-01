'use strict';
/* Recorta un logo de una captura PNG y le saca el margen blanco.
   Uso: node scripts/recortar-logo.js captura.png salida.png x y ancho alto
   (x, y, ancho y alto del rectangulo donde esta el logo; el recorte final
   queda ajustado al contenido). No cambia los colores: el logo queda sobre su
   fondo original, que en la app es una pastilla blanca. */
const fs = require('fs');
const zlib = require('zlib');
function crc32(buf) { let c, crc = -1; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function chunk(tipo, datos) { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const t = Buffer.concat([Buffer.from(tipo), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(t)); return Buffer.concat([l, t, c]); }
function leer(buf) {
  let pos = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos), tipo = buf.toString('ascii', pos + 4, pos + 8), d = buf.subarray(pos + 8, pos + 8 + len); if (tipo === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (tipo === 'IDAT') idat.push(d); pos += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], fila = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = fila[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}
const [,, entrada, salida, X, Y, W, H] = process.argv;
const im = leer(fs.readFileSync(entrada));
const rx = +X, ry = +Y, rw = +W, rh = +H;
const blanco = (x, y) => { const o = (y * im.w + x) * im.bpp; return im.px[o] > 238 && im.px[o + 1] > 238 && im.px[o + 2] > 238; };
let x0 = rx + rw, y0 = ry + rh, x1 = rx, y1 = ry;
for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) if (!blanco(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
if (x1 < x0) throw new Error('no hay contenido en el rectangulo');
const cw = x1 - x0 + 1, ch = y1 - y0 + 1, filas = [];
for (let y = y0; y <= y1; y++) { const fila = Buffer.alloc(1 + cw * 3); for (let x = 0; x < cw; x++) { const o = (y * im.w + x0 + x) * im.bpp; fila[1 + x * 3] = im.px[o]; fila[2 + x * 3] = im.px[o + 1]; fila[3 + x * 3] = im.px[o + 2]; } filas.push(fila); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cw, 0); ihdr.writeUInt32BE(ch, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(salida, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(filas))), chunk('IEND', Buffer.alloc(0))]));
console.log(salida, cw + 'x' + ch);
