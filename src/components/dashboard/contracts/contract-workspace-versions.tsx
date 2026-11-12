"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ContractDetail, type ContractRow } from "@/lib/contracts-api";
import { loadContractVersions } from "./contract-workspace-version-data";
import { ContractStatusBadge } from "./contract-ui";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";

export function ContractWorkspaceVersions({
  token,
  contract,
  onCompare,
}: {
  token: string;
  contract: ContractDetail;
  onCompare?: () => void;
}) {
  const [rows, setRows] = React.useState<ContractRow[] | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    loadContractVersions(token, contract.employeeId)
      .then((items) => {
        if (!cancelled) setRows(items.sort((a, b) => b.version - a.version));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, contract.employeeId, contract.updatedAt]);
  const self = usePathname()?.startsWith("/dashboard/me/") ?? false;
  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="font-semibold">{m.versions}</h2>
      {contract.status !== "DRAFT" ? (
        <a
          className="text-primary underline"
          href="#contract-version-compare"
          onClick={(event) => {
            event.preventDefault();
            onCompare?.();
            requestAnimationFrame(() =>
              document
                .getElementById("contract-version-compare")
                ?.scrollIntoView({ block: "center" }),
            );
          }}
        >
          {m.compareVersions}
        </a>
      ) : null}
      {error ? (
        <p>{m.versionsUnavailable}</p>
      ) : !rows ? (
        <p>{m.loading}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                className="text-primary underline"
                href={
                  self
                    ? `/dashboard/me/contracts/${row.id}`
                    : `/dashboard/employees/contracts/${row.id}`
                }
              >
                {m.version} {row.version}
              </Link>{" "}
              <ContractStatusBadge status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
