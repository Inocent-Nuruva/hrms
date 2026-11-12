"use client";

import * as React from "react";
import {
  getContractFields,
  resolveContractDraftFields,
  getContractReadiness,
  updateContractDraft,
  type ContractDetail,
  type ContractField,
  type ContractReadiness,
  type ContractSection,
} from "@/lib/contracts-api";
import { ContractSaveQueue } from "./contract-workspace-save-queue";
import { serializeLegacyChanges } from "./contract-workspace-adapters";
export { LEGACY_FIELDS } from "./contract-workspace-adapters";

export const DIRECT_FIELDS = [
  "contract_type",
  "start_date",
  "end_date",
  "place_of_recruitment",
  "job_description",
  "benefits",
  "task_description",
  "probation_months",
  "title",
] as const;
export type DirectField = (typeof DIRECT_FIELDS)[number];
const REF_TOKENS: Record<string, string> = {
  department_id: "department",
  position_id: "job_title",
  grade_id: "grade",
  branch_id: "work_location",
  reports_to_id: "reporting_manager",
};
type DraftState = {
  values: Record<DirectField, string>;
  legacyValues: Record<string, string>;
  probationReason: string;
  overrides: Record<string, string>;
  refs: Record<string, number | null>;
  reasons: Record<string, string>;
  sections: ContractSection[];
  signatoryId: number | null;
  revisions: Record<string, number>;
  sequence: number;
};

/** Build a partial draft patch without silently changing stored overrides. */
export function directDraftBody(state: DraftState, contract: ContractDetail) {
  const body: Record<string, unknown> = {};
  const overrides: Record<string, string> = {};
  const reasons: Record<string, string> = {};
  const included: string[] = [];
  let issue: string | null = null;
  if (contract.particulars?.mode !== "live") {
    return serializeLegacyChanges(state, contract);
  }
  for (const key of DIRECT_FIELDS) {
    if (state.revisions[key] === undefined) continue;
    const value = state.values[key];
    if (key === "probation_months") {
      if (value && (!/^\d+$/.test(value) || Number(value) > 24)) {
        issue = "probation_range";
        continue;
      }
      if (value && state.probationReason.trim().length < 3) {
        issue = "reason_required";
        continue;
      }
      overrides[key] = value;
      if (value) reasons[key] = state.probationReason.trim();
    } else {
      body[key] = key === "end_date" ? value || null : value;
      if (key === "contract_type" && value === "UNSPECIFIED") {
        body.end_date = null;
      }
    }
    included.push(key);
  }
  const refs: Record<string, number | null> = {};
  for (const key of Object.keys(state.revisions)) {
    if (key === "sections") {
      body.sections = state.sections;
      included.push(key);
    } else if (key === "signatory") {
      body.assigned_signatory_id = state.signatoryId;
      included.push(key);
    } else if (key.startsWith("override:")) {
      const token = key.slice(9);
      const value = state.overrides[token] ?? "";
      const reason = state.reasons[token] ?? "";
      if (value.trim() && reason.trim().length < 3) {
        issue = "reason_required";
        continue;
      }
      if (
        token === "salary" &&
        value &&
        !/^\d{1,12}(\.\d{1,2})?$/.test(value)
      ) {
        issue = "salary_format";
        continue;
      }
      if (token === "currency" && value && !/^[A-Z]{3}$/.test(value)) {
        issue = "currency_format";
        continue;
      }
      overrides[token] = value;
      if (value.trim()) reasons[token] = reason.trim();
      included.push(key);
    } else if (key.startsWith("ref:")) {
      const ref = key.slice(4);
      const token = REF_TOKENS[ref];
      const value = state.refs[ref] ?? null;
      const reason = state.reasons[token] ?? "";
      if (value !== null && reason.trim().length < 3) {
        issue = "reason_required";
        continue;
      }
      refs[ref] = value;
      if (value !== null) reasons[token] = reason.trim();
      included.push(key);
    }
  }
  if (state.values.contract_type === "FIXED_TERM" && !state.values.end_date)
    return {
      body: {},
      included: [] as DirectField[],
      issue: "end_date_required",
    };
  if (
    state.values.end_date &&
    state.values.start_date &&
    state.values.end_date < state.values.start_date
  )
    return {
      body: {},
      included: [] as DirectField[],
      issue: "end_before_start",
    };
  if (Object.keys(overrides).length) body.field_overrides = overrides;
  if (Object.keys(reasons).length) body.override_reasons = reasons;
  if (Object.keys(refs).length) body.refs = refs;
  return { body, included, issue };
}

