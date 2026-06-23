/**
 * Service Worker Template
 * 
 * Enhanced caching strategy for better performance
 * Copy this to public/sw.js and customize as needed
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `leiz-store-${CACHE_VERSION}`;

// Resources to cache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first, fallback to network
  cacheFirst: ['/_next/static/', '/images/', '/fonts/'],
  
  // Network first, fallback to cache
  networkFirst: ['/api/', '/products/'],
  
  // Stale while revalidate
  staleWhileRevalidate: ['/'],
};

// Install event - cache precache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other schemes
  if (!url.protocol.startsWith('http')) return;

  // Determine strategy
  const strategy = determineStrategy(url.pathname);

  event.respondWith(
    handleFetch(request, strategy)
  );
});

/**
 * Determine caching strategy for URL
 */
function determineStrategy(pathname) {
  // Cache first for static assets
  if (CACHE_STRATEGIES.cacheFirst.some(pattern => pathname.includes(pattern))) {
    return 'cacheFirst';
  }

  // Network first for API calls
  if (CACHE_STRATEGIES.networkFirst.some(pattern => pathname.includes(pattern))) {
    return 'networkFirst';
  }

  // Stale while revalidate for pages
  return 'staleWhileRevalidate';
}

/**
 * Handle fetch with caching strategy
 */
async function handleFetch(request, strategy) {
  const cache = await caches.open(CACHE_NAME);

  switch (strategy) {
    case 'cacheFirst':
      return cacheFirst(request, cache);
    
    case 'networkFirst':
      return networkFirst(request, cache);
    
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request, cache);
    
    default:
      return fetch(request);
  }
}

/**
 * Cache first strategy
 */
async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return offline page if available
    return cache.match('/offline.html') || new Response('Offline');
  }
}

/**
 * Network first strategy
 */
async function networkFirst(request, cache) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

/**
 * Stale while revalidate strategy
 */
async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  return cached || fetchPromise;
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

/**
 * Sync offline orders
 */
async function syncOrders() {
  // Implement offline order sync logic
  console.log('Syncing offline orders...');
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'LEIZ STORE', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
