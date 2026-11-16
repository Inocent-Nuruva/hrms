"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { ContractCreate } from "@/components/dashboard/contracts/contract-create"
import { readAccessToken } from "@/lib/contracts-api"

function NewContract() {
  const searchParams = useSearchParams()
  const [token, setToken] = React.useState("")
  React.useEffect(() => setToken(readAccessToken()), [])
  if (!token) return null
  return (
    <ContractCreate
      token={token}
      presetEmployeeId={Number(searchParams?.get("employee_id")) || null}
      fromContractId={Number(searchParams?.get("from")) || null}
    />
  )
}

/** Create a live draft and open its detail page. */
export default function NewContractPage() {
  return (
    <React.Suspense fallback={null}>
      <NewContract />
    </React.Suspense>
  )
}
