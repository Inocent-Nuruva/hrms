import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  DASHBOARD_AUTH_COOKIE,
  DASHBOARD_PERMISSIONS_COOKIE,
  DASHBOARD_TOKEN_COOKIE,
  canAccessDashboardRoute,
  decodeJwtPayload,
  readPermissionLabelsFromUnknown,
} from "@/lib/dashboard-permissions"

function readPermissionLabelsFromRequest(request: NextRequest) {
  const cookiePermissions = request.cookies.get(DASHBOARD_PERMISSIONS_COOKIE)?.value
  if (cookiePermissions) {
    try {
      const parsed = JSON.parse(cookiePermissions) as unknown
      if (Array.isArray(parsed)) {
        return readPermissionLabelsFromUnknown(parsed.filter((entry) => typeof entry === "string"))
      }
    } catch {
      // Ignore malformed cookie and fall back to token.
    }
  }

  const token = request.cookies.get(DASHBOARD_TOKEN_COOKIE)?.value?.trim() ?? ""
  if (!token) {
    return [] as string[]
  }

  return readPermissionLabelsFromUnknown(decodeJwtPayload(token))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/onboarding")) {
    return NextResponse.next()
  }

  const hasAuthCookie =
    request.cookies.get(DASHBOARD_AUTH_COOKIE)?.value === "1" ||
    Boolean(request.cookies.get(DASHBOARD_TOKEN_COOKIE)?.value)

  // Optimistic guard: if this session has not been synced into cookies yet,
  // fall through and let the client-side guard bootstrap the snapshot.
  if (!hasAuthCookie) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/dashboard") && pathname !== "/dashboard") {
    const permissionLabels = readPermissionLabelsFromRequest(request)
    if (permissionLabels.length === 0) {
      return NextResponse.next()
    }
    if (!canAccessDashboardRoute(pathname, permissionLabels)) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      url.search = ""
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
}
