import { getEmployeeById, listEmployees, type AdminRecord } from "@/lib/admin-api"

function employeeLabel(row: AdminRecord | null) {
  if (!row) return ""
  const read = (...keys: string[]) => keys.map((key) => row[key]).find((value): value is string => typeof value === "string" && !!value.trim())?.trim() ?? ""
  const name = read("full_name", "fullName", "display_name", "displayName", "name", "employee_name", "employeeName")
    || [read("first_name", "firstName"), read("middle_name", "middleName"), read("last_name", "lastName")].filter(Boolean).join(" ")
  const number = read("employee_no", "employeeNo", "employee_number", "employeeNumber")
  return name ? `${name}${number ? ` (${number})` : ""}` : ""
}

function employeeId(row: AdminRecord) {
  return Number(row.id ?? row.employee_id ?? row.employeeId)
}

export async function scorecardEmployeeNames(token: string, ids: number[]) {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  const names: Record<number, string> = {}
  if (!uniqueIds.length) return names

  try {
    const directory = await listEmployees(token, { limit: 100 })
    for (const row of directory.rows) {
      const id = employeeId(row)
      const label = employeeLabel(row)
      if (uniqueIds.includes(id) && label) names[id] = label
    }
  } catch {
    // The individual employee endpoint may still be available.
  }

  const missingIds = uniqueIds.filter((id) => !names[id])
  const results = await Promise.allSettled(missingIds.map((id) => getEmployeeById(id, token)))
  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return
    const label = employeeLabel(result.value)
    if (label) names[missingIds[index]] = label
  })
  return names
}
