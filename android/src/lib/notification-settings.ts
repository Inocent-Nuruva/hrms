import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import * as SecureStore from './secure-store';
import { api } from './api';

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
const PUSH_TOKEN_KEY = 'hrms.expoPushToken';

const CHANNEL_IDS: Record<NotificationSoundPreference, string> = {
  'hrms-default': 'hrms-alerts-hrms-default',
  'device-default': 'hrms-alerts-device-default',
};

export function getNotificationChannelId(_preference: NotificationSoundPreference) {
  return CHANNEL_IDS['device-default'];
}

export async function getNotificationSoundPreference(): Promise<NotificationSoundPreference> {
  await SecureStore.setItemAsync(STORAGE_KEY, 'device-default');
  return 'device-default';
}

export async function saveNotificationSoundPreference(_preference: NotificationSoundPreference) {
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

  // Android requires the channel to exist before the permission prompt is shown.
  await ensureNotificationChannelsAsync();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  return status === 'granted';
}

export async function registerRemotePushDeviceAsync() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  const granted = await ensureNotificationPermissionsAsync();
  if (!granted || !Device.isDevice) return;

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('Expo push registration is unavailable until the EAS project ID is configured.');
    return;
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.registerMyPushDevice({
    expo_push_token: token,
    platform: Platform.OS,
    device_name: Device.deviceName ?? undefined,
  });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
}

export async function unregisterRemotePushDeviceAsync() {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) return;
  await api.unregisterMyPushDevice(token);
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => {});
}

export async function presentHrmsNotification(input: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  if (Platform.OS === 'web') return;

  await ensureNotificationChannelsAsync();
  const hasPermission = await ensureNotificationPermissionsAsync();
  if (!hasPermission) return;
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
