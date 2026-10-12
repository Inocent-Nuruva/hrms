type MobileRecord = Record<string, unknown>;

export type NotificationDestinationPath =
  | '/(tabs)/attendance'
  | '/(tabs)/home'
  | '/(tabs)/leave'
  | '/(tabs)/profile'
  | '/activities'
  | '/my-attendance';

export type NotificationDestination = {
  pathname: NotificationDestinationPath;
  params?: Record<string, string>;
};

export function asNotificationRecord(value: unknown): MobileRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MobileRecord)
    : null;
}

export function readNotificationString(value: unknown, keys: string[]) {
  const record = asNotificationRecord(value);
  if (!record) return '';

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
  }

  return '';
}

function normalizeHint(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function parseActionUrl(value: string) {
  const rawValue = value.trim();
  if (!rawValue) return null;

  try {
    const parsed = rawValue.startsWith('/')
      ? new URL(rawValue, 'https://hrms.local')
      : new URL(rawValue);

    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    return {
      parsed,
      normalizedPath: parsed.pathname.toLowerCase().replace(/\/+$/, '') || '/',
    };
  } catch {
    return null;
  }
}

function compactParams(params: Record<string, string | undefined>): Record<string, string> | undefined {
  const entries = Object.entries(params).filter(([, value]) => typeof value === 'string' && value.trim());
  return entries.length ? Object.fromEntries(entries) as Record<string, string> : undefined;
}

function buildDestination(
  pathname: NotificationDestinationPath,
  params: Record<string, string | undefined> = {}
): NotificationDestination {
  return {
    pathname,
    params: compactParams(params),
  };
}

function resolveLeaveRequestId(row: MobileRecord, metadata: MobileRecord | null, actionUrl?: string) {
  const actionRequestId = actionUrl
    ? parseActionUrl(actionUrl)?.parsed.searchParams.get('requestId') ||
      parseActionUrl(actionUrl)?.parsed.searchParams.get('request_id') ||
      parseActionUrl(actionUrl)?.parsed.searchParams.get('id')
    : '';

  return (
    readNotificationString(row, ['entity_id', 'entityId', 'request_id', 'requestId']) ||
    readNotificationString(metadata, ['entity_id', 'entityId', 'request_id', 'requestId', 'leave_request_id', 'leaveRequestId']) ||
    readNotificationString(asNotificationRecord(metadata?.request), ['id', 'request_id', 'requestId']) ||
    (actionRequestId ? String(actionRequestId) : '')
  );
}

function normalizeDateValue(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function resolveAttendanceDate(row: MobileRecord, metadata: MobileRecord | null, actionUrl?: string) {
  const parsedAction = actionUrl ? parseActionUrl(actionUrl) : null;
  const actionDate =
    parsedAction?.parsed.searchParams.get('date') ||
    parsedAction?.parsed.searchParams.get('attendanceDate') ||
    parsedAction?.parsed.searchParams.get('attendance_date') ||
    '';

  return (
    normalizeDateValue(actionDate) ||
    normalizeDateValue(readNotificationString(row, ['attendance_date', 'attendanceDate', 'date', 'work_date', 'workDate'])) ||
    normalizeDateValue(
      readNotificationString(metadata, ['attendance_date', 'attendanceDate', 'date', 'work_date', 'workDate'])
    )
  );
}

function readArrayText(value: unknown) {
  if (!Array.isArray(value)) return '';
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      return readNotificationString(entry, ['name', 'label', 'key', 'field', 'field_name', 'fieldName']);
    })
    .filter(Boolean)
    .join(' ');
}

