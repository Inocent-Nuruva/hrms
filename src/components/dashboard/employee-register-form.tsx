"use client"

import * as React from "react"
import { toast } from "sonner"
import ReactFlagsSelect from "react-flags-select"
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserPlus2Icon,
} from "lucide-react"

import {
  createEmployeeProfile,
  listResource,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/animate/tabs"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Switch } from "@/components/animate-ui/components/base/switch"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { asRecord, isLikelyRefreshToken, readString } from "@/utils/token-utils"
import { cn } from "@/lib/utils"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const LEGACY_TOKEN_STORAGE_KEY = "ess_auth_token"

type RegisterFormState = {
  employeeNo: string
  firstName: string
  middleName: string
  lastName: string
  branch: string
  department: string
  position: string
  email: string
  gender: string
  maritalStatus: string
  nationality: string
  roleId: string
}

type ContactFormState = {
  contactType: string
  isPrimary: boolean
  countryIso: string
  phoneNumber: string
  email: string
  notes: string
}

type AddressFormState = {
  addressType: string
  isPrimary: boolean
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  country: string
  postalCode: string
}

type RelativeFormState = {
  isEmergencyContact: boolean
  isPrimary: boolean
  fullName: string
  relationship: string
  phone: string
  email: string
  address: string
  occupation: string
}

type IdentificationFormState = {
  identificationType: string
  isPrimary: boolean
  identificationNumber: string
  issuedCountry: string
  expiryDate: string
}

type BankAccountFormState = {
  paymentMode: "bank" | "mobile_money"
  isPrimary: boolean
  bankName: string
  accountName: string
  accountNumber: string
  branchName: string
  swiftCode: string
  mobileMoneyProvider: string
}

const EMPTY_FORM: RegisterFormState = {
  employeeNo: "",
  firstName: "",
  middleName: "",
  lastName: "",
  branch: "",
  department: "",
  position: "",
  email: "",
  gender: "",
  maritalStatus: "",
  nationality: "",
  roleId: "",
}

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"]
const BRANCH_OPTIONS = ["Head Office", "Arusha", "Mwanza", "Dodoma", "Mbeya"]
const DEPARTMENT_OPTIONS = [
  "Human Resources",
  "Operations",
  "Finance",
  "Underwriting",
  "Claims",
]
const POSITION_OPTIONS = [
  "Officer",
  "Senior Officer",
  "Supervisor",
  "Manager",
  "Director",
]
const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed"]
const NATIONALITY_OPTIONS = [
  "Tanzanian",
  "Kenyan",
  "Ugandan",
  "Rwandan",
  "Burundian",
  "Other",
]
const CONTACT_TYPE_OPTIONS = ["personal", "work"]
const ADDRESS_TYPE_OPTIONS = ["home", "work", "other"]
const RELATIONSHIP_OPTIONS = [
  "parent",
  "spouse",
  "sibling",
  "child",
  "guardian",
  "other",
]
const IDENTIFICATION_TYPE_OPTIONS = [
  "national_id",
  "passport",
  "driving_license",
  "voter_id",
  "other",
]
const MOBILE_MONEY_PROVIDER_OPTIONS = [
  "none",
  "M-Pesa",
  "Airtel Money",
  "Tigo Pesa",
  "Halopesa",
]
const DEFAULT_MOBILE_MONEY_PROVIDER =
  MOBILE_MONEY_PROVIDER_OPTIONS.find((option) => option !== "none") ?? "M-Pesa"

const EMPTY_CONTACT: ContactFormState = {
  contactType: "personal",
  isPrimary: false,
  countryIso: "TZ",
  phoneNumber: "",
  email: "",
  notes: "",
}

const EMPTY_ADDRESS: AddressFormState = {
  addressType: "home",
  isPrimary: false,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "Tanzania",
  postalCode: "",
}

const EMPTY_RELATIVE: RelativeFormState = {
  isEmergencyContact: false,
  isPrimary: false,
  fullName: "",
  relationship: "",
  phone: "",
  email: "",
  address: "",
  occupation: "",
}

const EMPTY_IDENTIFICATION: IdentificationFormState = {
  identificationType: "national_id",
  isPrimary: false,
  identificationNumber: "",
  issuedCountry: "Tanzania",
  expiryDate: "",
}

const EMPTY_BANK_ACCOUNT: BankAccountFormState = {
  paymentMode: "bank",
  isPrimary: false,
  bankName: "",
  accountName: "",
  accountNumber: "",
  branchName: "",
  swiftCode: "",
  mobileMoneyProvider: "none",
}

const REGISTER_STEP_ORDER = [
  "details",
  "contacts",
  "addresses",
  "relatives",
  "identifications",
  "bankAccounts",
] as const

const REGISTER_STEP_LABELS: Record<RegisterStep, string> = {
  details: "Details",
  contacts: "Contacts",
  addresses: "Addresses",
  relatives: "Relatives",
  identifications: "IDs",
  bankAccounts: "Bank",
}

type RegisterStep = (typeof REGISTER_STEP_ORDER)[number]
type DeleteEntityKind = "contact" | "address" | "relative" | "identification" | "bankAccount"

type CountryIso = "TZ" | "KE" | "UG" | "RW" | "BI" | "ZM" | "ZA" | "GB" | "US"

const COUNTRY_DIAL_BY_ISO: Record<CountryIso, string> = {
  TZ: "+255",
  KE: "+254",
  UG: "+256",
  RW: "+250",
  BI: "+257",
  ZM: "+260",
  ZA: "+27",
  GB: "+44",
  US: "+1",
}

const COUNTRY_LABELS: Record<CountryIso, { primary: string; secondary: string }> = {
  TZ: { primary: "Tanzania", secondary: "+255" },
  KE: { primary: "Kenya", secondary: "+254" },
  UG: { primary: "Uganda", secondary: "+256" },
  RW: { primary: "Rwanda", secondary: "+250" },
  BI: { primary: "Burundi", secondary: "+257" },
  ZM: { primary: "Zambia", secondary: "+260" },
  ZA: { primary: "South Africa", secondary: "+27" },
  GB: { primary: "United Kingdom", secondary: "+44" },
  US: { primary: "United States", secondary: "+1" },
}

function joinPhoneWithCountryCode(countryCode: string, phoneNumber: string) {
  const phone = phoneNumber.trim()
  if (!phone) {
    return ""
  }
  if (phone.startsWith("+")) {
    return phone
  }
  return `${countryCode}${phone}`
}

function getDialCodeForCountry(isoCode: string) {
  if (isoCode in COUNTRY_DIAL_BY_ISO) {
    return COUNTRY_DIAL_BY_ISO[isoCode as keyof typeof COUNTRY_DIAL_BY_ISO]
  }
  return COUNTRY_DIAL_BY_ISO.TZ
}

type RoleOption = {
  id: string
  label: string
  name: string
}

function normalizeRoleText(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

function resolveDefaultRoleId(roleOptions: RoleOption[]) {
  if (roleOptions.length === 0) {
    return ""
  }

  const exactUser = roleOptions.find(
    (role) =>
      normalizeRoleText(role.name) === "user" ||
      normalizeRoleText(role.label) === "user"
  )
  if (exactUser) {
    return exactUser.id
  }

  const includesUser = roleOptions.find(
    (role) =>
      normalizeRoleText(role.name).includes("user") ||
      normalizeRoleText(role.label).includes("user")
  )
  if (includesUser) {
    return includesUser.id
  }

  return roleOptions[0]?.id ?? ""
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function toRoleOption(record: AdminRecord): RoleOption | null {
  const idValue = record.id
  const id =
    typeof idValue === "number" || typeof idValue === "string" ? String(idValue) : null
  if (!id) {
    return null
  }

  const name = toText(record.name) ?? `role_${id}`
  const label = toText(record.display_name) ?? name
  return { id, label, name }
}

function resolveAccessTokenFromStorage() {
  if (typeof window === "undefined") {
    return ""
  }

  const fromDedicatedKey = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  const legacySessionToken = window.sessionStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)?.trim() ?? ""

  let authAccessToken = ""
  let authRefreshToken = ""

  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as unknown
      if (typeof parsed === "string") {
        authAccessToken = parsed.trim()
      }

      const root = asRecord(parsed)
      const rootTokens = asRecord(root?.tokens)
      const rootData = asRecord(root?.data)
      const rootDataTokens = asRecord(rootData?.tokens)
      const candidates = [root, rootTokens, rootData, rootDataTokens]

      for (const candidate of candidates) {
        const candidateAccess = readString(candidate, ["accessToken", "access_token", "token"])
        const candidateRefresh = readString(candidate, ["refreshToken", "refresh_token"])
        if (candidateRefresh && !authRefreshToken) {
          authRefreshToken = candidateRefresh
        }
        if (
          candidateAccess &&
          !isLikelyRefreshToken(candidateAccess, candidateRefresh ?? authRefreshToken)
        ) {
          authAccessToken = candidateAccess
          break
        }
      }
    } catch {
      authAccessToken = authTokensRaw.trim()
      authRefreshToken = ""
    }
  }

  return (
    authAccessToken ||
    (fromDedicatedKey && !isLikelyRefreshToken(fromDedicatedKey, authRefreshToken)
      ? fromDedicatedKey
      : "") ||
    (legacySessionToken && !isLikelyRefreshToken(legacySessionToken, authRefreshToken)
      ? legacySessionToken
      : "")
  )
}

