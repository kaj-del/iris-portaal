// OneSignal SDK
importScripts('https://cdn.onesignal.com/sdks/OneSignalSDK.js');

const CACHE_NAME = 'iris-portaal-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/portaal.html',
  '/dashboard-iris.html',
  '/project.html',
  '/onboarding.html',
  '/css/base.css',
  '/css/components.css',
  '/css/layout.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/i18n.js',
  '/js/portaal.js',
  '/js/project.js',
  '/js/utils.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network first for GAS API calls
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({ success: false, error: 'OFFLINE' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Cache first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
