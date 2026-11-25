import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as SecureStore from './secure-store';

export type QueuedFieldVisitOperation = 'VISIT_CHECK_IN' | 'VISIT_CHECK_OUT' | 'ADD_OPPORTUNITY';
export interface QueuedFieldVisitAction { id: string; operation: QueuedFieldVisitOperation; payload: Record<string, unknown>; createdAt: string; status: 'QUEUED' | 'NEEDS_REVIEW'; lastError: string | null }
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
  if (Platform.OS === 'web') throw new Error('Offline field visits require the native app.');
  if (databasePromise) return databasePromise;
  databasePromise = (async () => {
    let key = await SecureStore.getItemAsync('field.visit.queue.key');
    if (!key) {
      const cryptoApi = globalThis.crypto as { getRandomValues?: (bytes: Uint8Array) => Uint8Array } | undefined;
      if (!cryptoApi?.getRandomValues) throw new Error('Secure random generation is unavailable.');
      key = Array.from(cryptoApi.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync('field.visit.queue.key', key);
    }
    const db = await SQLite.openDatabaseAsync('field-visits-offline.db');
    await db.execAsync(`PRAGMA key = "x'${key}'"; CREATE TABLE IF NOT EXISTS field_visit_outbox (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, user_id TEXT NOT NULL, operation TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'QUEUED', last_error TEXT)`);
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_field_visit_outbox_scope ON field_visit_outbox(company_id, user_id, created_at)');
    await db.execAsync('CREATE TABLE IF NOT EXISTS field_visit_cache (company_id TEXT NOT NULL, user_id TEXT NOT NULL, visits_json TEXT NOT NULL, cached_at TEXT NOT NULL, PRIMARY KEY(company_id, user_id))');
    return db;
  })().catch((error) => { databasePromise = null; throw error; });
  return databasePromise;
}

function uuid() {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (!cryptoApi?.randomUUID) throw new Error('Secure request identifiers are unavailable.');
  return cryptoApi.randomUUID();
}

export async function enqueueFieldVisitAction(scope: { companyId: string | number; userId: string | number }, operation: QueuedFieldVisitOperation, payload: Record<string, unknown>) {
  const db = await database();
  const id = uuid();
  const createdAt = new Date().toISOString();
  await db.runAsync('INSERT INTO field_visit_outbox (id, company_id, user_id, operation, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, String(scope.companyId), String(scope.userId), operation, JSON.stringify(payload), createdAt);
  return { id, createdAt };
}

export async function listFieldVisitOutbox(scope: { companyId: string | number; userId: string | number }): Promise<QueuedFieldVisitAction[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ id: string; operation: QueuedFieldVisitOperation; payload_json: string; created_at: string; status: 'QUEUED' | 'NEEDS_REVIEW'; last_error: string | null }>('SELECT id, operation, payload_json, created_at, status, last_error FROM field_visit_outbox WHERE company_id = ? AND user_id = ? ORDER BY created_at ASC', String(scope.companyId), String(scope.userId));
  return rows.map((row) => ({ id: row.id, operation: row.operation, payload: JSON.parse(row.payload_json) as Record<string, unknown>, createdAt: row.created_at, status: row.status, lastError: row.last_error }));
}

export async function flushFieldVisitOutbox(scope: { companyId: string | number; userId: string | number }, sender: (action: QueuedFieldVisitAction) => Promise<void>) {
  const db = await database();
  const actions = (await listFieldVisitOutbox(scope)).filter((action) => action.status === 'QUEUED');
  let sent = 0;
  for (const action of actions) {
    try { await sender(action); await db.runAsync('DELETE FROM field_visit_outbox WHERE id = ?', action.id); sent += 1; }
    catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : undefined;
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 429) await db.runAsync("UPDATE field_visit_outbox SET status = 'NEEDS_REVIEW', last_error = ? WHERE id = ?", (error instanceof Error ? error.message : 'Server rejected this action.').slice(0, 1000), action.id);
      else break;
    }
  }
  const remaining = await listFieldVisitOutbox(scope);
  return { sent, queued: remaining.filter((item) => item.status === 'QUEUED').length, needsReview: remaining.filter((item) => item.status === 'NEEDS_REVIEW').length };
}

export async function removeFieldVisitOutboxAction(scope: { companyId: string | number; userId: string | number }, id: string) {
  const db = await database();
  await db.runAsync('DELETE FROM field_visit_outbox WHERE id = ? AND company_id = ? AND user_id = ?', id, String(scope.companyId), String(scope.userId));
}

export async function retryFieldVisitOutboxAction(scope: { companyId: string | number; userId: string | number }, id: string) {
  const db = await database();
  await db.runAsync("UPDATE field_visit_outbox SET status = 'QUEUED', last_error = NULL WHERE id = ? AND company_id = ? AND user_id = ? AND status = 'NEEDS_REVIEW'", id, String(scope.companyId), String(scope.userId));
}

export async function cacheMyFieldVisits(scope: { companyId: string | number; userId: string | number }, visits: Record<string, unknown>[]) {
  const db = await database();
  await db.runAsync('INSERT OR REPLACE INTO field_visit_cache (company_id, user_id, visits_json, cached_at) VALUES (?, ?, ?, ?)', String(scope.companyId), String(scope.userId), JSON.stringify(visits), new Date().toISOString());
}

export async function getCachedMyFieldVisits(scope: { companyId: string | number; userId: string | number }) {
  const db = await database();
  const row = await db.getFirstAsync<{ visits_json: string }>('SELECT visits_json FROM field_visit_cache WHERE company_id = ? AND user_id = ?', String(scope.companyId), String(scope.userId));
  return row ? JSON.parse(row.visits_json) as Record<string, unknown>[] : null;
}
