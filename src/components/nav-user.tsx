"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  ArrowExit16Regular,
  PersonCircle16Regular,
  QuestionCircle16Regular,
  Settings16Regular,
} from "@fluentui/react-icons"

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
  const { logout, switchCompany, user: signedInUser } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const companies = signedInUser?.scope === "company" ? signedInUser.availableCompanies ?? [] : []
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

  const enterCompany = async (id: number) => {
    if (isSwitching || id === signedInUser?.companyId) return
    setIsSwitching(true)
    try {
      await switchCompany(id)
      window.location.replace("/dashboard")
    } catch (error) {
      setIsSwitching(false)
      toast.error(error instanceof Error ? error.message : "Could not switch company.")
    }
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
        <UserAvatar src={avatarSrc} alt={user.name} initials={userInitials} className="size-9" />
        <span className="pointer-events-none absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
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
        {companies.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Switch company</DropdownMenuLabel>
              {companies.map(company => (
                <DropdownMenuItem key={company.id} disabled={isSwitching || company.id === signedInUser?.companyId} onClick={() => void enterCompany(company.id)}>
                  {company.name}{company.id === signedInUser?.companyId ? " (current)" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(accountHref)}>
            <PersonCircle16Regular className="text-blue-600 dark:text-blue-400" />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <Settings16Regular className="text-violet-600 dark:text-violet-400" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/dashboard/help")}>
            <QuestionCircle16Regular className="text-amber-600 dark:text-amber-400" />
            Get help
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleLogout()} disabled={isLoggingOut} variant="destructive">
          <ArrowExit16Regular className="text-red-600 dark:text-red-400" />
          {isLoggingOut ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
