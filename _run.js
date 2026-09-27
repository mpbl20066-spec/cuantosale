'use strict';
const assert = require('assert');
const http = require('http');
const model = require('./lib/model');
const fs = require('fs');
const path = require('path');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FALLÓ  ' + name + '\n', e); process.exitCode = 1; }
}
function post(port, path, value) {
  return new Promise(function (resolve, reject) {
    const request = http.request({ port: port, path: path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, function (res) {
      let body = ''; res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () { resolve({ status: res.statusCode, body: body, headers: res.headers }); });
    });
    request.on('error', reject); request.end(JSON.stringify(value));
  });
}
function get(port, path, headers) {
  return new Promise(function (resolve, reject) {
    const opts = { port: port, path: path };
    if (headers) opts.headers = headers;
    http.get(opts, function (res) {
      let b = ''; res.on('data', function (c) { b += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: b, headers: res.headers }); });
    }).on('error', reject);
  });
}
function basic(user, pass) {
  return { Authorization: 'Basic ' + Buffer.from(user + ':' + pass, 'utf8').toString('base64') };
}
const today = model.getToday();
const dep = model.iso(model.addDays(today, 60));
const ret = model.iso(model.addDays(today, 67));
const q = 'dest=fln&dep=' + dep + '&ret=' + ret + '&pax=2&budget=3000&style=eq';

// Distancia en línea recta entre dos puntos, en km. Es la cota inferior de
// cualquier ruta por carretera: ningún camino puede ser más corto que el
// vuelo de pájaro. Sirve para detectar kilómetros inventados.
function haversineKm(a, b) {
  const R = 6371, rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}


