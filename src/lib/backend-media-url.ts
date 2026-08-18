import { env } from "@/lib/env"

function getApiOrigin() {
  return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/api$/i, "")
}

/**
 * Resolve backend-hosted media (uploads, avatars, profile photos) against
 * the active API origin. Kept outside admin-api so the dashboard shell does
 * not have to parse that module just to show a photo.
 */
export function resolveBackendMediaUrl(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw

  const base = getApiOrigin().replace(/\/$/, "")

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      if (
        url.pathname.startsWith("/uploads/") ||
        url.pathname.includes("/default-avatars/") ||
        url.pathname.includes("/profile-photos/")
      ) {
        return `${base}${url.pathname}${url.search}`
      }
      return raw
    } catch {
      return raw
    }
  }

  if (raw.startsWith("//")) {
    try {
      const url = new URL(`http:${raw}`)
      if (
        url.pathname.startsWith("/uploads/") ||
        url.pathname.includes("/default-avatars/") ||
        url.pathname.includes("/profile-photos/")
      ) {
        return `${base}${url.pathname}${url.search}`
      }
    } catch {
      // fall through
    }
  }

  let path = raw.replace(/\\/g, "/")
  if (!path.startsWith("/")) {
    if (
      path.startsWith("uploads/") ||
      path.startsWith("default-avatars/") ||
      path.startsWith("profile-photos/")
    ) {
      path = path.startsWith("uploads/") ? `/${path}` : `/uploads/${path}`
    } else {
      path = `/${path}`
    }
  }
  return `${base}${path}`
}
