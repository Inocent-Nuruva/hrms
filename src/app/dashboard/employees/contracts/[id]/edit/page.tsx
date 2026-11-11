"use client"

import * as React from "react"
import { useParams, useSearchParams } from "next/navigation"

import { ContractWizard } from "@/components/dashboard/contracts/contract-wizard"
import { readAccessToken } from "@/lib/contracts-api"

function EditContract() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [token, setToken] = React.useState("")
  React.useEffect(() => setToken(readAccessToken()), [])
  const id = Number(params?.id)
  if (!token || !Number.isInteger(id)) return null
  return <ContractWizard token={token} contractId={id} initialStep={searchParams?.get("step")} />
}

/** Step-by-step editing of a draft contract with live preview. */
export default function EditContractPage() {
  return (
    <React.Suspense fallback={null}>
      <EditContract />
    </React.Suspense>
  )
}
