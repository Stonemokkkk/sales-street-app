const CACHE_NAME = 'sales-street-kit-v1';
const APP_SHELL = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/config.js',
    './manifest.webmanifest',
    './data/toilets.json',
    './data/freespace.json',
    './data/charging.json',
    './data/premium_toilets.json'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: cache-first for app shell, network-first for tiles/CDN
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Network-first for tiles, CDN, Supabase
    if (url.hostname.includes('tile.openstreetmap.org') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('supabase')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for app shell
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});
