// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppSidebar } from "./app-sidebar"

type Item = { title: string; url?: string; items?: Item[] }
const capture = vi.hoisted(() => {
  return { items: [] as Item[] }
})
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/kpi/scorecards" }))
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

function kpiLinks(items: Item[]): string[] {
  return items.flatMap((item) => item.items ? kpiLinks(item.items) : item.url?.startsWith("/dashboard/kpi") ? [item.url] : [])
}

async function renderFor(role: string, permission: string, accessMode: "admin" | "employee" = "admin") {
  await act(async () => {
    root = createRoot(container)
    root.render(<AppSidebar accessMode={accessMode} scope="company" roleNames={[role]} permissionLabels={[permission]} identityReady />)
  })
  return kpiLinks(capture.items)
}

describe("existing sidebar KPI integration", () => {
  it("shows KPI navigation to company and branch managers without phase flags", async () => {
    const admin = await renderFor("COMPANY_ADMIN", "data_scope:company")
    expect(admin).toContain("/dashboard/kpi")
    expect(capture.items.find((item) => item.title === "KPI & Performance")?.items?.map((item) => item.title)).toEqual(["My KPI & Performance", "KPI Management"])
    await act(async () => root?.unmount())
    root = undefined
    const branchManager = await renderFor("BRANCH_MANAGER", "data_scope:branch")
    expect(branchManager).toContain("/dashboard/kpi")
  })

  it("shows the full KPI group to company HR and scoped review links to managers", async () => {
    const admin = await renderFor("HR_MANAGER", "data_scope:company")
    expect(admin).toEqual(["/dashboard/kpi"])
    await act(async () => root?.unmount())
    root = undefined
    const manager = await renderFor("DEPARTMENT_MANAGER", "data_scope:department")
    expect(manager).toContain("/dashboard/kpi")
  })

  it("shows assignment management to a custom role with a scoped KPI grant", async () => {
    const links = await renderFor("TEST", "kpi_assignments:read")
    expect(links).toContain("/dashboard/kpi")
    expect(capture.items.find((item) => item.title === "KPI & Performance")?.items?.map((item) => item.title)).toEqual(["KPI Management"])
  })

  it("keeps read-only management and employee navigation restrictive", async () => {
    const management = await renderFor("MANAGEMENT", "data_scope:company")
    expect(management).toEqual(["/dashboard/kpi"])
    expect(capture.items.find((item) => item.title === "KPI & Performance")?.items?.map((item) => item.title)).toEqual(["KPI Management"])
    await act(async () => root?.unmount())
    root = undefined
    const employee = await renderFor("EMPLOYEE", "data_scope:own", "employee")
    expect(employee).toEqual([])
    expect(capture.items.find((item) => item.title === "KPI & Performance")?.items?.map((item) => item.title)).toEqual(["My KPI & Performance"])
  })
})
