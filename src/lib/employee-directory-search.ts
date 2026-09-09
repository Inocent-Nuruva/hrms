export type EmployeeDirectoryRecord = Record<string, unknown>

export type EmployeeDirectoryMode = "current" | "inactive"

const HISTORICAL_EMPLOYEE_STATUSES = new Set([
  "inactive",
  "resigned",
  "terminated",
  "retired",
  "exited",
])

export function isHistoricalEmployeeStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    HISTORICAL_EMPLOYEE_STATUSES.has(status.trim().toLowerCase())
  )
}

export function employeeBelongsToDirectory(
  status: unknown,
  mode: EmployeeDirectoryMode,
): boolean {
  const historical = isHistoricalEmployeeStatus(status)
  return mode === "inactive" ? historical : !historical
}

const EMAIL_KEYS = [
  "email",
  "work_email",
  "workEmail",
  "personal_email",
  "personalEmail",
  "email_address",
  "emailAddress",
  "username",
] as const

const PHONE_KEYS = [
  "phone",
  "phone_number",
  "phoneNumber",
  "mobile",
  "mobile_number",
  "mobileNumber",
  "whatsapp",
  "whatsapp_number",
] as const

const NAME_KEYS = [
  "full_name",
  "fullName",
  "name",
  "preferred_name",
  "preferredName",
  "display_name",
  "displayName",
  "first_name",
  "firstName",
  "middle_name",
  "middleName",
  "last_name",
  "lastName",
] as const

const NUMBER_KEYS = [
  "employee_no",
  "employeeNo",
  "employee_number",
  "employeeNumber",
  "employee_code",
  "employeeCode",
  "user_no",
  "userNo",
  "username",
] as const

function asRecord(value: unknown): EmployeeDirectoryRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as EmployeeDirectoryRecord
}

function readStrings(record: EmployeeDirectoryRecord | null, keys: readonly string[]): string[] {
  if (!record) {
    return []
  }
  const values: string[] = []
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      values.push(value.trim())
    } else if (typeof value === "number" && Number.isFinite(value)) {
      values.push(String(value))
    }
  }
  return values
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

const PERSON_RELATION_KEYS = [
  "company_user",
  "companyUser",
  "user",
  "account",
  "employee",
  "employee_profile",
  "profile",
  "primary_contact",
  "contact",
] as const

function nestedPersonRecords(record: EmployeeDirectoryRecord): EmployeeDirectoryRecord[] {
  const records: EmployeeDirectoryRecord[] = []
  const pending: EmployeeDirectoryRecord[] = [record]
  const seen = new Set<EmployeeDirectoryRecord>()

  while (pending.length > 0) {
    const current = pending.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)
    records.push(current)

    for (const key of PERSON_RELATION_KEYS) {
      const related = asRecord(current[key])
      if (related && !seen.has(related)) {
        pending.push(related)
      }
    }
  }

  return records
}

function contactRecords(record: EmployeeDirectoryRecord): EmployeeDirectoryRecord[] {
  const buckets = [record.contacts, record.contact_details, record.contactDetails]
  const contacts: EmployeeDirectoryRecord[] = []
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue
    for (const entry of bucket) {
      const nested = asRecord(entry)
      if (nested) contacts.push(nested)
    }
  }
  return contacts
}

export function digitsOnlyPhone(value: string): string {
  return value.replace(/\D+/g, "")
}

export function normalizeEmployeeDirectorySearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function collectEmployeeDirectoryEmails(record: EmployeeDirectoryRecord): string[] {
  const emails: string[] = []
  for (const person of nestedPersonRecords(record)) {
    emails.push(...readStrings(person, EMAIL_KEYS))
    for (const contact of contactRecords(person)) {
      emails.push(...readStrings(contact, EMAIL_KEYS))
    }
  }
  return uniqueStrings(emails)
}

export function collectEmployeeDirectoryPhones(record: EmployeeDirectoryRecord): string[] {
  const phones: string[] = []
  for (const person of nestedPersonRecords(record)) {
    phones.push(...readStrings(person, PHONE_KEYS))
    for (const contact of contactRecords(person)) {
      phones.push(...readStrings(contact, PHONE_KEYS))
    }
  }
  return uniqueStrings(phones)
}

export function collectEmployeeDirectoryNumbers(record: EmployeeDirectoryRecord): string[] {
  const numbers: string[] = []
  for (const person of nestedPersonRecords(record)) {
    numbers.push(...readStrings(person, NUMBER_KEYS))
  }
  return uniqueStrings(numbers)
}

export function collectEmployeeDirectoryNames(record: EmployeeDirectoryRecord): string[] {
  const names: string[] = []
  for (const person of nestedPersonRecords(record)) {
    names.push(...readStrings(person, NAME_KEYS))
    const first = readStrings(person, ["first_name", "firstName"])[0]
    const middle = readStrings(person, ["middle_name", "middleName"])[0]
    const last = readStrings(person, ["last_name", "lastName"])[0]
    const joined = [first, middle, last].filter(Boolean).join(" ").trim()
    if (joined) names.push(joined)
  }
  return uniqueStrings(names)
}

