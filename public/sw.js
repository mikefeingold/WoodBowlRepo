const CACHE_NAME = "bowl-tracker-v1"
const STATIC_CACHE = "bowl-tracker-static-v1"
const DYNAMIC_CACHE = "bowl-tracker-dynamic-v1"

// Essential files to cache
const STATIC_FILES = ["/", "/manifest.json", "/offline"]

// Install event - cache static files
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...")
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("Caching static files")
        // Only cache files that definitely exist
        return cache.addAll(["/", "/manifest.json"])
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

// Fetch event - serve from cache, fallback to network
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

  // Skip API routes and dynamic content
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          // Cache dynamic content
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (request.destination === "document") {
            return caches.match("/offline") || new Response("Offline", { status: 503 })
          }

          // Return a simple response for other requests
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
