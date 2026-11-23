"use client"

import * as React from "react"
import { BuildingBank20Regular } from "@fluentui/react-icons"
import { Button, Card, Input } from "@fluentui/react-components"

import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useAuth } from "@/hooks/useAuth"
import {
  createCompanyBank,
  deleteCompanyBank,
  listCompanyBanks,
  resolveBackendMediaUrl,
  updateCompanyBank,
  uploadCompanyBankLogo,
  type AdminRecord,
} from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"

function bankLogo(bank: AdminRecord | null) {
  return typeof bank?.logo_url === "string" ? bank.logo_url : ""
}

export function BankDirectoryManagementView() {
  const { user } = useAuth()
  return <CompanyBankDirectory key={user?.companyId ?? "signed-out"} />
}

function CompanyBankDirectory() {
  const actor = useDashboardActor()
  const allowed =
    actor.ready &&
    actor.scope === "company" &&
    canPerformPermission(actor.permissionLabels, "employees:update")
  const [banks, setBanks] = React.useState<AdminRecord[]>([])
  const [editing, setEditing] = React.useState<AdminRecord | null>(null)
  const [name, setName] = React.useState("")
  const [logoUrl, setLogoUrl] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = React.useState(false)
  const [active, setActive] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [loadAttempt, setLoadAttempt] = React.useState(0)
  const [loadError, setLoadError] = React.useState("")
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const nameInput = React.useRef<HTMLInputElement>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let current = true
    const token = readStoredSessionTokens().accessToken
    if (!allowed || !token) return
    setLoading(true)
    setLoadError("")
    listCompanyBanks(token, true)
      .then((rows) => {
        if (current) setBanks(rows)
      })
      .catch((e: Error) => {
        if (current) setLoadError(e.message)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [allowed, loadAttempt])

  function openForm(bank: AdminRecord | null) {
    setEditing(bank)
    setName(typeof bank?.name === "string" ? bank.name : "")
    const url = bankLogo(bank)
    setLogoUrl(url.startsWith("/uploads/") ? "" : url)
    setActive(bank?.is_active !== false)
    setRemoveLogo(false)
    setFile(null)
    if (fileInput.current) fileInput.current.value = ""
    setError("")
    setMessage("")
    if (bank) nameInput.current?.focus()
  }

  function showBank(bank: AdminRecord) {
    setBanks((rows) =>
      [...rows.filter((row) => row.id !== bank.id), bank].sort((left, right) =>
        String(left.name).localeCompare(String(right.name))
      )
    )
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const token = readStoredSessionTokens().accessToken
    if (!allowed || !token || busy || !name.trim()) return
    setBusy(true)
    setError("")
    setMessage("")
    let saved: AdminRecord | undefined
    try {
      const details: AdminRecord = { name: name.trim(), is_active: active }
      const previous = bankLogo(editing)
      if (removeLogo) details.logo_url = null
      else if (
        !file &&
        (logoUrl.trim() || (previous && !previous.startsWith("/uploads/")))
      )
        details.logo_url = logoUrl.trim() || null
      saved = editing
        ? await updateCompanyBank(token, Number(editing.id), details)
        : await createCompanyBank(token, details)
      showBank(saved)
      if (file)
        showBank(await uploadCompanyBankLogo(token, Number(saved.id), file))
      openForm(null)
      setMessage(editing ? "Bank updated." : "Bank added.")
    } catch (e) {
      const detail = e instanceof Error ? e.message : "The request failed."
      if (saved) {
        setEditing(saved)
        setError(`Bank details saved. The logo upload failed. ${detail}`)
      } else setError(detail)
    } finally {
      setBusy(false)
    }
  }

  async function remove(bank: AdminRecord) {
    if (
      !allowed ||
      busy ||
      !(await fluentConfirm(
        `Remove ${bank.name} from the directory? Existing employee and payroll records keep their saved bank details.`,
        { title: "Delete bank?", confirmLabel: "Delete bank" }
      ))
    )
      return
    const token = readStoredSessionTokens().accessToken
    if (!token) return
    setBusy(true)
    setMessage("")
    setError("")
    try {
      await deleteCompanyBank(token, Number(bank.id))
      setBanks((rows) => rows.filter((row) => row.id !== bank.id))
      if (editing?.id === bank.id) openForm(null)
      setMessage("Bank deleted.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the bank.")
    } finally {
      setBusy(false)
    }
  }

  if (!actor.ready) return null
  if (!allowed)
    return (
      <p role="alert">You do not have access to manage this bank directory.</p>
    )
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Bank directory</h1>
      <Card>
        <form onSubmit={save}>
          <fieldset
            disabled={busy || loading}
            className="grid gap-4 p-2 md:grid-cols-2"
          >
            <h2 className="font-semibold md:col-span-2">
              {editing ? "Edit bank" : "Add bank"}
            </h2>
            <label className="grid gap-1 text-sm">
              Bank name
              <Input
                ref={nameInput}
                required
                maxLength={160}
                value={name}
                onChange={(_, data) => setName(data.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Logo URL
              <Input
                type="url"
                maxLength={500}
                disabled={removeLogo || Boolean(file)}
                value={logoUrl}
                onChange={(_, data) => setLogoUrl(data.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Or upload a logo
              <input
                type="file"
                ref={fileInput}
                disabled={removeLogo}
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />{" "}
                Active
              </label>
              {bankLogo(editing) && (
                <label>
                  <input
                    type="checkbox"
                    checked={removeLogo}
                    disabled={Boolean(file)}
                    onChange={(e) => setRemoveLogo(e.target.checked)}
                  />{" "}
                  Remove existing logo
                </label>
              )}
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button
                appearance="primary"
                type="submit"
                disabled={busy || loading || !name.trim()}
              >
                {editing ? "Save changes" : "Add bank"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => openForm(null)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {loadError && (
        <div role="alert">
          {loadError}{" "}
          <Button onClick={() => setLoadAttempt((n) => n + 1)}>
            Retry loading banks
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading banks…</p>
      ) : (
        !loadError && !banks.length && <p>No banks in this directory.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {banks.map((bank) => {
          const logo = resolveBackendMediaUrl(bankLogo(bank))
          return (
            <Card key={String(bank.id)} className="!gap-3 !p-4">
              <div className="flex items-center gap-3">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt=""
                    className="size-10 object-contain"
                  />
                ) : (
                  <BuildingBank20Regular className="size-10 text-primary" />
                )}
                <strong className="break-words">{String(bank.name)}</strong>
                {bank.is_active === false && <span>Inactive</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  aria-label={`Edit ${bank.name}`}
                  onClick={() => openForm(bank)}
                >
                  Edit
                </Button>
                <Button
                  disabled={busy}
                  aria-label={`Delete ${bank.name}`}
                  onClick={() => void remove(bank)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