export function phoneNumbersMatch(stored: string, query: string): boolean {
  const storedDigits = digitsOnlyPhone(stored)
  const queryDigits = digitsOnlyPhone(query)
  if (!storedDigits || !queryDigits) {
    return false
  }
  if (storedDigits.includes(queryDigits) || queryDigits.includes(storedDigits)) {
    return true
  }
  const storedLocal = storedDigits.replace(/^0+/, "").slice(-9)
  const queryLocal = queryDigits.replace(/^0+/, "").slice(-9)
  return storedLocal.length >= 9 && storedLocal === queryLocal
}

export function emailsMatch(stored: string, query: string): boolean {
  const storedEmail = stored.trim().toLowerCase()
  const queryEmail = query.trim().toLowerCase()
  if (!storedEmail || !queryEmail) {
    return false
  }
  return storedEmail === queryEmail || storedEmail.includes(queryEmail)
}

export function employeeOwnsEmail(record: EmployeeDirectoryRecord, email: string): boolean {
  return collectEmployeeDirectoryEmails(record).some((value) => emailsMatch(value, email))
}

export function employeeOwnsPhone(record: EmployeeDirectoryRecord, phone: string): boolean {
  return collectEmployeeDirectoryPhones(record).some((value) => phoneNumbersMatch(value, phone))
}

export function getEmployeeDirectoryContactSummary(
  record: EmployeeDirectoryRecord,
): EmployeeDirectoryRecord | null {
  const email = collectEmployeeDirectoryEmails(record).find((value) => value.includes("@"))
  const phoneNumber = collectEmployeeDirectoryPhones(record).find(
    (value) => digitsOnlyPhone(value).length >= 6,
  )

  if (!email && !phoneNumber) {
    return null
  }

  return {
    ...(phoneNumber ? { phone_number: phoneNumber } : {}),
    ...(email ? { email } : {}),
  }
}

export function matchesEmployeeDirectorySearch(
  record: EmployeeDirectoryRecord,
  search: string,
): boolean {
  const raw = search.trim()
  if (!raw) {
    return true
  }

  const names = collectEmployeeDirectoryNames(record)
  const numbers = collectEmployeeDirectoryNumbers(record)
  const emails = collectEmployeeDirectoryEmails(record)
  const phones = collectEmployeeDirectoryPhones(record)
  const haystack = normalizeEmployeeDirectorySearch(
    [...names, ...numbers, ...emails, ...phones].join(" "),
  )
  const queryDigits = digitsOnlyPhone(raw)
  const tokens = normalizeEmployeeDirectorySearch(raw)
    .split(/\s+/)
    .filter(Boolean)

  if (queryDigits.length >= 6 && phones.some((phone) => phoneNumbersMatch(phone, raw))) {
    const nameTokens = tokens.filter((token) => digitsOnlyPhone(token).length < 3)
    return nameTokens.every((token) => haystack.includes(token))
  }

  if (raw.includes("@") && emails.some((email) => emailsMatch(email, raw))) {
    return true
  }

  return tokens.every((token) => {
    if (haystack.includes(token)) {
      return true
    }
    const tokenDigits = digitsOnlyPhone(token)
    return (
      tokenDigits.length >= 3 &&
      phones.some((phone) => phoneNumbersMatch(phone, token))
    )
  })
}

export function filterEmployeesByDirectorySearch<T extends EmployeeDirectoryRecord>(
  rows: T[],
  search: string,
): T[] {
  const raw = search.trim()
  if (!raw) {
    return rows
  }
  return rows.filter((row) => matchesEmployeeDirectorySearch(row, raw))
}

export function formatEmployeeDirectoryPerson(
  record: EmployeeDirectoryRecord,
  source: "employee" | "company_user" = "employee",
): string {
  const names = collectEmployeeDirectoryNames(record)
  const numbers = collectEmployeeDirectoryNumbers(record)
  const emails = collectEmployeeDirectoryEmails(record)
  const name =
    names.find((value) => value.includes(" ")) ??
    names[0] ??
    emails[0] ??
    numbers[0] ??
    "Unknown person"
  const identifier = numbers[0]
  if (source === "employee") {
    return identifier ? `${name} (employee ${identifier})` : `${name} (employee)`
  }
  return identifier
    ? `${name} (company user ${identifier}, no employee profile)`
    : `${name} (company user, no employee profile)`
}

export function mergeEmployeeDirectoryRows<T extends EmployeeDirectoryRecord>(
  rows: T[],
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const id = row.id ?? row.employee_id ?? row.employeeId ?? row.user_id ?? row.userId
    if (id === null || id === undefined || id === "") {
      out.push(row)
      continue
    }
    const key = String(id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}
