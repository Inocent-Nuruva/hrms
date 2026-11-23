import { test, expect, type Page } from "@playwright/test"
import { DASHBOARD_AUTH_COOKIE } from "../src/lib/dashboard-permissions"

async function workspace(page: Page, additionalPermissions: string[] = []) {
  const permissions = ["data_scope:company","company_dashboard:read","probation_policies:read","probation_policies:create","probation_cases:read","probation_reviews:manager-review","probation_letters:generate",...additionalPermissions]
  const user = { id: 231, fullName:"Test reviewer", email:"reviewer@example.test", roles:["HR"], permissions, scope:"company", userType:"COMPANY_USER", companyId:10, companyMembershipId:71, dashboardType:"admin", accessContextResolved:true }
  const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({...user,sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")}.test`
  await page.context().addCookies([{name:DASHBOARD_AUTH_COOKIE,value:"1",url:test.info().project.use.baseURL ?? "http://localhost:3000"}])
  await page.addInitScript(({user,token})=>{
    localStorage.setItem("hrms.auth.session.v1",JSON.stringify({tokens:{accessToken:token,refreshToken:"fixture"},user,credentialVersion:"probation-test"}))
    localStorage.setItem("hrms.admin.accessToken",token)
    localStorage.setItem("ess.auth.user",JSON.stringify(user))
    sessionStorage.setItem("hrms.dashboard.actorPermissions",JSON.stringify(user.permissions))
  },{user,token})
  const saved: Record<string,Record<string,unknown>> = {}
  const sample = {id:42,caseNo:"PR-42",status:"MANAGER_REVIEW_PENDING",employee:{id:17,first_name:"Amina",last_name:"Test"},managerReviewCriteria:[{criterionCode:"WORK",criterionName:"Quality",maximumRating:"4"}]}
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url())
    const path=url.pathname
    let json:unknown={data:[]}
    if (route.request().method()==="POST" && path.startsWith("/api/probation/")) {
      saved[path]=route.request().postDataJSON()
      json={id:6,...saved[path]}
    } else if (path==="/api/probation/policy-options") {
      json={targets:{branch_id:[{id:3,name:"Central branch"}],department_id:[],position_id:[],grade_id:[]},defaults:{probation_period_days:150,maximum_extensions:2,default_extension_days:60,maximum_extension_days:120,maximum_total_days:365,reminder_days:[14,3]}}
    } else if (path==="/api/users") json={data:[{id:322,first_name:"Example",last_name:"Account",email:"example.account@example.test"}],total:1}
    else if (path==="/api/probation/cases") json=[sample]
    else if (path==="/api/probation/cases/42") json=sample
    else if (path==="/api/probation/letter-templates") json=saved[path]?[saved[path]]:[]
    else if (path==="/api/auth/session" || path==="/api/users/me" || path==="/api/auth/me") json={...user,data:user}
    await route.fulfill({json})
  })
  return saved
}

for (const [name,width,height] of [["desktop",1366,900],["mobile",390,844]] as const) {
  test(`opens Users from Access Control and by bookmark on ${name}`,async ({page})=>{
    await page.setViewportSize({width,height})
    await workspace(page,["roles:read","users:read"])
    await page.goto("/dashboard/access-control/roles")
    await page.getByRole("tab",{name:"Users",exact:true}).click()
    await expect(page).toHaveURL(/\/dashboard\/users$/)
    const account=page.getByText("example.account@example.test",{exact:true}).first()
    await expect(account).toBeVisible()
    await expect(page.getByRole("button",{name:"Open search users"})).toBeVisible()
    if (name === "desktop") { await page.screenshot({ animations:"disabled",path:"handbook-images/access-control-users.png" }) }
    await page.reload()
    await expect(account).toBeVisible()
  })

  test(`probation policy, review and letter on ${name}`,async ({page})=>{
    test.setTimeout(120_000)
    await page.setViewportSize({width,height})
    const saved=await workspace(page)
    await page.goto("/dashboard/probation/policies")
    await page.getByRole("button",{name:"New policy"}).click()
    await expect(page.getByLabel("Probation days")).toHaveValue("150")
    const policyForm = page.getByRole("dialog").last()
    await policyForm.getByRole("textbox",{name:/^Code\b/i}).fill("FIELD")
    await policyForm.getByRole("textbox",{name:/^Name\b/i}).fill("Field team")
    await policyForm.getByRole("combobox",{name:"Branch",exact:true}).click()
    await page.getByRole("option",{name:"Central branch"}).click()
    await page.getByLabel("Priority",{exact:true}).fill("3")
    await page.getByLabel("Maximum extensions",{exact:true}).fill("0")
    await page.getByLabel("Default policy",{exact:true}).check()
    await page.getByLabel("Effective from").fill("2026-01-01")
    await page.getByLabel("Effective to").fill("2030-01-01")
    if (name === "desktop") { await policyForm.getByRole("textbox",{name:/^Code\b/i}).scrollIntoViewIfNeeded(); await policyForm.screenshot({ animations:"disabled",path:"handbook-images/probation-policy.png" }) }
    await page.getByRole("button",{name:"Save",exact:true}).click()
    await expect.poll(()=>saved["/api/probation/policies"]).toMatchObject({branch_id:3,priority:3,maximum_extensions:0,is_default:true,effective_to:"2030-01-01"})
    await page.goto("/dashboard/probation/cases")
    await page.getByRole("button",{name:"Open",exact:true}).first().click()
    await page.getByRole("button",{name:"Manager review",exact:true}).click()
    await page.getByLabel(/Quality rating/).fill("3")
    await page.getByRole("combobox",{name:"Recommendation"}).click()
    await page.getByRole("option",{name:/further review/i}).click()
    await page.getByRole("textbox",{name:"Manager review comments"}).fill("HR to review the evidence")
    if (name === "desktop") { await page.getByRole("dialog").last().screenshot({ animations:"disabled",path:"handbook-images/probation-review.png" }) }
    await page.getByRole("button",{name:"Save",exact:true}).click()
    await expect.poll(()=>saved["/api/probation/cases/42/manager-review"]).toMatchObject({ratings:[{criterion_code:"WORK",rating:3}],recommendation:"FURTHER_REVIEW"})
    await page.goto("/dashboard/probation/letter-templates")
    await page.getByLabel("Letterhead").fill("People team")
    await page.getByLabel("Letter body").fill("Your appointment is confirmed.")
    await page.getByLabel("Signatory name").fill("HR reviewer")
    await page.getByLabel("Signatory title").fill("People manager")
    if (name === "desktop") { await page.getByLabel("Letterhead").scrollIntoViewIfNeeded(); await page.screenshot({ animations:"disabled",path:"handbook-images/probation-letter-template.png" }) }
    await page.getByRole("button",{name:"Save template"}).click()
    await expect(page.getByRole("status").filter({hasText:"Template saved."})).toBeVisible()
    expect(saved["/api/probation/letter-templates"]).toMatchObject({letter_type:"CONFIRMATION",signatory_name:"HR reviewer"})
  })
}
