import { expect, test, type Page } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

async function notifications(page: Page, platform: boolean, editable = true) {
  const grants = ["companies:read", "sms:read", "sms:settings-read", "sms:logs-read", "notifications:read", "notifications:settings-read", "notifications:mail-logs-read"]
  if (editable) grants.push("notifications:settings-update", "sms:settings-update")
  const user = await installDashboardFixture(page, platform ? "platform" : "company", grants)
  let gateway = { endpoint: "https://provider.example.invalid/send", approved_endpoints: ["https://provider.example.invalid/send"], username: "Example account", password_configured: true, password_storage_ready: true, shortcode: "HRMS", channel: "", enabled: true, source: "installation" }
  let template = { id: 5, title: "Leave notice", templateCode: "leave.notice", systemMessage: "Original message", status: "ACTIVE" }
  let rule = { id: 7, notificationType: "GENERAL", triggerEvent: "leave.notice", recipientType: "EMPLOYEE", channels: ["EMAIL"], priority: "MEDIUM", enabled: true, reminderBeforeMinutes: 10 }
  await page.route("**/api/**", async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const patch = req.method() === "PATCH" ? req.postDataJSON() : null
    let json: unknown = {data: []}
    if (["/api/users/me","/api/auth/me","/api/auth/session"].includes(path)) json = {...user, data:user}
    if (path.endsWith("/sms/platform/gateway")) {
      if (patch) gateway = {...gateway, shortcode:patch.shortcode}
      json = gateway
    } else if (path.endsWith("/global")) json = {isEnabled: true, platformEnabled:false, companyEnabled:true, effectiveEnabled:false}
    else if (path.endsWith("/mail-routing")) json = {mode:"redirected", environment:"test", test_recipient_count:2}
    else if (path.endsWith("/templates")) json = [template]
    else if (path.endsWith("/templates/5")) {
      if (patch) template = {...template,title: patch.title,systemMessage:patch.system_message}
      json = template
    } else if (path.endsWith("/rules")) json = [rule]
    else if (path.endsWith("/rules/7")) {
      if (patch) rule = {...rule,reminderBeforeMinutes:patch.reminder_before_minutes}
      json = rule
    }
    await route.fulfill({json})
  })
}

for (const [size,width,height] of [["desktop",1366,900],["mobile",390,844]] as const) {
  test(`configures the SMS gateway on ${size}`, async ({page}) => {
    await page.setViewportSize({width,height})
    await notifications(page,true)
    await page.goto("/dashboard/sms/platform")
    await expect(page.getByLabel("Provider account")).toHaveValue("Example account")
    await expect(page.getByLabel("Gateway password")).toHaveValue("")
    await page.getByLabel("Sender short code").fill("PAYROLL")
    const sent = page.waitForRequest(r => r.url().endsWith("/sms/platform/gateway") && r.method() === "PATCH")
    await page.getByRole("button",{name:"Save gateway"}).click()
    expect((await sent).postDataJSON()).not.toHaveProperty("password")
    await expect(page.getByText("SMS gateway saved.")).toBeVisible()
    await expect(page.getByLabel("Sender short code")).toHaveValue("PAYROLL")
  })
  test(`shows routing and edits notification templates and rules on ${size}`, async ({page}) => {
    await page.setViewportSize({width,height})
    await notifications(page,false)
    await page.goto("/dashboard/sms/overview")
    await expect(page.getByText(/Both switches must be on/)).toBeVisible()
    await expect(page.getByLabel("Provider account")).toHaveCount(0)
    await page.goto("/dashboard/operations/notifications")
    await page.getByRole("button",{name:"Mail Logs",exact:true}).click()
    await expect(page.getByText(/redirected to 2 configured test recipients/)).toBeVisible()
    for (const kind of ["template","rule"] as const) {
      const tab = kind === "template" ? "Templates" : "Rules"
      await page.getByRole("button",{name:tab,exact:true}).click()
      await page.getByRole("button",{name:"View",exact:true}).first().click()
      await page.getByRole("button",{name:"Edit "+kind,exact:true}).click()
      const form = page.getByRole("form",{name:"Edit "+kind})
      if (kind === "template") await form.getByLabel("Title",{exact:true}).fill("Changed notice")
      else await form.getByLabel("Reminder before (minutes)",{exact:true}).fill("0")
      const sent = page.waitForRequest(r => r.method() === "PATCH" && r.url().includes("/notifications/"+kind+"s/"))
      await form.getByRole("button",{name:"Save "+kind,exact:true}).click()
      expect((await sent).postDataJSON()).toMatchObject(kind === "template" ? {title:"Changed notice"} : {reminder_before_minutes:0})
      await expect(form).toHaveCount(0)
      await page.keyboard.press("Escape")
    }
  })
}

test("hides template mutation controls for read-only staff", async ({page}) => {
  await notifications(page,false,false)
  await page.goto("/dashboard/operations/notifications")
  await page.getByRole("button",{name:"Templates",exact:true}).click()
  await page.getByRole("button",{name:"View",exact:true}).first().click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("button",{name:"Edit template"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Deactivate template"})).toHaveCount(0)
})
