/* Verifica la app nueva (/nuevo): rutas limpias, redirecciones 301 y que el recorrido principal funcione de punta a punta.
   Uso: node scripts/check-test.js [url_base]   (por defecto levanta el servidor local en un puerto libre)
   Requiere Chrome instalado (playwright-core usa el del sistema, no descarga navegadores). */
'use strict';
const http = require('http');
const path = require('path');

const PAGINAS = ['', 'destinos', 'presupuesto', 'planificar', 'ruta', 'detalle', 'resumen', 'reserva', 'guias', 'guia'];
const VIEJAS = {
  '/test': '/nuevo', '/test/': '/nuevo', '/test/home-dos-caminos.html': '/nuevo', '/test/home-destino.html': '/nuevo/destinos',
  '/test/home-flujo.html?destino=rio&pax=2': '/nuevo/planificar?destino=rio&pax=2', '/test/HOME-calcular.html': '/nuevo/ruta',
  '/nuevo/': '/nuevo', '/NUEVO/Destinos': '/nuevo/destinos', '/nuevo/destinos/': '/nuevo/destinos'
};
let fallas = 0;
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALLA ') + m); if (!c) fallas++; };

function pedir(base, ruta) {
  return new Promise(function (resolve, reject) {
    http.get(base + ruta, function (r) { let b = ''; r.on('data', function (d) { b += d; }); r.on('end', function () { resolve({ status: r.statusCode, loc: r.headers.location, body: b }); }); }).on('error', reject);
  });
}

async function main() {
  let base = process.argv[2], srv = null;
  if (!base) {
    srv = require(path.join(__dirname, '..', 'server.js')).createServer();
    await new Promise(function (r) { srv.listen(0, r); });
    base = 'http://127.0.0.1:' + srv.address().port;
  }
  /* 1. Rutas limpias */
  for (const p of PAGINAS) {
    const ruta = '/nuevo' + (p ? '/' + p : ''), r = await pedir(base, ruta);
    ok(r.status === 200, ruta + ' -> ' + r.status);
    ok(!/home-[a-z-]+\.html/.test(r.body), ruta + ' no deja enlaces a archivos .html');
    ok(/noindex/.test(r.body), ruta + ' lleva noindex');
  }
  /* 2. Redirecciones: 301, un solo salto, conservan la consulta */
  for (const o of Object.keys(VIEJAS)) {
    const r = await pedir(base, o), destino = r.loc ? r.loc.replace(/^https?:\/\/[^/]+/, '') : null;
    ok(r.status === 301 && destino === VIEJAS[o], o + ' -> 301 ' + destino);
    if (destino) { const s = await pedir(base, destino); ok(s.status === 200, '  ' + destino + ' responde 200 (sin cadena)'); }
  }
  ok((await pedir(base, '/nuevo/xyz')).status === 404, '/nuevo/xyz -> 404');
  for (const raiz of ['/', '/app', '/grupo', '/privacidad', '/terminos', '/destino/buzios']) {
    ok((await pedir(base, raiz)).status === 200, raiz + ' sigue respondiendo 200');
  }
  /* 3. Recorrido en navegador */
  let chromium;
  try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SALTADO recorrido: falta playwright-core'); }
  if (chromium) {
    let browser;
    try { browser = await chromium.launch({ channel: 'chrome' }); } catch (e) { try { browser = await chromium.launch({ channel: 'msedge' }); } catch (e2) { console.log('SALTADO recorrido: no hay Chrome/Edge'); } }
    if (browser) {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const pg = await ctx.newPage();
      await pg.addInitScript(function () { try { localStorage.setItem('cs_consent', 'denied'); } catch (e) { /* sin storage */ } });   /* sin banner de cookies tapando el boton */
      const errores = [], malas = [];
      pg.on('pageerror', function (e) { errores.push(e.message); });
      pg.on('response', function (r) { if (r.status() >= 400 && r.url().indexOf(base) === 0) malas.push(r.status() + ' ' + r.url().replace(base, '')); });
      await pg.goto(base + '/nuevo', { waitUntil: 'networkidle' });
      await pg.click('a[data-camino="ya_se_donde"]');
      await pg.waitForURL(/\/nuevo\/destinos/);
      ok(true, 'home -> /nuevo/destinos');
      await pg.click('[data-dest="rio"]');
      await pg.waitForSelector('[data-seguir]');
      await pg.click('button.d-cont[data-seguir]');
      await pg.waitForURL(/\/nuevo\/planificar\?/);
      ok(/destino=rio/.test(pg.url()), 'destino -> /nuevo/planificar con destino=rio');
      await pg.waitForSelector('#cta');
      await pg.click('#cta');                       /* vuelos -> traslados */
      await pg.click('#cta');                       /* traslados -> alojamiento */
      await pg.waitForFunction(function () { return document.getElementById('main').dataset.paso === '2'; });
      ok(true, 'flujo: vuelos -> traslados -> alojamiento');
      await pg.reload({ waitUntil: 'domcontentloaded' });
      ok(/\/nuevo\/planificar/.test(pg.url()), 'recargar una pagina interna conserva la ruta');
      await pg.goBack();
      ok(true, 'volver atras no rompe');
      ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
      ok(malas.length === 0, 'sin respuestas 4xx/5xx internas' + (malas.length ? ': ' + malas.slice(0, 5).join(', ') : ''));
      await browser.close();
    }
  }
  if (srv) srv.close();
  console.log(fallas ? '\n' + fallas + ' fallas' : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
}
main().catch(function (e) { console.error(e); process.exit(2); });
