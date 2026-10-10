/* Barre las rutas de /nuevo en varios anchos y reporta scroll horizontal, elementos fuera de pantalla y uso de zoom.
   Uso: node scripts/check-responsive.js [url_base]  (necesita el servidor corriendo y Chrome instalado) */
'use strict';
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://localhost:3000';
const RUTAS = ['', 'destinos?destino=rio', 'presupuesto', 'planificar?destino=rio&pax=2&ida=2026-12-26&vuelta=2027-01-02', 'ruta?destino=fln', 'detalle?destino=fln', 'resumen', 'reserva', 'guias', 'guia'];
const TODOS = [[1280, 720], [1366, 768], [1440, 900], [1920, 1080], [320, 640], [360, 740], [375, 812], [390, 844], [430, 932], [768, 1024]];
const ANCHOS = process.argv[3] ? TODOS.filter(function (a) { return process.argv[3].split(',').indexOf(String(a[0])) >= 0; }) : TODOS;
(async function () {
  const browser = await chromium.launch({ channel: 'chrome' });
  let n = 0;
  for (const [w, h] of ANCHOS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    for (const r of RUTAS) {
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', function (e) { errs.push(e.message); });
      await pg.goto(BASE + '/' + r, { waitUntil: 'networkidle' }).catch(function () {});
      let res;
      try { await pg.waitForTimeout(400); res = await pg.evaluate(function () {
        const de = document.documentElement, W = innerWidth;
        const fuera = [];
        document.querySelectorAll('body *').forEach(function (e) {
          const cs = getComputedStyle(e);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
          const b = e.getBoundingClientRect();
          if (b.width > 0 && b.height > 0 && b.right > W + 2 && !e.closest('[hidden],.cs-top__nav,.x-car,.pv-next__g,.p-tabs,.f-chips,.fl-chips')) {
            let anc = e.parentElement, scroll = false;
            while (anc && anc !== document.body) { const o = getComputedStyle(anc).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroll = true; break; } anc = anc.parentElement; }
            if (!scroll) fuera.push((e.className && e.className.baseVal === undefined ? '.' + String(e.className).split(' ')[0] : e.tagName) + ':' + Math.round(b.right));
          }
        });
        const zoom = [...document.querySelectorAll('*')].filter(function (e) { return getComputedStyle(e).zoom !== '1'; }).length;
        return { sw: de.scrollWidth, W: W, fuera: fuera.slice(0, 4), zoom: zoom };
      }); } catch (e) { console.log('[' + w + 'x' + h + '] /nuevo/' + r.split('?')[0] + '  NO SE PUDO MEDIR: ' + String(e.message).slice(0, 80)); n++; await pg.close().catch(function () {}); continue; }
      const mal = res.sw > res.W + 1 || res.fuera.length || res.zoom || errs.length;
      if (mal) { n++; console.log('[' + w + 'x' + h + '] /nuevo/' + r.split('?')[0] + '  scrollWidth=' + res.sw + '/' + res.W + (res.fuera.length ? '  fuera=' + res.fuera.join(',') : '') + (res.zoom ? '  zoom=' + res.zoom : '') + (errs.length ? '  js=' + errs[0] : '')); }
      await pg.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(n ? '\n' + n + ' combinaciones con problemas' : '\nSin overflow en ' + ANCHOS.length * RUTAS.length + ' combinaciones');
})();
