"use client";

import { Link } from "@fluentui/react-components";
import { FluentNotice } from "@/components/dashboard/fluent-notice";

export function WorkflowGuide({
  title,
  steps,
  unavailable,
  action,
}: {
  title: string;
  steps: readonly string[];
  unavailable?: string | null;
  action?: { href: string; label: string };
}) {
  return (
    <FluentNotice>
      <strong>{unavailable ? `${title}: action needed` : title}</strong>
      <div>
        {unavailable ? <p>{unavailable}</p> : null}
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {action ? <Link href={action.href}>{action.label}</Link> : null}
      </div>
    </FluentNotice>
  );
}
