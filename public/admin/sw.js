/* Service worker del panel /admin: solo notificaciones (lib/push.js). No cachea nada: el panel tiene datos de
   clientes y siempre va a la red. El push llega vacio; el resumen se pide con la cookie de la sesion. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  e.waitUntil(fetch('/api/admin/push/resumen', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (j) {
      j = j || {};
      if (self.navigator && self.navigator.setAppBadge && j.no_leidos) self.navigator.setAppBadge(j.no_leidos).catch(function () {});
      return self.registration.showNotification(j.titulo || 'CuántoSale', {
        body: j.cuerpo || 'Tenés novedades en el panel.',
        icon: '/icons/icon-192.png', badge: '/icons/badge-96.png',
        tag: j.tag || 'cs-panel', renotify: true,
        data: { url: j.url || '/admin/' }
      });
    }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/admin/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ventanas) {
    for (var i = 0; i < ventanas.length; i++) {
      if (ventanas[i].url.indexOf('/admin') >= 0) { ventanas[i].postMessage({ tipo: 'abrir', url: url }); return ventanas[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
