"use client"

import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { PageShell, PageShellBody, PageShellHeader } from "@/components/dashboard/page-shell"

/** Probation letter templates now live in Employees → Letters → Templates. */
export default function ProbationLetterTemplates() {
  return (
    <PageShell>
      <PageShellHeader
        title="Probation letter templates"
        description="Confirmation, extension and non-confirmation letters are now managed with all other employee letters."
      />
      <PageShellBody>
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            The probation templates were merged into the Letters module. Probation outcomes still generate their letters
            automatically from the default template of each type.
          </p>
          <Link
            href="/dashboard/employees/letters?tab=templates&type=CONFIRMATION"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium !text-white hover:bg-primary/90"
          >
            Open letter templates
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </PageShellBody>
    </PageShell>
  )
}
