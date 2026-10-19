import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as SecureStore from './secure-store';

export type OfflinePunchKind = 'CHECK_IN' | 'CHECK_OUT';
export type OfflinePunchSender = (
  kind: OfflinePunchKind,
  payload: Record<string, unknown>,
) => Promise<unknown>;

export interface OfflinePunchQueueStatus {
  queuedCount: number;
  needsReviewCount: number;
  oldestQueuedAt: string | null;
}

export interface OfflinePunchNeedsReviewItem {
  id: string;
  kind: OfflinePunchKind;
  created_at: string;
  last_error: string | null;
}

interface OfflinePunchRow {
  id: string;
  kind: OfflinePunchKind;
  payload_json: string;
  created_at: string;
  status: 'QUEUED' | 'NEEDS_REVIEW';
  last_error: string | null;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getQueueDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === 'web') {
    throw new Error('Encrypted offline attendance storage is only available in the mobile app.');
  }
  if (databasePromise) return databasePromise;
  databasePromise = (async () => {
    let key = await SecureStore.getItemAsync('attendance.offline.queue.key');
    if (!key) {
      const cryptoApi = globalThis.crypto as
        | { getRandomValues?: (array: Uint8Array) => Uint8Array }
        | undefined;
      if (typeof cryptoApi?.getRandomValues !== 'function') {
        throw new Error('Secure random generation is unavailable; offline punch storage was not opened.');
      }
      const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
      key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync('attendance.offline.queue.key', key);
    }
    const db = await SQLite.openDatabaseAsync('attendance-offline.db');
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_attendance_punches (
        id TEXT PRIMARY KEY NOT NULL,
        company_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_offline_attendance_owner_created
      ON offline_attendance_punches(company_id, user_id, created_at);
    `);
    return db;
  })().catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

function createQueueId(): string {
  const cryptoApi = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (typeof cryptoApi?.randomUUID !== 'function') {
    throw new Error('Secure random request identifiers are unavailable.');
  }
  return cryptoApi.randomUUID();
}

export async function enqueueOfflineAttendancePunch(params: {
  companyId: number;
  userId: string | number;
  kind: OfflinePunchKind;
  payload: Record<string, unknown>;
}) {
  if (params.payload.qrToken) {
    throw new Error('QR checkpoint punches must be completed online because checkpoint tokens expire.');
  }
  if (typeof params.payload.clientCapturedAt !== 'string') {
    throw new Error('The punch capture time is missing; this punch cannot be queued safely.');
  }
  const db = await getQueueDatabase();
  const id = createQueueId();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO offline_attendance_punches
      (id, company_id, user_id, kind, payload_json, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'QUEUED')`,
    id,
    params.companyId,
    String(params.userId),
    params.kind,
    JSON.stringify({ ...params.payload, offlineQueued: true }),
    createdAt,
  );
  return { id, createdAt };
}

export async function getOfflineAttendanceQueueStatus(
  companyId: number,
  userId: string | number,
): Promise<OfflinePunchQueueStatus> {
  const db = await getQueueDatabase();
  const rows = await db.getAllAsync<{
    status: string;
    created_at: string;
  }>(
    `SELECT status, created_at FROM offline_attendance_punches
     WHERE company_id = ? AND user_id = ? ORDER BY created_at ASC`,
    companyId,
    String(userId),
  );
  return {
    queuedCount: rows.filter((row) => row.status === 'QUEUED').length,
    needsReviewCount: rows.filter((row) => row.status === 'NEEDS_REVIEW').length,
    oldestQueuedAt: rows.find((row) => row.status === 'QUEUED')?.created_at ?? null,
  };
}

export async function flushOfflineAttendancePunches(params: {
  companyId: number;
  userId: string | number;
  sender: OfflinePunchSender;
}): Promise<{ sent: number; needsReview: number; remaining: number }> {
  const db = await getQueueDatabase();
  const rows = await db.getAllAsync<OfflinePunchRow>(
    `SELECT id, kind, payload_json, created_at, status, last_error
     FROM offline_attendance_punches
     WHERE company_id = ? AND user_id = ? AND status = 'QUEUED'
     ORDER BY created_at ASC`,
    params.companyId,
    String(params.userId),
  );
  let sent = 0;
  let needsReview = 0;
  for (const row of rows) {
    try {
      await params.sender(row.kind, JSON.parse(row.payload_json) as Record<string, unknown>);
      await db.runAsync('DELETE FROM offline_attendance_punches WHERE id = ?', row.id);
      sent += 1;
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 429) {
        const message = error instanceof Error ? error.message : 'Server rejected the queued punch.';
        await db.runAsync(
          `UPDATE offline_attendance_punches SET status = 'NEEDS_REVIEW', last_error = ? WHERE id = ?`,
          message.slice(0, 1000),
          row.id,
        );
        needsReview += 1;
        continue;
      }
      break;
    }
  }
  const status = await getOfflineAttendanceQueueStatus(params.companyId, params.userId);
  return { sent, needsReview, remaining: status.queuedCount };
}

export async function getOfflineAttendanceNeedsReview(
  companyId: number,
  userId: string | number,
): Promise<OfflinePunchNeedsReviewItem[]> {
  const db = await getQueueDatabase();
  return db.getAllAsync<OfflinePunchNeedsReviewItem>(
    `SELECT id, kind, created_at, last_error FROM offline_attendance_punches
     WHERE company_id = ? AND user_id = ? AND status = 'NEEDS_REVIEW'
     ORDER BY created_at ASC`,
    companyId,
    String(userId),
  );
}

export async function clearOfflineAttendanceNeedsReview(
  companyId: number,
  userId: string | number,
) {
  const db = await getQueueDatabase();
  await db.runAsync(
    `DELETE FROM offline_attendance_punches
     WHERE company_id = ? AND user_id = ? AND status = 'NEEDS_REVIEW'`,
    companyId,
    String(userId),
  );
}

export async function removeOfflineAttendancePunch(id: string) {
  const db = await getQueueDatabase();
  await db.runAsync('DELETE FROM offline_attendance_punches WHERE id = ?', id);
}
