// ── Request notification permission on login ───────────────────────────────────
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ── Show a native browser notification ────────────────────────────────────────
// Works when tab is in background (minimized, other tab open).
// Does NOT work when browser is fully closed — for that, Telegram/Email handles it.
export function showNotification(title, body, tag = 'alertic') {
  if (Notification.permission !== 'granted') return;
  try {
    // Use service worker registration for persistent notifications (works in background tabs)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag,           // replaces previous instead of stacking
          renotify: true,
          vibrate: [200, 100, 200],
        });
      });
    } else {
      // Fallback: direct Notification (tab must be active)
      new Notification(title, { body, icon: '/favicon.svg', tag });
    }
  } catch (e) {
    console.warn('Notification error:', e.message);
  }
}
