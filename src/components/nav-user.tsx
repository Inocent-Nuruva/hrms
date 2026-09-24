"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleHelpIcon, CircleUserRoundIcon, LogOutIcon, SettingsIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/useAuth"
import { resolveBackendMediaUrl } from "@/lib/backend-media-url"
import {
  getCachedMyProfilePhotoUrl,
  getMyProfilePhotoRevision,
  subscribeMyProfilePhoto,
  useMyProfilePhoto,
  withMyProfilePhotoRevision,
} from "@/lib/my-profile-photo"
import { ROUTES } from "@/utils/constants"

const FALLBACK_AVATAR = "/assets/alliance-logo.png"

function resolveAvatarCandidate(value: string | null | undefined) {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw || raw === FALLBACK_AVATAR) return ""
  return resolveBackendMediaUrl(raw) || raw
}

function UserAvatar({
  src,
  alt,
  initials,
  className,
}: {
  src: string
  alt: string
  initials: string
  className: string
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return (
    <Avatar className={className}>
      {src && src !== FALLBACK_AVATAR && !failed ? (
        <AvatarImage src={src} alt={alt} onError={() => setFailed(true)} />
      ) : null}
      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

export function HeaderUserMenu({
  user,
  accountHref = "/dashboard/me/profile",
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
  accountHref?: string
}) {
  const router = useRouter()
  const { logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { url: liveProfilePhotoUrl, revision: photoRevision } = useMyProfilePhoto()
  const [storeTick, setStoreTick] = useState(0)

  useEffect(() => subscribeMyProfilePhoto(() => setStoreTick((value) => value + 1)), [])

  const avatarSrc = useMemo(() => {
    const cached = getCachedMyProfilePhotoUrl()
    const live = resolveAvatarCandidate(liveProfilePhotoUrl) || resolveAvatarCandidate(cached)
    const fromProp = resolveAvatarCandidate(user.avatar)
    const base = live || fromProp || FALLBACK_AVATAR

    if (!base || base.startsWith("data:") || base.startsWith("blob:") || base === FALLBACK_AVATAR) {
      return base
    }
    const revision = Math.max(photoRevision, getMyProfilePhotoRevision(), storeTick)
    return withMyProfilePhotoRevision(base, revision) || base
  }, [liveProfilePhotoUrl, photoRevision, storeTick, user.avatar])

  const userInitials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    await logout()
    router.replace(ROUTES.login)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative ml-0.5 rounded-full outline-none ring-offset-background transition hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`${user.name} account menu`}
            title="Account menu"
          />
        }
      >
        <UserAvatar src={avatarSrc} alt={user.name} initials={userInitials} className="size-8" />
        <span className="pointer-events-none absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-60" side="bottom" align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2.5 px-2 py-2 text-left">
              <UserAvatar src={avatarSrc} alt={user.name} initials={userInitials} className="size-9" />
              <div className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
                <span className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(accountHref)}>
            <CircleUserRoundIcon />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/dashboard/help")}>
            <CircleHelpIcon />
            Get help
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleLogout()} disabled={isLoggingOut} variant="destructive">
          <LogOutIcon />
          {isLoggingOut ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
