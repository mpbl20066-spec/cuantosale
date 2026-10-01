'use strict';
/* Convierte un logo PNG con fondo blanco en PNG transparente y lo recorta al
   contenido. Uso: node scripts/logo-transparente.js entrada.png salida.png
   El alfa sale de cuanto se aleja cada pixel del blanco y el color se
   recompone sobre ese alfa, asi los bordes suavizados no dejan halo blanco. */
const fs = require('fs');
const zlib = require('zlib');
function crc32(buf) { let c, crc = -1; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function chunk(tipo, datos) { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const t = Buffer.concat([Buffer.from(tipo), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(t)); return Buffer.concat([l, t, c]); }
function leer(buf) {
  let pos = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos), tipo = buf.toString('ascii', pos + 4, pos + 8), d = buf.subarray(pos + 8, pos + 8 + len); if (tipo === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[12] !== 0) throw new Error('solo PNG 8 bits sin entrelazar'); ct = d[9]; } if (tipo === 'IDAT') idat.push(d); pos += 12 + len; }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error('color type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
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
const [,, entrada, salida, umbral] = process.argv;
const UMBRAL = Number(umbral) || 0.04;
const im = leer(fs.readFileSync(entrada));
const rgba = Buffer.alloc(im.w * im.h * 4);
let x0 = im.w, y0 = im.h, x1 = -1, y1 = -1;
for (let i = 0; i < im.w * im.h; i++) {
  const r = im.px[i * im.bpp], g = im.px[i * im.bpp + 1], b = im.px[i * im.bpp + 2], aIn = im.bpp === 4 ? im.px[i * 4 + 3] / 255 : 1;
  const m = Math.min(r, g, b); let a = (255 - m) / 255; if (a < UMBRAL) a = 0; // ruido casi blanco (fondos de cuadricula gris claro)
  a *= aIn;
  const o = i * 4;
  if (a > 0) { const k = (255 - m) / 255; rgba[o] = Math.max(0, Math.min(255, Math.round((r - (1 - k) * 255) / k))); rgba[o + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - k) * 255) / k))); rgba[o + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - k) * 255) / k))); rgba[o + 3] = Math.round(a * 255);
    const x = i % im.w, y = (i / im.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
const pad = 2; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(im.w - 1, x1 + pad); y1 = Math.min(im.h - 1, y1 + pad);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1, filas = [];
for (let y = y0; y <= y1; y++) filas.push(Buffer.from([0]), rgba.subarray((y * im.w + x0) * 4, (y * im.w + x1 + 1) * 4));
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cw, 0); ihdr.writeUInt32BE(ch, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(salida, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(filas))), chunk('IEND', Buffer.alloc(0))]));
console.log(salida, cw + 'x' + ch);
