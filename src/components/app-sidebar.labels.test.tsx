// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppSidebar, resolveDashboardSearchItems } from "./app-sidebar"
import allPermissions from "@/lib/permission-catalogue.json"
import { isSelfServiceDashboardRoute } from "@/lib/dashboard-nav"

type Item = { title: string; url?: string; items?: Item[] }
const capture = vi.hoisted(() => {
  return { items: [] as Item[] }
})
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/components/nav-main", () => ({
  NavMain: ({ items }: { items: Item[] }) => { capture.items = items; return <div data-testid="nav-main" /> },
}))
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarRail: () => <div />,
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
}))
vi.mock("@/lib/notifications-store", () => ({
  useNotifications: () => ({ attentionItems: [], markAsRead: vi.fn() }),
}))
vi.mock("@/hooks/use-notification-attention", () => ({ useNotificationAttentionRoutes: () => [] }))
vi.mock("@/hooks/use-forbidden-route-guard", () => ({
  useForbiddenPrefixes: () => 0,
  useProbePlatformCompaniesAccess: () => undefined,
}))

let container: HTMLDivElement
let root: Root | undefined
beforeEach(() => {
  capture.items = []
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  container = document.createElement("div")
  document.body.appendChild(container)
})
afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  container.remove()
  vi.unstubAllGlobals()
})

const CANONICAL_MODULE_NAMES = [
  "Bank directory",
  "KPI & Performance", "Forms & Feedback", "To do", "Access Control", "Attendance", "Branches",
  "Companies", "Departments", "Employees", "Promotion", "Leave Management", "Probation", "Field",
  "Finance", "Movements", "Positions", "Structure", "Reports & Analytics", "Notifications", "Insights",
]

async function topLevelTitles(role: string, permissions: string[], accessMode: "admin" | "employee") {
  await act(async () => {
    root = createRoot(container)
    root.render(<AppSidebar accessMode={accessMode} scope="company" roleNames={[role]} permissionLabels={permissions} identityReady />)
  })
  const titles = capture.items.map((item) => item.title)
  await act(async () => root?.unmount())
  root = undefined
  return titles
}

describe("sidebar module names are role-independent", () => {
  it("hides employee-specific links when the membership has no employee record", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(<AppSidebar accessMode="employee" scope="company" roleNames={["EMPLOYEE"]} permissionLabels={["data_scope:self"]} employeeLinked={false} identityReady />)
    })
    const urls = (items: Item[]): string[] => items.flatMap((item) => [item.url ?? "", ...urls(item.items ?? [])])
    expect(urls(capture.items).filter((url) => url !== "/dashboard/to-do" && isSelfServiceDashboardRoute(url))).toEqual([])
    const search = resolveDashboardSearchItems({ scope: "company", accessMode: "employee", permissionLabels: ["data_scope:self"], employeeLinked: false })
    expect(search.filter((item) => item.url !== "/dashboard/to-do" && isSelfServiceDashboardRoute(item.url))).toEqual([])
  })
  const roles: Array<[string, string[], "admin" | "employee"]> = [
    ["EMPLOYEE", ["data_scope:self"], "employee"],
    ["DEPARTMENT_MANAGER", ["data_scope:department", "self_service_requests:manager_review", "manager_team:read"], "employee"],
    ["DEPARTMENT_MANAGER", ["data_scope:department", "self_service_requests:manager_review", "manager_team:read"], "admin"],
    ["HR_MANAGER", ["data_scope:company", "employees:read", "attendance_summaries:read", "leave_requests:read"], "admin"],
    ["COMPANY_ADMIN", ["data_scope:company"], "admin"],
  ]

  it.each(roles)("%s (%s, %s mode) only sees canonical module names", async (role, permissions, mode) => {
    const titles = await topLevelTitles(role, permissions, mode)
    expect(titles.length).toBeGreaterThan(0)
    for (const title of titles) expect(CANONICAL_MODULE_NAMES).toContain(title)
    expect(titles).not.toContain("My attendance")
    expect(titles).not.toContain("My profile")
  })

  it("keeps the Attendance and Employees module names for employees", async () => {
    const titles = await topLevelTitles("EMPLOYEE", ["data_scope:self"], "employee")
    expect(titles).toContain("Attendance")
    expect(titles).toContain("Employees")
  })
})

describe("search labels follow the sidebar's Module / Group / Page path", () => {
  const GENERAL = ["Dashboard", "Settings", "Help"]
  const allowed = [...CANONICAL_MODULE_NAMES, ...GENERAL, "Access Governance"]
  const cases: Array<[string, "admin" | "employee", string[], ("company" | "platform")?]> = [
    ["platform admin", "admin", ["data_scope:company", ...allPermissions], "platform"],
    ["employee", "employee", ["data_scope:self"]],
    ["company admin", "admin", ["data_scope:company"]],
    ["fully permitted HR", "admin", ["data_scope:company", ...allPermissions]],
    ["fully permitted employee shell", "employee", ["data_scope:company", ...allPermissions]],
  ]
  it.each(cases)("every %s search label starts with a sidebar module name", (_label, accessMode, permissionLabels, scope = "company") => {
    const items = resolveDashboardSearchItems({ scope, permissionLabels, accessMode })
    expect(items.length).toBeGreaterThan(0)
    const offenders = items.map((item) => item.title).filter((title) => !allowed.includes(title.split(" / ")[0]))
    expect(offenders).toEqual([])
  })
})
