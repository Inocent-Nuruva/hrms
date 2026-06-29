import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import * as SecureStore from './secure-store';

export type NotificationSoundPreference = 'hrms-default' | 'device-default';

export const NOTIFICATION_SOUND_OPTIONS: Array<{
  key: NotificationSoundPreference;
  label: string;
  description: string;
}> = [
  {
    key: 'device-default',
    label: 'System default',
    description: 'Uses this device default notification sound.',
  },
];

const STORAGE_KEY = 'hrms.notificationSoundPreference';

const CHANNEL_IDS: Record<NotificationSoundPreference, string> = {
  'hrms-default': 'hrms-alerts-hrms-default',
  'device-default': 'hrms-alerts-device-default',
};

export function getNotificationChannelId(preference: NotificationSoundPreference) {
  return CHANNEL_IDS['device-default'];
}

export async function getNotificationSoundPreference(): Promise<NotificationSoundPreference> {
  await SecureStore.setItemAsync(STORAGE_KEY, 'device-default');
  return 'device-default';
}

export async function saveNotificationSoundPreference(preference: NotificationSoundPreference) {
  await SecureStore.setItemAsync(STORAGE_KEY, 'device-default');
  await ensureNotificationChannelsAsync();
}

export async function ensureNotificationChannelsAsync() {
  if (Platform.OS !== 'android') return;

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
  await getNotificationSoundPreference();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      data: input.data,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: getNotificationChannelId('device-default') } : {}),
    },
    trigger: null,
  });
}
