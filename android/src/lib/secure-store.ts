import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Cross-platform secure storage wrapper.
 * Uses expo-secure-store on native.
 * Falls back to localStorage on web (for development / Expo web).
 * Never use for highly sensitive data on web.
 */

const isWeb = Platform.OS === 'web';

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage setItem failed', e);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage getItem failed', e);
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage removeItem failed', e);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
