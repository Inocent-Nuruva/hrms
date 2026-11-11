// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EmploymentContractsView } from "./employment-contracts-view"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const contracts = vi.hoisted(() => ({
  listContracts: vi.fn(),
  createContractDraft: vi.fn(),
}))
vi.mock("@/lib/contracts-api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...contracts,
}))
const actor = vi.hoisted(() => ({ permissionLabels: ["employment_contracts:manage"] as string[] }))
vi.mock("@/hooks/use-dashboard-actor", () => ({ useDashboardActor: () => ({ ready: true, ...actor }) }))
vi.mock("@/lib/admin-api", () => ({ listEmployees: vi.fn().mockResolvedValue({ rows: [] }) }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
  actor.permissionLabels = ["employment_contracts:manage"]
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  localStorage.setItem("hrms.admin.accessToken", "token")
  contracts.listContracts.mockResolvedValue({
    data: [
      {
        id: 7,
        referenceNo: "EC-2026-00007",
        version: 2,
        contractType: "FIXED_TERM",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "PENDING_EMPLOYEE_SIGNATURE",
        validity: "NOT_EFFECTIVE",
        employeeName: "Amina John",
        signatoryName: "Juma Director",
      },
    ],
    total: 1,
    page: 1,
    limit: 25,
  })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe("employee-scoped contracts", () => {
  it("loads only the current employee and hides creation for readers", async () => {
    await act(async () => root.render(<EmploymentContractsView employee={{ id: 12, full_name: "Amina John" }} canManage={false} />))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(contracts.listContracts).toHaveBeenCalledWith("token", expect.objectContaining({ employee_id: 12 }))
    expect(container.textContent).toContain("EC-2026-00007")
    expect(container.textContent).toContain("Awaiting employee signature")
    expect(container.textContent).not.toContain("New contract")
  })

  it("hides creation from users without the manage permission, even when the embed allows it", async () => {
    actor.permissionLabels = ["employment_contracts:read"]
    await act(async () => root.render(<EmploymentContractsView canManage />))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(container.textContent).not.toContain("New contract")
  })

  it("lists all contracts with filters and lets managers start a new one", async () => {
    await act(async () => root.render(<EmploymentContractsView canManage />))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(contracts.listContracts).toHaveBeenCalledWith("token", expect.not.objectContaining({ employee_id: expect.anything() }))
    expect(container.querySelector('input[aria-label="Search contracts"]')).not.toBeNull()
    expect(container.textContent).toContain("New contract")
    expect(container.querySelector('a[href="/dashboard/employees/contracts/7"]')).not.toBeNull()
  })
})
