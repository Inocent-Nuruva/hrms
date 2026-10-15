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

  // Absolute third-party media is never rebound merely because its path says uploads.
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    const knownOrigins = [env.NEXT_PUBLIC_API_BASE_URL, process.env.NEXT_PUBLIC_BACKEND_ORIGIN]
      .filter((value): value is string => Boolean(value && /^https?:\/\//i.test(value)));
    const backendOrigins = knownOrigins.map((value) => {
      try { return new URL(value).origin; } catch { return null; }
    }).filter((value): value is string => value !== null);
    try {
      const protocol = backendOrigins[0] ? new URL(backendOrigins[0]).protocol : "https:";
      const url = new URL(raw, `${protocol}//media.invalid`);
      if (backendOrigins.includes(url.origin) && url.pathname.startsWith("/uploads/")) {
        return `${base}${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return raw;
    }
    return raw;
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
