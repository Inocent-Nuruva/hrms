import React, { useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, FileText, Landmark, Plus, X } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { SegmentedControl } from '../components/ui/segmented-control';
import { StatusPill } from '../components/ui/status-pill';

type MobileRecord = Record<string, unknown>;
type MobileApi = typeof api & {
  listLeavePolicies?: (params?: Record<string, unknown>) => Promise<unknown>;
};

const LEAVE_TABS = [
  { key: 'requests', label: 'Requests' },
  { key: 'balances', label: 'Balances' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'policies', label: 'Policies' },
] as const;

type LeaveTab = typeof LEAVE_TABS[number]['key'];

interface Props {
  auth: { user?: MobileRecord | null; employee?: MobileRecord | null; refreshProfile?: () => Promise<void> };
}

export function LeaveScreen({ auth }: Props) {
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LeaveTab>('requests');
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });

  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const subtleBlock = isDark ? COLORS.surfaceVariantDark : '#f5f5f5';
  const overlayColor = isDark ? 'rgba(9,9,11,0.82)' : 'rgba(15,23,42,0.32)';
  const apiWithPolicies: MobileApi = api;

  const balancesQuery = useQuery({
    queryKey: ['mobileLeaveBalances'],
    queryFn: async () => normalizeList(await api.listMyLeaveBalances({ limit: 20 })),
  });
  const requestsQuery = useQuery({
    queryKey: ['mobileLeaveRequests'],
    queryFn: async () => normalizeList(await api.listMyLeaveRequests({ limit: 20 })),
  });
  const typesQuery = useQuery({
    queryKey: ['mobileLeaveTypes'],
    queryFn: async () => normalizeList(await api.listLeaveTypes({ limit: 50 })),
  });
  const holidaysQuery = useQuery({
    queryKey: ['mobileLeaveHolidays'],
    queryFn: async () => normalizeList(await api.listHolidays({ limit: 20 })),
  });
  const policiesQuery = useQuery({
    queryKey: ['mobileLeavePolicies'],
    queryFn: async () => {
      const result = apiWithPolicies.listLeavePolicies
        ? await apiWithPolicies.listLeavePolicies({ limit: 20 })
        : await api.listLeaveTypes({ limit: 20 });
      return normalizeList(result);
    },
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
      Alert.alert('Request created', 'Your leave request was submitted successfully.');
    },
    onError: (error: unknown) =>
      Alert.alert('Submission failed', error instanceof Error ? error.message : 'Please review the form and try again.'),
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      balancesQuery.refetch(),
      requestsQuery.refetch(),
      typesQuery.refetch(),
      holidaysQuery.refetch(),
      policiesQuery.refetch(),
      auth.refreshProfile?.(),
    ]);
  }, [auth, balancesQuery, holidaysQuery, policiesQuery, requestsQuery, typesQuery]);

  const submitRequest = () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      Alert.alert('Missing information', 'Select a leave type and provide both dates.');
      return;
    }
    submitMutation.mutate({
      leave_type_id: Number(form.leave_type_id),
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason || undefined,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: textColor }]}>Plan, request, and review leave</Text>
            </View>
            <View style={[styles.heroIcon, { backgroundColor: subtleBlock }]}>
              <CalendarDays size={22} color={COLORS.primary} />
            </View>
          </View>
          <Button
            onPress={() => setShowApplyForm((current) => !current)}
            variant={showApplyForm ? 'secondary' : 'default'}
            leftIcon={<Plus size={16} color={showApplyForm ? textColor : '#ffffff'} />}
          >
            {showApplyForm ? 'Hide request form' : 'New leave request'}
          </Button>
        </Card>

        <SegmentedControl
          value={activeTab}
          onChange={(next) => setActiveTab(next as LeaveTab)}
          options={LEAVE_TABS.map((item) => ({ key: item.key, label: item.label }))}
        />

      {activeTab === 'requests' ? (
        <Card>
          <SectionHeader title="My requests" icon={<FileText size={18} color={mutedColor} />} textColor={textColor} />
          {requestsQuery.data?.length ? (
            requestsQuery.data.map((request, index: number) => (
              <View key={index} style={[styles.listRow, index !== 0 ? styles.withTopBorder : null]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.primaryText, { color: textColor }]}>
                    {request.leave_type?.name || request.leave_type_name || 'Leave request'}
                  </Text>
                  <Text style={[styles.secondaryText, { color: mutedColor }]}>
                    {formatDate(request.start_date)} - {formatDate(request.end_date)}
                  </Text>
                </View>
                <StatusPill label={String(request.status || 'pending')} tone={statusTone(request.status)} />
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No leave requests yet.</Text>
          )}
        </Card>
      ) : null}

      {activeTab === 'balances' ? (
        <Card>
          <SectionHeader title="Leave balances" icon={<Landmark size={18} color={mutedColor} />} textColor={textColor} />
          {balancesQuery.data?.length ? (
            balancesQuery.data.map((balance, index: number) => (
              <View key={index} style={[styles.balanceRow, index !== 0 ? styles.withTopBorder : null]}>
                <Text style={[styles.primaryText, { color: textColor }]}>
                  {balance.leave_type?.name || balance.name || 'Leave'}
                </Text>
                <StatusPill label={`${balance.remaining ?? balance.balance ?? '—'} days`} tone="info" />
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No leave balances found.</Text>
          )}
        </Card>
      ) : null}

      {activeTab === 'holidays' ? (
        <Card>
          <SectionHeader title="Holidays" icon={<CalendarDays size={18} color={mutedColor} />} textColor={textColor} />
          {holidaysQuery.data?.length ? (
            holidaysQuery.data.map((holiday, index: number) => (
              <View key={index} style={[styles.listRow, index !== 0 ? styles.withTopBorder : null]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.primaryText, { color: textColor }]}>{holiday.name || holiday.holiday_name || 'Holiday'}</Text>
                  <Text style={[styles.secondaryText, { color: mutedColor }]}>{formatDate(holiday.date || holiday.holiday_date)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No holidays listed.</Text>
          )}
        </Card>
      ) : null}

      {activeTab === 'policies' ? (
        <Card>
          <SectionHeader title="Policies" icon={<FileText size={18} color={mutedColor} />} textColor={textColor} />
          {policiesQuery.data?.length ? (
            policiesQuery.data.map((policy, index: number) => (
              <View key={index} style={[styles.listRow, index !== 0 ? styles.withTopBorder : null]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.primaryText, { color: textColor }]}>{policy.name || policy.policy_name || 'Policy'}</Text>
                  <Text style={[styles.secondaryText, { color: mutedColor }]}>{policy.status || 'Active'}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No policies available.</Text>
          )}
        </Card>
      ) : null}
      </ScrollView>

      <Modal visible={showApplyForm} animationType="slide" transparent onRequestClose={() => setShowApplyForm(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: overlayColor }]}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>New leave request</Text>
              <TouchableOpacity onPress={() => setShowApplyForm(false)} style={[styles.closeButton, { backgroundColor: subtleBlock }]}>
                <X size={16} color={textColor} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: mutedColor }]}>Leave type</Text>
            <View style={styles.chipWrap}>
              {(typesQuery.data || []).slice(0, 10).map((type) => {
                const id = String(type.id);
                const selected = form.leave_type_id === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setForm((current) => ({ ...current, leave_type_id: id }))}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: selected ? COLORS.primary : subtleBlock,
                        borderColor: selected ? COLORS.primary : isDark ? COLORS.outlineDark : COLORS.outline,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? '#ffffff' : textColor, fontSize: 13, fontWeight: '700' }}>
                      {type.name || type.display_name || `Type ${id}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Start date"
              value={form.start_date}
              onChangeText={(value) => setForm((current) => ({ ...current, start_date: value }))}
              placeholder="YYYY-MM-DD"
            />
            <Input
              label="End date"
              value={form.end_date}
              onChangeText={(value) => setForm((current) => ({ ...current, end_date: value }))}
              placeholder="YYYY-MM-DD"
            />
            <Input
              label="Reason"
              value={form.reason}
              onChangeText={(value) => setForm((current) => ({ ...current, reason: value }))}
              placeholder="Optional supporting note"
              multiline
              style={{ minHeight: 96 }}
            />

            <View style={styles.formActions}>
              <Button variant="ghost" onPress={() => setShowApplyForm(false)} style={styles.flexButton}>
                Cancel
              </Button>
              <Button onPress={submitRequest} loading={submitMutation.isPending} style={styles.flexButton}>
                Submit request
              </Button>
            </View>
          </Card>
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

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  heroCard: {
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    maxHeight: '88%',
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
  flexButton: {
    flex: 1,
  },
  listRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  withTopBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d4d4d8',
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
