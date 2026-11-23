export function requiresAttendanceSelfie(policy: Record<string, unknown>, action: 'in' | 'out') {
  return (action === 'in' ? policy.require_selfie_for_check_in : policy.require_selfie_for_check_out) === true;
}

export function canQueueAttendancePunch(policy: Record<string, unknown>, error: unknown, qrToken: unknown) {
  if (policy.allow_mobile_punches === false || policy.allow_offline_punches !== true || qrToken) return false;
  return error instanceof TypeError ||
    (error instanceof Error && /network request failed|failed to fetch|network error/i.test(error.message));
}
