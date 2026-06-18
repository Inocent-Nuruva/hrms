import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import * as SecureStore from './secure-store';

const BIOMETRIC_ENABLED_KEY = 'hrms.biometricEnabled';

export interface BiometricStatus {
  enabled: boolean;
  enrolled: boolean;
  label: string;
  supported: boolean;
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  if (Platform.OS === 'web') {
    return {
      enabled: false,
      enrolled: false,
      label: 'Fingerprint',
      supported: false,
    };
  }

  const storedPreference = (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY).catch(() => null)) === 'true';
  const supported = await LocalAuthentication.hasHardwareAsync().catch(() => false);
  const enrolled = supported ? await LocalAuthentication.isEnrolledAsync().catch(() => false) : false;
  const authenticationTypes = supported
    ? await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [])
    : [];

  return {
    enabled: storedPreference && supported && enrolled,
    enrolled,
    label: getBiometricLabel(authenticationTypes),
    supported,
  };
}

export async function setBiometricEnabled(enabled: boolean) {
  if (!enabled) {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY).catch(() => {});
    return;
  }

  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
}

export async function authenticateWithBiometrics(label = 'Biometric', promptMessage?: string) {
  if (Platform.OS === 'web') return false;

  const result = await LocalAuthentication.authenticateAsync({
    cancelLabel: 'Cancel',
    promptMessage: promptMessage || `Use ${label.toLowerCase()} to continue`,
  });

  return result.success;
}

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (!Array.isArray(types) || types.length === 0) {
    return 'Fingerprint';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }

  return 'Fingerprint';
}
