"use client"

import dynamic from "next/dynamic"

const DepartmentsView = dynamic(
  () =>
    import("@/components/dashboard/departments-view").then(
      (module) => module.DepartmentsView
    ),
  {
    ssr: false,
    loading: () => (
      <div className="px-4 py-8 text-sm text-slate-500">
        Loading departments...
      </div>
    ),
  }
)

export default function DepartmentsPage() {
  return <DepartmentsView />
}
