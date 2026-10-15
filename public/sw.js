'use strict';

// Subir este número descarta el cache viejo: la estrategia de assets es
// cache-first, así que sin cambiarlo los usuarios siguen viendo la versión
// anterior de app.js y style.css para siempre.
var CACHE_NAME = 'cuantosale-shell-v167';
var APP_SHELL = [
  // '/' (la start_url de la PWA). '/app' ya no: ahora redirige a '/', y una
  // respuesta redirigida en el precache rompe la navegacion sin senal.
  '/',
  '/manifest.json',
  '/pwa.js',
  //Va sin '?v=' y por eso sí va en el precache: son 4 KB de costos por destino
  // que app.js necesita apenas carga, y si no están el navegador los pide por
  // red y la primera pantalla sin señal no puede armar las tarjetas. Se
  // refresca sola cuando cambia el CACHE_NAME de arriba.
  '/daily-costs.js',
  // Creditos de las fotos de la guia. Van sin '?v=' y por eso van en el
  // precache: sin ellos las fotos de CC BY-SA salen sin atribución al autor.
  // El CONTENIDO de la guia ya no se precachea, y es a propósito: estaba acá
  // porque era un .js público, y se lo bajaba todo el mundo en la instalación.
  // Ahora vive en lib/guias.js y sale por /api/guia solo para quien trae el
  // token de un hotel con precio real de Booking.
  '/creditos-fotos.generated.js',
  // Precios de transfer por destino. Mismo motivo que daily-costs.js: las cards
  // del transfer leen este global apenas carga app.js, y sin el precache la
  // primera apertura sin senal cae al piso de 20/60 en vez del precio real.
  '/transfer-precios.js',
  // Catalogo de tours. Mismo motivo: app.js lee window.CS_TOURS_DATA al cargar
  // y sin el precache la seccion de tours desaparece en la primera apertura sin
  // senal, que es justo cuando se esta mirando el precio de un viaje.
  '/tours.generated.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/badge-96.png',
  '/icons/apple-touch-icon.png'
  // style.css y app.js NO van acá: el HTML los pide con '?v=N', y una entrada
  // sin query nunca matchea esa URL (la clave del cache es la URL completa).
  // Quedaban precacheadas y se descargaban igual: 352 KB de más en la primera
  // visita, guardados bajo una clave que nadie consulta.
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(APP_SHELL);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.indexOf('cuantosale-shell-') === 0 && key !== CACHE_NAME;
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf('/api/') === 0) return;
  // /web (antes /test) tiene los archivos de la app nueva: siempre va a la red. Con cache-first, web.css y los scripts (que no llevan
  // ?v=) se quedaban para siempre en la copia vieja y los cambios de diseno no se veian aunque el servidor ya los tuviera.
  if (url.pathname.indexOf('/web/') === 0 || url.pathname.indexOf('/test/') === 0) return;
  // El panel de la agencia nunca se cachea ni se sirve sin red: tiene datos de clientes.
  if (url.pathname === '/admin' || url.pathname.indexOf('/admin/') === 0) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(function (response) {
      if (response.ok) {
        var copy = response.clone();
        // Se cachea bajo la URL que se pidió, no bajo la clave literal '/'.
        // Con la clave fija, abrir /grupo/<uuid> o /app sobreescribía la
        // entrada '/' y el siguiente visitante offline se llevaba esa página.
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        // Sin red: primero la URL exacta, después el shell de la app. La
        // '/' queda como último recurso, no como respuesta principal.
        return cached || caches.match('/');
      });
    }));
    return;
  }

  event.respondWith(caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      if (response.ok) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    });
  }));
});

/* Alertas de precio (lib/alertas.js). El push llega vacio; el texto se pide al server con el endpoint de este
   dispositivo, que es la llave: asi el precio y el destino no pasan por el servicio de push (Google, Apple, Mozilla).
   Trae las bajas de las ultimas 24 h y muestra una notificacion por alerta (el tag evita repetir la misma). */
self.addEventListener('push', function (event) {
  event.waitUntil(self.registration.pushManager.getSubscription().then(function (sub) {
    if (!sub) return null;
    return fetch('/api/alertas/push-resumen?endpoint=' + encodeURIComponent(sub.endpoint), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }).then(function (j) {
    /* Solo lo de los ultimos 10 minutos (lo que mando esta misma revision): sin esto, un push nuevo podia volver a
       mostrar la baja de esta manana. Si no hay nada tan nuevo, el ultimo aviso. */
    var todos = j && j.avisos ? j.avisos : [], recientes = todos.filter(function (a) { return Date.now() - Date.parse(a.at) < 6e5; });
    var avisos = recientes.length ? recientes : todos.length ? [todos[0]] : [{ id: 'generico', titulo: 'Bajó el precio de un vuelo', cuerpo: 'Abrí CuántoSale para ver tus alertas de precio.', url: '/' }];
    return Promise.all(avisos.map(function (a) {
      return self.registration.showNotification(a.titulo || 'CuántoSale', {
        body: a.cuerpo || '', badge: '/icons/badge-96.png',
        tag: 'alerta-' + a.id, data: { url: a.url || '/' }
      });
    }));
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ventanas) {
    for (var i = 0; i < ventanas.length; i++) {
      if (new URL(ventanas[i].url).origin === self.location.origin && 'navigate' in ventanas[i]) return ventanas[i].navigate(url).then(function (v) { return v && v.focus(); });
    }
    return self.clients.openWindow(url);
  }));
});