(async function main() {
  console.log('Guia Secreta');
  const GUIAS_SECCIONES = ['beaches', 'atracciones', 'comer', 'hacer', 'tips'];
  const GUIAS_FUENTE = path.join(__dirname, 'public', 'guias.js');

  // guiAs.js publica window.CS_GUIAS porque lo carga el browser. Para poder
  // requirearlo desde aca se simula window y se saca del cache: sin el
  // delete, el segundo require devuelve el objeto viejo.
  function cargarGuias() {
    const previo = global.window;
    global.window = {};
    try {
      delete require.cache[require.resolve(GUIAS_FUENTE)];
      require(GUIAS_FUENTE);
      return global.window.CS_GUIAS;
    } finally {
      if (previo === undefined) delete global.window; else global.window = previo;
    }
  }

  await t('guias: cada destino de DEST recibe una guia', function () {
    const G = cargarGuias();
    const cov = G.cobertura(model.DEST);
    assert.deepStrictEqual(cov.sinGuia, [], 'destinos sin guia: ' + cov.sinGuia.join(', '));
    assert.strictEqual(cov.propio + cov.regional, Object.keys(model.DEST).length);
  });

  await t('guias: la region resuelve aunque el nombre tenga tilde', function () {
    const G = cargarGuias();
    // "Ceará" y "Ceara" son dos strings distintas. Comparar contra el nombre
    // crudo dejaba 8 de 13 regiones sin resolver, en silencio: no tira error,
    // devuelve null y el destino cae en "sin guia".
    ['Ceará', 'Paraíba', 'Río de Janeiro', 'São Paulo', 'Bahía', 'Río Grande do Sul'].forEach(function (region) {
      assert.ok(G.guiaPara('fln', region), 'la region "' + region + '" no resolvio');
    });
    assert.strictEqual(G.regionSlug('Ceará'), 'ceara');
    assert.strictEqual(G.regionSlug('Río Grande do Norte'), 'rio-grande-do-norte');
    // Con y sin tilde tienen que dar el mismo slug.
    assert.strictEqual(G.regionSlug('Maceió'), G.regionSlug('Maceio'));
  });

  await t('guias: ninguna referencia a la API quedo con tilde', function () {
    const src = fs.readFileSync(GUIAS_FUENTE, 'utf8');
    // Regresión: un pase de acentes renombró "region" a "región" y dejó
    // coberturaGuias() leyendo d.región, que en DEST es d.region. La cobertura
    // entera daba 0 sin tirar error. Estas referencias con tilde no existen.
    ['dest.región', 'd.región', 'meta.dest.región', 'DEST[].región', 'version: CACHE_VERSION con tilde']
      .forEach(function (roto) { assert.ok(src.indexOf(roto) === -1, 'quedo roto: ' + roto); });
    assert.match(src, /version:\s*CACHE_VERSION/, 'el export version: cambio');
    assert.match(src, /function regionSlug\(region\)/, 'el parametro de regionSlug cambio');
  });

  await t('guias: la clave del schema es `cuando`, sin tilde', function () {
    const G = cargarGuias();
    // Regresión: el mismo pase renombró la clave "cuando" de las 19 playas a
    // "cuándo". El render lee b.cuando y recibía undefined, así que la línea
    // "Cuándo" desaparecía de cada playa sin que nada se quejara.
    const todas = Object.assign({}, G.guias, G.regiones);
    let revisadas = 0;
    Object.keys(todas).forEach(function (k) {
      (todas[k].beaches || []).forEach(function (b) {
        revisadas++;
        assert.notStrictEqual(b.cuando, undefined, k + ' / ' + b.name + ': falta la clave cuando');
      });
    });
    assert.ok(revisadas > 15, 'se esperaban mas de 15 playas, hay ' + revisadas);
  });

  await t('guias: "si" condicional no quedo como "sí" afirmativa', function () {
    const src = fs.readFileSync(GUIAS_FUENTE, 'utf8');
    // Mismo pase, distinto caso: "si lo pides" paso a "sí lo pides". No se
    // puede revisar con un reemplazo general porque "si" y "sí" dependen del
    // sentido de la frase, asi que se listan los que se rompiaron.
    ['sí lo pides', 'sí fuera', 'sí vas a', 'sí hacés', 'Auto solo sí']
      .forEach(function (roto) { assert.ok(src.indexOf(roto) === -1, 'quedo roto: "' + roto + '"'); });
  });

  await t('guias: cada seccion tiene los campos que el render lee', function () {
    const G = cargarGuias();
    const todas = Object.assign({}, G.guias, G.regiones);
    Object.keys(todas).forEach(function (k) {
      const g = todas[k];
      assert.ok(g.resumen, k + ': falta resumen');
      GUIAS_SECCIONES.forEach(function (s) {
        if (g[s] === undefined) return;
        assert.ok(Array.isArray(g[s]), k + '.' + s + ' no es un array');
        g[s].forEach(function (item, i) {
          const etiqueta = k + '.' + s + '[' + i + ']';
          if (s === 'tips') assert.ok(item.titulo && item.texto, etiqueta + ' sin titulo o texto');
          else assert.ok(item.name, etiqueta + ' sin name');
          if (s === 'beaches') assert.notStrictEqual(item.cuando, undefined, etiqueta + ' sin cuando');
          if (s === 'comer') assert.notStrictEqual(item.momento, undefined, etiqueta + ' sin momento');
          if (s === 'atracciones' || s === 'hacer') assert.notStrictEqual(item.dur, undefined, etiqueta + ' sin dur');
          if (item.usd !== undefined) {
            assert.strictEqual(typeof item.usd, 'number', etiqueta + ': usd tiene que ser numero');
            assert.ok(isFinite(item.usd) && item.usd >= 0, etiqueta + ': usd invalido ' + item.usd);
          }
        });
      });
    });
  });

  await t('guias: no hay items repetidos dentro de una seccion', function () {
    const G = cargarGuias();
    Object.keys(model.DEST).forEach(function (dk) {
      const g = G.guiaPara(dk, model.DEST[dk].region);
      assert.ok(g, dk + ' quedo sin guia al resolver');
      GUIAS_SECCIONES.forEach(function (s) {
        // Los tips se identifican por `titulo`; el resto, por `name`. Con la
        // clave equivocada todos dan undefined y marca duplicado falso.
        const clave = s === 'tips' ? 'titulo' : 'name';
        const nombres = (g[s] || []).map(function (x) { return x[clave]; });
        const repetidos = nombres.filter(function (n, i) { return nombres.indexOf(n) !== i; });
        assert.deepStrictEqual(repetidos, [], dk + '/' + s + ' repetidos: ' + [...new Set(repetidos)].join(', '));
      });
    });
  });

  await t('guias: el texto no tiene caracteres fuera del alfabeto latino', function () {
    const src = fs.readFileSync(GUIAS_FUENTE, 'utf8');
    const lineas = src.split(/\r?\n/);
    const desde = lineas.findIndex(function (l) { return l.indexOf('var GUIAS') === 0; });
    assert.ok(desde > 0, 'no se encontro el bloque de datos');
    // Al escribir la prosa se colaron caracteres CJK y cirilicos en el medio de
    // frases en espanol. Se detectan leyendo, pero un caracter fuera del
    // alfabeto latino es inequivoco.
    lineas.slice(desde).forEach(function (l, i) {
      assert.ok(!/[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff]/.test(l),
        'caracter fuera del alfabeto en la linea ' + (desde + i + 1) + ': ' + l.trim().slice(0, 60));
    });
  });

  await t('guias: los precios de comida no superan un dia de comida', function () {
    const G = cargarGuias();
    const food = model.REAL_COSTS.foodPerDay;
    // Object.assign devuelve un objeto, no un array: hay que iterar por
    // Object.keys. Con .forEach directo tira TypeError.
    const todas = Object.assign({}, G.guias, G.regiones);
    Object.keys(todas).forEach(function (k) {
      (todas[k].comer || []).forEach(function (c) {
        if (c.usd === undefined) return;
        assert.ok(c.usd <= food.confort, k + ' / ' + c.name + ': usd ' + c.usd + ' supera el foodPerDay de confort');
        assert.ok(c.usd >= 1, k + ' / ' + c.name + ': usd ' + c.usd + ' no es un precio de comida');
      });
    });
  });

  await t('guias: la guia de ciudad se mezcla con la regional sin pisarse', function () {
    const G = cargarGuias();
    // sao tiene guia propia y su region tambien es sao-paulo. La ciudad
    // declara beaches: [] explicito, y eso tiene que GANARLE a la regional,
    // que si tiene una entrada de costa.
    const sao = G.guiaPara('sao', model.DEST.sao.region);
    assert.deepStrictEqual(sao.beaches, [], 'la ciudad perdio el beaches vacio explicito');
    // Y donde la ciudad no define nada, tiene que aparecer lo suyo.
    const fln = G.guiaPara('fln', model.DEST.fln.region);
    assert.ok(fln.beaches.length >= 5, 'fln quedo con pocas playas: ' + fln.beaches.length);
    assert.ok((fln.atracciones || []).length >= 3, 'fln quedo sin atracciones propias');
  });

  await t('guias: toda foto de playa esta acreditada', function () {
    const G = cargarGuias();
    const creditos = require('./public/creditos-fotos.generated.js');
    let vistas = 0;
    Object.keys(model.DEST).forEach(function (dk) {
      const g = G.guiaPara(dk, model.DEST[dk].region);
      (g.beaches || []).forEach(function (b) {
        if (!b.foto) return;
        vistas++;
        assert.ok(creditos[b.foto], dk + ' / ' + b.name + ': la foto no esta en la tabla de creditos');
        assert.ok(creditos[b.foto].autor, dk + ' / ' + b.name + ': credito sin autor');
        assert.ok(creditos[b.foto].licencia, dk + ' / ' + b.name + ': credito sin licencia');
      });
    });
    assert.ok(vistas > 0, 'no hay ninguna foto de playa para verificar');
  });

  await t('guias: la tabla de creditos no perdio fotos ya acreditadas', function () {
    // creditos-fotos.js sobreescribia una tabla completa con una parcial
    // cuando se lo cortaba a mitad de camino, y seis fotos quedaban
    // publicadas sin licencia. El script ahora no escribe si la corrida da
    // menos creditos de los que ya habia; esto es la segunda linea.
    const creditos = require('./public/creditos-fotos.generated.js');
    const total = Object.keys(creditos).length;
    assert.ok(total >= 35, 'la tabla quedo con ' + total + ' entradas: parece una corrida incompleta');
    Object.keys(creditos).forEach(function (u) {
      assert.ok(creditos[u].autor && creditos[u].licencia, 'credito incompleto para ' + u);
    });
  });

  await t('guias: DEST_PHOTOS cubre los 44 destinos', function () {
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const m = app.match(/var DEST_PHOTOS = \{([\s\S]*?)\r?\n  \};/);
    assert.ok(m, 'no se encontro DEST_PHOTOS en app.js');
    const claves = [...m[1].matchAll(/^\s{4}(\w+):/gm)].map(function (x) { return x[1]; });
    const faltan = Object.keys(model.DEST).filter(function (k) { return claves.indexOf(k) === -1; });
    assert.deepStrictEqual(faltan, [], 'destinos sin foto de portada: ' + faltan.join(', '));
  });

  await t('app: toursFor esta definida una vez y no usa LAST_DEST_NAMES', function () {
    const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    assert.strictEqual((app.match(/function toursFor\(/g) || []).length, 1, 'toursFor duplicada o faltante');
    assert.strictEqual((app.match(/function localToursMarkup\(/g) || []).length, 1, 'localToursMarkup duplicada o faltante');
    assert.ok(app.indexOf('LAST_DEST_NAMES') === -1, 'quedo una referencia a LAST_DEST_NAMES, que no existe');
    assert.match(app, /window\.CS_TOURS = toursFor/, 'falta exponer CS_TOURS para la guia');
  });



  console.log("\n" + passed + " pruebas OK" + (process.exitCode ? " (con fallas)" : ""));
})();
