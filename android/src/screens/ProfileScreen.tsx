import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeCheck, BellRing, BriefcaseBusiness, Building2, CreditCard, Fingerprint, Mail, Phone, UserRound } from 'lucide-react-native';

import { COLORS } from '../lib/config';
import {
  getNotificationSoundPreference,
  NOTIFICATION_SOUND_OPTIONS,
  saveNotificationSoundPreference,
  type NotificationSoundPreference,
} from '../lib/notification-settings';
import { SegmentedControl } from '../components/ui/segmented-control';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useToast } from '../hooks/useToast';
import { Text } from '../components/ui/text';

type MobileRecord = Record<string, unknown>;

const PROFILE_SECTIONS = [
  { key: 'summary', label: 'Summary' },
  { key: 'work', label: 'Work' },
  { key: 'personal', label: 'Personal' },
  { key: 'records', label: 'Records' },
] as const;

type ProfileSection = typeof PROFILE_SECTIONS[number]['key'];

interface Props {
  auth: UseAuthReturn;
}

export function ProfileScreen({ auth }: Props) {
  const router = useRouter();
  const { isDark } = useThemePreference();
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const biometricLabel = auth.biometricTypeLabel || 'Fingerprint';

  const toast = useToast();

  const employee = useMemo<MobileRecord>(
    () => (auth.employee && typeof auth.employee === 'object' ? auth.employee : {}),
    [auth.employee]
  );
  const user = useMemo<MobileRecord>(
    () => (auth.user && typeof auth.user === 'object' ? auth.user : {}),
    [auth.user]
  );

  const [activeSection, setActiveSection] = useState<ProfileSection>('summary');
  const [notificationSound, setNotificationSound] = useState<NotificationSoundPreference>('device-default');



  useEffect(() => {
    let cancelled = false;

    async function loadNotificationSound() {
      const stored = await getNotificationSoundPreference();
      if (!cancelled) {
        setNotificationSound(stored);
      }
    }

    void loadNotificationSound();
    return () => {
      cancelled = true;
    };
  }, []);

  const fullName = useMemo(() => {
    return (
      [readString(employee, ['first_name']), readString(employee, ['last_name'])].filter(Boolean).join(' ') ||
      readString(user, ['fullName', 'full_name', 'name']) ||
      'Employee'
    );
  }, [employee, user]);

  const branch = readString(employee, ['branch_name']) || readString(employee?.branch || {}, ['name']) || readString(employee?.primary_branch || {}, ['name']) || 'Not assigned';
  const department = readString(employee, ['department_name']) || readString(employee?.department || {}, ['name']) || readString(employee?.primary_department || {}, ['name']) || 'Not assigned';
  const position = readString(employee, ['position_name']) || readString(employee?.position || {}, ['name']) || readString(employee?.primary_position || {}, ['name']) || 'Not assigned';
  const employeeNo = readString(employee, ['employee_no', 'user_no']) || readString(user, ['employeeId']) || '—';
  const email = readString(user, ['email']) || '—';
  const phoneDisplay = readString(employee, ['phone', 'phone_number'], '—');
  const employmentStatus = readString(employee, ['employment_status', 'status']) || 'Active';
  const hireDate = formatDate(employee?.hire_date || employee?.joining_date);

  const contacts = Array.isArray(employee.contacts) ? employee.contacts : [];
  const addresses = Array.isArray(employee.addresses) ? employee.addresses : [];
  const relatives = Array.isArray(employee.relatives) ? employee.relatives : [];
  const identifications = Array.isArray(employee.identifications) ? employee.identifications : [];
  const bankAccounts = Array.isArray(employee.bank_accounts) ? employee.bank_accounts : [];

  const onRefresh = React.useCallback(async () => {
    await auth.refreshProfile();
  }, [auth]);

  const onToggleBiometric = React.useCallback(async () => {
    try {
      if (auth.biometricEnabled) {
        await auth.disableBiometricLogin?.();
        toast.success(`${biometricLabel} sign in has been turned off.`);
        return;
      }

      await auth.enableBiometricLogin?.();
      toast.success(`You can now sign in with ${biometricLabel.toLowerCase()}.`);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : `Unable to configure ${biometricLabel.toLowerCase()} sign in right now.`
      );
    }
  }, [auth, biometricLabel, toast]);

  const onChangeNotificationSound = React.useCallback(
    async (_next: string) => {
      const choice = 'device-default';
      setNotificationSound(choice);

      try {
        await saveNotificationSoundPreference(choice);
        toast.success('System default notification sound is now active.');
      } catch (error: unknown) {
        setNotificationSound(await getNotificationSoundPreference());
        toast.error(
          error instanceof Error ? error.message : 'Unable to update the notification sound right now.'
        );
      }
    },
    [toast]
  );

  const activeSoundDescription =
    NOTIFICATION_SOUND_OPTIONS.find((option) => option.key === notificationSound)?.description ||
    NOTIFICATION_SOUND_OPTIONS[0].description;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} title="Profile" variant="centered" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <ScreenTransition>

          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.userName, { color: textColor }]}>{fullName}</Text>
            <Text style={[styles.userMeta, { color: mutedColor }]}>{employeeNo} · {position} · {department}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: isDark ? '#27272a' : '#f4f4f5' }]}>
                <Text style={[styles.badgeText, { color: mutedColor }]}>Hired {hireDate}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: isDark ? '#27272a' : '#f4f4f5' }]}>
                <Text style={[styles.badgeText, { color: mutedColor }]}>{employmentStatus}</Text>
              </View>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginBottom: 12 }} />

          <SegmentedControl
            value={activeSection}
            onChange={(next) => setActiveSection(next as ProfileSection)}
            options={PROFILE_SECTIONS.map((item) => ({ key: item.key, label: item.label }))}
          />

          {activeSection === 'summary' ? (
            <>
              <View style={{ marginBottom: 16 }}>
                <InfoRow icon={<UserRound size={16} color={mutedColor} />} label="Employment status" value={employmentStatus} textColor={textColor} mutedColor={mutedColor} />
                <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 4 }} />
                <InfoRow icon={<Mail size={16} color={mutedColor} />} label="Email" value={email} textColor={textColor} mutedColor={mutedColor} />
                <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 4 }} />
                <InfoRow icon={<Phone size={16} color={mutedColor} />} label="Phone" value={phoneDisplay} textColor={textColor} mutedColor={mutedColor} />
                <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 4 }} />
                <InfoRow icon={<BadgeCheck size={16} color={mutedColor} />} label="Hire date" value={hireDate} textColor={textColor} mutedColor={mutedColor} />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Quick unlock</Text>
                <InfoRow
                  icon={<Fingerprint size={16} color={mutedColor} />}
                  label={biometricLabel}
                  value={
                    auth.biometricEnabled
                      ? 'Enabled for this device'
                      : Platform.OS === 'web'
                        ? 'Available in the Android app only'
                      : auth.biometricSupported && auth.biometricEnrolled
                        ? 'Available to enable'
                        : 'Not available on this device'
                  }
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
                <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textColor, fontSize: 15, fontWeight: '600' }}>
                    Enable {biometricLabel}
                  </Text>
                  <Switch
                    value={auth.biometricEnabled}
                    onValueChange={() => void onToggleBiometric()}
                    trackColor={{ false: isDark ? '#3f3f46' : '#d1d5db', true: COLORS.primary }}
                    thumbColor={auth.biometricEnabled ? '#fff' : '#f4f3f4'}
                    disabled={Platform.OS === 'web' || !auth.biometricSupported || !auth.biometricEnrolled}
                  />
                </View>
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Notifications</Text>
                <InfoRow
                  icon={<BellRing size={16} color={mutedColor} />}
                  label="Alert sound"
                  value="System default"
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
                <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 8 }} />
                <SegmentedControl
                  value={notificationSound}
                  onChange={(next) => {
                    void onChangeNotificationSound(next);
                  }}
                  options={NOTIFICATION_SOUND_OPTIONS.map((option) => ({
                    key: option.key,
                    label: option.label,
                  }))}
                />
                <Text style={[styles.emptyText, { color: mutedColor, paddingTop: 8, paddingVertical: 0 }]}>
                  {activeSoundDescription}
                </Text>
              </View>
            </>
          ) : null}

          {activeSection === 'work' ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Work assignment</Text>
              <InfoRow icon={<Building2 size={16} color={mutedColor} />} label="Branch" value={branch} textColor={textColor} mutedColor={mutedColor} />
              <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 2 }} />
              <InfoRow icon={<Building2 size={16} color={mutedColor} />} label="Department" value={department} textColor={textColor} mutedColor={mutedColor} />
              <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 2 }} />
              <InfoRow icon={<BriefcaseBusiness size={16} color={mutedColor} />} label="Position" value={position} textColor={textColor} mutedColor={mutedColor} />
            </View>
          ) : null}

          {activeSection === 'personal' ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Personal details</Text>
              {contacts.length ? contacts.map((contact: MobileRecord, index: number) => (
                <View key={index}>
                  <InfoRow
                    icon={<Phone size={16} color={mutedColor} />}
                    label={readString(contact, ['contact_type']) || 'Contact'}
                    value={readString(contact, ['phone_number', 'email']) || '—'}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                  {index < contacts.length - 1 && <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 2 }} />}
                </View>
              )) : <Text style={[styles.emptyText, { color: mutedColor }]}>No personal contacts listed.</Text>}
              {addresses.length ? addresses.slice(0, 2).map((address: MobileRecord, index: number) => (
                <View key={`address-${index}`}>
                  <InfoRow
                    icon={<Building2 size={16} color={mutedColor} />}
                    label={readString(address, ['address_type']) || 'Address'}
                    value={readString(address, ['city', 'street']) || '—'}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                  {index < Math.min(addresses.length, 2) - 1 && <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 2 }} />}
                </View>
              )) : null}
              {relatives.length ? relatives.slice(0, 2).map((relative: MobileRecord, index: number) => (
                <View key={`relative-${index}`}>
                  <InfoRow
                    icon={<UserRound size={16} color={mutedColor} />}
                    label={readString(relative, ['relationship']) || 'Relative'}
                    value={readString(relative, ['name']) || '—'}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                  {index < Math.min(relatives.length, 2) - 1 && <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 2 }} />}
                </View>
              )) : null}
            </View>
          ) : null}

          {activeSection === 'records' ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Records</Text>
              {identifications.length ? identifications.slice(0, 3).map((record: MobileRecord, index: number) => (
                <View key={`id-${index}`}>
                  <InfoRow
                    icon={<BadgeCheck size={16} color={mutedColor} />}
                    label={readString(record, ['identification_type']) || 'Identification'}
                    value={readString(record, ['number']) || '—'}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                  {index < Math.min(identifications.length, 3) - 1 && <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 2 }} />}
                </View>
              )) : null}
              {bankAccounts.length ? bankAccounts.slice(0, 2).map((account: MobileRecord, index: number) => (
                <View key={`bank-${index}`}>
                  <InfoRow
                    icon={<CreditCard size={16} color={mutedColor} />}
                    label={readString(account, ['bank_name']) || 'Bank account'}
                    value={readString(account, ['account_number']) || '—'}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                  {index < Math.min(bankAccounts.length, 2) - 1 && <View style={{ height: 1, backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', marginVertical: 2 }} />}
                </View>
              )) : null}
              {!identifications.length && !bankAccounts.length ? (
                <Text style={[styles.emptyText, { color: mutedColor }]}>Detailed records are best reviewed on the web portal.</Text>
              ) : null}
              {([
                { href: '/field', label: 'Field visits' },
                { href: '/finance', label: 'Finance applications' },
                { href: '/performance', label: 'Performance' },
                { href: '/activities', label: 'Daily activities' },
                { href: '/documents', label: 'Documents' },
              ] as const).map((item) => (
                <Pressable key={item.href} onPress={() => router.push(item.href)} style={{ paddingVertical: 10 }}>
                  <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScreenTransition>
      </ScrollView>
    </SafeAreaView>
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

function readString(value: unknown, keys: string[], fallback = '') {
  if (!value) return fallback;
  if (typeof value !== 'object') return fallback;
  const record = value as MobileRecord;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function formatDate(value: unknown) {
  if (!value) return '—';
  try {
    return new Date(String(value)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(value);
  }
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 36,
    gap: 14,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  userMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
    color: '#6b7280',
  },
  infoRow: {
    paddingVertical: 10,
  },
  infoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
  },
});
