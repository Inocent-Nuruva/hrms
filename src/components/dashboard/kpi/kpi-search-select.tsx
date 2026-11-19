"use client"

import * as React from "react"
import { Dropdown, Option } from "@fluentui/react-components"
import { KpiFluentInput, KpiFluentSelect } from "./kpi-fluent-fields"

export type KpiChoice = { id: number; label: string }

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  load: (search: string) => Promise<KpiChoice[]>
  required?: boolean
  disabled?: boolean
  emptyLabel?: string
  fluentDropdown?: boolean
}

export function KpiSearchSelect({ label, value, onChange, load, required, disabled, emptyLabel = "Select", fluentDropdown = false }: Props) {
  const [search, setSearch] = React.useState("")
  const [options, setOptions] = React.useState<KpiChoice[]>([])
  const [selected, setSelected] = React.useState<KpiChoice | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (disabled) return
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      void load(search.trim()).then((rows) => {
        if (active) { setOptions(rows); setError("") }
      }).catch(() => {
        if (active) { setOptions([]); setError(`Could not load ${label.toLowerCase()} choices.`) }
      }).finally(() => { if (active) setLoading(false) })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [disabled, label, load, search])

  const shown = selected && value === String(selected.id) && !options.some((row) => row.id === selected.id)
    ? [selected, ...options]
    : options

  return <div className="space-y-1 text-sm">
    <span className="block font-medium">{label}</span>
    <KpiFluentInput
      aria-label={`Search ${label}`}
      placeholder={`Search ${label.toLowerCase()}`}
      value={search}
      disabled={disabled}
      onChange={(event) => setSearch(event.target.value)}
    />
    {fluentDropdown ? <Dropdown
      aria-label={label}
      className="w-full"
      button={{ className: "!w-full" }}
      value={shown.find((row) => String(row.id) === value)?.label ?? (loading ? "Loading…" : emptyLabel)}
      selectedOptions={[value]}
      disabled={disabled}
      onOptionSelect={(_, data) => {
        const next = data.optionValue ?? ""
        setSelected(options.find((row) => String(row.id) === next) ?? null)
        onChange(next)
      }}
    >
      <Option value="" text={loading ? "Loading…" : emptyLabel}>{loading ? "Loading…" : emptyLabel}</Option>
      {shown.map((row) => <Option key={row.id} value={String(row.id)} text={row.label}>{row.label}</Option>)}
    </Dropdown> : <KpiFluentSelect
      aria-label={label}
      className="w-full"
      value={value}
      required={required}
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value
        setSelected(options.find((row) => String(row.id) === next) ?? null)
        onChange(next)
      }}
    >
      <option value="">{loading ? "Loading…" : emptyLabel}</option>
      {shown.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
    </KpiFluentSelect>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>
}
