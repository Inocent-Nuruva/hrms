type MobileRecord = Record<string, unknown>;

export type LeaveApprovalNode = {
  id: number | null;
  level: number;
  status: string;
  companyUserId: number | null;
  name: string;
  email: string;
  roleLabel: string;
  actedAt: string;
  comments: string;
  isCurrentLevel: boolean;
};

export type LeaveWorkflowSummary = {
  requestStatus: string;
  currentLevel: number;
  approvals: LeaveApprovalNode[];
  levels: number[];
  pendingNames: string[];
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  totalCount: number;
  progressPercent: number;
  waitingLabel: string;
};

function asRecord(value: unknown): MobileRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MobileRecord)
    : null;
}

function asRecordList(value: unknown): MobileRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is MobileRecord => Boolean(entry));
}

function readString(record: MobileRecord | null, keys: string[]) {
  if (!record) return '';

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return '';
}

function readNumber(record: MobileRecord | null, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function normalizeStatus(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

export function formatLeaveWorkflowStatus(value: string) {
  const cleaned = value.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return 'Pending';
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function leaveWorkflowStatusTone(status: string): 'good' | 'bad' | 'warn' | 'neutral' {
  const normalized = normalizeStatus(status);
  if (['approved', 'completed', 'done'].includes(normalized)) return 'good';
  if (['rejected', 'cancelled', 'canceled', 'declined'].includes(normalized)) return 'bad';
  if (
    normalized.includes('pending') ||
    normalized.includes('awaiting') ||
    normalized.includes('review') ||
    normalized.includes('submitted') ||
    normalized === 'in progress' ||
    normalized === 'open'
  ) {
    return 'warn';
  }
  return 'neutral';
}

function personName(record: MobileRecord | null, fallback = 'Approver') {
  if (!record) return fallback;

  const full = readString(record, ['full_name', 'fullName', 'display_name', 'displayName', 'name']);
  if (full) return full;

  const composed = [readString(record, ['first_name', 'firstName']), readString(record, ['last_name', 'lastName'])]
    .filter(Boolean)
    .join(' ')
    .trim();

  return composed || fallback;
}

export function buildLeaveWorkflowSummary(row: MobileRecord | null): LeaveWorkflowSummary {
  if (!row) {
    return {
      requestStatus: 'unknown',
      currentLevel: 0,
      approvals: [],
      levels: [],
      pendingNames: [],
      approvedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      totalCount: 0,
      progressPercent: 0,
      waitingLabel: 'No workflow data',
    };
  }

  const requestStatus = normalizeStatus(readString(row, ['status']) || 'pending');
  const currentLevel =
    readNumber(row, ['current_approval_level', 'currentApprovalLevel', 'current_level', 'currentLevel']) ??
    (['in review', 'submitted', 'pending'].includes(requestStatus) ? 1 : 0);

  const directApprovals = asRecordList(row.approvals);
  const approvalsSource =
    directApprovals.length > 0
      ? directApprovals
      : (() => {
          const approvalChain = asRecordList(row.approval_chain);
          if (approvalChain.length > 0) return approvalChain;
          return asRecordList(row.approvalChain);
        })();

  const approvals = approvalsSource
    .map((approval) => {
      const approver =
        asRecord(approval.approver) ??
        asRecord(approval.user) ??
        asRecord(approval.company_user) ??
        asRecord(approval.companyUser);
      const level = readNumber(approval, ['approval_level', 'approvalLevel', 'level', 'step']) ?? 0;
      const status = normalizeStatus(readString(approval, ['status']) || 'pending') || 'pending';
      const roleLabel =
        readString(approval, ['approver_type', 'approverType', 'role_name', 'roleName']) ||
        readString(asRecord(approval.role), ['name', 'display_name']) ||
        readString(approver, ['role', 'title', 'job_title', 'jobTitle']) ||
        'Approver';

      return {
        id: readNumber(approval, ['id']),
        level,
        status,
        companyUserId: readNumber(approval, [
          'approver_company_user_id',
          'approverCompanyUserId',
          'assigned_company_user_id',
          'assignedCompanyUserId',
          'company_user_id',
          'companyUserId',
        ]),
        name: personName(approver, 'Approver'),
        email: readString(approver, ['email']).toLowerCase(),
        roleLabel,
        actedAt: readString(approval, ['acted_at', 'actedAt', 'updated_at', 'updatedAt']),
        comments: readString(approval, ['comments', 'comment', 'notes', 'reason']),
        isCurrentLevel: currentLevel > 0 ? level === currentLevel : level === 1,
      } satisfies LeaveApprovalNode;
    })
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));

  const levels = Array.from(new Set(approvals.map((item) => item.level))).sort((a, b) => a - b);
  const pendingAtCurrent = approvals.filter(
    (item) =>
      leaveWorkflowStatusTone(item.status) === 'warn' &&
      (currentLevel > 0 ? item.level === currentLevel : item.isCurrentLevel)
  );
  const pendingNames = pendingAtCurrent.map((item) => item.name).filter(Boolean);
  const approvedCount = approvals.filter((item) => leaveWorkflowStatusTone(item.status) === 'good').length;
  const rejectedCount = approvals.filter((item) => leaveWorkflowStatusTone(item.status) === 'bad').length;
  const pendingCount = approvals.filter((item) => leaveWorkflowStatusTone(item.status) === 'warn').length;
  const totalCount = approvals.length;
  const progressPercent = totalCount <= 0 ? 0 : Math.round((approvedCount / totalCount) * 100);

  let waitingLabel = 'No active approver';
  if (['approved', 'completed'].includes(requestStatus)) {
    waitingLabel = 'Fully approved';
  } else if (['rejected', 'cancelled', 'canceled'].includes(requestStatus)) {
    waitingLabel = formatLeaveWorkflowStatus(requestStatus);
  } else if (pendingNames.length === 1) {
    waitingLabel = `Pending with ${pendingNames[0]}`;
  } else if (pendingNames.length > 1) {
    waitingLabel = `Pending with ${pendingNames[0]} +${pendingNames.length - 1}`;
  } else if (currentLevel > 0) {
    waitingLabel = `Waiting at level ${currentLevel}`;
  }

  return {
    requestStatus,
    currentLevel,
    approvals,
    levels,
    pendingNames,
    approvedCount,
    rejectedCount,
    pendingCount,
    totalCount,
    progressPercent,
    waitingLabel,
  };
}
