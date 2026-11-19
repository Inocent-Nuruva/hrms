"use client";

import { ACTION_INBOX_CHANGED } from "@/lib/employee-lifecycle-events";
import * as React from "react";
import { io, type Socket } from "socket.io-client";

import { type AdminRecord } from "@/lib/admin-api";
import {
  notificationsApi,
  type NotificationItem,
  type NotificationQueryParams,
} from "@/lib/notifications-api";
import { subscribeToDashboardActorSnapshot } from "@/lib/dashboard-permissions";
import { showErrorAlert } from "@/lib/error-alert";
import { readStoredSessionTokens } from "@/lib/session-client";

export type {
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
} from "@/lib/admin-api";

export const DEFAULT_NOTIFICATION_QUERY: Readonly<NotificationQueryParams> =
  Object.freeze({
    page: 1,
    limit: 20,
    sortBy: "created_at",
    sortOrder: "DESC",
  });

const LIVE_OFFLINE_WARNING = "Live notifications are temporarily offline.";
const RESYNC_DEBOUNCE_MS = 350;
const SOCKET_CONNECT_FALLBACK_MS = 8_000;
const SOCKET_CONNECT_ERROR_WARNING_COUNT = 2;
const NOTIFICATION_REST_POLL_MS = 30_000;
const NOTIFICATION_SOUND_PATH = "/assets/sounds/hrms_sound.mp3";
/** Absolute asset URL so the sound always resolves from Next public/. */
function resolveNotificationSoundUrl() {
  if (typeof window === "undefined") {
    return NOTIFICATION_SOUND_PATH;
  }
  try {
    return new URL(NOTIFICATION_SOUND_PATH, window.location.origin).toString();
  } catch {
    return NOTIFICATION_SOUND_PATH;
  }
}

export interface NotificationsState {
  items: NotificationItem[];
  attentionItems: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  connected: boolean;
  quietWarning: string | null;
  socketConfigured: boolean;
}

export interface NotificationConnectedEvent extends AdminRecord {
  connected?: boolean;
  connected_at?: string;
  message?: string;
}

export interface NotificationErrorEvent extends AdminRecord {
  code?: string;
  error?: string;
  message?: string;
}

export interface NotificationCounterEvent extends AdminRecord {
  unread_count?: number;
  unreadCount?: number;
  unread?: number;
  count?: number;
  total?: number;
}

export interface NotificationBulkUpdatedEvent extends AdminRecord {
  action?: string;
  ids?: number[];
}

type InternalNotificationsState = NotificationsState & {
  currentQuery: NotificationQueryParams;
  currentQueryKey: string;
  drawerOpen: boolean;
  token: string;
};

type LoadNotificationsOptions = {
  markVisibleSeen?: boolean;
  notifyOnError?: boolean;
  tokenOverride?: string;
  append?: boolean;
};

type LoadUnreadCountOptions = {
  notifyOnError?: boolean;
  tokenOverride?: string;
};

type NotificationsActions = {
  deleteNotification: (id: number) => Promise<void>;
  clearAllNotifications: () => Promise<number>;
  connectSocket: (token?: string) => void;
  disconnectSocket: () => void;
  loadNotifications: (
    params?: NotificationQueryParams,
    options?: LoadNotificationsOptions,
  ) => Promise<NotificationItem[]>;
  loadUnreadCount: (options?: LoadUnreadCountOptions) => Promise<number>;
  markAllAsRead: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAsSeen: (id: number) => Promise<void>;
  setViewState: (open: boolean, params: NotificationQueryParams) => void;
};

const DEFAULT_QUERY_KEY = serializeNotificationQuery(
  DEFAULT_NOTIFICATION_QUERY,
);
const listeners = new Set<() => void>();
let authUnsubscribe: (() => void) | null = null;
let socket: Socket | null = null;
let initialized = false;
let listRequestSequence = 0;
let attentionRequestSequence = 0;
let unreadRequestSequence = 0;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;
let restPollingTimer: ReturnType<typeof setInterval> | null = null;
let socketConfigWarningShown = false;
let notificationAudio: HTMLAudioElement | null = null;
let notificationAudioWarmupAttached = false;
/** Browsers block Audio.play() until a user gesture unlocks media. */
let notificationAudioUnlocked = false;
/** Play once the next time audio is unlocked (e.g. sound arrived before click). */
let notificationSoundPending = false;
/** Avoid chime on the first unread-count fetch after login. */
let unreadCountBaselineReady = false;
/** A malformed notification:new is followed by a REST counter refresh; avoid double audio. */
let suppressUnreadIncreaseSoundUntil = 0;

let state: InternalNotificationsState = {
  items: [],
  attentionItems: [],
  unreadCount: 0,
  loading: false,
  error: null,
  connected: false,
  quietWarning: null,
  socketConfigured: Boolean(resolveNotificationsSocketUrl()),
  currentQuery: { ...DEFAULT_NOTIFICATION_QUERY },
  currentQueryKey: DEFAULT_QUERY_KEY,
  drawerOpen: false,
  token: "",
};

let publicState: NotificationsState = {
  items: state.items,
  attentionItems: state.attentionItems,
  unreadCount: state.unreadCount,
  loading: state.loading,
  error: state.error,
  connected: state.connected,
  quietWarning: state.quietWarning,
  socketConfigured: state.socketConfigured,
};

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readItemId(item: NotificationItem) {
  return readNumber(item.id ?? item.notification_id ?? item.notificationId);
}

