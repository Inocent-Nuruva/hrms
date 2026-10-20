import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Info,
  Landmark,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ButtonV1 as FluentButtonV1 } from '@fluentui-react-native/button';
import {
  CalendarClockColor,
  ClipboardTaskColor,
  CoinMultipleColor,
  CalendarMonthRegular,
  AddStarburstColor,
  RadioButtonFilled,
  RadioButtonRegular,
  ShieldCheckmarkColor,
} from '@fluentui/react-native-icons';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { DEFAULT_PROFILE_CARD_STYLE, normalizeProfileCardStyle, profilePaletteAccent } from '../lib/profile-card-background';
import {
  buildLeaveWorkflowSummary,
  formatLeaveWorkflowStatus,
  leaveWorkflowStatusTone,
} from '../lib/leave-workflow';
import { Button } from '../components/ui/button';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { StatusPill } from '../components/ui/status-pill';
import { LoadingIndicator } from '../components/ui/loading-indicator';
import { ScreenTransition } from '../components/ui/screen-transition';
import { TouchableScale } from '../components/ui/touchable-scale';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useAppAccent } from '../hooks/useAppAccent';
import { useToast } from '../hooks/useToast';
import { Text } from '../components/ui/text';
import { FluentButton } from '../components/ui/fluent-button';
import { FluentInput } from '../components/ui/fluent-input';
import { FluentText } from '../components/ui/fluent-text';

type MobileRecord = Record<string, unknown>;
type LeaveTab = 'requests' | 'balances' | 'holidays' | 'policies';
type DateFieldKey = 'start_date' | 'end_date';
type HolidayFilter = 'all' | 'upcoming' | 'past';
type MobileApi = typeof api & {
  listLeavePolicies?: (params?: Record<string, unknown>) => Promise<unknown>;
};

const LEAVE_TABS = [
  { key: 'balances', label: 'Balances', icon: Landmark },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'holidays', label: 'Holidays', icon: CalendarDays },
  { key: 'policies', label: 'Policies', icon: ShieldCheck },
] as const satisfies ReadonlyArray<{ key: LeaveTab; label: string; icon: typeof FileText }>;

interface Props {
  auth: UseAuthReturn;
  requestId?: string;
  initialTab?: string;
}

