import Link from "next/link"
import { ArrowRight20Regular, ContactCard48Color, PersonEdit20Regular } from "@fluentui/react-icons"

type EmployeeProfileRequiredStateProps = {
  description: string
  returnLabel: string
  completionNote: string
}

export function EmployeeProfileRequiredState({
  description,
  returnLabel,
  completionNote,
}: EmployeeProfileRequiredStateProps) {
  return (
    <section className="flex min-h-[calc(100svh-11rem)] items-center justify-center px-3 py-6 sm:px-6">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex flex-col items-center gap-5 p-6 sm:gap-6 sm:p-9">
          <div className="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-sky-50 via-blue-50 to-violet-100 ring-1 ring-blue-100 sm:size-32 dark:from-sky-950/40 dark:via-blue-950/40 dark:to-violet-950/50 dark:ring-blue-900">
            <ContactCard48Color className="size-20 sm:size-24" aria-hidden="true" />
          </div>
          <div className="w-full max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              Profile setup needed
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Complete your employee profile to continue
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
            <ol className="mt-5 grid gap-2 text-left text-sm sm:grid-cols-3">
              {["Open your profile", "Complete required details", `Return to ${returnLabel}`].map((step, index) => (
                <li key={step} className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-primary ring-1 ring-border">
                    {index + 1}
                  </span>
                  <span className="text-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col items-center gap-3">
              <Link
                href="/dashboard/me/profile"
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <PersonEdit20Regular aria-hidden="true" />
                Open my profile
                <ArrowRight20Regular aria-hidden="true" />
              </Link>
              <p className="text-xs text-muted-foreground">{completionNote}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
