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
import { SegmentedControl } from '../components/ui/segmented-control';
import {
  getNotificationSoundPreference,
  NOTIFICATION_SOUND_OPTIONS,
  saveNotificationSoundPreference,
  type NotificationSoundPreference,
} from '../lib/notification-settings';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import { FluentSystemIcon } from '../components/ui/fluent-system-icon';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useAppAccent } from '../hooks/useAppAccent';
import { useToast } from '../hooks/useToast';
import { FluentText as Text } from '../components/ui/fluent-text';

type MobileRecord = Record<string, unknown>;

const PROFILE_SECTIONS = [
  { key: 'summary', label: 'Summary', icon: 'profile' },
  { key: 'work', label: 'Work', icon: 'work' },
  { key: 'personal', label: 'Personal', icon: 'people' },
  { key: 'records', label: 'Records', icon: 'documents' },
] as const;

type ProfileSection = typeof PROFILE_SECTIONS[number]['key'];

interface Props {
  auth: UseAuthReturn;
}

export function ProfileScreen({ auth }: Props) {
  const router = useRouter();
  const { isDark } = useThemePreference();
  const appAccent = useAppAccent();
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const surfaceColor = isDark ? COLORS.surfaceDark : '#FFFFFF';
  const borderColor = isDark ? COLORS.outlineDark : '#DCE5EC';
  const accentColor = appAccent;
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
  const avatarInitials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'E';

  const branch = readString(employee, ['branch_name']) || readString(employee?.branch || {}, ['name']) || readString(employee?.primary_branch || {}, ['name']) || 'Not assigned';
  const department = readString(employee, ['department_name']) || readString(employee?.department || {}, ['name']) || readString(employee?.primary_department || {}, ['name']) || 'Not assigned';
  const position = readString(employee, ['position_name']) || readString(employee?.position || {}, ['name']) || readString(employee?.primary_position || {}, ['name']) || 'Not assigned';
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
    async () => {
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
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[accentColor]} />}
      >
        <ScreenTransition style={styles.profileStack}>
          <View style={[styles.identityCard, { backgroundColor: surfaceColor, borderColor }]}>
            <View style={[styles.identityAccent, { backgroundColor: accentColor }]} />
            <View style={[styles.avatar, { backgroundColor: isDark ? '#21394A' : '#E8F3FA' }]}>
              <Text style={[styles.avatarText, { color: accentColor }]}>{avatarInitials}</Text>
              <View style={[styles.avatarStatus, { backgroundColor: employmentStatus.toLowerCase() === 'active' ? '#169B72' : '#D69200', borderColor: surfaceColor }]} />
            </View>
            <View style={styles.identityCopy}>
              <Text numberOfLines={2} style={[styles.userName, { color: textColor }]}>{fullName}</Text>
              <Text numberOfLines={1} style={[styles.userMeta, { color: mutedColor }]}>{position}</Text>
              <View style={styles.identityMetaRow}>
                <FluentSystemIcon name="work" size={13} color={mutedColor} />
                <Text numberOfLines={1} style={[styles.identityMeta, { color: mutedColor }]}>{department}</Text>
                <View style={[styles.statusPill, { backgroundColor: isDark ? '#17392F' : '#E7F7F0' }]}>
                  <Text style={[styles.statusText, { color: isDark ? '#90E4C0' : '#14734F' }]}>{employmentStatus}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.profileTabs, { borderBottomColor: borderColor }]} accessibilityRole="tablist">
            {PROFILE_SECTIONS.map((section) => {
              const selected = activeSection === section.key;
              return (
                <Pressable
                  key={section.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveSection(section.key)}
                  style={styles.profileTab}
                >
                  <FluentSystemIcon name={section.icon} active={selected} size={17} color={selected ? accentColor : mutedColor} />
                  <Text numberOfLines={1} style={[styles.profileTabLabel, { color: selected ? accentColor : mutedColor }, selected && styles.profileTabLabelActive]}>
                    {section.label}
                  </Text>
                  {selected ? <View style={[styles.profileTabIndicator, { backgroundColor: accentColor }]} /> : null}
                </Pressable>
              );
            })}
          </View>

          {activeSection === 'summary' ? (
            <>
              <View style={[styles.dataCard, { backgroundColor: surfaceColor, borderColor }]}>
                <InfoRow icon={<UserRound size={16} color={mutedColor} />} label="Employment status" value={employmentStatus} textColor={textColor} mutedColor={mutedColor} />
                <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 4 }} />
                <InfoRow icon={<Mail size={16} color={mutedColor} />} label="Email" value={email} textColor={textColor} mutedColor={mutedColor} />
                <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 4 }} />
                <InfoRow icon={<Phone size={16} color={mutedColor} />} label="Phone" value={phoneDisplay} textColor={textColor} mutedColor={mutedColor} />
                <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 4 }} />
                <InfoRow icon={<BadgeCheck size={16} color={mutedColor} />} label="Hire date" value={hireDate} textColor={textColor} mutedColor={mutedColor} />
              </View>
              <View style={[styles.dataCard, { backgroundColor: surfaceColor, borderColor }]}>
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
                <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textColor, fontSize: 15, fontWeight: '600' }}>
                    Enable {biometricLabel}
                  </Text>
                  <Switch
                    value={auth.biometricEnabled}
                    onValueChange={() => void onToggleBiometric()}
                    trackColor={{ false: isDark ? '#3f3f46' : '#d1d5db', true: accentColor }}
                    thumbColor={auth.biometricEnabled ? '#fff' : '#f4f3f4'}
                    disabled={Platform.OS === 'web' || !auth.biometricSupported || !auth.biometricEnrolled}
                  />
                </View>
              </View>
              <View style={[styles.dataCard, { backgroundColor: surfaceColor, borderColor }]}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Notifications</Text>
                <InfoRow
                  icon={<BellRing size={16} color={mutedColor} />}
                  label="Alert sound"
                  value="System default"
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
                <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 8 }} />
                <SegmentedControl
                  value={notificationSound}
                  onChange={() => {
                    void onChangeNotificationSound();
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
            <View style={[styles.dataCard, { backgroundColor: surfaceColor, borderColor }]}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Work assignment</Text>
              <InfoRow icon={<Building2 size={16} color={mutedColor} />} label="Branch" value={branch} textColor={textColor} mutedColor={mutedColor} />
              <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 2 }} />
              <InfoRow icon={<Building2 size={16} color={mutedColor} />} label="Department" value={department} textColor={textColor} mutedColor={mutedColor} />
              <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 2 }} />
              <InfoRow icon={<BriefcaseBusiness size={16} color={mutedColor} />} label="Position" value={position} textColor={textColor} mutedColor={mutedColor} />
            </View>
          ) : null}

          {activeSection === 'personal' ? (
            <View style={[styles.dataCard, { backgroundColor: surfaceColor, borderColor }]}>
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
                  {index < contacts.length - 1 && <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 2 }} />}
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
                  {index < Math.min(addresses.length, 2) - 1 && <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 2 }} />}
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
                  {index < Math.min(relatives.length, 2) - 1 && <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 2 }} />}
                </View>
              )) : null}
            </View>
          ) : null}

          {activeSection === 'records' ? (
            <View style={[styles.dataCard, { backgroundColor: surfaceColor, borderColor }]}>
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
                  {index < Math.min(identifications.length, 3) - 1 && <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 2 }} />}
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
                  {index < Math.min(bankAccounts.length, 2) - 1 && <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 2 }} />}
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
                  <Text style={{ color: accentColor, fontWeight: '700' }}>{item.label}</Text>
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
  const { isDark } = useThemePreference();

  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: isDark ? '#263747' : '#EAF3F8' }]}>
        {icon}
      </View>
      <View style={styles.infoCopy}>
        <Text numberOfLines={1} style={[styles.infoLabel, { color: mutedColor }]}>{label}</Text>
        <Text numberOfLines={2} style={[styles.infoValue, { color: textColor }]}>{value}</Text>
      </View>
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
  profileStack: { gap: 14, paddingTop: 8 },
  identityCard: {
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  identityAccent: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 4 },
  avatar: { width: 62, height: 62, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  avatarText: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  avatarStatus: { position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  identityCopy: { flex: 1, minWidth: 0, gap: 2 },
  identityMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  identityMeta: { flex: 1, minWidth: 0, fontSize: 10, lineHeight: 14 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 9, lineHeight: 12, fontWeight: '600', textTransform: 'capitalize' },
  profileTabs: { minHeight: 68, flexDirection: 'row', borderBottomWidth: 1 },
  profileTab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 8, position: 'relative' },
  profileTabLabel: { fontSize: 10, lineHeight: 14, fontWeight: '500' },
  profileTabLabelActive: { fontWeight: '700' },
  profileTabIndicator: { position: 'absolute', bottom: -1, width: '58%', height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  dataCard: { marginBottom: 0, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  userName: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.35,
  },
  userMeta: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
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
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 6,
  },
  infoRow: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 7,
  },
  infoIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF3F8' },
  infoCopy: { flex: 1, minWidth: 0, gap: 2 },
  infoLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
  },
});
