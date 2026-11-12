import React from 'react';
// Load only the generated icon chunks used here instead of traversing the full icon barrel.
import { DismissRegular, DocumentColor, DocumentRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-3';
import { CheckmarkCircleColor, CheckmarkRegular, ChevronDownRegular, ChevronRightRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-2';
import { EyeOffRegular, EyeRegular, FingerprintRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-4';
import { MailColor } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-6';
import { SettingsColor, SettingsRegular, ShieldCheckmarkColor } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-8';
import { WeatherMoonRegular, WeatherSunnyLowColor } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-11';
import { ArrowEnterRegular, ArrowExitRegular, AlertColor } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-0';
import { BriefcaseColor, BriefcaseRegular, BuildingGovernmentColor, BuildingGovernmentRegular, CalendarClockColor, CalendarClockRegular, CalendarColor, CalendarRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-1';
import { ChevronLeftRegular, ClockColor, ClockRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-2';
import { TextBulletListSquareColor } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-10';
import { HomeColor, HomeRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-5';
import { LocationRippleColor, LocationRippleRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-6';
import { PanelLeftContractRegular, PeopleColor, PeopleListColor, PeopleListRegular, PeopleRegular, PersonColor, PersonRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-7';
import { TrophyColor, TrophyRegular, VaultColor, VaultRegular } from '../../../node_modules/@fluentui/react-native-icons/lib/icons/chunk-11';

const ALLIANCE_NAVY = '#2B3A8D';
const ICONS = {
  sun: WeatherSunnyLowColor,
  moon: WeatherMoonRegular,
  'shield-check': ShieldCheckmarkColor,
  mail: MailColor,
  'chevron-down': ChevronDownRegular,
  eye: EyeRegular,
  'eye-off': EyeOffRegular,
  fingerprint: FingerprintRegular,
  close: DismissRegular,
  check: CheckmarkRegular,
  'check-in': ArrowEnterRegular,
  'check-out': ArrowExitRegular,
  'checked-in': CheckmarkCircleColor,
  home: HomeColor,
  attendance: ClockColor,
  leave: CalendarColor,
  profile: PersonColor,
  history: PeopleListColor,
  promotion: TrophyColor,
  shift: CalendarClockColor,
  payroll: VaultColor,
  field: LocationRippleColor,
  finance: BuildingGovernmentColor,
  documents: DocumentColor,
  work: BriefcaseColor,
  people: PeopleColor,
  menu: TextBulletListSquareColor,
  'menu-close': PanelLeftContractRegular,
  notifications: AlertColor,
  logout: ArrowExitRegular,
  'chevron-left': ChevronLeftRegular,
  'chevron-right': ChevronRightRegular,
  settings: SettingsColor,
} as const;

const NAV_REGULAR_ICONS = {
  home: HomeRegular,
  attendance: ClockRegular,
  leave: CalendarRegular,
  profile: PersonRegular,
  history: PeopleListRegular,
  promotion: TrophyRegular,
  shift: CalendarClockRegular,
  payroll: VaultRegular,
  field: LocationRippleRegular,
  finance: BuildingGovernmentRegular,
  documents: DocumentRegular,
  work: BriefcaseRegular,
  people: PeopleRegular,
  settings: SettingsRegular,
} as const;

const MULTICOLOR_ICONS = new Set<IconName>([
  'sun', 'mail', 'shield-check', 'home', 'attendance', 'leave', 'profile', 'history',
  'promotion', 'shift', 'payroll', 'field', 'finance', 'documents',
  'work', 'people', 'menu', 'notifications', 'settings', 'checked-in',
]);

type IconName = keyof typeof ICONS;
interface Props { name: IconName; size?: number; color?: string; active?: boolean }

/** Microsoft Fluent System Icons, using Color variants where available. */
export function FluentSystemIcon({ name, size = 20, color = ALLIANCE_NAVY, active }: Props) {
  const isNavigationIcon = active !== undefined && name in NAV_REGULAR_ICONS;
  const Icon = isNavigationIcon && !active
    ? NAV_REGULAR_ICONS[name as keyof typeof NAV_REGULAR_ICONS]
    : ICONS[name];
  const isMulticolor = isNavigationIcon ? active === true : MULTICOLOR_ICONS.has(name);
  return <Icon width={size} height={size} {...(!isMulticolor ? { primaryFill: color } : {})} aria-hidden />;
}
