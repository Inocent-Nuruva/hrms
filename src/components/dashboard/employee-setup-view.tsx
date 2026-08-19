"use client"

import * as React from "react"
import { Loader2, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createEmployeeGrade,
  deleteEmployeeGrade,
  getEmployeeGrade,
  getEmployeeNumbering,
  listEmployeeGrades,
  patchEmployeeGrade,
  updateEmployeeNumbering,
  type AdminRecord,
} from "@/lib/admin-api"
import { subscribeToDashboardActorSnapshot } from "@/lib/dashboard-permissions"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"

type GradeFormState = {
  code: string
  name: string
  level: string
  description: string
  status: string
}

const EMPTY_GRADE_FORM: GradeFormState = {
  code: "",
  name: "",
  level: "",
  description: "",
  status: "active",
}

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function readString(row: AdminRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

function readNumber(row: AdminRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readId(row: AdminRecord) {
  return readNumber(row, ["id"])
}

function apiErrorMessage(errorObject: unknown, fallback: string) {
  if (errorObject instanceof Error && errorObject.message.trim()) {
    return errorObject.message
  }

  if (typeof errorObject === "object" && errorObject !== null && "payload" in errorObject) {
    const payload = (errorObject as { payload?: unknown }).payload
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>
      if (typeof record.message === "string" && record.message.trim()) {
        return record.message
      }
      if (Array.isArray(record.message)) {
        const joined = record.message.map(String).filter(Boolean).join(". ")
        if (joined) {
          return joined
        }
      }
    }
  }

  return fallback
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function sampleEmployeeNumber(prefix: string, padding: string, nextNumber: string) {
  const numericPadding = Number(padding)
  const numericNext = Number(nextNumber)
  if (!Number.isFinite(numericPadding) || !Number.isFinite(numericNext)) {
    return "-"
  }
  const body = String(Math.max(1, numericNext)).padStart(Math.max(1, numericPadding), "0")
  return `${prefix.trim()}${body}`
}

function applyGradeToForm(row: AdminRecord): GradeFormState {
  return {
    code: readString(row, ["code"]),
    name: readString(row, ["name"]),
    level: String(readNumber(row, ["level"]) ?? ""),
    description: readString(row, ["description"]),
    status: readString(row, ["status"], "active"),
  }
}

export function EmployeeSetupView({ mode = "full" }: { mode?: "full" | "numbering" }) {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [token, setToken] = React.useState("")
  const [numbering, setNumbering] = React.useState<AdminRecord | null>(null)
  const [numberingForm, setNumberingForm] = React.useState({
    prefix: "",
    padding: "5",
    next_number: "1",
  })
  const [grades, setGrades] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [numberingSaving, setNumberingSaving] = React.useState(false)
  const [gradesSaving, setGradesSaving] = React.useState(false)
  const [numberingError, setNumberingError] = React.useState<string | null>(null)
  const [gradesError, setGradesError] = React.useState<string | null>(null)
  const [numberingMessage, setNumberingMessage] = React.useState<string | null>(null)
  const [gradesMessage, setGradesMessage] = React.useState<string | null>(null)
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingGradeId, setEditingGradeId] = React.useState<number | null>(null)
  const [gradeForm, setGradeForm] = React.useState<GradeFormState>(EMPTY_GRADE_FORM)
  const [deleteTarget, setDeleteTarget] = React.useState<AdminRecord | null>(null)

  React.useEffect(() => {
    setToken(readStoredToken())

    const sync = () => setToken(readStoredToken())
    const unsubscribe = subscribeToDashboardActorSnapshot(sync)
    window.addEventListener("focus", sync)

    return () => {
      unsubscribe()
      window.removeEventListener("focus", sync)
    }
  }, [])

  const loadData = React.useCallback(async () => {
    const accessToken = readStoredToken()
    setToken(accessToken)
    if (!accessToken) {
      setNumberingError("Authentication token not found. Please log in again.")
      setGradesError("Authentication token not found. Please log in again.")
      setNumbering(null)
      setGrades([])
      return
    }

    setLoading(true)
    setNumberingError(null)
    setGradesError(null)
    try {
      const numberingRecord = await getEmployeeNumbering(accessToken)
      const normalizedNumbering = numberingRecord ?? {}

      setNumbering(numberingRecord)
      setNumberingForm({
        prefix: readString(normalizedNumbering, ["prefix"]),
        padding: String(readNumber(normalizedNumbering, ["padding"]) ?? 5),
        next_number: String(readNumber(normalizedNumbering, ["next_number", "nextNumber"]) ?? 1),
      })

      if (mode === "numbering") {
        setGrades([])
      } else {
        const gradeRows = await listEmployeeGrades(accessToken)
        setGrades(
          [...gradeRows].sort((first, second) => {
            const levelCompare = (readNumber(first, ["level"]) ?? 9999) - (readNumber(second, ["level"]) ?? 9999)
            if (levelCompare !== 0) {
              return levelCompare
            }
            return readString(first, ["name"]).localeCompare(readString(second, ["name"]))
          })
        )
      }
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) {
        return
      }
      const message = apiErrorMessage(errorObject, "Failed to load employee setup data.")
      setNumberingError(message)
      setGradesError(message)
      setNumbering(null)
      setGrades([])
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden, mode])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const openCreate = React.useCallback(() => {
    setEditingGradeId(null)
    setGradeForm(EMPTY_GRADE_FORM)
    setGradesError(null)
    setGradesMessage(null)
    setEditorOpen(true)
  }, [])

  const openEdit = React.useCallback(
    async (row: AdminRecord) => {
      const accessToken = readStoredToken()
      const id = readId(row)
      if (!accessToken || id === null) {
        setGradesError("Unable to load that employee grade right now.")
        return
      }

      setEditingGradeId(id)
      setGradeForm(applyGradeToForm(row))
      setGradesError(null)
      setGradesMessage(null)
      setEditorOpen(true)

      try {
        const fresh = await getEmployeeGrade(accessToken, id)
        if (fresh) {
          setGradeForm(applyGradeToForm(fresh))
        }
      } catch {
        // Keep the list values if detail fetch fails.
      }
    },
    []
  )

  const saveNumbering = React.useCallback(async () => {
    const accessToken = readStoredToken()
    if (!accessToken) {
      setNumberingError("Authentication token not found. Please log in again.")
      return
    }

    const prefix = numberingForm.prefix.trim().toUpperCase()
    const padding = Number(numberingForm.padding)
    const nextNumber = Number(numberingForm.next_number)

    if (!/^$|^[A-Z0-9]{2,20}$/.test(prefix)) {
      setNumberingError("Prefix must be blank or 2-20 uppercase letters or digits.")
      return
    }
    if (!Number.isInteger(padding) || padding < 3 || padding > 12) {
      setNumberingError("Padding must be a whole number between 3 and 12.")
      return
    }
    if (!Number.isInteger(nextNumber) || nextNumber < 1) {
      setNumberingError("Next number must be a whole number greater than 0.")
      return
    }

    setNumberingSaving(true)
    setNumberingError(null)
    setNumberingMessage(null)
    try {
      const updated = await updateEmployeeNumbering(accessToken, {
        prefix,
        padding,
        next_number: nextNumber,
      })
      const normalizedUpdated = updated ?? {}
      setNumbering(updated)
      setNumberingForm({
        prefix: readString(normalizedUpdated, ["prefix"]),
        padding: String(readNumber(normalizedUpdated, ["padding"]) ?? padding),
        next_number: String(readNumber(normalizedUpdated, ["next_number", "nextNumber"]) ?? nextNumber),
      })
      setNumberingMessage("Employee numbering updated.")
    } catch (errorObject) {
      setNumberingError(apiErrorMessage(errorObject, "Failed to update employee numbering."))
    } finally {
      setNumberingSaving(false)
    }
  }, [numberingForm])

  const saveGrade = React.useCallback(async () => {
    const accessToken = readStoredToken()
    if (!accessToken) {
      setGradesError("Authentication token not found. Please log in again.")
      return
    }

    const code = gradeForm.code.trim().toUpperCase()
    const name = gradeForm.name.trim()
    const description = gradeForm.description.trim()
    const status = gradeForm.status.trim() || "active"
    const level = gradeForm.level.trim()

    if (!code) {
      setGradesError("Code is required.")
      return
    }
    if (!name) {
      setGradesError("Name is required.")
      return
    }
    if (level && (!Number.isInteger(Number(level)) || Number(level) < 1)) {
      setGradesError("Level must be a whole number greater than 0.")
      return
    }

    const payload: AdminRecord = {
      code,
      name,
      status,
    }
    if (level) {
      payload.level = Number(level)
    }
    if (description) {
      payload.description = description
    }

    setGradesSaving(true)
    setGradesError(null)
    setGradesMessage(null)
    try {
      if (editingGradeId === null) {
        await createEmployeeGrade(accessToken, payload)
        setGradesMessage("Employee grade created.")
      } else {
        await patchEmployeeGrade(accessToken, editingGradeId, payload)
        setGradesMessage("Employee grade updated.")
      }
      setEditorOpen(false)
      setEditingGradeId(null)
      setGradeForm(EMPTY_GRADE_FORM)
      await loadData()
    } catch (errorObject) {
      setGradesError(apiErrorMessage(errorObject, "Failed to save employee grade."))
    } finally {
      setGradesSaving(false)
    }
  }, [editingGradeId, gradeForm, loadData])

  const removeGrade = React.useCallback(async () => {
    const accessToken = readStoredToken()
    const id = deleteTarget ? readId(deleteTarget) : null
    if (!accessToken || id === null) {
      setGradesError("Unable to delete this employee grade right now.")
      return
    }

    setGradesSaving(true)
    setGradesError(null)
    setGradesMessage(null)
    try {
      await deleteEmployeeGrade(accessToken, id)
      setDeleteTarget(null)
      setGradesMessage("Employee grade deleted.")
      await loadData()
    } catch (errorObject) {
      setGradesError(apiErrorMessage(errorObject, "Failed to delete employee grade."))
    } finally {
      setGradesSaving(false)
    }
  }, [deleteTarget, loadData])

  const numberingPreview = React.useMemo(
    () => sampleEmployeeNumber(numberingForm.prefix, numberingForm.padding, numberingForm.next_number),
    [numberingForm.next_number, numberingForm.padding, numberingForm.prefix]
  )
  const previewPrefix = numberingForm.prefix.trim()
  const previewDigits =
    numberingPreview === "-" ? [] : numberingPreview.slice(previewPrefix.length).split("")

  const numberingEditor = (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="relative overflow-hidden px-5 py-5 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-primary/10"
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Next employee number
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Updates as you type. Saved only when you confirm.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadData()} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              </Button>
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-2.5">
              {previewPrefix ? (
                <span className="pb-1.5 text-2xl font-semibold tracking-[0.22em] text-primary">
                  {previewPrefix}
                </span>
              ) : null}
              {previewDigits.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {previewDigits.map((digit, index) => (
                    <span
                      key={`${digit}-${index}`}
                      className="flex h-12 w-9 items-center justify-center rounded-lg border border-border bg-background font-mono text-xl font-semibold tabular-nums shadow-sm"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                  Enter a valid padding and next number
                </span>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <p>
                Last saved{" "}
                <span className="font-medium text-foreground">
                  {numbering ? formatDateTime(numbering.updated_at ?? numbering.updatedAt) : "—"}
                </span>
              </p>
              <p>
                Stored next{" "}
                <span className="font-medium text-foreground">
                  {numbering ? (readNumber(numbering, ["next_number", "nextNumber"]) ?? "—") : "—"}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="grid content-start gap-3 border-t border-border bg-muted/20 p-5 lg:border-l lg:border-t-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="employee-number-prefix">Prefix</Label>
              <Input
                id="employee-number-prefix"
                value={numberingForm.prefix}
                onChange={(event) =>
                  setNumberingForm((current) => ({ ...current, prefix: event.target.value.toUpperCase() }))
                }
                placeholder="EMP"
                className="font-mono uppercase"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="employee-number-padding">Digits</Label>
              <Input
                id="employee-number-padding"
                inputMode="numeric"
                value={numberingForm.padding}
                onChange={(event) =>
                  setNumberingForm((current) => ({ ...current, padding: event.target.value }))
                }
                placeholder="5"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="employee-number-next">Next</Label>
              <Input
                id="employee-number-next"
                inputMode="numeric"
                value={numberingForm.next_number}
                onChange={(event) =>
                  setNumberingForm((current) => ({ ...current, next_number: event.target.value }))
                }
                placeholder="1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Prefix can be blank, or 2–20 letters and digits. Digit width is 3–12.
          </p>
          {numberingMessage ? <p className="text-sm text-emerald-600">{numberingMessage}</p> : null}
          {numberingError ? <p className="text-sm text-rose-600">{numberingError}</p> : null}
          <div className="flex justify-end">
            <Button type="button" onClick={() => void saveNumbering()} disabled={numberingSaving || loading}>
              {numberingSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save numbering
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className={mode === "numbering" ? "grid gap-4" : "grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"}>
        {numberingEditor}

        {mode === "full" ? (
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Employee Grades</CardTitle>
              <CardDescription>
                Manage the grade records used by employee assignment and movement flows.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void loadData()} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              </Button>
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Add Grade
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {gradesMessage ? <p className="text-sm text-emerald-600">{gradesMessage}</p> : null}
            {gradesError ? <p className="text-sm text-rose-600">{gradesError}</p> : null}

            {grades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employee grades have been configured yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Level</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Updated</th>
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((row) => {
                      const id = readId(row)
                      return (
                        <tr key={id ?? readString(row, ["code", "name"])} className="border-t border-border/60">
                          <td className="px-3 py-2 font-medium text-foreground">{readString(row, ["code"], "-")}</td>
                          <td className="px-3 py-2">{readString(row, ["name"], "-")}</td>
                          <td className="px-3 py-2">{readNumber(row, ["level"]) ?? "-"}</td>
                          <td className="px-3 py-2">{formatLabel(readString(row, ["status"], "active"))}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDateTime(row.updated_at ?? row.updatedAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button type="button" size="icon" variant="ghost" onClick={() => void openEdit(row)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" onClick={() => setDeleteTarget(row)}>
                                <Trash2 className="size-4 text-rose-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>

      {mode === "full" ? (
      <>
      <AlertDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) {
            setEditingGradeId(null)
            setGradeForm(EMPTY_GRADE_FORM)
            setGradesError(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{editingGradeId === null ? "Add Employee Grade" : "Edit Employee Grade"}</AlertDialogTitle>
            <AlertDialogDescription>
              Maintain the grade catalog used by employee assignment and movement records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="employee-grade-code">Code</Label>
              <Input
                id="employee-grade-code"
                value={gradeForm.code}
                onChange={(event) => setGradeForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="G1"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="employee-grade-name">Name</Label>
              <Input
                id="employee-grade-name"
                value={gradeForm.name}
                onChange={(event) => setGradeForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Grade 1"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="employee-grade-level">Level</Label>
              <Input
                id="employee-grade-level"
                inputMode="numeric"
                value={gradeForm.level}
                onChange={(event) => setGradeForm((current) => ({ ...current, level: event.target.value }))}
                placeholder="1"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="employee-grade-status">Status</Label>
              <Input
                id="employee-grade-status"
                value={gradeForm.status}
                onChange={(event) => setGradeForm((current) => ({ ...current, status: event.target.value }))}
                placeholder="active"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="employee-grade-description">Description</Label>
              <Textarea
                id="employee-grade-description"
                value={gradeForm.description}
                onChange={(event) => setGradeForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24"
                placeholder="Optional grade description"
              />
            </div>
          </div>
          {gradesError ? <p className="text-sm text-rose-600">{gradesError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gradesSaving}>Cancel</AlertDialogCancel>
            <Button type="button" onClick={() => void saveGrade()} disabled={gradesSaving}>
              {gradesSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {editingGradeId === null ? "Create Grade" : "Save Grade"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee Grade</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-medium text-foreground">{deleteTarget ? readString(deleteTarget, ["name", "code"], "this grade") : "this grade"}</span>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {gradesError ? <p className="text-sm text-rose-600">{gradesError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gradesSaving}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void removeGrade()} disabled={gradesSaving}>
              {gradesSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              Delete Grade
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      ) : null}
    </>
  )
}
