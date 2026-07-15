import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { LoadingIndicator } from '../components/ui/loading-indicator';
import { useRouter } from 'expo-router';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
}

export function MyAttendanceScreen({ auth }: Props) {
  const router = useRouter();
  const { isDark } = useThemePreference();
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const panelColor = isDark ? COLORS.surfaceDark : COLORS.surface;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const lineColor = isDark ? COLORS.outlineDark : COLORS.outline;

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const todayQuery = useQuery({
    queryKey: ['mobileMyAttendanceToday'],
    queryFn: async () => asRecord(await api.getMyAttendanceToday()),
    enabled: auth.isAuthenticated,
  });

  const historyQuery = useQuery({
    queryKey: ['mobileMyAttendanceHistory', selectedDate],
    queryFn: async () => {
      const res = await api.listMyAttendanceHistory({
        from_date: selectedDate,
        to_date: selectedDate,
        limit: 20,
        sortBy: 'attendanceDate',
        sortOrder: 'DESC',
      });
      const data = (res as MobileRecord).data || normalizeList(res);
      return data as MobileRecord[];
    },
    enabled: auth.isAuthenticated,
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([todayQuery.refetch(), historyQuery.refetch()]);
  }, [todayQuery, historyQuery]);

  const dateRecords = (historyQuery.data || [])
    .map((item) => asRecord(item))
    .filter((item): item is MobileRecord => Boolean(item))
    .filter((item) => readString(item, ['attendanceDate', 'attendance_date']) === selectedDate);

  const selectedRecord = dateRecords[0] || (todayQuery.data as MobileRecord | null) || null;

  const checkIn = readString(selectedRecord, ['checkInAt', 'check_in_at', 'first_punch', 'firstCheckInAt', 'first_punch_at']);
  const checkOut = readString(selectedRecord, ['checkOutAt', 'check_out_at', 'last_punch', 'lastCheckOutAt', 'last_punch_at']);
  let totalHours = readString(selectedRecord, ['workMinutes', 'workedHours', 'worked_hours', 'total_worked_hours', 'hours_worked', 'totalHours']) || '--:--';
  if (totalHours !== '--:--' && !isNaN(Number(totalHours))) {
    const mins = Number(totalHours);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    totalHours = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const displayDate = new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);
  const todayData = isToday ? todayQuery.data : null;
  const richCheckIn = todayData ? readString(todayData, ['checkInAt', 'check_in_at', 'first_punch', 'firstCheckInAt', 'first_punch_at']) : '';
  const richCheckOut = todayData ? readString(todayData, ['checkOutAt', 'check_out_at', 'last_punch', 'lastCheckOutAt', 'last_punch_at']) : '';
  const richTotal = todayData ? readString(todayData, ['workMinutes', 'workedHours', 'worked_hours', 'total_worked_hours', 'hours_worked', 'totalHours']) : '';

  const finalCheckIn = checkIn || richCheckIn;
  const finalCheckOut = checkOut || richCheckOut;
  const finalTotal = (totalHours && totalHours !== '--:--') ? totalHours : (richTotal || '--:--');

  const punchesList = dateRecords.length > 0 ? dateRecords : (historyQuery.data || []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} variant="compact" />
      {/* Fixed header with summary */}
      <View style={styles.fixedHeader}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: textColor }]}>My Attendance</Text>
              <TouchableOpacity onPress={() => setSelectedDate(new Date().toISOString().slice(0, 10))} style={styles.filterButton}>
                <Calendar size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.dateNav}>
              <TouchableOpacity onPress={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().slice(0, 10));
              }}>
                <ChevronLeft size={20} color={mutedColor} />
              </TouchableOpacity>
              <Text style={[styles.dateText, { color: textColor }]}>{displayDate}</Text>
              <TouchableOpacity onPress={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().slice(0, 10));
              }}>
                <ChevronRight size={20} color={mutedColor} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setSelectedDate(new Date().toISOString().slice(0, 10))} 
                style={styles.todayButton}>
                <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>Today</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: panelColor }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: mutedColor }]}>Check In</Text>
                  <Text style={[styles.summaryValue, { color: textColor }]}>{formatTime(finalCheckIn)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: mutedColor }]}>Check Out</Text>
                  <Text style={[styles.summaryValue, { color: textColor }]}>{formatTime(finalCheckOut)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: mutedColor }]}>Total</Text>
                  <Text style={[styles.summaryValue, { color: textColor }]}>{finalTotal}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Scrollable list only */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={historyQuery.isFetching || todayQuery.isFetching} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          >
            {historyQuery.isLoading || todayQuery.isLoading ? (
              <View style={styles.loaderWrap}>
                <LoadingIndicator size="md" />
              </View>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: textColor }]}>History</Text>

                {punchesList.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: panelColor }]}>
                    <Text style={[styles.emptyText, { color: mutedColor }]}>No records for this date.</Text>
                  </View>
                ) : (
                  punchesList.map((record: MobileRecord, index: number) => {
                    const date = readString(record, ['attendanceDate', 'attendance_date']);
                    const checkInTime = formatTime(readString(record, ['checkInAt', 'check_in_at']));
                    const checkOutTime = formatTime(readString(record, ['checkOutAt', 'check_out_at']));
                    const workMins = readString(record, ['workMinutes', 'work_minutes']);
                    const status = readString(record, ['attendanceStatus', 'attendance_status']) || 'PRESENT';
                    return (
                      <View key={index} style={[styles.punchCard, { backgroundColor: panelColor }]}>
                        <View style={styles.punchRow}>
                          <View style={styles.punchInfo}>
                            <Text style={[styles.punchType, { color: textColor }]}>{date}</Text>
                            <Text style={[styles.punchMeta, { color: mutedColor }]}>In: {checkInTime} • Out: {checkOutTime} • {workMins ? workMins + ' min' : ''}</Text>
                            <Text style={[styles.punchMeta, { color: mutedColor }]}>Status: {status}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </ScrollView>

          {/* Bottom bar to mimic tab visibility */}
          <View style={{ padding: 12, backgroundColor: panelColor, borderTopWidth: 1, borderTopColor: lineColor, flexDirection: 'row', justifyContent: 'center' }}>
            <TouchableOpacity onPress={() => { if (router.back) router.back(); else router.push('/(tabs)/attendance'); }} style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: COLORS.primary, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Back to Attendance</Text>
            </TouchableOpacity>
          </View>
      </SafeAreaView>
  );
}

function asRecord(value: unknown): MobileRecord | null {
  return value && typeof value === 'object' ? (value as MobileRecord) : null;
}

function readString(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return '';
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function formatTime(value: string) {
  if (!value) return '--:--';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  fixedHeader: {
    paddingHorizontal: 16,
    paddingTop: 6,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  filterButton: {
    padding: 8,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  todayButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 6,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  emptyCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  punchCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  punchIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchInfo: {
    flex: 1,
  },
  punchType: {
    fontSize: 14,
    fontWeight: '700',
  },
  punchMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});
