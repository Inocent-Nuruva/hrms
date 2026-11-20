"use client"

import { readStoredSessionTokens } from "@/lib/session-client"

const ENABLED_KEY = "hrms:web-push-enabled"

type BrowserPushConfig = { enabled: boolean; publicKey: string | null }

function supportsBrowserPush() {
  return typeof window !== "undefined" && window.isSecureContext &&
    "Notification" in window && "serviceWorker" in navigator && "PushManager" in window
}

function serverKeyBytes(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const decoded = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
  return bytes.buffer
}

async function request<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/notifications/web-push/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `Browser notifications request failed (${response.status}).`)
  return payload as T
}

export async function getBrowserPushStatus() {
  if (!supportsBrowserPush()) return { supported: false, enabled: false, permission: "unsupported" as const, available: false }
  const token = readStoredSessionTokens().accessToken
  const config = token ? await request<BrowserPushConfig>("config", token) : { enabled: false, publicKey: null }
  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager.getSubscription()
  return {
    supported: true,
    available: config.enabled,
    enabled: Boolean(subscription && localStorage.getItem(ENABLED_KEY) === "true"),
    permission: Notification.permission,
  }
}

async function registerSubscription(token: string, config: BrowserPushConfig) {
  if (!config.enabled || !config.publicKey) throw new Error("Browser notifications are not configured on the server.")
  const registration = await navigator.serviceWorker.register(
    process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1",
    { scope: "/", updateViaCache: "none" },
  )
  const ready = await navigator.serviceWorker.ready
  let subscription = await ready.pushManager.getSubscription()
  let created = false
  if (!subscription) {
    subscription = await ready.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: serverKeyBytes(config.publicKey),
    })
    created = true
  }
  const serialized = subscription.toJSON()
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
    throw new Error("The browser did not provide a complete push subscription.")
  }
  try {
    await request("subscriptions", token, "POST", {
      endpoint: serialized.endpoint,
      keys: { p256dh: serialized.keys.p256dh, auth: serialized.keys.auth },
    })
  } catch (error) {
    if (created) await subscription.unsubscribe()
    throw error
  }
  return registration
}

export async function enableBrowserPush() {
  if (!supportsBrowserPush()) throw new Error("This browser does not support system notifications here. Use HTTPS or localhost.")
  const token = readStoredSessionTokens().accessToken
  if (!token) throw new Error("Sign in to enable browser notifications.")
  // This call must begin in the button click so browsers accept the permission prompt.
  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Allow notifications in your browser settings to receive alerts outside the app.")
  const config = await request<BrowserPushConfig>("config", token)
  await registerSubscription(token, config)
  localStorage.setItem(ENABLED_KEY, "true")
}

export async function syncBrowserPush(token: string) {
  if (!token || !supportsBrowserPush() || Notification.permission !== "granted" || localStorage.getItem(ENABLED_KEY) !== "true") return
  const config = await request<BrowserPushConfig>("config", token)
  if (config.enabled) await registerSubscription(token, config)
}

export async function disableBrowserPush(token = readStoredSessionTokens().accessToken) {
  if (!supportsBrowserPush()) return
  localStorage.removeItem(ENABLED_KEY)
  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  try {
    if (token) await request("subscriptions", token, "DELETE", { endpoint: subscription.endpoint })
  } finally {
    await subscription.unsubscribe()
  }
}
