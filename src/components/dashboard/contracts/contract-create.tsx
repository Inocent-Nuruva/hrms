"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getEmployeeById,
  listEmployees,
  readStatusFieldErrors,
  type AdminRecord,
} from "@/lib/admin-api";
import {
  createContractDraft,
  errorMessage,
  getContract,
  listContracts,
  listContractTemplateSummaries,
  type ContractRow,
  type ContractDetail,
  type ContractTemplate,
  type ContractType,
} from "@/lib/contracts-api";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";
import { missingInheritedReasons } from "./contract-workspace-inheritance";
import {
  canProvideInheritedReasons,
  ContractInheritedReasons,
} from "./contract-inherited-reasons";

function employeeName(employee: AdminRecord) {
  return (
    [employee.first_name, employee.last_name].filter(Boolean).join(" ") ||
    String(employee.name ?? employee.id)
  );
}

export function ContractCreate({
  token,
  presetEmployeeId,
  fromContractId,
}: {
  token: string;
  presetEmployeeId: number | null;
  fromContractId: number | null;
}) {
  const router = useRouter();
  const [employee, setEmployee] = React.useState<AdminRecord | null>(null);
  const [sourceContract, setSourceContract] =
    React.useState<ContractDetail | null>(null);
  const [inheritedReasons, setInheritedReasons] = React.useState<
    Record<string, string>
  >({});
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<AdminRecord[]>([]);
  const [existing, setExisting] = React.useState<ContractRow[]>([]);
  const [templates, setTemplates] = React.useState<
    Array<Omit<ContractTemplate, "sections">>
  >([]);
  const [type, setType] = React.useState<ContractType>("UNSPECIFIED");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [partTime, setPartTime] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );

  const selectEmployee = React.useCallback(
    async (id: number) => {
      try {
        setError("");
        const [record, contracts] = await Promise.all([
          getEmployeeById(id, token),
          listContracts(token, { employee_id: id, limit: 50 }),
        ]);
        if (!record) throw new Error(m.employeeLoadError);
        setEmployee(record);
        setExisting(
          contracts.data.filter(
            (item) => item.status === "DRAFT" || item.validity === "ACTIVE",
          ),
        );
        const latestEnd = [...contracts.data]
          .sort((a, b) => b.version - a.version)
          .find(
            (item) =>
              item.endDate && ["SIGNED", "SUPERSEDED"].includes(item.status),
          )?.endDate;
        setStart(
          latestEnd
            ? new Date(Date.parse(`${latestEnd}T00:00:00Z`) + 86_400_000)
                .toISOString()
                .slice(0, 10)
            : String(record.hire_date ?? "").slice(0, 10),
        );
        setResults([]);
        setSearch("");
      } catch {
        setError(m.employeeLoadError);
      }
    },
    [token],
  );

  React.useEffect(() => {
    if (presetEmployeeId) void selectEmployee(presetEmployeeId);
  }, [presetEmployeeId, selectEmployee]);
  React.useEffect(() => {
    if (!fromContractId) return;
    let cancelled = false;
    void getContract(token, fromContractId)
      .then((source) => {
        if (cancelled) return;
        setSourceContract(source);
        setType(source.contractType);
        if (!presetEmployeeId) void selectEmployee(source.employeeId);
      })
      .catch(() => {
        if (!cancelled) setError(m.employeeLoadError);
      });
    return () => {
      cancelled = true;
    };
  }, [fromContractId, presetEmployeeId, selectEmployee, token]);
  React.useEffect(() => {
    let cancelled = false;
    listContractTemplateSummaries(token)
      .then((items) => {
        if (!cancelled) setTemplates(items);
      })
      .catch(() => {
        if (!cancelled) setError(m.templateLoadError);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  React.useEffect(() => {
    if (search.trim().length < 2 || employee) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      listEmployees(token, { search: search.trim(), limit: 8 } as never)
        .then((result) => {
          if (!cancelled) setResults(result.rows);
        })
        .catch(() => {
          if (!cancelled) setError(m.employeeSearchError);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [employee, search, token]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employee) {
      setError(m.chooseEmployee);
      return;
    }
    if (fromContractId && !sourceContract) {
      setError(m.loadError);
      return;
    }
    if (!canSupplyReasons) {
      setError(m.reasonRequired);
      return;
    }
    if (!start) {
      setError(m.chooseStart);
      return;
    }
    if (type === "FIXED_TERM" && !end) {
      setError(m.endRequired);
      return;
    }
    if (end && end < start) {
      setError(m.endBeforeStart);
      return;
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const draft = await createContractDraft(token, {
        employee_id: Number(employee.id),
        contract_type: type,
        start_date: start,
        ...(type === "FIXED_TERM" && end ? { end_date: end } : {}),
        mode: "live",
        part_time: partTime,
        ...(fromContractId ? { from_contract_id: fromContractId } : {}),
        ...(missingReasons.length
          ? {
              override_reasons: Object.fromEntries(
                missingReasons.map((key) => [
                  key,
                  inheritedReasons[key].trim(),
                ]),
              ),
            }
          : {}),
      });
      router.replace(`/dashboard/employees/contracts/${draft.id}`);
    } catch (cause) {
      setError(errorMessage(cause, m.createError));
      setFieldErrors(readStatusFieldErrors(cause));
    } finally {
      setBusy(false);
    }
  };
  const template = templates.find((item) => item.contract_type === type);
  const missingReasons = sourceContract
    ? missingInheritedReasons(sourceContract)
    : [];
  const canSupplyReasons =
    !sourceContract ||
    canProvideInheritedReasons(sourceContract, inheritedReasons);
  return (
    <form
      onSubmit={create}
      className="grid max-w-2xl gap-4 rounded-lg border border-border bg-background p-4"
    >
      <h1 className="text-xl font-semibold">{m.newContract}</h1>
      <label className="grid gap-1">
        {m.employee}
        {employee ? (
          <span>
            {employeeName(employee)} · {String(employee.employee_no ?? "")}
            {!presetEmployeeId && !fromContractId && (
              <button
                type="button"
                className="ml-2 text-primary underline"
                onClick={() => {
                  setEmployee(null);
                  setExisting([]);
                }}
              >
                {m.changeEmployee}
              </button>
            )}
          </span>
        ) : (
          <input
            className="rounded border border-border bg-background p-2"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={m.employeeSearch}
          />
        )}
      </label>
      {results.length > 0 && (
        <ul className="grid gap-1 rounded border border-border p-2">
          {results.map((row) => (
            <li key={String(row.id)}>
              <button
                type="button"
                className="w-full p-2 text-left hover:bg-muted"
                onClick={() => void selectEmployee(Number(row.id))}
              >
                {employeeName(row)} · {String(row.employee_no ?? "")} ·{" "}
                {String(row.position_name ?? "")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {existing.length > 0 && (
        <div className="rounded border border-border p-3">
          <p>{m.existingContracts}</p>
          <ul>
            {existing.map((row) => (
              <li key={row.id}>
                <Link
                  className="text-primary underline"
                  href={`/dashboard/employees/contracts/${row.id}`}
                >
                  {row.referenceNo} · {row.status}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sourceContract ? (
        <ContractInheritedReasons
          contract={sourceContract}
          reasons={inheritedReasons}
          onChange={(key, value) =>
            setInheritedReasons((current) => ({ ...current, [key]: value }))
          }
        />
      ) : null}
      <label className="grid gap-1">
        {m.contractType}
        <select
          className="rounded border border-border bg-background p-2"
          value={type}
          onChange={(event) => setType(event.target.value as ContractType)}
        >
          {Object.entries(m.contractTypes).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        {m.template}
        <select
          aria-label={m.template}
          className="rounded border border-border bg-background p-2"
          value={template?.id ?? "default"}
          disabled
        >
          <option value={template?.id ?? "default"}>
            {template?.title ?? m.defaultTemplate}
          </option>
        </select>
      </label>
      <label className="grid gap-1">
        {m.startDate}
        <input
          className="rounded border border-border bg-background p-2"
          type="date"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
      </label>
      {type === "FIXED_TERM" && (
        <label className="grid gap-1">
          {m.endDate}
          <input
            className="rounded border border-border bg-background p-2"
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
      )}
      <label>
        <input
          type="checkbox"
          checked={partTime}
          onChange={(event) => setPartTime(event.target.checked)}
        />{" "}
        {m.partTime}
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {Object.keys(fieldErrors).length ? (
        <ul role="alert" className="text-destructive">
          {Object.entries(fieldErrors).map(([key, message]) => (
            <li key={key}>
              {m.label(key)}: {message}
            </li>
          ))}
        </ul>
      ) : null}
      <button
        className="w-fit rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        disabled={
          busy || (!!fromContractId && !sourceContract) || !canSupplyReasons
        }
        type="submit"
      >
        {busy ? m.creatingDraft : m.createDraft}
      </button>
    </form>
  );
}
