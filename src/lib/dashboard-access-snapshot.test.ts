import { afterEach, describe, expect, it, vi } from "vitest"

import {
  publishDashboardActorSnapshot,
  readDashboardActorSnapshotFromBrowser,
} from "./dashboard-permissions"

function stubBrowser() {
  const sessionStore = new Map<string, string>()
  const localStore = new Map<string, string>()

  vi.stubGlobal("window", {
    location: { protocol: "http:" },
    localStorage: {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, value: string) => localStore.set(key, value),
      removeItem: (key: string) => localStore.delete(key),
    },
    sessionStorage: {
      getItem: (key: string) => sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) => sessionStore.set(key, value),
      removeItem: (key: string) => sessionStore.delete(key),
    },
    dispatchEvent: vi.fn(() => true),
  })
  vi.stubGlobal("document", { cookie: "" })
  vi.stubGlobal(
    "CustomEvent",
    class<T> extends Event {
      detail: T

      constructor(type: string, init: CustomEventInit<T>) {
        super(type)
        this.detail = init.detail as T
      }
    },
  )

  return { localStore, sessionStore }
}

describe("dashboard access snapshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("clears route denials and platform confirmations when grants change", () => {
    const { sessionStore } = stubBrowser()

    publishDashboardActorSnapshot({
      permissionLabels: ["employees:read"],
      roleNames: ["HR_MANAGER"],
      accessMode: "admin",
      isAdmin: true,
      ready: true,
      version: 1,
    })
    sessionStore.set("hrms.forbiddenRoutes", JSON.stringify(["/dashboard/payroll"]))
    sessionStore.set(
      "hrms.confirmedPlatformRoutes",
      JSON.stringify(["/dashboard/companies"]),
    )

    publishDashboardActorSnapshot({
      permissionLabels: ["employees:read", "payroll:read"],
      roleNames: ["HR_MANAGER"],
      accessMode: "admin",
      isAdmin: true,
      ready: true,
      version: 2,
    })

    expect(sessionStore.has("hrms.forbiddenRoutes")).toBe(false)
    expect(sessionStore.has("hrms.confirmedPlatformRoutes")).toBe(false)
  })

  it("does not refill an authoritative empty permission list from stale storage", () => {
    const { localStore } = stubBrowser()
    localStore.set(
      "ess.auth.user",
      JSON.stringify({
        dashboardType: "admin",
        permissions: ["payroll:read"],
      }),
    )

    publishDashboardActorSnapshot({
      permissionLabels: [],
      roleNames: ["HR_MANAGER"],
      accessMode: "admin",
      isAdmin: true,
      ready: true,
      version: 3,
    })

    expect(readDashboardActorSnapshotFromBrowser().permissionLabels).toEqual([])
  })
})
