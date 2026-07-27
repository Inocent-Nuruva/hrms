"use client"

import * as React from "react"
import Link from "next/link"
import { ImageIcon, KeyRound, ShieldCheck, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { showSuccessAlert } from "@/lib/success-alert"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AccountSettingsPanelProps {
  token: string
  loading: boolean
  onChangeMyPassword: (oldPassword: string, newPassword: string) => Promise<void>
  profilePhotoUrl?: string | null
  displayName?: string | null
  profilePictureHref?: string | null
}

type SecurityTab = "reset-password" | "two-factor" | "devices"

export function AccountSettingsPanel({
  token,
  loading,
  onChangeMyPassword,
  profilePhotoUrl,
  displayName,
  profilePictureHref,
}: AccountSettingsPanelProps) {
  const [activeTab, setActiveTab] = React.useState<SecurityTab>("reset-password")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const tabIndex = activeTab === "reset-password" ? 0 : activeTab === "two-factor" ? 1 : 2
  const avatarLabel = displayName?.trim() || "Your profile"
  const initials =
    avatarLabel
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"

  const handleChangePassword = async () => {
    if (!token) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.error("Current and new passwords are required.")
      return
    }

    try {
      await onChangeMyPassword(currentPassword, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      showSuccessAlert("Password changed.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Password change failed."
      toast.error(message)
    }
  }

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      {profilePictureHref ? (
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-14 ring-1 ring-border" size="lg">
                {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={avatarLabel} /> : null}
                <AvatarFallback className="text-base font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{avatarLabel}</p>
                <p className="text-sm text-muted-foreground">
                  Update the photo shown on your dashboard, profile, and account menu.
                </p>
              </div>
            </div>
            <Link
              href={profilePictureHref}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground self-start sm:self-auto"
            >
              <ImageIcon className="size-4" />
              Change Profile Picture
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Security & Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative grid grid-cols-3 gap-2 rounded-lg border p-1">
            <div
              className="absolute top-1 bottom-1 left-1 hidden rounded-md bg-muted transition-all duration-300 ease-out sm:block"
              style={{
                width: "calc((100% - 1rem) / 3)",
                transform:
                  activeTab === "reset-password"
                    ? "translateX(0%)"
                    : activeTab === "two-factor"
                      ? "translateX(100%)"
                      : "translateX(200%)",
              }}
            />
            <Button
              type="button"
              variant="ghost"
              className="relative z-10 justify-center gap-2 px-2 text-xs sm:text-sm"
              onClick={() => setActiveTab("reset-password")}
            >
              <KeyRound
                className={`size-4 transition-all duration-300 ${
                  activeTab === "reset-password"
                    ? "text-blue-600 dark:text-blue-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              Password
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="relative z-10 justify-center gap-2 px-2 text-xs sm:text-sm"
              onClick={() => setActiveTab("two-factor")}
            >
              <ShieldCheck
                className={`size-4 transition-all duration-300 ${
                  activeTab === "two-factor"
                    ? "text-emerald-600 dark:text-emerald-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              2FA
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="relative z-10 justify-center gap-2 px-2 text-xs sm:text-sm"
              onClick={() => setActiveTab("devices")}
            >
              <Smartphone
                className={`size-4 transition-all duration-300 ${
                  activeTab === "devices"
                    ? "text-violet-600 dark:text-violet-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              Devices
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div
              className="flex w-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${tabIndex * 100}%)` }}
            >
              <div className="w-full shrink-0 p-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Current Password</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </div>
                  <Button onClick={handleChangePassword} disabled={loading}>
                    Change Password
                  </Button>
                </div>
              </div>

              <div className="w-full shrink-0 p-4">
                <p className="text-sm text-muted-foreground">2-factor authentication controls will appear here.</p>
              </div>

              <div className="w-full shrink-0 p-4">
                <p className="text-sm text-muted-foreground">Connected device management will appear here.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
