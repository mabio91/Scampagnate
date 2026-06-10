/// <reference lib="webworker" />
// Keep OneSignal in the root PWA worker for legacy subscriptions that were
// created before the dedicated /push/onesignal/ worker split.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// Activate this safe worker immediately so clients stuck on the old auto-reload
// worker can migrate after one reload, without claiming open pages mid-session.
self.skipWaiting();

// Clean old caches
cleanupOutdatedCaches();

// Precache all build assets
precacheAndRoute(self.__WB_MANIFEST);

// Navigation routing (SPA fallback) — deny OAuth and API routes
const navigationRoute = new NavigationRoute(
  createHandlerBoundToURL('/index.html'),
  { denylist: [/^\/~oauth/, /^\/api\//, /^\/auth\//, /^\/push\//, /^\/delete-account$/] }
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

// Cache immutable/versioned Supabase Storage images in the browser cache first.
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/v1\/(object|render\/image)\/public\/.*/i,
  new CacheFirst({
    cacheName: 'supabase-images-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// New push subscriptions use the dedicated OneSignal worker under
// /push/onesignal/. This root worker keeps handling PWA caching.
