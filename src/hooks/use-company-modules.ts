"use client"

import * as React from "react"

import {
  COMPANY_MODULES_EVENT,
  readPublishedCompanyModules,
  type CompanyModules,
} from "@/lib/company-modules"

export function usePublishedCompanyModules(): CompanyModules {
  const [modules, setModules] = React.useState(readPublishedCompanyModules)

  React.useEffect(() => {
    const sync = () => setModules(readPublishedCompanyModules())
    sync()
    window.addEventListener(COMPANY_MODULES_EVENT, sync)
    return () => window.removeEventListener(COMPANY_MODULES_EVENT, sync)
  }, [])

  return modules
}
