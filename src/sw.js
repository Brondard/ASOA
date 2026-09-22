// Service worker : cache hors ligne + réception des notifications push
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.skipWaiting()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'ASOA', body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'ASOA Antibes', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag,
      data: { url: data.url || './' },
    }),
  )
})

// Clic sur la notification : ouvre (ou remet au premier plan) l'app sur la bonne page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope))
      if (open) {
        open.navigate(target)
        return open.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
