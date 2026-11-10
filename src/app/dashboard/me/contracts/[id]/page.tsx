"use client"

import { useParams } from "next/navigation"

import { MyContractViewer } from "@/components/dashboard/contracts/my-contracts"

/** View and sign one contract (employee, or company signatory). */
export default function MyContractPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params?.id)
  if (!Number.isInteger(id)) return null
  return <MyContractViewer contractId={id} />
}
