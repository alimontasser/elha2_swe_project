// Firebase Cloud Messaging service worker (US-11.01).
// The app registers it with its public Firebase config in the query string
// (lib/data/fcm/push_client.dart), so the config lives in one place. It sits in /fcm/ so it
// never shares a scope with anything else on the site.

// A tapped notification opens its screen: focus the open app and tell it, or open a new tab.
// Registered before Firebase's own handler, which only knows absolute links.
self.addEventListener('notificationclick', (event) => {
  const deepLink = event.notification?.data?.FCM_MSG?.data?.deepLink;
  if (!deepLink || !/^\/[a-z/]*$/.test(deepLink)) return;
  event.stopImmediatePropagation();
  event.notification.close();
  const appUrl = new URL('../', self.registration.scope);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(appUrl.href));
      if (open) {
        await open.focus();
        open.postMessage({ elha2DeepLink: deepLink });
        return;
      }
      await self.clients.openWindow(`${appUrl.href}#${deepLink}`);
    })(),
  );
});

importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  appId: params.get('appId'),
  messagingSenderId: params.get('messagingSenderId'),
  projectId: params.get('projectId'),
});
// Shows pushes that arrive while the app is in the background, using their title and body.
firebase.messaging();
