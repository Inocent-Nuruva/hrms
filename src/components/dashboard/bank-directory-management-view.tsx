"use client"

import * as React from "react"
import { Add20Regular, BuildingBank20Regular } from "@fluentui/react-icons"
import { Button as FluentButton, Card as FluentCard, Input as FluentInput } from "@fluentui/react-components"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { createCompanyBank, listCompanyBanks, resolveBackendMediaUrl, uploadCompanyBankLogo, type AdminRecord } from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

function readToken() {
  if (typeof window === "undefined") return ""
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens) ?? "{}") as {
      accessToken?: string
      access_token?: string
    }
    return parsed.accessToken ?? parsed.access_token ?? ""
  } catch {
    return ""
  }
}

export function BankDirectoryManagementView() {
  const [banks, setBanks] = React.useState<AdminRecord[]>([])
  const [name, setName] = React.useState("")
  const [logoUrl, setLogoUrl] = React.useState("")
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  const load = React.useCallback(async () => {
    const token = readToken()
    if (!token) return
    setBanks(await listCompanyBanks(token))
  }, [])

  React.useEffect(() => { void load() }, [load])

  async function addBank() {
    const token = readToken()
    if (!token || !name.trim()) return
    setBusy(true)
    setError("")
    try {
      const created = await createCompanyBank(token, {
        name: name.trim(),
        logo_url: logoUrl.trim() || undefined,
      }) as AdminRecord
      const bankId = created.id
      if (logoFile && (typeof bankId === "string" || typeof bankId === "number")) {
        await uploadCompanyBankLogo(token, bankId, logoFile)
      }
      setName("")
      setLogoUrl("")
      setLogoFile(null)
      await load()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Could not add the bank.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Bank directory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add banks available in employee payroll account forms.</p>
      </header>

      <FluentCard className="!grid !gap-4 !p-5 md:!grid-cols-2">
        <label className="grid gap-1 text-sm">Bank name *<FluentInput value={name} onChange={(_, data) => setName(data.value)} /></label>
        <label className="grid gap-1 text-sm">Logo URL<FluentInput type="url" value={logoUrl} onChange={(_, data) => setLogoUrl(data.value)} /></label>
        <label className="grid gap-1 text-sm md:col-span-2">
          Or upload a logo
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} />
        </label>
        {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
        <div className="md:col-span-2">
          <FluentButton appearance="primary" icon={busy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <Add20Regular />} disabled={busy || !name.trim()} onClick={() => void addBank()}>
            Add bank
          </FluentButton>
        </div>
      </FluentCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {banks.map((bank) => {
          const bankName = typeof bank.name === "string" ? bank.name : "Bank"
          const logo = typeof bank.logo_url === "string" ? resolveBackendMediaUrl(bank.logo_url) : ""
          return (
            <FluentCard key={String(bank.id ?? bankName)} className="!flex-row !items-center !gap-3 !p-4">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="size-10 rounded-md object-contain" />
              ) : <BuildingBank20Regular className="size-10 text-primary" />}
              <span className="font-medium">{bankName}</span>
            </FluentCard>
          )
        })}
      </div>
    </section>
  )
}
