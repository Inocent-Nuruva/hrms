import React from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, ExternalLink, Inbox } from 'lucide-react-native';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { Text } from '../components/ui/text';
import { FluentActivityIndicator } from '../components/ui/fluent-activity-indicator';
import { useAuth } from '../hooks/useAuth';
import { useNotifications, type AppNotification } from '../hooks/useNotifications';
import { useThemePreference } from '../hooks/useThemePreference';
import { useAppAccent } from '../hooks/useAppAccent';
import { COLORS } from '../lib/config';
import { resolveNotificationDestination, readNotificationString } from '../lib/mobile-notification-routing';

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
  const groups = React.useMemo(() => {
    const result = new Map<string, AppNotification[]>();
    notifications.notifications.forEach((row) => {
      const date = notificationDate(row);
      const key = date ? dayLabel(date) : 'Earlier';
      result.set(key, [...(result.get(key) ?? []), row]);
    });
    return Array.from(result.entries());
  }, [notifications.notifications]);
  const openItem = async (row: AppNotification) => {
    const id = String(row.id);
    if (String(row.status ?? '').toUpperCase() === 'UNREAD') {
      try { await notifications.markAsRead(id); }
      catch (error) { Alert.alert('Could not update notification', error instanceof Error ? error.message : 'Try again.'); }
    }
    router.push(resolveNotificationDestination(row) as never);
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <MobileTopBar auth={auth} title="Notifications" showBackButton onBackPress={() => router.back()} variant="centered" />
      <View style={[styles.headerActions, { borderBottomColor: border }]}>
        <View style={styles.headerSpacer} />
        <Text style={[styles.pageTitle, { color: fg }]}>Notifications</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          onPress={() => void notifications.markAllAsRead()}
          disabled={!notifications.unreadCount}
          style={styles.headerAction}
        ><Check size={22} color={notifications.unreadCount ? fg : muted} /></Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={notifications.loading} onRefresh={() => void notifications.refresh()} />}
      >
        {notifications.loading && !notifications.notifications.length ? <FluentActivityIndicator color={accent} /> : null}
        {!notifications.loading && !groups.length ? (
          <View style={styles.empty}><Inbox size={32} color={muted} /><Text style={[styles.emptyText, { color: muted }]}>You’re all caught up.</Text></View>
        ) : null}
        {groups.map(([group, rows]) => (
          <View key={group}>
            <Text style={[styles.groupTitle, { color: muted }]}>{group}</Text>
            {rows.map((row) => {
              const unread = String(row.status ?? '').toUpperCase() === 'UNREAD';
              const date = notificationDate(row);
              const title = readNotificationString(row, ['title']) || 'Notification';
              const body = readNotificationString(row, ['message', 'description']);
              const category = readNotificationString(row, ['related_module', 'category']);
              return (
                <Pressable key={String(row.id)} onPress={() => void openItem(row)} style={[styles.item, { borderBottomColor: border }]}>
                  <View style={styles.unreadSlot}>{unread ? <View style={[styles.unreadDot, { backgroundColor: accent }]} /> : null}</View>
                  <View style={[styles.iconShell, { backgroundColor: isDark ? '#303943' : '#F3F4F6' }]}>
                    <Inbox size={20} color={unread ? accent : muted} />
                  </View>
                  <View style={styles.itemCopy}>
                    <View style={styles.titleLine}>
                      <Text style={[styles.itemTitle, { color: fg }, unread && styles.unreadTitle]} numberOfLines={1}>{title}</Text>
                      <Text style={[styles.itemTime, { color: muted }]}>{clockLabel(date)}</Text>
                    </View>
                    <Text style={[styles.itemBody, { color: fg }]} numberOfLines={2}>{body || category}</Text>
                    {!!category && <Text style={[styles.itemMeta, { color: muted }]} numberOfLines={1}>{category.replaceAll('_', ' ')}</Text>}
                  </View>
                  <ExternalLink size={15} color={muted} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerActions: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20 },
  headerSpacer: { width: 36 },
  pageTitle: { fontSize: 17, fontWeight: '700' },
  headerAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 24 },
  groupTitle: { fontSize: 14, fontWeight: '700', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 10 },
  item: { minHeight: 77, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  unreadSlot: { width: 10, alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  iconShell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '500' },
  unreadTitle: { fontWeight: '800' },
  itemTime: { fontSize: 11 },
  itemBody: { fontSize: 13, marginTop: 2 },
  itemMeta: { fontSize: 11, marginTop: 3, textTransform: 'capitalize' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 48 },
  emptyText: { fontSize: 14 },
});
