/* Tarjeta para compartir el viaje (formato historia 9:16, 540x960). Es la misma tarjeta que genera la app de la raiz
   (buildStoryCardNode en app.js): foto del destino a pantalla completa, degradado oscuro, destino, fechas, personas,
   precio por persona, total y el desglose por rubro con su barra de colores.

   Como se comparte (igual que la app):
   - Celular: hoja de compartir del sistema con la imagen y el texto (Web Share con archivos).
   - Escritorio: se abre WhatsApp con el texto y la imagen queda copiada para pegarla (Ctrl+V); si el navegador no deja
     copiar, se descarga.
   La imagen se prepara de antemano (precalentar) para que el toque en "Compartir" arranque dentro del gesto del usuario,
   que es lo unico que deja usar navigator.share.

   Uso: CSTarjeta.compartir(datos) -> Promise<'compartido'|'copiada'|'descargada'|'cancelado'>
   datos = { dest: { key, name, country }, ida, vuelta, pax, pp, total, entries: [{ category, label, value, color }], texto } */
(function () {
  'use strict';
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  var money = function (n) { return window.CSMoneda ? CSMoneda.fmt(Number(n) || 0) : 'US$ ' + Math.round(Number(n) || 0).toLocaleString('es-UY'); };
  var COLORES = { c1: '#5B9BD5', c2: '#7CB7E8', c3: '#F7C325', c4: '#F0714F', c5: '#8FA3BB', c6: '#9AA8BA', c7: '#9B7EDB' };
  /* Mismos iconos del flujo, como trazos de 24x24. */
  var ICONOS = {
    pasajes: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    alojamiento: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2M10 21v-4h4v4"/>',
    comidas: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2.5 1.5-3 4.5-3 8h3"/>',
    local: '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M7 21v-4M17 21v-4"/>',
    traslados: '<path d="M3 17V8a2 2 0 0 1 2-2h9l5 5v6M3 17h18M7 17v2M17 17v2M3 11h13"/>',
    tours: '<path d="M12 21V11M12 11c-1-3-4-4-7-3 2 0 4 1 5 3M12 11c1-3 4-4 7-3-2 0-4 1-5 3M12 11c0-3-1-5-4-6 3 0 5 1 4 6M12 11c0-3 1-5 4-6-3 0-5 1-4 6"/>'
  };
  var icono = function (cat) { return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONOS[cat] || ICONOS.alojamiento) + '</svg>'; };

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  /* "22 al 29 de diciembre"; si cambia el mes se nombran los dos y si cambia el año se agrega. */
  function rangoFechas(ida, vuelta) {
    var a = String(ida).split('-').map(Number), b = String(vuelta).split('-').map(Number);
    if (a.length < 3 || b.length < 3 || a.some(isNaN) || b.some(isNaN)) return ida + ' al ' + vuelta;
    if (a[0] !== b[0]) return a[2] + ' de ' + MESES[a[1] - 1] + ' de ' + a[0] + ' al ' + b[2] + ' de ' + MESES[b[1] - 1] + ' de ' + b[0];
    if (a[1] !== b[1]) return a[2] + ' de ' + MESES[a[1] - 1] + ' al ' + b[2] + ' de ' + MESES[b[1] - 1];
    return a[2] + ' al ' + b[2] + ' de ' + MESES[b[1] - 1];
  }

  var htmlToImagePromise = null;
  function cargarHtmlToImage() {
    if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
    if (htmlToImagePromise) return htmlToImagePromise;
    htmlToImagePromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js';
      s.onload = function () { resolve(window.htmlToImage); };
      s.onerror = function () { htmlToImagePromise = null; reject(new Error('No pudimos cargar el generador de imágenes.')); };
      document.head.appendChild(s);
    });
    return htmlToImagePromise;
  }
  /* La foto va incrustada (data URL) para que la exportacion a canvas no se bloquee por origen cruzado. */
  function fotoComoDataUrl(url) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (!r.ok) throw new Error('foto');
      return r.blob();
    }).then(function (b) {
      return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result || '')); }; fr.onerror = no; fr.readAsDataURL(b); });
    });
  }
  function fotoDestino(key) {
    var k = String(key || '').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(k)) return Promise.resolve('');
    return fotoComoDataUrl('dest/' + k + '.jpg').catch(function () { return fotoComoDataUrl('../fotos/' + k + '.jpg'); }).catch(function () { return ''; });
  }

  function desglose(entries) {
    var filas = (entries || []).filter(function (e) { return Number(e.value) > 0; });
    if (!filas.length) return '';
    var suma = filas.reduce(function (t, e) { return t + Number(e.value); }, 0);
    var color = function (e) { return COLORES[e.color] || '#8FA3BB'; };
    var barra = filas.map(function (e) { return '<span style="display:block;height:100%;width:' + (Number(e.value) / suma * 100) + '%;background:' + color(e) + ';"></span>'; }).join('');
    var lista = filas.map(function (e) {
      return '<div style="display:flex;align-items:center;gap:9px;height:24px;font-size:13px;line-height:1;">' +
        '<span style="flex:none;display:flex;color:' + color(e) + ';">' + icono(e.category) + '</span>' +
        '<span style="flex:1;font-weight:500;color:rgba(255,255,255,.92);">' + esc(e.label) + '</span>' +
        '<b style="flex:none;font-weight:700;white-space:nowrap;">' + esc(money(e.value)) + '</b></div>';
    }).join('');
    return '<div style="margin:0 0 12px;"><div style="display:flex;height:9px;border-radius:5px;overflow:hidden;gap:2px;margin-bottom:9px;">' + barra + '</div>' + lista + '</div>';
  }

  /* El nodo se ancla en (0,0) dentro de un contenedor de tamaño 0: fuera del viewport el navegador puede no pintarlo
     y la captura sale en blanco. */
  function armarNodo(d, foto) {
    var pax = Math.max(1, Number(d.pax) || 1);
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;';
    var node = document.createElement('div');
    node.style.cssText = 'width:540px;height:960px;font-family:Poppins,Arial,sans-serif;';
    node.innerHTML =
      '<div style="position:relative;width:540px;height:960px;background:#0B1B2B;color:#fff;overflow:hidden;">' +
      (foto ? '<img src="' + foto + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">' : '') +
      '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,27,43,.02) 0%,rgba(11,27,43,.08) 42%,rgba(11,27,43,.72) 68%,rgba(11,27,43,.96) 100%);"></div>' +
      '<div style="position:absolute;top:40px;left:40px;right:40px;display:flex;align-items:center;gap:9px;">' +
      '<svg width="24" height="30" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 20 12 30 12 30s12-10 12-18.2C24 5.3 18.6 0 12 0z" fill="#fff"/><circle cx="12" cy="11.5" r="4.6" fill="#F6B21B"/></svg>' +
      '<span style="font-weight:700;letter-spacing:-.02em;font-size:22px;">cuántosale</span></div>' +
      '<div style="position:absolute;left:40px;right:40px;bottom:38px;">' +
      '<div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#F6B21B;margin-bottom:7px;">' + esc(d.dest.country || 'Brasil') + '</div>' +
      '<div style="font-size:40px;font-weight:800;line-height:1.02;margin-bottom:11px;">' + esc(d.dest.name) + '</div>' +
      '<div style="display:flex;align-items:center;gap:18px;margin-bottom:12px;color:rgba(255,255,255,.94);font-size:13px;font-weight:600;"><span>📅 ' + esc(rangoFechas(d.ida, d.vuelta)) + '</span><span>👥 ' + pax + (pax === 1 ? ' pasajero' : ' pasajeros') + '</span></div>' +
      '<div style="background:rgba(11,27,43,.52);border:1px solid rgba(255,255,255,.3);border-radius:18px;padding:13px 19px;margin-bottom:10px;">' +
      '<div style="font-size:11px;color:rgba(255,255,255,.78);margin-bottom:4px;text-transform:uppercase;letter-spacing:.1em;">Precio por pasajero</div>' +
      '<div style="font-size:52px;font-weight:800;line-height:1;letter-spacing:-.03em;">' + esc(money(d.pp)) + '</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:7px;">Total del viaje: ' + esc(money(d.total)) + '</div></div>' +
      desglose(d.entries) +
      '<div style="font-size:15px;font-weight:800;line-height:1.35;color:#fff;">Abrí el presupuesto completo en <span style="color:#F6B21B;">cuantosale.uy</span></div>' +
      '</div></div>';
    wrapper.appendChild(node);
    document.body.appendChild(wrapper);
    return wrapper;
  }

  function puedeCompartirArchivos() {
    try { return typeof File === 'function' && !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'a.png', { type: 'image/png' })] }); } catch (e) { return false; }
  }
  var cache = null;   /* { clave, promesa, blob } */
  function clave(d) { return [d.dest.key, d.ida, d.vuelta, d.pax, Math.round(d.total), (d.entries || []).length].join('|'); }
  /* Celular: JPEG a 810x1440 (~300 KB, sale rapido por el chat). Escritorio: PNG, el unico formato que acepta el portapapeles. */
  function generar(d) {
    var k = clave(d);
    if (cache && cache.clave === k) return cache;
    var wrapper = null, jpeg = puedeCompartirArchivos();
    var entrada = { clave: k, blob: null, jpeg: jpeg };
    entrada.promesa = Promise.all([cargarHtmlToImage(), fotoDestino(d.dest.key)]).then(function (r) {
      wrapper = armarNodo(d, r[1]);
      var img = wrapper.querySelector('img');
      return (img && img.decode ? img.decode().catch(function () {}) : Promise.resolve()).then(function () {
        return r[0].toCanvas(wrapper.firstChild, { width: 540, height: 960, pixelRatio: jpeg ? 1.5 : 2, cacheBust: true, skipFonts: true, fontEmbedCSS: '' });
      });
    }).then(function (canvas) {
      return new Promise(function (ok) { canvas.toBlob(ok, jpeg ? 'image/jpeg' : 'image/png', 0.88); });
    }).then(function (blob) {
      if (!blob) throw new Error('No se pudo generar la imagen.');
      entrada.blob = blob; return blob;
    }).then(function (b) { if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper); return b; },
      function (e) { if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper); throw e; });
    entrada.promesa.catch(function () { if (cache === entrada) cache = null; });   /* si falla, el proximo toque reintenta */
    cache = entrada;
    return entrada;
  }
  function precalentar(d) {
    var ir = function () { try { generar(d).promesa.catch(function () {}); } catch (e) { /* se arma al tocar */ } };
    if (window.requestIdleCallback) window.requestIdleCallback(ir, { timeout: 1500 }); else setTimeout(ir, 500);
  }
  function descargar(blob, nombre) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function compartir(d) {
    var entrada = generar(d), conArchivos = puedeCompartirArchivos();
    var nombre = 'cuantosale-' + (d.dest.key || 'viaje') + (conArchivos ? '.jpg' : '.png');
    var urlWa = 'https://wa.me/?text=' + encodeURIComponent(d.texto);
    if (conArchivos) {
      return entrada.promesa.then(function (blob) {
        var file = new File([blob], nombre, { type: blob.type || 'image/jpeg' });
        return navigator.share({ files: [file], title: 'Mi viaje a ' + d.dest.name, text: d.texto }).then(function () { return 'compartido'; }, function (err) {
          if (err && err.name === 'AbortError') return 'cancelado';
          descargar(blob, nombre); window.open(urlWa, '_blank', 'noopener,noreferrer'); return 'descargada';   /* el toque ya vencio */
        });
      }, function () { window.open(urlWa, '_blank', 'noopener,noreferrer'); return 'descargada'; });
    }
    /* Escritorio: WhatsApp se abre en el acto, con el toque vivo, y la imagen se copia o se descarga. */
    window.open(urlWa, '_blank', 'noopener,noreferrer');
    var copiada;
    try {
      copiada = (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem === 'function')
        ? navigator.clipboard.write([new ClipboardItem({ 'image/png': entrada.promesa })]).then(function () { return true; }, function () { return false; })
        : false;
    } catch (e) { copiada = false; }
    return Promise.resolve(copiada).then(function (ok) {
      if (ok) return 'copiada';
      return entrada.promesa.then(function (blob) { descargar(blob, nombre); return 'descargada'; });
    });
  }

  window.CSTarjeta = { compartir: compartir, precalentar: precalentar, rangoFechas: rangoFechas };
})();
