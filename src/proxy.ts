import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  DASHBOARD_AUTH_COOKIE,
  DASHBOARD_TOKEN_COOKIE,
} from "@/lib/dashboard-permissions"

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

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
}
