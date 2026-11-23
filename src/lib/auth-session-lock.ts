"use client";

const name = "hrms.auth.session";

// An IndexedDB version upgrade waits for all older connections to close. Only
// the caller that actually upgraded owns this version. Holding its connection
// until credential persistence finishes also works when a tab is suspended.
function openVersion(
  version?: number,
): Promise<{ db: IDBDatabase; upgraded: boolean }> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    let upgraded = false;
    request.onupgradeneeded = () => {
      upgraded = true;
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve({ db: request.result, upgraded });
  });
}

async function withDatabaseLock<T>(work: () => Promise<T>): Promise<T> {
  for (;;) {
    const probe = await openVersion();
    const next = probe.db.version + 1;
    probe.db.close();
    let claim;
    try {
      claim = await openVersion(next);
    } catch (error) {
      if (error instanceof DOMException && error.name === "VersionError")
        continue;
      throw error;
    }
    try {
      if (claim.upgraded) return await work();
    } finally {
      claim.db.close();
    }
  }
}

export async function withAuthSessionLock<T>(
  work: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(name, work);
  }
  return withDatabaseLock(work);
}
