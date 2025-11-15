const CACHE_VERSION = 2
const STATIC_CACHE = `bowl-tracker-static-v${CACHE_VERSION}`
const DYNAMIC_CACHE = `bowl-tracker-dynamic-v${CACHE_VERSION}`

// Essential files to cache
const STATIC_FILES = ["/manifest.json"]

// Install event - cache static files
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...")
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("Caching static files")
        return cache.addAll(STATIC_FILES)
      })
      .catch((error) => {
        console.error("Cache installation failed:", error)
      })
      .then(() => {
        return self.skipWaiting()
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...")
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log("Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        return self.clients.claim()
      }),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") {
    return
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return
  }

  // Skip API routes and Supabase requests - always fetch fresh
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || url.hostname.includes("supabase")) {
    return
  }

  // Network-first strategy for HTML pages to ensure fresh data
  if (request.destination === "document" || url.pathname === "/" || url.pathname.startsWith("/bowl")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the fresh response
          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Fallback to cache only if network fails
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || new Response("Offline", { status: 503 })
          })
        }),
    )
    return
  }

  // Cache-first strategy for static assets (images, icons, etc.)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          const responseToCache = response.clone()
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch(() => {
          return new Response("Offline", { status: 503 })
        })
    }),
  )
})

// Simple push notification handling
self.addEventListener("push", (event) => {
  console.log("Push notification received")

  const title = "Wood Bowl Tracker"
  const options = {
    body: event.data ? event.data.text() : "Check your bowl collection!",
    icon: "/icon-192x192.png",
    badge: "/icon-72x72.png",
    tag: "bowl-notification",
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(clients.openWindow("/"))
})
