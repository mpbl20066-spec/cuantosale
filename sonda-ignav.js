'use strict';
/* node sonda-ignav.js [--serpapi]
 * Compara tarifas de vuelo MVD -> destino con Ignav (siempre) y con SerpAPI
 * (solo con --serpapi, porque gasta creditos). 2 pasajeros, ida y vuelta. */
const fs = require('fs'), path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (l) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* sin .env */ }
const ignav = require('./lib/providers/ignav');
const serpapi = require('./lib/providers/serpapi');
const conSerp = process.argv.includes('--serpapi');
const todas = [['GIG', '2026-12-25', '2027-01-01'], ['FLN', '2026-12-26', '2027-01-02'], ['SSA', '2027-01-10', '2027-01-17'],
  ['GRU', '2027-02-05', '2027-02-12'], ['REC', '2027-01-20', '2027-01-27'], ['NAT', '2027-03-05', '2027-03-12']];
const rutas = todas.slice(0, Number(process.env.SONDA_N) || todas.length);
(async () => {
  for (const [dest, dep, ret] of rutas) {
    const input = { origin: 'MVD', destination: dest, dep, ret, style: 'eq', passengers: 2 };
    const t0 = Date.now();
    let a, b = null;
    try { a = await ignav.getFlightQuote(input); } catch (e) { a = 'ERR ' + e.message; }
    const ms = Date.now() - t0;
    if (conSerp) { try { b = await serpapi.getFlightQuote(input); } catch (e) { b = 'ERR ' + e.message; } }
    const f = (q) => !q ? 'sin datos' : typeof q === 'string' ? q : 'US$ ' + Math.round(q.pp * 2) + ' (2 pax) ' + (q.airline || '') + ' esc:' + q.transfers;
    console.log('MVD>' + dest + ' ' + dep + '/' + ret + '  ignav: ' + f(a) + ' [' + ms + 'ms]' + (conSerp ? '   serpapi: ' + f(b) : ''));
  }
})();
