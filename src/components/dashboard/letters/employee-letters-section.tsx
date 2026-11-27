"use client"

import * as React from "react"

import {
  ProfileAddButton,
  ProfileRecordEmpty,
  ProfileSectionHeader,
  useProfileRecordView,
} from "@/components/dashboard/employee-profile/profile-record-views"
import { LetterDetailPanel } from "@/components/dashboard/letters/letter-detail-panel"
import { LetterWizard } from "@/components/dashboard/letters/letter-wizard"
import { LettersCollection } from "@/components/dashboard/letters/letters-list"
import { errorText, useLetterPermissions, useLettersToken } from "@/components/dashboard/letters/letter-shared"
import { listLetters, type Letter, type LetterRecipient } from "@/lib/letters-api"

/** Employee profile → Letters: this employee's letters, with New letter preset to them. */
export function EmployeeLettersSection({
  employeeId,
  employeeName,
  employeeNo,
}: {
  employeeId: number | null
  employeeName: string
  employeeNo?: string | null
}) {
  const token = useLettersToken()
  const permissions = useLetterPermissions()
  const [view, setView] = useProfileRecordView()
  const [rows, setRows] = React.useState<Letter[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [detailId, setDetailId] = React.useState<number | null>(null)
  const [wizard, setWizard] = React.useState<{ open: boolean; letter: Letter | null }>({ open: false, letter: null })

  const load = React.useCallback(async () => {
    if (!token || employeeId === null) return
    try {
      const result = await listLetters(token, { employee_id: employeeId, limit: 100 })
      setRows(result.data ?? [])
      setError(null)
    } catch (cause) {
      setError(errorText(cause, "Could not load letters"))
      setRows([])
    }
  }, [token, employeeId])

  React.useEffect(() => {
    void load()
  }, [load])

  const preset = React.useMemo<LetterRecipient | null>(
    () =>
      employeeId === null
        ? null
        : { kind: "employee", id: employeeId, name: employeeName, employee_no: employeeNo ?? null, department: null, position: null, email: null, status: null },
    [employeeId, employeeName, employeeNo],
  )
  const canCreate = permissions.create && employeeId !== null

  return (
    <section aria-label="Letters">
      <ProfileSectionHeader
        title="Letters"
        count={rows?.length}
        view={view}
        onViewChange={setView}
        actions={canCreate ? <ProfileAddButton label="New letter" onClick={() => setWizard({ open: true, letter: null })} /> : null}
      />
      {error ? <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <ProfileRecordEmpty
          title="Letters"
          message="Letters issued to this employee will be listed here."
          actionLabel={canCreate ? "New letter" : undefined}
          onAction={canCreate ? () => setWizard({ open: true, letter: null }) : undefined}
        />
      ) : (
        <LettersCollection token={token} letters={rows} view={view} onView={(letter) => setDetailId(letter.id)} showRecipient={false} />
      )}
      <LetterDetailPanel
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        token={token}
        letterId={detailId}
        onChanged={() => void load()}
        onOpenLetter={(id) => setDetailId(id)}
        onEdit={(letter) => {
          setDetailId(null)
          setWizard({ open: true, letter })
        }}
      />
      <LetterWizard
        open={wizard.open}
        onOpenChange={(open) => setWizard((value) => ({ ...value, open }))}
        token={token}
        letter={wizard.letter}
        presetRecipient={preset}
        onSaved={(letter) => {
          void load()
          setDetailId(letter.id)
        }}
      />
    </section>
  )
}
