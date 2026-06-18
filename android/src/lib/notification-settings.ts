import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import * as SecureStore from './secure-store';

export const HRMS_NOTIFICATION_SOUND_FILE = 'mixkit-software-interface-remove-2576.wav';

export type NotificationSoundPreference = 'hrms-default' | 'device-default';

export const NOTIFICATION_SOUND_OPTIONS: Array<{
  key: NotificationSoundPreference;
  label: string;
  description: string;
}> = [
  {
    key: 'hrms-default',
    label: 'HRMS sound',
    description: 'Plays the bundled HRMS alert tone.',
  },
  {
    key: 'device-default',
    label: 'Device default',
    description: 'Uses this device default notification sound.',
  },
];

const STORAGE_KEY = 'hrms.notificationSoundPreference';

const CHANNEL_IDS: Record<NotificationSoundPreference, string> = {
  'hrms-default': 'hrms-alerts-hrms-default',
  'device-default': 'hrms-alerts-device-default',
};

export function getNotificationChannelId(preference: NotificationSoundPreference) {
  return CHANNEL_IDS[preference];
}

export async function getNotificationSoundPreference(): Promise<NotificationSoundPreference> {
  const stored = await SecureStore.getItemAsync(STORAGE_KEY);
  return stored === 'device-default' ? 'device-default' : 'hrms-default';
}

export async function saveNotificationSoundPreference(preference: NotificationSoundPreference) {
  await SecureStore.setItemAsync(STORAGE_KEY, preference);
  await ensureNotificationChannelsAsync();
}

export async function ensureNotificationChannelsAsync() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_IDS['hrms-default'], {
    name: 'HRMS alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 240],
    lightColor: '#208AEF',
    sound: HRMS_NOTIFICATION_SOUND_FILE,
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_IDS['device-default'], {
    name: 'HRMS alerts (device default)',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 240],
    lightColor: '#208AEF',
  });
}

export async function ensureNotificationPermissionsAsync() {
  if (Platform.OS === 'web') return false;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  return status === 'granted';
}

export async function presentHrmsNotification(input: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  if (Platform.OS === 'web') return;

  await ensureNotificationChannelsAsync();
  const preference = await getNotificationSoundPreference();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      data: input.data,
      sound: preference === 'hrms-default' ? HRMS_NOTIFICATION_SOUND_FILE : 'default',
      ...(Platform.OS === 'android' ? { channelId: getNotificationChannelId(preference) } : {}),
    },
    trigger: null,
  });
}
