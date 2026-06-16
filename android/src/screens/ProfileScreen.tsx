import React, { useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { BadgeCheck, BriefcaseBusiness, Building2, CreditCard, Mail, Phone, UserRound } from 'lucide-react-native';

import { api } from '../lib/api';
import { COLORS } from '../lib/config';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { SegmentedControl } from '../components/ui/segmented-control';
import { StatusPill } from '../components/ui/status-pill';

type MobileRecord = Record<string, unknown>;

const PROFILE_SECTIONS = [
  { key: 'summary', label: 'Summary' },
  { key: 'work', label: 'Work' },
  { key: 'personal', label: 'Personal' },
  { key: 'records', label: 'Records' },
] as const;

type ProfileSection = typeof PROFILE_SECTIONS[number]['key'];

interface Props {
  auth: { user?: MobileRecord | null; employee?: MobileRecord | null; refreshProfile: () => Promise<void> };
}

export function ProfileScreen({ auth }: Props) {
  const isDark = useColorScheme() === 'dark';
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const subtleBlock = isDark ? COLORS.surfaceVariantDark : '#f5f5f5';

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
      Alert.alert('Cannot update', 'Unable to resolve your user ID.');
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
      Alert.alert('Profile updated', 'Your changes have been saved.');
    } catch (error: unknown) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again later.');
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    await auth.refreshProfile();
  }, [auth]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <Card style={styles.heroCard}>
        <StatusPill label="My Profile" tone="neutral" />
        <View style={styles.heroRow}>
          <View style={[styles.avatar, { backgroundColor: textColor }]}>
            <Text style={[styles.avatarText, { color: isDark ? COLORS.backgroundDark : '#ffffff' }]}>
              {fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: textColor }]}>{fullName}</Text>
            <Text style={[styles.subtext, { color: mutedColor }]}>{email}</Text>
            <Text style={[styles.subtext, { color: mutedColor }]}>{employeeNo}</Text>
          </View>
          <View style={[styles.badgeBox, { backgroundColor: subtleBlock }]}>
            <BadgeCheck size={20} color={textColor} />
          </View>
        </View>
      </Card>

      <SegmentedControl
        value={activeSection}
        onChange={(next) => setActiveSection(next as ProfileSection)}
        options={PROFILE_SECTIONS.map((item) => ({ key: item.key, label: item.label }))}
      />

      {editing ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Edit profile</Text>
          <Input label="First name" value={firstName} onChangeText={setFirstName} />
          <Input label="Last name" value={lastName} onChangeText={setLastName} />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <View style={styles.actionRow}>
            <Button variant="ghost" onPress={() => setEditing(false)} style={styles.flexButton}>Cancel</Button>
            <Button onPress={saveProfile} loading={saving} style={styles.flexButton}>Save changes</Button>
          </View>
        </Card>
      ) : (
        <Button variant="secondary" onPress={() => setEditing(true)}>
          Edit basic profile
        </Button>
      )}

      {activeSection === 'summary' ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Summary</Text>
          <InfoRow icon={<UserRound size={16} color={mutedColor} />} label="Employment status" value={employmentStatus} textColor={textColor} mutedColor={mutedColor} />
          <InfoRow icon={<Mail size={16} color={mutedColor} />} label="Email" value={email} textColor={textColor} mutedColor={mutedColor} />
          <InfoRow icon={<Phone size={16} color={mutedColor} />} label="Phone" value={phone || '—'} textColor={textColor} mutedColor={mutedColor} />
          <InfoRow icon={<BadgeCheck size={16} color={mutedColor} />} label="Hire date" value={hireDate} textColor={textColor} mutedColor={mutedColor} />
        </Card>
      ) : null}

      {activeSection === 'work' ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Work assignment</Text>
          <InfoRow icon={<Building2 size={16} color={mutedColor} />} label="Branch" value={branch} textColor={textColor} mutedColor={mutedColor} />
          <InfoRow icon={<Building2 size={16} color={mutedColor} />} label="Department" value={department} textColor={textColor} mutedColor={mutedColor} />
          <InfoRow icon={<BriefcaseBusiness size={16} color={mutedColor} />} label="Position" value={position} textColor={textColor} mutedColor={mutedColor} />
          <InfoRow icon={<BriefcaseBusiness size={16} color={mutedColor} />} label="Designation" value={designation} textColor={textColor} mutedColor={mutedColor} />
        </Card>
      ) : null}

      {activeSection === 'personal' ? (
        <Card>
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
        </Card>
      ) : null}

      {activeSection === 'records' ? (
        <Card>
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
        </Card>
      ) : null}
    </ScrollView>
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
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  heroCard: {
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
  },
  badgeBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtext: {
    marginTop: 4,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  flexButton: {
    flex: 1,
  },
  infoRow: {
    paddingVertical: 10,
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
