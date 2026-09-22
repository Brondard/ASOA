// Notifications push côté navigateur : abonnement de cet appareil.
import { api } from '../api/index.js'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on' | 'not-configured'
export async function pushState() {
  if (api.isDemo) return 'demo'
  if (!VAPID) return 'not-configured'
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function enablePush() {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications refusées. Tu peux les réactiver dans les réglages du navigateur.')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID) }))
  await api.savePushSubscription(sub)
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await api.deletePushSubscription(sub.endpoint)
  await sub.unsubscribe()
}
