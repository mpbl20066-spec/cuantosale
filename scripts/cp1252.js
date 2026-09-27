'use strict';
// cp1252.js: Node no soporta cp1252 en Buffer. Solo difiere de latin1 en el
// rango 0x80-0x9F, asi que alcanza con esa tabla.
'use strict';

const ESPECIAL = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F,
  // Slots que CP1252 deja sin definir. Cuando un archivo pasa por una
  // codificacion que si los define, aparecen igual en el mojibake, asi que
  // hay que mapearlos por identidad o el tramo no se puede procesar.
  0x0081: 0x81, 0x008D: 0x8D, 0x008F: 0x8F, 0x0090: 0x90, 0x009D: 0x9D
};

const INVERSA = {};   // byte -> code point (para DECODIFICAR cp1252)
const A_BYTE = {};    // code point -> byte (para CODIFICAR a cp1252)
for (const [cp, byte] of Object.entries(ESPECIAL)) {
  INVERSA[Number(byte)] = Number(cp);
  A_BYTE[Number(cp)] = Number(byte);
}

/** Codifica un string a bytes CP1252. Lanza si hay un caracter sin representacion. */
function aCp1252(str) {
  const out = Buffer.alloc(str.length);
  let i = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xFF && !(cp >= 0x80 && cp <= 0x9F)) { out[i++] = cp; continue; }
    if (A_BYTE[cp] !== undefined) { out[i++] = A_BYTE[cp]; continue; }
    const err = new Error('cp1252 no puede representar U+' + cp.toString(16).toUpperCase());
    err.code = 'NO_CP1252';
    err.codePoint = cp;
    throw err;
  }
  return out.subarray(0, i);
}

/** Bytes CP1252 -> string (equivale a Buffer#toString('latin1') con la tabla). */
function deCp1252(buf) {
  let s = '';
  for (const b of buf) s += INVERSA[b] !== undefined ? String.fromCodePoint(INVERSA[b]) : String.fromCharCode(b);
  return s;
}

module.exports = { aCp1252, deCp1252 };
