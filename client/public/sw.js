self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  const data = event.data.json();
  const title = data.title || 'VCP Trader';
  const options = {
    body: data.body || 'New trading opportunity detected',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'vcp-alert',
    data: data.url || '/',
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const url = event.notification.data || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
