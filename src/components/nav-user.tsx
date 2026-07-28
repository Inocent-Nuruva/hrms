"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, CircleUserRoundIcon, BellIcon, LogOutIcon } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { resolveBackendMediaUrl } from "@/lib/admin-api"
import {
  getCachedMyProfilePhotoUrl,
  getMyProfilePhotoRevision,
  subscribeMyProfilePhoto,
  useMyProfilePhoto,
} from "@/lib/my-profile-photo"
import { ROUTES } from "@/utils/constants"

const FALLBACK_AVATAR = "/assets/alliance-logo.png"

function resolveAvatarCandidate(value: string | null | undefined): string {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw || raw === FALLBACK_AVATAR) return ""
  return resolveBackendMediaUrl(raw) || raw
}

function SidebarUserAvatar({
  src,
  alt,
  initials,
  sizeClassName,
}: {
  src: string
  alt: string
  initials: string
  sizeClassName: string
}) {
  const [failed, setFailed] = useState(false)

  // Reset error state whenever the source changes.
  useEffect(() => {
    setFailed(false)
  }, [src])

  // Prefer a plain <img> so Base UI Avatar image state cannot stick on the old picture.
  if (src && src !== FALLBACK_AVATAR && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt={alt}
        className={`${sizeClassName} shrink-0 rounded-md object-cover ring-1 ring-border`}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <Avatar className={`${sizeClassName} rounded-md`} size="sm">
      {src && src !== FALLBACK_AVATAR ? <AvatarImage src={src} alt={alt} /> : null}
      <AvatarFallback className="rounded-md text-xs">{initials}</AvatarFallback>
    </Avatar>
  )
}

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouter()
  const { logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  // Live profile photo (updated by Change Photo / default avatar selection).
  const { url: liveProfilePhotoUrl, revision: photoRevision } = useMyProfilePhoto()
  // Extra direct subscription — guarantees re-render even if hook identity is stale.
  const [storeTick, setStoreTick] = useState(0)
  useEffect(() => {
    return subscribeMyProfilePhoto(() => {
      setStoreTick((n) => n + 1)
    })
  }, [])

  const avatarSrc = useMemo(() => {
    const cached = getCachedMyProfilePhotoUrl()
    const live =
      resolveAvatarCandidate(liveProfilePhotoUrl) ||
      resolveAvatarCandidate(cached)
    const fromProp = resolveAvatarCandidate(user.avatar)
    const base = live || fromProp || FALLBACK_AVATAR

    if (!base || base.startsWith("data:") || base.startsWith("blob:") || base === FALLBACK_AVATAR) {
      return base
    }
    const rev = Math.max(photoRevision, getMyProfilePhotoRevision(), storeTick)
    if (rev <= 0) return base
    const joiner = base.includes("?") ? "&" : "?"
    return `${base}${joiner}v=${rev}`
  }, [liveProfilePhotoUrl, photoRevision, storeTick, user.avatar])

  const navigateAndClose = (url: string) => {
    router.push(url)
    if (isMobile) {
      setOpenMobile(false)
    }
  }
  const initials =
    user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    if (isMobile) {
      setOpenMobile(false)
    }
    await logout()
    router.replace(ROUTES.login)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-10 min-h-10 rounded-lg px-2 py-1.5 aria-expanded:bg-muted"
              />
            }
          >
            <SidebarUserAvatar
              src={avatarSrc}
              alt={user.name}
              initials={initials}
              sizeClassName="size-7"
            />
            <div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-[11px] text-foreground/70">
                {user.email}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-3.5 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <SidebarUserAvatar
                    src={avatarSrc}
                    alt={user.name}
                    initials={initials}
                    sizeClassName="size-8"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigateAndClose("/dashboard/settings")}>
                <CircleUserRoundIcon
                />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon
                />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleLogout()} disabled={isLoggingOut}>
              <LogOutIcon
              />
              {isLoggingOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
