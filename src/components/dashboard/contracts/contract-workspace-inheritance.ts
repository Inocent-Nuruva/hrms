import { CONTRACT_REF_TOKEN, type ContractDetail } from "@/lib/contracts-api";

/** Identify existing overrides needing an explicit reason without matching names or exposing values. */
export function missingInheritedReasons(contract: ContractDetail): string[] {
  const particulars = contract.particulars ?? {};
  const overrides = (particulars.field_overrides ?? {}) as Record<
    string,
    unknown
  >;
  const reasons = (particulars.override_reasons ?? {}) as Record<
    string,
    unknown
  >;
  const refs = (particulars.refs ?? {}) as Record<string, unknown>;
  const refTokens = CONTRACT_REF_TOKEN as Record<string, string>;
  const keys = [
    ...new Set([
      ...Object.entries(overrides)
        .filter(
          ([key, value]) =>
            (typeof value === "string" && !!value.trim()) ||
            (key === "salary" && contract.salaryHidden && value === null),
        )
        .map(([key]) => key),
      ...Object.entries(refs)
        .filter(([, value]) => typeof value === "number" && value > 0)
        .map(([key]) => refTokens[key])
        .filter(Boolean),
    ]),
  ];
  return keys.filter(
    (key) =>
      !(
        key === "salary" &&
        contract.salaryHidden &&
        contract.salary_override_reason_valid
      ) &&
      (typeof reasons[key] !== "string" ||
        String(reasons[key]).trim().length < 3),
  );
}
