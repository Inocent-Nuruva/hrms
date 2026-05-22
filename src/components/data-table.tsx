"use client"

import * as React from "react"
import { toast } from "sonner"
import { showSuccessAlert } from "@/lib/success-alert"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminRecord, AdminResourceKey, SortOrder, UsersQueryParams } from "@/lib/admin-api"
import { RESOURCE_LABELS } from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import {
  CopyIcon,
  EllipsisVerticalIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

interface DataTableProps {
  token: string
  activeResource: AdminResourceKey
  rows: AdminRecord[]
  roles: AdminRecord[]
  permissions: AdminRecord[]
  usersQuery: Required<UsersQueryParams>
  usersTotal: number | null
  usersTotalPages: number | null
  onUsersQueryChange: (query: Partial<Required<UsersQueryParams>>) => void
  loading: boolean
  error: string | null
  onCreate: (resource: AdminResourceKey, payload: AdminRecord) => Promise<void>
  onPatch: (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number,
    payload: AdminRecord
  ) => Promise<void>
  onDelete: (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number
  ) => Promise<void>
  onUpdateUser: (id: string | number, payload: AdminRecord) => Promise<void>
  onSetUserPassword: (id: string | number, newPassword: string) => Promise<void>
  onSyncUserRoles: (
    userId: string | number,
    addRoleIds: (string | number)[],
    removeRoleIds: (string | number)[]
  ) => Promise<void>
}

type EditableResource = Exclude<AdminResourceKey, "companies">
type EntityResource = Exclude<AdminResourceKey, "users" | "companies">

interface UserFormState {
  first_name: string
  last_name: string
  phone: string
  email: string
  password: string
  user_no: string
  status: string
  roleIds: string[]
}

interface BasicEntityForm {
  name: string
  display_name: string
  description: string
}

interface CompanyForm {
  company_name: string
  company_slug: string
  admin_first_name: string
  admin_last_name: string
  admin_email: string
  admin_phone: string
  admin_password: string
}

const EMPTY_USER_FORM: UserFormState = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  password: "",
  user_no: "",
  status: "active",
  roleIds: [],
}

const EMPTY_ENTITY_FORM: BasicEntityForm = {
  name: "",
  display_name: "",
  description: "",
}

const EMPTY_COMPANY_FORM: CompanyForm = {
  company_name: "",
  company_slug: "",
  admin_first_name: "",
  admin_last_name: "",
  admin_email: "",
  admin_phone: "",
  admin_password: "",
}

function isEditableResource(resource: AdminResourceKey): resource is EditableResource {
  return resource !== "companies"
}

function getRowId(row: AdminRecord, fallbackIndex: number): string | number {
  const candidates = [row.id, row.user_id, row.user_no, row.name, row.email]
  const identified = candidates.find(
    (value) => typeof value === "string" || typeof value === "number"
  )
  return identified ?? fallbackIndex
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "-"
    }
    const first = value[0]
    if (typeof first === "string" || typeof first === "number") {
      return value.slice(0, 2).map((item) => String(item)).join(", ") + (value.length > 2 ? "..." : "")
    }
    return `${value.length} item(s)`
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const preferredKeys = ["name", "display_name", "title", "slug", "email", "code", "id"]
    for (const key of preferredKeys) {
      const candidate = record[key]
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate
      }
      if (typeof candidate === "number" || typeof candidate === "boolean") {
        return String(candidate)
      }
    }
    return "Object"
  }
  return String(value)
}

function getVisibleColumns(rows: AdminRecord[]) {
  if (rows.length === 0) {
    return ["id", "name", "email"]
  }

  const preferredOrder = [
    "id",
    "user_no",
    "first_name",
    "last_name",
    "email",
    "phone",
    "name",
    "display_name",
    "description",
    "company_name",
    "company_slug",
    "status",
    "created_at",
  ]

  const rowKeys = new Set<string>()
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => rowKeys.add(key))
  })

  const ordered = preferredOrder.filter((key) => rowKeys.has(key))
  const remaining = Array.from(rowKeys)
    .filter((key) => !ordered.includes(key))
    .sort((a, b) => a.localeCompare(b))
  return [...ordered, ...remaining].slice(0, 8)
}

function prettifyKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function asRoleId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  return null
}

function rolePayloadId(value: string): string | number {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && String(parsed) === value) {
    return parsed
  }
  return value
}

function roleLabel(role: AdminRecord) {
  const display = role.display_name
  if (typeof display === "string" && display.trim()) {
    return display.trim()
  }
  const name = role.name
  if (typeof name === "string" && name.trim()) {
    return name.trim()
  }
  return "Unnamed role"
}

function asPermissionName(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

function permissionLabel(permission: AdminRecord) {
  const display = permission.display_name
  if (typeof display === "string" && display.trim()) {
    return display.trim()
  }
  const name = permission.name
  if (typeof name === "string" && name.trim()) {
    return name.trim()
  }
  return "Unnamed permission"
}

function rolePermissionNamesFromRecord(row: AdminRecord): string[] {
  const source = row.permissions
  if (!Array.isArray(source)) {
    return []
  }

  const names = source
    .map((entry) => {
      if (typeof entry === "string" || typeof entry === "number") {
        return asPermissionName(entry)
      }
      if (typeof entry === "object" && entry !== null) {
        const permissionRecord = entry as AdminRecord
        return (
          asPermissionName(permissionRecord.name) ??
          asPermissionName(permissionRecord.display_name) ??
          asPermissionName(permissionRecord.id)
        )
      }
      return null
    })
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(names))
}

function userRoleIds(row: AdminRecord): string[] {
  const roles = row.roles
  if (!Array.isArray(roles)) {
    return []
  }

  return roles
    .map((role) => {
      if (typeof role === "string" || typeof role === "number") {
        return asRoleId(role)
      }
      if (typeof role === "object" && role !== null) {
        return asRoleId((role as AdminRecord).id)
      }
      return null
    })
    .filter((value): value is string => Boolean(value))
}

function toUserForm(row: AdminRecord): UserFormState {
  return {
    first_name: typeof row.first_name === "string" ? row.first_name : "",
    last_name: typeof row.last_name === "string" ? row.last_name : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : "",
    password: "",
    user_no: typeof row.user_no === "string" ? row.user_no : "",
    status: typeof row.status === "string" && row.status.trim() ? row.status : "active",
    roleIds: userRoleIds(row),
  }
}

function toEntityForm(row: AdminRecord): BasicEntityForm {
  return {
    name: typeof row.name === "string" ? row.name : "",
    display_name: typeof row.display_name === "string" ? row.display_name : "",
    description: typeof row.description === "string" ? row.description : "",
  }
}

