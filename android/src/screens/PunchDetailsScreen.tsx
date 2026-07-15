import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Clock3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LoadingIndicator } from '../components/ui/loading-indicator';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
}

export function PunchDetailsScreen({ auth }: Props) {
  const router = useRouter();
  const { isDark } = useThemePreference();
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const panelColor = isDark ? COLORS.surfaceDark : COLORS.surface;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;

  const punchesQuery = useQuery({
    queryKey: ['mobilePunchDetails'],
    queryFn: async () => normalizeList(await api.listMyPunches({ limit: 100 })),
    enabled: auth.isAuthenticated,
  });

  const onRefresh = React.useCallback(async () => {
    await punchesQuery.refetch();
  }, [punchesQuery]);

  const openDatePicker = () => {
    const current = new Date(filterDate);
    setPickerYear(current.getFullYear());
    setPickerMonth(current.getMonth() + 1);
    setPickerDay(current.getDate());
    setShowDatePicker(true);
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = React.useState(todayKey);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [pickerYear, setPickerYear] = React.useState(new Date(filterDate).getFullYear());
  const [pickerMonth, setPickerMonth] = React.useState(new Date(filterDate).getMonth() + 1);
  const [pickerDay, setPickerDay] = React.useState(new Date(filterDate).getDate());

  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const datePunches = (punchesQuery.data || [])
    .map((item) => asRecord(item))
    .filter((item): item is MobileRecord => Boolean(item))
    .filter((item) => {
      const stamp = readString(item, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']);
      if (!stamp) return false;
      return new Date(stamp).toISOString().slice(0, 10) === filterDate;
    })
    .sort((a, b) => {
      const left = new Date(readString(a, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']) || 0).getTime();
      const right = new Date(readString(b, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']) || 0).getTime();
      return left - right;
    });

  const filteredPunches = datePunches;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} variant="compact" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={punchesQuery.isFetching} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <ScreenTransition>
          <Text style={[styles.title, { color: textColor }]}>Punches</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>{new Date(filterDate).toLocaleDateString()}</Text>

          {/* Date filter */}
          <View style={styles.filterBar}>
            <Text style={[styles.filterLabel, { color: mutedColor }]}>Filter by date:</Text>
            <View style={styles.dateNav}>
              <TouchableOpacity onPress={() => {
                const d = new Date(filterDate);
                d.setDate(d.getDate() - 1);
                const newDate = d.toISOString().slice(0, 10);
                setFilterDate(newDate);
              }}>
                <Text style={{ color: COLORS.primary, fontSize: 18 }}>←</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={openDatePicker}
                style={[styles.dateSelector, { backgroundColor: isDark ? '#27272a' : '#f4f6fa', borderColor: isDark ? COLORS.outlineDark : '#c5cde0' }]}
              >
                <Text style={[styles.filterDateText, { color: textColor }]}>
                  {new Date(filterDate).toLocaleDateString()}
                </Text>
                <Text style={{ color: COLORS.primary, fontSize: 12, marginLeft: 4 }}>📅</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                const d = new Date(filterDate);
                d.setDate(d.getDate() + 1);
                const newDate = d.toISOString().slice(0, 10);
                setFilterDate(newDate);
              }}>
                <Text style={{ color: COLORS.primary, fontSize: 18 }}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterDate(todayKey)} style={styles.todayChip}>
                <Text style={{ color: '#fff', fontSize: 12 }}>Today</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: panelColor }]}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Select Date</Text>

                <View style={styles.pickerRow}>
                  {/* Year */}
                  <ScrollView style={[styles.pickerColumn, { backgroundColor: panelColor }]} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - 5 + i;
                      return (
                        <TouchableOpacity
                          key={year}
                          onPress={() => {
                            setPickerYear(year);
                            const maxDays = getDaysInMonth(year, pickerMonth);
                            if (pickerDay > maxDays) setPickerDay(maxDays);
                          }}
                          style={styles.pickerItemContainer}
                        >
                          <Text style={[
                            styles.pickerItem,
                            { color: pickerYear === year ? COLORS.primary : mutedColor },
                            pickerYear === year && styles.pickerItemSelected
                          ]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Month */}
                  <ScrollView style={[styles.pickerColumn, { backgroundColor: panelColor }]} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      return (
                        <TouchableOpacity
                          key={month}
                          onPress={() => {
                            setPickerMonth(month);
                            const maxDays = getDaysInMonth(pickerYear, month);
                            if (pickerDay > maxDays) setPickerDay(maxDays);
                          }}
                          style={styles.pickerItemContainer}
                        >
                          <Text style={[
                            styles.pickerItem,
                            { color: pickerMonth === month ? COLORS.primary : mutedColor },
                            pickerMonth === month && styles.pickerItemSelected
                          ]}>
                            {String(month).padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Day */}
                  <ScrollView style={[styles.pickerColumn, { backgroundColor: panelColor }]} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: getDaysInMonth(pickerYear, pickerMonth) }, (_, i) => {
                      const day = i + 1;
                      return (
                        <TouchableOpacity
                          key={day}
                          onPress={() => setPickerDay(day)}
                          style={styles.pickerItemContainer}
                        >
                          <Text style={[
                            styles.pickerItem,
                            { color: pickerDay === day ? COLORS.primary : mutedColor },
                            pickerDay === day && styles.pickerItemSelected
                          ]}>
                            {String(day).padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={{ color: mutedColor, fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      const y = pickerYear;
                      const m = String(pickerMonth).padStart(2, '0');
                      const d = String(pickerDay).padStart(2, '0');
                      setFilterDate(`${y}-${m}-${d}`);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={{ color: COLORS.primary, fontSize: 16, fontWeight: '600' }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {punchesQuery.isLoading ? (
            <View style={styles.loaderWrap}>
              <LoadingIndicator size="md" />
            </View>
          ) : filteredPunches.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: panelColor }]}>
              <Text style={[styles.emptyText, { color: mutedColor }]}>No punches for this date.</Text>
            </View>
          ) : (
            filteredPunches.map((punch, index) => {
              const time = formatTime(readString(punch, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']));
              const type = readString(punch, ['punch_type', 'punchType', 'type']).toUpperCase();
              const isIn = type.includes('IN') || type === 'IN';
              return (
                <View key={index} style={[styles.punchCard, { backgroundColor: panelColor, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
                  <View style={styles.punchRow}>
                    <View style={[styles.punchIcon, { backgroundColor: isIn ? '#dcfce7' : '#fee2e2' }]}>
                      <Clock3 size={18} color={isIn ? '#16a34a' : '#dc2626'} />
                    </View>
                    <View style={styles.punchInfo}>
                      <Text style={[styles.punchType, { color: textColor }]}>{type || 'PUNCH'}</Text>
                      <Text style={[styles.punchTime, { color: mutedColor }]}>{time}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScreenTransition>
      </ScrollView>

      {/* Bottom bar to keep navigation visible */}
      <View style={{ padding: 12, backgroundColor: panelColor, borderTopWidth: 1, borderTopColor: isDark ? COLORS.outlineDark : COLORS.outline, flexDirection: 'row', justifyContent: 'center' }}>
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
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
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  punchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchInfo: {
    flex: 1,
  },
  punchType: {
    fontSize: 15,
    fontWeight: '700',
  },
  punchTime: {
    fontSize: 13,
    marginTop: 2,
  },
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  filterBar: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterDateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayChip: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f6fa',
    borderWidth: 1,
    borderColor: '#c5cde0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  // Modal styles for real date picker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 200,
  },
  pickerColumn: {
    width: 70,
    borderWidth: 1,
    borderColor: '#c5cde0',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#f8fafc',
  },
  pickerItemContainer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItem: {
    fontSize: 16,
  },
  pickerItemSelected: {
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#c5cde0',
  },
  modalButton: {
    padding: 8,
  },
});