function AnimatedField({
  delayMs,
  children,
}: {
  delayMs: number
  children: React.ReactNode
}) {
  return (
    <div
      className="animate-fade-up"
      style={{ animationDelay: `${delayMs}ms`, opacity: 0 }}
    >
      {children}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  delayMs,
  children,
}: {
  label: string
  htmlFor: string
  delayMs: number
  children: React.ReactNode
}) {
  return (
    <AnimatedField delayMs={delayMs}>
      <div className="grid gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {children}
      </div>
    </AnimatedField>
  )
}

export function EmployeeRegisterForm() {
  const [currentStep, setCurrentStep] = React.useState<RegisterStep>("details")
  const [form, setForm] = React.useState<RegisterFormState>(EMPTY_FORM)
  const [dob, setDob] = React.useState<Date | undefined>(undefined)
  const [contacts, setContacts] = React.useState<ContactFormState[]>([])
  const [addresses, setAddresses] = React.useState<AddressFormState[]>([])
  const [relatives, setRelatives] = React.useState<RelativeFormState[]>([])
  const [identifications, setIdentifications] = React.useState<IdentificationFormState[]>([])
  const [bankAccounts, setBankAccounts] = React.useState<BankAccountFormState[]>([])
  const [isContactDialogOpen, setIsContactDialogOpen] = React.useState(false)
  const [draftContact, setDraftContact] = React.useState<ContactFormState>({ ...EMPTY_CONTACT })
  const [draftContactPhoneError, setDraftContactPhoneError] = React.useState("")
  const [draftContactEmailError, setDraftContactEmailError] = React.useState("")
  const [editingContactIndex, setEditingContactIndex] = React.useState<number | null>(null)
  const [isAddressDialogOpen, setIsAddressDialogOpen] = React.useState(false)
  const [draftAddress, setDraftAddress] = React.useState<AddressFormState>({ ...EMPTY_ADDRESS })
  const [editingAddressIndex, setEditingAddressIndex] = React.useState<number | null>(null)
  const [isRelativeDialogOpen, setIsRelativeDialogOpen] = React.useState(false)
  const [draftRelative, setDraftRelative] = React.useState<RelativeFormState>({ ...EMPTY_RELATIVE })
  const [editingRelativeIndex, setEditingRelativeIndex] = React.useState<number | null>(null)
  const [isIdentificationDialogOpen, setIsIdentificationDialogOpen] = React.useState(false)
  const [draftIdentification, setDraftIdentification] = React.useState<IdentificationFormState>({
    ...EMPTY_IDENTIFICATION,
  })
  const [editingIdentificationIndex, setEditingIdentificationIndex] = React.useState<number | null>(null)
  const [isBankDialogOpen, setIsBankDialogOpen] = React.useState(false)
  const [draftBankAccount, setDraftBankAccount] = React.useState<BankAccountFormState>({
    ...EMPTY_BANK_ACCOUNT,
  })
  const [editingBankIndex, setEditingBankIndex] = React.useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<{
    kind: DeleteEntityKind
    index: number
    label: string
  } | null>(null)
  const [roles, setRoles] = React.useState<RoleOption[]>([])
  const [rolesLoading, setRolesLoading] = React.useState(false)
  const [rolesError, setRolesError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const selectedRoleLabel = React.useMemo(
    () => roles.find((role) => role.id === form.roleId)?.label ?? "",
    [roles, form.roleId]
  )
  const currentStepIndex = REGISTER_STEP_ORDER.indexOf(currentStep)
  const previousStep = currentStepIndex > 0 ? REGISTER_STEP_ORDER[currentStepIndex - 1] : null
  const nextStep =
    currentStepIndex < REGISTER_STEP_ORDER.length - 1
      ? REGISTER_STEP_ORDER[currentStepIndex + 1]
      : null
  const isDraftBankMobileMoney = draftBankAccount.paymentMode === "mobile_money"

  const updateField = <K extends keyof RegisterFormState>(
    field: K,
    value: RegisterFormState[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const updateDraftContact = <K extends keyof ContactFormState>(
    field: K,
    value: ContactFormState[K]
  ) => {
    setDraftContact((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const updateDraftContactPhone = (nextValue: string) => {
    const digitsOnly = nextValue.replace(/\D/g, "")
    if (digitsOnly.length > 9) {
      setDraftContactPhoneError("Phone number cannot exceed 9 digits.")
      setDraftContact((previous) => ({
        ...previous,
        phoneNumber: digitsOnly.slice(0, 9),
      }))
      return
    }
    setDraftContactPhoneError("")
    setDraftContact((previous) => ({
      ...previous,
      phoneNumber: digitsOnly,
    }))
  }

  const openAddContactDialog = () => {
    setEditingContactIndex(null)
    setDraftContact({ ...EMPTY_CONTACT })
    setDraftContactPhoneError("")
    setDraftContactEmailError("")
    setIsContactDialogOpen(true)
  }

  const openEditContactDialog = (index: number) => {
    const entry = contacts[index]
    if (!entry) {
      return
    }
    setEditingContactIndex(index)
    setDraftContact({ ...entry })
    setDraftContactPhoneError("")
    setDraftContactEmailError("")
    setIsContactDialogOpen(true)
  }

  const saveDraftContact = () => {
    const normalizedPhone = draftContact.phoneNumber.trim()
    const normalizedEmail = draftContact.email.trim().toLowerCase()

    if (!normalizedEmail) {
      setDraftContactEmailError("Email is required.")
      return
    }

    if (
      normalizedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setDraftContactEmailError("Enter a valid email address.")
      return
    }

    const nextValue = {
      ...draftContact,
      email: normalizedEmail,
      notes: draftContact.notes.trim(),
      phoneNumber: normalizedPhone,
    }
    setContacts((previous) =>
      editingContactIndex === null
        ? [...previous, nextValue]
        : previous.map((item, index) => (index === editingContactIndex ? nextValue : item))
    )
    setIsContactDialogOpen(false)
    setEditingContactIndex(null)
    setDraftContact({ ...EMPTY_CONTACT })
    setDraftContactPhoneError("")
    setDraftContactEmailError("")
  }

  const removeContact = (index: number) => {
    setContacts((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateDraftAddress = <K extends keyof AddressFormState>(
    field: K,
    value: AddressFormState[K]
  ) => {
    setDraftAddress((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const addAddress = () => {
    setEditingAddressIndex(null)
    setDraftAddress({ ...EMPTY_ADDRESS })
    setIsAddressDialogOpen(true)
  }

  const openEditAddressDialog = (index: number) => {
    const entry = addresses[index]
    if (!entry) {
      return
    }
    setEditingAddressIndex(index)
    setDraftAddress({ ...entry })
    setIsAddressDialogOpen(true)
  }

  const saveDraftAddress = () => {
    setAddresses((previous) =>
      editingAddressIndex === null
        ? [...previous, { ...draftAddress }]
        : previous.map((item, index) => (index === editingAddressIndex ? { ...draftAddress } : item))
    )
    setIsAddressDialogOpen(false)
    setEditingAddressIndex(null)
    setDraftAddress({ ...EMPTY_ADDRESS })
  }

  const removeAddress = (index: number) => {
    setAddresses((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateDraftRelative = <K extends keyof RelativeFormState>(
    field: K,
    value: RelativeFormState[K]
  ) => {
    setDraftRelative((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const addRelative = () => {
    setEditingRelativeIndex(null)
    setDraftRelative({ ...EMPTY_RELATIVE })
    setIsRelativeDialogOpen(true)
  }

  const openEditRelativeDialog = (index: number) => {
    const entry = relatives[index]
    if (!entry) {
      return
    }
    setEditingRelativeIndex(index)
    setDraftRelative({ ...entry })
    setIsRelativeDialogOpen(true)
  }

  const saveDraftRelative = () => {
    setRelatives((previous) =>
      editingRelativeIndex === null
        ? [...previous, { ...draftRelative }]
        : previous.map((item, index) => (index === editingRelativeIndex ? { ...draftRelative } : item))
    )
    setIsRelativeDialogOpen(false)
    setEditingRelativeIndex(null)
    setDraftRelative({ ...EMPTY_RELATIVE })
  }

  const removeRelative = (index: number) => {
    setRelatives((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateDraftIdentification = <K extends keyof IdentificationFormState>(
    field: K,
    value: IdentificationFormState[K]
  ) => {
    setDraftIdentification((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const addIdentification = () => {
    setEditingIdentificationIndex(null)
    setDraftIdentification({ ...EMPTY_IDENTIFICATION })
    setIsIdentificationDialogOpen(true)
  }

  const openEditIdentificationDialog = (index: number) => {
    const entry = identifications[index]
    if (!entry) {
      return
    }
    setEditingIdentificationIndex(index)
    setDraftIdentification({ ...entry })
    setIsIdentificationDialogOpen(true)
  }

  const saveDraftIdentification = () => {
    setIdentifications((previous) =>
      editingIdentificationIndex === null
        ? [...previous, { ...draftIdentification }]
        : previous.map((item, index) =>
            index === editingIdentificationIndex ? { ...draftIdentification } : item
          )
    )
    setIsIdentificationDialogOpen(false)
    setEditingIdentificationIndex(null)
    setDraftIdentification({ ...EMPTY_IDENTIFICATION })
  }

  const removeIdentification = (index: number) => {
    setIdentifications((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateDraftBankAccount = <K extends keyof BankAccountFormState>(
    field: K,
    value: BankAccountFormState[K]
  ) => {
    setDraftBankAccount((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const setDraftBankMode = (useMobileMoney: boolean) => {
    setDraftBankAccount((previous) => {
      if (!useMobileMoney) {
        return {
          ...previous,
          paymentMode: "bank",
          mobileMoneyProvider: "none",
        }
      }

      const nextProvider =
        previous.mobileMoneyProvider && previous.mobileMoneyProvider !== "none"
          ? previous.mobileMoneyProvider
          : DEFAULT_MOBILE_MONEY_PROVIDER

      return {
        ...previous,
        paymentMode: "mobile_money",
        mobileMoneyProvider: nextProvider,
        bankName: nextProvider,
        branchName: "",
      }
    })
  }

  const addBankAccount = () => {
    setEditingBankIndex(null)
    setDraftBankAccount({ ...EMPTY_BANK_ACCOUNT })
    setIsBankDialogOpen(true)
  }

  const openEditBankDialog = (index: number) => {
    const entry = bankAccounts[index]
    if (!entry) {
      return
    }
    const nextMode =
      entry.paymentMode ??
      (entry.mobileMoneyProvider && entry.mobileMoneyProvider !== "none"
        ? "mobile_money"
        : "bank")
    setEditingBankIndex(index)
    setDraftBankAccount({
      ...entry,
      paymentMode: nextMode,
      mobileMoneyProvider:
        entry.mobileMoneyProvider && entry.mobileMoneyProvider !== "none"
          ? entry.mobileMoneyProvider
          : nextMode === "mobile_money"
            ? DEFAULT_MOBILE_MONEY_PROVIDER
            : "none",
    })
    setIsBankDialogOpen(true)
  }

  const saveDraftBankAccount = () => {
    const isMobileMoneyMode = draftBankAccount.paymentMode === "mobile_money"
    const mobileMoneyProvider = isMobileMoneyMode
      ? draftBankAccount.mobileMoneyProvider && draftBankAccount.mobileMoneyProvider !== "none"
        ? draftBankAccount.mobileMoneyProvider
        : DEFAULT_MOBILE_MONEY_PROVIDER
      : "none"

    const normalizedDraft: BankAccountFormState = {
      ...draftBankAccount,
      paymentMode: isMobileMoneyMode ? "mobile_money" : "bank",
      bankName: isMobileMoneyMode
        ? mobileMoneyProvider
        : draftBankAccount.bankName,
      accountNumber: draftBankAccount.accountNumber.trim(),
      branchName: isMobileMoneyMode ? "" : draftBankAccount.branchName,
      swiftCode: draftBankAccount.swiftCode.trim(),
      mobileMoneyProvider,
    }

    setBankAccounts((previous) =>
      editingBankIndex === null
        ? [...previous, normalizedDraft]
        : previous.map((item, index) => (index === editingBankIndex ? normalizedDraft : item))
    )
    setIsBankDialogOpen(false)
    setEditingBankIndex(null)
    setDraftBankAccount({ ...EMPTY_BANK_ACCOUNT })
  }

  const removeBankAccount = (index: number) => {
    setBankAccounts((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const requestDelete = (kind: DeleteEntityKind, index: number, label: string) => {
    setPendingDelete({ kind, index, label })
  }

  const confirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    const { kind, index } = pendingDelete
    if (kind === "contact") {
      removeContact(index)
    } else if (kind === "address") {
      removeAddress(index)
    } else if (kind === "relative") {
      removeRelative(index)
    } else if (kind === "identification") {
      removeIdentification(index)
    } else if (kind === "bankAccount") {
      removeBankAccount(index)
    }

    setPendingDelete(null)
  }

  const loadRoles = React.useCallback(async () => {
    const accessToken = resolveAccessTokenFromStorage()
    if (!accessToken) {
      setRoles([])
      setRolesError("Please login again to load roles.")
      return
    }

    setRolesLoading(true)
    setRolesError(null)
    try {
      const roleRecords = await listResource("roles", accessToken)
      const roleOptions = roleRecords
        .map((record) => toRoleOption(record))
        .filter((entry): entry is RoleOption => Boolean(entry))
      setRoles(roleOptions)
      const defaultRoleId = resolveDefaultRoleId(roleOptions)
      setForm((previous) => {
        const hasCurrent = roleOptions.some((role) => role.id === previous.roleId)
        if (hasCurrent) {
          return previous
        }
        return {
          ...previous,
          roleId: defaultRoleId,
        }
      })
    } catch (errorObject) {
      setRoles([])
      setRolesError(errorObject instanceof Error ? errorObject.message : "Failed to fetch roles.")
    } finally {
      setRolesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  const submitRegistration = async () => {
    if (isSubmitting) {
      return
    }

    const accessToken = resolveAccessTokenFromStorage()
    if (!accessToken) {
      toast.error("Authentication required. Please login again.")
      return
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required.")
      return
    }

    const normalizedEmployeeNo = form.employeeNo.trim()
    if (!normalizedEmployeeNo) {
      toast.error("Employee number is required.")
      return
    }

    if (!form.department.trim()) {
      setCurrentStep("details")
      toast.error("Department is required.")
      return
    }

  const normalizedContacts = contacts
      .map((contact) => ({
        contact_type: contact.contactType.trim() || "personal",
        is_primary: contact.isPrimary,
        phone_number: joinPhoneWithCountryCode(
          getDialCodeForCountry(contact.countryIso),
          contact.phoneNumber
        ),
        email: contact.email.trim().toLowerCase(),
        notes: contact.notes.trim(),
      }))
      .filter((contact) => Boolean(contact.email))

    if (normalizedContacts.length === 0) {
      setCurrentStep("contacts")
      toast.error("At least one contact is required before saving employee.")
      return
    }

    const normalizedAddresses = addresses
      .map((address) => ({
        address_type: address.addressType.trim() || "home",
        is_primary: address.isPrimary,
        address_line_1: address.addressLine1.trim(),
        address_line_2: address.addressLine2.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        country: address.country.trim(),
        postal_code: address.postalCode.trim(),
      }))
      .filter(
        (address) =>
          address.address_line_1 ||
          address.address_line_2 ||
          address.city ||
          address.state ||
          address.country ||
          address.postal_code ||
          address.is_primary
      )

    const normalizedRelatives = relatives
      .map((relative) => ({
        is_emergency_contact: relative.isEmergencyContact,
        is_primary: relative.isPrimary,
        full_name: relative.fullName.trim(),
        relationship: relative.relationship.trim(),
        phone: relative.phone.trim(),
        email: relative.email.trim(),
        address: relative.address.trim(),
        occupation: relative.occupation.trim(),
      }))
      .filter(
        (relative) =>
          relative.full_name ||
          relative.relationship ||
          relative.phone ||
          relative.email ||
          relative.address ||
          relative.occupation ||
          relative.is_emergency_contact ||
          relative.is_primary
      )

    const normalizedIdentifications = identifications
      .map((idDoc) => ({
        identification_type: idDoc.identificationType.trim() || "national_id",
        is_primary: idDoc.isPrimary,
        identification_number: idDoc.identificationNumber.trim(),
        issued_country: idDoc.issuedCountry.trim(),
        expiry_date: idDoc.expiryDate || "",
      }))
      .filter(
        (idDoc) =>
          idDoc.identification_number ||
          idDoc.issued_country ||
          idDoc.expiry_date ||
          idDoc.is_primary
      )

    const normalizedBankAccounts = bankAccounts
      .map((bank) => ({
        is_primary: bank.isPrimary,
        bank_name: bank.bankName.trim(),
        account_name: bank.accountName.trim(),
        account_number: bank.accountNumber.trim(),
        branch_name: bank.branchName.trim(),
        swift_code: bank.swiftCode.trim(),
        mobile_money_provider:
          bank.mobileMoneyProvider.trim() === "none" ? "" : bank.mobileMoneyProvider.trim(),
      }))
      .filter(
        (bank) =>
          bank.bank_name ||
          bank.account_name ||
          bank.account_number ||
          bank.branch_name ||
          bank.swift_code ||
          bank.mobile_money_provider ||
          bank.is_primary
      )

    setIsSubmitting(true)
    try {
      await createEmployeeProfile(accessToken, {
        employee_no: normalizedEmployeeNo,
        employment_status: "onboarding",
        employment_type: "full_time",
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        last_name: form.lastName.trim(),
        gender: form.gender || undefined,
        marital_status: form.maritalStatus || undefined,
        nationality: form.nationality || undefined,
        date_of_birth: dob ? dob.toISOString().slice(0, 10) : undefined,
        contacts: normalizedContacts,
        addresses: normalizedAddresses,
        relatives: normalizedRelatives,
        identifications: normalizedIdentifications,
        bank_accounts: normalizedBankAccounts,
        metadata: {
          branch: form.branch || undefined,
          department: form.department || undefined,
          position: form.position || undefined,
          role_id: form.roleId || undefined,
        },
      })
      toast.success("Employee saved successfully.")
      clearForm()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to save employee.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearForm = () => {
    setCurrentStep("details")
    setForm({
      ...EMPTY_FORM,
      roleId: resolveDefaultRoleId(roles),
    })
    setDob(undefined)
    setContacts([])
    setAddresses([])
    setRelatives([])
    setIdentifications([])
    setBankAccounts([])
    setDraftContact({ ...EMPTY_CONTACT })
    setDraftContactPhoneError("")
    setDraftContactEmailError("")
    setIsContactDialogOpen(false)
    setEditingContactIndex(null)
    setDraftAddress({ ...EMPTY_ADDRESS })
    setIsAddressDialogOpen(false)
    setEditingAddressIndex(null)
    setDraftRelative({ ...EMPTY_RELATIVE })
    setIsRelativeDialogOpen(false)
    setEditingRelativeIndex(null)
    setDraftIdentification({ ...EMPTY_IDENTIFICATION })
    setIsIdentificationDialogOpen(false)
    setEditingIdentificationIndex(null)
    setDraftBankAccount({ ...EMPTY_BANK_ACCOUNT })
    setIsBankDialogOpen(false)
    setEditingBankIndex(null)
    setPendingDelete(null)
    toast.message("Form reset.")
  }

  return (
    <div className="px-4 lg:px-6">
      <Card className="animate-card-entrance overflow-visible">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <UserPlus2Icon className="size-4" />
            Employee Registration
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          <Tabs
            value={currentStep}
            onValueChange={(value) => {
              if (REGISTER_STEP_ORDER.includes(value as RegisterStep)) {
                setCurrentStep(value as RegisterStep)
              }
            }}
          >
            <TabsList className="w-full flex-nowrap items-stretch justify-start gap-0 overflow-hidden rounded-lg border border-border/70 bg-muted/20 p-0">
              {REGISTER_STEP_ORDER.map((step, index) => (
                <TabsTrigger
                  key={step}
                  value={step}
                  className="group h-auto min-w-0 flex-1 rounded-none border-r border-border/50 px-2 py-2 text-left text-xs data-active:bg-primary data-active:text-primary-foreground sm:text-sm [&:last-child]:border-r-0"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-current/25 text-[11px] font-semibold leading-none">
                      {index + 1}
                      </span>
                      <span className="truncate">{REGISTER_STEP_LABELS[step]}</span>
                    </span>
                    {index < REGISTER_STEP_ORDER.length - 1 ? (
                      <ArrowRightIcon className="size-3.5 shrink-0 opacity-60 transition-opacity group-data-active:opacity-100" />
                    ) : null}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContents className="pt-4">
              <TabsContent value="details">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Employee Number" htmlFor="employeeNo" delayMs={30}>
                    <Input
                      id="employeeNo"
                      value={form.employeeNo}
                      onChange={(event) => updateField("employeeNo", event.target.value)}
                      placeholder="Enter employee number"
                    />
                  </Field>

                  <Field label="First Name" htmlFor="firstName" delayMs={40}>
                    <Input
                      id="firstName"
                      value={form.firstName}
                      onChange={(event) => updateField("firstName", event.target.value)}
                      placeholder="Enter first name"
                    />
                  </Field>

                  <Field label="Middle Name" htmlFor="middleName" delayMs={80}>
                    <Input
                      id="middleName"
                      value={form.middleName}
                      onChange={(event) => updateField("middleName", event.target.value)}
                      placeholder="Enter middle name"
                    />
                  </Field>

                  <Field label="Last Name" htmlFor="lastName" delayMs={120}>
                    <Input
                      id="lastName"
                      value={form.lastName}
                      onChange={(event) => updateField("lastName", event.target.value)}
                      placeholder="Enter last name"
                    />
                  </Field>

                  <Field label="Branch" htmlFor="branch" delayMs={160}>
                    <Select value={form.branch} onValueChange={(value) => updateField("branch", value ?? "")}>
                      <SelectTrigger id="branch" className="w-full">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRANCH_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Department" htmlFor="department" delayMs={200}>
                    <Select
                      value={form.department}
                      onValueChange={(value) => updateField("department", value ?? "")}
                    >
                      <SelectTrigger id="department" className="w-full">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENT_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Position" htmlFor="position" delayMs={240}>
                    <Select value={form.position} onValueChange={(value) => updateField("position", value ?? "")}>
                      <SelectTrigger id="position" className="w-full">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITION_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Email" htmlFor="email" delayMs={280}>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="name@company.com"
                    />
                  </Field>

                  <Field label="Gender" htmlFor="gender" delayMs={320}>
                    <Select value={form.gender} onValueChange={(value) => updateField("gender", value ?? "")}>
                      <SelectTrigger id="gender" className="w-full">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Marital Status" htmlFor="maritalStatus" delayMs={360}>
                    <Select
                      value={form.maritalStatus}
                      onValueChange={(value) => updateField("maritalStatus", value ?? "")}
                    >
                      <SelectTrigger id="maritalStatus" className="w-full">
                        <SelectValue placeholder="Select marital status" />
                      </SelectTrigger>
                      <SelectContent>
                        {MARITAL_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Nationality" htmlFor="nationality" delayMs={400}>
                    <Select
                      value={form.nationality}
                      onValueChange={(value) => updateField("nationality", value ?? "")}
                    >
                      <SelectTrigger id="nationality" className="w-full">
                        <SelectValue placeholder="Select nationality" />
                      </SelectTrigger>
                      <SelectContent>
                        {NATIONALITY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <AnimatedField delayMs={420}>
                    <div className="grid gap-2">
                      <Label htmlFor="roleId">Roles</Label>
                      <Select value={form.roleId} onValueChange={(value) => updateField("roleId", value ?? "")}>
                        <SelectTrigger id="roleId" className="w-full">
                          <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select role"}>
                            {selectedRoleLabel || undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.label}
                            </SelectItem>
                          ))}
                          {!rolesLoading && roles.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No roles available</div>
                          ) : null}
                        </SelectContent>
                      </Select>
                      {rolesError ? <p className="text-xs text-destructive">{rolesError}</p> : null}
                    </div>
                  </AnimatedField>

                  <AnimatedField delayMs={460}>
                    <div className="grid gap-2 md:col-span-2 xl:col-span-3">
                      <Label htmlFor="dob-trigger">Date of Birth</Label>
                      <Popover>
                        <PopoverTrigger
                          id="dob-trigger"
                          className="flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <CalendarDaysIcon className="size-4 text-muted-foreground" />
                          <span className={dob ? "text-foreground" : "text-muted-foreground"}>
                            {dob ? dob.toLocaleDateString() : "Select date from calendar"}
                          </span>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dob}
                            onSelect={setDob}
                            captionLayout="dropdown"
                            className="rounded-lg border bg-background"
                            fromYear={1940}
                            toYear={new Date().getFullYear()}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </AnimatedField>
                </div>
              </TabsContent>

              <TabsContent value="contacts">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Contacts</Label>
                    {contacts.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={openAddContactDialog}>
                        <PlusIcon />
                        Add Contact
                      </Button>
                    ) : null}
                  </div>

                  {contacts.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No contacts added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openAddContactDialog}>
                        <PlusIcon />
                        Add Contact
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {contacts.map((contact, index) => (
                        <div key={`contact-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="grid gap-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">Contact {index + 1}</p>
                                {contact.isPrimary ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                    <BadgeCheckIcon className="size-3.5" />
                                    Primary
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {contact.contactType} ·{" "}
                                {joinPhoneWithCountryCode(
                                  getDialCodeForCountry(contact.countryIso),
                                  contact.phoneNumber
                                ) || "No phone"}
                              </p>
                              {contact.email ? (
                                <p className="text-xs text-muted-foreground">Email: {contact.email}</p>
                              ) : null}
                              {contact.notes ? (
                                <p className="text-xs text-muted-foreground">Notes: {contact.notes}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                onClick={() => openEditContactDialog(index)}
                                aria-label={`Edit contact ${index + 1}`}
                                title="Edit"
                              >
                                <PencilIcon />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => requestDelete("contact", index, `Contact ${index + 1}`)}
                                aria-label={`Delete contact ${index + 1}`}
                                title="Delete"
                              >
                                <Trash2Icon />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="addresses">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Addresses</Label>
                    {addresses.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={addAddress}>
                        <PlusIcon />
                        Add Address
                      </Button>
                    ) : null}
                  </div>
                  {addresses.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No addresses added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addAddress}>
                        <PlusIcon />
                        Add Address
                      </Button>
                    </div>
                  ) : (
                    addresses.map((address, index) => (
                      <div key={`address-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-medium">Address {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {address.addressType} · {address.city || "No city"} · {address.country || "No country"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {address.addressLine1 || "No address line 1"}
                              {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {address.state || "No state"} {address.postalCode ? `· ${address.postalCode}` : ""}
                            </p>
                            {address.isPrimary ? (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <BadgeCheckIcon className="size-3.5" />
                                Primary address
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openEditAddressDialog(index)}
                              aria-label={`Edit address ${index + 1}`}
                              title="Edit"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => requestDelete("address", index, `Address ${index + 1}`)}
                              aria-label={`Delete address ${index + 1}`}
                              title="Delete"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="relatives">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Relatives</Label>
                    {relatives.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={addRelative}>
                        <PlusIcon />
                        Add Relative
                      </Button>
                    ) : null}
                  </div>
                  {relatives.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No relatives added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addRelative}>
                        <PlusIcon />
                        Add Relative
                      </Button>
                    </div>
                  ) : (
                    relatives.map((relative, index) => (
                      <div key={`relative-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-medium">Relative {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {relative.fullName || "No name"} · {relative.relationship || "No relationship"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {relative.phone || "No phone"} · {relative.email || "No email"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {relative.address || "No address"} · {relative.occupation || "No occupation"}
                            </p>
                            {relative.isEmergencyContact ? (
                              <p className="text-xs font-medium text-primary">Emergency contact</p>
                            ) : null}
                            {relative.isPrimary ? (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <BadgeCheckIcon className="size-3.5" />
                                Primary relative
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openEditRelativeDialog(index)}
                              aria-label={`Edit relative ${index + 1}`}
                              title="Edit"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => requestDelete("relative", index, `Relative ${index + 1}`)}
                              aria-label={`Delete relative ${index + 1}`}
                              title="Delete"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="identifications">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Identifications</Label>
                    {identifications.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={addIdentification}>
                        <PlusIcon />
                        Add Identification
                      </Button>
                    ) : null}
                  </div>
                  {identifications.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No identifications added.</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={addIdentification}
                      >
                        <PlusIcon />
                        Add Identification
                      </Button>
                    </div>
                  ) : (
                    identifications.map((idDoc, index) => (
                      <div key={`id-doc-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-medium">Identification {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {idDoc.identificationType} · {idDoc.identificationNumber || "No number"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {idDoc.issuedCountry || "No issued country"}
                              {idDoc.expiryDate ? ` · Expires ${idDoc.expiryDate}` : ""}
                            </p>
                            {idDoc.isPrimary ? (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <BadgeCheckIcon className="size-3.5" />
                                Primary identification
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openEditIdentificationDialog(index)}
                              aria-label={`Edit identification ${index + 1}`}
                              title="Edit"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                requestDelete("identification", index, `Identification ${index + 1}`)
                              }
                              aria-label={`Delete identification ${index + 1}`}
                              title="Delete"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="bankAccounts">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Bank Accounts</Label>
                    {bankAccounts.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={addBankAccount}>
                        <PlusIcon />
                        Add Bank Account
                      </Button>
                    ) : null}
                  </div>
                  {bankAccounts.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No bank accounts added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addBankAccount}>
                        <PlusIcon />
                        Add Bank Account
                      </Button>
                    </div>
                  ) : (
                    bankAccounts.map((bank, index) => (
                      <div key={`bank-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-medium">Bank Account {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {bank.bankName || "No bank"} · {bank.accountName || "No account name"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bank.accountNumber || "No account number"} · {bank.branchName || "No branch"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bank.swiftCode || "No SWIFT"}
                              {bank.mobileMoneyProvider && bank.mobileMoneyProvider !== "none"
                                ? ` · ${bank.mobileMoneyProvider}`
                                : ""}
                            </p>
                            {bank.isPrimary ? (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <BadgeCheckIcon className="size-3.5" />
                                Primary bank account
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openEditBankDialog(index)}
                              aria-label={`Edit bank account ${index + 1}`}
                              title="Edit"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => requestDelete("bankAccount", index, `Bank Account ${index + 1}`)}
                              aria-label={`Delete bank account ${index + 1}`}
                              title="Delete"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </TabsContents>
          </Tabs>
        </CardContent>

        <CardFooter className="flex flex-wrap justify-between gap-3">
          <Button variant="outline" onClick={clearForm}>
            Clear
          </Button>
          <div className="flex items-center gap-2">
            {previousStep ? (
              <Button variant="outline" onClick={() => setCurrentStep(previousStep)}>
                <ChevronLeftIcon />
                Previous
              </Button>
            ) : null}

            {nextStep ? (
              <Button onClick={() => setCurrentStep(nextStep)}>
                Next
                <ChevronRightIcon />
              </Button>
            ) : (
              <Button onClick={() => void submitRegistration()} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Employee"}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Are you sure you want to delete ${pendingDelete.label}? This action cannot be undone.`
                : "Are you sure you want to delete this item?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction onClick={confirmDelete} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingAddressIndex === null ? "Add Address" : "Edit Address"}</DialogTitle>
            <DialogDescription>
              {editingAddressIndex === null
                ? "Capture an address and add it to the list."
                : "Update the selected address."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="draft-address-type">Address Type</Label>
              <Select
                value={draftAddress.addressType}
                onValueChange={(value) => updateDraftAddress("addressType", value ?? "home")}
              >
                <SelectTrigger id="draft-address-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-address-country">Country</Label>
              <Input
                id="draft-address-country"
                value={draftAddress.country}
                onChange={(event) => updateDraftAddress("country", event.target.value)}
                placeholder="Country"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-address-city">City</Label>
              <Input
                id="draft-address-city"
                value={draftAddress.city}
                onChange={(event) => updateDraftAddress("city", event.target.value)}
                placeholder="City"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-address-line1">Address Line 1</Label>
              <Input
                id="draft-address-line1"
                value={draftAddress.addressLine1}
                onChange={(event) => updateDraftAddress("addressLine1", event.target.value)}
                placeholder="Street and number"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-address-line2">Address Line 2</Label>
              <Input
                id="draft-address-line2"
                value={draftAddress.addressLine2}
                onChange={(event) => updateDraftAddress("addressLine2", event.target.value)}
                placeholder="Apartment, block, landmark"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-address-state">State</Label>
              <Input
                id="draft-address-state"
                value={draftAddress.state}
                onChange={(event) => updateDraftAddress("state", event.target.value)}
                placeholder="State / Region"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-address-postal">Postal Code</Label>
              <Input
                id="draft-address-postal"
                value={draftAddress.postalCode}
                onChange={(event) => updateDraftAddress("postalCode", event.target.value)}
                placeholder="Postal code"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-2 xl:col-span-3">
              <Checkbox
                checked={draftAddress.isPrimary}
                onCheckedChange={(checked) => updateDraftAddress("isPrimary", Boolean(checked))}
              />
              Primary address
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftAddress}>
              {editingAddressIndex === null ? "Save Address" : "Update Address"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={isRelativeDialogOpen} onOpenChange={setIsRelativeDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingRelativeIndex === null ? "Add Relative" : "Edit Relative"}</DialogTitle>
            <DialogDescription>
              {editingRelativeIndex === null
                ? "Capture a relative and add to the list."
                : "Update the selected relative."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="draft-relative-name">Full Name</Label>
              <Input
                id="draft-relative-name"
                value={draftRelative.fullName}
                onChange={(event) => updateDraftRelative("fullName", event.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-relative-relationship">Relationship</Label>
              <Select
                value={draftRelative.relationship}
                onValueChange={(value) => updateDraftRelative("relationship", value ?? "")}
              >
                <SelectTrigger id="draft-relative-relationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-relative-phone">Phone</Label>
              <Input
                id="draft-relative-phone"
                value={draftRelative.phone}
                onChange={(event) => updateDraftRelative("phone", event.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-relative-email">Email</Label>
              <Input
                id="draft-relative-email"
                type="email"
                value={draftRelative.email}
                onChange={(event) => updateDraftRelative("email", event.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-relative-address">Address</Label>
              <Input
                id="draft-relative-address"
                value={draftRelative.address}
                onChange={(event) => updateDraftRelative("address", event.target.value)}
                placeholder="Address"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-relative-occupation">Occupation</Label>
              <Input
                id="draft-relative-occupation"
                value={draftRelative.occupation}
                onChange={(event) => updateDraftRelative("occupation", event.target.value)}
                placeholder="Occupation"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={draftRelative.isEmergencyContact}
                onCheckedChange={(checked) => updateDraftRelative("isEmergencyContact", Boolean(checked))}
              />
              Emergency contact
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={draftRelative.isPrimary}
                onCheckedChange={(checked) => updateDraftRelative("isPrimary", Boolean(checked))}
              />
              Primary relative
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftRelative}>
              {editingRelativeIndex === null ? "Save Relative" : "Update Relative"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={isIdentificationDialogOpen} onOpenChange={setIsIdentificationDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>
              {editingIdentificationIndex === null ? "Add Identification" : "Edit Identification"}
            </DialogTitle>
            <DialogDescription>
              {editingIdentificationIndex === null
                ? "Capture an identification record and add it."
                : "Update the selected identification record."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="draft-identification-type">Identification Type</Label>
              <Select
                value={draftIdentification.identificationType}
                onValueChange={(value) =>
                  updateDraftIdentification("identificationType", value ?? "national_id")
                }
              >
                <SelectTrigger id="draft-identification-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {IDENTIFICATION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-identification-number">Identification Number</Label>
              <Input
                id="draft-identification-number"
                value={draftIdentification.identificationNumber}
                onChange={(event) => updateDraftIdentification("identificationNumber", event.target.value)}
                placeholder="ID number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-identification-country">Issued Country</Label>
              <Input
                id="draft-identification-country"
                value={draftIdentification.issuedCountry}
                onChange={(event) => updateDraftIdentification("issuedCountry", event.target.value)}
                placeholder="Issued country"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-identification-expiry">Expiry Date</Label>
              <Input
                id="draft-identification-expiry"
                type="date"
                value={draftIdentification.expiryDate}
                onChange={(event) => updateDraftIdentification("expiryDate", event.target.value)}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-2">
              <Checkbox
                checked={draftIdentification.isPrimary}
                onCheckedChange={(checked) => updateDraftIdentification("isPrimary", Boolean(checked))}
              />
              Primary identification
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftIdentification}>
              {editingIdentificationIndex === null ? "Save Identification" : "Update Identification"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingBankIndex === null ? "Add Bank Account" : "Edit Bank Account"}</DialogTitle>
            <DialogDescription>
              {editingBankIndex === null
                ? "Capture bank or mobile money account details."
                : "Update the selected bank account details."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="md:col-span-2 xl:col-span-3">
              <Label className="flex items-center gap-x-3 text-sm font-medium">
                <Switch
                  checked={isDraftBankMobileMoney}
                  onCheckedChange={(checked) => setDraftBankMode(Boolean(checked))}
                />
                {isDraftBankMobileMoney ? "Mobile money account" : "Bank account"}
              </Label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-name">
                {isDraftBankMobileMoney ? "Mobile Money Provider" : "Bank Name"}
              </Label>
              {isDraftBankMobileMoney ? (
                <Select
                  value={draftBankAccount.mobileMoneyProvider}
                  onValueChange={(value) => {
                    const nextProvider =
                      value && value !== "none" ? value : DEFAULT_MOBILE_MONEY_PROVIDER
                    updateDraftBankAccount("mobileMoneyProvider", nextProvider)
                    updateDraftBankAccount("bankName", nextProvider)
                  }}
                >
                  <SelectTrigger id="draft-bank-name">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOBILE_MONEY_PROVIDER_OPTIONS.filter((option) => option !== "none").map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="draft-bank-name"
                  value={draftBankAccount.bankName}
                  onChange={(event) => updateDraftBankAccount("bankName", event.target.value)}
                  placeholder="Bank name"
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-account-name">Account Name</Label>
              <Input
                id="draft-bank-account-name"
                value={draftBankAccount.accountName}
                onChange={(event) => updateDraftBankAccount("accountName", event.target.value)}
                placeholder="Account name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-account-number">
                {isDraftBankMobileMoney ? "Phone Number" : "Account Number"}
              </Label>
              <Input
                id="draft-bank-account-number"
                value={draftBankAccount.accountNumber}
                onChange={(event) => updateDraftBankAccount("accountNumber", event.target.value)}
                placeholder={isDraftBankMobileMoney ? "Phone number" : "Account number"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-branch">
                Branch Name{isDraftBankMobileMoney ? " (optional)" : ""}
              </Label>
              <Input
                id="draft-bank-branch"
                value={draftBankAccount.branchName}
                onChange={(event) => updateDraftBankAccount("branchName", event.target.value)}
                placeholder="Branch name"
                disabled={isDraftBankMobileMoney}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-swift">SWIFT Code (optional)</Label>
              <Input
                id="draft-bank-swift"
                value={draftBankAccount.swiftCode}
                onChange={(event) => updateDraftBankAccount("swiftCode", event.target.value)}
                placeholder="SWIFT code"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-2 xl:col-span-3">
              <Checkbox
                checked={draftBankAccount.isPrimary}
                onCheckedChange={(checked) => updateDraftBankAccount("isPrimary", Boolean(checked))}
              />
              Primary bank account
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftBankAccount}>
              {editingBankIndex === null ? "Save Bank Account" : "Update Bank Account"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingContactIndex === null ? "Add Contact" : "Edit Contact"}</DialogTitle>
            <DialogDescription>
              {editingContactIndex === null
                ? "Capture a contact and save it to the contacts list."
                : "Update the selected contact."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="draft-contact-type">Contact Type</Label>
              <Select
                value={draftContact.contactType}
                onValueChange={(value) => updateDraftContact("contactType", value ?? "personal")}
              >
                <SelectTrigger id="draft-contact-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-contact-phone">Phone Number</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)]">
                <ReactFlagsSelect
                  id="draft-contact-country"
                  rfsKey="draft-contact-country"
                  selected={draftContact.countryIso}
                  onSelect={(value) => updateDraftContact("countryIso", value)}
                  customLabels={COUNTRY_LABELS}
                  searchable
                  searchPlaceholder="Search country"
                  fullWidth
                  showSelectedLabel={false}
                  showOptionLabel
                  showSecondarySelectedLabel
                  showSecondaryOptionLabel
                  selectButtonClassName={cn(
                    "!h-9 !w-full !min-w-0 !rounded-md !border !px-2.5 !py-1.5 !text-sm !shadow-none",
                    draftContactPhoneError ? "!border-destructive" : "!border-input"
                  )}
                  className="w-full min-w-0"
                />
                <Input
                  id="draft-contact-phone"
                  value={draftContact.phoneNumber}
                  className={cn(
                    draftContactPhoneError
                      ? "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
                      : undefined
                  )}
                  onChange={(event) => {
                    updateDraftContactPhone(event.target.value)
                    if (draftContactEmailError) {
                      setDraftContactEmailError("")
                    }
                  }}
                  placeholder="712345678"
                />
              </div>
              {draftContactPhoneError ? (
                <p className="text-xs text-destructive">{draftContactPhoneError}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-contact-email">Email</Label>
              <Input
                id="draft-contact-email"
                type="email"
                value={draftContact.email}
                className={cn(
                  draftContactEmailError
                    ? "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
                    : undefined
                )}
                onChange={(event) => {
                  updateDraftContact("email", event.target.value)
                  if (draftContactEmailError) {
                    setDraftContactEmailError("")
                  }
                  if (draftContactPhoneError) {
                    setDraftContactPhoneError("")
                  }
                }}
                placeholder="user@example.com"
              />
              {draftContactEmailError ? (
                <p className="text-xs text-destructive">{draftContactEmailError}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-contact-notes">Notes (optional)</Label>
              <Input
                id="draft-contact-notes"
                value={draftContact.notes}
                onChange={(event) => updateDraftContact("notes", event.target.value)}
                placeholder="Additional notes"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={draftContact.isPrimary}
                onCheckedChange={(checked) => updateDraftContact("isPrimary", Boolean(checked))}
              />
              Primary contact
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftContact}>
              {editingContactIndex === null ? "Save Contact" : "Update Contact"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
