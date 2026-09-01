import { afterEach, describe, expect, it, vi } from "vitest"

import {
  companyModuleForDashboardRoute,
  companyModulesSummary,
  DEFAULT_COMPANY_MODULES,
  isDashboardRouteEnabledForCompanyModules,
  toCompanyModulesPayload,
  parseCompanyModules,
  parseCompanyModulesFromCompany,
  PLATFORM_COMPANY_MODULES,
  publishCompanyModules,
  readCompanyId,
  readPublishedCompanyModules,
  rememberCompanyModules,
  resolveCompanyDashboardModules,
  withCompanyModules,
} from "./company-modules"
import { canSeeDashboardPage } from "./forbidden-routes"

describe("company modules", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubSession() {
    const store = new Map<string, string>()
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => store.clear(),
      },
      dispatchEvent: () => true,
    })
  }

  it("defaults roles and permissions on when metadata is missing", () => {
    expect(parseCompanyModules(null)).toEqual(DEFAULT_COMPANY_MODULES)
    expect(parseCompanyModulesFromCompany({ company_name: "Alliance Uganda" })).toEqual(
      DEFAULT_COMPANY_MODULES,
    )
  })

  it("reads independent roles and permissions flags", () => {
    expect(
      parseCompanyModulesFromCompany({
        metadata: {
          modules: {
            roles: true,
            permissions: false,
          },
        },
      }),
    ).toEqual({
      roles: true,
      permissions: false,
    })
  })

  it("falls back to the legacy combined flag when split flags are missing", () => {
    expect(
      parseCompanyModules({
        modules: { access_governance: false },
      }),
    ).toEqual({
      roles: false,
      permissions: false,
    })
  })

  it("serializes split flags as first-class module data", () => {
    expect(toCompanyModulesPayload({ roles: true, permissions: false })).toEqual({
      roles: true,
      permissions: false,
    })
    expect(
      toCompanyModulesPayload({
        modules: { roles: true, permissions: false },
      } as unknown as { roles: boolean; permissions: boolean }),
    ).toEqual({
      roles: true,
      permissions: false,
    })
  })

  it("classifies roles and permissions routes separately", () => {
    expect(companyModuleForDashboardRoute("/dashboard/roles")).toBe("roles")
    expect(companyModuleForDashboardRoute("/dashboard/permissions")).toBe("permissions")
    expect(companyModuleForDashboardRoute("/dashboard/access-control/roles")).toBe("roles")
    expect(companyModuleForDashboardRoute("/dashboard/access-control/permissions")).toBe(
      "permissions",
    )
    expect(companyModuleForDashboardRoute("/dashboard/access-control/devices")).toBe(null)
  })

  it("can enable roles while denying permissions", () => {
    const modules = { roles: true, permissions: false }
    expect(isDashboardRouteEnabledForCompanyModules("/dashboard/roles", modules)).toBe(true)
    expect(isDashboardRouteEnabledForCompanyModules("/dashboard/permissions", modules)).toBe(
      false,
    )
    expect(
      isDashboardRouteEnabledForCompanyModules("/dashboard/access-control/devices", modules),
    ).toBe(true)
  })

  it("keeps platform roles and permissions available", () => {
    stubSession()
    publishCompanyModules(PLATFORM_COMPANY_MODULES)
    expect(readPublishedCompanyModules()).toEqual(PLATFORM_COMPANY_MODULES)
    expect(canSeeDashboardPage("/dashboard/roles", ["roles:read"], "admin")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/permissions", ["permissions:read"], "admin")).toBe(
      true,
    )
  })

  it("hides only the denied catalog page for a company", () => {
    stubSession()
    publishCompanyModules({ roles: true, permissions: false })
    expect(canSeeDashboardPage("/dashboard/roles", ["roles:read"], "admin")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/permissions", ["permissions:read"], "admin")).toBe(
      false,
    )
    expect(readPublishedCompanyModules().permissions).toBe(false)
    expect(
      canSeeDashboardPage("/dashboard/access-control/doors", ["access_doors:read"], "admin"),
    ).toBe(true)
  })

  it("summarizes independent flags for the companies table", () => {
    expect(companyModulesSummary({ roles: true, permissions: true })).toBe("Roles · Permissions")
    expect(companyModulesSummary({ roles: true, permissions: false })).toBe("Roles")
    expect(companyModulesSummary({ roles: false, permissions: true })).toBe("Permissions")
    expect(companyModulesSummary({ roles: false, permissions: false })).toBe("None")
  })

  it("reads dedicated GET /modules payloads without company metadata", () => {
    expect(parseCompanyModules({ roles: false, permissions: false })).toEqual({
      roles: false,
      permissions: false,
    })
    expect(
      parseCompanyModulesFromCompany(
        withCompanyModules(
          { id: 4, company_name: "Alliance Uganda" },
          { roles: false, permissions: false },
        ),
      ),
    ).toEqual({
      roles: false,
      permissions: false,
    })
  })

  it("prefers company_id over user id when reading a company id", () => {
    expect(readCompanyId({ id: 4, company_name: "Alliance Uganda" })).toBe(4)
    expect(readCompanyId({ id: 71, company_id: 4 })).toBe(4)
    expect(readCompanyId({ id: 71, company: { id: 4 } })).toBe(4)
  })

  it("loads dashboard gating from GET /companies/:id/modules", async () => {
    stubSession()
    const modules = await resolveCompanyDashboardModules({
      company: { id: 4, company_name: "Alliance Uganda" },
      loadModules: async () => ({ roles: false, permissions: false }),
    })
    expect(modules).toEqual({ roles: false, permissions: false })
    publishCompanyModules(modules)
    expect(canSeeDashboardPage("/dashboard/roles", ["roles:read"], "admin")).toBe(false)
    expect(canSeeDashboardPage("/dashboard/permissions", ["permissions:read"], "admin")).toBe(
      false,
    )
    expect(
      canSeeDashboardPage("/dashboard/access-control/doors", ["access_doors:read"], "admin"),
    ).toBe(true)
  })

  it("falls back to remembered flags when GET /modules fails", async () => {
    stubSession()
    rememberCompanyModules(4, { roles: false, permissions: true })
    const modules = await resolveCompanyDashboardModules({
      company: { id: 4, company_name: "Alliance Uganda" },
      loadModules: async () => {
        throw new Error("Platform access is required")
      },
    })
    expect(modules).toEqual({ roles: false, permissions: true })
  })
})
