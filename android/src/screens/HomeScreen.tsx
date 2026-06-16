import React from 'react';
import {
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2, CalendarRange, Clock3, MapPin, MoveRight, UserRound } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { StatusPill } from '../components/ui/status-pill';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: { user?: MobileRecord | null; employee?: MobileRecord | null; refreshProfile: () => Promise<void> };
  onTabChange?: (tab: 'attendance' | 'leave') => void;
}

export function HomeScreen({ auth, onTabChange }: Props) {
  const isDark = useColorScheme() === 'dark';
  const employee = auth.employee || auth.user;
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;

  const { data: balances = [], isLoading: balancesLoading, refetch: refetchBalances } = useQuery({
    queryKey: ['mobileHomeLeaveBalances'],
    queryFn: async () => normalizeList(await api.listMyLeaveBalances({ limit: 6 })),
  });

  const { data: recentRequests = [], isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['mobileHomeLeaveRequests'],
    queryFn: async () => normalizeList(await api.listMyLeaveRequests({ limit: 4 })),
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([refetchBalances(), refetchRequests(), auth.refreshProfile()]);
  }, [auth, refetchBalances, refetchRequests]);

  const employeeName =
    auth.user?.fullName ||
    [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') ||
    'Employee';
  const firstName = employeeName.split(' ')[0] || 'Employee';
  const branch = employee?.branch?.name || employee?.primary_branch?.name || employee?.branch_name || 'Not assigned';
  const department = employee?.department?.name || employee?.primary_department?.name || employee?.department_name || 'Not assigned';
  const position = employee?.position?.name || employee?.primary_position?.name || employee?.position_name || 'Not assigned';
  const employeeNo = employee?.employee_no || employee?.user_no || auth.user?.employeeId || '—';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={balancesLoading || requestsLoading} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={[styles.heroTitle, { color: textColor }]}>Good {getTimeOfDay()}, {firstName}</Text>
            </View>
          </View>
          <View style={styles.quickActions}>
            <Button
              onPress={() => onTabChange?.('attendance')}
              style={styles.flexButton}
              rightIcon={<MoveRight size={16} color="#ffffff" />}
            >
              Open attendance
            </Button>
            <Button
              variant="secondary"
              onPress={() => onTabChange?.('leave')}
              style={styles.flexButton}
            >
              Manage leave
            </Button>
          </View>
        </Card>

        <View style={styles.statsRow}>
          <MiniStat icon={<Building2 size={18} color={COLORS.primary} />} label="Branch" value={branch} mutedColor={mutedColor} textColor={textColor} />
          <MiniStat icon={<UserRound size={18} color={COLORS.primary} />} label="Employee No" value={employeeNo} mutedColor={mutedColor} textColor={textColor} />
        </View>

        <Card>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Assignment overview</Text>
          <View style={styles.infoList}>
            <InfoRow icon={<MapPin size={16} color={COLORS.primary} />} label="Department" value={department} textColor={textColor} mutedColor={mutedColor} />
            <InfoRow icon={<Clock3 size={16} color={COLORS.primary} />} label="Position" value={position} textColor={textColor} mutedColor={mutedColor} />
          </View>
        </Card>

        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Leave balances</Text>
            <TouchableOpacity onPress={() => onTabChange?.('leave')}>
              <Text style={[styles.linkText, { color: COLORS.primary }]}>View all</Text>
            </TouchableOpacity>
          </View>
          {balances.length ? (
            balances.slice(0, 3).map((item, index: number) => (
              <View key={index} style={[styles.listRow, index !== 0 ? styles.withTopBorder : null]}>
                <Text style={[styles.primaryValue, { color: textColor }]}>{item.leave_type?.name || item.name || 'Leave'}</Text>
                <StatusPill label={`${item.remaining ?? item.balance ?? '—'} days`} tone="info" />
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No leave balances available yet.</Text>
          )}
        </Card>

        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Recent requests</Text>
            <CalendarRange size={18} color={COLORS.primary} />
          </View>
          {recentRequests.length ? (
            recentRequests.map((request, index: number) => (
              <View key={index} style={[styles.requestRow, index !== 0 ? styles.withTopBorder : null]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.primaryValue, { color: textColor }]}>
                    {request.leave_type?.name || request.leave_type_name || 'Leave request'}
                  </Text>
                  <Text style={[styles.secondaryValue, { color: mutedColor }]}>
                    {formatDate(request.start_date)} - {formatDate(request.end_date)}
                  </Text>
                </View>
                <StatusPill label={String(request.status || 'pending')} tone={statusTone(request.status)} />
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No recent leave requests found.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({
  icon,
  label,
  value,
  mutedColor,
  textColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mutedColor: string;
  textColor: string;
}) {
  return (
    <Card style={styles.miniStatCard}>
      <View style={styles.miniStatIcon}>{icon}</View>
      <Text style={[styles.miniStatLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.miniStatValue, { color: textColor }]} numberOfLines={1}>{value}</Text>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
  textColor,
  mutedColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelWrap}>
        {icon}
        <Text style={[styles.infoLabel, { color: mutedColor }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
    gap: 14,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 10,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  miniStatCard: {
    flex: 1,
    gap: 8,
  },
  miniStatIcon: {
    marginBottom: 2,
  },
  miniStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoList: {
    marginTop: 8,
  },
  infoRow: {
    paddingVertical: 10,
    gap: 6,
  },
  infoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  listRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  requestRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  withTopBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d4d4d8',
  },
  primaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryValue: {
    marginTop: 4,
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 12,
  },
});
