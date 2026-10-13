export const STORAGE_CHANGED_EVENT = "hrms:storage-changed";
const listeners = new Set<() => void>();
let observedWindow: Window | null = null;
function notify() {
  for (const listener of [...listeners]) listener();
}
function observe() {
  if (typeof window === "undefined" || observedWindow === window) return;
  observedWindow = window;
  if (typeof window.addEventListener !== "function") return;
  window.addEventListener("storage", notify);
  window.addEventListener(STORAGE_CHANGED_EVENT, notify);
}
export function subscribeStorage(listener: () => void): () => void {
  observe();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
/** Commit the complete write set, rollback persistence failures, then notify same-tab readers once. */
export function writeStorageBatch(
  updates: Readonly<Record<string, string | null>>,
): void {
  if (typeof window === "undefined") return;
  const previous = new Map<string, string | null>();
  try {
    for (const [key, value] of Object.entries(updates)) {
      previous.set(key, window.localStorage.getItem(key));
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    }
  } catch (error) {
    for (const [key, value] of previous) {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        /* The original persistence error is reported to the caller. */
      }
    }
    throw error;
  }
  observe();
  if (typeof window.dispatchEvent === "function")
    window.dispatchEvent(new Event(STORAGE_CHANGED_EVENT));
}