export function DataTable({
  token,
  activeResource,
  rows,
  roles,
  permissions,
  usersQuery,
  usersTotal,
  usersTotalPages,
  onUsersQueryChange,
  loading,
  error,
  onCreate,
  onPatch,
  onDelete,
  onUpdateUser,
  onSetUserPassword,
  onSyncUserRoles,
}: DataTableProps) {
  const [searchInput, setSearchInput] = React.useState(usersQuery.search)
  const [createUserForm, setCreateUserForm] = React.useState<UserFormState>(EMPTY_USER_FORM)
  const [editingUser, setEditingUser] = React.useState<{ id: string | number; label: string } | null>(null)
  const [editUserForm, setEditUserForm] = React.useState<UserFormState>(EMPTY_USER_FORM)
  const [targetPasswordUser, setTargetPasswordUser] = React.useState<{ id: string | number; label: string } | null>(null)
  const [targetPassword, setTargetPassword] = React.useState("")

  const [roleForm, setRoleForm] = React.useState<BasicEntityForm>(EMPTY_ENTITY_FORM)
  const [rolePermissionNames, setRolePermissionNames] = React.useState<string[]>([])
  const [companyForm, setCompanyForm] = React.useState<CompanyForm>(EMPTY_COMPANY_FORM)
  const [editingEntity, setEditingEntity] = React.useState<{
    resource: EntityResource
    id: string | number
    label: string
  } | null>(null)
  const [editingEntityForm, setEditingEntityForm] = React.useState<BasicEntityForm>(EMPTY_ENTITY_FORM)
  const [editingRolePermissionNames, setEditingRolePermissionNames] = React.useState<string[]>([])

  const columns = React.useMemo(() => {
    const baseColumns = getVisibleColumns(rows)
    if (activeResource === "roles") {
      return baseColumns.filter(
        (column) => column !== "company_id" && column !== "companyId"
      )
    }
    return baseColumns
  }, [activeResource, rows])
  const roleOptions = React.useMemo(() => {
    return roles
      .map((role) => {
        const id = asRoleId(role.id)
        if (!id) {
          return null
        }
        return { id, label: roleLabel(role) }
      })
      .filter((item): item is { id: string; label: string } => Boolean(item))
  }, [roles])
  const permissionOptions = React.useMemo(() => {
    return permissions
      .map((permission) => {
        const id = asRoleId(permission.id)
        const name =
          asPermissionName(permission.name) ??
          asPermissionName(permission.display_name) ??
          asPermissionName(permission.id)
        if (!name || !id) {
          return null
        }
        return { id, name, label: permissionLabel(permission) }
      })
      .filter((item): item is { id: string; name: string; label: string } => Boolean(item))
  }, [permissions])

  const permissionIdsFromSelection = React.useCallback(
    (selection: string[]) => {
      const resolved = selection
        .map((value) => {
          const byName = permissionOptions.find((permission) => permission.name === value)
          if (byName) {
            return rolePayloadId(byName.id)
          }
          return rolePayloadId(value)
        })
        .filter((value) => value !== "")
      return Array.from(new Set(resolved))
    },
    [permissionOptions]
  )

  React.useEffect(() => {
    setSearchInput(usersQuery.search)
  }, [usersQuery.search])

  const toggleRoleId = (
    roleIds: string[],
    roleId: string,
    onChange: (next: string[]) => void
  ) => {
    if (roleIds.includes(roleId)) {
      onChange(roleIds.filter((id) => id !== roleId))
      return
    }
    onChange([...roleIds, roleId])
  }

  const togglePermissionName = (
    selectedPermissionNames: string[],
    permissionName: string,
    onChange: (next: string[]) => void
  ) => {
    if (selectedPermissionNames.includes(permissionName)) {
      onChange(selectedPermissionNames.filter((name) => name !== permissionName))
      return
    }
    onChange([...selectedPermissionNames, permissionName])
  }

  const handleCreate = async () => {
    if (!token) {
      toast.error("Your session expired. Please sign in again.")
      return
    }

    try {
      if (activeResource === "users") {
        if (!createUserForm.first_name.trim() || !createUserForm.last_name.trim()) {
          toast.error("First name and last name are required.")
          return
        }
        if (!createUserForm.email.trim()) {
          toast.error("Email is required.")
          return
        }
        if (!createUserForm.password.trim()) {
          toast.error("Password is required.")
          return
        }

        await onCreate("users", {
          first_name: createUserForm.first_name.trim(),
          last_name: createUserForm.last_name.trim(),
          phone: createUserForm.phone.trim(),
          email: createUserForm.email.trim().toLowerCase(),
          password: createUserForm.password,
          user_no: createUserForm.user_no.trim(),
          status: createUserForm.status,
          roles: createUserForm.roleIds.map((id) => ({ id: rolePayloadId(id) })),
        })
        setCreateUserForm(EMPTY_USER_FORM)
      }

      if (activeResource === "roles") {
        if (!roleForm.name.trim()) {
          toast.error("Role name is required.")
          return
        }
        await onCreate("roles", {
          name: roleForm.name.trim(),
          display_name: roleForm.display_name.trim(),
          description: roleForm.description.trim(),
          permission_ids: permissionIdsFromSelection(rolePermissionNames),
        })
        setRoleForm(EMPTY_ENTITY_FORM)
        setRolePermissionNames([])
      }

      if (activeResource === "permissions") {
        if (!roleForm.name.trim() || !roleForm.display_name.trim()) {
          toast.error("Permission name and display name are required.")
          return
        }
        await onCreate("permissions", {
          name: roleForm.name.trim(),
          display_name: roleForm.display_name.trim(),
          description: roleForm.description.trim(),
        })
        setRoleForm(EMPTY_ENTITY_FORM)
      }

      if (activeResource === "companies") {
        if (!companyForm.company_name.trim() || !companyForm.company_slug.trim()) {
          toast.error("Company name and slug are required.")
          return
        }
        await onCreate("companies", {
          company_name: companyForm.company_name.trim(),
          company_slug: companyForm.company_slug.trim(),
          admin_first_name: companyForm.admin_first_name.trim(),
          admin_last_name: companyForm.admin_last_name.trim(),
          admin_email: companyForm.admin_email.trim().toLowerCase(),
          admin_phone: companyForm.admin_phone.trim(),
          admin_password: companyForm.admin_password,
        })
        setCompanyForm(EMPTY_COMPANY_FORM)
      }

      showSuccessAlert(`${RESOURCE_LABELS[activeResource]} created.`)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Create failed."
      toast.error(message)
    }
  }

  const handleSaveUserEdit = async () => {
    if (!token || !editingUser) {
      return
    }

    try {
      await onUpdateUser(editingUser.id, {
        first_name: editUserForm.first_name.trim(),
        last_name: editUserForm.last_name.trim(),
        phone: editUserForm.phone.trim(),
        email: editUserForm.email.trim().toLowerCase(),
        user_no: editUserForm.user_no.trim(),
        status: editUserForm.status,
      })

      const existingRow = rows.find((row, index) => getRowId(row, index + 1) === editingUser.id)
      const previousRoleIds = new Set(existingRow ? userRoleIds(existingRow) : [])
      const nextRoleIds = new Set(editUserForm.roleIds)
      const addRoleIds = Array.from(nextRoleIds).filter((id) => !previousRoleIds.has(id)).map(rolePayloadId)
      const removeRoleIds = Array.from(previousRoleIds).filter((id) => !nextRoleIds.has(id)).map(rolePayloadId)

      if (addRoleIds.length > 0 || removeRoleIds.length > 0) {
        await onSyncUserRoles(editingUser.id, addRoleIds, removeRoleIds)
      }

      setEditingUser(null)
      showSuccessAlert("User updated.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Update failed."
      toast.error(message)
    }
  }

  const handleSaveEntityEdit = async () => {
    if (!token || !editingEntity) {
      return
    }

    try {
      await onPatch(editingEntity.resource, editingEntity.id, {
        name: editingEntityForm.name.trim(),
        display_name: editingEntityForm.display_name.trim(),
        description: editingEntityForm.description.trim(),
        ...(editingEntity.resource === "roles"
          ? { permission_ids: permissionIdsFromSelection(editingRolePermissionNames) }
          : {}),
      })
      setEditingEntity(null)
      setEditingRolePermissionNames([])
      showSuccessAlert(`${RESOURCE_LABELS[editingEntity.resource]} updated.`)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Update failed."
      toast.error(message)
    }
  }

  const handleDelete = async (rowId: string | number) => {
    if (!token) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    if (!isEditableResource(activeResource)) {
      return
    }

    try {
      await onDelete(activeResource, rowId)
      showSuccessAlert(`${RESOURCE_LABELS[activeResource]} deleted.`)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Delete failed."
      toast.error(message)
    }
  }

  const handleSetPassword = async () => {
    if (!token || !targetPasswordUser) {
      return
    }
    if (!targetPassword.trim()) {
      toast.error("New password is required.")
      return
    }

    try {
      await onSetUserPassword(targetPasswordUser.id, targetPassword)
      setTargetPassword("")
      setTargetPasswordUser(null)
      showSuccessAlert("Password updated.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Password update failed."
      toast.error(message)
    }
  }

  const sortOrder = usersQuery.sortOrder as SortOrder
  const canPrevPage = usersQuery.page > 1
  const canNextPage = usersTotalPages
    ? usersQuery.page < usersTotalPages
    : rows.length >= usersQuery.limit
  const canCreateResource = true

  return (
    <div className="w-full flex-col justify-start gap-6">
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex items-center justify-end gap-3">
          {canCreateResource ? (
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm">
                  <PlusIcon data-icon="inline-start" />
                  <span>Create</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Create {RESOURCE_LABELS[activeResource].slice(0, -1)}</DrawerTitle>
                  <DrawerDescription>Fill in the details and submit.</DrawerDescription>
                </DrawerHeader>
                <div className="grid gap-3 px-4 pb-2 md:grid-cols-2">
                {activeResource === "users" ? (
                  <>
                    <div className="space-y-1">
                      <Label>First Name</Label>
                      <Input
                        value={createUserForm.first_name}
                        onChange={(event) =>
                          setCreateUserForm((prev) => ({ ...prev, first_name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Last Name</Label>
                      <Input
                        value={createUserForm.last_name}
                        onChange={(event) =>
                          setCreateUserForm((prev) => ({ ...prev, last_name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={createUserForm.email}
                        onChange={(event) =>
                          setCreateUserForm((prev) => ({ ...prev, email: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input
                        value={createUserForm.phone}
                        onChange={(event) =>
                          setCreateUserForm((prev) => ({ ...prev, phone: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>User Number</Label>
                      <Input
                        value={createUserForm.user_no}
                        onChange={(event) =>
                          setCreateUserForm((prev) => ({ ...prev, user_no: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select
                        value={createUserForm.status}
                        onValueChange={(value) =>
                          setCreateUserForm((prev) => ({ ...prev, status: value ?? "active" }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={createUserForm.password}
                        onChange={(event) =>
                          setCreateUserForm((prev) => ({ ...prev, password: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Assign Roles</Label>
                      <div className="flex flex-wrap gap-2">
                        {roleOptions.map((role) => (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() =>
                              toggleRoleId(createUserForm.roleIds, role.id, (next) =>
                                setCreateUserForm((prev) => ({ ...prev, roleIds: next }))
                              )
                            }
                            className={cn(
                              "rounded-md border px-2 py-1 text-sm",
                              createUserForm.roleIds.includes(role.id)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background"
                            )}
                          >
                            {role.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {activeResource === "roles" ? (
                  <>
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input
                        value={roleForm.name}
                        onChange={(event) =>
                          setRoleForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Display Name</Label>
                      <Input
                        value={roleForm.display_name}
                        onChange={(event) =>
                          setRoleForm((prev) => ({ ...prev, display_name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={roleForm.description}
                        onChange={(event) =>
                          setRoleForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Assign Permissions</Label>
                      <div className="flex flex-wrap gap-2">
                        {permissionOptions.map((permission) => (
                          <button
                            key={permission.name}
                            type="button"
                            onClick={() =>
                              togglePermissionName(rolePermissionNames, permission.name, setRolePermissionNames)
                            }
                            className={cn(
                              "rounded-md border px-2 py-1 text-sm",
                              rolePermissionNames.includes(permission.name)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background"
                            )}
                          >
                            {permission.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {activeResource === "companies" ? (
                  <>
                    <div className="space-y-1">
                      <Label>Company Name</Label>
                      <Input
                        value={companyForm.company_name}
                        onChange={(event) =>
                          setCompanyForm((prev) => ({ ...prev, company_name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Company Slug</Label>
                      <Input
                        value={companyForm.company_slug}
                        onChange={(event) =>
                          setCompanyForm((prev) => ({ ...prev, company_slug: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Admin First Name</Label>
                      <Input
                        value={companyForm.admin_first_name}
                        onChange={(event) =>
                          setCompanyForm((prev) => ({ ...prev, admin_first_name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Admin Last Name</Label>
                      <Input
                        value={companyForm.admin_last_name}
                        onChange={(event) =>
                          setCompanyForm((prev) => ({ ...prev, admin_last_name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Admin Email</Label>
                      <Input
                        type="email"
                        value={companyForm.admin_email}
                        onChange={(event) =>
                          setCompanyForm((prev) => ({ ...prev, admin_email: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Admin Phone</Label>
                      <Input
                        value={companyForm.admin_phone}
                        onChange={(event) =>
                          setCompanyForm((prev) => ({ ...prev, admin_phone: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>Admin Password</Label>
                      <Input
                        type="password"
                        value={companyForm.admin_password}
                        onChange={(event) =>
                          setCompanyForm((prev) => ({ ...prev, admin_password: event.target.value }))
                        }
                      />
                    </div>
                  </>
                ) : null}
                </div>
                <DrawerFooter>
                  <Button onClick={handleCreate} disabled={loading}>
                    Create Record
                  </Button>
                  <DrawerClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : null}
        </div>

        {activeResource === "users" ? (
          <div className="rounded-lg border p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <Label>Search</Label>
                <Input
                  value={searchInput}
                  placeholder="Search name, email, phone, user number"
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onUsersQueryChange({ search: searchInput })
                    }
                  }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Sort By</Label>
                  <Select
                    value={usersQuery.sortBy}
                    onValueChange={(value) => {
                      if (!value) {
                        return
                      }
                      onUsersQueryChange({ sortBy: value })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="first_name">First Name</SelectItem>
                      <SelectItem value="last_name">Last Name</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Order</Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value) => {
                      if (!value) {
                        return
                      }
                      onUsersQueryChange({ sortOrder: value as SortOrder })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DESC">DESC</SelectItem>
                      <SelectItem value="ASC">ASC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onUsersQueryChange({ search: searchInput })}
                disabled={loading}
              >
                Apply
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchInput("")
                  onUsersQueryChange({ search: "" })
                }}
                disabled={loading}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
          <div className="rounded-lg border">
            <Table>
              <TableHeader
                className="sticky top-0 z-10"
                style={{ backgroundColor: "var(--table-header-accent-bg)" }}
              >
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column} style={{ color: "var(--table-header-accent)" }}>
                      {prettifyKey(column)}
                    </TableHead>
                  ))}
                  <TableHead className="w-16 text-right" style={{ color: "var(--table-header-accent)" }}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!token ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                      Sign in to load data.
                    </TableCell>
                  </TableRow>
                ) : loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                      Loading {RESOURCE_LABELS[activeResource].toLowerCase()}...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-24 text-center text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => {
                    const rowId = getRowId(row, index + 1)
                    const rowLabel = stringifyValue(row.name ?? row.email ?? rowId)

                    return (
                      <TableRow key={`${rowId}`}>
                        {columns.map((column) => (
                          <TableCell key={`${rowId}-${column}`}>
                            <span className="block max-w-[24rem] truncate">{stringifyValue(row[column])}</span>
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="size-8" />}
                            >
                              <EllipsisVerticalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => {
                                  void navigator.clipboard.writeText(JSON.stringify(row, null, 2))
                                  showSuccessAlert("Record details copied.")
                                }}
                              >
                                <CopyIcon />
                                Copy Details
                              </DropdownMenuItem>

                              {activeResource === "users" ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingUser({ id: rowId, label: rowLabel })
                                    setEditUserForm(toUserForm(row))
                                  }}
                                >
                                  <PencilIcon />
                                  Edit User
                                </DropdownMenuItem>
                              ) : null}

                              {activeResource === "users" ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setTargetPasswordUser({ id: rowId, label: rowLabel })
                                    setTargetPassword("")
                                  }}
                                >
                                  <KeyRoundIcon />
                                  Set Password
                                </DropdownMenuItem>
                              ) : null}

                              {(activeResource === "roles" || activeResource === "permissions") &&
                              isEditableResource(activeResource) ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingEntity({ resource: activeResource, id: rowId, label: rowLabel })
                                    setEditingEntityForm(toEntityForm(row))
                                    if (activeResource === "roles") {
                                      setEditingRolePermissionNames(rolePermissionNamesFromRecord(row))
                                    } else {
                                      setEditingRolePermissionNames([])
                                    }
                                  }}
                                >
                                  <PencilIcon />
                                  Edit Record
                                </DropdownMenuItem>
                              ) : null}

                              {isEditableResource(activeResource) ? <DropdownMenuSeparator /> : null}
                              {isEditableResource(activeResource) ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => void handleDelete(rowId)}
                                >
                                  <Trash2Icon />
                                  Delete
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
            <div>
              {activeResource === "users"
                ? `${usersTotal ?? rows.length} users found`
                : `${rows.length} ${RESOURCE_LABELS[activeResource].toLowerCase()} loaded`}
            </div>
            <Badge variant="outline">{activeResource}</Badge>
          </div>

          {activeResource === "users" ? (
            <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
              <div>
                Page {usersQuery.page}
                {usersTotalPages ? ` of ${usersTotalPages}` : ""}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canPrevPage || loading}
                  onClick={() => onUsersQueryChange({ page: usersQuery.page - 1 })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canNextPage || loading}
                  onClick={() => onUsersQueryChange({ page: usersQuery.page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
      </div>

      <Drawer open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit {editingUser?.label ?? "user"}</DrawerTitle>
            <DrawerDescription>Update user details and assigned roles.</DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-3 px-4 pb-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input
                value={editUserForm.first_name}
                onChange={(event) =>
                  setEditUserForm((prev) => ({ ...prev, first_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input
                value={editUserForm.last_name}
                onChange={(event) =>
                  setEditUserForm((prev) => ({ ...prev, last_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={editUserForm.email}
                onChange={(event) =>
                  setEditUserForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={editUserForm.phone}
                onChange={(event) =>
                  setEditUserForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>User Number</Label>
              <Input
                value={editUserForm.user_no}
                onChange={(event) =>
                  setEditUserForm((prev) => ({ ...prev, user_no: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={editUserForm.status}
                onValueChange={(value) =>
                  setEditUserForm((prev) => ({ ...prev, status: value ?? "active" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Assigned Roles</Label>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                      toggleRoleId(editUserForm.roleIds, role.id, (next) =>
                        setEditUserForm((prev) => ({ ...prev, roleIds: next }))
                      )
                    }
                    className={cn(
                      "rounded-md border px-2 py-1 text-sm",
                      editUserForm.roleIds.includes(role.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background"
                    )}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleSaveUserEdit} disabled={loading || !editingUser}>
              Save Changes
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(targetPasswordUser)}
        onOpenChange={(open) => !open && setTargetPasswordUser(null)}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Set Password for {targetPasswordUser?.label ?? "user"}</DrawerTitle>
            <DrawerDescription>Update user password</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-1 px-4 pb-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={targetPassword}
              onChange={(event) => setTargetPassword(event.target.value)}
            />
          </div>
          <DrawerFooter>
            <Button onClick={handleSetPassword} disabled={loading || !targetPasswordUser}>
              Update Password
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(editingEntity)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEntity(null)
            setEditingRolePermissionNames([])
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit {editingEntity?.label ?? "record"}</DrawerTitle>
            <DrawerDescription>Update the selected record details.</DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-3 px-4 pb-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={editingEntityForm.name}
                onChange={(event) =>
                  setEditingEntityForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Display Name</Label>
              <Input
                value={editingEntityForm.display_name}
                onChange={(event) =>
                  setEditingEntityForm((prev) => ({ ...prev, display_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Description</Label>
              <Input
                value={editingEntityForm.description}
                onChange={(event) =>
                  setEditingEntityForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
            {editingEntity?.resource === "roles" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Assigned Permissions</Label>
                <div className="flex flex-wrap gap-2">
                  {permissionOptions.map((permission) => (
                    <button
                      key={permission.name}
                      type="button"
                      onClick={() =>
                        togglePermissionName(
                          editingRolePermissionNames,
                          permission.name,
                          setEditingRolePermissionNames
                        )
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 text-sm",
                        editingRolePermissionNames.includes(permission.name)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background"
                      )}
                    >
                      {permission.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <Separator className="my-1" />
          <DrawerFooter>
            <Button onClick={handleSaveEntityEdit} disabled={loading || !editingEntity}>
              Save Changes
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
