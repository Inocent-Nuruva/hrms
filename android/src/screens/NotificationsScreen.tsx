import React from 'react';
import {
  Alert, FlatList, Pressable, RefreshControl, StyleSheet, View, type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Archive, Check, CheckCircle2, Circle, ExternalLink, Inbox } from 'lucide-react-native';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { Text } from '../components/ui/text';
import { FluentActivityIndicator } from '../components/ui/fluent-activity-indicator';
import { useAuth } from '../hooks/useAuth';
import { useNotifications, type AppNotification } from '../hooks/useNotifications';
import { useThemePreference } from '../hooks/useThemePreference';
import { useAppAccent } from '../hooks/useAppAccent';
import { COLORS } from '../lib/config';
import { resolveNotificationDestination, readNotificationString } from '../lib/mobile-notification-routing';

type Entry = { kind: 'header'; key: string; label: string } | { kind: 'notification'; key: string; row: AppNotification };

function notificationDate(row: AppNotification) {
  const value = readNotificationString(row, ['created_at', 'createdAt']);
  return value ? new Date(value) : null;
}
function dayLabel(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 7) return 'Last week';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function clockLabel(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function isUnread(row: AppNotification) {
  return String(row.status ?? '').toUpperCase() === 'UNREAD';
}

function notificationIconColor(row: AppNotification, isDark: boolean) {
  const value = [
    readNotificationString(row, ['category']),
    readNotificationString(row, ['type', 'entity_type', 'entityType']),
    readNotificationString(row, ['related_module', 'relatedModule']),
  ].join(' ').toLowerCase();

  if (/leave|time.?off|attendance/.test(value)) return isDark ? '#34D399' : '#059669';
  if (/payroll|salary|compensation|benefit/.test(value)) return isDark ? '#FBBF24' : '#D97706';
  if (/onboard|employee|staff|hr/.test(value)) return isDark ? '#C4B5FD' : '#7C3AED';
  if (/security|auth|access|account/.test(value)) return isDark ? '#FDA4AF' : '#E11D48';
  if (/system|technical|integration/.test(value)) return isDark ? '#7DD3FC' : '#0284C7';
  if (/request|approval|workflow/.test(value)) return isDark ? '#FDBA74' : '#EA580C';
  return isDark ? '#A5B4FC' : '#4F46E5';
}

export default function NotificationsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const notifications = useNotifications();
  const { isDark } = useThemePreference();
  const accent = useAppAccent();
  const bg = isDark ? COLORS.backgroundDark : COLORS.background;
  const fg = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const muted = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const border = isDark ? COLORS.outlineDark : '#E5E7EB';
  const unreadBg = isDark ? '#172B45' : '#EAF3FF';
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const rows = notifications.notifications;
  const entries = React.useMemo<Entry[]>(() => {
    const result: Entry[] = [];
    let previousGroup = '';
    rows.forEach((row) => {
      const date = notificationDate(row);
      const group = date ? dayLabel(date) : 'Earlier';
      if (group !== previousGroup) {
        result.push({ kind: 'header', key: `heading:${group}`, label: group });
        previousGroup = group;
      }
      result.push({ kind: 'notification', key: String(row.id), row });
    });
    return result;
  }, [rows]);
  const toggleSelected = React.useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const closeSelection = () => { setSelecting(false); setSelected(new Set()); };
  const selectAllLoaded = () => setSelected(new Set(rows.map((row) => String(row.id))));
  const openItem = async (row: AppNotification) => {
    if (selecting) {
      toggleSelected(String(row.id));
      return;
    }
    if (isUnread(row)) {
      try { await notifications.markAsRead(String(row.id)); }
      catch (error) { Alert.alert('Could not update notification', error instanceof Error ? error.message : 'Try again.'); }
    }
    router.push(resolveNotificationDestination(row) as never);
  };
  const runBulk = async (action: 'read' | 'archive') => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      if (action === 'read') await notifications.markManyAsRead(ids);
      else await notifications.archiveMany(ids);
      closeSelection();
    } catch (error) {
      Alert.alert('Could not update selected notifications', error instanceof Error ? error.message : 'Try again.');
    } finally { setBulkBusy(false); }
  };

  const renderEntry: ListRenderItem<Entry> = ({ item }) => {
    if (item.kind === 'header') {
      return <Text style={[styles.groupTitle, { color: muted }]}>{item.label}</Text>;
    }
    const row = item.row;
    const unread = isUnread(row);
    const checked = selected.has(String(row.id));
    const date = notificationDate(row);
    const title = readNotificationString(row, ['title']) || 'Notification';
    const body = readNotificationString(row, ['message', 'description']);
    const category = readNotificationString(row, ['related_module', 'category']);
    const iconColor = notificationIconColor(row, isDark);
    return (
      <Pressable
        onPress={() => void openItem(row)}
        style={[
          styles.item,
          { borderBottomColor: border, backgroundColor: checked ? (isDark ? '#203A56' : '#DDEBFF') : unread ? unreadBg : bg },
        ]}
      >
        <View style={styles.selectSlot}>
          {selecting ? (
            <Pressable onPress={() => toggleSelected(String(row.id))} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked }}>
              {checked ? <CheckCircle2 size={22} color={accent} /> : <Circle size={22} color={muted} />}
            </Pressable>
          ) : unread ? <View style={[styles.unreadDot, { backgroundColor: accent }]} /> : null}
        </View>
        <View style={[styles.iconShell, { backgroundColor: isDark ? '#303943' : '#F3F4F6' }]}>
          <Inbox size={20} color={iconColor} />
        </View>
        <View style={styles.itemCopy}>
          <View style={styles.titleLine}>
          <Text style={[styles.itemTitle, { color: fg }, styles.unreadTitle]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.itemTime, { color: muted }]}>{clockLabel(date)}</Text>
          </View>
          <Text style={[styles.itemBody, { color: fg }]} numberOfLines={2}>{body || category}</Text>
          {!!category && <Text style={[styles.itemMeta, { color: muted }]} numberOfLines={1}>{category.replaceAll('_', ' ')}</Text>}
        </View>
        {!selecting ? <ExternalLink size={15} color={muted} /> : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <MobileTopBar auth={auth} title="Notifications" showBackButton onBackPress={() => router.back()} variant="centered" />
      <SafeAreaView edges={['bottom']} style={[styles.body, { backgroundColor: bg }]}>
        <View style={[styles.toolbar, { borderBottomColor: border }]}>
          {!selecting ? (
            <>
              <Pressable onPress={() => { setSelecting(true); setSelected(new Set()); }} style={styles.toolbarAction}>
                <Text style={[styles.toolbarText, { color: accent }]}>Select</Text>
              </Pressable>
              <View style={styles.toolbarRight}>
                <Text style={[styles.countText, { color: muted }]}>{notifications.unreadCount} unread</Text>
                <Pressable
                  accessibilityLabel="Mark all notifications as read"
                  onPress={() => void notifications.markAllAsRead()}
                  disabled={!notifications.unreadCount}
                  style={styles.iconAction}
                ><Check size={21} color={notifications.unreadCount ? accent : muted} /></Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable onPress={closeSelection} style={styles.toolbarAction}><Text style={[styles.toolbarText, { color: accent }]}>Cancel</Text></Pressable>
              <View style={styles.toolbarRight}>
                <Text style={[styles.countText, { color: muted }]}>{selected.size} selected</Text>
                <Pressable onPress={selectAllLoaded} style={styles.toolbarAction}><Text style={[styles.toolbarText, { color: accent }]}>Select all</Text></Pressable>
                <Pressable disabled={!selected.size || bulkBusy} onPress={() => void runBulk('read')} style={styles.iconAction} accessibilityLabel="Mark selected as read">
                  <Check size={21} color={selected.size && !bulkBusy ? accent : muted} />
                </Pressable>
                <Pressable disabled={!selected.size || bulkBusy} onPress={() => void runBulk('archive')} style={styles.iconAction} accessibilityLabel="Archive selected">
                  {bulkBusy ? <FluentActivityIndicator color={accent} /> : <Archive size={20} color={selected.size ? accent : muted} />}
                </Pressable>
              </View>
            </>
          )}
        </View>
        {notifications.loading && !rows.length ? <View style={styles.loader}><FluentActivityIndicator color={accent} /></View> : null}
        {!notifications.loading && !entries.length ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#252B32' : '#F3F4F6', borderColor: border }]}>
              <Inbox size={22} color={muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: fg }]}>You’re all caught up</Text>
            <Text style={[styles.emptyText, { color: muted }]}>New notifications will show up here.</Text>
          </View>
        ) : null}
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.key}
          renderItem={renderEntry}
          refreshControl={<RefreshControl refreshing={notifications.loading && rows.length > 0} onRefresh={() => void notifications.refresh()} />}
          onEndReached={() => { if (notifications.hasMore && !notifications.loadingMore) void notifications.loadMore(); }}
          onEndReachedThreshold={0.45}
          initialNumToRender={14}
          maxToRenderPerBatch={14}
          windowSize={9}
          removeClippedSubviews
          contentContainerStyle={styles.content}
          ListFooterComponent={notifications.loadingMore ? <View style={styles.footerLoader}><FluentActivityIndicator color={accent} /></View> : notifications.hasMore ? (
            <Pressable onPress={() => void notifications.loadMore()} style={styles.loadMore}>
              <Text style={[styles.toolbarText, { color: accent }]}>Load more notifications</Text>
            </Pressable>
          ) : null}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  toolbar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolbarAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 },
  toolbarText: { fontSize: 13, fontWeight: '700' },
  countText: { fontSize: 12 },
  iconAction: { minWidth: 36, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 20, flexGrow: 1 },
  groupTitle: { fontSize: 14, fontWeight: '700', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8 },
  item: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  selectSlot: { width: 20, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  iconShell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '500' },
  unreadTitle: { fontWeight: '800' },
  itemTime: { fontSize: 11 },
  itemBody: { fontSize: 13, marginTop: 2 },
  itemMeta: { fontSize: 11, marginTop: 3, textTransform: 'capitalize' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 28, paddingVertical: 54 },
  emptyIcon: { width: 48, height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyText: { fontSize: 12, textAlign: 'center' },
  loader: { padding: 20, alignItems: 'center' },
  footerLoader: { padding: 16, alignItems: 'center' },
  loadMore: { alignItems: 'center', padding: 16 },
});
