"use client"

import * as React from "react"
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"
import { showSuccessAlert } from "@/lib/success-alert"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  createDefaultAvatar,
  deleteDefaultAvatar,
  extractDefaultAvatarImageUrl,
  fileToBase64FileDto,
  getDefaultAvatar,
  listDefaultAvatars,
  readDefaultAvatarId,
  setDefaultAvatarAsDefault,
  updateDefaultAvatar,
  type AdminRecord,
  type DefaultAvatarGender,
  type DefaultAvatarStatus,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type AvatarFormState = {
  avatar_name: string
  gender_category: DefaultAvatarGender
  display_order: string
  is_default: boolean
  status: DefaultAvatarStatus
  file: File | null
  previewUrl: string
}

const EMPTY_FORM: AvatarFormState = {
  avatar_name: "",
  gender_category: "neutral",
  display_order: "0",
  is_default: false,
  status: "active",
  file: null,
  previewUrl: "",
}

function readStoredToken() {
  if (typeof window === "undefined") return ""
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
      const accessToken = (parsed.accessToken ?? parsed.access_token ?? "").trim()
      if (accessToken) return accessToken
    } catch {
      // fall through
    }
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
}

function readString(row: AdminRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return fallback
}

function readNumber(row: AdminRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const n = Number(value)
      if (Number.isFinite(n)) return n
    }
  }
  return fallback
}

function readBoolean(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
      const n = value.trim().toLowerCase()
      if (n === "true" || n === "1" || n === "yes") return true
      if (n === "false" || n === "0" || n === "no") return false
    }
  }
  return false
}

function readId(row: AdminRecord): string | number | null {
  return readDefaultAvatarId(row)
}

function genderLabel(value: string) {
  if (value === "male") return "Male"
  if (value === "female") return "Female"
  if (value === "neutral") return "Neutral"
  return value || "—"
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.trim()) return err.message
  if (typeof err === "object" && err !== null && "payload" in err) {
    const payload = (err as { payload?: unknown }).payload
    if (payload && typeof payload === "object") {
      const rec = payload as Record<string, unknown>
      if (typeof rec.message === "string" && rec.message.trim()) return rec.message
      if (Array.isArray(rec.message)) {
        const joined = rec.message.map(String).filter(Boolean).join(". ")
        if (joined) return joined
      }
    }
  }
  return fallback
}

