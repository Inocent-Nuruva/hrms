"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { ContractWizard } from "@/components/dashboard/contracts/contract-wizard"
import { readAccessToken } from "@/lib/contracts-api"

function NewContract() {
  const searchParams = useSearchParams()
  const [token, setToken] = React.useState("")
  React.useEffect(() => setToken(readAccessToken()), [])
  if (!token) return null
  return (
    <ContractWizard
      token={token}
      contractId={null}
      presetEmployeeId={Number(searchParams?.get("employee_id")) || null}
      fromContractId={Number(searchParams?.get("from")) || null}
    />
  )
}

/** New contract: step 1 creates the draft, then the wizard continues on /[id]/edit. */
export default function NewContractPage() {
  return (
    <React.Suspense fallback={null}>
      <NewContract />
    </React.Suspense>
  )
}
