import * as SecureStore from 'expo-secure-store';
import { Session } from '@/src/api/types';

/**
 * Where the signed-in session is kept between app launches, on a device.
 *
 * SecureStore is the Keychain on iOS and EncryptedSharedPreferences on Android, so
 * the access token is not sitting in plain text on the filesystem. Every call is
 * tolerant of failure: a device that refuses the keystore should make someone sign
 * in again, never crash the app on launch.
 */

const KEY = 'yoir.session';

export async function readSession(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeSession(value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, value);
  } catch {
    // Not being able to remember the session is worth less than staying usable.
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Already gone, or the store is unavailable; either way there is nothing to do.
  }
}

export type { Session };