export function DefaultAvatarsView() {
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const permissionsReady = actor.ready
  // Soft permission gate: allow company managers; fall back to any signed-in admin shell user.
  const canManage =
    !permissionsReady ||
    canPerformPermission(actorPermissions, "users:update") ||
    canPerformPermission(actorPermissions, "employees:update") ||
    canPerformPermission(actorPermissions, "view_company_data") ||
    canPerformPermission(actorPermissions, "employees:create")

  const [token, setToken] = React.useState("")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [genderFilter, setGenderFilter] = React.useState<"" | DefaultAvatarGender>("")
  const [statusFilter, setStatusFilter] = React.useState<"" | DefaultAvatarStatus>("")
  const [includeInactive, setIncludeInactive] = React.useState(true)
  const [busyId, setBusyId] = React.useState<string | number | null>(null)

  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | number | null>(null)
  const [form, setForm] = React.useState<AvatarFormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<AdminRecord | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    setToken(readStoredToken())
  }, [])

  const loadRows = React.useCallback(async () => {
    const accessToken = readStoredToken()
    setToken(accessToken)
    if (!accessToken) {
      setError("Your session expired. Please sign in again.")
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await listDefaultAvatars(accessToken, {
        gender_category: genderFilter || undefined,
        status: statusFilter || undefined,
        include_inactive: includeInactive,
      })
      setRows(
        [...list].sort((a, b) => {
          const orderA = readNumber(a, ["display_order", "displayOrder"], 0)
          const orderB = readNumber(b, ["display_order", "displayOrder"], 0)
          if (orderA !== orderB) return orderA - orderB
          return readString(a, ["avatar_name", "name"]).localeCompare(
            readString(b, ["avatar_name", "name"])
          )
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load default avatars.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [genderFilter, includeInactive, statusFilter])

  React.useEffect(() => {
    void loadRows()
  }, [loadRows])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  const applyRowToForm = (row: AdminRecord) => {
    const gender = readString(row, ["gender_category", "genderCategory"], "neutral")
    const status = readString(row, ["status"], "active")
    setForm({
      avatar_name: readString(row, ["avatar_name", "name", "title"], ""),
      gender_category:
        gender === "male" || gender === "female" || gender === "neutral" ? gender : "neutral",
      display_order: String(readNumber(row, ["display_order", "displayOrder"], 0)),
      is_default: readBoolean(row, ["is_default", "isDefault"]),
      status: status === "inactive" ? "inactive" : "active",
      file: null,
      previewUrl: extractDefaultAvatarImageUrl(row) || "",
    })
  }

  const openEdit = (row: AdminRecord) => {
    const id = readId(row)
    setEditingId(id)
    applyRowToForm(row)
    setEditorOpen(true)
    // Refresh from GET /api/default-avatars/{id} for latest fields.
    if (id != null && token) {
      void getDefaultAvatar(token, id)
        .then((fresh) => {
          if (fresh) applyRowToForm(fresh)
        })
        .catch(() => {
          // Keep list-row values if detail fetch fails.
        })
    }
  }

  const handleFilePicked = (file: File | null) => {
    if (!file) return
    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)
    if (!isImage) {
      toast.error("Please choose an image file (PNG, JPG, WEBP, or SVG).")
      return
    }
    if (/\.heic$|\.heif$/i.test(file.name) || /heic|heif/i.test(file.type)) {
      toast.error("HEIC/HEIF images are not supported. Please use PNG or JPG.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please choose an image smaller than 5 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      setForm((prev) => ({
        ...prev,
        file,
        previewUrl: result || prev.previewUrl,
        avatar_name: prev.avatar_name.trim() || file.name.replace(/\.[^.]+$/, ""),
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!token) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    if (!form.avatar_name.trim()) {
      toast.error("Avatar name is required.")
      return
    }
    if (!editingId && !form.file) {
      toast.error("Choose an image for the avatar.")
      return
    }

    setSaving(true)
    try {
      const displayOrder = Number(form.display_order)
      const payloadBase = {
        avatar_name: form.avatar_name.trim(),
        gender_category: form.gender_category,
        display_order: Number.isFinite(displayOrder) ? Math.max(0, displayOrder) : 0,
        // Prefer dedicated set-default endpoint after save for a reliable default flag.
        is_default: false,
        status: form.status,
      }

      let savedId: string | number | null = editingId

      if (editingId == null) {
        // Normalizes SVG/large files → PNG/JPEG so create is less likely to 500.
        const image_file = await fileToBase64FileDto(form.file as File)
        // POST /api/default-avatars
        const created = await createDefaultAvatar(token, { ...payloadBase, image_file })
        savedId = readId(created ?? {}) ?? null
        showSuccessAlert("Default avatar created.")
      } else {
        // PATCH /api/default-avatars/{id}
        const body: Parameters<typeof updateDefaultAvatar>[2] = {
          avatar_name: payloadBase.avatar_name,
          gender_category: payloadBase.gender_category,
          display_order: payloadBase.display_order,
          status: payloadBase.status,
        }
        if (form.file) {
          body.image_file = await fileToBase64FileDto(form.file)
        }
        const updated = await updateDefaultAvatar(token, editingId, body)
        savedId = readId(updated ?? {}) ?? editingId
        showSuccessAlert("Default avatar updated.")
      }

      // POST /api/default-avatars/{id}/set-default when user marked default
      if (form.is_default && savedId != null) {
        try {
          await setDefaultAvatarAsDefault(token, savedId)
        } catch (setDefaultErr) {
          toast.error(
            apiErrorMessage(
              setDefaultErr,
              "Avatar saved, but setting it as default failed."
            )
          )
        }
      }

      setEditorOpen(false)
      setForm(EMPTY_FORM)
      setEditingId(null)
      await loadRows()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save avatar."))
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (row: AdminRecord) => {
    const id = readId(row)
    if (id == null || !token) return
    setBusyId(id)
    try {
      // POST /api/default-avatars/{id}/set-default
      await setDefaultAvatarAsDefault(token, id)
      showSuccessAlert("Default avatar updated.")
      await loadRows()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to set default avatar."))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !token) return
    const id = readId(deleteTarget)
    if (id == null) return
    setBusyId(id)
    try {
      // DELETE /api/default-avatars/{id}
      await deleteDefaultAvatar(token, id)
      showSuccessAlert("Avatar deleted.")
      setDeleteTarget(null)
      await loadRows()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to delete avatar."))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Default Avatars</CardTitle>
            <CardDescription>
              Manage company avatar gallery used for employee profile pictures by gender category.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadRows()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
            {canManage ? (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Add avatar
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Gender</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as "" | DefaultAvatarGender)}
              >
                <option value="">All</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "" | DefaultAvatarStatus)}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Include inactive
            </label>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading avatars…
            </div>
          ) : null}

          {!loading && !error && rows.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-10 text-center">
              <UserRound className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No default avatars yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload male, female, and neutral avatars for employees to pick from.
              </p>
              {canManage ? (
                <Button type="button" className="mt-4" size="sm" onClick={openCreate}>
                  <Plus className="size-4" />
                  Add first avatar
                </Button>
              ) : null}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((row) => {
                const id = readId(row)
                const name = readString(row, ["avatar_name", "name", "title"], "Untitled")
                const gender = readString(row, ["gender_category", "genderCategory"], "neutral")
                const status = readString(row, ["status"], "active")
                const isDefault = readBoolean(row, ["is_default", "isDefault"])
                const order = readNumber(row, ["display_order", "displayOrder"], 0)
                const imageUrl = extractDefaultAvatarImageUrl(row)
                const isBusy = busyId != null && id != null && String(busyId) === String(id)

                return (
                  <div
                    key={String(id ?? name)}
                    className={cn(
                      "relative flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm",
                      isDefault && "border-primary/40 ring-1 ring-primary/20"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-16 shrink-0 ring-1 ring-border" size="lg">
                        {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
                        <AvatarFallback className="text-base font-semibold">
                          {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                          {isDefault ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <Star className="size-2.5 fill-current" />
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {genderLabel(gender)} · {status === "inactive" ? "Inactive" : "Active"} · #{order}
                        </p>
                      </div>
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          onClick={() => openEdit(row)}
                          disabled={isBusy}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        {!isDefault ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs"
                            onClick={() => void handleSetDefault(row)}
                            disabled={isBusy}
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3.5" />
                            )}
                            Set default
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                          disabled={isBusy}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setEditorOpen(false)
            setEditingId(null)
            setForm(EMPTY_FORM)
          }
        }}
      >
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId == null ? "Add default avatar" : "Edit default avatar"}</DialogTitle>
            <DialogDescription>
              {editingId == null
                ? "Upload an image and set name, gender category, order, and status."
                : "Update avatar details. Replacing the image is optional."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-1 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-16 ring-1 ring-border" size="lg">
                {form.previewUrl ? <AvatarImage src={form.previewUrl} alt="Preview" /> : null}
                <AvatarFallback>
                  <UserRound className="size-6" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.svg"
                  className="hidden"
                  onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {form.file || form.previewUrl ? "Change image" : "Choose image"}
                  {editingId == null ? " *" : ""}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  {editingId == null
                    ? "Required. PNG, JPG, WEBP or SVG, up to 5 MB."
                    : "Optional on edit. PNG, JPG, WEBP or SVG, up to 5 MB."}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="avatar-name">Avatar name</Label>
              <Input
                id="avatar-name"
                value={form.avatar_name}
                onChange={(e) => setForm((p) => ({ ...p, avatar_name: e.target.value }))}
                placeholder="e.g. Professional male 1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="avatar-gender">Gender category</Label>
                <select
                  id="avatar-gender"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={form.gender_category}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      gender_category: e.target.value as DefaultAvatarGender,
                    }))
                  }
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="avatar-order">Display order</Label>
                <Input
                  id="avatar-order"
                  type="number"
                  min={0}
                  value={form.display_order}
                  onChange={(e) => setForm((p) => ({ ...p, display_order: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="avatar-status">Status</Label>
                <select
                  id="avatar-status"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, status: e.target.value as DefaultAvatarStatus }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
                  className="size-4 rounded border-input"
                />
                <span>
                  Mark as default
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Applied after save for this gender category
                  </span>
                </span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditorOpen(false)
                setEditingId(null)
                setForm(EMPTY_FORM)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editingId == null ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete avatar?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                {deleteTarget
                  ? readString(deleteTarget, ["avatar_name", "name", "title"], "this avatar")
                  : "this avatar"}
              </span>{" "}
              from the default gallery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={busyId != null}
            >
              {busyId != null ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
