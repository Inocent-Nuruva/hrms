type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null;
}

/** Pull backup codes from 2FA setup / regenerate payloads. */
export function extractBackupCodes(payload: unknown): string[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const candidates = [
    data?.backup_codes,
    data?.backupCodes,
    data?.recovery_codes,
    data?.recoveryCodes,
    data?.codes,
    root?.backup_codes,
    root?.backupCodes,
    root?.recovery_codes,
    root?.recoveryCodes,
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return [];
}
