import { expect, test, type Page } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

async function workspace(
  page: Page,
  scope: "platform" | "company",
  grants: string[]
) {
  const user = await installDashboardFixture(page, scope, grants)
  let bank: {
    id: number
    name: string
    is_active: boolean
    logo_url?: string
  } | null = null
  let company: {
    id: number
    name: string
    status: string
    slug: string
    metadata: { timezone: string }
  } | null = {
    id: 17,
    name: "Example Company",
    status: "active",
    slug: "example",
    metadata: { timezone: "Africa/Dar_es_Salaam" },
  }
  const directory = "/api/employees/bank-directory"
  const companyPath = "/api/companies/17"
  const modules = { roles: true, permissions: true }
  const writes: string[] = []
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    let json: unknown = { data: [] }
    if (method !== "GET") writes.push(`${method} ${path}`)
    if (path === directory + "/management") json = bank ? [bank] : []
    else if (path === directory && method === "POST")
      json = bank = { id: 21, ...route.request().postDataJSON() }
    else if (path === directory + "/21" && method === "PATCH" && bank)
      json = Object.assign(bank, route.request().postDataJSON())
    else if (path === directory + "/21" && method === "DELETE") bank = null
    else if (path === "/api/companies") json = company ? [company] : []
    else if (path === companyPath + "/modules") json = { data: modules }
    else if (path === companyPath && method === "DELETE") company = null
    else if (path === companyPath && company) {
      if (method === "PATCH")
        company.name = String(route.request().postDataJSON().name)
      json = { data: company }
    } else if (
      ["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)
    )
      json = { ...user, data: user }
    await route.fulfill({ json })
  })
  return writes
}

for (const [size, width, height] of [
  ["desktop", 1366, 900],
  ["mobile", 390, 844],
] as const) {
  test(`manages banks and selects the Male avatar option on ${size}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    const writes = await workspace(page, "company", ["employees:update"])
    await page.goto("/dashboard/settings/banks")
    await page.getByLabel("Bank name", { exact: true }).fill("Example Bank")
    await page.getByRole("button", { name: "Add bank", exact: true }).click()
    await page.getByRole("button", { name: "Edit Example Bank" }).click()
    await page.getByLabel("Bank name", { exact: true }).fill("Renamed Bank")
    await page.getByLabel("Active", { exact: true }).uncheck()
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("Inactive", { exact: true })).toBeVisible()
    const remove = page.getByRole("button", { name: "Delete Renamed Bank" })
    if (size === "desktop") {
      await page
        .locator("section")
        .filter({
          has: page.getByRole("heading", {
            name: "Bank directory",
            exact: true,
          }),
        })
        .last()
        .screenshot({
          path: test.info().outputPath("company-bank-directory.png"),
        })
    }
    await remove.click()
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    expect(writes).not.toContain("DELETE /api/employees/bank-directory/21")
    await remove.click()
    await page.getByRole("button", { name: "Delete bank", exact: true }).click()
    await expect(remove).toHaveCount(0)
    await expect(page.getByText("Bank deleted.", { exact: true })).toBeVisible()
    await page.goto("/dashboard/settings/default-avatars")
    await page.getByRole("button", { name: "Add avatar", exact: true }).click()
    const gender = page.getByRole("combobox", { name: "Gender category" })
    await gender.click()
    await page.getByRole("option", { name: "Male", exact: true }).click()
    await expect(gender).toHaveText("Male")
  })

  test(`saves company edits and confirms company deletion on ${size}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    const writes = await workspace(page, "platform", [
      "companies:read",
      "companies:update",
      "companies:delete",
    ])
    await page.goto("/dashboard/companies")
    await page
      .getByRole("button", { name: "Edit company", exact: true })
      .click()
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Updated Company")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(
      page.getByText("Updated Company", { exact: true }).first()
    ).toBeVisible()
    const remove = page.getByRole("button", {
      name: "Delete company",
      exact: true,
    })
    await remove.click()
    const confirmation = page.getByRole("alertdialog")
    await expect(confirmation).toContainText("Updated Company")
    if (size === "desktop") {
      await confirmation.screenshot({
        path: test.info().outputPath("company-deletion-confirmation.png"),
      })
    }
    await confirmation.getByRole("button", { name: "Cancel" }).click()
    expect(writes).not.toContain("DELETE /api/companies/17")
    await remove.click()
    await confirmation
      .getByRole("button", { name: "Delete company", exact: true })
      .click()
    await expect(remove).toHaveCount(0)
    expect(writes).toContain("DELETE /api/companies/17")
  })
}

test("a platform administrator with update permission alone can edit but cannot delete", async ({
  page,
}) => {
  await workspace(page, "platform", ["companies:read", "companies:update"])
  await page.goto("/dashboard/companies")
  await expect(
    page.getByRole("button", { name: "Edit company", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Delete company", exact: true })
  ).toHaveCount(0)
})
