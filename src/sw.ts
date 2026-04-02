/// <reference lib="webworker" />
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// Clean old caches
cleanupOutdatedCaches();

// Precache all build assets
precacheAndRoute(self.__WB_MANIFEST);

// Navigation routing (SPA fallback) — deny OAuth and API routes
const navigationRoute = new NavigationRoute(
  createHandlerBoundToURL('/index.html'),
  { denylist: [/^\/~oauth/, /^\/api\//, /^\/auth\//, /^\/push\//] }
);
registerRoute(navigationRoute);

// Cache Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Cache Supabase Storage images (event images, avatars)
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'supabase-images-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Push notifications are handled by OneSignal's service worker (OneSignalSDKWorker.js)
// This SW only handles caching — OneSignal registers its own SW at /OneSignalSDKWorker.js
