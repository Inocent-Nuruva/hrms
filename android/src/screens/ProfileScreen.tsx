import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeCheck, BellRing, BriefcaseBusiness, Building2, CreditCard, Fingerprint, Mail, Phone, UserRound } from 'lucide-react-native';

import { api } from '../lib/api';
import { COLORS } from '../lib/config';
import {
  getNotificationSoundPreference,
  NOTIFICATION_SOUND_OPTIONS,
  saveNotificationSoundPreference,
  type NotificationSoundPreference,
} from '../lib/notification-settings';
import { Button } from '../components/ui/button';

import { Input } from '../components/ui/input';
import { SegmentedControl } from '../components/ui/segmented-control';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useToast } from '../hooks/useToast';

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(readString(user, ['first_name', 'firstName'], ''));
  const [lastName, setLastName] = useState(readString(user, ['last_name', 'lastName'], ''));
  const [phone, setPhone] = useState(readString(employee, ['phone', 'phone_number'], ''));
  const [emailInput, setEmailInput] = useState(readString(user, ['email'], ''));
  const [notificationSound, setNotificationSound] = useState<NotificationSoundPreference>('hrms-default');

  useEffect(() => {
    setFirstName(readString(user, ['first_name', 'firstName'], ''));
    setLastName(readString(user, ['last_name', 'lastName'], ''));
    setPhone(readString(employee, ['phone', 'phone_number'], ''));
    setEmailInput(readString(user, ['email'], ''));
  }, [employee, user]);

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
  const designation = readString(employee, ['designation_name']) || readString(employee?.designation || {}, ['name']) || readString(employee?.primary_designation || {}, ['name']) || 'Not assigned';
  const employeeNo = readString(employee, ['employee_no', 'user_no']) || readString(user, ['employeeId']) || '—';
  const email = readString(user, ['email']) || '—';
  const employmentStatus = readString(employee, ['employment_status', 'status']) || 'Active';
  const hireDate = formatDate(employee?.hire_date || employee?.joining_date);

  const contacts = Array.isArray(employee.contacts) ? employee.contacts : [];
  const addresses = Array.isArray(employee.addresses) ? employee.addresses : [];
  const relatives = Array.isArray(employee.relatives) ? employee.relatives : [];
  const identifications = Array.isArray(employee.identifications) ? employee.identifications : [];
  const bankAccounts = Array.isArray(employee.bank_accounts) ? employee.bank_accounts : [];

  const saveProfile = async () => {
    const id = readNumber(user, ['id']) ?? readNumber(employee, ['user_id', 'id']);
    if (id === null) {
      toast.error('Unable to resolve your user ID.');
      return;
    }
    setSaving(true);
    try {
      await api.updateMyProfile(id, {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      await auth.refreshProfile();
      setEditing(false);
      toast.success('Your changes have been saved.');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Update failed. Please try again later.');
    } finally {
      setSaving(false);
    }
  };

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
  }, [auth, biometricLabel]);

  const onChangeNotificationSound = React.useCallback(
    async (next: string) => {
      const choice = next === 'device-default' ? 'device-default' : 'hrms-default';
      setNotificationSound(choice);

      try {
        await saveNotificationSoundPreference(choice);
        toast.success(
          choice === 'hrms-default'
            ? 'HRMS notification sound is now active.'
            : 'Device default notification sound is now active.'
        );
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
      <MobileTopBar auth={auth} variant="compact" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <ScreenTransition>

          <SegmentedControl
            value={activeSection}
            onChange={(next) => setActiveSection(next as ProfileSection)}
            options={PROFILE_SECTIONS.map((item) => ({ key: item.key, label: item.label }))}
          />

          {activeSection === 'summary' ? (
            <>
            <View style={{ marginBottom: 16 }}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Summary</Text>
                <Button
                  variant={editing ? 'ghost' : 'secondary'}
                  onPress={() => setEditing((current) => !current)}
                  style={styles.summaryActionButton}
                >
                  {editing ? 'Cancel' : 'Edit'}
                </Button>
              </View>
              <InfoRow icon={<UserRound size={16} color={mutedColor} />} label="Employment status" value={employmentStatus} textColor={textColor} mutedColor={mutedColor} />
              <InfoRow icon={<Mail size={16} color={mutedColor} />} label="Email" value={email} textColor={textColor} mutedColor={mutedColor} />
              <InfoRow icon={<Phone size={16} color={mutedColor} />} label="Phone" value={phone || '—'} textColor={textColor} mutedColor={mutedColor} />
              <InfoRow icon={<BadgeCheck size={16} color={mutedColor} />} label="Hire date" value={hireDate} textColor={textColor} mutedColor={mutedColor} />
            </View>
            {editing ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Edit profile</Text>
                <Input label="First name" value={firstName} onChangeText={setFirstName} />
                <Input label="Last name" value={lastName} onChangeText={setLastName} />
                <Input label="Email" value={emailInput} editable={false} />
                <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                <View style={styles.actionRow}>
                  <Button variant="ghost" onPress={() => setEditing(false)} style={styles.flexButton}>Cancel</Button>
                  <Button onPress={saveProfile} loading={saving} style={styles.flexButton}>Save changes</Button>
                </View>
              </View>
            ) : null}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
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
                value={notificationSound === 'hrms-default' ? 'HRMS sound' : 'Device default'}
                textColor={textColor}
                mutedColor={mutedColor}
              />
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
              <InfoRow icon={<Building2 size={16} color={mutedColor} />} label="Department" value={department} textColor={textColor} mutedColor={mutedColor} />
              <InfoRow icon={<BriefcaseBusiness size={16} color={mutedColor} />} label="Position" value={position} textColor={textColor} mutedColor={mutedColor} />
              <InfoRow icon={<BriefcaseBusiness size={16} color={mutedColor} />} label="Designation" value={designation} textColor={textColor} mutedColor={mutedColor} />
            </View>
          ) : null}

          {activeSection === 'personal' ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Personal details</Text>
              {contacts.length ? contacts.map((contact: MobileRecord, index: number) => (
                <InfoRow
                  key={index}
                  icon={<Phone size={16} color={mutedColor} />}
                  label={readString(contact, ['contact_type']) || 'Contact'}
                  value={readString(contact, ['phone_number', 'email']) || '—'}
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
              )) : <Text style={[styles.emptyText, { color: mutedColor }]}>No personal contacts listed.</Text>}
              {addresses.length ? addresses.slice(0, 2).map((address: MobileRecord, index: number) => (
                <InfoRow
                  key={`address-${index}`}
                  icon={<Building2 size={16} color={mutedColor} />}
                  label={readString(address, ['address_type']) || 'Address'}
                  value={readString(address, ['city', 'street']) || '—'}
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
              )) : null}
              {relatives.length ? relatives.slice(0, 2).map((relative: MobileRecord, index: number) => (
                <InfoRow
                  key={`relative-${index}`}
                  icon={<UserRound size={16} color={mutedColor} />}
                  label={readString(relative, ['relationship']) || 'Relative'}
                  value={readString(relative, ['name']) || '—'}
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
              )) : null}
            </View>
          ) : null}

          {activeSection === 'records' ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Records</Text>
              {identifications.length ? identifications.slice(0, 3).map((record: MobileRecord, index: number) => (
                <InfoRow
                  key={`id-${index}`}
                  icon={<BadgeCheck size={16} color={mutedColor} />}
                  label={readString(record, ['identification_type']) || 'Identification'}
                  value={readString(record, ['number']) || '—'}
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
              )) : null}
              {bankAccounts.length ? bankAccounts.slice(0, 2).map((account: MobileRecord, index: number) => (
                <InfoRow
                  key={`bank-${index}`}
                  icon={<CreditCard size={16} color={mutedColor} />}
                  label={readString(account, ['bank_name']) || 'Bank account'}
                  value={readString(account, ['account_number']) || '—'}
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
              )) : null}
              {!identifications.length && !bankAccounts.length ? (
                <Text style={[styles.emptyText, { color: mutedColor }]}>Detailed records are best reviewed on the web portal.</Text>
              ) : null}
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

function readNumber(value: unknown, keys: string[]) {
  if (!value) return null;
  if (typeof value !== 'object') return null;
  const record = value as MobileRecord;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  flexButton: {
    flex: 1,
  },
  summaryActionButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  biometricToggleButton: {
    marginTop: 8,
  },
  infoRow: {
    paddingVertical: 14,
  },
  infoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
