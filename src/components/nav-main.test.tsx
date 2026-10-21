// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NavMain } from "./nav-main"

const navigation = vi.hoisted(() => ({ push: vi.fn(), setOpenMobile: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/employees/onboarding",
  useRouter: () => ({ push: navigation.push }),
}))
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ isMobile: true, setOpenMobile: navigation.setOpenMobile }),
}))

const items = [
  { title: "Branches", url: "/dashboard/branches" },
  { title: "Employees", items: [{ title: "Joining & onboarding", url: "/dashboard/employees/onboarding" }] },
  { title: "Reports", url: "/dashboard/reports", disabled: true },
]
let container: HTMLDivElement
let root: Root | undefined

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })))
  container = document.createElement("div")
  document.body.appendChild(container)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function pinControl(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  expect(button).not.toBeNull()
  return button!
}

describe("sidebar navigation pin controls", () => {
  it("keeps pin controls separate from navigation for top-level, nested and favourite items", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(<NavMain items={items} attentionUrls={["/dashboard/branches"]} />)
    })
    expect(container.querySelector("button button, button a, a button")).toBeNull()
    expect(container.querySelector('[aria-label="Branches needs attention"]')).not.toBeNull()
    for (const title of ["Branches", "Joining & onboarding"]) {
      const pin = pinControl(`Pin ${title}`)
      expect(pin.parentElement?.closest("button")).toBeNull()
      await act(async () => pin.click())
      expect(pinControl(`Unpin ${title}`).getAttribute("aria-pressed")).toBe("true")
      expect(container.querySelector("button button")).toBeNull()
    }
    expect(navigation.push).not.toHaveBeenCalled()
    expect(navigation.setOpenMobile).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem("hrms.sidebar.pinned-links.v1")!)).toEqual([
      "/dashboard/branches", "/dashboard/employees/onboarding",
    ])
    await act(async () => pinControl("Unpin Branches").click())
    expect(pinControl("Pin Branches").getAttribute("aria-pressed")).toBe("false")
    const destination = container.querySelector<HTMLButtonElement>('button[value="/dashboard/branches"]')!
    await act(async () => destination.click())
    expect(navigation.push).toHaveBeenCalledWith("/dashboard/branches")
    expect(navigation.setOpenMobile).toHaveBeenCalledWith(false)
  })

  it("keeps disabled destinations disabled after pinning", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(<NavMain items={items} />)
    })
    await act(async () => pinControl("Pin Reports").click())
    const destination = container.querySelector<HTMLButtonElement>('button[value="/dashboard/reports"]')!
    expect(destination.disabled).toBe(true)
    await act(async () => destination.click())
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("hydrates server markup without invalid nesting or recoverable errors", async () => {
    const recoverable = vi.fn()
    const consoleError = vi.spyOn(console, "error")
    container.innerHTML = renderToString(<NavMain items={items} />)
    await act(async () => {
      root = hydrateRoot(container, <NavMain items={items} />, { onRecoverableError: recoverable })
    })
    expect(recoverable).not.toHaveBeenCalled()
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/cannot contain|cannot be a descendant|hydration/i)
    expect(container.querySelector("button button")).toBeNull()
  })
})
