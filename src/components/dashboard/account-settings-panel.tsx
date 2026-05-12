"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminRecord } from "@/lib/admin-api"

interface AccountSettingsPanelProps {
  token: string
  loading: boolean
  onUpdateMyProfile: (payload: AdminRecord) => Promise<void>
  onChangeMyPassword: (oldPassword: string, newPassword: string) => Promise<void>
}

export function AccountSettingsPanel({
  token,
  loading,
  onUpdateMyProfile,
  onChangeMyPassword,
}: AccountSettingsPanelProps) {
  const [profilePassword, setProfilePassword] = React.useState("")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")

  const handleUpdateProfile = async () => {
    if (!token) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    if (!profilePassword.trim()) {
      toast.error("Password is required.")
      return
    }

    try {
      await onUpdateMyProfile({ password: profilePassword })
      setProfilePassword("")
      toast.success("Profile updated.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Profile update failed."
      toast.error(message)
    }
  }

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
      toast.success("Password changed.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Password change failed."
      toast.error(message)
    }
  }

  return (
    <div className="grid gap-4 px-4 lg:px-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Update Profile</CardTitle>
          <CardDescription>Set a new profile password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>New Password</Label>
            <Input
              type="password"
              value={profilePassword}
              onChange={(event) => setProfilePassword(event.target.value)}
            />
          </div>
          <Button onClick={handleUpdateProfile} disabled={loading}>
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Use your current password and a new password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>
    </div>
  )
}
