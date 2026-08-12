/**
 * SKY EDU - Service Worker
 * PWA Support với Offline Caching
 */

const CACHE_NAME = 'sky-edu-v2';
// Lưu ý: paths tuyệt đối `/...` chỉ đúng khi deploy tại root domain.
// Nếu deploy GitHub Pages dưới `/<repo>/`, thì `/index.html` sẽ trỏ về
// root chứ không phải repo — dẫn tới cache miss. Cách an toàn là dùng
// relative paths hoặc skip precache và để runtime fetch cache tự động.
const ROOT = (self.location.pathname.replace(/\/sw\.js$/, '').replace(/\/$/, '') || '');
const STATIC_ASSETS = [
    ROOT + '/index.html',
    ROOT + '/phong-luyen-tsa/index.html',
    ROOT + '/phong-luyen-hsa/index.html',
    ROOT + '/khoa-hoc-pages/index.html',
    ROOT + '/quy-doi-diem.html',
    ROOT + '/account/dang-nhap.html',
    ROOT + '/account/dang-ky.html',
    ROOT + '/account/tai-khoan.html',
    ROOT + '/assets/css/style.css',
    ROOT + '/assets/js/main.js',
    ROOT + '/firebase-config.js',
    ROOT + '/anti-cheat.js'
];

const IMAGE_CACHE = 'sky-edu-images-v2';
const API_CACHE = 'sky-edu-api-v2';

// Các trang CẦN dữ liệu live, KHÔNG cache kết quả:
//   result.html → examResults/{uid}/{examId} (điểm có thể thay đổi nếu admin chấm lại)
//   admin.html → danh sách user/exam/enrollment thay đổi liên tục
//   dashboard.html → userStats thay đổi khi user làm bài
const NEVER_CACHE_PATHS = [
    /\/result\.html/,
    /\/admin(\.html)?/,
    /\/dashboard(\.html)?/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase API calls (always network)
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Skip external resources
  if (url.origin !== location.origin) {
    return;
  }

  // Skip dynamic data pages — luôn đi mạng, không cache
  // Tránh hiển thị dữ liệu cũ (điểm thi, danh sách user,…)
  if (NEVER_CACHE_PATHS.some(rx => rx.test(url.pathname))) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(ROOT + '/index.html')
      )
    );
    return;
  }

  // Strategy based on request type
  if (request.destination === 'image') {
    // Images: Cache first
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
  } else if (request.destination === 'script' || request.destination === 'style') {
    // Scripts & Styles: Stale while revalidate
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
  } else {
    // Pages & API: Network first
    event.respondWith(networkFirst(request, CACHE_NAME));
  }
});

// Cache first strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
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
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(ROOT + '/index.html') ||
             caches.match('/index.html') ||
             new Response('Offline', { status: 503 });
    }
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  
  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'Bạn có thông báo mới!',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Mở' },
      { action: 'close', title: 'Đóng' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'SKY EDU', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') return;
  
  const url = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if available
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-exams') {
    event.waitUntil(syncExams());
  }
});

async function syncExams() {
  // Offline exam sync placeholder
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  // Periodic update check placeholder
}
