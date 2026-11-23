import { expect, test } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

for (const [size, width, height] of [["desktop", 1366, 900], ["mobile", 390, 844]] as const) {
  test(`assigns a department manager and previews employee numbers on ${size}`, async ({page}, info) => {
    await page.setViewportSize({width,height})
    const user = await installDashboardFixture(page,"company",["departments:read","departments:update","branches:read","positions:read","positions:update","employee_numbering:read","employee_numbering:update"])
    const department = {id:22, name:"Client services",code:"DEP-22",status:"active",manager_employee_id:null as number|null}
    let strict = false
    await page.route("**/api/**", async route => {
      const req = route.request()
      const path = new URL(req.url()).pathname
      let json: unknown = {data:[]}
      if (["/api/users/me","/api/auth/me","/api/auth/session"].includes(path)) json = {...user,data:user}
      if (path === "/api/positions/staffing-policy") {
        if (req.method() === "PATCH") strict = req.postDataJSON().enforce_staffing_limit
        json = {enforce_staffing_limit:strict}
      } else if (path === "/api/departments") json = {data:[department],meta:{totalItems:1,totalPages:1,currentPage:1,itemsPerPage:20,itemCount:1}}
      else if (path === "/api/departments/manager-options") json = [{id:43,employee_no:"HR/0003",first_name:"Asha",last_name:"Rashid"}]
      else if (path === "/api/departments/22") {
        if (req.method() === "PATCH") department.manager_employee_id=req.postDataJSON().manager_employee_id
        json = department
      } else if (path === "/api/employee-numbering") json = {id:1,prefix:"HR",padding:4,next_number:7}
      await route.fulfill({json})
    })
    await page.goto("/dashboard/departments")
    await page.getByRole("button",{name:"Edit department"}).first().click()
    await page.getByRole("combobox",{name:"Department manager",exact:true}).click()
    await page.getByRole("option",{name:/Asha Rashid/}).click()
    const request = page.waitForRequest(r => r.method()==="PATCH" && r.url().endsWith("/departments/22"))
    await page.getByRole("button",{name:"Save",exact:true}).click()
    expect((await request).postDataJSON().manager_employee_id).toBe(43)
    await page.goto("/dashboard/positions")
    const policySaved = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/positions/staffing-policy"))
    await page.getByRole("checkbox",{name:"Enforce staffing limits across hiring and transfers"}).check()
    expect((await policySaved).ok()).toBe(true)
    await expect(page.getByText(/unexpired pending invitations take up seats/)).toBeVisible()
    await page.goto("/dashboard/structure/numbering")
    const preview = page.getByLabel("Employee number preview")
    await expect(preview).toHaveText("HR/0007")
    await expect(page.getByText("HR/",{exact:true})).toBeVisible()
    if (size === "desktop") {
      await page.getByText("Next employee number",{exact:true}).locator("../../..").screenshot({path:info.outputPath("employee-number-preview.png")})
    }
    await page.getByLabel("Next",{exact:true}).fill("10001")
    await expect(preview).toHaveText("HR/10001")
    await page.getByLabel("Prefix",{exact:true}).fill("")
    await expect(preview).toHaveText("10001")
    await page.getByLabel("Digits",{exact:true}).fill("0")
    await expect(preview).toHaveText(/Enter a valid/)
  })
}