function resolveProfileSection(row: MobileRecord, metadata: MobileRecord | null) {
  const sectionHints = normalizeHint(
    [
      readNotificationString(row, ['section', 'profile_section', 'profileSection']),
      readNotificationString(metadata, ['section', 'profile_section', 'profileSection', 'changed_section', 'changedSection']),
      readNotificationString(metadata, ['field', 'field_name', 'fieldName', 'change_type', 'changeType']),
      readArrayText(metadata?.fields),
      readArrayText(metadata?.field_names),
      readArrayText(metadata?.fieldNames),
      readArrayText(metadata?.changed_fields),
      readArrayText(metadata?.changedFields),
      readArrayText(metadata?.updated_fields),
      readArrayText(metadata?.updatedFields),
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (
    sectionHints.includes('branch') ||
    sectionHints.includes('department') ||
    sectionHints.includes('position') ||
    sectionHints.includes('work')
  ) {
    return 'work';
  }

  if (
    sectionHints.includes('bank') ||
    sectionHints.includes('account') ||
    sectionHints.includes('identification') ||
    sectionHints.includes('record') ||
    sectionHints.includes('tin') ||
    sectionHints.includes('nssf') ||
    sectionHints.includes('nhif') ||
    sectionHints.includes('passport') ||
    sectionHints.includes('national id')
  ) {
    return 'records';
  }

  return 'personal';
}

function resolveFromActionUrl(
  row: MobileRecord,
  metadata: MobileRecord | null,
  actionUrl: string
): NotificationDestination | null {
  const parsedAction = parseActionUrl(actionUrl);
  if (!parsedAction) return null;
  if (parsedAction.normalizedPath.startsWith('/api/')) return null;

  const requestId = resolveLeaveRequestId(row, metadata, actionUrl);
  const attendanceDate = resolveAttendanceDate(row, metadata, actionUrl);

  if (
    parsedAction.normalizedPath === '/leave' ||
    parsedAction.normalizedPath.startsWith('/leave/') ||
    parsedAction.normalizedPath === '/dashboard/leave-management/requests/review' ||
    parsedAction.normalizedPath === '/dashboard/leave-management/requests' ||
    parsedAction.normalizedPath === '/dashboard/me/leave/requests'
  ) {
    return buildDestination('/(tabs)/leave', { tab: 'requests', requestId });
  }

  if (
    parsedAction.normalizedPath === '/dashboard/leave-management/balances' ||
    parsedAction.normalizedPath === '/dashboard/me/leave/balances'
  ) {
    return buildDestination('/(tabs)/leave', { tab: 'balances' });
  }

  if (
    parsedAction.normalizedPath === '/dashboard/leave-management/holidays' ||
    parsedAction.normalizedPath === '/dashboard/me/leave/holidays'
  ) {
    return buildDestination('/(tabs)/leave', { tab: 'holidays' });
  }

  if (
    parsedAction.normalizedPath === '/dashboard/leave-management/policies' ||
    parsedAction.normalizedPath === '/dashboard/me/leave/policies'
  ) {
    return buildDestination('/(tabs)/leave', { tab: 'policies' });
  }

  if (
    parsedAction.normalizedPath === '/attendance/corrections' ||
    parsedAction.normalizedPath.startsWith('/attendance/corrections/') ||
    parsedAction.normalizedPath === '/attendance/correction-requests' ||
    parsedAction.normalizedPath.startsWith('/attendance/correction-requests/') ||
    parsedAction.normalizedPath === '/dashboard/attendance/correction-requests' ||
    parsedAction.normalizedPath.startsWith('/dashboard/attendance/correction-requests/') ||
    parsedAction.normalizedPath === '/dashboard/me/attendance' ||
    parsedAction.normalizedPath.startsWith('/dashboard/me/attendance/')
  ) {
    return buildDestination('/my-attendance', { date: attendanceDate });
  }

  if (
    parsedAction.normalizedPath === '/profile-update-approvals' ||
    parsedAction.normalizedPath.startsWith('/profile-update-approvals/') ||
    parsedAction.normalizedPath === '/dashboard/employees/profile-update-approvals' ||
    parsedAction.normalizedPath.startsWith('/dashboard/employees/profile-update-approvals/') ||
    parsedAction.normalizedPath === '/dashboard/me/profile'
  ) {
    return buildDestination('/(tabs)/profile', { section: resolveProfileSection(row, metadata) });
  }

  if (parsedAction.normalizedPath === '/dashboard' || parsedAction.normalizedPath.startsWith('/dashboard/')) {
    return buildDestination('/(tabs)/home');
  }

  return null;
}

export function resolveNotificationDestination(row: MobileRecord): NotificationDestination {
  const metadata = asNotificationRecord(row.metadata);
  const actionUrl = readNotificationString(row, ['action_url', 'actionUrl', 'url', 'href']);
  const requestId = resolveLeaveRequestId(row, metadata, actionUrl);
  const attendanceDate = resolveAttendanceDate(row, metadata, actionUrl);
  const hintValues = [
    readNotificationString(row, ['entity_type', 'entityType', 'type', 'related_module', 'relatedModule', 'category']),
    readNotificationString(metadata, ['entity_type', 'entityType', 'type', 'related_module', 'relatedModule', 'category']),
    readNotificationString(row, ['title', 'subject']),
    readNotificationString(row, ['message', 'body', 'content', 'description']),
  ]
    .map((value) => normalizeHint(value))
    .filter(Boolean);

  if (hintValues.some((value) => /daily activity|activity report/.test(value))) {
    return buildDestination('/activities', { view: 'reports' });
  }

  if (actionUrl) {
    const actionDestination = resolveFromActionUrl(row, metadata, actionUrl);
    if (actionDestination) return actionDestination;
  }

  if (hintValues.some((value) => /daily activity|activity report/.test(value))) {
    return buildDestination('/activities', { view: 'reports' });
  }

  if (hintValues.some((value) => value.includes('leave balance'))) {
    return buildDestination('/(tabs)/leave', { tab: 'balances' });
  }

  if (hintValues.some((value) => value.includes('holiday'))) {
    return buildDestination('/(tabs)/leave', { tab: 'holidays' });
  }

  if (hintValues.some((value) => value.includes('leave polic'))) {
    return buildDestination('/(tabs)/leave', { tab: 'policies' });
  }

  if (hintValues.some((value) => value.includes('leave'))) {
    return buildDestination('/(tabs)/leave', { tab: 'requests', requestId });
  }

  if (
    hintValues.some(
      (value) =>
        value.includes('attendance correction') ||
        value.includes('attendance summary') ||
        value.includes('attendance report') ||
        value.includes('attendance')
    )
  ) {
    return buildDestination('/my-attendance', { date: attendanceDate });
  }

  if (
    hintValues.some(
      (value) =>
        value.includes('profile update') ||
        value.includes('self service request') ||
        value.includes('employee profile') ||
        value.includes('profile')
    )
  ) {
    return buildDestination('/(tabs)/profile', { section: resolveProfileSection(row, metadata) });
  }

  return buildDestination('/(tabs)/home');
}

export function serializeNotificationDestination(destination: NotificationDestination) {
  return {
    destinationPathname: destination.pathname,
    destinationParams: JSON.stringify(destination.params ?? {}),
  };
}

export function parseNotificationDestinationPayload(payload: unknown): NotificationDestination | null {
  const record = asNotificationRecord(payload);
  if (!record) return null;

  const rawPathname =
    readNotificationString(record, ['destinationPathname', 'pathname', 'route']) || '/(tabs)/home';
  const validPathname = [
    '/activities',
    '/(tabs)/attendance',
    '/(tabs)/home',
    '/(tabs)/leave',
    '/(tabs)/profile',
    '/my-attendance',
  ].includes(rawPathname)
    ? (rawPathname as NotificationDestinationPath)
    : '/(tabs)/home';

  let params: Record<string, string> = {};
  const rawParams = record.destinationParams;

  if (typeof rawParams === 'string' && rawParams.trim()) {
    try {
      const parsed = JSON.parse(rawParams) as Record<string, unknown>;
      params = Object.fromEntries(
        Object.entries(parsed).flatMap(([key, value]) =>
          typeof value === 'string' && value.trim() ? [[key, value.trim()]] : []
        )
      );
    } catch {
      params = {};
    }
  } else {
    const requestId = readNotificationString(record, ['requestId', 'request_id']);
    const tab = readNotificationString(record, ['tab']);
    const section = readNotificationString(record, ['section']);
    const date = readNotificationString(record, ['date', 'attendanceDate', 'attendance_date']);
      const view = readNotificationString(record, ['view']);

    params = Object.fromEntries(
      [
        ['requestId', requestId],
        ['tab', tab],
        ['section', section],
        ['date', date],
        ['view', view],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]))
    );
  }

  return buildDestination(validPathname, params);
}