function serializeNotificationQuery(params: NotificationQueryParams) {
  const searchParams = new URLSearchParams();

  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.type && params.type.trim()) {
    searchParams.set("type", params.type.trim());
  }
  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.priority) {
    searchParams.set("priority", params.priority);
  }
  if (params.related_module && params.related_module.trim()) {
    searchParams.set("related_module", params.related_module.trim());
  }
  if (params.entity_type && params.entity_type.trim()) {
    searchParams.set("entity_type", params.entity_type.trim());
  }
  if (params.entity_id && params.entity_id.trim()) {
    searchParams.set("entity_id", params.entity_id.trim());
  }
  if (typeof params.seen === "boolean") {
    searchParams.set("seen", String(params.seen));
  }
  if (typeof params.include_archived === "boolean") {
    searchParams.set("include_archived", String(params.include_archived));
  }

  return searchParams.toString();
}

function isDefaultNotificationQuery(params: NotificationQueryParams) {
  return serializeNotificationQuery(params) === DEFAULT_QUERY_KEY;
}

function getNotificationLimit(params: NotificationQueryParams) {
  return typeof params.limit === "number" && params.limit > 0
    ? params.limit
    : 20;
}

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

function ensureNotificationAudio() {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return null;
  }

  if (!notificationAudio) {
    notificationAudio = new Audio(resolveNotificationSoundUrl());
    notificationAudio.preload = "auto";
    notificationAudio.volume = 1;
  }

  return notificationAudio;
}

function detachNotificationAudioWarmup() {
  if (!notificationAudioWarmupAttached || typeof window === "undefined") {
    return;
  }

  window.removeEventListener(
    "pointerdown",
    unlockNotificationAudioFromGesture,
    true,
  );
  window.removeEventListener(
    "keydown",
    unlockNotificationAudioFromGesture,
    true,
  );
  window.removeEventListener(
    "touchstart",
    unlockNotificationAudioFromGesture,
    true,
  );
  notificationAudioWarmupAttached = false;
}

/**
 * Unlock autoplay during a real user gesture (click/key/touch).
 * Calling only audio.load() is not enough — browsers require play() in the gesture.
 * Returns a promise that resolves when unlock finishes (or fails softly).
 */
export function unlockNotificationAudioFromGesture(): Promise<boolean> {
  const audio = ensureNotificationAudio();
  if (!audio) {
    return Promise.resolve(false);
  }

  if (notificationAudioUnlocked) {
    return Promise.resolve(true);
  }

  const finishUnlock = () => {
    notificationAudioUnlocked = true;
    detachNotificationAudioWarmup();
    if (notificationSoundPending) {
      notificationSoundPending = false;
      playNotificationSound();
    }
  };

  try {
    // Mute so unlock is silent; then pause and restore volume.
    audio.muted = true;
    audio.volume = 0;
    const playback = audio.play();
    if (playback && typeof playback.then === "function") {
      return playback
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = 1;
          finishUnlock();
          return true;
        })
        .catch(() => {
          // Keep listeners so a later gesture can retry.
          audio.muted = false;
          audio.volume = 1;
          return false;
        });
    }
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 1;
    finishUnlock();
    return Promise.resolve(true);
  } catch {
    audio.muted = false;
    audio.volume = 1;
    return Promise.resolve(false);
  }
}

function attachNotificationAudioWarmup() {
  if (notificationAudioWarmupAttached || typeof window === "undefined") {
    return;
  }
  if (notificationAudioUnlocked) {
    return;
  }

  notificationAudioWarmupAttached = true;
  // Capture phase so we unlock even if another handler stops propagation.
  window.addEventListener("pointerdown", unlockNotificationAudioFromGesture, {
    capture: true,
    passive: true,
  });
  window.addEventListener("keydown", unlockNotificationAudioFromGesture, {
    capture: true,
  });
  window.addEventListener("touchstart", unlockNotificationAudioFromGesture, {
    capture: true,
    passive: true,
  });
}

/** Play the notification chime (no-op if blocked; unlocks on next user gesture). */
export function playNotificationSound() {
  const audio = ensureNotificationAudio();
  if (!audio) {
    return;
  }

  if (!notificationAudioUnlocked) {
    notificationSoundPending = true;
    attachNotificationAudioWarmup();
    return;
  }

  try {
    audio.muted = false;
    audio.volume = 1;
    // Clone-friendly restart for rapid successive notifications.
    if (!audio.paused) {
      audio.pause();
    }
    audio.currentTime = 0;
    const playback = audio.play();
    void playback?.catch(() => {
      // Autoplay policy re-engaged (e.g. long idle) — re-arm unlock.
      notificationAudioUnlocked = false;
      notificationSoundPending = true;
      attachNotificationAudioWarmup();
    });
  } catch {
    notificationAudioUnlocked = false;
    notificationSoundPending = true;
    attachNotificationAudioWarmup();
  }
}

/**
 * Socket.IO engine is served at `{API_ORIGIN}/socket.io`.
 * Notifications use the `/notifications` namespace (not a custom engine path).
 * Prefer the configured API origin: Next development rewrites handle ordinary
 * HTTP requests but do not reliably proxy Socket.IO WebSocket upgrades.
 */
