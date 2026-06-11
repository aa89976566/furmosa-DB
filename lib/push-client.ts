export function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function subscribeToPush(vapidPublicKey: string) {
  const registration = await registerServiceWorker();
  if (!registration) throw new Error('此裝置不支援 Service Worker');

  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('需要允許通知');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const res = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new Error('無法註冊推播');

  return subscription;
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch('/api/notifications/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}
