"use client"

import * as React from "react"
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { showSuccessAlert } from "@/lib/success-alert"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AccountSettingsPanelProps {
  token: string
  loading: boolean
  onChangeMyPassword: (oldPassword: string, newPassword: string) => Promise<void>
}

type SecurityTab = "reset-password" | "two-factor" | "devices"

export function AccountSettingsPanel({
  token,
  loading,
  onChangeMyPassword,
}: AccountSettingsPanelProps) {
  const [activeTab, setActiveTab] = React.useState<SecurityTab>("reset-password")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const tabIndex = activeTab === "reset-password" ? 0 : activeTab === "two-factor" ? 1 : 2

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