export function resolveNotificationsSocketOrigin() {
  const browserOrigin =
    typeof window !== "undefined" &&
    (window.location.protocol.toLowerCase() === "http:" ||
      window.location.protocol.toLowerCase() === "https:")
      ? window.location.origin
      : null;
  const browserBackendOrigin = (() => {
    if (!browserOrigin) return null;
    try {
      const url = new URL(browserOrigin);
      if (url.port === "9990") {
        url.port = "9999";
        return url.origin;
      }
      if (url.port === "8880") {
        url.port = "8888";
        return url.origin;
      }
    } catch {
      return null;
    }
    return null;
  })();
  const candidates = [
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim(),
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim(),
    browserBackendOrigin,
    browserOrigin,
    // Same default as NEXT_PUBLIC_API_BASE_URL in env.ts, so local REST and the
    // socket share a host. Hosted environments always set the env variable.
    "http://localhost:8888",
  ].filter((value): value is string => Boolean(value));

  for (const rawValue of candidates) {
    if (rawValue.startsWith("/")) {
      continue;
    }
    try {
      const url = new URL(rawValue);
      return url.origin;
    } catch (errorObject) {
      if (!socketConfigWarningShown) {
        console.warn(
          `[notifications] Invalid notifications base URL candidate: "${rawValue}".`,
          errorObject,
        );
        socketConfigWarningShown = true;
      }
    }
  }

  return null;
}

export function resolveNotificationsSocketUrl() {
  const origin = resolveNotificationsSocketOrigin();
  return origin ? `${origin}/notifications` : null;
}

function isUnreadNotificationItem(item: NotificationItem) {
  const status = readString(item.status).toUpperCase();
  if (status === "READ") {
    return false;
  }
  if (status === "UNREAD") {
    return true;
  }
  return !readString(item.read_at ?? item.readAt);
}

function isArchivedNotificationItem(item: NotificationItem) {
  const record = item as AdminRecord;
  if (
    record.archived === true ||
    record.is_archived === true ||
    record.isArchived === true ||
    record.deleted === true ||
    record.is_deleted === true ||
    record.isDeleted === true
  ) {
    return true;
  }
  if (readString(record.archived_at ?? record.archivedAt)) {
    return true;
  }
  if (readString(record.deleted_at ?? record.deletedAt)) {
    return true;
  }
  const status = readString(record.status).toUpperCase();
  return status === "ARCHIVED" || status === "DELETED" || status === "REMOVED";
}

function isNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const status = (error as Error & { status?: number }).status;
  if (status === 404) {
    return true;
  }
  return /not\s*found/i.test(error.message);
}

function syncPublicState() {
  publicState = {
    items: state.items,
    attentionItems: state.attentionItems,
    unreadCount: state.unreadCount,
    loading: state.loading,
    error: state.error,
    connected: state.connected,
    quietWarning: state.quietWarning,
    socketConfigured: state.socketConfigured,
  };
}

function getPublicState(): NotificationsState {
  return publicState;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setState(
  next:
    | Partial<InternalNotificationsState>
    | ((
        current: InternalNotificationsState,
      ) => Partial<InternalNotificationsState>),
) {
  const patch = typeof next === "function" ? next(state) : next;
  if (!patch || Object.keys(patch).length === 0) {
    return;
  }
  state = { ...state, ...patch };
  syncPublicState();
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    cleanupIfNeeded();
  };
}

function prependNotification(
  items: NotificationItem[],
  item: NotificationItem,
  limit: number,
) {
  const itemId = readItemId(item);
  const withoutDuplicate =
    itemId === null
      ? items
      : items.filter((entry) => readItemId(entry) !== itemId);
  const nextItems = [item, ...withoutDuplicate];
  return nextItems.slice(0, limit);
}

function upsertNotification(items: NotificationItem[], item: NotificationItem) {
  const itemId = readItemId(item);
  if (itemId === null) {
    return items;
  }

  const index = items.findIndex((entry) => readItemId(entry) === itemId);
  if (index === -1) {
    return items;
  }

  const nextItems = [...items];
  nextItems[index] = { ...nextItems[index], ...item };
  return nextItems;
}

function mergeNotificationUpdate(
  currentItem: NotificationItem,
  updatedItem: NotificationItem | null,
  fallback: (item: NotificationItem) => NotificationItem,
) {
  return updatedItem
    ? { ...currentItem, ...updatedItem }
    : fallback(currentItem);
}

