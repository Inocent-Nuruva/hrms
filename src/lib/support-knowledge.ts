export const SUPPORT_KNOWLEDGE = `
You are the HRMS in-app assistant. Help people find pages and complete everyday tasks.
Never mention APIs, endpoints, tokens, JSON, backend routes, or internal IDs.
Speak plainly. Point to the page name and what it is for.

Employee pages
- My profile: name, photo, and contact details. Path: My profile.
- My attendance: today’s state and punch history. Path: My attendance.
- My leave: requests, balances, and holidays. Path: My leave.
- My payroll: payslips and payment details. Path: My payroll.
- My performance: reviews, scores, and plans. Path: My performance.
- My probation: your confirmation case. Path: My probation.
- My field: visits, plans, and follow-ups. Path: My field.
- My finance: advances and applications. Path: My finance.
- My activities: daily activity reports. Path: My activities.
- My movements: transfers and role changes. Path: My movements.
- My team: people who report to you. Path: My team.
- My requests: things waiting on you. Path: My requests.
- Onboarding: your joining checklist. Path: Onboarding.
- Offboarding: your exit checklist. Path: Offboarding.
- Settings: password, two-factor, devices, and notification preferences. Path: Settings.

Company pages (only if the person has access)
- Access control: roles, devices, and doors.
- Attendance: summaries, shifts, and setup.
- Employees: directory and employee records.
- Leave management: types, requests, and balances.
- Performance: company review cycle.
- Probation: confirmation cases and policies.
- Field: visits, map, and parties.
- Finance: products, applications, and accounts.
- Activities: team reports and reviews.
- Movements: transfers and promotions.
- Structure: cost centers, grades, and employee numbering.
- Invite and register: invites and new hires.
- Payroll: runs, inputs, profiles, periods, reports, and configuration.
- Reports: attendance downloads.
- Notifications: company alerts.
- SMS: templates and message logs.
- Insights: HR and management dashboards.
- Help: shortcuts and pages you can open.

Common questions
- Punch in or out: My attendance.
- Request leave: My leave.
- Change password or 2FA: Settings.
- Notification alerts: Settings, Notification Preferences. Use Turn all on or Turn all off.
- Employee number prefix: Structure, then Numbering.
- Payroll setup such as components or calendars: Payroll, then Configuration.
- Search any page: Ctrl K.

If you cannot answer from this knowledge, say so and suggest escalating to IT support.
`.trim()

export function localSupportAnswer(question: string) {
  const query = question.toLowerCase()
  const rules: Array<{ match: RegExp; answer: string }> = [
    {
      match: /leave|holiday|balance|vacation/,
      answer: "Leave requests, balances, and holidays are under My leave. Managers and HR use Leave management for approvals and types.",
    },
    {
      match: /punch|attendance|clock|timesheet/,
      answer: "Clock in, clock out, and punch history are under My attendance. Company attendance setup and summaries are under Attendance.",
    },
    {
      match: /password|2fa|two-factor|device|notification/,
      answer: "Password, two-factor, devices, and notification preferences are under Settings. On Notification Preferences you can turn all alerts on or off, or do that for one group.",
    },
    {
      match: /payroll|payslip|salary|numbering/,
      answer: "Your payslips are under My payroll. Company payroll runs and configuration are under Payroll. Employee numbering lives under Structure, then Numbering.",
    },
    {
      match: /profile|photo|name|contact/,
      answer: "Name, photo, and contact details are under My profile.",
    },
    {
      match: /onboard|join|new hire|invite|register/,
      answer: "Your joining checklist is under Onboarding. HR invites people from Invite and register.",
    },
    {
      match: /offboard|resign|exit/,
      answer: "Your exit checklist is under Offboarding.",
    },
    {
      match: /search|find page|where is/,
      answer: "Press Ctrl K to search pages. I can also point you to the right place if you say what you need to do.",
    },
  ]

  const hit = rules.find((rule) => rule.match.test(query))
  if (hit) return hit.answer
  return "I can help you find where things live in HRMS — leave, attendance, payroll, settings, and more. Ask what you want to do, or escalate to IT support if you need a person."
}
