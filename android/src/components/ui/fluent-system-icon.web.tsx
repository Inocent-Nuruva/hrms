import React from 'react';
// Keep the browser bundle small by loading only these generated Fluent icon chunks.
import { MailColor } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-0';
import { EyeOffRegular, EyeRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-15';
import { ShieldCheckmarkColor } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-21';
import { SettingsColor, SettingsRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-4';
import { FingerprintRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-23';
import { CheckmarkRegular, ChevronDownRegular, ChevronRightRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-24';
import { DismissRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-28';
import { WeatherMoonRegular, WeatherSunnyLowColor } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-11';
import { ArrowEnterRegular, ArrowExitRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-21';
import { CheckmarkCircleColor } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-24';
import { AlertColor } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-9';
import { BriefcaseColor, BriefcaseRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-7';
import { BuildingGovernmentColor, BuildingGovernmentRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-26';
import { CalendarClockColor, CalendarClockRegular, CalendarColor, CalendarRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-0';
import { ChartMultipleColor, ChartMultipleRegular, ChevronLeftRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-24';
import { ClockColor, ClockRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-18';
import { DocumentColor, DocumentRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-3';
import { HomeColor, HomeRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-25';
import { LocationRippleColor, LocationRippleRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-18';
import { PersonColor, PersonRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-6';
import { PanelLeftContractRegular, TrophyColor, TrophyRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-28';
import { PeopleColor, PeopleListColor, PeopleListRegular, PeopleRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-27';
import { TextBulletListSquareColor } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-22';
import { VaultColor, VaultRegular } from '../../../node_modules/@fluentui/react-icons/lib/icons/chunk-19';

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
  performance: ChartMultipleColor,
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
  performance: ChartMultipleRegular,
  documents: DocumentRegular,
  work: BriefcaseRegular,
  people: PeopleRegular,
  settings: SettingsRegular,
} as const;

const MULTICOLOR_ICONS = new Set<IconName>([
  'sun', 'mail', 'shield-check', 'home', 'attendance', 'leave', 'profile', 'history',
  'promotion', 'shift', 'payroll', 'field', 'finance', 'performance', 'documents',
  'work', 'people', 'menu', 'notifications', 'settings', 'checked-in',
]);

type IconName = keyof typeof ICONS;
interface Props { name: IconName; size?: number; color?: string; active?: boolean }

/** Fluent React SVG icons for the Expo web preview. */
export function FluentSystemIcon({ name, size = 20, color = ALLIANCE_NAVY, active }: Props) {
  const isNavigationIcon = active !== undefined && name in NAV_REGULAR_ICONS;
  const Icon = isNavigationIcon && !active
    ? NAV_REGULAR_ICONS[name as keyof typeof NAV_REGULAR_ICONS]
    : ICONS[name];
  const isMulticolor = isNavigationIcon ? active === true : MULTICOLOR_ICONS.has(name);
  return <Icon width={size} height={size} {...(!isMulticolor ? { primaryFill: color } : {})} aria-hidden />;
}
