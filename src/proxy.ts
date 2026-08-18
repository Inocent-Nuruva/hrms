import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  DASHBOARD_AUTH_COOKIE,
  DASHBOARD_TOKEN_COOKIE,
} from "@/lib/dashboard-permissions"

function isSafeNextPath(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isSafeNextPath(pathname)) {
    return NextResponse.next()
  }

  const hasAuthCookie =
    request.cookies.get(DASHBOARD_AUTH_COOKIE)?.value === "1" ||
    Boolean(request.cookies.get(DASHBOARD_TOKEN_COOKIE)?.value)

  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
}
