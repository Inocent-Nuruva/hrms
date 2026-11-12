"use client"

import * as React from "react"
import { useParams } from "next/navigation"

import { ContractDetailView } from "@/components/dashboard/contracts/contract-detail"
import { readAccessToken } from "@/lib/contracts-api"

/** HR contract detail: draft editing, signing, verification, renewals. */
export default function EmployeeContractDetailPage() {
  const params = useParams<{ id: string }>()
  const [token, setToken] = React.useState("")
  React.useEffect(() => setToken(readAccessToken()), [])
  const id = Number(params?.id)
  if (!token || !Number.isInteger(id)) return null
  return (
    <React.Suspense fallback={null}>
      <ContractDetailView contractId={id} token={token} />
    </React.Suspense>
  )
}
