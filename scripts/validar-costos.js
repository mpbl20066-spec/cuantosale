'use strict';
// Valida data/costos-diarios.json: que parse, que cubra todos los destinos del
// modelo, y que no tenga caracteres no esperados (se colaron algunos).
const fs = require('fs');
const path = require('path');
const model = require('../lib/model.js');

const RUTA = path.join(__dirname, '..', 'data', 'costos-diarios.json');
let errores = 0, avisos = 0;
const err = (m) => { console.log('  FALLA ' + m); errores++; };
const av = (m) => { console.log('  aviso  ' + m); avisos++; };

let datos;
try { datos = JSON.parse(fs.readFileSync(RUTA, 'utf8')); }
catch (e) { console.log('  FALLA JSON no parsea: ' + e.message); process.exit(1); }

const D = datos.destinos;
const claves = Object.keys(D);
const delModelo = Object.keys(model.DEST);
const delCodigo = Object.keys(model.DESTINATION_COSTS);

console.log('destinos en el JSON: ' + claves.length + ' | en DEST: ' + delModelo.length + ' | en DESTINATION_COSTS: ' + delCodigo.length + '\n');

// 1. cobertura
for (const k of delModelo) if (!D[k]) err('falta ' + k + ' (' + model.DEST[k].name + ')');
for (const k of claves) if (!delModelo.includes(k)) err(k + ' esta en el JSON pero no en DEST');
for (const k of delCodigo) if (!D[k]) err('falta ' + k + ' en el JSON (esta en el codigo)');

// 2. forma de los valores
const NIVELES = { alta: 1, media: 2, baja: 3 };
for (const [k, v] of Object.entries(D)) {
  for (const campo of ['comida', 'traslado']) {
    if (!v[campo]) { err(k + ' sin ' + campo); continue; }
    for (const [sub, val] of Object.entries(v[campo])) {
      if (typeof val !== 'number' || !Number.isFinite(val)) err(k + '.' + campo + '.' + sub + ' no es numero: ' + val);
      else if (val <= 0 || val > 500) err(k + '.' + campo + '.' + sub + ' fuera de rango: ' + val);
    }
  }
  const c = v.comida, t = v.traslado;
  if (c && t) {
    if (!(c.casual < c.moderado && c.moderado < c.gourmet)) err(k + ': comida no crece ' + JSON.stringify(c));
    // El traslado tiene TRES niveles desde que se agrego el medio. Con dos, el
    // tier intermedio caia a "eco" y por eso la comprobacion de abajo es de tres
    // eslabones y no de dos.
    if (!(t.eco < t.medio && t.medio < t.confort)) err(k + ': traslado no crece ' + JSON.stringify(t));
    // El medio es DERIVADO (media geometrica de los otros dos). Si alguien lo
    // cambia a mano, tiene que decidir si sigue siendo derivado o si ahora hay
    // una fuente nueva que documentar en "fuente".
    if (t.medio !== Math.round(Math.sqrt(t.eco * t.confort)) && !v.fuenteMedio) {
      err(k + ': traslado.medio (' + t.medio + ') no es la media geometrica de ' + t.eco + ' y ' + t.confort + ' y no hay "fuenteMedio" que lo respalde');
    }
  }
  if (!v.fuente) err(k + ' sin "fuente"');
  if (!v.verificado) err(k + ' sin "verificado"');
  if (!v.confianza || !NIVELES[v.confianza]) err(k + ' confianza invalida: ' + v.confianza);
  // "baja" cubre dos cosas: fuente directe finita (angra) o derivacion de otro
  // destino. En los dos casos tiene que quedar escrito por que.
  if (v.confianza === 'baja' && !v.derivacion && !v.nota) err(k + ' es confianza baja y no explica ni la derivacion ni el problema de la fuente');
}

// 3. caracteres no esperados: CJK colado en las notas
for (const [k, v] of Object.entries(D)) {
  for (const campo of ['fuente', 'nota', 'derivacion']) {
    const t = v[campo];
    if (!t) continue;
    const malos = [...t].filter((c) => {
      const p = c.codePointAt(0);
      return (p >= 0x3000 && p <= 0x9FFF) || (p >= 0xF900 && p <= 0xFAFF) || (p >= 0xFF00 && p <= 0xFFEF);
    });
    if (malos.length) err(k + '.' + campo + ' tiene caracteres CJK: ' + JSON.stringify(malos.join('')));
    if (/\bconMuy\b|\s{3,}/.test(t)) err(k + '.' + campo + ' tiene un typo o espaciado raro');
    // Palabras en ingles coladas. Estos tres textos salen a la pantalla tal cual
    // en el panel "De donde salen los valores", asi que una palabra en ingles ya
    // no es un dato sucio: es texto que el usuario lee. Aparecio uno ("Copia
    // practically de for/jericoacoara" en la derivacion de buz).
    const ingles = t.match(/\b(practically|basically|actually|literally|probably|without|average|copy)\b/gi);
    if (ingles) err(k + '.' + campo + ' tiene palabras en ingles: ' + [...new Set(ingles)].join(', '));
  }
}

// 4. resumen de confianza
const porNivel = { alta: [], media: [], baja: [] };
for (const [k, v] of Object.entries(D)) porNivel[v.confianza].push(k);
console.log('confianza alta : ' + porNivel.alta.length + '  (' + porNivel.alta.join(', ') + ')');
console.log('confianza media: ' + porNivel.media.length);
console.log('confianza baja : ' + porNivel.baja.length + '  (' + porNivel.baja.join(', ') + ')');
console.log('');
console.log(errores ? errores + ' ERRORES, ' + avisos + ' avisos' : 'sin errores' + (avisos ? ', ' + avisos + ' avisos' : ''));
process.exit(errores ? 1 : 0);
