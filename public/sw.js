self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }

  const title = payload.title ?? 'Furmosa HQ';
  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icons/icon.svg',
    badge: payload.icon ?? '/icons/icon.svg',
    tag: payload.tag,
    data: { url: payload.url ?? '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';
  const absolute = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) {
            return client.navigate(absolute).then(() => client.focus());
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(absolute);
    }),
  );
});
