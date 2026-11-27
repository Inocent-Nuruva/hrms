import { expect, test, type Page } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

// First visits compile on the dev server; allow slow navigation.
test.use({ navigationTimeout: 180000 })

// Employee-side profile record forms use the same dialog as HR's "Add record":
// labelled fields, selects for types, and (for documents) title, document type,
// optional expiry date and notes, then the file.

async function workspace(page: Page) {
  const user = await installDashboardFixture(page, "employee", [], false)
  const posts: Array<{ path: string; body: Record<string, unknown> }> = []
  const documents: Record<string, unknown>[] = []
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user }
    else if (path === "/api/employees/me/documents") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>
        posts.push({ path, body })
        documents.unshift({
          id: 91,
          title: body.title,
          type: body.type,
          notes: body.notes ?? null,
          metadata: body.metadata ?? null,
          original_file_name: "passport.pdf",
          uploaded_at: "2026-11-24T10:00:00Z",
          can_modify: true,
        })
        json = documents[0]
      } else json = { data: documents }
    } else if (path.startsWith("/api/me/profile-records/") && request.method() === "POST") {
      posts.push({ path, body: request.postDataJSON() as Record<string, unknown> })
      json = { id: 5, status: "APPLIED" }
    }
    await route.fulfill({ json })
  })
  return posts
}

test("employee uploads a document with title, type, expiry and notes", async ({ page }) => {
  const posts = await workspace(page)
  await page.goto("/dashboard/me/profile", { waitUntil: "domcontentloaded" })
  await expect(page.getByText("Loading your profile…")).toHaveCount(0, { timeout: 120000 })
  await page.getByRole("tab", { name: "Records", exact: true }).click()
  await page.getByRole("tablist", { name: "Personal profile sections" }).getByRole("tab", { name: /Documents/ }).click()
  await page.getByRole("button", { name: "Add", exact: true }).click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog.getByRole("heading", { name: "Add Documents Record" })).toBeVisible()
  for (const label of ["Title", "Document type", "Expiry date (optional)", "Notes (optional)", "Attachment"])
    await expect(dialog.locator("label").filter({ hasText: label })).toBeVisible()

  await dialog.getByRole("button", { name: "Upload", exact: true }).click()
  await expect(dialog.getByText("Title is required.")).toBeVisible()

  await dialog.getByRole("textbox", { name: /Title/ }).fill("Passport copy")
  await dialog.getByRole("combobox", { name: "Document type" }).click()
  await page.getByRole("option", { name: "id", exact: true }).click()
  await dialog.getByRole("textbox", { name: "Notes (optional)" }).fill("Renewed this year")
  await dialog.getByRole("button", { name: "Upload", exact: true }).click()
  await expect(dialog.getByText("Choose a file to upload.")).toBeVisible()

  await dialog.locator('input[type="file"]').setInputFiles({
    name: "passport.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  })
  await dialog.getByRole("button", { name: "Upload", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)

  await expect.poll(() => posts.length).toBe(1)
  expect(posts[0].body).toMatchObject({ title: "Passport copy", type: "id" })
  expect(String(posts[0].body.notes)).toContain("Renewed this year")
  expect(posts[0].body).not.toHaveProperty("metadata")
  expect((posts[0].body.file as { file_name?: string }).file_name ?? JSON.stringify(posts[0].body.file)).toContain("passport")
  await expect(page.getByText("Passport copy")).toBeVisible()
})

test("employee contact form uses the HR-style dialog with a type select", async ({ page }) => {
  const posts = await workspace(page)
  await page.goto("/dashboard/me/profile", { waitUntil: "domcontentloaded" })
  await expect(page.getByText("Loading your profile…")).toHaveCount(0, { timeout: 120000 })
  await page.getByRole("tab", { name: "Personal", exact: true }).click()
  await page.getByRole("tablist", { name: "Personal profile sections" }).getByRole("tab", { name: /Contacts/ }).click()
  await page.getByRole("button", { name: "Add", exact: true }).first().click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog.getByRole("heading", { name: "Add Contact Record" })).toBeVisible()
  await expect(dialog.getByRole("combobox", { name: "Contact type" })).toBeVisible()
  await dialog.getByRole("textbox", { name: "Email" }).fill("robin@example.com")
  await dialog.getByRole("button", { name: "Add", exact: true }).click()

  await expect.poll(() => posts.length).toBe(1)
  expect(posts[0].body.data).toMatchObject({ contact_type: "personal", email: "robin@example.com" })
})

test("Documents page upload uses the same HR-style form", async ({ page }) => {
  const user = await installDashboardFixture(page, "employee", [], false)
  const uploads: Record<string, unknown>[] = []
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user }
    else if (path === "/api/me/documents" && request.method() === "POST") {
      uploads.push(request.postDataJSON() as Record<string, unknown>)
      json = { id: 7 }
    }
    await route.fulfill({ json })
  })
  await page.goto("/dashboard/me/requests/documents", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Upload a file" }).first().click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog.getByRole("heading", { name: "Upload a document" })).toBeVisible()
  for (const label of ["Title", "Document type", "Expiry date (optional)", "Notes (optional)", "Attachment"])
    await expect(dialog.locator("label").filter({ hasText: label })).toBeVisible()

  await dialog.getByRole("textbox", { name: /Title/ }).fill("Degree certificate")
  await dialog.getByRole("combobox", { name: "Document type" }).click()
  await page.getByRole("option", { name: "Certificate", exact: true }).click()
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "degree.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  })
  await dialog.getByRole("button", { name: "Upload", exact: true }).click()
  await expect.poll(() => uploads.length).toBe(1)
  expect(uploads[0]).toMatchObject({ title: "Degree certificate", document_type_code: "CERTIFICATE" })
})
