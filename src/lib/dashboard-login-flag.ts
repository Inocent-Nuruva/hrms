const FROM_LOGIN_FLAG_KEY = "hrms.dashboard.fromLogin";

/** Set before redirect so dashboard shells can skip skeleton flash. */
export function markDashboardFromLogin() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FROM_LOGIN_FLAG_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function isDashboardFromLogin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(FROM_LOGIN_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearDashboardFromLoginFlag() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(FROM_LOGIN_FLAG_KEY);
  } catch {
    // ignore
  }
}