export function LeaveScreen({ auth, requestId, initialTab }: Props) {
  const { isDark } = useThemePreference();
  const accent = useAppAccent();
  const [policyInfoOpen, setPolicyInfoOpen] = useState(false);
  const paletteQuery = useQuery({ queryKey: ['dashboardCardStyle'], queryFn: () => api.getMyDashboardCardStyle(), enabled: auth.isAuthenticated });
  const accentColor = profilePaletteAccent(normalizeProfileCardStyle(paletteQuery.data ?? DEFAULT_PROFILE_CARD_STYLE).palette, isDark);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LeaveTab>(() =>
    LEAVE_TABS.some((tab) => tab.key === initialTab) ? (initialTab as LeaveTab) : 'balances',
  );
  useEffect(() => {
    if (LEAVE_TABS.some((tab) => tab.key === initialTab)) {
      setActiveTab(initialTab as LeaveTab);
    }
  }, [initialTab]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [requestDetailVisible, setRequestDetailVisible] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [selectingDateField, setSelectingDateField] = useState<DateFieldKey | null>(null);
  const [leaveTypeMenuOpen, setLeaveTypeMenuOpen] = useState(false);
  const [holidayFilter, setHolidayFilter] = useState<HolidayFilter>('all');
  const [holidayFilterOpen, setHolidayFilterOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<MobileRecord | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<MobileRecord | null>(null);
  const [leaveTabsWidth, setLeaveTabsWidth] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [form, setForm] = useState({ leave_type_id: '', duration_type: 'FULL_DAY', start_date: '', end_date: '', half_day_session: 'FIRST_HALF', start_time: '09:00', end_time: '13:00', reason: '' });
  const [leaveAttachment, setLeaveAttachment] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const openedHighlightedRequestRef = React.useRef('');
  const [tabIndicatorIndex] = React.useState(() => new Animated.Value(0));
  const [tabContentTranslateX] = React.useState(() => new Animated.Value(0));
  const previousTabIndex = React.useRef(0);
  const hasAnimatedTabChange = React.useRef(false);
  const tabPanelWidth = React.useRef(360);

  const toast = useToast();

  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const subtleBlock = isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant;
  const outlineColor = isDark ? COLORS.outlineDark : COLORS.outline;
  const overlayColor = isDark ? 'rgba(9,9,11,0.82)' : 'rgba(15,23,42,0.32)';
  const apiWithPolicies: MobileApi = api;

  const balancesQuery = useQuery({
    queryKey: ['mobileLeaveBalances'],
    queryFn: async () => normalizeLeaveBalanceRows(await api.listMyLeaveBalances({ limit: 20 })),
    enabled: auth.isAuthenticated,
  });

  const totalRemainingDays = React.useMemo(() => {
    const values = (balancesQuery.data || []).map((bal) => readAvailableLeaveDays(asRecord(bal))).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }, [balancesQuery.data]);
  const totalUsedDays = React.useMemo(() => {
    const values = (balancesQuery.data || []).map((row) =>
      readDaysMetric(asRecord(row), ['used_days', 'usedDays', 'taken_days', 'takenDays', 'consumed_days'])
    ).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
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

  const evidenceUploadMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
      if (result.canceled) return false;
      const file = result.assets[0];
      const base64 = await readAsStringAsync(file.uri, { encoding: EncodingType.Base64 });
      await api.uploadMyLeaveRequestDocument(id, { fileName: file.name, mimeType: file.mimeType || 'application/octet-stream', fileSize: file.size || Math.floor(base64.length * 0.75), fileString: base64 });
      return true;
    },
    onSuccess: async (uploaded) => {
      if (!uploaded) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mobileLeaveRequestDetail'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileLeaveRequests'] }),
      ]);
      toast.success('Supporting document uploaded.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (input: { payload: Record<string, unknown>; submit: boolean; attachment: DocumentPicker.DocumentPickerAsset | null }) => {
      const createdPayload = await api.createMyLeaveRequest({ ...input.payload, submit: input.submit && !input.attachment });
      const created = unwrapCreatedLeave(createdPayload);
      const id = readRequestId(created);
      if (input.attachment) {
        if (!id) throw new Error('The request was created, but its ID was not returned, so the attachment could not be uploaded.');
        const base64 = await readAsStringAsync(input.attachment.uri, { encoding: EncodingType.Base64 });
        await api.uploadMyLeaveRequestDocument(id, {
          fileName: input.attachment.name,
          mimeType: input.attachment.mimeType || 'application/octet-stream',
          fileSize: input.attachment.size || Math.floor(base64.length * 0.75),
          fileString: base64,
        });
        if (input.submit) await api.submitMyLeaveRequest(id);
      }
      return input;
    },
    onSuccess: async (input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mobileLeaveRequests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileLeaveBalances'] }),
      ]);
      setShowApplyForm(false);
      setForm({ leave_type_id: '', duration_type: 'FULL_DAY', start_date: '', end_date: '', half_day_session: 'FIRST_HALF', start_time: '09:00', end_time: '13:00', reason: '' });
      setLeaveAttachment(null);
      toast.success(input.submit ? 'Your leave request was submitted successfully.' : 'Your leave request was saved as a draft.');
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Submission failed. Please review the form and try again.'),
  });

  const onRefresh = React.useCallback(async () => {
    const refreshTasks: Array<Promise<unknown>> = [
      balancesQuery.refetch(),
      requestsQuery.refetch(),
      typesQuery.refetch(),
      holidaysQuery.refetch(),
      policiesQuery.refetch(),
    ];
    if (requestDetailVisible && selectedRequestId) {
      refreshTasks.push(
        queryClient.refetchQueries({ queryKey: ['mobileLeaveRequestDetail', selectedRequestId] })
      );
    }
    await Promise.all(refreshTasks);
  }, [
    balancesQuery,
    holidaysQuery,
    policiesQuery,
    queryClient,
    requestDetailVisible,
    requestsQuery,
    selectedRequestId,
    typesQuery,
  ]);

  const leaveTypes = useMemo(
    () => (typesQuery.data || []).map((item) => asRecord(item)).filter((item): item is MobileRecord => Boolean(item)),
    [typesQuery.data]
  );
  const leaveRequests = useMemo(
    () => (requestsQuery.data || []).map((item) => asRecord(item)).filter((item): item is MobileRecord => Boolean(item)),
    [requestsQuery.data]
  );
  const holidayRows = useMemo(
    () => (holidaysQuery.data || [])
      .map((item) => asRecord(item))
      .filter((item): item is MobileRecord => Boolean(item))
      .sort((a, b) => holidayTimestamp(a) - holidayTimestamp(b)),
    [holidaysQuery.data]
  );
  const policyRows = useMemo(
    () => (policiesQuery.data || []).map((item) => asRecord(item)).filter((item): item is MobileRecord => Boolean(item)),
    [policiesQuery.data]
  );
  const todayStart = startOfDay(new Date()).getTime();
  const nextHolidayRow = holidayRows.find((item) => holidayTimestamp(item) >= todayStart) ?? null;
  const visibleHolidayRows = holidayRows.filter((item) => {
    if (holidayFilter === 'all') return true;
    const timestamp = holidayTimestamp(item);
    return holidayFilter === 'upcoming' ? timestamp >= todayStart : timestamp < todayStart;
  });
  const selectedLeaveType = leaveTypes.find((item) => String(item.id ?? '') === form.leave_type_id);
  const selectedLeaveTypeLabel =
    readString(selectedLeaveType, ['name', 'display_name']) || 'Select leave type';
  const selectedLeaveBalance = findBalanceForType(balancesQuery.data || [], form.leave_type_id, selectedLeaveType);
  const availableLeaveDays = readAvailableLeaveDays(asRecord(selectedLeaveBalance));
  const requestedLeaveDays = form.duration_type === 'HALF_DAY'
    ? (form.start_date === form.end_date ? 0.5 : null)
    : form.duration_type === 'SHORT_LEAVE'
      ? (() => {
          if (form.start_date !== form.end_date) return null;
          const [sh, sm] = form.start_time.split(':').map(Number);
          const [eh, em] = form.end_time.split(':').map(Number);
          const minutes = eh * 60 + em - (sh * 60 + sm);
          return minutes > 0 ? Number((minutes / 480).toFixed(2)) : null;
        })()
      : countInclusiveLeaveDays(form.start_date, form.end_date);
  const leaveBalanceError = getLeaveBalanceError(availableLeaveDays, requestedLeaveDays);
  const balanceUnavailableError = form.leave_type_id && !balancesQuery.isLoading && availableLeaveDays === null
    ? 'A balance could not be found for this leave type, so the request cannot be checked. Refresh balances or contact HR.'
    : null;
  const dateRangeError = form.start_date && form.end_date && requestedLeaveDays === null
    ? 'End date must be the same as or later than start date.'
    : null;
  const requestValidationError = dateRangeError || balanceUnavailableError || leaveBalanceError;
  const availableDaysForType = (typeId: string, type?: MobileRecord) =>
    readAvailableLeaveDays(asRecord(findBalanceForType(balancesQuery.data || [], typeId, type)));
  const highlightedRequestId = requestId ? String(requestId) : '';
  const activeTabIndex = Math.max(0, LEAVE_TABS.findIndex((tab) => tab.key === activeTab));
  const selectedRequestFromList = useMemo(
    () =>
      leaveRequests.find((item) => {
        const rowRequestId = readRequestId(item);
        return rowRequestId !== '' && rowRequestId === selectedRequestId;
      }) || null,
    [leaveRequests, selectedRequestId]
  );
  const requestDetailQuery = useQuery({
    queryKey: ['mobileLeaveRequestDetail', selectedRequestId],
    queryFn: async () => {
      if (!selectedRequestId) return null;
      return asRecord(await api.getMyLeaveRequest(selectedRequestId));
    },
    enabled: auth.isAuthenticated && requestDetailVisible && Boolean(selectedRequestId),
  });
  const selectedRequest = asRecord(requestDetailQuery.data) || selectedRequestFromList;
  const requestWorkflow = useMemo(
    () => buildLeaveWorkflowSummary(selectedRequest),
    [selectedRequest]
  );
  const selectedRequestStatus = readString(selectedRequest, ['status']) || 'pending';
  const selectedRequestTypeLabel =
    readString(asRecord(selectedRequest?.leave_type), ['name', 'display_name']) ||
    readString(selectedRequest, ['leave_type_name', 'leave_type', 'type_name']) ||
    'Leave request';
  const selectedRequestReason =
    readString(selectedRequest, ['reason', 'comments', 'comment', 'description', 'notes']) ||
    'No reason provided.';

  const activeQuery =
    activeTab === 'requests'
      ? requestsQuery
      : activeTab === 'balances'
        ? balancesQuery
        : activeTab === 'holidays'
          ? holidaysQuery
          : policiesQuery;

  const activeHasItems = Array.isArray(activeQuery.data) && activeQuery.data.length > 0;

  React.useEffect(() => {
    const indicatorAnimation = Animated.spring(tabIndicatorIndex, {
      toValue: activeTabIndex,
      stiffness: 260,
      damping: 28,
      mass: 0.8,
      useNativeDriver: true,
    });
    indicatorAnimation.start();
    if (hasAnimatedTabChange.current) {
      const direction = activeTabIndex > previousTabIndex.current ? 1 : -1;
      tabContentTranslateX.setValue(direction * tabPanelWidth.current);
      Animated.spring(tabContentTranslateX, {
        toValue: 0,
        stiffness: 240,
        damping: 26,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    } else {
      hasAnimatedTabChange.current = true;
    }
    previousTabIndex.current = activeTabIndex;
    return () => {
      indicatorAnimation.stop();
    };
  }, [activeTabIndex, tabContentTranslateX, tabIndicatorIndex]);

  const submitRequest = () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error('Select a leave type and provide both dates.');
      return;
    }
    if (requestValidationError) {
      toast.error(requestValidationError);
      return;
    }
    const selectedType = leaveTypes.find((item) => String(item.id ?? '') === form.leave_type_id);
    if ((selectedType?.requires_attachment === true || selectedType?.requires_attachment === 'true') && selectedType?.allow_deferred_attachment !== true && selectedType?.allow_deferred_attachment !== 'true' && !leaveAttachment) {
      toast.error('This leave type requires a supporting attachment before submission.');
      return;
    }
    submitMutation.mutate({ submit: true, attachment: leaveAttachment, payload: {
      leave_type_id: Number(form.leave_type_id),
      duration_type: form.duration_type,
      start_date: form.start_date,
      end_date: form.end_date,
      ...(form.duration_type === 'HALF_DAY' ? { half_day_session: form.half_day_session } : {}),
      ...(form.duration_type === 'SHORT_LEAVE' ? { start_time: form.start_time, end_time: form.end_time } : {}),
      reason: form.reason || undefined,
    } });
  };

  const saveDraft = () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error('Select a leave type and provide both dates.');
      return;
    }
    if (requestValidationError) {
      toast.error(requestValidationError);
      return;
    }
    submitMutation.mutate({ submit: false, attachment: leaveAttachment, payload: {
      leave_type_id: Number(form.leave_type_id),
      duration_type: form.duration_type,
      start_date: form.start_date,
      end_date: form.end_date,
      ...(form.duration_type === 'HALF_DAY' ? { half_day_session: form.half_day_session } : {}),
      ...(form.duration_type === 'SHORT_LEAVE' ? { start_time: form.start_time, end_time: form.end_time } : {}),
      reason: form.reason || 'Draft',
    } });
  };

  const pickLeaveAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled) setLeaveAttachment(result.assets[0] ?? null);
  };

  const openDateField = (field: DateFieldKey) => {
    const seedValue = field === 'start_date' ? form.start_date : form.end_date;
    setSelectingDateField(field);
    setCalendarMonth(startOfMonth(parseIsoDate(seedValue) || new Date()));
  };

  const openRequestDetails = React.useCallback((request: MobileRecord | null, requestIdOverride?: string) => {
    const resolvedRequestId = requestIdOverride || readRequestId(request);
    if (!resolvedRequestId) return;
    setActiveTab('requests');
    setSelectedRequestId(resolvedRequestId);
    setRequestDetailVisible(true);
  }, []);

  React.useEffect(() => {
    if (highlightedRequestId) {
      setActiveTab('requests');
    }
  }, [highlightedRequestId]);

  React.useEffect(() => {
    if (!highlightedRequestId) return;
    if (openedHighlightedRequestRef.current === highlightedRequestId) return;
    openedHighlightedRequestRef.current = highlightedRequestId;
    openRequestDetails(null, highlightedRequestId);
  }, [highlightedRequestId, openRequestDetails]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} title="Leave" variant="centered" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[accent]} />}
      >
        <ScreenTransition style={styles.leaveScreenTransition}>

          <View
            accessibilityRole="tablist"
            onLayout={(event) => setLeaveTabsWidth(event.nativeEvent.layout.width)}
            style={[
              styles.leaveTabs,
              { borderBottomColor: outlineColor },
            ]}
          >
            {LEAVE_TABS.map((item) => {
              const selected = activeTab === item.key;
              const TabIcon = item.icon;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveTab(item.key)}
                  style={styles.leaveTab}
                >
                  <View style={styles.leaveTabContent}>
                    <TabIcon size={15} color={selected ? accentColor : mutedColor} strokeWidth={2} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.leaveTabLabel,
                        { color: selected ? accentColor : mutedColor },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {leaveTabsWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.leaveTabIndicator,
                  {
                    width: leaveTabsWidth / LEAVE_TABS.length,
                    backgroundColor: accentColor,
                    transform: [{ translateX: Animated.multiply(tabIndicatorIndex, leaveTabsWidth / LEAVE_TABS.length) }],
                  },
                ]}
              />
            ) : null}
          </View>

          <Animated.View
            onLayout={(event) => { tabPanelWidth.current = event.nativeEvent.layout.width; }}
            style={[
              styles.leaveTabPanel,
              { transform: [{ translateX: tabContentTranslateX }] },
            ]}
          >
            {activeQuery.isFetching && !activeHasItems ? (
              <View style={styles.loadingState}>
                <LoadingIndicator type="dot-circle" size="md" />
              </View>
            ) : null}

          {activeTab === 'requests' ? (
            <>
              {leaveRequests.length ? (
                <>
                  <SectionHeader title="My requests" textColor={textColor} />
                  {leaveRequests.map((item, index: number) => {
                    const leaveType = asRecord(item?.leave_type);
                    const rowRequestId = readRequestId(item);
                    const isHighlighted = highlightedRequestId === rowRequestId;
                    return (
                      <TouchableScale
                        key={rowRequestId || index}
                        onPress={() => openRequestDetails(item, rowRequestId)}
                        style={[
                          styles.listRow,
                          {
                            borderColor: isHighlighted ? accent : 'transparent',
                            borderWidth: isHighlighted ? 1.5 : 0,
                          },
                          isHighlighted ? { paddingHorizontal: 14 } : null,
                          index !== 0 && !isHighlighted ? [styles.withTopBorder, { borderTopColor: outlineColor }] : null,
                        ]}
                        pressedScale={0.985}
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
                      </TouchableScale>
                    );
                  })}
                </>
              ) : !requestsQuery.isFetching ? (
                <LeaveEmptyState
                  isDark={isDark}
                  textColor={textColor}
                  mutedColor={mutedColor}
                  subtleBlock={subtleBlock}
                  icon={<ClipboardTaskColor width={32} height={32} title="Leave requests" />}
                  title="No leave requests yet"
                  description="Your leave requests and their approval progress will appear here."
                  actionLabel="Create a leave request"
                  onAction={() => setShowApplyForm(true)}
                />
              ) : null}
            </>
          ) : null}

          {activeTab === 'balances' ? (
            <>
              {balancesQuery.data?.length ? (
                <>
                  <View style={styles.balancePageHeading}>
                    <View>
                      <FluentText style={[styles.balanceEyebrow, { color: accent }]}>TIME OFF OVERVIEW</FluentText>
                      <FluentText style={[styles.balancePageTitle, { color: textColor }]}>Your balances</FluentText>
                    </View>
                  </View>

                  <View style={[styles.balanceOverviewCard, { backgroundColor: isDark ? '#142E43' : '#EAF4FC', borderColor: isDark ? '#244A68' : '#C8E0F3' }]}>
                    <View style={styles.balanceOverviewTop}>
                      <View style={{ flex: 1 }}>
                        <FluentText style={[styles.balanceOverviewLabel, { color: isDark ? '#C8DFF1' : '#39566D' }]}>AVAILABLE TO TAKE</FluentText>
                        <View style={styles.balanceTotalLine}>
                          <FluentText style={[styles.balanceTotalNumber, { color: textColor }]}>{totalRemainingDays === null ? '—' : formatBalanceDays(totalRemainingDays)}</FluentText>
                          <FluentText style={[styles.balanceTotalUnit, { color: mutedColor }]}>days</FluentText>
                        </View>
                      </View>
                      <View style={[styles.balanceOverviewGlyph, { backgroundColor: isDark ? '#1E496B' : '#D5EAF9' }]}>
                        <CoinMultipleColor width={28} height={28} title="Available leave balance" />
                      </View>
                    </View>
                    <View style={[styles.balanceOverviewDivider, { backgroundColor: isDark ? '#31516A' : '#C7DDED' }]} />
                    <View style={styles.balanceOverviewStats}>
                      <View style={styles.balanceOverviewStat}>
                        <FluentText style={[styles.balanceStatValue, { color: textColor }]}>{balancesQuery.data.length}</FluentText>
                        <FluentText style={[styles.balanceStatLabel, { color: mutedColor }]}>leave types</FluentText>
                      </View>
                      <View style={[styles.balanceStatSeparator, { backgroundColor: isDark ? '#31516A' : '#C7DDED' }]} />
                      <View style={styles.balanceOverviewStat}>
                        <FluentText style={[styles.balanceStatValue, { color: textColor }]}>{totalUsedDays === null ? '—' : formatBalanceDays(totalUsedDays)}</FluentText>
                        <FluentText style={[styles.balanceStatLabel, { color: mutedColor }]}>days used</FluentText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.balanceListHeader}>
                    <FluentText style={[styles.balanceListTitle, { color: textColor }]}>By leave type</FluentText>
                    <FluentText style={[styles.balanceListCaption, { color: mutedColor }]}>Available days</FluentText>
                  </View>

                  {balancesQuery.data.map((balance, index: number) => {
                    const item = asRecord(balance);
                    const leaveType = asRecord(item?.leave_type) || asRecord(item?.leaveType) || asRecord(item?.type);
                    const name = readString(leaveType, ['name', 'display_name']) || readString(item, ['leave_type_name', 'name']) || 'Leave';
                    const available = readAvailableLeaveDays(item);
                    const used = readDaysMetric(item, ['used_days', 'usedDays', 'taken_days', 'takenDays', 'consumed_days']);
                    const entitlement = readDaysMetric(item, ['allocated_days', 'allocatedDays', 'entitled_days', 'entitledDays', 'total_days', 'totalDays', 'annual_entitlement']);
                    const progress = entitlement !== null && entitlement > 0 && used !== null
                      ? Math.max(0, Math.min(100, (used / entitlement) * 100))
                      : null;
                    return (
                      <View key={readRecordId(item, ['id', 'leave_type_id', 'leaveTypeId']) || `${name}-${index}`} style={[styles.balanceCard, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderColor: outlineColor }]}>
                        <View style={styles.balanceCardTop}>
                          <View style={[styles.balanceTypeIcon, { backgroundColor: isDark ? '#202F3D' : '#F0F6FA' }]}>
                            <CoinMultipleColor width={21} height={21} title={name} />
                          </View>
                          <View style={styles.balanceTypeCopy}>
                            <FluentText numberOfLines={1} style={[styles.balanceTypeName, { color: textColor }]}>{name}</FluentText>
                            <FluentText style={[styles.balanceTypeMeta, { color: mutedColor }]}>
                              {readString(item, ['fiscal_year', 'fiscalYear', 'year']) || 'Current balance'}
                            </FluentText>
                          </View>
                          <View style={styles.balanceAvailableBlock}>
                            <FluentText style={[styles.balanceAvailableValue, { color: available !== null && available <= 0 ? COLORS.error : accent }]}>
                              {available === null ? '—' : formatBalanceDays(available)}
                            </FluentText>
                            <FluentText style={[styles.balanceAvailableLabel, { color: mutedColor }]}>days left</FluentText>
                          </View>
                        </View>
                        {progress !== null ? (
                          <View style={styles.balanceProgressSection}>
                            <View style={[styles.balanceProgressTrack, { backgroundColor: isDark ? '#2B3540' : '#E8EDF2' }]}>
                              <View style={[styles.balanceProgressFill, { width: `${progress}%`, backgroundColor: accent }]} />
                            </View>
                            <View style={styles.balanceProgressLabels}>
                              <FluentText style={[styles.balanceProgressText, { color: mutedColor }]}>{formatBalanceDays(used ?? 0)} used</FluentText>
                              <FluentText style={[styles.balanceProgressText, { color: mutedColor }]}>{formatBalanceDays(entitlement ?? 0)} days total</FluentText>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </>
              ) : !balancesQuery.isFetching ? (
                <LeaveEmptyState
                  isDark={isDark}
                  textColor={textColor}
                  mutedColor={mutedColor}
                  subtleBlock={subtleBlock}
                  icon={<CoinMultipleColor width={32} height={32} title="Leave balance" />}
                  title="No balances to show"
                  description="Your available leave days will appear here once a balance is assigned."
                />
              ) : null}
            </>
          ) : null}

          {activeTab === 'holidays' ? (
            <>
              {holidayRows.length ? (
                <>
                  <View style={styles.holidayPageHeading}>
                    <View style={{ flex: 1 }}>
                      <FluentText style={[styles.balanceEyebrow, { color: accent }]}>HOLIDAY CALENDAR</FluentText>
                      <FluentText style={[styles.balancePageTitle, { color: textColor }]}>Upcoming holidays</FluentText>
                    </View>
                  </View>

                  {holidayFilter !== 'past' && nextHolidayRow ? (() => {
                    const nextHoliday = nextHolidayRow;
                    const nextName = readString(nextHoliday, ['name', 'holiday_name']) || 'Holiday';
                    const nextDate = readString(nextHoliday, ['date', 'holiday_date', 'holidayDate']);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${nextName}, ${formatDate(nextDate)}`}
                        onPress={() => setSelectedHoliday(nextHoliday)}
                        style={({ pressed }) => [styles.holidayFeatureCard, { backgroundColor: isDark ? '#142E43' : '#EAF4FC', borderColor: isDark ? '#244A68' : '#C8E0F3', opacity: pressed ? 0.8 : 1 }]}
                      >
                        <View style={[styles.holidayFeatureIcon, { backgroundColor: isDark ? '#1E496B' : '#D5EAF9' }]}>
                          <CalendarClockColor width={30} height={30} title="Next holiday" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <FluentText style={[styles.balanceOverviewLabel, { color: isDark ? '#C8DFF1' : '#39566D' }]}>NEXT ON THE CALENDAR</FluentText>
                          <FluentText numberOfLines={1} style={[styles.holidayFeatureName, { color: textColor }]}>{nextName}</FluentText>
                          <FluentText style={[styles.holidayFeatureDate, { color: mutedColor }]}>{formatDate(nextDate)}</FluentText>
                        </View>
                      </Pressable>
                    );
                  })() : null}

                  <View style={[styles.holidayFilterAnchor, holidayFilterOpen ? styles.holidayFilterAnchorOpen : null]}>
                    <View style={styles.holidayListHeading}>
                      <View style={styles.holidayListTitleRow}>
                        <FluentText style={[styles.balanceListTitle, { color: textColor }]}>
                          {holidayFilter === 'past' ? 'Past holidays' : holidayFilter === 'upcoming' ? 'Upcoming holidays' : 'All holidays'}
                        </FluentText>
                        <View style={[styles.holidayCountPill, { backgroundColor: subtleBlock }]}>
                          <FluentText style={[styles.holidayCountText, { color: mutedColor }]}>{visibleHolidayRows.length}</FluentText>
                        </View>
                      </View>
                      <FluentButtonV1
                        appearance="outline"
                        onClick={() => setHolidayFilterOpen((open) => !open)}
                        accessibilityRole="combobox"
                        accessibilityState={{ expanded: holidayFilterOpen }}
                        style={[styles.holidayFilterButton, { borderColor: outlineColor, backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface }]}
                      >
                        <FluentText style={[styles.holidayFilterLabel, { color: textColor }]}>
                          {holidayFilter === 'all' ? 'All holidays' : holidayFilter === 'upcoming' ? 'Upcoming' : 'Past'}
                        </FluentText>
                        <ChevronDown size={15} color={mutedColor} />
                      </FluentButtonV1>
                    </View>
                    {holidayFilterOpen ? (
                      <View style={[styles.holidayFilterMenu, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderColor: outlineColor }]}>
                        {([
                          ['all', 'All holidays'],
                          ['upcoming', 'Upcoming'],
                          ['past', 'Past'],
                        ] as const).map(([value, label]) => (
                          <Pressable
                            key={value}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: holidayFilter === value }}
                            onPress={() => {
                              setHolidayFilter(value);
                              setHolidayFilterOpen(false);
                            }}
                            style={({ pressed }) => [styles.holidayFilterOption, { backgroundColor: pressed ? subtleBlock : 'transparent' }]}
                          >
                            <FluentText style={{ color: textColor }}>{label}</FluentText>
                            {holidayFilter === value ? <RadioButtonFilled primaryFill={accent} width={18} height={18} /> : null}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>

                  {visibleHolidayRows.length ? visibleHolidayRows.map((item, index) => {
                    const name = readString(item, ['name', 'holiday_name']) || 'Holiday';
                    const dateValue = readString(item, ['date', 'holiday_date', 'holidayDate']);
                    const date = parseIsoDate(dateValue.slice(0, 10));
                    const isNextUp = item === nextHolidayRow && holidayFilter !== 'past';
                    return (
                      <Pressable
                        key={readRecordId(item, ['id']) || `${dateValue}-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${name}, ${formatDate(dateValue)}`}
                        onPress={() => setSelectedHoliday(item)}
                        style={({ pressed }) => [
                          styles.holidayCard,
                          {
                            backgroundColor: isNextUp ? (isDark ? '#142E43' : '#F1F8FD') : isDark ? COLORS.surfaceDark : COLORS.surface,
                            borderColor: isNextUp ? (isDark ? '#3974A0' : '#9CC9E8') : outlineColor,
                            opacity: pressed ? 0.78 : 1,
                          },
                        ]}
                      >
                        <View style={[styles.holidayDateTile, { backgroundColor: isNextUp ? (isDark ? '#1E496B' : '#DCEFFC') : isDark ? '#202F3D' : '#F0F6FA' }]}>
                          <FluentText style={[styles.holidayMonth, { color: accent }]}>{date ? date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : '—'}</FluentText>
                          <FluentText style={[styles.holidayDay, { color: textColor }]}>{date ? String(date.getDate()).padStart(2, '0') : '—'}</FluentText>
                        </View>
                        <View style={styles.holidayCardCopy}>
                          <View style={styles.holidayCardTitleLine}>
                            <FluentText numberOfLines={1} style={[styles.balanceTypeName, { color: textColor, flex: 1 }]}>{name}</FluentText>
                            {isNextUp ? (
                              <View style={[styles.holidayNextBadge, { backgroundColor: isDark ? '#1E496B' : '#DCEFFC' }]}>
                                <FluentText style={[styles.holidayNextBadgeText, { color: accent }]}>NEXT UP</FluentText>
                              </View>
                            ) : null}
                          </View>
                          <FluentText style={[styles.holidayCardDate, { color: mutedColor }]}>
                            {date ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : formatDate(dateValue)}
                          </FluentText>
                        </View>
                        <CalendarMonthRegular primaryFill={mutedColor} width={19} height={19} />
                      </Pressable>
                    );
                  }) : (
                    <FluentText style={[styles.holidayNoResults, { color: mutedColor }]}>No holidays match this filter.</FluentText>
                  )}
                </>
              ) : !holidaysQuery.isFetching ? (
                <LeaveEmptyState
                  isDark={isDark}
                  textColor={textColor}
                  mutedColor={mutedColor}
                  subtleBlock={subtleBlock}
                  icon={<CalendarClockColor width={32} height={32} title="Holiday calendar" />}
                  title="No upcoming holidays"
                  description="Public holidays for your organization will appear here when they are available."
                />
              ) : null}
            </>
          ) : null}

          {activeTab === 'policies' ? (
            <>
              {policyRows.length ? (
                <>
                  <View style={[styles.policyPageHeading, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1 }}>
                      <FluentText style={[styles.balanceEyebrow, { color: accentColor }]}>POLICY CENTER</FluentText>
                      <FluentText style={[styles.balancePageTitle, { color: textColor }]}>Leave policies</FluentText>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="About leave policies" onPress={() => setPolicyInfoOpen((open) => !open)} style={styles.policyInfoButton}>
                      <Info size={19} color={accentColor} />
                    </Pressable>
                  </View>
                  {policyInfoOpen ? <View style={[styles.policyInfoPanel, { backgroundColor: isDark ? COLORS.surfaceDark : '#F4F8FB', borderColor: outlineColor }]}><FluentText style={{ color: mutedColor, fontSize: 12, lineHeight: 18 }}>Review the rules and allowances for each leave type.</FluentText></View> : null}

                  {policyRows.map((item, index) => {
                    const name = readString(item, ['name', 'policy_name', 'leave_type_name']) || 'Leave policy';
                    const description = readString(item, ['description', 'summary', 'details']);
                    const rawStatus = readString(item, ['status', 'state']) || 'Active';
                    const normalizedStatus = rawStatus.toLowerCase();
                    const maxDays = readDaysMetric(item, ['max_days_per_year', 'maxDaysPerYear', 'annual_allowance', 'annualAllowance']);
                    const carryForward = readBooleanMetric(item, ['is_carry_forward_allowed', 'isCarryForwardAllowed', 'carry_forward_allowed']);
                    const carryDays = readDaysMetric(item, ['max_carry_forward_days', 'maxCarryForwardDays']);
                    const isPaid = readBooleanMetric(item, ['is_paid', 'isPaid', 'paid']);
                    const attachmentRequired = readBooleanMetric(item, ['requires_attachment', 'requiresAttachment']);
                    const facts = [
                      ...(isPaid !== null ? [{ label: 'PAY', value: isPaid ? 'Paid leave' : 'Unpaid leave' }] : []),
                      ...(maxDays !== null ? [{ label: 'YEARLY LIMIT', value: maxDays > 0 ? `${formatBalanceDays(maxDays)} days` : 'No limit' }] : []),
                      ...(carryForward !== null ? [{ label: 'CARRY FORWARD', value: carryForward ? `Allowed${carryDays && carryDays > 0 ? ` · up to ${formatBalanceDays(carryDays)} days` : ''}` : 'Not allowed' }] : []),
                      ...(attachmentRequired !== null ? [{ label: 'DOCUMENTS', value: attachmentRequired ? 'Attachment required' : 'No attachment required' }] : []),
                    ];
                    return (
                      <Pressable key={readRecordId(item, ['id']) || `${name}-${index}`} accessibilityRole="button" accessibilityLabel={`View ${name} policy details`} onPress={() => setSelectedPolicy(item)} style={[styles.policyCard, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderColor: outlineColor }]}>
                        <View style={styles.policyCardHeader}>
                          <View style={[styles.policyCardIcon, { backgroundColor: isDark ? '#202F3D' : '#F0F6FA' }]}>
                            <ShieldCheckmarkColor width={23} height={23} title={name} />
                          </View>
                          <View style={styles.policyCardTitleBlock}>
                            <FluentText numberOfLines={2} style={[styles.policyCardTitle, { color: textColor }]}>{name}</FluentText>
                          </View>
                          <FluentText style={{ color: normalizedStatus.includes('active') || normalizedStatus.includes('published') ? '#16834A' : mutedColor, fontSize: 12, fontWeight: '600' }}>{rawStatus}</FluentText>
                        </View>
                        {description ? (
                          <FluentText style={[styles.policyDescription, { color: mutedColor }]}>{description}</FluentText>
                        ) : null}
                        {facts.length ? (
                          <View style={[styles.policyFacts, { borderTopColor: outlineColor }]}>
                            {facts.map((fact) => (
                              <View key={fact.label} style={styles.policyFact}>
                                <FluentText style={[styles.policyFactLabel, { color: mutedColor }]}>{fact.label}</FluentText>
                                <FluentText style={[styles.policyFactValue, { color: textColor }]}>{fact.value}</FluentText>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </>
              ) : !policiesQuery.isFetching ? (
                <LeaveEmptyState
                  isDark={isDark}
                  textColor={textColor}
                  mutedColor={mutedColor}
                  subtleBlock={subtleBlock}
                  icon={<ShieldCheckmarkColor width={32} height={32} title="Leave policies" />}
                  title="No leave policies available"
                  description="Your organization’s leave rules and guidance will appear here."
                />
              ) : null}
            </>
          ) : null}
          </Animated.View>
        </ScreenTransition>
      </ScrollView>

      <Modal visible={showApplyForm} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setShowApplyForm(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: overlayColor }]}>
          <View
            accessibilityViewIsModal
            style={[
              styles.fluentDialog,
              { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderColor: outlineColor },
            ]}
          >
            <View style={styles.modalHeader}>
              <FluentText style={[styles.sectionTitle, { color: textColor }]}>New leave request</FluentText>
              <TouchableScale onPress={() => setShowApplyForm(false)} style={[styles.closeButton, { backgroundColor: subtleBlock }]} pressedScale={0.95}>
                <X size={16} color={textColor} />
              </TouchableScale>
            </View>

            <Text style={[styles.fieldLabel, { color: mutedColor }]}>Leave type</Text>
            <FluentButtonV1
              appearance="outline"
              block
              onClick={() => setLeaveTypeMenuOpen((open) => !open)}
              accessibilityRole="combobox"
              accessibilityState={{ expanded: leaveTypeMenuOpen }}
              style={[
                styles.fluentDropdownTrigger,
                { backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surface, borderColor: outlineColor },
              ]}
            >
              <View style={styles.fluentDropdownTriggerContent}>
                <FluentText style={{ color: form.leave_type_id ? textColor : mutedColor }}>
                  {selectedLeaveTypeLabel}
                </FluentText>
                <ChevronDown size={18} color={mutedColor} />
              </View>
            </FluentButtonV1>
            {leaveTypeMenuOpen ? (
              <View
                style={[
                  styles.fluentDropdownOptions,
                  { backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surface, borderColor: outlineColor },
                ]}
              >
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.fluentDropdownOptionsScroll}>
                  {leaveTypes.map((item) => {
                    const id = String(item.id ?? '');
                    const balanceDays = availableDaysForType(id, item);
                    const label = readString(item, ['name', 'display_name']) || `Type ${id}`;
                    const balanceLabel = balanceDays === null
                      ? 'Available balance not found'
                      : `Available: ${balanceDays.toFixed(2)} day(s)`;
                    const selected = form.leave_type_id === id;
                    const RadioIcon = selected ? RadioButtonFilled : RadioButtonRegular;
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() => {
                          setForm((current) => ({ ...current, leave_type_id: id }));
                          setLeaveTypeMenuOpen(false);
                        }}
                        style={({ pressed }) => [styles.fluentDropdownOption, { backgroundColor: pressed ? subtleBlock : 'transparent' }]}
                      >
                        <RadioIcon primaryFill={selected ? accent : mutedColor} width={20} height={20} />
                        <View style={styles.fluentDropdownOptionCopy}>
                          <FluentText style={{ color: textColor }}>{label}</FluentText>
                          <FluentText style={[styles.fluentDropdownBalance, { color: mutedColor }]}>{balanceLabel}</FluentText>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            {form.leave_type_id ? (
              <Text
                style={[
                  styles.balanceHint,
                  { color: requestValidationError ? COLORS.error : mutedColor },
                ]}
              >
                {availableLeaveDays !== null
                  ? `Available balance: ${availableLeaveDays.toFixed(2)} day(s)${readString(asRecord(selectedLeaveBalance), ['fiscal_year']) ? ` for ${readString(asRecord(selectedLeaveBalance), ['fiscal_year'])}` : ''}`
                  : balancesQuery.isLoading
                    ? 'Loading available balance…'
                    : 'Available balance could not be found for this leave type.'}
              </Text>
            ) : null}

            <Text style={[styles.inputLabel, { color: textColor }]}>Duration</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['FULL_DAY', 'HALF_DAY', 'SHORT_LEAVE'] as const).map((duration) => (
                <Pressable key={duration} onPress={() => setForm((current) => ({ ...current, duration_type: duration }))} style={{ flex: 1, padding: 9, borderRadius: 10, borderWidth: 1, borderColor: form.duration_type === duration ? accent : outlineColor, backgroundColor: form.duration_type === duration ? `${accent}18` : 'transparent' }}>
                  <Text style={{ color: form.duration_type === duration ? accent : mutedColor, fontSize: 11, textAlign: 'center', fontWeight: '600' }}>{duration === 'FULL_DAY' ? 'Full day' : duration === 'HALF_DAY' ? 'Half day' : 'Short leave'}</Text>
                </Pressable>
              ))}
            </View>
            {form.duration_type === 'HALF_DAY' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['FIRST_HALF', 'SECOND_HALF'] as const).map((session) => (
                  <Pressable key={session} onPress={() => setForm((current) => ({ ...current, half_day_session: session }))} style={{ flex: 1, padding: 9, borderRadius: 10, borderWidth: 1, borderColor: form.half_day_session === session ? accent : outlineColor }}>
                    <Text style={{ color: form.half_day_session === session ? accent : mutedColor, textAlign: 'center' }}>{session === 'FIRST_HALF' ? 'First half' : 'Second half'}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

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
            {form.duration_type === 'SHORT_LEAVE' ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['start_time', 'end_time'] as const).map((field) => (
                  <View key={field} style={{ flex: 1, gap: 5 }}>
                    <Text style={[styles.inputLabel, { color: textColor }]}>{field === 'start_time' ? 'Start time' : 'End time'}</Text>
                    <TextInput value={form[field]} onChangeText={(value) => setForm((current) => ({ ...current, [field]: value }))} placeholder="HH:MM" placeholderTextColor={mutedColor} keyboardType="numbers-and-punctuation" style={{ borderWidth: 1, borderColor: outlineColor, borderRadius: 10, color: textColor, backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surface, padding: 11 }} />
                  </View>
                ))}
              </View>
            ) : null}

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
            {requestedLeaveDays !== null ? (
              <Text style={[styles.balanceHint, { color: mutedColor }]}>
                Requested duration: {requestedLeaveDays.toFixed(2)} day(s)
              </Text>
            ) : null}
            {requestValidationError ? (
              <Text style={[styles.balanceHint, { color: COLORS.error }]}>
                {requestValidationError}
              </Text>
            ) : null}

            <FluentInput
              label="Reason"
              hint="Optional supporting note"
              placeholder="Enter details about your leave request"
              value={form.reason}
              onChangeText={(value) => setForm((current) => ({ ...current, reason: value }))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={styles.fluentMultilineInput}
            />

            <View style={{ gap: 6 }}>
              <Text style={[styles.inputLabel, { color: textColor }]}>Supporting attachment{(selectedLeaveType?.requires_attachment === true || selectedLeaveType?.requires_attachment === 'true') ? ((selectedLeaveType?.allow_deferred_attachment === true || selectedLeaveType?.allow_deferred_attachment === 'true') ? ` (due ${selectedLeaveType?.attachment_grace_days ?? 3} days after submission)` : ' (required before submission)') : ' (optional)'}</Text>
              <FluentButtonV1 appearance="outline" onClick={() => void pickLeaveAttachment()}>
                <FluentText>{leaveAttachment?.name ?? 'Choose PDF or image'}</FluentText>
              </FluentButtonV1>
            </View>

            <View style={styles.formActions}>
              <FluentButton appearance="outline" onPress={() => setShowApplyForm(false)} style={styles.flexButton}>
                Cancel
              </FluentButton>
              <FluentButton
                onPress={saveDraft}
                loading={submitMutation.isPending}
                disabled={Boolean(requestValidationError) || balancesQuery.isLoading}
                style={styles.flexButton}
              >
                Save draft
              </FluentButton>
              <FluentButton
                onPress={submitRequest}
                loading={submitMutation.isPending}
                disabled={Boolean(requestValidationError) || balancesQuery.isLoading}
                style={styles.flexButton}
              >
                Submit request
              </FluentButton>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectingDateField)} transparent animationType="fade" onRequestClose={() => setSelectingDateField(null)}>
        <View style={[styles.pickerOverlay, { backgroundColor: overlayColor }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectingDateField(null)} />
          <View style={[styles.fluentCalendarSurface, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderColor: outlineColor }]}>
            <View style={styles.calendarHeader}>
              <FluentButtonV1 appearance="subtle" accessibilityLabel="Previous month" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))} style={styles.calendarNav}>
                <ChevronLeft size={18} color={textColor} />
              </FluentButtonV1>
              <FluentText style={[styles.calendarTitle, { color: textColor }]}>
                {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </FluentText>
              <FluentButtonV1 appearance="subtle" accessibilityLabel="Next month" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))} style={styles.calendarNav}>
                <ChevronRight size={18} color={textColor} />
              </FluentButtonV1>
            </View>

            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <FluentText key={`${day}-${index}`} style={[styles.weekLabel, { color: mutedColor }]}>{day}</FluentText>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {buildCalendarDays(calendarMonth).map((day) => {
                const iso = toIsoDate(day.date);
                const selected = selectingDateField ? form[selectingDateField] === iso : false;
                return (
                  <View key={iso} style={styles.calendarDaySlot}>
                    <FluentButtonV1
                      appearance={selected ? 'primary' : 'subtle'}
                      accessibilityLabel={day.date.toLocaleDateString()}
                      accessibilityState={{ selected }}
                      disabled={!day.inMonth}
                      onClick={() => {
                        if (!selectingDateField) return;
                        setForm((current) => ({ ...current, [selectingDateField]: iso }));
                        setSelectingDateField(null);
                      }}
                      style={[styles.dayCell, !day.inMonth ? styles.dayCellMuted : null, selected ? { backgroundColor: accent } : null]}
                    >
                      <FluentText
                        style={{ color: selected ? '#FFFFFF' : day.inMonth ? textColor : mutedColor }}
                      >
                        {String(day.date.getDate())}
                      </FluentText>
                    </FluentButtonV1>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {selectedHoliday ? (() => {
        const holidayName = readString(selectedHoliday, ['name', 'holiday_name']) || 'Holiday';
        const holidayDateValue = readString(selectedHoliday, ['date', 'holiday_date', 'holidayDate']);
        const holidayDate = parseIsoDate(holidayDateValue.slice(0, 10));
        const holidayDateLabel = holidayDate
          ? holidayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          : formatDate(holidayDateValue);
        const daysUntilHoliday = holidayDate
          ? Math.ceil((startOfDay(holidayDate).getTime() - startOfDay(new Date()).getTime()) / 86_400_000)
          : null;
        const holidayCountdown = daysUntilHoliday === null
          ? 'Date unavailable'
          : daysUntilHoliday === 0
            ? 'Today'
            : daysUntilHoliday > 0
              ? `${daysUntilHoliday} ${daysUntilHoliday === 1 ? 'day' : 'days'} left`
              : `${Math.abs(daysUntilHoliday)} ${Math.abs(daysUntilHoliday) === 1 ? 'day' : 'days'} ago`;
        const holidayCategory = readString(selectedHoliday, ['holiday_type', 'holidayType', 'category', 'type']);
        const holidayLocation = readString(selectedHoliday, ['country', 'location', 'region', 'jurisdiction']);
        const holidayDescription = readString(selectedHoliday, ['description', 'summary', 'details', 'notes']);
        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedHoliday(null)}>
            <View style={[styles.holidaySheetOverlay, { backgroundColor: overlayColor }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedHoliday(null)} accessibilityLabel="Close holiday details" />
              <View style={[styles.holidaySheet, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderColor: outlineColor }]}>
                <View style={styles.holidaySheetHandle} />
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.holidaySheetHeader}>
                    <AddStarburstColor width={32} height={32} title="Holiday" />
                    <View style={styles.holidaySheetHeadingCopy}>
                      <FluentText style={[styles.balanceEyebrow, { color: accent }]}>HOLIDAY DETAILS</FluentText>
                      <FluentText numberOfLines={2} style={[styles.holidaySheetTitle, { color: textColor }]}>{holidayName}</FluentText>
                    </View>
                    <FluentButtonV1 appearance="subtle" accessibilityLabel="Close" onClick={() => setSelectedHoliday(null)} style={styles.holidaySheetClose}>
                      <X size={18} color={mutedColor} />
                    </FluentButtonV1>
                  </View>

                  <View style={[styles.holidaySheetDateRow, { borderBottomColor: outlineColor }]}>
                    <CalendarMonthRegular primaryFill={accent} width={22} height={22} />
                    <View style={{ flex: 1 }}>
                      <FluentText style={[styles.holidaySheetDetailLabel, { color: mutedColor }]}>DATE</FluentText>
                      <FluentText style={[styles.holidaySheetDateText, { color: textColor }]}>{holidayDateLabel}</FluentText>
                    </View>
                    <FluentText style={[styles.holidayCountdown, { color: daysUntilHoliday !== null && daysUntilHoliday < 0 ? mutedColor : accent }]}>
                      {holidayCountdown}
                    </FluentText>
                  </View>

                  {(holidayCategory || holidayLocation) ? (
                    <View style={styles.holidaySheetFacts}>
                      {holidayCategory ? (
                        <View style={styles.holidaySheetFact}>
                          <FluentText style={[styles.holidaySheetDetailLabel, { color: mutedColor }]}>TYPE</FluentText>
                          <FluentText style={[styles.holidaySheetFactValue, { color: textColor }]}>{holidayCategory}</FluentText>
                        </View>
                      ) : null}
                      {holidayLocation ? (
                        <View style={styles.holidaySheetFact}>
                          <FluentText style={[styles.holidaySheetDetailLabel, { color: mutedColor }]}>LOCATION</FluentText>
                          <FluentText style={[styles.holidaySheetFactValue, { color: textColor }]}>{holidayLocation}</FluentText>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={[styles.holidaySheetSummary, { borderTopColor: outlineColor }]}>
                    <FluentText style={[styles.holidaySheetDetailLabel, { color: mutedColor }]}>SUMMARY</FluentText>
                    <FluentText style={[styles.holidaySheetSummaryText, { color: textColor }]}>
                      {holidayDescription || 'No additional details were provided for this holiday.'}
                    </FluentText>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })() : null}

      {selectedPolicy ? (() => {
        const name = readString(selectedPolicy, ['name', 'policy_name', 'leave_type_name']) || 'Leave policy';
        const description = readString(selectedPolicy, ['description', 'summary', 'details']);
        const rawStatus = readString(selectedPolicy, ['status', 'state']) || 'Active';
        const normalizedStatus = rawStatus.toLowerCase();
        const maxDays = readDaysMetric(selectedPolicy, ['max_days_per_year', 'maxDaysPerYear', 'annual_allowance', 'annualAllowance']);
        const carryForward = readBooleanMetric(selectedPolicy, ['is_carry_forward_allowed', 'isCarryForwardAllowed', 'carry_forward_allowed']);
        const carryDays = readDaysMetric(selectedPolicy, ['max_carry_forward_days', 'maxCarryForwardDays']);
        const isPaid = readBooleanMetric(selectedPolicy, ['is_paid', 'isPaid', 'paid']);
        const attachmentRequired = readBooleanMetric(selectedPolicy, ['requires_attachment', 'requiresAttachment']);
        const facts = [
          ...(isPaid !== null ? [{ label: 'PAY', value: isPaid ? 'Paid leave' : 'Unpaid leave' }] : []),
          ...(maxDays !== null ? [{ label: 'YEARLY LIMIT', value: maxDays > 0 ? `${formatBalanceDays(maxDays)} days` : 'No limit' }] : []),
          ...(carryForward !== null ? [{ label: 'CARRY FORWARD', value: carryForward ? `Allowed${carryDays && carryDays > 0 ? ` · up to ${formatBalanceDays(carryDays)} days` : ''}` : 'Not allowed' }] : []),
          ...(attachmentRequired !== null ? [{ label: 'DOCUMENTS', value: attachmentRequired ? 'Attachment required' : 'No attachment required' }] : []),
        ];
        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedPolicy(null)}>
            <View style={[styles.holidaySheetOverlay, { backgroundColor: overlayColor }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedPolicy(null)} accessibilityLabel="Close policy details" />
              <View style={[styles.holidaySheet, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderColor: outlineColor }]}>
                <View style={styles.holidaySheetHandle} />
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.holidaySheetHeader}>
                    <ShieldCheckmarkColor width={32} height={32} title="Leave policy" />
                    <View style={styles.holidaySheetHeadingCopy}>
                      <FluentText style={[styles.balanceEyebrow, { color: accentColor }]}>LEAVE POLICY</FluentText>
                      <FluentText numberOfLines={2} style={[styles.holidaySheetTitle, { color: textColor }]}>{name}</FluentText>
                    </View>
                    <FluentButtonV1 appearance="subtle" accessibilityLabel="Close" onClick={() => setSelectedPolicy(null)} style={styles.holidaySheetClose}>
                      <X size={18} color={mutedColor} />
                    </FluentButtonV1>
                  </View>
                  <View style={[styles.policyDetailStatus, { backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant }]}>
                    <FluentText style={[styles.holidaySheetDetailLabel, { color: mutedColor }]}>STATUS</FluentText>
                    <FluentText style={{ color: normalizedStatus.includes('active') || normalizedStatus.includes('published') ? '#16834A' : mutedColor, fontSize: 13, fontWeight: '700', marginTop: 4 }}>{rawStatus}</FluentText>
                  </View>
                  {facts.length ? (
                    <View style={[styles.policyDetailFacts, { borderBottomColor: outlineColor }]}>
                      {facts.map((fact) => <View key={fact.label} style={styles.policyDetailFact}><FluentText style={[styles.holidaySheetDetailLabel, { color: mutedColor }]}>{fact.label}</FluentText><FluentText style={[styles.policyFactValue, { color: textColor, marginTop: 5 }]}>{fact.value}</FluentText></View>)}
                    </View>
                  ) : null}
                  <View style={[styles.holidaySheetSummary, { borderTopColor: outlineColor }]}>
                    <FluentText style={[styles.holidaySheetDetailLabel, { color: mutedColor }]}>POLICY DETAILS</FluentText>
                    <FluentText style={[styles.holidaySheetSummaryText, { color: textColor }]}>{description || 'No additional policy details were provided.'}</FluentText>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })() : null}

      <Modal visible={requestDetailVisible} animationType="slide" transparent onRequestClose={() => setRequestDetailVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: overlayColor }]}>
          <View
            style={{
              backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
              padding: 20,
              borderRadius: 16,
              maxHeight: '88%',
            }}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Leave request progress</Text>
                <Text style={[styles.secondaryText, { color: mutedColor }]}>
                  {selectedRequestId ? `Request #${selectedRequestId}` : 'Leave request'}
                </Text>
              </View>
              <TouchableScale
                onPress={() => setRequestDetailVisible(false)}
                style={[styles.closeButton, { backgroundColor: subtleBlock }]}
                pressedScale={0.95}
              >
                <X size={16} color={textColor} />
              </TouchableScale>
            </View>

            {requestDetailQuery.isFetching && !selectedRequest ? (
              <View style={styles.loadingState}>
                <LoadingIndicator type="dot-circle" size="md" />
              </View>
            ) : null}

            {selectedRequest ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
                <View
                  style={[
                    styles.detailHero,
                    {
                      backgroundColor: isDark ? COLORS.surfaceVariantDark : '#eef2ff',
                      borderColor: outlineColor,
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.detailHeroTitle, { color: textColor }]}>{selectedRequestTypeLabel}</Text>
                    <Text style={[styles.secondaryText, { color: mutedColor }]}>
                      {formatDate(readString(selectedRequest, ['start_date']))} - {formatDate(readString(selectedRequest, ['end_date']))}
                    </Text>
                  </View>
                  <StatusPill
                    label={formatLeaveWorkflowStatus(selectedRequestStatus)}
                    tone={statusTone(selectedRequestStatus)}
                  />
                </View>

                <View style={styles.detailGrid}>
                  <DetailCard
                    label="Current step"
                    value={requestWorkflow.currentLevel > 0 ? `Level ${requestWorkflow.currentLevel}` : 'Complete'}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    outlineColor={outlineColor}
                  />
                  <DetailCard
                    label="Waiting on"
                    value={requestWorkflow.waitingLabel}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    outlineColor={outlineColor}
                  />
                  <DetailCard
                    label="Approved"
                    value={`${requestWorkflow.approvedCount}/${requestWorkflow.totalCount || 0}`}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    outlineColor={outlineColor}
                  />
                  <DetailCard
                    label="Updated"
                    value={formatDateTime(readString(selectedRequest, ['updated_at', 'updatedAt', 'created_at', 'createdAt']))}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    outlineColor={outlineColor}
                  />
                </View>

                <View
                  style={[
                    styles.detailSection,
                    {
                      borderColor: outlineColor,
                      backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
                    },
                  ]}
                >
                  {selectedRequest.routing_required === true ? <Text style={{ color: textColor }}>Awaiting manager assignment. HR must correct routing before approval begins.</Text> : null}
                  {['awaiting_evidence', 'overdue', 'received'].includes(String(selectedRequest.evidence_status)) ? (
                    <Text style={{ color: textColor }}>
                      {selectedRequest.evidence_status === 'received' ? 'Supporting evidence received.' : `Supporting evidence ${selectedRequest.evidence_status === 'overdue' ? 'is overdue' : 'is needed'}. Due ${formatDateTime(String(selectedRequest.evidence_due_at || ''))}.`}
                    </Text>
                  ) : null}
                  {!['cancelled', 'rejected'].includes(selectedRequestStatus) ? (
                    <Pressable accessibilityRole="button" disabled={evidenceUploadMutation.isPending} onPress={() => evidenceUploadMutation.mutate(selectedRequestId)}>
                      <Text style={{ color: accentColor, paddingVertical: 12 }}>{evidenceUploadMutation.isPending ? 'Uploading…' : 'Upload supporting document'}</Text>
                    </Pressable>
                  ) : null}
                  <Text style={[styles.detailSectionTitle, { color: textColor }]}>Reason</Text>
                  <Text style={[styles.detailBodyText, { color: mutedColor }]}>{selectedRequestReason}</Text>
                </View>

                <View
                  style={[
                    styles.detailSection,
                    {
                      borderColor: outlineColor,
                      backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
                    },
                  ]}
                >
                  <View style={styles.workflowHeader}>
                    <Text style={[styles.detailSectionTitle, { color: textColor }]}>Approval workflow</Text>
                    <Text style={[styles.workflowSummaryText, { color: mutedColor }]}>
                      {requestWorkflow.progressPercent}% complete
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: subtleBlock }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${requestWorkflow.totalCount > 0 ? Math.max(8, requestWorkflow.progressPercent) : 0}%` },
                      ]}
                    />
                  </View>
                  {requestWorkflow.approvals.length ? (
                    requestWorkflow.approvals.map((approval, index) => (
                      <View
                        key={`${approval.level}-${approval.companyUserId ?? approval.id ?? index}`}
                        style={[
                          styles.workflowStep,
                          index !== 0 ? [styles.withTopBorder, { borderTopColor: outlineColor }] : null,
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={[styles.primaryText, { color: textColor }]}>
                            {approval.name || 'Approver'}
                          </Text>
                          <Text style={[styles.secondaryText, { color: mutedColor }]}>
                            Level {approval.level} • {approval.roleLabel || 'Approver'}
                          </Text>
                          {approval.actedAt ? (
                            <Text style={[styles.workflowMetaText, { color: mutedColor }]}>
                              {formatDateTime(approval.actedAt)}
                            </Text>
                          ) : null}
                          {approval.comments ? (
                            <Text style={[styles.workflowMetaText, { color: mutedColor }]}>
                              {approval.comments}
                            </Text>
                          ) : null}
                        </View>
                        <StatusPill
                          label={formatLeaveWorkflowStatus(approval.status)}
                          tone={workflowToneToStatusPill(approval.status)}
                        />
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.detailBodyText, { color: mutedColor }]}>
                      Approval steps will appear here as the workflow data becomes available.
                    </Text>
                  )}
                </View>

                {requestDetailQuery.error instanceof Error ? (
                  <Text style={[styles.detailErrorText, { color: '#dc2626' }]}>
                    {requestDetailQuery.error.message}
                  </Text>
                ) : null}
              </ScrollView>
            ) : (
              <Text style={[styles.emptyText, { color: mutedColor }]}>
                We could not find that leave request right now.
              </Text>
            )}
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
  icon?: React.ReactNode;
  textColor: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
      {icon ?? null}
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value || placeholder}
    >
      <FluentInput
        value={value}
        placeholder={placeholder}
        editable={false}
        showSoftInputOnFocus={false}
        pointerEvents="none"
        trailing={<CalendarMonthRegular primaryFill={mutedColor} width={20} height={20} />}
        style={[
          styles.fluentDateInput,
          {
            backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surface,
            color: value ? textColor : mutedColor,
            borderColor: outlineColor,
          },
        ]}
      />
    </Pressable>
  );
}

function DetailCard({
  label,
  value,
  textColor,
  mutedColor,
  outlineColor,
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
  outlineColor: string;
}) {
  return (
    <View style={[styles.detailCard, { borderColor: outlineColor }]}>
      <Text style={[styles.detailCardLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.detailCardValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

function asRecord(value: unknown): MobileRecord | null {
  return value && typeof value === 'object' ? (value as MobileRecord) : null;
}

function readRequestId(value: unknown) {
  const record = asRecord(value);
  if (!record) return '';

  for (const key of ['id', 'request_id', 'requestId', 'leave_request_id', 'leaveRequestId']) {
    const candidate = record[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  return '';
}

function unwrapCreatedLeave(value: unknown): MobileRecord | null {
  const root = asRecord(value);
  if (!root) return null;
  for (const candidate of [root, asRecord(root.data), asRecord(root.result), asRecord(root.item), asRecord(root.leave_request), asRecord(root.leaveRequest)]) {
    if (candidate && readRequestId(candidate)) return candidate;
  }
  return null;
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

function readRecordId(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return '';
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

async function normalizeLeaveBalanceRows(payload: unknown) {
  const records = await normalizeList(payload);
  return records.flatMap((record) => {
    if (!Array.isArray(record.leave_balances)) return [record];
    return record.leave_balances
      .map((balance) => asRecord(balance))
      .filter((balance): balance is MobileRecord => Boolean(balance));
  });
}

function findBalanceForType(balances: MobileRecord[], leaveTypeId: string, leaveType?: MobileRecord) {
  if (!leaveTypeId) return null;
  const expectedName = readString(leaveType, ['name', 'display_name']).trim().toLocaleLowerCase();
  return balances.find((row) => {
    const nestedType = asRecord(row.leave_type) || asRecord(row.leaveType) ||
      asRecord(row.type) || asRecord(row.leave);
    const balanceTypeId = readRecordId(row, ['leave_type_id', 'leaveTypeId', 'type_id', 'typeId']) ||
      readRecordId(nestedType, ['id', 'leave_type_id', 'leaveTypeId']);
    if (balanceTypeId) return balanceTypeId === leaveTypeId;
    if (!expectedName) return false;
    const balanceTypeName = (
      readString(nestedType, ['name', 'display_name']) ||
      readString(row, ['leave_type_name', 'leaveTypeName', 'type_name', 'typeName', 'leave_type', 'type'])
    ).trim().toLocaleLowerCase();
    return balanceTypeName === expectedName;
  }) ?? null;
}

function readAvailableLeaveDays(row: MobileRecord | null) {
  if (!row) return null;
  const keys = [
    'available_days', 'availableDays', 'available_balance', 'availableBalance',
    'days_available', 'daysAvailable', 'remaining_days', 'remainingDays',
    'remaining', 'balance', 'balance_days', 'balanceDays', 'current_balance', 'currentBalance',
  ];
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readDaysMetric(row: MobileRecord | null, keys: string[]) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readBooleanMetric(row: MobileRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1;
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'required', 'paid', 'allowed'].includes(normalized)) return true;
      if (['false', '0', 'no', 'optional', 'unpaid', 'not allowed'].includes(normalized)) return false;
    }
  }
  return null;
}

function formatBalanceDays(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function countInclusiveLeaveDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function getLeaveBalanceError(availableDays: number | null, requestedDays: number | null) {
  if (availableDays === null) return null;
  if (availableDays < 0) {
    return `This leave type is already overdrawn (${availableDays.toFixed(2)} day(s) available). New requests are blocked until HR adjusts the balance or the leave policy allows negative balances.`;
  }
  if (requestedDays !== null && requestedDays > availableDays) {
    return `This request exceeds the available balance for the selected leave type (${availableDays.toFixed(2)} day(s) left).`;
  }
  return null;
}

function holidayTimestamp(row: MobileRecord) {
  const value = readString(row, ['date', 'holiday_date', 'holidayDate']).slice(0, 10);
  const date = parseIsoDate(value);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(value).slice(0, 10);
  }
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function statusTone(status?: string): 'neutral' | 'success' | 'warning' | 'danger' {
  const value = String(status || '').toLowerCase();
  if (value.includes('approve')) return 'success';
  if (value.includes('reject') || value.includes('cancel')) return 'danger';
  return 'warning';
}

function workflowToneToStatusPill(status?: string): 'neutral' | 'success' | 'warning' | 'danger' {
  const tone = leaveWorkflowStatusTone(String(status || ''));
  if (tone === 'good') return 'success';
  if (tone === 'bad') return 'danger';
  if (tone === 'warn') return 'warning';
  return 'neutral';
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

function LeaveEmptyState({
  isDark,
  textColor,
  mutedColor,
  subtleBlock,
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  subtleBlock: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const accent = useAppAccent();
  return (
    <View
      style={[
        styles.leaveEmptyState,
        {
          backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
        },
      ]}
    >
      <View style={[styles.leaveEmptyIconTile, { backgroundColor: subtleBlock }]}>
        <View style={[styles.leaveEmptyIconHalo, { backgroundColor: isDark ? '#263D51' : '#DCEEFF' }]} />
        {icon}
      </View>
      <Text style={[styles.leaveEmptyTitle, { color: textColor }]}>{title}</Text>
      <Text style={[styles.leaveEmptyDescription, { color: mutedColor }]}>{description}</Text>
      {actionLabel && onAction ? (
        <Button
          onPress={onAction}
          variant="outline"
          leftIcon={<Plus size={16} color={accent} />}
          style={styles.leaveEmptyAction}
          textStyle={{ color: accent, fontSize: 13 }}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 36,
    gap: 8,
  },
  leaveScreenTransition: {
    flex: 1,
  },
  leaveTabPanel: {
    flexGrow: 1,
    overflow: 'hidden',
  },
  leaveTabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
    marginBottom: 8,
  },
  leaveTab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  leaveTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingBottom: 10,
  },
  leaveTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  balanceHint: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 16,
  },
  leaveTabIndicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  leaveEmptyState: {
    flex: 1,
    minHeight: 244,
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  leaveEmptyIconTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  leaveEmptyIconHalo: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    opacity: 0.75,
  },
  leaveEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  leaveEmptyDescription: {
    maxWidth: 290,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  leaveEmptyAction: {
    alignSelf: 'center',
    minHeight: 40,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 8,
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
  detailContent: {
    gap: 14,
    paddingBottom: 4,
  },
  detailHero: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailCard: {
    width: '47%',
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  detailCardLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    fontWeight: '700',
  },
  detailCardValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  detailBodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailErrorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  fluentDialog: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 14,
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
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 6,
  },
  fluentDropdownTrigger: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  fluentDropdownTriggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  fluentDropdownOptions: {
    position: 'absolute',
    top: 132,
    left: 20,
    right: 20,
    maxHeight: 240,
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 100,
  },
  fluentDropdownOptionsScroll: {
    maxHeight: 238,
  },
  fluentDropdownOption: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fluentDropdownOptionCopy: {
    flex: 1,
    gap: 2,
  },
  fluentDropdownBalance: {
    fontSize: 12,
  },
  fluentDateInput: {
    minHeight: 48,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 48,
    fontSize: 14,
  },
  fluentMultilineInput: {
    minHeight: 96,
    borderRadius: 4,
    paddingTop: 12,
    textAlignVertical: 'top',
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
  fluentCalendarSurface: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calendarNav: {
    width: 36,
    minWidth: 36,
    height: 36,
    paddingHorizontal: 0,
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
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  calendarDaySlot: {
    width: '14.2857%',
    aspectRatio: 1,
    padding: 2,
  },
  dayCell: {
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  dayCellMuted: {
    opacity: 0.45,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  workflowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  workflowSummaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  workflowStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  workflowMetaText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  listRow: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balancePageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
  },
  balanceEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  balancePageTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 3,
  },
  balanceOverviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 22,
  },
  balanceOverviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceOverviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  balanceTotalLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    marginTop: 4,
  },
  balanceTotalNumber: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1,
  },
  balanceTotalUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceOverviewGlyph: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceOverviewDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 14,
    marginBottom: 12,
  },
  balanceOverviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceOverviewStat: {
    flex: 1,
  },
  balanceStatSeparator: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    marginHorizontal: 16,
  },
  balanceStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  balanceStatLabel: {
    marginTop: 2,
    fontSize: 11,
  },
  balanceListHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  balanceListTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  balanceListCaption: {
    fontSize: 11,
  },
  balanceCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  balanceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceTypeIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceTypeCopy: {
    flex: 1,
    minWidth: 0,
  },
  balanceTypeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  balanceTypeMeta: {
    fontSize: 11,
    marginTop: 3,
  },
  balanceAvailableBlock: {
    alignItems: 'flex-end',
  },
  balanceAvailableValue: {
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '700',
  },
  balanceAvailableLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  balanceProgressSection: {
    marginTop: 14,
  },
  balanceProgressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  balanceProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  balanceProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  balanceProgressText: {
    fontSize: 10,
  },
  holidayPageHeading: {
    marginTop: 8,
    marginBottom: 16,
  },
  holidayFeatureCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },
  holidayFeatureIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holidayFeatureName: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  holidayFeatureDate: {
    fontSize: 12,
    marginTop: 3,
  },
  holidayListHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holidayFilterAnchor: {
    position: 'relative',
    marginBottom: 10,
  },
  holidayFilterAnchorOpen: {
    zIndex: 30,
    elevation: 30,
  },
  holidayListTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  holidayFilterButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  holidayFilterLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  holidayFilterMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    minWidth: 152,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 31,
    elevation: 12,
  },
  holidayFilterOption: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  holidayNoResults: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  holidayCountPill: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  holidayCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  holidayCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  holidayDateTile: {
    width: 52,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holidayMonth: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  holidayDay: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '700',
  },
  holidayCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  holidayCardTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  holidayNextBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  holidayNextBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  holidayCardDate: {
    fontSize: 11,
    marginTop: 4,
  },
  holidaySheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  holidaySheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    elevation: 18,
  },
  holidaySheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A19F9D',
    alignSelf: 'center',
    marginBottom: 14,
  },
  holidaySheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  holidaySheetHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  holidaySheetClose: {
    width: 36,
    minWidth: 36,
    height: 36,
    paddingHorizontal: 0,
  },
  holidaySheetTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: 3,
  },
  holidaySheetDateRow: {
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  holidaySheetDetailLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  holidaySheetDateText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  holidayCountdown: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: 82,
  },
  holidaySheetFacts: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  holidaySheetFact: {
    flex: 1,
    minWidth: 0,
  },
  holidaySheetFactValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 5,
  },
  holidaySheetSummary: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 2,
  },
  holidaySheetSummaryText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  policyPageHeading: {
    marginTop: 8,
    marginBottom: 16,
  },
  policyInfoButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  policyInfoPanel: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 12 },
  policyDetailStatus: { borderRadius: 10, padding: 12, marginBottom: 14 },
  policyDetailFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  policyDetailFact: { flexBasis: '44%', flexGrow: 1, minWidth: 120 },
  policyCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  policyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  policyCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  policyCardTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  policyDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  policyFacts: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  policyFact: {
    width: '50%',
    paddingRight: 8,
  },
  policyFactLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  policyFactValue: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 4,
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