function dedupeNotificationItems(items: NotificationItem[]) {
  const seenIds = new Set<number>();
  return items.filter((item) => {
    const id = readItemId(item);
    if (id === null) return true;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

function markItemSeen(item: NotificationItem): NotificationItem {
  return {
    ...item,
    seen: true,
    is_seen: true,
    seen_at:
      readString(item.seen_at ?? item.seenAt) || new Date().toISOString(),
  };
}

function markItemRead(item: NotificationItem): NotificationItem {
  return {
    ...markItemSeen(item),
    status: "READ",
    read_at:
      readString(item.read_at ?? item.readAt) || new Date().toISOString(),
  };
}

function normalizeNotificationItemPayload(
  payload: unknown,
): NotificationItem | null {
  const direct = asRecord(payload);
  if (!direct) {
    return null;
  }

  const directId = readNumber(
    direct.id ?? direct.notification_id ?? direct.notificationId,
  );
  if (directId !== null) {
    return direct as NotificationItem;
  }

  for (const key of ["data", "item", "notification", "payload", "result"]) {
    const nested = asRecord(direct[key]);
    if (!nested) {
      continue;
    }
    const nestedId = readNumber(
      nested.id ?? nested.notification_id ?? nested.notificationId,
    );
    if (nestedId !== null) {
      return nested as NotificationItem;
    }
  }

  return null;
}

function normalizeCounterPayload(payload: unknown) {
  if (typeof payload === "number" && Number.isFinite(payload)) {
    return Math.max(0, Math.floor(payload));
  }

  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  for (const candidate of [
    record,
    asRecord(record.data),
    asRecord(record.payload),
    asRecord(record.result),
  ]) {
    if (!candidate) {
      continue;
    }
    for (const key of [
      "unread_count",
      "unreadCount",
      "unread",
      "count",
      "total",
    ]) {
      const count = readNumber(candidate[key]);
      if (count !== null) {
        return Math.max(0, Math.floor(count));
      }
    }
  }

  return null;
}

function normalizeBulkAction(payload: unknown) {
  const record = asRecord(payload);
  if (!record) {
    return "";
  }

  const directAction = readString(record.action ?? record.type);
  if (directAction) {
    return directAction.toLowerCase();
  }

  const nestedCandidates = [
    asRecord(record.data),
    asRecord(record.payload),
    asRecord(record.result),
  ];
  for (const candidate of nestedCandidates) {
    if (!candidate) {
      continue;
    }
    const nestedAction = readString(candidate.action ?? candidate.type);
    if (nestedAction) {
      return nestedAction.toLowerCase();
    }
  }

  return "";
}

async function syncVisibleNotificationsSeen(
  token: string,
  rows: NotificationItem[],
) {
  // Soft-deleted / archived rows still appear with include_archived, but markSeen
  // returns 404 — skip them so viewing Archived does not spam not-found errors.
  const unseenIds = rows
    .filter((row) => {
      if (isArchivedNotificationItem(row)) {
        return false;
      }
      const explicitSeen =
        row.seen === true || row.is_seen === true || row.isSeen === true;
      const seenAt = readString(row.seen_at ?? row.seenAt);
      return !explicitSeen && !seenAt;
    })
    .map((row) => readItemId(row))
    .filter((id): id is number => id !== null);

  if (unseenIds.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    unseenIds.map(async (id) => {
      try {
        await notificationsApi.markSeen(token, id);
        return id;
      } catch (errorObject) {
        if (isNotFoundError(errorObject)) {
          return id;
        }
        throw errorObject;
      }
    }),
  );

  const successfulIds = new Set(
    results
      .filter(
        (result): result is PromiseFulfilledResult<number> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value),
  );

  if (successfulIds.size === 0) {
    return;
  }

  setState((current) => ({
    items: current.items.map((item) => {
      const id = readItemId(item);
      return id !== null && successfulIds.has(id) ? markItemSeen(item) : item;
    }),
  }));
}

async function loadUnreadCount(options: LoadUnreadCountOptions = {}) {
  ensureInitialized();
  const token = options.tokenOverride ?? (state.token || readStoredToken());
  if (token && token !== state.token) {
    setState({ token });
    unreadCountBaselineReady = false;
  }
  if (!token) {
    setState({ unreadCount: 0 });
    unreadCountBaselineReady = false;
    return 0;
  }

  const requestId = ++unreadRequestSequence;
  const previousUnread = state.unreadCount;

  try {
    const unreadCount = await notificationsApi.unreadCount(token);
    if (requestId !== unreadRequestSequence || token !== state.token) {
      return state.unreadCount;
    }
    setState({ unreadCount });

    // REST/counter fallback: chime when the badge goes up after the first baseline load.
    if (unreadCountBaselineReady && unreadCount > previousUnread) {
      if (Date.now() >= suppressUnreadIncreaseSoundUntil) {
        playNotificationSound();
      }
      suppressUnreadIncreaseSoundUntil = 0;
    }
    unreadCountBaselineReady = true;

    return unreadCount;
  } catch (errorObject) {
    if (requestId !== unreadRequestSequence) {
      return state.unreadCount;
    }
    const message =
      errorObject instanceof Error
        ? errorObject.message
        : "Failed to load notifications unread count.";
    if (options.notifyOnError) {
      showErrorAlert(message);
    }
    return state.unreadCount;
  }
}

async function loadAttentionItems(tokenOverride?: string) {
  ensureInitialized();
  const token = tokenOverride ?? (state.token || readStoredToken());
  if (!token) {
    setState({ attentionItems: [] });
    return [] as NotificationItem[];
  }

  const requestId = ++attentionRequestSequence;
  try {
    const result = await notificationsApi.list(
      token,
      {
        ...DEFAULT_NOTIFICATION_QUERY,
        limit: 100,
        status: "UNREAD",
      },
      {
        cacheTtlMs: 0,
        dedupe: false,
      },
    );
    if (requestId !== attentionRequestSequence || token !== state.token) {
      return state.attentionItems;
    }
    const attentionItems = result.rows.filter(
      (item) =>
        isUnreadNotificationItem(item) && !isArchivedNotificationItem(item),
    );
    setState({ attentionItems });
    return attentionItems;
  } catch {
    return state.attentionItems;
  }
}

async function loadNotifications(
  params: NotificationQueryParams = state.currentQuery,
  options: LoadNotificationsOptions = {},
) {
  ensureInitialized();
  const token = options.tokenOverride ?? (state.token || readStoredToken());
  if (token && token !== state.token) {
    setState({ token });
    if (!socket || !state.connected) {
      connectSocket(token);
    }
  }
  if (!token) {
    setState({
      items: [],
      unreadCount: 0,
      loading: false,
      error: "Authentication required. Please sign in again.",
    });
    return [] as NotificationItem[];
  }

  const normalizedParams = {
    ...DEFAULT_NOTIFICATION_QUERY,
    ...params,
  };
  const nextQueryKey = serializeNotificationQuery(normalizedParams);
  const requestId = ++listRequestSequence;

  setState({
    currentQuery: normalizedParams,
    currentQueryKey: nextQueryKey,
    loading: true,
    error: null,
  });

  try {
    const result = await notificationsApi.list(token, normalizedParams, {
      cacheTtlMs: 0,
      dedupe: false,
    });
    if (requestId !== listRequestSequence || token !== state.token) {
      return state.items;
    }

    const rows = dedupeNotificationItems(result.rows);
    const nextItems = options.append
      ? (() => {
          const existingIds = new Set(
            state.items
              .map(readItemId)
              .filter((id): id is number => id !== null),
          );
          return [
            ...state.items,
            ...rows.filter((item) => {
              const id = readItemId(item);
              return id === null || !existingIds.has(id);
            }),
          ];
        })()
      : rows;
    setState({
      items: nextItems,
      loading: false,
      error: null,
    });

    if (options.markVisibleSeen) {
      void syncVisibleNotificationsSeen(token, rows);
    }

    return rows;
  } catch (errorObject) {
    if (requestId !== listRequestSequence) {
      return state.items;
    }
    const message =
      errorObject instanceof Error
        ? errorObject.message
        : "Failed to load notifications.";
    setState({
      loading: false,
      error: message,
    });
    if (options.notifyOnError) {
      showErrorAlert(message);
    }
    return state.items;
  }
}

function clearScheduledResync() {
  if (resyncTimer !== null) {
    clearTimeout(resyncTimer);
    resyncTimer = null;
  }
}

function scheduleCurrentQueryResync() {
  if (!state.drawerOpen || isDefaultNotificationQuery(state.currentQuery)) {
    return;
  }

  clearScheduledResync();
  resyncTimer = setTimeout(() => {
    resyncTimer = null;
    void loadNotifications(state.currentQuery);
  }, RESYNC_DEBOUNCE_MS);
}

function refreshCurrentQueryIfNeeded() {
  if (!state.drawerOpen || isDefaultNotificationQuery(state.currentQuery)) {
    return;
  }

  void loadNotifications(state.currentQuery);
}

function reloadCurrentQueryAndUnreadCount(token: string) {
  return Promise.all([
    loadUnreadCount({ tokenOverride: token }),
    loadAttentionItems(token),
    loadNotifications(state.currentQuery, {
      tokenOverride: token,
    }),
  ]);
}

function stopRestPolling() {
  if (restPollingTimer !== null) {
    clearInterval(restPollingTimer);
    restPollingTimer = null;
  }
}

function startRestPolling(token: string) {
  if (restPollingTimer !== null || typeof window === "undefined") return;
  restPollingTimer = setInterval(() => {
    if (
      token !== state.token ||
      document.visibilityState === "hidden" ||
      !navigator.onLine
    )
      return;
    void reloadCurrentQueryAndUnreadCount(token);
  }, NOTIFICATION_REST_POLL_MS);
}

function disconnectSocket() {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.io.removeAllListeners();
  // Prevent accidental reconnect after intentional teardown.
  socket.disconnect();
  socket = null;
}

function markLiveOffline(message = LIVE_OFFLINE_WARNING) {
  disconnectSocket();
  setState({
    connected: false,
    // socketConfigured=false means UI shows REST (not endless Connecting…)
    socketConfigured: false,
    quietWarning: message,
  });
}

function handleSocketError(payload: unknown) {
  const record = asRecord(payload);
  const message =
    readString(record?.message) ||
    readString(record?.error) ||
    LIVE_OFFLINE_WARNING;

  console.warn("[notifications] Socket error.", payload);
  markLiveOffline(message);
}

function connectSocket(token: string) {
  const origin = resolveNotificationsSocketOrigin();
  const socketUrl = resolveNotificationsSocketUrl();
  if (!origin || !socketUrl || !token.trim()) {
    disconnectSocket();
    setState({
      connected: false,
      socketConfigured: false,
      quietWarning: null,
    });
    return;
  }

  disconnectSocket();
  setState({
    socketConfigured: true,
    connected: false,
    quietWarning: null,
  });

  // Namespace: /notifications · Engine path: /socket.io
  // Backend expects handshake auth.token = access JWT. Invalid/missing token
  // yields notification:error then "io server disconnect".
  const nextSocket = io(socketUrl, {
    path: "/socket.io",
    auth: { token },
    // Prefer a real WebSocket, but let Socket.IO fall back to HTTP polling when
    // a proxy or a brief backend restart prevents the initial upgrade. The
    // gateway CORS policy covers both transports at this direct API origin.
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    reconnection: true,
    // Notifications already use REST as their data fallback, so keep trying
    // the live channel in the background instead of permanently giving up.
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5,
    timeout: 12_000,
    withCredentials: false,
    autoConnect: true,
    forceNew: true,
  });
  socket = nextSocket;

  // True after gateway ack (notification:connected) or stable post-auth connect.
  let gatewayReady = false;
  let authSettleTimer: ReturnType<typeof setTimeout> | null = null;
  let connectionFailureCount = 0;
  let connectionWarningLogged = false;
  let connectFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const clearAuthSettleTimer = () => {
    if (authSettleTimer !== null) {
      clearTimeout(authSettleTimer);
      authSettleTimer = null;
    }
  };

  const clearConnectFallbackTimer = () => {
    if (connectFallbackTimer !== null) {
      clearTimeout(connectFallbackTimer);
      connectFallbackTimer = null;
    }
  };

  const fallbackToRest = (message = LIVE_OFFLINE_WARNING) => {
    if (token !== state.token || socket !== nextSocket) {
      return;
    }
    clearAuthSettleTimer();
    clearConnectFallbackTimer();
    markLiveOffline(message);
    startRestPolling(token);
  };

  connectFallbackTimer = setTimeout(() => {
    if (gatewayReady || nextSocket.connected) {
      return;
    }
    if (token !== state.token || socket !== nextSocket) {
      return;
    }
    setState({
      connected: false,
      socketConfigured: true,
      quietWarning:
        "Live notifications unavailable. Using REST while reconnecting.",
    });
    startRestPolling(token);
  }, SOCKET_CONNECT_FALLBACK_MS);

  nextSocket.on("connect", () => {
    if (token !== state.token) {
      return;
    }
    clearConnectFallbackTimer();
    connectionFailureCount = 0;
    connectionWarningLogged = false;
    stopRestPolling();
    // Transport is up. Server may still reject via notification:error + disconnect.
    // If we remain connected briefly without error, treat as Live.
    gatewayReady = false;
    setState({
      connected: false,
      socketConfigured: true,
      quietWarning: null,
    });
    clearAuthSettleTimer();
    authSettleTimer = setTimeout(() => {
      if (token !== state.token || socket !== nextSocket) {
        return;
      }
      if (gatewayReady || !nextSocket.connected) {
        return;
      }
      setState({
        connected: true,
        quietWarning: null,
        socketConfigured: true,
      });
    }, 1200);
  });

  nextSocket.on("disconnect", (reason) => {
    if (token !== state.token) {
      return;
    }
    clearAuthSettleTimer();
    gatewayReady = false;

    // Server intentionally closed the socket (auth failure, kick, etc.).
    // Socket.IO does not auto-reconnect on "io server disconnect".
    if (reason === "io server disconnect") {
      fallbackToRest(
        state.quietWarning || "Live notifications unavailable. Using REST.",
      );
      return;
    }

    // Transient drop while reconnection is still enabled → Connecting…
    setState({
      connected: false,
      socketConfigured: true,
    });
  });

  nextSocket.on("connect_error", (errorObject) => {
    if (token !== state.token) {
      return;
    }
    clearAuthSettleTimer();
    connectionFailureCount += 1;
    if (connectionFailureCount >= SOCKET_CONNECT_ERROR_WARNING_COUNT) {
      if (!connectionWarningLogged) {
        console.warn(
          "[notifications] Live connection unavailable; using REST polling.",
          errorObject,
        );
        connectionWarningLogged = true;
      }
      setState({
        connected: false,
        socketConfigured: true,
        quietWarning:
          "Live notifications unavailable. Using REST while reconnecting.",
      });
      startRestPolling(token);
      return;
    }
    // Briefly retry before falling back to REST so the UI never stays stuck.
    setState({
      connected: false,
      socketConfigured: true,
      quietWarning: null,
    });
  });

  nextSocket.io.on("reconnect_attempt", () => {
    if (token !== state.token) {
      return;
    }
    setState({
      connected: false,
      socketConfigured: true,
      quietWarning: state.quietWarning,
    });
  });

  nextSocket.io.on("reconnect_failed", () => {
    if (token !== state.token) {
      return;
    }
    clearAuthSettleTimer();
    clearConnectFallbackTimer();
    setState({
      connected: false,
      socketConfigured: true,
      quietWarning:
        "Live notifications unavailable. Using REST while reconnecting.",
    });
    startRestPolling(token);
  });

  nextSocket.on("notification:connected", () => {
    if (token !== state.token) {
      return;
    }
    clearAuthSettleTimer();
    clearConnectFallbackTimer();
    gatewayReady = true;
    stopRestPolling();
    setState({
      connected: true,
      quietWarning: null,
      socketConfigured: true,
    });
    void reloadCurrentQueryAndUnreadCount(token);
    window.dispatchEvent(new Event(ACTION_INBOX_CHANGED));
  });

  nextSocket.io.on("reconnect", () => {
    if (token !== state.token) {
      return;
    }
    gatewayReady = false;
    setState({
      connected: false,
      quietWarning: null,
      socketConfigured: true,
    });
  });

  nextSocket.on("action-inbox:changed", () => {
    if (token === state.token)
      window.dispatchEvent(new Event(ACTION_INBOX_CHANGED));
  });

  nextSocket.on("notification:new", (payload: unknown) => {
    if (token !== state.token) {
      return;
    }

    const item = normalizeNotificationItemPayload(payload);
    if (!item) {
      // The event itself represents a newly delivered notification. Chime even
      // when its payload shape is unfamiliar, then reconcile from REST.
      playNotificationSound();
      suppressUnreadIncreaseSoundUntil = Date.now() + 2_000;
      void loadUnreadCount({ tokenOverride: token });
      void loadAttentionItems(token);
      return;
    }

    const itemIsUnread = isUnreadNotificationItem(item);
    const itemId = readItemId(item);
    const alreadyPresent =
      itemId !== null &&
      state.items.some((entry) => readItemId(entry) === itemId);

    // Sound is tied to delivery, not read state. This also covers notifications
    // created as already-seen/read by a backend workflow.
    if (!alreadyPresent) {
      playNotificationSound();
    }

    if (isDefaultNotificationQuery(state.currentQuery)) {
      setState((current) => {
        return {
          items: prependNotification(
            current.items,
            item,
            getNotificationLimit(current.currentQuery),
          ),
          // Keep the sidebar badge current even when the backend omits notification:counter.
          unreadCount:
            itemIsUnread && !alreadyPresent
              ? current.unreadCount + 1
              : current.unreadCount,
          attentionItems: itemIsUnread
            ? prependNotification(current.attentionItems, item, 100)
            : current.attentionItems,
        };
      });
    } else {
      if (itemIsUnread) {
        setState((current) => {
          const alreadyPresent =
            itemId !== null &&
            current.items.some((entry) => readItemId(entry) === itemId);
          return {
            unreadCount: alreadyPresent
              ? current.unreadCount
              : current.unreadCount + 1,
            attentionItems: prependNotification(
              current.attentionItems,
              item,
              100,
            ),
          };
        });
      }
      scheduleCurrentQueryResync();
    }

    // Authoritative counter refresh (covers nested counter payloads and multi-device race).
    void loadUnreadCount({ tokenOverride: token });
  });

  nextSocket.on("notification:updated", (payload: unknown) => {
    if (token !== state.token) {
      return;
    }

    const item = normalizeNotificationItemPayload(payload);
    if (!item) {
      return;
    }

    if ((item as AdminRecord).deleted === true) {
      const deletedId = readItemId(item);
      setState((current) => ({
        items: current.items.filter((entry) => readItemId(entry) !== deletedId),
        attentionItems: current.attentionItems.filter(
          (entry) => readItemId(entry) !== deletedId,
        ),
      }));
      scheduleCurrentQueryResync();
      return;
    }

    setState((current) => ({
      items: upsertNotification(current.items, item),
      attentionItems:
        isUnreadNotificationItem(item) && !isArchivedNotificationItem(item)
          ? prependNotification(current.attentionItems, item, 100)
          : current.attentionItems.filter(
              (entry) => readItemId(entry) !== readItemId(item),
            ),
    }));

    scheduleCurrentQueryResync();
  });

  nextSocket.on("notification:counter", (payload: unknown) => {
    if (token !== state.token) {
      return;
    }

    const unreadCount = normalizeCounterPayload(payload);
    if (unreadCount === null) {
      return;
    }

    const previousUnread = state.unreadCount;
    setState({ unreadCount });
    void loadAttentionItems(token);
    if (unreadCount > previousUnread) {
      if (Date.now() >= suppressUnreadIncreaseSoundUntil) {
        playNotificationSound();
      }
      suppressUnreadIncreaseSoundUntil = 0;
    }
  });

  nextSocket.on("notification:bulk-updated", (payload: unknown) => {
    if (token !== state.token) {
      return;
    }

    const action = normalizeBulkAction(payload);
    if (action.includes("dismiss_all")) {
      setState({
        items: [],
        attentionItems: [],
        unreadCount: 0,
      });
      return;
    }

    if (action.includes("mark_all_as_read")) {
      setState((current) => ({
        items: current.items.map((item) => markItemRead(item)),
        attentionItems: [],
        unreadCount: 0,
      }));
      void loadNotifications(state.currentQuery);
      return;
    }

    scheduleCurrentQueryResync();
  });

  nextSocket.on("notification:error", (payload) => {
    handleSocketError(payload);
  });
}

function connectSocketAction(token?: string) {
  const nextToken = token?.trim() || state.token || readStoredToken();
  if (!nextToken) {
    disconnectSocket();
    setState({
      token: "",
      connected: false,
      socketConfigured: false,
      quietWarning: null,
    });
    return;
  }

  if (nextToken !== state.token) {
    unreadCountBaselineReady = false;
    setState({ token: nextToken });
  }

  connectSocket(nextToken);
}

function syncTokenFromStorage() {
  const nextToken = readStoredToken();
  if (nextToken === state.token) {
    return;
  }

  clearScheduledResync();
  disconnectSocket();

  if (!nextToken) {
    unreadCountBaselineReady = false;
    setState({
      token: "",
      items: [],
      attentionItems: [],
      unreadCount: 0,
      loading: false,
      error: null,
      connected: false,
      quietWarning: null,
      currentQuery: { ...DEFAULT_NOTIFICATION_QUERY },
      currentQueryKey: DEFAULT_QUERY_KEY,
      drawerOpen: false,
    });
    return;
  }

  unreadCountBaselineReady = false;

  const nextQuery =
    state.drawerOpen && state.currentQueryKey
      ? state.currentQuery
      : { ...DEFAULT_NOTIFICATION_QUERY };

  setState({
    token: nextToken,
    connected: false,
    error: null,
    quietWarning: null,
    currentQuery: nextQuery,
    currentQueryKey: serializeNotificationQuery(nextQuery),
  });

  void Promise.all([
    loadUnreadCount({ tokenOverride: nextToken }),
    loadAttentionItems(nextToken),
    loadNotifications(nextQuery, {
      tokenOverride: nextToken,
    }),
  ]);
  connectSocket(nextToken);
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;
  ensureNotificationAudio()?.load();
  attachNotificationAudioWarmup();
  authUnsubscribe = subscribeToDashboardActorSnapshot(syncTokenFromStorage);
  window.addEventListener("focus", syncTokenFromStorage);
  document.addEventListener("visibilitychange", syncTokenFromStorage);
  syncTokenFromStorage();
}

function cleanupIfNeeded() {
  if (listeners.size > 0 || typeof window === "undefined") {
    return;
  }

  authUnsubscribe?.();
  authUnsubscribe = null;
  window.removeEventListener("focus", syncTokenFromStorage);
  document.removeEventListener("visibilitychange", syncTokenFromStorage);
  detachNotificationAudioWarmup();
  initialized = false;
  clearScheduledResync();
  stopRestPolling();
  disconnectSocket();
}

async function markAsSeen(id: number) {
  const token = state.token;
  if (!token) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const target = state.items.find((item) => readItemId(item) === id) ?? null;
  const archived = target !== null && isArchivedNotificationItem(target);

  let updatedItem: NotificationItem | null = null;
  if (!archived) {
    try {
      updatedItem = await notificationsApi.markSeen(token, id);
    } catch (errorObject) {
      // Archived/deleted notifications can still be listed, but mutation APIs 404.
      if (!isNotFoundError(errorObject)) {
        throw errorObject;
      }
    }
  }

  setState((current) => ({
    items: current.items.map((item) => {
      if (readItemId(item) !== id) {
        return item;
      }
      return mergeNotificationUpdate(item, updatedItem, markItemSeen);
    }),
  }));
  if (!archived) {
    refreshCurrentQueryIfNeeded();
  }
}

async function markAsRead(id: number) {
  const token = state.token;
  if (!token) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const target = state.items.find((item) => readItemId(item) === id) ?? null;
  const targetWasUnread = target !== null && isUnreadNotificationItem(target);
  const archived = target !== null && isArchivedNotificationItem(target);

  if (target !== null && !targetWasUnread) {
    return;
  }

  let updatedItem: NotificationItem | null = null;
  if (!archived) {
    try {
      updatedItem = await notificationsApi.markRead(token, id);
    } catch (errorObject) {
      // Soft-deleted rows return "notification not found" — treat as local read only.
      if (!isNotFoundError(errorObject)) {
        throw errorObject;
      }
    }
  }

  setState((current) => ({
    items: current.items.map((item) => {
      if (readItemId(item) !== id) {
        return item;
      }
      return mergeNotificationUpdate(item, updatedItem, markItemRead);
    }),
    attentionItems: current.attentionItems.filter(
      (item) => readItemId(item) !== id,
    ),
    unreadCount: targetWasUnread
      ? Math.max(0, current.unreadCount - 1)
      : current.unreadCount,
  }));
  if (!archived) {
    refreshCurrentQueryIfNeeded();
    void loadUnreadCount({ tokenOverride: token });
  }
}

async function markAllAsRead() {
  const token = state.token;
  if (!token) {
    throw new Error("Authentication required. Please sign in again.");
  }

  await notificationsApi.markAllRead(token);
  setState((current) => ({
    items: current.items.map((item) => markItemRead(item)),
    attentionItems: [],
    unreadCount: 0,
  }));
  refreshCurrentQueryIfNeeded();
}

async function deleteNotification(id: number) {
  const token = state.token;
  if (!token) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const target = state.items.find((item) => readItemId(item) === id) ?? null;
  const targetWasUnread = target !== null && isUnreadNotificationItem(target);

  await notificationsApi.delete(token, id);
  setState((current) => ({
    items: current.items.filter((item) => readItemId(item) !== id),
    attentionItems: current.attentionItems.filter(
      (item) => readItemId(item) !== id,
    ),
    unreadCount: targetWasUnread
      ? Math.max(0, current.unreadCount - 1)
      : current.unreadCount,
  }));
  void loadUnreadCount({ tokenOverride: token });
}

async function clearAllNotifications() {
  const token = state.token;
  if (!token) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const response = await notificationsApi.dismissAll(token);
  const deletedCount =
    readNumber((response as AdminRecord | null)?.deleted_count) ??
    state.items.length;

  setState({
    items: [],
    attentionItems: [],
    unreadCount: 0,
  });
  await loadUnreadCount({ tokenOverride: token });
  return deletedCount;
}

function setViewState(open: boolean, params: NotificationQueryParams) {
  const normalizedParams = {
    ...DEFAULT_NOTIFICATION_QUERY,
    ...params,
  };

  setState({
    drawerOpen: open,
    currentQuery: normalizedParams,
    currentQueryKey: serializeNotificationQuery(normalizedParams),
  });
}

const actions: NotificationsActions = {
  deleteNotification,
  clearAllNotifications,
  connectSocket: connectSocketAction,
  disconnectSocket,
  loadNotifications,
  loadUnreadCount,
  markAllAsRead,
  markAsRead,
  markAsSeen,
  setViewState,
};

export function useNotifications() {
  // Initialize eagerly so the first drawer open / badge render already has a token.
  if (typeof window !== "undefined") {
    ensureInitialized();
  }

  const snapshot = React.useSyncExternalStore(
    subscribe,
    getPublicState,
    getPublicState,
  );
  return React.useMemo(
    () => ({
      ...snapshot,
      ...actions,
    }),
    [snapshot],
  );
}
