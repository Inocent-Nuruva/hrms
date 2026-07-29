import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Landmark,
  Plus,
  X,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { Button } from '../components/ui/button';
import { SegmentedControl } from '../components/ui/segmented-control';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { StatusPill } from '../components/ui/status-pill';
import { LoadingIndicator } from '../components/ui/loading-indicator';
import { ScreenTransition } from '../components/ui/screen-transition';
import { TouchableScale } from '../components/ui/touchable-scale';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useToast } from '../hooks/useToast';

type MobileRecord = Record<string, unknown>;
type LeaveTab = 'requests' | 'balances' | 'holidays' | 'policies';
type DateFieldKey = 'start_date' | 'end_date';
type MobileApi = typeof api & {
  listLeavePolicies?: (params?: Record<string, unknown>) => Promise<unknown>;
};

const LEAVE_TABS: Array<{ key: LeaveTab; label: string }> = [
  { key: 'requests', label: 'Requests' },
  { key: 'balances', label: 'Balances' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'policies', label: 'Policies' },
];

interface Props {
  auth: UseAuthReturn;
  requestId?: string;
}

export function LeaveScreen({ auth, requestId }: Props) {
  const { isDark } = useThemePreference();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LeaveTab>('requests');
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [selectingDateField, setSelectingDateField] = useState<DateFieldKey | null>(null);
  const [selectingLeaveType, setSelectingLeaveType] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });

  const toast = useToast();

  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const subtleBlock = isDark ? COLORS.surfaceVariantDark : '#e8ebf5';
  const outlineColor = isDark ? COLORS.outlineDark : COLORS.outline;
  const overlayColor = isDark ? 'rgba(9,9,11,0.82)' : 'rgba(15,23,42,0.32)';
  const apiWithPolicies: MobileApi = api;

  const balancesQuery = useQuery({
    queryKey: ['mobileLeaveBalances'],
    queryFn: async () => normalizeList(await api.listMyLeaveBalances({ limit: 20 })),
    enabled: auth.isAuthenticated,
  });

  const totalRemainingDays = React.useMemo(() => {
    return (balancesQuery.data || []).reduce((acc: number, bal) => {
      const rec = asRecord(bal);
      const val = readNumberOrString(rec, ['remaining', 'balance']) || 0;
      return acc + (typeof val === 'number' ? val : Number(val) || 0);
    }, 0);
  }, [balancesQuery.data]);
  const requestsQuery = useQuery({
    queryKey: ['mobileLeaveRequests'],
    queryFn: async () => normalizeList(await api.listMyLeaveRequests({ limit: 20 })),
    enabled: auth.isAuthenticated,
  });
  const typesQuery = useQuery({
    queryKey: ['mobileLeaveTypes'],
    queryFn: async () => normalizeList(await api.listLeaveTypes({ limit: 50 })),
    enabled: auth.isAuthenticated,
  });
  const holidaysQuery = useQuery({
    queryKey: ['mobileLeaveHolidays'],
    queryFn: async () => normalizeList(await api.listHolidays({ limit: 20 })),
    enabled: auth.isAuthenticated,
  });
  const policiesQuery = useQuery({
    queryKey: ['mobileLeavePolicies'],
    queryFn: async () => {
      const result = apiWithPolicies.listLeavePolicies
        ? await apiWithPolicies.listLeavePolicies({ limit: 20 })
        : await api.listLeaveTypes({ limit: 20 });
      return normalizeList(result);
    },
    enabled: auth.isAuthenticated,
  });

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.createMyLeaveRequest(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mobileLeaveRequests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileLeaveBalances'] }),
      ]);
      setShowApplyForm(false);
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      toast.success('Your leave request was submitted successfully.');
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Submission failed. Please review the form and try again.'),
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      balancesQuery.refetch(),
      requestsQuery.refetch(),
      typesQuery.refetch(),
      holidaysQuery.refetch(),
      policiesQuery.refetch(),
    ]);
  }, [balancesQuery, holidaysQuery, policiesQuery, requestsQuery, typesQuery]);

  const leaveTypes = useMemo(
    () => (typesQuery.data || []).map((item) => asRecord(item)).filter((item): item is MobileRecord => Boolean(item)),
    [typesQuery.data]
  );
  const selectedLeaveType = leaveTypes.find((item) => String(item.id ?? '') === form.leave_type_id);
  const selectedLeaveTypeLabel =
    readString(selectedLeaveType, ['name', 'display_name']) || 'Select leave type';
  const highlightedRequestId = requestId ? String(requestId) : '';

  const activeQuery =
    activeTab === 'requests'
      ? requestsQuery
      : activeTab === 'balances'
        ? balancesQuery
        : activeTab === 'holidays'
          ? holidaysQuery
          : policiesQuery;

  const activeHasItems = Array.isArray(activeQuery.data) && activeQuery.data.length > 0;

  const submitRequest = () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error('Select a leave type and provide both dates.');
      return;
    }
    submitMutation.mutate({
      leave_type_id: Number(form.leave_type_id),
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason || undefined,
    });
  };

  const openDateField = (field: DateFieldKey) => {
    const seedValue = field === 'start_date' ? form.start_date : form.end_date;
    setSelectingDateField(field);
    setCalendarMonth(startOfMonth(parseIsoDate(seedValue) || new Date()));
  };

  React.useEffect(() => {
    if (highlightedRequestId) {
      setActiveTab('requests');
    }
  }, [highlightedRequestId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} variant="compact" menuPresentation="dropdown" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <ScreenTransition>

          <View style={{ marginBottom: 12 }}>
            <Button
              onPress={() => setShowApplyForm((current) => !current)}
              variant="default"
              leftIcon={<Plus size={16} color="#ffffff" />}
              style={{ marginBottom: 8 }}
            >
              New leave request
            </Button>
            <Text style={[styles.heroTitleSmall, { color: mutedColor }]}>
              Plan, request, and review your time off
            </Text>
          </View>

          <SegmentedControl
            value={activeTab}
            onChange={(next) => setActiveTab(next as LeaveTab)}
            options={LEAVE_TABS.map((item) => ({ key: item.key, label: item.label }))}
          />

          <View>
            {activeQuery.isFetching && !activeHasItems ? (
              <View style={styles.loadingState}>
                <LoadingIndicator type="dot-circle" size="md" />
              </View>
            ) : null}

          {activeTab === 'requests' ? (
            <>
              <SectionHeader title="My requests" icon={<FileText size={18} color={mutedColor} />} textColor={textColor} />
              {requestsQuery.data?.length ? (
                requestsQuery.data.map((request, index: number) => {
                  const item = asRecord(request);
                  const leaveType = asRecord(item?.leave_type);
                  const rowRequestId = String(item?.id ?? '');
                  const isHighlighted = highlightedRequestId === rowRequestId;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.listRow,
                        isHighlighted
                          ? {
                              paddingHorizontal: 4,
                            }
                          : null,
                        index !== 0 && !isHighlighted ? [styles.withTopBorder, { borderTopColor: outlineColor }] : null,
                      ]}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={[styles.primaryText, { color: textColor }]}>
                          {readString(leaveType, ['name']) || readString(item, ['leave_type_name']) || 'Leave request'}
                        </Text>
                        <Text style={[styles.secondaryText, { color: mutedColor }]}>
                          {formatDate(readString(item, ['start_date']))} - {formatDate(readString(item, ['end_date']))}
                        </Text>
                      </View>
                      <StatusPill label={readString(item, ['status']) || 'pending'} tone={statusTone(readString(item, ['status']))} />
                    </View>
                  );
                })
              ) : (
                <Text style={[styles.emptyText, { color: mutedColor }]}>No leave requests yet.</Text>
              )}
            </>
          ) : null}

          {activeTab === 'balances' ? (
            <>
              <SectionHeader title="Leave balances" icon={<Landmark size={18} color={mutedColor} />} textColor={textColor} />
              {balancesQuery.data?.length ? (
                <>
                  <View style={[styles.balanceRow, { marginBottom: 4 }]}>
                    <Text style={[styles.primaryText, { color: COLORS.primary }]}>Total Remaining</Text>
                    <StatusPill label={`${totalRemainingDays} days`} tone="success" />
                  </View>
                  {balancesQuery.data.map((balance, index: number) => {
                    const item = asRecord(balance);
                    const leaveType = asRecord(item?.leave_type);
                    return (
                      <View key={index} style={[styles.balanceRow, index !== 0 ? [styles.withTopBorder, { borderTopColor: outlineColor }] : null]}>
                        <Text style={[styles.primaryText, { color: textColor }]}>
                          {readString(leaveType, ['name']) || readString(item, ['name']) || 'Leave'}
                        </Text>
                        <StatusPill label={`${readNumberOrString(item, ['remaining', 'balance']) || '—'} days`} tone="info" />
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text style={[styles.emptyText, { color: mutedColor }]}>No leave balances found.</Text>
              )}
            </>
          ) : null}

          {activeTab === 'holidays' ? (
            <>
              <SectionHeader title="Holidays" icon={<CalendarDays size={18} color={mutedColor} />} textColor={textColor} />
              {holidaysQuery.data?.length ? (
                holidaysQuery.data.map((holiday, index: number) => {
                  const item = asRecord(holiday);
                  const holidayColors = ['#2e3d8a', '#dd3740', '#15803d', '#f59e0b', '#7c3aed'];
                  const holidayColor = holidayColors[index % holidayColors.length];
                  return (
                    <View key={index} style={[styles.listRow, index !== 0 ? [styles.withTopBorder, { borderTopColor: outlineColor }] : null]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.primaryText, { color: holidayColor, fontWeight: '700' }]}>
                          {readString(item, ['name', 'holiday_name']) || 'Holiday'}
                        </Text>
                        <Text style={[styles.secondaryText, { color: mutedColor }]}>
                          {formatDate(readString(item, ['date', 'holiday_date']))}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={[styles.emptyText, { color: mutedColor }]}>No holidays listed.</Text>
              )}
            </>
          ) : null}

          {activeTab === 'policies' ? (
            <>
              <SectionHeader title="Policies" icon={<FileText size={18} color={mutedColor} />} textColor={textColor} />
              {policiesQuery.data?.length ? (
                policiesQuery.data.map((policy, index: number) => {
                  const item = asRecord(policy);
                  return (
                    <View key={index} style={[styles.listRow, index !== 0 ? [styles.withTopBorder, { borderTopColor: outlineColor }] : null]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.primaryText, { color: textColor }]}>
                          {readString(item, ['name', 'policy_name']) || 'Policy'}
                        </Text>
                        <Text style={[styles.secondaryText, { color: mutedColor }]}>
                          {readString(item, ['status']) || 'Active'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={[styles.emptyText, { color: mutedColor }]}>No policies available.</Text>
              )}
            </>
          ) : null}
          </View>
        </ScreenTransition>
      </ScrollView>

      <Modal visible={showApplyForm} animationType="slide" transparent onRequestClose={() => setShowApplyForm(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: overlayColor }]}>
          <View style={{ backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, padding: 20, borderRadius: 16, maxHeight: '85%' }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>New leave request</Text>
              <TouchableScale onPress={() => setShowApplyForm(false)} style={[styles.closeButton, { backgroundColor: subtleBlock }]} pressedScale={0.95}>
                <X size={16} color={textColor} />
              </TouchableScale>
            </View>

            <Text style={[styles.fieldLabel, { color: mutedColor }]}>Leave type</Text>
            <TouchableScale
              style={[
                styles.selectField,
                {
                  backgroundColor: isDark ? COLORS.surfaceVariantDark : '#fafafa',
                  borderColor: outlineColor,
                },
              ]}
              onPress={() => setSelectingLeaveType(true)}
              pressedScale={0.98}
            >
              <Text style={[styles.selectFieldText, { color: form.leave_type_id ? textColor : mutedColor }]}>
                {selectedLeaveTypeLabel}
              </Text>
              <ChevronDown size={18} color={mutedColor} />
            </TouchableScale>

            <Text style={[styles.inputLabel, { color: textColor }]}>Start date</Text>
            <DateFieldButton
              value={form.start_date}
              placeholder="YYYY-MM-DD"
              onPress={() => openDateField('start_date')}
              textColor={textColor}
              mutedColor={mutedColor}
              isDark={isDark}
              outlineColor={outlineColor}
            />

            <Text style={[styles.inputLabel, { color: textColor }]}>End date</Text>
            <DateFieldButton
              value={form.end_date}
              placeholder="YYYY-MM-DD"
              onPress={() => openDateField('end_date')}
              textColor={textColor}
              mutedColor={mutedColor}
              isDark={isDark}
              outlineColor={outlineColor}
            />

            <Text style={[styles.inputLabel, { color: textColor }]}>Reason</Text>
            <NativeTextArea
              value={form.reason}
              onChange={(value) => setForm((current) => ({ ...current, reason: value }))}
              textColor={textColor}
              mutedColor={mutedColor}
              isDark={isDark}
              outlineColor={outlineColor}
            />

            <View style={styles.formActions}>
              <Button variant="ghost" onPress={() => setShowApplyForm(false)} style={styles.flexButton}>
                Cancel
              </Button>
              <Button onPress={submitRequest} loading={submitMutation.isPending} style={styles.flexButton}>
                Submit request
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={selectingLeaveType} transparent animationType="fade" onRequestClose={() => setSelectingLeaveType(false)}>
        <View style={[styles.pickerOverlay, { backgroundColor: overlayColor }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectingLeaveType(false)} />
          <View style={{ backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderRadius: 14, overflow: 'hidden', marginHorizontal: 20, marginTop: 'auto', marginBottom: 'auto' }}>
            {leaveTypes.map((item) => {
              const id = String(item.id ?? '');
              const selected = form.leave_type_id === id;
              return (
                <TouchableScale
                  key={id}
                  style={[styles.dropdownOption, selected ? { backgroundColor: isDark ? COLORS.surfaceVariantDark : '#e0e5f5' } : null]}
                  onPress={() => {
                    setForm((current) => ({ ...current, leave_type_id: id }));
                    setSelectingLeaveType(false);
                  }}
                  pressedScale={0.99}
                >
                  <Text style={[styles.dropdownOptionText, { color: textColor }]}>
                    {readString(item, ['name', 'display_name']) || `Type ${id}`}
                  </Text>
                </TouchableScale>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectingDateField)} transparent animationType="fade" onRequestClose={() => setSelectingDateField(null)}>
        <View style={[styles.pickerOverlay, { backgroundColor: overlayColor }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectingDateField(null)} />
          <View style={{ backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderRadius: 20, padding: 16, marginHorizontal: 20, marginTop: 'auto', marginBottom: 'auto' }}>
            <View style={styles.calendarHeader}>
              <TouchableScale style={[styles.calendarNav, { backgroundColor: subtleBlock }]} onPress={() => setCalendarMonth((current) => shiftMonth(current, -1))} pressedScale={0.94}>
                <ChevronLeft size={18} color={textColor} />
              </TouchableScale>
              <Text style={[styles.calendarTitle, { color: textColor }]}>
                {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableScale style={[styles.calendarNav, { backgroundColor: subtleBlock }]} onPress={() => setCalendarMonth((current) => shiftMonth(current, 1))} pressedScale={0.94}>
                <ChevronRight size={18} color={textColor} />
              </TouchableScale>
            </View>

            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: mutedColor }]}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {buildCalendarDays(calendarMonth).map((day) => {
                const iso = toIsoDate(day.date);
                const selected = selectingDateField ? form[selectingDateField] === iso : false;
                return (
                  <TouchableScale
                    key={iso}
                    style={[
                      styles.dayCell,
                      !day.inMonth ? styles.dayCellMuted : null,
                      selected ? { backgroundColor: COLORS.primary } : null,
                    ]}
                    onPress={() => {
                      if (!selectingDateField) return;
                      setForm((current) => ({ ...current, [selectingDateField]: iso }));
                      setSelectingDateField(null);
                    }}
                    pressedScale={0.92}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        { color: selected ? '#ffffff' : day.inMonth ? textColor : mutedColor },
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                  </TouchableScale>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  icon,
  textColor,
}: {
  title: string;
  icon: React.ReactNode;
  textColor: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
      {icon}
    </View>
  );
}

function DateFieldButton({
  value,
  placeholder,
  onPress,
  textColor,
  mutedColor,
  isDark,
  outlineColor,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
  textColor: string;
  mutedColor: string;
  isDark: boolean;
  outlineColor: string;
}) {
  return (
    <TouchableScale
      style={[
        styles.dateField,
        {
          backgroundColor: isDark ? COLORS.surfaceVariantDark : '#fafafa',
          borderColor: outlineColor,
        },
      ]}
      onPress={onPress}
      pressedScale={0.98}
    >
      <Text style={[styles.dateFieldText, { color: value ? textColor : mutedColor }]}>
        {value || placeholder}
      </Text>
      <CalendarDays size={18} color={mutedColor} />
    </TouchableScale>
  );
}

function NativeTextArea({
  value,
  onChange,
  textColor,
  mutedColor,
  isDark,
  outlineColor,
}: {
  value: string;
  onChange: (value: string) => void;
  textColor: string;
  mutedColor: string;
  isDark: boolean;
  outlineColor: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Optional supporting note"
      placeholderTextColor={mutedColor}
      multiline
      textAlignVertical="top"
      style={[
        styles.hiddenTextAreaInput,
        {
          backgroundColor: isDark ? COLORS.surfaceVariantDark : '#fafafa',
          borderColor: outlineColor,
          color: textColor,
        },
      ]}
    />
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

function readNumberOrString(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return '';

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  return '';
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(value).slice(0, 10);
  }
}

function statusTone(status?: string): 'neutral' | 'success' | 'warning' | 'danger' {
  const value = String(status || '').toLowerCase();
  if (value.includes('approve')) return 'success';
  if (value.includes('reject') || value.includes('cancel')) return 'danger';
  return 'warning';
}

function parseIsoDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function buildCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = firstDay.getDay();
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      inMonth: date.getMonth() === month.getMonth(),
    };
  });
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 36,
    gap: 8,
  },
  heroTitleSmall: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  loadingState: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 6,
  },
  selectField: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  selectFieldText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dateField: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateFieldText: {
    fontSize: 15,
  },
  hiddenTextAreaInput: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  flexButton: {
    flex: 1,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  dropdownOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calendarNav: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayCell: {
    width: '13.4%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellMuted: {
    opacity: 0.45,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  listRow: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceRow: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  withTopBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryText: {
    marginTop: 4,
    fontSize: 13,
  },
  emptyText: {
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
