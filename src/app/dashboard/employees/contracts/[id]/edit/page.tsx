"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"


function EditContract() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params?.id)
  React.useEffect(() => { if (Number.isInteger(id) && id > 0) router.replace(`/dashboard/employees/contracts/${id}`) }, [id, router])
  return null
}

/** Existing editor links open the unified contract detail page. */
export default function EditContractPage() {
  return (
    <React.Suspense fallback={null}>
      <EditContract />
    </React.Suspense>
  )
}