export function useContractDirectFields(
  token: string,
  contract: ContractDetail,
  initialFields: ContractField[] | null,
  onResolved: (fields: ContractField[]) => void,
  onReadiness?: (readiness: ContractReadiness) => void,
) {
  const [state, setState] = React.useState<DraftState | null>(null);
  const [status, setStatus] = React.useState<
    "saved" | "dirty" | "saving" | "error"
  >("saved");
  const [savedAt, setSavedAt] = React.useState(() =>
    Number.isFinite(Date.parse(contract.updatedAt))
      ? Date.parse(contract.updatedAt)
      : Date.now(),
  );
  const [issue, setIssue] = React.useState<string | null>(null);
  const [resolutionFailed, setResolutionFailed] = React.useState(false);
  const [readinessFailed, setReadinessFailed] = React.useState(false);
  const stateRef = React.useRef<DraftState | null>(null);
  const queueRef = React.useRef<ContractSaveQueue<DraftState> | null>(null);
  const resolvedRef = React.useRef(onResolved);
  const readinessRef = React.useRef(onReadiness);
  React.useEffect(() => { resolvedRef.current = onResolved; readinessRef.current = onReadiness; }, [onResolved, onReadiness]);
  React.useEffect(() => {
    if (!initialFields || stateRef.current || contract.status !== "DRAFT")
      return;
    const value = (key: string) =>
      initialFields.find((item) => item.key === key)?.value ?? "";
    const probation = initialFields.find(
      (item) => item.key === "probation_months",
    );
    const particulars = contract.particulars ?? {};
    const initial: DraftState = {
      values: {
        contract_type: contract.contractType,
        start_date: value("start_date") || contract.startDate,
        end_date: value("end_date"),
        place_of_recruitment: value("place_of_recruitment"),
        job_description: value("job_description"),
        benefits: value("benefits"),
        task_description: value("task_description"),
        probation_months: value("probation_months"),
        title: contract.title,
      },
      legacyValues: {
        ...Object.fromEntries(
          initialFields.map((field) => [field.key, field.value ?? ""]),
        ),
        contract_type: contract.contractType,
        title: contract.title,
      },
      probationReason: probation?.override_reason ?? "",
      overrides: {
        ...((particulars.field_overrides ?? {}) as Record<string, string>),
      },
      refs: { ...((particulars.refs ?? {}) as Record<string, number | null>) },
      reasons: {
        ...((particulars.override_reasons ?? {}) as Record<string, string>),
      },
      sections: contract.sections.length
        ? contract.sections
        : (contract.effective_draft_sections ?? []),
      signatoryId: contract.assignedSignatoryId,
      revisions: {},
      sequence: 0,
    };
    stateRef.current = initial;
    setState(initial);
    queueRef.current = new ContractSaveQueue(
      contract.updatedAt,
      () => structuredClone(stateRef.current!),
      async (snapshot, updatedAt) => {
        const {
          body,
          included,
          issue: validation,
        } = directDraftBody(snapshot, contract);
        if (!included.length) {
          setIssue(validation);
          setStatus("dirty");
          return { updatedAt };
        }
        setStatus("saving");
        const saved = await updateContractDraft(token, contract.id, {
          ...body,
          expected_updated_at: updatedAt,
        });
        const current = stateRef.current!;
        const revisions = { ...current.revisions };
        const overrides = { ...current.overrides };
        for (const key of included)
          if (revisions[key] === snapshot.revisions[key]) {
            if (key.startsWith("legacy:")) {
              const tokenName = key.slice(7);
              if (snapshot.overrides[tokenName])
                overrides[tokenName] = snapshot.legacyValues[tokenName] ?? "";
            }
            delete revisions[key];
          }
        const next = { ...current, revisions, overrides };
        stateRef.current = next;
        setState(next);
        setIssue(validation);
        setStatus(Object.keys(revisions).length ? "dirty" : "saved");
        setSavedAt(Date.now());
        if (!Object.keys(revisions).length)
          void getContractFields(token, contract.id)
            .then((result) => {
              const latest = stateRef.current;
              if (
                !latest ||
                latest.sequence !== next.sequence ||
                Object.keys(latest.revisions).length
              )
                return;
              setResolutionFailed(false);
              const values = { ...latest.values };
              for (const key of DIRECT_FIELDS) {
                if (key === "contract_type") continue;
                const value = result.find((field) => field.key === key)?.value;
                if (value !== undefined) values[key] = value;
              }
              const legacyValues = { ...latest.legacyValues };
              for (const field of result)
                if (field.key !== "contract_type")
                  legacyValues[field.key] = field.value ?? "";
              const normalized = { ...latest, values, legacyValues };
              stateRef.current = normalized;
              setState(normalized);
              resolvedRef.current(result);
            })
            .catch(() => {
              if (stateRef.current?.sequence === next.sequence)
                setResolutionFailed(true);
            });
        if (!Object.keys(revisions).length)
          void getContractReadiness(token, contract.id, {})
            .then((result) => {
              const latest = stateRef.current;
              if (
                latest &&
                latest.sequence === next.sequence &&
                !Object.keys(latest.revisions).length
              ) {
                setReadinessFailed(false);
                readinessRef.current?.(result);
              }
            })
            .catch(() => {
              if (stateRef.current?.sequence === next.sequence)
                setReadinessFailed(true);
            });
        return { updatedAt: saved.updatedAt };
      },
    );
  }, [initialFields, contract, token]);
  const update = React.useCallback((key: DirectField, value: string) => {
    const current = stateRef.current;
    if (!current) return;
    const sequence = current.sequence + 1;
    const next = {
      ...current,
      sequence,
      values: { ...current.values, [key]: value },
      revisions: { ...current.revisions, [key]: sequence },
    };
    stateRef.current = next;
    setState(next);
    setStatus("dirty");
    setIssue(null);
    queueRef.current?.changed();
  }, []);
  const updateLegacy = React.useCallback((key: string, value: string) => {
    const current = stateRef.current;
    if (!current) return;
    const sequence = current.sequence + 1;
    const next = {
      ...current,
      sequence,
      legacyValues: { ...current.legacyValues, [key]: value },
      revisions: { ...current.revisions, [`legacy:${key}`]: sequence },
    };
    stateRef.current = next;
    setState(next);
    setStatus("dirty");
    setIssue(null);
    queueRef.current?.changed();
  }, []);
  const updateReason = React.useCallback((reason: string) => {
    const current = stateRef.current;
    if (!current) return;
    const sequence = current.sequence + 1;
    const next = {
      ...current,
      sequence,
      probationReason: reason,
      revisions: { ...current.revisions, probation_months: sequence },
    };
    stateRef.current = next;
    setState(next);
    setStatus("dirty");
    setIssue(null);
    queueRef.current?.changed();
  }, []);
  const resetProbation = React.useCallback((automatic: string) => {
    const current = stateRef.current;
    if (!current) return;
    const sequence = current.sequence + 1;
    const revisions: Record<string, number> = {
      ...current.revisions,
      "override:probation_months": sequence,
    };
    delete revisions.probation_months;
    const next = {
      ...current,
      sequence,
      values: { ...current.values, probation_months: automatic },
      probationReason: "",
      overrides: { ...current.overrides, probation_months: "" },
      revisions,
    };
    stateRef.current = next;
    setState(next);
    setStatus("dirty");
    setIssue(null);
    queueRef.current?.changed();
  }, []);
  const updateOverride = React.useCallback(
    (key: string, value: string, reason?: string) => {
      const current = stateRef.current;
      if (!current) return;
      const sequence = current.sequence + 1;
      const next = {
        ...current,
        sequence,
        overrides: { ...current.overrides, [key]: value },
        reasons:
          reason === undefined
            ? current.reasons
            : { ...current.reasons, [key]: reason },
        revisions: { ...current.revisions, [`override:${key}`]: sequence },
      };
      stateRef.current = next;
      setState(next);
      setStatus("dirty");
      setIssue(null);
      queueRef.current?.changed();
    },
    [],
  );
  const updateReference = React.useCallback(
    (ref: string, value: number | null, reason?: string) => {
      const current = stateRef.current;
      if (!current) return;
      const sequence = current.sequence + 1;
      const tokenName = REF_TOKENS[ref];
      const next = {
        ...current,
        sequence,
        refs: { ...current.refs, [ref]: value },
        reasons:
          reason === undefined
            ? current.reasons
            : { ...current.reasons, [tokenName]: reason },
        revisions: { ...current.revisions, [`ref:${ref}`]: sequence },
      };
      stateRef.current = next;
      setState(next);
      setStatus("dirty");
      setIssue(null);
      queueRef.current?.changed();
    },
    [],
  );
  const updateSections = React.useCallback((sections: ContractSection[]) => {
    const current = stateRef.current;
    if (!current) return;
    const sequence = current.sequence + 1;
    const next = {
      ...current,
      sequence,
      sections,
      revisions: { ...current.revisions, sections: sequence },
    };
    stateRef.current = next;
    setState(next);
    setStatus("dirty");
    queueRef.current?.changed();
  }, []);
  const updateSignatory = React.useCallback((signatoryId: number | null) => {
    const current = stateRef.current;
    if (!current) return;
    const sequence = current.sequence + 1;
    const next = {
      ...current,
      sequence,
      signatoryId,
      revisions: { ...current.revisions, signatory: sequence },
    };
    stateRef.current = next;
    setState(next);
    setStatus("dirty");
    queueRef.current?.changed();
  }, []);
  React.useEffect(() => {
    if (!state || !Object.keys(state.revisions).length) return;
    const {
      body,
      included,
      issue: validation,
    } = directDraftBody(state, contract);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIssue(validation);
      if (included.length) {
        void resolveContractDraftFields(token, contract.id, body)
          .then((result) => {
            if (!cancelled) {
              const current = stateRef.current;
              if (current) {
                const values = { ...current.values };
                const legacyValues = { ...current.legacyValues };
                let changed = false;
                for (const field of result) {
                  const revision = `override:${field.key}`;
                  if (
                    state.revisions[revision] === undefined ||
                    current.revisions[revision] !== state.revisions[revision] ||
                    current.overrides[field.key]
                  )
                    continue;
                  if (
                    field.key in values &&
                    values[field.key as DirectField] !== field.value
                  ) {
                    values[field.key as DirectField] = field.value;
                    changed = true;
                  }
                  if (legacyValues[field.key] !== field.value) {
                    legacyValues[field.key] = field.value;
                    changed = true;
                  }
                }
                if (changed) {
                  const next = { ...current, values, legacyValues };
                  stateRef.current = next;
                  setState(next);
                }
              }
              resolvedRef.current(result);
              setResolutionFailed(false);
            }
          })
          .catch(() => {
            if (!cancelled) setResolutionFailed(true);
          });
        void getContractReadiness(token, contract.id, body)
          .then((result) => {
            if (!cancelled) {
              setReadinessFailed(false);
              readinessRef.current?.(result);
            }
          })
          .catch(() => {
            if (!cancelled) setReadinessFailed(true);
          });
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, contract, token]);
  React.useEffect(() => {
    if (!state || !Object.keys(state.revisions).length) return;
    const timer = window.setTimeout(() => {
      void queueRef.current?.flush().catch((cause) => {
        setStatus("error");
        setIssue(
          (cause as { status?: number }).status === 409
            ? "conflict"
            : "save_error",
        );
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [state]);
  const flush = React.useCallback(async () => {
    const current = stateRef.current;
    if (!current) return false;
    const check = directDraftBody(current, contract);
    if (check.issue) {
      setIssue(check.issue);
      if (check.included.length) {
        try {
          await queueRef.current?.flush();
        } catch (cause) {
          setStatus("error");
          setIssue(
            (cause as { status?: number }).status === 409
              ? "conflict"
              : "save_error",
          );
        }
      }
      return false;
    }
    try {
      const saved = await queueRef.current?.flush();
      return !!saved && !Object.keys(stateRef.current?.revisions ?? {}).length;
    } catch (cause) {
      setStatus("error");
      setIssue(
        (cause as { status?: number }).status === 409
          ? "conflict"
          : "save_error",
      );
      return false;
    }
  }, [contract]);
  const previewBody = React.useCallback(
    () =>
      stateRef.current ? directDraftBody(stateRef.current, contract).body : {},
    [contract],
  );
  const retryResolution = React.useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const sequence = current.sequence;
    const body = directDraftBody(current, contract).body;
    void resolveContractDraftFields(token, contract.id, body)
      .then((result) => {
        if (stateRef.current?.sequence === sequence) {
          setResolutionFailed(false);
          resolvedRef.current(result);
        }
      })
      .catch(() => {
        if (stateRef.current?.sequence === sequence) setResolutionFailed(true);
      });
    void getContractReadiness(token, contract.id, body)
      .then((result) => {
        if (stateRef.current?.sequence === sequence) {
          setReadinessFailed(false);
          readinessRef.current?.(result);
        }
      })
      .catch(() => {
        if (stateRef.current?.sequence === sequence) setReadinessFailed(true);
      });
  }, [token, contract]);
  const reapply = React.useCallback(
    async (latest: ContractDetail, latestFields: ContractField[]) => {
      const current = stateRef.current;
      const queue = queueRef.current;
      if (!current || !queue) return false;
      const values = { ...current.values };
      const legacyValues = { ...current.legacyValues };
      for (const field of latestFields) {
        const value =
          field.key === "contract_type"
            ? latest.contractType
            : (field.value ?? "");
        if (field.key in values && current.revisions[field.key] === undefined)
          values[field.key as DirectField] = value;
        if (
          current.revisions[`legacy:${field.key}`] === undefined &&
          current.revisions[`override:${field.key}`] === undefined
        )
          legacyValues[field.key] = value;
      }
      if (current.revisions.title === undefined) values.title = latest.title;
      if (current.revisions["legacy:title"] === undefined)
        legacyValues.title = latest.title;
      const latestOverrides = (latest.particulars?.field_overrides ??
        {}) as Record<string, string>;
      const latestRefs = (latest.particulars?.refs ?? {}) as Record<
        string,
        number | null
      >;
      const latestReasons = (latest.particulars?.override_reasons ??
        {}) as Record<string, string>;
      const overrides = { ...current.overrides };
      const refs = { ...current.refs };
      const reasons = { ...current.reasons };
      for (const key of new Set([
        ...Object.keys(overrides),
        ...Object.keys(latestOverrides),
      ])) {
        if (
          current.revisions[`override:${key}`] === undefined &&
          current.revisions[`legacy:${key}`] === undefined &&
          !(
            key === "probation_months" &&
            current.revisions.probation_months !== undefined
          )
        ) {
          if (latestOverrides[key] !== undefined)
            overrides[key] = latestOverrides[key];
          else delete overrides[key];
          if (latestReasons[key] !== undefined)
            reasons[key] = latestReasons[key];
          else delete reasons[key];
        }
      }
      for (const key of new Set([
        ...Object.keys(refs),
        ...Object.keys(latestRefs),
      ])) {
        if (current.revisions[`ref:${key}`] === undefined) {
          if (latestRefs[key] !== undefined) refs[key] = latestRefs[key];
          else delete refs[key];
          const tokenName = REF_TOKENS[key];
          if (
            tokenName &&
            current.revisions[`override:${tokenName}`] === undefined
          ) {
            if (latestReasons[tokenName] !== undefined)
              reasons[tokenName] = latestReasons[tokenName];
            else delete reasons[tokenName];
          }
        }
      }
      const next = {
        ...current,
        values,
        legacyValues,
        overrides,
        refs,
        reasons,
        sections:
          current.revisions.sections === undefined
            ? latest.sections
            : current.sections,
        signatoryId:
          current.revisions.signatory === undefined
            ? latest.assignedSignatoryId
            : current.signatoryId,
      };
      stateRef.current = next;
      setState(next);
      queue.rebase(latest.updatedAt);
      setIssue(null);
      return flush();
    },
    [flush],
  );
  return {
    state,
    status,
    savedAt,
    issue,
    resolutionFailed,
    readinessFailed,
    retryResolution,
    update,
    updateLegacy,
    updateReason,
    resetProbation,
    updateOverride,
    updateReference,
    updateSections,
    updateSignatory,
    flush,
    previewBody,
    reapply,
  };
}
